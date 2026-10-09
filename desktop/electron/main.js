/* main.js — the desktop shell around the press.
 *
 * What belongs here and nowhere else:
 *   - the window itself (frameless, so the app draws its own caption bar);
 *   - the startup splash, shown while the renderer boots;
 *   - everything the operating system owns: open/save dialogs, the clipboard,
 *     the real application menu (a genuine macOS menu bar, and the accelerator
 *     table on Windows and Linux);
 *   - reading files OFF disk and handing the renderer bytes, never a path it
 *     would have to fetch (a file:// image would taint the canvas).
 *
 * What does NOT belong here: any dithering, any panel, any algorithm name. The
 * renderer expands the menu tree (src/menu-spec.js plus the app's own
 * catalogues) and sends it over, so this file stays free of the catalogue.
 *
 * Test affordances, all opt-in through the environment so a human double-click
 * never hits them:
 *   --smoke                    boot, verify, screenshot, exit with a verdict
 *   --smoke-script <file.js>   evaluate a script in the page before capturing
 *   DITHER_SMOKE_SAVE=<path>   answer every save dialog with this path
 *   DITHER_SMOKE_OPEN=<path>   answer every open dialog with this file
 *   DITHER_SPLASH_MS=<ms>      override how long the splash stays up
 *   DITHER_SPLASH_AT=<ms>      freeze the splash animation at that moment and
 *                              hold it there (how its stages are photographed)
 */
'use strict';

const { app, BrowserWindow, Menu, dialog, ipcMain, shell, clipboard, nativeImage } = require('electron');
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');

const APP_ROOT = path.join(__dirname, '..');
// The splash plays a fixed animation — two hands reaching, then the left one
// dithered and glowing — and this is what the window waits for before it opens.
// It matches the animation's own total (T.settle in splash.html): raise one
// without the other and the app either cuts the animation short or leaves a
// finished splash sitting over an open window.
const SPLASH_MIN_MS = Number(process.env.DITHER_SPLASH_MS || 2900);
const SMOKE = process.argv.includes('--smoke');
const SMOKE_SCRIPT = (function () {
  const i = process.argv.indexOf('--smoke-script');
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
}());

const MIME_BY_EXT = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.bmp': 'image/bmp',
  '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v', '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo',
  '.json': 'application/json', '.txt': 'text/plain',
};

