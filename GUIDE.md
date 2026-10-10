# Dither Studio — the guide

Dither Studio is a print shop for pixels that lives in a folder. You load an
image or a video, choose a press and an ink set, grade and stack a few effects,
and pull a proof — as pixels, as characters, as a PNG, or as a WebM recording.
Forty-six dither algorithms, twenty-four palettes, twenty-one presets, thirteen
effects. No install, no build step, no internet connection, no uploads.

The five-minute path: **double-click the launcher for your system** (or open
`index.html`) → drag a photo onto the stage → open the **Presets** station and
try *Matrix Rain*, *Ice Dot Field* and *Riso Duotone* → push **Smoothness**,
**Flow** and **Streak** if you landed on a structure-aware screen → hit
**Export** with `2×` or `4×` selected.

The [README](README.md) is the front door and the feature list. This file is the
tour: running it as an app, the console station by station, the catalogue, video,
exports, keys, performance and troubleshooting.

![The console](docs/screenshot-console.png)

---

## 1. Make it an app

The app *is* the folder: `index.html` plus five files beside it. There is nothing
to compile and nothing to install, so "running it as an app" means opening that
page in a window that has no tabs, no address bar and its own session.

| Your system | Double-click | What it opens |
|---|---|---|
| Windows | **`Dither Studio.cmd`** | Chrome, Edge or Brave in app mode |
| macOS | **`Dither Studio.command`** | Chrome, Edge, Brave or Chromium in app mode |
| Linux | **`dither-studio.sh`** (`chmod +x` once) | the first of `google-chrome`, `chromium`, `brave-browser`, `microsoft-edge` that is on your `PATH` |
| Anything else | **`index.html`** | your default browser, in a tab |

### What the launchers actually do

They look for a Chromium-family browser, then start it as

```
chrome --app=file:///…/Dither Studio/index.html \
       --user-data-dir=<a profile of the app's own> --no-first-run --no-default-browser-check
```

The dedicated profile is the point of the whole arrangement. Because the app
gets its own profile, it keeps its own window, its own permissions (the webcam
prompt is asked once, for the app), its own remembered station state, and its own
icon in the taskbar or dock — and it never disturbs the browsing session you
already have open. The profile is kept outside this folder:

| System | Profile |
|---|---|
| Windows | `%LOCALAPPDATA%\Dither Studio\profile` |
| macOS | `~/Library/Application Support/Dither Studio/profile` |
| Linux | `${XDG_DATA_HOME:-~/.local/share}/dither-studio/profile` |

Delete that folder to reset the app completely (window size, webcam permission
and remembered settings all live there). Nothing is written inside the project
folder, and nothing is added to the Start menu, the dock or the registry.

- **Nothing installed?** If no Chromium-family browser is found, the launcher says
  so and opens `index.html` in your default browser instead. Everything still
  works except the app-window chrome.
- **Want to see the command?** Set `DITHER_DRY_RUN=1` before launching
  (`set DITHER_DRY_RUN=1` in `cmd`, `export DITHER_DRY_RUN=1` in a shell) and the
  launcher prints what it would run and exits. That is also how the launchers are
  tested.
- **Linux and snap/AppImage browsers** sometimes refuse to start without a
  sandbox: run `DITHER_NO_SANDBOX=1 ./dither-studio.sh`. That trades a sandbox
  for a window; prefer installing a normal package if you can.

### Installed from the browser instead

`manifest.webmanifest` makes the page installable. Open `index.html` and use the
browser's **Install** / **Create shortcut…** command (*Install Dither Studio* in
Chrome's address bar, *Apps → Install this site as an app* in Edge). You get a
real app window and a launcher in your applications list, without the dedicated
profile — handy if you would rather not keep a second browser profile around.

### Keeping it portable

Copy the folder anywhere — a USB stick, a network share, a different drive. The
launchers resolve `index.html` relative to themselves, so a copied folder works
with no changes. Keep the files together: the app is all of them, and there is
nothing outside the folder it needs. Settings (which stations are open, and the
last recipe) are remembered per browser profile, not per folder.

