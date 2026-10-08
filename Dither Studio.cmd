@echo off
rem Dither Studio - Windows launcher.
rem
rem Opens the app in its own window (no tabs, no address bar) using a Chromium
rem browser in app mode, with a dedicated profile so it keeps its own session
rem and taskbar identity. Nothing is installed and nothing is written inside
rem this folder; the profile lives under %LOCALAPPDATA%\Dither Studio\profile.
rem
rem Set DITHER_DRY_RUN=1 to print the command instead of running it.
setlocal enabledelayedexpansion

set "HERE=%~dp0"
set "APP=%HERE%index.html"
set "PROFILE=%LOCALAPPDATA%\Dither Studio\profile"

if not exist "%APP%" (
  echo Could not find index.html next to this launcher. Keep the files together.
  pause
  exit /b 1
)

set "BROWSER="
for %%C in (
  "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
  "%LocalAppData%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
  "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
  "%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe"
) do (
  if not defined BROWSER if exist %%C set "BROWSER=%%~C"
)

rem file:/// wants forward slashes
set "URL=file:///%APP:\=/%"

if defined BROWSER (
  echo Starting Dither Studio in its own window...
  if defined DITHER_DRY_RUN (
    echo "%BROWSER%" --app="!URL!" --user-data-dir="!PROFILE!" --no-first-run --no-default-browser-check
    exit /b 0
  )
  start "" "%BROWSER%" --app="!URL!" --user-data-dir="!PROFILE!" --no-first-run --no-default-browser-check
) else (
  echo Chrome, Edge and Brave were not found.
  echo Opening Dither Studio in your default browser instead.
  if defined DITHER_DRY_RUN (
    echo start "" "!APP!"
    exit /b 0
  )
  start "" "!APP!"
)

endlocal
