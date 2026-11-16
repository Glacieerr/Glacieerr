// The page at the edges of time (idea #177): the clock, the Today panel, the Calendar, the Sky
// app and time travel across the night the clocks spring forward (2026-03-08) and the night they
// fall back (2026-11-01) in Albany, a leap day (2028-02-29), New Year's Eve into 2027, Sydney's
// own changes, and visitors whose zones are half an hour off or change on other days.
// Part 8 of pages/tests/test.mjs; on its own (about 40 s):
//   node pages/tests/cdp.mjs pages/tests/time-edges.mjs
// Each check sets the page's clock to a moment before the page's scripts run (Date runs on from
// there; the page reads the time only through Date) and the browser's time zone with DevTools.
// What the page should say is worked out here from live/astro.mjs and Intl, independently of
// the page's own code.
import * as Astro from '../../live/astro.mjs';
import { CITIES } from '../../live/sky-data.mjs';

const NY = 'America/New_York';
const SYD = 'Australia/Sydney';
const clockAt = (ms) => `(() => { const T = ${ms}; const RD = Date; const off = T - RD.now();
  function FD(...a) { if (!new.target) return new RD(RD.now() + off).toString(); return a.length ? new RD(...a) : new RD(RD.now() + off); }
  FD.prototype = RD.prototype; FD.now = () => RD.now() + off; FD.UTC = RD.UTC; FD.parse = RD.parse; Object.defineProperty(FD, 'name', { value: 'Date' }); window.Date = FD; })();`;
// Node's Intl and Chrome's may put a narrow no-break space before AM and PM
const sp = (s) => String(s).replace(/[\u202f\u00a0]/g, ' ');
const fmtIn = (ms, opts, tz = NY) => sp(new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts }).format(new Date(ms)));
const hmIn = (ms, tz = NY) => fmtIn(ms, { hour: 'numeric', minute: '2-digit' }, tz);
const ymd = (ms, tz) => { const p = Astro.zonedParts(ms, tz); return Date.UTC(p.year, p.month - 1, p.day) / 864e5; };