---

## 2. The console, station by station

The left column is the rail. It is a stack of **stations**, and every station
collapses. A closed station still reports what is set on its own header — `Press ·
Bayer 8×8 · C64 · 16c`, `Tone · ct 1.20`, `Effects · 3 in stack` — so you can read
the whole recipe without opening anything. The strip of chips above the rail
jumps to a station and opens it, and the chip for whatever is at the top of the
rail lights up as you scroll, so the strip doubles as a position readout.

| Station | What is in it |
|---|---|
| **Source** | **Open image…**, **Demo scene**, and the drop/paste hint. Drag a file onto the stage, or press `Ctrl+V` to paste an image from anywhere. |
| **Press** | **Algorithm** (46, in six groups) and **Palette** (24) with ◀ ▶ steppers to walk each list; the **swatch strip** showing the actual inks; **Pixel size** 1–16; **Threshold** (mono only, 0–255); **Strength** 0–200 %; **Serpentine sweep**; **Seed** with a dice button. |
| **Tone** | Black point, white point, gamma, brightness, contrast, saturation and hue — applied before dithering, in linear light where it matters. The header note shows the current gamma (`ct 1.20`). |
| **Ink** | Eleven **tone maps** that re-ink the finished dither (Halftone noir, Amber CRT, Thermal, Matrix green, Ice …), a **custom** entry that takes your own ink and paper colours, and the **Alpha** rule: flatten onto paper, dither the matte to hard edges, or keep a real PNG alpha channel. |
| **Detail** | **Blur** (0–4), **Sharpen** (unsharp mask, 0–2) and a 3×3 **median denoise** toggle. |
| **Effects** | **Add to the stack** — thirteen effects, added one at a time, each row with its amount, its mode where it has one, and ↑ ↓ ✕ to reorder or remove. Effects run top to bottom, after the dither. |
| **Glow** | A blurred screen-blend pass after the effects: **Radius** 0–8 and **Intensity** 0–100, added in linear light. |
| **Motion** | Video mode: **Webcam** / **Open video…**, then frame rate, temporal rule and **Record WebM**. The transport (Play/Pause and the frame readout) sits under the viewport. |
| **Type** | **Print with characters**, the character **ramp**, the **cell** size in pixels (6–24), and **Export .txt**. |
| **Presets** | Twenty-one recipes, and **Export JSON** / **Import JSON** for the current settings. |

Above the canvas:

- **Status bar** — file, working **Size**, **Algorithm**, **Palette**, **Colors** (how
  many inks the dither stage actually produced), **Render** time in milliseconds,
  and **Status** (which also reports `Scaled to 1600px` when a big image was
  reduced on load).
- **Toolbar** — `−` **Fit** `+` with a zoom readout, **Hold to compare**
  (press and hold to see the original), **Random** (roll a whole fresh recipe),
  **Copy PNG**, and **Export** with a `1× / 2× / 4× / 8×` scale picker.

Under the canvas, the **update mode** decides how much work a slider drag does:

| Mode | What it does | Use it when |
|---|---|---|
| **Full** | Re-renders at working resolution on every move | A small image, or you want to see exactly what you will export |
| **Live** (default) | Renders a half-resolution frame while you drag, then the full pass when you let go | Everything, most of the time |
| **Still** | Renders nothing until you release the control | Slow machines, heavy recipes, structure-aware screens, video |

---

## 3. The catalogue

### Algorithms (46)

