# Changelog

What changed, newest first. The number that matters is the desktop app's:
`desktop/package.json` carries it, and a `v<version>` tag has to match it or the
build stops before it packages anything.

The release notes on GitHub are read from the section for the tag — the
`release` job in [`.github/workflows/build.yml`](.github/workflows/build.yml)
extracts it with `awk` — so the release page and this file cannot drift apart.
A tag with no section here fails the build instead of publishing an empty
release page; that is deliberate.

## 0.6.1 — Rays, riso, phosphor and guilloche (2026-11-13)

**Four new effect plugins, and a light origin you can place.**

- **Crepuscular Rays.** A new stack effect gathers the proof's bright areas
  outward from a movable origin into seeded light shafts, with a white-violet
  core. Its two Origin sliders place the source anywhere from a figure's chest
  to a point outside the frame; the value is stored as a percentage so it
  survives every export scale and appears in presets and JSON.
- **Riso Misprint.** Two rotated halftone plates, a deliberate registration
  slip and a warm paper stock, with Duotone and Black ink modes.
- **Phosphor Mask.** Cosine scanlines, an RGB triad and a little chroma bleed,
  with Aperture grille and Shadow mask variants.
- **Guilloche Plate.** Five outer and four counter-rotating inner banknote
  rosettes, engraved in light or dark ink around its own movable origin. The
  deliberately niche one.
- **The effects stack counts twenty-one.** The new effects join Shape Press as
  plugin-gated tools in the bundled catalogue, which now carries eleven
  packages: seven tools and four preset packs. Their package icons are the
  official Tabler outline marks (`sun`, `copy`, `device-tv`, `rosette`).
- **Provenance and checks.** The ray gather follows GPU Gems 3 ch.13, the riso
  screen the PostScript halftone model, the phosphor formulas Lottes' fast CRT
  shader, and the guilloche the hypotrochoid family; the longer notes are in
  `docs/effects-research.md`. The engine, desktop core, tour and plugin smoke
  suites cover the effects, their modes and the origin control.

## 0.6.0 — The studio menu and the guide (2026-11-13)

**One menu for the studio's surfaces, and one Help window that holds the manual.**

- **The Studio menu.** The rail's new first tool (also *View ▸ Studio Menu…*,
  `Ctrl+Shift+M`) opens four shelves: Plugins, Effects, Presets and Color
  Schemes. Each plate counts what is there before you open it. Effect switches
  change the live stack, recipes and saved schemes apply in one pick, and
  plugin rows start their tool instead of opening the manager: Ink Extractor
  and Color Scheme Maker open their dialogs, Shape Press joins the effects
  stack, and packs open the shelf they feed.
- **The menu looks like the rest of the press.** Flat panels, the app's
  monospace type and uppercase titles replace the gradient cards and the
  web-style copy. Hover and selection no longer move or scale the plates.
- **Help is the manual now.** *Help ▸ Dither Studio Guide* (F1) reads the
  shipped guide inside the Help window, parsed into searchable sections, instead
  of handing it to an external editor. The keyboard page is editable: press
  **Change** and then the combination; `Ctrl+?` (`Cmd+?` on a Mac) opens it.
  *Check for Updates* opens the About page with the check, progress and release
  notes in view, and *Help ▸ Learn Panel* is a single tick that hides or shows
  the Learn station.
- **The supplied icon set reaches the whole window.** The rail, steppers,
  effect controls, find fields and Help now use the Tabler-style masks that ship
  in `src/assets/icons/`, with their license beside the app.
- **The tour has eleven lessons.** A Studio menu lesson joins the first proof,
  the press and the rest; animation is covered too. A seed track on a fixed
  ordered or formula screen now drifts the screen itself, and a diffusion press
  says the track has nothing to move instead of pretending.
- **Animation exports are seekable.** WebM takes now carry their real duration,
  so players can scrub and report the length rather than treating the file as
  broken.
- **Smaller repairs.** The dock's spyglass opens the command palette again; the
  Studio menu footer no longer carries the "all changes stay on this machine"
  line or its green dot; and the "studio index" name is gone from the tour and
  the documentation.

## 0.5.1 — Schemes you can keep (2026-11-13)

**A manager for saved color schemes, and recipe pickers grouped by origin.**

