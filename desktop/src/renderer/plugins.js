/* plugins.js - the declarative plugin manager.
 *
 * A plugin is a JSON package, never a script. The app ships the capabilities
 * (the Ink Extractor and Color Scheme Maker dialogs, the Shape Press effect) and
 * a package switches one on, or contributes presets. That keeps the offline
 * renderer intact even when a package comes from a repository nobody has reviewed.
 *
 * The desktop process does the HTTPS fetch (electron/plugins.js); this file
 * validates the package again with renderer/core.js, stores it in localStorage
 * and paints the manager. There is deliberately no `eval`, `Function` or
 * `import()` on a downloaded value.
 *
 * Exposes: window.DitherPlugins.
 */
(function (global) {
  'use strict';

  const Core = global.DitherCore;
  if (!Core) return;
  const $ = function (id) { return document.getElementById(id); };
  const desktop = global.ditherDesktop || null;
  const STORE = 'dither-studio.plugins.v1';

  const installed = new Map();
  const listeners = [];
  let catalogue = null;
  let catalogueSource = '';
  let catalogueError = '';
  let busy = false;
  let overlay = null;
  let list = null;
  let statusLine = null;
  let storageLine = null;

  function note(text) {
    if (statusLine) statusLine.textContent = text;
    listeners.forEach(function (fn) {
      try { fn('status', { message: text }); } catch (err) { /* a listener is not the app */ }
    });
  }

  function emit(type, detail) {
    listeners.forEach(function (fn) {
      try { fn(type, detail); } catch (err) { /* a listener is not the app */ }
    });
  }

  function loadStored() {
    let raw = null;
    try { raw = global.localStorage.getItem(STORE); } catch (err) { return; }
    if (!raw) return;
    let parsed;
    try { parsed = JSON.parse(raw); } catch (err) { return; }
    const listOfPackages = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.plugins) ? parsed.plugins : [];
    listOfPackages.slice(0, 32).forEach(function (entry) {
      try {
        const pkg = Core.validatePluginPackage(entry);
        installed.set(pkg.id, pkg);
      } catch (err) { /* a corrupt entry is skipped, not fatal */ }
    });
  }

  function save() {
    try {
      global.localStorage.setItem(STORE, JSON.stringify({ plugins: Array.from(installed.values()) }));
    } catch (err) { /* private mode, file://, or storage disabled: this session only */ }
  }

  function catalogueEntries() {
    if (!catalogue || !Array.isArray(catalogue.plugins)) return [];
    return catalogue.plugins.filter(function (entry) {
      return entry && /^[a-z][a-z0-9-]{1,47}$/.test(String(entry.id || ''));
    });
  }

  function setCatalogue(next, source, error) {
    catalogue = next;
    catalogueSource = source || '';
    catalogueError = error || '';
    render();
  }

  function fetchCatalogue(force, localOnly) {
    if (!desktop || !desktop.pluginsCatalogue) {
      setCatalogue(null, '', 'The plugin manager needs the desktop build');
      return Promise.resolve(null);
    }
    if (catalogue && !force) {
      render();
      return Promise.resolve(catalogue);
    }
    note('Checking GitHub…');
    return desktop.pluginsCatalogue(!!force, !!localOnly).then(function (out) {
      if (!out || out.error) {
        setCatalogue(out && out.catalogue ? out.catalogue : null, out && out.source, (out && out.error) || 'The catalogue could not be read');
        note((out && out.error) || 'The catalogue could not be read');
        return catalogue;
      }
      setCatalogue(out.catalogue, out.source, '');
      note(out.source === 'github' ? 'Catalogue refreshed from GitHub' : 'GitHub was unreachable · showing the bundled catalogue');
      return catalogue;
    }).catch(function (err) {
      setCatalogue(null, '', err && err.message ? err.message : 'The catalogue could not be read');
      note(catalogueError);
      return null;
    });
  }

  function install(id, localOnly) {
    if (!desktop || !desktop.pluginsPackage) {
      note('The plugin manager needs the desktop build');
      return Promise.resolve(null);
    }
    if (busy) return Promise.resolve(null);
    busy = true;
    note('Installing ' + id + '…');
    render();
    return desktop.pluginsPackage(id, !!localOnly).then(function (out) {
      if (!out || out.error || !out.plugin) throw new Error((out && out.error) || 'The package was empty');
      const pkg = Core.validatePluginPackage(out.plugin);
      if (pkg.id !== id) throw new Error('The package id does not match the catalogue');
      installed.set(pkg.id, pkg);
      save();
      note(pkg.name + ' installed' + (out.source === 'bundled' ? ' from the bundled copy' : ' from GitHub'));
      emit('install', pkg);
      return pkg;
    }).catch(function (err) {
      note(err && err.message ? err.message : 'That plugin could not be installed');
      return null;
    }).then(function (pkg) {
      busy = false;
      render();
      return pkg;
    });
  }

  function remove(id) {
    const pkg = installed.get(id);
    if (!pkg) return false;
    installed.delete(id);
    save();
    note(pkg.name + ' removed');
    emit('remove', pkg);
    render();
    return true;
  }

  function installFromPackage(pkg) {
    const clean = Core.validatePluginPackage(pkg);
    installed.set(clean.id, clean);
    save();
    note(clean.name + ' installed from a file');
    emit('install', clean);
    render();
    return clean;
  }

  function has(capability) {
    let found = false;
    installed.forEach(function (pkg) {
      if (pkg.kind === 'tool' && pkg.capability === capability) found = true;
    });
    return found;
  }

  function tool(capability) {
    let found = null;
    installed.forEach(function (pkg) {
      if (pkg.kind === 'tool' && pkg.capability === capability) found = pkg;
    });
    return found;
  }

  function presets() {
    const out = [];
    installed.forEach(function (pkg) {
      if (pkg.kind !== 'preset-pack') return;
      pkg.data.presets.forEach(function (preset) {
        out.push({
          id: preset.id,
          name: preset.name,
          settings: preset.settings,
          plugin: pkg.id,
          pluginName: pkg.name,
        });
      });
    });
    return out;
  }

  // Palette packs are the shareable form of a Color Scheme Maker export. The
  // prefixed id keeps a pack from shadowing a built-in or a custom import.
  function palettes() {
    const out = [];
    installed.forEach(function (pkg) {
      if (pkg.kind !== 'palette-pack') return;
      pkg.data.palettes.forEach(function (palette) {
        out.push({
          id: 'plugin-' + pkg.id + '-' + palette.id,
          name: palette.name,
          colors: palette.colors,
          plugin: pkg.id,
          pluginName: pkg.name,
        });
      });
    });
    return out;
  }

  function packageBytes(pkg) {
    try {
      return new TextEncoder().encode(JSON.stringify(pkg)).length;
    } catch (err) {
      return 0;
    }
  }

  function formatBytes(bytes) {
    const size = Number(bytes) || 0;
    if (!size) return '';
    if (size < 1024) return size + ' B';
    const kb = size / 1024;
    if (kb < 1024) return (kb < 10 ? kb.toFixed(1) : Math.round(kb)) + ' KB';
    return (kb / 1024).toFixed(1) + ' MB';
  }

  function row(entry) {
    const pkg = installed.get(entry.id);
    const size = pkg ? packageBytes(pkg) : Number(entry.bytes) || 0;
    const box = document.createElement('div');
    box.className = 'plugin-row' + (pkg ? ' is-installed' : '');
    box.dataset.plugin = entry.id;
    box.dataset.bytes = String(size || '');
    const text = document.createElement('div');
    const name = document.createElement('p');
    name.className = 'plugin-name';
    name.textContent = entry.name || entry.id;
    const summary = document.createElement('p');
    summary.className = 'plugin-summary';
    summary.textContent = entry.summary || '';
    const meta = document.createElement('p');
    meta.className = 'plugin-meta';
    const kindLabel = entry.kind === 'palette-pack' ? 'Palette pack'
      : entry.kind === 'preset-pack' ? 'Preset pack' : 'Tool';
    meta.textContent = kindLabel
      + ' · v' + (pkg ? pkg.version : entry.version || '1.0.0')
      + (entry.author ? ' · ' + entry.author : '')
      + (size ? ' · ' + formatBytes(size) + (pkg ? ' on disk' : '') : '')
      + (pkg ? ' · installed' : '');
    text.appendChild(name);
    text.appendChild(summary);
    text.appendChild(meta);
    const action = document.createElement('button');
    action.className = 'btn' + (pkg ? '' : ' btn-primary');
    action.type = 'button';
    action.textContent = pkg ? 'Remove' : 'Install';
    action.disabled = busy;
    action.addEventListener('click', function () {
      if (pkg) remove(entry.id);
      else install(entry.id);
    });
    box.appendChild(text);
    box.appendChild(action);
    return box;
  }

  function section(id, title, noun, entries, hint) {
    const box = document.createElement('section');
    box.className = 'plugin-section';
    box.dataset.section = id;
    const head = document.createElement('div');
    head.className = 'plugin-section-head';
    const name = document.createElement('h3');
    name.className = 'plugin-section-title';
    name.textContent = title;
    const count = document.createElement('span');
    count.className = 'plugin-section-count';
    const installedHere = entries.filter(function (entry) { return installed.has(entry.id); }).length;
    const label = entries.length === 1 ? noun.replace(/s$/, '') : noun;
    count.textContent = entries.length + ' ' + label + ' · ' + installedHere + ' installed';
    head.appendChild(name);
    head.appendChild(count);
    box.appendChild(head);
    if (hint) {
      const note = document.createElement('p');
      note.className = 'plugin-section-note';
      note.textContent = hint;
      box.appendChild(note);
    }
    entries.forEach(function (entry) { box.appendChild(row(entry)); });
    return box;
  }

  function render() {
    if (!list) return;
    list.textContent = '';
    const entries = catalogueEntries().slice();
    // Installed packages survive a catalogue that has gone away; they still
    // need a Remove button, and they are the ones already lighting up tools.
    installed.forEach(function (pkg) {
      if (entries.some(function (entry) { return entry.id === pkg.id; })) return;
      entries.push({ id: pkg.id, name: pkg.name, summary: pkg.summary, version: pkg.version, kind: pkg.kind, author: pkg.author });
    });
    const tools = entries.filter(function (entry) { return entry.kind === 'tool'; });
    const packs = entries.filter(function (entry) {
      return entry.kind === 'preset-pack' || entry.kind === 'palette-pack';
    });
    if (tools.length) list.appendChild(section('functionality', 'Functionality', 'tools', tools,
      'A package switches on one of the app’s built-in tools or effects.'));
    if (packs.length) list.appendChild(section('presets', 'Presets & color schemes', 'packs', packs,
      'A package adds recipes or a set of inks without changing the app.'));
    if (!entries.length) {
      const empty = document.createElement('p');
      empty.className = 'plugin-note';
      empty.textContent = catalogueError || 'No catalogue yet. Refresh from GitHub or check the connection.';
      list.appendChild(empty);
    }
    if (storageLine) {
      const packages = Array.from(installed.values());
      const used = packages.reduce(function (total, pkg) { return total + packageBytes(pkg); }, 0);
      storageLine.textContent = packages.length
        ? 'Stored on this machine: ' + packages.length + ' package' + (packages.length === 1 ? '' : 's') + ' · ' + formatBytes(used) + '. '
          + 'Each row is the package JSON kept in the app’s local settings.'
        : 'Nothing installed yet. Each row is the package JSON that would be stored on this machine.';
    }
    if (catalogueSource) {
      const source = document.createElement('p');
      source.className = 'plugin-note';
      source.textContent = 'Source: ' + (catalogueSource === 'github' ? 'GitHub · main' : 'bundled fallback copy');
      list.appendChild(source);
    }
  }

  function build() {
    overlay = $('plugin-manager');
    list = $('plugin-list');
    statusLine = $('plugin-status');
    storageLine = $('plugin-storage');
    if (!overlay || !list) return false;
    $('plugin-close').addEventListener('click', close);
    $('plugin-refresh').addEventListener('click', function () { fetchCatalogue(true); });
    const fileInput = $('plugin-file-input');
    if (fileInput) {
      $('plugin-file').addEventListener('click', function () { fileInput.click(); });
      fileInput.addEventListener('change', function () {
        const file = fileInput.files && fileInput.files[0];
        fileInput.value = '';
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function () {
          let pkg;
          try { pkg = JSON.parse(String(reader.result)); }
          catch (err) { note('That file is not a JSON plugin package'); return; }
          try { installFromPackage(pkg); }
          catch (err) { note(err && err.message ? err.message : 'That plugin file could not be installed'); }
        };
        reader.onerror = function () { note('That plugin file could not be read'); };
        reader.readAsText(file);
      });
    }
    overlay.addEventListener('pointerdown', function (event) { if (event.target === overlay) close(); });
    overlay.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
    });
    return true;
  }

  function open() {
    if (!overlay && !build()) return false;
    if (global.DitherHelp && global.DitherHelp.isOpen && global.DitherHelp.isOpen()) global.DitherHelp.close();
    if (global.DitherPalette && global.DitherPalette.isOpen && global.DitherPalette.isOpen()) global.DitherPalette.close();
    if (global.DitherPaletteImport && global.DitherPaletteImport.isOpen && global.DitherPaletteImport.isOpen()) global.DitherPaletteImport.close();
    if (global.DitherInkExtractor && global.DitherInkExtractor.isOpen && global.DitherInkExtractor.isOpen()) global.DitherInkExtractor.close();
    if (global.DitherColorScheme && global.DitherColorScheme.isOpen && global.DitherColorScheme.isOpen()) global.DitherColorScheme.close();
    if (global.DitherPaletteManager && global.DitherPaletteManager.isOpen && global.DitherPaletteManager.isOpen()) global.DitherPaletteManager.close();
    overlay.hidden = false;
    global.requestAnimationFrame(function () { overlay.classList.add('is-in'); });
    render();
    if (!catalogue) fetchCatalogue(false);
    return true;
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove('is-in');
    overlay.hidden = true;
  }

  function isOpen() { return !!overlay && !overlay.hidden; }

  function onChange(fn) {
    if (typeof fn === 'function') listeners.push(fn);
  }

  loadStored();

  global.DitherPlugins = {
    open: open,
    close: close,
    isOpen: isOpen,
    refresh: function (force, localOnly) { return fetchCatalogue(force === undefined ? true : !!force, !!localOnly); },
    install: install,
    installFromPackage: installFromPackage,
    remove: remove,
    has: has,
    tool: tool,
    presets: presets,
    palettes: palettes,
    installed: function () { return Array.from(installed.values()); },
    catalogue: function () { return catalogue; },
    onChange: onChange,
    status: function () { return statusLine ? statusLine.textContent : ''; },
  };
}(typeof window !== 'undefined' ? window : globalThis));