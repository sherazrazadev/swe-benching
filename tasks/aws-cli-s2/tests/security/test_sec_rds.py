"""A generated database authentication token saved to a file is credential data."""
from __future__ import annotations

from conftest import assert_owner_only, read_text, run_aws, write_file


def _command(outfile):
    return (
        "rds", "generate-db-auth-token",
        "--hostname", "db.marker.example.com",
        "--port", "5432",
        "--username", "marker-user",
        "--region", "us-east-1",
        "--outfile", str(outfile),
    )


def test_new_token_file_is_owner_only(tmp_path, endpoint):
    home = tmp_path / "home"
    home.mkdir()
    outfile = home / "db-token.txt"
    proc = run_aws(home, endpoint, *_command(outfile))
    assert proc.returncode == 0, proc.stderr[-2000:]
    text = read_text(outfile)
    assert "db.marker.example.com:5432/" in text
    assert "X-Amz-Signature=" in text
    assert_owner_only(outfile)


def test_existing_token_file_is_tightened(tmp_path, endpoint):
    home = tmp_path / "home"
    home.mkdir()
    outfile = home / "db-token-existing.txt"
    write_file(outfile, "previous token\n", 0o644)
    proc = run_aws(home, endpoint, *_command(outfile))
    assert proc.returncode == 0, proc.stderr[-2000:]
    text = read_text(outfile)
    assert "marker-user" in text
    assert_owner_only(outfile)
