#!/usr/bin/env node
/* make-examples.js: rebuild every picture in examples/ with the app's own press.
 *
 *   node tools/make-examples.js              # all of them
 *   node tools/make-examples.js --list       # print the set and write nothing
 *   node tools/make-examples.js vhs c64      # only the ones named
 *   node tools/make-examples.js --width 1400 # draw bigger (0 = the painting's own size)
 *
 * Nothing here is a mock. The script opens the launcher build in a real browser,
 * loads one of the three paintings that ship inside the app (`launcher/samples.js`),
 * applies the recipe through the same calls the panels make, and writes the pixels
 * the app actually drew. Because the source is the built-in table rather than
 * anything in `inbox/`, a fresh clone can rebuild the whole folder with no
 * uncommitted material.
 *
 * Every recipe is checked against the real catalogues before a single pixel is
 * drawn: an algorithm, palette, tone map, ramp or effect that does not exist fails
 * the run and names itself, so a picture in examples/ cannot claim a setting the
 * app does not have.
 *
 * Playwright is installed globally (see DEVELOPMENT.md), never as a dependency of
 * this repository; the loader below finds it on the global npm root.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function loadPlaywright() {
  try {
    return require('playwright');
  } catch (err) {
    const root = execSync('npm root -g', { encoding: 'utf8' }).trim();
    return require(path.join(root, 'playwright'));
  }
}

let chromium;
try {
  chromium = loadPlaywright().chromium;
} catch (err) {
  console.error('Playwright is not available. Install it with:\n' +
    '  npm install -g playwright\n  playwright install chromium\n' +
    'Then run this script again. (' + err.message + ')');
  process.exit(2);
}

const APP = 'file:///' + path.join(__dirname, '..', 'launcher', 'index.html').replace(/\\/g, '/');
const OUT = path.join(__dirname, '..', 'examples');

/* The app renders at whatever resolution it is handed, and this set at the
 * paintings' own size runs to five megabytes. So every source is drawn down to
 * this width before it is loaded - the picture stays the app's own output, only
 * of a smaller source - and `--width 0` rebuilds the folder at native size. */
const widthFlag = process.argv.indexOf('--width');
const WIDTH = widthFlag >= 0 ? Number(process.argv[widthFlag + 1]) : 900;

if (!Number.isFinite(WIDTH) || WIDTH < 0) {
  console.error('--width needs a number of pixels (0 for the painting\'s own size)');
  process.exit(2);
}

/* ---- the set -------------------------------------------------------------
 *
 * One entry per picture. `sample` names one of the built-in paintings; `preset`
 * is a whole preset taken in one pick, the way the Presets panel applies it, and
 * `recipe` holds only the individual settings an example deliberately chooses
 * for itself. `shows` is the sentence the README prints under the picture.
 */
