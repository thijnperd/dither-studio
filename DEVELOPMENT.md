# Dither Studio — how it is built, packaged and checked

This is the engineering half of the documentation. The front door — what the app
does, what it looks like, how to get it — is [README.md](README.md); using the
console is [GUIDE.md](GUIDE.md), the desktop window is
[desktop/GUIDE.md](desktop/GUIDE.md), and where every algorithm, table and
palette came from is [SOURCES.md](SOURCES.md), and what changed in each desktop
version is [CHANGELOG.md](CHANGELOG.md). What follows is the repository
itself: the layout, the desktop shell, packaging, the startup screen, the
performance budget, and every check that ships with the app.

## Repository layout

| Path | What it is |
|---|---|
| [`launcher/`](launcher/) | the **launcher** build, self-contained: the page (`index.html`, `style.css`, `app.js`, `video.js`, `samples.js`), the engine master (`dither.js`) and its tests (`test.js`), the three launchers, `manifest.webmanifest` and `icons/` |
| [`launcher/dither.js`](launcher/dither.js) | the engine: screens and masks, 46 algorithms, palettes, mixing plans, adjustments, tone maps, alpha, effects, glow, video temporal rules, `process()`. DOM-free, shared by all three builds |
| [`launcher/samples.js`](launcher/samples.js) | the built-in sources the Source panel steps through: three public-domain paintings inlined as data URIs, so no build has to fetch anything and a console opened from `file://` still gets real pixels. Shared by all three builds |
| [`launcher/test.js`](launcher/test.js) | the engine's Node tests |
| [`launcher/Dither Studio.cmd`](launcher/Dither%20Studio.cmd), [`launcher/Dither Studio.command`](launcher/Dither%20Studio.command), [`launcher/dither-studio.sh`](launcher/dither-studio.sh) | the app-mode launchers (Windows / macOS / Linux) |
| [`launcher/manifest.webmanifest`](launcher/manifest.webmanifest), [`launcher/icons/`](launcher/icons/) | installable-app metadata and the generated mark |
| [`tools/make-icons.js`](tools/make-icons.js) | regenerates `launcher/icons/` through the app's own core |
| [`tools/inbox.js`](tools/inbox.js) | lists what is waiting in `inbox/`, with each capture's format, bytes and pixel size |
| [`tools/make-examples.js`](tools/make-examples.js) | rebuilds [`examples/`](examples/) — the proofs, the contact sheet, the manifest and the README's table — by driving the launcher build in a real browser |
| [`tools/check-examples.js`](tools/check-examples.js) | checks that folder against its own manifest in Node; `test.yml` runs it |
| [`tools/`](tools/) | optional browser-check harness (`check.sh`, `browser-check.cjs`); Playwright is a global tool, never a dependency |
| [`demo/`](demo/) | the **frozen** web demo published to GitHub Pages, favicon, icons and its own startup overlay included |
| [`desktop/`](desktop/) | the **active** Electron build, in its own folder with its own dependencies |
| [`docs/`](docs/) | the screenshots in this file, the README and the guides |
| [`examples/`](examples/) | twelve generated proofs of the app's own output, with the contact sheet that shows them, the manifest that describes them and the README list that mirrors it |
| [`inbox/`](inbox/) | where a new capture waits to be developed into `docs/`; the folder ignores its own contents, so nothing dropped in it can reach a commit |
| [`.github/workflows/`](.github/workflows/) | `test.yml` runs the tests and the renderer-sync check; `build.yml` builds the Windows installer and the macOS disk images and publishes releases; `pages.yml` publishes `demo/` |
| [`README.md`](README.md) | the front door for the whole repository |
| [`DEVELOPMENT.md`](DEVELOPMENT.md) | this file |
| [`GUIDE.md`](GUIDE.md) | the tour: the console, the catalogue, video, exports, troubleshooting |
| [`desktop/GUIDE.md`](desktop/GUIDE.md) | the tour of the desktop window |
| [`SOURCES.md`](SOURCES.md) | where every feature, table and palette came from |
| [`CHANGELOG.md`](CHANGELOG.md) | what changed in each desktop version; `build.yml` reads the release notes out of it |

