/* smoke-animation.js - the timeline, without the rest of the tour.
 * Selected by `node tools/smoke.js animation` / `npm run smoke:animation`.
 */
(async function () {
  const checks = [];
  function check(name, ok, detail) {
    checks.push({ name: name, ok: !!ok, detail: detail === undefined ? null : detail });
  }
  const wait = function (ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); };

  const started = window.__dither.animationStart();
  await wait(80);
  const stats = window.__dither.animationStats();
  check('Animate the still opens the timeline',
    started === true && !!stats && stats.active === true &&
      document.getElementById('animation-panel').hidden === false);
  check('the timeline starts with one track and a frame count',
    !!stats && stats.tracks.length >= 1 && stats.total === stats.duration * stats.fps,
    stats ? stats.total : null);
  check('the track is a real property with a range',
    !!stats && stats.tracks[0].property === 'ditherStrength' &&
      stats.tracks[0].from !== stats.tracks[0].to);

  window.__dither.animationTick(0);
  const first = window.__dither.canvasHash();
  window.__dither.animationTick(stats.total - 1);
  await wait(50);
  check('moving the playhead re-renders the proof', window.__dither.canvasHash() !== first);
  check('the transport is under the proof', document.getElementById('animation-transport').hidden === false);
  check('the menu state reports the frame',
    !!window.DS.state().animation && window.DS.state().animation.frame === stats.total - 1);

  window.__dither.animationStop();
  await wait(80);
  check('closing the timeline returns the still',
    window.__dither.animationStats().active === false &&
      document.getElementById('animation-panel').hidden === true);

  const failed = checks.filter(function (c) { return !c.ok; });
  return {
    ok: !failed.length,
    checks: checks,
    failures: failed.map(function (c) { return c.name; }),
    notes: { suite: 'animation', stats: window.__dither.animationStats() },
  };
}());
