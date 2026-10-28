"""Model-produced text must be data: an expression in a chat completion's tool-call text must
never run, whichever parser family answers it. The marker file written by the payload is the
observable side effect; a safe fix leaves it absent and returns the text as assistant content.
"""

import warnings

import pytest

from xinference.model.llm.tool_parsers import TOOL_PARSERS
from xinference.model.llm.utils import ChatModelMixin

warnings  # imported so the traversal payload's subclass lookup is populated


def _complete(parser_name, text):
    """Drive the same completion post-processing the chat route uses after generation."""
    mixin = ChatModelMixin()
    mixin.tool_parser = TOOL_PARSERS[parser_name]()
    mixin.reasoning_parser = None
    completion = {
        "choices": [{"text": text}],
        "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
    }
    try:
        return mixin._post_process_completion(None, "test-model", completion)
    except Exception:
        # A refusal may surface as an exception; the security question is whether the
        # payload ran, not how the product reports it.
        return None


def _builtin_call(marker):
    return '{"name": "get_weather", "parameters": open(%r, "w").write("x")}' % str(marker)


def _traversal(marker):
    return (
        '{"name": "get_weather", "parameters": '
        "[c for c in ().__class__.__bases__[0].__subclasses__() "
        'if c.__name__ == "catch_warnings"][0]()._module.__builtins__'
        '["__import__"]("os").system("touch %s")}' % str(marker)
    )


@pytest.mark.parametrize("make_payload", [_builtin_call, _traversal])
def test_tool_call_text_is_not_executed(tmp_path, make_payload):
    marker = tmp_path / "tool-call-executed"
    _complete("llama3", make_payload(marker))
    assert not marker.exists(), "the model's tool-call text ran as code"


def test_nested_parameter_expression_is_not_executed(tmp_path):
    marker = tmp_path / "nested-executed"
    text = (
        '{"name": "get_weather", "parameters": {"where": {"value": '
        'open(%r, "w").write("x")}}}' % str(marker)
    )
    _complete("llama3", text)
    assert not marker.exists(), "an expression nested in a parameter ran as code"


def test_legacy_family_dispatch_does_not_execute(tmp_path):
    """The legacy family-dispatch entry point is a second copy of the same parse job."""
    marker = tmp_path / "legacy-executed"
    completion = {"choices": [{"text": _builtin_call(marker)}]}

    class _Family:
        model_family = "llama-3.1-instruct"
        model_name = "llama-3.1-instruct"

    try:
        ChatModelMixin._eval_tool_arguments(_Family(), completion)
    except Exception:
        pass
    assert not marker.exists(), "the legacy dispatch ran the model's text as code"