- **Manage saved color schemes.** *File ▸ Manage Color Schemes…* lists every
  palette saved from the Color Scheme Maker or imported from a file. Rename one
  in place, reopen it in the maker (Save changes keeps the same palette, even
  after a rename), or delete it with a second confirmation. Built-in and
  plugin-owned palettes are not listed; deleting the selected scheme falls back
  to black and white.
- **Recipes grouped by origin.** The Presets picker now leads with **Built-in
  recipes** and puts each installed preset pack under its own alphabetised
  heading. Installing or removing a pack rebuilds the picker without duplicating
  options.

## 0.5.0 — Schemes that travel (2026-11-13)

**Lospec import, image-seeded schemes, a safety meter and shareable palette
packs.**

- **Lospec in one field.** The Color Scheme Maker now takes a Lospec palette
  link or slug (or its `.json`), fetches it through the main process, and loads
  the inks. Paste palette JSON or a plain hex list instead and the same field
  reads it. The fetch accepts only `lospec.com/palette-list/…` and is bounded;
  no downloaded code is involved.
- **A scheme from the open image.** *Seed from image* asks the installed Ink
  Extractor for the open photo's inks and fills the draft with them, leaving the
  locks and the rest of the drafting table alone.
- **A safety meter under the swatches.** It reports the smallest tone step, the
  widest contrast and whether the inks run dark to light, and marks a too-tight
  or duplicated pair **Muddy** before it lands in the palette menu.
- **Palette packs you can share.** *Export pack…* writes the draft as a
  declarative `palette-pack` plugin. The Plugin Manager can install one from a
  local JSON file; removing the pack removes its inks and falls back to the
  built-in palette if it was selected. Still JSON, never JavaScript.
- **Schemes now hold up to 32 inks**, so the larger Lospec lists fit without
  being cut to twelve. The manager also labels palette packs alongside preset
  packs and functionality tools.

## 0.4.0 — The press moves (2026-11-13)

**A timeline for stills, data-only plugins, and more inks and recipes.**

- **Animate a still.** *Effects ▸ Animate the Still* opens a timeline under the
  proof: 1–12 seconds at 6–30 fps, tracks for eleven settings (strength, seed
  drift, screen shift, threshold, pixel size, brightness, contrast, saturation,
  hue, glow radius, glow intensity), four eases and independent track slices.
  Scrub the playhead, loop playback, and export the take as a WebM. Closing the
  timeline returns the still at the frame you stopped on.
- **Plugins are declarative packages.** *File ▸ Plugin Manager…* fetches a JSON
  catalogue over HTTPS from this repository, falling back to the copy bundled
  with the app when GitHub is unreachable. Installing a package stores it on
  this machine; removing it takes it away. There is no `eval`, no `Function`, no
  `import()` and no downloaded JavaScript at all.
- **The first three plugins.** *Ink Extractor* pulls a palette from the open
  image with CINS, median-cut, octree or polarity clustering. *Shape Press* adds
  a barcode, cross-stitch, halftone or bitmap effect and stays hidden from the
  picker until its package is installed. Preset packs add whole recipes;
  the catalogue ships with Niko's Glitch Universe, Caroline's Undead Dithering,
  2_s0ur's Broken Signal and **Dreamy Cyberpunk**, adapted from Studio AAA's
  Dither Boy download.
- **Thirty ink sets.** The Cyberpunk palette download adds Breach (6 inks),
  Acid (12) and Holo (12), quoted from the pack and recorded in `SOURCES.md`.
  Breach is the set the two Dreamy Cyberpunk recipes use.
- **The demo says what it is.** On a desktop the web demo is a shop window: six
  recipes, no plugin manager and no custom palette import, with a route to the
  download. On a phone or tablet it unlocks all 27 recipes (the 25 built-ins
  plus the two Dreamy Cyberpunk recipes) and every palette, because the desktop
  app does not run there. The demo also keeps plugin-owned effects out of its
  stack, since it cannot install them.
- **Smoke checks are selectable.** `npm run smoke` is now a fast boot check;
  `npm run smoke:plugins`, `npm run smoke:animation` and `npm run smoke:quick`
  test one area, and `npm run smoke:all` is the full in-page set. The CI and
  release jobs run the full suite, and the focused suites skip the splash.
- The desktop guide covers the Plugin Manager, the Ink Extractor, Shape Press
  and the animation timeline; the README and palettes guide carry the new
  counts and the demo's rules.

## 0.3.2 — Your own inks (2026-11-12)