| Group | Screens |
|---|---|
| **Basic** | Threshold (no dither — pure tone slicing) |
| **Ordered** (18) | Bayer 2×2, 4×4, 8×8, 16×16 · Clustered-dot 4×4, 8×8 · Halftone 4×4, 8×8, 16×16 · Void-and-cluster 8×8 · Blue-noise 16×16 · Line (horizontal, vertical, diagonal) · Diagonal · Checks · Spiral |
| **Stochastic** (7) | Random noise · Blue-noise mask · Clustered noise · IGN · R2 low-discrepancy · Crosshatch |
| **Structure-aware** (3) | Smooth diffusion · Rain streaks · Dot field |
| **Mixing** (3) | Yliluoma mixing: 2 colours · quick · deep |
| **Error diffusion** (14) | Floyd–Steinberg · Atkinson · Sierra · Sierra-lite · Sierra two-row · Jarvis–Judice–Ninke · Stucki · Burkes · Nakano · Fan · Shiau–Fan · Stevenson–Arce · Riemersma · Ostromoukhov |

The classic coefficient tables are used, and the press is honest about where they
come from: Floyd–Steinberg 1976, Atkinson, Jarvis–Judice–Ninke, Stucki, Burkes,
Sierra, Fan, Shiau–Fan, Nakano, Stevenson–Arce, and Ostromoukhov's 2001
variable-coefficient table. Riemersma travels a serpentine path carrying sixteen
errors; void-and-cluster is generated at load with Ulichney's algorithm rather
than copied from a table. See [SOURCES.md](SOURCES.md).

**Reading the groups.** Ordered screens are the crisp, printable ones — halftone
for newsprint, clustered-dot for laser printers, Bayer for clean pixel art, void-
and-cluster and blue noise for a smooth, film-like grain. Stochastic screens are
the film-grain family. Error diffusion is the classic photographic dither, and
serpentine sweeping removes its worming artifact. Mixing is the only colour family
that can dither *between* inks instead of choosing one. Structure-aware screens
are the ones that read the picture — next section.

### Palettes (24)

| Palette | Inks | Notes |
|---|---|---|
| B&W (1-bit) | 2 | Selects the mono path: ordered/stochastic screens compare luma against a mask, diffusion scatters error to 0/255. The **Threshold** control only exists here. |
| Game Boy · Game Boy Pocket | 4 · 4 | The two greens of the DMG and the Pocket's greys |
| CGA Mode 4 · Teletext | 4 · 8 | Four loud CGA colours; eight Teletext bars |
| ZX Spectrum | 15 | The eight brights, their dark counterparts |
| Commodore 64 · NES · Macintosh II · PICO-8 · Gruvbox · EGA | 16 each | Hardware and product facts, not inventions |
| Apple II | 6 | Low-res colour set |
| MSX | 15 | |
| Virtual Boy | 4 | Red on black |
| Grey ramps | 4 · 8 · 16 | 2-bit, 3-bit, 4-bit — the right home for the mixing algorithms |
| Single-ink sets | 2 each | **Amber** (CRT), **Sepia** (print), **Cyan** (blueprint), **Blueprint**, **Matrix green**, **Ice** — pair these with the structure-aware screens for the poster looks |

Every colour output is snapped to the nearest palette ink by squared RGB
distance, and every pixel of the result is exactly one of the palette's inks.

### Tone maps (11 + custom)

The **Ink** station re-inks the finished dither, so a 1-bit dither stays exactly
two inks even after an effect stack has run over it. Eleven ready maps plus a
**custom** entry that reads your own ink and paper pickers. This is where the
Matrix-green and Ice-ink posters come from.

### Effects (13)

| Effect | What it does |
|---|---|
| Chromatic aberration | Slides the red and blue channels apart (up to 8 px) |
| JPEG blocks | Shifts or crushes seeded 8×8 blocks |
| Scanlines | Darkens every second row |
| Grain | Seeded noise, mono or per-channel |
| Pixel sort | Sorts bright runs by luminance, by rows or columns |
| Wave | Displaces rows or columns by a sine |
| Drip | Smears pixels downward |
| Kaleidoscope | Mirrors a quadrant back over the frame (2/4/8-fold) |
| Dead pixels | Scatters stuck-on and stuck-off pixels |
| Vignette | Darkens or blooms the corners |
| CRT bloom | Channel-scaled bloom with a mask offset |
| Ripple | Concentric displacement from a seeded centre |
| Starfield | Seeded stars with optional streaks and glow |

