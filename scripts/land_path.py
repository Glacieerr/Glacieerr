#!/usr/bin/env python3
"""Land outlines for the interactive page's day and night map (idea #142), from Natural Earth.

    python3 -I scripts/land_path.py <path to ne_110m_land.geojson>      writes pages/src/land.txt
    python3 -I scripts/land_path.py <geojson> --out FILE                 somewhere else
    python3 -I scripts/land_path.py <geojson> --step 4 --tolerance 0.15 --min-area 0.2   (the defaults)

The input is Natural Earth's 1:110m land layer (public domain), downloaded once by hand from
https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson
and kept out of the repository; this script reads it as data (JSON only, nothing in it is run).
It writes one SVG path for the Clock app's 360 x 180 equirectangular map (x = longitude + 180,
y = 90 - latitude, in degrees), as small as the map allows:

  - each ring is simplified with the Ramer-Douglas-Peucker rule (--tolerance, in degrees: a
    point that moves the outline by less than that is dropped),
  - the points are rounded to 1/--step of a degree and written as whole numbers (the page draws
    the path at scale 1/step), relative to the point before, so most take four or five bytes,
  - islands smaller than --min-area square degrees are left out.

The rings keep Natural Earth's order; holes (a lake inside a continent) need fill-rule evenodd.
The file's first line says where the outlines come from; the second has the path. Python
standard library only.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "pages" / "src" / "land.txt"
SOURCE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson"


def rings_of(collection: dict) -> list[list[tuple[float, float]]]:
    """Every ring of every Polygon and MultiPolygon in a GeoJSON FeatureCollection."""
    if not isinstance(collection, dict) or collection.get("type") != "FeatureCollection":
        raise SystemExit("land_path: not a GeoJSON FeatureCollection")
    out = []
    for f in collection.get("features") or []:
        g = (f or {}).get("geometry") or {}
        polys = [g.get("coordinates")] if g.get("type") == "Polygon" else g.get("coordinates") if g.get("type") == "MultiPolygon" else None
        if polys is None:
            raise SystemExit(f"land_path: a feature of type {g.get('type')!r}; only Polygon and MultiPolygon are expected")
        for poly in polys:
            for ring in poly:
                pts = [(float(p[0]), float(p[1])) for p in ring]
                if not all(-180 <= x <= 180 and -90 <= y <= 90 for x, y in pts):
                    raise SystemExit("land_path: a coordinate outside longitude -180..180, latitude -90..90")
                out.append(pts)
    return out


def area(pts: list[tuple[float, float]]) -> float:
    """The ring's area in square degrees (shoelace; the map is equirectangular)."""
    return abs(sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]))) / 2


def simplify(pts: list[tuple[float, float]], tol: float) -> list[tuple[float, float]]:
    """Ramer-Douglas-Peucker on an open polyline (iterative, so long coasts do not recurse deep)."""
    if len(pts) < 3 or tol <= 0:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        (ax, ay), (bx, by) = pts[a], pts[b]
        dx, dy = bx - ax, by - ay
        n = math.hypot(dx, dy)
        far, at = -1.0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            d = abs(dy * (px - ax) - dx * (py - ay)) / n if n else math.hypot(px - ax, py - ay)
            if d > far:
                far, at = d, i
        if far > tol:
            keep[at] = True
            stack += [(a, at), (at, b)]
    return [p for p, k in zip(pts, keep) if k]


def ring_path(pts: list[tuple[float, float]], step: int, tol: float) -> tuple[str, int] | None:
    """One ring as "M x y dx dy ... z" in whole 1/step degrees, or None if nothing is left."""
    if pts[0] == pts[-1]:
        pts = pts[:-1]
    # split the closed ring at its point farthest from the first, so both halves keep their ends
    far = max(range(len(pts)), key=lambda i: (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2)
    line = simplify(pts[:far + 1], tol)[:-1] + simplify(pts[far:] + pts[:1], tol)[:-1]
    q = []
    for lon, lat in line:
        p = (round((lon + 180) * step), round((90 - lat) * step))
        if not q or p != q[-1]:
            q.append(p)
    while len(q) > 1 and q[-1] == q[0]:
        q.pop()
    if len(q) < 3:
        return None
    steps = []
    for (x0, y0), (x1, y1) in zip(q, q[1:]):
        steps += [x1 - x0, y1 - y0]
    return f"M{q[0][0]} {q[0][1]}l{join_numbers(steps)}z", len(q)


def join_numbers(nums: list[int]) -> str:
    """Whole numbers for SVG path data: a space between two, none before a minus sign."""
    out = ""
    for v in nums:
        out += f" {v}" if out and v >= 0 else str(v)
    return out


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Natural Earth land as one compact SVG path for the 360 x 180 map (see the top of this file).")
    ap.add_argument("geojson", type=Path, help="ne_110m_land.geojson, downloaded from Natural Earth")
    ap.add_argument("--out", type=Path, default=OUT, help="where to write (default: pages/src/land.txt)")
    ap.add_argument("--step", type=int, default=4, help="points per degree after rounding (default 4: a quarter of a degree)")
    ap.add_argument("--tolerance", type=float, default=0.15, help="simplification tolerance in degrees (default 0.15)")
    ap.add_argument("--min-area", type=float, default=0.2, help="leave out islands smaller than this many square degrees (default 0.2)")
    a = ap.parse_args(argv)
    raw = a.geojson.read_bytes()
    if len(raw) > 5_000_000:
        raise SystemExit("land_path: the file is far larger than Natural Earth's 1:110m land layer (about 138 KB)")
    rings = rings_of(json.loads(raw.decode("utf-8")))
    parts, kept, dropped, points = [], 0, 0, 0
    for r in rings:
        if area(r) < a.min_area:
            dropped += 1
            continue
        got = ring_path(r, a.step, a.tolerance)
        if not got:
            dropped += 1
            continue
        parts.append(got[0])
        kept += 1
        points += got[1]
    d = "".join(parts)
    head = (f"# Land outlines: Natural Earth 1:110m land, {a.geojson.name} ({SOURCE}), public domain. Made by scripts/land_path.py "
            f"for the 360 x 180 map at scale 1/{a.step} (x = longitude + 180, y = 90 - latitude): simplified to {a.tolerance} degrees, "
            f"islands under {a.min_area} square degrees left out; {kept} of {len(rings)} rings, {points} points. Do not edit by hand.")
    a.out.parent.mkdir(parents=True, exist_ok=True)
    a.out.write_text(f"{head}\n{d}\n", encoding="utf-8")
    print(f"land_path: wrote {a.out} ({len(d.encode()) / 1024:.1f} KB of path: {kept} rings, {points} points; {dropped} small rings left out)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
