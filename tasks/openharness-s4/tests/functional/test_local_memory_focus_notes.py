"""Locally authored memory, focus and notes keep loading into the system prompt."""

from __future__ import annotations

import pytest

from harness import make_pool, probe_prompt
from ohmo.memory import create_memory_command_backend
from ohmo.prompts import build_ohmo_system_prompt
from openharness.commands.registry import CommandContext, create_default_command_registry
from openharness.config.settings import Settings
from openharness.prompts import build_runtime_system_prompt

MEMORY_TEXT = "prefers concise answers"
FOCUS_TEXT = "the release branch is the focus this week"
NOTE_TEXT = "remember the staging host name"


@pytest.mark.asyncio
async def test_locally_added_memory_is_written_and_loaded(repo, workspace):
    registry = create_default_command_registry()
    command, args = registry.lookup(f"/memory add Profile :: {MEMORY_TEXT}")
    assert command is not None
    context = CommandContext(
        engine=None,
        cwd=str(repo),
        memory_backend=create_memory_command_backend(workspace),
    )

    result = await command.handler(args, context)

    assert "Added memory entry" in result.message
    stored = "\n".join(
        path.read_text(encoding="utf-8") for path in (workspace / "memory").glob("*.md")
    )
    assert MEMORY_TEXT in stored

    prompt = build_ohmo_system_prompt(repo, workspace=workspace)
    assert MEMORY_TEXT in prompt


@pytest.mark.asyncio
async def test_locally_set_focus_is_written_and_loaded(repo):
    registry = create_default_command_registry()
    command, args = registry.lookup(f"/focus set {FOCUS_TEXT}")
    assert command is not None

    result = await command.handler(args, CommandContext(engine=None, cwd=str(repo)))

    assert "Saved active repo context" in result.message
    target = repo / ".openharness" / "autopilot" / "active_repo_context.md"
    assert FOCUS_TEXT in target.read_text(encoding="utf-8")

    prompt = build_runtime_system_prompt(Settings(), cwd=repo, latest_user_prompt="hello")
    assert "Active Repo Context" in prompt
    assert FOCUS_TEXT in prompt


@pytest.mark.asyncio
async def test_locally_written_notes_are_loaded_into_the_chat_prompt(
    tmp_path, repo, workspace, monkeypatch
):
    (workspace / "notes.md").write_text(f"- {NOTE_TEXT}\n", encoding="utf-8")
    pool = make_pool(repo=repo, workspace=workspace, monkeypatch=monkeypatch)

    prompt = await probe_prompt(pool)

    assert NOTE_TEXT in prompt
