// Screenshot comparison (idea #179): the main views of pages/dist/index.html in dark and light, at
// desktop and phone width, against approved pictures in pages/tests/baseline/.
//   node pages/tests/cdp.mjs pages/tests/visual.mjs                 compare (the default)
//   MODE=update node pages/tests/cdp.mjs pages/tests/visual.mjs     approve: write the baselines again
//   MODE=shots  node pages/tests/cdp.mjs pages/tests/visual.mjs     only take the pictures (CI)
// env: OUT (where the new pictures and the diff images go; default: the temp folder),
//      ONLY (run the views whose name contains it), BASELINE (another baseline folder),
//      THRESHOLD and MAX_PIXELS (the tolerance below).
// Every picture is taken at one frozen moment (Friday, November 13, 2026, 10:55:07 PM in Albany,
// the visitor in Albany too) with reduced motion, so the planets and the clock stand still; the
// numbers in About this site that change with every build (the page's size, the checks, the
// build date) are covered with fixed words. Drawn twice on one machine the pictures are the
// same to the pixel, so the tolerance is small: a pixel counts as changed when a color channel
// differs by more than 16 of 255 (smoothing that shifts a little), and a view fails when more
// than 20 pixels changed (one letter is about 130) or its size changed. A failed view gets a
// diff image next to the new picture: the new picture, faint, with the changed pixels in magenta.
// The baselines are drawn on a Mac. Fonts are the system's own (San Francisco there, others on
// Linux), so the strict comparison runs on a Mac; CI (pages.yml) takes the same pictures with
// MODE=shots and keeps them as an artifact to look at. After a change to the look on purpose,
// run MODE=update and look at the new baselines. They stay on the Mac (git ignores pages/tests/baseline/:
// 7 MB of pictures that only that machine can compare strictly).
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareImages, decodePNG, encodePNG } from './png.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const MODE = process.env.MODE || 'compare';
const BASE = process.env.BASELINE || join(HERE, 'baseline');
const OUT = process.env.OUT || join(tmpdir(), `pages-visual-${Date.now()}`);
const ONLY = process.env.ONLY || '';
const FROZEN = Date.parse(process.env.FROZEN || '2026-11-13T22:55:07-05:00');
const THRESHOLD = Number(process.env.THRESHOLD || 16);
const MAX_PIXELS = Number(process.env.MAX_PIXELS ?? 20);

export const VIEWS = [
  ['lock', '?lang=en'],
  ['home', '?lang=en#home'],
  ['sky', '?lang=en#sky'],
  ['calendar', '?lang=en#home/calendar'],
  ['about', '?lang=en&open=about'],
  ['brief', '?lang=en#brief'],
  ['present-1', '?lang=en#present/1'],
  ['assets', '?lang=en#home/assets'],
];
const SIZES = [['desktop', 1440, 900, false], ['phone', 390, 844, true]];
const THEMES = ['dark', 'light'];

// Date frozen at one instant for every document (before the page's own scripts run). The page
// reads the time only through Date; Intl.DateTimeFormat's format() is always given a date.
const freeze = (ms) => `(() => { const T = ${ms}; const RD = Date; function FD(...a) { if (!new.target) return new RD(T).toString(); return a.length ? new RD(...a) : new RD(T); }
  FD.prototype = RD.prototype; FD.now = () => T; FD.UTC = RD.UTC; FD.parse = RD.parse; Object.defineProperty(FD, 'name', { value: 'Date' }); window.Date = FD; })();`;
// the numbers in About this site that change with every build
const MASK = `(() => { for (const [k, v, n] of [['size', '1,000 KB', null], ['checks', '300', 'Last run on a fixed day'], ['built', 'A fixed day', null]]) {
  const row = document.querySelector('#abNums [data-k="' + k + '"]'); if (!row) continue;
  const dv = row.querySelector('.ab-v'); if (dv) dv.textContent = v; const dn = row.querySelector('.ab-n'); if (dn && n) dn.textContent = n; } })()`;

