/* ink-extractor.js - the Ink Extractor dialog (Ink Extractor plugin).
 *
 * Reads a still, hands its pixels to Core.extractPalette, previews the result
 * and passes a normal { name, colors } palette to the app's importer. It is the
 * ColorCat-shaped workflow without a second palette format or a second store.
 *
 * Exposes: window.DitherInkExtractor - { open, close, isOpen }.
 */
(function (global) {
  'use strict';

  const Core = global.DitherCore;
  if (!Core) return;
  const $ = function (id) { return document.getElementById(id); };
  const desktop = global.ditherDesktop || null;

  let overlay = null;
  let method = null;
  let count = null;
  let preview = null;
  let errorLine = null;
  let importBtn = null;
  let sourceLine = null;
  let fileInput = null;
  let opts = null;
  let colors = null;
  let currentName = '';
  let currentImage = null;
  let restoreFocus = null;
  const scratch = document.createElement('canvas');

  function setError(text) {
    if (!errorLine) return;
    errorLine.textContent = text || '';
    errorLine.hidden = !text;
  }

  function drawPreview() {
    if (!preview) return;
    preview.textContent = '';
    if (!colors) {
      preview.textContent = 'No colors yet — choose an image.';
      return;
    }
    colors.forEach(function (c) {
      const chip = document.createElement('span');
      chip.className = 'pimport-chip';
      chip.style.background = 'rgb(' + c.join(',') + ')';
      chip.title = Core.rgbToHex(c);
      preview.appendChild(chip);
    });
    const label = document.createElement('span');
    label.className = 'pimport-count';
    label.textContent = colors.length + ' inks';
    preview.appendChild(label);
  }

  function extract(imageData, name) {
    currentImage = imageData;
    if (name) currentName = name;
    setError('');
    try {
      colors = Core.extractPalette(imageData.data, imageData.width, imageData.height,
        parseInt(count.value, 10) || 8, method.value);
    } catch (err) {
      colors = null;
      setError(err && err.message ? err.message : 'That image could not be read');
    }
    if (sourceLine) sourceLine.textContent = currentName ? currentName + ' · ' + imageData.width + '×' + imageData.height : '';
    drawPreview();
    if (importBtn) importBtn.disabled = !colors;
  }

  function useCurrent() {
    if (!opts || typeof opts.getSource !== 'function') return;
    const image = opts.getSource();
    if (!image) {
      setError('Open an image first, then extract its palette');
      return;
    }
    extract(image, opts.sourceName ? opts.sourceName() : 'the open image');
  }

  function readFile(file) {
    if (!file) return;
    if (!global.createImageBitmap) {
      setError('This browser cannot decode that image');
      return;
    }
    global.createImageBitmap(file).then(function (bitmap) {
      const longest = Math.max(bitmap.width, bitmap.height);
      const scale = Math.min(1, 1400 / longest);
      scratch.width = Math.max(1, Math.round(bitmap.width * scale));
      scratch.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = scratch.getContext('2d', { willReadFrequently: true });
      context.imageSmoothingQuality = 'high';
      context.drawImage(bitmap, 0, 0, scratch.width, scratch.height);
      extract(context.getImageData(0, 0, scratch.width, scratch.height), file.name || 'image');
      bitmap.close && bitmap.close();
    }).catch(function () {
      setError('That image could not be decoded');
    });
  }

  function chooseFile() {
    if (desktop && desktop.openImage) {
      desktop.openImage().then(function (payload) {
        if (!payload) return;
        if (payload.error) { setError(payload.error); return; }
        const bytes = payload.bytes instanceof ArrayBuffer ? new Uint8Array(payload.bytes) : payload.bytes;
        readFile(new File([bytes], payload.name || 'image', { type: payload.mime || 'image/png' }));
      }).catch(function () { setError('The open dialog failed'); });
      return;
    }
    fileInput.click();
  }

  function build() {
    overlay = $('ink-extractor');
    method = $('ink-method');
    count = $('ink-count');
    preview = $('ink-preview');
    errorLine = $('ink-error');
    importBtn = $('ink-import');
    sourceLine = $('ink-source');
    fileInput = $('ink-file-input');
    if (!overlay || !method || !count || !preview || !importBtn) return false;
    Core.EXTRACT_METHODS.forEach(function (id) {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = Core.EXTRACT_LABELS[id] || id;
      method.appendChild(option);
    });
    method.value = 'cins';
    $('ink-file').addEventListener('click', chooseFile);
    $('ink-current').addEventListener('click', useCurrent);
    $('ink-cancel').addEventListener('click', close);
    $('ink-import').addEventListener('click', function () {
      if (!colors || !opts || typeof opts.onImport !== 'function') return;
      opts.onImport({ name: currentName.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim() || 'Extracted palette', colors: colors });
      close();
    });
    method.addEventListener('change', function () { if (currentImage) extract(currentImage, currentName); });
    count.addEventListener('change', function () { if (currentImage) extract(currentImage, currentName); });
    fileInput.addEventListener('change', function () {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      readFile(file);
    });
    overlay.addEventListener('pointerdown', function (event) { if (event.target === overlay) close(); });
    overlay.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
    });
    return true;
  }

  function open(options) {
    if (!overlay && !build()) return false;
    opts = options || {};
    if (method && opts.methods && opts.methods.length) {
      Array.prototype.forEach.call(method.options, function (option) {
        option.hidden = opts.methods.indexOf(option.value) < 0;
      });
      if (opts.methods.indexOf(method.value) < 0) method.value = opts.methods[0];
    }
    if (count) count.value = String(opts.defaultCount || 8);
    colors = null;
    currentImage = null;
    currentName = '';
    drawPreview();
    setError('');
    if (importBtn) importBtn.disabled = true;
    if (sourceLine) sourceLine.textContent = '';
    if (global.DitherPalette && global.DitherPalette.isOpen && global.DitherPalette.isOpen()) global.DitherPalette.close();
    if (global.DitherPaletteImport && global.DitherPaletteImport.isOpen && global.DitherPaletteImport.isOpen()) global.DitherPaletteImport.close();
    overlay.hidden = false;
    restoreFocus = document.activeElement;
    global.requestAnimationFrame(function () { overlay.classList.add('is-in'); });
    return true;
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove('is-in');
    overlay.hidden = true;
    if (restoreFocus && restoreFocus.focus) {
      try { restoreFocus.focus(); } catch (err) { /* the control may be gone */ }
    }
    restoreFocus = null;
  }

  function isOpen() { return !!overlay && !overlay.hidden; }

  global.DitherInkExtractor = { open: open, close: close, isOpen: isOpen };
}(typeof window !== 'undefined' ? window : globalThis));