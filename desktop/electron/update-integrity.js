/* update-integrity.js - the parts of a verified update that need no Electron.
 *
 * The updater used to download a release asset and hand it straight to an
 * installer. A truncated download, a proxy that rewrote a byte, or an asset
 * swapped on the release page would all have been installed without a word.
 * Every download is now checked against the `SHA256SUMS.txt` published beside
 * it in the same release, and a mismatch, a missing sums file or a missing
 * entry for this asset stops the install before anything is unpacked.
 *
 * What this can and cannot prove: the checksum travels over the same HTTPS
 * connection, from the same release, so it catches corruption and a partially
 * written file. It cannot prove authorship - that is what code signing
 * (macOS Developer ID + notarization, a Windows Authenticode certificate) is
 * for, and the build workflow signs when those secrets exist. This check is
 * the floor, not the ceiling.
 *
 * The format is the one `sha256sum` writes: `<64 hex><space><space|*><name>`,
 * one entry per line, with `#` comments and blank lines allowed.
 */
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');

const SUMS_NAME = 'SHA256SUMS.txt';
const DIGEST = /^[0-9a-f]{64}$/;

// `name` is the only spelling the updater needs: sha256sum records whatever
// path it was given, so a release made from the repository root writes
// `dist/Dither-Studio-Setup-1.0.2.exe` while one made inside dist writes the
// bare file name. Both have to resolve to the same asset.
function baseName(file) {
  return String(file || '').replace(/\\/g, '/').split('/').pop();
}

function parseChecksums(text) {
  const sums = Object.create(null);
  String(text || '').split(/\r?\n/).forEach(function (line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.charAt(0) === '#') return;
    const match = /^([0-9a-fA-F]{64})[ \t]+\*?(.+)$/.exec(trimmed);
    if (!match) return;
    const digest = match[1].toLowerCase();
    const name = match[2].trim().replace(/^\.\//, '');
    if (!name) return;
    // The full path is kept, and the base name is a fallback. A duplicate base
    // name would be ambiguous; the first entry wins so the answer is stable.
    if (!sums[name]) sums[name] = digest;
    const base = baseName(name);
    if (!sums[base]) sums[base] = digest;
  });
  return sums;
}

// Returns the expected digest for an asset name, or null. Never guesses.
function digestFor(sums, name) {
  if (!sums || !name) return null;
  const wanted = String(name);
  const direct = sums[wanted] || sums[wanted.replace(/^\.\//, '')];
  if (direct && DIGEST.test(direct)) return direct;
  const base = baseName(wanted);
  return base && sums[base] && DIGEST.test(sums[base]) ? sums[base] : null;
}

// The release asset that carries the sums, matched by the exact file name the
// release workflow uploads.
function checksumAsset(assets) {
  const list = Array.isArray(assets) ? assets : [];
  return list.find(function (entry) { return entry && entry.name === SUMS_NAME; }) || null;
}

function sha256File(file) {
  return new Promise(function (resolve, reject) {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(file);
    stream.once('error', reject);
    stream.on('data', function (chunk) { hash.update(chunk); });
    stream.once('end', function () { resolve(hash.digest('hex')); });
  });
}

function sameDigest(actual, expected) {
  if (typeof actual !== 'string' || typeof expected !== 'string') return false;
  const a = Buffer.from(actual.toLowerCase(), 'utf8');
  const b = Buffer.from(expected.toLowerCase(), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// The one call the updater makes after a download. It never throws for a
// missing expectation: the caller turns `ok: false` into a refusal, so the
// reason can be shown to the user instead of a stack trace.
async function verifyFile(file, expected) {
  if (!expected || !DIGEST.test(String(expected).toLowerCase())) {
    return { ok: false, reason: 'missing', expected: null, actual: null };
  }
  let actual;
  try {
    actual = await sha256File(file);
  } catch (err) {
    return {
      ok: false,
      reason: 'unreadable',
      expected: String(expected).toLowerCase(),
      actual: null,
      error: String(err && err.message || err),
    };
  }
  const ok = sameDigest(actual, expected);
  return {
    ok: ok,
    reason: ok ? 'verified' : 'mismatch',
    expected: String(expected).toLowerCase(),
    actual: actual,
  };
}

module.exports = {
  SUMS_NAME: SUMS_NAME,
  parseChecksums: parseChecksums,
  digestFor: digestFor,
  checksumAsset: checksumAsset,
  sha256File: sha256File,
  sameDigest: sameDigest,
  verifyFile: verifyFile,
};
