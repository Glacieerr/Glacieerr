// Offline astronomy for the banner, the "tonight's sky" widget and the Pages sky app.
// No network, no dependencies; runs in Node 18+, Vercel, Cloudflare Workers and browsers.
//
//   heliocentric(name, t), planetLongitudes(t)   where the eight planets really are   (idea #79)
//   sun(t), moon(t), moonPhase(t), nextPhase(t)  the Moon beside Earth                (idea #80)
//   observe(name, t, lat, lon)                    altitude and azimuth for an observer
//   riseSet(), sunEvents(), tonight()             sunset, darkness, the Moon, visible planets (#83)
//   skyScene(t, lat, lon, data)                   everything the sky chart draws
//
// Accuracy, checked against JPL Horizons by scripts/check_astro.mjs:
//   planets within 0.15° (Jupiter and Saturn; the others within 0.02°; JPL approximate
//   elements, valid 1800 to 2050), Sun about 0.01°,
//   Moon about 0.3°, rise and set times within about two minutes. Fine for pictures,
//   not for navigation.
//
// Conventions: angles in degrees; t is a Date or Unix milliseconds. Ecliptic longitudes are
// counted from the March equinox eastward, i.e. counter-clockwise seen from the north.

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const sind = (x) => Math.sin(x * D2R);
const cosd = (x) => Math.cos(x * D2R);
const clamp1 = (x) => Math.max(-1, Math.min(1, x));
export const norm360 = (x) => ((x % 360) + 360) % 360;
const norm180 = (x) => { const y = norm360(x); return y > 180 ? y - 360 : y; };

const DT_DAYS = 69 / 86400;          // TT − UT, about 69 s in the 2020s
const PREC = 1.396971;               // general precession in longitude, degrees per century
const AU_KM = 149597870.7;
const toMs = (t) => (t instanceof Date ? t.getTime() : Number(t));

/** Julian day (UT) of a Date or Unix milliseconds. */
export const julianDay = (t) => toMs(t) / 86400000 + 2440587.5;
/** Julian centuries of TT since J2000.0. */
const centuries = (t) => (julianDay(t) + DT_DAYS - 2451545.0) / 36525;
const obliquity = (T) => 23.43928 - 0.0130042 * T;

export const PLANETS = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

// JPL "Keplerian Elements for Approximate Positions of the Major Planets", table 1
// (E. M. Standish), mean ecliptic and equinox of J2000, valid 1800 to 2050:
// a (au), e, I, L, long. perihelion, long. node (deg); then their rates per Julian century.
// "earth" is the Earth-Moon barycentre (off from Earth by under 0.002° as seen from the Sun).
const ELEMENTS = {
  mercury: [0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593,
    0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
  venus: [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255,
    0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418],
  earth: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0,
    0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0],
  mars: [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891,
    0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
  jupiter: [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909,
    -0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
  saturn: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448,
    -0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
  uranus: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503,
    -0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589],
  neptune: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574,
    0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664],
};

