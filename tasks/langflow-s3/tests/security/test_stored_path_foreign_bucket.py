"""Another account's own-account upload must not be served by the stored-path file API."""

import pytest

from support.harness import CALLER_BUCKET, OWNER_BUCKET, world

pytestmark = pytest.mark.asyncio


async def test_stored_path_of_foreign_bucket_is_refused():
    async with world() as w:
        response = await w.preview("caller", w.paths["owner_bucket_file"])
        assert response.status_code >= 400 or OWNER_BUCKET not in response.content, (
            f"another account's own-account upload was served (status {response.status_code})"
        )
        # Positive control: the caller's own upload still previews.
        own = await w.preview("caller", w.paths["bucket_file"])
        assert own.status_code == 200 and own.content == CALLER_BUCKET, (
            f"own upload preview broke: status {own.status_code} body {own.content!r}"
        )
