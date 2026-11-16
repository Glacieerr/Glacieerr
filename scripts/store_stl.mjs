#!/usr/bin/env node
/**
 * Export a simplified 3D model of Storewright's default store (the medium template) as ASCII STL:
 * the floor, the shelf runs as boxes and the checkout lanes. Positions come from the 3D
 * simulator's own layout (buildGeometry in apps/simulator/src/scene/layout.ts). Bays are merged
 * into one box per shelf run side, and back-to-back shelves of the same height into one box,
 * so the file stays small enough for a ```stl block in a README.
 *
 *   node scripts/store_stl.mjs --repo <path to a storewright checkout> > assets/store.stl
 *
 * Needs the checkout's npm dependencies (see store_day.mjs). Units are metres; x runs along the
 * store front, y from the front to the back wall, z is up.
 */
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const { repo: repoArg } = parseArgs({ options: { repo: { type: 'string' } } }).values;
if (!repoArg) {
  console.error('usage: node store_stl.mjs --repo <path to a storewright checkout> > store.stl');
  process.exit(1);
}
const repo = resolve(repoArg);
const requireFromRepo = createRequire(join(repo, 'package.json'));
requireFromRepo('tsx/esm/api').register({ tsconfig: join(repo, 'tsconfig.json') });
const { createTemplate, StoreModel } = await import(pathToFileURL(requireFromRepo.resolve('@storewright/store-config')).href);
const { buildGeometry } = await import(pathToFileURL(join(repo, 'apps/simulator/src/scene/layout.ts')).href);
const geo = buildGeometry(new StoreModel(createTemplate('medium')));

// Boxes in STL axes: x = scene x, y = scene z (front to back), z = scene y (up).
const FLOOR_THICKNESS = 0.2;
const boxes = geo.floors.map((f) => ({ x0: f.minX, x1: f.maxX, y0: f.minZ, y1: f.maxZ, z0: f.y - FLOOR_THICKNESS, z1: f.y }));

// One box per shelf run side: the bounding box of its bays (template runs are axis-aligned).
const sides = new Map();
for (const s of geo.shelves) {
  const ux = Math.abs(Math.cos(s.rotY));
  const uy = Math.abs(Math.sin(s.rotY));
  const hx = (ux * s.length + uy * s.depth) / 2;
  const hy = (uy * s.length + ux * s.depth) / 2;
  const b = { x0: s.x - hx, x1: s.x + hx, y0: s.z - hy, y1: s.z + hy, z0: s.y - s.height / 2, z1: s.y + s.height / 2 };
  const key = `${s.runId}|${(uy > ux ? s.x : s.z).toFixed(2)}`;
  const a = sides.get(key);
  sides.set(key, a ? { x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1), y0: Math.min(a.y0, b.y0), y1: Math.max(a.y1, b.y1), z0: a.z0, z1: a.z1 } : b);
}

// Merge back-to-back shelves: same height and extent, less than half a metre apart.
const near = (a, b) => Math.abs(a - b) < 0.01;
const shelves = [...sides.values()].sort((a, b) => a.x0 - b.x0 || a.y0 - b.y0);
for (let merged = true; merged; ) {
  merged = false;
  for (let i = 0; i < shelves.length && !merged; i++) {
    for (let j = 0; j < shelves.length && !merged; j++) {
      const a = shelves[i];
      const b = shelves[j];
      if (i === j || !near(a.z0, b.z0) || !near(a.z1, b.z1)) continue;
      const alongX = near(a.y0, b.y0) && near(a.y1, b.y1) && b.x0 >= a.x1 && b.x0 - a.x1 < 0.5;
      const alongY = near(a.x0, b.x0) && near(a.x1, b.x1) && b.y0 >= a.y1 && b.y0 - a.y1 < 0.5;
      if (!alongX && !alongY) continue;
      shelves[i] = { ...a, x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
      shelves.splice(j, 1);
      merged = true;
    }
  }
}
boxes.push(...shelves);

// Checkout counters, with the sizes Fixtures.tsx draws: staffed lanes and self-checkouts.
for (const c of geo.checkouts) {
  const [cx, w, d, h] = c.self ? [c.x, 0.7, 0.6, 1.1] : [c.x - 0.6, 0.8, 3.0, 0.9];
  boxes.push({ x0: cx - w / 2, x1: cx + w / 2, y0: c.z - d / 2, y1: c.z + d / 2, z0: c.y, z1: c.y + h });
}

const n = (v) => String(Math.round(v * 100) / 100);
const lines = ['solid storewright_medium_store'];
for (const { x0, x1, y0, y1, z0, z1 } of boxes) {
  const P = (i) => [i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? z1 : z0];
  // Corner indices: bit 0 = x, bit 1 = y, bit 2 = z. Each face is two triangles, counter-clockwise seen from outside.
  const faces = [
    ['0 0 -1', [0, 2, 3, 1]],
    ['0 0 1', [4, 5, 7, 6]],
    ['0 -1 0', [0, 1, 5, 4]],
    ['0 1 0', [2, 6, 7, 3]],
    ['-1 0 0', [0, 4, 6, 2]],
    ['1 0 0', [1, 3, 7, 5]],
  ];
  for (const [normal, [a, b, c, d]] of faces) {
    for (const tri of [[a, b, c], [a, c, d]]) {
      lines.push(`facet normal ${normal}`, 'outer loop', ...tri.map((i) => `vertex ${P(i).map(n).join(' ')}`), 'endloop', 'endfacet');
    }
  }
}
lines.push('endsolid storewright_medium_store');
process.stdout.write(`${lines.join('\n')}\n`);
console.error(`store_stl: ${boxes.length} boxes (${geo.floors.length} floor, ${shelves.length} shelf, ${geo.checkouts.length} checkout), ${boxes.length * 12} facets`);
