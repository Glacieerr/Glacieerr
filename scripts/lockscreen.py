#!/usr/bin/env python3
"""Render the GitHub profile art as SVG: banner, widgets, widget strip, unlock pill, app tiles.

The look ("Dusk Tech"): a near-black page with a faint dot grid and soft indigo, violet and teal
glows; a bold gradient clock; a small solar system round my avatar: eight planets on thin rings
that set off from where they really are today, and the Moon beside Earth in today's phase.
The light mode is its own white design, not the dark one inverted. Every piece follows the
visitor's GitHub theme: dark art on dark pages, light art on light pages. All artwork is
original. Standard library only (Python 3.9+), so the daily GitHub Action installs nothing.

  python3 scripts/lockscreen.py all --out out                        # every asset for today (Albany time)
  python3 scripts/lockscreen.py all --out out --at 2026-11-13T22:55:07 --with-static
  python3 scripts/lockscreen.py templates --out live                 # banner templates for the live clock
  python3 scripts/lockscreen.py gallery --out out                    # data for the design gallery

Files it writes (page = dark | light, layout = below | right | portrait, weight = bold | thin):
  banner-<page>-<layout>-<weight>-<mode>.svg   the banner. mode daily: no clock, the date is the
                                               hero (regenerated every night); static: frozen at
                                               --at, for screenshots only
  w-<widget>-<page>.svg                        one widget: the card alone on a transparent canvas
  strip-<page>.svg                             every widget in one image
  unlock-<page>.svg                            the README fold's summary image
  icon-<app>-<page>.svg                        the app tiles behind the fold
  milestone-<1|2>-<page>.svg                   the two newest milestones (idea #9)
  skills-<page>.svg, timeline-<page>.svg       the skill map (#110) and the project timeline (#111)
  badge-<key>-<page>.svg, footer-<page>.svg    contact badges (#109, #148) and the last-run line (#112)
The page-mode names replace the old wallpapers; midnight, orbit, blossom and aurora still mean
dark, lagoon and dawn still mean light.

Every decorative movement is a CSS animation that runs only without reduced motion (#16, #19);
the glow behind the avatar follows the Sun's altitude (#97); New Year's Day, the Spring Festival
and the Mid-Autumn Festival get a small touch (#150, scripts/festivals.py).

Facts come from data/profile.json. Daily data (App Store lookup, simulated store day) come from
data/*.json when present; every widget has a safe fallback.
"""
from __future__ import annotations

import argparse
import base64
import datetime as dt
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
from html import escape
from zoneinfo import ZoneInfo

sys.dont_write_bytecode = True   # importing a sibling script leaves no __pycache__ in the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from festivals import festival_on  # noqa: E402  (scripts/festivals.py, written by make_holidays.mjs)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SANS = ("-apple-system,BlinkMacSystemFont,system-ui,'Segoe UI',Roboto,'Helvetica Neue',Arial,"
        "'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Noto Sans CJK SC',sans-serif")
MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace"
TNUM = 'style="font-variant-numeric:tabular-nums"'

# --------------------------------------------------------------------------- tokens
# From 风格对比/dusk-tech/tokens.json (modes.dark / modes.light). A colour with transparency is
# (hex, alpha), because some SVG renderers still ignore rgba() in stop-color.
MODES = {
    "dark": dict(
        page="dark", bg="#08090c", bg2="#0f1116", fg="#f7f8f8", fg2="#a4a9b3", fg3="#80858f",
        line=("#ffffff", .08), line2=("#ffffff", .13), chip=("#ffffff", .035),
        edge=(("#ffffff", .20), ("#ffffff", .06), ("#ffffff", .09)),
        dot=("#ffffff", .12), ring=("#ffffff", .34), ring_faint=("#ffffff", .10),
        indigo="#9095ff", violet="#b69cff", teal="#4fe0c8", teal_text="#4fe0c8", seconds="#ffffff",
        glow_a=("#5a4cf2", .40), glow_b=("#8b5cf6", .20), glow_c=("#12b5a2", .24),
        card_glow=("#6366f1", .10), clock=("#ffffff", "#b9bdcb"), disc=("#191c25", "#0b0c10"),
        glint=("#ffffff", .38), track=("#ffffff", .08), banner_edge=("#ffffff", .11),
        tile=("#1a1d27", "#0c0d11"), tile_glow=("#7c7fff", .26), tile_ink="#eef0f4",
        lane_bg=("#08090c", .82), browser_bar="#191b1f", shimmer=("#ffffff", .55)),
    "light": dict(
        page="light", bg="#ffffff", bg2="#fbfbfc", fg="#0b0c0e", fg2="#555a64", fg3="#6a6f79",
        line=("#0a0c14", .09), line2=("#0a0c14", .14), chip=("#0a0c14", .025),
        edge=(("#0a0c14", .16), ("#0a0c14", .08), ("#0a0c14", .11)),
        dot=("#0a0c14", .13), ring=("#0a0c14", .38), ring_faint=("#0a0c14", .12),
        indigo="#5458e0", violet="#7a4cf0", teal="#0d9488", teal_text="#0f766e", seconds="#0b0c0e",
        glow_a=("#6366f1", .20), glow_b=("#a78bfa", .12), glow_c=("#2dd4bf", .16),
        card_glow=("#6366f1", .07), clock=("#0b0c0e", "#3a3d48"), disc=("#ffffff", "#f2f3f7"),
        glint=("#5458e0", .35), track=("#0a0c14", .08), banner_edge=("#0a0c14", .17),
        tile=("#ffffff", "#f3f4f8"), tile_glow=("#6366f1", .12), tile_ink="#1f2328",
        lane_bg=("#ffffff", .82), browser_bar="#f2f2f3", shimmer=("#5458e0", .5)),
}
PAGES = ("dark", "light")
LAYOUTS = ("below", "right", "portrait")
WEIGHTS = ("bold", "thin")
# the wallpaper names used before this restyle, mapped to the page mode they stood for
ALIASES = {"midnight": "dark", "orbit": "dark", "blossom": "dark", "aurora": "dark", "lagoon": "light", "dawn": "light"}
ZONES = {"America/New_York": "Eastern Time", "America/Chicago": "Central Time",
         "America/Denver": "Mountain Time", "America/Los_Angeles": "Pacific Time"}

# --------------------------------------------------------------------------- text widths
# Advance widths (px) of SF Pro, the font GitHub visitors on a Mac get from this stack, measured
# in headless Chrome for each style that needs layout maths (pills, chips, wrapped lines). Order:
# ASCII 32..126, then the extra characters below. Other fonts (Segoe UI, Roboto, Arial) are a
# little narrower, so a pill sized from these numbers never clips its text.
_EXTRA = "·↗°…–—’×✓ "
_SIZES = {"pill": 13, "lane": 12.5, "chip": 11.5, "tag": 10, "num30": 30, "s11": 11, "s13.5": 13.5,
          "s12.5": 12.5, "p-pill": 21, "p-lane": 20, "p-sub": 23, "p-date": 28}
_WIDTHS = {
    "pill": "3.48 4.17 6.53 8.3 8.3 12.44 9.33 4.02 5.09 5.09 6.12 8.3 4.02 6.12 4.02 4.02 8.36 6.17 7.95 8.27 8.48 8.17 8.41 7.48 8.47 8.41 4.02 4.02 8.3 8.3 8.3 6.78 11.91 8.94 8.64 9.34 9.47 7.8 7.48 9.69 9.75 3.62 7.2 8.72 7.42 11.44 9.69 10.03 8.36 10.03 8.61 8.38 8.28 9.62 8.89 12.69 8.98 8.67 8.59 5.09 4.02 5.09 8.3 7.7 6.44 7.27 8.08 7.33 8.08 7.48 4.84 8.02 7.77 3.31 3.31 7.25 3.41 11.52 7.7 7.73 8.03 8.02 5.12 6.92 4.88 7.7 7.16 10.31 6.98 7.22 7.06 5.09 3.47 5.09 8.3 4.02 10.02 6.12 11.05 7.7 11.44 4.02 8.3 11.39 3.48",
    "lane": "3.3 4.23 6.7 8.19 8.19 12.45 9.14 4.11 5.14 5.14 5.97 8.19 4.11 5.97 4.11 4.03 8.3 6.17 7.84 8.16 8.38 8.08 8.33 7.38 8.41 8.33 4.11 4.11 8.19 8.19 8.19 6.75 11.52 8.88 8.48 9.12 9.22 7.64 7.33 9.42 9.59 3.73 7.22 8.62 7.3 11.17 9.47 9.73 8.23 9.73 8.48 8.25 8.11 9.38 8.8 12.42 8.88 8.59 8.36 5.14 4.03 5.14 8.19 7.62 6.22 7.19 7.95 7.2 7.95 7.36 4.88 7.89 7.69 3.39 3.39 7.25 3.48 11.36 7.62 7.59 7.91 7.91 5.19 6.88 4.92 7.62 7.09 10.25 7 7.2 6.94 5.14 3.55 5.14 8.19 4.11 9.8 5.97 11.28 7.62 11.17 4.11 8.19 11.17 3.3",
    "chip": "3.09 3.97 6.23 7.61 7.61 11.53 8.47 3.84 4.8 4.8 5.56 7.61 3.84 5.56 3.84 3.78 7.7 5.73 7.28 7.58 7.78 7.5 7.72 6.86 7.81 7.72 3.84 3.84 7.61 7.61 7.61 6.28 10.67 8.23 7.88 8.47 8.55 7.09 6.81 8.73 8.89 3.5 6.72 8 6.78 10.34 8.77 9.03 7.64 9.03 7.88 7.66 7.53 8.69 8.16 11.48 8.23 7.98 7.75 4.8 3.78 4.8 7.61 7.09 5.8 6.67 7.39 6.69 7.39 6.83 4.56 7.33 7.14 3.19 3.19 6.73 3.27 10.53 7.09 7.06 7.34 7.34 4.84 6.39 4.59 7.09 6.59 9.5 6.5 6.7 6.45 4.8 3.33 4.8 7.61 3.84 9.09 5.56 10.44 7.09 10.34 3.84 7.61 10.34 3.09",
    "tag": "2.7 3.69 5.81 6.84 6.84 10.48 7.58 3.59 4.41 4.41 4.97 6.84 3.59 4.97 3.59 3.47 6.97 5.23 6.56 6.81 7 6.77 6.95 6.17 7.06 6.95 3.59 3.59 6.84 6.84 6.84 5.7 9.39 7.45 7.06 7.53 7.59 6.34 6.09 7.73 7.95 3.31 6.14 7.22 6.08 9.19 7.81 7.98 6.86 7.98 7.06 6.88 6.72 7.73 7.34 10.22 7.42 7.2 6.88 4.41 3.47 4.41 6.84 6.41 5.12 6.02 6.64 6 6.64 6.14 4.2 6.58 6.45 3 3 6.14 3.08 9.45 6.41 6.33 6.59 6.59 4.47 5.78 4.25 6.41 5.95 8.59 5.94 6.09 5.78 4.41 3.12 4.41 6.84 3.59 8.11 4.97 9.67 6.41 9.19 3.59 6.84 9.23 2.7",
    "num30": "6.41 9.39 13.55 19.22 19.39 26.28 21.12 8.34 11.25 11.25 13.39 19.39 7.36 13.52 7.36 9.25 19.39 19.39 19.39 19.39 19.39 19.39 19.39 19.39 19.39 19.39 7.36 7.36 19.39 19.39 19.39 15.97 26.91 20.61 19.23 21.52 21.19 17.38 16.64 22.02 21.98 7.95 16.52 19.47 16.5 25.94 21.69 22.77 18.52 22.75 19.2 18.97 18.25 21.52 20.28 28.95 20.45 19.83 19.19 11.25 9.25 11.25 19.39 17.19 15.41 16.38 17.88 16.31 17.84 16.62 10.55 17.75 17.48 7.27 7.27 16.02 7.28 25.7 17.19 17.16 17.77 17.75 10.77 15.34 10.53 17.19 15.8 23.36 15.64 16.05 15.19 11.25 7.39 11.25 19.39 7.36 24 13.39 19.92 17.19 25.94 7.36 19.39 27.28 6.41",
    "s11": "3.08 3.66 5.66 7.16 7.16 10.66 8.02 3.53 4.44 4.44 5.31 7.16 3.53 5.31 3.53 3.53 7.2 5.36 6.86 7.12 7.31 7.03 7.25 6.47 7.3 7.25 3.53 3.53 7.16 7.16 7.16 5.88 10.2 7.7 7.44 8.03 8.14 6.72 6.45 8.33 8.39 3.2 6.22 7.5 6.42 9.8 8.33 8.61 7.2 8.61 7.41 7.22 7.14 8.27 7.66 10.88 7.72 7.47 7.41 4.44 3.53 4.44 7.16 6.66 5.58 6.28 6.97 6.33 6.97 6.47 4.22 6.91 6.7 2.94 2.94 6.27 3.02 9.88 6.66 6.67 6.92 6.92 4.45 5.98 4.25 6.66 6.19 8.86 6.05 6.25 6.11 4.44 3.06 4.44 7.16 3.53 8.59 5.31 9.47 6.66 9.8 3.53 7.16 9.77 3.08",
    "s13.5": "3.42 4.61 7.38 8.86 8.86 13.62 9.88 4.48 5.58 5.58 6.41 8.86 4.48 6.41 4.48 4.34 9.02 6.7 8.48 8.83 9.08 8.75 9.02 7.98 9.14 9.02 4.48 4.48 8.86 8.86 8.86 7.31 12.39 9.66 9.17 9.84 9.94 8.23 7.91 10.12 10.38 4.08 7.88 9.36 7.86 12.06 10.2 10.47 8.91 10.47 9.17 8.92 8.75 10.11 9.53 13.42 9.62 9.33 8.98 5.58 4.34 5.58 8.86 8.27 6.64 7.77 8.61 7.77 8.61 7.94 5.3 8.53 8.33 3.67 3.67 7.89 3.78 12.34 8.27 8.19 8.55 8.55 5.66 7.44 5.36 8.27 7.67 11.17 7.61 7.84 7.48 5.58 3.84 5.58 8.86 4.48 10.59 6.41 12.44 8.27 12.06 4.48 8.86 12.09 3.42",
    "s12.5": "3.39 4.05 6.31 8.02 8.02 12 9 3.89 4.94 4.94 5.92 8.02 3.89 5.92 3.89 3.91 8.08 5.97 7.69 7.98 8.2 7.89 8.12 7.23 8.19 8.12 3.89 3.89 8.02 8.02 8.02 6.56 11.48 8.64 8.34 9.02 9.14 7.53 7.23 9.36 9.42 3.53 6.95 8.42 7.17 11.03 9.36 9.67 8.08 9.67 8.31 8.09 8 9.28 8.59 12.23 8.67 8.38 8.3 4.94 3.91 4.94 8.02 7.45 6.22 7.03 7.8 7.08 7.8 7.23 4.69 7.73 7.52 3.22 3.22 7 3.31 11.11 7.45 7.48 7.75 7.75 4.95 6.69 4.72 7.45 6.92 9.95 6.77 6.98 6.83 4.94 3.38 4.94 8.02 3.89 9.66 5.92 10.66 7.45 11.03 3.89 8.02 10.98 3.39",
    "p-pill": "4.83 6.16 9.61 12.95 12.97 18.83 14.47 5.8 7.55 7.55 9.17 12.97 5.52 9.3 5.52 6.03 13.06 9.53 12.3 12.81 13.16 12.67 13.16 11.64 13.12 13.16 5.52 5.52 12.97 12.97 12.97 10.53 18.66 13.89 13.28 14.62 14.67 11.97 11.47 15.12 15.16 5.25 11.05 13.38 11.39 17.88 15.05 15.64 12.8 15.64 13.22 12.94 12.7 14.94 13.78 19.91 13.91 13.44 13.28 7.55 6.03 7.55 12.97 11.77 10.16 11.12 12.34 11.16 12.33 11.41 7.12 12.23 11.92 4.78 4.77 10.98 4.84 17.81 11.77 11.81 12.25 12.23 7.45 10.5 7.14 11.77 10.86 15.95 10.61 10.97 10.62 7.55 4.98 7.55 12.97 5.52 15.94 9.17 15.73 11.77 17.88 5.52 12.97 18.16 4.83",
    "p-lane": "4.56 6.19 9.84 12.56 12.59 18.89 14.02 5.86 7.58 7.58 8.94 12.59 5.7 8.95 5.7 5.91 12.77 9.34 11.97 12.48 12.81 12.34 12.8 11.28 12.88 12.8 5.7 5.7 12.59 12.59 12.59 10.3 17.84 13.62 12.92 14.06 14.14 11.59 11.11 14.5 14.72 5.34 10.95 13.14 11.05 17.27 14.52 15.02 12.5 15.02 12.92 12.59 12.33 14.38 13.47 19.25 13.59 13.16 12.77 7.58 5.91 7.58 12.59 11.56 9.56 10.89 12.06 10.89 12.06 11.14 7.16 11.95 11.67 4.83 4.81 10.91 4.92 17.47 11.56 11.52 11.98 11.98 7.56 10.34 7.2 11.56 10.67 15.73 10.55 10.86 10.39 7.58 5.03 7.58 12.59 5.7 15.3 8.94 16.44 11.56 17.27 5.7 12.59 17.48 4.56",
    "p-sub": "5.09 6.75 10.23 14.28 14.33 20.08 15.86 6.28 8.19 8.19 9.94 14.33 5.72 10.19 5.72 6.72 14.42 10.56 13.5 14.08 14.44 13.94 14.55 12.86 14.38 14.55 5.72 5.72 14.33 14.33 14.33 11.67 20.44 15.25 14.48 16.11 16.03 13.11 12.55 16.59 16.58 5.73 12.11 14.55 12.47 19.58 16.45 17.17 13.92 17.17 14.41 14.17 13.84 16.34 15.09 21.81 15.22 14.72 14.55 8.19 6.72 8.19 14.33 12.81 11.41 12.16 13.42 12.17 13.41 12.42 7.72 13.3 13.03 5.23 5.22 11.92 5.28 19.34 12.81 12.86 13.31 13.3 7.95 11.41 7.7 12.81 11.78 17.38 11.55 11.92 11.47 8.19 5.44 8.19 14.33 5.72 17.73 9.94 15.95 12.81 19.58 5.72 14.33 20.17 5.09",
    "p-date": "6.06 8.31 12.17 17.62 17.72 23.78 19.42 7.66 9.97 9.97 12.05 17.72 6.66 12.5 6.66 8.42 17.83 13.14 16.58 17.31 17.72 17.14 18 15.94 17.64 18 6.66 6.66 17.72 17.72 17.72 14.5 25 18.7 17.64 19.84 19.59 16.05 15.36 20.36 20.25 7.05 14.84 17.7 15.25 23.95 20.11 21.06 16.94 21.06 17.55 17.36 16.84 20 18.48 26.64 18.64 18.03 17.8 9.97 8.42 9.97 17.72 15.61 14.39 14.88 16.3 14.83 16.3 15.12 9.39 16.17 15.91 6.48 6.45 14.47 6.45 23.44 15.61 15.64 16.19 16.17 9.53 13.89 9.33 15.61 14.33 21.11 14.06 14.5 13.84 9.97 6.67 9.97 17.72 6.66 22.09 12.05 17.8 15.61 23.95 6.66 17.72 25.06 6.06",
}
_TABLES: dict[str, dict[str, float]] = {}


