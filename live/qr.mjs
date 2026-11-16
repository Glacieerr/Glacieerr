// QR codes (ISO/IEC 18004), drawn offline: byte mode, error correction M by default.
// No dependencies and no Node or DOM APIs beyond TextEncoder, so it runs in Node, in a
// browser, and inlined into the interactive page (pages/build.py turns `export` into a
// returned object, so this file has no imports and only named exports).
//
//   import { qrEncode, qrSvg } from './qr.mjs';
//   const qr = qrEncode('https://glacieerr.github.io/');     // { version, size, ecc, mask, modules }
//   qr.modules[y][x]                                          // true = dark module
//   const svg = qrSvg('https://glacieerr.github.io/', { border: 4, dark: '#0b0c0e', light: '#ffffff' });
//
// The structure follows the standard: data bits, Reed-Solomon error correction per block,
// interleaving, function patterns, the zigzag placement, and the mask with the lowest
// penalty score (the four rules N1 to N4). Checked by decoding the output with the browser's
// BarcodeDetector in headless Chrome.

// Error correction codewords per block and number of blocks, by level and version (index 0 unused).
const ECC_PER_BLOCK = {
  L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
};
const NUM_BLOCKS = {
  L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
};
// The two format bits for each level (yes, M is 00 and L is 01).
const FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

/** Modules left for data and error correction once the function patterns are placed. */
function rawDataModules(ver) {
  let n = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const align = Math.floor(ver / 7) + 2;
    n -= (25 * align - 10) * align - 55;
    if (ver >= 7) n -= 36;
  }
  return n;
}

function dataCodewords(ver, ecc) {
  return Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[ecc][ver] * NUM_BLOCKS[ecc][ver];
}

/** Bits needed for `len` bytes in byte mode: mode indicator, character count, the bytes. */
function bitsNeeded(len, ver) {
  return 4 + (ver <= 9 ? 8 : 16) + 8 * len;
}

// ---------------------------------------------------------------- Reed-Solomon over GF(256)
function gfMul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

/** Generator polynomial of the given degree, highest term dropped (it is always 1). */
function rsDivisor(degree) {
  const out = new Array(degree).fill(0);
  out[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < out.length; j++) {
      out[j] = gfMul(out[j], root);
      if (j + 1 < out.length) out[j] ^= out[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return out;
}

function rsRemainder(data, divisor) {
  const out = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ out.shift();
    out.push(0);
    divisor.forEach((coef, i) => { out[i] ^= gfMul(coef, factor); });
  }
  return out;
}

/** Split the data codewords into blocks, add error correction to each, and interleave them. */
function addEccAndInterleave(data, ver, ecc) {
  const numBlocks = NUM_BLOCKS[ecc][ver];
  const eccLen = ECC_PER_BLOCK[ecc][ver];
  const raw = Math.floor(rawDataModules(ver) / 8);
  const numShort = numBlocks - (raw % numBlocks);
  const shortLen = Math.floor(raw / numBlocks);
  const divisor = rsDivisor(eccLen);
  const blocks = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1));
    k += dat.length;
    const rem = rsRemainder(dat, divisor);
    if (i < numShort) dat.push(0); // a placeholder, skipped below, so every block has the same length
    blocks.push(dat.concat(rem));
  }
  const out = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortLen - eccLen || j >= numShort) out.push(block[i]);
    });
  }
  return out;
}

// ---------------------------------------------------------------- the matrix
function alignmentPositions(ver, size) {
  if (ver === 1) return [];
  const count = Math.floor(ver / 7) + 2;
  const step = Math.floor((ver * 8 + count * 3 + 5) / (count * 4 - 4)) * 2;
  const out = [6];
  for (let pos = size - 7; out.length < count; pos -= step) out.splice(1, 0, pos);
  return out;
}

function makeGrid(size) {
  return Array.from({ length: size }, () => new Array(size).fill(false));
}

function drawFunctionPatterns(ver, size, modules, isFn) {
  const set = (x, y, dark) => { modules[y][x] = dark; isFn[y][x] = true; };
  for (let i = 0; i < size; i++) { // timing patterns
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) { // finders with their separators
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        set(x, y, d !== 2 && d !== 4);
      }
    }
  }
  const pos = alignmentPositions(ver, size);
  const n = pos.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue; // under a finder
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) set(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }
  drawFormatBits(size, modules, isFn, 'M', 0); // reserve the area; redrawn once the mask is chosen
  if (ver >= 7) { // version information, two copies
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) === 1;
      const a = size - 11 + (i % 3), b = Math.floor(i / 3);
      set(a, b, dark);
      set(b, a, dark);
    }
  }
}

function drawFormatBits(size, modules, isFn, ecc, mask) {
  const data = (FORMAT_BITS[ecc] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const bit = (i) => ((bits >>> i) & 1) === 1;
  const set = (x, y, dark) => { modules[y][x] = dark; isFn[y][x] = true; };
  for (let i = 0; i <= 5; i++) set(8, i, bit(i)); // round the top-left finder
  set(8, 7, bit(6));
  set(8, 8, bit(7));
  set(7, 8, bit(8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i)); // the second copy, split between two corners
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
  set(8, size - 8, true); // the dark module
}

function drawCodewords(size, modules, isFn, codewords) {
  let i = 0;
  const total = codewords.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // skip the vertical timing pattern
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFn[y][x] && i < total) {
          modules[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
          i++;
        }
        // modules left over after the last codeword stay light (remainder bits)
      }
    }
  }
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function applyMask(size, modules, isFn, mask) {
  const f = MASKS[mask];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!isFn[y][x] && f(x, y)) modules[y][x] = !modules[y][x];
    }
  }
}

