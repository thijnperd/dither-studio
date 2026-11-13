/* lospec.js - the main-process half of Lospec palette import.
 *
 * The renderer cannot fetch a URL (the page is CSP-locked to local resources),
 * so the Color Scheme Maker asks this module for one palette. It accepts only a
 * lospec.com palette-list URL or slug, follows the site's own .json endpoint,
 * bounds the response, and returns text. Parsing and validation stay in the
 * renderer's core, where the palette rules live.
 */
'use strict';

const { ipcMain, net } = require('electron');

const MAX_BYTES = 256 * 1024;
const TIMEOUT_MS = 9000;

function lospecUrl(value) {
  const raw = String(value == null ? '' : value).trim();
  const slug = /^([a-z0-9][a-z0-9-]{0,63})$/i.exec(raw);
  if (slug) return 'https://lospec.com/palette-list/' + slug[1].toLowerCase() + '.json';
  const match = /^https?:\/\/(?:www\.)?lospec\.com\/palette-list\/([a-z0-9][a-z0-9-]{0,63})(?:\.json)?\/?(?:[?#].*)?$/i.exec(raw);
  if (!match) return '';
  return 'https://lospec.com/palette-list/' + match[1].toLowerCase() + '.json';
}

async function fetchPalette(value) {
  const url = lospecUrl(value);
  if (!url) return { error: 'Paste a lospec.com palette link, or a palette slug' };
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);
  try {
    const response = await Promise.race([
      net.fetch(url, {
        headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
        signal: controller.signal,
      }),
      new Promise(function (_resolve, reject) {
        setTimeout(function () { reject(new Error('Lospec timed out')); }, TIMEOUT_MS);
      }),
    ]);
    if (!response.ok) throw new Error('Lospec returned ' + response.status);
    const finalUrl = String(response.url || url);
    if (!/^https:\/\/(?:www\.)?lospec\.com\//i.test(finalUrl)) {
      throw new Error('Lospec redirected somewhere unexpected');
    }
    const text = await response.text();
    if (text.length > MAX_BYTES) throw new Error('That palette file is too large');
    return { url: url, text: text };
  } catch (err) {
    const message = err && err.name === 'AbortError'
      ? 'Lospec timed out'
      : err && err.message ? err.message : 'Lospec could not be reached';
    return { error: message };
  } finally {
    clearTimeout(timer);
  }
}

function wire() {
  ipcMain.handle('ds:lospec-fetch', function (_event, value) {
    return fetchPalette(value);
  });
}

module.exports = { wire: wire, lospecUrl: lospecUrl, fetchPalette: fetchPalette };
