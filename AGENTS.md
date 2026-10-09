# AGENTS.md — working notes for Dither Studio

A standalone, offline image-dithering app: load an image *or a video*, choose one
of 46 dither algorithms and one of 24 palettes, grade it, ink it, stack effects,
print it as pixels or as characters, export a PNG (or a WebM recording). No build
step, no server, no packages — it runs from `file://` in any modern browser, and
the launchers in this folder open it as its own app window. The core is DOM-free,
so the same code runs in Node for the tests. World/voice: **instrument panel,
print shop** — dark press console, the canvas is a proof sheet.

Read [`README.md`](README.md) for the front door and [`GUIDE.md`](GUIDE.md) for
the tour (running it as an app, the console, the three structure-aware looks,
video, exports, keys, performance, troubleshooting).

## Three builds — know which one you are touching

| Build | Where | State |
|---|---|---|
| **Web demo** | `demo/` | **frozen** — a byte-for-byte copy of the portfolio's `dither studio web/`, published to GitHub Pages by `.github/workflows/pages.yml` |
| **Launcher app** | the repository root (`index.html`, `app.js`, `style.css`, launchers, `manifest.webmanifest`, `icons/`) | **frozen** — the page in an app-mode browser window |
| **Desktop app** | `desktop/` | **active** — the Electron application, released as a Windows `.exe` |

Rules that follow from that:

- **`dither.js` is the shared engine.** It is DOM-free and identical in all
  three builds. A change about *dithering* goes there, once, and every build
  gets it. Never fork it into a build.
- **`desktop/src/renderer/` is generated.** `desktop/src/renderer/app.js` is the
  root `app.js` plus ten documented hunks, applied by
  `node desktop/tools/sync-renderer.js`; `--check` fails if the copy has drifted
  and CI runs it. Change the shared `app.js` only if you also revisit those
  hunks — the generator asserts each one still matches exactly once.
- **Do not edit `demo/` or the two frozen shells.** They are what people link to
  and install from. New work happens in `desktop/`.
- **The desktop app's own rules** live in [`desktop/AGENTS.md`](desktop/AGENTS.md):
  it is the only part of this repository with dependencies, and the only build
  whose interface is a native window.

### Releasing the desktop app

```bash
cd desktop
npm install
node tools/sync-renderer.js --check      # the renderer is in step
npm run smoke                            # 34 in-page checks, exit 0 required
DITHER_SMOKE_SAVE=/tmp/proof.png DITHER_SMOKE_KEY=ctrl+s npm run smoke   # the save chain
npm run dist                             # dist/Dither-Studio-Setup-<version>.exe + portable
gh release create v<version> dist/Dither-Studio-Setup-<version>.exe \
  dist/Dither-Studio-<version>-portable.exe --title '…' --notes '…'
```

Bump `version` in `desktop/package.json` in the same commit as the release tag.

## Before working

- Read this file, then whichever of `README.md` / `GUIDE.md` covers your change.
- For dithering behaviour, read `dither.js` and the relevant cases in `test.js`.
- For rendering, controls, text mode, zoom/compare or export, read `app.js`,
  `index.html` and `style.css` as needed.
- For packaging (launchers, the web manifest, the icons), read the Packaging
  section below and `tools/make-icons.js`.
- Before adding a feature, algorithm, palette or numeric table, read
  [`SOURCES.md`](SOURCES.md) and add a row for where it came from.

## File responsibilities

