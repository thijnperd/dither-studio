/* update-version.js - the parts of updating that do not need Electron.
 *
 * Keeping version comparison, asset selection and changelog extraction here
 * means the release rules can be tested without starting a window or touching
 * the network. The updater in update.js is the only caller.
 */
'use strict';

function numericParts(version) {
  return String(version || '')
    .replace(/^[^\d]+/, '')
    .split('.')
    .map(function (part) { return parseInt(part, 10) || 0; });
}

// true when candidate is a newer semver-ish release than current. Tags may be
// written as v0.3.0 or desktop-v0.3.0; the prefix is not part of the version.
function isNewer(candidate, current) {
  const a = numericParts(candidate);
  const b = numericParts(current);
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  }
  return false;
}

// The names produced by desktop/package.json build.artifactName. Windows uses
// the setup executable, not the portable one: a portable copy cannot update
// itself in place without knowing where the user put it.
function assetName(version, platform, arch) {
  if (platform === 'win32') return 'Dither-Studio-Setup-' + version + '.exe';
  if (platform === 'darwin') return 'Dither-Studio-' + version + '-' + arch + '.zip';
  return null;
}

// Find the download that belongs to this platform and architecture. A Mac
// release without a zip falls back to the disk image, which the updater opens
// for the user; the zip path is the one that can replace the app itself.
function assetFor(assets, version, platform, arch) {
  const list = Array.isArray(assets) ? assets : [];
  const wanted = assetName(version, platform, arch);
  if (!wanted) return null;
  let asset = list.find(function (entry) { return entry.name === wanted; });
  if (asset) return { asset: asset, kind: platform === 'darwin' ? 'zip' : 'installer' };
  if (platform === 'darwin') {
    const dmg = 'Dither-Studio-' + version + '-' + arch + '.dmg';
    const fallback = list.find(function (entry) { return entry.name === dmg; });
    if (fallback) return { asset: fallback, kind: 'dmg' };
  }
  return null;
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Pull one "## <version>" section out of CHANGELOG.md. Release notes in the
// updater and the post-install What's New dialog both read the same section.
function changelogSection(markdown, version) {
  const lines = String(markdown || '').split(/\r?\n/);
  const start = new RegExp('^##\\s+(?:v)?' + escapeRegExp(version) + '(?:\\s|$)');
  const anyHeading = /^##\s+/;
  const out = [];
  let found = false;
  for (let i = 0; i < lines.length; i++) {
    if (anyHeading.test(lines[i])) {
      if (found) break;
      if (start.test(lines[i])) { found = true; continue; }
      continue;
    }
    if (found) out.push(lines[i]);
  }
  return out.join('\n').trim();
}

module.exports = { isNewer: isNewer, assetName: assetName, assetFor: assetFor, changelogSection: changelogSection };
