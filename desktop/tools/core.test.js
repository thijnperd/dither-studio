/* core.test.js: Node tests for the desktop core (src/renderer/core.js).
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
// it is called: a two-field element is enough to pin what it builds. Placed here
// because a real `document` must not exist for the tests above.
function fakeElement(tag) {
  return {
    tagName: tag,
    children: [],
    appendChild: function (child) { this.children.push(child); return child; },
  };
}

// ---- colour ----

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

// ---- palette import ----

group('palette import');

test('a JSON array of hex strings is a palette', function () {
  const parsed = Core.parsePaletteText('["#1a1c2c", "#5d275d", "#b13e53"]', 'Fallback');
  assert.deepStrictEqual(parsed.colors, [[26, 28, 44], [93, 39, 93], [177, 62, 83]]);
  assert.strictEqual(parsed.name, 'Fallback');
});

test('a JSON object carries its own name and colours', function () {
  const parsed = Core.parsePaletteText('{"name":"Lospec 4","colors":["#000","#f00","#fff","#0f0"]}');
  assert.strictEqual(parsed.name, 'Lospec 4');
  assert.deepStrictEqual(parsed.colors, [[0, 0, 0], [255, 0, 0], [255, 255, 255], [0, 255, 0]]);
});

test('a plain hex list takes commas, spaces, semicolons and lines', function () {
  const parsed = Core.parsePaletteText('#000000, #ff0000\n#ffffff; 00ff00', 'Smoke');
  assert.strictEqual(parsed.colors.length, 4);
  assert.deepStrictEqual(parsed.colors[3], [0, 255, 0]);
});

test('rgb triples and colour objects are read too', function () {
  const parsed = Core.parsePaletteText('[[1,2,3], {"hex":"#ffffff"}]');
  assert.deepStrictEqual(parsed.colors, [[1, 2, 3], [255, 255, 255]]);
});

test('duplicate inks collapse, and a palette still needs two colours', function () {
  const parsed = Core.parsePaletteText('#000 #000 #fff');
  assert.deepStrictEqual(parsed.colors, [[0, 0, 0], [255, 255, 255]]);
  assert.throws(function () { Core.parsePaletteText('#000 #000'); }, /two different colours/);
  assert.throws(function () { Core.parsePaletteText('not a colour'); }, /not a hex colour/);
  assert.throws(function () { Core.parsePaletteText('[]'); }, /at least two colours/);
});

test('the import id is readable, stable and never collides', function () {
  assert.strictEqual(Core.paletteId('My Great Palette', []), 'custom-my-great-palette');
  assert.strictEqual(Core.paletteId('My Great Palette', ['custom-my-great-palette']), 'custom-my-great-palette-2');
  assert.strictEqual(Core.paletteId('  ...  ', []), 'custom-palette');
});

// ---- catalogues ----

group('palette extraction and plugin packages');

test('all four extractors return readable inks from a synthetic photo', function () {
  const width = 24, height = 24;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const p = i * 4;
    data[p] = i % 3 === 0 ? 230 : 20;
    data[p + 1] = i % 3 === 1 ? 210 : 20;
    data[p + 2] = i % 3 === 2 ? 190 : 20;
    data[p + 3] = 255;
  }
  Core.EXTRACT_METHODS.forEach(function (method) {
    const colors = Core.extractPalette(data, width, height, 6, method);
    assert.ok(colors.length >= 2 && colors.length <= 6, method + ' returned ' + colors.length);
    colors.forEach(function (c) {
      assert.strictEqual(c.length, 3);
      c.forEach(function (v) { assert.ok(v >= 0 && v <= 255, method + ' channel ' + v); });
    });
    const luma = function (c) { return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    for (let i = 1; i < colors.length; i++) {
      assert.ok(luma(colors[i]) >= luma(colors[i - 1]), method + ' sorts dark to light');
    }
  });
});

test('the extractor clamps the request and rejects an empty image', function () {
  const data = new Uint8ClampedArray(4 * 4 * 4);
  for (let i = 0; i < 16; i++) { data[i * 4] = i * 16; data[i * 4 + 3] = 255; }
  assert.strictEqual(Core.extractPalette(data, 4, 4, 999, 'median').length <= 32, true);
  assert.throws(function () { Core.extractPalette(null, 0, 0, 8, 'cins'); }, /image/);
});

test('a plugin package is normalised and unknown fields are dropped', function () {
  const pkg = Core.validatePluginPackage({
    schema: 1,
    id: 'demo-tool',
    name: 'Demo Tool',
    version: '1.2.3',
    kind: 'tool',
    capability: 'ink-extractor',
    summary: 'A test package',
    author: 'Test',
    main: 'evil.js',
    data: { methods: ['cins', 'bogus'], defaultCount: 12 },
  });
  assert.strictEqual(pkg.id, 'demo-tool');
  assert.deepStrictEqual(pkg.data.methods, ['cins']);
  assert.strictEqual(pkg.main, undefined);
});

test('a plugin package cannot smuggle a script or a bad preset', function () {
  assert.throws(function () {
    Core.validatePluginPackage({ schema: 1, id: 'bad', name: 'Bad', version: '1.0.0', kind: 'tool', capability: 'nope', summary: 'x' });
  }, /capability/);
  assert.throws(function () {
    Core.validatePluginPackage({ schema: 1, id: 'bad', name: 'Bad', version: '1.0.0', kind: 'preset-pack', summary: 'x', data: { presets: [] } });
  }, /1–24/);
  assert.throws(function () {
    Core.validatePluginPackage({ schema: 1, id: 'bad', name: 'Bad', version: '1.0.0', kind: 'preset-pack', summary: 'x', data: { presets: [{ id: 'ok', name: 'Ok', settings: [] }] } });
  }, /settings object/);
});

// ---- catalogues ----

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

// ---- settings paths ----

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

// ---- the rail ----

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

// ---- the dropdown builder ----

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


console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exitCode = 1;