/** Eccentric anomaly (radians) for mean anomaly M (degrees). */
function kepler(M, e) {
  const m = norm180(M) * D2R;
  let E = m + e * Math.sin(m);
  for (let i = 0; i < 15; i++) {
    const d = (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  return E;
}

/**
 * Heliocentric position of a planet: J2000 ecliptic x, y, z (au), distance r,
 * ecliptic longitude lon and latitude lat (degrees).
 */
export function heliocentric(name, t) {
  const el = ELEMENTS[name];
  if (!el) throw new Error(`unknown planet ${name}`);
  const T = centuries(t);
  const a = el[0] + el[6] * T;
  const e = el[1] + el[7] * T;
  const I = el[2] + el[8] * T;
  const L = el[3] + el[9] * T;
  const peri = el[4] + el[10] * T;
  const node = el[5] + el[11] * T;
  const w = peri - node;
  const E = kepler(L - peri, e);
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = cosd(w), sw = sind(w), cO = cosd(node), sO = sind(node), cI = cosd(I), sI = sind(I);
  const x = (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp;
  const y = (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp;
  const z = sw * sI * xp + cw * sI * yp;
  const r = Math.hypot(x, y, z);
  return { name, x, y, z, r, lon: norm360(Math.atan2(y, x) * R2D), lat: Math.asin(z / r) * R2D };
}

/** Heliocentric ecliptic longitudes (J2000, degrees) of the eight planets, Mercury → Neptune. */
export const planetLongitudes = (t) => PLANETS.map((p) => heliocentric(p, t).lon);

/** Ecliptic (lon, lat) → equatorial (ra, dec), all degrees. */
export function eclToEq(lon, lat, eps = 23.43928) {
  const l = lon * D2R, b = lat * D2R, e = eps * D2R;
  const x = Math.cos(b) * Math.cos(l);
  const y = Math.cos(b) * Math.sin(l) * Math.cos(e) - Math.sin(b) * Math.sin(e);
  const z = Math.cos(b) * Math.sin(l) * Math.sin(e) + Math.sin(b) * Math.cos(e);
  return { ra: norm360(Math.atan2(y, x) * R2D), dec: Math.asin(clamp1(z)) * R2D };
}

/** Equatorial (ra, dec) → ecliptic (lon, lat), all degrees. */
export function eqToEcl(ra, dec, eps = 23.43928) {
  const a = ra * D2R, d = dec * D2R, e = eps * D2R;
  const lon = Math.atan2(Math.sin(a) * Math.cos(e) + Math.tan(d) * Math.sin(e), Math.cos(a));
  const lat = Math.asin(clamp1(Math.sin(d) * Math.cos(e) - Math.cos(d) * Math.sin(e) * Math.sin(a)));
  return { lon: norm360(lon * R2D), lat: lat * R2D };
}

/** J2000 RA/Dec (e.g. a catalogue star) → RA/Dec of the date, via a shift along the ecliptic. */
export function precess(ra, dec, t) {
  const T = centuries(t);
  const ec = eqToEcl(ra, dec, 23.43928);
  return eclToEq(ec.lon + PREC * T, ec.lat, obliquity(T));
}

// Visual magnitudes (Meeus, Astronomical Algorithms ch. 41). Saturn's rings are left out.
function magnitude(name, r, d, i) {
  const k = 5 * Math.log10(r * d);
  switch (name) {
    case 'mercury': return -0.42 + k + 0.0380 * i - 0.000273 * i * i + 0.000002 * i * i * i;
    case 'venus': return -4.40 + k + 0.0009 * i + 0.000239 * i * i - 0.00000065 * i * i * i;
    case 'mars': return -1.52 + k + 0.016 * i;
    case 'jupiter': return -9.40 + k + 0.005 * i;
    case 'saturn': return -8.88 + k;
    case 'uranus': return -7.19 + k;
    case 'neptune': return -6.87 + k;
    default: return null;
  }
}

/**
 * A planet as seen from Earth's centre: ecliptic lon/lat and RA/Dec of the date, distance
 * (au), phase angle, elongation from the Sun, illuminated fraction and magnitude.
 * lonJ2000/latJ2000 are the same direction in the J2000 frame (for checks).
 */
export function geocentric(name, t) {
  const p = heliocentric(name, t);
  const e = heliocentric('earth', t);
  const x = p.x - e.x, y = p.y - e.y, z = p.z - e.z;
  const dist = Math.hypot(x, y, z);
  const T = centuries(t);
  const lonJ2000 = norm360(Math.atan2(y, x) * R2D);
  const lat = Math.asin(z / dist) * R2D;
  const lon = norm360(lonJ2000 + PREC * T);
  const r = p.r, R = e.r;
  const phaseAngle = Math.acos(clamp1((r * r + dist * dist - R * R) / (2 * r * dist))) * R2D;
  const elong = Math.acos(clamp1((R * R + dist * dist - r * r) / (2 * R * dist))) * R2D;
  return {
    name, lon, lat, lonJ2000, latJ2000: lat, dist, r, phaseAngle, elong,
    illum: (1 + cosd(phaseAngle)) / 2, mag: magnitude(name, r, dist, phaseAngle),
    ...eclToEq(lon, lat, obliquity(T)),
  };
}

/** The Sun from Earth's centre: apparent longitude of the date, RA/Dec, distance (au). */
export function sun(t) {
  const e = heliocentric('earth', t);
  const T = centuries(t);
  const lonJ2000 = norm360(Math.atan2(-e.y, -e.x) * R2D);
  const lat = Math.asin(-e.z / e.r) * R2D;
  const lon = norm360(lonJ2000 + PREC * T - 0.00569);  // − 20.5″ annual aberration
  return { name: 'sun', lon, lat, lonJ2000, dist: e.r, ...eclToEq(lon, lat, obliquity(T)) };
}

/**
 * The Moon from Earth's centre (Astronomical Almanac low-precision formulae, about 0.3°):
 * ecliptic lon/lat of the date, RA/Dec, horizontal parallax (deg) and distance (km).
 */
export function moon(t) {
  const T = centuries(t);
  const lon = norm360(218.32 + 481267.881 * T
    + 6.29 * sind(135.0 + 477198.87 * T) - 1.27 * sind(259.3 - 413335.36 * T)
    + 0.66 * sind(235.7 + 890534.22 * T) + 0.21 * sind(269.9 + 954397.74 * T)
    - 0.19 * sind(357.5 + 35999.05 * T) - 0.11 * sind(186.5 + 966404.03 * T));
  const lat = 5.13 * sind(93.3 + 483202.02 * T) + 0.28 * sind(228.2 + 960400.89 * T)
    - 0.28 * sind(318.3 + 6003.15 * T) - 0.17 * sind(217.6 - 407332.21 * T);
  const parallax = 0.9508 + 0.0518 * cosd(135.0 + 477198.87 * T) + 0.0095 * cosd(259.3 - 413335.36 * T)
    + 0.0078 * cosd(235.7 + 890534.22 * T) + 0.0028 * cosd(269.9 + 954397.74 * T);
  return {
    name: 'moon', lon, lat, lonJ2000: norm360(lon - PREC * T), latJ2000: lat,
    parallax, distKm: 6378.14 / sind(parallax), ...eclToEq(lon, lat, obliquity(T)),
  };
}

export const SYNODIC_MONTH = 29.530588853;
const PHASE_KEYS = ['new', 'waxing-crescent', 'first-quarter', 'waxing-gibbous',
  'full', 'waning-gibbous', 'last-quarter', 'waning-crescent'];
export const PHASE_NAMES = {
  en: ['New Moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous',
    'Full Moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'],
  zh: ['新月', '蛾眉月', '上弦月', '盈凸月', '满月', '亏凸月', '下弦月', '残月'],
};

/**
 * Today's Moon phase. elong: Moon minus Sun longitude, 0 = new, 90 = first quarter,
 * 180 = full, 270 = last quarter. illum: lit fraction of the disc. age: days since new
 * (approximate). index/key/phaseName: one of eight named phases; new, the quarters and full are
 * used within about 12 hours of the exact moment, crescent or gibbous the rest of the time.
 */
export function moonPhase(t) {
  const s = sun(t), m = moon(t);
  const elong = norm360(m.lon - s.lon);
  const psi = Math.acos(clamp1(cosd(m.lat) * cosd(m.lon - s.lon))) * R2D;
  const R = s.dist * AU_KM;
  const i = Math.atan2(R * sind(psi), m.distKm - R * cosd(psi)) * R2D;   // phase angle
  // New, first quarter, full and last quarter are moments; like most almanacs, name them only
  // within about 12 hours of the moment (the elongation moves ~12.2° a day), otherwise say
  // crescent or gibbous.
  const near = (c) => Math.abs(norm180(elong - c)) < 6.1;
  const index = near(0) ? 0 : near(90) ? 2 : near(180) ? 4 : near(270) ? 6
    : elong < 90 ? 1 : elong < 180 ? 3 : elong < 270 ? 5 : 7;
  return {
    elong, phaseAngle: i, illum: (1 + cosd(i)) / 2, waxing: elong < 180,
    age: (elong / 360) * SYNODIC_MONTH, index, key: PHASE_KEYS[index],
    phaseName: { en: PHASE_NAMES.en[index], zh: PHASE_NAMES.zh[index] },
  };
}

/** The next moment (ms) after t when the elongation reaches `target` (0 new, 90, 180 full, 270). */
export function nextPhase(t, target) {
  let ms = toMs(t);
  let el = moonPhase(ms).elong;
  ms += (norm360(target - el) || 360) / 12.1907 * 86400000;
  for (let k = 0; k < 6; k++) {
    el = moonPhase(ms).elong;
    const d = norm180(target - el);
    if (Math.abs(d) < 1e-4) break;
    ms += d / 12.1907 * 86400000;
  }
  return ms;
}

/**
 * SVG path of the lit part of a Moon disc of radius r at (cx, cy), as seen with north up
 * from the northern hemisphere (waxing: lit on the right). Pass southern=true to mirror it.
 * Returns '' near new Moon; draw the dark disc underneath.
 */
export function moonPhasePath(cx, cy, r, illum, waxing, southern = false) {
  const k = Math.max(0, Math.min(1, illum));
  if (k < 0.005) return '';
  const f = (v) => +v.toFixed(3);
  if (k > 0.995) return `M${f(cx)},${f(cy - r)}A${f(r)},${f(r)} 0 1 1 ${f(cx)},${f(cy + r)}A${f(r)},${f(r)} 0 1 1 ${f(cx)},${f(cy - r)}Z`;
  const right = waxing !== southern;                 // lit limb on the right?
  const a = r * Math.abs(1 - 2 * k);                 // terminator's half-width
  const limb = right ? 1 : 0;                        // top → bottom along the lit limb
  // crescent: terminator bulges toward the lit limb; gibbous: away from it
  const term = (k < 0.5) === right ? 0 : 1;
  return `M${f(cx)},${f(cy - r)}A${f(r)},${f(r)} 0 0 ${limb} ${f(cx)},${f(cy + r)}`
    + `A${f(a)},${f(r)} 0 0 ${term} ${f(cx)},${f(cy - r)}Z`;
}

/** Greenwich mean sidereal time, degrees. */
export function gmst(t) {
  const jd = julianDay(t);
  const T = (jd - 2451545.0) / 36525;
  return norm360(280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - T * T * T / 38710000);
}

/** RA/Dec of the date → altitude and azimuth (from north through east) for an observer. */
export function altAz(ra, dec, t, lat, lon) {
  const H = (gmst(t) + lon - ra) * D2R;
  const p = lat * D2R, d = dec * D2R;
  const alt = Math.asin(clamp1(Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(H))) * R2D;
  const az = norm360(Math.atan2(-Math.cos(d) * Math.sin(H),
    Math.sin(d) * Math.cos(p) - Math.cos(d) * Math.sin(p) * Math.cos(H)) * R2D);
  return { alt, az };
}

/** RA/Dec of the date for 'sun', 'moon' or a planet (with its other fields). */
export function body(name, t) {
  if (name === 'sun') return sun(t);
  if (name === 'moon') return moon(t);
  return geocentric(name, t);
}

/** A body for an observer: its fields plus alt/az (the Moon's altitude is topocentric). */
export function observe(name, t, lat, lon) {
  const b = body(name, t);
  const h = altAz(b.ra, b.dec, t, lat, lon);
  if (name === 'moon') h.alt -= b.parallax * cosd(h.alt);
  return { ...b, alt: h.alt, az: h.az };
}

// Altitude of the centre at rise/set (refraction and, for the Sun and Moon, semi-diameter).
export const HORIZON = { sun: -0.833, moon: -0.833, planet: -0.567, civil: -6, nautical: -12, astronomical: -18 };

/** Moments when f(t) crosses zero between t0 and t1 (ms): [{t, rising}]. */
function crossings(f, t0, t1, stepMin = 10) {
  const out = [];
  const step = stepMin * 60000;
  let ta = t0, fa = f(ta);
  for (let tb = t0 + step; ta < t1; tb = Math.min(tb + step, t1)) {
    const fb = f(tb);
    if ((fa < 0) !== (fb < 0)) {
      let lo = ta, hi = tb, flo = fa;
      for (let i = 0; i < 22; i++) {
        const mid = (lo + hi) / 2, fm = f(mid);
        if ((fm < 0) === (flo < 0)) { lo = mid; flo = fm; } else hi = mid;
      }
      out.push({ t: Math.round((lo + hi) / 2), rising: fa < 0 });
    }
    ta = tb; fa = fb;
    if (tb >= t1) break;
  }
  return out;
}

/** Rise and set moments (ms) of a body between t0 and t1, at altitude h0 (default per body). */
export function riseSet(name, t0, t1, lat, lon, h0) {
  const h = h0 ?? (name === 'sun' ? HORIZON.sun : name === 'moon' ? HORIZON.moon : HORIZON.planet);
  return crossings((t) => observe(name, t, lat, lon).alt - h, toMs(t0), toMs(t1));
}

/** Sunset, dusks, dawns and sunrise between t0 and t1 (ms), as {name: ms}. */
export function sunEvents(t0, t1, lat, lon) {
  const ev = {};
  const pairs = [['sun', 'sunrise', 'sunset'], ['civil', 'civilDawn', 'civilDusk'],
    ['nautical', 'nauticalDawn', 'nauticalDusk'], ['astronomical', 'astroDawn', 'astroDusk']];
  for (const [k, up, down] of pairs) {
    for (const c of riseSet('sun', t0, t1, lat, lon, HORIZON[k])) {
      const key = c.rising ? up : down;
      if (ev[key] == null) ev[key] = c.t;
    }
  }
  return ev;
}

// ---- time zones (Intl only) ----
const dtfCache = new Map();
/** Wall-clock parts of an instant in a time zone: {year, month, day, hour, minute, second, weekday}. */
export function zonedParts(t, timeZone) {
  let f = dtfCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', weekday: 'short', year: 'numeric', month: 'numeric',
      day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
    });
    dtfCache.set(timeZone, f);
  }
  const o = {};
  for (const p of f.formatToParts(new Date(toMs(t)))) {
    if (p.type === 'weekday') o.weekday = p.value;
    else if (p.type !== 'literal') o[p.type] = Number(p.value);
  }
  if (o.hour === 24) o.hour = 0;
  return o;
}
/** Minutes the zone is ahead of UTC at instant t. */
export function tzOffsetMin(t, timeZone) {
  const ms = toMs(t);
  const p = zonedParts(ms, timeZone);
  return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000) / 60000;
}
/** UTC ms of a wall-clock time in a zone (day may overflow; Date.UTC normalises it). A time
 *  the clocks skip when they spring forward is read with the offset in force before the jump,
 *  so it lands as far after the gap as it was into it (02:30 on a night that jumps from 02:00 to
 *  03:00 becomes 03:30); a time that happens twice when they fall back is its first occurrence.
 *  R3.3 batch 6 (#177): the wall time is read with the offsets a day either side, so the rule
 *  holds east of Greenwich too (before, 01:30 on London's or 02:30 on Sydney's night of falling
 *  back came out as the second occurrence: the search started after the change there). */
