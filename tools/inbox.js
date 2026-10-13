#!/usr/bin/env node
/* inbox.js: list what is waiting in inbox/ without touching it.
 *
 * The inbox is where new captures are dropped before they are developed into
 * docs/. This prints one line per file with its format, byte size and pixel
 * size, flags anything heavier than the pictures the documentation already
 * ships, and says when a name would replace one that is already there.
 *
 * PNG, JPEG, GIF and WebP headers are read here directly, so the script adds no
 * dependencies and writes nothing.
 *
 *   node tools/inbox.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const inbox = path.join(root, 'inbox');
const docs = path.join(root, 'docs');

const HEAVY_BYTES = 512 * 1024;   // past what the pictures in docs/ weigh
const BIG_SIDE = 2400;            // past what the documentation needs

function readPngDimensions(buf) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length < 24 || !buf.subarray(0, 8).equals(signature)) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function readGifDimensions(buf) {
  const magic = buf.subarray(0, 6).toString('ascii');
  if (buf.length < 10 || (magic !== 'GIF87a' && magic !== 'GIF89a')) return null;
  return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
}

function readJpegDimensions(buf) {
  if (buf.length < 4 || buf.readUInt16BE(0) !== 0xffd8) return null;
  let offset = 2;
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) { offset++; continue; }
    const marker = buf[offset + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue; }
    const length = buf.readUInt16BE(offset + 2);
    const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isStartOfFrame) return { width: buf.readUInt16BE(offset + 7), height: buf.readUInt16BE(offset + 5) };
    offset += 2 + length;
  }
  return null;
}

function readWebpDimensions(buf) {
  if (buf.length < 30 || buf.subarray(0, 4).toString('ascii') !== 'RIFF') return null;
  if (buf.subarray(8, 12).toString('ascii') !== 'WEBP') return null;
  const chunk = buf.subarray(12, 16).toString('ascii');
  if (chunk === 'VP8X') {
    const side = at => 1 + (buf[at] | (buf[at + 1] << 8) | (buf[at + 2] << 16));
    return { width: side(24), height: side(27) };
  }
  return null;
}

function describe(file) {
  const buf = fs.readFileSync(file);
  const ascii = buf.subarray(0, 4).toString('ascii');
  const readers = [
    ['PNG', readPngDimensions, buf => buf.subarray(1, 4).toString('ascii') === 'PNG'],
    ['GIF', readGifDimensions, buf => buf.subarray(0, 3).toString('ascii') === 'GIF'],
    ['JPEG', readJpegDimensions, buf => buf.readUInt16BE(0) === 0xffd8],
    ['WebP', readWebpDimensions, buf => ascii === 'RIFF'],
  ];
  for (const [format, read, matches] of readers) {
    if (buf.length >= 4 && matches(buf)) {
      const size = read(buf);
      return { format, bytes: buf.length, size };
    }
  }
  return { format: 'unknown', bytes: buf.length, size: null };
}

function kilobytes(bytes) {
  return bytes >= 1024 * 1024
    ? (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    : Math.round(bytes / 1024) + ' KB';
}

if (!fs.existsSync(inbox)) {
  console.log('there is no inbox/ folder');
  process.exit(0);
}

const waiting = fs.readdirSync(inbox)
  .filter(name => !name.startsWith('.') && name !== 'README.md')
  .map(name => ({ name, path: path.join(inbox, name) }))
  .filter(entry => fs.statSync(entry.path).isFile());

if (waiting.length === 0) {
  console.log('inbox: nothing waiting. Drop a capture into inbox/ and run this again.');
  process.exit(0);
}

const shipped = fs.existsSync(docs) ? fs.readdirSync(docs) : [];
console.log('inbox: ' + waiting.length + (waiting.length === 1 ? ' file waiting' : ' files waiting') + '\n');

const notes = [];
for (const entry of waiting) {
  const { format, bytes, size } = describe(entry.path);
  const dimensions = size ? size.width + '×' + size.height : 'size unread';
  console.log('  ' + entry.name.padEnd(34) + kilobytes(bytes).padStart(8) + '  ' + dimensions.padEnd(12) + ' ' + format);

  if (bytes > HEAVY_BYTES) notes.push(entry.name + ': ' + kilobytes(bytes) + ' is past the half-megabyte mark the pictures in docs/ stay under');
  if (size && Math.max(size.width, size.height) > BIG_SIDE) notes.push(entry.name + ': ' + Math.max(size.width, size.height) + ' px is wider than the documentation needs');
  if (shipped.includes(entry.name)) notes.push(entry.name + ': same name as docs/' + entry.name + ', so it reads as a replacement');
}

if (notes.length) {
  console.log('');
  for (const note of notes) console.log('  note — ' + note);
}

const shippedSizes = shipped.map(name => fs.statSync(path.join(docs, name)).size);
if (shippedSizes.length) {
  const lightest = Math.min(...shippedSizes);
  const heaviest = Math.max(...shippedSizes);
  console.log('\ndocs/ holds ' + shippedSizes.length + ' pictures, ' + kilobytes(lightest) + ' to ' + kilobytes(heaviest) + ' each. Nothing here is committed.');
}
