"""Legitimate prompt authoring and rendering must keep working."""

import uuid

import mcp.types as mtypes

from conftest import create_prompt, register_upstream_gateway, render_prompt, stored_prompt_name


def _text(response):
    assert response.status_code == 200, response.text
    body = response.json()
    return body["messages"][0]["content"]["text"]


def test_plain_variable_renders(client):
    created = create_prompt(client, "Hello {{ name }}", arguments=[{"name": "name", "description": "who", "required": True}])
    assert created.status_code == 200, created.text
    assert _text(render_prompt(client, created.json()["name"], {"name": "World"})) == "Hello World"


def test_loop_filter_and_condition_render(client):
    template = "{% for i in range(3) %}Item {{ i }};{% endfor %} {{ name|upper }}{% if name %}!{% endif %}"
    created = create_prompt(client, template, arguments=[{"name": "name", "description": "who", "required": True}])
    assert created.status_code == 200, created.text
    # Block tags are also read as brace fields by the gateway's argument scanner, so the
    # caller supplies those names as well; Jinja ignores them.
    arguments = {"name": "ada", "% for i in range(3) %": "", "% endfor %": "", "% if name %": "", "% endif %": ""}
    rendered = _text(render_prompt(client, created.json()["name"], arguments))
    assert rendered == "Item 0;Item 1;Item 2; ADA!"


def test_ordinary_prose_is_accepted_and_returned(client):
    template = "Please select an option from the list: {{ choice }}. Thanks && see you."
    created = create_prompt(client, template, arguments=[{"name": "choice", "description": "choice", "required": True}])
    assert created.status_code == 200, created.text
    rendered = _text(render_prompt(client, created.json()["name"], {"choice": "A"}))
    assert rendered == "Please select an option from the list: A. Thanks && see you."


def test_literal_braces_are_preserved(client):
    template = "Use { and } for JSON: {{ name }}"
    created = create_prompt(client, template, arguments=[{"name": "name", "description": "who", "required": True}])
    assert created.status_code == 200, created.text
    rendered = _text(render_prompt(client, created.json()["name"], {"name": "X", " and ": ""}))
    assert rendered == "Use { and } for JSON: X"


def test_upstream_prompt_still_renders(client, monkeypatch):
    original_name = f"upstream-benign-{uuid.uuid4().hex[:10]}"
    upstream = [
        mtypes.Prompt.model_validate(
            {
                "name": original_name,
                "description": "upstream prompt",
                "template": "Topic: {{ topic }}",
                "arguments": [{"name": "topic", "description": "topic", "required": True}],
            }
        )
    ]
    response, _gateway = register_upstream_gateway(client, monkeypatch, upstream)
    assert response.status_code == 200, response.text
    stored = stored_prompt_name(client, original_name)
    assert _text(render_prompt(client, stored, {"topic": "climate"})) == "Topic: climate"
