#!/usr/bin/env python3
"""Fact-consistency check (idea #183): every date, version, count and name the profile states
must match the canonical facts in data/facts.json, which are copied from 事实清单.md (the only
source of truth), and none of the phrases 事实清单 bans may come back.

What it reads
  In this repository (also on CI, .github/workflows/pages.yml):
    README.md, HOW-IT-WORKS.md, data/profile.json and pages/src/copy.json (its {{placeholders}}
    filled from the data files the way pages/build.py fills them), plus the structured data in
    data/profile.json, data/silnest-store.json and data/project-numbers.json.
  On the owner's Mac, when the job-search folder two levels up is there (it holds 事实清单.md):
    the resume content (_source/content_*.js), the LinkedIn draft (only the proposed text: the
    "改成" column and the text blocks that are not marked "现在"), and the R3.3 deliverables
    (the texts and SVG text in R3.3素材, and the three drafts they edited in place). There it
    also checks that data/facts.json still agrees with 事实清单.md.

The rules (data/facts.json, "rules" and "banned")
  banned     a phrase from 事实清单's banned block; some groups only in the resumes and LinkedIn
  assistant  the duty assistant's benchmark numbers (76.3%, 42.5%, 61/80 ...) appear only with
             "duty assistant" and its part (StoreX Chain, the regional supply chain), never as
             the store's AI
  dates      project date ranges, months and days, checked against the project mentioned nearest
             (not in a "source" string of a JSON file: that says where a fact comes from and when
             it was stated or checked, such as "The user's statement of 2026-11-15")
  versions   SilNest 1.0; Storewright v1.0 (and 0.2.0 / 0.1.0 for its other parts)
  counts     800+ tests, 83 end-to-end runs, 27 decision records, 80/320 questions, 61/80 ...,
             iOS 17.0, the App Store id, the number of cities (counted in live/sky-data.mjs)
  names      wrong spellings of names, handles and addresses
  phones     only the numbers in data/private.json (gitignored: it exists only on the author's
             Mac, so the public repository never holds them), and none at all in a public file
  data       data/profile.json and the nightly data files against the facts

  python3 scripts/fact_check.py                 everything it can find; exit 1 on a mismatch
  python3 scripts/fact_check.py --repo-only     this repository only (what CI runs)
  python3 scripts/fact_check.py --report-only   print the same, always exit 0
  python3 scripts/fact_check.py FILE ...        only these files (paths as printed)
  python3 scripts/fact_check.py --list          the files it would read
Python standard library only.
"""
from __future__ import annotations

import argparse
import bisect
import datetime as dt
import html
import json
import os
import re
import sys
from json.decoder import scanstring

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOME = os.path.normpath(os.path.join(ROOT, "..", ".."))     # the job-search folder (owner's Mac only)
FACTS_LIST = "事实清单.md"

REPO_TEXT = ["README.md", "HOW-IT-WORKS.md", "data/profile.json", "pages/src/copy.json"]
RESUME = ["_source/content_en.js", "_source/content_en_product.js", "_source/content_zh.js", "_source/content_zh_domestic.js"]
LINKEDIN = ["LinkedIn第七轮修改稿.md"]
DELIVERABLES = "R3.3素材"
IN_PLACE = ["GitHub资料文案.md", "Storewright发布/release-v1.0.0.md", "Storewright发布/repo-settings.md"]
# notes to the owner, the originals kept for reference, the tools, standard licence texts and
# pages generated from a source that is read instead (159's content.json)
SKIP_DIRS = {"原稿", "_工具", "预览"}
SKIP_FILES = {"说明.md", "许可证对比.md"}
SKIP_PREFIXES = ("LICENSE-", "portfolio-")
TEXT_EXT = (".md", ".txt", ".html", ".json", ".svg")
CODE_FENCES = {"stl", "js", "javascript", "mjs", "ts", "html", "css", "json", "bash", "sh", "zsh", "python", "py", "yaml", "yml", "toml"}

MON = (r"(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|"
       r"Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?")
MONTH_NO = {"jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6, "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12}
DASH = r"\s*(?:-|–|—|~|to|至)\s*"
OPEN_END = r"(Present|present|Now|now|至今|现在)"
DAY_PATTERNS = [
    ("iso", re.compile(r"(?<![\d-])(20\d\d)-(\d{2})-(\d{2})(?!\d)")),
    ("en", re.compile(rf"\b{MON}\s+(\d{{1,2}}),\s*(\d{{4}})\b")),
    ("zh", re.compile(r"(20\d\d)\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日")),
]
RANGE_PATTERNS = [
    ("en", re.compile(rf"\b{MON}\s+(\d{{4}}){DASH}(?:{OPEN_END}|{MON}\s+(\d{{4}}))")),
    ("en-short", re.compile(rf"\b{MON}{DASH}{MON}\s+(\d{{4}})\b")),
    ("dot", re.compile(rf"(?<![\d.])(20\d\d)\.(\d{{1,2}}){DASH}(?:{OPEN_END}|(20\d\d)\.(\d{{1,2}}))(?!\d)")),
]
MONTH_PATTERNS = [
    ("en", re.compile(rf"\b{MON}\s+(\d{{4}})\b")),
    ("dot", re.compile(r"(?<![\d.])(20\d\d)\.(0?[1-9]|1[0-2])(?![\d.])")),
    ("zh", re.compile(r"(20\d\d)\s*年\s*(\d{1,2})\s*月(?!\s*\d)")),
]
VERSION_PATTERNS = [   # a major version of at most three digits, so 2026.03 is a month, not a version
    re.compile(r"(?<![\w.])v(\d{1,3}\.\d+(?:\.\d+)?)(?![\d.])"),
    re.compile(r"\bversion\s+(\d{1,3}\.\d+(?:\.\d+)?)(?![\d.])", re.I),
    re.compile(r"(?<![\d.])(\d{1,3}\.\d+(?:\.\d+)?)\s*版(?!本)"),
    re.compile(r"(?:SilNest|声藏|Storewright)\s+(\d{1,3}\.\d+(?:\.\d+)?)(?![\d.%°])"),
]
URL = re.compile(r"(?:https?://|www\.)[^\s<>\"')\]]+")


