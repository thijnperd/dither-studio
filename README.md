# Dither Studio

A print shop for pixels, in one folder. Load an image (or a video), pick an ink
set, choose a press, stack a few effects, and export the proof as a PNG — or the
video as WebM, or the proof as characters. Forty-six dither algorithms, twenty-four
palettes, twenty-one presets and thirteen effects, offline, with no build step,
no server and no packages.

It is a standalone app, not a website: double-click a launcher and it opens in
its own window with its own session, drop a file on it and it prints. The same
folder also opens as a page in any browser, and can be installed from the browser
as an app. Everything runs on your machine; nothing is uploaded anywhere.

![The app window, the desktop build](docs/desktop-app.png)

## Three builds, one engine

This repository ships Dither Studio three ways. They share exactly one thing —
`dither.js`, the DOM-free engine — and differ everywhere else on purpose.

| Build | Where | State | How you get it |
|---|---|---|---|
| **Web demo** | `demo/` | frozen | <https://thijnperd.github.io/dither-studio/> — published from `demo/` by GitHub Pages |
| **Launcher app** | this folder | frozen | the launchers above: the page in an app-mode window with its own profile |
| **Desktop app** | [`desktop/`](desktop/) | **active** | `Dither-Studio-Setup-<version>.exe` from [the latest release](https://github.com/thijnperd/dither-studio/releases/latest) |

The desktop build is the one being developed: an Electron application with a
caption bar it draws itself, menus holding the whole catalogue, the operating
system's own open and save dialogs, a tool rail, tabbed documents and a dock of
panels. Its [README](desktop/README.md) covers running it and building it, and
its [guide](desktop/GUIDE.md) is the tour of the window.

The two web builds are frozen: they are the versions people have links to, and
`demo/` is a byte-for-byte copy of the folder in the portfolio repository.
Changes that are about *dithering* belong in `dither.js`, which all three run —
see [`desktop/tools/sync-renderer.js`](desktop/tools/sync-renderer.js) for how
the desktop renderer is kept in step, and `node tools/sync-renderer.js --check`
for how CI proves it.

![The console](docs/screenshot-console.png)

New here? **[GUIDE.md](GUIDE.md)** is the tour: running it as an app, the console
station by station, the three structure-aware looks, video mode, exports, keys,
performance and troubleshooting.

## Run it

| | |
|---|---|
| **Windows** | double-click **`Dither Studio.cmd`** |
| **macOS** | double-click **`Dither Studio.command`** (right-click → Open the first time, if Gatekeeper asks) |
| **Linux** | `./dither-studio.sh` (make it executable once: `chmod +x dither-studio.sh`) |
| **Any browser** | open **`index.html`** |
| **Installed app** | open `index.html`, then use the browser's *Install* / *Create shortcut* command — `manifest.webmanifest` makes it installable |
| **Desktop app** | [`desktop/`](desktop/) — or the installer from [the latest release](https://github.com/thijnperd/dither-studio/releases/latest) |

The launchers use Chrome, Edge, Brave or Chromium in app mode (`--app`), with a
profile of the app's own — under `%LOCALAPPDATA%\Dither Studio`, `~/Library/Application
Support/Dither Studio` or `~/.local/share/dither-studio`, never inside this
folder. Nothing is installed, nothing is registered, and deleting that profile
resets the app. If no Chromium-family browser is found, the launcher opens
`index.html` in your default browser instead. Set `DITHER_DRY_RUN=1` to see the
command it would run without running it.

Keep the folder together — the app is these files, and the launchers look for
`index.html` next to themselves.

## What it does

- **46 algorithms** — classic ordered screens, void-and-cluster and blue noise,
  stochastic dithers, Yliluoma colour mixing, fourteen error-diffusion kernels,
  and three **structure-aware** screens that read the image's own contours
  instead of tiling over it.
- **24 palettes** — 1-bit B&W, Game Boy, C64, NES, ZX Spectrum, CGA, Teletext,
  Apple II, MSX, Virtual Boy, PICO-8, EGA, Macintosh II, Gruvbox, four grey
  ramps and six single-ink sets (amber, sepia, cyan, blueprint, matrix green,
  ice). Colour modes snap every pixel to the palette, and every output pixel is
  exactly one of its inks.
- **Tone, detail, ink** — black/white point, gamma, brightness, contrast,
  saturation, hue; blur, unsharp mask, median denoise; eleven tone maps that
  re-ink the finished dither so 1-bit stays exactly two inks, including your own
  ink and paper.
- **Thirteen effects in a stack** — chromatic aberration, JPEG blocks, scanlines,
  grain, pixel sort, wave, drip, kaleidoscope, dead pixels, vignette, CRT bloom,
  ripple, starfield — added one at a time, reorderable, each with its own amount
  and mode. Plus a blurred **glow** pass in linear light.
- **Chunky pixels** — a pixel size of 1–16 box-averages the image before
  dithering and upscales it without smoothing, for pixel-art output.
- **Text mode** — print the proof as ASCII, blocks, shades, hex or binary, and
  export the grid as `.txt`.
- **Video** — a video file or the webcam through the whole press, 1–30 fps, three
  temporal dither rules, and WebM recording. A frame that overruns its slot is
  dropped rather than queued.
- **Exports** — PNG at 1×, 2×, 4× or 8× with nearest-neighbour scaling, copy to
  clipboard, the text grid, and the current recipe as JSON.

### The three structure-aware looks

Three screens built for photographs, all in the box as presets. They stretch a
noise field along the image's own iso-luma contours (a short line-integral
convolution along the gradient's tangent), then bias it towards edges, so the
screen follows shading instead of fighting it.

| Preset | Screen | Character |
|---|---|---|
| **Matrix Rain** | Rain Streaks | Stretches the screen vertically: midtones print as dot strings that run down the frame. |
| **Ice Dot Field** | Dot Field | Flats collapse toward a plain threshold while edges open up, so a subject prints as dots on clean paper. |
| *Smooth Diffusion* | Smooth Diffusion | A calm, wavy screen — the darkest and busiest of the three over a photo. |

![Matrix Rain](docs/screenshot-matrix-rain.png)
![Ice Dot Field](docs/screenshot-ice-dot-field.png)

Three sliders push them around — **Smoothness** (feature size), **Flow** (how far
the screen stretches along contours) and **Streak** (how far it runs vertically)
— and both reaches are bounded by a sample budget, so a large working image
cannot make the screen loop unbounded.

## Exports

| What | How |
|---|---|
| PNG | **Export** at 1×, 2×, 4× or 8× the working resolution, nearest-neighbour, so the pixel grid stays crisp |
| Clipboard | **Copy PNG** puts the current proof on the clipboard |
| Text | **Text mode** on, then **Export .txt** |
| WebM | **Record** in video mode (auto-stops at 60 s) |
| Recipe | **Presets → Export JSON** writes the current settings; importing merges them over the defaults |

## Requirements

A modern browser (Chrome, Edge, Brave, Firefox or Safari). A Chromium-family
browser is only needed for the app-window launchers. Nothing else: no Node, no
Python, no package manager — Node is needed only to run the tests or regenerate
the icons.

## Project files

| File | Purpose |
|---|---|
| `index.html` | UI structure, the head (icons, manifest), script load order |
| `style.css` | The console: station rhythm, stepper rows, the update switch, the effects stack, the swatch strip |
| `dither.js` | DOM-free core: screens and masks, 46 algorithms, palettes, mixing plans, adjustments, tone maps, alpha, effects, glow, video temporal rules, `process()` |
| `video.js` | Video mode: frame source (file / webcam / generated clip), playback clock, frame dropping, WebM recording |
| `app.js` | Canvas rendering, controls, load/drop/paste, zoom/pan/compare, presets, text mode, video wiring, export, `window.__dither` |
| `Dither Studio.cmd`, `Dither Studio.command`, `dither-studio.sh` | App-mode launchers |
| `manifest.webmanifest`, `icons/` | Installable-app metadata and the generated mark |
| `tools/make-icons.js` | Regenerates the icons through the app's own core |
| `test.js` | Node tests for the core |
| `tools/` | Optional browser-check harness (Playwright, not a dependency) |
| `README.md`, `GUIDE.md` | This file and the tour |
| `SOURCES.md` | Where every feature, table and palette came from |
| `AGENTS.md` | Working notes for AI assistants and contributors |

## Tests

```bash
node test.js          # the core: screens, masks, algorithms, tone, effects, caps
```

The tests use Node's built-in `assert`; nothing needs installing. They cover
matrix generation and endpoint safety, void-and-cluster determinism, blue-noise
bounds, palette lookup, tone reproduction on flat patches, palette membership of
every output pixel, seeded determinism across all 46 algorithms, the
structure-aware screens, pixel chunking, settings clamping, the adjustments,
every effect and its modes, glow, tone maps, the three alpha modes, the video
temporal rules, and the performance budget. CI runs the same command on Node 20
and 22.

For browser-facing changes there is an optional harness in `tools/` that drives
a real Chromium and fails on any console error — see [tools/README.md](tools/README.md).

## Credits

Inspired by **Dither Boy** (Studio AAA, commercial) and by
[**dither-guy**](https://github.com/manoelpiovesan/dither-guy), an open-source
Python alternative whose pipeline shape (adjust → downscale → dither →
post-process) informed this one. The structure-aware screens are built on the
idea of structure-aware halftoning and Cabral & Leedom's line-integral
convolution; the temporal rules are the classic temporal-dither choices made
explicit. No code was copied from any of these projects: the algorithms are the
published classics, the palettes are hardware facts, and this implementation is
original JavaScript. See [`SOURCES.md`](SOURCES.md) for the provenance of every
feature and constant. Not affiliated with any project named here.
