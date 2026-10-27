"""Shared helpers for the hidden suites.

Every scenario runs in a fresh interpreter (scenario.py) against a throwaway
fake ComfyUI host under tmp_path, so product globals and caches never leak
between tests.  The product tree is PRODUCT_ROOT (default /workspace).
"""
import contextlib
import functools
import http.server
import json
import os
import shutil
import subprocess
import sys
import threading

REPO = os.environ.get("PRODUCT_ROOT", "/workspace")
HERE = os.path.dirname(os.path.abspath(__file__))
SCENARIO = os.path.join(HERE, "scenario.py")


def clean_env():
    env = {
        "PATH": "/usr/local/bin:/usr/bin:/bin",
        "HOME": os.environ.get("HOME", "/tmp"),
        "LANG": "C.UTF-8",
        "LC_ALL": "C.UTF-8",
        "TZ": "UTC",
    }
    return env


def run_scenario(root, mode, system_api=True, params=None, timeout=240):
    root = str(root)
    os.makedirs(root, exist_ok=True)
    params_path = os.path.join(root, "params.json")
    with open(params_path, "w", encoding="utf-8") as f:
        json.dump(params or {}, f)

    cmd = [
        sys.executable, "-I", SCENARIO,
        "--repo", REPO, "--root", root, "--mode", mode,
        "--system-api", "1" if system_api else "0",
        "--params", params_path,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, env=clean_env())
    lines = [x for x in proc.stdout.splitlines() if x.strip()]
    if not lines:
        raise AssertionError(
            "scenario %s produced no output\nstdout:\n%s\nstderr:\n%s"
            % (mode, proc.stdout[-4000:], proc.stderr[-4000:])
        )
    try:
        result = json.loads(lines[-1])
    except json.JSONDecodeError:
        raise AssertionError(
            "scenario %s produced non-JSON output:\n%s\nstderr:\n%s"
            % (mode, proc.stdout[-4000:], proc.stderr[-4000:])
        )
    if not result.get("ok"):
        raise AssertionError(
            "scenario %s failed: %s\n%s\nstderr:\n%s"
            % (mode, result.get("exception"), result.get("traceback", ""), proc.stderr[-4000:])
        )
    result["_stderr"] = proc.stderr
    return result


def legacy_manager_dir(root):
    return os.path.join(str(root), "user", "default", "ComfyUI-Manager")


def write_planted(root, files):
    """Place files exactly where the host's user-file endpoints can write."""
    base = legacy_manager_dir(root)
    for rel, text in (files or {}).items():
        path = os.path.join(base, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)


def make_install_script(root, marker_name="installed.marker"):
    """A harmless management script and its cwd; returns (cwd, argv, marker)."""
    scratch = os.path.join(str(root), "scratch")
    os.makedirs(scratch, exist_ok=True)
    marker = os.path.join(scratch, marker_name)
    script = os.path.join(scratch, "run.sh")
    with open(script, "w", encoding="utf-8") as f:
        f.write('#!/bin/sh\ntouch "$1"\n')
    os.chmod(script, 0o755)
    return scratch, ["/bin/sh", script, marker], marker


def install_script_line(cwd, argv):
    return "[" + ", ".join(repr(x) for x in [cwd] + list(argv)) + "]\n"


def _init_provider(work, name):
    subprocess.run(["git", "init", "-q", "-b", "main", work], check=True)
    with open(os.path.join(work, "install.py"), "w", encoding="utf-8") as f:
        f.write(
            "import os\n"
            "open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'installed.marker'), 'w').write('ok')\n"
        )
    with open(os.path.join(work, "__init__.py"), "w", encoding="utf-8") as f:
        f.write("NODE_CLASS_MAPPINGS = {}\n")
    subprocess.run(["git", "-C", work, "add", "-A"], check=True)
    subprocess.run(
        ["git", "-C", work, "-c", "user.name=task", "-c", "user.email=task@localhost",
         "commit", "-qm", "init"],
        check=True,
    )
    bare = os.path.join(os.path.dirname(work), name + ".git")
    subprocess.run(["git", "clone", "-q", "--bare", work, bare], check=True)
    subprocess.run(["git", "-C", bare, "update-server-info"], check=True)
    return bare


class RepoServer:
    """A loopback dumb-HTTP server exposing a bare git repository and payload files."""

    def __init__(self, base):
        self.base = str(base)
        os.makedirs(self.base, exist_ok=True)
        work = os.path.join(self.base, "_work")
        shutil.rmtree(work, ignore_errors=True)
        self.bare = _init_provider(work, "provider")
        with open(os.path.join(self.base, "payload.bin"), "w", encoding="utf-8") as f:
            f.write("PAYLOAD-MARKER")
        self._httpd = None
        self._thread = None
        self.url = None

    def __enter__(self):
        handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=self.base)
        handler.log_message = lambda *a, **k: None
        self._httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        self._thread = threading.Thread(target=self._httpd.serve_forever, daemon=True)
        self._thread.start()
        self.url = "http://127.0.0.1:%d" % self._httpd.server_address[1]
        return self

    def __exit__(self, *exc):
        if self._httpd is not None:
            self._httpd.shutdown()
            self._httpd.server_close()
        return False

    @property
    def repo_url(self):
        return self.url + "/provider.git"

    @property
    def payload_url(self):
        return self.url + "/payload.bin"


def install_marker(root):
    return os.path.join(str(root), "custom_nodes", "provider", "installed.marker")
