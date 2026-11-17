#!/usr/bin/env python3
"""Write README.md for the GitHub profile repo (Glacieerr/Glacieerr).

  python3 scripts/make_readme.py                      # banner = the live clock at links.clock in data/profile.json
  python3 scripts/make_readme.py --clock https://<project>.vercel.app/api/lockscreen   # another clock
  python3 scripts/make_readme.py --no-clock           # banner = the daily image (no server)
  python3 scripts/make_readme.py --layout right --weight thin
  python3 scripts/make_readme.py --no-portrait        # no separate banner for phones
  python3 scripts/make_readme.py --video https://github.com/user-attachments/assets/<id>

The art follows the visitor's GitHub theme: dark art on dark pages, light art on light pages
(--dark and --light choose otherwise; the wallpaper names used before the Dusk Tech restyle
still work: midnight, orbit, blossom, aurora = dark; lagoon, dawn = light).

Everything GitHub-specific in here was checked on github.com on 2026-11-12:
- <picture> with prefers-color-scheme sources is kept, so dark and light get their own art.
- A table wider than the README scrolls sideways, but only if each cell has an
  unbreakable line as wide as its image; otherwise GitHub shrinks the images to fit.
  The caption link under each widget is that line (words joined by no-break spaces),
  padded to the image width + 2 px with glyph widths measured in GitHub's body text.
- An image inside <summary> gets wrapped in a link by GitHub and stops toggling;
  wrapping it in <a name=...> keeps it a plain toggle.
- A github.com/user-attachments video URL on a line of its own becomes a video player.
Checked on github.com on 2026-11-16, once the profile was public: the narrow-screen
(max-width: 600px) <source> is kept too, so phones get the portrait banner.

R3.3 adds: two milestone cards under the banner (#9), the "How I work" loop as a Mermaid chart
(#37, the steps of pages/src/copy.json app.how.loop, read only), the project timeline (#111),
the skill map with its list in the fold (#110), "Ask me about" (#113), contact badges drawn by
lockscreen.py (#109) with a guestbook link (#148), and the small print with the last nightly run
and a link to HOW-IT-WORKS.md (#112, #40). Before writing, every image is checked (#164): it has
a meaningful alt text of one or two sentences that no other image repeats (only the dividers are
decorative), and every image it links on the output branch exists in out/ when out/ is there.
"""
import argparse
import datetime as dt
import json
import math
import os
import re
import sys
from html import escape
from zoneinfo import ZoneInfo

sys.dont_write_bytecode = True   # importing a sibling script leaves no __pycache__ in the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lockscreen as L  # noqa: E402  (the same data rules as the images: milestones, skills, timeline, badges)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = "Glacieerr/Glacieerr"
OUT = f"https://raw.githubusercontent.com/{REPO}/output"
HOW = f"https://github.com/{REPO}/blob/main/HOW-IT-WORKS.md"     # absolute: relative links break on the profile page
GUESTBOOK = "#guestbook"   # deep link that opens the guestbook directly (ideas #85, #148)
NBSP = "&nbsp;"
PAGES = ["dark", "light"]
ALIASES = {"midnight": "dark", "orbit": "dark", "blossom": "dark", "aurora": "dark", "lagoon": "light", "dawn": "light"}
SHOWCASE = "assets/src/storewright-showcase.jpg"   # 960x600; lockscreen.py frames it as out/showcase-storewright-*.svg