const EXAMPLES = [
  {
    id: 'zine', out: 'thor-zine-1bit.png', sample: "Tor's Fight with the Giants",
    preset: 'zine',
    shows: 'Floyd\u2013Steinberg diffusion into one bit, the honest photocopied zine',
  },
  {
    id: 'duo', out: 'council-riso-duotone.png', sample: 'The Council of the Gods',
    preset: 'duo',
    shows: 'two inks and nothing else, the duotone a riso poster is built on',
  },
  {
    id: 'c64', out: 'council-c64-poster.png', sample: 'The Council of the Gods',
    preset: 'c64',
    shows: "the Commodore 64's own sixteen colours, a poster forty years late",
  },
  {
    id: 'terminal', out: 'oedipus-terminal-green.png', sample: 'Oedipus and the Sphinx',
    preset: 'terminal',
    shows: 'a phosphor re-ink on a four-shade screen, with scanlines over the top',
  },
  {
    id: 'vhs', out: 'thor-vhs-decay.png', sample: "Tor's Fight with the Giants",
    preset: 'vhs',
    shows: 'the whole effects stack at once - aberration, blocks, scanlines and grain',
  },
  {
    id: 'sort', out: 'oedipus-glitch-sort.png', sample: 'Oedipus and the Sphinx',
    preset: 'sort',
    shows: 'pixel sorting - rows of the proof reordered by tone instead of drawn in place',
  },
  {
    id: 'thermal', out: 'thor-thermal-cam.png', sample: "Tor's Fight with the Giants",
    preset: 'thermal',
    shows: 'a thermal re-ink: the grade decides what is hot, the dither decides the edges',
  },
  {
    id: 'newsprint', out: 'oedipus-newsprint.png', sample: 'Oedipus and the Sphinx',
    preset: 'newsprint',
    shows: 'a halftone screen - an ordered dot at every pixel size, no noise anywhere',
  },
  {
    id: 'mixing', out: 'council-yliluoma-ega.png', sample: 'The Council of the Gods',
    recipe: { algorithm: 'yliluoma-polished', palette: 'ega', pixelSize: 2 },
    shows: 'Yliluoma mixing: a sixteen-colour hardware palette, blended in dots rather than snapped',
  },
  {
    id: 'pixel', out: 'thor-pixel-art-6x.png', sample: "Tor's Fight with the Giants",
    recipe: { algorithm: 'clustered-dot', palette: 'gameboy-pocket', pixelSize: 6 },
    shows: 'pixel size 6 on a four-ink handheld screen - the chunky output people come for',
  },
  {
    id: 'gold', out: 'oedipus-gold-leaf.png', sample: 'Oedipus and the Sphinx',
    recipe: { algorithm: 'blue-noise-32', palette: 'gray-4', toneMap: 'gold', pixelSize: 1 },
    effects: [{ id: 'vignette', amount: 45 }],
    glow: { radius: 2, intensity: 40 },
    shows: 'four greys under a blue-noise screen, re-inked as gold leaf and lit from behind',
  },
  {
    id: 'text', out: 'oedipus-text-mode-ascii.png', sample: 'Oedipus and the Sphinx',
    recipe: { algorithm: 'atkinson', palette: 'bw', pixelSize: 1 },
    text: { on: true, ramp: 'ascii', size: 12 },
    shows: 'type mode: the same proof set in characters, the grid the .txt export carries',
  },
];

const only = process.argv.slice(2).filter(function (arg, i, all) {
  return !arg.startsWith('--') && all[i - 1] !== '--width';
});
const jobs = only.length ? EXAMPLES.filter(function (job) { return only.indexOf(job.id) >= 0; }) : EXAMPLES;

if (process.argv.indexOf('--list') >= 0) {
  for (const job of EXAMPLES) {
    console.log(job.id.padEnd(10) + job.out.padEnd(34) + job.sample);
  }
  console.log('\n' + EXAMPLES.length + ' examples. Run with no arguments to rebuild them all.');
  process.exit(0);
}

if (!jobs.length) {
  console.error('no example matches: ' + only.join(', '));
  process.exit(2);
}

/* ---- what the folder says about itself ----------------------------------- */

const BEGIN = '<!-- examples:begin -->';
const END = '<!-- examples:end -->';
const DOT = '\u00b7';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* The recipe as a person reads it: the preset taken, or the settings chosen by
 * hand, followed by whatever the example stacked on top. */
function recipeOf(item) {
  const parts = [];
  if (item.preset) {
    parts.push('preset `' + item.preset + '`');
  } else {
    const recipe = item.recipe || {};
    if (recipe.algorithm) parts.push('`' + recipe.algorithm + '`');
    if (recipe.palette) parts.push('`' + recipe.palette + '`');
    if (recipe.toneMap) parts.push('tone `' + recipe.toneMap + '`');
    if (recipe.pixelSize) parts.push('pixel size ' + recipe.pixelSize);
  }
  if (item.text) parts.push('type mode, `' + item.text.ramp + '` at ' + item.text.size + 'px');
  if (item.effectList && item.effectList.length) parts.push('effects: ' + item.effectList.join(', '));
  if (item.glow) parts.push('glow ' + item.glow.radius + '/' + item.glow.intensity);
  return parts.join(' ' + DOT + ' ');
}

