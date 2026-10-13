/* check-examples.js: the generated gallery, checked against its own manifest.
 *
 * Everything in examples/ is written by tools/make-examples.js — the pictures,
 * the contact sheet, the reference table in the README and the manifest. That
 * makes the folder easy to regenerate and easy to break: a file added by hand, a
 * picture re-exported at another size, or an edit to the page all leave the four
 * describing different sets. This is the check that catches it, in Node, with no
 * browser and no dependencies.
 *
 * Run from the repository root:  node tools/check-examples.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok   ' + name);
  } catch (err) {
    failed++;
    console.log('  FAIL ' + name);
    console.log('       ' + (err && err.message));
  }
}

function group(name) {
  console.log('\n' + name);
}

const DIR = path.join(__dirname, '..', 'examples');
const read = function (name) { return fs.readFileSync(path.join(DIR, name), 'utf8'); };

const manifest = JSON.parse(read('examples.json'));
const pictures = manifest.pictures || [];
const files = pictures.map(function (item) { return item.out; });
const page = read('index.html');
const readme = read('README.md');

// A PNG's own size, read out of its IHDR chunk, so a claim about size is checked
// against the bytes rather than against another copy of the claim.
function pngSize(file) {
  const buf = fs.readFileSync(path.join(DIR, file));
  if (buf.length < 24 || buf.slice(1, 4).toString() !== 'PNG') throw new Error('not a PNG: ' + file);
  return buf.readUInt32BE(16) + '\u00d7' + buf.readUInt32BE(20);
}

function matches(text, pattern) {
  return (text.match(pattern) || []);
}

// ---- the set ----------------------------------------------------------------

group('the set');

test('the manifest lists pictures, each named once', function () {
  if (!pictures.length) throw new Error('examples.json lists no pictures');
  const seen = {};
  for (const file of files) {
    if (seen[file]) throw new Error('listed twice: ' + file);
    seen[file] = true;
  }
});

test('every picture it lists is on disk and not empty', function () {
  const missing = [];
  for (const file of files) {
    const full = path.join(DIR, file);
    if (!fs.existsSync(full)) missing.push(file);
    else if (fs.statSync(full).size < 1024) missing.push(file + ' (suspiciously small)');
  }
  if (missing.length) throw new Error('missing or empty: ' + missing.join(', '));
});

test('and nothing else is in the folder', function () {
  const onDisk = fs.readdirSync(DIR).filter(function (name) { return /\.png$/i.test(name); });
  const extra = onDisk.filter(function (name) { return files.indexOf(name) < 0; });
  if (extra.length) throw new Error('on disk but not in the manifest: ' + extra.join(', '));
});

test('each picture really is the size the manifest claims', function () {
  const wrong = [];
  for (const item of pictures) {
    const actual = pngSize(item.out);
    if (actual !== item.px) wrong.push(item.out + ': manifest says ' + item.px + ', file is ' + actual);
  }
  if (wrong.length) throw new Error(wrong.join('; '));
});

test('every recipe records what was asked for and what came out', function () {
  const thin = [];
  for (const item of pictures) {
    const asked = item.preset || item.recipe;
    if (!asked) thin.push(item.out + ' has no recipe');
    else if (!item.algorithm || !item.palette) thin.push(item.out + ' has no algorithm or palette');
    else if (!(item.colors > 0)) thin.push(item.out + ' records no colour count');
    else if (!(item.ms > 0)) thin.push(item.out + ' records no render time');
  }
  if (thin.length) throw new Error(thin.join('; '));
});

// ---- the page ---------------------------------------------------------------

group('the contact sheet');

test('it shows every picture, once', function () {
  const wrong = files.map(function (file) {
    return { file: file, images: matches(page, new RegExp('src="' + file.replace(/\./g, '\\.') + '"', 'g')).length };
  }).filter(function (item) { return item.images !== 1; });
  if (wrong.length) throw new Error(wrong.map(function (item) {
    return item.file + ' appears ' + item.images + ' times';
  }).join(', '));
});

test('it links nothing that is not in the set', function () {
  const shown = matches(page, /<img[^>]*src="([^"]+)"/g).map(function (tag) {
    return tag.replace(/.*src="([^"]+)".*/, '$1');
  });
  const strays = shown.filter(function (file) { return files.indexOf(file) < 0; });
  if (strays.length) throw new Error('not in the manifest: ' + strays.join(', '));
  if (shown.length !== files.length) throw new Error(shown.length + ' images for ' + files.length + ' pictures');
});

test('it carries a caption for each one', function () {
  const captions = matches(page, /class="readout"/g).length;
  if (captions !== files.length) throw new Error(captions + ' readouts for ' + files.length + ' pictures');
});

// ---- the README -------------------------------------------------------------

group('the reference list');

test('the table lists the set, in the same order', function () {
  const begin = readme.indexOf('<!-- examples:begin -->');
  const end = readme.indexOf('<!-- examples:end -->');
  if (begin < 0 || end < begin) throw new Error('the markers are missing from examples/README.md');
  const rows = matches(readme.slice(begin, end), /^\| `([^`]+)` \|/gm).map(function (row) {
    return row.replace(/^\| `([^`]+)` \|.*/, '$1');
  });
  if (rows.join(',') !== files.join(',')) {
    throw new Error('the table lists ' + rows.length + ' rows:\n       ' + rows.join('\n       '));
  }
});

test('and the prose points at files that exist', function () {
  const named = matches(readme.slice(0, readme.indexOf('<!-- examples:begin -->')), /`([a-z0-9-]+\.png)`/g)
    .map(function (name) { return name.replace(/`/g, ''); });
  const strays = named.filter(function (name) { return files.indexOf(name) < 0; });
  if (strays.length) throw new Error('named in the prose but not in the set: ' + strays.join(', '));
});

// ---- the artifacts themselves ----------------------------------------------

group('what was written');

test('nothing was left half-written', function () {
  const junk = matches(page + readme, /undefined|NaN|\[object Object\]/g);
  if (junk.length) throw new Error(junk.length + ' placeholder(s) in the page or the README');
});

test('the page stands on its own', function () {
  const external = matches(page, /(src|href)="(https?:|file:|www\.)[^"]*"/g);
  if (external.length) throw new Error('it reaches outside the folder: ' + external.join(', '));
  if (!/--well: #0b0c10/.test(page)) throw new Error('the page is not wearing the house tokens');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exitCode = 1;
