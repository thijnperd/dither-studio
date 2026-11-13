/* palette-manager.js - the saved-color-scheme window.
 *
 * Color Scheme Maker saves its drafts beside imported palettes, in the same
 * small localStorage list. This window is the other side of that store: a
 * list of the palettes the user made, with an inline rename, an Edit route
 * back into the maker, and a two-step delete. Built-in and plugin palettes are
 * deliberately absent because neither belongs to the user's own store.
 *
 * Exposes: window.DitherPaletteManager - { open, close, isOpen, refresh, state }.
 */
(function (global) {
  'use strict';

  const Core = global.DitherCore;
  if (!Core) return;

  const $ = function (id) { return document.getElementById(id); };

  let overlay = null;
  let list = null;
  let statusLine = null;
  let errorLine = null;
  let opts = null;
  let restoreFocus = null;
  let confirmId = null;
  let confirmTimer = 0;

  function setError(message) {
    if (!errorLine) return;
    errorLine.textContent = message || 'That palette could not be changed';
    errorLine.hidden = !message;
  }

  function setStatus(message) {
    if (statusLine) statusLine.textContent = message || '';
  }

  function cleanName(value, fallback) {
    return Core.cleanPaletteName(String(value || '').trim(), fallback);
  }

  function swatchStrip(colors, name) {
    const strip = document.createElement('span');
    strip.className = 'palette-manager-swatches';
    strip.setAttribute('aria-label', 'Inks in ' + name);
    const shown = colors.length > 16 ? 16 : colors.length;
    for (let i = 0; i < shown; i++) {
      const color = colors[i];
      const chip = document.createElement('span');
      chip.className = 'palette-manager-swatch';
      chip.style.background = 'rgb(' + color[0] + ',' + color[1] + ',' + color[2] + ')';
      chip.title = Core.rgbToHex(color);
      strip.appendChild(chip);
    }
    return strip;
  }

  function resetDelete() {
    if (confirmTimer) {
      clearTimeout(confirmTimer);
      confirmTimer = 0;
    }
    confirmId = null;
    if (list) {
      Array.prototype.forEach.call(list.querySelectorAll('[data-action="delete"]'), function (button) {
        button.textContent = 'Delete';
        button.classList.remove('is-confirming');
      });
    }
  }

  function row(palette, onRename, onDelete) {
    const node = document.createElement('div');
    node.className = 'palette-manager-row';
    node.dataset.id = palette.id;

    node.appendChild(swatchStrip(palette.colors, palette.name));

    const main = document.createElement('div');
    main.className = 'palette-manager-main';
    const nameInput = document.createElement('input');
    nameInput.className = 'palette-manager-name';
    nameInput.type = 'text';
    nameInput.maxLength = 60;
    nameInput.value = palette.name;
    nameInput.spellcheck = false;
    nameInput.setAttribute('aria-label', 'Name of ' + palette.name);
    const meta = document.createElement('span');
    meta.className = 'palette-manager-meta';
    meta.textContent = palette.colors.length + (palette.colors.length === 1 ? ' ink' : ' inks') + ' · saved on this machine';
    main.appendChild(nameInput);
    main.appendChild(meta);
    node.appendChild(main);

    const tools = document.createElement('div');
    tools.className = 'palette-manager-tools';
    const renameBtn = document.createElement('button');
    renameBtn.className = 'btn';
    renameBtn.type = 'button';
    renameBtn.textContent = 'Rename';
    renameBtn.disabled = true;
    renameBtn.dataset.action = 'rename';
    const editBtn = document.createElement('button');
    editBtn.className = 'btn';
    editBtn.type = 'button';
    editBtn.textContent = 'Edit';
    editBtn.dataset.action = 'edit';
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn';
    deleteBtn.type = 'button';
    deleteBtn.textContent = 'Delete';
    deleteBtn.dataset.action = 'delete';
    deleteBtn.setAttribute('aria-label', 'Delete ' + palette.name);

    nameInput.addEventListener('input', function () {
      renameBtn.disabled = !nameInput.value.trim() || nameInput.value.trim() === palette.name;
    });
    nameInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (!renameBtn.disabled) commitRename();
      }
    });

    function commitRename() {
      const next = nameInput.value.trim();
      if (!next) {
        setError('A palette needs a name');
        nameInput.focus();
        return;
      }
      let result;
      try {
        result = onRename(palette.id, cleanName(next, palette.name));
      } catch (err) {
        result = { ok: false, error: err && err.message ? err.message : 'The palette could not be renamed' };
      }
      if (result && result.ok === false) {
        setError(result.error || 'The palette could not be renamed');
        nameInput.focus();
        return;
      }
      setError('');
      setStatus('Renamed to ' + cleanName(next, palette.name));
      resetDelete();
      render();
    }

    renameBtn.addEventListener('click', commitRename);
    editBtn.addEventListener('click', function () {
      if (typeof opts.onEdit !== 'function') return;
      let result;
      try {
        result = opts.onEdit(palette.id);
      } catch (err) {
        setError(err && err.message ? err.message : 'The scheme could not be opened');
        return;
      }
      if (result && result.ok === false) {
        setError(result.error || 'That scheme could not be opened');
        return;
      }
      if (result === false) {
        setError('That scheme is no longer available');
        return;
      }
      close();
    });
    deleteBtn.addEventListener('click', function () {
      if (confirmId !== palette.id) {
        resetDelete();
        confirmId = palette.id;
        deleteBtn.textContent = 'Delete?';
        deleteBtn.classList.add('is-confirming');
        setStatus('Press Delete again to remove “' + palette.name + '”.');
        confirmTimer = setTimeout(function () {
          if (confirmId === palette.id) {
            resetDelete();
            render();
          }
        }, 4000);
        return;
      }
      let result;
      try {
        result = onDelete(palette.id);
      } catch (err) {
        result = { ok: false, error: err && err.message ? err.message : 'The palette could not be deleted' };
      }
      if (result && result.ok === false) {
        setError(result.error || 'The palette could not be deleted');
        return;
      }
      resetDelete();
      setError('');
      setStatus('Deleted “' + palette.name + '”.');
      render();
    });

    tools.appendChild(renameBtn);
    tools.appendChild(editBtn);
    tools.appendChild(deleteBtn);
    node.appendChild(tools);
    return node;
  }

  function render() {
    if (!list) return;
    list.textContent = '';
    const palettes = opts && typeof opts.list === 'function' ? opts.list() : [];
    if (!Array.isArray(palettes) || !palettes.length) {
      const empty = document.createElement('p');
      empty.className = 'palette-manager-empty';
      empty.textContent = 'No saved schemes yet. Save one from Color Scheme Maker, or import a palette.';
      list.appendChild(empty);
      return;
    }
    palettes.forEach(function (palette) {
      list.appendChild(row(palette, opts.onRename, opts.onDelete));
    });
  }

  function focusables() {
    if (!overlay) return [];
    return Array.prototype.filter.call(
      overlay.querySelectorAll('button, input'),
      function (node) {
        return !node.disabled && node.type !== 'hidden' && node.offsetParent !== null;
      }
    );
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

  function closeOtherWindows() {
    [
      'DitherHelp', 'DitherPalette', 'DitherPaletteImport',
      'DitherPlugins', 'DitherInkExtractor', 'DitherColorScheme',
    ].forEach(function (name) {
      const api = global[name];
      if (api && api.isOpen && api.isOpen() && api.close) api.close();
    });
  }

  function build() {
    overlay = $('palette-manager');
    list = $('palette-manager-list');
    statusLine = $('palette-manager-status');
    errorLine = $('palette-manager-error');
    const closeBtn = $('palette-manager-close');
    if (!overlay || !list || !closeBtn) return false;

    closeBtn.addEventListener('click', close);
    overlay.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      }
      if (event.key === 'Tab') trapFocus(event);
    });
    overlay.addEventListener('pointerdown', function (event) {
      if (event.target === overlay) close();
    });
    return true;
  }

  function open(options) {
    if (!overlay && !build()) return false;
    if (!options || typeof options.list !== 'function') return false;
    opts = options;
    closeOtherWindows();
    resetDelete();
    setError('');
    setStatus('');
    render();
    overlay.hidden = false;
    restoreFocus = document.activeElement;
    global.requestAnimationFrame(function () {
      overlay.classList.add('is-in');
      const first = overlay.querySelector('.palette-manager-name');
      if (first) first.focus();
    });
    return true;
  }

  function close() {
    if (!overlay || overlay.hidden) return;
    overlay.classList.remove('is-in');
    overlay.hidden = true;
    resetDelete();
    if (restoreFocus && restoreFocus.focus) {
      try { restoreFocus.focus(); } catch (err) { /* the control may be gone */ }
    }
    restoreFocus = null;
  }

  function isOpen() { return !!overlay && !overlay.hidden; }

  function refresh() {
    if (isOpen()) render();
    return isOpen();
  }

  function state() {
    return {
      open: isOpen(),
      count: list ? list.querySelectorAll('.palette-manager-row').length : 0,
      confirming: confirmId,
    };
  }

  global.DitherPaletteManager = {
    open: open,
    close: close,
    isOpen: isOpen,
    refresh: refresh,
    state: state,
  };
}(typeof window !== 'undefined' ? window : globalThis));