| File | Responsibility |
|---|---|
| `dither.js` | Everything algorithmic and DOM-free: seeded RNG, screen generation (Bayer, clustered-dot, halftone/spiral, line, diagonal, checks, void-and-cluster, blue noise), the structure-aware screens, the 46 algorithms, Yliluoma mixing plans and their cache, palettes and their nearest-colour lookup table, tone maps, adjustments, alpha handling, the effects stack, glow, colour counting, the video temporal rules, and `process()`. Exports `DitherLib` for the browser and `module.exports` for Node. |
| `video.js` | Browser-only video mode: the frame source (video file, webcam, or a generated clip for checks), the playback clock with frame dropping, the working-size cap, and WebM recording. It knows nothing about dithering — `app.js` hands it an `onFrame(imageData, frameIndex)` callback. |
| `app.js` | Canvas presentation and UI wiring: renders preview vs full, builds the rail from `DitherLib.ALGORITHMS` / `PALETTES` / `GLITCHES` / `TONE_MAPS`, text mode, loads images (picker/drop/paste/data URL), zoom/pan/compare, presets, random recipes, clipboard, PNG/`.txt`/WebM export, video wiring, and the `window.__dither` debug hook. |
| `index.html` | UI structure and script load order (`dither.js`, `video.js`, then `app.js`), plus the head: `color-scheme`, `theme-color`, favicon, Apple touch icon and the web manifest. |
| `style.css` | Layout and presentation; the `:root` tokens are the app's own house style. |
| `Dither Studio.cmd` / `Dither Studio.command` / `dither-studio.sh` | App-mode launchers for Windows / macOS / Linux (see Packaging). |
| `manifest.webmanifest` | Install metadata for a browser-installed copy of the app. |
| `icons/` | The generated mark: `icon.svg` (favicon), `icon-192.png`, `icon-512.png`. |
| `tools/make-icons.js` | Regenerates `icons/` by running a synthetic source through the app's own core. Node only, no dependencies. |
| `tools/` (harness) | Optional browser verification (`check.sh`, `browser-check.cjs`); Playwright is a global tool, never a dependency of this project. |
| `SOURCES.md` | Provenance: which published work or open-source tool each feature, table and palette came from, plus divergences that were chosen deliberately. |
| `test.js` | Node tests for the core, not browser UI tests. |
| `demo/` | **Frozen** web demo — the browser copy, published to GitHub Pages. Never edited. |
| `desktop/` | **The active build**: the Electron app (see `desktop/AGENTS.md`). |
| `.github/workflows/` | `test.yml` runs the core tests and the renderer-sync check; `pages.yml` publishes `demo/`. |
| `docs/` | Screenshots used by `README.md` and `GUIDE.md`, including the desktop app and its splash. |
| `README.md` / `GUIDE.md` | Front door and tour. |

## Core invariants — do not break these

1. **Determinism.** All randomness in `dither.js` goes through `makeRng(seed)`
   (mulberry32) or the hash-based mask functions. Never call `Math.random()` in
   the core — `app.js` may use it only to pick a fresh seed or a random recipe.
   Mask generation uses fixed internal seeds and is cached, so masks are stable
   while the user seed drives noise dithers and the effects stack.
2. **Palette membership.** In a colour mode, every output pixel is exactly one
   of the palette's RGB entries — including the mixing family, whose plans only
   ever index palette entries. Tests assert this for every palette and for
   ordered, stochastic, mixing, error-diffusion and threshold algorithms.
3. **RGB metric consistency.** Palette quantization is nearest by *squared RGB
   distance*, and error diffusion accumulates its error in RGB. This is
   deliberate: a Lab-distance quantizer was implemented and measured to be
   inconsistent with per-channel RGB error diffusion — flat patches collapsed
   to a single palette colour and lost their average tone. Do not "upgrade" the
   metric to Lab/CIEDE2000 without re-running the flat-patch tone tests.
4. **Unclamped error accumulation.** `scatter1`/`scatter3` and the Riemersma
   queue must not clamp the diffusion buffer; clamping swallows error and pulls
   flat areas off-tone (measured: mean luma 96.5 vs 106.8 for a target of 110).
5. **Endpoint-safe masks.** `normalizeRanks` maps ranks with half-step
   midpoints onto `(0, 255)`, so pure-black and pure-white patches dither with
   no stray speckles at either end. Generated screens must keep this property.
6. **Mask semantics.** For ordered, formula, noise, blue-noise and clustered-
   noise kinds the mono rule is `luma + bias > scaleMask(mask, strength)` with
   the mask in 0..255, and `scaleMask(m, 1) === m` exactly — strength 1.00 must
   be the published screen to the bit. `threshold` is an exposure bias for the
   whole mono path; keep it hidden in colour modes.