/** The standard's penalty score: long runs (N1), 2x2 blocks (N2), finder-like patterns (N3), imbalance (N4). */
function penalty(size, modules) {
  let score = 0;
  const addHistory = (run, hist) => {
    if (hist[0] === 0) run += size; // the light border before the first run
    hist.pop();
    hist.unshift(run);
  };
  const finderLike = (hist) => {
    const n = hist[1];
    const core = n > 0 && hist[2] === n && hist[3] === n * 3 && hist[4] === n && hist[5] === n;
    return (core && hist[0] >= n * 4 && hist[6] >= n ? 1 : 0) + (core && hist[6] >= n * 4 && hist[0] >= n ? 1 : 0);
  };
  const line = (get) => {
    let color = false, run = 0;
    const hist = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < size; i++) {
      if (get(i) === color) {
        run++;
        if (run === 5) score += 3;
        else if (run > 5) score++;
      } else {
        addHistory(run, hist);
        if (!color) score += finderLike(hist) * 40;
        color = get(i);
        run = 1;
      }
    }
    if (color) { // end the line: close a dark run, then count the light border after it
      addHistory(run, hist);
      run = 0;
    }
    addHistory(run + size, hist);
    score += finderLike(hist) * 40;
  };
  for (let y = 0; y < size; y++) line((x) => modules[y][x]);
  for (let x = 0; x < size; x++) line((y) => modules[y][x]);
  let dark = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules[y][x]) dark++;
      if (x < size - 1 && y < size - 1) {
        const c = modules[y][x];
        if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) score += 3;
      }
    }
  }
  const total = size * size;
  score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return score;
}

// ---------------------------------------------------------------- the public functions
/**
 * Encode text (UTF-8, byte mode) as a QR code.
 * @param {string} text
 * @param {{ecc?: 'L'|'M'|'Q'|'H', minVersion?: number, maxVersion?: number, mask?: number}} [options]
 *   ecc: error correction level (default 'M'); mask: 0..7 to force one, otherwise the lowest penalty.
 * @returns {{version: number, size: number, ecc: string, mask: number, modules: boolean[][]}}
 *   modules[y][x] is true for a dark module; the quiet zone is not included.
 */
export function qrEncode(text, options = {}) {
  const ecc = options.ecc || 'M';
  if (!(ecc in FORMAT_BITS)) throw new RangeError(`qrEncode: unknown error correction level ${ecc}`);
  const minV = options.minVersion || 1, maxV = options.maxVersion || 40;
  if (!(minV >= 1 && minV <= maxV && maxV <= 40)) throw new RangeError('qrEncode: versions must be 1 to 40');
  const bytes = Array.from(new TextEncoder().encode(String(text)));
  let ver = minV;
  while (bitsNeeded(bytes.length, ver) > dataCodewords(ver, ecc) * 8) {
    if (++ver > maxV) throw new RangeError(`qrEncode: ${bytes.length} bytes do not fit in version ${maxV}-${ecc}`);
  }
  // the data bits: mode, count, bytes, a terminator, padding to a byte, then the pad codewords
  const bits = [];
  const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(0b0100, 4);
  put(bytes.length, ver <= 9 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  const capacity = dataCodewords(ver, ecc) * 8;
  put(0, Math.min(4, capacity - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) put(pad, 8);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((acc, b) => (acc << 1) | b, 0));

  const size = ver * 4 + 17;
  const modules = makeGrid(size);
  const isFn = makeGrid(size);
  drawFunctionPatterns(ver, size, modules, isFn);
  drawCodewords(size, modules, isFn, addEccAndInterleave(data, ver, ecc));

  let mask = Number.isInteger(options.mask) ? options.mask : -1;
  if (mask < 0 || mask > 7) {
    let best = Infinity;
    for (let m = 0; m < 8; m++) {
      applyMask(size, modules, isFn, m);
      drawFormatBits(size, modules, isFn, ecc, m);
      const p = penalty(size, modules);
      if (p < best) { best = p; mask = m; }
      applyMask(size, modules, isFn, m); // undo (XOR)
    }
  }
  applyMask(size, modules, isFn, mask);
  drawFormatBits(size, modules, isFn, ecc, mask);
  return { version: ver, size, ecc, mask, modules };
}

/**
 * The dark modules of an encoded QR code as one SVG path (unit squares, merged along each row),
 * offset by `border` modules for the quiet zone.
 */
export function qrPath(qr, border = 4) {
  let d = '';
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (!qr.modules[y][x]) continue;
      let run = 1;
      while (x + run < qr.size && qr.modules[y][x + run]) run++;
      d += `M${x + border},${y + border}h${run}v1h${-run}z`;
      x += run - 1;
    }
  }
  return d;
}

/**
 * A standalone SVG of the QR code. The viewBox is in modules (code plus a quiet zone of `border`
 * modules); `px` sets the width and height attributes. Keep the colours high-contrast: a dark code
 * on a light ground scans everywhere; the reverse does not.
 */
export function qrSvg(text, options = {}) {
  const { border = 4, dark = '#000000', light = '#ffffff', px, title, ...enc } = options;
  const qr = qrEncode(text, enc);
  const n = qr.size + 2 * border;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const label = title == null ? `QR code: ${text}` : title;
  const wh = px ? ` width="${px}" height="${px}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}"${wh} shape-rendering="crispEdges" role="img" aria-label="${esc(label)}">`
    + `<title>${esc(label)}</title>`
    + (light ? `<rect width="${n}" height="${n}" fill="${light}"/>` : '')
    + `<path d="${qrPath(qr, border)}" fill="${dark}"/></svg>`;
}