# ---------------------------------------------------------------- units of text
class Unit:
    """One piece of text to check: a line of Markdown, a JS string, a JSON string, an SVG text."""
    __slots__ = ("file", "line", "raw", "text", "context", "near", "keys", "scope", "provenance")

    def __init__(self, file, line, raw, context="", near=(), keys=(), scope="public", provenance=False):
        self.file, self.line, self.raw = file, line, raw
        self.text = visible(raw)
        self.context = context or self.text
        self.near = list(near)          # text above it, nearest first, for finding the subject
        self.keys = list(keys)          # JSON keys and titles on the way to it
        self.scope = scope              # "public" or "resume"
        self.provenance = provenance    # a JSON "source": where a fact comes from and when it was stated


def visible(raw):
    """What a reader sees: attribute texts (alt, title, aria-label, content) kept, tags and
    addresses dropped, entities decoded."""
    attrs = re.findall(r'\b(?:alt|title|aria-label|content)="([^"]*)"', raw)
    text = re.sub(r"<!--.*?-->", " ", raw)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\]\([^)]*\)", "]", text)          # Markdown link targets
    text = URL.sub(" ", text)
    text = " ".join([text] + attrs)
    return re.sub(r"[ \t]+", " ", html.unescape(text)).strip()


def strip_comments_keep_lines(text):
    return re.sub(r"<!--.*?-->", lambda m: "\n" * m.group(0).count("\n"), text, flags=re.S)


def md_units(path, text, scope, draft=False):
    """Lines of Markdown (or plain text, or HTML), outside code fences that hold code. Each knows its
    block (paragraph or table), the block before it and the heading above, for context."""
    lines = strip_comments_keep_lines(text).split("\n")
    out, fence, fence_lang, block, prev_block, heading, keep_fence = [], False, "", [], [], "", True
    marked_now = False      # the draft's next text block is the current wording ("**现在**")
    change_log = False      # the draft's "**改了什么：**" table describes changes, it is not new text
    change_col = None
    for i, line in enumerate(lines, 1):
        s = line.strip()
        m = re.match(r"^(```+|~~~+)\s*([\w-]*)", s)
        if m:
            if not fence:
                fence, fence_lang = True, m.group(2).lower()
                keep_fence = fence_lang not in CODE_FENCES and not (draft and (fence_lang != "text" or marked_now))
            else:
                fence = False
            continue
        if fence and not keep_fence:
            continue
        if not s:
            if block:
                prev_block, block = block, []
            change_col = None
            continue
        if s.startswith("#") and not fence:
            heading = s.lstrip("#").strip()
            prev_block, block = [], []
            marked_now = change_log = False
            continue
        if draft:
            if not fence:
                if s.startswith("**"):
                    marked_now = s.startswith("**现在**")
                    change_log = s.startswith("**改了什么")
                if s.startswith("|"):
                    cells = [c.strip() for c in s.strip("|").split("|")]
                    if "改成" in cells:
                        change_col = None if change_log else cells.index("改成")
                    elif change_col is not None and not re.match(r"^:?-+:?$", cells[0]) and change_col < len(cells):
                        block.append(cells[change_col])
                        out.append((i, cells[change_col], list(block), list(prev_block), heading))
                    continue
                block.append(s)
                continue          # in the draft, only the proposed text counts
        block.append(s)
        out.append((i, line, list(block), list(prev_block), heading))
    units = []
    for i, raw, blk, prev, head in out:
        context = "\n".join(prev + blk + [head])
        near = list(reversed(blk[:-1])) + list(reversed(prev)) + [head]
        units.append(Unit(path, i, raw, visible(context), [visible(x) for x in near], scope=scope))
    return units


def html_units(path, text, scope):
    text = re.sub(r"<(script|style)\b.*?</\1>", lambda m: "\n" * m.group(0).count("\n"), text, flags=re.S | re.I)
    units = md_units(path, text, scope)
    whole = visible(text)
    for u in units:
        u.context = whole
    return units


def svg_units(path, text, scope):
    """The text an image shows: <text>, <title>, <desc> and aria-label; the whole image is the context."""
    starts = line_starts(text)
    found = []
    for m in re.finditer(r"<(text|title|desc)\b[^>]*>(.*?)</\1>", text, flags=re.S):
        inner = re.sub(r"<[^>]+>", "", m.group(2))
        found.append((line_of(starts, m.start()), html.unescape(inner)))
    for m in re.finditer(r'\baria-label="([^"]*)"', text):
        found.append((line_of(starts, m.start()), html.unescape(m.group(1))))
    whole = " · ".join(t for _, t in found)
    return [Unit(path, ln, t, whole, [whole], scope=scope) for ln, t in found if t.strip()]


def js_units(path, text, scope):
    """String literals of a resume content file (comments skipped); the strings above are the
    context for finding a date's project."""
    starts = line_starts(text)
    lits, i, n = [], 0, len(text)
    while i < n:
        c = text[i]
        if text.startswith("//", i):
            i = text.find("\n", i)
            i = n if i < 0 else i
        elif text.startswith("/*", i):
            j = text.find("*/", i + 2)
            i = n if j < 0 else j + 2
        elif c in "'\"`":
            j, buf = i + 1, []
            while j < n and text[j] != c:
                if text[j] == "\\" and j + 1 < n:
                    buf.append(text[j + 1])
                    j += 2
                    continue
                buf.append(text[j])
                j += 1
            lits.append((line_of(starts, i), "".join(buf)))
            i = j + 1
        else:
            i += 1
    units = []
    for k, (ln, s) in enumerate(lits):
        if not s.strip() or s.startswith("./"):
            continue
        near = [t for _, t in reversed(lits[max(0, k - 8):k])]
        units.append(Unit(path, ln, s, s, near, scope=scope))
    return units


