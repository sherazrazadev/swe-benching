"""Legitimate shares keep working, including next to an entry that must not be served."""
import io
import zipfile

from conftest import NESTED, NORMAL, SINGLE, identity, make_single_file, make_tree, make_web


def _body(response):
    assert response.status_code == 200
    return response.get_data()


def test_individual_download_of_ordinary_files_keeps_working(tmp_path):
    _, site = make_tree(str(tmp_path))
    web = make_web("share", [site], autostop_sharing=False)
    with web.app.test_client() as client:
        assert NORMAL in _body(client.get("/ordinary.txt", headers=identity()))
        assert NESTED in _body(
            client.get("/nested/nested-ordinary.txt", headers=identity())
        )


def test_website_keeps_serving_ordinary_files_next_to_a_shortcut(tmp_path):
    _, site = make_tree(str(tmp_path))
    web = make_web("website", [site])
    with web.app.test_client() as client:
        assert NORMAL in _body(client.get("/ordinary.txt", headers=identity()))
        assert NESTED in _body(
            client.get("/nested/nested-ordinary.txt", headers=identity())
        )


def test_archive_keeps_ordinary_entries_next_to_a_shortcut(tmp_path):
    _, site = make_tree(str(tmp_path))
    web = make_web("share", [site])
    with web.app.test_client() as client:
        response = client.get("/download", headers=identity())
    assert response.status_code == 200
    archive = zipfile.ZipFile(io.BytesIO(response.get_data()))
    names = archive.namelist()
    assert any(name.endswith("ordinary.txt") for name in names)
    assert NESTED in b"".join(
        archive.read(name) for name in names if name.endswith("nested-ordinary.txt")
    )


def test_browsing_a_folder_still_lists_and_serves_ordinary_files(tmp_path):
    _, site = make_tree(str(tmp_path))
    web = make_web("share", [site], autostop_sharing=False)
    with web.app.test_client() as client:
        listing = _body(client.get("/nested"))
        assert b"nested-ordinary.txt" in listing
        assert NESTED in _body(
            client.get("/nested/nested-ordinary.txt", headers=identity())
        )
        assert NESTED in _body(
            client.get("/preview/nested/nested-ordinary.txt", headers=identity())
        )


def test_a_share_of_one_ordinary_file_still_downloads_it(tmp_path):
    site = make_single_file(str(tmp_path))
    web = make_web("share", [site])
    with web.app.test_client() as client:
        response = client.get("/download", headers=identity())
    assert response.status_code == 200
    assert SINGLE in response.get_data()


def test_folder_archive_keeps_ordinary_entries(tmp_path):
    _, site = make_tree(str(tmp_path))
    web = make_web("share", [site])
    with web.app.test_client() as client:
        response = client.get("/download/nested", headers=identity())
    assert response.status_code == 200
    archive = zipfile.ZipFile(io.BytesIO(response.get_data()))
    joined = b"".join(archive.read(name) for name in archive.namelist())
    assert NESTED in joined


def test_a_share_without_shortcuts_round_trips(tmp_path):
    site = make_single_file(str(tmp_path))
    web = make_web("share", [site], autostop_sharing=False)
    with web.app.test_client() as client:
        assert SINGLE in _body(client.get("/only.txt", headers=identity()))
        response = client.get("/download", headers=identity())
    assert response.status_code == 200
    body = response.get_data()
    if body[:2] == b"PK":
        archive = zipfile.ZipFile(io.BytesIO(body))
        assert SINGLE in b"".join(archive.read(n) for n in archive.namelist())
    else:
        assert SINGLE in body
