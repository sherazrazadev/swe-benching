"""Ordinary remote chat use keeps working."""

from __future__ import annotations

import pytest

from harness import final_text, make_pool, send


@pytest.mark.asyncio
async def test_remote_help_command_still_answers(tmp_path, repo, workspace, monkeypatch):
    pool = make_pool(repo=repo, workspace=workspace, monkeypatch=monkeypatch)

    text = final_text(await send(pool, "/help"))

    assert "Available commands" in text
