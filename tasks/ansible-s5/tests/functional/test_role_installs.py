"""Legitimate role installs keep working exactly as before."""
from __future__ import annotations

from support import galaxy_harness as gh


def test_install_role_from_requirements_file(tmp_path):
    repo = gh.make_role_repo(tmp_path / "role-src")
    roles = tmp_path / "roles"

    req = [{"src": str(repo), "scm": "git", "name": "test-role"}]
    result = gh.install_roles(tmp_path, req, roles)

    assert result.returncode == 0, result.stderr
    assert (roles / "test-role" / "meta" / "main.yml").is_file()
    assert (roles / "test-role" / "tasks" / "main.yml").is_file()


def test_install_role_at_pinned_version(tmp_path):
    repo = gh.make_role_repo(tmp_path / "role-src", tag="v2")
    roles = tmp_path / "roles"

    req = [{"src": str(repo), "scm": "git", "name": "pinned-role", "version": "v2"}]
    result = gh.install_roles(tmp_path, req, roles)

    assert result.returncode == 0, result.stderr
    assert (roles / "pinned-role" / "meta" / "main.yml").is_file()


def test_install_role_from_direct_argument(tmp_path):
    repo = gh.make_role_repo(tmp_path / "direct-role")
    roles = tmp_path / "roles"

    result = gh.run_cli(
        ["role", "install", "git+file://%s" % repo, "-p", str(roles)],
        cwd=tmp_path,
        env=gh.base_env(),
    )

    assert result.returncode == 0, result.stderr
    assert (roles / repo.name / "meta" / "main.yml").is_file()


def test_install_role_with_dashes_and_dots_in_its_name(tmp_path):
    repo = gh.make_role_repo(tmp_path / "role-src")
    roles = tmp_path / "roles"

    req = [{"src": str(repo), "scm": "git", "name": "my-role.v1"}]
    result = gh.install_roles(tmp_path, req, roles)

    assert result.returncode == 0, result.stderr
    assert (roles / "my-role.v1" / "meta" / "main.yml").is_file()


def test_install_role_from_subdirectory(tmp_path):
    repo = gh.make_role_repo(tmp_path / "monorepo", subdir="roles/inner")
    roles = tmp_path / "roles"

    req = [{"src": str(repo), "scm": "git", "name": "sub-role", "subdir": "roles/inner"}]
    result = gh.install_roles(tmp_path, req, roles)

    assert result.returncode == 0, result.stderr
    assert (roles / "sub-role" / "meta" / "main.yml").is_file()
    assert (roles / "sub-role" / "tasks" / "main.yml").is_file()