def line_starts(text):
    return [0] + [m.end() for m in re.finditer("\n", text)]


def line_of(starts, pos):
    return bisect.bisect_right(starts, pos)


def json_strings(text):
    """(path, string, line) for every string value of a JSON document, in order."""
    starts, out = line_starts(text), []
    ws = re.compile(r"\s*")
    num = re.compile(r"-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null")

    def value(i, path):
        i = ws.match(text, i).end()
        c = text[i]
        if c == "{":
            i = ws.match(text, i + 1).end()
            if text[i] == "}":
                return i + 1
            while True:
                key, i = scanstring(text, ws.match(text, i).end() + 1)
                i = ws.match(text, i).end() + 1                       # the colon
                i = ws.match(text, value(i, path + (key,))).end()
                if text[i] == "}":
                    return i + 1
                i += 1                                                # the comma
        if c == "[":
            i, k = ws.match(text, i + 1).end(), 0
            if text[i] == "]":
                return i + 1
            while True:
                i = ws.match(text, value(i, path + (k,))).end()
                k += 1
                if text[i] == "]":
                    return i + 1
                i += 1
        if c == '"':
            s, end = scanstring(text, i + 1)
            out.append((path, s, line_of(starts, i)))
            return end
        return num.match(text, i).end()

    value(0, ())
    return out


TITLE_KEYS = ("title", "key", "app", "repo", "name", "project")


def json_units(path, text, scope, render=None):
    data = json.loads(text)
    units = []
    for p, s, ln in json_strings(text):
        if s.startswith("?") and re.fullmatch(r"\?[\w.-]+", s):
            continue                                       # a "?fact.path" row marker (pages/build.py)
        if render:
            s = render(s)
        # the enclosing objects: their title-like fields name the subject; the nearest is the context
        keys, ctx, node = [str(k) for k in p if isinstance(k, str)], "", data
        chain = []
        for k in p[:-1]:
            node = node[k]
            if isinstance(node, dict):
                chain.append(node)
        for d in reversed(chain[-3:]):
            keys += [str(v) for k, v in d.items() if k in TITLE_KEYS and isinstance(v, str)]
        if chain:
            ctx = " · ".join(render(x) if render else x for x in flat_strings(chain[-1]))
        # the object the string sits in (a card, a page) is its context, unless that object is
        # a whole language's copy, which would say everything somewhere
        units.append(Unit(path, ln, s, visible(ctx) if 0 < len(ctx) <= 2500 else s, keys=keys, scope=scope,
                          provenance=bool(p) and p[-1] == "source"))
    return units


def flat_strings(o):
    if isinstance(o, str):
        yield o
    elif isinstance(o, dict):
        for v in o.values():
            yield from flat_strings(v)
    elif isinstance(o, list):
        for v in o:
            yield from flat_strings(v)


# ---------------------------------------------------------------- copy.json placeholders (as pages/build.py)
def copy_renderer():
    def read(rel, default=None):
        try:
            with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
                return json.load(f)
        except (OSError, ValueError):
            return default

    profile = read("data/profile.json", {})
    store = read("data/silnest-store.json", {}) or {}
    sn = profile.get("silnest", {})
    price = store.get("price")
    facts = {**profile, "sn": {
        "version": store.get("version") or sn.get("version"), "released": store.get("released") or sn.get("released"),
        "min_os": store.get("minimumOs") or "",
        "price_en": "Free" if price == 0 else (f"${price:.2f}" if price else ""),
        "price_zh": "免费" if price == 0 else (f"{price:.2f} 美元" if price else "")},
        "day": read("data/store-day.json", {}) or {}, "github": (profile.get("storewright", {}).get("repo", "")).rsplit("/", 1)[0]}
    d = lambda s: dt.date.fromisoformat(s)
    filters = {
        "date_en": lambda s: f"{d(s):%B} {d(s).day}, {d(s).year}",
        "date_short": lambda s: f"{d(s):%b} {d(s).day}, {d(s).year}",
        "date_zh": lambda s: f"{d(s).year} 年 {d(s).month} 月 {d(s).day} 日",
        "month_zh": lambda s: (lambda x: f"{x.year} 年 {x.month} 月")(dt.datetime.strptime(s, "%b %Y")),
        "count": lambda s: re.match(r"\d+", s).group(0),
        "host": lambda s: re.sub(r"^https?://(www\.)?", "", s).rstrip("/"),
        "num": lambda s: f"{float(s):,.10g}",
        "ym": lambda s: dt.datetime.strptime(s, "%b %Y").strftime("%Y-%m"),
        "upper": str.upper, "lower": str.lower,
    }

    def sub(m):
        val = facts
        for part in m.group(1).split("."):
            if isinstance(val, list) and part.isdigit() and int(part) < len(val):
                val = val[int(part)]
            elif isinstance(val, dict) and part in val:
                val = val[part]
            else:
                return m.group(0)
        val = f"{val:g}" if isinstance(val, float) else str(val)
        try:
            return filters[m.group(2)](val) if m.group(2) else val
        except (KeyError, ValueError, AttributeError):
            return m.group(0)

    return lambda s: re.sub(r"\{\{([\w.-]+)(?:\|(\w+))?\}\}", sub, s)


