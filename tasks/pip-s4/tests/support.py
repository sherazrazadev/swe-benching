"""Test support: build harmless local artifacts and run the project's CLI offline.

Everything here uses the standard library only. The tests never call product code to
compute an expected value or to clean up.
"""
from __future__ import annotations

import gzip
import io
import os
import subprocess
import sys
import tarfile

PROJECT_SRC = os.environ.get("PIP_SRC", "/workspace/src")

BACKEND = '''import os, zipfile

def get_requires_for_build_wheel(config_settings=None):
    return []

def prepare_metadata_for_build_wheel(metadata_directory, config_settings=None):
    d = os.path.join(metadata_directory, "demo-1.0.dist-info")
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, "METADATA"), "w") as f:
        f.write("Metadata-Version: 2.1\\nName: demo\\nVersion: 1.0\\n")
    return "demo-1.0.dist-info"

def build_wheel(wheel_directory, config_settings=None, metadata_directory=None):
    name = "demo-1.0-py3-none-any.whl"
    with zipfile.ZipFile(os.path.join(wheel_directory, name), "w") as z:
        z.writestr("demo/__init__.py", "X = 1\\n")
        z.writestr("demo-1.0.dist-info/METADATA",
                   "Metadata-Version: 2.1\\nName: demo\\nVersion: 1.0\\n")
        z.writestr("demo-1.0.dist-info/WHEEL",
                   "Wheel-Version: 1.0\\nGenerator: demo\\nRoot-Is-Purelib: true\\nTag: py3-none-any\\n")
        z.writestr("demo-1.0.dist-info/RECORD", "")
    return name

def build_sdist(sdist_directory, config_settings=None):
    return None
'''

ROOT = "demo-1.0"
TREE = {
    "pyproject.toml": b'[build-system]\nrequires = []\nbuild-backend = "demo_backend"\nbackend-path = ["."]\n',
    "demo_backend.py": BACKEND.encode(),
    "PKG-INFO": b"Metadata-Version: 2.1\nName: demo\nVersion: 1.0\n",
    "demo/__init__.py": b"X = 1\n",
}


def sdist_bytes() -> bytes:
    """A minimal, buildable source distribution (stdlib build backend only)."""
    buf = io.BytesIO()
    # Fixed gzip mtime keeps the bytes stable across calls.
    with gzip.GzipFile(fileobj=buf, mode="wb", mtime=0) as gz:
        with tarfile.open(fileobj=gz, mode="w") as tf:
            for rel, data in TREE.items():
                info = tarfile.TarInfo(f"{ROOT}/{rel}")
                info.size = len(data)
                info.mtime = 1700000000
                info.mode = 0o644
                tf.addfile(info, io.BytesIO(data))
    return buf.getvalue()


def write_tree(directory) -> None:
    """Write the same source tree to a directory (for VCS requirements)."""
    for rel, data in TREE.items():
        p = directory / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)


def make_git_repo(directory) -> None:
    write_tree(directory)
    subprocess.run(["git", "init", "-q", "-b", "main", str(directory)], check=True)
    subprocess.run(
        ["git", "-C", str(directory), "-c", "user.name=t", "-c", "user.email=t@example",
         "add", "-A"], check=True)
    subprocess.run(
        ["git", "-C", str(directory), "-c", "user.name=t", "-c", "user.email=t@example",
         "commit", "-qm", "init"], check=True)


def run_pip(args, cwd, timeout=300):
    """Run the project's CLI (`python -m pip ...`) offline, from the restored source."""
    home = cwd / "pip-home"
    tmp = cwd / "pip-tmp"
    home.mkdir(parents=True, exist_ok=True)
    tmp.mkdir(parents=True, exist_ok=True)
    env = {
        "PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"),
        "HOME": str(home),
        "TMPDIR": str(tmp),
        "LANG": "C.UTF-8",
        "LC_ALL": "C.UTF-8",
        "TZ": "UTC",
        "PYTHONPATH": PROJECT_SRC,
        "PYTHONNOUSERSITE": "1",
        "PIP_NO_CACHE_DIR": "1",
        "PIP_DISABLE_PIP_VERSION_CHECK": "1",
        "PIP_NO_INPUT": "1",
        "PIP_CONFIG_FILE": os.devnull,
    }
    return subprocess.run(
        [sys.executable, "-m", "pip", *args],
        cwd=str(cwd), env=env, capture_output=True, text=True, timeout=timeout,
    )


class _Stream:
    def __init__(self, data: bytes) -> None:
        self._io = io.BytesIO(data)

    def stream(self, size, decode_content=None):
        while True:
            chunk = self._io.read(size)
            if not chunk:
                return
            yield chunk

    def read(self, size, decode_content=None):
        return self._io.read(size)

    def release_conn(self):
        pass


class MockResponse:
    """The minimal response shape the download path consumes."""

    def __init__(self, body: bytes, url: str) -> None:
        self.raw = _Stream(body)
        self.url = url
        self.headers = {
            "content-length": str(len(body)),
            "content-type": "application/octet-stream",
        }
        self.status_code = 200
        self.reason = "OK"
        self.history = []
        self.from_cache = False
        self.request = None
        self.connection = None

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False
