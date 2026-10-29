"""Templates that reach storage without the authoring schema must render safely too.

An MCP server can offer prompts with more fields than the fixed client model declares;
the gateway keeps those extra fields and stores the template. Rendering that template
must follow the same rule as any other stored template.
"""

import uuid

import mcp.types as mtypes

from conftest import assert_refused, register_upstream_gateway, render_prompt, stored_prompt_name


def test_upstream_supplied_template_is_not_evaluated(client, monkeypatch):
    original_name = f"upstream-prompt-{uuid.uuid4().hex[:10]}"
    upstream = [
        mtypes.Prompt.model_validate(
            {
                "name": original_name,
                "description": "upstream prompt",
                "template": "{{ ''.__class__.__mro__[1].__subclasses__ }}",
                "arguments": [{"name": "topic", "description": "topic", "required": False}],
            }
        )
    ]
    response, _gateway = register_upstream_gateway(client, monkeypatch, upstream)
    assert response.status_code == 200, response.text

    stored = stored_prompt_name(client, original_name)
    rendered = render_prompt(client, stored, {"topic": "weather"})
    assert_refused(rendered)
