"""Requirement values declared by an installed role's own metadata are data too.

The parent role is a real local repository; its metadata declares a dependency whose value names
the SCM client's option that runs a command writing a marker file.
"""
from __future__ import annotations

from support import galaxy_harness as gh


def test_declared_dependency_value_is_not_an_option(tmp_path):
    marker = tmp_path / "executed-from-dependency"
    dependency = {
        "src": gh.config_option_payload(marker),
        "scm": "git",
        "name": gh.SSH_REPO,
    }
    parent = gh.make_role_repo(tmp_path / "parent-role", dependencies=[dependency])

    req = [{"src": str(parent), "scm": "git", "name": "parent-role"}]
    gh.install_roles(tmp_path, req, tmp_path / "roles")

    assert not marker.exists(), "the SCM client ran the command named in a declared dependency"
