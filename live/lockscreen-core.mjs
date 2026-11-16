// Live banner: fills a template from scripts/lockscreen.py with the current Albany time.
// Runs anywhere with Intl (Vercel, Cloudflare Workers, Node 18+, browsers).
//
// GitHub shows README images through its camo proxy. With `Cache-Control: no-cache`, camo
// fetches a fresh copy on every page view, so the clock is right when the page opens.
// After that the SVG keeps ticking on its own: it holds the next `minutes` minutes and
// SMIL <set> switches them at the right second. A dot round the avatar ticks the seconds
// ({{BEGIN_SEC}} and {{SEC_DEG}}). The eight planets set off from where they really are at the
// request (heliocentric longitude λ from live/astro.mjs, {{ORBIT:<i>:<P>}} and {{ORBIT_DEG:<i>}})
// and then turn once every 12 to 110 seconds; only the start is real. The Moon rides beside
// Earth in today's phase ({{MOON_KF:…}}, {{MOON_DEG:…}}, {{MOON_PATH}}). Those turns are CSS
// animations that run only when the visitor has not asked for reduced motion (idea #16); each
// turning group also gets its angle at load, so with motion reduced it all stands still in the
// right place. The glow behind the avatar takes its colour from the Sun's altitude over Albany
// ({{SUN:…}}, idea #97), and festivals add a small touch (idea #150): opts.festival names the
// day's festival, opts.fest says how the date line shows it, {{MOON_GLOW:…}} lights the Moon on
// the Mid-Autumn Festival. A slot may occur several times.
import { planetLongitudes, moonPhase, moonPhasePath, observe } from './astro.mjs';

const fmtCache = new Map();

/** Albany's weekday, month, day, hour, minute, second and AM/PM for a Date (Intl parts). */
export function parts(date, timeZone) {
  let f = fmtCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone, weekday: 'long', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
    });
    fmtCache.set(timeZone, f);
  }
  const o = {};
  for (const p of f.formatToParts(date)) o[p.type] = p.value;
  // 24-hour copy for the planets
  o.h24 = (Number(o.hour) % 12) + (o.dayPeriod === 'PM' ? 12 : 0);
  return o;
}

const ymdCache = new Map();

/** The local calendar date of a Date as numbers: {y, m, d}. */
export function ymd(date, timeZone) {
  let f = ymdCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' });
    ymdCache.set(timeZone, f);
  }
  const o = {};
  for (const p of f.formatToParts(date)) o[p.type] = p.value;
  return { y: Number(o.year), m: Number(o.month), d: Number(o.day) };
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fillAll = (s, slot, value) => s.split(slot).join(value);
const n360 = (x) => ((x % 360) + 360) % 360;
// A planet's SMIL turn starts at 12 o'clock and runs counter-clockwise; the screen convention
// (shared with Pages) puts longitude 90 there, so a planet at λ is (λ - 90)/360 of a period in.
const begin = (period, angle) => `-${(period * n360(angle) / 360).toFixed(2)}s`;
const round1 = (x) => +x.toFixed(1);
// keyframe offsets with four decimals and numbers with at most two, as scripts/lockscreen.py writes them
const pct = (v) => String(+v.toFixed(4));
const num2 = (v) => String(+v.toFixed(2));

/** CSS keyframe stops for angles spread evenly over one turn (moon_frames() in lockscreen.py). */
export function moonFrames(keys) {
  const n = keys.length - 1;
  return keys.map((a, k) => `${pct((100 * k) / n)}%{transform:rotate(${num2(a)}deg)}`).join('');
}

/**
 * The colour for the Sun's altitude from a {{SUN:<default>;<limit>,<colour>;…;<top colour>}}
 * slot: the first colour whose limit is above the altitude, else the top one; the default
 * when the altitude is unknown.
 */
export function sunColour(spec, alt) {
  const parts = spec.split(';');
  if (alt == null || Number.isNaN(alt)) return parts[0];
  for (const tier of parts.slice(1, -1)) {
    const [limit, colour] = tier.split(',');
    if (alt < Number(limit)) return colour;
  }
  return parts[parts.length - 1];
}

/** A festival's touch after the date (fest_tspan() in scripts/lockscreen.py writes the same). */
export function festTspan(look) {
  if (!look) return '';
  return `<tspan fill="${look.fill}"${look.size ? ` font-size="${look.size}"` : ''}>${esc(look.text)}</tspan>`;
}

/**
 * Screen angles (SVG degrees) of the Moon's direction from Earth through one Earth orbit,
 * starting at Earth's longitude: the plane direction λ_E + 180° + E, squashed and tilted like
 * Earth's ring (rx, ry, tilt), so a new Moon points at the avatar and a quarter Moon along
 * Earth's path. Unwrapped for SMIL. Same as moon_keys() in scripts/lockscreen.py.
 */
