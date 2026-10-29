"""Personal-memory command: chat-supplied text must not reach the system prompt."""

from __future__ import annotations

import pytest

from harness import final_text, make_pool, probe_prompt, send

MEMORY_MARKER = "SEC_MEMORY_MARKER_58b3"


@pytest.mark.asyncio
async def test_remote_memory_text_cannot_reach_the_system_prompt(
    tmp_path, repo, workspace, monkeypatch
):
    pool = make_pool(repo=repo, workspace=workspace, monkeypatch=monkeypatch)

    final_text(await send(pool, f"/memory add Profile :: {MEMORY_MARKER}"))

    memory_dir = workspace / "memory"
    for path in sorted(memory_dir.rglob("*.md")) if memory_dir.is_dir() else []:
        assert MEMORY_MARKER not in path.read_text(encoding="utf-8", errors="replace"), path
    assert MEMORY_MARKER not in await probe_prompt(pool)
