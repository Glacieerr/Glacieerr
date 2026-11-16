// Serves the built page (pages/dist/) on http://127.0.0.1:4180/ for the cross-browser smoke test,
// so it runs from a web address as on GitHub Pages rather than from a file. Node only, no packages.
//   node tests-xbrowser/serve.mjs        (Playwright starts it itself: playwright.config.mjs, webServer)
// Text goes out gzipped to a browser that asks for it, as GitHub Pages sends it; the Lighthouse
// job in .github/workflows/pages.yml (idea #180) serves the page with this too.
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const DIST = fileURLToPath(new URL('../pages/dist/', import.meta.url));
const PORT = Number(process.env.PORT || 4180);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.pdf': 'application/pdf', '.webp': 'image/webp',
};

if (!existsSync(join(DIST, 'index.html'))) {
  console.error(`serve: ${join(DIST, 'index.html')} is missing; build it first (python3 pages/build.py)`);
  process.exit(1);
}

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (path === '/favicon.ico') {            // browsers ask for it on their own; the page has none to give
    res.writeHead(204).end();
    return;
  }
  const file = normalize(join(DIST, path.endsWith('/') ? `${path}index.html` : path));
  if (!file.startsWith(DIST)) {
    res.writeHead(403).end();
    return;
  }
  try {
    let body = await readFile(file);
    const headers = { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' };
    if (/\bgzip\b/.test(req.headers['accept-encoding'] || '') && /^(text\/|application\/(json|xml)|image\/svg)/.test(headers['content-type'])) {
      body = gzipSync(body);
      headers['content-encoding'] = 'gzip';
      headers.vary = 'Accept-Encoding';
    }
    res.writeHead(200, headers);
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found');
  }
}).listen(PORT, '127.0.0.1', () => console.log(`serve: ${DIST} at http://127.0.0.1:${PORT}/`));
