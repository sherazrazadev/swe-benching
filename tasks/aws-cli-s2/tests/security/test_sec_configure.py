"""Credentials written by the configuration commands must stay owner-only."""
from __future__ import annotations

from conftest import assert_owner_only, read_text, run_aws, write_file


def _credentials(home):
    path = home / ".aws" / "credentials"
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def test_configure_set_updates_existing_credentials_owner_only(tmp_path, endpoint):
    home = tmp_path / "home"
    home.mkdir()
    path = _credentials(home)
    write_file(
        path,
        "[default]\naws_access_key_id = OLDKEY\n"
        "aws_secret_access_key = OLD-SECRET\n",
        0o644,
    )
    proc = run_aws(
        home, endpoint,
        "configure", "set", "aws_secret_access_key", "NEW-SECRET-MARKER",
    )
    assert proc.returncode == 0, proc.stderr[-2000:]
    text = read_text(path)
    assert "NEW-SECRET-MARKER" in text
    assert "OLDKEY" in text
    assert_owner_only(path)


def test_configure_set_appends_section_to_existing_credentials_owner_only(
    tmp_path, endpoint
):
    home = tmp_path / "home"
    home.mkdir()
    path = _credentials(home)
    write_file(
        path,
        "[other]\naws_access_key_id = OTHERKEY\n"
        "aws_secret_access_key = OTHER-SECRET\n",
        0o644,
    )
    proc = run_aws(
        home, endpoint,
        "configure", "set", "default.aws_session_token", "SESSION-TOKEN-MARKER",
    )
    assert proc.returncode == 0, proc.stderr[-2000:]
    text = read_text(path)
    assert "SESSION-TOKEN-MARKER" in text
    assert "OTHERKEY" in text
    assert_owner_only(path)
