// Preview screenshots of every state.
//   OUT=<folder> node pages/tests/cdp.mjs pages/tests/shots.mjs
// Default folder: resume_2026-11/预览/pages (next to GitHub主页方案). App pages are taken full length.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const HERE = fileURLToPath(new URL('.', import.meta.url));

export default async function (api) {
  const out = process.env.OUT || resolve(HERE, '../../../../预览/pages');
  mkdirSync(out, { recursive: true });
  const D = { w: 1440, h: 900 };
  const P = { w: 390, h: 844, mobile: true };
  const shot = async (name) => {
    const t = await api.eval(`document.getElementById('hm').textContent`);
    if (t === '9:41') { await api.sleep(61000); } // never show that time
    console.log(await api.shot(`${out}/${name}.png`));
  };
  const at = async (vp, q, { light = false, wait = 1300 } = {}) => {
    await api.viewport(vp.w, vp.h, { mobile: !!vp.mobile, dark: !light });
    await api.go(q, wait);
    // the page has read its stored choices; forget them so the next picture starts clean
    await api.eval(`(() => { try { localStorage.clear(); } catch (e) {} })()`);
  };
  /** App pages: stretch the viewport to the content so the whole page is in one picture. */
  const full = async (vp, q, name, opts) => {
    await at(vp, q, opts);
    const h = await api.eval(`Math.ceil(document.getElementById('appBody').scrollHeight)`);
    await api.viewport(vp.w, Math.max(vp.h, h), { mobile: !!vp.mobile, dark: !(opts && opts.light) });
    await api.sleep(500);
    await shot(name);
  };
  let n = 1;
  const id = () => String(n++).padStart(2, '0');

  // lock screen: dark and light, desktop and phone
  await at(D, '?lang=en'); await shot(`${id()}-lock-dark-1440x900`);
  await at(D, '?lang=en', { light: true }); await shot(`${id()}-lock-light-1440x900`);
  await at(P, '?lang=en'); await shot(`${id()}-lock-dark-390x844`);
  await at(P, '?lang=en', { light: true }); await shot(`${id()}-lock-light-390x844`);
  await at(D, '?lang=en&page=3'); await shot(`${id()}-lock-widgets-end-1440x900`);
  await at(D, '?lang=en&weight=thin'); await shot(`${id()}-lock-thin-dark-1440x900`);

  // unlocking, mid-drag (the gesture is held while the picture is taken)
  await at(D, '?lang=en');
  const u = await api.eval(`(() => { const r = document.querySelector('#unlock .knob').getBoundingClientRect(); return {x: r.left + r.width / 2, y: r.top + r.height / 2}; })()`);
  await api.drag(u.x, u.y, u.x + 420, u.y, 16, 16, { release: false });
  await api.sleep(150);
  await shot(`${id()}-unlocking-mid-drag-1440x900`);
  await api.mouse('mouseReleased', u.x + 420, u.y);
  await at(P, '?lang=en');
  await api.touchSwipe(30, 140, 190, 140, 10, 16, { release: false });
  await api.sleep(150);
  await shot(`${id()}-unlocking-mid-drag-390x844`);
  await api.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  // home
  await at(D, '?lang=en#home'); await shot(`${id()}-home-dark-1440x900`);
  await at(D, '?lang=en#home', { light: true }); await shot(`${id()}-home-light-1440x900`);
  await at(P, '?lang=en#home', { light: true }); await shot(`${id()}-home-light-390x844`);

  // every app (light), plus dark variants
  const apps = [['silnest', 'SilNest'], ['storewright', 'Storewright'], ['site', 'Portfolio'], ['vocal', 'AI-Vocal'], ['how', 'How-I-work'], ['contact', 'Contact'], ['clock', 'Clock'], ['calendar', 'Calendar']];
  for (const [key, label] of apps) {
    await full(P, `?lang=en#home/${key}`, `${id()}-app-${label}-light-390`, { light: true });
  }
  await full(P, '?lang=en#home/silnest', `${id()}-app-SilNest-dark-390`);
  await full(D, '?lang=en#home/storewright', `${id()}-app-Storewright-dark-1440`);
  await full(D, '?lang=en#home/clock', `${id()}-app-Clock-dark-1440`);

  // the layers
  await at(P, '?lang=en&open=nc'); await shot(`${id()}-today-390x844`);
  await at(D, '?lang=en&open=nc-all'); await shot(`${id()}-today-all-updates-1440x900`);
  await at(P, '?lang=en&open=cc'); await shot(`${id()}-quick-settings-390x844`);
  await at(D, '?lang=en&open=cc', { light: true }); await shot(`${id()}-quick-settings-light-1440x900`);
  await at(D, '?lang=en&open=spotlight'); await shot(`${id()}-search-1440x900`);
  await at(P, '?lang=en&open=spotlight&q=storex#home'); await shot(`${id()}-search-query-390x844`);
  await at(P, '?lang=en&open=folder'); await shot(`${id()}-folder-early-work-390x844`);
  await at(P, '?lang=en&open=folder', { light: true });
  await api.eval(`document.querySelectorAll('.fapp')[4].focus()`);
  await api.sleep(200);
  await shot(`${id()}-folder-speedtest-light-390x844`);
  await at(D, '?lang=en&sheet=accuracy'); await shot(`${id()}-widget-panel-1440x900`);
  await at(P, '?lang=en&sheet=storewright', { light: true }); await shot(`${id()}-widget-panel-light-390x844`);

  // Chinese
  await at(P, '?lang=zh'); await shot(`${id()}-zh-lock-390x844`);
  await at(D, '?lang=zh', { light: true }); await shot(`${id()}-zh-lock-light-1440x900`);
  await at(D, '?lang=zh#home', { light: true }); await shot(`${id()}-zh-home-light-1440x900`);
  await at(P, '?lang=zh&open=nc'); await shot(`${id()}-zh-today-390x844`);
  await at(D, '?lang=zh&open=cc'); await shot(`${id()}-zh-quick-settings-1440x900`);
  await full(P, '?lang=zh#home/storewright', `${id()}-zh-app-Storewright-light-390`, { light: true });
  await at(P, '?lang=zh&open=folder'); await shot(`${id()}-zh-folder-390x844`);

  // R3.2: planets as apps, the Moon, time travel, the Sky app, commands, shortcuts, guestbook
  n = 40;
  const stretch = async (vp, light) => {
    const h = await api.eval(`Math.ceil(document.getElementById('appBody').scrollHeight)`);
    await api.viewport(vp.w, Math.max(vp.h, h), { mobile: !!vp.mobile, dark: !light });
    await api.sleep(700);
  };
  const hoverPlanet = async (planet) => {
    const o = await api.eval(`(() => { const r = document.getElementById('orbit').getBoundingClientRect(); return {x: r.left + 6, y: r.bottom - 6}; })()`);
    await api.move(o.x, o.y);
    await api.sleep(700);
    const p = await api.eval(`(() => { const r = document.querySelector('.pl-btn[data-planet="${planet}"]').getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2}; })()`);
    await api.move(p.x, p.y);
    await api.sleep(500);
  };
  const skyAt = async (iso, tonight) => {
    await api.eval(`(() => { const d = document.getElementById('skyDate'); d.value = '${iso}'; d.dispatchEvent(new Event('change', {bubbles: true})); })()`);
    await api.sleep(200);
    if (tonight) await api.eval(`document.querySelector('#skyMode [data-sky="tonight"]').click()`);
    await api.sleep(300);
  };
  const slide = async (v) => {
    await api.eval(`(() => { const r = document.getElementById('ttRange'); r.value = '${v}'; r.dispatchEvent(new Event('input', {bubbles: true})); })()`);
    await api.sleep(1400);
  };
  await at(D, '?lang=en'); await hoverPlanet('jupiter'); await shot(`${id()}-planet-card-1440x900`);
  await at(D, '?lang=en', { light: true }); await hoverPlanet('earth'); await shot(`${id()}-planet-card-earth-moon-light-1440x900`);
  await api.move(5, 5);
  await at(D, '?lang=en&open=tt'); await slide(1020); await shot(`${id()}-time-travel-today-1440x900`);
  await at(P, '?lang=en&open=tt-dates', { light: true }); await slide(30); await shot(`${id()}-time-travel-dates-light-390x844`);
  await at(D, '?lang=en#sky/albany'); await skyAt('2026-11-14', true); await stretch(D, false); await shot(`${id()}-sky-albany-tonight-dark-1440`);
  await at(P, '?lang=en#sky/sydney'); await skyAt('2026-11-14', true); await stretch(P, false); await shot(`${id()}-sky-sydney-390`);
  await at(D, '?lang=en#sky/tromso', { light: true }); await skyAt('2026-12-15', true); await stretch(D, true); await shot(`${id()}-sky-tromso-polar-night-light-1440`);
  await at(D, '?lang=en#sky/albany'); await skyAt('2026-11-14', true);
  await api.eval(`document.getElementById('skyRed').click()`); await api.sleep(300); await stretch(D, false); await shot(`${id()}-sky-night-vision-1440`);
  await at(P, '?lang=zh#sky/beijing'); await skyAt('2026-11-14', true); await stretch(P, false); await shot(`${id()}-zh-sky-beijing-390`);
  await at(D, '?lang=en#home', { light: true }); await shot(`${id()}-home-tonight-light-1440x900`);
  await at(D, '?lang=en&open=spotlight&q=%3E'); await shot(`${id()}-search-commands-1440x900`);
  await at(D, '?lang=en&open=spotlight&q=%3Esky%20to'); await shot(`${id()}-search-command-sky-1440x900`);
  await at(D, '?lang=en&open=keys'); await shot(`${id()}-shortcuts-1440x900`);
  await at(P, '?lang=zh&open=keys', { light: true }); await shot(`${id()}-zh-shortcuts-light-390x844`);
  await full(P, '?lang=en#home/contact', `${id()}-contact-guestbook-390`);
  await full(D, '?lang=en#home/storewright', `${id()}-app-Storewright-frame-light-1440`, { light: true });

  // R3.3: About this site, the tour, standby, more contrast; How I work, the project pages and the
  // pick game; the recruiter views (#brief, #present); the site's own pages (Assets, Design)
  n = 70;
  /** A layer that scrolls on its own (#brief): stretch the viewport to its content. */
  const fullOf = async (vp, q, name, sel, opts = {}) => {
    await at(vp, q, opts);
    const h = await api.eval(`Math.ceil(document.querySelector('${sel}').scrollHeight)`);
    await api.viewport(vp.w, Math.max(vp.h, h), { mobile: !!vp.mobile, dark: !opts.light });
    await api.sleep(500);
    await shot(name);
  };
  await at(D, '?lang=en&open=about'); await shot(`${id()}-about-1440x900`);
  await at(P, '?lang=zh&open=about', { light: true }); await shot(`${id()}-zh-about-light-390x844`);
  await at(D, '?lang=en&tour=1'); await shot(`${id()}-tour-1440x900`);
  await at(D, '?lang=en&standby=1', { wait: 3500 }); await shot(`${id()}-standby-1440x900`);
  await at(D, '?lang=en#home');
  await api.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }, { name: 'prefers-contrast', value: 'more' }] });
  await api.sleep(500); await shot(`${id()}-home-more-contrast-1440x900`);
  await full(D, '?lang=en#home/how', `${id()}-app-How-I-work-dark-1440`);
  await full(D, '?lang=zh#home/how', `${id()}-zh-app-How-I-work-light-1440`, { light: true });
  await full(D, '?lang=en#home/silnest', `${id()}-app-SilNest-light-1440`, { light: true });
  await full(D, '?lang=en#guestbook', `${id()}-app-Contact-guestbook-link-1440`);
  await full(D, '?lang=zh#home/calendar', `${id()}-zh-app-Calendar-dark-1440`);
  // the pick game (#121), then with the best route shown
  await full(D, '?lang=en#home/storewright', `${id()}-app-Storewright-dark-1440-full`);
  const gameClip = `(() => { const b = document.getElementById('game').getBoundingClientRect(); return {x: Math.round(b.left), y: Math.round(b.top), width: Math.round(b.width), height: Math.round(b.height)}; })()`;
  console.log(await api.shot(`${out}/${id()}-pick-game-1440.png`, await api.eval(gameClip)));
  await api.eval(`document.getElementById('sgShow').click()`); await api.sleep(600);
  console.log(await api.shot(`${out}/${id()}-pick-game-best-route-1440.png`, await api.eval(gameClip)));
  await fullOf(D, '?lang=en#brief', `${id()}-brief-light-1440`, '#brief', { light: true });
  await fullOf(P, '?lang=zh#brief', `${id()}-zh-brief-390`, '#brief');
  // the quick view printed: it must fit on one Letter page
  await at(D, '?lang=en#brief', { light: true });
  const pdf = await api.send('Page.printToPDF', { paperWidth: 8.5, paperHeight: 11, printBackground: false });
  writeFileSync(`${out}/brief-print-letter.pdf`, Buffer.from(pdf.data, 'base64'));
  console.log(`${out}/brief-print-letter.pdf`);
  await at(D, '?lang=en#present/1'); await shot(`${id()}-present-1-1440x900`);
  await at(D, '?lang=en#present/3', { light: true }); await shot(`${id()}-present-3-light-1440x900`);
  await at(P, '?lang=zh#present/2'); await shot(`${id()}-zh-present-2-390x844`);
  await full(D, '?lang=en#home/assets', `${id()}-app-Assets-dark-1440`);
  await full(P, '?lang=en#home/assets', `${id()}-app-Assets-light-390`, { light: true });
  await full(D, '?lang=en#home/design', `${id()}-app-Design-light-1440`, { light: true });
  await at(D, '?lang=en#present/6'); await shot(`${id()}-present-6-contact-1440x900`);

  // R3.3, the user's decisions of 2026-11-15: the What if lab on the Storewright page (#169), Uses
  // (#153) and the land on the Clock app's day and night map (#142)
  n = 92;
  const clipOf = (sel) => `(() => { const b = document.querySelector('${sel}').getBoundingClientRect(); return {x: Math.round(b.left), y: Math.round(b.top), width: Math.round(b.width), height: Math.round(b.height)}; })()`;
  await full(D, '?lang=en#home/storewright', `${id()}-app-Storewright-with-lab-dark-1440-full`);
  console.log(await api.shot(`${out}/${id()}-what-if-lab-1440.png`, await api.eval(clipOf('#whatIf'))));
  await api.eval(`(() => { const r = document.getElementById('wi-pickers'); r.value = 9; r.dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('wiRun').click(); })()`);
  await api.sleep(1500);
  console.log(await api.shot(`${out}/${id()}-what-if-lab-9-pickers-1440.png`, await api.eval(clipOf('#whatIf'))));
  await full(P, '?lang=zh#home/storewright', `${id()}-zh-app-Storewright-lab-light-390`, { light: true });
  await full(D, '?lang=en#home/uses', `${id()}-app-Uses-dark-1440`);
  await full(D, '?lang=en#home/clock', `${id()}-app-Clock-light-1440`, { light: true });
  console.log(await api.shot(`${out}/${id()}-day-night-map-land-light-1440.png`, await api.eval(clipOf('#wmap'))));
  await full(D, '?lang=en#home/clock', `${id()}-app-Clock-dark-1440`);
  console.log(await api.shot(`${out}/${id()}-day-night-map-land-dark-1440.png`, await api.eval(clipOf('#wmap'))));

  const external = api.requests.filter((x) => !/^(file|data|blob):/.test(x) && x !== 'about:blank');
  console.log('external requests:', external.length, '| console errors:', api.consoleMsgs.filter((m) => /error|EXCEPTION/i.test(m)).length);
}
