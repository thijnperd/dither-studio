/* sync-renderer.js — how the desktop renderer stays in step with the core.
 *
 * The desktop app runs the SAME dithering engine as the two web versions, so it
 * does not fork it: this tool copies `dither.js` and `video.js` across verbatim,
 * and rebuilds `src/renderer/app.js` from the repository's `app.js` by applying
 * the patches below.
 *
 * That makes the difference between the app and the website exactly ten hunks,
 * every one of them about the desktop *shell* (native dialogs, native clipboard,
 * the command surface the menu bar drives) and none of them about dithering:
 *
 *     node desktop/tools/sync-renderer.js          # regenerate
 *     node desktop/tools/sync-renderer.js --check   # fail if out of step
 *
 * Every patch asserts that it matched exactly once, so a change to the frozen
 * source that invalidates a hunk is a loud failure, never a silent half-copy.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DESKTOP = path.join(__dirname, '..');
const ROOT = path.join(DESKTOP, '..');
const OUT = path.join(DESKTOP, 'src', 'renderer');
const CHECK = process.argv.includes('--check');

/* ------------------------------------------------------------------ */
/* the ten hunks                                                       */
/* ------------------------------------------------------------------ */

const PATCHES = [
  {
    label: 'P1 · the bridge constant',
    from: "  const $ = function (id) { return document.getElementById(id); };",
    to: [
      "  const $ = function (id) { return document.getElementById(id); };",
      "",
      "  // The desktop build has a native bridge (electron/preload.js); the browser",
      "  // build simply does not. Every use below is guarded, so this one constant is",
      "  // the whole difference between the app in its own window and the web version.",
      "  const desktop = window.ditherDesktop || null;",
    ].join('\n'),
  },
  {
    label: 'P2 · bytes from the main process + the native open route',
    from: [
      "    img.onerror = function () { el.statStatus.textContent = 'Could not read that image'; };",
      "    img.src = url;",
      "  }",
    ].join('\n'),
    to: [
      "    img.onerror = function () { el.statStatus.textContent = 'Could not read that image'; };",
      "    img.src = url;",
      "  }",
      "",
      "  // The desktop route into the same code: the main process reads the file and",
      "  // hands over bytes, so no file:// URL ever reaches the canvas (Chromium treats",
      "  // a file image in a file page as an opaque origin, which would taint it).",
      "  function loadPayload(payload) {",
      "    if (!payload) { el.statStatus.textContent = 'Open cancelled'; return false; }",
      "    if (payload.error) { el.statStatus.textContent = payload.error; return false; }",
      "    const view = payload.bytes instanceof ArrayBuffer ? new Uint8Array(payload.bytes) : payload.bytes;",
      "    const bytes = view instanceof Uint8Array ? view : new Uint8Array(view);",
      "    loadFile(new File([bytes], payload.name || 'image', { type: payload.mime || 'image/png' }));",
      "    state.path = payload.path || null;",
      "    return true;",
      "  }",
      "",
      "  function openImageDialog() {",
      "    if (!desktop) { el.file.click(); return; }",
      "    desktop.openImage().then(loadPayload).catch(function () {",
      "      el.statStatus.textContent = 'The open dialog failed';",
      "    });",
      "  }",
    ].join('\n'),
  },
  {
    label: 'P3 · download() asks the operating system where the file goes',
    from: [
      "  function download(blob, filename) {",
      "    const url = URL.createObjectURL(blob);",
    ].join('\n'),
    to: [
      "  function download(blob, filename) {",
      "    // Desktop: the operating system asks where the file goes, and the path it",
      "    // returns is the receipt the title bar shows.",
      "    if (desktop) {",
      "      blob.arrayBuffer().then(function (data) {",
      "        return desktop.saveBlob({ name: filename, mime: blob.type || 'application/octet-stream', data: data });",
      "      }).then(function (out) {",
      "        if (!out) { el.statStatus.textContent = 'Save cancelled'; return; }",
      "        if (out.error) { el.statStatus.textContent = out.error; return; }",
      "        state.savedPath = out.path;",
      "        window.dispatchEvent(new CustomEvent('ds:saved', { detail: { path: out.path, name: out.name } }));",
      "      }).catch(function () { el.statStatus.textContent = 'That file could not be saved'; });",
      "      return;",
      "    }",
      "    const url = URL.createObjectURL(blob);",
    ].join('\n'),
  },
  {
    label: 'P4 · Open image uses the native dialog',
    from: "    el.open.addEventListener('click', function () { el.file.click(); });",
    to: "    el.open.addEventListener('click', openImageDialog);",
  },
  {
    label: 'P5 · preset import through the native dialog',
    from: [
      "    el.presetImport.addEventListener('click', function () { el.presetFile.click(); });",
      "    el.presetFile.addEventListener('change', function () {",
      "      const file = el.presetFile.files && el.presetFile.files[0];",
      "      el.presetFile.value = '';",
      "      if (!file) return;",
      "      const reader = new FileReader();",
      "      reader.onload = function () {",
      "        try {",
      "          const parsed = JSON.parse(String(reader.result));",
      "          const settings = parsed && parsed.settings ? parsed.settings : parsed;",
      "          applySettings(settings, 'Preset imported');",
      "        } catch (err) {",
      "          el.statStatus.textContent = 'That preset file could not be read';",
      "        }",
      "      };",
      "      reader.readAsText(file);",
      "    });",
    ].join('\n'),
    to: [
      "    // One reader for both routes: the file input in the browser build, and the",
      "    // native open dialog (which hands over the text) in the desktop build.",
      "    function applyPresetText(text) {",
      "      try {",
      "        const parsed = JSON.parse(String(text));",
      "        const settings = parsed && parsed.settings ? parsed.settings : parsed;",
      "        applySettings(settings, 'Preset imported');",
      "      } catch (err) {",
      "        el.statStatus.textContent = 'That preset file could not be read';",
      "      }",
      "    }",
      "",
      "    el.presetImport.addEventListener('click', function () {",
      "      if (!desktop) { el.presetFile.click(); return; }",
      "      desktop.openJson().then(function (payload) {",
      "        if (!payload) return;",
      "        if (payload.error) { el.statStatus.textContent = payload.error; return; }",
      "        applyPresetText(payload.text);",
      "      }).catch(function () { el.statStatus.textContent = 'The open dialog failed'; });",
      "    });",
      "    el.presetFile.addEventListener('change', function () {",
      "      const file = el.presetFile.files && el.presetFile.files[0];",
      "      el.presetFile.value = '';",
      "      if (!file) return;",
      "      const reader = new FileReader();",
      "      reader.onload = function () { applyPresetText(reader.result); };",
      "      reader.readAsText(file);",
      "    });",
    ].join('\n'),
  },
  {
    label: 'P6 · the clipboard goes through Electron',
    from: [
      "  function copyPNG() {",
      "    if (!state.source && !state.videoOn) return;",
      "    render(true);",
      "    el.canvas.toBlob(function (blob) {",
    ].join('\n'),
    to: [
      "  function copyPNG() {",
      "    if (!state.source && !state.videoOn) return;",
      "    render(true);",
      "    if (desktop) {",
      "      el.canvas.toBlob(function (blob) {",
      "        if (!blob) return;",
      "        blob.arrayBuffer().then(function (data) {",
      "          return desktop.copyImage({ mime: 'image/png', data: data });",
      "        }).then(function (out) {",
      "          if (!out || out.error) el.statStatus.textContent = 'The clipboard refused that image';",
      "          else el.statStatus.textContent = 'Proof copied — ' + out.size.width + '×' + out.size.height;",
      "        }).catch(function () { el.statStatus.textContent = 'The clipboard refused that image'; });",
      "      }, 'image/png');",
      "      return;",
      "    }",
      "    el.canvas.toBlob(function (blob) {",
    ].join('\n'),
  },
  {
    label: 'P7 · the compare view remembers that it is on',
    from: [
      "  function setCompare(on) {",
      "    if (!state.original) return;",
    ].join('\n'),
    to: [
      "  function setCompare(on) {",
      "    state.compareOn = !!on;",
      "    if (!state.original) return;",
    ].join('\n'),
  },
  {
    label: 'P8 · one event after every UI sync',
    from: [
      "    buildSwatches();",
      "    syncGroupNotes();",
      "  }",
    ].join('\n'),
    to: [
      "    buildSwatches();",
      "    syncGroupNotes();",
      "    // The desktop chrome — the title bar, the menu ticks, the filled part of",
      "    // every slider — listens for this one event instead of reaching in here.",
      "    window.dispatchEvent(new CustomEvent('ds:ui'));",
      "  }",
    ].join('\n'),
  },
  {
    label: 'P9 · a clip opens through the native dialog',
    from: "    el.videoOpen.addEventListener('click', function () { el.videoFile.click(); });",
    to: [
      "    el.videoOpen.addEventListener('click', function () {",
      "      if (!desktop) { el.videoFile.click(); return; }",
      "      desktop.openVideo().then(function (payload) {",
      "        if (!payload) return;",
      "        if (payload.error) { videoStatus(payload.error); return; }",
      "        const view = payload.bytes instanceof ArrayBuffer ? new Uint8Array(payload.bytes) : payload.bytes;",
      "        const bytes = view instanceof Uint8Array ? view : new Uint8Array(view);",
      "        startVideo('file', new File([bytes], payload.name || 'clip', { type: payload.mime || 'video/mp4' }));",
      "      }).catch(function () { videoStatus('The open dialog failed'); });",
      "    });",
    ].join('\n'),
  },
  {
    label: 'P10 · the command surface the menus and the tool rail drive',
    from: [
      "  init();",
      "})();",
    ].join('\n'),
    to: [
      "  /* ------------------------------------------------------------------ */",
      "  /* commands: one name per verb the menus and the tool rail can run      */",
      "  /* ------------------------------------------------------------------ */",
      "",
      "  // Everything the chrome can ask for, by name. The menus in menu-spec.js and",
      "  // the tool rail (renderer/shell.js) both speak this vocabulary, so the chrome",
      "  // never needs to know how a control works — only what it is called.",
      "  function setSelectValue(node, value) {",
      "    if (value === undefined || value === null) return false;",
      "    node.value = value;",
      "    if (node.value !== value) return false;",
      "    node.dispatchEvent(new Event('change'));",
      "    return true;",
      "  }",
      "",
      "  function stepSeed(delta) {",
      "    state.settings.seed = ((state.settings.seed || 0) + (delta || 1) * 7919) >>> 0;",
      "    el.seed.value = state.settings.seed;",
      "    render(true);",
      "    syncUI();",
      "  }",
      "",
      "  function resetEveryControl() {",
      "    applySettings(D.mergeSettings(D.DEFAULTS), 'Reset');",
      "  }",
      "",
      "  // Panels live in one scrolling dock, so 'show that panel' means open it",
      "  // and bring it into sight rather than switching a tab.",
      "  function revealGroup(id) {",
      "    const group = groupEl(id);",
      "    if (group && group.scrollIntoView) group.scrollIntoView({ block: 'nearest', behavior: 'smooth' });",
      "  }",
      "",
      "  function clearStack() {",
      "    activeEffects().slice().forEach(function (id) { removeEffect(id); });",
      "    syncUI();",
      "    render(true);",
      "  }",
      "",
      "  const COMMANDS = {",
      "    'file-open': function () { openImageDialog(); },",
      "    'file-open-clip': function () { el.videoOpen.click(); },",
      "    'file-demo': function () { loadDemo(); },",
      "    'file-save-png': function () { exportPNG(); },",
      "    'file-copy-png': function () { copyPNG(); },",
      "    'file-export-txt': function () { exportTXT(); },",
      "    'file-export-preset': function () { el.presetExport.click(); },",
      "    'file-import-preset': function () { el.presetImport.click(); },",
      "    'file-quit': function () { if (desktop) desktop.quit(); },",
      "    'edit-random': function () { randomize(); },",
      "    'edit-reseed': function () { stepSeed(1); },",
      "    'edit-reset': resetEveryControl,",
      "    'image-tonemap': function (arg) { setSelectValue(el.toneMap, arg); },",
      "    'image-alpha': function (arg) { setSelectValue(el.alphaMode, arg); },",
      "    'image-textmode': function () { el.textMode.click(); },",
      "    'image-ramp': function (arg) { setSelectValue(el.textCharset, arg); },",
      "    'press-algorithm': function (arg) { setAlgorithm(arg); },",
      "    'press-palette': function (arg) { setPalette(arg); },",
      "    'press-step-algorithm': function (arg) { stepAlgorithm(arg === undefined ? 1 : arg); },",
      "    'press-step-palette': function (arg) { stepPalette(arg === undefined ? 1 : arg); },",
      "    'press-serpentine': function () { el.serpentine.click(); },",
      "    'press-preset': function (arg) { applyPreset(arg); },",
      "    'effects-add': function (arg) { addEffect(arg); },",
      "    'effects-clear': clearStack,",
      "    'view-zoom-in': function () { zoomStep(1); },",
      "    'view-zoom-out': function () { zoomStep(-1); },",
      "    'view-zoom-fit': function () { state.zoom = null; applyZoom(); },",
      "    'view-quality': function (arg) { setQuality(arg); },",
      "    'view-compare': function (arg) { setCompare(arg === undefined ? !state.compareOn : !!arg); },",
      "    'window-panel': function (id) {",
      "      if (!id) return;",
      "      const toOpen = !groupOpen(id);",
      "      setGroup(id, toOpen);",
      "      if (toOpen) revealGroup(id);",
      "    },",
      "    'window-panels-open': function () { GROUPS.forEach(function (g) { setGroup(g.id, true); }); },",
      "    'window-panels-collapse': function () { GROUPS.forEach(function (g) { setGroup(g.id, false); }); },",
      "  };",
      "",
      "  function runCommand(name, arg) {",
      "    const fn = COMMANDS[name];",
      "    if (!fn) { el.statStatus.textContent = 'Nothing is wired to ' + name; return false; }",
      "    fn(arg);",
      "    syncUI();",
      "    return true;",
      "  }",
      "",
      "  // What the chrome and the menu ticks read: one flat object, no promises.",
      "  function currentState() {",
      "    return {",
      "      name: state.name,",
      "      path: state.path || null,",
      "      savedPath: state.savedPath || null,",
      "      algorithm: state.settings.algorithm,",
      "      palette: state.settings.palette,",
      "      toneMap: state.settings.toneMap,",
      "      alphaMode: state.settings.alphaMode,",
      "      preset: state.settings.preset || '',",
      "      quality: state.quality,",
      "      seed: state.settings.seed,",
      "      textMode: !!text.on,",
      "      textRamp: text.ramp,",
      "      serpentine: !!state.settings.serpentine,",
      "      compare: !!state.compareOn,",
      "      effects: activeEffects(),",
      "      openGroups: GROUPS.filter(function (g) { return groupOpen(g.id); }).map(function (g) { return g.id; }),",
      "      status: el.statStatus.textContent,",
      "      width: el.canvas.width,",
      "      height: el.canvas.height,",
      "    };",
      "  }",
      "",
      "  window.DS = {",
      "    command: runCommand,",
      "    commands: Object.keys(COMMANDS),",
      "    state: currentState,",
      "    syncUI: syncUI,",
      "    desktop: !!desktop,",
      "    platform: desktop ? desktop.platform : 'web',",
      "    groups: GROUPS.map(function (g) { return g.id; }),",
      "    catalogues: {",
      "      ALGORITHMS: D.ALGORITHMS,",
      "      PALETTES: D.PALETTES,",
      "      GLITCHES: D.GLITCHES,",
      "      TONE_MAPS: D.TONE_MAPS,",
      "      PRESETS: PRESETS,",
      "      TEXT_RAMPS: TEXT_RAMPS,",
      "    },",
      "  };",
      "",
      "  init();",
      "})();",
    ].join('\n'),
  },
];