# ---------------------------------------------------------------- the rules
class Findings:
    def __init__(self):
        self.items = []

    def add(self, file, line, rule, msg, excerpt=""):
        key = (file, line, rule, msg)
        if key not in {(f, l_, r, m) for f, l_, r, m, _ in self.items}:
            self.items.append((file, line, rule, msg, excerpt))


def excerpt_of(text, start, end, pad=36):
    a, b = max(0, start - pad), min(len(text), end + pad)
    return ("…" if a else "") + text[a:b].replace("\n", " ") + ("…" if b < len(text) else "")


class Checker:
    def __init__(self, facts, derived, allowed_phones=None):
        self.f = facts
        self.allowed_phones = private_phones() if allowed_phones is None else list(allowed_phones)
        self.r = facts["rules"]
        self.derived = derived
        self.subjects = {k: dict(v, re=re.compile(v["mention"])) for k, v in self.r["subjects"].items() if not k.startswith("_")}
        a = self.r["assistant"]
        self.a_num, self.a_label, self.a_part = re.compile(a["numbers"]), re.compile(a["label"], re.I), re.compile(a["part"], re.I)
        self.a_wrong, self.a_pctx = re.compile(a["wrong"], re.I), re.compile(a["percent_context"], re.I)
        self.names = [(n["right"], [re.compile(w) for w in n["wrong"]]) for n in self.r["names"]]
        self.phones = [re.compile(p) for p in self.r["phones"]["patterns"]]
        self.counts = [dict(c, res=[re.compile(p, re.I) for p in c["patterns"]]) for c in self.r["counts"]]
        self.banned = []
        for g in facts["banned"]:
            for ph in g["phrases"]:
                self.banned.append((ph, g["note"], g["scope"], banned_re(ph)))

    # -- who a date or version belongs to
    def subject(self, u, pos):
        best = None
        for key, s in self.subjects.items():
            for m in s["re"].finditer(u.text):
                d = pos - m.end() if m.end() <= pos else (m.start() - pos) + 10000
                if best is None or d < best[0]:
                    best = (d, key)
        if best:
            return best[1]
        for t in u.near:
            hits = [(m.start(), key) for key, s in self.subjects.items() for m in s["re"].finditer(t)]
            if hits:
                return max(hits)[1]                                  # the last mention in that line
        for k in reversed(u.keys):
            for key, s in self.subjects.items():
                if any(k == x or k.startswith(x + "_") or k.startswith(x + "-") for x in s["keys"]) or s["re"].search(k):
                    return key
        return None

    def check(self, u, out):
        self.banned_check(u, out)
        self.assistant_check(u, out)
        self.date_check(u, out)
        self.version_check(u, out)
        self.count_check(u, out)
        self.name_check(u, out)
        self.phone_check(u, out)

    def banned_check(self, u, out):
        flat = re.sub(r"\s+", " ", u.text)
        for ph, note, scope, rx in self.banned:
            if scope == "resume" and u.scope != "resume":
                continue
            m = rx.search(flat)
            if m:
                out.add(u.file, u.line, "banned", f"{ph!r} is on 事实清单's banned list ({note})", excerpt_of(flat, m.start(), m.end()))

    def assistant_check(self, u, out):
        for m in self.a_num.finditer(u.text):
            here = u.text
            wide = u.text + "\n" + u.context
            if not self.a_label.search(here) and not self.a_label.search(wide):
                out.add(u.file, u.line, "assistant", f"{m.group(0).strip()} without 'duty assistant' (the numbers belong to the duty assistant of StoreX Chain)", excerpt_of(here, m.start(), m.end()))
            elif not self.a_part.search(here) and not self.a_part.search(wide):
                out.add(u.file, u.line, "assistant", f"{m.group(0).strip()}: say which part (StoreX Chain, the regional supply chain)", excerpt_of(here, m.start(), m.end()))
            w = self.a_wrong.search(here)
            if w:
                out.add(u.file, u.line, "assistant", f"the benchmark numbers next to {w.group(0)!r}: they belong to the duty assistant, not the store's AI", excerpt_of(here, w.start(), w.end()))
            break
        if self.a_pctx.search(u.text):
            for m in re.finditer(r"(?<![\d.])(\d+(?:\.\d+)?)\s*%", u.text):
                if m.group(1) not in self.r["assistant"]["percent_allowed"]:
                    out.add(u.file, u.line, "assistant", f"{m.group(0)} next to the duty assistant: the facts are 76.3% / 42.5% (80 held-out questions) and 77.2% / 48.4% (all 320)", excerpt_of(u.text, m.start(), m.end()))

    def date_check(self, u, out):
        if u.provenance:        # the date a fact was stated or checked, not a date in the project
            return
        text = u.text
        taken = []

        def free(m):
            return not any(m.start() < b and a < m.end() for a, b in taken)

        for kind, rx in DAY_PATTERNS:
            for m in rx.finditer(text):
                if not free(m):
                    continue
                taken.append(m.span())
                if kind == "iso":
                    y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
                elif kind == "en":
                    mo, d, y = MONTH_NO[m.group(1)[:3].lower()], int(m.group(2)), int(m.group(3))
                else:
                    y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
                key = self.subject(u, m.start())
                days = self.subjects[key].get("days") if key else None
                if days and f"{y:04d}-{mo:02d}-{d:02d}" not in days:
                    out.add(u.file, u.line, "dates", f"{m.group(0)} for {key}: the facts have {' or '.join(days)}", excerpt_of(text, m.start(), m.end()))
        for kind, rx in RANGE_PATTERNS:
            for m in rx.finditer(text):
                if not free(m):
                    continue
                taken.append(m.span())
                g = m.groups()
                if kind == "en":
                    a = f"{int(g[1]):04d}-{MONTH_NO[g[0][:3].lower()]:02d}"
                    b = "present" if g[2] else f"{int(g[4]):04d}-{MONTH_NO[g[3][:3].lower()]:02d}"
                elif kind == "en-short":
                    a = f"{int(g[2]):04d}-{MONTH_NO[g[0][:3].lower()]:02d}"
                    b = f"{int(g[2]):04d}-{MONTH_NO[g[1][:3].lower()]:02d}"
                else:
                    a = f"{int(g[0]):04d}-{int(g[1]):02d}"
                    b = "present" if g[2] else f"{int(g[3]):04d}-{int(g[4]):02d}"
                key = self.subject(u, m.start())
                if not key:
                    continue
                ranges = [tuple(r) for r in self.subjects[key]["ranges"]]
                if (a, b) not in ranges:
                    want = " or ".join(f"{x} to {y}" for x, y in ranges) or "no date range"
                    out.add(u.file, u.line, "dates", f"{m.group(0)} for {key}: the facts say {want}", excerpt_of(text, m.start(), m.end()))
        for kind, rx in MONTH_PATTERNS:
            for m in rx.finditer(text):
                if not free(m):
                    continue
                taken.append(m.span())
                if kind == "en":
                    ym = f"{int(m.group(2)):04d}-{MONTH_NO[m.group(1)[:3].lower()]:02d}"
                else:
                    ym = f"{int(m.group(1)):04d}-{int(m.group(2)):02d}"
                key = self.subject(u, m.start())
                if not key:
                    continue
                s = self.subjects[key]
                ok = ym in s["months"] or any(a <= ym <= (b if b != "present" else "9999-99") for a, b in s["ranges"])
                if not ok:
                    out.add(u.file, u.line, "dates", f"{m.group(0)} for {key}: the facts have {', '.join(s['months'])}", excerpt_of(text, m.start(), m.end()))
        g = self.r["graduation_year"]
        for p in g["patterns"]:
            for m in re.finditer(p, text):
                if m.group(1) not in g["allowed"]:
                    out.add(u.file, u.line, "dates", f"graduation year {m.group(1)}: the facts say {', '.join(g['allowed'])}", excerpt_of(text, m.start(), m.end()))

    def version_check(self, u, out):
        for rx in VERSION_PATTERNS:
            for m in rx.finditer(u.text):
                key = self.subject(u, m.start())
                vs = self.subjects[key].get("versions") if key else None
                if vs and m.group(1) not in vs:
                    out.add(u.file, u.line, "versions", f"version {m.group(1)} for {key}: the facts have {', '.join(vs)}", excerpt_of(u.text, m.start(), m.end()))

    def count_check(self, u, out):
        for c in self.counts:
            text = u.raw if c.get("on") == "raw" else u.text
            allowed = c.get("allowed")
            if c.get("derived"):
                n = self.derived.get(c["derived"])
                if n is None:
                    continue
                allowed = [str(n)]
            for rx in c["res"]:
                for m in rx.finditer(text):
                    v = m.group(1).replace(",", "")
                    if v not in allowed:
                        out.add(u.file, u.line, "counts", f"{m.group(0).strip()}: {c['fact']} ({' or '.join(allowed)})", excerpt_of(text, m.start(), m.end()))

    def name_check(self, u, out):
        for right, wrongs in self.names:
            for rx in wrongs:
                for m in rx.finditer(u.raw):
                    out.add(u.file, u.line, "names", f"{m.group(0)!r}: write {right}", excerpt_of(u.raw, m.start(), m.end()))

    def phone_check(self, u, out):
        for rx in self.phones:
            for m in rx.finditer(u.raw):
                digits = re.sub(r"\D", "", m.group(0))
                if u.scope == "public":
                    out.add(u.file, u.line, "phones", f"a phone number in a public file: {m.group(0)}", excerpt_of(u.raw, m.start(), m.end()))
                elif digits not in self.allowed_phones:
                    out.add(u.file, u.line, "phones", f"{m.group(0)} is not one of the numbers in data/private.json", excerpt_of(u.raw, m.start(), m.end()))


