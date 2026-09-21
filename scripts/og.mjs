/**
 * Renders the social-share image (1200×630) and the raster favicons.
 * Text is converted to outlines with fontkit (so the variable fonts render at
 * the right weight and optical size) and rasterised with resvg.
 *
 *   node scripts/og.mjs
 *
 * Inputs: scripts/fonts/*.ttf — the site's woff2 fonts decompressed with
 * wawoff2 (see README → Assets). Outputs: public/og/default.png,
 * public/apple-touch-icon.png, public/favicon.ico.
 */
import { Resvg } from '@resvg/resvg-js';
import * as fontkit from 'fontkit';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (f) => fontkit.openSync(path.join(root, 'scripts/fonts', f));
const fraunces = load('fraunces.ttf');
const archivo = load('archivo.ttf');
const mono = load('jetbrains-mono.ttf');

/** Lay out `text` at (x, baselineY) and return SVG path markup. */
function text(font, variation, size, x, y, str, fill, tracking = 0) {
  const inst = font.getVariation(variation);
  const run = inst.layout(str);
  const scale = size / inst.unitsPerEm;
  let cx = x;
  let out = '';
  run.glyphs.forEach((g, i) => {
    const pos = run.positions[i];
    const d = g.path.scale(scale, -scale).translate(cx + pos.xOffset * scale, y - pos.yOffset * scale).toSVG();
    if (d) out += `<path d="${d}" fill="${fill}"/>`;
    cx += pos.xAdvance * scale + tracking;
  });
  return out;
}

// Lane grid on the right: lanes across, time slots down, brass blocks booked.
const cell = 44, gx = 760, gy = 96, cols = 8, rows = 10;
let grid = '';
for (let c = 0; c <= cols; c++) grid += `<line x1="${gx + c * cell + 0.5}" y1="${gy}" x2="${gx + c * cell + 0.5}" y2="${gy + rows * cell}" stroke="#22304C"/>`;
for (let r = 0; r <= rows; r++) grid += `<line x1="${gx}" y1="${gy + r * cell + 0.5}" x2="${gx + cols * cell}" y2="${gy + r * cell + 0.5}" stroke="#22304C"/>`;
for (const [c, r, s] of [[1, 1, 2], [3, 3, 1], [5, 5, 3], [7, 0, 2], [2, 7, 2], [6, 2, 1], [0, 9, 1], [4, 8, 2]])
  grid += `<rect x="${gx + c * cell + 5}" y="${gy + r * cell + 5}" width="${cell - 10}" height="${s * cell - 10}" rx="2" fill="#E0A45C"/>`;
grid += `<rect x="${gx + 4 * cell + 6.5}" y="${gy + 1 * cell + 6.5}" width="${cell - 13}" height="${2 * cell - 13}" rx="2" fill="none" stroke="#E0A45C" stroke-opacity="0.5" stroke-dasharray="4 4"/>`;

const ink = '#EEF2F9', ink2 = '#C2CDE0', brass = '#E0A45C';
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#080D18"/>
  ${grid}
  <rect x="72" y="74" width="16" height="16" fill="${brass}"/>
  ${text(fraunces, { wght: 520, opsz: 144 }, 30, 100, 90, 'Watzaura', ink, -0.4)}
  ${text(fraunces, { wght: 500, opsz: 144 }, 64, 72, 250, 'One record, from the', ink, -1.6)}
  ${text(fraunces, { wght: 500, opsz: 144 }, 64, 72, 322, 'booking to the', ink, -1.6)}
  ${text(fraunces, { wght: 500, opsz: 144 }, 64, 72, 394, 'development plan.', ink, -1.6)}
  ${text(archivo, { wght: 400 }, 22, 72, 452, 'Plinth — the operating system for', ink2)}
  ${text(archivo, { wght: 400 }, 22, 72, 484, 'performance-focused sports academies.', ink2)}
  ${text(mono, { wght: 500 }, 15, 72, 552, 'EARLY ACCESS IS OPENING · WATZAURA.COM', brass, 1.8)}
</svg>`;

mkdirSync(path.join(root, 'public/og'), { recursive: true });
writeFileSync(path.join(root, 'public/og/default.png'), new Resvg(og, { fitTo: { mode: 'width', value: 1200 } }).render().asPng());

const icon = readFileSync(path.join(root, 'public/favicon.svg'), 'utf8');
writeFileSync(path.join(root, 'public/apple-touch-icon.png'), new Resvg(icon, { fitTo: { mode: 'width', value: 180 } }).render().asPng());

// favicon.ico: one 32px PNG in an ICO container.
const png32 = new Resvg(icon, { fitTo: { mode: 'width', value: 32 } }).render().asPng();
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
header.writeUInt8(32, 6); header.writeUInt8(32, 7); header.writeUInt8(0, 8); header.writeUInt8(0, 9);
header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12); header.writeUInt32LE(png32.length, 14); header.writeUInt32LE(22, 18);
writeFileSync(path.join(root, 'public/favicon.ico'), Buffer.concat([header, png32]));
console.log('wrote public/og/default.png, public/apple-touch-icon.png, public/favicon.ico');
