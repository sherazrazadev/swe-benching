"""Legitimate collection installs from a git source keep working at every revision."""
from __future__ import annotations

from support import galaxy_harness as gh


def test_install_collection_at_default_revision(tmp_path):
    repo = gh.make_collection_repo(tmp_path / "collection-src")
    out = tmp_path / "collections"

    req = {"collections": [{"name": "acme.demo", "type": "git", "source": str(repo)}]}
    result = gh.install_collections(tmp_path, req, out)

    assert result.returncode == 0, result.stderr
    assert gh.installed_collection(out, "acme", "demo").is_dir()


def test_install_collection_at_pinned_tag(tmp_path):
    repo = gh.make_collection_repo(tmp_path / "collection-src", tag="1.0.0")
    out = tmp_path / "collections"

    req = {"collections": [{
        "name": "acme.demo",
        "type": "git",
        "source": str(repo),
        "version": "1.0.0",
    }]}
    result = gh.install_collections(tmp_path, req, out)

    assert result.returncode == 0, result.stderr
    assert gh.installed_collection(out, "acme", "demo").is_dir()
