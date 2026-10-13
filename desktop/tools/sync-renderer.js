/* sync-renderer.js - how the desktop build stays in step with the engine.
 *
 * The desktop app runs the SAME dithering engine as the two web builds, so it
 * does not fork it: this tool copies launcher/`dither.js`, `video.js` and the
 * built-in `samples.js` across verbatim, and `--check` fails if any copy has
 * drifted.
 *
 *     node desktop/tools/sync-renderer.js           # regenerate the copies
 *     node desktop/tools/sync-renderer.js --check   # fail if out of step (CI)
 *
 * The desktop shell is the desktop's own (core.js, app.js). What must stay
 * identical is the engine - the algorithms, the palettes, the pipeline, the
 * video clock - and the paintings the Source panel steps through: that is what
 * makes the same picture come out of every build.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DESKTOP = path.join(__dirname, '..');
const ROOT = path.join(DESKTOP, '..', 'launcher');
const OUT = path.join(DESKTOP, 'src', 'renderer');
const CHECK = process.argv.includes('--check');

// The engine and the built-in source table, copied verbatim. Nothing else is.
const COPIES = ['dither.js', 'video.js', 'samples.js'];

// A checkout may hand these files over with CRLF (Windows runners do), which is
// a property of the checkout and not of the source. Compare on normalised text
// and always write LF, so the check means the same thing on every platform.
const CRLF = String.fromCharCode(13) + String.fromCharCode(10);
const LF = String.fromCharCode(10);

function normalise(text) {
  return String(text).split(CRLF).join(LF);
}

function regenerate() {
  const produced = {};
  COPIES.forEach(function (name) {
    produced[name] = normalise(fs.readFileSync(path.join(ROOT, name), 'utf8'));
  });
  return produced;
}

function main() {
  const produced = regenerate();
  if (CHECK) {
    const stale = Object.keys(produced).filter(function (name) {
      const target = path.join(OUT, name);
      return !fs.existsSync(target) || normalise(fs.readFileSync(target, 'utf8')) !== produced[name];
    });
    if (stale.length) {
      console.error('out of step with the shared engine: ' + stale.join(', '));
      console.error('run: node desktop/tools/sync-renderer.js');
      process.exit(1);
    }
    console.log('the desktop engine copies are in step with the shared core ('
      + Object.keys(produced).join(', ') + ')');
    return;
  }
  Object.keys(produced).forEach(function (name) {
    const target = path.join(OUT, name);
    const before = fs.existsSync(target) ? normalise(fs.readFileSync(target, 'utf8')) : null;
    if (before === produced[name]) {
      console.log('unchanged  ' + name);
      return;
    }
    fs.writeFileSync(target, produced[name]);
    console.log('written    ' + name + '  (' + produced[name].split('\n').length + ' lines)');
  });
  console.log('the engine is in step with ' + path.relative(process.cwd(), ROOT));
}

main();
