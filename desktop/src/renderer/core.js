/* core.js - the desktop core: the helpers the desktop shell shares with
 * itself.
 *
 *   colour      clampByte, rgbToHex, hexToRgb      (#rrggbb <-> three bytes)
 *   catalogues  byId, indexOfId, stepThrough        (every list is [{ id }])
 *   settings    getPath, setPath                    ("adjustments.contrast")
 *   the rail    buildSelect, summarise, setNote, shortPalette
 *
 * Nothing here holds app state or touches the DOM at load, so the same file
 * runs in the window (as `DitherCore`) and in Node (`node tools/core.test.js`).
 */
(function (global) {
  'use strict';

  // ---- colour ----

  // One channel, clamped: a stray value can never print `#-1` or a
  // four-digit channel.
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
  // while they are being typed into, so a half-finished colour must not
  // break a render.
  function hexToRgb(hex) {
    const digits = /^#?([0-9a-f]{6})$/i.exec(String(hex));
    if (!digits) return [0, 0, 0];
    return [0, 2, 4].map(function (at) { return parseInt(digits[1].substr(at, 2), 16); });
  }

  // ---- palette import ----

  // A palette file is either JSON or a list of hex colours. Both are read into
  // the same `{ name, colors }` shape here, so the import window and the tests
  // agree about what a valid palette is. The parser is strict about channels
  // and counts but forgiving about separators: a Lospec export, a hand-written
  // array and a column of `#rrggbb` lines all arrive at the same place.
  const HEX_COLOUR = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

  function parseHexColour(value) {
    const match = HEX_COLOUR.exec(String(value).trim());
    if (!match) return null;
    let digits = match[1];
    if (digits.length === 3) {
      digits = digits[0] + digits[0] + digits[1] + digits[1] + digits[2] + digits[2];
    }
    return [0, 2, 4].map(function (at) { return parseInt(digits.substr(at, 2), 16); });
  }

  function parseSingleColour(value) {
    if (Array.isArray(value)) {
      if (value.length < 3) throw new Error('Every colour needs three channels');
      return value.slice(0, 3).map(function (channel) {
        const number = Number(channel);
        if (!Number.isInteger(number) || number < 0 || number > 255) {
          throw new Error('Colour channels must be whole numbers from 0 to 255');
        }
        return number;
      });
    }
    if (value && typeof value === 'object') {
      if (typeof value.hex === 'string') return parseSingleColour(value.hex);
      if (typeof value.color === 'string') return parseSingleColour(value.color);
      if (typeof value.colour === 'string') return parseSingleColour(value.colour);
      if (Array.isArray(value.rgb)) return parseSingleColour(value.rgb);
      throw new Error('A colour object needs a hex value or an rgb triple');
    }
    if (typeof value === 'string') {
      const rgb = parseHexColour(value);
      if (!rgb) throw new Error('“' + value.trim() + '” is not a hex colour');
      return rgb;
    }
    throw new Error('A colour must be a hex string, an rgb triple or a colour object');
  }

  function parseColourValue(value) {
    if (typeof value !== 'string') return [parseSingleColour(value)];
    const tokens = value.trim().split(/[\s,;]+/).filter(Boolean);
    if (!tokens.length) throw new Error('A colour string cannot be empty');
    return tokens.map(function (token) {
      const rgb = parseHexColour(token);
      if (!rgb) throw new Error('“' + token + '” is not a hex colour');
      return rgb;
    });
  }

  function flattenPaletteColours(list) {
    const out = [];
    list.forEach(function (item) {
      parseColourValue(item).forEach(function (rgb) { out.push(rgb); });
    });
    return out;
  }

  function cleanPaletteName(value, fallback) {
    const cleaned = String(value == null ? '' : value)
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60);
    return cleaned || String(fallback || '').trim().slice(0, 60) || 'Imported palette';
  }

  function uniquePaletteColours(colors) {
    const out = [];
    colors.forEach(function (rgb) {
      if (!out.some(function (seen) {
        return seen[0] === rgb[0] && seen[1] === rgb[1] && seen[2] === rgb[2];
      })) out.push(rgb);
    });
    return out;
  }

  function parsePaletteText(text, fallbackName) {
    const source = String(text == null ? '' : text).trim();
    if (!source) throw new Error('Paste a palette or choose a file first');

    let name = '';
    let list = null;
    if (source[0] === '[' || source[0] === '{') {
      let data;
      try {
        data = JSON.parse(source);
      } catch (err) {
        throw new Error('That JSON could not be read: ' + (err && err.message ? err.message : 'invalid JSON'));
      }
      if (Array.isArray(data)) {
        list = data;
      } else if (data && typeof data === 'object') {
        name = typeof data.name === 'string' ? data.name
          : typeof data.title === 'string' ? data.title
            : '';
        if (Array.isArray(data.colors)) list = data.colors;
        else if (Array.isArray(data.palette)) list = data.palette;
        else if (Array.isArray(data.swatches)) list = data.swatches;
        else if (typeof data.colors === 'string') list = [data.colors];
        else throw new Error('A JSON palette needs a colors array');
      } else {
        throw new Error('A JSON palette must be an array or an object with a colors array');
      }
    } else {
      const tokens = source.split(/[\s,;]+/).filter(Boolean);
      list = tokens;
    }

    if (!list || !list.length) throw new Error('A palette needs at least two colours');
    const colors = uniquePaletteColours(flattenPaletteColours(list));
    if (colors.length < 2) throw new Error('A palette needs at least two different colours');
    if (colors.length > 64) throw new Error('A palette can hold at most 64 colours');
    return { name: cleanPaletteName(name, fallbackName), colors: colors };
  }

  // A readable name becomes a stable, URL-ish id; the caller supplies the ids
  // already in use so an import can never shadow one of them.
  function paletteId(name, taken) {
    const base = 'custom-' + String(name || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40).replace(/-+$/, '');
    const stem = base === 'custom-' ? 'custom-palette' : base;
    const used = {};
    (taken || []).forEach(function (id) { used[id] = true; });
    let id = stem;
    let number = 2;
    while (used[id]) id = stem + '-' + (number++);
    return id;
  }

  // ---- catalogues ----

  // Every catalogue in the app is `[{ id, ... }]` and every lookup is the
  // same scan. The shell carried seven copies of it; these are the scan, once.
  function byId(list, id) {
    return list.find(function (entry) { return entry.id === id; });
  }

  function indexOfId(list, id) {
    return list.findIndex(function (entry) { return entry.id === id; });
  }

  // The arrow steppers walk one catalogue; the algorithm and the palette
  // step are the same walk over a different list. Nothing selected (-1) starts
  // at the first entry rather than wrapping backwards out of the list.
  function stepThrough(list, current, delta) {
    const at = Math.max(0, indexOfId(list, current));
    return list[(at + delta + list.length) % list.length];
  }

  // ---- settings paths ----

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

  // ---- the rail ----

  // Every `<select>` in the console is built here. `spec.label` names an
  // entry, `spec.group` (the algorithm picker is the only one) splits them
  // into optgroups, and `spec.placeholder` prepends the empty first row a
  // picker needs. Options and groups keep catalogue order, and a group that
  // recurs later joins the group already on screen.
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

  // "C64 · 16c": the palette without its parenthetical, plus its ink count.
  function shortPalette(palette) {
    return palette.name.replace(/\s*\(.*?\)/, '') + ' · ' + palette.colors.length + 'c';
  }

  const Core = {
    clampByte: clampByte,
    rgbToHex: rgbToHex,
    hexToRgb: hexToRgb,
    parsePaletteText: parsePaletteText,
    paletteId: paletteId,
    cleanPaletteName: cleanPaletteName,
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
