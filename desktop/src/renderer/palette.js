/* palette.js - the command palette.
 *
 * One field that finds its way around the app: the eleven stations, all forty-
 * six algorithms, the palettes, the tone maps, the effects, the recipes and the
 * handful of verbs worth reaching for. It builds its index from the app's own
 * catalogues (DS.catalogues) and runs everything through DS.command, so a new
 * algorithm or panel appears here the moment it exists, with nothing to keep in
 * step by hand.
 *
 * Why it is its own file: app.js owns what a command *does*, shell.js owns the
 * window chrome. This is chrome that speaks the app's vocabulary, and it needs
 * no state of its own beyond the list it is showing.
 *
 * Keyboard is the point, so nothing here animates on the way in: the palette is
 * opened hundreds of times a session and a 200 ms entrance is 200 ms of delay.
 * The one motion is a 120 ms fade, which is a paint, not a layout.
 *
 * Exposes: window.DitherPalette - { open, close, toggle, isOpen, results }.
 */
(function () {
  'use strict';

  const DS = window.DS;
  if (!DS || !DS.catalogues) return;

  const $ = function (id) { return document.getElementById(id); };
  const isMac = DS.platform === 'darwin';
  const KEY = isMac ? '⌘K' : 'Ctrl K';

  let overlay = null;
  let field = null;
  let list = null;
  let items = null;
  let shown = [];
  let active = 0;
  let restoreFocus = null;

  const PANEL_NAMES = {
    learn: 'Learn', source: 'Source', press: 'Press', tone: 'Tone', ink: 'Ink',
    detail: 'Detail', effects: 'Effects', glow: 'Glow', motion: 'Motion',
    type: 'Type', preset: 'Presets',
  };

  // Verbs rather than catalogues. `run` is a command name and an argument, so
  // every entry takes the same road the menus do.
  const ACTIONS = [
    { label: 'Open an image…', command: 'file-open', keywords: 'load picture file' },
    { label: 'Import a color palette…', command: 'file-import-palette', keywords: 'palette inks json hex custom' },
    { label: 'Extract a palette from an image…', command: 'file-extract-palette', keywords: 'colorcat ink extractor plugin image' },
    { label: 'Open the plugin manager…', command: 'file-plugin-manager', keywords: 'plugins github install preset packs tools' },
    { label: 'Animate the still…', command: 'motion-start', keywords: 'animation timeline video motion' },
    { label: 'Play or pause the animation', command: 'motion-toggle', keywords: 'animation timeline play' },
    { label: 'Export the animation as WebM', command: 'motion-export', keywords: 'animation video export webm record' },
    { label: 'Export the proof as a PNG', command: 'file-save-png', keywords: 'save file download' },
    { label: 'Copy the proof to the clipboard', command: 'file-copy-png', keywords: 'paste clipboard' },
    { label: 'Export the text proof', command: 'file-export-txt', keywords: 'characters txt' },
    { label: 'Undo a recipe change', command: 'edit-undo', keywords: 'back history revert' },
    { label: 'Redo a recipe change', command: 'edit-redo', keywords: 'forward history' },
    { label: 'Roll a fresh recipe', command: 'edit-random', keywords: 'random surprise' },
    { label: 'New seed', command: 'edit-reseed', keywords: 'random seed' },
    { label: 'Reset every control', command: 'edit-reset', keywords: 'defaults clear' },
    { label: 'Compare with the source', command: 'view-compare', arg: true, keywords: 'original before' },
    { label: 'Split compare the source and the proof', command: 'view-split', keywords: 'before after compare divider' },
    { label: 'Fit in window', command: 'view-zoom-fit', keywords: 'zoom' },
    { label: 'Toggle character mode', command: 'image-textmode', keywords: 'text ascii type' },
    { label: 'Clear the effects stack', command: 'effects-clear', keywords: 'glitch reset' },
    { label: 'Open a clip…', command: 'file-open-clip', keywords: 'video movie' },
    { label: 'Open every panel', command: 'window-panels-open', keywords: 'expand stations' },
    { label: 'Collapse every panel', command: 'window-panels-collapse', keywords: 'fold stations' },
    { label: 'Take the tour', shell: 'help-tour', keywords: 'learn tutorial help' },
    { label: 'Keyboard shortcuts', shell: 'help-shortcuts', keywords: 'keys help' },
    { label: 'What’s new', shell: 'help-whats-new', keywords: 'release notes changelog updates help' },
    { label: 'About Dither Studio', shell: 'help-about', keywords: 'version build credits help' },
  ];

  function buildItems() {
    const C = DS.catalogues;
    const out = [];

    DS.groups.forEach(function (id) {
      const name = PANEL_NAMES[id] || id;
      out.push({
        group: 'Panel',
        label: 'Open ' + name,
        keywords: 'panel station ' + name,
        run: function () { DS.command('window-panel-open', id); },
      });
    });

    C.ALGORITHMS.forEach(function (entry) {
      out.push({
        group: 'Press',
        label: entry.name,
        meta: entry.group,
        keywords: entry.id + ' algorithm press pattern',
        run: function () { DS.command('press-algorithm', entry.id); },
      });
    });

    C.PALETTES.forEach(function (entry) {
      out.push({
        group: 'Palette',
        label: entry.name,
        meta: entry.colors.length + ' inks',
        keywords: entry.id + ' palette ink colour color',
        run: function () { DS.command('press-palette', entry.id); },
      });
    });

    C.PRESETS.forEach(function (entry) {
      out.push({
        group: 'Recipe',
        label: entry.name,
        keywords: entry.id + ' preset recipe',
        run: function () { DS.command('press-preset', entry.id); },
      });
    });

    C.TONE_MAPS.forEach(function (entry) {
      out.push({
        group: 'Tone',
        label: entry.name,
        keywords: entry.id + ' tone map ink paper',
        run: function () { DS.command('image-tonemap', entry.id); },
      });
    });

    C.GLITCHES.forEach(function (entry) {
      out.push({
        group: 'Effect',
        label: 'Add ' + entry.name,
        keywords: entry.id + ' effect glitch ' + (entry.hint || ''),
        run: function () { DS.command('effects-add', entry.id); },
      });
    });

    C.TEXT_RAMPS.forEach(function (entry) {
      out.push({
        group: 'Type',
        label: entry.name,
        keywords: entry.id + ' ramp character',
        run: function () { DS.command('image-ramp', entry.id); },
      });
    });

    ACTIONS.forEach(function (action) {
      out.push({
        group: 'Action',
        label: action.label,
        keywords: action.keywords || '',
        run: function () {
          if (action.shell) {
            if (window.__shell && window.__shell.run) window.__shell.run(action.shell);
            return;
          }
          DS.command(action.command, action.arg);
        },
      });
    });

    return out;
  }

  // Every word in the query has to appear somewhere, and the score prefers a
  // label that starts with it. Ties keep catalogue order, which is the order
  // the panels themselves use. A miss is `null`, not a negative number: the
  // bonus below is subtracted from a score that starts at zero, so a label
  // beginning with the query ("Bayer 8×8" for "bayer") scores below zero and
  // a `>= 0` test would throw away exactly the best matches.
  function score(item, tokens) {
    const label = item.label.toLowerCase();
    const hay = label + ' ' + item.group.toLowerCase() + ' ' +
      String(item.meta || '').toLowerCase() + ' ' + String(item.keywords || '').toLowerCase();
    let total = 0;
    for (let i = 0; i < tokens.length; i++) {
      const at = hay.indexOf(tokens[i]);
      if (at < 0) return null;
      total += at;
      const inLabel = label.indexOf(tokens[i]);
      if (inLabel === 0) total -= 8;
      else if (inLabel > 0) total -= 3;
    }
    return total;
  }

  function highlighted(label, token) {
    const fragment = document.createDocumentFragment();
    const at = token ? label.toLowerCase().indexOf(token) : -1;
    if (at < 0) { fragment.appendChild(document.createTextNode(label)); return fragment; }
    if (at > 0) fragment.appendChild(document.createTextNode(label.slice(0, at)));
    const mark = document.createElement('mark');
    mark.textContent = label.slice(at, at + token.length);
    fragment.appendChild(mark);
    fragment.appendChild(document.createTextNode(label.slice(at + token.length)));
    return fragment;
  }

  function setActive(index) {
    if (!shown.length) return;
    active = (index + shown.length) % shown.length;
    const rows = list.children;
    for (let i = 0; i < rows.length; i++) {
      const on = i === active;
      if (rows[i].classList) rows[i].classList.toggle('is-on', on);
      if (rows[i].setAttribute) rows[i].setAttribute('aria-selected', on ? 'true' : 'false');
    }
    const row = rows[active];
    if (row) {
      field.setAttribute('aria-activedescendant', row.id);
      row.scrollIntoView({ block: 'nearest' });
    }
  }

  function render() {
    if (!items) items = buildItems();
    const query = field.value.trim().toLowerCase();
    const tokens = query ? query.split(/\s+/).filter(Boolean) : [];

    if (tokens.length) {
      shown = items
        .map(function (item, at) { return { item: item, at: at, score: score(item, tokens) }; })
        .filter(function (row) { return row.score !== null; })
        .sort(function (a, b) { return a.score - b.score || a.at - b.at; })
        .slice(0, 60)
        .map(function (row) { return row.item; });
    } else {
      shown = items.slice(0, 40);
    }

    list.textContent = '';
    if (!shown.length) {
      const empty = document.createElement('p');
      empty.className = 'cmdk-empty';
      empty.textContent = 'Nothing answers to “' + field.value.trim() + '”. Try a family name like “diffusion”, or a palette like “gameboy”.';
      list.appendChild(empty);
      field.removeAttribute('aria-activedescendant');
      return;
    }

    shown.forEach(function (item, index) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'cmdk-row';
      row.id = 'cmdk-opt-' + index;
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', 'false');
      row.setAttribute('tabindex', '-1');

      const name = document.createElement('span');
      name.className = 'cmdk-name';
      if (tokens.length) name.appendChild(highlighted(item.label, tokens[0]));
      else name.textContent = item.label;
      row.appendChild(name);

      const tag = document.createElement('span');
      tag.className = 'cmdk-tag';
      tag.textContent = item.meta ? item.group + ' · ' + item.meta : item.group;
      row.appendChild(tag);

      row.addEventListener('mouseenter', function () { setActive(index); });
      row.addEventListener('click', function (event) { event.preventDefault(); choose(index); });
      list.appendChild(row);
    });

    setActive(0);
  }

  function choose(index) {
    const item = shown[index];
    if (!item) return;
    close();
    item.run();
  }

  function build() {
    overlay = $('cmdk');
    field = $('cmdk-input');
    list = $('cmdk-list');
    if (!overlay || !field || !list) return false;

    field.setAttribute('role', 'combobox');
    field.setAttribute('aria-expanded', 'true');
    field.setAttribute('aria-autocomplete', 'list');
    field.setAttribute('aria-controls', 'cmdk-list');

    field.addEventListener('input', render);

    overlay.addEventListener('keydown', function (event) {
      const key = event.key;
      if (key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      }
      if (key === 'ArrowDown' || (key === 'Tab' && !event.shiftKey)) {
        event.preventDefault();
        setActive(active + 1);
        return;
      }
      if (key === 'ArrowUp' || (key === 'Tab' && event.shiftKey)) {
        event.preventDefault();
        setActive(active - 1);
        return;
      }
      if (key === 'Home') { event.preventDefault(); setActive(0); return; }
      if (key === 'End') { event.preventDefault(); setActive(shown.length - 1); return; }
      if (key === 'Enter') {
        event.preventDefault();
        choose(active);
      }
    });

    // The backdrop is a click target, the card is not.
    overlay.addEventListener('pointerdown', function (event) {
      if (event.target === overlay) close();
    });

    const find = $('dock-find');
    if (find) {
      find.addEventListener('click', function () { open(); });
      find.title = 'Find a panel, algorithm, palette or recipe (' + KEY + ')';
    }

    // The two places the shortcut is written down follow the platform.
    const hint = $('hint-key');
    if (hint) hint.textContent = KEY;
    const footKey = $('cmdk-key');
    if (footKey) footKey.textContent = KEY;

    return true;
  }

  function open() {
    if (!overlay && !build()) return;
    if (!overlay) return;
    // Ctrl+K is global. If the Help window is up, it gives the keyboard back
    // rather than letting the two overlays fight over it.
    if (window.DitherHelp && window.DitherHelp.isOpen && window.DitherHelp.isOpen()) {
      window.DitherHelp.close();
    }
    if (window.DitherPaletteImport && window.DitherPaletteImport.isOpen && window.DitherPaletteImport.isOpen()) {
      window.DitherPaletteImport.close();
    }
    if (window.DitherFeatureMenu && window.DitherFeatureMenu.isOpen && window.DitherFeatureMenu.isOpen()) {
      window.DitherFeatureMenu.close();
    }
    overlay.hidden = false;
    restoreFocus = document.activeElement;
    field.value = '';
    render();
    field.focus();
    window.requestAnimationFrame(function () { overlay.classList.add('is-in'); });
  }

  function close() {
    if (!overlay || overlay.hidden) return;
    overlay.classList.remove('is-in');
    overlay.hidden = true;
    if (restoreFocus && restoreFocus.focus) {
      try { restoreFocus.focus(); } catch (err) { /* the control may be gone */ }
    }
    restoreFocus = null;
  }

  function isOpen() { return !!overlay && !overlay.hidden; }

  function toggle() { if (isOpen()) close(); else open(); }

  // Bind at load, not on first open: the dock's find button gets its click
  // listener in build(), so waiting for an open leaves the button unable to
  // cause the first one.
  build();

  // An imported palette changes the catalogue under a palette that was already
  // built. Clearing the index makes the next open include it; the event is the
  // signal, so app.js does not have to know this module exists.
  window.addEventListener('ds:catalogues', function () { items = null; });

  window.DitherPalette = {
    open: open,
    close: close,
    refresh: function () { items = null; },
    toggle: toggle,
    isOpen: isOpen,
    // What the field is showing, for the smoke run: labels only, no internals.
    results: function () { return shown.map(function (item) { return item.label; }); },
    search: function (query) {
      if (!isOpen()) open();
      field.value = String(query || '');
      render();
      return window.DitherPalette.results();
    },
    // What the index and the field really hold, for the smoke run: enough to
    // tell "the query matched nothing" apart from "the index is missing a
    // catalogue" without opening a debugger.
    diagnose: function (query) {
      if (!items) items = buildItems();
      const before = field.value;
      field.value = String(query || '');
      const tokens = field.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const pool = items.filter(function (item) {
        return /bayer/i.test(item.label);
      });
      field.value = before;
      return {
        indexed: items.length,
        labelsWithBayer: pool.length,
        query: field.value,
        tokens: tokens,
        shown: shown.length,
        first: shown.slice(0, 5).map(function (item) { return item.label; }),
        groups: Array.from(new Set(items.map(function (item) { return item.group; }))),
      };
    },
  };
}());
