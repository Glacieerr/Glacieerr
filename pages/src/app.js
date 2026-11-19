/* Lock Screen Widgets: the page script ("Dusk Tech").
   Everything comes from the inline #data block (built by pages/build.py); nothing is fetched.
   The build inlines live/ ahead of this file: LockCore (the same Albany clock as the README
   banner), Astro (planets, the Moon, rise and set), SkyData (stars and cities) and SkyChart.
   The one exception to "nothing is fetched" is the guestbook: after a click, and only once its
   ids are filled in, it loads giscus. R3.3 batch 1b also inlines live/holidays.mjs (Holidays).
   R3.3 batch 2 adds the shell around it: the visitor's time and a greeting (#114, #152), About
   this site (#115, #122, #147, #176), standby (#118), the first-visit tour (#119), the QR code and
   the share sheet (#120, #151), the wallpapers and the assets page (#145, #172), the design rules
   (#146), the guestbook on the home screen and at #guestbook (#148), Uses, booking, testimonials
   and SilNest's release notes once they exist (#153, #160, #161, #171).
   R3.3 batch 3 adds the work and what recruiters need: the sun glow in Albany's sky colour (#97),
   the FAQ, one real change, the skill map and the timeline in How I work (#53, #156, #110, #111),
   who did what and the numbers on the project pages (#157, #158), "Ask me about" and the public
   resumes in Contact (#113, #66), the quick view at #brief (#154), present mode at #present
   (#155) and the Storewright pick game (#121).
   Finished on 2026-11-15: the land on the day and night map (#142), the What if… lab under the
   store day, which runs Storewright's own simulation only when asked (#169), the solar terms on
   their Beijing dates in Chinese (#95) and a plain "Hello" before 5 AM (#152). */
(() => {
  'use strict';

  const D = JSON.parse(document.getElementById('data').textContent);
  const doc = document;
  const root = doc.documentElement;
  const body = doc.body;
  const $ = (s, el = doc) => el.querySelector(s);
  const $$ = (s, el = doc) => Array.from(el.querySelectorAll(s));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const fmt = (s, o) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in o ? o[k] : m));
  const pick = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked: the choice lasts for this visit */ } },
  };
  const query = new URLSearchParams(location.search);
  const mqLight = matchMedia('(prefers-color-scheme: light)');
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const wide = () => (innerWidth || 0) >= 700;

  // the apps of this build: the nine apps, the site's own pages (Design, Assets) and Uses (the user
  // confirmed it on 2026-11-15; pages/build.py decides)
  const APPS = D.apps;
  const SITE_PAGES = ['design', 'assets', 'uses'].filter((k) => APPS.includes(k));
  // #148: the guestbook has a tile of its own; it opens Contact at the guestbook
  const GRID = ['silnest', 'storewright', 'site', 'vocal', 'sky', 'early', 'guestbook'];
  const D2R = Math.PI / 180;
  const wrap180 = (x) => ((((x + 180) % 360) + 360) % 360) - 180;
  const DOCK = ['how', 'contact', 'clock', 'calendar'];
  const WIDGET_APP = { silnest: 'silnest', storewright: 'storewright', 'store-day': 'storewright', accuracy: 'storewright', site: 'site', vocal: 'vocal', contact: 'contact' };
  const hasDay = !!(D.day && D.day.date && Array.isArray(D.day.headline));
  const WIDGETS = [['silnest', 'm'], ['storewright', 'm'], ['store-day', 's'], ['accuracy', 's'], ['site', 'm'], ['vocal', 's'], ['contact', 's']]
    .filter(([k]) => k !== 'store-day' || hasDay).map(([key, size]) => ({ key, size }));
  const NOTES = D.notes.filter((n) => n.key !== 'store-day' || hasDay);

  let reduced = root.classList.contains('reduced');
  let lang = root.dataset.lang === 'zh' ? 'zh' : 'en';
  let apPref = root.dataset.appearancePref || 'auto';
  let appearance = root.dataset.appearance === 'light' ? 'light' : 'dark';
  let weight = root.classList.contains('thin') ? 'thin' : 'bold';
  let parallaxOn = !root.classList.contains('no-parallax');
  const C = () => D.copy[lang];
  const LOC = () => (lang === 'zh' ? 'zh-CN' : 'en-US');

  const E = {
    topbar: $('#topbar'), lockBtn: $('#lockBtn'), ncGrab: $('#ncGrab'), ccGrab: $('#ccGrab'), searchBtn: $('#searchBtn'),
    sbTime: $('#sbTime'), kbdHint: $('#kbdHint'), wall: $('#wall'), wallMove: $('#wallMove'), lunar: $('#lunar'), fest: $('#fest'),
    lock: $('#lock'), lockFg: $('#lockFg'), lockInner: $('#lockInner'), noteList: $('#noteList'), orbit: $('#orbit'),
    widgets: $('#widgets'), track: $('#track'), dots: $('#dots'), unlock: $('#unlock'),
    hm: $('#hm'), sec: $('#sec'), ap: $('#ap'), date: $('#date'), timeSr: $('#timeSr'),
    home: $('#home'), homeScroll: $('#homeScroll'), homePage: $('#homePage'), homeTitle: $('#homeTitle'), homeTime: $('#homeTime'),
    grid: $('#grid'), dockList: $('#dockList'), dock: $('.dock'),
    plBtns: $('#plBtns'), plCard: $('#plCard'), tonightW: $('#tonightW'),
  };
  const A = { layer: $('#appLayer'), view: $('#appView'), title: $('#appTitle'), body: $('#appBody'), back: $('#appBack') };
  const F = { layer: $('#folderLayer'), scrim: $('#folderScrim'), box: $('#folder'), title: $('#folderTitle'), grid: $('#folderGrid'), detail: $('#folderDetail') };
  const SP = { layer: $('#spot'), scrim: $('#spotScrim'), panel: $('#spotPanel'), input: $('#spotInput'), cancel: $('#spotCancel'), list: $('#spotList'), count: $('#spotCount') };
  const S = {
    layer: $('#sheetLayer'), scrim: $('#sheetScrim'), sheet: $('#sheet'), icon: $('#sheetIcon'),
    kicker: $('#sheetKicker'), title: $('#sheetTitle'), desc: $('#sheetDesc'), stats: $('#sheetStats'),
    foot: $('#sheetFoot'), links: $('#sheetLinks'), note: $('#sheetNote'), close: $('#sheetClose'), open: $('#sheetOpen'),
  };
  const NC = {
    layer: $('#nc'), scrim: $('#ncScrim'), panel: $('#ncPanel'), scroll: $('#ncScroll'), tabToday: $('#ncTabToday'), tabAll: $('#ncTabAll'),
    today: $('#ncToday'), all: $('#ncAll'), date: $('#ncDate'), summary: $('#ncSummary'), season: $('#ncSeason'), widgets: $('#ncWidgets'),
    notes: $('#ncNotes'), close: $('#ncClose'),
  };
  const CC = {
    layer: $('#cc'), scrim: $('#ccScrim'), panel: $('#ccPanel'), close: $('#ccClose'), appearance: $('#ccAppearance'),
    lang: $('#ccLang'), weight: $('#ccWeight'), motion: $('#ccMotion'), parallax: $('#ccParallax'), tt: $('#ccTt'), sound: $('#ccSound'), standby: $('#ccStandby'),
  };
  const TT = {
    bar: $('#tt'), badge: $('#ttBadge'), badgeTxt: $('#ttBadgeTxt'), scale: $('#ttScale'), range: $('#ttRange'),
    ticks: $('#ttTicks'), now: $('#ttNow'), close: $('#ttClose'), mode: 'day', open: false, timer: 0, dragging: false, opener: null,
  };
  const K = { layer: $('#keys'), scrim: $('#keysScrim'), panel: $('#keysPanel'), title: $('#keysTitle'), close: $('#keysClose'), list: $('#keysList') };
  // R3.3 batch 2: About this site (#115), standby (#118), the tour (#119)
  const AB = { layer: $('#ab'), scrim: $('#abScrim'), panel: $('#abPanel'), title: $('#abTitle'), close: $('#abClose'), body: $('#abBody') };
  const SB = {
    el: $('#standby'), orbit: $('#stbOrbit'), hm: $('#stbHm'), ap: $('#stbAp'), date: $('#stbDate'), sr: $('#stbSr'),
    on: false, auto: store.get('ls7-standby') === 'on', idleMs: 60000, last: Date.now(), at: 0, x: null, y: null, ret: null,
  };
  const TR = {
    el: $('#tour'), step: $('#tourStep'), title: $('#tourTitle'), text: $('#tourText'), skip: $('#tourSkip'), next: $('#tourNext'),
    arrow: $('#tourArrow'), live: $('#tourLive'), i: -1, timer: 0,
  };
  E.greet = $('#greet');
  E.siteLinks = $('#siteLinks');
  const mac = /mac|iphone|ipad|ipod/i.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '');
  const searchKey = () => (mac ? '⌘K' : 'Ctrl K');

  // ---------------------------------------------------------------- time
  // Albany time from LockCore.parts(): weekday, month, day, hour, minute, second, dayPeriod, h24.
  const TZ = D.tz;
  // Time travel (idea #82): the page keeps one virtual clock. vnow() is the real time plus
  // ttOffset; everything that shows the time (the clock, the store-day card, the planets, the
  // Moon, the Sky app) reads vnow(), so they all travel together.
  let ttOffset = 0;
  const vnow = () => Date.now() + ttOffset;
  const travelling = () => ttOffset !== 0;
  let P = LockCore.parts(new Date(), TZ);
  let zhWeek = null;
  let monthNum = null;
  let isoFmt = null;
  try { zhWeek = new Intl.DateTimeFormat('zh-CN', { timeZone: TZ, weekday: 'long' }); } catch (e) { /* older browsers */ }
  try { monthNum = new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'numeric' }); } catch (e) { /* older browsers */ }
  try { isoFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }); } catch (e) { /* older browsers */ }
  const setText = (el, s) => { if (el && el.textContent !== String(s)) el.textContent = s; };
  const period = () => (lang === 'zh' ? (P.h24 < 12 ? C().am : C().pm) : P.dayPeriod);
  const localTime = () => (lang === 'zh' ? `${period()} ${P.hour}:${P.minute}` : `${P.hour}:${P.minute} ${period()}`);
  const timeHMS = () => (lang === 'zh' ? `${period()} ${P.hour}:${P.minute}:${P.second}` : `${P.hour}:${P.minute}:${P.second} ${period()}`);
  const calWd = (now = new Date()) => (lang === 'zh' && zhWeek ? zhWeek.format(now) : P.weekday);
  const calWdShort = (now = new Date()) => (lang === 'zh' ? (zhWeek ? zhWeek.format(now).replace('星期', '周') : '') : String(P.weekday).slice(0, 3));
  function dateLine(now = new Date()) {
    return lang === 'zh'
      ? `${monthNum ? monthNum.format(now) : ''}月${P.day}日 ${zhWeek ? zhWeek.format(now) : ''}`.trim()
      : `${P.weekday}, ${P.month} ${P.day}`;
  }
  /** Albany's date as YYYY-MM-DD. */
  function albanyISO(now = new Date()) {
    if (!isoFmt) return now.toISOString().slice(0, 10);
    const o = {};
    for (const x of isoFmt.formatToParts(now)) o[x.type] = x.value;
    return `${o.year}-${o.month}-${o.day}`;
  }
  const isoParts = (iso) => String(iso).split('-').map(Number);
  function fmtDate(iso, opts) {
    const [y, m, d] = isoParts(iso);
    return new Intl.DateTimeFormat(LOC(), { timeZone: 'UTC', ...opts }).format(new Date(Date.UTC(y, (m || 1) - 1, d || 1)));
  }
  const isMonth = (iso) => /^\d{4}-\d{2}$/.test(iso);
  const sameYear = (iso) => String(iso).slice(0, 4) === albanyISO().slice(0, 4);
  /** Short label for a fact's date: "Sep 8", "Nov 2026" (a month only), "Sep 8, 2025" (another year). */
  const whenShort = (iso) => (isMonth(iso) ? fmtDate(iso, { month: 'short', year: 'numeric' })
    : fmtDate(iso, sameYear(iso) ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' }));
  const whenLong = (iso) => (isMonth(iso) ? fmtDate(iso, { month: 'long', year: 'numeric' })
    : fmtDate(iso, { month: 'long', day: 'numeric', year: 'numeric' }));
  const whenMD = (iso) => fmtDate(iso, sameYear(iso) ? { month: 'long', day: 'numeric' } : { month: 'long', day: 'numeric', year: 'numeric' });
  function dayDiff(a, b) {
    const [y1, m1, d1] = isoParts(a);
    const [y2, m2, d2] = isoParts(b);
    return Math.round((Date.UTC(y1, m1 - 1, d1) - Date.UTC(y2, m2 - 1, d2)) / 86400000);
  }
  /** Clock-hand angles. Albany's offset is whole hours, so minutes and seconds match UTC. */
  function handAngles(ms = vnow()) {
    const s = Math.floor(ms / 1000) % 60;
    const m = Math.floor(ms / 60000) % 60;
    const h = (P.h24 || 0) % 12;
    return { h: (h + m / 60) * 30, m: (m + s / 60) * 6, s: s * 6 };
  }

  // ---------------------------------------------------------------- the Chinese calendar, festivals, the tab icon (#95, #150, #104)
  // #95: in Chinese the date gets its lunar date and the solar term in force ("农历十月初六 · 立冬"),
  // and Today names the next term. The lunar date is chineseDate() in live/astro.mjs: the
  // browser's own Chinese calendar, checked against the festival dates in live/holidays.mjs (a
  // browser without one shows only the solar term). The terms are solarTerms(), each on its date
  // in Beijing time, as Chinese calendars print them (11 of the 24 fell a day later in Beijing
  // than in Albany in 2026: 清明 on April 5, not April 4). Dates are calendar labels: the Albany
  // date the page shows takes the term whose Beijing date is the latest on or before it, and the
  // next-term line gives the next term's Beijing date (the days to it counted from the Albany
  // date, its time in Beijing time). In English the equinoxes and solstices keep their Albany
  // dates, as American calendars print them.
  // #150: New Year's Day, the Spring Festival and the Mid-Autumn Festival get the README's small
  // touches: a firework after the date, a greeting, the Moon beside Earth glowing a little. The
  // dates come from live/holidays.mjs (2024 to 2035), else from the Chinese calendar. They follow
  // time travel.
  // #104: the tab's icon is today's Moon, an SVG drawn here (nothing is fetched); it is redrawn
  // when the lit part has grown or shrunk by about 2%.
  const DAY = 86400000;
  const lunarOf = (iso) => { const [y, m, d] = isoParts(iso); return Astro.chineseDate(y, m, d, Holidays); };
  function lunarText(L) {
    const c = C().lunar;
    const mo = c.months[L.m - 1];
    return fmt(c.date, { month: L.leap ? fmt(c.leap, { month: mo }) : mo, day: c.days[L.d - 1] });
  }
  // Chinese calendars date the terms in Beijing time, UTC+8. The page uses that offset for every
  // year (also the summers of 1986 to 1991, when China's clocks moved an hour), so a term's date
  // in Beijing is the date of its moment plus 8 hours.
  const BJ = 8 * 3600000;
  const BJ_TZ = 'Etc/GMT-8';              // UTC+8 for Intl (IANA's Etc names count the other way)
  const bjISO = (ms) => new Date(ms + BJ).toISOString().slice(0, 10);
  /** The solar terms around the Albany date `iso`, each with its Beijing date ({t, lon, i, bj}):
   *  the one in force (the latest whose Beijing date is on or before `iso`) and the next one. The
   *  next is a term dated after `iso` in Beijing, or one dated `iso` whose moment is still after t
   *  (then the line says "today" and its time in Beijing). Kept while the date and its side of
   *  that moment stay the same. */
  const ST = { iso: '', list: [], today: null, key: '', cur: null, next: null };
  function termsAt(t) {
    const iso = albanyISO(new Date(t));
    if (iso !== ST.iso) {
      const [y, m, d] = isoParts(iso);
      const day = Date.UTC(y, m - 1, d);
      ST.iso = iso;
      ST.list = Astro.solarTerms(day - 20 * DAY - BJ, day + 21 * DAY - BJ).map((x) => ({ ...x, bj: bjISO(x.t) }));
      ST.today = ST.list.find((x) => x.bj === iso) || null;
      ST.key = '';
    }
    const key = ST.today && ST.today.t > t ? 'before' : 'after';
    if (key === ST.key) return ST;
    ST.key = key;
    ST.cur = null;
    ST.next = null;
    for (const x of ST.list) {
      if (x.bj <= iso) ST.cur = x;
      if (!ST.next && (x.bj > iso || (x.bj === iso && x.t > t))) ST.next = x;
    }
    return ST;
  }
  /** "农历十月初六 · 立冬" (or the term alone) for the Albany date of moment t. */
  function lunarLine(t) {
    const L = lunarOf(albanyISO(new Date(t)));
    const T = termsAt(t);
    const term = T.cur ? C().lunar.terms[T.cur.i] : '';
    return L ? fmt(C().lunar.line, { date: lunarText(L), term }) : term;
  }
  /** "下一个节气：小雪，11月22日（北京时间，还有 8 天）": the next term's Beijing date, the days to
   *  it counted from the Albany date shown; on the day itself, its time in Beijing. */
  function nextTermLine(t) {
    const T = termsAt(t);
    if (!T.next) return '';
    const c = C().lunar;
    const n = dayDiff(T.next.bj, albanyISO(new Date(t)));
    const term = c.terms[T.next.i];
    if (n <= 0) return fmt(c.nextToday, { term, time: timeIn(Math.round(T.next.t / 60000) * 60000, BJ_TZ) });
    return fmt(n === 1 ? c.nextTomorrow : c.next, { term, n, date: fmtDate(T.next.bj, { month: 'long', day: 'numeric' }) });
  }
  /** 'new-year' | 'spring-festival' | 'mid-autumn' | null for a Gregorian date. */
  function festivalOn(y, m, d) {
    if (y >= Holidays.FIRST && y <= Holidays.LAST) return Holidays.festivalOn(y, m, d);
    if (m === 1 && d === 1) return 'new-year';
    const L = Astro.chineseDate(y, m, d);
    if (L && !L.leap && L.m === 1 && L.d === 1) return 'spring-festival';
    if (L && !L.leap && L.m === 8 && L.d === 15) return 'mid-autumn';
    return null;
  }
  /** Under the date: the lunar line (Chinese); after it, the festival's touch. */
  function paintDateExtras(now) {
    const zh = lang === 'zh';
    E.lunar.hidden = !zh;
    if (zh) setText(E.lunar, lunarLine(now.getTime()));
    const [y, m, d] = isoParts(albanyISO(now));
    const f = festivalOn(y, m, d) || '';
    if (E.fest.dataset.f === f && E.fest.dataset.lang === lang) return;
    E.fest.dataset.f = f;
    E.fest.dataset.lang = lang;
    E.fest.className = `fest${f === 'spring-festival' ? ' greet' : ''}`;
    E.fest.innerHTML = f === 'new-year' ? '<span aria-hidden="true">✺</span>' : f === 'spring-festival' ? esc(C().fest.spring) : '';
    E.fest.hidden = !E.fest.innerHTML;
    root.classList.toggle('fest-mid-autumn', f === 'mid-autumn');
    root.dataset.festival = f;
  }
  let favKey = '';
  function paintFavicon() {
    const m = Astro.moonPhase(Date.now());
    const key = `${Math.round(m.illum * 50)}${m.waxing ? '+' : '-'}`;
    if (key === favKey) return;
    favKey = key;
    const lit = Astro.moonPhasePath(32, 32, 21, m.illum, m.waxing);
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="b" x1="0" y1="0" x2="0" y2="1">'
      + '<stop offset="0" stop-color="#171a2b"/><stop offset="1" stop-color="#08090c"/></linearGradient></defs>'
      + '<rect width="64" height="64" rx="15" fill="url(#b)"/><circle cx="32" cy="32" r="21" fill="#2c3147"/>'
      + `${lit ? `<path d="${lit}" fill="#f3f1e8"/>` : ''}<circle cx="32" cy="32" r="21" fill="none" stroke="#ffffff" stroke-opacity=".45" stroke-width="1.5"/></svg>`;
    let link = $('link[rel="icon"]');
    if (!link) { link = doc.createElement('link'); link.rel = 'icon'; doc.head.append(link); }
    link.type = 'image/svg+xml';
    link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    link.dataset.moon = key;
  }

  // ---------------------------------------------------------------- the simulated store day
  const dayItem = (label) => (hasDay ? D.day.headline.find((i) => i.label === label) : null);
  const dayVal = (it) => (typeof it.value === 'number' && Number.isInteger(it.value) ? it.value.toLocaleString(LOC()) : String(it.value));
  const showUnit = (it) => !!it.unit && !it.label.toLowerCase().includes(String(it.unit).toLowerCase());
  const dayUnit = (it) => { const u = C().day.units[it.unit]; return u == null ? it.unit : u; };
  const dayLabel = (it) => C().day.labels[it.label] || it.label.toLowerCase();
  const dayLabelCap = (it) => (lang === 'zh' ? dayLabel(it) : it.label);
  const dayValUnit = (it) => dayVal(it) + (showUnit(it) ? (it.unit === '%' ? '%' : ` ${dayUnit(it)}`) : '');
  function dayNote() {
    const o = dayItem('Orders fulfilled');
    const r = dayItem('Ready on time');
    return fmt(C().day.note, { orders: o ? dayVal(o) : '', ontime: r ? r.value : '' });
  }

  // ---------------------------------------------------------------- icons
  // The README's app tiles: a dark (or white) rounded square with a gradient edge and an
  // indigo -> teal line glyph from the inline sprite. SilNest uses its real icon.
  function clockFace(cls) {
    let ticks = '';
    for (let i = 0; i < 12; i += 3) ticks += `<line class="tk" x1="12" y1="4.4" x2="12" y2="5.5" transform="rotate(${i * 30} 12 12)"/>`;
    const a = handAngles();
    return `<span class="${cls}" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><circle class="face" cx="12" cy="12" r="8.8"/>${ticks}`
      + `<line class="hh" data-hand="h" x1="12" y1="12.8" x2="12" y2="8.1" transform="rotate(${a.h.toFixed(2)} 12 12)"/>`
      + `<line class="mh" data-hand="m" x1="12" y1="13" x2="12" y2="5.9" transform="rotate(${a.m.toFixed(2)} 12 12)"/>`
      + `<line class="sh" data-hand="s" x1="12" y1="14.2" x2="12" y2="5.3" transform="rotate(${a.s.toFixed(2)} 12 12)"/>`
      + '<circle class="pin" cx="12" cy="12" r=".95"/></svg></span>';
  }
  function icon(key, cls = '') {
    const c = cls ? ` ${cls}` : '';
    if (key === 'silnest') return `<span class="ico ico-img img-sn-icon${c}" aria-hidden="true"></span>`;
    if (key === 'clock') return clockFace(`ico ico-clock${c}`);
    if (key === 'calendar') {
      return `<span class="ico ico-cal${c}" aria-hidden="true"><span class="cal-wd" data-cal="wd">${esc(calWdShort())}</span>`
        + `<span class="cal-d" data-cal="d">${esc(P.day)}</span></span>`;
    }
    return `<span class="ico${c}" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><use href="#g-${key}"/></svg></span>`;
  }
  const extIcon = '<svg class="ext" width="14" height="14" aria-hidden="true" focusable="false"><use href="#u-ext"/></svg>';
  const wIcon = (g, cls = 'w-ic') => `<svg class="${cls}" aria-hidden="true" focusable="false"><use href="#w-${g}"/></svg>`;

  // ---------------------------------------------------------------- widgets (the README cards, as HTML so they can be translated)
  function spark(points, uid, mark = null) {
    if (!points || points.length < 2) return '';
    const W = 142;
    const H = 24;
    const pd = 2;
    const max = Math.max(...points) || 1;
    const n = points.length;
    const pts = points.map((v, i) => [pd + (i * (W - 2 * pd)) / (n - 1), H - pd - (v / max) * (H - 2 * pd)]);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
    const area = `${line}L${pts[n - 1][0].toFixed(1)},${H}L${pts[0][0].toFixed(1)},${H}Z`;
    const pk = pts[points.indexOf(Math.max(...points))];
    const id = `spk-${uid}`;
    let dot = `<circle cx="${pk[0].toFixed(1)}" cy="${pk[1].toFixed(1)}" r="2.6" style="fill:var(--teal)"/>`;
    if (mark != null) {
      // time travel: a hairline at the virtual time and a dot on the curve
      const f = clamp(mark, 0, n - 1);
      const i0 = Math.floor(f);
      const i1 = Math.min(n - 1, i0 + 1);
      const x = pd + (f * (W - 2 * pd)) / (n - 1);
      const y = pts[i0][1] + (pts[i1][1] - pts[i0][1]) * (f - i0);
      dot = `<line class="sp-mark" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="-3" y2="${H}" style="stroke:var(--indigo)" stroke-width="1.2"/>`
        + `<circle class="sp-mark-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.8" style="fill:var(--indigo)"/>`;
    }
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false"><defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1">`
      + '<stop offset="0" style="stop-color:var(--teal)" stop-opacity=".32"/><stop offset="1" style="stop-color:var(--teal)" stop-opacity="0"/></linearGradient></defs>'
      + `<path d="${area}" fill="url(#${id})"/><path d="${line}" fill="none" style="stroke:var(--teal)" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>`
      + `${dot}</svg>`;
  }
  /** Time travel replays the simulated store day: the items picked so far, hour by hour, from
   *  the day's own per-hour series (whole hours only, so nothing is made up). */
  function dayReplay() {
    const sr = hasDay && D.day.series;
    if (!travelling() || !sr || !Array.isArray(sr.points)) return null;
    const [sh, sm] = String(sr.start || '00:00').split(':').map(Number);
    const start = sh * 60 + (sm || 0);
    const mins = P.h24 * 60 + Number(P.minute);
    const by = Math.floor(mins / 60) * 60;
    let sum = 0;
    sr.points.forEach((v, k) => { if (start + 60 * (k + 1) <= by) sum += v; });
    const label = new Intl.DateTimeFormat(LOC(), { timeZone: 'UTC', hour: 'numeric' }).format(new Date(Date.UTC(2000, 0, 1, by / 60, 0)));
    return { sum, label, mark: (mins - start) / 60, time: localTime() };
  }

  function widgetHTML(key, uid) {
    const w = C().w[key] || {};
    const hd = (g, title, rt = '') => `<div class="w-hd">${wIcon(g)}<b>${esc(title)}</b>${rt ? `<span class="rt">${esc(rt)}</span>` : ''}</div>`;
    switch (key) {
      case 'silnest':
        return '<div class="wc wc-sn"><div class="w-shot img-sn-s1"></div>'
          + `<div class="t1">${icon('silnest')}<div><div><b>${esc(w.title)}</b><span class="zh" lang="zh-CN">${esc(w.titleZh)}</span></div>`
          + `<div class="s">${esc(w.sub)}</div></div></div>`
          + `<p class="w-quote">${esc(w.line)}</p><p class="priv">${wIcon('shield', '')}${esc(w.privacy)}</p>`
          + `<div class="w-chips"><span class="w-chip">${esc(w.store)}</span></div></div>`;
      case 'storewright':
        return `<div class="wc wc-sw"><div class="w-shot img-sw-world"></div>${hd('cube', w.title, w.release)}`
          + `<p class="desc">${esc(w.desc)}</p>`
          + `<p class="big"><span class="w-num">${esc(D.facts.sw.tests)}</span><span>${esc(w.unit)}</span>${wIcon('check', '')}</p>`
          + `<div class="w-chips"><span class="w-chip acc">${esc(w.demo)}${wIcon('arrow', '')}</span></div></div>`;
      case 'store-day': {
        const o = dayItem('Orders fulfilled');
        const rows = ['Avg pickup wait', 'Ready on time'].map(dayItem).filter(Boolean);
        const rp = dayReplay();
        const big = rp ? `<p class="big replay"><span class="w-num">${esc(rp.sum.toLocaleString(LOC()))}</span><span>${esc(fmt(C().tt.storeBy, { time: rp.label }))}</span></p>`
          : (o ? `<p class="big"><span class="w-num">${esc(dayVal(o))}</span><span>${esc(dayLabel(o))}</span></p>` : '');
        return `<div class="wc wc-sd${rp ? ' replaying' : ''}">${hd('chart', w.title, rp ? rp.time : whenShort(D.day.date))}`
          + big
          + spark(D.day.series && D.day.series.points, uid, rp ? rp.mark : null)
          + `<div class="rows">${rows.map((it) => `<p class="row"><b>${esc(dayVal(it))}${showUnit(it) ? `<small>${esc(dayUnit(it))}</small>` : ''}</b>`
            + `<span>${esc(dayLabel(it))}</span></p>`).join('')}</div>`
          + `<p class="w-foot"><span class="w-tag">${esc(w.tag)}</span>${esc(w.synthetic)}</p></div>`;
      }
      case 'accuracy': {
        const a = D.facts.assistant;
        return `<div class="wc wc-ac">${hd('spark', w.title)}`
          + `<p class="r1"><span class="w-num">${esc(a.score)}%</span><span>${esc(w.ai)}</span></p><span class="bar a"><i style="width:${Number(a.score)}%"></i></span>`
          + `<p class="r2"><span class="w-num">${esc(a.baseline)}%</span><span>${esc(w.rules)}</span></p><span class="bar b"><i style="width:${Number(a.baseline)}%"></i></span>`
          + `<p class="w-foot"><span>${esc(w.part)}</span><span>${esc(w.set)}</span></p></div>`;
      }
      case 'site':
        return `<div class="wc wc-site"><div class="w-browser"><div class="bar"><i></i><i></i><i></i><span>${esc(D.facts.site.domain)}</span></div>`
          + `<div class="shot-img img-site-home"></div></div>${hd('globe', w.title)}`
          + `<p class="dom">${esc(D.facts.site.domain)}</p><p class="line">${esc(w.line)}</p></div>`;
      case 'vocal': {
        const hs = [8, 14, 24, 18, 30, 22, 36, 28, 20, 30, 38, 28, 20, 32, 24, 16, 26, 18, 12, 18, 10, 6];
        const id = `vg-${uid}`;
        const bars = hs.map((h, i) => `<rect x="${(i * 6.62 + 0.4).toFixed(2)}" y="${20 - h / 2}" width="3.4" height="${h}" rx="1.7" fill="url(#${id})"`
          + ` style="--d:${(1.3 + (i % 5) * 0.19).toFixed(2)}s;--dl:-${((i * 0.41) % 1.7).toFixed(2)}s"/>`).join('');
        return `<div class="wc wc-vo">${hd('wave', w.title)}<svg class="wave" viewBox="0 0 144 40" aria-hidden="true" focusable="false">`
          + `<defs><linearGradient id="${id}" x1="0" x2="144" y1="0" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" style="stop-color:var(--violet)"/>`
          + `<stop offset="1" style="stop-color:var(--teal)"/></linearGradient></defs>${bars}</svg>`
          + `<p class="s1">${esc(w.status)}</p><p class="s2">${esc(w.next)}</p></div>`;
      }
      case 'contact':
        return `<div class="wc wc-ct">${hd('pin', w.title)}<p class="city">${esc(w.city)}</p><p class="tz">${esc(w.tz)}</p>`
          + `<div class="links"><p>${wIcon('card', '')}${esc(w.lines[0])}<span class="ar">↗</span></p>`
          + `<p>${wIcon('globe', '')}${esc(w.lines[1])}<span class="ar">↗</span></p></div></div>`;
      default:
        return '';
    }
  }
  function widgetAlt(key) {
    const c = C();
    if (key !== 'store-day') return c.alts[key] || '';
    const rows = ['Orders fulfilled', 'Avg pickup wait', 'Ready on time'].map(dayItem).filter(Boolean)
      .map((it) => `${dayLabelCap(it)} ${dayValUnit(it)}`);
    return fmt(c.alts['store-day'], { date: whenLong(D.day.date), rows: rows.join(lang === 'zh' ? '；' : '; ') });
  }
  function widgetButton(w) {
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = `w ${w.size}`;
    b.dataset.sheet = w.key;
    b.setAttribute('aria-haspopup', 'dialog');
    return b;
  }
  /** Only the store-day cards (time travel replays the day). */
  function paintStoreDay() {
    for (const b of $$('.w[data-sheet="store-day"]')) {
      if (b.firstElementChild) b.firstElementChild.innerHTML = widgetHTML('store-day', NC.widgets.contains(b) ? 'n' : 'r');
    }
  }
  function paintWidgets() {
    for (const b of $$('.w', E.track)) { b.innerHTML = `<div aria-hidden="true">${widgetHTML(b.dataset.sheet, 'r')}</div>`; b.setAttribute('aria-label', widgetAlt(b.dataset.sheet)); }
    for (const b of $$('.w', NC.widgets)) { b.innerHTML = `<div aria-hidden="true">${widgetHTML(b.dataset.sheet, 'n')}</div>`; b.setAttribute('aria-label', widgetAlt(b.dataset.sheet)); }
  }

  // ---------------------------------------------------------------- widget row (lock screen)
  function buildTrack() {
    const pages = [];
    let pair = [];
    for (const w of WIDGETS) {
      if (w.size === 'm') pages.push([w]);
      else { pair.push(w); if (pair.length === 2) { pages.push(pair); pair = []; } }
    }
    if (pair.length) pages.push(pair);
    E.track.textContent = '';
    for (const group of pages) {
      const page = doc.createElement('div');
      page.className = 'page';
      page.setAttribute('role', 'group');
      for (const w of group) { const b = widgetButton(w); b.tabIndex = -1; page.append(b); }
      E.track.append(page);
    }
    const first = $('.w', E.track);
    if (first) first.tabIndex = 0;
  }
  const widgetButtons = () => $$('.w', E.track);
  const pagesEls = () => $$('.page', E.track);

  // Snap stops: each page's start, clamped to what the row can scroll. On wide screens the
  // last pages share one stop (the end), so the dots always match places you can go.
  let snaps = [0];
  let activeIdx = 0;
  function measure() {
    const t = E.track;
    const pages = pagesEls();
    if (!pages.length) return;
    const padL = pages[0].offsetLeft;
    const max = Math.max(0, t.scrollWidth - t.clientWidth);
    const pos = [];
    for (const p of pages) {
      const x = clamp(p.offsetLeft - padL, 0, max);
      if (!pos.length || x - pos[pos.length - 1] > 4) pos.push(x);
    }
    if (pos.length > 1 && pos[pos.length - 1] - pos[pos.length - 2] < pages[0].offsetWidth * 0.5) pos.splice(pos.length - 2, 1);
    snaps = pos;
    renderDots();
  }
  function nearest(x) {
    let best = 0;
    for (let i = 1; i < snaps.length; i++) if (Math.abs(snaps[i] - x) < Math.abs(snaps[best] - x)) best = i;
    return best;
  }
  function renderDots() {
    const n = snaps.length;
    if (E.dots.childElementCount !== n) {
      E.dots.textContent = '';
      for (let i = 0; i < n; i++) {
        const b = doc.createElement('button');
        b.type = 'button';
        b.className = 'dot';
        b.dataset.i = String(i);
        E.dots.append(b);
      }
    }
    E.dots.hidden = n < 2;
    labelDots();
    syncDots();
  }
  function labelDots() {
    const c = C();
    $$('.dot', E.dots).forEach((b, i) => b.setAttribute('aria-label', fmt(c.dot, { n: i + 1, total: snaps.length })));
  }
  function syncDots() {
    activeIdx = nearest(E.track.scrollLeft);
    $$('.dot', E.dots).forEach((b, i) => {
      if (i === activeIdx) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
    // keep the one tab stop on a widget you can see, unless focus is already in the row
    if (!E.track.contains(doc.activeElement)) {
      const t = E.track;
      const padL = pagesEls()[0].offsetLeft;
      const b = widgetButtons().find((x) => x.offsetLeft >= t.scrollLeft + padL - 4) || widgetButtons()[0];
      if (b) setRoving(b);
    }
  }
  function goTo(i, smooth = true) {
    if (!snaps.length) return;
    i = clamp(i, 0, snaps.length - 1);
    E.track.scrollTo({ left: snaps[i], behavior: smooth && !reduced ? 'smooth' : 'auto' });
  }
  function setRoving(b) { for (const x of widgetButtons()) x.tabIndex = x === b ? 0 : -1; }
  /** Scroll the row (to a snap stop) just enough to show a widget that got keyboard focus. */
  function reveal(b) {
    const t = E.track;
    const padL = pagesEls()[0].offsetLeft;
    const L = b.offsetLeft;
    const R = L + b.offsetWidth;
    const viewL = t.scrollLeft + padL - 2;
    const viewR = t.scrollLeft + t.clientWidth - 24;
    if (L >= viewL && R <= viewR) return;
    let target;
    if (R > viewR) {
      target = snaps.find((s) => R <= s + t.clientWidth - 24);
      if (target === undefined) target = snaps[snaps.length - 1];
    } else {
      target = snaps.slice().reverse().find((s) => L >= s + padL - 2);
      if (target === undefined) target = 0;
    }
    t.scrollTo({ left: target, behavior: reduced ? 'auto' : 'smooth' });
  }
  /** Run fn once the row stops at `target` (or after a timeout if scrollend never comes). */
  function whenSettled(target, fn) {
    let done = false;
    const t = E.track;
    const finish = () => { if (done) return; done = true; t.removeEventListener('scrollend', onEnd); clearTimeout(timer); fn(); };
    const onEnd = () => { if (Math.abs(t.scrollLeft - target) < 2) finish(); };
    const timer = setTimeout(finish, 900);
    if ('onscrollend' in window) t.addEventListener('scrollend', onEnd);
  }

  // ---------------------------------------------------------------- updates (lock screen)
  function noteBody(n) { return n[lang].body === '@day' ? dayNote() : n[lang].body; }
  function renderNotes() {
    const c = C();
    E.noteList.innerHTML = NOTES.map((n) => {
      const t = n[lang];
      const body_ = noteBody(n);
      const label = fmt(c.noteAria, { title: t.title, when: whenLong(n.when), body: body_, app: c.appNames[n.app] });
      return `<li><button type="button" class="note" data-note="${esc(n.key)}" data-app="${esc(n.app)}" aria-label="${esc(label)}">`
        + `${icon(n.icon, 'ico-xs')}<span class="note-t">${esc(t.title)}</span><span class="note-w">${esc(whenShort(n.when))}</span>`
        + `<span class="note-b">${esc(body_)}</span></button></li>`;
    }).join('');
  }

  // ---------------------------------------------------------------- home
  function renderHome() {
    const c = C();
    const btn = (cls, k) => `<li><button type="button" class="${cls}" data-app="${k}" aria-haspopup="dialog">${icon(k)}<span class="lbl">${esc(c.appNames[k])}</span></button></li>`;
    E.grid.innerHTML = GRID.map((k) => btn('app', k)).join('');
    E.dockList.innerHTML = DOCK.map((k) => btn('dock-app', k)).join('');
  }
  function labelHome() {
    for (const b of $$('.app, .dock-app')) setText($('.lbl', b), C().appNames[b.dataset.app]);
  }
  /** "This site": About this site (#115) and the site's own pages (#146, #172, #153). */
  function renderSiteNav() {
    const c = C();
    const items = [['about', c.siteNav.about]].concat(SITE_PAGES.map((k) => [k, c.appNames[k]]));
    E.siteLinks.innerHTML = items.map(([k, label]) => `<li><button type="button" class="site-link" ${k === 'about' ? 'data-site="about"' : `data-app="${k}"`} aria-haspopup="dialog">`
      + `${icon(k, 'ico-xs')}<span>${esc(label)}</span></button></li>`).join('');
  }
  function checkHomeFits() {
    E.home.classList.toggle('fits', E.homeScroll.scrollHeight <= E.homeScroll.clientHeight + 2);
  }

  // ---------------------------------------------------------------- orbit
  // The avatar is the sun. The eight planets start from where they really are (their
  // heliocentric longitude, live/astro.mjs; idea #79) and then turn counter-clockwise at
  // PERIODS. A planet's plane angle θ is its longitude: before the -9° tilt it sits at
  // x = rx·cos θ, y = -ry·sin θ (the README art uses the same convention), so ♈ is to the
  // right, longitude 90° is behind the avatar and 270° passes in front of it. While travelling
  // in time the spin pauses and the planets glide to their real positions for that moment;
  // under reduced motion they stand still where they really are. The Moon sits beside Earth
  // at today's phase (#80). Each planet is a button that opens an app (#81): hovering the orbit
  // slows everything to a fifth and the planet under the pointer (or keyboard focus) stops.
  // A dot runs round the avatar's edge with the Albany seconds (Albany is whole hours from UTC).
  // The lock screen has one orbit and the Clock app a copy; only the ones on screen are drawn.
  const ORB = D.orbits;
  const PER = D.periods;
  const NAMES = D.planetApps.map(([p]) => p);          // mercury … neptune, then moon
  const MOON = NAMES.indexOf('moon');
  const EARTH = NAMES.indexOf('earth');
  const TILT = ORB[0][2] * D2R;
  const OE = { o: ORB.map(() => []), t: ORB.map(() => []), s: [], m: [], lit: [] };
  const OS = {
    theta: Astro.planetLongitudes(Date.now()), epoch: Date.now(), mode: 'spin', speed: 1, slow: false,
    hover: -1, focus: -1, moon: null, moonKey: '', moonOff: [0, -9], moonDist: 9, scale: 1, w: 0, h: 0, card: -1,
  };
  E.orbit.dataset.epoch = String(OS.epoch);
  // #98: the Clock app's "True scale" switch sets each ring by today's real distance from the Sun
  // (Neptune keeps its ring, so 1 au is about 7 banner units), shrinks the avatar to a small Sun
  // and the planets to dots, and holds the planets where they really are. TS.k scales each ring
  // and TS.body the planets; both glide (or jump under reduced motion). Only the Clock app's copy
  // of the orbit ever changes: leaving the app puts everything back.
  const TS = { on: false, k: ORB.map(() => 1), to: ORB.map(() => 1), body: 1, bodyTo: 1, moving: false };
  let orbitOn = false;
  let raf = 0;
  let lastPaint = 0;
  let lastStep = 0;
  function collectOrbits() {
    const boxes = [];
    if (SB.on) boxes.push(SB.orbit);                    // standby covers everything else
    else {
      if (state.view === 'lock') boxes.push(E.orbit);
      if (appKey === 'clock') boxes.push(A.body);
    }
    ORB.forEach((o, i) => {
      OE.o[i] = boxes.flatMap((b) => $$(`[data-o="${i}"]`, b));
      OE.t[i] = boxes.flatMap((b) => $$(`[data-trail="${i}"]`, b));
    });
    OE.s = boxes.flatMap((b) => $$('[data-sec]', b));
    OE.m = boxes.flatMap((b) => $$('[data-moon]', b));
    OE.lit = boxes.flatMap((b) => $$('.moon-lit', b));
    OS.moonKey = '';
    return boxes.length > 0;
  }
  /** Today's Moon (for the virtual time), refreshed once a minute: its lit shape, and where it sits. */
  function moonNow() {
    const t = vnow();
    const key = String(Math.floor(t / 60000));
    if (OS.moonKey !== key) {
      OS.moonKey = key;
      OS.moon = Astro.moonPhase(t);
      const d = Astro.moonPhasePath(0, 0, D.moonR, OS.moon.illum, OS.moon.waxing);
      for (const p of OE.lit) p.setAttribute('d', d);
    }
    return OS.moon;
  }
  /** Where planet i (or the Moon, i === MOON) is, in banner units. */
  function orbitPoint(i) {
    const k = i === MOON ? EARTH : i;
    const rx = ORB[k][0] * TS.k[k];
    const ry = ORB[k][1] * TS.k[k];
    const th = OS.theta[k] * D2R;
    let x = rx * Math.cos(th);
    let y = -ry * Math.sin(th);
    if (i === MOON) { x += OS.moonOff[0]; y += OS.moonOff[1]; }
    const c = Math.cos(TILT);
    const sn = Math.sin(TILT);
    return [D.center[0] + x * c - y * sn, D.center[1] + x * sn + y * c];
  }
  function paintOrbit(ms = vnow()) {
    ORB.forEach(([rx0, ry0], i) => {
      const rx = rx0 * TS.k[i];
      const ry = ry0 * TS.k[i];
      const th = OS.theta[i] * D2R;
      const tr = `translate(${(rx * Math.cos(th)).toFixed(2)} ${(-ry * Math.sin(th)).toFixed(2)})${TS.body !== 1 ? ` scale(${TS.body.toFixed(3)})` : ''}`;
      for (const g of OE.o[i]) g.setAttribute('transform', tr);
      const rt = `rotate(${(90 - OS.theta[i]).toFixed(2)})`;
      for (const g of OE.t[i]) g.setAttribute('transform', rt);
    });
    // The Moon: in the orbit plane its direction from Earth is λ(Earth) + 180° + its elongation
    // from the Sun, so new Moon sits between Earth and the avatar, full Moon on the far side,
    // first quarter trailing Earth and last quarter leading it. Projected into the tilted plane
    // and set a fixed distance from Earth on screen, so it never sits on Earth for long.
    const m = moonNow();
    const [erx, ery] = ORB[EARTH];
    const phi = (OS.theta[EARTH] + 180 + m.elong) * D2R;
    const vx = Math.cos(phi);
    const vy = -(ery / erx) * Math.sin(phi);
    const len = Math.hypot(vx, vy) || 1;
    OS.moonOff = [(vx / len) * OS.moonDist, (vy / len) * OS.moonDist];
    const mt = `translate(${OS.moonOff[0].toFixed(2)} ${OS.moonOff[1].toFixed(2)})`;
    for (const g of OE.m) g.setAttribute('transform', mt);
    if (!reduced || !OE.s.some((d) => d.hasAttribute('data-placed'))) {
      const sa = (((ms / 1000) % 60) / 60) * 2 * Math.PI;
      const r = D.secondsR;
      const st = `translate(${(r * Math.sin(sa)).toFixed(2)} ${(-r * Math.cos(sa)).toFixed(2)})`;
      for (const d of OE.s) { d.setAttribute('transform', st); d.setAttribute('data-placed', ''); }
    }
    if (state.view === 'lock') paintPlanetButtons();
  }
  function stepOrbit(dt) {
    if (TS.moving) stepScale(dt);
    OS.speed += ((OS.slow ? 0.2 : 1) - OS.speed) * (1 - Math.exp(-dt / 0.25));
    if (OS.mode === 'glide') {
      const target = Astro.planetLongitudes(vnow());
      const k = 1 - Math.exp(-dt / 0.22);
      let done = true;
      OS.theta = OS.theta.map((th, i) => {
        const d = wrap180(target[i] - th);
        if (Math.abs(d) < 0.05) return target[i];
        done = false;
        return th + d * k;
      });
      if (done && !travelling() && !TS.on) OS.mode = 'spin';
      return;
    }
    const held = OS.hover >= 0 ? OS.hover : OS.focus;
    const stop = held === MOON ? EARTH : held;
    const before = SND.on ? OS.theta : null;
    OS.theta = OS.theta.map((th, i) => (i === stop ? th : th + ((dt * 360) / PER[i]) * OS.speed));
    // #96: a planet crossing the near point of its ring (270°, in front of the avatar) chimes
    if (before) OS.theta.forEach((th, i) => { if (Math.floor((th - 270) / 360) > Math.floor((before[i] - 270) / 360)) chime(i); });
  }
  function frame(ts) {
    raf = 0;
    if (!orbitOn) return;
    const dt = lastStep ? clamp((ts - lastStep) / 1000, 0, 0.1) : 0;
    lastStep = ts;
    stepOrbit(dt);
    if (ts - lastPaint > 30) { lastPaint = ts; paintOrbit(); }
    raf = requestAnimationFrame(frame);
  }
  /** Reduced motion: the planets stand still where they really are (at the virtual time). */
  function placeStill() {
    OS.theta = Astro.planetLongitudes(vnow());
    OS.mode = 'spin';
    paintOrbit();
  }
  function startOrbit() {
    orbitOn = true;
    measureOrbit();
    if (reduced) { placeStill(); return; }
    paintOrbit();
    lastStep = 0;
    if (!raf) raf = requestAnimationFrame(frame);
  }
  function stopOrbit() {
    orbitOn = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }
  function syncOrbit() {
    if (appKey !== 'clock' && (TS.on || TS.body !== 1)) resetScale();
    if (collectOrbits()) { stopOrbit(); startOrbit(); } else stopOrbit();
  }
  /** The virtual time moved: glide to the new real positions (or jump, under reduced motion). */
  function retargetOrbit() {
    OS.moonKey = '';
    if (TS.on) setTrueScale(true);
    if (reduced) { if (orbitOn) placeStill(); return; }
    OS.mode = 'glide';
  }
  // ---- true scale (#98)
  function resetScale() {
    TS.on = false;
    TS.k = ORB.map(() => 1);
    TS.to = TS.k.slice();
    TS.body = 1;
    TS.bodyTo = 1;
    TS.moving = false;
  }
  /** The Clock copy's rings, drawn at their current scale (the same path as pages/build.py). */
  function paintRings() {
    if (appKey !== 'clock') return;
    const [cx, cy] = D.center;
    $$('.orbit-svg .rings path', A.body).forEach((el, i) => {
      if (!ORB[i]) return;
      const [rx0, ry0, rot] = ORB[i];
      const rx = (rx0 * TS.k[i]).toFixed(2);
      const ry = (ry0 * TS.k[i]).toFixed(2);
      const c = Math.cos(rot * D2R) * rx0 * TS.k[i];
      const s = Math.sin(rot * D2R) * rx0 * TS.k[i];
      const L = `${(cx - c).toFixed(2)},${(cy - s).toFixed(2)}`;
      const R = `${(cx + c).toFixed(2)},${(cy + s).toFixed(2)}`;
      el.setAttribute('d', `M${L}A${rx},${ry} ${rot} 0 0 ${R}A${rx},${ry} ${rot} 0 0 ${L}Z`);
    });
  }
  function stepScale(dt) {
    const a = 1 - Math.exp(-dt / 0.28);
    let done = true;
    TS.k = TS.k.map((v, i) => { const d = TS.to[i] - v; if (Math.abs(d) < 0.002) return TS.to[i]; done = false; return v + d * a; });
    const db = TS.bodyTo - TS.body;
    if (Math.abs(db) < 0.002) TS.body = TS.bodyTo; else { done = false; TS.body += db * a; }
    paintRings();
    if (done) TS.moving = false;
  }
  function setTrueScale(on) {
    TS.on = !!on;
    if (TS.on) {
      const t = vnow();
      const rN = Astro.heliocentric('neptune', t).r;
      const outer = ORB[ORB.length - 1][0];
      TS.to = ORB.map(([rx], i) => (outer * Astro.heliocentric(Astro.PLANETS[i], t).r) / rN / rx);
      TS.bodyTo = 0.45;
    } else {
      TS.to = ORB.map(() => 1);
      TS.bodyTo = 1;
    }
    if (reduced || !orbitOn) {
      TS.k = TS.to.slice();
      TS.body = TS.bodyTo;
      TS.moving = false;
      paintRings();
      if (orbitOn) placeStill();
    } else {
      TS.moving = true;
      OS.mode = 'glide';
    }
    paintScaleUI();
  }
  /** The switch, the sentence under it and the inner planets close up. */
  function paintScaleUI() {
    const note = $('#clkTrueNote', A.body);
    if (appKey !== 'clock' || !note) return;
    const c = C().app.clock;
    const t = vnow();
    const box = $('.bigclock', A.body);
    if (box) box.classList.toggle('true', TS.on);
    $('#clkTrue', A.body).setAttribute('aria-pressed', String(TS.on));
    setText(note, TS.on ? fmt(c.trueNote, {
      nep: duration(Astro.heliocentric('neptune', t).r * Astro.AU_LIGHT_SECONDS),
      earth: duration(Astro.heliocentric('earth', t).r * Astro.AU_LIGHT_SECONDS),
    }) : c.evenNote);
    const inset = $('#clkInset', A.body);
    inset.hidden = !TS.on;
    inset.innerHTML = TS.on ? insetHTML(t) : '';
    if (TS.on) {
      // how much larger the close-up draws the same distance, as shown on screen
      const isv = $('.inset-svg', inset);
      const osv = $('.bigclock .orbit-svg', A.body);
      const wi = isv ? isv.getBoundingClientRect().width / 112 : 1;
      const wo = osv ? osv.getBoundingClientRect().width / D.stage[2] : 1;
      const x = (Number(isv && isv.dataset.au) * wi) / (Number(isv && isv.dataset.main) * wo);
      setText($('.inset-cap', inset), fmt(c.inner, { x: Number.isFinite(x) && x > 0 ? Math.round(x) : '' }));
    }
  }
  /** Mercury to Mars at true scale, magnified: where they are today round the Sun. */
  function insetHTML(t) {
    const inner = ['mercury', 'venus', 'earth', 'mars'];
    const h = inner.map((p) => Astro.heliocentric(p, t));
    const s = 44 / Math.max(...h.map((x) => x.r));                  // px per au in the close-up
    const sq = ORB[3][1] / ORB[3][0];
    const main = ORB[ORB.length - 1][0] / Astro.heliocentric('neptune', t).r;
    const rings = h.map((x) => `<ellipse rx="${(x.r * s).toFixed(1)}" ry="${(x.r * s * sq).toFixed(1)}" class="in-ring"/>`).join('');
    const dots = h.map((x, i) => `<circle cx="${(x.r * s * Math.cos(x.lon * D2R)).toFixed(1)}" cy="${(-x.r * s * sq * Math.sin(x.lon * D2R)).toFixed(1)}" r="2.6" style="fill:var(--pl-${inner[i]})"/>`).join('');
    return `<svg class="inset-svg" viewBox="-56 -26 112 52" data-au="${s.toFixed(4)}" data-main="${main.toFixed(4)}" aria-hidden="true" focusable="false">`
      + `<g transform="rotate(${ORB[0][2]})">${rings}<circle r="2.2" class="in-sun"/>${dots}</g></svg><span class="inset-cap"></span>`;
  }

  // the planet buttons (#81): real buttons over the moving planets, inner to outer, then the Moon
  function buildPlanetButtons() {
    E.plBtns.textContent = '';
    D.planetApps.forEach(([planet, app], i) => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'pl-btn';
      b.dataset.i = String(i);
      b.dataset.planet = planet;
      b.dataset.app = app;
      b.setAttribute('aria-haspopup', 'dialog');
      E.plBtns.append(b);
    });
    labelPlanetButtons();
  }
  function labelPlanetButtons() {
    const c = C();
    for (const b of $$('.pl-btn', E.plBtns)) {
      b.setAttribute('aria-label', fmt(c.planets.aria, { planet: c.planets.names[b.dataset.planet], app: c.appNames[b.dataset.app] }));
    }
    if (OS.card >= 0) showCard(OS.card);
  }
  function measureOrbit() {
    const w = E.orbit.clientWidth;
    if (!w) return;
    OS.w = w;
    OS.h = E.orbit.clientHeight;
    OS.scale = w / D.stage[2];
    OS.moonDist = clamp(9 / OS.scale, 7, 12);
    OS.hit = $$('.pl-btn', E.plBtns).map((b, i) => {
      const r = i === MOON ? D.moonR : (NAMES[i] === 'saturn' ? 9 : D.planetR[i]);
      const hit = Math.max(24, Math.round(2 * r * OS.scale + 12));
      b.style.setProperty('--hit', `${hit}px`);
      return hit / 2;
    });
  }
  function paintPlanetButtons() {
    if (!OS.w) return;
    const [sx, sy] = D.stage;
    OS.px = $$('.pl-btn', E.plBtns).map((b, i) => {
      const [x, y] = orbitPoint(i);
      const px = [(x - sx) * OS.scale, (y - sy) * OS.scale];
      b.style.transform = `translate3d(${px[0].toFixed(1)}px, ${px[1].toFixed(1)}px, 0)`;
      return px;
    });
    if (OS.card >= 0) placeCard(OS.card);
  }
  /** The planet under the pointer: the nearest one whose hit circle (at least 24px) holds it,
   *  so the Moon wins next to Earth even though their circles overlap. */
  function planetAt(cx, cy) {
    if (!OS.px) return -1;
    const r = E.orbit.getBoundingClientRect();
    const x = cx - r.left;
    const y = cy - r.top;
    let best = -1;
    let bd = Infinity;
    OS.px.forEach(([px, py], i) => {
      const d = Math.hypot(px - x, py - y);
      if (d <= (OS.hit ? OS.hit[i] : 12) && d < bd) { bd = d; best = i; }
    });
    return best;
  }
  function showCard(i) {
    if (i === EARTH && ED.card && travelling()) { earthCard(); return; }
    const c = C();
    const [planet, app] = D.planetApps[i];
    let html = `<p class="pc-name"><i style="background:var(--pl-${planet === 'moon' ? 'moon' : planet})"></i>${esc(c.planets.names[planet])}</p>`
      + `<p class="pc-app">${esc(c.appNames[app])}</p>`;
    if (planet === 'earth') {
      const m = moonNow();
      html += `<p class="pc-moon">${moonIcon(m, 12)}${esc(fmt(c.planets.moon, { phase: m.phaseName[lang], pct: Math.round(m.illum * 100) }))}</p>`;
      html += `<p class="pc-fact">${esc(earthFact())}</p>`;
      if (state.view === 'lock') html += `<p class="pc-hint pc-drag">${esc(c.planets.drag)}</p>`;
    } else {
      // #144: where to look for it tonight, in the city chosen in the Sky app (else Albany)
      const city = homeCity();
      html += `<p class="pc-sky">${esc(fmt(c.planets.tonight, { city: placeShort(city), text: bodyTonightText(planet, city, tonightFor(city)) }))}</p>`;
    }
    html += `<p class="pc-hint">${esc(c.planets.open)}</p>`;
    E.plCard.innerHTML = html;
    E.plCard.hidden = false;
    OS.card = i;
    const b = $$('.pl-btn', E.plBtns)[i];
    for (const x of $$('.pl-btn', E.plBtns)) x.removeAttribute('aria-describedby');
    if (b) b.setAttribute('aria-describedby', 'plCard');
    placeCard(i);
  }
  /** Earth's card says one thing a day (#99 and #137 take turns): the planet nearest us today,
   *  or how fast Earth carries you (its turning at the chosen city's latitude, and its speed
   *  round the Sun today). Both are worked out for the virtual time. */
  function earthFact() {
    const t = vnow();
    const p = Astro.zonedParts(t, TZ);
    const c = C().planets;
    if ((Date.UTC(p.year, p.month - 1, p.day) / 86400000) % 2 === 0) {
      const cp = Astro.closestPlanet(t);
      return fmt(c.closest, { planet: c.names[cp.name], au: cp.dist.toFixed(2), time: duration(cp.dist * Astro.AU_LIGHT_SECONDS) });
    }
    const city = homeCity();
    const kmh = Astro.rotationSpeed(city.lat);
    return fmt(c.spin, {
      city: placeShort(city), kmh: group(Math.round(kmh / 10) * 10), mph: group(Math.round(kmh / 1.609344 / 10) * 10),
      orbit: group(Math.round((Astro.orbitalSpeed('earth', t) * 3600) / 100) * 100),
    });
  }
  function placeCard(i) {
    const b = $$('.pl-btn', E.plBtns)[i];
    if (!b) return;
    const [x, y] = orbitPoint(i);
    const px = (x - D.stage[0]) * OS.scale;
    const py = (y - D.stage[1]) * OS.scale;
    const cw = E.plCard.offsetWidth;
    const ch = E.plCard.offsetHeight;
    const gap = parseFloat(getComputedStyle(b).getPropertyValue('--hit')) / 2 + 6;
    const left = clamp(px - cw / 2, -8, OS.w - cw + 8);
    const top = py - gap - ch >= -40 ? py - gap - ch : py + gap;
    E.plCard.style.transform = `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0)`;
  }
  function hideCard() {
    E.plCard.hidden = true;
    OS.card = -1;
    for (const x of $$('.pl-btn', E.plBtns)) x.removeAttribute('aria-describedby');
  }
  /** A small upright Moon showing a phase (northern view unless `southern`). */
  function moonIcon(m, size = 14, southern = false) {
    const r = 6;
    const lit = Astro.moonPhasePath(0, 0, r, m.illum, m.waxing, southern);
    return `<svg class="moon-ico" width="${size}" height="${size}" viewBox="-7 -7 14 14" aria-hidden="true" focusable="false">`
      + `<circle r="${r}" class="mi-dark"/>${lit ? `<path d="${lit}" class="mi-lit"/>` : ''}<circle r="${r}" class="mi-edge"/></svg>`;
  }
  function hoverPlanet(i) {
    if (i === OS.hover) return;
    OS.hover = i;
    $$('.pl-btn', E.plBtns).forEach((b, k) => b.classList.toggle('hot', k === i));
    E.plBtns.classList.toggle('hot', i >= 0);
    E.plBtns.classList.toggle('grab', i === EARTH);
    if (i >= 0) showCard(i); else if (OS.focus >= 0) showCard(OS.focus); else hideCard();
  }
  E.plBtns.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') hoverPlanet(planetAt(e.clientX, e.clientY)); });
  E.plBtns.addEventListener('pointerleave', () => hoverPlanet(-1));
  E.plBtns.addEventListener('focusin', (e) => {
    const b = e.target.closest('.pl-btn');
    if (!b) return;
    OS.focus = Number(b.dataset.i);
    showCard(OS.focus);
  });
  E.plBtns.addEventListener('focusout', (e) => {
    if (e.relatedTarget && E.plBtns.contains(e.relatedTarget)) return;
    OS.focus = -1;
    if (OS.hover >= 0) showCard(OS.hover); else hideCard();
  });
  E.orbit.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') OS.slow = true; });
  E.orbit.addEventListener('pointerleave', () => { OS.slow = false; });

  // #143: press Earth and drag it round its ring to travel through time. One turn is a year: the
  // page's virtual clock goes to the moment Earth really is under the pointer (counting whole
  // turns, from 1900 to 2050), the other planets and the Moon's phase follow, and the date shows
  // beside Earth with any equinox, solstice (a solar term in Chinese) or festival on it. Let go
  // and it comes back to now after a moment, as the time travel slider does. A press that moves
  // less than 6 px is still a click and opens the Sky. With Earth focused, the arrow keys step a
  // day and leaving Earth comes back to now. Reduced motion jumps instead of gliding.
  const YEAR = 365.256363 * DAY;          // a sidereal year: Earth back at the same place
  const SKY_FROM = Date.UTC(1900, 0, 1, 12);
  const SKY_TO = Date.UTC(2050, 11, 31, 12);
  const ED = { id: null, x0: 0, y0: 0, on: false, t0: 0, lon0: 0, p: 0, acc: 0, raf: 0, card: false, keys: false };
  /** Where the pointer is on Earth's ring, as a plane angle (the same as a heliocentric longitude). */
  function ringAngle(cx, cy) {
    const r = E.orbit.getBoundingClientRect();
    const x = (cx - r.left) / OS.scale + D.stage[0] - D.center[0];
    const y = (cy - r.top) / OS.scale + D.stage[1] - D.center[1];
    const ux = x * Math.cos(TILT) + y * Math.sin(TILT);
    const uy = -x * Math.sin(TILT) + y * Math.cos(TILT);
    return Math.atan2(-uy / ORB[EARTH][1], ux / ORB[EARTH][0]) / D2R;
  }
  /** The moment near `guess` when Earth's heliocentric longitude is `lon`. */
  function earthAt(lon, guess) {
    let t = guess;
    for (let k = 0; k < 3; k++) t += (wrap180(lon - Astro.heliocentric('earth', t).lon) / 360) * YEAR;
    return clamp(t, SKY_FROM, SKY_TO);
  }
  const onEarth = (e) => state.view === 'lock' && !!OS.px && planetAt(e.clientX, e.clientY) === EARTH;
  /** What a date holds: in English an equinox or solstice that falls on it in Albany, as American
   *  calendars print them; in Chinese any solar term whose date in Beijing it is, as Chinese
   *  calendars print them (#95); and a festival. */
  function dayEvent(iso) {
    const [y, m, d] = isoParts(iso);
    const out = [];
    if (lang === 'zh') {
      for (const x of Astro.solarTerms(Date.UTC(y, m - 1, d) - BJ, Date.UTC(y, m - 1, d + 1) - BJ)) out.push(C().lunar.terms[x.i]);
    } else {
      for (const x of Astro.solarTerms(Astro.zonedTime(y, m, d, 0, 0, TZ), Astro.zonedTime(y, m, d + 1, 0, 0, TZ))) {
        if (x.i % 6 === 0) out.push(C().dayEvents.seasons[x.i / 6]);
      }
    }
    const f = festivalOn(y, m, d);
    if (f) out.push(C().dayEvents.fest[f]);
    return out.join(' · ');
  }
  /** The card beside Earth while it is dragged (or stepped): the date and what it holds. */
  function earthCard() {
    const iso = albanyISO(new Date(vnow()));
    const ev = dayEvent(iso);
    E.plCard.innerHTML = `<p class="pc-name"><i style="background:var(--pl-earth)"></i>${esc(fmtDate(iso, { year: 'numeric', month: 'long', day: 'numeric' }))}</p>`
      + `${ev ? `<p class="pc-app pc-event">${esc(ev)}</p>` : ''}<p class="pc-hint">${esc(C().planets.dragBack)}</p>`;
    E.plCard.hidden = false;
    OS.card = EARTH;
    ED.card = true;
    placeCard(EARTH);
  }
  function earthFrame() {
    ED.raf = 0;
    if (!ED.on) return;
    setVirtual(earthAt(ED.lon0 + ED.acc, ED.t0 + (ED.acc / 360) * YEAR) - Date.now());
    if (TT.open) ttSync();
    earthCard();
  }
  E.plBtns.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0) || !onEarth(e)) return;
    Object.assign(ED, { id: e.pointerId, x0: e.clientX, y0: e.clientY, on: false });
  });
  doc.addEventListener('pointermove', (e) => {
    if (e.pointerId !== ED.id) return;
    if (!ED.on) {
      if (Math.hypot(e.clientX - ED.x0, e.clientY - ED.y0) < 6) return;
      ED.on = true;
      clearTimeout(TT.timer);
      ED.t0 = vnow();
      ED.lon0 = Astro.heliocentric('earth', ED.t0).lon;
      ED.p = ringAngle(ED.x0, ED.y0);
      ED.acc = wrap180(ED.p - ED.lon0);     // Earth goes to where it was pressed, then follows the pointer
      body.classList.add('earth-drag');
      try { E.plBtns.setPointerCapture(e.pointerId); } catch (err) { /* the pointer is already gone */ }
    }
    const p = ringAngle(e.clientX, e.clientY);
    ED.acc += wrap180(p - ED.p);
    ED.p = p;
    if (!ED.raf) ED.raf = requestAnimationFrame(earthFrame);
  });
  function earthUp(e) {
    if (e.pointerId !== ED.id) return;
    ED.id = null;
    if (!ED.on) return;
    ED.on = false;
    body.classList.remove('earth-drag');
    suppressClick = true;                    // the click that ends a drag does not open the Sky
    setTimeout(() => { suppressClick = false; }, 0);
    ttRelease();
  }
  doc.addEventListener('pointerup', earthUp);
  doc.addEventListener('pointercancel', earthUp);
  E.plBtns.addEventListener('keydown', (e) => {
    const b = e.target.closest('.pl-btn');
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!b || b.dataset.planet !== 'earth' || !step || e.altKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    e.stopPropagation();
    clearTimeout(TT.timer);
    ED.keys = true;
    setVirtual(clamp(vnow() + step * DAY, SKY_FROM, SKY_TO) - Date.now());
    if (TT.open) ttSync();
    earthCard();
  });
  E.plBtns.addEventListener('focusout', (e) => {
    if (!ED.keys || !e.target.closest('.pl-btn[data-planet="earth"]')) return;
    ED.keys = false;
    if (!TT.open) ttRelease();
  });

  // ---------------------------------------------------------------- clock loop
  let lastMinute = '';
  function tick() {
    const now = new Date(vnow());
    P = LockCore.parts(now, TZ);
    setText(E.hm, `${P.hour}:${P.minute}`);
    setText(E.sec, P.second);
    setText(E.ap, period());
    setText(E.date, dateLine(now));
    const a = handAngles(now.getTime());
    for (const g of $$('[data-hand]')) g.setAttribute('transform', `rotate(${a[g.dataset.hand].toFixed(2)} 12 12)`);
    for (const el of $$('[data-live="hms"]')) setText(el, timeHMS());
    const minuteKey = `${lang}|${P.hour}:${P.minute}${P.dayPeriod}`;
    if (minuteKey !== lastMinute) {
      lastMinute = minuteKey;
      const lt = localTime();
      setText(E.timeSr, lt);
      setText(E.homeTime, lt);
      setText(E.sbTime, lt);
      for (const el of $$('[data-live="time"]')) setText(el, lt);
      paintGreet();
      for (const el of $$('[data-live="yours"]')) { const y = yourTime(); if (y) setText(el, fmt(C().app.contact.youVal, { time: y.time, rel: relText(y.diff) })); }
      paintStandby();
      for (const el of $$('[data-cal="wd"]')) setText(el, calWdShort(now));
      for (const el of $$('[data-cal="d"]')) setText(el, P.day);
      paintDateExtras(now);
      paintFavicon();
      paintSun(now.getTime());
      if (overlay === 'nc') { setText(NC.date, dateLine(now)); setText(NC.summary, ncSummary()); paintNCSeason(); }
      if (appKey === 'clock') updateWorld();
      if (appKey === 'calendar') followCalendar();
      if (travelling()) { paintStoreDay(); setText(TT.badgeTxt, fmt(C().tt.badge, { time: ttLabel() })); }
      if (state.view === 'home' && now.getTime() - tonightAt > 600000) renderTonightW();
      if (appKey === 'sky' && SKY.mode === 'now' && now.getTime() - SKY.paintedAt > 60000) paintSky();
    }
  }
  function clockLoop() {
    tick();
    setTimeout(clockLoop, 1000 - (Date.now() % 1000) + 10);
  }

  // ---------------------------------------------------------------- the dusk background
  // The glows sit behind the lock-screen orbit (on the home screen and in apps they rest at
  // the top right) and drift up to 8px with the pointer. Off under reduced motion or when
  // parallax is switched off.
  function placeGlow(glide) {
    const W = innerWidth || 1;
    const H = innerHeight || 1;
    let x;
    let y;
    let k;
    const r = state.view === 'lock' ? E.orbit.getBoundingClientRect() : null;
    if (r && r.width > 40 && !body.classList.contains('sliding')) {
      const [sx, sy, sw, sh] = D.stage;
      x = r.left + r.width * ((D.center[0] - sx) / sw);
      y = r.top + r.height * ((D.center[1] - sy) / sh);
      k = r.width / sw;
      // where the orbit settles, not where the lock screen is while it slides back in
      const tf = getComputedStyle(E.lockFg).transform;
      if (tf && tf !== 'none') { const m = new DOMMatrixReadOnly(tf); x -= m.m41; y -= m.m42; }
    } else {
      k = clamp(W / 1100, 0.7, 1.2);
      x = W - Math.min(W * 0.24, 330);
      y = Math.min(H * 0.14, 130);
    }
    const st = E.wall.style;
    if (glide && !reduced) {
      E.wall.classList.add('glide');
      clearTimeout(E.wall._t);
      E.wall._t = setTimeout(() => E.wall.classList.remove('glide'), 950);
    }
    st.setProperty('--ox', `${x.toFixed(1)}px`);
    st.setProperty('--oy', `${y.toFixed(1)}px`);
    st.setProperty('--k', k.toFixed(3));
  }
  let glowRaf = 0;
  const queueGlow = () => { if (!glowRaf) glowRaf = requestAnimationFrame(() => { glowRaf = 0; placeGlow(false); }); };
  const parallaxActive = () => parallaxOn && !reduced;
  const PX = { x: 0, y: 0, tx: 0, ty: 0, raf: 0 };
  function stepParallax() {
    PX.raf = 0;
    PX.x += (PX.tx - PX.x) * 0.12;
    PX.y += (PX.ty - PX.y) * 0.12;
    if (Math.abs(PX.tx - PX.x) < 0.05 && Math.abs(PX.ty - PX.y) < 0.05) { PX.x = PX.tx; PX.y = PX.ty; } else PX.raf = requestAnimationFrame(stepParallax);
    E.wallMove.style.transform = `translate3d(${PX.x.toFixed(2)}px, ${PX.y.toFixed(2)}px, 0)`;
  }
  function aimParallax(x, y) {
    if (!parallaxActive()) return;
    PX.tx = clamp(x, -1, 1) * 8;
    PX.ty = clamp(y, -1, 1) * 8;
    if (!PX.raf) PX.raf = requestAnimationFrame(stepParallax);
  }
  function resetParallax() {
    if (PX.raf) cancelAnimationFrame(PX.raf);
    PX.raf = 0;
    PX.x = PX.y = PX.tx = PX.ty = 0;
    E.wallMove.style.transform = '';
  }
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    aimParallax((e.clientX / (innerWidth || 1)) * 2 - 1, (e.clientY / (innerHeight || 1)) * 2 - 1);
  }, { passive: true });
  window.addEventListener('deviceorientation', (e) => {
    if (e.gamma == null || e.beta == null) return;
    aimParallax(e.gamma / 30, (e.beta - 45) / 30);
  });
  function askTilt() {
    const DOE = window.DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === 'function') DOE.requestPermission().catch(() => { /* declined: the pointer still works */ });
  }
  /** The top bar gets a background once content scrolls under it. */
  function syncScrolled() {
    const el = state.view === 'home' ? E.homeScroll : E.lockInner;
    body.classList.toggle('scrolled', el.scrollTop > 2);
  }

  // ---------------------------------------------------------------- appearance, language, motion, clock weight
  function applyAppearance(pref, persist) {
    apPref = ['auto', 'dark', 'light'].includes(pref) ? pref : 'auto';
    appearance = apPref === 'auto' ? (mqLight.matches ? 'light' : 'dark') : apPref;
    root.dataset.appearancePref = apPref;
    root.dataset.appearance = appearance;
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', D.themeColors[appearance]);
    if (persist) store.set('ls7-appearance', apPref);
    syncCC();
    gbPost({ theme: D.giscus.themes[appearance] });
    if (appKey === 'sky') queueSky();
    if (appKey === 'design') paintDesign();
    if (appKey === 'assets') paintWallpapers();
  }
  function applyWeight(w, persist) {
    weight = w === 'thin' ? 'thin' : 'bold';
    root.classList.toggle('thin', weight === 'thin');
    if (persist) store.set('ls7-weight', weight);
    syncCC();
  }
  function setReduced(on, persist) {
    reduced = !!on;
    root.classList.toggle('reduced', reduced);
    if (persist) store.set('ls7-motion', reduced ? 'reduce' : 'full');
    if (reduced && SND.on) setSound(false);
    if (orbitOn) { stopOrbit(); startOrbit(); }
    resetParallax();
    syncCC();
  }
  function setParallax(on, persist) {
    parallaxOn = !!on;
    root.classList.toggle('no-parallax', !parallaxOn);
    if (persist) store.set('ls7-parallax', parallaxOn ? 'on' : 'off');
    if (parallaxOn) askTilt();
    resetParallax();
    syncCC();
  }
  function applyLang(l, persist) {
    lang = l === 'zh' ? 'zh' : 'en';
    root.lang = lang === 'zh' ? 'zh-CN' : 'en';
    root.dataset.lang = lang;
    if (persist) store.set('ls7-lang', lang);
    const c = C();
    for (const n of $$('[data-i18n]')) { const v = pick(c, n.dataset.i18n); if (typeof v === 'string') n.textContent = v; }
    for (const n of $$('[data-i18n-aria]')) { const v = pick(c, n.dataset.i18nAria); if (typeof v === 'string') n.setAttribute('aria-label', v); }
    for (const n of $$('[data-i18n-ph]')) { const v = pick(c, n.dataset.i18nPh); if (typeof v === 'string') n.setAttribute('placeholder', v); }
    for (const b of $$('button[data-lang]')) b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
    E.widgets.setAttribute('aria-roledescription', c.roleCarousel);
    const pages = pagesEls();
    pages.forEach((p, i) => {
      p.setAttribute('aria-roledescription', c.roleSlide);
      p.setAttribute('aria-label', fmt(c.slide, { n: i + 1, total: pages.length }));
    });
    E.lock.setAttribute('aria-label', c.lockLabel);
    E.home.setAttribute('aria-label', c.homeLabel);
    paintWidgets();
    renderNotes();
    labelHome();
    labelDots();
    syncCC();
    lastMinute = '';
    tick();
    if (openKey) fillSheet(openKey);
    if (appKey) {
      const y = A.body.scrollTop;
      const gb = $('#gbFrame', A.body);
      const keep = gb && gb.querySelector('iframe') ? gb : null;
      renderApp(appKey);
      if (keep) {
        const slot = $('#gbFrame', A.body);
        if (slot) slot.replaceWith(keep);
        const row = $('#gbLoadRow', A.body);
        if (row) row.hidden = true;
      }
      if (appKey === 'sky') paintSky();
      afterRender(appKey);
      A.body.scrollTop = y;
      if (appKey === 'clock') { syncOrbit(); paintRings(); paintScaleUI(); paintWorldMap(); }
    }
    gbPost({ lang: lang === 'zh' ? 'zh-CN' : 'en' });
    if (state.folder) renderFolder();
    if (overlay === 'nc') renderNC();
    if (overlay === 'spot') renderSpot();
    if (overlay === 'about') renderAbout();
    renderSiteNav();
    renderBrief();
    if (state.view === 'present') renderPresent();
    if (TR.i >= 0) paintTour();
    if (D.preview) { $('#previewBadge').hidden = false; setText($('#previewBadge'), C().previewBadge); }
    labelPlanetButtons();
    renderKeys();
    ttSetMode(TT.mode);
    if (travelling()) setText(TT.badgeTxt, fmt(C().tt.badge, { time: ttLabel() }));
    renderTonightW();
    requestAnimationFrame(queueGlow);
  }

  // ---------------------------------------------------------------- the planets' music box (#96)
  // Off by default and never remembered, so nothing sounds until a visitor switches it on with a
  // click or a key (browsers want that before any sound anyway). Then each planet plays one soft
  // note as it passes in front of the avatar: Mercury highest, Neptune lowest, on a pentatonic
  // scale, so the eight make a slow tune that keeps changing. Web Audio only: no sound files,
  // nothing fetched. Reduced motion stops the planets and the sound; a hidden tab is silent; the
  // glide of time travel plays nothing.
  const SND = { on: false, ctx: null, out: null };
  const TONES = [523.25, 440, 392, 329.63, 261.63, 220, 196, 164.81];   // C5 A4 G4 E4 C4 A3 G3 E3
  function soundGraph() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!SND.ctx) {
      const ctx = new AC();
      const out = ctx.createGain();
      out.gain.value = 0;
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 2400;
      const echo = ctx.createDelay(1);
      echo.delayTime.value = 0.36;
      const fb = ctx.createGain();
      fb.gain.value = 0.3;
      const wet = ctx.createGain();
      wet.gain.value = 0.25;
      out.connect(tone);
      tone.connect(ctx.destination);
      tone.connect(echo);
      echo.connect(fb);
      fb.connect(echo);
      echo.connect(wet);
      wet.connect(ctx.destination);
      SND.ctx = ctx;
      SND.out = out;
    }
    return SND.ctx;
  }
  function setSound(on) {
    if (on && !reduced) {
      const ctx = soundGraph();
      SND.on = !!ctx;
      if (ctx) {
        if (ctx.state !== 'running') ctx.resume().catch(() => { /* the browser keeps it paused */ });
        SND.out.gain.cancelScheduledValues(ctx.currentTime);
        SND.out.gain.setTargetAtTime(0.18, ctx.currentTime, 0.15);
      }
    } else {
      SND.on = false;
      const ctx = SND.ctx;
      if (ctx) {
        SND.out.gain.cancelScheduledValues(ctx.currentTime);
        SND.out.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
        setTimeout(() => { if (!SND.on && ctx.state === 'running') ctx.suspend().catch(() => { /* already closed */ }); }, 500);
      }
    }
    syncCC();
  }
  /** One soft note for planet i: a sine with a quiet octave above it, a quick rise, a long fade. */
  function chime(i) {
    const ctx = SND.ctx;
    if (!SND.on || !ctx || ctx.state !== 'running' || doc.hidden) return;
    const t = ctx.currentTime;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.5, t + 0.025);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    const lo = ctx.createOscillator();
    lo.type = 'sine';
    lo.frequency.value = TONES[i];
    const hi = ctx.createOscillator();
    hi.type = 'sine';
    hi.frequency.value = TONES[i] * 2;
    const hiGain = ctx.createGain();
    hiGain.gain.value = 0.12;
    lo.connect(env);
    hi.connect(hiGain);
    hiGain.connect(env);
    env.connect(SND.out);
    lo.start(t);
    hi.start(t);
    lo.stop(t + 2.5);
    hi.stop(t + 2.5);
  }
  doc.addEventListener('visibilitychange', () => {
    if (!SND.ctx || !SND.on) return;
    if (doc.hidden) SND.ctx.suspend().catch(() => { /* closed */ }); else SND.ctx.resume().catch(() => { /* paused */ });
  });

  // ---------------------------------------------------------------- widget panels (from a widget)
  const GLYPHS = {
    appstore: '<path d="M12 4.5v10m0 0l-4-4m4 4l4-4M5.5 19h13"/>',
    demo: '<path d="M8.5 6.2v11.6L18 12z" fill="currentColor" stroke="none"/>',
    repo: '<path d="M9 7.5L4.5 12 9 16.5M15 7.5l4.5 4.5-4.5 4.5"/>',
    site: '<circle cx="12" cy="12" r="8.2"/><path d="M3.8 12h16.4M12 3.8c2.6 2.3 2.6 14.1 0 16.4M12 3.8c-2.6 2.3-2.6 14.1 0 16.4"/>',
    linkedin: '<circle cx="12" cy="8.6" r="3.4"/><path d="M5.5 19.2c1.1-3.4 3.7-4.9 6.5-4.9s5.4 1.5 6.5 4.9"/>',
    email: '<rect x="3.8" y="6.2" width="16.4" height="11.6" rx="2.2"/><path d="M4.5 7.5l7.5 5.6 7.5-5.6"/>',
  };
  const glyph = (k) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${GLYPHS[k] || ''}</svg>`;
  let openKey = null;
  let returnFocus = null;
  let closeTimer = 0;

  function linkEl(lk) {
    const a = doc.createElement('a');
    const external = /^https?:/i.test(lk.href);
    a.className = 'lnk';
    a.href = lk.href;
    if (external) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    a.innerHTML = `<span class="lk-ico">${glyph(lk.kind)}</span><span class="lk-txt"><b></b><small></small></span>`
      + (external ? '<span class="arr" aria-hidden="true">↗</span>' : '');
    $('b', a).textContent = C().linkKinds[lk.kind] || lk.kind;
    $('small', a).textContent = lk.host;
    if (external) {
      const sr = doc.createElement('span');
      sr.className = 'sr-only';
      sr.textContent = C().newTab;
      $('.lk-txt', a).append(sr);
    }
    return a;
  }
  function fillSheet(key) {
    const def = D.sheets[key];
    const c = def[lang];
    S.icon.innerHTML = icon(def.icon);
    S.kicker.textContent = c.kicker || '';
    S.title.textContent = c.title;
    if (c.titleZh) {
      const z = doc.createElement('span');
      z.className = 'zh';
      z.lang = 'zh-CN';
      z.textContent = c.titleZh;
      S.title.append(' ', z);
    }
    S.desc.textContent = c.desc;
    S.stats.textContent = '';
    for (const [value, label] of c.stats || []) {
      let v = value;
      let l = label;
      if (value.startsWith('@day:')) {
        const it = dayItem(value.slice(5));
        if (!it) continue;
        v = dayValUnit(it);
        l = dayLabelCap(it);
      }
      const row = doc.createElement('div');
      row.className = 'stat';
      const dt = doc.createElement('dt');
      dt.textContent = l;
      const dd = doc.createElement('dd');
      if (v === '@time') { dd.dataset.live = 'time'; dd.textContent = localTime(); } else dd.textContent = v;
      row.append(dt, dd);
      S.stats.append(row);
    }
    S.stats.hidden = !S.stats.childElementCount;
    S.stats.classList.toggle('text', !!def.textStats);
    S.foot.textContent = c.foot || '';
    S.foot.hidden = !c.foot;
    S.links.textContent = '';
    (def.links || []).forEach((lk) => S.links.append(linkEl(lk)));
    S.links.hidden = !(def.links && def.links.length);
    S.note.textContent = c.note || '';
    S.note.hidden = !c.note;
    S.open.hidden = !def.app;
    if (def.app) { S.open.dataset.app = def.app; S.open.textContent = fmt(C().openApp, { name: C().appNames[def.app] }); }
  }
  function openSheetUI(key, instant) {
    if (!D.sheets[key]) return;
    clearTimeout(closeTimer);
    if (!openKey) {
      const a = doc.activeElement;
      returnFocus = a && a !== body && a !== root ? a : null;
    }
    openKey = key;
    fillSheet(key);
    S.layer.hidden = false;
    S.sheet.scrollTop = 0;
    S.sheet.style.transform = '';
    if (!instant) void S.layer.offsetWidth; // start the slide from below
    S.layer.classList.add('open');
    S.title.focus({ preventScroll: true });
  }
  function closeSheetUI(instant) {
    if (!openKey) return;
    openKey = null;
    S.layer.classList.remove('open');
    const done = () => { if (!openKey) { S.layer.hidden = true; S.sheet.style.transform = ''; } };
    if (instant) done(); else closeTimer = setTimeout(done, reduced ? 240 : 380);
    const f = returnFocus;
    returnFocus = null;
    queueFocus(f, () => (state.view === 'home' ? E.homeTitle : E.unlock));
  }

  // ---------------------------------------------------------------- app pages
  let appKey = null;
  let appReturn = null;
  let launchRect = null;
  let calMonth = null;
  const row = (l, v) => `<div class="tv-row"><span class="tv-l">${esc(l)}</span><span class="tv-v">${esc(v)}</span></div>`;
  const sec = (hd, inner, foot, bare) => `<section class="tv-sec">${hd ? `<h3 class="tv-head">${esc(hd)}</h3>` : ''}`
    + `${bare ? inner : `<div class="tv">${inner}</div>`}${foot ? `<p class="tv-foot">${esc(foot)}</p>` : ''}</section>`;
  const linkBtn = (label, href, primary) => `<a class="btn${primary ? ' primary' : ''}" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)}<span class="sr-only">${esc(C().newTab)}</span>${extIcon}</a>`;
  const linkRow = (label, href, sub) => {
    const ext = /^https?:/i.test(href);
    return `<a class="tv-row tv-link" href="${esc(href)}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}><span class="tv-l">${esc(label)}</span>`
      + `<span class="tv-v">${esc(sub)}</span>${ext ? `<span class="sr-only">${esc(C().newTab)}</span><span class="tv-go">${extIcon}</span>` : ''}</a>`;
  };
  const host = (u) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  const head = (ic, title, sub, btns) => `<div class="ap-head">${icon(ic)}<div class="ap-titles"><h3 class="ap-title">${esc(title)}</h3>`
    + `${sub ? `<p class="ap-sub">${esc(sub)}</p>` : ''}${btns && btns.length ? `<div class="ap-btns">${btns.join('')}</div>` : ''}</div></div>`;
  const numbered = (items) => items.map((x, i) => `<div class="tv-row"><span class="tv-n" aria-hidden="true">${i + 1}</span><span class="tv-l">${esc(x)}</span></div>`).join('');

  function tzOffset(tz, now = new Date()) {
    try {
      const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
      const o = {};
      for (const x of f.formatToParts(now)) o[x.type] = x.value;
      return (Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour % 24, +o.minute) - Math.floor(now.getTime() / 60000) * 60000) / 60000;
    } catch (e) { return null; }
  }
  function myZone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch (e) { return null; }
  }
  // #177: the visitor's row follows the virtual clock like Albany's, and its "hr ahead" is worked
  // out again each minute, as it changes when either place changes its clocks
  function zoneTime(tz, t = vnow()) {
    try { return new Intl.DateTimeFormat(LOC(), { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date(t)); } catch (e) { return ''; }
  }
  function zoneRel(tz, t = vnow()) {
    const now = new Date(t);
    return relText((tzOffset(tz, now) - tzOffset(TZ, now)) / 60);
  }
  function worldRows(t) {
    const rows = [`<div class="tv-row wc-row">${clockFace('ico ico-clock')}<span class="tv-l">${esc(t.albany)}<br><small class="tv-sub">${esc(t.today)}</small></span>`
      + `<span class="tv-v" data-live="time">${esc(localTime())}</span></div>`];
    const mine = myZone();
    if (mine) {
      const city = mine.split('/').pop().replace(/_/g, ' ');
      rows.push(`<div class="tv-row"><span class="tv-l">${esc(t.you)} · ${esc(city)}<br><small class="tv-sub" data-live="rel">${esc(zoneRel(mine))}</small></span>`
        + `<span class="tv-v" data-live="mytime">${esc(zoneTime(mine))}</span></div>`);
    }
    return rows.join('');
  }
  function updateWorld() {
    const mine = myZone();
    if (mine) {
      for (const el of $$('[data-live="mytime"]', A.body)) setText(el, zoneTime(mine));
      for (const el of $$('[data-live="rel"]', A.body)) setText(el, zoneRel(mine));
    }
    paintWorldMap();
  }
  // #142: where it is day and night right now (or at the travelled time), on an equirectangular
  // map: the shading is the night side and the three twilights (the Sun 0°, 6°, 12° and 18°
  // below the horizon), worked out row by row from subsolarPoint() in live/astro.mjs. Under it the
  // land: Natural Earth's 1:110m outline (public domain), one path made by scripts/land_path.py
  // (pages/src/land.txt, D.land), in a quiet fill with a light edge; the dots are the Sky app's
  // cities. Albany and the city of the visitor's time zone are marked, and Albany says whether it
  // is day, dawn, dusk or night. The sea, the land, the grid and the cities are drawn once; a new
  // minute (or time travel) redraws only the shading and the marks.
  let wmapBase = '';
  function worldMapSVG(t) {
    const W = 360;
    const H = 180;
    const X = (lon) => ((lon + 180) / 360) * W;
    const Y = (lat) => ((90 - lat) / 180) * H;
    const sub = Astro.subsolarPoint(t);
    const sd = Math.sin(sub.lat * D2R);
    const cd = Math.cos(sub.lat * D2R);
    if (!wmapBase) {
      let g = '';
      for (let lon = -150; lon < 180; lon += 30) g += `<line x1="${X(lon)}" y1="0" x2="${X(lon)}" y2="${H}"/>`;
      for (let lat = -60; lat <= 60; lat += 30) g += `<line x1="0" y1="${Y(lat)}" x2="${W}" y2="${Y(lat)}"/>`;
      const land = D.land ? `<path class="wm-land" d="${esc(D.land.d)}" transform="scale(${D.land.scale})" fill-rule="evenodd"/>` : '';
      wmapBase = `<rect class="wm-sea" width="${W}" height="${H}"/>${land}<g class="wm-grid">${g}</g><g class="wm-cities">`
        + SkyData.CITIES.map((r) => `<circle cx="${X(r[4]).toFixed(1)}" cy="${Y(r[3]).toFixed(1)}" r="1.15"/>`).join('') + '</g>';
    }
    // the region where the Sun is lower than h0, as 2° rows: at latitude φ the Sun is below h0
    // where its hour angle H has cos H < (sin h0 − sin φ sin δ) / (cos φ cos δ)
    const layer = (h0) => {
      const s0 = Math.sin(h0 * D2R);
      let d = '';
      const box = (a, b, lat) => { d += `M${X(a).toFixed(1)},${Y(lat + 1).toFixed(1)}H${X(b).toFixed(1)}V${Y(lat - 1).toFixed(1)}H${X(a).toFixed(1)}Z`; };
      for (let lat = 89; lat >= -89; lat -= 2) {
        const c = (s0 - Math.sin(lat * D2R) * sd) / (Math.cos(lat * D2R) * cd);
        if (c <= -1) continue;
        if (c >= 1) { box(-180, 180, lat); continue; }
        const h = Math.acos(c) / D2R;
        const from = wrap180(sub.lon + h);
        const width = 360 - 2 * h;
        if (from + width <= 180) box(from, from + width, lat);
        else { box(from, 180, lat); box(-180, from + width - 360, lat); }
      }
      return d;
    };
    const night = [0, -6, -12, -18].map((h0) => `<path d="${layer(h0)}"/>`).join('');
    const alb = cityById('albany');
    const sunAlt = Astro.observe('sun', t, alb.lat, alb.lon).alt;
    const rising = Astro.observe('sun', t + 600000, alb.lat, alb.lon).alt > sunAlt;
    const st = sunAlt > Astro.HORIZON.sun ? 'day' : sunAlt < -18 ? 'night' : rising ? 'dawn' : 'dusk';
    const c = C().app.clock;
    const mark = (city, label, cls) => {
      const x = X(city.lon);
      const y = Y(city.lat);
      const left = x > W - 80;
      return `<g class="wm-mark ${cls}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.8"/>`
        + `<text x="${(x + (left ? -5 : 5)).toFixed(1)}" y="${(y + 2.6).toFixed(1)}" text-anchor="${left ? 'end' : 'start'}">${esc(label)}</text></g>`;
    };
    let marks = mark(alb, `${placeShort(alb)} · ${c.mapLabel[st]}`, 'wm-albany');
    const mine = guessCity();
    if (mine && mine.id !== 'albany' && Math.hypot(mine.lat - alb.lat, mine.lon - alb.lon) > 6) marks += mark(mine, placeShort(mine), 'wm-you');
    const where = fmtCoord(sub.lat, sub.lon);
    const aria = fmt(c.mapAria, { where, state: c.states[st] });
    const dyn = `<g class="wm-night">${night}</g><g class="wm-sun"><circle cx="${X(sub.lon).toFixed(1)}" cy="${Y(sub.lat).toFixed(1)}" r="4.2"/></g>${marks}`;
    return { st, aria, dyn, svg: `<svg class="wmap-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(aria)}">${wmapBase}<g class="wm-dyn">${dyn}</g></svg>` };
  }
  function paintWorldMap() {
    const box = $('#wmap', A.body);
    if (appKey !== 'clock' || !box) return;
    const m = worldMapSVG(vnow());
    const svg = box.firstElementChild;
    const dyn = svg && $('.wm-dyn', svg);
    if (dyn) { dyn.innerHTML = m.dyn; svg.setAttribute('aria-label', m.aria); } else box.innerHTML = m.svg;
    box.dataset.state = m.st;
    setText($('#wmapCap', A.body), C().app.clock.states[m.st]);
  }
  /** The lock screen's orbit, copied for the Clock app (ids renamed so they stay unique). */
  function clockOrbit() {
    const svg = $('.orbit-svg', E.orbit);
    return `<div class="orbit" aria-hidden="true">${svg ? svg.outerHTML.replace(/orb-/g, 'clk-') : ''}</div>`;
  }
  /** #177: the Calendar follows the date, past midnight in Albany (or when time travel changes
   *  the day): its today and its header move on, and so does its month if it was showing the
   *  month of the day before. */
  let calToday = '';
  function followCalendar() {
    const today = albanyISO(new Date(vnow()));
    if (!calToday || today === calToday) return;
    const [y, m] = isoParts(calToday);
    if (calMonth && calMonth[0] === y && calMonth[1] === m) calMonth = null;
    const top = A.body.scrollTop;
    const a = doc.activeElement;
    const nav = a && A.body.contains(a) && /^(prev|next)$/.test(a.dataset.cal || '') ? a.dataset.cal : '';
    const inside = !nav && a && A.body.contains(a);
    renderApp('calendar');
    A.body.scrollTop = top;
    if (nav) { const f = $(`[data-cal="${nav}"]`, A.body); if (f) f.focus({ preventScroll: true }); } else if (inside) A.title.focus({ preventScroll: true });
  }
  function calendarHTML(t) {
    const today = albanyISO(new Date(vnow()));
    calToday = today;
    const [ty, tm] = isoParts(today);
    if (!calMonth) calMonth = [ty, tm];
    const [y, m] = calMonth;
    const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const marks = new Set(t.items.map((it) => it.when).filter((w) => /^\d{4}-\d{2}-\d{2}$/.test(w)));
    // #127: each day has a small, faint Moon as it is at noon in Albany; the day of each new,
    // first-quarter, full and last-quarter Moon (moonPhases(), to the minute) is named, and the
    // list under the grid says the same for screen readers
    const phases = Astro.moonPhases(Astro.zonedTime(y, m, 1, 0, 0, TZ), Astro.zonedTime(y, m + 1, 1, 0, 0, TZ))
      .map((p) => ({ ...p, iso: albanyISO(new Date(p.t)) }));
    const phaseOn = new Map(phases.map((p) => [p.iso, p]));
    let cells = t.week.map((w) => `<span class="wd">${esc(w)}</span>`).join('');
    for (let i = 0; i < first; i++) cells += '<span class="d blank"></span>';
    for (let d = 1; d <= days; d++) {
      const iso = `${y}-${pad(m)}-${pad(d)}`;
      const ph = phaseOn.get(iso);
      const cls = (iso === today ? ' today' : '') + (marks.has(iso) ? ' mark' : '') + (ph ? ' ph' : '');
      cells += `<span class="d${cls}"${iso === today ? ' aria-current="date"' : ''}${ph ? ` data-phase="${ph.q}"` : ''}><span class="dn">${d}</span>`
        + `${moonIcon(Astro.moonPhase(Astro.zonedTime(y, m, d, 12, 0, TZ)), 12)}${ph ? `<small class="ph-w">${esc(t.phaseShort[ph.q])}</small>` : ''}</span>`;
    }
    const moons = phases.map((p) => `<li data-phase="${p.q}">${moonIcon(Astro.moonPhase(p.t), 14)}<span>`
      + `${esc(fmt(t.moonItem, { date: fmtDate(p.iso, { month: 'short', day: 'numeric' }), phase: t.phases[p.q], time: timeIn(Math.round(p.t / 60000) * 60000, TZ) }))}</span></li>`).join('');
    const items = t.items.slice().sort((a, b) => (a.when < b.when ? -1 : 1));
    const todays = items.filter((it) => it.when === today);
    const milestone = (it) => `<button type="button" class="tv-row tv-link" data-goto="${esc(it.app)}"><span class="tv-l">${esc(it.text)}</span>`
      + `<span class="tv-v">${esc(whenShort(it.when))}</span></button>`;
    return `<div class="cal-top"><h3><b>${esc(calWd())}</b> ${esc(whenLong(today))}</h3></div>`
      + (lang === 'zh' ? `<p class="cal-lunar" aria-label="${esc(t.lunar)}">${esc(lunarLine(vnow()))}</p>` : '')
      + sec(t.today, todays.length ? todays.map(milestone).join('') : `<p class="tv-p">${esc(t.none)}</p>`)
      + `<section class="tv-sec"><div class="tv month-card"><div class="cal-top month-head"><h3 class="cal-month">${esc(fmtDate(`${y}-${pad(m)}`, { month: 'long', year: 'numeric' }))}</h3>`
      + `<div class="cal-nav"><button type="button" class="ghost" data-cal="prev" aria-label="${esc(t.prev)}"><svg width="16" height="16" aria-hidden="true" focusable="false"><use href="#u-prev"/></svg></button>`
      + `<button type="button" class="ghost" data-cal="next" aria-label="${esc(t.next)}"><svg width="16" height="16" aria-hidden="true" focusable="false"><use href="#u-chev"/></svg></button></div></div>`
      + `<div class="month"><div class="month-grid" aria-hidden="true">${cells}</div>`
      + `<ul class="cal-moons" aria-label="${esc(t.moonHead)}">${moons}</ul></div></div><p class="tv-foot">${esc(t.moonFoot)}</p></section>`
      + sec(t.milestones, items.map(milestone).join(''));
  }
  const RENDER = {
    silnest: (t) => head('silnest', t.title, t.sub, [linkBtn(t.get, D.facts.storeUrl, true)])
      + roleHTML('silnest')
      + sec(t.shotsHead, `<div class="shots">${t.shots.map((alt, i) => `<div class="shot img-sn-${i ? 's6' : 's1'}" role="img" aria-label="${esc(alt)}"></div>`).join('')}</div>`, '', true)
      + sec(t.descHead, `<p class="tv-p">${esc(t.desc)}</p><p class="tv-p">${esc(t.desc2)}</p>`)
      + notesHTML(t)
      + sec(t.infoHead, t.info.map(([l, v]) => row(l, v)).join(''), t.foot)
      + numbersHTML('silnest'),
    storewright: (t, c) => {
      const sw = D.facts.sw;
      let day = '';
      if (hasDay) {
        day = sec(fmt(t.dayHead, { date: whenLong(D.day.date) }), D.day.headline.map((it) => row(dayLabelCap(it), dayValUnit(it))).join(''), t.dayFoot);
      }
      return head('storewright', t.title, t.sub, [linkBtn(t.demo, sw.demo, true), linkBtn(t.repo, sw.repo)])
        + roleHTML('storewright')
        + `<section class="tv-sec"><div class="pic img-sw-demo" role="img" aria-label="${esc(t.shot)}"></div></section>`
        + sec(t.statusHead, t.status.map(([l, v]) => row(l, v)).join(''))
        + sec(t.threeHead, numbered(t.three))
        + sec(t.evalHead, t.eval.map(([l, v]) => row(l, v)).join(''), t.evalFoot)
        + day
        + labHTML()
        + gameHTML()
        + sec(t.linksHead, linkRow(c.linkKinds.demo, sw.demo, host(sw.demo)) + linkRow(c.linkKinds.repo, sw.repo, host(sw.repo)))
        + numbersHTML('storewright');
    },
    site: (t) => head('site', t.title, t.sub, [linkBtn(t.visit, D.facts.links.site, true)])
      + roleHTML('site')
      + `<section class="tv-sec"><div class="pic site img-site-home" role="img" aria-label="${esc(t.shot)}"></div></section>`
      + sec('', `<p class="tv-p">${esc(t.desc)}</p>`)
      + sec(t.infoHead, t.info.map(([l, v]) => row(l, v)).join('')),
    vocal: (t) => head('vocal', t.title, t.sub)
      + roleHTML('vocal')
      + sec(t.statusHead, t.status.map(([l, v]) => row(l, v)).join(''))
      + sec(t.pipeHead, `<div class="flow" aria-hidden="true">${t.pipe.map(([, v], i) => `${i ? '<span>→</span>' : ''}<b>${esc(v)}</b>`).join('')}</div>`
        + t.pipe.map(([l, v]) => row(l, v)).join(''))
      + sec(t.hwHead, t.hw.map((x) => `<div class="tv-row"><span class="tv-l">${esc(x)}</span></div>`).join(''), t.note),
    how: (t) => `<p class="quote">${esc(t.quote)}</p>` + sec(t.loopHead, numbered(t.loop), t.foot)
      + changeHTML(t) + faqHTML(t) + skillsHTML(t) + timelineHTML(t),
    contact: (t, c) => {
      const lk = D.facts.links;
      const initials = D.facts.name.split(/\s+/).map((x) => x[0]).join('').slice(0, 2);
      return `<div class="cardhead card"><span class="avatar" aria-hidden="true">${esc(initials)}</span>`
        + `<h3>${esc(D.facts.name)} <span lang="zh-CN">${esc(D.facts.nameZh)}</span></h3><p>${esc(t.card)}</p>`
        + `<a class="btn primary" id="vcard" href="${esc(D.vcard)}" download="${esc(t.file)}">${esc(t.add)}</a></div>`
        + askHTML(t)
        + `<section class="tv-sec"><h3 class="tv-head">${esc(t.say)}</h3><div class="tv">`
          + linkRow(t.rows.email, `mailto:${lk.email}`, lk.email) + linkRow(t.rows.linkedin, lk.linkedin, lk.linkedin_short)
          + linkRow(t.rows.site, lk.site, D.facts.site.domain) + row(t.rows.city, c.city)
          + `<div class="tv-row"><span class="tv-l">${esc(t.rows.time)}</span><span class="tv-v" data-live="time">${esc(localTime())}</span></div>`
          + `${yourRow(t)}</div>${replyHTML(t)}</section>`
        + resumeHTML(t)
        + bookingHTML(t) + qrHTML(t) + testimonialsHTML(t)
        + guestbookHTML(c);
    },
    clock: (t) => `<div class="bigclock card${TS.on ? ' true' : ''}">${clockOrbit()}<p data-live="hms">${esc(timeHMS())}</p><small>${esc(t.region)}</small></div>`
      + `<div class="clk-scale"><button type="button" class="qs-row qs-switch" id="clkTrue" aria-pressed="${TS.on}" aria-describedby="clkTrueNote">`
      + `<span class="qs-l">${esc(t.trueScale)}</span><span class="switch" aria-hidden="true"><i></i></span></button>`
      + `<p class="sky-note clk-note" id="clkTrueNote" aria-live="polite">${esc(TS.on ? '' : t.evenNote)}</p><div class="clk-inset" id="clkInset" hidden></div></div>`
      + `<section class="tv-sec"><h3 class="tv-head">${esc(t.mapHead)}</h3><div class="tv wmap-card"><div class="wmap" id="wmap"></div>`
      + `<p class="wmap-cap" id="wmapCap"></p></div><p class="tv-foot">${esc(fmt(t.mapFoot, { n: SkyData.CITIES.length }))}</p></section>`
      + sec(t.head, worldRows(t)),
    calendar: (t) => calendarHTML(t),
    sky: (t) => skyShell(t),
    design: (t) => designHTML(t),
    assets: (t, c) => assetsHTML(t, c),
    uses: (t) => usesHTML(t),
  };
  function renderApp(key) {
    const c = C();
    const t = c.app[key] || {};
    A.title.textContent = t.nav || t.title || c.appNames[key];
    A.view.dataset.app = key;
    A.body.innerHTML = `<div class="app-in">${(RENDER[key] || (() => ''))(t, c)}</div>`;
  }
  function iconRect(key) {
    if (state.view !== 'home') return null;
    const el = $(`.app[data-app="${key}"] .ico, .dock-app[data-app="${key}"] .ico`);
    const r = el && el.getBoundingClientRect();
    return r && r.width ? r : null;
  }
  /** App launch: scale from 0.96 plus a fade (200 ms), centred on what was tapped. */
  function zoomIn(key) {
    const r = launchRect || iconRect(key);
    launchRect = null;
    for (const an of A.view.getAnimations()) an.cancel();
    if (reduced || !r) {
      A.view.animate([{ opacity: 0 }, { opacity: 1 }], { duration: reduced ? 140 : 200, easing: 'ease' });
      delete A.view.dataset.origin;
      return;
    }
    const ox = r.left + r.width / 2;
    const oy = r.top + r.height / 2;
    A.view.style.transformOrigin = `${ox}px ${oy}px`;
    A.view.dataset.origin = `${Math.round(ox)} ${Math.round(oy)}`;
    A.view.animate([{ transform: 'scale(0.96)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 200, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
  function zoomOut(key, done) {
    for (const an of A.view.getAnimations()) an.cancel();
    const an = A.view.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: reduced ? 'scale(1)' : 'scale(0.97)', opacity: 0 }],
      { duration: reduced ? 120 : 160, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
    an.onfinish = () => { done(); an.cancel(); };
  }
  function openAppUI(key, instant) {
    clearTimeout(A.layer._t);
    if (!appKey) {
      const a = doc.activeElement;
      appReturn = a && a !== body && a !== root && !A.layer.contains(a) ? a : null;
    }
    appKey = key;
    if (key === 'calendar') calMonth = null;
    renderApp(key);
    A.layer.hidden = false;
    A.body.scrollTop = 0;
    body.classList.add('app-open');
    A.view.classList.remove('sky-red');
    if (key === 'sky') paintSky();
    if (key === 'clock') paintWorldMap();
    afterRender(key);
    if (instant) { for (const an of A.view.getAnimations()) an.cancel(); } else zoomIn(key);
    A.title.focus({ preventScroll: true });
    syncOrbit();
    focusPending();
    if (key === 'sky' && SKY.select) skySelect();
  }
  function closeAppUI(instant) {
    if (!appKey) return;
    const key = appKey;
    if (key === 'sky') aimStop();
    appKey = null;
    body.classList.remove('app-open');
    const done = () => { if (!appKey) { A.layer.hidden = true; A.body.textContent = ''; } };
    if (instant) done(); else zoomOut(key, done);
    const f = appReturn;
    appReturn = null;
    queueFocus(f, () => E.homeTitle);
    syncOrbit();
  }

  // ---------------------------------------------------------------- the "Early work" folder
  let folderSel = 0;
  let folderOpen = false;
  let folderReturn = null;
  function renderFolder() {
    const c = C();
    F.grid.innerHTML = D.early.map((e, i) => `<li><a class="fapp" href="${esc(e.href)}" target="_blank" rel="noopener noreferrer" data-i="${i}" aria-describedby="folderDetail">`
      + `${icon(e.icon)}<span class="lbl">${esc(e.repo)}</span><span class="sr-only">${esc(c.newTab)}</span></a></li>`).join('');
    selectFolder(folderSel);
  }
  function selectFolder(i) {
    folderSel = clamp(i, 0, D.early.length - 1);
    const e = D.early[folderSel];
    const t = e[lang];
    $$('.fapp', F.grid).forEach((a, j) => a.setAttribute('aria-current', String(j === folderSel)));
    F.detail.innerHTML = `<p class="fd-name">${esc(e.repo)}</p><p class="fd-kind">${esc(t.kind)}</p><p class="fd-line">${esc(t.line)}</p>`
      + `<a class="btn" href="${esc(e.href)}" target="_blank" rel="noopener noreferrer">${esc(C().folder.open)}<span class="sr-only">${esc(C().newTab)}</span>${extIcon}</a>`;
  }
  function openFolderUI(instant) {
    clearTimeout(F.layer._t);
    if (!folderOpen) {
      const a = doc.activeElement;
      folderReturn = a && a !== body && a !== root && !F.layer.contains(a) ? a : null;
    }
    folderOpen = true;
    renderFolder();
    F.layer.hidden = false;
    const ic = iconRect('early');
    if (ic) F.box.style.transformOrigin = `${ic.left + ic.width / 2 - F.box.offsetLeft}px ${ic.top + ic.height / 2 - F.box.offsetTop}px`;
    if (!instant) void F.layer.offsetWidth;
    F.layer.classList.add('open');
    F.title.focus({ preventScroll: true });
  }
  function closeFolderUI(instant) {
    if (!folderOpen) return;
    folderOpen = false;
    F.layer.classList.remove('open');
    const done = () => { if (!folderOpen) F.layer.hidden = true; };
    if (instant) done(); else F.layer._t = setTimeout(done, reduced ? 220 : 300);
    const f = folderReturn;
    folderReturn = null;
    queueFocus(f, () => $('.app[data-app="early"]') || E.homeTitle);
  }
  // A tap (which also focuses the link) must not count as already chosen: remember the choice at pointerdown.
  let selAtDown = null;
  F.grid.addEventListener('pointerdown', () => { selAtDown = folderSel; });
  F.grid.addEventListener('click', (e) => {
    const a = e.target.closest('.fapp');
    if (!a) return;
    const i = Number(a.dataset.i);
    const before = e.detail === 0 || selAtDown === null ? folderSel : selAtDown; // keyboard: focus already chose it
    selAtDown = null;
    // first tap shows what it is; a tap on the one already shown opens GitHub
    if (i !== before) { e.preventDefault(); selectFolder(i); }
  });
  F.grid.addEventListener('pointerover', (e) => {
    const a = e.target.closest('.fapp');
    if (a && e.pointerType === 'mouse') selectFolder(Number(a.dataset.i));
  });
  F.grid.addEventListener('focusin', (e) => {
    const a = e.target.closest('.fapp');
    if (a) selectFolder(Number(a.dataset.i));
  });
  F.scrim.addEventListener('click', () => closeFolder());

  // ---------------------------------------------------------------- Today, Quick settings, Search
  let overlay = null;
  let overlayReturn = null;
  const OV = { nc: NC.layer, cc: CC.layer, spot: SP.layer, keys: K.layer, about: AB.layer };
  function ncSummary() {
    const c = C().nc;
    const parts = [fmt(c.time, { time: localTime() })];
    const o = dayItem('Orders fulfilled');
    if (o) {
      const diff = dayDiff(albanyISO(), D.day.date);
      const when = diff === 0 ? c.whenToday : diff === 1 ? c.whenYesterday : fmt(c.whenOn, { date: whenMD(D.day.date) });
      parts.push(fmt(c.day, { n: dayVal(o), when }));
    }
    parts.push(fmt(c.sn, { version: D.facts.snVersion, date: whenMD(D.facts.snReleased) }));
    return parts.join(lang === 'zh' ? '' : ' ');
  }
  function buildNCWidgets() {
    NC.widgets.textContent = '';
    let pair = null;
    for (const w of WIDGETS) {
      const b = widgetButton(w);
      if (w.size === 'm') {
        const r = doc.createElement('div');
        r.className = 'nc-row';
        r.append(b);
        NC.widgets.append(r);
        pair = null;
      } else {
        if (!pair) { pair = doc.createElement('div'); pair.className = 'nc-row'; NC.widgets.append(pair); }
        pair.append(b);
        if (pair.childElementCount === 2) pair = null;
      }
    }
  }
  /** #136 in Today, in English: Albany's next equinox or solstice, with a thin ring for the year.
   *  In Chinese the solar terms take its place (#95): the lunar date and the term in force, and
   *  the next term, round the same ring. */
  function paintNCSeason() {
    let html;
    if (lang === 'zh') {
      const t = vnow();
      html = `${seasonRing(Astro.solarLongitude(t) / 360)}<span class="nc-lunar"><span>${esc(lunarLine(t))}</span><span class="nc-next">${esc(nextTermLine(t))}</span></span>`;
    } else {
      const s = seasonLine(cityById('albany'), vnow());
      html = `${seasonRing(s.frac)}<span>${esc(s.text)}</span>`;
    }
    if (NC.season.innerHTML !== html) NC.season.innerHTML = html;
    NC.season.hidden = false;
  }
  function renderNC() {
    setText(NC.date, dateLine());
    setText(NC.summary, ncSummary());
    paintNCSeason();
    NC.notes.innerHTML = NOTES.map((n) => `<li class="nc-group"><h3>${icon(n.icon, 'ico-xs')}${esc(n[lang].title)}</h3>`
      + `<button type="button" class="nc-item" data-app="${esc(n.app)}"><p>${esc(noteBody(n))}</p><span class="nc-when">${esc(whenLong(n.when))}</span></button></li>`).join('');
  }
  function setNCTab(which, focus) {
    const today = which !== 'all';
    NC.tabToday.setAttribute('aria-selected', String(today));
    NC.tabAll.setAttribute('aria-selected', String(!today));
    NC.tabToday.tabIndex = today ? 0 : -1;
    NC.tabAll.tabIndex = today ? -1 : 0;
    NC.today.hidden = !today;
    NC.all.hidden = today;
    NC.scroll.scrollTop = 0;
    if (focus) (today ? NC.tabToday : NC.tabAll).focus();
  }
  function syncCC() {
    for (const b of $$('[data-appearance]', CC.appearance)) {
      const on = b.dataset.appearance === apPref;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    for (const b of $$('[data-weight]', CC.weight)) {
      const on = b.dataset.weight === weight;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    CC.lang.setAttribute('aria-pressed', String(lang === 'zh'));
    CC.motion.setAttribute('aria-pressed', String(reduced));
    CC.parallax.setAttribute('aria-pressed', String(parallaxActive()));
    CC.parallax.setAttribute('aria-disabled', String(reduced));
    CC.sound.setAttribute('aria-pressed', String(SND.on));
    CC.sound.setAttribute('aria-disabled', String(reduced));
    CC.standby.setAttribute('aria-pressed', String(SB.auto));
  }
  function appHay(k) {
    return [D.copy.en.appNames[k], D.copy.zh.appNames[k], D.copy.en.spot.keys[k], D.copy.zh.spot.keys[k]].join(' ').toLowerCase();
  }
  function factList() {
    const c = C().spot;
    const list = c.facts.slice();
    const o = dayItem('Orders fulfilled');
    if (o) list.push({ text: fmt(c.dayFact, { date: whenShort(D.day.date), n: dayVal(o) }), app: 'storewright' });
    return list;
  }
  function renderCommands(raw) {
    const c = C();
    const q = raw.slice(1).trim();
    const cmds = commandList(q);
    const ic = (cmd) => (cmd.icon ? icon(cmd.icon, 'ico-sm') : `<span class="ico ico-sm cmd-ico" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><use href="#u-${cmd.ui}"/></svg></span>`);
    const rowOf = (cmd) => (cmd.href
      ? `<a class="sp-row sp-cmd" href="${esc(cmd.href)}" target="_blank" rel="noopener noreferrer" data-cmd="${esc(cmd.id)}">${ic(cmd)}<span><span class="sp-t">${esc(cmd.label)}</span><span class="sp-s">${esc(cmd.href.replace(/^https:\/\//, ''))}</span></span><span class="sr-only">${esc(c.newTab)}</span></a>`
      : `<button type="button" class="sp-row sp-cmd" data-cmd="${esc(cmd.id)}">${ic(cmd)}<span><span class="sp-t">${esc(cmd.label)}</span></span></button>`);
    SP.list.innerHTML = cmds.length ? `<h3 class="sp-head">${esc(c.spot.cmdHead)}</h3>${cmds.map(rowOf).join('')}`
      : `<p class="sp-none">${esc(fmt(c.cmd.none, { q }))}</p>`;
    const first = $('.sp-row', SP.list);
    if (first) first.classList.add('first');
    SP.panel.classList.add('cmd-mode');
    SP.count.textContent = cmds.length === 1 ? c.spot.one : fmt(c.spot.count, { n: cmds.length });
  }
  const BODIES = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'moon'];
  /** #140: the planets and the Moon whose English or Chinese name the search matches. */
  function skyBodiesFor(raw) {
    const q = raw.trim().toLowerCase();
    if (q.length < 2) return [];
    const terms = q.split(/\s+/);
    return BODIES.filter((k) => {
      const hay = `${D.copy.en.planets.names[k]} ${D.copy.zh.planets.names[k]}${k === 'moon' ? ' 月球' : ''}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }
  function renderSpot() {
    const c = C();
    const s = c.spot;
    const raw = SP.input.value.trim();
    if (raw.startsWith('>')) { renderCommands(raw); return; }
    SP.panel.classList.remove('cmd-mode');
    const terms = raw.toLowerCase().split(/\s+/).filter(Boolean);
    const hit = (hay) => terms.every((t) => hay.includes(t));
    const apps = APPS.concat('early', 'guestbook').filter((k) => !terms.length || hit(appHay(k)));
    const early = terms.length ? D.early.map((e, i) => ({ e, i })).filter(({ e }) => hit(`${e.repo} ${e.en.kind} ${e.en.line} ${e.zh.kind} ${e.zh.line}`.toLowerCase())) : [];
    const facts = terms.length ? factList().filter((f) => hit(f.text.toLowerCase())) : [];
    const skills = D.skills.map((g) => ({ g, items: g.items.filter((it) => !terms.length || hit(`${it} ${g.en} ${g.zh}`.toLowerCase())) }))
      .filter((x) => x.items.length);
    let html = '';
    let n = 0;
    const hd = (t) => `<h3 class="sp-head">${esc(t)}</h3>`;
    // a planet or the Moon comes first, with where to look for it tonight; Enter shows it in the Sky
    const bodies = skyBodiesFor(raw);
    if (bodies.length) {
      const city = homeCity();
      const night = tonightFor(city);
      html += hd(s.skyHead) + bodies.map((k) => `<button type="button" class="sp-row" data-body="${k}">${icon('sky', 'ico-sm')}<span><span class="sp-t">${esc(c.planets.names[k])}</span>`
        + `<span class="sp-s">${esc(fmt(c.planets.tonight, { city: placeShort(city), text: bodyTonightText(k, city, night) }))}</span></span></button>`).join('');
      n += bodies.length;
    }
    // #115: "about", "关于", "privacy", "无障碍"… offer About this site first
    const aboutHay = `${D.copy.en.siteNav.about} ${D.copy.zh.siteNav.about} about info privacy accessibility 关于 本站 隐私 无障碍`.toLowerCase();
    if (terms.length && hit(aboutHay)) {
      html += hd(c.siteNav.head) + `<button type="button" class="sp-row" data-site="about">${icon('about', 'ico-sm')}<span><span class="sp-t">${esc(c.siteNav.about)}</span></span></button>`;
      n += 1;
    }
    // R3.3 batch 3: "resume", "brief", "简历"… offer the quick view; "present", "演示"… present mode
    const views = [['brief', BRIEF_HAY, 'today'], ['present', PRESENT_HAY, 'play']].filter(([k, hay]) => terms.length && hit(`${D.copy.en.cmd[k]} ${D.copy.zh.cmd[k]} ${hay}`.toLowerCase()));
    if (views.length) {
      html += hd(c.siteNav.head) + views.map(([k, , ui]) => `<button type="button" class="sp-row" data-cmd="${k}"><span class="ico ico-sm cmd-ico" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><use href="#u-${ui}"/></svg></span>`
        + `<span><span class="sp-t">${esc(c.cmd[k])}</span></span></button>`).join('');
      n += views.length;
    }
    if (apps.length) {
      html += hd(s.apps) + apps.map((k) => `<button type="button" class="sp-row" data-app="${k}">${icon(k, 'ico-sm')}<span><span class="sp-t">${esc(c.appNames[k])}</span></span></button>`).join('');
      n += apps.length;
    }
    if (early.length) {
      html += hd(s.early) + early.map(({ e, i }) => `<button type="button" class="sp-row" data-early="${i}">${icon(e.icon, 'ico-sm')}<span><span class="sp-t">${esc(e.repo)}</span>`
        + `<span class="sp-s">${esc(e[lang].line)}</span></span></button>`).join('');
      n += early.length;
    }
    if (facts.length) {
      html += hd(s.factsHead) + facts.map((f) => `<button type="button" class="sp-row" data-app="${esc(f.app)}">${icon(f.app, 'ico-sm')}<span><span class="sp-t">${esc(f.text)}</span>`
        + `<span class="sp-s">${esc(c.appNames[f.app])}</span></span></button>`).join('');
      n += facts.length;
    }
    if (skills.length) {
      html += hd(s.skills) + skills.map(({ g, items }) => `<p class="sp-group">${esc(g[lang])}</p><ul class="sp-chips">${items.map((it) => `<li>${esc(it)}</li>`).join('')}</ul>`).join('');
      n += skills.reduce((a, x) => a + x.items.length, 0);
    }
    if (!n) html = `<p class="sp-none">${esc(fmt(s.none, { q: raw }))}</p>`;
    SP.list.innerHTML = html;
    // Enter opens the first result: show which one
    const first = terms.length ? $('.sp-row', SP.list) : null;
    if (first) first.classList.add('first');
    SP.count.textContent = terms.length ? (n === 1 ? s.one : fmt(s.count, { n })) : '';
  }
  /** Render a layer and show it in its closed position (a finger may be about to pull it). */
  function prepareOverlay(name) {
    if (overlay && overlay !== name) closeOverlay({ instant: true, noFocus: true });
    const el = OV[name];
    clearTimeout(el._t);
    if (name === 'nc') renderNC();
    if (name === 'cc') syncCC();
    if (name === 'spot') renderSpot();
    if (name === 'keys') renderKeys();
    if (name === 'about') renderAbout();
    el.hidden = false;
  }
  function openOverlay(name, opts = {}) {
    if (overlay === name) return;
    if (overlay) closeOverlay({ instant: true, noFocus: true });
    endTour();
    const a = doc.activeElement;
    overlayReturn = a && a !== body && a !== root && !OV[name].contains(a) ? a : null;
    const el = OV[name];
    if (name === 'spot') SP.input.value = opts.q || '';
    if (el.hidden) { prepareOverlay(name); if (!opts.instant) void el.offsetWidth; } else if (name === 'spot') renderSpot();
    if (name === 'nc') { renderNC(); setNCTab(opts.tab || 'today'); }
    overlay = name;
    el.classList.add('open');
    setInert();
    if (name === 'nc') NC.date.focus({ preventScroll: true });
    else if (name === 'cc') ($('[aria-checked="true"]', CC.appearance) || CC.lang).focus({ preventScroll: true });
    else if (name === 'keys') K.title.focus({ preventScroll: true });
    else if (name === 'about') { AB.panel.scrollTop = 0; AB.title.focus({ preventScroll: true }); }
    else SP.input.focus({ preventScroll: true });
  }
  function abortOverlay(name) {
    const el = OV[name];
    el.classList.remove('open');
    clearTimeout(el._t);
    el._t = setTimeout(() => { if (overlay !== name) el.hidden = true; }, reduced ? 220 : 380);
  }
  function closeOverlay(opts = {}) {
    if (!overlay) return;
    const name = overlay;
    const el = OV[name];
    overlay = null;
    el.classList.remove('open');
    clearTimeout(el._t);
    if (opts.instant) el.hidden = true; else el._t = setTimeout(() => { if (overlay !== name) el.hidden = true; }, reduced ? 220 : 380);
    if (name === 'spot') SP.input.blur();
    setInert();
    const f = overlayReturn;
    overlayReturn = null;
    if (!opts.noFocus) {
      restoreFocus(f, () => (name === 'cc' ? E.ccGrab : name === 'nc' ? E.ncGrab : E.searchBtn));
    }
  }
  const toggleOverlay = (name) => (overlay === name ? closeOverlay() : openOverlay(name));
  /** Search opens over whatever is on screen; its results go to the home screen's apps. */
  function openSpotlight(q) {
    openOverlay('spot', { q: q || '' });
  }

  // ---------------------------------------------------------------- time travel (idea #82)
  // One slider moves the page's virtual clock: "Today" runs 00:00 to 23:59 in Albany by the
  // minute, "Dates" a year either side by the day. Let go and it comes back to now after
  // 1.5 s; "Back to now" and Esc come back at once. While the time is not now a badge says so,
  // the planets leave their decorative spin and glide to where they really were (or will be).
  const DAY_MS = 86400000;
  function ttLabel() {
    const t = vnow();
    const other = Astro.zonedParts(t, TZ).year !== Astro.zonedParts(Date.now(), TZ).year;
    return new Intl.DateTimeFormat(LOC(), {
      timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', ...(other ? { year: 'numeric' } : {}), hour: 'numeric', minute: '2-digit',
    }).format(new Date(t));
  }
  function ttTicks() {
    const c = C().tt;
    TT.ticks.innerHTML = (TT.mode === 'day' ? c.ticksDay : c.ticksDates).map((l) => `<span>${esc(l)}</span>`).join('');
    TT.ticks.dataset.n = String((TT.mode === 'day' ? c.ticksDay : c.ticksDates).length);
  }
  /** Put the slider where the virtual time is. */
  function ttSync() {
    const r = TT.range;
    if (TT.mode === 'day') {
      const p = Astro.zonedParts(vnow(), TZ);
      r.value = String(p.hour * 60 + p.minute);
    } else r.value = String(clamp(Math.round(ttOffset / DAY_MS), -365, 365));
    const f = (Number(r.value) - Number(r.min)) / (Number(r.max) - Number(r.min));
    r.style.setProperty('--fill', `${(f * 100).toFixed(2)}%`);
    r.setAttribute('aria-valuetext', ttLabel());
  }
  function ttSetMode(mode) {
    TT.mode = mode === 'dates' ? 'dates' : 'day';
    for (const b of $$('[role="radio"]', TT.scale)) {
      const on = b.dataset.scale === TT.mode;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    const r = TT.range;
    if (TT.mode === 'day') { r.min = '0'; r.max = '1439'; } else { r.min = '-365'; r.max = '365'; }
    r.setAttribute('aria-label', TT.mode === 'day' ? C().tt.sliderDay : C().tt.sliderDates);
    ttTicks();
    ttSync();
  }
  /** The virtual time moved (or came back): everything that shows the time follows. */
  function timeMoved() {
    lastMinute = '';
    tick();
    paintStoreDay();
    retargetOrbit();
    TT.badge.hidden = !travelling();
    body.classList.toggle('travelling', travelling());
    if (travelling()) setText(TT.badgeTxt, fmt(C().tt.badge, { time: ttLabel() }));
    TT.range.setAttribute('aria-valuetext', ttLabel());
    if (appKey === 'sky' && SKY.mode === 'now') queueSky();
    queueTonight();
    if (!travelling() && ED.card) {
      ED.card = false;
      if (OS.hover >= 0) showCard(OS.hover); else if (OS.focus >= 0) showCard(OS.focus); else hideCard();
    }
  }
  function setVirtual(off) {
    ttOffset = Math.abs(off) < 60000 ? 0 : Math.round(off);
    timeMoved();
  }
  /** #177: the moment an Albany wall time names, for the slider. In the hour the clocks repeat
   *  in the fall it is the one of the two nearer `near`, so a step of a minute moves the time a
   *  minute (not an hour back); in the hour they skip in the spring it is the jump itself
   *  (3:00 AM), so the slider never runs backwards there. */
  function wallInstant(y, mo, d, h, mi, near) {
    let t = Astro.zonedTime(y, mo, d, h, mi, TZ);
    const p = Astro.zonedParts(t, TZ);
    if (p.hour !== h || p.minute !== mi) {
      for (let k = 0; k < 180; k++) {
        const q = Astro.zonedParts(t - 60000, TZ);
        if (q.day !== p.day || q.hour * 60 + q.minute < h * 60 + mi) break;
        t -= 60000;
      }
      return t;
    }
    for (const later of [3600000, 1800000]) {
      const q = Astro.zonedParts(t + later, TZ);
      if (q.day === p.day && q.hour === h && q.minute === mi) return Math.abs(t + later - near) < Math.abs(t - near) ? t + later : t;
    }
    return t;
  }
  function ttFromSlider() {
    const v = Number(TT.range.value);
    const now = Date.now();
    const p = Astro.zonedParts(now, TZ);
    // "Today" by the minute of Albany's clock; "Dates" by whole days of its calendar at the same
    // time of day (steps of 24 hours would land an hour off across a daylight-saving change)
    const target = TT.mode === 'day' ? wallInstant(p.year, p.month, p.day, Math.floor(v / 60), v % 60, vnow())
      : wallInstant(p.year, p.month, p.day + v, p.hour, p.minute, now + v * DAY_MS) + (now % 60000);
    setVirtual(target - now);
    const f = (v - Number(TT.range.min)) / (Number(TT.range.max) - Number(TT.range.min));
    TT.range.style.setProperty('--fill', `${(f * 100).toFixed(2)}%`);
  }
  function ttBackToNow() {
    clearTimeout(TT.timer);
    const was = travelling();
    ttOffset = 0;
    ttSync();
    if (was) timeMoved();
  }
  function ttRelease() {
    clearTimeout(TT.timer);
    if (travelling()) TT.timer = setTimeout(ttBackToNow, 1500);
  }
  function ttOpen() {
    if (!TT.open) {
      const a = doc.activeElement;
      TT.opener = a && a !== body && a !== root && !TT.bar.contains(a) ? a : null;
      TT.open = true;
      clearTimeout(TT.bar._t);
      TT.bar.hidden = false;
      ttSetMode(TT.mode);
      void TT.bar.offsetWidth;
      TT.bar.classList.add('open');
      body.classList.add('tt-open');
      root.style.setProperty('--tt-h', `${TT.bar.offsetHeight}px`);
      setInert();
    }
    TT.range.focus({ preventScroll: true });
  }
  function ttClose(noFocus) {
    if (!TT.open) return;
    ttBackToNow();
    TT.open = false;
    TT.bar.classList.remove('open');
    body.classList.remove('tt-open');
    clearTimeout(TT.bar._t);
    TT.bar._t = setTimeout(() => { if (!TT.open) TT.bar.hidden = true; }, reduced ? 0 : 220);
    const f = TT.opener;
    TT.opener = null;
    if (!noFocus) restoreFocus(f, () => (state.app ? A.title : state.view === 'home' ? E.homeTitle : E.unlock));
  }
  const ttToggle = () => (TT.open ? ttClose() : ttOpen());
  TT.range.addEventListener('input', () => { clearTimeout(TT.timer); ttFromSlider(); });
  TT.range.addEventListener('pointerdown', () => { TT.dragging = true; clearTimeout(TT.timer); });
  const ttUp = () => { if (TT.dragging) { TT.dragging = false; ttRelease(); } };
  doc.addEventListener('pointerup', ttUp);
  doc.addEventListener('pointercancel', ttUp);
  TT.range.addEventListener('keydown', (e) => {
    const dir = { PageUp: 1, PageDown: -1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    e.stopPropagation();
    const r = TT.range;
    r.value = String(clamp(Number(r.value) + dir * (TT.mode === 'day' ? 60 : 30), Number(r.min), Number(r.max)));
    clearTimeout(TT.timer);
    ttFromSlider();
  });
  TT.bar.addEventListener('focusout', (e) => { if (!TT.bar.contains(e.relatedTarget) && !TT.dragging) ttRelease(); });
  TT.bar.addEventListener('focusin', () => clearTimeout(TT.timer));
  TT.now.addEventListener('click', () => { ttBackToNow(); TT.range.focus({ preventScroll: true }); });
  TT.close.addEventListener('click', () => ttClose());

  // ---------------------------------------------------------------- the Sky app (idea #83)
  // Where you stand, and what is above you: a city (search in English, 中文 or pinyin, which is
  // the English name of a Chinese city), your browser's location (asked for only on a click),
  // or "lat, lon". The chart is live/sky-chart.mjs, "Tonight" is tonight() from live/astro.mjs,
  // and every time is given in the place's own time zone, which is named.
  // R3.3 adds: any date from 1900 to 2050 and the time in the link (#92, #101), a saved PNG
  // (#101), a first city guessed from the browser's time zone (#102), star distances (#132),
  // Chinese star names (#133), the telescope view (#135), star trails (#131), the expert
  // switches (#139), the year's daylight curve (#129) and the next equinox or solstice (#136).
  // R3.3 batch 1b adds: the meteor showers, with the radiants of those active marked on the chart
  // (#93), eclipses to 2035 and whether the place sees a lunar one (#94), the next 30 days' close
  // pairings (#134), a year of sky events as an .ics file (#141), the chart turning with a phone
  // held up to the sky (#100) and a constellation game (#103).
  const CITIES = SkyData.CITIES;
  const cityOf = (r) => (r ? { id: r[0], name: { en: r[1], zh: r[2] }, lat: r[3], lon: r[4], tz: r[5], cc: r[6] } : null);
  const cityById = (id) => cityOf(CITIES.find((r) => r[0] === id));
  const browserTZ = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || TZ; } catch (e) { return TZ; } };
  // The planets' elements in live/astro.mjs hold from 1800 to 2050, so dates stay in 1900 to 2050.
  const SKY_MIN = [1900, 1, 1];
  const SKY_MAX = [2050, 12, 31];
  const isoOf = (y, m, d) => `${String(y).padStart(4, '0')}-${pad(m)}-${pad(d)}`;
  const inSkyRange = (y, m, d) => { const v = Date.UTC(y, m - 1, d); return v >= Date.UTC(...SKY_MIN.map((x, i) => (i === 1 ? x - 1 : x))) && v <= Date.UTC(SKY_MAX[0], SKY_MAX[1] - 1, SKY_MAX[2]); };
  // the faintest stars drawn for each kind of sky (#139): a city sky down to magnitude 3, a suburban
  // one to 4; the dark sky draws every star in the chart. A city sky shows no Milky Way.
  const BRIGHT = { city: 3, suburbs: 4, dark: null };
  const STARNAMES = { ...SkyData.STAR_NAMES, ...SkyData.DIPPER_NAMES };
  const SKY = {
    city: null, mode: 'now', t: 0, red: false, names: true, paintedAt: 0, night: null, sel: -1, msg: '', raf: 0, last: [],
    trails: false, grid: false, facing: 180, bright: 'dark', more: false, guess: false, select: null, info: '', infoId: '', day: null, hashTimer: 0,
    aim: false, aimGot: false, aimTimer: 0, aimAt: 0, aimFacing: 180, next: null,
  };
  /** The city chosen in the Sky app, else Albany: what the planet cards and Search talk about (#140, #144). */
  const homeCity = () => cityById(store.get('ls7-sky-city')) || cityById('albany');
  /** #102: a big city in the browser's time zone (Beijing for Asia/Shanghai), or null. */
  function guessCity() {
    let z = '';
    try { z = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return null; }
    if (SkyData.TZ_CITY[z]) return cityById(SkyData.TZ_CITY[z]);
    return cityOf(CITIES.find((r) => r[5] === z));
  }
  {
    const kept = cityById(store.get('ls7-sky-city'));
    const g = kept ? null : guessCity();
    SKY.city = kept || g || cityById('albany');
    SKY.guess = !!(g && g.id !== 'albany');
  }
  const fold = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ø/g, 'o').replace(/æ/g, 'ae')
    .replace(/ß/g, 'ss').replace(/[^a-z0-9㐀-鿿]+/g, ' ').trim();
  const placeName = (c) => (c ? c.name[lang] || c.name.en : '');
  const placeShort = (c) => placeName(c).replace(/\s*[（(].*$/, '').replace(/,.*$/, '');
  const fmtCoord = (lat, lon) => `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'W'}`;
  function skyMatches(q) {
    const f = fold(q);
    if (!f) return [];
    const out = [];
    for (const r of CITIES) {
      const hay = [r[0].replace(/-/g, ' '), fold(r[1]), fold(r[2])];
      // the whole name starts with it, then a word in it does, then it is somewhere inside
      const rank = hay.some((h) => h.startsWith(f)) ? 0 : hay.some((h) => h.split(' ').some((w) => w && w.startsWith(f))) ? 1
        : hay.some((h) => h.includes(f)) ? 2 : -1;
      if (rank >= 0) out.push({ r, rank });
    }
    return out.sort((a, b) => a.rank - b.rank).slice(0, 8).map((x) => cityOf(x.r));
  }
  /** "lat, lon" (with optional N/S/E/W) as a place; the time zone comes from the nearest city
   *  in the list, or from the longitude when no city is near. */
  function parseLatLon(q) {
    const m = String(q).trim().match(/^([+-]?\d{1,2}(?:\.\d+)?)\s*°?\s*([NS])?\s*[,;\s]\s*([+-]?\d{1,3}(?:\.\d+)?)\s*°?\s*([EW])?$/i);
    if (!m) return null;
    let lat = Number(m[1]) * (m[2] && m[2].toUpperCase() === 'S' ? -1 : 1);
    let lon = Number(m[3]) * (m[4] && m[4].toUpperCase() === 'W' ? -1 : 1);
    if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) return null;
    lat = +lat.toFixed(4);
    lon = +lon.toFixed(4);
    return { id: null, custom: true, name: { en: fmtCoord(lat, lon), zh: fmtCoord(lat, lon) }, lat, lon, tz: zoneNear(lat, lon) };
  }
  function zoneNear(lat, lon) {
    let best = null;
    let bd = Infinity;
    for (const r of CITIES) {
      const dl = (r[3] - lat) * D2R;
      const dn = (r[4] - lon) * D2R;
      const a = Math.sin(dl / 2) ** 2 + Math.cos(lat * D2R) * Math.cos(r[3] * D2R) * Math.sin(dn / 2) ** 2;
      const d = 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
      if (d < bd) { bd = d; best = r; }
    }
    if (best && bd < 800) return best[5];
    const off = Math.round(lon / 15);
    return off === 0 ? 'Etc/GMT' : `Etc/GMT${off > 0 ? '-' : '+'}${Math.abs(off)}`;
  }
  function zoneLabel(c, t) {
    let abbr = '';
    try {
      abbr = new Intl.DateTimeFormat('en-US', { timeZone: c.tz, timeZoneName: 'short' }).formatToParts(new Date(t)).find((x) => x.type === 'timeZoneName').value;
    } catch (e) { abbr = c.tz; }
    const where = c.custom ? (c.tz.startsWith('Etc/') ? '' : c.tz.split('/').pop().replace(/_/g, ' ')) : placeShort(c);
    if (lang === 'zh') return where ? `${where}时间（${abbr}）` : abbr;
    return where ? `${where} time (${abbr})` : abbr;
  }
  const timeIn = (ms, tz) => (ms == null ? '' : new Intl.DateTimeFormat(LOC(), { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date(ms)));
  const dateIn = (ms, tz, opts = { month: 'short', day: 'numeric' }) => new Intl.DateTimeFormat(LOC(), { timeZone: tz, ...opts }).format(new Date(ms));
  const cityTime = (ms) => timeIn(ms, SKY.city.tz);
  const cityDate = (ms) => dateIn(ms, SKY.city.tz);
  const skyT = () => (SKY.mode === 'now' ? vnow() : SKY.t);
  function setSkyCity(c, remember) {
    if (!c) return;
    SKY.city = c;
    SKY.guess = false;
    if (remember && c.id) store.set('ls7-sky-city', c.id);
    if (SKY.mode === 'tonight') SKY.t = tonightTime(skyT());
    queueTonight();
  }
  /** "Tonight": the evening of the date shown, at 9 PM or 45 minutes after civil dusk, whichever
   *  is later, in the place's own time. */
  function tonightTime(t) {
    const c = SKY.city;
    const p = Astro.zonedParts(t, c.tz);
    const n = Astro.tonight(Astro.zonedTime(p.year, p.month, p.day, 13, 0, c.tz), c.lat, c.lon, c.tz);
    const nine = Astro.zonedTime(n.date.year, n.date.month, n.date.day, 21, 0, c.tz);
    return n.civilDusk != null ? Math.max(nine, n.civilDusk + 45 * 60000) : nine;
  }
  /** The slider's window: sunset to sunrise of the night around t (or 3 PM to 9 AM without them). */
  function skyWindow(n) {
    const from = (n.sunset != null ? n.sunset : n.noon0 + 3 * 3600000) - 30 * 60000;
    const to = (n.sunrise != null && n.sunrise > from ? n.sunrise : n.noon1 - 3 * 3600000) + 30 * 60000;
    return [from, Math.max(to, from + 3600000)];
  }
  /** The date of the night that holds t (before local noon it is the night that began the day before). */
  function nightOf(t, tz) {
    const p = Astro.zonedParts(t, tz);
    return Date.UTC(p.year, p.month - 1, p.day - (p.hour < 12 ? 1 : 0));
  }
  /** tonight() for a place at the virtual time, kept for five minutes (the planet cards and Search ask often). */
  const TN = { key: '', n: null };
  function tonightFor(c) {
    const t = vnow();
    const key = `${c.lat},${c.lon},${c.tz}|${Math.floor(t / 300000)}`;
    if (TN.key !== key) { TN.key = key; TN.n = Astro.tonight(t, c.lat, c.lon, c.tz); }
    return TN.n;
  }
  /** Where a planet (or the Moon) is tonight, in words, from tonight()'s numbers (#140, #144). */
  function bodyTonightText(name, c, n) {
    const tt = C().app.sky;
    const tm = (ms) => timeIn(ms, c.tz);
    if (name === 'moon') {
      const m = n.moon;
      const parts = [];
      if (m.rise != null) parts.push(fmt(tt.rises, { time: tm(m.rise) }));
      if (m.set != null) parts.push(fmt(tt.sets, { time: tm(m.set) }));
      if (!parts.length) parts.push(m.altAtMidnight > 0 ? tt.moonUp : tt.moonDown);
      return parts.join(lang === 'zh' ? '，' : ', ');
    }
    const p = n.planets.find((x) => x.name === name);
    if (!p) return '';
    if (n.darkness === 'none') return tt.plNoDark;
    if (!p.visible) return p.elong < 20 ? tt.plSun : p.bestAlt != null && p.bestAlt < 0 ? tt.plDown : tt.plLow;
    const dir = C().dirs[Math.round(Astro.norm360(p.bestAz) / 45) % 8];
    const high = n.darkStart != null && p.best > n.darkStart + 15 * 60000 && p.best < n.darkEnd - 15 * 60000;
    const pos = fmt(high ? tt.plHigh : tt.plBest, { time: tm(p.best), dir });
    let s;
    if (p.when === 'evening') s = fmt(tt.plEvening, { pos });
    else if (p.when === 'morning') s = p.rise != null ? fmt(tt.plRises, { time: tm(p.rise), pos }) : fmt(tt.plMorning, { pos });
    else s = fmt(tt.plNight, { pos });
    if (!p.naked) s = fmt(tt.withTool, { text: s, tool: p.name === 'neptune' ? tt.telescope : tt.binoculars });
    return s;
  }
  /** A duration in words: "8 min 14 s", "4 h 8 min". */
  function duration(sec) {
    const d = C().dur;
    const s = Math.round(Math.abs(sec));
    if (s < 60) return fmt(d.s, { s });
    if (s < 3600) return fmt(d.ms, { m: Math.floor(s / 60), s: s % 60 });
    const m = Math.round(s / 60);
    return fmt(d.hm, { h: Math.floor(m / 60), m: m % 60 });
  }
  const group = (v) => Number(v).toLocaleString(LOC());
  const decYear = (ms) => { const y = new Date(ms).getUTCFullYear(); const a = Date.UTC(y, 0, 1); return y + (ms - a) / (Date.UTC(y + 1, 0, 1) - a); };
  /** #132: how far a named star is, and the year the light now arriving left it ([distance, year]). */
  function starDistance(sid, t) {
    const r = SkyData.STAR_DIST[sid];
    if (!r) return null;
    const tt = C().app.sky;
    const [lo, hi] = r;
    const mid = (lo + hi) / 2;
    const yr = decYear(t);
    const num = (v) => Number(v).toLocaleString(LOC(), { maximumFractionDigits: 1 });
    if ((hi - lo) / mid <= 0.12) {
      const ly = mid < 10 ? Math.round(mid * 10) / 10 : mid < 100 ? Math.round(mid) : mid < 1000 ? Math.round(mid / 10) * 10 : Math.round(mid / 100) * 100;
      const span = hi - lo;
      let year;
      if (span < 1.5) year = Math.floor(yr - mid);
      else { const step = span < 8 ? 5 : span < 40 ? 10 : 50; year = Math.round((yr - mid) / step) * step; }
      return [fmt(tt.ly, { ly: num(ly) }), fmt(tt.left, { year })];
    }
    const sig2 = (v) => { const p = 10 ** (Math.floor(Math.log10(v)) - 1); return Math.round(v / p) * p; };
    const step = hi - lo < 400 ? 10 : 50;
    const from = Math.round((yr - hi) / step) * step;
    const to = Math.round((yr - lo) / step) * step;
    return [fmt(tt.lyRange, { lo: num(sig2(lo)), hi: num(sig2(hi)) }),
      from < 1 ? fmt(tt.leftRangeBC, { from: -from, to }) : fmt(tt.leftRange, { from, to })];
  }
  /** #133: the traditional Chinese name (where it differs from the chart's label) and one line. */
  function cnStar(sid) {
    const d = SkyData.CN_STARS[sid];
    if (!d) return '';
    const label = (STARNAMES[sid] || {}).zh;
    return d.name && d.name !== label ? fmt(C().app.sky.cnWithName, { name: d.name, story: d.story }) : d.story;
  }
  function skyShell(t) {
    SKY.info = '';
    SKY.infoId = '';
    const icon = (k, sz = 15) => `<svg width="${sz}" height="${sz}" aria-hidden="true" focusable="false"><use href="#u-${k}"/></svg>`;
    const sw = (id, on, label) => `<button type="button" class="qs-row qs-switch" id="${id}" aria-pressed="${on}"><span class="qs-l">${esc(label)}</span><span class="switch" aria-hidden="true"><i></i></span></button>`;
    const radio = (attr, v, label, on, aria) => `<button type="button" role="radio" data-${attr}="${v}" aria-checked="${on}" tabindex="${on ? 0 : -1}"${aria ? ` aria-label="${esc(aria)}"` : ''}>${esc(label)}</button>`;
    return '<div class="sky-app">'
      + `<p class="ap-sub sky-sub">${esc(t.sub)}</p>`
      + '<div class="sky-place card">'
      + `<div class="sky-search">${icon('search', 16)}<input id="skyQ" type="text" role="combobox" aria-expanded="false" aria-controls="skyList" aria-autocomplete="list"`
      + ` autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" placeholder="${esc(t.search)}" aria-label="${esc(t.searchAria)}"></div>`
      + `<ul class="sky-list" id="skyList" role="listbox" aria-label="${esc(t.results)}" hidden></ul>`
      + `<div class="sky-geo"><button type="button" class="btn" id="skyGeo">${icon('target', 14)}<span>${esc(t.geo)}</span></button>`
      + `<p class="sky-note" id="skyGeoNote">${esc(t.geoNote)}</p></div>`
      + `<div class="sky-guess" id="skyGuess" hidden><p class="sky-note" id="skyGuessNote"></p><button type="button" class="btn" id="skyAlbany">${esc(t.albanyBtn)}</button></div>`
      + '</div>'
      + '<div class="sky-where"><h3 class="sky-city" id="skyCity"></h3><p class="sky-meta" id="skyMeta"></p></div>'
      + '<div class="sky-when">'
      + `<div class="seg" id="skyMode" role="radiogroup" aria-label="${esc(t.when)}">`
      + `<button type="button" role="radio" data-sky="now" aria-checked="true">${esc(t.now)}</button>`
      + `<button type="button" role="radio" data-sky="tonight" aria-checked="false">${esc(t.tonight)}</button></div>`
      + `<label class="sky-date"><span class="sr-only">${esc(t.date)}</span><input type="date" id="skyDate" min="${isoOf(...SKY_MIN)}" max="${isoOf(...SKY_MAX)}" aria-describedby="skyDateNote"></label>`
      + `<span class="sky-follow" id="skyFollow" hidden>${esc(t.follow)}</span>`
      + `<p class="sky-note sky-date-note" id="skyDateNote" role="status"></p>`
      + '</div>'
      + `<div class="sky-night"><input type="range" class="tt-range" id="skyRange" min="0" max="90" step="1" value="0" aria-label="${esc(t.slider)}">`
      + '<div class="sky-night-l"><span id="skyFrom"></span><b id="skyAt"></b><span id="skyTo"></span></div></div>'
      + '<figure class="sky-fig card"><div class="sky-chart" id="skyChart"></div>'
      + `<figcaption class="sky-info" id="skyInfo" aria-live="polite">${esc(t.hint)}</figcaption></figure>`
      + `<div class="sky-share"><button type="button" class="btn" id="skySave">${icon('save', 14)}<span>${esc(t.save)}</span></button>`
      + (canShare() ? `<button type="button" class="btn" id="skyShare">${icon('share', 14)}<span>${esc(t.share)}</span></button>` : '')
      + `<button type="button" class="btn" id="skyCopy">${icon('link', 14)}<span>${esc(t.copy)}</span></button>`
      + `<button type="button" class="btn" id="skyAim" aria-pressed="${SKY.aim}" aria-describedby="skyAimNote"${canAim() ? '' : ' hidden'}>${icon('target', 14)}<span>${esc(t.aim)}</span></button>`
      + '<p class="sky-note sky-share-note" id="skyShareNote" role="status"></p>'
      + `<p class="sky-note sky-aim-note" id="skyAimNote" role="status"${canAim() ? '' : ' hidden'}>${esc(SKY.aim ? t.aimOn : t.aimHint)}</p></div>`
      + '<div class="sky-toggles">'
      + sw('skyRed', SKY.red, t.red) + sw('skyNames', SKY.names, t.names) + sw('skyTrails', SKY.trails, t.trails)
      + `<button type="button" class="qs-row sky-more-btn" id="skyMoreBtn" aria-expanded="${SKY.more}" aria-controls="skyMore"><span class="qs-l">${esc(t.more)}</span>${icon('chev', 15)}</button>`
      + `<div class="sky-more" id="skyMore"${SKY.more ? '' : ' hidden'}>`
      + sw('skyGrid', SKY.grid, t.grid)
      + `<div class="qs-row"><p class="qs-l" id="skyFaceHead">${esc(t.facing)}</p><div class="seg" id="skyFace" role="radiogroup" aria-labelledby="skyFaceHead">`
      + [0, 90, 180, 270].map((v, i) => radio('face', v, t.facingShort[i], SKY.facing === v, t.facingLong[i])).join('') + '</div></div>'
      + `<p class="sky-note">${esc(t.facingNote)}</p>`
      + `<div class="qs-row"><p class="qs-l" id="skyBrightHead">${esc(t.faint)}</p><div class="seg" id="skyBright" role="radiogroup" aria-labelledby="skyBrightHead">`
      + ['city', 'suburbs', 'dark'].map((v, i) => radio('bright', v, t.skies[i], SKY.bright === v)).join('') + '</div></div>'
      + '<p class="sky-note" id="skyBrightNote"></p>'
      + '</div></div>'
      + `<section class="tv-sec"><h3 class="tv-head" id="skyTonightHead">${esc(t.tonightHead)}</h3><div class="tv sky-tonight" id="skyTonight"></div></section>`
      + `<section class="tv-sec"><h3 class="tv-head">${esc(t.dayHead)}</h3><div class="tv sky-day" id="skyDay"></div></section>`
      + `<section class="tv-sec"><h3 class="tv-head">${esc(t.nextHead)}</h3><div class="tv sky-next" id="skyNext"></div>`
      + `<div class="sky-ics"><button type="button" class="btn" id="skyIcs">${icon('save', 14)}<span>${esc(t.ics)}</span></button>`
      + '<p class="sky-note" id="skyIcsNote" role="status"></p></div><p class="tv-foot" id="skyNextFoot"></p></section>'
      + `<section class="tv-sec"><h3 class="tv-head">${esc(t.showersHead)}</h3><div class="tv sky-showers" id="skyShowers"></div><p class="tv-foot">${esc(t.showersFoot)}</p></section>`
      + `<section class="tv-sec"><h3 class="tv-head">${esc(t.eclipsesHead)}</h3><div class="tv sky-ecl" id="skyEcl"></div><p class="tv-foot" id="skyEclFoot"></p></section>`
      + `<section class="tv-sec"><h3 class="tv-head" id="cgHead">${esc(t.gameHead)}</h3><div class="tv cg"><p class="tv-p cg-intro">${esc(t.gameIntro)}</p>`
      + '<div class="cg-board" id="cgBoard" role="group" aria-labelledby="cgHead" aria-describedby="cgHelp" hidden><svg class="cg-svg" id="cgSvg" viewBox="0 0 320 220" aria-hidden="true" focusable="false"></svg><div class="cg-stars" id="cgStars"></div></div>'
      + `<p class="sr-only" id="cgHelp">${esc(t.gameBoard)}</p>`
      + `<div class="cg-bar"><button type="button" class="btn primary" id="cgStart">${esc(t.gamePlay)}</button><button type="button" class="btn" id="cgHint" hidden>${esc(t.gameHint)}</button>`
      + '<span class="cg-clock" id="cgClock" aria-hidden="true"></span><p class="sky-note cg-status" id="cgStatus" role="status"></p></div>'
      + '<div class="cg-result" id="cgResult" hidden></div></div></section>'
      + '</div>';
  }
  const queueSky = () => { if (!SKY.raf) SKY.raf = requestAnimationFrame(() => { SKY.raf = 0; paintSky(); }); };
  function paintSky() {
    const box = $('#skyChart', A.body);
    if (appKey !== 'sky' || !box) return;
    const c = SKY.city;
    const t = skyT();
    const tt = C().app.sky;
    SKY.paintedAt = vnow();
    const n = Astro.tonight(t, c.lat, c.lon, c.tz);
    SKY.night = n;
    setText($('#skyCity', A.body), placeName(c));
    setText($('#skyMeta', A.body), `${fmtCoord(c.lat, c.lon)} · ${fmt(tt.zone, { zone: zoneLabel(c, t) })}`);
    const guess = $('#skyGuess', A.body);
    guess.hidden = !SKY.guess;
    if (SKY.guess) setText($('#skyGuessNote', A.body), fmt(tt.guessed, { zone: browserTZ().split('/').pop().replace(/_/g, ' ') }));
    for (const b of $$('#skyMode [role="radio"]', A.body)) {
      const on = b.dataset.sky === SKY.mode;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on || (SKY.mode === 'custom' && b.dataset.sky === 'now') ? 0 : -1;
    }
    $('#skyFollow', A.body).hidden = !(SKY.mode === 'now' && travelling());
    const dp = Astro.zonedParts(t, c.tz);
    const dateIn_ = $('#skyDate', A.body);
    if (doc.activeElement !== dateIn_) dateIn_.value = isoOf(dp.year, dp.month, dp.day);
    const [from, to] = skyWindow(n);
    const r = $('#skyRange', A.body);
    r.max = String(Math.round((to - from) / 600000));
    if (doc.activeElement !== r || SKY.mode !== 'custom') r.value = String(clamp(Math.round((t - from) / 600000), 0, Number(r.max)));
    r.style.setProperty('--fill', `${((Number(r.value) / Number(r.max)) * 100).toFixed(2)}%`);
    r.setAttribute('aria-valuetext', `${cityDate(t)} ${cityTime(t)}`);
    r.dataset.from = String(from);
    setText($('#skyFrom', A.body), cityTime(from));
    setText($('#skyTo', A.body), cityTime(to));
    setText($('#skyAt', A.body), `${cityDate(t)} · ${cityTime(t)}`);
    // the chart
    const scene = Astro.skyScene(t, c.lat, c.lon, SkyData.SKY_DATA);
    const size = Math.round(clamp(box.clientWidth || 340, 260, 620));
    const cap = BRIGHT[SKY.bright];
    box.innerHTML = SkyChart.skyChartSVG(scene, {
      size, lang, theme: SKY.red ? 'red' : appearance, idPrefix: 'skyc', figureNames: SKY.names, labels: true,
      names: { stars: STARNAMES, figures: SkyData.FIGURE_NAMES, deepSky: true, dashed: SkyData.DASHED },
      title: fmt(tt.chart, { place: placeName(c), time: `${cityDate(t)} ${cityTime(t)}` }),
      facing: SKY.facing, grid: SKY.grid, maxMag: cap, milkyWay: SKY.bright !== 'city', radiants: radiantsAt(t, c),
      trails: SKY.trails ? Astro.starTrails(t, c.lat, c.lon, SkyData.SKY_DATA, { hours: 3, stepMin: 10, maxMag: 3 }) : null,
    });
    box.classList.toggle('red', SKY.red);
    A.view.classList.toggle('sky-red', SKY.red);
    const svg = box.firstElementChild;
    if (svg) {
      svg.setAttribute('role', 'group');
      const rank = (g) => { const id = g.dataset.id; return id === 'moon' ? 0 : id.startsWith('planet:') ? 1 : id === 'sun' ? 2 : id.startsWith('deep:') || id.startsWith('radiant:') ? 3 : 4; };
      SKY.last = $$('.sky-body', svg).sort((a, b) => rank(a) - rank(b));
      SKY.last.forEach((g, i) => {
        const ttl = $('title', g);
        g.setAttribute('role', 'img');
        g.setAttribute('aria-label', ttl ? ttl.textContent : g.dataset.id);
        g.setAttribute('tabindex', i === 0 ? '0' : '-1');
      });
    }
    // the caption follows the body it describes to the new time (or goes back to the hint)
    if (SKY.infoId) {
      const g = $(`#skyChart .sky-body[data-id="${SKY.infoId}"]`, A.body);
      if (g) skyInfo(g); else { SKY.infoId = ''; SKY.info = ''; setText($('#skyInfo', A.body), tt.hint); }
    }
    const lim = Math.min(SkyChart.limitingMag(scene.sun.alt), cap == null ? Infinity : cap);
    setText($('#skyBrightNote', A.body), fmt(tt.faintNote, { n: scene.stars.filter((s) => s.alt > 0 && s.mag <= lim).length, total: scene.stars.length }));
    const tonightNow = nightOf(t, c.tz) === nightOf(vnow(), c.tz);
    setText($('#skyTonightHead', A.body), tonightNow ? tt.tonightHead
      : fmt(tt.thatNight, { date: new Intl.DateTimeFormat(LOC(), { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(Date.UTC(n.date.year, n.date.month - 1, n.date.day))) }));
    $('#skyTonight', A.body).innerHTML = skyTonightHTML(n, c, tonightNow);
    $('#skyDay', A.body).innerHTML = skyDayHTML(c, t);
    $('#skyNext', A.body).innerHTML = skyNextHTML(c, n);
    setText($('#skyNextFoot', A.body), fmt(tt.nextFoot, { place: placeShort(c) }));
    $('#skyShowers', A.body).innerHTML = skyShowersHTML(c, n);
    $('#skyEcl', A.body).innerHTML = skyEclipsesHTML(c, n);
    setText($('#skyEclFoot', A.body), fmt(tt.eclipsesFoot, { zone: zoneLabel(c, t) }));
    for (const b of $$('#skyFace [role="radio"]', A.body)) b.setAttribute('aria-checked', String(!SKY.aim && Number(b.dataset.face) === SKY.facing));
    if (CG.fig && !$('.cg-star', A.body)) cgPaint();
    syncSkyHash();
  }
  /** The caption under the chart: where the body is, and for a named star how far its light
   *  has come (#132) and, in Chinese, its traditional name (#133); for Jupiter, Saturn, Venus
   *  and Mars, the telescope view (#135). */
  function skyInfo(g) {
    const n = SKY.night;
    const tt = C().app.sky;
    let s = g.getAttribute('aria-label') || '';
    const id = g.dataset.id || '';
    const pl = id.startsWith('planet:') && n ? n.planets.find((p) => p.name === id.slice(7)) : null;
    const ev = pl || (id === 'moon' && n ? n.moon : null);
    if (ev) {
      const parts = [];
      if (ev.rise != null) parts.push(fmt(tt.rises, { time: cityTime(ev.rise) }));
      if (ev.set != null) parts.push(fmt(tt.sets, { time: cityTime(ev.set) }));
      if (parts.length) s += ` · ${parts.join(', ')}`;
    }
    const lines = [`<span class="si-main">${esc(s)}</span>`];
    if (id.startsWith('star:')) {
      const sid = id.slice(5);
      const dist = starDistance(sid, skyT());
      if (dist) lines.push(`<span class="si-line si-dist">${esc(dist.join(' '))}</span>`);
      if (lang === 'zh' && SkyData.CN_STARS[sid]) lines.push(`<span class="si-line si-cn">${esc(cnStar(sid))}</span>`);
    }
    if (id.startsWith('radiant:')) {
      const sh = SkyData.METEOR_SHOWERS.find((x) => x.id === id.slice(8));
      if (sh) lines.push(`<span class="si-line">${esc(fmt(tt.radiantInfo, { name: sh.name[lang] || sh.name.en, date: peakDate(showerPeakNear(sh, skyT())), zhr: sh.zhr }))}</span>`);
    }
    const scope = pl && ['jupiter', 'saturn', 'venus', 'mars'].includes(pl.name) ? scopeHTML(pl.name) : '';
    const html = `<span class="si-text">${lines.join('')}</span>${scope}`;
    SKY.infoId = id;
    if (html === SKY.info) return;
    SKY.info = html;
    const box = $('#skyInfo', A.body);
    box.innerHTML = html;
    box.classList.toggle('has-scope', !!scope);
  }
  /** #135: what a small telescope shows, drawn from formulae (live/astro.mjs) in a round field,
   *  north up and east on the left (turned round for places south of the equator, as the Moon
   *  icons are). Jupiter and its moons share one scale, zoomed so the farthest moon fits, as a
   *  higher or lower power would; Venus and Mars share one scale in arcseconds, so their sizes
   *  compare. */
  function scopeHTML(pl) {
    const tt = C().app.sky;
    const t = skyT();
    const south = SKY.city.lat < 0;
    const k = south ? -1 : 1;
    const R = 64;
    const f = (v) => (+v).toFixed(1);
    const parts = [];
    let text = '';
    if (pl === 'jupiter') {
      const moons = Astro.galileanMoons(t);
      const shown = moons.filter((m) => !(Math.abs(m.x) < 1 && !m.front));
      const reach = Math.max(7, ...shown.map((m) => Math.hypot(m.x, m.y)));
      const s = (R - 9) / reach;                              // px per Jupiter radius
      const jr = Math.max(2.6, s);
      parts.push(`<circle r="${f(jr)}" class="sc-planet" style="fill:var(--pl-jupiter)"/>`);
      const placed = [];
      const rows = [9, -6, 17, -14];
      const drawn = shown.map((m) => ({ m, x: k * m.x * s, y: -k * m.y * s })).sort((a, b) => a.x - b.x);
      for (const d of drawn) {
        const label = tt.moonNames[['io', 'europa', 'ganymede', 'callisto'].indexOf(d.m.name)];
        const w = label.length * (lang === 'zh' ? 8.4 : 4.6) + 2;
        let row = rows.find((dy) => !placed.some((p) => p.dy === dy && Math.abs(p.x - d.x) < (p.w + w) / 2 + 1)) ?? rows[0];
        if (Math.abs(d.x) + w / 2 > R - 4 && Math.abs(row) < 12) row = row > 0 ? 17 : -14;
        placed.push({ x: d.x, dy: row, w });
        parts.push(`<circle cx="${f(d.x)}" cy="${f(d.y)}" r="1.5" class="sc-moon"/>`
          + `<text x="${f(clamp(d.x, -R + w / 2 + 3, R - w / 2 - 3))}" y="${f(d.y + row)}" text-anchor="middle" class="sc-label">${esc(label)}</text>`);
      }
      const order = moons.map((m, i) => ({ x: m.x, label: Math.abs(m.x) < 1 ? fmt(m.front ? tt.inFront : tt.behind, { moon: tt.moonNames[i] }) : tt.moonNames[i] }))
        .concat([{ x: 0, label: SkyChart.bodyName('jupiter', lang) }]).sort((a, b) => a.x - b.x).map((o) => o.label);
      text = fmt(tt.eastWest, { list: order.join(lang === 'zh' ? '、' : ', ') });
    } else if (pl === 'saturn') {
      const ring = Astro.saturnRings(t);
      const a = R * 0.8;
      const b = Math.max(0.6, a * (ring.b / ring.a));
      const globeR = a * (Astro.apparentDiameter('saturn', t) / ring.a);   // ring.a is the outer ring's whole width
      const ai = a * 0.66;
      const bi = b * 0.66;
      // the ring as an annulus, in two halves: the one nearer to us is drawn over the globe
      const half = (up) => `<path d="M${f(-a)},0A${f(a)},${f(b)} 0 0 ${up ? 1 : 0} ${f(a)},0L${f(ai)},0A${f(ai)},${f(bi)} 0 0 ${up ? 0 : 1} ${f(-ai)},0Z" class="sc-ring"/>`;
      const nearUp = (ring.B < 0) === (k === 1);              // seen from the north side, the near half is below
      parts.push(half(!nearUp), `<circle r="${f(globeR)}" class="sc-planet" style="fill:var(--pl-saturn)"/>`, half(nearUp));
      text = Math.abs(ring.B) < 1 ? tt.edgeOn : fmt(tt.rings, { b: Math.round(Math.abs(ring.B)), face: ring.B > 0 ? tt.faces[0] : tt.faces[1] });
    } else {
      const g = Astro.geocentric(pl, t);
      const d = Astro.apparentDiameter(pl, t);
      const r = Math.max(2, (d / 2) * ((R - 4) / 33));       // the field is about 66 arcseconds across
      const chi = Astro.brightLimb(pl, t) * D2R;
      const rot = Math.atan2(-Math.cos(chi), -Math.sin(chi)) / D2R + (south ? 180 : 0);
      const lit = Astro.moonPhasePath(0, 0, r, g.illum, true);
      parts.push(`<g transform="rotate(${f(rot)})"><circle r="${f(r)}" class="sc-dark"/>${lit ? `<path d="${lit}" class="sc-lit" style="fill:var(--pl-${pl})"/>` : ''}</g>`);
      text = fmt(tt.phase, { pct: Math.round(g.illum * 100), d: d.toFixed(d < 10 ? 1 : 0) });
    }
    const N = tt.scopeN;
    const E = tt.scopeE;
    const svg = '<svg class="scope-svg" viewBox="-75 -75 150 150" aria-hidden="true" focusable="false">'
      + `<defs><clipPath id="scopeField"><circle r="${R}"/></clipPath></defs><circle r="${R}" class="sc-field"/>`
      + `<g clip-path="url(#scopeField)">${parts.join('')}</g>`
      + `<text x="0" y="${k === 1 ? -R - 3 : R + 9}" text-anchor="middle" class="sc-dir">${esc(N)}</text>`
      + `<text x="${k === 1 ? -R - 4 : R + 4}" y="3" text-anchor="${k === 1 ? 'end' : 'start'}" class="sc-dir">${esc(E)}</text></svg>`;
    return `<span class="sky-scope">${svg}<span class="sc-txt"><b>${esc(tt.scope)}</b><span>${esc(text)}</span></span></span>`;
  }
  function skyTonightHTML(n, c, now = true) {
    const tt = C().app.sky;
    const row = (label, value, extra = '') => `<div class="tv-row stack${extra}"><span class="tv-l">${label}</span><span class="tv-v">${value}</span></div>`;
    const out = [];
    const sunV = n.sunState === 'polar-night' ? tt.polarNight : n.sunState === 'midnight-sun' ? tt.midnightSun
      : fmt(tt.sunsetRise, { set: n.sunset != null ? cityTime(n.sunset) : '', rise: n.sunrise != null ? cityTime(n.sunrise) : '' });
    out.push(row(esc(tt.sun), esc(sunV)));
    let dark;
    if (n.darkness === 'none') dark = now ? tt.darkNone : tt.darkNoneThen;
    else if (n.astroDusk != null && n.astroDawn != null) dark = fmt(tt.span, { from: cityTime(n.astroDusk), to: cityTime(n.astroDawn) });
    else if (n.darkness === 'polar' && n.astroDusk == null) dark = tt.darkAll;
    else dark = tt.twilight;
    out.push(row(esc(tt.dark), esc(dark)));
    const m = n.moon;
    const mp = [];
    if (m.rise != null) mp.push(fmt(tt.rises, { time: cityTime(m.rise) }));
    if (m.set != null) mp.push(fmt(tt.sets, { time: cityTime(m.set) }));
    if (m.rise == null && m.set == null) mp.push(m.altAtMidnight > 0 ? tt.moonUp : tt.moonDown);
    if (mp.length) mp[0] = mp[0].charAt(0).toUpperCase() + mp[0].slice(1);
    const full = Astro.nextPhase(n.noon0, 180);
    const nw = Astro.nextPhase(n.noon0, 0);
    out.push(row(esc(tt.moon), `<span class="sky-moon">${moonIcon(m, 18, c.lat < 0)}<b>${esc(fmt(tt.moonLine, { phase: m.phaseName[lang], pct: Math.round(m.illum * 100) }))}</b></span>`
      + `<span class="sky-moon-t">${esc(mp.join(' · '))}</span><span class="sky-moon-t">${esc(fmt(tt.next, { full: cityDate(full), new: cityDate(nw) }))}</span>`, ' sky-moon-row'));
    for (const sh of SkyData.METEOR_SHOWERS) if (Astro.showerActive(sh, n.midnight)) out.push(row(esc(tt.meteors), esc(showerTonight(sh, n, c)), ' sky-met'));
    for (const p of n.planets) {
      const name = SkyChart.bodyName(p.name, lang);
      const when = p.visible ? tt[p.when] || tt.night : now ? tt.notUp : tt.notUpThen;
      const detail = p.visible ? fmt(tt.best, { time: cityTime(p.best), dir: Astro.compass(p.bestAz, lang), alt: Math.round(p.bestAlt) }) : '';
      const tag = p.name === 'uranus' ? tt.binoculars : p.name === 'neptune' ? tt.telescope : '';
      out.push(`<div class="tv-row sky-pl${p.visible ? '' : ' off'}" data-planet="${p.name}"><span class="tv-l"><i class="sky-dot" style="background:var(--pl-${p.name})"></i>${esc(name)}`
        + `${tag ? ` <small class="sky-tag">${esc(tag)}</small>` : ''}</span>`
        + `<span class="tv-v"><span class="sky-when-t">${esc(when)}</span>${detail ? `<span class="sky-best">${esc(detail)}</span>` : ''}`
        + `<span class="sky-mag">${esc(fmt(tt.mag, { mag: p.mag.toFixed(1) }))}</span></span></div>`);
    }
    return out.join('');
  }
  /** #129: daylight through the year at the place (a small curve, the day shown marked) and
   *  #136: the next equinox or solstice, named for the place's hemisphere. */
  function yearDaylight(c, y) {
    const days = Math.round((Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1)) / 86400000);
    const out = [];
    for (let i = 0; i < days; i++) out.push(Astro.daylight(Astro.zonedTime(y, 1, 1 + i, 12, 0, c.tz), c.lat, c.lon).minutes);
    return out;
  }
  function skyDayHTML(c, t) {
    const tt = C().app.sky;
    const p = Astro.zonedParts(t, c.tz);
    const y = p.year;
    const key = `${c.lat},${c.lon},${c.tz},${y}`;
    if (!SKY.day || SKY.day.key !== key) SKY.day = { key, len: yearDaylight(c, y), next: yearDaylight(c, y + 1) };
    const { len, next } = SKY.day;
    const doy = Math.round((Date.UTC(y, p.month - 1, p.day) - Date.UTC(y, 0, 1)) / 86400000);
    const dayLen = (dd) => Astro.daylight(Astro.zonedTime(y, p.month, p.day + dd, 12, 0, c.tz), c.lat, c.lon).minutes;
    const today = dayLen(0);
    const before = dayLen(-1);
    const isToday = Date.UTC(y, p.month - 1, p.day) === (() => { const q = Astro.zonedParts(vnow(), c.tz); return Date.UTC(q.year, q.month - 1, q.day); })();
    const hm = (m) => { const v = Math.round(m); return fmt(C().dur.hm, { h: Math.floor(v / 60), m: v % 60 }); };
    const dayLabel = (yy, i) => new Intl.DateTimeFormat(LOC(), { timeZone: 'UTC', month: 'short', day: 'numeric', ...(yy !== y ? { year: 'numeric' } : {}) }).format(new Date(Date.UTC(yy, 0, 1 + i)));
    const lines = [today >= 1440 ? fmt(tt.dayAll, { date: dayLabel(y, doy) }) : today <= 0 ? fmt(tt.dayNone, { date: dayLabel(y, doy) })
      : fmt(tt.dayLen, { date: dayLabel(y, doy), len: hm(today) })];
    const diff = (today - before) * 60;
    const than = isToday ? tt.thanYesterday : tt.thanBefore;
    if (today > 0 && today < 1440) {
      if (Math.abs(diff) < 1) lines.push(fmt(tt.sameAs, { than }));
      else lines.push(fmt(diff > 0 ? tt.longer : tt.shorter, { d: duration(diff), than }));
    }
    // the shortest and the longest day in the year ahead, in date order
    const ahead = len.slice(doy).map((m, i) => [y, doy + i, m]).concat(next.map((m, i) => [y + 1, i, m])).slice(0, 366);
    let lo = ahead[0];
    let hi = ahead[0];
    for (const d of ahead) { if (d[2] < lo[2]) lo = d; if (d[2] > hi[2]) hi = d; }
    const ext = [];
    if (hi[2] - lo[2] > 5) {
      ext.push([lo, lo[2] <= 0 ? fmt(tt.polarFrom, { date: dayLabel(lo[0], lo[1]) }) : fmt(tt.shortest, { date: dayLabel(lo[0], lo[1]), len: hm(lo[2]) })]);
      ext.push([hi, hi[2] >= 1440 ? fmt(tt.sunFrom, { date: dayLabel(hi[0], hi[1]) }) : fmt(tt.longest, { date: dayLabel(hi[0], hi[1]), len: hm(hi[2]) })]);
      ext.sort((a, b) => (a[0][0] - b[0][0]) || (a[0][1] - b[0][1]));
      lines.push(ext.map((e) => e[1]).join(' · '));
    }
    // the curve: 0 to 24 hours over the calendar year, the day shown marked
    const W = 360;
    const H = 112;
    const x0 = lang === 'zh' ? 44 : 30;
    const x1 = 352;
    const y0 = 8;
    const y1 = 90;
    const X = (i) => x0 + (i / (len.length - 1)) * (x1 - x0);
    const Y = (m) => y1 - (m / 1440) * (y1 - y0);
    const line = len.map((m, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(m).toFixed(1)}`).join('');
    const months = [0, 3, 6, 9].map((mo, i) => {
      const di = Math.round((Date.UTC(y, mo, 1) - Date.UTC(y, 0, 1)) / 86400000);
      return `<line x1="${X(di).toFixed(1)}" x2="${X(di).toFixed(1)}" y1="${y1}" y2="${y1 + 3}" class="dc-tick"/><text x="${X(di).toFixed(1)}" y="${H - 6}" text-anchor="middle" class="dc-lbl">${esc(tt.monthTicks[i])}</text>`;
    }).join('');
    const hours = [0, 12, 24].map((h) => `<line x1="${x0}" x2="${x1}" y1="${Y(h * 60).toFixed(1)}" y2="${Y(h * 60).toFixed(1)}" class="dc-grid"/><text x="${x0 - 5}" y="${(Y(h * 60) + 3).toFixed(1)}" text-anchor="end" class="dc-lbl">${esc(fmt(tt.hourTick, { h }))}</text>`).join('');
    const mx = X(doy).toFixed(1);
    const my = Y(len[doy]).toFixed(1);
    const curve = `<svg class="day-curve" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(fmt(tt.curveAria, { place: placeName(c), year: y, date: dayLabel(y, doy) }))}">`
      + `${hours}<path d="${line}L${x1},${y1}L${x0},${y1}Z" class="dc-area"/><path d="${line}" class="dc-line"/>${months}`
      + `<line x1="${mx}" x2="${mx}" y1="${y0}" y2="${y1}" class="dc-mark"/><circle cx="${mx}" cy="${my}" r="3.6" class="dc-dot"/></svg>`;
    const season = seasonLine(c, t);
    return `<div class="sky-day-in">${curve}<div class="sky-day-txt">${lines.map((l, i) => `<p class="${i ? 'sky-day-sub' : 'sky-day-main'}">${esc(l)}</p>`).join('')}`
      + `<p class="sky-season">${seasonRing(season.frac)}<span>${esc(season.text)}</span></p></div></div>`;
  }
  /** The next equinox or solstice for a place, in days of its calendar; after a solstice the
   *  days are getting longer or shorter. Named for the place's hemisphere (#136). */
  function seasonLine(c, t) {
    const tt = C().app.sky;
    const s = Astro.seasons(t);
    const south = c.lat < 0;
    const names = south ? tt.seasonsS : tt.seasonsN;               // March, June, September, December
    const dayNo = (ms) => { const q = Astro.zonedParts(ms, c.tz); return Date.UTC(q.year, q.month - 1, q.day) / 86400000; };
    const days = dayNo(s.next.t) - dayNo(t);
    const since = dayNo(t) - dayNo(s.prev.t);
    let text;
    if (since === 0) text = fmt(tt.seasonToday, { event: names[s.prev.k / 90] });
    else if (days === 0) text = fmt(tt.seasonToday, { event: names[s.next.k / 90] });
    else {
      text = fmt(days === 1 ? tt.seasonTomorrow : tt.seasonIn, { event: names[s.next.k / 90], n: days, date: dateIn(s.next.t, c.tz) });
      const winter = south ? 90 : 270;
      if (s.prev.k === winter) text = fmt(tt.afterSolstice, { trend: tt.longerNow, text });
      else if (s.prev.k === (winter + 180) % 360) text = fmt(tt.afterSolstice, { trend: tt.shorterNow, text });
    }
    if (south) text = fmt(tt.southern, { text });
    return { text, frac: s.lon / 360 };
  }
  /** A thin ring for the year: the four ticks are the equinoxes and solstices, the arc runs from
   *  the March equinox to the Sun's place today. */
  function seasonRing(frac) {
    const r = 7;
    const L = 2 * Math.PI * r;
    const ticks = [0, 90, 180, 270].map((a) => `<line x1="0" y1="${-r + 2.2}" x2="0" y2="${-r - 2.2}" transform="rotate(${a})" class="sr-tick"/>`).join('');
    return `<svg class="season-ring" width="20" height="20" viewBox="-10 -10 20 20" aria-hidden="true" focusable="false"><circle r="${r}" class="sr-track"/>`
      + `<circle r="${r}" class="sr-fill" stroke-dasharray="${(frac * L).toFixed(2)} ${L.toFixed(2)}" transform="rotate(-90)"/>${ticks}</svg>`;
  }
  // ---- meteor showers (#93), eclipses (#94), the next 30 days (#134), the year's calendar (#141)
  /** A shower's radiant at t over a place: {alt, az} (from the IMO's J2000 positions, precessed). */
  function radiantAltAz(sh, t, c) {
    const r = Astro.showerRadiant(sh, t);
    const eq = Astro.precess(r.ra, r.dec, t);
    return Astro.altAz(eq.ra, eq.dec, t, c.lat, c.lon);
  }
  /** The showers active at t, as the chart's radiants. */
  function radiantsAt(t, c) {
    return SkyData.METEOR_SHOWERS.filter((sh) => Astro.showerActive(sh, t)).map((sh) => {
      const h = radiantAltAz(sh, t, c);
      const name = sh.name[lang] || sh.name.en;
      return { id: sh.id, name, title: fmt(C().app.sky.radiant, { name }), alt: h.alt, az: h.az };
    });
  }
  /** "high in the southeast", "low in the north". */
  function whereWords(alt, az) {
    const tt = C().app.sky;
    return fmt(alt >= 50 ? tt.high : alt < 20 ? tt.low : tt.inDir, { dir: C().dirs[Math.round(Astro.norm360(az) / 45) % 8] });
  }
  /** The shower's maximum nearest to t (the one of this activity period while it is active). */
  function showerPeakNear(sh, t) {
    const y = new Date(t).getUTCFullYear();
    let best = null;
    for (const yy of [y - 1, y, y + 1]) { const p = Astro.showerPeak(sh, yy); if (best == null || Math.abs(p - t) < Math.abs(best - t)) best = p; }
    return best;
  }
  /** A maximum's date as the IMO gives it (UTC), with the year when it is not this one. */
  const peakDate = (ms, year = false) => new Intl.DateTimeFormat(LOC(), { timeZone: 'UTC', month: 'short', day: 'numeric', ...(year ? { year: 'numeric' } : {}) }).format(new Date(ms));
  /** Tonight's line for an active shower: its peak, and when and where its radiant is highest in the dark. */
  function showerTonight(sh, n, c) {
    const tt = C().app.sky;
    const name = sh.name[lang] || sh.name.en;
    const date = peakDate(showerPeakNear(sh, n.midnight));
    const a = n.astroDusk ?? n.darkStart;
    const b = n.astroDawn ?? n.darkEnd;
    if (a == null || b == null) return fmt(tt.metLight, { name, date });
    let best = null;
    for (let x = a; x <= b; x += 600000) { const h = radiantAltAz(sh, x, c); if (!best || h.alt > best.alt) best = { t: x, ...h }; }
    if (!best || best.alt <= 0) return fmt(tt.metDown, { name, date });
    let line = fmt(tt.metBest, { name, date, time: cityTime(best.t), where: whereWords(best.alt, best.az) });
    const ph = Astro.moonPhase(best.t);
    if (ph.illum > 0.5 && Astro.observe('moon', best.t, c.lat, c.lon).alt > 0) line += fmt(tt.metMoon, { pct: Math.round(ph.illum * 100) });
    return line;
  }
  /** The eight showers: those active first, then by their next maximum. */
  function skyShowersHTML(c, n) {
    const tt = C().app.sky;
    const yShown = n.date.year;
    return SkyData.METEOR_SHOWERS.map((sh) => {
      const active = Astro.showerActive(sh, n.midnight);
      const y = new Date(n.noon0).getUTCFullYear();
      const peak = active ? showerPeakNear(sh, n.midnight) : [y - 1, y, y + 1, y + 2].map((yy) => Astro.showerPeak(sh, yy)).find((p) => p > n.noon0);
      return { sh, active, peak };
    }).sort((p, q) => (q.active - p.active) || (p.peak - q.peak)).map(({ sh, active, peak }) => {
      const when = fmt(active && peak < n.noon0 ? tt.peakWas : tt.peakOn, { date: peakDate(peak, new Date(peak).getUTCFullYear() !== yShown) });
      return `<div class="tv-row sky-sh${active ? ' on' : ''}" data-shower="${sh.id}"><span class="tv-l"><b>${esc(sh.name[lang] || sh.name.en)}</b>`
        + `${active ? ` <small class="sky-tag on">${esc(tt.activeTag)}</small>` : ''}<small class="sky-sh-sub">${esc(fmt(tt.showerSub, { zhr: sh.zhr, where: sh.where[lang] || sh.where.en }))}</small></span>`
        + `<span class="tv-v">${esc(when)}</span></div>`;
    }).join('');
  }
  const ecUT = (e) => { const [y, m, d] = isoParts(e[0]); const [hh, mm, ss] = e[1].split(':').map(Number); return Date.UTC(y, m - 1, d, hh, mm, ss); };
  /** What an eclipse means for the place: for a solar one NASA's regions; for a lunar one whether
   *  the Moon is up for it there, and when. */
  function eclipseText(it, c) {
    const tt = C().app.sky;
    const sp = lang === 'zh' ? '' : ' ';
    if (it.kind === 'solar') {
      const [, , type, , region, path] = it.e;
      const part = fmt(tt.solarPart, { region: region[lang] || region.en });
      return path ? `${fmt(tt.solarPath[type], { path: path[lang] || path.en })}${sp}${part}` : part;
    }
    const x = it.x;
    const up = Astro.moonUpSpan(x.u1 ?? x.p1, x.u4 ?? x.p4, c.lat, c.lon);
    const place = placeShort(c);
    let txt = up.all ? fmt(tt.lunarAll, { place }) : up.none ? fmt(tt.lunarNone, { place }) : fmt(tt.lunarPart, { place, from: cityTime(up.from), to: cityTime(up.to) });
    if (!up.none) txt += x.u2 != null ? fmt(tt.lunarTotal, { from: cityTime(x.u2), to: cityTime(x.u3) }) : fmt(tt.lunarMax, { time: cityTime(x.max) });
    if (it.e[3] === 'penumbral') txt += it.e[8] < 0.1 ? tt.lunarGraze : tt.lunarFaint;
    return txt;
  }
  function eclipseItems(from, to) {
    const out = [];
    for (const e of SkyData.SOLAR_ECLIPSES) { const t = ecUT(e); if (t >= from && t < to) out.push({ kind: 'solar', e, t }); }
    for (const e of SkyData.LUNAR_ECLIPSES) { const x = Astro.lunarEclipseTimes(e); if (x.max >= from && x.max < to) out.push({ kind: 'lunar', e, t: x.max, x }); }
    return out.sort((p, q) => p.t - q.t);
  }
  /** The next four eclipses from the night shown. */
  function skyEclipsesHTML(c, n) {
    const tt = C().app.sky;
    const list = eclipseItems(n.noon0 - 43200000, Infinity).slice(0, 4);
    if (!list.length) return `<p class="tv-p">${esc(tt.eclipsesNone)}</p>`;
    return list.map((it) => {
      const title = it.kind === 'solar' ? C().ics.solar[it.e[2]] : C().ics.lunar[it.e[3]];
      const date = it.kind === 'solar' ? fmtDate(it.e[0], { month: 'long', day: 'numeric', year: 'numeric' }) : dateIn(it.t, c.tz, { month: 'long', day: 'numeric', year: 'numeric' });
      return `<div class="tv-row stack sky-ec" data-eclipse="${it.kind}:${it.e[0]}"><span class="tv-l"><b>${esc(title)}</b> <small>${esc(date)}</small></span>`
        + `<span class="tv-v">${esc(eclipseText(it, c))}</span></div>`;
    }).join('');
  }
  /** #134: what is worth looking up for in the 30 days from the night shown, at the place. */
  function skyNextHTML(c, n) {
    const tt = C().app.sky;
    const key = `${c.lat},${c.lon},${c.tz}|${n.noon0}|${lang}`;
    if (SKY.next && SKY.next.key === key) return SKY.next.html;
    const a = n.noon0;
    const b = a + 30 * DAY;
    const items = Astro.skyHighlights(a, b, c.lat, c.lon);
    const y = new Date(a).getUTCFullYear();
    for (const sh of SkyData.METEOR_SHOWERS) for (const yy of [y - 1, y, y + 1]) { const p = Astro.showerPeak(sh, yy); if (p >= a && p < b) items.push({ kind: 'shower', sh, t: p }); }
    items.push(...eclipseItems(a, b));
    items.sort((p, q) => p.t - q.t);
    const nm = (k) => SkyChart.bodyName(k, lang);
    const deg = (v) => String(Math.max(0.5, Math.round(v * 2) / 2));
    const day = (ms) => dateIn(ms, c.tz, { month: 'short', day: 'numeric' });
    const span = (h) => (h.from === h.to ? cityTime(h.t) : fmt(tt.window, { from: cityTime(h.from), to: cityTime(h.to) }));
    const rowOf = (kind, when, at, main, sub) => `<div class="tv-row sky-nx" data-kind="${kind}"><span class="nx-when"><b>${esc(when)}</b>${at ? `<small>${esc(at)}</small>` : ''}</span>`
      + `<span class="nx-what"><span>${esc(main)}</span>${sub ? `<small>${esc(sub)}</small>` : ''}</span></div>`;
    const rows = items.map((h) => {
      if (h.kind === 'moon') return rowOf('moon', day(h.t), span(h), fmt(tt.nextMoon, { planet: nm(h.body), sep: deg(h.sep) }), fmt(tt.nextClosest, { time: cityTime(h.t), where: whereWords(h.alt, h.az) }));
      if (h.kind === 'pair') return rowOf('pair', day(h.t), span(h), fmt(tt.nextPair, { a: nm(h.a), b: nm(h.b), sep: deg(h.sep) }), fmt(tt.nextBest, { time: cityTime(h.t), where: whereWords(h.alt, h.az) }));
      if (h.kind === 'opposition') return rowOf('opposition', day(h.t), '', fmt(tt.nextOpp, { planet: nm(h.body) }), tt.nextOppSub);
      if (h.kind === 'shower') return rowOf('shower', peakDate(h.t), '', fmt(tt.nextShower, { name: h.sh.name[lang] || h.sh.name.en }), fmt(tt.showerSub, { zhr: h.sh.zhr, where: h.sh.where[lang] || h.sh.where.en }));
      const title = h.kind === 'solar' ? C().ics.solar[h.e[2]] : C().ics.lunar[h.e[3]];
      return rowOf(h.kind, h.kind === 'solar' ? fmtDate(h.e[0], { month: 'short', day: 'numeric' }) : day(h.t), '', title, eclipseText(h, c));
    });
    const html = rows.length ? rows.join('') : `<p class="tv-p">${esc(tt.nextNone)}</p>`;
    SKY.next = { key, html };
    return html;
  }
  /** #141: the next 12 months of sky events as an .ics file, made here and saved (nothing is
   *  sent anywhere). scripts/sky_ics.mjs writes the same file for the nightly job. */
  function skyIcs() {
    const tt = C().app.sky;
    const note = $('#skyIcsNote', A.body);
    const iso = albanyISO(new Date(vnow()));
    const [y, m, d] = isoParts(iso);
    const from = Date.UTC(y, m - 1, d);
    const to = Date.UTC(y + 1, m - 1, d);
    const site = host(String(D.facts.links.pages || ''));
    const ev = Astro.skyCalendar(from, to, { showers: SkyData.METEOR_SHOWERS, solarEclipses: SkyData.SOLAR_ECLIPSES, lunarEclipses: SkyData.LUNAR_ECLIPSES });
    const text = Astro.icsCalendar(ev, {
      text: C().ics, lang, host: site, stamp: from,
      name: fmt(C().ics.name, { from: iso, to: new Date(to).toISOString().slice(0, 10) }), desc: fmt(C().ics.desc, { site }),
    });
    const file = `sky-events-${iso}-${lang}.ics`;
    try {
      const a = doc.createElement('a');
      a.download = file;
      a.href = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
      a.hidden = true;
      A.view.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      setText(note, fmt(tt.icsSaved, { file, n: ev.length }));
    } catch (e) { setText(note, tt.icsFail); }
  }

  // ---- the chart turns with a phone held up to the sky (#100)
  // Only offered on touch screens that have the DeviceOrientation API. iPhones ask the visitor
  // first (the button's click); nothing is uploaded. The direction the back of the phone faces
  // goes to the bottom of the chart, as the Facing switch does; no reading in 3 seconds (a
  // desktop, a phone without a compass) turns it off again and says so.
  const canAim = () => !!window.DeviceOrientationEvent && matchMedia('(pointer: coarse)').matches;
  function aimNote(text) {
    const n = $('#skyAimNote', A.body);
    if (!n) return;
    n.hidden = false;
    setText(n, text);
  }
  async function skyAim() {
    const tt = C().app.sky;
    if (SKY.aim) { aimStop(); aimNote(tt.aimHint); return; }
    const DOE = window.DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === 'function') {
      let ok = false;
      try { ok = (await DOE.requestPermission()) === 'granted'; } catch (e) { ok = false; }
      if (!ok) { aimNote(tt.aimDenied); return; }
    }
    SKY.aim = true;
    SKY.aimGot = false;
    SKY.aimFacing = SKY.facing;
    window.addEventListener('deviceorientationabsolute', onAim);
    window.addEventListener('deviceorientation', onAim);
    clearTimeout(SKY.aimTimer);
    SKY.aimTimer = setTimeout(() => { if (SKY.aim && !SKY.aimGot) { aimStop(); aimNote(C().app.sky.aimNone); } }, 3000);
    const b = $('#skyAim', A.body);
    if (b) b.setAttribute('aria-pressed', 'true');
    aimNote(tt.aimOn);
  }
  function aimStop() {
    if (!SKY.aim) return;
    SKY.aim = false;
    window.removeEventListener('deviceorientationabsolute', onAim);
    window.removeEventListener('deviceorientation', onAim);
    clearTimeout(SKY.aimTimer);
    SKY.facing = SKY.aimFacing;
    const b = $('#skyAim', A.body);
    if (b) b.setAttribute('aria-pressed', 'false');
    if (appKey === 'sky') paintSky();
  }
  /** The compass direction the back of the phone faces: Safari on iPhone gives webkitCompassHeading; other
   *  browsers an absolute alpha, beta and gamma, from which the device's -z axis is projected on
   *  the ground (W3C DeviceOrientation). null while the phone points straight up or down. */
  function aimHeading(e) {
    if (typeof e.webkitCompassHeading === 'number' && !Number.isNaN(e.webkitCompassHeading)) return Astro.norm360(e.webkitCompassHeading);
    if (!(e.absolute || e.type === 'deviceorientationabsolute') || e.alpha == null || e.beta == null || e.gamma == null) return null;
    const a = e.alpha * D2R;
    const b = e.beta * D2R;
    const g = e.gamma * D2R;
    const vx = -Math.cos(a) * Math.sin(g) - Math.sin(a) * Math.sin(b) * Math.cos(g);
    const vy = -Math.sin(a) * Math.sin(g) + Math.cos(a) * Math.sin(b) * Math.cos(g);
    if (Math.hypot(vx, vy) < 0.25) return null;
    return Astro.norm360(Math.atan2(vx, vy) / D2R);
  }
  function onAim(e) {
    if (!SKY.aim || appKey !== 'sky') return;
    const h = aimHeading(e);
    if (h == null) return;
    SKY.aimGot = true;
    const now = performance.now();
    if (Math.abs(wrap180(h - SKY.facing)) < 3 || now - SKY.aimAt < 150) return;
    SKY.aimAt = now;
    SKY.facing = Math.round(h) % 360;
    queueSky();
  }

  // ---- the star game (#103)
  // A figure's stars, without their lines and without the name: join them, a pair at a time,
  // in 30 seconds. The last star picked stays picked, so a line can run on from it. Arrow keys
  // move between the stars in reading order and Enter picks one; a polite status line says what
  // happened. A win shows the name and a line about it, and the time (the best per figure is
  // kept in this browser); running out of time shows the rest of the figure.
  const CG = { fig: null, stars: [], segs: new Set(), done: new Set(), order: [], sel: -1, focus: 0, t0: 0, timer: 0, over: false, won: false, secs: 0, hint: -1, sec: -1 };
  function cgProject(fig) {
    const idx = [...new Set(SkyData.FIGURES[fig].flat())];
    const st = idx.map((i) => SkyData.STARS[i]);
    let vx = 0;
    let vy = 0;
    let vz = 0;
    for (const x of st) { const a = x[0] * 15 * D2R; const d = x[1] * D2R; vx += Math.cos(d) * Math.cos(a); vy += Math.cos(d) * Math.sin(a); vz += Math.sin(d); }
    const a0 = Math.atan2(vy, vx);
    const d0 = Math.atan2(vz, Math.hypot(vx, vy));
    // a gnomonic projection round the figure's middle, north up and east on the left, as overhead
    const pts = st.map((x) => {
      const a = x[0] * 15 * D2R;
      const d = x[1] * D2R;
      const k = Math.sin(d0) * Math.sin(d) + Math.cos(d0) * Math.cos(d) * Math.cos(a - a0);
      return [-(Math.cos(d) * Math.sin(a - a0)) / k, -(Math.cos(d0) * Math.sin(d) - Math.sin(d0) * Math.cos(d) * Math.cos(a - a0)) / k];
    });
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const k = Math.min(260 / (x1 - x0 || 1), 170 / (y1 - y0 || 1));
    const ox = (320 - (x1 - x0) * k) / 2;
    const oy = (220 - (y1 - y0) * k) / 2;
    const stars = pts.map((p, i) => ({ id: st[i][3], mag: st[i][2], x: ox + (p[0] - x0) * k, y: oy + (p[1] - y0) * k }));
    const segs = new Set();
    for (const pl of SkyData.FIGURES[fig]) {
      for (let i = 1; i < pl.length; i++) { const a = idx.indexOf(pl[i - 1]); const b = idx.indexOf(pl[i]); segs.add(a < b ? `${a}-${b}` : `${b}-${a}`); }
    }
    const order = stars.map((x, i) => i).sort((p, q) => (stars[p].x - stars[q].x) || (stars[p].y - stars[q].y));
    return { stars, segs, order };
  }
  const cgSay = (text) => { const el = $('#cgStatus', A.body); if (el) { el.textContent = ''; el.textContent = text; } };
  function cgStart() {
    const figs = SkyData.GAME_FIGURES.filter((f) => f !== CG.fig);
    const fig = figs[Math.floor(Math.random() * figs.length)];
    Object.assign(CG, cgProject(fig), { fig, done: new Set(), sel: -1, t0: Date.now(), over: false, won: false, secs: 0, hint: -1, sec: -1 });
    CG.focus = CG.order[0];
    clearInterval(CG.timer);
    CG.timer = setInterval(cgTick, 250);
    cgPaint(true);
    cgSay(fmt(C().app.sky.gameStart, { total: CG.segs.size }));
  }
  function cgTick() {
    if (!CG.fig || CG.over) { clearInterval(CG.timer); return; }
    if (appKey !== 'sky') { clearInterval(CG.timer); CG.over = true; return; }
    const left = 30 - (Date.now() - CG.t0) / 1000;
    if (left <= 0) { cgEnd(false); return; }
    const sec = Math.ceil(left);
    if (sec !== CG.sec) { CG.sec = sec; setText($('#cgClock', A.body), `0:${pad(sec)}`); }
  }
  function cgPick(i) {
    if (!CG.fig || CG.over) return;
    const tt = C().app.sky;
    CG.focus = i;
    CG.hint = -1;
    if (CG.sel < 0 || CG.sel === i) { CG.sel = CG.sel === i ? -1 : i; cgPaint(); return; }
    const key = CG.sel < i ? `${CG.sel}-${i}` : `${i}-${CG.sel}`;
    CG.sel = i;
    if (CG.segs.has(key) && !CG.done.has(key)) {
      CG.done.add(key);
      if (CG.done.size === CG.segs.size) { cgEnd(true); return; }
      cgSay(fmt(tt.gameHit, { n: CG.done.size, total: CG.segs.size }));
    } else if (!CG.segs.has(key)) cgSay(tt.gameMiss);
    cgPaint();
  }
  function cgEnd(won) {
    clearInterval(CG.timer);
    Object.assign(CG, { over: true, won, sel: -1, hint: -1, secs: (Date.now() - CG.t0) / 1000 });
    const tt = C().app.sky;
    const name = SkyData.FIGURE_NAMES[CG.fig][lang] || SkyData.FIGURE_NAMES[CG.fig].en;
    if (won) {
      let best = {};
      try { best = JSON.parse(store.get('ls7-cg-best') || '{}') || {}; } catch (e) { best = {}; }
      CG.best = Math.min(best[CG.fig] || Infinity, CG.secs);
      best[CG.fig] = +CG.best.toFixed(1);
      store.set('ls7-cg-best', JSON.stringify(best));
    }
    setText($('#cgClock', A.body), '');
    cgPaint();
    cgSay(won ? fmt(tt.gameWin, { s: CG.secs.toFixed(1), name }) : fmt(tt.gameLose, { name }));
  }
  /** Draw the board from CG: the lines found (and, after time runs out, the rest dashed), the
   *  stars as buttons, the result. Focus stays on the star it was on. */
  function cgPaint(focusFirst = false) {
    const board = $('#cgBoard', A.body);
    if (!board) return;
    const tt = C().app.sky;
    $('#cgStart', A.body).textContent = CG.fig ? tt.gameNext : tt.gamePlay;
    $('#cgHint', A.body).hidden = !CG.fig || CG.over;
    board.hidden = !CG.fig;
    if (!CG.fig) return;
    board.dataset.fig = CG.fig;
    const hadFocus = board.contains(doc.activeElement);
    const line = (key, cls) => { const [a, b] = key.split('-').map(Number); const p = CG.stars[a]; const q = CG.stars[b]; return `<line x1="${p.x.toFixed(1)}" y1="${p.y.toFixed(1)}" x2="${q.x.toFixed(1)}" y2="${q.y.toFixed(1)}" class="${cls}"/>`; };
    let lines = '';
    for (const k of CG.segs) {
      if (CG.done.has(k) || (CG.over && CG.won)) lines += line(k, 'cg-line');
      else if (CG.over) lines += line(k, 'cg-line cg-rest');
    }
    $('#cgSvg', A.body).innerHTML = lines;
    const rank = new Map(CG.order.map((i, n) => [i, n + 1]));
    $('#cgStars', A.body).innerHTML = CG.order.map((i) => {
      const st = CG.stars[i];
      const r = Math.max(2.2, Math.min(5, 4.6 - 0.8 * st.mag));
      const label = fmt(i === CG.sel ? tt.gamePicked : tt.gameStar, { n: rank.get(i), total: CG.stars.length });
      return `<button type="button" class="cg-star${i === CG.sel ? ' sel' : ''}${i === CG.hint ? ' hint' : ''}" data-i="${i}" style="left:${(st.x / 3.2).toFixed(2)}%;top:${(st.y / 2.2).toFixed(2)}%;--r:${r.toFixed(1)}px"`
        + ` tabindex="${i === CG.focus ? 0 : -1}" aria-label="${esc(label)}"${CG.over ? ' aria-disabled="true"' : ''}></button>`;
    }).join('');
    const res = $('#cgResult', A.body);
    res.hidden = !CG.over;
    if (CG.over) {
      const nm = SkyData.FIGURE_NAMES[CG.fig];
      const story = SkyData.FIGURE_STORIES[CG.fig];
      const name = nm[lang] || nm.en;
      res.innerHTML = `<p class="cg-name">${esc(name)}</p><p class="cg-story">${esc(story[lang] || story.en)}</p>`
        + `<p class="cg-time">${esc(CG.won ? `${fmt(tt.gameWin, { s: CG.secs.toFixed(1), name })}${lang === 'zh' ? '' : ' '}${fmt(tt.gameBest, { s: CG.best.toFixed(1) })}` : fmt(tt.gameLose, { name }))}</p>`;
    }
    if (focusFirst || (hadFocus && !CG.over)) { const b = $(`.cg-star[data-i="${CG.focus}"]`, A.body); if (b) b.focus({ preventScroll: !focusFirst }); }
    else if (hadFocus) $('#cgStart', A.body).focus({ preventScroll: true });
  }
  function cgHint() {
    if (!CG.fig || CG.over) return;
    const left = [...CG.segs].filter((k) => !CG.done.has(k));
    if (!left.length) return;
    const [a, b] = left[Math.floor(Math.random() * left.length)].split('-').map(Number);
    CG.hint = CG.sel === a ? b : a;
    cgPaint();
    cgSay(C().app.sky.gameHintSay);
  }

  /** Focus a body in the chart that Search asked for (#140). */
  function skySelect() {
    if (!SKY.select || appKey !== 'sky') return;
    const g = $(`#skyChart .sky-body[data-id="${SKY.select}"]`, A.body);
    SKY.select = null;
    if (!g) return;
    SKY.last.forEach((x) => x.setAttribute('tabindex', x === g ? '0' : '-1'));
    g.focus();
    skyInfo(g);
  }
  /** #140: open the Sky on a planet or the Moon, at a moment it is up tonight if it is not up now. */
  function skyGoTo(name) {
    const c = homeCity();
    setSkyCity(c, false);
    const t = vnow();
    let when = null;
    if (Astro.observe(name, t, c.lat, c.lon).alt <= 0) {
      const n = tonightFor(c);
      if (name === 'moon') {
        const a = n.darkStart != null ? n.darkStart : n.noon0;
        const b = n.darkEnd != null ? n.darkEnd : n.noon1;
        for (let x = a; x <= b && when == null; x += 900000) if (Astro.observe('moon', x, c.lat, c.lon).alt > 5) when = x;
      } else {
        const p = n.planets.find((x) => x.name === name);
        if (p && p.visible) when = p.best;
      }
    }
    if (when != null) { SKY.mode = 'custom'; SKY.t = when; } else SKY.mode = 'now';
    SKY.select = name === 'moon' ? 'moon' : `planet:${name}`;
    if (appKey === 'sky') { paintSky(); skySelect(); } else openApp('sky');   // openAppUI selects it after focusing the title
  }
  /** #92, #101: the place, the date and the time after the # (#sky/tokyo/2026-11-14/21:30). A
   *  place found by "Use my location" goes into a link rounded to 0.1° (about 10 km). */
  function skyHash(share = false) {
    const c = SKY.city;
    let place = c.id;
    if (!place) { const k = c.geo ? 1 : 2; place = `${c.lat.toFixed(k)},${c.lon.toFixed(k)}`; }
    let h = `#sky/${place}`;
    if (SKY.mode !== 'now' || share) {
      const t = skyT();
      const p = Astro.zonedParts(t, c.tz);
      h += `/${isoOf(p.year, p.month, p.day)}`;
      if (SKY.mode !== 'tonight') {
        h += `/${pad(p.hour)}:${pad(p.minute)}`;
        // #177: the second time round the hour the clocks repeat in the fall carries its UTC
        // offset (01:30-0500), or the link would open on the first one, an hour earlier
        if (t - Astro.zonedTime(p.year, p.month, p.day, p.hour, p.minute, c.tz) >= 15 * 60000) {
          const o = Math.round(Astro.tzOffsetMin(t, c.tz));
          h += `${o < 0 ? '-' : '+'}${pad(Math.floor(Math.abs(o) / 60))}${pad(Math.abs(o) % 60)}`;
        }
      }
    }
    return h;
  }
  /** Keep the address bar on what is shown, so it can be copied too (not for "my location"). */
  function syncSkyHash() {
    clearTimeout(SKY.hashTimer);
    SKY.hashTimer = setTimeout(() => {
      if (appKey !== 'sky' || state.app !== 'sky' || SKY.city.geo) return;
      const h = skyHash();
      if (location.hash === h) return;
      try { history.replaceState(history.state, '', location.pathname + location.search + h); } catch (e) { /* file:// quirks */ }
    }, 250);
  }
  /** "#sky/<place>/<date>/<time>" → {city, date, time}; a place is a city id or "lat,lon". */
  function skyRoute(segs) {
    const out = { city: null, date: null, time: null, bare: !segs.length };
    if (segs[0]) out.city = cityById(segs[0]) || parseLatLon(segs[0].replace(/^@/, ''));
    const dm = segs[1] && segs[1].match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dm) {
      const [y, m, d] = dm.slice(1).map(Number);
      const v = new Date(Date.UTC(y, m - 1, d));
      if (v.getUTCMonth() === m - 1 && v.getUTCDate() === d && inSkyRange(y, m, d)) out.date = { y, m, d };
    }
    const tm = out.date && segs[2] && segs[2].match(/^(\d{1,2}):?(\d{2})(?:([+-])(\d{2}):?(\d{2}))?$/);
    if (tm && Number(tm[1]) < 24 && Number(tm[2]) < 60) {
      out.time = { h: Number(tm[1]), mi: Number(tm[2]), off: tm[3] && Number(tm[4]) < 15 && Number(tm[5]) < 60 ? (tm[3] === '-' ? -1 : 1) * (Number(tm[4]) * 60 + Number(tm[5])) : null };
    }
    return out;
  }
  function applySkyRoute(r) {
    if (r.city) setSkyCity(r.city, !!r.city.id);
    else if (r.bare && !store.get('ls7-sky-city')) { SKY.city = cityById('albany'); SKY.guess = false; }   // #102: the README's link shows Albany
    const c = SKY.city;
    if (r.date && r.time) {
      SKY.mode = 'custom';
      SKY.t = r.time.off != null ? Date.UTC(r.date.y, r.date.m - 1, r.date.d, r.time.h, r.time.mi) - r.time.off * 60000
        : Astro.zonedTime(r.date.y, r.date.m, r.date.d, r.time.h, r.time.mi, c.tz);
    }
    else if (r.date) { SKY.mode = 'tonight'; SKY.t = tonightTime(Astro.zonedTime(r.date.y, r.date.m, r.date.d, 13, 0, c.tz)); }
    else SKY.mode = 'now';
  }
  /** The shareable link: this page's address, with the place, the date and the time. */
  const skyShareURL = () => location.href.replace(/[?#].*$/, '') + skyHash(true);
  /** Copy text: the Clipboard API, else a hidden text field and execCommand (older browsers, file://). */
  function copyText(text, done, fail, refocus) {
    const legacy = () => {
      const ta = doc.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.className = 'sr-only';
      (A.layer.hidden ? body : A.view).append(ta);
      ta.select();
      let ok = false;
      try { ok = doc.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      if (refocus) refocus.focus({ preventScroll: true });
      (ok ? done : fail)();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, legacy); else legacy();
  }
  function skyCopy() {
    const url = skyShareURL();
    const note = $('#skyShareNote', A.body);
    const tt = C().app.sky;
    copyText(url, () => setText(note, tt.copied), () => { note.innerHTML = `${esc(tt.copyFail)} <span class="sky-url">${esc(url)}</span>`; }, $('#skyCopy', A.body));
  }
  /** #151: the system share sheet (phones, Safari); "Copy link" where there is none. */
  const canShare = () => typeof navigator.share === 'function';
  function shareLink(url, title) {
    if (!canShare()) return false;
    try { navigator.share({ title, url }).catch(() => { /* closed without sharing */ }); } catch (e) { return false; }
    return true;
  }
  /** #101: the chart as a PNG, drawn in the browser (no upload): a title, the time, the chart
   *  and the link at the foot. */
  function skySave() {
    const svg = $('#skyChart svg', A.body);
    const note = $('#skyShareNote', A.body);
    const tt = C().app.sky;
    if (!svg) return;
    const c = SKY.city;
    const t = skyT();
    const N = 1080;
    const pad_ = 64;
    const head = 156;
    const foot = 96;
    const clone = svg.cloneNode(true);
    clone.setAttribute('width', String(N));
    clone.setAttribute('height', String(N));
    const img = new Image();
    img.onerror = () => setText(note, tt.saveFail);
    img.onload = () => {
      const cv = doc.createElement('canvas');
      cv.width = N + 2 * pad_;
      cv.height = N + head + foot;
      const g = cv.getContext('2d');
      const cs = getComputedStyle(A.view);
      const v = (k, d) => (cs.getPropertyValue(k) || '').trim() || d;
      g.fillStyle = SKY.red ? '#0a0000' : v('--bg', '#08090c');
      g.fillRect(0, 0, cv.width, cv.height);
      g.drawImage(img, pad_, head, N, N);
      const font = cs.fontFamily;
      g.fillStyle = v('--fg', '#f7f8f8');
      g.font = `700 50px ${font}`;
      g.fillText(fmt(tt.imageTitle, { place: placeName(c) }), pad_, 84);
      g.fillStyle = v('--fg2', '#a4a9b3');
      g.font = `500 30px ${font}`;
      g.fillText(`${dateIn(t, c.tz, { month: 'long', day: 'numeric', year: 'numeric' })} · ${cityTime(t)} · ${zoneLabel(c, t)}`, pad_, 130);
      g.font = `500 26px ${font}`;
      g.fillText(`${String(D.facts.links.pages || '').replace(/^https?:\/\//, '').replace(/\/$/, '')}/${skyHash(true)}`, pad_, head + N + 58);
      const p = Astro.zonedParts(t, c.tz);
      const name = `sky-${c.id || 'place'}-${isoOf(p.year, p.month, p.day)}-${pad(p.hour)}${pad(p.minute)}.png`;
      cv.toBlob((blob) => {
        if (!blob) { setText(note, tt.saveFail); return; }
        const a = doc.createElement('a');
        a.download = name;
        a.href = URL.createObjectURL(blob);
        a.hidden = true;
        A.view.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 60000);
        setText(note, fmt(tt.saved, { file: name }));
      }, 'image/png');
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;
  }
  function skyList(items, q) {
    const list = $('#skyList', A.body);
    const input = $('#skyQ', A.body);
    if (!list || !input) return;
    SKY.items = items;
    SKY.sel = items.length ? 0 : -1;
    if (!q) { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); return; }
    list.innerHTML = items.length ? items.map((c, i) => `<li role="option" id="skyOpt${i}" class="sky-opt${i === 0 ? ' active' : ''}" data-i="${i}" aria-selected="${i === 0}">`
      + `<b>${esc(placeName(c))}</b><small>${esc(c.custom ? C().app.sky.point : `${lang === 'zh' ? c.name.en : c.name.zh} · ${fmtCoord(c.lat, c.lon)}`)}</small></li>`).join('')
      : `<li class="sky-none" role="presentation">${esc(C().app.sky.noResults)}</li>`;
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    if (items.length) input.setAttribute('aria-activedescendant', 'skyOpt0'); else input.removeAttribute('aria-activedescendant');
  }
  function skyMove(d) {
    if (!SKY.items || !SKY.items.length) return;
    SKY.sel = (SKY.sel + d + SKY.items.length) % SKY.items.length;
    $$('.sky-opt', A.body).forEach((o, i) => { o.classList.toggle('active', i === SKY.sel); o.setAttribute('aria-selected', String(i === SKY.sel)); });
    const input = $('#skyQ', A.body);
    input.setAttribute('aria-activedescendant', `skyOpt${SKY.sel}`);
    const o = $(`#skyOpt${SKY.sel}`, A.body);
    if (o) o.scrollIntoView({ block: 'nearest' });
  }
  function skyPick(c) {
    if (!c) return;
    setSkyCity(c, !c.custom);
    const input = $('#skyQ', A.body);
    if (input) input.value = '';
    skyList([], '');
    paintSky();
  }
  function skyGeo() {
    const note = $('#skyGeoNote', A.body);
    const tt = C().app.sky;
    if (!('geolocation' in navigator)) { setText(note, tt.geoFail); return; }
    setText(note, tt.geoBusy);
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = +pos.coords.latitude.toFixed(4);
      const lon = +pos.coords.longitude.toFixed(4);
      setSkyCity({ id: null, custom: true, geo: true, name: { en: D.copy.en.app.sky.here, zh: D.copy.zh.app.sky.here }, lat, lon, tz: browserTZ() }, false);
      const n2 = $('#skyGeoNote', A.body);
      if (n2) setText(n2, C().app.sky.geoNote);
      paintSky();
    }, () => { const n2 = $('#skyGeoNote', A.body); if (n2) setText(n2, C().app.sky.geoFail); }, { timeout: 15000, maximumAge: 600000 });
  }
  A.body.addEventListener('input', (e) => {
    if (appKey !== 'sky') return;
    const t = e.target;
    if (t.id === 'skyQ') {
      const q = t.value.trim();
      const ll = parseLatLon(q);
      skyList(ll ? [ll] : skyMatches(q), q);
    } else if (t.id === 'skyRange') {
      SKY.mode = 'custom';
      SKY.t = Number(t.dataset.from) + Number(t.value) * 600000;
      queueSky();
    }
  });
  A.body.addEventListener('change', (e) => {
    if (appKey !== 'sky' || e.target.id !== 'skyDate' || !e.target.value) return;
    let [y, mo, d] = e.target.value.split('-').map(Number);
    const note = $('#skyDateNote', A.body);
    // the planets' elements are good to 2050: dates outside 1900 to 2050 come back to the edge
    if (!inSkyRange(y, mo, d)) {
      [y, mo, d] = Date.UTC(y, mo - 1, d) < Date.UTC(SKY_MIN[0], 0, 1) ? SKY_MIN : SKY_MAX;
      e.target.value = isoOf(y, mo, d);
      setText(note, C().app.sky.dateRange);
    } else setText(note, '');
    const p = Astro.zonedParts(skyT(), SKY.city.tz);
    SKY.t = Astro.zonedTime(y, mo, d, p.hour, p.minute, SKY.city.tz);
    if (SKY.mode === 'tonight') SKY.t = tonightTime(SKY.t);
    else SKY.mode = 'custom';
    paintSky();
  });
  A.body.addEventListener('keydown', (e) => {
    if (appKey !== 'sky') return;
    const t = e.target;
    if (t.id === 'skyQ') {
      const open = !$('#skyList', A.body).hidden;
      if (e.key === 'ArrowDown' && open) { e.preventDefault(); skyMove(1); } else if (e.key === 'ArrowUp' && open) { e.preventDefault(); skyMove(-1); } else if (e.key === 'Enter') {
        const q = t.value.trim();
        const items = SKY.items && SKY.items.length ? SKY.items : (parseLatLon(q) ? [parseLatLon(q)] : skyMatches(q));
        if (items.length) { e.preventDefault(); skyPick(items[Math.max(0, SKY.sel)] || items[0]); }
      } else if (e.key === 'Escape' && (open || t.value)) { e.preventDefault(); e.stopPropagation(); t.value = ''; skyList([], ''); }
      return;
    }
    // the star game: arrow keys move between the stars in reading order; Esc lets go of a star
    const cs = t.closest && t.closest('.cg-star');
    if (cs) {
      const i = CG.order.indexOf(Number(cs.dataset.i));
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      let n = null;
      if (step) n = (i + step + CG.order.length) % CG.order.length;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = CG.order.length - 1;
      else if (e.key === 'Escape' && CG.sel >= 0) { e.preventDefault(); e.stopPropagation(); CG.sel = -1; cgPaint(); return; }
      if (n == null) return;
      e.preventDefault();
      CG.focus = CG.order[n];
      for (const b of $$('.cg-star', A.body)) b.tabIndex = Number(b.dataset.i) === CG.focus ? 0 : -1;
      const nb = $(`.cg-star[data-i="${CG.focus}"]`, A.body);
      if (nb) nb.focus();
      return;
    }
    // the Facing and Faintest-stars radio groups: arrow keys move the choice
    const rg = t.closest && t.closest('#skyFace, #skyBright');
    if (rg) {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step) return;
      const items = $$('[role="radio"]', rg);
      const i = items.indexOf(t);
      if (i < 0) return;
      e.preventDefault();
      skyRadio(items[(i + step + items.length) % items.length], true);
      return;
    }
    const g = t.closest && t.closest('.sky-body');
    if (g && SKY.last.length) {
      const i = SKY.last.indexOf(g);
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      let n = null;
      if (step) n = (i + step + SKY.last.length) % SKY.last.length;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = SKY.last.length - 1;
      if (n == null) return;
      e.preventDefault();
      SKY.last.forEach((x, k) => x.setAttribute('tabindex', k === n ? '0' : '-1'));
      SKY.last[n].focus();
    }
  });
  /** A choice in the Facing or Faintest-stars group (#139). */
  function skyRadio(b, focus) {
    const grp = b.closest('[role="radiogroup"]');
    if (b.dataset.face != null) SKY.facing = Number(b.dataset.face); else SKY.bright = b.dataset.bright;
    for (const x of $$('[role="radio"]', grp)) {
      const on = x === b;
      x.setAttribute('aria-checked', String(on));
      x.tabIndex = on ? 0 : -1;
    }
    paintSky();
    const again = grp.id && $(`#${grp.id} [aria-checked="true"]`, A.body);
    if (focus && again) again.focus();
  }
  A.body.addEventListener('focusin', (e) => {
    const g = appKey === 'sky' && e.target.closest && e.target.closest('.sky-body');
    if (g) { SKY.last.forEach((x) => x.setAttribute('tabindex', x === g ? '0' : '-1')); skyInfo(g); }
  });
  A.body.addEventListener('pointerover', (e) => {
    const g = appKey === 'sky' && e.target.closest && e.target.closest('.sky-body');
    if (g) skyInfo(g);
  });
  A.body.addEventListener('mousedown', (e) => {
    const o = appKey === 'sky' && e.target.closest('.sky-opt');
    if (o) { e.preventDefault(); skyPick(SKY.items[Number(o.dataset.i)]); }
  });

  // the home screen's "Tonight" widget: Albany, or the place picked last in the Sky app
  let tonightAt = 0;
  let tonightTimer = 0;
  const queueTonight = () => { clearTimeout(tonightTimer); tonightTimer = setTimeout(renderTonightW, 120); };
  function renderTonightW() {
    tonightAt = vnow();
    const c = cityById(store.get('ls7-sky-city')) || cityById('albany');
    const w = C().tonightW;
    const n = Astro.tonight(vnow(), c.lat, c.lon, c.tz);
    const fmtT = (ms) => new Intl.DateTimeFormat(LOC(), { timeZone: c.tz, hour: 'numeric', minute: '2-digit' }).format(new Date(ms));
    const m = n.moon;
    const moonTxt = `${m.phaseName[lang]} · ${Math.round(m.illum * 100)}%`;
    const sunTxt = n.sunState === 'polar-night' ? w.polar : n.sunState === 'midnight-sun' ? w.midnight : n.sunset != null ? fmt(w.sunset, { time: fmtT(n.sunset) }) : '';
    const vis = n.planets.filter((p) => p.visible && p.naked).map((p) => SkyChart.bodyName(p.name, lang));
    const plTxt = vis.length ? vis.join(lang === 'zh' ? '、' : ', ') : w.none;
    const title = fmt(w.title, { city: placeShort(c) });
    E.tonightW.dataset.city = c.id;
    E.tonightW.innerHTML = `<span class="tw-moon" aria-hidden="true">${moonIcon(m, 40, c.lat < 0)}</span>`
      + `<span class="tw-txt"><b class="tw-title">${esc(title)}</b><span class="tw-line"><span class="tw-seg">${esc(moonTxt)}</span>${sunTxt ? `<span class="tw-seg">${esc(sunTxt)}</span>` : ''}</span>`
      + `<span class="tw-line tw-pl">${vis.length ? n.planets.filter((p) => p.visible && p.naked).map((p) => `<i style="background:var(--pl-${p.name})"></i>`).join('') : ''}${esc(plTxt)}</span></span>`
      + '<svg class="tw-go" width="16" height="16" aria-hidden="true" focusable="false"><use href="#u-chev"/></svg>';
    E.tonightW.setAttribute('aria-label', fmt(w.aria, { city: placeShort(c), summary: `${moonTxt}. ${sunTxt ? `${sunTxt}. ` : ''}${plTxt}.` }));
  }

  // ---------------------------------------------------------------- the guestbook (idea #85)
  // giscus keeps the notes in this site's GitHub Discussions. Nothing loads until the visitor
  // clicks, and nothing at all while repoId or categoryId is still empty (before go-live).
  const gbReady = () => !!(D.giscus.repoId && D.giscus.categoryId);
  function guestbookHTML(c) {
    const g = c.gb;
    return `<section class="tv-sec gb" id="guestbook"><h3 class="tv-head" id="gbHead" tabindex="-1">${esc(g.head)}</h3><div class="tv gb-card">`
      + `<p class="tv-p">${esc(g.intro)}</p>`
      + (gbReady()
        ? `<div class="gb-load" id="gbLoadRow"><button type="button" class="btn primary" id="gbLoad">${esc(g.load)}</button><p class="gb-note">${esc(g.note)}</p></div><div class="giscus gb-frame" id="gbFrame"></div>`
        : `<p class="gb-wait" id="gbWait">${esc(g.wait)}</p>`)
      + '</div></section>';
  }
  function loadGuestbook() {
    const box = $('#gbFrame', A.body);
    if (!gbReady() || !box || box.querySelector('script, iframe')) return;
    const g = D.giscus;
    const s = doc.createElement('script');
    const attrs = {
      repo: g.repo, 'repo-id': g.repoId, category: g.category, 'category-id': g.categoryId, mapping: g.mapping, term: g.term,
      strict: g.strict, 'reactions-enabled': g.reactionsEnabled, 'emit-metadata': g.emitMetadata, 'input-position': g.inputPosition,
      theme: g.themes[appearance], lang: lang === 'zh' ? 'zh-CN' : 'en', loading: g.loading,
    };
    for (const [k, v] of Object.entries(attrs)) s.setAttribute(`data-${k}`, v);
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = g.src;
    box.append(s);
    const row = $('#gbLoadRow', A.body);
    if (row) row.innerHTML = `<p class="gb-note">${esc(C().gb.loading)}</p>`;
  }
  /** Keep a loaded guestbook in step with the page: giscus takes setConfig messages. */
  function gbPost(cfg) {
    const f = doc.querySelector('iframe.giscus-frame');
    if (f && f.contentWindow) f.contentWindow.postMessage({ giscus: { setConfig: cfg } }, D.giscus.origin);
  }
  // giscus writes to this page from its frame as soon as it has loaded (its height, first of all):
  // then the "Loading the guestbook…" line goes. Messages from anywhere else change nothing.
  window.addEventListener('message', (e) => {
    if (e.origin !== D.giscus.origin || !e.data || typeof e.data !== 'object' || !e.data.giscus) return;
    const row = $('#gbLoadRow', A.body);
    if (row && $('#gbFrame iframe', A.body)) row.hidden = true;
  });
  let pendingFocus = null;
  function openGuestbook() {
    pendingFocus = 'guestbook';
    if (appKey === 'contact') focusPending(); else openApp('contact');
  }
  function focusPending() {
    const id = { guestbook: '#gbHead', wallpaper: '#wpHead' }[pendingFocus];
    if (!id) return;
    pendingFocus = null;
    setTimeout(() => {
      const h = $(id, A.body);
      if (!h) return;
      h.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
      h.focus({ preventScroll: true });
    }, 60);
  }

  // ---------------------------------------------------------------- commands and shortcuts (idea #86)
  // In Search, ">" switches to commands; "?" anywhere opens the list of every shortcut.
  // R3.3 batch 3: the quick view (#154) and present mode (#155) are commands and Search results
  const BRIEF_HAY = 'quick view brief one page recruiter recruiters hiring resume cv pdf print summary 速览 一页 简历 招聘 打印 简介';
  const PRESENT_HAY = 'present presentation slides slideshow interview share screen talk 演示 幻灯片 面试 投屏 讲解';
  function commandList(q) {
    const c = C();
    const k = c.cmd;
    const items = [];
    const add = (id, label, hay, extra = {}) => items.push({ id, label, hay: `${label} ${hay}`.toLowerCase(), ...extra });
    const sky = q.match(/^(sky|星空|天空)\s*(.*)$/i);
    if (sky && sky[2].trim()) {
      const rest = sky[2].trim();
      const ll = parseLatLon(rest);
      for (const city of (ll ? [ll] : skyMatches(rest)).slice(0, 6)) {
        items.push({ id: city.id ? `sky:${city.id}` : `sky:@${city.lat},${city.lon}`, label: fmt(k.sky, { city: placeName(city) }), hay: '', icon: 'sky' });
      }
      return items;
    }
    for (const a of APPS.concat('early')) add(`open:${a}`, fmt(k.open, { name: c.appNames[a] }), `${D.copy.en.appNames[a]} ${D.copy.zh.appNames[a]} open 打开 ${a} app`, { icon: a });
    add('theme:dark', k.dark, 'dark theme mode appearance night 深色 外观 主题', { ui: 'moon' });
    add('theme:light', k.light, 'light theme mode appearance day 浅色 外观 主题', { ui: 'sun' });
    add('theme:auto', k.auto, 'auto system theme mode appearance 自动 系统 外观 主题', { ui: 'auto' });
    add('lang:en', k.en, 'english language 英文 英语 语言', { icon: 'site' });
    add('lang:zh', k.zh, 'chinese language zhongwen 中文 汉语 语言', { icon: 'site' });
    add('tt:open', k.tt, 'time travel slider clock date past future 时间旅行 时间 日期', { ui: 'clock' });
    add('tt:now', k.ttNow, 'back to now reset time clock 回到现在 时间 现在', { ui: 'clock' });
    add('sky', fmt(k.sky, { city: placeName(SKY.city) }), 'sky stars planets moon tonight 星空 星星 天空 行星 月亮', { icon: 'sky' });
    add(reduced ? 'motion:off' : 'motion:on', reduced ? k.motionOff : k.motionOn, 'reduce motion animation accessibility 减弱 动态 动画 无障碍', { ui: 'auto' });
    add('source', k.source, 'view source code github repo repository 源代码 代码 仓库', { ui: 'ext', href: D.source });
    add('gb', k.gb, 'guestbook comments notes giscus message 留言簿 留言', { icon: 'contact' });
    add('lock', k.lock, 'lock screen 锁屏 锁定', { ui: 'lock' });
    add('keys', k.keys, 'keyboard shortcuts keys help ? 键盘 快捷键 帮助', { ui: 'search' });
    add('about', k.about, 'about this site info numbers privacy accessibility design drafts i 关于 本站 隐私 无障碍', { icon: 'about' });
    add('standby', k.standby, 'standby screensaver big clock idle 待机 屏保 大时钟', { ui: 'clock' });
    add('wallpaper', k.wallpaper, 'wallpaper today sky planets download png 壁纸 今天 下载', { icon: 'assets' });
    add('tour', k.tour, 'tour tips help first visit again 导览 提示 帮助', { ui: 'search' });
    add('brief', k.brief, BRIEF_HAY, { ui: 'today' });
    add('present', k.present, PRESENT_HAY, { ui: 'play' });
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    return items.filter((it) => terms.every((t) => it.hay.includes(t)));
  }
  function runCommand(id) {
    const at = id.indexOf(':');
    const k = at < 0 ? id : id.slice(0, at);
    const v = at < 0 ? '' : id.slice(at + 1);
    const stay = k === 'theme' || k === 'lang' || k === 'motion' || (k === 'tt' && v === 'now');
    closeOverlay({ noFocus: !stay });
    if (k === 'open') { if (v === 'early') openFolder(); else openApp(v); } else if (k === 'theme') applyAppearance(v, true);
    else if (k === 'lang') applyLang(v, true);
    else if (k === 'tt') { if (v === 'now') ttBackToNow(); else ttOpen(); } else if (k === 'sky') {
      if (v.startsWith('@')) { const ll = parseLatLon(v.slice(1)); if (ll) setSkyCity(ll, false); } else if (v) setSkyCity(cityById(v), true);
      if (appKey === 'sky') paintSky(); else openApp('sky');
    } else if (k === 'motion') setReduced(v === 'on', true);
    else if (k === 'gb') openGuestbook();
    else if (k === 'lock') { if (TT.open) ttClose(true); lockScreen(); } else if (k === 'keys') openOverlay('keys');
    else if (k === 'about') openOverlay('about');
    else if (k === 'standby') enterStandby();
    else if (k === 'wallpaper') { pendingFocus = 'wallpaper'; if (appKey === 'assets') focusPending(); else openApp('assets'); }
    else if (k === 'tour') { if (TT.open) ttClose(true); lockScreen(); setTimeout(() => startTour(true), reduced ? 60 : 450); }
    else if (k === 'brief') openBrief();
    else if (k === 'present') openPresent(1);
  }
  function renderKeys() {
    K.list.innerHTML = C().keys.rows.map(([keys, what]) => `<div class="kr"><dt>${keys.split(' · ').map((x) => `<kbd class="kbd">${esc(x)}</kbd>`).join('')}</dt><dd>${esc(what)}</dd></div>`).join('');
  }

  // ================================================================ R3.3 batch 2
  const uIco = (k, sz = 14) => `<svg width="${sz}" height="${sz}" aria-hidden="true" focusable="false"><use href="#u-${k}"/></svg>`;
  /** After an app's page is drawn: the parts that need it on screen first. */
  function afterRender(key) {
    if (key === 'design') paintDesign();
    if (key === 'assets') paintWallpapers();
    if (key === 'how') paintHow();
    if (key === 'storewright') { gameInit(); labInit(); }
  }

  // ---------------------------------------------------------------- the visitor's time (#114) and a greeting (#152)
  // The browser already knows the visitor's time zone, so nothing is asked for. The greeting goes
  // by the visitor's own clock; when that is not Albany's, the line says whose time it is. Same
  // offset as Albany: just the greeting. Both follow time travel, like every other clock here.
  function yourTime(t = vnow()) {
    const mine = myZone();
    if (!mine) return null;
    const now = new Date(t);
    const a = tzOffset(TZ, now);
    const b = tzOffset(mine, now);
    if (a == null || b == null) return null;
    let hour = 0;
    let minute = 0;
    try {
      const o = {};
      for (const x of new Intl.DateTimeFormat('en-US', { timeZone: mine, hourCycle: 'h23', hour: 'numeric', minute: '2-digit' }).formatToParts(now)) o[x.type] = x.value;
      hour = Number(o.hour) % 24;
      minute = Number(o.minute);
    } catch (e) { return null; }
    // written like the page's own clock: "11:36 AM", "上午 11:36"
    const h12 = hour % 12 || 12;
    const ap = hour < 12 ? C().am : C().pm;
    const time = lang === 'zh' ? `${ap} ${h12}:${pad(minute)}` : `${h12}:${pad(minute)} ${ap}`;
    return { zone: mine, diff: (b - a) / 60, time, hour };
  }
  /** "13 hr ahead of Albany" (a half hour as 9.5). */
  function relText(diff) {
    const t = C().app.clock;
    const h = Math.abs(diff);
    return !diff ? t.same : fmt(diff > 0 ? t.ahead : t.behind, { h: Number.isInteger(h) ? h : Number(h.toFixed(2)) });
  }
  /** The greeting for an hour of the visitor's clock: before 5 AM a plain "Hello", then morning
   *  (5 to 11), afternoon (12 to 5 PM) and evening (6 PM to midnight). */
  const greeting = (hour) => { const g = C().greet; return hour < 5 ? g.night : hour < 12 ? g.morning : hour < 18 ? g.afternoon : g.evening; };
  function paintGreet() {
    const y = yourTime();
    if (!y) { E.greet.hidden = true; return; }
    const g = greeting(y.hour);
    setText(E.greet, y.diff ? fmt(C().greet.you, { greet: g, time: y.time, rel: relText(y.diff) }) : g);
    E.greet.dataset.diff = String(y.diff);
    E.greet.hidden = false;
  }
  /** Contact: the visitor's time under Albany's, unless they are the same. */
  function yourRow(t) {
    const y = yourTime();
    if (!y || !y.diff) return '';
    return `<div class="tv-row"><span class="tv-l">${esc(t.rows.you)}</span><span class="tv-v" data-live="yours">${esc(fmt(t.youVal, { time: y.time, rel: relText(y.diff) }))}</span></div>`;
  }

  // ---------------------------------------------------------------- Contact: booking (#160), the QR code (#120), sharing (#151), testimonials (#161)
  // The QR code is drawn at build time by live/qr.mjs and holds only the page's address. Booking
  // and testimonials appear only once they exist (profile.json); a preview build shows where they
  // will go, labelled. Testimonials are shown as written, with the name and the relation. How
  // soon I reply (booking.reply_*, confirmed on 2026-11-15) sits under "Say hi", with or without
  // a booking link.
  function replyHTML(t) {
    const b = D.booking;
    if (!b || !b.reply) return '';
    return `<p class="tv-foot ct-reply">${esc(b.reply[lang])}</p>${b.replyDraft ? `<p class="preview-note">${esc(t.draft)}</p>` : ''}`;
  }
  function bookingHTML(t) {
    const b = D.booking;
    if (!b || !b.button) return '';
    const btn = b.url ? linkBtn(t.book, b.url, true) : `<button type="button" class="btn primary" disabled>${esc(t.book)}</button>`;
    return `<section class="tv-sec" id="booking"><h3 class="tv-head">${esc(t.bookHead)}</h3><div class="tv book-card"><div class="book-row">${btn}</div>`
      + `${b.url ? '' : `<p class="preview-note">${esc(t.bookWait)}</p>`}</div></section>`;
  }
  function qrHTML(t) {
    const q = D.qr;
    if (!q) return '';
    const share = canShare();
    return `<section class="tv-sec"><h3 class="tv-head" id="qrHead">${esc(t.qrHead)}</h3><div class="tv qr-card">`
      + `<svg class="qr" id="qrCode" viewBox="0 0 ${q.n} ${q.n}" role="img" aria-label="${esc(fmt(t.qrAria, { url: q.url }))}" shape-rendering="crispEdges" focusable="false">`
      + `<rect class="qr-bg" width="${q.n}" height="${q.n}" rx="2" fill="#ffffff"/><path class="qr-m" d="${q.path}" fill="#0b0c0e"/></svg>`
      + `<div class="qr-side"><p class="qr-url">${esc(host(q.url))}</p><p class="qr-note">${esc(t.qrNote)}</p>`
      + `<button type="button" class="btn" id="ctShare">${uIco(share ? 'share' : 'link')}<span>${esc(share ? t.share : t.copy)}</span></button>`
      + '<p class="sky-note qr-msg" id="ctShareNote" role="status"></p></div></div></section>';
  }
  function contactShare() {
    const t = C().app.contact;
    const url = D.qr.url;
    if (shareLink(url, `${D.facts.name} ${D.facts.nameZh}`)) return;
    const note = $('#ctShareNote', A.body);
    copyText(url, () => setText(note, t.copied), () => { note.innerHTML = `${esc(t.copyFail)} <span class="sky-url">${esc(url)}</span>`; }, $('#ctShare', A.body));
  }
  function testimonialsHTML(t) {
    const s = D.testimonials;
    if (!s) return '';
    const items = s.items.map((it) => `<figure class="tm"><blockquote${it.lang ? ` lang="${it.lang === 'zh' ? 'zh-CN' : 'en'}"` : ''}><p>${esc(it.text)}</p></blockquote>`
      + `<figcaption><b>${esc(it.name)}</b><span>${esc(t.roles[it.role] || it.role)}</span>`
      + `${it.link ? `<a href="${esc(it.link)}" target="_blank" rel="noopener noreferrer">${esc(host(it.link))}<span class="sr-only">${esc(C().newTab)}</span></a>` : ''}</figcaption></figure>`).join('');
    const leave = s.form ? linkBtn(t.tLeave, s.form) : (D.preview ? `<button type="button" class="btn" disabled>${esc(t.tLeave)}</button>` : '');
    const invite = leave ? `<div class="tm-invite"><p class="tv-p">${esc(t.tInvite)}</p><div class="tm-row">${leave}<p class="sky-note">${esc(t.tNote)}</p></div>`
      + `${s.form ? '' : `<p class="preview-note">${esc(t.tWait)}</p>`}</div>` : '';
    const empty = !s.items.length && D.preview ? `<p class="preview-note">${esc(t.tEmpty)}</p>` : '';
    if (!items && !invite && !empty) return '';
    return `<section class="tv-sec" id="testimonials"><h3 class="tv-head">${esc(t.tHead)}</h3><div class="tv tm-card">${items}${empty}${invite}</div></section>`;
  }
  /** #171: SilNest's latest release notes, as the App Store lists them (none for 1.0). */
  function notesHTML(t) {
    const rn = D.releaseNotes;
    if (rn) {
      const sub = fmt(t.notesSub, { version: rn.version, date: rn.date ? whenLong(rn.date) : '' }).replace(/\s*·\s*$/, '');
      return sec(t.notesHead, `<p class="tv-p rn-sub">${esc(sub)}</p>${rn.text.split(/\n+/).filter((x) => x.trim()).map((x) => `<p class="tv-p rn-p">${esc(x.trim())}</p>`).join('')}`);
    }
    return D.preview ? sec(t.notesHead, `<p class="preview-note">${esc(fmt(t.notesWait, { version: D.facts.snVersion }))}</p>`) : '';
  }

  // ---------------------------------------------------------------- About this site (#115, #176, #122, #147)
  // Press I, or search "about": what the page weighs, how many checks it passed, when it was
  // built, how its sky compares with JPL Horizons (numbers worked out by pages/build.py and
  // scripts/check_astro.mjs, nothing typed by hand), then privacy, accessibility and the drafts
  // the design went through.
  function renderAbout() {
    const c = C();
    const t = c.about;
    const a = D.about || {};
    const ico = (k) => `<svg class="ab-ico" width="16" height="16" aria-hidden="true" focusable="false"><use href="#u-${k}"/></svg>`;
    const num = (label, value, note, id) => `<div class="ab-num" data-k="${id}"><dt>${esc(label)}</dt><dd class="ab-v">${esc(value)}</dd>${note ? `<dd class="ab-n">${esc(note)}</dd>` : ''}</div>`;
    let nums = num(t.size, fmt(t.kb, { n: Math.round((a.pageBytes || 0) / 1024).toLocaleString(LOC()) }), t.sizeNote, 'size')
      + num(t.requests, (0).toLocaleString(LOC()), t.requestsNote, 'requests');
    if (a.checks) nums += num(t.checks, Number(a.checks.passed).toLocaleString(LOC()), fmt(t.checksNote, { date: whenLong(a.checks.date) }), 'checks');
    if (a.built) nums += num(t.built, fmtDate(a.built, { month: 'short', day: 'numeric', year: 'numeric' }), t.builtNote, 'built');
    let html = `<p class="ab-p ab-intro">${esc(t.intro)}</p>`
      + `<section class="ab-sec"><h3 class="ab-h">${esc(t.numbersHead)}</h3><dl class="ab-nums" id="abNums">${nums}</dl></section>`;
    const X = a.astro;
    if (X && X.rows) {
      const unit = (k) => (k === 'riseSet' ? 'min' : k === 'phases' ? 'h' : 'deg');
      const digits = { deg: 3, min: 1, h: 2 };
      const val = (v, k) => fmt(t.units[unit(k)], { v: Number(v).toLocaleString(LOC(), { minimumFractionDigits: digits[unit(k)], maximumFractionDigits: digits[unit(k)] }) });
      const lim = (v, k) => fmt(t.units[unit(k)], { v: Number(v).toLocaleString(LOC(), { maximumFractionDigits: 3 }) });
      const rows = ['planets', 'jupiter', 'saturn', 'sun', 'moon', 'altaz', 'altazMoon', 'riseSet', 'phases'].filter((k) => X.rows[k]).map((k) => {
        const r = X.rows[k];
        return `<tr data-k="${k}"><th scope="row">${esc(t.astroRows[k])}</th><td>${esc(val(r.err, k))}</td><td>${esc(lim(r.limit, k))}</td></tr>`;
      }).join('');
      html += `<section class="ab-sec" id="abAstro"><h3 class="ab-h">${esc(t.astroHead)}</h3><p class="ab-p">${esc(t.astroIntro)}</p>`
        + `<div class="ab-table-wrap"><table class="ab-table"><thead><tr>${t.astroCols.map((x) => `<th scope="col">${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`
        + `<p class="ab-foot">${esc(fmt(t.astroFoot, { fetched: X.fetched ? whenLong(X.fetched) : '', dates: X.dates, from: X.from, to: X.to, passed: X.passed, n: X.n }))}</p></section>`;
    }
    html += `<section class="ab-sec" id="abPrivacy"><h3 class="ab-h">${esc(t.privacyHead)}</h3><ul class="ab-list">`
      + t.privacy.map((line, i) => `<li>${ico(['shield', 'sliders', 'pin', 'target', 'chat', 'lock'][i] || 'shield')}<span>${esc(line)}</span></li>`).join('') + '</ul></section>';
    html += `<section class="ab-sec" id="abA11y"><h3 class="ab-h">${esc(t.a11yHead)}</h3><ul class="ab-list">`
      + t.a11y.map((line, i) => `<li>${ico(['keys', 'motion', 'eye', 'contrast'][i] || 'eye')}<span>${esc(line)}</span></li>`).join('') + '</ul>'
      + `<p class="ab-foot">${esc(fmt(t.a11yFoot, { email: D.facts.links.email }))}</p></section>`;
    html += `<section class="ab-sec" id="abDrafts"><h3 class="ab-h">${esc(t.draftsHead)}</h3><p class="ab-p">${esc(t.draftsIntro)}</p><ol class="ab-drafts">`
      + D.drafts.map((d) => {
        const x = t.drafts[d.key];
        return `<li class="ab-draft" data-k="${esc(d.key)}"><div class="ab-shot img-dr-${esc(d.key)}" role="img" aria-label="${esc(fmt(t.draftAlt, { date: whenLong(d.date), title: x.title }))}"></div>`
          + `<p class="ab-dt"><b>${esc(x.title)}</b><span>${esc(whenShort(d.date))}</span></p><p class="ab-dd">${esc(x.text)}</p></li>`;
      }).join('') + '</ol></section>';
    html += `<section class="ab-sec"><h3 class="ab-h">${esc(t.moreHead)}</h3><div class="ab-links">`
      + SITE_PAGES.map((k) => `<button type="button" class="btn ab-link" data-app="${k}">${icon(k, 'ico-xs')}<span>${esc(c.appNames[k])}</span></button>`).join('')
      + linkBtn(t.source, D.source) + '</div>'
      + `<ul class="ab-credits" id="abCredits" aria-label="${esc(t.creditsHead)}">${t.credits.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>`;
    AB.body.innerHTML = html;
  }

  // ---------------------------------------------------------------- standby (#118)
  // Off by default; Quick settings switches it on and remembers it. Then a minute without input
  // fades the page into a big Albany clock with the planets turning, like a phone on its side on
  // a desk; any input brings the page back (the key or press that wakes it does nothing else).
  // Never on its own under reduced motion. ">standby" (待机) starts it at once.
  function enterStandby() {
    if (SB.on) return;
    if (overlay) closeOverlay({ instant: true, noFocus: true });
    if (TT.open) ttClose(true);
    endTour();
    const a = doc.activeElement;
    SB.ret = a && a !== body && a !== root ? a : null;
    if (!SB.orbit.firstChild) { const svg = $('.orbit-svg', E.orbit); SB.orbit.innerHTML = svg ? svg.outerHTML.replace(/orb-/g, 'stb-') : ''; }
    SB.on = true;
    SB.at = Date.now();
    SB.x = null;
    clearTimeout(SB.el._t);
    SB.el.hidden = false;
    void SB.el.offsetWidth;
    SB.el.classList.add('open');
    body.classList.add('standing-by');
    paintStandby();
    setInert();
    SB.el.focus({ preventScroll: true });
    syncOrbit();
  }
  function exitStandby() {
    if (!SB.on) return;
    SB.on = false;
    SB.last = Date.now();
    SB.el.classList.remove('open');
    body.classList.remove('standing-by');
    clearTimeout(SB.el._t);
    SB.el._t = setTimeout(() => { if (!SB.on) SB.el.hidden = true; }, reduced ? 0 : 450);
    setInert();
    syncOrbit();
    const f = SB.ret;
    SB.ret = null;
    restoreFocus(f, () => (state.app ? A.title : state.view === 'home' ? E.homeTitle : E.unlock));
  }
  function paintStandby() {
    if (!SB.on) return;
    setText(SB.hm, `${P.hour}:${P.minute}`);
    setText(SB.ap, period());
    setText(SB.date, dateLine(new Date(vnow())));
    setText(SB.sr, localTime());
  }
  function activity(e) {
    SB.last = Date.now();
    if (!SB.on || Date.now() - SB.at < 250) return;         // an echo of what started it
    if (e.type === 'pointermove') {
      if (SB.x == null) { SB.x = e.clientX; SB.y = e.clientY; return; }
      if (Math.hypot(e.clientX - SB.x, e.clientY - SB.y) < 8) return;
    }
    if (e.type === 'keydown' || e.type === 'pointerdown') {
      e.preventDefault();
      e.stopPropagation();
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 500);
    }
    exitStandby();
  }
  for (const type of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) {
    doc.addEventListener(type, activity, { capture: true, passive: type !== 'keydown' && type !== 'pointerdown' });
  }
  doc.addEventListener('visibilitychange', () => { if (!doc.hidden) SB.last = Date.now(); });
  setInterval(() => {
    if (!SB.auto || SB.on || reduced || doc.hidden || Date.now() - SB.last < SB.idleMs) return;
    if (state.view === 'present' || state.view === 'brief') return;   // never in the middle of a talk or a read
    const a = doc.activeElement;
    if (a && (a.tagName === 'IFRAME' || (a.closest && a.closest('input, textarea, select, [contenteditable="true"]')))) return;
    if (TT.open || ED.on || G.id !== null) return;
    enterStandby();
  }, 1000);

  // ---------------------------------------------------------------- the first-visit tour (#119)
  // Three small bubbles, one after the other: unlock, the planets are buttons, Search. Skip,
  // Done or Esc ends it and it is not shown again (ls7-tour, in this browser only); unlocking or
  // opening anything ends it too. It moves no focus until it is used, and a screen reader hears
  // each tip once. ?tour=1, or ">tour" in Search, shows it again.
  const TOUR = [() => E.unlock, () => E.orbit, () => E.searchBtn];
  function startTour(force) {
    clearTimeout(TR.timer);
    if (state.view !== 'lock' || state.sheet || overlay || SB.on || TR.i >= 0) return;
    TR.i = 0;
    paintTour(!!force);
  }
  function paintTour(focus) {
    const c = C().tour;
    const st = c.steps[TR.i];
    const n = TR.i + 1;
    const total = c.steps.length;
    const text = fmt(st.text, { key: searchKey() });
    setText(TR.step, fmt(c.step, { n, total }));
    setText(TR.title, st.title);
    setText(TR.text, text);
    setText(TR.skip, c.skip);
    setText(TR.next, n === total ? c.done : c.next);
    TR.skip.hidden = n === total;
    TR.el.dataset.step = String(TR.i);
    TR.el.hidden = false;
    placeTour();
    setText(TR.live, fmt(c.live, { n, total, title: st.title, text }));
    if (focus) TR.next.focus({ preventScroll: true });
  }
  function placeTour() {
    if (TR.i < 0) return;
    const r = TOUR[TR.i]().getBoundingClientRect();
    const W = innerWidth || 800;
    const H = innerHeight || 600;
    const bw = TR.el.offsetWidth;
    const bh = TR.el.offsetHeight;
    const below = r.top + r.height / 2 < H / 2;
    const top = clamp(below ? r.bottom + 12 : r.top - bh - 12, 8, Math.max(8, H - bh - 8));
    const left = clamp(r.left + r.width / 2 - bw / 2, 12, Math.max(12, W - bw - 12));
    TR.el.classList.toggle('below', below);
    TR.el.style.transform = `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0)`;
    TR.arrow.style.left = `${clamp(r.left + r.width / 2 - left, 18, bw - 18).toFixed(1)}px`;
    // On a phone the bubble that points at Unlock covers the page dots just above it. While they
    // are covered they are inert: nobody tabs to a hidden button or taps the edge of one, and
    // they stop crowding Skip (WCAG 2.5.8, Lighthouse's touch-target check; 2026-11-18).
    const d = E.dots.getBoundingClientRect();
    E.dots.inert = !E.dots.hidden && d.bottom > top && d.top < top + bh && d.right > left && d.left < left + bw;
  }
  function endTour() {
    if (TR.i < 0) return;
    TR.i = -1;
    E.dots.inert = false;
    TR.el.hidden = true;
    setText(TR.live, '');
    store.set('ls7-tour', 'done');
  }

  // ---------------------------------------------------------------- the design rules (#146)
  // Drawn with the page's own styles: each colour is read back from the stylesheet as it is now
  // (dark or light), with its contrast on the page worked out here, so the page cannot drift
  // from what it says. "Play" runs the app-launch motion, slowed for the dot on the curve.
  const SWATCHES = ['bg', 'bg2', 'fg', 'fg2', 'fg3', 'indigo', 'violet', 'teal'];
  const TEXT_SW = ['fg', 'fg2', 'fg3', 'indigo', 'violet', 'teal'];
  function designHTML(t) {
    const why = (x) => `<p class="ds-why">${esc(x)}</p>`;
    const sw = SWATCHES.map((k) => `<li class="ds-sw" data-var="${k}"><span class="ds-chip" data-c="${k}" aria-hidden="true"></span>`
      + `<span class="ds-sw-t"><b>${esc(t.swatches[k])}</b><code class="ds-hex"></code>${TEXT_SW.includes(k) ? '<small class="ds-cr"></small>' : ''}</span></li>`).join('');
    const ty = t.typeSamples;
    return `<p class="ap-sub ds-sub">${esc(t.sub)}</p>`
      + sec(t.colorHead, `<ul class="ds-swatches">${sw}</ul>${why(t.colorWhy)}<p class="ds-note">${esc(t.contrastNote)}</p>`)
      + sec(t.typeHead, `<div class="ds-type"><p class="ds-t-clock" aria-label="${esc(ty[0])}"><span class="hm">${esc(`${P.hour}:${P.minute}`)}</span></p>`
        + `<p class="ds-t-title">${esc(ty[1])}</p><p class="ds-t-body">${esc(ty[2])}</p><p class="ds-t-small">${esc(ty[3])}</p>`
        + `<p class="ds-t-mono"><kbd class="kbd">${esc(searchKey())}</kbd><code>ui-monospace</code></p></div>${why(t.typeWhy)}`)
      + sec(t.shapeHead, `<div class="ds-shapes"><span class="ds-shape ds-sh-card">${esc(t.shapes[0])}</span><span class="ds-shape ds-sh-pill">${esc(t.shapes[1])}</span>`
        + `<span class="ds-shape ds-sh-tile">${icon('storewright')}<small>${esc(t.shapes[2])}</small></span></div>${why(t.shapeWhy)}`)
      + sec(t.cardHead, `<div class="ds-cards"><div class="card ds-card"><b>${esc(t.cardSample)}</b><p>${esc(t.cardText)}</p></div></div>${why(t.cardWhy)}`)
      + sec(t.buttonHead, `<div class="ds-btns"><span class="btn primary">${esc(t.primary)}</span><span class="btn">${esc(t.secondary)}</span></div>${why(t.buttonWhy)}`)
      + sec(t.iconHead, `<div class="ds-icons">${['storewright', 'site', 'vocal', 'how', 'sky', 'guestbook', 'design', 'assets'].map((k) => icon(k, 'ico-sm')).join('')}</div>${why(t.iconWhy)}`)
      + sec(t.motionHead, `<div class="ds-motion"><div class="ds-stage"><span class="ds-tile" id="dsTile">${icon('sky')}</span></div>`
        + '<svg class="ds-curve" viewBox="-8 -8 116 116" aria-hidden="true" focusable="false"><path class="ds-axis" d="M0 100H100M0 100V0"/>'
        + '<path class="ds-bez" d="M0 100C20 20 20 0 100 0"/><circle class="ds-dot" id="dsDot" cx="0" cy="100" r="4"/></svg>'
        + `<button type="button" class="btn" id="dsPlay">${uIco('play')}<span>${esc(t.play)}</span></button></div>`
        + `<p class="ds-note">${esc(t.curve)}</p>${why(t.motionWhy)}<p class="ds-note">${esc(t.reduced)}</p>`);
  }
  const parseRGB = (x) => { const m = String(x).match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/); return m ? [+m[1], +m[2], +m[3]] : null; };
  const toHex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  function luminance(c) {
    const f = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  }
  const contrastRatio = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  function paintDesign() {
    if (appKey !== 'design') return;
    const bg = parseRGB(getComputedStyle(A.view).backgroundColor);
    for (const li of $$('.ds-sw', A.body)) {
      const col = parseRGB(getComputedStyle($('.ds-chip', li)).backgroundColor);
      if (!col) continue;
      setText($('.ds-hex', li), toHex(col));
      const cr = $('.ds-cr', li);
      if (cr && bg) setText(cr, fmt(C().app.design.contrast, { ratio: contrastRatio(col, bg).toFixed(1) }));
    }
  }
  function playMotion() {
    const tile = $('#dsTile', A.body);
    const dot = $('#dsDot', A.body);
    if (!tile) return;
    for (const an of tile.getAnimations().concat(dot ? dot.getAnimations() : [])) an.cancel();
    if (reduced) { tile.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 }); return; }
    tile.animate([{ transform: 'scale(.96)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 200, easing: 'cubic-bezier(.2,.8,.2,1)' });
    if (!dot) return;
    // the dot rides the curve: across is time, up is how far the motion has got (slowed 4 times)
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const s = i / 24;
      const u = 1 - s;
      const x = 3 * u * u * s * 20 + 3 * u * s * s * 20 + s * s * s * 100;
      const y = u * u * u * 100 + 3 * u * u * s * 20;
      pts.push({ transform: `translate(${x.toFixed(2)}px, ${(y - 100).toFixed(2)}px)`, offset: Math.min(1, x / 100) });
    }
    for (let i = 1; i < pts.length; i++) if (pts[i].offset < pts[i - 1].offset) pts[i].offset = pts[i - 1].offset;
    dot.animate(pts, { duration: 800, easing: 'linear', fill: 'forwards' });
  }

  // ---------------------------------------------------------------- what I use (#153)
  function usesHTML(t) {
    const u = D.uses;
    if (!u) return '';
    return `<p class="ap-sub uses-sub">${esc(t.sub)}</p>${u.draft ? `<p class="preview-note">${esc(t.draft)}</p>` : ''}`
      + u.groups.map((g) => sec(g[lang], `<ul class="sp-chips uses-chips">${g.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`)).join('');
  }

  // ---------------------------------------------------------------- assets (#172) and wallpapers (#145, #172)
  // Icons, screenshots and descriptions to take away (the pictures are the ones already in the
  // page; the descriptions are the page's own words), and wallpapers drawn here on a canvas and
  // saved as PNG: today's sky (the planets where they really are, the Moon beside Earth, the Sun
  // or my avatar in the middle; the choice is remembered in this browser) and each project's own
  // colours. Nothing is fetched to make them.
  const WP_SIZES = { desktop: [3840, 2160], phone: [1179, 2556], tablet: [2048, 2732] };
  const WP = { centre: store.get('ls7-wp-centre') === 'avatar' ? 'avatar' : 'sun', today: 'phone', project: 'dusk', device: 'desktop', av: null };
  // tokens.json (Dusk Tech, dark); SilNest's icon (#101012 and #c8b9a6); Storewright's interface
  // (#f4f5f2, ink #22272b) with its green, blue and orange (#2f7d55, #3f7fb8, #ee8a35)
  const PALETTES = {
    dusk: { bg: '#08090c', dot: [255, 255, 255, 0.12], glows: [[[90, 76, 242], 0.4], [[139, 92, 246], 0.2], [[18, 181, 162], 0.24]], ring: [255, 255, 255, 0.34], ink: [247, 248, 248, 0.55] },
    silnest: { bg: '#101012', dot: [200, 185, 166, 0.12], glows: [[[200, 185, 166], 0.22], [[200, 185, 166], 0.12], [[200, 185, 166], 0.09]], ring: [200, 185, 166, 0.42], ink: [200, 185, 166, 0.62] },
    storewright: { bg: '#f4f5f2', dot: [34, 39, 43, 0.13], glows: [[[47, 125, 85], 0.24], [[63, 127, 184], 0.2], [[238, 138, 53], 0.24]], ring: [34, 39, 43, 0.4], ink: [34, 39, 43, 0.58] },
  };
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
  function avatarImage() {
    if (!WP.av) {
      const im = $('.av-img', E.orbit);
      const img = new Image();
      img.src = im ? im.getAttribute('href') : '';
      WP.av = img.decode().then(() => img);
    }
    return WP.av;
  }
  /** One wallpaper on a canvas of w x h pixels. o: {pal, planets, centre ('sun', 'avatar' or 'glow'), t, stamp}. */
  async function drawWallpaper(cv, w, h, o) {
    const av = o.centre === 'avatar' ? await avatarImage() : null;
    const g = cv.getContext('2d');
    const pal = PALETTES[o.pal];
    const land = w > h;
    const big = 1.7;                                                      // planets drawn larger than on the banner, to read at wallpaper size
    const S = Math.min(w, h);
    const k = (land ? h * 0.8 : w * 0.46) / ORB[ORB.length - 1][0];          // banner units to pixels
    const cx = w / 2;
    const cy = land ? h * 0.5 : h * 0.54;
    const tilt = ORB[0][2] * D2R;
    g.fillStyle = pal.bg;
    g.fillRect(0, 0, w, h);
    // three glows round the orbit, where the banner has them
    [[20, -42, 270], [-120, 90, 190], [205, 140, 210]].forEach(([dx, dy, r], i) => {
      const [col, a] = pal.glows[i];
      const x = cx + dx * k;
      const y = cy + dy * k;
      const rr = r * k;
      const gr = g.createRadialGradient(x, y, 0, x, y, rr);
      gr.addColorStop(0, rgba(col, a));
      gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr;
      g.fillRect(x - rr, y - rr, 2 * rr, 2 * rr);
    });
    // the dot grid, fading out from the orbit (the page's mask: full, 55% at 0.55 of the way, none at the edge)
    const pitch = Math.max(12, S / 42);
    const R = 430 * k;
    const dotR = Math.max(0.7, pitch * 0.045);
    for (let y = pitch / 2; y < h; y += pitch) {
      for (let x = pitch / 2; x < w; x += pitch) {
        const d = Math.hypot(x - cx, y - cy) / R;
        if (d >= 1) continue;
        const f = d < 0.55 ? 1 - (0.45 * d) / 0.55 : (0.55 * (1 - d)) / 0.45;
        g.fillStyle = rgba(pal.dot, pal.dot[3] * f);
        g.beginPath();
        g.arc(x, y, dotR, 0, 2 * Math.PI);
        g.fill();
      }
    }
    // the rings, fainter on the far side
    const lw = Math.max(1, S / 760);
    ORB.forEach(([rx, ry], i) => {
      const a = pal.ring[3] * (0.3 + (0.16 * i) / (ORB.length - 1));
      const ext = (ry + rx * Math.abs(Math.sin(tilt))) * k;
      const gr = g.createLinearGradient(0, cy - ext, 0, cy + ext);
      gr.addColorStop(0, rgba(pal.ring, a * 0.38));
      gr.addColorStop(0.55, rgba(pal.ring, a * 0.62));
      gr.addColorStop(1, rgba(pal.ring, a));
      g.strokeStyle = gr;
      g.lineWidth = lw;
      g.beginPath();
      g.ellipse(cx, cy, rx * k, ry * k, tilt, 0, 2 * Math.PI);
      g.stroke();
    });
    // the planets where they really are at o.t (#145), drawn behind or in front of the middle
    const onScreen = (x, y) => [cx + (x * Math.cos(tilt) - y * Math.sin(tilt)) * k, cy + (x * Math.sin(tilt) + y * Math.cos(tilt)) * k];
    let near = [];
    if (o.planets) {
      const th = Astro.planetLongitudes(o.t);
      const items = ORB.map(([rx, ry], i) => {
        const a = th[i] * D2R;
        const x = rx * Math.cos(a);
        const y = -ry * Math.sin(a);
        return { i, p: onScreen(x, y), y };
      });
      items.filter((it) => it.y <= 0).forEach((it) => drawPlanet(g, it, k, o.t, big));
      near = items.filter((it) => it.y > 0);
    }
    // the middle: the Sun, my avatar as the sun, or a soft glow in the project's colour
    const glowR = 70 * k;
    if (o.centre === 'glow') {
      const [col] = pal.glows[0];
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, glowR);
      gr.addColorStop(0, rgba(col, 0.55));
      gr.addColorStop(0.45, rgba(col, 0.18));
      gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr;
      g.fillRect(cx - glowR, cy - glowR, 2 * glowR, 2 * glowR);
      g.strokeStyle = rgba(pal.ring, pal.ring[3] * 0.9);
      g.lineWidth = lw;
      g.beginPath();
      g.arc(cx, cy, 34 * k, 0, 2 * Math.PI);
      g.stroke();
    } else {
      const sun = g.createRadialGradient(cx, cy, 0, cx, cy, glowR);
      sun.addColorStop(0, 'rgba(255,211,160,.19)');
      sun.addColorStop(0.2, 'rgba(144,149,255,.29)');
      sun.addColorStop(0.55, 'rgba(182,156,255,.14)');
      sun.addColorStop(1, 'rgba(182,156,255,0)');
      g.fillStyle = sun;
      g.fillRect(cx - glowR, cy - glowR, 2 * glowR, 2 * glowR);
      if (av) {
        const r = 34 * k;
        g.save();
        g.beginPath();
        g.arc(cx, cy, r, 0, 2 * Math.PI);
        g.clip();
        g.fillStyle = '#0f1116';
        g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
        g.drawImage(av, cx - r, cy - r, 2 * r, 2 * r);
        g.restore();
        const edge = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
        edge.addColorStop(0, '#9095ff');
        edge.addColorStop(1, '#4fe0c8');
        g.strokeStyle = edge;
        g.lineWidth = Math.max(1.5, 1.2 * k);
        g.beginPath();
        g.arc(cx, cy, r, 0, 2 * Math.PI);
        g.stroke();
      } else {
        const r = 30 * k;
        const core = g.createRadialGradient(cx - r * 0.25, cy - r * 0.3, 0, cx, cy, r);
        core.addColorStop(0, '#fffaf0');
        core.addColorStop(0.45, '#ffd98a');
        core.addColorStop(0.85, '#f6a54a');
        core.addColorStop(1, '#e98a3a');
        const halo = g.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 2.4);
        halo.addColorStop(0, 'rgba(255,196,110,.45)');
        halo.addColorStop(1, 'rgba(255,196,110,0)');
        g.fillStyle = halo;
        g.fillRect(cx - r * 2.4, cy - r * 2.4, r * 4.8, r * 4.8);
        g.fillStyle = core;
        g.beginPath();
        g.arc(cx, cy, r, 0, 2 * Math.PI);
        g.fill();
      }
    }
    near.forEach((it) => drawPlanet(g, it, k, o.t, big));
    // the small print, bottom right
    if (o.stamp) {
      g.font = `500 ${Math.max(1, S * 0.017).toFixed(2)}px ${getComputedStyle(body).fontFamily}`;
      g.textAlign = 'right';
      g.textBaseline = 'alphabetic';
      g.fillStyle = rgba(pal.ink, pal.ink[3]);
      g.fillText(o.stamp, w - S * 0.045, h - S * 0.045);
    }
  }
  /** One planet (and Saturn's ring, Earth's Moon), lit from the upper left as on the page. */
  function drawPlanet(g, it, k, t, big = 1) {
    const [x, y] = it.p;
    const name = NAMES[it.i];
    const col = D.planetColors[it.i];
    const r = D.planetR[it.i] * k * big;
    const halo = g.createRadialGradient(x, y, 0, x, y, r * 2.6);
    halo.addColorStop(0, `${col}33`);
    halo.addColorStop(1, `${col}00`);
    g.fillStyle = halo;
    g.fillRect(x - r * 2.6, y - r * 2.6, r * 5.2, r * 5.2);
    const ring = (front) => {
      g.save();
      g.translate(x, y);
      g.rotate(-20 * D2R);
      g.strokeStyle = `${col}b3`;
      g.lineWidth = Math.max(1, 1.4 * k * 0.6);
      g.beginPath();
      g.ellipse(0, 0, 11 * k * big, 3.6 * k * big, 0, front ? 0 : Math.PI, front ? Math.PI : 2 * Math.PI);
      g.stroke();
      g.restore();
    };
    if (name === 'saturn') ring(false);
    g.fillStyle = col;
    g.beginPath();
    g.arc(x, y, r, 0, 2 * Math.PI);
    g.fill();
    const sh = g.createRadialGradient(x - r * 0.28, y - r * 0.4, 0, x - r * 0.28, y - r * 0.4, r * 1.56);
    sh.addColorStop(0, 'rgba(255,255,255,.5)');
    sh.addColorStop(0.42, 'rgba(255,255,255,0)');
    sh.addColorStop(1, 'rgba(0,0,0,.22)');
    g.fillStyle = sh;
    g.beginPath();
    g.arc(x, y, r, 0, 2 * Math.PI);
    g.fill();
    if (name === 'saturn') ring(true);
    if (name === 'earth') {
      g.strokeStyle = 'rgba(79,224,200,.5)';
      g.lineWidth = Math.max(1, 0.9 * k * 0.5);
      g.beginPath();
      g.arc(x, y, r, 0, 2 * Math.PI);
      g.stroke();
      // the Moon beside Earth, on the side the real geometry puts it, lit as on the night
      const m = Astro.moonPhase(t);
      const [erx, ery] = ORB[EARTH];
      const phi = (Astro.planetLongitudes(t)[EARTH] + 180 + m.elong) * D2R;
      const vx = Math.cos(phi);
      const vy = -(ery / erx) * Math.sin(phi);
      const len = Math.hypot(vx, vy) || 1;
      const tilt = ORB[0][2] * D2R;
      const ox = (vx / len) * 9 * k * big;
      const oy = (vy / len) * 9 * k * big;
      const mx = x + ox * Math.cos(tilt) - oy * Math.sin(tilt);
      const my = y + ox * Math.sin(tilt) + oy * Math.cos(tilt);
      const mr = D.moonR * k * big;
      g.fillStyle = '#2c3147';
      g.beginPath();
      g.arc(mx, my, mr, 0, 2 * Math.PI);
      g.fill();
      const lit = Astro.moonPhasePath(0, 0, mr, m.illum, m.waxing);
      if (lit) {
        g.save();
        g.translate(mx, my);
        g.fillStyle = '#f3f1e8';
        g.fill(new Path2D(lit));
        g.restore();
      }
    }
  }
  const wpStamp = () => host(String(D.facts.links.pages || ''));
  const wpOpts = (which) => (which === 'today'
    ? { pal: 'dusk', planets: true, centre: WP.centre, t: vnow(), stamp: `${wpStamp()} · ${whenLong(albanyISO(new Date(vnow())))}` }
    : { pal: WP.project, planets: false, centre: 'glow', t: vnow(), stamp: WP.project === 'dusk' ? wpStamp() : `${C().app.assets.projects[WP.project]} · ${wpStamp()}` });
  function assetsHTML(t, c) {
    const sn = c.app.silnest;
    const sw = c.app.storewright;
    const dl = (key, file) => `<button type="button" class="btn as-dl" data-dl="${key}" data-file="${file}">${uIco('save')}<span>${esc(t.download)}</span></button>`;
    const text = (id, label, x) => `<div class="as-text"><p class="as-l" id="${id}L">${esc(label)}</p><p class="as-t" id="${id}">${esc(x)}</p>`
      + `<button type="button" class="btn as-copy" data-copy="${id}" aria-describedby="${id}L">${uIco('copy')}<span>${esc(t.copy)}</span></button></div>`;
    const fig = (k, file, alt, cls) => `<figure class="as-fig"><div class="${cls} img-${k}" role="img" aria-label="${esc(alt)}"></div>${dl(k, file)}</figure>`;
    const radio = (group, v, label, on) => `<button type="button" role="radio" data-wp="${group}" data-v="${v}" aria-checked="${on}" tabindex="${on ? 0 : -1}">${esc(label)}</button>`;
    const project = (name, body_) => `<section class="tv-sec as-proj"><h3 class="tv-head">${esc(name)}</h3><div class="tv as-card">${body_}<p class="sky-note as-msg" role="status"></p></div></section>`;
    return head('assets', t.title, t.sub)
      + project(c.appNames.silnest,
        `<div class="as-row"><span class="ico ico-img img-sn-icon as-icon" aria-hidden="true"></span><div class="as-meta"><p class="as-l">${esc(t.icon)}</p>`
        + `<p class="as-n">${esc(fmt(t.px, { w: 512, h: 512 }))}</p>${dl('sn-icon', 'silnest-icon-512.jpg')}</div></div>`
        + `<div class="as-row as-col"><p class="as-l">${esc(t.shots)}</p><div class="as-figs">${fig('sn-s1', 'silnest-screenshot-1.jpg', sn.shots[0], 'shot')}${fig('sn-s6', 'silnest-screenshot-2.jpg', sn.shots[1], 'shot')}</div></div>`
        + text('asSnLine', t.oneLine, c.alts.silnest) + text('asSnLong', t.long, `${sn.desc} ${sn.desc2}`)
        + `<div class="as-row as-links">${linkBtn(sn.get, D.facts.storeUrl)}</div>`)
      + project(c.appNames.storewright,
        `<div class="as-row">${icon('storewright', 'as-icon')}<div class="as-meta"><p class="as-l">${esc(t.icon)}</p>`
        + `<p class="as-n">${esc(fmt(t.swIcon, { n: 512 }))}</p>${dl('sw-icon', 'storewright-icon-512.png')}</div></div>`
        + `<div class="as-row as-col"><p class="as-l">${esc(t.shots)}</p><div class="as-figs as-wide">${fig('sw-demo', 'storewright-showcase.jpg', sw.shot, 'pic')}${fig('sw-world', 'storewright-world.jpg', t.swWorld, 'pic')}</div></div>`
        + text('asSwLine', t.oneLine, sw.sub) + text('asSwLong', t.long, `${sw.sub} ${sw.three.join(' ')}`)
        + `<div class="as-row as-links">${linkBtn(c.linkKinds.demo, D.facts.sw.demo)}${linkBtn(c.linkKinds.repo, D.facts.sw.repo)}</div>`)
      + `<section class="tv-sec as-wp"><h3 class="tv-head" id="wpHead" tabindex="-1">${esc(t.wpHead)}</h3><p class="tv-foot as-wp-sub">${esc(t.wpSub)}</p>`
      + `<div class="tv as-card wp-card" id="wpToday"><div class="wp-in"><div class="wp-frame"><canvas class="wp-prev" id="wpTodayCv" role="img"></canvas></div><div class="wp-ctl">`
      + `<h4 class="wp-h">${esc(t.todayHead)}</h4><p class="wp-sub">${esc(t.todaySub)}</p>`
      + `<p class="as-l" id="wpMidL">${esc(t.middle)}</p><div class="seg" role="radiogroup" aria-labelledby="wpMidL">${radio('centre', 'sun', t.sun, WP.centre === 'sun')}${radio('centre', 'avatar', t.avatar, WP.centre === 'avatar')}</div>`
      + `<p class="as-l" id="wpTodayL">${esc(t.size)}</p><div class="seg" role="radiogroup" aria-labelledby="wpTodayL">${radio('today', 'phone', t.devices.phone, WP.today === 'phone')}${radio('today', 'desktop', t.devices.desktop, WP.today === 'desktop')}</div>`
      + '<p class="wp-dims" id="wpTodayDims"></p>'
      + `<button type="button" class="btn primary" id="wpTodayDl">${uIco('save')}<span>${esc(t.download)}</span></button><p class="sky-note" id="wpTodayNote" role="status"></p>`
      + '</div></div></div>'
      + `<div class="tv as-card wp-card" id="wpProj"><div class="wp-in"><div class="wp-frame"><canvas class="wp-prev" id="wpProjCv" role="img"></canvas></div><div class="wp-ctl">`
      + `<h4 class="wp-h">${esc(t.palettesHead)}</h4><p class="wp-sub">${esc(t.palettesSub)}</p>`
      + `<p class="as-l" id="wpProjL">${esc(t.project)}</p><div class="seg" role="radiogroup" aria-labelledby="wpProjL">${['dusk', 'silnest', 'storewright'].map((v) => radio('project', v, t.projects[v], WP.project === v)).join('')}</div>`
      + `<p class="as-l" id="wpDevL">${esc(t.device)}</p><div class="seg" role="radiogroup" aria-labelledby="wpDevL">${['desktop', 'phone', 'tablet'].map((v) => radio('device', v, t.devices[v], WP.device === v)).join('')}</div>`
      + '<p class="wp-dims" id="wpProjDims"></p>'
      + `<button type="button" class="btn primary" id="wpProjDl">${uIco('save')}<span>${esc(t.download)}</span></button><p class="sky-note" id="wpProjNote" role="status"></p>`
      + '</div></div></div></section>';
  }
  /** The two previews, at the shape of the size chosen (drawn small, the same drawing). */
  function paintWallpapers() {
    if (appKey !== 'assets') return;
    const t = C().app.assets;
    for (const which of ['today', 'project']) {
      const cv = $(which === 'today' ? '#wpTodayCv' : '#wpProjCv', A.body);
      if (!cv) continue;
      const dev = which === 'today' ? WP.today : WP.device;
      const [W, H] = WP_SIZES[dev];
      const scale = Math.min(250 / W, 230 / H);
      const cw = Math.round(W * scale);
      const ch = Math.round(H * scale);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(cw * dpr);
      cv.height = Math.round(ch * dpr);
      cv.style.width = `${cw}px`;
      cv.style.height = `${ch}px`;
      const what = which === 'today' ? t.todayHead : t.projects[WP.project];
      cv.setAttribute('aria-label', fmt(t.previewAlt, { what, w: W, h: H }));
      setText($(which === 'today' ? '#wpTodayDims' : '#wpProjDims', A.body), fmt(t.dims, { w: W, h: H }));
      drawWallpaper(cv, cv.width, cv.height, wpOpts(which)).catch(() => { /* the preview stays empty; saving says so */ });
    }
  }
  function wpRadio(b, focus) {
    WP[b.dataset.wp] = b.dataset.v;
    if (b.dataset.wp === 'centre') store.set('ls7-wp-centre', WP.centre);
    for (const x of $$('[role="radio"]', b.closest('[role="radiogroup"]'))) {
      const on = x === b;
      x.setAttribute('aria-checked', String(on));
      x.tabIndex = on ? 0 : -1;
    }
    if (focus) b.focus();
    paintWallpapers();
  }
  function saveBlob(blob, file) {
    const a = doc.createElement('a');
    a.download = file;
    a.href = URL.createObjectURL(blob);
    a.hidden = true;
    A.view.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  }
  /** A data: URI (the pictures already in the page) as a Blob, without the network. */
  function dataUriBlob(uri) {
    const comma = uri.indexOf(',');
    const mime = (uri.slice(5, comma).split(';')[0]) || 'application/octet-stream';
    const bin = atob(uri.slice(comma + 1));
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }
  /** Storewright's tile from the README and this page, as a square PNG (dark tile, line glyph). */
  function storewrightIcon(n) {
    const cv = doc.createElement('canvas');
    cv.width = n;
    cv.height = n;
    const g = cv.getContext('2d');
    const r = n * 0.25;
    const shape = new Path2D();
    shape.moveTo(r, 0);
    shape.arcTo(n, 0, n, n, r);
    shape.arcTo(n, n, 0, n, r);
    shape.arcTo(0, n, 0, 0, r);
    shape.arcTo(0, 0, n, 0, r);
    shape.closePath();
    const fill = g.createLinearGradient(0, 0, 0, n);
    fill.addColorStop(0, '#1a1d27');
    fill.addColorStop(1, '#0c0d11');
    g.fillStyle = fill;
    g.fill(shape);
    const glow = g.createRadialGradient(n * 0.28, 0, 0, n * 0.28, 0, n * 0.7);
    glow.addColorStop(0, 'rgba(124,127,255,.26)');
    glow.addColorStop(1, 'rgba(124,127,255,0)');
    g.save();
    g.clip(shape);
    g.fillStyle = glow;
    g.fillRect(0, 0, n, n);
    g.restore();
    const edge = g.createLinearGradient(0, 0, n, n);
    edge.addColorStop(0, 'rgba(255,255,255,.2)');
    edge.addColorStop(0.45, 'rgba(255,255,255,.06)');
    edge.addColorStop(1, 'rgba(255,255,255,.09)');
    g.strokeStyle = edge;
    g.lineWidth = n / 60;
    g.stroke(shape);
    const d = ($('#g-storewright path') || { getAttribute: () => '' }).getAttribute('d');
    const s = (n * 0.467) / 24;
    g.save();
    g.translate((n - 24 * s) / 2, (n - 24 * s) / 2);
    g.scale(s, s);
    const ink = g.createLinearGradient(3, 3, 21, 21);
    ink.addColorStop(0, '#9095ff');
    ink.addColorStop(1, '#4fe0c8');
    g.strokeStyle = ink;
    g.lineWidth = 1.6;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.stroke(new Path2D(d));
    g.restore();
    return cv;
  }
  function downloadAsset(btn) {
    const t = C().app.assets;
    const note = $('.as-msg', btn.closest('.as-card'));
    const file = btn.dataset.file;
    const key = btn.dataset.dl;
    const done = () => setText(note, fmt(t.saved, { file }));
    const fail = () => setText(note, t.saveFail);
    if (key === 'sw-icon') {
      storewrightIcon(512).toBlob((b) => { if (b) { saveBlob(b, file); done(); } else fail(); }, 'image/png');
      return;
    }
    const el = $(`.img-${key}`, A.body);
    const m = el && getComputedStyle(el).backgroundImage.match(/url\("?(data:[^")]+)"?\)/);
    if (!m) { fail(); return; }
    // #180: the page carries most photos as WebP (pages/build.py --webp); what is saved is the
    // JPEG file its name promises, drawn from that copy at quality 0.92
    if (/^data:image\/webp[;,]/.test(m[1])) {
      const img = new Image();
      img.onload = () => {
        const cv = doc.createElement('canvas');
        cv.width = img.naturalWidth;
        cv.height = img.naturalHeight;
        const g = cv.getContext('2d');
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, cv.width, cv.height);
        g.drawImage(img, 0, 0);
        cv.toBlob((b) => { if (b) { saveBlob(b, file); done(); } else fail(); }, 'image/jpeg', 0.92);
      };
      img.onerror = fail;
      img.src = m[1];
      return;
    }
    try { saveBlob(dataUriBlob(m[1]), file); done(); } catch (e) { fail(); }
  }
  async function saveWallpaper(which) {
    const t = C().app.assets;
    const note = $(which === 'today' ? '#wpTodayNote' : '#wpProjNote', A.body);
    const dev = which === 'today' ? WP.today : WP.device;
    const [w, h] = WP_SIZES[dev];
    const o = wpOpts(which);
    const cv = doc.createElement('canvas');
    cv.width = w;
    cv.height = h;
    try { await drawWallpaper(cv, w, h, o); } catch (e) { setText(note, t.saveFail); return; }
    const file = which === 'today' ? `wallpaper-sky-${albanyISO(new Date(o.t))}-${dev}-${w}x${h}.png` : `wallpaper-${WP.project}-${dev}-${w}x${h}.png`;
    cv.toBlob((blob) => {
      if (!blob) { setText(note, t.saveFail); return; }
      saveBlob(blob, file);
      setText(note, fmt(t.saved, { file }));
    }, 'image/png');
  }
  function assetsClick(t) {
    const r = t.closest('[data-wp]');
    if (r) { wpRadio(r, false); return true; }
    const d = t.closest('[data-dl]');
    if (d) { downloadAsset(d); return true; }
    const cp = t.closest('[data-copy]');
    if (cp) {
      const tt = C().app.assets;
      const note = $('.as-msg', cp.closest('.as-card'));
      copyText($(`#${cp.dataset.copy}`, A.body).textContent, () => setText(note, tt.copied), () => setText(note, tt.copyFail), cp);
      return true;
    }
    if (t.closest('#wpTodayDl')) { saveWallpaper('today'); return true; }
    if (t.closest('#wpProjDl')) { saveWallpaper('project'); return true; }
    return false;
  }
  A.body.addEventListener('keydown', (e) => {
    if (appKey !== 'assets') return;
    const b = e.target.closest && e.target.closest('[data-wp]');
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!b || !step) return;
    const items = $$('[role="radio"]', b.closest('[role="radiogroup"]'));
    e.preventDefault();
    wpRadio(items[(items.indexOf(b) + step + items.length) % items.length], true);
  });

  // ================================================================ R3.3 batch 3: the work and recruiters
  // #97 the sun glow follows Albany's sky; How I work gets the FAQ (#53), one real change (#156),
  // the skill map (#110) and the timeline (#111); the project pages say who did what (#157) and
  // list their numbers (#158); Contact gets "Ask me about" (#113) and the public resumes (#66);
  // the quick view at #brief (#154) and present mode at #present (#155); and the Storewright pick
  // game (#121). The user confirmed the FAQ, the roles, the skill map and the topics on 2026-11-15
  // (profile.json's "pending" is empty).

  // ---------------------------------------------------------------- the sun glow (#97)
  // The core of the glow behind the avatar takes the colour of Albany's sky, in the four steps
  // the README's live banner uses (pages/build.py SUN_TIERS: night, twilight, low, day), from the
  // Sun's altitude there (live/astro.mjs). It follows time travel, as every clock here does.
  const ALB = cityById('albany');
  function paintSun(t = vnow()) {
    const alt = Astro.observe('sun', t, ALB.lat, ALB.lon).alt;
    let i = D.sunTiers.findIndex((lim) => alt < lim);
    if (i < 0) i = D.sunTiers.length;
    if (root.dataset.sun !== D.sunNames[i]) root.dataset.sun = D.sunNames[i];
  }

  // ---------------------------------------------------------------- How I work: FAQ (#53), one real change (#156)
  // The FAQ is plain question and answer cards under an "FAQ" heading (no chat-app look), from
  // profile.json "faq".
  function faqHTML(t) {
    if (!D.faq.length) return '';
    const pairs = D.faq.map((f) => `<div class="faq-pair"><dt class="faq-q"><span class="sr-only">${esc(t.faqQ)}: </span>${esc(f.q[lang])}</dt>`
      + `<dd class="faq-a"><span class="sr-only">${esc(t.faqA)}: </span>${esc(f.a[lang])}</dd></div>`).join('');
    return `<section class="tv-sec faq" id="faq"><h3 class="tv-head">${esc(t.faqHead)}</h3><p class="faq-note">${esc(t.faqNote)}</p><dl class="faq-list">${pairs}</dl></section>`;
  }
  // #156: one real change, step by step (the user confirmed on 2026-11-15 that it is true and may
  // be published). The example (copy.json app.how.steps) is examples 1 and 7 of
  // resume_2026-11/我和AI怎么分工_候选例子.md, told in that file's own words: the bar I set, the
  // bug I found while checking, what Claude Code did, the test, the commit. Every step links to
  // the public Storewright repository; nothing from the session logs is quoted.
  function changeHTML(t) {
    const steps = t.steps || [];
    if (!steps.length) return '';
    const li = steps.map((s, i) => `<li class="ch-step" data-i="${i}"><span class="ch-dot" aria-hidden="true"></span><p class="ch-k"><b>${esc(s.k)}</b>`
      + `<span class="ch-when">${esc(whenShort(s.when))}</span></p><p class="ch-t">${esc(s.text)}</p>`
      + `<a class="ch-link" href="${esc(s.href)}" target="_blank" rel="noopener noreferrer">${esc(s.link)}<span class="sr-only">${esc(C().newTab)}</span><span aria-hidden="true"> ↗</span></a></li>`).join('');
    return `<section class="tv-sec" id="change"><h3 class="tv-head">${esc(t.changeHead)}</h3><div class="tv ch-card"><p class="tv-p ch-intro">${esc(t.changeIntro)}</p>`
      + `<ol class="ch-list">${li}</ol></div></section>`;
  }

  // ---------------------------------------------------------------- the skill map (#110)
  // The README's constellations (out/skills-*.svg) as HTML: one per lane, a star per skill, the
  // brighter the more of my projects used it (the count is the only measure), the stars joined
  // down the first column and back up the second. The lines are drawn once the page has laid the
  // stars out, and again when it is resized.
  const LANES = ['software', 'creative', 'product'];
  const projName = (t, k) => (t.projectNames && t.projectNames[k]) || C().appNames[k] || k;
  function skillsHTML(t) {
    const rows = D.skillsMap;
    if (!rows.length) return '';
    const most = Math.max(...rows.map((r) => r.projects.length));
    const lanes = LANES.filter((k) => rows.some((r) => r.lane === k)).concat([...new Set(rows.map((r) => r.lane))].filter((k) => !LANES.includes(k)));
    const html = lanes.map((k) => {
      const items = rows.filter((r) => r.lane === k);
      const stars = items.map((r) => `<li class="sk-star${r.projects.length === most ? ' top' : ''}" style="--b:${(r.projects.length / most).toFixed(3)}"><i class="sk-dot" aria-hidden="true"></i>`
        + `<span class="sk-name">${esc((t.skillNames && t.skillNames[r.skill]) || r.skill)}</span>`
        + `<span class="sk-proj">${esc(r.projects.map((p) => projName(t, p)).join(lang === 'zh' ? '、' : ', '))}</span></li>`).join('');
      const li = LANES.indexOf(k);
      return `<div class="sk-lane sk-${esc(k)}${items.length > 5 ? ' two' : ''}"><h4 class="sk-head"><i aria-hidden="true"></i>${esc(li >= 0 ? C().lanes[li] : k)}</h4>`
        + `<div class="sk-sky"><svg class="sk-lines" aria-hidden="true" focusable="false"><path/></svg><ul class="sk-list">${stars}</ul></div></div>`;
    }).join('');
    const counts = [...new Set(rows.map((r) => r.projects.length))].sort((a, b) => a - b);
    const key = counts.map((n) => `<span class="sk-k" style="--b:${(n / most).toFixed(3)}"><i class="sk-dot" aria-hidden="true"></i>${esc(n === 1 ? t.skillsOne : fmt(t.skillsMany, { n }))}</span>`).join('');
    return `<section class="tv-sec" id="skills"><h3 class="tv-head">${esc(t.skillsHead)}</h3><div class="tv sk-card"><div class="sk-map">${html}</div>`
      + `<p class="sk-key">${key}<span class="sk-bright">${esc(t.skillsBright)}</span></p></div><p class="tv-foot">${esc(t.skillsNote)}</p></section>`;
  }
  function paintSkills() {
    for (const sky of $$('.sk-sky', A.body)) {
      const box = sky.getBoundingClientRect();
      if (!box.width) continue;
      const cols = [];
      for (const d of $$('.sk-dot', sky)) {
        const r = d.getBoundingClientRect();
        const p = [r.left + r.width / 2 - box.left, r.top + r.height / 2 - box.top];
        let c = cols.find((x) => Math.abs(x.x - p[0]) < 40);
        if (!c) { c = { x: p[0], pts: [] }; cols.push(c); }
        c.pts.push(p);
      }
      cols.sort((a, b) => a.x - b.x);
      const path = cols.flatMap((c, i) => (i % 2 ? c.pts.slice().reverse() : c.pts));
      const svg = $('.sk-lines', sky);
      svg.setAttribute('viewBox', `0 0 ${box.width.toFixed(1)} ${box.height.toFixed(1)}`);
      $('path', svg).setAttribute('d', path.length > 1 ? `M${path.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L')}` : '');
    }
  }

  // ---------------------------------------------------------------- the timeline (#111)
  // The README's timeline (out/timeline-*.svg), drawn for the width it has: a thin axis over the
  // months, a dot where each project started (mid-month, the dates are months), a bar for one that
  // ended, a ring for today; labels above the axis, or below, in as many rows as the width needs.
  const TL_INK = { silnest: 'violet', site: 'teal', vocal: 'warm', storewright: 'indigo' };
  let measureCtx = null;
  function textW(s, font) {
    if (!measureCtx) measureCtx = doc.createElement('canvas').getContext('2d');
    measureCtx.font = font;
    return measureCtx.measureText(s).width;
  }
  /** "Oct 19 to Nov 9, 2026", "Oct to Nov 2026", "2026年10月至11月": two ISO dates or months. */
  function spanText(a, b) {
    const o = isMonth(a) ? { month: 'short' } : { month: 'short', day: 'numeric' };
    const y = { ...o, year: 'numeric' };
    const same = a.slice(0, 4) === b.slice(0, 4);
    return lang === 'zh' ? fmt(C().work.span, { from: fmtDate(a, y), to: fmtDate(b, same ? o : y) })
      : fmt(C().work.span, { from: fmtDate(a, same ? o : y), to: fmtDate(b, y) });
  }
  const timelineHTML = (t) => (D.timeline.length ? `<section class="tv-sec" id="timeline"><h3 class="tv-head">${esc(t.tlHead)}</h3><div class="tv tl-card"><div class="tl" id="tl"></div></div></section>` : '');
  function paintTimeline() {
    const box = $('#tl', A.body);
    if (!box) return;
    const t = C().app.how;
    const W = Math.max(260, Math.round(box.clientWidth || 640));
    const items = D.timeline.map((r) => ({ key: r.project, name: projName(t, r.project), from: r.from, to: r.to || null }));
    const [ty, tm, td] = isoParts(albanyISO());
    const y0 = Number(items[0].from.slice(0, 4));
    let end = ty * 12 + tm - 1;
    for (const it of items) if (it.to) { const [y, m] = isoParts(it.to); end = Math.max(end, y * 12 + m - 1); }
    const months = end - y0 * 12 + 2;                          // January of the first year to the month after the last
    const left = 14;
    const right = W - 14;
    const unit = (right - left) / months;
    const xm = (y, m, f = 0) => left + ((y - y0) * 12 + m - 1 + f) * unit;
    const sans = getComputedStyle(body).fontFamily;
    const fName = `650 12.5px ${sans}`;
    const fWhen = `500 11px ${sans}`;
    const placed = [];
    const free = (side, row, a, b) => !placed.some((p) => p.side === side && p.row === row && a < p.b && p.a < b);
    for (const it of items) {
      const [fy, fm] = isoParts(it.from);
      it.when = it.to ? spanText(it.from, it.to) : fmtDate(it.from, { month: 'short', year: 'numeric' });
      it.nw = textW(it.name, fName);
      const lw = it.nw + 7 + textW(it.when, fWhen) + 6;
      if (it.to) {
        const [ey, em] = isoParts(it.to);
        it.x0 = xm(fy, fm, 0.1);
        it.x1 = xm(ey, em, 0.9);
        it.x = it.x0 + 3;
      } else it.x = xm(fy, fm, 0.5);
      it.lx = Math.max(left, Math.min(it.x + 5, right - lw));
      for (let k = 0; ; k++) {
        const side = k % 2 ? 'down' : 'up';
        const row = Math.floor(k / 2);
        if (free(side, row, it.lx - 10, it.lx + lw) || k > 12) { it.side = side; it.row = row; placed.push({ side, row, a: it.lx - 10, b: it.lx + lw }); break; }
      }
    }
    const nUp = Math.max(1, ...items.filter((i) => i.side === 'up').map((i) => i.row + 1));
    const nDown = Math.max(1, ...items.filter((i) => i.side === 'down').map((i) => i.row + 1));
    const ax = 72 + 20 * (nUp - 1);
    const monthY = ax + 31 + 20 * (nDown - 1) + 18;
    const H = monthY + 11;
    let g = `<defs><linearGradient id="tlAx" x1="${left}" x2="${right}" y1="0" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" style="stop-color:var(--indigo)" stop-opacity=".2"/>`
      + '<stop offset=".5" style="stop-color:var(--violet)" stop-opacity=".6"/><stop offset="1" style="stop-color:var(--teal)" stop-opacity=".2"/></linearGradient></defs>'
      + `<rect x="${left}" y="${ax - 0.5}" width="${(right - left).toFixed(1)}" height="1" fill="url(#tlAx)"/><text class="tl-year" x="${left}" y="24">${y0}</text>`;
    const step = unit >= 24 ? 1 : unit >= 13 ? 2 : 3;
    for (let i = 0; i < months; i++) {
      const y = y0 + Math.floor(i / 12);
      const m = (i % 12) + 1;
      const x = xm(y, m);
      g += `<rect class="tl-tick" x="${x.toFixed(1)}" y="${ax - 2.5}" width="1" height="5"/>`;
      if (i % step === 0) g += `<text class="tl-month" x="${(x + unit / 2).toFixed(1)}" y="${monthY}">${esc(m === 1 && i ? String(y) : fmtDate(`${y}-${pad(m)}`, { month: 'short' }))}</text>`;
    }
    for (const it of items) {
      let mark = it.to ? `<rect x="${it.x0.toFixed(1)}" y="${ax - 3}" width="${(it.x1 - it.x0).toFixed(1)}" height="6" rx="3" class="tl-bar"/>`
        : `<circle cx="${it.x.toFixed(1)}" cy="${ax}" r="7.5" class="tl-halo"/><circle cx="${it.x.toFixed(1)}" cy="${ax}" r="3.6" class="tl-dot"/>`;
      const ly = it.side === 'up' ? ax - 30 - 20 * it.row : ax + 31 + 20 * it.row;
      mark += it.side === 'up' ? `<rect class="tl-stem" x="${(it.x - 0.5).toFixed(1)}" y="${ly + 6}" width="1" height="${ax - 6 - (ly + 6)}"/>`
        : `<rect class="tl-stem" x="${(it.x - 0.5).toFixed(1)}" y="${ax + 6}" width="1" height="${ly - 12 - (ax + 6)}"/>`;
      g += `<g class="tl-item tl-${TL_INK[it.key] || 'indigo'}" data-project="${esc(it.key)}">${mark}<text class="tl-name" x="${it.lx.toFixed(1)}" y="${ly}">${esc(it.name)}</text>`
        + `<text class="tl-when" x="${(it.lx + it.nw + 7).toFixed(1)}" y="${ly}">${esc(it.when)}</text></g>`;
    }
    const tx = xm(ty, tm, (td - 0.5) / 31);
    g += `<circle class="tl-today" cx="${tx.toFixed(1)}" cy="${ax}" r="3.4"/>`;
    const tw = textW(t.tlToday, `600 10px ${sans}`);
    if (free('down', 0, tx - tw / 2 - 4, tx + tw / 2 + 4)) g += `<text class="tl-tlabel" x="${tx.toFixed(1)}" y="${ax + 22}">${esc(t.tlToday)}</text>`;
    else if (free('up', 0, tx - tw / 2 - 4, tx + tw / 2 + 4)) g += `<text class="tl-tlabel" x="${tx.toFixed(1)}" y="${ax - 16}">${esc(t.tlToday)}</text>`;
    const long = (iso) => fmtDate(iso, { month: 'long', year: 'numeric' });
    const label = fmt(t.tlAria, { items: items.map((it) => (it.to ? fmt(t.tlFromTo, { name: it.name, from: long(it.from), to: long(it.to) }) : fmt(t.tlFrom, { name: it.name, from: long(it.from) }))).join(lang === 'zh' ? '；' : '; ') });
    box.innerHTML = `<svg class="tl-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(label)}">${g}</svg>`;
  }
  function paintHow() {
    if (appKey !== 'how') return;
    paintTimeline();
    paintSkills();
  }

  // ---------------------------------------------------------------- the project pages: who did what (#157), the numbers (#158)
  function roleHTML(key) {
    const r = D.roles[key];
    return r ? `<p class="ap-role" id="role"><span class="ap-role-k">${esc(C().work.roleHead)}</span><span class="ap-role-v">${esc(r[lang])}</span></p>` : '';
  }
  function numbersHTML(key) {
    const w = C().work;
    const n = D.numbers[key];
    if (!n) return '';
    const num = (v) => Number(v).toLocaleString(LOC());
    const tile = (k, label, value, sub) => `<div class="nm" data-k="${k}"><dt>${esc(label)}</dt><dd class="nm-v">${esc(value)}</dd>${sub ? `<dd class="nm-s">${esc(sub)}</dd>` : ''}</div>`;
    let tiles = '';
    let foot = '';
    if (key === 'storewright') {
      const s = w.sw;
      tiles = (n.first && n.last ? tile('span', s.span, spanText(n.first, n.last)) : '') + tile('commits', s.commits, num(n.commits))
        + tile('tests', s.tests, num(n.tests), n.parts.map(([k, v]) => `${s.parts[k] || k} ${num(v)}`).join(' · '))
        + (n.files ? tile('files', s.files, num(n.files)) : '');
      foot = fmt(s.foot, { head: n.head, date: n.at ? whenLong(n.at) : '' });
    } else if (key === 'silnest') {
      const s = w.sn;
      tiles = (n.started ? tile('started', s.started, whenShort(n.started)) : '') + tile('released', s.released, whenLong(n.released)) + tile('version', s.version, n.version);
      foot = s.foot;
    }
    return `<section class="tv-sec" id="numbers"><h3 class="tv-head">${esc(w.numbersHead)}</h3><dl class="tv nm-grid">${tiles}</dl><p class="tv-foot">${esc(foot)}</p></section>`;
  }

  // ---------------------------------------------------------------- Contact: "Ask me about" (#113), the public resumes (#66)
  function askHTML(t) {
    if (!D.topics.length) return '';
    return `<section class="tv-sec" id="ask"><h3 class="tv-head">${esc(t.askHead)}</h3><ul class="ask-list">`
      + D.topics.map((x) => `<li><button type="button" class="ask-chip" data-goto="${esc(APPS.includes(x.project) ? x.project : 'how')}">${icon(APPS.includes(x.project) ? x.project : 'how', 'ico-xs')}<span>${esc(x[lang])}</span></button></li>`).join('')
      + '</ul></section>';
  }
  const resumeHref = (file) => encodeURIComponent(file);
  function resumeHTML(t) {
    if (!D.resumes.length) return '';
    const btns = D.resumes.map((r) => `<a class="btn rs-btn" href="${esc(resumeHref(r.file))}" target="_blank" rel="noopener noreferrer" data-resume="${esc(r.key)}">${uIco('save')}`
      + `<span${r.key === 'zh' && lang !== 'zh' ? ' lang="zh-CN"' : ''}>${esc(t.resumes[r.key] || r.file)}</span><small>${esc(fmt(t.resumeSize, { kb: r.kb }))}</small><span class="sr-only">${esc(C().newTab)}</span></a>`).join('');
    return `<section class="tv-sec" id="resume"><h3 class="tv-head">${esc(t.resumeHead)}</h3><div class="tv rs-card"><div class="rs-row">${btns}</div><p class="tv-p rs-note">${esc(t.resumeNote)}</p></div></section>`;
  }

  // ---------------------------------------------------------------- the quick view (#154)
  // A plain-text page at #brief, reached from a quiet link on the lock screen: who I am, three
  // projects with links, how I work, the resume and how to reach me. No animation; dark or light
  // like the rest; printed (from any view) it is one white page.
  const BR = { el: $('#brief') };
  function briefHTML() {
    const c = C();
    const b = c.brief;
    const lk = D.facts.links;
    const sw = D.facts.sw;
    const a = (href, text, extra = '') => `<a href="${esc(href)}"${/^https?:/.test(href) ? ' target="_blank" rel="noopener noreferrer"' : ''}${extra}>${esc(text)}</a>`;
    const pages = host(lk.pages);
    const main = D.resumes.find((r) => r.key === (lang === 'zh' ? 'zh' : 'en')) || D.resumes[0];
    const others = D.resumes.filter((r) => r !== main).map((r) => a(resumeHref(r.file), c.app.contact.resumes[r.key] || r.file)).join(' · ');
    const langBtn = (l, label) => `<button type="button" data-lang="${l}" lang="${l === 'zh' ? 'zh-CN' : 'en'}" aria-pressed="${lang === l}">${label}</button>`;
    return `<div class="br-in"><p class="br-top"><span>${esc(b.fun)}</span><a class="br-back" id="briefBack" href="${esc(location.pathname + location.search)}">← ${esc(b.back)}</a>`
      + `<span class="br-tools"><span class="seg br-lang" role="group" aria-label="${esc(c.langLabel)}">${langBtn('en', 'EN')}${langBtn('zh', '中文')}</span>`
      + `<button type="button" class="btn br-print" id="briefPrint" aria-describedby="briefHint">${uIco('print')}<span>${esc(b.print)}</span></button></span></p>`
      + `<p class="br-hint" id="briefHint">${esc(fmt(b.printHint, { key: mac ? '⌘P' : 'Ctrl P' }))}</p>`
      + `<header class="br-head"><h1 class="br-name" id="briefName" tabindex="-1">${esc(D.facts.name)} <span lang="zh-CN">${esc(D.facts.nameZh)}</span></h1>`
      + `<p class="br-lanes">${esc(c.lanes.join(' · '))} · ${esc(c.cityTz)}</p><p class="br-sub">${esc(c.subline)}</p></header>`
      + `<h2>${esc(b.projectsHead)}</h2><ul class="br-list">`
      + `<li><p>${esc(b.projects.storewright)}</p><p class="br-links">${esc(b.demo)}: ${a(sw.demo, host(sw.demo))} · ${esc(b.code)}: ${a(sw.repo, host(sw.repo))}</p></li>`
      + `<li><p>${esc(b.projects.silnest)}</p><p class="br-links">${esc(b.store)}: ${a(D.facts.storeUrl, host(D.facts.storeUrl))}</p></li>`
      + `<li><p>${esc(b.projects.site)}</p><p class="br-links">${esc(b.visit)}: ${a(lk.site, host(lk.site))}</p></li></ul>`
      + `<h2>${esc(b.howHead)}</h2><p class="br-how">${esc(c.app.how.quote)}</p>`
      + `<h2>${esc(b.contactHead)}</h2><dl class="br-rows">`
      + (main ? `<div><dt>${esc(b.resume)}</dt><dd>${a(resumeHref(main.file), `${pages}/${main.file}`, ' data-resume="main"')}${others ? ` <span class="br-also">· ${others}</span>` : ''}</dd></div>` : '')
      + `<div><dt>${esc(b.rows.email)}</dt><dd>${a(`mailto:${lk.email}`, lk.email)}</dd></div>`
      + `<div><dt>${esc(b.rows.linkedin)}</dt><dd>${a(lk.linkedin, host(lk.linkedin))}</dd></div>`
      + `<div><dt>${esc(b.rows.github)}</dt><dd>${a(D.facts.github, host(D.facts.github))}</dd></div>`
      + `<div><dt>${esc(b.rows.site)}</dt><dd>${a(lk.site, host(lk.site))}</dd></div>`
      + `<div><dt>${esc(b.rows.city)}</dt><dd>${esc(c.cityTz)}</dd></div></dl>`
      + `<p class="br-foot">${esc(fmt(b.thisPage, { url: `${pages}/#brief` }))}</p></div>`;
  }
  /** Drawn at start and on every language change, so printing works from any view. */
  function renderBrief() { BR.el.innerHTML = briefHTML(); }
  const openBrief = () => { if (state.view !== 'brief') pushRoute({ view: 'brief', sheet: null, app: null, folder: false }); };
  /** Leave the quick view or present mode: back where the visitor came from, else the lock screen. */
  function leaveView() {
    const h = history.state;
    if (h && h.byApp && (h.view === 'brief' || h.view === 'present')) { history.back(); return; }
    const next = { view: 'lock', sheet: null, app: null, folder: false };
    replaceRoute(next);
    render(next);
  }
  window.addEventListener('beforeprint', renderBrief);

  // ---------------------------------------------------------------- present mode (#155)
  // #present (or ">present" in Search): one slide at a time, large type and few words, taken from
  // the app pages' own copy: my name and three lanes, Storewright, SilNest, AI Vocal, how I work,
  // contact. Arrow keys, Page Up and Down, Space, Home and End turn the slides, a swipe does on a
  // phone, Esc leaves; the number of the slide sits bottom right. The language follows the page.
  const PR = { el: $('#present'), deck: $('#prDeck'), num: $('#prNum'), live: $('#prLive'), prev: $('#prPrev'), next: $('#prNext'), exit: $('#prExit'), i: 0, n: 6, x: null, y: 0 };
  function presentSlides() {
    const c = C();
    const a = c.app;
    const lk = D.facts.links;
    const sw = D.facts.sw;
    const facts = (rows) => `<ul class="pr-facts">${rows.map(([l, v]) => `<li><b>${esc(v)}</b><span>${esc(l)}</span></li>`).join('')}</ul>`;
    const svg = $('.orbit-svg', E.orbit);
    const q = D.qr;
    const sn = a.silnest;
    return [
      { key: 'title', title: D.facts.name, html: `<div class="pr-hero"><div class="orbit pr-orbit" aria-hidden="true">${svg ? svg.outerHTML.replace(/orb-/g, 'prs-') : ''}</div>`
        + `<h2 class="pr-name">${esc(D.facts.name)} <span lang="zh-CN">${esc(D.facts.nameZh)}</span></h2>`
        + `<ul class="pr-lanes">${c.lanes.map((l) => `<li><i aria-hidden="true"></i>${esc(l)}</li>`).join('')}</ul><p class="pr-lead">${esc(c.subline)}</p></div>` },
      { key: 'storewright', title: a.storewright.title, html: `<div class="pr-two"><div class="pr-text">${icon('storewright', 'pr-ico')}<h2 class="pr-title">${esc(a.storewright.title)}</h2>`
        + `<p class="pr-lead">${esc(a.storewright.sub)}</p>${facts(a.storewright.status)}<p class="pr-note">${esc(a.storewright.evalFoot)}</p><p class="pr-url">${esc(host(sw.demo))}</p></div>`
        + `<div class="pr-pic img-sw-demo" role="img" aria-label="${esc(a.storewright.shot)}"></div></div>` },
      { key: 'silnest', title: sn.nav || sn.title, html: `<div class="pr-two"><div class="pr-text">${icon('silnest', 'pr-ico')}<h2 class="pr-title">${esc(sn.title)}</h2>`
        + `<p class="pr-lead">${esc(sn.desc)}</p>${facts(sn.info.filter((r, i) => i < 2 || i === sn.info.length - 1))}<p class="pr-url">${esc(host(D.facts.storeUrl))}</p></div>`
        + `<div class="pr-phone img-sn-s1" role="img" aria-label="${esc(sn.shots[0])}"></div></div>` },
      { key: 'vocal', title: a.vocal.title, html: `<div class="pr-text pr-solo">${icon('vocal', 'pr-ico')}<h2 class="pr-title">${esc(a.vocal.title)}</h2><p class="pr-lead">${esc(a.vocal.sub)}</p>`
        + `<ol class="pr-flow">${a.vocal.pipe.map(([l, v]) => `<li><b>${esc(v)}</b><span>${esc(l)}</span></li>`).join('')}</ol>${facts(a.vocal.status.slice(0, 1))}</div>` },
      { key: 'how', title: a.how.title, html: `<div class="pr-text pr-solo">${icon('how', 'pr-ico')}<h2 class="pr-title">${esc(a.how.title)}</h2><p class="pr-quote">${esc(a.how.quote)}</p></div>` },
      { key: 'contact', title: a.contact.title, html: `<div class="pr-two"><div class="pr-text"><h2 class="pr-title">${esc(D.facts.name)} <span lang="zh-CN">${esc(D.facts.nameZh)}</span></h2>`
        + `<ul class="pr-contact"><li>${esc(lk.email)}</li><li>${esc(host(lk.linkedin))}</li><li>${esc(D.facts.site.domain)}</li><li>${esc(c.cityTz)}</li></ul></div>`
        + (q ? `<figure class="pr-qr"><svg viewBox="0 0 ${q.n} ${q.n}" role="img" aria-label="${esc(fmt(a.contact.qrAria, { url: q.url }))}" shape-rendering="crispEdges" focusable="false">`
          + `<rect width="${q.n}" height="${q.n}" rx="2" fill="#ffffff"/><path d="${q.path}" fill="#0b0c0e"/></svg><figcaption>${esc(a.contact.qrHead)}<br><b>${esc(host(q.url))}</b></figcaption></figure>` : '')
        + '</div>' },
    ];
  }
  /** A still copy of the orbit: each planet where it really is now, the Moon beside Earth at
   *  today's phase (the lock screen's own orbit may never have been drawn); no seconds dot. */
  function stillOrbit(box) {
    const t = vnow();
    const th = Astro.planetLongitudes(t);
    ORB.forEach(([rx, ry], i) => {
      const a = th[i] * D2R;
      for (const g of $$(`[data-o="${i}"]`, box)) g.setAttribute('transform', `translate(${(rx * Math.cos(a)).toFixed(2)} ${(-ry * Math.sin(a)).toFixed(2)})`);
      for (const g of $$(`[data-trail="${i}"]`, box)) g.setAttribute('transform', `rotate(${(90 - th[i]).toFixed(2)})`);
    });
    const m = Astro.moonPhase(t);
    const lit = Astro.moonPhasePath(0, 0, D.moonR, m.illum, m.waxing);
    for (const p of $$('.moon-lit', box)) p.setAttribute('d', lit);
    const [erx, ery] = ORB[EARTH];
    const phi = (th[EARTH] + 180 + m.elong) * D2R;
    const vx = Math.cos(phi);
    const vy = -(ery / erx) * Math.sin(phi);
    const len = Math.hypot(vx, vy) || 1;
    for (const g of $$('[data-moon]', box)) g.setAttribute('transform', `translate(${((vx / len) * OS.moonDist).toFixed(2)} ${((vy / len) * OS.moonDist).toFixed(2)})`);
    for (const d of $$('[data-sec]', box)) d.setAttribute('display', 'none');
  }
  function renderPresent() {
    const S = presentSlides();
    PR.n = S.length;
    PR.i = clamp(PR.i, 0, PR.n - 1);
    PR.deck.innerHTML = S.map((s, i) => `<section class="pr-slide pr-s-${s.key}" data-i="${i}" aria-roledescription="slide" aria-label="${esc(fmt(C().present.slideNamed, { n: i + 1, total: S.length, title: s.title }))}"${i === PR.i ? '' : ' hidden'}>${s.html}</section>`).join('');
    const orbit = $('.pr-orbit', PR.deck);
    if (orbit) stillOrbit(orbit);
    syncPresent(false);
  }
  function syncPresent(announce) {
    setText(PR.num, `${PR.i + 1} / ${PR.n}`);
    PR.prev.disabled = PR.i === 0;
    PR.next.disabled = PR.i === PR.n - 1;
    PR.el.dataset.slide = String(PR.i + 1);
    if (announce) { const s = $(`.pr-slide[data-i="${PR.i}"]`, PR.deck); setText(PR.live, s ? s.getAttribute('aria-label') : ''); }
  }
  function goSlide(i) {
    i = clamp(i, 0, PR.n - 1);
    if (i === PR.i) return;
    PR.i = i;
    for (const s of $$('.pr-slide', PR.deck)) s.hidden = Number(s.dataset.i) !== i;
    syncPresent(true);
    state.slide = i + 1;
    try { history.replaceState({ ...(history.state || {}), view: 'present', slide: i + 1 }, '', routeURL(state)); } catch (e) { /* file:// quirks */ }
    const cur = $(`.pr-slide[data-i="${i}"]`, PR.deck);
    if (cur && !reduced) cur.animate([{ opacity: 0, transform: 'translate3d(0, 8px, 0)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
  const openPresent = (n = 1) => { if (state.view !== 'present') pushRoute({ view: 'present', sheet: null, app: null, folder: false, slide: n }); else goSlide(n - 1); };
  function presentKey(e) {
    const k = e.key;
    // Space and Enter belong to a focused button or link; the arrows always turn the slides
    const onControl = !!(e.target.closest && e.target.closest('button, a'));
    const step = { ArrowRight: 1, ArrowDown: 1, PageDown: 1, ArrowLeft: -1, ArrowUp: -1, PageUp: -1 }[k]
      || (!onControl && (k === ' ' || k === 'Enter') ? (e.shiftKey ? -1 : 1) : 0);
    if (k === 'Escape') { e.preventDefault(); leaveView(); } else if (k === 'Home') { e.preventDefault(); goSlide(0); } else if (k === 'End') { e.preventDefault(); goSlide(PR.n - 1); } else if (step) { e.preventDefault(); goSlide(PR.i + step); }
  }
  PR.prev.addEventListener('click', () => goSlide(PR.i - 1));
  PR.next.addEventListener('click', () => goSlide(PR.i + 1));
  PR.exit.addEventListener('click', leaveView);
  PR.deck.addEventListener('pointerdown', (e) => { if (e.isPrimary) { PR.x = e.clientX; PR.y = e.clientY; } });
  PR.deck.addEventListener('pointerup', (e) => {
    if (PR.x == null) return;
    const dx = e.clientX - PR.x;
    const dy = e.clientY - PR.y;
    PR.x = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) goSlide(PR.i + (dx < 0 ? 1 : -1));
  });
  PR.deck.addEventListener('pointercancel', () => { PR.x = null; });

  // ---------------------------------------------------------------- the Storewright pick game (#121)
  // Storewright's own small store (its "small" template: eight aisles, the produce wall, the back
  // wall, the cart at the front on the right), its walk network as StoreModel builds it, and the
  // shelves its synthetic catalog fills (seed 7), from pages/src/storewright-small.json. The route
  // rule is Storewright's own, ported line for line: Dijkstra on that network with its MinHeap
  // and distance cache (packages/store-config/src/model.ts), routeTsp, the nearest shelf next and
  // then 2-opt, and the aisle-by-aisle baseline routeSShape (packages/algorithms/src/routing.ts).
  // pages/tests/test.mjs checks the page's answers against Storewright's for the same lists.
  const SG = D.swGame;
  const GM = { seed: 0, list: [], picked: [], node: 0, walked: 0, trail: [], done: false, show: false, res: null, anim: 0, path: null, say: -1 };
  class MinHeap {
    constructor() { this.k = []; this.v = []; }
    push(key, val) {
      const { k, v } = this;
      k.push(key);
      v.push(val);
      let i = k.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (k[p] <= key) break;
        k[i] = k[p];
        v[i] = v[p];
        i = p;
      }
      k[i] = key;
      v[i] = val;
    }
    pop() {
      const { k, v } = this;
      if (k.length === 0) return undefined;
      const topK = k[0];
      const topV = v[0];
      const lastK = k.pop();
      const lastV = v.pop();
      if (k.length > 0) {
        let i = 0;
        const n = k.length;
        for (;;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          let mk = lastK;
          if (l < n && k[l] < mk) { m = l; mk = k[l]; }
          if (r < n && k[r] < mk) m = r;
          if (m === i) break;
          k[i] = k[m];
          v[i] = v[m];
          i = m;
        }
        k[i] = lastK;
        v[i] = lastV;
      }
      return [topK, topV];
    }
  }
  /** A fresh "model": the distance and predecessor caches of StoreModel. */
  const swModel = () => ({ dist: new Map(), pred: new Map() });
  function swDijkstra(m, source) {
    const n = SG.nodes.length;
    const dist = new Float64Array(n).fill(Number.POSITIVE_INFINITY);
    const pred = new Int32Array(n).fill(-1);
    dist[source] = 0;
    const heap = new MinHeap();
    heap.push(0, source);
    for (;;) {
      const top = heap.pop();
      if (!top) break;
      const [d, u] = top;
      if (d > dist[u]) continue;
      const adj = SG.adj[u];
      for (let j = 0; j < adj.length; j += 2) {
        const nd = d + adj[j + 1];
        if (nd < dist[adj[j]]) { dist[adj[j]] = nd; pred[adj[j]] = u; heap.push(nd, adj[j]); }
      }
    }
    m.dist.set(source, dist);
    m.pred.set(source, pred);
  }
  function swDistance(m, a, b) {
    if (a === b) return 0;
    let d = m.dist.get(a);
    if (!d) {
      const reverse = m.dist.get(b);
      if (reverse) return reverse[a];
      swDijkstra(m, a);
      d = m.dist.get(a);
    }
    return d[b];
  }
  function swPath(m, a, b) {
    if (!m.pred.has(a)) swDijkstra(m, a);
    const pred = m.pred.get(a);
    const out = [];
    let cur = b;
    while (cur !== -1 && cur !== a) { out.push(cur); cur = pred[cur]; }
    out.push(a);
    return out.reverse();
  }
  function swRouteLength(m, start, seq, end) {
    let d = 0;
    let prev = start;
    for (const n of seq) { d += swDistance(m, prev, n); prev = n; }
    return d + swDistance(m, prev, end);
  }
  function swRouteTsp(m, nodes, start, end, maxPasses = 50) {
    const unique = [...new Set(nodes)].sort((a, b) => a - b);
    if (unique.length === 0) return { order: [], distanceM: swDistance(m, start, end) };
    const remaining = new Set(unique);
    const seq = [];
    let cur = start;
    while (remaining.size) {
      let best = -1;
      let bestD = Number.POSITIVE_INFINITY;
      for (const n of remaining) {
        const d = swDistance(m, cur, n);
        if (d < bestD || (d === bestD && n < best)) { bestD = d; best = n; }
      }
      seq.push(best);
      remaining.delete(best);
      cur = best;
    }
    const pts = [start, ...seq, end];
    const dist = (i, j) => swDistance(m, pts[i], pts[j]);
    for (let pass = 0; pass < maxPasses; pass++) {
      let improved = false;
      for (let i = 1; i < pts.length - 2; i++) {
        for (let k = i + 1; k < pts.length - 1; k++) {
          const delta = dist(i - 1, k) + dist(i, k + 1) - dist(i - 1, i) - dist(k, k + 1);
          if (delta < -1e-6) {
            for (let a = i, b = k; a < b; a++, b--) { const tmp = pts[a]; pts[a] = pts[b]; pts[b] = tmp; }
            improved = true;
          }
        }
      }
      if (!improved) break;
    }
    const order = pts.slice(1, -1);
    return { order, distanceM: swRouteLength(m, start, order, end) };
  }
  function swRouteSShape(m, nodes, start, end) {
    const runs = [...new Set(nodes.map((n) => n.runSequence))].sort((a, b) => a - b);
    const order = [];
    runs.forEach((run, i) => {
      const inRun = nodes.filter((n) => n.runSequence === run).sort((a, b) => (i % 2 === 0 ? a.along - b.along : b.along - a.along));
      for (const n of inRun) if (order[order.length - 1] !== n.node) order.push(n.node);
    });
    return { order, distanceM: swRouteLength(m, start, order, end) };
  }
  // the game's lists: six shelves on six different stops, from a seed (the same sampler as
  // pages/tests/storewright_small.mjs); the first list of the day is the same for everyone
  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pickList(seed, n = 6) {
    const rng = mulberry32(seed);
    const out = [];
    const nodes = new Set();
    while (out.length < n) {
      const i = Math.floor(rng() * SG.locs.length);
      if (nodes.has(SG.locs[i][3])) continue;
      nodes.add(SG.locs[i][3]);
      out.push(i);
    }
    return out;
  }
  const onFloor = (id) => { const [x, y] = SG.nodes[id]; return y >= SG.floor.yFront - 0.01 && y <= SG.floor.yBack + 0.01 && x >= SG.floor.x0 - 0.01; };
  const walkModel = SG ? swModel() : null;
  function edgeLen(a, b) {
    const adj = SG.adj[a];
    for (let j = 0; j < adj.length; j += 2) if (adj[j] === b) return adj[j + 1];
    return 0;
  }
  function gameStart(seed) {
    GM.seed = seed;
    GM.list = pickList(seed);
    GM.picked = GM.list.map(() => false);
    GM.node = SG.depot;
    GM.walked = 0;
    GM.trail = [SG.depot];
    GM.done = false;
    GM.show = false;
    GM.say = -1;
    cancelAnimationFrame(GM.anim);
    GM.path = null;
    // Storewright's answers for this list, worked out with a fresh model as Storewright would
    const m = swModel();
    const nodes = GM.list.map((i) => SG.locs[i][3]);
    const tsp = swRouteTsp(m, nodes, SG.depot, SG.staging);
    const ss = swRouteSShape(m, GM.list.map((i) => { const l = SG.locs[i]; return { node: l[3], runSequence: SG.runs[l[0]][3], along: l[1] }; }), SG.depot, SG.staging);
    const draw = swModel();
    const legs = [SG.depot, ...tsp.order, SG.staging];
    const route = [SG.depot];
    for (let i = 1; i < legs.length; i++) route.push(...swPath(draw, legs[i - 1], legs[i]).slice(1));
    GM.res = { tsp, ss, route };
  }
  const BOARD = { x0: 1.4, w: 41.2, h: 20.2, y: (y) => 23.7 - y };
  function gameWhere(i) {
    const g = C().game;
    const [ri, bay] = SG.locs[i];
    const [id, kind] = SG.runs[ri];
    if (kind === 'AISLE') return fmt(g.aisle, { n: Number(id.replace(/\D+/g, '').slice(1)) || ri, b: bay + 1 });
    if (/BKR$/.test(id)) return fmt(g.backWall, { b: bay + 11 });
    if (/BK/.test(id)) return fmt(g.backWall, { b: bay + 1 });
    return fmt(g.produce, { b: bay + 1 });
  }
  const gameCat = (i) => { const c = SG.cats[SG.locs[i][4]]; return lang === 'zh' ? c[2] : c[1]; };
  /** Where a shelf face is drawn: beside its stop, on the side it faces (L: left, R: right). */
  function faceRect(i) {
    const [ri, , side, node] = SG.locs[i];
    const [x, y] = SG.nodes[node];
    const kind = SG.runs[ri][1];
    const Y = BOARD.y(y);
    if (kind === 'AISLE') return side === 'L' ? [x - 1.3, Y - 0.48, 0.55, 0.96] : [x + 0.75, Y - 0.48, 0.55, 0.96];
    if (y >= SG.floor.yBack - 0.01) return [x - 0.55, BOARD.y(SG.floor.yBack) - 1.75, 1.1, 0.7];
    return [x - 1.75, Y - 0.48, 0.7, 0.96];
  }
  const fmtM = (v) => Number(v).toLocaleString(LOC(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  function gameHTML() {
    if (!SG) return '';
    const g = C().game;
    return `<section class="tv-sec" id="game"><h3 class="tv-head">${esc(g.head)}</h3><div class="tv sg-card"><p class="tv-p sg-intro">${esc(g.intro)}</p>`
      + `<div class="sg-board" id="sgBoard" tabindex="0" role="application" aria-label="${esc(g.boardAria)}" aria-describedby="sgHow sgStatus"></div>`
      + `<p class="sg-how" id="sgHow">${esc(g.how)}</p><p class="sg-status" id="sgStatus" role="status"></p>`
      + `<div class="sg-side"><h4 class="sg-lh">${esc(g.listHead)}</h4><ol class="sg-list" id="sgList"></ol></div>`
      + `<div class="sg-res" id="sgRes" hidden></div><div class="sg-btns"><button type="button" class="btn" id="sgShow" aria-pressed="false"></button>`
      + `<button type="button" class="btn" id="sgAgain">${uIco('motion')}<span>${esc(g.again)}</span></button></div></div>`
      + `<p class="tv-foot">${esc(fmt(g.foot, { commit: SG.source.commit }))}</p></section>`;
  }
  function gameBoardSVG() {
    const Y = BOARD.y;
    const F = SG.floor;
    // the walk lines across the floor: the produce wall, the aisles, the right corridor (where the back wall ends)
    const xs = SG.runs.filter((r) => r[1] === 'AISLE').map((r) => r[5]);
    const walls = [F.x0, ...xs, Math.max(...SG.runs.map((r) => Math.max(r[5], r[7])))];
    const yb = SG.runs[0][8] - 1.5;   // the runs' bays sit between the end margins
    const yf = SG.runs[0][6] + 1.5;
    let s = `<rect class="sg-floor" x="${F.x0 - 1.4}" y="${Y(F.yBack) - 2.1}" width="${walls[walls.length - 1] - F.x0 + 2.4}" height="${Y(F.yFront) - Y(F.yBack) + 3.2}" rx=".8"/>`
      + `<rect class="sg-floor" x="${walls[walls.length - 1]}" y="${Y(F.yFront) - 0.9}" width="${F.x1 - walls[walls.length - 1] + 1.4}" height="1.8" rx=".6"/>`;
    for (let i = 0; i < walls.length - 1; i++) s += `<rect class="sg-shelf" x="${(walls[i] + 0.75).toFixed(2)}" y="${Y(yb).toFixed(2)}" width="${(walls[i + 1] - walls[i] - 1.5).toFixed(2)}" height="${(Y(yf) - Y(yb)).toFixed(2)}" rx=".3"/>`;
    s += `<rect class="sg-shelf sg-wall" x="${F.x0 - 1.75}" y="${Y(yb).toFixed(2)}" width=".7" height="${(Y(yf) - Y(yb)).toFixed(2)}" rx=".3"/>`
      + `<rect class="sg-shelf sg-wall" x="${F.x0}" y="${(Y(F.yBack) - 1.75).toFixed(2)}" width="${walls[walls.length - 1] - F.x0}" height=".7" rx=".3"/>`;
    // the walk network, faint
    let e = '';
    SG.adj.forEach((adj, a) => { for (let j = 0; j < adj.length; j += 2) { const b = adj[j]; if (b > a && onFloor(a) && onFloor(b)) e += `M${SG.nodes[a][0].toFixed(2)},${Y(SG.nodes[a][1]).toFixed(2)}L${SG.nodes[b][0].toFixed(2)},${Y(SG.nodes[b][1]).toFixed(2)}`; } });
    s += `<path class="sg-net" d="${e}"/>`;
    SG.runs.filter((r) => r[1] === 'AISLE').forEach((r) => { s += `<text class="sg-aisle" x="${r[5]}" y="${(Y(F.yFront) + 2.1).toFixed(2)}">${esc(r[0].replace(/\D+/g, '').slice(1).replace(/^0/, ''))}</text>`; });
    const [cx, cy] = SG.nodes[SG.depot];
    s += `<g class="sg-cart" id="sgCart" data-node="${SG.depot}"><rect x="${cx - 0.9}" y="${(Y(cy) - 0.9).toFixed(2)}" width="1.8" height="1.8" rx=".4"/><text x="${cx}" y="${(Y(cy) + 2.3).toFixed(2)}">${esc(C().game.cart)}</text></g>`;
    s += '<path class="sg-algo" id="sgAlgo" d=""/><polyline class="sg-trail" id="sgTrail" points=""/><g id="sgPicks"></g>';
    s += `<circle class="sg-me" id="sgMe" r=".62" cx="${cx}" cy="${Y(cy).toFixed(2)}"/>`;
    return `<svg class="sg-svg" viewBox="${BOARD.x0} 0 ${BOARD.w} ${BOARD.h}" aria-hidden="true" focusable="false">${s}</svg>`;
  }
  function gamePaint() {
    const board = $('#sgBoard', A.body);
    if (!board || !SG) return;
    const g = C().game;
    if (!board.firstChild) board.innerHTML = gameBoardSVG();
    const Y = BOARD.y;
    const pt = (n) => `${SG.nodes[n][0].toFixed(2)},${Y(SG.nodes[n][1]).toFixed(2)}`;
    $('#sgPicks', board).innerHTML = GM.list.map((li, k) => {
      const [x, y, w, h] = faceRect(li);
      const node = SG.locs[li][3];
      return `<g class="sg-pick${GM.picked[k] ? ' done' : ''}" data-k="${k}" data-node="${node}"><rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w}" height="${h}" rx=".18"/>`
        + `<circle cx="${SG.nodes[node][0].toFixed(2)}" cy="${Y(SG.nodes[node][1]).toFixed(2)}" r=".3"/></g>`;
    }).join('');
    $('#sgTrail', board).setAttribute('points', GM.trail.map(pt).join(' '));
    const me = $('#sgMe', board);
    if (!GM.anim) { me.setAttribute('cx', SG.nodes[GM.node][0].toFixed(2)); me.setAttribute('cy', Y(SG.nodes[GM.node][1]).toFixed(2)); }
    me.dataset.node = String(GM.node);
    const algo = $('#sgAlgo', board);
    algo.setAttribute('d', GM.show ? `M${GM.res.route.map(pt).join('L')}` : '');
    algo.dataset.order = GM.res.tsp.order.join(',');
    algo.dataset.m = String(GM.res.tsp.distanceM);
    algo.dataset.s = String(GM.res.ss.distanceM);
    $('#sgList', A.body).innerHTML = GM.list.map((li, k) => `<li class="${GM.picked[k] ? 'done' : ''}" data-k="${k}"><span class="sg-n" aria-hidden="true">${GM.picked[k] ? '✓' : k + 1}</span>`
      + `<span>${esc(fmt(g.item, { cat: gameCat(li), where: gameWhere(li) }))}</span></li>`).join('');
    const n = GM.picked.filter(Boolean).length;
    const status = GM.done ? '' : (n === GM.list.length ? fmt(g.statusBack, { m: fmtM(GM.walked) }) : fmt(g.status, { done: n, n: GM.list.length, m: fmtM(GM.walked) }));
    const say = GM.say >= 0 ? fmt(g.picked, { cat: gameCat(GM.list[GM.say]) }) : '';
    setText($('#sgStatus', A.body), [say, status].filter(Boolean).join(' '));
    const res = $('#sgRes', A.body);
    if (GM.done || GM.show) {
      const tsp = GM.res.tsp.distanceM;
      let verdict = '';
      if (GM.done) {
        const d = Math.round((GM.walked - tsp) * 10) / 10;
        verdict = Math.abs(d) < 0.05 ? g.same : fmt(d < 0 ? g.better : g.worse, { d: fmtM(Math.abs(d)) });
      }
      res.innerHTML = (GM.done ? `<p class="sg-r1">${esc(fmt(g.result, { you: fmtM(GM.walked), tsp: fmtM(tsp) }))} <b>${esc(verdict)}</b></p>` : `<p class="sg-r1">${esc(fmt(g.route, { tsp: fmtM(tsp) }))}</p>`)
        + `<p class="sg-r2">${esc(fmt(g.sshape, { s: fmtM(GM.res.ss.distanceM) }))}</p><p class="sg-r3">${esc(g.rule)}</p>`
        + `<p class="sg-legend"><span class="sg-lg-you">${esc(g.yours)}</span><span class="sg-lg-algo">${esc(g.algo)}</span></p>`;
      res.hidden = false;
    } else res.hidden = true;
    const show = $('#sgShow', A.body);
    show.innerHTML = `${uIco('eye')}<span>${esc(GM.show ? g.hide : g.show)}</span>`;
    show.setAttribute('aria-pressed', String(GM.show));
  }
  /** Walk along a path of stops: each step adds the length of its edge; a shelf on the list is
   *  picked when the walk reaches its stop; back at the cart with everything picked, it is done. */
  function gameArrive(n) {
    const k = GM.list.findIndex((li, j) => !GM.picked[j] && SG.locs[li][3] === n);
    if (k >= 0) { GM.picked[k] = true; GM.say = k; }
    if (n === SG.staging && GM.picked.every(Boolean)) { GM.done = true; GM.show = true; GM.say = -1; }
  }
  function gameStep(n) {
    GM.walked += edgeLen(GM.node, n);
    GM.node = n;
    GM.trail.push(n);
    gameArrive(n);
  }
  function gameFinishWalk() {
    if (!GM.path) return;
    cancelAnimationFrame(GM.anim);
    GM.anim = 0;
    while (GM.path.length) gameStep(GM.path.shift());
    GM.path = null;
  }
  function gameWalk(target) {
    if (GM.done || !SG) return;
    gameFinishWalk();
    if (target === GM.node) return;
    GM.say = -1;
    GM.path = swPath(walkModel, GM.node, target).slice(1);
    if (reduced || GM.path.length < 2) { gameFinishWalk(); gamePaint(); return; }
    const me = $('#sgMe', A.body);
    let from = SG.nodes[GM.node];
    let t0 = 0;
    const step = (ts) => {
      if (!GM.path || !me.isConnected) { gameFinishWalk(); gamePaint(); return; }
      if (!t0) t0 = ts;
      const to = SG.nodes[GM.path[0]];
      const f = Math.min(1, (ts - t0) / 55);
      me.setAttribute('cx', (from[0] + (to[0] - from[0]) * f).toFixed(2));
      me.setAttribute('cy', BOARD.y(from[1] + (to[1] - from[1]) * f).toFixed(2));
      if (f >= 1) {
        gameStep(GM.path.shift());
        from = to;
        t0 = ts;
        gamePaint();
        if (!GM.path.length) { GM.path = null; GM.anim = 0; gamePaint(); return; }
      }
      GM.anim = requestAnimationFrame(step);
    };
    GM.anim = requestAnimationFrame(step);
  }
  /** The nearest stop on the sales floor to a point on the board (a tap or a click). */
  function gameNodeAt(clientX, clientY) {
    const svg = $('#sgBoard svg', A.body);
    if (!svg) return -1;
    const ctm = svg.getScreenCTM();
    if (!ctm) return -1;
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    let best = -1;
    let bd = Infinity;
    SG.nodes.forEach(([x, y], i) => {
      if (!onFloor(i)) return;
      const d = Math.hypot(x - p.x, BOARD.y(y) - p.y);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }
  /** The arrow keys walk from one stop to the next one in that direction (up is toward the back). */
  function gameKey(e) {
    if (!e.target.closest || !e.target.closest('#sgBoard')) return;
    const dir = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
    if (!dir) return;
    e.preventDefault();
    if (GM.done) return;
    gameFinishWalk();
    const [x, y] = SG.nodes[GM.node];
    let best = -1;
    let bd = 0.7;
    const adj = SG.adj[GM.node];
    for (let j = 0; j < adj.length; j += 2) {
      const b = adj[j];
      if (!onFloor(b)) continue;
      const dx = SG.nodes[b][0] - x;
      const dy = SG.nodes[b][1] - y;
      const len = Math.hypot(dx, dy) || 1;
      const dot = (dx * dir[0] + dy * dir[1]) / len;
      if (dot > bd) { bd = dot; best = b; }
    }
    if (best < 0) return;
    GM.say = -1;
    gameStep(best);
    gamePaint();
  }
  function gameInit() {
    if (!SG || !$('#sgBoard', A.body)) return;
    if (!GM.list.length) {
      const q = Number(query.get('game'));
      gameStart(q > 0 ? Math.floor(q) : Number(albanyISO().replace(/-/g, '')));
    }
    gamePaint();
  }
  if (SG) A.body.addEventListener('keydown', gameKey);

  // ---------------------------------------------------------------- What if… (#169)
  // Under the store day, three sliders (pickers on shift, order volume, peak hours) and Rerun.
  // Rerun runs one store day of Storewright's own simulation here in the browser, with the card's
  // seed (its date), and puts the result beside the card's numbers ("Now"), which pages/build.py
  // checked the same code gives for that day. The code (pages/src/storewright-sim.js, bundled from
  // Storewright by scripts/bundle_storewright_sim.sh; AGPL-3.0) travels in the page as text and
  // runs only when asked, never at load. Each slider changes a real field of Storewright's scenario
  // (scripts/storewright_sim_entry.mjs): pickers per hour (staffing.pick), orders a day
  // (demand.ordersPerDay) and the weight of the busiest hours (demand.hourlyProfile).
  const LAB = D.swLab && hasDay ? D.swLab : null;
  const LB = { v: null, res: null, ms: 0, timer: 0, state: 'idle' };
  const LAB_KNOBS = LAB ? [
    { k: 'pickers', min: Math.max(1, LAB.defaults.pickers - 6), max: LAB.defaults.pickers + 6, step: 1, def: LAB.defaults.pickers },
    { k: 'volume', min: 50, max: 200, step: 10, def: 100 },
    { k: 'peak', min: 0.5, max: 2, step: 0.25, def: 1 },
  ] : [];
  const labNum = (v, d = 0) => Number(v).toLocaleString(LOC(), { minimumFractionDigits: d, maximumFractionDigits: 2 });
  /** "11 AM to 1 PM and 4 to 7 PM" (11 点到 13 点和 16 点到 19 点): the busiest hours of the model. */
  function labPeakHours() {
    const l = C().lab;
    const hs = LAB.defaults.peakHours;
    const runs = [];
    for (const h of hs) { const r = runs[runs.length - 1]; if (r && r[1] === h) r[1] = h + 1; else runs.push([h, h + 1]); }
    const h12 = (h, ap) => `${h % 12 || 12}${ap ? ` ${h % 24 < 12 ? 'AM' : 'PM'}` : ''}`;
    return runs.map(([a, b]) => (lang === 'zh' ? fmt(l.range, { a: `${a} 点`, b: `${b} 点` })
      : fmt(l.range, { a: h12(a, (a < 12) !== (b % 24 < 12)), b: h12(b, true) }))).join(l.and);
  }
  function labValue(kn, v) {
    const l = C().lab;
    if (kn.k === 'pickers') return { shown: labNum(v), text: fmt(l.pickersVal, { n: labNum(v) }) };
    if (kn.k === 'volume') return { shown: `${labNum(v)}%`, text: fmt(l.volumeVal, { pct: labNum(v), n: labNum(Math.round((LAB.defaults.ordersPerDay * v) / 100)) }) };
    return { shown: `×${labNum(v)}`, text: v === 1 ? l.peakVal1 : fmt(l.peakVal, { x: labNum(v) }) };
  }
  function labHint(kn) {
    const l = C().lab;
    if (kn.k === 'pickers') return fmt(l.pickersHint, { n: labNum(kn.def) });
    if (kn.k === 'volume') return fmt(l.volumeHint, { n: labNum(LAB.defaults.ordersPerDay) });
    return fmt(l.peakHint, { hours: labPeakHours() });
  }
  /** A result as the card writes it: "99.6%", "4.5 min" (分钟). */
  const labCell = (label, value) => { const it = dayItem(label); return it ? dayValUnit({ ...it, value }) : String(value); };
  function labHTML() {
    if (!LAB || !dayItem('Ready on time') || !dayItem('Avg pickup wait')) return '';
    const l = C().lab;
    if (!LB.v) LB.v = Object.fromEntries(LAB_KNOBS.map((kn) => [kn.k, kn.def]));
    const knobs = LAB_KNOBS.map((kn) => {
      const v = LB.v[kn.k];
      const val = labValue(kn, v);
      const id = `wi-${kn.k}`;
      return `<div class="wi-knob"><div class="wi-lr"><label class="wi-label" for="${id}">${esc(l[kn.k])}</label><output class="wi-out" id="${id}-out" for="${id}">${esc(val.shown)}</output></div>`
        + `<input type="range" class="tt-range wi-range" id="${id}" data-k="${kn.k}" min="${kn.min}" max="${kn.max}" step="${kn.step}" value="${v}" aria-valuetext="${esc(val.text)}" aria-describedby="${id}-hint"`
        + ` style="--fill:${(((v - kn.min) / (kn.max - kn.min)) * 100).toFixed(2)}%">`
        + `<p class="wi-hint" id="${id}-hint">${esc(labHint(kn))}</p></div>`;
    }).join('');
    const now = { onTime: dayItem('Ready on time').value, wait: dayItem('Avg pickup wait').value };
    const res = LB.res;
    const yours = (label, key) => (res ? esc(labCell(label, res[key])) : `<span class="wi-none">${esc(l.notRun)}</span>`);
    return `<section class="tv-sec" id="whatIf"><h3 class="tv-head">${esc(l.head)}</h3><div class="tv wi-card">`
      + `<p class="tv-p wi-intro">${esc(l.intro)}</p>`
      + `<div class="wi-knobs" role="group" aria-label="${esc(l.knobs)}">${knobs}</div>`
      + `<div class="wi-act"><button type="button" class="btn primary" id="wiRun">${uIco('play')}<span>${esc(l.run)}</span></button>`
      + `<p class="wi-status" id="wiStatus">${esc(LB.state === 'done' ? fmt(l.ran, { s: labNum(LB.ms / 1000, 2) }) : LB.state === 'failed' ? l.failed : '')}</p></div>`
      + `<table class="wi-table"><caption class="sr-only">${esc(l.tableCap)}</caption><thead><tr><td></td><th scope="col">${esc(l.now)}</th><th scope="col">${esc(l.yours)}</th></tr></thead><tbody>`
      + `<tr data-k="onTime"><th scope="row">${esc(l.onTime)}</th><td class="wi-now">${esc(labCell('Ready on time', now.onTime))}</td><td class="wi-new" id="wiOnTime">${yours('Ready on time', 'onTime')}</td></tr>`
      + `<tr data-k="wait"><th scope="row">${esc(l.wait)}</th><td class="wi-now">${esc(labCell('Avg pickup wait', now.wait))}</td><td class="wi-new" id="wiWait">${yours('Avg pickup wait', 'waitMin')}</td></tr>`
      + `</tbody></table><p class="sr-only" id="wiLive" aria-live="polite"></p></div>`
      + `<p class="tv-foot">${esc(l.small)}</p>`
      + `<p class="tv-foot">${esc(fmt(l.code, { commit: LAB.commit }))} <a class="wi-src" href="${esc(`${D.facts.sw.repo}/tree/${LAB.commit}`)}" target="_blank" rel="noopener noreferrer">${esc(l.source)}<span class="sr-only">${esc(C().newTab)}</span></a></p></section>`;
  }
  /** The simulation, put into a script of its own the first time it is needed (the page's
   *  Content Security Policy allows it by the hash of its text). */
  function labSim() {
    if (!window.StorewrightSim) {
      const src = doc.getElementById('swSim');
      if (!src) return null;
      const el = doc.createElement('script');
      el.textContent = src.textContent;
      doc.body.append(el);
      el.remove();
    }
    return window.StorewrightSim || null;
  }
  function labRun() {
    clearTimeout(LB.timer);
    const st = $('#wiStatus', A.body);
    if (!LAB || !st) return;
    LB.state = 'running';
    setText(st, C().lab.running);
    $('.wi-card', A.body).setAttribute('aria-busy', 'true');
    const v = { ...LB.v };
    // let "Running…" paint before the simulation holds the page for a moment
    requestAnimationFrame(() => setTimeout(() => {
      const sim = labSim();
      const t0 = performance.now();
      let r = null;
      try { r = sim && sim.runDay({ seed: LAB.seed, pickers: v.pickers, volume: v.volume, peak: v.peak }); } catch (e) { r = null; }
      LB.ms = performance.now() - t0;
      LB.res = r;
      LB.state = r ? 'done' : 'failed';
      labPaint(true);
    }, 0));
  }
  function labPaint(fresh) {
    const card = $('.wi-card', A.body);
    if (!card) return;
    const l = C().lab;
    card.removeAttribute('aria-busy');
    setText($('#wiStatus', A.body), LB.state === 'done' ? fmt(l.ran, { s: labNum(LB.ms / 1000, 2) }) : LB.state === 'failed' ? l.failed : '');
    const r = LB.res;
    for (const [id, label, key] of [['wiOnTime', 'Ready on time', 'onTime'], ['wiWait', 'Avg pickup wait', 'waitMin']]) {
      const cell = $(`#${id}`, A.body);
      cell.textContent = r ? labCell(label, r[key]) : '';
      if (!r) cell.innerHTML = `<span class="wi-none">${esc(l.notRun)}</span>`;
      if (fresh) { cell.classList.remove('wi-fresh'); void cell.offsetWidth; cell.classList.add('wi-fresh'); }
    }
    if (fresh) {
      setText($('#wiLive', A.body), r ? fmt(l.announce, { onTime: labCell('Ready on time', r.onTime), wait: labCell('Avg pickup wait', r.waitMin),
        nowOnTime: labCell('Ready on time', dayItem('Ready on time').value), nowWait: labCell('Avg pickup wait', dayItem('Avg pickup wait').value) }) : l.failed);
    }
  }
  function labInit() {
    if (!LAB || !$('#whatIf', A.body)) return;
    if (LB.state === 'running') LB.state = 'idle';
  }
  if (LAB) {
    A.body.addEventListener('input', (e) => {
      const t = e.target;
      if (appKey !== 'storewright' || !t.classList || !t.classList.contains('wi-range')) return;
      const kn = LAB_KNOBS.find((x) => x.k === t.dataset.k);
      const v = Number(t.value);
      LB.v[kn.k] = v;
      const val = labValue(kn, v);
      setText($(`#wi-${kn.k}-out`, A.body), val.shown);
      t.setAttribute('aria-valuetext', val.text);
      t.style.setProperty('--fill', `${(((v - kn.min) / (kn.max - kn.min)) * 100).toFixed(2)}%`);
    });
    // a slider runs the day when it is let go (or stepped with the keys), a moment later so
    // several quick steps make one run
    A.body.addEventListener('change', (e) => {
      if (appKey !== 'storewright' || !e.target.classList || !e.target.classList.contains('wi-range')) return;
      clearTimeout(LB.timer);
      LB.timer = setTimeout(labRun, 250);
    });
    A.body.addEventListener('click', (e) => { if (appKey === 'storewright' && e.target.closest('#wiRun')) labRun(); });
  }

  // ---------------------------------------------------------------- focus helpers
  function focusable(f) {
    return f && doc.contains(f) && !f.closest('[inert]') && !f.closest('[hidden]') && (f.offsetParent !== null || getComputedStyle(f).position === 'fixed');
  }
  function restoreFocus(f, fallback) {
    if (focusable(f)) f.focus({ preventScroll: true });
    else { const fb = fallback(); if (fb) fb.focus({ preventScroll: true }); }
  }
  /** Focus after the current render has updated inert, so the target is focusable. */
  function queueFocus(f, fallback) {
    setTimeout(() => {
      if (overlay || openKey || appKey || folderOpen) {
        const top = topLayer();
        if (top === 'sheet' || top === 'app' || top === 'folder' || overlay) return;
      }
      restoreFocus(f, fallback);
    }, 0);
  }

  // ---------------------------------------------------------------- views and history
  // Routes: (none) lock screen, #<widget> a panel, #home, #home/<app>, #home/early (the folder),
  // #sky[/<city id or lat,lon>[/<YYYY-MM-DD>[/<HH:MM>]]] the Sky app on a place, a date and a time.
  // Unlocking and opening anything add a history entry, so the back button undoes it.
  let state = { view: 'lock', sheet: null, app: null, folder: false };
  let skipPop = 0;
  function topLayer() {
    if (SB.on) return 'standby';
    if (overlay === 'about') return 'about';
    if (overlay === 'keys') return 'keys';
    if (overlay === 'cc') return 'cc';
    if (overlay === 'nc') return 'nc';
    if (overlay === 'spot') return 'spot';
    if (state.sheet) return 'sheet';
    if (state.folder) return 'folder';
    if (state.app) return 'app';
    return state.view;
  }
  function setInert() {
    const top = topLayer();
    const base = top === 'lock' || top === 'home';
    E.lock.inert = top !== 'lock';
    E.home.inert = top !== 'home';
    E.topbar.inert = !base;
    E.ncGrab.inert = !base;
    E.ccGrab.inert = !base;
    A.layer.inert = top !== 'app';
    F.layer.inert = top !== 'folder';
    SP.layer.inert = top !== 'spot';
    S.layer.inert = top !== 'sheet';
    NC.layer.inert = top !== 'nc';
    CC.layer.inert = top !== 'cc';
    K.layer.inert = top !== 'keys';
    AB.layer.inert = top !== 'about';
    SB.el.inert = top !== 'standby';
    BR.el.inert = top !== 'brief';
    PR.el.inert = top !== 'present';
    TR.el.inert = top !== 'lock';
    TT.bar.inert = !(base || top === 'app');
    E.lockBtn.hidden = state.view !== 'home';
    body.classList.toggle('layer-open', !(base || top === 'app'));
  }
  function parseRoute() {
    const parts = decodeURIComponent(location.hash.replace(/^#/, '')).split('/').filter(Boolean);
    const s = { view: 'lock', sheet: null, app: null, folder: false };
    // R3.3 batch 3: #brief the quick view (#154), #present[/<slide>] present mode (#155)
    if (parts[0] === 'brief') { s.view = 'brief'; return s; }
    if (parts[0] === 'present') { s.view = 'present'; s.slide = Math.max(1, parseInt(parts[1], 10) || 1); return s; }
    if (parts[0] === 'sky') { s.view = 'home'; s.app = 'sky'; s.sky = skyRoute(parts.slice(1)); return s; }
    // #148: #guestbook (the README's link) opens Contact at the guestbook
    if (parts[0] === 'guestbook') { s.view = 'home'; s.app = 'contact'; pendingFocus = 'guestbook'; return s; }
    if (parts[0] === 'home') { s.view = 'home'; parts.shift(); } else if (parts[0] === 'lock') parts.shift();
    const k = parts[0];
    if (k === 'sky' && s.view === 'home' && parts.length > 1) s.sky = skyRoute(parts.slice(1));
    if (k) {
      if (s.view === 'home' && APPS.includes(k)) s.app = k;
      else if (s.view === 'home' && k === 'early') s.folder = true;
      else if (D.sheets[k]) s.sheet = k;
    }
    return s;
  }
  function routeURL(s) {
    const seg = [];
    if (s.view === 'home') seg.push('home');
    if (s.view === 'brief') seg.push('brief');
    if (s.view === 'present') { seg.push('present'); if (s.slide > 1) seg.push(String(s.slide)); }
    if (s.app) seg.push(s.app); else if (s.folder) seg.push('early'); else if (s.sheet) seg.push(s.sheet);
    const q = new URLSearchParams(location.search);
    for (const k of ['sheet', 'home', 'app', 'open', 'q']) q.delete(k);
    const search = q.toString() ? `?${q.toString()}` : '';
    return location.pathname + search + (seg.length ? `#${seg.join('/')}` : '');
  }
  function pushRoute(next) {
    try { history.pushState({ ...next, byApp: true }, '', routeURL(next)); } catch (e) { /* file:// quirks: still navigate */ }
    render(next);
  }
  function replaceRoute(next) {
    try { history.replaceState({ ...next, byApp: false }, '', routeURL(next)); } catch (e) { /* ignore */ }
  }
  function showView(v, initial) {
    body.dataset.view = v;
    // R3.3 batch 3: the quick view (#154) and present mode (#155) cover the page
    BR.el.hidden = v !== 'brief';
    if (v === 'present') { PR.i = (state.slide || 1) - 1; renderPresent(); }
    PR.el.hidden = v !== 'present';
    if (v === 'brief' || v === 'present') { if (overlay) closeOverlay({ instant: true, noFocus: true }); if (TT.open) ttClose(true); }
    syncOrbit();
    syncScrolled();
    placeGlow(!initial);
    if (v === 'home') requestAnimationFrame(checkHomeFits);
    if (!initial && !state.sheet && !state.app && !state.folder) {
      // move focus into the screen that just appeared
      const to = { home: E.homeTitle, brief: $('#briefName'), present: PR.deck }[v] || E.unlock;
      setTimeout(() => { if (!overlay && !state.app && !state.folder && !state.sheet && to) to.focus({ preventScroll: true }); }, 40);
    }
  }
  function render(next, initial = false) {
    const prev = state;
    if (next.sky) applySkyRoute(next.sky);
    state = { view: next.view, sheet: next.sheet || null, app: next.app || null, folder: !!next.folder, slide: next.slide || 1 };
    if (state.view !== 'lock' || state.sheet) { clearTimeout(TR.timer); endTour(); }
    setInert();
    if (initial || prev.view !== state.view) showView(state.view, initial);
    else if (state.view === 'present' && prev.slide !== state.slide) goSlide(state.slide - 1);
    if (initial || prev.app !== state.app) { if (state.app) openAppUI(state.app, initial); else closeAppUI(initial); }
    if (initial || prev.folder !== state.folder) { if (state.folder) openFolderUI(initial); else closeFolderUI(initial); }
    if (initial || prev.sheet !== state.sheet) { if (state.sheet) openSheetUI(state.sheet, initial); else closeSheetUI(initial); }
    setInert();
  }
  /** Leave the current entry the app pushed (history.back), or rewrite it if the page was opened there. */
  function popTo(next, key) {
    const h = history.state;
    if (h && h.byApp && h[key]) { skipPop++; history.back(); } else replaceRoute(next);
    render(next);
  }
  function unlock() {
    if (state.view === 'home') return;
    pushRoute({ view: 'home', sheet: null, app: null, folder: false });
  }
  function lockScreen() {
    if (state.view === 'lock') return;
    const next = { view: 'lock', sheet: null, app: null, folder: false };
    const h = history.state;
    if (h && h.byApp && h.view === 'home' && !h.sheet && !h.app && !h.folder) { skipPop++; history.back(); render(next); } else pushRoute(next);
  }
  function openSheet(key) {
    if (!D.sheets[key] || state.sheet === key) return;
    pushRoute({ ...state, sheet: key });
  }
  const closeSheet = () => { if (state.sheet) popTo({ ...state, sheet: null }, 'sheet'); };
  const closeApp = () => { if (state.app) popTo({ ...state, app: null }, 'app'); };
  const closeFolder = () => { if (state.folder) popTo({ ...state, folder: false }, 'folder'); };
  function openApp(key, rect) {
    if (!APPS.includes(key)) return;
    launchRect = rect || null;
    if (state.sheet) {
      // a panel's "Open" button: turn the panel's entry into the unlocked home screen, then open the app
      const home = { view: 'home', sheet: null, app: null, folder: false };
      replaceRoute(home);
      render(home);
    } else if (state.view !== 'home') {
      pushRoute({ view: 'home', sheet: null, app: null, folder: false });
    }
    if (state.app === key) return;
    pushRoute({ view: 'home', sheet: null, app: key, folder: false });
  }
  function openFolder(sel) {
    if (sel != null) folderSel = sel;
    if (state.sheet) { const home = { view: 'home', sheet: null, app: null, folder: false }; replaceRoute(home); render(home); }
    if (state.view !== 'home') pushRoute({ view: 'home', sheet: null, app: null, folder: false });
    if (state.folder) { renderFolder(); return; }
    pushRoute({ view: 'home', sheet: null, app: null, folder: true });
  }
  window.addEventListener('popstate', () => {
    if (skipPop > 0) { skipPop--; return; }
    if (overlay) closeOverlay({ noFocus: true });
    render(parseRoute());
  });

  // ---------------------------------------------------------------- gestures
  // One pointer handler for the whole page picks a gesture after a few pixels:
  //   from the top edge (or the Today button), down -> the Today panel follows the finger
  //   from the bottom edge, up         -> Quick settings
  //   lock screen, to the right        -> unlock (on an update card: unlock into its app)
  //   lock screen, sideways on the row -> drags the widget row (mouse; touch scrolls natively)
  //   home screen, down                -> Search
  //   inside Today / Quick settings, back the other way -> close
  const G = { id: null };
  let suppressClick = false;
  doc.addEventListener('pointerdown', (e) => {
    if (G.id !== null || !e.isPrimary) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const t = e.target;
    const top = topLayer();
    const cands = [];
    const edge = t.closest('#edgeTop, #ncGrab') ? 'top' : t.closest('#edgeBottom') ? 'bottom' : null;
    const base = top === 'lock' || top === 'home' || top === 'app';
    if (edge === 'top' && base) cands.push('nc');
    if (edge === 'bottom' && base) cands.push('cc');
    if (!edge && top === 'lock' && E.lock.contains(t)) {
      if (E.track.contains(t)) { if (e.pointerType === 'mouse') cands.push('row'); } else if (!onEarth(e)) cands.push('unlock');
    }
    if (!edge && top === 'home' && E.home.contains(t) && !t.closest('.dock, .quick a')) cands.push('spot');
    if (top === 'nc' && NC.layer.contains(t) && (t.closest('#ncClose') || (e.pointerType === 'mouse' && !t.closest('button, a')))) cands.push('ncClose');
    if (top === 'cc' && CC.layer.contains(t) && (t.closest('#ccClose') || (!t.closest('button, a') && t.closest('.cc-panel')))) cands.push('ccClose');
    if (!cands.length) return;
    Object.assign(G, {
      id: e.pointerId, type: e.pointerType, x0: e.clientX, y0: e.clientY, kind: null, cands, el: t,
      note: t.closest('.note'), sl0: E.track.scrollLeft, lastX: e.clientX, lastY: e.clientY, lastT: e.timeStamp, vx: 0, vy: 0, d: 0,
    });
  });
  function beginGesture(k) {
    if (k === 'row') E.track.classList.add('dragging');
    else if (k === 'unlock') body.classList.add('sliding');
    else if (k === 'nc' || k === 'cc' || k === 'spot') { prepareOverlay(k); OV[k].classList.add('dragging'); }
    else if (k === 'ncClose') NC.layer.classList.add('dragging');
    else if (k === 'ccClose') CC.layer.classList.add('dragging');
  }
  /** A panel pulled out by a finger: phones slide a sheet; wide screens fade the popover in. */
  function pullPanel(panel, scrim, d, from) {
    const p = clamp(d / 200, 0, 1);
    scrim.style.opacity = p.toFixed(3);
    if (wide() || reduced) {
      panel.style.opacity = p.toFixed(3);
      panel.style.transform = `translate3d(0, ${(-8 * (1 - p)).toFixed(1)}px, 0)`;
    } else {
      panel.style.opacity = '1';
      panel.style.transform = from === 'top' ? `translate3d(0, calc(-100% + ${d.toFixed(1)}px), 0)` : `translate3d(0, max(0px, calc(100% - ${d.toFixed(1)}px)), 0)`;
    }
  }
  function moveGesture(k, dx, dy) {
    if (k === 'row') {
      E.track.scrollLeft = G.sl0 - dx;
    } else if (k === 'unlock') {
      G.d = Math.max(0, dx);
      E.lockFg.style.transform = `translate3d(${G.d.toFixed(1)}px, 0, 0)`;
      E.lockFg.style.opacity = (1 - clamp(G.d / ((innerWidth || 800) * 0.9), 0, 0.55)).toFixed(3);
    } else if (k === 'nc') {
      G.d = Math.max(0, dy);
      pullPanel(NC.panel, NC.scrim, G.d, 'top');
    } else if (k === 'cc') {
      G.d = Math.max(0, -dy);
      pullPanel(CC.panel, CC.scrim, G.d, 'bottom');
    } else if (k === 'spot') {
      G.d = Math.max(0, dy);
      const p = clamp(G.d / 110, 0, 1);
      SP.scrim.style.opacity = p.toFixed(3);
      SP.panel.style.opacity = p.toFixed(3);
      SP.panel.style.transform = `translate3d(0, ${(-14 + 14 * p).toFixed(1)}px, 0)`;
    } else if (k === 'ncClose') {
      G.d = Math.min(0, dy);
      NC.panel.style.transform = `translate3d(0, ${G.d.toFixed(1)}px, 0)`;
    } else if (k === 'ccClose') {
      G.d = Math.max(0, dy);
      CC.panel.style.transform = `translate3d(0, ${G.d.toFixed(1)}px, 0)`;
    }
  }
  doc.addEventListener('pointermove', (e) => {
    if (e.pointerId !== G.id) return;
    const dx = e.clientX - G.x0;
    const dy = e.clientY - G.y0;
    if (!G.kind) {
      if (Math.hypot(dx, dy) < 8) return;
      const vert = Math.abs(dy) > Math.abs(dx);
      const c = G.cands;
      let k = null;
      if (vert && dy > 0 && c.includes('nc')) k = 'nc';
      else if (vert && dy < 0 && c.includes('cc')) k = 'cc';
      else if (vert && dy > 0 && c.includes('spot')) k = 'spot';
      else if (vert && dy < 0 && c.includes('ncClose')) k = 'ncClose';
      else if (vert && dy > 0 && c.includes('ccClose')) k = 'ccClose';
      else if (!vert && c.includes('row')) k = 'row';
      else if (!vert && dx > 0 && c.includes('unlock')) k = 'unlock';
      if (!k) { G.id = null; return; }
      G.kind = k;
      try { G.el.setPointerCapture(e.pointerId); } catch (err) { /* pointer already released */ }
      beginGesture(k);
    }
    const dt = e.timeStamp - G.lastT;
    if (dt > 0) {
      G.vx = 0.7 * ((e.clientX - G.lastX) / dt) + 0.3 * G.vx;
      G.vy = 0.7 * ((e.clientY - G.lastY) / dt) + 0.3 * G.vy;
    }
    G.lastX = e.clientX;
    G.lastY = e.clientY;
    G.lastT = e.timeStamp;
    moveGesture(G.kind, dx, dy);
  });
  function clearPull(panel, scrim) {
    panel.style.transform = '';
    panel.style.opacity = '';
    if (scrim) scrim.style.opacity = '';
  }
  function endGesture(e) {
    if (e.pointerId !== G.id) return;
    const k = G.kind;
    G.id = null;
    if (!k) return;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    const cancel = e.type === 'pointercancel';
    const H = innerHeight || 800;
    const W = innerWidth || 1000;
    if (k === 'row') {
      const dx = e.clientX - G.x0;
      const from = nearest(G.sl0);
      let i = nearest(E.track.scrollLeft);
      if (!cancel && i === from && Math.abs(dx) > 40) i = from + (dx < 0 ? 1 : -1);
      i = clamp(i, 0, snaps.length - 1);
      E.track.scrollTo({ left: snaps[i], behavior: reduced ? 'auto' : 'smooth' });
      whenSettled(snaps[i], () => E.track.classList.remove('dragging'));
    } else if (k === 'unlock') {
      const go = !cancel && (G.d > Math.min(W * 0.32, 220) || (G.vx > 0.45 && G.d > 30));
      body.classList.remove('sliding');
      E.lockFg.style.transform = '';
      E.lockFg.style.opacity = '';
      if (go) { if (G.note) openApp(G.note.dataset.app, G.note.getBoundingClientRect()); else unlock(); }
    } else if (k === 'nc' || k === 'cc' || k === 'spot') {
      const el = OV[k];
      const go = !cancel && (k === 'spot' ? G.d > 60 : (G.d > H * 0.22 || (Math.abs(k === 'nc' ? G.vy : -G.vy) > 0.45 && G.d > 30 && (k === 'nc' ? G.vy > 0 : G.vy < 0))));
      el.classList.remove('dragging');
      if (k === 'nc') clearPull(NC.panel, NC.scrim);
      if (k === 'cc') clearPull(CC.panel, CC.scrim);
      if (k === 'spot') clearPull(SP.panel, SP.scrim);
      if (go) openOverlay(k); else abortOverlay(k);
    } else if (k === 'ncClose' || k === 'ccClose') {
      const nc = k === 'ncClose';
      const go = !cancel && (Math.abs(G.d) > 60 || (nc ? G.vy < -0.45 : G.vy > 0.45));
      (nc ? NC : CC).layer.classList.remove('dragging');
      (nc ? NC : CC).panel.style.transform = '';
      if (go) closeOverlay();
    }
  }
  doc.addEventListener('pointerup', endGesture);
  doc.addEventListener('pointercancel', endGesture);
  doc.addEventListener('click', (e) => {
    if (suppressClick) { e.preventDefault(); e.stopImmediatePropagation(); suppressClick = false; }
  }, true);

  // Wheel and trackpad: sideways scrolls the row natively; a vertical wheel over the row
  // pages it; scrolling down anywhere else on the lock screen unlocks. One step per gesture.
  const W8 = { last: -1e9, acc: 0, used: false };
  E.lock.addEventListener('wheel', (e) => {
    if (e.ctrlKey || topLayer() !== 'lock') return;
    let dx = e.deltaX;
    let dy = e.deltaY;
    if (e.deltaMode === 1) { dx *= 16; dy *= 16; } else if (e.deltaMode === 2) { dx *= innerHeight; dy *= innerHeight; }
    if (Math.abs(dx) >= Math.abs(dy)) return;
    const inTrack = E.track.contains(e.target);
    const sc = E.lockInner;
    if (!inTrack && sc.scrollHeight > sc.clientHeight + 4) {
      const atEnd = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2;
      if (!(atEnd && dy > 0)) return; // short screens scroll first
    }
    e.preventDefault();
    if (e.timeStamp - W8.last > 260) { W8.acc = 0; W8.used = false; }
    W8.last = e.timeStamp;
    if (W8.used) return;
    W8.acc += dy;
    if (Math.abs(W8.acc) < 40) return;
    W8.used = true;
    if (inTrack) goTo(nearest(E.track.scrollLeft) + (W8.acc > 0 ? 1 : -1));
    else if (W8.acc > 0) unlock();
  }, { passive: false });
  // On the home screen, scrolling up past the top pulls Search down.
  const HW = { last: -1e9, acc: 0, used: false, fromTop: true };
  E.home.addEventListener('wheel', (e) => {
    if (e.ctrlKey || topLayer() !== 'home') return;
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 16; else if (e.deltaMode === 2) dy *= innerHeight;
    if (Math.abs(e.deltaX) > Math.abs(dy)) return;
    if (e.timeStamp - HW.last > 300) { HW.acc = 0; HW.used = false; HW.fromTop = E.homeScroll.scrollTop <= 0; }
    HW.last = e.timeStamp;
    if (dy > 0) { HW.fromTop = false; return; }
    if (HW.used || !HW.fromTop) return;
    HW.acc += dy;
    if (HW.acc < -80) { HW.used = true; openOverlay('spot'); }
  }, { passive: true });

  // Drag a widget panel down by its handle or header to close it.
  const SD = { id: null };
  S.sheet.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary || !e.target.closest('.grab, .sheet-head') || e.target.closest('button, a')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    Object.assign(SD, { id: e.pointerId, y0: e.clientY, lastY: e.clientY, lastT: e.timeStamp, v: 0, dy: 0 });
    try { S.sheet.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    S.sheet.classList.add('dragging');
  });
  S.sheet.addEventListener('pointermove', (e) => {
    if (e.pointerId !== SD.id) return;
    const dt = e.timeStamp - SD.lastT;
    if (dt > 0) SD.v = 0.7 * ((e.clientY - SD.lastY) / dt) + 0.3 * SD.v;
    SD.lastY = e.clientY;
    SD.lastT = e.timeStamp;
    const raw = e.clientY - SD.y0;
    SD.dy = raw > 0 ? raw : raw / 6; // a little give upwards
    S.sheet.style.transform = `translate3d(0, ${SD.dy}px, 0)`;
  });
  function endSheetDrag(e) {
    if (e.pointerId !== SD.id) return;
    SD.id = null;
    S.sheet.classList.remove('dragging');
    const close = e.type !== 'pointercancel' && (SD.dy > Math.min(140, S.sheet.offsetHeight * 0.3) || (SD.v > 0.6 && SD.dy > 20));
    S.sheet.style.transform = '';
    if (close) closeSheet();
  }
  S.sheet.addEventListener('pointerup', endSheetDrag);
  S.sheet.addEventListener('pointercancel', endSheetDrag);

  // ---------------------------------------------------------------- clicks
  doc.addEventListener('click', (e) => {
    const t = e.target;
    let pb = t.closest('.pl-btn');
    if ((!pb && t === E.plBtns) || (pb && pb.dataset.planet === 'earth' && e.detail > 0)) {
      const i = planetAt(e.clientX, e.clientY);
      if (i >= 0 || !pb) pb = i >= 0 ? $$('.pl-btn', E.plBtns)[i] : null;
    }
    if (pb) { hideCard(); openApp(pb.dataset.app, pb.getBoundingClientRect()); return; }
    const cmd = t.closest('[data-cmd]');
    if (cmd) {
      if (cmd.tagName === 'A') { closeOverlay({ noFocus: true }); return; }
      runCommand(cmd.dataset.cmd);
      return;
    }
    if (t.closest('#tonightW')) { const c = cityById(E.tonightW.dataset.city); if (c) setSkyCity(c, false); openApp('sky', E.tonightW.getBoundingClientRect()); return; }
    if (appKey === 'sky' && A.body.contains(t)) {
      if (t.closest('#skyGeo')) { skyGeo(); return; }
      const sw = t.closest('#skyRed, #skyNames, #skyTrails, #skyGrid');
      if (sw) {
        const key = { skyRed: 'red', skyNames: 'names', skyTrails: 'trails', skyGrid: 'grid' }[sw.id];
        SKY[key] = !SKY[key];
        sw.setAttribute('aria-pressed', String(SKY[key]));
        paintSky();
        return;
      }
      if (t.closest('#skyMoreBtn')) {
        SKY.more = !SKY.more;
        $('#skyMoreBtn', A.body).setAttribute('aria-expanded', String(SKY.more));
        $('#skyMore', A.body).hidden = !SKY.more;
        return;
      }
      const rd = t.closest('#skyFace [role="radio"], #skyBright [role="radio"]');
      if (rd) { skyRadio(rd, false); return; }
      if (t.closest('#skyAlbany')) { setSkyCity(cityById('albany'), true); paintSky(); $('#skyQ', A.body).focus({ preventScroll: true }); return; }
      if (t.closest('#skySave')) { skySave(); return; }
      if (t.closest('#skyCopy')) { skyCopy(); return; }
      if (t.closest('#skyIcs')) { skyIcs(); return; }
      if (t.closest('#skyAim')) { skyAim(); return; }
      if (t.closest('#cgStart')) { cgStart(); return; }
      if (t.closest('#cgHint')) { cgHint(); return; }
      const star = t.closest('.cg-star');
      if (star) {
        // close stars' targets overlap: a pointer picks the star nearest to it, a key the focused one
        let i = Number(star.dataset.i);
        if (e.detail > 0) {
          let bd = Infinity;
          for (const b of $$('.cg-star', A.body)) {
            const r = b.getBoundingClientRect();
            const dd = Math.hypot(r.left + r.width / 2 - e.clientX, r.top + r.height / 2 - e.clientY);
            if (dd < bd) { bd = dd; i = Number(b.dataset.i); }
          }
        }
        cgPick(i);
        return;
      }
      const md = t.closest('#skyMode [role="radio"]');
      if (md) {
        if (md.dataset.sky === 'tonight') { SKY.mode = 'tonight'; SKY.t = tonightTime(skyT()); } else SKY.mode = 'now';
        paintSky();
        return;
      }
    }
    if (appKey === 'clock' && t.closest('#clkTrue')) { setTrueScale(!TS.on); return; }
    // R3.3 batch 3: the quick view (#154), present mode (#155), the pick game (#121)
    if (t.closest('#briefLink')) { e.preventDefault(); openBrief(); return; }
    if (state.view === 'brief' && BR.el.contains(t)) {
      if (t.closest('#briefBack')) { e.preventDefault(); leaveView(); return; }
      if (t.closest('#briefPrint')) { window.print(); return; }
      const lb = t.closest('button[data-lang]');
      if (lb) { applyLang(lb.dataset.lang, true); const again = $(`#brief button[data-lang="${lb.dataset.lang}"]`); if (again) again.focus({ preventScroll: true }); return; }
    }
    if (appKey === 'storewright' && SG) {
      if (t.closest('#sgAgain')) { gameStart(GM.seed + 1); gamePaint(); return; }
      if (t.closest('#sgShow')) { GM.show = !GM.show; gamePaint(); return; }
      const board = t.closest('#sgBoard');
      if (board) {
        const pick = t.closest('[data-node]');
        const n = pick ? Number(pick.dataset.node) : gameNodeAt(e.clientX, e.clientY);
        if (n >= 0) gameWalk(n);
        board.focus({ preventScroll: true });
        return;
      }
    }
    if (t.closest('#gbLoad')) { loadGuestbook(); return; }
    if (t.closest('[data-site="about"]')) { openOverlay('about'); return; }
    const sl = t.closest('.site-link[data-app], .ab-link[data-app]');
    if (sl) { if (overlay) closeOverlay({ noFocus: true }); openApp(sl.dataset.app, ($('.ico', sl) || sl).getBoundingClientRect()); return; }
    if (t.closest('#ctShare')) { contactShare(); return; }
    if (appKey === 'sky' && t.closest('#skyShare')) { shareLink(skyShareURL(), fmt(C().app.sky.imageTitle, { place: placeName(SKY.city) })); return; }
    if (appKey === 'assets' && assetsClick(t)) return;
    if (appKey === 'design' && t.closest('#dsPlay')) { playMotion(); return; }
    const w = t.closest('.w[data-sheet]');
    if (w) {
      if (NC.layer.contains(w)) {
        closeOverlay({ noFocus: true });
        if (state.view === 'lock') openSheet(w.dataset.sheet); else openApp(WIDGET_APP[w.dataset.sheet]);
      } else openSheet(w.dataset.sheet);
      return;
    }
    const n = t.closest('.note');
    if (n) { openApp(n.dataset.app, n.getBoundingClientRect()); return; }
    const a = t.closest('.app[data-app], .dock-app[data-app]');
    if (a) {
      if (a.dataset.app === 'early') openFolder(); else if (a.dataset.app === 'guestbook') openGuestbook(); else openApp(a.dataset.app, $('.ico', a).getBoundingClientRect());
      return;
    }
    const ni = t.closest('.nc-item');
    if (ni) { closeOverlay({ noFocus: true }); openApp(ni.dataset.app); return; }
    const sr = t.closest('.sp-row');
    if (sr) {
      const ic = $('.ico', sr);
      const r = ic && ic.getBoundingClientRect();
      closeOverlay({ noFocus: true });
      if (sr.dataset.body) skyGoTo(sr.dataset.body);
      else if (sr.dataset.early != null) openFolder(Number(sr.dataset.early));
      else if (sr.dataset.app === 'early') openFolder();
      else if (sr.dataset.app === 'guestbook') openGuestbook();
      else openApp(sr.dataset.app, r);
      return;
    }
    const g = t.closest('[data-goto]');
    if (g) { openApp(g.dataset.goto); return; }
    const cal = t.closest('[data-cal]');
    if (cal && A.body.contains(cal)) {
      const [y, m] = calMonth;
      const d = new Date(Date.UTC(y, m - 1 + (cal.dataset.cal === 'next' ? 1 : -1), 1));
      calMonth = [d.getUTCFullYear(), d.getUTCMonth() + 1];
      renderApp('calendar');
      const again = $(`[data-cal="${cal.dataset.cal}"]`, A.body);
      if (again) again.focus({ preventScroll: true });
    }
  });
  E.unlock.addEventListener('click', unlock);
  E.unlock.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); unlock(); }
  });
  E.lockBtn.addEventListener('click', lockScreen);
  E.ncGrab.addEventListener('click', () => toggleOverlay('nc'));
  E.ccGrab.addEventListener('click', () => toggleOverlay('cc'));
  E.searchBtn.addEventListener('click', () => openSpotlight());
  CC.tt.addEventListener('click', () => { closeOverlay({ noFocus: true }); ttOpen(); });
  K.close.addEventListener('click', () => closeOverlay());
  K.scrim.addEventListener('click', () => closeOverlay());
  AB.close.addEventListener('click', () => closeOverlay());
  AB.scrim.addEventListener('click', () => closeOverlay());
  TR.next.addEventListener('click', () => { if (TR.i >= C().tour.steps.length - 1) { endTour(); E.unlock.focus({ preventScroll: true }); } else { TR.i++; paintTour(true); } });
  TR.skip.addEventListener('click', () => { endTour(); E.unlock.focus({ preventScroll: true }); });
  radios(TT.scale, 'scale', (v) => { if (v !== TT.mode) { ttBackToNow(); ttSetMode(v); } });
  NC.close.addEventListener('click', () => closeOverlay());
  NC.scrim.addEventListener('click', () => closeOverlay());
  CC.close.addEventListener('click', () => closeOverlay());
  CC.scrim.addEventListener('click', () => closeOverlay());
  SP.cancel.addEventListener('click', () => closeOverlay());
  SP.scrim.addEventListener('click', () => closeOverlay());
  SP.input.addEventListener('input', renderSpot);
  SP.input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { const f = $('.sp-row', SP.list); if (f) { e.preventDefault(); f.focus(); } }
    if (e.key === 'Enter') { const f = $('.sp-row', SP.list); if (f && SP.input.value.trim()) { e.preventDefault(); f.click(); } }
  });
  SP.list.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const rows = $$('.sp-row', SP.list);
    const i = rows.indexOf(doc.activeElement);
    if (i < 0) return;
    e.preventDefault();
    if (e.key === 'ArrowUp' && i === 0) SP.input.focus();
    else rows[clamp(i + (e.key === 'ArrowDown' ? 1 : -1), 0, rows.length - 1)].focus();
  });
  S.close.addEventListener('click', closeSheet);
  S.scrim.addEventListener('click', closeSheet);
  S.open.addEventListener('click', () => openApp(S.open.dataset.app));
  A.back.addEventListener('click', closeApp);
  NC.tabToday.addEventListener('click', () => setNCTab('today'));
  NC.tabAll.addEventListener('click', () => setNCTab('all'));
  $('.nc-tabs').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    setNCTab(NC.tabAll.getAttribute('aria-selected') === 'true' ? 'today' : 'all', true);
  });
  function radios(group, attr, apply) {
    group.addEventListener('click', (e) => { const b = e.target.closest('[role="radio"]'); if (b) apply(b.dataset[attr]); });
    group.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step) return;
      const items = $$('[role="radio"]', group);
      const i = items.indexOf(doc.activeElement);
      if (i < 0) return;
      e.preventDefault();
      const n = items[(i + step + items.length) % items.length];
      apply(n.dataset[attr]);
      n.focus();
    });
  }
  radios(CC.appearance, 'appearance', (v) => applyAppearance(v, true));
  radios(CC.weight, 'weight', (v) => applyWeight(v, true));
  CC.lang.addEventListener('click', () => applyLang(lang === 'zh' ? 'en' : 'zh', true));
  CC.motion.addEventListener('click', () => setReduced(!reduced, true));
  CC.parallax.addEventListener('click', () => { if (!reduced) setParallax(!parallaxOn, true); });
  CC.sound.addEventListener('click', () => { if (!reduced) setSound(!SND.on); });
  CC.standby.addEventListener('click', () => { SB.auto = !SB.auto; store.set('ls7-standby', SB.auto ? 'on' : 'off'); SB.last = Date.now(); syncCC(); });
  for (const b of $$('button[data-lang]')) b.addEventListener('click', () => applyLang(b.dataset.lang, true));
  E.dots.addEventListener('click', (e) => {
    const b = e.target.closest('.dot');
    if (b) goTo(Number(b.dataset.i));
  });
  E.dots.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key) || !e.target.closest('.dot')) return;
    e.preventDefault();
    const i = clamp(activeIdx + (e.key === 'ArrowRight' ? 1 : -1), 0, snaps.length - 1);
    goTo(i);
    const d = $$('.dot', E.dots)[i];
    if (d) d.focus({ preventScroll: true });
  });
  E.track.addEventListener('scroll', () => {
    if (!E.track._raf) E.track._raf = requestAnimationFrame(() => { E.track._raf = 0; syncDots(); });
  }, { passive: true });
  E.track.addEventListener('focusin', (e) => {
    const b = e.target.closest('.w');
    if (b) { setRoving(b); reveal(b); }
  });
  E.track.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const btns = widgetButtons();
    let i = btns.indexOf(doc.activeElement);
    if (i < 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = btns.length - 1;
    else i = clamp(i + (e.key === 'ArrowRight' ? 1 : -1), 0, btns.length - 1);
    setRoving(btns[i]);
    btns[i].focus({ preventScroll: true });
    reveal(btns[i]);
  });
  E.lockInner.addEventListener('scroll', () => { queueGlow(); if (state.view === 'lock') syncScrolled(); }, { passive: true });
  E.homeScroll.addEventListener('scroll', () => { if (state.view === 'home') syncScrolled(); }, { passive: true });

  // ---------------------------------------------------------------- keys
  const MODAL = { sheet: () => S.sheet, app: () => A.view, folder: () => F.layer, spot: () => SP.panel, nc: () => NC.panel, cc: () => CC.panel, keys: () => K.panel, about: () => AB.panel, standby: () => SB.el };
  function trapTab(e, box) {
    const items = $$('a[href], button:not([disabled]), input', box).filter((x) => x.tabIndex >= 0 && (x.offsetParent !== null) && !x.closest('[hidden]'));
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const a = doc.activeElement;
    if (e.shiftKey && (a === first || !box.contains(a) || a.tabIndex < 0)) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && (a === last || !box.contains(a))) { e.preventDefault(); first.focus(); }
  }
  function escape() {
    if (SB.on) { exitStandby(); return true; }
    if (TR.i >= 0) { endTour(); E.unlock.focus({ preventScroll: true }); return true; }
    if (overlay) { closeOverlay(); return true; }
    if (state.view === 'brief' || state.view === 'present') { leaveView(); return true; }
    if (state.sheet) { closeSheet(); return true; }
    if (state.folder) { closeFolder(); return true; }
    if (TT.open) { ttClose(); return true; }
    if (travelling()) { ttBackToNow(); return true; }
    if (state.app) { closeApp(); return true; }
    if (state.view === 'home') { lockScreen(); return true; }
    return false;
  }
  doc.addEventListener('keydown', (e) => {
    if (e.defaultPrevented) return;
    const k = e.key;
    // R3.3 batch 3: present mode turns its slides; the quick view is a plain page (Esc leaves both,
    // the page's own shortcuts are off there, the browser's, such as printing, still work)
    if ((state.view === 'present' || state.view === 'brief') && !overlay && !SB.on) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (state.view === 'present') presentKey(e); else if (k === 'Escape') { e.preventDefault(); leaveView(); }
      return;
    }
    // Cmd+K (Ctrl+K elsewhere) opens or closes Search from anywhere, even from a text field
    if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && (k === 'k' || k === 'K')) {
      e.preventDefault();
      if (!e.repeat) { if (overlay === 'spot') closeOverlay(); else openSpotlight(); }
      return;
    }
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const top = topLayer();
    if (k === 'Escape') { if (escape()) e.preventDefault(); return; }
    if (k === 'Tab' && MODAL[top]) { trapTab(e, MODAL[top]()); return; }
    const typing = !!(e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]'));
    if (typing) return;
    if (!e.repeat && (k === 'n' || k === 'N')) { e.preventDefault(); toggleOverlay('nc'); return; }
    if (!e.repeat && (k === 'c' || k === 'C')) { e.preventDefault(); toggleOverlay('cc'); return; }
    if (!e.repeat && (k === 't' || k === 'T')) { e.preventDefault(); if (overlay) closeOverlay({ noFocus: true }); ttToggle(); return; }
    if (!e.repeat && k === '?') { e.preventDefault(); toggleOverlay('keys'); return; }
    if (!e.repeat && (k === 'i' || k === 'I')) { e.preventDefault(); toggleOverlay('about'); return; }
    if (k === '/') { e.preventDefault(); openSpotlight(); return; }
    if (top !== 'lock') return;
    // lock screen, nothing focused: arrows page the widgets; Enter, Space, up and Page Down unlock
    const t = e.target;
    if (!(t === body || t === root || t === E.lock || t == null)) return;
    if (k === 'ArrowRight' || k === 'ArrowLeft') { e.preventDefault(); goTo(nearest(E.track.scrollLeft) + (k === 'ArrowRight' ? 1 : -1)); } else if (k === 'ArrowUp' || k === 'Enter' || k === ' ' || k === 'PageDown') { e.preventDefault(); unlock(); }
  });

  // ---------------------------------------------------------------- system changes
  const onChange = (mq, fn) => (mq.addEventListener ? mq.addEventListener('change', fn) : mq.addListener(fn));
  onChange(mqLight, () => { if (apPref === 'auto') applyAppearance('auto', false); });
  onChange(mqReduce, () => {
    if (query.get('motion') === 'reduce' || store.get('ls7-motion')) return; // a choice was made
    setReduced(mqReduce.matches, false);
  });
  let resizeTimer = 0;
  const remeasure = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const i = activeIdx;
      measure();
      goTo(i, false);
      checkHomeFits();
      placeGlow(false);
      measureOrbit();
      if (orbitOn) paintOrbit();
      if (appKey === 'sky') queueSky();
      if (TR.i >= 0) placeTour();
      if (appKey === 'assets') paintWallpapers();
      if (appKey === 'how') paintHow();
    }, 100);
  };
  if ('ResizeObserver' in window) new ResizeObserver(remeasure).observe(E.track); else window.addEventListener('resize', remeasure);
  window.addEventListener('resize', () => setTimeout(() => { checkHomeFits(); placeGlow(false); if (appKey === 'how') paintHow(); }, 120));
  doc.addEventListener('visibilitychange', () => { if (!doc.hidden) { tick(); lastStep = 0; if (orbitOn) paintOrbit(); } });

  // ---------------------------------------------------------------- start
  body.classList.add('no-anim');
  setText(E.kbdHint, searchKey());
  for (const a of $$('.cc-links a[data-icon]')) a.insertAdjacentHTML('afterbegin', icon(a.dataset.icon));
  buildTrack();
  buildNCWidgets();
  buildPlanetButtons();
  renderHome();
  applyAppearance(apPref, false);
  applyWeight(weight, false);
  applyLang(lang, false);
  clockLoop();
  measure();
  const page = query.get('page');
  if (page) {
    const n = page === 'mid' ? Math.ceil(snaps.length / 2) : parseInt(page, 10);
    if (n > 0) { goTo(n - 1, false); syncDots(); }
  }
  const first = parseRoute();
  const open = query.get('open');
  if (query.has('home') || open === 'folder') first.view = 'home';
  if (D.sheets[query.get('sheet')]) first.sheet = query.get('sheet');
  if (APPS.includes(query.get('app'))) { first.view = 'home'; first.app = query.get('app'); }
  if (open === 'folder') { first.folder = true; first.app = null; }
  render(first, true);
  if (open === 'nc' || open === 'nc-all') openOverlay('nc', { tab: open === 'nc-all' ? 'all' : 'today', instant: true });
  else if (open === 'cc') openOverlay('cc', { instant: true });
  else if (open === 'spotlight') openOverlay('spot', { q: query.get('q') || '', instant: true });
  else if (open === 'keys') openOverlay('keys', { instant: true });
  else if (open === 'about') openOverlay('about', { instant: true });
  else if (open === 'tt' || open === 'tt-dates') { if (open === 'tt-dates') TT.mode = 'dates'; ttOpen(); }
  requestAnimationFrame(() => requestAnimationFrame(() => { body.classList.remove('no-anim'); checkHomeFits(); placeGlow(false); }));
  {
    // #118: ?standby=<seconds> turns standby on for this visit, after that many idle seconds (a preview flag)
    const q = Number(query.get('standby'));
    if (q > 0) { SB.auto = true; SB.idleMs = q * 1000; syncCC(); }
  }
  // #119: the tour, once, on a first visit that starts on the plain lock screen (?tour=1 shows it again)
  if ((query.get('tour') === '1' || store.get('ls7-tour') !== 'done') && first.view === 'lock' && !first.sheet && !open) TR.timer = setTimeout(startTour, 1200);
  // #148: whoever opens the console gets a hello and the way to the guestbook
  try {
    const cl = C().console;
    console.log(fmt(cl.greet, { repo: D.profileRepo }));
    console.log(fmt(cl.note, { key: searchKey() }));
  } catch (e) { /* no console */ }
})();
