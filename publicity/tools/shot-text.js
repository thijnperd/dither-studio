/* shot-text.js - the third publicity capture: the proof printed as characters. */
(async function () {
  const wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  const D = window.__dither;

  if (window.DitherTour && window.DitherTour.skip) window.DitherTour.skip();
  await wait(400);
  if (D.setGroup) D.setGroup('learn', false);

  for (let i = 0; i < 40 && !(D.stats().colors > 0); i++) await wait(150);

  D.setSetting('palette', 'bw');
  D.setSetting('algorithm', 'bayer8');
  await wait(300);
  D.setText(true, 'ascii', 10);
  if (window.DS) window.DS.command('window-panel-open', 'type');
  await wait(1000);

  return { ok: !!D.textGrid(), shot: 'text', cols: D.textGrid() && D.textGrid().cols };
})()
