/* tour.test.js: Node tests for the tutorial's lesson data (src/tour-spec.js).
 *
 * The lessons are data, so they can be held to their own rules without a window:
 *
 *   - the shape: an id, a title, a theme, a target and a body on every step;
 *   - the controls: every `open` is a real panel and every `show` is a real
 *     command, read out of the app's own source rather than copied here, so a
 *     renamed verb fails on the next run instead of in the smoke run;
 *   - the checks: every predicate is false on a fresh app (nothing is already
 *     done before the learner starts) and true for at least one state the app
 *     can actually reach (no step asks for something that cannot happen);
 *   - the navigation: ids unique and kebab-case, progress keys that survive a
 *     reload, and a step count that stays a tour rather than a manual.
 *
 * Run from this folder:  node tools/tour.test.js
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const SPEC = require('../src/tour-spec.js');
const D = require('../src/renderer/dither.js');

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

const lessons = SPEC.lessons;
const steps = lessons.reduce(function (all, lesson) { return all.concat(lesson.steps); }, []);

/* ---- what the app really offers, read from its own source ------------- */

const APP = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');

// The span of an object literal in app.js: from its opening line to the line
// that closes it at the same indentation. Read rather than mirrored, so this
// test fails when the app renames something and the lesson data does not.
function block(header) {
  const at = APP.indexOf(header);
  assert(at >= 0, 'app.js no longer contains: ' + header);
  const rest = APP.slice(at + header.length);
  const end = rest.indexOf('\n  ];');
  const endObject = rest.indexOf('\n  };');
  const stop = end >= 0 && (endObject < 0 || end < endObject) ? end : endObject;
  assert(stop >= 0, 'could not find the end of: ' + header);
  return rest.slice(0, stop);
}

const COMMANDS = (function () {
  const names = {};
  const matches = block('const COMMANDS = {').matchAll(/'([a-z0-9-]+)':\s*function/g);
  for (const match of matches) names[match[1]] = true;
  return names;
}());

const PANELS = (function () {
  const ids = [];
  const matches = block('const GROUPS = [').matchAll(/id: '([a-z0-9-]+)'/g);
  for (const match of matches) ids.push(match[1]);
  return ids;
}());

