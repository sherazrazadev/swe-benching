"""The product also interprets model-produced text outside chat: the image route reads
coordinate annotations out of the OCR model's reply. The same property applies there — the
reply must not run as code. The test drives the public model method the image route calls,
with a stub inference returning the model reply.
"""

import warnings
from types import SimpleNamespace

import pytest
from PIL import Image

from xinference.model.image.ocr.deepseek_ocr import DeepSeekOCRModel

warnings


class _StubInference:
    def __init__(self, text):
        self._text = text

    def infer(self, **kwargs):
        return self._text


def _model(text):
    spec = SimpleNamespace(
        model_ability=[], model_name="DeepSeek-OCR", model_format="pytorch"
    )
    model = DeepSeekOCRModel(
        "test-uid", model_path="/nonexistent", device="cpu", model_spec=spec
    )
    model._model = _StubInference(text)
    model._tokenizer = object()
    return model


def _annotation(expression):
    return "<|ref|>text<|/ref|><|det|>%s<|/det|>" % expression


def _builtin_call(marker):
    return 'open(%r, "w").write("x")' % str(marker)


def _traversal(marker):
    return (
        "[c for c in ().__class__.__bases__[0].__subclasses__() "
        'if c.__name__ == "catch_warnings"][0]()._module.__builtins__'
        '["__import__"]("os").system("touch %s")' % str(marker)
    )


@pytest.mark.parametrize("make_expression", [_builtin_call, _traversal])
def test_ocr_annotation_text_is_not_executed(tmp_path, make_expression):
    marker = tmp_path / "ocr-executed"
    out = tmp_path / "annotated"
    text = _annotation(make_expression(marker))
    try:
        _model(text).ocr(
            Image.new("RGB", (32, 32), "white"),
            save_results=True,
            save_dir=str(out),
        )
    except Exception:
        pass
    assert not marker.exists(), "the OCR model's annotation text ran as code"
