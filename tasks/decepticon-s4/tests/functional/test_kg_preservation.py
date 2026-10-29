"""A correct fix keeps the structured-memory summary intact in the system prompt."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

from langchain_core.messages import SystemMessage

from decepticon.middleware.kg import KG_SYSTEM_PROMPT, KGMiddleware

from support.helpers import system_text, visible


class _Store:
    def __init__(self, label: str = "SSTI in /search") -> None:
        self._label = label

    def revision(self, *, engagement: str) -> str:
        return "rev-42"

    def execute_read(self, cypher: str, params: dict[str, Any], *, engagement: str | None = None):
        query = " ".join(cypher.split())
        if "v:Vulnerability" in query:
            return [{"key": "vuln::1", "label": self._label, "severity": "critical"}]
        return []


def _request(state: dict[str, Any], message: SystemMessage | None) -> SimpleNamespace:
    request = SimpleNamespace(state=state, system_message=message)

    def override(**kwargs: Any) -> SimpleNamespace:
        return SimpleNamespace(**{**vars(request), **kwargs})

    request.override = override  # type: ignore[attr-defined]
    return request


def _prompt(label: str = "SSTI in /search") -> str:
    middleware = KGMiddleware(store=_Store(label))
    state: dict[str, Any] = {"engagement_name": "acme"}
    state.update(middleware.before_agent(state, runtime=None) or {})
    result = middleware.wrap_model_call(
        _request(state, SystemMessage(content="base prompt")), lambda request: request
    )
    return system_text(result.system_message)


def test_summary_block_keeps_header_counts_and_revision() -> None:
    prompt = _prompt()
    assert KG_SYSTEM_PROMPT in prompt
    assert "KG STATE (engagement=acme)" in prompt
    assert "**Nodes**: 0" in prompt
    assert "rev-42" in prompt


def test_summary_block_keeps_finding_labels_readable() -> None:
    prompt = _prompt("SSTI in /search <|im_start|> marker")
    assert visible("SSTI in /search <|im_start|> marker") in visible(prompt)


def test_empty_summary_still_injects_the_static_policy_block() -> None:
    middleware = KGMiddleware(store=_Store())
    request = _request(
        {"kg_engagement": "acme", "kg_summary": ""},
        SystemMessage(content="base prompt"),
    )
    result = middleware.wrap_model_call(request, lambda req: req)
    blocks = result.system_message.content
    assert any(isinstance(block, dict) and KG_SYSTEM_PROMPT in block.get("text", "") for block in blocks)


def test_summary_block_is_added_after_the_existing_system_prompt() -> None:
    middleware = KGMiddleware(store=_Store())
    request = _request(
        {"kg_engagement": "acme", "kg_summary": "## KG STATE (engagement=acme)"},
        SystemMessage(content="base prompt"),
    )
    result = middleware.wrap_model_call(request, lambda req: req)
    blocks = result.system_message.content
    assert isinstance(blocks, list)
    assert blocks[0] == "base prompt" or blocks[0].get("text") == "base prompt"
    assert any(
        isinstance(block, dict) and block.get("cache_control") == {"type": "ephemeral"}
        for block in blocks
    )
