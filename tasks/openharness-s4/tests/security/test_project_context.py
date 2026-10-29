"""Project-context commands: chat-supplied text must not reach the system prompt."""

from __future__ import annotations

import pytest

from harness import final_text, make_pool, probe_prompt, send

ISSUE_MARKER = "SEC_ISSUE_MARKER_9c41"
PR_MARKER = "SEC_PR_MARKER_ab72"
GROUP_MARKER = "SEC_GROUP_ISSUE_MARKER_31de"


@pytest.mark.asyncio
async def test_remote_issue_text_cannot_reach_the_system_prompt(tmp_path, repo, workspace, monkeypatch):
    pool = make_pool(repo=repo, workspace=workspace, monkeypatch=monkeypatch)

    final_text(await send(pool, f"/issue set Release :: {ISSUE_MARKER}"))

    target = repo / ".openharness" / "issue.md"
    assert not target.exists() or ISSUE_MARKER not in target.read_text(encoding="utf-8")
    assert ISSUE_MARKER not in await probe_prompt(pool)


@pytest.mark.asyncio
async def test_remote_issue_text_in_the_title_is_also_blocked(tmp_path, repo, workspace, monkeypatch):
    pool = make_pool(repo=repo, workspace=workspace, monkeypatch=monkeypatch)

    final_text(await send(pool, f"/issue set {ISSUE_MARKER} :: placeholder body"))

    target = repo / ".openharness" / "issue.md"
    assert not target.exists() or ISSUE_MARKER not in target.read_text(encoding="utf-8")
    assert ISSUE_MARKER not in await probe_prompt(pool)


@pytest.mark.asyncio
async def test_remote_pr_comment_appended_to_existing_file_is_blocked(
    tmp_path, repo, workspace, monkeypatch
):
    target = repo / ".openharness" / "pr_comments.md"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("# PR Comments\n- src/app.py:12: existing note\n", encoding="utf-8")
    pool = make_pool(repo=repo, workspace=workspace, monkeypatch=monkeypatch)

    final_text(await send(pool, f"/pr_comments add src/app.py:1 :: {PR_MARKER}"))

    assert PR_MARKER not in target.read_text(encoding="utf-8")
    assert PR_MARKER not in await probe_prompt(pool)


@pytest.mark.asyncio
async def test_remote_issue_text_is_blocked_for_a_group_bound_repo(
    tmp_path, repo, workspace, monkeypatch
):
    from ohmo.group_registry import save_managed_group_record

    project = tmp_path / "bound-project"
    project.mkdir()
    save_managed_group_record(
        workspace=workspace,
        channel="feishu",
        chat_id="oc_group",
        owner_open_id="ou_owner",
        name="owned/project",
        cwd=str(project),
        repo="owned/project",
        binding_status="bound",
    )
    pool = make_pool(repo=repo, workspace=workspace, monkeypatch=monkeypatch)

    updates = await send(
        pool,
        f"/issue set Bound :: {GROUP_MARKER}",
        channel="feishu",
        chat_id="oc_group",
        sender_id="ou_attacker",
        metadata={"chat_type": "group"},
    )
    final_text(updates)

    target = project / ".openharness" / "issue.md"
    assert not target.exists() or GROUP_MARKER not in target.read_text(encoding="utf-8")
    assert GROUP_MARKER not in await probe_prompt(pool, cwd=project)
