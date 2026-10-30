"""Legitimate use of the product keeps working, including the coupled
behaviour next to every protected action."""
from pathlib import Path

from django.conf import settings
from django.contrib.auth.models import User

from harness.csrfcase import API_KEY, Case

CHECKSUM_A = 'a' * 32
CHECKSUM_B = 'b' * 32
CHECKSUM_C = 'c' * 32
CHECKSUM_D = 'd' * 32
CHECKSUM_E = 'e' * 32


class LegitimateWrites(Case):
    """The product's own pages carry a usable anti-forgery token."""

    def test_delete_scan_with_token(self):
        from mobsf.StaticAnalyzer.models import RecentScansDB
        RecentScansDB.objects.create(MD5=CHECKSUM_A, FILE_NAME='scan.apk')
        status, body, _ = self.legit(
            'POST', '/delete_scan/', data={'md5': CHECKSUM_A})
        self.assertIn(status, (200, 302), body[:200])
        self.assertFalse(
            RecentScansDB.objects.filter(MD5=CHECKSUM_A).exists())

    def test_change_password_with_token(self):
        status, body, _ = self.legit(
            'POST', '/change_password/',
            data={
                'old_password': self.password,
                'new_password1': 'OtherPass!2345',
                'new_password2': 'OtherPass!2345',
            })
        self.assertIn(status, (200, 302), body[:200])
        self.assertTrue(
            User.objects.get(pk=self.user.pk).check_password(
                'OtherPass!2345'))

    def test_generate_download_with_token(self):
        source = Path(settings.UPLD_DIR) / CHECKSUM_B / 'java_source'
        source.mkdir(parents=True, exist_ok=True)
        (source / 'Sample.java').write_text('class Sample {}')
        archive = Path(settings.DWD_DIR) / f'{CHECKSUM_B}-java.zip'
        if archive.exists():
            archive.unlink()
        params = {'hash': CHECKSUM_B, 'file_type': 'java'}

        status, body, _ = self.legit(
            'POST', '/generate_downloads/', query=params, data=params)

        self.assertIn(status, (200, 302), body[:200])
        self.assertTrue(archive.exists(), 'the archive was not produced')
        read_status, read_body, _ = self.http(
            'GET', f'/download/{CHECKSUM_B}-java.zip',
            cookies={'sessionid': self.session_id})
        self.assertEqual(read_status, 200)
        self.assertTrue(read_body.startswith(b'PK'))

    def test_save_scan_note_with_token(self):
        scan_dir = Path(settings.UPLD_DIR) / CHECKSUM_C
        scan_dir.mkdir(parents=True, exist_ok=True)
        note = scan_dir / 'note.txt'
        if note.exists():
            note.unlink()
        status, body, _ = self.legit(
            'POST', '/scan_note/',
            data={'checksum': CHECKSUM_C, 'note': 'reviewed by hand'})
        self.assertIn(status, (200, 302), body[:200])
        self.assertEqual(note.read_text(), 'reviewed by hand')

    def test_clear_reports_with_token(self):
        target = Path(settings.DWD_DIR) / f'{CHECKSUM_D}-report.pdf'
        target.write_text('report')
        untouched = Path(settings.DWD_DIR) / 'unrelated-keep.txt'
        untouched.write_text('keep')
        status, body, _ = self.legit(
            'POST', '/clear_reports/', query={'checksum': CHECKSUM_D},
            data={'checksum': CHECKSUM_D})
        self.assertIn(status, (200, 302), body[:200])
        self.assertFalse(target.exists(), 'the artifact was not removed')
        self.assertTrue(untouched.exists())


class ReadsAndProgrammaticClients(Case):
    """Reads and key-authenticated clients are not browser state changes."""

    def test_read_only_download_without_token(self):
        seed = Path(settings.DWD_DIR) / 'seed-download.txt'
        seed.write_text('hello download')
        status, body, _ = self.http(
            'GET', '/download/seed-download.txt',
            cookies={'sessionid': self.session_id})
        self.assertEqual(status, 200)
        self.assertEqual(body, b'hello download')

    def test_api_client_with_key_and_no_token(self):
        from mobsf.StaticAnalyzer.models import RecentScansDB
        RecentScansDB.objects.create(MD5=CHECKSUM_E, FILE_NAME='scan.apk')
        status, body, _ = self.http(
            'POST', '/api/v1/delete_scan',
            data={'hash': CHECKSUM_E},
            headers={'X-Mobsf-Api-Key': API_KEY}, cookies={})
        self.assertEqual(status, 200, body[:200])
        self.assertFalse(
            RecentScansDB.objects.filter(MD5=CHECKSUM_E).exists())


    def test_programmatic_note_client_keeps_working(self):
        scan_dir = Path(settings.UPLD_DIR) / CHECKSUM_C
        scan_dir.mkdir(parents=True, exist_ok=True)
        note = scan_dir / 'note.txt'
        if note.exists():
            note.unlink()
        status, body, _ = self.http(
            'POST', '/api/v1/scan_note',
            data={'hash': CHECKSUM_C, 'note': 'from the cli'},
            headers={'X-Mobsf-Api-Key': API_KEY}, cookies={})
        self.assertEqual(status, 200, body[:200])
        self.assertEqual(note.read_text(), 'from the cli')

    def test_identity_provider_callback_is_not_refused(self):
        status, body, _ = self.http(
            'POST', '/sso/acs/', data={'SAMLResponse': 'assertion'},
            cookies={})
        # The handler rejects the unconfigured assertion itself; what matters
        # is that the request is not refused by the anti-forgery layer.
        self.assertNotEqual(status, 403, body[:200])
        self.assertNotIn(b'CSRF', body)
