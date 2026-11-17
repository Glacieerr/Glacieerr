# How this profile works

The README opens with a banner: a live clock for Albany, NY with the date above it, my name,
and on the right a small solar system: my avatar as the sun, eight planets from Mercury to
Neptune on thin rings, the Moon beside Earth, and a dot around the avatar that ticks the
seconds. Under it a row of widgets scrolls sideways, one of them tonight's sky over Albany. The look is "Dusk Tech": a near-black page with a faint dot
grid and soft indigo, violet and teal glows, or its own white version on light pages.
Everything here is generated; edit `data/profile.json` or the scripts, not the SVG files.
I built this profile with Claude Code, the way I build everything: I decide what to build and how
we'll know it works, Claude Code writes most of the code, and I review every change and accept it
through tests and walkthroughs.

## Pieces

| Piece | What it does |
|---|---|
| `data/profile.json` | Every fact the profile shows, in one place |
| `scripts/lockscreen.py` | Draws the banner, the widgets, the unlock pill, the app tiles, the milestone cards, the skill map, the timeline, the contact badges and the small print as SVG (Python standard library only) |
| `scripts/store_day.mjs` | Runs one simulated day of [Storewright](https://github.com/Glacieerr/storewright) with the date as the random seed, so a given day always gives the same numbers. All data is synthetic |
| `scripts/fetch_data.py` | Reads SilNest's current version, its dates and the latest release notes from Apple's public lookup API |
| `scripts/project_numbers.mjs` | Counts Storewright's commits and unit tests and reads its dates and releases from a checkout, into `data/project-numbers.json` (for the project pages) |
| `scripts/make_holidays.mjs` | Works out the Spring Festival and Mid-Autumn dates to 2035, checks them against published tables and writes `scripts/festivals.py` and `live/holidays.mjs` |
| `scripts/sky_day.mjs` | Works out where the planets are, the Moon's phase and tonight's sky over Albany, offline, into `data/sky-day.json` |
| `live/astro.mjs` | The astronomy behind it (also used by the live function and the interactive page) |
| `scripts/make_readme.py` | Writes `README.md` |
| `.github/workflows/daily.yml` | Every night: simulate the day, count Storewright's numbers, check the App Store, work out the sky, redraw, check the images, publish to the `output` branch |
| `.github/workflows/monthly.yml` | Once a month: check every outside link, and keep the nightly schedule switched on |
| `.github/workflows/pages.yml` | On every change to the interactive page: build it and run all its checks in headless Chrome. The Glacieerr.github.io repository publishes it (see The interactive version) |
| `scripts/collect_site.sh` | Gathers the built page and the files next to it into one folder, which Glacieerr.github.io publishes |
| `scripts/self_check.py`, `link_check.py`, `keepalive.py`, `gh_issue.py`, `net.py` | The checks behind those workflows, and the issue they open when something breaks |
| `scripts/sky_ics.mjs` | Writes the next 12 months of sky events (Moon phases, equinoxes and solstices, meteor shower peaks, eclipses) as calendar files, the same file the interactive page's download button makes |
| `scripts/fact_check.py`, `data/facts.json` | Checks every number, date and name the README, the interactive page, the resumes and the drafts use against the facts list, and the banned phrases (a date inside a "source" string says when a fact was stated, so it is not checked as a project date). My phone numbers are not in this repository: the check reads them from `data/private.json`, which is gitignored and exists only on my Mac, and a public file may contain no phone number at all |
| `scripts/land_path.py` | Turns Natural Earth's 1:110m land layer (public domain, downloaded once by hand and not kept here) into the one SVG path the day and night map draws, `pages/src/land.txt` |
| `scripts/bundle_storewright_sim.sh`, `scripts/storewright_sim_entry.mjs` | Bundle Storewright's store-day simulation, with the checkout's own esbuild, into `pages/src/storewright-sim.js` for the What if lab (run by hand when the page should follow a newer Storewright commit; never in CI; AGPL-3.0, like Storewright) |
| `scripts/copy_check.py`, `docs/copy-style.md` | The English style guide and its check: US spelling, consistent names, no long dashes in what visitors read |
| `scripts/time_tests.mjs` | Daylight-saving changes, a leap day and the turn of the year, for the clock, the festivals and tonight's sky |
| `.github/workflows/xbrowser.yml`, `tests-xbrowser/` | A short smoke test of the interactive page in Chromium, Firefox and WebKit on Linux, macOS and Windows |
| `live/holidays.mjs`, `live/qr.mjs` | The festival dates to 2035, and a small QR encoder (the contact page's code), shared by the README and the interactive page |
| `api/lockscreen.js` | A Vercel function that draws the banner with the current time on every request |
| `live/lockscreen-core.mjs` | The clock logic shared by the function and the interactive page |
| `live/templates.json`, `live/templates.mjs` | The banner templates the function fills in (written by `lockscreen.py templates`) |
| `assets/store.stl` | A 3D model of the simulated store, which GitHub shows as a rotatable viewer |
| `assets/src/` | Photos the widgets embed, and the Storewright still that the README shows until the demo video is uploaded |

## Dark and light

Every image comes in two page modes. The README's `<picture>` elements pick by the visitor's
GitHub theme: dark art on dark pages, light art on light pages. The light mode is its own
white design (its own grays, ink and softer glows), not the dark one inverted. The widgets,
the unlock pill and the tiles are cards on a transparent canvas, so GitHub's own page color
shows around them.

| File | What it is |
|---|---|
| `banner-<page>-<layout>-<weight>-daily.svg` | The banner without a server: the date is the hero. Layout `below` (widgets in the README row), `right` (the widgets turn inside the banner) or `portrait` (600 x 760, for phones); weight `bold` or `thin` |
| `w-<widget>-<page>.svg` | One widget, for a dark or a light page |
| `strip-<page>.svg` | All widgets in one image |
| `unlock-<page>.svg` | The "Unlock the rest" pill that opens the fold |
| `w-sky-<page>.svg` | "Tonight in Albany": the Moon, sunset, the planets you can see, a small sky chart |
| `showcase-storewright-<page>.svg`, `divider-<page>.svg` | The framed Storewright screenshot and the thin rule between sections |
| `icon-<app>-<page>.svg` | The app tiles behind the fold |
| `milestone-<1\|2>-<page>.svg` | The two newest milestones from `data/profile.json`, one card each so each links to its own evidence. A date stays exact for 60 days, then shows only the month |
| `skills-<page>.svg` | The skill map: one constellation per lane, a star per skill, brighter when more of my projects used it (the README lists the same map in words behind the fold) |
| `timeline-<page>.svg` | When each project started (and ended), with today marked |
| `badge-<linkedin\|site\|email\|guestbook>-<page>.svg` | The contact badges, drawn here rather than borrowed from a badge service |
| `footer-<page>.svg` | "Images redrawn every night by GitHub Actions · last run <date>": an image, because the README itself is not rewritten every night |
| `self-check.json`, `project-numbers.json`, `silnest-store.json`, `sky-day.json` | Published with the images: the last self-check, and the night's data |

The wallpaper names used before this look, `midnight`, `orbit`, `blossom` and `aurora` (dark)
and `lagoon` and `dawn` (light), still work in the scripts and in the function.

## Motion, and motion turned off

The planets, the seconds dot, the live dot in the status pill, the shimmer on the unlock pill, the
widget stack in the `right` layout and each widget's one small move (the SilNest app rises into
place, the Storewright tick draws itself, a dot walks along the store day's line, the duty
assistant's bars grow, the AI Vocal waveform moves, the brightest stars twinkle) are CSS
animations inside the SVG, under `@media (prefers-reduced-motion: no-preference)`. SMIL, which the
images used before, ignores that setting. With motion reduced everything stands still in the
right place: each moving part also carries the position it shows at load. Only the clock's
minutes still switch, because a clock that stops would be wrong. Whether every browser applies
the setting inside an image is to be checked on github.com in Chrome, Safari and Firefox.

## The sun glow and the festivals

The soft glow behind my avatar takes the color of Albany's sky: a faint violet at night, a dusky
rose in twilight, a warm orange when the Sun is near the horizon and a white gold by day, from
the Sun's real altitude (`live/astro.mjs`). The live banner works it out on every request; the
daily image at the time it is drawn (just after midnight, so violet). Only the glow's core
changes, so the change stays faint.

Three days get a small touch: New Year's Day a firework after the date, the Spring Festival
"Happy Lunar New Year" after it, and on the Mid-Autumn Festival the Moon beside Earth (and the
Moon on the "Tonight" widget) glows a little. The dates to 2035 come from Node's ICU Chinese
calendar, every year checked against Wikipedia and the Hong Kong Observatory. ICU was a day off
for the Spring Festival of 2027 and 2030 (a new moon close to midnight in Beijing), so the table
uses the published dates there; `node scripts/make_holidays.mjs --check` repeats the comparison.

## Phones

A 1000 pixel banner shrunk to a phone's width makes its text tiny, so the README offers a
portrait banner first: `<source media="(max-width: 600px)">`, one for light and one for dark
pages. Screens wider than 600 pixels skip it. `make_readme.py --no-portrait` leaves it out.

## Why the clock is right

GitHub serves README images through a caching proxy. The function answers with
`Cache-Control: no-cache`, so the proxy asks again on every page view and the time is
current when the page opens. The SVG then keeps time by itself: it carries the next two
hours of minutes and SMIL switches them on the second. The dot around the avatar is a second
hand: it goes around once a minute, in step with Albany.

The eight planets don't keep the time (an hour hand would barely move). When the image loads,
each planet sits where it really is: its heliocentric ecliptic longitude, with 0° (the March
equinox direction) on the right, 90° on the far side behind the avatar and 270° on the near
side. From there it goes around in 12 to 110 seconds, counter-clockwise like the real ones seen
from above, so only the start is real. The Moon rides beside Earth in today's phase, on the side
the real geometry puts it: toward the avatar at new Moon, away from it at full, trailing Earth
at first quarter and leading at last quarter. Each planet turns in the plane of its own orbit,
which a tilt and a squash turn into the ellipse you see; its short trail is the ring itself seen
through a wedge that turns with the planet, so the trail can never come loose. The rings stay
behind the avatar; on the near side of their rings Mercury, Venus and Earth pass in front of it.

The live function works out the positions when the image is requested. The daily image (no
clock; nothing would update it) shows the date instead and starts its planets where they were
when it was made; its seconds dot simply runs.

## Astronomy

Everything is computed offline by `live/astro.mjs`, with no network and no dependencies:

- **Planets:** Keplerian elements from JPL's "Keplerian Elements for Approximate Positions of the
  Major Planets", table 1 (E. M. Standish), valid 1800 to 2050.
- **Sun and Moon:** the low-precision formulas of the Astronomical Almanac. The Moon's phase is
  its elongation from the Sun (0° new, 90° first quarter, 180° full, 270° last quarter).
- **Rise and set:** sunset, dusk, dawn and the planets' rising and setting for Albany, from the
  altitude of each body through the night.

`node scripts/check_astro.mjs` compares it with reference values from JPL Horizons
(`scripts/astro-reference.json`, fetched once; the check itself needs no network). Last run,
all passed:

| What | Largest error |
|---|---|
| Planets (heliocentric longitude) | 0.14° for Saturn and 0.10° for Jupiter (table 1 leaves out their "great inequality"); 0.02° or less for the rest |
| The Sun | 0.004° |
| The Moon | 0.14° |
| Rise and set times | about 1 minute |
| New and full Moon times | 0.2 hours |

Fine for pictures, not for navigation. Every night `node scripts/sky_day.mjs` writes
`data/sky-day.json` (the planets' longitudes, the Moon, tonight's sky over Albany and a small
chart at nightfall) before the images are drawn.

## Why the widgets scroll

A table wider than the README scrolls sideways, but GitHub shrinks images to fit unless
each cell has an unbreakable line as wide as its image. The link under each widget is that
line: its words are joined with no-break spaces and padded to the image width plus 2 pixels.
The widths come from GitHub's own body text (16 px, measured in Chrome on a Mac), so the cells
are not wider than they need to be, and in a 1280 pixel window the third widget's edge shows
at the right: the row visibly goes on. The widgets stay 368 or 176 pixels wide for this reason.

## Storewright, before the fold

Right after the introduction the README shows Storewright: the 87-second demo video, with links
to the live demo and to its README. The video was uploaded in GitHub's web editor (dragged in;
it must be under 10 MB), and its `https://github.com/user-attachments/assets/...` address is
`storewright.video` in `data/profile.json`, which `make_readme.py` uses by default. The address
sits on a line of its own, which GitHub turns into a video player. `make_readme.py --no-video`
shows a still of the running demo instead, which opens the live demo. A new upload stays private
(logged-out visitors get a 404) until some text saved on github.com uses it; the Storewright
release notes did that for this one. The 3D store stays in the collapsed part.

## The interactive version

`pages/` builds https://glacieerr.github.io/ as a single HTML file that makes no network
requests. It reuses the clock and the astronomy above, so its planets also set off from where
they really are. There each planet, and the Moon, is a button that opens an app:

| Body | App |
|---|---|
| Mercury | Storewright |
| Venus | SilNest |
| Earth | Sky |
| Mars | AI Vocal |
| Jupiter | How I work |
| Saturn | Clock |
| Uranus | my website |
| Neptune | Contact |
| the Moon | Calendar |

The Sky app draws the sky for any of 172 cities, or for coordinates you type, on any date
from 1900 to 2050 (the limit of the planetary elements), using `live/sky-data.mjs` and
`live/sky-chart.mjs`. Links carry the place, date and time (`#sky/tokyo/2000-05-12/21:30`), and
the chart can be saved as an image. The README's "Tonight in Albany" widget opens it at `#sky`.
Around it, everything is computed offline and checked against published tables:

- **Tonight:** where each planet is and when to look, the year's daylight curve, star trails,
  the 23 brightest stars with their distances and the year their light left (sources in
  `sky-data.mjs`), a telescope view of Jupiter's moons, Saturn's rings and the phases of Venus
  and Mars, a true-scale solar system, and Chinese star names in Chinese mode.
- **The calendar:** every day's Moon (USNO), meteor shower peaks (IMO), NASA's eclipses to
  2035, solar terms and the Chinese lunar date (Hong Kong Observatory), the next 30 days of
  events, and an .ics download that `scripts/sky_ics.mjs` also writes every night. In Chinese
  each solar term sits on its date in Beijing time, as Chinese calendars print it; in English
  the equinoxes and solstices keep their Albany dates, as American calendars do.
- **Time:** time travel (the T key, or ">" in search) moves the clock, the store-day card, the
  planets and the sky together; dragging Earth along its ring moves through the year.

The rest of the page: a greeting by the visitor's own clock (a plain "Hello" before 5 AM), a day
and night map with the land drawn from Natural Earth's 1:110m outlines (public domain), the guestbook
(giscus, loaded only after a click; deep link `#guestbook`), "About this site" (page size,
requests, the number of checks and the astronomy table), a design page that reads its own
colors' contrast from the live CSS, an assets page with wallpapers drawn in the browser, a
one-page plain-text brief for recruiters (`#brief`, prints to one page), a slide mode for
interviews (`#present`), Storewright's picking game on its own small store and routing code, a
"What if…" lab that runs the store day again in your browser with Storewright's own simulation
code (pickers on shift, order volume, peak hours; it runs only when asked, and with nothing
changed it gives the store card's numbers),
FAQ, who did what, numbers read from the repositories, and the public resume PDFs.

A Content Security Policy in the page (script and style hashes, written by the build) lets the
browser refuse any outside connection except giscus after a click. Next to `index.html` the
build writes `404.html`, `og-image.png`, `card.txt` (try `curl -sL glacieerr.github.io/card.txt`),
`robots.txt`, `sitemap.xml` and the PDFs. `python3 pages/build.py --preview` also shows the
features that are not configured yet (booking link, testimonials form) with labeled
placeholders. Build with `python3 pages/build.py`; test with
`node pages/tests/cdp.mjs pages/tests/test.mjs`.

The photos travel as WebP (`pages/src/webp/`, made by `python3 pages/build.py --webp` with
headless Chrome's own encoder, so nothing is installed) and arrive in a second stylesheet after
the clock and the text, so a slow phone shows the time first. If a photo changes and its WebP is
not made again, the build uses the JPEG and says so.

The Glacieerr.github.io repository holds no copy of this code, only a workflow. It checks out
this repository's main branch, runs the same checks as `pages.yml` (the facts, the time edge
cases and every check of the page), gathers the files with `scripts/collect_site.sh` and
publishes them with GitHub Pages. Nothing is published when a check fails, and no token is
involved: the source is public, and a repository may publish its own Pages site. It runs by hand,
on every push there and every night; a nightly run stops after a few seconds unless main has
moved, because the site keeps the commit it was built from in `deployed-from.txt`.

## Checks that run by themselves

- **Every night** (`self_check.py`, before publishing): every image the README uses must be in
  `out/`, parse as SVG, carry no script, load nothing from outside and stay within its size
  budget; otherwise nothing is published and yesterday's images stay up. It also fetches every
  image the README links (and the live banner, once the README uses it). A problem on two nights
  in a row opens an issue in this repository; a clean night closes it.
- **Schedule** (`keepalive.py`, monthly, and `self_check.py`): GitHub turns off a public
  repository's scheduled workflows after 60 days without activity. Once a month the API is asked
  to enable them again, and 50 days after the last commit the nightly check opens an issue as a
  reminder. Whether the bot's nightly push already counts as activity is to be watched after go-live.
- **Every month** (`link_check.py`): every outside link in the README, this file and the
  interactive page; a broken one opens an issue. LinkedIn turns automated visitors away, so it is
  listed as a reminder to check by hand, never as a failure.
- **Every change to the interactive page** (`pages.yml`, `pages_tests.mjs`): the build and all of
  `pages/tests/test.mjs` in headless Chrome on Linux, with one retry. Glacieerr.github.io runs the
  same checks again before it publishes, and publishes only a page that passed.
- **Facts and wording** (`fact_check.py`, in `pages.yml`): a number, date or name that disagrees with the facts
  list, or a banned phrase, fails the run. `copy_check.py` reports style slips without failing.
- **Time edge cases** (`time_tests.mjs`): the clock, the festival table and tonight's sky across daylight-saving
  changes, a leap day and New Year, in four time zones. The page checks repeat this in the browser
  (`pages/tests/time-edges.mjs`): the clock, Today, the Calendar, the Sky app and time travel on
  the nights the clocks change, on a leap day and on New Year's Eve.
- **Other browsers** (`xbrowser.yml`): Chromium, Firefox and WebKit on Linux, macOS and Windows open the page,
  check that it makes no outside requests, and save screenshots.
- **Screenshots** (`pages/tests/visual.mjs`): the main views in dark and light, at desktop and
  phone width, at one frozen moment, against approved pictures. Fonts differ between a Mac and
  Linux, so the strict comparison runs on the Mac where the pictures were drawn, and the pictures
  stay there (git ignores `pages/tests/baseline/`); CI takes the same views and keeps them for 14
  days to look at.
- **Speed** (the `lighthouse` job in `pages.yml`, reported, not failing): Lighthouse scores as a
  phone and as a desktop, in the run's summary. `pages/tests/perf.mjs` measures the numbers behind
  them on your own machine: first paint, when the clock shows the time, layout shift and blocking
  time.
- **When the README is written** (`make_readme.py`): every image needs a real alt text, one or
  two sentences that no other image repeats (only the dividers are decorative), and every image
  it links must be in `out/`.

## Run it locally

```bash
python3 scripts/fetch_data.py                        # SilNest: version, dates, release notes
node scripts/store_day.mjs --repo ../storewright --date 2026-11-13 > data/store-day.json
node scripts/project_numbers.mjs --repo ../storewright   # commits, tests, dates (add --dry-run to only print)
node scripts/sky_day.mjs                             # tonight's sky -> data/sky-day.json
python3 scripts/lockscreen.py all --out out --pages dark,light
python3 scripts/lockscreen.py templates --out live
python3 scripts/make_readme.py                       # bold, below, portrait for phones, the live clock, the demo video; checks the images
python3 scripts/self_check.py --out out --online --dry-run   # the nightly check, opening no issue
python3 scripts/link_check.py --dry-run              # the monthly link check
node scripts/pages_tests.mjs --no-build              # the interactive page's checks
bash scripts/collect_site.sh --dry-run               # the files Glacieerr.github.io publishes
sh scripts/bundle_storewright_sim.sh ../storewright  # the What if lab's simulation -> pages/src/storewright-sim.js
python3 -I scripts/land_path.py ne_110m_land.geojson # the map's land, from Natural Earth -> pages/src/land.txt
node pages/tests/cdp.mjs pages/tests/visual.mjs      # the main views against the approved pictures (MODE=update approves new ones)
node pages/tests/cdp.mjs pages/tests/perf.mjs        # first paint and the clock, as a slow phone and as a desktop
OUT=<folder> node pages/tests/cdp.mjs pages/tests/shots.mjs   # preview pictures of every view
```

To see one moment, `python3 scripts/lockscreen.py all --out out --at 2026-11-13T22:55:07 --with-static`
also writes banners frozen at that time, with the planets where they were then (that needs
Node; `--weather "☁︎ 41°F"` adds a sample weather label). The Storewright screenshot in the
README sits in a frame (`out/showcase-storewright-*.svg`) made from a compressed copy,
`assets/src/storewright-showcase-960.jpg`; on a Mac the script refreshes that copy with `sips`
whenever the screenshot is newer.

## License

The code in this repository is under the [MIT license](LICENSE). Not covered by it:

- **Pictures:** my avatar, the SilNest icon and screenshots, and the screenshots of my site and
  of Storewright (`assets/src/`, with their WebP copies in `pages/src/webp/`), the share image
  (`pages/src/og-image.png`) and the design drafts (`pages/src/drafts/`). All rights reserved.
- **Files made from Storewright:** `pages/src/storewright-sim.js` (its simulation, bundled),
  `pages/src/storewright-small.json` (its small store) and `assets/store.stl` (its medium store)
  come from [Storewright](https://github.com/Glacieerr/storewright) and keep its license,
  AGPL-3.0; their source is that repository.
- **The land outlines** in `pages/src/land.txt` come from
  [Natural Earth](https://www.naturalearthdata.com/) and are in the public domain.