The two web builds are frozen on purpose: they are what people have links to and
install from, and `demo/` is kept self-contained so the public Pages site can
never pick up desktop files. `dither.js` and `samples.js` are the shared files;
everything else — the shells, the window chrome — belongs to a single build.

### Replacing a built-in sample

`launcher/samples.js` is generated and committed, and never hand-edited: the
desktop's copy is written by `desktop/tools/sync-renderer.js --check`-ed against
it, and `demo/samples.js` and the portfolio's `dither studio web/` follow the
demo. The paintings are read out of the git-ignored `inbox/` drop box, cropped
to the picture itself, encoded at WebP quality 80 and base64'd into the table;
`SOURCES.md` holds the works, the collections and the rights. Keep a new sample
under about 150 KB of pixels: the table loads with the page, in all three
builds.

## The desktop shell

| File | |
|---|---|
| [`electron/main.js`](desktop/electron/main.js) | the window, the splash, the native dialogs, the clipboard, the application menu, and the smoke harness (which runs on a profile of its own) |
| [`electron/preload.js`](desktop/electron/preload.js) | the only bridge to the OS — `window.ditherDesktop`, context-isolated, no Node in the renderer |
| [`electron/splash.html`](desktop/electron/splash.html) | the startup animation: **this is the file to replace** (see below) |
| [`electron/Splash/`](desktop/electron/Splash/) | the source PNGs the animation was built from (Adam, Adam dithered, God). The document inlines its own copies, so `build.files` keeps this folder out of the package |
| [`src/index.html`](desktop/src/index.html) | the window's markup: caption, menus, options, the rail (its Lucide icons inlined), document tabs, dock, status |
| [`LICENSE-LUCIDE.txt`](desktop/LICENSE-LUCIDE.txt) | the ISC notice for the rail's Lucide icons; `build.files` ships it beside the app |
| [`src/menu-spec.js`](desktop/src/menu-spec.js) | the one menu definition, shared by the native menu and the drawn one |
| [`src/tour-spec.js`](desktop/src/tour-spec.js) | the tutorial's lessons, as data: a target selector, a body, an optional panel, an optional command and a `when` predicate per step |
| [`src/renderer/core.js`](desktop/src/renderer/core.js) | the desktop core: the colour pair, the catalogue lookups, the settings paths, the one dropdown builder |
| [`src/renderer/dither.js`](desktop/src/renderer/dither.js) | the engine — DOM-free, byte-identical to the web builds |
| [`src/renderer/video.js`](desktop/src/renderer/video.js) | the video source, clock and recorder |
| [`src/renderer/samples.js`](desktop/src/renderer/samples.js) | the built-in source table — generated from the launcher build, like the engine |
| [`src/renderer/app.js`](desktop/src/renderer/app.js) | the desktop shell: rendering, controls, the native routes, and the command surface the menus drive |
| [`src/renderer/shell.js`](desktop/src/renderer/shell.js) | the chrome: menus, tool rail, caption, slider fills, window verbs |
| [`src/renderer/tour.js`](desktop/src/renderer/tour.js) | the tutorial's runner: the Learn panel's list, the coach mark, step navigation, Skip, the first-run intro and progress |
| [`src/styles/tokens.css`](desktop/src/styles/tokens.css) | tokens, the page grid, every element-level control |
| [`src/styles/chrome.css`](desktop/src/styles/chrome.css) | caption, menus, options bar, rail, document tabs, the well, the bars |
| [`src/styles/panels.css`](desktop/src/styles/panels.css) | the dock: panel tabs, fields, sliders, swatches, the effects stack |
| [`tools/sync-renderer.js`](desktop/tools/sync-renderer.js) | keeps `src/renderer/{dither,video,samples}.js` byte-identical to the launcher build's copies |
| [`tools/tour.test.js`](desktop/tools/tour.test.js) | the tutorial data's own suite: real panels, real commands, nothing already done on a fresh app |
| [`tools/smoke-in-page.js`](desktop/tools/smoke-in-page.js) | the page half of the smoke run |