export async function timeEdges(api, ok, D) {
  const { sleep } = api;
  let clockId = null;
  const setClock = async (iso) => {
    if (clockId) await api.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: clockId });
    clockId = iso ? (await api.send('Page.addScriptToEvaluateOnNewDocument', { source: clockAt(Date.parse(iso)) })).identifier : null;
  };
  const zone = (id) => api.send('Emulation.setTimezoneOverride', { timezoneId: id });
  const ev = async (expr) => { const v = await api.eval(expr); return JSON.parse(sp(JSON.stringify(v))); };
  const lockNow = `(() => { const $ = (id) => document.getElementById(id); return [$('hm').textContent + ' ' + $('ap').textContent, $('date').textContent, $('timeSr').textContent, document.documentElement.dataset.festival || '', $('fest').hidden ? '' : $('fest').textContent]; })()`;
  const calNow = `(() => { const b = document.getElementById('appBody'); return [b.querySelector('.cal-top h3').textContent, b.querySelector('.cal-month').textContent, (b.querySelector('.month-grid .d.today .dn') || {}).textContent || '', document.querySelector('[data-cal="d"]').textContent, b.querySelectorAll('.month-grid .d:not(.blank)').length, b.querySelectorAll('.month-grid .d.blank').length]; })()`;
  const skyNow = `(() => { const $ = (id) => document.getElementById(id); return { at: $('skyAt').textContent, meta: $('skyMeta').textContent, date: $('skyDate').value, hash: location.hash, sun: ($('skyTonight').querySelector('.tv-row .tv-v') || {}).textContent || '', day: ($('skyDay').querySelector('.sky-day-main') || {}).textContent || '', days: [...$('skyDay').querySelectorAll('.sky-day-sub')].map((p) => p.textContent).join(' | ') }; })()`;
  const slide = (v) => api.eval(`(() => { const r = document.getElementById('ttRange'); r.value = '${v}'; r.dispatchEvent(new Event('input', { bubbles: true })); return r.value; })()`);
  const city = (id) => { const r = CITIES.find((x) => x[0] === id); return { lat: r[3], lon: r[4] }; };
  const alb = city('albany');
  const syd = city('sydney');
  try {
    await zone(NY);
    await api.viewport(1280, 800, { dark: true });

    // ---- the clock through the two nights the clocks change
    const across = [];
    for (const iso of ['2026-03-08T06:59:57Z', '2026-11-01T05:59:57Z']) {
      await setClock(iso);
      await api.go('?lang=en', 250);
      const a = await ev(lockNow);
      await sleep(3200);
      across.push([a, await ev(lockNow)]);
    }
    ok(across[0][0][0] === '1:59 AM' && across[0][1][0] === '3:00 AM' && across[0][1][2] === '3:00 AM' && across[0][1][1] === 'Sunday, March 8'
      && across[1][0][0] === '1:59 AM' && across[1][1][0] === '1:00 AM' && across[1][1][2] === '1:00 AM' && across[1][1][1] === 'Sunday, November 1',
    '#177 the clock at the daylight-saving changes: 1:59 AM, then 3:00 AM on March 8, 2026 (2 AM never shows); 1:59 AM, then 1:00 AM again on November 1, the same date; screen readers hear the same', JSON.stringify(across));

    // ---- New Year's Eve, with the Calendar open across midnight
    await setClock('2027-01-01T04:59:57Z');
    await api.go('?lang=en#home/calendar', 250);
    const ny0 = [await ev(lockNow), await ev(calNow)];
    await sleep(3200);
    const ny1 = [await ev(lockNow), await ev(calNow)];
    ok(ny0[0][1] === 'Thursday, December 31' && !ny0[0][3] && ny0[1].slice(0, 4).join('|') === 'Thursday December 31, 2026|December 2026|31|31'
      && ny1[0][0] === '12:00 AM' && ny1[0][1] === 'Friday, January 1' && ny1[0][3] === 'new-year' && ny1[0][4] === '✺'
      && ny1[1].join('|') === 'Friday January 1, 2027|January 2027|1|1|31|5',
    '#177 New Year: at midnight the date turns to Friday, January 1 with its firework, and a Calendar left open moves on to January 1, 2027 (it used to keep December 31 as today)', JSON.stringify([ny0, ny1]));

    // ---- a leap day: Today, the Calendar, the Sky app's daylight
    const leapT = Date.parse('2028-02-29T15:00:00Z');
    await setClock('2028-02-29T15:00:00Z');
    await api.go('?lang=en&open=nc', 600);
    const leapNC = await ev(`[document.getElementById('ncDate').textContent, document.getElementById('ncSeason').textContent]`);
    await api.go('?lang=en#home/calendar', 600);
    const leapCal = await ev(calNow);
    await api.go('?lang=en#sky/albany', 900);
    const leapSky = await ev(skyNow);
    const eq28 = Astro.seasons(leapT).next;
    const dl = Math.round(Astro.daylight(Astro.zonedTime(2028, 2, 29, 12, 0, NY), alb.lat, alb.lon).minutes);
    const leapSeason = `Spring equinox in ${ymd(eq28.t, NY) - ymd(leapT, NY)} days · ${fmtIn(eq28.t, { month: 'short', day: 'numeric' })}`;
    ok(leapNC[0] === 'Tuesday, February 29' && leapNC[1].endsWith(leapSeason) && leapSeason === 'Spring equinox in 19 days · Mar 19'
      && leapCal.join('|') === 'Tuesday February 29, 2028|February 2028|29|29|29|2'
      && leapSky.date === '2028-02-29' && leapSky.day === `Feb 29: ${Math.floor(dl / 60)} h ${dl % 60} min of daylight` && leapSky.days.includes('Longest: Jun 20 ('),
    '#177 a leap day: Today says Tuesday, February 29 and "Spring equinox in 19 days · Mar 19" (10:17 PM on March 19 in Albany); the Calendar has 29 days in February 2028 with the 29th as today; the Sky app\'s daylight line and curve hold the day', JSON.stringify([leapNC, leapCal, leapSky.date, leapSky.day, leapSky.days]));

    // ---- the morning the clocks sprang forward: Today in both languages, the Calendar's Moons, the Sky app
    const springT = Date.parse('2026-03-08T07:00:30Z');
    await setClock('2026-03-08T07:00:30Z');
    await api.go('?lang=en&open=nc', 600);
    const spNC = await ev(`[document.getElementById('ncSummary').textContent, document.getElementById('ncSeason').textContent]`);
    await api.go('?lang=zh&open=nc', 600);
    const spZh = await ev(`document.getElementById('ncSeason').textContent`);
    await api.go('?lang=en#home/calendar', 600);
    const spMoons = await ev(`[...document.querySelectorAll('#appBody .cal-moons li')].map((l) => l.textContent)`);
    const cc = D.copy.en.app.calendar;
    const wantMoons = Astro.moonPhases(Astro.zonedTime(2026, 3, 1, 0, 0, NY), Astro.zonedTime(2026, 4, 1, 0, 0, NY))
      .map((p) => cc.moonItem.replace('{date}', fmtIn(p.t, { month: 'short', day: 'numeric' })).replace('{phase}', cc.phases[p.q]).replace('{time}', hmIn(Math.round(p.t / 6e4) * 6e4)));
    await api.go('?lang=en#sky/albany', 900);
    const spSky = await ev(skyNow);
    const n = Astro.tonight(springT, alb.lat, alb.lon, NY);
    ok(spNC[0].startsWith('It\'s 3:00 AM in Albany.') && spNC[1].endsWith('Spring equinox in 12 days · Mar 20') && spZh.endsWith('下一个节气：春分，3月20日（北京时间，还有 12 天）')
      && JSON.stringify(spMoons) === JSON.stringify(wantMoons) && spMoons[1] === 'Mar 11, Last quarter, 5:39 AM'
      && /Albany time \(EDT\)$/.test(spSky.meta) && spSky.at === 'Mar 8 · 3:00 AM' && spSky.sun === `Sunset ${hmIn(n.sunset)} · Sunrise ${hmIn(n.sunrise)}` && spSky.sun === 'Sunset 5:52 PM · Sunrise 7:18 AM',
    '#177 the morning after the clocks spring forward: Today counts 12 days to the equinox (in Chinese too, to 春分 on its Beijing date, also March 20), the Calendar gives each Moon in the time then in force (the last quarter on March 11 at 5:39 AM EDT, the full Moon on March 3 at 6:38 AM EST), and the Sky app says EDT and gives last night\'s sunset in EST time and this morning\'s sunrise in EDT', JSON.stringify([spNC, spZh, spMoons, spSky]));

    // ---- the Sky app's links in the hour the clocks repeat, and Sydney's own changes
    await setClock('2026-11-01T06:30:00Z');
    await api.go('?lang=en#sky/albany', 900);
    const fbSky = await ev(skyNow);
    const nf = Astro.tonight(Date.parse('2026-11-01T06:30:00Z'), alb.lat, alb.lon, NY);
    await api.go('?lang=en#sky/albany/2026-11-01/01:50', 900);
    const first = await ev(skyNow);
    // the slider moves in steps of 10 minutes from 30 minutes before sunset: step on into EST
    let second = first;
    for (let k = 0; k < 3 && !/\(EST\)$/.test(second.meta); k++) {
      await api.eval(`(() => { const r = document.getElementById('skyRange'); r.value = String(Number(r.value) + 1); r.dispatchEvent(new Event('input', { bubbles: true })); })()`);
      await sleep(450);
      second = await ev(skyNow);
    }
    await api.go(`?lang=en${second.hash}`, 900);
    const again = await ev(skyNow);
    await api.go('?lang=en#sky/sydney/2026-10-04/02:30', 900);
    const sydSpring = await ev(skyNow);
    await api.go('?lang=en#sky/sydney/2026-04-05/02:30', 900);
    const sydFall = await ev(skyNow);
    const ns = Astro.tonight(Astro.zonedTime(2026, 10, 4, 3, 30, SYD), syd.lat, syd.lon, SYD);
    ok(/Albany time \(EST\)$/.test(fbSky.meta) && fbSky.sun === `Sunset ${hmIn(nf.sunset)} · Sunrise ${hmIn(nf.sunrise)}` && fbSky.sun === 'Sunset 5:48 PM · Sunrise 6:28 AM'
      && first.at === 'Nov 1 · 1:50 AM' && /\(EDT\)$/.test(first.meta) && /^Nov 1 · 1:0\d AM$/.test(second.at) && /\(EST\)$/.test(second.meta) && /\/2026-11-01\/01:0\d-0500$/.test(second.hash)
      && again.at === second.at && /\(EST\)$/.test(again.meta)
      && sydSpring.at === 'Oct 4 · 3:30 AM' && sydSpring.sun === `Sunset ${hmIn(ns.sunset, SYD)} · Sunrise ${hmIn(ns.sunrise, SYD)}` && sydFall.at === 'Apr 5 · 2:30 AM' && sydFall.meta === sydSpring.meta,
    '#177 the Sky app in the hour that happens twice: EST after the change, and a link to the second 1:0x AM carries its offset (-0500) so it opens on that one, not an hour earlier; Sydney\'s 2:30 AM that never happens (October 4) opens at 3:30 AM, and its repeated one (April 5) at the first, still in summer time (live/astro.mjs gave the second east of Greenwich)', JSON.stringify([fbSky, first, second, again, sydSpring, sydFall]));

    // ---- time travel in the repeated hour, across the skipped one, and by whole days across a change
    await setClock('2026-11-01T06:45:00Z');                // the second 1:45 AM (EST)
    await api.go('?lang=en&open=tt#sky/albany', 900);
    const ttv = `(() => { const $ = (id) => document.getElementById(id); return [$('hm').textContent + ' ' + $('ap').textContent, $('ttBadge').hidden, $('skyAt').textContent, $('skyMeta').textContent.split(' · ').pop()]; })()`;
    await slide(106);
    await sleep(400);
    const t1 = await ev(ttv);
    await slide(119);
    await sleep(400);
    const t2 = await ev(ttv);
    await setClock('2026-03-08T12:00:00Z');
    await api.go('?lang=en&open=tt', 700);
    await slide(150);
    await sleep(250);
    const t3 = await ev(lockNow);
    await setClock('2026-11-15T15:00:00Z');                // 10:00 AM EST
    await api.go('?lang=en&open=tt-dates', 700);
    await slide(-200);
    await sleep(250);
    const t4 = await ev(`[document.getElementById('ttBadgeTxt').textContent, document.getElementById('date').textContent]`);
    ok(t1[0] === '1:45 AM' && t1[1] && t2[0] === '1:59 AM' && !t2[1] && t2[2] === 'Nov 1 · 1:59 AM' && t2[3] === 'Times in Albany time (EST)'
      && t3[0] === '3:00 AM' && t4[0] === 'Time travel · Wed, Apr 29, 10:00 AM' && t4[1] === 'Wednesday, April 29',
    '#177 time travel: in the hour that happens twice, a minute on is a minute on (1:46 is now, not an hour back; 1:59 is the EST one); 2:30 AM on March 8, which never happens, is the jump to 3:00 AM; and 200 days back from 10:00 AM EST is 10:00 AM EDT (it used to be 11:00 AM)', JSON.stringify([t1, t2, t3, t4]));

    // ---- the visitor's own time: the Clock app across Europe's change (a week before Albany's), half-hour zones
    await zone('Europe/London');
    await setClock('2026-10-28T16:00:00Z');
    await api.go('?lang=en#home/clock', 900);
    const yours = `[...document.querySelectorAll('#appBody [data-live="rel"], #appBody [data-live="mytime"]')].map((e) => e.textContent)`;
    const lon0 = await ev(yours);
    await api.key('t');
    await sleep(350);
    await api.eval(`document.querySelector('#ttScale [data-scale="dates"]').click()`);
    await sleep(150);
    await slide(10);
    await sleep(1100);
    const lon1 = await ev(yours);
    await zone('Australia/Adelaide');
    await setClock('2026-11-01T06:30:00Z');
    await api.go('?lang=en', 600);
    const adl = await ev(`document.getElementById('greet').textContent`);
    ok(lon0.join('|') === '4 hr ahead of Albany|4:00 PM' && lon1.join('|') === '5 hr ahead of Albany|5:00 PM'
      && adl === 'Good afternoon · it\'s 5:00 PM where you are, 15.5 hr ahead of Albany',
    '#177 the visitor\'s own time: in London in the week between Europe\'s change and Albany\'s the Clock app says 4 hr ahead, and traveling past November 1 makes it 5 hr (that row used to stay on the real time); in Adelaide, half an hour off and in its summer, 15.5 hr ahead', JSON.stringify([lon0, lon1, adl]));

    // ---- #152 the greeting by the hour of the visitor's clock (here Albany's own): before 5 AM a
    // plain "Hello" (it used to say "Good evening" at 2 AM), then morning from 5, evening at 11 PM
    await zone(NY);
    const greetAt = async (iso, lng) => { await setClock(iso); await api.go(`?lang=${lng}`, 450); return ev(`[document.getElementById('greet').hidden, document.getElementById('greet').textContent]`); };
    const greets = [];
    for (const iso of ['2026-11-16T07:00:00Z', '2026-11-16T10:00:00Z', '2026-11-17T04:00:00Z']) greets.push([await greetAt(iso, 'en'), await greetAt(iso, 'zh')]);
    ok(greets.every(([e, z]) => !e[0] && !z[0]) && greets.map(([e, z]) => `${e[1]}/${z[1]}`).join('|') === 'Hello/你好|Good morning/早上好|Good evening/晚上好',
      '#152 the greeting goes by the hour: at 2:00 AM "Hello" (你好), at 5:00 AM "Good morning" (早上好), at 11:00 PM "Good evening" (晚上好)', JSON.stringify(greets));

    // ---- #95 the solar terms on their Beijing dates in Chinese, as Chinese calendars print them;
    // the equinoxes and solstices on their Albany dates in English, as American calendars do. Each
    // case is the evening of the Albany date of the term's moment, after the moment, when it is
    // already the next day in Beijing: the lunar line still names the term before, the next-term
    // line says "tomorrow" with the Beijing date, and the term is on the next day beside Earth.
    const bjISO = (ms) => new Date(ms + 8 * 36e5).toISOString().slice(0, 10);
    const zhT = D.copy.zh.lunar.terms;
    const termCase = async (i, year, before) => {
      const x = Astro.solarTerms(Date.UTC(year, 0, 1) - 8 * 36e5, Date.UTC(year + 1, 0, 1) - 8 * 36e5).find((s) => s.i === i);
      const albD = new Intl.DateTimeFormat('en-CA', { timeZone: NY, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(x.t));
      const evening = Astro.zonedTime(...albD.split('-').map(Number), 21, 0, NY);
      await setClock(new Date(evening).toISOString());
      await api.go('?lang=zh&open=nc', 700);
      const lines = await ev(`[document.getElementById('lunar').textContent, (document.querySelector('#ncSeason .nc-next') || {}).textContent || '']`);
      await api.go('?lang=zh', 700);
      await api.eval(`document.querySelector('.pl-btn[data-planet="earth"]').focus()`);
      await sleep(120);
      await api.key('ArrowRight');
      await sleep(250);
      const next = await ev(`[(document.querySelector('#plCard .pc-name') || {}).textContent || '', (document.querySelector('#plCard .pc-event') || {}).textContent || '', document.getElementById('lunar').textContent]`);
      await api.key('ArrowLeft');
      await sleep(250);
      const back = await ev(`[(document.querySelector('#plCard .pc-name') || {}).textContent || '', (document.querySelector('#plCard .pc-event') || {}).textContent || '']`);
      const [, bm, bd] = bjISO(x.t).split('-').map(Number);
      return { term: zhT[i], alb: albD, bj: bjISO(x.t), before: zhT[before], lines, next, back,
        good: x.t < evening && albD !== bjISO(x.t) && lines[0].endsWith(` · ${zhT[before]}`) && lines[1] === `下一个节气：${zhT[i]}，明天，${bm}月${bd}日（北京时间）`
          && next[0] === `${bjISO(x.t).slice(0, 4)}年${bm}月${bd}日` && next[1] === zhT[i] && next[2].endsWith(` · ${zhT[i]}`) && back[1] === '' };
    };
    // 2026: 清明 April 4 in Albany, April 5 in Beijing; 立春 Feb 3 / Feb 4; 秋分 Sep 22 / Sep 23; 冬至 Dec 21 / Dec 22
    const cases = [await termCase(1, 2026, 0), await termCase(21, 2026, 20), await termCase(12, 2026, 11), await termCase(18, 2026, 17)];
    ok(cases.every((c) => c.good) && cases.map((c) => `${c.term} ${c.alb.slice(5)}/${c.bj.slice(5)}`).join(', ') === '清明 04-04/04-05, 立春 02-03/02-04, 秋分 09-22/09-23, 冬至 12-21/12-22',
      '#95 in Chinese every solar term sits on its Beijing date: on the evening of April 4, 2026 in Albany (清明 has begun: it is April 5 in Beijing) the lunar line still says 春分, Today says "下一个节气：清明，明天，4月5日（北京时间）" and 清明 is on April 5 beside Earth; the same for 立春 (Feb 4), 秋分 (Sep 23) and 冬至 (Dec 22)',
      JSON.stringify(cases.map(({ good, ...c }) => c)));
    // English keeps Albany's date: the 2027 March equinox is March 20 in Albany (4:24 PM), March 21 in Beijing
    const eq = Astro.solarTerms(Date.UTC(2027, 2, 1), Date.UTC(2027, 3, 1)).find((s) => s.i === 0);
    await setClock('2027-03-20T22:00:00Z');
    const eqCard = async (lng) => {
      await api.go(`?lang=${lng}`, 700);
      await api.eval(`document.querySelector('.pl-btn[data-planet="earth"]').focus()`);
      await sleep(120);
      await api.key('ArrowRight');
      await sleep(250);
      const on21 = await ev(`(document.querySelector('#plCard .pc-event') || {}).textContent || ''`);
      await api.key('ArrowLeft');
      await sleep(250);
      const on20 = await ev(`(document.querySelector('#plCard .pc-event') || {}).textContent || ''`);
      return [on20, on21];
    };
    const eqEn = await eqCard('en');
    const eqZh = await eqCard('zh');
    ok(bjISO(eq.t) === '2027-03-21' && fmtIn(eq.t, { month: 'numeric', day: 'numeric' }) === '3/20' && eqEn.join('|') === 'March equinox|' && eqZh.join('|') === `|${zhT[0]}`,
      '#95 English keeps the Albany date: beside Earth the 2027 March equinox is on March 20 (4:24 PM in Albany), while in Chinese 春分 is on March 21, its date in Beijing',
      JSON.stringify([eqEn, eqZh, new Date(eq.t).toISOString()]));
  } finally {
    await setClock(null);
    await zone('');
  }
}

// on its own: node pages/tests/cdp.mjs pages/tests/time-edges.mjs
export default async function (api) {
  let pass = 0;
  let fail = 0;
  const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, extra); } };
  await api.viewport(1280, 800, { dark: true });
  await api.go('?lang=en', 600);
  const D = await api.eval(`JSON.parse(document.getElementById('data').textContent)`);
  await timeEdges(api, ok, D);
  const errs = api.consoleMsgs.filter((m) => /error|EXCEPTION/i.test(m));
  ok(errs.length === 0, 'no console errors', JSON.stringify(errs.slice(0, 5)));
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
}
