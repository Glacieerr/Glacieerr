// Per-project numbers for the project pages (idea #158), read from a checkout, never typed by
// hand. Writes data/project-numbers.json:
//   storewright  commits, first and last commit dates, unit tests (total and by part), released
//                versions (git tags), from a git checkout of Glacieerr/storewright
//   silnest      version and dates from data/silnest-store.json (the App Store lookup); the app's
//                own repository is private, so nothing is read from it
// It only reads: git log / rev-list / tag / ls-files, and the tracked files. The checkout needs its full history
// (actions/checkout with fetch-depth: 0); in a shallow clone the commit numbers are left out.
//
// How tests are counted (the same way as the 800+ in the facts list, checked 2026-11-13): every
// it(...) / test(...) declaration, including .only, .concurrent, .fails and .each, but not .skip
// or .todo, in the files the Vitest configs include (vitest.config.* at the root and in each
// workspace). Playwright's end-to-end tests are not counted. Vitest itself reports more, because
// a declaration inside a loop or an .each runs once per case: part 1's 379 declarations run as
// the 383 tests its README states (checked 2026-11-14, batch 6).
// Parts follow the config that runs a file: the root config is part 1 (apps/ and packages/*/src),
// a config inside packages/<name>/ is one of the standalone libraries (packages/yard and
// packages/overlap-audit, extracted from StoreX Chain and tested with it on CI, not by part 1's
// npm test), StoreX/ is part 2 and StoreX-Chain/ part 3.
//
//   node scripts/project_numbers.mjs --repo storewright            (CI: the workflow's checkout)
//   node scripts/project_numbers.mjs --repo "/path/to/storewright" --dry-run   (print, write nothing)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const arg = (k, d = null) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const repo = resolve(ROOT, arg('repo', 'storewright'));
const out = resolve(ROOT, arg('out', 'data/project-numbers.json'));
const dry = process.argv.includes('--dry-run');
// the folder of the Vitest config that runs a test file -> the part of the portfolio it belongs to
// (README "Portfolio parts" and "Reusable pieces")
const PART_OF_CONFIG = (dir) => (dir === '' ? 'storewright' : dir.startsWith('packages/') ? 'libraries'
  : dir === 'StoreX/' ? 'storex' : dir === 'StoreX-Chain/' ? 'storexChain' : 'other');

