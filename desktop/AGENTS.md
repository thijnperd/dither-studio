# AGENTS.md — the desktop build

Working notes for `desktop/`, the Electron application. Read the repository's
[root `AGENTS.md`](../AGENTS.md) first: it explains that this repository holds
three builds and says which parts are frozen. This file adds what is specific to
the one you are allowed to change.

The app is a real window — a caption bar it draws itself, a menu bar holding the
whole catalogue, the operating system's dialogs — around the same engine the web
builds use. World and voice do not change: **instrument panel, print shop**.

## The first rule

**Dithering lives in `../dither.js`, and only there.** `src/renderer/dither.js`
and `src/renderer/video.js` are copies of the root files; `src/renderer/app.js`
is the root `app.js` with ten hunks applied. Anything about algorithms, screens,
palettes, tone maps, adjustments, effects, glow or the video temporal rules is a
change to the shared core, followed by:

```bash
node tools/sync-renderer.js          # regenerate the copies
node tools/sync-renderer.js --check  # CI runs this; it must pass
```

If a change *does* belong to the desktop shell, add a hunk to
`tools/sync-renderer.js` (with a comment saying why), regenerate, and keep the
hunk count in that file's header comment honest. The generator asserts that every
hunk matches exactly once, so a stale hunk fails loudly — that is the point.

## File responsibilities

| File | Responsibility |
|---|---|
| `electron/main.js` | The window, the splash, native dialogs, the clipboard, the application menu, single-instance handling, and the smoke harness. No catalogue data: the renderer expands `src/menu-spec.js` and sends the finished tree. |
| `electron/preload.js` | The only bridge to the OS. Context-isolated, `nodeIntegration` off, every channel named `ds:*`, every handler returning a plain object. Add a verb here before you use it in the renderer. |
| `electron/splash.html` | The startup screen: Adam and God reach, Adam is dithered and glows, the window opens. One self-contained document (inline style and script, every image inlined as a data URI); `electron/Splash/` holds the source PNGs and `build.files` keeps them out of the package. The frames only blit — a pre-dithered image is revealed by a wipe and the ink and glow are built once, never a screen pass per frame. This is the file a designer replaces. |
| `src/index.html` | The window's markup. Every id in `src/renderer/app.js`'s `el` map must exist here; the panels are the frozen web markup inside new chrome. |
| `src/menu-spec.js` | The one menu definition. `catalogue:` entries are expanded by the host against the app's own tables, so a new algorithm can never be missing from a menu. |
| `src/renderer/{dither,video,app}.js` | Generated. Do not hand-edit; see the first rule. |
| `src/renderer/shell.js` | The chrome: menus (drawn and the tree sent to main), the tool rail, the caption bar, the document tab, slider fills, and the window verbs. It owns no app behaviour — every other verb is a `DS.command` name. |
| `src/styles/tokens.css` | Tokens, the page grid, and **every element-level rule** (buttons, selects, sliders, fields). |
| `src/styles/chrome.css` / `panels.css` | Component classes only. They load after `tokens.css` and must never restyle a bare element, or load order starts deciding the look. |
| `tools/sync-renderer.js` | The generator. |
| `tools/smoke-in-page.js` | The page half of the smoke run. |

## Rules

- **Dependencies**: `electron` and `electron-builder`, both dev, nothing else.
  The renderer must stay dependency-free — it runs the same files the web build
  does, and `npm install` in this folder must never be needed to open the app.
- **No Node in the renderer.** `contextIsolation` is on, `nodeIntegration` is
  off. Everything crosses through `preload.js`. Never add a channel that takes a
  path and returns bytes without validating it, and never let the renderer name
  a path it will write to without a dialog (the smoke overrides are the only
  exception, and they are environment-gated).
- **Files arrive as bytes.** Not because it is tidier, but because a `file://`
  image in a `file://` page is an opaque origin to Chromium: using one would
  taint the canvas and break `getImageData`, which is the engine.
- **One chrome, two menu bars.** The drawn menu bar and the native menu come
  from `src/menu-spec.js`. Never add an item to one of them alone.
- **Accelerators**: main registers the tree with Electron (that is macOS's menu
  bar and its accelerator table); `shell.js` binds the same keys on Windows and
  Linux, where a frameless window has no menu bar to own them. Both must stay,
  and both read the same table, so a key can never mean two things.
- **Never let the window navigate.** `will-navigate` and `setWindowOpenHandler`
  are guarded in `main.js`; an external URL opens in the real browser instead.
- **The window is an application, not a page**: no text selection outside fields,
  no rubber-banding, no links that leave, no context menu that says "Back".
- **Performance**: nothing in the chrome may run per frame. The only timer in
  `shell.js` polls one flag twice a second to light the record indicator, and the
  slider fill is repainted on `input` and on the app's own `ds:ui` event, never
  on a loop.
- **Colours come from `tokens.css`.** One accent, used only for the selected or
  active thing. No new hues, no gradients except the slider thumb.

## Verify before you finish

```bash
node tools/sync-renderer.js --check    # the renderer is in step
npm run smoke                          # 33 in-page checks; exit 0 is the bar
```

`--smoke` boots the real app, waits for it to signal ready, runs
`tools/smoke-in-page.js` in the page, screenshots the window (and the splash),
prints one JSON report and exits non-zero on any console error, page error or
failed check. When you touch an export, an accelerator or a menu, exercise the
part a page cannot reach:

```bash
DITHER_SMOKE_SAVE=/tmp/proof.png DITHER_SMOKE_KEY=ctrl+s npm run smoke
DITHER_SMOKE_SAVE=/tmp/menu.png DITHER_SMOKE_MENU='File/Save Proof as PNG' npm run smoke
```

Two lessons this harness already taught, so the next change does not have to
relearn them:

- **A simulated key needs the window focused** (`main.js` shows and focuses
  before pressing) or it goes nowhere, and a press that "does nothing" is
  indistinguishable from a feature that does nothing.
- **The app window is on a real desktop while the checks run.** A real pointer
  resting over a menu row fires a genuine `mouseenter` and closes a submenu, so a
  hover-state assertion must read the DOM in the same tick as the interaction.
  `tools/smoke-in-page.js` does that deliberately; keep it that way.

## Releasing

```bash
npm run dist                     # dist/Dither-Studio-Setup-<version>.exe + portable
gh release create v<version> dist/*.exe --title '…' --notes '…'
```

Bump `version` in `package.json` in the same commit as the tag. The Windows
artifacts are unsigned, so a first run may raise SmartScreen; say so in the
release notes rather than hoping nobody notices.
