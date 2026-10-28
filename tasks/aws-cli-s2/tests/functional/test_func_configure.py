"""The configuration commands keep writing the same values to the same files."""
from __future__ import annotations

from conftest import read_text, run_aws, write_file


def _credentials(home):
    path = home / ".aws" / "credentials"
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def test_configure_set_updates_value_and_preserves_file(tmp_path, endpoint):
    home = tmp_path / "home"
    home.mkdir()
    path = _credentials(home)
    write_file(
        path,
        "[default]\naws_access_key_id = OLDKEY\n"
        "aws_secret_access_key = OLD-SECRET\n\n"
        "[dev]\naws_access_key_id = DEVKEY\n",
        0o600,
    )
    proc = run_aws(
        home, endpoint,
        "configure", "set", "aws_secret_access_key", "NEW-SECRET-MARKER",
    )
    assert proc.returncode == 0, proc.stderr[-2000:]
    text = read_text(path)
    assert "aws_secret_access_key = NEW-SECRET-MARKER" in text
    assert "aws_access_key_id = OLDKEY" in text
    assert "[dev]" in text
    assert "DEVKEY" in text


def test_configure_set_creates_missing_credentials_file(tmp_path, endpoint):
    home = tmp_path / "home"
    home.mkdir()
    proc = run_aws(
        home, endpoint,
        "configure", "set", "aws_secret_access_key", "FRESH-SECRET",
    )
    assert proc.returncode == 0, proc.stderr[-2000:]
    path = _credentials(home)
    assert "FRESH-SECRET" in read_text(path)


def test_configure_set_non_secret_value_goes_to_config(tmp_path, endpoint):
    home = tmp_path / "home"
    home.mkdir()
    proc = run_aws(home, endpoint, "configure", "set", "region", "eu-west-1")
    assert proc.returncode == 0, proc.stderr[-2000:]
    config = home / ".aws" / "config"
    assert "region = eu-west-1" in read_text(config)
    assert not (home / ".aws" / "credentials").exists()
