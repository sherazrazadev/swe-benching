"""The global server must not enumerate another account's flows as tools."""

import pytest

from support.harness import tool_names, world

pytestmark = pytest.mark.asyncio


async def test_tools_listing_is_scoped_to_caller():
    async with world() as w:
        async with w.session("/api/v1/mcp/streamable", "caller") as session:
            names = tool_names(await session.list_tools())
            assert "owner_flow" not in names, f"another account's flow appears as a tool: {names}"
            assert "caller_inside_flow" in names, f"the caller's own flow is missing from tools: {names}"