def tw(s: str, style: str, ls: float = 0.0) -> float:
    """Width of s in one of the measured styles, plus letter-spacing after every character."""
    if style not in _TABLES:
        vals = [float(v) for v in _WIDTHS[style].split()]
        _TABLES[style] = dict(zip([chr(c) for c in range(32, 127)] + list(_EXTRA), vals))
    t = _TABLES[style]
    w = 0.0
    for ch in s:
        if ch in t:
            w += t[ch]
        elif ord(ch) >= 0x2E80:          # CJK: one em
            w += _SIZES[style]
        else:                            # anything else: a wide glyph, to stay on the safe side
            w += t["M"]
    return w + ls * len(s)


def wrap(text: str, style: str, width: float, ls: float = 0.0) -> list[str]:
    """Greedy line breaks at spaces, the way a browser wraps a paragraph."""
    lines, cur = [], ""
    for word in text.split():
        cand = f"{cur} {word}" if cur else word
        if not cur or tw(cand, style, ls) <= width:
            cur = cand
        else:
            lines.append(cur)
            cur = word
    return lines + ([cur] if cur else [])


# --------------------------------------------------------------------------- svg helpers
def num(v: float) -> str:
    """A coordinate with at most two decimals, as short as possible."""
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def paint(c, attr="fill") -> str:
    """fill="…" (and fill-opacity) for a colour token."""
    if isinstance(c, tuple):
        return f'{attr}="{c[0]}" {attr}-opacity="{c[1]:g}"'
    return f'{attr}="{c}"'


def stop(off, c, a=1.0) -> str:
    col, alpha = c if isinstance(c, tuple) else (c, 1.0)
    alpha *= a
    return f'<stop offset="{off:g}" stop-color="{col}"' + (f' stop-opacity="{alpha:.3g}"' if alpha != 1 else "") + "/>"


def lin(id_, stops, x1=0, y1=0, x2=1, y2=0, units=None) -> str:
    u = f' gradientUnits="{units}"' if units else ""
    return (f'<linearGradient id="{id_}" x1="{num(x1)}" y1="{num(y1)}" x2="{num(x2)}" y2="{num(y2)}"{u}>'
            + "".join(stop(*s) for s in stops) + "</linearGradient>")


def css_lin(id_, deg, x, y, w, h, stops) -> str:
    """CSS linear-gradient(<deg>) over the box (x, y, w, h), as a user-space SVG gradient."""
    a = math.radians(deg)
    dx, dy = math.sin(a), -math.cos(a)
    half = (abs(w * dx) + abs(h * dy)) / 2
    cx, cy = x + w / 2, y + h / 2
    return lin(id_, stops, cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half, units="userSpaceOnUse")


def css_rad(id_, cx, cy, rx, ry, stops) -> str:
    """CSS radial-gradient(<rx> <ry> at <cx> <cy>, …): an ellipse, as a user-space SVG gradient."""
    return (f'<radialGradient id="{id_}" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" '
            f'gradientTransform="translate({num(cx)} {num(cy)}) scale({num(rx)} {num(ry)})">'
            + "".join(stop(*s) for s in stops) + "</radialGradient>")


def T(x, y, s, size, fill, weight=None, anchor=None, ls=None, extra="") -> str:
    a = [f'x="{num(x)}"', f'y="{num(y)}"', f'font-size="{num(size)}"', paint(fill)]
    if weight:
        a.append(f'font-weight="{weight}"')
    if anchor:
        a.append(f'text-anchor="{anchor}"')
    if ls:
        a.append(f'letter-spacing="{num(ls)}"')
    if extra:
        a.append(extra)
    return f'<text {" ".join(a)}>{escape(s, quote=False)}</text>'


def rrect(x, y, w, h, r, attrs) -> str:
    return f'<rect x="{num(x)}" y="{num(y)}" width="{num(w)}" height="{num(h)}" rx="{num(r)}" {attrs}/>'


def inset_ring(x, y, w, h, r, c) -> str:
    """CSS box-shadow: inset 0 0 0 1px <c>: a 1 px line just inside the box."""
    return rrect(x + .5, y + .5, w - 1, h - 1, max(0, r - .5), f'fill="none" {paint(c, "stroke")}')


def outer_ring(x, y, w, h, r, c) -> str:
    """CSS box-shadow: 0 0 0 1px <c>: a 1 px line just outside the box."""
    return rrect(x - .5, y - .5, w + 1, h + 1, r + .5, f'fill="none" {paint(c, "stroke")}')


_IMG_CACHE: dict[str, str] = {}


def img(name: str) -> str:
    """data: URI for an image in assets/src (an SVG shown as a GitHub image can't load other files)."""
    if name not in _IMG_CACHE:
        path = os.path.join(ROOT, "assets", "src", name)
        mime = "image/png" if name.endswith(".png") else "image/jpeg"
        with open(path, "rb") as f:
            _IMG_CACHE[name] = f"data:{mime};base64," + base64.b64encode(f.read()).decode()
    return _IMG_CACHE[name]


def load(name, default=None):
    path = os.path.join(ROOT, "data", name)
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return default


def motion(rules: str, keyframes: str = "") -> str:
    """A <style> whose animations run only for visitors who have not asked for reduced motion
    (idea #16). SMIL ignores that setting, so every decorative movement (the planets, the seconds
    dot, the live dot, the unlock shimmer, the widget stack and the widgets' small moves) is CSS
    here; only the clock's minute switching stays SMIL. Each animated element also carries the
    transform or value it shows at load, so with motion reduced everything stands still in the
    right place. Keyframes sit outside the media query: they do nothing until a rule names them."""
    if not rules:
        return ""
    return f"<style>{keyframes}@media (prefers-reduced-motion:no-preference){{{rules}}}</style>"


def pct(v: float) -> str:
    """A keyframe offset with four decimals (two would merge the widget stack's 2 ms jumps)."""
    s = f"{v:.4f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def kf(name: str, stops) -> str:
    """@keyframes from [(percent, 'declarations')]."""
    return f"@keyframes {name}{{" + "".join(f"{pct(pc)}%{{{decl}}}" for pc, decl in stops) + "}"


def standalone(w, h, label, defs, body) -> str:
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" '
            f'role="img" aria-label="{escape(label)}" font-family="{SANS}">'
            f'<title>{escape(label, quote=False)}</title><defs>{defs}</defs>{body}</svg>')


def nested(x, y, w, h, defs, body) -> str:
    return f'<svg x="{num(x)}" y="{num(y)}" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><defs>{defs}</defs>{body}</svg>'


def fmt_time(now: dt.datetime):
    h = now.hour % 12 or 12
    return f"{h}:{now.minute:02d}", ("AM" if now.hour < 12 else "PM")


def fmt_date(now: dt.datetime) -> str:
    return f"{now:%A}, {now:%B} {now.day}"


def zone_name(facts) -> str:
    return ZONES.get(facts.get("timezone", ""), "local time")


# --------------------------------------------------------------------------- glyphs
# Line glyphs in a 16 px box (widget headers, chips, links): (markup, stroke width, extra attributes)
ICON16 = {
    "shield": ('<path d="M8 1.8 13 3.6v4c0 3.2-2.2 5.4-5 6.6C5.2 13 3 10.8 3 7.6v-4z"/>'
               '<path d="m5.8 8 1.6 1.6L10.4 6.6" stroke-linecap="round"/>', 1.5, 'stroke-linejoin="round"'),
    "check": ('<circle cx="8" cy="8" r="6.4"/><path d="m5.3 8.2 1.8 1.8 3.6-3.8"/>', 1.7,
              'stroke-linecap="round" stroke-linejoin="round"'),
    "arrow": ('<path d="M5 11 11 5M6 5h5v5"/>', 1.6, 'stroke-linecap="round" stroke-linejoin="round"'),
    "cube": ('<path d="M8 1.6 14 5v6L8 14.4 2 11V5z"/><path d="M2 5l6 3.4L14 5M8 8.4v6"/>', 1.4,
             'stroke-linejoin="round"'),
    "chart": ('<path d="M2.5 13.5h11"/><path d="M4.5 11V8M8 11V4.5M11.5 11V6.5"/>', 1.5, 'stroke-linecap="round"'),
    "spark": ('<path d="M8 1.8c.6 3.3 2.9 5.6 6.2 6.2-3.3.6-5.6 2.9-6.2 6.2-.6-3.3-2.9-5.6-6.2-6.2C5.1 7.4 7.4 5.1 8 1.8z"/>',
              1.4, 'stroke-linejoin="round"'),
    "globe": ('<circle cx="8" cy="8" r="6.2"/><path d="M1.8 8h12.4M8 1.8c1.8 1.8 2.6 3.9 2.6 6.2S9.8 12.4 8 14.2'
              'C6.2 12.4 5.4 10.3 5.4 8S6.2 3.6 8 1.8z"/>', 1.4, ""),
    "wave": ('<path d="M2 6.5v3M5 4v8M8 2.5v11M11 5v6M14 6.5v3"/>', 1.5, 'stroke-linecap="round"'),
    "pin": ('<path d="M8 14.4s4.8-4.3 4.8-8a4.8 4.8 0 1 0-9.6 0c0 3.7 4.8 8 4.8 8z"/><circle cx="8" cy="6.4" r="1.7"/>',
            1.4, ""),
    "in": ('<rect x="1.8" y="1.8" width="12.4" height="12.4" rx="3"/><path d="M5.2 7v4M5.2 4.9v.1M8 11V7m0 1.8'
           'c0-1 .8-1.8 1.8-1.8s1.6.8 1.6 1.8V11" stroke-linecap="round"/>', 1.4, ""),
    "down": ('<path d="m4 6 4 4 4-4"/>', 1.8, 'stroke-linecap="round" stroke-linejoin="round"'),
    "moon": ('<path d="M13.4 9.7A5.9 5.9 0 0 1 6.3 2.6a5.9 5.9 0 1 0 7.1 7.1z"/>', 1.4, 'stroke-linejoin="round"'),
    "mail": ('<rect x="1.8" y="3.2" width="12.4" height="9.6" rx="2.2"/><path d="m2.6 4.6 5.4 4.1 5.4-4.1"/>', 1.4,
             'stroke-linecap="round" stroke-linejoin="round"'),
    "chat": ('<path d="M2.2 4.7c0-1.2.9-2.1 2.1-2.1h7.4c1.2 0 2.1.9 2.1 2.1v4.5c0 1.2-.9 2.1-2.1 2.1H7.3l-3 2.5v-2.5h0'
             'c-1.2 0-2.1-.9-2.1-2.1z"/><path d="M5.4 6.4h5.2M5.4 8.6h3.2"/>', 1.4, 'stroke-linecap="round" stroke-linejoin="round"'),
}


def icon16(name, x, y, size, color) -> str:
    mark, sw, extra = ICON16[name]
    return (f'<g transform="translate({num(x)} {num(y)}) scale({size / 16:g})" fill="none" {paint(color, "stroke")} '
            f'stroke-width="{sw}"{" " + extra if extra else ""}>{mark}</g>')


# App-tile glyphs in a 24 px box, stroked with the indigo -> teal gradient
TILE_GLYPH = {
    "storewright": "M12 3 20.5 7.6v8.8L12 21l-8.5-4.6V7.6z M3.5 7.6 12 12.2l8.5-4.6 M12 12.2V21",
    "site": ("M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M3 12h18 M12 3c2.6 2.5 3.9 5.5 3.9 9s-1.3 6.5-3.9 9"
             "c-2.6-2.5-3.9-5.5-3.9-9S9.4 5.5 12 3z"),
    "vocal": "M3.5 10.5v3 M7 7.5v9 M10.5 4v16 M14 8v8 M17.5 6v12 M21 10.5v3",
    "contact": "M12 11.5a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5z M5.5 19.5c.9-3.4 3.4-5.2 6.5-5.2s5.6 1.8 6.5 5.2",
    "howiwork": "M4 6.8l1.7 1.7L9 5.2 M12 7h8 M4 12.8l1.7 1.7L9 11.2 M12 13h8 M4 18.8l1.7 1.7L9 17.2 M12 19h8",
    "earlywork": ("M3 7.2c0-.9.7-1.7 1.7-1.7h4.6l2.1 2.4h7.9c.9 0 1.7.7 1.7 1.7v8.6c0 .9-.8 1.7-1.7 1.7H4.7"
                  "c-1 0-1.7-.8-1.7-1.7z M3 10.6h18"),
}


# --------------------------------------------------------------------------- cards
def card(m, p, w, h, bare=False, r=16):
    """The card recipe: a 1 px gradient border (160deg), a bg2 -> bg fill and a faint indigo glow
    in the top right corner. Returns (defs, background); content goes in the {p}-clip group.
    A bare card (inside the banner's widget stack, which has its own card) has neither."""
    if bare:
        return f'<clipPath id="{p}-clip"><rect width="{w}" height="{h}"/></clipPath>', ""
    e0, e1, e2 = m["edge"]
    defs = (css_lin(f"{p}-edge", 160, 0, 0, w, h, [(0, e0), (.42, e1), (1, e2)])
            + lin(f"{p}-bg", [(0, m["bg2"]), (1, m["bg"])], 0, 1, 0, h - 1, units="userSpaceOnUse")
            + css_rad(f"{p}-glow", w - 1, 1, 1.3 * (w - 2), h - 2, [(0, m["card_glow"]), (.6, m["card_glow"], 0)])
            + f'<clipPath id="{p}-clip"><rect x="1" y="1" width="{w - 2}" height="{h - 2}" rx="{r - 1}"/></clipPath>')
    bg = (f'<rect width="{w}" height="{h}" rx="{r}" fill="url(#{p}-edge)"/>'
          f'<rect x="1" y="1" width="{w - 2}" height="{h - 2}" rx="{r - 1}" fill="url(#{p}-bg)"/>'
          f'<rect x="1" y="1" width="{w - 2}" height="{h - 2}" rx="{r - 1}" fill="url(#{p}-glow)"/>')
    return defs, bg


def chip(m, x, y, text, accent=False, arrow=False):
    """A pill label (11.5 px / 600, 23 px high). Returns (svg, width)."""
    tw_ = tw(text, "chip")
    w = 9 + tw_ + (5 + 12 if arrow else 0) + 9
    col = m["indigo"] if accent else m["fg"]
    if accent:
        out = rrect(x, y, w, 23, 11.5, f'fill="{m["indigo"]}" fill-opacity=".09"') + inset_ring(x, y, w, 23, 11.5, (m["indigo"], .45))
    else:
        out = rrect(x, y, w, 23, 11.5, paint(m["chip"])) + inset_ring(x, y, w, 23, 11.5, m["line2"])
    out += T(x + 9, y + 16, text, 11.5, col, weight=600)
    if arrow:
        out += icon16("arrow", x + 9 + tw_ + 5, y + 5.5, 12, m["fg2"])
    return out, w


def header(m, icon, title, w, right=None):
    """Widget header: a 16 px line glyph, the title (14 / 600) and a muted note on the right."""
    out = icon16(icon, 17, 18, 16, m["fg2"]) + T(41, 31.5, title, 14, m["fg"], weight=600, ls=-.07)
    if right:
        out += T(w - 17, 30.5, right, 12, m["fg2"], weight=500, anchor="end", extra=TNUM)
    return out


def widget(m, p, w, h, content, bare=False, defs=""):
    cd, bg = card(m, p, w, h, bare)
    return defs + cd, f'{bg}<g clip-path="url(#{p}-clip)">{content}</g>'


# --------------------------------------------------------------------------- widgets
def w_silnest(page, facts, p="sn", store=None, bare=False):
    w, h = 368, 176
    m = MODES[page]
    sn = facts["silnest"]
    version = (store or {}).get("version", sn["version"])
    # the app on the right, rising past the bottom edge, with a soft indigo glow round it
    sx, sy, sw_, sh = 239, 17, 112, 190
    defs = (f'<clipPath id="{p}-shot"><rect x="{sx}" y="{sy}" width="{sw_}" height="{sh}" rx="14"/></clipPath>'
            f'<clipPath id="{p}-ico"><rect x="17" y="18" width="32" height="32" rx="8"/></clipPath>'
            f'<filter id="{p}-haze" x="{sx - 60}" y="{sy - 60}" width="{sw_ + 120}" height="{sh + 120}" '
            f'filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="20"/></filter>')
    ga, _ = m["glow_a"]
    # idea #19: the app rises into place once, as if it had just been opened
    defs += motion(f".{p}-rise{{animation:{p}-rise 1.1s cubic-bezier(.2,.8,.2,1) .25s both}}",
                   kf(f"{p}-rise", [(0, "transform:translate(0px,16px);opacity:.25"), (100, "transform:translate(0px,0px);opacity:1")]))
    c = (f'<g class="{p}-rise">'
         + rrect(sx + 6, sy + 6, sw_ - 12, sh - 12, 8, f'fill="{ga}" fill-opacity=".6" filter="url(#{p}-haze)"')
         + f'<g clip-path="url(#{p}-shot)"><image href="{img("silnest-s1.jpg")}" x="{sx}" y="{sy - 6}" width="{sw_}" '
           f'height="{num(sw_ * 480 / 222)}"/></g>' + outer_ring(sx, sy, sw_, sh, 14, m["line2"]) + "</g>")
    # the app icon, name and what it is
    c += (f'<image href="{img("silnest-icon.jpg")}" x="17" y="18" width="32" height="32" clip-path="url(#{p}-ico)"/>'
          + outer_ring(17, 18, 32, 32, 8, m["line2"])
          + f'<text x="59" y="31.5" font-size="15.5" font-weight="600" letter-spacing="-.155" {paint(m["fg"])}>'
            f'{escape(sn["title"])}<tspan dx="5" font-size="14" font-weight="500" letter-spacing="0" {paint(m["fg2"])}>'
            f'{escape(sn["title_zh"])}</tspan></text>'
          + T(59, 49, sn["sub"], 12, m["fg2"], weight=500))
    c += T(17, 86.5, "Your music, offline.", 21, m["fg"], weight=650, ls=-.42)
    c += icon16("shield", 17, 102, 14, m["teal_text"]) + T(37, 113.5, "Data Not Collected", 12, m["teal_text"], weight=600)
    ch, _ = chip(m, 17, 137, f"App Store · v{version}")
    d, b = widget(m, p, w, h, c + ch, bare, defs)
    label = (f'{sn["title"]} ({sn["title_zh"]}): {sn["sub"].lower()}, live on the App Store, version {version}. '
             f'Data not collected.')
    return w, h, d, b, label


