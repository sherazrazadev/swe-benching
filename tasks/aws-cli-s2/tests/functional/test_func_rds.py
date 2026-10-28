"""A generated auth token keeps going to stdout unless a file is requested."""
from __future__ import annotations

from conftest import read_text, run_aws


def _base():
    return (
        "rds", "generate-db-auth-token",
        "--hostname", "db.marker.example.com",
        "--port", "5432",
        "--username", "marker-user",
        "--region", "us-east-1",
    )


def test_token_is_printed_without_outfile(tmp_path, endpoint):
    home = tmp_path / "home"
    home.mkdir()
    proc = run_aws(home, endpoint, *_base())
    assert proc.returncode == 0, proc.stderr[-2000:]
    token = proc.stdout.strip()
    assert token.startswith("db.marker.example.com:5432/?")
    assert "DBUser=marker-user" in token
    assert "X-Amz-Signature=" in token


def test_token_is_written_to_outfile(tmp_path, endpoint):
    home = tmp_path / "home"
    home.mkdir()
    outfile = home / "token.txt"
    proc = run_aws(home, endpoint, *_base(), "--outfile", str(outfile))
    assert proc.returncode == 0, proc.stderr[-2000:]
    token = read_text(outfile).strip()
    assert token.startswith("db.marker.example.com:5432/?")
    assert "DBUser=marker-user" in token
    assert "X-Amz-Signature=" in token
    assert "X-Amz-Signature=" not in proc.stdout
