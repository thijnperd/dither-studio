/* smoke.js - run one small smoke suite, or the full in-page set.
 *
 *     node tools/smoke.js quick      # boot, chrome and a live proof (default)
 *     node tools/smoke.js plugins    # manager, sizes, Shape Press, presets, both dialogs
 *     node tools/smoke.js animation  # timeline, playhead and transport
 *     node tools/smoke.js all        # every in-page check; slower, for CI/release
 *     node tools/smoke.js list       # what is available
 *
 * `npm run smoke` is the quick suite; `npm run smoke:all` is the full one. Each
 * suite boots the real app with a fresh profile, so they are independent.
 */
'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

const SUITES = {
  quick: {
    script: 'smoke-quick.js',
    blurb: 'boot, chrome, catalogue and a live proof',
  },
  plugins: {
    script: 'smoke-plugins.js',
    blurb: 'plugin manager/sections/sizes, Shape Press, presets, Ink Extractor, Color Scheme Maker',
  },
  animation: {
    script: 'smoke-animation.js',
    blurb: 'animation timeline, playhead and still restore',
  },
  all: {
    script: 'smoke-in-page.js',
    blurb: 'the complete in-page check set (slow)',
  },
};

const name = (process.argv[2] || 'quick').replace(/^--/, '');
if (name === 'list' || name === '--list') {
  Object.keys(SUITES).forEach(function (id) {
    console.log(id + '\t' + SUITES[id].blurb);
  });
  process.exit(0);
}
if (!SUITES[name]) {
  console.error('unknown smoke suite: ' + name);
  console.error('choose: ' + Object.keys(SUITES).join(', '));
  process.exit(2);
}

const desktop = path.join(__dirname, '..');
let electron;
try {
  electron = require('electron');
} catch (err) {
  console.error('electron is not installed; run npm install in desktop/ first');
  process.exit(2);
}

const env = Object.assign({}, process.env);
// The splash is a release screenshot, not a check. Skipping it is what makes
// the small suites small; the full suite still captures it.
if (name !== 'all') env.DITHER_NO_SPLASH = '1';

const result = spawnSync(electron, [
  '.', '--smoke',
  '--smoke-script', path.join(__dirname, SUITES[name].script),
], { cwd: desktop, env: env, stdio: 'inherit' });

if (result.error) {
  console.error('could not start the smoke run: ' + result.error.message);
  process.exit(2);
}
process.exit(result.status === null ? 1 : result.status);
