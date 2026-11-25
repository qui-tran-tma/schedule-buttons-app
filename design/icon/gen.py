#!/usr/bin/env python3
"""MEQ Smarthome app icon: writes SVG sources and renders the Expo PNG assets.

Mark: amber roof chevron over "MEQ". The E is three bars, one per power-board relay
channel; the middle bar is amber ("on"). Run from anywhere: python3 design/icon/gen.py
Needs rsvg-convert (brew install librsvg).
"""
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
ASSETS = HERE.parent.parent / "assets"

NAVY_TOP, NAVY_BOTTOM = "#16213E", "#0F3460"
AMBER, WHITE = "#FFB020", "#FFFFFF"

BG_DEF = (
    '<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">'
    f'<stop offset="0" stop-color="{NAVY_TOP}"/><stop offset="1" stop-color="{NAVY_BOTTOM}"/>'
    "</linearGradient>"
)


def mark(fg: str, accent: str) -> str:
    """The mark on a 1024 canvas, optically centred."""
    return f"""<g transform="translate(0 76)">
    <path d="M232 300 L512 120 L792 300" fill="none" stroke="{accent}" stroke-width="56" stroke-linecap="round" stroke-linejoin="round"/>
    <g fill="none" stroke="{fg}" stroke-width="64" stroke-linecap="round" stroke-linejoin="round">
      <path d="M157 748 V452 L225 600 L293 452 V748"/>
      <ellipse cx="757" cy="600" rx="110" ry="148"/>
      <path d="M846 718 L890 776"/>
    </g>
    <rect x="395" y="420" width="150" height="64" rx="32" fill="{fg}"/>
    <rect x="395" y="568" width="150" height="64" rx="32" fill="{accent}"/>
    <rect x="395" y="716" width="150" height="64" rx="32" fill="{fg}"/>
  </g>"""


def svg(body: str, background: bool, scale: float = 1.0) -> str:
    t = 512 * (1 - scale)
    bg = '<rect width="1024" height="1024" fill="url(#bg)"/>' if background else ""
    inner = f'<g transform="translate({t:g} {t:g}) scale({scale:g})">{body}</g>' if body else ""
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">\n'
        f"  <defs>{BG_DEF}</defs>\n  {bg}\n  {inner}\n</svg>\n"
    )


# Android adaptive icon: keep the mark inside the 66% safe circle.
ADAPTIVE_SCALE = 0.68

SOURCES = {
    "meq-icon.svg": svg(mark(WHITE, AMBER), background=True),
    "meq-android-foreground.svg": svg(mark(WHITE, AMBER), background=False, scale=ADAPTIVE_SCALE),
    "meq-android-monochrome.svg": svg(mark(WHITE, WHITE), background=False, scale=ADAPTIVE_SCALE),
    "meq-android-background.svg": svg("", background=True),
}

OUTPUTS = [
    ("meq-icon.svg", "icon.png", 1024),
    ("meq-android-foreground.svg", "android-icon-foreground.png", 1024),
    ("meq-android-monochrome.svg", "android-icon-monochrome.png", 1024),
    ("meq-android-background.svg", "android-icon-background.png", 1024),
    ("meq-icon.svg", "favicon.png", 48),
]


def main() -> None:
    for name, text in SOURCES.items():
        (HERE / name).write_text(text)
    for src, dst, size in OUTPUTS:
        subprocess.run(
            ["rsvg-convert", "-w", str(size), "-h", str(size), str(HERE / src), "-o", str(ASSETS / dst)],
            check=True,
        )
        print(f"assets/{dst} ({size}px)")


if __name__ == "__main__":
    main()