def w_storewright(page, facts, p="sw", bare=False):
    w, h = 368, 176
    m = MODES[page]
    sw = facts["storewright"]
    # the 3D store, cropped like CSS object-fit: cover; object-position: 38% 50%
    ix, iy, iw, ih = 217, 47, 136, 114
    k = max(iw / 620, ih / 429)
    pw, ph = 620 * k, 429 * k
    defs = f'<clipPath id="{p}-pic"><rect x="{ix}" y="{iy}" width="{iw}" height="{ih}" rx="10"/></clipPath>'
    c = (f'<g clip-path="url(#{p}-pic)"><image href="{img("storewright-world-620.jpg")}" x="{num(ix + (iw - pw) * .38)}" '
         f'y="{num(iy + (ih - ph) / 2)}" width="{num(pw)}" height="{num(ph)}"/></g>' + outer_ring(ix, iy, iw, ih, 10, m["line2"]))
    c += header(m, "cube", "Storewright", w, right=f'{sw["release"]} · {sw["month"]}')
    for i, line in enumerate(wrap("A grocery store digital twin that runs in your browser.", "s12.5", 186)[:2]):
        c += T(17, 59 + i * 17.25, line, 12.5, m["fg2"], weight=500)
    big = sw["tests"]
    bw = tw(big, "num30", -.9)
    lx = 17 + bw + 7
    # the check after "tests passing" (icon16 "check"); idea #19: its tick draws itself once
    defs += motion(f".{p}-tick{{stroke-dasharray:8;animation:{p}-tick .7s cubic-bezier(.3,.7,.3,1) 1.1s both}}",
                   kf(f"{p}-tick", [(0, "stroke-dashoffset:8"), (100, "stroke-dashoffset:0")]))
    c += (f'<text x="17" y="126" font-size="30" font-weight="600" letter-spacing="-.9" {paint(m["fg"])} {TNUM}>{escape(big)}'
          f'<tspan dx="7" font-size="12.5" letter-spacing="0" {paint(m["fg2"])}>tests passing</tspan></text>'
          f'<g transform="translate({num(lx + tw("tests passing", "lane") + 5.5)} 108) scale({14 / 16:g})" fill="none" '
          f'stroke="{m["teal"]}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'
          f'<circle cx="8" cy="8" r="6.4"/><path class="{p}-tick" d="m5.3 8.2 1.8 1.8 3.6-3.8"/></g>')
    ch, _ = chip(m, 17, 138, "Live demo", accent=True, arrow=True)
    d, b = widget(m, p, w, h, c + ch, bare, defs)
    label = (f'Storewright: a grocery store digital twin that runs in the browser. {sw["tests"]} tests passing. '
             f'{sw["release"]}, {sw["month"]}. Live demo.')
    return w, h, d, b, label


def spark(points, w, h, pad=2.0):
    """The mock's sparkline geometry in a w x h box: (line, area, peak, vertices)."""
    top = max(points) or 1
    n = len(points)
    pts = [(pad + i * (w - 2 * pad) / (n - 1), h - pad - v / top * (h - 2 * pad)) for i, v in enumerate(points)]
    line = "M" + "L".join(f"{num(x)},{num(y)}" for x, y in pts)
    area = line + f"L{num(pts[-1][0])},{h}L{num(pts[0][0])},{h}Z"
    return line, area, pts[points.index(max(points))], pts


def walk_keyframes(name, pts, walk=70.0, fade=6.0):
    """A dot walking along a polyline at an even speed (idea #19): one keyframe per vertex over
    the first `walk` percent of the cycle, faded in at the start and out at the end. Linear
    timing between vertices keeps it exactly on the line."""
    seg = [math.hypot(x1 - x0, y1 - y0) for (x0, y0), (x1, y1) in zip(pts, pts[1:])]
    total = sum(seg) or 1
    stops, run = [], 0.0
    for i, (x, y) in enumerate(pts):
        if i:
            run += seg[i - 1]
        pc = walk * run / total
        op = "opacity:0;" if i == 0 else ("opacity:1;" if i == len(pts) - 1 else "")
        stops.append((pc, f"{op}transform:translate({num(x)}px,{num(y)}px)"))
    stops.insert(1, (min(fade / 2, stops[1][0] / 2), "opacity:1"))
    x, y = pts[-1]
    stops += [(walk + fade, f"opacity:0;transform:translate({num(x)}px,{num(y)}px)"),
              (100, f"opacity:0;transform:translate({num(x)}px,{num(y)}px)")]
    return kf(name, stops)


def w_store_day(page, facts, day, p="sd", bare=False):
    """A simulated store day (synthetic data from Storewright's open-source simulator, run every
    night with the date as the seed). The header shows the simulated date."""
    w, h = 176, 176
    m = MODES[page]
    d0 = dt.date.fromisoformat(day["date"])
    c = header(m, "chart", "Store day", w, right=f"{d0:%b} {d0.day}")
    by = {i["label"]: i for i in day["headline"]}

    def val(item):
        v = item["value"]
        return f"{v:,}" if isinstance(v, int) else f"{v:g}"

    orders = by.get("Orders fulfilled") or day["headline"][0]
    c += (f'<text x="17" y="68.5" font-size="28" font-weight="600" letter-spacing="-.84" {paint(m["fg2"])} {TNUM}>{val(orders)}'
          f'<tspan dx="6" font-size="11.5" letter-spacing="0">{escape(orders["label"].lower())}</tspan></text>')
    pts = day["series"]["points"]
    css = ""
    if len(pts) > 1:
        line, area, (px, py), verts = spark(pts, 142, 24)
        # idea #19: a small dot walks along the day's line every nine seconds (hidden when still)
        css = motion(f".{p}-walk{{animation:{p}-walk 9s linear 1s infinite both}}", walk_keyframes(f"{p}-walk", verts))
        c += (f'<g transform="translate(17 74)"><path d="{area}" fill="url(#{p}-sa)"/>'
              f'<path d="{line}" fill="none" stroke="{m["teal"]}" stroke-width="1.6" stroke-linejoin="round"/>'
              f'<circle cx="{num(px)}" cy="{num(py)}" r="2.6" fill="{m["teal"]}"/>'
              f'<g class="{p}-walk" opacity="0"><circle r="5" fill="{m["teal"]}" fill-opacity=".22"/>'
              f'<circle r="2.1" fill="{m["fg"]}"/></g></g>')
    rows = [r for r in (by.get("Avg pickup wait"), by.get("Ready on time")) if r] or day["headline"][1:3]
    for i, item in enumerate(rows[:2]):
        y = 115.5 + i * 18
        unit = item.get("unit", "")
        c += (f'<text x="17" y="{y}" font-size="13" font-weight="700" letter-spacing="-.13" {paint(m["fg"])} {TNUM}>{val(item)}'
              + (f'<tspan dx="2" font-size="11" font-weight="600" letter-spacing="0" {paint(m["fg2"])}>{escape(unit)}</tspan>' if unit else "")
              + "</text>" + T(159, y, item["label"][0].lower() + item["label"][1:], 11.5, m["fg2"], weight=500, anchor="end"))
    tag_w = 5 + tw("SIM", "tag", .6) + 5
    c += (rrect(17, 147, tag_w, 16, 5, 'fill="none"') + inset_ring(17, 147, tag_w, 16, 5, m["line2"])
          + T(22, 159, "SIM", 10, m["fg2"], weight=700, ls=.6)
          + T(17 + tag_w + 6, 159.5, "synthetic data", 10.5, m["fg3"], weight=600, ls=.21))
    defs = lin(f"{p}-sa", [(0, m["teal"], .32), (1, m["teal"], 0)], 0, 0, 0, 1) + css
    dd, b = widget(m, p, w, h, c, bare, defs)
    label = (f"Simulated store day, {d0:%b} {d0.day} (synthetic data from Storewright's open-source simulator): "
             + "; ".join(f'{i["label"]} {val(i)}{(" " + i["unit"]) if i.get("unit") else ""}' for i in [orders] + rows[:2]) + ".")
    return w, h, dd, b, label


def assistant_names(ac):
    """('Duty assistant', 'Storewright part 3', 'StoreX Chain') from the facts."""
    name = ac.get("name", "Duty assistant")
    part = ac.get("part", "")
    short, alias = part, ""
    if part.endswith(")") and " (" in part:
        short, alias = part[:-1].split(" (", 1)
    return name, short, alias


def assistant_label(ac):
    name, short, alias = assistant_names(ac)
    who = f"{alias} {name[0].lower()}{name[1:]}" if alias else name
    return (f'{who}{f" ({short})" if short else ""}: {ac["score"]:g}% vs {ac["baseline"]:g}% '
            f'for keyword rules on an {ac["set"]}.')


def w_accuracy(page, facts, p="ac", bare=False):
    """The duty assistant of Storewright's part 3 against keyword rules, on its held-out set."""
    w, h = 176, 176
    m = MODES[page]
    ac = facts["assistant"]
    name, short, _alias = assistant_names(ac)
    score, base = f'{ac["score"]:g}%', f'{ac["baseline"]:g}%'
    sw_ = tw(score, "num30", -.9) * 31 / 30
    defs = (lin(f"{p}-num", [(0, m["indigo"]), (1, m["violet"])], 17, 0, 17 + sw_, 0, units="userSpaceOnUse")
            + lin(f"{p}-bar", [(0, m["indigo"]), (1, m["violet"])])
            # idea #19: both bars grow from the left once, the assistant's first
            + motion(f".{p}-grow{{transform-origin:17px 0;animation:{p}-grow 1.3s cubic-bezier(.2,.8,.2,1) .35s both}}"
                     f".{p}-grow2{{animation-delay:.6s}}",
                     kf(f"{p}-grow", [(0, "transform:scaleX(0)"), (100, "transform:scaleX(1)")])))
    c = header(m, "spark", name, w)
    c += (f'<text x="17" y="73" font-size="31" font-weight="600" letter-spacing="-.93" fill="url(#{p}-num)" {TNUM}>{score}'
          f'<tspan dx="6" font-size="11.5" letter-spacing="0" {paint(m["fg2"])}>AI</tspan></text>'
          + rrect(17, 83, 142, 4, 2, paint(m["track"]))
          + rrect(17, 83, 142 * ac["score"] / 100, 4, 2, f'fill="url(#{p}-bar)" class="{p}-grow"'))
    c += (f'<text x="17" y="110.5" font-size="15" font-weight="700" letter-spacing="-.15" {paint(m["fg2"])} {TNUM}>{base}'
          f'<tspan dx="6" font-size="11.5" font-weight="600" letter-spacing="0">keyword rules</tspan></text>'
          + rrect(17, 120, 142, 4, 2, paint(m["track"]))
          + rrect(17, 120, 142 * ac["baseline"] / 100, 4, 2, paint(m["fg3"]) + f' class="{p}-grow {p}-grow2"'))
    c += T(17, 145.66, short, 10.5, m["fg3"], weight=600) + T(17, 159.83, ac["set"], 10.5, m["fg3"], weight=600)
    d, b = widget(m, p, w, h, c, bare, defs)
    return w, h, d, b, assistant_label(ac)


def w_site(page, facts, p="ws", bare=False):
    w, h = 368, 176
    m = MODES[page]
    st = facts["site"]
    # a small browser window with the site's front page
    bx, by_, bw, bh = 181, 15, 172, 146
    defs = f'<clipPath id="{p}-win"><rect x="{bx}" y="{by_}" width="{bw}" height="{bh}" rx="10"/></clipPath>'
    c = (f'<g clip-path="url(#{p}-win)"><rect x="{bx}" y="{by_}" width="{bw}" height="{bh}" fill="#0b0d14"/>'
         f'<image href="{img("site-home-620.jpg")}" x="{bx}" y="{by_ + 18}" width="{bw}" height="{num(bw * 430 / 620)}"/>'
         f'<rect x="{bx}" y="{by_}" width="{bw}" height="17" fill="{m["browser_bar"]}"/>'
         f'<rect x="{bx}" y="{by_ + 17}" width="{bw}" height="1" {paint(m["line"])}/>'
         + "".join(f'<circle cx="{bx + 9.5 + i * 9}" cy="{by_ + 8.5}" r="2.5" fill="{m["fg3"]}" fill-opacity=".55"/>' for i in range(3))
         + T(bx + 42, by_ + 11.5, st["domain"], 8.5, m["fg2"], weight=600) + "</g>"
         + outer_ring(bx, by_, bw, bh, 10, m["line2"]))
    c += header(m, "globe", "Portfolio", w)
    c += T(17, 132.5, st["domain"], 22, m["fg"], weight=700, ls=-.55) + T(17, 156.5, "My own Git-backed CMS", 12.5, m["fg2"], weight=500)
    d, b = widget(m, p, w, h, c, bare, defs)
    label = f'{st["domain"]}: my portfolio, on a Git-backed CMS I built. Online since {st["since"]}.'
    return w, h, d, b, label


VOCAL_BARS = [8, 14, 24, 18, 30, 22, 36, 28, 20, 30, 38, 28, 20, 32, 24, 16, 26, 18, 12, 18, 10, 6]


def w_vocal(page, facts, p="vo", bare=False):
    w, h = 176, 176
    m = MODES[page]
    vo = facts["vocal"]
    defs = lin(f"{p}-wave", [(0, m["violet"]), (1, m["teal"])], 17, 0, 161, 0, units="userSpaceOnUse")
    # idea #19: the waveform moves, each bar at its own pace round the middle line (y 70)
    defs += motion(f".{p}-w rect{{transform-origin:0 70px;animation:{p}-bob 1.1s ease-in-out infinite alternate}}"
                   f".{p}-w rect:nth-child(3n+2){{animation-duration:1.45s;animation-delay:-.5s}}"
                   f".{p}-w rect:nth-child(3n){{animation-duration:.9s;animation-delay:-.25s}}"
                   f".{p}-w rect:nth-child(4n){{animation-delay:-.8s}}",
                   kf(f"{p}-bob", [(0, "transform:scaleY(1)"), (100, "transform:scaleY(.45)")]))
    c = header(m, "wave", "AI Vocal", w)
    c += f'<g class="{p}-w" fill="url(#{p}-wave)">' + "".join(
        f'<rect x="{num(17 + i * 6.62 + .4)}" y="{num(70 - hh / 2)}" width="3.4" height="{hh}" rx="1.7"/>'
        for i, hh in enumerate(VOCAL_BARS)) + "</g>"
    # the status, then what it is, sitting on the bottom edge like the mock's flex column
    s2 = wrap("local voice & singing studio", "s11", 142)
    s1 = wrap(vo["status"], "s13.5", 142, -.135)
    top2 = 160 - len(s2) * 14.3
    top1 = top2 - 3 - len(s1) * 16.2
    c += "".join(T(17, top1 + 13 + i * 16.2, s, 13.5, m["fg"], weight=650, ls=-.135) for i, s in enumerate(s1))
    c += "".join(T(17, top2 + 11 + i * 14.3, s, 11, m["fg2"], weight=500) for i, s in enumerate(s2))
    d, b = widget(m, p, w, h, c, bare, defs)
    label = f'AI Vocal, a personal local voice and singing studio: {vo["status"].lower()}.'
    return w, h, d, b, label


def w_contact(page, facts, p="ct", bare=False):
    w, h = 176, 176
    m = MODES[page]
    lk = facts["links"]
    c = header(m, "pin", "Contact", w)
    c += T(17, 67.5, facts["city"], 20, m["fg"], weight=700, ls=-.4) + T(17, 84.5, zone_name(facts), 11.5, m["fg2"], weight=500)
    for i, (icon, text) in enumerate([("in", lk["linkedin_short"]), ("globe", facts["site"]["domain"])]):
        y = 111 + i * 26
        c += (f'<rect x="17" y="{y}" width="142" height="1" {paint(m["line"])}/>' + icon16(icon, 17, y + 6.5, 14, m["fg2"])
              + T(39, y + 18.5, text, 12.5, m["fg"], weight=600) + T(159, y + 18, "↗", 12, m["fg3"], weight=600, anchor="end"))
    d, b = widget(m, p, w, h, c, bare)
    label = f'{facts["city"]}, {zone_name(facts)}. LinkedIn {lk["linkedin_short"]}, {facts["site"]["domain"]}.'
    return w, h, d, b, label


SKY_WHEN = {"evening": 0, "night": 1, "morning": 2}


def sky_planet_line(pl, tn, tz):
    """'best 8:54 PM · S', 'rises 11:16 PM' or 'before dawn · SE' for a planet tonight."""
    d = (pl.get("dir") or {}).get("en", "")
    if pl["when"] == "evening":
        return f"evening · {d}" if d else "evening"
    if pl["when"] == "morning":
        rise, sunset = pl.get("rise"), tn.get("sunset")
        if rise and sunset:
            day = dt.datetime.fromtimestamp(sunset["ms"] / 1000, ZoneInfo(tz))
            midnight = dt.datetime(day.year, day.month, day.day, tzinfo=ZoneInfo(tz)) + dt.timedelta(days=1)
            if sunset["ms"] < rise["ms"] < midnight.timestamp() * 1000:
                return f'rises {rise["en"]}'
        return f"before dawn · {d}" if d else "before dawn"
    best = pl.get("best")
    return " · ".join(x for x in ((f'best {best["en"]}' if best else ""), d) if x)


