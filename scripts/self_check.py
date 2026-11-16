#!/usr/bin/env python3
"""The nightly self-check (idea #123): is every image in the README there and a real SVG?

Run by .github/workflows/daily.yml after the images are drawn and before they are published.

  local  (always)    every image the README takes from the output branch is in out/, parses as
                     SVG, has a size, carries no script and loads nothing from outside, and stays
                     within the size budget (banner 250 KB, widget 120 KB, anything else 250 KB).
                     A problem here exits 1, so the night's images are not published and
                     yesterday's stay up.
  online (--online)  every image URL in the README answers 200 with an image (raw.githubusercontent
                     for the output branch, the live banner function when the README uses it,
                     GitHub's badge). An image that is new tonight (not in the last run's list) is
                     not published yet, so its 404 does not count.
  schedule           (--repo, with a token) GitHub turns off scheduled workflows in a public
                     repository after 60 days without activity (idea #124); 50 days after the
                     last commit on the default branch this says so.

The result goes to --state-out (published with the images as self-check.json); with --issue a
problem that shows up on two runs in a row opens an issue (one flaky night does not), and the
issue is closed when a run is clean again. --dry-run prints the issue instead of opening it.

  python3 scripts/self_check.py --out out                      # local checks only
  python3 scripts/self_check.py --out out --online --dry-run   # also online; print, open nothing
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
import xml.etree.ElementTree as ET

sys.dont_write_bytecode = True   # importing a sibling script leaves no __pycache__ in the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from net import fetch  # noqa: E402
import gh_issue  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT = re.compile(r"^https://raw\.githubusercontent\.com/[^/]+/[^/]+/output/([\w.-]+)$")
TITLE = "Profile self-check: something on the README is broken"
BUDGET = {"banner-": 250_000, "w-": 120_000}
INACTIVE_WARN_DAYS = 50


def readme_images(text):
    """Every image URL in the README: <img src>, <source srcset> and Markdown images."""
    urls = re.findall(r'<img\b[^>]*\bsrc="([^"]+)"', text) + re.findall(r'<source\b[^>]*\bsrcset="([^"]+)"', text)
    urls += [m.group(1) for m in re.finditer(r"!\[[^\]]*\]\(([^)\s]+)\)", text)]
    return sorted(set(u.replace("&amp;", "&") for u in urls))


def check_svg(path):
    """Problems with one SVG file (empty list when fine)."""
    name = os.path.basename(path)
    if not os.path.exists(path):
        return [f"{name}: not in out/ (the README links it)"]
    raw = open(path, "rb").read()
    problems = []
    try:
        root = ET.fromstring(raw)
    except ET.ParseError as e:
        return [f"{name}: not valid XML ({e})"]
    if not root.tag.endswith("svg"):
        problems.append(f"{name}: the root element is <{root.tag}>, not <svg>")
    if not (root.get("width") and root.get("height")):
        problems.append(f"{name}: no width or height")
    text = raw.decode("utf-8", "replace")
    if "<script" in text:
        problems.append(f"{name}: contains a script (an image must not)")
    if re.search(r'(?:href|src)="(?:https?:)?//|url\((?:["\']?)https?:', text):
        problems.append(f"{name}: loads something from outside (GitHub shows it as an image, so it would not load)")
    limit = next((v for k, v in BUDGET.items() if name.startswith(k)), 250_000)
    if len(raw) > limit:
        problems.append(f"{name}: {len(raw) // 1000} KB, over its {limit // 1000} KB budget")
    return problems


def check_online(urls, known):
    """Problems with the published images (a URL not in `known` that answers 404 is new, so skipped)."""
    problems, ok = [], []
    for url in urls:
        r = fetch(url, timeout=20, tries=3, wait=5, limit=600_000)
        name = url.rsplit("/", 1)[-1]
        if r.status == 404 and OUTPUT.match(url) and url not in known:
            print(f"  new tonight, not published yet: {name}")
            continue
        if not r.ok:
            problems.append(f"{url}: {r.error or f'HTTP {r.status}'}")
            continue
        head = r.body[:400].lstrip()
        if not (r.type.startswith("image/") or (r.type in ("text/plain", "application/octet-stream") and head.startswith(b"<svg"))):
            problems.append(f"{url}: answers {r.type or 'no content type'}, not an image")
            continue
        if url.endswith(".svg") or r.type == "image/svg+xml":
            if not (head.startswith(b"<svg") or head.startswith(b"<?xml")):
                problems.append(f"{url}: does not start like an SVG")
                continue
            if b"{{" in r.body and not OUTPUT.match(url):
                problems.append(f"{url}: the live banner still has unfilled slots ({{{{...}}}})")
                continue
        ok.append(url)
    return problems, ok


def days_since_last_commit(repo):
    """Days since the newest commit on the default branch (None without a token or on error)."""
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if not token or not repo:
        return None
    r = fetch(f"https://api.github.com/repos/{repo}/commits?per_page=1",
              headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}, tries=2)
    if not r.ok:
        return None
    try:
        when = json.loads(r.body)[0]["commit"]["committer"]["date"]
    except (ValueError, LookupError, TypeError):
        return None
    return (dt.datetime.now(dt.timezone.utc) - dt.datetime.fromisoformat(when.replace("Z", "+00:00"))).days


def load_state(where):
    """The last run's self-check.json, from a path or a URL; {} when there is none."""
    if not where:
        return {}
    try:
        if re.match(r"https?://", where):
            r = fetch(where, timeout=15, tries=2)
            return json.loads(r.body) if r.ok else {}
        with open(where, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--readme", default="README.md")
    ap.add_argument("--out", default="out", help="the images about to be published")
    ap.add_argument("--online", action="store_true", help="also fetch every image URL in the README")
    ap.add_argument("--repo", default=os.environ.get("GITHUB_REPOSITORY"), help="owner/name, for the schedule check")
    ap.add_argument("--state-in", help="the last run's self-check.json (path or URL)")
    ap.add_argument("--state-out", help="where to write this run's self-check.json")
    ap.add_argument("--issue", action="store_true", help="open an issue after two bad runs in a row; close it when clean")
    ap.add_argument("--dry-run", action="store_true", help="print the issue instead of opening it")
    a = ap.parse_args()
    path = lambda p: p if os.path.isabs(p) else os.path.join(ROOT, p)  # noqa: E731
    with open(path(a.readme), encoding="utf-8") as f:
        urls = readme_images(f.read())
    out = path(a.out)
    prev = load_state(a.state_in)

    local = []
    for url in urls:
        m = OUTPUT.match(url)
        if m:
            local += check_svg(os.path.join(out, m.group(1)))
    print(f"local: {len([u for u in urls if OUTPUT.match(u)])} images from the output branch, "
          f"{'all fine' if not local else f'{len(local)} problem(s)'}")

    online, ok = [], []
    if a.online:
        online, ok = check_online(urls, set(prev.get("ok", [])))
        print(f"online: {len(urls)} image URLs, {'all fine' if not online else f'{len(online)} problem(s)'}")

    notes = []
    idle = days_since_last_commit(a.repo)
    if idle is not None and idle >= INACTIVE_WARN_DAYS:
        notes.append(f"The last commit on the default branch was {idle} days ago. GitHub turns off scheduled workflows "
                     f"in a public repository after 60 days without activity, and then these images stop updating. "
                     f"Push any commit, or re-enable the workflow in the Actions tab (idea #124).")

    problems = local + online
    streak = (int(prev.get("streak", 0)) + 1) if (problems or notes) else 0
    state = {"date": dt.date.today().isoformat(), "streak": streak, "problems": problems, "notes": notes,
             "ok": sorted(set(ok) | (set(prev.get("ok", [])) if not a.online else set()))}
    if a.state_out:
        with open(path(a.state_out), "w", encoding="utf-8") as f:
            json.dump(state, f, indent=1)
            f.write("\n")
    for p in problems + notes:
        print(f"  - {p}")

    if a.issue:
        if (problems or notes) and streak >= 2:
            body = ("The nightly self-check found this on two runs in a row:\n\n"
                    + "\n".join(f"- {p}" for p in problems + notes)
                    + "\n\nIt runs in `.github/workflows/daily.yml` (`scripts/self_check.py`). This issue closes itself "
                      "when a night is clean again.")
            gh_issue.report(TITLE, body, dry_run=a.dry_run, repo=a.repo)
        elif problems or notes:
            print("first bad run: an issue opens if the next run finds a problem too")
        else:
            gh_issue.resolve(TITLE, "The nightly self-check is clean again.", dry_run=a.dry_run, repo=a.repo)
    return 1 if local else 0


if __name__ == "__main__":
    sys.exit(main())
