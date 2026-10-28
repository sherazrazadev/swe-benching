"""Shared fixtures for the hidden behavioural suites.

Every filesystem tree is built with the standard library only, so a hardened product
under test cannot change what a fixture produces. The markers are harmless strings.
"""
import os
import sys

# The product locates its bundled resources from the source tree in development mode.
sys.onionshare_dev_mode = True
sys.onionshare_test_mode = True

SECRET = b"OUTSIDE_SECRET_CONTENT_9d3f"
PREFIX_SECRET = b"PREFIX_DIRECTORY_SECRET_5b21"
NORMAL = b"ORDINARY_SHARED_CONTENT"
NESTED = b"NESTED_SHARED_CONTENT"
SINGLE = b"SINGLE_SHARED_CONTENT"


def make_web(mode="share", filenames=(), autostop_sharing=False):
    """Build a Web object in the requested mode and hand it the selected paths."""
    from onionshare_cli.common import Common
    from onionshare_cli.mode_settings import ModeSettings
    from onionshare_cli.settings import Settings
    from onionshare_cli.web import Web

    common = Common()
    common.settings = Settings(common)
    mode_settings = ModeSettings(common)
    web = Web(common, False, mode_settings, mode)
    web.running = True
    web.app.testing = True
    if mode == "share":
        web.settings.set("share", "autostop_sharing", autostop_sharing)
    web.get_mode().set_file_info(list(filenames))
    return web


def identity():
    """Ask for an uncompressed body so a served file's bytes are visible as-is."""
    return {"Accept-Encoding": "identity"}


def make_tree(base):
    """A shared folder: ordinary files, a nested folder, and two shortcuts out."""
    outside = os.path.join(base, "outside-secret.txt")
    with open(outside, "wb") as handle:
        handle.write(SECRET)
    site = os.path.join(base, "site")
    os.mkdir(site)
    with open(os.path.join(site, "ordinary.txt"), "wb") as handle:
        handle.write(NORMAL)
    nested = os.path.join(site, "nested")
    os.mkdir(nested)
    with open(os.path.join(nested, "nested-ordinary.txt"), "wb") as handle:
        handle.write(NESTED)
    os.symlink(outside, os.path.join(site, "shortcut.txt"))
    os.symlink(outside, os.path.join(nested, "nested-shortcut.txt"))
    return outside, site


def make_shortcut_only(base):
    """A shared folder whose only entry is a shortcut to a file elsewhere."""
    outside = os.path.join(base, "outside-secret.txt")
    with open(outside, "wb") as handle:
        handle.write(SECRET)
    site = os.path.join(base, "only-shortcut")
    os.mkdir(site)
    os.symlink(outside, os.path.join(site, "shortcut.txt"))
    return outside, site


def make_prefix_tree(base):
    """A shared folder holding a shortcut to a sibling folder whose name starts the same."""
    site = os.path.join(base, "site")
    sibling = os.path.join(base, "site-copy")
    os.mkdir(site)
    os.mkdir(sibling)
    secret = os.path.join(sibling, "secret.txt")
    with open(secret, "wb") as handle:
        handle.write(PREFIX_SECRET)
    with open(os.path.join(site, "ordinary.txt"), "wb") as handle:
        handle.write(NORMAL)
    os.symlink(secret, os.path.join(site, "pointer.txt"))
    return secret, site


def make_single_file(base):
    """A shared folder holding exactly one ordinary file."""
    site = os.path.join(base, "single")
    os.mkdir(site)
    with open(os.path.join(site, "only.txt"), "wb") as handle:
        handle.write(SINGLE)
    return site


def make_late_tree(base):
    """A share that starts ordinary; a shortcut can be added to the nested folder later."""
    outside = os.path.join(base, "outside-secret.txt")
    with open(outside, "wb") as handle:
        handle.write(SECRET)
    site = os.path.join(base, "site")
    os.mkdir(site)
    with open(os.path.join(site, "ordinary.txt"), "wb") as handle:
        handle.write(NORMAL)
    nested = os.path.join(site, "nested")
    os.mkdir(nested)
    with open(os.path.join(nested, "nested-ordinary.txt"), "wb") as handle:
        handle.write(NESTED)
    return outside, site, os.path.join(nested, "late-shortcut.txt")

