"""A collection requirement's revision value must reach the SCM client as data.

The source is a real local collection repository; the revision value names the SCM client's option
whose command writes a marker file.
"""
from __future__ import annotations

from support import galaxy_harness as gh


def test_collection_revision_is_not_an_option(tmp_path):
    repo = gh.make_collection_repo(tmp_path / "collection-src", tag="1.0.0")
    marker = tmp_path / "executed-from-revision"

    req = {
        "collections": [
            {
                "name": "acme.demo",
                "type": "git",
                "source": str(repo),
                "version": gh.option_payload(marker),
            }
        ]
    }
    gh.install_collections(tmp_path, req, tmp_path / "collections")

    assert not marker.exists(), "the SCM client ran the command named in the revision value"