export function moonKeys(lonE, elong, rx, ry, tilt, n = 48) {
  const t = (tilt * Math.PI) / 180;
  const out = [];
  let prev = null;
  for (let k = 0; k <= n; k++) {
    const phi = ((lonE + (360 * k) / n + 180 + elong) * Math.PI) / 180;
    const dx = rx * Math.cos(phi), dy = -ry * Math.sin(phi);
    let a = (Math.atan2(dx * Math.sin(t) + dy * Math.cos(t), dx * Math.cos(t) - dy * Math.sin(t)) * 180) / Math.PI;
    if (prev !== null) a += 360 * Math.round((prev - a) / 360);
    out.push(round1(a));
    prev = a;
  }
  return out;
}

/**
 * @param {string} template  banner template (see templates.json)
 * @param {object} opts      usually the template's entry in templates.json `meta`, plus:
 *   images       {name: dataURI}  shared images referenced as {{IMG:name}}
 *   now          Date or ms (default: now)
 *   timeZone     (default America/New_York)
 *   minutes      how long the clock keeps ticking after load (default 120)
 *   weather      optional short label shown after the date, e.g. "☁︎ 41°F"
 *   muted        colour of the AM/PM label and the weather
 *   mutedOpacity its opacity (optional)
 *   apSize, apWeight, apSpacing, apDx   look of the AM/PM label
 *   wxWeight     font weight of the weather label; wxSep goes between date and weather (" · ")
 *   place        {lat, lon} for the Sun's altitude ({{SUN:…}}); without it the slot's default colour
 *   festival     (y, m, d) => 'new-year' | 'spring-festival' | 'mid-autumn' | null, e.g. festivalOn
 *                from live/holidays.mjs; without it no festival touches
 *   fest         {festival: {text, fill, size?}}: what the date line adds on that festival
 */
