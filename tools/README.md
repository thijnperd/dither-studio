# tools — optional dev tooling

Nothing in this folder is a dependency of the app. `index.html` still opens from
`file://` with no build step and no install; these two scripts only exist so a
change to it can be *verified* in a real browser before it ships.

## `check.sh` and `browser-check.cjs`

A small headless driver: loads a page, records console and page errors, can press
keys, click, assert selectors exist, evaluate JS, and screenshot. It prints a JSON
summary and exits non-zero on any error or missing `--expect`.

```bash
bash tools/check.sh index.html --expect canvas --screenshot /tmp/dither.png
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

A local path is turned into a `file://` URL automatically. `check.sh` is a wrapper
that points `NODE_PATH` at the global npm root; `browser-check.cjs` also falls back
to `npm root -g` itself, so the wrapper is a convenience, not a requirement.

Requirements — Playwright installed **globally**, so the app stays
dependency-free:

```bash
npm install -g playwright
playwright install chromium
```

## Driving the app

The page exposes `window.__dither`, so a check can set a recipe, run a preset or
step through video frames without clicking anything:

```bash
# what the app currently reports
bash tools/check.sh index.html --eval "JSON.stringify(window.__dither.stats())"

# a preset, then the inks actually drawn on the canvas
bash tools/check.sh index.html --eval \
  "window.__dither.applyPreset('matrixrain'); window.__dither.canvasColors()"

# the console: station state, the effects stack, the update mode
bash tools/check.sh index.html --eval "(function(){ var d = window.__dither; \
  d.addEffect('scanlines'); d.addEffect('grain'); d.moveEffect(1, -1); \
  return { stack: d.activeEffects(), quality: d.setQuality('still'), \
           groups: d.groups().length, swatches: d.swatches().length }; })()"

# video, with no file and no camera: the generated clip drives real frames
bash tools/check.sh index.html --eval \
  "JSON.stringify(window.__dither.videoSynthetic(480, 320))"
```

Notes:

- Run from the repository root so `index.html` resolves.
- The harness takes only the last `--eval`, so chain multi-step checks inside one
  (async) expression.
- `ok` is `true` only when there are no console errors, no page errors, and every
  `--expect` matched.
- `AGENTS.md` lists the hooks along with the project's invariants, and `GUIDE.md`
  describes what the app should do when you drive it.
