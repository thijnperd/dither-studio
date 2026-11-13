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
  const presetGroups = Array.prototype.slice.call(document.querySelectorAll('#preset optgroup')).map(function (group) {
    return group.label;
  });
  check('the preset picker groups built-ins before packs',
    presetGroups[0] === 'Built-in recipes' &&
      presetGroups.filter(function (name) { return name === 'Built-in recipes'; }).length === 1 &&
      presetGroups.indexOf('Dreamy Cyberpunk') > 0,
    presetGroups.join('|'));
  const dreamyGroup = document.querySelector('#preset optgroup[label="Dreamy Cyberpunk"]');
  check('a pack keeps only its own recipes in its section',
    !!dreamyGroup && dreamyGroup.querySelectorAll('option').length === 2 &&
      Array.prototype.every.call(dreamyGroup.querySelectorAll('option'), function (option) {
        return option.textContent.indexOf('Dreamy Cyberpunk · ') === 0;
      }),
    dreamyGroup ? dreamyGroup.querySelectorAll('option').length : null);
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

  // The saved-scheme manager is the other half of the maker's store. Use a
  // second scheme so the original Smoke Scheme still covers the save path.
  window.__dither.colorSchemeOpen();
  await wait(100);
  document.getElementById('scheme-name').value = 'Manager Scheme';
  const managerSaved = window.__dither.colorSchemeSave();
  await wait(100);
  const managerEntry = window.__dither.customPalettes().find(function (p) { return p.name === 'Manager Scheme'; });
  const managerPaletteId = managerEntry ? managerEntry.id : null;
  check('a scheme can be saved for the manager to edit',
    managerSaved === true && !!managerPaletteId, managerPaletteId);

  window.DS.command('file-manage-palettes');
  await wait(100);
  let managerState = window.__dither.paletteManagerState();
  let managerRow = managerPaletteId
    ? document.querySelector('#palette-manager-list .palette-manager-row[data-id="' + managerPaletteId + '"]')
    : null;
  check('Manage Color Schemes lists the saved schemes',
    managerState && managerState.open && managerState.count >= 2, managerState && managerState.count);
  check('a manager row shows the scheme inks',
    !!managerRow && managerRow.querySelectorAll('.palette-manager-swatch').length >= 2,
    managerRow ? managerRow.querySelectorAll('.palette-manager-swatch').length : null);

  const managerName = managerRow.querySelector('.palette-manager-name');
  managerName.value = 'Manager Scheme Renamed';
  managerName.dispatchEvent(new Event('input', { bubbles: true }));
  managerRow.querySelector('[data-action="rename"]').click();
  await wait(100);
  const renamedEntry = window.__dither.customPalettes().find(function (p) { return p.id === managerPaletteId; });
  check('Rename changes the scheme in place',
    !!renamedEntry && renamedEntry.name === 'Manager Scheme Renamed', renamedEntry && renamedEntry.name);
  check('Rename reaches the palette picker',
    optionNames('palette').some(function (name) { return name.indexOf('Manager Scheme Renamed') === 0; }));

  managerRow = document.querySelector('#palette-manager-list .palette-manager-row[data-id="' + managerPaletteId + '"]');
  managerRow.querySelector('[data-action="edit"]').click();
  await wait(120);
  const editState = window.__dither.colorSchemeState();
  check('Edit reopens the maker with the same saved scheme',
    editState.open && editState.editId === managerPaletteId && editState.name === 'Manager Scheme Renamed',
    editState && editState.editId);
  const editedInkCount = editState.colors.length;
  window.DitherColorScheme.add();
  document.getElementById('scheme-name').value = 'Manager Scheme Edited';
  const editSaved = window.__dither.colorSchemeSave();
  await wait(100);
  const editedEntry = window.__dither.customPalettes().find(function (p) { return p.id === managerPaletteId; });
  check('Save changes updates the same scheme',
    editSaved === true && !!editedEntry && editedEntry.name === 'Manager Scheme Edited' &&
      editedEntry.colors.length === editedInkCount + 1,
    editedEntry ? editedEntry.name + ' · ' + editedEntry.colors.length : null);

  window.DS.command('press-palette', managerPaletteId);
  check('the edited scheme can be selected', window.__dither.stats().palette === managerPaletteId);
  window.DS.command('file-manage-palettes');
  await wait(100);
  const beforeDelete = window.__dither.paletteManagerState();
  const deleteRow = document.querySelector('#palette-manager-list .palette-manager-row[data-id="' + managerPaletteId + '"]');
  const deleteBtn = deleteRow && deleteRow.querySelector('[data-action="delete"]');
  if (deleteBtn) deleteBtn.click();
  managerState = window.__dither.paletteManagerState();
  check('the first Delete asks for confirmation',
    managerState.confirming === managerPaletteId && deleteBtn.textContent === 'Delete?',
    managerState.confirming);
  if (deleteBtn) deleteBtn.click();
  await wait(100);
  check('the second Delete removes the scheme and falls back',
    !window.__dither.customPalettes().some(function (p) { return p.id === managerPaletteId; }) &&
      window.__dither.stats().palette === 'bw' && document.getElementById('palette').value === 'bw');
  check('the manager refreshes after a delete',
    window.__dither.paletteManagerState().count === beforeDelete.count - 1,
    window.__dither.paletteManagerState().count);
  document.getElementById('palette-manager-close').click();

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
