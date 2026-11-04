/* shot-mono.js - the second publicity capture: the 1-bit path, error diffusion. */
(async function () {
  const wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  const D = window.__dither;

  if (window.DitherTour && window.DitherTour.skip) window.DitherTour.skip();
  await wait(400);
  if (D.setGroup) D.setGroup('learn', false);

  for (let i = 0; i < 40 && !(D.stats().colors > 0); i++) await wait(150);

  D.setSetting('algorithm', 'riemersma');
  D.setSetting('palette', 'bw');
  D.setSetting('pixelSize', 3);
  if (window.DS) window.DS.command('window-panel-open', 'ink');
  await wait(900);

  return { ok: D.stats().colors > 0, shot: 'mono', stats: D.stats() };
})()
