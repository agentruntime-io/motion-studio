from __future__ import annotations

import base64
import io
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "logo.png"
OUT_SVG = ROOT / "public" / "logo-svg.svg"
PREVIEW = ROOT / "public" / "logo-mark-preview.png"


def main() -> None:
    im = Image.open(SRC).convert("RGBA")
    # A mark region only (excludes "Motion Studio" + tagline)
    mark = im.crop((368, 286, 892, 480))

    alpha = mark.split()[3]
    bbox = alpha.getbbox()
    if bbox:
        mark = mark.crop(bbox)

    pixels = mark.load()
    width, height = mark.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a > 16:
                pixels[x, y] = (255, 255, 255, a)

    buf = io.BytesIO()
    mark.save(buf, format="PNG")
    encoded = base64.b64encode(buf.getvalue()).decode("ascii")

    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}" fill="none">\n'
        f'  <image width="{width}" height="{height}" href="data:image/png;base64,{encoded}"/>\n'
        f"</svg>\n"
    )

    OUT_SVG.write_text(svg, encoding="utf-8")
    mark.save(PREVIEW)
    print(f"Wrote {OUT_SVG} ({width}x{height}, {len(svg)} bytes)")


if __name__ == "__main__":
    main()
