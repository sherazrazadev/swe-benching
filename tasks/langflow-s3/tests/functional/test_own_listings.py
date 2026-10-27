"""A caller keeps seeing its own files and flows in the MCP listings."""

import pytest

from support.harness import resource_uris, tool_names, world

pytestmark = pytest.mark.asyncio


async def test_own_items_remain_listed():
    async with world() as w:
        async with w.session("/api/v1/mcp/streamable", "caller") as session:
            uris = resource_uris(await session.list_resources())
            assert any(w.ids["flow_inside"] in uri for uri in uris), uris
            assert any(w.ids["flow_outside"] in uri for uri in uris), uris
            names = tool_names(await session.list_tools())
            assert "caller_inside_flow" in names, names
            assert "caller_outside_flow" in names, names
        async with w.session("/api/v1/mcp/streamable", "owner") as session:
            names = tool_names(await session.list_tools())
            assert "owner_flow" in names, names
            uris = resource_uris(await session.list_resources())
            assert any(w.ids["flow_owner"] in uri for uri in uris), uris