FUNCTION_WORDS = {"on", "in", "at", "to", "for", "of", "by", "as"}
PRIVATE = os.path.join(ROOT, "data", "private.json")


def private_phones() -> list:
    """The phone numbers the private resumes may use, as digits, from data/private.json. That file is
    gitignored and exists only on the author's Mac, so the public repository never holds the numbers.
    Without it every phone number is reported; public files may have none anyway, and CI checks
    only those."""
    try:
        with open(PRIVATE, encoding="utf-8") as f:
            return [str(x) for x in (json.load(f).get("phones") or {}).get("allowed_digits") or []]
    except FileNotFoundError:
        return []


def banned_re(phrase):
    """A banned phrase as check.py matches it (case-insensitive, any run of spaces; a Chinese phrase
    also without spaces; a word may go on, so "promotion" also finds "promotions" and "25 simplif"
    finds "25 simplifications"), except that a number must not be part of a longer number, an
    English phrase starts at a word, and a phrase ending in a little word like "on" ends there
    ("published on" is not "published only")."""
    words = [re.escape(w) for w in phrase.split()]
    sep = r"\s*" if any(ord(c) > 127 for c in phrase) else r"\s+"
    body = sep.join(words)
    pre = r"(?<![\d.,])" if phrase[0].isdigit() else r"\b" if phrase[0].isascii() and phrase[0].isalpha() else ""
    post = r"(?!\d|[.,]\d)" if phrase[-1].isdigit() else r"\b" if phrase.split()[-1].lower() in FUNCTION_WORDS else ""
    return re.compile(pre + body + post, re.I)


