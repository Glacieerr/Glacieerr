#!/usr/bin/env python3
"""Build the interactive lock screen (the GitHub Pages user site) into one file.

    python3 pages/build.py                      # writes pages/dist/index.html
    node pages/tests/cdp.mjs pages/tests/test.mjs    # the interaction checks (headless Chrome)
    node pages/tests/cdp.mjs pages/tests/shots.mjs   # preview screenshots (OUT=<folder>)
    node pages/tests/cdp.mjs pages/tests/visual.mjs  # the main views against pages/tests/baseline/ (#179;
                                                     # MODE=update approves new ones; strict on a Mac only)
    node pages/tests/cdp.mjs pages/tests/perf.mjs    # first paint, largest paint, layout shift, long tasks,
                                                     # bytes, as a desktop and as a phone on slow 4G (#180)
    node pages/tests/cdp.mjs pages/tests/time-edges.mjs  # part 8 of test.mjs alone: DST, a leap day, New Year (#177)

The tests start Chrome with a fresh profile under $CHROME_PROFILE_ROOT (default: the system
temp folder). dist/index-r1.html (the first design) and dist/index-ios7.html (the iOS 7
restyle) are earlier versions, kept only locally for comparison (pages/dist/ is not committed).

Look: "Dusk Tech", following GitHub主页方案/dusk-spec.md. A near-black page (or its own white
design in light mode) with a faint dot grid and soft indigo, violet and teal glows; the lock
screen is the README banner at page scale (status pill, date, a bold gradient clock, the name
line, and the orbit: the avatar as the sun with the eight planets turning round it and a dot
that ticks the seconds, R3.1 in the spec); everything else is product UI in the same system:
cards with gradient borders, hairline rows, pill buttons.

R3.2 (ideas #79 to #88): the planets start from where they really are (heliocentric longitude)
and the Moon sits beside Earth at today's phase; each planet is a button that opens an app;
one virtual clock can travel through today or a year either side; the Sky app shows the sky
over any city (tonight's sunset, darkness, Moon and planets); Search takes ">" commands and
"?" lists every shortcut; the Contact app has a guestbook (giscus) that loads only on a click.

R3.3 batch 1b (calendar and time, ideas #93 to #150): meteor showers with their radiants on the
chart, eclipses to 2035, the next 30 days' close pairings, a year of sky events as an .ics file
(the same file scripts/sky_ics.mjs writes), the phone pointed at the sky, a constellation game
(all in the Sky app); the lunar date and solar term in Chinese, festival touches, a Moon-phase
tab icon, the Moon's phase on every calendar day, a day and night map in the Clock app, Earth
dragged round its ring to travel through time, and planet sounds that start only on a click.

R3.3 batch 2 (the shell, the experience and privacy): the visitor's own time beside Albany's
(#114) and a greeting by it (#152); "About this site" (I, or Search) with numbers worked out
here, the check against JPL, the privacy note, the accessibility note and the design drafts
(#115, #176, #122, #147); a 404 page, the share card and search-engine files next to
index.html (#116, #117, #181); standby (#118); a three-step tour on the first visit (#119); the
page's QR code (#120); today's wallpaper and the project wallpapers, drawn in the browser
(#145, #172); the design rules (#146); the guestbook on the home screen and at #guestbook
(#148); card.txt for a terminal (#149); the system share sheet (#151); what I use (#153); a
booking button and testimonials once they exist (#160, #161); SilNest's release notes when the
App Store has some (#171); a high-contrast mode (#182); and, last, a Content Security Policy
that holds the page to "no network" (#175).

R3.3 batch 3 (the work and recruiters): the sun glow round the avatar takes the colour of Albany's
sky in the README's four steps (#97); How I work gets an FAQ (#53), one real change step by step
(#156, confirmed by the user on 2026-11-15), the skill map (#110) and the timeline (#111); each project page
says who did what (#157) and lists its numbers (#158); Contact says what to ask me about (#113)
and links the public resumes, published next to index.html (#66); a plain one-page quick view at
#brief that also prints on one page (#154); present mode at #present (#155); and the Storewright
pick game on Storewright's own small store and route rule (#121). The user confirmed the batch
3 drafts (faq, roles, skills_map, topics) and Uses and the booking reply on 2026-11-15, so
profile.json's "pending" is empty. A data string the page may not show (a dash, or a phone
system named other than the page allows) is left out with a warning; Uses names "Android
Studio", the one way the page may name Android (the user's call, 2026-11-15).

Finished on 2026-11-15: the day and night map in the Clock app draws the land (#142, Natural
Earth's 1:110m outline, public domain, made into one path by scripts/land_path.py); the Storewright
page gets a "What if…" lab under the store day (#169): three sliders and Rerun, which runs one store
day of Storewright's own simulation in the browser (pages/src/storewright-sim.js, bundled by
scripts/bundle_storewright_sim.sh, AGPL-3.0) and sets it beside the card's numbers. The build runs
that bundle once with Node and leaves the lab out unless it gives the card's own numbers for the
card's day. The page carries the bundle as text and runs it only when a visitor asks. In Chinese
the solar terms sit on their Beijing dates, as Chinese calendars print them (#95).

Reads, and never writes:

  data/profile.json         every fact the page shows (a key listed in its "pending" is a draft:
                            Uses or the booking reply only in a --preview build, labelled; the
                            list has been empty since the user confirmed it all on 2026-11-15)
  data/store-day.json       the simulated store day (synthetic data, regenerated nightly)
  data/silnest-store.json   SilNest's App Store version, dates and release notes
  data/project-numbers.json Storewright's commits, tests and dates (#158)
  pages/src/resume/*.pdf    the public resumes (#66), copied next to index.html byte for byte
  pages/src/storewright-small.json
                            Storewright's small store for the pick game (#121), written by
                            pages/tests/storewright_small.mjs from a Storewright checkout
  pages/src/storewright-sim.js
                            Storewright's store-day simulation for the What if lab (#169), written
                            by scripts/bundle_storewright_sim.sh from a Storewright checkout; run
                            once here with Node to check it gives data/store-day.json's numbers
  pages/src/land.txt        the land outlines for the day and night map (#142), written by
                            scripts/land_path.py from Natural Earth's 1:110m land (public domain)
  assets/src/*.jpg          the SilNest icon and screenshots, the Storewright and site images,
                            and avatar.jpg (the orbit's centre, inlined as a data URI)
  pages/src/drafts/*.jpg    four small pictures of the earlier design drafts (#147)
  pages/src/webp/           the same photos as WebP (#180), made by `--webp`; each is used
                            only while manifest.json's SHA-256 of its JPEG still matches
  pages/src/og-image.png    the share card (#117); `--og` draws it again with headless Chrome
  pages/tests/last-run.json how many browser checks passed in the last full run (the About panel)
  scripts/check_astro.mjs   run with Node: the comparison with JPL Horizons (the About panel)
  live/qr.mjs               run with Node: the QR code of the page's address (#120)
  live/lockscreen-core.mjs  the Albany clock logic shared with the README banner
  live/astro.mjs            planet positions, the Moon, rise and set, tonight() (offline)
  live/sky-data.mjs         stars, constellation figures and the city list for the Sky app
  live/sky-chart.mjs        the sky chart (an SVG string)
  live/holidays.mjs         the Spring Festival and Mid-Autumn dates to 2035 (the festival
                            touches, #150, and the check on the browser's Chinese calendar, #95)

The live/ modules are inlined in that order as classic scripts (Holidays, SkyData, Astro,
SkyChart, LockCore); their `import { … } from './x.mjs'` lines become destructuring, so the page stays
one file. Besides index.html the build writes, next to it, the files GitHub Pages serves beside
the page; all of them must be published with it:

  giscus-dusk-dark.css, giscus-dusk-light.css   the guestbook's two themes
  404.html                                      "Lost in space" (#116)
  og-image.png                                  the share card, 1200 x 630 (#117)
  card.txt, card-plain.txt                      the terminal card, with and without colour (#149)
  robots.txt, sitemap.xml                       for search engines (#181)
  Canyuan_Ye_Resume.pdf, Canyuan_Ye_Resume_Product.pdf, 叶璨源_简历.pdf
                                                the public resumes, no phone number (#66)

Options:
  --preview        also show what is not set up yet (the booking button, testimonials, release
                   notes) and any drafts listed in profile.json's "pending", each with a
                   label that says so. Never publish a preview build.
  --out FILE       write the page to FILE instead (and none of the files beside it)
  --store FILE     read SilNest's App Store data from FILE instead of data/silnest-store.json
  --og             draw og-image.png again (needs Chrome: $CHROME or the usual place)
  --webp           re-encode the photos as WebP (quality 0.85) with headless Chrome's canvas
                   encoder into pages/src/webp/ (#180); run it after changing a photo

plus the page source in pages/src/. It no longer reads scripts/lockscreen.py or
out/gallery-data.json: the widgets are HTML now, so they can be frosted, translated and
switched between dark and light. The orbit geometry below mirrors lockscreen.ORBITS and the
build warns if the two drift apart.

Facts reach the copy through {{path|filter}} placeholders filled from the data files, so no
number or date is typed by hand. The build stops if a placeholder is unknown, if the English
and Chinese copy differ in shape, if an em or en dash, "9:41", the word for Apple's phone
system or a mention of Android slips into the page, if anything would load from the
network, or if the file grows past 1.5 MB. The one exception to "no network" is the guestbook:
after a visitor clicks to open it, and only once GISCUS has its repoId and categoryId, the page
adds giscus.app's script (which then talks to giscus.app and GitHub). Until then it loads
nothing and says that the guestbook opens when the site goes live.

Preview flags (query string unless noted)
-----------------------------------------
  ?appearance=auto|dark|light      dark or light page (default: auto = the system)
  ?theme=<old wallpaper name>      still accepted: midnight, orbit, blossom, aurora mean dark;
                                   lagoon, dawn mean light (?appearance= wins)
  ?lang=en|zh                      language (default: the browser's)
  ?motion=reduce                   no animation, no parallax; the planets stand still
  ?parallax=off                    the glows stay still (they drift up to 8 px with the pointer)
  ?weight=thin                     the thin clock (bold is the default)
  ?page=mid | ?page=<n>            scroll the lock-screen widget row to the middle or page n
  ?sheet=<widget>                  open a widget's detail panel (silnest, storewright,
                                   store-day, accuracy, site, vocal, contact)
  ?open=nc | nc-all                the Today panel (Today tab | All updates tab)
  ?open=cc                         Quick settings
  ?open=spotlight [&q=<text>]      Search (the command palette), optionally with a query
  ?open=folder                     the home screen with the "Early work" folder open
  ?open=tt | tt-dates              time travel (Today scale | Dates scale)
  ?open=keys                       the keyboard shortcuts sheet
  ?app=<app>                       open an app: silnest, storewright, site, vocal, how,
                                   contact, clock, calendar, sky, design, assets, uses
  ?open=about                      "About this site" (#115)
  ?tour=1                          the first-visit tour again, even if it was seen (#119)
  ?standby=<seconds>               standby after that many idle seconds, for this visit (#118)
  ?game=<n>                        the Storewright pick game starts at list n (#121; by default
                                   the day's list, YYYYMMDD in Albany)
  #brief                           the quick view, plain text on one page (#154)
  #present  #present/<n>           present mode, at slide n (#155)
  #home                            start unlocked
  #home/<app>  #home/early         start inside an app or the folder (#home/how = How I work)
  #guestbook                       the guestbook (in Contact), the address the README links (#148)
  #sky  #sky/<city id>             the Sky app (over Albany, or a city from live/sky-data.mjs)
  #sky/<city id or lat,lon>/<YYYY-MM-DD>[/<HH:MM>]
                                   the Sky app on that night (or at that local time), 1900 to
                                   2050 (R3.3, ideas #92 and #101; "Copy link" writes these). In
                                   the hour the clocks repeat in the fall, the second time round
                                   carries its UTC offset: /01:30-0500 (batch 6, #177)
  #<widget>                        a widget panel over the lock screen

Keys: Cmd+K / Ctrl+K or "/" search (">" for commands), "?" the shortcuts, I about this site,
N Today, C Quick settings, T time travel, Esc closes or goes back.
Choices made in Quick settings are remembered in localStorage (ls7-*); a flag wins over a
remembered choice.
"""
from __future__ import annotations

import argparse
import ast
import base64
import datetime as dt
import hashlib
import html
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
from pathlib import Path
from urllib.parse import quote

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SRC = HERE / "src"
ASSETS = ROOT / "assets" / "src"
OUT = HERE / "dist" / "index.html"
MAX_BYTES = 1_500_000
# The orbit (dusk-spec.md, R3.1): the avatar at the centre and the solar system's eight major
# planets round it, Mercury out to Neptune, as (rx, ry, rotation) in banner units. The same
# numbers as ORBITS in scripts/lockscreen.py (checked below, warning only).
ORBITS = [(52, 18, -9), (72, 25, -9), (93, 32, -9), (114, 39, -9),
          (138, 48, -9), (162, 56, -9), (187, 65, -9), (212, 73, -9)]
PERIODS = [12, 18, 26, 36, 50, 66, 86, 110]   # seconds per orbit, Mercury -> Neptune
# Phase from Unix time t: each planet starts at 12 o'clock and turns counter-clockwise on screen,
# so its angle (clockwise from 12) is -360 * (t mod P) / P. Everyone sees the same sky at once.
# name, radius, dark colour, light colour, halo (only on the planets it helps)
PLANETS = (
    ("mercury", 2.4, "#b9b4ae", "#7d7771", False),
    ("venus", 3.4, "#f2d3a2", "#b8823d", True),
    ("earth", 3.6, "#59c3ff", "#1580c9", True),
    ("mars", 3.0, "#ff8f6b", "#d0532f", False),
    ("jupiter", 7.0, "#e8c49c", "#a8763f", True),
    ("saturn", 6.0, "#f0d48a", "#b48d2e", True),
    ("uranus", 4.6, "#8be6e0", "#1f9c95", False),
    ("neptune", 4.4, "#8d98ff", "#4f55d8", True),
)
TRAIL = 30          # degrees of faint trail behind each planet
AVATAR_R = 34       # the avatar disc at the centre
SECONDS_R = 38      # the seconds dot runs round the avatar's edge once a minute
MOON_R = 1.9        # the Moon beside Earth (idea #80), lit as today's phase
# Each planet opens an app (idea #81); the inner rings hold the main work. Earth opens the Sky
# ("where you stand and look up") and the Moon, the first calendar, opens the Calendar.
PLANET_APPS = (("mercury", "storewright"), ("venus", "silnest"), ("earth", "sky"), ("mars", "vocal"),
               ("jupiter", "how"), ("saturn", "clock"), ("uranus", "site"), ("neptune", "contact"),
               ("moon", "calendar"))
