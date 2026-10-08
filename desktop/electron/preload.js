/* preload.js — the only bridge between the renderer and the operating system.
 *
 * The renderer has no Node: `contextIsolation` is on and `nodeIntegration` is
 * off (see main.js). Everything the app needs from the desktop is named here,
 * once, so the renderer can be read as a plain web app that happens to have a
 * `window.ditherDesktop` object.
 *
 * Two deliberate choices:
 *   - Files travel as BYTES, not as paths. A file:// image loaded into a
 *     file:// page is an opaque origin to Chromium and would taint the canvas,
 *     which kills getImageData — the whole app. So the main process reads the
 *     bytes and the renderer rebuilds a File from them; the path is carried
 *     along only for display and for the save dialog's default folder.
 *   - Every channel is prefixed `ds:` and every handler returns a plain object,
 *     so a missing field degrades to a status message rather than a crash.
 */
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, handler) {
  const listener = function (_event, payload) { handler(payload); };
  ipcRenderer.on(channel, listener);
  return function () { ipcRenderer.removeListener(channel, listener); };
}

const api = {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },

  /* ---- files in ---- */
  // Each returns { name, path, bytes, mime } or null when cancelled.
  openImage: function () { return ipcRenderer.invoke('ds:open-image'); },
  openVideo: function () { return ipcRenderer.invoke('ds:open-video'); },
  // Returns { name, path, text } or null.
  openJson: function () { return ipcRenderer.invoke('ds:open-json'); },

  /* ---- files out ---- */
  // payload: { name, mime, data: ArrayBuffer }. Returns { path } or null.
  saveBlob: function (payload) { return ipcRenderer.invoke('ds:save-blob', payload); },
  // payload: { name, text, mime }. Returns { path } or null.
  saveText: function (payload) { return ipcRenderer.invoke('ds:save-text', payload); },
  copyImage: function (payload) { return ipcRenderer.invoke('ds:copy-image', payload); },
  reveal: function (target) { return ipcRenderer.invoke('ds:reveal', target); },
  openExternal: function (url) { return ipcRenderer.invoke('ds:open-external', url); },

  /* ---- the window itself ---- */
  win: {
    minimize: function () { return ipcRenderer.invoke('ds:win', 'minimize'); },
    toggleMaximize: function () { return ipcRenderer.invoke('ds:win', 'toggle-maximize'); },
    close: function () { return ipcRenderer.invoke('ds:win', 'close'); },
    isMaximized: function () { return ipcRenderer.invoke('ds:win', 'is-maximized'); },
    reload: function () { return ipcRenderer.invoke('ds:win', 'reload'); },
    toggleDevTools: function () { return ipcRenderer.invoke('ds:win', 'toggle-devtools'); },
    toggleFullScreen: function () { return ipcRenderer.invoke('ds:win', 'toggle-fullscreen'); },
  },

  /* ---- dialogs owned by the main process ---- */
  about: function () { return ipcRenderer.invoke('ds:about'); },
  shortcuts: function () { return ipcRenderer.invoke('ds:shortcuts'); },
  openGuide: function () { return ipcRenderer.invoke('ds:open-guide'); },

  /* ---- talking back ---- */
  // Tell main the renderer is alive: it stops the splash and reveals the window.
  ready: function () { ipcRenderer.send('ds:ready'); },
  quit: function () { ipcRenderer.send('ds:quit'); },
  // Report a message for the status bar of the window (main keeps a copy for
  // the taskbar tooltip and for the native menu's checkmarks).
  sendState: function (state) { ipcRenderer.send('ds:state', state); },
  // The finished menu tree (src/menu-spec.js expanded against the app's own
  // catalogues): main turns it into the native menu and its accelerators.
  sendMenu: function (tree) { ipcRenderer.send('ds:menu', tree); },

  /* ---- listening ---- */
  // A menu item, tool button or accelerator was invoked: (name, arg).
  onCommand: function (handler) { return subscribe('ds:command', function (msg) { handler(msg.name, msg.arg); }); },
  // The menu needs fresh checkmarks: the host asks, the renderer answers.
  onStateRequest: function (handler) { return subscribe('ds:state-request', handler); },
  // Window gained or lost its maximised state (the caption button changes).
  onWindowState: function (handler) { return subscribe('ds:window-state', handler); },
  // The OS asked us to open these paths (double-clicked file, "Open with").
  onOpenPaths: function (handler) { return subscribe('ds:open-paths', handler); },
  // A pass-through line for the status bar, from main.
  onStatus: function (handler) { return subscribe('ds:status', handler); },
};

contextBridge.exposeInMainWorld('ditherDesktop', api);