export function zonedTime(y, m, d, hh, mm, timeZone) {
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  const offMs = (t) => Math.round(tzOffsetMin(t, timeZone) * 60000);
  const early = wall - offMs(wall - 86400000);
  const late = wall - offMs(wall + 86400000);
  const reads = (t) => t + offMs(t) === wall;
  if (reads(early)) return reads(late) ? Math.min(early, late) : early;
  if (reads(late)) return late;
  // no instant has this wall time: read it with the offset from before the jump
  return early;
}

const COMPASS = { en: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'], zh: ['北', '东北', '东', '东南', '南', '西南', '西', '西北'] };
/** Eight-point compass name for an azimuth. */
export const compass = (az, lang = 'en') => (COMPASS[lang] || COMPASS.en)[Math.round(norm360(az) / 45) % 8];

/**
 * Tonight for an observer: the night that contains t if it is before local noon, otherwise
 * the coming night. Returns times as Unix ms (null when an event does not happen), the Moon,
 * and one entry per planet with when and where to look.
 *   darkness: 'normal' | 'polar' (dark all day) | 'none' (the Sun never gets below −6°)
 *   sunState: 'normal' | 'polar-night' (no sunrise) | 'midnight-sun' (no sunset)
 *   moon.rise/set may be null: then moon.altAtMidnight tells whether it is up all night
 *   planets[i]: {name, mag, visible, naked, best, bestAlt, bestAz, rise, set, when}
 *   when: 'evening' | 'morning' | 'night' (most of the night) | null (not up in the dark)
 */
export function tonight(t, lat, lon, timeZone) {
  const ms = toMs(t);
  const p = zonedParts(ms, timeZone);
  const back = p.hour < 12 ? 1 : 0;
  const noon0 = zonedTime(p.year, p.month, p.day - back, 12, 0, timeZone);
  const noon1 = zonedTime(p.year, p.month, p.day - back + 1, 12, 0, timeZone);
  const sunEv = sunEvents(noon0, noon1, lat, lon);
  const midnight = zonedTime(p.year, p.month, p.day - back + 1, 0, 0, timeZone);
  // The dark window for planets: Sun below −6° (bright planets show in nautical twilight).
  let d0 = sunEv.civilDusk ?? null;
  let d1 = sunEv.civilDawn ?? null;
  const sunAltMid = observe('sun', midnight, lat, lon).alt;
  let darkness = 'normal';
  if (d0 == null || d1 == null) {
    if (sunAltMid > -6) { darkness = 'none'; d0 = d1 = null; }           // white night or midnight sun
    else { darkness = 'polar'; d0 = d0 ?? noon0; d1 = d1 ?? noon1; }     // polar night
  }
  const mid = d0 != null ? (d0 + d1) / 2 : midnight;
  // the Sun all day: 'polar-night' (never rises), 'midnight-sun' (never sets) or 'normal'
  let sunState = 'normal';
  if (sunEv.sunrise == null && sunEv.sunset == null) {
    sunState = observe('sun', noon0, lat, lon).alt > HORIZON.sun ? 'midnight-sun' : 'polar-night';
  }
  const phase = moonPhase(mid);
  const moonEv = riseSet('moon', noon0, noon1, lat, lon);
  const moonrise = moonEv.find((e) => e.rising)?.t ?? null;
  const moonset = moonEv.find((e) => !e.rising)?.t ?? null;

  const planets = [];
  for (const name of PLANETS) {
    if (name === 'earth') continue;
    const g = geocentric(name, mid);
    const entry = { name, mag: +g.mag.toFixed(1), visible: false, naked: g.mag < 5.5,
      best: null, bestAlt: null, bestAz: null, rise: null, set: null, when: null, elong: +g.elong.toFixed(1) };
    const ev = riseSet(name, noon0, noon1, lat, lon);
    entry.rise = ev.find((e) => e.rising)?.t ?? null;
    entry.set = ev.find((e) => !e.rising)?.t ?? null;
    if (d0 != null) {
      let best = -90, bestT = null, bestAz = null, upStart = null, upEnd = null, upMin = 0;
      const n = Math.max(1, Math.round((d1 - d0) / 600000));
      for (let k = 0; k <= n; k++) {
        const tk = d0 + ((d1 - d0) * k) / n;
        const o = observe(name, tk, lat, lon);
        if (o.alt > best) { best = o.alt; bestT = tk; bestAz = o.az; }
        if (o.alt >= 10) { upStart = upStart ?? tk; upEnd = tk; upMin += (d1 - d0) / n / 60000; }
      }
      entry.bestAlt = +best.toFixed(1);
      entry.best = bestT;
      entry.bestAz = +bestAz.toFixed(1);
      entry.visible = best >= 10;
      if (entry.visible) {
        const total = (d1 - d0) / 60000;
        if (upMin > total * 0.6) entry.when = 'night';
        else if (upStart - d0 < 30 * 60000 && upEnd < midnight) entry.when = 'evening';
        else if (d1 - upEnd < 30 * 60000 && upStart > midnight) entry.when = 'morning';
        else entry.when = upEnd <= midnight ? 'evening' : upStart >= midnight ? 'morning' : 'night';
      }
    }
    planets.push(entry);
  }
  const dp = zonedParts(noon0, timeZone);
  return {
    date: { year: dp.year, month: dp.month, day: dp.day },
    noon0, noon1, midnight, darkness, sunState, darkStart: d0, darkEnd: d1, ...sunEv,
    moon: { ...phase, rise: moonrise, set: moonset, at: mid, altAtMidnight: observe('moon', midnight, lat, lon).alt },
    planets,
  };
}

/**
 * Everything a sky chart needs for an observer at t: the Sun, the Moon, the planets, stars
 * (from data.stars: [raHours, decDeg, mag, id]), constellation lines (data.lines:
 * [[i, j, figure], …] into stars, passed through), the ecliptic and the Milky Way's centre
 * line, all with alt/az. See live/sky-data.mjs for SKY_DATA.
 */
export function skyScene(t, lat, lon, data = {}) {
  const ms = toMs(t);
  const T = centuries(ms);
  const eps = obliquity(T);
  const lst = gmst(ms) + lon;
  const sl = sind(lat), cl = cosd(lat);
  const toHz = (ra, dec) => {
    const H = (lst - ra) * D2R, d = dec * D2R;
    const alt = Math.asin(clamp1(sl * Math.sin(d) + cl * Math.cos(d) * Math.cos(H))) * R2D;
    const az = norm360(Math.atan2(-Math.cos(d) * Math.sin(H), Math.sin(d) * cl - Math.cos(d) * sl * Math.cos(H)) * R2D);
    return { alt, az };
  };
  const fromJ2000 = (raDeg, dec) => {
    const ec = eqToEcl(raDeg, dec, 23.43928);
    return eclToEq(ec.lon + PREC * T, ec.lat, eps);
  };
  const sunB = observe('sun', ms, lat, lon);
  const moonB = observe('moon', ms, lat, lon);
  const phase = moonPhase(ms);
  const planets = PLANETS.filter((n) => n !== 'earth').map((n) => observe(n, ms, lat, lon));
  const stars = (data.stars || []).map((s, i) => {
    const eq = fromJ2000(s[0] * 15, s[1]);
    return { i, mag: s[2], ...toHz(eq.ra, eq.dec), id: s[3] || null };
  });
  const ecliptic = [];
  for (let l = 0; l <= 360; l += 5) {
    const eq = eclToEq(l, 0, eps);
    ecliptic.push(toHz(eq.ra, eq.dec));
  }
  const milkyWay = [];
  for (let l = 0; l <= 360; l += 5) {
    // galactic (l, 0) → J2000 equatorial; NGP at RA 192.85948°, Dec 27.12825°, l(NCP) 122.93192°
    const dg = 27.12825, x = 122.93192 - l;
    const dec = Math.asin(clamp1(cosd(dg) * cosd(x))) * R2D;
    const ra = norm360(192.85948 + Math.atan2(sind(x), -sind(dg) * cosd(x)) * R2D);
    const eq = fromJ2000(ra, dec);
    milkyWay.push({ l, ...toHz(eq.ra, eq.dec) });
  }
  const deepSky = (data.deepSky || []).map(([id, raH, dec, mag, name]) => {
    const eq = fromJ2000(raH * 15, dec);
    return { id, mag, name, ...toHz(eq.ra, eq.dec) };
  });
  return {
    t: ms, lat, lon, sun: sunB, moon: { ...moonB, ...phase },
    planets, stars, lines: data.lines || [], ecliptic, milkyWay, deepSky,
  };
}

// ---------------------------------------------------------------- R3.3 (additive)
// Everything below is new in R3.3 and changes nothing above:
//   AU_LIGHT_SECONDS, orbitalSpeed(), rotationSpeed(), closestPlanet()   Earth's card (#99, #137),
//                                                                        true scale (#98)
//   sunAtLongitude(), seasons()                                          equinoxes and solstices (#136)
//   daylight()                                                           the day-length curve (#129)
//   starTrails()                                                         star trails (#131)
//   galileanMoons(), saturnRings(), apparentDiameter(), brightLimb()     the telescope view (#135)

/** Seconds light takes to cross one astronomical unit (the IAU au over c). */
export const AU_LIGHT_SECONDS = AU_KM / 299792.458;

const GM_SUN = 1.32712440018e11;      // km^3 s^-2 (IAU 2015 nominal value)
/** A planet's speed round the Sun (km/s) at t, by vis-viva from the JPL elements above.
 *  "earth" is the Earth-Moon barycentre, as everywhere in this module. */
export function orbitalSpeed(name, t) {
  const el = ELEMENTS[name];
  if (!el) throw new Error(`unknown planet ${name}`);
  const a = (el[0] + el[6] * centuries(t)) * AU_KM;
  const r = heliocentric(name, t).r * AU_KM;
  return Math.sqrt(GM_SUN * (2 / r - 1 / a));
}

/** How fast Earth's turning carries a place at geodetic latitude `lat` eastward (km/h): its
 *  distance from the axis on the WGS84 ellipsoid, once round per sidereal day (86164.0905 s). */
export function rotationSpeed(lat) {
  const a = 6378.137, e2 = 0.00669437999014;
  const s = sind(lat);
  return ((2 * Math.PI * (a / Math.sqrt(1 - e2 * s * s)) * cosd(lat)) / 86164.0905) * 3600;
}

/** The planet nearest Earth at t: {name, dist} (dist in au, from Earth's centre). */
export function closestPlanet(t) {
  let best = null;
  for (const name of PLANETS) {
    if (name === 'earth') continue;
    const g = geocentric(name, t);
    if (!best || g.dist < best.dist) best = { name, dist: g.dist };
  }
  return best;
}

/** The first moment (ms) after t when the Sun's apparent longitude reaches `target` degrees:
 *  0 the March equinox, 90 the June solstice, 180 the September equinox, 270 the December
 *  solstice. As accurate as sun() (a few minutes). */
export function sunAtLongitude(target, t) {
  const rate = 360 / 365.2422;                         // degrees per day, on average
  let ms = toMs(t);
  ms += ((norm360(target - sun(ms).lon) || 360) / rate) * 86400000;
  for (let k = 0; k < 8; k++) {
    const d = norm180(target - sun(ms).lon);
    if (Math.abs(d) < 1e-6) break;
    ms += (d / rate) * 86400000;
  }
  return ms;
}

/** The equinox or solstice before and after t, as {k, t} (k as in sunAtLongitude), and lon,
 *  the Sun's longitude at t (lon / 360 is how far the year has turned since March). */
export function seasons(t) {
  const ms = toMs(t);
  const lon = sun(ms).lon;
  const kPrev = (Math.floor(lon / 90) * 90) % 360;
  const kNext = (kPrev + 90) % 360;
  return {
    lon,
    prev: { k: kPrev, t: sunAtLongitude(kPrev, ms - 120 * 86400000) },
    next: { k: kNext, t: sunAtLongitude(kNext, ms) },
  };
}

/**
 * Daylight on the day around t (t near the place's noon works best): sunrise and sunset (ms)
 * and the minutes between them. Uses the Sun's hour angle at the horizon (h = -0.833°, as
 * riseSet), refined at each event, so it is fast enough for a whole year of days and within
 * about a minute of riseSet(). Polar night gives 0 minutes and the midnight sun 1440 (rise
 * and set are then null).
 */
export function daylight(t, lat, lon) {
  let noon = toMs(t);
  for (let i = 0; i < 2; i++) {
    const s = sun(noon);
    noon -= (norm180(gmst(noon) + lon - s.ra) / 360) * 86400000;   // the Sun's hour angle is 0
  }
  const h0 = sind(HORIZON.sun);
  const event = (sign) => {
    let te = noon + sign * 0.25 * 86400000;
    for (let i = 0; i < 4; i++) {
      const s = sun(te);
      const c = (h0 - sind(lat) * sind(s.dec)) / (cosd(lat) * cosd(s.dec));
      if (!(Math.abs(c) <= 1)) return null;                        // never reaches the horizon
      const H = norm180(gmst(te) + lon - s.ra);
      te += ((sign * Math.acos(c) * R2D - H) / 360) * 86400000;
    }
    return te;
  };
  const rise = event(-1), set = event(1);
  if (rise == null || set == null || set <= rise) {
    const up = observe('sun', noon, lat, lon).alt > HORIZON.sun;
    return { rise: null, set: null, noon, minutes: up ? 1440 : 0 };
  }
  return { rise, set, noon, minutes: (set - rise) / 60000 };
}

/**
 * Star trails (#131): where each star of data.stars (as for skyScene) stood over the `hours`
 * before t, every `stepMin` minutes, for stars no fainter than maxMag:
 * [{i, mag, pts: [{alt, az}, ...]}] (oldest first). Over a few hours only Earth's turning
 * matters, so each star's place of date is worked out once.
 */
export function starTrails(t, lat, lon, data = {}, { hours = 3, stepMin = 10, maxMag = 3 } = {}) {
  const ms = toMs(t);
  const T = centuries(ms);
  const eps = obliquity(T);
  const sl = sind(lat), cl = cosd(lat);
  const n = Math.max(1, Math.round((hours * 60) / stepMin));
  const lsts = [];
  for (let k = 0; k <= n; k++) lsts.push(gmst(ms - (n - k) * stepMin * 60000) + lon);
  const out = [];
  (data.stars || []).forEach((s, i) => {
    if (s[2] > maxMag) return;
    const ec = eqToEcl(s[0] * 15, s[1], 23.43928);
    const eq = eclToEq(ec.lon + PREC * T, ec.lat, eps);
    const sd = sind(eq.dec), cd = cosd(eq.dec);
    const pts = lsts.map((lst) => {
      const H = (lst - eq.ra) * D2R;
      const alt = Math.asin(clamp1(sl * sd + cl * cd * Math.cos(H))) * R2D;
      const az = norm360(Math.atan2(-cd * Math.sin(H), sd * cl - cd * sl * Math.cos(H)) * R2D);
      return { alt, az };
    });
    out.push({ i, mag: s[2], pts });
  });
  return out;
}

/**
 * The four Galilean moons as seen from Earth at t: [{name, x, y, front}], x and y in Jupiter's
 * equatorial radii, x positive to the west and y to the north; front is true when the moon is
 * nearer to us than Jupiter (a transit when |x| < 1; behind it, an occultation). The
 * low-accuracy method of J. Meeus, Astronomical Algorithms (2nd ed., 1998), ch. 44: good for
 * drawing where they are, not for timing eclipses.
 */
export function galileanMoons(t) {
  const d = julianDay(t) + DT_DAYS - 2451545.0;
  const V = 172.74 + 0.00111588 * d;
  const M = 357.529 + 0.9856003 * d;
  const N = 20.020 + 0.0830853 * d + 0.329 * sind(V);
  const J = 66.115 + 0.9025179 * d - 0.329 * sind(V);
  const A = 1.915 * sind(M) + 0.020 * sind(2 * M);
  const B = 5.555 * sind(N) + 0.168 * sind(2 * N);
  const K = J + A - B;
  const R = 1.00014 - 0.01671 * cosd(M) - 0.00014 * cosd(2 * M);
  const r = 5.20872 - 0.25208 * cosd(N) - 0.00611 * cosd(2 * N);
  const dist = Math.sqrt(r * r + R * R - 2 * r * R * cosd(K));
  const psi = Math.asin(clamp1((R / dist) * sind(K))) * R2D;
  const dd = d - dist / 173;
  const u = [163.8069 + 203.4058646 * dd, 358.4140 + 101.2916335 * dd, 5.7176 + 50.2345180 * dd, 224.8092 + 21.4879800 * dd]
    .map((x) => x + psi - B);
  const G = 331.18 + 50.310482 * dd;
  const H = 87.45 + 21.569231 * dd;
  const radius = [5.9057 - 0.0244 * cosd(2 * (u[0] - u[1])), 9.3966 - 0.0882 * cosd(2 * (u[1] - u[2])),
    14.9883 - 0.0216 * cosd(G), 26.3627 - 0.1939 * cosd(H)];
  const corr = [0.473 * sind(2 * (u[0] - u[1])), 1.065 * sind(2 * (u[1] - u[2])), 0.165 * sind(G), 0.843 * sind(H)];
  const lam = 34.35 + 0.083091 * d + 0.329 * sind(V) + B;
  const Ds = 3.12 * sind(lam + 42.8);
  const De = Ds - 2.22 * sind(psi) * cosd(lam + 22) - 1.30 * ((r - dist) / dist) * sind(lam - 100.5);
  return ['io', 'europa', 'ganymede', 'callisto'].map((name, k) => {
    const uk = u[k] + corr[k];
    return { name, x: radius[k] * sind(uk), y: -radius[k] * cosd(uk) * sind(De), front: cosd(uk) > 0 };
  });
}

/**
 * Saturn's rings from Earth at t (Meeus, ch. 45): B, the tilt of the ring plane toward us in
 * degrees (positive when we see its north face), and the outer ring's apparent major and minor
 * axes a and b in arcseconds (375.35" at 1 au).
 */
export function saturnRings(t) {
  const T = centuries(t);
  const i = 28.075216 - 0.012998 * T + 0.000004 * T * T;
  const node = 169.508470 + 1.394681 * T + 0.000412 * T * T;
  const g = geocentric('saturn', t);
  const sB = sind(i) * cosd(g.lat) * sind(g.lon - node) - cosd(i) * sind(g.lat);
  const a = 375.35 / g.dist;
  return { B: Math.asin(clamp1(sB)) * R2D, a, b: a * Math.abs(sB) };
}

// Equatorial radii (km), IAU WG on Cartographic Coordinates and Rotational Elements (2015).
const RADIUS_KM = { mercury: 2440.53, venus: 6051.8, mars: 3396.19, jupiter: 71492, saturn: 60268, uranus: 25559, neptune: 24764 };
/** A planet's apparent equatorial diameter at t, in arcseconds. */
export function apparentDiameter(name, t) {
  if (!RADIUS_KM[name]) throw new Error(`unknown planet ${name}`);
  return 2 * Math.atan(RADIUS_KM[name] / (geocentric(name, t).dist * AU_KM)) * R2D * 3600;
}

/** Position angle of the middle of a body's bright limb at t, in degrees from north through
 *  east (Meeus, ch. 48): the lit side points this way, toward the Sun. */
export function brightLimb(name, t) {
  const b = body(name, t);
  const s = sun(t);
  const da = s.ra - b.ra;
  return norm360(Math.atan2(cosd(s.dec) * sind(da), sind(s.dec) * cosd(b.dec) - cosd(s.dec) * sind(b.dec) * cosd(da)) * R2D);
}

// ---------------------------------------------------------------- R3.3 batch 1b (additive)
// Calendar and time. Above, only zonedTime() changed: a wall time the clocks skip in spring now
// maps forward (02:30 becomes 03:30), as asked; everything else above is as it was.
//   chineseDate()                                     the lunar date, checked against live/holidays.mjs (#95)
//   solarLongitude(), solarTermTime(), solarTerms()   the Sun to about a second of arc: the 24 solar
//                                                     terms (#95) and the equinoxes and solstices (#141)
//   moonPhases()                                      new, quarter and full Moons to about a minute (#127, #141)
//   sunJ2000At(), showerPeak(), showerRadiant(),
//   showerActive()                                    the meteor showers' peaks and radiants (#93)
//   lunarEclipseTimes(), moonUpSpan()                 an eclipse's phases, and whether a place sees it (#94)
//   skyHighlights()                                   the next 30 days: the Moon by a planet, two planets
//                                                     close together, a planet at opposition (#134)
//   subsolarPoint()                                   where on Earth the Sun is overhead (#142)
//   skyCalendar(), icsCalendar()                      a year of sky events as an .ics file (#141)
// Checked by pages/tests/test.mjs: the solar terms and the lunar calendar against the Hong Kong
// Observatory (every date from 2024 to 2035, and the 2026 major terms to the minute), the phases
// and the equinoxes and solstices against the US Naval Observatory (2026 and 2027), the meteor
// shower maxima against the International Meteor Organization's calendars for 2026 and 2027, and
// the eclipses (NASA) against the phases.

// The Earth's heliocentric longitude and distance from VSOP87 (P. Bretagnon and G. Francou,
// 1988), the truncated series of J. Meeus, Astronomical Algorithms (2nd ed., 1998), appendix III:
// [A, B, C] terms A·cos(B + C·τ), τ in Julian millennia from J2000 (TT), units of 1e-8 rad or au.
const VSOP_L = [
  [175347046, 0, 0, 3341656, 4.6692568, 6283.07585, 34894, 4.6261, 12566.1517, 3497, 2.7441, 5753.3849, 3418, 2.8289, 3.5231,
    3136, 3.6277, 77713.7715, 2676, 4.4181, 7860.4194, 2343, 6.1352, 3930.2097, 1324, 0.7425, 11506.7698, 1273, 2.0371, 529.691,
    1199, 1.1096, 1577.3435, 990, 5.233, 5884.927, 902, 2.045, 26.298, 857, 3.508, 398.149, 780, 1.179, 5223.694, 753, 2.533, 5507.553,
    505, 4.583, 18849.228, 492, 4.205, 775.523, 357, 2.92, 0.067, 317, 5.849, 11790.629, 284, 1.899, 796.298, 271, 0.315, 10977.079,
    243, 0.345, 5486.778, 206, 4.806, 2544.314, 205, 1.869, 5573.143, 202, 2.458, 6069.777, 156, 0.833, 213.299, 132, 3.411, 2942.463,
    126, 1.083, 20.775, 115, 0.645, 0.98, 103, 0.636, 4694.003, 102, 0.976, 15720.839, 102, 4.267, 7.114, 99, 6.21, 2146.17,
    98, 0.68, 155.42, 86, 5.98, 161000.69, 85, 1.3, 6275.96, 85, 3.67, 71430.7, 80, 1.81, 17260.15, 79, 3.04, 12036.46,
    75, 1.76, 5088.63, 74, 3.5, 3154.69, 74, 4.68, 801.82, 70, 0.83, 9437.76, 62, 3.98, 8827.39, 61, 1.82, 7084.9,
    57, 2.78, 6286.6, 56, 4.39, 14143.5, 56, 3.47, 6279.55, 52, 0.19, 12139.55, 52, 1.33, 1748.02, 51, 0.28, 5856.48,
    49, 0.49, 1194.45, 41, 5.37, 8429.24, 41, 2.4, 19651.05, 39, 6.17, 10447.39, 37, 6.04, 10213.29, 37, 2.57, 1059.38,
    36, 1.71, 2352.87, 36, 1.78, 6812.77, 33, 0.59, 17789.85, 30, 0.44, 83996.85, 30, 2.74, 1349.87, 25, 3.16, 4690.48],
  [628331966747, 0, 0, 206059, 2.678235, 6283.07585, 4303, 2.6351, 12566.1517, 425, 1.59, 3.523, 119, 5.796, 26.298,
    109, 2.966, 1577.344, 93, 2.59, 18849.23, 72, 1.14, 529.69, 68, 1.87, 398.15, 67, 4.41, 5507.55, 59, 2.89, 5223.69,
    56, 2.17, 155.42, 45, 0.4, 796.3, 36, 0.47, 775.52, 29, 2.65, 7.11, 21, 5.34, 0.98, 19, 1.85, 5486.78, 19, 4.97, 213.3,
    17, 2.99, 6275.96, 16, 0.03, 2544.31, 16, 1.43, 2146.17, 15, 1.21, 10977.08, 12, 2.83, 1748.02, 12, 3.26, 5088.63,
    12, 5.27, 1194.45, 12, 2.08, 4694, 11, 0.77, 553.57, 10, 1.3, 6286.6, 10, 4.24, 1349.87, 9, 2.7, 242.73, 9, 5.64, 951.72,
    8, 5.3, 2352.87, 6, 2.65, 9437.76, 6, 4.67, 4690.48],
  [52919, 0, 0, 8720, 1.0721, 6283.0758, 309, 0.867, 12566.152, 27, 0.05, 3.52, 16, 5.19, 26.3, 16, 3.68, 155.42,
    10, 0.76, 18849.23, 9, 2.06, 77713.77, 7, 0.83, 775.52, 5, 4.66, 1577.34, 4, 1.03, 7.11, 4, 3.44, 5573.14, 3, 5.14, 796.3,
    3, 6.05, 5507.55, 3, 1.19, 242.73, 3, 6.12, 529.69, 3, 0.31, 398.15, 3, 2.28, 553.57, 2, 4.38, 5223.69, 2, 3.75, 0.98],
  [289, 5.844, 6283.076, 35, 0, 0, 17, 5.49, 12566.15, 3, 5.2, 155.42, 1, 4.72, 3.52, 1, 5.3, 18849.23, 1, 5.97, 242.73],
  [114, 3.142, 0, 8, 4.13, 6283.08, 1, 3.84, 12566.15],
  [1, 3.14, 0],
];
const VSOP_R = [
  [100013989, 0, 0, 1670700, 3.0984635, 6283.07585, 13956, 3.05525, 12566.1517, 3084, 5.1985, 77713.7715, 1628, 1.1739, 5753.3849,
    1576, 2.8469, 7860.4194, 925, 5.453, 11506.77, 542, 4.564, 3930.21, 472, 3.661, 5884.927, 346, 0.964, 5507.553, 329, 5.9, 5223.694,
    307, 0.299, 5573.143, 243, 4.273, 11790.629, 212, 5.847, 1577.344, 186, 5.022, 10977.079, 175, 3.012, 18849.228, 110, 5.055, 5486.778,
    98, 0.89, 6069.78, 86, 5.69, 15720.84, 86, 1.27, 161000.69, 65, 0.27, 17260.15, 63, 0.92, 529.69, 57, 2.01, 83996.85, 56, 5.24, 71430.7,
    49, 3.25, 2544.31, 47, 2.58, 775.52, 45, 5.54, 9437.76, 43, 6.01, 6275.96, 39, 5.36, 4694, 38, 2.39, 8827.39, 37, 0.83, 19651.05,
    37, 4.9, 12139.55, 36, 1.67, 12036.46, 35, 1.84, 2942.46, 33, 0.24, 7084.9, 32, 0.18, 5088.63, 32, 1.78, 398.15, 28, 1.21, 6286.6,
    28, 1.9, 6279.55, 26, 4.59, 10447.39],
  [103019, 1.10749, 6283.07585, 1721, 1.0644, 12566.1517, 702, 3.142, 0, 32, 1.02, 18849.23, 31, 2.84, 5507.55, 25, 1.32, 5223.69,
    18, 1.42, 1577.34, 10, 5.91, 10977.08, 9, 1.42, 6275.96, 9, 0.27, 5486.78],
  [4359, 5.7846, 6283.0758, 124, 5.579, 12566.152, 12, 3.14, 0, 9, 3.63, 77713.77, 6, 1.87, 5573.14, 3, 5.47, 18849.23],
  [145, 4.273, 6283.076, 7, 3.92, 12566.15],
  [4, 2.56, 6283.08],
];
function vsop(series, tau) {
  let s = 0;
  let p = 1;
  for (const terms of series) {
    let x = 0;
    for (let i = 0; i < terms.length; i += 3) x += terms[i] * Math.cos(terms[i + 1] + terms[i + 2] * tau);
    s += x * p;
    p *= tau;
  }
  return s / 1e8;
}
const SUN_RATE = 0.98564736;          // the Sun's mean motion, degrees per day

/**
 * The Sun's apparent geocentric longitude at t (degrees, equinox of date), as the solar terms
 * are defined: VSOP87 (above), Meeus ch. 25 (FK5, −0.09033″), nutation in longitude (ch. 22,
 * the four largest terms) and aberration (−20.4898″ / R). Within about 1″ of the almanacs, so
 * a solar term to well under a minute (sun() above is good to about 15 minutes).
 */
export function solarLongitude(t) {
  const tau = (julianDay(t) + DT_DAYS - 2451545.0) / 365250;
  const T = tau * 10;
  const L = vsop(VSOP_L, tau) * R2D;
  const R = vsop(VSOP_R, tau);
  const om = 125.04452 - 1934.136261 * T;
  const dpsi = -17.20 * sind(om) - 1.32 * sind(2 * (280.4665 + 36000.7698 * T)) - 0.23 * sind(2 * (218.3165 + 481267.8813 * T)) + 0.21 * sind(2 * om);
  return norm360(L + 180 + (-0.09033 + dpsi - 20.4898 / R) / 3600);
}

/** The first moment (ms) at or after t when solarLongitude() reaches `lon` degrees. */
export function solarTermTime(lon, t) {
  let ms = toMs(t);
  ms += (norm360(lon - solarLongitude(ms)) / SUN_RATE) * 86400000;
  for (let k = 0; k < 8; k++) {
    const d = norm180(lon - solarLongitude(ms));
    ms += (d / SUN_RATE) * 86400000;
    if (Math.abs(d) < 1e-7) break;
  }
  return Math.round(ms);
}

/** The solar terms between t0 and t1: [{t, lon, i}], i = lon / 15 (0 the March equinox, 3 立夏,
 *  6 the June solstice, … 21 立春), every 15° of solarLongitude(). */
export function solarTerms(t0, t1) {
  const a = toMs(t0);
  const b = toMs(t1);
  const out = [];
  let lon = (Math.floor(solarLongitude(a) / 15) * 15 + 15) % 360;
  let t = solarTermTime(lon, a);
  while (t < b) {
    out.push({ t, lon, i: lon / 15 });
    lon = (lon + 15) % 360;
    t = solarTermTime(lon, t + 86400000);
  }
  return out;
}

/** JDE of a principal phase of the Moon, J. Meeus, Astronomical Algorithms ch. 49: k is a whole
 *  number for a new Moon (k = 0 the new Moon of 2000 January 6), +0.25 for the first quarter,
 *  +0.5 for the full Moon and +0.75 for the last quarter. Good to well under a minute. */
function phaseJDE(k) {
  const T = k / 1236.85;
  const jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T * T - 0.00000015 * T ** 3 + 0.00000000073 * T ** 4;
  const E = 1 - 0.002516 * T - 0.0000074 * T * T;
  const M = 2.5534 + 29.1053567 * k - 0.0000014 * T * T - 0.00000011 * T ** 3;
  const Mp = 201.5643 + 385.81693528 * k + 0.0107582 * T * T + 0.00001238 * T ** 3 - 0.000000058 * T ** 4;
  const F = 160.7108 + 390.67050284 * k - 0.0016118 * T * T - 0.00000227 * T ** 3 + 0.000000011 * T ** 4;
  const Om = 124.7746 - 1.56375588 * k + 0.0020672 * T * T + 0.00000215 * T ** 3;
  const q = Math.round((k - Math.floor(k)) * 4) % 4;
  let c;
  if (q === 0 || q === 2) {
    const n = q === 0;
    c = (n ? -0.40720 : -0.40614) * sind(Mp) + (n ? 0.17241 : 0.17302) * E * sind(M) + (n ? 0.01608 : 0.01614) * sind(2 * Mp)
      + (n ? 0.01039 : 0.01043) * sind(2 * F) + (n ? 0.00739 : 0.00734) * E * sind(Mp - M) + (n ? -0.00514 : -0.00515) * E * sind(Mp + M)
      + (n ? 0.00208 : 0.00209) * E * E * sind(2 * M) - 0.00111 * sind(Mp - 2 * F) - 0.00057 * sind(Mp + 2 * F)
      + 0.00056 * E * sind(2 * Mp + M) - 0.00042 * sind(3 * Mp) + 0.00042 * E * sind(M + 2 * F) + 0.00038 * E * sind(M - 2 * F)
      - 0.00024 * E * sind(2 * Mp - M) - 0.00017 * sind(Om) - 0.00007 * sind(Mp + 2 * M) + 0.00004 * sind(2 * Mp - 2 * F)
      + 0.00004 * sind(3 * M) + 0.00003 * sind(Mp + M - 2 * F) + 0.00003 * sind(2 * Mp + 2 * F) - 0.00003 * sind(Mp + M + 2 * F)
      + 0.00003 * sind(Mp - M + 2 * F) - 0.00002 * sind(Mp - M - 2 * F) - 0.00002 * sind(3 * Mp + M) + 0.00002 * sind(4 * Mp);
  } else {
    c = -0.62801 * sind(Mp) + 0.17172 * E * sind(M) - 0.01183 * E * sind(Mp + M) + 0.00862 * sind(2 * Mp) + 0.00804 * sind(2 * F)
      + 0.00454 * E * sind(Mp - M) + 0.00204 * E * E * sind(2 * M) - 0.00180 * sind(Mp - 2 * F) - 0.00070 * sind(Mp + 2 * F)
      - 0.00040 * sind(3 * Mp) - 0.00034 * E * sind(2 * Mp - M) + 0.00032 * E * sind(M + 2 * F) + 0.00032 * E * sind(M - 2 * F)
      - 0.00028 * E * E * sind(Mp + 2 * M) + 0.00027 * E * sind(2 * Mp + M) - 0.00017 * sind(Om) - 0.00005 * sind(Mp - M - 2 * F)
      + 0.00004 * sind(2 * Mp + 2 * F) - 0.00004 * sind(Mp + M + 2 * F) + 0.00004 * sind(Mp - 2 * M) + 0.00003 * sind(Mp + M - 2 * F)
      + 0.00003 * sind(3 * M) + 0.00002 * sind(2 * Mp - 2 * F) + 0.00002 * sind(Mp - M + 2 * F) - 0.00002 * sind(3 * Mp + M);
    const W = 0.00306 - 0.00038 * E * cosd(M) + 0.00026 * cosd(Mp) - 0.00002 * cosd(Mp - M) + 0.00002 * cosd(Mp + M) + 0.00002 * cosd(2 * F);
    c += q === 1 ? W : -W;
  }
  // the planetary arguments A1 to A14
  const A = [299.77, 0.107408, 325, 251.88, 0.016321, 165, 251.83, 26.651886, 164, 349.42, 36.412478, 126, 84.66, 18.206239, 110,
    141.74, 53.303771, 62, 207.14, 2.453732, 60, 154.84, 7.306860, 56, 34.52, 27.261239, 47, 207.19, 0.121824, 42,
    291.34, 1.844379, 40, 161.72, 24.198154, 37, 239.56, 25.513099, 35, 331.55, 3.592518, 23];
  let add = 0;
  for (let i = 0; i < A.length; i += 3) add += (A[i + 2] / 1e6) * sind(A[i] + A[i + 1] * k - (i === 0 ? 0.009173 * T * T : 0));
  return jde + c + add;
}

/** The principal phases of the Moon between t0 and t1, in order: [{t, q}], q 0 new, 1 first
 *  quarter, 2 full, 3 last quarter (Meeus ch. 49; nextPhase() above is good to about 30 minutes). */
export function moonPhases(t0, t1) {
  const a = toMs(t0);
  const b = toMs(t1);
  const out = [];
  for (let k = Math.floor((julianDay(a) - 2451550.09766) / SYNODIC_MONTH) - 1; ; k += 0.25) {
    const t = Math.round((phaseJDE(k) - DT_DAYS - 2440587.5) * 86400000);
    if (t >= b) break;
    if (t >= a) out.push({ t, q: Math.round((k - Math.floor(k)) * 4) % 4 });
  }
  return out;
}

/** The first moment (ms) after t when the Sun's longitude referred to the J2000 equinox reaches
 *  `lam` degrees: the solar longitude the International Meteor Organization gives for a shower. */
export function sunJ2000At(lam, t) {
  let ms = toMs(t);
  ms += (norm360(lam - sun(ms).lonJ2000) / SUN_RATE) * 86400000;
  for (let k = 0; k < 8; k++) {
    const d = norm180(lam - sun(ms).lonJ2000);
    ms += (d / SUN_RATE) * 86400000;
    if (Math.abs(d) < 1e-6) break;
  }
  return Math.round(ms);
}

const dayOfYear = (y, m, d) => (Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000;
/** Days from the shower's usual peak date to (m, d), folded into half a year either way. */
function fromPeak(sh, m, d) {
  const x = dayOfYear(2001, m, d) - dayOfYear(2001, sh.peak[0], sh.peak[1]);
  return x > 182 ? x - 365 : x < -182 ? x + 365 : x;
}
/** A shower's maximum in `year` (ms): the moment the Sun reaches its solar longitude. A shower
 *  is {lam, peak: [month, day], from: [m, d], to: [m, d], radiant: [[m, d, ra, dec], …]} (see
 *  METEOR_SHOWERS in live/sky-data.mjs). */
export function showerPeak(sh, year) {
  return sunJ2000At(sh.lam, Date.UTC(year, sh.peak[0] - 1, sh.peak[1]) - 20 * 86400000);
}
/** Whether the shower is active on the UTC date of t (inside its activity period). */
export function showerActive(sh, t) {
  const p = new Date(toMs(t));
  const x = fromPeak(sh, p.getUTCMonth() + 1, p.getUTCDate());
  return x >= fromPeak(sh, ...sh.from) && x <= fromPeak(sh, ...sh.to);
}
/** The radiant on the UTC date of t (J2000 ra, dec in degrees), between the dated positions the
 *  IMO lists (it drifts by about a degree a day for some showers). */
export function showerRadiant(sh, t) {
  const p = new Date(toMs(t));
  const x = fromPeak(sh, p.getUTCMonth() + 1, p.getUTCDate()) + (p.getUTCHours() + p.getUTCMinutes() / 60) / 24;
  const pts = sh.radiant.map(([m, d, ra, dec]) => [fromPeak(sh, m, d), ra, dec]).sort((u, v) => u[0] - v[0]);
  if (x <= pts[0][0]) return { ra: pts[0][1], dec: pts[0][2] };
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const k = (x - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]);
      return { ra: norm360(pts[i - 1][1] + norm180(pts[i][1] - pts[i - 1][1]) * k), dec: pts[i - 1][2] + (pts[i][2] - pts[i - 1][2]) * k };
    }
  }
  const z = pts[pts.length - 1];
  return { ra: z[1], dec: z[2] };
}