# The guestbook (idea #85): giscus, loaded only after a click. Fill in repoId and categoryId
# from https://giscus.app when the site goes live; while either is empty the page shows a
# placeholder and loads nothing. The two Dusk themes are written next to index.html.
GISCUS = {
    "src": "https://giscus.app/client.js",
    "origin": "https://giscus.app",
    "repo": "Glacieerr/Glacieerr.github.io",
    "repoId": "",
    "category": "Guestbook",
    "categoryId": "",
    "mapping": "specific",
    "term": "guestbook",
    "strict": "0",
    "reactionsEnabled": "1",
    "emitMetadata": "0",
    "inputPosition": "top",
    "loading": "lazy",
}
# meta theme-color per appearance: the page background (tokens.json modes.*.bg)
THEME_BG = {"dark": "#08090c", "light": "#ffffff"}
# The orbit in banner units (the README banner is 1000 x 320): its centre, and the box that
# holds the rings and the three lane pills, which sit off the orbit (top-left corners in
# LANES_AT, in the order of profile.json's lanes: Software, Creative tech, Product).
CENTER = (770, 160)
STAGE = (544, 44, 460, 256)
LANES_AT = ((560, 52), (884, 268), (612, 268))
APPS = ("silnest", "storewright", "site", "vocal", "how", "contact", "clock", "calendar", "sky")
# R3.3 batch 2: pages about the site itself (#146, #172), and Uses (#153), which every build has
# since the user confirmed it on 2026-11-15 (while "uses" is in profile.json's "pending", only a
# --preview build has it).
SITE_APPS = ("design", "assets")
EARLY = ("BASIC", "CPU", "Memory", "WebDev", "SpeedTest")
# #147: the earlier design drafts (pictures in pages/src/drafts/, cut from the previews in
# resume_2026-11/预览/) and the day each was made: the phone-style restyle and the switch to Dusk
# Tech on 2026-11-13 (ios7-spec.md, dusk-spec.md), the avatar and eight planets the same day
# (dusk-spec.md R3.1), the real sky on 2026-11-14 (dusk-spec.md R3.2). None was ever released.
DRAFTS = (("phone", "2026-11-13"), ("dusk", "2026-11-13"), ("avatar", "2026-11-13"), ("sky", "2026-11-14"))
OG = HERE / "src" / "og-image.png"
LAST_RUN = HERE / "tests" / "last-run.json"
# R3.3 batch 3, idea #97: the "sun" glow behind the avatar takes the colour of Albany's sky in the
# four steps of the README's live banner (SUN_TIERS in scripts/lockscreen.py; the build warns if
# the two drift apart): below each solar altitude in degrees, the core colour on a dark and on a
# light page; the last row is for anything higher. Night a faint violet, twilight a dusky rose,
# sunrise and sunset a warm orange, the day a white gold. app.js works out the Sun's altitude over
# Albany (live/astro.mjs) and names the step on <html data-sun>; only the glow's core changes.
SUN_TIERS = [(-12, "#c4b5fd", "#a78bfa"),
             (-1, "#f5b4c8", "#ec8fb0"),
             (10, "#ffb37a", "#ff9a4d"),
             (None, "#fff0c9", "#ffc85c")]
SUN_NAMES = ("night", "twilight", "low", "day")
SUN_DEFAULT = {"dark": "#ffd6a0", "light": "#ffb46b"}   # until the page has worked out the altitude
# Idea #66: the public resumes (no phone number), published next to index.html. They are made by
# resume_2026-11/_source/build.sh public (R3.3素材/66-公开版简历/) and copied into pages/src/resume/;
# the key says which one: English (generalist), English (product and delivery), Chinese.
RESUME_DIR = HERE / "src" / "resume"
RESUMES = (("en", "Canyuan_Ye_Resume.pdf"), ("product", "Canyuan_Ye_Resume_Product.pdf"), ("zh", "叶璨源_简历.pdf"))
# Idea #121: Storewright's small store, its walk network and its catalog's shelves, written by
# pages/tests/storewright_small.mjs from a Storewright checkout (the page needs no checkout)
SW_GAME = HERE / "src" / "storewright-small.json"
# Idea #142: the land outlines on the Clock app's day and night map, one SVG path made from
# Natural Earth's 1:110m land layer (public domain) by scripts/land_path.py
LAND = HERE / "src" / "land.txt"
# Idea #169: Storewright's own store-day simulation for the "What if…" lab, bundled from a
# Storewright checkout by scripts/bundle_storewright_sim.sh (AGPL-3.0, like Storewright). The page
# carries it as text (<script type="text/plain" id="swSim">) and runs it only when asked; its hash
# is in the Content Security Policy like the other scripts'.
SW_SIM = HERE / "src" / "storewright-sim.js"


# --------------------------------------------------------------------------- inputs
def read_json(path: Path, default=None):
    if not path.exists():
        if default is not None:
            return default
        raise SystemExit(f"missing {path.relative_to(ROOT)}")

    def no_duplicates(pairs):
        keys = [k for k, _ in pairs]
        dup = sorted({k for k in keys if keys.count(k) > 1})
        if dup:
            raise SystemExit(f"{path.name}: key {dup[0]!r} appears twice in one object; the first would be lost")
        return dict(pairs)
    with open(path, encoding="utf-8") as f:
        return json.load(f, object_pairs_hook=no_duplicates)


def lockscreen_constant(name: str):
    """A constant from scripts/lockscreen.py, read without running the file (another job edits it)."""
    path = ROOT / "scripts" / "lockscreen.py"
    try:
        tree = ast.parse(path.read_text(encoding="utf-8"))
    except (OSError, SyntaxError):
        return None
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(getattr(t, "id", "") == name for t in node.targets):
            try:
                return [tuple(o) for o in ast.literal_eval(node.value)]
            except (ValueError, TypeError):
                return None
    return None


def lockscreen_orbits():
    """ORBITS from scripts/lockscreen.py."""
    return lockscreen_constant("ORBITS")


# The shared live/ modules the page inlines, in dependency order, each as a global name:
# the Sky app's data and chart, the astronomy, and the Albany clock (which may import astro).
MODULES = (("Holidays", "holidays.mjs"), ("SkyData", "sky-data.mjs"), ("Astro", "astro.mjs"), ("SkyChart", "sky-chart.mjs"),
           ("LockCore", "lockscreen-core.mjs"))
IMPORT = re.compile(r"^\s*import\s*\{([^}]*)\}\s*from\s*['\"]\./([\w.-]+)['\"]\s*;?[ \t]*$", re.M | re.S)
EXPORT_DECL = re.compile(r"^export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)", re.M)
EXPORT_LIST = re.compile(r"^export\s*\{([^}]*)\}\s*;?[ \t]*$", re.M)


def module_script(var: str, name: str, known: dict) -> str:
    """One ES module as a classic script: `const Var = (() => { body; return { exports }; })();`.
    `import { a, b as c } from './x.mjs'` becomes `const { a, b: c } = X;` (x.mjs must come
    earlier in MODULES), and the `export` keywords go. Em and en dashes (only in comments)
    become hyphens, because the page must not contain them."""
    code = (ROOT / "live" / name).read_text(encoding="utf-8").replace("—", "-").replace("–", "-")

    def imp(m):
        src = m.group(2)
        if src not in known:
            raise SystemExit(f"live/{name}: imports ./{src}, which the page does not inline before it")
        names = []
        for part in m.group(1).split(","):
            part = part.strip()
            if not part:
                continue
            a, _, b = part.partition(" as ")
            names.append(f"{a.strip()}: {b.strip()}" if b else a.strip())
        return f"const {{ {', '.join(names)} }} = {known[src]};"
    code = IMPORT.sub(imp, code)
    if re.search(r"^\s*import\b", code, re.M):
        raise SystemExit(f"live/{name}: an import the build cannot inline (only `import {{ … }} from './x.mjs'`)")
    exports = EXPORT_DECL.findall(code)
    for m in EXPORT_LIST.finditer(code):
        for part in m.group(1).split(","):
            a, _, b = part.strip().partition(" as ")
            if a.strip():
                exports.append(f"{b.strip()}: {a.strip()}" if b else a.strip())
    code = EXPORT_LIST.sub("", code)
    code = re.sub(r"^export\s+(default\s+)?", "", code, flags=re.M)
    return f"const {var} = (() => {{\n{code.strip()}\nreturn {{ {', '.join(dict.fromkeys(exports))} }};\n}})();"


def modules_script() -> str:
    """live/holidays.mjs, sky-data.mjs, astro.mjs, sky-chart.mjs and lockscreen-core.mjs, inlined
    in that order. The page needs parts() from the core (the Albany clock), the astronomy for the
    planets, the Moon and the Sky app, and the chart."""
    core = (ROOT / "live" / "lockscreen-core.mjs").read_text(encoding="utf-8")
    if "function parts(" not in core:
        raise SystemExit("live/lockscreen-core.mjs: parts() is gone; the page clock needs it")
    known, out = {}, []
    for var, name in MODULES:
        out.append(module_script(var, name, known))
        known[name] = var
    return "\n".join(out)


def data_uri(name: str, folder: Path = ASSETS) -> str:
    path = folder / name
    if not path.exists():
        raise SystemExit(f"missing image {path.relative_to(ROOT)}")
    mime = {".png": "image/png", ".webp": "image/webp"}.get(path.suffix, "image/jpeg")
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


# Every photo is stored once, as a CSS class, and reused wherever it appears.
IMAGES = {
    "sn-icon": "silnest-icon-512.jpg",
    "sn-s1": "silnest-s1.jpg",
    "sn-s6": "silnest-s6.jpg",
    "sw-world": "storewright-world-620.jpg",
    "sw-demo": "storewright-showcase.jpg",
    "site-home": "site-home.jpg",
}
# R3.3 batch 6, idea #180: the photos are most of what the page weighs, and base64 JPEG hardly
# shrinks under gzip, so the page carries them as WebP: `--webp` re-encodes each with headless
# Chrome's canvas encoder at quality 0.85 into pages/src/webp/<key>.webp (and manifest.json,
# with each source's SHA-256). A build uses a WebP only while its source is unchanged, and the
# JPEG otherwise (with a warning: run --webp again). The SilNest icon stays a JPEG, as the assets
# page saves it byte for byte; so does the avatar, which the README's banner shares. The assets
# page turns the other photos back into JPEG files when they are saved (app.js, downloadAsset).
WEBP_DIR = SRC / "webp"
WEBP_QUALITY = 0.85
WEBP_KEEP_JPEG = {"sn-icon"}


def photo_sources() -> dict[str, Path]:
    """Every photo the page inlines that may be carried as WebP: key -> source JPEG."""
    out = {k: ASSETS / v for k, v in IMAGES.items() if k not in WEBP_KEEP_JPEG}
    out.update({f"dr-{k}": SRC / "drafts" / f"{k}.jpg" for k, _ in DRAFTS})
    return out


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def photo_uri(key: str, source: Path) -> str:
    """The WebP made from `source` by --webp while the source is unchanged, else the JPEG."""
    webp = WEBP_DIR / f"{key}.webp"
    entry = read_json(WEBP_DIR / "manifest.json", default={}).get("images", {}).get(key)
    if webp.exists() and entry and entry.get("sha256") == sha256_file(source):
        return data_uri(webp.name, WEBP_DIR)
    if webp.exists() or entry:
        warn(f"{source.relative_to(ROOT)} changed since pages/src/webp/{key}.webp was made; using the JPEG (run pages/build.py --webp)")
    return data_uri(source.name, source.parent)


def images_css() -> str:
    webp = photo_sources()
    uri = lambda k, src: photo_uri(k, webp[k]) if k in webp else data_uri(src.name, src.parent)  # noqa: E731
    css = [f'.img-{k}{{background-image:url("{uri(k, ASSETS / v)}")}}' for k, v in IMAGES.items()]
    # #147: the design drafts, small (320 x 200, about 8 KB each)
    css += [f'.img-dr-{k}{{background-image:url("{uri("dr-" + k, SRC / "drafts" / (k + ".jpg"))}")}}' for k, _ in DRAFTS]
    return "\n".join(css)


