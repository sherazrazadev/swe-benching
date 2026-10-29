"""Shared fixtures for the hidden suites.

The helper module is created outside the repository and put on ``sys.path`` so a checkpoint can
name it.  Every helper only writes a marker file when it is actually called: a checkpoint that is
correctly refused must never import or call anything in it.
"""
import pathlib
import sys
import tempfile

import pytest

_HELPER_DIR = pathlib.Path(tempfile.mkdtemp(prefix="pl-sec-helpers-"))
(_HELPER_DIR / "revil.py").write_text(
    "import os\n"
    "import pathlib\n"
    "\n"
    "\n"
    "def _mark(tag):\n"
    "    pathlib.Path(os.environ['SEC_MARKER']).write_text(tag)\n"
    "\n"
    "\n"
    "def evil_instantiator(cls, kwargs):\n"
    "    _mark('instantiator')\n"
    "    return cls()\n"
    "\n"
    "\n"
    "def convert(hparams):\n"
    "    _mark('converter')\n"
    "    return hparams\n"
    "\n"
    "\n"
    "def migrate(hparams):\n"
    "    _mark('migration')\n"
    "    return hparams\n"
)
sys.path.insert(0, str(_HELPER_DIR))


@pytest.fixture()
def marker(tmp_path, monkeypatch):
    path = tmp_path / "called.txt"
    monkeypatch.setenv("SEC_MARKER", str(path))
    return path