export function renderLive(template, opts = {}) {
  const timeZone = opts.timeZone || 'America/New_York';
  const now = opts.now != null ? new Date(opts.now) : new Date();
  const minutes = Math.max(1, Math.min(opts.minutes || 120, 600));
  const muted = opts.muted || '#a4a9b3';
  const mutedOp = opts.mutedOpacity != null ? ` fill-opacity="${opts.mutedOpacity}"` : '';
  const ap = `font-size="${opts.apSize ?? 26}" font-weight="${opts.apWeight ?? 600}" `
    + `letter-spacing="${opts.apSpacing ?? 0}" dx="${opts.apDx ?? 12}" fill="${muted}"${mutedOp}`;
  const p0 = parts(now, timeZone);
  const sec = Number(p0.second);

  let time = '';
  let date = '';
  let lastDate = null;
  let lastFest = null;
  let dateStart = 0;
  const dates = [];
  const festivalOf = (t) => {
    if (typeof opts.festival !== 'function') return null;
    const { y, m, d } = ymd(t, timeZone);
    return opts.festival(y, m, d) || null;
  };
  for (let k = 0; k < minutes; k++) {
    const startOfMinute = new Date(now.getTime() + (k * 60 - sec) * 1000);
    const q = parts(startOfMinute, timeZone);
    const show = k === 0 ? 0 : k * 60 - sec;          // seconds after the image loads
    const hide = (k + 1) * 60 - sec;
    const on = k === 0 ? '' : `<set attributeName="visibility" to="visible" begin="${show}s"/>`;
    const off = k < minutes - 1 ? `<set attributeName="visibility" to="hidden" begin="${hide}s"/>` : '';
    time += `<text x="0" y="0" visibility="${k === 0 ? 'visible' : 'hidden'}">${q.hour}:${q.minute}`
      + `<tspan ${ap}>${q.dayPeriod}</tspan>${on}${off}</text>`;
    const d = `${q.weekday}, ${q.month} ${q.day}`;
    if (d !== lastDate) {
      if (lastDate !== null) dates.push([lastDate, dateStart, show, lastFest]);
      lastDate = d;
      dateStart = show;
      lastFest = festivalOf(startOfMinute);
    }
  }
  dates.push([lastDate, dateStart, null, lastFest]);
  const wx = opts.weather
    ? `<tspan fill="${muted}"${mutedOp} font-weight="${opts.wxWeight ?? 500}">${esc((opts.wxSep ?? ' · ') + opts.weather)}</tspan>` : '';
  for (const [d, from, to, fest] of dates) {
    const on = from === 0 ? '' : `<set attributeName="visibility" to="visible" begin="${from}s"/>`;
    const off = to == null ? '' : `<set attributeName="visibility" to="hidden" begin="${to}s"/>`;
    const touch = fest && opts.fest ? festTspan(opts.fest[fest]) : '';
    date += `<text x="0" y="0" visibility="${from === 0 ? 'visible' : 'hidden'}">${esc(d)}${touch}${wx}${on}${off}</text>`;
  }

  const sMin = Number(p0.minute) * 60 + sec;
  const sHour = (p0.h24 % 12) * 3600 + sMin;
  const unix = now.getTime() / 1000;              // Albany's seconds are Unix seconds mod 60
  let svg = template.replace('<!--TIME-->', time).replace('<!--DATE-->', date);
  svg = fillAll(svg, '{{BEGIN_MIN}}', `-${sMin}s`);  // slots of older templates
  svg = fillAll(svg, '{{BEGIN_HOUR}}', `-${sHour}s`);
  const secLead = (unix % 60).toFixed(2);
  svg = fillAll(svg, '{{BEGIN_SEC}}', `-${secLead}s`);
  svg = fillAll(svg, '{{SEC_DEG}}', num2(6 * Number(secLead)));
  svg = svg.replace(/\{\{PHASE:(\d+(?:\.\d+)?)\}\}/g, (m, period) => `-${(unix % Number(period)).toFixed(2)}s`);  // older templates
  if (svg.includes('{{SUN:')) {
    const pl = opts.place;
    const alt = pl && Number.isFinite(pl.lat) && Number.isFinite(pl.lon) ? observe('sun', now, pl.lat, pl.lon).alt : null;
    svg = svg.replace(/\{\{SUN:([^}]*)\}\}/g, (m, spec) => sunColour(spec, alt));
  }
  if (svg.includes('{{MOON_GLOW:')) {
    const glow = festivalOf(now) === 'mid-autumn';
    svg = svg.replace(/\{\{MOON_GLOW:([\d.]+)\}\}/g, (m, op) => (glow ? op : '0'));
  }
  if (/\{\{(ORBIT|MOON)/.test(svg)) {
    const lon = planetLongitudes(now);                 // Mercury → Neptune, degrees
    const mp = moonPhase(now);                         // elong: 0 new, 90 first quarter, 180 full
    const PERIODS_BY_SLOT = new Map();
    svg = svg.replace(/\{\{ORBIT:(\d+):(\d+(?:\.\d+)?)\}\}/g, (m, i, period) => {
      PERIODS_BY_SLOT.set(Number(i), Number(period));
      return begin(Number(period), lon[Number(i)] - 90);
    });
    // the angle each planet's turn has reached at load: where it stands when motion is reduced
    // (from the same rounded lead as begin(), so the still picture and the moving one agree)
    svg = svg.replace(/\{\{ORBIT_DEG:(\d+)\}\}/g, (m, i) => {
      const P = PERIODS_BY_SLOT.get(Number(i));
      return P ? num2((360 * Number((P * n360(lon[Number(i)] - 90) / 360).toFixed(2))) / P) : num2(n360(lon[Number(i)] - 90));
    });
    // the Moon's turn round Earth as CSS keyframes, and its angle at load
    const keysFor = new Map();
    const keys = (rx, ry, tilt) => {
      const k = `${rx}:${ry}:${tilt}`;
      if (!keysFor.has(k)) keysFor.set(k, moonKeys(lon[2], mp.elong, Number(rx), Number(ry), Number(tilt)));
      return keysFor.get(k);
    };
    svg = svg.replace(/\{\{MOON_(KF|DEG):(ROT|UNROT):(\d+(?:\.\d+)?):(\d+(?:\.\d+)?):(-?\d+(?:\.\d+)?)\}\}/g,
      (m, what, kind, rx, ry, tilt) => {
        const ks = keys(rx, ry, tilt).map((a) => (kind === 'ROT' ? a : -a));
        return what === 'KF' ? moonFrames(ks) : num2(ks[0]);
      });
    // the Moon's direction from Earth is λ_Earth + 180° + E, seen through Earth's squashed, tilted ring
    svg = svg.replace(/\{\{MOON_(ROT|UNROT):(\d+(?:\.\d+)?):(\d+(?:\.\d+)?):(-?\d+(?:\.\d+)?)\}\}/g,
      (m, kind, rx, ry, tilt) => moonKeys(lon[2], mp.elong, Number(rx), Number(ry), Number(tilt))
        .map((a) => round1(kind === 'ROT' ? a : -a)).join(';'));
    svg = fillAll(svg, '{{MOON_PATH}}', moonPhasePath(0, 0, 1, mp.illum, mp.waxing));
  }
  if (opts.images) {
    svg = svg.replace(/\{\{IMG:([\w.-]+)\}\}/g, (m, name) => opts.images[name] || '');
  }
  // the accessible label gets the time too
  svg = svg.replace(/aria-label="([^"]*)"/, (m, label) =>
    `aria-label="${label} Local time ${p0.hour}:${p0.minute} ${p0.dayPeriod}, ${p0.weekday}, ${p0.month} ${p0.day}."`);
  return svg;
}

// Weather codes from Open-Meteo (WMO) to a short text-style symbol.
export function weatherLabel(code, tempF) {
  const c = Number(code);
  const sym = c === 0 ? '☀︎' : c <= 3 ? '☁︎' : c <= 48 ? '≋' : c <= 67 || (c >= 80 && c <= 82) ? '☂︎'
    : c <= 77 || c === 85 || c === 86 ? '❄︎' : '☈';
  return `${sym} ${Math.round(tempF)}°F`;
}
