// Interaction checks for pages/dist/index.html over CDP (headless Chrome).
//   node pages/tests/cdp.mjs pages/tests/test.mjs
// Part 1 keeps the checks of the first design (r1); where the behaviour changed on purpose
// (swipe up -> drag right, theme menu -> Quick settings, sheets -> apps on the home screen) the
// check tests the new equivalent and says so in its name. Part 2 covers the Dusk Tech pieces
// (GitHub主页方案/dusk-spec.md): the dusk background, the top bar, the banner at page scale,
// the Unlock pill, Today, Quick settings, Search (Cmd+K), detail pages, contrast in both modes.
// Parts 3 to 5 cover R3.2 and R3.3 (batch 1a: the Sky app; batch 1b: calendar and time); part 6
// covers R3.3 batch 2 (the shell, the experience and privacy), part 7 batch 3 (the work and
// recruiters: the quick view, present mode, the pick game, How I work), part 8 batch 6 (the page at the edges
// of time, #177: pages/tests/time-edges.mjs). A run with nothing failed writes
// pages/tests/last-run.json, the count the About panel shows (pages/build.py reads it).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { contrastOf } from './contrast.mjs';
import { timeEdges } from './time-edges.mjs';
import * as Astro from '../../live/astro.mjs';

let pass = 0;
let fail = 0;
const failures = [];
const T0 = Date.now();
const stamp = () => `${((Date.now() - T0) / 1000).toFixed(1).padStart(6)}s`;
const ok = (cond, name, extra = '') => {
  if (cond) { pass++; console.log(stamp(), 'PASS', name); } else { fail++; failures.push(name); console.log(stamp(), 'FAIL', name, extra); }
};

export default async function (api) {
  const { sleep } = api;
  const rect = (sel) => api.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height, l: r.left, t: r.top, r: r.right, b: r.bottom}; })()`);
  const st = () => api.eval(`(() => { const $ = (s) => document.querySelector(s); const open = (id) => !$(id).hidden && $(id).classList.contains('open'); const a = document.activeElement; return {
    hash: location.hash, view: document.body.dataset.view, sheet: open('#sheetLayer'), app: $('#appLayer').hidden ? null : $('#appView').dataset.app,
    folder: open('#folderLayer'), nc: open('#nc'), cc: open('#cc'), spot: open('#spot'),
    sl: Math.round($('#track').scrollLeft), dot: [...document.querySelectorAll('#dots .dot')].findIndex(d => d.getAttribute('aria-current') === 'true'),
    dots: document.querySelectorAll('#dots .dot').length,
    active: (a.dataset.lang || a.id || a.dataset.sheet || (a.dataset.note ? 'note:' + a.dataset.note : '') || a.dataset.app || a.dataset.appearance || a.className || a.tagName),
    appearance: document.documentElement.dataset.appearance, thin: document.documentElement.classList.contains('thin'), lang: document.documentElement.lang,
    theme: document.querySelector('meta[name=theme-color]').content }; })()`);
  const wheelAt = (x, y, dy) => api.eval(`(() => { const el = document.elementFromPoint(${x}, ${y}); const ev = new WheelEvent('wheel', {deltaY: ${dy}, deltaX: 0, deltaMode: 0, clientX: ${x}, clientY: ${y}, bubbles: true, cancelable: true}); el.dispatchEvent(ev); return ev.defaultPrevented; })()`);
  const text = (sel) => api.eval(`(document.querySelector(${JSON.stringify(sel)}) || {}).textContent || ''`);
  const css = (sel, prop, pseudo = null) => api.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return e ? getComputedStyle(e, ${JSON.stringify(pseudo)})[${JSON.stringify(prop)}] : null; })()`);
  const data = () => api.eval(`JSON.parse(document.getElementById('data').textContent)`);
  const clickOn = async (sel) => {
    await api.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (e) e.scrollIntoView({block: 'nearest'}); })()`);
    await sleep(60);
    const r = await rect(sel);
    await api.click(r.x, r.y);
  };
  // what the page should say, computed independently from the data block and Intl
  const albany = () => api.eval(`(() => { const f = new Intl.DateTimeFormat('en-US', {timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, year: 'numeric'}); const o = {}; for (const p of f.formatToParts(new Date())) o[p.type] = p.value; const iso = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date()); return {hm: o.hour + ':' + o.minute, date: o.weekday + ', ' + o.month + ' ' + o.day, ap: o.dayPeriod, day: o.day, weekday: o.weekday, year: o.year, iso}; })()`);
  const fmtISO = (iso, opts, loc = 'en-US') => { const [y, m, d] = iso.split('-').map(Number); return new Intl.DateTimeFormat(loc, { timeZone: 'UTC', ...opts }).format(new Date(Date.UTC(y, (m || 1) - 1, d || 1))); };
  const D = await (async () => { await api.viewport(1280, 800, { dark: true }); await api.go('?lang=en', 800); return data(); })();
  const A0 = await albany();
  const shortDate = (iso) => (/^\d{4}-\d{2}$/.test(iso) ? fmtISO(iso, { month: 'short', year: 'numeric' })
    : fmtISO(iso, iso.slice(0, 4) === A0.iso.slice(0, 4) ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' }));
  const fps = async (label) => console.log(stamp(), '  frames/s at', label, JSON.stringify(await api.eval(`new Promise(r => { let n = 0; const f = () => { n++; requestAnimationFrame(f); }; requestAnimationFrame(f); setTimeout(() => r([n, document.visibilityState]), 1000); })`)));
  const nums = (t) => (t.match(/-?[\d.]+(?=px)/g) || []).map(Number);

  console.log('---- part 1: the checks of the first design');
  // ---------------- desktop
  await api.viewport(1280, 800, { dark: true });
  await api.go('?lang=en', 1200);
  let s = await st();
  ok(s.appearance === 'dark' && s.theme === '#08090c', 'auto appearance follows dark mode -> the dark page, theme-color #08090c (was: auto theme -> orbit)', JSON.stringify(s));
  const t1 = await api.eval(`[document.getElementById('hm').textContent, document.getElementById('sec').textContent, document.getElementById('date').textContent, document.getElementById('ap').textContent]`);
  const A1 = await albany();
  ok(t1[0] === A1.hm && t1[2] === A1.date && t1[3] === A1.ap, 'clock shows Albany time and date', JSON.stringify([t1, A1]));
  await sleep(1100);
  const t2 = await text('#sec');
  ok(t2 !== t1[1], 'seconds tick every second', `${t1[1]} -> ${t2}`);
  const sr = await text('#timeSr');
  ok(/\d{1,2}:\d{2} (AM|PM)/.test(sr), 'screen reader time text', sr);
  const wimg = await api.eval(`(async () => { const ws = [...document.querySelectorAll('#track .w')]; const urls = new Set(); for (const w of ws) for (const e of w.querySelectorAll('[class*="img-"]')) { const m = getComputedStyle(e).backgroundImage.match(/url\\("?(data:[^")]+)"?\\)/); if (m) urls.add(m[1]); } let decoded = 0; for (const u of urls) { const i = new Image(); i.src = u; try { await i.decode(); if (i.naturalWidth > 0) decoded++; } catch (e) {} } return {n: ws.length, labelled: ws.filter(w => (w.getAttribute('aria-label') || '').length > 20).length, content: ws.filter(w => w.querySelector('.wc')).length, urls: urls.size, decoded}; })()`);
  ok(wimg.n === 7 && wimg.labelled === 7 && wimg.content === 7 && wimg.urls >= 4 && wimg.decoded === wimg.urls, 'all 7 widgets render, with names, and their photos decode (was: 7 widget images)', JSON.stringify(wimg));
  const icons = await api.eval(`(async () => { const ic = [...document.querySelectorAll('#grid .app > .ico, #dockList .dock-app > .ico')]; const glyphs = ic.filter(i => i.querySelector('use, .face, .cal-d, .fmini')).length; const sn = document.querySelector('#grid .img-sn-icon'); const u = getComputedStyle(sn).backgroundImage.match(/url\\("?(data:[^")]+)"?\\)/)[1]; const im = new Image(); im.src = u; await im.decode(); return {n: ic.length, glyphs, snW: im.naturalWidth}; })()`);
  ok(icons.n === 11 && icons.glyphs === 10 && icons.snW >= 168, 'all 11 app icons render (the Sky and, in R3.3 batch 2, the Guestbook are new), SilNest icon decodes (was: 6 icons)', JSON.stringify(icons));
  ok(s.dots === 3 && s.dot === 0 && s.sl === 0, 'desktop: 3 dots, first active', JSON.stringify(s));

  const tr = await rect('#track');
  await api.drag(tr.x + 200, tr.y, tr.x - 220, tr.y, 14, 16);
  await sleep(1000);
  s = await st();
  ok(s.dot === 1 && s.sl > 300 && !s.sheet && s.view === 'lock', 'mouse drag pages the row (no panel opened)', JSON.stringify(s));
  ok(!(await api.eval(`document.getElementById('track').classList.contains('dragging')`)), 'snap restored after drag');
  await api.drag(tr.x - 200, tr.y, tr.x + 220, tr.y, 14, 16);
  await sleep(1000);
  s = await st();
  ok(s.dot === 0 && s.sl === 0 && s.view === 'lock', 'mouse drag back', JSON.stringify(s));

  await api.eval(`document.activeElement.blur()`);
  await api.key('ArrowRight');
  await sleep(900);
  s = await st();
  ok(s.dot === 1, 'ArrowRight pages the row', JSON.stringify(s));
  await api.key('ArrowLeft');
  await sleep(900);
  s = await st();
  ok(s.dot === 0, 'ArrowLeft pages back', JSON.stringify(s));

  ok(await wheelAt(tr.x, tr.y, 120), 'wheel over the row is handled');
  await sleep(900);
  s = await st();
  ok(s.dot === 1 && s.view === 'lock', 'vertical wheel over the row pages it', JSON.stringify(s));
  await sleep(300);
  await wheelAt(tr.x, tr.y, -120);
  await sleep(900);
  await fps('after wheel tests');

  const w0 = await rect('.w[data-sheet="silnest"]');
  await api.click(w0.x, w0.y);
  await sleep(700);
  s = await st();
  ok(s.sheet && s.hash === '#silnest' && s.active === 'sheetTitle', 'click widget opens its panel, focus on title', JSON.stringify(s));
  const inert = await api.eval(`[document.getElementById('lock').inert, document.getElementById('topbar').inert, document.getElementById('ncGrab').inert]`);
  ok(inert.every(Boolean), 'background is inert while the panel is open', JSON.stringify(inert));
  const links = await api.eval(`[...document.querySelectorAll('#sheetLinks a')].map(a => [a.textContent, a.href, a.target])`);
  ok(links.length === 1 && links[0][1] === 'https://apps.apple.com/app/id6796483224' && links[0][2] === '_blank', 'silnest panel links to the App Store', JSON.stringify(links));
  await api.key('Tab'); await api.key('Tab'); await api.key('Tab'); await api.key('Tab');
  ok(await api.eval(`document.getElementById('sheet').contains(document.activeElement)`), 'Tab stays inside the panel');
  await api.key('Escape');
  await sleep(700);
  s = await st();
  ok(!s.sheet && s.hash === '' && s.active === 'silnest', 'Escape closes the panel and returns focus to the widget', JSON.stringify(s));

  for (let i = 0; i < 4; i++) { await api.key('ArrowRight'); await sleep(150); }
  await sleep(800);
  s = await st();
  ok(s.active === 'site' && s.dot >= 1, 'arrow keys move focus along the row and scroll it', JSON.stringify(s));
  await api.key('ArrowLeft');
  await sleep(700);
  s = await st();
  ok(s.active === 'accuracy', 'arrow key back to the accuracy widget', JSON.stringify(s));
  await api.key('Enter');
  await sleep(700);
  s = await st();
  ok(s.sheet && s.hash === '#accuracy', 'Enter on a widget opens its panel', JSON.stringify(s));
  const stats = await api.eval(`[...document.querySelectorAll('#sheetStats dd')].map(d => d.textContent)`);
  const accTitle = await text('#sheetTitle');
  ok(JSON.stringify(stats) === JSON.stringify([`${D.facts.assistant.score}%`, `${D.facts.assistant.baseline}%`, '80']) && accTitle === 'Duty assistant',
    'accuracy panel stats come from profile.json, labelled as the duty assistant', JSON.stringify([stats, accTitle]));
  await api.eval(`history.back()`);
  await sleep(700);
  s = await st();
  ok(!s.sheet && s.hash === '', 'back button closes the panel', JSON.stringify(s));
  await fps('before tab test');

  await api.go('?lang=en', 1000);
  const order = [];
  for (let i = 0; i < 22; i++) { await api.key('Tab'); order.push((await st()).active); }
  console.log('     tab order:', order.join(' > '));
  ok(order[0] === 'searchBtn' && order[1] === 'ncGrab' && order[2] === 'ccGrab' && order[3] === 'en' && order[4] === 'zh'
    && order.slice(5, 14).join(',') === 'storewright,silnest,sky,vocal,how,clock,site,contact,calendar'
    && order[14] === 'note:silnest' && order[17] === 'silnest' && order.includes('unlock') && order.indexOf('unlock') > order.indexOf('silnest'),
  'tab order: Search, Today, Quick settings, language, the planets inner to outer then the Moon, the updates, one widget, dots, Unlock (was: language, theme, widget, dots, unlock)', order.join(','));
  const ring = await api.eval(`getComputedStyle(document.activeElement).outlineStyle + ' ' + getComputedStyle(document.activeElement).outlineWidth`);
  ok(/solid 2px/.test(ring), 'visible focus ring on keyboard focus', ring);
  await fps('after tab test');

  await api.eval(`document.getElementById('unlock').focus()`);
  await api.key('Enter');
  await sleep(900);
  s = await st();
  ok(s.view === 'home' && s.hash === '#home' && s.active === 'homeTitle', 'Enter on Unlock opens home, focus moves there', JSON.stringify(s));
  ok(await api.eval(`document.getElementById('lock').inert && !document.getElementById('home').inert`), 'lock screen inert on home');
  const how = await rect('.dock-app[data-app="how"] .ico');
  await api.click(how.x, how.y);
  await sleep(80);
  const howZoom = await api.eval(`[document.getElementById('appView').getAnimations().length, document.getElementById('appView').dataset.origin]`);
  await sleep(700);
  s = await st();
  const howText = await text('#appBody .quote');
  ok(s.app === 'how' && s.hash === '#home/how' && howText.startsWith('I decide what to build and how we') && howZoom[0] > 0
    && howZoom[1] === `${Math.round(how.x)} ${Math.round(how.y)}`, 'How I work (pinned) opens its page, growing from the icon (was: its sheet)', JSON.stringify([s, howZoom]));
  await api.go('?lang=en#silnest', 900);
  const grab = await rect('.sheet-head');
  await api.drag(grab.x - 60, grab.y, grab.x - 60, grab.y + 260, 12, 16);
  await sleep(800);
  s = await st();
  ok(!s.sheet && s.hash === '' && s.view === 'lock', 'dragging the panel down closes it', JSON.stringify(s));
  await api.go('?lang=en#home', 900);
  await api.key('Escape');
  await sleep(900);
  s = await st();
  ok(s.view === 'lock' && s.hash === '', 'Escape on home goes back to the lock screen', JSON.stringify(s));
  await api.eval(`document.activeElement.blur()`);
  await api.key(' ');
  await sleep(900);
  s = await st();
  ok(s.view === 'home', 'Space on the lock screen unlocks', JSON.stringify(s));
  const lb = await rect('#lockBtn');
  await api.click(lb.x, lb.y);
  await sleep(900);
  s = await st();
  ok(s.view === 'lock' && s.active === 'unlock', 'Lock button returns to the lock screen, focus on Unlock', JSON.stringify(s));
  await api.drag(420, 150, 480, 150, 24, 16);
  await sleep(700);
  s = await st();
  ok(s.view === 'lock' && (await api.eval(`document.getElementById('lockFg').style.transform`)) === '', 'short slow drag to the right snaps back (was: short upward drag)', JSON.stringify(s));
  await api.drag(380, 150, 900, 150, 12, 16);
  await sleep(900);
  s = await st();
  ok(s.view === 'home' && s.hash === '#home', 'mouse drag to the right unlocks (was: upward mouse drag)', JSON.stringify(s));
  await api.eval(`history.back()`);
  await sleep(900);
  s = await st();
  ok(s.view === 'lock', 'back button locks', JSON.stringify(s));
  const fits = await api.eval(`(() => { const sc = document.getElementById('lockInner'); return [sc.scrollHeight, sc.clientHeight]; })()`);
  await wheelAt(640, 300, 120);
  await sleep(900);
  s = await st();
  ok(s.view === 'home', 'wheel down on the lock screen unlocks', JSON.stringify([s, fits]));
  await api.eval(`history.back()`);
  await sleep(900);

  // Quick settings replaces the theme menu
  await api.go('?lang=en', 1000);
  await api.eval(`document.activeElement.blur()`);
  await api.key('c');
  await sleep(500);
  s = await st();
  const ccFocus = await api.eval(`[document.activeElement.dataset.appearance, document.activeElement.getAttribute('aria-checked'), document.activeElement.getAttribute('role')]`);
  ok(s.cc && ccFocus[0] === 'auto' && ccFocus[1] === 'true' && ccFocus[2] === 'radio', 'C opens Quick settings with focus on the current appearance (was: theme menu)', JSON.stringify([s, ccFocus]));
  await api.key('ArrowRight');
  await sleep(300);
  s = await st();
  ok(s.appearance === 'dark' && (await api.eval(`document.documentElement.dataset.appearancePref`)) === 'dark', 'arrow key picks Dark (was: picks Orbit)', JSON.stringify(s));
  await api.key('ArrowRight');
  await sleep(300);
  s = await st();
  ok(s.appearance === 'light' && s.theme === '#ffffff' && (await css('#wall', 'backgroundColor')) === 'rgb(255, 255, 255)', 'arrow key picks Light: the page turns white and theme-color follows (was: picks Aurora)', JSON.stringify(s));
  await api.key('Escape');
  await sleep(500);
  s = await st();
  ok(!s.cc && s.active === 'ccGrab', 'Escape closes Quick settings, focus back on its button (was: the theme menu)', JSON.stringify(s));
  ok((await api.eval(`localStorage.getItem('ls7-appearance')`)) === 'light', 'appearance choice remembered (was: theme choice)');
  await api.key('c');
  await sleep(500);
  await clickOn('#ccWeight [data-weight="thin"]');
  await sleep(400);
  s = await st();
  const thinW = await css('.hm', 'fontWeight');
  ok(s.thin && thinW === '300' && s.cc && (await api.eval(`localStorage.getItem('ls7-weight')`)) === 'thin', 'clicking Thin in Quick settings switches the clock weight and remembers it (was: clicking Dawn)', JSON.stringify([s, thinW]));
  await clickOn('#ccAppearance [data-appearance="dark"]');
  await sleep(300);
  const tcDark = (await st()).theme;
  await clickOn('#ccAppearance [data-appearance="light"]');
  await sleep(300);
  const tcLight = (await st()).theme;
  ok(tcDark === D.themeColors.dark && tcLight === D.themeColors.light && tcDark === '#08090c' && tcLight === '#ffffff', 'theme-color follows the appearance: #08090c on dark, #ffffff on light (was: the wallpaper)', JSON.stringify([tcDark, tcLight]));
  await api.key('Escape');
  await sleep(400);
  await api.eval(`localStorage.clear()`);
  await api.go('?lang=en', 900);
  const zh = await rect('button[data-lang="zh"]');
  await api.click(zh.x, zh.y);
  await sleep(400);
  const zht = await api.eval(`[document.documentElement.lang, document.querySelector('.ul-txt [data-i18n=unlock]').textContent, document.getElementById('date').textContent, document.getElementById('ap').textContent, document.querySelector('#track .w').getAttribute('aria-label').slice(0, 12), document.querySelector('button[data-lang=zh]').getAttribute('aria-pressed')]`);
  ok(zht[0] === 'zh-CN' && zht[1] === '解锁其余内容' && /月\d+日 星期/.test(zht[2]) && /午/.test(zht[3]) && /[一-鿿]/.test(zht[4]) && zht[5] === 'true',
    'Chinese toggle switches UI text, date and AM/PM', JSON.stringify(zht));
  await api.eval(`localStorage.clear()`);

  await api.go('?lang=en&sheet=contact', 1000);
  const ct = await api.eval(`[document.getElementById('sheetTitle').textContent, document.querySelector('#sheetStats dd').textContent, [...document.querySelectorAll('#sheetLinks a')].map(a => a.href)]`);
  ok(ct[0] === 'Say hi' && /\d{1,2}:\d{2} (AM|PM)/.test(ct[1]) && ct[2].includes('mailto:canyuanye@gmail.com'), 'contact panel: live local time and links', JSON.stringify(ct));
  await api.go('?lang=en&sheet=vocal', 800);
  const vo = await api.eval(`[document.getElementById('sheetLinks').hidden, document.getElementById('sheetNote').textContent]`);
  ok(vo[0] === true && vo[1] === 'No public link yet.', 'AI Vocal panel has no links and says so', JSON.stringify(vo));

  // ---------------- mobile, touch
  await api.viewport(390, 844, { mobile: true, dpr: 1, dark: true });
  await api.go('?lang=en', 1200);
  s = await st();
  ok(s.dots === 5, 'mobile: one dot per page (5)', JSON.stringify(s));
  const mt = await rect('#track');
  await api.touchSwipe(mt.x + 120, mt.y, mt.x - 140, mt.y, 10, 16);
  await sleep(1200);
  s = await st();
  ok(s.sl > 100 && s.view === 'lock', 'touch swipe scrolls the row natively', JSON.stringify(s));
  await api.touchSwipe(40, 120, 360, 120, 10, 16);
  await sleep(1000);
  s = await st();
  ok(s.view === 'home' && s.hash === '#home', 'touch swipe to the right unlocks (was: swipe up)', JSON.stringify(s));
  await api.eval(`history.back()`);
  await sleep(900);
  await api.eval(`document.querySelector('.note[data-note="silnest"]').scrollIntoView({block: 'center'})`);
  await sleep(300);
  const n0 = await rect('.note[data-note="silnest"]');
  await api.touchSwipe(n0.l + 16, n0.y, n0.l + 330, n0.y, 10, 16);
  await sleep(1100);
  s = await st();
  ok(s.view === 'home' && s.app === 'silnest' && s.hash === '#home/silnest', 'touch swipe to the right on an update card unlocks into its app (was: swipe up from a widget)', JSON.stringify(s));
  await api.eval(`history.back()`);
  await sleep(700);
  await api.eval(`history.back()`);
  await sleep(900);
  await api.eval(`document.getElementById('lockInner').scrollTop = 0`);
  await sleep(300);
  const mt2 = await rect('#track');
  await api.tap(mt2.x - 40, mt2.y);
  await sleep(800);
  s = await st();
  ok(s.sheet, 'tapping a widget opens its panel', JSON.stringify(s));
  const overflow = await api.eval(`[document.documentElement.scrollWidth, innerWidth, document.getElementById('sheet').scrollWidth <= document.getElementById('sheet').clientWidth]`);
  ok(overflow[0] <= overflow[1] && overflow[2], 'no horizontal overflow on mobile', JSON.stringify(overflow));

  // ---------------- reduced motion
  await api.viewport(1280, 800, { dark: true, reduce: true });
  await api.go('?lang=en', 1200);
  await api.move(10, 10);
  await sleep(600);
  const red = await api.eval(`[document.documentElement.classList.contains('reduced'), document.getAnimations().filter(a => a.constructor.name === 'CSSAnimation').length, getComputedStyle(document.getElementById('unlock'), '::after').animationName, document.getElementById('wallMove').style.transform]`);
  ok(red[0] && red[1] === 0 && red[2] === 'none' && red[3] === '', 'reduced motion: no CSS animation, no parallax (was: still widget SVGs)', JSON.stringify(red));
  const still = () => api.eval(`[...document.querySelectorAll('#orbit [data-o], #orbit [data-sec]')].map(g => g.getAttribute('transform')).join('|')`);
  const still0 = await still();
  await sleep(1200);
  ok(still0 === (await still()), 'reduced motion (the system setting): the planets and the seconds dot stand still');

  console.log('---- part 2: the Dusk Tech pieces');
  await api.viewport(1440, 900, { dark: true });

  // ---------------- the dusk background and the parallax
  const themes = {};
  for (const [t, exp] of [['midnight', 'dark'], ['orbit', 'dark'], ['blossom', 'dark'], ['aurora', 'dark'], ['lagoon', 'light'], ['dawn', 'light']]) {
    await api.go(`?lang=en&theme=${t}`, 500);
    themes[t] = [(await st()).appearance, exp];
  }
  await api.go('?lang=en&theme=lagoon&appearance=dark', 500);
  themes.wins = [(await st()).appearance, 'dark'];
  ok(Object.values(themes).every(([a, e]) => a === e), '?theme= old wallpaper names map to the appearance (midnight, orbit, blossom, aurora dark; lagoon, dawn light; ?appearance= wins)', JSON.stringify(themes));
  const bgOf = () => api.eval(`(() => { const g = [...document.querySelectorAll('#wallMove .glow')].map(e => getComputedStyle(e).opacity); const d = getComputedStyle(document.querySelector('.wall-dots')); return {g, dots: d.backgroundImage.slice(0, 40), size: d.backgroundSize, mask: (d.maskImage || d.webkitMaskImage || '').slice(0, 30), bg: getComputedStyle(document.getElementById('wall')).backgroundColor}; })()`);
  await api.go('?lang=en', 800);
  const bgD = await bgOf();
  await api.go('?lang=en&appearance=light', 800);
  const bgL = await bgOf();
  ok(bgD.g.join('|') === '0.4|0.2|0.24' && bgL.g.join('|') === '0.2|0.12|0.16' && [bgD, bgL].every((b) => /data:image\/svg\+xml/.test(b.dots) && b.size === '20px 20px' && /radial-gradient/.test(b.mask))
    && bgD.bg === 'rgb(8, 9, 12)' && bgL.bg === 'rgb(255, 255, 255)',
  'the dusk background: three glows at the token opacities (dark .4/.2/.24, light .2/.12/.16) and a 20px dot grid under a radial fade (was: wallpapers)', JSON.stringify([bgD, bgL]));
  await api.go('?lang=en', 900);
  const glowAt = () => api.eval(`(() => { const D = JSON.parse(document.getElementById('data').textContent); const w = getComputedStyle(document.getElementById('wall')); const r = document.getElementById('orbit').getBoundingClientRect(); return {ox: parseFloat(w.getPropertyValue('--ox')), oy: parseFloat(w.getPropertyValue('--oy')), k: parseFloat(w.getPropertyValue('--k')), cx: r.left + r.width * (D.center[0] - D.stage[0]) / D.stage[2], cy: r.top + r.height * (D.center[1] - D.stage[1]) / D.stage[3], kk: r.width / D.stage[2], W: innerWidth, H: innerHeight}; })()`);
  const gl = await glowAt();
  ok(Math.abs(gl.ox - gl.cx) < 2 && Math.abs(gl.oy - gl.cy) < 2 && Math.abs(gl.k - gl.kk) < 0.01, 'the glows and the dot-grid fade sit on the orbit, scaled with it (as on the banner)', JSON.stringify(gl));
  await api.eval(`document.getElementById('unlock').click()`);
  await sleep(1300);
  const gh = await glowAt();
  ok(gh.ox > gh.W * 0.6 && gh.oy < gh.H * 0.25, 'unlocked, the glows rest at the top right', JSON.stringify(gh));
  await api.key('Escape');
  await sleep(1300);
  const gb = await glowAt();
  ok((await st()).view === 'lock' && Math.abs(gb.ox - gb.cx) < 2 && Math.abs(gb.oy - gb.cy) < 2, 'locked again, the glows glide back behind the orbit', JSON.stringify(gb));
  await api.go('?lang=en', 900);
  await api.move(1430, 890);
  await sleep(1200);
  const par1 = await api.eval(`[document.getElementById('wallMove').style.transform, document.getElementById('lockFg').style.transform, getComputedStyle(document.querySelector('.clock')).transform]`);
  await api.move(10, 10);
  await sleep(1200);
  const par2 = await api.eval(`document.getElementById('wallMove').style.transform`);
  const p1 = nums(par1[0]);
  const p2 = nums(par2);
  ok(p1.length >= 2 && p2.length >= 2 && p1[0] > 6 && p1[0] <= 8 && p2[0] < -6 && p2[0] >= -8 && p1[1] > 6 && p2[1] < -6 && par1[1] === '' && par1[2] === 'none',
    'parallax: the glows drift up to 8px with the pointer, the foreground stays (was: 12px against it)', JSON.stringify([par1, par2]));
  await api.go('?lang=en&parallax=off', 800);
  await api.move(1430, 890);
  await sleep(700);
  ok((await api.eval(`document.getElementById('wallMove').style.transform`)) === '', '?parallax=off keeps the glows still');
  await api.viewport(1440, 900, { dark: false });
  await api.go('?lang=en', 800);
  s = await st();
  ok(s.appearance === 'light' && s.theme === '#ffffff', 'light system -> the light page, theme-color #ffffff', JSON.stringify(s));
  await api.go('?lang=en&appearance=dark', 800);
  const ad = await st();
  await api.viewport(1440, 900, { dark: true });
  await api.go('?lang=en&appearance=light', 800);
  const al = await st();
  ok(ad.appearance === 'dark' && ad.theme === '#08090c' && al.appearance === 'light' && al.theme === '#ffffff', '?appearance= overrides the system either way', JSON.stringify([ad, al]));

  // ---------------- contrast in both modes (spec: clock 3:1, small text 4.5:1)
  const cr = async (sel) => {
    await api.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (e) e.scrollIntoView({block: 'center', inline: 'nearest'}); })()`);
    return (await contrastOf(api, sel) || {}).p05;
  };
  for (const [w, h, m] of [[1440, 900, false], [390, 844, true]]) {
    for (const mode of ['dark', 'light']) {
      await api.viewport(w, h, { mobile: m, dark: true });
      await api.go(`?lang=en&appearance=${mode}`, 900);
      await api.eval(`document.getAnimations().forEach(a => a.pause())`);
      const c = {};
      for (const sel of ['.hm', '#date', '.name', '.name .zh', '.subline', '#status', '.lanes .lane:nth-child(1)', '.lanes .lane:nth-child(2)', '.lanes .lane:nth-child(3)', '.unlock-sub', '.note-w', '.note-b', '#track .w-hd .rt', '#track .w-foot']) c[sel] = await cr(sel);
      await api.go(`?lang=en&appearance=${mode}#home`, 900);
      await api.eval(`document.getAnimations().forEach(a => a.pause())`);
      c.labels = 99;
      for (let i = 1; i <= 5; i++) c.labels = Math.min(c.labels, await cr(`#grid li:nth-child(${i}) .lbl`));
      for (let i = 1; i <= 4; i++) c.labels = Math.min(c.labels, await cr(`#dockList li:nth-child(${i}) .lbl`));
      for (const sel of ['.about-kicker', '.about-hello', '.sec-label']) c[sel] = await cr(sel);
      console.log('     contrast', mode, w, JSON.stringify(c));
      const small = Object.entries(c).filter(([k]) => k !== '.hm').every(([, v]) => v >= 4.5);
      ok(c['.hm'] >= 3 && small, `contrast on the ${mode} page at ${w}px: clock >= 3:1, every small text >= 4.5:1`, JSON.stringify(c));
    }
  }
  for (const mode of ['dark', 'light']) {
    await api.viewport(390, 844, { mobile: true, dark: true });
    await api.go(`?lang=en&appearance=${mode}#home/storewright`, 900);
    const c = {};
    for (const sel of ['.ap-sub', '.tv-head', '.tv-v', '.tv-foot', '.tv-l', '.nav-title']) c[sel] = await cr(sel);
    console.log('     contrast detail page', mode, JSON.stringify(c));
    ok(Object.values(c).every((v) => v >= 4.5), `contrast on a ${mode} detail page: labels, values and notes >= 4.5:1`, JSON.stringify(c));
  }

  // ---------------- the top bar, the clock block, the orbit, the lanes
  await api.viewport(1440, 900, { dark: true });
  await api.go('?lang=en', 900);
  const tb = await api.eval(`(() => { const s = document.getElementById('status'); const vis = (e) => e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; const r = s.getBoundingClientRect(); return {text: s.innerText.replace(/\\s+/g, ' ').trim(), live: getComputedStyle(s.querySelector('.live')).backgroundColor, radius: getComputedStyle(s).borderTopLeftRadius, h: Math.round(r.height), left: Math.round(r.left), fake: document.querySelectorAll('.sig, .wifi, .batt, .sb-lock, .grabber').length, btns: [...document.querySelectorAll('#topbar .tb-r button')].filter(vis).map(b => b.id || b.dataset.lang), kbd: document.getElementById('kbdHint').textContent, labels: [...document.querySelectorAll('#topbar .tb-lbl')].filter(vis).map(e => e.textContent), ghost: getComputedStyle(document.getElementById('searchBtn')).borderTopLeftRadius}; })()`);
  ok(tb.text === 'Albany, NY · Eastern Time' && tb.live === 'rgb(79, 224, 200)' && tb.radius === '999px' && tb.h === 28 && tb.fake === 0,
    'top bar: the status pill "Albany, NY · Eastern Time" with a teal live dot; no fake signal, Wi-Fi, padlock or battery (was: the status bar)', JSON.stringify(tb));
  ok(tb.btns.join('|') === 'searchBtn|ncGrab|ccGrab|en|zh' && /^(⌘K|Ctrl K)$/.test(tb.kbd) && tb.labels.join('|') === 'Search|Today|Quick settings' && tb.ghost === '999px',
    'top bar: ghost buttons for Search (with the Cmd+K hint), Today, Quick settings and EN / 中文 (was: edge grabbers)', JSON.stringify(tb));
  await clickOn('#ncGrab');
  await sleep(600);
  const viaBtn = (await st()).nc;
  const ncr = await rect('#ncGrab');
  await api.click(ncr.x, ncr.y);
  await sleep(600);
  const nc2 = (await st()).nc;
  await clickOn('#ccGrab');
  await sleep(600);
  ok(viaBtn && !nc2 && (await st()).cc, 'the Today button opens the Today panel (a second click closes it); Quick settings opens Quick settings (was: grabbers)', JSON.stringify([viaBtn, nc2]));
  await api.key('Escape');
  await sleep(500);
  await api.viewport(390, 844, { mobile: true, dark: true });
  await api.go('?lang=en', 900);
  const tbp = await api.eval(`(() => { const vis = (e) => e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; const bs = [...document.querySelectorAll('#topbar .tb-r button')].filter(vis); const rs = bs.map(b => b.getBoundingClientRect()); const s = document.getElementById('status').getBoundingClientRect(); return {n: bs.length, labels: bs.map(b => b.getAttribute('aria-label')), clear: rs.every(r => r.left >= s.right), inside: rs.every(r => r.right <= innerWidth - 15), pill: document.getElementById('status').innerText.replace(/\\s+/g, ' ').trim()}; })()`);
  ok(tbp.n === 5 && tbp.clear && tbp.inside && tbp.labels.slice(0, 3).join('|') === 'Search|Today|Quick settings' && tbp.pill === 'Albany · ET', 'top bar on a phone: icon buttons with names, a short pill, nothing overlaps', JSON.stringify(tbp));
  await api.viewport(1440, 900, { dark: true });
  await api.go('?lang=en', 900);
  const cb = await api.eval(`(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); const hm = getComputedStyle(document.querySelector('.hm')); const fs = (s) => parseFloat(getComputedStyle(document.querySelector(s)).fontSize); const t = fs('.time'); return {w: getComputedStyle(document.querySelector('.time')).fontWeight, clip: hm.backgroundClip || hm.webkitBackgroundClip, fill: hm.webkitTextFillColor, img: hm.backgroundImage, above: r('#date').top < r('.hm').top && r('#date').bottom <= r('.hm').top + 24, below: r('.time').bottom <= r('.name').top + 4 && r('.name').bottom <= r('.subline').top + 2, ratio: [fs('#date') / t, fs('.name') / t, fs('.subline') / t].map(x => +x.toFixed(3)), track: hm.letterSpacing, ap: getComputedStyle(document.getElementById('ap')).color}; })()`);
  ok(cb.w === '700' && cb.clip === 'text' && cb.fill === 'rgba(0, 0, 0, 0)' && /linear-gradient\(rgb\(255, 255, 255\) 30%, rgb\(185, 189, 203\)\)/.test(cb.img) && cb.above && cb.below
    && Math.abs(cb.ratio[0] - 18 / 118) < 0.01 && Math.abs(cb.ratio[1] - 19 / 118) < 0.01 && Math.abs(cb.ratio[2] - 14.5 / 118) < 0.01 && cb.ap === 'rgb(164, 169, 179)',
  'the banner at page scale: the date above a bold gradient clock (700, white 30% -> #b9bdcb), then the name line and the subline, in the banner\'s proportions (was: thin clock)', JSON.stringify(cb));
  await api.go('?lang=en&weight=thin', 600);
  ok((await css('.hm', 'fontWeight')) === '300' && (await css('.hm', 'backgroundClip')) === 'text', '?weight=thin switches the clock to the thin weight, same gradient (bold is the default)');
  await api.go('?lang=en', 900);
  const orb = await api.eval(`(() => { const svg = document.querySelector('#orbit .orbit-svg'); const D = JSON.parse(document.getElementById('data').textContent); const kids = [...svg.children].map(c => c.getAttribute('class') || c.tagName); const img = svg.querySelector('image.av-img'); return {orbits: D.orbits, periods: D.periods, vb: svg.getAttribute('viewBox'), rings: svg.querySelectorAll(':scope > .rings path').length, mask: svg.querySelector(':scope > .rings').getAttribute('mask'), tilt: [...svg.querySelectorAll(':scope > .rings path')].every(p => / -9 0 0 /.test(p.getAttribute('d'))), far: svg.querySelectorAll('.planets-far [data-o]').length, near: svg.querySelectorAll('.planets-near [data-o]').length, trails: svg.querySelectorAll('[data-trail]').length, names: [...svg.querySelectorAll('.planets-far [data-o]')].map(g => g.dataset.planet), radii: [...svg.querySelectorAll('.planets-far .pl')].map(c => +c.getAttribute('r')), order: kids, avR: +img.getAttribute('width') / 2, avClip: !!img.getAttribute('clip-path'), edge: svg.querySelector('.av-edge').getAttribute('stroke'), text: svg.querySelectorAll('text').length, sat: svg.querySelectorAll('[data-planet="saturn"] .sat-ring').length, jup: svg.querySelectorAll('[data-planet="jupiter"] .bands rect').length, sec: +svg.querySelector('[data-sec]').getAttribute('r'), sun: +svg.querySelector('.sun').getAttribute('r'), sunO: +getComputedStyle(svg.querySelector('.sun')).opacity}; })()`);
  const okOrder = (o) => o.indexOf('sun') < o.indexOf('rings') && o.indexOf('rings') < o.indexOf('av-img') && o.indexOf('planets-far') < o.indexOf('av-img') && o.indexOf('planets-near') > o.indexOf('av-edge');
  ok(JSON.stringify(orb.orbits) === JSON.stringify([[52, 18, -9], [72, 25, -9], [93, 32, -9], [114, 39, -9], [138, 48, -9], [162, 56, -9], [187, 65, -9], [212, 73, -9]]) && JSON.stringify(orb.periods) === '[12,18,26,36,50,66,86,110]'
    && orb.rings === 8 && /depth/.test(orb.mask) && orb.tilt && orb.far === 8 && orb.near === 8 && orb.trails === 16
    && orb.names.join('|') === 'mercury|venus|earth|mars|jupiter|saturn|uranus|neptune' && orb.radii.join('|') === '2.4|3.4|3.6|3|7|6|4.6|4.4'
    && orb.sat === 4 && orb.jup === 4 && orb.text === 0 && orb.sec === 1.8 && orb.sun === 70 && orb.sunO <= 0.35 && okOrder(orb.order) && orb.avR === 34 && orb.avClip && /edge/.test(orb.edge),
  'the orbit (R3.1): the avatar at the centre with a sun glow and a gradient edge, eight rings from the spec drawn behind it, Mercury to Neptune behind on the far half and in front on the near half, Saturn\'s ring, Jupiter\'s bands, no "CY" (was: three planets and a CY disc)', JSON.stringify(orb));
  const av = await api.eval(`(async () => { const img = document.querySelector('#orbit image.av-img'); const href = img.getAttribute('href'); const i = new Image(); i.src = href; await i.decode(); return {data: href.startsWith('data:image/jpeg;base64,'), w: i.naturalWidth, h: i.naturalHeight, kb: +(href.length * 3 / 4 / 1024).toFixed(1)}; })()`);
  await api.go('?lang=en&appearance=light', 700);
  const sunL = +(await css('#orbit .sun', 'opacity'));
  await api.move(5, 5);
  await api.go('?lang=en', 900);
  ok(av.data && av.w === 162 && av.h === 162 && sunL <= 0.2 && !api.requests.some((u) => /avatar/i.test(u)), 'the avatar is inline: a data: JPEG (162 x 162) inside the orbit, nothing is requested; the sun glow stays at or under .35 dark and .2 light', JSON.stringify([av, sunL]));
  const planetsAt = (box) => api.eval(`(() => { const D = JSON.parse(document.getElementById('data').textContent); return D.orbits.map(([rx, ry], i) => { const g = document.querySelector(${JSON.stringify(box)} + ' [data-o="' + i + '"]'); const m = g.getAttribute('transform').match(/translate\\((-?[\\d.]+) (-?[\\d.]+)\\)/); return [+m[1], +m[2], +((Math.atan2(+m[1] / rx, -m[2] / ry) * 180 / Math.PI + 360) % 360).toFixed(3)]; }); })()`);
  const secAt = (box) => api.eval(`(() => { const d = document.querySelector(${JSON.stringify(box)} + ' [data-sec]'); const m = d.getAttribute('transform').match(/translate\\((-?[\\d.]+) (-?[\\d.]+)\\)/); let a = Math.atan2(+m[1], -m[2]) / (2 * Math.PI); if (a < 0) a += 1; return {a: +a.toFixed(4), now: +((Date.now() / 1000 % 60) / 60).toFixed(4), r: +Math.hypot(+m[1], +m[2]).toFixed(2), t: d.getAttribute('transform')}; })()`);
  const turned = (p0, p1) => p0.map((p, i) => { let d = p1[i][2] - p[2]; if (d > 180) d -= 360; if (d < -180) d += 360; return +d.toFixed(2); });
  const sd = await secAt('#orbit');
  ok((Math.abs(sd.a - sd.now) < 0.03 || Math.abs(sd.a - sd.now) > 0.97) && Math.abs(sd.r - 38) < 0.05, 'the seconds dot runs round the avatar\'s edge (r 38) in step with the Albany seconds (was: the planets keep time)', JSON.stringify(sd));
  // #79: each planet left from its real heliocentric longitude at load, then turned at its PERIODS
  const ph = await api.eval(`(() => { const D = JSON.parse(document.getElementById('data').textContent); const t = Date.now(); const ep = +document.getElementById('orbit').dataset.epoch; return {t, ep, th: D.orbits.map(([rx, ry], i) => { const m = document.querySelector('#orbit [data-o="' + i + '"]').getAttribute('transform').match(/translate\\((-?[\\d.]+) (-?[\\d.]+)\\)/); return (Math.atan2(-m[2] / ry, +m[1] / rx) * 180 / Math.PI + 360) % 360; })}; })()`);
  const lon0 = Astro.planetLongitudes(ph.ep);
  const phErr = ph.th.map((th, i) => { let d = Math.abs(th - ((lon0[i] + (360 * (ph.t - ph.ep)) / 1000 / D.periods[i]) % 360)) % 360; if (d > 180) d = 360 - d; return +d.toFixed(2); });
  ok(phErr.every((d) => d < 3), 'the planets left from their real positions at load (heliocentric longitude, live/astro.mjs) and turn at their PERIODS since (was: phase from Unix time)', JSON.stringify(phErr));
  const m0 = await planetsAt('#orbit');
  await sleep(1000);
  const m1 = await planetsAt('#orbit');
  const moved = turned(m0, m1);
  const pxMoved = m0.map((p, i) => +Math.hypot(m1[i][0] - p[0], m1[i][1] - p[1]).toFixed(1));
  ok(moved.every((d) => d < -0.5) && moved.every((d, i) => i === 0 || Math.abs(d) < Math.abs(moved[i - 1])) && pxMoved.every((d) => d > 1),
    'all eight planets visibly orbit: a second later every one has moved counter-clockwise, Mercury fastest and Neptune slowest', JSON.stringify({ moved, pxMoved }));
  const att = await api.eval(`(() => { const res = []; const n = JSON.parse(document.getElementById('data').textContent).orbits.length; for (let i = 0; i < n; i++) { for (const layer of ['.planets-far', '.planets-near']) { const t = document.querySelector('#orbit ' + layer + ' [data-trail="' + i + '"]'); const segs = t.querySelectorAll('path'); const seg = segs[segs.length - 1]; const m = seg.getAttribute('d').match(/L(-?[\\d.]+),(-?[\\d.]+)/); const svg = seg.ownerSVGElement; const pt = svg.createSVGPoint(); pt.x = +m[1]; pt.y = +m[2]; const a = pt.matrixTransform(seg.getScreenCTM()); const c = document.querySelector('#orbit ' + layer + ' [data-o="' + i + '"] .pl'); const q = svg.createSVGPoint(); const b = q.matrixTransform(c.getScreenCTM()); res.push(+Math.hypot(a.x - b.x, a.y - b.y).toFixed(2)); } } return res; })()`);
  ok(att.length === 16 && att.every((d) => d < 1.5), 'each trail stays attached to its planet as it moves (both copies of all eight)', JSON.stringify(att));
  const lanes = await api.eval(`(() => { const o = document.getElementById('orbit').getBoundingClientRect(); const [sx, sy, sw, sh] = JSON.parse(document.getElementById('data').textContent).stage; return [...document.querySelectorAll('#orbit .lane')].map(l => { const r = l.getBoundingClientRect(); const u = o.width / sw; return {t: l.textContent.trim(), dot: getComputedStyle(l.querySelector('i')).backgroundColor, x: +(sx + (r.left - o.left) / u).toFixed(1), y: +(sy + (r.top - o.top) / u).toFixed(1), bottom: +(sy + (r.bottom - o.top) / u).toFixed(1), h: +(r.height / u).toFixed(1), inside: r.left >= o.left - 1 && r.right <= o.right + 1}; }); })()`);
  ok(lanes.map((l) => l.t).join('|') === 'Software|Creative tech|Product' && lanes[0].dot === 'rgb(144, 149, 255)' && lanes[1].dot === 'rgb(182, 156, 255)' && lanes[2].dot === 'rgb(79, 224, 200)'
    && Math.abs(lanes[0].x - 560) < 4 && Math.abs(lanes[0].y - 52) < 4 && Math.abs(lanes[2].x - 612) < 4 && Math.abs(lanes[2].y - 268) < 4 && Math.abs(lanes[1].y - 268) < 4 && lanes[1].x > 860
    && lanes[0].bottom <= 81 && lanes[1].y >= 239 && lanes[2].y >= 239 && lanes.every((l) => l.inside && Math.abs(l.h - 26) < 1.5),
  'lane pills moved off the orbit as in R3.1: Software above it, Product and Creative tech below it (indigo, violet, teal dots, 26 units high)', JSON.stringify(lanes));
  await api.go('?lang=en&motion=reduce', 900);
  const rm0 = [await planetsAt('#orbit'), (await secAt('#orbit')).t];
  await sleep(1200);
  const rm1 = [await planetsAt('#orbit'), (await secAt('#orbit')).t];
  ok(JSON.stringify(rm0) === JSON.stringify(rm1), '?motion=reduce: the planets and the seconds dot stand still', JSON.stringify([rm0[1], rm1[1]]));
  await api.go('?lang=en', 900);

  // ---------------- updates
  const notes = await api.eval(`[...document.querySelectorAll('#noteList .note')].map(n => ({t: n.querySelector('.note-t').textContent, w: n.querySelector('.note-w').textContent, b: n.querySelector('.note-b').textContent, bg: (getComputedStyle(n).backgroundImage.match(/gradient/g) || []).length, r: getComputedStyle(n).borderTopLeftRadius, app: n.dataset.app}))`);
  const orders = D.day.headline.find((x) => x.label === 'Orders fulfilled').value;
  const ontime = D.day.headline.find((x) => x.label === 'Ready on time').value;
  const expW = [shortDate(D.facts.snReleased), 'Nov 2026', shortDate(D.day.date)];
  ok(notes.length === 3 && notes.every((n) => n.bg === 3 && n.r === '14px') && JSON.stringify(notes.map((n) => n.w)) === JSON.stringify(expW),
    'three compact update cards (gradient border, radius 14) dated from the data: SilNest release, Storewright month, store-day date', JSON.stringify([notes.map((n) => [n.t, n.w, n.bg, n.r]), expW]));
  ok(notes[0].b === `Version ${D.facts.snVersion} is on the App Store.` && notes[1].b === 'v1.0 final is out. 800+ tests passing.' && notes[2].b === `${orders} orders fulfilled, ${ontime}% ready on time. Synthetic data.`,
    'update texts are facts from the data files', JSON.stringify(notes.map((n) => n.b)));
  const nr = await rect('.note[data-note="storewright"]');
  await api.click(nr.x, nr.y);
  await sleep(120);
  const noteZoom = await api.eval(`document.getElementById('appView').dataset.origin`);
  await sleep(800);
  s = await st();
  ok(s.view === 'home' && s.app === 'storewright' && s.hash === '#home/storewright' && noteZoom === `${Math.round(nr.x)} ${Math.round(nr.y)}`, 'clicking an update card unlocks into its app, growing from the card', JSON.stringify([s, noteZoom]));

  // ---------------- the Unlock pill
  await api.go('?lang=en', 900);
  const up = await api.eval(`(() => { const u = document.getElementById('unlock'); const cs = getComputedStyle(u); const af = getComputedStyle(u, '::after'); const bf = getComputedStyle(u, '::before'); return {txt: u.querySelector('.ul-txt b').textContent, sub: u.querySelector('.unlock-sub').textContent, knob: !!u.querySelector('.knob use[href="#u-chev"]'), radius: cs.borderTopLeftRadius, h: Math.round(u.getBoundingClientRect().height), border: bf.backgroundImage.slice(0, 40), shimmer: af.animationName, dur: parseFloat(af.animationDuration), aria: u.getAttribute('aria-label')}; })()`);
  ok(up.txt === 'Unlock the rest' && up.sub === 'apps · how I work · links' && up.knob && up.radius === '999px' && up.h === 52 && /linear-gradient/.test(up.border) && up.shimmer === 'shimmer' && up.dur >= 4 && up.aria === 'Unlock the rest: apps, how I work, links',
    'the Unlock pill: "Unlock the rest" with a chevron knob, a gradient border and one slow shimmer (at least 4 s) (was: "slide to unlock")', JSON.stringify(up));
  const u0 = await rect('#unlock');
  await api.drag(u0.l + 10, u0.y, u0.l + 310, u0.y, 15, 16, { release: false });
  await sleep(120);
  const mid = await api.eval(`[document.body.classList.contains('sliding'), document.getElementById('lockFg').style.transform, +document.getElementById('lockFg').style.opacity]`);
  await api.mouse('mouseReleased', u0.l + 310, u0.y);
  await sleep(900);
  s = await st();
  const midX = nums(mid[1])[0];
  ok(mid[0] && midX > 280 && midX < 320 && mid[2] < 1 && mid[2] > 0.4 && s.view === 'home', 'the lock screen follows the finger mid-drag (and fades), then slides out to the right', JSON.stringify([mid, s.view]));
  await api.go('?lang=en', 700);
  const kb = await rect('#unlock .knob');
  await api.drag(kb.x, kb.y, kb.x + 330, kb.y, 15, 16);
  await sleep(900);
  ok((await st()).view === 'home', 'dragging the chevron knob to the right unlocks');
  for (const [label, act] of [['click', async () => { const r = await rect('#unlock'); await api.click(r.x, r.y); }],
    ['→', async () => { await api.eval(`document.getElementById('unlock').focus()`); await api.key('ArrowRight'); }],
    ['Space', async () => { await api.eval(`document.getElementById('unlock').focus()`); await api.key(' '); }],
    ['Enter', async () => { await api.eval(`document.getElementById('unlock').focus()`); await api.key('Enter'); }]]) {
    await api.go('?lang=en', 700);
    await act();
    await sleep(800);
    ok((await st()).view === 'home', `${label} on the Unlock pill unlocks`);
  }

  // ---------------- home
  await api.go('?lang=en#home', 1000);
  const home = await api.eval(`(() => { const ic = document.querySelector('#grid .app[data-app="storewright"] .ico'); const dock = getComputedStyle(document.querySelector('.dock')); return {grid: [...document.querySelectorAll('#grid .app')].map(a => a.querySelector('.lbl').textContent), dock: [...document.querySelectorAll('#dockList .dock-app')].map(a => a.querySelector('.lbl').textContent), dockR: dock.borderTopLeftRadius, dockBlur: dock.backdropFilter, tile: [Math.round(ic.getBoundingClientRect().width), getComputedStyle(ic).borderTopLeftRadius, (getComputedStyle(ic).backgroundImage.match(/gradient/g) || []).length], glyph: getComputedStyle(document.querySelector('#g-storewright path')).stroke, lbl: getComputedStyle(document.querySelector('#grid .lbl')).color, lblSize: getComputedStyle(document.querySelector('#grid .lbl')).fontSize, about: !!document.querySelector('.about h2'), pill: document.getElementById('status').innerText.replace(/\\s+/g, ' ').trim(), lock: !document.getElementById('lockBtn').hidden, links: [...document.querySelectorAll('.quick a')].map(a => a.href), primary: document.querySelector('.quick a').classList.contains('primary')}; })()`);
  ok(home.grid.join('|') === 'SilNest|Storewright|Portfolio|AI Vocal|Sky|Early work|Guestbook' && home.dock.join('|') === 'How I work|Contact|Clock|Calendar' && home.dockR === '999px' && /blur/.test(home.dockBlur)
    && home.tile[0] === 60 && home.tile[1] === '15px' && home.tile[2] === 3 && /url\("#tg"\)/.test(home.glyph) && home.lbl === 'rgb(238, 240, 244)' && home.lblSize === '12px' && home.about,
  'home: README tiles (60px, radius 15, gradient edge, indigo -> teal glyphs), the about card, and a pill bar with the pinned apps (was: icon grid and dock)', JSON.stringify(home));
  ok(/^Albany, NY · \d{1,2}:\d{2} (AM|PM)$/.test(home.pill) && home.lock && home.primary && home.links.includes('https://www.linkedin.com/in/canyuanye') && home.links.includes('mailto:canyuanye@gmail.com') && home.links.includes('https://yecanyuan.com/'),
    'home: the status pill shows Albany time, a Lock button appears, the about card keeps the links', JSON.stringify(home));
  await clickOn('#searchBtn');
  await sleep(500);
  ok((await st()).spot && (await api.eval(`document.activeElement.id`)) === 'spotInput', 'the top-bar Search button opens the command palette (was: the home page search dot)');
  await api.key('Escape');
  await sleep(500);
  const swi = await rect('.app[data-app="storewright"] .ico');
  await api.click(swi.x, swi.y);
  await sleep(60);
  const zoom = await api.eval(`(() => { const v = document.getElementById('appView'); const an = v.getAnimations(); const kf = an[0] && an[0].effect.getKeyframes(); return [an.length, v.dataset.origin, v.style.transformOrigin, kf && kf[0].transform, kf && String(kf[0].opacity), an[0] && an[0].effect.getTiming().duration]; })()`);
  ok(zoom[0] > 0 && zoom[1] === `${Math.round(swi.x)} ${Math.round(swi.y)}` && zoom[3] === 'scale(0.96)' && zoom[4] === '0' && zoom[5] === 200, 'app launch: scale from 0.96 plus a fade, 200 ms, from the icon (was: a zoom from the icon)', JSON.stringify(zoom));
  await sleep(700);

  // ---------------- app pages
  const appText = async (key, q = '?lang=en') => { await api.go(`${q}#home/${key}`, 900); return api.eval(`document.getElementById('appBody').innerText`); };
  let tx = await appText('silnest');
  const snA = await api.eval(`(() => { const b = document.querySelector('.ap-btns a'); return {title: document.querySelector('.ap-title').textContent, nav: document.getElementById('appTitle').textContent, href: b.href, target: b.target, label: b.firstChild.textContent, img: b.querySelectorAll('img').length, primary: b.classList.contains('primary'), shots: [...document.querySelectorAll('.shot')].map(s => s.getAttribute('aria-label').length > 30), rows: [...document.querySelectorAll('.tv-row')].map(r => r.innerText.replace(/\\s+/g, ' ').trim())}; })()`);
  const released = fmtISO(D.facts.snReleased, { month: 'short', day: 'numeric', year: 'numeric' });
  ok(snA.title === '声藏 · SilNest' && snA.href === 'https://apps.apple.com/app/id6796483224' && snA.target === '_blank' && snA.label === 'View in App Store' && snA.img === 0 && snA.primary && snA.shots.length === 2 && snA.shots.every(Boolean),
    'SilNest: a header with a primary "View in App Store" pill (plain text, no artwork), two screenshots', JSON.stringify(snA));
  ok(['Version 1.0', `Released ${released}`, 'Compatibility iOS 17.0 or later', 'Price Free', 'Privacy Data Not Collected'].every((r) => snA.rows.includes(r)) && !/android/i.test(tx),
    'SilNest info: version, release date, iOS 17.0 or later, free, Data Not Collected; no Android', JSON.stringify(snA.rows));
  tx = await appText('storewright');
  const swA = await api.eval(`(() => { const secs = [...document.querySelectorAll('.tv-sec')].map(s => [(s.querySelector('.tv-head') || {}).textContent || '', [...s.querySelectorAll('.tv-row')].map(r => r.innerText.replace(/\\s+/g, ' ').trim()), (s.querySelector('.tv-foot') || {}).textContent || '']); return {demo: [...document.querySelectorAll('.ap-btns a')].map(a => [a.firstChild.textContent, a.href, a.classList.contains('primary')]), secs}; })()`);
  const sec = (h) => swA.secs.find((x) => x[0] === h) || ['', [], ''];
  ok(swA.demo[0][0] === 'Open live demo' && swA.demo[0][1] === 'https://glacieerr.github.io/storewright' && swA.demo[0][2] && !swA.demo[1][2] && sec('Three things to look at')[1].length === 3
    && sec('Status')[1].join('|') === 'Status Complete (Nov 2026)|Release v1.0 final|Tests 800+ passing', 'Storewright: live demo (primary) and repo (ghost), three things to look at, complete (Nov 2026), 800+ tests', JSON.stringify(swA));
  ok(sec('Duty assistant eval')[1].join('|') === 'Duty assistant (part 3, StoreX Chain) 76.3%|Keyword rules 42.5%|Held-out set 80 questions'
    && sec('Duty assistant eval')[2] === 'Duty assistant (part 3, StoreX Chain): 76.3% vs 42.5% for keyword rules on a held-out 80-question set.'
    && sec('Links')[1].length === 2 && !/store AI/i.test(tx), 'Storewright eval: the part-3 duty assistant, 76.3% vs 42.5% on 80 held-out questions; links', JSON.stringify([sec('Duty assistant eval'), sec('Links')]));
  const tv = await api.eval(`(() => { const rows = [...document.querySelectorAll('.tv-row')]; const second = rows.find(r => r.previousElementSibling && r.previousElementSibling.classList.contains('tv-row')); const hd = document.querySelector('.tv-head'); const p = getComputedStyle(document.querySelector('.ap-btns .btn.primary')); const g = getComputedStyle(document.querySelector('.ap-btns .btn:not(.primary)')); const card = getComputedStyle(document.querySelector('.tv')); return {minH: Math.min(...rows.map(r => r.getBoundingClientRect().height)), inset: getComputedStyle(second, '::before').left, line: getComputedStyle(second, '::before').height, head: getComputedStyle(hd).fontSize + ' ' + getComputedStyle(hd).textTransform, card: (card.backgroundImage.match(/gradient/g) || []).length + ' ' + card.borderTopLeftRadius, primary: p.backgroundImage + ' ' + p.borderTopLeftRadius + ' ' + p.color, ghost: g.backgroundColor + ' ' + g.borderTopLeftRadius + ' ' + g.boxShadow}; })()`);
  ok(tv.minH >= 44 && tv.inset === '16px' && tv.line === '1px' && tv.head === '12px uppercase' && tv.card === '3 16px' && /linear-gradient\(rgb\(93, 97, 232\), rgb\(75, 79, 216\)\) 999px rgb\(255, 255, 255\)/.test(tv.primary) && /999px/.test(tv.ghost) && /inset/.test(tv.ghost),
    'detail pages: content in cards with gradient borders, hairline rows (inset 16px), small uppercase labels; pill buttons, primary indigo, secondary ghost (was: grouped tables)', JSON.stringify(tv));
  tx = await appText('site');
  const stA = await api.eval(`[[...document.querySelectorAll('.ap-btns a')].map(a => a.href), !!document.querySelector('.pic.site'), [...document.querySelectorAll('.tv-row')].map(r => r.innerText.replace(/\\s+/g, ' ').trim())]`);
  ok(stA[0][0] === 'https://yecanyuan.com/' && stA[1] && stA[2].includes('Online since Apr 2026'), 'Portfolio: visit button, a picture of the site, online since Apr 2026', JSON.stringify(stA));
  tx = await appText('vocal');
  const voA = await api.eval(`[[...document.querySelectorAll('.tv-row')].map(r => r.innerText.replace(/\\s+/g, ' ').trim()), [...document.querySelectorAll('.flow b')].map(b => b.textContent), document.querySelectorAll('#appBody a').length]`);
  ok(voA[0].includes('Progress First full track finished') && voA[1].join(' → ') === 'MDX-Net → GPT-SoVITS → SVC' && voA[0].includes('RTX 3050 laptop GPU') && voA[0].includes('M1 MacBook Air') && voA[2] === 0,
    'AI Vocal: first full track finished, MDX-Net → GPT-SoVITS → SVC, RTX 3050 laptop GPU and M1 MacBook Air, no links', JSON.stringify(voA));
  tx = await appText('how');
  ok(tx.startsWith('I decide what to build') && (await api.eval(`document.querySelectorAll('#appBody .tv-n').length`)) === 5, 'How I work: the quote and the loop');
  tx = await appText('contact');
  const ctA = await api.eval(`(() => { const v = document.getElementById('vcard'); return {href: v.href, dl: v.getAttribute('download'), links: [...document.querySelectorAll('#appBody a.tv-row')].map(a => a.href), rows: [...document.querySelectorAll('.tv-row')].map(r => r.innerText.replace(/\\s+/g, ' ').trim()), avatar: document.querySelector('.avatar').textContent}; })()`);
  const vcf = decodeURIComponent(ctA.href.replace(/^data:text\/vcard;charset=utf-8,/, ''));
  ok(ctA.href.startsWith('data:text/vcard') && ctA.dl === 'Canyuan-Ye.vcf' && vcf.includes('FN:Canyuan Ye') && vcf.includes('EMAIL;TYPE=INTERNET:canyuanye@gmail.com')
    && vcf.includes('URL:https://yecanyuan.com') && vcf.includes('https://www.linkedin.com/in/canyuanye') && vcf.includes('ADR;TYPE=HOME:;;;Albany;NY;;') && vcf.includes('\r\n'),
  'Contact: "Add to Contacts" is a vCard data: URI with the name, email, site, LinkedIn and Albany, NY', vcf);
  ok(ctA.links.join('|') === 'mailto:canyuanye@gmail.com|https://www.linkedin.com/in/canyuanye|https://yecanyuan.com/' && ctA.rows.includes('location Albany, NY') && ctA.rows.some((r) => /^local time \d{1,2}:\d{2} (AM|PM)$/.test(r)) && ctA.avatar === 'CY',
    'Contact: the CY disc, email, LinkedIn, website, Albany, NY and the local time', JSON.stringify(ctA.rows));
  await appText('clock');
  await sleep(300);
  const ck = await api.eval(`(() => { const rot = (h) => parseFloat(document.querySelector('.wc-row [data-hand=' + h + ']').getAttribute('transform').match(/rotate\\(([\\d.]+)/)[1]); return {hms: document.querySelector('.bigclock [data-live=hms]').textContent, avatar: (document.querySelector('#appBody image.av-img') || {getAttribute: () => ''}).getAttribute('href').slice(0, 15), text: document.querySelectorAll('#appBody .orbit-svg text').length, planets: document.querySelectorAll('#appBody [data-o]').length, dup: document.querySelectorAll('#appBody [id^="orb-"]').length, own: document.querySelectorAll('#appBody [id^="clk-"]').length, m: rot('m'), s: rot('s'), sec: Math.floor(Date.now() / 1000) % 60, min: Math.floor(Date.now() / 60000) % 60, row: document.querySelector('.wc-row').innerText.replace(/\\s+/g, ' ')}; })()`);
  const cks = await secAt('#appBody');
  const ckP0 = await planetsAt('#appBody');
  await sleep(800);
  const ckMoved = turned(ckP0, await planetsAt('#appBody'));
  const A2 = await albany();
  ok(ck.hms.startsWith(A2.hm) && ck.avatar === 'data:image/jpeg' && ck.text === 0 && ck.planets === 16 && ck.dup === 0 && ck.own > 5 && ck.row.includes(A2.hm)
    && (Math.abs(cks.a - cks.now) < 0.03 || Math.abs(cks.a - cks.now) > 0.97) && ckMoved.every((d) => d < -0.3)
    && Math.abs(ck.m - (ck.min + ck.sec / 60) * 6) < 7 && Math.abs(ck.s - ck.sec * 6) <= 6,
  'Clock: the Albany clock with the orbit (the avatar at the centre, all eight planets turning, the seconds dot in step), the digital time, and the world clock with its hands in the right place (was: an analog clock)', JSON.stringify([ck, cks, ckMoved, A2.hm]));
  await appText('calendar');
  const cal = await api.eval(`[document.querySelector('.month-grid .today .dn').textContent, document.querySelector('.cal-top h3').textContent, document.querySelectorAll('[data-goto]').length, document.querySelector('.cal-month').textContent, getComputedStyle(document.querySelector('.month-grid .today span')).backgroundImage.slice(0, 30)]`);
  ok(cal[0] === A2.day && cal[1].startsWith(A2.weekday) && cal[1].includes(A2.year) && cal[2] >= 4 && /gradient/.test(cal[4]), 'Calendar: the month in a card with today (Albany) marked, the date and the milestones', JSON.stringify(cal));
  await clickOn('[data-cal="prev"]');
  await sleep(300);
  const prevMonth = await text('.cal-month');
  ok(prevMonth !== cal[3], 'Calendar: the previous-month button turns the page', `${cal[3]} -> ${prevMonth}`);
  const nav = await api.eval(`(() => { const t = document.getElementById('appTitle'); const b = document.getElementById('appBack'); const cs = getComputedStyle(b); return {h: Math.round(document.querySelector('.nav-in').getBoundingClientRect().height), fs: getComputedStyle(t).fontSize, fw: getComputedStyle(t).fontWeight, back: b.innerText.trim(), arrow: !!b.querySelector('use[href="#u-left"]'), radius: cs.borderTopLeftRadius, ring: cs.boxShadow, blur: getComputedStyle(document.querySelector('.navbar')).backdropFilter}; })()`);
  ok(nav.h === 60 && nav.fs === '15px' && nav.fw === '600' && nav.back === 'Home' && nav.arrow && nav.radius === '999px' && /inset/.test(nav.ring) && /blur/.test(nav.blur),
    'detail page top bar: a "← Home" ghost pill and the title (was: a 44px navigation bar)', JSON.stringify(nav));
  await clickOn('#appBack');
  await sleep(700);
  s = await st();
  ok(!s.app && s.view === 'home' && s.hash === '#home', '"← Home" closes the app', JSON.stringify(s));
  await api.go('?lang=en&appearance=light#home/silnest', 900);
  const lightUI = await api.eval(`[getComputedStyle(document.getElementById('appView')).backgroundColor, (getComputedStyle(document.querySelector('.tv')).backgroundImage.match(/gradient/g) || []).length, getComputedStyle(document.querySelector('.tv-head')).color, getComputedStyle(document.querySelector('.tv-l')).color]`);
  await api.go('?lang=en&appearance=dark#home/silnest', 900);
  const darkUI = await api.eval(`[getComputedStyle(document.getElementById('appView')).backgroundColor, (getComputedStyle(document.querySelector('.tv')).backgroundImage.match(/gradient/g) || []).length, getComputedStyle(document.querySelector('.tv-head')).color, getComputedStyle(document.querySelector('.tv-l')).color]`);
  ok(lightUI[0] === 'rgb(255, 255, 255)' && lightUI[1] === 3 && lightUI[2] === 'rgb(106, 111, 121)' && lightUI[3] === 'rgb(11, 12, 14)' && darkUI[0] === 'rgb(8, 9, 12)' && darkUI[1] === 3 && darkUI[2] === 'rgb(128, 133, 143)' && darkUI[3] === 'rgb(247, 248, 248)',
    'detail pages follow the appearance: #ffffff or #08090c, the same cards, the token inks (was: grouped #EFEFF4 tables)', JSON.stringify([lightUI, darkUI]));

  // ---------------- the Early work folder
  await api.viewport(390, 844, { mobile: true, dark: true });
  await api.go('?lang=en&open=folder', 1000);
  const fo = await api.eval(`(() => { const f = document.getElementById('folderLayer'); const sc = getComputedStyle(document.getElementById('folderScrim')); return {open: f.classList.contains('open') && !f.hidden, title: document.getElementById('folderTitle').textContent, blur: sc.backdropFilter, dim: sc.backgroundColor, panel: (getComputedStyle(document.getElementById('folder')).backgroundImage.match(/gradient/g) || []).length, items: [...document.querySelectorAll('.fapp')].map(a => [a.querySelector('.lbl').textContent, a.href, a.target])}; })()`);
  ok(fo.open && fo.title === 'Early work' && /blur/.test(fo.blur) && /rgba\(3, 4, 8, 0\.62\)/.test(fo.dim) && fo.panel === 3
    && fo.items.map((i) => i[0]).join('|') === 'BASIC|CPU|Memory|WebDev|SpeedTest' && fo.items.every((i) => i[1] === `https://github.com/Glacieerr/${i[0]}` && i[2] === '_blank'),
  'folder: an overlay panel over a dimmed, blurred page; Early work holds BASIC, CPU, Memory, WebDev, SpeedTest, each linking to GitHub', JSON.stringify(fo));
  const kinds = {};
  for (let i = 0; i < 5; i++) {
    await api.eval(`document.querySelectorAll('.fapp')[${i}].focus()`);
    await sleep(80);
    kinds[await text('.fd-name')] = [await text('.fd-kind'), await text('.fd-line')];
  }
  ok(kinds.SpeedTest[0] === 'Team course project · I built the speed-test algorithm' && kinds.SpeedTest[1].includes('Kalman filter and Haversine distance') && kinds.SpeedTest[1].includes('DriveSafe')
    && ['BASIC', 'CPU', 'Memory'].every((k) => kinds[k][0].startsWith('Course project (Java)') && kinds[k][0].includes('University at Albany (SUNY)'))
    && kinds.WebDev[0] === 'Early personal project, no longer maintained' && kinds.BASIC[1] === 'A BASIC interpreter in Java: lexer, parser, interpreter.'
    && kinds.CPU[1] === 'A CPU emulator in Java: ALU, processor, instruction cache.' && kinds.Memory[1].startsWith('An OS kernel and memory-management simulator in Java, with JUnit 5 tests.')
    && kinds.WebDev[1] === 'A full-stack agile project-management web app (React, Express, MongoDB).',
  'folder captions: the verified one-liners (course projects, the early personal project, the team project and its algorithm)', JSON.stringify(kinds));
  await api.eval(`window.__nav = []; window.addEventListener('click', (e) => { const a = e.target.closest('a'); if (a) { window.__nav.push([a.href, e.defaultPrevented]); e.preventDefault(); } })`);
  await api.eval(`document.activeElement.blur()`);
  const cpu = await rect('.fapp[href$="/CPU"] .ico');
  await api.tap(cpu.x, cpu.y);
  await sleep(250);
  const first1 = await api.eval(`[window.__nav.slice(), document.querySelector('.fd-name').textContent]`);
  await api.tap(cpu.x, cpu.y);
  await sleep(250);
  const second1 = await api.eval(`window.__nav.slice()`);
  ok(first1[1] === 'CPU' && first1[0].length === 1 && first1[0][0][1] === true && second1.length === 2 && second1[1][0] === 'https://github.com/Glacieerr/CPU' && second1[1][1] === false,
    'folder: the first tap shows what a project is, the second opens it on GitHub', JSON.stringify([first1, second1]));
  await api.go('?lang=zh&open=folder', 900);
  await api.eval(`document.querySelectorAll('.fapp')[4].focus()`);
  await sleep(100);
  ok((await text('.fd-kind')) === '团队课程项目 · 我负责测速算法' && (await text('.folder-title')) === '早期作品', 'folder in Chinese: 早期作品, SpeedTest 团队课程项目 · 我负责测速算法');
  await api.key('Escape');
  await sleep(600);
  ok(!(await st()).folder, 'Escape closes the folder');

  // ---------------- Today (was Notification Center)
  await api.viewport(1440, 900, { dark: true });
  await api.go('?lang=en', 900);
  await api.eval(`document.activeElement.blur()`);
  await api.key('n');
  await sleep(600);
  const nc = await api.eval(`(() => { const p = document.getElementById('ncPanel'); const cs = getComputedStyle(p); const r = p.getBoundingClientRect(); return {open: document.getElementById('nc').classList.contains('open'), bg: (cs.backgroundImage.match(/gradient/g) || []).length, radius: cs.borderTopLeftRadius, right: Math.round(innerWidth - r.right), top: Math.round(r.top), width: Math.round(r.width), tabs: [...document.querySelectorAll('.nc-tabs [role=tab]')].map(t => [t.textContent, t.getAttribute('aria-selected')]), pill: getComputedStyle(document.querySelector('.nc-tabs')).borderTopLeftRadius, date: document.getElementById('ncDate').textContent, sum: document.getElementById('ncSummary').textContent, focus: document.activeElement.id, w: [...document.querySelectorAll('#ncWidgets .w')].map(w => { const r = w.getBoundingClientRect(); return [w.dataset.sheet, Math.round(r.top), Math.round(r.left)]; })}; })()`);
  const A3 = await albany();
  const diff = Math.round((Date.UTC(...A3.iso.split('-').map((v, i) => (i === 1 ? v - 1 : +v))) - Date.UTC(...D.day.date.split('-').map((v, i) => (i === 1 ? v - 1 : +v)))) / 864e5);
  const when = diff === 0 ? 'today' : diff === 1 ? 'yesterday' : `on ${fmtISO(D.day.date, { month: 'long', day: 'numeric' })}`;
  const expSum = `It's ${A3.hm} ${A3.ap} in Albany. Storewright's simulated store fulfilled ${orders} orders ${when}. SilNest ${D.facts.snVersion} has been on the App Store since ${fmtISO(D.facts.snReleased, { month: 'long', day: 'numeric' })}.`;
  ok(nc.open && nc.bg === 3 && nc.radius === '20px' && nc.width === 420 && nc.right < 90 && nc.top < 70 && nc.tabs.map((t) => t.join(':')).join('|') === 'Today:true|All updates:false' && nc.pill === '999px' && nc.focus === 'ncDate',
    'N opens the Today panel: a card under the top bar with Today | All updates pill tabs (was: Notification Center)', JSON.stringify(nc));
  ok(nc.date === A3.date && nc.sum === expSum, 'Today: date header and a summary built from the facts', JSON.stringify([nc.date, nc.sum, expSum]));
  const rowsY = [...new Set(nc.w.map((w) => w[1]))];
  ok(nc.w.length === 7 && rowsY.length === 5 && rowsY.every((y, i) => i === 0 || y > rowsY[i - 1]), 'Today: the widgets stacked in a column', JSON.stringify(nc.w));
  await clickOn('#ncTabAll');
  await sleep(300);
  const all = await api.eval(`[document.getElementById('ncAll').hidden, [...document.querySelectorAll('#ncNotes .nc-group')].map(g => g.querySelector('h3').textContent + ' / ' + g.querySelector('.nc-when').textContent)]`);
  ok(!all[0] && all[1].length === 3 && all[1][0] === `SilNest / ${fmtISO(D.facts.snReleased, { month: 'long', day: 'numeric', year: 'numeric' })}`, 'Today "All updates": the three updates with their dates', JSON.stringify(all));
  await api.eval(`document.getElementById('ncTabAll').focus()`);
  await api.key('ArrowLeft');
  await sleep(200);
  const tk1 = await api.eval(`[document.getElementById('ncTabToday').getAttribute('aria-selected'), document.activeElement.id, document.getElementById('ncToday').hidden, document.getElementById('ncTabAll').tabIndex]`);
  await api.key('ArrowRight');
  await sleep(200);
  const tk2 = await api.eval(`[document.getElementById('ncTabAll').getAttribute('aria-selected'), document.activeElement.id, document.getElementById('ncAll').hidden]`);
  ok(tk1[0] === 'true' && tk1[1] === 'ncTabToday' && tk1[2] === false && tk1[3] === -1 && tk2[0] === 'true' && tk2[1] === 'ncTabAll' && tk2[2] === false, 'Today tabs: arrow keys move between Today and All updates, roving focus', JSON.stringify([tk1, tk2]));
  await api.key('Escape');
  await sleep(500);
  await api.drag(720, 6, 720, 520, 16, 16);
  await sleep(700);
  ok((await st()).nc, 'pulling down from the top edge opens Today');
  const hd = await rect('#ncClose');
  await api.drag(hd.x, hd.y, hd.x, hd.y - 320, 14, 16);
  await sleep(700);
  ok(!(await st()).nc, 'dragging Today up by its handle closes it');
  await api.go('?lang=en#home', 900);
  await api.key('n');
  await sleep(500);
  const ncw = await rect('#ncWidgets .w[data-sheet="storewright"]');
  await api.click(ncw.x, ncw.y);
  await sleep(900);
  s = await st();
  ok(!s.nc && s.app === 'storewright', 'a widget in Today opens its app from the home screen', JSON.stringify(s));
  await api.viewport(390, 844, { mobile: true, dark: true });
  await api.go('?lang=en&open=nc', 900);
  const ncp = await api.eval(`(() => { const r = document.getElementById('ncPanel').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), getComputedStyle(document.getElementById('ncPanel')).borderBottomLeftRadius]; })()`);
  ok(ncp[0] === 0 && ncp[1] === 0 && ncp[2] === 390 && ncp[3] === '24px', 'Today on a phone: a sheet from the top', JSON.stringify(ncp));

  // ---------------- Quick settings (was Control Center)
  await api.viewport(1440, 900, { dark: true });
  await api.go('?lang=en', 900);
  await api.eval(`document.activeElement.blur()`);
  await api.key('c');
  await sleep(600);
  const cc = await api.eval(`(() => { const p = getComputedStyle(document.getElementById('ccPanel')); return {bg: (p.backgroundImage.match(/gradient/g) || []).length, radius: p.borderTopLeftRadius, title: document.getElementById('ccTitle').textContent, radios: [...document.querySelectorAll('#ccAppearance [role=radio]')].map(r => r.dataset.appearance), weight: [...document.querySelectorAll('#ccWeight [role=radio]')].map(r => r.dataset.weight + ':' + r.getAttribute('aria-checked')), toggles: ['ccLang', 'ccMotion', 'ccParallax'].map(id => document.getElementById(id).getAttribute('aria-pressed')), seg: getComputedStyle(document.getElementById('ccAppearance')).borderTopLeftRadius, links: [...document.querySelectorAll('.cc-links a')].map(a => [a.querySelector('.rl').textContent, a.href])}; })()`);
  ok(cc.bg === 3 && cc.radius === '20px' && cc.title === 'Quick settings' && cc.radios.join('|') === 'auto|dark|light' && cc.weight.join('|') === 'bold:true|thin:false' && cc.toggles.join('|') === 'false|false|true' && cc.seg === '999px',
    'C opens Quick settings: appearance (auto, dark, light), language, clock weight, reduce motion and parallax (was: Control Center)', JSON.stringify(cc));
  ok(JSON.stringify(cc.links) === JSON.stringify([['LinkedIn', 'https://www.linkedin.com/in/canyuanye'], ['Email', 'mailto:canyuanye@gmail.com'], ['GitHub', 'https://github.com/Glacieerr'], ['Website', 'https://yecanyuan.com/']]),
    'Quick settings links: LinkedIn, email, GitHub, website', JSON.stringify(cc.links));
  await clickOn('#ccAppearance [data-appearance="light"]');
  await sleep(300);
  const qsL = await st();
  const qsLbg = await css('#wall', 'backgroundColor');
  await clickOn('#ccAppearance [data-appearance="dark"]');
  await sleep(300);
  const qsD = await st();
  await clickOn('#ccAppearance [data-appearance="auto"]');
  await sleep(300);
  const qsA = await st();
  ok(qsL.appearance === 'light' && qsLbg === 'rgb(255, 255, 255)' && qsD.appearance === 'dark' && qsA.appearance === 'dark' && qsL.cc && qsD.cc && (await api.eval(`localStorage.getItem('ls7-appearance')`)) === 'auto',
    'Quick settings switches the appearance by click: Light, Dark, then Auto (the system)', JSON.stringify([qsL.appearance, qsLbg, qsD.appearance, qsA.appearance]));
  await clickOn('#ccMotion');
  await sleep(300);
  const rm = await api.eval(`[document.documentElement.classList.contains('reduced'), document.getAnimations().filter(a => a.constructor.name === 'CSSAnimation').length, localStorage.getItem('ls7-motion'), document.getElementById('ccMotion').getAttribute('aria-pressed'), document.getElementById('ccParallax').getAttribute('aria-disabled')]`);
  await clickOn('#ccMotion');
  await sleep(300);
  const rm2 = await api.eval(`[document.documentElement.classList.contains('reduced'), document.getAnimations().filter(a => a.constructor.name === 'CSSAnimation').length]`);
  ok(rm[0] && rm[1] === 0 && rm[2] === 'reduce' && rm[3] === 'true' && rm[4] === 'true' && !rm2[0] && rm2[1] > 0, 'Reduce motion switch stops every animation and is remembered', JSON.stringify([rm, rm2]));
  await clickOn('#ccParallax');
  await sleep(200);
  await api.move(10, 10);
  await sleep(700);
  const px = await api.eval(`[document.getElementById('ccParallax').getAttribute('aria-pressed'), document.documentElement.classList.contains('no-parallax'), document.getElementById('wallMove').style.transform, localStorage.getItem('ls7-parallax')]`);
  ok(px[0] === 'false' && px[1] && px[2] === '' && px[3] === 'off', 'Parallax switch keeps the glows still', JSON.stringify(px));
  await clickOn('#ccWeight [data-weight="thin"]');
  await sleep(200);
  const wt = [await css('.hm', 'fontWeight'), await api.eval(`document.querySelector('#ccWeight [data-weight="thin"]').getAttribute('aria-checked')`)];
  await clickOn('#ccWeight [data-weight="bold"]');
  await sleep(200);
  wt.push(await css('.hm', 'fontWeight'));
  ok(wt.join('|') === '300|true|700', 'clock weight: Thin, then Bold again', JSON.stringify(wt));
  await clickOn('#ccLang');
  await sleep(300);
  const ccl = await api.eval(`[document.documentElement.lang, document.getElementById('ccLang').getAttribute('aria-pressed'), document.getElementById('ccTitle').textContent, document.querySelector('#ncGrab .tb-lbl').textContent]`);
  ok(ccl[0] === 'zh-CN' && ccl[1] === 'true' && ccl[2] === '快捷设置' && ccl[3] === '今天', 'the language switch in Quick settings turns the page Chinese (快捷设置, 今天)', JSON.stringify(ccl));
  await clickOn('#ccLang');
  await sleep(300);
  await api.key('Escape');
  await sleep(500);
  await api.eval(`localStorage.clear()`);
  await api.go('?lang=en', 900);
  await api.drag(720, 896, 720, 420, 16, 16);
  await sleep(700);
  ok((await st()).cc, 'pulling up from the bottom edge opens Quick settings');
  const cch = await rect('#ccClose');
  await api.drag(cch.x, cch.y, cch.x, cch.y + 300, 14, 16);
  await sleep(700);
  ok(!(await st()).cc, 'dragging Quick settings down by its handle closes it');
  await api.viewport(390, 844, { mobile: true, dark: true });
  await api.go('?lang=en&open=cc', 900);
  const ccp = await api.eval(`(() => { const r = document.getElementById('ccPanel').getBoundingClientRect(); return [Math.round(r.left), Math.round(innerHeight - r.bottom), Math.round(r.width)]; })()`);
  ok(ccp[0] === 0 && ccp[1] === 0 && ccp[2] === 390, 'Quick settings on a phone: a bottom sheet', JSON.stringify(ccp));

  // ---------------- Search (was Spotlight)
  await api.viewport(1440, 900, { dark: true });
  await api.go('?lang=en#home', 900);
  await api.eval(`document.activeElement.blur()`);
  await api.key('/');
  await sleep(500);
  s = await st();
  const sp0 = await api.eval(`({focus: document.activeElement.id, apps: document.querySelectorAll('.sp-row[data-app]').length, groups: [...document.querySelectorAll('.sp-group')].map(g => g.textContent + ': ' + g.nextElementSibling.innerText.replace(/\\s+/g, ' ').trim()), panel: (() => { const r = document.getElementById('spotPanel').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.left + r.width / 2), getComputedStyle(document.getElementById('spotPanel')).borderTopLeftRadius]; })()})`);
  ok(s.spot && sp0.focus === 'spotInput' && sp0.panel[0] === 640 && sp0.panel[1] === 720 && sp0.panel[2] === '16px', '"/" opens Search: a centred card with the cursor in the field (was: Spotlight)', JSON.stringify([s, sp0.focus, sp0.panel]));
  ok(sp0.apps === 14 && JSON.stringify(sp0.groups) === JSON.stringify(['Languages: TypeScript JavaScript Swift Kotlin Python SQL', 'Frameworks and tools: React three.js Node.js Fastify PostgreSQL Vite Playwright Docker', 'Coursework: Java', 'Earlier projects: Express MongoDB']),
    'Search lists the apps with their tiles (with R3.3 batch 2: Design, Assets and the Guestbook; Uses since the user confirmed it on 2026-11-15; 14 in all) and the skills (Java under coursework; Express and MongoDB under earlier projects)', JSON.stringify(sp0));
  const search = async (q) => { await api.eval(`(() => { const i = document.getElementById('spotInput'); i.value = ${JSON.stringify(q)}; i.dispatchEvent(new Event('input')); })()`); await sleep(150); return api.eval(`({heads: [...document.querySelectorAll('.sp-head')].map(h => h.textContent), rows: [...document.querySelectorAll('.sp-row')].map(r => r.innerText.replace(/\\s+/g, ' ').trim()), first: (document.querySelector('.sp-row.first') || {}).innerText, chips: [...document.querySelectorAll('.sp-chips li')].map(l => l.textContent), count: document.getElementById('spotCount').textContent})`); };
  let r = await search('swift');
  ok(r.heads.join('|') === 'Apps|Skills' && r.chips.includes('Swift') && r.rows.some((x) => x.startsWith('SilNest')) && r.first === 'SilNest', 'search "swift": the skill and SilNest, under Apps and Skills headings; the first result is marked for Enter', JSON.stringify(r));
  r = await search('kalman');
  ok(r.rows.length === 1 && r.rows[0].startsWith('SpeedTest') && r.chips.length === 0, 'search "kalman": the SpeedTest project, not a skill', JSON.stringify(r));
  r = await search('storex');
  ok(r.heads.join('|') === 'Facts' && r.rows.some((x) => x.includes('Duty assistant (part 3, StoreX Chain): 76.3% vs 42.5% for keyword rules on a held-out 80-question set')), 'search finds facts (the duty assistant eval) under a Facts heading', JSON.stringify(r));
  await clickOn('.sp-row[data-app="storewright"]');
  await sleep(900);
  s = await st();
  ok(!s.spot && s.app === 'storewright', 'choosing a fact opens its app', JSON.stringify(s));
  await api.go('?lang=en#home', 900);
  await api.key('/');
  await sleep(400);
  await search('kalman');
  await clickOn('.sp-row[data-early]');
  await sleep(900);
  ok((await st()).folder && (await text('.fd-name')) === 'SpeedTest', 'choosing an early project opens the folder on it');
  await api.go('?lang=en#home', 900);
  await api.key('/');
  await sleep(400);
  await api.type('vocal');
  await sleep(200);
  await api.key('ArrowDown');
  await sleep(100);
  const down = await api.eval(`[document.activeElement.className, document.activeElement.dataset.app]`);
  await api.key('ArrowUp');
  await sleep(100);
  const up1 = await api.eval(`document.activeElement.id`);
  await api.key('Enter');
  await sleep(900);
  s = await st();
  ok(/sp-row/.test(down[0]) && down[1] === 'vocal' && up1 === 'spotInput' && !s.spot && s.app === 'vocal', 'Search keys: typing filters, ↓ and ↑ move between the field and the results, Enter opens the first result', JSON.stringify([down, up1, s]));
  await api.go('?lang=en#home', 900);
  await api.drag(160, 300, 160, 520, 16, 16);
  await sleep(700);
  ok((await st()).spot, 'pulling down on the home screen opens Search');
  await api.key('Escape');
  await sleep(500);
  ok(!(await st()).spot, 'Escape closes Search');
  await api.go('?lang=en', 900);
  await api.eval(`document.activeElement.blur()`);
  await api.key('k', { meta: true });
  await sleep(450);
  s = await st();
  const kf = await api.eval(`[document.activeElement.id, document.body.dataset.view]`);
  ok(s.spot && kf[0] === 'spotInput' && kf[1] === 'lock', 'Cmd+K opens Search over the lock screen, the cursor in the field', JSON.stringify([s, kf]));
  await api.key('k', { meta: true });
  await sleep(450);
  ok(!(await st()).spot, 'Cmd+K again closes Search, even from inside the search field');
  await api.key('k', { ctrl: true });
  await sleep(450);
  ok((await st()).spot, 'Ctrl+K opens Search too');
  await api.key('Escape');
  await sleep(400);
  await api.go('?lang=en#home/calendar', 900);
  await api.key('k', { meta: true });
  await sleep(450);
  s = await st();
  ok(s.spot && s.app === 'calendar' && (await api.eval(`document.getElementById('appLayer').inert && !document.getElementById('spot').inert`)), 'Cmd+K opens Search over an app page too (the page behind is inert)', JSON.stringify(s));

  console.log('---- part 3: R3.2 (real planets, the Moon, planets as apps, time travel, Sky, guestbook, commands)');
  const thetas = (box = '#orbit') => api.eval(`(() => { const D = JSON.parse(document.getElementById('data').textContent); return D.orbits.map(([rx, ry], i) => { const m = document.querySelector(${JSON.stringify(box)} + ' [data-o="' + i + '"]').getAttribute('transform').match(/translate\\((-?[\\d.]+) (-?[\\d.]+)\\)/); return (Math.atan2(-m[2] / ry, +m[1] / rx) * 180 / Math.PI + 360) % 360; }); })()`);
  const angErr = (a, b) => { let d = Math.abs(a - b) % 360; if (d > 180) d = 360 - d; return +d.toFixed(2); };
  const vclock = () => api.eval(`[document.getElementById('hm').textContent, document.getElementById('ap').textContent, document.getElementById('date').textContent]`);
  // ---------------- #79 real positions
  await api.viewport(1440, 900, { dark: true });
  await api.move(5, 5);
  await api.go('?lang=en&motion=reduce', 900);
  const realTh = await thetas();
  const realLon = Astro.planetLongitudes(Date.now());
  const realErr = realTh.map((th, i) => angErr(th, realLon[i]));
  await sleep(1100);
  const realTh2 = await thetas();
  ok(realErr.every((d) => d < 1) && realTh2.every((th, i) => angErr(th, realTh[i]) < 0.01), 'reduced motion: every planet stands still at its real heliocentric longitude (within 1° of planetLongitudes)', JSON.stringify(realErr));
  // ---------------- #80 the Moon beside Earth
  const moonGeo = () => api.eval(`(() => { const D = JSON.parse(document.getElementById('data').textContent); const e = D.planetApps.findIndex(([p]) => p === 'earth'); const [rx, ry] = D.orbits[e]; const g = document.querySelector('#orbit [data-o="' + e + '"]'); const m = g.getAttribute('transform').match(/translate\\((-?[\\d.]+) (-?[\\d.]+)\\)/); const th = Math.atan2(-m[2] / ry, +m[1] / rx) * 180 / Math.PI; const mo = g.querySelector('[data-moon]').getAttribute('transform').match(/translate\\((-?[\\d.]+) (-?[\\d.]+)\\)/); const lit = g.querySelector('.moon-lit'); const bb = lit.getAttribute('d') ? lit.getBBox() : null; const up = g.querySelector('[data-moon] > g').getAttribute('transform'); return {th, ex: +m[1], ey: +m[2], ox: +mo[1], oy: +mo[2], k: ry / rx, litX: bb ? bb.x + bb.width / 2 : null, litW: bb ? bb.width : 0, up, r: D.moonR, er: D.planetR[e]}; })()`);
  const mg = await moonGeo();
  const ph0 = Astro.moonPhase(Date.now());
  const phi = (mg.th + 180 + ph0.elong) * Math.PI / 180;
  const expDir = Math.atan2(-mg.k * Math.sin(phi), Math.cos(phi)) * 180 / Math.PI;
  const gotDir = Math.atan2(mg.oy, mg.ox) * 180 / Math.PI;
  const dist = Math.hypot(mg.ox, mg.oy);
  ok(angErr(expDir, gotDir) < 3 && dist >= mg.er + mg.r + 1 && dist <= 13 && mg.up === 'rotate(9)' && (ph0.illum < 0.01 || (mg.litW > 0 && (ph0.waxing ? mg.litX > -0.2 : mg.litX < 0.2))),
    'the Moon sits beside Earth on the right side (direction λ(Earth) + 180° + elongation), upright, never on Earth, lit as today\'s phase (on the right when waxing)', JSON.stringify({ expDir, gotDir, dist, mg, elong: ph0.elong }));
  // ---------------- #81 planets are apps
  await api.go('?lang=en', 1000);
  const pbs = await api.eval(`[...document.querySelectorAll('#plBtns .pl-btn')].map(b => [b.dataset.planet, b.dataset.app, b.getAttribute('aria-label'), b.tabIndex, parseFloat(getComputedStyle(b).width)])`);
  ok(pbs.length === 9 && pbs.map((b) => `${b[0]}>${b[1]}`).join(',') === 'mercury>storewright,venus>silnest,earth>sky,mars>vocal,jupiter>how,saturn>clock,uranus>site,neptune>contact,moon>calendar'
    && pbs[4][2] === 'Jupiter: How I work' && pbs[8][2] === 'Moon: Calendar' && pbs.every((b) => b[3] === 0 && b[4] >= 24),
  'planets are real buttons: Mercury Storewright, Venus SilNest, Earth Sky, Mars AI Vocal, Jupiter How I work, Saturn Clock, Uranus Portfolio, Neptune Contact, the Moon Calendar; named, focusable, hit targets of at least 24px', JSON.stringify(pbs));
  await api.eval(`document.querySelector('button[data-lang="zh"]').focus()`);
  for (let i = 0; i < 5; i++) await api.key('Tab');
  await sleep(250);
  const jf = await api.eval(`(() => { const b = document.querySelector('.pl-btn[data-planet="jupiter"]'); const c = document.getElementById('plCard'); return {card: !c.hidden && c.innerText.replace(/\\s+/g, ' ').trim(), desc: b.getAttribute('aria-describedby'), ring: getComputedStyle(b).outlineStyle + ' ' + getComputedStyle(b).outlineWidth}; })()`);
  const jt0 = (await thetas())[4];
  await sleep(600);
  const jt1 = (await thetas())[4];
  ok(/^Jupiter How I work Tonight in [^:]+: .+ Enter to open$/.test(jf.card || '') && jf.desc === 'plCard' && /solid 2px/.test(jf.ring) && angErr(jt0, jt1) < 0.05,
    'a focused planet stops, shows its name card (planet, app, where it is tonight (R3.3, #144), "Enter to open") and a focus ring', JSON.stringify([jf, jt0, jt1]));
  await api.key('Enter');
  await sleep(900);
  s = await st();
  ok(s.view === 'home' && s.app === 'how', 'Enter on Jupiter unlocks and opens How I work', JSON.stringify(s));
  await api.go('?lang=en', 1000);
  await api.eval(`document.querySelector('.pl-btn[data-planet="earth"]').focus()`);
  await sleep(250);
  const ec = await text('#plCard');
  const phNow = Astro.moonPhase(Date.now());
  ok(ec.includes('Earth') && ec.includes('Sky') && ec.includes(`${phNow.phaseName.en} · ${Math.round(phNow.illum * 100)}% lit`), 'Earth\'s card also shows today\'s Moon phase and how much is lit', ec);
  await api.eval(`document.activeElement.blur()`);
  const ob = await rect('#orbit');
  await api.move(ob.l + 6, ob.b - 6);
  await sleep(1300);
  const s0 = await thetas();
  await sleep(1000);
  const s1 = await thetas();
  await api.move(5, 5);
  await sleep(1300);
  const f0 = await thetas();
  await sleep(1000);
  const f1 = await thetas();
  const slowRatio = angErr(s1[7], s0[7]) / angErr(f1[7], f0[7]);
  ok(slowRatio > 0.1 && slowRatio < 0.35, 'hovering the orbit slows the whole system to about a fifth', JSON.stringify({ slow: angErr(s1[7], s0[7]), full: angErr(f1[7], f0[7]), slowRatio }));
  await api.move(ob.l + 6, ob.b - 6);
  await sleep(500);
  const sat = await rect('.pl-btn[data-planet="saturn"]');
  await api.move(sat.x, sat.y);
  await sleep(300);
  const h0 = await thetas();
  await sleep(700);
  const h1 = await thetas();
  const hc = await text('#plCard');
  ok(angErr(h0[5], h1[5]) < 0.05 && angErr(h0[0], h1[0]) > 1 && hc.includes('Saturn') && hc.includes('Clock'), 'the hovered planet stops (Saturn, with its card) while the others keep turning slowly', JSON.stringify([angErr(h0[5], h1[5]), angErr(h0[0], h1[0]), hc]));
  const earthR = await rect('.pl-btn[data-planet="earth"]');
  await api.click(earthR.x, earthR.y);
  await sleep(1000);
  s = await st();
  ok(s.view === 'home' && s.app === 'sky', 'clicking Earth on the lock screen unlocks and opens the Sky', JSON.stringify(s));
  await api.move(5, 5);

  // ---------------- #82 time travel
  await api.go('?lang=en', 1000);
  await api.eval(`document.activeElement.blur()`);
  await api.key('t');
  await sleep(400);
  const tto = await api.eval(`[!document.getElementById('tt').hidden, document.activeElement.id, document.getElementById('ttRange').min, document.getElementById('ttRange').max, document.getElementById('ttBadge').hidden, [...document.querySelectorAll('#ttTicks span')].map(x => x.textContent).join('|')]`);
  ok(tto[0] && tto[1] === 'ttRange' && tto[2] === '0' && tto[3] === '1439' && tto[4] && tto[5] === '12 AM|6 AM|12 PM|6 PM|11:59 PM', 'T opens time travel: a slider over today in Albany, 00:00 to 23:59 by the minute; no badge while it is now', JSON.stringify(tto));
  const series = D.day.series.points;
  const startH = Number(String(D.day.series.start || '00:00').split(':')[0]);
  const sumBy = (h) => series.reduce((a, v, k) => (startH + k + 1 <= h ? a + v : a), 0);
  await api.eval(`(() => { const r = document.getElementById('ttRange'); r.value = '1020'; r.dispatchEvent(new Event('input', {bubbles: true})); })()`);
  await sleep(1300);
  const tt5 = await api.eval(`({clock: [document.getElementById('hm').textContent, document.getElementById('ap').textContent], badge: [document.getElementById('ttBadge').hidden, document.getElementById('ttBadgeTxt').textContent], store: (() => { const w = document.querySelector('#track .w[data-sheet="store-day"]'); return [w.querySelector('.w-num').textContent, w.querySelector('.big span:last-child').textContent, !!w.querySelector('.sp-mark'), w.querySelector('.w-hd .rt').textContent]; })(), valuetext: document.getElementById('ttRange').getAttribute('aria-valuetext')})`);
  const vt5 = await api.eval(`Date.now() + 0`);
  const p5 = Astro.zonedParts(vt5, 'America/New_York');
  const target5 = Astro.zonedTime(p5.year, p5.month, p5.day, 17, 0, 'America/New_York');
  const th5 = await thetas();
  const lon5 = Astro.planetLongitudes(target5);
  const err5 = th5.map((th, i) => angErr(th, lon5[i]));
  ok(tt5.clock[0] === '5:00' && tt5.clock[1] === 'PM' && !tt5.badge[0] && /^Time travel · .*5:0\d PM$/.test(tt5.badge[1]) && /5:0\d PM/.test(tt5.valuetext),
    'dragging the slider to 17:00 moves the clock to 5:00 PM, with a "Time travel · …" badge', JSON.stringify(tt5));
  ok(tt5.store[0] === sumBy(17).toLocaleString('en-US') && tt5.store[1] === 'items picked by 5 PM' && tt5.store[2] && /5:0\d PM/.test(tt5.store[3]),
    'the store-day card replays the day: items picked by 5 PM from the hourly series, a marker on the sparkline', JSON.stringify([tt5.store, sumBy(17)]));
  ok(err5.every((d) => d < 1), 'while travelling the spin pauses and every planet glides to its real position for that moment', JSON.stringify(err5));
  await api.key('ArrowRight');
  await sleep(300);
  const tt6 = await vclock();
  ok(tt6[0] === '5:01', 'arrow keys on the slider move by a minute', JSON.stringify(tt6));
  await api.key('PageUp');
  await sleep(300);
  const tt7 = await vclock();
  ok(tt7[0] === '6:01' && tt7[1] === 'PM', 'Page Up moves an hour', JSON.stringify(tt7));
  await clickOn('#ttNow');
  await sleep(1200);
  const A5 = await albany();
  const back = await api.eval(`[document.getElementById('hm').textContent, document.getElementById('ttBadge').hidden, !!document.querySelector('#track .w[data-sheet="store-day"] .sp-mark'), document.getElementById('ttRange').value]`);
  ok(back[0] === A5.hm && back[1] && !back[2], '"Back to now" returns the clock, the badge and the store card to now', JSON.stringify([back, A5.hm]));
  // the Dates scale: a month ahead, the Moon follows
  await clickOn('#ttScale [data-scale="dates"]');
  await sleep(200);
  await api.eval(`document.getElementById('ttRange').focus()`);
  await api.key('PageUp');
  await sleep(1400);
  // a month of Albany's calendar at the same time of day (batch 6, #177: not 30 times 24 hours)
  const p30 = Astro.zonedParts(Date.now(), 'America/New_York');
  const vt30 = Astro.zonedTime(p30.year, p30.month, p30.day + 30, p30.hour, p30.minute, 'America/New_York') + (Date.now() % 60000);
  const dateExp = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(vt30));
  const d30 = await vclock();
  const th30 = await thetas();
  const lon30 = Astro.planetLongitudes(vt30);
  const err30 = th30.map((th, i) => angErr(th, lon30[i]));
  const mg30 = await moonGeo();
  const ph30 = Astro.moonPhase(vt30);
  const phi30 = (mg30.th + 180 + ph30.elong) * Math.PI / 180;
  const dir30 = angErr(Math.atan2(-mg30.k * Math.sin(phi30), Math.cos(phi30)) * 180 / Math.PI, Math.atan2(mg30.oy, mg30.ox) * 180 / Math.PI);
  ok(d30[2] === dateExp && err30.every((d) => d < 1) && dir30 < 3,
    'Dates: Page Up jumps a month; the date, the planets\' real positions and the Moon\'s place round Earth follow', JSON.stringify({ d30, dateExp, err30, dir30 }));
  // release: let go of the slider and it comes back to now
  const rr = await rect('#ttRange');
  await api.drag(rr.x, rr.y, rr.x + rr.w * 0.3, rr.y, 8, 16);
  await sleep(300);
  const dragged = await api.eval(`[document.getElementById('ttBadge').hidden, document.getElementById('date').textContent]`);
  await sleep(1700);
  const relBack = await api.eval(`[document.getElementById('ttBadge').hidden, document.getElementById('date').textContent, document.getElementById('ttRange').value]`);
  const A6 = await albany();
  ok(!dragged[0] && dragged[1] !== A6.date && relBack[0] && relBack[1] === A6.date && relBack[2] === '0', 'dragging the slider travels; let go and it comes back to now after about 1.5 s', JSON.stringify([dragged, relBack, A6.date]));
  await api.key('Escape');
  await sleep(400);
  ok((await api.eval(`document.getElementById('tt').hidden`)) && (await st()).view === 'lock', 'Esc closes time travel (and does not lock or unlock anything)');
  await api.key('c');
  await sleep(450);
  await clickOn('#ccTt');
  await sleep(450);
  const viaQs = await api.eval(`[!document.getElementById('tt').hidden, document.activeElement.id, document.getElementById('cc').classList.contains('open')]`);
  await api.key('Escape');
  await sleep(300);
  await api.key('k', { meta: true });
  await sleep(400);
  await api.type('>time');
  await sleep(200);
  await api.key('Enter');
  await sleep(500);
  const viaCmd = await api.eval(`[!document.getElementById('tt').hidden, document.activeElement.id]`);
  ok(viaQs[0] && viaQs[1] === 'ttRange' && !viaQs[2] && viaCmd[0] && viaCmd[1] === 'ttRange', 'time travel also opens from Quick settings and from ⌘K "> Time travel"', JSON.stringify([viaQs, viaCmd]));
  await api.key('Escape');
  await sleep(300);
  // reduced motion: the planets jump instead of gliding
  await api.go('?lang=en&motion=reduce&open=tt-dates', 900);
  await api.eval(`(() => { const r = document.getElementById('ttRange'); r.value = '100'; r.dispatchEvent(new Event('input', {bubbles: true})); })()`);
  await sleep(60);
  const thR = await thetas();
  const lonR = Astro.planetLongitudes(Date.now() + 100 * 86400000);
  ok(thR.every((th, i) => angErr(th, lonR[i]) < 1), 'reduced motion: time travel jumps the planets to their positions at once', JSON.stringify(thR.map((th, i) => angErr(th, lonR[i]))));

  // ---------------- #83 the Sky app
  await api.go('?lang=en#sky', 1300);
  const sky0 = await api.eval(`({app: document.getElementById('appView').dataset.app, city: document.getElementById('skyCity').textContent, meta: document.getElementById('skyMeta').textContent, svg: !!document.querySelector('#skyChart svg.sky-chart'), theme: document.querySelector('#skyChart svg').getAttribute('class'), rows: document.querySelectorAll('#skyTonight .sky-pl').length, icon: !!document.querySelector('#grid .app[data-app="sky"] use[href="#g-sky"]')})`);
  ok(sky0.app === 'sky' && sky0.city === 'Albany, NY' && /42\.65° N, 73\.76° W · Times in Albany time \((EST|EDT)\)/.test(sky0.meta) && sky0.svg && /sky-theme-dark/.test(sky0.theme) && sky0.rows === 7 && sky0.icon,
    '#sky opens the Sky app over Albany: the chart (dark on the dark page), seven planets in "Tonight", times named by zone; the Sky has a home-screen icon', JSON.stringify(sky0));
  const searchSky = async (q) => {
    await api.eval(`(() => { const i = document.getElementById('skyQ'); i.focus(); i.value = ${JSON.stringify(q)}; i.dispatchEvent(new Event('input', {bubbles: true})); })()`);
    await sleep(120);
    return api.eval(`[...document.querySelectorAll('#skyList .sky-opt b')].map(b => b.textContent)`);
  };
  const qTokyo = await searchSky('tokyo');
  const qDong = await searchSky('东京');
  const qBei = await searchSky('beijing');
  const qLL = await searchSky('35.68, 139.69');
  ok(qTokyo[0] === 'Tokyo' && qDong[0] === 'Tokyo' && qBei[0] === 'Beijing' && /35\.68° N, 139\.69° E/.test(qLL[0] || ''), 'city search finds "tokyo", "东京" and "beijing" (pinyin is the English name), and reads "lat, lon"', JSON.stringify([qTokyo, qDong, qBei, qLL]));
  await searchSky('tokyo');
  await api.key('Enter');
  await sleep(500);
  const tk = await api.eval(`[document.getElementById('skyCity').textContent, document.getElementById('skyMeta').textContent, localStorage.getItem('ls7-sky-city'), document.getElementById('skyList').hidden]`);
  ok(tk[0] === 'Tokyo' && /Tokyo time \(GMT\+9\)/.test(tk[1]) && tk[2] === 'tokyo' && tk[3], 'Enter picks the first match; times switch to Tokyo time and the city is remembered', JSON.stringify(tk));
  await api.go('?lang=en#home', 900);
  ok((await text('#tonightW .tw-title')) === 'Tonight in Tokyo', 'the home screen\'s Tonight card follows the remembered city');
  await api.eval(`localStorage.clear()`);
  await api.go('?lang=en#sky/sydney', 1200);
  const syd = await api.eval(`(() => { const p = document.querySelector('#skyTonight .sky-moon-row svg .mi-lit'); const b = p ? p.getBBox() : null; return [document.getElementById('skyCity').textContent, document.getElementById('skyMeta').textContent, b ? b.x + b.width / 2 : null]; })()`);
  const phSyd = Astro.moonPhase(Date.now());
  const sydLitRight = syd[2] == null ? null : syd[2] > 0;
  ok(syd[0] === 'Sydney' && /33\.87° S, 151\.21° E/.test(syd[1]) && /Sydney time \(GMT\+1[01]\)/.test(syd[1]), '#sky/sydney opens the Sky over Sydney', JSON.stringify(syd));
  ok(phSyd.illum > 0.98 || phSyd.illum < 0.02 || sydLitRight === !phSyd.waxing, 'south of the equator the Moon icon in "Tonight" is mirrored (a waxing Moon is lit on the left)', JSON.stringify([syd[2], phSyd.waxing]));
  // Albany on 14 November 2026 (sunset about 4:33 PM)
  await api.go('?lang=en#sky/albany', 1200);
  await api.eval(`(() => { const d = document.getElementById('skyDate'); d.value = '2026-11-14'; d.dispatchEvent(new Event('change', {bubbles: true})); })()`);
  await sleep(300);
  await clickOn('#skyMode [data-sky="tonight"]');
  await sleep(400);
  const alb = await api.eval(`({rows: [...document.querySelectorAll('#skyTonight .tv-row')].map(r => r.innerText.replace(/\\s+/g, ' ').trim()), at: document.getElementById('skyAt').textContent, mode: document.querySelector('#skyMode [aria-checked="true"]').dataset.sky})`);
  const sunRow = alb.rows.find((r) => r.startsWith('Sun')) || '';
  ok(/Sunset 4:3[2-4] PM · Sunrise 6:4[5-7] AM/.test(sunRow) && alb.rows.some((r) => /^Dark sky 6:(09|10|11) PM to 5:0[7-9] AM/.test(r)) && /Nov 14 · 9:00 PM/.test(alb.at) && alb.mode === 'tonight',
    'Albany, 14 November 2026: sunset 4:33 PM, sunrise 6:46 AM, dark sky 6:10 PM to 5:08 AM; "Tonight" is 9 PM', JSON.stringify(alb));
  ok(alb.rows.some((r) => /^Moon .*Waxing crescent · 2\d% lit/.test(r) && /Next full Moon Nov 24 · next new Moon Dec [89]/.test(r))
    && alb.rows.some((r) => /^Saturn .*Most of the night best at 8:5\d PM, S, 4\d° up mag 0\.7/.test(r)) && alb.rows.some((r) => /^Uranus binoculars/.test(r)) && alb.rows.some((r) => /^Neptune telescope/.test(r)),
  'the Albany list is sane: a waxing crescent, the next full and new Moons, Saturn most of the night, Uranus and Neptune marked binoculars and telescope', JSON.stringify(alb.rows));
  await clickOn('#skyRed');
  await sleep(300);
  const red2 = await api.eval(`[document.querySelector('#skyChart svg').getAttribute('class'), document.getElementById('appView').classList.contains('sky-red'), getComputedStyle(document.querySelector('.sky-city')).color, document.getElementById('skyRed').getAttribute('aria-pressed')]`);
  ok(/sky-theme-red/.test(red2[0]) && red2[1] && red2[3] === 'true' && /^rgb\(255, 13\d, 12\d\)$/.test(red2[2]), 'night vision turns the chart and the page red', JSON.stringify(red2));
  await clickOn('#skyRed');
  await sleep(200);
  const figOn = await api.eval(`document.querySelectorAll('#skyChart .sky-label-figure').length`);
  await clickOn('#skyNames');
  await sleep(250);
  const figOff = await api.eval(`document.querySelectorAll('#skyChart .sky-label-figure').length`);
  await clickOn('#skyNames');
  ok(figOn > 2 && figOff === 0, 'the constellation-names switch shows and hides the figure names', JSON.stringify([figOn, figOff]));
  await sleep(250);
  await api.eval(`document.querySelector('#skyChart .sky-body[tabindex="0"]').focus()`);
  await sleep(150);
  const info1 = await api.eval(`[document.activeElement.dataset.id, document.getElementById('skyInfo').textContent, document.activeElement.getAttribute('role'), document.activeElement.getAttribute('aria-label')]`);
  await api.key('ArrowRight');
  await sleep(150);
  const info2 = await api.eval(`[document.activeElement.dataset.id, document.getElementById('skyInfo').textContent]`);
  ok(info1[1] && info1[1].startsWith(info1[3]) && info1[2] === 'img' && info2[0] !== info1[0] && info2[1] !== info1[1], 'focusing a body shows where it is; arrow keys move between the bodies', JSON.stringify([info1, info2]));
  // Tromsø in polar night, and a place by coordinates
  await api.go('?lang=en#sky/tromso', 1200);
  await api.eval(`(() => { const d = document.getElementById('skyDate'); d.value = '2026-12-15'; d.dispatchEvent(new Event('change', {bubbles: true})); })()`);
  await sleep(400);
  const tro = await api.eval(`[...document.querySelectorAll('#skyTonight .tv-row')].map(r => r.innerText.replace(/\\s+/g, ' ').trim()).slice(0, 2)`);
  ok(tro[0] === 'Sun Polar night: the Sun does not rise.' && /^Dark sky \d/.test(tro[1]), 'Tromsø on 15 December: polar night, the Sun does not rise', JSON.stringify(tro));
  // "Use my location": asked for only on a click, stays in the browser
  await api.eval(`navigator.geolocation.getCurrentPosition = (ok) => setTimeout(() => ok({ coords: { latitude: 48.8566, longitude: 2.3522, accuracy: 50 } }), 50)`);
  const reqs0 = api.requests.length;
  const kept0 = await api.eval(`localStorage.getItem('ls7-sky-city')`);
  await clickOn('#skyGeo');
  await sleep(1000);
  const geo = await api.eval(`[document.getElementById('skyCity').textContent, document.getElementById('skyMeta').textContent, localStorage.getItem('ls7-sky-city')]`);
  ok(geo[0] === 'My location' && /48\.86° N, 2\.35° E/.test(geo[1]) && geo[2] === kept0 && api.requests.length === reqs0, '"Use my location" asks the browser on a click; the place is used but not stored, and nothing is sent', JSON.stringify(geo));
  // the Sky follows time travel unless a time was set there
  await api.go('?lang=en#sky', 1200);
  const at0 = await text('#skyAt');
  await api.key('t');
  await sleep(300);
  await clickOn('#ttScale [data-scale="dates"]');
  await api.eval(`(() => { const r = document.getElementById('ttRange'); r.value = '10'; r.dispatchEvent(new Event('input', {bubbles: true})); })()`);
  await sleep(400);
  const at1 = await api.eval(`[document.getElementById('skyAt').textContent, !document.getElementById('skyFollow').hidden]`);
  ok(at1[0] !== at0 && at1[1], 'the Sky app follows time travel ("Follows time travel")', JSON.stringify([at0, at1]));
  await api.key('Escape');
  await sleep(300);

  // ---------------- #85 the guestbook
  await api.go('?lang=en#home/contact', 900);
  const gbk = await api.eval(`({head: document.getElementById('gbHead').textContent, wait: (document.getElementById('gbWait') || {}).textContent, load: (document.getElementById('gbLoad') || {}).textContent, note: (document.querySelector('#gbLoadRow .gb-note') || {}).textContent, frame: !!document.getElementById('gbFrame'), giscus: document.querySelectorAll('script[src*="giscus"], iframe[src*="giscus"]').length, cfg: JSON.parse(document.getElementById('data').textContent).giscus})`);
  ok(gbk.head === 'Guestbook' && gbk.wait === undefined && gbk.load === 'Open the guestbook' && gbk.note === 'Opening it connects to giscus.app and GitHub.' && gbk.frame && gbk.giscus === 0
    && gbk.cfg.repo === 'Glacieerr/Glacieerr.github.io' && gbk.cfg.category === 'Guestbook'
    && gbk.cfg.mapping === 'specific' && gbk.cfg.term === 'guestbook' && gbk.cfg.reactionsEnabled === '1' && /^R_\w{8,}$/.test(gbk.cfg.repoId) && /^DIC_\w{12,}$/.test(gbk.cfg.categoryId)
    && gbk.cfg.themes.dark === 'https://glacieerr.github.io/giscus-dusk-dark.css' && gbk.cfg.themes.light === 'https://glacieerr.github.io/giscus-dusk-light.css',
  'the guestbook: its ids are filled in (go-live, 2026-11-16), so it offers a button that says it will connect to giscus and loads nothing until the visitor clicks; one config object (repo, Guestbook category, specific term, reactions, Dusk themes)', JSON.stringify(gbk));
  await api.go('?lang=zh#home/contact', 900);
  ok((await text('#gbLoad')) === '打开留言簿' && (await text('#gbHead')) === '留言簿', 'the guestbook button in Chinese');
  ok(!api.requests.some((u) => /giscus|github\.com\/login|api\.github/i.test(u)), 'nothing has contacted giscus or GitHub');
  // The guestbook as if giscus had loaded, without loading it: a stand-in frame (no address) and
  // the message giscus sends first. Found live on 2026-11-16: the "Loading" line stayed, and the
  // frame ran 11 px past the card's right edge.
  const gbLoaded = await api.eval(`(() => {
    const box = document.getElementById('gbFrame'), row = document.getElementById('gbLoadRow');
    window.dispatchEvent(new MessageEvent('message', { origin: 'https://example.com', data: { giscus: { resizeHeight: 300 } } }));
    const keptForOthers = !row.hidden;
    const f = document.createElement('iframe');
    f.className = 'giscus-frame';
    box.append(f);
    window.dispatchEvent(new MessageEvent('message', { origin: 'https://giscus.app', data: { giscus: { resizeHeight: 300 } } }));
    const card = document.querySelector('#guestbook .gb-card').getBoundingClientRect(), fr = box.getBoundingClientRect();
    return { keptForOthers, hidden: row.hidden, inside: fr.width > 100 && fr.left >= card.left && fr.right <= card.right + 0.5, card: [Math.round(card.left), Math.round(card.right)], frame: [Math.round(fr.left), Math.round(fr.right)] };
  })()`);
  ok(gbLoaded.keptForOthers && gbLoaded.hidden && gbLoaded.inside,
    'the guestbook once loaded: its "Loading" line goes when giscus first writes from its frame (a message from anywhere else changes nothing), and the frame stays inside its card', JSON.stringify(gbLoaded));
  const here_ = fileURLToPath(new URL('.', import.meta.url));
  const gcss = ['dark', 'light'].map((m) => existsSync(`${here_}../dist/giscus-dusk-${m}.css`) ? readFileSync(`${here_}../dist/giscus-dusk-${m}.css`, 'utf8') : '');
  ok(gcss.every((c) => /--color-fg-default/.test(c) && /--color-canvas-default/.test(c) && /--color-btn-primary-bg/.test(c)) && /transparent_dark/.test(gcss[0]) && /"light"/.test(gcss[1]),
    'the two Dusk themes for giscus are written next to index.html (overriding its --color-* variables, built-in fallbacks noted)');

  // ---------------- #86 commands and shortcuts
  await api.eval(`localStorage.clear()`);
  await api.go('?lang=en', 900);
  await api.eval(`document.activeElement.blur()`);
  await api.key('k', { meta: true });
  await sleep(400);
  await api.type('>');
  await sleep(150);
  const cmds = await api.eval(`[...document.querySelectorAll('#spotList .sp-cmd .sp-t')].map(x => x.textContent)`);
  const wantCmds = ['Open SilNest', 'Open Storewright', 'Open Portfolio', 'Open AI Vocal', 'Open How I work', 'Open Contact', 'Open Clock', 'Open Calendar', 'Open Sky', 'Open Design', 'Open Assets', 'Open Uses', 'Open Early work', 'Dark mode', 'Light mode', 'Appearance: match the system', 'English', '中文', 'Time travel', 'Back to now', 'Sky over Albany, NY', 'Reduce motion: on', 'View source on GitHub', 'Guestbook', 'Lock screen', 'Keyboard shortcuts', 'About this site', 'Standby', "Today's wallpaper", 'Show the tour again', 'Quick view (one page)', 'Present mode'];
  ok(JSON.stringify(cmds) === JSON.stringify(wantCmds) && (await api.eval(`document.querySelector('#spotList [data-cmd="source"]').href`)) === 'https://github.com/Glacieerr/Glacieerr.github.io',
    '">" switches Search to commands: open every app (and, R3.3 batch 2, Design and Assets; Uses once confirmed), dark or light, English or 中文, time travel, the sky over a city, reduced motion, view source, guestbook, lock, shortcuts, about this site, standby, the wallpaper, the tour (and, R3.3 batch 3, the quick view and present mode)', JSON.stringify(cmds));
  await api.type('light');
  await sleep(150);
  await api.key('Enter');
  await sleep(400);
  s = await st();
  ok(s.appearance === 'light' && !s.spot, '">light" + Enter switches to the light page', JSON.stringify(s));
  await api.key('k', { meta: true });
  await sleep(400);
  await api.type('>sky tokyo');
  await sleep(200);
  const skyCmd = await api.eval(`[...document.querySelectorAll('#spotList .sp-cmd .sp-t')].map(x => x.textContent)`);
  await api.key('Enter');
  await sleep(1000);
  s = await st();
  const skyCity2 = await text('#skyCity');
  ok(skyCmd[0] === 'Sky over Tokyo' && s.app === 'sky' && skyCity2 === 'Tokyo', '">sky tokyo" opens the Sky over Tokyo', JSON.stringify([skyCmd, s, skyCity2]));
  await api.key('Escape');
  await sleep(500);
  await api.eval(`localStorage.clear()`);
  await api.go('?lang=en', 900);
  await api.eval(`document.activeElement.blur()`);
  await api.key('k', { meta: true });
  await sleep(400);
  await api.type('>中文');
  await sleep(150);
  await api.key('Enter');
  await sleep(400);
  const zhc = await api.eval(`[document.documentElement.lang, document.querySelector('#ncGrab .tb-lbl').textContent]`);
  await api.key('k', { meta: true });
  await sleep(400);
  await api.type('>留言');
  await sleep(150);
  await api.key('Enter');
  await sleep(1000);
  const gbFocus = await api.eval(`[document.getElementById('appView').dataset.app, document.activeElement.id]`);
  ok(zhc[0] === 'zh-CN' && zhc[1] === '今天' && gbFocus[0] === 'contact' && gbFocus[1] === 'gbHead', 'commands work in Chinese too: ">中文" switches the language, ">留言" opens the guestbook', JSON.stringify([zhc, gbFocus]));
  await api.eval(`localStorage.clear()`);
  await api.go('?lang=en', 900);
  await api.eval(`document.activeElement.blur()`);
  await api.key('?', { code: 'Slash', keyCode: 191, shift: true });
  await sleep(450);
  const keySheet = await api.eval(`({open: document.getElementById('keys').classList.contains('open'), focus: document.activeElement.id, rows: [...document.querySelectorAll('#keysList .kr')].map(r => r.querySelector('dt').innerText.replace(/\\s+/g, ' ').trim()), modal: document.getElementById('keysPanel').getAttribute('aria-modal'), lockInert: document.getElementById('lock').inert})`);
  ok(keySheet.open && keySheet.focus === 'keysTitle' && keySheet.modal === 'true' && keySheet.lockInert && ['⌘K Ctrl K', '/', '?', 'N', 'C', 'T', 'Esc', 'Enter Space', '← →', 'Home End', 'Page Up Page Down', '↑ ↓', 'Tab'].every((k) => keySheet.rows.includes(k)),
    '"?" opens the shortcuts sheet: every key the site handles, as a modal dialog', JSON.stringify(keySheet));
  await api.key('Tab');
  await api.key('Tab');
  await api.key('Tab');
  const kTrap = await api.eval(`document.getElementById('keysPanel').contains(document.activeElement)`);
  await api.key('Escape');
  await sleep(400);
  ok(kTrap && !(await api.eval(`document.getElementById('keys').classList.contains('open')`)), 'the shortcuts sheet keeps focus inside and closes with Esc');
  await api.go('?lang=zh&open=keys', 800);
  const kz = await api.eval(`[document.getElementById('keysTitle').textContent, document.querySelector('#keysList .kr dd').textContent]`);
  ok(kz[0] === '键盘快捷键' && kz[1] === '搜索，或输入 > 使用命令', 'the shortcuts sheet in Chinese', JSON.stringify(kz));

  // ---------------- #88 the Storewright screenshot in a Dusk frame
  await api.go('?lang=en#home/storewright', 900);
  const frame88 = await api.eval(`(() => { const p = document.querySelector('.pic.img-sw-demo'); const cs = getComputedStyle(p); const af = getComputedStyle(p, '::after'); return {r: cs.borderTopLeftRadius, shadow: cs.boxShadow, ring: af.backgroundImage.slice(0, 30), mask: (af.maskImage || af.webkitMaskImage || '').slice(0, 20)}; })()`);
  ok(frame88.r === '16px' && /linear-gradient/.test(frame88.ring) && /0px 0px 0px 1px/.test(frame88.shadow) && /\d+px \d+px -\d+px/.test(frame88.shadow), 'the Storewright screenshot sits in the Dusk frame: rounded, a gradient hairline and a soft glow', JSON.stringify(frame88));

  // ---------------- contrast of the new pieces, both modes
  for (const mode of ['dark', 'light']) {
    const c = {};
    await api.viewport(1440, 900, { dark: true });
    await api.go(`?lang=en&appearance=${mode}`, 900);
    await api.eval(`document.querySelector('.pl-btn[data-planet="earth"]').focus()`);
    await sleep(250);
    for (const sel of ['.pc-app', '.pc-hint', '.pc-moon']) c[sel] = (await contrastOf(api, sel) || {}).p05;
    await api.eval(`document.activeElement.blur()`);
    await api.key('t');
    await sleep(300);
    await api.eval(`(() => { const r = document.getElementById('ttRange'); r.value = '1020'; r.dispatchEvent(new Event('input', {bubbles: true})); })()`);
    await sleep(300);
    await api.eval(`document.getAnimations().forEach(a => a.pause())`);
    for (const sel of ['.tt-title', '.tt-ticks span', '.tt-hint', '#ttBadgeTxt']) c[sel] = (await contrastOf(api, sel) || {}).p05;
    await api.go(`?lang=en&appearance=${mode}#home`, 900);
    for (const sel of ['.tw-title', '.tw-line']) c[sel] = (await contrastOf(api, sel) || {}).p05;
    await api.go(`?lang=en&appearance=${mode}#sky`, 1200);
    for (const sel of ['.sky-meta', '.sky-note', '.sky-info', '.sky-best', '.sky-moon-t', '.sky-tag', '.sky-night-l span']) {
      await api.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (e) e.scrollIntoView({block: 'center'}); })()`);
      c[sel] = (await contrastOf(api, sel) || {}).p05;
    }
    await api.go(`?lang=en&appearance=${mode}&open=keys`, 800);
    c['.kr dd'] = (await contrastOf(api, '.kr dd') || {}).p05;
    await api.go(`?lang=en&appearance=${mode}#home/contact`, 800);
    // the guestbook's line under its button (before go-live it was the #gbWait placeholder)
    await api.eval(`document.querySelector('#gbLoadRow .gb-note').scrollIntoView({block: 'center'})`);
    c['#gbLoadRow .gb-note'] = (await contrastOf(api, '#gbLoadRow .gb-note') || {}).p05;
    console.log('     contrast R3.2', mode, JSON.stringify(c));
    ok(Object.values(c).every((v) => v >= 4.5), `contrast of the new pieces on the ${mode} page (planet card, time travel, Tonight card, Sky app, shortcuts, guestbook) >= 4.5:1`, JSON.stringify(c));
  }
  await api.viewport(1440, 900, { dark: true });

  // ---------------- preview flags
  const flag = async (q, expr) => { await api.go(q, 900); return api.eval(expr); };
  const flags = {
    ncAll: await flag('?lang=en&open=nc-all', `[document.getElementById('nc').classList.contains('open'), document.getElementById('ncTabAll').getAttribute('aria-selected')]`),
    cc: await flag('?lang=en&open=cc', `document.getElementById('cc').classList.contains('open')`),
    spot: await flag('?lang=en&open=spotlight&q=java', `[document.getElementById('spot').classList.contains('open'), document.getElementById('spotInput').value, [...document.querySelectorAll('.sp-chips li')].map(l => l.textContent)]`),
    app: await flag('?lang=en&app=calendar', `[document.body.dataset.view, document.getElementById('appView').dataset.app, location.hash]`),
    homeHow: await flag('?lang=en#home/how', `document.getElementById('appView').dataset.app`),
    mid: await flag('?lang=en&page=mid', `(() => { const d = [...document.querySelectorAll('#dots .dot')]; return [d.findIndex(x => x.getAttribute('aria-current') === 'true'), d.length]; })()`),
    motion: await flag('?lang=en&motion=reduce', `document.documentElement.classList.contains('reduced')`),
    thin: await flag('?lang=en&weight=thin', `document.documentElement.classList.contains('thin')`),
  };
  ok(flags.ncAll[0] && flags.ncAll[1] === 'true' && flags.cc && flags.spot[0] && flags.spot[1] === 'java' && flags.spot[2].includes('Java')
    && flags.app[0] === 'home' && flags.app[1] === 'calendar' && flags.homeHow === 'how' && flags.mid[1] >= 2 && flags.mid[0] === Math.ceil(flags.mid[1] / 2) - 1 && flags.motion && flags.thin,
  'preview flags: ?open=nc|nc-all|cc|spotlight&q=|folder, ?app=, #home/how, ?page=mid, ?motion=reduce, ?weight=thin', JSON.stringify(flags));

  {
  console.log('---- part 4: R3.3 batch 1a (the Sky app, part one: ideas #92 to #144)');
  // ---------------- the astronomy behind it (live/astro.mjs, additive), checked in Node
  {
    const msJD = (jd) => (jd - 2440587.5) * 864e5;
    // Meeus, Astronomical Algorithms (2nd ed.), example 44.a: 1992 December 16, 0h UT
    const gm = Astro.galileanMoons(msJD(2448972.5)).map((m) => [m.name, +m.x.toFixed(2), +m.y.toFixed(2)]);
    const want = [['io', -3.44, 0.21], ['europa', 7.44, 0.25], ['ganymede', 1.24, 0.65], ['callisto', 7.08, 1.10]];
    ok(gm.every((m, i) => m[0] === want[i][0] && Math.abs(m[1] - want[i][1]) < 0.03 && Math.abs(m[2] - want[i][2]) < 0.03),
      '#135 galileanMoons() reproduces Meeus example 44.a (1992-12-16: Io -3.44, Europa +7.44, Ganymede +1.24, Callisto +7.08 Jupiter radii)', JSON.stringify(gm));
    const r92 = Astro.saturnRings(msJD(2448972.5));
    const bAt = (iso) => Astro.saturnRings(Date.parse(iso)).B;
    ok(Math.abs(r92.B - 16.442) < 0.1 && Math.abs(r92.a - 35.87) < 0.1 && bAt('2025-03-22T12:00:00Z') > 0 && bAt('2025-03-23T12:00:00Z') < 0 && bAt('2009-09-04T12:00:00Z') < 0 && bAt('2009-09-05T12:00:00Z') > 0,
      '#135 saturnRings(): Meeus example 45.a (B 16.44°, a 35.87") and the ring-plane crossings of 2009-09-04 and 2025-03-23', JSON.stringify([r92, bAt('2025-03-22T12:00:00Z'), bAt('2025-03-23T12:00:00Z')]));
    // published 2026 equinoxes and solstices (USNO): Mar 20 14:46, Sep 23 00:05, Dec 21 20:50 UTC
    const ev = [[0, '2026-03-20T14:46:00Z'], [180, '2026-09-23T00:05:00Z'], [270, '2026-12-21T20:50:00Z']]
      .map(([k, iso]) => Math.abs(Astro.sunAtLongitude(k, Date.parse('2026-01-01T00:00:00Z')) - Date.parse(iso)) / 60000);
    ok(ev.every((m) => m < 15), '#136 sunAtLongitude(): the 2026 March and September equinoxes and the December solstice within 15 minutes of the almanac', JSON.stringify(ev));
    // daylight() agrees with riseSet() and with the idea's numbers for Albany
    const A_ = [42.6526, -73.7562, 'America/New_York'];
    let worst = 0;
    for (let k = 0; k < 365; k += 9) {
      const noon = Astro.zonedTime(2026, 1, 1 + k, 12, 0, A_[2]);
      const d = Astro.daylight(noon, A_[0], A_[1]);
      const rs = Astro.riseSet('sun', noon - 432e5, noon + 432e5, A_[0], A_[1]);
      worst = Math.max(worst, Math.abs(d.rise - rs.find((e) => e.rising).t), Math.abs(d.set - rs.find((e) => !e.rising).t));
    }
    const len = (m, d) => Astro.daylight(Astro.zonedTime(2026, m, d, 12, 0, A_[2]), A_[0], A_[1]).minutes;
    const hm = (v) => `${Math.floor(Math.round(v) / 60)} h ${Math.round(v) % 60} min`;
    ok(worst < 5000 && hm(len(11, 14)) === '9 h 48 min' && hm(len(12, 21)) === '9 h 3 min' && hm(len(6, 21)) === '15 h 19 min' && Math.abs(len(11, 14) - len(11, 13) + 2.2) < 0.1,
      '#129 daylight() matches riseSet() (within 5 s) and the idea: Albany 9 h 48 min on Nov 14 (2 min shorter than Nov 13), 9 h 3 min on Dec 21, 15 h 19 min on Jun 21',
      JSON.stringify([worst, hm(len(11, 14)), hm(len(12, 21)), hm(len(6, 21)), len(11, 14) - len(11, 13)]));
    const cp = Astro.closestPlanet(Date.parse('2026-11-14T17:00:00Z'));
    const spinE = Astro.rotationSpeed(0);
    const spinA = Astro.rotationSpeed(42.6526);
    const orbJan = Astro.orbitalSpeed('earth', Date.parse('2027-01-03T12:00:00Z')) * 3600;
    const orbJul = Astro.orbitalSpeed('earth', Date.parse('2027-07-05T12:00:00Z')) * 3600;
    ok(cp.name === 'venus' && Math.abs(cp.dist - 0.33) < 0.01 && Math.abs(cp.dist * Astro.AU_LIGHT_SECONDS - 165) < 3 && Math.abs(spinE - 1674.4) < 0.5 && Math.abs(spinA - 1233) < 3
      && orbJan > orbJul && orbJan > 108500 && orbJan < 109500 && orbJul > 105000 && orbJul < 106000,
    '#99 #137 closestPlanet() on 2026-11-14 is Venus at 0.33 au (light 2 min 45 s); rotationSpeed() 1,674 km/h at the equator and about 1,233 at Albany; orbitalSpeed() fastest in January',
    JSON.stringify([cp, spinE, spinA, orbJan, orbJul]));
    const SD = await import('../../live/sky-data.mjs');
    const named = Object.keys(SD.STAR_NAMES);
    ok(named.length === 23 && named.every((k) => SD.STAR_DIST[k] && SD.STAR_DIST[k][0] > 0 && SD.STAR_DIST[k][0] < SD.STAR_DIST[k][1])
      && Object.keys(SD.CN_STARS).length === 30 && Object.keys(SD.DIPPER_NAMES).every((k) => SD.CN_STARS[k]),
    '#132 #133 every one of the 23 named stars has a sourced distance range; the 23 and the Big Dipper\'s seven have Chinese names or lines', JSON.stringify(named.filter((k) => !SD.STAR_DIST[k])));
  }

  // ---------------- #92 #101 the date and the time in the link, the 2050 cap
  await api.viewport(1280, 900, { dark: true });
  await api.eval(`localStorage.clear()`);
  await api.go('?lang=en#sky/albany/2026-11-14/21:00', 1400);
  const l1 = await api.eval(`({hash: location.hash, at: document.getElementById('skyAt').textContent, date: document.getElementById('skyDate').value, max: document.getElementById('skyDate').max, min: document.getElementById('skyDate').min, city: document.getElementById('skyCity').textContent})`);
  ok(l1.hash === '#sky/albany/2026-11-14/21:00' && /Nov 14 · 9:00\sPM/.test(l1.at) && l1.date === '2026-11-14' && l1.max === '2050-12-31' && l1.min === '1900-01-01' && l1.city === 'Albany, NY',
    '#92 #sky/albany/2026-11-14/21:00 opens Albany at 9:00 PM on 14 November 2026; the date runs from 1900 to 2050', JSON.stringify(l1));
  await api.eval(`(() => { window.__copied = null; const w = (s) => { window.__copied = s; return Promise.resolve(); }; if (navigator.clipboard) navigator.clipboard.writeText = w; else Object.defineProperty(navigator, 'clipboard', { value: { writeText: w } }); })()`);
  await clickOn('#skyCopy');
  await sleep(250);
  const cp1 = await api.eval(`[window.__copied, document.getElementById('skyShareNote').textContent]`);
  ok(/^file:.*index\.html#sky\/albany\/2026-11-14\/21:00$/.test(cp1[0] || '') && !/[?]/.test(cp1[0]) && cp1[1] === 'Link copied. It opens this place, date and time.',
    '#101 "Copy link" copies the page address with the place, the date and the time (and says so)', JSON.stringify(cp1));
  await api.eval(`(() => { window.__blobs = []; const o = URL.createObjectURL.bind(URL); URL.createObjectURL = (b) => { window.__blobs.push(b); return o(b); }; window.__clicks = []; HTMLAnchorElement.prototype.click = function () { window.__clicks.push([this.download, this.href]); }; })()`);
  const reqSave = api.requests.length;
  await clickOn('#skySave');
  await sleep(1200);
  const png = await api.eval(`(async () => { const b = window.__blobs[0]; if (!b) return null; const bm = await createImageBitmap(b); const head = new Uint8Array(await b.slice(0, 8).arrayBuffer()); return {type: b.type, w: bm.width, h: bm.height, sig: [...head.slice(1, 4)].map((c) => String.fromCharCode(c)).join(''), name: window.__clicks[0] && window.__clicks[0][0], href: window.__clicks[0] && window.__clicks[0][1].slice(0, 5), note: document.getElementById('skyShareNote').textContent}; })()`);
  ok(png && png.type === 'image/png' && png.sig === 'PNG' && png.w === 1208 && png.h === 1332 && png.name === 'sky-albany-2026-11-14-2100.png' && png.href === 'blob:'
    && png.note === 'Saved sky-albany-2026-11-14-2100.png.' && api.requests.slice(reqSave).every((u) => /^(data|blob|file):/.test(u)),
  '#101 "Save as image" draws the chart into a PNG in the browser (1208 x 1332, titled, named for the place and time); nothing is uploaded', JSON.stringify(png));
  await api.eval(`(() => { const d = document.getElementById('skyDate'); d.value = '2077-06-01'; d.dispatchEvent(new Event('change', {bubbles: true})); })()`);
  await sleep(500);
  const cap = await api.eval(`[document.getElementById('skyDate').value, document.getElementById('skyDateNote').textContent, document.getElementById('skyAt').textContent, location.hash]`);
  ok(cap[0] === '2050-12-31' && /^Dates run from 1900 to 2050/.test(cap[1]) && /^Dec 31 · 9:00\sPM/.test(cap[2]) && cap[3] === '#sky/albany/2050-12-31/21:00',
    '#92 a date after 2050 comes back to 31 December 2050 (the planet tables end there), says why, and the link follows', JSON.stringify(cap));
  await api.go('?lang=en#sky/tokyo/2000-05-12', 1400);
  const b2 = await api.eval(`({at: document.getElementById('skyAt').textContent, head: document.getElementById('skyTonightHead').textContent, mode: document.querySelector('#skyMode [aria-checked="true"]').dataset.sky, city: document.getElementById('skyCity').textContent, notUp: [...document.querySelectorAll('#skyTonight .sky-pl.off .sky-when-t')].map((e) => e.textContent)})`);
  ok(/^May 12 · \d{1,2}:\d{2}\sPM$/.test(b2.at) && b2.head === 'The night of May 12, 2000' && b2.mode === 'tonight' && b2.city === 'Tokyo' && b2.notUp.every((x) => x === 'Too low or in daylight that night'),
    '#92 a birthday: #sky/tokyo/2000-05-12 shows that night over Tokyo, headed "The night of May 12, 2000", in the past tense', JSON.stringify(b2));
  await api.go('?lang=zh#sky/tokyo/2000-05-12', 1300);
  ok((await text('#skyTonightHead')) === '2000年5月12日那天晚上', '#92 in Chinese: "2000年5月12日那天晚上"');
  await api.go('?lang=en#sky/albany/2077-01-01', 1200);
  ok((await api.eval(`document.querySelector('#skyMode [aria-checked="true"]').dataset.sky`)) === 'now', '#92 a link with a date outside 1900 to 2050 opens the sky now instead');
  await searchSky('osaka');
  await api.key('Enter');
  await sleep(700);
  ok((await api.eval('location.hash')) === '#sky/osaka', '#92 the address bar follows the place shown (#sky/osaka), so it can be copied too');

  // ---------------- #102 a first city from the browser's time zone
  await api.eval(`localStorage.clear()`);
  await api.send('Emulation.setTimezoneOverride', { timezoneId: 'Asia/Shanghai' });
  await api.go('?lang=en#home/sky', 1400);
  const g1 = await api.eval(`({city: document.getElementById('skyCity').textContent, guess: !document.getElementById('skyGuess').hidden, note: document.getElementById('skyGuessNote').textContent, stored: localStorage.getItem('ls7-sky-city')})`);
  await clickOn('#skyAlbany');
  await sleep(500);
  const g2 = await api.eval(`({city: document.getElementById('skyCity').textContent, guess: !document.getElementById('skyGuess').hidden, stored: localStorage.getItem('ls7-sky-city'), focus: document.activeElement.id})`);
  await api.eval(`localStorage.clear()`);
  await api.go('?lang=en#sky', 1300);
  const g3 = await text('#skyCity');
  await api.send('Emulation.setTimezoneOverride', { timezoneId: 'Asia/Calcutta' });
  await api.go('?lang=en#home/sky', 1300);
  const g4 = await text('#skyCity');
  await api.send('Emulation.setTimezoneOverride', { timezoneId: '' });
  ok(g1.city === 'Beijing' && g1.guess && g1.note === 'Picked for your time zone (Shanghai). Search above for another place.' && !g1.stored
    && g2.city === 'Albany, NY' && !g2.guess && g2.stored === 'albany' && g2.focus === 'skyQ' && g3 === 'Albany, NY' && g4 === 'New Delhi',
  '#102 a first visit in the Shanghai time zone opens Beijing (not stored) with "Show Albany instead"; the README\'s #sky link still shows Albany; Kolkata time opens New Delhi', JSON.stringify([g1, g2, g3, g4]));

  // ---------------- #132 #133 #135 what the caption says
  await api.eval(`localStorage.clear()`);
  await api.go('?lang=en#sky/albany/2026-11-14/21:00', 1400);
  const infoOf = async (id) => { await api.eval(`(() => { const g = document.querySelector('#skyChart .sky-body[data-id="${id}"]'); if (g) g.focus(); })()`); await sleep(150); return api.eval(`[document.activeElement.dataset.id || '', document.getElementById('skyInfo').innerText.replace(/\\s+/g, ' ').trim()]`); };
  const tShow = Astro.zonedTime(2026, 11, 14, 21, 0, 'America/New_York');
  const yShow = new Date(tShow).getUTCFullYear() + (tShow - Date.UTC(2026, 0, 1)) / (Date.UTC(2027, 0, 1) - Date.UTC(2026, 0, 1));
  const vega = await infoOf('star:aLyr');
  const betel = await infoOf('star:aOri');
  const polaris = await infoOf('star:aUMi');
  ok(vega[0] === 'star:aLyr' && vega[1].includes(`About 25 light years away. The light you see now left it around ${Math.floor(yShow - 25.045)}.`) && Math.floor(yShow - 25.045) === 2001
    && betel[1].includes(`About 400 to 700 light years away (hard to measure). The light you see now left it between about ${Math.round((yShow - 700) / 10) * 10} and ${Math.round((yShow - 400) / 10) * 10}.`)
    && polaris[1].includes('About 440 light years away. The light you see now left it around 1590.') && !/[一-鿿]/.test(vega[1]),
  '#132 a bright star says how far it is and when its light left: Vega 25 light years, "around 2001"; Betelgeuse a range (400 to 700); Polaris about 440, "around 1590"', JSON.stringify([vega, betel, polaris]));
  const sat = await infoOf('planet:saturn');
  const ringT = Astro.saturnRings(tShow);
  const satScope = await api.eval(`[document.querySelectorAll('#skyInfo .scope-svg .sc-ring').length, !!document.querySelector('#skyInfo .scope-svg circle.sc-planet'), document.querySelector('#skyInfo .scope-svg').getAttribute('aria-hidden')]`);
  ok(sat[1].includes('Telescope view, computed by formula') && sat[1].includes(`Rings tilted ${Math.round(Math.abs(ringT.B))}° toward us; we see their ${ringT.B > 0 ? 'north' : 'south'} side.`)
    && satScope[0] === 2 && satScope[1] && satScope[2] === 'true',
  '#135 Saturn in the telescope: the rings drawn in two halves round the globe, tilted as computed (about 6°, south side on 14 Nov 2026)', JSON.stringify([sat, satScope, ringT.B]));
  await api.go('?lang=en#sky/albany/2026-11-15/05:45', 1400);
  const tDawn = Astro.zonedTime(2026, 11, 15, 5, 45, 'America/New_York');
  const jup = await infoOf('planet:jupiter');
  const moonsJ = Astro.galileanMoons(tDawn);
  const names = ['Io', 'Europa', 'Ganymede', 'Callisto'];
  const orderJ = moonsJ.map((m, i) => ({ x: m.x, l: Math.abs(m.x) < 1 ? `${names[i]} (${m.front ? 'in front of' : 'behind'} Jupiter)` : names[i] })).concat([{ x: 0, l: 'Jupiter' }]).sort((a, b) => a.x - b.x).map((o) => o.l).join(', ');
  const jLabels = await api.eval(`[...document.querySelectorAll('#skyInfo .sc-label')].map((e) => e.textContent).sort().join(',')`);
  const ven = await infoOf('planet:venus');
  const gv = Astro.geocentric('venus', tDawn);
  const dv = Astro.apparentDiameter('venus', tDawn);
  ok(jup[1].includes(`East to west: ${orderJ}.`) && jLabels === moonsJ.filter((m) => !(Math.abs(m.x) < 1 && !m.front)).map((m) => names[moonsJ.indexOf(m)]).sort().join(',')
    && ven[1].includes(`${Math.round(gv.illum * 100)}% lit, ${dv.toFixed(dv < 10 ? 1 : 0)}″ across.`),
  '#135 Jupiter\'s four moons in the order the formulae give (each named), and Venus as a crescent with its size in arcseconds', JSON.stringify([jup, jLabels, ven]));
  await api.go('?lang=zh#sky/albany/2026-11-14/21:00', 1400);
  const altair = await infoOf('star:aAql');
  const vegaZh = await infoOf('star:aLyr');
  const dubhe = await infoOf('star:aUMa');
  ok(altair[1].includes('传统星名河鼓二。俗称牛郎星，和银河对岸的织女星隔河相望。') && vegaZh[1].includes('传统星名织女一。') && vegaZh[1].includes('你现在看到的这束光，大约在 2001 年出发。')
    && dubhe[0] === 'star:aUMa' && dubhe[1].startsWith('天枢') && dubhe[1].includes('北斗第一星'),
  '#133 in Chinese, a bright star adds its traditional name and one line: 河鼓二 (the Cowherd), 织女一; the Big Dipper\'s stars by their old names (天枢)', JSON.stringify([altair, vegaZh, dubhe]));

  // ---------------- #131 #139 star trails and the expert switches
  await api.go('?lang=en#sky/albany/2026-11-14/21:00', 1400);
  const starCount = () => api.eval(`document.querySelectorAll('#skyChart .sky-stars circle').length`);
  const dark0 = await starCount();
  await clickOn('#skyTrails');
  await sleep(300);
  const tr1 = await api.eval(`[document.querySelectorAll('#skyChart .sky-trails path').length, document.getElementById('skyTrails').getAttribute('aria-pressed')]`);
  await clickOn('#skyTrails');
  await sleep(200);
  ok(tr1[0] > 30 && tr1[1] === 'true' && (await api.eval(`document.querySelectorAll('#skyChart .sky-trails').length`)) === 0,
    '#131 "Star trails" draws the last three hours of the brighter stars as arcs, and goes away again', JSON.stringify(tr1));
  const more0 = await api.eval(`[document.getElementById('skyMoreBtn').getAttribute('aria-expanded'), document.getElementById('skyMore').hidden]`);
  await clickOn('#skyMoreBtn');
  await sleep(200);
  const more1 = await api.eval(`[document.getElementById('skyMoreBtn').getAttribute('aria-expanded'), document.getElementById('skyMore').hidden]`);
  await clickOn('#skyGrid');
  await sleep(250);
  const grid = await api.eval(`[document.querySelectorAll('#skyChart .sky-grid circle').length, document.querySelectorAll('#skyChart .sky-grid line').length, document.querySelectorAll('#skyChart .sky-grid-labels text').length]`);
  await api.eval(`document.querySelector('#skyFace [aria-checked="true"]').focus()`);
  await api.key('ArrowLeft');
  await sleep(300);
  const face = await api.eval(`(() => { const svg = document.querySelector('#skyChart svg'); const c = svg.viewBox.baseVal.width / 2; const at = (t) => { const e = [...svg.querySelectorAll('.sky-cardinal')].find((x) => x.textContent === t); return [+e.getAttribute('x') - c, +e.getAttribute('y') - c]; }; return {checked: document.querySelector('#skyFace [aria-checked="true"]').dataset.face, focus: document.activeElement.dataset.face, E: at('E'), N: at('N')}; })()`);
  await clickOn('#skyBright [data-bright="city"]');
  await sleep(300);
  const city = await api.eval(`({n: document.querySelectorAll('#skyChart .sky-stars circle').length, milky: document.querySelectorAll('#skyChart .sky-milkyway').length, note: document.getElementById('skyBrightNote').textContent, megrez: !!document.querySelector('#skyChart [data-id="star:dUMa"]'),
    up: (() => { const c = SkyData.CITIES.find((r) => r[0] === 'albany'); const sc = Astro.skyScene(Astro.zonedTime(2026, 11, 14, 21, 0, 'America/New_York'), c[3], c[4], SkyData.SKY_DATA); const n = (m) => sc.stars.filter((x) => x.alt > 0 && x.mag <= m).length; return [n(2), n(3)]; })()})`);
  const cityN = Number((city.note.match(/^(\d+) stars/) || [])[1]);
  ok(more0[0] === 'false' && more0[1] && more1[0] === 'true' && !more1[1] && grid[0] === 5 && grid[1] === 12 && grid[2] > 8
    && face.checked === '90' && face.focus === '90' && face.E[1] > 100 && face.N[0] < -100
    && city.n < dark0 && city.n === cityN && city.n === city.up[1] && city.up[1] > city.up[0] && city.milky === 0 && !city.megrez && /a truly dark sky shows a few thousand\.$/.test(city.note),
  `#139 "More options" opens three expert switches: an altitude and azimuth grid; facing east puts east at the bottom (arrow keys choose); a city sky keeps the stars of magnitude 3 and brighter (${city.up[1]} up that night, not the ${city.up[0]} of magnitude 2 it used to keep) and loses the Milky Way`,
  JSON.stringify([more0, more1, grid, face, city, dark0]));

  // ---------------- #129 #136 daylight through the year, the next equinox or solstice
  const day = await api.eval(`({txt: [...document.querySelectorAll('#skyDay p')].map((p) => p.textContent), pts: (document.querySelector('#skyDay .dc-line').getAttribute('d').match(/[ML]/g) || []).length, aria: document.querySelector('#skyDay .day-curve').getAttribute('aria-label'), mark: +document.querySelector('#skyDay .dc-mark').getAttribute('x1')})`);
  const seasonFor = (tz, south, t) => {
    const s = Astro.seasons(t);
    const dn = (ms) => { const p = Astro.zonedParts(ms, tz); return Date.UTC(p.year, p.month - 1, p.day) / 864e5; };
    const names = south ? ['Autumn equinox', 'Winter solstice', 'Spring equinox', 'Summer solstice'] : ['Spring equinox', 'Summer solstice', 'Autumn equinox', 'Winter solstice'];
    const n = dn(s.next.t) - dn(t);
    const date = new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short', day: 'numeric' }).format(new Date(s.next.t));
    return `${names[s.next.k / 90]} in ${n} days · ${date}${south ? ' (southern hemisphere)' : ''}`;
  };
  ok(day.txt[0] === 'Nov 14: 9 h 48 min of daylight' && /^2 min 1\d s shorter than (yesterday|the day before)$/.test(day.txt[1])
    && day.txt[2] === 'Shortest: Dec 21 (9 h 3 min) · Longest: Jun 21, 2027 (15 h 19 min)' && day.txt[3] === 'Winter solstice in 37 days · Dec 21'
    && day.txt[3] === seasonFor('America/New_York', false, tShow) && day.pts === 365 && Math.abs(day.mark - (30 + (317 / 364) * 322)) < 0.2 && /2026 in Albany, NY, with Nov 14 marked/.test(day.aria),
  '#129 #136 Albany on 14 Nov 2026: 9 h 48 min of daylight, about 2 minutes shorter than the day before, shortest Dec 21 (9 h 3 min), longest Jun 21 (15 h 19 min); the winter solstice in 37 days',
  JSON.stringify(day));
  await api.go('?lang=en#sky/sydney/2026-11-14/21:00', 1300);
  const tSyd = Astro.zonedTime(2026, 11, 14, 21, 0, 'Australia/Sydney');
  const sydS = await text('#skyDay .sky-season');
  await api.go('?lang=en#sky/tromso/2026-11-14/21:00', 1300);
  const troDay = await api.eval(`[...document.querySelectorAll('#skyDay p')].map((p) => p.textContent)`);
  let polarDay = null;
  for (let k = 0; k < 60 && polarDay == null; k++) if (Astro.daylight(Astro.zonedTime(2026, 11, 14 + k, 12, 0, 'Europe/Oslo'), 69.6492, 18.9553).minutes === 0) polarDay = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(new Date(Date.UTC(2026, 10, 14 + k)));
  ok(sydS === seasonFor('Australia/Sydney', true, tSyd) && /^Summer solstice in \d+ days · Dec 2[12] \(southern hemisphere\)$/.test(sydS)
    && troDay.some((t) => t.includes(`No sunrise from ${polarDay}`)),
  '#136 #129 seasons follow the hemisphere (Sydney: the summer solstice) and the polar night shows (Tromsø: no sunrise from late November)', JSON.stringify([sydS, troDay, polarDay]));
  await api.go('?lang=en&open=nc', 1000);
  const ncS = await api.eval(`[document.getElementById('ncSeason').hidden, document.getElementById('ncSeason').textContent, document.getElementById('ncSummary').textContent.length > 20]`);
  const ncWant = (() => { const s = Astro.seasons(Date.now()); const dn = (ms) => { const p = Astro.zonedParts(ms, 'America/New_York'); return Date.UTC(p.year, p.month - 1, p.day) / 864e5; }; return dn(s.next.t) - dn(Date.now()); })();
  await api.go('?lang=zh&open=nc', 1000);
  const ncZh = await api.eval(`[document.getElementById('ncSeason').hidden, document.getElementById('ncSeason').innerText]`);
  ok(!ncS[0] && (ncS[1].includes(`in ${ncWant} days · `) || (ncWant === 1 && ncS[1].includes('tomorrow')) || ncWant === 0) && ncS[2] && !ncZh[0] && /^农历/.test(ncZh[1]) && ncZh[1].includes('下一个节气'),
    '#136 the English Today panel says how many days to the next equinox or solstice in Albany, with a thin ring for the year (the Chinese page shows the solar terms there instead, #95)', JSON.stringify([ncS, ncWant, ncZh]));

  // ---------------- #144 #140 #99 #137 where the planets are tonight, Earth's daily fact
  await api.eval(`localStorage.clear()`);
  await api.go('?lang=en', 1100);
  const nAlb = Astro.tonight(Date.now(), 42.6526, -73.7562, 'America/New_York');
  const satT = nAlb.planets.find((p) => p.name === 'saturn');
  const tAlb = (ms) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }).format(new Date(ms));
  const dirs = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
  await api.eval(`document.querySelector('.pl-btn[data-planet="saturn"]').focus()`);
  await sleep(250);
  const satCard = await api.eval(`document.querySelector('#plCard .pc-sky') && document.querySelector('#plCard .pc-sky').textContent`);
  ok(!!satCard && satCard.startsWith('Tonight in Albany: ') && (satT.visible ? satCard.includes(tAlb(satT.best)) && satCard.includes(`in the ${dirs[Math.round(((satT.bestAz % 360) + 360) % 360 / 45) % 8]}`) : true),
    '#144 a planet\'s name card says where it is tonight in Albany (time and direction from tonight()), e.g. Saturn', JSON.stringify([satCard, satT.best && tAlb(satT.best), satT.bestAz]));
  await api.eval(`document.querySelector('.pl-btn[data-planet="earth"]').focus()`);
  await sleep(250);
  const fact = await text('#plCard .pc-fact');
  const pA = Astro.zonedParts(Date.now(), 'America/New_York');
  const even = (Date.UTC(pA.year, pA.month - 1, pA.day) / 864e5) % 2 === 0;
  const cpn = Astro.closestPlanet(Date.now());
  const lt = Math.round(cpn.dist * Astro.AU_LIGHT_SECONDS);
  const nm = { mercury: 'Mercury', venus: 'Venus', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune' };
  const factWant = even ? `Closest planet today: ${nm[cpn.name]}, ${cpn.dist.toFixed(2)} au away; its light takes about ${lt >= 60 ? `${Math.floor(lt / 60)} min ${lt % 60} s` : `${lt} s`} to reach us.`
    : `At Albany's latitude Earth's turning carries you east at about 1,230 km/h (770 mph); around the Sun, Earth moves at about ${(Math.round(Astro.orbitalSpeed('earth', Date.now()) * 36) * 100).toLocaleString('en-US')} km/h today.`;
  ok(fact === factWant, `#99 #137 Earth's card says one thing a day, in turn: today (${even ? 'even' : 'odd'} day) ${even ? 'the planet nearest Earth' : 'how fast Earth carries you'}`, JSON.stringify([fact, factWant]));
  await api.eval(`document.activeElement.blur()`);
  await api.key('k', { meta: true });
  await sleep(350);
  await api.type('saturn');
  await sleep(250);
  const sp1 = await api.eval(`({head: document.querySelector('#spotList .sp-head').textContent, first: document.querySelector('#spotList .sp-row.first').dataset.body, t: document.querySelector('#spotList .sp-row.first .sp-t').textContent, s: document.querySelector('#spotList .sp-row.first .sp-s').textContent})`);
  await api.key('Enter');
  await sleep(1200);
  const sp2 = await api.eval(`({app: document.getElementById('appView').dataset.app, focus: document.activeElement.dataset.id || document.activeElement.id, info: document.getElementById('skyInfo').innerText})`);
  ok(sp1.head === 'In the sky tonight' && sp1.first === 'saturn' && sp1.t === 'Saturn' && sp1.s === satCard && sp2.app === 'sky' && (!satT.visible || (sp2.focus === 'planet:saturn' && sp2.info.startsWith('Saturn'))),
    '#140 typing "saturn" in Search: the first result says where Saturn is tonight (the same words as its card); Enter opens the Sky with Saturn selected', JSON.stringify([sp1, sp2]));
  await api.go('?lang=zh', 1000);
  await api.eval(`document.activeElement.blur()`);
  await api.key('k', { meta: true });
  await sleep(350);
  await api.eval(`(() => { const i = document.getElementById('spotInput'); i.value = '月亮'; i.dispatchEvent(new Event('input')); })()`);
  await sleep(250);
  const sp3 = await api.eval(`({first: (document.querySelector('#spotList .sp-row.first') || {dataset: {}}).dataset.body, s: (document.querySelector('#spotList .sp-row.first .sp-s') || {}).textContent})`);
  ok(sp3.first === 'moon' && /^今晚在奥尔巴尼：/.test(sp3.s || ''), '#140 in Chinese too: "月亮" finds the Moon with tonight\'s rise and set in Albany', JSON.stringify(sp3));
  await api.key('Escape');
  await sleep(300);

  // ---------------- #98 the Clock app's true scale
  await api.go('?lang=en#home/clock', 1300);
  const rx = () => api.eval(`[...document.querySelectorAll('#appBody .orbit-svg .rings path')].map((p) => +p.getAttribute('d').match(/A([\\d.]+),/)[1])`);
  const rx0 = await rx();
  await clickOn('#clkTrue');
  await sleep(2600);
  const rx1 = await rx();
  const tNow = Date.now();
  const rN = Astro.heliocentric('neptune', tNow).r;
  const wantRx = Astro.PLANETS.map((p) => (212 * Astro.heliocentric(p, tNow).r) / rN);
  const th1 = await thetas('#appBody');
  const lonNow = Astro.planetLongitudes(tNow);
  const ts = await api.eval(`({on: document.getElementById('clkTrue').getAttribute('aria-pressed'), cls: document.querySelector('.bigclock').classList.contains('true'), note: document.getElementById('clkTrueNote').textContent, inset: !document.getElementById('clkInset').hidden, dots: document.querySelectorAll('#clkInset circle').length, cap: document.querySelector('#clkInset .inset-cap').textContent, av: getComputedStyle(document.querySelector('#appBody .av-img')).transform, moon: getComputedStyle(document.querySelector('#appBody .orbit-svg .moon')).opacity})`);
  const nepLight = Math.round((rN * Astro.AU_LIGHT_SECONDS) / 60);
  await sleep(1000);
  const th2 = await thetas('#appBody');
  ok(rx0.join(',') === '52,72,93,114,138,162,187,212' && rx1.every((v, i) => Math.abs(v - wantRx[i]) < 0.3) && th1.every((th, i) => angErr(th, lonNow[i]) < 1) && th2.every((th, i) => angErr(th, th1[i]) < 0.05)
    && ts.on === 'true' && ts.cls && ts.note === `Rings at today's real distances from the Sun. Light takes ${Math.floor(nepLight / 60)} h ${nepLight % 60} min to reach Neptune and ${(() => { const s = Math.round(Astro.heliocentric('earth', tNow).r * Astro.AU_LIGHT_SECONDS); return `${Math.floor(s / 60)} min ${s % 60} s`; })()} to reach Earth.`
    && ts.inset && ts.dots === 5 && /^Mercury to Mars, drawn \d+× larger$/.test(ts.cap) && /matrix\(0\.07/.test(ts.av) && ts.moon === '0',
  '#98 "True scale" in the Clock: the rings take today\'s real distances (Neptune stays, Mercury shrinks to ~3), the planets stop where they really are, the avatar becomes a small Sun, light needs about 4 hours to Neptune, and Mercury to Mars are shown close up',
  JSON.stringify({ rx1: rx1.map((v) => +v.toFixed(2)), want: wantRx.map((v) => +v.toFixed(2)), ts, th1: th1.map((v, i) => angErr(v, lonNow[i])) }));
  await clickOn('#clkTrue');
  await sleep(2600);
  const rx2 = await rx();
  const back = await api.eval(`[document.getElementById('clkTrue').getAttribute('aria-pressed'), document.getElementById('clkTrueNote').textContent, document.getElementById('clkInset').hidden]`);
  ok(rx2.every((v, i) => Math.abs(v - rx0[i]) < 0.01) && back[0] === 'false' && back[1] === 'The rings are evenly spaced so all eight planets fit.' && back[2],
    '#98 switching it off brings back the evenly spaced rings', JSON.stringify([rx2, back]));
  await api.go('?lang=en&motion=reduce#home/clock', 1200);
  await clickOn('#clkTrue');
  await sleep(150);
  const rxR = await rx();
  ok(rxR.every((v, i) => Math.abs(v - wantRx[i]) < 0.3), '#98 under reduced motion the true scale is applied at once, without the glide', JSON.stringify(rxR));

  // ---------------- contrast of the new words, both modes
  for (const mode of ['dark', 'light']) {
    const c = {};
    await api.viewport(1440, 900, { dark: true });
    await api.eval(`localStorage.clear()`);
    await api.go(`?lang=en&appearance=${mode}`, 900);
    await api.eval(`document.querySelector('.pl-btn[data-planet="saturn"]').focus()`);
    await sleep(250);
    c['.pc-sky'] = (await contrastOf(api, '.pc-sky') || {}).p05;
    await api.eval(`document.querySelector('.pl-btn[data-planet="earth"]').focus()`);
    await sleep(250);
    c['.pc-fact'] = (await contrastOf(api, '.pc-fact') || {}).p05;
    await api.go(`?lang=en&appearance=${mode}&open=nc`, 900);
    c['.nc-season span'] = (await contrastOf(api, '.nc-season span') || {}).p05;
    await api.go(`?lang=en&appearance=${mode}#sky/albany/2026-11-14/21:00`, 1300);
    await api.eval(`document.querySelector('#skyChart .sky-body[data-id="planet:saturn"]').focus()`);
    await sleep(200);
    await api.eval(`document.getElementById('skyInfo').scrollIntoView({block: 'center'})`);
    for (const sel of ['.sc-txt span', '.si-main']) c[sel] = (await contrastOf(api, sel) || {}).p05;
    await api.eval(`document.querySelector('#skyChart .sky-body[data-id="star:aLyr"]').focus()`);
    await sleep(200);
    await api.eval(`document.getElementById('skyInfo').scrollIntoView({block: 'center'})`);
    c['.si-dist'] = (await contrastOf(api, '.si-dist') || {}).p05;
    await api.eval(`document.getElementById('skyMoreBtn').click()`);
    await sleep(150);
    for (const sel of ['.sky-day-sub', '.sky-season span', '#skyBrightNote']) {
      await api.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (e) e.scrollIntoView({block: 'center'}); })()`);
      c[sel] = (await contrastOf(api, sel) || {}).p05;
    }
    await api.go(`?lang=en&appearance=${mode}&motion=reduce#home/clock`, 1100);
    await api.eval(`document.getElementById('clkTrue').click()`);
    await sleep(200);
    for (const sel of ['.clk-note', '.inset-cap']) {
      await api.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (e) e.scrollIntoView({block: 'center'}); })()`);
      c[sel] = (await contrastOf(api, sel) || {}).p05;
    }
    console.log('     contrast R3.3', mode, JSON.stringify(c));
    ok(Object.values(c).every((v) => v >= 4.5), `contrast of the R3.3 Sky pieces on the ${mode} page (planet cards, Today, the caption, telescope view, daylight, Clock) >= 4.5:1`, JSON.stringify(c));
  }
  // every new word, in both languages: no em or en dash, nothing in English left on the Chinese page
  const words = [];
  for (const [q, act] of [['?lang=en#sky/albany/2026-11-14/21:00', 'star:aOri'], ['?lang=zh#sky/albany/2026-11-14/21:00', 'star:aOri'], ['?lang=zh#sky/albany/2026-11-15/05:45', 'planet:jupiter'], ['?lang=zh#sky/sydney/2026-11-14/21:00', 'planet:saturn']]) {
    await api.go(q, 1200);
    await api.eval(`(() => { document.getElementById('skyMoreBtn').click(); const g = document.querySelector('#skyChart .sky-body[data-id="${act}"]'); if (g) g.focus(); })()`);
    await sleep(200);
    words.push(await api.eval(`document.getElementById('appBody').innerText + ' ' + [...document.querySelectorAll('#appBody [aria-label]')].map((e) => e.getAttribute('aria-label')).join(' ')`));
  }
  await api.go('?lang=zh&motion=reduce#home/clock', 1000);
  await api.eval(`document.getElementById('clkTrue').click()`);
  await sleep(300);
  words.push(await api.eval(`[...document.querySelectorAll('.clk-scale, #ncSeason')].map((e) => e.innerText).join(' ')`));
  // on the Chinese pages the only Latin letters left are time-zone abbreviations (EST, GMT+11), N/S/E/W in
  // coordinates and ".ics", the calendar file's extension (#141)
  const latin = (words.slice(1).join('\n').match(/[A-Za-z]{3,}/g) || []).filter((w) => !/^(EST|EDT|GMT|AEDT|AEST|ics)$/.test(w));
  ok(!/[–—]/.test(words.join('\n')) && latin.length === 0, 'the R3.3 Sky words: no em or en dash in either language, and no English left on the Chinese pages', JSON.stringify(latin.slice(0, 8)));
  }

  {
  console.log('---- part 5: R3.3 batch 1b (calendar and time: ideas #93 to #150)');
  const Hol = await import('../../live/holidays.mjs');
  const SDb = await import('../../live/sky-data.mjs');
  const repo = fileURLToPath(new URL('../..', import.meta.url));
  const albISO = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
  const dayGap = (a, b) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 864e5);
  // ---------------- in Node: the computations against published values
  {
    // Hong Kong Observatory, Gregorian-Lunar calendar conversion tables
    // (www.hko.gov.hk/en/gts/time/calendar/text/files/T<year>e.txt, read 2026-11-14), Hong Kong
    // (= Beijing) time: the date of every solar term, from the 285° term (小寒) on.
    const HKO_TERMS = {
      2024: '0106 0120 0204 0219 0305 0320 0404 0419 0505 0520 0605 0621 0706 0722 0807 0822 0907 0922 1008 1023 1107 1122 1206 1221',
      2025: '0105 0120 0203 0218 0305 0320 0404 0420 0505 0521 0605 0621 0707 0722 0807 0823 0907 0923 1008 1023 1107 1122 1207 1221',
      2026: '0105 0120 0204 0218 0305 0320 0405 0420 0505 0521 0605 0621 0707 0723 0807 0823 0907 0923 1008 1023 1107 1122 1207 1222',
      2027: '0105 0120 0204 0219 0306 0321 0405 0420 0506 0521 0606 0621 0707 0723 0808 0823 0908 0923 1008 1023 1107 1122 1207 1222',
      2028: '0106 0120 0204 0219 0305 0320 0404 0419 0505 0520 0605 0621 0706 0722 0807 0822 0907 0922 1008 1023 1107 1122 1206 1221',
      2029: '0105 0120 0203 0218 0305 0320 0404 0420 0505 0521 0605 0621 0707 0722 0807 0823 0907 0923 1008 1023 1107 1122 1207 1221',
      2030: '0105 0120 0204 0218 0305 0320 0405 0420 0505 0521 0605 0621 0707 0723 0807 0823 0907 0923 1008 1023 1107 1122 1207 1222',
      2031: '0105 0120 0204 0219 0306 0321 0405 0420 0506 0521 0606 0621 0707 0723 0808 0823 0908 0923 1008 1023 1107 1122 1207 1222',
      2032: '0106 0120 0204 0219 0305 0320 0404 0419 0505 0520 0605 0621 0706 0722 0807 0822 0907 0922 1008 1023 1107 1122 1206 1221',
      2033: '0105 0120 0203 0218 0305 0320 0404 0420 0505 0521 0605 0621 0707 0722 0807 0823 0907 0923 1008 1023 1107 1122 1207 1221',
      2034: '0105 0120 0204 0218 0305 0320 0405 0420 0505 0521 0605 0621 0707 0723 0807 0823 0907 0923 1008 1023 1107 1122 1207 1222',
      2035: '0105 0120 0204 0219 0306 0321 0405 0420 0505 0521 0606 0621 0707 0723 0807 0823 0908 0923 1008 1023 1107 1122 1207 1222',
    };
    // the same tables: the first day of every lunar month (a number repeated, "L", is the leap month)
    const HKO_MONTHS = {
      2024: '0111:12 0210:1 0310:2 0409:3 0508:4 0606:5 0706:6 0804:7 0903:8 1003:9 1101:10 1201:11 1231:12',
      2025: '0129:1 0228:2 0329:3 0428:4 0527:5 0625:6 0725:6L 0823:7 0922:8 1021:9 1120:10 1220:11',
      2026: '0119:12 0217:1 0319:2 0417:3 0517:4 0615:5 0714:6 0813:7 0911:8 1010:9 1109:10 1209:11',
      2027: '0108:12 0206:1 0308:2 0407:3 0506:4 0605:5 0704:6 0802:7 0901:8 0930:9 1029:10 1128:11 1228:12',
      2028: '0126:1 0225:2 0326:3 0425:4 0524:5 0623:5L 0722:6 0820:7 0919:8 1018:9 1116:10 1216:11',
      2029: '0115:12 0213:1 0315:2 0414:3 0513:4 0612:5 0711:6 0810:7 0908:8 1008:9 1106:10 1205:11',
      2030: '0104:12 0203:1 0304:2 0403:3 0502:4 0601:5 0701:6 0730:7 0829:8 0927:9 1027:10 1125:11 1225:12',
      2031: '0123:1 0221:2 0323:3 0422:3L 0521:4 0620:5 0719:6 0818:7 0917:8 1016:9 1115:10 1214:11',
      2032: '0113:12 0211:1 0312:2 0410:3 0509:4 0608:5 0707:6 0806:7 0905:8 1004:9 1103:10 1203:11',
      2033: '0101:12 0131:1 0301:2 0331:3 0429:4 0528:5 0627:6 0726:7 0825:8 0923:9 1023:10 1122:11 1222:11L',
      2034: '0120:12 0219:1 0320:2 0419:3 0518:4 0616:5 0716:6 0814:7 0913:8 1012:9 1111:10 1211:11',
      2035: '0109:12 0208:1 0310:2 0408:3 0508:4 0606:5 0705:6 0804:7 0902:8 1001:9 1031:10 1130:11 1229:12',
    };
    let termBad = [];
    for (const [y, list] of Object.entries(HKO_TERMS)) {
      const got = Astro.solarTerms(Date.UTC(+y, 0, 1) - 8 * 36e5, Date.UTC(+y + 1, 0, 1) - 8 * 36e5).map((x) => new Date(x.t + 8 * 36e5).toISOString().slice(5, 10).replace('-', ''));
      if (got.join(' ') !== list) termBad.push(y);
    }
    // HKO, "24 Solar Terms" for 2026 (www.hko.gov.hk/tc/gts/astron2026/files/2026SolarTerms24.pdf): the major terms, Hong Kong time
    const y26 = Astro.solarTerms(Date.UTC(2026, 0, 1) - 8 * 36e5, Date.UTC(2027, 0, 1) - 8 * 36e5);
    const termMin = [[300, '01-20T09:45'], [330, '02-18T23:52'], [0, '03-20T22:46'], [30, '04-20T09:39'], [60, '05-21T08:37'], [90, '06-21T16:25'],
      [120, '07-23T03:13'], [150, '08-23T10:19'], [180, '09-23T08:05'], [210, '10-23T17:38'], [240, '11-22T15:23'], [270, '12-22T04:50']]
      .map(([lon, s]) => (y26.find((x) => x.lon === lon).t - (Date.parse(`2026-${s}:00Z`) - 8 * 36e5)) / 6e4);
    ok(!termBad.length && termMin.every((m) => Math.abs(m) <= 1),
      '#95 solarTerms(): all 288 solar terms from 2024 to 2035 fall on the Hong Kong Observatory\'s dates, and the 12 major terms of 2026 within a minute of its times', JSON.stringify([termBad, termMin.map((m) => +m.toFixed(2))]));
    const starts = [];
    for (const [y, list] of Object.entries(HKO_MONTHS)) for (const s of list.split(' ')) { const [md, mo] = s.split(':'); starts.push({ t: Date.UTC(+y, +md.slice(0, 2) - 1, +md.slice(2)), m: parseInt(mo, 10), leap: mo.endsWith('L') }); }
    let days = 0;
    let raw = 0;
    const lunarBad = [];
    const key = (v) => `${v.m}${v.leap ? 'L' : ''}/${v.d}`;
    for (let t = starts[0].t, k = 0; t < Date.UTC(2036, 0, 1); t += 864e5) {
      while (k + 1 < starts.length && starts[k + 1].t <= t) k++;
      const want = key({ ...starts[k], d: (t - starts[k].t) / 864e5 + 1 });
      const d = new Date(t);
      const args = [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
      days++;
      if (key(Astro.chineseDate(...args, Hol)) !== want) lunarBad.push(d.toISOString().slice(0, 10));
      if (key(Astro.chineseDate(...args)) !== want) raw++;
    }
    ok(days === 4373 && !lunarBad.length,
      `#95 chineseDate(): all 4,373 days from 2024-01-11 to 2035-12-31 match the Hong Kong Observatory's lunar calendar (ICU alone is off on ${raw}, the first months of 2027 and 2030, mended with live/holidays.mjs)`, JSON.stringify([days, lunarBad.slice(0, 5), raw]));
    // US Naval Observatory, aa.usno.navy.mil/api/moon/phases/year?year=2026 and 2027 (q, then YYYYMMDDHHMM UT)
    const USNO_PHASES = [
      '2202601031003 3202601101548 0202601181952 1202601260447 2202602012209 3202602091243 0202602171201 1202602241227 2202603031138 3202603110938',
      '0202603190123 1202603251918 2202604020212 3202604100451 0202604171152 1202604240232 2202605011723 3202605092110 0202605162001 1202605231111',
      '2202605310845 3202606081000 0202606150254 1202606212155 2202606292356 3202607071929 0202607140943 1202607211105 2202607291436 3202608060221',
      '0202608121737 1202608200246 2202608280418 3202609040751 0202609110327 1202609182044 2202609261649 3202610031325 0202610101550 1202610181612',
      '2202610260412 3202611012028 0202611090702 1202611171148 2202611241453 3202612010608 0202612090052 1202612170542 2202612240128 3202612301859',
      '0202701072024 1202701152034 2202701221217 3202701291055 0202702061556 1202702140758 2202702202323 3202702280516 0202703080929 1202703151625',
      '2202703221044 3202703300054 0202704062351 1202704132256 2202704202227 3202704282018 0202705061058 1202705130444 2202705201059 3202705281358',
      '0202706041940 1202706111056 2202706190044 3202706270454 0202707040302 1202707101839 2202707181545 3202707261655 0202708021005 1202708090454',
      '2202708170729 3202708250227 0202708311741 1202709071831 2202709152303 3202709231020 0202709300236 1202710071147 2202710151347 3202710221729',
      '0202710291336 1202711060800 2202711140326 3202711210048 0202711280324 1202712060522 2202712131609 3202712200911 0202712272012',
    ].join(' ').split(' ');
    const ph = Astro.moonPhases(Date.UTC(2025, 11, 25), Date.UTC(2028, 0, 5));
    let phWorst = 0;
    let phMiss = 0;
    for (const s of USNO_PHASES) {
      const ref = Date.UTC(+s.slice(1, 5), +s.slice(5, 7) - 1, +s.slice(7, 9), +s.slice(9, 11), +s.slice(11, 13));
      const g = ph.find((p) => p.q === +s[0] && Math.abs(p.t - ref) < 36e5);
      if (!g) phMiss++; else phWorst = Math.max(phWorst, Math.abs(g.t - ref) / 6e4);
    }
    // USNO, aa.usno.navy.mil/api/seasons?year=2026 and 2027
    const USNO_SEASONS = ['2026-03-20T14:46', '2026-06-21T08:24', '2026-09-23T00:05', '2026-12-21T20:50', '2027-03-20T20:25', '2027-06-21T14:11', '2027-09-23T06:02', '2027-12-22T02:42'];
    const ss = Astro.solarTerms(Date.UTC(2026, 0, 1), Date.UTC(2028, 0, 1)).filter((x) => x.i % 6 === 0);
    const ssErr = USNO_SEASONS.map((iso, k) => +(Math.abs(ss[k].t - Date.parse(`${iso}:00Z`)) / 6e4).toFixed(2));
    ok(USNO_PHASES.length === 99 && !phMiss && phWorst < 1 && ss.length === 8 && ssErr.every((m) => m < 1),
      '#127 #141 moonPhases() matches all 99 new, quarter and full Moons the US Naval Observatory lists for 2026 and 2027 within a minute, and the equinoxes and solstices within a minute too',
      JSON.stringify([phMiss, +phWorst.toFixed(2), ssErr]));
    // International Meteor Organization, Meteor Shower Calendars 2026 and 2027 (IMO INFO(3-25) and (3-26)), Table 5 maxima
    const IMO = { 2026: 'QUA 01-03 LYR 04-22 ETA 05-06 PER 08-13 ORI 10-21 LEO 11-17 GEM 12-14 URS 12-22', 2027: 'QUA 01-04 LYR 04-23 ETA 05-06 PER 08-13 ORI 10-22 LEO 11-18 GEM 12-14 URS 12-23' };
    const peaks = Object.fromEntries(Object.keys(IMO).map((y) => [y, SDb.METEOR_SHOWERS.map((sh) => `${sh.id} ${new Date(Astro.showerPeak(sh, +y)).toISOString().slice(5, 10)}`).join(' ')]));
    const leoR = Astro.showerRadiant(SDb.METEOR_SHOWERS.find((s) => s.id === 'LEO'), Date.UTC(2026, 10, 17));
    ok(peaks[2026] === IMO[2026] && peaks[2027] === IMO[2027] && Math.abs(leoR.ra - 152) < 0.7 && Math.abs(leoR.dec - 22) < 0.5
      && Astro.showerActive(SDb.METEOR_SHOWERS[0], Date.UTC(2026, 11, 30)) && Astro.showerActive(SDb.METEOR_SHOWERS[0], Date.UTC(2027, 0, 12)) && !Astro.showerActive(SDb.METEOR_SHOWERS[0], Date.UTC(2027, 0, 14)),
    '#93 the eight showers\' maxima, from their solar longitudes, are the IMO calendar\'s dates for 2026 and 2027; radiants and activity periods follow its tables (the Quadrantids across New Year)', JSON.stringify([peaks, leoR]));
    // NASA's eclipse catalogues (eclipse.gsfc.nasa.gov): each eclipse sits on its new or full Moon, and its type fits its magnitude
    const ecl = SDb.SOLAR_ECLIPSES.map((e) => {
      const t = Date.parse(`${e[0]}T${e[1]}Z`);
      const nm = Astro.moonPhases(t - 2 * 864e5, t + 2 * 864e5).find((p) => p.q === 0);
      return nm && Math.abs(nm.t - t) < 30 * 6e4 && (e[2] === 'partial' ? !e[5] : (e[3] > 1) === (e[2] !== 'annular') && !!e[5]);
    }).concat(SDb.LUNAR_ECLIPSES.map((e) => {
      const x = Astro.lunarEclipseTimes(e);
      const fm = Astro.moonPhases(x.max - 2 * 864e5, x.max + 2 * 864e5).find((p) => p.q === 2);
      return fm && Math.abs(fm.t - x.max) < 30 * 6e4 && (e[3] === 'total') === !!e[7] && (e[3] === 'penumbral') === !e[6] && x.p1 < x.max && x.p4 > x.max;
    }));
    ok(SDb.SOLAR_ECLIPSES.length === 22 && SDb.LUNAR_ECLIPSES.length === 23 && ecl.every(Boolean) && SDb.SOLAR_ECLIPSES[0][0] === '2026-02-17' && SDb.LUNAR_ECLIPSES.at(-1)[0] === '2035-08-19',
      '#94 the 22 solar and 23 lunar eclipses of 2026 to 2035 from NASA\'s catalogues: each within 30 minutes of its new or full Moon, each type matching its magnitude and phases', JSON.stringify(ecl.map((v, i) => (v ? '' : i)).filter(String)));
    // #134 Albany, 14 Nov to 14 Dec 2026: Mars passes about a degree from Jupiter before dawn round 16 Nov (Sky at Night,
    // "around a degree north", 14 to 17 Nov; close approach 16 Nov 02:04 GMT, derekscope.co.uk); the Moon passes
    // Jupiter on 30 Nov (close approach 08:24 GMT, 3:24 AM in Albany, same source), and Mars that morning
    const hl = Astro.skyHighlights(Date.UTC(2026, 10, 14, 17), Date.UTC(2026, 11, 14, 17), 42.6526, -73.7562);
    const mj = hl.find((h) => h.kind === 'pair' && h.a === 'mars' && h.b === 'jupiter');
    const moonJ = hl.find((h) => h.kind === 'moon' && h.body === 'jupiter');
    ok(hl.length === 3 && mj && albISO(mj.t) === '2026-11-16' && mj.sep > 0.8 && mj.sep < 1.5 && moonJ && albISO(moonJ.t) === '2026-11-30'
      && Math.abs(moonJ.t - Date.UTC(2026, 10, 30, 8, 24)) < 2 * 36e5 && moonJ.sep < 1.5 && moonJ.from < Date.UTC(2026, 10, 30, 8, 24) && moonJ.to > Date.UTC(2026, 10, 30, 8, 24),
    '#134 skyHighlights() for Albany from 14 Nov 2026: Mars about 1° from Jupiter before dawn on 16 Nov, the Moon about 1° from Jupiter on the night of 29/30 Nov (both as published), and the Moon by Mars on 30 Nov',
    JSON.stringify(hl.map((h) => ({ ...h, t: new Date(h.t).toISOString(), from: h.from && new Date(h.from).toISOString(), to: h.to && new Date(h.to).toISOString() }))));
    // zonedTime(): a time the clocks skip is read forward, a repeated one is its first occurrence (2026 in New York)
    const z = (d, hh, mm, tz = 'America/New_York') => new Date(Astro.zonedTime(2026, ...d, hh, mm, tz)).toISOString().slice(0, 16);
    ok(z([3, 8], 2, 30) === '2026-03-08T07:30' && z([3, 8], 2, 0) === '2026-03-08T07:00' && z([3, 8], 1, 59) === '2026-03-08T06:59' && z([3, 8], 3, 0) === '2026-03-08T07:00'
      && z([11, 1], 1, 30) === '2026-11-01T05:30' && z([11, 1], 0, 59) === '2026-11-01T04:59' && z([11, 1], 2, 0) === '2026-11-01T07:00'
      && z([3, 29], 1, 30, 'Europe/London') === '2026-03-29T01:30' && z([10, 4], 2, 30, 'Australia/Sydney') === '2026-10-03T16:30'
      && z([10, 25], 1, 30, 'Europe/London') === '2026-10-25T00:30' && z([4, 5], 2, 30, 'Australia/Sydney') === '2026-04-04T15:30' && z([4, 5], 3, 0, 'Australia/Sydney') === '2026-04-04T17:00',
    'zonedTime(): 02:30 on 8 Mar 2026 in New York (skipped) is 3:30 EDT, not 1:30 EST; 01:30 on 1 Nov (twice) is the first, EDT; the same forward rule in London and Sydney, and east of Greenwich the repeated time is the first too (London 25 Oct BST, Sydney 5 Apr AEDT; batch 6 fixed it, it was the second)',
    JSON.stringify([z([3, 8], 2, 30), z([3, 8], 2, 0), z([11, 1], 1, 30), z([3, 29], 1, 30, 'Europe/London'), z([10, 4], 2, 30, 'Australia/Sydney'), z([10, 25], 1, 30, 'Europe/London'), z([4, 5], 2, 30, 'Australia/Sydney')]));
    // #141 the calendar file: RFC 5545 lines, the same file from scripts/sky_ics.mjs and from the page
    const ics = execFileSync('node', ['scripts/sky_ics.mjs', '--from', '2026-11-14', '--lang', 'en', '--stdout'], { cwd: repo, encoding: 'utf8' });
    const lines = ics.split('\r\n');
    const unfolded = ics.replace(/\r\n /g, '');
    const evs = unfolded.split('BEGIN:VEVENT').slice(1);
    const sum = (re) => evs.filter((e) => re.test(e)).length;
    const fullNov = /UID:full-20261124T1454\d\dZ/.test(unfolded) || /DTSTART:20261124T145[34]00Z/.test(unfolded);
    ok(ics.endsWith('\r\n') && !/[^\r]\n/.test(ics) && lines.every((l) => Buffer.byteLength(l) <= 75) && /^BEGIN:VCALENDAR\r\nVERSION:2\.0\r\nPRODID:/.test(ics)
      && evs.length === 41 && sum(/SUMMARY:Full Moon/) === 12 && sum(/SUMMARY:New Moon/) === 12 && sum(/(equinox|solstice)/) === 4 && sum(/peak \(approx\.\)/) === 8
      && sum(/solar eclipse/) === 2 && sum(/lunar eclipse/) === 3 && evs.every((e) => /UID:[^\r]+@glacieerr\.github\.io/.test(e) && /DTSTAMP:20261114T000000Z/.test(e))
      && /DTSTART;VALUE=DATE:20261214\r\nDTEND;VALUE=DATE:20261215\r\nSUMMARY:Geminids peak \(approx\.\)/.test(unfolded) && fullNov
      && /DTSTART:20270320T2025\d\dZ\r\nSUMMARY:March equinox/.test(unfolded) && /SUMMARY:Total solar eclipse\r\nDESCRIPTION:Seen as a partial eclipse from Africa\\, Europe/.test(unfolded)
      && /Times are in UTC\\; your calendar/.test(unfolded),
    '#141 scripts/sky_ics.mjs from 14 Nov 2026: 41 events (12 full and 12 new Moons, 4 equinoxes and solstices, 8 shower peaks as all-day dates, 5 eclipses), UTC times, CRLF lines folded at 75 octets, text escaped',
    JSON.stringify([evs.length, lines.filter((l) => Buffer.byteLength(l) > 75).slice(0, 2)]));
  }

  // ---------------- #95 the lunar date and the solar terms in Chinese; #136's Chinese Today
  await api.viewport(1280, 900, { dark: true });
  await api.eval(`localStorage.clear()`);
  await api.go('?lang=zh', 1200);
  const zhNow = Date.now();
  const zcopy = D.copy.zh.lunar;
  // the terms on their Beijing dates (UTC+8), as Chinese calendars print them: the Albany date
  // shown takes the latest term dated on or before it in Beijing
  const bjISO = (ms) => new Date(ms + 8 * 36e5).toISOString().slice(0, 10);
  const lunarWant = (t) => {
    const iso = albISO(t);
    const [y, m, d] = iso.split('-').map(Number);
    const L = Astro.chineseDate(y, m, d, Hol);
    const cur = Astro.solarTerms(t - 20 * 864e5, t + 20 * 864e5).filter((x) => bjISO(x.t) <= iso).at(-1);
    const mo = zcopy.months[L.m - 1];
    return `农历${L.leap ? `闰${mo}` : mo}${zcopy.days[L.d - 1]} · ${zcopy.terms[cur.i]}`;
  };
  const lz = await api.eval(`({lunar: document.getElementById('lunar').textContent, hidden: document.getElementById('lunar').hidden, lang: document.getElementById('lunar').lang, inBrowser: [Astro.chineseDate(2027, 2, 6, Holidays), Astro.chineseDate(2027, 2, 6), Astro.chineseDate(2030, 2, 2, Holidays), Astro.chineseDate(2030, 2, 3, Holidays)]})`);
  const hkoAll = await api.eval(`(() => {
    const months = ${JSON.stringify(Object.fromEntries(Object.entries({ 2027: '0108:12 0206:1 0308:2', 2030: '0104:12 0203:1 0304:2' })))};
    const out = [];
    for (const [y, list] of Object.entries(months)) { const s = list.split(' ').map((x) => { const [md, mo] = x.split(':'); return [Date.UTC(+y, +md.slice(0, 2) - 1, +md.slice(2)), +mo]; });
      for (let t = s[0][0]; t < s[2][0]; t += 864e5) { const k = t >= s[1][0] ? 1 : 0; const d = new Date(t); const g = Astro.chineseDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), Holidays); if (g.m !== s[k][1] || g.d !== (t - s[k][0]) / 864e5 + 1) out.push(d.toISOString().slice(0, 10)); } }
    return out; })()`);
  ok(lz.lunar === lunarWant(zhNow) && !lz.hidden && lz.lang === 'zh-CN' && lz.inBrowser[0].m === 1 && lz.inBrowser[0].d === 1 && lz.inBrowser[1].m === 12
    && lz.inBrowser[2].m === 12 && lz.inBrowser[2].d === 30 && lz.inBrowser[3].m === 1 && lz.inBrowser[3].d === 1 && hkoAll.length === 0,
  `#95 in Chinese the lock screen shows the lunar date and the solar term in force ("${lz.lunar}"); Chrome's own calendar is mended the same way (2027-02-06 is 正月初一, not ICU's 腊月三十; HKO's months round the 2027 and 2030 Spring Festivals match)`,
  JSON.stringify([lz, lunarWant(zhNow), hkoAll.slice(0, 3)]));
  await api.go('?lang=en', 900);
  ok(await api.eval(`document.getElementById('lunar').hidden`), '#95 the lunar line is Chinese only');
  await api.go('?lang=zh&open=nc', 1000);
  const ncz = await api.eval(`[...document.querySelectorAll('#ncSeason .nc-lunar > span')].map((e) => e.textContent)`);
  const zhISO = albISO(zhNow);
  const nextT = Astro.solarTerms(zhNow - 20 * 864e5, zhNow + 20 * 864e5).find((x) => bjISO(x.t) > zhISO || (bjISO(x.t) === zhISO && x.t > zhNow));
  const nGap = dayGap(bjISO(nextT.t), zhISO);
  const ncWantZh = nGap <= 0 ? `下一个节气：${zcopy.terms[nextT.i]}，今天` : nGap === 1 ? `下一个节气：${zcopy.terms[nextT.i]}，明天`
    : `下一个节气：${zcopy.terms[nextT.i]}，${fmtISO(bjISO(nextT.t), { month: 'long', day: 'numeric' }, 'zh-CN')}（北京时间，还有 ${nGap} 天）`;
  ok(ncz.length === 2 && ncz[0] === lunarWant(Date.now()) && ncz[1].startsWith(ncWantZh) && ncz[1].includes('北京时间') && await api.eval(`!!document.querySelector('#ncSeason .season-ring')`),
    '#95 #136 the Chinese Today panel: the lunar date and solar term, then the next term with its date in Beijing time (as Chinese calendars date it) and the days to it from the Albany date, round the year ring', JSON.stringify([ncz, ncWantZh]));

  // ---------------- #150 the festivals, by travelling to them; #104 the tab icon
  const today = albISO(Date.now());
  const nextOf = (f) => {
    for (let k = 1; k <= 366; k++) { const iso = albISO(Date.now() + k * 864e5); const [y, m, d] = iso.split('-').map(Number); if (Hol.festivalOn(y, m, d) === f) return [k, iso]; }
    return null;
  };
  const travelTo = async (k, iso) => {
    for (const v of [k, k - 1, k + 1]) {
      await api.eval(`(() => { const r = document.getElementById('ttRange'); r.value = '${v}'; r.dispatchEvent(new Event('input', {bubbles: true})); })()`);
      await sleep(250);
      const shown = await api.eval(`document.getElementById('date').textContent`);
      if (shown === fmtISO(iso, { weekday: 'long', month: 'long', day: 'numeric' }, 'en-US') || shown === `${fmtISO(iso, { month: 'numeric' }, 'zh-CN')}${+iso.slice(8)}日 ${fmtISO(iso, { weekday: 'long' }, 'zh-CN')}`) return true;
    }
    return false;
  };
  const fests = {};
  for (const [f, lng] of [['spring-festival', 'en'], ['spring-festival', 'zh'], ['new-year', 'en'], ['mid-autumn', 'en']]) {
    const nx = nextOf(f);
    if (!nx) continue;
    await api.go(`?lang=${lng}&open=tt-dates`, 900);
    const there = await travelTo(...nx);
    fests[`${f}:${lng}`] = { there, ...(await api.eval(`({fest: document.getElementById('fest').textContent, hidden: document.getElementById('fest').hidden, aria: document.querySelector('#fest [aria-hidden]') ? 'hidden' : '', ds: document.documentElement.dataset.festival, glow: document.documentElement.classList.contains('fest-mid-autumn') ? getComputedStyle(document.querySelector('#orbit .moon-halo')).fill : '', lunar: document.getElementById('lunar').textContent})`)) };
  }
  ok(fests['spring-festival:en'].there && fests['spring-festival:en'].fest === 'Happy Lunar New Year' && fests['spring-festival:zh'].fest === '春节快乐' && /^农历正月初一 · /.test(fests['spring-festival:zh'].lunar)
    && fests['new-year:en'].there && fests['new-year:en'].fest === '✺' && fests['new-year:en'].aria === 'hidden' && fests['mid-autumn:en'].there && fests['mid-autumn:en'].ds === 'mid-autumn'
    && /rgb\(255, 241, 201\)/.test(fests['mid-autumn:en'].glow) && fests['mid-autumn:en'].hidden,
  '#150 travel to the festivals: "Happy Lunar New Year" (春节快乐, on 农历正月初一) after the Spring Festival\'s date, a firework (hidden from screen readers) on New Year\'s Day, the Moon glowing at Mid-Autumn',
  JSON.stringify(fests));
  await api.go('?lang=en', 900);
  const fav = await api.eval(`(() => { const l = document.querySelector('link[rel=icon]'); return {href: l.href.slice(0, 25), type: l.type, key: l.dataset.moon, svg: decodeURIComponent(l.href.slice(l.href.indexOf(',') + 1))}; })()`);
  const mNow = Astro.moonPhase(Date.now());
  const pathNow = Astro.moonPhasePath(32, 32, 21, mNow.illum, mNow.waxing);
  ok(fav.href === 'data:image/svg+xml,%3Csvg' && fav.type === 'image/svg+xml' && fav.key === `${Math.round(mNow.illum * 50)}${mNow.waxing ? '+' : '-'}` && (!pathNow || fav.svg.includes(pathNow.slice(0, 20)))
    && fav.svg.includes('stroke-opacity=".45"'),
  `#104 the tab icon is today's Moon (${Math.round(mNow.illum * 100)}% lit, ${mNow.waxing ? 'waxing' : 'waning'}) drawn as an SVG data address, with a faint edge so a new Moon still shows`, JSON.stringify({ ...fav, svg: fav.svg.slice(0, 80) }));

  // ---------------- #127 the Moon on the calendar
  await api.go('?lang=en#home/calendar', 1200);
  const [cy, cm] = today.split('-').map(Number);
  const monthPhases = (y, m) => Astro.moonPhases(Astro.zonedTime(y, m, 1, 0, 0, 'America/New_York'), Astro.zonedTime(y, m + 1, 1, 0, 0, 'America/New_York'));
  const calNow = await api.eval(`({cells: document.querySelectorAll('.month-grid .d:not(.blank)').length, moons: document.querySelectorAll('.month-grid .d:not(.blank) .moon-ico').length, ph: [...document.querySelectorAll('.month-grid .d.ph')].map((d) => +d.querySelector('.dn').textContent + ':' + d.dataset.phase), list: document.querySelectorAll('.cal-moons li').length, aria: document.querySelector('.cal-moons').getAttribute('aria-label'), todayDn: document.querySelector('.month-grid .today .dn').textContent})`);
  const wantPh = monthPhases(cy, cm).map((p) => `${+albISO(p.t).slice(8)}:${p.q}`);
  ok(calNow.cells === new Date(Date.UTC(cy, cm, 0)).getUTCDate() && calNow.moons === calNow.cells && calNow.ph.join() === wantPh.join() && calNow.list === wantPh.length && calNow.aria === 'The Moon this month' && calNow.todayDn === String(+today.slice(8)),
    '#127 every day of this month has its small Moon, and the days of the new, first-quarter, full and last-quarter Moons are named, as moonPhases() puts them in Albany', JSON.stringify([calNow, wantPh]));
  // November 2026, as the idea has it: full Moon on the 24th, and the 8 December new Moon in Albany
  const steps = (2026 - cy) * 12 + (11 - cm);
  for (let k = 0; k < Math.abs(steps); k++) { await api.eval(`document.querySelector('[data-cal="${steps > 0 ? 'next' : 'prev'}"]').click()`); await sleep(60); }
  await sleep(200);
  const nov = await api.eval(`({month: document.querySelector('.cal-month').textContent, ph: [...document.querySelectorAll('.month-grid .d.ph')].map((d) => d.querySelector('.dn').textContent + ' ' + d.querySelector('.ph-w').textContent), list: [...document.querySelectorAll('.cal-moons li')].map((l) => l.textContent)})`);
  await api.eval(`document.querySelector('[data-cal="next"]').click()`);
  await sleep(200);
  const dec = await api.eval(`[...document.querySelectorAll('.month-grid .d.ph')].map((d) => d.querySelector('.dn').textContent + ' ' + d.querySelector('.ph-w').textContent)`);
  // USNO: 1 Nov 20:28, 9 Nov 07:02, 17 Nov 11:48, 24 Nov 14:53 UT; shown to the minute, so within one minute
  const novWant = [['Nov 1, Last quarter, ', 15, 28], ['Nov 9, New Moon, ', 2, 2], ['Nov 17, First quarter, ', 6, 48], ['Nov 24, Full Moon, ', 9, 53]];
  const novOk = nov.list.length === 4 && nov.list.every((s, k) => {
    const m = s.match(/^(.*, )(\d{1,2}):(\d{2})\s([AP])M$/);
    return m && m[1] === novWant[k][0] && Math.abs(((+m[2] % 12) + (m[4] === 'P' ? 12 : 0)) * 60 + +m[3] - (novWant[k][1] * 60 + novWant[k][2])) <= 1;
  });
  ok(nov.month === 'November 2026' && nov.ph.join('|') === '1 Last qtr|9 New|17 1st qtr|24 Full' && novOk && dec.includes('8 New') && dec.includes('23 Full'),
    '#127 November 2026: last quarter on the 1st, new Moon on the 9th, first quarter on the 17th, full Moon on the 24th (about 9:53 AM, USNO\'s 14:53 UT), and in December the new Moon on the 8th in Albany', JSON.stringify([nov, dec]));
  await api.go('?lang=zh#home/calendar', 1200);
  const calZh = await api.eval(`({lunar: document.querySelector('.cal-lunar').textContent, item: (document.querySelector('.cal-moons li') || {}).textContent || '', foot: document.querySelector('.month-card + .tv-foot, .tv-sec .tv-foot').textContent})`);
  ok(calZh.lunar === lunarWant(Date.now()) && /^\d+月\d+日，(新月|上弦月|满月|下弦月)，\d{1,2}:\d{2}$/.test(calZh.item), '#127 #95 in Chinese the Calendar names the phases ("11月24日，满月，9:53") and shows the lunar date under the date', JSON.stringify(calZh));

  // ---------------- #142 day and night on the Clock app's map
  await api.go('?lang=en#home/clock', 1400);
  const tm = Date.now();
  const sub = Astro.subsolarPoint(tm);
  const albSun = Astro.observe('sun', tm, 42.6526, -73.7562).alt;
  const albUp = Astro.observe('sun', tm + 6e5, 42.6526, -73.7562).alt > albSun;
  const stWant = albSun > Astro.HORIZON.sun ? 'day' : albSun < -18 ? 'night' : albUp ? 'dawn' : 'dusk';
  const map = await api.eval(`({state: document.getElementById('wmap').dataset.state, cap: document.getElementById('wmapCap').textContent, cities: document.querySelectorAll('.wm-cities circle').length, layers: [...document.querySelectorAll('.wm-night path')].map((p) => (p.getAttribute('d').match(/M/g) || []).length), sun: [+document.querySelector('.wm-sun circle').getAttribute('cx'), +document.querySelector('.wm-sun circle').getAttribute('cy')], label: document.querySelector('.wm-albany text').textContent, aria: document.querySelector('.wmap-svg').getAttribute('aria-label'), foot: [...document.querySelectorAll('.tv-foot')].map((f) => f.textContent).find((x) => /cities of the Sky app/.test(x))})`);
  ok(map.state === stWant && map.cap === `In Albany it is ${stWant}.` && map.cities === SDb.CITIES.length && map.layers.length === 4 && map.layers.every((n) => n > 20)
    && Math.abs(map.sun[0] - (sub.lon + 180)) < 1 && Math.abs(map.sun[1] - (90 - sub.lat)) < 1 && map.label === `Albany · ${stWant}` && /^World map of day and night now, with the land outlined\. The Sun is overhead at /.test(map.aria)
    && map.foot === `The dots are the ${SDb.CITIES.length} cities of the Sky app; the shading is night and the three stages of twilight. Land outlines: Natural Earth (public domain).`,
  `#142 the Clock app's map shades night and twilight from subsolarPoint() (the Sun overhead at ${sub.lat.toFixed(1)}°, ${sub.lon.toFixed(1)}°), marks Albany and says it is ${stWant} there`, JSON.stringify(map));
  // the land: Natural Earth's outline from pages/src/land.txt (scripts/land_path.py), drawn once, under the shading
  const landTxt = readFileSync(`${repo}pages/src/land.txt`, 'utf8').split('\n');
  const land = await api.eval(`(() => { const p = document.querySelector('.wmap-svg .wm-land'); if (!p) return null; const b = p.getBBox(); const cs = getComputedStyle(p); window.__wmLand = p;
    return {n: document.querySelectorAll('.wm-land').length, d: p.getAttribute('d'), tf: p.getAttribute('transform'), rule: p.getAttribute('fill-rule'), box: [b.x, b.y, b.width, b.height].map((v) => Math.round(v)),
      under: !!(p.compareDocumentPosition(document.querySelector('.wm-night')) & Node.DOCUMENT_POSITION_FOLLOWING), afterSea: !!(document.querySelector('.wm-sea').compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING),
      fill: cs.fill, sea: getComputedStyle(document.querySelector('.wm-sea')).fill, stroke: cs.stroke, ve: cs.vectorEffect, night0: document.querySelector('.wm-night path').getAttribute('d').length}; })()`);
  await api.key('t');
  await sleep(400);
  await api.eval(`(() => { const r = document.getElementById('ttRange'); r.value = String((Number(r.value) + 360) % 1440); r.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(700);
  const land2 = await api.eval(`({same: document.querySelector('.wm-land') === window.__wmLand, n: document.querySelectorAll('.wm-land').length, night: document.querySelector('.wm-night path').getAttribute('d').length, sun: +document.querySelector('.wm-sun circle').getAttribute('cx')})`);
  await api.key('Escape');
  await sleep(300);
  ok(land && landTxt[0].startsWith('# Land outlines: Natural Earth 1:110m land, ne_110m_land.geojson') && /public domain/.test(landTxt[0]) && /scripts\/land_path\.py/.test(landTxt[0])
    && land.n === 1 && land.d === landTxt[1] && land.d.length > 10000 && land.tf === 'scale(0.25)' && land.rule === 'evenodd' && land.under && land.afterSea
    && land.box[0] >= 0 && land.box[1] >= 0 && land.box[2] > 1400 && land.box[3] > 650 && land.fill !== land.sea && land.stroke !== 'none' && land.ve === 'non-scaling-stroke'
    && land2.same && land2.n === 1 && Math.abs(land2.sun - map.sun[0]) > 60,
  '#142 the map draws the land: Natural Earth\'s 1:110m outline (public domain) from pages/src/land.txt, made by scripts/land_path.py, in a quiet fill with a hairline edge, over the sea and under the night; time travel redraws the shading and keeps the land as it is',
  JSON.stringify([{ ...land, d: land && land.d.length }, land2]));

  // ---------------- #96 planet sounds: off, nothing made until a click, then a note per pass in front of the avatar
  const snd = await api.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { window.__ac = 0; window.__osc = 0; const AC = window.AudioContext; if (!AC) return; window.AudioContext = class extends AC { constructor(...a) { super(...a); window.__ac++; window.__ctx = this; } createOscillator() { window.__osc++; return super.createOscillator(); } }; })();` });
  await api.go('?lang=en&open=cc', 1500);
  const s0 = await api.eval(`({pressed: document.getElementById('ccSound').getAttribute('aria-pressed'), ac: window.__ac, note: document.getElementById('ccSoundNote').textContent, desc: document.getElementById('ccSound').getAttribute('aria-describedby')})`);
  await clickOn('#ccSound');
  await sleep(400);
  const s1 = await api.eval(`({pressed: document.getElementById('ccSound').getAttribute('aria-pressed'), ac: window.__ac, state: window.__ctx && window.__ctx.state, stored: Object.keys(localStorage).filter((k) => /sound/i.test(k)).length})`);
  await api.key('Escape');
  await api.move(4, 4);                      // off the orbit, which slows the planets while the pointer is over it
  let osc = 0;
  for (let k = 0; k < 30 && !osc; k++) { await sleep(500); osc = await api.eval('window.__osc'); }
  await api.eval(`document.getElementById('ccGrab').click()`);
  await sleep(500);
  await clickOn('#ccMotion');
  await sleep(300);
  const s2 = await api.eval(`({pressed: document.getElementById('ccSound').getAttribute('aria-pressed'), disabled: document.getElementById('ccSound').getAttribute('aria-disabled')})`);
  await clickOn('#ccSound');
  await sleep(200);
  const s3 = await api.eval(`document.getElementById('ccSound').getAttribute('aria-pressed')`);
  await clickOn('#ccMotion');
  await api.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: snd.identifier });
  await api.eval(`localStorage.clear()`);
  // a machine with no audio output may keep the context suspended: then only the switch is checked
  const audioOk = s1.state === 'running';
  if (!audioOk) console.log('     note: this Chrome has no running audio output; the chimes themselves were not checked');
  ok(s0.pressed === 'false' && s0.ac === 0 && s0.desc === 'ccSoundNote' && /passes in front of the avatar/.test(s0.note) && s1.pressed === 'true' && s1.ac === 1 && s1.stored === 0
    && (!audioOk || osc >= 2) && s2.pressed === 'false' && s2.disabled === 'true' && s3 === 'false',
  '#96 planet sounds: off at first and no audio made until the switch is clicked (never remembered, so never autoplays); then planets chime as they pass in front of the avatar; reduced motion turns it off and disables it',
  JSON.stringify([s0, s1, osc, s2, s3]));

  // ---------------- #143 drag Earth round its ring through time; arrow keys a day at a time
  await api.viewport(1280, 900, { dark: true });
  await api.go('?lang=en', 1400);
  const earthAt = () => api.eval(`(() => { const r = document.querySelector('.pl-btn[data-planet="earth"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  let e0 = await earthAt();
  await api.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: e0[0], y: e0[1] });
  await sleep(500);
  e0 = await earthAt();
  const ringPt = (deg) => api.eval(`(() => { const D = JSON.parse(document.getElementById('data').textContent); const r = document.getElementById('orbit').getBoundingClientRect(); const s = r.width / D.stage[2];
    const [rx, ry, rot] = D.orbits[2]; const T = rot * Math.PI / 180; const a = ${deg} * Math.PI / 180; const x = rx * Math.cos(a); const y = -ry * Math.sin(a);
    return [r.left + (D.center[0] + x * Math.cos(T) - y * Math.sin(T) - D.stage[0]) * s, r.top + (D.center[1] + x * Math.sin(T) + y * Math.cos(T) - D.stage[1]) * s]; })()`);
  const th0 = (await thetas())[2];
  await api.mouse('mousePressed', e0[0], e0[1]);
  const path = [];
  for (let k = 1; k <= 8; k++) path.push(await ringPt(th0 + 12 * k));
  for (const [x, y] of path) { await api.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 }); await sleep(70); }
  await sleep(1500);
  const thD = await thetas();
  const dragging = await api.eval(`({cls: document.body.classList.contains('earth-drag'), badge: !document.getElementById('ttBadge').hidden, card: document.querySelector('#plCard .pc-name') && document.querySelector('#plCard .pc-name').textContent, hint: (document.querySelector('#plCard .pc-hint') || {}).textContent, view: document.body.dataset.view})`);
  // the moment Earth really is where the pointer stopped (th0 + 96°): the page counts the turn from
  // Earth's real place now to where it was pressed, then the 96° dragged
  const w180 = (x) => ((((x % 360) + 540) % 360) - 180);
  const lonNow0 = Astro.heliocentric('earth', Date.now()).lon;
  let tStar = Date.now() + ((w180(th0 - lonNow0) + 96) / 360) * 365.256 * 864e5;
  for (let k = 0; k < 6; k++) tStar += (w180(th0 + 96 - Astro.heliocentric('earth', tStar).lon) / 360) * 365.256 * 864e5;
  const lonStar = Astro.planetLongitudes(tStar);
  await api.mouse('mouseReleased', path.at(-1)[0], path.at(-1)[1]);
  await sleep(300);
  const rel = await api.eval(`({view: document.body.dataset.view, app: document.getElementById('appLayer').hidden ? null : document.getElementById('appView').dataset.app, badge: !document.getElementById('ttBadge').hidden})`);
  await sleep(1700);
  const back = await api.eval(`({badge: !document.getElementById('ttBadge').hidden, date: document.getElementById('date').textContent})`);
  const A5 = await albany();
  ok(dragging.cls && dragging.badge && dragging.view === 'lock' && angErr(thD[2], th0 + 96) < 1.5 && [3, 4, 5].every((i) => angErr(thD[i], lonStar[i]) < 1.5)
    && dragging.card === fmtISO(albISO(tStar), { year: 'numeric', month: 'long', day: 'numeric' }) && dragging.hint === 'Let go and it comes back to now'
    && rel.view === 'lock' && !rel.app && rel.badge && !back.badge && back.date === A5.date,
  '#143 dragging Earth round its ring travels through time: Earth stays under the pointer, Mars, Jupiter and Saturn go to where they really are then, the date shows beside Earth; letting go neither unlocks nor opens the Sky, and time comes back to now',
  JSON.stringify({ dragging, th: [thD[2], th0 + 96], lon: [thD.slice(3, 6), lonStar.slice(3, 6)], tStar: new Date(tStar).toISOString(), rel, back }));
  await api.eval(`document.querySelector('.pl-btn[data-planet="earth"]').focus()`);
  await sleep(150);
  for (let k = 0; k < 3; k++) { await api.key('ArrowRight'); await sleep(100); }
  await sleep(250);
  const kb = await api.eval(`({date: document.getElementById('date').textContent, card: document.querySelector('#plCard .pc-name').textContent, focus: document.activeElement.dataset.planet})`);
  const plus3 = albISO(Date.now() + 3 * 864e5);
  await api.key('Escape');
  await sleep(300);
  const kb2 = await api.eval(`({badge: !document.getElementById('ttBadge').hidden, date: document.getElementById('date').textContent})`);
  const plain = await api.eval(`(() => { document.activeElement.blur(); const r = document.querySelector('.pl-btn[data-planet="earth"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  await api.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: plain[0], y: plain[1] });
  await sleep(400);
  const p2 = await earthAt();
  await api.click(p2[0], p2[1]);
  await sleep(900);
  const opened = await api.eval(`document.getElementById('appLayer').hidden ? null : document.getElementById('appView').dataset.app`);
  ok(kb.date === fmtISO(plus3, { weekday: 'long', month: 'long', day: 'numeric' }) && kb.card === fmtISO(plus3, { year: 'numeric', month: 'long', day: 'numeric' }) && kb.focus === 'earth'
    && !kb2.badge && kb2.date === A5.date && opened === 'sky',
  '#143 with Earth focused, → steps a day at a time (three presses: three days on), Esc comes back to now, and a plain click on Earth still opens the Sky', JSON.stringify([kb, plus3, kb2, opened]));

  // ---------------- #93 #94 #134 the Sky app's new lists, and the radiant on the chart
  await api.go('?lang=en#sky/albany/2026-11-14/21:00', 1500);
  const sky1 = await api.eval(`({next: [...document.querySelectorAll('#skyNext .sky-nx')].map((r) => r.dataset.kind + ' ' + r.innerText.replace(/\\n/g, ' | ')), showers: [...document.querySelectorAll('#skyShowers .tv-row')].map((r) => r.dataset.shower + (r.classList.contains('on') ? '*' : '') + ' ' + r.querySelector('.tv-v').textContent),
    ecl: [...document.querySelectorAll('#skyEcl .tv-row')].map((r) => r.innerText.replace(/\\n/g, ' | ')), met: [...document.querySelectorAll('#skyTonight .sky-met .tv-v')].map((r) => r.textContent), foot: document.getElementById('skyNextFoot').textContent, eclFoot: document.getElementById('skyEclFoot').textContent})`);
  ok(sky1.next.length === 5 && sky1.next[0] === 'pair Nov 16 | 11:50 PM to 6:10 AM | Mars and Jupiter, about 1° apart | best about 6:10 AM, high in the south'
    && sky1.next[1].startsWith('shower Nov 17 | Leonids peak (around this date)') && /^moon Nov 30 \| 11:00 PM to 6:30 AM \| The Moon and Jupiter, about 1° apart \| closest about 2:30 AM/.test(sky1.next[2])
    && sky1.next[3].startsWith('moon Nov 30') && sky1.next[4].startsWith('shower Dec 14 | Geminids peak') && sky1.foot.startsWith('Worked out for Albany in its own time'),
  '#134 the Sky over Albany on 14 Nov 2026 lists the next 30 days: Mars by Jupiter (16 Nov), the Leonids, the Moon by Jupiter and by Mars (30 Nov), the Geminids; times in Albany', JSON.stringify(sky1.next));
  ok(sky1.showers.join('|') === 'LEO* Peak around Nov 17|GEM Peak around Dec 14|URS Peak around Dec 22|QUA Peak around Jan 4, 2027|LYR Peak around Apr 23, 2027|ETA Peak around May 6, 2027|PER Peak around Aug 13, 2027|ORI Peak around Oct 22, 2027'
    && sky1.met.length === 1 && /^Leonids: peak around Nov 17\. The radiant is best about \d{1,2}:\d{2}\s[AP]M, (high in|in|low in) the [a-z]+\.$/.test(sky1.met[0]),
  '#93 the meteor showers: the Leonids active (peak around 17 Nov), then the others by their next IMO maximum; Tonight says when the Leonids\' radiant is best', JSON.stringify([sky1.showers, sky1.met]));
  ok(sky1.ecl.length === 4 && sky1.ecl[0].startsWith('Annular solar eclipse February 6, 2027 | The ring shows along a path across Chile, Argentina and the Atlantic.')
    && /^Penumbral lunar eclipse February 20, 2027 \| Seen from Albany from 5:\d\d PM to 8:13 PM; the Moon is below the horizon for the rest\. Greatest at 6:12 PM\. A penumbral eclipse only dims the Moon slightly\.$/.test(sky1.ecl[1])
    && sky1.ecl[2] === 'Penumbral lunar eclipse July 18, 2027 | Not seen from Albany: the Moon is below the horizon. It barely touches the penumbra: nothing to see.'
    && sky1.ecl[3].startsWith('Total solar eclipse August 2, 2027 | Totality along a path across Spain, northern Africa') && sky1.eclFoot.startsWith('Times in Albany time (EST). From NASA'),
  '#94 the next four eclipses from 14 Nov 2026: NASA\'s path and region for the solar ones, and for the lunar ones whether the Moon is up over Albany (20 Feb 2027: from moonrise to 8:13 PM, greatest at 6:12 PM)', JSON.stringify(sky1.ecl));
  // the 3 March 2026 total lunar eclipse from Albany: the Moon sets during totality (NASA: totality 11:04 to 12:02 UT)
  await api.go('?lang=en#sky/albany/2026-03-01/21:00', 1400);
  const e26 = await api.eval(`document.querySelector('#skyEcl .tv-row').innerText.replace(/\\n/g, ' | ')`);
  const x26 = Astro.lunarEclipseTimes(SDb.LUNAR_ECLIPSES[0]);
  const up26 = Astro.moonUpSpan(x26.u1, x26.u4, 42.6526, -73.7562);
  const tA = (ms) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }).format(new Date(ms));
  ok(e26 === `Total lunar eclipse March 3, 2026 | Seen from Albany from ${tA(up26.from)} to ${tA(up26.to)}; the Moon is below the horizon for the rest. Totality ${tA(x26.u2)} to ${tA(x26.u3)}.`
    && tA(x26.u2) === '6:04 AM' && tA(x26.u3) === '7:02 AM' && up26.from === x26.u1 && up26.to > x26.u2 && up26.to < x26.u3,
  '#94 the total lunar eclipse of 3 Mar 2026 from Albany: seen from the start of the partial phase until the Moon sets, partway through totality (6:04 to 7:02 AM, NASA\'s 11:04 to 12:02 UT)', JSON.stringify([e26, new Date(up26.to).toISOString()]));
  // the Geminids' night: the radiant on the chart, where astro.mjs puts it
  await api.go('?lang=en#sky/albany/2026-12-14/02:00', 1400);
  const tG = Astro.zonedTime(2026, 12, 14, 2, 0, 'America/New_York');
  const gem = SDb.METEOR_SHOWERS.find((s) => s.id === 'GEM');
  const rG = Astro.showerRadiant(gem, tG);
  const eqG = Astro.precess(rG.ra, rG.dec, tG);
  const hG = Astro.altAz(eqG.ra, eqG.dec, tG, 42.6526, -73.7562);
  const rad = await api.eval(`(() => { const g = document.querySelector('#skyChart .sky-radiant[data-id="radiant:GEM"]'); if (!g) return null; g.focus(); return {alt: +g.dataset.alt, az: +g.dataset.az, label: g.getAttribute('aria-label'), info: document.getElementById('skyInfo').innerText, tab: g.getAttribute('tabindex')}; })()`);
  ok(rad && Math.abs(rad.alt - hG.alt) < 0.2 && Math.abs(rad.az - hG.az) < 0.2 && /^Geminids radiant · [A-Z]{1,2} \d+°$/.test(rad.label) && rad.info.includes('Geminids: peak around Dec 14, ZHR about 150.'),
    '#93 on the Geminids\' night the chart marks their radiant where the IMO\'s drift puts it (high up at 2 AM), and focusing it says the peak and the ZHR', JSON.stringify([rad, hG]));

  // ---------------- #141 the .ics from the page is the file the script writes
  await api.eval(`(() => { window.__blobs = []; const o = URL.createObjectURL.bind(URL); URL.createObjectURL = (b) => { window.__blobs.push(b); return o(b); }; window.__clicks = []; HTMLAnchorElement.prototype.click = function () { window.__clicks.push([this.download, this.href]); }; })()`);
  const reqIcs = api.requests.length;
  await clickOn('#skyIcs');
  await sleep(500);
  const icsP = await api.eval(`(async () => { const b = window.__blobs[0]; return {type: b && b.type, name: window.__clicks[0] && window.__clicks[0][0], text: b ? await b.text() : '', note: document.getElementById('skyIcsNote').textContent}; })()`);
  const icsS = execFileSync('node', ['scripts/sky_ics.mjs', '--from', today, '--lang', 'en', '--stdout'], { cwd: repo, encoding: 'utf8' });
  const nIcs = (icsS.match(/BEGIN:VEVENT/g) || []).length;
  ok(icsP.type === 'text/calendar;charset=utf-8' && icsP.name === `sky-events-${today}-en.ics` && icsP.text === icsS && icsP.note === `Saved sky-events-${today}-en.ics: ${nIcs} events for the next 12 months. Times are in UTC; your calendar shows them in your own time zone.`
    && api.requests.slice(reqIcs).every((u) => /^(data|blob|file):/.test(u)),
  `#141 "Download a year of sky events" saves the same .ics, byte for byte, as scripts/sky_ics.mjs --from ${today} (${nIcs} events), made in the browser and sent nowhere`, JSON.stringify([icsP.name, icsP.note, icsP.text.length, icsS.length]));
  await api.go('?lang=zh#sky/albany/2026-11-14/21:00', 1400);
  await api.eval(`(() => { window.__blobs = []; URL.createObjectURL = (b) => { window.__blobs.push(b); return 'blob:x'; }; HTMLAnchorElement.prototype.click = function () {}; })()`);
  await clickOn('#skyIcs');
  await sleep(400);
  const icsZ = await api.eval(`window.__blobs[0].text()`);
  ok(icsZ === execFileSync('node', ['scripts/sky_ics.mjs', '--from', today, '--lang', 'zh', '--stdout'], { cwd: repo, encoding: 'utf8' }) && icsZ.includes('SUMMARY:满月') && icsZ.includes('极大（约）'),
    '#141 the Chinese page saves the Chinese calendar (满月, 双子座流星雨极大（约）…), again the same file as the script', String(icsZ.length));

  // ---------------- #103 the star game
  await api.go('?lang=en#sky/albany/2026-11-14/21:00', 1400);
  await api.eval(`localStorage.removeItem('ls7-cg-best')`);
  await clickOn('#cgStart');
  await sleep(300);
  const g0 = await api.eval(`(() => { const fig = document.getElementById('cgBoard').dataset.fig; const idx = [...new Set(SkyData.FIGURES[fig].flat())]; const segs = new Set(); for (const pl of SkyData.FIGURES[fig]) for (let i = 1; i < pl.length; i++) { const a = idx.indexOf(pl[i - 1]), b = idx.indexOf(pl[i]); segs.add(a < b ? a + '-' + b : b + '-' + a); }
    let miss = null; for (let a = 0; a < idx.length && !miss; a++) for (let b = a + 1; b < idx.length && !miss; b++) if (!segs.has(a + '-' + b)) miss = [a, b];
    return {fig, n: idx.length, segs: [...segs], miss, stars: document.querySelectorAll('.cg-star').length, focus: document.activeElement.classList.contains('cg-star'), status: document.getElementById('cgStatus').textContent, board: getComputedStyle(document.getElementById('cgBoard')).display, labels: [...document.querySelectorAll('.cg-star')].map((b) => b.getAttribute('aria-label'))}; })()`);
  await api.key('ArrowRight');
  await sleep(80);
  const g1 = await api.eval(`({focus: document.activeElement.getAttribute('aria-label')})`);
  if (g0.miss) await api.eval(`(() => { document.querySelector('.cg-star[data-i="${g0.miss[0]}"]').click(); document.querySelector('.cg-star[data-i="${g0.miss[1]}"]').click(); })()`);
  await sleep(80);
  const g2 = await api.eval(`document.getElementById('cgStatus').textContent`);
  await api.key('Escape');
  await sleep(80);
  const g3 = await api.eval(`({app: document.getElementById('appView').dataset.app, open: !document.getElementById('appLayer').hidden, sel: document.querySelectorAll('.cg-star.sel').length})`);
  for (const sg of g0.segs) {
    const [a, b] = sg.split('-');
    await api.eval(`(() => { const s = document.querySelector('.cg-star.sel'); if (!s || s.dataset.i !== '${a}') document.querySelector('.cg-star[data-i="${a}"]').click(); document.querySelector('.cg-star[data-i="${b}"]').click(); })()`);
  }
  await sleep(150);
  const g4 = await api.eval(`({status: document.getElementById('cgStatus').textContent, name: document.querySelector('.cg-name').textContent, story: document.querySelector('.cg-story').textContent, lines: document.querySelectorAll('#cgSvg .cg-line').length, best: JSON.parse(localStorage.getItem('ls7-cg-best') || '{}'), next: document.getElementById('cgStart').textContent, hint: document.getElementById('cgHint').hidden})`);
  const figName = SDb.FIGURE_NAMES[g0.fig].en;
  ok(g0.stars === g0.n && g0.focus && g0.status === `${g0.segs.length} lines to find. 30 seconds.` && g0.board !== 'none' && g0.labels.every((l, i) => l === `Star ${i + 1} of ${g0.n}`) && g1.focus === `Star 2 of ${g0.n}`
    && (!g0.miss || g2 === 'Those two are not joined in this figure.') && g3.open && g3.app === 'sky' && g3.sel === 0
    && new RegExp(`^Done in \\d+\\.\\d s: ${figName}\\.$`).test(g4.status) && g4.name === figName && g4.story === SDb.FIGURE_STORIES[g0.fig].en && g4.lines === g0.segs.length && g4.best[g0.fig] > 0 && g4.next === 'Next figure' && g4.hint,
  `#103 the star game (${figName}): stars as buttons in reading order (arrow keys move), a wrong pair is refused, Esc lets go of a star without leaving the Sky, joining every line names the figure, tells its story and keeps the best time`,
  JSON.stringify([g0.fig, g0.status, g1, g2, g3, g4.status, g4.lines]));
  await clickOn('#cgStart');
  await sleep(200);
  await api.eval(`(() => { const real = Date.now; Date.now = () => real() + 31000; setTimeout(() => { Date.now = real; }, 700); })()`);
  await sleep(900);
  const g5 = await api.eval(`({status: document.getElementById('cgStatus').textContent, fig: document.getElementById('cgBoard').dataset.fig, rest: document.querySelectorAll('#cgSvg .cg-rest').length, segs: (() => { const fig = document.getElementById('cgBoard').dataset.fig; let n = 0; for (const pl of SkyData.FIGURES[fig]) n += pl.length - 1; return n; })(), stars: [...document.querySelectorAll('.cg-star')].every((b) => b.getAttribute('aria-disabled') === 'true')})`);
  ok(g5.fig !== g0.fig && g5.status === `Time is up: this is ${SDb.FIGURE_NAMES[g5.fig].en}.` && g5.rest > 0 && g5.stars, '#103 when the 30 seconds run out the game names the figure and draws its missing lines dashed', JSON.stringify(g5));

  // ---------------- #100 the chart turns with a phone held up (simulated readings); hidden on a desktop
  const aimDesk = await api.eval(`document.getElementById('skyAim').hidden`);
  await api.viewport(390, 844, { mobile: true, dark: true });
  await api.go('?lang=en#sky/albany/2026-11-14/21:00', 1400);
  const bottom = () => api.eval(`(() => { const t = [...document.querySelectorAll('#skyChart .sky-cardinal')].map((e) => [e.textContent, +e.getAttribute('y')]); t.sort((a, b) => b[1] - a[1]); return t[0][0]; })()`);
  const a0 = await api.eval(`({hidden: document.getElementById('skyAim').hidden, note: document.getElementById('skyAimNote').textContent})`);
  await api.eval(`document.getElementById('skyAim').click()`);
  await sleep(200);
  await api.eval(`window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute', {alpha: 90, beta: 90, gamma: 0, absolute: true}))`);
  await sleep(400);
  const aW = [await bottom(), await api.eval(`document.getElementById('skyAim').getAttribute('aria-pressed')`), await api.eval(`document.querySelectorAll('#skyFace [aria-checked="true"]').length`)];
  await sleep(200);
  await api.eval(`window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute', {alpha: 0, beta: 100, gamma: 0, absolute: true}))`);
  await sleep(400);
  const aN = await bottom();
  await api.eval(`window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', {alpha: 200, beta: 90, gamma: 0, absolute: false}))`);
  await sleep(300);
  const aRel = await bottom();
  await api.eval(`document.getElementById('skyAim').click()`);
  await sleep(300);
  const aOff = [await bottom(), await api.eval(`document.getElementById('skyAim').getAttribute('aria-pressed')`)];
  await api.eval(`document.getElementById('skyAim').click()`);
  await sleep(3400);
  const aNone = await api.eval(`[document.getElementById('skyAim').getAttribute('aria-pressed'), document.getElementById('skyAimNote').textContent]`);
  await api.viewport(1280, 900, { dark: true });
  ok(aimDesk && !a0.hidden && /rough guide/.test(a0.note) && aW[0] === 'W' && aW[1] === 'true' && aW[2] === 0 && aN === 'N' && aRel === 'N' && aOff[0] === 'S' && aOff[1] === 'false'
    && aNone[0] === 'false' && aNone[1] === 'No compass reading came from this device.',
  '#100 "Point at the sky" (phones only): the direction the phone\'s back faces goes to the bottom of the chart (west, then north), a reading without a compass is ignored, off puts the chart back, and no reading at all turns it off and says so',
  JSON.stringify([aimDesk, a0, aW, aN, aRel, aOff, aNone]));

  // ---------------- contrast of the new words, both modes
  for (const mode of ['dark', 'light']) {
    const c = {};
    await api.go(`?lang=zh&appearance=${mode}`, 900);
    c['.lunar'] = (await contrastOf(api, '.lunar') || {}).p05;
    await api.go(`?lang=zh&appearance=${mode}&open=nc`, 900);
    c['.nc-next'] = (await contrastOf(api, '.nc-next') || {}).p05;
    await api.go(`?lang=en&appearance=${mode}&open=cc`, 900);
    c['.qs-note'] = (await contrastOf(api, '.qs-note') || {}).p05;
    await api.go(`?lang=en&appearance=${mode}#home/calendar`, 1000);
    for (const sel of ['.ph-w', '.cal-moons li']) { await api.eval(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({block: 'center'})`); c[sel] = (await contrastOf(api, sel) || {}).p05; }
    await api.go(`?lang=en&appearance=${mode}#home/clock`, 1100);
    await api.eval(`document.getElementById('wmapCap').scrollIntoView({block: 'center'})`);
    c['.wmap-cap'] = (await contrastOf(api, '.wmap-cap') || {}).p05;
    await api.go(`?lang=en&appearance=${mode}#sky/albany/2026-11-14/21:00`, 1300);
    for (const sel of ['.nx-what small', '.sky-sh-sub', '#skyEcl .tv-v', '.cg-intro']) { await api.eval(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({block: 'center'})`); c[sel] = (await contrastOf(api, sel) || {}).p05; }
    console.log('     contrast batch 1b', mode, JSON.stringify(c));
    ok(Object.values(c).every((v) => v >= 4.5), `contrast of the batch 1b words on the ${mode} page (lunar line, Today, sound note, calendar phases, map caption, Sky lists, game) >= 4.5:1`, JSON.stringify(c));
  }
  }

  {
  console.log('---- part 6: R3.3 batch 2 (the shell, the experience and privacy: ideas #114 to #182)');
  const repo6 = fileURLToPath(new URL('../..', import.meta.url));
  const dist = `${repo6}pages/dist/`;
  const profile = JSON.parse(readFileSync(`${repo6}data/profile.json`, 'utf8'));
  const html6 = readFileSync(`${dist}index.html`, 'utf8');
  const sitemap = readFileSync(`${dist}sitemap.xml`, 'utf8');
  const until = async (expr, timeout = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < timeout) { if (await api.eval(expr)) return true; await sleep(200); } return false; };
  const goFile = async (file, suffix, wait = 1000) => {
    await api.send('Page.navigate', { url: 'about:blank' });
    await sleep(100);
    await api.send('Page.navigate', { url: pathToFileURL(file).href + suffix });
    await sleep(wait);
  };
  const stubDownloads = `(() => { window.__blobs = []; const o = URL.createObjectURL.bind(URL); URL.createObjectURL = (b) => { window.__blobs.push(b); return o(b); }; window.__clicks = []; HTMLAnchorElement.prototype.click = function () { window.__clicks.push([this.download, this.href.slice(0, 5)]); }; window.__copied = null; const w = (s) => { window.__copied = s; return Promise.resolve(); }; if (navigator.clipboard) navigator.clipboard.writeText = w; else Object.defineProperty(navigator, 'clipboard', { value: { writeText: w } }); })()`;
  // a CSP violation anywhere from here on is collected (and reported as a console error too)
  await api.send('Page.addScriptToEvaluateOnNewDocument', { source: "window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));" });
  await api.viewport(1440, 900, { dark: true });

  // ---------------- the files beside index.html (#116, #117, #149, #181) and the source note (#148)
  const pngHead = (f) => { const b = readFileSync(f); return { sig: b.toString('ascii', 1, 4), w: b.readUInt32BE(16), h: b.readUInt32BE(20), kb: Math.round(b.length / 1024) }; };
  const og = existsSync(`${dist}og-image.png`) ? pngHead(`${dist}og-image.png`) : null;
  ok(og && og.sig === 'PNG' && og.w === 1200 && og.h === 630 && og.kb < 1024
    && html6.includes('<meta property="og:image" content="https://glacieerr.github.io/og-image.png">') && html6.includes('<meta property="og:image:width" content="1200">')
    && html6.includes('<meta property="og:image:height" content="630">') && html6.includes('<meta name="twitter:card" content="summary_large_image">') && /og:image:alt" content="[^"]{40,}"/.test(html6),
  '#117 the share card: og-image.png (1200 x 630) next to index.html, and the Open Graph and large-card tags point at it by its full address', JSON.stringify(og));
  const ldm = html6.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
  const ld = ldm ? JSON.parse(ldm[1].replace(/<\\\//g, '</')) : {};
  const robots = readFileSync(`${dist}robots.txt`, 'utf8');
  ok(ld['@type'] === 'Person' && ld.name === profile.name && ld.alternateName === profile.name_zh && ld.url === profile.links.pages
    && [profile.links.linkedin, 'https://github.com/Glacieerr', profile.links.site].every((u) => ld.sameAs.includes(u)) && !/telephone|streetAddress|\+1 |917|2839/.test(JSON.stringify(ld))
    && /<meta name="description" content="[^"]{40,}">/.test(html6) && html6.includes(`<link rel="canonical" href="${profile.links.pages}">`)
    && /^User-agent: \*$/m.test(robots) && robots.includes(`Sitemap: ${profile.links.pages}sitemap.xml`)
    && sitemap.includes(`<loc>${profile.links.pages}</loc>`) && /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(sitemap),
  '#181 for search engines: a schema.org Person (name, Chinese name, page, LinkedIn, GitHub, website; no phone, no street), the description, the canonical address, robots.txt and sitemap.xml', JSON.stringify(ld));
  const card = readFileSync(`${dist}card.txt`, 'utf8');
  const plain = readFileSync(`${dist}card-plain.txt`, 'utf8');
  const ESC = String.fromCharCode(27);
  const boxed = plain.split('\n').filter((l) => l.startsWith('|'));
  ok(card.includes(`${ESC}[38;5;`) && card.includes(profile.name) && card.includes(profile.name_zh) && profile.lanes.every((l) => card.includes(l) && plain.includes(l))
    && [profile.links.site, profile.links.linkedin, 'https://github.com/Glacieerr', profile.links.email].every((u) => card.includes(u) && plain.includes(u))
    && !plain.includes(ESC) && /^[\x20-\x7e\n]*$/.test(plain.replace(profile.name_zh, '')) && boxed.length > 8 && boxed.every((l) => l.length === boxed[0].length || l.includes(profile.name_zh))
    && card.includes('curl -sL glacieerr.github.io/card-plain.txt') && plain.includes('curl -sL glacieerr.github.io/card.txt'),
  '#149 card.txt for a terminal (256-colour codes in a box: the name, the three lanes and the links from profile.json) and card-plain.txt in plain ASCII, each pointing to the other');
  const p404 = readFileSync(`${dist}404.html`, 'utf8');
  await api.send('Page.navigate', { url: api.PAGE.replace(/index\.html.*$/, '404.html') });
  await sleep(900);
  const f404 = await api.eval(`({h1: document.querySelector('h1').textContent, bg: getComputedStyle(document.body).backgroundColor, w: getComputedStyle(document.querySelector('h1')).fontWeight, links: [...document.querySelectorAll('a')].map(a => a.getAttribute('href')), csp: window.__csp.length})`);
  ok(/<title>Lost in space · /.test(p404) && p404.includes('迷失在太空') && !/<script/i.test(p404) && /Content-Security-Policy" content="default-src 'none'; style-src 'sha256-/.test(p404)
    && f404.h1 === 'Lost in space' && f404.bg === 'rgb(8, 9, 12)' && f404.w === '700' && f404.links.join(' ') === '/ /#home' && f404.csp === 0,
  '#116 404.html, "Lost in space" in both languages: back to the home page or to the projects; no script, nothing from the network, its style allowed by its own Content Security Policy', JSON.stringify(f404));
  ok(/^<!doctype html>\n<!--\n {2}Hello, source reader\./.test(html6) && /Leave me a note: https:\/\/glacieerr\.github\.io\/#guestbook\n-->/.test(html6),
    '#148 the page source opens with a note for whoever reads it, ending with the guestbook\'s address');

  // ---------------- #152 a greeting by the visitor's time, #114 their time beside Albany's
  const zoneHM = (tz) => { const o = {}; for (const x of new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', hour: 'numeric', minute: '2-digit' }).formatToParts(new Date())) o[x.type] = x.value; return { h: Number(o.hour) % 24, m: Number(o.minute) }; };
  const offMin = (tz) => { const o = {}; for (const x of new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date())) o[x.type] = x.value; return (Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour % 24, +o.minute) - Math.floor(Date.now() / 60000) * 60000) / 60000; };
  const hrs = (offMin('Asia/Shanghai') - offMin('America/New_York')) / 60;
  const word = (h, zh) => (h < 5 ? (zh ? '你好' : 'Hello') : h < 12 ? (zh ? '早上好' : 'Good morning') : h < 18 ? (zh ? '下午好' : 'Good afternoon') : (zh ? '晚上好' : 'Good evening'));
  const t12 = (p, zh) => (zh ? `${p.h < 12 ? '上午' : '下午'} ${p.h % 12 || 12}:${String(p.m).padStart(2, '0')}` : `${p.h % 12 || 12}:${String(p.m).padStart(2, '0')} ${p.h < 12 ? 'AM' : 'PM'}`);
  const wantGreet = (zh) => { const p = zoneHM('Asia/Shanghai'); return zh ? `${word(p.h, true)} · 你那里是${t12(p, true)}，比奥尔巴尼快 ${hrs} 小时` : `${word(p.h)} · it's ${t12(p)} where you are, ${hrs} hr ahead of Albany`; };
  await api.send('Emulation.setTimezoneOverride', { timezoneId: 'America/New_York' });
  await api.go('?lang=en', 900);
  const gNY = await api.eval(`[document.getElementById('greet').hidden, document.getElementById('greet').textContent]`);
  const pNY = zoneHM('America/New_York');
  await api.go('?lang=en#home/contact', 900);
  const yNY = await api.eval(`document.querySelectorAll('[data-live="yours"]').length`);
  await api.send('Emulation.setTimezoneOverride', { timezoneId: 'Asia/Shanghai' });
  const wA = [wantGreet(false), wantGreet(true)];
  await api.go('?lang=en', 900);
  const gSH = await text('#greet');
  await api.go('?lang=zh', 900);
  const gZH = await text('#greet');
  await api.go('?lang=en#home/contact', 900);
  const ySH = await api.eval(`(() => { const v = document.querySelector('[data-live="yours"]'); return v ? [v.closest('.tv-row').querySelector('.tv-l').textContent, v.textContent] : null; })()`);
  const wB = [wantGreet(false), wantGreet(true)];
  const pSH = zoneHM('Asia/Shanghai');
  await api.send('Emulation.setTimezoneOverride', { timezoneId: '' });
  ok(!gNY[0] && gNY[1] === word(pNY.h) && yNY === 0 && hrs === Math.round(hrs * 2) / 2 && hrs > 0
    && [wA[0], wB[0]].includes(gSH) && [wA[1], wB[1]].includes(gZH)
    && ySH && ySH[0] === 'your time' && [`${t12(zoneHM('Asia/Shanghai'))}, ${hrs} hr ahead of Albany`, `${t12(pSH)}, ${hrs} hr ahead of Albany`].includes(ySH[1]),
  `#152 #114 the lock screen greets by the visitor's own clock; in Albany's zone that is all, in Shanghai it adds their time, ${hrs} hr ahead (English and 中文), and Contact shows it under Albany's`, JSON.stringify([gNY, yNY, gSH, gZH, ySH]));

  // ---------------- #115 About this site, #176 privacy, #122 accessibility, #147 the design drafts
  await api.go('?lang=en', 900);
  await api.eval(`document.activeElement.blur()`);
  await api.key('i');
  await sleep(450);
  const ab = await api.eval(`(() => ({open: document.getElementById('ab').classList.contains('open'), focus: document.activeElement.id, modal: document.getElementById('abPanel').getAttribute('aria-modal'), lockInert: document.getElementById('lock').inert,
    nums: Object.fromEntries([...document.querySelectorAll('#abNums .ab-num')].map((n) => [n.dataset.k, n.querySelector('.ab-v').textContent])),
    rows: Object.fromEntries([...document.querySelectorAll('#abAstro tbody tr')].map((r) => [r.dataset.k, [...r.querySelectorAll('td')].map((td) => td.textContent)])),
    foot: (document.querySelector('#abAstro .ab-foot') || {}).textContent, privacy: [...document.querySelectorAll('#abPrivacy li')].map((l) => l.textContent), a11y: document.querySelectorAll('#abA11y li').length,
    drafts: [...document.querySelectorAll('#abDrafts .ab-draft')].map((d) => [d.dataset.k, d.querySelector('.ab-shot').getAttribute('aria-label')])}))()`);
  const bytes = Buffer.byteLength(html6);
  const lastRun = existsSync(`${repo6}pages/tests/last-run.json`) ? JSON.parse(readFileSync(`${repo6}pages/tests/last-run.json`, 'utf8')) : null;
  const builtISO = (sitemap.match(/<lastmod>(.*?)<\/lastmod>/) || [])[1];
  ok(ab.open && ab.focus === 'abTitle' && ab.modal === 'true' && ab.lockInert
    && ab.nums.size === `${Math.round(bytes / 1024).toLocaleString('en-US')} KB` && ab.nums.requests === '0'
    && ab.nums.built === fmtISO(builtISO, { month: 'short', day: 'numeric', year: 'numeric' })
    && (lastRun ? ab.nums.checks === lastRun.passed.toLocaleString('en-US') : !('checks' in ab.nums)),
  `#115 I opens "About this site": the page's size as the build measured it (${Math.round(bytes / 1024)} KB), 0 requests, the checks of the last full run, the day it was built`, JSON.stringify([ab.nums, bytes, lastRun]));
  const chk = execFileSync('node', ['scripts/check_astro.mjs'], { cwd: repo6, encoding: 'utf8' });
  const lines = [...chk.matchAll(/^(ok |BAD)\s+(.+?)\s+max ([\d.]+)( ?°| km| min| h)\s+\(limit ([\d.]+)/gm)].map((m) => ({ label: m[2], err: +m[3] }));
  const worst = (f) => Math.max(...lines.filter((l) => f(l.label)).map((l) => l.err));
  const sat = worst((l) => /heliocentric longitude · saturn/.test(l));
  const rs = worst((l) => /^rise\/set/.test(l));
  const ph = worst((l) => /^new\/full Moon/.test(l));
  const refDate = JSON.parse(readFileSync(`${repo6}scripts/astro-reference.json`, 'utf8')).source.match(/\d{4}-\d{2}-\d{2}/)[0];
  ok(Object.keys(ab.rows).length === 9 && ab.rows.saturn[0] === `${sat.toFixed(3)}°` && ab.rows.saturn[1] === '0.2°' && ab.rows.riseSet[0] === `${rs.toFixed(1)} min` && ab.rows.phases[0] === `${ph.toFixed(2)} h`
    && ab.foot.startsWith(`Reference values fetched from JPL Horizons on ${fmtISO(refDate, { month: 'long', day: 'numeric', year: 'numeric' })}, for 8 dates from 1990 to 2049`)
    && ab.foot.includes(`${lines.length} of ${lines.length} checks within their limits`),
  `#115 the table against NASA JPL is check_astro.mjs's own result (Saturn ${sat.toFixed(3)}°, rise and set ${rs.toFixed(1)} min, Moon phases ${ph.toFixed(2)} h; ${lines.length} checks)`, JSON.stringify([ab.rows, ab.foot]));
  const drImg = await api.eval(`(async () => { const out = []; for (const d of document.querySelectorAll('#abDrafts .ab-shot')) { const m = getComputedStyle(d).backgroundImage.match(/url\\("?(data:image\\/(?:jpeg|webp)[^")]+)"?\\)/); if (!m) { out.push(null); continue; } const i = new Image(); i.src = m[1]; await i.decode(); out.push([i.naturalWidth, i.naturalHeight]); } return out; })()`);
  ok(ab.privacy.length === 6 && ab.privacy[0] === 'This site sets no cookies and counts no visitors.' && ab.privacy[4].includes('giscus.app') && ab.a11y === 4
    && ab.drafts.map((d) => d[0]).join(',') === 'phone,dusk,avatar,sky' && ab.drafts.every((d) => /^Design draft, November 1[34], 2026: /.test(d[1]))
    && drImg.length === 4 && drImg.every((x) => x && x[0] === 320 && x[1] === 200),
  '#176 #122 #147 the panel also has the privacy note (6 lines), the accessibility note (4) and four design drafts, small inline pictures (320 x 200, WebP since batch 6) each labelled as a draft with its day', JSON.stringify([ab.privacy.length, ab.a11y, ab.drafts, drImg]));
  await api.key('Escape');
  await sleep(400);
  const abClosed = await api.eval(`[document.getElementById('ab').classList.contains('open'), document.getElementById('lock').inert]`);
  await api.go('?lang=zh', 700);
  await api.eval(`document.activeElement.blur()`);
  await api.key('k', { meta: true });
  await sleep(350);
  await api.eval(`(() => { const i = document.getElementById('spotInput'); i.value = '关于'; i.dispatchEvent(new Event('input', {bubbles: true})); })()`);
  await sleep(150);
  const sa = await api.eval(`(() => { const r = document.querySelector('#spotList .sp-row'); return r ? [r.dataset.site, r.querySelector('.sp-t').textContent] : null; })()`);
  await api.key('Enter');
  await sleep(500);
  const sa2 = await api.eval(`[document.getElementById('ab').classList.contains('open'), document.getElementById('abTitle').textContent, document.activeElement.id, !!document.querySelector('#abAstro')]`);
  ok(!abClosed[0] && !abClosed[1] && sa && sa[0] === 'about' && sa[1] === '关于本站' && sa2[0] && sa2[1] === '关于本站' && sa2[2] === 'abTitle' && sa2[3],
    '#115 Esc closes it; typing "关于" (about) in Search offers it first and Enter opens it, in Chinese', JSON.stringify([abClosed, sa, sa2]));

  // ---------------- #118 standby
  await api.eval(`localStorage.removeItem('ls7-standby')`);
  await api.go('?lang=en&standby=2', 600);
  await api.eval(`document.activeElement.blur()`);
  await until(`document.getElementById('standby').classList.contains('open')`, 5000);
  const sb = await api.eval(`({open: document.getElementById('standby').classList.contains('open'), focus: document.activeElement.id, modal: document.getElementById('standby').getAttribute('aria-modal'), hm: document.getElementById('stbHm').textContent, lockHm: document.getElementById('hm').textContent, ap: document.getElementById('stbAp').textContent, planets: document.querySelectorAll('#stbOrbit [data-o]').length, lockInert: document.getElementById('lock').inert, t1: (document.querySelector('#stbOrbit [data-o="0"]') || {getAttribute: () => ''}).getAttribute('transform')})`);
  await sleep(500);
  const sbT2 = await api.eval(`(document.querySelector('#stbOrbit [data-o="0"]') || {getAttribute: () => ''}).getAttribute('transform')`);
  await api.key('n');
  await sleep(600);
  const sbOut = await api.eval(`({open: document.getElementById('standby').classList.contains('open'), nc: document.getElementById('nc').classList.contains('open')})`);
  ok(sb.open && sb.focus === 'standby' && sb.modal === 'true' && /^\d{1,2}:\d{2}$/.test(sb.hm) && sb.hm === sb.lockHm && /^(AM|PM)$/.test(sb.ap) && sb.planets >= 8 && sb.lockInert && sb.t1 && sb.t1 !== sbT2
    && !sbOut.open && !sbOut.nc,
  '#118 standby after the idle time (?standby=2 here; a minute once switched on): the Albany clock large with the planets turning; a key brings the page back and does nothing else (N did not open Today)', JSON.stringify([sb, sbT2, sbOut]));
  await api.go('?lang=en&standby=1&motion=reduce', 600);
  await sleep(2600);
  const sbRed = await api.eval(`document.getElementById('standby').classList.contains('open')`);
  await api.go('?lang=en&open=cc', 800);
  const sw0 = await api.eval(`document.getElementById('ccStandby').getAttribute('aria-pressed')`);
  await clickOn('#ccStandby');
  await sleep(200);
  const sw1 = await api.eval(`[document.getElementById('ccStandby').getAttribute('aria-pressed'), localStorage.getItem('ls7-standby')]`);
  await clickOn('#ccStandby');
  await sleep(200);
  const sw2 = await api.eval(`[document.getElementById('ccStandby').getAttribute('aria-pressed'), localStorage.getItem('ls7-standby')]`);
  await api.go('?lang=en', 700);
  await api.eval(`document.activeElement.blur()`);
  await api.key('k', { meta: true });
  await sleep(350);
  await api.type('>standby');
  await sleep(150);
  await api.key('Enter');
  await sleep(900);
  const sc1 = await api.eval(`document.getElementById('standby').classList.contains('open')`);
  await api.move(300, 300);
  await sleep(60);
  await api.move(420, 380);
  await sleep(600);
  const sc2 = await api.eval(`[document.getElementById('standby').classList.contains('open'), document.getElementById('lock').inert]`);
  ok(!sbRed && sw0 === 'false' && sw1[0] === 'true' && sw1[1] === 'on' && sw2[0] === 'false' && sw2[1] === 'off' && sc1 && !sc2[0] && !sc2[1],
    '#118 never on its own with reduced motion; off until Quick settings switches it on (remembered); ">standby" starts it at once and moving the mouse ends it', JSON.stringify([sbRed, sw0, sw1, sw2, sc1, sc2]));

  // ---------------- #119 the first-visit tour
  await api.eval(`sessionStorage.setItem('pages-test-tour', '1'); localStorage.removeItem('ls7-tour')`);
  await api.go('?lang=en', 300);
  const tr0 = await api.eval(`document.getElementById('tour').hidden`);
  await until(`!document.getElementById('tour').hidden`, 4000);
  const tr1 = await api.eval(`({hidden: document.getElementById('tour').hidden, step: document.getElementById('tourStep').textContent, title: document.getElementById('tourTitle').textContent, modal: document.getElementById('tour').getAttribute('aria-modal'), role: document.getElementById('tour').getAttribute('role'), live: document.getElementById('tourLive').textContent, focus: document.activeElement.tagName, next: document.getElementById('tourNext').textContent})`);
  await clickOn('#tourNext');
  await sleep(250);
  const tr2 = await api.eval(`[document.getElementById('tourStep').textContent, document.getElementById('tourTitle').textContent, document.activeElement.id]`);
  await clickOn('#tourNext');
  await sleep(250);
  const tr3 = await api.eval(`[document.getElementById('tourStep').textContent, document.getElementById('tourText').textContent, document.getElementById('tourNext').textContent, document.getElementById('tourSkip').hidden]`);
  await clickOn('#tourNext');
  await sleep(250);
  const tr4 = await api.eval(`[document.getElementById('tour').hidden, localStorage.getItem('ls7-tour'), document.activeElement.id]`);
  await api.go('?lang=en', 1800);
  const tr5 = await api.eval(`document.getElementById('tour').hidden`);
  await api.go('?lang=zh&tour=1', 300);
  await until(`!document.getElementById('tour').hidden`, 4000);
  const tr6 = await api.eval(`[document.getElementById('tour').hidden, document.getElementById('tourTitle').textContent]`);
  await api.key('Escape');
  await sleep(200);
  const tr7 = await api.eval(`[document.getElementById('tour').hidden, document.activeElement.id]`);
  await api.eval(`sessionStorage.removeItem('pages-test-tour')`);
  ok(tr0 && !tr1.hidden && tr1.step === '1 of 3' && tr1.title === 'Unlock the rest' && tr1.modal === 'false' && tr1.role === 'dialog' && tr1.focus === 'BODY' && /^Tip 1 of 3: Unlock the rest\. /.test(tr1.live) && tr1.next === 'Next'
    && tr2[0] === '2 of 3' && tr2[1] === 'The planets are buttons' && tr2[2] === 'tourNext'
    && tr3[0] === '3 of 3' && /^(⌘K|Ctrl K) searches apps, projects, skills and facts\./.test(tr3[1]) && tr3[2] === 'Got it' && tr3[3]
    && tr4[0] && tr4[1] === 'done' && tr4[2] === 'unlock' && tr5 && !tr6[0] && tr6[1] === '解锁其余内容' && tr7[0] && tr7[1] === 'unlock',
  '#119 a first visit gets a three-step tour (unlock, the planets, Search) that takes no focus until used and is announced once; seen once, never again; ?tour=1 shows it again and Esc ends it', JSON.stringify([tr0, tr1, tr2, tr3, tr4, tr5, tr6, tr7]));

  // ---------------- #148 the way to the guestbook
  await api.go('?lang=en#home', 900);
  await clickOn('.app[data-app="guestbook"] .ico');
  await sleep(900);
  const gb1 = await api.eval(`[document.getElementById('appView').dataset.app, document.activeElement.id, location.hash, document.querySelector('.app[data-app="guestbook"] .lbl').textContent]`);
  await api.go('?lang=zh#guestbook', 1200);
  const gb2 = await api.eval(`[document.getElementById('appView').dataset.app, document.activeElement.id, document.getElementById('gbHead').textContent, document.body.dataset.view]`);
  await api.go('?lang=en&open=spotlight&q=guestbook', 800);
  const gb3 = await api.eval(`(() => { const r = document.querySelector('#spotList .sp-row'); return r ? [r.dataset.app, r.querySelector('.sp-t').textContent] : null; })()`);
  const greetLog = api.consoleMsgs.some((m) => m === 'log: Hello from Canyuan. This page is one file that loads nothing from the network until you open the guestbook. How it is built: https://github.com/Glacieerr/Glacieerr');
  const noteLog = api.consoleMsgs.some((m) => /^log: Leave me a note: (⌘K|Ctrl K) → Guestbook$/.test(m)) && api.consoleMsgs.some((m) => /^log: 想留言：(⌘K|Ctrl K) → Guestbook$/.test(m));
  ok(gb1[0] === 'contact' && gb1[1] === 'gbHead' && gb1[2] === '#home/contact' && gb1[3] === 'Guestbook' && gb2[0] === 'contact' && gb2[1] === 'gbHead' && gb2[2] === '留言簿' && gb2[3] === 'home'
    && gb3 && gb3[0] === 'guestbook' && gb3[1] === 'Guestbook' && greetLog && noteLog,
  '#148 the guestbook is one step away: the Guestbook tile, the address #guestbook (for the README) and Search open it; the console says hello, then "Leave me a note: ⌘K → Guestbook"', JSON.stringify([gb1, gb2, gb3, greetLog, noteLog]));

  // ---------------- #120 the QR code, #151 sharing
  await api.go('?lang=en#home/contact', 1000);
  const qr = await api.eval(`(async () => { const svg = document.getElementById('qrCode'); let decoded = null; if ('BarcodeDetector' in window) { try { const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg).replace('<svg', '<svg width="370" height="370"')); await img.decode(); const cv = document.createElement('canvas'); cv.width = 370; cv.height = 370; cv.getContext('2d').drawImage(img, 0, 0, 370, 370); const r = await new BarcodeDetector({formats: ['qr_code']}).detect(cv); decoded = r[0] ? r[0].rawValue : ''; } catch (e) { decoded = 'error: ' + e.message; } } return {vb: svg.getAttribute('viewBox'), label: svg.getAttribute('aria-label'), role: svg.getAttribute('role'), d: svg.querySelector('.qr-m').getAttribute('d'), url: document.querySelector('.qr-url').textContent, decoded}; })()`);
  ok(qr.vb === `0 0 ${D.qr.n} ${D.qr.n}` && qr.d === D.qr.path && D.qr.url === profile.links.pages && qr.label === `QR code for ${profile.links.pages}` && qr.role === 'img' && qr.url === 'glacieerr.github.io'
    && (qr.decoded === null || qr.decoded === profile.links.pages),
  `#120 Contact has a QR code that holds only the page's address (live/qr.mjs, drawn at build time), dark on white${qr.decoded ? `; this browser reads it back as ${qr.decoded}` : ''}`, JSON.stringify(qr));
  const noShare = await api.send('Page.addScriptToEvaluateOnNewDocument', { source: 'try { delete Navigator.prototype.share; delete Navigator.prototype.canShare; } catch (e) {}' });
  await api.go('?lang=en#home/contact', 900);
  await api.eval(stubDownloads);
  const b0 = (await text('#ctShare')).trim();
  await clickOn('#ctShare');
  await sleep(250);
  const c0 = await api.eval(`[window.__copied, document.getElementById('ctShareNote').textContent]`);
  await api.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: noShare.identifier });
  const fakeShare = await api.send('Page.addScriptToEvaluateOnNewDocument', { source: 'Navigator.prototype.share = function (d) { window.__shared = d; return Promise.resolve(); };' });
  await api.go('?lang=en#home/contact', 900);
  const b1 = (await text('#ctShare')).trim();
  await clickOn('#ctShare');
  await sleep(200);
  const s1 = await api.eval(`window.__shared || null`);
  await api.go('?lang=en#sky/tokyo/2026-11-14/21:30', 1300);
  const skyShare = await api.eval(`!!document.getElementById('skyShare')`);
  if (skyShare) await clickOn('#skyShare');
  await sleep(200);
  const s2 = await api.eval(`window.__shared || null`);
  await api.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: fakeShare.identifier });
  ok(b0 === 'Copy link' && c0[0] === profile.links.pages && c0[1] === 'Link copied.' && b1 === 'Share' && s1 && s1.url === profile.links.pages && s1.title === `${profile.name} ${profile.name_zh}`
    && skyShare && s2 && /index\.html#sky\/tokyo\/2026-11-14\/21:30$/.test(s2.url) && s2.title === 'The sky over Tokyo',
  '#151 where the browser has a share sheet, Contact shares the page and the Sky shares its place, date and time; without one the button copies the link and says so', JSON.stringify([b0, c0, b1, s1, skyShare, s2]));

  // ---------------- #146 the design rules
  const lumN = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const crN = (a, b) => { const [x, y] = [lumN(a), lumN(b)].sort((p, q) => q - p); return ((x + 0.05) / (y + 0.05)).toFixed(1); };
  const dsRead = `(() => { const cs = getComputedStyle(document.documentElement); return {sw: [...document.querySelectorAll('.ds-sw')].map((li) => [li.dataset.var, li.querySelector('.ds-hex').textContent, (li.querySelector('.ds-cr') || {}).textContent || '', cs.getPropertyValue('--' + li.dataset.var).trim().toLowerCase()]), heads: [...document.querySelectorAll('#appBody .tv-head')].map((h) => h.textContent), why: document.querySelectorAll('.ds-why').length}; })()`;
  const dsGood = (ds) => { const bg = ds.sw.find((x) => x[0] === 'bg')[3]; return ds.sw.length === 8 && ds.sw.every(([k, shown, cr, cssv]) => shown === cssv && (['bg', 'bg2'].includes(k) ? cr === '' : cr === `${crN(cssv, bg)}:1 on the page`)); };
  await api.go('?lang=en#home/design', 1000);
  const dsD = await api.eval(dsRead);
  await clickOn('#dsPlay');
  await sleep(60);
  const anims = await api.eval(`document.getElementById('dsTile').getAnimations().length + document.getElementById('dsDot').getAnimations().length`);
  await api.go('?lang=en&appearance=light#home/design', 1000);
  const dsL = await api.eval(dsRead);
  ok(dsGood(dsD) && dsGood(dsL) && dsD.sw[0][1] === '#08090c' && dsL.sw[0][1] === '#ffffff' && dsD.heads.join('|') === 'Color|Type|Shape|Cards|Buttons|Icons|Motion' && dsD.why === 7 && anims >= 2,
    '#146 the design rules, drawn with the page\'s own styles: each colour read back from the stylesheet (dark and light) with its contrast on the page worked out, a reason under every rule, the launch motion on Play', JSON.stringify([dsD.sw, dsL.sw, anims]));

  // ---------------- #153 #160 #161 #171: shown once they exist (and in a preview build)
  // Uses and the reply time were confirmed by the user on 2026-11-15; Uses names "Android Studio",
  // the one way the page may name Android (the user's call, 2026-11-15)
  const pageSafe = (x) => !/\biOS\b(?! \d)/.test(x) && !/android/i.test(x.replaceAll('Android Studio', ''));
  const usesN = profile.uses.groups.reduce((a, g) => a + g.items.filter(pageSafe).length, 0);
  await api.go('?lang=en#home/uses', 900);
  const u0 = await api.eval(`({view: document.body.dataset.view, app: document.getElementById('appLayer').hidden ? null : document.getElementById('appView').dataset.app, link: !!document.querySelector('.site-link[data-app="uses"]'),
    heads: [...document.querySelectorAll('#appBody .tv-head')].map((h) => h.textContent), chips: [...document.querySelectorAll('.uses-chips li')].map((li) => li.textContent), note: document.querySelectorAll('#appBody .preview-note').length})`);
  await api.go('?lang=en#home/contact', 900);
  const c6 = await api.eval(`(() => { const r = document.querySelector('#appBody .ct-reply'); const sec = r && r.closest('.tv-sec');
    return [!!document.getElementById('booking'), !!document.getElementById('testimonials'), r ? r.textContent : '', sec ? sec.querySelector('.tv-head').textContent : '', document.querySelectorAll('#appBody .preview-note').length]; })()`);
  await api.go('?lang=zh#home/contact', 900);
  const c6z = await api.eval(`(document.querySelector('#appBody .ct-reply') || {}).textContent || ''`);
  await api.go('?lang=en#home/silnest', 900);
  const n6 = await api.eval(`[...document.querySelectorAll('#appBody .tv-head')].map((h) => h.textContent)`);
  ok(u0.view === 'home' && u0.app === 'uses' && u0.link && D.apps.includes('uses') && D.uses && D.uses.draft === false
    && u0.heads.join('|') === profile.uses.groups.map((g) => g.en).join('|') && u0.chips.length === usesN && ['Xcode', 'Android Studio', 'VS Code', 'Cursor'].every((x) => u0.chips.includes(x))
    && !u0.chips.some((x) => /android/i.test(x.replaceAll('Android Studio', ''))) && u0.note === 0
    && !c6[0] && !c6[1] && c6[2] === profile.booking.reply_en && c6[3] === 'Say hi' && c6[4] === 0 && c6z === profile.booking.reply_zh
    && !n6.includes("What's new") && D.booking && D.booking.button === false && D.booking.replyDraft === false && D.testimonials === null && D.releaseNotes === null && D.preview === false,
  '#153 #160 #161 #171 confirmed on 2026-11-15, so shown: Uses (with Xcode, Android Studio, VS Code and Cursor) and how soon I reply, under "Say hi" (English and 中文); still not set up: no booking link, no testimonials or form, and SilNest 1.0 has no release notes',
  JSON.stringify([u0, c6, c6z]));
  const tmp6 = mkdtempSync(join(tmpdir(), 'pages-batch2-'));
  const prevFile = join(tmp6, 'preview.html');
  execFileSync('python3', ['pages/build.py', '--preview', '--out', prevFile], { cwd: repo6, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const storeFix = join(tmp6, 'store.json');
  const st0 = JSON.parse(readFileSync(`${repo6}data/silnest-store.json`, 'utf8'));
  writeFileSync(storeFix, JSON.stringify({ ...st0, version: '1.1', releaseNotes: { version: '1.1', date: '2026-12-01', text: 'Lyrics line up better – and faster.\nA new sleep timer.' } }));
  const notesFile = join(tmp6, 'notes.html');
  execFileSync('python3', ['pages/build.py', '--store', storeFix, '--out', notesFile], { cwd: repo6, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  await goFile(prevFile, '?lang=en#home/contact', 1100);
  const pv = await api.eval(`(() => { const b = document.getElementById('booking'); const t = document.getElementById('testimonials'); const badge = document.getElementById('previewBadge'); return {badge: badge.hidden ? null : badge.textContent,
    book: b && [b.querySelector('.btn').disabled, b.querySelector('.btn').textContent, (b.querySelector('.book-reply') || {}).textContent, [...b.querySelectorAll('.preview-note')].map((n) => n.textContent)],
    tm: t && [t.querySelector('.tm-invite .tv-p').textContent, t.querySelector('.tm-row .btn').disabled, [...t.querySelectorAll('.preview-note')].map((n) => n.textContent), t.querySelectorAll('.tm').length],
    apps: JSON.parse(document.getElementById('data').textContent).apps}; })()`);
  await goFile(prevFile, '?lang=en#home/uses', 1000);
  const pu = await api.eval(`({app: document.getElementById('appView').dataset.app, heads: [...document.querySelectorAll('#appBody .tv-head')].map((h) => h.textContent), chips: document.querySelectorAll('.uses-chips li').length, draft: (document.querySelector('#appBody .preview-note') || {}).textContent || ''})`);
  await goFile(prevFile, '?lang=en#home/silnest', 1000);
  const pn = await api.eval(`[...document.querySelectorAll('#appBody .preview-note')].map((n) => n.textContent)`);
  await goFile(prevFile, '?lang=en#home/how', 1000);
  const pvHow = await api.eval(`[document.querySelectorAll('#change .ch-step').length, [...document.querySelectorAll('#appBody .preview-note')].map((n) => n.textContent)]`);
  await goFile(prevFile, '?lang=en#home/contact', 1000);
  const pvReply = await api.eval(`[(document.querySelector('#appBody .ct-reply') || {}).textContent || '', [...document.querySelectorAll('#appBody .preview-note')].map((n) => n.textContent)]`);
  ok(pv.badge === 'Preview build: do not publish' && pv.book && pv.book[0] === true && pv.book[1] === 'Book a time' && pv.book[2] == null
    && pv.book[3].length === 1 && pv.book[3][0].includes('booking.url')
    && pv.tm && pv.tm[0].startsWith('Used SilNest, or worked with me?') && pv.tm[1] === true && pv.tm[2].some((x) => x.includes('testimonials.form_url')) && pv.tm[3] === 0
    && pv.apps.includes('uses') && pu.app === 'uses' && pu.heads.join('|') === profile.uses.groups.map((g) => g.en).join('|') && pu.chips === usesN && pu.draft === ''
    && pvHow[0] === 5 && pvHow[1].length === 0 && pvReply[0] === profile.booking.reply_en && !pvReply[1].some((x) => /draft/.test(x))
    && pn.some((x) => x.includes('Version 1.0 has none')),
  'pages/build.py --preview shows what is not set up yet, each labelled: the booking button (no link yet), the testimonial invite (no form yet) and where release notes will go; the page says it is a preview. What the user confirmed on 2026-11-15 carries no draft label there: Uses, how soon I reply, the change in five steps', JSON.stringify([pv, pu, pn, pvHow, pvReply]));
  await goFile(notesFile, '?lang=en#home/silnest', 1000);
  const rn = await api.eval(`(() => { const s = [...document.querySelectorAll('#appBody .tv-sec')].find((x) => (x.querySelector('.tv-head') || {}).textContent === "What's new"); return s ? {sub: s.querySelector('.rn-sub').textContent, ps: [...s.querySelectorAll('.rn-p')].map((p) => p.textContent)} : null; })()`);
  ok(rn && rn.sub === 'Version 1.1 · December 1, 2026' && rn.ps.join('|') === 'Lyrics line up better - and faster.|A new sleep timer.' && !/[–—]/.test(readFileSync(notesFile, 'utf8')),
    '#171 once the App Store lists release notes, the SilNest page shows them with the version and the date (a dash in them becomes a hyphen)', JSON.stringify(rn));
  rmSync(tmp6, { recursive: true, force: true });

  // ---------------- #172 assets, #145 #172 wallpapers
  await api.eval(`localStorage.removeItem('ls7-wp-centre')`);
  await api.go('?lang=en#home/assets', 1300);
  // the wide screenshots (Storewright's) stay inside their own columns: without a width, the stretched row
  // once sized them from their height, 443 px in a 356 px column, so they overlapped and ran past the card
  const asCols = await api.eval(`[...document.querySelectorAll('.as-wide .as-fig')].map((f) => { const a = f.getBoundingClientRect(), b = f.firstElementChild.getBoundingClientRect(); return [Math.round(a.left), Math.round(a.right), Math.round(b.left), Math.round(b.right)]; })`);
  ok(asCols.length === 2 && asCols.every(([l, r, il, ir]) => il >= l - 1 && ir <= r + 1) && asCols[0][1] <= asCols[1][0],
    "#172 at 1440 px Storewright's two screenshots each stay inside their own column, side by side, without overlapping", JSON.stringify(asCols));
  await api.eval(stubDownloads);
  const reqA = api.requests.length;
  await clickOn('[data-dl="sn-icon"]');
  await sleep(250);
  await clickOn('[data-dl="sw-icon"]');
  await until('window.__blobs.length >= 2', 4000);
  await clickOn('[data-copy="asSwLine"]');
  await sleep(250);
  const as1 = await api.eval(`(async () => { const out = []; for (const b of window.__blobs) { let wh = null; if (/^image\\//.test(b.type)) { const bm = await createImageBitmap(b); wh = [bm.width, bm.height]; } out.push([b.type, b.size, wh]); } return {blobs: out, clicks: window.__clicks, copied: window.__copied, msg: [...document.querySelectorAll('.as-msg')].map((m) => m.textContent)}; })()`);
  const iconBytes = readFileSync(`${repo6}assets/src/silnest-icon-512.jpg`).length;
  ok(as1.blobs[0] && as1.blobs[0][0] === 'image/jpeg' && as1.blobs[0][1] === iconBytes && as1.clicks[0][0] === 'silnest-icon-512.jpg' && as1.clicks[0][1] === 'blob:'
    && as1.blobs[1] && as1.blobs[1][0] === 'image/png' && as1.blobs[1][2].join('x') === '512x512' && as1.clicks[1][0] === 'storewright-icon-512.png'
    && as1.copied === D.copy.en.app.storewright.sub && as1.msg.includes('Saved silnest-icon-512.jpg.') && as1.msg.includes('Copied.'),
  '#172 the assets page: SilNest\'s icon saved byte for byte from the copy already in the page, Storewright\'s tile drawn as a 512 px PNG, the descriptions copied in the page\'s own words', JSON.stringify(as1));
  // #180 (batch 6): the page carries the screenshots as WebP; the file saved is still the JPEG its name says
  await api.eval(`window.__blobs = []; window.__clicks = []`);
  await clickOn('[data-dl="sw-demo"]');
  await until('window.__blobs.length >= 1', 4000);
  const asW = await api.eval(`(async () => { const b = window.__blobs[0]; const bm = b ? await createImageBitmap(b) : null; const u = getComputedStyle(document.querySelector('#appBody .img-sw-demo')).backgroundImage.slice(5, 26);
    return {type: b && b.type, wh: bm ? [bm.width, bm.height] : null, size: b && b.size, file: window.__clicks[0] && window.__clicks[0][0], inPage: u, msg: [...document.querySelectorAll('.as-msg')].map((m) => m.textContent).join(' ')}; })()`);
  ok(asW.type === 'image/jpeg' && asW.wh && asW.wh.join('x') === '960x600' && asW.size > 20000 && asW.file === 'storewright-showcase.jpg' && asW.inPage === 'data:image/webp;base6' && asW.msg.includes('Saved storewright-showcase.jpg.'),
    '#180 a screenshot the page carries as WebP is saved as the JPEG its name promises (storewright-showcase.jpg, 960 x 600)', JSON.stringify(asW));
  await api.eval(`document.getElementById('wpHead').scrollIntoView({block: 'start'})`);
  await sleep(250);
  const wp0 = await api.eval(`[document.querySelector('[data-wp="centre"][aria-checked="true"]').dataset.v, localStorage.getItem('ls7-wp-centre'), document.getElementById('wpTodayDims').textContent, document.getElementById('wpTodayCv').width > 0]`);
  await clickOn('[data-wp="centre"][data-v="avatar"]');
  await sleep(300);
  await api.eval(`window.__blobs = []; window.__clicks = []`);
  await clickOn('#wpTodayDl');
  await until('window.__blobs.length >= 1', 10000);
  await clickOn('[data-wp="today"][data-v="desktop"]');
  await sleep(300);
  await clickOn('#wpTodayDl');
  await until('window.__blobs.length >= 2', 15000);
  await clickOn('[data-wp="project"][data-v="silnest"]');
  await sleep(200);
  await clickOn('[data-wp="device"][data-v="tablet"]');
  await sleep(300);
  await clickOn('#wpProjDl');
  await until('window.__blobs.length >= 3', 10000);
  await clickOn('[data-wp="project"][data-v="storewright"]');
  await sleep(200);
  await clickOn('[data-wp="device"][data-v="desktop"]');
  await sleep(300);
  await clickOn('#wpProjDl');
  await until('window.__blobs.length >= 4', 15000);
  const today6 = (await albany()).iso;
  const wp = await api.eval(`(async () => { const out = []; for (const b of window.__blobs) { const bm = await createImageBitmap(b); const cv = document.createElement('canvas'); cv.width = 4; cv.height = 4; const g = cv.getContext('2d'); g.drawImage(bm, 0, 0, 4, 4, 0, 0, 4, 4); out.push({type: b.type, w: bm.width, h: bm.height, px: [...g.getImageData(0, 0, 1, 1).data].slice(0, 3)}); } return {out, names: window.__clicks.map((c) => c[0]), centre: localStorage.getItem('ls7-wp-centre'), note: document.getElementById('wpProjNote').textContent}; })()`);
  await api.eval(`document.querySelector('[data-wp="project"][aria-checked="true"]').focus()`);
  await api.key('ArrowLeft');
  await sleep(250);
  const kb = await api.eval(`[document.activeElement.dataset.v, document.activeElement.getAttribute('aria-checked')]`);
  await api.go('?lang=en#home/assets', 1000);
  const wpR = await api.eval(`document.querySelector('[data-wp="centre"][aria-checked="true"]').dataset.v`);
  await api.eval(`localStorage.removeItem('ls7-wp-centre')`);
  const sizes = wp.out.map((x) => `${x.w}x${x.h}`).join(',');
  ok(wp0[0] === 'sun' && wp0[1] === null && wp0[2] === '1179 × 2556' && wp0[3] && wp.centre === 'avatar' && wpR === 'avatar'
    && wp.out.length === 4 && wp.out.every((x) => x.type === 'image/png') && sizes === '1179x2556,3840x2160,2048x2732,3840x2160'
    && wp.out[0].px.join() === '8,9,12' && wp.out[2].px.join() === '16,16,18' && wp.out[3].px.join() === '244,245,242'
    && wp.names.join(',') === [`wallpaper-sky-${today6}-phone-1179x2556.png`, `wallpaper-sky-${today6}-desktop-3840x2160.png`, 'wallpaper-silnest-tablet-2048x2732.png', 'wallpaper-storewright-desktop-3840x2160.png'].join(',')
    && wp.note === 'Saved wallpaper-storewright-desktop-3840x2160.png.' && kb[0] === 'silnest' && kb[1] === 'true'
    && api.requests.slice(reqA).every((u) => /^(data|blob|file):/.test(u)),
  '#145 #172 wallpapers drawn in the browser: today\'s sky for a phone (1179 x 2556) and a desktop (3840 x 2160), the Sun in the middle by default or the avatar (remembered), and each project\'s colours (SilNest #101012 on a tablet, Storewright #f4f5f2 on a desktop); the choices work by keyboard; nothing fetched', JSON.stringify([wp0, wp, kb, wpR]));
  await api.go('?lang=en', 700);
  await api.eval(`document.activeElement.blur()`);
  await api.key('k', { meta: true });
  await sleep(350);
  await api.type('>wallpaper');
  await sleep(150);
  await api.key('Enter');
  await sleep(1300);
  const wc = await api.eval(`[document.getElementById('appView').dataset.app, document.activeElement.id]`);
  ok(wc[0] === 'assets' && wc[1] === 'wpHead', '#145 ">wallpaper" opens the assets page at the wallpapers', JSON.stringify(wc));

  // ---------------- #182 high contrast
  await api.go('?lang=en', 800);
  await api.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }, { name: 'prefers-reduced-motion', value: 'no-preference' }, { name: 'prefers-contrast', value: 'more' }] });
  await sleep(300);
  await api.eval(`document.activeElement.blur()`);
  await api.key('Tab');
  await sleep(200);
  const hc = await api.eval(`({fg2: getComputedStyle(document.documentElement).getPropertyValue('--fg2').trim(), glow: getComputedStyle(document.getElementById('wallMove')).display, ring: getComputedStyle(document.activeElement).outlineWidth, fill: getComputedStyle(document.getElementById('hm')).webkitTextFillColor})`);
  const hcC = (await contrastOf(api, '.subline') || {}).p05;
  await api.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }, { name: 'forced-colors', value: 'active' }] });
  await sleep(300);
  const fc = await api.eval(`({note: getComputedStyle(document.querySelector('.note')).borderTopStyle, wall: getComputedStyle(document.getElementById('wall')).display})`);
  await api.viewport(1440, 900, { dark: true });
  ok(hc.fg2 === '#d4d7dd' && hc.glow === 'none' && hc.ring === '3px' && hc.fill === 'rgb(247, 248, 248)' && hcC >= 7 && fc.note === 'solid' && fc.wall === 'none',
    '#182 increased contrast (the system setting): stronger text and lines, no glows, a solid clock and a 3 px focus ring; forced colours (Windows high contrast) get real borders', JSON.stringify([hc, hcC, fc]));

  // ---------------- contrast of the new words, both modes
  for (const mode of ['dark', 'light']) {
    const c = {};
    const at = async (sel) => { await api.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (e) e.scrollIntoView({block: 'center'}); })()`); await sleep(80); c[sel] = (await contrastOf(api, sel) || {}).p05; };
    await api.viewport(1440, 900, { dark: true });
    await api.send('Emulation.setTimezoneOverride', { timezoneId: 'Asia/Shanghai' });
    await api.go(`?lang=en&appearance=${mode}`, 900);
    await at('.greet');
    await api.go(`?lang=en&appearance=${mode}#home`, 900);
    await at('.site-link span');
    await api.go(`?lang=en&appearance=${mode}&open=about`, 900);
    for (const sel of ['.ab-p', '.ab-num .ab-n', '.ab-table td', '.ab-foot', '.ab-dt span', '.ab-dd']) await at(sel);
    await api.go(`?lang=en&appearance=${mode}#home/contact`, 900);
    for (const sel of ['.qr-note', '[data-live="yours"]']) await at(sel);
    await api.go(`?lang=en&appearance=${mode}#home/design`, 1000);
    for (const sel of ['.ds-hex', '.ds-cr', '.ds-note']) await at(sel);
    await api.go(`?lang=en&appearance=${mode}#home/assets`, 1000);
    for (const sel of ['.as-n', '.as-l', '.wp-sub', '.wp-dims']) await at(sel);
    await api.go(`?lang=en&appearance=${mode}&tour=1`, 300);
    await until(`!document.getElementById('tour').hidden`, 4000);
    await sleep(300);
    for (const sel of ['.tour-step', '.tour-text']) await at(sel);
    await api.go(`?lang=en&appearance=${mode}&standby=1`, 600);
    await until(`document.getElementById('standby').classList.contains('open')`, 4000);
    await sleep(600);
    for (const sel of ['.stb-where', '.stb-hint']) c[sel] = (await contrastOf(api, sel) || {}).p05;
    await api.send('Emulation.setTimezoneOverride', { timezoneId: '' });
    console.log('     contrast batch 2', mode, JSON.stringify(c));
    ok(Object.values(c).every((v) => v >= 4.5), `contrast of the batch 2 words on the ${mode} page (greeting, This site, About, QR note, your time, design, assets, tour, standby) >= 4.5:1`, JSON.stringify(c));
  }
  await api.viewport(1440, 900, { dark: true });

  // ---------------- #176 as the privacy note says, and no CSP violation anywhere above
  await api.go('?lang=en', 800);
  const priv = await api.eval(`({cookie: document.cookie, keys: Object.keys(localStorage), csp: window.__csp})`);
  ok(priv.cookie === '' && priv.keys.length > 0 && priv.keys.every((k) => k.startsWith('ls7-')) && priv.csp.length === 0,
    '#176 as the privacy note says: no cookie anywhere in this run, and everything in local storage is one of this site\'s settings (ls7-*)', JSON.stringify(priv));
  // ---------------- #175 the Content Security Policy (added last): what it says, and that the browser holds the page to it
  const cspM = html6.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  const csp = cspM ? cspM[1] : '';
  const dir = Object.fromEntries(csp.split(';').map((x) => x.trim()).filter(Boolean).map((x) => { const [k, ...v] = x.split(/\s+/); return [k, v.join(' ')]; }));
  const inlineScripts = [...html6.matchAll(/<script(?![^>]*type="application\/(?:ld\+)?json")[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const inlineStyles = [...html6.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
  const hashOf = (t) => `'sha256-${createHash('sha256').update(t, 'utf8').digest('base64')}'`;
  ok(csp && html6.indexOf('Content-Security-Policy') < html6.indexOf('<script') && html6.indexOf('Content-Security-Policy') < html6.indexOf('<style')
    && dir['default-src'] === "'none'" && dir['connect-src'] === "'none'" && dir['frame-src'] === 'https://giscus.app' && dir['img-src'] === 'data: blob:'
    && inlineScripts.length === 3 && dir['script-src'] === `${inlineScripts.map(hashOf).join(' ')} https://giscus.app`
    && (html6.match(/<script>/g) || []).length === 2 && (html6.match(/<script type="text\/plain" id="swSim">/g) || []).length === 1
    && html6.lastIndexOf('<script type="text/plain" id="swSim">') > html6.lastIndexOf('<style') && /<\/script>\s*<\/body>/.test(html6)
    && inlineStyles.length === 2 && dir['style-src-elem'] === inlineStyles.map(hashOf).join(' ') && dir['style-src-attr'] === "'unsafe-inline'"
    && html6.lastIndexOf('<style') > html6.lastIndexOf('<script>') && /\.img-sw-demo\{background-image:url\("data:image\/webp/.test(inlineStyles[1]) && !/data:image\/(webp|jpeg)/.test(inlineStyles[0])
    && !/unsafe-eval/.test(csp) && dir['object-src'] === "'none'" && dir['base-uri'] === "'none'" && dir['form-action'] === "'none'",
  '#175 a Content Security Policy heads the page: nothing from the network except giscus.app (the guestbook, after a click), each inline script and both stylesheets allowed by the hash of its text, no eval; #180 the photos (WebP) come in their own stylesheet after the page script, so a slow network shows the clock first; #169 last of all the What if lab\'s simulation, as text, its hash in the policy too', JSON.stringify(dir));
  await api.go('?lang=en', 800);
  const nReq = api.requests.length;
  const nMsg = api.consoleMsgs.length;
  const probe = await api.eval(`new Promise((res) => { const i = new Image(); i.onload = () => res('loaded'); i.onerror = () => res('blocked'); i.src = 'https://csp-probe.invalid/x.png'; setTimeout(() => res('timeout'), 3000); }).then(async (img) => { let conn = 'none'; try { await fetch('https://csp-probe.invalid/y'); conn = 'fetched'; } catch (e) { conn = 'refused'; } await new Promise((r) => setTimeout(r, 200)); return {img, conn, violations: window.__csp.slice()}; })`);
  const probeReqs = api.requests.splice(nReq);
  const probeMsgs = api.consoleMsgs.splice(nMsg);
  ok(probe.img === 'blocked' && probe.conn === 'refused' && probe.violations.some((v) => /^img-src https:\/\/csp-probe\.invalid/.test(v)) && probe.violations.some((v) => /^connect-src https:\/\/csp-probe\.invalid/.test(v)),
    '#175 the browser enforces it: an image or a fetch from elsewhere is refused before it leaves (a probe to a .invalid address; its two expected refusals are left out of the console check below)', JSON.stringify([probe, probeReqs.length, probeMsgs.length]));
  const copyEN = JSON.stringify(JSON.parse(readFileSync(`${repo6}pages/src/copy.json`, 'utf8')).en);
  ok(!/[“”’]/.test(copyEN) && !/\bround the Sun\b/.test(copyEN), 'the English copy uses straight quotes and US "around" (docs/copy-style.md)');
  }

  {
  console.log('---- part 7: R3.3 batch 3 (the work and recruiters: ideas #53 to #169)');
  const repo7 = fileURLToPath(new URL('../..', import.meta.url));
  const dist7 = `${repo7}pages/dist/`;
  const prof7 = JSON.parse(readFileSync(`${repo7}data/profile.json`, 'utf8'));
  const nums7 = JSON.parse(readFileSync(`${repo7}data/project-numbers.json`, 'utf8'));
  const game7 = JSON.parse(readFileSync(`${repo7}pages/src/storewright-small.json`, 'utf8'));
  const D7 = await (async () => { await api.viewport(1440, 900, { dark: true }); await api.go('?lang=en', 800); return data(); })();
  const until7 = async (expr, timeout = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < timeout) { if (await api.eval(expr)) return true; await sleep(150); } return false; };
  const clickEl = async (sel) => { await api.eval(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({block: 'center'})`); await sleep(80); const r = await rect(sel); await api.click(r.x, r.y); };
  const mon = (iso, y = true) => fmtISO(iso, y ? { month: 'short', year: 'numeric' } : { month: 'short' });

  // ---------------- #97 the sun glow takes the colour of Albany's sky, in the README's four steps
  const lsPy = readFileSync(`${repo7}scripts/lockscreen.py`, 'utf8');
  const tiers = [...(lsPy.match(/SUN_TIERS = \[([\s\S]*?)\]\n/) || ['', ''])[1].matchAll(/\((-?\d+|None),\s*"(#\w+)",\s*"(#\w+)"\)/g)].map((m) => [m[1] === 'None' ? Infinity : Number(m[1]), m[2], m[3]]);
  const tierAt = (t) => { const alt = Astro.observe('sun', t, 42.6526, -73.7562).alt; return tiers.findIndex((x) => alt < x[0]); };
  const NAMES = ['night', 'twilight', 'low', 'day'];
  const sunRead = `({sun: document.documentElement.dataset.sun, core: getComputedStyle(document.documentElement).getPropertyValue('--sun-core').trim(), stop: getComputedStyle(document.querySelector('#orbit .orbit-svg radialGradient[id$="sun"] stop')).stopColor, ring: getComputedStyle(document.querySelector('#orbit .orbit-svg radialGradient[id$="sun"] stop:nth-child(2)')).stopColor})`;
  const toRGB = (h) => `rgb(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)})`;
  await api.go('?lang=en', 900);
  const s0 = await api.eval(sunRead);
  const w0 = NAMES.indexOf(s0.sun);
  const w0ok = [tierAt(Date.now() - 90000), tierAt(Date.now())].includes(w0);
  const sunTT = [];
  for (const [v, mode] of [[720, 'dark'], [60, 'light']]) {
    await api.go(`?lang=en&appearance=${mode}&open=tt`, 900);
    await api.eval(`(() => { const r = document.getElementById('ttRange'); r.value = '${v}'; r.dispatchEvent(new Event('input', {bubbles: true})); })()`);
    await sleep(400);
    const at = await api.eval(`(() => { const o = {}; const p = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(new Date()); for (const x of p) o[x.type] = x.value; return o.year + '-' + o.month + '-' + o.day; })()`);
    sunTT.push([v, mode, at, await api.eval(sunRead)]);
  }
  const ttWant = sunTT.map(([v, mode, iso]) => { const [y, m, d] = iso.split('-').map(Number); return tierAt(Astro.zonedTime(y, m, d, Math.floor(v / 60), v % 60, 'America/New_York')); });
  ok(tiers.length === 4 && w0ok && s0.core === tiers[w0][1] && s0.stop === toRGB(tiers[w0][1])
    && sunTT[0][3].sun === NAMES[ttWant[0]] && ttWant[0] === 3 && sunTT[0][3].core === tiers[3][1]
    && sunTT[1][3].sun === NAMES[ttWant[1]] && ttWant[1] === 0 && sunTT[1][3].core === tiers[0][2] && sunTT[1][3].ring === toRGB(tiers[0][2]),
  `#97 the glow round the avatar takes Albany's sky now ("${s0.sun}", from the Sun's altitude in live/astro.mjs) in the README's four steps and colours (scripts/lockscreen.py SUN_TIERS), and follows time travel: noon is the white gold "day", 1 AM the faint violet "night" (light page)`, JSON.stringify([s0, sunTT, ttWant]));

  // ---------------- How I work: #53 FAQ, #156 one real change (confirmed 2026-11-15), #110 skill map, #111 timeline
  const howRead = `(() => { const svg = document.querySelector('#tl svg'); const tb = svg ? [...svg.querySelectorAll('text')].map((t) => t.getBBox()) : []; let overlap = 0;
    for (let i = 0; i < tb.length; i++) for (let j = i + 1; j < tb.length; j++) { const a = tb[i]; const b = tb[j]; if (a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5) overlap++; }
    return {
    faqHead: (document.querySelector('#faq .tv-head') || {}).textContent, faq: [...document.querySelectorAll('#faq .faq-pair')].map((p) => [p.querySelector('dt').textContent, p.querySelector('dd').textContent]),
    steps: [...document.querySelectorAll('#change .ch-step')].map((s) => [s.querySelector('.ch-k b').textContent, s.querySelector('a').href, s.querySelector('a').target]), draft: !!document.querySelector('#change .preview-note'), tvn: document.querySelectorAll('#appBody .tv-n').length,
    lanes: [...document.querySelectorAll('#skills .sk-head')].map((h) => h.textContent),
    stars: [...document.querySelectorAll('#skills .sk-star')].map((s) => [s.querySelector('.sk-name').textContent, s.querySelector('.sk-proj').textContent, s.classList.contains('top')]),
    lines: [...document.querySelectorAll('#skills .sk-lane')].map((l) => [l.querySelectorAll('.sk-star').length, (l.querySelector('.sk-lines path').getAttribute('d') || '').split('L').length]),
    tl: svg && [...svg.querySelectorAll('.tl-item')].map((g) => [g.dataset.project, g.querySelector('.tl-name').textContent, g.querySelector('.tl-when').textContent]),
    tlLabel: svg && svg.getAttribute('aria-label'), bar: !!(svg && svg.querySelector('.tl-bar')), today: !!(svg && svg.querySelector('.tl-today')), overlap, inside: svg ? tb.every((b) => b.x >= -1 && b.x + b.width <= svg.viewBox.baseVal.width + 1) : false }; })()`;
  await api.go('?lang=en#home/how', 1300);
  const how7 = await api.eval(howRead);
  await api.viewport(390, 844, { mobile: true, dark: true });
  await api.go('?lang=en#home/how', 1300);
  const howM = await api.eval(howRead);
  await api.viewport(1440, 900, { dark: true });
  const PN = { silnest: 'SilNest', storewright: 'Storewright', site: 'yecanyuan.com', vocal: 'AI Vocal' };
  const most = Math.max(...prof7.skills_map.map((s) => s.projects.length));
  const wantTl = prof7.timeline.slice().sort((a, b) => (a.from < b.from ? -1 : 1)).map((t) => [t.project, PN[t.project], t.to ? (t.from.slice(0, 4) === t.to.slice(0, 4) ? `${mon(t.from, false)} to ${mon(t.to)}` : `${mon(t.from)} to ${mon(t.to)}`) : mon(t.from)]);
  ok(how7.faqHead === 'FAQ' && how7.faq.length === prof7.faq.length && how7.faq.every(([q, a], i) => q === `Question: ${prof7.faq[i].q_en}` && a === `Answer: ${prof7.faq[i].a_en}`),
    '#53 How I work has an FAQ, plain question and answer cards (a list of terms and answers, not a chat), the questions and answers from profile.json "faq"', JSON.stringify(how7.faq.map((x) => x[0])));
  ok(how7.steps.length === 5 && how7.steps.every(([, href, target]) => href.startsWith(`${prof7.storewright.repo}/`) && target === '_blank') && how7.steps[4][1] === `${prof7.storewright.repo}/commit/6ced164` && !how7.draft && how7.tvn === 5,
    '#156 one real change in five steps (the bar, what I found, what Claude Code did, the test, the commit), each linking to the public Storewright repository, with no draft label (the user confirmed it on 2026-11-15); the loop still has its five steps', JSON.stringify(how7.steps));
  ok(how7.lanes.join('|') === 'Software|Creative tech|Product' && how7.stars.length === prof7.skills_map.length
    && how7.stars.every(([name, proj, top], i) => { const s = prof7.skills_map.filter((x) => x.lane === 'software').concat(prof7.skills_map.filter((x) => x.lane === 'creative'), prof7.skills_map.filter((x) => x.lane === 'product'))[i]; return name === s.skill && proj === s.projects.map((p) => PN[p]).join(', ') && top === (s.projects.length === most); })
    && how7.lines.every(([n, segs]) => segs === n) && howM.lines.every(([n, segs]) => segs === n),
  '#110 the skill map: one constellation per lane (Software, Creative tech, Product), a star per skill from profile.json "skills_map" with its projects, the brightest for the most projects, each lane\'s stars joined by its line (desktop and phone)', JSON.stringify([how7.lanes, how7.lines, howM.lines]));
  ok(JSON.stringify(how7.tl) === JSON.stringify(wantTl) && JSON.stringify(howM.tl) === JSON.stringify(wantTl) && how7.bar && how7.today && how7.overlap === 0 && howM.overlap === 0 && how7.inside && howM.inside
    && how7.tlLabel === `Timeline of my projects: ${wantTl.map(([k]) => { const t = prof7.timeline.find((x) => x.project === k); const L = (iso) => fmtISO(iso, { month: 'long', year: 'numeric' }); return t.to ? `${PN[k]} from ${L(t.from)} to ${L(t.to)}` : `${PN[k]} from ${L(t.from)}`; }).join('; ')}.`,
  '#111 the timeline as in the README: a dot where each project started, a bar for Storewright (Oct to Nov 2026), a ring for today; no two labels overlap at 1440 px or on a phone, and a screen reader hears every project and its months', JSON.stringify([how7.tl, how7.overlap, howM.overlap, how7.tlLabel]));

  // ---------------- #157 who did what, #158 the numbers (project pages)
  const pg = {};
  for (const k of ['storewright', 'silnest', 'site', 'vocal']) {
    await api.go(`?lang=en#home/${k}`, 900);
    pg[k] = await api.eval(`({role: (document.querySelector('#role .ap-role-v') || {}).textContent || null, roleK: (document.querySelector('#role .ap-role-k') || {}).textContent || null,
      nums: Object.fromEntries([...document.querySelectorAll('#numbers .nm')].map((n) => [n.dataset.k, [n.querySelector('.nm-v').textContent, (n.querySelector('.nm-s') || {}).textContent || '']])), foot: (document.querySelector('#numbers .tv-foot') || {}).textContent || ''})`);
  }
  const sw7 = nums7.storewright;
  const swSpan = `${fmtISO(sw7.firstCommit, { month: 'short', day: 'numeric' })} to ${fmtISO(sw7.lastCommit, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  ok(pg.storewright.roleK === 'Who did what' && pg.storewright.role === prof7.roles.storewright.en && pg.site.role === prof7.roles.site.en && pg.vocal.role === prof7.roles.vocal.en
    && /\biOS\b/.test(prof7.roles.silnest.en) === (pg.silnest.role === null),
  '#157 each project page opens with who did what, from profile.json "roles" (SilNest\'s line names its phone system other than as "iOS 17.0 or later", so it waits for new wording)', JSON.stringify([pg.storewright.role, pg.silnest.role]));
  ok(pg.storewright.nums.span[0] === swSpan && pg.storewright.nums.commits[0] === String(sw7.commits) && pg.storewright.nums.tests[0] === String(sw7.tests) && pg.storewright.nums.files[0] === String(sw7.testFiles)
    && pg.storewright.nums.tests[1] === `Storewright ${sw7.testsByPart.storewright} · StoreX ${sw7.testsByPart.storex} · StoreX Chain ${sw7.testsByPart.storexChain} · shared libraries ${sw7.testsByPart.libraries}`
    && pg.storewright.foot.includes(`commit ${sw7.head}`)
    && pg.silnest.nums.version[0] === D7.facts.snVersion && pg.silnest.nums.released[0] === fmtISO(D7.facts.snReleased, { month: 'long', day: 'numeric', year: 'numeric' })
    && pg.silnest.nums.started[0] === mon(prof7.timeline.find((t) => t.project === 'silnest').from) && !Object.keys(pg.site.nums).length && !Object.keys(pg.vocal.nums).length,
  `#158 the numbers, read automatically: Storewright ${swSpan}, ${sw7.commits} commits, ${sw7.tests} unit tests by part, ${sw7.testFiles} test files (data/project-numbers.json); SilNest's version and release date from the App Store; none for the projects without such numbers`, JSON.stringify([pg.storewright.nums, pg.silnest.nums]));

  // ---------------- #113 "Ask me about", #66 the public resumes
  await api.go('?lang=en#home/contact', 900);
  const ct7 = await api.eval(`({ask: [...document.querySelectorAll('#ask .ask-chip')].map((b) => [b.dataset.goto, b.textContent]), cv: [...document.querySelectorAll('#resume a.rs-btn')].map((a) => [a.dataset.resume, decodeURIComponent(new URL(a.href).pathname.split('/').pop()), a.target])})`);
  await clickEl('#ask .ask-chip[data-goto="storewright"]');
  await sleep(800);
  const askGo = await api.eval(`[document.getElementById('appView').dataset.app, location.hash]`);
  await api.go('?lang=en#home/contact', 900);
  await clickEl('#ask .ask-chip[data-goto="vocal"]');
  await sleep(800);
  const askVo = await api.eval(`[document.getElementById('appView').dataset.app, location.hash]`);
  const pdfs = [['en', 'Canyuan_Ye_Resume.pdf'], ['product', 'Canyuan_Ye_Resume_Product.pdf'], ['zh', '叶璨源_简历.pdf']];
  const same = pdfs.every(([, f]) => existsSync(`${dist7}${f}`) && existsSync(`${repo7}pages/src/resume/${f}`) && readFileSync(`${dist7}${f}`).equals(readFileSync(`${repo7}pages/src/resume/${f}`)) && readFileSync(`${dist7}${f}`).toString('latin1', 0, 5) === '%PDF-');
  ok(JSON.stringify(ct7.ask) === JSON.stringify(prof7.topics.map((t) => [t.project, t.en])) && ct7.ask.length === 4 && askGo[0] === 'storewright' && askGo[1] === '#home/storewright'
    && askVo[0] === 'vocal' && askVo[1] === '#home/vocal',
  '#113 Contact says what to ask me about, the four topics from profile.json, each opening its project ("Local AI voice and singing" opens AI Vocal at #home/vocal)', JSON.stringify([ct7.ask, askGo, askVo]));
  ok(same && JSON.stringify(ct7.cv) === JSON.stringify(pdfs.map(([k, f]) => [k, f, '_blank'])),
    '#66 the three public resumes (no phone number) ship next to index.html byte for byte from pages/src/resume/, and Contact links each of them', JSON.stringify(ct7.cv));

  // ---------------- #154 the quick view
  const blRead = `(() => { const a = document.getElementById('briefLink'); const r = a.getBoundingClientRect(); const u = document.getElementById('unlock').getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {text: a.textContent, size: getComputedStyle(a).fontSize, h: Math.round(r.height), apart: r.left >= u.right || r.top >= u.bottom - 1, hit: !!(hit && hit.closest('#briefLink')), inView: r.bottom <= innerHeight, order: [...document.querySelectorAll('#lock a, #lock button')].filter((x) => x.tabIndex >= 0).map((x) => x.id).slice(-2)}; })()`;
  await api.viewport(390, 844, { mobile: true, dark: true });
  await api.go('?lang=en', 900);
  const blM = await api.eval(blRead);
  await api.viewport(1440, 900, { dark: true });
  await api.go('?lang=en', 900);
  const bl = await api.eval(blRead);
  await clickEl('#briefLink');
  await sleep(500);
  const br1 = await api.eval(`({view: document.body.dataset.view, hash: location.hash, focus: document.activeElement.id, shown: !document.getElementById('brief').hidden, lockInert: document.getElementById('lock').inert, top: document.querySelector('.br-top').textContent,
    projects: [...document.querySelectorAll('.br-list li > p:first-child')].map((p) => p.textContent), links: [...document.querySelectorAll('#brief a')].map((a) => a.getAttribute('href')), anims: document.getAnimations().filter((a) => document.getElementById('brief').contains(a.effect && a.effect.target)).length})`);
  await api.key('Escape');
  await sleep(500);
  const br2 = await api.eval(`[document.body.dataset.view, location.hash, document.activeElement.id]`);
  await api.go('?lang=zh#brief', 900);
  const br3 = await api.eval(`[document.querySelector('.br-name').textContent, document.querySelector('.br-in h2').textContent, document.querySelector('#brief a[data-resume="main"]').getAttribute('href')]`);
  await clickEl('#brief button[data-lang="en"]');
  await sleep(300);
  const br4 = await api.eval(`[document.documentElement.lang, document.querySelector('.br-in h2').textContent, document.activeElement.dataset.lang]`);
  const pages7 = [];
  for (const q of ['?lang=en#brief', '?lang=zh#brief', '?lang=en', '?lang=en#home/sky']) {
    await api.go(q, 900);
    for (const [w, h] of [[8.5, 11], [8.27, 11.69]]) {
      const { data: pdf64 } = await api.send('Page.printToPDF', { paperWidth: w, paperHeight: h, printBackground: false });
      const pdf = Buffer.from(pdf64, 'base64').toString('latin1');
      pages7.push(Number((pdf.match(/\/Type\s*\/Pages[\s\S]{0,200}?\/Count\s+(\d+)/) || [])[1]));
    }
  }
  await api.go('?lang=en', 700);
  await api.send('Emulation.setEmulatedMedia', { media: 'print', features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await sleep(200);
  const pr7 = await api.eval(`({brief: getComputedStyle(document.getElementById('brief')).display, lock: getComputedStyle(document.querySelector('.screens')).display, bg: getComputedStyle(document.body).backgroundColor, ink: getComputedStyle(document.querySelector('.br-name')).color, tools: getComputedStyle(document.querySelector('.br-top')).display})`);
  await api.viewport(1440, 900, { dark: true });
  ok([bl, blM].every((b) => b.text === 'Quick view' && parseFloat(b.size) <= 12.5 && b.h >= 24 && b.apart && b.hit && b.inView && b.order.join(',') === 'unlock,briefLink'),
    '#154 a quiet "Quick view" link beside the Unlock pill (under it on a phone): small, after it in the tab order, a 24 px target nothing covers', JSON.stringify([bl, blM]));
  ok(br1.view === 'brief' && br1.hash === '#brief' && br1.focus === 'briefName' && br1.shown && br1.lockInert && br1.top.startsWith('Want the fun version?') && br1.top.includes('Back to the home page')
    && br1.projects.length === 3 && br1.projects[0].startsWith('Storewright: ') && br1.projects[1].startsWith('SilNest: ') && br1.links.includes('Canyuan_Ye_Resume.pdf') && br1.links.includes(`mailto:${prof7.links.email}`) && br1.anims === 0
    && br2[0] === 'lock' && br2[1] === '' && br2[2] === 'unlock',
  '#154 the link opens #brief: plain text with no motion, who I am, three projects with links, how I work, the resume (PDF) and how to reach me; "Want the fun version? Back to the home page" on top; Esc goes back', JSON.stringify([br1, br2]));
  ok(br3[1] === '三个项目' && br3[2] === encodeURIComponent('叶璨源_简历.pdf') && br4[0] === 'en' && br4[1] === 'Three projects' && br4[2] === 'en',
    '#154 in Chinese it links the Chinese resume, and its own EN | 中文 switch changes the language', JSON.stringify([br3, br4]));
  ok(pages7.every((n) => n === 1) && pr7.brief === 'block' && pr7.lock === 'none' && pr7.bg === 'rgb(255, 255, 255)' && pr7.ink === 'rgb(11, 12, 14)' && pr7.tools === 'none',
    '#154 printed, from the quick view or from anywhere else, the page is the quick view on one white sheet (Letter and A4, English and Chinese)', JSON.stringify([pages7, pr7]));

  // ---------------- #155 present mode
  await api.go('?lang=en#present', 1000);
  const ps1 = await api.eval(`({view: document.body.dataset.view, n: document.querySelectorAll('.pr-slide').length, shown: [...document.querySelectorAll('.pr-slide')].findIndex((s) => !s.hidden), num: document.getElementById('prNum').textContent,
    labels: [...document.querySelectorAll('.pr-slide')].map((s) => s.getAttribute('aria-label')), planets: new Set([...document.querySelectorAll('.pr-orbit [data-o]')].map((g) => g.getAttribute('transform'))).size, lanes: [...document.querySelectorAll('.pr-lanes li')].map((l) => l.textContent), topInert: document.getElementById('topbar').inert})`);
  await api.key('ArrowRight');
  await sleep(150);
  await api.key('ArrowRight');
  await sleep(300);
  const ps2 = await api.eval(`[document.getElementById('prNum').textContent, location.hash, document.getElementById('prLive').textContent, document.querySelector('.pr-slide:not([hidden]) .pr-title').textContent]`);
  await api.key('End');
  await sleep(200);
  const ps3 = await api.eval(`[document.getElementById('prNum').textContent, document.getElementById('prNext').disabled, !!document.querySelector('.pr-slide:not([hidden]) .pr-qr svg path')]`);
  await api.key('Home');
  await sleep(200);
  const ps4 = await api.eval(`[document.getElementById('prNum').textContent, document.getElementById('prPrev').disabled]`);
  await api.key('Escape');
  await sleep(500);
  const ps5 = await api.eval(`[document.body.dataset.view, location.hash]`);
  await api.go('?lang=zh#present/4', 900);
  const ps6 = await api.eval(`[document.getElementById('prNum').textContent, document.querySelector('.pr-slide:not([hidden]) .pr-title').textContent, document.querySelector('.pr-slide:not([hidden])').getAttribute('aria-label')]`);
  await api.go('?lang=en&motion=reduce#present/2', 900);
  await api.key('ArrowLeft');
  await sleep(100);
  const ps7 = await api.eval(`[document.getElementById('prNum').textContent, document.getAnimations().filter((a) => document.getElementById('present').contains(a.effect && a.effect.target)).length]`);
  // a slide's own class (pr-s-<key>) never matches a class its content uses: slide 1 was once
  // "pr-title", so all of it took the heading's -0.03em at 76 px (-2.28 px) and "Creative tech" read as one word
  await api.go('?lang=en#present', 900);
  const psCls = await api.eval(`(() => { const s = [...document.querySelectorAll('.pr-slide')]; const own = s.flatMap((x) => [...x.classList].filter((c) => c !== 'pr-slide'));
    const inner = new Set(s.flatMap((x) => [...x.querySelectorAll('[class]')].flatMap((e) => [...e.classList])));
    const ls = (sel) => { const e = document.querySelector('.pr-slide:not([hidden]) ' + sel); if (!e) return null; const c = getComputedStyle(e); return (c.letterSpacing === 'normal' ? 0 : parseFloat(c.letterSpacing)) / parseFloat(c.fontSize); };
    return { clash: own.filter((c) => inner.has(c)), own, lanes: ls('.pr-lanes li'), lead: ls('.pr-lead') }; })()`);
  ok(psCls.clash.length === 0 && psCls.own.length === 6 && psCls.own.every((c) => c.startsWith('pr-s-')) && psCls.lanes !== null && psCls.lanes > -0.02 && psCls.lead !== null && psCls.lead > -0.02,
    "#155 a slide's own class never matches one its content uses, so the first slide's lanes and line keep normal letter spacing", JSON.stringify(psCls));
  await api.go('?lang=en#home', 900);
  await api.eval(`document.activeElement.blur()`);
  await api.key('k', { meta: true });
  await sleep(350);
  await api.type('>present');
  await sleep(150);
  await api.key('Enter');
  await sleep(700);
  const ps8 = await api.eval(`[document.body.dataset.view, location.hash, document.activeElement.id]`);
  await api.key('Escape');
  await sleep(700);
  const ps9 = await api.eval(`[document.body.dataset.view, location.hash]`);
  ok(ps1.view === 'present' && ps1.n === 6 && ps1.shown === 0 && ps1.num === '1 / 6' && ps1.labels[1] === 'Slide 2 of 6: Storewright' && ps1.labels[5] === 'Slide 6 of 6: Contact' && ps1.planets >= 8
    && ps1.lanes.join('|') === prof7.lanes.join('|') && ps1.topInert,
  '#155 #present: six slides from the app pages (my name and three lanes over the orbit with the planets where they are, Storewright, SilNest, AI Vocal, how I work, contact), the number bottom right', JSON.stringify(ps1));
  ok(ps2[0] === '3 / 6' && ps2[1] === '#present/3' && ps2[2] === 'Slide 3 of 6: SilNest' && ps2[3] === '声藏 · SilNest' && ps3[0] === '6 / 6' && ps3[1] && ps3[2] && ps4[0] === '1 / 6' && ps4[1]
    && ps5[0] === 'lock' && ps5[1] === '' && ps6[0] === '4 / 6' && ps6[1] === 'AI Vocal' && ps6[2] === '第 4 页，共 6 页：AI Vocal' && ps7[0] === '1 / 6' && ps7[1] === 0
    && ps8[0] === 'present' && ps8[1] === '#present' && ps8[2] === 'prDeck' && ps9[0] === 'home' && ps9[1] === '#home',
  '#155 arrow keys, Home and End turn the slides (the address follows, a screen reader hears each), Esc leaves; #present/4 opens a slide, in Chinese too; no motion when reduced; ">present" starts it and Esc returns where it started', JSON.stringify([ps2, ps3, ps4, ps5, ps6, ps7, ps8, ps9]));

  // ---------------- #121 the Storewright pick game: Storewright's own route rule, checked against Storewright
  const gm = [];
  await api.go('?lang=en&game=1#home/storewright', 1200);
  for (let i = 0; i < 8; i++) {
    await clickEl('#sgShow');
    await sleep(60);
    gm.push(await api.eval(`(() => { const a = document.getElementById('sgAlgo'); return {order: a.dataset.order, m: Number(a.dataset.m), s: Number(a.dataset.s), d: a.getAttribute('d').length, items: document.querySelectorAll('#sgList li').length, res: document.getElementById('sgRes').textContent}; })()`));
    await clickEl('#sgAgain');
    await sleep(60);
  }
  for (const seed of [20261114, 20261225]) {
    await api.go(`?lang=en&game=${seed}#home/storewright`, 1100);
    await clickEl('#sgShow');
    await sleep(60);
    gm.push(await api.eval(`(() => { const a = document.getElementById('sgAlgo'); return {order: a.dataset.order, m: Number(a.dataset.m), s: Number(a.dataset.s), d: a.getAttribute('d').length, items: document.querySelectorAll('#sgList li').length}; })()`));
  }
  const bad = game7.vectors.filter((v, i) => !gm[i] || gm[i].order !== v.tsp.order.join(',') || gm[i].m !== v.tsp.m || gm[i].s !== v.sshape || gm[i].items !== 6 || gm[i].d < 20);
  ok(game7.vectors.length === 10 && bad.length === 0 && game7.vectors.every((v) => v.tsp.m <= v.nn + 1e-6) && gm[0].res.startsWith("Storewright's route: "),
    `#121 for ten lists the page's route is exactly Storewright's own routeTsp (order and metres) and its aisle-by-aisle baseline routeSShape (Storewright ${game7.source.commit}, small store, pages/src/storewright-small.json), and 2-opt never walks further than the nearest-neighbour start`, JSON.stringify(bad.map((v) => v.seed)));
  const v1 = game7.vectors[0];
  await api.go('?lang=en&game=1&motion=reduce#home/storewright', 1200);
  await api.eval(`document.getElementById('sgBoard').focus()`);
  await api.key('ArrowLeft');
  await sleep(100);
  const kb7 = await api.eval(`[document.getElementById('sgMe').dataset.node, document.getElementById('sgStatus').textContent]`);
  await api.go('?lang=en&game=1&motion=reduce#home/storewright', 1200);
  for (const node of v1.tsp.order) { await clickEl(`.sg-pick[data-node="${node}"] rect`); await sleep(60); }
  const mid7 = await api.eval(`[document.querySelectorAll('#sgList li.done').length, document.getElementById('sgStatus').textContent]`);
  await api.eval(`document.getElementById('ccLang').click()`);
  await sleep(250);
  const midZh = await api.eval(`[document.documentElement.lang, document.getElementById('sgStatus').textContent, document.querySelector('#sgList li').textContent]`);
  await api.eval(`document.getElementById('ccLang').click()`);
  await sleep(250);
  await clickEl('#sgCart rect');
  await sleep(150);
  const end7 = await api.eval(`[document.getElementById('sgRes').hidden, document.querySelector('.sg-r1').textContent, document.getElementById('sgAlgo').getAttribute('d').length > 20]`);
  const m1 = v1.tsp.m.toFixed(1);
  const left = game7.nodes[game7.depot][0] - Math.max(...game7.adj[game7.depot].filter((x, j) => j % 2 === 0).map((n) => (game7.nodes[n][1] === game7.nodes[game7.depot][1] && game7.nodes[n][0] < game7.nodes[game7.depot][0] ? game7.nodes[n][0] : -1)));
  ok(kb7[1] === `0 of 6 picked · ${left.toFixed(1)} m walked` && kb7[0] !== String(game7.depot)
    && mid7[0] === 6 && mid7[1].includes('All picked: back to the cart') && midZh[0] === 'zh-CN' && /^拣到了：.+。 都拣齐了：回到推车处/.test(midZh[1]) && /号通道|蔬果墙|后墙/.test(midZh[2]) && !end7[0] && end7[1] === `You walked ${m1} m. Storewright's route: ${m1} m. The same distance as Storewright's route.` && end7[2],
  `#121 the game by keyboard (an arrow walks to the next stop: ${left.toFixed(1)} m) and by tapping: the six shelves in Storewright's order and back to the cart is ${m1} m, the same as its route, which it then shows; what it says follows the language`, JSON.stringify([kb7, mid7, midZh, end7]));

  // ---------------- #169 What if…: Storewright's own simulation of the store day, run on demand
  const lab7 = JSON.parse(readFileSync(`${repo7}data/store-day.json`, 'utf8'));
  const card7 = Object.fromEntries(lab7.headline.map((h) => [h.label, h.value]));
  const labRead = `(() => { const $ = (s) => document.querySelector(s); const cells = (k) => [...document.querySelectorAll('#whatIf tr[data-k="' + k + '"] td')].map((c) => c.textContent);
    return {sim: typeof window.StorewrightSim, block: ($('#swSim') || {}).type || '', knobs: [...document.querySelectorAll('#whatIf input.wi-range')].map((r) => ({id: r.id, type: r.type, v: r.value, min: r.min, max: r.max,
      label: (document.querySelector('label[for="' + r.id + '"]') || {}).textContent, out: (document.getElementById(r.id + '-out') || {}).textContent, vt: r.getAttribute('aria-valuetext'), hint: (document.getElementById(r.getAttribute('aria-describedby')) || {}).textContent})),
      heads: [...document.querySelectorAll('#whatIf thead th')].map((h) => h.textContent), rows: [...document.querySelectorAll('#whatIf tbody th')].map((h) => h.textContent),
      onTime: cells('onTime'), wait: cells('wait'), live: ($('#wiLive') || {}).textContent, liveAttr: ($('#wiLive') || {getAttribute: () => ''}).getAttribute('aria-live'), status: ($('#wiStatus') || {}).textContent,
      run: ($('#wiRun') || {}).textContent, foot: [...document.querySelectorAll('#whatIf .tv-foot')].map((f) => f.textContent), src: ($('#whatIf .wi-src') || {}).href,
      card: [...document.querySelectorAll('#appBody .tv-sec')].filter((x) => /Simulated store day/.test((x.querySelector('.tv-head') || {}).textContent || '')).map((x) => [...x.querySelectorAll('.tv-row')].map((r) => r.innerText.replace(/\\s+/g, ' ').trim()))[0] || []}; })()`;
  const nReq7 = api.requests.length;
  await api.go('?lang=en#home/storewright', 1300);
  const lb0 = await api.eval(labRead);
  await clickEl('#wiRun');
  await sleep(1200);
  const lb1 = await api.eval(labRead);
  const direct = await api.eval(`[StorewrightSim.runDay({ seed: ${lab7.seed} }), StorewrightSim.runDay({ seed: ${lab7.seed}, pickers: 9 }), StorewrightSim.runDay({ seed: ${lab7.seed}, pickers: 9 }), StorewrightSim.runDay({ seed: ${lab7.seed}, pickers: 9, volume: 150 })]`);
  // by keyboard: three steps down on "Pickers on shift" run the day once, a moment after the last step
  await api.eval(`document.getElementById('wi-pickers').focus()`);
  for (let k = 0; k < 3; k++) { await api.key('ArrowLeft'); await sleep(60); }
  await sleep(1300);
  const lb2 = await api.eval(labRead);
  await clickEl('#wiRun');
  await sleep(1200);
  const lb3 = await api.eval(labRead);
  await api.eval(`(() => { const r = document.getElementById('wi-volume'); r.value = '150'; r.dispatchEvent(new Event('input', {bubbles: true})); r.dispatchEvent(new Event('change', {bubbles: true})); })()`);
  await sleep(1400);
  const lb4 = await api.eval(labRead);
  const anim = await api.eval(`document.getElementById('wiOnTime').getAnimations().length`);
  const labReqs = api.requests.slice(nReq7).filter((u) => !/^(file|data|blob):/.test(u) && u !== 'about:blank');
  const labCsp = await api.eval('window.__csp.length');
  const pct = (v) => `${v}%`;
  const mins = (v) => `${v} min`;
  ok(lb0.sim === 'undefined' && lb0.block === 'text/plain' && lb0.knobs.length === 3 && lb0.knobs.every((k) => k.type === 'range' && k.label && k.out && k.vt && k.hint)
    && lb0.knobs.map((k) => `${k.label}=${k.out}`).join('|') === 'Pickers on shift=12|Order volume=100%|Peak hours=×1'
    && lb0.heads.join('|') === 'Now|With your changes' && lb0.rows.join('|') === 'On-time rate (ready on time)|Average pickup wait'
    && lb0.onTime.join('|') === `${pct(card7['Ready on time'])}|Not run yet` && lb0.wait.join('|') === `${mins(card7['Avg pickup wait'])}|Not run yet`
    && lb0.card.includes(`Avg pickup wait ${mins(card7['Avg pickup wait'])}`) && lb0.card.includes(`Ready on time ${pct(card7['Ready on time'])}`)
    && lb0.liveAttr === 'polite' && lb0.run === 'Rerun' && lb0.foot.length === 2 && /^Synthetic data\. Both columns use the same random seed/.test(lb0.foot[0]) && /this model only/.test(lb0.foot[0])
    && lb0.src === 'https://github.com/Glacieerr/storewright/tree/1554726' && /AGPL-3\.0/.test(lb0.foot[1]),
  '#169 the What if lab renders under the store day: three labelled sliders that show their values (pickers on shift, order volume, peak hours), Rerun, and "Now" beside "With your changes" for the on-time rate and the average pickup wait; "Now" is the store card\'s own numbers; the small print says synthetic, same seed, this model only, and names the code\'s license; nothing has run at load (the simulation is text in the page)',
  JSON.stringify(lb0));
  ok(lb1.sim === 'object' && lb1.onTime.join('|') === `${pct(card7['Ready on time'])}|${pct(card7['Ready on time'])}` && lb1.wait.join('|') === `${mins(card7['Avg pickup wait'])}|${mins(card7['Avg pickup wait'])}`
    && direct[0].onTime === card7['Ready on time'] && direct[0].waitMin === card7['Avg pickup wait'] && direct[0].fulfilled === card7['Orders fulfilled']
    && /^Ran one simulated day in \d+\.\d\d seconds\.$/.test(lb1.status) && lb1.live === `With your changes: ${pct(card7['Ready on time'])} ready on time, average pickup wait ${mins(card7['Avg pickup wait'])}. Now: ${pct(card7['Ready on time'])} and ${mins(card7['Avg pickup wait'])}.`,
  `#169 Rerun with the sliders as they are runs Storewright's simulation of ${lab7.date} (seed ${lab7.seed}) in the browser and gives the store card's numbers exactly (${card7['Orders fulfilled']} orders, ${pct(card7['Ready on time'])} on time, ${mins(card7['Avg pickup wait'])}); the result is announced to screen readers`,
  JSON.stringify([lb1, direct[0]]));
  ok(lb2.knobs[0].out === '9' && lb2.knobs[0].vt === '9 at the busiest hours' && lb2.onTime[1] === pct(direct[1].onTime) && lb2.wait[1] === mins(direct[1].waitMin)
    && (direct[1].onTime !== card7['Ready on time'] || direct[1].waitMin !== card7['Avg pickup wait']) && JSON.stringify(direct[1]) === JSON.stringify(direct[2])
    && lb3.onTime[1] === lb2.onTime[1] && lb3.wait[1] === lb2.wait[1] && lb3.onTime[0] === pct(card7['Ready on time'])
    && lb4.knobs[1].out === '150%' && lb4.onTime[1] === pct(direct[3].onTime) && lb4.wait[1] === mins(direct[3].waitMin) && (lb4.onTime[1] !== lb3.onTime[1] || lb4.wait[1] !== lb3.wait[1])
    && anim > 0 && labReqs.length === 0 && labCsp === 0,
  `#169 the sliders drive the day: three arrow-key steps to 9 pickers run it once (${pct(direct[1].onTime)} on time, ${mins(direct[1].waitMin)}), Rerun gives the same again, as does the simulation called twice with the same inputs; 150% of the orders as well changes it again (${pct(direct[3].onTime)}, ${mins(direct[3].waitMin)}); no network request and no Content Security Policy refusal while it ran`,
  JSON.stringify([lb2.knobs[0], lb2.onTime, lb2.wait, lb3.onTime, lb4.onTime, lb4.wait, direct.slice(1), anim, labReqs, labCsp]));
  // in Chinese, at phone width, with reduced motion
  await api.viewport(390, 844, { mobile: true, dark: false, reduce: true });
  await api.go('?lang=zh#home/storewright', 1300);
  await clickEl('#wiRun');
  await sleep(1500);
  const lbZ = await api.eval(`(() => { const s = document.getElementById('whatIf'); const r = s.getBoundingClientRect(); const t = s.querySelector('.wi-table').getBoundingClientRect();
    return {head: s.querySelector('.tv-head').textContent, labels: [...s.querySelectorAll('.wi-label')].map((l) => l.textContent), run: document.getElementById('wiRun').textContent, heads: [...s.querySelectorAll('thead th')].map((h) => h.textContent),
      wait: [...s.querySelectorAll('tr[data-k="wait"] td')].map((c) => c.textContent), anim: document.getElementById('wiOnTime').getAnimations().length,
      fits: r.left >= 0 && r.right <= innerWidth && t.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth, hours: document.getElementById('wi-peak-hint').textContent}; })()`);
  await api.viewport(1440, 900, { dark: true });
  ok(lbZ.head === '如果……会怎样' && lbZ.labels.join('|') === '在岗拣货员|订单量|高峰时段' && lbZ.run === '重跑' && lbZ.heads.join('|') === '现在|改动后'
    && lbZ.wait.join('|') === `${card7['Avg pickup wait']} 分钟|${card7['Avg pickup wait']} 分钟` && lbZ.anim === 0 && lbZ.fits && lbZ.hours.includes('11 点到 13 点和 16 点到 19 点'),
  '#169 the lab in Chinese at phone width with reduced motion: it fits the screen, the result does not flash, the busiest hours are named (11 点到 13 点和 16 点到 19 点)', JSON.stringify(lbZ));

  // ---------------- Search finds the new views; the new words keep their contrast
  await api.go('?lang=en', 800);
  await api.eval(`document.activeElement.blur()`);
  await api.key('k', { meta: true });
  await sleep(350);
  await api.type('resume');
  await sleep(150);
  const sr7 = await api.eval(`(() => { const r = document.querySelector('#spotList .sp-row'); return r ? [r.dataset.cmd, r.querySelector('.sp-t').textContent] : null; })()`);
  await api.key('Enter');
  await sleep(600);
  const sr7b = await api.eval(`[document.body.dataset.view, location.hash]`);
  ok(sr7 && sr7[0] === 'brief' && sr7[1] === 'Quick view (one page)' && sr7b[0] === 'brief' && sr7b[1] === '#brief', 'Search: "resume" offers the quick view first, and Enter opens it', JSON.stringify([sr7, sr7b]));
  for (const mode of ['dark', 'light']) {
    const c = {};
    const at = async (sel) => { await api.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (e) e.scrollIntoView({block: 'center'}); })()`); await sleep(80); c[sel] = (await contrastOf(api, sel) || {}).p05; };
    await api.go(`?lang=en&appearance=${mode}`, 900);
    await api.eval(`document.getAnimations().forEach(a => a.pause())`);
    await at('.brief-link span');
    await api.go(`?lang=en&appearance=${mode}#brief`, 800);
    for (const sel of ['.br-top span', '.br-hint', '.br-lanes', '.br-links', '.br-rows dt', '.br-foot']) await at(sel);
    await api.go(`?lang=en&appearance=${mode}#present/2`, 900);
    for (const sel of ['.pr-facts span', '.pr-note', '.pr-hint', '.pr-num']) await at(sel);
    await api.go(`?lang=en&appearance=${mode}&game=1#home/storewright`, 1100);
    for (const sel of ['.ap-role-k', '.ap-role-v', '.sg-how', '.sg-status', '.sg-list li span:last-child', '.nm dt', '.nm-s', '.wi-label', '.wi-out', '.wi-hint', '.wi-none', '.wi-table thead th', '.wi-src']) await at(sel);
    await api.go(`?lang=en&appearance=${mode}#home/how`, 1100);
    for (const sel of ['.faq-note', '.faq-q', '.faq-a', '.ch-when', '.ch-t', '.ch-link', '.sk-name', '.sk-proj', '.sk-key']) await at(sel);
    await api.go(`?lang=en&appearance=${mode}#home/contact`, 900);
    for (const sel of ['.ask-chip span', '.rs-btn small', '.rs-note', '.ct-reply']) await at(sel);
    await api.go(`?lang=en&appearance=${mode}&open=about`, 900);
    await at('.ab-credits li');
    console.log('     contrast batch 3', mode, JSON.stringify(c));
    ok(Object.values(c).every((v) => v >= 4.5), `contrast of the batch 3 words on the ${mode} page (quick view, present mode, who did what, the numbers, the game, the What if lab, FAQ, the change, skills, ask me about, how soon I reply, resumes, the credits) >= 4.5:1`, JSON.stringify(c));
  }
  await api.viewport(1440, 900, { dark: true });
  await api.go('?lang=en', 600);
  ok((await api.eval('window.__csp.length')) === 0, 'no Content Security Policy violation in the batch 3 pieces (they live inside the hashed script and stylesheet)');
  }

  console.log('---- part 8: R3.3 batch 6 (the page at the edges of time: idea #177)');
  await timeEdges(api, ok, D);

  // ---------------- words on screen
  const shown = { en: [], zh: [] };
  for (const q of ['?lang=en', '?lang=en#home', '?lang=en&open=nc', '?lang=en&open=nc-all', '?lang=en&open=cc', '?lang=en&open=spotlight', '?lang=en&open=folder', '?lang=zh', '?lang=zh#home', '?lang=zh&open=nc', '?lang=zh&open=cc', '?lang=zh&open=spotlight']
    .concat(['silnest', 'storewright', 'site', 'vocal', 'how', 'contact', 'clock', 'calendar', 'design', 'assets'].flatMap((k) => [`?lang=en#home/${k}`, `?lang=zh#home/${k}`]))
    .concat(['?lang=en&open=about', '?lang=zh&open=about', '?lang=en#brief', '?lang=zh#brief'])
    .concat([1, 2, 3, 4, 5, 6].flatMap((n) => [`?lang=en#present/${n}`, `?lang=zh#present/${n}`]))) {
    await api.go(q, 500);
    shown[q.includes('lang=zh') ? 'zh' : 'en'].push(await api.eval(`document.body.innerText + ' ' + [...document.querySelectorAll('[aria-label]')].map(e => e.getAttribute('aria-label')).join(' ')`));
  }
  const en = shown.en.join('\n');
  const zh_ = shown.zh.join('\n');
  const all_ = `${en}\n${zh_}`;
  const allChk = all_.replaceAll('Android Studio', '');   // the one way the page may name Android: the tool, in Uses
  ok(!/\biOS\b(?! \d)/.test(allChk) && !/android/i.test(allChk) && !/[–—]/.test(allChk), 'no "iOS", no Android (except the tool Android Studio) and no en or em dash anywhere on screen (both languages)', (allChk.match(/.{0,30}(\biOS\b|android|[–—]).{0,30}/i) || [''])[0]);
  ok(!/store AI|商店 AI/i.test(all_) && all_.includes('第三部分 StoreX Chain 的值班助手：留出的 80 道盲测题上 76.3%，关键词规则 42.5%'), 'the 76.3% result is always the part-3 duty assistant, in both languages');
  const renamed = ['Unlock the rest', 'Today', 'All updates', 'Quick settings', 'Search'].every((w) => en.includes(w)) && ['解锁其余内容', '今天', '全部动态', '快捷设置', '搜索'].every((w) => zh_.includes(w))
    && !/slide to unlock|Notification Center|Control Center|Spotlight|滑动来解锁|通知中心|控制中心|墙纸/i.test(all_);
  ok(renamed, 'the phone-only words are gone: Unlock the rest / 解锁其余内容, Today / 今天, Quick settings / 快捷设置, Search (no slide to unlock, Notification Center, Control Center, Spotlight)',
    (all_.match(/.{0,30}(slide to unlock|Notification Center|Control Center|Spotlight|滑动来解锁|通知中心|控制中心|墙纸).{0,30}/i) || [''])[0]);

  const here = fileURLToPath(new URL('.', import.meta.url));
  const cur = readFileSync(`${here}../dist/index.html`, 'utf8');
  // The two earlier designs are kept for comparison on the author's Mac only: pages/dist/ is not
  // committed, so a fresh checkout (the workflows on GitHub) has neither file and skips that part.
  const keeps = (file, words) => !existsSync(file) || (readFileSync(file, 'utf8') !== cur && readFileSync(file, 'utf8').includes(words));
  const r1 = `${here}../dist/index-r1.html`;
  ok(keeps(r1, 'Swipe up to unlock'), 'dist/index-r1.html, where it is kept, keeps the first design for comparison');
  const i7 = `${here}../dist/index-ios7.html`;
  ok(keeps(i7, 'slide to unlock') && Buffer.byteLength(cur) <= 1500000, 'dist/index-ios7.html, where it is kept, keeps the iOS 7 restyle for comparison; the page stays within 1.5 MB');

  const external = api.requests.filter((u) => !/^(file|data|blob):/.test(u) && u !== 'about:blank');
  ok(external.length === 0, 'no external requests', JSON.stringify(external.slice(0, 5)));
  const errs = api.consoleMsgs.filter((m) => /error|EXCEPTION/i.test(m));
  ok(errs.length === 0, 'no console errors', JSON.stringify(errs.slice(0, 5)));
  console.log(`\n${pass} passed, ${fail} failed`);
  if (failures.length) console.log('failed:', failures.join(' | '));
  if (fail) process.exitCode = 1;
  else {
    // the About panel (#115) shows how many checks the last full run passed, and when (Albany's day)
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    writeFileSync(fileURLToPath(new URL('./last-run.json', import.meta.url)), `${JSON.stringify({ passed: pass, failed: 0, date: day, note: 'Written by pages/tests/test.mjs after a run with nothing failed; pages/build.py shows it in About this site.' }, null, 2)}\n`);
  }
}
