#!/usr/bin/env node
/* update-integrity.test.js - the release checksum rules, without Electron.
 *
 * These are the three cases that decide whether an update installs at all:
 * a good checksum, a hash that does not match, and a release with no usable
 * checksum. All three are pure Node: no window, no network, no installer.
 */
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  SUMS_NAME, parseChecksums, digestFor, checksumAsset, sha256File, sameDigest, verifyFile,
} = require('../electron/update-integrity');

let passed = 0;
const queue = [];
function test(name, fn) {
  queue.push({ name: name, fn: fn });
}

// sha256 of the bytes "hello\n"
const HELLO = '5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03';

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dither-integrity-test-'));
}

test('sha256sum output is parsed in both the text and binary spellings', function () {
  const text = [
    '# a comment',
    '',
    HELLO + '  Dither-Studio-Setup-1.0.2.exe',
    HELLO + ' *Dither-Studio-1.0.2-arm64.zip',
    'not a checksum line at all',
    'deadbeef  too-short.txt',
  ].join('\n');
  const sums = parseChecksums(text);
  assert.strictEqual(sums['Dither-Studio-Setup-1.0.2.exe'], HELLO);
  assert.strictEqual(sums['Dither-Studio-1.0.2-arm64.zip'], HELLO);
  assert.strictEqual(sums['too-short.txt'], undefined);
  assert.strictEqual(sums['a comment'], undefined);
});

test('uppercase digests are normalised and a dist/ prefix still resolves', function () {
  const sums = parseChecksums(HELLO.toUpperCase() + '  dist/Dither-Studio-1.0.2-x64.zip');
  assert.strictEqual(digestFor(sums, 'Dither-Studio-1.0.2-x64.zip'), HELLO);
  assert.strictEqual(digestFor(sums, 'dist/Dither-Studio-1.0.2-x64.zip'), HELLO);
  assert.strictEqual(digestFor(sums, './dist/Dither-Studio-1.0.2-x64.zip'), HELLO);
});

test('an asset with no entry has no expected digest', function () {
  const sums = parseChecksums(HELLO + '  something-else.exe');
  assert.strictEqual(digestFor(sums, 'Dither-Studio-Setup-1.0.2.exe'), null);
  assert.strictEqual(digestFor(sums, ''), null);
  assert.strictEqual(digestFor(null, 'x.exe'), null);
});

test('the checksum asset is found by its exact name', function () {
  const assets = [
    { name: 'Dither-Studio-Setup-1.0.2.exe' },
    { name: SUMS_NAME, browser_download_url: 'https://example.test/SHA256SUMS.txt' },
  ];
  assert.strictEqual(checksumAsset(assets).name, SUMS_NAME);
  assert.strictEqual(checksumAsset([assets[0]]), null);
  assert.strictEqual(checksumAsset(null), null);
});

test('a valid checksum verifies the downloaded file', async function () {
  const dir = tempDir();
  try {
    const file = path.join(dir, 'update.bin');
    fs.writeFileSync(file, 'hello\n');
    assert.strictEqual(await sha256File(file), HELLO);
    const result = await verifyFile(file, HELLO);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.reason, 'verified');
    assert.strictEqual(result.actual, HELLO);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a hash mismatch is rejected with both digests reported', async function () {
  const dir = tempDir();
  try {
    const file = path.join(dir, 'update.bin');
    fs.writeFileSync(file, 'tampered\n');
    const result = await verifyFile(file, HELLO);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'mismatch');
    assert.strictEqual(result.expected, HELLO);
    assert.notStrictEqual(result.actual, HELLO);
    // the comparison itself must not accept a prefix or a different case
    assert.strictEqual(sameDigest(HELLO.slice(0, 63), HELLO), false);
    assert.strictEqual(sameDigest(HELLO.toUpperCase(), HELLO), true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a missing checksum is refused instead of being treated as verified', async function () {
  const dir = tempDir();
  try {
    const file = path.join(dir, 'update.bin');
    fs.writeFileSync(file, 'hello\n');
    const result = await verifyFile(file, null);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'missing');
    assert.strictEqual((await verifyFile(file, '')).ok, false);
    assert.strictEqual((await verifyFile(file, 'not-a-digest')).ok, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('an unreadable download is refused, not thrown', async function () {
  const result = await verifyFile(path.join(os.tmpdir(), 'dither-no-such-update.bin'), HELLO);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'unreadable');
});

// The hash tests read real files, so they are asynchronous; run them in order
// and report the total only once every one has finished.
(async function () {
  for (const entry of queue) {
    try {
      await entry.fn();
      passed++;
      console.log('ok ' + passed + ' - ' + entry.name);
    } catch (err) {
      console.error('not ok ' + (passed + 1) + ' - ' + entry.name);
      console.error(String(err && err.stack || err));
      process.exitCode = 1;
    }
  }
  if (process.exitCode) process.exit(process.exitCode);
  console.log('\n' + passed + ' integrity tests passed');
})();