The desktop shell is its own code. It used to be the web shell with ten patches
applied, which meant every helper existed twice, so the desktop now has a core of
its own (`src/renderer/core.js`) holding the shared helpers once. What every
build shares is the engine and the sample table.

```bash
node tools/sync-renderer.js          # refresh the engine and sample copies
node tools/sync-renderer.js --check  # fail if any has drifted (CI runs this)
node tools/core.test.js              # the core's own rules, in Node
```

### What is genuinely native

- **Open and save dialogs** are the operating system's, with filters for the
  formats the app actually writes. A save returns a path, and the caption bar
  shows it.
- **Files arrive as bytes, not as paths.** The main process reads the file and
  hands the renderer an `ArrayBuffer`; a `file://` image in a `file://` page is
  an opaque origin to Chromium, which would taint the canvas and kill
  `getImageData` — the whole engine.
- **The clipboard** is Electron's, so a copied proof is a real PNG on the system
  clipboard, ready to paste into anything.
- **One window per app**: a second launch focuses the running one, and image
  files can be opened *with* Dither Studio (`Ctrl+O` is not the only way in).
- **The application menu** is a real Electron menu, which is what gives macOS a
  menu bar. On Windows and Linux the window is frameless and draws its own menu
  bar, so the chrome binds those accelerators itself.

### The tutorial

The app teaches itself. A fresh install is met by the tour: the Learn panel comes
forward and the first lesson is already on screen, with **Skip** on the card.
Skip — or **Exit**, or `Escape` — ends it for good, and the answer is remembered,
so the tour never opens by itself again; after that *Help ▸ Take the Tour* or the
Learn panel starts it whenever it is wanted, and either brings the station back
if it has folded away.

Ten short lessons, one per station, from the first proof to the last export.
Each lesson is five or six steps, and each step dims the window, opens the panel
it is about, and settles a ring around the one control it means. If that control
is far down the rail, the rail is scrolled to it first, the way a guide turns the
page for you.

The learner does the work, not the app. The spotlight never takes a click, so
every control under it stays live; a step the app can check — an algorithm, a
palette, a recipe applied, text mode on — ticks itself off the moment the state
changes, and a step that cannot be checked simply says what to do. **Show me**
performs that one step for a stuck learner, **Back** and **Next** move, and
`Escape` leaves. Progress is kept per lesson and per step, so a lesson resumes
where it was left; **Reset** clears the ticks and puts the intro back on offer.
Finishing the last lesson folds the Learn station away and closes the verdict
card on its own a moment later, so a finished tutorial stops taking up the dock.

The lessons are data ([`src/tour-spec.js`](desktop/src/tour-spec.js)): a title, a
body, a selector for the control, an optional panel to open, an optional command
and an optional predicate over the app's own state. Nothing in the tutorial draws
a second copy of a control, which is why a renamed panel or a retired verb comes
out as a failed test rather than as a lesson pointing at nothing. It also costs
nothing while idle: the card is placed once per step and once per state change,
never per frame.

## Build the installer

```bash
cd desktop
npm run build    # the checks, then dist/Dither-Studio-Setup-<version>.exe + the portable exe
npm run dist     # the Windows packaging step on its own, once the checks have run
npm run dist:mac # the macOS disk images, x64 and arm64 (run it on macOS)
npm run pack     # dist/win-unpacked/ only, much faster while iterating
```

`npm run build` is the local half of the release workflow — the same checks in
the same order, then packaging (`node tools/build-checks.js`; `--skip-smoke`
drops the window-driven run when no desktop can be spared) — so a setup built
here carries what a released one does. It prints both executables and their
sizes when it is done.

electron-builder writes an NSIS installer (per-user, choose the folder, Start
menu shortcut) and a portable single-file executable on Windows, and one
unsigned disk image per Mac architecture on macOS. The packaging icon comes from
`desktop/build/icon.png`, the app's own dithered mark. The web builds' mark is
made by [`tools/make-icons.js`](tools/make-icons.js), which writes
`launcher/icons/icon.svg`, `icon-192.png` and `icon-512.png` through the same
press.

