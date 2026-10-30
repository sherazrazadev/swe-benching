"""Cache behaviour every legitimate application depends on.

These tests must pass on the vulnerable tree as well as after a fix: they pin
the reuse and hashing behaviour a repair is not allowed to lose.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import streamlit as st

from support.images import (
    large_palette_image,
    opened_palette_image,
    palette_image,
)
from support.cache_env import rendered_colour


def test_equal_palette_images_share_one_cached_result():
    calls: list[int] = []

    @st.cache_data
    def corner(image):
        calls.append(1)
        return rendered_colour(image)

    first = palette_image(offset=0)
    second = palette_image(offset=0)

    assert corner(first) == rendered_colour(first)
    assert corner(second) == rendered_colour(second)
    assert calls == [1]


def test_equal_palette_with_alpha_images_share_one_cached_result():
    calls: list[int] = []

    @st.cache_data
    def corner(image):
        calls.append(1)
        return rendered_colour(image)

    first = palette_image(offset=0, mode="PA")
    second = palette_image(offset=0, mode="PA")

    assert corner(first) == rendered_colour(first)
    assert corner(second) == rendered_colour(second)
    assert calls == [1]


def test_equal_large_palette_images_share_one_cached_result():
    calls: list[int] = []

    @st.cache_data
    def corner(image):
        calls.append(1)
        return rendered_colour(image)

    first = large_palette_image((10, 20, 30))
    second = large_palette_image((10, 20, 30))

    assert corner(first) == (10, 20, 30)
    assert corner(second) == (10, 20, 30)
    assert calls == [1]


def test_rgb_images_keep_their_existing_behaviour():
    calls: list[int] = []

    @st.cache_data
    def corner(image):
        calls.append(1)
        return rendered_colour(image)

    from PIL import Image

    a1 = Image.new("RGB", (16, 16), (10, 20, 30))
    a2 = Image.new("RGB", (16, 16), (10, 20, 30))
    b = Image.new("RGB", (16, 16), (200, 100, 50))

    assert corner(a1) == (10, 20, 30)
    assert corner(a2) == (10, 20, 30)
    assert calls == [1]
    assert corner(b) == (200, 100, 50)
    assert len(calls) == 2


def test_plain_values_keep_their_existing_hashing():
    calls: list[int] = []

    @st.cache_data
    def double(value):
        calls.append(1)
        return value * 2

    assert double(3) == 6
    assert double(3) == 6
    assert calls == [1]
    assert double(4) == 8
    assert len(calls) == 2
    assert double("ab") == "abab"
    assert len(calls) == 3


def test_array_and_table_values_keep_their_existing_hashing():
    calls: list[str] = []

    @st.cache_data
    def total(values):
        calls.append("ran")
        return int(np.asarray(values).sum())

    array = np.arange(64, dtype=np.int64)
    assert total(array) == int(array.sum())
    assert total(array.copy()) == int(array.sum())
    assert calls == ["ran"]

    frame = pd.DataFrame({"a": [1, 2, 3]})
    assert total(frame["a"]) == 6
    assert total(frame["a"].copy()) == 6
    assert len(calls) == 2


def test_resource_cache_keeps_working_with_images():
    calls: list[int] = []

    @st.cache_resource
    def lookup(image):
        calls.append(1)
        return rendered_colour(image)

    first = palette_image(offset=7)
    second = palette_image(offset=7)

    assert lookup(first) == rendered_colour(first)
    assert lookup(second) == rendered_colour(second)
    assert calls == [1]


def test_equal_opened_palette_images_share_one_cached_result():
    calls: list[int] = []

    @st.cache_data
    def corner(image):
        calls.append(1)
        return rendered_colour(image)

    first = opened_palette_image(offset=0)
    second = opened_palette_image(offset=0)

    assert corner(first) == rendered_colour(first)
    assert corner(second) == rendered_colour(second)
    assert calls == [1]

