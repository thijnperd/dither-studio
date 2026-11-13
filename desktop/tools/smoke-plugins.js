/* smoke-plugins.js - the plugin and preset path, without the rest of the tour.
 * Selected by `node tools/smoke.js plugins` / `npm run smoke:plugins`.
 */
(async function () {
  const checks = [];
  function check(name, ok, detail) {
    checks.push({ name: name, ok: !!ok, detail: detail === undefined ? null : detail });
  }
  const wait = function (ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); };
  const optionNames = function (id) {
    return Array.prototype.slice.call(document.getElementById(id).options)
      .map(function (option) { return option.textContent; });
  };

  const plugins = window.DitherPlugins;
  check('the plugin store is published', !!plugins && typeof plugins.install === 'function');
  check('Shape Press is hidden before its package is installed',
    optionNames('effect-add').indexOf('Shape Press') < 0);

  const catalogue = plugins ? await plugins.refresh(true, true) : null;
  check('the bundled catalogue is readable', !!catalogue && catalogue.plugins.length >= 6,
    catalogue ? catalogue.plugins.length : 0);

  const ink = plugins ? await plugins.install('ink-extractor', true) : null;
  check('Ink Extractor installs from the package path', !!ink && ink.id === 'ink-extractor');

  const shape = plugins ? await plugins.install('shape-press', true) : null;
  check('Shape Press installs from the package path', !!shape && shape.id === 'shape-press');
  check('installing Shape Press adds it to the effect picker',
    optionNames('effect-add').indexOf('Shape Press') >= 0);

  const before = window.__dither.canvasHash();
  window.__dither.addEffect('shapepress');
  await wait(160);
  check('Shape Press draws a different proof', window.__dither.canvasHash() !== before);
  check('Shape Press offers its four modes',
    !!document.querySelector('#effect-list .stack-row[data-effect="shapepress"] .stack-mode'));
  window.__dither.removeEffect('shapepress');

  const inkPack = plugins ? await plugins.install('dreamy-cyberpunk', true) : null;
  check('the Dreamy Cyberpunk pack installs', !!inkPack && inkPack.id === 'dreamy-cyberpunk');
  check('its two recipes join the picker',
    optionNames('preset').indexOf('Dreamy Cyberpunk · Glitch 1') >= 0 &&
      optionNames('preset').indexOf('Dreamy Cyberpunk · Glitch 2') >= 0);
  window.__dither.applyPreset('dreamy-cyberpunk-1');
  await wait(120);
  const dreamy = window.__dither.stats();
  check('the recipe selects the Cyberpunk Breach palette', dreamy.palette === 'cyberpunk-breach', dreamy.palette);
  check('the recipe carries its glitch stack', dreamy.effects.indexOf('temporal') >= 0, dreamy.effects.join(','));

  const extracted = window.__dither.extractPalette(8, 'cins');
  check('Ink Extractor reads the open proof', !!extracted && extracted.length >= 2, extracted ? extracted.length + ' inks' : null);
  check('the Ink Extractor dialog opens', window.__dither.inkExtractorOpen() === true && window.DitherInkExtractor.isOpen());
  window.DitherInkExtractor.close();

  window.DS.command('file-plugin-manager');
  await wait(250);
  check('the Plugin Manager lists the catalogue',
    plugins.isOpen() && document.querySelectorAll('#plugin-list .plugin-row').length >= 6,
    document.querySelectorAll('#plugin-list .plugin-row').length);
  plugins.close();

  const failed = checks.filter(function (c) { return !c.ok; });
  return {
    ok: !failed.length,
    checks: checks,
    failures: failed.map(function (c) { return c.name; }),
    notes: {
      suite: 'plugins',
      installed: plugins.installed ? plugins.installed().map(function (pkg) { return pkg.id; }) : null,
      presets: window.__dither.stats().preset || optionNames('preset').length,
    },
  };
}());
