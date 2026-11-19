> **中文摘要：** 这篇文章讲我的 GitHub 主页是怎么做的：README 顶部是一张 SVG 横幅，显示 Albany 的时间；头像周围的八大行星从它们今天的真实位置出发（用 NASA/JPL 公布的近似轨道根数计算，并和 JPL Horizons 星历核对过，行星误差在 0.15° 以内）；月亮跟在地球旁边，画的是今天的月相。时钟靠一个不让 GitHub 缓存的小函数和 SVG 自带的动画走准；小组件每天由 GitHub Actions 重画。还有一个交互版：一个 HTML 文件，打开时不联网，可以看 172 个城市今晚的星空。最后一节如实写了 AI 做了什么、我做了什么。

# A GitHub profile that watches the sky

*How I built a README with a clock for Albany, NY, a small solar system that starts from the planets' real positions, and widgets that redraw themselves every day. And what the AI did, and what I did.*

Most GitHub profiles are a list. I wanted mine to show something working the moment it opens. Open [github.com/Glacieerr](https://github.com/Glacieerr) and the README starts with a banner: the date and time in Albany, my name, and on the right my avatar as a sun, with eight planets on thin rings around it and the Moon beside Earth. Under the banner and two milestone cards, a row of eight widgets scrolls sideways, among them my app on the App Store, a simulated day in my open-source store twin, and tonight's sky over Albany. There is also an interactive version at [glacieerr.github.io](https://glacieerr.github.io/).

The page isn't a screenshot. It is generated (three of the widgets frame real screenshots of my apps): Python draws the SVG, a scheduled GitHub Action redraws it every day, and a small serverless function draws the banner again with the current time whenever someone opens the page.

## Why the clock is right

A README can't run JavaScript, and GitHub doesn't load images straight from where they live: it serves them through its own image proxy, which caches. So a clock in a README has two problems: the image must be current when the page opens, and it must keep time afterward.

The first is a header. The banner's address points at a function on Vercel, which answers with:

```js
'cache-control': 'no-cache, no-store, must-revalidate, max-age=0',
```

With that, the proxy asks again on every page view, so the time is right when the page opens.

The second is SMIL, the animation built into SVG, which still runs inside an `<img>`, even with no script. The function doesn't send one time; it sends the next two hours of minutes, each a `<text>` element that SMIL shows and hides on the second:

```js
const show = k === 0 ? 0 : k * 60 - sec;   // seconds after the image loads
const hide = (k + 1) * 60 - sec;
time += `<text visibility="${k === 0 ? 'visible' : 'hidden'}">${q.hour}:${q.minute}…`
  + `<set attributeName="visibility" to="visible" begin="${show}s"/>`
  + `<set attributeName="visibility" to="hidden" begin="${hide}s"/>`;
```

A small dot runs around the edge of my avatar once a minute, in step with Albany's seconds, like a second hand. Leave the page open for an hour and the clock is still right.

There is also a fallback that needs no server: the daily job draws a banner with the date as the headline instead of the time, because nothing would update a clock there, and one command (`make_readme.py --no-clock`) points the README at it.

## The planets start where they really are

The first version had three planets that kept the time: minutes, hours and seconds. It looked clever and read badly: an hour hand barely moves. So the planets stopped keeping time and became the solar system instead: eight planets, Mercury to Neptune, each going around in 12 to 110 seconds, faster toward the middle, all of them visibly moving.

Then a better idea: let each one *start* where it really is today.

`live/astro.mjs` works out each planet's position from the Keplerian elements in JPL's *Keplerian Elements for Approximate Positions of the Major Planets* (table 1, E. M. Standish, valid 1800 to 2050). For a moment in time it advances the six elements, solves Kepler's equation for the eccentric anomaly, and rotates the orbit into the ecliptic:

```js
const E = kepler(L - peri, e);                         // eccentric anomaly
const xp = a * (Math.cos(E) - e);
const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
// … rotate by the argument of perihelion, the inclination and the node …
return { lon: norm360(Math.atan2(y, x) * R2D), … };   // heliocentric ecliptic longitude
```

The banner needs one number per planet: its heliocentric ecliptic longitude λ. The screen convention puts λ = 0° (the direction of the March equinox) on the right, 90° on the far side behind the avatar and 270° on the near side. Each planet turns counter-clockwise, as the real ones do seen from above, and an animation can start part-way through: give it a negative start time. A planet at λ is (λ − 90°)/360° of the way round from the top of its ring, so its turn starts that fraction of a period in:

```js
const begin = (period, angle) => `-${(period * n360(angle) / 360).toFixed(2)}s`;
```

From there the planets go around at banner speed, so **only the start is real**. If a visitor has asked their system for reduced motion, the planets stand still in those real starting places instead, in browsers that apply that setting inside images. I'm careful to say "they set off from where they really are today", not "live positions".

Each planet turns in the plane of its own circular orbit; a tilt of −9° and a squash turn that circle into the ellipse you see, and a counter-turn keeps the planet itself round and upright. The short trail behind each planet is the ring itself seen through a wedge that turns with the planet, so it can never come loose. Rings stay behind the avatar; on the near side of their rings, Mercury, Venus and Earth pass in front of it.

## The Moon beside Earth

The Moon rides about 8 pixels from Earth and is drawn in today's phase, lit on the right when waxing. Its angle around Earth follows the real geometry. With E the Moon's elongation from the Sun (0° new, 90° first quarter, 180° full), its direction from Earth in the orbit plane is λ_Earth + 180° + E. So at new Moon it sits between Earth and the avatar (the "sun"), at full Moon on the far side, at first quarter trailing Earth and at last quarter leading it.

## Checking it against NASA/JPL

Approximate formulas are only worth something if you know how approximate. `scripts/check_astro.mjs` compares the code with reference values fetched once from JPL Horizons (`scripts/astro-reference.json`; the check itself needs no network). The last run:

| What | Largest error |
|---|---|
| Planets (heliocentric longitude) | 0.14° for Saturn and 0.10° for Jupiter; 0.02° or less for the rest |
| The Sun | 0.004° |
| The Moon | 0.14° |
| Rise and set times | about 1 minute |
| New and full Moon times | 0.2 hours |

Jupiter and Saturn are the worst because table 1 leaves out their "great inequality", a slow mutual perturbation. All of this is fine for pictures, not for navigation.

## A row of widgets that scrolls

Under the banner and the two milestone cards, the eight widgets sit in one table row that is wider than the README, so it scrolls sideways. The catch: GitHub shrinks images to fit unless each table cell has an unbreakable line as wide as its image. The caption under each widget is that line: its words are joined with no-break spaces and padded to the image's width plus 2 pixels.

The widths come from GitHub's own body text (16 px), measured in headless Chrome on a Mac, so the cells are no wider than they need to be. At a 1280-pixel window, the third widget is cut off at the right, which tells you the row goes on.

## Dark and light

Every image comes twice. A `<picture>` element picks by the visitor's GitHub theme:

```html
<picture>
  <source media="(prefers-color-scheme: light)" srcset="…/api/lockscreen?theme=light…">
  <img src="…/api/lockscreen?theme=dark…" alt="…">
</picture>
```

The light version is its own white design, with its own grays and softer glows, not the dark one inverted. On phones, a portrait banner comes first (`media="(max-width: 600px)"`), because a 1000-pixel banner shrunk to a phone makes the text tiny.

## Every day

A GitHub Action is scheduled for 05:17 UTC (17 minutes past midnight in New York in winter). GitHub starts scheduled runs late when it is busy: in its first days this one began about nine hours late, between 9 and 10 in the morning in New York. It:

1. runs one simulated day of [Storewright](https://github.com/Glacieerr/storewright), my open-source store twin, with the date as the random seed, so a given day always gives the same numbers for the same version of the simulator (all synthetic), and counts Storewright's commits and tests;
2. reads SilNest's current version and release notes from Apple's public lookup API;
3. works out the planets, the Moon's phase and tonight's sky over Albany, offline, into `data/sky-day.json`, and writes a calendar of the sky's events;
4. redraws every SVG, checks every image the README uses, and publishes them to an `output` branch. If an image is missing or broken, nothing is published and yesterday's images stay up.

The art itself is drawn by a Python script that uses only the standard library; the only thing the job installs is the store simulator's own dependencies, and if that step fails the widget keeps the last day.

## The interactive version

[glacieerr.github.io](https://glacieerr.github.io/) is one HTML file that makes no network requests when it opens. It reuses the same clock and astronomy. There, each planet (and the Moon) is a button that opens an app: Storewright, SilNest, my website, how I work, and so on. The Sky app draws tonight's sky for any of 172 cities, or for coordinates you type, with the Moon, the visible planets and when to look. A time-travel slider moves the clock, the planets and the sky together.

## What the AI did, and what I did

I built this with Claude, in Claude Code. The split, honestly:

- **I** chose the look, "Dusk Tech", after comparing eight full-page mocks, and turned down an earlier iOS-7-style version. I asked for my avatar at the center and for every planet to visibly orbit, which is what turned the clock-planets into a solar system. I read every idea on a long list and decided which to build, and I reviewed the previews and accepted each change through tests and walkthroughs before anything went live.
- **Claude** wrote most of the code: the SVG drawing, the astronomy module, the live function, the daily workflow, the interactive page, and the checks, including the comparison with JPL Horizons. It also proposed most of the ideas I chose from.

The checks matter most to me. I can't read every line of an orbital-mechanics module and vouch for it, but I can insist that it is compared against JPL's own numbers, and read the table.

## What I'd watch

- GitHub's image proxy and SMIL support are outside my control; if either changes, one command switches the README to the daily image.
- The GitHub mobile app may handle `<picture>` and SVG animation differently from the website; I still need to check it there.
- "Real positions" means approximate positions, good to a fraction of a degree, and only at the start.

**Links:** [github.com/Glacieerr](https://github.com/Glacieerr) · [glacieerr.github.io](https://glacieerr.github.io/) · how it works, file by file: [HOW-IT-WORKS.md](../HOW-IT-WORKS.md)
