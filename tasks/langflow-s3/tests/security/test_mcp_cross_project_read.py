"""A project-scoped server must not serve files of flows outside the project."""

import pytest

from support.harness import CALLER_INSIDE, attempt_read, world

pytestmark = pytest.mark.asyncio


async def test_cross_project_read_is_refused():
    async with world() as w:
        path = f"/api/v1/mcp/project/{w.ids['project']}/streamable"
        async with w.session(path, "caller") as session:
            returned, payload = await attempt_read(session, w.download_uri(w.paths["outside_file"]))
            assert not returned, f"a flow outside the project was served ({payload!r})"
            # Positive control: a flow inside the project still works.
            ok, inside = await attempt_read(session, w.download_uri(w.paths["inside_file"]))
            assert ok and inside == CALLER_INSIDE, f"in-project read broke: ok={ok} payload={inside!r}"
