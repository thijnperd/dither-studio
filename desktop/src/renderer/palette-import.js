/* palette-import.js - the palette import window.
 *
 * A small modal over the proof: paste a palette or choose a file, see the inks
 * it found, name it, import it. The parser lives in renderer/core.js, so the
 * window and the Node tests agree about what a valid palette is. This file
 * owns only the surface: preview chips, the file route, an error line and the
 * keyboard.
 *
 * Exposes: window.DitherPaletteImport - { open, close, isOpen, parse }.
 */
(function () {
  'use strict';

  const Core = window.DitherCore;
  if (!Core) return;

  const $ = function (id) { return document.getElementById(id); };
  const desktop = window.ditherDesktop || null;

  let overlay = null;
  let nameField = null;
  let textArea = null;
  let preview = null;
  let errorLine = null;
  let fileInput = null;
  let onImport = null;
  let restoreFocus = null;
  let nameTouched = false;

  function setError(message) {
    if (!errorLine) return;
    errorLine.textContent = message || 'That palette could not be read';
    errorLine.hidden = false;
  }

  function clearError() {
    if (!errorLine) return;
    errorLine.textContent = '';
    errorLine.hidden = true;
  }

  function drawPreview(colors) {
    preview.textContent = '';
    const shown = colors.length > 24 ? 24 : colors.length;
    for (let i = 0; i < shown; i++) {
      const chip = document.createElement('span');
      const c = colors[i];
      chip.className = 'pimport-chip';
      chip.style.background = 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
      chip.title = Core.rgbToHex(c);
      preview.appendChild(chip);
    }
    if (colors.length > shown) {
      const more = document.createElement('span');
      more.className = 'pimport-count';
      more.textContent = '+' + (colors.length - shown);
      preview.appendChild(more);
    }
    const count = document.createElement('span');
    count.className = 'pimport-count';
    count.textContent = colors.length + (colors.length === 1 ? ' ink' : ' inks');
    preview.appendChild(count);
  }

  function syncPreview(autoName, fallbackName) {
    clearError();
    const text = textArea.value.trim();
    if (!text) {
      preview.textContent = 'No inks yet — paste a palette or choose a file.';
      return null;
    }
    let parsed;
    try {
      parsed = Core.parsePaletteText(text, fallbackName || nameField.value.trim() || 'Imported palette');
    } catch (err) {
      preview.textContent = 'Waiting for 2–64 readable colours…';
      return null;
    }
    if (autoName && !nameTouched && parsed.name !== 'Imported palette') nameField.value = parsed.name;
    drawPreview(parsed.colors);
    return parsed;
  }

  function baseName(filename) {
    return String(filename || '')
      .replace(/^.*[\\/]/, '')
      .replace(/\.[^.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .trim()
      .slice(0, 60);
  }

  function applyPayload(payload) {
    if (!payload) return;
    if (payload.error) {
      setError(payload.error);
      return;
    }
    const text = String(payload.text == null ? '' : payload.text);
    if (text.length > 200000) {
      setError('That palette file is too large');
      return;
    }
    textArea.value = text;
    if (!nameTouched) nameField.value = '';
    syncPreview(true, baseName(payload.name));
  }

  function chooseFile() {
    if (desktop && desktop.openPalette) {
      desktop.openPalette().then(applyPayload).catch(function () {
        setError('The open dialog failed');
      });
      return;
    }
    fileInput.click();
  }

  function submit() {
    let parsed;
    try {
      parsed = Core.parsePaletteText(textArea.value, nameField.value.trim() || 'Imported palette');
    } catch (err) {
      setError(err.message);
      textArea.focus();
      return;
    }
    const typed = nameField.value.trim();
    if (typed) parsed.name = Core.cleanPaletteName(typed, parsed.name);
    if (!onImport) return;
    let result;
    try {
      result = onImport(parsed);
    } catch (err) {
      setError(err && err.message ? err.message : 'The palette could not be imported');
      return;
    }
    if (result && result.ok === false) {
      setError(result.error || 'The palette could not be imported');
      return;
    }
    close();
  }

  function focusables() {
    return Array.prototype.filter.call(
      overlay.querySelectorAll('button, input, textarea'),
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

  function build() {
    overlay = $('palette-import');
    nameField = $('palette-import-name');
    textArea = $('palette-import-text');
    preview = $('palette-import-preview');
    errorLine = $('palette-import-error');
    fileInput = $('palette-import-file-input');
    if (!overlay || !nameField || !textArea || !preview || !errorLine || !fileInput) return false;

    nameField.addEventListener('input', function () { nameTouched = true; });
    textArea.addEventListener('input', function () { syncPreview(false); });

    $('palette-import-file').addEventListener('click', chooseFile);
    $('palette-import-cancel').addEventListener('click', close);
    $('palette-import-go').addEventListener('click', submit);

    fileInput.addEventListener('change', function () {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () { applyPayload({ text: reader.result, name: file.name }); };
      reader.onerror = function () { setError('That palette file could not be read'); };
      reader.readAsText(file);
    });

    overlay.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      }
      if (event.key === 'Tab') {
        trapFocus(event);
        return;
      }
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        submit();
      }
    });

    // The backdrop is a click target, the card is not.
    overlay.addEventListener('pointerdown', function (event) {
      if (event.target === overlay) close();
    });

    return true;
  }

  function open(callback) {
    if (!overlay && !build()) return;
    if (window.DitherHelp && window.DitherHelp.isOpen && window.DitherHelp.isOpen()) {
      window.DitherHelp.close();
    }
    if (window.DitherPalette && window.DitherPalette.isOpen && window.DitherPalette.isOpen()) {
      window.DitherPalette.close();
    }
    if (window.DitherPaletteManager && window.DitherPaletteManager.isOpen && window.DitherPaletteManager.isOpen()) {
      window.DitherPaletteManager.close();
    }
    onImport = callback;
    nameTouched = false;
    nameField.value = '';
    textArea.value = '';
    preview.textContent = 'No inks yet — paste a palette or choose a file.';
    clearError();
    overlay.hidden = false;
    restoreFocus = document.activeElement;
    window.requestAnimationFrame(function () { overlay.classList.add('is-in'); });
    textArea.focus();
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

  window.DitherPaletteImport = {
    open: open,
    close: close,
    isOpen: isOpen,
    parse: Core.parsePaletteText,
  };
}());
