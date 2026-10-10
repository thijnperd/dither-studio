/* core.test.js — Node tests for the desktop core (src/renderer/core.js).
 *
 * The core is DOM-free at load, so its rules can be pinned here: the colour
 * round trip, the catalogue lookups the steppers and the menus share, the
 * settings paths the rail binds to, the station notes, and the one dropdown
 * builder the console's five selects are now made of.
 *
 * Run from this folder:  node tools/core.test.js
 */

'use strict';

const assert = require('assert');
const Core = require('../src/renderer/core.js');

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

// `buildSelect` is the only part of the core that touches the DOM, and only when
// it is called — a two-field element is enough to pin what it builds. Placed here
// because a real `document` must not exist for the tests above.
function fakeElement(tag) {
  return {
    tagName: tag,
    children: [],
    appendChild: function (child) { this.children.push(child); return child; },
  };
}

/* ------------------------------------------------------------------ */
/* colour                                                             */
/* ------------------------------------------------------------------ */

group('colour');

test('rgbToHex writes a lower-case #rrggbb', function () {
  assert.strictEqual(Core.rgbToHex([255, 136, 0]), '#ff8800');
  assert.strictEqual(Core.rgbToHex([0, 0, 0]), '#000000');
  assert.strictEqual(Core.rgbToHex([255, 255, 255]), '#ffffff');
});

test('rgbToHex pads a single-digit channel', function () {
  assert.strictEqual(Core.rgbToHex([1, 2, 3]), '#010203');
  assert.strictEqual(Core.rgbToHex([15, 16, 17]), '#0f1011');
});

test('rgbToHex clamps and rounds, so a stray value cannot print four digits', function () {
  assert.strictEqual(Core.rgbToHex([-20, 300, 127.6]), '#00ff80');
  assert.strictEqual(Core.rgbToHex([127.4, 0.5, 254.5]), '#7f01ff');
});

test('rgbToHex treats a missing channel as 0', function () {
  assert.strictEqual(Core.rgbToHex([10, undefined, NaN]), '#0a0000');
});

test('hexToRgb reads a colour with or without the hash', function () {
  assert.deepStrictEqual(Core.hexToRgb('#ff8800'), [255, 136, 0]);
  assert.deepStrictEqual(Core.hexToRgb('ff8800'), [255, 136, 0]);
  assert.deepStrictEqual(Core.hexToRgb('#FF8800'), [255, 136, 0]);
});

test('hexToRgb is black for anything it cannot read', function () {
  assert.deepStrictEqual(Core.hexToRgb(''), [0, 0, 0]);
  assert.deepStrictEqual(Core.hexToRgb('nope'), [0, 0, 0]);
  assert.deepStrictEqual(Core.hexToRgb('#12345'), [0, 0, 0]);
  assert.deepStrictEqual(Core.hexToRgb(null), [0, 0, 0]);
  assert.deepStrictEqual(Core.hexToRgb(undefined), [0, 0, 0]);
});

test('the pair round-trips every byte value', function () {
  for (let v = 0; v < 256; v++) {
    assert.deepStrictEqual(Core.hexToRgb(Core.rgbToHex([v, 255 - v, v])), [v, 255 - v, v]);
  }
});

/* ------------------------------------------------------------------ */
/* catalogues                                                         */
/* ------------------------------------------------------------------ */

group('catalogues');

const LIST = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }];

test('byId finds an entry, and nothing means nothing', function () {
  assert.strictEqual(Core.byId(LIST, 'b').name, 'B');
  assert.strictEqual(Core.byId(LIST, 'zz'), undefined);
});

test('indexOfId reports where an entry is, or -1', function () {
  assert.strictEqual(Core.indexOfId(LIST, 'c'), 2);
  assert.strictEqual(Core.indexOfId(LIST, 'zz'), -1);
});

test('stepThrough walks the list and wraps at both ends', function () {
  assert.strictEqual(Core.stepThrough(LIST, 'a', 1).id, 'b');
  assert.strictEqual(Core.stepThrough(LIST, 'c', 1).id, 'a');
  assert.strictEqual(Core.stepThrough(LIST, 'a', -1).id, 'c');
  assert.strictEqual(Core.stepThrough(LIST, 'c', -1).id, 'b');
});

test('stepThrough starts at the first entry when nothing is selected', function () {
  assert.strictEqual(Core.stepThrough(LIST, 'zz', 1).id, 'b');
  assert.strictEqual(Core.stepThrough(LIST, 'zz', -1).id, 'c');
});

