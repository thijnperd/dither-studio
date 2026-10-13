#!/usr/bin/env node
'use strict';

// Build the desktop app here, the way CI does it.
//
// `npm run build` is the local half of the `build` workflow: the same checks,
// in the same order, and then the packaging step — so an installer built on
// this machine carries exactly what a released one does. The first failing
// check stops everything: no green, no installer.
//
//   npm run build                  # checks, then dist/Dither-Studio-Setup-<version>.exe
//   npm run build -- --skip-smoke  # the fast lane, when no window can be spared
//
// `npm run dist` is the packaging step on its own (no checks), and
// `npm run pack` leaves the executables unpacked in dist/win-unpacked/.
//
// The packaged app never contains this file: only electron/, src/, the icon,
// package.json and GUIDE.md are shipped.

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const DESKTOP = path.join(__dirname, '..');
const REPO = path.join(DESKTOP, '..');
const VERSION = require(path.join(DESKTOP, 'package.json')).version;

// The checks, in the order that fails fastest first — the workflow's order.
const CHECKS = [
  {
    label: 'the engine copies are in step with the shared engine',
    script: path.join(__dirname, 'sync-renderer.js'),
    args: ['--check'],
    cwd: DESKTOP,
  },
  {
    label: 'the engine tests',
    script: path.join(REPO, 'launcher', 'test.js'),
    args: [],
    cwd: REPO,
  },
  {
    label: 'the desktop core tests',
    script: path.join(__dirname, 'core.test.js'),
    args: [],
    cwd: DESKTOP,
  },
  {
    label: 'the tutorial lesson data',
    script: path.join(__dirname, 'tour.test.js'),
    args: [],
    cwd: DESKTOP,
  },
];

if (!process.argv.includes('--skip-smoke')) {
  CHECKS.push({ label: 'the smoke run — boot, check, screenshot', smoke: true, cwd: DESKTOP });
}

const ARTIFACTS = [
  `Dither-Studio-Setup-${VERSION}.exe`,
  `Dither-Studio-${VERSION}-portable.exe`,
];

function electronBinary() {
  try {
    return require('electron');
  } catch (error) {
    console.error(
      'electron is not installed here, so the smoke run cannot start.\n' +
        'Run `npm install` in desktop/ first, or pass --skip-smoke.',
    );
    process.exit(1);
  }
}

function run(check) {
  const command = check.smoke ? electronBinary() : process.execPath;
  const args = check.smoke
    ? ['.', '--smoke', '--smoke-script', 'tools/smoke-in-page.js']
    : [check.script, ...check.args];

  process.stdout.write(`\n=== ${check.label} ===\n`);
  const result = spawnSync(command, args, { cwd: check.cwd, stdio: 'inherit' });
  if (result.error) {
    console.error(`could not run ${check.label}: ${result.error.message}`);
    return 1;
  }
  return result.status === null ? 1 : result.status;
}

function packageIt() {
  const cli = path.join(DESKTOP, 'node_modules', 'electron-builder', 'cli.js');
  if (!fs.existsSync(cli)) {
    console.error('electron-builder is not installed here. Run `npm install` in desktop/ first.');
    return 1;
  }

  process.stdout.write('\n=== electron-builder ===\n');
  const result = spawnSync(process.execPath, [cli, '--win', '--publish', 'never'], {
    cwd: DESKTOP,
    stdio: 'inherit',
  });
  if (result.error) {
    console.error(`could not run electron-builder: ${result.error.message}`);
    return 1;
  }
  if (result.status !== 0) {
    return result.status === null ? 1 : result.status;
  }

  // The build is only finished when both executables are on disk. electron-
  // builder would have failed already if it could not write them; this is the
  // belt to that braces, and it prints where they are and how big they are.
  console.log('\nbuilt:');
  let missing = 0;
  for (const name of ARTIFACTS) {
    const file = path.join(DESKTOP, 'dist', name);
    let size;
    try {
      size = fs.statSync(file).size;
    } catch (error) {
      console.error(`  missing: dist/${name}`);
      missing += 1;
      continue;
    }
    console.log(`  desktop/dist/${name}  ${(size / 1024 / 1024).toFixed(1)} MB`);
  }
  if (missing > 0) {
    console.error(`\n${missing} of ${ARTIFACTS.length} expected executables are not in dist/.`);
    return 1;
  }
  console.log('\nRun the setup to install it: it removes any older Dither Studio it finds first.');
  return 0;
}

let failed = null;
for (const check of CHECKS) {
  const code = run(check);
  if (code !== 0) {
    failed = { check, code };
    break;
  }
}

if (failed != null) {
  console.error(`\n${failed.check.label} failed (exit ${failed.code}); nothing was built.`);
  process.exit(failed.code);
}

console.log(`\nall ${CHECKS.length} checks passed.`);
process.exit(packageIt());