def webp_render() -> bool:
    """#180: re-encode the photos as WebP with headless Chrome's canvas encoder (WEBP_QUALITY)
    into pages/src/webp/, keeping a WebP only when it is smaller than its JPEG. Run it again
    after changing a photo; compare the pages before and after (pages/tests/visual.mjs)."""
    chrome = chrome_bin()
    if not chrome:
        warn("no Chrome to make the WebP photos (set CHROME)")
        return False
    sources = photo_sources()
    # the photos as <img> elements: by the load event each is decoded, and drawing and encoding
    # are synchronous, so the answer is in the page when Chrome prints it (--dump-dom)
    imgs = "".join(f'<img data-k="{k}" src="{data_uri(p.name, p.parent)}">' for k, p in sources.items())
    page = (f'<!doctype html><meta charset="utf-8"><body>{imgs}<script>addEventListener("load", () => {{ const out = {{}};'
            " for (const i of document.querySelectorAll('img[data-k]')) { const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight;"
            f" c.getContext('2d').drawImage(i, 0, 0); out[i.dataset.k] = [c.width, c.height, c.toDataURL('image/webp', {WEBP_QUALITY})]; }}"
            " const p = document.createElement('pre'); p.id = 'out'; p.textContent = JSON.stringify(out); document.body.append(p); });</script></body>")
    with tempfile.TemporaryDirectory() as tmp:
        f = Path(tmp) / "webp.html"
        f.write_text(page, encoding="utf-8")
        r = subprocess.run([chrome, "--headless=new", "--disable-gpu", "--no-first-run", f"--user-data-dir={Path(tmp) / 'profile'}",
                            "--virtual-time-budget=20000", "--dump-dom", f.as_uri()], capture_output=True, text=True, timeout=180)
    m = re.search(r'<pre id="out">(.*?)</pre>', r.stdout, flags=re.S)
    if not m:
        warn("Chrome did not encode the WebP photos")
        return False
    made = json.loads(html.unescape(m.group(1)))
    WEBP_DIR.mkdir(parents=True, exist_ok=True)
    images, saved = {}, 0
    for k, p in sources.items():
        w, h, uri = made[k]
        if not uri.startswith("data:image/webp;base64,"):
            warn(f"Chrome made no WebP for {k}; keeping the JPEG")
            continue
        data = base64.b64decode(uri.split(",", 1)[1])
        if len(data) >= p.stat().st_size:
            (WEBP_DIR / f"{k}.webp").unlink(missing_ok=True)
            print(f"  {k}: the WebP ({len(data)} B) is no smaller than {p.name} ({p.stat().st_size} B); keeping the JPEG")
            continue
        (WEBP_DIR / f"{k}.webp").write_bytes(data)
        images[k] = {"source": str(p.relative_to(ROOT)), "sha256": sha256_file(p), "width": w, "height": h,
                     "jpeg_bytes": p.stat().st_size, "webp_bytes": len(data)}
        saved += p.stat().st_size - len(data)
        print(f"  {k}: {p.name} {p.stat().st_size / 1024:.1f} KB -> {k}.webp {len(data) / 1024:.1f} KB ({w} x {h})")
    (WEBP_DIR / "manifest.json").write_text(json.dumps({
        "note": "Written by pages/build.py --webp (idea #180): each photo re-encoded by headless Chrome's canvas encoder. "
                "A build uses a WebP only while its source's SHA-256 matches.",
        "quality": WEBP_QUALITY, "images": images}, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(images)} WebP photos to {WEBP_DIR.relative_to(ROOT)} ({saved / 1024:.0f} KB smaller, {saved * 4 / 3 / 1024:.0f} KB less in the page)")
    return True


# --------------------------------------------------------------------------- copy
def fmt_value(v) -> str:
    return f"{v:g}" if isinstance(v, float) else str(v)


def _d(s):
    return dt.date.fromisoformat(s)


FILTERS = {
    # 2026-09-08 -> September 8, 2026
    "date_en": lambda s: (lambda d: f"{d:%B} {d.day}, {d.year}")(_d(s)),
    # 2026-09-08 -> Sep 8, 2026
    "date_short": lambda s: (lambda d: f"{d:%b} {d.day}, {d.year}")(_d(s)),
    # 2026-09-08 -> 2026 年 9 月 8 日
    "date_zh": lambda s: (lambda d: f"{d.year} 年 {d.month} 月 {d.day} 日")(_d(s)),
    # Nov 2026 -> 2026 年 11 月
    "month_zh": lambda s: (lambda d: f"{d.year} 年 {d.month} 月")(dt.datetime.strptime(s, "%b %Y")),
    # 80-question held-out set -> 80
    "count": lambda s: re.match(r"\d+", s).group(0),
    # https://github.com/Glacieerr/storewright -> github.com/Glacieerr/storewright
    "host": lambda s: re.sub(r"^https?://(www\.)?", "", s).rstrip("/"),
    # 6590 -> 6,590
    "num": lambda s: f"{float(s):,.10g}",
    # Apr 2026 -> 2026-04 (a month the page formats per language)
    "ym": lambda s: dt.datetime.strptime(s, "%b %Y").strftime("%Y-%m"),
    "upper": str.upper,
    "lower": str.lower,
}
PLACEHOLDER = re.compile(r"\{\{([\w.-]+)(?:\|(\w+))?\}\}")


def lookup(facts, path):
    val = facts
    for part in path.split("."):
        if isinstance(val, dict) and part in val:
            val = val[part]
        else:
            return None
    return val


def prune(obj, facts):
    """A table row whose last cell is "?fact.path" is kept only when that fact is known
    (for example SilNest's minimum system version, which the App Store lookup supplies)."""
    if isinstance(obj, dict):
        return {k: prune(v, facts) for k, v in obj.items()}
    if isinstance(obj, list):
        out = []
        for x in obj:
            if isinstance(x, list) and x and isinstance(x[-1], str) and x[-1].startswith("?"):
                if lookup(facts, x[-1][1:]) in (None, ""):
                    continue
                x = x[:-1]
            out.append(prune(x, facts))
        return out
    return obj


def fill(obj, facts):
    """Replace {{path|filter}} in every string with the fact from the data files."""
    if isinstance(obj, str):
        def sub(m):
            val = facts
            for part in m.group(1).split("."):
                if isinstance(val, list) and part.isdigit() and int(part) < len(val):
                    val = val[int(part)]
                elif isinstance(val, dict) and part in val:
                    val = val[part]
                else:
                    raise SystemExit(f"copy.json: no fact called {{{{{m.group(1)}}}}}")
            val = fmt_value(val)
            if m.group(2):
                if m.group(2) not in FILTERS:
                    raise SystemExit(f"copy.json: unknown filter |{m.group(2)}")
                val = FILTERS[m.group(2)](val)
            return val
        return PLACEHOLDER.sub(sub, obj)
    if isinstance(obj, list):
        return [fill(x, facts) for x in obj]
    if isinstance(obj, dict):
        return {k: fill(v, facts) for k, v in obj.items()}
    return obj


def shape(obj, path=""):
    """Every key path in a copy tree, with list lengths, to compare English and Chinese."""
    if isinstance(obj, dict):
        out = set()
        for k, v in obj.items():
            out |= shape(v, f"{path}.{k}")
        return out
    if isinstance(obj, list):
        out = {f"{path}[{len(obj)}]"}
        for i, v in enumerate(obj):
            out |= shape(v, f"{path}[{i}]")
        return out
    return {path}


# --------------------------------------------------------------------------- pictures
def _ring_ends(rx: float, ry: float, rot: float) -> tuple[str, str]:
    """The two ends of an orbit's long axis, in banner units ("x,y" strings)."""
    cx, cy = CENTER
    c, s = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    return (f"{cx - rx * c:.2f},{cy - rx * s:.2f}", f"{cx + rx * c:.2f},{cy + rx * s:.2f}")


def orbit_markup(avatar: str, p: str = "orb-") -> str:
    """The README banner's orbit at page scale, drawn in banner units (viewBox = STAGE).

    The avatar sits at the centre like a sun (a soft glow behind it, a gradient edge), and the
    eight planets turn round it on rings tilted -9 degrees. Every ring is drawn behind the
    avatar, so no line crosses the face; each planet is drawn twice, clipped to its ring's far
    half (behind the avatar) and near half (in front of it), so it passes behind the avatar and
    makes a small transit in front of it. A short faint trail follows each planet: it is drawn
    on a circle and squashed into the ellipse, so a rotation keeps it attached to its planet.
    A dot runs round the avatar's edge with the seconds. app.js moves the planets ([data-o]),
    turns their trails ([data-trail]) and the seconds dot ([data-sec]). Every colour is a CSS
    variable, so the same markup serves the dark and the light page; the prefix `p` keeps the
    ids unique when the Clock app shows a second copy."""
    cx, cy = CENTER
    x0, y0, w, h = STAGE

    def stops(*ss):
        out = ""
        for o, c, a in ss:
            op = f' stop-opacity="{a}"' if a != 1 else ""
            out += f'<stop offset="{o}" style="stop-color:{c}"{op}/>'
        return out
    defs = [
        f'<linearGradient id="{p}dg" x1="0" x2="0" y1="{cy - 79}" y2="{cy + 79}" gradientUnits="userSpaceOnUse">'
        + stops((0, "#fff", .38), (.55, "#fff", .62), (1, "#fff", 1)) + "</linearGradient>",
        f'<mask id="{p}depth" maskUnits="userSpaceOnUse" x="{x0 - 20}" y="{y0 - 20}" width="{w + 40}" height="{h + 40}">'
        f'<rect x="{x0 - 20}" y="{y0 - 20}" width="{w + 40}" height="{h + 40}" fill="url(#{p}dg)"/></mask>',
        # the "sun": a core in the colour of Albany's sky (#97, --sun-core, set by app.js) that
        # shows as a faint ring round the avatar, then violet -> indigo, the README banner's stops
        f'<radialGradient id="{p}sun">'
        + stops((0, "var(--sun-core)", 1), (.47, "var(--sun-core)", .9), (.56, "var(--violet)", .85), (.76, "var(--indigo)", .45),
                (1, "var(--indigo)", 0)) + "</radialGradient>",
        f'<linearGradient id="{p}edge" x1="0" x2="1" y1="0" y2="1">'
        + stops((0, "var(--indigo)", 1), (1, "var(--teal)", 1)) + "</linearGradient>",
        # a soft light from the upper left on every planet
        f'<radialGradient id="{p}shade" cx=".36" cy=".3" r=".78">'
        + stops((0, "#fff", .5), (.42, "#fff", 0), (1, "#000", .22)) + "</radialGradient>",
        f'<clipPath id="{p}av"><circle cx="{cx}" cy="{cy}" r="{AVATAR_R}"/></clipPath>',
        f'<clipPath id="{p}jup"><circle r="7"/></clipPath>',
    ]
    rings, back, front = [], [], []
    n_rings = len(ORBITS)
    for i, ((rx, ry, rot), (name, pr, _dk, _lt, halo)) in enumerate(zip(ORBITS, PLANETS)):
        left, right = _ring_ends(rx, ry, rot)
        # 1px and faint; the outer rings a little stronger
        rings.append(f'<path d="M{left}A{rx},{ry} {rot} 0 0 {right}A{rx},{ry} {rot} 0 0 {left}Z" '
                     f'stroke-opacity="{.3 + .16 * i / (n_rings - 1):.2f}"/>')
        col = f"var(--pl-{name})"
        if halo:
            defs.append(f'<radialGradient id="{p}h{i}">' + stops((0, col, 1), (.5, col, .6), (1, col, 0)) + "</radialGradient>")
        # each half of the ring, in the ring's own frame (they overlap a hair so no seam shows)
        defs.append(f'<clipPath id="{p}far{i}"><rect x="{-rx - 30}" y="{-ry - 30}" width="{2 * rx + 60}" height="{ry + 30.6}"/></clipPath>')
        defs.append(f'<clipPath id="{p}near{i}"><rect x="{-rx - 30}" y="-0.6" width="{2 * rx + 60}" height="{ry + 30.6}"/></clipPath>')
        # the trail: 10 chords of a circle of radius rx, from 30 degrees behind the planet up to
        # it (the planets turn counter-clockwise, so behind is clockwise), fading in
        n = 10
        segs = []
        for k in range(n):
            a0 = math.radians(TRAIL - k * TRAIL / n)
            a1 = math.radians(TRAIL - (k + 1) * TRAIL / n)
            segs.append(f'<path d="M{rx * math.sin(a0):.2f},{-rx * math.cos(a0):.2f}L{rx * math.sin(a1):.2f},{-rx * math.cos(a1):.2f}"'
                        f' stroke-opacity="{((k + 1) / n) ** 1.5 * .5:.3f}"/>')
        trail = f'<g transform="scale(1 {ry / rx:.5f})"><g data-trail="{i}" style="stroke:{col}">{"".join(segs)}</g></g>'
        body = f'<circle r="{pr * 2.6:.2f}" fill="url(#{p}h{i})" opacity=".14"/>' if halo else ""
        if name == "saturn":
            body += '<g class="sat-ring" transform="rotate(-20)"><path d="M-11,0A11,3.6 0 0 1 11,0"/></g>'
        body += f'<circle class="pl pl-{name}" r="{pr}" style="fill:{col}"/>'
        if name == "jupiter":
            body += (f'<g clip-path="url(#{p}jup)" class="bands"><rect x="-7" y="-2.9" width="14" height="1.3"/>'
                     '<rect x="-7" y="1.2" width="14" height="1.1"/></g>')
        body += f'<circle r="{pr}" fill="url(#{p}shade)"/>'
        if name == "earth":
            # upright on screen (the ring frame is tilted), lit as today's phase by app.js
            body += (f'<g class="moon" data-moon="" transform="translate(0 -9)"><g transform="rotate({-rot})">'
                     f'<circle class="moon-halo" r="{MOON_R * 2.4:.2f}"/><circle class="moon-dark" r="{MOON_R}"/>'
                     '<path class="moon-lit" d=""/></g></g>')
        if name == "saturn":
            body += '<g class="sat-ring" transform="rotate(-20)"><path d="M-11,0A11,3.6 0 0 0 11,0"/></g>'
        planet = f'<g data-o="{i}" data-planet="{name}" transform="translate(0 {-ry})">{body}</g>'
        frame = f'translate({cx} {cy}) rotate({rot})'
        back.append(f'<g class="far" transform="{frame}" clip-path="url(#{p}far{i})"><g class="trail">{trail}</g>{planet}</g>')
        front.append(f'<g class="near" transform="{frame}" clip-path="url(#{p}near{i})"><g class="trail">{trail}</g>{planet}</g>')
    a = AVATAR_R
    svg = (
        f'<svg class="orbit-svg" viewBox="{x0} {y0} {w} {h}" aria-hidden="true" focusable="false">'
        f'<defs>{"".join(defs)}</defs>'
        f'<circle class="sun" cx="{cx}" cy="{cy}" r="70" fill="url(#{p}sun)"/>'
        f'<g class="rings" mask="url(#{p}depth)">{"".join(rings)}</g>'
        f'<g class="planets-far">{"".join(back)}</g>'
        f'<circle class="av-bg" cx="{cx}" cy="{cy}" r="{a}"/>'
        f'<image class="av-img" href="{avatar}" x="{cx - a}" y="{cy - a}" width="{2 * a}" height="{2 * a}" '
        f'preserveAspectRatio="xMidYMid slice" clip-path="url(#{p}av)"/>'
        f'<circle class="av-edge" cx="{cx}" cy="{cy}" r="{a}" stroke="url(#{p}edge)"/>'
        f'<g class="planets-near">{"".join(front)}</g>'
        f'<g transform="translate({cx} {cy})"><circle class="sec-dot" data-sec="" r="1.8" transform="translate(0 {-SECONDS_R})"/></g>'
        "</svg>")
    return svg


def planets_css() -> str:
    """The planets' colours for the dark and the light page (dusk-spec.md R3.1), and the sun
    glow's core for each step of the Sun's altitude (#97)."""
    dark = ";".join(f"--pl-{n}:{d}" for n, _r, d, _l, _h in PLANETS)
    light = ";".join(f"--pl-{n}:{lt}" for n, _r, _d, lt, _h in PLANETS)
    return f':root{{{dark}}}\n:root[data-appearance="light"]{{{light}}}\n' + sun_css()


def sun_css() -> str:
    """#97: --sun-core per step of the Sun's altitude over Albany (<html data-sun="night|twilight|
    low|day">, set by app.js) and page mode; the default holds until the page has worked it out."""
    out = [f':root{{--sun-core:{SUN_DEFAULT["dark"]}}}', f':root[data-appearance="light"]{{--sun-core:{SUN_DEFAULT["light"]}}}']
    for name, (_limit, dark, light) in zip(SUN_NAMES, SUN_TIERS):
        out.append(f':root[data-sun="{name}"]{{--sun-core:{dark}}}')
        out.append(f':root[data-appearance="light"][data-sun="{name}"]{{--sun-core:{light}}}')
    return "\n".join(out)


def lanes_html(lanes: list[str], esc) -> str:
    """The three lane pills. On the lock screen they sit off the orbit where the banner has them
    (Creative tech is placed by its right edge so it never spills out); on the home card they
    are a plain row."""
    x0, y0, w, h = STAGE
    out = []
    for i, (label, (lx, ly)) in enumerate(zip(lanes, LANES_AT)):
        if i == 1:
            right = x0 + w - (lx + 114)
            pos = f"--r:{right / w * 100:.2f}%;--y:{(ly - y0) / h * 100:.2f}%"
        else:
            pos = f"--x:{(lx - x0) / w * 100:.2f}%;--y:{(ly - y0) / h * 100:.2f}%"
        out.append(f'<li class="lane" style="{pos}"><i aria-hidden="true"></i><span data-i18n="lanes.{i}">{esc(label)}</span></li>')
    return "".join(out)


# Line glyphs for the app tiles (24 x 24, stroke only, round caps and joins), drawn once and
# reused with <use>; the stroke is the tiles' indigo -> teal gradient (#tg in the sprite).
GLYPHS = {
    # isometric box (the README's Storewright tile)
    "storewright": "M12 3 20.5 7.6v8.8L12 21l-8.5-4.6V7.6z M3.5 7.6 12 12.2l8.5-4.6 M12 12.2V21",
    # globe
    "site": "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M3 12h18 M12 3c2.6 2.5 3.9 5.5 3.9 9s-1.3 6.5-3.9 9c-2.6-2.5-3.9-5.5-3.9-9S9.4 5.5 12 3z",
    # waveform
    "vocal": "M3.5 10.5v3 M7 7.5v9 M10.5 4v16 M14 8v8 M17.5 6v12 M21 10.5v3",
    # person
    "contact": "M12 11.5a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5z M5.5 19.5c.9-3.4 3.4-5.2 6.5-5.2s5.6 1.8 6.5 5.2",
    # checklist
    "how": "M4 6.8l1.7 1.7L9 5.2 M12 7h8 M4 12.8l1.7 1.7L9 11.2 M12 13h8 M4 18.8l1.7 1.7L9 17.2 M12 19h8",
    # folder
    "early": "M3 7.2c0-.9.7-1.7 1.7-1.7h4.6l2.1 2.4h7.9c.9 0 1.7.7 1.7 1.7v8.6c0 .9-.8 1.7-1.7 1.7H4.7c-1 0-1.7-.8-1.7-1.7z M3 10.6h18",
    # the Sky app: a crescent Moon under a twinkle, over a horizon line
    "sky": "M14.2 4.6a6.8 6.8 0 1 0 5.2 10.9 5.4 5.4 0 0 1-5.2-10.9z M18.6 3.2v3.6 M16.8 5h3.6 M3 20.5h18",
    # bar chart (the simulated store day)
    "sim": "M3.5 20h17 M7 16.5v-4 M12 16.5V7.5 M17 16.5v-6.5",
    # prompt in a window
    "basic": "M4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11A1.5 1.5 0 0 1 4.5 5z M7 10l3 2.5L7 15 M12.5 15.5h4.5",
    # chip
    "cpu": "M8 7.5h8a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-.5.5H8a.5.5 0 0 1-.5-.5V8a.5.5 0 0 1 .5-.5z M10.5 10.5h3v3h-3z M10 4v3.5 M14 4v3.5 M10 16.5V20 M14 16.5V20 M4 10h3.5 M4 14h3.5 M16.5 10H20 M16.5 14H20",
    # memory module
    "memory": "M3 8h18v7.5h-7.2l-.9 1.5h-1.8l-.9-1.5H3z M6.5 15.5V18 M9.5 15.5V18 M14.5 15.5V18 M17.5 15.5V18 M6.5 10.5h3v2.5h-3z M14.5 10.5h3v2.5h-3z",
    # angle brackets
    "webdev": "M8.5 7 3.5 12l5 5 M15.5 7l5 5-5 5 M13.6 4.5l-3.2 15",
    # gauge
    "speed": "M3.5 16.5a8.5 8.5 0 0 1 17 0 M12 16.5l4.2-4.6 M6.4 11.7l1 .6 M12 8.1v1.2 M17.6 11.7l-1 .6 M12 15.3a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4z",
    # profile card (the LinkedIn link: a generic glyph, not their logo)
    "card": "M4 5.5h16A1.5 1.5 0 0 1 21.5 7v10a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 17V7A1.5 1.5 0 0 1 4 5.5z M8.5 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M5.5 15.5c.5-1.6 1.6-2.4 3-2.4s2.5.8 3 2.4 M14 10h4.5 M14 13.5h4.5",
    # envelope
    "mail": "M4 6h16A1.5 1.5 0 0 1 21.5 7.5v9A1.5 1.5 0 0 1 20 18H4a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 4 6z M3 7.2l9 6.3 9-6.3",
    # branch (the GitHub link: a generic glyph, not their logo)
    "branch": "M7 3.5a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8z M7 16.7a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8z M17 5.5a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8z M7 7.3v9.4 M17 9.3c0 4.2-5.3 3.9-9.3 7.6",
    # R3.3 batch 2: a speech bubble (the guestbook, #148)
    "guestbook": "M5 5h14a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5h-8.2L7 19.8v-3.3H5A1.5 1.5 0 0 1 3.5 15V6.5A1.5 1.5 0 0 1 5 5z M8 9.4h8 M8 12.4h5",
    # a palette (the design rules, #146)
    "design": "M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.7 1.8-1.6 0-1-.9-1.4-.9-2.3s.7-1.6 1.7-1.6h2.1a3.8 3.8 0 0 0 3.8-3.8C20.5 7 16.7 3.5 12 3.5z M7.1 11.6a1.1 1.1 0 1 0 2.2 0 1.1 1.1 0 1 0-2.2 0z M9.6 7.9a1.1 1.1 0 1 0 2.2 0 1.1 1.1 0 1 0-2.2 0z M14 7.9a1.1 1.1 0 1 0 2.2 0 1.1 1.1 0 1 0-2.2 0z",
    # a framed picture (the assets and wallpapers, #172)
    "assets": "M4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11A1.5 1.5 0 0 1 4.5 5z M3.6 16.2l4.9-4.7 3.6 3.3 2.6-2.4 5.6 5 M14.4 9.2a1.3 1.3 0 1 0 2.6 0 1.3 1.3 0 1 0-2.6 0z",
    # a laptop (what I use, #153)
    "uses": "M5.5 5.5h13a1 1 0 0 1 1 1v8.5h-15V6.5a1 1 0 0 1 1-1z M2.5 15h19l-1 2.6a1.2 1.2 0 0 1-1.1.8H4.6a1.2 1.2 0 0 1-1.1-.8z",
    # an i in a circle (about this site, #115)
    "about": "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 10.6v5.6 M12 7.4v.4",
}
GLYPHS["globe"] = GLYPHS["site"]
UI_GLYPHS = {
    # 24 x 24 line glyphs for controls (stroke currentColor)
    "search": '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5l5 5"/>',
    "moon": '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
    "sun": '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
    "auto": '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
    "lock": '<rect x="5.5" y="10.5" width="13" height="9.5" rx="2.2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
    "left": '<path d="M19 12H5.5M11 6l-6 6 6 6"/>',
    "chev": '<path d="M9.5 6l6 6-6 6"/>',
    "prev": '<path d="M14.5 6l-6 6 6 6"/>',
    "ext": '<path d="M8 7h9v9M17 7 7 17"/>',
    "today": '<rect x="3.5" y="4.5" width="17" height="7" rx="2"/><rect x="3.5" y="14.5" width="17" height="5" rx="2"/>',
    "clock": '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    "pin": '<path d="M12 21s6.5-5.8 6.5-11a6.5 6.5 0 1 0-13 0c0 5.2 6.5 11 6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    "target": '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
    "sliders": '<path d="M4 7.5h9M17 7.5h3M15 5.2v4.6M4 16.5h3M11 16.5h9M9 14.2v4.6"/>',
    "close": '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    "check": '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    # the Sky app's "Save as image" and "Copy link" (ideas #101)
    "save": '<path d="M12 4v10.5M7.5 10l4.5 4.5 4.5-4.5M5 19.5h14"/>',
    "link": '<path d="M10.2 13.8a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.4 1.4M13.8 10.2a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.4-1.4"/>',
    # R3.3 batch 2: share (#151), copy, play (#146), a speech bubble, a shield, an eye, a keyboard
    "share": '<path d="M12 3.8v11M8 7.6l4-3.8 4 3.8M6 11.5v7A1.5 1.5 0 0 0 7.5 20h9a1.5 1.5 0 0 0 1.5-1.5v-7"/>',
    "copy": '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
    "play": '<path d="M8 5.5v13l10.5-6.5z"/>',
    "chat": '<path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5h-8.2L7 19.8v-3.3H5A1.5 1.5 0 0 1 3.5 15V6.5A1.5 1.5 0 0 1 5 5z"/>',
    "shield": '<path d="M12 3.2 19 6v5.6c0 4.4-3 7.5-7 9.2-4-1.7-7-4.8-7-9.2V6z"/><path d="M9 12l2.2 2.2L15.2 10"/>',
    "eye": '<path d="M2.8 12s3.4-6.2 9.2-6.2 9.2 6.2 9.2 6.2-3.4 6.2-9.2 6.2S2.8 12 2.8 12z"/><circle cx="12" cy="12" r="2.8"/>',
    "keys": '<rect x="2.8" y="6.5" width="18.4" height="11" rx="2"/><path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7.5 14h9"/>',
    "contrast": '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/>',
    "motion": '<path d="M3.5 12h3l2-5 3.5 10 2.5-7 1.5 2h4.5"/>',
    # R3.3 batch 3: a printer (the quick view, #154)
    "print": '<path d="M7 9V4.5h10V9M7 16.5H5.2a1.7 1.7 0 0 1-1.7-1.7v-4.1A1.7 1.7 0 0 1 5.2 9h13.6a1.7 1.7 0 0 1 1.7 1.7v4.1a1.7 1.7 0 0 1-1.7 1.7H17"/><rect x="7" y="13.5" width="10" height="6.5" rx="1"/>',
}
# 16 x 16 glyphs for the widget headers (the mock's icon set)
W_GLYPHS = {
    "shield": '<g stroke-width="1.5" stroke-linejoin="round"><path d="M8 1.8 13 3.6v4c0 3.2-2.2 5.4-5 6.6C5.2 13 3 10.8 3 7.6v-4z"/><path d="m5.8 8 1.6 1.6L10.4 6.6" stroke-linecap="round"/></g>',
    "check": '<g stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6.4"/><path d="m5.3 8.2 1.8 1.8 3.6-3.8"/></g>',
    "arrow": '<g stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 11 11 5M6 5h5v5"/></g>',
    "cube": '<g stroke-width="1.4" stroke-linejoin="round"><path d="M8 1.6 14 5v6L8 14.4 2 11V5z"/><path d="M2 5l6 3.4L14 5M8 8.4v6"/></g>',
    "chart": '<g stroke-width="1.5" stroke-linecap="round"><path d="M2.5 13.5h11"/><path d="M4.5 11V8M8 11V4.5M11.5 11V6.5"/></g>',
    "spark": '<g stroke-width="1.4" stroke-linejoin="round"><path d="M8 1.8c.6 3.3 2.9 5.6 6.2 6.2-3.3.6-5.6 2.9-6.2 6.2-.6-3.3-2.9-5.6-6.2-6.2C5.1 7.4 7.4 5.1 8 1.8z"/></g>',
    "globe": '<g stroke-width="1.4"><circle cx="8" cy="8" r="6.2"/><path d="M1.8 8h12.4M8 1.8c1.8 1.8 2.6 3.9 2.6 6.2S9.8 12.4 8 14.2C6.2 12.4 5.4 10.3 5.4 8S6.2 3.6 8 1.8z"/></g>',
    "wave": '<g stroke-width="1.5" stroke-linecap="round"><path d="M2 6.5v3M5 4v8M8 2.5v11M11 5v6M14 6.5v3"/></g>',
    "pin": '<g stroke-width="1.4"><path d="M8 14.4s4.8-4.3 4.8-8a4.8 4.8 0 1 0-9.6 0c0 3.7 4.8 8 4.8 8z"/><circle cx="8" cy="6.4" r="1.7"/></g>',
    "card": '<g stroke-width="1.3" stroke-linejoin="round"><rect x="1.8" y="3.2" width="12.4" height="9.6" rx="2"/><circle cx="5.6" cy="7.2" r="1.3"/><path d="M3.8 10.6c.4-1 1-1.5 1.8-1.5s1.4.5 1.8 1.5M9.4 6.6h3M9.4 9.2h3" stroke-linecap="round"/></g>',
}


def sprite_html() -> str:
    grad = ('<linearGradient id="tg" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">'
            '<stop offset="0" style="stop-color:var(--indigo)"/><stop offset="1" style="stop-color:var(--teal)"/></linearGradient>')
    syms = "".join(f'<symbol id="g-{k}" viewBox="0 0 24 24"><path d="{v}" fill="none" stroke="url(#tg)" stroke-width="1.6" '
                   f'stroke-linecap="round" stroke-linejoin="round"/></symbol>' for k, v in GLYPHS.items())
    syms += "".join(f'<symbol id="u-{k}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
                    f'stroke-linecap="round" stroke-linejoin="round">{v}</symbol>' for k, v in UI_GLYPHS.items())
    syms += "".join(f'<symbol id="w-{k}" viewBox="0 0 16 16" fill="none" stroke="currentColor">{v}</symbol>'
                    for k, v in W_GLYPHS.items())
    return f'<svg class="sprite" width="0" height="0" aria-hidden="true" focusable="false"><defs>{grad}{syms}</defs></svg>'


FAVICON = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>'
    '<linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#171a2b"/><stop offset="1" stop-color="#08090c"/></linearGradient>'
    '<linearGradient id="r" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9095ff"/><stop offset="1" stop-color="#4fe0c8"/></linearGradient>'
    '</defs><rect width="64" height="64" rx="15" fill="url(#b)"/>'
    '<ellipse cx="32" cy="33" rx="25" ry="9.5" fill="none" stroke="url(#r)" stroke-width="2.2" transform="rotate(-9 32 33)"/>'
    '<circle cx="32" cy="33" r="9.5" fill="#191c25" stroke="url(#r)" stroke-width="1.8"/>'
    '<circle cx="11.5" cy="29" r="3.6" fill="#9095ff"/></svg>')


