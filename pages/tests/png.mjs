// A small PNG reader and writer for the screenshot comparison (idea #179), Node only (zlib), so
// the repository still has no dependencies. It reads what headless Chrome writes: 8-bit RGB or
// RGBA (also gray, gray with alpha and palette images), not interlaced; it writes 8-bit RGBA.
import { deflateSync, inflateSync } from 'node:zlib';

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/** PNG bytes -> {width, height, data: RGBA Uint8Array}. */
export function decodePNG(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error('not a PNG');
  let pos = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let type = 0;
  let interlace = 0;
  let palette = null;
  let trns = null;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const kind = buf.toString('latin1', pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    if (kind === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
      type = body[9];
      interlace = body[12];
    } else if (kind === 'PLTE') palette = body;
    else if (kind === 'tRNS') trns = body;
    else if (kind === 'IDAT') idat.push(body);
    else if (kind === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8 || interlace) throw new Error(`unsupported PNG (bit depth ${depth}, interlace ${interlace})`);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  if (!channels) throw new Error(`unsupported PNG color type ${type}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const px = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const out = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? px[out + x - channels] : 0;
      const b = y ? px[out - stride + x] : 0;
      const c = y && x >= channels ? px[out - stride + x - channels] : 0;
      let v = raw[src + x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[out + x] = v & 255;
    }
  }
  if (type === 6) return { width, height, data: px };
  const data = new Uint8Array(width * height * 4);
  for (let i = 0, j = 0, o = 0; i < width * height; i++, j += channels, o += 4) {
    if (type === 2) { data[o] = px[j]; data[o + 1] = px[j + 1]; data[o + 2] = px[j + 2]; data[o + 3] = 255; } else if (type === 0 || type === 4) {
      data[o] = data[o + 1] = data[o + 2] = px[j];
      data[o + 3] = type === 4 ? px[j + 1] : 255;
    } else {
      const k = px[j];
      data[o] = palette[k * 3]; data[o + 1] = palette[k * 3 + 1]; data[o + 2] = palette[k * 3 + 2];
      data[o + 3] = trns && k < trns.length ? trns[k] : 255;
    }
  }
  return { width, height, data };
}

function chunk(kind, body) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(kind, 4, 'latin1');
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, tail]);
}

/** {width, height, data: RGBA} -> PNG bytes (filter 0 on every row; the diff images are small). */
export function encodePNG({ width, height, data }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) Buffer.from(data.buffer, data.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/**
 * Compare two RGBA images. A pixel counts as changed when any channel differs by more than
 * `threshold` (0 to 255). Returns {changed, total, ratio, box, diff}: diff is an RGBA image of
 * the new screenshot, faded, with every changed pixel in magenta (null when nothing changed or
 * the sizes differ), and box is the smallest rectangle that holds the changes.
 */
export function compareImages(a, b, { threshold = 16 } = {}) {
  if (a.width !== b.width || a.height !== b.height) return { changed: Infinity, total: b.width * b.height, ratio: 1, box: null, diff: null, sizeMismatch: true };
  const n = a.width * a.height;
  const out = new Uint8Array(n * 4);
  let changed = 0;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  for (let i = 0; i < n; i++) {
    const k = i * 4;
    const d = Math.max(Math.abs(a.data[k] - b.data[k]), Math.abs(a.data[k + 1] - b.data[k + 1]), Math.abs(a.data[k + 2] - b.data[k + 2]), Math.abs(a.data[k + 3] - b.data[k + 3]));
    if (d > threshold) {
      changed++;
      out[k] = 255; out[k + 1] = 0; out[k + 2] = 200; out[k + 3] = 255;
      const x = i % a.width;
      const y = (i - x) / a.width;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    } else {
      // the new picture, gray and faint, so the changes stand out
      const g = Math.round((b.data[k] * 0.3 + b.data[k + 1] * 0.59 + b.data[k + 2] * 0.11) * 0.35 + 150);
      out[k] = g; out[k + 1] = g; out[k + 2] = g; out[k + 3] = 255;
    }
  }
  return { changed, total: n, ratio: changed / n, box: changed ? { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } : null, diff: changed ? { width: a.width, height: a.height, data: out } : null };
}
