/* feature-menu.js - the studio menu.
 *
 * A visual shelf over the press: four routes into the parts of the app that
 * have their own surfaces (plugins, effects, presets and saved color schemes).
 * The existing panels remain the place where the work happens; this dialog is
 * a menu, not a second copy of the rail.
 *
 * Icons live in src/assets/menu/ and are applied as CSS masks, so they inherit
 * the menu's ink colour and stay monochrome. The files are deliberately small:
 * a 24×24 viewBox, a 1.6–1.7px stroke and no background plate.
 *
 * Exposes: window.DitherFeatureMenu - { open, close, isOpen, refresh, state }.
 */
(function (global) {
  'use strict';

  const Core = global.DitherCore;
  if (!Core) return;

  const FEATURE_ICONS = {
    plugins: '../assets/menu/feature-plugins.svg',
    effects: '../assets/menu/feature-effects.svg',
    presets: '../assets/menu/feature-presets.svg',
    palettes: '../assets/menu/feature-palettes.svg',
  };
  const PACKAGE_ICONS = {
    'ink-extractor': '../assets/menu/plugin-ink-extractor.svg',
    'shape-press': '../assets/menu/plugin-shape-press.svg',
    'color-scheme-maker': '../assets/menu/plugin-color-scheme-maker.svg',
    'nikos-glitch': '../assets/menu/pack-nikos-glitch.svg',
    'caroline-undead': '../assets/menu/pack-caroline-undead.svg',
    'dreamy-cyberpunk': '../assets/menu/pack-dreamy-cyberpunk.svg',
    's0ur-static': '../assets/menu/pack-s0ur-static.svg',
  };

  let overlay = null;
  let title = null;
  let body = null;
  let backBtn = null;
  let closeBtn = null;
  let footKey = null;
  let footAction = null;
  let opts = {};
  let view = 'menu';
  let restoreFocus = null;

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function glyph(path, className) {
    const mark = node('span', 'fm-glyph' + (className ? ' ' + className : ''));
    mark.style.setProperty('--fm-icon', 'url("' + path + '")');
    mark.setAttribute('aria-hidden', 'true');
    return mark;
  }

  // One chevron serves every row: the plate corner, the wide action, the
  // package, recipe and palette rows. It is the supplied Tabler mark, so it
  // carries the same weight as the rest of the icon set.
  function chevron(className) {
    return glyph('../assets/icons/chevron-right.svg',
      (className || 'fm-chevron') + ' fm-glyph--small');
  }

  function closeOtherWindows() {
    [
      'DitherHelp', 'DitherPalette', 'DitherPaletteImport', 'DitherPlugins',
      'DitherInkExtractor', 'DitherColorScheme', 'DitherPaletteManager',
    ].forEach(function (name) {
      const api = global[name];
      if (api && api.isOpen && api.isOpen() && api.close) api.close();
    });
  }

  function data() {
    return opts && typeof opts.data === 'function' ? opts.data() : {};
  }

  function setHead(nextTitle) {
    title.textContent = nextTitle;
  }

  function setFoot(key, action) {
    footKey.textContent = key;
    footAction.textContent = action;
  }

  function sectionHead(label, count) {
    const row = node('div', 'fm-section-head');
    row.appendChild(node('span', 'fm-section-label', label));
    row.appendChild(node('span', 'fm-section-count', count));
    return row;
  }

  function wideAction(label, iconPath, action) {
    const button = node('button', 'fm-wide');
    button.type = 'button';
    const copy = node('span', 'fm-wide-copy');
    if (iconPath) copy.appendChild(glyph(iconPath, 'fm-glyph--small'));
    copy.appendChild(node('span', '', label));
    button.appendChild(copy);
    button.appendChild(chevron());
    button.addEventListener('click', function () {
      close();
      action();
    });
    return button;
  }

  function emptyState(iconPath, heading, description, actionLabel, action) {
    const box = node('div', 'fm-empty');
    const plate = node('span', 'fm-empty-icon');
    plate.appendChild(glyph(iconPath, 'fm-glyph--empty'));
    box.appendChild(plate);
    box.appendChild(node('strong', '', heading));
    box.appendChild(node('p', '', description));
    if (actionLabel) {
      const button = node('button', 'fm-empty-action', actionLabel);
      button.type = 'button';
      button.addEventListener('click', function () {
        close();
        action();
      });
      box.appendChild(button);
    }
    return box;
  }

  function featureCard(id, label, description, meta, icon) {
    const card = node('button', 'fm-feature fm-feature--' + id);
    card.type = 'button';
    card.dataset.fmView = id;
    card.setAttribute('aria-label', label + ': ' + description);
    const top = node('span', 'fm-feature-top');
    const plate = node('span', 'fm-feature-icon');
    plate.appendChild(glyph(icon, 'fm-glyph--feature'));
    top.appendChild(plate);
    top.appendChild(chevron('fm-feature-arrow'));
    card.appendChild(top);
    card.appendChild(node('strong', 'fm-feature-title', label));
    card.appendChild(node('span', 'fm-feature-desc', description));
    const bottom = node('span', 'fm-feature-meta');
    bottom.appendChild(node('span', '', meta));
    bottom.appendChild(node('span', 'fm-feature-open', 'OPEN'));
    card.appendChild(bottom);
    card.addEventListener('click', function () { go(id); });
    return card;
  }

  function cardGrid(items) {
    const grid = node('div', 'fm-grid');
    items.forEach(function (item) { grid.appendChild(item); });
    return grid;
  }

  function renderMenu(snapshot) {
    const stats = snapshot.stats || {};
    setHead('Studio menu');
    body.appendChild(cardGrid([
      featureCard('plugins', 'Plugins',
        'Installed tools and recipe packs.',
        String(stats.plugins || 0) + ' installed', FEATURE_ICONS.plugins),
      featureCard('effects', 'Effects',
        'The stack that runs after the dither, in pipeline order.',
        String(stats.effects || 0) + ' in the stack', FEATURE_ICONS.effects),
      featureCard('presets', 'Presets',
        'Whole recipes, grouped by the hand that packed them.',
        String(stats.presets || 0) + ' recipes', FEATURE_ICONS.presets),
      featureCard('palettes', 'Color Schemes',
        'The inks you saved, ready to put back on the press.',
        String(stats.savedPalettes || 0) + ' saved', FEATURE_ICONS.palettes),
    ]));
    setFoot('Esc', 'close');
  }

  function pluginKind(kind) {
    if (kind === 'preset-pack') return 'Preset pack';
    if (kind === 'palette-pack') return 'Palette pack';
    return 'Tool';
  }

  function renderPlugins(snapshot) {
    const plugins = Array.isArray(snapshot.plugins) ? snapshot.plugins : [];
    setHead('Plugins');
    body.appendChild(sectionHead('INSTALLED', plugins.length + (plugins.length === 1 ? ' package' : ' packages')));
    if (!plugins.length) {
      body.appendChild(emptyState('../assets/menu/plugin-package.svg',
        'No packages installed',
        'The press works without them. Open the Plugin Manager to add a tool, preset pack or palette pack.',
        'Open Plugin Manager', opts.openPluginManager));
    } else {
      const grid = node('div', 'fm-package-grid');
      plugins.forEach(function (pkg) {
        const card = node('button', 'fm-package');
        card.type = 'button';
        card.dataset.fmPlugin = pkg.id;
        card.title = pkg.summary || pkg.name;
        const plate = node('span', 'fm-package-icon');
        plate.appendChild(glyph(PACKAGE_ICONS[pkg.id] || '../assets/menu/plugin-package.svg', 'fm-glyph--package'));
        const copy = node('span', 'fm-package-copy');
        copy.appendChild(node('strong', '', pkg.name));
        copy.appendChild(node('small', '', pluginKind(pkg.kind) + ' · v' + (pkg.version || '1.0.0')));
        const summary = node('small', 'fm-package-summary', pkg.summary || '');
        copy.appendChild(summary);
        card.appendChild(plate);
        card.appendChild(copy);
        card.appendChild(chevron());
        card.addEventListener('click', function () {
          close();
          if (typeof opts.openPlugin === 'function') opts.openPlugin(pkg.id);
          else opts.openPluginManager();
        });
        grid.appendChild(card);
      });
      body.appendChild(grid);
    }
    body.appendChild(wideAction('Open Plugin Manager', '../assets/menu/plugin-package.svg', opts.openPluginManager));
    setFoot('Esc', 'back');
  }

  function modeLabel(effect) {
    return effect.mode ? effect.mode : '';
  }

  function renderEffects(snapshot) {
    const effects = Array.isArray(snapshot.effects) ? snapshot.effects : [];
    setHead('Effects');
    if (!effects.length) {
      body.appendChild(emptyState('../assets/menu/feature-effects.svg',
        'The stack is clear',
        'No effect is running on the proof. Open the Effects panel to add grain, scanlines, a ripple or a shape press.',
        'Open the Effects panel', function () { opts.openPanel('effects'); }));
      setFoot('Esc', 'back');
      return;
    }

    const summary = node('div', 'fm-effect-summary');
    const summaryIcon = node('span', 'fm-summary-icon');
    summaryIcon.appendChild(glyph(FEATURE_ICONS.effects, 'fm-glyph--summary'));
    const summaryCopy = node('span', 'fm-summary-copy');
    summaryCopy.appendChild(node('strong', '', effects.length + (effects.length === 1 ? ' effect on' : ' effects on')));
    summaryCopy.appendChild(node('small', '', 'Applied to the current proof'));
    summary.appendChild(summaryIcon);
    summary.appendChild(summaryCopy);
    const disable = node('button', 'fm-text-action', 'Disable all');
    disable.type = 'button';
    disable.addEventListener('click', function () {
      opts.clearEffects();
      refresh();
    });
    summary.appendChild(disable);
    body.appendChild(summary);

    const list = node('div', 'fm-effects-list');
    effects.forEach(function (effect, index) {
      const row = node('div', 'fm-effect-row');
      row.dataset.fmEffect = effect.id;
      row.appendChild(node('span', 'fm-index', String(index + 1).padStart(2, '0')));
      const copy = node('span', 'fm-effect-copy');
      copy.appendChild(node('strong', '', effect.name));
      const detail = [];
      if (effect.amount !== undefined && effect.amount !== null) detail.push(effect.amount + '%');
      if (modeLabel(effect)) detail.push(modeLabel(effect));
      copy.appendChild(node('small', '', detail.join(' · ') || 'active'));
      row.appendChild(copy);
      const toggle = node('button', 'fm-switch is-on');
      toggle.type = 'button';
      toggle.setAttribute('role', 'switch');
      toggle.setAttribute('aria-checked', 'true');
      toggle.setAttribute('aria-label', 'Turn off ' + effect.name);
      toggle.appendChild(node('span'));
      toggle.addEventListener('click', function () {
        opts.toggleEffect(effect.id);
        refresh();
      });
      row.appendChild(toggle);
      list.appendChild(row);
    });
    body.appendChild(list);
    body.appendChild(wideAction('Add another effect', FEATURE_ICONS.effects, function () { opts.openPanel('effects'); }));
    setFoot('Esc', 'back');
  }

  function swatchStrip(colors, className) {
    const strip = node('span', className || 'fm-swatches');
    (colors || []).slice(0, 6).forEach(function (color) {
      const chip = node('span', 'fm-swatch');
      chip.style.background = 'rgb(' + color[0] + ',' + color[1] + ',' + color[2] + ')';
      strip.appendChild(chip);
    });
    return strip;
  }

  function renderPresets(snapshot) {
    const presets = Array.isArray(snapshot.presets) ? snapshot.presets : [];
    setHead('Presets');
    if (!presets.length) {
      body.appendChild(emptyState(FEATURE_ICONS.presets, 'No recipes loaded',
        'No preset is available. Open the Presets panel to import a recipe.',
        'Open the Presets panel', function () { opts.openPanel('preset'); }));
      setFoot('Esc', 'back');
      return;
    }

    const counts = {};
    presets.forEach(function (preset) {
      counts[preset.group] = (counts[preset.group] || 0) + 1;
    });
    let lastGroup = null;
    presets.forEach(function (preset) {
      if (preset.group !== lastGroup) {
        lastGroup = preset.group;
        body.appendChild(sectionHead(preset.group.toUpperCase(), counts[preset.group] + ' recipes'));
      }
      const row = node('button', 'fm-recipe');
      row.type = 'button';
      row.dataset.fmPreset = preset.id;
      row.title = 'Apply ' + preset.name;
      row.appendChild(swatchStrip(preset.colors, 'fm-recipe-swatches'));
      const copy = node('span', 'fm-recipe-copy');
      copy.appendChild(node('strong', '', preset.name));
      copy.appendChild(node('small', '', preset.subtitle || ''));
      row.appendChild(copy);
      row.appendChild(chevron());
      row.addEventListener('click', function () {
        close();
        opts.applyPreset(preset.id);
      });
      body.appendChild(row);
    });
    body.appendChild(wideAction('Open the Presets panel', FEATURE_ICONS.presets, function () { opts.openPanel('preset'); }));
    setFoot('Esc', 'back');
  }

  function renderPalettes(snapshot) {
    const palettes = Array.isArray(snapshot.palettes) ? snapshot.palettes : [];
    setHead('Color schemes');
    body.appendChild(sectionHead('SAVED', palettes.length + (palettes.length === 1 ? ' scheme' : ' schemes')));
    if (!palettes.length) {
      body.appendChild(emptyState(FEATURE_ICONS.palettes, 'No saved schemes yet',
        'Save a draft from Color Scheme Maker, or import a palette from a file.',
        'Manage color schemes', opts.openPaletteManager));
    } else {
      const list = node('div', 'fm-palette-list');
      palettes.forEach(function (palette) {
        const row = node('button', 'fm-palette-row');
        row.type = 'button';
        row.dataset.fmPalette = palette.id;
        row.appendChild(swatchStrip(palette.colors, 'fm-palette-swatches'));
        const copy = node('span', 'fm-palette-copy');
        copy.appendChild(node('strong', '', palette.name));
        copy.appendChild(node('small', '', palette.colors.length + (palette.colors.length === 1 ? ' ink' : ' inks')));
        row.appendChild(copy);
        row.appendChild(chevron());
        row.addEventListener('click', function () {
          close();
          opts.selectPalette(palette.id);
        });
        list.appendChild(row);
      });
      body.appendChild(list);
    }
    body.appendChild(wideAction('Manage color schemes', FEATURE_ICONS.palettes, opts.openPaletteManager));
    setFoot('Esc', 'back');
  }

  function render() {
    if (!body) return;
    const snapshot = data();
    body.textContent = '';
    body.scrollTop = 0;
    if (view === 'plugins') renderPlugins(snapshot);
    else if (view === 'effects') renderEffects(snapshot);
    else if (view === 'presets') renderPresets(snapshot);
    else if (view === 'palettes') renderPalettes(snapshot);
    else renderMenu(snapshot);
  }

  function focusables() {
    if (!overlay) return [];
    return Array.prototype.filter.call(
      overlay.querySelectorAll('button, input, [href]'),
      function (element) {
        return !element.disabled && element.type !== 'hidden' && element.offsetParent !== null;
      }
    );
  }

  function focusFirst() {
    const first = body && body.querySelector('button');
    if (first) first.focus();
    else if (backBtn && !backBtn.hidden) backBtn.focus();
    else closeBtn.focus();
  }

  function trapFocus(event) {
    const nodes = focusables();
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function go(next) {
    if (['menu', 'plugins', 'effects', 'presets', 'palettes'].indexOf(next) < 0) return false;
    view = next;
    backBtn.hidden = next === 'menu';
    render();
    focusFirst();
    return true;
  }

  function build() {
    overlay = document.getElementById('feature-menu');
    title = document.getElementById('fm-title');
    body = document.getElementById('fm-body');
    backBtn = document.getElementById('fm-back');
    closeBtn = document.getElementById('fm-close');
    footKey = document.getElementById('fm-foot-key');
    footAction = document.getElementById('fm-foot-action');
    if (!overlay || !body || !backBtn || !closeBtn) return false;

    backBtn.addEventListener('click', function () { go('menu'); });
    closeBtn.addEventListener('click', close);
    const scrim = overlay.querySelector('[data-fm-close]');
    if (scrim) scrim.addEventListener('click', close);
    overlay.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (view !== 'menu') go('menu');
        else close();
        return;
      }
      if (event.key === 'Tab') trapFocus(event);
    });
    return true;
  }

  function open(options) {
    if (!overlay && !build()) return false;
    if (!options) return false;
    opts = options;
    closeOtherWindows();
    view = 'menu';
    backBtn.hidden = true;
    render();
    overlay.hidden = false;
    restoreFocus = document.activeElement;
    global.requestAnimationFrame(function () {
      overlay.classList.add('is-in');
      focusFirst();
    });
    return true;
  }

  function close() {
    if (!overlay || overlay.hidden) return;
    overlay.classList.remove('is-in');
    overlay.hidden = true;
    view = 'menu';
    if (restoreFocus && restoreFocus.focus) {
      try { restoreFocus.focus(); } catch (err) { /* the control may be gone */ }
    }
    restoreFocus = null;
  }

  function isOpen() { return !!overlay && !overlay.hidden; }

  function refresh() {
    if (!isOpen()) return false;
    render();
    if (!overlay.contains(document.activeElement)) focusFirst();
    return true;
  }

  function state() {
    return {
      open: isOpen(),
      view: view,
      title: title ? title.textContent : '',
      cards: body ? body.querySelectorAll('[data-fm-view]').length : 0,
      rows: body ? body.querySelectorAll('[data-fm-plugin], [data-fm-effect], [data-fm-preset], [data-fm-palette]').length : 0,
    };
  }

  global.DitherFeatureMenu = {
    open: open,
    close: close,
    isOpen: isOpen,
    refresh: refresh,
    state: state,
  };
}(typeof window !== 'undefined' ? window : globalThis));