const PRESETS = (function () {
  const ids = [];
  const matches = block('const PRESETS = [').matchAll(/\{ id: '([a-z0-9-]+)', name: /g);
  for (const match of matches) ids.push(match[1]);
  return ids;
}());

/* ---- the states a predicate has to be true for ------------------------- */

const BASE = {
  name: 'demo', path: null, savedPath: null,
  algorithm: D.DEFAULTS.algorithm,
  palette: D.DEFAULTS.palette,
  toneMap: D.DEFAULTS.toneMap,
  alphaMode: D.DEFAULTS.alphaMode,
  preset: '', quality: 'live', seed: D.DEFAULTS.seed,
  textMode: false, textRamp: 'ascii', serpentine: false, compare: false,
  effects: [], openGroups: [], status: 'Ready',
  width: 960, height: 640,
};

function withState(patch) {
  return Object.assign({}, BASE, patch);
}

// Every state the app can be in that any predicate in the spec could name.
function candidates() {
  const list = [BASE];
  D.ALGORITHMS.forEach(function (a) { list.push(withState({ algorithm: a.id })); });
  D.PALETTES.forEach(function (p) { list.push(withState({ palette: p.id })); });
  D.TONE_MAPS.forEach(function (t) { list.push(withState({ toneMap: t.id })); });
  PRESETS.forEach(function (id) { list.push(withState({ preset: id })); });
  list.push(withState({ textMode: true }));
  list.push(withState({ effects: [{ id: 'grain', amount: 30 }] }));
  list.push(withState({ savedPath: '/tmp/proof.png', status: 'Saved proof.png' }));
  list.push(withState({ status: 'Exported 42 characters' }));
  list.push(withState({ status: 'Exported proof.png' }));
  list.push(withState({ quality: 'full' }));
  list.push(withState({ compare: true }));
  return list;
}

/* ---- the shape --------------------------------------------------------- */

group('the lessons');

test('the tour has lessons and steps', function () {
  assert(lessons.length >= 8, 'only ' + lessons.length + ' lessons');
  assert(steps.length >= 40, 'only ' + steps.length + ' steps');
  assert(steps.length <= 80, steps.length + ' steps is a manual, not a tour');
});

test('every lesson carries the fields the list and the card need', function () {
  lessons.forEach(function (lesson) {
    assert(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(lesson.id), 'id is not kebab-case: ' + lesson.id);
    assert(typeof lesson.title === 'string' && lesson.title.length > 3, lesson.id + ' has no title');
    assert(typeof lesson.summary === 'string' && lesson.summary.length > 20, lesson.id + ' has no summary');
    assert(typeof lesson.theme === 'string' && lesson.theme.length > 2, lesson.id + ' has no theme');
    assert(typeof lesson.minutes === 'number' && lesson.minutes > 0, lesson.id + ' has no estimate');
    assert(Array.isArray(lesson.steps) && lesson.steps.length >= 3,
      lesson.id + ' has ' + (lesson.steps || []).length + ' steps');
    assert(lesson.steps.length <= 9, lesson.id + ' is too long for one sitting');
  });
});

test('lesson ids are unique, because progress is stored under them', function () {
  const seen = {};
  lessons.forEach(function (lesson) {
    assert(!seen[lesson.id], 'two lessons share the id ' + lesson.id);
    seen[lesson.id] = true;
  });
});

test('the themes group the list without shattering it', function () {
  const themes = [];
  lessons.forEach(function (lesson) {
    if (themes.indexOf(lesson.theme) < 0) themes.push(lesson.theme);
  });
  assert(themes.length >= 3, 'only ' + themes.length + ' themes');
  assert(themes.length <= 6, themes.length + ' themes is a maze');
  themes.forEach(function (theme) {
    const count = lessons.filter(function (lesson) { return lesson.theme === theme; }).length;
    assert(count >= 1, theme + ' has no lessons');
  });
});

test('a lesson title is not the name of a panel', function () {
  // "Motion" is the station; the lesson is what the station does with a live
  // source. A title that is just the panel name says nothing about the work.
  const stations = (function () {
    const names = [];
    const matches = block('const GROUPS = [').matchAll(/name: '([A-Za-z ]+)'/g);
    for (const match of matches) names.push(match[1]);
    return names;
  }());
  assert(stations.length >= 10, 'read only ' + stations.length + ' station names');
  lessons.forEach(function (lesson) {
    assert(stations.indexOf(lesson.title) < 0, lesson.id + ' is titled after its own panel: ' + lesson.title);
    assert(lesson.title.indexOf(' ') > 0, lesson.id + ' has a one-word title');
  });
});

group('the steps');

test('every step says what to do and where', function () {
  steps.forEach(function (step) {
    assert(typeof step.title === 'string' && step.title.length >= 3, 'step with no title: ' + JSON.stringify(step.target));
    assert(typeof step.body === 'string' && step.body.length > 40,
      step.title + ' explains too little');
    assert(typeof step.body === 'string' && step.body.length < 700,
      step.title + ' is a wall of text');
    assert(typeof step.target === 'string' && step.target.length > 1, step.title + ' has no target');
  });
});

test('a target names one control, not the whole document', function () {
  steps.forEach(function (step) {
    const target = step.target;
    const SELECTOR = /^([A-Za-z][A-Za-z0-9-]*)?([#.][A-Za-z0-9_-]+|\[[A-Za-z-]+(="[^"]*")?\])+$/;
    assert(SELECTOR.test(target), step.title + ' has a target that is not a selector: ' + target);
    assert(target !== 'body' && target !== '*' && target !== 'html', step.title + ' points at the window');
  });
});

test('the "why" line is a sentence, and rare enough to mean something', function () {
  const withWhy = steps.filter(function (step) { return !!step.why; });
  assert(withWhy.length > 0, 'no step explains why it is worth doing');
  assert(withWhy.length < steps.length, 'every step has a why: the aside stops being an aside');
  withWhy.forEach(function (step) {
    assert(typeof step.why === 'string' && step.why.length > 20, step.title + ' has a throwaway why');
  });
});

test('every panel a step opens is a panel the app has', function () {
  assert(PANELS.length >= 10, 'read only ' + PANELS.length + ' panels out of app.js');
  steps.filter(function (step) { return step.open; }).forEach(function (step) {
    assert(PANELS.indexOf(step.open) >= 0, step.title + ' opens an unknown panel: ' + step.open);
  });
});

test('every command a step runs is a command the app has', function () {
  assert(Object.keys(COMMANDS).length > 25, 'read only ' + Object.keys(COMMANDS).length + ' commands');
  steps.filter(function (step) { return step.show; }).forEach(function (step) {
    assert(Array.isArray(step.show), step.title + ' has a show that is not a list');
    step.show.forEach(function (pair) {
      assert(Array.isArray(pair) && typeof pair[0] === 'string',
        step.title + ' has a show entry that is not [command, arg]');
      assert(COMMANDS[pair[0]], step.title + ' runs an unknown command: ' + pair[0]);
    });
  });
});

test('a step whose Show me would open a dialog is not allowed one', function () {
  // A native dialog stops the tour dead: the learner would be looking at an OS
  // window while the card waits behind it.
  const dialogs = ['file-open', 'file-save-png', 'file-export-txt', 'file-export-preset',
    'file-import-preset', 'file-open-clip', 'file-quit', 'help-guide', 'help-shortcuts'];
  steps.filter(function (step) { return step.show; }).forEach(function (step) {
    step.show.forEach(function (pair) {
      assert(dialogs.indexOf(pair[0]) < 0, step.title + ' would open a dialog: ' + pair[0]);
    });
  });
});

group('the checks');

test('every predicate is a function of the app state and nothing else', function () {
  steps.filter(function (step) { return step.when; }).forEach(function (step) {
    assert(typeof step.when === 'function', step.title + ' has a when that is not a function');
    assert(step.when.length <= 1, step.title + ' takes more than the state');
  });
});

test('nothing is already done when the app opens', function () {
  steps.filter(function (step) { return step.when; }).forEach(function (step) {
    assert.strictEqual(step.when(BASE), false,
      step.title + ' is satisfied on a fresh app, so it would tick itself off before the learner reads it');
  });
});

test('every predicate can come true, or it would never tick', function () {
  const list = candidates();
  steps.filter(function (step) { return step.when; }).forEach(function (step) {
    const reachable = list.some(function (state) { return step.when(state) === true; });
    assert(reachable, step.title + ' checks for a state the app cannot reach');
  });
});

test('no predicate throws on a state it does not expect', function () {
  const odd = [{}, { width: NaN }, { status: '' }, { algorithm: undefined }, { effects: [] }];
  steps.filter(function (step) { return step.when; }).forEach(function (step) {
    odd.forEach(function (state) {
      assert.doesNotThrow(function () { step.when(state); }, step.title + ' throws on ' + JSON.stringify(state));
    });
  });
});

test('the checkable majority is real, not decoration', function () {
  // A lesson with no predicate at all is a slideshow. Most lessons should be
  // able to see that the learner did the thing.
  const checkable = lessons.filter(function (lesson) {
    return lesson.steps.some(function (step) { return !!step.when; });
  });
  assert(checkable.length >= Math.ceil(lessons.length * 0.6),
    'only ' + checkable.length + ' of ' + lessons.length + ' lessons can check anything');
});

/* ---- what the smoke run cannot reach ---------------------------------- */

group('the data as a hole in the app');

test('the four exports and the three looks are all taught', function () {
  const all = steps.map(function (step) { return step.title + ' ' + step.body; }).join(' ');
  ['Export PNG', 'Copy PNG', 'Export .txt', 'Record WebM', 'Webcam'].forEach(function (word) {
    assert(all.indexOf(word) >= 0, 'the tour never mentions ' + word);
  });
  ['Rain Streaks', 'Dot Field', 'Smooth Diffusion'].forEach(function (word) {
    assert(all.indexOf(word) >= 0, 'the tour never mentions the ' + word + ' screen');
  });
});

test('the tour never promises a value the app does not ship', function () {
  // The numbers in the prose are the app's own catalogues: a new algorithm or
  // recipe that is not reflected in the lesson text is a stale sentence.
  const spoken = steps.map(function (step) { return step.body + ' ' + (step.why || ''); }).join(' ');
  const words = { 46: D.ALGORITHMS.length, 24: D.PALETTES.length, 13: D.GLITCHES.length, 21: PRESETS.length };
  Object.keys(words).forEach(function (number) {
    const spelled = {
      13: 'thirteen', 21: 'twenty-one', 24: 'twenty-four', 46: 'forty-six',
    }[number];
    if (words[number] !== Number(number)) {
      assert(spoken.indexOf(spelled) < 0 && spoken.indexOf(number) < 0,
        'the tour says ' + number + ' but the app has ' + words[number]);
    }
  });
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
