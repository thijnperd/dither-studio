# demo — the frozen web demo

This folder is the **browser demo of Dither Studio**, published to
<https://thijnperd.github.io/dither-studio/> by
[`.github/workflows/pages.yml`](../.github/workflows/pages.yml) on every push
that touches it.

It is a byte-for-byte copy of the `dither studio web/` folder in the portfolio
repository (`thijnperd/AI_test_portfolio`), kept here so the demo can be hosted
from this repository's own Pages site. **It is frozen.** Do not edit it: it is
the version people link to, and the two copies are meant to stay identical.

```bash
# prove it is still the portfolio copy, byte for byte
cmp demo/app.js "../dither studio web/app.js"
```

## What is in here

| File | |
|---|---|
| `index.html` | the whole page: rail of stations, the proof, the status bar |
| `app.js` | the browser shell (DOM, controls, video, exports) |
| `dither.js` | the dithering engine — DOM-free, shared with every other build |
| `video.js` | the video source, clock and recorder |
| `style.css` | the instrument-panel stylesheet |

It opens with no build step, no server and no dependencies: `file://` and a
static host both work. That is why the Pages workflow uploads this directory
as-is and checks that every asset the page names still exists.

## Where the other builds live

Dither Studio ships three ways from this one repository, and only one of them
is this folder:

| Build | Where | State |
|---|---|---|
| **Web demo** | `demo/` | frozen — this folder, hosted on Pages |
| **Launcher app** | the repository root | frozen — the same page plus app-mode launchers, an installable manifest and generated icons |
| **Desktop app** | `desktop/` | active — the Electron build, released as a Windows `.exe` |

All three run the same `dither.js`. The engine is the part that is genuinely
shared; the shells around it differ on purpose.
