"""A file that appears in a shared folder after the share starts is judged like any other."""
import os

from conftest import SECRET, identity, make_late_tree, make_web


def test_a_shortcut_added_after_the_share_starts_is_not_servable(tmp_path):
    outside, site, late = make_late_tree(str(tmp_path))
    web = make_web("share", [site], autostop_sharing=False)
    os.symlink(outside, late)
    with web.app.test_client() as client:
        response = client.get("/preview/nested/late-shortcut.txt", headers=identity())
    assert response.status_code < 500, "the request fell through to a server error"
    assert SECRET not in response.get_data(), "a shortcut added later was servable"
