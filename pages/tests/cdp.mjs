// Minimal Chrome DevTools Protocol driver for the page checks and screenshots.
//   node pages/tests/cdp.mjs pages/tests/test.mjs     (the script default-exports async (api) => {...})
// env: CHROME (binary), CHROME_PROFILE_ROOT (where throwaway profiles go; default: the temp folder),
//      PAGE (URL of the built page; default: pages/dist/index.html as a file:// URL)
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const PAGE = process.env.PAGE || pathToFileURL(join(HERE, '..', 'dist', 'index.html')).href;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const port = 9300 + Math.floor(Math.random() * 500);
const profile = join(process.env.CHROME_PROFILE_ROOT || tmpdir(), `pages-run-${Date.now()}-${process.pid}`);
mkdirSync(profile, { recursive: true });
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--lang=en-US', 'about:blank'],
{ stdio: 'ignore' });

let wsUrl;
for (let i = 0; i < 100 && !wsUrl; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    wsUrl = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
  } catch { /* not up yet */ }
  if (!wsUrl) await sleep(100);
}
if (!wsUrl) { console.error('no chrome'); proc.kill(); process.exit(1); }

const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let nextId = 1;
const pending = new Map();
const listeners = new Map();
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error))); else resolve(msg.result);
  } else if (msg.method) {
    for (const cb of listeners.get(msg.method) || []) cb(msg.params);
  }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const on = (method, cb) => { if (!listeners.has(method)) listeners.set(method, []); listeners.get(method).push(cb); };

const requests = [];
const consoleMsgs = [];
on('Network.requestWillBeSent', (p) => requests.push(p.request.url));
on('Runtime.consoleAPICalled', (p) => consoleMsgs.push(`${p.type}: ${p.args.map((a) => a.value ?? a.description).join(' ')}`));
on('Runtime.exceptionThrown', (p) => consoleMsgs.push(`EXCEPTION: ${p.exceptionDetails.exception?.description || p.exceptionDetails.text}`));
on('Log.entryAdded', (p) => consoleMsgs.push(`log ${p.entry.level}: ${p.entry.text} ${p.entry.url || ''}`));
await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Log.enable');
// behave like a focused window, so focus and focusin events fire as they do for a visitor
await send('Emulation.setFocusEmulationEnabled', { enabled: true });
// R3.3 batch 2: the first-visit tour (#119) would sit over what the checks click, so every page
// opens as if it had been seen, unless a check asks for it (sessionStorage 'pages-test-tour';
// ?tour=1 shows it in any case). DevTools adds this before the page's own scripts run.
await send('Page.addScriptToEvaluateOnNewDocument', { source: "try { if (!sessionStorage.getItem('pages-test-tour')) localStorage.setItem('ls7-tour', 'done'); } catch (e) {}" });

const api = {
  send, on, sleep, requests, consoleMsgs, PAGE,
  async viewport(w, h, { mobile = false, dpr = 1, dark = true, reduce = false } = {}) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile });
    await send('Emulation.setTouchEmulationEnabled', mobile ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
    await send('Emulation.setEmulatedMedia', { features: [
      { name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' },
      { name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' },
    ] });
  },
  async go(suffix, wait = 1200) {
    // a fresh document every time: go through about:blank so hash-only changes still reload
    await send('Page.navigate', { url: 'about:blank' });
    await sleep(100);
    const loaded = new Promise((r) => { on('Page.loadEventFired', r); setTimeout(r, 6000); });
    await send('Page.navigate', { url: PAGE + suffix });
    await loaded;
    await sleep(wait);
  },
  async eval(expr) {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  },
  async shot(file, clip) {
    const { data } = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { scale: 1, ...clip } } : {}) });
    if (file) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, Buffer.from(data, 'base64')); }
    return file || Buffer.from(data, 'base64');
  },
  async mouse(type, x, y, extra = {}) {
    await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse', ...extra });
  },
  async move(x, y) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, pointerType: 'mouse' }); },
  async drag(x0, y0, x1, y1, steps = 12, stepMs = 16, { release = true } = {}) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0, y: y0 });
    await api.mouse('mousePressed', x0, y0);
    for (let i = 1; i <= steps; i++) {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + (x1 - x0) * i / steps, y: y0 + (y1 - y0) * i / steps, button: 'left', buttons: 1 });
      await sleep(stepMs);
    }
    if (release) await api.mouse('mouseReleased', x1, y1);
  },
  async click(x, y) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await api.mouse('mousePressed', x, y);
    await api.mouse('mouseReleased', x, y);
  },
  async touchSwipe(x0, y0, x1, y1, steps = 10, stepMs = 16, { release = true } = {}) {
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 1 }] });
    for (let i = 1; i <= steps; i++) {
      await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / steps, y: y0 + (y1 - y0) * i / steps, id: 1 }] });
      await sleep(stepMs);
    }
    if (release) await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  },
  async tap(x, y) {
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  },
  async key(key, { code, text, keyCode, shift = false, meta = false, ctrl = false } = {}) {
    const codes = { ArrowRight: 39, ArrowLeft: 37, ArrowUp: 38, ArrowDown: 40, Enter: 13, Escape: 27, Tab: 9, ' ': 32, Home: 36, End: 35, '/': 191, n: 78, c: 67, k: 75 };
    const kc = keyCode ?? codes[key] ?? 0;
    // no nativeVirtualKeyCode: on macOS those are different numbers and can trigger browser shortcuts
    const printable = key.length === 1;
    const modifiers = (shift ? 8 : 0) | (meta ? 4 : 0) | (ctrl ? 2 : 0);
    const params = { key, code: code ?? (key === ' ' ? 'Space' : key === '/' ? 'Slash' : printable ? `Key${key.toUpperCase()}` : key), windowsVirtualKeyCode: kc, modifiers };
    await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...params });
    // with Cmd or Ctrl held a key types nothing
    const ch = meta || ctrl ? undefined : text ?? (key === 'Enter' ? '\r' : printable ? key : undefined);
    if (ch) await send('Input.dispatchKeyEvent', { type: 'char', text: ch, ...params });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', ...params });
  },
  async type(text) { for (const ch of text) await api.key(ch); },
  async wheel(x, y, dx, dy) {
    // headless Chrome may never ack a cancelled wheel that scrolls nothing: don't wait for it
    send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: dx, deltaY: dy }).catch(() => {});
    await sleep(250);
  },
};

const script = process.argv[2];
// the whole suite takes about 11 minutes on a Mac since R3.3 batch 6 (7 in batch 1b); a CI machine
// may be slower, so every run ends by saying how long it took, with a warning past 80% of the limit
const LIMIT = Number(process.env.WATCHDOG || 900000);
const started = Date.now();
const watchdog = setTimeout(() => { console.error('WATCHDOG: script took too long'); proc.kill(); process.exit(2); }, LIMIT);
try {
  const mod = await import(pathToFileURL(script).href);
  await mod.default(api);
} catch (e) {
  console.error('SCRIPT ERROR', e);
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
  const took = (Date.now() - started) / 1000;
  console.log(`cdp: ${script.split(/[\\/]/).pop()} took ${took.toFixed(0)} s of its ${LIMIT / 1000} s limit${took > (LIMIT / 1000) * 0.8 ? ' (over 80%: make the slow checks leaner or split them before raising WATCHDOG)' : ''}`);
  ws.close();
  proc.kill();
  setTimeout(() => { try { rmSync(profile, { recursive: true, force: true }); } catch { /* still in use */ } }, 300);
}
