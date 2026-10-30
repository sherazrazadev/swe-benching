"""A cached result must reflect the image it was computed from.

Each test drives a public cache decorator with two images that render
differently and requires the second call to produce the second image's result.
On the vulnerable tree the second call is served the first image's entry.
"""

from __future__ import annotations

import streamlit as st

from support.cache_env import rendered_colour
from support.images import large_palette_image, palette_image


def test_palette_colours_change_the_cache_entry():
    calls: list[int] = []

    @st.cache_data
    def corner(image):
        calls.append(1)
        return rendered_colour(image)

    first = palette_image(offset=0)
    second = palette_image(offset=128)
    assert rendered_colour(first) != rendered_colour(second)

    assert corner(first) == rendered_colour(first)
    assert corner(second) == rendered_colour(second)
    assert len(calls) == 2


def test_palette_with_alpha_colours_change_the_cache_entry():
    calls: list[int] = []

    @st.cache_data
    def corner(image):
        calls.append(1)
        return rendered_colour(image)

    first = palette_image(offset=0, mode="PA")
    second = palette_image(offset=128, mode="PA")
    assert rendered_colour(first) != rendered_colour(second)

    assert corner(first) == rendered_colour(first)
    assert corner(second) == rendered_colour(second)
    assert len(calls) == 2


def test_large_palette_image_colours_change_the_cache_entry():
    calls: list[int] = []

    @st.cache_data
    def corner(image):
        calls.append(1)
        return rendered_colour(image)

    first = large_palette_image((0, 0, 0))
    second = large_palette_image((200, 0, 0))
    assert rendered_colour(first) != rendered_colour(second)

    assert corner(first) == rendered_colour(first)
    assert corner(second) == rendered_colour(second)
    assert len(calls) == 2


def test_palette_colours_inside_a_container_change_the_cache_entry():
    calls: list[int] = []

    @st.cache_data
    def corner(bundle):
        calls.append(1)
        return rendered_colour(bundle["image"])

    first = {"image": palette_image(offset=0)}
    second = {"image": palette_image(offset=128)}
    assert rendered_colour(first["image"]) != rendered_colour(second["image"])

    assert corner(first) == rendered_colour(first["image"])
    assert corner(second) == rendered_colour(second["image"])
    assert len(calls) == 2


def test_resource_cache_distinguishes_palette_colours():
    calls: list[int] = []

    @st.cache_resource
    def corner(image):
        calls.append(1)
        return rendered_colour(image)

    first = palette_image(offset=0)
    second = palette_image(offset=128)
    assert rendered_colour(first) != rendered_colour(second)

    assert corner(first) == rendered_colour(first)
    assert corner(second) == rendered_colour(second)
    assert len(calls) == 2