def w_sky(page, facts, sky, p="sk", bare=False):
    """Tonight's sky over Albany, from data/sky-day.json (scripts/sky_day.mjs, every night):
    the Moon's phase, sunset and dark, up to three naked-eye planets with when and where, and a
    small dome of the sky at chart.at (north up, east on the left, as if held overhead)."""
    w, h = 368, 176
    m = MODES[page]
    tn, chart = sky["tonight"], sky.get("chart") or {}
    tz = (sky.get("place") or {}).get("tz", facts["timezone"])
    city = facts["city"].split(",")[0]
    d0 = dt.date.fromisoformat(sky["date"])
    c = header(m, "moon", f"Tonight in {city}", w, right=f"{d0:%b} {d0.day}")
    # the Moon (on the Mid-Autumn Festival with a soft glow round it, idea #150)
    mo = tn["moon"]
    pct = round(mo["illum"] * 100)
    when = (f'sets {mo["set"]["en"]}' if mo.get("set") else f'rises {mo["rise"]["en"]}' if mo.get("rise") else "")
    glow_defs, glow = "", ""
    if festival_on(d0) == "mid-autumn":
        col, op = MOON_GLOW[m["page"]]
        glow_defs = f'<filter id="{p}-mg" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="5"/></filter>'
        glow = f'<circle cx="29" cy="66" r="15" fill="{col}" opacity="{op:g}" filter="url(#{p}-mg)"/>'
    c += (glow + f'<g transform="translate(29 66)">{moon_disc(m, 11, moon_phase_path(0, 0, 1, mo["illum"], mo["waxing"]), .7)}</g>'
          + T(48, 62.5, mo["name"]["en"], 13.5, m["fg"], weight=650, ls=-.135)
          + T(48, 79, f"{pct}% lit" + (f" · {when}" if when else ""), 11.5, m["fg2"], weight=500))
    # the Sun
    sunset, dark = tn.get("sunset"), tn.get("astroDusk")
    sun_line = " · ".join(x for x in ((f'Sunset {sunset["en"]}' if sunset else ""), (f'dark by {dark["en"]}' if dark else "")) if x)
    c += T(17, 102, sun_line, 12, m["fg2"], weight=500)
    # planets you can see without a telescope: evening first, then the brightest
    seen = sorted((pl for pl in tn["planets"] if pl.get("visible") and pl.get("naked")),
                  key=lambda pl: (SKY_WHEN.get(pl["when"], 3), pl.get("mag", 9)))[:3]
    colour = {n.lower(): (dc if m["page"] == "dark" else lc) for n, _r, dc, lc in PLANETS}
    lines = []
    for k, pl in enumerate(seen):
        y = 122.5 + k * 18
        detail = sky_planet_line(pl, tn, tz)
        lines.append(f'{pl["name"].capitalize()} {detail}')
        c += (f'<circle cx="21" cy="{num(y - 4)}" r="3" fill="{colour.get(pl["name"], m["fg2"])}"/>'
              f'<text x="30" y="{y}" font-size="12.5" font-weight="600" {paint(m["fg"])}>{escape(pl["name"].capitalize())}'
              f'<tspan dx="6" font-size="11.5" font-weight="500" {paint(m["fg2"])}>{escape(detail)}</tspan></text>')
    if not seen:
        c += T(17, 126, "No bright planets up tonight", 12, m["fg2"], weight=500)
    # the dome: zenith in the middle, horizon round the edge
    cx, cy, R = 298, 103, 52
    defs = (f'<radialGradient id="{p}-dome">' + stop(0, m["bg2"]) + stop(1, m["indigo"], .1 if m["page"] == "dark" else .07)
            + "</radialGradient>")
    c += (f'<circle cx="{cx}" cy="{cy}" r="{R}" fill="url(#{p}-dome)"/>'
          + "".join(f'<circle cx="{cx}" cy="{cy}" r="{num(R * k)}" fill="none" {paint(m["line"], "stroke")}/>' for k in (1 / 3, 2 / 3))
          + f'<circle cx="{cx}" cy="{cy}" r="{R - .5}" fill="none" {paint(m["line2"], "stroke")}/>'
          + "".join(T(cx + dx, cy + dy + 3, t, 8, m["fg3"], weight=600, anchor="middle")
                    for t, dx, dy in (("N", 0, -R + 8), ("S", 0, R - 8), ("E", -R + 8, 0), ("W", R - 8, 0))))

    def at(alt, az):
        rho = R * (90 - alt) / 90
        return cx - rho * math.sin(math.radians(az)), cy - rho * math.cos(math.radians(az))
    # idea #19: the three brightest stars twinkle, slowly and out of step
    defs += glow_defs + motion(f".{p}-tw{{animation:{p}-tw 3.6s ease-in-out infinite alternate}}"
                               f".{p}-tw1{{animation-duration:4.4s;animation-delay:-1.3s}}"
                               f".{p}-tw2{{animation-duration:5.2s;animation-delay:-2.9s}}",
                               kf(f"{p}-tw", [(0, "opacity:1"), (100, "opacity:.35")]))
    shown = [st for st in chart.get("stars", []) if st["alt"] > 0]
    for k, st in enumerate(shown):
        x, y = at(st["alt"], st["az"])
        cls = f' class="{p}-tw{"" if k == 0 else f" {p}-tw{k}"}"' if k < 3 else ""
        c += f'<circle cx="{num(x)}" cy="{num(y)}" r="{num(max(.6, 1.25 - .3 * st["mag"]))}" fill="{m["fg"]}" fill-opacity=".7"{cls}/>'
    # the Moon and the planets you can see without a telescope (the same ones the list uses)
    naked = {pl["name"] for pl in tn["planets"] if pl.get("naked")}
    labels = []
    cm = chart.get("moon")
    if cm and cm["alt"] > 0:
        x, y = at(cm["alt"], cm["az"])
        c += f'<g transform="translate({num(x)} {num(y)})">{moon_disc(m, 4, moon_phase_path(0, 0, 1, cm["illum"], cm["waxing"]), .5)}</g>'
        labels.append((x, y, 5.5, "Moon"))
    for pl in sorted(chart.get("planets", []), key=lambda q: q.get("mag", 9)):
        if pl["alt"] > 0 and pl["name"] in naked:
            x, y = at(pl["alt"], pl["az"])
            c += f'<circle cx="{num(x)}" cy="{num(y)}" r="2.6" fill="{colour.get(pl["name"], m["fg"])}"/>'
            labels.append((x, y, 4.5, pl["name"].capitalize()))
    # each label goes right, left, below or above its body, inside the dome, clear of the others
    boxes = [(cx + dx - 4, cy + dy - 4, cx + dx + 4, cy + dy + 4) for dx, dy in ((0, -R + 8), (0, R - 8), (-R + 8, 0), (R - 8, 0))]
    for x, y, gap, t in labels:
        lw = len(t) * 4.6
        for lx, ly in ((x + gap, y + 2.5), (x - gap - lw, y + 2.5), (x - lw / 2, y + gap + 7), (x - lw / 2, y - gap - 1)):
            box = (lx, ly - 7, lx + lw, ly + 1)
            inside = math.hypot(max(abs(box[0] - cx), abs(box[2] - cx)), max(abs(box[1] - cy), abs(box[3] - cy))) < R - 1
            if inside and not any(box[0] < b[2] and box[2] > b[0] and box[1] < b[3] and box[3] > b[1] for b in boxes):
                boxes.append(box)
                c += T(lx, ly, t, 8, m["fg2"], weight=600)
                break
    if chart.get("at"):
        c += T(cx, 169, f'sky at {chart["at"]["en"]}', 9, m["fg3"], weight=600, anchor="middle")
    d, b = widget(m, p, w, h, c, bare, defs)
    label = (f'Tonight in {facts["city"]}: {mo["name"]["en"]} Moon, {pct}% lit' + (f", {when}" if when else "")
             + (f". {sun_line}" if sun_line else "") + ". "
             + ("; ".join(lines) if lines else "No bright planets up tonight") + ".")
    return w, h, d, b, label


def widget_set(page, facts, day=None, store=None, bare=False, sky=None):
    """The sideways row, in order. Returns [(key, (w, h, defs, body, label))]."""
    out = [("silnest", w_silnest(page, facts, store=store, bare=bare)),
           ("storewright", w_storewright(page, facts, bare=bare))]
    if day:
        out.append(("store-day", w_store_day(page, facts, day, bare=bare)))
    out += [("accuracy", w_accuracy(page, facts, bare=bare)), ("site", w_site(page, facts, bare=bare)),
            ("vocal", w_vocal(page, facts, bare=bare))]
    if sky and sky.get("tonight"):
        out.append(("sky", w_sky(page, facts, sky, bare=bare)))
    out.append(("contact", w_contact(page, facts, bare=bare)))
    return out


def strip(widgets, gap=14):
    """All widgets side by side in one wide image (an alternative to one image per widget)."""
    x, body = 0, ""
    hmax = max(wd[1] for _, wd in widgets)
    for _, (w, h, d, b, _l) in widgets:
        body += nested(x, 0, w, h, d, b)
        x += w + gap
    return standalone(int(x - gap), hmax, "Widgets: " + " | ".join(wd[4] for _, wd in widgets), "", body)


def stack_pages(widgets):
    """Medium widgets are one page each; small ones are paired side by side."""
    pages, pending = [], []
    for k, wd in widgets:
        if wd[0] >= 300:
            pages.append([(k, wd)])
        else:
            pending.append((k, wd))
            if len(pending) == 2:
                pages.append(pending)
                pending = []
    if pending:
        pages.append(pending)
    return pages


def widget_stack(m, widgets, x, y, p="st", hold=4.0, move=.7):
    """A self-advancing stack for the banner (layout 'right'): one card; inside it each page
    slides up in turn, with page dots on the right. The widgets come in bare."""
    pages = stack_pages(widgets)
    n = len(pages)
    step = hold + move
    cycle = n * step
    eps = 0.002
    cd, bg = card(m, p, 368, 176)
    rules, frames = "", ""
    ease = "animation-timing-function:cubic-bezier(.4,0,.2,1)"
    step1 = "animation-timing-function:steps(1,end)"
    body = f'<g transform="translate({x} {y})">{bg}<g clip-path="url(#{p}-clip)">'
    for i, page in enumerate(pages):
        if i == 0:
            pts = [(0, 0), (hold, 0), (step, -190), (step + eps, 190), (cycle - move, 190), (cycle, 0)]
        else:
            enter = i * step - move
            pts = [(0, 190), (enter, 190), (i * step, 0), (i * step + hold, 0), ((i + 1) * step, -190)]
            if (i + 1) * step + eps < cycle:
                pts += [((i + 1) * step + eps, 190), (cycle, 190)]
        frames += kf(f"{p}-pg{i}", [(100 * tt / cycle, f"transform:translate(0px,{v}px);{ease}") for tt, v in pts])
        rules += f".{p}-pg{i}{{animation:{p}-pg{i} {cycle:.1f}s infinite}}"
        inner, cx = "", 0
        for k, (w, h, d, b, _l) in page:
            inner += nested(cx, 0, w, h, d, b)
            cx += w + 16
        if len(page) == 2:
            inner += f'<rect x="183.5" y="16" width="1" height="144" {paint(m["line"])}/>'
        body += f'<g class="{p}-pg{i}" transform="translate(0 {0 if i == 0 else 190})">{inner}</g>'
    body += "</g></g>"
    for i in range(n):
        cy = y + 88 - (n - 1) * 6 + i * 12
        on, off = (i * step - move / 2) / cycle, ((i + 1) * step - move / 2) / cycle
        if i == 0:
            stops = [(0, 1), (off, .3), ((cycle - move / 2) / cycle, 1), (1, 1)]
        else:
            stops = [(0, .3), (on, 1), (min(off, .9999), .3), (1, .3)]
        frames += kf(f"{p}-d{i}", [(100 * t_, f"fill-opacity:{v:g};{step1}") for t_, v in stops])
        rules += f".{p}-d{i}{{animation:{p}-d{i} {cycle:.1f}s infinite}}"
        body += f'<circle class="{p}-d{i}" cx="{x + 386}" cy="{cy}" r="3" fill="{m["fg"]}" fill-opacity="{1 if i == 0 else .3}"/>'
    return cd + motion(rules, frames), body


# --------------------------------------------------------------------------- banner
W, H = 1000, 320                 # landscape banner
PW, PH = 600, 760                # portrait banner (phones)
# A small solar system round my avatar (spec R3.1): the rings of Mercury to Neptune as
# (rx, ry, rotation). pages/build.py uses the same ORBITS. Every planet turns counter-clockwise
# (prograde, seen from above) once per PERIODS seconds, phased by Unix time, (t mod P) / P, so
# everyone looking at the same moment sees the same sky. The planets don't keep the time any
# more; a dot round the avatar ticks Albany's seconds.
ORBITS = [(52, 18, -9), (72, 25, -9), (93, 32, -9), (114, 39, -9),
          (138, 48, -9), (162, 56, -9), (187, 65, -9), (212, 73, -9)]
PERIODS = [12, 18, 26, 36, 50, 66, 86, 110]   # seconds per orbit, Mercury -> Neptune
# name, radius, colour on dark pages, colour on light pages (muted, so the Dusk palette leads)
PLANETS = [("Mercury", 2.4, "#b9b4ae", "#7d7771"), ("Venus", 3.4, "#f2d3a2", "#b8823d"),
           ("Earth", 3.6, "#59c3ff", "#1580c9"), ("Mars", 3.0, "#ff8f6b", "#d0532f"),
           ("Jupiter", 7.0, "#e8c49c", "#a8763f"), ("Saturn", 6.0, "#f0d48a", "#b48d2e"),
           ("Uranus", 4.6, "#8be6e0", "#1f9c95"), ("Neptune", 4.4, "#8d98ff", "#4f55d8")]
AVATAR_R = 34          # my avatar is the sun
SECONDS_R = 38         # the seconds dot runs round its edge
TRAIL_DEG = 30         # a short, faint trail behind each planet
MOON_R, MOON_DIST = 1.9, 8   # the Moon rides beside Earth, 8 px away on screen
# the Moon's lit side, dark side and outline, per page mode
MOON = {"dark": ("#e9ecf2", ("#2a3040", 1), ("#ffffff", .3)),
        "light": ("#ffffff", ("#8b93a6", .55), ("#0a0c14", .42))}
# idea #150: on the Mid-Autumn Festival the Moon gets a soft glow (colour, opacity per page mode)
MOON_GLOW = {"dark": ("#fff1c9", .55), "light": ("#f2b544", .4)}

# Idea #97: the "sun" glow behind my avatar takes the colour of Albany's sky. Its core colour
# follows the Sun's real altitude there: (below this altitude in degrees, colour on dark pages,
# colour on light pages); the last row is for anything higher. Night is a faint violet, the
# twilight a dusky rose, sunrise and sunset a warm orange, the day a white gold. Only the core
# changes (most of it sits behind the avatar), so the Dusk palette still leads. The live banner
# works the altitude out per request (renderLive in live/lockscreen-core.mjs, slot {{SUN:…}}),
# the daily image at the time it is drawn (data/sky-day.json "sun").
SUN_TIERS = [(-12, "#c4b5fd", "#a78bfa"),
             (-1, "#f5b4c8", "#ec8fb0"),
             (10, "#ffb37a", "#ff9a4d"),
             (None, "#fff0c9", "#ffc85c")]
SUN_DEFAULT = {"dark": "#ffd6a0", "light": "#ffb46b"}   # when the altitude is not known
ALBANY = {"lat": 42.6526, "lon": -73.7562}               # the same place as scripts/sky_day.mjs


def sun_core(m, alt=None, template=False):
    """The sun glow's core colour for a solar altitude, or the {{SUN:…}} slot for renderLive:
    {{SUN:<default>;<limit>,<colour>;…;<colour above the last limit>}}."""
    k = 1 if m["page"] == "dark" else 2
    if template:
        tiers = ";".join(f"{row[0]},{row[k]}" for row in SUN_TIERS[:-1])
        return "{{SUN:" + f"{SUN_DEFAULT[m['page']]};{tiers};{SUN_TIERS[-1][k]}" + "}}"
    if alt is None:
        return SUN_DEFAULT[m["page"]]
    for row in SUN_TIERS:
        if row[0] is None or alt < row[0]:
            return row[k]
    return SUN_TIERS[-1][k]


# Idea #150: what the date line says on a festival (new-year: a small firework after the date;
# spring-festival: a greeting). The live banner gets the same look through clock_meta()["fest"].
FESTIVE = {"spring-festival": " · Happy Lunar New Year", "new-year": " ✺"}

# The left column, as laid out in the mock (baselines). Portrait is the same column, larger.
GEO = {
    "land": dict(pill=(58, 40), pill_style="pill", pill_h=28, pill_size=13, date=(59, 109.5), date_size=18,
                 clock=(54, 207.5), clock_size=118, ap_size=26, ap_dx=12, name=(59, 251), name_size=19,
                 zh_size=18, zh_dx=8, sub=(59, 276), sub_size=14.5, sub_style=None, sub_lead=0),
    "port": dict(pill=(44, 40), pill_style="p-pill", pill_h=44, pill_size=21, date=(46, 138), date_size=28,
                 clock=(39, 262), clock_size=150, ap_size=33, ap_dx=15, name=(46, 324), name_size=30,
                 zh_size=28, zh_dx=12, sub=(46, 362), sub_size=23, sub_style="p-sub", sub_lead=31),
}
# AM/PM after the time: the live function (live/lockscreen-core.mjs) gets this as meta
AMPM = {"land": dict(apSize=26, apWeight=600, apSpacing=0, apDx=12),
        "port": dict(apSize=33, apWeight=600, apSpacing=0, apDx=15)}


def clock_meta(page, layout):
    """How renderLive() draws the AM/PM label, the weather (after the date, in fg2) and a
    festival's touch after the date (idea #150; smaller in the portrait banner, which is narrow)."""
    m = MODES[page]
    port = layout == "portrait"
    fest = {k: {"text": t, "fill": m["violet"], **({"size": 21} if port and k == "spring-festival" else {})}
            for k, t in FESTIVE.items()}
    return {"muted": m["fg2"], "wxWeight": 500, "wxSep": " · ", "fest": fest, **AMPM["port" if port else "land"]}


def fest_tspan(key, meta):
    """The festival's tspan after the date. Must match festTspan() in live/lockscreen-core.mjs."""
    f = (meta.get("fest") or {}).get(key)
    if not f:
        return ""
    size = f' font-size="{f["size"]}"' if f.get("size") else ""
    return f'<tspan fill="{f["fill"]}"{size}>{escape(f["text"], quote=False)}</tspan>'


def ampm_tspan(ap, meta):
    """Must match renderLive() in live/lockscreen-core.mjs."""
    return (f'<tspan font-size="{meta["apSize"]}" font-weight="{meta["apWeight"]}" letter-spacing="{meta["apSpacing"]}" '
            f'dx="{meta["apDx"]}" fill="{meta["muted"]}">{ap}</tspan>')


