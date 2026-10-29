"""A role requirement's values must reach the SCM client as data, not as options.

Every test drives the real ``ansible-galaxy role install`` command against a local repository.
The malicious value names the SCM client's option whose command writes a marker file; on the
vulnerable tree the marker appears even though the install then fails.
"""
from __future__ import annotations

from support import galaxy_harness as gh


def test_source_value_is_not_an_option(tmp_path):
    gh.make_role_repo(tmp_path / "role-src")
    marker = tmp_path / "executed-from-source"

    req = [{"src": gh.config_option_payload(marker), "scm": "git", "name": gh.SSH_REPO}]
    gh.install_roles(tmp_path, req, tmp_path / "roles")

    assert not marker.exists(), "the SCM client ran the command named in the source value"


def test_destination_value_is_not_an_option(tmp_path):
    repo = gh.make_role_repo(tmp_path / "role-src")
    marker = tmp_path / "executed-from-destination"

    req = [{"src": str(repo), "scm": "git", "name": gh.option_payload(marker)}]
    gh.install_roles(tmp_path, req, tmp_path / "roles")

    assert not marker.exists(), "the SCM client ran the command named in the destination value"


def test_string_requirement_destination_is_not_an_option(tmp_path):
    repo = gh.make_role_repo(tmp_path / "role-src", tag="v2")
    marker = tmp_path / "executed-from-string"

    requirement = "git+%s,v2,%s" % (repo, gh.option_payload(marker))
    gh.install_roles(tmp_path, [requirement], tmp_path / "roles")

    assert not marker.exists(), "the SCM client ran the command named in the string requirement"
