// Time edge cases (idea #177): the moments a clock is most likely to get wrong, for
//   live/lockscreen-core.mjs   the live banner: the minutes it carries, the date line, the
//                              seconds dot, the festival touches and the Moon's Mid-Autumn glow
//   live/holidays.mjs          the festival table (and its Python twin, scripts/festivals.py,
//                              which the nightly README images use)
//   scripts/sky_day.mjs        tonight's sky for the nightly images (run as the job runs it)
// at these moments in Albany (America/New_York):
//   DST starts   2026-03-08 and 2027-03-14, 2:00 AM EST -> 3:00 AM EDT (2 AM never happens)
//   DST ends     2026-11-01, 2:00 AM EDT -> 1:00 AM EST (the hour from 1 to 2 AM happens twice)
//   leap day     2028-02-29
//   year end     2026-12-31 -> 2027-01-01
// and, because the page's Sky app has southern cities, one southern DST change (Adelaide, whose
// offset is a half hour). Every moment is a fixed UTC instant, so the result does not depend on the
// machine's own time zone: CI runs it in UTC, a Mac in New York; `TZ=Asia/Shanghai node ...` too.
//   node scripts/time_tests.mjs        exits 1 if a check fails
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as A from '../live/astro.mjs';
import { FIRST, LAST, MID_AUTUMN, SPRING_FESTIVAL, festivalOn } from '../live/holidays.mjs';
import { parts, renderLive, ymd } from '../live/lockscreen-core.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TZ = 'America/New_York';
let pass = 0;
const failed = [];
const notes = [];
const ok = (cond, name, extra = '') => {
  if (cond) { pass++; console.log(`ok    ${name}`); } else { failed.push(name); console.log(`FAIL  ${name}${extra ? `\n      ${extra}` : ''}`); }
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ms = (iso) => Date.parse(iso);
const MIN = 60000;

// ---------------------------------------------------------------- 1. the clock's parts
console.log('-- live/lockscreen-core.mjs: what the clock reads at the edges');
const reading = (iso, tz = TZ) => {
  const p = parts(new Date(iso), tz);
  return `${p.weekday}, ${p.month} ${p.day} ${p.hour}:${p.minute}:${p.second} ${p.dayPeriod}`;
};
for (const [iso, want, why] of [
  ['2026-03-08T06:59:59Z', 'Sunday, March 8 1:59:59 AM', 'last second of EST'],
  ['2026-03-08T07:00:00Z', 'Sunday, March 8 3:00:00 AM', 'EDT starts: 2 AM is skipped'],
  ['2027-03-14T06:59:59Z', 'Sunday, March 14 1:59:59 AM', 'last second of EST'],
  ['2027-03-14T07:00:00Z', 'Sunday, March 14 3:00:00 AM', 'EDT starts: 2 AM is skipped'],
  ['2026-11-01T05:59:59Z', 'Sunday, November 1 1:59:59 AM', 'first 1:59 (EDT)'],
  ['2026-11-01T06:00:00Z', 'Sunday, November 1 1:00:00 AM', 'EST starts: 1 AM again'],
  ['2026-11-01T06:59:59Z', 'Sunday, November 1 1:59:59 AM', 'second 1:59 (EST)'],
  ['2026-11-01T07:00:00Z', 'Sunday, November 1 2:00:00 AM', 'then 2 AM'],
  ['2027-01-01T04:59:59Z', 'Thursday, December 31 11:59:59 PM', 'last second of 2026'],
  ['2027-01-01T05:00:00Z', 'Friday, January 1 12:00:00 AM', 'midnight, 2027 (UTC turned five hours ago)'],
  ['2028-02-29T04:59:59Z', 'Monday, February 28 11:59:59 PM', 'eve of the leap day'],
  ['2028-02-29T05:00:00Z', 'Tuesday, February 29 12:00:00 AM', 'the leap day starts'],
  ['2028-03-01T04:59:59Z', 'Tuesday, February 29 11:59:59 PM', 'the leap day ends'],
  ['2028-03-01T05:00:00Z', 'Wednesday, March 1 12:00:00 AM', 'March 1'],
]) ok(reading(iso) === want, `${iso} reads ${want} (${why})`, reading(iso));
ok(same(ymd(new Date('2027-01-01T04:59:59Z'), TZ), { y: 2026, m: 12, d: 31 }) && same(ymd(new Date('2027-01-01T05:00:00Z'), TZ), { y: 2027, m: 1, d: 1 }),
  'ymd(): the year turns at Albany midnight, not UTC midnight');
ok(same(ymd(new Date('2028-02-29T12:00:00Z'), TZ), { y: 2028, m: 2, d: 29 }), 'ymd(): February 29, 2028 exists');
// Adelaide: ACDT (+10:30) ends 2027-04-04 at 3:00 AM -> 2:00 AM ACST (+9:30); starts 2026-10-04 at 2:00 AM -> 3:00 AM
ok(reading('2027-04-03T16:29:59Z', 'Australia/Adelaide') === 'Sunday, April 4 2:59:59 AM'
  && reading('2027-04-03T16:30:00Z', 'Australia/Adelaide') === 'Sunday, April 4 2:00:00 AM'
  && reading('2026-10-03T16:29:59Z', 'Australia/Adelaide') === 'Sunday, October 4 1:59:59 AM'
  && reading('2026-10-03T16:30:00Z', 'Australia/Adelaide') === 'Sunday, October 4 3:00:00 AM',
'southern DST with a half-hour offset (Adelaide): 3 AM -> 2 AM in April, 2 AM -> 3 AM in October');

// ---------------------------------------------------------------- 2. the banner a request gets
console.log('-- live/lockscreen-core.mjs: the minutes, dates and festivals in a live banner');
const TPL = '<svg aria-label="Banner."><g class="t"><!--TIME--></g><g class="d"><!--DATE--></g>'
  + '<circle data-begin="{{BEGIN_SEC}}" data-deg="{{SEC_DEG}}"/><g class="glow" opacity="{{MOON_GLOW:0.6}}"/></svg>';
const FEST = { 'new-year': { text: ' NY', fill: '#fff' }, 'spring-festival': { text: ' SF', fill: '#f66' }, 'mid-autumn': { text: ' MA', fill: '#fd6' } };
const setAt = (s, to) => { const m = s.match(new RegExp(`to="${to}" begin="(-?[\\d.]+)s"`)); return m ? Number(m[1]) : null; };
function banner(iso, minutes, timeZone = TZ) {
  const svg = renderLive(TPL, { now: ms(iso), minutes, timeZone, festival: festivalOn, fest: FEST });
  const times = [...svg.matchAll(/<text x="0" y="0" visibility="(visible|hidden)">(\d{1,2}:\d{2})<tspan[^>]*>(AM|PM)<\/tspan>(.*?)<\/text>/g)]
    .map((m) => ({ vis: m[1], hm: `${m[2]} ${m[3]}`, on: setAt(m[4], 'visible'), off: setAt(m[4], 'hidden') }));
  const dates = [...svg.matchAll(/<text x="0" y="0" visibility="(visible|hidden)">([A-Z][a-z]+, [A-Z][a-z]+ \d{1,2})((?:<tspan[^>]*>[^<]*<\/tspan>)?)(.*?)<\/text>/g)]
    .map((m) => ({ vis: m[1], d: m[2], fest: m[3].replace(/<[^>]+>/g, '').trim(), on: setAt(m[4], 'visible'), off: setAt(m[4], 'hidden') }));
  const circle = svg.match(/data-begin="([^"]*)" data-deg="([^"]*)"/);
  return { times, dates, aria: svg.match(/aria-label="([^"]*)"/)[1], glow: svg.match(/class="glow" opacity="([^"]*)"/)[1], begin: circle[1], deg: circle[2] };
}
const hms = (b) => b.times.map((t) => t.hm);
// every minute is shown from its first second to the next minute's, in order, one at a time
const steady = (b, sec) => b.times.every((t, k) => t.vis === (k === 0 ? 'visible' : 'hidden')
  && t.on === (k === 0 ? null : k * 60 - sec) && t.off === (k === b.times.length - 1 ? null : (k + 1) * 60 - sec));

for (const iso of ['2026-03-08T06:58:30Z', '2027-03-14T06:58:30Z']) {
  const b = banner(iso, 5);
  ok(same(hms(b), ['1:58 AM', '1:59 AM', '3:00 AM', '3:01 AM', '3:02 AM']) && steady(b, 30),
    `${iso.slice(0, 10)}: the banner goes 1:59 AM -> 3:00 AM, a minute apart`, JSON.stringify(b.times));
  ok(b.dates.length === 1 && b.dates[0].vis === 'visible' && b.aria.endsWith(`Local time 1:58 AM, ${b.dates[0].d}.`),
    `${iso.slice(0, 10)}: one date line, and the label says the time`, JSON.stringify([b.dates, b.aria]));
}
{
  const b = banner('2026-11-01T05:58:30Z', 5);
  ok(same(hms(b), ['1:58 AM', '1:59 AM', '1:00 AM', '1:01 AM', '1:02 AM']) && steady(b, 30) && b.dates.length === 1,
    '2026-11-01: the banner goes 1:59 AM (EDT) -> 1:00 AM (EST), a minute apart, same date', JSON.stringify(b.times));
  const long = banner('2026-11-01T05:30:00Z', 120);
  const h = hms(long);
  ok(h.length === 120 && h.filter((x) => x === '1:45 AM').length === 2 && h.indexOf('2:00 AM') === 90 && steady(long, 0),
    '2026-11-01: two hours from 1:30 AM EDT hold 1:45 AM twice and reach 2:00 AM after 90 minutes', JSON.stringify(h.slice(0, 3).concat(h.slice(88, 92))));
  const spring = hms(banner('2026-03-08T06:30:00Z', 120));
  ok(spring.length === 120 && !spring.some((x) => /^2:\d\d AM$/.test(x)) && spring[30] === '3:00 AM',
    '2026-03-08: two hours from 1:30 AM EST never show 2:xx AM; 3:00 AM comes 30 minutes in', JSON.stringify(spring.slice(28, 32)));
  const a = banner('2026-11-01T05:59:30.250Z', 1);
  const c = banner('2026-11-01T06:59:30.250Z', 1);
  ok(a.begin === '-30.25s' && c.begin === '-30.25s' && a.deg === '181.5' && c.deg === '181.5',
    'the seconds dot is the same at both 1:59:30 AMs (Albany is a whole number of hours from UTC)', JSON.stringify([a.begin, a.deg, c.begin, c.deg]));
}
{
  const b = banner('2027-01-01T04:58:30Z', 5);
  ok(same(hms(b), ['11:58 PM', '11:59 PM', '12:00 AM', '12:01 AM', '12:02 AM']) && steady(b, 30),
    '2026-12-31: 11:59 PM -> 12:00 AM', JSON.stringify(b.times));
  ok(b.dates.length === 2 && same(b.dates[0], { vis: 'visible', d: 'Thursday, December 31', fest: '', on: null, off: 90 })
    && same(b.dates[1], { vis: 'hidden', d: 'Friday, January 1', fest: 'NY', on: 90, off: null }),
  'year end: Thursday, December 31 until 90 s in, then Friday, January 1 with the New Year touch', JSON.stringify(b.dates));
  const utcNewYear = banner('2027-01-01T04:30:00Z', 1);
  ok(utcNewYear.dates.length === 1 && utcNewYear.dates[0].d === 'Thursday, December 31' && utcNewYear.dates[0].fest === '',
    'at 11:30 PM on December 31 (already January 1 in UTC) there is no New Year touch yet', JSON.stringify(utcNewYear.dates));
}
for (const [iso, from, to] of [['2028-02-29T04:58:30Z', 'Monday, February 28', 'Tuesday, February 29'],
  ['2028-03-01T04:58:30Z', 'Tuesday, February 29', 'Wednesday, March 1']]) {
  const b = banner(iso, 5);
  ok(b.dates.length === 2 && b.dates[0].d === from && b.dates[1].d === to && b.dates[1].on === 90 && b.dates[0].off === 90
    && same(hms(b), ['11:58 PM', '11:59 PM', '12:00 AM', '12:01 AM', '12:02 AM']),
  `leap day: ${from} -> ${to} at midnight`, JSON.stringify(b.dates));
}
{
  const eve = banner('2026-09-25T03:30:00Z', 1);   // 11:30 PM EDT on September 24 (UTC: already the 25th)
  const day = banner('2026-09-25T04:00:00Z', 1);   // 12:00 AM EDT on September 25, the Mid-Autumn Festival
  ok(eve.glow === '0' && eve.dates[0].fest === '' && day.glow === '0.6' && day.dates[0].fest === 'MA',
    'Mid-Autumn 2026-09-25: the Moon glows from Albany midnight, not from UTC midnight', JSON.stringify([eve.glow, eve.dates, day.glow, day.dates]));
  const sf = banner('2027-02-06T04:59:00Z', 2);    // 11:59 PM EST on February 5, then the Spring Festival
  ok(sf.dates.length === 2 && sf.dates[0].fest === '' && sf.dates[1].d === 'Saturday, February 6' && sf.dates[1].fest === 'SF',
    'Spring Festival 2027-02-06 (the year ICU gets wrong): the touch starts at Albany midnight', JSON.stringify(sf.dates));
}
{
  const ad = banner('2027-04-03T16:28:30Z', 3, 'Australia/Adelaide');
  ok(same(hms(ad), ['2:58 AM', '2:59 AM', '2:00 AM']) && steady(ad, 30), 'Adelaide, April 2027: 2:59 AM -> 2:00 AM in the live banner', JSON.stringify(ad.times));
}

// ---------------------------------------------------------------- 3. the festival table
console.log('-- live/holidays.mjs and scripts/festivals.py: the festival days');
for (const [y, m, d, want] of [[2026, 12, 31, null], [2027, 1, 1, 'new-year'], [2028, 1, 1, 'new-year'], [2036, 1, 1, 'new-year'],
  [2028, 2, 29, null], [2028, 1, 26, 'spring-festival'], [2027, 2, 5, null], [2027, 2, 6, 'spring-festival'],
  [2026, 9, 24, null], [2026, 9, 25, 'mid-autumn'], [2030, 2, 3, 'spring-festival'], [2036, 2, 15, null]]) {
  ok(festivalOn(y, m, d) === want, `festivalOn(${y}, ${m}, ${d}) is ${want}`, String(festivalOn(y, m, d)));
}
{
  const years = Array.from({ length: LAST - FIRST + 1 }, (_, i) => FIRST + i);
  const inWindow = (iso, y, lo, hi) => iso.startsWith(`${y}-`) && iso.slice(5) >= lo && iso.slice(5) <= hi;
  ok(years.every((y) => inWindow(SPRING_FESTIVAL[y], y, '01-21', '02-20') && inWindow(MID_AUTUMN[y], y, '09-07', '10-08')),
    `every year ${FIRST} to ${LAST} has a Spring Festival from Jan 21 to Feb 20 and a Mid-Autumn from Sep 7 to Oct 8`);
  const py = readFileSync(join(ROOT, 'scripts', 'festivals.py'), 'utf8');
  const table = (name) => Object.fromEntries([...py.split(`${name} = {`)[1].split('}')[0].matchAll(/(\d{4}): "([\d-]+)"/g)].map((m) => [Number(m[1]), m[2]]));
  ok(same(table('SPRING_FESTIVAL'), SPRING_FESTIVAL) && same(table('MID_AUTUMN'), MID_AUTUMN),
    'scripts/festivals.py (the README images) has the same table as live/holidays.mjs');
  const python = spawnSync('python3', ['-c', `import sys, datetime as dt; sys.path.insert(0, 'scripts'); from festivals import festival_on
for s in ['2026-12-31', '2027-01-01', '2028-02-29', '2027-02-06', '2026-09-25']: print(s, festival_on(dt.date.fromisoformat(s)))`],
  { cwd: ROOT, encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  if (python.status === 0) {
    ok(python.stdout.trim() === '2026-12-31 None\n2027-01-01 new-year\n2028-02-29 None\n2027-02-06 spring-festival\n2026-09-25 mid-autumn',
      'festival_on() in Python agrees on the year end, the leap day and the festivals', python.stdout.trim());
  } else notes.push('python3 not found: the Python festival check was skipped');
}

// ---------------------------------------------------------------- 4. the nightly sky
console.log('-- scripts/sky_day.mjs: tonight\'s sky around the edges');
const tmp = mkdtempSync(join(tmpdir(), 'time-tests-'));
let runs = 0;
function sky(args, tz) {
  const out = join(tmp, `sky-${runs++}.json`);
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'sky_day.mjs'), ...args, '--out', out],
    { encoding: 'utf8', env: { ...process.env, ...(tz ? { TZ: tz } : {}) } });
  if (r.status !== 0) return { error: r.stderr.trim() || `exit ${r.status}` };
  const j = JSON.parse(readFileSync(out, 'utf8'));
  delete j.generatedAt;
  return j;
}
const local = (t) => A.zonedParts(t, TZ);
const isoDate = (p) => `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
const nextDay = (s) => new Date(Date.parse(`${s}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
const wallMin = (t) => { const p = local(t); return p.hour * 60 + p.minute; };
try {
  const RUNS = [
    ['2026-03-07', '2026-03-08', '2026-03-09'],
    ['2026-10-31', '2026-11-01', '2026-11-02'],
    ['2027-03-13', '2027-03-14', '2027-03-15'],
    ['2028-02-28', '2028-02-29', '2028-03-01'],
    ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'],
  ];
  const DST = new Set(['2026-03-08', '2026-11-01', '2027-03-14']);   // the clocks change in the night before
  for (const dates of RUNS) {
    const days = dates.map((d) => [d, sky(['--date', d])]);
    for (const [d, j] of days) {
      if (j.error) { ok(false, `sky_day --date ${d} runs`, j.error); continue; }
      const t = j.tonight;
      const set = local(t.sunset.ms), rise = local(t.sunrise.ms), chart = local(j.chart.at.ms);
      ok(j.date === d && isoDate(set) === d && set.hour >= 16 && set.hour <= 20 && isoDate(rise) === nextDay(d) && rise.hour >= 5 && rise.hour <= 8
        && isoDate(chart) === d && wallMin(j.chart.at.ms) >= 20 * 60 && j.chart.at.ms >= t.civilDusk.ms + 45 * MIN && j.chart.at.ms % (15 * MIN) === 0,
      `${d}: sunset that evening, sunrise the next morning, the chart at 8 PM or later on the quarter hour`,
      JSON.stringify({ date: j.date, sunset: t.sunset.en, sunrise: t.sunrise.en, chart: j.chart.at.en }));
    }
    for (let k = 1; k < days.length; k++) {
      const [d0, a] = days[k - 1];
      const [d1, b] = days[k];
      if (a.error || b.error) continue;
      const night = (j) => j.tonight.sunrise.ms - j.tonight.sunset.ms;
      const dNight = Math.abs(night(b) - night(a)) / MIN;
      const shift = wallMin(b.tonight.sunset.ms) - wallMin(a.tonight.sunset.ms);
      const dst = DST.has(d1) ? (d1.slice(5, 7) === '11' ? -60 : 60) : 0;
      const dLon = (((b.planets[2].lon - a.planets[2].lon) % 360) + 360) % 360;
      const dAge = (((b.moon.age - a.moon.age) % A.SYNODIC_MONTH) + A.SYNODIC_MONTH) % A.SYNODIC_MONTH;
      ok(dNight < 5 && Math.abs(shift - dst) <= 4 && dLon > 0.9 && dLon < 1.1 && dAge > 0.7 && dAge < 1.3,
        `${d0} -> ${d1}: the night changes by minutes, sunset's clock time by ${dst ? `${dst} min (DST)` : 'minutes'}, Earth and the Moon move one day`,
        JSON.stringify({ dNight: +dNight.toFixed(2), shift, dLon: +dLon.toFixed(3), dAge: +dAge.toFixed(2) }));
    }
  }
  for (const [at, date] of [['2026-03-08T06:59:00Z', '2026-03-08'], ['2026-03-08T07:00:00Z', '2026-03-08'],
    ['2026-11-01T05:30:00Z', '2026-11-01'], ['2026-11-01T06:30:00Z', '2026-11-01'], ['2027-01-01T04:59:00Z', '2026-12-31'],
    ['2027-01-01T05:00:00Z', '2027-01-01'], ['2028-02-29T05:00:00Z', '2028-02-29'], ['2028-03-01T04:59:00Z', '2028-02-29']]) {
    const j = sky(['--at', at], 'UTC');
    ok(!j.error && j.at === ms(at) && j.date === date && j.sun?.alt < 0, `--at ${at}: the night of ${date} in Albany, Sun below the horizon`,
      JSON.stringify(j.error || { at: j.at, date: j.date, sun: j.sun }));
  }
  // without a zone, --at is Albany's wall clock on any machine (before batch 6 it was the machine's)
  for (const [at, utc, why] of [['2026-11-13T22:55:07', '2026-11-14T03:55:07Z', 'an ordinary evening'],
    ['2026-03-08T02:30', '2026-03-08T07:30:00Z', 'the skipped hour counts as EST, so 3:30 AM EDT'],
    ['2026-11-01T01:30', '2026-11-01T05:30:00Z', 'the repeated hour: the first, EDT'],
    ['2026-11-01T01:30-05:00', '2026-11-01T06:30:00Z', 'with an offset: the second, EST']]) {
    const got = ['UTC', 'Asia/Shanghai', 'America/New_York'].map((tz) => sky(['--at', at], tz));
    ok(got.every((j) => !j.error && j.at === ms(utc)), `--at ${at} is ${utc} under TZ=UTC, Asia/Shanghai and New York (${why})`,
      JSON.stringify(got.map((j) => j.error || new Date(j.at).toISOString())));
  }
  const a = sky(['--date', '2026-11-01'], 'UTC');
  const b = sky(['--date', '2026-11-01'], 'Pacific/Auckland');
  ok(!a.error && same(a, b), '--date 2026-11-01 gives the same file under TZ=UTC and Pacific/Auckland');
  const bad = sky(['--date', '2027-02-29']);
  ok(bad.error && /not a calendar date/.test(bad.error), '--date 2027-02-29 is refused (2027 is not a leap year; before batch 6 it drew March 1 and called it February 29)', bad.error || 'accepted');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// ---------------------------------------------------------------- 5. outside these files: noted, not failed
const gap = A.zonedTime(2026, 3, 8, 2, 30, TZ);
if (gap !== ms('2026-03-08T07:30:00Z')) {
  notes.push(`live/astro.mjs zonedTime(2026-03-08 02:30) gives ${new Date(gap).toISOString()} (${A.zonedParts(gap, TZ).hour}:30 AM), not 3:30 AM EDT: `
    + 'in the skipped hour it goes back an hour (02:00 gives 1:00 AM, before 1:30 AM), unlike JavaScript dates, Python and '
    + 'scripts/sky_day.mjs. Only times typed into that hour are affected (the Sky app\'s date and time travel); 12 noon, 6 PM, '
    + '8 PM and midnight, which sky_day and tonight() use, are right.');
}

console.log(`\ntime_tests: ${pass} passed, ${failed.length} failed`);
for (const n of notes) console.log(`note: ${n}`);
if (failed.length) {
  console.log(`failed:\n  ${failed.join('\n  ')}`);
  process.exit(1);
}
