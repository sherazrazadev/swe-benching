"""Virtual MFA bootstrap output must never be readable by other local users."""
from __future__ import annotations

from conftest import (
    SEED_BYTES,
    PNG_BYTES,
    assert_owner_only,
    read_bytes,
    run_aws,
    write_file,
)


def _command(outfile, method):
    return (
        "iam", "create-virtual-mfa-device",
        "--virtual-mfa-device-name", "marker-device",
        "--outfile", str(outfile),
        "--bootstrap-method", method,
    )


def test_new_outfile_is_owner_only(tmp_path, endpoint):
    home = tmp_path / "home"
    home.mkdir()
    outfile = home / "seed.b32"
    proc = run_aws(home, endpoint, *_command(outfile, "Base32StringSeed"))
    assert proc.returncode == 0, proc.stderr[-2000:]
    assert read_bytes(outfile) == SEED_BYTES
    assert_owner_only(outfile)


def test_existing_outfile_is_tightened(tmp_path, endpoint):
    home = tmp_path / "home"
    home.mkdir()
    outfile = home / "seed-existing.b32"
    write_file(outfile, b"previous contents", 0o644)
    proc = run_aws(home, endpoint, *_command(outfile, "Base32StringSeed"))
    assert proc.returncode == 0, proc.stderr[-2000:]
    assert read_bytes(outfile) == SEED_BYTES
    assert_owner_only(outfile)


def test_existing_outfile_is_tightened_for_qr_payload(tmp_path, endpoint):
    home = tmp_path / "home"
    home.mkdir()
    outfile = home / "qr-existing.png"
    write_file(outfile, b"previous contents", 0o644)
    proc = run_aws(home, endpoint, *_command(outfile, "QRCodePNG"))
    assert proc.returncode == 0, proc.stderr[-2000:]
    assert read_bytes(outfile) == PNG_BYTES
    assert_owner_only(outfile)

