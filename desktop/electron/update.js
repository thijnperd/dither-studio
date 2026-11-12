/* update.js - checking a GitHub release, downloading it, and finishing the
 * install from outside the app.
 *
 * Dither Studio ships unsigned and has no Apple Developer ID, so the stock
 * electron-updater is not a fit. This follows the same model as the W3Plan
 * desktop app:
 *   - check the public repository's latest release over HTTPS;
 *   - choose the asset built for this OS and architecture;
 *   - on Windows, hand a downloaded setup to a hidden PowerShell helper that
 *     waits for the app to exit, installs with /S and starts the new version;
 *   - on macOS, unpack the zip, replace the .app after exit, and reopen it.
 * The disk image remains a fallback when an older release has no zip.
 *
 * The app stays useful offline: a failed check is silent on launch and becomes
 * a readable message only when the user asks for it.
 */
'use strict';

const { app, ipcMain, net, dialog, shell, BrowserWindow } = require('electron');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { isNewer, assetFor } = require('./update-version');
const { windowsScript } = require('./update-script');

const packageJson = require('../package.json');
const API = process.env.DITHER_UPDATE_API
  || 'https://api.github.com/repos/' + (packageJson.updateRepo || 'thijnperd/dither-studio') + '/releases/latest';
const LAST_VERSION = 'last-version';

let found = null;
let busy = false;

function windowFor() {
  return BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
}

function changelogPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'CHANGELOG.md')
    : path.join(__dirname, '..', '..', 'CHANGELOG.md');
}

function lastVersionPath() {
  return path.join(app.getPath('userData'), LAST_VERSION);
}

// The changelog is the single source of release notes: the tag workflow writes
// the release body from it, and the updater shows the same text after install.
function readChangelog() {
  try { return fs.readFileSync(changelogPath(), 'utf8'); }
  catch (err) { return ''; }
}

