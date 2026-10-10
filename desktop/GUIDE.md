# Dither Studio, the desktop app — a guide

The web versions are a page you open. This one is an application you launch: it
has a window it draws itself, menus that hold the whole catalogue, dialogs the
operating system owns, and a file on disk when you are done. This guide is about
*that* — the desktop half. For what each dithering control does, the algorithm
catalogue, the palettes, the effects and the video rules, read the repository's
[`GUIDE.md`](../GUIDE.md); every one of those controls is here, unchanged.

---

## 1. Getting it

Two files come out of a release:

| File | What it is |
|---|---|
| `Dither-Studio-Setup-<version>.exe` | an installer. Per-user by default (no administrator prompt), you choose the folder, it adds a Start menu entry and a desktop shortcut if you ask |
| `Dither-Studio-<version>-portable.exe` | one file, no install. Put it on a USB stick and it runs from there |

Both are the same application. The portable build keeps its own settings next
to nothing — it writes to the standard per-user application data folder, so your
panels and presets survive moving the file around.

Windows may show a SmartScreen notice the first time, because the builds are not
code-signed. *More info* → *Run anyway*.

## 2. Starting it

Launching shows the app's own startup screen: Adam and God reach toward each
other across a dark panel, and the moment their fingertips touch, Adam is
dithered — real dots, spreading back from the fingertip — and starts to glow.
The wordmark inks in underneath and the window opens. It is one self-contained
file (`electron/splash.html`) and it is yours to replace; the README names the
three things to change in it.

The screen stays up for 2900 ms or until the window is genuinely ready,
whichever is longer, so it never covers a half-drawn app. The main window then
takes focus.

The app opens on a generated demo scene, so there is something to dither before
you have found a file.

## 3. Choosing something to work on

Four ways in, all of them native:

- **File ▸ Open Image…** (`Ctrl+O`) — the system dialog, filtered to the formats
  that make sense (PNG, JPEG, WebP, GIF, BMP, AVIF).
- **Drag a file onto the proof.** A dashed veil appears while you hover; the file
  loads on drop.
- **Paste** with `Ctrl+V` — an image on the clipboard becomes the source. A
  screenshot pasted straight out of a capture tool is the fastest path there is.
- **Open *with* Dither Studio** — image files can be associated with the app in
  Windows; double-clicking one opens it here. A second launch focuses the window
  that is already running instead of starting another.

The **Source** panel shows what is loaded and offers the generated demo scene
again (`Ctrl+D`). The caption bar and the document tab both name the proof.

**Clips and webcams** live in the **Motion** panel, and in *File ▸ Open Clip…*
(`Ctrl+Shift+O`). The transport appears under the proof; see §7.

## 4. Reading the window

The window is deliberately shaped like a professional editing app rather than a
web page:

- **Menu bar** — eight menus. If a control exists anywhere in the app, its verb
  is in one of them, with its shortcut printed on the right. Alt plus the first
  letter opens a menu (`Alt+P` for Press); ← → walk along the bar, ↑ ↓ within a
  menu, Enter runs, Escape closes.
- **Options bar** — how you are *looking*: zoom controls and the zoom readout,
  the update mode (Full / Live / Still), Compare, Random, Copy PNG, the export
  scale and Export PNG.
- **Tool rail** — the verbs worth a button: open, demo, compare (hold to see the
  source), random, webcam, clip, record, presets. A tool that is engaged lights
  up in the accent colour.
- **Document tabs** — the proof's name, its pixel size and the zoom it is at.
- **The well** — the proof on a checkerboard. Drag to pan once it is bigger than
  the well; `+` / `−` / `0` zoom.
- **Dock** — ten panel tabs over one scrolling column of collapsible panels.
  Click a tab to jump to its panel. Every slider draws the part it has travelled
  in the accent colour, and every value can be read at a glance on the right.
