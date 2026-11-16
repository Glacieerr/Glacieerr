// Smoke test of the interactive page in Chromium, Firefox and WebKit (idea #178), on Linux, macOS
// and Windows (.github/workflows/xbrowser.yml). The full checks stay in pages/tests/test.mjs on
// headless Chrome; these few look for what differs between browsers: the clock's time zone, the
// Chinese text and the browser's Chinese calendar, the date input, the moving planets and reduced
// motion, the photos (WebP since R3.3 batch 6), script errors, and any request that would leave
// the page (it makes none).
// Screenshots go to results/screens/<os>-<browser>-<name>.png, to look at the Chinese fonts.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const ORIGIN = 'http://127.0.0.1:4180';
const SHOTS = fileURLToPath(new URL('./results/screens/', import.meta.url));

/** What goes wrong while a test runs: script errors, console errors, requests off the page. */
function watch(page) {
  const problems = [];
  page.on('pageerror', (e) => problems.push(`script error: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console error: ${m.text()}`);
  });
  page.on('request', (r) => {
    const url = r.url();
    if (!url.startsWith(ORIGIN) && !/^(data|blob|about):/.test(url)) problems.push(`network request: ${url}`);
  });
  return problems;
}

async function shot(page, testInfo, name) {
  mkdirSync(SHOTS, { recursive: true });
  const path = join(SHOTS, `${process.platform}-${testInfo.project.name}-${name}.png`);
  await page.screenshot({ path });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

/** Albany's hour and minute as the browser's own Intl says ("9:04"). */
const albanyHM = (page) => page.evaluate(() => {
  const o = {};
  const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true });
  for (const p of f.formatToParts(new Date())) o[p.type] = p.value;
  return `${o.hour}:${o.minute}`;
});

// The first-visit tour (#119) would cover the lock screen in every screenshot: mark it as seen.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('ls7-tour', 'done'); } catch (e) { /* storage blocked */ } });
});

test('the lock screen loads with no errors and no requests off the page, showing Albany time', async ({ page }, testInfo) => {
  const problems = watch(page);
  await page.goto('/?lang=en');
  const hm = page.locator('#hm');
  await expect(hm).toHaveText(/^\d{1,2}:\d{2}$/);
  const before = await albanyHM(page);
  const shown = (await hm.textContent()).trim();
  const after = await albanyHM(page);
  expect([before, after]).toContain(shown);                  // either side of a minute change
  await expect(page.locator('#date')).toHaveText(/^[A-Z][a-z]+day, [A-Z][a-z]+ \d{1,2}/);
  await page.waitForTimeout(1000);
  await shot(page, testInfo, 'lock-en');
  expect(problems).toEqual([]);
});

test('in Chinese the page and its date line are Chinese (screenshot for the fonts)', async ({ page }, testInfo) => {
  const problems = watch(page);
  await page.goto('/?lang=zh');
  await expect(page.locator('html')).toHaveAttribute('lang', /^zh/);
  await expect(page.locator('#date')).toHaveText(/[一-鿿]/);
  await page.waitForTimeout(1000);
  await shot(page, testInfo, 'lock-zh');
  expect(problems).toEqual([]);
});

test("the browser's Chinese calendar puts the Spring Festival of 2026 on February 17", async ({ page }) => {
  await page.goto('/?lang=zh');
  const cal = await page.evaluate(() => {
    const f = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric' });
    const parts = Object.fromEntries(f.formatToParts(new Date(Date.UTC(2026, 1, 17, 4))).map((p) => [p.type, p.value]));
    return { calendar: f.resolvedOptions().calendar, month: parts.month, day: parts.day };
  });
  expect(cal.calendar).toBe('chinese');
  expect(cal.month).toBe('正月');
  expect(['1', '初一']).toContain(cal.day);
});

test('the Sky app draws its chart and takes a date from the date field (a leap day)', async ({ page }, testInfo) => {
  const problems = watch(page);
  await page.goto('/?lang=en#sky');
  await expect(page.locator('#appView')).toHaveAttribute('data-app', 'sky');
  const chart = page.locator('#skyChart svg').first();
  await expect(chart).toBeVisible();
  const box = await chart.boundingBox();
  expect(box && box.width).toBeGreaterThan(100);
  expect(box && box.height).toBeGreaterThan(100);
  const date = page.locator('#skyDate');
  await date.fill('2028-02-29');
  await date.dispatchEvent('change');                        // fill sends it too; twice does no harm
  await expect(date).toHaveValue('2028-02-29');
  await expect(page.locator('#skyAt')).toContainText('Feb 29');
  await shot(page, testInfo, 'sky');
  expect(problems).toEqual([]);
});

test('every photo the page carries decodes in this browser (most are WebP since batch 6, idea #180)', async ({ page }, testInfo) => {
  const problems = watch(page);
  await page.goto('/?lang=en#home/storewright');
  await expect(page.locator('#appView')).toHaveAttribute('data-app', 'storewright');
  const photos = await page.evaluate(async () => {
    const urls = new Set();
    for (const sheet of document.styleSheets) {
      for (const rule of sheet.cssRules) {
        const m = (rule.cssText || '').match(/url\("?(data:image\/(?:webp|jpeg)[^")]+)"?\)/);
        if (m) urls.add(m[1]);
      }
    }
    let decoded = 0;
    const types = new Set();
    for (const u of urls) {
      const img = new Image();
      img.src = u;
      try { await img.decode(); if (img.naturalWidth > 0) decoded++; } catch (e) { /* counted as not decoded */ }
      types.add(u.slice(5, u.indexOf(';')));
    }
    return { n: urls.size, decoded, types: [...types].sort() };
  });
  expect(photos.n).toBeGreaterThanOrEqual(10);
  expect(photos.decoded).toBe(photos.n);
  expect(photos.types).toEqual(['image/jpeg', 'image/webp']);
  await shot(page, testInfo, 'storewright');
  expect(problems).toEqual([]);
});

test('the planets move, and stand still when the visitor asks for reduced motion', async ({ page }) => {
  // Mercury on the far half of its ring: each planet is drawn twice (behind the avatar and in
  // front of it), and a locator must name one element
  const planet = page.locator('#orbit .planets-far [data-o="0"]');
  await page.goto('/?lang=en');
  await expect(planet).toHaveAttribute('transform', /translate/);
  await page.waitForTimeout(1500);
  const a = await planet.getAttribute('transform');
  await page.waitForTimeout(1000);
  expect(await planet.getAttribute('transform')).not.toBe(a);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expect(planet).toHaveAttribute('transform', /translate/);
  await page.waitForTimeout(1500);
  const b = await planet.getAttribute('transform');
  await page.waitForTimeout(1000);
  expect(await planet.getAttribute('transform')).toBe(b);
});
