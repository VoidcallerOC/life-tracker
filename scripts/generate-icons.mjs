#!/usr/bin/env node
// Generates the PWA icon set. Written as a script rather than committed binaries
// alone so the mark can be regenerated if the palette changes.
//
// No image dependency is available (and none is worth adding for six flat
// squares), so this encodes the PNGs directly: RGBA scanlines, zlib-deflated,
// with CRC32 per chunk.
import { deflateSync } from "node:zlib";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const BG = [10, 12, 16]; // matches theme_color #0a0c10
const FG = [52, 211, 153]; // accent green

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

function png(size, draw) {
  const bytesPerPixel = 4;
  const stride = size * bytesPerPixel;
  // One filter byte (0 = None) per scanline, then RGBA pixels.
  const raw = Buffer.alloc((stride + 1) * size);

  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = draw(x, y, size);
      const p = rowStart + 1 + x * bytesPerPixel;
      raw[p] = r;
      raw[p + 1] = g;
      raw[p + 2] = b;
      raw[p + 3] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Shortest distance from a point to a line segment, in unit space. */
function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  const nx = ax + t * dx;
  const ny = ay + t * dy;
  return Math.hypot(px - nx, py - ny);
}

/**
 * The mark: a checkmark on a dark ground — a queue that gets cleared.
 * `inset` shrinks the glyph for maskable icons, whose outer 10% is cropped
 * to whatever shape the launcher wants.
 */
function makeDraw({ inset = 0, transparent = false } = {}) {
  return (x, y, size) => {
    const u = x / size;
    const v = y / size;

    // Checkmark as two thick strokes, described in unit space.
    const scale = 1 - inset * 2;
    const cx = (u - inset) / scale;
    const cy = (v - inset) / scale;

    const onStroke = (() => {
      if (cx < 0 || cx > 1 || cy < 0 || cy > 1) return false;
      // Perpendicular distance to each stroke, so a steep segment is not
      // rendered thicker than a shallow one.
      const half = 0.072;
      const d1 = distanceToSegment(cx, cy, 0.22, 0.52, 0.42, 0.72);
      const d2 = distanceToSegment(cx, cy, 0.42, 0.72, 0.78, 0.29);
      return Math.min(d1, d2) < half;
    })();

    if (onStroke) return [FG[0], FG[1], FG[2], 255];
    if (transparent) return [0, 0, 0, 0];
    return [BG[0], BG[1], BG[2], 255];
  };
}

const outDir = path.join(process.cwd(), "public", "icons");
await mkdir(outDir, { recursive: true });

const targets = [
  { file: "icon-192.png", size: 192, opts: {} },
  { file: "icon-512.png", size: 512, opts: {} },
  // Maskable icons keep the glyph inside the safe zone so no launcher crop clips it.
  { file: "icon-192-maskable.png", size: 192, opts: { inset: 0.14 } },
  { file: "icon-512-maskable.png", size: 512, opts: { inset: 0.14 } },
  // iOS home screen: no transparency, matches the app background.
  { file: "apple-touch-icon.png", size: 180, opts: { inset: 0.08 } },
  { file: "favicon-32.png", size: 32, opts: {} },
];

for (const { file, size, opts } of targets) {
  await writeFile(path.join(outDir, file), png(size, makeDraw(opts)));
  console.log(`wrote public/icons/${file} (${size}x${size})`);
}
