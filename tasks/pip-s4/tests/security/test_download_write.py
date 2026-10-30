"""A downloader must never write a package-supplied name outside the target directory."""
from __future__ import annotations

import os
from types import SimpleNamespace
from unittest.mock import patch

from pip._internal.models.link import Link
from pip._internal.network.download import Downloader

from support import MockResponse


def test_download_write_stays_inside_target(tmp_path):
    target = tmp_path / "target"
    target.mkdir()
    # The URL's last segment decodes twice to a parent-relative name.
    link = Link("http://example.com/%252e%252e%252fmarker-1.0.tar.gz")
    outside = tmp_path / "marker-1.0.tar.gz"

    downloader = Downloader(SimpleNamespace(resume_retries=0), "off")
    response = MockResponse(b"MARKER-CONTENT", link.url)
    with patch.object(Downloader, "_http_get", return_value=response):
        try:
            downloader(link, str(target))
        except Exception:
            pass

    assert not outside.exists(), "a package-supplied name escaped the target directory"
    # Nothing this call created may sit outside target.
    for created in tmp_path.rglob("*"):
        if created.is_file() and created.name == "marker-1.0.tar.gz":
            assert target in created.parents or created.parent == target
