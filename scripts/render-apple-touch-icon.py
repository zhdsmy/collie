#!/usr/bin/env python3
"""Regenerate the checked-in iOS PNGs with rsvg-convert and Pillow.

Run manually after editing web/src/assets/collie-touch-icon.svg. Normal builds
use the checked-in PNGs and need neither tool. The canvas stays transparent;
iOS home-screen appearance must be checked on a device after artwork changes.
"""

from copy import deepcopy
from io import BytesIO
from pathlib import Path
import subprocess
import xml.etree.ElementTree as ET

from PIL import Image, ImageFilter


def render(svg):
    png = subprocess.check_output(
        ["rsvg-convert", "-w", "2048", "-h", "2048"],
        input=ET.tostring(svg, encoding="utf-8"),
    )
    return Image.open(BytesIO(png)).convert("RGBA")


def main():
    root = Path(__file__).resolve().parents[1]
    svg = ET.parse(root / "web/src/assets/collie-touch-icon.svg").getroot()
    coverage = deepcopy(svg)
    edge = coverage.find('.//*[@id="inner-outline"]')
    assert edge is not None, "missing inner outline"
    edge.set("opacity", "0")
    artwork = render(svg)
    # Keep the original silhouette coverage when the inner edge is painted twice.
    artwork.putalpha(render(coverage).getchannel("A"))
    outlined = Image.new("RGBA", artwork.size, "#fafaf8")
    # The fine light edge keeps the dark orbit visible on a dark home screen.
    outlined.putalpha(artwork.getchannel("A").filter(ImageFilter.MaxFilter(11)))
    outlined.alpha_composite(artwork)
    for size, suffix in [(180, ""), (512, "-512")]:
        icon = outlined.resize((size, size), Image.Resampling.LANCZOS)
        assert icon.getchannel("A").getextrema() == (0, 255)
        assert icon.getpixel((0, 0))[3] == 0
        icon.save(root / f"web/public/apple-touch-icon{suffix}.png", optimize=True)


if __name__ == "__main__":
    main()