# GitHub's README body text: 16 px, weight 400, in
#   -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif
# Advances measured in headless Chrome on a Mac (SF Pro) on 2026-11-13, for ASCII 32..126 then
# "↗" and "·". A no-break space is 4.1875 px. Whole captions are measured too, because kerning
# makes a word a little narrower than the sum of its letters.
GH_NBSP = 4.1875
GH_GLYPHS = ("4.1875 4.6719 7.3281 9.7656 9.7656 14.5 11.0781 4.4375 5.7969 5.7969 7.2344 9.7656 4.4375 7.2344 "
             "4.4375 4.5625 9.7656 7.1094 9.3438 9.7188 9.9844 9.5781 9.875 8.7969 9.9062 9.875 4.4375 4.4375 "
             "9.7656 9.7656 9.7656 7.8906 14.375 10.4688 10.2031 11.1406 11.3125 9.2188 8.8438 11.6406 11.5625 "
             "3.9688 8.2969 10.2344 8.7812 13.6719 11.5625 12.0312 9.8594 12.0312 10.1406 9.8906 9.8281 11.4844 "
             "10.4688 15.1719 10.5469 10.1719 10.2812 5.7969 4.5625 5.7969 9.7656 9.0312 7.6875 8.5156 9.5156 "
             "8.6406 9.5156 8.8281 5.4844 9.4375 9.1094 3.6406 3.6406 8.375 3.7344 13.6094 9.0312 9.1406 9.4531 "
             "9.4375 5.7812 8.0625 5.5 9.0312 8.3594 12.0781 8.0781 8.375 8.3125 5.7969 3.8281 5.7969 9.7656 "
             "11.9219 4.4375")
GH_CAPTIONS = {"App Store ↗": 88.453, "Live demo ↗": 90.672, "Simulator ↗": 84.812, "The eval ↗": 77.016,
               "yecanyuan.com ↗": 129.312, "Personal project": 117.641, "LinkedIn ↗": 76.859,
               "Your city's sky ↗": 120.734}
_GLYPH = dict(zip([chr(c) for c in range(32, 127)] + ["↗", "·"], (float(v) for v in GH_GLYPHS.split())))


def text_width(text):
    """Width of a caption in GitHub's body text (spaces become no-break spaces of the same width)."""
    if text in GH_CAPTIONS:
        return GH_CAPTIONS[text]
    # an unmeasured caption: the sum of its letters, plus 1 px so kerning never makes it short
    return sum(_GLYPH.get(ch, 16.0) for ch in text) + 1


def caption(text, href, width):
    """The caption under a widget: the link text (words joined by no-break spaces), then enough
    no-break spaces that the line is at least the image width + 2 px, and only just."""
    glued = text.replace(" ", NBSP)
    pad = max(1, math.ceil((width + 2 - text_width(text)) / GH_NBSP))
    label = f'<a href="{href}">{glued}</a>' if href else glued
    return label + NBSP * pad


def caption_width(text, width):
    """How wide caption() makes the line, in GitHub's body text on a Mac."""
    pad = max(1, math.ceil((width + 2 - text_width(text)) / GH_NBSP))
    return text_width(text) + pad * GH_NBSP


def page_mode(name):
    name = ALIASES.get(name, name)
    if name not in PAGES:
        raise argparse.ArgumentTypeError(f"choose dark or light (old names: {', '.join(ALIASES)})")
    return name


def themed(name, dark, light, width, height, alt):
    """<picture> with art for dark pages (img) and light pages (source): <name>-<dark>.svg, <name>-<light>.svg."""
    return (f'<picture><source media="(prefers-color-scheme: light)" srcset="{OUT}/{name}-{light}.svg">'
            f'<img src="{OUT}/{name}-{dark}.svg" width="{width}" height="{height}" alt="{attr(alt)}"></picture>')


def attr(text):
    """Text for a double-quoted HTML attribute (apostrophes stay as they are)."""
    return escape(text, quote=False).replace('"', "&quot;")


# ---------------------------------------------------------------- the R3.3 pieces
def milestones_html(F, a, today):
    """Idea #9: the newest two milestones, one card (image) each, each linking to its evidence."""
    news = L.latest_milestones(F)
    if not news:
        return ""
    lines = max(len(L.milestone_lines(it)) for it in news)
    h = 62 + 17 * (lines - 1)
    cards = []
    for i, item in enumerate(news, 1):
        alt = f'Milestone, {L.when_long(item["date"])}: {item["en"]}'.rstrip(".") + "."
        pic = themed(f"milestone-{i}", a.dark, a.light, 368, h, alt)
        cards.append(f'<a href="{item["url"]}">{pic}</a>' if item.get("url") else pic)
    return "<p>\n" + "\n".join(cards) + "\n</p>"


