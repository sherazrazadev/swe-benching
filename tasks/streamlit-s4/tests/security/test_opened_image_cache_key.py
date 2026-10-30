"""A cached result must reflect an image read from a file, too.

Applications commonly hand a cached function an image opened from disk. The
same rendering rule applies: two opened images that display differently must
not share a cache entry.
"""

from __future__ import annotations

import streamlit as st

from support.cache_env import rendered_colour
from support.images import opened_palette_image


def test_opened_palette_image_colours_change_the_cache_entry():
    calls: list[int] = []

    @st.cache_data
    def corner(image):
        calls.append(1)
        return rendered_colour(image)

    first = opened_palette_image(offset=0)
    second = opened_palette_image(offset=128)
    assert rendered_colour(first) != rendered_colour(second)

    assert corner(first) == rendered_colour(first)
    assert corner(second) == rendered_colour(second)
    assert len(calls) == 2
