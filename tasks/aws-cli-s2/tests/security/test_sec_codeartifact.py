"""CodeArtifact login stores a repository token in tool configuration files."""
from __future__ import annotations

import base64
import os

from conftest import (
    assert_owner_only,
    make_swift_stub,
    read_text,
    run_aws,
    write_file,
)

AUTH_TOKEN = base64.b64encode(b"aws:AuthTokenMarker").decode()
OTHER_ENTRY = "machine other.example.com login token password keep-me\n"


def _login(home, endpoint, tool, extra_env=None):
    return run_aws(
        home, endpoint,
        "codeartifact", "login",
        "--tool", tool,
        "--domain", "marker-domain",
        "--repository", "marker-repository",
        extra_env=extra_env,
    )


def test_swift_existing_netrc_is_tightened(tmp_path, endpoint):
    home = tmp_path / "home"
    home.mkdir()
    netrc = home / ".netrc"
    write_file(netrc, OTHER_ENTRY, 0o644)
    bindir = make_swift_stub(tmp_path)
    proc = _login(home, endpoint, "swift",
                  {"PATH": bindir + os.pathsep + os.environ["PATH"]})
    assert proc.returncode == 0, proc.stderr[-2000:]
    text = read_text(netrc)
    assert "password " + AUTH_TOKEN in text
    assert OTHER_ENTRY.strip() in text
    assert_owner_only(netrc)


def test_swift_existing_netrc_with_matching_entry_is_tightened(tmp_path, endpoint):
    home = tmp_path / "home"
    home.mkdir()
    netrc = home / ".netrc"
    host = "dom-1234.d.codeartifact.us-east-1.amazonaws.com"
    write_file(
        netrc,
        OTHER_ENTRY + "machine %s login token password stale-token\n" % host,
        0o644,
    )
    bindir = make_swift_stub(tmp_path)
    proc = _login(home, endpoint, "swift",
                  {"PATH": bindir + os.pathsep + os.environ["PATH"]})
    assert proc.returncode == 0, proc.stderr[-2000:]
    text = read_text(netrc)
    assert "password " + AUTH_TOKEN in text
    assert "stale-token" not in text
    assert OTHER_ENTRY.strip() in text
    assert_owner_only(netrc)


def test_twine_new_pypirc_is_owner_only(tmp_path, endpoint):
    home = tmp_path / "home"
    home.mkdir()
    proc = _login(home, endpoint, "twine")
    assert proc.returncode == 0, proc.stderr[-2000:]
    pypirc = home / ".pypirc"
    text = read_text(pypirc)
    assert "password = " + AUTH_TOKEN in text
    assert_owner_only(pypirc)


def test_twine_existing_pypirc_is_tightened(tmp_path, endpoint):
    home = tmp_path / "home"
    home.mkdir()
    pypirc = home / ".pypirc"
    write_file(
        pypirc,
        "[distutils]\nindex-servers =\n    pypi\n\n"
        "[pypi]\nrepository: https://example.invalid/simple/\n"
        "username: keep-me\npassword: keep-me-too\n",
        0o644,
    )
    proc = _login(home, endpoint, "twine")
    assert proc.returncode == 0, proc.stderr[-2000:]
    text = read_text(pypirc)
    assert "password = " + AUTH_TOKEN in text
    assert "keep-me-too" in text
    assert_owner_only(pypirc)
