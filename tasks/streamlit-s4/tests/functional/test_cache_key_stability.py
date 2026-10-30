"""The identity a cache gives an input must be stable across processes.

A disk-persisted cache stores its entries under the value key, so a second
process that computes a different key silently recomputes and writes a second
entry. This test runs the same large input through two processes sharing one
home directory and requires the second to reuse the first entry.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

HTESTS = Path(__file__).resolve().parents[1]


def _run_helper(marker: Path, side: int, home: Path) -> subprocess.CompletedProcess:
    env = dict(os.environ)
    env["HOME"] = str(home)
    env["PYTHONPATH"] = str(HTESTS)
    env.pop("PROBE_MARKER", None)
    return subprocess.run(
        [sys.executable, "-m", "support.xproc_helper", str(marker), str(side)],
        cwd=str(HTESTS),
        env=env,
        capture_output=True,
        text=True,
        timeout=300,
    )


def test_disk_cache_identity_is_stable_across_processes(tmp_path):
    home = tmp_path / "home"
    home.mkdir()
    marker = tmp_path / "marker.txt"
    marker.write_text("", encoding="utf-8")

    first = _run_helper(marker, 800, home)
    assert first.returncode == 0, first.stderr
    assert marker.read_text(encoding="utf-8").count("ran") == 1

    second = _run_helper(marker, 800, home)
    assert second.returncode == 0, second.stderr
    assert first.stdout.strip() == second.stdout.strip()
    assert marker.read_text(encoding="utf-8").count("ran") == 1, (
        "a later process recomputed an input the earlier process had cached"
    )
