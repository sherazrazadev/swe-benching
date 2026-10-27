"""Another account's flow file must not be served by the stored-path file API."""

import pytest

from support.harness import CALLER_OWN, OWNER_SECRET, world

pytestmark = pytest.mark.asyncio


async def test_stored_path_of_foreign_flow_is_refused():
    async with world() as w:
        response = await w.preview("caller", w.paths["owner_file"])
        body = response.content
        assert response.status_code >= 400 or OWNER_SECRET not in body, (
            f"another account's flow file was served (status {response.status_code})"
        )
        # Positive control: the caller's own flow file still previews.
        own = await w.preview("caller", w.paths["own_file"])
        assert own.status_code == 200 and own.content == CALLER_OWN, (
            f"own flow file preview broke: status {own.status_code} body {own.content!r}"
        )