**Import a palette, undo a recipe change, and split the proof against its source.**

- **Custom palettes.** File ▸ Import Color Palette… opens a paste-first import
  window. It reads a JSON array of hex colours, a `{ "name", "colors" }`
  object (including Lospec-style exports), RGB triples, or a plain hex list —
  `#rrggbb`, `#rgb`, separated by commas, spaces or lines. Choose a `.json`,
  `.hex` or `.txt` file instead of pasting if you prefer. The ink strip previews
  the result before it is committed.
- **Imported palettes stay put.** Two to 64 distinct colours, named and saved in
  the app's local settings. They join the palette picker, the Press menu and
  Find, and are selected when they arrive. Re-importing the same name updates
  that palette in place rather than adding a duplicate. The engine's palette
  lookup and mixing-plan caches are rebuilt when an import replaces one.
- **Undo and redo the recipe.** `Ctrl+Z` / `Ctrl+Shift+Z` walk an 80-step
  history of algorithm, palette, every slider, the effect stack and the text
  settings. A slider drag is one step; loading a new image starts a fresh
  timeline. The Edit menu, Find and the Help reference carry the same verbs.
- **Split compare.** View ▸ Split Compare keeps the source and the proof on
  screen together with a draggable divider. Arrow keys and Home/End move it
  from the keyboard. It is a view only, so exports still contain the proof
  alone, and it is disabled while a clip is playing.
- **A clearer reading line.** The smallest labels and hints are 12px now, and a
  dimmed line is 0.88 rather than 0.72 opacity, so station notes and the quality
  hint hold their contrast on the dark panel. The dock hint is shortened to fit
  at that size.
- The desktop guide covers the importer, the history and the split view.

## 0.3.1 — A clearer reference (2026-11-12)

**Help is a proper window now, and the station arrows turn on their own centres.**

- **One Help window, in the press's own language.** Help ▸ Keyboard Shortcuts,
  What's New and About now open pages in a single searchable Dither Studio
  window. A grouped page list, a search field over every row, Escape, a Tab trap
  and focus restoration replace the native message boxes. The page behind it
  holds still while the window is up.
- **What's New reads the shipped changelog.** Release notes are laid out as
  paragraphs and bullets, and after an update the same page opens once by
  itself. Markdown emphasis and links no longer leave stray asterisks behind.
- **The effect catalogue is alphabetical.** The effect picker, the Effects menu
  and the command palette all read A–Z. The active stack keeps its own order,
  because the stack order is part of the render. Palettes, recipes, character
  ramps and tone maps are sorted too; None stays first for tone maps.
- **The title-bar magnifier opens Find.** It opens the `Ctrl+K` command palette
  rather than the File menu, with its title and accessibility shortcut matching.
- **The GitHub mark is on the press.** The web demo's footer and the Help
  window's footer open the author's GitHub profile, so the build, the site and
  the source are one click apart.
- **The station arrows rotate around their centres.** Each header caret is now
  a 10×10 SVG chevron centred inside its viewBox. Folding a station no longer
  swings the arrow around an off-centre point in the font's glyph box.

## 0.3.0 — Keep the press current (2026-11-12)

**The app can update itself now, and the press has more to try.**

- **Updates come from this repository's GitHub releases.** Help ▸ Check for
  Updates asks GitHub for the latest release, compares it with the version on
  disk, and downloads the asset built for this machine. On Windows the setup
  runs silently after the app closes and starts the new version; on macOS the
  zip replaces the app and reopens it. A failed check is silent on launch, so
  an offline press is still an offline press.
- **What's New is part of the app.** Help ▸ What's New, and a one-time dialog
  after an update, read the matching section of this changelog. The app remembers
  which version it last opened, so the notes appear when a release lands and
  not on every start.
- **The overlapping-save race is fixed.** Two saves that asked for the same
  path could truncate each other, which is what made the Windows Ctrl+S smoke
  check see a zero-byte proof. Every save now lands in a sibling temporary file
  and is renamed into place, so the last finished proof is the whole proof.
- **The tutorial can be hidden completely.** Learn ▸ Hide (or Help ▸ Hide the
  Tour Completely) removes the Learn station and its jump chip and stops the
  intro. The choice is stored with the lesson progress; Help ▸ Show the Learn
  Panel brings it back. Reset still starts from a clean slate.
- **More palettes:** Sweetie 16, Endesga 16 and Nord, bringing the catalogue to
  **27 palettes**. Sources are recorded in `SOURCES.md`.
