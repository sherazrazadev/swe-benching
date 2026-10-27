"""Using an enumerated identifier must not turn into a successful foreign read."""

import pytest

from support.harness import CALLER_OWN, attempt_read, resource_uris, world

pytestmark = pytest.mark.asyncio


async def test_foreign_read_after_listing_is_refused():
    async with world() as w:
        async with w.session("/api/v1/mcp/streamable", "caller") as session:
            uris = resource_uris(await session.list_resources())
            foreign = [uri for uri in uris if w.ids["flow_owner"] in uri]
            target = foreign[0] if foreign else w.download_uri(w.paths["owner_file"])
            returned, payload = await attempt_read(session, target)
            assert not returned, f"a listed foreign identifier led to a read ({payload!r})"
            ok, own = await attempt_read(session, w.download_uri(w.paths["own_file"]))
            assert ok and own == CALLER_OWN, f"own file read broke: ok={ok} payload={own!r}"
