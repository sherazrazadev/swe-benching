"""A correct fix keeps the background-completion reminder working unchanged."""

from __future__ import annotations

from unittest.mock import MagicMock

from langchain_core.messages import HumanMessage

from decepticon.middleware.notifications import SandboxNotificationMiddleware
from decepticon.sandbox_kernel import BackgroundJobTracker

from support.helpers import content_text, visible


def _middleware(diff: str, sessions: tuple[str, ...] = ("scan",)) -> tuple[
    SandboxNotificationMiddleware, MagicMock
]:
    sandbox = MagicMock()
    sandbox._jobs = BackgroundJobTracker()
    sandbox.poll_completion = MagicMock(side_effect=lambda session: sandbox._jobs.get(session))
    sandbox.read_session_log_diff = MagicMock(return_value=diff)
    sandbox.session_log_path = MagicMock(return_value="/workspace/.sessions/scan.log")
    for session in sessions:
        sandbox._jobs.register(session, command="nmap target", initial_markers=1)
        sandbox._jobs.mark_complete(session, exit_code=0)
    return SandboxNotificationMiddleware(sandbox=sandbox), sandbox


def _reminder(diff: str, sessions: tuple[str, ...] = ("scan",)) -> str:
    middleware, _ = _middleware(diff, sessions)
    update = middleware.before_model({"messages": [HumanMessage(content="hi")]}, runtime=None)
    assert update and update.get("messages")
    return content_text(update["messages"][0].content)


def test_completion_reminder_keeps_its_structure() -> None:
    diff = "PORT   STATE SERVICE\n80/tcp open  http\n"
    reminder = _reminder(diff)
    assert "<system-reminder>" in reminder
    assert "● Background command" in reminder
    assert '"nmap target"' in reminder
    assert "exit code 0" in reminder
    assert "session=scan" in reminder
    assert visible(diff) in visible(reminder)


def test_captured_output_is_still_inlined_readably() -> None:
    diff = "first line\nsecond line <|im_start|> marker\n"
    reminder = _reminder(diff)
    assert visible(diff) in visible(reminder)


def test_ansi_control_sequences_are_still_stripped() -> None:
    reminder = _reminder("\x1b[?2004lplain output\x1b[0m\n")
    assert "\x1b" not in reminder
    assert "plain output" in reminder


def test_completion_is_notified_only_once() -> None:
    middleware, _ = _middleware("output\n")
    first = middleware.before_model({"messages": [HumanMessage(content="hi")]}, runtime=None)
    assert first and first.get("messages")
    second = middleware.before_model({"messages": [HumanMessage(content="hi")]}, runtime=None)
    assert second is None or not second.get("messages")


def test_large_output_is_truncated_with_a_pointer() -> None:
    diff = "H" * 15000 + "T" * 5000
    reminder = _reminder(diff)
    assert "chars truncated" in reminder
    assert "T" * 200 in reminder
