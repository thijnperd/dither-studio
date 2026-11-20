/* app.js - the desktop shell for Dither Studio.
 *
 * Loads after `core.js` (the desktop core: colour, catalogue lookups, the
 * rail's dropdowns, the settings paths) and after `dither.js` (the engine).
 * Anything this shell needs more than once lives in one of those two.
 *
 * The canvas backing store is one pixel per working pixel; zoom is CSS only
 * (`image-rendering: pixelated`), so a render is a single putImageData.
 *
 * Cost control (DESIGN.md performance clause):
 *   - the working image is capped at MAX_SOURCE on its longest side;
 *   - dragging a slider renders a half-resolution preview on the next frame;
 *   - the full-quality pass only runs when the control is released.
 *
 * Responsive the house way - contraction, not a redesign: the stylesheet
 * thins the rail for a coarse pointer, and under 720px the rail collapses
 * into one bar whose state is held here (initConsole), while the canvas
 * takes over pan and pinch itself.
 */

(function () {
  'use strict';

  const D = window.DitherLib;
  const Layers = window.DitherLayers || null;
  const MAX_SOURCE = 1600;
  const PREVIEW_SCALE = 0.5;
  const ZOOM_STEPS = [1, 2, 3, 4, 6, 8];
  // Pinch-zoom walks its own, finer ladder: a pinch is a continuous gesture,
  // but the readout still has to say a value a button could have produced.
  const PINCH_ZOOM = [0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8];
  const MONO_STACK = '"SF Mono", "Cascadia Code", Consolas, "JetBrains Mono", Menlo, monospace';

  const $ = function (id) { return document.getElementById(id); };

  // The desktop build has a native bridge (electron/preload.js); the browser
  // build does not. Every use below is guarded, so this one constant is the
  // whole difference between the two.
  const desktop = window.ditherDesktop || null;

  // The desktop core (renderer/core.js): the helpers this file would
  // otherwise carry its own copies of.
  const Core = window.DitherCore;
  if (!Core) throw new Error('renderer/core.js must load before renderer/app.js');
  const rgbToHex = Core.rgbToHex;
  const hexToRgb = Core.hexToRgb;
  const byId = Core.byId;
  const stepThrough = Core.stepThrough;
  const getPath = Core.getPath;
  const setPath = Core.setPath;
  const buildSelect = Core.buildSelect;
  const summarise = Core.summarise;
  const setNote = Core.setNote;
  const shortPalette = Core.shortPalette;

  // The checkerboard under the proof is only honest while the alpha is kept,
  // so one place decides it.
  function showAlphaBehind(alphaMode) {
    el.canvas.classList.toggle('alpha-on', alphaMode !== 'matte');
  }

  const el = {
    open: $('open'), file: $('file'),
    sample: $('sample'), samplePrev: $('sample-prev'), sampleNext: $('sample-next'),
    sampleStrip: $('sample-strip'),
    algorithm: $('algorithm'), palette: $('palette'),
    algorithmPrev: $('algorithm-prev'), algorithmNext: $('algorithm-next'),
    palettePrev: $('palette-prev'), paletteNext: $('palette-next'),
    swatches: $('swatches'),
    pixelSize: $('pixel-size'), pixelSizeValue: $('pixel-size-value'),
    threshold: $('threshold'), thresholdValue: $('threshold-value'), thresholdRow: $('threshold-row'),
    strength: $('strength'), strengthValue: $('strength-value'),
    serpentine: $('serpentine'),
    seed: $('seed'), reseed: $('reseed'),
    smooth: $('smooth'), smoothValue: $('smooth-value'), smoothRow: $('smooth-row'),
    flow: $('flow'), flowValue: $('flow-value'), flowRow: $('flow-row'),
    streak: $('streak'), streakValue: $('streak-value'), streakRow: $('streak-row'),
    black: $('black'), blackValue: $('black-value'),
    white: $('white'), whiteValue: $('white-value'),
    gamma: $('gamma'), gammaValue: $('gamma-value'),
    toneMap: $('tone-map'), toneInk: $('tone-ink'), tonePaper: $('tone-paper'), inkCustom: $('ink-custom'),
    alphaMode: $('alpha-mode'),
    textMode: $('text-mode'), textCharset: $('text-charset'), textCharsetRow: $('text-charset-row'),
    textSize: $('text-size'), textSizeValue: $('text-size-value'), textSizeRow: $('text-size-row'),
    textExportRow: $('text-export-row'), exportTxt: $('export-txt'),
    random: $('random'), copy: $('copy'),
    brightness: $('brightness'), brightnessValue: $('brightness-value'),
    contrast: $('contrast'), contrastValue: $('contrast-value'),
    saturation: $('saturation'), saturationValue: $('saturation-value'),
    hue: $('hue'), hueValue: $('hue-value'),
    blur: $('blur'), blurValue: $('blur-value'),
    sharpen: $('sharpen'), sharpenValue: $('sharpen-value'),
    denoise: $('denoise'),
    effectList: $('effect-list'), effectAdd: $('effect-add'),
    glowRadius: $('glow-radius'), glowRadiusValue: $('glow-radius-value'),
    glowIntensity: $('glow-intensity'), glowIntensityValue: $('glow-intensity-value'),
    preset: $('preset'), presetExport: $('preset-export'), presetImport: $('preset-import'), presetFile: $('preset-file'),
    statFile: $('stat-file'), statSize: $('stat-size'), statAlgorithm: $('stat-algorithm'),
    statPalette: $('stat-palette'), statColors: $('stat-colors'), statRender: $('stat-render'),
    statStatus: $('stat-status'), statZoom: $('stat-zoom'),
    zoomOut: $('zoom-out'), zoomFit: $('zoom-fit'), zoomIn: $('zoom-in'), zoomToggle: $('zoom-toggle'),
    undoBtn: $('undo-btn'), redoBtn: $('redo-btn'),
    compare: $('compare'),
    split: $('split'), splitLayer: $('split-layer'), splitGrip: $('split-grip'), splitBadges: $('split-badges'),
    toneReset: $('tone-reset'), detailReset: $('detail-reset'), glowReset: $('glow-reset'),
    effectsClearBtn: $('effects-clear-btn'), dockResizer: $('dock-resizer'),
    exportScale: $('export-scale'), export: $('export'),
    videoWebcam: $('video-webcam'), videoOpen: $('video-open'), videoFile: $('video-file'),
    videoToggle: $('video-toggle'), videoFps: $('video-fps'), videoFpsValue: $('video-fps-value'),
    videoFpsRow: $('video-fps-row'), videoTemporal: $('video-temporal'),
    videoTemporalRow: $('video-temporal-row'), videoRecord: $('video-record'),
    videoRecordRow: $('video-record-row'), videoNote: $('video-note'),
    wrap: $('canvas-wrap'), canvas: $('canvas'),
    // rail navigation and the viewport bar
    rail: $('rail'), jump: $('jump'),
    // the console bar: only the web build has one (the desktop shell draws its
    // own chrome), so every use of these is guarded.
    panel: $('panel'), consoleToggle: $('console-toggle'), consoleToggleNote: $('console-toggle-note'),
    quality: $('quality'), qualityNote: $('quality-note'),
    transport: $('transport'), videoReadout: $('video-readout'),
    noteLearn: $('note-learn'),
    noteSource: $('note-source'), noteLayers: $('note-layers'), notePress: $('note-press'), noteTone: $('note-tone'),
    noteInk: $('note-ink'), noteDetail: $('note-detail'), noteEffects: $('note-effects'),
    noteGlow: $('note-glow'), noteMotion: $('note-motion'), noteType: $('note-type'),
    notePreset: $('note-preset'),
    layersEnabled: $('layers-enabled'), layersShowMask: $('layers-show-mask'),
    layersDetect: $('layers-detect'), layersPick: $('layers-pick'),
    layersFill: $('layers-fill'),
    layersBrush: $('layers-brush'), layersErase: $('layers-erase'),
    layersTolerance: $('layers-tolerance'), layersToleranceValue: $('layers-tolerance-value'),
    layersFeather: $('layers-feather'), layersFeatherValue: $('layers-feather-value'),
    layersBrushSize: $('layers-brush-size'), layersBrushSizeValue: $('layers-brush-size-value'),
    layersContiguous: $('layers-contiguous'),
    layersList: $('layers-list'), layersActiveBox: $('layers-active-box'),
    layersOpacity: $('layers-opacity'), layersOpacityValue: $('layers-opacity-value'),
    layersInvert: $('layers-invert'),
    layersFillHoles: $('layers-fill-holes'), layersFillAll: $('layers-fill-all'),
    layersClearMask: $('layers-clear-mask'),
    layersAdd: $('layers-add'), layersPostFx: $('layers-post-fx'), layersClear: $('layers-clear'),
    pressLayerBanner: $('press-layer-banner'), pressLayerName: $('press-layer-name'),
    pressLayerJump: $('press-layer-jump'),
    effectsLayerBanner: $('effects-layer-banner'), effectsLayerName: $('effects-layer-name'),
    effectsLayerPost: $('effects-layer-post'),
  };

  const ctx = el.canvas.getContext('2d', { willReadFrequently: true });
  const buffer = document.createElement('canvas');
  const bufferCtx = buffer.getContext('2d', { willReadFrequently: true });

  // The rail's stations: every panel group is collapsible, and the chips above
  // the rail scroll to one. Order here is the order of the jump strip.
  const GROUPS = [
    // The tutorial is first because it is the way in: every panel below
    // explains itself once you know what the station is for.
    { id: 'learn', name: 'Learn' },
    { id: 'source', name: 'Source' },
    { id: 'layers', name: 'Layers' },
    { id: 'press', name: 'Press' },
    { id: 'tone', name: 'Tone' },
    { id: 'ink', name: 'Ink' },
    { id: 'detail', name: 'Detail' },
    { id: 'effects', name: 'Effects' },
    { id: 'glow', name: 'Glow' },
    { id: 'motion', name: 'Motion' },
    { id: 'type', name: 'Type' },
    { id: 'preset', name: 'Presets' },
  ];
  const GROUP_STORE = 'dither-studio.groups';
  const PALETTE_STORE = 'dither-studio.palettes';

  const state = {
    source: null,       // { data, width, height } at working resolution
    sourceSeq: 0,       // incremented whenever a new source image loads
    original: null,     // ImageData of the working source, for compare
    preview: null,      // half-resolution { data, width, height }
    name: 'untitled',
    result: null,       // last full-resolution result
    settings: D.mergeSettings(D.DEFAULTS),
    zoom: null,         // null = fit, otherwise a scale
    panning: null,
    rafPending: false,
    videoOn: false,     // frames come from video.js rather than a still image
    quality: 'live',    // 'full' | 'live' | 'still' — the viewport update mode
    splitOn: false,     // source on the left of a draggable divider, proof on the right
    splitAt: 0.5,
    pickingOrigin: null, // effect id when placing an origin point on the proof
  };

  // Multi-layer & object detection state. Each layer owns a full merged
  // settings object (algorithm, palette, tone, detail, effects, glow) so the
  // existing stations edit whichever layer is active, and each object layer
  // composites over the base layer through its own soft mask.
  const layerState = {
    enabled: false,
    showMask: true,
    tool: null,           // null | 'pick' | 'fill' | 'brush' | 'erase'
    tolerance: 34,
    feather: 2,
    brushSize: 28,
    contiguous: true,
    activeId: 'base',
    nextId: 1,
    items: [],
    post: {
      id: 'post',
      name: 'Full image (after masks)',
      isPost: true,
      visible: true,
      settings: D.mergeSettings({ glitches: [], glow: { radius: 0, intensity: 0 } }),
    },
    cache: new Map(),     // layer.id -> { key, res }
    maskCache: new Map(), // layer.id -> { key, mask }
  };

  // A bounded snapshot history for the recipe itself. Loading a new source
  // starts a fresh timeline: undo is for tuning the press, not for swapping
  // the painting underneath it. Slider drags coalesce into one entry, so one
  // undo puts the control back where it was before the drag.
  const history = {
    past: [],
    future: [],
    suspended: false,
    group: null,
    seq: 0,
    lastKey: '',
    limit: 80,
  };

  function historySnapshot() {
    return {
      settings: JSON.parse(JSON.stringify(state.settings)),
      text: { on: !!text.on, ramp: text.ramp, size: text.size },
    };
  }

  function syncHistoryButtons() {
    if (el.undoBtn) el.undoBtn.disabled = history.past.length < 2;
    if (el.redoBtn) el.redoBtn.disabled = history.future.length === 0;
  }

  function resetHistory() {
    state.settings.glitches = deriveGlitches();
    const snap = historySnapshot();
    history.past = [{ snap: snap, group: null }];
    history.future = [];
    history.suspended = false;
    history.group = null;
    history.lastKey = JSON.stringify(snap);
    syncHistoryButtons();
  }

  function beginHistoryGroup(name) {
    if (!history.group) history.group = name + ':' + (++history.seq);
  }

  function endHistoryGroup() {
    history.group = null;
  }

  function recordHistory() {
    if (history.suspended || state.videoOn || !state.source) return;
    const snap = historySnapshot();
    const key = JSON.stringify(snap);
    if (key === history.lastKey) return;
    const entry = { snap: snap, group: history.group };
    const last = history.past[history.past.length - 1];
    if (history.group && last && last.group === history.group) {
      history.past[history.past.length - 1] = entry;
    } else {
      history.past.push(entry);
    }
    history.lastKey = key;
    history.future = [];
    if (history.past.length > history.limit) history.past.shift();
    syncHistoryButtons();
  }

  function restoreHistory(snap) {
    history.suspended = true;
    state.settings = D.mergeSettings(snap.settings);
    readGlitchState(state.settings.glitches);
    text.on = !!snap.text.on;
    text.ramp = snap.text.ramp || 'ascii';
    text.size = snap.text.size || 10;
    syncUI();
    render(true);
    history.lastKey = JSON.stringify(historySnapshot());
    history.suspended = false;
    syncHistoryButtons();
  }

  function undoRecipe() {
    if (history.past.length < 2) {
      el.statStatus.textContent = 'Nothing to undo';
      return false;
    }
    history.future.push(history.past.pop());
    restoreHistory(history.past[history.past.length - 1].snap);
    el.statStatus.textContent = 'Undid a recipe change';
    return true;
  }

  function redoRecipe() {
    if (!history.future.length) {
      el.statStatus.textContent = 'Nothing to redo';
      return false;
    }
    const entry = history.future.pop();
    history.past.push(entry);
    restoreHistory(entry.snap);
    el.statStatus.textContent = 'Redid a recipe change';
    return true;
  }

  // The glitch stack lives in the panel as a reorderable list, so the UI state
  // is the order plus a per-effect switch and amount.
  const glitches = {
    order: D.GLITCHES.map(function (g) { return g.id; }),
    on: {},
    amount: {},
    mode: {},
    origin: {},
  };
  D.GLITCHES.forEach(function (g) {
    glitches.on[g.id] = false;
    glitches.amount[g.id] = 50;
    glitches.mode[g.id] = g.modes ? g.modes[0].id : undefined;
    if (g.origin) glitches.origin[g.id] = { x: g.origin.x, y: g.origin.y };
  });

  // Character ramps for text mode, darkest first. Kept here rather than in the
  // core: the core prints pixels, the shell picks the type.
  const TEXT_RAMPS = [
    { id: 'ascii', name: 'ASCII  ·  .:-=+*#%@', chars: ' .:-=+*#%@' },
    { id: 'blocks', name: 'Blocks · ░▒▓█', chars: ' ░▒▓█' },
    { id: 'shades', name: 'Shades · .·:;+=xX$@', chars: ' .·:;+=xX$@' },
    { id: 'hex', name: 'Hex · 0123456789ABCDEF', chars: '0123456789ABCDEF' },
    { id: 'binary', name: 'Binary · .01', chars: ' .01' },
  ];
  const TEXT_CELL_CAP = 30000;   // fillText calls per frame; above this, text mode is off

  const text = { on: false, ramp: 'ascii', size: 10 };

  // slider <-> settings bindings, also used to write settings back into the UI
  const plain = function (v) { return String(v); };
  const fixed2 = function (v) { return v.toFixed(2); };
  const BINDINGS = [
    { input: el.pixelSize, label: el.pixelSizeValue, path: 'pixelSize', fmt: plain },
    { input: el.threshold, label: el.thresholdValue, path: 'threshold', fmt: plain },
    { input: el.strength, label: el.strengthValue, path: 'ditherStrength', fmt: plain },
    { input: el.smooth, label: el.smoothValue, path: 'screen.smooth', fmt: plain },
    { input: el.flow, label: el.flowValue, path: 'screen.flow', fmt: plain },
    { input: el.streak, label: el.streakValue, path: 'screen.streak', fmt: plain },
    { input: el.black, label: el.blackValue, path: 'adjustments.black', fmt: plain },
    { input: el.white, label: el.whiteValue, path: 'adjustments.white', fmt: plain },
    { input: el.gamma, label: el.gammaValue, path: 'adjustments.gamma', fmt: fixed2 },
    { input: el.brightness, label: el.brightnessValue, path: 'adjustments.brightness', fmt: fixed2 },
    { input: el.contrast, label: el.contrastValue, path: 'adjustments.contrast', fmt: fixed2 },
    { input: el.saturation, label: el.saturationValue, path: 'adjustments.saturation', fmt: fixed2 },
    { input: el.hue, label: el.hueValue, path: 'adjustments.hue', fmt: function (v) { return v + '°'; } },
    { input: el.blur, label: el.blurValue, path: 'adjustments.blur', fmt: plain },
    { input: el.sharpen, label: el.sharpenValue, path: 'adjustments.sharpen', fmt: fixed2 },
    { input: el.glowRadius, label: el.glowRadiusValue, path: 'glow.radius', fmt: plain },
    { input: el.glowIntensity, label: el.glowIntensityValue, path: 'glow.intensity', fmt: plain },
  ];

  // ---- settings plumbing ----

  // `getPath` / `setPath` are the core's. The two views of the stack - the
  // ids that are on, and the entries a preset or an export wants - come from
  // one filter rather than two.
  function deriveGlitches() {
    return activeEffects().filter(function (id) { return effectAvailable(effectMeta(id)); }).map(function (id) {
      const meta = effectMeta(id);
      const item = { id: id, amount: glitches.amount[id], mode: glitches.mode[id] };
      if (meta.origin) {
        const point = glitches.origin[id] || meta.origin;
        item.origin = { x: point.x, y: point.y };
      }
      return item;
    });
  }

  function readGlitchState(list) {
    D.GLITCHES.forEach(function (g) {
      glitches.on[g.id] = false;
      glitches.amount[g.id] = 50;
      glitches.mode[g.id] = g.modes ? g.modes[0].id : undefined;
      if (g.origin) glitches.origin[g.id] = { x: g.origin.x, y: g.origin.y };
    });
    (list || []).forEach(function (item) {
      const meta = byId(D.GLITCHES, item.id);
      if (!meta) return;
      glitches.on[meta.id] = true;
      glitches.amount[meta.id] = item.amount;
      if (meta.modes) {
        const known = meta.modes.some(function (m) { return m.id === item.mode; });
        glitches.mode[meta.id] = known ? item.mode : meta.modes[0].id;
      }
      if (meta.origin) {
        const point = item.origin && typeof item.origin === 'object' ? item.origin : {};
        const clamp = function (v, fallback) {
          return Math.max(0, Math.min(100, Math.round(typeof v === 'number' && isFinite(v) ? v : fallback)));
        };
        glitches.origin[meta.id] = {
          x: clamp(point.x, meta.origin.x),
          y: clamp(point.y, meta.origin.y),
        };
      }
    });
    const active = (list || []).map(function (item) { return item.id; });
    const rest = glitches.order.filter(function (id) { return active.indexOf(id) < 0; });
    glitches.order = active.concat(rest);
  }

  function syncTextUI() {
    el.textMode.checked = text.on;
    el.textCharset.value = text.ramp;
    el.textSize.value = String(text.size);
    el.textSizeValue.textContent = String(text.size);
    el.textCharsetRow.hidden = !text.on;
    el.textSizeRow.hidden = !text.on;
    el.textExportRow.hidden = !text.on;
  }

  // The screen sliders only mean something to the structure-aware screens.
  function syncScreenRows() {
    const structure = algorithmById(state.settings.algorithm).kind === 'structure';
    el.smoothRow.hidden = !structure;
    el.flowRow.hidden = !structure;
    el.streakRow.hidden = !structure;
  }

  function syncSliderStates() {
    const s = state.settings;
    BINDINGS.forEach(function (binding) {
      const def = getPath(D.DEFAULTS, binding.path);
      const cur = parseFloat(getPath(s, binding.path));
      const changed = Math.abs(cur - parseFloat(def)) > 1e-4;
      const field = binding.input && binding.input.closest('.field');
      if (field) field.classList.toggle('is-modified', changed);
    });
    if (el.textSize) {
      const field = el.textSize.closest('.field');
      if (field) field.classList.toggle('is-modified', text.size !== 10);
    }
  }

  function syncStationIndicators() {
    const s = state.settings;
    const a = s.adjustments;
    const toneActive = a.black !== 0 || a.white !== 255 ||
      Math.abs(a.gamma - 1) > 0.001 || Math.abs(a.brightness - 1) > 0.001 ||
      Math.abs(a.contrast - 1) > 0.001 || Math.abs(a.saturation - 1) > 0.001 || a.hue !== 0;
    const inkActive = s.toneMap !== 'none' || s.alphaMode !== 'matte';
    const detailActive = a.blur !== 0 || a.sharpen !== 0 || !!a.denoise;
    const effectsActive = activeEffects().length > 0;
    const glowActive = s.glow.radius > 0 && s.glow.intensity > 0;
    const motionActive = !!(state.videoOn || (animation && animation.isActive()));
    const typeActive = !!text.on;

    const flags = {
      tone: toneActive,
      ink: inkActive,
      detail: detailActive,
      effects: effectsActive,
      glow: glowActive,
      motion: motionActive,
      type: typeActive,
      layers: !!layerState.enabled,
    };
    Object.keys(flags).forEach(function (id) {
      const group = groupEl(id);
      if (group) group.classList.toggle('has-active', flags[id]);
      const chip = el.jump && el.jump.querySelector('.jump-chip[data-target="' + id + '"]');
      if (chip) chip.classList.toggle('has-active', flags[id]);
    });
    if (el.toneReset) el.toneReset.disabled = !toneActive;
    if (el.detailReset) el.detailReset.disabled = !detailActive;
    if (el.glowReset) el.glowReset.disabled = !(s.glow.radius > 0 || s.glow.intensity > 0);
    if (el.effectsClearBtn) el.effectsClearBtn.disabled = !effectsActive;
  }

  function syncUI() {
    const s = state.settings;
    el.algorithm.value = s.algorithm;
    el.palette.value = s.palette;
    BINDINGS.forEach(function (binding) {
      const value = getPath(s, binding.path);
      binding.input.value = value;
      binding.label.textContent = binding.fmt(parseFloat(value));
    });
    el.seed.value = s.seed;
    el.denoise.checked = !!s.adjustments.denoise;
    el.serpentine.checked = !!s.serpentine;
    el.toneMap.value = s.toneMap;
    el.toneInk.value = rgbToHex(s.toneInk);
    el.tonePaper.value = rgbToHex(s.tonePaper);
    el.inkCustom.hidden = s.toneMap !== 'custom';
    el.alphaMode.value = s.alphaMode;
    el.thresholdRow.hidden = s.palette !== 'bw' || s.algorithm === 'none';
    showAlphaBehind(s.alphaMode);
    syncTextUI();
    syncScreenRows();
    syncSliderStates();
    buildEffectList();
    syncEffectChoices();
    buildSwatches();
    syncGroupNotes();
    syncHistoryButtons();
    // The desktop chrome: the title bar, the menu ticks, the filled part of
    // every slider: listens for this one event instead of reaching in here.
    window.dispatchEvent(new CustomEvent('ds:ui'));
  }

  // ---- rail navigation ----

  function groupEl(id) {
    return document.getElementById('g-' + id);
  }

  // Collapsed stations keep the rail bearable; the summary on the right says
  // what is inside without opening them.
  function setGroup(id, open) {
    const group = groupEl(id);
    if (!group) return false;
    group.setAttribute('data-open', open ? 'true' : 'false');
    const head = group.querySelector('.group-head');
    if (head) head.setAttribute('aria-expanded', open ? 'true' : 'false');
    saveGroups();
    markJump();
    return true;
  }

  function groupOpen(id) {
    const group = groupEl(id);
    return !!group && group.getAttribute('data-open') === 'true';
  }

  function saveGroups() {
    try {
      const open = GROUPS.filter(function (g) { return groupOpen(g.id); })
        .map(function (g) { return g.id; });
      window.localStorage.setItem(GROUP_STORE, open.join(','));
    } catch (err) { /* private mode, file://, or storage disabled: not important */ }
  }

  function loadGroups() {
    let saved = null;
    try { saved = window.localStorage.getItem(GROUP_STORE); } catch (err) { saved = null; }
    if (saved === null) return;
    const open = saved.split(',').filter(Boolean);
    GROUPS.forEach(function (g) { setGroup(g.id, open.indexOf(g.id) >= 0); });
  }

  // A chip click pins the highlight to the station that was asked for (the rail
  // may not be able to scroll a late station all the way up). The pin drops as
  // soon as the user scrolls the rail themselves.
  let jumpPinned = null;
  let lastStationChip = null;

  function unpinJump() { jumpPinned = null; markJump(); }

  function buildJump() {
    el.jump.textContent = '';
    GROUPS.forEach(function (g) {
      const chip = document.createElement('button');
      chip.className = 'jump-chip';
      chip.type = 'button';
      chip.textContent = g.name;
      chip.setAttribute('data-target', g.id);
      chip.addEventListener('click', function () {
        jumpPinned = g.id;
        setGroup(g.id, true);
        const group = groupEl(g.id);
        if (group) {
          el.rail.scrollTop += group.getBoundingClientRect().top -
            el.rail.getBoundingClientRect().top - 6;
        }
        markJump();
      });
      el.jump.appendChild(chip);
    });
  }

  // The chip for whichever station is at the top of the rail, so the strip
  // doubles as a position readout while scrolling.
  function markJump() {
    let current = jumpPinned || (GROUPS.length ? GROUPS[0].id : null);
    // A collapsed console hides the rail, and a hidden rail measures as a pile
    // of zero-height groups at zero: which would read as "the last station".
    // Only trust the measurements when the rail is actually on screen.
    if (!jumpPinned && el.rail.clientHeight > 0) {
      const railTop = el.rail.getBoundingClientRect().top + 30;
      GROUPS.forEach(function (g) {
        const group = groupEl(g.id);
        if (group && group.getBoundingClientRect().top <= railTop) current = g.id;
      });
    }
    let currentChip = null;
    Array.prototype.forEach.call(el.jump.children, function (chip) {
      const on = chip.getAttribute('data-target') === current;
      chip.setAttribute('aria-current', on ? 'true' : 'false');
      if (on) currentChip = chip;
    });
    // The strip is one scrolling row (see panels.css), so the station you are
    // in has to be brought into view rather than assumed visible. This scrolls
    // the strip itself by a measured amount: scrollIntoView() walks up every
    // scrollable ancestor, and it took the whole window sideways with it.
    if (currentChip && current !== lastStationChip) {
      lastStationChip = current;
      const box = currentChip.getBoundingClientRect();
      const strip = el.jump.getBoundingClientRect();
      if (box.left < strip.left) el.jump.scrollLeft -= strip.left - box.left + 4;
      else if (box.right > strip.right) el.jump.scrollLeft += box.right - strip.right + 4;
    }
    currentStationId = current;
    syncConsoleNote();
  }

  function initGroups() {
    el.rail.addEventListener('scroll', function () { window.requestAnimationFrame(markJump); });
    ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(function (type) {
      el.rail.addEventListener(type, unpinJump, { passive: true });
    });
    GROUPS.forEach(function (g) {
      const group = groupEl(g.id);
      if (!group) return;
      const head = group.querySelector('.group-head');
      if (head) {
        head.addEventListener('click', function () {
          setGroup(g.id, !groupOpen(g.id));
        });
      }
    });
  }

  // ---- the console bar (phones: the rail collapses into it) ----

  // Under 720px the rail collapses to one bar (see the responsive section of
  // style.css). That state lives on #panel as data-console; the toggle is the
  // only thing that changes it, and the bar reports on the station the rail
  // is currently showing.
  const CONSOLE_STORE = 'dither-studio.console';

  // Which station the bar is reporting on. markJump() keeps it current while it
  // measures the rail, so reading it costs nothing: no layout at render time.
  let currentStationId = GROUPS.length ? GROUPS[0].id : null;

  const STATION_NOTES = {
    learn: el.noteLearn, source: el.noteSource, layers: el.noteLayers, press: el.notePress, tone: el.noteTone, ink: el.noteInk,
    detail: el.noteDetail, effects: el.noteEffects, glow: el.noteGlow,
    motion: el.noteMotion, type: el.noteType, preset: el.notePreset,
  };

  function consoleIsOpen() {
    return !el.panel || el.panel.getAttribute('data-console') !== 'closed';
  }

  // Does the console bar exist at this size? The stylesheet answers it: the
  // toggle is shown by the same media query that collapses the rail, so the
  // script and the CSS cannot drift apart about where the phone layout begins.
  function consoleLayered() {
    return !!el.consoleToggle && window.getComputedStyle(el.consoleToggle).display !== 'none';
  }

  function setConsole(open, remember) {
    if (!el.panel) return;
    el.panel.setAttribute('data-console', open ? 'open' : 'closed');
    if (el.consoleToggle) el.consoleToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (remember) {
      try { window.localStorage.setItem(CONSOLE_STORE, open ? 'open' : 'closed'); }
      catch (err) { /* private mode, file://, or storage disabled: not important */ }
    }
    // Opening puts the rail back on screen, so the station the bar reports on
    // can finally be measured.
    if (open) markJump();
  }

  function syncConsoleNote() {
    if (!el.consoleToggleNote) return;
    const group = byId(GROUPS, currentStationId);
    const note = STATION_NOTES[currentStationId];
    const value = note && note.textContent ? note.textContent : '';
    const name = group ? group.name : 'Console';
    el.consoleToggleNote.textContent = value ? name + ' · ' + value : name;
  }

  function initConsole() {
    if (!el.consoleToggle) return;
    // A phone opens on the proof, not on the rail: unless the user opened the
    // console here before, in which case the bar remembers that.
    let saved = null;
    try { saved = window.localStorage.getItem(CONSOLE_STORE); } catch (err) { saved = null; }
    setConsole(saved === null ? !consoleLayered() : saved === 'open', false);
    el.consoleToggle.addEventListener('click', function () {
      setConsole(!consoleIsOpen(), true);
    });
    // Growing past the breakpoint must never leave a collapsed bar behind it.
    window.addEventListener('resize', function () {
      if (!consoleLayered() && !consoleIsOpen()) setConsole(true, false);
    });
  }

  // What is inside each station, in one line, on the closed header.
  function syncGroupNotes() {
    const s = state.settings;
    const algo = algorithmById(s.algorithm);
    const palette = paletteById(s.palette);
    const effects = activeEffects();
    setNote(el.noteSource, state.name || 'nothing loaded');
    setNote(el.noteLayers, layersSummary());
    setNote(el.notePress, algo.name + ' · ' + shortPalette(palette));
    setNote(el.noteTone, toneSummary());
    setNote(el.noteInk, inkSummary());
    setNote(el.noteDetail, detailSummary());
    setNote(el.noteEffects, effects.length ? effects.length + ' in stack' : 'none');
    setNote(el.noteGlow, s.glow.radius > 0 && s.glow.intensity > 0
      ? 'r' + s.glow.radius + ' · ' + s.glow.intensity + '%'
      : 'off');
    setNote(el.noteMotion, motionSummary());
    setNote(el.noteType, text.on ? text.ramp + ' · ' + text.size + 'px' : 'off');
    setNote(el.notePreset, PRESETS.length + ' recipes');
    syncStationIndicators();
    syncConsoleNote();
  }

  function toneSummary() {
    const a = state.settings.adjustments;
    const parts = [];
    if (a.black) parts.push('B' + a.black);
    if (a.white !== 255) parts.push('W' + a.white);
    if (Math.abs(a.gamma - 1) > 0.001) parts.push('g' + a.gamma.toFixed(2));
    if (Math.abs(a.brightness - 1) > 0.001) parts.push('br ' + a.brightness.toFixed(2));
    if (Math.abs(a.contrast - 1) > 0.001) parts.push('ct ' + a.contrast.toFixed(2));
    if (Math.abs(a.saturation - 1) > 0.001) parts.push('sat ' + a.saturation.toFixed(2));
    if (a.hue) parts.push('hue ' + a.hue + '°');
    return summarise(parts, 'neutral');
  }

  function detailSummary() {
    const a = state.settings.adjustments;
    const parts = [];
    if (a.blur) parts.push('blur ' + a.blur);
    if (a.sharpen) parts.push('sharp ' + a.sharpen.toFixed(2));
    if (a.denoise) parts.push('denoise');
    return summarise(parts, 'none');
  }

  function inkSummary() {
    const map = byId(D.TONE_MAPS, state.settings.toneMap);
    const alpha = state.settings.alphaMode === 'matte' ? 'flatten'
      : state.settings.alphaMode === 'sharpen' ? 'dither matte' : 'keep alpha';
    const ink = map && map.id !== 'none' ? map.name : 'no map';
    return ink + ' · ' + alpha;
  }

  function motionSummary() {
    if (animation && animation.isActive()) {
      const a = animation.stats();
      return (a.playing ? 'playing' : 'paused') + ' · ' + a.total + ' frames';
    }
    if (!state.videoOn || !video) return 'no source';
    const stats = video.stats();
    return stats.playing ? 'playing · ' + stats.fps + ' fps' : 'paused · ' + stats.fps + ' fps';
  }

  // The ink strip under the palette picker: the actual colours the press
  // will use. Clicking any chip copies its hex code to the clipboard.
  function buildSwatches() {
    const palette = paletteById(state.settings.palette);
    const colors = palette.colors.slice();
    // Sixteen chips is the widest hardware palette here; more would tile.
    const step = colors.length > 16 ? colors.length / 16 : 1;
    el.swatches.textContent = '';
    for (let i = 0; i < colors.length; i += step) {
      const chip = document.createElement('button');
      const c = colors[Math.floor(i)];
      const hex = rgbToHex(c);
      chip.type = 'button';
      chip.className = 'swatch';
      chip.style.background = 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
      chip.title = hex + ' · rgb(' + c.join(', ') + ') · click to copy';
      chip.setAttribute('aria-label', 'Copy ' + hex);
      chip.addEventListener('click', function () {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(hex).then(function () {
            el.statStatus.textContent = 'Copied ' + hex;
          }).catch(function () {
            el.statStatus.textContent = 'Could not copy ' + hex;
          });
        }
      });
      el.swatches.appendChild(chip);
    }
    el.swatches.setAttribute('aria-label', palette.name + ': ' + colors.length + ' inks');
  }

  // ---- panel construction ----

  // Four of the console's five dropdowns are the same list with a different
  // label; `DitherCore.buildSelect` is that builder, so each of these is the
  // catalogue, its label, and nothing else.
  function buildAlgorithmSelect() {
    buildSelect(el.algorithm, D.ALGORITHMS, {
      group: function (algo) { return algo.group; },
      label: function (algo) { return algo.name; },
    });
  }

  function buildPaletteSelect() {
    buildSelect(el.palette, PALETTES_SORTED, {
      label: function (palette) { return palette.name + ' · ' + palette.colors.length + ' colors'; },
    });
  }

  // A newly imported palette has to reach the open select too; the catalogue
  // array is mutated in place so the menus and the command palette see it.
  function rebuildPaletteSelect() {
    const selected = state.settings.palette;
    el.palette.textContent = '';
    buildPaletteSelect();
    el.palette.value = selected;
  }

  function buildToneMapSelect() {
    buildSelect(el.toneMap, TONE_MAPS_SORTED, { label: function (map) { return map.name; } });
  }

  function buildTextSelect() {
    buildSelect(el.textCharset, TEXT_RAMPS_SORTED, { label: function (ramp) { return ramp.name; } });
  }

  // The effects stack: only what is switched on is on screen, added through
  // the "add" list rather than a wall of thirteen toggles. `glitches.order`
  // still holds every id, so presets, JSON export and `deriveGlitches()`
  // keep the shape they always had.
  function activeEffects() {
    return glitches.order.filter(function (id) { return glitches.on[id] && effectAvailable(effectMeta(id)); });
  }

  function effectMeta(id) {
    return byId(D.GLITCHES, id) || { name: id, hint: '' };
  }

  function buildEffectList() {
    el.effectList.textContent = '';
    const active = activeEffects();
    if (!active.length) {
      const empty = document.createElement('p');
      empty.className = 'stack-empty';
      empty.textContent = 'No effects. The dither prints straight.';
      el.effectList.appendChild(empty);
      return;
    }
    active.forEach(function (id, index) {
      const meta = effectMeta(id);
      const row = document.createElement('div');
      row.className = 'stack-row';
      row.setAttribute('data-effect', id);
      row.title = meta.hint;

      const top = document.createElement('div');
      top.className = 'stack-top';
      const indexChip = document.createElement('span');
      indexChip.className = 'stack-index';
      indexChip.textContent = String(index + 1);
      const name = document.createElement('span');
      name.className = 'stack-name';
      name.textContent = meta.name;
      const tools = document.createElement('div');
      tools.className = 'stack-tools';
      top.appendChild(indexChip);
      top.appendChild(name);
      top.appendChild(tools);

      let mode = null;
      if (meta.modes) {
        mode = document.createElement('select');
        mode.setAttribute('aria-label', meta.name + ' mode');
        meta.modes.forEach(function (m) {
          const option = document.createElement('option');
          option.value = m.id;
          option.textContent = m.name;
          mode.appendChild(option);
        });
        mode.value = glitches.mode[id];
        mode.className = 'stack-mode';
      }

      const amount = document.createElement('input');
      amount.type = 'range';
      amount.min = '0';
      amount.max = '100';
      amount.step = '1';
      amount.value = String(glitches.amount[id]);
      amount.title = 'Double-click to reset to 50%';
      amount.setAttribute('aria-label', meta.name + ' amount');

      const amountVal = document.createElement('em');
      amountVal.className = 'stack-val';
      amountVal.textContent = glitches.amount[id] + '%';

      const up = document.createElement('button');
      up.className = 'icon-btn';
      up.type = 'button';
      const upGlyph = document.createElement('span');
      upGlyph.className = 'ui-glyph ui-glyph--xs ui-glyph--up';
      upGlyph.style.setProperty('--ui-icon', 'url("../assets/icons/chevron-right.svg")');
      upGlyph.setAttribute('aria-hidden', 'true');
      up.appendChild(upGlyph);
      up.title = 'Move earlier in the stack';
      up.setAttribute('aria-label', 'Move ' + meta.name + ' earlier in the stack');
      up.disabled = index === 0;
      const down = document.createElement('button');
      down.className = 'icon-btn';
      down.type = 'button';
      const downGlyph = document.createElement('span');
      downGlyph.className = 'ui-glyph ui-glyph--xs ui-glyph--down';
      downGlyph.style.setProperty('--ui-icon', 'url("../assets/icons/chevron-right.svg")');
      downGlyph.setAttribute('aria-hidden', 'true');
      down.appendChild(downGlyph);
      down.title = 'Move later in the stack';
      down.setAttribute('aria-label', 'Move ' + meta.name + ' later in the stack');
      down.disabled = index === active.length - 1;
      const remove = document.createElement('button');
      remove.className = 'icon-btn';
      remove.type = 'button';
      const removeGlyph = document.createElement('span');
      removeGlyph.className = 'ui-glyph ui-glyph--xs';
      removeGlyph.style.setProperty('--ui-icon', 'url("../assets/icons/x.svg")');
      removeGlyph.setAttribute('aria-hidden', 'true');
      remove.appendChild(removeGlyph);
      remove.title = 'Remove from the stack';
      remove.setAttribute('aria-label', 'Remove ' + meta.name);

      tools.appendChild(up);
      tools.appendChild(down);
      tools.appendChild(remove);

      // Two lines per effect: index + name + tools, then the amount slider,
      // live readout, and optional mode selector.
      const line = document.createElement('div');
      line.className = 'stack-line';
      line.appendChild(amount);
      line.appendChild(amountVal);
      if (mode) line.appendChild(mode);

      row.appendChild(top);
      row.appendChild(line);

      // A point-based effect gets two compact sliders under its amount, plus a
      // canvas Pick button so you can click directly on the proof to place it.
      if (meta.origin) {
        const originLine = document.createElement('div');
        originLine.className = 'stack-origin';
        const label = document.createElement('span');
        label.className = 'stack-origin-label';
        label.textContent = 'Origin';
        originLine.appendChild(label);
        [
          { key: 'x', name: 'X' },
          { key: 'y', name: 'Y' },
        ].forEach(function (axis) {
          const wrap = document.createElement('label');
          wrap.className = 'stack-origin-axis';
          const letter = document.createElement('span');
          letter.textContent = axis.name;
          const input = document.createElement('input');
          input.type = 'range';
          input.min = '0';
          input.max = '100';
          input.step = '1';
          input.dataset.originAxis = axis.key;
          input.value = String(glitches.origin[id][axis.key]);
          input.title = 'Double-click to reset to ' + meta.origin[axis.key] + '%';
          input.setAttribute('aria-label', meta.name + ' origin ' + axis.name + ' (%)');
          const value = document.createElement('em');
          value.textContent = String(glitches.origin[id][axis.key]);
          wrap.appendChild(letter);
          wrap.appendChild(input);
          wrap.appendChild(value);
          originLine.appendChild(wrap);
          input.addEventListener('input', function () {
            beginHistoryGroup('effect:' + id + ':origin');
            glitches.origin[id][axis.key] = parseInt(input.value, 10);
            value.textContent = input.value;
            schedulePreview();
          });
          input.addEventListener('change', function () { render(true); endHistoryGroup(); });
          input.addEventListener('dblclick', function () {
            endHistoryGroup();
            const def = meta.origin[axis.key];
            glitches.origin[id][axis.key] = def;
            input.value = String(def);
            value.textContent = String(def);
            render(true);
            window.dispatchEvent(new CustomEvent('ds:ui'));
          });
        });
        const pick = document.createElement('button');
        pick.type = 'button';
        pick.className = 'stack-origin-pick';
        pick.dataset.originPick = id;
        pick.setAttribute('aria-pressed', state.pickingOrigin === id ? 'true' : 'false');
        pick.setAttribute('aria-label', 'Pick ' + meta.name + ' origin on proof');
        pick.title = 'Click or drag on the proof to place the origin';
        const pickGlyph = document.createElement('span');
        pickGlyph.className = 'ui-glyph ui-glyph--xs';
        pickGlyph.style.setProperty('--ui-icon', 'url("../assets/icons/crosshair.svg")');
        pickGlyph.setAttribute('aria-hidden', 'true');
        pick.appendChild(pickGlyph);
        pick.addEventListener('click', function () {
          setPickingOrigin(state.pickingOrigin === id ? null : id);
        });
        originLine.appendChild(pick);
        row.appendChild(originLine);
      }
      el.effectList.appendChild(row);

      if (mode) {
        mode.addEventListener('change', function () {
          glitches.mode[id] = mode.value;
          render(true);
        });
      }
      amount.addEventListener('input', function () {
        beginHistoryGroup('effect:' + id);
        glitches.amount[id] = parseInt(amount.value, 10);
        amountVal.textContent = glitches.amount[id] + '%';
        schedulePreview();
      });
      amount.addEventListener('change', function () { render(true); endHistoryGroup(); });
      amount.addEventListener('dblclick', function () {
        endHistoryGroup();
        glitches.amount[id] = 50;
        amount.value = '50';
        amountVal.textContent = '50%';
        render(true);
        window.dispatchEvent(new CustomEvent('ds:ui'));
      });
      up.addEventListener('click', function () { moveEffect(index, -1); });
      down.addEventListener('click', function () { moveEffect(index, 1); });
      remove.addEventListener('click', function () { removeEffect(id); });
    });
  }

  // The "add" list offers what is not already running, so it doubles as the
  // catalogue of everything the stack can do to a finished dither.
  function syncEffectChoices() {
    el.effectAdd.textContent = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Choose an effect…';
    el.effectAdd.appendChild(placeholder);
    availableGlitches().forEach(function (g) {
      if (glitches.on[g.id]) return;
      const option = document.createElement('option');
      option.value = g.id;
      option.textContent = g.name;
      el.effectAdd.appendChild(option);
    });
  }

  function addEffect(id) {
    endHistoryGroup();
    const meta = byId(D.GLITCHES, id);
    if (meta && !effectAvailable(meta)) {
      el.statStatus.textContent = 'Install this effect\'s plugin from the Plugin Manager first';
      return;
    }
    if (!meta || glitches.on[id]) return;
    glitches.on[id] = true;
    if (!glitches.amount[id]) glitches.amount[id] = 50;
    if (meta.modes && !glitches.mode[id]) glitches.mode[id] = meta.modes[0].id;
    if (meta.origin && !glitches.origin[id]) glitches.origin[id] = { x: meta.origin.x, y: meta.origin.y };
    // Appended, so a new effect lands at the end of the pipeline.
    glitches.order = glitches.order.filter(function (x) { return x !== id; }).concat([id]);
    buildEffectList();
    syncEffectChoices();
    syncGroupNotes();
    render(true);
  }

  function setPickingOrigin(id) {
    state.pickingOrigin = id && glitches.on[id] ? id : null;
    if (el.wrap) el.wrap.classList.toggle('is-picking-origin', !!state.pickingOrigin);
    document.querySelectorAll('.stack-origin-pick').forEach(function (btn) {
      btn.setAttribute('aria-pressed', btn.dataset.originPick === state.pickingOrigin ? 'true' : 'false');
    });
    if (state.pickingOrigin) {
      const meta = effectMeta(state.pickingOrigin);
      el.statStatus.textContent = 'Click or drag on the proof to place ' + (meta ? meta.name : 'effect') + ' origin (Esc to cancel)';
    }
  }

  function applyPickedOrigin(id, clientX, clientY) {
    const rect = el.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.max(0, Math.min(100, Math.round(((clientX - rect.left) / rect.width) * 100)));
    const y = Math.max(0, Math.min(100, Math.round(((clientY - rect.top) / rect.height) * 100)));
    if (!glitches.origin[id]) glitches.origin[id] = { x: x, y: y };
    glitches.origin[id].x = x;
    glitches.origin[id].y = y;
    const row = el.effectList.querySelector('.stack-row[data-effect="' + id + '"]');
    if (row) {
      const inX = row.querySelector('input[data-origin-axis="x"]');
      const inY = row.querySelector('input[data-origin-axis="y"]');
      if (inX) { inX.value = String(x); if (inX.nextElementSibling) inX.nextElementSibling.textContent = String(x); }
      if (inY) { inY.value = String(y); if (inY.nextElementSibling) inY.nextElementSibling.textContent = String(y); }
    }
    schedulePreview();
    window.dispatchEvent(new CustomEvent('ds:ui'));
  }

  function removeEffect(id) {
    endHistoryGroup();
    if (!glitches.on[id]) return;
    if (state.pickingOrigin === id) setPickingOrigin(null);
    glitches.on[id] = false;
    buildEffectList();
    syncEffectChoices();
    syncGroupNotes();
    render(true);
  }

  function moveEffect(index, delta) {
    endHistoryGroup();
    const active = activeEffects();
    const target = index + delta;
    if (target < 0 || target >= active.length) return;
    const id = active[index];
    active[index] = active[target];
    active[target] = id;
    // The inactive rest keeps no order worth preserving.
    glitches.order = active.concat(glitches.order.filter(function (x) { return !glitches.on[x]; }));
    buildEffectList();
    render(true);
  }

  const PRESETS = [
    { id: 'gameboy', name: 'Retro Game Boy', settings: {
      algorithm: 'bayer4', palette: 'gameboy', pixelSize: 4,
      adjustments: { contrast: 1.1, sharpen: 0.5 },
    } },
    { id: 'newsprint', name: 'Newsprint', settings: {
      algorithm: 'halftone', palette: 'bw', pixelSize: 2,
      adjustments: { contrast: 1.25, sharpen: 0.3 },
    } },
    { id: 'zine', name: 'Zine 1-bit', settings: {
      algorithm: 'floyd-steinberg', palette: 'bw', pixelSize: 1,
      adjustments: { contrast: 1.15 },
    } },
    { id: 'c64', name: 'C64 Poster', settings: {
      algorithm: 'bayer8', palette: 'c64', pixelSize: 3,
      adjustments: { saturation: 1.3, contrast: 1.05 },
    } },
    { id: 'terminal', name: 'Terminal Green', settings: {
      algorithm: 'clustered-dot', palette: 'gameboy', pixelSize: 2,
      adjustments: { contrast: 1.2, saturation: 1.2, brightness: 1.05 },
    } },
    { id: 'spectrum', name: 'Spectrum Loading', settings: {
      algorithm: 'sierra', palette: 'zx-spectrum', pixelSize: 2,
      adjustments: { saturation: 1.25, contrast: 1.1 },
    } },
    { id: 'riso', name: 'Riso Poster', settings: {
      algorithm: 'stevenson-arce', palette: 'gruvbox', pixelSize: 3,
      adjustments: { contrast: 1.2, saturation: 0.9 },
    } },
    { id: 'vhs', name: 'VHS Decay', settings: {
      algorithm: 'bayer4', palette: 'pico8', pixelSize: 2,
      adjustments: { contrast: 1.05, saturation: 1.15 },
      glitches: [{ id: 'scanlines', amount: 35 }, { id: 'aberration', amount: 25 }, { id: 'grain', amount: 30 }],
      glow: { radius: 2, intensity: 30 },
    } },
    { id: 'sort', name: 'Glitch Sort', settings: {
      algorithm: 'floyd-steinberg', palette: 'cga', pixelSize: 1,
      adjustments: { contrast: 1.1 },
      glitches: [{ id: 'pixelsort', amount: 70 }, { id: 'aberration', amount: 20 }],
    } },
    { id: 'noir', name: 'Halftone Noir', settings: {
      algorithm: 'halftone-16', palette: 'bw', pixelSize: 1,
      adjustments: { contrast: 1.28, gamma: 1.05, sharpen: 0.35 },
      toneMap: 'sepia',
    } },
    { id: 'amber', name: 'Amber CRT', settings: {
      algorithm: 'bayer8', palette: 'amber', pixelSize: 2,
      adjustments: { contrast: 1.15, brightness: 1.04 },
      glitches: [{ id: 'scanlines', amount: 30 }, { id: 'crt', amount: 45 }, { id: 'grain', amount: 18 }],
      glow: { radius: 2, intensity: 35 },
    } },
    { id: 'duo', name: 'Riso Duotone', settings: {
      algorithm: 'clustered-dot-8', palette: 'bw', pixelSize: 3,
      adjustments: { contrast: 1.2 },
      toneMap: 'custom', toneInk: [26, 34, 120], tonePaper: [255, 214, 120],
    } },
    { id: 'thermal', name: 'Thermal Cam', settings: {
      algorithm: 'bayer16', palette: 'gray-16', pixelSize: 2,
      adjustments: { contrast: 1.35, saturation: 1.4 },
      toneMap: 'thermal',
    } },
    { id: 'mix', name: 'Mixing Poster', settings: {
      algorithm: 'yliluoma-polished', palette: 'gray-16', pixelSize: 2,
      adjustments: { contrast: 1.15, gamma: 1.05 },
    } },
    { id: 'mixduo', name: 'Mixing Duotone', settings: {
      algorithm: 'yliluoma-2', palette: 'gameboy-pocket', pixelSize: 2,
      adjustments: { contrast: 1.2 },
      toneMap: 'gold',
    } },
    { id: 'inkline', name: 'Ink Linework', settings: {
      algorithm: 'line-h4', palette: 'blueprint', pixelSize: 1,
      adjustments: { contrast: 1.3, sharpen: 0.6, gamma: 1.1 },
    } },
    { id: 'storm', name: 'Artifact Storm', settings: {
      algorithm: 'random-noise', palette: 'virtualboy', pixelSize: 2,
      adjustments: { contrast: 1.2 },
      glitches: [
        { id: 'wave', amount: 45 }, { id: 'drip', amount: 40 }, { id: 'deadpixels', amount: 30 },
        { id: 'blocks', amount: 55 }, { id: 'pixelsort', amount: 60, mode: 'cols' },
      ],
    } },
    { id: 'void', name: 'Void Bloom', settings: {
      algorithm: 'void-cluster', palette: 'gray-8', pixelSize: 1,
      adjustments: { contrast: 1.1 },
      toneMap: 'cyanotype',
      glow: { radius: 3, intensity: 45 },
    } },
    // The three structure-aware looks, ready to compare against a photo.
    { id: 'wire', name: 'Wired Portrait', settings: {
      algorithm: 'smooth-diffusion', palette: 'bw', pixelSize: 1,
      screen: { smooth: 7, flow: 100, streak: 30 },
      adjustments: { contrast: 1.2, gamma: 1.05, sharpen: 0.4 },
    } },
    { id: 'matrixrain', name: 'Matrix Rain', settings: {
      algorithm: 'rain', palette: 'matrix', pixelSize: 1,
      screen: { smooth: 5, flow: 10, streak: 100 },
      adjustments: { contrast: 1.15, brightness: 1.03 },
      glow: { radius: 3, intensity: 45 },
    } },
    { id: 'icedots', name: 'Ice Dot Field', settings: {
      algorithm: 'dot-field', palette: 'ice', pixelSize: 1,
      screen: { smooth: 6, flow: 0, streak: 0 },
      adjustments: { contrast: 1.2, gamma: 1.08 },
      glow: { radius: 3, intensity: 55 },
    } },
    // 0.3.0: the artist palettes and the two new effects, in four recipes.
    { id: 'sweetie-postcard', name: 'Sweetie Postcard', settings: {
      algorithm: 'bayer8', palette: 'sweetie-16', pixelSize: 2,
      adjustments: { contrast: 1.12, saturation: 1.12, sharpen: 0.2 },
    } },
    { id: 'nordic-fog', name: 'Nordic Fog', settings: {
      algorithm: 'smooth-diffusion', palette: 'nord', pixelSize: 1,
      screen: { smooth: 7, flow: 85, streak: 10 },
      adjustments: { contrast: 0.94, brightness: 1.08, gamma: 1.04 },
      glow: { radius: 2, intensity: 20 },
    } },
    { id: 'tape-deck', name: 'Tape Deck', settings: {
      algorithm: 'floyd-steinberg', palette: 'endesga-16', pixelSize: 2,
      adjustments: { contrast: 1.08, saturation: 1.08 },
      glitches: [{ id: 'tracking', amount: 55 }, { id: 'scanlines', amount: 25 }, { id: 'grain', amount: 18 }],
      glow: { radius: 1, intensity: 15 },
    } },
    { id: 'channel-drift', name: 'Channel Drift', settings: {
      algorithm: 'atkinson', palette: 'sweetie-16', pixelSize: 1,
      adjustments: { contrast: 1.1 },
      glitches: [{ id: 'channelroll', amount: 45 }, { id: 'aberration', amount: 25 }, { id: 'wave', amount: 15 }],
    } },
  ];

  // Installed preset packs join the same catalogue as the built-in recipes.
  // BASE_PRESETS stays untouched, so removing a plugin removes exactly its
  // entries on the next sync instead of rebuilding the built-ins by hand.
  const BASE_PRESETS = PRESETS.slice();
  function pluginPresetEntries() {
    return window.DitherPlugins && window.DitherPlugins.presets ? window.DitherPlugins.presets() : [];
  }
  pluginPresetEntries().forEach(function (preset) {
    if (!byId(PRESETS, preset.id)) PRESETS.push(preset);
  });

  // Imported palettes live beside the grouped-panel setting: a small JSON list
  // in localStorage, not a file the app owns. The engine registers them before
  // the sorted views are built, so boot is the same path as a fresh import.
  function storedCustomPalettes() {
    let raw = null;
    try { raw = window.localStorage.getItem(PALETTE_STORE); } catch (err) { return []; }
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.palettes)) return parsed.palettes;
    } catch (err) { /* a corrupt list is ignored, not fatal */ }
    return [];
  }

  function saveCustomPalettes() {
    const list = D.PALETTES.filter(function (palette) { return palette.custom && !palette.plugin; })
      .map(function (palette) {
        return { id: palette.id, name: palette.name, colors: palette.colors };
      });
    try { window.localStorage.setItem(PALETTE_STORE, JSON.stringify(list)); }
    catch (err) { /* private mode, file://, or storage disabled: still usable this session */ }
  }

  function loadStoredPalettes() {
    storedCustomPalettes().slice(0, 64).forEach(function (entry) {
      try {
        D.registerPalette({ id: entry.id, name: entry.name, colors: entry.colors });
      } catch (err) { /* skip a stale or hand-edited entry */ }
    });
  }

  loadStoredPalettes();

  // Palette packs are session entries like imports, but they belong to a
  // plugin. Their prefixed ids keep them apart from built-ins and custom inks.
  function pluginPaletteEntries() {
    return window.DitherPlugins && window.DitherPlugins.palettes ? window.DitherPlugins.palettes() : [];
  }

  function registerPluginPalettes() {
    pluginPaletteEntries().forEach(function (palette) {
      try {
        const entry = D.registerPalette({
          id: palette.id,
          name: palette.name,
          colors: palette.colors,
        });
        entry.plugin = palette.plugin;
        entry.pluginName = palette.pluginName;
      } catch (err) { /* a pack that cannot be registered must not stop boot */ }
    });
  }

  registerPluginPalettes();

  // The pickers, menus and command palette all read these sorted views, so a
  // catalogue cannot be alphabetical in one place and authored in another.
  // Algorithms keep their family grouping: the order is the way the press
  // groups its screens, not a list to scan for a name. The active effects stack
  // is never sorted - its order is part of the pipeline and the result.
  function byName(a, b) {
    return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
  }

  const GLITCHES_SORTED = D.GLITCHES.slice().sort(byName);
  const PALETTES_SORTED = D.PALETTES.slice().sort(byName);

  // Recipes are grouped by where they came from, not just alphabetised: the
  // built-ins lead, then each installed preset pack under its own name. The
  // engine keeps one flat list, but the picker and its optgroups follow this.
  const BUILTIN_PRESET_GROUP = 'Built-in recipes';
  function presetGroup(preset) {
    return preset.pluginName || BUILTIN_PRESET_GROUP;
  }
  function presetsByGroup(list) {
    const names = [];
    list.forEach(function (preset) {
      const group = presetGroup(preset);
      if (names.indexOf(group) < 0) names.push(group);
    });
    const ordered = names.filter(function (name) { return name === BUILTIN_PRESET_GROUP; })
      .concat(names.filter(function (name) { return name !== BUILTIN_PRESET_GROUP; }).sort(function (a, b) {
        return a.localeCompare(b, 'en', { sensitivity: 'base' });
      }));
    const out = [];
    ordered.forEach(function (group) {
      out.push.apply(out, list.filter(function (preset) { return presetGroup(preset) === group; }).sort(byName));
    });
    return out;
  }
  const PRESETS_SORTED = presetsByGroup(PRESETS);

  // Effects that belong to a plugin only appear once that plugin is installed.
  // The engine still knows how to draw them (an old preset can name one); the
  // gate is the UI, which is where a person chooses what is available.
  function effectAvailable(meta) {
    return !meta.plugin || !!(window.DitherPlugins && window.DitherPlugins.has(meta.plugin));
  }

  function availableGlitches() {
    return GLITCHES_SORTED.filter(effectAvailable);
  }
  const TEXT_RAMPS_SORTED = TEXT_RAMPS.slice().sort(byName);
  const TONE_MAPS_SORTED = D.TONE_MAPS.slice().sort(function (a, b) {
    // None is the off switch, so it stays at the top; the maps after it read
    // alphabetically.
    if (a.id === 'none') return -1;
    if (b.id === 'none') return 1;
    return byName(a, b);
  });

  function buildPresetSelect() {
    el.preset.textContent = '';
    buildSelect(el.preset, PRESETS_SORTED, {
      placeholder: 'Choose a recipe…',
      label: function (preset) { return preset.name; },
      group: presetGroup,
    });
  }

  function applySettings(next, label) {
    endHistoryGroup();
    state.settings = D.mergeSettings(next);
    readGlitchState(state.settings.glitches);
    syncUI();
    render(true);
    if (label) el.statStatus.textContent = label;
  }

  function applyPreset(id) {
    const preset = byId(PRESETS, id);
    if (!preset) return;
    applySettings(preset.settings, preset.name);
  }

  // One install or removal can change both catalogues. Rebuild them in place:
  // the menus and the command palette hold references to these arrays, so a
  // fresh array would leave half the chrome reading the old list.
  function syncPluginCatalogues() {
    // Take every plugin palette out first, then re-register the packs that are
    // still installed. A removed pack must not leave its inks in the picker.
    D.PALETTES.filter(function (palette) { return palette.plugin; }).forEach(function (palette) {
      try { D.unregisterPalette(palette.id); } catch (err) { /* already gone */ }
    });
    registerPluginPalettes();
    PALETTES_SORTED.length = 0;
    D.PALETTES.slice().sort(byName).forEach(function (palette) { PALETTES_SORTED.push(palette); });
    const currentPalette = paletteById(state.settings.palette);
    rebuildPaletteSelect();
    if (!currentPalette || currentPalette.id !== state.settings.palette) {
      state.settings.palette = 'bw';
      el.palette.value = 'bw';
      el.thresholdRow.hidden = false;
      buildSwatches();
    }
    if (window.DitherPalette && window.DitherPalette.refresh) window.DitherPalette.refresh();

    PRESETS.length = 0;
    BASE_PRESETS.forEach(function (preset) { PRESETS.push(preset); });
    pluginPresetEntries().forEach(function (preset) {
      if (!byId(PRESETS, preset.id)) PRESETS.push(preset);
    });
    PRESETS_SORTED.length = 0;
    presetsByGroup(PRESETS).forEach(function (preset) { PRESETS_SORTED.push(preset); });
    buildPresetSelect();

    // Pull a plugin effect out of the stack if its plugin has just gone. The
    // stack order keeps the id, so reinstalling restores the recipe.
    activeEffects().forEach(function (id) {
      if (!effectAvailable(effectMeta(id))) glitches.on[id] = false;
    });
    buildEffectList();
    syncEffectChoices();
    syncGroupNotes();
    render(true);
    window.dispatchEvent(new CustomEvent('ds:catalogues', { detail: { kind: 'plugins' } }));
  }

  if (window.DitherPlugins && window.DitherPlugins.onChange) {
    window.DitherPlugins.onChange(function (type) {
      if (type === 'install' || type === 'remove') syncPluginCatalogues();
    });
  }

  // ---- layers & object detection ----

  const LAYER_RECIPES = [
    { algorithm: 'floyd-steinberg', palette: 'bw', pixelSize: 2 },
    { algorithm: 'bayer8', palette: 'c64', pixelSize: 2 },
    { algorithm: 'atkinson', palette: 'gameboy', pixelSize: 2 },
    { algorithm: 'smooth-diffusion', palette: 'bw', pixelSize: 1, screen: { smooth: 6, flow: 90, streak: 15 } },
    { algorithm: 'halftone-16', palette: 'gruvbox', pixelSize: 2 },
  ];

  function cloneSettings(settings) {
    return D.mergeSettings(JSON.parse(JSON.stringify(settings || D.DEFAULTS)));
  }

  function ensureLayersInit() {
    if (!layerState.items.length) {
      layerState.items.push({
        id: 'base',
        name: 'Background',
        isBase: true,
        visible: true,
        opacity: 1,
        inverted: false,
        mask: null,
        maskW: 0,
        maskH: 0,
        maskVer: 0,
        settings: cloneSettings(state.settings),
      });
      layerState.activeId = 'base';
    }
  }

  function activeLayer() {
    ensureLayersInit();
    if (layerState.activeId === 'post') return layerState.post;
    return byId(layerState.items, layerState.activeId) || layerState.items[0];
  }

  function saveActiveLayerSettings() {
    if (!layerState.items.length) return;
    const active = activeLayer();
    if (active.isPost) {
      active.settings = D.mergeSettings({
        glitches: deriveGlitches(),
        glow: { radius: state.settings.glow.radius, intensity: state.settings.glow.intensity },
        seed: state.settings.seed,
      });
      return;
    }
    const copy = cloneSettings(state.settings);
    copy.glitches = deriveGlitches();
    active.settings = copy;
  }

  function layersSummary() {
    if (!layerState.enabled) return 'off';
    const active = activeLayer();
    const postFx = layerState.post && layerState.post.visible &&
      ((layerState.post.settings.glitches && layerState.post.settings.glitches.length) ||
        (layerState.post.settings.glow && layerState.post.settings.glow.radius > 0 && layerState.post.settings.glow.intensity > 0));
    const label = active.isPost ? 'Full-image FX' : active.name;
    return label + ' · ' + layerState.items.length + 'L' + (postFx ? ' +FX' : '');
  }

  function syncLayerBanner() {
    const active = activeLayer();
    if (el.pressLayerBanner) {
      el.pressLayerBanner.hidden = !layerState.enabled;
      if (layerState.enabled && el.pressLayerName) {
        el.pressLayerName.textContent = active.isPost ? 'Full image (FX & Glow only)' : active.name;
      }
    }
    if (el.effectsLayerBanner) {
      el.effectsLayerBanner.hidden = !layerState.enabled;
      if (layerState.enabled && el.effectsLayerName) {
        el.effectsLayerName.textContent = active.name;
      }
      if (el.effectsLayerPost) {
        el.effectsLayerPost.hidden = !!active.isPost;
      }
    }
  }

  function setLayerTool(tool) {
    const next = (tool === 'pick' || tool === 'fill' || tool === 'brush' || tool === 'erase')
      ? (layerState.tool === tool ? null : tool)
      : null;
    layerState.tool = next;
    if (next && state.pickingOrigin) setPickingOrigin(null);
    if (next && !layerState.enabled) enableLayers(true, true);
    if (el.layersPick) el.layersPick.setAttribute('aria-pressed', next === 'pick' ? 'true' : 'false');
    if (el.layersFill) el.layersFill.setAttribute('aria-pressed', next === 'fill' ? 'true' : 'false');
    if (el.layersBrush) el.layersBrush.setAttribute('aria-pressed', next === 'brush' ? 'true' : 'false');
    if (el.layersErase) el.layersErase.setAttribute('aria-pressed', next === 'erase' ? 'true' : 'false');
    if (el.wrap) {
      el.wrap.classList.toggle('is-layer-pick', next === 'pick' || next === 'fill');
      el.wrap.classList.toggle('is-layer-brush', next === 'brush' || next === 'erase');
    }
    if (next === 'pick') {
      el.statStatus.textContent = 'Click an object on the proof to select it (Shift adds, Alt subtracts, Esc done)';
    } else if (next === 'fill') {
      el.statStatus.textContent = 'Click inside a mask region to fill it (Alt erases, Esc done)';
    } else if (next === 'brush') {
      el.statStatus.textContent = 'Drag on the proof to paint the object mask (Esc done)';
    } else if (next === 'erase') {
      el.statStatus.textContent = 'Drag on the proof to erase from the object mask (Esc done)';
    }
  }

  function syncLayerActiveBox() {
    if (!el.layersActiveBox) return;
    const active = activeLayer();
    const show = layerState.enabled && !active.isBase && !active.isPost;
    el.layersActiveBox.hidden = !show;
    if (show) {
      const pct = Math.round((active.opacity === undefined ? 1 : active.opacity) * 100);
      if (el.layersOpacity) el.layersOpacity.value = String(pct);
      if (el.layersOpacityValue) el.layersOpacityValue.textContent = String(pct);
      if (el.layersInvert) el.layersInvert.checked = !!active.inverted;
    }
  }

  function makeLayerThumb(layer) {
    const c = document.createElement('canvas');
    c.className = 'layer-thumb';
    c.width = 28;
    c.height = 28;
    const tctx = c.getContext('2d');
    tctx.fillStyle = '#0e1118';
    tctx.fillRect(0, 0, 28, 28);
    if (layer.isBase) {
      tctx.fillStyle = '#33415c';
      tctx.fillRect(3, 3, 22, 22);
      return c;
    }
    if (!layer.mask || !layer.maskW || !layer.maskH) return c;
    const img = tctx.createImageData(28, 28);
    const d = img.data;
    for (let y = 0; y < 28; y++) {
      const sy = Math.min(layer.maskH - 1, Math.floor((y / 28) * layer.maskH));
      for (let x = 0; x < 28; x++) {
        const sx = Math.min(layer.maskW - 1, Math.floor((x / 28) * layer.maskW));
        const raw = layer.mask[sy * layer.maskW + sx];
        const v = layer.inverted ? 255 - raw : raw;
        const idx = (y * 28 + x) * 4;
        if (v > 32) {
          d[idx] = 88;
          d[idx + 1] = 166;
          d[idx + 2] = 255;
          d[idx + 3] = Math.max(96, v);
        } else {
          d[idx] = 14;
          d[idx + 1] = 17;
          d[idx + 2] = 24;
          d[idx + 3] = 255;
        }
      }
    }
    tctx.putImageData(img, 0, 0);
    return c;
  }

  function renderPostLayerRow() {
    const post = layerState.post;
    const isActive = layerState.activeId === 'post';
    const row = document.createElement('div');
    row.className = 'layer-row is-post' + (isActive ? ' is-active' : '') + (!post.visible ? ' is-hidden' : '');
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', isActive ? 'true' : 'false');
    row.dataset.layerId = 'post';

    const vis = document.createElement('button');
    vis.type = 'button';
    vis.className = 'icon-btn';
    vis.title = post.visible ? 'Mute full-image effects' : 'Enable full-image effects';
    vis.setAttribute('aria-label', (post.visible ? 'Hide ' : 'Show ') + post.name);
    const visGlyph = document.createElement('span');
    visGlyph.className = 'ui-glyph ui-glyph--xs';
    visGlyph.style.setProperty('--ui-icon', 'url("../assets/icons/' + (post.visible ? 'eye.svg' : 'eye-off.svg') + '")');
    visGlyph.setAttribute('aria-hidden', 'true');
    vis.appendChild(visGlyph);
    vis.addEventListener('click', function (e) {
      e.stopPropagation();
      post.visible = !post.visible;
      renderLayerList();
      render(true);
    });

    const thumb = document.createElement('div');
    thumb.className = 'layer-thumb layer-thumb--post';
    const sp = document.createElement('span');
    sp.className = 'ui-glyph ui-glyph--xs';
    sp.style.setProperty('--ui-icon', 'url("../assets/icons/sparkles.svg")');
    sp.setAttribute('aria-hidden', 'true');
    thumb.appendChild(sp);

    const meta = document.createElement('div');
    meta.className = 'layer-meta';
    const name = document.createElement('div');
    name.className = 'layer-name';
    name.textContent = post.name;
    const sub = document.createElement('div');
    sub.className = 'layer-sub';
    const fxCount = (post.settings.glitches || []).length;
    const hasGlow = post.settings.glow && post.settings.glow.radius > 0 && post.settings.glow.intensity > 0;
    const parts = [];
    if (fxCount) parts.push(fxCount + (fxCount === 1 ? ' effect' : ' effects'));
    if (hasGlow) parts.push('glow r' + post.settings.glow.radius);
    sub.textContent = parts.length ? parts.join(' · ') : 'No post effects — click to add';
    meta.appendChild(name);
    meta.appendChild(sub);

    const actions = document.createElement('div');
    actions.className = 'layer-actions';
    const badge = document.createElement('span');
    badge.className = 'layer-badge';
    badge.textContent = 'Post';
    actions.appendChild(badge);

    row.appendChild(vis);
    row.appendChild(thumb);
    row.appendChild(meta);
    row.appendChild(actions);
    row.addEventListener('click', function () {
      selectLayer('post');
    });
    return row;
  }

  function renderLayerList() {
    if (!el.layersList) return;
    ensureLayersInit();
    el.layersList.textContent = '';
    // Full-image post-composite effects row sits at the very top of the stack.
    el.layersList.appendChild(renderPostLayerRow());
    // Display top-most object first, Background last (compositor stack order).
    const display = layerState.items.slice().reverse();
    display.forEach(function (layer) {
      const idx = layerState.items.indexOf(layer);
      const isActive = layer.id === layerState.activeId;
      const row = document.createElement('div');
      row.className = 'layer-row' + (isActive ? ' is-active' : '') + (!layer.visible ? ' is-hidden' : '');
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', isActive ? 'true' : 'false');
      row.dataset.layerId = layer.id;

      const vis = document.createElement('button');
      vis.type = 'button';
      vis.className = 'icon-btn';
      vis.title = layer.visible ? 'Hide layer' : 'Show layer';
      vis.setAttribute('aria-label', (layer.visible ? 'Hide ' : 'Show ') + layer.name);
      const visGlyph = document.createElement('span');
      visGlyph.className = 'ui-glyph ui-glyph--xs';
      visGlyph.style.setProperty('--ui-icon', 'url("../assets/icons/' + (layer.visible ? 'eye.svg' : 'eye-off.svg') + '")');
      visGlyph.setAttribute('aria-hidden', 'true');
      vis.appendChild(visGlyph);
      vis.addEventListener('click', function (e) {
        e.stopPropagation();
        layer.visible = !layer.visible;
        renderLayerList();
        render(true);
      });

      const thumb = makeLayerThumb(layer);

      const meta = document.createElement('div');
      meta.className = 'layer-meta';
      const name = document.createElement('div');
      name.className = 'layer-name';
      name.textContent = layer.name;
      const sub = document.createElement('div');
      sub.className = 'layer-sub';
      const algo = algorithmById(layer.settings.algorithm);
      const pal = paletteById(layer.settings.palette);
      sub.textContent = algo.id === 'none' ? 'Original image' : (algo.name + ' · ' + shortPalette(pal));
      meta.appendChild(name);
      meta.appendChild(sub);

      const actions = document.createElement('div');
      actions.className = 'layer-actions';
      if (!layer.isBase) {
        const up = document.createElement('button');
        up.type = 'button';
        up.className = 'icon-btn';
        up.title = 'Move layer up';
        up.setAttribute('aria-label', 'Move ' + layer.name + ' up');
        up.disabled = idx >= layerState.items.length - 1;
        const upG = document.createElement('span');
        upG.className = 'ui-glyph ui-glyph--xs ui-glyph--up';
        upG.style.setProperty('--ui-icon', 'url("../assets/icons/chevron-right.svg")');
        upG.setAttribute('aria-hidden', 'true');
        up.appendChild(upG);
        up.addEventListener('click', function (e) {
          e.stopPropagation();
          moveLayer(idx, 1);
        });

        const down = document.createElement('button');
        down.type = 'button';
        down.className = 'icon-btn';
        down.title = 'Move layer down';
        down.setAttribute('aria-label', 'Move ' + layer.name + ' down');
        down.disabled = idx <= 1;
        const downG = document.createElement('span');
        downG.className = 'ui-glyph ui-glyph--xs ui-glyph--down';
        downG.style.setProperty('--ui-icon', 'url("../assets/icons/chevron-right.svg")');
        downG.setAttribute('aria-hidden', 'true');
        down.appendChild(downG);
        down.addEventListener('click', function (e) {
          e.stopPropagation();
          moveLayer(idx, -1);
        });

        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'icon-btn';
        del.title = 'Remove layer';
        del.setAttribute('aria-label', 'Remove ' + layer.name);
        const delG = document.createElement('span');
        delG.className = 'ui-glyph ui-glyph--xs';
        delG.style.setProperty('--ui-icon', 'url("../assets/icons/x.svg")');
        delG.setAttribute('aria-hidden', 'true');
        del.appendChild(delG);
        del.addEventListener('click', function (e) {
          e.stopPropagation();
          removeLayer(layer.id);
        });

        actions.appendChild(up);
        actions.appendChild(down);
        actions.appendChild(del);
      }

      row.appendChild(vis);
      row.appendChild(thumb);
      row.appendChild(meta);
      row.appendChild(actions);

      row.addEventListener('click', function () {
        selectLayer(layer.id);
      });
      el.layersList.appendChild(row);
    });
    syncLayerActiveBox();
    syncLayerBanner();
  }

  function selectLayer(id, opts) {
    const skipRender = typeof opts === 'boolean' ? opts : !!(opts && opts.skipRender);
    const skipSave = !!(opts && opts.skipSave);
    ensureLayersInit();
    if (!skipSave) saveActiveLayerSettings();
    const target = id === 'post'
      ? layerState.post
      : (byId(layerState.items, id) || layerState.items[0]);
    layerState.activeId = target.id;
    if (target.isPost) {
      state.settings.glitches = JSON.parse(JSON.stringify(target.settings.glitches || []));
      state.settings.glow = {
        radius: target.settings.glow ? target.settings.glow.radius : 0,
        intensity: target.settings.glow ? target.settings.glow.intensity : 0,
      };
    } else {
      state.settings = cloneSettings(target.settings);
    }
    readGlitchState(state.settings.glitches);
    syncUI();
    renderLayerList();
    if (!skipRender) render(true);
    el.statStatus.textContent = 'Editing ' + target.name;
    window.dispatchEvent(new CustomEvent('ds:ui'));
    return target.id;
  }

  function enableLayers(on, quiet) {
    ensureLayersInit();
    const next = !!on;
    if (next === layerState.enabled) return layerState.enabled;
    saveActiveLayerSettings();
    layerState.enabled = next;
    if (el.layersEnabled) el.layersEnabled.checked = next;
    if (!next) {
      setLayerTool(null);
    }
    renderLayerList();
    syncGroupNotes();
    if (!quiet) render(true);
    window.dispatchEvent(new CustomEvent('ds:ui'));
    return layerState.enabled;
  }

  function createObjectLayer(opts) {
    ensureLayersInit();
    const w = state.source ? state.source.width : 1;
    const h = state.source ? state.source.height : 1;
    const n = layerState.nextId++;
    const recipeIndex = (layerState.items.length - 1) % LAYER_RECIPES.length;
    const settings = opts && opts.settings
      ? cloneSettings(opts.settings)
      : cloneSettings(LAYER_RECIPES[recipeIndex]);
    const item = {
      id: 'obj-' + n,
      name: (opts && opts.name) || ('Object ' + n),
      isBase: false,
      visible: true,
      opacity: 1,
      inverted: false,
      mask: (opts && opts.mask) || new Uint8Array(w * h),
      maskW: w,
      maskH: h,
      maskVer: 1,
      settings: settings,
    };
    layerState.items.push(item);
    return item;
  }

  function addEmptyObjectLayer() {
    ensureLayersInit();
    const wasOff = !layerState.enabled;
    const currentRecipe = cloneSettings(state.settings);
    currentRecipe.glitches = deriveGlitches();
    if (wasOff) {
      layerState.items[0].settings = cloneSettings({ algorithm: 'none', pixelSize: 1 });
      layerState.enabled = true;
      if (el.layersEnabled) el.layersEnabled.checked = true;
    }
    const objRecipe = (wasOff && currentRecipe.algorithm !== 'none') ? currentRecipe : null;
    const created = createObjectLayer({ settings: objRecipe });
    selectLayer(created.id, { skipSave: wasOff });
    if (!layerState.tool) setLayerTool('pick');
    return created.id;
  }

  function removeLayer(id) {
    const idx = layerState.items.findIndex(function (item) { return item.id === id; });
    if (idx <= 0) return false;
    layerState.items.splice(idx, 1);
    layerState.cache.delete(id);
    layerState.maskCache.delete(id);
    const fallback = layerState.items[Math.min(idx, layerState.items.length - 1)] || layerState.items[0];
    selectLayer(fallback.id);
    return true;
  }

  function moveLayer(idx, delta) {
    const target = idx + delta;
    if (idx <= 0 || target <= 0 || target >= layerState.items.length) return false;
    const copy = layerState.items.slice();
    const moved = copy.splice(idx, 1)[0];
    copy.splice(target, 0, moved);
    layerState.items = copy;
    renderLayerList();
    render(true);
    return true;
  }

  function clearObjectLayers(quiet) {
    ensureLayersInit();
    const base = layerState.items[0];
    layerState.items = [base];
    layerState.cache.clear();
    layerState.maskCache.clear();
    layerState.nextId = 1;
    layerState.activeId = 'base';
    if (!quiet) {
      state.settings = cloneSettings(base.settings);
      readGlitchState(state.settings.glitches);
      syncUI();
      renderLayerList();
      render(true);
      el.statStatus.textContent = 'Object layers cleared';
    } else {
      renderLayerList();
    }
  }

  function detectObjectLayers() {
    if (!Layers || !state.source) return [];
    ensureLayersInit();
    const wasOff = !layerState.enabled;
    const currentRecipe = cloneSettings(state.settings);
    currentRecipe.glitches = deriveGlitches();
    const detected = Layers.detectObjects(state.source, {
      maxObjects: 5,
      feather: 0,
    });

    const base = layerState.items[0];
    if (wasOff) {
      base.settings = cloneSettings({ algorithm: 'none', pixelSize: 1 });
    } else {
      saveActiveLayerSettings();
    }
    layerState.items = [base];
    layerState.cache.clear();
    layerState.maskCache.clear();
    layerState.nextId = 1;
    layerState.enabled = true;
    if (el.layersEnabled) el.layersEnabled.checked = true;

    detected.forEach(function (obj, index) {
      const recipe = index === 0 && currentRecipe.algorithm !== 'none'
        ? currentRecipe
        : LAYER_RECIPES[index % LAYER_RECIPES.length];
      createObjectLayer({
        name: obj.name || ('Object ' + (index + 1)),
        mask: obj.mask,
        settings: recipe,
      });
    });

    if (layerState.items.length > 1) {
      selectLayer(layerState.items[1].id, { skipSave: true });
      el.statStatus.textContent = 'Detected ' + detected.length + (detected.length === 1 ? ' object' : ' objects') + ' · editing ' + layerState.items[1].name;
    } else {
      selectLayer('base', { skipSave: true });
      el.statStatus.textContent = 'No distinct objects found — use Pick object or Paint mask';
    }
    return detected.map(function (o, i) {
      return { id: layerState.items[i + 1] ? layerState.items[i + 1].id : null, name: o.name, coverage: o.coverage, bbox: o.bbox };
    });
  }

  function prepareLayerMask(layer, w, h) {
    if (layer.isBase || !layer.mask) return null;
    const feather = layerState.feather | 0;
    const key = layer.maskVer + ':' + w + 'x' + h + ':f' + feather;
    const hit = layerState.maskCache.get(layer.id);
    if (hit && hit.key === key) return hit.mask;
    let m = layer.mask;
    if (layer.maskW !== w || layer.maskH !== h) {
      const scaled = new Uint8Array(w * h);
      const sxRatio = layer.maskW / w;
      const syRatio = layer.maskH / h;
      for (let y = 0; y < h; y++) {
        const sy = Math.min(layer.maskH - 1, Math.floor(y * syRatio));
        const rowOff = y * w;
        const srcOff = sy * layer.maskW;
        for (let x = 0; x < w; x++) {
          const sx = Math.min(layer.maskW - 1, Math.floor(x * sxRatio));
          scaled[rowOff + x] = m[srcOff + sx];
        }
      }
      m = scaled;
    }
    if (feather > 0 && Layers) {
      const scaledFeather = layer.maskW !== w ? Math.max(1, Math.round(feather * (w / Math.max(1, layer.maskW)))) : feather;
      m = Layers.featherMask(m, w, h, scaledFeather);
    }
    layerState.maskCache.set(layer.id, { key: key, mask: m });
    return m;
  }

  function renderComposite(source, full) {
    const t0 = performance.now();
    saveActiveLayerSettings();
    const w = source.width;
    const h = source.height;
    const prefix = (full ? 'F' : 'P') + ':' + state.sourceSeq + ':';
    const overlays = [];
    let baseData = null;
    let maxColors = 0;

    for (let i = 0; i < layerState.items.length; i++) {
      const layer = layerState.items[i];
      if (!layer.visible) {
        if (layer.isBase) baseData = new Uint8ClampedArray(w * h * 4);
        continue;
      }
      const key = prefix + JSON.stringify(layer.settings);
      let cached = layerState.cache.get(layer.id);
      if (!cached || cached.key !== key) {
        const out = D.process(source, layer.settings);
        cached = { key: key, res: out };
        layerState.cache.set(layer.id, cached);
      }
      if (cached.res.colors > maxColors) maxColors = cached.res.colors;
      if (layer.isBase) {
        baseData = cached.res.data;
      } else {
        overlays.push({
          data: cached.res.data,
          mask: prepareLayerMask(layer, w, h),
          maskW: w,
          maskH: h,
          opacity: Math.round((layer.opacity === undefined ? 1 : layer.opacity) * 100),
          invert: !!layer.inverted,
        });
      }
    }

    if (!baseData) baseData = new Uint8ClampedArray(w * h * 4);
    const comp = Layers ? Layers.compositeLayers(baseData, w, h, overlays) : new Uint8ClampedArray(baseData);
    if (layerState.post && layerState.post.visible) {
      const ps = layerState.post.settings;
      if (ps.glitches && ps.glitches.length) {
        D.applyGlitchStack(comp, w, h, ps.glitches, ps.seed, ps.frameIndex || 0);
      }
      if (ps.glow && ps.glow.radius > 0 && ps.glow.intensity > 0) {
        D.applyGlow(comp, w, h, ps.glow.radius, ps.glow.intensity);
      }
    }
    const ms = performance.now() - t0;
    return {
      data: comp,
      width: w,
      height: h,
      colors: maxColors || 0,
      ms: ms,
    };
  }

  function canvasNormFromEvent(clientX, clientY) {
    const rect = el.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height || !state.source) return null;
    const xNorm = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const yNorm = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return { xNorm: xNorm, yNorm: yNorm };
  }

  function ensureEditableObjectLayer() {
    ensureLayersInit();
    const active = activeLayer();
    if (!active.isBase && !active.isPost) return active;
    if (active.isPost && layerState.items.length > 1) {
      const top = layerState.items[layerState.items.length - 1];
      selectLayer(top.id, { skipRender: true });
      return top;
    }
    const firstObject = layerState.items.length === 1;
    const currentRecipe = cloneSettings(state.settings);
    currentRecipe.glitches = deriveGlitches();
    if (firstObject) {
      layerState.items[0].settings = cloneSettings({ algorithm: 'none', pixelSize: 1 });
    }
    const objRecipe = (firstObject && currentRecipe.algorithm !== 'none') ? currentRecipe : null;
    const created = createObjectLayer({ settings: objRecipe });
    selectLayer(created.id, { skipRender: true, skipSave: firstObject });
    return created;
  }

  function applyCanvasPick(clientX, clientY, mode) {
    if (!Layers || !state.source) return;
    const pt = canvasNormFromEvent(clientX, clientY);
    if (!pt) return;
    if (!layerState.enabled) enableLayers(true, true);
    const target = ensureEditableObjectLayer();
    const sel = Layers.magicSelect(state.source, pt.xNorm, pt.yNorm, {
      tolerance: layerState.tolerance,
      feather: 0,
      contiguous: layerState.contiguous,
    });
    target.mask = Layers.combineMasks(target.mask, sel.mask, mode || 'replace');
    target.maskW = state.source.width;
    target.maskH = state.source.height;
    target.maskVer = (target.maskVer || 0) + 1;
    renderLayerList();
    render(true);
    el.statStatus.textContent = target.name + ' · selected ' + sel.coverage + '% of frame';
  }

  function applyCanvasFill(clientX, clientY, value) {
    if (!Layers || !state.source) return 0;
    const pt = canvasNormFromEvent(clientX, clientY);
    if (!pt) return 0;
    return applyMaskBucketFill(pt.xNorm, pt.yNorm, value);
  }

  function applyMaskBucketFill(xNorm, yNorm, value) {
    if (!Layers || !state.source) return 0;
    if (!layerState.enabled) enableLayers(true, true);
    const target = ensureEditableObjectLayer();
    if (!target.mask || target.maskW !== state.source.width || target.maskH !== state.source.height) {
      target.mask = new Uint8Array(state.source.width * state.source.height);
      target.maskW = state.source.width;
      target.maskH = state.source.height;
    }
    const val = value === undefined ? 255 : value;
    const res = Layers.bucketFillMask(target.mask, target.maskW, target.maskH, xNorm, yNorm, val);
    if (res.count > 0) {
      target.maskVer = (target.maskVer || 0) + 1;
      renderLayerList();
      render(true);
      el.statStatus.textContent = target.name + (val >= 128 ? ' · filled ' : ' · cleared ') + res.count.toLocaleString('en-US') + ' px';
    } else {
      el.statStatus.textContent = target.name + ' · region already ' + (val >= 128 ? 'filled' : 'empty');
    }
    return res.count;
  }

  function fillActiveMaskHoles() {
    if (!Layers || !state.source) return 0;
    const active = activeLayer();
    if (active.isBase || active.isPost || !active.mask) return 0;
    const res = Layers.fillMaskHoles(active.mask, active.maskW, active.maskH);
    active.maskVer = (active.maskVer || 0) + 1;
    renderLayerList();
    render(true);
    el.statStatus.textContent = res.filled > 0
      ? active.name + ' · filled ' + res.filled.toLocaleString('en-US') + ' hole px'
      : active.name + ' · no enclosed holes to fill';
    return res.filled;
  }

  function fillActiveMaskAll() {
    if (!Layers || !state.source) return false;
    const active = activeLayer();
    if (active.isBase || active.isPost) return false;
    if (!active.mask || active.maskW !== state.source.width || active.maskH !== state.source.height) {
      active.mask = new Uint8Array(state.source.width * state.source.height);
      active.maskW = state.source.width;
      active.maskH = state.source.height;
    }
    Layers.fillMask(active.mask, active.maskW, active.maskH, 255);
    active.maskVer = (active.maskVer || 0) + 1;
    renderLayerList();
    render(true);
    el.statStatus.textContent = active.name + ' · mask filled';
    return true;
  }

  function clearActiveMask() {
    if (!Layers || !state.source) return false;
    const active = activeLayer();
    if (active.isBase || active.isPost || !active.mask) return false;
    Layers.fillMask(active.mask, active.maskW, active.maskH, 0);
    active.maskVer = (active.maskVer || 0) + 1;
    renderLayerList();
    render(true);
    el.statStatus.textContent = active.name + ' · mask cleared';
    return true;
  }

  function applyCanvasBrush(clientX, clientY, value) {
    if (!Layers || !state.source) return;
    const pt = canvasNormFromEvent(clientX, clientY);
    if (!pt) return;
    if (!layerState.enabled) enableLayers(true, true);
    const target = ensureEditableObjectLayer();
    if (!target.mask || target.maskW !== state.source.width || target.maskH !== state.source.height) {
      target.mask = new Uint8Array(state.source.width * state.source.height);
      target.maskW = state.source.width;
      target.maskH = state.source.height;
    }
    Layers.paintMask(
      target.mask,
      target.maskW,
      target.maskH,
      pt.xNorm,
      pt.yNorm,
      Math.max(2, Math.round(layerState.brushSize / 2)),
      value
    );
    target.maskVer = (target.maskVer || 0) + 1;
    schedulePreview();
  }

  function drawResultToCanvas(res, full) {
    let display = res;
    if (layerState.enabled && layerState.showMask && Layers) {
      const active = activeLayer();
      if (!active.isBase && !active.isPost && active.mask) {
        const m = prepareLayerMask(active, res.width, res.height);
        if (m) {
          const tinted = Layers.drawMaskOverlay(res.data, res.width, res.height, m, res.width, res.height, !!active.inverted);
          display = { data: tinted, width: res.width, height: res.height };
        }
      }
    }
    if (full) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.putImageData(toImageData(display), 0, 0);
    } else {
      buffer.width = display.width;
      buffer.height = display.height;
      bufferCtx.putImageData(toImageData(display), 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, el.canvas.width, el.canvas.height);
      ctx.drawImage(buffer, 0, 0, el.canvas.width, el.canvas.height);
    }
  }

  // ---- rendering ----

  function toImageData(res) {
    return new ImageData(res.data, res.width, res.height);
  }

  function render(full) {
    // During video playback or animation the frame loop owns the canvas; a
    // still render here would only be overwritten by the next frame.
    if (state.videoOn && video && video.playing) return;
    if (animation && animation.isActive()) { animation.refresh(); return; }
    const source = full ? state.source : state.preview;
    if (!source) return;
    state.settings.glitches = deriveGlitches();
    if (full) recordHistory();
    const res = layerState.enabled ? renderComposite(source, full) : D.process(source, state.settings);

    if (full) state.result = res;
    showAlphaBehind(state.settings.alphaMode);

    if (!(text.on && drawTextResult(res))) {
      drawResultToCanvas(res, full);
    }
    if (full && layerState.enabled) renderLayerList();
    updateStats(res, full);
  }

  // ---- text mode ----

  function rampFor(id) {
    const found = byId(TEXT_RAMPS, id);
    return (found || TEXT_RAMPS[0]).chars;
  }

  function textCellSize(res) {
    const scale = res.width / Math.max(1, state.source.width);
    return Math.max(3, Math.round(text.size * scale));
  }

  // The character grid: one character per cell, picked by the mean luminance
  // of the *dithered* cell, so the dither texture still shows through in
  // which character is chosen.
  function textGrid(res) {
    const cell = textCellSize(res);
    const cols = Math.max(1, Math.ceil(res.width / cell));
    const rows = Math.max(1, Math.ceil(res.height / cell));
    const chars = rampFor(text.ramp);
    const lumas = new Float32Array(cols * rows);
    let min = Infinity, max = -Infinity;
    for (let cy = 0; cy < rows; cy++) {
      const y0 = cy * cell, y1 = Math.min(res.height, y0 + cell);
      for (let cx = 0; cx < cols; cx++) {
        const x0 = cx * cell, x1 = Math.min(res.width, x0 + cell);
        let sum = 0, count = 0;
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const i = (y * res.width + x) * 4;
            sum += 0.2126 * res.data[i] + 0.7152 * res.data[i + 1] + 0.0722 * res.data[i + 2];
            count++;
          }
        }
        const luma = count ? sum / count : 0;
        lumas[cy * cols + cx] = luma;
        if (luma < min) min = luma;
        if (luma > max) max = luma;
      }
    }
    // Stretch the ramp over the proof's own luminance range: a dark proof (a
    // night scene, or any dark palette) would otherwise print as a field of
    // blanks and commas. The tone controls remain the way to change contrast.
    const span = max - min;
    const lines = [];
    for (let cy = 0; cy < rows; cy++) {
      let line = '';
      for (let cx = 0; cx < cols; cx++) {
        const t = span > 1 ? (lumas[cy * cols + cx] - min) / span : 0.5;
        line += chars[Math.min(chars.length - 1, Math.max(0, Math.round(t * (chars.length - 1))))];
      }
      lines.push(line);
    }
    return { cell: cell, cols: cols, rows: rows, lines: lines };
  }

  // The ink and paper for the type: the tone map's own colours when one is on,
  // otherwise the console's.
  function inkColors(settings) {
    const s = settings || state.settings;
    const map = byId(D.TONE_MAPS, s.toneMap);
    if (map && map.id !== 'none') {
      const custom = map.id === 'custom';
      return {
        ink: rgbToHex(custom ? s.toneInk : map.ink),
        paper: rgbToHex(custom ? s.tonePaper : map.paper),
      };
    }
    return { ink: '#e8eaf0', paper: '#0b0c10' };
  }

  function drawTextResult(res, settings) {
    const s = settings || state.settings;
    const grid = textGrid(res);
    if (grid.cols * grid.rows > TEXT_CELL_CAP) return false;
    const ink = inkColors(s);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (s.alphaMode === 'matte') {
      ctx.fillStyle = ink.paper;
      ctx.fillRect(0, 0, res.width, res.height);
    } else {
      ctx.clearRect(0, 0, res.width, res.height);
    }
    ctx.font = grid.cell + 'px ' + MONO_STACK;
    ctx.textBaseline = 'top';
    ctx.fillStyle = ink.ink;
    const glyph = ctx.measureText('M').width || grid.cell * 0.6;
    const dx = (grid.cell - glyph) / 2;
    for (let cy = 0; cy < grid.rows; cy++) {
      const line = grid.lines[cy];
      for (let cx = 0; cx < grid.cols; cx++) {
        ctx.fillText(line[cx], cx * grid.cell + dx, cy * grid.cell);
      }
    }
    return true;
  }

  // The viewport update mode: Full always renders at working resolution,
  // Live renders a half-resolution frame while a control is moving, and Still
  // waits until the control settles (for slow machines and heavy recipes).
  const QUALITY_NOTES = {
    full: 'Full: every move renders at working resolution',
    live: 'Live: half-res while dragging',
    still: 'Still: renders when a control settles',
  };

  function schedulePreview() {
    // A split is a comparison view: half-resolution proof under a full source
    // would put the divider over two different pixel grids.
    if (state.quality === 'full' || state.splitOn) {
      render(true);
      return;
    }
    if (state.quality === 'still') {
      el.statStatus.textContent = 'Adjusting: release to render';
      return;
    }
    if (state.rafPending) return;
    state.rafPending = true;
    window.requestAnimationFrame(function () {
      state.rafPending = false;
      render(false);
    });
  }

  function setQuality(mode) {
    if (['full', 'live', 'still'].indexOf(mode) < 0) mode = 'live';
    state.quality = mode;
    Array.prototype.forEach.call(el.quality.children, function (btn) {
      const on = btn.getAttribute('data-value') === mode;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
      btn.tabIndex = on ? 0 : -1;
    });
    el.qualityNote.textContent = QUALITY_NOTES[mode];
    return state.quality;
  }

  function algorithmById(id) {
    return byId(D.ALGORITHMS, id) || D.ALGORITHMS[0];
  }

  // One place where the algorithm and palette change, so the select, the
  // stepper arrows, a preset and a test hook all take the same path.
  function setAlgorithm(id) {
    endHistoryGroup();
    state.settings.algorithm = id;
    el.algorithm.value = id;
    el.thresholdRow.hidden = state.settings.palette !== 'bw' || id === 'none';
    syncScreenRows();
    render(true);
    syncGroupNotes();
  }

  function stepAlgorithm(delta) {
    const next = stepThrough(D.ALGORITHMS, state.settings.algorithm, delta);
    setAlgorithm(next.id);
    return next.id;
  }

  function setPalette(id) {
    endHistoryGroup();
    state.settings.palette = id;
    el.palette.value = id;
    el.thresholdRow.hidden = id !== 'bw' || state.settings.algorithm === 'none';
    buildSwatches();
    render(true);
    syncGroupNotes();
  }

  function stepPalette(delta) {
    const next = stepThrough(PALETTES_SORTED, state.settings.palette, delta);
    setPalette(next.id);
    return next.id;
  }

  // Self-made palettes: Color Scheme Maker drafts and imported ink sets. Plugin
  // palettes also live in D.PALETTES as custom entries, but their package owns
  // them, so they must never appear in the manager below.
  function savedPaletteEntries() {
    return D.PALETTES.filter(function (palette) { return palette.custom && !palette.plugin; })
      .slice().sort(byName)
      .map(function (palette) {
        return { id: palette.id, name: palette.name, colors: palette.colors };
      });
  }

  function savedPaletteById(id) {
    return D.PALETTES.find(function (palette) {
      return palette.custom && !palette.plugin && palette.id === id;
    });
  }

  function replacePaletteInView(entry) {
    const at = PALETTES_SORTED.findIndex(function (palette) { return palette.id === entry.id; });
    if (at >= 0) PALETTES_SORTED[at] = entry;
    else PALETTES_SORTED.push(entry);
    PALETTES_SORTED.sort(byName);
  }

  function refreshPaletteCatalogue(id) {
    window.dispatchEvent(new CustomEvent('ds:catalogues', { detail: { kind: 'palettes', id: id } }));
    if (window.DitherPalette && window.DitherPalette.refresh) window.DitherPalette.refresh();
  }

  // One route for both the dialog and the debug hook. Re-importing a name
  // updates that custom palette in place, so trying a palette twice does not
  // leave a trail of identical entries in the picker. An edit passes its id so
  // a rename in the dialog changes the same entry instead of making a new one.
  function importPalette(parsed) {
    if (!parsed || !Array.isArray(parsed.colors)) {
      return { ok: false, error: 'A palette needs 2–64 colours' };
    }
    const name = Core.cleanPaletteName(parsed.name, 'Imported palette');
    const existing = parsed.id
      ? savedPaletteById(parsed.id)
      : D.PALETTES.find(function (palette) {
        return palette.custom && !palette.plugin && palette.name.toLowerCase() === name.toLowerCase();
      });
    if (parsed.id && !existing) {
      return { ok: false, error: 'That saved palette no longer exists' };
    }
    const clash = D.PALETTES.find(function (palette) {
      return palette.custom && !palette.plugin && palette !== existing &&
        palette.name.toLowerCase() === name.toLowerCase();
    });
    if (clash) {
      const error = 'Another saved palette already uses that name';
      el.statStatus.textContent = error;
      return { ok: false, error: error };
    }
    const id = existing ? existing.id : Core.paletteId(name, D.PALETTES.map(function (palette) { return palette.id; }));
    let entry;
    try {
      entry = D.registerPalette({ id: id, name: name, colors: parsed.colors });
    } catch (err) {
      const error = err && err.message ? err.message : 'That palette could not be imported';
      el.statStatus.textContent = error;
      return { ok: false, error: error };
    }

    replacePaletteInView(entry);
    saveCustomPalettes();
    rebuildPaletteSelect();
    setPalette(entry.id);
    el.statStatus.textContent = (existing ? 'Palette updated · ' : 'Palette imported · ') + entry.name;
    refreshPaletteCatalogue(entry.id);
    return { ok: true, id: entry.id };
  }

  function renameSavedPalette(id, value) {
    const entry = savedPaletteById(id);
    if (!entry) return { ok: false, error: 'That saved palette no longer exists' };
    const name = Core.cleanPaletteName(value, entry.name);
    if (name === entry.name) return { ok: true, id: id, name: name };
    const clash = D.PALETTES.find(function (palette) {
      return palette.custom && !palette.plugin && palette.id !== id &&
        palette.name.toLowerCase() === name.toLowerCase();
    });
    if (clash) return { ok: false, error: 'Another saved palette already uses that name' };

    let updated;
    try {
      updated = D.registerPalette({ id: id, name: name, colors: entry.colors });
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : 'The palette could not be renamed' };
    }
    replacePaletteInView(updated);
    saveCustomPalettes();
    rebuildPaletteSelect();
    if (state.settings.palette === id) {
      el.statPalette.textContent = updated.name;
      syncGroupNotes();
    }
    el.statStatus.textContent = 'Palette renamed · ' + updated.name;
    refreshPaletteCatalogue(id);
    return { ok: true, id: id, name: updated.name };
  }

  function deleteSavedPalette(id) {
    const entry = savedPaletteById(id);
    if (!entry) return { ok: false, error: 'That saved palette no longer exists' };
    if (!D.unregisterPalette(id)) return { ok: false, error: 'That palette could not be deleted' };
    const at = PALETTES_SORTED.findIndex(function (palette) { return palette.id === id; });
    if (at >= 0) PALETTES_SORTED.splice(at, 1);
    saveCustomPalettes();
    const wasSelected = state.settings.palette === id;
    rebuildPaletteSelect();
    if (wasSelected) setPalette('bw');
    else syncGroupNotes();
    el.statStatus.textContent = 'Palette deleted · ' + entry.name;
    refreshPaletteCatalogue(id);
    return { ok: true, id: id, name: entry.name };
  }

  function paletteById(id) {
    return byId(D.PALETTES, id) || D.PALETTES[0];
  }

  function updateStats(res, full) {
    const algo = algorithmById(state.settings.algorithm);
    const palette = paletteById(state.settings.palette);
    el.statFile.textContent = state.name;
    el.statSize.textContent = res.width + '×' + res.height;
    el.statAlgorithm.textContent = algo.name;
    el.statPalette.textContent = palette.name;
    el.statColors.textContent = res.colors.toLocaleString('en-US');
    el.statRender.textContent = Math.round(res.ms) + ' ms';
    el.statStatus.textContent = full ? 'Ready' : 'Preview';
    // Every render refreshes the station summaries, so a change made in any
    // panel is reflected on the closed headers above it.
    syncGroupNotes();
  }

  // ---- zoom, pan, compare ----

  function effectiveScale() {
    if (state.zoom !== null) return state.zoom;
    const rect = el.wrap.getBoundingClientRect();
    const fit = Math.min(
      (rect.width - 48) / el.canvas.width,
      (rect.height - 48) / el.canvas.height
    );
    return Math.max(0.05, Math.min(8, fit));
  }

  function applyZoom() {
    const scale = effectiveScale();
    const w = Math.max(1, Math.round(el.canvas.width * scale));
    const h = Math.max(1, Math.round(el.canvas.height * scale));
    el.canvas.style.width = w + 'px';
    el.canvas.style.height = h + 'px';
    el.statZoom.textContent = state.zoom === null ? 'Fit' : state.zoom + '×';
    const pannable = w > el.wrap.clientWidth + 1 || h > el.wrap.clientHeight + 1;
    el.canvas.classList.toggle('can-pan', pannable);
  }

  function zoomStep(direction) {
    const current = effectiveScale();
    if (direction > 0) {
      const next = ZOOM_STEPS.find(function (step) { return step > current + 1e-3; });
      state.zoom = next === undefined ? ZOOM_STEPS[ZOOM_STEPS.length - 1] : next;
    } else {
      const lower = ZOOM_STEPS.filter(function (step) { return step < current - 1e-3; });
      state.zoom = lower.length ? lower[lower.length - 1] : ZOOM_STEPS[0];
    }
    applyZoom();
  }

  function showResult() {
    if (state.result) drawResultToCanvas(state.result, true);
  }

  function clampSplit(value) {
    return Math.max(0.02, Math.min(0.98, value));
  }

  // The source lives on its own layer above the proof, so dragging the split
  // never touches the canvas that Copy PNG and Export read.
  function drawSplitLayer() {
    if (!state.splitOn || !state.original || !el.splitLayer) return;
    const source = state.original;
    if (el.splitLayer.width !== source.width || el.splitLayer.height !== source.height) {
      el.splitLayer.width = source.width;
      el.splitLayer.height = source.height;
    }
    const x = Math.max(0, Math.min(source.width, Math.round(source.width * state.splitAt)));
    const lctx = el.splitLayer.getContext('2d');
    lctx.clearRect(0, 0, el.splitLayer.width, el.splitLayer.height);
    if (x > 0) lctx.putImageData(source, 0, 0, 0, 0, x, source.height);
  }

  function syncSplit() {
    const on = !!state.splitOn && !!state.original;
    if (!el.split || !el.splitGrip || !el.splitLayer) return;
    el.split.classList.toggle('btn-primary', on);
    el.split.setAttribute('aria-pressed', on ? 'true' : 'false');
    el.splitGrip.hidden = !on;
    el.splitLayer.hidden = !on || !!state.compareOn;
    if (el.splitBadges) el.splitBadges.hidden = !on || !!state.compareOn;
    if (!on) return;
    const pct = Math.round(state.splitAt * 100);
    el.splitGrip.style.left = pct + '%';
    el.splitGrip.setAttribute('aria-valuenow', String(pct));
    el.splitGrip.setAttribute('aria-valuetext', pct + '% source, ' + (100 - pct) + '% proof');
    if (!state.compareOn) drawSplitLayer();
  }

  function setSplit(on) {
    state.splitOn = !!on && !!state.original && !state.videoOn;
    if (state.splitOn && state.compareOn) setCompare(false);
    syncSplit();
    el.statStatus.textContent = state.splitOn ? 'Split: source left · proof right' : 'Split off';
    window.dispatchEvent(new CustomEvent('ds:ui'));
  }

  function setCompare(on) {
    state.compareOn = !!on;
    if (!state.original) return;
    if (on) {
      ctx.putImageData(state.original, 0, 0);
      if (el.splitLayer) el.splitLayer.hidden = true;
      if (el.splitBadges) el.splitBadges.hidden = true;
    } else {
      showResult();
      if (state.splitOn) {
        if (el.splitLayer) el.splitLayer.hidden = false;
        if (el.splitBadges) el.splitBadges.hidden = false;
        drawSplitLayer();
      }
    }
    el.compare.classList.toggle('btn-primary', on);
    el.compare.setAttribute('aria-pressed', on ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('ds:ui'));
  }

  // ---- loading images ----

  function setSource(imageData, name, capped) {
    if (animation && animation.isActive()) animation.stop();
    videoStop();
    state.original = imageData;
    state.source = { data: imageData.data, width: imageData.width, height: imageData.height };
    state.sourceSeq = (state.sourceSeq || 0) + 1;
    state.name = name;
    layerState.cache.clear();
    layerState.maskCache.clear();
    if (layerState.items.length > 1) {
      setLayerTool(null);
      clearObjectLayers(true);
    }

    const pw = Math.max(1, Math.round(imageData.width * PREVIEW_SCALE));
    const ph = Math.max(1, Math.round(imageData.height * PREVIEW_SCALE));
    const full = document.createElement('canvas');
    full.width = imageData.width;
    full.height = imageData.height;
    full.getContext('2d').putImageData(imageData, 0, 0);
    const half = document.createElement('canvas');
    half.width = pw;
    half.height = ph;
    const hctx = half.getContext('2d');
    hctx.imageSmoothingQuality = 'high';
    hctx.drawImage(full, 0, 0, pw, ph);
    const halfData = hctx.getImageData(0, 0, pw, ph);
    state.preview = { data: halfData.data, width: pw, height: ph };

    el.canvas.width = imageData.width;
    el.canvas.height = imageData.height;
    state.zoom = null;
    applyZoom();
    resetHistory();
    render(true);
    syncSplit();
    syncGroupNotes();
    el.statStatus.textContent = capped ? 'Scaled to ' + MAX_SOURCE + 'px' : 'Ready';
  }

  function loadBitmap(bitmap, name) {
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, MAX_SOURCE / longest);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const scratch = document.createElement('canvas');
    scratch.width = w;
    scratch.height = h;
    const sctx = scratch.getContext('2d');
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(bitmap, 0, 0, w, h);
    setSource(sctx.getImageData(0, 0, w, h), name, scale < 1);
  }

  function loadFile(file) {
    if (!file) return;
    if (window.createImageBitmap) {
      window.createImageBitmap(file).then(function (bitmap) {
        loadBitmap(bitmap, file.name || 'image');
        bitmap.close && bitmap.close();
      }).catch(function () {
        el.statStatus.textContent = 'Could not read that image';
      });
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = function () {
      loadBitmap(img, file.name || 'image');
      URL.revokeObjectURL(url);
    };
    img.onerror = function () { el.statStatus.textContent = 'Could not read that image'; };
    img.src = url;
  }

  // One decoder for every native route: the main process reads the file and
  // hands over an ArrayBuffer, so no file:// URL ever reaches the canvas
  // (Chromium treats a file image in a file page as an opaque origin, which
  // would taint it).
  function payloadFile(payload, fallbackName, fallbackType) {
    const view = payload.bytes instanceof ArrayBuffer ? new Uint8Array(payload.bytes) : payload.bytes;
    const bytes = view instanceof Uint8Array ? view : new Uint8Array(view);
    return new File([bytes], payload.name || fallbackName, { type: payload.mime || fallbackType });
  }

  function loadPayload(payload) {
    if (!payload) { el.statStatus.textContent = 'Open cancelled'; return false; }
    if (payload.error) { el.statStatus.textContent = payload.error; return false; }
    loadFile(payloadFile(payload, 'image', 'image/png'));
    state.path = payload.path || null;
    return true;
  }

  function openImageDialog() {
    if (!desktop) { el.file.click(); return; }
    desktop.openImage().then(loadPayload).catch(function () {
      el.statStatus.textContent = 'The open dialog failed';
    });
  }

  // ---- the built-in sources (so the page opens with art) ----

  // Every built-in source is a painting in samples.js: a window opens on one,
  // and the control in the Source panel steps through the table and comes round
  // again. Nothing here draws art of its own — the generated night scene the
  // app used to open on, and its ridges and clouds, are gone. The samples
  // travel as data URIs because a console opened from file:// may not read
  // pixels back out of a local file: drawing one into a canvas taints it and
  // getImageData throws.
  const SAMPLES = window.DitherSamples || [];
  let sampleStep = 0;
  let sampleIndex = 0;

  // Which painting is on the table. The dropdown, the strip of thumbnails and
  // the station's summary all read this one number, so they cannot disagree.
  function markSample(at) {
    sampleIndex = at;
    if (el.sample) el.sample.value = String(at);
    if (el.sampleStrip) {
      Array.prototype.forEach.call(el.sampleStrip.children, function (tile, index) {
        const on = index === at;
        tile.classList.toggle('is-on', on);
        tile.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }
    setNote(el.noteSource, SAMPLES[at] ? SAMPLES[at].name : 'none');
  }

  // `at` is an index when the picker chose one; a bare call steps to the next
  // sample, which is what Ctrl+D and File > Built-in Source mean. The step is
  // kept apart from the choice so the shortcut still cycles.
  function loadSample(at) {
    if (!SAMPLES.length) {
      // Only reachable if samples.js was left out of a build: say so instead
      // of drawing something the app no longer has.
      el.statStatus.textContent = 'No built-in sources are installed';
      return;
    }
    const index = typeof at === 'number' && SAMPLES[at] ? at : sampleStep;
    const sample = SAMPLES[index];
    sampleStep = (index + 1) % SAMPLES.length;
    const img = new Image();
    img.onload = function () {
      loadBitmap(img, sample.name);
      markSample(index);
    };
    img.onerror = function () {
      el.statStatus.textContent = 'Could not read the built-in sample';
    };
    img.src = sample.data;
  }

  function stepSample(delta) {
    if (!SAMPLES.length) return;
    loadSample((sampleIndex + delta + SAMPLES.length) % SAMPLES.length);
  }

  // The Source panel's picker: a dropdown for the name, and the paintings
  // themselves underneath it. Three names ask the reader to remember what
  // "Oedipus and the Sphinx" looks like; the strip answers in one look.
  function buildSamplePicker() {
    // A build without samples.js keeps Open image… and drops the picker
    // entirely, rather than offering an empty list to choose from.
    if (!SAMPLES.length) {
      const pick = $('sample-pick');
      if (pick) pick.hidden = true;
      return;
    }
    if (el.sample) {
      SAMPLES.forEach(function (sample, index) {
        const option = document.createElement('option');
        option.value = String(index);
        option.textContent = sample.name;
        el.sample.appendChild(option);
      });
      el.sample.addEventListener('change', function () {
        loadSample(parseInt(el.sample.value, 10) || 0);
      });
    }
    if (el.samplePrev) el.samplePrev.addEventListener('click', function () { stepSample(-1); });
    if (el.sampleNext) el.sampleNext.addEventListener('click', function () { stepSample(1); });
    if (!el.sampleStrip) return;
    SAMPLES.forEach(function (sample, index) {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'sample-tile';
      tile.setAttribute('aria-pressed', 'false');
      tile.setAttribute('aria-label', 'Use ' + sample.name);
      tile.title = sample.name;
      const img = document.createElement('img');
      img.src = sample.data;
      img.alt = '';
      img.decoding = 'async';
      tile.appendChild(img);
      tile.addEventListener('click', function () { loadSample(index); });
      el.sampleStrip.appendChild(tile);
    });
  }

  // ---- export ----

  function download(blob, filename, durationMs) {
    function save(value) {
      // Desktop: the operating system asks where the file goes, and the path it
      // returns is the receipt the title bar shows.
      if (desktop) {
        value.arrayBuffer().then(function (data) {
          return desktop.saveBlob({ name: filename, mime: value.type || 'application/octet-stream', data: data });
        }).then(function (out) {
          if (!out) { el.statStatus.textContent = 'Save cancelled'; return; }
          if (out.error) { el.statStatus.textContent = out.error; return; }
          state.savedPath = out.path;
          window.dispatchEvent(new CustomEvent('ds:saved', { detail: { path: out.path, name: out.name } }));
        }).catch(function () { el.statStatus.textContent = 'That file could not be saved'; });
        return;
      }
      const url = URL.createObjectURL(value);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    }

    // MediaRecorder writes WebM without a Duration, which leaves players with
    // a bar that cannot seek and a file that reports no length. Patch the
    // container before it reaches the save dialog. A failed patch saves the
    // original, so the recording is never lost.
    if (durationMs && /\.webm$/i.test(filename) && typeof window.ysFixWebmDuration === 'function') {
      window.ysFixWebmDuration(blob, Math.max(1, Math.round(durationMs)), { logger: false })
        .then(save, function () { save(blob); });
      return;
    }
    save(blob);
  }

  function exportName(extension) {
    const base = (state.name || 'dither').replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9._-]+/gi, '-');
    return base + '-dither' + extension;
  }

  function exportPNG() {
    if (!state.source && !state.videoOn) return;
    render(true);
    const scale = parseInt(el.exportScale.value, 10) || 1;
    const out = document.createElement('canvas');
    out.width = el.canvas.width * scale;
    out.height = el.canvas.height * scale;
    const octx = out.getContext('2d');
    octx.imageSmoothingEnabled = false;
    if (text.on) {
      // What you see is what you get: the character proof, scaled up as type.
      octx.drawImage(el.canvas, 0, 0, out.width, out.height);
    } else if (scale === 1) {
      octx.putImageData(toImageData(state.result), 0, 0);
    } else {
      buffer.width = state.result.width;
      buffer.height = state.result.height;
      buffer.getContext('2d').putImageData(toImageData(state.result), 0, 0);
      octx.drawImage(buffer, 0, 0, out.width, out.height);
    }
    out.toBlob(function (blob) {
      if (blob) download(blob, exportName('-' + scale + 'x.png'));
      else el.statStatus.textContent = 'The browser refused to build that PNG';
      el.statStatus.textContent = 'Exported PNG ' + scale + '×';
    }, 'image/png');
  }

  function exportTXT() {
    if (!state.source && !state.videoOn) return;
    render(true);
    const grid = textGrid(state.result);
    const body = grid.lines.join('\n') + '\n';
    download(new Blob([body], { type: 'text/plain' }), exportName('.txt'));
    el.statStatus.textContent = 'Exported ' + grid.cols + '×' + grid.rows + ' characters';
  }

  function copyPNG() {
    if (!state.source && !state.videoOn) return;
    render(true);
    let sourceCanvas = el.canvas;
    if (!text.on && state.result && layerState.enabled && layerState.showMask) {
      // Never copy the interactive mask highlight onto the clipboard.
      buffer.width = state.result.width;
      buffer.height = state.result.height;
      bufferCtx.putImageData(toImageData(state.result), 0, 0);
      sourceCanvas = buffer;
    }
    if (desktop) {
      sourceCanvas.toBlob(function (blob) {
        if (!blob) return;
        blob.arrayBuffer().then(function (data) {
          return desktop.copyImage({ mime: 'image/png', data: data });
        }).then(function (out) {
          if (!out || out.error) el.statStatus.textContent = 'The clipboard refused that image';
          else el.statStatus.textContent = 'Proof copied: ' + out.size.width + '×' + out.size.height;
        }).catch(function () { el.statStatus.textContent = 'The clipboard refused that image'; });
      }, 'image/png');
      return;
    }
    sourceCanvas.toBlob(function (blob) {
      if (!blob) return;
      if (!navigator.clipboard || !window.ClipboardItem) {
        el.statStatus.textContent = 'This browser cannot copy images';
        return;
      }
      navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]).then(function () {
        el.statStatus.textContent = 'PNG copied to the clipboard';
      }).catch(function () {
        el.statStatus.textContent = 'The browser blocked the clipboard write';
      });
    }, 'image/png');
  }

  // A one-button surprise: a complete recipe, tones and glitches included.
  const RANDOM_TONES = ['none', 'none', 'sepia', 'blueprint', 'amber', 'cyanotype', 'forest', 'rose', 'thermal', 'gold'];

  function randomize() {
    const algos = D.ALGORITHMS.filter(function (a) { return a.id !== 'none'; });
    const algo = algos[(Math.random() * algos.length) | 0];
    const palette = D.PALETTES[(Math.random() * D.PALETTES.length) | 0];
    const next = {
      algorithm: algo.id,
      palette: palette.id,
      pixelSize: 1 + ((Math.random() * 4) | 0),
      ditherStrength: 80 + ((Math.random() * 60) | 0),
      serpentine: Math.random() < 0.4,
      toneMap: RANDOM_TONES[(Math.random() * RANDOM_TONES.length) | 0],
      seed: (Math.random() * 0xffffffff) >>> 0,
      adjustments: {
        contrast: 1 + Math.random() * 0.3,
        saturation: 0.85 + Math.random() * 0.6,
        gamma: 0.9 + Math.random() * 0.25,
      },
      glitches: [],
      glow: { radius: 0, intensity: 0 },
    };
    const pool = availableGlitches().slice();
    const count = (Math.random() * 3) | 0;
    for (let i = 0; i < count && pool.length; i++) {
      const pick = pool.splice((Math.random() * pool.length) | 0, 1)[0];
      next.glitches.push({
        id: pick.id,
        amount: 20 + ((Math.random() * 55) | 0),
        mode: pick.modes ? pick.modes[(Math.random() * pick.modes.length) | 0].id : undefined,
      });
    }
    if (Math.random() < 0.3) {
      next.glow = { radius: 1 + ((Math.random() * 3) | 0), intensity: 20 + ((Math.random() * 40) | 0) };
    }
    applySettings(next, 'Random: ' + algo.name + ' · ' + palette.name);
  }

  // ---- wiring ----

  function init() {
    buildAlgorithmSelect();
    buildPaletteSelect();
    buildToneMapSelect();
    buildTextSelect();
    buildEffectList();
    syncEffectChoices();
    buildPresetSelect();
    buildSamplePicker();

    BINDINGS.forEach(function (binding) {
      const def = getPath(D.DEFAULTS, binding.path);
      const resetBinding = function () {
        endHistoryGroup();
        setPath(state.settings, binding.path, def);
        binding.input.value = def;
        binding.label.textContent = binding.fmt(parseFloat(def));
        syncSliderStates();
        render(true);
        syncGroupNotes();
        window.dispatchEvent(new CustomEvent('ds:ui'));
      };
      binding.input.title = 'Double-click to reset to ' + binding.fmt(parseFloat(def));
      binding.input.addEventListener('input', function () {
        beginHistoryGroup('slider:' + binding.path);
        const value = parseFloat(binding.input.value);
        setPath(state.settings, binding.path, value);
        binding.label.textContent = binding.fmt(value);
        syncSliderStates();
        schedulePreview();
      });
      binding.input.addEventListener('change', function () {
        setPath(state.settings, binding.path, parseFloat(binding.input.value));
        syncSliderStates();
        render(true);
        endHistoryGroup();
      });
      binding.input.addEventListener('dblclick', resetBinding);
      const field = binding.input.closest('.field');
      const header = field && field.querySelector(':scope > span');
      if (header) header.addEventListener('dblclick', resetBinding);
    });

    if (el.toneReset) {
      el.toneReset.addEventListener('click', function () {
        endHistoryGroup();
        const d = D.DEFAULTS.adjustments;
        state.settings.adjustments.black = d.black;
        state.settings.adjustments.white = d.white;
        state.settings.adjustments.gamma = d.gamma;
        state.settings.adjustments.brightness = d.brightness;
        state.settings.adjustments.contrast = d.contrast;
        state.settings.adjustments.saturation = d.saturation;
        state.settings.adjustments.hue = d.hue;
        syncUI();
        render(true);
        el.statStatus.textContent = 'Tone reset';
      });
    }
    if (el.detailReset) {
      el.detailReset.addEventListener('click', function () {
        endHistoryGroup();
        const d = D.DEFAULTS.adjustments;
        state.settings.adjustments.blur = d.blur;
        state.settings.adjustments.sharpen = d.sharpen;
        state.settings.adjustments.denoise = d.denoise;
        syncUI();
        render(true);
        el.statStatus.textContent = 'Detail reset';
      });
    }
    if (el.glowReset) {
      el.glowReset.addEventListener('click', function () {
        endHistoryGroup();
        state.settings.glow.radius = D.DEFAULTS.glow.radius;
        state.settings.glow.intensity = D.DEFAULTS.glow.intensity;
        syncUI();
        render(true);
        el.statStatus.textContent = 'Glow reset';
      });
    }
    if (el.effectsClearBtn) {
      el.effectsClearBtn.addEventListener('click', clearStack);
    }

    el.algorithm.addEventListener('change', function () { setAlgorithm(el.algorithm.value); });
    el.algorithmPrev.addEventListener('click', function () { stepAlgorithm(-1); });
    el.algorithmNext.addEventListener('click', function () { stepAlgorithm(1); });

    el.palette.addEventListener('change', function () { setPalette(el.palette.value); });
    el.palettePrev.addEventListener('click', function () { stepPalette(-1); });
    el.paletteNext.addEventListener('click', function () { stepPalette(1); });

    el.effectAdd.addEventListener('change', function () {
      const id = el.effectAdd.value;
      el.effectAdd.value = '';
      if (id) addEffect(id);
    });

    const qualityButtons = Array.prototype.slice.call(el.quality.children);
    qualityButtons.forEach(function (btn, index) {
      btn.addEventListener('click', function () { setQuality(btn.getAttribute('data-value')); });
      btn.addEventListener('keydown', function (event) {
        let next = -1;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % qualityButtons.length;
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + qualityButtons.length) % qualityButtons.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = qualityButtons.length - 1;
        else return;
        event.preventDefault();
        const target = qualityButtons[next];
        setQuality(target.getAttribute('data-value'));
        target.focus();
      });
    });

    el.seed.addEventListener('change', function () {
      endHistoryGroup();
      state.settings.seed = (parseInt(el.seed.value, 10) || 0) >>> 0;
      el.seed.value = state.settings.seed;
      render(true);
    });

    el.reseed.addEventListener('click', function () {
      endHistoryGroup();
      state.settings.seed = (Math.random() * 0xffffffff) >>> 0;
      el.seed.value = state.settings.seed;
      render(true);
    });

    el.denoise.addEventListener('change', function () {
      state.settings.adjustments.denoise = el.denoise.checked;
      render(true);
    });

    el.serpentine.addEventListener('change', function () {
      state.settings.serpentine = el.serpentine.checked;
      render(true);
    });

    el.toneMap.addEventListener('change', function () {
      state.settings.toneMap = el.toneMap.value;
      el.inkCustom.hidden = state.settings.toneMap !== 'custom';
      render(true);
    });

    [el.toneInk, el.tonePaper].forEach(function (input) {
      input.addEventListener('input', function () {
        beginHistoryGroup('tone-colour');
        state.settings.toneInk = hexToRgb(el.toneInk.value);
        state.settings.tonePaper = hexToRgb(el.tonePaper.value);
        schedulePreview();
      });
      input.addEventListener('change', function () {
        state.settings.toneInk = hexToRgb(el.toneInk.value);
        state.settings.tonePaper = hexToRgb(el.tonePaper.value);
        render(true);
        endHistoryGroup();
      });
    });

    el.alphaMode.addEventListener('change', function () {
      state.settings.alphaMode = el.alphaMode.value;
      showAlphaBehind(state.settings.alphaMode);
      render(true);
    });

    el.textMode.addEventListener('change', function () {
      text.on = el.textMode.checked;
      syncTextUI();
      render(true);
    });
    el.textCharset.addEventListener('change', function () {
      text.ramp = el.textCharset.value;
      render(true);
    });
    el.textSize.addEventListener('input', function () {
      beginHistoryGroup('text-size');
      text.size = parseInt(el.textSize.value, 10) || 10;
      el.textSizeValue.textContent = String(text.size);
      syncSliderStates();
      schedulePreview();
    });
    el.textSize.addEventListener('change', function () {
      text.size = parseInt(el.textSize.value, 10) || 10;
      syncSliderStates();
      render(true);
      endHistoryGroup();
    });
    el.textSize.addEventListener('dblclick', function () {
      endHistoryGroup();
      text.size = 10;
      syncTextUI();
      syncSliderStates();
      render(true);
      window.dispatchEvent(new CustomEvent('ds:ui'));
    });
    el.exportTxt.addEventListener('click', exportTXT);
    el.copy.addEventListener('click', copyPNG);
    el.random.addEventListener('click', randomize);

    el.open.addEventListener('click', openImageDialog);
    el.file.addEventListener('change', function () {
      loadFile(el.file.files && el.file.files[0]);
      el.file.value = '';
    });

    el.preset.addEventListener('change', function () {
      const id = el.preset.value;
      el.preset.value = '';
      if (id) applyPreset(id);
    });

    el.presetExport.addEventListener('click', function () {
      state.settings.glitches = deriveGlitches();
      const payload = { app: 'dither-studio', version: 1, settings: state.settings };
      download(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), 'dither-studio-preset.json');
      el.statStatus.textContent = 'Preset exported';
    });

    // One reader for both routes: the file input in the browser build, and the
    // native open dialog (which hands over the text) in the desktop build.
    function applyPresetText(text) {
      try {
        const parsed = JSON.parse(String(text));
        const settings = parsed && parsed.settings ? parsed.settings : parsed;
        applySettings(settings, 'Preset imported');
      } catch (err) {
        el.statStatus.textContent = 'That preset file could not be read';
      }
    }

    el.presetImport.addEventListener('click', function () {
      if (!desktop) { el.presetFile.click(); return; }
      desktop.openJson().then(function (payload) {
        if (!payload) return;
        if (payload.error) { el.statStatus.textContent = payload.error; return; }
        applyPresetText(payload.text);
      }).catch(function () { el.statStatus.textContent = 'The open dialog failed'; });
    });
    el.presetFile.addEventListener('change', function () {
      const file = el.presetFile.files && el.presetFile.files[0];
      el.presetFile.value = '';
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () { applyPresetText(reader.result); };
      reader.readAsText(file);
    });

    el.zoomIn.addEventListener('click', function () { zoomStep(1); });
    el.zoomOut.addEventListener('click', function () { zoomStep(-1); });
    el.zoomFit.addEventListener('click', function () { state.zoom = null; applyZoom(); });
    if (el.zoomToggle) {
      el.zoomToggle.addEventListener('click', function () {
        state.zoom = state.zoom === null ? 1 : null;
        applyZoom();
      });
    }
    if (el.undoBtn) el.undoBtn.addEventListener('click', undoRecipe);
    if (el.redoBtn) el.redoBtn.addEventListener('click', redoRecipe);

    // Ctrl+Wheel zooms the proof cleanly without scaling the window chrome.
    el.wrap.addEventListener('wheel', function (event) {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      zoomStep(event.deltaY < 0 ? 1 : -1);
    }, { passive: false });

    el.compare.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      setCompare(true);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (type) {
      el.compare.addEventListener(type, function () { if (state.compareOn) setCompare(false); });
    });
    el.compare.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setCompare(!state.compareOn);
      }
    });

    el.split.addEventListener('click', function () { setSplit(!state.splitOn); });

    let splitPointer = null;
    el.splitGrip.addEventListener('pointerdown', function (event) {
      if (!state.splitOn) return;
      event.preventDefault();
      splitPointer = event.pointerId;
      try { el.splitGrip.setPointerCapture(event.pointerId); } catch (err) { /* synthetic events */ }
      el.splitGrip.focus();
    });
    el.splitGrip.addEventListener('pointermove', function (event) {
      if (splitPointer !== event.pointerId) return;
      const rect = el.canvas.getBoundingClientRect();
      if (!rect.width) return;
      state.splitAt = clampSplit((event.clientX - rect.left) / rect.width);
      syncSplit();
    });
    ['pointerup', 'pointercancel'].forEach(function (type) {
      el.splitGrip.addEventListener(type, function (event) {
        if (splitPointer === event.pointerId) splitPointer = null;
      });
    });
    el.splitGrip.addEventListener('keydown', function (event) {
      if (!state.splitOn) return;
      let next = state.splitAt;
      if (event.key === 'ArrowLeft') next -= 0.02;
      else if (event.key === 'ArrowRight') next += 0.02;
      else if (event.key === 'Home') next = 0.02;
      else if (event.key === 'End') next = 0.98;
      else return;
      event.preventDefault();
      state.splitAt = clampSplit(next);
      syncSplit();
    });

    el.export.addEventListener('click', exportPNG);

    // Drag the canvas to pan it; two fingers pinch it (touch-action: none on
    // a coarse pointer), so a pan never turns into a page scroll and a pinch
    // never zooms the page behind it.
    const pointers = new Map();
    let pinchFrom = 0;
    let pinchScale = 1;

    function pointerSpread() {
      const list = Array.from(pointers.values());
      return Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y);
    }

    function snapPinch(scale) {
      return PINCH_ZOOM.reduce(function (best, step) {
        return Math.abs(step - scale) < Math.abs(best - scale) ? step : best;
      }, PINCH_ZOOM[0]);
    }

    function endPan() {
      state.panning = null;
      el.canvas.classList.remove('panning');
    }

    let originPointer = null;
    let layerPointer = null;
    el.canvas.addEventListener('pointerdown', function (e) {
      if (state.pickingOrigin) {
        e.preventDefault();
        originPointer = e.pointerId;
        try { el.canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
        beginHistoryGroup('effect:' + state.pickingOrigin + ':origin');
        applyPickedOrigin(state.pickingOrigin, e.clientX, e.clientY);
        return;
      }
      if (layerState.tool === 'pick') {
        e.preventDefault();
        const mode = e.shiftKey ? 'add' : e.altKey ? 'subtract' : 'replace';
        applyCanvasPick(e.clientX, e.clientY, mode);
        return;
      }
      if (layerState.tool === 'fill') {
        e.preventDefault();
        applyCanvasFill(e.clientX, e.clientY, e.altKey ? 0 : 255);
        return;
      }
      if (layerState.tool === 'brush' || layerState.tool === 'erase') {
        e.preventDefault();
        layerPointer = e.pointerId;
        try { el.canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
        applyCanvasBrush(e.clientX, e.clientY, layerState.tool === 'brush' ? 255 : 0);
        return;
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { el.canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
      if (pointers.size === 2) {
        endPan();
        pinchFrom = pointerSpread();
        pinchScale = effectiveScale();
        return;
      }
      if (pointers.size > 2) return;
      if (el.canvas.width * effectiveScale() <= el.wrap.clientWidth + 1 &&
          el.canvas.height * effectiveScale() <= el.wrap.clientHeight + 1) return;
      state.panning = { x: e.clientX, y: e.clientY, left: el.wrap.scrollLeft, top: el.wrap.scrollTop };
      el.canvas.classList.add('panning');
    });
    el.canvas.addEventListener('pointermove', function (e) {
      if (originPointer === e.pointerId && state.pickingOrigin) {
        applyPickedOrigin(state.pickingOrigin, e.clientX, e.clientY);
        return;
      }
      if (layerPointer === e.pointerId && (layerState.tool === 'brush' || layerState.tool === 'erase')) {
        applyCanvasBrush(e.clientX, e.clientY, layerState.tool === 'brush' ? 255 : 0);
        return;
      }
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size > 1) {
        if (!pinchFrom) return;
        const wanted = snapPinch(pinchScale * (pointerSpread() / pinchFrom));
        if (state.zoom !== wanted) { state.zoom = wanted; applyZoom(); }
        return;
      }
      if (!state.panning) return;
      el.wrap.scrollLeft = state.panning.left - (e.clientX - state.panning.x);
      el.wrap.scrollTop = state.panning.top - (e.clientY - state.panning.y);
    });
    ['pointerup', 'pointercancel'].forEach(function (type) {
      el.canvas.addEventListener(type, function (e) {
        if (originPointer === e.pointerId) {
          originPointer = null;
          if (state.pickingOrigin) {
            render(true);
            endHistoryGroup();
            const placed = state.pickingOrigin;
            setPickingOrigin(null);
            const pt = glitches.origin[placed];
            if (pt) el.statStatus.textContent = 'Origin set to ' + pt.x + '%, ' + pt.y + '%';
          }
          return;
        }
        if (layerPointer === e.pointerId) {
          layerPointer = null;
          renderLayerList();
          render(true);
          return;
        }
        pointers.delete(e.pointerId);
        if (pointers.size < 2) pinchFrom = 0;
        if (!pointers.size) endPan();
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && state.pickingOrigin) {
        originPointer = null;
        setPickingOrigin(null);
        el.statStatus.textContent = 'Origin pick cancelled';
      } else if (e.key === 'Escape' && layerState.tool) {
        layerPointer = null;
        setLayerTool(null);
        el.statStatus.textContent = 'Layer tool off';
      }
    });

    // drop and paste
    ['dragenter', 'dragover'].forEach(function (type) {
      el.wrap.addEventListener(type, function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        el.statStatus.textContent = 'Drop to load';
      });
    });
    el.wrap.addEventListener('drop', function (e) {
      e.preventDefault();
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      loadFile(file);
    });
    window.addEventListener('paste', function (e) {
      const items = (e.clipboardData && e.clipboardData.items) || [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') === 0) {
          loadFile(items[i].getAsFile());
          return;
        }
      }
    });

    window.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (window.DitherModal && window.DitherModal.anyOpen()) return;
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === 'c' || e.key === 'C') setCompare(true);
      else if (e.key === 'r' || e.key === 'R') randomize();
      else if (e.key === '+' || e.key === '=') zoomStep(1);
      else if (e.key === '-' || e.key === '_') zoomStep(-1);
      else if (e.key === '0') { state.zoom = null; applyZoom(); }
    });
    window.addEventListener('keyup', function (e) {
      if (e.key === 'c' || e.key === 'C') {
        if (state.compareOn) setCompare(false);
      }
    });

    // Horizontal wheel scrolling + edge-fade hints for the dock tab strip.
    function syncTabFades() {
      if (!el.jump) return;
      const max = el.jump.scrollWidth - el.jump.clientWidth;
      el.jump.classList.toggle('can-scroll-left', el.jump.scrollLeft > 2);
      el.jump.classList.toggle('can-scroll-right', max > 2 && el.jump.scrollLeft < max - 2);
    }
    if (el.jump) {
      el.jump.addEventListener('wheel', function (event) {
        if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
          el.jump.scrollLeft += event.deltaY;
          event.preventDefault();
          syncTabFades();
        }
      }, { passive: false });
      el.jump.addEventListener('scroll', syncTabFades, { passive: true });
    }

    // Resizable panel dock (280..460px, default 336px, double-click to reset).
    (function initDockResizer() {
      if (!el.dockResizer) return;
      const STORE = 'dither-studio.dock-w';
      const MIN = 280;
      const MAX = 460;
      const DEF = 336;
      function applyDockWidth(px, persist) {
        const w = Math.max(MIN, Math.min(MAX, Math.round(px)));
        document.documentElement.style.setProperty('--dock-w', w + 'px');
        el.dockResizer.setAttribute('aria-valuenow', String(w));
        if (persist) {
          try { window.localStorage.setItem(STORE, String(w)); } catch (err) { /* ignore */ }
        }
        applyZoom();
        syncTabFades();
      }
      try {
        const saved = parseInt(window.localStorage.getItem(STORE), 10);
        if (saved >= MIN && saved <= MAX) applyDockWidth(saved, false);
      } catch (err) { /* ignore */ }

      let dragging = false;
      el.dockResizer.addEventListener('pointerdown', function (event) {
        event.preventDefault();
        dragging = true;
        el.dockResizer.classList.add('is-dragging');
        try { el.dockResizer.setPointerCapture(event.pointerId); } catch (err) { /* ignore */ }
      });
      el.dockResizer.addEventListener('pointermove', function (event) {
        if (!dragging) return;
        applyDockWidth(window.innerWidth - event.clientX, false);
      });
      ['pointerup', 'pointercancel'].forEach(function (type) {
        el.dockResizer.addEventListener(type, function () {
          if (!dragging) return;
          dragging = false;
          el.dockResizer.classList.remove('is-dragging');
          const cur = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--dock-w'), 10) || DEF;
          applyDockWidth(cur, true);
        });
      });
      el.dockResizer.addEventListener('dblclick', function () { applyDockWidth(DEF, true); });
      el.dockResizer.addEventListener('keydown', function (event) {
        const cur = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--dock-w'), 10) || DEF;
        if (event.key === 'ArrowLeft') { event.preventDefault(); applyDockWidth(cur + 16, true); }
        else if (event.key === 'ArrowRight') { event.preventDefault(); applyDockWidth(cur - 16, true); }
        else if (event.key === 'Home') { event.preventDefault(); applyDockWidth(DEF, true); }
      });
    }());

    window.addEventListener('resize', function () { applyZoom(); syncTabFades(); });

    function bindLayers() {
      ensureLayersInit();
      renderLayerList();
      if (el.layersEnabled) {
        el.layersEnabled.addEventListener('change', function () {
          enableLayers(el.layersEnabled.checked);
        });
      }
      if (el.layersShowMask) {
        el.layersShowMask.addEventListener('change', function () {
          layerState.showMask = !!el.layersShowMask.checked;
          if (state.result && !text.on) drawResultToCanvas(state.result, true);
          else render(true);
        });
      }
      if (el.layersDetect) el.layersDetect.addEventListener('click', detectObjectLayers);
      if (el.layersPick) el.layersPick.addEventListener('click', function () { setLayerTool('pick'); });
      if (el.layersFill) el.layersFill.addEventListener('click', function () { setLayerTool('fill'); });
      if (el.layersBrush) el.layersBrush.addEventListener('click', function () { setLayerTool('brush'); });
      if (el.layersErase) el.layersErase.addEventListener('click', function () { setLayerTool('erase'); });
      if (el.layersFillHoles) el.layersFillHoles.addEventListener('click', fillActiveMaskHoles);
      if (el.layersFillAll) el.layersFillAll.addEventListener('click', fillActiveMaskAll);
      if (el.layersClearMask) el.layersClearMask.addEventListener('click', clearActiveMask);
      if (el.layersPostFx) {
        el.layersPostFx.addEventListener('click', function () {
          if (!layerState.enabled) enableLayers(true, true);
          selectLayer('post');
          runCommand('window-panel-open', 'effects');
        });
      }
      if (el.effectsLayerPost) {
        el.effectsLayerPost.addEventListener('click', function () {
          selectLayer('post');
        });
      }
      if (el.layersTolerance) {
        el.layersTolerance.addEventListener('input', function () {
          layerState.tolerance = parseInt(el.layersTolerance.value, 10) || 34;
          if (el.layersToleranceValue) el.layersToleranceValue.textContent = String(layerState.tolerance);
        });
      }
      if (el.layersFeather) {
        el.layersFeather.addEventListener('input', function () {
          layerState.feather = parseInt(el.layersFeather.value, 10) || 0;
          if (el.layersFeatherValue) el.layersFeatherValue.textContent = String(layerState.feather);
          if (layerState.enabled) schedulePreview();
        });
        el.layersFeather.addEventListener('change', function () {
          if (layerState.enabled) render(true);
        });
      }
      if (el.layersBrushSize) {
        el.layersBrushSize.addEventListener('input', function () {
          layerState.brushSize = parseInt(el.layersBrushSize.value, 10) || 28;
          if (el.layersBrushSizeValue) el.layersBrushSizeValue.textContent = String(layerState.brushSize);
        });
      }
      if (el.layersContiguous) {
        el.layersContiguous.addEventListener('change', function () {
          layerState.contiguous = !!el.layersContiguous.checked;
        });
      }
      if (el.layersOpacity) {
        el.layersOpacity.addEventListener('input', function () {
          const active = activeLayer();
          const pct = parseInt(el.layersOpacity.value, 10);
          active.opacity = Math.max(0, Math.min(1, pct / 100));
          if (el.layersOpacityValue) el.layersOpacityValue.textContent = String(pct);
          if (layerState.enabled) schedulePreview();
        });
        el.layersOpacity.addEventListener('change', function () {
          if (layerState.enabled) render(true);
        });
      }
      if (el.layersInvert) {
        el.layersInvert.addEventListener('change', function () {
          const active = activeLayer();
          active.inverted = !!el.layersInvert.checked;
          renderLayerList();
          if (layerState.enabled) render(true);
        });
      }
      if (el.layersAdd) el.layersAdd.addEventListener('click', addEmptyObjectLayer);
      if (el.layersClear) el.layersClear.addEventListener('click', function () { clearObjectLayers(false); });
      if (el.pressLayerJump) {
        el.pressLayerJump.addEventListener('click', function () {
          runCommand('window-panel-open', 'layers');
        });
      }
    }

    buildJump();
    initGroups();
    loadGroups();
    initConsole();
    // With no saved stations, nothing above has marked the strip yet, and the
    // chip strip is also the position readout (and the console bar's subject).
    markJump();
    syncTabFades();
    setQuality(state.quality);
    bindLayers();
    syncUI();
    bindVideo();
    loadSample(0);
  }

  // ---- video mode ----

  // video.js owns the source, the clock and the recorder; this shell decides
  // what a frame *means*. The temporal choice is the interesting part:
  //   freeze  - one screen for the whole clip (the calm, stable look)
  //   shimmer - a fresh seed per frame, so stochastic screens boil and the
  //             tone stays put
  //   crawl   - the screen itself slides by a pixel per frame (tile screens)
  const video = (window.DitherVideo && window.DitherVideo.create)
    ? window.DitherVideo.create({
      onFrame: renderVideoFrame,
      onStatus: videoStatus,
      getCanvas: function () { return el.canvas; },
    })
    : null;
  const videoState = { temporal: 'shimmer', ready: false };

  // The animation timeline is a separate controller, like video.js: it owns
  // the clock and the track rows, while this shell decides what a frame means.
  const animation = (window.DitherAnimation && window.DitherAnimation.create)
    ? window.DitherAnimation.create({
      getBaseSettings: function () { return state.settings; },
      onFrame: renderAnimationFrame,
      onStop: function () {
        el.statStatus.setAttribute('aria-live', 'polite');
        el.statStatus.textContent = 'Animation closed';
        render(true);
      },
      onStatus: function (text) { el.statStatus.textContent = text; },
      getCanvas: function () { return el.canvas; },
      download: download,
    })
    : null;

  function startAnimation() {
    if (!state.source) {
      el.statStatus.textContent = 'Open an image first';
      return false;
    }
    if (state.videoOn) videoStop();
    setCompare(false);
    if (state.splitOn) setSplit(false);
    setGroup('motion', true);
    revealGroup('motion');
    if (!animation) {
      el.statStatus.textContent = 'The animation controller did not load';
      return false;
    }
    return animation.start();
  }

  function renderAnimationFrame(settings, frameIndex, total) {
    if (!state.source) return 0;
    const t0 = performance.now();
    const res = D.process(state.source, settings);
    state.result = res;
    if (el.canvas.width !== res.width || el.canvas.height !== res.height) {
      el.canvas.width = res.width;
      el.canvas.height = res.height;
      applyZoom();
    }
    showAlphaBehind(settings.alphaMode);
    if (!(text.on && drawTextResult(res, settings))) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.putImageData(toImageData(res), 0, 0);
    }
    updateStats(res, true);
    el.statStatus.setAttribute('aria-live', 'off');
    el.statStatus.textContent = 'Animation · frame ' + (frameIndex + 1) + ' / ' + total;
    return performance.now() - t0;
  }

  function videoStatus(text) {
    el.videoNote.textContent = text;
  }

  // The recipe travels per frame, so sliders and presets keep working during
  // playback; only the temporal rule varies frame to frame. That rule lives
  // in the core (D.temporalSettings), where node test.js can cover it.
  function videoSettingsFor(frameIndex) {
    const s = state.settings;
    const next = {};
    for (const key in s) next[key] = s[key];
    next.adjustments = {};
    for (const key in s.adjustments) next.adjustments[key] = s.adjustments[key];
    next.screen = { smooth: s.screen.smooth, flow: s.screen.flow, streak: s.screen.streak };
    next.glow = { radius: s.glow.radius, intensity: s.glow.intensity };
    next.glitches = deriveGlitches();
    return D.temporalSettings(next, frameIndex, videoState.temporal);
  }

  // The status bar during video mode: frame, rate, drops, and a REC flag. The
  // render loop calls it every frame, and the transport controls call it too,
  // so stopping a recording does not leave a stale "REC" behind.
  function videoStatusLine() {
    if (!video) return;
    const s = video.stats();
    const frame = Math.max(0, s.frame - 1);
    const tail = (s.dropped ? ' · ' + s.dropped + ' dropped' : '') + (s.recording ? ' · REC' : '');
    el.statFile.textContent = 'video frame ' + frame;
    el.statStatus.setAttribute('aria-live', s.playing ? 'off' : 'polite');
    el.statStatus.textContent = 'Video ' + s.fps + ' fps' + tail;
    if (el.videoReadout) {
      el.videoReadout.textContent = 'frame ' + frame + ' · ' + s.fps + ' fps' + tail;
    }
  }

  function renderVideoFrame(imageData, frameIndex) {
    const settings = videoSettingsFor(frameIndex);
    const t0 = performance.now();
    const res = D.process(imageData, settings);
    state.result = res;
    if (el.canvas.width !== res.width || el.canvas.height !== res.height) {
      el.canvas.width = res.width;
      el.canvas.height = res.height;
      applyZoom();
    }
    showAlphaBehind(settings.alphaMode);
    if (!(text.on && drawTextResult(res))) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.putImageData(toImageData(res), 0, 0);
    }
    updateStats(res, true);
    videoStatusLine();
    return performance.now() - t0;
  }

  function videoShowRows(show) {
    el.videoFpsRow.hidden = !show;
    el.videoTemporalRow.hidden = !show;
    el.videoRecordRow.hidden = !show;
    el.transport.hidden = !show;
    el.videoToggle.disabled = !show;
    syncGroupNotes();
  }

  async function startVideo(kind, file) {
    if (!video) {
      videoStatus('Video mode needs video.js, which did not load.');
      return false;
    }
    if (animation && animation.isActive()) animation.stop();
    try {
      if (kind === 'webcam') await video.webcam();
      else await video.load(file);
    } catch (err) {
      videoStatus('Video could not start: ' + ((err && err.message) || 'unknown error'));
      return false;
    }
    videoState.ready = true;
    state.videoOn = true;
    state.splitOn = false;
    syncSplit();
    resetHistory();
    state.stillName = state.name;   // so the rail reads the still again afterwards
    state.name = kind === 'webcam' ? 'webcam' : 'video';
    state.zoom = null;
    videoShowRows(true);
    el.videoToggle.textContent = 'Play';
    video.setFps(el.videoFps.value);
    videoState.temporal = el.videoTemporal.value;
    video.tickOnce();          // paint frame zero right away, even while paused
    applyZoom();
    return true;
  }

  function startSynthetic(width, height) {
    if (!video) return null;
    video.synthetic(width, height);
    videoState.ready = true;
    state.videoOn = true;
    state.splitOn = false;
    syncSplit();
    resetHistory();
    state.stillName = state.name;
    state.name = 'video';
    state.zoom = null;
    videoShowRows(true);
    el.videoToggle.textContent = 'Play';
    video.setFps(el.videoFps.value);
    videoState.temporal = el.videoTemporal.value;
    return video.tickOnce();
  }

  function videoStop() {
    if (!state.videoOn) return;
    state.videoOn = false;
    videoState.ready = false;
    state.name = state.stillName || state.name;
    resetHistory();
    if (video) {
      if (video.recording) video.stopRecording();
      video.release();
    }
    el.videoToggle.textContent = 'Play';
    videoShowRows(false);
    el.statFile.textContent = state.name;
    el.statStatus.setAttribute('aria-live', 'polite');
    el.statStatus.textContent = 'Ready';
    videoStatus('Play a clip or the webcam through the press. Transport and frame readout sit under the viewport.');
  }

  function bindVideo() {
    if (!video) {
      videoStatus('Video mode needs video.js, which did not load.');
      return;
    }
    video.setFps(el.videoFps.value);
    el.videoOpen.addEventListener('click', function () {
      if (!desktop) { el.videoFile.click(); return; }
      desktop.openVideo().then(function (payload) {
        if (!payload) return;
        if (payload.error) { videoStatus(payload.error); return; }
        startVideo('file', payloadFile(payload, 'clip', 'video/mp4'));
      }).catch(function () { videoStatus('The open dialog failed'); });
    });
    el.videoFile.addEventListener('change', function () {
      const file = el.videoFile.files && el.videoFile.files[0];
      if (file) startVideo('file', file);
      el.videoFile.value = '';
    });
    el.videoWebcam.addEventListener('click', function () {
      videoStatus('Asking for the webcam…');
      startVideo('webcam');
    });
    el.videoToggle.addEventListener('click', function () {
      const playing = video.toggle();
      el.videoToggle.textContent = playing ? 'Pause' : 'Play';
      videoStatusLine();
    });
    el.videoFps.addEventListener('input', function () {
      el.videoFpsValue.textContent = String(video.setFps(el.videoFps.value));
    });
    el.videoTemporal.addEventListener('change', function () {
      videoState.temporal = el.videoTemporal.value;
      videoStatus(videoState.temporal === 'freeze'
        ? 'Frozen: one screen for the whole clip.'
        : videoState.temporal === 'crawl'
          ? 'Crawl: tile screens slide a pixel per frame.'
          : 'Shimmer: a fresh screen every frame.');
    });
    el.videoRecord.addEventListener('click', function () {
      if (video.recording) {
        el.videoRecord.disabled = true;
        video.stopRecording().then(function (out) {
          el.videoRecord.disabled = false;
          el.videoRecord.textContent = '● Record WebM';
          if (out && out.blob && out.blob.size) {
            download(out.blob, 'dither-video.webm', out.seconds * 1000);
            videoStatus('Saved dither-video.webm · ' + out.seconds + ' s · ' +
              Math.round(out.blob.size / 1024) + ' KB');
          } else {
            videoStatus('The recording came out empty.');
          }
          videoStatusLine();
        });
        return;
      }
      if (video.startRecording()) {
        el.videoRecord.textContent = '■ Stop & save';
      } else {
        videoStatus('Recording is not supported in this browser.');
      }
    });
  }

  // ---- debug hook (also what tools/check.sh asserts against) ----

  window.__dither = {
    stats: function () {
      return {
        file: state.name,
        width: el.canvas.width,
        height: el.canvas.height,
        algorithm: state.settings.algorithm,
        palette: state.settings.palette,
        pixelSize: state.settings.pixelSize,
        ditherStrength: state.settings.ditherStrength,
        serpentine: state.settings.serpentine,
        toneMap: state.settings.toneMap,
        alphaMode: state.settings.alphaMode,
        textMode: text.on,
        colors: state.result ? state.result.colors : null,
        ms: state.result ? Math.round(state.result.ms) : null,
        zoom: el.statZoom.textContent,
        quality: state.quality,
        effects: activeEffects(),
        plugins: window.DitherPlugins ? window.DitherPlugins.installed().map(function (p) { return p.id; }) : [],
        animation: animation ? animation.stats() : null,
        openGroups: GROUPS.filter(function (g) { return groupOpen(g.id); })
          .map(function (g) { return g.id; }),
        glitches: deriveGlitches().map(function (g) {
          return g.id + ':' + g.amount + (g.mode ? ':' + g.mode : '');
        }),
        status: el.statStatus.textContent,
      };
    },
    applyPreset: function (id) { applyPreset(id); },
    randomize: randomize,
    exportTxt: exportTXT,
    // --- plugins, animation and the plugin tools --------------------------
    pluginsOpen: openPluginManager,
    featureMenuOpen: openFeatureMenu,
    featureMenuClose: closeFeatureMenu,
    featureMenuState: function () { return window.DitherFeatureMenu ? window.DitherFeatureMenu.state() : null; },
    featureMenuRefresh: function () { return window.DitherFeatureMenu ? window.DitherFeatureMenu.refresh() : false; },
    pluginsInstall: function (id) { return window.DitherPlugins ? window.DitherPlugins.install(id) : null; },
    pluginsRemove: function (id) { return window.DitherPlugins ? window.DitherPlugins.remove(id) : false; },
    pluginsInstalled: function () { return window.DitherPlugins ? window.DitherPlugins.installed() : []; },
    pluginPresets: function () { return window.DitherPlugins ? window.DitherPlugins.presets() : []; },
    pluginPalettes: function () { return window.DitherPlugins ? window.DitherPlugins.palettes() : []; },
    extractPalette: function (count, method) {
      if (!state.original) return null;
      return Core.extractPalette(state.original.data, state.original.width, state.original.height, count, method);
    },
    inkExtractorOpen: openInkExtractor,
    colorSchemeOpen: openColorSchemeMaker,
    colorSchemeState: function () { return window.DitherColorScheme ? window.DitherColorScheme.state() : null; },
    colorSchemeGenerate: function () { return window.DitherColorScheme ? window.DitherColorScheme.generate() : null; },
    colorSchemeSave: function () { return window.DitherColorScheme ? window.DitherColorScheme.save() : false; },
    colorSchemeImport: function () { return window.DitherColorScheme ? window.DitherColorScheme.importValue() : false; },
    colorSchemeSeed: function () { return window.DitherColorScheme ? window.DitherColorScheme.seedFromImage() : false; },
    colorSchemePack: function () { return window.DitherColorScheme ? window.DitherColorScheme.pack() : null; },
    animationStart: startAnimation,
    animationStop: function () { return animation ? animation.stop() : false; },
    animationPlay: function () { return animation ? animation.play() : false; },
    animationPause: function () { return animation ? animation.pause() : false; },
    animationTick: function (index) { return animation ? animation.tick(index) : null; },
    animationAddTrack: function (id) { return animation ? animation.addTrack(id) : null; },
    animationStats: function () { return animation ? animation.stats() : null; },
    animationFrameSettings: function (index) { return animation ? animation.frameSettings(index) : null; },
    animationRecord: function () { return animation ? animation.record() : false; },
    // --- layers & object detection ----------------------------------------
    layersState: function () {
      ensureLayersInit();
      return {
        enabled: !!layerState.enabled,
        showMask: !!layerState.showMask,
        tool: layerState.tool,
        activeId: layerState.activeId,
        count: layerState.items.length,
        post: {
          visible: !!layerState.post.visible,
          effects: (layerState.post.settings.glitches || []).map(function (g) { return g.id; }),
          glow: layerState.post.settings.glow,
        },
        items: layerState.items.map(function (l) {
          return {
            id: l.id,
            name: l.name,
            isBase: !!l.isBase,
            visible: !!l.visible,
            opacity: l.opacity,
            inverted: !!l.inverted,
            algorithm: l.settings.algorithm,
            palette: l.settings.palette,
          };
        }),
      };
    },
    enableLayers: function (on) { return enableLayers(on); },
    detectObjects: detectObjectLayers,
    selectLayer: function (id) { return selectLayer(id); },
    addObjectLayer: addEmptyObjectLayer,
    clearObjectLayers: function () { clearObjectLayers(false); },
    setLayerTool: function (tool) { setLayerTool(tool); return layerState.tool; },
    fillMaskHoles: fillActiveMaskHoles,
    fillMaskAll: fillActiveMaskAll,
    clearMask: clearActiveMask,
    bucketFillMask: applyMaskBucketFill,
    // Test hook: load a synthetic source (a data URL) without a file dialog.
    loadDataURL: function (url, name) {
      const img = new Image();
      img.onload = function () { loadBitmap(img, name || 'test image'); };
      img.onerror = function () { el.statStatus.textContent = 'That test image did not load'; };
      img.src = url;
    },
    deriveGlitches: deriveGlitches,
    // --- the effects stack and the rail ----------------------------------
    activeEffects: activeEffects,
    addEffect: function (id) { addEffect(id); return activeEffects(); },
    removeEffect: function (id) { removeEffect(id); return activeEffects(); },
    moveEffect: function (index, delta) { moveEffect(index, delta); return activeEffects(); },
    groups: function () {
      return GROUPS.map(function (g) {
        const group = groupEl(g.id);
        const note = group ? group.querySelector('.group-note') : null;
        return { id: g.id, open: groupOpen(g.id), note: note ? note.textContent : '' };
      });
    },
    setGroup: function (id, open) { setGroup(id, open); return groupOpen(id); },
    quality: function () { return state.quality; },
    setQuality: function (mode) { return setQuality(mode); },
    swatches: function () { return el.swatches.children.length; },
    stepAlgorithm: function (delta) { return stepAlgorithm(delta === undefined ? 1 : delta); },
    stepPalette: function (delta) { return stepPalette(delta === undefined ? 1 : delta); },
    setText: function (on, ramp, size) {
      text.on = !!on;
      if (ramp) text.ramp = ramp;
      if (size) text.size = size;
      syncTextUI();
      render(true);
    },
    textGrid: function () {
      if (!state.result) return null;
      const grid = textGrid(state.result);
      return { cols: grid.cols, rows: grid.rows, cell: grid.cell, lines: grid.lines };
    },
    // Drawn alpha values, for checking a dithered or kept matte.
    alphaStats: function () {
      const data = ctx.getImageData(0, 0, el.canvas.width, el.canvas.height).data;
      let min = 255, max = 0;
      const levels = new Set();
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < min) min = data[i];
        if (data[i] > max) max = data[i];
        if (levels.size < 64) levels.add(data[i]);
      }
      return { min: min, max: max, count: levels.size, levels: Array.from(levels).sort(function (a, b) { return a - b; }) };
    },
    setSetting: function (path, value) {
      setPath(state.settings, path, value);
      syncUI();
      render(true);
    },
    // Test hooks: import through the same parser and registration the dialog
    // uses, and read back what is stored. No dialog, no synthetic clicks.
    importPaletteText: function (text, fallbackName) {
      try {
        const result = importPalette(Core.parsePaletteText(text, fallbackName));
        return result.ok ? result.id : null;
      } catch (err) {
        el.statStatus.textContent = err && err.message ? err.message : 'That palette could not be imported';
        return null;
      }
    },
    customPalettes: savedPaletteEntries,
    paletteManagerOpen: openPaletteManager,
    paletteManagerState: function () {
      return window.DitherPaletteManager ? window.DitherPaletteManager.state() : null;
    },
    // unique colours actually drawn on the canvas: verifies palette membership
    canvasColors: function () {
      const data = ctx.getImageData(0, 0, el.canvas.width, el.canvas.height).data;
      const set = new Set();
      for (let i = 0; i < data.length; i += 4) set.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
      return set.size;
    },
    // Sampled canvas greys, so a check can measure how much two frames differ.
    canvasSample: function (count) {
      const data = ctx.getImageData(0, 0, el.canvas.width, el.canvas.height).data;
      const total = el.canvas.width * el.canvas.height;
      const n = Math.max(1, count || 64);
      const out = [];
      for (let i = 0; i < n; i++) {
        const p = Math.floor((i + 0.5) * total / n);
        out.push(data[p * 4]);
      }
      return out;
    },
    // The settings a given video frame is dithered with (the temporal rule).
    videoSettings: function (frame) {
      const s = videoSettingsFor(frame);
      return { seed: s.seed, screenShift: s.screenShift, baseSeed: state.settings.seed };
    },
    // A cheap fingerprint of what is on the canvas, for comparing frames.
    canvasHash: function () {
      const data = ctx.getImageData(0, 0, el.canvas.width, el.canvas.height).data;
      let h = 2166136261;
      for (let i = 0; i < data.length; i += 97) h = Math.imul(h ^ data[i], 16777619);
      return h >>> 0;
    },

    // --- video mode (needs video.js; the generated clip needs no file) -----
    videoSynthetic: function (w, h) { return startSynthetic(w, h); },
    videoTick: function (count, atFrame) {
      if (!video) return null;
      let stats = null;
      const n = Math.max(1, count || 1);
      for (let i = 0; i < n; i++) stats = video.tickOnce(atFrame);
      return stats;
    },
    videoPlay: function () {
      if (!video) return false;
      video.play();
      el.videoToggle.textContent = 'Pause';
      return video.playing;
    },
    videoPause: function () {
      if (!video) return false;
      video.pause();
      el.videoToggle.textContent = 'Play';
      return video.playing;
    },
    videoTemporal: function (mode) {
      videoState.temporal = mode;
      el.videoTemporal.value = mode;
      return videoState.temporal;
    },
    videoStop: videoStop,
    videoStats: function () { return video ? video.stats() : null; },
    // Record for `ms` of wall clock and report what came out, without a download.
    videoRecord: function (ms) {
      if (!video || !video.startRecording()) return Promise.resolve(null);
      return new Promise(function (resolve) {
        setTimeout(function () {
          video.stopRecording().then(function (out) {
            el.videoRecord.textContent = '● Record WebM';
            videoStatusLine();
            resolve(out ? { seconds: out.seconds, bytes: out.blob.size, type: out.blob.type } : null);
          });
        }, Math.max(200, ms || 1200));
      });
    },
  };

  // ---- commands: one name per verb the menus and the tool rail can run ----

  // Everything the chrome can ask for, by name. The menus in menu-spec.js
  // and the tool rail (renderer/shell.js) both speak this vocabulary, so the
  // chrome never needs to know how a control works - only what it is called.
  function setSelectValue(node, value) {
    if (value === undefined || value === null) return false;
    node.value = value;
    if (node.value !== value) return false;
    node.dispatchEvent(new Event('change'));
    return true;
  }

  function stepSeed(delta) {
    endHistoryGroup();
    state.settings.seed = ((state.settings.seed || 0) + (delta || 1) * 7919) >>> 0;
    el.seed.value = state.settings.seed;
    render(true);
    syncUI();
  }

  function resetEveryControl() {
    applySettings(D.mergeSettings(D.DEFAULTS), 'Reset');
  }

  // Panels live in one scrolling dock, so 'show that panel' means open it
  // and bring it into sight rather than switching a tab.
  function revealGroup(id) {
    const group = groupEl(id);
    if (group && group.scrollIntoView) group.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function clearStack() {
    endHistoryGroup();
    activeEffects().slice().forEach(function (id) { removeEffect(id); });
    syncUI();
    render(true);
  }

  // The studio menu is a view, not a second settings store: it asks the app
  // for a fresh snapshot each time it paints, and its actions are the same
  // functions the menu bar and the panels already use.
  function featureMenuSnapshot() {
    const installed = window.DitherPlugins ? window.DitherPlugins.installed().slice() : [];
    installed.sort(function (a, b) {
      const aTool = a.kind === 'tool' ? 0 : 1;
      const bTool = b.kind === 'tool' ? 0 : 1;
      if (aTool !== bTool) return aTool - bTool;
      return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
    });
    const effects = activeEffects().map(function (id) {
      const meta = effectMeta(id);
      const mode = glitches.mode[id];
      const modeMeta = (meta.modes || []).find(function (entry) { return entry.id === mode; });
      return {
        id: id,
        name: meta.name,
        amount: glitches.amount[id],
        mode: modeMeta ? modeMeta.name : '',
        origin: meta.origin ? glitches.origin[id] : null,
      };
    });
    const presets = PRESETS_SORTED.map(function (preset) {
      const settings = preset.settings || {};
      const palette = paletteById(settings.palette);
      return {
        id: preset.id,
        name: preset.name,
        group: presetGroup(preset),
        subtitle: algorithmById(settings.algorithm).name + ' · ' + palette.name,
        colors: palette.colors,
      };
    });
    const saved = savedPaletteEntries();
    return {
      stats: {
        plugins: installed.length,
        effects: effects.length,
        presets: presets.length,
        savedPalettes: saved.length,
      },
      plugins: installed.map(function (pkg) {
        return {
          id: pkg.id,
          name: pkg.name,
          kind: pkg.kind,
          version: pkg.version,
          summary: pkg.summary,
        };
      }),
      effects: effects,
      presets: presets,
      palettes: saved,
    };
  }

  function openFeatureMenu() {
    if (!window.DitherFeatureMenu) {
      el.statStatus.textContent = 'The studio menu is not available';
      return false;
    }
    if (window.DitherFeatureMenu.isOpen()) {
      window.DitherFeatureMenu.close();
      return true;
    }
    return window.DitherFeatureMenu.open({
      data: featureMenuSnapshot,
      openPlugin: openPlugin,
      openPluginManager: openPluginManager,
      openPaletteManager: openPaletteManager,
      openPanel: function (id) { runCommand('window-panel-open', id); },
      toggleEffect: function (id) { removeEffect(id); },
      clearEffects: clearStack,
      applyPreset: applyPreset,
      selectPalette: setPalette,
    });
  }

  function closeFeatureMenu() {
    if (window.DitherFeatureMenu && window.DitherFeatureMenu.isOpen()) {
      window.DitherFeatureMenu.close();
    }
  }

  // A shelf row is a verb, not a shortcut to the manager. Tool packages open
  // their own dialog; effect plugins join the stack and show the effects panel;
  // packs open the shelf they feed. Only an unknown package falls back to the
  // manager, where its install details live.
  function openPlugin(id) {
    const pkg = window.DitherPlugins && window.DitherPlugins.installed().find(function (entry) {
      return entry.id === id;
    });
    if (!pkg) return openPluginManager();
    if (id === 'ink-extractor') return openInkExtractor();
    if (id === 'color-scheme-maker') return openColorSchemeMaker();
    const effect = pkg.capability && D.GLITCHES.find(function (g) { return g.plugin === pkg.capability; });
    if (effect) {
      closeFeatureMenu();
      if (!glitches.on[effect.id]) addEffect(effect.id);
      runCommand('window-panel-open', 'effects');
      return true;
    }
    if (pkg.kind === 'preset-pack') {
      closeFeatureMenu();
      runCommand('window-panel-open', 'preset');
      return true;
    }
    if (pkg.kind === 'palette-pack') {
      closeFeatureMenu();
      const first = D.PALETTES.find(function (palette) { return palette.plugin === pkg.id; });
      if (first) setPalette(first.id);
      runCommand('window-panel-open', 'press');
      return true;
    }
    return openPluginManager();
  }
  if (window.DitherPlugins && window.DitherPlugins.setOpener) {
    window.DitherPlugins.setOpener(openPlugin);
  }

  function openPluginManager() {
    closeFeatureMenu();
    if (!window.DitherPlugins) {
      el.statStatus.textContent = 'The plugin manager is not available';
      return false;
    }
    return window.DitherPlugins.open();
  }

  function openInkExtractor() {
    closeFeatureMenu();
    const pkg = window.DitherPlugins && window.DitherPlugins.tool('ink-extractor');
    if (!pkg) {
      el.statStatus.textContent = 'Install Ink Extractor from File › Plugin Manager first';
      return false;
    }
    if (!window.DitherInkExtractor) {
      el.statStatus.textContent = 'The Ink Extractor dialog is not available';
      return false;
    }
    return window.DitherInkExtractor.open({
      methods: pkg.data.methods && pkg.data.methods.length ? pkg.data.methods : Core.EXTRACT_METHODS,
      defaultCount: pkg.data.defaultCount || 8,
      getSource: function () { return state.original; },
      sourceName: function () { return state.name; },
      onImport: importPalette,
    });
  }

  function openColorSchemeMaker(options) {
    closeFeatureMenu();
    const pkg = window.DitherPlugins && window.DitherPlugins.tool('color-scheme-maker');
    if (!pkg) {
      el.statStatus.textContent = 'Install Color Scheme Maker from File › Plugin Manager first';
      return false;
    }
    if (!window.DitherColorScheme) {
      el.statStatus.textContent = 'The Color Scheme Maker dialog is not available';
      return false;
    }
    const settings = {
      count: pkg.data.defaultCount || 6,
      harmony: pkg.data.defaultHarmony || 'analogous',
      getCurrent: function () { return paletteById(state.settings.palette); },
      onSave: importPalette,
      getImageColors: function (count, method) {
        if (!window.DitherPlugins || !window.DitherPlugins.tool('ink-extractor')) {
          return { error: 'Install Ink Extractor from File › Plugin Manager to seed from an image' };
        }
        if (!state.original) return { error: 'Open an image first, then seed the scheme from it' };
        try {
          return Core.extractPalette(state.original.data, state.original.width, state.original.height, count, method);
        } catch (err) {
          return { error: err && err.message ? err.message : 'The open image did not yield a palette' };
        }
      },
      onExport: function (pack) {
        const text = JSON.stringify(pack, null, 2) + '\n';
        const name = pack.id + '.json';
        if (desktop && desktop.saveText) {
          return desktop.saveText({ name: name, text: text, mime: 'application/json' }).then(function (out) {
            if (out && out.path) {
              state.savedPath = out.path;
              window.dispatchEvent(new CustomEvent('ds:saved', { detail: { path: out.path, name: out.name } }));
            }
            return out;
          });
        }
        download(new Blob([text], { type: 'application/json' }), name);
        return { name: name, downloaded: true };
      },
    };
    if (options && options.editId) {
      settings.editId = options.editId;
      settings.name = options.name;
      settings.colors = options.colors;
    }
    return window.DitherColorScheme.open(settings);
  }

  function openPaletteManager() {
    closeFeatureMenu();
    if (!window.DitherPaletteManager) {
      el.statStatus.textContent = 'The palette manager is not available';
      return false;
    }
    return window.DitherPaletteManager.open({
      list: savedPaletteEntries,
      onRename: renameSavedPalette,
      onDelete: deleteSavedPalette,
      onEdit: function (id) {
        const entry = savedPaletteById(id);
        if (!entry) return { ok: false, error: 'That saved palette no longer exists' };
        const opened = openColorSchemeMaker({ editId: entry.id, name: entry.name, colors: entry.colors });
        if (!opened) return { ok: false, error: 'Install Color Scheme Maker from File › Plugin Manager first' };
        return true;
      },
    });
  }

  function animationCommand(action) {
    if (!animation) {
      el.statStatus.textContent = 'The animation controller did not load';
      return false;
    }
    if (action === 'start') return startAnimation();
    if (action === 'export') {
      if (!animation.isActive()) startAnimation();
      return animation.record();
    }
    if (action === 'stop') return animation.stop();
    if (!animation.isActive()) startAnimation();
    if (animation.isPlaying()) animation.pause();
    else animation.play();
    return true;
  }

  const COMMANDS = {
    'file-open': function () { openImageDialog(); },
    'file-plugin-manager': openPluginManager,
    'file-extract-palette': openInkExtractor,
    'file-color-scheme': openColorSchemeMaker,
    'file-manage-palettes': openPaletteManager,
    'file-import-palette': function () {
      closeFeatureMenu();
      if (!window.DitherPaletteImport) {
        el.statStatus.textContent = 'The palette importer is not available';
        return;
      }
      window.DitherPaletteImport.open(importPalette);
    },
    'file-open-clip': function () { el.videoOpen.click(); },
    'file-demo': function () { loadSample(); },
    'file-save-png': function () { exportPNG(); },
    'file-copy-png': function () { copyPNG(); },
    'file-export-txt': function () { exportTXT(); },
    'file-export-preset': function () { el.presetExport.click(); },
    'file-import-preset': function () { el.presetImport.click(); },
    'file-quit': function () { if (desktop) desktop.quit(); },
    'motion-start': function () { return animationCommand('start'); },
    'motion-toggle': function () { return animationCommand('toggle'); },
    'motion-stop': function () { return animationCommand('stop'); },
    'motion-export': function () { return animationCommand('export'); },
    'edit-undo': undoRecipe,
    'edit-redo': redoRecipe,
    'edit-random': function () { randomize(); },
    'edit-reseed': function () { stepSeed(1); },
    'edit-reset': resetEveryControl,
    'image-tonemap': function (arg) { setSelectValue(el.toneMap, arg); },
    'image-alpha': function (arg) { setSelectValue(el.alphaMode, arg); },
    'image-textmode': function () { el.textMode.click(); },
    'image-ramp': function (arg) { setSelectValue(el.textCharset, arg); },
    'press-algorithm': function (arg) { setAlgorithm(arg); },
    'press-palette': function (arg) { setPalette(arg); },
    'press-step-algorithm': function (arg) { stepAlgorithm(arg === undefined ? 1 : arg); },
    'press-step-palette': function (arg) { stepPalette(arg === undefined ? 1 : arg); },
    'press-serpentine': function () { el.serpentine.click(); },
    'press-preset': function (arg) { applyPreset(arg); },
    'effects-add': function (arg) { addEffect(arg); },
    'effects-clear': clearStack,
    'view-feature-menu': openFeatureMenu,
    'view-zoom-in': function () { zoomStep(1); },
    'view-zoom-out': function () { zoomStep(-1); },
    'view-zoom-fit': function () { state.zoom = null; applyZoom(); },
    'view-quality': function (arg) { setQuality(arg); },
    'view-compare': function (arg) { setCompare(arg === undefined ? !state.compareOn : !!arg); },
    'view-split': function (arg) { setSplit(arg === undefined ? !state.splitOn : !!arg); },
    // Opening a station and toggling one are different verbs: the tutorial asks
    // for a panel to be open and must not close it if it already is. The menus
    // keep the toggle, because toggling is what clicking a menu item means.
    'window-panel-open': function (id) {
      if (!id) return;
      setGroup(id, true);
      revealGroup(id);
    },
    'window-panel': function (id) {
      if (!id) return;
      const toOpen = !groupOpen(id);
      setGroup(id, toOpen);
      if (toOpen) revealGroup(id);
    },
    // And the third case: a verb that only ever closes. The tutorial puts the
    // Learn station away with it - a toggle would open it again next time.
    'window-panel-close': function (id) {
      if (!id) return;
      setGroup(id, false);
    },
    'window-panels-open': function () { GROUPS.forEach(function (g) { setGroup(g.id, true); }); },
    'window-panels-collapse': function () { GROUPS.forEach(function (g) { setGroup(g.id, false); }); },
  };

  function runCommand(name, arg) {
    const fn = COMMANDS[name];
    if (!fn) { el.statStatus.textContent = 'Nothing is wired to ' + name; return false; }
    endHistoryGroup();
    fn(arg);
    syncUI();
    return true;
  }

  // What the chrome and the menu ticks read: one flat object, no promises.
  function currentState() {
    return {
      name: state.name,
      path: state.path || null,
      savedPath: state.savedPath || null,
      algorithm: state.settings.algorithm,
      palette: state.settings.palette,
      toneMap: state.settings.toneMap,
      alphaMode: state.settings.alphaMode,
      preset: state.settings.preset || '',
      quality: state.quality,
      seed: state.settings.seed,
      textMode: !!text.on,
      textRamp: text.ramp,
      serpentine: !!state.settings.serpentine,
      compare: !!state.compareOn,
      split: !!state.splitOn,
      learnVisible: !(window.DitherTour && window.DitherTour.hidden && window.DitherTour.hidden()),
      canUndo: history.past.length > 1,
      canRedo: history.future.length > 0,
      effects: activeEffects(),
      plugins: window.DitherPlugins ? window.DitherPlugins.installed().map(function (p) { return p.id; }) : [],
      layers: {
        enabled: !!layerState.enabled,
        count: layerState.items.length,
        activeId: layerState.activeId,
        activeName: layerState.items.length ? activeLayer().name : 'Background',
      },
      animation: animation ? animation.stats() : null,
      openGroups: GROUPS.filter(function (g) { return groupOpen(g.id); }).map(function (g) { return g.id; }),
      status: el.statStatus.textContent,
      width: el.canvas.width,
      height: el.canvas.height,
    };
  }

  window.DS = {
    command: runCommand,
    commands: Object.keys(COMMANDS),
    state: currentState,
    syncUI: syncUI,
    desktop: !!desktop,
    platform: desktop ? desktop.platform : 'web',
    groups: GROUPS.map(function (g) { return g.id; }),
    catalogues: {
      ALGORITHMS: D.ALGORITHMS,
      PALETTES: PALETTES_SORTED,
      GLITCHES: availableGlitches(),
      TONE_MAPS: TONE_MAPS_SORTED,
      PRESETS: PRESETS_SORTED,
      TEXT_RAMPS: TEXT_RAMPS_SORTED,
    },
  };

  init();
})();
