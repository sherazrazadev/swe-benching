"""A caller must not read a stored file that lives in another account's flow."""

import pytest

from support.harness import CALLER_OWN, attempt_read, world

pytestmark = pytest.mark.asyncio


async def test_foreign_flow_read_is_refused():
    async with world() as w:
        async with w.session("/api/v1/mcp/streamable", "caller") as session:
            returned, payload = await attempt_read(session, w.download_uri(w.paths["owner_file"]))
            assert not returned, f"another account's file content was returned ({payload!r})"
            # Positive control: the same session can still read its own file.
            ok, own = await attempt_read(session, w.download_uri(w.paths["own_file"]))
            assert ok and own == CALLER_OWN, f"own file read broke: ok={ok} payload={own!r}"
