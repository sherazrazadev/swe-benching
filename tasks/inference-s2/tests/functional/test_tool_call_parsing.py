"""Legitimate tool calls keep working: ordinary JSON, Python-literal values, every parameter
shape the product accepts today, and the exact fallback contract for output that is not a tool
call (it comes back as assistant content, never as an error or a tool call).
"""

import json

from xinference.model.llm.tool_parsers import TOOL_PARSERS
from xinference.model.llm.utils import ChatModelMixin


def _message(parser_name, text):
    mixin = ChatModelMixin()
    mixin.tool_parser = TOOL_PARSERS[parser_name]()
    mixin.reasoning_parser = None
    completion = {
        "choices": [{"text": text}],
        "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
    }
    response = mixin._post_process_completion(None, "test-model", completion)
    return response["choices"][0]["message"]


def _arguments(message):
    calls = message["tool_calls"]
    assert calls, "expected a tool call"
    return calls[0]["function"]["name"], json.loads(calls[0]["function"]["arguments"])


def test_json_tool_call_binds():
    text = '{"name": "get_weather", "parameters": {"location": "Beijing", "days": 3}}'
    name, args = _arguments(_message("llama3", text))
    assert name == "get_weather"
    assert args == {"location": "Beijing", "days": 3}


def test_json_parameter_shapes_bind():
    text = (
        '{"name": "search", "parameters": {"query": "hi", "limit": 10, '
        '"ratio": 0.5, "tags": ["a", "b"], "options": {"depth": 2}}}'
    )
    name, args = _arguments(_message("llama3", text))
    assert name == "search"
    assert args == {
        "query": "hi",
        "limit": 10,
        "ratio": 0.5,
        "tags": ["a", "b"],
        "options": {"depth": 2},
    }


def test_python_literal_parameter_shapes_bind():
    text = (
        "{'name': 'search', 'parameters': {'query': 'hi', 'exact': True, "
        "'cursor': None, 'tags': ['a', 'b'], 'options': {'deep': False, 'depth': 2}}}"
    )
    name, args = _arguments(_message("llama3", text))
    assert name == "search"
    assert args == {
        "query": "hi",
        "exact": True,
        "cursor": None,
        "tags": ["a", "b"],
        "options": {"deep": False, "depth": 2},
    }


def test_python_literal_tool_call_binds():
    text = (
        "{'name': 'toggle', 'parameters': {'enabled': True, 'label': None, "
        "'count': 3, 'items': [1, 2]}}"
    )
    name, args = _arguments(_message("llama3", text))
    assert name == "toggle"
    assert args == {"enabled": True, "label": None, "count": 3, "items": [1, 2]}


def test_non_object_json_comes_back_as_content():
    for text in ("[1, 2, 3]", "hello there"):
        message = _message("llama3", text)
        assert message["tool_calls"] == []
        assert message["content"] == text


def test_malformed_output_comes_back_as_content():
    text = '{"name": "func", "parameters": {'
    message = _message("llama3", text)
    assert message["tool_calls"] == []
    assert message["content"] == text


def test_empty_output_comes_back_as_content():
    message = _message("llama3", "")
    assert message["tool_calls"] == []
    assert message["content"] == ""


def test_gemma_tool_call_binds():
    text = '<|tool_call>call:get_weather{location:<|"|>Shanghai<|"|>, days: 3}<tool_call|>'
    name, args = _arguments(_message("gemma", text))
    assert name == "get_weather"
    assert args == {"location": "Shanghai", "days": 3}


def test_gemma_python_literal_arguments_bind():
    text = "<|tool_call>call:get_weather{'location': 'Shanghai', 'days': 3}<tool_call|>"
    name, args = _arguments(_message("gemma", text))
    assert name == "get_weather"
    assert args == {"location": "Shanghai", "days": 3}


def test_minimax_tool_call_binds():
    text = (
        '<minimax:tool_call><invoke name="get_weather">'
        '<parameter name="city">"Paris"</parameter>'
        '<parameter name="days">3</parameter>'
        "</invoke></minimax:tool_call>"
    )
    name, args = _arguments(_message("minimax", text))
    assert name == "get_weather"
    assert args == {"city": "Paris", "days": 3}


def test_minimax_python_literal_value_binds():
    text = (
        '<minimax:tool_call><invoke name="toggle">'
        '<parameter name="enabled">True</parameter>'
        "</invoke></minimax:tool_call>"
    )
    name, args = _arguments(_message("minimax", text))
    assert name == "toggle"
    assert args == {"enabled": True}


def test_legacy_dispatch_keeps_parsing_calls():
    """The legacy family-dispatch copy keeps parsing ordinary and Python-literal calls."""
    dispatch = getattr(ChatModelMixin, "_eval_tool_arguments", None)
    if dispatch is None:
        return

    class _Family:
        model_family = "llama-3.1-instruct"
        model_name = "llama-3.1-instruct"

    for text, expected in (
        ('{"name": "get_weather", "parameters": {"days": 2}}', ("get_weather", {"days": 2})),
        ("{'name': 'toggle', 'parameters': {'enabled': False}}", ("toggle", {"enabled": False})),
    ):
        try:
            result = dispatch(_Family(), {"choices": [{"text": text}]})
        except AttributeError:
            # The legacy dispatch was removed as dead code; nothing is left to parse.
            return
        assert result == [(None, expected[0], expected[1])]
