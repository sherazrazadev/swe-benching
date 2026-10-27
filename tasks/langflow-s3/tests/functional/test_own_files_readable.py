"""A caller keeps reading files stored for its own account."""

import pytest

from support.harness import CALLER_BUCKET, CALLER_INSIDE, CALLER_OWN, attempt_read, world

pytestmark = pytest.mark.asyncio


async def test_own_namespaces_remain_readable():
    async with world() as w:
        async with w.session("/api/v1/mcp/streamable", "caller") as session:
            for path, expected in (
                (w.paths["own_file"], CALLER_OWN),
                (w.paths["inside_file"], CALLER_INSIDE),
                (w.paths["bucket_file"], CALLER_BUCKET),
            ):
                ok, payload = await attempt_read(session, w.download_uri(path))
                assert ok, f"own file {path!r} became unreadable: {payload!r}"
                assert payload == expected, f"wrong content for {path!r}: {payload!r}"
