// Checks live/astro.mjs against JPL Horizons reference values (scripts/astro-reference.json,
// fetched once from the public Horizons API; no network needed to run this).
//   node scripts/check_astro.mjs        → prints a table, exits 1 if anything is off
import { readFileSync } from 'node:fs';
import * as A from '../live/astro.mjs';

const ref = JSON.parse(readFileSync(new URL('./astro-reference.json', import.meta.url), 'utf8'));
const msOf = (jd) => (jd - 2440587.5) * 86400000;
const dAng = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
let bad = 0;
const row = (label, err, limit, unit = '°') => {
  const ok = err <= limit;
  if (!ok) bad++;
  console.log(`${ok ? 'ok ' : 'BAD'}  ${label.padEnd(44)} max ${err.toFixed(3)}${unit}  (limit ${limit}${unit})`);
};

// 1. heliocentric longitudes of the planets, 8 dates from 1990 to 2049
for (const name of A.PLANETS) {
  let e = 0, el = 0;
  ref.jd.forEach((jd, k) => {
    const h = A.heliocentric(name, msOf(jd));
    e = Math.max(e, dAng(h.lon, ref.helio[name][k][0]));
    el = Math.max(el, Math.abs(h.lat - ref.helio[name][k][1]));
  });
  // Table 1 leaves out the Jupiter-Saturn "great inequality", so those two drift by ~0.15°.
  row(`heliocentric longitude · ${name}`, e, name === 'jupiter' || name === 'saturn' ? 0.2 : 0.05);
  row(`heliocentric latitude  · ${name}`, el, 0.05);
}
// 2. the Sun and the Moon from Earth's centre (J2000 frame)
{
  let es = 0, em = 0, eb = 0, ed = 0;
  ref.jd.forEach((jd, k) => {
    const t = msOf(jd);
    es = Math.max(es, dAng(A.sun(t).lonJ2000, ref.geo.sun[k][0]));
    const m = A.moon(t);
    em = Math.max(em, dAng(m.lonJ2000, ref.geo.moon[k][0]));
    eb = Math.max(eb, Math.abs(m.latJ2000 - ref.geo.moon[k][1]));
    ed = Math.max(ed, Math.abs(m.distKm - ref.geo.moon[k][2]));
  });
  row('Sun longitude (geocentric)', es, 0.02);
  row('Moon longitude (geocentric)', em, 0.5);
  row('Moon latitude (geocentric)', eb, 0.3);
  row('Moon distance', ed, 600, ' km');
}
// 3. altitude and azimuth for observers in Greenwich, Beijing and Sydney
for (const [site, s] of Object.entries(ref.topo)) {
  for (const name of ['sun', 'moon', 'jupiter', 'saturn', 'venus']) {
    let ea = 0, ez = 0;
    ref.topoJd.forEach((jd, k) => {
      const o = A.observe(name, msOf(jd), s.lat, s.lon);
      const [az, alt] = s[name][k];
      ea = Math.max(ea, Math.abs(o.alt - alt));
      if (alt > -80 && alt < 80) ez = Math.max(ez, dAng(o.az, az) * Math.cos(alt * Math.PI / 180));
    });
    row(`altitude/azimuth · ${site} · ${name}`, Math.max(ea, ez), name === 'moon' ? 0.5 : 0.15);
  }
}
// 4. rise and set times in Greenwich at sea level, 13 to 17 Nov 2026 (Horizons: true visual
//    horizon with refraction; Horizons rounds to the minute)
{
  const mon = { Nov: 10 };
  const parse = (s) => { const m = s.match(/(\d+)-(\w+)-(\d+) (\d+):(\d+)/); return Date.UTC(+m[1], mon[m[2]], +m[3], +m[4], +m[5]); };
  for (const name of ['sun', 'moon', 'jupiter']) {
    const want = ref.rts[name].filter((e) => e[2] === 'r' || e[2] === 's').map((e) => ({ t: parse(e[0]), rising: e[2] === 'r' }));
    const got = A.riseSet(name, Date.UTC(2026, 10, 13), Date.UTC(2026, 10, 17), 51.4769, 0);
    let e = 0, missing = 0;
    for (const w of want) {
      const g = got.filter((x) => x.rising === w.rising).sort((a, b) => Math.abs(a.t - w.t) - Math.abs(b.t - w.t))[0];
      if (!g || Math.abs(g.t - w.t) > 3600000) { missing++; continue; }
      e = Math.max(e, Math.abs(g.t - w.t) / 60000);
    }
    row(`rise/set · Greenwich · ${name} (${want.length} events${missing ? `, ${missing} unmatched` : ''})`, e, 3, ' min');
    if (missing) bad++;
  }
}
// 5. Moon phases near known eclipses (new Moon: 17 Feb and 12 Aug 2026; full: 3 Mar and 28 Aug 2026)
{
  const cases = [['new', Date.UTC(2026, 1, 17, 12, 1), 0], ['new', Date.UTC(2026, 7, 12, 17, 37), 0],
    ['full', Date.UTC(2026, 2, 3, 11, 38), 180], ['full', Date.UTC(2026, 7, 28, 4, 18), 180]];
  let e = 0;
  for (const [, t, target] of cases) {
    const found = A.nextPhase(t - 5 * 86400000, target);
    e = Math.max(e, Math.abs(found - t) / 3600000);
  }
  row('new/full Moon times at the 2026 eclipses', e, 1.5, ' h');
}
console.log(bad ? `\n${bad} check(s) failed` : '\nall astronomy checks passed');
process.exit(bad ? 1 : 0);