def ellipse_d(rx, ry, rot, half=None):
    """A ring as SVG arcs round (0, 0): the full ellipse, or its near (lower) half only."""
    def at(deg):  # clockwise from 12 o'clock, on the tilted ellipse
        a, r = math.radians(deg), math.radians(rot)
        x, y = rx * math.sin(a), -ry * math.cos(a)
        return x * math.cos(r) - y * math.sin(r), x * math.sin(r) + y * math.cos(r)
    (lx, ly), (rx_, ry_) = at(270), at(90)
    arc = f"A{rx},{ry} {rot} 0,1"
    if half == "near":
        return f"M{num(rx_)},{num(ry_)}{arc} {num(lx)},{num(ly)}"
    return f"M{num(lx)},{num(ly)}{arc} {num(rx_)},{num(ry_)}{arc} {num(lx)},{num(ly)}Z"


def sky_at(now):
    """Planet longitudes and the Moon at `now`, from live/astro.mjs through scripts/sky_day.mjs
    (Node). Only static previews need this; the daily images read data/sky-day.json and the live
    function computes its own. Returns None if Node isn't there."""
    key = now.timestamp()
    if key in _SKY_CACHE:
        return _SKY_CACHE[key]
    sky = None
    if shutil.which("node"):
        with tempfile.TemporaryDirectory() as tmp:
            out = os.path.join(tmp, "sky.json")
            r = subprocess.run(["node", os.path.join(ROOT, "scripts", "sky_day.mjs"), "--at", now.isoformat(), "--out", out],
                               capture_output=True, text=True)
            if r.returncode == 0:
                with open(out, encoding="utf-8") as f:
                    sky = json.load(f)
    _SKY_CACHE[key] = sky
    return sky


_SKY_CACHE: dict = {}


def orbit_timing(mode, now, sky=None):
    """When the banner loads, each planet sits at its real heliocentric longitude λ, then turns
    counter-clockwise at its PERIODS speed (only the start is real). The screen convention, shared
    with Pages: plane angle θ = λ, point (rx·cos θ, -ry·sin θ) before the -9° tilt, so λ 0 is on
    the right, 90 the far side and 270 the near side. A planet's turn starts at 12 o'clock, so it
    begins (λ - 90)/360 of a period in: that angle is its transform at load (where it stays when
    motion is reduced) and, as a negative animation-delay, where its CSS turn starts.
      template: {{ORBIT:i:P}} (the delay), {{ORBIT_DEG:i}} (the angle), {{MOON_KF:ROT|UNROT:rx:ry:tilt}}
                (keyframes), {{MOON_DEG:ROT|UNROT:…}} (the Moon's angle at load), {{MOON_PATH}},
                {{BEGIN_SEC}} and {{SEC_DEG}}, filled by renderLive() from the request time;
      static: λ at --at; daily: data/sky-day.json.
    The Moon rides round Earth in the direction λ_E + 180° + E (E = Moon - Sun elongation): new
    Moon towards the avatar, full away from it, first quarter trailing, last quarter leading.
    Returns (planets [(period, delay, angle)], moon {rot0, unrot0, rot, unrot, path} or None,
    seconds dot (delay, angle)); rot and unrot are keyframe lists."""
    rx, ry, tilt = ORBITS[2]
    if mode == "template":
        slot = f"{rx}:{ry}:{tilt}"
        return ([(P, "{{ORBIT:%d:%d}}" % (i, P), "{{ORBIT_DEG:%d}}" % i) for i, P in enumerate(PERIODS)],
                {"rot0": "{{MOON_DEG:ROT:%s}}" % slot, "unrot0": "{{MOON_DEG:UNROT:%s}}" % slot,
                 "rot": "{{MOON_KF:ROT:%s}}" % slot, "unrot": "{{MOON_KF:UNROT:%s}}" % slot, "path": "{{MOON_PATH}}"},
                ("{{BEGIN_SEC}}", "{{SEC_DEG}}"))
    if mode == "static" and now is not None:
        s = now.second + now.microsecond / 1e6
        seconds = (f"-{s:g}s", num(6 * s))
    else:
        seconds = ("0s", "0")
    if sky and sky.get("planets"):
        lons = [pl["lon"] for pl in sky["planets"]]
        planets = []
        for P, lon in zip(PERIODS, lons):
            lead = round(P * ((lon - 90) % 360) / 360, 2)       # seconds into its turn; the angle follows from it
            planets.append((P, f"-{lead:.2f}s", num(360 * lead / P)))
        mo = sky.get("moon")
        moon = None
        if mo:
            keys = moon_keys(lons[2], mo["elong"], rx, ry, tilt)
            moon = {"rot0": num(keys[0]), "unrot0": num(-keys[0]), "rot": moon_frames(keys), "unrot": moon_frames([-a for a in keys]),
                    "path": mo.get("pathUnit") if mo.get("pathUnit") is not None else moon_phase_path(0, 0, 1, mo["illum"], mo["waxing"])}
        return planets, moon, seconds
    # no sky data at all: the planets just turn, phased by Unix time
    t = (now or dt.datetime.now(dt.timezone.utc)).timestamp()
    return [(P, f"-{t % P:.2f}s", num(360 * round(t % P, 2) / P)) for P in PERIODS], None, seconds


def moon_frames(keys):
    """Keyframe stops for a list of angles spread evenly over one turn (moonFrames() in
    live/lockscreen-core.mjs writes the same)."""
    n = len(keys) - 1
    return "".join(f"{pct(100 * k / n)}%{{transform:rotate({num(a)}deg)}}" for k, a in enumerate(keys))


def moon_keys(lon_e, elong, rx, ry, tilt, n=48):
    """Screen angles (SVG degrees) of the Moon's direction from Earth through one Earth orbit,
    starting at Earth's longitude lon_e: the plane direction λ_E + 180° + E, squashed and tilted
    like Earth's ring, so a new Moon points exactly at the avatar and a quarter Moon along
    Earth's path. Unwrapped, so SMIL interpolates the short way. Mirrors moonKeys() in
    live/lockscreen-core.mjs."""
    t = math.radians(tilt)
    out, prev = [], None
    for k in range(n + 1):
        phi = math.radians(lon_e + 360 * k / n + 180 + elong)
        dx, dy = rx * math.cos(phi), -ry * math.sin(phi)
        a = math.degrees(math.atan2(dx * math.sin(t) + dy * math.cos(t), dx * math.cos(t) - dy * math.sin(t)))
        if prev is not None:
            a += 360 * round((prev - a) / 360)
        out.append(round(a, 1))
        prev = a
    return out


def moon_phase_path(cx, cy, r, illum, waxing, southern=False):
    """The lit part of a Moon disc as an SVG path, north up as seen from the northern
    hemisphere (waxing: lit on the right). A port of moonPhasePath() in live/astro.mjs."""
    k = max(0.0, min(1.0, illum))
    if k < .005:
        return ""

    def f(v):
        return f"{round(v, 3) + 0:g}"
    if k > .995:
        return f"M{f(cx)},{f(cy - r)}A{f(r)},{f(r)} 0 1 1 {f(cx)},{f(cy + r)}A{f(r)},{f(r)} 0 1 1 {f(cx)},{f(cy - r)}Z"
    right = waxing != southern
    a = r * abs(1 - 2 * k)
    limb = 1 if right else 0
    term = 0 if (k < .5) == right else 1
    return f"M{f(cx)},{f(cy - r)}A{f(r)},{f(r)} 0 0 {limb} {f(cx)},{f(cy + r)}A{f(a)},{f(r)} 0 0 {term} {f(cx)},{f(cy - r)}Z"


def moon_disc(m, r, path, outline=.35):
    """A Moon of radius r at (0, 0): the dark side, the lit part (path for a unit disc), an outline."""
    lit, dark_side, edge = MOON[m["page"]]
    return (f'<circle r="{num(r)}" {paint(dark_side)}/>'
            + (f'<path d="{path}" transform="scale({num(r)})" fill="{lit}"/>' if path else "")
            + f'<circle r="{num(r)}" fill="none" {paint(edge, "stroke")} stroke-width="{outline}"/>')


def moon_markup(m, p, moon, glow=None):
    """The Moon beside Earth, 8 px away on screen: it goes round Earth once per Earth orbit (the
    Sun-Earth-Moon angle stays as it is today; keyframes from moon_keys) and is turned back so
    it stays upright and round. glow: the Mid-Autumn glow's opacity (a number, or the template's
    {{MOON_GLOW:…}} slot), or None for no glow."""
    halo = ""
    if glow is not None:
        col, _ = MOON_GLOW[m["page"]]
        halo = f'<circle r="4.2" fill="{col}" opacity="{glow}" filter="url(#{p}-soft)"/>'
    return (f'<g class="{p}-mr" transform="rotate({moon["rot0"]})"><g transform="translate({MOON_DIST} 0)">'
            f'<g class="{p}-mu" transform="rotate({moon["unrot0"]})">{halo}{moon_disc(m, MOON_R, moon["path"])}</g></g></g>')


def planet_body(m, p, i, front=False, moon=None, moon_glow=None):
    """One planet, upright and round, centred on (0, 0): a soft halo (not on the transit copy),
    the disc with a little shine, and Jupiter's bands, Saturn's ring, or Earth's rim and Moon."""
    name, r, dark_col, light_col = PLANETS[i]
    col = dark_col if m["page"] == "dark" else light_col
    out = "" if front else f'<circle r="{num(r * 2.6)}" fill="{col}" opacity=".13" filter="url(#{p}-soft)"/>'
    ring = (f'<g transform="rotate(-20)" fill="none" stroke="{col}" stroke-opacity=".7" stroke-width="1.4">', "</g>")
    if name == "Saturn":   # the far half of the ring goes behind the planet
        out += f'{ring[0]}<path d="M-11,0A11,3.6 0 0,1 11,0"/>{ring[1]}'
    out += f'<circle r="{num(r)}" fill="{col}"/>'
    if name == "Jupiter":
        out += (f'<g clip-path="url(#{p}-jup)" fill="#000" fill-opacity=".17">'
                f'<rect x="-7" y="-2.9" width="14" height="1.3"/><rect x="-7" y="1.1" width="14" height="1.1"/></g>')
    if name == "Earth":
        out += f'<circle r="{num(r - .3)}" fill="none" stroke="{m["teal"]}" stroke-opacity=".55" stroke-width=".6"/>'
    out += f'<circle r="{num(r)}" fill="url(#{p}-shine)"/>'
    if name == "Saturn":
        out += f'{ring[0]}<path d="M11,0A11,3.6 0 0,1 -11,0"/>{ring[1]}'
    if name == "Earth" and moon:
        out += moon_markup(m, p, moon, moon_glow)
    return out


def orbit_system(m, p, mode, now=None, sky=None, festival=None):
    """The small solar system round (0, 0): eight faint rings faded towards the far side, the
    planets with short trails, a soft sun glow, my avatar, and a seconds dot round its edge.

    Each planet turns in the plane of its own (circular) orbit, which rotate(-9) scale(1, ry/rx)
    tilts into the ellipse; a counter-turn keeps the planet round and upright. A trail is the
    ring itself seen through a wedge that turns with its planet, so it can never come loose.
    Rings and trails stay behind the avatar; on the near half of its ring a planet passes in
    front of it (Mercury, Venus and Earth are close enough to transit the face).

    Every turn is a CSS animation (idea #16), so it stops for visitors who reduce motion; each
    turning group also carries its angle at load, so the planets then stand where they really
    are. The sun glow's core follows the Sun's altitude over Albany (idea #97); on the Mid-Autumn
    Festival the Moon glows a little (idea #150)."""
    timing, moon, (sbegin, sdeg) = orbit_timing(mode, now, sky)
    dark = m["page"] == "dark"
    template = mode == "template"

    def turn(i, sign):
        """The class and the transform at load of planet i's turn (sign -1: counter-clockwise)."""
        _, _, deg = timing[i]
        return f'class="{p}-{"s" if sign < 0 else "c"}{i}" transform="rotate({"-" if sign < 0 else ""}{deg})"'

    R = AVATAR_R
    ring_col, ring_a = m["ring_faint"]
    warm = sun_core(m, ((sky or {}).get("sun") or {}).get("alt"), template)
    if template:
        moon_glow = "{{MOON_GLOW:%g}}" % MOON_GLOW[m["page"]][1]
    else:
        moon_glow = MOON_GLOW[m["page"]][1] if festival == "mid-autumn" else None
    defs = (lin(f"{p}-dg", [(0, "#fff", .38), (.55, "#fff", .62), (1, "#fff")], 0, -80, 0, 70, units="userSpaceOnUse")
            + f'<mask id="{p}-depth" maskUnits="userSpaceOnUse" x="-240" y="-110" width="480" height="220">'
              f'<rect x="-240" y="-110" width="480" height="220" fill="url(#{p}-dg)"/></mask>'
            + f'<clipPath id="{p}-av"><circle r="{R}"/></clipPath>'
            + f'<clipPath id="{p}-face"><circle r="{R + .6}"/></clipPath>'
            + f'<clipPath id="{p}-near"><rect x="-90" y="0" width="180" height="60"/></clipPath>'
            + f'<clipPath id="{p}-jup"><circle r="7"/></clipPath>'
            + lin(f"{p}-edge", [(0, m["indigo"]), (1, m["teal"])], 0, 0, 1, 1)
            + f'<radialGradient id="{p}-sun">' + stop(0, warm) + stop(.47, warm, .9) + stop(.56, m["violet"], .85)
              + stop(.76, m["indigo"], .45) + stop(1, m["indigo"], 0) + "</radialGradient>"
            + f'<radialGradient id="{p}-shine" cx=".34" cy=".28" r=".8">' + stop(0, "#fff", .5 if dark else .42)
              + stop(.55, "#fff", 0) + "</radialGradient>"
            + f'<filter id="{p}-soft" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="3"/></filter>')
    # the motion: one counter-clockwise turn (s) and its undoing (c) per planet, the Moon, the seconds
    frames = (kf(f"{p}-ccw", [(0, "transform:rotate(0deg)"), (100, "transform:rotate(-360deg)")])
              + kf(f"{p}-cw", [(0, "transform:rotate(0deg)"), (100, "transform:rotate(360deg)")]))
    rules = "".join(f".{p}-s{i}{{animation:{p}-ccw {P}s linear {begin} infinite}}"
                    f".{p}-c{i}{{animation:{p}-cw {P}s linear {begin} infinite}}" for i, (P, begin, _) in enumerate(timing))
    rules += f".{p}-sec{{animation:{p}-cw 60s linear {sbegin} infinite}}"
    if moon:
        frames += f"@keyframes {p}-mr{{{moon['rot']}}}@keyframes {p}-mu{{{moon['unrot']}}}"
        rules += f".{p}-mr{{animation:{p}-mr {PERIODS[2]}s linear infinite}}.{p}-mu{{animation:{p}-mu {PERIODS[2]}s linear infinite}}"
    defs += motion(rules, frames)
    rings = trails = planets = front = ""
    for i, (rx, ry, rot) in enumerate(ORBITS):
        k = ry / rx
        # rings: faint, a little stronger further out
        rings += (f'<path d="{ellipse_d(rx, ry, rot)}" fill="none" stroke="{ring_col}" '
                  f'stroke-opacity="{ring_a * (1 + .9 * i / (len(ORBITS) - 1)):.3f}"/>')
        # the trail's wedge in the orbit's own plane: from the planet back (clockwise) by TRAIL_DEG
        t = math.radians(TRAIL_DEG)
        big = rx + 20
        head, tail = (0.0, -rx), (rx * math.sin(t), -rx * math.cos(t))
        ab = (tail[0] - head[0], tail[1] - head[1])
        l2 = ab[0] ** 2 + ab[1] ** 2
        ramp = []
        for j in range(7):
            u = j / 6
            q = (rx * math.sin(t * u), -rx * math.cos(t * u))
            ramp.append((round(((q[0] - head[0]) * ab[0] + (q[1] - head[1]) * ab[1]) / l2, 3), "#fff", round(.5 * (1 - u) ** 1.5, 3)))
        defs += lin(f"{p}-tr{i}", ramp, head[0], head[1], tail[0], tail[1], units="userSpaceOnUse")
        hx = math.hypot(rx * math.cos(math.radians(rot)), ry * math.sin(math.radians(rot))) + 6
        hy = math.hypot(rx * math.sin(math.radians(rot)), ry * math.cos(math.radians(rot))) + 6
        defs += (f'<mask id="{p}-tm{i}" maskUnits="userSpaceOnUse" x="{num(-hx)}" y="{num(-hy)}" width="{num(2 * hx)}" height="{num(2 * hy)}">'
                 f'<g transform="rotate({rot}) scale(1 {k:.5f})"><g {turn(i, -1)}>'
                 f'<path d="M0,0L0,{-big}A{big},{big} 0 0,1 {num(big * math.sin(t))},{num(-big * math.cos(t))}Z" '
                 f'fill="url(#{p}-tr{i})"/></g></g></mask>')
        col = PLANETS[i][2] if dark else PLANETS[i][3]
        trails += (f'<path d="{ellipse_d(rx, ry, rot)}" fill="none" stroke="{col}" stroke-width="1.2" '
                   f'stroke-linecap="round" mask="url(#{p}-tm{i})"/>')

        # turn with the orbit (counter-clockwise), then undo the turn, the squash and the tilt
        def chain(body):
            return (f'<g transform="scale(1 {k:.5f})"><g {turn(i, -1)}><g transform="translate(0 {-rx})"><g {turn(i, 1)}>'
                    f'<g transform="scale(1 {1 / k:.5f}) rotate({-rot})">{body}</g></g></g></g></g>')
        planets += f'<g transform="rotate({rot})">{chain(planet_body(m, p, i, moon=moon, moon_glow=moon_glow))}</g>'
        if ry - PLANETS[i][1] < R:   # close enough to pass in front of the avatar on the near side
            front += f'<g transform="rotate({rot})" clip-path="url(#{p}-near)">{chain(planet_body(m, p, i, True, moon, moon_glow))}</g>'
    body = (f'<circle r="70" fill="url(#{p}-sun)" opacity="{.35 if dark else .2}"/>'
            f'<g mask="url(#{p}-depth)">{rings}</g>{trails}{planets}'
            f'<image href="{img("avatar.jpg")}" x="{-R}" y="{-R}" width="{2 * R}" height="{2 * R}" '
            f'preserveAspectRatio="xMidYMid slice" clip-path="url(#{p}-av)"/>'
            f'<circle r="{R - .6}" fill="none" stroke="url(#{p}-edge)" stroke-width="1.2"/>'
            f'<g clip-path="url(#{p}-face)">{front}</g>'
            f'<g class="{p}-sec" transform="rotate({sdeg})"><circle cy="{-SECONDS_R}" r="1.8" fill="{m["seconds"]}"/></g>')
    return defs, body


