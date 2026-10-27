"""The refusal does not depend on which of another account's files is named."""

import pytest

from support.harness import CALLER_OWN, attempt_read, world

pytestmark = pytest.mark.asyncio


async def test_second_foreign_file_read_is_refused():
    async with world() as w:
        async with w.session("/api/v1/mcp/streamable", "caller") as session:
            returned, payload = await attempt_read(session, w.download_uri(w.paths["owner_file2"]))
            assert not returned, f"a second foreign file was returned ({payload!r})"
            ok, own = await attempt_read(session, w.download_uri(w.paths["own_file"]))
            assert ok and own == CALLER_OWN, f"own file read broke: ok={ok} payload={own!r}"
