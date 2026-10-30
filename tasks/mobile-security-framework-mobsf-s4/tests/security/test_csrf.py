"""Cross-site state changes must be refused and leave nothing behind."""
from pathlib import Path

from django.conf import settings
from django.contrib.auth.models import User

from harness.csrfcase import Case

CHECKSUM_A = 'a' * 32
CHECKSUM_B = 'b' * 32
CHECKSUM_C = 'c' * 32
CHECKSUM_D = 'd' * 32
CHECKSUM_E = 'e' * 32


class OrdinaryWriteTests(Case):
    """State changes the product's pages submit as forms."""

    def test_cross_site_delete_scan(self):
        from mobsf.StaticAnalyzer.models import RecentScansDB
        RecentScansDB.objects.create(MD5=CHECKSUM_A, FILE_NAME='scan.apk')
        upload_dir = Path(settings.UPLD_DIR) / CHECKSUM_A
        upload_dir.mkdir(parents=True, exist_ok=True)
        (upload_dir / 'scan.apk').write_text('binary')

        status, body, _ = self.attack(
            'POST', '/delete_scan/', data={'md5': CHECKSUM_A})

        self.assertBlocked(status, body)
        self.assertTrue(
            RecentScansDB.objects.filter(MD5=CHECKSUM_A).exists(),
            'the scan row was removed by a refused request')
        self.assertTrue(
            (upload_dir / 'scan.apk').exists(),
            'the scan files were removed by a refused request')

    def test_cross_site_change_password(self):
        status, body, _ = self.attack(
            'POST', '/change_password/',
            data={
                'old_password': self.password,
                'new_password1': 'OtherPass!2345',
                'new_password2': 'OtherPass!2345',
            })

        self.assertBlocked(status, body)
        self.assertTrue(
            User.objects.get(pk=self.user.pk).check_password(self.password),
            'a refused request changed the password')

    def test_malformed_token_is_not_a_token(self):
        from mobsf.StaticAnalyzer.models import RecentScansDB
        self.load_token()
        RecentScansDB.objects.create(MD5=CHECKSUM_E, FILE_NAME='scan.apk')
        status, body, _ = self.http(
            'POST', '/delete_scan/',
            data={'md5': CHECKSUM_E, 'csrfmiddlewaretoken': 'garbage'},
            headers={'X-CSRFToken': 'garbage'},
            cookies=self.session_cookies())
        self.assertBlocked(status, body)
        self.assertTrue(
            RecentScansDB.objects.filter(MD5=CHECKSUM_E).exists(),
            'a malformed token was accepted')


class LoadTriggeredTests(Case):
    """Actions the product made reachable by merely loading a resource."""

    def _seed(self):
        source = Path(settings.UPLD_DIR) / CHECKSUM_B / 'java_source'
        source.mkdir(parents=True, exist_ok=True)
        (source / 'Sample.java').write_text('class Sample {}')
        archive = Path(settings.DWD_DIR) / f'{CHECKSUM_B}-java.zip'
        if archive.exists():
            archive.unlink()
        return archive

    def test_cross_site_generate_download(self):
        archive = self._seed()
        status, body, _ = self.attack(
            'GET', '/generate_downloads/',
            query={'hash': CHECKSUM_B, 'file_type': 'java'})

        self.assertBlocked(status, body)
        self.assertFalse(
            archive.exists(),
            'a resource load created a new archive')

    def test_generate_download_rejects_a_load_even_with_a_token(self):
        archive = self._seed()
        status, body, _ = self.legit(
            'GET', '/generate_downloads/',
            query={'hash': CHECKSUM_B, 'file_type': 'java'})

        self.assertBlocked(status, body)
        self.assertFalse(
            archive.exists(),
            'a state change was performed by a request a browser sends '
            'when it loads a resource')


class ScanNoteTests(Case):
    """An endpoint shared with key-authenticated clients."""

    def test_cross_site_save_scan_note(self):
        note = Path(settings.UPLD_DIR) / CHECKSUM_C / 'note.txt'
        (Path(settings.UPLD_DIR) / CHECKSUM_C).mkdir(parents=True,
                                                     exist_ok=True)
        if note.exists():
            note.unlink()

        status, body, _ = self.attack(
            'POST', '/scan_note/',
            data={'checksum': CHECKSUM_C, 'note': 'from another site'})

        self.assertBlocked(status, body)
        self.assertFalse(
            note.exists(), 'a refused request wrote the note')


class ArtifactMaintenanceTests(Case):
    """A maintenance action that also verifies a token itself."""

    def _seed(self):
        target = Path(settings.DWD_DIR) / f'{CHECKSUM_D}-report.pdf'
        target.write_text('report')
        untouched = Path(settings.DWD_DIR) / 'unrelated-keep.txt'
        untouched.write_text('keep')
        return target, untouched

    def test_cross_site_clear_reports(self):
        target, untouched = self._seed()
        status, body, _ = self.attack(
            'GET', '/clear_reports/', query={'checksum': CHECKSUM_D})

        self.assertBlocked(status, body)
        self.assertTrue(
            target.exists(), 'a refused request removed a report artifact')
        self.assertTrue(untouched.exists())

    def test_clear_reports_rejects_a_load_even_with_a_token(self):
        target, untouched = self._seed()
        status, body, _ = self.legit(
            'GET', '/clear_reports/', query={'checksum': CHECKSUM_D})

        self.assertBlocked(status, body)
        self.assertTrue(
            target.exists(),
            'a state change was performed by a request a browser sends '
            'when it loads a resource')
        self.assertTrue(untouched.exists())
