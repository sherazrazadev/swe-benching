"""When the operator asks to skip certificate verification, the SCM client must still get that
setting as one of its own options, ahead of the values it treats as data.

The test installs a git wrapper in front of the real client. The wrapper refuses a clone that does
not carry an effective ``http.sslVerify=false`` setting, so a fix that turns the setting into an
ordinary value (or drops it) makes an otherwise legitimate install fail.
"""
from __future__ import annotations

from support import galaxy_harness as gh


def test_role_install_keeps_the_certificate_setting(tmp_path):
    repo = gh.make_role_repo(tmp_path / "role-src")
    roles = tmp_path / "roles"
    prefix, extra, log = gh.make_git_wrapper(tmp_path)
    env = gh.base_env(path_prefix=prefix, extra=extra)

    req = [{"src": str(repo), "scm": "git", "name": "tls-role"}]
    result = gh.install_roles(tmp_path, req, roles, extra_args=["--ignore-certs"], env=env)

    assert result.returncode == 0, result.stderr + result.stdout
    assert (roles / "tls-role" / "meta" / "main.yml").is_file()
    assert log.is_file() and "clone" in log.read_text()


def test_collection_install_keeps_the_certificate_setting(tmp_path):
    repo = gh.make_collection_repo(tmp_path / "collection-src")
    out = tmp_path / "collections"
    prefix, extra, log = gh.make_git_wrapper(tmp_path)
    env = gh.base_env(path_prefix=prefix, extra=extra)

    req = {"collections": [{"name": "acme.demo", "type": "git", "source": str(repo)}]}
    result = gh.install_collections(tmp_path, req, out, extra_args=["--ignore-certs"], env=env)

    assert result.returncode == 0, result.stderr + result.stdout
    assert gh.installed_collection(out, "acme", "demo").is_dir()
    assert log.is_file() and "clone" in log.read_text()