### Text ramps (5)

ASCII (` .:-=+*#%@`), Blocks (` ░▒▓█`), Shades (` .·:;+=xX$@`), Hex
(`0123456789ABCDEF`) and Binary (` .01`). Text mode prints the *proof*, not the
photo: switch on a structure-aware screen or a halftone first, and the characters
inherit that structure.

---

## 4. How a proof is made

```
RGBA source
  → levels, gamma, brightness, contrast, saturation, hue
  → blur, sharpen, denoise
  → box-average down to the pixel size
  → dither (a screen, or error diffusion)
  → tone map
  → effects stack
  → glow
  → alpha
  → nearest-neighbour upscale
  → RGBA proof
```

A few consequences worth knowing, because they explain most of the "why does it
look like that" moments:

- **The pixel size is an average, not a crop.** Chunks are box-averaged before
  dithering, so a 4 px proof keeps the *tone* of a 4×4 block. Detail is what
  disappears, not exposure.
- **Masks are fixed per seed.** Ordered screens, blue noise and void-and-cluster
  are generated once and cached. Only the seeded stages (noise screens, the
  effects stack) move when you roll a new seed — so a look stays put while you
  tune it.
- **Strength de-scales the screen.** 0 % collapses any screen to a plain
  threshold, 100 % is the published screen bit-for-bit, and beyond that pushes it.
  If a photo looks mushy, that knob is usually the fix.
- **Everything is deterministic.** The same recipe always produces the same
  proof, and the same frame index always produces the same video frame — which is
  what makes a recording reproducible.

---

## 5. The three structure-aware looks

These three screens do not tile a pattern over the image; they read it. A
two-octave noise field is stretched along the picture's own iso-luma contours (a
short line-integral convolution along the gradient's tangent) and then biased
towards edges. The effect: the screen follows shading instead of fighting it, so
mid-tones come out as flowing lines, vertical rain, or dots on clean paper.

| Preset | Screen | Character | Palette in the preset |
|---|---|---|---|
| **Matrix Rain** | Rain streaks | The screen stretches vertically, so midtones print as dot strings running down the frame | Matrix green ink |
| **Ice Dot Field** | Dot field | Flats collapse towards a plain threshold while edges open up, so a subject prints as dots on clean paper | Ice ink |
| *Smooth Diffusion* | Smooth diffusion | A calm, wavy screen — the busiest of the three over a photo, and the best all-rounder | B&W |

![Matrix Rain](docs/screenshot-matrix-rain.png)
![Ice Dot Field](docs/screenshot-ice-dot-field.png)

Three sliders appear in the Press station for these screens:

| Slider | What it changes | Try |
|---|---|---|
| **Smoothness** | The screen's feature size | 3–5 for poster-scale waves, 8–10 for a fine, fabric-like weave |
| **Flow** | How far the screen stretches along the contours | High flow (70–100) makes the "liquid" look; low flow keeps it grainy |
| **Streak** | How far it runs vertically | 60–100 gives the rain; 0 keeps it isotropic |

Practical notes:

- They are the heaviest screens in the app — a few hundred milliseconds at
  960×640 — so **Live** or **Still** update mode is the comfortable way to tune
  them, and video mode drops frames rather than stalling.
- Their sampling is bounded by a **sample budget** (six million neighbour samples
  per screen, reached by shrinking both reaches together), so a 1600 px working
  image cannot make the screen loop unbounded, and the look keeps its proportions
  when you change resolution.
- They shine on a mid-tone subject with a clear silhouette. On a flat, low-
  contrast photo, lower **Smoothness** and raise **Flow** so the screen has an
  edge to follow.
- Pair them with a single-ink tone map (Matrix green, Ice, Amber) and **Glow**
  at radius 3–5 / intensity 30–60 for the poster look.

---

## 6. Video mode

Everything in the press runs over live frames: any algorithm, any ink, any tone
map, the whole effects stack.

