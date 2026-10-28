"""A file whose real location is outside the shared folders must not be served."""
from conftest import SECRET, identity, make_tree, make_web


def _assert_not_disclosed(response):
    assert response.status_code < 500, "the request fell through to a server error"
    assert SECRET not in response.get_data(), "content from outside the share was served"


def test_website_does_not_serve_a_shortcut_out_of_the_share(tmp_path):
    _, site = make_tree(str(tmp_path))
    web = make_web("website", [site])
    with web.app.test_client() as client:
        _assert_not_disclosed(client.get("/shortcut.txt", headers=identity()))


def test_share_does_not_serve_a_shortcut_out_of_the_share(tmp_path):
    _, site = make_tree(str(tmp_path))
    web = make_web("share", [site], autostop_sharing=False)
    with web.app.test_client() as client:
        _assert_not_disclosed(client.get("/shortcut.txt", headers=identity()))


def test_website_does_not_serve_a_nested_shortcut_out_of_the_share(tmp_path):
    _, site = make_tree(str(tmp_path))
    web = make_web("website", [site])
    with web.app.test_client() as client:
        _assert_not_disclosed(
            client.get("/nested/nested-shortcut.txt", headers=identity())
        )


def test_share_does_not_serve_a_nested_shortcut_out_of_the_share(tmp_path):
    _, site = make_tree(str(tmp_path))
    web = make_web("share", [site], autostop_sharing=False)
    with web.app.test_client() as client:
        _assert_not_disclosed(
            client.get("/nested/nested-shortcut.txt", headers=identity())
        )
