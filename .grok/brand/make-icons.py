#!/usr/bin/env python3
"""Rasterize Link Mate PWA icons from the same three-node chain as the favicon."""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path("/workspace/.grok/brand")
TEAL = (0x1F, 0x4D, 0x45, 255)
PAPER = (0xF3, 0xF1, 0xEC, 255)


def linked_nodes(draw: ImageDraw.ImageDraw, size: int, fill) -> None:
    """Three nodes joined by a bar, glyph inside the maskable ~80% safe zone."""
    # Horizontal span ~56% of the tile; vertical center.
    r = size * 0.118
    gap = size * 0.235  # center-to-center; slight overlap avoided
    cx = size / 2
    cy = size / 2
    bar_h = r * 0.72
    xs = (cx - gap, cx, cx + gap)
    draw.rounded_rectangle(
        (xs[0], cy - bar_h / 2, xs[2], cy + bar_h / 2),
        radius=bar_h / 2,
        fill=fill,
    )
    for x in xs:
        draw.ellipse((x - r, cy - r, x + r, cy + r), fill=fill)


def make_icon(size: int, rounded: bool = False) -> Image.Image:
    if rounded:
        im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(im)
        draw.rounded_rectangle(
            (0, 0, size - 1, size - 1),
            radius=int(size * 0.25),
            fill=TEAL,
        )
    else:
        im = Image.new("RGBA", (size, size), TEAL)
        draw = ImageDraw.Draw(im)
    linked_nodes(draw, size, PAPER)
    return im


def main() -> None:
    for size in (192, 512, 180):
        make_icon(size, rounded=False).save(OUT / f"icon-{size}.png", "PNG")
    make_icon(32, rounded=True).save(OUT / "favicon-32.png", "PNG")
    make_icon(16, rounded=True).save(OUT / "favicon-16.png", "PNG")
    print("wrote icons")


if __name__ == "__main__":
    main()