| Control | What it does |
|---|---|
| **Webcam** | Uses the camera as the frame source (needs permission, asked once) |
| **Open video…** | Plays a video file. Loading a still image stops video mode |
| **Play / Pause** | Starts and stops the frame clock (transport sits under the viewport, with the frame readout) |
| **Frame rate** | 1–30 fps. Slider drags still work while playing |
| **Temporal dither** | How the seed — the random part of the recipe — is spent over time |
| **● Record WebM** | Records the dithered canvas through `MediaRecorder` (VP9/VP8) and downloads it; auto-stops at 60 seconds |

| Temporal rule | What a frame does | Good for |
|---|---|---|
| **Frozen** | One screen for the whole clip | The calm, stable look — a moving photo through a fixed screen |
| **Shimmer** | A fresh seed every frame, so stochastic screens boil in place while the overall tone holds | Grain, noise and clustered screens; the default |
| **Crawl** | Ordered tile screens slide one pixel per frame — the classic walking screen | Halftone and Bayer looks with a mechanical, film-projector feel |

Structure-aware screens are *rebuilt* rather than shifted under **Crawl**, and
they are the expensive case, so a 12 fps playthrough of a structure screen is a
slideshow by design — the status readout tells you the frame rate and the number
of dropped frames.

**Cost control, in one sentence:** a frame that overruns its slot is dropped, not
queued, so playback never builds a backlog and never pegs a CPU core. The working
frame is capped at 720 px on its longest side.

Measured here at 720×404, warm, headless Chromium:

| Recipe | Per frame |
|---|---|
| B&W Floyd–Steinberg | ≈ 28 ms |
| Bayer 8×8 | ≈ 31 ms |
| Yliluoma mixing (Game Boy) | ≈ 45 ms |
| All thirteen effects | ≈ 130 ms |
| Structure-aware (screen rebuilt per frame) | ≈ 240 ms |

So 12 fps runs comfortably for the classic algorithms and visibly drops frames on
the heaviest combinations — which is the honest behaviour for a browser app with
no shader pipeline.

---

## 7. Exports and printing

| What | How | Notes |
|---|---|---|
| **PNG** | pick `1× / 2× / 4× / 8×`, then **Export** | Nearest-neighbour scaling, so the pixel grid stays crisp; 8× of a 1600 px working image is 12800 px — big, but it is your disk |
| **Clipboard** | **Copy PNG** | Pastes straight into a document or chat |
| **Text** | **Type → Print with characters**, then **Export .txt** | The character grid as displayed |
| **WebM** | **Motion → ● Record WebM** | Video mode only; VP9 where the browser supports it, 60 s cap |
| **Recipe** | **Presets → Export JSON** / **Import JSON** | A settings file you can share or keep; import merges it over the defaults |

Practical notes:

- **Screen work: 1× or 2×.** The working resolution is already what you see; a
  bigger export only makes the pixels bigger.
- **Pixel art: match the pixel size.** A pixel size of 8 exported at `1×` is
  8× the artistic pixel — export at `1×` when you want exact chunk counts, or at
  `4×` when you want a file that survives a chat app's recompression.
- **Print: think in dots, not pixels.** For a 300 dpi desktop printer, a halftone
  screen at pixel size 2 exported at `4×` lands near a printable halftone
  frequency; clustered-dot 8×8 is the classic choice for laser printers, and
  Floyd–Steinberg with a colour palette is the choice for inkjet photo work.
- **1-bit files stay 1-bit** only if you avoid `Alpha → Keep as PNG alpha` and
  skip the glow pass — that is what the tone maps are for.
- **Video recordings are real-time.** Recording captures frames as they are
  dithered, so the frame drops you see are the frame drops you get. Raise the
  pixel size or pick a lighter screen if you want a denser recording.

---

## 8. Keys and mouse

| Input | Action |
|---|---|
| Hold `C` | Compare against the original (or hold the **Hold to compare** button) |
| `+` / `−` | Zoom in / out — Fit, 1×, 2×, 3×, 4×, 6×, 8× |
| `0` | Fit to the stage |
| `R` | Roll a random recipe (a fresh seed plus a random algorithm, palette and effect set) |
| Drag the canvas | Pan while zoomed in |
| `Ctrl+V` | Paste an image from the clipboard |
| Drag a file onto the stage | Load it |

