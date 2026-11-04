/* render.js - draw the film frame by frame and encode it.
 *
 *   node publicity/render.js            # every frame, then MP4 + poster
 *   node publicity/render.js --stills 2,14,31   # just those seconds, for review
 *
 * The film is a pure function of time (window.seek), so a frame can be redrawn
 * identically at any moment: that is what makes the export frame-accurate
 * instead of a screen recording. Playwright and ffmpeg are tools here, never
 * dependencies of the project.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'out');
const FRAMES = path.join(OUT, 'frames');
// The film moves on twos, so twelve distinct frames a second carry it. The
// encode duplicates each one back to a 24fps master: same picture, half the draw.
const FPS = Number(process.env.RENDER_FPS || 12);
const OUT_FPS = 24;
const DURATION = 40;

function playwright() {
  const candidates = [
    'playwright',
    path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'playwright'),
  ];
  for (const id of candidates) {
    try { return require(id); } catch (err) { /* try the next one */ }
  }
  throw new Error('Playwright is not installed. npm i -g playwright, then run this again.');
}

(async function main() {
  const { chromium } = playwright();
  const stills = process.argv.includes('--stills')
    ? String(process.argv[process.argv.indexOf('--stills') + 1]).split(',').map(Number)
    : null;

  fs.mkdirSync(OUT, { recursive: true });
  if (!stills) {
    fs.rmSync(FRAMES, { recursive: true, force: true });
    fs.mkdirSync(FRAMES, { recursive: true });
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const url = 'file:///' + path.join(ROOT, 'launch.html').replace(/\\/g, '/') + '?render';
  await page.goto(url);
  await page.waitForFunction(function () { return typeof window.seek === 'function'; });
  await page.evaluate(function () {
    return Promise.all(Array.from(document.images).map(function (img) {
      return img.decode().catch(function () { return null; });
    }));
  });

  if (stills) {
    for (const at of stills) {
      const file = path.join(OUT, 'still-' + at.toFixed(1) + 's.png');
      await page.evaluate(function (t) { window.seek(t); }, at);
      await page.screenshot({ path: file });
      console.log('still', path.relative(process.cwd(), file));
    }
    await browser.close();
    return;
  }

  const total = Math.round(DURATION * FPS);
  for (let f = 0; f < total; f++) {
    await page.evaluate(function (t) { window.seek(t); }, f / FPS);
    await page.screenshot({ path: path.join(FRAMES, String(f).padStart(5, '0') + '.png') });
    if (f % 120 === 0) console.log('frame', f, 'of', total);
  }
  await browser.close();

  const mp4 = path.join(OUT, 'dither-studio-launch.mp4');
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-framerate', String(FPS),
    '-i', path.join(FRAMES, '%05d.png'),
    // -vf is an output option: it has to follow the input, or ffmpeg treats it
    // as a filter on the image sequence itself and refuses to open it.
    '-vf', 'fps=' + OUT_FPS,
    '-r', String(OUT_FPS),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    mp4,
  ], { stdio: 'inherit' });

  fs.copyFileSync(path.join(FRAMES, String(Math.round(2 * FPS)).padStart(5, '0') + '.png'), path.join(OUT, 'poster.png'));
  console.log('wrote', path.relative(process.cwd(), mp4));
})().catch(function (err) {
  console.error(err && err.stack || err);
  process.exit(1);
});