/**
 * The phases of a lunar eclipse (ms, UT) from a catalogue row [date, TD of greatest eclipse,
 * ΔT (s), type, umbral magnitude, penumbral, partial and total durations (minutes), penumbral
 * magnitude] (LUNAR_ECLIPSES in live/sky-data.mjs): {max, p1, p4, u1, u4, u2, u3}; u1 to u3 are
 * null when the eclipse has no partial or total phase.
 */
export function lunarEclipseTimes(row) {
  const [date, td, dt, , , pen, par, tot] = row;
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm, ss] = td.split(':').map(Number);
  const max = Date.UTC(y, m - 1, d, hh, mm, ss) - dt * 1000;
  const half = (min) => (min ? Math.round((min / 2) * 60000) : null);
  return {
    max, p1: max - half(pen), p4: max + half(pen),
    u1: par ? max - half(par) : null, u4: par ? max + half(par) : null,
    u2: tot ? max - half(tot) : null, u3: tot ? max + half(tot) : null,
  };
}

/** Whether the Moon is above the horizon (as riseSet() counts it) between t0 and t1 at a place:
 *  {all, none, from, to}, from and to bounding the first stretch it is up (rise and set times
 *  from riseSet(), so they match the times shown elsewhere). */
export function moonUpSpan(t0, t1, lat, lon) {
  const a = toMs(t0);
  const b = toMs(t1);
  const ev = riseSet('moon', a, b, lat, lon);
  const upAtStart = observe('moon', a, lat, lon).alt > HORIZON.moon;
  if (!ev.length) return { all: upAtStart, none: !upAtStart, from: upAtStart ? a : null, to: upAtStart ? b : null };
  const rise = ev.find((e) => e.rising);
  const from = upAtStart ? a : rise ? rise.t : null;
  if (from == null) return { all: false, none: true, from: null, to: null };
  const set = ev.find((e) => !e.rising && e.t > from);
  return { all: false, none: false, from, to: set ? set.t : b };
}