/* ------------------------------------------------------------------ */

function patchApp(source) {
  let out = source;
  PATCHES.forEach(function (patch) {
    const parts = out.split(patch.from);
    if (parts.length !== 2) {
      throw new Error('[' + patch.label + '] matched ' + (parts.length - 1) + ' times, expected exactly 1 — '
        + 'the shared app.js changed shape, so this hunk needs revisiting');
    }
    out = parts.join(patch.to);
  });
  return out;
}

function regenerate() {
  const copies = ['dither.js', 'video.js'];
  const produced = {};
  copies.forEach(function (name) {
    produced[name] = fs.readFileSync(path.join(ROOT, name), 'utf8');
  });
  produced['app.js'] = patchApp(fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8'));
  return produced;
}

function main() {
  const produced = regenerate();
  if (CHECK) {
    const stale = Object.keys(produced).filter(function (name) {
      const target = path.join(OUT, name);
      return !fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== produced[name];
    });
    if (stale.length) {
      console.error('out of step with the shared core: ' + stale.join(', '));
      console.error('run: node desktop/tools/sync-renderer.js');
      process.exit(1);
    }
    console.log('desktop renderer is in step with the shared core (' + Object.keys(produced).length + ' files, '
      + PATCHES.length + ' hunks)');
    return;
  }
  fs.mkdirSync(OUT, { recursive: true });
  Object.keys(produced).forEach(function (name) {
    const target = path.join(OUT, name);
    const before = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
    if (before === produced[name]) {
      console.log('unchanged  ' + name);
      return;
    }
    fs.writeFileSync(target, produced[name]);
    console.log('written    ' + name + '  (' + produced[name].split('\n').length + ' lines)');
  });
  console.log(PATCHES.length + ' hunks applied from ' + path.relative(process.cwd(), ROOT));
}

main();
