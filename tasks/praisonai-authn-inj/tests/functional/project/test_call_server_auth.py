"""The project's own check that the agent API needs a token by default.

Only the token-required case is kept: the pinned tree's second case asserted that the
configuration opt-out bypasses authentication from a bare fake request, which is the
behaviour this task repairs.
"""

from __future__ import annotations

import importlib
import os

import pytest

pytest.importorskip("fastapi")


@pytest.mark.asyncio
async def test_verify_token_requires_token_by_default(monkeypatch):
    monkeypatch.delenv("CALL_SERVER_TOKEN", raising=False)
    monkeypatch.delenv("PRAISONAI_CALL_AUTH", raising=False)

    mod = importlib.import_module("praisonai.api.agent_invoke")
    importlib.reload(mod)

    class _Req:
        query_params = {}

    with pytest.raises(Exception) as exc:
        await mod.verify_token(_Req(), authorization=None)
    assert "CALL_SERVER_TOKEN" in str(exc.value)
