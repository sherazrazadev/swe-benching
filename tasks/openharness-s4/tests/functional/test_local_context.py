"""Locally authored project context keeps loading into the system prompt exactly as today."""

from __future__ import annotations

import pytest

from openharness.commands.registry import CommandContext, create_default_command_registry
from openharness.config.settings import Settings
from openharness.prompts import build_runtime_system_prompt

ISSUE_TEXT = "Fix the flaky deploy\n\n- use `make check`\n- see ```yaml\nkey: value\n```\n"
PR_TEXT = "Please simplify this branch before merge.\n"


async def _run_local(repo, raw):
    registry = create_default_command_registry()
    command, args = registry.lookup(raw)
    assert command is not None, raw
    return await command.handler(args, CommandContext(engine=None, cwd=str(repo)))


@pytest.mark.asyncio
async def test_locally_set_issue_context_is_written_and_loaded(repo):
    result = await _run_local(repo, "/issue set Flaky deploy :: " + ISSUE_TEXT.replace("\n", " "))

    assert "Saved issue context" in result.message
    written = (repo / ".openharness" / "issue.md").read_text(encoding="utf-8")
    assert "Flaky deploy" in written

    prompt = build_runtime_system_prompt(Settings(), cwd=repo, latest_user_prompt="hello")
    assert "Issue Context" in prompt
    assert "Flaky deploy" in prompt
    assert "make check" in prompt


@pytest.mark.asyncio
async def test_locally_added_pr_comment_is_written_and_loaded(repo):
    result = await _run_local(repo, "/pr_comments add src/app.py:12 :: " + PR_TEXT.strip())

    assert "Added PR comment" in result.message
    prompt = build_runtime_system_prompt(Settings(), cwd=repo, latest_user_prompt="hello")
    assert "Pull Request Comments" in prompt
    assert "Please simplify this branch before merge." in prompt


@pytest.mark.asyncio
async def test_locally_authored_context_keeps_markdown_and_fences(repo):
    body = "line one\n\n```python\nprint('kept')\n```\n\nline two"
    target = repo / ".openharness" / "issue.md"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(f"# Title\n\n{body}\n", encoding="utf-8")

    prompt = build_runtime_system_prompt(Settings(), cwd=repo, latest_user_prompt="hello")

    assert "```python\nprint('kept')\n```" in prompt
    assert "line one" in prompt and "line two" in prompt


@pytest.mark.asyncio
async def test_large_locally_authored_context_keeps_todays_length(repo):
    head = "abcdefghij" * 1200  # 12,000 characters
    tail = "ZFARBEYONDTHETRUNCATIONPOINT"
    target = repo / ".openharness" / "issue.md"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(f"{head}{tail}\n", encoding="utf-8")

    prompt = build_runtime_system_prompt(Settings(), cwd=repo, latest_user_prompt="hello")

    assert head in prompt
    assert tail not in prompt
