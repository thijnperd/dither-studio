/* core.js — the desktop core, v2.
 *
 * The desktop shell used to be the web shell with ten patches applied, so every
 * helper below existed twice: once in the shared shell and once in the copy the
 * desktop actually runs. This file is the desktop's own core instead — one
 * version of each idea, written as a set rather than as five near-copies.
 *
 *   colour      clampByte, rgbToHex, hexToRgb      (#rrggbb ↔ three bytes)
 *   catalogues  byId, indexOfId, stepThrough        (every list is [{ id }])
 *   settings    getPath, setPath                    ("adjustments.contrast")
 *   the rail    buildSelect, summarise, setNote, shortPalette
 *
 * Nothing here holds app state or touches the DOM at load, so the same file runs
 * in the window (as `DitherCore`) and in Node (`node tools/core.test.js`).
 */
(function (global) {
  'use strict';

  /* ---- colour ---------------------------------------------------------- */

  // One channel, clamped: a stray value can never print `#-1` or a four-digit
  // channel, which is the only reason the old pair needed a nested helper.
  function clampByte(value) {
    return Math.max(0, Math.min(255, Math.round(value || 0)));
  }

  // The round trip, both ways, in one place: three bytes in, `#rrggbb` out.
  function rgbToHex(rgb) {
    return '#' + [rgb[0], rgb[1], rgb[2]].map(function (v) {
      return clampByte(v).toString(16).padStart(2, '0');
    }).join('');
  }

  // Unreadable input is black rather than a throw: the ink pickers feed this
  // while they are being typed into, so a half-finished colour must not break
  // a render.
  function hexToRgb(hex) {
    const digits = /^#?([0-9a-f]{6})$/i.exec(String(hex));
    if (!digits) return [0, 0, 0];
    return [0, 2, 4].map(function (at) { return parseInt(digits[1].substr(at, 2), 16); });
  }

  /* ---- catalogues ------------------------------------------------------ */

  // Every catalogue in the app is `[{ id, ... }]`, and every lookup is the same
  // scan. The shell carried seven copies of it; these are the scan, once.
  function byId(list, id) {
    return list.find(function (entry) { return entry.id === id; });
  }

  function indexOfId(list, id) {
    return list.findIndex(function (entry) { return entry.id === id; });
  }

  // The arrow steppers walk one catalogue, and the algorithm and the palette
  // step are the same walk over a different list. Nothing selected (-1) starts
  // at the first entry rather than wrapping backwards out of the list.
  function stepThrough(list, current, delta) {
    const at = Math.max(0, indexOfId(list, current));
    return list[(at + delta + list.length) % list.length];
  }

  /* ---- settings paths -------------------------------------------------- */

  // The rail describes every control as a path ("adjustments.contrast"), which
  // is what lets one binding list drive both reading and writing.
  function getPath(obj, path) {
    return path.split('.').reduce(function (value, key) { return value[key]; }, obj);
  }

  function setPath(obj, path, value) {
    const parts = path.split('.');
    const leaf = parts.pop();
    parts.reduce(function (target, key) { return target[key]; }, obj)[leaf] = value;
  }

  /* ---- the rail -------------------------------------------------------- */

  // Every `<select>` in the console is built here. `spec.label` names an entry,
  // `spec.group` (the algorithm picker is the only one) splits them into
  // optgroups, and `spec.placeholder` prepends the empty first row a picker
  // needs. Options and groups keep catalogue order, and a group that recurs
  // later in the list joins the group already on screen.
  function buildSelect(node, entries, spec) {
    const want = spec || {};
    const label = want.label || function (entry) { return entry.name || entry.id; };
    if (want.placeholder) {
      const blank = document.createElement('option');
      blank.value = '';
      blank.textContent = want.placeholder;
      node.appendChild(blank);
    }
    const groups = {};
    entries.forEach(function (entry) {
      let host = node;
      const name = want.group ? want.group(entry) : '';
      if (name) {
        if (!groups[name]) {
          groups[name] = document.createElement('optgroup');
          groups[name].label = name;
          node.appendChild(groups[name]);
        }
        host = groups[name];
      }
      const option = document.createElement('option');
      option.value = entry.id;
      option.textContent = label(entry);
      host.appendChild(option);
    });
    return node;
  }

  // A station's one-line summary is always "the parts that are not the default,
  // joined", or a word for nothing set.
  function summarise(parts, fallback) {
    return parts.length ? parts.join(' · ') : fallback;
  }

  function setNote(node, value) {
    if (node) node.textContent = value;
  }

  // "C64 · 16c" — the palette without its parenthetical, plus its ink count.
  function shortPalette(palette) {
    return palette.name.replace(/\s*\(.*?\)/, '') + ' · ' + palette.colors.length + 'c';
  }

  const Core = {
    clampByte: clampByte,
    rgbToHex: rgbToHex,
    hexToRgb: hexToRgb,
    byId: byId,
    indexOfId: indexOfId,
    stepThrough: stepThrough,
    getPath: getPath,
    setPath: setPath,
    buildSelect: buildSelect,
    summarise: summarise,
    setNote: setNote,
    shortPalette: shortPalette,
  };

  global.DitherCore = Core;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Core;
  }
})(typeof window !== 'undefined' ? window : globalThis);