7. **Mixing plan metric.** `planError` minimises the squared distance between
   the target and the plan's **mean**, not Yliluoma's published prefix sum.
   That is a measured decision, not an oversight — the literal prefix sum
   collapses plans to a single colour (a flat 128 rendered at 207), 1/k
   weighting only softens it, and a cohesion term costs more tone accuracy than
   it buys (5.8 → 10.5 mean error over a target sweep). Plans stay luma-sorted
   multisets, every variant is bounded from above by the one before it, and the
   `planError` ordering (2 ≥ quick ≥ deep) is asserted in the tests.
8. **Alpha is separate from colour.** The matte is averaged per chunk and must
   never be mixed into the RGB buffer; a transparent pixel's hidden colour must
   not tint its neighbours. `sharpen` resolves it against a Bayer screen to
   0/255; `keep` writes the chunk average; `matte` leaves the frame opaque.
9. **Tone maps run after the dither**, on the chunk grid, before the effects —
   that ordering is what keeps a 1-bit dither to exactly two inks, and it is why
   `colors` (counted at the dither stage) stays meaningful.
10. **Chunked pipeline order.** levels → gamma → brightness → contrast →
    saturation → hue → blur → sharpen → denoise → box-average downscale by
    `pixelSize` → dither → tone map → effects stack → glow → alpha → NEAREST
    upscale. Effects, glow and the tone map intentionally run at chunk
    resolution.
11. **Caps.** The working image is capped at `MAX_SOURCE = 1600` in `app.js`;
    text mode is capped at `TEXT_CELL_CAP` cells; `mergeSettings` clamps
    `pixelSize` to 1..16, `threshold` to 0..255 and `ditherStrength` to 0..200,
    validates `alphaMode`/`toneMap`/effect `mode`, and drops unknown or
    zero-amount effects. Keep the preview-vs-full render split (preview on
    `input`, full on `change`) — it is what keeps slider drags responsive.
12. **Nothing expensive on load.** The 32×32 blue-noise mask and the mixing-plan
    cache are built lazily, on first use, and cached per palette/bin. Do not
    move mask generation into module load.
13. **Structure screens are image-dependent and budgeted.** `buildScreen` reads
    the *downscaled* RGB buffer, so it is built once per render at chunk
    resolution (never once per pixel loop). Its neighbour sampling is bounded by
    a sample budget (`6e6 / pixels`, both reaches shrinking together) so a large
    working image cannot blow the time budget, and the output stays inside
    `1..254` — a screen that reached 0 or 255 would flip pure patches once the
    strength knob pushed it. The three mode names (`flow`, `rain`, `dots`) set
    the character; the sliders only push it.
