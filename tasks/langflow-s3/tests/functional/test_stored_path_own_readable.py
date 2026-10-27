"""A caller keeps previewing its own stored files through the ordinary file API."""

import pytest

from support.harness import CALLER_BUCKET, CALLER_OWN, world

pytestmark = pytest.mark.asyncio


async def test_own_stored_paths_still_preview():
    async with world() as w:
        for path, expected in (
            (w.paths["bucket_file"], CALLER_BUCKET),
            (w.paths["own_file"], CALLER_OWN),
        ):
            response = await w.preview("caller", path)
            assert response.status_code == 200, f"own path {path!r} preview: {response.status_code} {response.text}"
            assert response.content == expected, f"wrong content for {path!r}: {response.content!r}"

        # A bare name refers to the caller's own upload.
        bare = await w.preview("caller", "bucket note ü.txt")
        assert bare.status_code == 200 and bare.content == CALLER_BUCKET, (
            f"bare own name broke: {bare.status_code} {bare.content!r}"
        )