# Dusk themes for the guestbook (giscus), published next to index.html and passed to giscus by
# absolute URL. Each starts from giscus's own theme and overrides its --color-* variables with
# the Dusk tokens. If a custom theme ever fails to load, the built-in fallbacks are
# "transparent_dark" (dark page) and "light" (light page).
GISCUS_TOKENS = {
    "dark": dict(base="transparent_dark", fg="#f7f8f8", fg2="#a4a9b3", fg3="#80858f", canvas="transparent", overlay="#0f1116",
                 inset="#08090c", subtle="#0f1116", border="rgb(255 255 255 / 13%)", muted="rgb(255 255 255 / 8%)",
                 neutral="rgb(255 255 255 / 10%)", accent="#9095ff", accentEm="#5d61e8", accentMuted="rgb(144 149 255 / 40%)",
                 accentSubtle="rgb(144 149 255 / 12%)", success="#4fe0c8", btnBg="rgb(255 255 255 / 4%)",
                 btnHover="rgb(255 255 255 / 8%)", btnText="#f7f8f8", primary="#5458e0", primaryHover="#5d61e8",
                 danger="#ff8d9b", attention="#f2b65a", segBg="rgb(255 255 255 / 4%)", segBtn="#0f1116"),
    "light": dict(base="light", fg="#0b0c0e", fg2="#555a64", fg3="#6a6f79", canvas="#fbfbfc", overlay="#ffffff",
                  inset="#f3f4f7", subtle="#f6f7f9", border="rgb(10 12 20 / 14%)", muted="rgb(10 12 20 / 9%)",
                  neutral="rgb(10 12 20 / 6%)", accent="#4347c9", accentEm="#5458e0", accentMuted="rgb(84 88 224 / 38%)",
                  accentSubtle="rgb(84 88 224 / 9%)", success="#0f766e", btnBg="#ffffff",
                  btnHover="#f3f4f7", btnText="#0b0c0e", primary="#5458e0", primaryHover="#4b4fd8",
                  danger="#b4233a", attention="#8a5200", segBg="rgb(10 12 20 / 4%)", segBtn="#ffffff"),
}


