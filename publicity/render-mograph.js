/* render-mograph.js - draw the second film frame by frame and encode it.
 *
 *   node publicity/render-mograph.js                  # every frame, then MP4 + poster
 *   node publicity/render-mograph.js --stills 3,11.5  # just those seconds, for review
 *   node publicity/render-mograph.js --phone          # the 1080 x 1920 cut
 *   node publicity/render-mograph.js --phone --notext --scrub
 *
 * The page is a pure function of time (window.seek), so a frame can be redrawn
 * identically at any moment. That is what makes the export frame-accurate
 * instead of a screen recording.
 *
 * --phone captures mograph-phone.html at 1080 x 1920 instead of mograph.html at
 * 1920 x 1080, and writes every artefact under a -phone suffix, so the two cuts
 * render in either order without touching each other.
 *
 * --scrub also writes the scroll encode: keyed every half second, at a size a
 * phone can seek while the page is being scrolled.
 *
 * --allow-file-access-from-files is required: the film reads its own pixels to
 * run the dither engine, and a file:// page is otherwise not allowed to.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'out');
const SILENT = process.argv.includes('--notext');
const PHONE = process.argv.includes('--phone');
const SCRUB = process.argv.includes('--scrub');
const SUFFIX = SILENT ? '-silent' : '';
const SHAPE = PHONE ? '-phone' : '';
const FRAMES = path.join(OUT, 'mograph-frames' + SHAPE + SUFFIX);
const PAGE = PHONE ? 'mograph-phone.html' : 'mograph.html';
const VIEWPORT = PHONE ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };
const FPS = Number(process.env.RENDER_FPS || 12);
const OUT_FPS = 24;

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

  const browser = await chromium.launch({
    args: ['--allow-file-access-from-files', '--force-color-profile=srgb', '--disable-lcd-text'],
  });
  const page = await browser.newPage({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
  });
  page.on('console', (msg) => { if (msg.type() === 'error') console.error('page:', msg.text()); });

  const url = 'file:///' + path.join(ROOT, PAGE).replace(/\\/g, '/') +
    '?render' + (SILENT ? '&notext' : '');
  await page.goto(url);
  await page.waitForFunction(() => window.mograph && window.mograph.ready);
  const info = await page.evaluate(() => window.mograph.state());
  console.log('page:', JSON.stringify(info));
  if (info.images !== info.expected) {
    throw new Error('not every image loaded: ' + info.images + ' of ' + info.expected);
  }

  if (stills) {
    for (const at of stills) {
      const file = path.join(OUT, 'mograph-still-' + at.toFixed(1) + 's' + SHAPE + SUFFIX + '.png');
      await page.evaluate((t) => window.seek(t), at);
      await page.screenshot({ path: file });
      console.log('still', path.relative(process.cwd(), file));
    }
    await browser.close();
    return;
  }

  const duration = await page.evaluate(() => window.DURATION);
  const total = Math.round(duration * FPS);
  for (let f = 0; f < total; f++) {
    await page.evaluate((t) => window.seek(t), f / FPS);
    await page.screenshot({ path: path.join(FRAMES, String(f).padStart(5, '0') + '.png') });
    if (f % 60 === 0) console.log('frame', f, 'of', total);
  }
  await browser.close();

  const mp4 = path.join(OUT, 'dither-studio-mograph' + SHAPE + SUFFIX + '.mp4');
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-framerate', String(FPS),
    '-i', path.join(FRAMES, '%05d.png'),
    '-vf', 'fps=' + OUT_FPS,
    '-r', String(OUT_FPS),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    mp4,
  ], { stdio: 'inherit' });

  // the poster is the spark, not the end card: it is the one frame that is both
  // a painting and a pixel
  fs.copyFileSync(path.join(FRAMES, String(Math.round(6.4 * FPS)).padStart(5, '0') + '.png'),
    path.join(OUT, 'mograph-poster' + SHAPE + SUFFIX + '.png'));
  console.log('wrote', path.relative(process.cwd(), mp4));

  if (SCRUB) {
    /* the stage seeks this file on every scroll tick, so every half second has
       to be a keyframe. 720 px wide is the portrait 720 x 1280 and the
       landscape 1280 x 720, both even, both cheap to decode on a phone. */
    const scrub = path.join(OUT, 'dither-studio-mograph' + SHAPE + SUFFIX + '-scrub.mp4');
    execFileSync('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-i', mp4,
      '-an',
      '-vf', 'scale=720:-2:flags=lanczos',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '25',
      '-g', '12', '-keyint_min', '12', '-sc_threshold', '0',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      scrub,
    ], { stdio: 'inherit' });
    console.log('wrote', path.relative(process.cwd(), scrub));
  }
})().catch(function (err) {
  console.error(err && err.stack || err);
  process.exit(1);
});
