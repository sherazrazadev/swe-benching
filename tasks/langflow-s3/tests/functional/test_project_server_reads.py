"""A project-scoped server keeps serving the project's own files and tools."""

import pytest

from support.harness import CALLER_INSIDE, attempt_read, resource_uris, tool_names, world

pytestmark = pytest.mark.asyncio


async def test_project_scope_keeps_working():
    async with world() as w:
        path = f"/api/v1/mcp/project/{w.ids['project']}/streamable"
        async with w.session(path, "caller") as session:
            ok, payload = await attempt_read(session, w.download_uri(w.paths["inside_file"]))
            assert ok and payload == CALLER_INSIDE, f"in-project read: ok={ok} payload={payload!r}"
            uris = resource_uris(await session.list_resources())
            assert any(w.ids["flow_inside"] in uri for uri in uris), uris
            names = tool_names(await session.list_tools())
            assert "caller_inside_flow" in names, names