const IMAGE_FILTERS = [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'] }];
const VIDEO_FILTERS = [{ name: 'Clips', extensions: ['mp4', 'webm', 'mov', 'm4v', 'mkv', 'avi'] }];

let mainWindow = null;
let splashWindow = null;
let splashShownAt = 0;
let menuTree = null;
let menuState = {};
let pendingPaths = [];

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function mimeFor(file) {
  return MIME_BY_EXT[path.extname(file || '').toLowerCase()] || 'application/octet-stream';
}

// Read a file into the shape the renderer expects: bytes, plus the name and
// path it only ever uses for display and for the save dialog's default folder.
async function readPayload(file) {
  const bytes = await fs.readFile(file);
  return { name: path.basename(file), path: file, mime: mimeFor(file), bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

function command(name, arg) {
  send('ds:command', { name, arg });
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.focus();
}

function answerOpen(options) {
  // A smoke run may not open a dialog: it would block with nobody to click.
  if (process.env.DITHER_SMOKE_OPEN) return Promise.resolve(process.env.DITHER_SMOKE_OPEN);
  return dialog.showOpenDialog(mainWindow, options).then(function (out) {
    return out.canceled || !out.filePaths.length ? null : out.filePaths[0];
  });
}

function answerSave(options) {
  if (process.env.DITHER_SMOKE_SAVE) return Promise.resolve(process.env.DITHER_SMOKE_SAVE);
  return dialog.showSaveDialog(mainWindow, options).then(function (out) {
    return out.canceled || !out.filePath ? null : out.filePath;
  });
}

/* ------------------------------------------------------------------ */
/* windows                                                             */
/* ------------------------------------------------------------------ */

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 560,
    height: 280,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    hasShadow: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  // Only what is set goes into the URL: `at=` with an empty value still reads
  // as "there is an at" in the page, which would hold it on frame 0.
  const query = { boot: String(SPLASH_MIN_MS) };
  // A smoke run can stop the animation on any frame and photograph it; a normal
  // boot never sets this.
  if (process.env.DITHER_SPLASH_AT) query.at = process.env.DITHER_SPLASH_AT;
  splashWindow.loadFile(path.join(__dirname, 'splash.html'), { query: query });
  splashWindow.once('ready-to-show', function () {
    if (!splashWindow || splashWindow.isDestroyed()) return;
    splashWindow.show();
    splashShownAt = Date.now();
    if (SMOKE) scheduleSplashCapture();
  });
  return splashWindow;
}

function closeSplashWhenDue() {
  if (!splashWindow || splashWindow.isDestroyed()) return;
  const waited = Date.now() - splashShownAt;
  const left = splashShownAt ? Math.max(0, SPLASH_MIN_MS - waited) : SPLASH_MIN_MS;
  setTimeout(function () {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.destroy();
    splashWindow = null;
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.focus();
  }, left);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1340,
    height: 880,
    minWidth: 1000,
    minHeight: 660,
    show: false,
    frame: false,
    backgroundColor: '#0e0f13',
    title: 'Dither Studio',
    icon: path.join(APP_ROOT, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      // A local, offline app: no window.open, no navigation away.
      webSecurity: true,
    },
  });

  mainWindow.loadFile(path.join(APP_ROOT, 'src', 'index.html'));

  mainWindow.once('ready-to-show', function () {
    mainWindow.show();
    closeSplashWhenDue();
    if (pendingPaths.length) {
      const paths = pendingPaths.slice();
      pendingPaths = [];
      send('ds:open-paths', paths);
    }
  });

  mainWindow.on('maximize', function () { send('ds:window-state', { maximized: true }); });
  mainWindow.on('unmaximize', function () { send('ds:window-state', { maximized: false }); });
  mainWindow.on('closed', function () { mainWindow = null; });

  // The app is a single page: nothing may navigate it away or spawn windows.
  mainWindow.webContents.setWindowOpenHandler(function (details) {
    if (/^https?:/.test(details.url)) shell.openExternal(details.url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', function (event) { event.preventDefault(); });
}

/* ------------------------------------------------------------------ */
/* the native menu (built from the tree the renderer sends)             */
/* ------------------------------------------------------------------ */

function leafTemplate(node) {
  const item = {
    label: node.label,
    accelerator: node.accel || undefined,
    click: function () { command(node.command, node.arg); },
  };
  if (node.radio) {
    item.type = 'radio';
    item.checked = !!menuState[node.check + ':' + node.arg] || menuState[node.check] === node.arg;
    if (typeof node.arg === 'number') item.checked = String(menuState[node.check]) === String(node.arg);
  } else if (node.check) {
    item.type = 'checkbox';
    item.checked = !!menuState[node.check + ':' + node.arg] || !!menuState[node.check];
    if (typeof node.arg === 'string') item.checked = !!menuState[node.check + ':' + node.arg];
  }
  return item;
}

function nodeTemplate(node) {
  if (node.type === 'sep') return { type: 'separator' };
  if (node.submenu && node.submenu.length) {
    return { label: node.label, submenu: node.submenu.map(nodeTemplate) };
  }
  return leafTemplate(node);
}

// macOS wants an application menu first; Windows and Linux must not have one
// (it would draw an empty bar). Everything else is identical.
function buildMenu(tree) {
  const template = tree.map(function (menu) {
    return { label: menu.label, submenu: menu.items.map(nodeTemplate) };
  });
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [
        { label: 'About Dither Studio', click: function () { command('help-about'); } },
        { type: 'separator' },
        { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
        { type: 'separator' },
        { label: 'Quit Dither Studio', accelerator: 'Cmd+Q', click: function () { command('file-quit'); } },
      ],
    });
  }
  return Menu.buildFromTemplate(template);
}

function installMenu(tree) {
  menuTree = tree;
  Menu.setApplicationMenu(buildMenu(tree));
}

/* ------------------------------------------------------------------ */
/* ipc: files and the clipboard                                        */
/* ------------------------------------------------------------------ */

ipcMain.handle('ds:open-image', async function () {
  const file = await answerOpen({ title: 'Open an image', filters: IMAGE_FILTERS, properties: ['openFile'] });
  if (!file) return null;
  try { return await readPayload(file); }
  catch (err) { return { error: 'Could not read ' + path.basename(file) }; }
});

ipcMain.handle('ds:open-video', async function () {
  const file = await answerOpen({ title: 'Open a clip', filters: VIDEO_FILTERS, properties: ['openFile'] });
  if (!file) return null;
  try { return await readPayload(file); }
  catch (err) { return { error: 'Could not read ' + path.basename(file) }; }
});

ipcMain.handle('ds:open-json', async function () {
  const file = await answerOpen({
    title: 'Import a preset',
    filters: [{ name: 'Dither Studio preset', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (!file) return null;
  try {
    const text = await fs.readFile(file, 'utf8');
    return { name: path.basename(file), path: file, text: text };
  } catch (err) { return { error: 'Could not read ' + path.basename(file) }; }
});

ipcMain.handle('ds:save-blob', async function (_event, payload) {
  if (!payload || !payload.name) return null;
  const filters = payload.mime === 'image/png'
    ? [{ name: 'PNG image', extensions: ['png'] }]
    : payload.mime === 'application/json'
      ? [{ name: 'JSON', extensions: ['json'] }]
      : [{ name: 'Files', extensions: ['*'] }];
  const target = await answerSave({ title: 'Save the proof', defaultPath: payload.name, filters: filters });
  if (!target) return null;
  try {
    await fs.writeFile(target, Buffer.from(payload.data));
    return { path: target, name: path.basename(target) };
  } catch (err) { return { error: 'Could not write ' + path.basename(target) }; }
});

ipcMain.handle('ds:save-text', async function (_event, payload) {
  if (!payload || !payload.name) return null;
  const target = await answerSave({
    title: 'Save the text proof',
    defaultPath: payload.name,
    filters: [{ name: 'Text', extensions: ['txt'] }],
  });
  if (!target) return null;
  try {
    await fs.writeFile(target, String(payload.text), 'utf8');
    return { path: target, name: path.basename(target) };
  } catch (err) { return { error: 'Could not write ' + path.basename(target) }; }
});

ipcMain.handle('ds:copy-image', async function (_event, payload) {
  try {
    const image = nativeImage.createFromBuffer(Buffer.from(payload.data));
    if (image.isEmpty()) return { error: 'empty image' };
    clipboard.writeImage(image);
    return { ok: true, size: image.getSize() };
  } catch (err) { return { error: String(err && err.message || err) }; }
});

ipcMain.handle('ds:reveal', async function (_event, target) {
  if (!target) return null;
  shell.showItemInFolder(target);
  return { ok: true };
});

ipcMain.handle('ds:open-external', async function (_event, url) {
  if (typeof url !== 'string' || !/^https?:/.test(url)) return null;
  await shell.openExternal(url);
  return { ok: true };
});

/* ------------------------------------------------------------------ */
/* ipc: window, menus, dialogs                                         */
/* ------------------------------------------------------------------ */

ipcMain.handle('ds:win', function (event, action) {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return null;
  if (action === 'minimize') win.minimize();
  else if (action === 'reload') win.webContents.reload();
  else if (action === 'toggle-devtools') win.webContents.toggleDevTools();
  else if (action === 'toggle-fullscreen') win.setFullScreen(!win.isFullScreen());
  else if (action === 'toggle-maximize') { win.isMaximized() ? win.unmaximize() : win.maximize(); }
  else if (action === 'close') win.close();
  else if (action === 'is-maximized') return win.isMaximized();
  return win.isMaximized();
});

ipcMain.handle('ds:about', async function () {
  const out = await dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'About Dither Studio',
    message: 'Dither Studio ' + app.getVersion(),
    detail: [
      'An offline dithering press. 46 algorithms, 24 ink sets, an effects stack,',
      'text mode and video — in its own window, with no network and no account.',
      '',
      'Electron ' + process.versions.electron + ' · Chromium ' + process.versions.chrome + ' · Node ' + process.versions.node,
      '',
      'The dithering core is the same dither.js that runs the web and demo versions.',
    ].join('\n'),
    buttons: ['Close'],
    noLink: true,
  });
  return out;
});

ipcMain.handle('ds:shortcuts', async function () {
  const out = await dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Keyboard Shortcuts',
    message: 'Keyboard shortcuts',
    detail: [
      'Ctrl+O        open an image            Ctrl+S    save the proof as PNG',
      'Ctrl+Shift+O  open a clip              Ctrl+Shift+C  copy the proof',
      'Ctrl+D        demo scene               Ctrl+Shift+I  developer tools',
      '',
      'Ctrl+R        roll a fresh recipe      C         hold to compare',
      'Ctrl+Shift+R  new seed                 + / −     zoom, 0 fits',
      'Ctrl+↑ / ↓    previous / next algorithm',
      'Ctrl+← / →    previous / next palette',
      '',
      'Drag a file onto the proof to load it; Ctrl+V pastes an image.',
    ].join('\n'),
    buttons: ['Close'],
    noLink: true,
  });
  return out;
});

ipcMain.handle('ds:open-guide', async function () {
  const guide = path.join(APP_ROOT, 'GUIDE.md');
  const result = await shell.openPath(guide);
  return result ? { error: result } : { ok: true, path: guide };
});

ipcMain.on('ds:menu', function (_event, tree) { if (Array.isArray(tree)) installMenu(tree); });
ipcMain.on('ds:state', function (_event, state) {
  menuState = state || {};
  if (menuTree) Menu.setApplicationMenu(buildMenu(menuTree));
});
ipcMain.on('ds:quit', function () { app.quit(); });
ipcMain.on('ds:ready', function () {
  if (SMOKE) smokeLooksReady();
});

/* ------------------------------------------------------------------ */
/* smoke harness                                                       */
/* ------------------------------------------------------------------ */

const smoke = {
  console: [],
  errors: [],
  warn: [],
  ready: false,
  result: null,
  shots: [],
  timedOut: false,
};

function note(level, message, source, line) {
  const text = String(message);
  if (level >= 3) smoke.errors.push(text + (source ? ' (' + path.basename(source) + ':' + line + ')' : ''));
  else smoke.console.push(text);
}

let smokeReadyResolve = null;
const smokeReady = new Promise(function (resolve) { smokeReadyResolve = resolve; });

function smokeLooksReady() {
  smoke.ready = true;
  if (smokeReadyResolve) smokeReadyResolve();
}

async function captureTo(win, file) {
  if (!win || win.isDestroyed()) return null;
  const image = await win.webContents.capturePage();
  await fs.writeFile(file, image.toPNG());
  return file;
}

function smokeOutDir() {
  return process.env.DITHER_SMOKE_DIR || require('os').tmpdir();
}

// A smoke run photographs the splash from the splash window itself, at a fixed
// point in the animation. Waiting for the page checks to finish first — as this
// did — missed the splash whenever the renderer took longer to come up than the
// animation lasts, which is the normal case; DITHER_SPLASH_AT freezes the frame,
// so the moment below only decides what a plain run shows.
function scheduleSplashCapture() {
  const wait = Math.max(300, Math.min(2400, SPLASH_MIN_MS - 400));
  setTimeout(async function () {
    if (!splashWindow || splashWindow.isDestroyed()) return;
    try {
      await captureTo(splashWindow, path.join(smokeOutDir(), 'dither-splash.png'));
    } catch (err) { smoke.errors.push('splash capture: ' + err.message); }
  }, wait);
}

// The splash is a file the moment it is photographed, so the report can name it
// whether the run finished before that timer, after it, or while the splash was
// still on screen.
async function collectSplashShot(outDir) {
  const file = path.join(outDir, 'dither-splash.png');
  try {
    if (!fsSync.existsSync(file) && splashWindow && !splashWindow.isDestroyed()) {
      await captureTo(splashWindow, file);
    }
  } catch (err) { /* the splash is already gone; the timer's copy stands */ }
  if (fsSync.existsSync(file) && smoke.shots.indexOf(file) === -1) smoke.shots.push(file);
}

// One key through the window's input pipeline: the only honest way to prove an
// accelerator reaches the app, since a synthetic DOM event would bypass exactly
// the layer under test.
async function pressSmokeKey() {
  // The window has to own the keyboard for a simulated press to be delivered.
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.focus();
  await new Promise(function (resolve) { setTimeout(resolve, 300); });
  const spec = process.env.DITHER_SMOKE_KEY.split('+').map(function (part) { return part.trim(); });
  const key = spec[spec.length - 1];
  const modifiers = spec.slice(0, -1).map(function (part) { return part.toLowerCase(); });
  const keyCode = key.length === 1 ? key.toUpperCase() : key;
  mainWindow.webContents.sendInputEvent({ type: 'keyDown', keyCode: keyCode, modifiers: modifiers });
  mainWindow.webContents.sendInputEvent({ type: 'char', keyCode: key, modifiers: modifiers });
  mainWindow.webContents.sendInputEvent({ type: 'keyUp', keyCode: keyCode, modifiers: modifiers });
  await new Promise(function (resolve) { setTimeout(resolve, 1200); });
}

// Walk the application menu by label path ('File/Save Proof as PNG…') and click
// the leaf, which runs the identical code path a real click runs.
function clickMenuItem(spec) {
  const menu = Menu.getApplicationMenu();
  if (!menu) return false;
  // Labels carry typographic characters (the ellipsis on every dialog item), and a
  // shell passing one in must not depend on matching those bytes exactly.
  const plain = function (text) { return String(text).replace(/[^ -~]/g, '').trim(); };
  const path = spec.split('/');
  let items = menu.items;
  let hit = null;
  for (let i = 0; i < path.length; i++) {
    const wanted = plain(path[i]);
    hit = items.find(function (item) { return plain(item.label) === wanted; });
    if (!hit) {
      // Say what was on offer: a label mismatch should be readable, not silent.
      return { ok: false, reason: 'no item labelled "' + path[i] + '"', offered: items.map(function (item) {
        return item.type === 'separator' ? '---' : item.label;
      }) };
    }
    items = hit.submenu ? hit.submenu.items : [];
  }
  if (!hit || typeof hit.click !== 'function') return { ok: false, reason: 'the item has no click handler' };
  hit.click();
  return { ok: true, label: hit.label };
}

async function runSmoke() {
  const outDir = smokeOutDir();
  await new Promise(function (resolve) { setTimeout(resolve, 250); });
  if (process.env.DITHER_SMOKE_KEY && process.env.DITHER_SMOKE_KEY_BEFORE) {
    await pressSmokeKey();
  }
  if (SMOKE_SCRIPT) {
    try {
      const source = await fs.readFile(SMOKE_SCRIPT, 'utf8');
      smoke.result = await mainWindow.webContents.executeJavaScript(source, true);
    } catch (err) {
      smoke.errors.push('smoke script: ' + (err && err.message || err));
    }
  }
  // A smoke run may also press a key THROUGH the native accelerator table, which
  // is the only honest way to prove Ctrl+S reaches the app and not just the page.
  if (process.env.DITHER_SMOKE_KEY && !process.env.DITHER_SMOKE_KEY_BEFORE) {
    await pressSmokeKey();
  }
  // Clicking a real menu item is the other half of the same question: it proves
  // the native menu drives the app, which a simulated keypress cannot.
  if (process.env.DITHER_SMOKE_MENU) {
    const click = clickMenuItem(process.env.DITHER_SMOKE_MENU);
    smoke.menuClick = click;
    if (!click.ok) {
      smoke.errors.push('menu click failed: ' + click.reason
        + (click.offered ? ' (offered: ' + click.offered.join(', ') + ')' : ''));
    }
    await new Promise(function (resolve) { setTimeout(resolve, 1400); });
  }
  // Let the async halves of the run settle: dialogs, file writes, IPC replies.
  await new Promise(function (resolve) { setTimeout(resolve, 900); });
  const shot = path.join(outDir, 'dither-desktop.png');
  try { smoke.shots.push(await captureTo(mainWindow, shot)); } catch (err) { smoke.errors.push('capture: ' + err.message); }
  // The splash window photographs itself as its animation reaches the wordmark;
  // a 2.9 s animation is over long before the page checks are done, so waiting
  // for them would usually miss it. This only fills in if that never happened.
  await collectSplashShot(outDir);

  // A smoke script is a verdict of its own: if the page ran checks and one
  // failed, the run failed, whoever started it.
  const inPageOk = !smoke.result || smoke.result.ok !== false;
  if (!inPageOk) smoke.errors.push('in-page checks failed: ' + (smoke.result.failures || []).join(', '));
  const report = {
    ok: smoke.ready && !smoke.errors.length && !smoke.timedOut && inPageOk,
    ready: smoke.ready,
    timedOut: smoke.timedOut,
    errors: smoke.errors,
    console: smoke.console.slice(0, 20),
    result: smoke.result,
    shots: smoke.shots,
    // Did a save really land on disk, at the path the smoke run nominated?
    menuClick: smoke.menuClick || null,
    fullScreen: mainWindow && !mainWindow.isDestroyed() ? mainWindow.isFullScreen() : null,
    menuLabels: process.env.DITHER_SMOKE_MENU_DUMP ? (function () {
      const menu = Menu.getApplicationMenu();
      if (!menu) return null;
      return menu.items.map(function (top) {
        return top.label + ' [' + (top.submenu ? top.submenu.items.map(function (item) {
          return item.type === 'separator' ? '|' : item.label;
        }).join(', ') : '') + ']';
      });
    }()) : null,
    savedFile: process.env.DITHER_SMOKE_SAVE && fsSync.existsSync(process.env.DITHER_SMOKE_SAVE)
      ? { path: process.env.DITHER_SMOKE_SAVE, bytes: fsSync.statSync(process.env.DITHER_SMOKE_SAVE).size }
      : null,
    // Proof that the renderer's menu tree became a real application menu.
    nativeMenu: (function () {
      const menu = Menu.getApplicationMenu();
      if (!menu) return null;
      return menu.items.map(function (item) {
        return { label: item.label, items: item.submenu ? item.submenu.items.length : 0 };
      });
    }()),
    versions: { electron: process.versions.electron, chrome: process.versions.chrome },
  };
  process.stdout.write('\nSMOKE_REPORT ' + JSON.stringify(report) + '\n');
  // A .exe has no console to print to, so a file is the only way to read the
  // verdict of a packaged build.
  if (process.env.DITHER_SMOKE_REPORT) {
    try { await fs.writeFile(process.env.DITHER_SMOKE_REPORT, JSON.stringify(report, null, 2)); }
    catch (err) { process.stdout.write('could not write the smoke report: ' + err.message + String.fromCharCode(10)); }
  }
  app.exit(report.ok ? 0 : 1);
}

function wireSmoke() {
  mainWindow.webContents.on('console-message', function (event, level, message, line, sourceId) {
    // Electron moved the payload onto the event object; read whichever exists.
    const lvl = (event && typeof event === 'object' && event.level !== undefined) ? event.level : level;
    const msg = (event && typeof event === 'object' && event.message !== undefined) ? event.message : message;
    const src = (event && typeof event === 'object' && event.sourceId !== undefined) ? event.sourceId : sourceId;
    const ln = (event && typeof event === 'object' && event.lineNumber !== undefined) ? event.lineNumber : line;
    note(typeof lvl === 'string' ? (lvl === 'error' ? 3 : lvl === 'warning' ? 2 : 1) : lvl, msg, src, ln);
  });
  mainWindow.webContents.on('preload-error', function (_event, file, error) {
    smoke.errors.push('preload ' + path.basename(file) + ': ' + error.message);
  });
  mainWindow.webContents.on('did-fail-load', function (_e, code, desc, url) {
    smoke.errors.push('load failed ' + code + ' ' + desc + ' ' + url);
  });
  mainWindow.webContents.on('render-process-gone', function (_e, details) {
    smoke.errors.push('renderer gone: ' + details.reason);
  });
  setTimeout(function () {
    if (!smoke.ready) {
      smoke.timedOut = true;
      smoke.errors.push('the renderer never signalled ready');
      smokeLooksReady();
    }
  }, 15000);
}

/* ------------------------------------------------------------------ */
/* lifecycle                                                           */
/* ------------------------------------------------------------------ */

function pathsFromArgv(argv) {
  const known = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.avif', '.mp4', '.webm', '.mov', '.mkv', '.m4v'];
  return argv.slice(1).filter(function (arg) {
    return !arg.startsWith('-') && known.some(function (ext) { return arg.toLowerCase().endsWith(ext); });
  }).filter(function (arg, index, all) { return all.indexOf(arg) === index; });
}

const gotLock = SMOKE ? true : app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', function (_event, argv) {
    const paths = pathsFromArgv(argv);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      if (paths.length) send('ds:open-paths', paths);
    }
  });

  app.on('open-file', function (event, file) {
    event.preventDefault();
    if (mainWindow && mainWindow.webContents) send('ds:open-paths', [file]);
    else pendingPaths.push(file);
  });

  pendingPaths = pendingPaths.concat(pathsFromArgv(process.argv));

  app.whenReady().then(function () {
    if (process.platform === 'win32') app.setAppUserModelId('com.thijnperd.ditherstudio');
    // Electron installs a default menu (File ▸ Exit, Edit ▸ Copy…) until one is
    // set. The app draws its own menu bar and sends the tree a moment after the
    // window appears, so clear the default rather than let it flash — or answer
    // an accelerator — in that window.
    Menu.setApplicationMenu(null);
    const startup = { startedAt: Date.now() };
    if (!process.env.DITHER_NO_SPLASH) createSplash();
    createWindow();
    if (SMOKE) wireSmoke();
    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
    // The renderer tells main when it is up; keep a soft deadline as well so a
    // broken window is never left holding an invisible splash.
    setTimeout(function () {
      if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isVisible()) return;
      mainWindow.show();
      closeSplashWhenDue();
    }, 12000);
    if (SMOKE) smokeReady.then(runSmoke);
    setTimeout(function () { if (SMOKE && !smoke.ready) smokeLooksReady(); }, 15000);
    process.stdout.write('DS_BOOT ' + JSON.stringify(startup) + '\n');
  });

  app.on('window-all-closed', function () { if (process.platform !== 'darwin') app.quit(); });
}