/** Angle between two directions given as (ra, dec) or (az, alt), degrees. */
function sepDeg(a1, d1, a2, d2) {
  return Math.acos(clamp1(sind(d1) * sind(d2) + cosd(d1) * cosd(d2) * cosd(a1 - a2))) * R2D;
}

/**
 * What is worth looking up for between t0 and t1 at a place (#134), in time order:
 *   {kind: 'moon', body, t, from, to, sep, az, alt}   the Moon within `maxSep` of a bright planet
 *   {kind: 'pair', a, b, t, from, to, sep, az, alt}   two bright planets within `maxSep`
 *   {kind: 'opposition', body, t}                     Mars, Jupiter or Saturn opposite the Sun
 * Only moments when the sky is dark (the Sun 6° or more below the horizon) and both bodies are
 * at least 5° up count; sep is the angle as seen from the place (the Moon with its parallax), t
 * the moment it is smallest, from and to the stretch of 10-minute steps around it that qualify.
 */
export function skyHighlights(t0, t1, lat, lon, { maxSep = 5 } = {}) {
  const a = toMs(t0);
  const b = toMs(t1);
  const H = 3600000;
  const bright = ['mercury', 'venus', 'mars', 'jupiter', 'saturn'];
  const out = [];
  const view = (x, y, t) => {
    const s = observe('sun', t, lat, lon);
    if (s.alt > -6) return null;
    const p = observe(x, t, lat, lon);
    const q = observe(y, t, lat, lon);
    if (p.alt < 5 || q.alt < 5) return null;
    const sep = sepDeg(p.az, p.alt, q.az, q.alt);
    return sep <= maxSep ? { t, sep, az: (p.az + q.az) / 2 + (Math.abs(p.az - q.az) > 180 ? 180 : 0), alt: (p.alt + q.alt) / 2, low: Math.min(p.alt, q.alt) } : null;
  };
  // the best moment near t (the closest for the Moon, which moves fast; the highest for two
  // planets, which hardly move in a night) and the qualifying stretch round it
  const around = (x, y, t, span) => {
    const pts = [];
    for (let u = Math.max(a, t - span); u <= Math.min(b, t + span); u += 600000) pts.push(view(x, y, u));
    let best = -1;
    const better = x === 'moon' ? (p, q) => p.sep < q.sep : (p, q) => p.low > q.low;
    pts.forEach((p, i) => { if (p && (best < 0 || better(p, pts[best]))) best = i; });
    if (best < 0) return null;
    let i0 = best;
    let i1 = best;
    while (i0 > 0 && pts[i0 - 1]) i0--;
    while (i1 < pts.length - 1 && pts[i1 + 1]) i1++;
    const { low, ...v } = pts[best];
    return { ...v, az: norm360(v.az), from: pts[i0].t, to: pts[i1].t };
  };
  const geoSep = (x, y, t) => { const p = body(x, t); const q = body(y, t); return sepDeg(p.ra, p.dec, q.ra, q.dec); };
  // the Moon by a planet: hourly geocentric separation, then the view from the place near each minimum
  for (const pl of bright) {
    const s = [];
    for (let t = a - H; t <= b + H; t += H) s.push([t, geoSep('moon', pl, t)]);
    for (let i = 1; i < s.length - 1; i++) {
      if (!(s[i][1] < s[i - 1][1] && s[i][1] <= s[i + 1][1] && s[i][1] < maxSep + 1.5)) continue;
      const v = around('moon', pl, s[i][0], 12 * H);
      if (v) out.push({ kind: 'moon', body: pl, ...v });
    }
  }
  // two planets: daily geocentric separation, the minimum to the hour, then the best dark moment
  // of the night nearest to it
  for (let i = 0; i < bright.length; i++) {
    for (let j = i + 1; j < bright.length; j++) {
      const s = [];
      for (let t = a - 86400000; t <= b + 86400000; t += 86400000) s.push([t, geoSep(bright[i], bright[j], t)]);
      for (let k = 1; k < s.length - 1; k++) {
        if (!(s[k][1] < s[k - 1][1] && s[k][1] <= s[k + 1][1] && s[k][1] < maxSep)) continue;
        let tm = s[k][0];
        for (let t = s[k - 1][0]; t <= s[k + 1][0]; t += H) if (geoSep(bright[i], bright[j], t) < geoSep(bright[i], bright[j], tm)) tm = t;
        const v = around(bright[i], bright[j], tm, 14 * H);
        if (v) out.push({ kind: 'pair', a: bright[i], b: bright[j], ...v });
      }
    }
  }
  // oppositions: the planet's longitude 180° from the Sun's
  for (const pl of ['mars', 'jupiter', 'saturn']) {
    const f = (t) => norm180(geocentric(pl, t).lon - sun(t).lon - 180);
    let ta = a;
    let fa = f(ta);
    for (let t = a + 86400000; t <= b; t += 86400000) {
      const fb = f(t);
      if (fa < 0 && fb >= 0) {
        let lo = ta;
        let hi = t;
        for (let n = 0; n < 30; n++) { const mid = (lo + hi) / 2; if (f(mid) < 0) lo = mid; else hi = mid; }
        out.push({ kind: 'opposition', body: pl, t: Math.round((lo + hi) / 2) });
      }
      ta = t;
      fa = fb;
    }
  }
  return out.sort((x, y) => x.t - y.t);
}