# ---------------------------------------------------------------- structured data
def data_checks(facts, out, files):
    F = facts["facts"]
    subjects = facts["rules"]["subjects"]

    def load(rel):
        p = os.path.join(ROOT, rel)
        with open(p, encoding="utf-8") as f:
            text = f.read()
        return json.loads(text), text

    def at(text, key):
        m = re.search(rf'"{re.escape(key)}"\s*:', text)
        return text.count("\n", 0, m.start()) + 1 if m else 1

    def want(rel, text, key, ok, msg):
        if not ok:
            out.add(rel, at(text, key), "data", msg)

    if "data/profile.json" in files:
        P, t = load("data/profile.json")
        sn, sw, ac, lk = P.get("silnest", {}), P.get("storewright", {}), P.get("assistant", {}), P.get("links", {})
        rel = "data/profile.json"
        want(rel, t, "name", P.get("name") == F["name_en"], f"name is {P.get('name')!r}; the facts say {F['name_en']}")
        want(rel, t, "name_zh", P.get("name_zh") == F["name_zh"], f"name_zh is {P.get('name_zh')!r}; the facts say {F['name_zh']}")
        want(rel, t, "city", P.get("city") == F["city"], f"city is {P.get('city')!r}; the facts say {F['city']}")
        want(rel, t, "email", lk.get("email") == F["email"], f"links.email is {lk.get('email')!r}")
        want(rel, t, "site", (lk.get("site") or "").rstrip("/").endswith(F["site"]), f"links.site is {lk.get('site')!r}")
        want(rel, t, "linkedin", F["linkedin"] in (lk.get("linkedin") or ""), f"links.linkedin is {lk.get('linkedin')!r}")
        want(rel, t, "app_id", sn.get("app_id") == F["silnest_app_id"], f"silnest.app_id is {sn.get('app_id')!r}; the facts say {F['silnest_app_id']}")
        want(rel, t, "store_url", sn.get("store_url") == F["silnest_store_url"], f"silnest.store_url is {sn.get('store_url')!r}")
        want(rel, t, "version", sn.get("version") == F["silnest_version"], f"silnest.version is {sn.get('version')!r}; the facts say {F['silnest_version']}")
        want(rel, t, "released", sn.get("released") == F["silnest_released"], f"silnest.released is {sn.get('released')!r}; the facts say {F['silnest_released']}")
        want(rel, t, "title", sn.get("title") == F["silnest_name"] and sn.get("title_zh") == F["silnest_name_zh"], "silnest.title / title_zh differ from SilNest / 声藏")
        want(rel, t, "tests", sw.get("tests") == F["storewright_tests"], f"storewright.tests is {sw.get('tests')!r}; the facts say {F['storewright_tests']}")
        want(rel, t, "repo", (sw.get("repo") or "").endswith(F["storewright_repo"]), f"storewright.repo is {sw.get('repo')!r}")
        want(rel, t, "demo", F["storewright_demo"] in (sw.get("demo") or ""), f"storewright.demo is {sw.get('demo')!r}")
        months = {f"{dt.datetime.strptime(m, '%Y-%m'):%b %Y}" for m in subjects["storewright"]["months"]}
        want(rel, t, "month", sw.get("month") in months, f"storewright.month is {sw.get('month')!r}; the facts have {', '.join(sorted(months))}")
        want(rel, t, "score", f"{ac.get('score')}%" == F["assistant_score"], f"assistant.score is {ac.get('score')!r}; the facts say {F['assistant_score']}")
        want(rel, t, "baseline", f"{ac.get('baseline')}%" == F["assistant_baseline"], f"assistant.baseline is {ac.get('baseline')!r}; the facts say {F['assistant_baseline']}")
        want(rel, t, "set", re.match(r"80\b", ac.get("set") or "") is not None, f"assistant.set is {ac.get('set')!r}; the facts say an 80-question held-out set")
        a = facts["rules"]["assistant"]
        want(rel, t, "part", re.search(a["part"], ac.get("part") or "", re.I) and re.search(a["label"], ac.get("name") or "", re.I),
             "assistant.name / part must say duty assistant and StoreX Chain (regional supply chain)")
        site_months = {f"{dt.datetime.strptime(m, '%Y-%m'):%b %Y}" for m in subjects["site"]["months"]}
        want(rel, t, "since", P.get("site", {}).get("since") in site_months, f"site.since is {P.get('site', {}).get('since')!r}")
        for item in P.get("timeline") or []:
            s = subjects.get({"site": "site"}.get(item.get("project"), item.get("project")))
            if not s:
                continue
            a0, b0 = s["ranges"][0] if s["ranges"] else (None, None)
            got = (item.get("from"), item.get("to") or "present")
            if s["ranges"] and got != (a0, b0):
                out.add(rel, at(t, "timeline"), "data", f"timeline {item.get('project')}: {got[0]} to {got[1]}; the facts say {a0} to {b0}")
        for item in P.get("milestones") or []:
            text = item.get("en", "")
            key = next((k for k, s in subjects.items() if not k.startswith("_") and re.search(s["mention"], text)), None)
            if not key:
                continue
            s, d = subjects[key], item.get("date", "")
            ok = d in s.get("days", []) or d[:7] in s["months"] or any(a <= d[:7] <= (b if b != "present" else "9999") for a, b in s["ranges"])
            if not ok:
                out.add(rel, at(t, "milestones"), "data", f"milestone {text!r} dated {d}: the facts for {key} have {', '.join(s.get('days', []) + s['months'])}")

    if "data/silnest-store.json" in files:
        S, t = load("data/silnest-store.json")
        rel = "data/silnest-store.json"
        want(rel, t, "version", S.get("version") == F["silnest_version"], f"the App Store reports version {S.get('version')}; 事实清单 and data/facts.json say {F['silnest_version']} (update both)")
        want(rel, t, "released", S.get("released") == F["silnest_released"], f"the App Store reports release date {S.get('released')}; the facts say {F['silnest_released']}")
        want(rel, t, "minimumOs", str(S.get("minimumOs")) == F["silnest_min_ios"], f"the App Store reports iOS {S.get('minimumOs')} or later; the facts say {F['silnest_min_ios']}")
        want(rel, t, "price", S.get("price") in (0, 0.0, None), f"the App Store reports a price of {S.get('price')}; the facts say free")

    if "data/project-numbers.json" in files:
        N, t = load("data/project-numbers.json")
        sw, rel = N.get("storewright") or {}, "data/project-numbers.json"
        want(rel, t, "testsLabel", sw.get("testsLabel") == F["storewright_tests"], f"the counted tests make {sw.get('testsLabel')!r}; the facts say {F['storewright_tests']}")
        if sw.get("firstCommit"):
            want(rel, t, "firstCommit", sw["firstCommit"] == F["storewright_first_commit"], f"Storewright's first commit is {sw['firstCommit']}; the facts say {F['storewright_first_commit']}")
        # a later commit in the same month (the docs merge at go-live) keeps "Oct 2026 - Nov 2026" true
        last, end = sw.get("lastCommit") or "", subjects["storewright"]["ranges"][0][1]
        want(rel, t, "lastCommit", last == F["storewright_last_commit"] or last[:7] == end,
             f"Storewright's last commit is {last}, after {end}; the resumes say {F['storewright_dates']} (update 事实清单 first)")


