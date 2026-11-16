#!/usr/bin/env python3
"""Fetch the small pieces of live data the widgets show, into data/*.json.

Standard library only. Every fetch is optional: on any error the previous file stays
and the widgets fall back to the facts in data/profile.json.

  python3 scripts/fetch_data.py            # SilNest on the App Store: version, dates, release notes

data/silnest-store.json keeps:
  version, released, updated, minimumOs, price   as before
  releaseNotes   the notes of the version on the App Store (idea #171): {version, date, at, text};
                 text is null when Apple has none (version 1.0 has none), and pages show nothing then
"""
import json
import os
import sys

sys.dont_write_bytecode = True   # importing a sibling script leaves no __pycache__ in the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from net import fetch  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def save(name, data):
    path = os.path.join(ROOT, "data", name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"wrote data/{name}: {json.dumps(data, ensure_ascii=False)[:300]}")


def silnest_store(app_id):
    """Version, dates and release notes from Apple's public iTunes Lookup API (no key needed)."""
    r = fetch(f"https://itunes.apple.com/lookup?id={app_id}&country=us", timeout=15, tries=2)
    if not r.ok:
        raise RuntimeError(r.error or f"HTTP {r.status}")
    d = json.loads(r.body)
    if not d.get("resultCount"):
        raise RuntimeError("app not found")
    a = d["results"][0]
    notes = (a.get("releaseNotes") or "").strip()
    current = a.get("currentVersionReleaseDate") or a["releaseDate"]
    return {
        "version": a["version"],
        "released": a["releaseDate"][:10],
        "updated": current[:10],
        "minimumOs": a.get("minimumOsVersion"),
        "price": a.get("price"),
        "releaseNotes": {"version": a["version"], "date": current[:10], "at": current, "text": notes or None},
    }


def main():
    with open(os.path.join(ROOT, "data", "profile.json"), encoding="utf-8") as f:
        facts = json.load(f)
    try:
        save("silnest-store.json", silnest_store(facts["silnest"]["app_id"]))
    except Exception as e:  # keep yesterday's file
        print(f"App Store lookup failed, keeping the old data: {e}", file=sys.stderr)
    return 0  # never fail the workflow over optional data


if __name__ == "__main__":
    sys.exit(main())