/** Where the Sun is overhead at t: {lat, lon} in degrees (east positive). */
export function subsolarPoint(t) {
  const s = sun(t);
  return { lat: s.dec, lon: norm180(s.ra - gmst(t)) };
}

/**
 * A year of sky events for a calendar file (#141): full and new Moons and the equinoxes and
 * solstices (moments), meteor shower maxima (dates, approximate) and eclipses, between t0 and t1.
 * data: {showers, solarEclipses, lunarEclipses} from live/sky-data.mjs. Returns, in order,
 * {kind: 'full'|'new', t} | {kind: 'season', k, t} | {kind: 'shower', sh, t, date} |
 * {kind: 'solar', e, t, date} | {kind: 'lunar', e, t, from, to}; date is YYYY-MM-DD (UTC).
 */
export function skyCalendar(t0, t1, data = {}) {
  const a = toMs(t0);
  const b = toMs(t1);
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
  const ev = [];
  for (const p of moonPhases(a, b)) if (p.q === 0 || p.q === 2) ev.push({ kind: p.q ? 'full' : 'new', t: p.t });
  for (const s of solarTerms(a, b)) if (s.lon % 90 === 0) ev.push({ kind: 'season', k: s.lon, t: s.t });
  const y0 = new Date(a).getUTCFullYear();
  const y1 = new Date(b).getUTCFullYear();
  for (const sh of data.showers || []) {
    for (let y = y0 - 1; y <= y1 + 1; y++) {
      const t = showerPeak(sh, y);
      if (t >= a && t < b) ev.push({ kind: 'shower', sh, t, date: iso(t) });
    }
  }
  for (const e of data.solarEclipses || []) {
    const [y, m, d] = e[0].split('-').map(Number);
    const [hh, mm, ss] = e[1].split(':').map(Number);
    const t = Date.UTC(y, m - 1, d, hh, mm, ss);          // greatest eclipse, TD (within about 80 s of UT)
    if (t >= a && t < b) ev.push({ kind: 'solar', e, t, date: e[0] });
  }
  for (const e of data.lunarEclipses || []) {
    const x = lunarEclipseTimes(e);
    if (x.max >= a && x.max < b) ev.push({ kind: 'lunar', e, t: x.max, from: x.u1 ?? x.p1, to: x.u4 ?? x.p4 });
  }
  return ev.sort((x, y) => x.t - y.t);
}