- **More effects:** Tape tracking (horizontal bands slip and tear) and Channel
  roll (red, green and blue rotate through each other), bringing the stack to
  **15 effects**.
- **More tone filters:** Selenium and Oxide. There are now **13 tone-map
  entries**: eleven ready grades, None and Custom.
- **More recipes:** Sweetie Postcard, Nordic Fog, Tape Deck and Channel Drift,
  four new presets that use the new palettes and effects. The desktop app and
  the web demo now offer **25 recipes**; the frozen launcher keeps its 21.
- **The macOS release also builds a zip** beside the two disk images. The zip is
  what the built-in updater replaces the `.app` with; the disk images remain the
  normal first-install download.
- **Docs and publicity follow the build:** README, GUIDE, the desktop guide,
  source credits, the project site and its catalogue counts now describe the
  updater, the hidden tutorial and the larger catalogue.

Neither executable is signed. Windows SmartScreen may warn on a first run
(More info ▸ Run anyway); macOS Gatekeeper may require right-click ▸ Open, or
allowing the app in System Settings ▸ Privacy & Security.

### Also in the repository

**A folder of examples you can rebuild.** [`examples/`](examples/) holds twelve
proofs of the app's own output — a zine's single ink, the Commodore 64's palette,
a pixel-sorted proof, the whole effects stack, type mode set in characters —
each drawn from the three paintings that ship inside the app and each captioned
with the recipe behind it. They come from the built-in sources rather than from
`inbox/`, so `node tools/make-examples.js` regenerates every one of them from a
clone and lands on the same bytes; the recipes carry no seed, and a rerun here
produced identical files.

[`examples/index.html`](examples/index.html) shows the set as a contact sheet —
one self-contained page, no server and no network, each proof opening at full
size. The generator writes the page, the manifest and the README's table from one
list, checks every recipe against the app's own catalogues before it draws, and
refuses to draw a setting the app does not have;
[`tools/check-examples.js`](tools/check-examples.js) then checks the four against
each other in Node, which is what `test.yml` runs.


## 0.2.5 — 2026-11-04

**The window is navigable now.** Eleven panels used to wrap onto three rows of
tabs and push the proof down the stage; they are one row that scrolls, with a
filter beside it, and a station's header stays pinned while its body moves.
`Ctrl+K` opens a palette over everything the console can do — algorithms,
palettes, recipes, panels, exports — so a setting can be reached by typing its
name instead of hunting for the knob.

**The source row has a picker of its own.** The one button that stepped to the
next built-in painting is now a preview strip with previous and next, which is
what the three paintings always needed.

Also in this version: tooltips on every rail control, and two geometry faults
fixed — a dock column that would not shrink its last track, and `overflow: clip`
letting the panel list scroll the whole stage. The launch film is in the
repository ([`publicity/`](publicity/)) but not in the package: every frame of it
is either the real window, captured through the app's own harness, or the
engine's own output.

## 0.2.4 — 2026-10-13

**The release job attaches the installers again.** The job that fills a tag's
release page reads its notes out of this file, and it ran with no checkout: for
`v0.2.3` both platform builds succeeded — the Windows setup, the portable exe
and both disk images were built — and the step that would have attached them
stopped with `awk: cannot open CHANGELOG.md`. It checks the tree out now, and
this version is the download that carries what `v0.2.3` built.

Nothing in the app changed since `v0.2.3` — the same console, the same engine,
the same three built-in sources. The only file touched is the workflow, which is
not part of the package; the version stamp and the file names are the
difference.

## 0.2.3 — 2026-10-13

**The generated demo scene is gone.** Every build used to cycle three paintings
and then a picture drawn in code — ridges against a dusk sky, three clouds, a
sun and its reflection broken across water. That image is deleted: `drawDemo()`
and its helpers are out of the shells, and the built-in sources are now the three
paintings in `samples.js` and nothing else. Stepping past the last one comes
round to the first. The Source panel's own control, `Ctrl+D` and *File ▸
Built-in Source* all still walk the table. If `samples.js` were ever left out of
a build, the status line says there are no built-in sources rather than drawing
something the app no longer has.

