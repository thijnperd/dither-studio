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
  check('the bundled catalogue is readable', !!catalogue && catalogue.plugins.length >= 7,
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

  const schemePack = plugins ? await plugins.install('color-scheme-maker', true) : null;
  check('Color Scheme Maker installs as a tool capability', !!schemePack && schemePack.capability === 'color-scheme-maker');
  const openedScheme = window.__dither.colorSchemeOpen();
  await wait(120);
  const schemeState = window.__dither.colorSchemeState();
  check('the scheme dialog opens with its generated inks',
    openedScheme === true && window.DitherColorScheme.isOpen() && schemeState.colors.length === 6,
    schemeState ? schemeState.colors.length : null);
  check('the scheme carries a generated name', !!schemeState.name && schemeState.name.indexOf(' ') > 0, schemeState.name);
  const firstInk = schemeState.colors[0];
  document.querySelector('#scheme-list .scheme-row .scheme-lock').click();
  const afterGenerate = window.__dither.colorSchemeGenerate();
  check('Generate keeps a locked ink and redraws the rest',
    JSON.stringify(afterGenerate[0]) === JSON.stringify(firstInk) &&
      JSON.stringify(afterGenerate[1]) !== JSON.stringify(schemeState.colors[1]),
    firstInk.join(','));
  window.DitherColorScheme.add();
  check('Add ink grows the scheme', window.__dither.colorSchemeState().colors.length === 7);
  document.getElementById('scheme-name').value = 'Smoke Scheme';
  const savedScheme = window.__dither.colorSchemeSave();
  await wait(120);
  check('Save adds the scheme to the palette menu',
    savedScheme === true && window.__dither.customPalettes().some(function (p) { return p.name === 'Smoke Scheme'; }));

  document.getElementById('scheme-import').value = '#000000 #050505 #ffffff';
  const importedScheme = window.__dither.colorSchemeImport();
  const importedState = window.__dither.colorSchemeState();
  check('pasted colours import into the scheme', importedScheme === true && importedState.colors.length === 3,
    importedState ? importedState.colors.length : null);
  check('the safety meter calls the tight pairs muddy',
    importedState.safety && importedState.safety.level === 'muddy', importedState.safety && importedState.safety.level);
  document.getElementById('scheme-import').value = '#000000 #808080 #ffffff';
  window.__dither.colorSchemeImport();
  check('the safety meter reads a spaced ramp as safe',
    window.__dither.colorSchemeState().safety.level === 'safe');

  const seededScheme = window.__dither.colorSchemeSeed();
  check('the open image seeds a scheme through Ink Extractor',
    seededScheme === true && window.__dither.colorSchemeState().colors.length >= 2,
    seededScheme ? window.__dither.colorSchemeState().colors.length : null);

  document.getElementById('scheme-name').value = 'Smoke Scheme Pack';
  const exportedPack = window.__dither.colorSchemePack();
  check('the scheme exports a valid palette plugin pack',
    !!exportedPack && exportedPack.kind === 'palette-pack' &&
      window.DitherCore.validatePluginPackage(exportedPack).data.palettes[0].colors.length >= 2,
    exportedPack ? exportedPack.id : null);
  const installedPack = plugins.installFromPackage(exportedPack);
  const packPaletteId = 'plugin-' + exportedPack.id + '-main';
  check('the exported pack installs and adds its inks to the picker',
    installedPack.id === exportedPack.id &&
      window.DS.catalogues.PALETTES.some(function (palette) { return palette.id === packPaletteId; }));
  window.DS.command('press-palette', packPaletteId);
  check('the pack palette can be selected', window.__dither.stats().palette === packPaletteId);
  plugins.remove(exportedPack.id);
  check('removing a palette pack removes its inks',
    !window.DS.catalogues.PALETTES.some(function (palette) { return palette.id === packPaletteId; }));
  check('removing the selected pack falls back to a built-in palette',
    window.__dither.stats().palette === 'bw' && document.getElementById('palette').value === 'bw');

  window.DS.command('file-plugin-manager');
  await wait(250);
  const managerRows = document.querySelectorAll('#plugin-list .plugin-row');
  const sections = document.querySelectorAll('#plugin-list .plugin-section');
  const sectionNames = Array.prototype.map.call(sections, function (node) {
    return node.querySelector('.plugin-section-title').textContent;
  });
  check('the Plugin Manager lists the catalogue',
    plugins.isOpen() && managerRows.length >= 7, managerRows.length);
  check('the manager is split into functionality and presets',
    sectionNames.join('|') === 'Functionality|Presets & color schemes', sectionNames.join('|'));
  check('every plugin row states a package size',
    Array.prototype.every.call(managerRows, function (row) {
      return Number(row.dataset.bytes) > 0 && /(?:\d+ B|\d+(?:\.\d+)? KB|\d+(?:\.\d+)? MB)/.test(row.querySelector('.plugin-meta').textContent);
    }), Array.prototype.map.call(managerRows, function (row) { return row.dataset.bytes; }).join(','));
  check('the manager totals the installed disk use',
    /Stored on this machine/.test(document.getElementById('plugin-storage').textContent) &&
      /\d+(?:\.\d+)? KB/.test(document.getElementById('plugin-storage').textContent),
    document.getElementById('plugin-storage').textContent);
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
      scheme: window.__dither.customPalettes().some(function (p) { return p.name === 'Smoke Scheme'; }),
    },
  };
}());
