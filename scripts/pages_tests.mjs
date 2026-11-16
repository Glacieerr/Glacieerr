// Runs the interactive page's checks (pages/tests/test.mjs, over CDP in headless Chrome), with
// one retry, because headless Chrome on a CI machine now and then stumbles (idea #125). Used by
// .github/workflows/pages.yml; the same command works on a Mac.
//   node scripts/pages_tests.mjs              build pages/dist/index.html, then test it
//   node scripts/pages_tests.mjs --no-build   test the page as it is
//   node scripts/pages_tests.mjs --dry-run    say what would run, run nothing
// Chrome: $CHROME, else the usual places (Linux: google-chrome; Mac: /Applications/Google Chrome.app).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const has = (f) => process.argv.includes(f);
const dry = has('--dry-run');
const tries = Number(process.env.PAGES_TEST_TRIES || 2);

function chrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const which = (b) => spawnSync('sh', ['-c', `command -v ${b}`], { encoding: 'utf8' }).stdout.trim();
  for (const b of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    const p = which(b);
    if (p) return p;
  }
  const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  return existsSync(mac) ? mac : null;
}

function run(cmd, args, env = {}) {
  console.log(`$ ${[cmd, ...args].join(' ')}`);
  if (dry) return 0;
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...env } });
  return r.status ?? 1;
}

const bin = chrome();
if (!bin && !dry) {
  console.error('pages_tests: no Chrome found; set CHROME to its binary');
  process.exit(1);
}
console.log(`Chrome: ${bin || '(none found)'}`);
if (!has('--no-build') && run('python3', ['pages/build.py']) !== 0) process.exit(1);
let status = 1;
for (let i = 1; i <= tries && status !== 0; i++) {
  if (i > 1) console.log(`\npages_tests: run ${i - 1} failed; trying once more (headless Chrome is sometimes flaky on CI)\n`);
  status = run('node', ['pages/tests/cdp.mjs', 'pages/tests/test.mjs'], { CHROME: bin || '' });
}
process.exit(status);
