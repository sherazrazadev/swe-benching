"""A caller keeps duplicating its own stored files under a new name."""

import pytest

from support.harness import CALLER_BUCKET, world

pytestmark = pytest.mark.asyncio


async def test_own_file_can_be_copied_and_read():
    async with world() as w:
        new_name = "copied note ü.txt"
        response = await w.copy("caller", w.ids["bucket_file_id"], new_name)
        assert response.status_code == 201, f"own copy failed: {response.status_code} {response.text}"
        created = response.json()

        download = await w.http.get(f"api/v2/files/{created['id']}", headers=w.headers("caller"))
        assert download.status_code == 200, f"copied file not downloadable: {download.status_code} {download.text}"
        assert download.content == CALLER_BUCKET, f"wrong copied content: {download.content!r}"

        # The original is untouched and still readable.
        original = await w.preview("caller", w.paths["bucket_file"])
        assert original.status_code == 200 and original.content == CALLER_BUCKET, (
            f"original changed: {original.status_code} {original.content!r}"
        )
