# Dither Studio, the desktop app — a guide

The web versions are a page you open. This one is an application you launch: it
has a window it draws itself, menus that hold the whole catalogue, dialogs the
operating system owns, and a file on disk when you are done. This guide is about
*that* — the desktop half. For what each dithering control does, the algorithm
catalogue, the palettes, the effects and the video rules, read the repository's
[`GUIDE.md`](../GUIDE.md); every one of those controls is here, unchanged.

---

## 1. Getting it

The Windows release has two files; the macOS release has two disk images and a
zip (the zip is the updater's copy, not the first-install download):

| File | What it is |
|---|---|
| `Dither-Studio-Setup-<version>.exe` | an installer. Per-user by default (no administrator prompt), you choose the folder, it adds a Start menu entry and a desktop shortcut if you ask. A newer one removes any older Dither Studio first |
| `Dither-Studio-<version>-portable.exe` | one file, no install. Put it on a USB stick and it runs from there |
| `Dither-Studio-<version>-arm64.dmg` / `-x64.dmg` | macOS installers for Apple silicon and Intel |

Both are the same application. The portable build keeps its own settings next
to nothing — it writes to the standard per-user application data folder, so your
panels and presets survive moving the file around.

Installing a newer version replaces the old one. The setup looks for any earlier
Dither Studio first — one you put in a folder of your own, one installed for all
users, one left behind with its files already gone — removes it, and only then
installs itself. It shows up in *Apps & features* once, as "Dither Studio", with
the version beside it. Presets, panels and tutorial progress live in
`%APPDATA%\Dither Studio` and survive the upgrade.

Windows may show a SmartScreen notice the first time, because the builds are not
code-signed. *More info* → *Run anyway*.

### Updating

The app checks the public GitHub release feed quietly on launch. If a newer
release has a build for this machine, it offers the notes and a download; a
failed check never interrupts a press that is working offline. You can ask at
any time with *Help ▸ Check for Updates…*.

On Windows the downloaded setup runs after the app closes, installs silently and
starts the new version. On macOS the downloaded zip replaces the app after it
closes and reopens it. The first macOS install still comes from the disk image.
Neither build is signed, so the usual SmartScreen and Gatekeeper warnings apply.

After an update, the first launch reads the matching section of the repository's
`CHANGELOG.md` and opens its **What's New** page once. *Help ▸ What's New…* shows
the notes for the running version whenever you want them again. Keyboard
shortcuts and About live in the same window: one searchable Help surface with a
grouped page list on the left.

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

The app opens on a built-in sample — three public-domain paintings (Moreau's
*Oedipus and the Sphinx*, Winge's *Tor's Fight with the Giants*, and *The Council
of the Gods* from the Villa Farnesina) travel with the app — so there is something
to dither before you have found a file.

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

The **Source** panel shows what is loaded and offers the built-in sources as a
picker: a dropdown with all three names, a thumbnail of each painting underneath,
and the arrows beside the dropdown to step through them. `Ctrl+D` still steps on
to the next painting from anywhere, and after the third it comes round to the
first. The caption bar and the document tab both name whatever is on the stage.

**Clips and webcams** live in the **Motion** panel, and in *File ▸ Open Clip…*
(`Ctrl+Shift+O`). The transport appears under the proof; see §8.

## 4. Reading the window

The window is deliberately shaped like a professional editing app rather than a
web page:

- **Menu bar** — eight menus. If a control exists anywhere in the app, its verb
  is in one of them, with its shortcut printed on the right. Alt plus the first
  letter opens a menu (`Alt+P` for Press); ← → walk along the bar, ↑ ↓ within a
  menu, Enter runs, Escape closes.
- **Options bar** — how you are *looking*: zoom controls and the zoom readout,
  the update mode (Full / Live / Still), Compare, Split, Random, Copy PNG, the
  export scale and Export PNG.
- **Tool rail** — the verbs worth a button: open, the built-in sources, compare
  (hold to see the source), random, webcam, clip, record, presets. Hover or tab
  to an icon and a tooltip names it; a tool that is engaged lights up in the
  accent colour.
- **Document tabs** — the proof's name, its pixel size and the zoom it is at.
- **The well** — the proof on a checkerboard. Drag to pan once it is bigger than
  the well; `+` / `−` / `0` zoom.
- **Dock** — eleven panel tabs over one scrolling column of collapsible panels.
  The strip is a single row that scrolls sideways and keeps the panel you are in
  visible; station headers stay pinned at the top of the column while you scroll
  it. Click a tab to jump to its panel, or press `Ctrl+K` and type what you want.
  Every slider draws the part it has travelled in the accent colour.
- **Find anything** — `Ctrl+K`, or the magnifier at the right of the panel tabs,
  opens one field over the whole app: the stations, all 46 algorithms, the
  palettes, tone maps, effects, recipes and the common verbs. ↑ ↓ move, Enter
  runs, Escape closes. It is the fastest way to an algorithm whose name you only
  half remember.
- **Two status lines** — the status bar (file, size, algorithm, palette, colours,
  last render time, and the app's own message, e.g. `Saved proof.png`), and the
  viewport bar under the proof, which appears only while a clip is loaded and
  carries the transport.

### Menu by menu

**File** — open an image or a clip, the next built-in source (`Ctrl+D`), save the
proof as a PNG, copy it to the clipboard, export a text proof, import and export
presets, import a color palette, extract one from an image, open the Color
Scheme Maker, manage saved schemes, open the Plugin Manager, quit.

**Edit** — undo and redo recipe changes (`Ctrl+Z` / `Ctrl+Shift+Z`), roll a
fresh recipe (`Ctrl+R`, the equivalent of the Random tool), a new seed
(`Ctrl+Shift+R`), and Reset Every Control, which puts every slider back to the
shipped default without touching your source. Undo covers the recipe —
algorithm, palette, tone, effects and character settings — not loading a new
image; a new source starts a fresh timeline. A slider drag is one undo step.

**Image** — the pixel stage: the tone map (the whole list), transparency mode
(flatten onto paper / dither the matte / keep as PNG alpha), print with
characters, the character ramp, and shortcuts to the Tone and Detail panels.

**Press** — the heart of it: the full algorithm menu (all 46, each with its
`name` as written in the app), the full palette menu, previous/next for both
(`Ctrl+↑↓`, `Ctrl+←→`), Serpentine Sweep, and the 25 built-in recipe presets
(plus any installed preset packs). The item you are on is ticked, so the menu
doubles as a readout of the current press.

**Effects** — add any effect from the stack catalogue; the stack is ordered and
reorderable in the Effects panel, and Clear the Stack empties it.

**View** — zoom in/out/fit, the update mode, Compare with the Source, Split
Compare, whether the dock is shown at all, reload the window, developer tools,
full screen.

**Window** — every panel by name (tick = open), Open Every Panel, Collapse Every
Panel. Collapsing the panels you are not using is the fastest way to give the
proof more room; *View ▸ Panels on the Right* hides the dock entirely.

**Help** — the tour (take it, hide it completely, or show the Learn panel), the
repository guide, Check for Updates, the engine's sources document, the project
page, and one Help window holding the keyboard list, What's New and About.

## 5. The tutorial

The app can teach itself. A fresh install is met by the tour: the **Learn** panel
comes forward and the first lesson is already on screen. If you would rather not
be taught, **Skip** in the corner of the card ends it for good — that answer is
remembered, so the tour never opens by itself again — and **Exit** or `Escape`
does the same thing for this run.

To start it yourself, open the **Learn** panel — first in the dock, and the only
station that starts open — and press **Take the Tour**, or use *Help ▸ Take the
Tour* from the menu bar. Both bring the station back if it has folded itself
away.

Ten lessons, one per station, in the order the work happens: the first proof, the
press itself, the grade, ink and paper, the effects stack, text mode, the three
structure-aware looks, motion, recipes and exports, and finding your way around
the window. Each lesson is five or six steps, and each step has one job.

A step dims the window, opens the panel it is about and draws a ring around the
one control it means — scrolling the rail to it if it is further down than the
screen. It never takes your click: you use the real control while the card waits.
A step the app can see — a chosen algorithm, a palette, a recipe applied, text
mode switched on — ticks itself off the moment the state changes, so the card
agrees with the proof rather than with your memory of it.

Three buttons do the rest. **Show me** performs the current step's own setting
for you, **Back** and **Next** move one step at a time, and the last *Next*
records the lesson as finished and offers the next one by name. **Reset**, beside
*Take the Tour*, clears every tick, starts the count again and puts the intro
back on offer. *Exit*, *Skip* or `Escape` leaves at any point, and whatever you
set while following a lesson stays set: the tour changes settings, never files.

Finish the last lesson and the tutorial takes itself out of the way: the Learn
station folds and the verdict card closes on its own a moment later. *Help ▸
Take the Tour* opens the station again with every tick still in place.

If you have learned it and want the station gone, press **Hide** beside *Reset*,
or use *Help ▸ Hide the Tour Completely*. That removes the Learn station and its
jump chip and stops the intro; the setting survives a restart. *Help ▸ Show the
Learn Panel* is the way back.

Two notes. The tour describes the *desktop* panels; the web console has the same
controls in its own layout, and its [GUIDE.md](../GUIDE.md) is the tour for that
one. And nothing about it runs in the background: the card reads the app's state
when the app says it changed, and is otherwise asleep.

## 6. Making a proof

Nothing changes from the web versions: pick an algorithm and a palette, set the
pixel size, threshold and strength, tune the tone, ink, detail, effects and
glow, and the proof updates as you drag. Three things are worth repeating
because they are what the app is for:

- **Live** mode renders a half-resolution preview while your finger is down and
  the full pass the moment you let go. **Still** waits for the release. **Full**
  is for when you want to watch an expensive algorithm work.
- **Hold Compare** (or the eye in the tool rail, or `C`) to flash the source
  under the proof. What you are judging is how much of the picture survived.
  **Split** keeps both visible at once: drag the divider, or focus it and use
  the arrow keys. The split is a view only, so exports contain the proof alone.
- The proof is deterministic: the seed in the Press panel drives every random
  stage, and the same recipe always produces the same image.
- **Bring your own inks.** *File ▸ Import Color Palette…* opens a small import
  window. Paste a JSON array, a `{ "name", "colors" }` object, or a plain list
  of `#rrggbb` values, or choose a `.json`, `.hex` or `.txt` file. The strip
  under the field previews the inks it read. A palette needs 2–64 distinct
  colours; imports are saved with the app's settings, join the palette menu
  and Find, and are selected when they arrive. Importing the same name again
  updates that palette in place.

## 7. Getting it out

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

## 8. Clips, webcams and recording

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

## 9. Plugins, the Color Scheme Maker and the animation timeline

**Plugins are packages, not scripts.** *File ▸ Plugin Manager…* fetches the
catalogue over HTTPS from this repository (falling back to the copy bundled in
the app when GitHub is unreachable), groups it into **Functionality** and
**Presets & color schemes**, and installs or removes a package. Every row says
how much space the package takes; the line below the list totals what is stored
on this machine. Installed packages are kept in this app's local settings. A
package is declarative JSON — a tool capability, a set of recipes or a palette
pack — and no downloaded JavaScript is ever executed. **Install from file…**
loads a package someone exported, including a palette pack from another Dither
Studio.

- **Ink Extractor** (tool) opens a dialog that pulls a limited palette out of the
  open image with CINS, median-cut, octree or polarity clustering; the result is
  previewed and can be imported as a palette.
- **Color Scheme Maker** (tool) opens *File ▸ Color Scheme Maker…*. Start from a
  base ink and choose Free, Analogous, Complementary, Split complementary,
  Triadic, Tetradic or Monochrome. Generate the unlocked swatches, lock the ones
  you want to keep, sort by tone or hue, add or remove inks (2–32), name the
  result from its colours, copy the hex list, or save it straight into the
  palette menu. Press **Space** to generate again without reaching for the
  button. The import field takes a Lospec palette link or slug, palette JSON
  (including Lospec's own `.json`), or a pasted hex list; **Seed from image**
  pulls its inks from the open photo through Ink Extractor. The safety meter
  below the swatches reports the smallest tone step, the widest contrast and
  whether the inks run dark to light, and calls a too-tight pair muddy.
  **Export pack…** writes the scheme as a declarative palette plugin that can be
  installed through the Plugin Manager. *File ▸ Manage Color Schemes…* lists the
  schemes you saved or imported: rename one in place, reopen it here (Save
  changes keeps the same palette, even if the name changed), or delete it with a
  second confirmation. It is the Coolors/Lospec-shaped drafting table, built on
  the app's own palette store rather than a second format.
- **Shape Press** (tool) adds one effect to the stack: barcode, cross-stitch,
  halftone or bitmap shapes. It is hidden from the effect picker until the tool
  is installed; a recipe that names it still renders through the engine.
- **Palette packs** add colour schemes to the palette picker. A pack exported
  from the Color Scheme Maker is one; removing the pack removes its inks and
  falls back to the built-in palette if one was selected.
- **Preset packs** add whole recipes to the Presets station. The picker keeps
  the built-ins under **Built-in recipes** and gives each installed pack its own
  heading, so it is clear where a recipe came from. The bundled catalogue
  includes Niko's Glitch Universe, Caroline's Undead Dithering, 2_s0ur's Broken
  Signal and Dreamy Cyberpunk, the last adapted from Studio AAA's Dither Boy
  download. Removing a pack removes its heading and recipes and leaves the rest
  of the catalogue alone.

**Animate the still.** *Effects ▸ Animate the Still* puts a timeline over the
proof. Set the duration (1–12 s) and frame rate (6–30 fps), then add tracks for
Strength, Seed drift, Screen shift, Threshold, Pixel size, brightness, contrast,
saturation, hue, glow radius and glow intensity. Each track has a from/to value,
a slice of the timeline and one of four eases (linear, in, out, in-out); scrub
the playhead or press Play with the loop on, and export the take as a WebM.
Closing the timeline returns the still at the frame you stopped on. The
timeline is separate from clip playback: the normal video transport still owns
a clip while it plays.

## 10. Panels, and how they remember themselves

Panels collapse by clicking their header and open by clicking their tab in the
dock strip. Which ones are open is remembered between sessions, exactly as in
the web build: the app stores a list of station names, not a blob of state, so
a future version that adds a panel does not leave a stale one behind.

The rest of your recipe is not silently persisted. Presets are files, on purpose:
a `.json` you can read, diff and keep. Imported palettes are the deliberate
exception: they live in the app's local settings so they are there next launch.

## 11. Troubleshooting

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

## 11. For the curious: how the three builds relate

There is one dithering engine — `dither.js`, DOM-free, shared byte-for-byte by
the web demo, the launcher app and this one. Everything around it differs on
purpose: the web builds are a page with a rail, the desktop build is a window
with docks and menus. The desktop has its own core (`src/renderer/core.js`) and
its own shell (`src/renderer/app.js`); what is copied from the shared engine is
just the engine, and `desktop/tools/sync-renderer.js --check` — which CI runs —
fails if those copies drift. If you want to change something that is about
*dithering*, change it once, in `dither.js`, and all three builds get it.

**Every published build is made by GitHub Actions.** Push the commit and let
`.github/workflows/build.yml` run the tests and full smoke set on Windows and
macOS; a `v<version>` tag makes the release job attach those artifacts. Do not
package a release locally or upload a workstation build — a local `npm run build`
is only a diagnostic.
