/* color-scheme.js - the Color Scheme Maker dialog (Color Scheme Maker plugin).
 *
 * A Coolors/Lospec-shaped palette drafting table: a base ink, a harmony rule,
 * lockable swatches, tone/hue sorting and a name generated from the colours.
 * It saves through the app's normal palette importer, so there is one palette
 * store and one place that rebuilds the picker.
 *
 * Exposes: window.DitherColorScheme - { open, close, isOpen, state, generate,
 * importValue, seedFromImage, pack, exportPack, sort, add, save }.
 */
(function (global) {
  'use strict';

  const Core = global.DitherCore;
  if (!Core) return;
  const $ = function (id) { return document.getElementById(id); };
  const MAX_INKS = 32;

  const HARMONY_LABELS = {
    free: 'Free — seeded random',
    analogous: 'Analogous — neighbours',
    complement: 'Complementary — opposite',
    split: 'Split complementary',
    triad: 'Triadic — three-way',
    tetrad: 'Tetradic — four-way',
    mono: 'Monochrome — one hue',
  };

  let overlay = null;
  let nameInput = null;
  let harmonySelect = null;
  let list = null;
  let countLine = null;
  let statusLine = null;
  let errorLine = null;
  let addBtn = null;
  let saveBtn = null;
  let importInput = null;
  let safety = null;
  let meterFill = null;
  let safetyText = null;
  let restoreFocus = null;
  let opts = {};
  let slots = [];
  let seed = 1;
  let editId = null;

  function hex(rgb) {
    return Core.rgbToHex(rgb);
  }

  function sameColour(a, b) {
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
  }

  function setError(text) {
    if (!errorLine) return;
    errorLine.textContent = text || '';
    errorLine.hidden = !text;
  }

  function setStatus(text) {
    if (statusLine) statusLine.textContent = text || '';
  }

  function setSlots(colors) {
    slots = (Array.isArray(colors) ? colors : []).slice(0, MAX_INKS).map(function (rgb) {
      return { rgb: [Core.clampByte(rgb[0]), Core.clampByte(rgb[1]), Core.clampByte(rgb[2])], locked: false };
    });
  }

  function colors() {
    return slots.map(function (slot) { return slot.rgb.slice(); });
  }

  function renderList() {
    if (!list) return;
    list.textContent = '';
    slots.forEach(function (slot, index) {
      const row = document.createElement('div');
      row.className = 'scheme-row' + (slot.locked ? ' is-locked' : '');
      row.setAttribute('role', 'listitem');
      row.dataset.index = String(index);

      const color = document.createElement('input');
      color.type = 'color';
      color.className = 'scheme-color';
      color.value = hex(slot.rgb);
      color.setAttribute('aria-label', 'Ink ' + (index + 1));

      const text = document.createElement('input');
      text.type = 'text';
      text.className = 'scheme-hex';
      text.maxLength = 7;
      text.spellcheck = false;
      text.autocomplete = 'off';
      text.value = hex(slot.rgb);
      text.setAttribute('aria-label', 'Ink ' + (index + 1) + ' hex value');

      const lock = document.createElement('button');
      lock.type = 'button';
      lock.className = 'btn scheme-lock' + (slot.locked ? ' is-on' : '');
      lock.textContent = slot.locked ? 'Locked' : 'Lock';
      lock.title = slot.locked ? 'Keep this ink when generating' : 'Lock this ink';
      lock.setAttribute('aria-pressed', slot.locked ? 'true' : 'false');

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn scheme-remove';
      remove.textContent = '×';
      remove.title = 'Remove this ink';
      remove.setAttribute('aria-label', 'Remove ink ' + (index + 1));
      remove.disabled = slots.length <= 2;

      color.addEventListener('input', function () {
        slot.rgb = Core.hexToRgb(color.value);
        text.value = color.value;
        setError('');
        syncSafety();
      });
      text.addEventListener('change', function () {
        const rgb = Core.parseHexColour(text.value);
        if (!rgb) {
          setError('“' + text.value + '” is not a six-digit hex colour');
          text.value = hex(slot.rgb);
          return;
        }
        slot.rgb = rgb;
        color.value = hex(slot.rgb);
        text.value = hex(slot.rgb);
        setError('');
        syncSafety();
      });
      lock.addEventListener('click', function () {
        slot.locked = !slot.locked;
        lock.classList.toggle('is-on', slot.locked);
        lock.textContent = slot.locked ? 'Locked' : 'Lock';
        lock.setAttribute('aria-pressed', slot.locked ? 'true' : 'false');
        row.classList.toggle('is-locked', slot.locked);
        syncCount();
      });
      remove.addEventListener('click', function () {
        if (slots.length <= 2) return;
        slots.splice(index, 1);
        renderList();
        setStatus('Ink removed · ' + slots.length + ' inks');
      });

      row.appendChild(color);
      row.appendChild(text);
      row.appendChild(lock);
      row.appendChild(remove);
      list.appendChild(row);
    });
    syncCount();
  }

  function syncSafety() {
    if (!safety || !meterFill || !safetyText) return;
    const report = Core.schemeSafety(colors());
    safety.dataset.level = report.level;
    meterFill.style.width = Math.max(4, Math.min(100, (report.minStep / 32) * 100)) + '%';
    const label = report.level === 'safe' ? 'Safe' : report.level === 'tight' ? 'Tight' : 'Muddy';
    const order = report.ordered ? 'dark to light' : 'out of order';
    const duplicates = report.duplicates ? ' · ' + report.duplicates + ' duplicate' + (report.duplicates === 1 ? '' : 's') : '';
    safetyText.textContent = label + ': smallest step ' + report.minStep + ' · contrast '
      + report.maxContrast.toFixed(1) + ':1 · ' + order + duplicates;
    return report;
  }

  function syncCount() {
    if (countLine) countLine.textContent = slots.length + ' inks · ' + slots.filter(function (slot) { return slot.locked; }).length + ' locked';
    if (addBtn) addBtn.disabled = slots.length >= MAX_INKS;
    if (saveBtn) saveBtn.disabled = slots.length < 2;
    syncSafety();
  }

  function suggestName() {
    if (!nameInput) return '';
    nameInput.value = Core.schemeName(colors());
    return nameInput.value;
  }

  function generate(base) {
    if (!slots.length) setSlots(Core.schemeColours([255, 107, 53], 6, 'analogous', seed));
    const locked = slots.filter(function (slot) { return slot.locked; });
    if (locked.length === slots.length) {
      setStatus('Every ink is locked · unlock one to generate');
      return colors();
    }
    const anchor = base || (locked.length ? locked[0].rgb : slots[0].rgb);
    seed = (seed + 0x9e3779b9) >>> 0;
    const fresh = Core.schemeColours(anchor, slots.length, harmonySelect ? harmonySelect.value : 'analogous', seed);
    slots.forEach(function (slot, index) {
      if (!slot.locked) slot.rgb = fresh[index];
    });
    renderList();
    setError('');
    setStatus('Generated ' + (slots.length - locked.length) + ' unlocked inks · ' + HARMONY_LABELS[harmonySelect.value].split(' — ')[0]);
    return colors();
  }

  function roll() {
    seed = (seed + 0x9e3779b9) >>> 0;
    const base = Core.hslToRgb((seed / 4294967296) * 360, 0.64, 0.52);
    const fresh = Core.schemeColours(base, slots.length || 6, 'free', seed);
    slots = fresh.map(function (rgb) { return { rgb: rgb, locked: false }; });
    renderList();
    setError('');
    setStatus('Rolled a fresh base · all inks unlocked');
    return colors();
  }

  function useCurrent() {
    if (typeof opts.getCurrent !== 'function') {
      setError('This build does not expose the current palette');
      return false;
    }
    const current = opts.getCurrent();
    const listOfColors = current && Array.isArray(current.colors) ? current.colors : current;
    if (!Array.isArray(listOfColors) || listOfColors.length < 2) {
      setError('The current palette has no inks to copy');
      return false;
    }
    setSlots(listOfColors);
    if (current && current.name && nameInput) nameInput.value = current.name;
    renderList();
    setError('');
    setStatus('Loaded ' + slots.length + ' inks from ' + (current && current.name ? current.name : 'the current palette'));
    return true;
  }

  function applyImported(parsed, source) {
    if (!parsed || !Array.isArray(parsed.colors) || parsed.colors.length < 2) {
      setError('That palette does not have at least two inks');
      return false;
    }
    if (parsed.colors.length > MAX_INKS) {
      setStatus('Loaded the first ' + MAX_INKS + ' of ' + parsed.colors.length + ' inks');
    } else {
      setStatus('Imported ' + parsed.colors.length + ' inks from ' + source);
    }
    setSlots(parsed.colors);
    if (nameInput) nameInput.value = parsed.name || Core.schemeName(colors());
    renderList();
    setError('');
    return true;
  }

  function parseImportedText(text, source) {
    try {
      return applyImported(Core.parsePaletteText(text, source), source);
    } catch (err) {
      setError(err && err.message ? err.message : 'That palette could not be read');
      return false;
    }
  }

  function importValue() {
    if (!importInput) return false;
    const value = importInput.value.trim();
    if (!value) {
      setError('Paste a Lospec link, a palette JSON or a list of hex colours');
      return false;
    }
    setError('');
    const lospecUrl = Core.lospecPaletteUrl(value);
    if (lospecUrl) {
      if (!global.ditherDesktop || !global.ditherDesktop.fetchLospec) {
        setError('Lospec import needs the desktop build');
        return false;
      }
      setStatus('Fetching ' + lospecUrl + '…');
      global.ditherDesktop.fetchLospec(value).then(function (out) {
        if (!out || out.error) {
          setError((out && out.error) || 'Lospec could not be reached');
          setStatus('');
          return;
        }
        parseImportedText(out.text, 'Lospec');
      }).catch(function (err) {
        setError(err && err.message ? err.message : 'Lospec could not be reached');
      });
      return true;
    }
    return parseImportedText(value, 'the pasted palette');
  }

  function seedFromImage() {
    if (typeof opts.getImageColors !== 'function') {
      setError('This build cannot read the open image');
      return false;
    }
    const result = opts.getImageColors(slots.length, 'cins');
    if (result && result.error) {
      setError(result.error);
      return false;
    }
    if (!Array.isArray(result) || result.length < 2) {
      setError('The open image did not yield a palette');
      return false;
    }
    setSlots(result);
    if (nameInput) nameInput.value = Core.schemeName(colors());
    renderList();
    setError('');
    setStatus('Seeded ' + slots.length + ' inks from the open image');
    return true;
  }

  function packageId() {
    const stem = String(nameInput && nameInput.value)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30).replace(/-+$/, '') || 'palette';
    return 'scheme-' + stem;
  }

  function pack() {
    const name = Core.cleanPaletteName(nameInput && nameInput.value, 'Untitled scheme');
    const packName = / pack$/i.test(name) ? name : name + ' pack';
    return {
      schema: 1,
      id: packageId(),
      name: packName.slice(0, 60),
      version: '1.0.0',
      kind: 'palette-pack',
      summary: 'A color-scheme pack exported from Dither Studio: ' + name + '.',
      author: 'Dither Studio',
      data: {
        palettes: [{ id: 'main', name: name, colors: colors().map(hex) }],
      },
    };
  }

  function exportPack() {
    const pkg = pack();
    if (typeof opts.onExport !== 'function') {
      setError('This build cannot export a plugin pack');
      return pkg;
    }
    const result = opts.onExport(pkg);
    if (result && typeof result.then === 'function') {
      result.then(function (saved) {
        if (saved && saved.path) setStatus('Pack exported · ' + saved.name);
        else if (saved && saved.error) setError(saved.error);
        else if (saved && saved.downloaded) setStatus('Pack downloaded · ' + saved.name);
        else if (saved === null) setStatus('Export cancelled');
        else setStatus('Pack ready to share · ' + pkg.id);
      }).catch(function (err) {
        setError(err && err.message ? err.message : 'The pack could not be exported');
      });
    } else if (result && result.downloaded) {
      setStatus('Pack downloaded · ' + result.name);
    } else if (result === null) {
      setStatus('Export cancelled');
    } else {
      setStatus('Pack ready to share · ' + pkg.id);
    }
    return pkg;
  }

  function sort(mode) {
    const ordered = Core.sortSchemeColours(colors(), mode);
    const remaining = slots.slice();
    slots = ordered.map(function (rgb) {
      const at = remaining.findIndex(function (slot) { return sameColour(slot.rgb, rgb); });
      return at >= 0 ? remaining.splice(at, 1)[0] : { rgb: rgb, locked: false };
    });
    renderList();
    setStatus(mode === 'hue' ? 'Sorted around the colour wheel' : 'Sorted dark to light');
    return colors();
  }

  function add() {
    if (slots.length >= MAX_INKS) {
      setStatus('A scheme holds at most ' + MAX_INKS + ' inks');
      return false;
    }
    const anchor = slots.length ? slots[0].rgb : [255, 107, 53];
    seed = (seed + 0x9e3779b9) >>> 0;
    const fresh = Core.schemeColours(anchor, slots.length + 1, harmonySelect ? harmonySelect.value : 'analogous', seed);
    slots.push({ rgb: fresh[fresh.length - 1], locked: false });
    renderList();
    setStatus('Ink added · ' + slots.length + ' inks');
    return true;
  }

  function copyHex() {
    const text = colors().map(hex).join(' ');
    if (!global.navigator || !global.navigator.clipboard || !global.navigator.clipboard.writeText) {
      setError('This window cannot reach the clipboard');
      return false;
    }
    global.navigator.clipboard.writeText(text).then(function () {
      setStatus('Copied ' + slots.length + ' hex values');
    }).catch(function () {
      setError('The clipboard refused the copy');
    });
    return true;
  }

  function save() {
    setError('');
    if (slots.length < 2) {
      setError('A palette needs at least two inks');
      return false;
    }
    if (typeof opts.onSave !== 'function') {
      setError('This build has no palette store');
      return false;
    }
    const name = Core.cleanPaletteName(nameInput && nameInput.value, Core.schemeName(colors()));
    const result = opts.onSave({ id: editId || undefined, name: name, colors: colors() });
    if (result && result.ok === false) {
      setError(result.error || 'That palette could not be saved');
      return false;
    }
    close();
    return true;
  }

  function build() {
    overlay = $('color-scheme');
    nameInput = $('scheme-name');
    harmonySelect = $('scheme-harmony');
    list = $('scheme-list');
    countLine = $('scheme-count');
    statusLine = $('scheme-status');
    errorLine = $('scheme-error');
    addBtn = $('scheme-add');
    saveBtn = $('scheme-save');
    importInput = $('scheme-import');
    safety = $('scheme-safety');
    meterFill = $('scheme-meter-fill');
    safetyText = $('scheme-safety-text');
    if (!overlay || !nameInput || !harmonySelect || !list || !saveBtn) return false;

    Core.SCHEME_HARMONIES.forEach(function (id) {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = HARMONY_LABELS[id] || id;
      harmonySelect.appendChild(option);
    });
    $('scheme-generate').addEventListener('click', function () { generate(); });
    $('scheme-roll').addEventListener('click', roll);
    $('scheme-load').addEventListener('click', useCurrent);
    $('scheme-name-idea').addEventListener('click', suggestName);
    $('scheme-sort-tone').addEventListener('click', function () { sort('tone'); });
    $('scheme-sort-hue').addEventListener('click', function () { sort('hue'); });
    $('scheme-copy').addEventListener('click', copyHex);
    addBtn.addEventListener('click', add);
    $('scheme-cancel').addEventListener('click', close);
    saveBtn.addEventListener('click', save);
    $('scheme-import-load').addEventListener('click', importValue);
    $('scheme-image').addEventListener('click', seedFromImage);
    $('scheme-pack').addEventListener('click', exportPack);
    if (importInput) {
      importInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') { event.preventDefault(); importValue(); }
      });
    }
    harmonySelect.addEventListener('change', function () {
      setStatus('Harmony set to ' + HARMONY_LABELS[harmonySelect.value].split(' — ')[0] + ' · press Generate');
    });
    overlay.addEventListener('pointerdown', function (event) { if (event.target === overlay) close(); });
    overlay.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      // Coolors' best habit: spacebar is Generate, as long as a field is not
      // taking the key. A button keeps its own activation behaviour.
      const tag = event.target && event.target.tagName;
      if (event.code === 'Space' && tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA' && tag !== 'BUTTON') {
        event.preventDefault();
        generate();
      }
    });
    return true;
  }

  function open(options) {
    if (!overlay && !build()) return false;
    opts = options || {};
    editId = opts.editId || null;
    seed = (Date.now() ^ 0x9e3779b9) >>> 0;
    const defaultHarmony = Core.SCHEME_HARMONIES.indexOf(opts.harmony) >= 0 ? opts.harmony : 'analogous';
    harmonySelect.value = defaultHarmony;
    const startColors = Array.isArray(opts.colors) && opts.colors.length >= 2
      ? opts.colors
      : Core.schemeColours([255, 107, 53], Math.max(2, Math.min(MAX_INKS, opts.count || 6)), defaultHarmony, seed);
    setSlots(startColors);
    nameInput.value = opts.name || Core.schemeName(colors());
    if (importInput) importInput.value = '';
    if (saveBtn) saveBtn.textContent = editId ? 'Save changes' : 'Save to palettes';
    renderList();
    setError('');
    setStatus(editId ? 'Editing a saved scheme · Save changes keeps its place in the palette menu' : 'Start from these inks, or press Generate');
    if (global.DitherPlugins && global.DitherPlugins.isOpen && global.DitherPlugins.isOpen()) global.DitherPlugins.close();
    if (global.DitherPalette && global.DitherPalette.isOpen && global.DitherPalette.isOpen()) global.DitherPalette.close();
    if (global.DitherPaletteImport && global.DitherPaletteImport.isOpen && global.DitherPaletteImport.isOpen()) global.DitherPaletteImport.close();
    if (global.DitherInkExtractor && global.DitherInkExtractor.isOpen && global.DitherInkExtractor.isOpen()) global.DitherInkExtractor.close();
    if (global.DitherPaletteManager && global.DitherPaletteManager.isOpen && global.DitherPaletteManager.isOpen()) global.DitherPaletteManager.close();
    overlay.hidden = false;
    restoreFocus = document.activeElement;
    global.requestAnimationFrame(function () {
      overlay.classList.add('is-in');
      const generateBtn = $('scheme-generate');
      if (generateBtn) generateBtn.focus();
    });
    return true;
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove('is-in');
    overlay.hidden = true;
    editId = null;
    if (restoreFocus && restoreFocus.focus) {
      try { restoreFocus.focus(); } catch (err) { /* the control may be gone */ }
    }
    restoreFocus = null;
  }

  function isOpen() { return !!overlay && !overlay.hidden; }

  function state() {
    return {
      open: isOpen(),
      editId: editId,
      name: nameInput ? nameInput.value : '',
      harmony: harmonySelect ? harmonySelect.value : '',
      colors: colors(),
      locked: slots.map(function (slot) { return slot.locked; }),
      safety: syncSafety(),
    };
  }

  global.DitherColorScheme = {
    open: open,
    close: close,
    isOpen: isOpen,
    state: state,
    generate: generate,
    roll: roll,
    sort: sort,
    importValue: importValue,
    seedFromImage: seedFromImage,
    pack: pack,
    exportPack: exportPack,
    add: add,
    save: save,
  };
}(typeof window !== 'undefined' ? window : globalThis));
