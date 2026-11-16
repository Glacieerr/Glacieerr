#!/usr/bin/env python3
"""English copy check (idea #184): the rules of docs/copy-style.md that a machine can check, on
the English a visitor reads.

  errors    an em or en dash; a British spelling; a product or brand name spelled another way
            (SilNest, Storewright, StoreX, Claude Code, GitHub, App Store, LinkedIn, ...); a
            phrase from 事实清单's banned block (data/facts.json)
  warnings  "round the avatar" and "towards" (US: around, toward); curly quotes in English;
            a spaced hyphen used as a dash; "8pm" or "8 p.m." (write 8 PM)

What it reads
  README.md, HOW-IT-WORKS.md and the English of pages/src/copy.json (its {{placeholders}} filled
  as pages/build.py fills them); on the owner's Mac also the English deliverables of R3.3
  (R3.3素材 and the drafts it edited in place), English pieces only: a line, cell or string
  that is mostly Chinese is left to the Chinese.

  python3 scripts/copy_check.py                 exit 1 on an error
  python3 scripts/copy_check.py --repo-only     this repository only
  python3 scripts/copy_check.py --report-only   always exit 0
  python3 scripts/copy_check.py FILE ...        only these files (paths as printed)
Python standard library only; it reads files the way scripts/fact_check.py does.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fact_check as F  # noqa: E402  (the same file readers, placeholders and banned list)

REPO_TEXT = ["README.md", "HOW-IT-WORKS.md", "pages/src/copy.json"]
SKIP_EN = {"README模板.md"}          # a Chinese template with placeholders

DASH = re.compile(r"[‒–—―⸺⸻]|(?<=\s)--(?=\s)")
NAMES = [
    ("SilNest", r"\bSilnest\b|\bSILNEST\b|\bSil Nest\b|\bsilNest\b"),
    ("Storewright", r"\bStoreWright\b|\bStore Wright\b|\bStorewrite\b|\bSTOREWRIGHT\b"),
    ("StoreX", r"\bStorex\b|\bStoreX chain\b|\bStore X\b"),
    ("Claude Code", r"\bClaude code\b|\bclaude code\b|\bClaudeCode\b|\bClaude-Code\b"),
    ("GitHub", r"\bGithub\b|\bGITHUB\b|\bGit Hub\b"),
    ("App Store", r"\bApp store\b|\bapp store\b|\bAppstore\b|\bAppStore\b|\bApp-Store\b|\bapp-store\b"),
    ("LinkedIn", r"\bLinkedin\b|\blinkedIn\b|\bLINKEDIN\b|\bLinked In\b"),
    ("JavaScript", r"\bJavascript\b|\bJava Script\b"),
    ("TypeScript", r"\bTypescript\b|\bType Script\b"),
    ("iPhone", r"\bIphone\b|\bIPhone\b|\bI-phone\b"),
    ("macOS", r"\bMacOS\b|\bMac OS\b|\bMacOs\b|\bOSX\b|\bOS X\b"),
    ("Node.js", r"\bNodeJS\b|\bNodejs\b|\bNode JS\b"),
]
# lowercase names count only inside a sentence (a bare "storewright" is a repository name)
LOWER_NAMES = [("SilNest", r"(?<![\w/#.@-])silnest(?![\w/.-])"), ("Storewright", r"(?<![\w/#.@-])storewright(?![\w/.-])"),
               ("GitHub", r"(?<![\w/#.@-])github(?![\w.-])")]
BRITISH = [
    (r"\bcolour(s|ed|ing|ful|less)?\b", "color"), (r"\bcentre(s|d)?\b", "center"), (r"\bbehaviour(s|al)?\b", "behavior"),
    (r"\bfavourite(s)?\b", "favorite"), (r"\bhonour(s|ed)?\b", "honor"), (r"\blabour\b", "labor"),
    (r"\bneighbour(s|hood|ing)?\b", "neighbor"), (r"\bflavour(s)?\b", "flavor"), (r"\bhumour\b", "humor"),
    (r"\bgrey(s|er|ish|ed)?\b", "gray"),
    (r"\b(organ|recogn|real|apolog|priorit|summar|visual|custom|optim|minim|maxim|emphas|final|normal|synchron|"
     r"standard|categor|util|special|initial|serial|author|character|memor|capital|critic|symbol|modern|personal|"
     r"stabil|digit|local|global|central|vocal|rational)is(e|es|ed|ing|ation|ations|er|ers)\b", "-ize"),
    (r"\banaly(se|sed|sing)\b", "analyze"), (r"\bparaly(se|sed|sing)\b", "paralyze"),
    (r"\blicence(s|d)?\b", "license"), (r"\bdefence\b", "defense"), (r"\boffence\b", "offense"), (r"\bpretence\b", "pretense"),
    (r"\bcatalogue(s|d)?\b", "catalog"), (r"\banalogue\b", "analog"), (r"\bprogramme(s)?\b", "program"),
    (r"\b(kilo|centi|milli)?metre(s)?\b", "meter"), (r"\blitre(s)?\b", "liter"), (r"\btheatre(s)?\b", "theater"), (r"\bfibre(s)?\b", "fiber"),
    (r"\b(travel|cancel|model|label|fuel|signal|channel|total|level|tunnel|counsel|jewel|dial|marvel)l(ed|ing|er|ers)\b", "one l (canceled, modeling, labeled)"),
    (r"\bfulfil(s|ment)?\b", "fulfill, fulfillment"), (r"\benrol(s|ment)?\b", "enroll"), (r"\binstalment(s)?\b", "installment"),
    (r"\bskilful\b", "skillful"), (r"\bwilful\b", "willful"),
    (r"\bjudgement(s)?\b", "judgment"), (r"\backnowledgement(s)?\b", "acknowledgment"), (r"\bageing\b", "aging"),
    (r"\bpractis(e|es|ed|ing)\b", "practice"), (r"\bcheque(s)?\b", "check"), (r"\btyre(s)?\b", "tire"),
    (r"\baluminium\b", "aluminum"), (r"\bsceptic(al|s)?\b", "skeptic"), (r"\bmanoeuvre(s|d)?\b", "maneuver"),
    (r"\bplough\b", "plow"), (r"\bmould\b", "mold"), (r"\bjewellery\b", "jewelry"), (r"\bdraught\b", "draft"),
    (r"\bkerb\b", "curb"), (r"\bstorey(s)?\b", "story"), (r"\bmaths\b", "math"),
    (r"\bwhilst\b", "while"), (r"\bamongst\b", "among"), (r"\blearnt\b", "learned"), (r"\bspelt\b", "spelled"),
]
US_WORDS = [
    (r"\btowards\b", "toward"), (r"\bafterwards\b", "afterward"),
    (r"\b(?:(?:{v})\s+)?round\s+(?:the|my|his|her|its|it|Earth|them)\b|\b(?:{v})\s+round\b".replace(
        "{v}", "go|goes|going|went|gone|turns?|turning|turned|runs?|running|spins?|spinning|comes?|coming|came|travels?|moves?"),
     "around (US)"),
]
CURLY = re.compile(r"[‘’“”]")
SPACED_HYPHEN = re.compile(r"(?<=[A-Za-z0-9.,;:)\]%])\s-\s(?=[A-Za-z0-9(])")
CLOCK = re.compile(r"\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b|\b\d{1,2}(?::\d{2})?\s?[ap]\.m\.|\b\d{1,2}(?::\d{2})?(?:AM|PM)\b")
CJK = re.compile(r"[　-〿㐀-鿿＀-￯]")


def english_pieces(text):
    """The English parts of a line: table cells and the line itself, when mostly not Chinese (a
    piece with no letters at all, like "11-19% -> 0", counts too: it can still hold a dash)."""
    parts = [c.strip() for c in text.strip().strip("|").split("|")] if text.lstrip().startswith("|") else [text]
    for p in parts:
        letters = len(re.findall(r"[A-Za-z]", p))
        if p and len(CJK.findall(p)) <= 0.1 * letters:
            yield p


def prose(text):
    """What to read as English prose: inline code and date ranges taken out."""
    text = re.sub(r"`[^`]*`", " ", text)
    for _, rx in F.RANGE_PATTERNS:
        text = rx.sub(" ", text)
    return text


class Out:
    def __init__(self):
        self.items, self.seen = [], set()

    def add(self, level, u, rule, msg, text, m):
        key = (u.file, u.line, rule, m.group(0))
        if key not in self.seen:
            self.seen.add(key)
            self.items.append((level, u.file, u.line, rule, msg, F.excerpt_of(text, m.start(), m.end())))


def check_unit(u, banned, out):
    for piece in english_pieces(u.text):
        text = prose(piece)
        for m in DASH.finditer(text):
            out.add("error", u, "dash", "an em or en dash: use a colon, comma, semicolon or parentheses; 'to' for a range", text, m)
        for right, rx in NAMES:
            for m in re.finditer(rx, text):
                out.add("error", u, "name", f"write {right}", text, m)
        if len(text.split()) >= 4:
            for right, rx in LOWER_NAMES:
                for m in re.finditer(rx, text):
                    out.add("error", u, "name", f"write {right} (lowercase only as an address or a repository name)", text, m)
        for rx, us in BRITISH:
            for m in re.finditer(rx, text, re.I):
                out.add("error", u, "spelling", f"US spelling: {us}", text, m)
        for ph, note, rx in banned:
            for m in rx.finditer(re.sub(r"\s+", " ", text)):
                out.add("error", u, "banned", f"{ph!r} is on 事实清单's banned list ({note})", re.sub(r"\s+", " ", text), m)
        for rx, us in US_WORDS:
            for m in re.finditer(rx, text, re.I):
                out.add("warning", u, "word", f"US English: {us}", text, m)
        for m in CURLY.finditer(text):
            out.add("warning", u, "quotes", "straight quotes and apostrophes in English (' and \")", text, m)
        for m in SPACED_HYPHEN.finditer(text):
            out.add("warning", u, "hyphen", "a spaced hyphen as a dash: use a colon, comma or parentheses", text, m)
        for m in CLOCK.finditer(text):
            out.add("warning", u, "time", "write times as 8 PM, 1:59 AM", text, m)


def units_for(label, path, kind, render):
    with open(path, encoding="utf-8") as f:
        text = f.read()
    if label.endswith("copy.json"):
        # the English copy only: strings under an "en" key; not the search keywords (spot.keys),
        # which are lowercase on purpose
        units = [u for u in F.json_units(label, text, "public", render)
                 if "en" in u.keys and not any(a == "spot" and b == "keys" for a, b in zip(u.keys, u.keys[1:]))]
        return units
    if kind == "json":
        return F.json_units(label, text, "public")
    return F.units_of(label, path, kind, "public", render)


def main():
    ap = argparse.ArgumentParser(description="Check the English copy against docs/copy-style.md (idea #184).")
    ap.add_argument("only", nargs="*", help="check only these files (as printed)")
    ap.add_argument("--repo-only", action="store_true", help="only this repository's files")
    ap.add_argument("--report-only", action="store_true", help="always exit 0")
    ap.add_argument("--list", action="store_true", help="print the files it would read, then stop")
    a = ap.parse_args()

    with open(os.path.join(F.ROOT, "data", "facts.json"), encoding="utf-8") as f:
        facts = json.load(f)
    banned = [(ph, g["note"], F.banned_re(ph)) for g in facts["banned"] if g["scope"] == "all" for ph in g["phrases"]]
    files = [(rel, os.path.join(F.ROOT, rel), F.kind_of(rel)) for rel in REPO_TEXT]
    if not a.repo_only:
        files += [(label, path, kind) for label, path, kind, scope in F.discover(False)
                  if scope == "public" and label not in REPO_TEXT and label not in ("data/profile.json",)
                  and os.path.basename(label) not in SKIP_EN]
    if a.only:
        files = [x for x in files if x[0] in a.only or os.path.abspath(x[1]) in {os.path.abspath(o) for o in a.only}]
    if a.list:
        for label, path, kind in files:
            print(f"{kind:5} {label}{'' if os.path.exists(path) else '   (missing)'}")
        return 0

    render, out, read = F.copy_renderer(), Out(), []
    for label, path, kind in files:
        if not os.path.exists(path):
            continue
        read.append(label)
        for u in units_for(label, path, kind, render):
            check_unit(u, banned, out)
    order = {label: i for i, label in enumerate(read)}
    items = sorted(out.items, key=lambda x: (order.get(x[1], -1), x[2], x[0]))
    errors = sum(1 for x in items if x[0] == "error")
    print(f"copy_check: {len(read)} files")
    for level, file, line, rule, msg, ex in items:
        print(f"  {file}:{line}  {level}: [{rule}] {msg}\n      {ex}")
    print(f"copy_check: {errors} error{'s' if errors != 1 else ''}, {len(items) - errors} warning{'s' if len(items) - errors != 1 else ''}")
    return 0 if a.report_only or not errors else 1


if __name__ == "__main__":
    sys.exit(main())
