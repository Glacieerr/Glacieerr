// Vercel Function: the live banner for the GitHub profile README.
//   GET /api/lockscreen?theme=dark|light&layout=below|right|portrait&weight=bold|thin&weather=1
// Defaults: dark, below, bold. theme is the GitHub page mode the art is drawn for (the README
// asks for dark art on dark pages and light art on light pages). The wallpaper names used
// before the Dusk Tech restyle still work: midnight, orbit, blossom, aurora -> dark;
// lagoon, dawn -> light.
// Deploy: import this repository as a Vercel project (no build step). The README points
// its banner <img> at https://<project>.vercel.app/api/lockscreen?... .
// Per request it also colours the glow behind the avatar by the Sun's altitude over Albany
// (idea #97, data.place) and adds the festival touches of idea #150 (live/holidays.mjs).
import data from '../live/templates.mjs';
import { renderLive, weatherLabel } from '../live/lockscreen-core.mjs';
import { festivalOn } from '../live/holidays.mjs';

const ALBANY = { lat: 42.65, lon: -73.75 };
const THEMES = ['dark', 'light'];
const LAYOUTS = ['below', 'right', 'portrait'];
const WEIGHTS = ['bold', 'thin'];
const OLD_NAMES = data.aliases || { midnight: 'dark', orbit: 'dark', blossom: 'dark', aurora: 'dark', lagoon: 'light', dawn: 'light' };
let wx = { at: 0, label: null };

async function weather() {
  if (Date.now() - wx.at < 30 * 60 * 1000) return wx.label;     // ask at most every 30 minutes
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 800);           // never hold the image up
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${ALBANY.lat}&longitude=${ALBANY.lon}`
      + '&current=temperature_2m,weather_code&temperature_unit=fahrenheit';
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    const j = await res.json();
    wx = { at: Date.now(), label: weatherLabel(j.current.weather_code, j.current.temperature_2m) };
  } catch {
    wx = { at: Date.now(), label: null };
  }
  return wx.label;
}

const pick = (v, ok, d) => (ok.includes(v) ? v : d);

export async function GET(request) {
  const q = new URL(request.url).searchParams;
  const theme = OLD_NAMES[q.get('theme')] || pick(q.get('theme'), THEMES, 'dark');
  const key = [
    theme,
    pick(q.get('layout'), LAYOUTS, 'below'),
    pick(q.get('weight'), WEIGHTS, 'bold'),
  ].join('-');
  const svg = renderLive(data.templates[key], {
    ...data.meta[key],            // the AM/PM look and the muted colour of this page mode
    images: data.images,
    timeZone: data.timezone,
    place: data.place || ALBANY,        // the Sun's altitude here colours the avatar's glow
    festival: festivalOn,               // New Year's Day, the Spring Festival, the Mid-Autumn Festival
    weather: q.get('weather') === '1' ? await weather() : null,
  });
  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      // camo (GitHub's image proxy) re-fetches on every view only when told not to cache
      'cache-control': 'no-cache, no-store, must-revalidate, max-age=0',
      'x-content-type-options': 'nosniff',
    },
  });
}