def backdrop(m, p, w, h, glows, fade):
    """Page colour, the 1 px inset edge, three soft glows, the dot grid fading out from the orbit
    and a 1 px glint along the top right edge. glows: [(token, cx, cy, r)]; fade: (cx, cy, r[, ry])."""
    defs = (f'<pattern id="{p}-dots" width="20" height="20" patternUnits="userSpaceOnUse">'
            f'<circle cx="10" cy="10" r=".9" {paint(m["dot"])}/></pattern>'
            + css_rad(f"{p}-fade", fade[0], fade[1], fade[2], fade[-1], [(0, "#fff"), (.55, "#fff", .55), (1, "#fff", 0)])
            + f'<mask id="{p}-m" maskUnits="userSpaceOnUse" x="0" y="0" width="{w}" height="{h}">'
              f'<rect width="{w}" height="{h}" fill="url(#{p}-fade)"/></mask>'
            + lin(f"{p}-glint", [(0, m["glint"], 0), (.55, m["glint"]), (1, m["glint"], 0)], w * .52, 0, w, 0, units="userSpaceOnUse"))
    body = f'<rect width="{w}" height="{h}" fill="{m["bg"]}"/>' + inset_ring(0, 0, w, h, 18, m["banner_edge"])
    for i, (tok, cx, cy, r) in enumerate(glows):
        col, alpha = m[tok]
        defs += (f'<radialGradient id="{p}-g{i}" cx="{num(cx)}" cy="{num(cy)}" r="{num(r)}" gradientUnits="userSpaceOnUse">'
                 f'<stop offset="0" stop-color="{col}"/><stop offset="1" stop-color="{col}" stop-opacity="0"/></radialGradient>')
        body += f'<circle cx="{num(cx)}" cy="{num(cy)}" r="{num(r)}" fill="url(#{p}-g{i})" opacity="{alpha:g}"/>'
    body += (f'<rect width="{w}" height="{h}" fill="url(#{p}-dots)" mask="url(#{p}-m)"/>'
             f'<rect x="{num(w * .52)}" width="{num(w * .48)}" height="1" fill="url(#{p}-glint)"/>')
    return defs, body


def status_pill(m, p, x, y, text, port=False, live=False):
    """The pill at the top: a teal live dot and 'Albany, NY · Eastern Time'."""
    s = 21 / 13 if port else 1
    h, size, style = (44, 21, "p-pill") if port else (28, 13, "pill")
    pl, dot, gap, pr = 10 * s, 7 * s, 8 * s, 12 * s
    w = pl + dot + gap + tw(text, style, .005 * size) + pr
    cx, cy = x + pl + dot / 2, y + h / 2
    defs = f'<filter id="{p}-live" x="-3" y="-3" width="7" height="7"><feGaussianBlur stdDeviation="{num(5 * s)}"/></filter>'
    cls = ""
    if live:   # the live dot breathes (CSS, so it rests when motion is reduced)
        cls = f' class="{p}-pulse"'
        defs += motion(f".{p}-pulse{{animation:{p}-pulse 3.2s infinite}}",
                       kf(f"{p}-pulse", [(0, "opacity:.55;animation-timing-function:cubic-bezier(.4,0,.6,1)"),
                                         (50, "opacity:1;animation-timing-function:cubic-bezier(.4,0,.6,1)"), (100, "opacity:.55")]))
    body = (rrect(x, y, w, h, h / 2, paint(m["chip"])) + inset_ring(x, y, w, h, h / 2, m["line2"])
            + f'<circle{cls} cx="{num(cx)}" cy="{num(cy)}" r="{num(dot / 2)}" fill="{m["teal"]}" filter="url(#{p}-live)"/>'
            + f'<circle cx="{num(cx)}" cy="{num(cy)}" r="{num(dot / 2 + 3 * s)}" fill="{m["teal"]}" fill-opacity=".22"/>'
            + f'<circle cx="{num(cx)}" cy="{num(cy)}" r="{num(dot / 2)}" fill="{m["teal"]}"/>'
            + T(x + pl + dot + gap, cy + .3555 * size + .4, text, size, m["fg2"], weight=500, ls=.005 * size))
    return defs, body


def lane_pill(m, x, y, text, color, port=False):
    """A lane label (Software / Creative tech / Product) with its coloured dot."""
    s = 20 / 12.5 if port else 1
    h, size, style = (40, 20, "p-lane") if port else (26, 12.5, "lane")
    pl, dot, gap, pr = 9 * s, 6 * s, 7 * s, 11 * s
    w = pl + dot + gap + tw(text, style, .005 * size) + pr
    return (rrect(x, y, w, h, h / 2, paint(m["lane_bg"])) + inset_ring(x, y, w, h, h / 2, m["line2"])
            + f'<circle cx="{num(x + pl + dot / 2)}" cy="{num(y + h / 2)}" r="{num(dot / 2)}" fill="{color}"/>'
            + T(x + pl + dot + gap, y + h / 2 + .3555 * size + .4, text, size, m["fg"], weight=600, ls=.005 * size)), w


def clock_column(m, p, geo, weight, mode, now, facts, weather, meta, width, festival=None):
    """The left column: status pill, date, the clock (or in the daily image the date as the
    hero), name, one line about me. On a festival (idea #150) the date line has a small touch:
    a greeting on the Spring Festival, a firework after the date on New Year's Day; the live
    banner adds them per minute in renderLive()."""
    g = GEO[geo]
    port = geo == "port"
    live = mode in ("template", "static")
    defs, body = status_pill(m, p, *g["pill"], f'{facts["city"]} · {zone_name(facts)}', port=port, live=live)
    S = g["clock_size"]
    # the clock's fill: clockTop until 30% of the line box, then clockBot (local to the baseline)
    defs += lin(f"{p}-clk", [(0, m["clock"][0]), (.3, m["clock"][0]), (1, m["clock"][1])], 0, -.873 * S, 0, .127 * S,
                units="userSpaceOnUse")
    tattrs = (f'font-size="{S}" font-weight="{700 if weight == "bold" else 300}" letter-spacing="{num(-.055 * S)}" '
              f'fill="url(#{p}-clk)" {TNUM}')
    dattrs = f'font-size="{g["date_size"]}" font-weight="500" letter-spacing="{num(-.005 * g["date_size"])}" fill="{m["fg2"]}"'
    if mode == "template":
        date_slot, time_slot = "<!--DATE-->", "<!--TIME-->"
    elif mode == "static" and now is not None:
        hm, ap = fmt_time(now)
        date_slot = f'<text x="0" y="0">{escape(fmt_date(now))}{fest_tspan(festival, meta)}</text>'
        time_slot = f'<text x="0" y="0">{hm}{ampm_tspan(ap, meta)}</text>'
    else:  # daily: no live clock, so the date is the hero (proportional figures, a little less tracking)
        now = now or dt.datetime.now(ZoneInfo(facts["timezone"]))
        note = ("updated daily" if festival != "spring-festival"
                else f'<tspan fill="{m["violet"]}">{escape(FESTIVE[festival].lstrip(" ·"), quote=False)}</tspan>')
        date_slot = f'<text x="0" y="0">{now:%A} · {note}</text>'
        spark_ = (f'<tspan font-size="{num(S * .27)}" dx="{num(S * .08)}" dy="{num(-S * .38)}" fill="{m["violet"]}">'
                  f'{FESTIVE["new-year"].strip()}</tspan>') if festival == "new-year" else ""
        time_slot = (f'<text x="0" y="0" letter-spacing="{num(-.04 * S)}" style="font-variant-numeric:normal">'
                     f'{now:%b} {now.day}{spark_}</text>')
    if weather and mode == "static":
        date_slot = date_slot.replace("</text>", f'<tspan font-weight="{meta["wxWeight"]}">{escape(meta["wxSep"] + weather)}</tspan></text>', 1)
    (cx, cy), (dx, dy) = g["clock"], g["date"]
    body += f'<g transform="translate({dx} {dy})" {dattrs}>{date_slot}</g>'
    body += f'<g transform="translate({cx} {cy})" {tattrs}>{time_slot}</g>'
    nx, ny = g["name"]
    body += (f'<text x="{nx}" y="{ny}" font-size="{g["name_size"]}" font-weight="600" letter-spacing="{num(-.01 * g["name_size"])}" '
             f'{paint(m["fg"])}>{escape(facts["name"])}<tspan dx="{g["zh_dx"]}" font-size="{g["zh_size"]}" font-weight="500" '
             f'{paint(m["fg2"])}>{escape(facts["name_zh"])}</tspan></text>')
    sx, sy = g["sub"]
    lines = wrap(facts["subline"], g["sub_style"], width - 2 * sx) if g["sub_style"] else [facts["subline"]]
    body += "".join(T(sx, sy + i * g["sub_lead"], line, g["sub_size"], m["fg2"], weight=500) for i, line in enumerate(lines))
    return defs, body


LANE_COLOURS = ("indigo", "violet", "teal")
# Lane pills (left, top), off the orbit (its box is about x 560-980, y 81-239); left None means
# right-aligned to lane_right. Software sits above the orbit, Product and Creative tech below it.
LANES_AT = [(560, 52), (None, 268), (612, 268)]
LANE_RIGHT = 958
# portrait: the orbit below the text, scaled to the width; lanes relative to its centre
PORTRAIT = dict(centre=(300, 584), scale=1.15, lanes=[(44, -150), (None, 108), (118, 108)], lane_right=556)


def banner(page="dark", layout="below", weight="bold", mode="daily", now=None, stack_widgets=None,
           weather=None, facts=None, sky=None):
    """mode: daily (date as the hero, regenerated every night), static (a fixed time, for
    screenshots), template (placeholders for the live-clock function)."""
    page = ALIASES.get(page, page)
    facts = facts or load("profile.json")
    m = MODES[page]
    p = "b"
    meta = clock_meta(page, layout)
    if sky is None and layout != "right" and mode != "template":
        sky = (sky_at(now) if mode == "static" and now is not None else None) or load("sky-day.json")
    lanes = facts["lanes"]
    # the festival of the day shown (idea #150); the live banner decides per request
    shown = now or dt.datetime.now(ZoneInfo(facts["timezone"]))
    festival = None if mode == "template" else festival_on(shown.date())
    if layout == "portrait":
        w, h, r = PW, PH, 24
        (ox, oy), s = PORTRAIT["centre"], PORTRAIT["scale"]
        glows = [("glow_a", ox + 20 * s, oy - 42 * s, 300), ("glow_b", ox - 120 * s, oy + 90 * s, 190 * s),
                 ("glow_c", w - 25, h - 20, 210 * s)]
        defs, body = backdrop(m, p, w, h, glows, (ox, oy + 30, 380, 300))
        od, ob = orbit_system(m, "o", mode, now, sky, festival)
        defs += od
        body += f'<g transform="translate({ox} {oy}) scale({s})">{ob}</g>'
        for i, (lx, dy) in enumerate(PORTRAIT["lanes"]):
            ly = oy + dy
            if lx is None:   # right-aligned
                _, lw = lane_pill(m, 0, 0, lanes[i], m[LANE_COLOURS[i]], port=True)
                lx = PORTRAIT["lane_right"] - lw
            body += lane_pill(m, lx, ly, lanes[i], m[LANE_COLOURS[i]], port=True)[0]
        cd, cb = clock_column(m, p, "port", weight, mode, now, facts, weather, meta, w, festival)
    else:
        w, h, r = W, H, 18
        glows = [("glow_a", 790, 118, 270), ("glow_b", 650, 250, 190), ("glow_c", 975, 300, 210)]
        defs, body = backdrop(m, p, w, h, glows, (770, 150, 430))
        if layout == "below":
            od, ob = orbit_system(m, "o", mode, now, sky, festival)
            defs += od
            body += f'<g transform="translate(770 160)">{ob}</g>'
            for i, (lx, ly) in enumerate(LANES_AT):
                if lx is None:   # right-aligned
                    lx = LANE_RIGHT - lane_pill(m, 0, 0, lanes[i], m[LANE_COLOURS[i]])[1]
                body += lane_pill(m, lx, ly, lanes[i], m[LANE_COLOURS[i]])[0]
        else:  # right: the widgets take the orbit's place, as a self-advancing stack
            if stack_widgets:
                sd, sb = widget_stack(m, stack_widgets, x=586, y=44)
                defs += sd
                body += sb
            ws = [lane_pill(m, 0, 0, t, m[LANE_COLOURS[i]])[1] for i, t in enumerate(lanes)]
            x = 770 - (sum(ws) + 10 * (len(ws) - 1)) / 2
            for i, t in enumerate(lanes):
                body += lane_pill(m, x, 240, t, m[LANE_COLOURS[i]])[0]
                x += ws[i] + 10
        cd, cb = clock_column(m, p, "land", weight, mode, now, facts, weather, meta, w, festival)
    defs += cd + f'<clipPath id="{p}-frame"><rect width="{w}" height="{h}" rx="{r}"/></clipPath>'
    label = (f'{facts["name"]} ({facts["name_zh"]}): {", ".join(lanes)}. '
             f'{facts["city"]}, {zone_name(facts)}. {facts["subline"]}'
             + (" A small solar system turns round my avatar, the planets setting off from where they really are"
                " today and the Moon beside Earth in today's phase; a dot round the avatar ticks the seconds."
                if layout != "right" else ""))
    return standalone(w, h, label, defs, f'<g clip-path="url(#{p}-frame)">{body}{cb}</g>')


# --------------------------------------------------------------------------- unlock
def unlock_bar(page, p="ul"):
    """The README fold's summary: a pill with a gradient edge, a chevron knob and two lines.
    One slow shimmer runs along the edge every six seconds: a light band (the {p}-sh gradient on
    a rect waiting left of the pill) slides across, seen only through the 1 px ring. It is CSS,
    so it stays still when motion is reduced (idea #16)."""
    m = MODES[page]
    w, h = 262, 50
    defs = (lin(f"{p}-edge", [(0, m["indigo"], .7), (.55, m["edge"][1]), (1, m["teal"], .55)], 0, 0, w, 0, units="userSpaceOnUse")
            + lin(f"{p}-bg", [(0, m["bg2"]), (1, m["bg"])], 0, 1, 0, h - 1, units="userSpaceOnUse")
            + f'<mask id="{p}-ring" maskUnits="userSpaceOnUse" x="0" y="0" width="{w}" height="{h}">'
              f'<rect width="{w}" height="{h}" rx="25" fill="#fff"/><rect x="1" y="1" width="{w - 2}" height="{h - 2}" rx="24" fill="#000"/></mask>'
            + f'<linearGradient id="{p}-sh" x1="-90" y1="0" x2="0" y2="0" gradientUnits="userSpaceOnUse">'
              + stop(0, m["shimmer"], 0) + stop(.5, m["shimmer"]) + stop(1, m["shimmer"], 0) + "</linearGradient>"
            + motion(f".{p}-shine{{animation:{p}-shine 6s 1s infinite}}",
                     kf(f"{p}-shine", [(0, "transform:translate(0px,0px);animation-timing-function:cubic-bezier(.45,0,.55,1)"),
                                       (30, f"transform:translate({w + 90}px,0px)"), (100, f"transform:translate({w + 90}px,0px)")])))
    body = (f'<rect width="{w}" height="{h}" rx="25" fill="url(#{p}-edge)"/>'
            f'<rect x="1" y="1" width="{w - 2}" height="{h - 2}" rx="24" fill="url(#{p}-bg)"/>'
            f'<g mask="url(#{p}-ring)"><rect class="{p}-shine" x="-90" width="90" height="{h}" fill="url(#{p}-sh)"/></g>'
            f'<circle cx="26" cy="25.5" r="17" fill="{m["indigo"]}" fill-opacity=".14"/>'
            f'<circle cx="26" cy="25.5" r="16.5" fill="none" stroke="{m["indigo"]}" stroke-opacity=".45"/>'
            + icon16("down", 18, 17.5, 16, m["indigo"])
            + T(55, 22, "Unlock the rest", 14.5, m["fg"], weight=650, ls=-.145)
            + T(55, 38, "apps · 3D store · 中文介绍", 11.5, m["fg2"], weight=500))
    return standalone(w, h, "Unlock the rest: apps, a 3D model of the store, and an introduction in Chinese", defs, body)


# --------------------------------------------------------------------------- app tiles
ICON_LABELS = {"silnest": "SilNest", "storewright": "Storewright", "site": "Portfolio", "vocal": "AI Vocal",
               "howiwork": "How I work", "earlywork": "Early work", "contact": "Contact"}
ICON_ORDER = ["silnest", "storewright", "site", "vocal", "howiwork", "earlywork", "contact"]


def icon_labels(facts):
    """Tile labels; the folder takes its label from the facts when they have one."""
    return {**ICON_LABELS, "earlywork": ((facts or {}).get("early_work") or {}).get("label", ICON_LABELS["earlywork"])}


def app_icon(key, page, facts=None):
    """A tile for the unlocked part of the README: a 60 px icon with the card's gradient edge
    and a top-left indigo glow, a 28 px line glyph, and its label (12 / 500)."""
    m = MODES[page]
    w, h = 84, 98
    x, y, s = 12, 2, 60
    p = f"ic{key}"
    label = icon_labels(facts or load("profile.json"))[key]
    if key == "silnest":
        defs = f'<clipPath id="{p}-c"><rect x="{x}" y="{y}" width="{s}" height="{s}" rx="15"/></clipPath>'
        art = (f'<image href="{img("silnest-icon.jpg")}" x="{x}" y="{y}" width="{s}" height="{s}" clip-path="url(#{p}-c)"/>'
               + inset_ring(x, y, s, s, 15, m["line2"]))
    else:
        e0, e1, e2 = m["edge"]
        defs = (css_lin(f"{p}-e", 160, x, y, s, s, [(0, e0), (.45, e1), (1, e2)])
                + lin(f"{p}-bg", [(0, m["tile"][0]), (1, m["tile"][1])], 0, y + 1, 0, y + s - 1, units="userSpaceOnUse")
                + css_rad(f"{p}-gl", x + 1 + .28 * (s - 2), y + 1, 1.1 * (s - 2), .9 * (s - 2), [(0, m["tile_glow"]), (.62, m["tile_glow"], 0)])
                + lin(f"{p}-g", [(0, m["indigo"]), (1, m["teal"])], 3, 3, 21, 21, units="userSpaceOnUse"))
        art = (rrect(x, y, s, s, 15, f'fill="url(#{p}-e)"') + rrect(x + 1, y + 1, s - 2, s - 2, 14, f'fill="url(#{p}-bg)"')
               + rrect(x + 1, y + 1, s - 2, s - 2, 14, f'fill="url(#{p}-gl)"')
               + f'<g transform="translate(28 18) scale({28 / 24:.5f})"><path d="{TILE_GLYPH[key]}" fill="none" '
                 f'stroke="url(#{p}-g)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></g>')
    body = art + T(w / 2, 81.5, label, 12, m["tile_ink"], weight=500, anchor="middle")
    return standalone(w, h, label, defs, body)