Installing a newer setup removes the older ones first. electron-builder removes
the copy it knows about, under the app's own registry key in the install context
being used; [`desktop/build/installer.nsh`](desktop/build/installer.nsh),
compiled in through `nsis.include`, covers what that misses — a build installed
for all users and replaced by a per-user setup or the reverse, an install whose
folder was picked somewhere else the first time, and a row in *Apps & features*
whose files are already gone. It removes those files itself and never runs an
older build's uninstaller: that uninstaller works out its own folder from a
registry key and falls back to the default per-user folder, which is exactly
where the new setup is writing. In *Apps & features* it appears once, as
"Dither Studio", with the version beside it, and everything in
`%APPDATA%\Dither Studio` — presets, panels, tutorial progress — is kept.

### The startup screen

Adam's arm reaches in from the left, God's from the right. When the fingertips
touch, Adam is dithered — his own pre-screened image is revealed over the painted
one, spreading from the fingertip back along the arm — and starts to glow; God
stays painted. The wordmark inks in underneath and the window opens.

`electron/splash.html` is one self-contained document (inline style, inline
script, every image inlined as a data URI, nothing fetched from disk) and it is
meant to be replaced. Its header names the three parts to change: `HANDS`, the
three images and the fingertip inside each one; `T`, the whole schedule in
milliseconds; and the ink colour. The frames only blit — the three images decode
once, the light dots of the dithered one are recoloured to the ink once, the glow
is a single blurred copy built when the box is laid out, and every frame after
that only draws them. If you change the total, change `SPLASH_MIN_MS` in
`electron/main.js` (2900 ms) to match.

To look at a single frame while you work on it, hold the animation and shoot it:

```bash
DITHER_SPLASH_MS=99999 DITHER_SPLASH_AT=2400 npm run smoke
# -> $DITHER_SMOKE_DIR/dither-splash.png, frozen at 2.4 s
```

## Performance

The desktop build inherits the engine's budget unchanged: the working image is
capped at 1600 px on its longest side, dragging a slider renders a half-res
preview on the next frame, and the full pass runs when the control is released.
Video works on a frame capped at 720 px on its longest side and drops a frame
that overruns its slot rather than queueing it. The chrome adds nothing per
frame — the only timer in the app polls a recording flag twice a second. On a
1024² frame the heaviest algorithm stays in the low seconds, which is the same
number the web build reports.

## Requirements

A modern browser (Chrome, Edge, Brave, Firefox or Safari) is enough for the web
builds. A Chromium-family browser is only needed for the app-window launchers.
No Node, no Python, no package manager — Node is needed only to run the tests or
regenerate the icons, and the desktop build adds Node 20+ and its two dev
dependencies.

## Verification

Three layers of checks ship with the app.

### The engine, in Node

```bash
node launcher/test.js
```

The tests use Node's built-in `assert`; nothing needs installing. They cover
matrix generation and endpoint safety, void-and-cluster determinism, blue-noise
bounds, palette lookup, tone reproduction on flat patches, palette membership of
every output pixel, seeded determinism across all 46 algorithms, the
structure-aware screens, pixel chunking, settings clamping, the adjustments,
every effect and its modes, glow, tone maps, the three alpha modes, the video
temporal rules, and the performance budget — and they print the timings for the
1024×1024 pixel-size-1 budget, so a regression is visible even when the generous
cap still passes. 87 checks, and CI runs the same command on Node 20 and 22.

### The page, in a real browser

`tools/` holds a small headless driver that loads a page, records console and
page errors, can press keys, click, assert selectors exist, evaluate JS and
screenshot. It prints a JSON summary and exits non-zero on any error or missing
`--expect`.

```bash
bash tools/check.sh launcher/index.html --expect canvas --screenshot /tmp/dither.png
```

| Option | Meaning |
|---|---|
| `--wait <ms>` | wait after load before checking (default `1000`) |
| `--size <WxH>` | viewport size (default `1000x700`) |
| `--expect <sel>` | fail unless the selector exists (repeatable) |
| `--press <key>` | press a key after load, e.g. `c`, `0`, `r` (repeatable) |
| `--click <sel>` | click an element after load (repeatable) |
| `--screenshot <file>` | save a PNG of the final state |
| `--eval <js>` | evaluate JS in the page and print the result |
| `--headed` | show a real window (default: headless) |