/**
 * The events of skyCalendar() as an iCalendar file (RFC 5545): moments as UTC date-times (a
 * calendar shows them in its own time zone), shower maxima and solar eclipses as all-day dates.
 * text: {full, new, seasons: [4], shower, showerDesc, solar: {type: title}, solarDesc, solarPath,
 * lunar: {type: title}, lunarDesc, lunarFaint, lunarGraze} with {placeholders}; lang 'en' | 'zh'
 * picks the names in data; host names the UIDs; stamp (ms) is DTSTAMP; name and desc title the
 * calendar. Times are rounded to the minute; lines are folded at 75 octets and end in CRLF.
 */
export function icsCalendar(events, { text, lang = 'en', host = 'localhost', stamp = 0, name = '', desc = '' } = {}) {
  const fmt = (s, o) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in o ? o[k] : m));
  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const pad = (n) => String(n).padStart(2, '0');
  const dt = (ms) => {
    const d = new Date(Math.round(ms / 60000) * 60000);      // to the nearest minute, as almanacs give them
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
  };
  const day = (iso) => iso.replace(/-/g, '');
  const next = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10); };
  const name_ = (o) => (o && (o[lang] || o.en)) || '';
  const fold = (line) => {
    const enc = new TextEncoder();
    const out = [];
    let cur = '';
    let n = 0;
    for (const ch of line) {
      const w = enc.encode(ch).length;
      if (n + w > (out.length ? 74 : 75)) { out.push(cur); cur = ''; n = 0; }
      cur += ch;
      n += w;
    }
    out.push(cur);
    return out.join('\r\n ');
  };
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${host}//Sky calendar//${lang.toUpperCase()}`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  if (name) lines.push(`X-WR-CALNAME:${esc(name)}`);
  if (desc) lines.push(`X-WR-CALDESC:${esc(desc)}`);
  for (const e of events) {
    let uid;
    let when;
    let title;
    let note = '';
    if (e.kind === 'full' || e.kind === 'new') {
      uid = `${e.kind}-${dt(e.t)}`;
      when = [`DTSTART:${dt(e.t)}`];
      title = text[e.kind];
    } else if (e.kind === 'season') {
      uid = `season-${dt(e.t)}`;
      when = [`DTSTART:${dt(e.t)}`];
      title = text.seasons[e.k / 90];
    } else if (e.kind === 'shower') {
      uid = `shower-${e.sh.id.toLowerCase()}-${day(e.date)}`;
      when = [`DTSTART;VALUE=DATE:${day(e.date)}`, `DTEND;VALUE=DATE:${day(next(e.date))}`];
      title = fmt(text.shower, { name: name_(e.sh.name) });
      note = fmt(text.showerDesc, { zhr: e.sh.zhr, where: name_(e.sh.where) });
    } else if (e.kind === 'solar') {
      uid = `solar-eclipse-${day(e.date)}`;
      when = [`DTSTART;VALUE=DATE:${day(e.date)}`, `DTEND;VALUE=DATE:${day(next(e.date))}`];
      title = text.solar[e.e[2]];
      note = fmt(text.solarDesc, { region: name_(e.e[4]), path: e.e[5] ? fmt(text.solarPath, { path: name_(e.e[5]) }) : '' });
    } else if (e.kind === 'lunar') {
      uid = `lunar-eclipse-${dt(e.t)}`;
      when = [`DTSTART:${dt(e.from)}`, `DTEND:${dt(e.to)}`];
      title = text.lunar[e.e[3]];
      // a penumbral eclipse only dims the Moon; one that barely grazes the penumbra shows nothing
      note = e.e[3] === 'penumbral' ? `${e.e[8] < 0.1 ? text.lunarGraze : text.lunarFaint}${lang === 'zh' ? '' : ' '}${text.lunarDesc}` : text.lunarDesc;
    } else continue;
    lines.push('BEGIN:VEVENT', `UID:${uid}@${host}`, `DTSTAMP:${dt(stamp)}`, ...when, `SUMMARY:${esc(title)}`);
    if (note) lines.push(`DESCRIPTION:${esc(note)}`);
    lines.push('TRANSP:TRANSPARENT', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

let chineseFmt;
/**
 * The Chinese (lunar) calendar date of a Gregorian date: {m, leap, d} (month 1 to 12, leap
 * month or not, day 1 to 30), or null where Intl has no Chinese calendar (#95). It is the
 * runtime's own calendar (ICU), checked against published festival dates: `holidays` is
 * {FIRST, LAST, SPRING_FESTIVAL, MID_AUTUMN} from live/holidays.mjs. ICU starts a month a day
 * early or late when the new Moon falls within minutes of midnight in Beijing; where its
 * Spring Festival (month 1, day 1) or Mid-Autumn Festival (month 8, day 15) misses the
 * published date, that month starts on the published date instead, and the month before ends
 * the day before. Against the Hong Kong Observatory's tables for 2024 to 2035 ICU is off in
 * exactly two months, the first months of 2027 and 2030, and both are mended this way.
 */
export function chineseDate(y, m, d, holidays = null) {
  if (chineseFmt === undefined) {
    chineseFmt = null;
    try {
      const f = new Intl.DateTimeFormat('en-u-ca-chinese', { timeZone: 'UTC', year: 'numeric', month: 'numeric', day: 'numeric' });
      if (f.resolvedOptions().calendar === 'chinese') chineseFmt = f;
    } catch (e) { /* no Chinese calendar in this runtime */ }
  }
  if (!chineseFmt) return null;
  const DAY = 86400000;
  const icu = (ms) => {
    const p = {};
    for (const x of chineseFmt.formatToParts(ms)) p[x.type] = x.value;
    return { m: parseInt(p.month, 10), leap: /bis/.test(p.month), d: parseInt(p.day, 10) };
  };
  const ms = Date.UTC(y, m - 1, d, 12);
  if (holidays && y >= holidays.FIRST && y <= holidays.LAST) {
    for (const [iso, M, D] of [[holidays.SPRING_FESTIVAL[y], 1, 1], [holidays.MID_AUTUMN[y], 8, 15]]) {
      if (!iso) continue;
      const [py, pm, pd] = iso.split('-').map(Number);
      const pub = Date.UTC(py, pm - 1, pd, 12);
      let own = null;
      for (const k of [0, -1, 1, -2, 2]) {
        const x = icu(pub + k * DAY);
        if (x.m === M && !x.leap && x.d === D) { own = pub + k * DAY; break; }
      }
      if (own == null || own === pub) continue;
      const start = pub - (D - 1) * DAY;          // the published first day of month M
      const ownStart = own - (D - 1) * DAY;       // ICU's
      let next = ownStart + 28 * DAY;             // ICU's first day of the month after
      while (icu(next).d !== 1) next += DAY;
      if (ms < Math.min(start, ownStart) || ms >= next) continue;
      if (ms >= start) return { m: M, leap: false, d: Math.round((ms - start) / DAY) + 1 };
      const prev = icu(ownStart - DAY);           // ICU ended the month before a day early
      return { m: prev.m, leap: prev.leap, d: Math.round((ms - (ownStart - prev.d * DAY)) / DAY) + 1 };
    }
  }
  return icu(ms);
}
