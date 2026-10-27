"""Naming a destination outside the caller's own container must change nothing there."""

import pytest

from support.harness import CALLER_BUCKET, attempt_read, world

pytestmark = pytest.mark.asyncio


async def test_destination_outside_namespace_is_refused_without_side_effect():
    async with world() as w:
        escaping_name = f"../{w.ids['owner']}/copied-marker.txt"

        response = await w.copy("caller", w.ids["bucket_file_id"], escaping_name)
        assert response.status_code >= 400, (
            f"a copy outside the caller's container was accepted (status {response.status_code})"
        )

        # The side effect itself: if bytes were written into the other account's
        # container, that account's own client can now read them there.
        uri = w.download_uri(f"{w.ids['owner']}/copied-marker.txt")
        async with w.session("/api/v1/mcp/streamable", "owner") as session:
            returned, payload = await attempt_read(session, uri)
        assert not returned or CALLER_BUCKET not in payload, (
            f"a file was created in another account's container ({payload!r})"
        )
