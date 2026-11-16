// How fast the page shows up (idea #180), measured over the DevTools protocol in headless Chrome:
//   node pages/tests/cdp.mjs pages/tests/perf.mjs     (RUNS=3 by default; OUT=<file.json> keeps the numbers; DIST=<folder> another build)
// It serves pages/dist/ on 127.0.0.1 with gzip, as GitHub Pages does, and loads the page RUNS
// times in each of two settings: a desktop (no throttling) and a phone on a slow 4G network with
// a CPU four times slower (the values Lighthouse's DevTools throttling uses for mobile: 562.5 ms
// round trip, 1.47 Mbit/s down, 0.68 Mbit/s up). For each it reports the median of: first
// contentful paint, the first moment the clock shows the time, largest contentful paint (and what
// it was), cumulative layout shift, long tasks (how many, the longest, and the blocking time after
// the first paint: each one's time over 50 ms), DOMContentLoaded and load, and the bytes: over the
// wire (gzip) and unpacked, and the number of requests (one: the page itself; giscus loads only
// after a click). The local Lighthouse job in CI (pages.yml) gives the scores; this gives the
// numbers behind them on your own machine, with nothing to install.
import { createServer } from 'node:http';
import { readFileSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const DIST = process.env.DIST ? `${process.env.DIST.replace(/\/$/, '')}/` : fileURLToPath(new URL('../dist/', import.meta.url));
const RUNS = Number(process.env.RUNS || 3);
const TYPES = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.css': 'text/css; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.pdf': 'application/pdf' };

// recorded from the first moment of every document, before the page's own scripts
const OBSERVE = `(() => {
  const P = window.__perf = { lcp: [], cls: 0, shifts: 0, long: [], clock: null };
  const po = (type, cb) => { try { new PerformanceObserver((l) => l.getEntries().forEach(cb)).observe({ type, buffered: true }); } catch (e) {} };
  po('largest-contentful-paint', (e) => P.lcp.push({ t: e.startTime, size: e.size, what: e.element ? (e.element.id ? '#' + e.element.id : e.element.className ? '.' + String(e.element.className).split(' ')[0] : e.element.tagName) : e.url.slice(0, 30) }));
  po('layout-shift', (e) => { if (!e.hadRecentInput) { P.cls += e.value; P.shifts++; } });
  po('longtask', (e) => P.long.push({ t: e.startTime, d: e.duration }));
  const mo = new MutationObserver(() => { const hm = document.getElementById('hm'); if (hm && /^\\d{1,2}:\\d{2}$/.test(hm.textContent) && hm.textContent !== '9:41' && P.clock == null) { P.clock = performance.now(); mo.disconnect(); } });
  mo.observe(document, { subtree: true, childList: true, characterData: true });
})();`;

const median = (xs) => { const s = xs.filter((x) => x != null).sort((a, b) => a - b); return s.length ? s[(s.length - 1) >> 1] : null; };

export default async function (api) {
  const { sleep, send, on } = api;
  if (!existsSync(join(DIST, 'index.html'))) throw new Error('build the page first: python3 pages/build.py');
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = normalize(join(DIST, path.endsWith('/') ? `${path}index.html` : path));
    if (!file.startsWith(DIST) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404).end(); return; }
    let body = readFileSync(file);
    const headers = { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' };
    if (/\bgzip\b/.test(req.headers['accept-encoding'] || '') && /html|css|text|xml/.test(headers['content-type'])) { body = gzipSync(body, { level: 6 }); headers['content-encoding'] = 'gzip'; }
    res.writeHead(200, headers).end(body);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const url = `${origin}/?lang=en`;
  const net = new Map();
  on('Network.responseReceived', (p) => { const n = net.get(p.requestId) || {}; n.url = p.response.url; n.status = p.response.status; net.set(p.requestId, n); });
  on('Network.loadingFinished', (p) => { const n = net.get(p.requestId) || {}; n.wire = p.encodedDataLength; net.set(p.requestId, n); });
  on('Network.dataReceived', (p) => { const n = net.get(p.requestId) || {}; n.raw = (n.raw || 0) + p.dataLength; net.set(p.requestId, n); });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: OBSERVE });
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Emulation.setTimezoneOverride', { timezoneId: 'America/New_York' });

  const settings = [
    { name: 'desktop', w: 1350, h: 940, mobile: false, cpu: 1, net: null, settle: 4000 },
    { name: 'phone, slow 4G, 4x slower CPU', w: 412, h: 823, mobile: true, cpu: 4, net: { latency: 562.5, downloadThroughput: (1474.56 * 1024) / 8, uploadThroughput: (675 * 1024) / 8 }, settle: 8000 },
  ];
  const report = { url, runs: RUNS, raw: readFileSync(join(DIST, 'index.html')).length, gzip: gzipSync(readFileSync(join(DIST, 'index.html')), { level: 6 }).length, settings: [] };
  for (const s of settings) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) {
      await api.viewport(s.w, s.h, { mobile: s.mobile, dark: true });
      await send('Emulation.setCPUThrottlingRate', { rate: s.cpu });
      await send('Network.emulateNetworkConditions', s.net ? { offline: false, ...s.net } : { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
      await send('Page.navigate', { url: 'about:blank' });
      await sleep(200);
      await send('Network.clearBrowserCache');
      net.clear();
      const loaded = new Promise((r) => { on('Page.loadEventFired', r); setTimeout(r, 60000); });
      await send('Page.navigate', { url });
      await loaded;
      await sleep(s.settle);
      const m = await api.eval(`(() => { const P = window.__perf; const nav = performance.getEntriesByType('navigation')[0]; const fcp = (performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime ?? null; const lcp = P.lcp.at(-1) || {};
        const after = P.long.filter((x) => fcp == null || x.t + x.d > fcp);
        return { fcp, clock: P.clock, lcp: lcp.t ?? null, lcpWhat: lcp.what || '', lcpSize: lcp.size || 0, cls: P.cls, shifts: P.shifts, longN: P.long.length, longMax: Math.max(0, ...P.long.map((x) => x.d)), tbt: after.reduce((a, x) => a + Math.max(0, x.d - 50), 0),
          dcl: nav.domContentLoadedEventEnd, load: nav.loadEventEnd, heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null }; })()`);
      const reqs = [...net.values()].filter((n) => n.url && /^https?:/.test(n.url));
      m.requests = reqs.length;
      m.wire = reqs.reduce((a, n) => a + (n.wire || 0), 0);
      m.unpacked = reqs.reduce((a, n) => a + (n.raw || 0), 0);
      runs.push(m);
    }
    await send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    const med = Object.fromEntries(Object.keys(runs[0]).map((k) => [k, typeof runs[0][k] === 'number' ? median(runs.map((r) => r[k])) : runs[0][k]]));
    report.settings.push({ name: s.name, median: med, runs });
    const ms = (v) => (v == null ? 'n/a' : `${Math.round(v)} ms`);
    console.log(`\n${s.name} (median of ${RUNS})`);
    console.log(`  first contentful paint ${ms(med.fcp)} · the clock shows the time ${ms(med.clock)} · largest contentful paint ${ms(med.lcp)} (${med.lcpWhat}, ${med.lcpSize} px²)`);
    console.log(`  layout shift ${med.cls.toFixed(4)} (${med.shifts} shifts) · long tasks ${med.longN}, longest ${ms(med.longMax)}, blocking time after first paint ${ms(med.tbt)}`);
    console.log(`  DOMContentLoaded ${ms(med.dcl)} · load ${ms(med.load)} · ${med.requests} request(s), ${(med.wire / 1024).toFixed(0)} KB over the wire, ${(med.unpacked / 1024).toFixed(0)} KB unpacked${med.heapMB != null ? ` · JS heap ${med.heapMB} MB` : ''}`);
  }
  console.log(`\npages/dist/index.html: ${(report.raw / 1024).toFixed(0)} KB, ${(report.gzip / 1024).toFixed(0)} KB with gzip`);
  if (process.env.OUT) writeFileSync(process.env.OUT, `${JSON.stringify(report, null, 2)}\n`);
  server.close();
}
