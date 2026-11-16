// Draws the sky over an observer as an SVG string (Pages "Sky" app, idea #83).
// Input: a scene from skyScene() in live/astro.mjs; data and names from live/sky-data.mjs.
// The chart is a dome seen from below: zenith in the middle, horizon round the edge, north at
// the top and east on the LEFT, like a planisphere held over your head.
//
//   skyChartSVG(scene, { size, lang, theme, names, ... })  →  '<svg …>…</svg>'
//
// Every body is a <g class="sky-body" data-id="planet:jupiter" …> with a <title>, so the page
// can add hover and focus behaviour. Colours come from the palette, not from page CSS, so the
// SVG looks the same anywhere (and in the red night-vision theme, and saved as a PNG).
//
// R3.3 options (all off by default, so the default chart is unchanged): facing (the direction
// the viewer faces goes at the bottom; 180 = south, the planisphere layout above), grid (an
// altitude and azimuth grid, #139), trails (from starTrails() in live/astro.mjs, #131) and
// maxMag (the faintest stars drawn: the page passes 3 for a city sky and 4 for a suburban one, #139;
// a city sky also passes milkyWay: false).
// R3.3 batch 1b: radiants ([{id, name, title, alt, az}], the meteor showers active that night,
// #93), drawn as a small burst; like the other options it draws nothing unless given.
import { moonPhasePath, compass } from './astro.mjs';

const D2R = Math.PI / 180;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const f1 = (v) => +v.toFixed(1);
const norm = (x) => ((x % 360) + 360) % 360;
const f2 = (v) => +v.toFixed(2);

// Planet colours from dusk-spec R3.1 (dark page / light page).
export const PLANET_COLORS = {
  dark: { mercury: '#b9b4ae', venus: '#f2d3a2', mars: '#ff8f6b', jupiter: '#e8c49c', saturn: '#f0d48a', uranus: '#8be6e0', neptune: '#8d98ff' },
  light: { mercury: '#7d7771', venus: '#b8823d', mars: '#d0532f', jupiter: '#a8763f', saturn: '#b48d2e', uranus: '#1f9c95', neptune: '#4f55d8' },
};

export const PALETTES = {
  dark: {
    night: '#060a15', day: '#24497a', dusk: '#14234a', glow: '#f2a65a', rim: '#2b3556', ring: '#1d2744',
    star: '#eef2fb', line: '#8ea2dc', lineOp: 0.32, label: '#a3aecb', cardinal: '#d5dcef', milky: '#9fb0e0',
    ecliptic: '#d9b56b', moonLit: '#f3f1e8', moonDark: '#262c42', sun: '#ffd27a', deep: '#c6b8ff', outside: '#0b1020',
    meteor: '#7fe7d4',
  },
  light: {
    night: '#e9edf8', day: '#cfe2fb', dusk: '#dfe5f6', glow: '#f2b57a', rim: '#9aa6c4', ring: '#c4ccdf',
    star: '#1b2232', line: '#4c5a8a', lineOp: 0.38, label: '#4a5470', cardinal: '#2b3346', milky: '#7c8cc4',
    ecliptic: '#a8761d', moonLit: '#fbfaf5', moonDark: '#aab2c6', sun: '#e09a1f', deep: '#6a55c8', outside: '#f6f8fd',
    moonLabel: '#4a5470', meteor: '#0f766e',
  },
  red: {
    night: '#090000', day: '#2a0505', dusk: '#160202', glow: '#ff4a3a', rim: '#4a0d0d', ring: '#2b0707',
    star: '#ff6b5e', line: '#ff4a3a', lineOp: 0.3, label: '#d94a3f', cardinal: '#ff6b5e', milky: '#ff4a3a',
    ecliptic: '#ff4a3a', moonLit: '#ff8a7f', moonDark: '#2a0505', sun: '#ff6b5e', deep: '#ff6b5e', outside: '#050000',
    meteor: '#ff6b5e',
  },
};

