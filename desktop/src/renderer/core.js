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

  // ---- palette extraction (Ink Extractor) ----

  // A palette extracted from a photograph should look like it came off old
  // hardware, not like a colour picker. These routines sample the image,
  // cluster it and then nudge the result towards saturation and contrast.
  // They are pure and DOM-free so `node tools/core.test.js` can cover them.
  const EXTRACT_METHODS = ['cins', 'median', 'octree', 'polarity'];

  function extractSample(data, width, height, limit) {
    const total = Math.max(1, width * height);
    const step = Math.max(1, Math.floor(Math.sqrt(total / Math.max(1, limit))));
    const out = [];
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const p = (y * width + x) * 4;
        if (data[p + 3] === 0) continue;
        out.push([data[p], data[p + 1], data[p + 2]]);
        if (out.length >= limit) return out;
      }
    }
    return out;
  }

  function lumaOf(rgb) {
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  }

  function colourDistance(a, b) {
    const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
    return dr * dr + dg * dg + db * db;
  }

  function averageColour(pixels) {
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < pixels.length; i++) {
      r += pixels[i][0]; g += pixels[i][1]; b += pixels[i][2];
    }
    const n = Math.max(1, pixels.length);
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  }

  function medianCut(pixels, count) {
    let boxes = [pixels.slice()];
    while (boxes.length < count) {
      let best = -1, bestScore = -1, bestChannel = 0;
      boxes.forEach(function (box, index) {
        if (box.length < 2) return;
        let min = [255, 255, 255], max = [0, 0, 0];
        box.forEach(function (c) {
          for (let k = 0; k < 3; k++) {
            if (c[k] < min[k]) min[k] = c[k];
            if (c[k] > max[k]) max[k] = c[k];
          }
        });
        const ranges = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
        const channel = ranges.indexOf(Math.max(ranges[0], ranges[1], ranges[2]));
        const score = ranges[channel] * Math.sqrt(box.length);
        if (score > bestScore) { bestScore = score; best = index; bestChannel = channel; }
      });
      if (best < 0 || bestScore <= 0) break;
      const box = boxes[best].slice().sort(function (a, b) { return a[bestChannel] - b[bestChannel]; });
      const mid = Math.floor(box.length / 2);
      boxes.splice(best, 1, box.slice(0, mid), box.slice(mid));
    }
    return boxes.filter(function (box) { return box.length; }).map(averageColour);
  }

  // Octree in spirit: a 4-bit RGB histogram, ranked by population, with a
  // minimum separation so eight near-identical browns do not fill the palette.
  function octreeCut(pixels, count) {
    const bins = new Map();
    pixels.forEach(function (c) {
      const key = ((c[0] >> 4) << 8) | ((c[1] >> 4) << 4) | (c[2] >> 4);
      let bin = bins.get(key);
      if (!bin) { bin = { count: 0, r: 0, g: 0, b: 0 }; bins.set(key, bin); }
      bin.count++; bin.r += c[0]; bin.g += c[1]; bin.b += c[2];
    });
    const ranked = Array.from(bins.values()).sort(function (a, b) { return b.count - a.count; });
    const out = [];
    ranked.forEach(function (bin) {
      if (out.length >= count) return;
      const c = [Math.round(bin.r / bin.count), Math.round(bin.g / bin.count), Math.round(bin.b / bin.count)];
      if (out.every(function (seen) { return colourDistance(seen, c) >= 18 * 18; })) out.push(c);
    });
    return out;
  }

  function polarityCut(pixels, count) {
    const sorted = pixels.slice().sort(function (a, b) { return lumaOf(a) - lumaOf(b); });
    const out = [];
    for (let i = 0; i < count; i++) {
      const at = count === 1 ? 0 : Math.round((i / (count - 1)) * (sorted.length - 1));
      out.push(sorted[Math.max(0, Math.min(sorted.length - 1, at))]);
    }
    // A polarity palette also keeps the loudest colour in the frame: the one
    // accent that makes a limited palette read as a designed set.
    let accent = pixels[0] || [0, 0, 0];
    let accentScore = -1;
    pixels.forEach(function (c) {
      const max = Math.max(c[0], c[1], c[2]), min = Math.min(c[0], c[1], c[2]);
      const score = (max - min) * (0.4 + lumaOf(c) / 255);
      if (score > accentScore) { accentScore = score; accent = c; }
    });
    out.push(accent);
    return out;
  }

  function retroBoost(rgb, saturation, contrast) {
    const l = lumaOf(rgb);
    return [0, 1, 2].map(function (i) {
      const sat = l + (rgb[i] - l) * saturation;
      return clampByte((sat - 128) * contrast + 128);
    });
  }

  function uniqueColours(colors, minDistance) {
    const out = [];
    colors.forEach(function (c) {
      const rgb = [clampByte(c[0]), clampByte(c[1]), clampByte(c[2])];
      if (out.every(function (seen) { return colourDistance(seen, rgb) >= minDistance * minDistance; })) out.push(rgb);
    });
    return out;
  }

  function extractPalette(data, width, height, count, method) {
    const wanted = Math.max(2, Math.min(32, Math.round(Number(count) || 8)));
    const how = EXTRACT_METHODS.indexOf(method) >= 0 ? method : 'cins';
    if (!data || width < 1 || height < 1) throw new Error('An image is needed to extract a palette');
    const pixels = extractSample(data, width, height, 24000);
    if (pixels.length < 2) throw new Error('That image does not have enough visible pixels');
    let colors;
    if (how === 'octree') colors = octreeCut(pixels, wanted);
    else if (how === 'median') colors = medianCut(pixels, wanted);
    else if (how === 'polarity') colors = polarityCut(pixels, wanted);
    else colors = medianCut(pixels.map(function (c) { return retroBoost(c, 1.3, 1.08); }), wanted);
    colors = uniqueColours(colors, 10);
    if (colors.length < 2) {
      colors = uniqueColours(colors.concat([[0, 0, 0], [255, 255, 255]]), 1);
    }
    colors.sort(function (a, b) { return lumaOf(a) - lumaOf(b); });
    return colors.slice(0, wanted);
  }

  // ---- plugin packages ----

  // A plugin is a signed-by-nobody data package: metadata plus a declarative
  // payload. There is no `main`, no `eval` and no code path that could run one.
  // Validation is strict for the fields the app consumes, and drops everything
  // else, so a package cannot smuggle settings into a prototype or a DOM call.
  const PLUGIN_KINDS = ['tool', 'preset-pack'];
  const PLUGIN_CAPABILITIES = ['ink-extractor', 'shape-press'];
  const EXTRACT_LABELS = { cins: 'CINS', median: 'Median cut', octree: 'Octree', polarity: 'Polarity' };

  function pluginSlug(value) {
    return /^[a-z][a-z0-9-]{1,47}$/.test(String(value || ''));
  }

  function validatePluginPackage(pkg) {
    if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) throw new Error('A plugin must be a JSON object');
    if (pkg.schema !== 1) throw new Error('Unsupported plugin schema');
    if (!pluginSlug(pkg.id)) throw new Error('A plugin id must be lower-case letters, numbers and hyphens');
    if (typeof pkg.name !== 'string' || !pkg.name.trim() || pkg.name.length > 60) throw new Error('A plugin needs a name');
    if (!/^\d+\.\d+\.\d+$/.test(String(pkg.version || ''))) throw new Error('A plugin version must look like 1.0.0');
    if (PLUGIN_KINDS.indexOf(pkg.kind) < 0) throw new Error('Unknown plugin kind');
    if (typeof pkg.summary !== 'string' || pkg.summary.length > 240) throw new Error('A plugin needs a summary of 240 characters or fewer');
    const out = {
      schema: 1,
      id: pkg.id,
      name: pkg.name.trim(),
      version: pkg.version,
      kind: pkg.kind,
      summary: pkg.summary,
      author: typeof pkg.author === 'string' ? pkg.author.slice(0, 60) : 'Unknown',
      homepage: typeof pkg.homepage === 'string' && /^https?:\/\//.test(pkg.homepage) ? pkg.homepage.slice(0, 300) : '',
      data: {},
    };
    if (pkg.kind === 'tool') {
      if (PLUGIN_CAPABILITIES.indexOf(pkg.capability) < 0) throw new Error('Unknown plugin capability');
      out.capability = pkg.capability;
      if (pkg.data && typeof pkg.data === 'object') {
        if (Array.isArray(pkg.data.methods)) {
          out.data.methods = pkg.data.methods.filter(function (m) { return EXTRACT_METHODS.indexOf(m) >= 0; });
        }
        if (pkg.data.defaultCount) out.data.defaultCount = Math.max(2, Math.min(32, Math.round(pkg.data.defaultCount)));
      }
      return out;
    }
    if (!pkg.data || !Array.isArray(pkg.data.presets) || !pkg.data.presets.length || pkg.data.presets.length > 24) {
      throw new Error('A preset pack needs 1–24 presets');
    }
    out.data.presets = pkg.data.presets.map(function (preset, index) {
      if (!preset || typeof preset !== 'object') throw new Error('Preset ' + (index + 1) + ' is not an object');
      if (!pluginSlug(preset.id)) throw new Error('Preset ' + (index + 1) + ' needs a lower-case id');
      if (typeof preset.name !== 'string' || !preset.name.trim() || preset.name.length > 60) throw new Error('Preset ' + (index + 1) + ' needs a name');
      if (!preset.settings || typeof preset.settings !== 'object' || Array.isArray(preset.settings)) {
        throw new Error('Preset ' + (index + 1) + ' needs a settings object');
      }
      let settings;
      try { settings = JSON.parse(JSON.stringify(preset.settings)); }
      catch (err) { throw new Error('Preset ' + (index + 1) + ' has settings that cannot be stored'); }
      return { id: preset.id, name: preset.name.trim(), settings: settings };
    });
    return out;
  }

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
    extractPalette: extractPalette,
    EXTRACT_METHODS: EXTRACT_METHODS,
    EXTRACT_LABELS: EXTRACT_LABELS,
    validatePluginPackage: validatePluginPackage,
    PLUGIN_KINDS: PLUGIN_KINDS,
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