A local path is turned into a `file://` URL automatically. `check.sh` is a
wrapper that points `NODE_PATH` at the global npm root; `browser-check.cjs` also
falls back to `npm root -g` itself, so the wrapper is a convenience, not a
requirement. It needs Playwright installed **globally**, so the app stays
dependency-free:

```bash
npm install -g playwright
playwright install chromium
```

The page exposes `window.__dither`, so a check can set a recipe, run a preset or
step through video frames without clicking anything:

```bash
# what the app currently reports
bash tools/check.sh launcher/index.html --eval "JSON.stringify(window.__dither.stats())"

# a preset, then the inks actually drawn on the canvas
bash tools/check.sh launcher/index.html --eval \
  "window.__dither.applyPreset('matrixrain'); window.__dither.canvasColors()"

# the console: station state, the effects stack, the update mode
bash tools/check.sh launcher/index.html --eval "(function(){ var d = window.__dither; \
  d.addEffect('scanlines'); d.addEffect('grain'); d.moveEffect(1, -1); \
  return { stack: d.activeEffects(), quality: d.setQuality('still'), \
           groups: d.groups().length, swatches: d.swatches().length }; })()"

# video, with no file and no camera: the generated clip drives real frames
bash tools/check.sh launcher/index.html --eval \
  "JSON.stringify(window.__dither.videoSynthetic(480, 320))"
```

Run from the repository root so `launcher/index.html` resolves, and note that the
harness takes only the last `--eval` — chain multi-step checks inside one
(async) expression. `ok` is `true` only when there are no console errors, no page
errors and every `--expect` matched. [GUIDE.md](GUIDE.md) describes what the app
should do when you drive it, and lists every hook.

### The examples folder

`examples/` is generated rather than maintained — [`tools/make-examples.js`](tools/make-examples.js)
writes the pictures, the contact sheet, the manifest and the README's table from
one list — so what it needs is a check that the four still describe the same set:

```bash
node tools/check-examples.js
```

It runs in Node with no browser and no dependencies, reads each PNG's own header
to confirm the size the manifest claims, and fails on a file that was added by
hand, a picture re-exported at another size, a table row that lost its picture,
prose that names a file which is not there, or a page that reaches outside the
folder. `test.yml` runs it beside the engine tests.

Rebuilding the set needs a browser, because it is the app's real press:

```bash
node tools/make-examples.js                 # every picture
node tools/make-examples.js vhs text        # only the ones named
node tools/make-examples.js --list          # print the set, draw nothing
node tools/make-examples.js --width 1400    # draw bigger; 0 uses the painting's own size
```

It opens [`launcher/index.html`](launcher/index.html) in Chromium through the
global Playwright, applies each recipe through the same calls the panels make,
and saves the pixels on the proof canvas. Before it draws anything it checks
every recipe against the app's own catalogues, so a name the app does not have
fails the run and names itself.

### The desktop app's own checks

```bash
cd desktop
npm test                                       # the core and the tutorial: 39 checks, no window
npm run smoke                                  # boot, check, screenshot, exit 0/1
```

`npm test` runs both Node suites. `tools/core.test.js` covers the colour round
trip, the catalogue lookups the steppers and the menus share, the settings paths,
the station notes and the dropdown builder (21 checks); `tools/tour.test.js`
covers the tutorial's lesson data (18 checks), and it reads `app.js` itself for
the command names and panel ids, so a lesson cannot outlive the verb it drives.
Neither suite needs a window.

`npm run smoke` is `electron . --smoke --smoke-script tools/smoke-in-page.js`.
`--smoke` loads the real app and waits for it to signal ready, `--smoke-script`
evaluates that file in the page, then the harness prints one JSON report and
exits non-zero on any console error, page error, failed check or failed command
— the page's own verdict is part of the run's, not a footnote beside it. It also
photographs both windows into `$DITHER_SMOKE_DIR`: the splash window shoots
itself as its animation reaches the wordmark (it is over in under three seconds,
so waiting for the page checks to finish would miss it), and the app window is
shot at the end. The run also gets a profile of its own, deleted before it
starts, so it always meets the app the way a fresh install does — the presets,
panels and tutorial progress on the machine running it are untouched.

