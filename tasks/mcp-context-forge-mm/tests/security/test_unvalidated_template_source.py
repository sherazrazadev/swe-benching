"""Templates that reach storage without the authoring schema must render safely too.

An MCP server can offer prompts with more fields than the fixed client model declares;
the gateway keeps those extra fields and stores the template. Rendering that template
must follow the same rule as any other stored template. An implementation that refuses
or drops unsafe text at registration is also refused, not silently rendered.
"""

import html
import uuid

import mcp.types as mtypes

from conftest import (
    OBFUSCATED_GADGET,
    RUNTIME_MARKER,
    assert_refused,
    find_stored_prompt_name,
    listed_prompt_identifiers,
    register_upstream_gateway,
    render_prompt,
)


def _assert_upstream_template_refused(client, monkeypatch, template):
    original_name = f"upstream-prompt-{uuid.uuid4().hex[:10]}"
    upstream = [
        mtypes.Prompt.model_validate(
            {
                "name": original_name,
                "description": "upstream prompt",
                "template": template,
                "arguments": [{"name": "topic", "description": "topic", "required": False}],
            }
        )
    ]
    response, _gateway = register_upstream_gateway(client, monkeypatch, upstream)
    body = html.unescape(response.text)
    assert RUNTIME_MARKER not in body, f"registration exposed runtime internals: {body[:400]}"

    if response.status_code != 200:
        # Refused when the template reached the gateway: nothing may be left behind.
        assert 400 <= response.status_code < 500, response.text
        assert original_name not in listed_prompt_identifiers(client)
        return

    stored = find_stored_prompt_name(client, original_name)
    if stored is None:
        # The unsafe prompt was dropped at registration; nothing was kept.
        return

    assert_refused(render_prompt(client, stored, {"topic": "weather"}))


def test_upstream_supplied_template_is_not_evaluated(client, monkeypatch):
    _assert_upstream_template_refused(client, monkeypatch, "{{ ''.__class__.__mro__[1].__subclasses__ }}")


def test_upstream_obfuscated_template_is_not_evaluated(client, monkeypatch):
    _assert_upstream_template_refused(client, monkeypatch, OBFUSCATED_GADGET)