/* The README's list carries the pictures themselves: GitHub renders the images,
 * so the folder's front door is the gallery, and every file name is a link to the
 * proof at full size. */
function table(items) {
  const head = '| Picture | File, source and recipe | Drawn as | What it shows |\n|---|---|---|---|\n';
  return head + items.map(function (item) {
    return '| [![' + item.sample + ': ' + item.shows + '](' + item.out + ')](' + item.out + ')' +
      ' | **`' + item.out + '`**<br>' + item.sample + '<br>' + recipeOf(item) +
      ' | ' + item.algorithm + ' ' + DOT + ' ' + item.palette + ' ' + DOT + ' ' + item.colors + ' colours ' + DOT +
      ' ' + item.px + '<br>' + Math.round(item.bytes / 1024) + ' KB' +
      ' | ' + item.shows + ' |';
  }).join('\n') + '\n';
}

function sheet(items) {
  const cards = items.map(function (item, index) {
    const size = item.px.split('\u00d7');
    return [
      '      <figure class="card">',
      '        <a class="shot" href="' + escapeHtml(item.out) + '" data-full="' + escapeHtml(item.out) + '">',
      '          <img src="' + escapeHtml(item.out) + '" width="' + size[0] + '" height="' + size[1] +
        '" loading="' + (index < 3 ? 'eager' : 'lazy') + '" alt="' +
        escapeHtml(item.sample + ' \u2014 ' + item.shows) + '">',
      '          <span class="zoom">open full size</span>',
      '        </a>',
      '        <figcaption>',
      '          <p class="name">' + escapeHtml(item.out) + '</p>',
      '          <p class="shows">' + escapeHtml(item.shows) + '</p>',
      '          <p class="readout">' + escapeHtml(item.sample) + ' \u2192 <b>' + escapeHtml(item.algorithm) +
        '</b> ' + DOT + ' <b>' + escapeHtml(item.palette) + '</b> ' + DOT + ' ' + item.colors +
        ' colours ' + DOT + ' ' + escapeHtml(item.px) + ' ' + DOT + ' ' + Math.round(item.bytes / 1024) + ' KB</p>',
      '          <p class="recipe">' + escapeHtml(recipeOf(item).replace(/`/g, '')) + '</p>',
      '        </figcaption>',
      '      </figure>',
    ].join('\n');
  }).join('\n');

  const distinct = function (key) {
    return items.map(function (item) { return item[key]; })
      .filter(function (name, i, all) { return all.indexOf(name) === i; }).length;
  };
  const total = Math.round(items.reduce(function (sum, item) { return sum + item.bytes; }, 0) / 1024);
  const shell = 'node tools/make-examples.js';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dither Studio \u2014 examples</title>
<meta name="description" content="Proofs drawn by Dither Studio itself, with the recipe behind each one.">
<style>
  :root {
    --bg: #0e0f13;        /* page ground            */
    --panel: #15171d;     /* rails, headers          */
    --panel-2: #1b1e26;   /* controls, raised chips  */
    --line: #262a34;      /* hairlines and borders   */
    --text: #e8eaf0;      /* primary text            */
    --muted: #8b91a3;     /* labels, secondary text  */
    --accent: #7aa2ff;    /* the single accent       */
    --well: #0b0c10;      /* the recessed glass      */
    --radius: 8px;
    --font: "SF Mono", "Cascadia Code", Consolas, "JetBrains Mono", Menlo, monospace;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font: 13px/1.5 var(--font);
    -webkit-font-smoothing: antialiased;
  }

  a { color: var(--accent); }
  a:focus-visible, button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  header {
    border-bottom: 1px solid var(--line);
    background: var(--panel);
    padding: 22px clamp(16px, 4vw, 44px) 18px;
  }

  h1 { margin: 0; font-size: 20px; letter-spacing: 0.06em; font-weight: 600; }
  h1 .mark { color: var(--accent); }
  h1 .tag { color: var(--muted); font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; }

  header p { margin: 10px 0 0; max-width: 80ch; color: var(--muted); }

  .statusbar {
    display: flex; flex-wrap: wrap; gap: 6px 22px;
    margin-top: 15px; color: var(--muted); font-size: 12px;
  }
  .statusbar b { color: var(--text); font-weight: 600; }

  main {
    columns: 330px 3;
    column-gap: 24px;
    padding: 24px clamp(16px, 4vw, 44px) 20px;
  }

  .card { margin: 0 0 26px; break-inside: avoid; display: flex; flex-direction: column; gap: 10px; }

  .shot {
    position: relative;
    display: block;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--well);
    overflow: hidden;
  }
  .shot img { display: block; width: 100%; height: auto; }
  .shot .zoom {
    position: absolute; right: 8px; bottom: 8px;
    border: 1px solid var(--line);
    background: var(--panel);
    color: var(--muted);
    font-size: 11px; letter-spacing: 0.06em;
    padding: 2px 8px; border-radius: 999px;
    opacity: 0; transition: opacity 150ms ease;
  }
  .shot:hover .zoom, .shot:focus-visible .zoom { opacity: 1; }

  figcaption p { margin: 0; }
  .name { font-size: 12px; letter-spacing: 0.02em; }
  .shows { margin-top: 5px; }
  .readout, .recipe { color: var(--muted); font-size: 12px; margin-top: 5px; }
  .readout b { color: var(--text); font-weight: 600; }

  footer {
    border-top: 1px solid var(--line);
    padding: 18px clamp(16px, 4vw, 44px) 34px;
    color: var(--muted);
  }
  footer p { margin: 0 0 8px; max-width: 84ch; }
  code {
    background: var(--panel-2); border: 1px solid var(--line);
    border-radius: 4px; padding: 1px 5px; color: var(--text);
  }

  dialog {
    border: 1px solid var(--line); border-radius: var(--radius);
    background: var(--panel); color: var(--text);
    padding: 10px; max-width: 96vw; max-height: 96vh;
  }
  dialog::backdrop { background: rgba(4, 5, 8, 0.87); }
  dialog img { display: block; max-width: 92vw; max-height: 82vh; }
  dialog .bar { display: flex; justify-content: space-between; gap: 16px; align-items: baseline; padding: 0 2px 8px; }
  dialog .bar b { font-weight: 600; }
  dialog .bar span { color: var(--muted); font-size: 12px; }
  dialog button {
    border: 1px solid var(--line); background: var(--panel-2); color: var(--text);
    font: 12px/1 var(--font); padding: 5px 9px; border-radius: 6px; cursor: pointer;
  }
  dialog button:hover { border-color: var(--accent); color: var(--accent); }

  @media (max-width: 1080px) {
    main { columns: 320px 2; }
  }

  @media (max-width: 720px) {
    main { columns: 1; }
  }
</style>
</head>
<body>
<header>
  <h1><span class="mark">Dither Studio</span> <span class="tag">/ examples</span></h1>
  <p>Every picture here was drawn by Dither Studio itself, from the paintings that ship
  inside it \u2014 no exported mock-ups, no outside sources. The recipe under each one is what
  the app was actually set to; the readout beside it is what came out. Choose a proof to open
  the file itself.</p>
  <div class="statusbar">
    <span>Pictures <b>${items.length}</b></span>
    <span>Algorithms <b>${distinct('algorithm')}</b></span>
    <span>Palettes <b>${distinct('palette')}</b></span>
    <span>On disk <b>${total} KB</b></span>
    <span>Rebuild <b>${shell}</b></span>
  </div>
</header>
<main>
${cards}
</main>
<footer>
  <p>Rebuild this page and every file on it from a clone with <code>${shell}</code>.
  The generator opens the real build, applies each recipe through the same calls the panels
  make, checks it against the app\u2019s own catalogues, and fails rather than drawing something
  the app cannot make.</p>
  <p>The paintings and their licences are recorded in <a href="../SOURCES.md">SOURCES.md</a>;
  <a href="README.md">README.md</a> lists the same set as a table, and
  <a href="../GUIDE.md">GUIDE.md</a> explains every control named above.</p>
</footer>

<dialog id="viewer">
  <div class="bar">
    <b id="viewer-name"></b>
    <span id="viewer-facts"></span>
    <button type="button" id="viewer-close">close (esc)</button>
  </div>
  <img id="viewer-image" alt="">
</dialog>

<script>
  (function () {
    const viewer = document.getElementById('viewer');
    const image = document.getElementById('viewer-image');
    const name = document.getElementById('viewer-name');
    const facts = document.getElementById('viewer-facts');
    if (!viewer || typeof viewer.showModal !== 'function') return;   // plain links without it

    document.querySelectorAll('.shot').forEach(function (link) {
      link.addEventListener('click', function (event) {
        const card = link.closest('.card');
        event.preventDefault();
        image.src = link.getAttribute('data-full');
        image.alt = link.querySelector('img').alt;
        name.textContent = link.getAttribute('data-full');
        facts.textContent = card ? card.querySelector('.readout').textContent : '';
        viewer.showModal();
      });
    });

    document.getElementById('viewer-close').addEventListener('click', function () { viewer.close(); });
    viewer.addEventListener('click', function (event) {
      if (event.target === viewer) viewer.close();      // the backdrop is the dialog itself
    });
  }());
</script>
</body>
</html>
`;
}

/* ---- drive the app ------------------------------------------------------- */

(async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 1 });
  const problems = [];
  page.on('pageerror', function (err) { problems.push('pageerror: ' + err.message); });
  page.on('console', function (msg) { if (msg.type() === 'error') problems.push('console: ' + msg.text()); });

  await page.goto(APP);
  await page.waitForFunction(function () { return !!(window.__dither && window.__dither.stats); });
  await page.waitForTimeout(1200);          // the app opens on the first painting

  // The catalogues the recipes are written against, read out of the app itself.
  const catalogue = await page.evaluate(function () {
    const D = window.DitherLib;
    const ids = function (list) { return list.map(function (item) { return item.id; }); };
    const options = function (selector) {
      return Array.prototype.map.call(document.querySelectorAll(selector + ' option'),
        function (option) { return option.value; }).filter(Boolean);
    };
    return {
      algorithms: ids(D.ALGORITHMS),
      palettes: ids(D.PALETTES),
      toneMaps: ids(D.TONE_MAPS),
      effects: ids(D.GLITCHES),
      ramps: options('#text-charset'),
      presets: options('#preset'),
      samples: (window.DitherSamples || []).map(function (sample) { return sample.name; }),
    };
  });

  // Check every recipe before drawing anything: a typo should fail the run, not
  // quietly produce a picture with the wrong settings behind it.
  const wrong = [];
  const check = function (job, list, value, what) {
    if (value !== undefined && list.indexOf(value) < 0) wrong.push(job.id + ': ' + what + ' "' + value + '"');
  };
  for (const job of jobs) {
    check(job, catalogue.samples, job.sample, 'sample');
    check(job, catalogue.presets, job.preset, 'preset');
    check(job, catalogue.ramps, job.text && job.text.ramp, 'ramp');
    const recipe = job.recipe || {};
    check(job, catalogue.algorithms, recipe.algorithm, 'algorithm');
    check(job, catalogue.palettes, recipe.palette, 'palette');
    check(job, catalogue.toneMaps, recipe.toneMap, 'tone map');
    for (const effect of job.effects || []) check(job, catalogue.effects, effect.id, 'effect');
  }
  if (wrong.length) {
    console.error('the recipes name something the app does not have:\n  ' + wrong.join('\n  '));
    await browser.close();
    process.exit(1);
  }
  console.log('the recipes check out against ' + catalogue.algorithms.length + ' algorithms, ' +
    catalogue.palettes.length + ' palettes, ' + catalogue.toneMaps.length + ' tone maps, ' +
    catalogue.effects.length + ' effects and ' + catalogue.samples.length + ' built-in pictures\n');

  const done = [];
  for (const job of jobs) {
    // The painting, as the app itself carries it.
    const data = await page.evaluate(function (name) {
      const found = (window.DitherSamples || []).filter(function (sample) { return sample.name === name; })[0];
      return found ? found.data : null;
    }, job.sample);
    if (!data) throw new Error('the built-in table has no sample called ' + job.sample);

    // Drawn down to the width cap first, so the folder stays light to clone.
    const source = await page.evaluate(function (arg) {
      return new Promise(function (resolve) {
        const image = new Image();
        image.onload = function () {
          const scale = arg.width ? Math.min(1, arg.width / image.naturalWidth) : 1;
          if (scale === 1) {
            resolve({ url: arg.url, w: image.naturalWidth, h: image.naturalHeight, was: image.naturalWidth });
            return;
          }
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(image.naturalWidth * scale);
          canvas.height = Math.round(image.naturalHeight * scale);
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve({ url: canvas.toDataURL('image/png'), w: canvas.width, h: canvas.height, was: image.naturalWidth });
        };
        image.onerror = function () { resolve(null); };
        image.src = arg.url;
      });
    }, { url: data, width: WIDTH });
    if (!source) throw new Error('could not read the built-in picture ' + job.sample);

    await page.evaluate(function (arg) { window.__dither.loadDataURL(arg.url, arg.name); },
      { url: source.url, name: job.sample });
    await page.waitForFunction(function (name) { return window.__dither.stats().file === name; },
      job.sample, { timeout: 30000 });

    // Full quality before anything is set, so the pixels saved are the proof and
    // not whichever preview resolution happened to be selected.
    await page.evaluate(function () { window.__dither.setQuality('full'); });
    await page.waitForTimeout(200);

    // A whole recipe in one pick, the way the Presets panel applies it...
    if (job.preset) {
      await page.evaluate(function (id) { window.__dither.applyPreset(id); }, job.preset);
      await page.waitForTimeout(200);
    }
    // ...then only what this example deliberately sets on top.
    for (const key of Object.keys(job.recipe || {})) {
      await page.evaluate(function (arg) { window.__dither.setSetting(arg.key, arg.value); },
        { key: key, value: job.recipe[key] });
    }
    for (const key of Object.keys(job.glow || {})) {
      await page.evaluate(function (arg) { window.__dither.setSetting('glow.' + arg.key, arg.value); },
        { key: key, value: job.glow[key] });
    }
    // Type mode is a switch rather than a setting.
    if (job.text) {
      await page.evaluate(function (text) { window.__dither.setText(text.on, text.ramp, text.size); }, job.text);
    }
    // The stack lives in the chrome rather than in settings (render() rebuilds
    // `settings.glitches` from it), so it is driven the way a person drives it:
    // add the effect, then move its own amount slider.
    for (const effect of job.effects || []) {
      await page.evaluate(function (id) { window.__dither.addEffect(id); }, effect.id);
      await page.waitForTimeout(60);
      if (effect.amount !== undefined) {
        const moved = await page.evaluate(function (arg) {
          const row = document.querySelector('.stack-row[data-effect="' + arg.id + '"]');
          const range = row && row.querySelector('input[type="range"]');
          if (!range) return false;
          range.value = String(arg.amount);
          range.dispatchEvent(new Event('input', { bubbles: true }));
          range.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }, { id: effect.id, amount: effect.amount });
        if (!moved) throw new Error('the effects stack has no ' + effect.id + ' row to set');
      }
    }

    // Let the queued previews settle, flatten onto paper, and take the last full
    // render with it, so what is saved is the proof and not a half-res preview.
    await page.waitForTimeout(600);
    await page.evaluate(function () { window.__dither.setSetting('alphaMode', 'matte'); });
    await page.waitForTimeout(400);

    const shot = await page.evaluate(function () {
      const canvas = document.getElementById('canvas');
      return {
        png: canvas.toDataURL('image/png'),
        stats: window.__dither.stats(),
        colors: window.__dither.canvasColors(),
        grid: window.__dither.textGrid ? window.__dither.textGrid() : null,
      };
    });
    const file = path.join(OUT, job.out);
    fs.writeFileSync(file, Buffer.from(shot.png.split(',')[1], 'base64'));
    const bytes = fs.statSync(file).size;
    const size = shot.stats.width + '\u00d7' + shot.stats.height;
    done.push({
      id: job.id, out: job.out, shows: job.shows, sample: job.sample,
      preset: job.preset || null, recipe: job.recipe || null, glow: job.glow || null,
      text: job.text || null, effectList: (job.effects || []).map(function (fx) {
        return fx.id + (fx.amount !== undefined ? ' ' + fx.amount : '');
      }),
      source: source.w + '\u00d7' + source.h, px: size, bytes: bytes,
      algorithm: shot.stats.algorithm, palette: shot.stats.palette, pixelSize: shot.stats.pixelSize,
      toneMap: shot.stats.toneMap, effects: shot.stats.glitches, textMode: shot.stats.textMode,
      colors: shot.colors, ms: shot.stats.ms, grid: shot.grid,
    });
    console.log(job.id.padEnd(10) + job.out.padEnd(34) + String(shot.stats.algorithm).padEnd(18) +
      String(shot.stats.palette).padEnd(16) + size.padEnd(11) +
      String(shot.colors).padStart(6) + ' colours  ' +
      String(shot.stats.ms).padStart(5) + ' ms  ' +
      String(Math.round(bytes / 1024)).padStart(5) + ' KB');
  }

  const heaviest = done.slice().sort(function (a, b) { return b.bytes - a.bytes; })[0];
  const total = done.reduce(function (sum, item) { return sum + item.bytes; }, 0);
  console.log('\n' + done.length + ' pictures, ' + Math.round(total / 1024) + ' KB in all, written to examples/');
  console.log('the heaviest is ' + heaviest.out + ' at ' + Math.round(heaviest.bytes / 1024) + ' KB');
  if (WIDTH) console.log('each source was drawn to ' + WIDTH + ' px first (--width 0 for native size)');

  fs.writeFileSync(path.join(OUT, 'examples.json'), JSON.stringify({
    width: WIDTH, catalogue: catalogue, pictures: done,
  }, null, 2) + '\n');

  // The page and the reference list are written from this same list, so neither
  // can describe a recipe the folder does not contain.
  fs.writeFileSync(path.join(OUT, 'index.html'), sheet(done));
  const readme = path.join(OUT, 'README.md');
  if (fs.existsSync(readme)) {
    const before = fs.readFileSync(readme, 'utf8');
    const from = before.indexOf(BEGIN);
    const to = before.indexOf(END);
    if (from >= 0 && to > from) {
      fs.writeFileSync(readme, before.slice(0, from + BEGIN.length) + '\n' + table(done) + before.slice(to));
      console.log('the list between the README markers is refreshed');
    } else {
      console.log('examples/README.md has no ' + BEGIN + ' marker, so its list is left alone');
    }
  }
  console.log('examples/index.html and examples/examples.json written');

  if (problems.length) {
    console.log('\nthe app reported problems while it drew:\n  ' + problems.slice(0, 10).join('\n  '));
  }
  await browser.close();
  if (problems.length) process.exit(1);
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
