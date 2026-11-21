#!/usr/bin/env node
/* external-links.test.js - the shell's link allowlist, without Electron.
 *
 * The policy is what decides whether a link in the renderer opens silently,
 * asks first, or is refused. Pure Node, so these run beside the other suites
 * on every push.
 */
'use strict';

const assert = require('node:assert');
const { classify, isAllowed, HOSTS } = require('../electron/external-links');

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

test('the project repository, releases and profile open without a prompt', function () {
  assert.strictEqual(classify('https://github.com/thijnperd/dither-studio'), 'allow');
  assert.strictEqual(classify('https://github.com/thijnperd/dither-studio/releases/latest'), 'allow');
  assert.strictEqual(classify('https://github.com/thijnperd/dither-studio/blob/main/SOURCES.md'), 'allow');
  assert.strictEqual(classify('https://github.com/thijnperd'), 'allow');
});

test('the web build and the publicity site open without a prompt', function () {
  assert.strictEqual(classify('https://thijnperd.github.io/dither-studio/'), 'allow');
  assert.strictEqual(classify('https://thijnperd.github.io/Dither-studio_publicity/'), 'allow');
});

test('Lospec opens, because the palette importer talks to it', function () {
  assert.strictEqual(classify('https://lospec.com/palette-list/greyt-bit'), 'allow');
  assert.strictEqual(classify('https://www.lospec.com/palette-list/greyt-bit'), 'allow');
});

test('another account on the same GitHub host is a confirmation, not a pass', function () {
  assert.strictEqual(classify('https://github.com/evil-user/dither-studio'), 'confirm');
  assert.strictEqual(classify('https://github.com/thijnperd-evil/dither-studio'), 'confirm');
  assert.strictEqual(isAllowed('https://github.com/thijnperd-evil/dither-studio'), false);
});

test('an unrelated host is a confirmation, never a silent open', function () {
  assert.strictEqual(classify('https://example.com/'), 'confirm');
  assert.strictEqual(classify('https://lospec.com.evil.test/palette-list/x'), 'confirm');
  assert.strictEqual(classify('https://thijnperd.github.io.attacker.test/'), 'confirm');
  assert.strictEqual(classify('https://evil.test/thijnperd/dither-studio'), 'confirm');
});

test('anything that is not a web link is refused', function () {
  assert.strictEqual(classify('javascript:alert(1)'), 'deny');
  assert.strictEqual(classify('file:///C:/Windows/System32/cmd.exe'), 'deny');
  assert.strictEqual(classify('data:text/html,<script>alert(1)</script>'), 'deny');
  assert.strictEqual(classify('mailto:someone@example.com'), 'deny');
  assert.strictEqual(classify('ms-msdt:/id'), 'deny');
});

test('malformed and credentialed URLs are refused before any prompt', function () {
  assert.strictEqual(classify(''), 'deny');
  assert.strictEqual(classify(null), 'deny');
  assert.strictEqual(classify('not a url'), 'deny');
  assert.strictEqual(classify(' https://github.com/thijnperd'), 'deny');
  assert.strictEqual(classify('https://user:pass@github.com/thijnperd/dither-studio'), 'deny');
});

test('host matching ignores case and a trailing dot, but not a suffix', function () {
  assert.strictEqual(classify('https://GitHub.com/thijnperd/dither-studio'), 'allow');
  assert.strictEqual(classify('https://github.com./thijnperd/dither-studio'), 'allow');
  assert.strictEqual(classify('https://github.com.evil.test/thijnperd'), 'confirm');
  assert.strictEqual(HOSTS.indexOf('github.com') >= 0, true);
  // a credentialed URL that merely looks like the project is refused outright
  assert.strictEqual(classify('https://github.com@evil.test/thijnperd'), 'deny');
});

if (process.exitCode) process.exit(process.exitCode);
console.log('\n' + passed + ' link policy tests passed');