def giscus_css(mode: str) -> str:
    t = GISCUS_TOKENS[mode]
    v = {
        "fg-default": t["fg"], "fg-muted": t["fg2"], "fg-subtle": t["fg3"],
        "canvas-default": t["canvas"], "canvas-overlay": t["overlay"], "canvas-inset": t["inset"], "canvas-subtle": t["subtle"],
        "border-default": t["border"], "border-muted": t["muted"], "neutral-muted": t["neutral"],
        "accent-fg": t["accent"], "accent-emphasis": t["accentEm"], "accent-muted": t["accentMuted"], "accent-subtle": t["accentSubtle"],
        "success-fg": t["success"], "attention-fg": t["attention"], "danger-fg": t["danger"],
        "btn-text": t["btnText"], "btn-bg": t["btnBg"], "btn-border": t["border"], "btn-hover-bg": t["btnHover"],
        "btn-hover-border": t["border"], "btn-active-bg": t["btnHover"], "btn-active-border": t["border"], "btn-selected-bg": t["btnHover"],
        "btn-shadow": "0 0 transparent", "btn-inset-shadow": "0 0 transparent",
        "btn-primary-text": "#ffffff", "btn-primary-bg": t["primary"], "btn-primary-border": "rgb(84 88 224 / 55%)",
        "btn-primary-hover-bg": t["primaryHover"], "btn-primary-hover-border": "rgb(84 88 224 / 70%)",
        "btn-primary-selected-bg": t["primary"], "btn-primary-shadow": "0 0 transparent", "btn-primary-inset-shadow": "0 0 transparent",
        "btn-primary-disabled-text": "rgb(255 255 255 / 70%)", "btn-primary-disabled-bg": "rgb(84 88 224 / 55%)",
        "btn-primary-disabled-border": "rgb(84 88 224 / 30%)",
        "segmented-control-bg": t["segBg"], "segmented-control-button-bg": t["segBtn"],
        "segmented-control-button-selected-border": t["border"],
        "action-list-item-default-hover-bg": t["btnHover"],
        "social-reaction-bg-hover": t["btnHover"], "social-reaction-bg-reacted-hover": t["accentSubtle"],
    }
    body = "\n".join(f"  --color-{k}: {val};" for k, val in v.items())
    return (f"/* Dusk Tech theme for the giscus guestbook on glacieerr.github.io ({mode} page).\n"
            f"   Built by pages/build.py; edit GISCUS_TOKENS there, not this file.\n"
            f"   Built-in fallback if this file cannot be used: \"{t['base']}\". */\n"
            f'@import url("https://giscus.app/themes/{t["base"]}.css");\n\n'
            f"main {{\n{body}\n}}\n\n"
            "main .gsc-comment-box, main .gsc-comment > div, main .gsc-reply-box {\n  border-radius: 14px;\n}\n")


def vcard(facts) -> str:
    """The contact card behind "Add to Contacts" (vCard 3.0, CRLF line ends)."""
    lk = facts["links"]
    first, last = facts["name"].split(" ", 1) if " " in facts["name"] else (facts["name"], "")
    city, _, region = facts["city"].partition(", ")
    lines = [
        "BEGIN:VCARD", "VERSION:3.0",
        f"N:{last};{first};;;", f"FN:{facts['name']}", f"NICKNAME:{facts['name_zh']}",
        f"EMAIL;TYPE=INTERNET:{lk['email']}",
        f"URL:{lk['site']}",
        f"X-SOCIALPROFILE;TYPE=linkedin:{lk['linkedin']}",
        f"ADR;TYPE=HOME:;;;{city};{region};;",
        "END:VCARD",
    ]
    return "\r\n".join(lines) + "\r\n"


# --------------------------------------------------------------------------- R3.3 batch 2: worked out at build time
def warn(msg: str) -> None:
    print(f"build.py: warning: {msg}", file=sys.stderr)


def node_run(args: list[str], timeout: int = 90):
    """Run Node in the repository (the QR code, the check against JPL, the share card's planets).
    None when Node is not installed."""
    node = shutil.which("node")
    if not node:
        return None
    return subprocess.run([node, *args], cwd=ROOT, capture_output=True, text=True, timeout=timeout)


def node_json(code: str, *argv: str):
    r = node_run(["--input-type=module", "-e", code, *argv])
    if r is None:
        raise SystemExit("build.py: needs Node (the QR code comes from live/qr.mjs)")
    if r.returncode != 0:
        raise SystemExit(f"build.py: node failed: {r.stderr.strip()[:400]}")
    return json.loads(r.stdout)


def qr_payload(url: str) -> dict:
    """#120: the page's address as a QR code (live/qr.mjs, error correction M, a quiet zone of 4
    modules), drawn as one SVG path. Only the address, so it scans easily."""
    q = node_json("import { qrEncode, qrPath } from './live/qr.mjs';"
                  "const q = qrEncode(process.argv[1]);"
                  "console.log(JSON.stringify({ size: q.size, version: q.version, path: qrPath(q, 4) }));", url)
    return {"url": url, "n": q["size"] + 8, "version": q["version"], "path": q["path"]}


CHECK_LINE = re.compile(r"^(ok |BAD)\s+(.+?)\s+max ([\d.]+)( ?°| km| min| h)\s+\(limit ([\d.]+)", re.M)


def astro_payload() -> dict | None:
    """#115: the comparison with JPL Horizons, exactly as `node scripts/check_astro.mjs` prints it,
    grouped for the About panel. None (and a warning) if it cannot run: the panel then leaves the
    table out rather than show numbers nobody worked out."""
    r = node_run(["scripts/check_astro.mjs"])
    if r is None:
        warn("Node is missing, so the About panel leaves out the check against JPL")
        return None
    rows = [(m.group(1).strip() == "ok", m.group(2).strip(), float(m.group(3)), float(m.group(5))) for m in CHECK_LINE.finditer(r.stdout)]
    if not rows:
        warn("scripts/check_astro.mjs printed no results; the About panel leaves the table out")
        return None

    def worst(pred):
        hit = [x for x in rows if pred(x[1])]
        return {"err": max(x[2] for x in hit), "limit": max(x[3] for x in hit), "ok": all(x[0] for x in hit), "n": len(hit)} if hit else None
    helio = lambda name: lambda s: s.startswith("heliocentric longitude") and s.endswith(name)  # noqa: E731
    ref = json.loads((ROOT / "scripts" / "astro-reference.json").read_text(encoding="utf-8"))
    fetched = re.search(r"(\d{4}-\d{2}-\d{2})", ref.get("source", ""))
    years = [d[:4] for d in ref.get("dates", [])]
    out = {
        "rows": {
            "planets": worst(lambda s: s.startswith("heliocentric longitude") and not re.search(r"jupiter|saturn", s)),
            "jupiter": worst(helio("jupiter")),
            "saturn": worst(helio("saturn")),
            "sun": worst(lambda s: s.startswith("Sun longitude")),
            "moon": worst(lambda s: s.startswith("Moon longitude")),
            "altaz": worst(lambda s: s.startswith("altitude/azimuth") and not s.endswith("moon")),
            "altazMoon": worst(lambda s: s.startswith("altitude/azimuth") and s.endswith("moon")),
            "riseSet": worst(lambda s: s.startswith("rise/set")),
            "phases": worst(lambda s: s.startswith("new/full Moon")),
        },
        "n": len(rows),
        "passed": sum(1 for x in rows if x[0]),
        "ok": r.returncode == 0,
        "fetched": fetched.group(1) if fetched else "",
        "from": years[0] if years else "",
        "to": years[-1] if years else "",
        "dates": len(years),
    }
    if any(v is None for v in out["rows"].values()):
        warn("scripts/check_astro.mjs no longer prints every row the About panel shows; some are left out")
        out["rows"] = {k: v for k, v in out["rows"].items() if v}
    return out


def last_run() -> dict | None:
    """How many browser checks passed in the last full run of pages/tests/test.mjs (it writes
    pages/tests/last-run.json only when nothing failed)."""
    if not LAST_RUN.exists():
        warn(f"{LAST_RUN.relative_to(ROOT)} is missing, so the About panel leaves out the number of checks")
        return None
    try:
        d = json.loads(LAST_RUN.read_text(encoding="utf-8"))
    except ValueError:
        return None
    if not (isinstance(d.get("passed"), int) and d.get("failed") == 0 and re.match(r"^\d{4}-\d{2}-\d{2}$", str(d.get("date", "")))):
        return None
    return {"passed": d["passed"], "date": d["date"]}


def albany_today(tz: str) -> str:
    try:
        from zoneinfo import ZoneInfo
        return dt.datetime.now(ZoneInfo(tz)).date().isoformat()
    except Exception:  # no time zone data on this machine: the UTC date
        return dt.datetime.now(dt.timezone.utc).date().isoformat()


def is_pending(profile: dict, key: str) -> bool:
    return key in (profile.get("pending") or [])


def https_url(u) -> str:
    u = str(u or "").strip()
    return u if re.match(r"^https://[^\s\"'<>]+$", u) else ""


def booking_payload(profile: dict, preview: bool):
    """#160: the "Book a time" button appears once booking.url is set; the reply-time line, under
    Contact's "Say hi", once the user has confirmed it (booking.reply_* are not in "pending"; they
    were confirmed on 2026-11-15). A preview also shows the button without a link, and a reply
    still in "pending", each labelled."""
    b = profile.get("booking") or {}
    url = https_url(b.get("url"))
    if b.get("url") and not url:
        warn("booking.url is not an https:// address; the button stays hidden")
    draft = is_pending(profile, "booking.reply_en") or is_pending(profile, "booking.reply_zh")
    reply = {"en": b.get("reply_en", ""), "zh": b.get("reply_zh", "")} if b.get("reply_en") and b.get("reply_zh") and (preview or not draft) else None
    if reply and not (page_safe(reply["en"]) and page_safe(reply["zh"])):
        warn("booking.reply_* say something the page leaves out; the reply line is not shown")
        reply = None
    if not url and not reply and not preview:
        return None
    return {"url": url, "button": bool(url or preview), "reply": reply, "replyDraft": bool(reply and draft)}


TESTIMONIAL_ROLES = ("visitor", "client", "viewer", "collaborator")


def testimonials_payload(profile: dict, preview: bool):
    """#161: testimonials people left through the form, agreed to publish, and the user approved.
    Each item in profile.json testimonials.items is {"text", "name", "role" (visitor, client,
    viewer or collaborator), optional "link" (https), optional "lang" (en or zh, the language it
    was written in)}; the words are shown as written. The invite needs testimonials.form_url."""
    t = profile.get("testimonials") or {}
    form = https_url(t.get("form_url"))
    items = []
    for it in t.get("items") or []:
        if not (isinstance(it, dict) and str(it.get("text", "")).strip() and str(it.get("name", "")).strip() and it.get("role") in TESTIMONIAL_ROLES):
            warn(f"testimonial left out (it needs text, name and a role from {TESTIMONIAL_ROLES}): {it!r:.80}")
            continue
        items.append({"text": it["text"].strip(), "name": it["name"].strip(), "role": it["role"], "link": https_url(it.get("link")),
                      "lang": it.get("lang") if it.get("lang") in ("en", "zh") else ""})
    if not form and not items and not preview:
        return None
    return {"form": form, "items": items}


def uses_payload(profile: dict, preview: bool):
    """#153: what I use, from profile.json "uses" (confirmed by the user on 2026-11-15; while
    "uses" is in "pending" only a preview shows it, labelled). An item the page may not show
    (page_safe()) is left out, with a warning; "Android Studio" may be shown (the user's call,
    2026-11-15)."""
    u = profile.get("uses") or {}
    groups = []
    for g in u.get("groups") or []:
        items = [str(x) for x in g.get("items") or []]
        left_out = [x for x in items if not page_safe(x)]
        if left_out:
            warn(f"uses.{g.get('key')}: {', '.join(left_out)} left out (a name the page does not show)")
        items = [x for x in items if page_safe(x)]
        if items:
            groups.append({"key": g["key"], "en": g["en"], "zh": g["zh"], "items": items})
    if not groups or (is_pending(profile, "uses") and not preview):
        return None
    return {"draft": is_pending(profile, "uses"), "groups": groups}


def release_notes_payload(store: dict):
    """#171: the release notes of SilNest's latest version, as the App Store lists them (the
    nightly fetch keeps them in silnest-store.json). None when there are none (version 1.0 has
    none). Dashes become hyphens (the page has no em or en dashes); notes that name a phone system
    other than as the page allows are left out with a warning."""
    rn = store.get("releaseNotes") or {}
    text = str(rn.get("text") or "").strip()
    if not text:
        return None
    text = text.replace("—", "-").replace("–", "-").replace("\r\n", "\n")
    if re.search(r"\biOS\b(?! \d)", text) or names_android(text) or "9:41" in text:
        warn("SilNest's release notes name something the page leaves out; they are not shown")
        return None
    date = str(rn.get("date") or "")
    return {"version": str(rn.get("version") or store.get("version") or ""), "date": date if re.match(r"^\d{4}-\d{2}-\d{2}$", date) else "", "text": text}


# --------------------------------------------------------------------------- R3.3 batch 3: the work and recruiters
ANDROID_OK = "Android Studio"


def names_android(text) -> bool:
    """Whether a string names Android other than as the tool "Android Studio" in Uses (#153; the
    user chose to list it on 2026-11-15). SilNest's Android version is not released, so the site
    never names the phone system itself (docs/copy-style.md)."""
    return bool(re.search(r"android", str(text or "").replace(ANDROID_OK, ""), re.I))


def page_safe(text) -> bool:
    """Whether a string from the data files may go on the page as it is: no em or en dash, no
    "9:41", Apple's phone system only as "<that word> 17.0 or later", and Android only in the
    tool name "Android Studio"."""
    s = str(text or "")
    return not ("—" in s or "–" in s or "9:41" in s or re.search(r"\biOS\b(?! \d)", s) or names_android(s))


def bilingual(items: list, fields: tuple, what: str) -> list:
    """Items from profile.json that carry each field in English and Chinese (q_en / q_zh ...), as
    {field: {"en", "zh"}}; one that misses a language or says what the page may not is left out."""
    out = []
    for it in items or []:
        row = {}
        for f in fields:
            en, zh = str(it.get(f"{f}_en", "")).strip(), str(it.get(f"{f}_zh", "")).strip()
            if not en or not zh or not page_safe(en) or not page_safe(zh):
                warn(f"{what} left out (missing a language, or wording the page leaves out): {it!r:.90}")
                row = None
                break
            row[f] = {"en": en, "zh": zh}
        if row:
            out.append(row)
    return out


def roles_payload(profile: dict) -> dict:
    """#157: one line per project page on who did what, from profile.json "roles"."""
    out = {}
    for key, r in (profile.get("roles") or {}).items():
        en, zh = str(r.get("en", "")).strip(), str(r.get("zh", "")).strip()
        if not en or not zh:
            continue
        if not page_safe(en) or not page_safe(zh):
            warn(f"roles.{key} names something the page leaves out (\"iOS\" is shown only as \"iOS 17.0 or later\"); "
                 "the line is not shown until profile.json words it another way")
            continue
        out[key] = {"en": en, "zh": zh}
    return out