Keys never fire while a control has focus, so typing a seed or a number never
accidentally rerolls the recipe — click the canvas first if a key seems dead.

### On a phone or a tablet

Nothing to learn twice — it is the same console, contracted:

| Screen | What it does |
|---|---|
| Any touch device | Grows every control to a finger (38px targets, an 18px slider thumb, thicker tracks), drops the keyboard hint line, and hands the proof its own gestures: **one finger pans, two pinch to zoom**. |
| iPad, both ways up | Widens the rail to 272px so touch labels have room, and gives the bars more padding. |
| Phone (and any short landscape window) | Collapses the rail into one **console bar** at the top: the brand, a Console button, and a live summary of the station in view (`Press · Floyd–Steinberg · B&W · 2c`). Tap it and the rail opens in place, so the proof keeps the lead and nothing is covered by a modal. The chip strip turns into one sideways-scrolling row, the status bar into one scrollable line, and the toolbar wraps to two. |

A collapsed console remembers whether you left it open, and the safe-area insets
are honoured where the app is installed to a home screen. Pinch runs its own,
finer zoom ladder than the toolbar buttons, so the readout still reads like a
value a button could have produced.

---

## 9. Performance, and how to stay fast

The design rule for this project is that it must stay comfortable on an ordinary
laptop, which means capping work and caching instead of recomputing.

| Cap | Value | Why |
|---|---|---|
| Working image | 1600 px on the longest side | Larger images are scaled down on load; the status bar says `Scaled to 1600px` |
| Video frame | 720 px on the longest side | Keeps a live press at interactive rates |
| Pixel size | 1–16 | Also the cheapest way to make everything faster |
| Frame rate | 1–30 fps | The app's own ceiling |
| Text mode | 30 000 cells | Above that, text mode is off rather than slow |
| Structure screens | 6 000 000 neighbour samples | Reaches shrink together instead of blowing up |

What is cached: palette lookup tables (32³ LUTs, built once per palette), the
generated screens (Bayer, void-and-cluster, blue noise — built lazily, on first
use), and the mixing plans (per palette bin). What is not: the dither itself,
which is the point.

Measured on the development machine (Node, 1024×1024 at pixel size 1 — the worst
case, printed by `node test.js`):

| Recipe | Time |
|---|---|
| B&W Floyd–Steinberg | ≈ 145 ms |
| 16-colour palette Floyd–Steinberg | ≈ 170 ms |
| Ordered dithering plus effects | ≈ 190 ms |
| Structure screen with flow and streak at 100 | ≈ 360 ms |
| The polished mixing plan | ≈ 615 ms |
| All thirteen effects | ≈ 1.2 s |

The default view (960×640 at pixel size 2) renders in roughly 40–90 ms.

**If it feels slow:**

1. Switch **Update** to **Live** (half-resolution while dragging) or **Still**
   (render on release only).
2. Raise the **pixel size** — 2 costs a quarter of the pixels, 4 costs a
   sixteenth.
3. Leave the structure-aware screens for the final pass; tune with a Bayer or
   Floyd–Steinberg screen, then switch.
4. Prefer one or two effects over five, and use **Glow** sparingly (radius above
   5 costs real time).
5. Keep an eye on **Render** in the status bar: anything under ~100 ms feels
   instant while dragging.

---

## 10. Troubleshooting

**The launcher says a browser was not found.** No Chrome, Edge, Brave or Chromium
on this machine. Install one, or just open `index.html` — everything except the
app window works the same.

**A launcher window does not appear, or opens a tab in my normal browser.** Check
that a Chromium-family browser exists and run with `DITHER_DRY_RUN=1` to see the
command being run. On Linux, a snap or AppImage browser sometimes needs
`DITHER_NO_SANDBOX=1`. If the app window opens but you also see a tab, you
probably opened `index.html` directly as well.

