"""A project-scoped server must not serve account-level files outside the project."""

import pytest

from support.harness import CALLER_INSIDE, attempt_read, world

pytestmark = pytest.mark.asyncio


async def test_account_level_file_is_refused_on_project_server():
    async with world() as w:
        path = f"/api/v1/mcp/project/{w.ids['project']}/streamable"
        async with w.session(path, "caller") as session:
            returned, payload = await attempt_read(session, w.download_uri(w.paths["bucket_file"]))
            assert not returned, f"an account-level file was served through a project server ({payload!r})"
            # Positive control: an in-project flow file still works.
            ok, inside = await attempt_read(session, w.download_uri(w.paths["inside_file"]))
            assert ok and inside == CALLER_INSIDE, (
                f"in-project read broke: ok={ok} payload={inside!r}"
            )
