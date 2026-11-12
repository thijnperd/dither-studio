#!/usr/bin/env node
/* update.test.js - the release rules and the Windows helper, without Electron.
 *
 * The updater itself needs a window and a network; these are the parts that
 * decide what to download and what notes to show, and they are the parts most
 * likely to be wrong in a way a build would not catch.
 */
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { isNewer, assetName, assetFor, changelogSection } = require('../electron/update-version');
const { windowsScript } = require('../electron/update-script');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('ok ' + passed + ' - ' + name);
  } catch (err) {
    console.error('not ok ' + (passed + 1) + ' - ' + name);
    console.error(String(err && err.stack || err));
    process.exitCode = 1;
  }
}

test('releases compare numerically and ignore the tag prefix', function () {
  assert.strictEqual(isNewer('0.3.0', '0.2.5'), true);
  assert.strictEqual(isNewer('v0.3.0', '0.2.5'), true);
  assert.strictEqual(isNewer('0.10.0', '0.9.9'), true);
  assert.strictEqual(isNewer('0.2.5', '0.2.5'), false);
  assert.strictEqual(isNewer('0.2.4', '0.2.5'), false);
});

test('the asset name matches the packaged setup and zip', function () {
  assert.strictEqual(assetName('0.3.0', 'win32', 'x64'), 'Dither-Studio-Setup-0.3.0.exe');
  assert.strictEqual(assetName('0.3.0', 'darwin', 'arm64'), 'Dither-Studio-0.3.0-arm64.zip');
  assert.strictEqual(assetName('0.3.0', 'linux', 'x64'), null);
});

test('the right platform asset is chosen, with a disk image fallback', function () {
  const assets = [
    { name: 'Dither-Studio-Setup-0.3.0.exe', browser_download_url: 'https://example.test/setup.exe' },
    { name: 'Dither-Studio-0.3.0-arm64.zip', browser_download_url: 'https://example.test/arm64.zip' },
    { name: 'Dither-Studio-0.3.0-x64.zip', browser_download_url: 'https://example.test/x64.zip' },
    { name: 'Dither-Studio-0.3.0-arm64.dmg', browser_download_url: 'https://example.test/arm64.dmg' },
  ];
  assert.strictEqual(assetFor(assets, '0.3.0', 'win32', 'x64').kind, 'installer');
  assert.strictEqual(assetFor(assets, '0.3.0', 'win32', 'x64').asset.name, 'Dither-Studio-Setup-0.3.0.exe');
  assert.strictEqual(assetFor(assets, '0.3.0', 'darwin', 'arm64').kind, 'zip');
  assert.strictEqual(assetFor(assets, '0.3.0', 'darwin', 'arm64').asset.name, 'Dither-Studio-0.3.0-arm64.zip');
  assert.strictEqual(assetFor([assets[3]], '0.3.0', 'darwin', 'arm64').kind, 'dmg');
  assert.strictEqual(assetFor(assets, '0.3.0', 'linux', 'x64'), null);
});

test('the changelog section stops at the next version', function () {
  const markdown = [
    '# Changelog',
    '',
    '## 0.3.0 — The update that keeps the press current',
    '',
    '- A new thing.',
    '- Another thing.',
    '',
    '## 0.2.5',
    '',
    '- Old thing.',
  ].join('\n');
  const section = changelogSection(markdown, '0.3.0');
  assert.ok(section.indexOf('A new thing.') >= 0);
  assert.ok(section.indexOf('Old thing.') < 0);
  assert.strictEqual(changelogSection(markdown, '9.9.9'), '');
});

test('the Windows helper is a BOM-prefixed script with the install paths', function () {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dither-update-test-'));
  try {
    const file = windowsScript({
      map: dir,
      installer: path.join(dir, 'setup.exe'),
      version: '0.3.0',
      exe: 'C:\\Program Files\\Dither Studio\\Dither Studio.exe',
      log: path.join(dir, 'update.log'),
      pid: 1234,
    });
    const text = fs.readFileSync(file, 'utf8');
    assert.strictEqual(text.charCodeAt(0), 0xfeff, 'PowerShell 5.1 needs the BOM');
    assert.ok(text.indexOf("'C:\\Program Files\\Dither Studio\\Dither Studio.exe'") >= 0);
    assert.ok(text.indexOf('Get-Process -Id 1234') >= 0);
    assert.ok(text.indexOf("'/S'") >= 0);
    assert.ok(text.indexOf("'0.3.0*'") >= 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

if (process.exitCode) process.exit(process.exitCode);
console.log('\n' + passed + ' update tests passed');