**macOS refuses the `.command` file** ("cannot be opened because it is from an
unidentified developer"). Right-click it → **Open** → **Open** once; after that it
double-clicks normally. (You can also clear the quarantine flag with
`xattr -d com.apple.quarantine "Dither Studio.command"`.)

**The webcam never starts, or the prompt is denied.** The app asks the browser
for the camera; on `file://` pages some browsers refuse outright. The launcher's
own profile remembers a granted permission, so approving it once is usually
enough. If a browser still blocks it, serve the folder over localhost for that
session:

```bash
cd dither-studio && python3 -m http.server 8000   # then open http://localhost:8000/
```

Video **files** never need the camera and work on `file://` in every browser.

**`Record WebM` stays empty, or the file will not play.** Recording needs
`canvas.captureStream` and `MediaRecorder` (Chrome, Edge, Brave, recent Firefox;
Safari support varies). Record with a lighter recipe if the file is mostly
dropped frames, and remember the 60-second cap.

**The image looks soft, or the status bar says `Scaled to 1600px`.** Your image
was bigger than the working cap. Export at `2×` or `4×` instead of resizing it
up front, or crop it before loading.

**The proof is mushy / too dark / too noisy.** In order of usefulness:
**Strength** (0 % is a plain threshold), the **Palette** (a two-ink set is much
calmer than 16 colours), **Threshold** (mono only — exposure), then **Tone**
(gamma is the big one), and finally the screen itself: an ordered screen with a
high pixel size reads as a printed newspaper, error diffusion as a photograph.

**Settings or open stations were forgotten.** Station state lives in the browser
profile's `localStorage`, keyed to the page. Private windows and some `file://`
policies refuse storage — the app then simply starts with defaults. The launcher's
profile keeps settings; a different browser does not.

**Something is broken and the console shows errors.** Open the developer tools
(`F12` on Windows/Linux, `⌥⌘I` on macOS) — but note that the app is designed to
open from `file://` with no server, so "failed to fetch" style errors mean
something else is editing or blocking the folder.

---

## 11. Verifying it (for contributors)

Two layers of checks ship with the app.

**The core, in Node** — no dependencies:

```bash
node test.js
```

It pins the project's invariants (determinism, palette membership, endpoint-safe
masks, tone reproduction, the effect rules, the caps) and prints the performance
timings. CI runs it on Node 20 and 22.

**The page, in a real browser** — an optional harness in `tools/`, driven by a
global Playwright (never a dependency of the app):

```bash
bash tools/check.sh index.html --expect canvas --wait 1200 \
  --screenshot /tmp/dither.png --eval "JSON.stringify(window.__dither.stats())"
```

The page exposes `window.__dither` so a check can drive the app without clicking:
`stats()`, `applyPreset(id)`, `setSetting(path, value)`, `randomize()`,
`setText(on, ramp, size)`, `textGrid()`, `alphaStats()`, `canvasColors()`,
`canvasSample(n)`, `canvasHash()`, `loadDataURL(url, name)`, the console hooks
`groups()`, `setGroup(id, open)`, `quality()`, `setQuality(mode)`,
`activeEffects()`, `addEffect(id)`, `removeEffect(id)`, `moveEffect(i, delta)`,
`swatches()`, `stepAlgorithm(delta)`, `stepPalette(delta)`, and the video hooks
`videoSynthetic(w, h)`, `videoTick(count, atFrame)`, `videoPlay()`,
`videoPause()`, `videoTemporal(mode)`, `videoSettings(frame)`, `videoStats()`,
`videoRecord(ms)`, `videoStop()`. The harness and its options are in the
verification section of the [README](README.md).

---

## 12. Where to go next

- [README.md](README.md) — the front door, the feature list, project layout.
- [SOURCES.md](SOURCES.md) — every algorithm, table and palette, and where it
  comes from.
- `tools/make-icons.js` — the app's mark is generated by its own press; run it to
  see the dither that makes an icon.
