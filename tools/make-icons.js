#!/usr/bin/env node
/* make-icons.js — generate the app icons with Dither Studio's own press.
 *
 * The mark is a real proof, not a drawing of one: a soft disc of light is run
 * through the app's core (Bayer 8×8, the 1-bit path, tinted with the console's
 * own ink pair) and the result is written out as a PNG. The PNG encoder below
 * uses only `zlib`, which ships with Node, so this script adds no dependencies.
 *
 *   node tools/make-icons.js
 *
 * Writes icons/icon-192.png, icons/icon-512.png and icons/icon.svg.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.join(__dirname, '..');
const D = require(path.join(root, 'dither.js'));

const INK = [11, 12, 16];        // the console's well            #0b0c10
const PAPER = [122, 162, 255];   // the single accent              #7aa2ff

/* A soft disc of light, brighter top-left, so the dither has a gradient to
 * resolve rather than a hard edge to snap. The radius stays inside the
 * maskable-icon safe zone (a circle 80 % of the icon), so a round or squircle
 * launcher mask never crops the mark. */
function sourceFor(size, radiusFraction) {
  const data = new Uint8ClampedArray(size * size * 4);
  const centre = (size - 1) / 2;
  const radius = size * (radiusFraction || 0.38);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const d = Math.hypot(x - centre, y - centre) / radius;
      const fall = Math.max(0, 1 - d * d);
      const light = fall * (1.06 - 0.3 * ((x + y) / (2 * size)));
      const v = Math.round(Math.max(0, Math.min(1, light)) * 255);
      data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
    }
  }
  return { data: data, width: size, height: size };
}

function proof(size, pixelSize, radiusFraction) {
  return D.process(sourceFor(size, radiusFraction), {
    algorithm: 'bayer8',
    palette: 'bw',
    pixelSize: pixelSize,
    toneMap: 'custom',
    toneInk: INK,
    tonePaper: PAPER,
    seed: 0,
  });
}

/* ---------- a minimal PNG writer: 8-bit RGBA, no filters, one IDAT -------- */

const CRC_TABLE = (function () {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, body) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length, 0);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed), 0);
  return Buffer.concat([length, typed, crc]);
}

function png(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;      // bit depth
  ihdr[9] = 6;      // colour type: RGBA
  ihdr[10] = 0;     // deflate
  ihdr[11] = 0;     // adaptive filtering
  ihdr[12] = 0;     // no interlace

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  const bytes = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;   // filter: none
    bytes.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- an SVG favicon, same mark, drawn as runs of ink -------------- */

function svg(size) {
  const res = proof(size, 2, 0.46);
  const hex = function (rgb) {
    return '#' + rgb.map(function (v) { return v.toString(16).padStart(2, '0'); }).join('');
  };
  // A pixel is paper when it sits nearer the paper colour than the ink: the
  // accent's red channel alone is darker than the ink's blue, so a single
  // channel threshold would call every pixel ink.
  const isPaper = function (i) {
    let toInk = 0, toPaper = 0;
    for (let c = 0; c < 3; c++) {
      const v = res.data[i + c];
      toInk += (v - INK[c]) * (v - INK[c]);
      toPaper += (v - PAPER[c]) * (v - PAPER[c]);
    }
    return toPaper < toInk;
  };
  const rects = [];
  for (let y = 0; y < res.height; y++) {
    let run = 0;
    for (let x = 0; x <= res.width; x++) {
      const paper = x < res.width ? isPaper((y * res.width + x) * 4) : false;
      if (paper) { run++; continue; }
      if (run) rects.push('<rect x="' + (x - run) + '" y="' + y + '" width="' + run + '" height="1"/>');
      run = 0;
    }
  }
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + res.width + ' ' + res.height +
    '" width="' + res.width + '" height="' + res.height + '" shape-rendering="crispEdges">\n' +
    '  <rect width="' + res.width + '" height="' + res.height + '" fill="' + hex(INK) + '"/>\n' +
    '  <g fill="' + hex(PAPER) + '">' + rects.join('') + '</g>\n' +
    '</svg>\n';
}

/* ---------- write them out ------------------------------------------------ */

const icons = path.join(root, 'icons');
fs.mkdirSync(icons, { recursive: true });

[[192, 3], [512, 6]].forEach(function (pair) {
  const res = proof(pair[0], pair[1]);
  const file = path.join(icons, 'icon-' + pair[0] + '.png');
  fs.writeFileSync(file, png(res.width, res.height, res.data));
  console.log('wrote ' + path.relative(root, file) + ' — ' + res.width + '×' + res.height +
    ', ' + res.colors + ' inks, ' + Math.round(fs.statSync(file).size / 1024) + ' KB');
});

const favicon = path.join(icons, 'icon.svg');
fs.writeFileSync(favicon, svg(32));
console.log('wrote ' + path.relative(root, favicon) + ' — 32×32 runs of ink');