The current run makes 80 checks: the chrome exists, the catalogues fill their
lists, every slider is painted, the menus draw, their submenus expand to the full
catalogue and stay open while the pointer is on one of their rows, the 32 command
names the run exercises are all wired, the effects stack is the real markup,
panels answer to their own verbs, and **a key press runs exactly one command**.
The tutorial is checked the same way: every one of its lessons points at a
control that exists and names a command that is wired, starting a lesson puts the
ring over the named control (measured against that control's own box), Next and
Back move one step at a time, **Show me** performs the step and the card ticks
itself off once the app agrees, a row the app is hiding is pointed at through the
panel around it, the rail is scrolled until that panel is on screen, Escape
leaves, and finishing a lesson records it and offers the next one. The first-run
behaviour is held to the same bar: an install that has never run the tour is met
by it with Skip on the card, Skip is remembered and folds the Learn station away
with it, *Take the Tour* brings that station back, and finishing every lesson
folds the station away and closes the card without waiting to be dismissed.

Environment variables let it exercise the parts a page cannot reach:

| Variable | What it does |
|---|---|
| `DITHER_SMOKE_DIR` | where the screenshots go (default: the temp directory) |
| `DITHER_SMOKE_SAVE=<path>` | answer every save dialog with this path — how the export chain is proved end to end |
| `DITHER_SMOKE_OPEN=<path>` | answer every open dialog with this file (an image or a clip) |
| `DITHER_SMOKE_MENU='File/Save Proof as PNG'` | click that native menu item, then report whether a file landed |
| `DITHER_SMOKE_KEY=ctrl+s` | send that key through the window's input pipeline (`DITHER_SMOKE_KEY_BEFORE=1` to press before the page script) |
| `DITHER_SMOKE_REPORT=<path>` | also write the JSON report to a file — the only way to read the verdict of a packaged `.exe`, which has no console |
| `DITHER_SPLASH_MS=<ms>` | keep the splash up this long, to photograph it |
| `DITHER_SPLASH_AT=<ms>` | hold the splash animation on that one frame — how each stage was checked and how `docs/desktop-splash.png` was taken |
| `DITHER_NO_SPLASH=1` | skip the splash entirely |

```bash
# the whole export chain: a simulated Ctrl+S, then proof the file exists
DITHER_SMOKE_SAVE=/tmp/proof.png DITHER_SMOKE_KEY=ctrl+s npm run smoke

# the native menu drives the app
DITHER_SMOKE_SAVE=/tmp/menu.png DITHER_SMOKE_MENU='File/Save Proof as PNG' npm run smoke

# video mode: DITHER_SMOKE_OPEN answers the open-clip dialog with a real file
DITHER_SMOKE_OPEN=/tmp/clip.mp4 npm run smoke
```

The same harness runs against a packaged build, which is the only way to check
what actually shipped. Give the script an absolute path there: a portable
executable unpacks into its own temporary folder and runs with that as its
working directory.

```bash
DITHER_SMOKE_REPORT=/tmp/report.json DITHER_SMOKE_SAVE=/tmp/proof.png \
  DITHER_SMOKE_KEY=ctrl+s ./dist/Dither-Studio-<version>-portable.exe --smoke \
  --smoke-script "$PWD/tools/smoke-in-page.js"
```

## CI and releases

- **`test.yml`** runs the engine tests on Node 20 and 22 and the renderer-sync
  check, so a drifted engine copy fails the build.
- **`build.yml`** builds both platforms for every push that touches the app — the
  setup and the portable exe on a Windows runner, the x64 and arm64 disk images
  on a macOS one — and runs the full check set first (engine tests, desktop core
  tests, tour tests, engine-copy sync, two smoke runs), so a broken commit is
  never packaged. Push a `v<version>` tag, with `version` in
  `desktop/package.json` bumped to match, and a third job attaches every artifact
  to that tag's GitHub release.
- **`pages.yml`** publishes `demo/` to <https://thijnperd.github.io/dither-studio/>,
  after checking the demo is self-contained: no relative path may escape its own
  folder, and there must be no build step and no server.
