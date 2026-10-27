"""A caller must not read another account's own-account uploads either."""

import pytest

from support.harness import CALLER_BUCKET, attempt_read, world

pytestmark = pytest.mark.asyncio


async def test_foreign_bucket_read_is_refused():
    async with world() as w:
        async with w.session("/api/v1/mcp/streamable", "caller") as session:
            returned, payload = await attempt_read(session, w.download_uri(w.paths["owner_bucket_file"]))
            assert not returned, f"another account's own-account file was returned ({payload!r})"
            ok, own = await attempt_read(session, w.download_uri(w.paths["bucket_file"]))
            assert ok and own == CALLER_BUCKET, f"own bucket read broke: ok={ok} payload={own!r}"
