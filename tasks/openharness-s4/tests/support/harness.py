"""Shared helpers for the hidden suites.

Only test bookkeeping lives here: a stub model runtime for the real ohmo gateway pool,
helpers that send an inbound chat message through the real dispatcher, and a helper that
opens a fresh session and returns the system prompt it would use.
"""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

from openharness.api.usage import UsageSnapshot
from openharness.channels.bus.events import InboundMessage
from openharness.commands.registry import create_default_command_registry
from openharness.config.settings import Settings


class _StubEngine:
    def __init__(self) -> None:
        self.messages = []
        self.total_usage = UsageSnapshot()
        self.system_prompt = ""

    def set_system_prompt(self, prompt: str) -> None:
        self.system_prompt = prompt


def make_pool(*, repo: Path, workspace: Path, monkeypatch):
    """Build the real ohmo gateway session pool with a stub model runtime."""
    import ohmo.gateway.runtime as gateway

    registry = create_default_command_registry()

    async def build_runtime(**kwargs):
        engine = _StubEngine()
        engine.system_prompt = kwargs.get("system_prompt") or ""
        return SimpleNamespace(
            engine=engine,
            cwd=kwargs.get("cwd") or str(repo),
            session_id="sess-test",
            current_settings=lambda: Settings(system_prompt=kwargs.get("system_prompt")),
            commands=registry,
            tool_registry=None,
            app_state=None,
            session_backend=None,
            extra_skill_dirs=(),
            extra_plugin_roots=(),
            hook_summary=lambda: "",
            mcp_summary=lambda: "",
            plugin_summary=lambda: "",
        )

    async def start_runtime(bundle):
        return None

    monkeypatch.setattr(gateway, "build_runtime", build_runtime)
    monkeypatch.setattr(gateway, "start_runtime", start_runtime)
    return gateway.OhmoSessionRuntimePool(
        cwd=repo, workspace=workspace, provider_profile="codex"
    )


async def send(
    pool,
    content: str,
    *,
    channel: str = "slack",
    chat_id: str = "C_SHARED",
    sender_id: str = "U_ATTACKER",
    metadata: dict | None = None,
):
    """Send one inbound chat message through the real dispatcher."""
    message = InboundMessage(
        channel=channel,
        sender_id=sender_id,
        chat_id=chat_id,
        content=content,
        metadata=metadata or {},
    )
    session_key = f"{channel}:{chat_id}:{sender_id}"
    return [update async for update in pool.stream_message(message, session_key)]


def final_text(updates) -> str:
    assert updates, "the gateway produced no update for the message"
    assert updates[-1].kind == "final", f"unexpected last update kind: {updates[-1].kind}"
    return updates[-1].text


async def probe_prompt(pool, *, cwd: Path | None = None) -> str:
    """Open a fresh session (what any later chat turn sees) and return its system prompt."""
    bundle = await pool.get_bundle(
        "slack:C_PROBE:U_OWNER", latest_user_prompt="hello", cwd=cwd
    )
    return bundle.engine.system_prompt
