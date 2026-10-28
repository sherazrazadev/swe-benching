"""Bundles must never carry a file whose real location is outside the shared folders."""
import io
import zipfile

from conftest import SECRET, identity, make_shortcut_only, make_tree, make_web


def _archive(response):
    assert response.status_code < 500, "the request fell through to a server error"
    if response.status_code >= 400:
        return None  # a clean refusal is also a blocked attack
    return zipfile.ZipFile(io.BytesIO(response.get_data()))


def _assert_no_entry_discloses_outside(archive):
    if archive is None:
        return
    for name in archive.namelist():
        assert SECRET not in archive.read(name), f"{name} carries outside content"


def test_whole_share_archive_omits_a_shortcut_out_of_the_share(tmp_path):
    _, site = make_tree(str(tmp_path))
    web = make_web("share", [site])
    with web.app.test_client() as client:
        _assert_no_entry_discloses_outside(
            _archive(client.get("/download", headers=identity()))
        )


def test_a_share_of_one_shortcut_does_not_disclose_outside(tmp_path):
    _, site = make_shortcut_only(str(tmp_path))
    web = make_web("share", [site])
    with web.app.test_client() as client:
        response = client.get("/download", headers=identity())
        assert response.status_code < 500, "the request fell through to a server error"
        body = response.get_data()
        assert SECRET not in body, "content from outside the share was served"
        if body[:2] == b"PK":
            _assert_no_entry_discloses_outside(archive=zipfile.ZipFile(io.BytesIO(body)))


def test_a_folder_archive_omits_a_shortcut_out_of_the_share(tmp_path):
    _, site = make_tree(str(tmp_path))
    web = make_web("share", [site])
    with web.app.test_client() as client:
        _assert_no_entry_discloses_outside(
            _archive(client.get("/download/nested", headers=identity()))
        )
