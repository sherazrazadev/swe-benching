"""The same property holds for the other model families whose tool-call text the completion
route interprets: a payload in their argument text must not run.
"""

import warnings

from xinference.model.llm.tool_parsers import TOOL_PARSERS
from xinference.model.llm.utils import ChatModelMixin

warnings


def _complete(parser_name, text):
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
        return None


def _traversal(marker):
    return (
        "[c for c in ().__class__.__bases__[0].__subclasses__() "
        'if c.__name__ == "catch_warnings"][0]()._module.__builtins__'
        '["__import__"]("os").system("touch %s")' % str(marker)
    )


def _builtin_call(marker):
    return 'open(%r, "w").write("x")' % str(marker)


def test_gemma_argument_text_is_not_executed(tmp_path):
    marker = tmp_path / "gemma-executed"
    text = '<|tool_call>call:get_weather{"parameters": %s}<tool_call|>' % _traversal(
        marker
    )
    _complete("gemma", text)
    assert not marker.exists(), "the gemma argument block ran as code"


def test_minimax_parameter_value_is_not_executed(tmp_path):
    marker = tmp_path / "minimax-executed"
    text = (
        '<minimax:tool_call><invoke name="get_weather">'
        '<parameter name="city">%s</parameter></invoke></minimax:tool_call>'
    ) % _builtin_call(marker)
    _complete("minimax", text)
    assert not marker.exists(), "a minimax parameter value ran as code"