- **Two status lines** — the viewport bar (update mode, video transport) and the
  status bar (file, size, algorithm, palette, colours, last render time, and the
  app's own message, e.g. `Saved proof.png`).

### Menu by menu

**File** — open an image or a clip, the demo scene, save the proof as a PNG,
copy it to the clipboard, export a text proof, import and export presets, quit.

**Edit** — roll a fresh recipe (`Ctrl+R`, the equivalent of the Random tool), a
new seed (`Ctrl+Shift+R`), and Reset Every Control, which puts every slider back
to the shipped default without touching your source.

**Image** — the pixel stage: the tone map (the whole list), transparency mode
(flatten onto paper / dither the matte / keep as PNG alpha), print with
characters, the character ramp, and shortcuts to the Tone and Detail panels.

**Press** — the heart of it: the full algorithm menu (all 46, each with its
`name` as written in the app), the full palette menu, previous/next for both
(`Ctrl+↑↓`, `Ctrl+←→`), Serpentine Sweep, and the 21 recipe presets. The item you
are on is ticked, so the menu doubles as a readout of the current press.

**Effects** — add any effect from the stack catalogue; the stack is ordered and
reorderable in the Effects panel, and Clear the Stack empties it.

**View** — zoom in/out/fit, the update mode, Compare with the Source, whether the
dock is shown at all, reload the window, developer tools, full screen.

**Window** — every panel by name (tick = open), Open Every Panel, Collapse Every
Panel. Collapsing the panels you are not using is the fastest way to give the
proof more room; *View ▸ Panels on the Right* hides the dock entirely.

**Help** — the repository guide, the keyboard list, the engine's sources
document, the project page, and About.

## 5. Making a proof

Nothing changes from the web versions: pick an algorithm and a palette, set the
pixel size, threshold and strength, tune the tone, ink, detail, effects and
glow, and the proof updates as you drag. Three things are worth repeating
because they are what the app is for:

- **Live** mode renders a half-resolution preview while your finger is down and
  the full pass the moment you let go. **Still** waits for the release. **Full**
  is for when you want to watch an expensive algorithm work.
- **Hold Compare** (or the eye in the tool rail, or `C`) to flash the source
  under the proof. What you are judging is how much of the picture survived.
- The proof is deterministic: the seed in the Press panel drives every random
  stage, and the same recipe always produces the same image.

## 6. Getting it out

- **File ▸ Save Proof as PNG…** (`Ctrl+S`) writes what is on screen, at the
  export scale you chose (1×, 2×, 4×, 8×, nearest-neighbour, so pixels stay
  pixels). The system save dialog proposes a name derived from the source —
  `portrait-dither-2x.png` — and remembers nothing you did not tell it.
- **File ▸ Copy Proof to Clipboard** (`Ctrl+Shift+C`) puts a real PNG on the
  system clipboard, ready for a document, a chat window or an image editor.
- **Export Text Proof…** writes the character proof as a `.txt` grid when Type
  mode is on; the status line reports the grid's size.
- **File ▸ Export Preset…** writes the current recipe as JSON — algorithm,
  palette, every control and the effect stack. **Import Preset…** reads one back.
  These are the files to share; they are the same JSON the web build writes.

After any save, the caption bar shows a receipt with the file's name. Click it
and the folder opens with the file selected.

Where the file goes is the operating system's business: the dialog starts in the
last folder Windows used, and you can type a path. The app never writes anywhere
you did not point it at.

## 7. Clips, webcams and recording

**Motion** panel, or *File ▸ Open Clip…*:

- **Webcam** asks the operating system for the camera. The permission prompt is
  the system's own, and the app keeps no camera permission of its own beyond
  that.
- **Open clip…** plays a video file — MP4, WebM, MOV, MKV, AVI, M4V — through
  the press, frame by frame.
- **Temporal dither** decides what a frame *means*: *Frozen* keeps one screen for
  the whole clip, *Shimmer* reshuffles the random screen every frame, and *Crawl*
  slides the screen a pixel per frame. The sensible default for a clip is
  Frozen.
- The transport under the proof plays and pauses; the readout gives the frame
  number and the frame rate, and reports dropped frames if the machine cannot
  keep up.
- **Record** (the circle in the tool rail, or the record button in the panel)
  captures the playback to a WebM — the recording pulses in the accent colour
  while it runs, and the file lands through the same system save dialog.

## 8. Panels, and how they remember themselves

Panels collapse by clicking their header and open by clicking their tab in the
dock strip. Which ones are open is remembered between sessions, exactly as in
the web build: the app stores a list of station names, not a blob of state, so
a future version that adds a panel does not leave a stale one behind.

The rest of your recipe is not silently persisted. Presets are files, on purpose:
a `.json` you can read, diff and keep.

## 9. Troubleshooting

**The window is white or empty.** Almost always a failed load of the renderer.
Press `F5`; if it persists, start the app from a terminal (`npm start` in
`desktop/`) and read the first error — the same code runs in both.

**The window has no shadow or looks like it lost its border.** It is frameless on
purpose: the caption bar is drawn in HTML, so the app's edge is the content's
edge. Drag the caption bar to move it, double-click it to maximise, and use the
buttons at the right to minimise, maximise and close. `F11` toggles full screen.

**A menu opens and closes immediately.** Something is hovering it: the menus
close on click-away, and a stray pointer resting on a menu row will close a
submenu. Move the pointer off the menu and reopen it.

**Ctrl+S does not open a save dialog.** Check that the window has focus (click
the proof once). The save dialog is the operating system's and it appears over
the app, not over your terminal.

**The webcam is missing.** Another application is holding the camera, or Windows
camera privacy settings are blocking desktop apps. Close the other app, or check
Settings ▸ Privacy ▸ Camera.

**An export is refused or huge.** At 8× on a 1600 px source the PNG is a 12800 px
image — the app writes it, but the file is tens of megabytes and some viewers
will struggle. Export at 1×–2× for anything that will be shown on screen.

**The app feels slow on a big frame.** Update mode *Live* is the setting for
tuning; *Full* re-renders everything on every drag. The engine caps the working
image at 1600 px on its longest side, which is the number that keeps a laptop
comfortable.

**Where are my files?** Installer builds put the application in
`%LOCALAPPDATA%\Programs\Dither Studio`; the portable build is wherever you put
it. Neither writes into Documents; proofs go only where you saved them.

## 10. For the curious: how the three builds relate

There is one dithering engine — `dither.js`, DOM-free, shared byte-for-byte by
the web demo, the launcher app and this one. Everything around it differs on
purpose: the web builds are a page with a rail, the desktop build is a window
with docks and menus. The desktop has its own core (`src/renderer/core.js`) and
its own shell (`src/renderer/app.js`); what is copied from the shared engine is
just the engine, and `desktop/tools/sync-renderer.js --check` — which CI runs —
fails if those copies drift. If you want to change something that is about
*dithering*, change it once, in `dither.js`, and all three builds get it.