14. **The temporal rules live in the core.** `temporalSettings(settings, frame,
    mode)` is the only place a video frame's recipe differs from the still one:
    `freeze` leaves it alone, `shimmer` strides the seed by the golden-ratio
    constant, `crawl` slides `screenShift` (clamped, because that assignment
    happens *after* `mergeSettings`' own clamp). The same frame index must
    always produce the same recipe — that is what makes playback and recording
    reproducible.
15. **Video drops frames instead of queueing.** The loop in `video.js` renders at
    most one frame per slot, counts the frames it missed when a render overran,
    and caps the working frame at 720 px. `app.js` must not render a still over
    a playing video (`render()` returns early while `video.playing`), or slider
    drags would fight the frame loop for the canvas.
16. **It must keep opening from `file://`.** No bundler, no server, no
    `package.json`, no module scripts (module scripts are blocked by CORS on
    `file://`), no `fetch()` of local files — `index.html` loads three classic
    scripts in order and that is the whole build. The launchers depend on it, and
    so does the offline promise in the README.

## Console structure (the rail)

`app.js` builds the rail as a list of **stations** (`GROUPS`: source, press,
tone, ink, detail, effects, glow, motion, type, preset). The rules that keep it
navigable:

1. **Everything lives in a station.** A new control goes inside an existing
   station's `.group-body` — never as a bare row in the rail — and the station's
   header carries a one-line summary in `syncGroupNotes()` so a *closed* station
   still reports what is set (`Press · Bayer 8×8 · C64 · 16c`). A new station is
   added to `GROUPS`, gets a matching `<section id="g-<id>" class="group"
   data-group="<id>">` with a `.group-head` button and a `#note-<id>` span, and
   the jump strip picks it up automatically.
2. **Station state is a `data-open` attribute, not `hidden`.** The body is
   hidden by `.group[data-open="false"] .group-body { display: none }`, and
   `[hidden] { display: none !important; }` guards the attributes elsewhere —
   an author `display` silently defeating `hidden` is a known trap. Never verify
   visibility by reading `.hidden`; measure the box.
3. **The effects stack is additive.** `glitches.order` still lists every effect
   and `glitches.on[]` says which run, so presets, JSON export and
   `deriveGlitches()` keep their shape; the UI renders only the active ones in
   `order` sequence. Adding appends, reordering rewrites `order` as
   active-then-inactive, and `removeEffect` only clears the flag. Never rebuild
   the stack from the DOM.
4. **The update mode is decided in one place.** `schedulePreview()` honours
   `state.quality` — `full` renders full-resolution on every input event, `live`
   schedules the half-resolution preview on the next frame, `still` renders
   nothing until `change`. Keep every new slider on the `input` → `change` pair
   so all three modes work without special cases.
5. **The rail scrolls, the stage does not shrink.** `body` is a fixed grid; the
   station list is the scroll container and the viewport bar is a fixed row of
   the stage. Respect the 720px contraction (stage first, rail capped) rather
   than redesigning the layout.

## Extending

### Add an algorithm

1. Add an entry to `ALGORITHMS` in `dither.js` with `id`, `name`, `group` and
   `kind` — one of `threshold`, `ordered`, `noise`, `bluenoise`,
   `clustered-noise`, `formula`, `structure`, `yliluoma`, `diffusion`. Ordered
   algorithms need a matrix from `matrixFor()` (add a generator next to
   `lineRanks` and the others if the screen is new); formula algorithms need a
   branch in `maskValue`; structure algorithms need a `mode` handled in
   `buildScreen` (`flow`, `rain`, `dots` are the existing characters); diffusion
   algorithms need a table in `KERNELS` (`weights: [dy, dx, numerator]` + `div`)
   or a special case like `riemersma`/`ostromoukhov`.
2. Both paths must handle it (`ditherMono` and `ditherPalette`), including the
   serpentine sweep and the strength scaling where they apply.
3. Add tests: registration and family counts, output shape, tone reproduction on
   flat patches, palette membership in colour mode, and determinism. `node
   test.js` asserts the total algorithm count — update it when you add one.
4. Add a row to `SOURCES.md` naming the published source.

### Add a palette

Add an entry to `PALETTES` (`id`, `name`, `colors` — hardware/product palettes
are facts; do not invent values, and record the source in `SOURCES.md`). The
lookup table, the UI list, the mixing plans and the tests all pick it up
automatically. The `bw` palette is special: it selects the mono path.

### Add an effect

1. Write `glitchSomething(d, w, h, amount, rng, mode)` operating on an RGBA
   `Uint8ClampedArray` in place; random choices must come from the passed `rng`.
2. Register it in `GLITCHES` (name, hint, and `modes` if it has any) and in
   `GLITCH_FNS`. The per-effect seed index comes from the `GLITCHES` order, so
   no separate index table needs updating.
3. The console builds itself — the effect appears in the **Add to the stack**
   list, and adding it renders a row with its name, amount, its mode select if
   `modes` exist, and the reorder/remove buttons. Nothing else needs updating.
   Add a test for the effect's rule, its determinism for a fixed seed, and (if
   it has modes) that the mode reaches the core.

### Add a tone map

