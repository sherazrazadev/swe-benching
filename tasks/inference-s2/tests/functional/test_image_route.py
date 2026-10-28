"""The image route's legitimate use keeps working: an OCR reply with ordinary coordinate
annotations still renders and saves the annotated image.
"""

from types import SimpleNamespace

from PIL import Image

from xinference.model.image.ocr.deepseek_ocr import DeepSeekOCRModel


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


def test_ordinary_coordinates_render_and_save(tmp_path):
    text = "<|ref|>title<|/ref|><|det|>[[10, 12, 40, 28]]<|/det|>Hello"
    out = tmp_path / "annotated"
    result = _model(text).ocr(
        Image.new("RGB", (64, 64), "white"),
        save_results=True,
        save_dir=str(out),
    )
    assert result["text"] == text
    assert result["visualization"]["num_bounding_boxes"] == 1
    assert (out / "result_with_boxes.jpg").is_file()


def test_plain_ocr_text_without_annotations_still_returns(tmp_path):
    text = "Just some ordinary OCR text."
    out = tmp_path / "plain"
    result = _model(text).ocr(
        Image.new("RGB", (32, 32), "white"),
        save_results=True,
        save_dir=str(out),
    )
    assert result["text"] == text
    assert result["success"] is True