# --------------------------------------------------------------------------- README extras
SHOWCASE_SRC = "storewright-showcase.jpg"      # the Storewright screenshot (960 x 600)
SHOWCASE_IMG = "storewright-showcase-960.jpg"  # its compressed copy for the framed SVG


def showcase_copy():
    """Refresh the compressed copy when the screenshot is newer (needs macOS sips; the copy is
    committed, so the nightly job on Linux just uses it). Returns the file name to embed."""
    src, dst = (os.path.join(ROOT, "assets", "src", n) for n in (SHOWCASE_SRC, SHOWCASE_IMG))
    stale = not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src)
    if stale and shutil.which("sips"):
        subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "55", src, "--out", dst],
                       capture_output=True, check=True)
    return SHOWCASE_IMG if os.path.exists(dst) else SHOWCASE_SRC


def showcase_frame(page, name=None):
    """The Storewright screenshot in a Dusk frame: rounded corners, a 1.2 px indigo -> teal edge
    and a soft glow. 680 x 440, the screenshot itself 640 x 400."""
    m = MODES[page]
    W_, H_, x, y, w, h, r = 680, 440, 20, 20, 640, 400, 14
    p = "sc"
    defs = (f'<clipPath id="{p}-c"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}"/></clipPath>'
            + lin(f"{p}-e", [(0, m["indigo"]), (.5, m["violet"], .85), (1, m["teal"])], x, y, x + w, y + h, units="userSpaceOnUse")
            + f'<filter id="{p}-glow" x="-40" y="-40" width="{W_ + 80}" height="{H_ + 80}" filterUnits="userSpaceOnUse">'
              f'<feGaussianBlur stdDeviation="9"/></filter>')
    body = (rrect(x + 4, y + 6, w - 8, h - 8, r, f'fill="url(#{p}-e)" opacity="{.42 if m["page"] == "dark" else .22}" filter="url(#{p}-glow)"')
            + rrect(x, y, w, h, r, f'fill="{m["bg2"]}"')
            + f'<image href="{img(name or showcase_copy())}" x="{x}" y="{y}" width="{w}" height="{h}" '
              f'preserveAspectRatio="xMidYMid slice" clip-path="url(#{p}-c)"/>'
            + rrect(x + .6, y + .6, w - 1.2, h - 1.2, r - .6, f'fill="none" stroke="url(#{p}-e)" stroke-width="1.2"'))
    label = ("Storewright running in a browser: the 3D digital twin of a store on the left, "
             "two associate phones on the right.")
    return standalone(W_, H_, label, defs, body)


def divider(page):
    """A thin gradient rule between the README's sections: clear ends, indigo -> teal."""
    m = MODES[page]
    a = .55 if m["page"] == "dark" else .6
    defs = lin("dv", [(0, m["indigo"], 0), (.28, m["indigo"], a), (.72, m["teal"], a), (1, m["teal"], 0)], 0, 0, 1000, 0,
               units="userSpaceOnUse")
    return standalone(1000, 2, "", defs, '<rect y=".5" width="1000" height="1" fill="url(#dv)"/>').replace(
        ' role="img" aria-label=""', ' aria-hidden="true"').replace("<title></title>", "")


# --------------------------------------------------------------------------- README: milestones, skills, timeline, contact
# Everything here comes from data/profile.json: milestones (#9), skills_map (#110), timeline
# (#111), links (#109, #148). make_readme.py builds the links and alt texts from the same data.
PROJECT_NAMES = {"silnest": "SilNest", "storewright": "Storewright", "site": "yecanyuan.com", "vocal": "AI Vocal",
                 "how": "How I work"}
LANE_NAMES = {"software": "Software", "creative": "Creative tech", "product": "Product"}
LANE_INK = {"software": "indigo", "creative": "violet", "product": "teal"}   # the banner's lane dots
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
          "November", "December"]


def ym(date_str):
    """'2026-09-08' or '2026-09' -> (2026, 9, 8 or None)."""
    parts = [int(x) for x in date_str.split("-")]
    return parts[0], parts[1], (parts[2] if len(parts) > 2 else None)


def when_short(date_str, today, recent=60):
    """A milestone's date on its card (idea #9): 'Sep 8' while it is at most 60 days old, then
    only the month, 'Sep 2026'; a date given as a month is always 'Nov 2026'."""
    y, mo, d = ym(date_str)
    if d and (today - dt.date(y, mo, d)).days <= recent:
        return f"{MONTHS[mo - 1][:3]} {d}"
    return f"{MONTHS[mo - 1][:3]} {y}"


def when_long(date_str):
    """'September 8, 2026' or 'November 2026' (alt texts)."""
    y, mo, d = ym(date_str)
    return f"{MONTHS[mo - 1]} {d}, {y}" if d else f"{MONTHS[mo - 1]} {y}"


def latest_milestones(facts, n=2):
    """The newest n milestones; a month-only date counts as the end of its month."""
    items = facts.get("milestones") or []
    return sorted(items, key=lambda it: it["date"] + ("" if len(it["date"]) > 7 else "-99"), reverse=True)[:n]


def milestone_project(item, facts):
    """Which project a milestone belongs to, from its evidence link."""
    url = item.get("url", "")
    if "storewright" in url.lower():
        return "storewright"
    if "apps.apple.com" in url or url == facts["silnest"]["store_url"]:
        return "silnest"
    if facts["site"]["domain"] in url:
        return "site"
    return item.get("project")


def mini_tile(m, p, key, x, y, s=26):
    """A small app tile: the real SilNest icon, or a line glyph (TILE_GLYPH) on a chip."""
    if key == "silnest":
        return (f'<clipPath id="{p}-ti"><rect x="{x}" y="{y}" width="{s}" height="{s}" rx="7"/></clipPath>',
                f'<image href="{img("silnest-icon.jpg")}" x="{x}" y="{y}" width="{s}" height="{s}" clip-path="url(#{p}-ti)"/>'
                + outer_ring(x, y, s, s, 7, m["line2"]))
    glyph = TILE_GLYPH.get(key)
    defs = lin(f"{p}-tg", [(0, m["indigo"]), (1, m["teal"])], 3, 3, 21, 21, units="userSpaceOnUse")
    body = rrect(x, y, s, s, 7, paint(m["chip"])) + inset_ring(x, y, s, s, 7, m["line2"])
    k = 16 / 24
    if glyph:
        body += (f'<g transform="translate({num(x + (s - 16) / 2)} {num(y + (s - 16) / 2)}) scale({k:.4f})"><path d="{glyph}" '
                 f'fill="none" stroke="url(#{p}-tg)" stroke-width="{1.5 / k:.2f}" stroke-linecap="round" stroke-linejoin="round"/></g>')
    else:
        body += icon16("spark", x + (s - 14) / 2, y + (s - 14) / 2, 14, m["indigo"])
    return defs, body


def milestone_lines(item):
    return wrap(item["en"], "s12.5", 368 - 50 - 18)


def milestone_card(page, item, facts, today, lines=1, p="ms"):
    """A compact update card (idea #9), like the interactive page's lock-screen updates: the
    project's tile, "Milestone" and its date, then what happened. Each card is its own image so
    it can link to its own evidence. 368 wide; lines sets the height, so two cards match."""
    m = MODES[page]
    w = 368
    body_lines = milestone_lines(item)
    h = 62 + 17 * (max(lines, len(body_lines)) - 1)
    key = milestone_project(item, facts)
    td, tb = mini_tile(m, p, key, 14, 14)
    when = when_short(item["date"], today)
    c = (tb + T(50, 28, "Milestone", 13.5, m["fg"], weight=600, ls=-.07)
         + T(w - 33, 28, when, 12, m["fg3"], weight=500, anchor="end", extra=TNUM)
         + icon16("arrow", w - 29, 17.5, 13, m["fg3"]))
    c += "".join(T(50, 46 + 17 * i, line, 12.5, m["fg2"], weight=500) for i, line in enumerate(body_lines))
    d, b = widget(m, p, w, h, c, False, td)
    label = f'Milestone, {when_long(item["date"])}: {item["en"]}.'
    return standalone(w, h, label, d, b), label


SKILL_X = 6 + 12 + 11       # star inset, the zig-zag, and the gap between a star and its label


def wrap_list(items, style, width):
    """'A, B, C' broken only after a comma, so a name like 'AI Vocal' stays whole."""
    lines, cur = [], ""
    for it in items:
        cand = f"{cur}, {it}" if cur else it
        if not cur or tw(cand, style) <= width:
            cur = cand
        else:
            lines.append(cur + ",")
            cur = it
    return lines + ([cur] if cur else [])


