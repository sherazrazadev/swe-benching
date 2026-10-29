"""Shared helpers for the ansible-galaxy task's hidden tests.

Everything here is test scaffolding: it builds local repositories, writes requirement files and
runs the real ``ansible-galaxy`` command. It never imports or calls product code to compute an
expected value, so a hardened product cannot make a test crash.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path

DEFAULT_TIMEOUT = 240


def galaxy_bin():
    """Absolute path of the ansible-galaxy entry point to drive."""
    explicit = os.environ.get("GALAXY_BIN")
    if explicit:
        return explicit
    found = shutil.which("ansible-galaxy")
    if not found:
        raise RuntimeError("ansible-galaxy is not on PATH")
    return found


def git_bin():
    found = shutil.which("git")
    if not found:
        raise RuntimeError("git is not on PATH")
    return found


def base_env(path_prefix=None, extra=None):
    """A clean environment for the CLI: no inherited Ansible/Git configuration leaks in."""
    env = {
        "PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"),
        "HOME": os.environ.get("HOME", "/home/agent"),
        "LANG": "C.UTF-8",
        "LC_ALL": "C.UTF-8",
        "TZ": "UTC",
        "ANSIBLE_NOCOLOR": "1",
        "ANSIBLE_FORCE_COLOR": "0",
        "ANSIBLE_DEVEL_WARNING": "false",
        "GIT_CONFIG_NOSYSTEM": "1",
        "GIT_TERMINAL_PROMPT": "0",
    }
    if path_prefix:
        env["PATH"] = path_prefix + os.pathsep + env["PATH"]
    if extra:
        env.update(extra)
    return env


def run_cli(args, cwd, env, timeout=DEFAULT_TIMEOUT):
    """Run ``ansible-galaxy`` and return the CompletedProcess."""
    return subprocess.run(
        [galaxy_bin()] + list(args),
        cwd=str(cwd),
        env=env,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=timeout,
    )


# --------------------------------------------------------------------------- repositories

def _git(repo, *args, env=None):
    run_env = base_env(extra=env)
    return subprocess.run(
        [git_bin(), "-C", str(repo)] + list(args),
        env=run_env,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=True,
    )


def _commit(repo):
    _git(repo, "add", "-A")
    _git(repo, "-c", "user.name=task", "-c", "user.email=task@localhost", "commit", "-qm", "initial")


def make_role_repo(repo, dependencies=None, subdir=None, tag=None):
    """Create a local git repository holding one role (optionally under *subdir*)."""
    repo = Path(repo)
    root = repo / subdir if subdir else repo
    (root / "meta").mkdir(parents=True, exist_ok=True)
    (root / "tasks").mkdir(parents=True, exist_ok=True)
    meta = {
        "galaxy_info": {
            "author": "task",
            "description": "test role",
            "license": "MIT",
            "min_ansible_version": "2.9",
        },
        "dependencies": list(dependencies or []),
    }
    (root / "meta" / "main.yml").write_text(json.dumps(meta) + "\n")
    (root / "tasks" / "main.yml").write_text("- debug: msg=test role\n")
    (repo / "README.md").write_text("test role repository\n")
    _git_init(repo)
    if tag:
        _git(repo, "tag", tag)
    return repo


def make_collection_repo(repo, namespace="acme", name="demo", version="1.0.0", tag=None):
    repo = Path(repo)
    repo.mkdir(parents=True, exist_ok=True)
    (repo / "galaxy.yml").write_text(
        "namespace: %s\nname: %s\nversion: %s\nreadme: README.md\nauthors:\n  - task\n"
        % (namespace, name, version)
    )
    (repo / "README.md").write_text("test collection repository\n")
    (repo / "plugins" / "modules").mkdir(parents=True, exist_ok=True)
    _git_init(repo)
    if tag:
        _git(repo, "tag", tag)
    return repo


def _git_init(repo):
    subprocess.run(
        [git_bin(), "init", "-q", str(repo)],
        env=base_env(),
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=True,
    )
    _commit(repo)


def write_requirements(path, data):
    """Write a requirements file. JSON is valid YAML, so no YAML library is needed."""
    Path(path).write_text(json.dumps(data, indent=2) + "\n")


# --------------------------------------------------------------------------- payloads

def option_payload(marker):
    """One requirement value that the SCM client accepts as an option which runs a command."""
    return '--upload-pack=sh -c "id > %s"' % marker


def config_option_payload(marker):
    """One requirement value that the SCM client accepts as a configuration setting."""
    return '-ccore.sshCommand=sh -c "id > %s"' % marker


SSH_REPO = "git@github.com:acme/example-role.git"


# --------------------------------------------------------------------------- installs

def install_roles(work, requirements, roles_path, extra_args=(), env=None, timeout=DEFAULT_TIMEOUT):
    req = Path(work) / "requirements.yml"
    write_requirements(req, requirements)
    args = ["role", "install", "-r", str(req), "-p", str(roles_path)] + list(extra_args)
    return run_cli(args, cwd=work, env=env or base_env(), timeout=timeout)


def install_collections(work, requirements, collections_path, extra_args=(), env=None,
                        timeout=DEFAULT_TIMEOUT):
    req = Path(work) / "requirements.yml"
    write_requirements(req, requirements)
    args = ["collection", "install", "-r", str(req), "-p", str(collections_path)] + list(extra_args)
    return run_cli(args, cwd=work, env=env or base_env(), timeout=timeout)


def installed_role(roles_path, name):
    return Path(roles_path) / name


def installed_collection(collections_path, namespace, name):
    return Path(collections_path) / "ansible_collections" / namespace / name


# --------------------------------------------------------------------------- git wrapper

GIT_WRAPPER = r'''#!/usr/bin/env python3
"""Record the SCM client's argv and, when asked, require the TLS-skip setting to be effective.

