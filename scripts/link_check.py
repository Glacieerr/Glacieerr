#!/usr/bin/env python3
"""The monthly link check (idea #168): every outside link in the README, HOW-IT-WORKS.md and
the interactive page (pages/dist/index.html, read only) still answers.

Run by .github/workflows/monthly.yml. A link that fails three tries opens an issue (or adds a
comment to the open one); a clean month closes it. Sites that turn automated visitors away
(LinkedIn answers 999) are listed as reminders to check by hand, never as failures. Images are
the nightly self-check's job (self_check.py), so they are skipped here.

  python3 scripts/link_check.py --list         # the links it would check, no network
  python3 scripts/link_check.py --dry-run      # check them; print the issue instead of opening it
"""
from __future__ import annotations

import argparse
import html
import os
import re
import sys
import urllib.parse

sys.dont_write_bytecode = True   # importing a sibling script leaves no __pycache__ in the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from net import fetch  # noqa: E402
import gh_issue  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCES = ["README.md", "HOW-IT-WORKS.md", "pages/dist/index.html"]
TITLE = "Monthly link check: a link on the profile is broken"
# not links a visitor follows: XML namespaces, the guestbook's script, the images (self_check.py)
SKIP = re.compile(r"^http://www\.w3\.org/|^https://giscus\.app/client\.js|^https://raw\.githubusercontent\.com/"
                  r"|/badge\.svg$|\.\.\.$|[{}<>`]")
# sites that refuse automated visitors: a reminder, not a failure
SHY = re.compile(r"^https://([a-z]+\.)?linkedin\.com/")


def links_in(path):
    """Outside http(s) links in a Markdown or HTML file: Markdown links, href attributes, and the
    URL strings of the interactive page's data block."""
    try:
        text = open(os.path.join(ROOT, path), encoding="utf-8").read()
    except OSError:
        return []
    text = re.sub(r"```stl.*?```", "", text, flags=re.S)
    found = re.findall(r"\]\((https?://[^)\s]+)\)", text)
    found += re.findall(r'href="(https?://[^"]+)"', text)
    found += re.findall(r'"(https?://[^"\\\s]+)"', text) if path.endswith(".html") else []
    found += re.findall(r"(?<![(\"'=])\b(https?://[^\s)<>\"'`]+)", text) if path.endswith(".md") else []
    out = []
    for u in found:
        u = html.unescape(u)
        if SKIP.search(u):
            continue
        # one check per page: the fragment (#sky, #readme) is the browser's business
        out.append(urllib.parse.urldefrag(u.rstrip(".,;:"))[0])
    return out


def check(url):
    """('ok' | 'shy' | 'bad', detail) for one link: HEAD, then GET when a server dislikes HEAD."""
    r = fetch(url, method="HEAD", timeout=20, tries=3, wait=5)
    if r.status in (0, 400, 403, 404, 405, 406, 429, 501, 999) or r.status >= 500:
        r = fetch(url, timeout=25, tries=3, wait=5, limit=65_536)
    if r.ok or 300 <= r.status < 400:
        return "ok", str(r.status)
    if SHY.match(url) or r.status in (429, 999):
        return "shy", r.error or f"HTTP {r.status}"
    return "bad", r.error or f"HTTP {r.status}"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--list", action="store_true", help="only list the links (no network)")
    ap.add_argument("--issue", action="store_true", help="open an issue for broken links; close it when clean")
    ap.add_argument("--dry-run", action="store_true", help="print the issue instead of opening it")
    a = ap.parse_args()
    where = {}
    for src in SOURCES:
        for u in links_in(src):
            where.setdefault(u, []).append(src)
    links = sorted(where)
    if a.list:
        for u in links:
            print(f"{u}    ({', '.join(sorted(set(where[u])))})")
        print(f"{len(links)} links")
        return 0
    bad, shy = [], []
    for u in links:
        kind, detail = check(u)
        print(f"{kind:4} {detail:>14}  {u}")
        if kind == "bad":
            bad.append(f"{u}: {detail} (in {', '.join(sorted(set(where[u])))})")
        elif kind == "shy":
            shy.append(f"{u}: {detail}; this site turns automated checks away, so open it by hand once")
    print(f"{len(links)} links: {len(bad)} broken, {len(shy)} to check by hand")
    if a.issue:
        if bad:
            body = ("The monthly link check (`scripts/link_check.py`, `.github/workflows/monthly.yml`) could not open "
                    "these links after three tries:\n\n" + "\n".join(f"- {b}" for b in bad)
                    + ("\n\nTo check by hand (not failures):\n\n" + "\n".join(f"- {s}" for s in shy) if shy else ""))
            gh_issue.report(TITLE, body, dry_run=a.dry_run)
        else:
            gh_issue.resolve(TITLE, "This month every link answered.", dry_run=a.dry_run)
    return 0


if __name__ == "__main__":
    sys.exit(main())
