"""Pillow image builders used by the hidden tests.

Written with Pillow directly so the expected rendered values never depend on
the code under test.
"""

from __future__ import annotations

import io
from typing import Final

from PIL import Image

_PALETTE_BYTES: Final = 256 * 3
_BUFFERS: list[io.BytesIO] = []


def palette_image(offset: int = 0, *, mode: str = "P", size=(12, 12), index: int = 0):
    """A palette-indexed image whose colour table is shifted by ``offset``."""
    if mode == "PA":
        image = Image.new("PA", size, (index, 255))
        palette = [(offset + i) % 256 for i in range(256 * 4)]
        image.putpalette(palette, rawmode="RGBA")
        return image
    image = Image.new("P", size, index)
    palette = [(offset + i) % 256 for i in range(_PALETTE_BYTES)]
    image.putpalette(palette)
    return image


def large_palette_image(colour: tuple[int, int, int], *, side: int = 800):
    """A large palette image whose first table entry is ``colour``."""
    image = Image.new("P", (side, side), 0)
    palette = [0] * _PALETTE_BYTES
    palette[0:3] = list(colour)
    image.putpalette(palette)
    return image


def opened_palette_image(offset: int = 0, *, fmt: str = "PNG", size=(12, 12)):
    """A palette image saved to a buffer and read back through Pillow's opener.

    The result is Pillow's format-specific image class (as any application that
    reads an image from disk gets), not ``Image.Image`` itself.
    """
    source = palette_image(offset, size=size)
    buffer = io.BytesIO()
    source.save(buffer, format=fmt)
    buffer.seek(0)
    opened = Image.open(buffer)
    opened.load()
    # Keep the buffer alive for the lifetime of the image object.
    _BUFFERS.append(buffer)
    return opened


def gradient_palette_image(side: int = 800):
    """A large palette image with position-dependent pixel indices.

    A stable cache identity must not depend on which positions of a large pixel
    buffer happen to be sampled, but the sampled values themselves are
    position-dependent here, so a process-random sample changes them.
    """
    image = Image.new("P", (side, side))
    image.putdata([(i // side * 7 + i % side) % 256 for i in range(side * side)])
    image.putpalette([i % 256 for i in range(_PALETTE_BYTES)])
    return image