def how_loop(lang):
    """The confirmed "How I work" steps (pages/src/copy.json, app.how.loop), read only."""
    with open(os.path.join(ROOT, "pages", "src", "copy.json"), encoding="utf-8") as f:
        copy = json.load(f)
    return copy[lang]["app"]["how"]["loop"], copy[lang]["app"]["how"]["title"]


def mermaid_loop(lang):
    """Idea #37: the loop as a Mermaid flowchart, its boxes exactly the confirmed steps; the dotted
    arrow back is the loop (a change that is not accepted goes back to be redone)."""
    steps, title = how_loop(lang)
    joiner = "" if lang == "zh" else " "
    nodes = [f's{i + 1}["{t.replace(chr(34), "#quot;")}"]' for i, t in enumerate(steps)]
    lines = ["```mermaid", "flowchart LR", f"  accTitle: {title}", f"  accDescr: {joiner.join(steps)}"]
    lines += [f"  {nodes[i]} --> {nodes[i + 1]}" if i == 0 else f"  s{i + 1} --> {nodes[i + 1]}" for i in range(len(steps) - 1)]
    if len(steps) >= 3:
        lines.append(f"  s{len(steps)} -.-> s3")
    return "\n".join(lines + ["```"])


def skills_html(F, a):
    """Idea #110: the skill map as one image; its list in words goes in the fold."""
    svg, alt = L.skills_map("dark", F)
    if not svg:
        return ""
    h = int(re.search(r'height="(\d+)"', svg).group(1))
    return themed("skills", a.dark, a.light, 680, h, alt)


def skills_list(F):
    """The skill map in words (the fold), from the same data: lane, skill and its projects."""
    stars, heads = L.skills_layout(F)
    out = []
    for k, _x, _w in heads:
        items = [f'{s["skill"]} ({", ".join(L.PROJECT_NAMES.get(q, q) for q in s["projects"])})'
                 for s in stars if s["lane"] == k]
        out.append(f'- **{L.LANE_NAMES.get(k, k)}:** ' + " · ".join(items))
    return "\n".join(out)


def timeline_html(F, a, today):
    """Idea #111: the project timeline."""
    svg, alt = L.timeline("dark", F, today)
    return themed("timeline", a.dark, a.light, 680, 132, alt) if svg else ""


def topics_line(F, lang="en"):
    """Idea #113: the "Ask me about" topics, each linked to the project it comes from (AI Vocal has
    no page of its own outside the interactive site, so it links to that app there: #home/vocal)."""
    links = {"silnest": F["silnest"]["store_url"], "storewright": F["storewright"]["repo"], "how": "#how-i-work",
             "site": F["links"]["site"], "vocal": F["links"]["pages"].rstrip("/") + "/#home/vocal"}
    items = [f'[{t[lang]}]({links.get(t.get("project"), F["links"]["pages"])})' for t in F.get("topics") or []]
    if not items:
        return ""
    return ("**Ask me about:** " if lang == "en" else "**可以问我：**") + " · ".join(items)


def contact_html(F, a):
    """Ideas #109 and #148: the contact badges (drawn by lockscreen.py) and the guestbook."""
    lk = F["links"]
    href = {"linkedin": lk["linkedin"], "site": lk["site"], "email": f'mailto:{lk["email"]}',
            "guestbook": lk["pages"].rstrip("/") + "/" + GUESTBOOK}
    out = []
    for key in L.BADGES:
        _svg, alt, w = L.badge("dark", key, F)
        out.append(f'<a href="{href[key]}">{themed(f"badge-{key}", a.dark, a.light, w, 28, alt)}</a>')
    return "<p>\n" + "\n".join(out) + "\n</p>"


def footer_html(a):
    """Ideas #112 and #40: the date of the last nightly run (an image, so it stays current) and
    the link to how this profile works."""
    w, h = L.footer_size()
    alt = "The images on this page are redrawn every night by GitHub Actions; this line shows the date of the last run."
    return (f'<p>{themed("footer", a.dark, a.light, w, h, alt)}<br>\n'
            f'<sub><a href="{HOW}">How this profile works →</a></sub></p>')