const PLANET_NAMES = {
  en: { mercury: 'Mercury', venus: 'Venus', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune', moon: 'Moon', sun: 'Sun' },
  zh: { mercury: '水星', venus: '金星', mars: '火星', jupiter: '木星', saturn: '土星', uranus: '天王星', neptune: '海王星', moon: '月亮', sun: '太阳' },
};
export const bodyName = (id, lang = 'en') => (PLANET_NAMES[lang] || PLANET_NAMES.en)[id] || id;

function mix(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = [16, 8, 0].map((s) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Faintest magnitude you can see with the Sun at this altitude (rough, for fading stars). */
export function limitingMag(sunAlt) {
  if (sunAlt > 0) return -3;
  if (sunAlt > -6) return -3 + (-sunAlt / 6) * 3.5;     // civil twilight: only the brightest
  if (sunAlt > -12) return 0.5 + ((-sunAlt - 6) / 6) * 2;
  if (sunAlt > -18) return 2.5 + ((-sunAlt - 12) / 6) * 2;
  return 6;
}

/**
 * @param scene  skyScene(t, lat, lon, SKY_DATA)
 * @param o      size (px, default 360), lang ('en'|'zh'), theme ('dark'|'light'|'red'),
 *               names {stars, figures, deepSky}, figureNames (bool), labels (bool, default true),
 *               milkyWay, ecliptic, deepSky (bools, default true), title (aria label), idPrefix,
 *               facing (degrees, default 180), grid (bool), trails (starTrails() output),
 *               maxMag (number), radiants ([{id, name, title, alt, az}])
 */
export function skyChartSVG(scene, o = {}) {
  const size = o.size || 360;
  const lang = o.lang === 'zh' ? 'zh' : 'en';
  const theme = PALETTES[o.theme] ? o.theme : 'dark';
  const P = PALETTES[theme];
  const PC = theme === 'red' ? null : PLANET_COLORS[theme === 'light' ? 'light' : 'dark'];
  const names = o.names || {};
  const pre = o.idPrefix || 'sky';
  const margin = Math.round(size * 0.065);
  const R = size / 2 - margin;
  const cx = size / 2, cy = size / 2;
  // the direction faced goes at the bottom: facing south (180) is the layout described above
  const rot = (180 - (o.facing == null ? 180 : o.facing)) * D2R;
  const proj = (alt, az) => {
    const r = ((90 - alt) / 90) * R;
    const a = az * D2R + rot;
    return [cx - r * Math.sin(a), cy - r * Math.cos(a)];
  };
  const sunAlt = scene.sun.alt;
  const cap = o.maxMag == null ? Infinity : o.maxMag;
  const lim = Math.min(limitingMag(sunAlt), cap);
  // sky colour: night → dusk → day with the Sun's altitude
  const kDay = Math.max(0, Math.min(1, (sunAlt + 6) / 12));
  const kDusk = Math.max(0, Math.min(1, (sunAlt + 18) / 12));
  const skyTop = kDay > 0 ? mix(P.dusk, P.day, kDay) : mix(P.night, P.dusk, kDusk);
  const fontStack = "-apple-system, 'SF Pro Text', 'Segoe UI', 'PingFang SC', 'Noto Sans SC', Roboto, sans-serif";
  const fs = Math.max(9, Math.round(size * 0.03));
  const out = [];
  const labels = [];
  const placed = [];
  const tryLabel = (x, y, text, r, cls, color, prio = 0) => {
    if (o.labels === false) return;
    const w = text.length * fs * (lang === 'zh' ? 1.0 : 0.56) + 2, h = fs + 2;
    const opts = [[r + 3, fs * 0.35], [-r - 3 - w, fs * 0.35], [-w / 2, -r - 4], [-w / 2, r + fs + 2]];
    for (const [dx, dy] of opts) {
      const bx = x + dx, by = y + dy - fs + 1;
      const d = Math.hypot(bx + w / 2 - cx, by + h / 2 - cy);
      if (d + Math.max(w, h) / 2 > R + 2) continue;      // keep labels inside the dome
      if (placed.some((p) => bx < p[0] + p[2] && bx + w > p[0] && by < p[1] + p[3] && by + h > p[1])) continue;
      placed.push([bx, by, w, h]);
      labels.push({ x: bx, y: by + fs - 1, text, cls, color, prio });
      return;
    }
  };

  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${esc(o.title || (lang === 'zh' ? '星空图' : 'Sky chart'))}" font-family="${fontStack}" class="sky-chart sky-theme-${theme}">`);
  out.push(`<defs><clipPath id="${pre}-dome"><circle cx="${cx}" cy="${cy}" r="${R}"/></clipPath>`
    + `<radialGradient id="${pre}-bg" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${skyTop}"/><stop offset="1" stop-color="${mix(skyTop, P.rim, 0.35)}"/></radialGradient>`);
  // twilight glow toward the Sun when it is just below or above the horizon
  const glowK = sunAlt > -18 && sunAlt < 8 ? Math.max(0, 1 - Math.abs(sunAlt + 3) / 15) : 0;
  const [sx, sy] = proj(Math.max(sunAlt, -40), scene.sun.az);
  if (glowK > 0) out.push(`<radialGradient id="${pre}-glow" gradientUnits="userSpaceOnUse" cx="${f1(sx)}" cy="${f1(sy)}" r="${f1(R * 1.1)}"><stop offset="0" stop-color="${P.glow}" stop-opacity="${f2(0.55 * glowK)}"/><stop offset="1" stop-color="${P.glow}" stop-opacity="0"/></radialGradient>`);
  out.push('</defs>');
  out.push(`<circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#${pre}-bg)"/>`);
  out.push(`<g clip-path="url(#${pre}-dome)">`);
  if (glowK > 0) out.push(`<circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#${pre}-glow)"/>`);
  // altitude rings at 30° and 60°
  for (const a of [30, 60]) out.push(`<circle cx="${cx}" cy="${cy}" r="${f1(((90 - a) / 90) * R)}" fill="none" stroke="${P.ring}" stroke-width="0.8" stroke-dasharray="2 4"/>`);
  // the altitude and azimuth grid: rings every 15° of altitude, spokes every 30° of azimuth,
  // altitudes written up the spoke opposite the direction faced, azimuths inside the rim
  if (o.grid) {
    const g = [];
    for (let a = 15; a < 90; a += 15) g.push(`<circle cx="${cx}" cy="${cy}" r="${f1(((90 - a) / 90) * R)}"/>`);
    for (let az = 0; az < 360; az += 30) {
      const [x1, y1] = proj(0, az);
      const [x2, y2] = proj(75, az);
      g.push(`<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}"/>`);
    }
    const gl = [];
    const back = norm(o.facing == null ? 0 : o.facing + 180);
    for (let a = 15; a < 90; a += 15) {
      const [x, y] = proj(a, back);
      gl.push(`<text x="${f1(x + 3)}" y="${f1(y - 2)}">${a}°</text>`);
    }
    for (let az = 30; az < 360; az += 30) {
      if (az % 90 === 0) continue;
      const [x, y] = proj(4, az);
      gl.push(`<text x="${f1(x)}" y="${f1(y + fs * 0.3)}" text-anchor="middle">${az}°</text>`);
    }
    out.push(`<g class="sky-grid" fill="none" stroke="${P.line}" stroke-opacity="${f2(P.lineOp * 0.55)}" stroke-width="0.7">${g.join('')}</g>`
      + `<g class="sky-grid-labels" font-size="${Math.round(fs * 0.78)}" fill="${P.label}" fill-opacity="0.72">${gl.join('')}</g>`);
  }
  // Milky Way: a soft wide band along the galactic equator, brighter toward the centre.
  // Drawn as two paths (whole band, then the bright inner part) so the strokes never overlap.
  if (o.milkyWay !== false) {
    const starK = Math.max(0, Math.min(1, (lim - 2) / 3));
    const band = (keep) => {
      let d = '';
      let pen = false;
      for (const p of scene.milkyWay) {
        if (p.alt < -12 || !keep(p.l)) { pen = false; continue; }
        const [x, y] = proj(p.alt, p.az);
        d += `${pen ? 'L' : 'M'}${f1(x)},${f1(y)}`;
        pen = true;
      }
      return d;
    };
    if (starK > 0.05) {
      const all = band(() => true);
      const inner = band((l) => l <= 70 || l >= 290);
      if (all) out.push(`<path d="${all}" fill="none" stroke="${P.milky}" stroke-opacity="${f2(0.07 * starK)}" stroke-width="${f1(R * 0.17)}" stroke-linejoin="round" class="sky-milkyway"/>`);
      if (inner) out.push(`<path d="${inner}" fill="none" stroke="${P.milky}" stroke-opacity="${f2(0.06 * starK)}" stroke-width="${f1(R * 0.1)}" stroke-linejoin="round"/>`);
    }
  }
  // star trails: where the brighter stars stood over the last few hours, ending where they are now
  if (o.trails && o.trails.length) {
    const segs = [];
    for (const tr of o.trails) {
      if (tr.mag > cap) continue;
      let d = '';
      let pen = false;
      for (const p of tr.pts) {
        if (p.alt < -1) { pen = false; continue; }
        const [x, y] = proj(p.alt, p.az);
        d += `${pen ? 'L' : 'M'}${f1(x)},${f1(y)}`;
        pen = true;
      }
      if (!d) continue;
      const op = tr.mag <= lim ? Math.max(0.3, Math.min(0.85, 0.8 - tr.mag * 0.14)) : 0.08;
      segs.push(`<path d="${d}" stroke-opacity="${f2(op)}"/>`);
    }
    out.push(`<g class="sky-trails" fill="none" stroke="${P.star}" stroke-width="${f2(Math.max(0.6, 0.85 * (size / 360)))}" stroke-linecap="round" stroke-linejoin="round">${segs.join('')}</g>`);
  }
  // ecliptic, the Sun's yearly path; the planets and the Moon stay near it
  if (o.ecliptic !== false) {
    let d = '';
    let pen = false;
    for (const p of scene.ecliptic) {
      if (p.alt < -10) { pen = false; continue; }
      const [x, y] = proj(p.alt, p.az);
      d += `${pen ? 'L' : 'M'}${f1(x)},${f1(y)}`;
      pen = true;
    }
    if (d) out.push(`<path d="${d}" fill="none" stroke="${P.ecliptic}" stroke-opacity="0.38" stroke-width="0.9" stroke-dasharray="3 4" class="sky-ecliptic"/>`);
  }
  // constellation figures
  const dashed = names.dashed || new Set(['summerTriangle']);
  const lineOp = P.lineOp * Math.max(0.25, Math.min(1, (lim - 0.5) / 3));
  const figSeen = {};
  for (const [i, j, fig] of scene.lines) {
    const a = scene.stars[i], b = scene.stars[j];
    if (!a || !b || a.alt < -3 || b.alt < -3) continue;
    const [x1, y1] = proj(a.alt, a.az), [x2, y2] = proj(b.alt, b.az);
    out.push(`<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${P.line}" stroke-opacity="${f2(dashed.has(fig) ? lineOp * 0.75 : lineOp)}" stroke-width="0.9"${dashed.has(fig) ? ' stroke-dasharray="3 3"' : ''} data-fig="${fig}"/>`);
    (figSeen[fig] = figSeen[fig] || []).push([x1, y1], [x2, y2]);
  }
  out.push('</g>');
  // stars
  const starNames = names.stars || {};
  const starEls = [];
  const sorted = scene.stars.filter((s) => s.alt > 0 && s.mag <= cap).sort((a, b) => a.mag - b.mag);
  for (const s of sorted) {
    const [x, y] = proj(s.alt, s.az);
    const r = Math.max(0.55, Math.min(3.4, 2.7 - 0.5 * s.mag)) * (size / 360);
    const vis = s.mag <= lim;
    const op = vis ? Math.max(0.45, Math.min(1, 1.1 - s.mag * 0.12)) : 0.12;
    const nm = s.id && starNames[s.id];
    if (nm) {
      const label = nm[lang] || nm.en;
      starEls.push(`<g class="sky-body sky-star" data-id="star:${s.id}" data-alt="${f1(s.alt)}" data-az="${f1(s.az)}"><title>${esc(`${label} · ${compass(s.az, lang)} ${Math.round(s.alt)}°`)}</title><circle cx="${f1(x)}" cy="${f1(y)}" r="${f2(r)}" fill="${P.star}" fill-opacity="${f2(op)}"/></g>`);
      if (vis && (s.mag < 1.6 || s.id === 'aUMi')) tryLabel(x, y, label, r, 'sky-label-star', P.label, 1);
    } else {
      starEls.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f2(r)}" fill="${P.star}" fill-opacity="${f2(op)}"/>`);
    }
  }
  // deep-sky objects
  const deepEls = [];
  if (o.deepSky !== false && names.deepSky && scene.deepSky) {
    for (const d of scene.deepSky) {
      if (d.alt <= 2) continue;
      const [x, y] = proj(d.alt, d.az);
      const big = d.id === 'lmc' || d.id === 'smc';
      const rr = (big ? (d.id === 'lmc' ? 7 : 4.5) : 3) * (size / 360);
      const label = d.name[lang] || d.name.en;
      const op = lim > 3 ? 0.55 : 0.18;
      deepEls.push(`<g class="sky-body sky-deep" data-id="deep:${d.id}" data-alt="${f1(d.alt)}" data-az="${f1(d.az)}"><title>${esc(`${label} · ${compass(d.az, lang)} ${Math.round(d.alt)}°`)}</title><ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(rr * 1.4)}" ry="${f1(rr)}" fill="${P.deep}" fill-opacity="${f2(op * 0.35)}" stroke="${P.deep}" stroke-opacity="${f2(op)}" stroke-width="0.7"/></g>`);
      if (lim > 3) tryLabel(x, y, label, rr * 1.4, 'sky-label-deep', P.deep, 0);
    }
  }
  // meteor shower radiants: a small burst where the meteors seem to come from
  const radEls = [];
  for (const r of o.radiants || []) {
    if (!(r.alt > 0)) continue;
    const [x, y] = proj(r.alt, r.az);
    const k = size / 360;
    let rays = '';
    for (let a = 0; a < 360; a += 45) {
      const sx_ = Math.sin(a * D2R), cy_ = Math.cos(a * D2R);
      rays += `M${f1(x + 2.6 * k * sx_)},${f1(y - 2.6 * k * cy_)}L${f1(x + (a % 90 ? 5 : 7) * k * sx_)},${f1(y - (a % 90 ? 5 : 7) * k * cy_)}`;
    }
    radEls.push(`<g class="sky-body sky-radiant" data-id="radiant:${esc(r.id)}" data-alt="${f1(r.alt)}" data-az="${f1(r.az)}"><title>${esc(`${r.title || r.name} · ${compass(r.az, lang)} ${Math.round(r.alt)}°`)}</title>`
      + `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(9 * k)}" fill="${P.meteor}" fill-opacity="0.07"/>`
      + `<path d="${rays}" fill="none" stroke="${P.meteor}" stroke-width="${f2(1.1 * k)}" stroke-linecap="round"/><circle cx="${f1(x)}" cy="${f1(y)}" r="${f2(1.4 * k)}" fill="${P.meteor}"/></g>`);
    tryLabel(x, y, r.name, 7 * k, 'sky-label-radiant', P.meteor, 1);
  }
  // the Sun
  const bodies = [];
  if (sunAlt > -1) {
    const r = 8 * (size / 360);
    bodies.push(`<g class="sky-body sky-sun" data-id="sun" data-alt="${f1(sunAlt)}" data-az="${f1(scene.sun.az)}"><title>${esc(`${bodyName('sun', lang)} · ${compass(scene.sun.az, lang)} ${Math.round(sunAlt)}°`)}</title><circle cx="${f1(sx)}" cy="${f1(sy)}" r="${f1(r * 2.2)}" fill="${P.sun}" fill-opacity="0.18"/><circle cx="${f1(sx)}" cy="${f1(sy)}" r="${f1(r)}" fill="${P.sun}"/></g>`);
    tryLabel(sx, sy, bodyName('sun', lang), r, 'sky-label-sun', P.sun, 3);
  }
  // planets, faintest first so the bright ones sit on top
  const planets = scene.planets.filter((p) => p.alt > -0.5).sort((a, b) => b.mag - a.mag);
  for (const p of planets) {
    const [x, y] = proj(p.alt, p.az);
    const r = Math.max(1.8, Math.min(4.6, 3.2 - 0.45 * p.mag)) * (size / 360);
    const col = PC ? PC[p.name] : P.star;
    const label = bodyName(p.name, lang);
    const faint = p.mag > lim + 0.5;
    const ring = p.name === 'saturn' ? `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(r * 2)}" ry="${f1(r * 0.7)}" fill="none" stroke="${col}" stroke-width="${f2(Math.max(0.7, r * 0.3))}" stroke-opacity="0.8" transform="rotate(-20 ${f1(x)} ${f1(y)})"/>` : '';
    bodies.push(`<g class="sky-body sky-planet" data-id="planet:${p.name}" data-alt="${f1(p.alt)}" data-az="${f1(p.az)}" data-mag="${f1(p.mag)}"${faint ? ' data-faint="1"' : ''}><title>${esc(`${label} · ${compass(p.az, lang)} ${Math.round(p.alt)}° · ${lang === 'zh' ? `亮度 ${p.mag.toFixed(1)} 等` : `mag ${p.mag.toFixed(1)}`}`)}</title><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r * 2.4)}" fill="${col}" fill-opacity="${faint ? 0.05 : 0.14}"/><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="${col}" fill-opacity="${faint ? 0.45 : 1}"/>${ring}</g>`);
    tryLabel(x, y, label, r * 1.6, 'sky-label-planet', col, 2);
  }
  // the Moon, lit side turned toward the Sun
  const m = scene.moon;
  if (m.alt > -0.5) {
    const [x, y] = proj(m.alt, m.az);
    const r = 7 * (size / 360);
    const ang = Math.atan2(sy - y, sx - x) / D2R;
    const lit = moonPhasePath(0, 0, r, m.illum, true);
    const label = bodyName('moon', lang);
    const phaseLabel = m.phaseName ? (m.phaseName[lang] || m.phaseName.en) : '';
    bodies.push(`<g class="sky-body sky-moon" data-id="moon" data-alt="${f1(m.alt)}" data-az="${f1(m.az)}" data-illum="${f2(m.illum)}"><title>${esc(`${label} · ${phaseLabel} ${Math.round(m.illum * 100)}% · ${compass(m.az, lang)} ${Math.round(m.alt)}°`)}</title>`
      + `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r * 2.2)}" fill="${P.moonLit}" fill-opacity="${f2(0.06 + 0.12 * m.illum)}"/>`
      + `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(ang)})"><circle r="${f1(r)}" fill="${P.moonDark}" stroke="${P.moonLit}" stroke-opacity="0.35" stroke-width="0.6"/>${lit ? `<path d="${lit}" fill="${P.moonLit}"/>` : ''}</g></g>`);
    tryLabel(x, y, label, r, 'sky-label-moon', P.moonLabel || P.moonLit, 3);
  }
  // figure names, at the middle of each figure's visible lines
  const figNames = [];
  if (o.figureNames && names.figures) {
    for (const [fig, pts] of Object.entries(figSeen)) {
      const nm = names.figures[fig];
      if (!nm || pts.length < 4) continue;
      const x = pts.reduce((s, p) => s + p[0], 0) / pts.length;
      const y = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      if (Math.hypot(x - cx, y - cy) > R - 12) continue;
      const text = nm[lang] || nm.en;
      const w = text.length * fs * (lang === 'zh' ? 0.9 : 0.5);
      if (placed.some((p) => x - w / 2 < p[0] + p[2] && x + w / 2 > p[0] && y - fs < p[1] + p[3] && y > p[1])) continue;
      placed.push([x - w / 2, y - fs, w, fs]);
      figNames.push(`<text x="${f1(x)}" y="${f1(y)}" text-anchor="middle" font-size="${Math.round(fs * 0.85)}" fill="${P.line}" fill-opacity="0.75" letter-spacing="0.06em" class="sky-label-figure">${esc(text)}</text>`);
    }
  }
  out.push(`<g class="sky-stars">${starEls.join('')}</g>`);
  out.push(`<g class="sky-deepsky">${deepEls.join('')}</g>`);
  if (radEls.length) out.push(`<g class="sky-radiants">${radEls.join('')}</g>`);
  out.push(`<g class="sky-bodies">${bodies.join('')}</g>`);
  out.push(`<g class="sky-labels" font-size="${fs}">${figNames.join('')}${labels.map((l) => `<text x="${f1(l.x)}" y="${f1(l.y)}" fill="${l.color}" class="${l.cls}">${esc(l.text)}</text>`).join('')}</g>`);
  // horizon ring, ticks and the four directions (east on the left)
  out.push(`<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${P.rim}" stroke-width="1.4"/>`);
  for (let a = 0; a < 360; a += 15) {
    const major = a % 90 === 0, mid = a % 45 === 0;
    const len = major ? 7 : mid ? 5 : 3;
    const s = Math.sin(a * D2R + rot), c = Math.cos(a * D2R + rot);
    out.push(`<line x1="${f1(cx - R * s)}" y1="${f1(cy - R * c)}" x2="${f1(cx - (R + len) * s)}" y2="${f1(cy - (R + len) * c)}" stroke="${P.rim}" stroke-width="${major ? 1.4 : 1}"/>`);
  }
  const card = lang === 'zh' ? ['北', '东', '南', '西'] : ['N', 'E', 'S', 'W'];
  const cfs = Math.round(fs * 1.15);
  const off = R + margin * 0.62;
  card.forEach((label, k) => {
    const a = k * 90 * D2R + rot;
    const x = cx - off * Math.sin(a), y = cy - off * Math.cos(a) + cfs * 0.35;
    out.push(`<text x="${f1(x)}" y="${f1(y)}" text-anchor="middle" font-size="${cfs}" font-weight="600" fill="${P.cardinal}" class="sky-cardinal">${label}</text>`);
  });
  out.push('</svg>');
  return out.join('');
}
