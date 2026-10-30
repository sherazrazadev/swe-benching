"""A name derived from a package URL must always be one file name, never a path."""
from __future__ import annotations

import os

import pytest

from pip._internal.models.link import Link

SHAPES = [
    "https://example.com/..",
    "https://example.com/.",
    "https://example.com/foo/%2e%2e",
    "http://../",
    "http://..",
    "https://example.com/a%252Fb.whl",
    "https://example.com/%252e%252e%252fb.whl",
]


@pytest.mark.parametrize("url", SHAPES)
def test_derived_name_is_a_single_component(url):
    try:
        name = Link(url).filename
    except Exception:
        # A clean refusal is an acceptable outcome; it must not hand back a path.
        return
    assert isinstance(name, str)
    assert os.path.basename(name) == name, f"{url!r} produced a path, not a name"
    assert name not in (os.curdir, os.pardir), f"{url!r} produced a parent reference"
    assert "/" not in name, f"{url!r} produced a separator"


def test_doubly_encoded_separator_kept_literal():
    # A separator that was encoded twice is a literal character in the name, not a path
    # separator and not a reason to reject the name.
    assert Link("https://example.com/a%252Fb.whl").filename == "a%2Fb.whl"
