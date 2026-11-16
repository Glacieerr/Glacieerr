// Text contrast against what is really painted behind it: hide the text, screenshot its box,
// and compare the text colour with every background pixel (WCAG relative luminance).
// The PNG reader is pages/tests/png.mjs (shared with the screenshot comparison, idea #179).
import { decodePNG } from './png.mjs';

export { decodePNG };

const lin = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

/**
 * Contrast of `selector`'s text over the pixels behind it.
 * Returns { p05, min, median }: p05 is the contrast that 95% of the background reaches.
 */
export async function contrastOf(api, selector) {
  const info = await api.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const m = getComputedStyle(el).color.match(/[\\d.]+/g).map(Number);
    el.dataset.ctxVis = el.style.visibility;
    el.style.visibility = 'hidden';
    return { x: Math.max(0, r.left), y: Math.max(0, r.top), w: Math.min(r.width, innerWidth - Math.max(0, r.left)), h: Math.min(r.height, innerHeight - Math.max(0, r.top)), rgb: m.slice(0, 3), a: m.length > 3 ? m[3] : 1 };
  })()`);
  if (!info || info.w < 2 || info.h < 2) return null;
  await api.sleep(60);
  const png = await api.shot(null, { x: info.x, y: info.y, width: info.w, height: info.h });
  await api.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.style.visibility = el.dataset.ctxVis || ''; })()`);
  const img = decodePNG(png);
  const [tr, tg, tb] = info.rgb;
  const vals = [];
  for (let i = 0; i < img.data.length; i += 4) {
    const r = img.data[i];
    const g = img.data[i + 1];
    const b = img.data[i + 2];
    // the text colour composited over this pixel (browsers blend in sRGB)
    const er = info.a * tr + (1 - info.a) * r;
    const eg = info.a * tg + (1 - info.a) * g;
    const eb = info.a * tb + (1 - info.a) * b;
    const l1 = lum(er, eg, eb);
    const l2 = lum(r, g, b);
    vals.push((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05));
  }
  vals.sort((p, q) => p - q);
  const at = (f) => vals[Math.min(vals.length - 1, Math.floor(vals.length * f))];
  return { p05: +at(0.05).toFixed(2), min: +vals[0].toFixed(2), median: +at(0.5).toFixed(2) };
}