Add an entry to `TONE_MAPS` with `ink` and `paper` RGB triples (the `custom`
entry is the only one without colours and reads the user's pickers). Nothing
else needs changing: the rail, the core stage and text mode's paper/type all
read the list.

### Add a video feature

Video is deliberately split: `video.js` owns the source, the clock, the caps and
recording; `app.js` owns what a frame *means* (`renderVideoFrame`,
`videoSettingsFor`). Add per-frame behaviour by extending the settings the shell
builds (or `temporalSettings` when it is a temporal rule), not by teaching
`video.js` about palettes. Any new hook that the browser checks drive should be
mounted on `window.__dither` (`videoTick`, `videoRecord`, …) and listed in
`GUIDE.md`'s verification section.

### Add a preset

Add an entry to `PRESETS` in `app.js` (`id`, `name`, partial `settings`).
Presets are merged over `DEFAULTS` via `DitherLib.mergeSettings`, so they can be
partial and must not contain invalid values. Pair mixing algorithms with dense
palettes (greyscale ramps) or the two-colour variant — see invariant 7. Keep the
count in `README.md` in step (21 today).

## Packaging

- **Launchers.** `Dither Studio.cmd` (Windows), `Dither Studio.command` (macOS)
  and `dither-studio.sh` (Linux) open `index.html` with a Chromium-family
  browser in `--app=` mode, with a dedicated `--user-data-dir` outside this
  folder so the app keeps its own session, permissions and taskbar identity.
  They fall back to the default browser when no Chromium-family browser is
  found, and both print the command instead of running it when
  `DITHER_DRY_RUN=1` is set — keep that env var working, it is how the launchers
  are tested. The Linux launcher also honours `DITHER_NO_SANDBOX=1`. Nothing is
  installed and nothing is written inside this folder; if you add a launcher or
  change a profile path, update the table in `GUIDE.md`.
- **Manifest.** `manifest.webmanifest` makes the page installable as its own
  window. Keep `display: standalone`, the `theme_color` in step with the CSS
  token, and the icon list in step with `icons/`.
- **Icons are generated, not drawn.** `node tools/make-icons.js` runs a
  synthetic disc of light through the app's own core (Bayer 8×8, the 1-bit
  path, the console's ink pair) and writes the PNGs with a tiny `zlib`-only
  encoder, plus the SVG favicon as runs of ink. The mark must stay inside the
  **maskable safe zone** (a circle 80 % of the icon) so a round launcher mask
  never crops it, and the SVG's paper test must compare against the two ink
  colours rather than one channel — the accent's red channel is darker than the
  ink's blue, so a single-channel threshold marks every pixel as ink.

## Validation

From this directory:

```bash
node test.js
```

Run it after any change to `dither.js`. It pins the invariants above and prints
timings for the 1024×1024 pixel-size-1 performance budget (assertions are
generous caps; watch the printed numbers for regressions).

For browser-facing changes, use the bundled harness (needs a global Playwright;
see `tools/README.md`):

```bash
bash tools/check.sh index.html --expect canvas --wait 1200 \
  --screenshot /tmp/dither.png --eval "JSON.stringify(window.__dither.stats())"

# palette membership, on the actual canvas
bash tools/check.sh index.html --eval \
  "window.__dither.setSetting('palette','gameboy'); window.__dither.canvasColors()"

# a preset with an effects stack, including effect modes
bash tools/check.sh index.html \
  --eval "window.__dither.applyPreset('storm'); JSON.stringify(window.__dither.stats().glitches)"

# text mode: the character grid the canvas is actually printing
bash tools/check.sh index.html \
  --eval "window.__dither.setText(true,'ascii',10); JSON.stringify(window.__dither.textGrid().lines.slice(0,4))"
```

`window.__dither` exposes `stats()`, `applyPreset(id)`, `setSetting(path,
value)`, `randomize()`, `exportTxt()`, `setText(on, ramp, size)`, `textGrid()`,
`alphaStats()`, `canvasColors()`, `canvasSample(n)`, `canvasHash()`,
`deriveGlitches()`, `loadDataURL(url, name)`, the console hooks `groups()`,
`setGroup(id, open)`, `quality()`, `setQuality(mode)`, `activeEffects()`,
`addEffect(id)`, `removeEffect(id)`, `moveEffect(index, delta)`, `swatches()`,
`stepAlgorithm(delta)`, `stepPalette(delta)`, and the video hooks
`videoSynthetic(w, h)`, `videoTick(count, atFrame)`, `videoPlay()`,
`videoPause()`, `videoTemporal(mode)`, `videoSettings(frame)`, `videoStats()`,
`videoRecord(ms)`, `videoStop()`. Prefer it over reading the DOM, and check for
console errors (the harness fails on any). Note the harness takes only the last
`--eval`, so chain multi-step checks inside one async expression.

Keep the `README.md` and `GUIDE.md` claims aligned with what the source and
tests actually guarantee, keep the project dependency-free (`index.html` must
open from `file://`), and keep `SOURCES.md` current with every sourced addition.
