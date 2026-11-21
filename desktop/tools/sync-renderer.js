/* sync-renderer.js - how the web and desktop builds stay in step with the engine.
 *
 * There is exactly one dithering engine: `launcher/dither.js`, with its video
 * clock (`video.js`) and the built-in source table (`samples.js`). The desktop
 * app and the frozen web demo do not fork it - this tool copies the three files
 * across verbatim, and `--check` fails if any copy has drifted.
 *
 *     node desktop/tools/sync-renderer.js           # regenerate every copy
 *     node desktop/tools/sync-renderer.js --check   # fail if out of step (CI)
 *
 * The copies stay committed because both targets are meant to run from a plain
 * folder with no build step: `demo/` is published to GitHub Pages as it sits,
 * and the desktop package ships `src/renderer/` as it sits. They are generated,
 * not edited: change the engine once and run this, never the copies.
 *
 * The shells around the engine are each build's own (launcher/app.js,
 * demo/app.js, desktop/src/renderer/core.js and app.js). What must stay
 * identical is the engine - the algorithms, the palettes, the pipeline, the
 * video clock - and the paintings the Source panel steps through: that is what
 * makes the same picture come out of every build.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DESKTOP = path.join(__dirname, '..');
const ROOT = path.join(DESKTOP, '..', 'launcher');
const CHECK = process.argv.includes('--check');

// The engine and the built-in source table, copied verbatim. Nothing else is.
const COPIES = ['dither.js', 'video.js', 'samples.js'];

// Every place that runs the shared engine. The desktop renderer and the frozen
// demo are the generated copies; launcher/ is the source and is never written.
const TARGETS = [
  { name: 'desktop', dir: path.join(DESKTOP, 'src', 'renderer') },
  { name: 'demo', dir: path.join(DESKTOP, '..', 'demo') },
];

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

function readIfPresent(file) {
  return fs.existsSync(file) ? normalise(fs.readFileSync(file, 'utf8')) : null;
}

function main() {
  const produced = regenerate();
  if (CHECK) {
    const stale = [];
    TARGETS.forEach(function (target) {
      Object.keys(produced).forEach(function (name) {
        const copy = readIfPresent(path.join(target.dir, name));
        if (copy !== produced[name]) stale.push(target.name + '/' + name);
      });
    });
    if (stale.length) {
      console.error('out of step with the shared engine: ' + stale.join(', '));
      console.error('run: node desktop/tools/sync-renderer.js');
      process.exit(1);
    }
    console.log('every engine copy is in step with the shared core ('
      + Object.keys(produced).join(', ') + ' in '
      + TARGETS.map(function (target) { return target.name; }).join(', ') + ')');
    return;
  }
  TARGETS.forEach(function (target) {
    Object.keys(produced).forEach(function (name) {
      const file = path.join(target.dir, name);
      if (readIfPresent(file) === produced[name]) {
        console.log('unchanged  ' + target.name + '/' + name);
        return;
      }
      fs.writeFileSync(file, produced[name]);
      console.log('written    ' + target.name + '/' + name + '  (' + produced[name].split('\n').length + ' lines)');
    });
  });
  console.log('the engine is in step with ' + path.relative(process.cwd(), ROOT));
}

main();
