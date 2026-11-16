"""Open, update or close one issue per check in this repository (standard library only).

Used by self_check.py (idea #123) and link_check.py (idea #168). In GitHub Actions the token is
the workflow's GITHUB_TOKEN (the job needs `permissions: issues: write`) and the repository is
GITHUB_REPOSITORY. With dry_run, or without a token, nothing is sent: it prints what it would do.

An issue belongs to a check by its title, which never changes, so a second problem adds a
comment to the open issue instead of opening another; when the check passes again the issue is
closed with a comment.
"""
from __future__ import annotations

import json
import os

from net import fetch

API = "https://api.github.com"


def _token():
    return os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")


def _call(method, path, token, body=None):
    headers = {"Accept": "application/vnd.github+json", "Authorization": f"Bearer {token}",
               "X-GitHub-Api-Version": "2022-11-28"}
    data = json.dumps(body).encode() if body is not None else None
    if data:
        headers["Content-Type"] = "application/json"
    r = fetch(API + path, method=method, headers=headers, data=data, timeout=20, tries=2)
    if not r.ok:
        raise RuntimeError(f"GitHub API {method} {path}: {r.error or r.status} {r.body[:200]!r}")
    return json.loads(r.body or b"null")


def _find(repo, title, token):
    """The open issue with this exact title (a profile repo has few issues; pull requests skipped)."""
    for page in range(1, 4):
        items = _call("GET", f"/repos/{repo}/issues?state=open&per_page=100&page={page}", token) or []
        for it in items:
            if it.get("title") == title and "pull_request" not in it:
                return it
        if len(items) < 100:
            break
    return None


def report(title, body, label="profile-check", dry_run=False, repo=None):
    """Open the issue `title` with `body`, or comment on it if it is already open."""
    repo = repo or os.environ.get("GITHUB_REPOSITORY")
    token = _token()
    if dry_run or not token or not repo:
        why = "dry run" if dry_run else "no token or repository"
        print(f"[{why}] would open or update the issue {title!r} in {repo or '<repo>'}:\n{body}\n")
        return None
    open_ = _find(repo, title, token)
    if open_:
        _call("POST", f"/repos/{repo}/issues/{open_['number']}/comments", token, {"body": body})
        print(f"commented on issue #{open_['number']} ({title})")
        return open_["number"]
    made = _call("POST", f"/repos/{repo}/issues", token, {"title": title, "body": body, "labels": [label]})
    print(f"opened issue #{made['number']} ({title})")
    return made["number"]


def resolve(title, note, dry_run=False, repo=None):
    """Close the issue `title` with a comment, if one is open."""
    repo = repo or os.environ.get("GITHUB_REPOSITORY")
    token = _token()
    if dry_run or not token or not repo:
        print(f"[{'dry run' if dry_run else 'no token or repository'}] would close the issue {title!r} if open: {note}")
        return None
    open_ = _find(repo, title, token)
    if not open_:
        return None
    _call("POST", f"/repos/{repo}/issues/{open_['number']}/comments", token, {"body": note})
    _call("PATCH", f"/repos/{repo}/issues/{open_['number']}", token, {"state": "closed"})
    print(f"closed issue #{open_['number']} ({title})")
    return open_["number"]