/* ------------------------------------------------------------------ */
/* settings paths                                                     */
/* ------------------------------------------------------------------ */

group('settings paths');

test('getPath reads a nested setting', function () {
  const settings = { adjustments: { contrast: 1.4 }, palette: 'c64' };
  assert.strictEqual(Core.getPath(settings, 'adjustments.contrast'), 1.4);
  assert.strictEqual(Core.getPath(settings, 'palette'), 'c64');
});

test('setPath writes one nested setting and leaves its neighbours alone', function () {
  const settings = { adjustments: { contrast: 1, gamma: 1 }, palette: 'c64' };
  Core.setPath(settings, 'adjustments.contrast', 1.4);
  Core.setPath(settings, 'palette', 'gameboy');
  assert.deepStrictEqual(settings, { adjustments: { contrast: 1.4, gamma: 1 }, palette: 'gameboy' });
});

/* ------------------------------------------------------------------ */
/* the rail                                                           */
/* ------------------------------------------------------------------ */

group('the rail');

test('summarise joins the parts it is given', function () {
  assert.strictEqual(Core.summarise(['B12', 'g1.20'], 'neutral'), 'B12 · g1.20');
});

test('summarise falls back when there is nothing to say', function () {
  assert.strictEqual(Core.summarise([], 'none'), 'none');
});

test('shortPalette drops the parenthetical and adds the ink count', function () {
  assert.strictEqual(Core.shortPalette({ name: 'Game Boy (DMG)', colors: [0, 1, 2, 3] }), 'Game Boy · 4c');
  assert.strictEqual(Core.shortPalette({ name: 'C64', colors: [0, 1] }), 'C64 · 2c');
});

test('setNote tolerates a missing node', function () {
  assert.doesNotThrow(function () { Core.setNote(null, 'anything'); });
  const node = {};
  Core.setNote(node, 'Press · Bayer 8×8');
  assert.strictEqual(node.textContent, 'Press · Bayer 8×8');
});

/* ------------------------------------------------------------------ */
/* the dropdown builder                                               */
/* ------------------------------------------------------------------ */

group('the dropdown builder');

global.document = { createElement: fakeElement };

test('buildSelect fills a plain list in catalogue order', function () {
  const node = fakeElement('select');
  Core.buildSelect(node, LIST, { label: function (entry) { return entry.name; } });
  assert.strictEqual(node.children.length, 3);
  assert.deepStrictEqual(node.children.map(function (o) { return o.value; }), ['a', 'b', 'c']);
  assert.deepStrictEqual(node.children.map(function (o) { return o.textContent; }), ['A', 'B', 'C']);
  assert.deepStrictEqual(node.children.map(function (o) { return o.tagName; }), ['option', 'option', 'option']);
});

test('buildSelect groups by key, in first-seen order', function () {
  const node = fakeElement('select');
  const entries = [
    { id: 'x', name: 'X', section: 'Ordered' },
    { id: 'y', name: 'Y', section: 'Noise' },
    { id: 'z', name: 'Z', section: 'Ordered' },
  ];
  Core.buildSelect(node, entries, {
    group: function (entry) { return entry.section; },
    label: function (entry) { return entry.name; },
  });
  assert.strictEqual(node.children.length, 2);
  assert.deepStrictEqual(node.children.map(function (g) { return g.label; }), ['Ordered', 'Noise']);
  assert.deepStrictEqual(node.children.map(function (g) { return g.tagName; }), ['optgroup', 'optgroup']);
  assert.deepStrictEqual(node.children[0].children.map(function (o) { return o.value; }), ['x', 'z']);
  assert.deepStrictEqual(node.children[1].children.map(function (o) { return o.value; }), ['y']);
});

test('buildSelect prepends a placeholder with an empty value', function () {
  const node = fakeElement('select');
  Core.buildSelect(node, LIST, {
    placeholder: 'Choose a recipe…',
    label: function (entry) { return entry.name; },
  });
  assert.strictEqual(node.children.length, 4);
  assert.strictEqual(node.children[0].value, '');
  assert.strictEqual(node.children[0].textContent, 'Choose a recipe…');
  assert.strictEqual(node.children[1].value, 'a');
});

test('buildSelect falls back to the entry name, then to its id', function () {
  const node = fakeElement('select');
  Core.buildSelect(node, [{ id: 'a', name: 'A' }, { id: 'b' }], {});
  assert.deepStrictEqual(node.children.map(function (o) { return o.textContent; }), ['A', 'b']);
});

/* ------------------------------------------------------------------ */

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exitCode = 1;
