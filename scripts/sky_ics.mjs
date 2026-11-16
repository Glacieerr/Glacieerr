// A year of sky events as an iCalendar file (idea #141): full and new Moons, the equinoxes and
// solstices, the meteor shower maxima and the eclipses of the next 12 months. It is the same file
// the Sky app's "Download a year of sky events" button makes in the browser on the same day
// (both start from Albany's date, call skyCalendar() and icsCalendar() in live/astro.mjs and take
// their words from pages/src/copy.json), so the nightly job can publish it next to the images.
// Offline; no dependencies.
//   node scripts/sky_ics.mjs                       out/sky-events-en.ics and out/sky-events-zh.ics, from today
//   node scripts/sky_ics.mjs --from 2026-11-14     from that date (Albany's calendar)
//   node scripts/sky_ics.mjs --lang zh --stdout    one language, printed instead of written
//   node scripts/sky_ics.mjs --out <folder>        write somewhere else
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { skyCalendar, icsCalendar } from '../live/astro.mjs';
import { METEOR_SHOWERS, SOLAR_ECLIPSES, LUNAR_ECLIPSES } from '../live/sky-data.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const fmt = (s, o) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in o ? o[k] : m));

const copy = JSON.parse(readFileSync(join(ROOT, 'pages', 'src', 'copy.json'), 'utf8'));
const profile = JSON.parse(readFileSync(join(ROOT, 'data', 'profile.json'), 'utf8'));
const site = String(profile.links.pages || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
const tz = profile.timezone || 'America/New_York';

// Albany's date today (as the page counts it), unless --from gives one
let from = opt('--from');
if (!from) from = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(from);
const start = m && Date.UTC(+m[1], +m[2] - 1, +m[3]);
if (!m || new Date(start).toISOString().slice(0, 10) !== from) {
  console.error(`sky_ics: --from wants a real date as YYYY-MM-DD, not ${from}`);
  process.exit(2);
}
const end = Date.UTC(+m[1] + 1, +m[2] - 1, +m[3]);
const langs = opt('--lang') ? [opt('--lang')] : ['en', 'zh'];
if (!langs.every((l) => copy[l] && copy[l].ics)) {
  console.error(`sky_ics: --lang is en or zh, not ${opt('--lang')}`);
  process.exit(2);
}

const events = skyCalendar(start, end, { showers: METEOR_SHOWERS, solarEclipses: SOLAR_ECLIPSES, lunarEclipses: LUNAR_ECLIPSES });
const outDir = opt('--out') || join(ROOT, 'out');
for (const lang of langs) {
  const text = copy[lang].ics;
  const ics = icsCalendar(events, {
    text, lang, host: site, stamp: start,
    name: fmt(text.name, { from, to: new Date(end).toISOString().slice(0, 10) }), desc: fmt(text.desc, { site }),
  });
  if (args.includes('--stdout')) { process.stdout.write(ics); continue; }
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, `sky-events-${lang}.ics`);
  writeFileSync(file, ics);
  console.log(`sky_ics: wrote ${file} (${events.length} events from ${from})`);
}
