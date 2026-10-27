"""A name whose separators are encoded must not leave the addressed namespace."""

import pytest

from support.harness import CALLER_OWN, attempt_read, world

pytestmark = pytest.mark.asyncio


async def test_encoded_separator_cannot_escape_namespace():
    async with world() as w:
        uri = w.encoded_traversal_uri(w.ids["caller"], w.paths["owner_file"])
        async with w.session("/api/v1/mcp/streamable", "caller") as session:
            returned, payload = await attempt_read(session, uri)
            assert not returned, f"an encoded separator read outside the namespace ({payload!r})"
            ok, own = await attempt_read(session, w.download_uri(w.paths["own_file"]))
            assert ok and own == CALLER_OWN, f"own file read broke: ok={ok} payload={own!r}"
