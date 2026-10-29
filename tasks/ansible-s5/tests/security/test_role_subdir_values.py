"""Requirement values handled by the subdirectory install path are data as well.

The source is a real local repository holding a role in a subdirectory; either the source value or
the destination value names the SCM client's option whose command writes a marker file.
"""
from __future__ import annotations

from support import galaxy_harness as gh


def test_subdirectory_destination_is_not_an_option(tmp_path):
    repo = gh.make_role_repo(tmp_path / "monorepo", subdir="roles/inner")
    marker = tmp_path / "executed-from-subdir-destination"

    req = [{
        "src": str(repo),
        "scm": "git",
        "name": gh.option_payload(marker),
        "subdir": "roles/inner",
    }]
    gh.install_roles(tmp_path, req, tmp_path / "roles")

    assert not marker.exists(), "the SCM client ran the command named in the destination value"


def test_subdirectory_source_is_not_an_option(tmp_path):
    gh.make_role_repo(tmp_path / "monorepo", subdir="roles/inner")
    marker = tmp_path / "executed-from-subdir-source"

    req = [{
        "src": gh.config_option_payload(marker),
        "scm": "git",
        "name": gh.SSH_REPO,
        "subdir": "roles/inner",
    }]
    gh.install_roles(tmp_path, req, tmp_path / "roles")

    assert not marker.exists(), "the SCM client ran the command named in the source value"