def skills_layout(facts, width=680, top=60):
    """Stars for the skill map (idea #110): one constellation per lane, in the order of the
    banner's lanes, each a column of stars (two columns for a big lane); a star's label is the
    skill and, under it, the projects it was used in. Columns get the width their labels need
    (a long label wraps)."""
    rows = facts.get("skills_map") or []
    order = [k for k in ("software", "creative", "product") if any(r["lane"] == k for r in rows)]
    order += [k for k in dict.fromkeys(r["lane"] for r in rows) if k not in order]
    lanes = {k: [r for r in rows if r["lane"] == k] for k in order}
    subcols = {k: (2 if len(v) > 5 else 1) for k, v in lanes.items()}
    gap, pad = 18, 22

    def proj_text(r):
        return ", ".join(PROJECT_NAMES.get(q, q) for q in r["projects"])

    def label_w(r):   # the widest line a label would like (names in 12.5/600, projects in 10.5/500)
        return max(tw(r["skill"], "lane"), tw(proj_text(r), "s11") * 10.5 / 11)
    want = {k: min(165.0, max(label_w(r) for r in lanes[k]) + SKILL_X + 6) for k in order}
    room = width - 2 * pad - gap * (len(order) - 1)
    # a two-column lane gets what its labels need; the single columns share the rest (and wrap)
    wide = {k: want[k] for k in order if subcols[k] > 1}
    single = [k for k in order if subcols[k] == 1]
    left_over = room - sum(2 * v for v in wide.values())
    if single and left_over / len(single) >= 120:
        col_w = {**{k: left_over / len(single) for k in single}, **wide}
    else:
        scale = room / sum(want[k] * subcols[k] for k in order)
        col_w = {k: want[k] * scale for k in order}
    stars, heads, x = [], [], pad
    for k in order:
        n_sub = subcols[k]
        items = lanes[k]
        per = -(-len(items) // n_sub)
        heads.append((k, x, n_sub * col_w[k]))
        for s_ in range(n_sub):
            y = top
            for j, r in enumerate(items[s_ * per:(s_ + 1) * per]):
                sx = x + s_ * col_w[k] + 6 + (12 if j % 2 else 0)
                avail = col_w[k] - SKILL_X - 4
                name = wrap(r["skill"], "lane", avail)
                proj = wrap_list([PROJECT_NAMES.get(q, q) for q in r["projects"]], "s11", avail * 11 / 10.5)
                stars.append(dict(lane=k, x=sx, y=y + 4, name=name, proj=proj, n=len(r["projects"]), sub=s_, row=j,
                                  skill=r["skill"], projects=r["projects"]))
                y += 16 * len(name) + 13 * len(proj) + 9
        x += n_sub * col_w[k] + gap
    return stars, heads


def skills_map(page, facts, p="sm"):
    """The skill map (idea #110): three constellations, Software, Creative tech and Product; each
    star is a skill, and the more of my projects used it, the brighter it shines (the count is
    the only measure: no self-rated levels). Lines join each constellation's stars in order."""
    m = MODES[page]
    w = 680
    stars, heads = skills_layout(facts, w)
    if not stars:
        return None, ""
    most = max(s["n"] for s in stars)
    bottom = max(s["y"] + 16 * len(s["name"]) + 13 * len(s["proj"]) for s in stars)
    h = int(bottom + 44)
    defs = (f'<filter id="{p}-glow" x="-2" y="-2" width="5" height="5"><feGaussianBlur stdDeviation="2.6"/></filter>'
            + f'<pattern id="{p}-dots" width="20" height="20" patternUnits="userSpaceOnUse">'
              f'<circle cx="10" cy="10" r=".8" {paint(m["dot"])}/></pattern>')
    c = f'<rect width="{w}" height="{h}" fill="url(#{p}-dots)" opacity=".55"/>'
    for k, x, cw in heads:
        col = m[LANE_INK.get(k, "indigo")]
        c += (f'<circle cx="{num(x + 10)}" cy="31" r="3.5" fill="{col}"/>'
              + T(x + 20, 35.5, LANE_NAMES.get(k, k.capitalize()), 13, m["fg"], weight=650, ls=-.065))
    # constellation lines: down the first column of a lane, then back up the second
    for k, _x, _cw in heads:
        lane = [s for s in stars if s["lane"] == k]
        path = [s for s in lane if s["sub"] == 0] + sorted((s for s in lane if s["sub"] == 1), key=lambda s: -s["row"])
        if len(path) > 1:
            col = m[LANE_INK.get(k, "indigo")]
            c += (f'<path d="M{"L".join(f"{num(s["x"])},{num(s["y"])}" for s in path)}" fill="none" stroke="{col}" '
                  f'stroke-opacity="{.32 if m["page"] == "dark" else .38}" stroke-width="1" stroke-dasharray="2 3"/>')
    for s in stars:
        col = m[LANE_INK.get(s["lane"], "indigo")]
        b = s["n"] / most
        r = 2.1 + 1.7 * b
        c += (f'<circle cx="{num(s["x"])}" cy="{num(s["y"])}" r="{num(r * 2.6)}" fill="{col}" opacity="{.12 + .2 * b:.2f}" '
              f'filter="url(#{p}-glow)"/>'
              f'<circle cx="{num(s["x"])}" cy="{num(s["y"])}" r="{num(r)}" fill="{col}" fill-opacity="{.5 + .5 * b:.2f}"/>')
        if m["page"] == "dark":   # a white-hot core on dark pages
            c += f'<circle cx="{num(s["x"])}" cy="{num(s["y"])}" r="{num(r * .42)}" fill="#fff" fill-opacity="{.35 + .5 * b:.2f}"/>'
        for i, line in enumerate(s["name"]):
            c += T(s["x"] + 11, s["y"] + 4.5 + 16 * i, line, 12.5, m["fg"] if b >= 1 else m["fg2"], weight=600)
        for i, line in enumerate(s["proj"]):
            c += T(s["x"] + 11, s["y"] + 3.5 + 16 * len(s["name"]) + 13 * i, line, 10.5, m["fg3"], weight=500)
    # the key
    ky = h - 18
    for i, n in enumerate(sorted({s["n"] for s in stars})):
        b = n / most
        r = 2.1 + 1.7 * b
        x = 22 + i * 92
        c += (f'<circle cx="{num(x + 4)}" cy="{num(ky - 4)}" r="{num(r)}" fill="{m["fg2"]}" fill-opacity="{.5 + .5 * b:.2f}"/>'
              + T(x + 13, ky, f'{n} project{"s" if n > 1 else ""}', 10.5, m["fg3"], weight=600))
    c += T(w - 22, ky, "Brighter star: used in more of my projects", 10.5, m["fg3"], weight=600, anchor="end")
    d, bg = widget(m, p, w, h, c, False, defs)
    n_by_lane = {k: sum(1 for s in stars if s["lane"] == k) for k, _x, _cw in heads}
    label = ("Skill map: three constellations, " + ", ".join(f"{LANE_NAMES.get(k, k)} ({n} skills)" for k, n in n_by_lane.items())
             + ". Each star is a skill; the more of my projects used it, the brighter it is.")
    return standalone(w, h, label, d, bg), label


def timeline_items(facts):
    """[(key, name, from, to or None)] from facts["timeline"], oldest first."""
    out = []
    for t in facts.get("timeline") or []:
        out.append((t["project"], PROJECT_NAMES.get(t["project"], t["project"]), t["from"], t.get("to")))
    return sorted(out, key=lambda r: r[2])


def span_text(frm, to):
    """'Mar 2026', or 'Oct to Nov 2026' (no dashes on the page)."""
    y0, m0, _ = ym(frm)
    if not to:
        return f"{MONTHS[m0 - 1][:3]} {y0}"
    y1, m1, _ = ym(to)
    return (f"{MONTHS[m0 - 1][:3]} to {MONTHS[m1 - 1][:3]} {y1}" if y0 == y1
            else f"{MONTHS[m0 - 1][:3]} {y0} to {MONTHS[m1 - 1][:3]} {y1}")


TIMELINE_INK = {"silnest": "violet", "site": "teal", "vocal": "warm", "storewright": "indigo"}


def timeline(page, facts, today, p="tl"):
    """The project timeline (idea #111): one thin axis over the months, a dot where each project
    started (the dates are months, so the dot sits mid-month) and a bar for one that has an end,
    plus a ring for today. Labels go above the axis, or below when they would touch."""
    m = MODES[page]
    items = timeline_items(facts)
    if not items:
        return None, ""
    w, h = 680, 132
    y0 = ym(items[0][2])[0]
    end_y, end_m = today.year, today.month
    for _k, _n, _f, to in items:
        if to:
            end_y, end_m = max((end_y, end_m), ym(to)[:2])
    months = (end_y - y0) * 12 + end_m + 1          # January of the first year to the month after the last
    left, right = 24, w - 24
    unit = (right - left) / months

    def xm(y, mo, frac=0.0):
        return left + ((y - y0) * 12 + mo - 1 + frac) * unit
    ax = 72
    warm = "#ffb37a" if m["page"] == "dark" else "#d0532f"
    defs = lin(f"{p}-ax", [(0, m["indigo"], .2), (.5, m["violet"], .6), (1, m["teal"], .2)], left, 0, right, 0,
               units="userSpaceOnUse")
    c = (f'<rect x="{left}" y="{ax - .5}" width="{right - left}" height="1" fill="url(#{p}-ax)"/>'
         + T(left, 24, str(y0), 11, m["fg3"], weight=650, ls=.5))
    for i in range(months):
        y_, mo = y0 + i // 12, i % 12 + 1
        x = xm(y_, mo)
        c += (f'<rect x="{num(x)}" y="{ax - 2.5}" width="1" height="5" {paint(m["line2"])}/>'
              + T(x + unit / 2, 121, MONTHS[mo - 1][:3] if mo != 1 or i == 0 else str(y_), 10, m["fg3"], weight=600,
                  anchor="middle"))
    taken = {"up": [], "down": []}

    def free(side, a, b):
        return not any(a < q1 and q0 < b for q0, q1 in taken[side])
    for key, name, frm, to in items:
        ink = warm if TIMELINE_INK.get(key) == "warm" else m[TIMELINE_INK.get(key, "indigo")]
        fy, fm, _ = ym(frm)
        when = span_text(frm, to)
        lw = tw(name, "s12.5") + 7 + tw(when, "s11") + 6
        if to:
            ty, tm, _ = ym(to)
            x0, x1 = xm(fy, fm, .1), xm(ty, tm, .9)
            c += rrect(x0, ax - 3, x1 - x0, 6, 3, f'fill="{ink}" fill-opacity=".9"')
            # the connector may sit anywhere on the bar: at its start, or further right if the label must end at the edge
            x = min(x0 + 3, max(x0 + 3, x1 - 3), right - lw - 5)
            x = max(x, x0 + 3) if x1 - 3 >= x0 + 3 else x0 + 3
            lx = min(x + 5, right - lw)
        else:
            x = xm(fy, fm, .5)
            c += (f'<circle cx="{num(x)}" cy="{ax}" r="7.5" fill="{ink}" fill-opacity=".16"/>'
                  f'<circle cx="{num(x)}" cy="{ax}" r="3.6" fill="{ink}"/>')
            lx = min(x + 5, right - lw)          # near the right edge the label slides left of its dot
        side = "up" if free("up", lx - 10, lx + lw) else "down"
        taken[side].append((lx - 10, lx + lw))
        if side == "up":
            c += f'<rect x="{num(x - .5)}" y="{ax - 24}" width="1" height="18" fill="{ink}" fill-opacity=".5"/>'
            ly = 42
        else:
            c += f'<rect x="{num(x - .5)}" y="{ax + 6}" width="1" height="12" fill="{ink}" fill-opacity=".5"/>'
            ly = 103
        c += (T(lx, ly, name, 12.5, m["fg"], weight=650, ls=-.06)
              + T(lx + tw(name, "s12.5") + 7, ly, when, 11, m["fg2"], weight=500))
    # today: a small ring on the axis, its label wherever there is room
    tx = xm(today.year, today.month, (today.day - .5) / 31)
    c += (f'<circle cx="{num(tx)}" cy="{ax}" r="3.4" fill="{m["bg2"]}" stroke="{m["fg2"]}" stroke-width="1.3"/>')
    lw = tw("today", "s11")
    for side, ly in (("down", 94), ("up", 56)):
        if free(side, tx - lw / 2 - 4, tx + lw / 2 + 4):
            c += T(tx, ly, "today", 10, m["fg3"], weight=600, anchor="middle")
            break
    d, b = widget(m, p, w, h, c, False, defs)

    def long_span(frm, to):
        if not to:
            return f"from {when_long(frm)}"
        return f"from {when_long(frm)} to {when_long(to)}"
    label = "Timeline of my projects: " + "; ".join(f"{n} {long_span(f, t)}" for _k, n, f, t in items) + "."
    return standalone(w, h, label, d, b), label


BADGES = {"linkedin": ("in", "LinkedIn"), "site": ("globe", "Website"), "email": ("mail", "Email"),
          "guestbook": ("chat", "Guestbook")}


def badge_text(key, facts):
    lk = facts["links"]
    return {"linkedin": lk["linkedin_short"], "site": facts["site"]["domain"], "email": lk["email"],
            "guestbook": "Guestbook"}[key]


def badge(page, key, facts):
    """A contact badge (idea #109), drawn here instead of borrowed from a badge service: a pill
    with the glyph and the address, in the widgets' style. The README keeps the address as the
    image's alt text, so screen readers read the link."""
    m = MODES[page]
    icon, kind = BADGES[key]
    text = badge_text(key, facts)
    h = 28
    w = math.ceil(11 + 14 + 7 + tw(text, "lane") + 13)
    defs = lin("bg-e", [(0, m["indigo"], .55), (.5, m["edge"][1]), (1, m["teal"], .45)], 0, 0, w, 0, units="userSpaceOnUse")
    body = (rrect(0, 0, w, h, h / 2, 'fill="url(#bg-e)"') + rrect(1, 1, w - 2, h - 2, h / 2 - 1, f'fill="{m["bg2"]}"')
            + icon16(icon, 11, 7, 14, m["indigo"])
            + T(32, 18.5, text, 12.5, m["fg"], weight=600, ls=.06))
    label = f"{kind}: {text}" if key != "guestbook" else "Guestbook: leave me a note on my interactive page"
    return standalone(w, h, label, defs, body), label, w


FOOTER = "Images redrawn every night by GitHub Actions · last run {date}"


def footer_size():
    """One width for every date (the README's <img> has fixed dimensions): the widest month and day."""
    widest = max(tw(FOOTER.format(date=f"{mo[:3]} 30, 2026"), "s12.5") for mo in MONTHS) * 12 / 12.5
    return math.ceil(widest) + 6, 18


def footer(page, today):
    """The small print at the bottom (idea #112): when the nightly job last drew these images.
    The README is not rewritten every night, so the date has to be an image."""
    m = MODES[page]
    text = FOOTER.format(date=f"{MONTHS[today.month - 1][:3]} {today.day}, {today.year}")
    w, h = footer_size()
    label = f"The images on this page are redrawn every night by GitHub Actions; last run {when_long(today.isoformat())}."
    return standalone(w, h, label, "", T(1, 13, text, 12, m["fg2"], weight=500)), label, w


# --------------------------------------------------------------------------- 3D preview
def stl_preview(path, w=520, h=250, az=28, elev=38):
    """A flat-shaded 3D drawing of the store STL (boxes, 12 facets each), to preview what
    GitHub's STL viewer shows. Painter's algorithm per box, back faces culled."""
    tris, cur, normal = [], [], None
    with open(path, encoding="utf-8") as f:
        for line in f:
            parts = line.split()
            if not parts:
                continue
            if parts[0] == "facet":
                normal = tuple(float(v) for v in parts[2:5])
                cur = []
            elif parts[0] == "vertex":
                cur.append(tuple(float(v) for v in parts[1:4]))
            elif parts[0] == "endfacet":
                tris.append((normal, cur))
    boxes = [tris[i:i + 12] for i in range(0, len(tris), 12)]
    xs = [v[0] for _, tr in tris for v in tr]
    ys = [v[1] for _, tr in tris for v in tr]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    ca, sa = math.cos(math.radians(az)), math.sin(math.radians(az))
    ce, se = math.cos(math.radians(elev)), math.sin(math.radians(elev))
    view = (sa * ce, ca * ce, se)          # towards the viewer

    def proj(v):
        x, y, z = v[0] - cx, v[1] - cy, v[2] * 1.6
        sx = x * ca - y * sa
        depth = x * sa + y * ca
        sy = depth * se - z * ce
        return sx, sy

    light = (-.3, .55, .78)
    drawn = []
    for bx in boxes:
        zmax = max(v[2] for _, tr in bx for v in tr)
        bc = [sum(v[i] for _, tr in bx for v in tr) / (3 * len(bx)) for i in range(3)]
        key = (0 if zmax < .3 else 1, (bc[0] - cx) * sa + (bc[1] - cy) * ca, bc[2])
        faces = []
        for n, tr in bx:
            if n[0] * view[0] + n[1] * view[1] + n[2] * view[2] <= 0:
                continue
            shade = max(0.0, n[0] * light[0] + n[1] * light[1] + n[2] * light[2])
            base = (38, 44, 72) if zmax < .3 else ((79, 224, 200) if zmax < 2.6 else (144, 149, 255))
            k = .5 + .5 * shade
            col = "#%02x%02x%02x" % tuple(min(255, int(c * k)) for c in base)
            faces.append(([proj(v) for v in tr], col))
        drawn.append((key, faces, zmax))
    drawn.sort(key=lambda q: q[0])
    focus = [pt for key, faces, zmax in drawn if zmax >= .3 for poly, _ in faces for pt in poly]
    fx, fy = [p_[0] for p_ in focus], [p_[1] for p_ in focus]
    sc = min((w - 50) / (max(fx) - min(fx)), (h - 50) / (max(fy) - min(fy)))
    ox, oy = w / 2 - (max(fx) + min(fx)) / 2 * sc, h / 2 - (max(fy) + min(fy)) / 2 * sc
    out = []
    for _, faces, _ in drawn:
        for poly, col in faces:
            d = "M" + " L".join(f"{ox + x * sc:.1f},{oy + y * sc:.1f}" for x, y in poly) + "Z"
            out.append(f'<path d="{d}" fill="{col}" stroke="{col}" stroke-width=".5" stroke-linejoin="round"/>')
    defs = f'<clipPath id="stl-c"><rect width="{w}" height="{h}" rx="12"/></clipPath>'
    return standalone(w, h, "Storewright medium store, 3D model preview", defs,
                      f'<rect width="{w}" height="{h}" rx="12" fill="#0f1116"/><g clip-path="url(#stl-c)">{"".join(out)}</g>')


# --------------------------------------------------------------------------- outputs
def page_list(s):
    """'dark,light' (or the old wallpaper names) -> ('dark', 'light'), without repeats."""
    out = []
    for name in s.split(","):
        name = ALIASES.get(name.strip(), name.strip())
        if name not in MODES:
            raise SystemExit(f"unknown page mode {name!r}; choose from dark, light (old names: {', '.join(ALIASES)})")
        if name not in out:
            out.append(name)
    return tuple(out)


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def build_all(out, at=None, pages=PAGES, modes=("daily",), weather=None):
    """Every file for the output branch. weather only shows on static banners (previews)."""
    facts = load("profile.json")
    tz = ZoneInfo(facts["timezone"])
    now = at or dt.datetime.now(tz)
    day = load("store-day.json")
    store = load("silnest-store.json")
    sky = load("sky-day.json")
    made = []
    for page in pages:
        ws = widget_set(page, facts, day=day, store=store, sky=sky)
        for key, (w, h, d, b, label) in ws:
            name = f"w-{key}-{page}.svg"
            write(os.path.join(out, name), standalone(w, h, label, d, b))
            made.append(name)
        write(os.path.join(out, f"strip-{page}.svg"), strip(ws))
        made.append(f"strip-{page}.svg")
        stack = widget_set(page, facts, day=day, store=store, bare=True, sky=sky)
        for layout in LAYOUTS:
            for weight in WEIGHTS:
                for mode in modes:
                    svg = banner(page, layout, weight, mode, now, stack_widgets=stack if layout == "right" else None,
                                 weather=weather, facts=facts)
                    name = f"banner-{page}-{layout}-{weight}-{mode}.svg"
                    write(os.path.join(out, name), svg)
                    made.append(name)
        write(os.path.join(out, f"unlock-{page}.svg"), unlock_bar(page))
        write(os.path.join(out, f"showcase-storewright-{page}.svg"), showcase_frame(page))
        write(os.path.join(out, f"divider-{page}.svg"), divider(page))
        made += [f"unlock-{page}.svg", f"showcase-storewright-{page}.svg", f"divider-{page}.svg"]
        for k in ICON_ORDER:
            write(os.path.join(out, f"icon-{k}-{page}.svg"), app_icon(k, page, facts))
            made.append(f"icon-{k}-{page}.svg")
        made += write_readme_extras(out, page, facts, now.date())
    return made


def write_readme_extras(out, page, facts, today):
    """The README's milestone cards (#9), skill map (#110), timeline (#111), contact badges (#109,
    #148) and the small print with the date of this run (#112)."""
    made = []
    news = latest_milestones(facts)
    lines = max([len(milestone_lines(it)) for it in news] or [1])
    for i, item in enumerate(news, 1):
        made.append((f"milestone-{i}-{page}.svg", milestone_card(page, item, facts, today, lines)[0]))
    made.append((f"skills-{page}.svg", skills_map(page, facts)[0]))
    made.append((f"timeline-{page}.svg", timeline(page, facts, today)[0]))
    for k in BADGES:
        made.append((f"badge-{k}-{page}.svg", badge(page, k, facts)[0]))
    made.append((f"footer-{page}.svg", footer(page, today)[0]))
    names = []
    for name, svg in made:
        if svg:
            write(os.path.join(out, name), svg)
            names.append(name)
    return names


def _strip_imgs(svg):
    for name, uri in _IMG_CACHE.items():
        svg = svg.replace(uri, "{{IMG:" + name + "}}")
    return svg


def build_templates(out, pages=PAGES, layouts=LAYOUTS, weights=WEIGHTS):
    """Banner templates for the live clock, as one JSON file (and the same as an ES module):
    {"images": {name: data-URI}, "templates": {"dark-below-bold": "<svg ...>"}, "meta": {...}, "aliases": {...},
     "place": {lat, lon}}
    Slots: <!--DATE-->, <!--TIME-->, {{BEGIN_SEC}} and {{SEC_DEG}} (the seconds dot's CSS delay and
    its angle at load), {{ORBIT:<i>:<period>}} and {{ORBIT_DEG:<i>}} (planet i starts at its real
    longitude), {{MOON_KF:ROT|UNROT:<rx>:<ry>:<tilt>}} and {{MOON_DEG:ROT|UNROT:…}} (the Moon beside
    Earth: keyframes and its angle at load), {{MOON_PATH}} (today's phase), {{MOON_GLOW:<opacity>}}
    (the Mid-Autumn glow, idea #150), {{SUN:…}} (the sun glow's colour for the Sun's altitude at
    `place`, idea #97) and {{IMG:name}}; the time slots occur several times. renderLive() fills
    them; meta[key] tells it how to draw AM/PM, the weather and a festival's touch after the date.
    (Older templates used {{PHASE:<period>}}, {{MOON_ROT:…}} and {{MOON_UNROT:…}}; renderLive
    still fills those.)"""
    facts = load("profile.json")
    day = load("store-day.json")
    store = load("silnest-store.json")
    sky = load("sky-day.json")
    templates, meta = {}, {}
    for page in pages:
        stack = widget_set(page, facts, day=day, store=store, bare=True, sky=sky)
        for layout in layouts:
            for weight in weights:
                svg = banner(page, layout, weight, "template", stack_widgets=stack if layout == "right" else None, facts=facts)
                key = f"{page}-{layout}-{weight}"
                templates[key] = _strip_imgs(svg)
                meta[key] = clock_meta(page, layout)
    used = {name for name in _IMG_CACHE if any("{{IMG:" + name + "}}" in s for s in templates.values())}
    place = {k: (sky or {}).get("place", {}).get(k, ALBANY[k]) for k in ("lat", "lon")}
    data = {"timezone": facts["timezone"], "images": {k: v for k, v in _IMG_CACHE.items() if k in used},
            "templates": templates, "meta": meta, "aliases": ALIASES, "place": place,
            "defaults": {"theme": "dark", "layout": "below", "weight": "bold"}}
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, "templates.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    with open(os.path.join(out, "templates.mjs"), "w", encoding="utf-8") as f:
        f.write("// Generated by scripts/lockscreen.py templates. Do not edit.\nexport default " + json.dumps(data, ensure_ascii=False) + ";\n")
    return data


def build_gallery(out):
    """Everything the design gallery needs, with images stored once: banner templates (live
    clock), every widget for each page mode, the unlock pill and the app tiles."""
    facts = load("profile.json")
    data = build_templates(os.path.join(ROOT, "live"))
    day = load("store-day.json")
    store = load("silnest-store.json")
    sky = load("sky-day.json")
    widgets = {page: [{"key": k, "w": w, "h": h, "label": lab, "svg": _strip_imgs(standalone(w, h, lab, d, b))}
                      for k, (w, h, d, b, lab) in widget_set(page, facts, day=day, store=store, sky=sky)] for page in PAGES}
    unlock = {page: unlock_bar(page) for page in PAGES}
    icons = {page: {k: _strip_imgs(app_icon(k, page, facts)) for k in ICON_ORDER} for page in PAGES}
    stl = os.path.join(ROOT, "assets", "store.stl")
    g_stl = stl_preview(stl) if os.path.exists(stl) else ""
    sw, lk = facts["storewright"], facts["links"]
    g = {"style": "r3-dusk", "pages": list(PAGES), "layouts": list(LAYOUTS), "weights": list(WEIGHTS),
         "icons": icons, "iconOrder": ICON_ORDER, "iconLabels": icon_labels(facts), "iconSize": [84, 98],
         "unlockSize": [262, 50], "stl": g_stl,
         "timezone": data["timezone"], "images": dict(_IMG_CACHE), "banners": data["templates"],
         "meta": data["meta"], "widgets": widgets, "unlock": unlock,
         "links": {"silnest": facts["silnest"]["store_url"], "storewright": sw["demo"],
                   "store-day": sw["repo"], "accuracy": sw["repo"], "site": lk["site"], "vocal": "",
                   "sky": lk["pages"].rstrip("/") + "/#sky", "contact": lk["linkedin"]},
         "iconLinks": {"silnest": facts["silnest"]["store_url"], "storewright": sw["repo"], "site": lk["site"],
                       "vocal": "", "howiwork": "#how-i-work",
                       "earlywork": (facts.get("early_work") or {}).get("url", "https://github.com/Glacieerr?tab=repositories"),
                       "contact": lk["linkedin"]}}
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, "gallery-data.json"), "w", encoding="utf-8") as f:
        json.dump(g, f, ensure_ascii=False)
    return g


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("what", choices=["all", "templates", "gallery"])
    ap.add_argument("--out", default="out")
    ap.add_argument("--at", help="Albany local time, e.g. 2026-11-13T22:55:07 (default: now)")
    ap.add_argument("--pages", "--themes", dest="pages", default=",".join(PAGES),
                    help="page modes to draw: dark,light (the old wallpaper names still work)")
    ap.add_argument("--with-static", action="store_true", help="also write banners frozen at --at (for screenshots only)")
    ap.add_argument("--weather", help='an example weather label for the static banners, e.g. "☁︎ 41°F" (previews only)')
    a = ap.parse_args()
    out = a.out if os.path.isabs(a.out) else os.path.join(ROOT, a.out)
    pages = page_list(a.pages)
    if a.what == "all":
        tz = ZoneInfo(load("profile.json")["timezone"])
        at = dt.datetime.fromisoformat(a.at) if a.at else None
        if at is not None:   # an offset (Z, -05:00) is kept; without one it is Albany time (idea #177)
            at = at.astimezone(tz) if at.tzinfo else at.replace(tzinfo=tz)
        made = build_all(out, at, pages, ("daily", "static") if a.with_static else ("daily",), weather=a.weather)
        print(f"wrote {len(made)} files to {out}")
    elif a.what == "gallery":
        g = build_gallery(out)
        n = sum(len(v) for v in g["widgets"].values())
        print(f"wrote gallery-data.json ({n} widgets, {len(g['banners'])} banners)")
    else:
        data = build_templates(out, pages)
        print(f"wrote {len(data['templates'])} templates to {out}/templates.json")


if __name__ == "__main__":
    main()