def timeline_payload(profile: dict) -> list:
    """#111: when each project started (and ended), as months; oldest first."""
    rows = []
    for t in profile.get("timeline") or []:
        if re.match(r"^\d{4}-\d{2}$", str(t.get("from", ""))) and (not t.get("to") or re.match(r"^\d{4}-\d{2}$", str(t["to"]))):
            rows.append({"project": t["project"], "from": t["from"], **({"to": t["to"]} if t.get("to") else {})})
    return sorted(rows, key=lambda r: r["from"])


def skills_payload(profile: dict) -> list:
    """#110: each skill, its lane and the projects it was used in (the brightness is the count)."""
    return [{"lane": s["lane"], "skill": s["skill"], "projects": list(s.get("projects") or [])}
            for s in profile.get("skills_map") or [] if s.get("lane") and s.get("skill") and s.get("projects") and page_safe(s["skill"])]


def topics_payload(profile: dict) -> list:
    """#113: the three "Ask me about" topics, each with the project it leads to."""
    return [{"en": t["en"], "zh": t["zh"], "project": t.get("project", "how")}
            for t in profile.get("topics") or [] if t.get("en") and t.get("zh") and page_safe(t["en"]) and page_safe(t["zh"])]


def numbers_payload(profile: dict, store: dict, nums: dict, tz: str) -> dict:
    """#158: the numbers each project page lists, only ones read automatically and checkable:
    Storewright's from its repository (data/project-numbers.json, scripts/project_numbers.mjs),
    SilNest's from the App Store (data/silnest-store.json). No numbers from private repositories."""
    out = {}
    sw = nums.get("storewright") or {}
    if isinstance(sw.get("commits"), int) and isinstance(sw.get("tests"), int):
        at = ""
        try:
            from zoneinfo import ZoneInfo
            at = dt.datetime.fromisoformat(str(nums.get("generatedAt", "")).replace("Z", "+00:00")).astimezone(ZoneInfo(tz)).date().isoformat()
        except Exception:  # no date or no time zone data: leave the date out
            at = ""
        parts = sw.get("testsByPart") or {}
        out["storewright"] = {
            "commits": sw["commits"], "first": sw.get("firstCommit", ""), "last": sw.get("lastCommit", ""), "tests": sw["tests"],
            "files": sw.get("testFiles"), "head": sw.get("head", ""), "at": at,
            "parts": [[k, parts[k]] for k in ("storewright", "storex", "storexChain", "libraries") if isinstance(parts.get(k), int)],
        }
        if sum(v for _k, v in out["storewright"]["parts"]) != sw["tests"]:
            warn("project-numbers.json: the tests by part do not add up to the total; the parts are left out")
            out["storewright"]["parts"] = []
    started = next((t["from"] for t in profile.get("timeline") or [] if t.get("project") == "silnest"), "")
    sn = profile["silnest"]
    out["silnest"] = {"version": store.get("version") or sn["version"], "released": store.get("released") or sn["released"], "started": started}
    return out


def resumes_payload() -> list:
    """#66: the public resumes that are there (pages/src/resume/), with their size."""
    out = []
    for key, name in RESUMES:
        f = RESUME_DIR / name
        if not f.exists():
            warn(f"pages/src/resume/{name} is missing; its link is left out")
            continue
        out.append({"key": key, "file": name, "kb": round(f.stat().st_size / 1024)})
    return out


def check_resumes() -> list[str]:
    """Each public resume is a PDF of reasonable size (they are made without a phone number by
    _source/build.sh public, which checks that itself)."""
    problems = []
    for _key, name in RESUMES:
        f = RESUME_DIR / name
        if f.exists() and (f.read_bytes()[:5] != b"%PDF-" or f.stat().st_size > 1_000_000):
            problems.append(f"pages/src/resume/{name} is not a PDF under 1 MB")
    return problems


def game_payload():
    """#121: Storewright's small store for the pick game (without the checked lists, which only
    the tests read)."""
    if not SW_GAME.exists():
        warn(f"{SW_GAME.relative_to(ROOT)} is missing; the Storewright page leaves the pick game out")
        return None
    d = read_json(SW_GAME)
    return {k: d[k] for k in ("source", "nodes", "adj", "depot", "staging", "runs", "floor", "cats", "locs")}


def land_payload():
    """#142: the land for the day and night map, {"d": the path, "scale": 1/step}, from
    pages/src/land.txt (scripts/land_path.py). None, with a warning, if the file is missing or is
    not what that script writes; the map then shows the cities alone, as it did before."""
    if not LAND.exists():
        warn(f"{LAND.relative_to(ROOT)} is missing; the day and night map shows no land (run scripts/land_path.py)")
        return None
    lines = [x for x in LAND.read_text(encoding="utf-8").splitlines() if x.strip()]
    head = lines[0] if lines and lines[0].startswith("#") else ""
    d = next((x for x in lines if not x.startswith("#")), "")
    m = re.search(r"at scale 1/(\d+)", head)
    if not (m and "Natural Earth" in head and "public domain" in head and re.fullmatch(r"(?:M\d+ \d+l[\d -]+z)+", d)):
        warn(f"{LAND.relative_to(ROOT)} is not a land path from scripts/land_path.py; the day and night map shows no land")
        return None
    return {"d": d, "scale": 1 / int(m.group(1))}


# Node runs the bundle on its own, in a context with nothing but console, for the store-day
# card's seed: the numbers the card shows, and the knobs' defaults.
SIM_CHECK = """import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const ctx = vm.createContext({ console });
vm.runInContext(readFileSync(process.argv[1], 'utf8'), ctx);
const now = ctx.StorewrightSim.runDay({ seed: Number(process.argv[2]) });
console.log(JSON.stringify({ now, defaults: ctx.StorewrightSim.defaults() }));"""


def sim_payload(day: dict):
    """#169: the "What if…" lab runs Storewright's own simulation in the browser, from
    pages/src/storewright-sim.js. It belongs on the page only if it gives the store-day card's own
    numbers for the card's day, so the build runs it once with Node and compares the three numbers
    the lab stands on (orders fulfilled, the average pickup wait, ready on time); on a difference
    (a store day from another Storewright commit, say) the lab is left out with a warning.
    Returns (the lab's data, the bundle's text)."""
    if not SW_SIM.exists():
        warn(f"{SW_SIM.relative_to(ROOT)} is missing; the Storewright page leaves the What if lab out (scripts/bundle_storewright_sim.sh)")
        return None, ""
    head = {h.get("label"): h.get("value") for h in day.get("headline") or []}
    want = [head.get("Orders fulfilled"), head.get("Avg pickup wait"), head.get("Ready on time")]
    if not isinstance(day.get("seed"), int) or None in want:
        warn("data/store-day.json has no seed or no numbers; the What if lab is left out")
        return None, ""
    code = SW_SIM.read_text(encoding="utf-8").replace("\r\n", "\n")
    commit = re.search(r"storewright, commit ([0-9a-f]{7,40})", code[:1500])
    if "</script" in code.lower() or "<!--" in code or not commit:
        warn(f"{SW_SIM.relative_to(ROOT)} is not a bundle from scripts/bundle_storewright_sim.sh; the What if lab is left out")
        return None, ""
    r = node_run(["--input-type=module", "-e", SIM_CHECK, str(SW_SIM), str(day["seed"])], timeout=120)
    if r is None or r.returncode != 0:
        warn("the Storewright simulation did not run under Node; the What if lab is left out" + (f": {r.stderr.strip()[:300]}" if r else ""))
        return None, ""
    got = json.loads(r.stdout)
    now = got["now"]
    if [now["fulfilled"], now["waitMin"], now["onTime"]] != want:
        warn(f"the Storewright bundle (commit {commit.group(1)}) gives {now} for seed {day['seed']}, not the store-day card's "
             f"{want}; the What if lab is left out (bundle the commit that made data/store-day.json)")
        return None, ""
    return {"seed": day["seed"], "commit": commit.group(1), "defaults": got["defaults"]}, code


def jsonld(profile: dict, github: str) -> str:
    """#181: who this page is about, for search engines (schema.org Person). Only what the page
    already shows: no phone number, no street address."""
    lk = profile["links"]
    city, _, region = profile["city"].partition(", ")
    person = {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": profile["name"],
        "alternateName": profile["name_zh"],
        "url": lk["pages"],
        "sameAs": [lk["linkedin"], github, lk["site"]],
        "knowsAbout": profile["lanes"],
        "description": profile["subline"],
        "address": {"@type": "PostalAddress", "addressLocality": city, "addressRegion": region},
    }
    return json.dumps(person, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def share_meta(profile: dict, title: str, description: str) -> str:
    """#117 and #181: the share card (Open Graph, and the large-image card) and the author."""
    esc = lambda s: html.escape(s, quote=True)  # noqa: E731
    base = profile["links"]["pages"].rstrip("/")
    img = f"{base}/og-image.png"
    alt = (f'{profile["name"]} ({profile["name_zh"]}) in {profile["city"]}: {", ".join(profile["lanes"][:-1]).lower()} and '
           f'{profile["lanes"][-1].lower()}. My avatar as the sun, with the eight planets around it.')
    tags = [
        ("name", "author", profile["name"]),
        ("property", "og:type", "website"),
        ("property", "og:url", profile["links"]["pages"]),
        ("property", "og:site_name", title),
        ("property", "og:title", title),
        ("property", "og:description", description),
        ("property", "og:image", img),
        ("property", "og:image:type", "image/png"),
        ("property", "og:image:width", "1200"),
        ("property", "og:image:height", "630"),
        ("property", "og:image:alt", alt),
        ("property", "og:locale", "en_US"),
        ("property", "og:locale:alternate", "zh_CN"),
        ("name", "twitter:card", "summary_large_image"),
        ("name", "twitter:title", title),
        ("name", "twitter:description", description),
        ("name", "twitter:image", img),
        ("name", "twitter:image:alt", alt),
    ]
    return "\n".join(f'<meta {k}="{esc(n)}" content="{esc(v)}">' for k, n, v in tags)


def robots_txt(profile: dict) -> str:
    base = profile["links"]["pages"].rstrip("/")
    return ("# glacieerr.github.io: everything here may be indexed (#181)\n"
            "User-agent: *\nAllow: /\n\n"
            f"Sitemap: {base}/sitemap.xml\n")


def sitemap_xml(profile: dict, built: str) -> str:
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            f'  <url><loc>{html.escape(profile["links"]["pages"])}</loc><lastmod>{built}</lastmod></url>\n'
            '</urlset>\n')


def display_width(s: str) -> int:
    """Columns a terminal gives a string: Chinese characters take two."""
    return sum(0 if unicodedata.combining(ch) else 2 if unicodedata.east_asian_width(ch) in ("W", "F") else 1 for ch in s)


def card_text(profile: dict, github: str, colour: bool) -> str:
    """#149: a business card for a terminal (curl -sL glacieerr.github.io/card.txt), from
    profile.json. card.txt uses 256-colour codes and a rounded box; card-plain.txt is ASCII only,
    for terminals that show colour codes as text."""
    lk = profile["links"]
    esc_ = "\x1b["
    c = (lambda code, s: f"{esc_}{code}m{s}{esc_}0m") if colour else (lambda code, s: s)
    lane_colours = ("38;5;105", "38;5;141", "38;5;79")      # indigo, violet, teal
    dot = c("38;5;242", " · ") if colour else " / "
    rows = [
        ("", ""),
        (c("1;38;5;255", profile["name"]) + "  " + c("38;5;250", profile["name_zh"]), f'{profile["name"]}  {profile["name_zh"]}'),
        (dot.join(c(lc, ln) for lc, ln in zip(lane_colours, profile["lanes"])), " / ".join(profile["lanes"]) if not colour else " · ".join(profile["lanes"])),
        (c("38;5;246", profile["city"]), profile["city"]),
        ("", ""),
    ]
    for label, url in (("Site", lk["site"]), ("LinkedIn", lk["linkedin"]), ("GitHub", github), ("Email", lk["email"])):
        rows.append((c("38;5;244", f"{label:<10}") + c("38;5;253", url), f"{label:<10}{url}"))
    rows.append(("", ""))
    sky = ("·", "✦", "·", "◍", "·", "✧", "·") if colour else (".", "*", ".", "@", ".", "*", ".")
    art_plain = "      ".join(sky)
    art = "      ".join(c("38;5;141", s) if s in ("◍", "@") else c("38;5;240", s) for s in sky) if colour else art_plain
    rows += [(art, art_plain), ("", "")]
    inner = max(display_width(p) for _, p in rows) + 6
    if colour:
        h, v, tl, tr, bl, br = "─", "│", "╭", "╮", "╰", "╯"
    else:
        h, v, tl, tr, bl, br = "-", "|", "+", "+", "+", "+"
    edge = (lambda s: c("38;5;240", s)) if colour else (lambda s: s)
    out = [edge(tl + h * inner + tr)]
    for shown, plain in rows:
        out.append(edge(v) + "   " + shown + " " * (inner - 3 - display_width(plain)) + edge(v))
    out.append(edge(bl + h * inner + br))
    base = lk["pages"].replace("https://", "").rstrip("/")
    other = f"  Plain text: curl -sL {base}/card-plain.txt" if colour else f"  With color: curl -sL {base}/card.txt"
    out.append(c("38;5;244", other) if colour else other)
    return "\n".join(out) + "\n"


