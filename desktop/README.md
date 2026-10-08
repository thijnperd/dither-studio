# Dither Studio — the desktop app

The press in its own window: a frameless Electron application with a caption
bar, a menu bar, an options bar, a tool rail, tabbed documents and a dock of
panels — Photoshop's shape, Dither Studio's palette. It opens images, clips and
webcams through the operating system's own dialogs, saves proofs to real files,
and ships as a Windows `.exe`.

**Download:** [the latest release](https://github.com/thijnperd/dither-studio/releases/latest)
— take `Dither-Studio-Setup-<version>.exe` to install it, or
`Dither-Studio-<version>-portable.exe` to run it from anywhere with no install.

## Run it from source

```bash
cd desktop
npm install          # electron + electron-builder, the only dependencies
npm start            # opens the app
```

Node 20 or newer. `npm install` pulls Electron (about 100 MB) once; after that
the app starts in a second or two.

## The window

```
┌───────────────────────────────────────────────────────────────────────────┐
│ ▣ Dither Studio  demo scene          Saved proof.png — click to reveal  — □ ×│  caption
│ File  Edit  Image  Press  Effects  View  Window  Help                     │  menu bar
│ − Fit +  Zoom Fit │ Update Full Live Still │ Compare Random │ … Export PNG│  options bar
├────┬────────────────────────────────────────────────┬─────────────────────┤
│    │ ▣ demo scene  960 × 640 @ Fit                  │ Source Press Tone … │  panel tabs
│ ▤  │                                                │                     │
│ ✦  │              the proof                         │  SOURCE             │  panels
│ ◉  │         (checkerboard well)                    │  Open image…        │
│ ⚄  │                                                │  PRESS              │
│    │                                                │  Floyd–Steinberg ▸  │
│    │                                                │  ●━━━━━ 100%        │
├────┴────────────────────────────────────────────────┴─────────────────────┤
│ Update Live                    ▶ Play  frame 0 · 12 fps                   │  viewport bar
│ File demo scene │ Size 960×640 │ Algorithm … │ Colors 4 │ Render 71 ms     │  status bar
└───────────────────────────────────────────────────────────────────────────┘
```

- **Caption bar** — drag it to move the window; the caption buttons are the
  window's own. The note on the right is a receipt: after a save it shows the
  file name, and clicking it opens the file's folder.
- **Menu bar** — File, Edit, Image, Press, Effects, View, Window, Help. Every
  catalogue lives in it: all 46 algorithms, all 24 palettes, all 13 effects, all
  11 tone maps and all 21 recipes, expanded from the app's own tables, so a new
  algorithm can never be missing from a menu. Alt plus the first letter opens a
  menu; arrows walk them.
- **Options bar** — the controls that change how you are looking rather than
  what you are making: zoom, the update mode, compare, random, copy, the export
  scale and **Export PNG**.
- **Tool rail** — open, demo scene, compare (hold), random, webcam, open clip,
  record, presets. The tool you are holding lights up.
- **Document tabs** — the name of the proof and its size at the current zoom.
- **The well** — the proof on a checkerboard, pannable by dragging, zoomed by
  the options bar or by `+` / `−` / `0`.
- **Dock** — the ten panels as tabs (Source, Press, Tone, Ink, Detail, Effects,
  Glow, Motion, Type, Presets), each collapsible, all in one scrolling column.
  Every slider shows how far it is travelled, the way an editing app does.
- **Status lines** — the viewport bar carries the update mode and the video
  transport; the status bar carries file, size, algorithm, palette, colours,
  the last render time and the app's own message.

## Keyboard

| | |
|---|---|
| `Ctrl+O` / `Ctrl+Shift+O` | open an image / open a clip |
| `Ctrl+S` | save the proof as a PNG (native save dialog) |
| `Ctrl+Shift+C` | copy the proof to the clipboard |
| `Ctrl+D` | generated demo scene |
| `Ctrl+R` / `Ctrl+Shift+R` | roll a fresh recipe / new seed |
| `Ctrl+↑` `Ctrl+↓` | previous / next algorithm |
| `Ctrl+←` `Ctrl+→` | previous / next palette |
| `Ctrl+T` | print with characters |
| `Ctrl+=` `Ctrl+-` `Ctrl+0` | zoom in / out / fit in window |
| `F5` `F11` `F1` | reload the window, full screen, the guide |
| `Ctrl+Shift+I` | developer tools |
| `C` (hold) | compare with the source — the rail tool does the same |
| `+` `−` `0` `R` | zoom, fit, a fresh recipe |

A file dropped on the proof loads it; `Ctrl+V` pastes an image.

## What is genuinely native

- **Open and save dialogs** are the operating system's, with filters for the
  formats the app actually writes. A save returns a path, and the caption bar
  shows it.
- **Files arrive as bytes, not as paths.** The main process reads the file and
  hands the renderer an `ArrayBuffer`; a `file://` image in a `file://` page is
  an opaque origin to Chromium, which would taint the canvas and kill
  `getImageData` — the whole engine.
- **The clipboard** is Electron's, so a copied proof is a real PNG on the
  system clipboard, ready to paste into anything.
- **One window per app**: a second launch focuses the running one, and image
  files can be opened *with* Dither Studio (`Ctrl+O` is not the only way in).
- **The application menu** is a real Electron menu, which is what gives macOS a
  menu bar. On Windows and Linux the window is frameless and draws its own menu
  bar, so the chrome binds those accelerators itself.

## How it is put together

| File | |
|---|---|
| `electron/main.js` | the window, the splash, the native dialogs, the clipboard, the application menu, and the smoke harness |
| `electron/preload.js` | the only bridge to the OS — `window.ditherDesktop`, context-isolated, no Node in the renderer |
| `electron/splash.html` | the startup animation: **this is the file to replace** (see below) |
| `src/index.html` | the window's markup: caption, menus, options, rail, document tabs, dock, status |
| `src/menu-spec.js` | the one menu definition, shared by the native menu and the drawn one |
| `src/renderer/dither.js` | the engine — DOM-free, byte-identical to the web builds |
| `src/renderer/video.js` | the video source, clock and recorder |
| `src/renderer/app.js` | the app's behaviour — **generated**, see the next section |
| `src/renderer/shell.js` | the chrome: menus, tool rail, caption, slider fills, window verbs |
| `src/styles/tokens.css` | tokens, the page grid, every element-level control |
| `src/styles/chrome.css` | caption, menus, options bar, rail, document tabs, the well, the bars |
| `src/styles/panels.css` | the dock: panel tabs, fields, sliders, swatches, the effects stack |
| `tools/sync-renderer.js` | regenerates `src/renderer/app.js` from the shared core |
| `tools/smoke-in-page.js` | the page half of the smoke run |

### The renderer is a copy on purpose, and a tool keeps it honest

`src/renderer/app.js` is the repository's `app.js` — the same file the web
builds run — with **ten hunks** applied, every one of them about the desktop
shell and none about dithering: native dialogs, the native clipboard, and a
named command surface the menu bar and the tool rail drive.

```bash
node tools/sync-renderer.js          # regenerate from the shared core
node tools/sync-renderer.js --check  # fail if it has drifted (CI runs this)
```

The generator asserts that each hunk matches exactly once, so a change to the
shared `app.js` that invalidates one fails loudly instead of half-copying.

## Verify it

```bash
cd desktop
npm run smoke                                  # boot, check, screenshot, exit 0/1
```

`--smoke` loads the real app, waits for it to signal ready, evaluates
`tools/smoke-in-page.js` in the page, captures the window (and the splash, if it
is still up) to `$DITHER_SMOKE_DIR`, prints one JSON report and exits non-zero
on any console error, page error or failed check. The current run makes 33
checks: the chrome exists, the catalogues fill their lists, every slider is
painted, the menus draw and their submenus expand to the full catalogue, all 32
command names are wired, the effects stack is the real markup, panels answer to
their own verbs, and **a key press runs exactly one command**.

Four more environment variables let it exercise the parts a page cannot reach:

| Variable | What it does |
|---|---|
| `DITHER_SMOKE_DIR` | where the screenshots go (default: the temp directory) |
| `DITHER_SMOKE_SAVE=<path>` | answer every save dialog with this path — how the export chain is proved end to end |
| `DITHER_SMOKE_OPEN=<path>` | answer every open dialog with this file |
| `DITHER_SMOKE_MENU='File/Save Proof as PNG'` | click that native menu item, then report whether a file landed |
| `DITHER_SMOKE_KEY=ctrl+s` | send that key through the window's input pipeline (`DITHER_SMOKE_KEY_BEFORE=1` to press before the page script) |
| `DITHER_SMOKE_REPORT=<path>` | also write the JSON report to a file — the only way to read the verdict of a packaged `.exe`, which has no console |
| `DITHER_SPLASH_MS=<ms>` | keep the splash up this long, to photograph it |
| `DITHER_NO_SPLASH=1` | skip the splash entirely |

```bash
# the whole export chain: a simulated Ctrl+S, then proof the file exists
DITHER_SMOKE_SAVE=/tmp/proof.png DITHER_SMOKE_KEY=ctrl+s npm run smoke

# the native menu drives the app
DITHER_SMOKE_SAVE=/tmp/menu.png DITHER_SMOKE_MENU='File/Save Proof as PNG' npm run smoke
```

## Build the installer

```bash
npm run dist     # dist/Dither-Studio-Setup-<version>.exe + the portable exe
npm run pack     # dist/win-unpacked/ only, much faster while iterating
```

electron-builder writes an NSIS installer (per-user, choose the folder, Start
menu shortcut) and a portable single-file executable. The icon comes from
`build/icon.png`, which is the app's own mark produced by the app's own press
(`../tools/make-icons.js`).

## Replace the startup animation

`electron/splash.html` is a self-contained document — inline style, no
scripts, no external files — shown for as long as `SPLASH_MIN_MS` (1200 ms by
default, `DITHER_SPLASH_MS` overrides it) while the window loads. It is the
natural place for your own animation: change the mark, the wordmark and the
`--boot` timing property, and raise `SPLASH_MIN_MS` in `electron/main.js` if
your animation needs longer than the window does. The main process closes the
splash when the app has said it is ready, never before that minimum.

## Performance

The desktop build inherits the engine's budget unchanged: the working image is
capped at 1600 px on its longest side, dragging a slider renders a half-res
preview on the next frame, and the full pass runs when the control is released.
The chrome adds nothing per frame — the only timer in the app polls a recording
flag twice a second. On a 1024² frame the heaviest algorithm stays in the low
seconds, which is the same number the web build reports.
