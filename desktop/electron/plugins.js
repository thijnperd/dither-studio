/* plugins.js (main process) - fetching the plugin catalogue and packages.
 *
 * The renderer never gets a URL of its own: it asks for the catalogue or for
 * one id. This module owns the GitHub base URL, validates the file name, and
 * falls back to the copy shipped inside the app when the network is unavailable.
 * A package is returned as parsed JSON; nothing here executes it.
 */
'use strict';

const { ipcMain, net } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const packageJson = require('../package.json');

const REPO = packageJson.updateRepo || 'thijnperd/dither-studio';
const BRANCH = 'main';
const REMOTE = 'https://raw.githubusercontent.com/' + REPO + '/' + BRANCH + '/desktop/src/plugins/';
const BUNDLED = path.join(__dirname, '..', 'src', 'plugins');
const MAX_BYTES = 256 * 1024;
const MAX_CATALOGUE_BYTES = 128 * 1024;

let cached = null;
let cachedAt = 0;

function localJson(file) {
  return JSON.parse(fs.readFileSync(path.join(BUNDLED, file), 'utf8'));
}

async function fetchJson(url, limit) {
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, 8000);
  try {
    // `net.fetch` does not always settle an aborted request in older Electron
    // builds, so the timeout is also raced at the promise level. The request may
    // still be in flight, but the UI gets its answer and falls back.
    const response = await Promise.race([
      net.fetch(url, {
        headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
        signal: controller.signal,
      }),
      new Promise(function (_resolve, reject) {
        setTimeout(function () { reject(new Error('GitHub timed out')); }, 8000);
      }),
    ]);
    if (!response.ok) throw new Error('GitHub returned ' + response.status);
    const declared = Number(response.headers.get('content-length')) || 0;
    if (declared > limit) throw new Error('That file is too large');
    const text = await response.text();
    if (text.length > limit) throw new Error('That file is too large');
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

function isEntry(entry) {
  return entry && typeof entry === 'object'
    && /^[a-z][a-z0-9-]{1,47}$/.test(String(entry.id || ''))
    && /^[a-z0-9-]+\.json$/.test(String(entry.file || ''))
    && (entry.kind === 'tool' || entry.kind === 'preset-pack' || entry.kind === 'palette-pack');
}

function cleanCatalogue(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.plugins)) throw new Error('That catalogue is not a plugin list');
  return {
    schema: 1,
    updated: typeof raw.updated === 'string' ? raw.updated.slice(0, 40) : '',
    plugins: raw.plugins.filter(isEntry).map(function (entry) {
      return {
        id: entry.id,
        name: typeof entry.name === 'string' ? entry.name.slice(0, 60) : entry.id,
        version: typeof entry.version === 'string' ? entry.version.slice(0, 20) : '1.0.0',
        kind: entry.kind,
        capability: typeof entry.capability === 'string' ? entry.capability.slice(0, 40) : '',
        summary: typeof entry.summary === 'string' ? entry.summary.slice(0, 240) : '',
        author: typeof entry.author === 'string' ? entry.author.slice(0, 60) : '',
        bytes: Number.isFinite(entry.bytes) && entry.bytes > 0 ? Math.round(entry.bytes) : 0,
        file: entry.file,
      };
    }),
  };
}

// The manager writes down how much each package takes. The catalogue itself
// does not need to carry a size: every package the app can install has a
// bundled file, and its length on this machine is the honest number. A package
// only present in a newer remote catalogue has no local size until installed.
function addLocalSizes(catalogue) {
  if (!catalogue || !Array.isArray(catalogue.plugins)) return catalogue;
  catalogue.plugins.forEach(function (entry) {
    try {
      entry.bytes = fs.statSync(path.join(BUNDLED, entry.file)).size;
    } catch (err) { /* remote-only package: the row will show its size after install */ }
  });
  return catalogue;
}

async function getCatalogue(force, localOnly) {
  if (!force && cached && Date.now() - cachedAt < 5 * 60 * 1000) return cached;
  if (localOnly) {
    try {
      return { catalogue: addLocalSizes(cleanCatalogue(localJson('catalogue.json'))), source: 'bundled', error: '' };
    } catch (localErr) {
      return { catalogue: null, source: '', error: (localErr && localErr.message) || 'The bundled catalogue could not be read' };
    }
  }
  try {
    const remote = addLocalSizes(cleanCatalogue(await fetchJson(REMOTE + 'catalogue.json', MAX_CATALOGUE_BYTES)));
    cached = { catalogue: remote, source: 'github', error: '' };
    cachedAt = Date.now();
    return cached;
  } catch (err) {
    try {
      const bundled = addLocalSizes(cleanCatalogue(localJson('catalogue.json')));
      cached = { catalogue: bundled, source: 'bundled', error: '' };
      cachedAt = Date.now();
      return cached;
    } catch (localErr) {
      return { catalogue: null, source: '', error: (err && err.message) || 'The catalogue could not be read' };
    }
  }
}

async function getPackage(id, localOnly) {
  const index = await getCatalogue(false, !!localOnly);
  if (!index.catalogue) return { error: index.error || 'No catalogue' };
  const entry = index.catalogue.plugins.find(function (item) { return item.id === id; });
  if (!entry) return { error: 'That plugin is not in the catalogue' };
  if (localOnly) {
    try {
      return { plugin: localJson(entry.file), source: 'bundled' };
    } catch (localErr) {
      return { error: 'That bundled package could not be read' };
    }
  }
  const url = REMOTE + entry.file;
  try {
    const plugin = await fetchJson(url, MAX_BYTES);
    return { plugin: plugin, source: 'github' };
  } catch (err) {
    try {
      return { plugin: localJson(entry.file), source: 'bundled' };
    } catch (localErr) {
      return { error: 'Could not fetch ' + entry.name + ' from GitHub, and no bundled copy was found' };
    }
  }
}

function wire() {
  ipcMain.handle('ds:plugins-catalogue', function (_event, force, localOnly) {
    return getCatalogue(!!force, !!localOnly);
  });
  ipcMain.handle('ds:plugins-package', function (_event, id, localOnly) {
    if (typeof id !== 'string' || !/^[a-z][a-z0-9-]{1,47}$/.test(id)) return { error: 'That plugin id is not valid' };
    return getPackage(id, !!localOnly);
  });
}

module.exports = { wire: wire, getCatalogue: getCatalogue, getPackage: getPackage, REMOTE: REMOTE };