# ---------------------------------------------------------------- idea #164: check the images
GENERIC = {"image", "img", "picture", "photo", "banner", "badge", "icon", "logo", "screenshot", "graphic", "svg", "widget"}
DECORATIVE = ("divider-",)   # thin rules between sections: alt="" on purpose


def check_images(readme, out_dir):
    """Every image: alt text present, meaningful (not a generic word, a URL or a file name; at
    least two words; one or two sentences; at most 320 characters), and unique; decorative images
    (the dividers) have alt="". Every image on the output branch exists in out_dir, if given.
    Returns a list of problems."""
    problems, seen = [], {}
    imgs = [(m.group(1), m.group(0)) for m in re.finditer(r"<img\b[^>]*\bsrc=\"([^\"]+)\"[^>]*>", readme)]
    imgs += [(m.group(2), m.group(0)) for m in re.finditer(r"!\[([^\]]*)\]\(([^)\s]+)\)", readme)]
    for src, tag in imgs:
        md = tag.startswith("![")
        alt_m = re.match(r"!\[([^\]]*)\]", tag) if md else re.search(r'\balt="([^"]*)"', tag)
        name = src.rsplit("/", 1)[-1]
        if alt_m is None:
            problems.append(f"{name}: no alt attribute")
            continue
        alt = alt_m.group(1)
        if any(name.startswith(d) for d in DECORATIVE):
            if alt:
                problems.append(f"{name}: decorative, so its alt should be empty")
            continue
        words = alt.split()
        sentences = [x for x in re.split(r"(?<=[.!?])\s+(?=[A-Z0-9\u4e00-\u9fff])|(?<=。)(?=.)", alt.strip()) if x]
        if not alt.strip():
            problems.append(f"{name}: empty alt text")
        elif alt.strip().lower().rstrip(".") in GENERIC or re.match(r"(image|picture|photo) of\b", alt.strip(), re.I):
            problems.append(f"{name}: alt text is generic: {alt!r}")
        elif re.search(r"https?://|\.(svg|png|jpe?g|gif)\b", alt, re.I):
            problems.append(f"{name}: alt text is a URL or a file name: {alt!r}")
        elif len(words) < 2:
            problems.append(f"{name}: alt text too short to mean much: {alt!r}")
        elif len(alt) > 320 or len(sentences) > 2:
            problems.append(f"{name}: alt text longer than one or two sentences ({len(alt)} characters)")
        key = alt.strip().lower()
        if key and key in seen and seen[key] != name:
            problems.append(f"{name}: same alt text as {seen[key]}: {alt!r}")
        seen.setdefault(key, name)
    if out_dir and os.path.isdir(out_dir):
        for url in sorted(set(re.findall(rf"{re.escape(OUT)}/([\w.-]+)", readme))):
            if not os.path.exists(os.path.join(out_dir, url)):
                problems.append(f"{url}: linked from the README but not in {os.path.relpath(out_dir, ROOT)}/ (run lockscreen.py all)")
    if re.search("[\u2013\u2014]", readme):
        problems.append("an en or em dash: the page must not show one")
    return problems


def style_warnings(readme):
    """dusk-spec "Forbidden text": the word for Apple's phone system only as "<it> 17.0 or later".
    A warning, not a stop: it comes from draft wording the user still has to confirm."""
    text = re.sub(r"```stl.*?```", "", readme, flags=re.S)
    return [f"the spec allows 'iOS' only as 'iOS 17.0 or later': ...{m.group(0)}..."
            for m in re.finditer(r".{0,24}\biOS\b(?! 17\.0 or later).{0,16}", text)]


