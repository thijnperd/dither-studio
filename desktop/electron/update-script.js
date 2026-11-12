/* update-script.js - the Windows half of the updater, kept out of update.js so
 * it can be inspected and tested without Electron.
 *
 * A silent NSIS install skips the finish page, and the finish page is what
 * normally starts the app again. This helper waits for Dither Studio to close,
 * runs the downloaded setup with /S, waits until the new executable is on disk,
 * then starts it. Everything is logged under the app's userData folder, so a
 * failed update leaves a readable trail instead of disappearing.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

// PowerShell single-quoted strings escape a quote by doubling it.
function ps(value) {
  return "'" + String(value).replace(/'/g, "''") + "'";
}

function windowsScript(options) {
  const dir = options.map;
  const file = path.join(dir, 'update-dither-studio.ps1');
  const lines = [
    "$ErrorActionPreference = 'Continue'",
    '$log = ' + ps(options.log),
    'function Write-UpdateLog($text) {',
    "  try { \"$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $text\" | Out-File -FilePath $log -Append -Encoding utf8 } catch {}",
    '}',
    "Write-UpdateLog '--- update started ---'",
    'Write-UpdateLog ' + ps('Waiting for Dither Studio (process ' + options.pid + ') to close'),
    // Wait at most two minutes. If the app refuses to close, let the installer
    // run anyway rather than leave the user with a hidden app forever.
    'for ($i = 0; $i -lt 480; $i++) {',
    '  if (-not (Get-Process -Id ' + options.pid + ' -ErrorAction SilentlyContinue)) { break }',
    '  Start-Sleep -Milliseconds 250',
    '}',
    'Start-Sleep -Milliseconds 600',
    'Write-UpdateLog ' + ps('Installing: ' + options.installer),
    'try {',
    "  $p = Start-Process -FilePath " + ps(options.installer) + " -ArgumentList '/S' -PassThru -Wait",
    '  Write-UpdateLog "Installer finished (code $($p.ExitCode))."',
    '} catch {',
    '  Write-UpdateLog "Installer failed: $($_.Exception.Message)"',
    '}',
    '$new = $false',
    'for ($i = 0; $i -lt 20; $i++) {',
    '  if (Test-Path -LiteralPath ' + ps(options.exe) + ') {',
    '    $v = (Get-Item -LiteralPath ' + ps(options.exe) + ').VersionInfo.ProductVersion',
    '    if ($v -like ' + ps(options.version + '*') + ') { $new = $true; break }',
    '  }',
    '  Start-Sleep -Milliseconds 500',
    '}',
    'if ($new) { Write-UpdateLog ' + ps('Version ' + options.version + ' is on disk.') + ' } else { Write-UpdateLog ' + ps('The new version is not on disk yet; starting the installed app.') + ' }',
    'if (Test-Path -LiteralPath ' + ps(options.exe) + ') {',
    "  Write-UpdateLog 'Starting Dither Studio.'",
    '  Start-Process -FilePath ' + ps(options.exe),
    '} else {',
    '  Write-UpdateLog ' + ps('Not found: ' + options.exe),
    '}',
    'Start-Sleep -Milliseconds 500',
    'Remove-Item -LiteralPath ' + ps(dir) + ' -Recurse -Force -ErrorAction SilentlyContinue',
  ];
  // UTF-8 with a BOM keeps Windows PowerShell 5.1 from reading a path with a
  // non-ASCII user name as ANSI.
  fs.writeFileSync(file, '\ufeff' + lines.join('\r\n') + '\r\n', 'utf8');
  return file;
}

module.exports = { windowsScript: windowsScript, ps: ps };
