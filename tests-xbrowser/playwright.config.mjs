// Playwright settings for the cross-browser smoke test (idea #178): Chromium, Firefox and WebKit
// (Safari's engine), in Albany's time zone so the page's own choices (the Sky app picks a city
// from the visitor's zone) are the same on every runner. Used by .github/workflows/xbrowser.yml.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.mjs$/,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  outputDir: 'results/artifacts',
  reporter: [['list'], ['html', { outputFolder: 'results/report', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4180',
    timezoneId: 'America/New_York',
    locale: 'en-US',
    colorScheme: 'dark',
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  webServer: {
    command: 'node serve.mjs',
    url: 'http://127.0.0.1:4180/',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
