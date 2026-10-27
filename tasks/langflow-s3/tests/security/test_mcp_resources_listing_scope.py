"""The global server must not enumerate another account's files."""

import pytest

from urllib.parse import quote

from support.harness import resource_uris, world

pytestmark = pytest.mark.asyncio


async def test_resources_listing_is_scoped_to_caller():
    async with world() as w:
        async with w.session("/api/v1/mcp/streamable", "caller") as session:
            uris = resource_uris(await session.list_resources())
            assert not any(w.ids["flow_owner"] in uri for uri in uris), (
                f"another account's flow appears in the listing: {uris}"
            )
            assert any(quote(w.paths["own_file"].split("/", 1)[1]) in uri for uri in uris), (
                f"the caller's own file is missing from the listing: {uris}"
            )
