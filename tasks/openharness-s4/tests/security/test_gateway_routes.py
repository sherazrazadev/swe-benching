"""Gateway-level command routes: chat-supplied text must not reach the system prompt."""

from __future__ import annotations

import pytest

from harness import final_text, make_pool, probe_prompt, send

FOCUS_MARKER = "SEC_FOCUS_MARKER_2f90"
NOTE_MARKER = "SEC_NOTE_MARKER_c15e"


@pytest.mark.asyncio
async def test_remote_focus_text_cannot_reach_the_system_prompt(tmp_path, repo, workspace, monkeypatch):
    pool = make_pool(repo=repo, workspace=workspace, monkeypatch=monkeypatch)

    final_text(await send(pool, f"/focus set {FOCUS_MARKER}"))

    target = repo / ".openharness" / "autopilot" / "active_repo_context.md"
    assert not target.exists() or FOCUS_MARKER not in target.read_text(encoding="utf-8")
    assert FOCUS_MARKER not in await probe_prompt(pool)


@pytest.mark.asyncio
async def test_remote_note_text_cannot_reach_the_system_prompt(tmp_path, repo, workspace, monkeypatch):
    pool = make_pool(repo=repo, workspace=workspace, monkeypatch=monkeypatch)

    final_text(await send(pool, f"/note add {NOTE_MARKER}"))

    notes = workspace / "notes.md"
    assert not notes.exists() or NOTE_MARKER not in notes.read_text(encoding="utf-8")
    assert NOTE_MARKER not in await probe_prompt(pool)