The wrapper is test scaffolding: it mirrors the client's own rule that options end at ``--``.
A clone that was told to skip certificate verification but carries the setting only after the
end-of-options marker (or not at all) is refused, so a fix that turns a real option into an
ordinary value makes the install fail.
"""
import json
import os
import sys

args = sys.argv[1:]
log = os.environ.get("GIT_ARGV_LOG")
if log:
    with open(log, "a") as fh:
        fh.write(json.dumps(args) + "\n")

if os.environ.get("REQUIRE_SSLVERIFY") == "1" and args[:1] == ["clone"]:
    takes_value = {
        "--depth", "--branch", "--origin", "--template", "--separate-git-dir",
        "--reference", "--reference-if-able", "--upload-pack", "--filter",
        "--shallow-since", "--shallow-exclude", "--revision", "--server-option",
        "--jobs", "-j", "-o", "-u", "-b", "--bundle-uri", "--ref-format",
    }
    effective = False
    i = 1
    while i < len(args):
        a = args[i]
        if a == "--":
            break
        if a in ("-c", "--config"):
            if i + 1 < len(args):
                key, _, val = args[i + 1].partition("=")
                if key == "http.sslVerify" and val.lower() == "false":
                    effective = True
            i += 2
            continue
        if a.startswith("-c") and len(a) > 2:
            key, _, val = a[2:].partition("=")
            if key == "http.sslVerify" and val.lower() == "false":
                effective = True
        elif a.startswith("--config="):
            key, _, val = a[len("--config="):].partition("=")
            if key == "http.sslVerify" and val.lower() == "false":
                effective = True
        elif a in takes_value:
            i += 2
            continue
        i += 1
    if not effective:
        sys.stderr.write(
            "test git wrapper: certificate verification was not skipped as requested\n"
        )
        sys.exit(97)

real = os.environ.get("REAL_GIT") or "/usr/bin/git"
os.execv(real, [real] + args)
'''


def make_git_wrapper(tmp_path, require_sslverify=True):
    """Install a ``git`` wrapper ahead of the real one; return (path_prefix, env_extra)."""
    bindir = Path(tmp_path) / "git-wrapper-bin"
    bindir.mkdir()
    target = bindir / "git"
    target.write_text(GIT_WRAPPER)
    target.chmod(0o755)
    log = Path(tmp_path) / "git-argv.jsonl"
    env_extra = {
        "REAL_GIT": git_bin(),
        "GIT_ARGV_LOG": str(log),
    }
    if require_sslverify:
        env_extra["REQUIRE_SSLVERIFY"] = "1"
    return str(bindir), env_extra, log
