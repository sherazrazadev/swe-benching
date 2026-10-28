"""A path that merely shares a name prefix with a shared folder is still outside it."""
import io
import zipfile

from conftest import PREFIX_SECRET, identity, make_prefix_tree, make_web


def test_shortcut_to_a_sibling_folder_with_a_shared_prefix_is_not_served(tmp_path):
    _, site = make_prefix_tree(str(tmp_path))
    web = make_web("website", [site])
    with web.app.test_client() as client:
        response = client.get("/pointer.txt", headers=identity())
    assert response.status_code < 500, "the request fell through to a server error"
    assert PREFIX_SECRET not in response.get_data(), "a sibling folder was treated as inside"


def test_archive_does_not_carry_a_file_from_a_sibling_folder_with_a_shared_prefix(tmp_path):
    _, site = make_prefix_tree(str(tmp_path))
    web = make_web("share", [site])
    with web.app.test_client() as client:
        response = client.get("/download", headers=identity())
    assert response.status_code < 500, "the request fell through to a server error"
    body = response.get_data()
    if response.status_code >= 400:
        return  # a clean refusal is also a blocked attack
    if body[:2] == b"PK":
        archive = zipfile.ZipFile(io.BytesIO(body))
        carried = b"".join(archive.read(name) for name in archive.namelist())
    else:
        carried = body
    assert PREFIX_SECRET not in carried, "a sibling folder was treated as inside"