def assistant_alt(ac):
    """'StoreX Chain duty assistant (Storewright part 3): 76.3% vs 42.5% ...' from the facts."""
    name = ac.get("name", "Duty assistant")
    part = ac.get("part", "")
    short, alias = part, ""
    if part.endswith(")") and " (" in part:
        short, alias = part[:-1].split(" (", 1)
    who = f"{alias} {name[0].lower()}{name[1:]}" if alias else name
    return (f'{who}{f" ({short})" if short else ""}: {ac["score"]:g}% vs {ac["baseline"]:g}% '
            f'for keyword rules on an {ac["set"]}.')


def widgets(F):
    """The sideways row: (file stem, width, link, caption, alt)."""
    sw, sn, lk = F["storewright"], F["silnest"], F["links"]
    return [
        ("w-silnest", 368, sn["store_url"], "App Store ↗", "SilNest (声藏): offline music player, live on the App Store. No ads, no account, data not collected."),
        ("w-storewright", 368, sw["demo"], "Live demo ↗", f'Storewright: a grocery store digital twin that runs in the browser. {sw["tests"]} tests passing.'),
        ("w-store-day", 176, sw["repo"], "Simulator ↗", "Today's simulated store day, from Storewright's open-source simulator. Synthetic data, refreshed every night."),
        ("w-accuracy", 176, sw["repo"], "The eval ↗", assistant_alt(F["assistant"])),
        ("w-site", 368, lk["site"], "yecanyuan.com ↗", "yecanyuan.com: my portfolio, on a Git-backed CMS I built."),
        ("w-vocal", 176, None, "Personal project", "AI Vocal: a local voice and singing studio for my own content. First track finished."),
        ("w-sky", 368, lk["pages"].rstrip("/") + "/#sky", "Your city's sky ↗",
         f"Tonight's sky over {F['city']}: the Moon's phase, sunset, and which planets are up. Worked out every night."),
        ("w-contact", 176, lk["linkedin"], "LinkedIn ↗", f'{F["city"]}, Eastern Time. LinkedIn and website.'),
    ]


def hint_text(F, layout, live):
    """The small print under the widget row."""
    return ("Scroll sideways for more widgets. " if layout == "below" else "") + (
        f"The clock is my local time in {F['city']}; the dot around my avatar ticks the seconds, "
        "and the planets set off from where they really are today." if live
        else "The widgets refresh every night, and the planets set off from where they really are today.")


