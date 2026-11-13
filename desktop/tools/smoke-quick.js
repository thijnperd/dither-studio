/* smoke-quick.js - the small boot suite: chrome, catalogue and one live proof.
 * Selected by `node tools/smoke.js quick` / `npm run smoke`.
 */
(async function () {
  const checks = [];
  function check(name, ok, detail) {
    checks.push({ name: name, ok: !!ok, detail: detail === undefined ? null : detail });
  }
  const wait = function (ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); };

  check('the command surface exists', !!window.DS && typeof window.DS.command === 'function');
  check('the preload bridge is present', !!window.ditherDesktop);
  check('the menu bar has eight menus', document.querySelectorAll('.menubar .menu').length === 8,
    document.querySelectorAll('.menubar .menu').length);
  check('the dock holds all eleven panels', document.querySelectorAll('#rail .group').length === 11,
    document.querySelectorAll('#rail .group').length);
  check('the algorithm list is filled', document.getElementById('algorithm').options.length === window.DitherLib.ALGORITHMS.length,
    document.getElementById('algorithm').options.length);
  check('the palette list is filled', document.getElementById('palette').options.length === window.DitherLib.PALETTES.length,
    document.getElementById('palette').options.length);
  check('the recipe list is filled', document.getElementById('preset').options.length >= 25,
    document.getElementById('preset').options.length);

  const before = window.__dither.canvasHash();
  window.__dither.setSetting('pixelSize', 3);
  await wait(120);
  const after = window.__dither.canvasHash();
  check('a settings change redraws the proof', before !== after, before + ' -> ' + after);
  check('the proof has real pixels', window.__dither.stats().width > 0 && window.__dither.stats().height > 0,
    window.__dither.stats().width + 'x' + window.__dither.stats().height);

  const failed = checks.filter(function (c) { return !c.ok; });
  return {
    ok: !failed.length,
    checks: checks,
    failures: failed.map(function (c) { return c.name; }),
    notes: { suite: 'quick', title: document.title },
  };
}());