def sync_checks(facts, out, facts_list_path):
    """data/facts.json against 事实清单.md: every canonical value must still be in the list, and the
    banned phrases must be the list's banned block."""
    with open(facts_list_path, encoding="utf-8") as f:
        src = f.read()
    rel = "data/facts.json"
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        ft = f.read()
    squash = lambda s: re.sub(r"\s+", "", s)
    body = squash(re.sub(r"```banned\n.*?```", "", src, flags=re.S))
    for k, v in facts["facts"].items():
        if squash(v) not in body:
            out.add(rel, ft[: max(0, ft.find(f'"{k}"'))].count("\n") + 1, "sync", f"facts.{k} = {v!r} is not in {FACTS_LIST} (change the list first)")
    listed = []
    for block in re.findall(r"```banned\n(.*?)```", src, flags=re.S):
        listed += [x.strip() for x in block.splitlines() if x.strip() and not x.strip().startswith("#")]
    ours = [p for g in facts["banned"] for p in g["phrases"]]
    line_of_text = lambda needle: ft[: max(0, ft.find(needle))].count("\n") + 1
    for p in sorted(set(listed) - set(ours)):
        out.add(rel, line_of_text('"banned"'), "sync", f"{p!r} is banned in {FACTS_LIST} but missing here")
    for p in sorted(set(ours) - set(listed)):
        out.add(rel, line_of_text(json.dumps(p, ensure_ascii=False)), "sync", f"{p!r} is banned here but not in {FACTS_LIST}")


def derive(facts):
    out = {}
    for name, d in facts["rules"].get("derived", {}).items():
        try:
            with open(os.path.join(ROOT, d["file"]), encoding="utf-8") as f:
                text = f.read()
        except OSError:
            continue
        start = text.find(d["after"])
        if start < 0:
            continue
        end = text.find("];", start)
        rows = [ln for ln in text[start:end].split("\n") if re.match(d["row"], ln)]
        out[name] = len(rows)
    return out


# ---------------------------------------------------------------- files
def discover(repo_only):
    """[(label, absolute path, kind, scope)]"""
    files = [(rel, os.path.join(ROOT, rel), kind_of(rel), "public") for rel in REPO_TEXT]
    if repo_only or not os.path.exists(os.path.join(HOME, FACTS_LIST)):
        return files
    for rel in RESUME:
        files.append((rel, os.path.join(HOME, rel), "js", "resume"))
    for rel in LINKEDIN:
        files.append((rel, os.path.join(HOME, rel), "draft", "resume"))
    for rel in IN_PLACE:
        files.append((rel, os.path.join(HOME, rel), kind_of(rel), "public"))
    base = os.path.join(HOME, DELIVERABLES)
    for dirpath, dirnames, filenames in os.walk(base):
        dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS)
        for name in sorted(filenames):
            if not name.endswith(TEXT_EXT) or name in SKIP_FILES or name.startswith(SKIP_PREFIXES):
                continue
            path = os.path.join(dirpath, name)
            files.append((os.path.relpath(path, HOME), path, kind_of(name), "public"))
    return files


def kind_of(name):
    ext = os.path.splitext(name)[1].lower()
    return {".md": "md", ".txt": "md", ".html": "html", ".json": "json", ".svg": "svg", ".js": "js"}.get(ext, "md")


def units_of(label, path, kind, scope, render):
    with open(path, encoding="utf-8") as f:
        text = f.read()
    if kind == "js":
        return js_units(label, text, scope)
    if kind == "draft":
        return md_units(label, text, scope, draft=True)
    if kind == "json":
        return json_units(label, text, scope, render if label.endswith("copy.json") else None)
    if kind == "svg":
        return svg_units(label, text, scope)
    if kind == "html":
        return html_units(label, text, scope)
    if label.endswith("README.md"):
        text = re.sub(r"```stl.*?```", lambda m: "\n" * m.group(0).count("\n"), text, flags=re.S)
    return md_units(label, text, scope)


