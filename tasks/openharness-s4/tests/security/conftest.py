"""Fixture isolation for the hidden security suite.

Each test gets its own config, data, home and ohmo workspace directories, so a change made
by one test can never be read by another.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
for candidate in (HERE.parent / "support", Path("/workspace/.htests/support")):
    if candidate.is_dir() and str(candidate) not in sys.path:
        sys.path.insert(0, str(candidate))


@pytest.fixture(autouse=True)
def isolated_environment(tmp_path, monkeypatch):
    home = tmp_path / "home"
    home.mkdir()
    monkeypatch.setenv("HOME", str(home))
    monkeypatch.setenv("OPENHARNESS_CONFIG_DIR", str(tmp_path / "config"))
    monkeypatch.setenv("OPENHARNESS_DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("OHMO_WORKSPACE", str(tmp_path / ".ohmo-home"))
    monkeypatch.delenv("CLAUDE_CODE_COORDINATOR_MODE", raising=False)
    return tmp_path


@pytest.fixture
def repo(tmp_path) -> Path:
    path = tmp_path / "repo"
    path.mkdir()
    return path


@pytest.fixture
def workspace(tmp_path) -> Path:
    from ohmo.workspace import initialize_workspace

    return Path(initialize_workspace(tmp_path / ".ohmo-home"))
