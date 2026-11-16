#!/usr/bin/env python3
"""Keep the scheduled workflows switched on (idea #124).

GitHub turns off a public repository's scheduled workflows after 60 days without activity;
whether the nightly bot commits to the output branch count as activity is not documented, so
once a month this asks GitHub's API to enable each scheduled workflow (harmless when it is
already on). Run by .github/workflows/monthly.yml, which needs `permissions: actions: write`.
Whether this alone keeps the schedule alive has to be watched after go-live; the nightly
self-check (self_check.py) also opens an issue 50 days after the last commit, as a backstop.

  python3 scripts/keepalive.py --dry-run          # print the calls, send nothing
"""
from __future__ import annotations

import argparse
import json
import os
import sys

sys.dont_write_bytecode = True   # importing a sibling script leaves no __pycache__ in the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from net import fetch  # noqa: E402

API = "https://api.github.com"
WORKFLOWS = ["daily.yml", "monthly.yml"]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--repo", default=os.environ.get("GITHUB_REPOSITORY"))
    ap.add_argument("--workflows", default=",".join(WORKFLOWS))
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    files = [w.strip() for w in a.workflows.split(",") if w.strip()]
    if a.dry_run or not token or not a.repo:
        why = "dry run" if a.dry_run else "no token or repository"
        for w in files:
            print(f"[{why}] GET {API}/repos/{a.repo or '<repo>'}/actions/workflows/{w}  (state)")
            print(f"[{why}] PUT {API}/repos/{a.repo or '<repo>'}/actions/workflows/{w}/enable")
        return 0
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json",
               "X-GitHub-Api-Version": "2022-11-28"}
    bad = 0
    for w in files:
        r = fetch(f"{API}/repos/{a.repo}/actions/workflows/{w}", headers=headers, tries=2)
        state = json.loads(r.body).get("state") if r.ok else f"unknown ({r.error or r.status})"
        e = fetch(f"{API}/repos/{a.repo}/actions/workflows/{w}/enable", method="PUT", headers=headers, data=b"", tries=2)
        print(f"{w}: was {state}; enable -> {'ok' if e.status == 204 else (e.error or e.status)}")
        bad += e.status != 204
    if bad:
        print("::warning::could not enable every workflow; check the workflow's permissions (actions: write)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
