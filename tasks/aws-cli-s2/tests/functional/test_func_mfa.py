"""The MFA bootstrap file keeps its exact payload and the response shape."""
from __future__ import annotations

import json

from conftest import SEED_BYTES, PNG_BYTES, read_bytes, run_aws


def _run(home, endpoint, outfile, method):
    return run_aws(
        home, endpoint,
        "iam", "create-virtual-mfa-device",
        "--virtual-mfa-device-name", "marker-device",
        "--outfile", str(outfile),
        "--bootstrap-method", method,
    )


def test_base32_payload_is_written_verbatim(tmp_path, endpoint):
    home = tmp_path / "home"
    home.mkdir()
    outfile = home / "seed.b32"
    proc = _run(home, endpoint, outfile, "Base32StringSeed")
    assert proc.returncode == 0, proc.stderr[-2000:]
    assert read_bytes(outfile) == SEED_BYTES
    payload = json.loads(proc.stdout)
    device = payload["VirtualMFADevice"]
    assert "Base32StringSeed" not in device
    assert "QRCodePNG" not in device
    assert device["SerialNumber"].endswith("mfa/marker-device")


def test_qr_payload_is_written_verbatim(tmp_path, endpoint):
    home = tmp_path / "home"
    home.mkdir()
    outfile = home / "seed.png"
    proc = _run(home, endpoint, outfile, "QRCodePNG")
    assert proc.returncode == 0, proc.stderr[-2000:]
    assert read_bytes(outfile) == PNG_BYTES
    payload = json.loads(proc.stdout)
    assert "QRCodePNG" not in payload["VirtualMFADevice"]


def test_outfile_is_replaced_not_appended(tmp_path, endpoint):
    home = tmp_path / "home"
    home.mkdir()
    outfile = home / "seed.b32"
    outfile.write_bytes(b"x" * 200)
    proc = _run(home, endpoint, outfile, "Base32StringSeed")
    assert proc.returncode == 0, proc.stderr[-2000:]
    assert read_bytes(outfile) == SEED_BYTES


def test_existing_owner_only_outfile_is_written(tmp_path, endpoint):
    home = tmp_path / "home"
    home.mkdir()
    outfile = home / "seed-tight.b32"
    outfile.write_bytes(b"previous contents")
    outfile.chmod(0o600)
    proc = _run(home, endpoint, outfile, "Base32StringSeed")
    assert proc.returncode == 0, proc.stderr[-2000:]
    assert read_bytes(outfile) == SEED_BYTES
    assert (outfile.stat().st_mode & 0o777) == 0o600
