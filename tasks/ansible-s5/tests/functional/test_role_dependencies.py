"""A role's declared dependency installs normally."""
from __future__ import annotations

from support import galaxy_harness as gh


def test_declared_dependency_installs(tmp_path):
    dep_repo = gh.make_role_repo(tmp_path / "dependency-src")
    dependency = {"src": str(dep_repo), "scm": "git", "name": "dep-role"}
    parent = gh.make_role_repo(tmp_path / "parent-src", dependencies=[dependency])
    roles = tmp_path / "roles"

    req = [{"src": str(parent), "scm": "git", "name": "parent-role"}]
    result = gh.install_roles(tmp_path, req, roles)

    assert result.returncode == 0, result.stderr
    assert (roles / "parent-role" / "meta" / "main.yml").is_file()
    assert (roles / "dep-role" / "meta" / "main.yml").is_file()