function plainNotes(text) {
  return String(text || '')
    .replace(/^###\s*/gm, '')
    .replace(/^##\s*/gm, '')
    .replace(/^[-*]\s*/gm, '• ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\r/g, '')
    .trim();
}

function notesFor(version, releaseNotes) {
  const section = require('./update-version').changelogSection(readChangelog(), version);
  return plainNotes(section || releaseNotes || 'No release notes were published for this version.');
}

function truncate(text, max) {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
}

async function check() {
  const response = await net.fetch(API, { headers: { Accept: 'application/vnd.github+json' } });
  if (response.status === 404) return { status: 'current', current: app.getVersion() };
  if (!response.ok) throw new Error('GitHub returned ' + response.status + '.');
  const release = await response.json();
  const version = String(release.tag_name || '').replace(/^[^\d]+/, '');
  if (!version || !isNewer(version, app.getVersion())) {
    return { status: 'current', current: app.getVersion() };
  }
  const selection = assetFor(release.assets, version, process.platform, process.arch);
  if (!selection) {
    return { status: 'current', current: app.getVersion(), latest: version, why: 'That release has no build for this platform.' };
  }
  found = {
    version: version,
    notes: release.body || '',
    releaseUrl: release.html_url || '',
    asset: selection.asset,
    kind: selection.kind,
  };
  return {
    status: 'available',
    current: app.getVersion(),
    latest: version,
    notes: notesFor(version, found.notes),
    releaseUrl: found.releaseUrl,
    asset: { name: selection.asset.name, size: selection.asset.size || 0 },
    kind: selection.kind,
  };
}

async function download(target, info, progress) {
  const response = await net.fetch(info.asset.browser_download_url);
  if (!response.ok || !response.body) throw new Error('The download failed (' + response.status + ').');
  const total = Number(response.headers.get('content-length')) || info.asset.size || 0;
  const out = fs.createWriteStream(target);
  const reader = response.body.getReader();
  let received = 0;
  let last = 0;
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    received += chunk.value.length;
    if (!out.write(chunk.value)) await new Promise(function (resolve) { out.once('drain', resolve); });
    const now = Date.now();
    if (now - last > 100) {
      last = now;
      progress(total ? received / total : 0);
    }
  }
  await new Promise(function (resolve, reject) { out.end(function (err) { err ? reject(err) : resolve(); }); });
  progress(1);
}

function fileSize(file) {
  try { return fs.statSync(file).size; } catch (err) { return 0; }
}

async function waitForLog(file, before, timeout) {
  const end = Date.now() + timeout;
  for (;;) {
    if (fileSize(file) > before) return true;
    if (Date.now() >= end) return false;
    await new Promise(function (resolve) { setTimeout(resolve, 100); });
  }
}

function progressTo(win) {
  return function (fraction) {
    if (win && !win.isDestroyed()) {
      win.setProgressBar(fraction >= 1 ? -1 : fraction);
      win.webContents.send('ds:update-progress', Math.max(0, Math.min(1, fraction)));
    }
  };
}

async function install(info) {
  if (!info || info.status !== 'available' || !found || busy) return { status: 'idle' };
  busy = true;
  const win = windowFor();
  const progress = progressTo(win);
  let dir;
  try {
    dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'dither-studio-update-'));
    const target = path.join(dir, path.basename(info.asset.name || 'update.bin'));
    await download(target, found, progress);

    if (process.platform === 'win32') {
      const log = path.join(app.getPath('userData'), 'update.log');
      const before = fileSize(log);
      const script = windowsScript({
        map: dir,
        installer: target,
        version: found.version,
        exe: app.getPath('exe'),
        log: log,
        pid: process.pid,
      });
      const helper = spawn('cmd.exe', ['/c', 'start', '', 'powershell.exe',
        '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
        '-WindowStyle', 'Hidden', '-File', script], { stdio: 'ignore', windowsHide: true });
      await new Promise(function (resolve, reject) {
        helper.once('spawn', resolve);
        helper.once('error', reject);
      });
      helper.unref();
      // Spawning cmd.exe is not the same as PowerShell having started. Wait for
      // its first log line; on a slow machine that can take ten seconds.
      if (!(await waitForLog(log, before, 30000))) throw new Error('The update helper did not start.');
      app.quit();
      return { status: 'installing' };
    }

    if (process.platform === 'darwin' && found.kind === 'zip') {
      const appPath = path.resolve(process.execPath, '..', '..', '..');
      if (!appPath.endsWith('.app')) throw new Error('Updates can only be installed from an installed app.');
      const unpacked = path.join(dir, 'unpacked');
      await fsp.mkdir(unpacked);
      await new Promise(function (resolve, reject) {
        const unzip = spawn('ditto', ['-x', '-k', target, unpacked]);
        unzip.once('error', reject);
        unzip.once('exit', function (code) { code === 0 ? resolve() : reject(new Error('Could not unpack the update.')); });
      });
      const entries = await fsp.readdir(unpacked);
      const appName = entries.find(function (name) { return name.endsWith('.app'); });
      if (!appName) throw new Error('The update did not contain a Dither Studio app.');
      const newApp = path.join(unpacked, appName);
      const script = [
        'while kill -0 ' + process.pid + ' 2>/dev/null; do sleep 0.2; done',
        'rm -rf "$APP" && ditto "$NEW" "$APP"',
        'xattr -dr com.apple.quarantine "$APP" 2>/dev/null',
        'open "$APP"',
        'rm -rf "$DIR"',
      ].join('\n');
      spawn('/bin/sh', ['-c', script], {
        detached: true,
        stdio: 'ignore',
        env: Object.assign({}, process.env, { APP: appPath, NEW: newApp, DIR: dir }),
      }).unref();
      app.quit();
      return { status: 'installing' };
    }

    if (process.platform === 'darwin' && found.kind === 'dmg') {
      const opened = await shell.openPath(target);
      if (opened) throw new Error(opened);
      await dialog.showMessageBox(win, {
        type: 'info',
        title: 'Dither Studio update',
        message: 'The disk image is open.',
        detail: 'Drag Dither Studio to Applications, then reopen it. The old copy can be replaced when asked.',
        buttons: ['Close'],
        noLink: true,
      });
      return { status: 'opened' };
    }

    throw new Error('Updates are not supported on this platform.');
  } catch (err) {
    busy = false;
    if (dir) fsp.rm(dir, { recursive: true, force: true }).catch(function () {});
    if (win) win.setProgressBar(-1);
    throw err;
  }
}

