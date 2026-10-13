# Changelog

What changed, newest first. The number that matters is the desktop app's:
`desktop/package.json` carries it, and a `v<version>` tag has to match it or the
build stops before it packages anything.

The release notes on GitHub are read from the section for the tag — the
`release` job in [`.github/workflows/build.yml`](.github/workflows/build.yml)
extracts it with `awk` — so the release page and this file cannot drift apart.
A tag with no section here fails the build instead of publishing an empty
release page; that is deliberate.

## Unreleased

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