**The tool rail wears a real icon set.** The eight buttons down the left edge are
[Lucide](https://lucide.dev) glyphs instead of hand-drawn paths: a folder for
*Open image…*, an image for the built-in sources, an eye for *Compare*, a shuffle
for a fresh recipe, and webcam, video, record and preset marks after them. They
are inlined rather than fetched, so the window still needs no network, and they
are drawn at a 1.6 stroke so an 18 px render keeps the 1.2 px weight the rest of
the chrome is drawn at. The licence is ISC; its notice ships as
[`desktop/LICENSE-LUCIDE.txt`](desktop/LICENSE-LUCIDE.txt) and is recorded in
[`SOURCES.md`](SOURCES.md).

**Releases carry their installers again.** `v0.2.2` was tagged while
`desktop/package.json` still said `0.2.1`, so both build jobs stopped at the
tag/version guard and the release page went out with no files attached. The
version and the tag agree now, the tag guard is joined by one that refuses to
ship a version this file has no section for, and the notes below are what the
release page shows.

## 0.2.2 — 2026-10-13

**Every build opens on a painting.** The first thing on the stage used to be the
generated scene; now the built-in sources come first and the generated scene is
the last stop of the cycle. Three public-domain paintings travel inside each
build as data URIs — Gustave Moreau's *Oedipus and the Sphinx*, Mårten Eskil
Winge's *Tor's Fight with the Giants* and the Villa Farnesina's *Council of the
Gods* — because a console opened from `file://` may not read pixels back out of a
local file: drawing one into a canvas taints it and `getImageData` throws. One
table serves all three builds, written by `desktop/tools/sync-renderer.js` for
the desktop and carried inside `demo/` for the Pages site.

**The Source panel's control was renamed** from *Demo scene* to *Built-in
source*, in the panel, the tool rail, the menu and the tooltip, so the name says
what it does.

**This release page shipped with no installers, and has since been withdrawn** —
the absent files were the whole page. 0.2.3 is the download to take.

## 0.2.1 — 2026-10-13

**macOS disk images.** The build workflow now packages macOS beside Windows:
`Dither-Studio-<version>-arm64.dmg` for Apple silicon and `-x64.dmg` for Intel,
both unsigned.

**The tutorial can be skipped.** A learner who did not ask for the tour gets a
*Skip* on the card, which exits and folds the Learn station away; **Take the
Tour** brings the station back and starts the first unfinished lesson.

**The installer is built here.** `npm run build` runs the checks and then
packages, and an upgrade clears the previous build out of the install directory.

## 0.2.0 — 2026-10-13

**The guided tutorial.** Ten lessons, one per station, with a coach mark that
points at the control a step names and waits while it is used. **Show me**
performs the step, a step the app already satisfies is ticked off by itself, and
progress is remembered across launches.

**The launcher has a home of its own** in `launcher/`, so the shared engine, its
tests, the sample table and the three no-install app-mode launchers live
together.

## 0.1.4 — 2026-10-10

**Leaner insides.** The desktop shell stopped keeping copies of its own helpers:
`src/renderer/core.js` and `src/renderer/app.js` are the desktop's own core and
shell, and each repeated idea — the alpha-behind class, a slider's fill, the
*is this window still alive?* guard, the open and save routes, both Help dialogs
— has one home instead of several. Nothing about the picture changed.

## 0.1.3 — 2026-10-09

**The app icon is the app's own mark again**, the 512 px proof generated by the
app's own press, so the taskbar, the window and the installer share the mark the
web builds use. **The caption bar's system mark is a search eyeglass**, drawn as
strokes. The web demo got the splash screen in the same pass.

## 0.1.2 — 2026-10-09

**Submenus are usable with the mouse again.** Every menu row closed *all*
submenus the moment the pointer entered it, including the rows inside a submenu,
so a submenu vanished exactly as you moved onto one of its items. Closing is
relative now — a row closes the submenus deeper than the box it lives in, never
its own.

## 0.1.1 — 2026-10-08

**The startup screen is Michelangelo's own hands.** Adam's arm reaches in from
the left, God's from the right, and at the touch of their fingertips Adam is
dithered — his own pre-screened image revealed over the painted one — and starts
to glow while God stays painted. It plays now: every launch before this one froze
the splash on its first frame.

## 0.1.0 — 2026-10-06

**The first release.** Dither Studio as a desktop app: the same engine the web
builds run, in a window of its own — eight menus over the whole catalogue, the
Photoshop-shaped rail and dock, native open and save dialogs, and the startup
screen. Windows, 64-bit, installer and portable.
