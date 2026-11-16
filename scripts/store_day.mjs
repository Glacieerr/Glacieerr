#!/usr/bin/env node
/**
 * Run one simulated Storewright store day headlessly and print a JSON summary.
 *
 *   node scripts/store_day.mjs --repo <path to a storewright checkout> --date YYYY-MM-DD
 *
 * The checkout needs its npm dependencies. Only zod and the root devDependency tsx are
 * used, so a filtered install is enough:
 *   npm ci --ignore-scripts -w @storewright/sim-cli --include-workspace-root
 *
 * It simulates the same day as `npm run sim -- --seed YYYYMMDD`: the CLI defaults
 * (medium template, optimized policy, catalog seed 7), with the date as the seed.
 * Every store, item, order and customer is synthetic. Same date and same commit give
 * the same JSON.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const USAGE = 'usage: node store_day.mjs --repo <path to a storewright checkout> --date YYYY-MM-DD';

function fail(message) {
  console.error(`store_day: ${message}`);
  process.exit(1);
}

let args;
try {
  args = parseArgs({ options: { repo: { type: 'string' }, date: { type: 'string' } } }).values;
} catch (err) {
  fail(`${err.message}\n${USAGE}`);
}
if (!args.repo || !args.date) fail(USAGE);

const date = args.date;
const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
if (!ymd || new Date(Date.UTC(+ymd[1], +ymd[2] - 1, +ymd[3])).toISOString().slice(0, 10) !== date) fail(`not a calendar date: ${date}`);
const seed = Number(ymd[1] + ymd[2] + ymd[3]);

// The storewright packages export TypeScript source, so load them through the checkout's own tsx.
const repo = resolve(args.repo);
const requireFromRepo = createRequire(join(repo, 'package.json'));
let register;
try {
  ({ register } = requireFromRepo('tsx/esm/api'));
} catch {
  fail(`cannot load tsx from ${join(repo, 'node_modules')}; run npm ci in the checkout first`);
}
register({ tsconfig: join(repo, 'tsconfig.json') });
const load = (pkg) => import(pathToFileURL(requireFromRepo.resolve(pkg)).href);
const [{ formatClock }, { createTemplate, StoreModel }, { generateCatalog, generateOrders }, { OPTIMIZED, defaultScenario, simulateDay }] = await Promise.all(
  ['@storewright/domain', '@storewright/store-config', '@storewright/synth', '@storewright/sim-engine'].map(load),
);

// Same calls as `run` in apps/sim-cli/src/main.ts, with retainEvents on (as with --events)
// so the picks can be counted per hour.
const TEMPLATE = 'medium';
const model = new StoreModel(createTemplate(TEMPLATE));
const scenario = defaultScenario(TEMPLATE);
const catalog = generateCatalog(model, { seed: 7 });
const orders = generateOrders(model, catalog, scenario.demand, { seed });
const { metrics: m, events } = simulateDay({ model, items: catalog.byId, orders, scenario, policy: OPTIMIZED, seed, retainEvents: true });

// Items picked per hour, from an hour before opening (when picking starts) to closing.
const { openMin, closeMin } = model.config.hours;
let first = Math.floor(openMin / 60) - 1;
let last = Math.ceil(closeMin / 60) - 1;
const picked = new Map();
for (const e of events) {
  const units = e.type === 'ItemPicked' ? e.payload.qty : e.type === 'OversizedPicked' ? 1 : 0;
  if (!units) continue;
  const h = Math.floor(e.t / 3600);
  picked.set(h, (picked.get(h) ?? 0) + units);
  first = Math.min(first, h);
  last = Math.max(last, h);
}
const points = [];
for (let h = first; h <= last; h++) points.push(picked.get(h) ?? 0);

const version = JSON.parse(readFileSync(join(repo, 'apps/sim-cli/package.json'), 'utf8')).version;
let commit = '';
try {
  commit = execFileSync('git', ['-C', repo, 'rev-parse', '--short=7', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
} catch {
  // not a git checkout: report the package version only
}

const round1 = (v) => Math.round(v * 10) / 10;
const summary = {
  date,
  seed,
  generator: `Storewright sim-cli ${version}${commit ? ` (${commit})` : ''}`,
  synthetic: true,
  storeHours: `${formatClock(openMin * 60)}-${formatClock(closeMin * 60)}`,
  headline: [
    { label: 'Orders fulfilled', value: m.orders - m.unfinishedOrders, unit: 'orders' },
    { label: 'Items picked', value: points.reduce((a, b) => a + b, 0), unit: 'items' },
    { label: 'Avg pickup wait', value: round1(m.avgWaitMin), unit: 'min' },
    { label: 'Ready on time', value: round1(100 - m.lateOrderPct), unit: '%' },
    { label: 'Pickers walked', value: round1(m.pickDistanceKm), unit: 'km' },
  ],
  series: { label: 'Items picked/hour', unit: 'items', start: formatClock(first * 3600), points },
};

// Two-space JSON with each innermost array or object kept on one line.
const json = JSON.stringify(summary, null, 2).replace(/([[{])\n\s*([^[\]{}]*?)\n\s*([\]}])/g, (_, open, body, close) => open + body.split(/,\n\s*/).join(', ') + close);
process.stdout.write(`${json}\n`);