def banner_sources(a):
    """(landscape dark, landscape light, portrait dark, portrait light) image addresses."""
    def src(page, layout):
        if a.clock:
            return f"{a.clock}?theme={page}&layout={layout}&weight={a.weight}" + ("&weather=1" if a.weather else "")
        return f"{OUT}/banner-{page}-{layout}-{a.weight}-daily.svg"
    return src(a.dark, a.layout), src(a.light, a.layout), src(a.dark, "portrait"), src(a.light, "portrait")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--clock", help="URL of the live banner function (api/lockscreen); default: links.clock in data/profile.json")
    ap.add_argument("--no-clock", action="store_true", help="use the daily image for the banner (no server), even if there is a clock")
    ap.add_argument("--layout", default="below", choices=["below", "right"])
    ap.add_argument("--weight", default="bold", choices=["bold", "thin"])
    ap.add_argument("--dark", default="dark", type=page_mode, help="art for dark pages (default dark)")
    ap.add_argument("--light", default="light", type=page_mode, help="art for light pages (default light)")
    ap.add_argument("--no-portrait", action="store_true",
                    help="leave out the portrait banner that screens narrower than 600 px get")
    ap.add_argument("--no-dividers", action="store_true", help="leave out the thin gradient rules between sections")
    ap.add_argument("--weather", action="store_true", help="show Albany weather after the date (live banner only)")
    ap.add_argument("--video", help="the github.com/user-attachments/assets/... URL after you upload the demo video")
    ap.add_argument("--out", default="out", help="where lockscreen.py wrote the images (checked if it exists)")
    ap.add_argument("--no-check", action="store_true", help="write the README even if the image check finds problems")
    a = ap.parse_args()

    with open(os.path.join(ROOT, "data", "profile.json"), encoding="utf-8") as f:
        F = json.load(f)
    today = dt.datetime.now(ZoneInfo(F["timezone"])).date()
    lk = F["links"]
    # The live clock stays in the README however it is run again, unless --no-clock says otherwise.
    a.clock = None if a.no_clock else (a.clock or lk.get("clock"))
    sw, sn = F["storewright"], F["silnest"]
    name = f'{F["name"]} ({F["name_zh"]})'

    # ---------- banner: a portrait one for phones first (the first matching <source> wins)
    lanes = F["lanes"]
    lane_text = ", ".join(x.lower() for x in lanes[:-1]) + f" and {lanes[-1].lower()}" if len(lanes) > 1 else lanes[0].lower()
    alt = (f"{name}: {lane_text}, in {F['city']} (Eastern Time). "
           f"My lock screen with the {'time' if a.clock else 'date'} and a small solar system around my avatar, whose planets set off "
           f"from where they really are today, with the Moon beside Earth in today's phase; it opens the interactive version.")
    dark_src, light_src, p_dark, p_light = banner_sources(a)
    portrait = not a.no_portrait and a.layout == "below"   # the right layout has no widget row to fall back on
    phone = (f'  <source media="(max-width: 600px) and (prefers-color-scheme: light)" srcset="{p_light}">\n'
             f'  <source media="(max-width: 600px)" srcset="{p_dark}">\n') if portrait else ""
    banner = (f'<p><a href="{lk["pages"]}"><picture>\n{phone}'
              f'  <source media="(prefers-color-scheme: light)" srcset="{light_src}">\n'
              f'  <img src="{dark_src}" width="100%" alt="{alt}">\n'
              f'</picture></a></p>')

    # ---------- widgets, one table row that scrolls sideways (dark or light cards by page)
    cells = []
    for key, w, href, cap, alt_w in widgets(F):
        pic = themed(key, a.dark, a.light, w, 176, alt_w)
        img = f'<a href="{href}">{pic}</a>' if href else pic
        cells.append(f"<td>{img}<br>{caption(cap, href, w)}</td>")
    row = "<table><tr>\n" + "\n".join(cells) + "\n</tr></table>"
    if a.layout == "right":
        row = ""   # the widgets are already in the banner

    # ---------- Storewright, outside the fold: the short video, or a still that opens the live demo
    demo = sw["demo"].rstrip("/") + "/"
    if a.video:
        title, show = "Storewright in 90 seconds", f"{a.video.strip()}"
    else:
        title = "Storewright at a glance"
        shot_alt = ("Storewright running in a browser: the 3D digital twin of a store on the left, "
                    "two associate phones on the right. Opens the live demo.")
        show = ("<!-- After uploading the demo video in GitHub's web editor, run make_readme.py --video <URL>. -->\n\n"
                f'<a href="{demo}">{themed("showcase-storewright", a.dark, a.light, 680, 440, shot_alt)}</a>')
    storewright = (f"### {title}\n\n{show}\n\n"
                   f"A grocery store digital twin that runs in your browser. "
                   f"**[Open the live demo ↗]({demo})** · [Read the README]({sw['repo']}#readme)")

    # ---------- the unlocked part: the app tiles, then the Chinese introduction and the 3D store
    early = F.get("early_work") or {}
    icons = [("silnest", sn["store_url"]), ("storewright", sw["repo"]), ("site", lk["site"]), ("vocal", None),
             ("howiwork", "#how-i-work"), ("earlywork", early.get("url", "https://github.com/Glacieerr?tab=repositories")),
             ("contact", lk["linkedin"])]
    labels = {"silnest": "SilNest", "storewright": "Storewright", "site": "Portfolio", "vocal": "AI Vocal",
              "howiwork": "How I work", "earlywork": early.get("label", "Early work"), "contact": "Contact"}
    # alt texts say where a tile leads (idea #164), not just its label
    icon_alt = {"silnest": "SilNest on the App Store", "storewright": "Storewright on GitHub",
                "site": f'Portfolio: {F["site"]["domain"]}', "vocal": "AI Vocal, a personal project",
                "howiwork": "How I work, further up this page",
                "earlywork": f'{labels["earlywork"]}: my other repositories on GitHub', "contact": "Contact me on LinkedIn"}
    icon_html = "\n".join(
        (f'<a href="{href}">' if href else "") + themed(f"icon-{k}", a.dark, a.light, 84, 98, icon_alt[k]) + ("</a>" if href else "")
        for k, href in icons)
    with open(os.path.join(ROOT, "assets", "store.stl"), encoding="utf-8") as f:
        stl = f.read().strip()

    hint = hint_text(F, a.layout, bool(a.clock))
    unlock = themed("unlock", a.dark, a.light, 262, 50, "Unlock the rest: apps, a 3D model of the store, and an introduction in Chinese")
    rule = "" if a.no_dividers else (
        f'<p><picture><source media="(prefers-color-scheme: light)" srcset="{OUT}/divider-{a.light}.svg">'
        f'<img src="{OUT}/divider-{a.dark}.svg" width="100%" height="2" alt=""></picture></p>\n\n')
    readme = f"""<!-- Generated by scripts/make_readme.py from data/profile.json. Edit those, then run it again. -->
{banner}

{milestones_html(F, a, today)}

{row}

<sub>{hint}</sub>

Hi, I'm Canyuan. I build software, creative tech and products: AI-native, and proven by tests.

{rule}{storewright}

{rule}### <a name="how-i-work"></a>How I work

I decide what to build and how we'll know it works. Claude Code writes most of the code; I review every change and accept it through tests and walkthroughs.

{mermaid_loop("en")}

[![Storewright test status on GitHub Actions](https://github.com/Glacieerr/storewright/actions/workflows/ci.yml/badge.svg)](https://github.com/Glacieerr/storewright/actions/workflows/ci.yml) <sub>Storewright's {sw["tests"]} tests run on every change.</sub>

{rule}### Now

- **AI Vocal**: a local voice and singing studio for my own content (GPT-SoVITS, SVC)

{timeline_html(F, a, today)}

{rule}### Skills

{skills_html(F, a)}

<sub>The brighter a star, the more of my projects used it. The same map as a list is in the unlocked part below.</sub>

<details>
<summary><a name="unlock">{unlock}</a></summary>

<p>
{icon_html}
</p>

#### 中文介绍

我是叶璨源，一个通才型开发者：用 Claude、ChatGPT 等多种 AI 工具，把想法做成能用、能测的成品。代表作是已经上架 App Store 的离线音乐播放器声藏 · SilNest，以及在浏览器里运行的杂货门店数字孪生 Storewright。

**{how_loop("zh")[1]}**

{mermaid_loop("zh")}

{topics_line(F, "zh")}

#### The skill map as a list

{skills_list(F)}

#### Rotate my store

Storewright's medium store, exported from its own layout code. Drag to turn it.

```stl
{stl}
```
</details>

{rule}{topics_line(F)}

{contact_html(F, a)}

{footer_html(a)}
"""
    readme = re.sub(r"\n{3,}", "\n\n", readme)          # a piece that is empty leaves no gap
    out_dir = a.out if os.path.isabs(a.out) else os.path.join(ROOT, a.out)
    problems = check_images(readme, out_dir)
    for w in style_warnings(readme):
        print(f"warning: {w}", file=sys.stderr)
    if problems:
        print("image check (idea #164):\n  " + "\n  ".join(problems), file=sys.stderr)
        if not a.no_check:
            raise SystemExit("README.md not written; fix the above or pass --no-check")
    with open(os.path.join(ROOT, "README.md"), "w", encoding="utf-8") as f:
        f.write(readme)
    n_img = len(re.findall(r"<img\b", readme)) + len(re.findall(r"!\[", readme))
    print(f"wrote README.md ({len(readme):,} characters; banner: {'live clock' if a.clock else 'daily image'}"
          f"{' + portrait for phones' if portrait else ''}; art: {a.dark} / {a.light}; weight: {a.weight}; "
          f"Storewright: {'video' if a.video else 'still image'}; {n_img} images, alt texts checked"
          f"{'' if problems else ', all fine'})")


if __name__ == "__main__":
    main()