def page_404(profile: dict, favicon: str) -> str:
    """#116: "Lost in space", the page GitHub Pages shows for an address that does not exist.
    One small file, no script, nothing from the network, both languages; links go to the home
    page and to the projects (#59)."""
    name = html.escape(profile["name"])
    style = """
:root { --bg: #08090c; --bg2: #0f1116; --fg: #f7f8f8; --fg2: #a4a9b3; --fg3: #80858f; --line2: rgba(255,255,255,.13);
  --indigo: #9095ff; --ring: rgba(255,255,255,.3); --glow: #5a4cf2; --glowO: .42; --rockA: #d9d3c7; --rockB: #8c867b; --rockC: #3f3b35; color-scheme: dark; }
@media (prefers-color-scheme: light) { :root { --bg: #ffffff; --bg2: #fbfbfc; --fg: #0b0c0e; --fg2: #555a64; --fg3: #6a6f79; --line2: rgba(10,12,20,.14);
  --indigo: #5458e0; --ring: rgba(10,12,20,.3); --glow: #6366f1; --glowO: .22; --rockA: #b9b2a5; --rockB: #7d776c; --rockC: #45413a; color-scheme: light; } }
* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; background: var(--bg); color: var(--fg); }
body { font: 400 16px/1.55 -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
  -webkit-font-smoothing: antialiased; display: grid; place-items: center; min-height: 100vh; padding: 32px 16px; }
main { width: min(100%, 560px); text-align: center; }
.scene { display: block; width: min(100%, 420px); height: auto; margin: 0 auto 8px; overflow: visible; }
.glow-s { fill: var(--glow); opacity: var(--glowO); }
.ring { fill: none; stroke: var(--ring); stroke-width: 1; }
.trail { fill: none; stroke: var(--indigo); stroke-width: 1.2; stroke-dasharray: 2 5; stroke-linecap: round; opacity: .7; }
.star { fill: var(--fg3); }
.rock { fill: url(#rk); }
.s-a { stop-color: var(--rockA); } .s-b { stop-color: var(--rockB); } .s-c { stop-color: var(--rockC); }
.crater { fill: var(--rockC); opacity: .55; }
.code { margin: 0; font: 600 13px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; letter-spacing: .2em; color: var(--indigo); }
h1 { margin: 10px 0 0; font-size: clamp(30px, 7vw, 40px); line-height: 1.15; font-weight: 700; letter-spacing: -.025em; }
p { margin: 10px 0 0; color: var(--fg2); text-wrap: pretty; }
.zh { margin-top: 18px; font-size: 15px; }
.zh b { display: block; font-size: 20px; color: var(--fg); font-weight: 650; }
nav { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 26px; }
a { display: inline-flex; align-items: center; gap: .4em; min-height: 40px; padding: 0 18px; border-radius: 999px; font-size: 14.5px; font-weight: 600;
  color: var(--fg); text-decoration: none; box-shadow: inset 0 0 0 1px var(--line2); background: var(--bg2); }
a.primary { color: #fff; background: linear-gradient(180deg, #5d61e8, #4b4fd8); box-shadow: 0 0 0 1px rgba(84,88,224,.55), 0 6px 18px -8px rgba(84,88,224,.7); }
a:focus-visible { outline: 2px solid var(--indigo); outline-offset: 2px; }
.foot { margin-top: 28px; font-size: 13px; color: var(--fg3); }
.drift { transform-box: fill-box; transform-origin: center; }
.spin { transform-box: fill-box; transform-origin: center; }
@media (prefers-reduced-motion: no-preference) {
  .drift { animation: drift 9s ease-in-out infinite alternate; }
  .spin { animation: spin 46s linear infinite; }
}
@keyframes drift { to { transform: translate(10px, -6px); } }
@keyframes spin { to { transform: rotate(360deg); } }
@media (forced-colors: active) { a { border: 1px solid CanvasText; } }
"""
    stars = "".join(f'<circle class="star" cx="{x}" cy="{y}" r="{r}"/>' for x, y, r in
                    ((22, 30, 1), (64, 150, .8), (98, 22, .7), (288, 160, 1), (300, 40, .8), (250, 182, .7), (140, 176, .9), (36, 96, .6)))
    scene = (
        '<svg class="scene" viewBox="0 0 320 200" aria-hidden="true" focusable="false"><defs>'
        '<radialGradient id="gl"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>'
        '<mask id="gm"><circle cx="150" cy="104" r="92" fill="url(#gl)"/></mask>'
        '<radialGradient id="rk" cx=".36" cy=".3" r=".8"><stop offset="0" class="s-a"/><stop offset=".62" class="s-b"/>'
        '<stop offset="1" class="s-c"/></radialGradient></defs>'
        '<rect class="glow-s" x="40" y="0" width="230" height="200" mask="url(#gm)"/>'
        f'{stars}'
        # the orbit it left: a ring with a gap, and a dotted trail out to the asteroid
        '<path class="ring" d="M263.9 80A118 34 -9 1 1 228.7 67.2"/>'
        '<path class="trail" d="M247 71C256 64 262 56 266 50"/>'
        '<g transform="translate(14 -10)"><g class="drift"><g class="spin">'
        '<path class="rock" d="M247 37c5-6 15-7 21-2 6 4 9 10 7 17-1 6-6 11-12 13-7 2-15 1-19-5-4-5-2-17 3-23z"/>'
        '<circle class="crater" cx="257" cy="45" r="3.1"/><circle class="crater" cx="265" cy="55" r="1.9"/><circle class="crater" cx="252" cy="56" r="1.4"/>'
        '</g></g></g></svg>')
    body = (
        f'<main>{scene}<p class="code">404</p><h1>Lost in space</h1>'
        '<p>This page drifted off its orbit. The address may be mistyped, or the page has moved.</p>'
        '<p class="zh" lang="zh-CN"><b>迷失在太空</b>这个页面偏离了轨道：地址可能输错了，或者页面已经搬走。</p>'
        '<nav aria-label="Ways back"><a class="primary" href="/">Back to the home page <span lang="zh-CN">· 回到主页</span></a>'
        '<a href="/#home">See the projects <span lang="zh-CN">· 看看项目</span></a></nav>'
        f'<p class="foot">{name} · {html.escape(profile["links"]["pages"].replace("https://", "").rstrip("/"))}</p></main>')
    csp = (f"default-src 'none'; style-src '{csp_hash(style)}'; img-src data:; base-uri 'none'; form-action 'none'")
    return ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            f'<meta http-equiv="Content-Security-Policy" content="{csp}">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
            f'<title>Lost in space · {name}</title>\n<meta name="robots" content="noindex">\n'
            '<meta name="color-scheme" content="dark light">\n'
            f'<link rel="icon" href="{favicon}">\n<style>{style}</style>\n</head>\n<body>\n{body}\n</body>\n</html>\n')


def csp_hash(text: str) -> str:
    """A Content Security Policy hash source for an inline script or style (its exact text)."""
    return "sha256-" + base64.b64encode(hashlib.sha256(text.encode("utf-8")).digest()).decode()


def chrome_bin() -> str | None:
    if os.environ.get("CHROME"):
        return os.environ["CHROME"]
    for b in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser"):
        p = shutil.which(b)
        if p:
            return p
    mac = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    return mac if Path(mac).exists() else None


def og_render(profile: dict, avatar: str, en: dict) -> bool:
    """#117: draw pages/src/og-image.png (1200 x 630): the lock screen's banner at share-card
    size, with the planets where they are now. Drawn by headless Chrome from the page's own
    stylesheet, so it matches the site; kept in pages/src/ and copied next to index.html by
    every build. Run again (--og) when the avatar or the name line changes."""
    chrome = chrome_bin()
    if not chrome:
        warn("no Chrome to draw og-image.png (set CHROME)")
        return False
    pos = node_json("import * as A from './live/astro.mjs';"
                    "const t = Date.now(); const m = A.moonPhase(t);"
                    f"console.log(JSON.stringify({{ theta: A.planetLongitudes(t), elong: m.elong, lit: A.moonPhasePath(0, 0, {MOON_R}, m.illum, m.waxing) || '' }}));")
    svg = orbit_markup(avatar, "og-")
    th = pos["theta"]
    for i, (rx, ry, _rot) in enumerate(ORBITS):
        a = math.radians(th[i])
        svg = svg.replace(f'data-o="{i}" data-planet="{PLANETS[i][0]}" transform="translate(0 {-ry})"',
                          f'data-o="{i}" data-planet="{PLANETS[i][0]}" transform="translate({rx * math.cos(a):.2f} {-ry * math.sin(a):.2f})"')
        svg = svg.replace(f'data-trail="{i}" style=', f'data-trail="{i}" transform="rotate({90 - th[i]:.2f})" style=')
    erx, ery = ORBITS[2][0], ORBITS[2][1]
    phi = math.radians(th[2] + 180 + pos["elong"])
    vx, vy = math.cos(phi), -(ery / erx) * math.sin(phi)
    ln = math.hypot(vx, vy) or 1
    svg = svg.replace('data-moon="" transform="translate(0 -9)"', f'data-moon="" transform="translate({vx / ln * 9:.2f} {vy / ln * 9:.2f})"')
    svg = svg.replace('class="moon-lit" d=""', f'class="moon-lit" d="{pos["lit"]}"')
    esc = lambda s: html.escape(s, quote=True)  # noqa: E731
    lanes = lanes_html(en["lanes"], esc)
    host = profile["links"]["pages"].replace("https://", "").rstrip("/")
    ol, ot, ow = 590, 150, 580          # where the orbit sits on the card, and how wide
    css = ((SRC / "style.css").read_text(encoding="utf-8") + "\n" + planets_css() + """
html, body { width: 1200px; height: 630px; overflow: hidden; }
.og { position: relative; width: 1200px; height: 630px; overflow: hidden; background: var(--bg); isolation: isolate; }
.og .wall { position: absolute; }
.og-txt { position: absolute; left: 76px; top: 0; bottom: 0; width: 560px; display: flex; flex-direction: column; justify-content: center; font-size: 22px; }
.og .status { align-self: flex-start; height: 34px; padding: 0 16px 0 13px; font-size: 16px; gap: 8px; }
.og .status .live { width: 8px; height: 8px; }
.og-name { margin-top: 30px; font-size: 62px; line-height: 1.05; font-weight: 700; letter-spacing: -.03em; color: var(--fg); }
.og-name .zh { display: block; margin-top: 10px; font-size: 40px; font-weight: 500; letter-spacing: 0; color: var(--fg2); }
.og-sub { margin-top: 22px; font-size: 23px; line-height: 1.45; font-weight: 500; color: var(--fg2); }
.og .orbit-wrap { position: absolute; left: %(L)spx; top: %(T)spx; width: %(W)spx; padding: 0; }
.og .orbit { width: %(W)spx; }
.og .lanes .lane { font-size: 15px; }
""" % {"L": ol, "T": ot, "W": ow})
    page = (f'<!doctype html><html lang="en" class="js" data-appearance="dark" data-lang="en"><head><meta charset="utf-8"><style>{css}</style></head><body>'
            # the glows centred on the orbit, as on the lock screen (the orbit's centre in card pixels)
            f'<div class="og"><div class="wall" style="--ox:{ol + ow * (CENTER[0] - STAGE[0]) / STAGE[2]:.0f}px;'
            f'--oy:{ot + ow * (CENTER[1] - STAGE[1]) / STAGE[2]:.0f}px;--k:{ow / STAGE[2]:.3f}"><div class="wall-move"><i class="glow g-a"></i><i class="glow g-b"></i><i class="glow g-c"></i></div><div class="wall-dots"></div></div>'
            f'<div class="og-txt"><p class="pill status"><i class="live"></i><span>{esc(host)}</span></p>'
            f'<h1 class="og-name">{esc(profile["name"])}<span class="zh" lang="zh-CN">{esc(profile["name_zh"])}</span></h1>'
            f'<p class="og-sub">{esc(profile["subline"])}</p></div>'
            f'<div class="orbit-wrap"><div class="orbit">{svg}<ul class="lanes">{lanes}</ul></div></div></div></body></html>')
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "og.html"
        src.write_text(page, encoding="utf-8")
        out = Path(tmp) / "og.png"
        subprocess.run([chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", "--no-first-run",
                        f"--user-data-dir={Path(tmp) / 'profile'}", "--window-size=1200,630", f"--screenshot={out}", src.as_uri()],
                       capture_output=True, timeout=120)
        if not out.exists() or out.read_bytes()[16:24] != (1200).to_bytes(4, "big") + (630).to_bytes(4, "big"):
            warn("Chrome did not draw a 1200 x 630 og-image.png")
            return False
        OG.write_bytes(out.read_bytes())
    print(f"drew {OG.relative_to(ROOT)} ({OG.stat().st_size / 1024:.0f} KB)")
    return True


# --------------------------------------------------------------------------- checks
def visible_text(page: str) -> str:
    """Text a visitor can see or hear: the page minus <script>, <style> and comments, plus
    every string in the inline copy (which the script puts on screen)."""
    body = re.sub(r"<script\b[^>]*>.*?</script>", " ", page, flags=re.S | re.I)
    body = re.sub(r"<style\b[^>]*>.*?</style>", " ", body, flags=re.S | re.I)
    body = re.sub(r"<!--.*?-->", " ", body, flags=re.S)
    m = re.search(r'<script type="application/json" id="data">(.*?)</script>', page, flags=re.S)
    strings = []
    if m:
        def walk(o):
            if isinstance(o, str):
                if not o.startswith("data:"):
                    strings.append(o)
            elif isinstance(o, list):
                for x in o:
                    walk(x)
            elif isinstance(o, dict):
                for x in o.values():
                    walk(x)
        walk(json.loads(m.group(1).replace("<\\/", "</")))
    return html.unescape(body) + "\n" + "\n".join(strings)


def check(page: str, facts: dict) -> list[str]:
    problems = []
    if "—" in page:
        problems.append("contains an em dash (U+2014)")
    if "–" in page:
        problems.append("contains an en dash (U+2013); use a hyphen or rephrase")
    if "9:41" in page:
        problems.append('contains "9:41"')
    if re.search(r"\biOS\b(?! \d)", page):
        problems.append('names Apple\'s phone system ("i" + "OS"); the brief keeps it out of the site')
    if names_android(page):
        problems.append('mentions Android (other than the tool "Android Studio" in Uses)')
    text = visible_text(page)
    for needle in ["apps.apple.com/app/id" + facts["silnest"]["app_id"], facts["links"]["linkedin"],
                   facts["links"]["email"], facts["links"]["site"], facts["storewright"]["demo"]]:
        if needle not in page:
            problems.append(f"lost a link: {needle}")
    for repo in EARLY:
        if f'"https://github.com/Glacieerr/{repo}"' not in page:
            problems.append(f"no link to the {repo} repo")
    if "Not Collected" not in text:
        problems.append("SilNest's privacy label is missing")
    # anything that would make the browser fetch something
    loaders = [
        (r'<(?:script|img|iframe|source|video|audio|embed|object)\b[^>]*\b(?:src|data|srcset)\s*=\s*["\']?(?:https?:)?//', "remote src"),
        (r'<link\b(?![^>]*rel="canonical")[^>]*href\s*=\s*["\']?(?:https?:)?//', "remote <link>"),
        (r'url\(\s*["\']?(?:https?:)?//', "remote url() in CSS"),
        (r'@import', "@import"),
        (r'\bfetch\s*\(|XMLHttpRequest|navigator\.sendBeacon|new\s+WebSocket|EventSource\s*\(|importScripts', "network API in script"),
    ]
    for pattern, what in loaders:
        if re.search(pattern, page, flags=re.I):
            problems.append(f"would load from the network: {what}")
    if re.search(r'href="http://', page):
        problems.append("has a plain http:// link")
    if len(page.encode("utf-8")) > MAX_BYTES:
        problems.append(f"is {len(page.encode('utf-8')) / 1e6:.2f} MB, over the 1.5 MB budget")
    csp_at = page.find('http-equiv="Content-Security-Policy"')
    if csp_at < 0 or csp_at > page.find("<script") or csp_at > page.find("<style"):
        problems.append("has no Content Security Policy ahead of its first script and stylesheet (#175)")
    return problems


# --------------------------------------------------------------------------- build
def parse_args(argv=None):
    ap = argparse.ArgumentParser(description="Build the interactive page into pages/dist/ (see the top of this file).")
    ap.add_argument("--preview", action="store_true", help="also show what is not set up yet, labelled; never publish this")
    ap.add_argument("--out", type=Path, help="write the page here instead (and none of the files beside it)")
    ap.add_argument("--store", type=Path, help="SilNest's App Store data (default: data/silnest-store.json)")
    ap.add_argument("--og", action="store_true", help="draw pages/src/og-image.png again with headless Chrome")
    ap.add_argument("--webp", action="store_true", help="re-encode the photos as WebP into pages/src/webp/ with headless Chrome (#180)")
    return ap.parse_args(argv)