async function prompt(info) {
  const win = windowFor();
  if (info.status === 'current') {
    await dialog.showMessageBox(win, {
      type: 'info',
      title: 'Dither Studio is up to date',
      message: 'Dither Studio ' + info.current + ' is the latest version.',
      detail: info.latest
        ? 'Version ' + info.latest + ' exists, but it has no build for this platform yet.'
        : 'There is no newer release on GitHub.',
      buttons: ['Close'],
      noLink: true,
    });
    return info;
  }
  if (info.status !== 'available') return info;
  const choice = await dialog.showMessageBox(win, {
    type: 'info',
    title: 'Dither Studio ' + info.latest + ' is available',
    message: 'A new version of Dither Studio is ready.',
    detail: 'You have ' + info.current + '.\n\n' + truncate(info.notes, 3800),
    buttons: ['Download and install', 'Later', 'Release page'],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  });
  if (choice.response === 2 && info.releaseUrl) {
    shell.openExternal(info.releaseUrl);
    return info;
  }
  if (choice.response !== 0) return info;
  try {
    return await install(info);
  } catch (err) {
    await dialog.showMessageBox(win, {
      type: 'error',
      title: 'Dither Studio update failed',
      message: 'The update could not be installed.',
      detail: String(err && err.message || err),
      buttons: ['Close'],
      noLink: true,
    });
    return { status: 'error', error: String(err && err.message || err) };
  }
}

async function checkAndPrompt() {
  try {
    return await prompt(await check());
  } catch (err) {
    await dialog.showMessageBox(windowFor(), {
      type: 'error',
      title: 'Dither Studio update check failed',
      message: 'GitHub could not be reached.',
      detail: String(err && err.message || err),
      buttons: ['Close'],
      noLink: true,
    });
    return { status: 'error', error: String(err && err.message || err) };
  }
}

// Silent on launch: only an available release opens a dialog; a failed check
// (offline, rate-limited GitHub) is not allowed to interrupt the press.
async function autoCheck() {
  if (process.argv.includes('--smoke') || process.env.DITHER_NO_UPDATE === '1') return;
  try {
    const info = await check();
    if (info.status === 'available') await prompt(info);
  } catch (err) { /* offline is a normal way to use an offline app */ }
}

async function showWhatsNew(version) {
  const current = version || app.getVersion();
  const info = found && found.version === current ? found.notes : '';
  const notes = notesFor(current, info);
  await dialog.showMessageBox(windowFor(), {
    type: 'info',
    title: "What's new in Dither Studio " + current,
    message: 'Dither Studio ' + current + ' is installed.',
    detail: truncate(notes, 5000),
    buttons: ['Close'],
    noLink: true,
  });
  return { status: 'shown', version: current };
}

function rememberLaunch() {
  try {
    const file = lastVersionPath();
    const previous = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : '';
    if (!previous) {
      fs.writeFileSync(file, app.getVersion(), 'utf8');
      return;
    }
    if (previous !== app.getVersion()) {
      // The update has just landed. Let the window settle before the notes
      // appear; the press should be visible behind the dialog.
      setTimeout(function () { showWhatsNew().catch(function () {}); }, 1200);
    }
    fs.writeFileSync(file, app.getVersion(), 'utf8');
  } catch (err) { /* a read-only profile must not break startup */ }
}

function wire() {
  ipcMain.handle('ds:updates-check', checkAndPrompt);
  ipcMain.handle('ds:updates-install', async function () {
    if (!found) return { status: 'current', current: app.getVersion() };
    return install({ status: 'available', latest: found.version, asset: found.asset, kind: found.kind });
  });
  ipcMain.handle('ds:whats-new', function () { return showWhatsNew(); });
}

module.exports = {
  wire: wire,
  autoCheck: autoCheck,
  rememberLaunch: rememberLaunch,
  showWhatsNew: showWhatsNew,
  check: check,
};