const git = (...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

/** The files git tracks (what the public repository holds; no node_modules, nothing untracked). */
const tracked = () => git('ls-files', '-z').split('\0').filter(Boolean);

/** A glob ('packages/*' + '/src/**' + '/*.test.ts') as a RegExp over paths with forward slashes. */
function globRe(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') { re += glob[i + 2] === '/' ? '(?:.*/)?' : '.*'; i += glob[i + 2] === '/' ? 2 : 1; } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

/** The include globs of every tracked vitest.config.*, relative to the repo. */
function vitestIncludes(all) {
  const configs = all.filter((f) => /(^|\/)vitest\.config\.(ts|mts|js|mjs)$/.test(f));
  const globs = [];
  for (const cfg of configs) {
    const text = readFileSync(join(repo, cfg), 'utf8');
    const m = text.match(/include\s*:\s*\[([^\]]*)\]/);
    const dir = cfg.includes('/') ? cfg.slice(0, cfg.lastIndexOf('/') + 1) : '';
    const list = m ? [...m[1].matchAll(/['"`]([^'"`]+)['"`]/g)].map((x) => x[1]) : ['**/*.{test,spec}.?(c|m)[jt]s?(x)'];
    for (const g of list) globs.push({ config: cfg, dir, glob: dir + g.replace(/^\.\//, '') });
  }
  return globs;
}

const DECL = /^\s*(?:it|test)((?:\.(?:only|skip|todo|concurrent|sequential|fails))*)(?:\.each\s*\([^)]*\))?\s*\(/;

function countTests() {
  const all = tracked();
  const globs = vitestIncludes(all);
  const res = globs.map((g) => ({ re: globRe(g.glob), part: PART_OF_CONFIG(g.dir) }));
  const files = all.filter((f) => res.some((g) => g.re.test(f)));
  const byPart = {};
  const byFolder = {};
  let total = 0;
  for (const f of files) {
    let n = 0;
    for (const line of readFileSync(join(repo, f), 'utf8').split('\n')) {
      const m = line.match(DECL);
      if (m && !/\.(skip|todo)\b/.test(m[1])) n++;
    }
    const top = f.split('/')[0];
    // the most specific config that includes the file decides its part
    const part = res.filter((g) => g.re.test(f)).map((g) => g.part).sort((a, b) => (a === 'storewright') - (b === 'storewright'))[0];
    byPart[part] = (byPart[part] || 0) + n;
    byFolder[top] = (byFolder[top] || 0) + n;
    total += n;
  }
  return { total, byPart, byFolder, files: files.length, configs: [...new Set(globs.map((g) => g.config))].sort(), globs: globs.map((g) => g.glob) };
}

function storewright() {
  if (!existsSync(join(repo, '.git'))) throw new Error(`${repo} is not a git checkout`);
  const shallow = git('rev-parse', '--is-shallow-repository') === 'true';
  const dates = git('log', '--reverse', '--format=%ad', '--date=short').split('\n').filter(Boolean);
  const tags = git('tag', '--list', '--sort=-creatordate').split('\n').filter(Boolean);
  const latestTag = (prefix) => tags.find((t) => t.startsWith(prefix)) || null;
  const pkg = (p) => { try { return JSON.parse(readFileSync(join(repo, p, 'package.json'), 'utf8')).version || null; } catch { return null; } };
  const tests = countTests();
  const floor100 = (n) => `${Math.floor(n / 100) * 100}+`;
  return {
    source: 'git checkout of Glacieerr/storewright',
    head: git('rev-parse', '--short', 'HEAD'),
    shallow,
    commits: shallow ? null : Number(git('rev-list', '--count', 'HEAD')),
    firstCommit: shallow ? null : dates[0] || null,
    lastCommit: dates[dates.length - 1] || null,
    tests: tests.total,
    testsLabel: floor100(tests.total),
    testsByPart: tests.byPart,
    testsByFolder: tests.byFolder,
    testFiles: tests.files,
    testsMethod: 'it/test declarations (with .only, .concurrent, .fails, .each; without .skip and .todo) in the files '
      + 'the Vitest configs include; end-to-end tests not counted',
    vitestConfigs: tests.configs,
    // Part 1 is not tagged; parts 2 and 3 get storex-v* and storex-chain-v* tags when released (RELEASING.md)
    released: { storewright: latestTag('v'), storex: latestTag('storex-v'), storexChain: latestTag('storex-chain-v') },
    declaredVersions: { storex: pkg('StoreX'), storexChain: pkg('StoreX-Chain') },
  };
}

function silnest() {
  const p = join(ROOT, 'data', 'silnest-store.json');
  if (!existsSync(p)) return null;
  const s = JSON.parse(readFileSync(p, 'utf8'));
  return { source: 'App Store lookup (data/silnest-store.json)', version: s.version, released: s.released, updated: s.updated,
    releaseNotes: s.releaseNotes || null };
}

let data;
try {
  data = { note: 'Generated by scripts/project_numbers.mjs. Do not edit.', generatedAt: new Date().toISOString(),
    storewright: storewright(), silnest: silnest() };
} catch (e) {
  console.error(`project_numbers: ${e.message}; keeping the last ${relative(ROOT, out)}`);
  process.exit(dry ? 1 : 0);
}
const sw = data.storewright;
if (sw.shallow) console.warn('project_numbers: shallow checkout, so commits and the first commit date are left out (use fetch-depth: 0)');
const summary = `Storewright ${sw.head}: ${sw.commits ?? '?'} commits, ${sw.firstCommit ?? '?'} to ${sw.lastCommit}, `
  + `${sw.tests} unit tests (${Object.entries(sw.testsByFolder).map(([k, v]) => `${k} ${v}`).join(', ')}), `
  + `released: ${Object.entries(sw.released).map(([k, v]) => `${k} ${v || 'none'}`).join(', ')}`;
if (dry) {
  console.log(JSON.stringify(data, null, 2));
  console.log(`\n(dry run) ${summary}`);
} else {
  writeFileSync(out, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`wrote ${relative(ROOT, out)}: ${summary}`);
}
