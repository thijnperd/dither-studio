/* plugins.js - the declarative plugin manager.
 *
 * A plugin is a JSON package, never a script. The app ships the capabilities
 * (the Ink Extractor dialog, the Shape Press effect) and a package switches one
 * on, or contributes presets. That keeps the offline renderer intact even when
 * a package comes from a repository nobody has reviewed.
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

  function row(entry) {
    const pkg = installed.get(entry.id);
    const box = document.createElement('div');
    box.className = 'plugin-row' + (pkg ? ' is-installed' : '');
    const text = document.createElement('div');
    const name = document.createElement('p');
    name.className = 'plugin-name';
    name.textContent = entry.name || entry.id;
    const summary = document.createElement('p');
    summary.className = 'plugin-summary';
    summary.textContent = entry.summary || '';
    const meta = document.createElement('p');
    meta.className = 'plugin-meta';
    meta.textContent = (entry.kind === 'preset-pack' ? 'Preset pack' : 'Tool')
      + ' · v' + (pkg ? pkg.version : entry.version || '1.0.0')
      + (entry.author ? ' · ' + entry.author : '')
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

  function render() {
    if (!list) return;
    list.textContent = '';
    const entries = catalogueEntries();
    if (!entries.length) {
      const empty = document.createElement('p');
      empty.className = 'plugin-note';
      empty.textContent = catalogueError || 'No catalogue yet. Refresh from GitHub or check the connection.';
      list.appendChild(empty);
    } else {
      entries.forEach(function (entry) { list.appendChild(row(entry)); });
    }
    // Installed packages survive a catalogue that has gone away; they still
    // need a Remove button, and they are the ones already lighting up tools.
    installed.forEach(function (pkg) {
      if (entries.some(function (entry) { return entry.id === pkg.id; })) return;
      list.appendChild(row({ id: pkg.id, name: pkg.name, summary: pkg.summary, version: pkg.version, kind: pkg.kind, author: pkg.author }));
    });
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
    if (!overlay || !list) return false;
    $('plugin-close').addEventListener('click', close);
    $('plugin-refresh').addEventListener('click', function () { fetchCatalogue(true); });
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
    installed: function () { return Array.from(installed.values()); },
    catalogue: function () { return catalogue; },
    onChange: onChange,
    status: function () { return statusLine ? statusLine.textContent : ''; },
  };
}(typeof window !== 'undefined' ? window : globalThis));