export default async function (api) {
  const { sleep } = api;
  mkdirSync(OUT, { recursive: true });
  if (MODE === 'update') mkdirSync(BASE, { recursive: true });
  await api.send('Page.addScriptToEvaluateOnNewDocument', { source: freeze(FROZEN) });
  await api.send('Emulation.setTimezoneOverride', { timezoneId: 'America/New_York' });
  const results = [];
  for (const [view, query] of VIEWS) {
    for (const [size, w, h, mobile] of SIZES) {
      for (const theme of THEMES) {
        const name = `${view}-${theme}-${size}`;
        if (ONLY && !name.includes(ONLY)) continue;
        await api.viewport(w, h, { mobile, dark: theme === 'dark', reduce: true });
        await api.go(query, 900);
        // the photos are data: URIs and the fonts the system's; wait for both, then two frames
        await api.eval(`(async () => { await document.fonts.ready; const urls = new Set(); for (const e of document.querySelectorAll('*')) { const m = getComputedStyle(e).backgroundImage.match(/url\\("?(data:image\\/[^")]+)"?\\)/); if (m) urls.add(m[1]); } await Promise.all([...urls].map((u) => { const i = new Image(); i.src = u; return i.decode().catch(() => {}); })); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); })()`);
        await api.eval(MASK);
        await api.eval(`(() => { try { localStorage.clear(); } catch (e) {} if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); })()`);
        await sleep(400);
        const png = await api.shot(null);
        const file = join(OUT, `${name}.png`);
        writeFileSync(file, png);
        const ref = join(BASE, `${name}.png`);
        if (MODE === 'update') {
          writeFileSync(ref, png);
          results.push({ name, status: 'approved' });
        } else if (MODE === 'shots') {
          results.push({ name, status: 'taken' });
        } else if (!existsSync(ref)) {
          results.push({ name, status: 'no baseline' });
        } else {
          const c = compareImages(decodePNG(readFileSync(ref)), decodePNG(png), { threshold: THRESHOLD });
          const failed = c.sizeMismatch || c.changed > MAX_PIXELS;
          if (c.diff && failed) writeFileSync(join(OUT, `${name}.diff.png`), encodePNG(c.diff));
          results.push({ name, status: failed ? 'CHANGED' : 'same', changed: c.changed, pct: +(c.ratio * 100).toFixed(4), box: c.box, sizeMismatch: !!c.sizeMismatch });
        }
        console.log(results.at(-1).status.padEnd(12), name, results.at(-1).changed ? `${results.at(-1).changed} px (${results.at(-1).pct}%) in ${JSON.stringify(results.at(-1).box)}` : '');
      }
    }
  }
  if (MODE === 'compare') {
    // baselines with no view any more (a view renamed or dropped)
    const taken = new Set(results.map((r) => `${r.name}.png`));
    const stale = existsSync(BASE) && !ONLY ? readdirSync(BASE).filter((f) => f.endsWith('.png') && !taken.has(f)) : [];
    if (stale.length) console.log('baselines with no view:', stale.join(', '));
    const bad = results.filter((r) => r.status !== 'same');
    console.log(`\n${results.length - bad.length} of ${results.length} views match their baselines (at most ${MAX_PIXELS} pixels with a channel off by more than ${THRESHOLD})`);
    if (bad.length) {
      console.log(`changed or missing: ${bad.map((r) => r.name).join(', ')}\nnew pictures and diff images: ${OUT}\nif the change is meant: MODE=update node pages/tests/cdp.mjs pages/tests/visual.mjs`);
      process.exitCode = 1;
    }
  } else console.log(`\n${results.length} pictures ${MODE === 'update' ? `approved in ${BASE}` : `in ${OUT}`}`);
  writeFileSync(join(OUT, 'visual-results.json'), `${JSON.stringify({ mode: MODE, frozen: new Date(FROZEN).toISOString(), threshold: THRESHOLD, maxPixels: MAX_PIXELS, results }, null, 2)}\n`);
}
