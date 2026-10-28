"""CodeArtifact login keeps today's file contents, dry-run and warning behaviour."""
from __future__ import annotations

import base64
import contextlib
import io
import os

from conftest import (
    make_swift_stub,
    read_text,
    run_aws,
    write_file,
)

AUTH_TOKEN = base64.b64encode(b"aws:AuthTokenMarker").decode()
HOST = "dom-1234.d.codeartifact.us-east-1.amazonaws.com"
ENDPOINT = "https://%s/pypi/repo/" % HOST


def _login(home, endpoint, tool, *extra, extra_env=None):
    return run_aws(
        home, endpoint,
        "codeartifact", "login",
        "--tool", tool,
        "--domain", "marker-domain",
        "--repository", "marker-repository",
        *extra,
        extra_env=extra_env,
    )


def _swift_env(tmp_path):
    bindir = make_swift_stub(tmp_path)
    return {"PATH": bindir + os.pathsep + os.environ["PATH"]}


def test_swift_appends_entry_and_keeps_other_machines(tmp_path, endpoint):
    home = tmp_path / "home"
    home.mkdir()
    netrc = home / ".netrc"
    other = "machine other.example.com login token password keep-me\n"
    write_file(netrc, other, 0o600)
    proc = _login(home, endpoint, "swift", extra_env=_swift_env(tmp_path))
    assert proc.returncode == 0, proc.stderr[-2000:]
    text = read_text(netrc)
    assert other.strip() in text
    assert "machine %s login token password %s" % (HOST, AUTH_TOKEN) in text
    assert "Successfully configured swift" in proc.stdout


def test_swift_replaces_existing_token_in_place(tmp_path, endpoint):
    home = tmp_path / "home"
    home.mkdir()
    netrc = home / ".netrc"
    write_file(
        netrc,
        "machine %s login token password stale-token\n" % HOST,
        0o600,
    )
    proc = _login(home, endpoint, "swift", extra_env=_swift_env(tmp_path))
    assert proc.returncode == 0, proc.stderr[-2000:]
    text = read_text(netrc)
    assert "stale-token" not in text
    assert "password %s" % AUTH_TOKEN in text


def test_twine_writes_default_configuration(tmp_path, endpoint):
    home = tmp_path / "home"
    home.mkdir()
    proc = _login(home, endpoint, "twine")
    assert proc.returncode == 0, proc.stderr[-2000:]
    text = read_text(home / ".pypirc")
    assert "[distutils]" in text
    assert "pypi" in text
    assert "[codeartifact]" in text
    assert "repository = %s" % ENDPOINT in text
    assert "username = aws" in text
    assert "password = %s" % AUTH_TOKEN in text
    assert "Successfully configured twine" in proc.stdout


def test_twine_merges_existing_configuration(tmp_path, endpoint):
    home = tmp_path / "home"
    home.mkdir()
    pypirc = home / ".pypirc"
    write_file(
        pypirc,
        "[distutils]\nindex-servers =\n    pypi\n\n"
        "[pypi]\nrepository: https://example.invalid/simple/\n"
        "username: keep-me\npassword: keep-me-too\n",
        0o600,
    )
    proc = _login(home, endpoint, "twine")
    assert proc.returncode == 0, proc.stderr[-2000:]
    text = read_text(pypirc)
    assert "keep-me-too" in text
    assert "https://example.invalid/simple/" in text
    assert "password = %s" % AUTH_TOKEN in text


def test_twine_dry_run_writes_nothing(tmp_path, endpoint):
    home = tmp_path / "home"
    home.mkdir()
    proc = _login(home, endpoint, "twine", "--dry-run")
    assert proc.returncode == 0, proc.stderr[-2000:]
    assert not (home / ".pypirc").exists()
    assert AUTH_TOKEN in proc.stdout


def test_twine_dry_run_leaves_existing_file_untouched(tmp_path, endpoint):
    home = tmp_path / "home"
    home.mkdir()
    pypirc = home / ".pypirc"
    original = "[distutils]\nindex-servers =\n    pypi\n"
    write_file(pypirc, original, 0o644)
    proc = _login(home, endpoint, "twine", "--dry-run")
    assert proc.returncode == 0, proc.stderr[-2000:]
    assert read_text(pypirc) == original
    assert (os.stat(pypirc).st_mode & 0o777) == 0o644


def test_swift_dry_run_writes_nothing(tmp_path, endpoint):
    home = tmp_path / "home"
    home.mkdir()
    proc = _login(home, endpoint, "swift", "--dry-run")
    assert proc.returncode == 0, proc.stderr[-2000:]
    assert not (home / ".netrc").exists()
    assert AUTH_TOKEN in proc.stdout


def test_login_survives_permissions_that_cannot_be_set(
    tmp_path, endpoint, monkeypatch
):
    home = tmp_path / "home"
    home.mkdir()
    pypirc = home / ".pypirc"
    write_file(pypirc, "[distutils]\nindex-servers =\n    pypi\n", 0o644)

    for key, value in {
        "HOME": str(home),
        "AWS_ACCESS_KEY_ID": "AKIATESTKEY",
        "AWS_SECRET_ACCESS_KEY": "test-secret-key",
        "AWS_DEFAULT_REGION": "us-east-1",
        "AWS_ENDPOINT_URL": endpoint,
        "AWS_EC2_METADATA_DISABLED": "true",
    }.items():
        monkeypatch.setenv(key, value)

    def deny(*args, **kwargs):
        raise OSError(1, "Operation not permitted")

    monkeypatch.setattr(os, "chmod", deny)
    monkeypatch.setattr(os, "fchmod", deny, raising=False)

    from awscli.clidriver import create_clidriver

    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        rc = create_clidriver().main([
            "codeartifact", "login", "--tool", "twine",
            "--domain", "marker-domain", "--repository", "marker-repository",
        ])
    assert rc == 0, err.getvalue()[-2000:]
    assert "password = %s" % AUTH_TOKEN in read_text(pypirc)