SELF_TEST = [
    # (text, scope, the rules that must fire; an empty set means it must pass)
    ("SilNest 1.0 released on the App Store.", "public", set()),
    ("SilNest 1.1 is on the App Store.", "public", {"versions"}),
    ("Storewright · Jan 2026 - Present", "public", {"banned", "dates"}),
    ("AI Vocal · Mar 2026 - Present", "public", {"dates"}),
    ("AI Vocal · Aug 2026 – present", "public", set()),
    ("声藏 · SilNest 2026.02 - 至今", "resume", {"dates"}),
    ("Walmart, Digital Personal Shopper, Apr 2024 - Present", "resume", {"dates"}),
    ("Milestone, September 1, 2026: SilNest 1.0 released on the App Store.", "public", {"dates"}),
    ("CS graduate (2023) and generalist", "resume", {"dates"}),
    ("Duty assistant (regional supply-chain part): 76.3% vs 42.5% for keyword rules on a held-out 80-question set.", "resume", set()),
    ("The store AI scored 76.3% on 80 questions.", "public", {"assistant"}),
    ("Duty assistant: 76.3% fully correct on a held-out set.", "public", {"assistant"}),
    ("StoreX Chain's duty assistant scored 70.5% on the held-out set", "public", {"assistant"}),
    ("Duty assistant (StoreX Chain): 60/80 on the held-out 80-question set", "public", {"counts"}),
    ("700+ automated tests", "public", {"counts"}),
    ("800 多个自动化测试", "public", set()),
    ("tonight's sky for any of 173 cities", "public", {"counts"}),
    ("27 decision records and 16 design documents", "public", set()),
    ("iOS 16.0 or later", "public", {"counts"}),
    ("https://apps.apple.com/app/id6796483225", "public", {"counts"}),
    ("B.S. Computer Science, University of Albany", "resume", {"names"}),
    ("github.com/Glacierr and Silnest", "public", {"names"}),
    ("+1 (917) 555-0100", "resume", {"phones"}),
    ("+1 (555) 555-0123", "resume", set()),
    ("+1 (555) 555-0123", "public", {"phones"}),
    ("eligible for promotions to team lead", "public", {"banned"}),
    ("The page is published only from a run that passed", "public", set()),
    ("a 221-step walkthrough", "resume", {"banned"}),
    ("a 221-step walkthrough", "public", set()),
    ("per-store AI, trained locally", "public", set()),
    ("an RTX 3050 with 8 GB of VRAM", "public", {"banned"}),
]


def self_test(facts):
    """The rules must catch what they are for and pass what is right (run on CI before the scan)."""
    # a made-up number plays the author's own: the real ones stay in data/private.json, off GitHub
    checker, bad = Checker(facts, {"cities": 172}, allowed_phones=["15555550123", "5555550123"]), 0
    for text, scope, want in SELF_TEST:
        out = Findings()
        checker.check(Unit("self-test", 1, text, scope=scope), out)
        got = {rule for _, _, rule, _, _ in out.items}
        if got != want:
            bad += 1
            print(f"  self-test FAIL: {text!r} ({scope}) fired {sorted(got) or 'nothing'}, expected {sorted(want) or 'nothing'}")
            for _, _, rule, msg, _ in out.items:
                print(f"      [{rule}] {msg}")
    print(f"fact_check self-test: {len(SELF_TEST) - bad} of {len(SELF_TEST)} cases right")
    return bad


def main():
    ap = argparse.ArgumentParser(description="Check every stated fact against data/facts.json (idea #183).")
    ap.add_argument("only", nargs="*", help="check only these files (as printed)")
    ap.add_argument("--repo-only", action="store_true", help="only this repository's files (what CI runs)")
    ap.add_argument("--report-only", action="store_true", help="always exit 0")
    ap.add_argument("--list", action="store_true", help="print the files it would read, then stop")
    ap.add_argument("--self-test", action="store_true", help="check the rules on made-up sentences first")
    a = ap.parse_args()

    with open(os.path.join(ROOT, "data", "facts.json"), encoding="utf-8") as f:
        facts = json.load(f)
    if a.self_test and self_test(facts) and not a.report_only:
        return 1
    files = discover(a.repo_only)
    if a.only:
        files = [x for x in files if x[0] in a.only or os.path.abspath(x[1]) in {os.path.abspath(o) for o in a.only}]
    if a.list:
        for label, path, kind, scope in files:
            print(f"{scope:7} {kind:6} {label}{'' if os.path.exists(path) else '   (missing)'}")
        return 0

    derived = derive(facts)
    checker, out, render = Checker(facts, derived), Findings(), copy_renderer()
    n_units, read = 0, []
    for label, path, kind, scope in files:
        if not os.path.exists(path):
            print(f"fact_check: {label} is missing, skipped", file=sys.stderr)
            continue
        read.append(label)
        for u in units_of(label, path, kind, scope, render):
            n_units += 1
            checker.check(u, out)
    structured = {"data/profile.json", "data/silnest-store.json", "data/project-numbers.json"}
    if not a.only:
        data_checks(facts, out, structured)
        fl = os.path.join(HOME, FACTS_LIST)
        if not a.repo_only and os.path.exists(fl):
            sync_checks(facts, out, fl)
    elif structured & set(a.only):
        data_checks(facts, out, structured & set(a.only))

    order = {label: i for i, label in enumerate(read)}
    items = sorted(out.items, key=lambda x: (order.get(x[0], -1), x[1]))
    where = "this repository" if a.repo_only or len(read) <= len(REPO_TEXT) else "this repository and the job-search folder"
    extra = f"; {', '.join(f'{k} {v}' for k, v in derived.items())} (counted)" if derived else ""
    print(f"fact_check: {len(read)} files in {where}, {n_units} pieces of text{extra}")
    for file, line, rule, msg, ex in items:
        print(f"  {file}:{line}  [{rule}] {msg}" + (f"\n      {ex}" if ex else ""))
    print(f"fact_check: {len(items)} mismatch{'es' if len(items) != 1 else ''}" + ("" if items else ", all consistent"))
    return 0 if a.report_only or not items else 1


if __name__ == "__main__":
    sys.exit(main())
