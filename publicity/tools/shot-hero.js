/* shot-hero.js - the publicity capture: the app on its Game Boy proof.
 *
 * Run by the app's own harness (electron . --smoke --smoke-script ...), so the
 * photograph is the real window with the real controls: nothing is redrawn.
 *
 * Two waits matter. A fresh profile opens the tutorial and leaves the Learn
 * station in front of the press, and the built-in sample arrives asynchronously,
 * so a recipe applied too early photographs an empty proof. The last loop is a
 * paint nudge: an idle background window can hand capturePage the surface it
 * painted minutes ago, which is how the first attempt caught the startup frame
 * while the app reported the finished recipe.
 */
(async function () {
  const wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  const frame = function () {
    return new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); });
  };
  const D = window.__dither;

  if (window.DitherTour && window.DitherTour.skip) window.DitherTour.skip();
  await wait(500);
  if (D.setGroup) D.setGroup('learn', false);

  for (let i = 0; i < 60 && !(D.stats().colors > 0); i++) await wait(150);

  D.setSetting('algorithm', 'bayer8');
  D.setSetting('palette', 'gameboy');
  D.setSetting('pixelSize', 4);
  if (window.DS) window.DS.command('window-panel-open', 'press');
  await wait(1400);

  for (let i = 0; i < 4; i++) {
    document.body.style.outline = '1px solid transparent';
    await frame();
    document.body.style.outline = '';
    await frame();
  }
  await wait(700);

  return { ok: D.stats().colors > 0, shot: 'hero', stats: D.stats() };
})()