def check_extra(name: str, text: str) -> list[str]:
    """The files beside the page follow its rules too: no dashes, no remote loads."""
    problems = []
    if "—" in text or "–" in text:
        problems.append(f"{name} contains an em or en dash")
    if re.search(r"\biOS\b(?! \d)", text) or names_android(text):
        problems.append(f"{name} names a phone system the site leaves out")
    if re.search(r'<(?:script|img|iframe|source|link)\b[^>]*\b(?:src|href)\s*=\s*["\']?(?:https?:)?//', text, flags=re.I) or "@import" in text:
        problems.append(f"{name} would load from the network")
    return problems


CSP_TOKEN = "<!--csp-->"


def content_security_policy(page: str) -> str:
    """#175: the page's Content Security Policy, as a <meta> tag (GitHub Pages sets no headers).
    Nothing may load from the network except giscus.app, which the guestbook adds after a click
    (its script and its frame). Each inline script and the two stylesheets (the page's, and the
    photos', last, #180) are allowed by the hash of their exact text, worked out here from the
    finished page, so editing them cannot slip past it; JSON blocks are not scripts and need none. Inline style attributes stay allowed (the page
    sets many as it draws: the orbit, the charts), images only from data: and blob: URLs (the
    pictures are inline; the wallpapers and the saved chart are made in the page). A meta policy
    cannot forbid framing or send reports; browsers without style-src-elem fall back to
    style-src."""
    scripts = re.findall(r"<script(?![^>]*\btype=\"application/(?:ld\+)?json\")[^>]*>(.*?)</script>", page, flags=re.S)
    styles = re.findall(r"<style[^>]*>(.*?)</style>", page, flags=re.S)
    # the boot script and the page script, and the What if lab's simulation (#169) when the page
    # has it: text until a visitor runs it, when the page puts it in a script of its own
    want = 3 if '<script type="text/plain" id="swSim">' in page else 2
    if len(scripts) != want or len(styles) != 2:
        raise SystemExit(f"build.py: expected {want} inline scripts and 2 stylesheets for the CSP, found {len(scripts)} and {len(styles)}")
    giscus = GISCUS["origin"]
    policy = [
        "default-src 'none'",
        "script-src " + " ".join(f"'{csp_hash(t)}'" for t in scripts) + f" {giscus}",
        "style-src 'unsafe-inline'",
        "style-src-elem " + " ".join(f"'{csp_hash(t)}'" for t in styles),
        "style-src-attr 'unsafe-inline'",
        "img-src data: blob:",
        f"frame-src {giscus}",
        "connect-src 'none'",
        "font-src 'none'",
        "media-src 'none'",
        "object-src 'none'",
        "manifest-src 'none'",
        "worker-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
    ]
    return f'<meta http-equiv="Content-Security-Policy" content="{"; ".join(policy)}">'


def settle_size(page: str) -> str:
    """#115: the About panel says how big the page is, which the number itself changes, so put it
    in until it stops changing (two rounds at most in practice)."""
    for _ in range(8):
        size = len(page.encode("utf-8"))
        nxt = re.sub(r'"pageBytes":\d+', f'"pageBytes":{size}', page, count=1)
        if nxt == page:
            return page
        page = nxt
    raise SystemExit("build.py: the page size did not settle")


def main(argv=None) -> int:
    args = parse_args(argv)
    preview = args.preview
    if args.webp and not webp_render():
        return 1
    profile = read_json(ROOT / "data" / "profile.json")
    day = read_json(ROOT / "data" / "store-day.json", default={})
    store = read_json(args.store or (ROOT / "data" / "silnest-store.json"), default={})
    nums = read_json(ROOT / "data" / "project-numbers.json", default={})

    theirs = lockscreen_orbits()
    if theirs and [tuple(o) for o in theirs] != [tuple(o) for o in ORBITS]:
        print(f"build.py: warning: scripts/lockscreen.py ORBITS is now {theirs}; the page still uses {ORBITS}",
              file=sys.stderr)
    tiers = lockscreen_constant("SUN_TIERS")
    if tiers and [tuple(t) for t in tiers] != [tuple(t) for t in SUN_TIERS]:
        warn(f"scripts/lockscreen.py SUN_TIERS is now {tiers}; the page still uses {SUN_TIERS}")

    sn = profile["silnest"]
    price = store.get("price")
    facts = {
        **profile,
        # SilNest as the App Store reports it (nightly), falling back to profile.json
        "sn": {
            "version": store.get("version") or sn["version"],
            "released": store.get("released") or sn["released"],
            "min_os": store.get("minimumOs") or "",
            "price_en": "Free" if price == 0 else (f"${price:.2f}" if price else ""),
            "price_zh": "免费" if price == 0 else (f"{price:.2f} 美元" if price else ""),
        },
        "day": day,
        "github": profile["storewright"]["repo"].rsplit("/", 1)[0],
    }
    copy = fill(prune(read_json(SRC / "copy.json"), facts), facts)

    # the pages of this build: the apps, the site's own pages, and Uses (#153; confirmed 2026-11-15)
    uses = uses_payload(profile, preview)
    apps = APPS + SITE_APPS + (("uses",) if uses else ())

    # the English and Chinese copy must have the same shape, so no string is missing in one
    missing = shape(copy["en"]) ^ shape(copy["zh"])
    if missing:
        raise SystemExit(f"copy.json: en and zh differ at {sorted(missing)[:8]}")
    for group in ("sheets", "notes", "early"):
        items = copy[group].items() if isinstance(copy[group], dict) else enumerate(copy[group])
        for key, item in items:
            if shape(item["en"]) ^ shape(item["zh"]):
                raise SystemExit(f"copy.json: {group} {key!r} differs between en and zh")
    for app in apps + ("guestbook", "uses"):
        if app not in copy["en"]["appNames"]:
            raise SystemExit(f"copy.json: no name for app {app!r}")
    repos = [e["repo"] for e in copy["early"]]
    if tuple(repos) != EARLY:
        raise SystemExit(f"copy.json: the Early work folder should hold {EARLY}, not {repos}")
    for e in copy["early"]:
        e["href"] = f'{facts["github"]}/{e["repo"]}'

    lk = profile["links"]
    built = albany_today(profile["timezone"])
    github = facts["github"]
    lab, sim_code = sim_payload(day)
    payload = {
        "tz": profile["timezone"],
        "orbits": [list(o) for o in ORBITS],
        "planetApps": [list(x) for x in PLANET_APPS],
        "moonR": MOON_R,
        "planetR": [pl[1] for pl in PLANETS],
        "planetColors": [pl[2] for pl in PLANETS],
        "periods": PERIODS,
        "center": list(CENTER),
        "secondsR": SECONDS_R,
        "themeColors": THEME_BG,
        "stage": list(STAGE),
        "apps": list(apps),
        "preview": preview,
        "copy": {"en": copy["en"], "zh": copy["zh"]},
        "sheets": copy["sheets"],
        "notes": copy["notes"],
        "early": copy["early"],
        "skills": copy["skills"],
        "day": {k: day[k] for k in ("date", "seed", "headline", "series", "synthetic") if k in day},
        "facts": {
            "name": profile["name"], "nameZh": profile["name_zh"], "city": profile["city"],
            "snVersion": facts["sn"]["version"], "snReleased": facts["sn"]["released"],
            "storeUrl": sn["store_url"], "sw": profile["storewright"], "assistant": profile["assistant"],
            "site": profile["site"], "links": lk, "github": github, "lanes": profile["lanes"],
        },
        "vcard": "data:text/vcard;charset=utf-8," + quote(vcard(profile)),
        "giscus": {**GISCUS, "themes": {m: f'{lk["pages"].rstrip("/")}/giscus-dusk-{m}.css' for m in ("dark", "light")}},
        "source": f'{github}/{github.rsplit("/", 1)[1]}.github.io',
        "profileRepo": f'{github}/{github.rsplit("/", 1)[1]}',
        # R3.3 batch 2
        "qr": qr_payload(lk["pages"]),
        "about": {"built": built, "pageBytes": 0, "checks": last_run(), "astro": astro_payload()},
        "drafts": [{"key": k, "date": d} for k, d in DRAFTS],
        "uses": uses,
        "booking": booking_payload(profile, preview),
        "testimonials": testimonials_payload(profile, preview),
        "releaseNotes": release_notes_payload(store),
        # R3.3 batch 3 (the user confirmed these on 2026-11-15)
        "sunTiers": [t[0] for t in SUN_TIERS[:-1]],
        "sunNames": list(SUN_NAMES),
        "faq": bilingual(profile.get("faq"), ("q", "a"), "a FAQ entry"),
        "roles": roles_payload(profile),
        "skillsMap": skills_payload(profile),
        "timeline": timeline_payload(profile),
        "topics": topics_payload(profile),
        "numbers": numbers_payload(profile, store, nums, profile["timezone"]),
        "resumes": resumes_payload(),
        "swGame": game_payload(),
        # #142 and #169
        "land": land_payload(),
        "swLab": lab,
    }
    data = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")

    en = copy["en"]
    title = f'{profile["name"]} {profile["name_zh"]}'
    description = (f'{profile["name"]} ({profile["name_zh"]}) in {profile["city"]}: '
                   f'{", ".join(profile["lanes"][:-1]).lower()} and {profile["lanes"][-1].lower()}. {profile["subline"]}')
    esc = lambda s: html.escape(s, quote=True)  # noqa: E731
    lanes = lanes_html(en["lanes"], esc)
    noscript_links = "".join(
        f'<li><a href="{esc(href)}">{esc(label)}</a></li>' for label, href in [
            ("SilNest on the App Store", sn["store_url"]),
            ("Storewright live demo", profile["storewright"]["demo"]),
            ("Storewright repo", profile["storewright"]["repo"]),
            (profile["site"]["domain"], lk["site"]),
            ("LinkedIn", lk["linkedin"]),
            (lk["email"], "mailto:" + lk["email"]),
            ("GitHub", github),
        ])
    script = modules_script() + "\n" + (SRC / "app.js").read_text(encoding="utf-8")
    pages_host = lk["pages"].replace("https://", "").rstrip("/")
    # #148: a word for whoever reads the source (an HTML comment: nothing a visitor sees)
    source_note = ("<!--\n"
                   f"  Hello, source reader. This page is one file that loads nothing from the network until you\n"
                   f"  open the guestbook. It is built by pages/build.py in {payload['profileRepo'].replace('https://', '')}\n"
                   f"  from data/*.json, live/*.mjs and pages/src/, and checked in headless Chrome before it goes up.\n"
                   f"  Leave me a note: {lk['pages']}#guestbook\n"
                   "-->")
    values = {
        "SOURCE_NOTE": source_note,
        "CSP": CSP_TOKEN,
        "TITLE": esc(title),
        "DESCRIPTION": esc(description),
        "CANONICAL": esc(lk["pages"]),
        "SHARE_META": share_meta(profile, title, description),
        "JSONLD": jsonld(profile, github),
        "THEME_COLOR": THEME_BG["dark"],
        "FAVICON": "data:image/svg+xml," + quote(FAVICON),
        "BOOT": (SRC / "boot.js").read_text(encoding="utf-8").strip(),
        "STYLE": (SRC / "style.css").read_text(encoding="utf-8"),
        "PLANETS_CSS": planets_css(),
        # #180: the photos come last, in a stylesheet of their own after the script: on a slow
        # network the page paints and the clock shows before the photos have arrived
        "PHOTOS_CSS": images_css(),
        # #169: the lab's simulation, last of all, as text (nothing runs it until a visitor asks)
        "SW_SIM": f'<script type="text/plain" id="swSim">{sim_code}</script>' if lab else "",
        "SPRITE": sprite_html(),
        "ORBIT": orbit_markup(data_uri("avatar.jpg")),
        "NAME": esc(profile["name"]),
        "NAME_ZH": esc(profile["name_zh"]),
        "CITY": esc(profile["city"]),
        "SUBLINE": esc(en["subline"]),
        "HELLO": esc(en["hello"]),
        "LANES": lanes,
        "LINKEDIN": esc(lk["linkedin"]),
        "SITE": esc(lk["site"]),
        "SITE_DOMAIN": esc(profile["site"]["domain"]),
        "EMAIL": esc(lk["email"]),
        "GITHUB": esc(github),
        "NOSCRIPT_LINKS": noscript_links,
        "DATA": data,
        "SCRIPT": script.replace("</script", "<\\/script"),
    }
    template = (SRC / "index.html").read_text(encoding="utf-8")
    missing = sorted(set(re.findall(r"\{\{([A-Z_]+)\}\}", template)) - set(values))
    if missing:
        raise SystemExit(f"index.html: no value for {missing}")
    page = re.sub(r"\{\{([A-Z_]+)\}\}", lambda m: values[m.group(1)], template)
    page = page.replace("\r\n", "\n").replace("\r", "\n")       # what the browser hashes
    page = page.replace(CSP_TOKEN, content_security_policy(page), 1)
    page = settle_size(page)

    problems = check(page, profile)
    favicon = "data:image/svg+xml," + quote(FAVICON)
    extras = {} if args.out else {
        "404.html": page_404(profile, favicon),
        "card.txt": card_text(profile, github, colour=True),
        "card-plain.txt": card_text(profile, github, colour=False),
        "robots.txt": robots_txt(profile),
        "sitemap.xml": sitemap_xml(profile, built),
    }
    for name, text in extras.items():
        problems += check_extra(name, text)
    problems += check_resumes()
    if problems:
        for p in problems:
            print("build.py: page " + p, file=sys.stderr)
        return 1
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(page, encoding="utf-8")
        print(f"wrote {args.out} ({len(page.encode('utf-8')) / 1024:.0f} KB{', preview' if preview else ''}; nothing beside it)")
        return 0
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(page, encoding="utf-8")
    for mode in ("dark", "light"):
        (OUT.parent / f"giscus-dusk-{mode}.css").write_text(giscus_css(mode), encoding="utf-8")
    for name, text in extras.items():
        (OUT.parent / name).write_text(text, encoding="utf-8")
    # #66: the public resumes, byte for byte
    copied = []
    for r in payload["resumes"]:
        shutil.copyfile(RESUME_DIR / r["file"], OUT.parent / r["file"])
        copied.append(r["file"])
    if args.og or not OG.exists():
        og_render(profile, data_uri("avatar.jpg"), en)
    if OG.exists():
        shutil.copyfile(OG, OUT.parent / "og-image.png")
    else:
        warn("pages/src/og-image.png is missing; the share card points at a file that is not there (run with --og)")
    size = len(page.encode("utf-8"))
    print(f"wrote {OUT.relative_to(ROOT)} ({size / 1024:.0f} KB; {len(apps)} apps, {len(copy['notes'])} notifications, "
          f"{len(EARLY)} early projects, store day {day.get('date', 'none')}{', PREVIEW: do not publish' if preview else ''}) "
          f"and beside it {', '.join(['giscus themes', *extras, 'og-image.png', *copied])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
