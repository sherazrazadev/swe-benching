"""Shared helpers for the hidden suites: run one real pyLoad scenario per process."""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCENARIO = HERE / "harness" / "scenario.py"

API_PATH = "/api/status_server"


def run_scenario(
    actions,
    trusted_proxies=0,
    enable_clicknload=False,
    timeout=180,
):
    """Build a real pyLoad core in a child process and drive the given actions.

    ``actions`` is a list of request descriptions; each returns the status, the
    remaining-requests header and a short body.  Log lines written by the product
    while the actions run are returned alongside them.
    """
    userdir = tempfile.mkdtemp(prefix="pyload-scenario-")
    spec = {
        "userdir": userdir,
        "trusted_proxies": trusted_proxies,
        "enable_clicknload": enable_clicknload,
        "actions": actions,
    }
    env = {
        "PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"),
        "HOME": os.environ.get("HOME", "/home/agent"),
        "LANG": "C.UTF-8",
        "LC_ALL": "C.UTF-8",
        "TZ": "UTC",
        "TMPDIR": tempfile.gettempdir(),
    }
    proc = subprocess.run(
        [sys.executable, "-I", str(SCENARIO), json.dumps(spec)],
        capture_output=True,
        text=True,
        cwd=userdir,
        env=env,
        timeout=timeout,
    )
    result = None
    for line in (proc.stdout or "").splitlines():
        if line.startswith("__RESULT__"):
            result = json.loads(line[len("__RESULT__"):])
    if result is None:
        raise AssertionError(
            "scenario produced no result (exit %s)\nstdout tail:\n%s\nstderr tail:\n%s"
            % (proc.returncode, (proc.stdout or "")[-2000:], (proc.stderr or "")[-2000:])
        )
    result["_returncode"] = proc.returncode
    result["_stderr"] = (proc.stderr or "")[-2000:]
    return result


def statuses(result):
    return [r["status"] for r in result["results"]]


def remaining(result):
    values = []
    for item in result["results"]:
        value = item.get("remaining")
        values.append(int(value) if value is not None else None)
    return values


def client_logs(result):
    return [line for line in result.get("logs", []) if "CLIENT:" in line]
