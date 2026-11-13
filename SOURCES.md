# Sources — what Dither Studio was researched from

Dither Studio is original code (there is no copied source in this project), but
its feature set, its algorithm catalogue and its numeric tables were researched
from published work and from open-source dithering tools. This file records
those sources so the provenance of every feature and constant is traceable.

Two rules were kept throughout:

1. **Read the behaviour, write our own code.** Where a project is
   GPL-licensed (dither-guy) nothing was copied; the pipeline shape and feature
   inventory were studied, and every line here was written from the algorithm's
   published description.
2. **Tables and constants come from their published form.** Error-diffusion
   kernels, palette values and the Ostromoukhov table are the numbers their
   authors published, quoted here as data, not as copied code.

## Feature research (what a premium ditherer contains)

| Source | What it informed |
|---|---|
| [Dither Boy — Studio AAA](https://studioaaa.com/product/dither-boy/) (product page) | The feature checklist this project was measured against: many classic algorithms plus palette-first modes, pixel-size chunking, adjustments (tone, colour, blur/sharpen/denoise), a stackable stack of post effects (aberration, blocks, scanlines, grain, pixel sort, CRT, glow), text/ASCII output, presets, and PNG export. |
| [dither-guy](https://github.com/manoelpiovesan/dither-guy) (Python, GPL) | The pipeline order — adjust → downscale by pixel size → dither → post effects → nearest-neighbour upscale — and the preset/recipe shape. Behaviour only; no code taken. |
| [didder](https://github.com/makew0rld/didder) (Go, MIT) | The breadth of the algorithm list: Bayer tile sizes, clustered dot and halftone screens, void-and-cluster, blue noise, IGN, R2, crosshatch, line screens and checks; palettes as named ink sets; a global "strength" knob; alpha handling. |
| [Coolors](https://coolors.co/) and [Lospec Palette List](https://lospec.com/palette-list) (palette tools) | The Color Scheme Maker's shape: lockable swatches, harmony generation, palette naming, tone/hue sorting and a one-click save into the app's own palette store. Behaviour only; the generator, name rules and UI are original. |
| [Lospec Palette List](https://lospec.com/palette-list) and its public palette JSON (`https://lospec.com/palette-list/<slug>.json`) | The Color Scheme Maker's Lospec import: a link or slug is resolved to Lospec's own JSON endpoint at request time, and only the published palette name and RGB list are read. No Lospec palette data is bundled. The importer, validation and safety meter are original. |
| [DitherPunk.jl API](https://juliaimages.org/DitherPunk.jl/v3.1/api/) | The taxonomy used for the algorithm picker: ordered / error-diffusion / stochastic / palette families, and the naming of the published kernels. |
| [ImageMagick ordered-dither threshold maps](https://usage.imagemagick.org/bugs/ordered-dither/) | The shape of the threshold-map catalogue (checks, line maps, clustered-dot maps of several sizes), which our generated `checks`, `line-*`, `clustered-dot-*` and `halftone-*` screens fill in. |

## Algorithm references (the maths)

| Source | What it informed |
|---|---|
| [Joel Yliluoma — "Arbitrary-palette positional dithering"](https://bisqwit.iki.fi/story/howto/dither/jy/) | The mixing-plan family (`yliluoma-2`, `-quick`, `-deep`): a plan is a short multiset of palette entries applied across an ordered screen, searched for by five passes over candidate colours. See the note below on why our plan metric differs from the published one. |
| Robert Ulichney, *Digital Halftoning* / "The void-and-cluster method for dither array generation" (1987–1993) | `voidAndCluster()`: the relax loop plus the two ranking passes that turn a binary pattern into an ordered dither array. Powers the void-and-cluster screen and both blue-noise masks (16×16 and the lazily built 32×32). |
| Floyd & Steinberg (1976) | `floyd-steinberg` (7/3/5/1 over 16). |
| Jarvis, Judice & Ninke (1976) | `jjn` (over 48). |
| Stucki (1981) | `stucki` (over 42). |
| Burkes (1988) | `burkes` (over 32). |
| Sierra (Sierra-3, 1989) | `sierra` (over 32), `sierra-two-row` (over 16), `sierra-lite` (over 4). |
| Atkinson (Apple, 1987) | `atkinson` (over 8, with its characteristic contrast boost). |
| Fan (1975) | `fan` (over 16). |
| Shiau & Fan (1990) | `shiau-fan` (over 18). |
| Stevenson & Arce (1985) | `stevenson-arce` (12 taps over 200). |
| Nakano | `nakano` (over 24). |
| Victor Ostromoukhov (2001), variable-coefficient diffusion | `ostromoukhov`, including the 32-band coefficient table quoted in its published form. |
| Thiadmer Riemersma | `riemersma`: the 16-entry error queue with a 1/16 decay, carried along a serpentine path. |
| Bryce Bayer (1973) | `bayer2/4/8/16` via the recursive rank construction. |
| Jorge Jimenez (2013), "Next Generation Post Processing…" | `ign` — interleaved gradient noise. |
| Martin Roberts (2018), low-discrepancy sequences | `r2` — the R2 sequence as a dither mask. |
| IEC 61966-2-1 / the sRGB standard | The sRGB ↔ linear transfer functions used by the glow and CRT bloom so light adds in linear space. |

### One deliberate divergence, stated plainly

Yliluoma's published plan metric sums the error of *every prefix* of the sorted
plan. Implemented literally, that sum is dominated by the darkest entry the plan
holds, so the search drifts towards a single colour per target and a flat patch
loses its tone — measured here at a mean of 207 for a target of 128. Weighting
the prefixes by 1/k softens it without fixing it, and a cohesion term was
measured and rejected because it costs real tone accuracy (mean error 5.8 → 10.5
over a target sweep). Our search therefore minimises the plan's **mean** error,
which is exactly the tone a plan renders, and then improves the plan slot by
slot. The result reproduces a flat target to within a few units and beats the
nearest single palette colour in 248 of 256 sampled targets; the trade is that
entries in a plan can sit far from the target on a sparse palette, so mixing on
a photo has a granular texture. That is the family's character, not a defect —
pick a dense palette or the two-colour variant for a calmer screen.

## Structure-aware screens (added with the third press)

| Source | What it informed |
|---|---|
| [Pang, Barkan & Mendlovic — "Structure-aware halftoning" (2008)](https://www.researchgate.net/publication/224303793_Structure-aware_halftoning) | The idea behind the whole group: a screen that is generated *from the image* (edge strength and direction) instead of tiled over it, so the texture follows the shading. Our implementation is our own: a two-octave value-noise field bent along the image's contours. |
| Cabral & Leedom — "Imaging vector fields using line integral convolution" (SIGGRAPH 1993) | The stretch-along-contours step: sample the noise field either side of each pixel along the gradient's tangent (a short LIC walk), which is what makes the screen flow with the shading. |
| The classic swirl / ripple / wave displacement (as documented for e.g. [ImageMagick's `-swirl` and `-wave`](https://usage.imagemagick.org/transform/)) | The `ripple` glitch (concentric displacement about a seeded centre) and `wave`'s smooth displacement. |
| Standard procedural star-field practice (seeded scattered stars, optional motion streaks and a radial glow) | The `starfield` glitch. Constructed here; a star field has no canonical published table. |

## Plugin effects (added with the fourth press)

| Source | What it informed |
|---|---|
| [GPU Gems 3, chapter 13 — "Volumetric Light Scattering as a Post-Process"](https://developer.nvidia.com/gpugems/gpugems3/part-ii-light-and-shadows/chapter-13-volumetric-light-scattering-post-process) | The `crepuscular` effect: a radial gather around a light origin, accumulating a bright-source mask with a decay weight, then adding the result in linear light. The implementation is a clean-room JavaScript version of the published equations; no shader code was copied. |
| [Timothy Lottes, `crt-lottes-fast.glsl`](https://github.com/libretro/glsl-shaders/blob/master/crt/shaders/crt-lottes-fast.glsl) (public domain / Unlicense) | The scanline cosine and RGB triad-mask formulas behind `phosphor`. Only the published formula was used; the implementation is new JavaScript and adds the aperture-grille/shadow-mask choice. |
| [Adobe, *PostScript Language Reference*, 3rd edition — halftone dictionaries](https://www.adobe.com/products/postscript/pdfs/PLRM.pdf) | The rotated spot-function screen behind `riso`: frequency, screen angle and a round spot threshold. The second plate, registration offset, trapping and paper stock are original print-shop behaviour rather than code from the reference. |
| [Wolfram MathWorld — hypotrochoid](https://mathworld.wolfram.com/Hypotrochoid.html) and [epitrochoid](https://mathworld.wolfram.com/Epitrochoid.html) | The family of rolling-curve rosettes that informs `guilloche`. The effect draws its own polar distance field (five outer rings plus four counter-rotating inner rings); no guilloche library code is included. |

The longer notes, including the equations and the decisions taken from them, are in
[`docs/effects-research.md`](docs/effects-research.md).

## Video, temporal dithering and recording

| Source | What it informed |
|---|---|
| [Dither Boy — Studio AAA](https://studioaaa.com/product/dither-boy/) (product page) | The last untouched item on the feature checklist this project measures itself against: video and animated output. |
| The temporal-dithering literature for frame-rate-modulated displays (a pattern that is re-generated per frame so the eye averages it) | The three rules made explicit in `temporalSettings`: **freeze**, **shimmer** (a new seed per frame, so stochastic screens boil while tone holds) and **crawl** (the ordered screen slides a pixel per frame — the demoscene / Yliluoma-style walking screen). |
| [MDN — `HTMLCanvasElement.captureStream()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream) and [`MediaRecorder`](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder) | WebM recording of the dithered canvas, with VP9 → VP8 → default codec fallback and a 60 s guard against runaway memory. |
| [fix-webm-duration](https://github.com/yusitnikov/fix-webm-duration) (MIT) | `MediaRecorder` writes no Duration into the WebM Info section, so players cannot seek or report length. This vendored parser inserts (or repairs) the Duration element before the save dialog, for both video and timeline exports. Notice: [`desktop/LICENSE-WEBM-DURATION.txt`](desktop/LICENSE-WEBM-DURATION.txt). |
| [MDN — `HTMLVideoElement`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement) and [`getUserMedia`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) | The frame sources: a user-picked video file, the webcam, or the generated clip the browser checks drive (which needs no codec, so verification stays offline and deterministic). |

## Interface research (how the console is organised)

The house style in [`../DESIGN.md`](../DESIGN.md) governs every visual decision
here: the tokens are copied verbatim, the layout is the 260px rail plus the
stage, the type is mono, and separation is hairlines rather than shadows. What
was researched is the *organisation* — how a paid dithering tool keeps a large
feature set navigable — not the paint.

| Source | What it informed |
|---|---|
| [Dither Boy — Studio AAA](https://studioaaa.com/product/dither-boy/) (product page, read again for the UI work) | The feature inventory the rail has to accommodate without becoming a wall of controls: 63 algorithms, stackable effects, presets that save and share a whole setup, palettes as the first-class object, animation and video, and a "stack and reorder effects" pipeline. |
| [Dither Boy 6.0 coverage — digitalproduction.com](https://digitalproduction.com/2026/03/18/dither-boy-6-0-brings-animation-and-video-polish/) | The three concrete navigation decisions this console copies: **effects become an add system** (a plus control adds an effect to a reorderable stack instead of toggling a catalogue on), **algorithm browsing steps with arrow controls**, and a **playback and update control at the bottom of the viewport with three modes — full, live, still** — which is exactly what `state.quality` implements. The same article's note that palette swatches are individually editable and lockable is why the palette picker here gained a swatch strip. |
| [Dither Boy v3.0 release post](https://studioaaa.com/dither-boy-v3-0/) | That presets are treated as saveable setups and that video/batch live in the same tool as stills — the reason Motion is a station in the same rail rather than a separate mode of the app. |
| Dither Boy's in-app manual (linked from the site as a Google Doc) | Not readable as text, so nothing here is attributed to it; the structure came from the release notes and press coverage above. Recorded so the gap is honest. |

## Palette data

| Source | Palette |
|---|---|
| Game Boy / Game Boy Pocket hardware palettes | `gameboy`, `gameboy-pocket` |
| Commodore 64 (VIC-II) hardware palette | `c64` |
| NES (2C02) hardware palette | `nes` |
| ZX Spectrum (ULA) hardware palette | `zx-spectrum` |
| Texas Instruments TMS9918 (MSX) palette table | `msx` |
| Apple II "artifact" colour set (6 colours) | `apple2` |
| IBM EGA / VGA 16-colour text palette | `ega` |
| CGA mode 4 / mode 5 palettes | `cga` |
| Macintosh II 16-colour palette | `macintosh` |
| Teletext (8-colour) palette | `teletext` |
| Nintendo Virtual Boy (4 reds) | `virtualboy` |
| [PICO-8](https://www.lexaloffle.com/pico-8.php) official palette | `pico8` |
| [gruvbox](https://github.com/morhetz/gruvbox) theme colours | `gruvbox` |
| [Sweetie 16](https://lospec.com/palette-list/sweetie-16) by GrafxKid (CC0) | `sweetie-16` |
| [Endesga 16](https://lospec.com/palette-list/endesga-16) by ENDESGA | `endesga-16` |
| [Nord](https://www.nordtheme.com/) theme colours, via [Lospec](https://lospec.com/palette-list/nord-theme) | `nord` |
| [Cyberpunk Palettes — Studio AAA](https://studioaaa.com/dreamy-cyberpunk-presets-download/) (downloaded Dither Boy pack; RGB values quoted from its JSON) | `cyberpunk-breach` (Breach, 6 inks), `cyberpunk-acid` (Acid, 12), `cyberpunk-holo` (Holo, 12) |
| Constructed inks and levels | `gray-4/8/16` (2/3/4-bit ramps), `amber`, `sepia`, `cyan-ink`, `blueprint`, `ice`, `selenium`, `oxide`, and the tone maps in `TONE_MAPS` |
| The digital rain of *The Matrix* (a two-ink green phosphor look, as reproduced across countless shader ports) | `matrix` — constructed here from the look, not copied from any implementation |

## Preset adaptations

| Source | What it informed |
|---|---|
| [Dreamy Cyberpunk presets — Studio AAA](https://studioaaa.com/dreamy-cyberpunk-presets-download/) (two `.dither-boy.preset` files, Dither Boy 6.0.4) | The two `Dreamy Cyberpunk` recipes in the `dreamy-cyberpunk` preset pack. The downloaded files were read for their palette, modulation axis, luminance threshold, subtle tint and glow; the recipes were re-authored as Dither Studio settings (smooth-diffusion screen, temporal/aberration/wave/grain stack, glow). No Dither Boy code or preset JSON is shipped. |
| [Niko Virolainen](https://studioaaa.com/dither-boy-in-niko-virolainens-glitch-universe/), [Caroline Dietl](https://studioaaa.com/caroline-dietls-undead-dithering/), [2_s0ur](https://studioaaa.com/dither-boy-spotlight-2_s0urs-glitch-art/) (published Dither Boy artist pages) | The three original preset packs in `desktop/src/plugins/`; they are inspired by the artists' looks, not copies of their files. |

## What is not from anywhere

The press console itself — `index.html`, `style.css`, `app.js`, the sample
table, the text mode, the preset recipes, the glitch stack's
implementation, the tone-map system, the alpha pipeline, the plugin package
format (tools, preset packs and palette packs), the palette-pack export and the
Ink Extractor pipeline, the tests and this file — is original work for this
repository, written against the visual language in [`DESIGN.md`](../DESIGN.md). The tool rail's glyphs and the
paintings in `samples.js` are other people's work, and are credited below.

## The built-in samples

Three paintings travel inside every build as the sources the **Source** panel's
own control steps through, in [`launcher/samples.js`](launcher/samples.js) (the
desktop's copy is written by `desktop/tools/sync-renderer.js`, `demo/`
carries its own because the Pages site may not reach outside its folder).
All three works are public domain.

| Sample | Work and collection | Rights |
|---|---|---|
| `Oedipus and the Sphinx` | Gustave Moreau, *Oedipus and the Sphinx*, 1864, detail — The Metropolitan Museum of Art, New York (21.134.1) | Public domain; the Met released the image under CC0. [Commons](https://commons.wikimedia.org/wiki/File:Oedipus_and_the_Sphinx_MET_DP-14201-023.jpg) |
| `Tor's Fight with the Giants` | Mårten Eskil Winge, *Tors strid med jättarna*, 1872 — Nationalmuseum, Stockholm (NM 1250) | Public domain (Winge died in 1896); the museum releases its out-of-copyright images freely. [Commons](https://commons.wikimedia.org/wiki/File:M%C3%A5rten_Eskil_Winge_-_Tor%27s_Fight_with_the_Giants_-_Google_Art_Project.jpg) |
| `The Council of the Gods` | *Concilio degli dei*, Raphael and his workshop, 1517–18 — Loggia of Cupid and Psyche, Villa Farnesina, Rome | Public domain. **The one to watch**: Italy's cultural-heritage code can constrain reproduction of the asset itself even when the artwork is out of copyright, so this is the sample to replace first if that ever matters. [Commons](https://commons.wikimedia.org/wiki/File:Raffaello,_concilio_degli_dei_02.jpg) |

The attribution used for the fresco is the standard one — Raphael's design,
executed with his workshop — not Raphael alone, and not Giulio Romano alone.
The app's startup splash, which uses *The Creation of Adam*, has carried the
same Italian caveat since it was written.

How each sample was made: cropped to the picture itself (the fresco's painted
border went), left at its native resolution, encoded once at WebP quality 80
(65 KB, 128 KB and 70 KB), and inlined as a data URI. The inlining is not a
packaging preference — a console opened from `file://` may not read pixels back
out of a local file, because drawing one into a canvas taints it and
`getImageData` throws. [DEVELOPMENT.md](DEVELOPMENT.md) says how to replace
one.

## The desktop's icon set

The desktop's tool rail, studio menu, options-bar zoom buttons, stepper buttons,
drawn menu checks, Help index, find fields, Help GitHub mark and plugin/package
marks use the supplied 24×24 outline set in
[`desktop/src/assets/icons/`](desktop/src/assets/icons) and
[`desktop/src/assets/menu/`](desktop/src/assets/menu). The SVGs are applied as
CSS masks, so the interface supplies each mark's ink and the assets carry no
baked colour. The rail still renders at 18 px and the menu plates at 26 px; a
2 px stroke in the 24 px viewBox keeps the same weight as the rest of the
chrome. Keeping them as files rather than inlining them means a new package can
ship its own mark without editing the window markup. Outside the release check
described in the user guides, the only network use is the Lospec palette the
user explicitly asks the Color Scheme Maker to import.

The last pass added the supplied `arrow-left`, `arrows-horizontal`, `reload`,
`square-check`, `square-uncheck`, `x` and `book` masks: back and close now use
the same arrow and cross everywhere, the split grip uses the horizontal arrows,
New seed uses reload, the tour's tick boxes use the square pair rather than a
glyph, and the guide page uses the book.


The set follows [Tabler Icons](https://tabler.io/icons), which is MIT-licensed.
Its notice ships as [`desktop/LICENSE-TABLER.txt`](desktop/LICENSE-TABLER.txt)
and is reproduced there verbatim.

## Keeping this current

When a feature, algorithm, palette or numeric table is added from a source,
add a row here naming the source and what it informed, in the same session.

## The second film (`publicity/mograph.html`)

The mograph opens on the gods and dithers them. Every painting below is public
domain, downloaded as the original file rather than a thumbnail, then normalised
to 2400 px on the long edge for the page (`publicity/assets/gods/`). The raw
drop they came in stays out of the repository.

| Asset | Work and collection | Rights |
|---|---|---|
| `gods/adam.jpg` | Michelangelo, *The Creation of Adam*, 1512, Sistine Chapel, Vatican City | Public domain |
| `gods/oedipus.jpg` | Gustave Moreau, *Oedipus and the Sphinx*, 1864, The Metropolitan Museum of Art (21.134.1), cropped to the picture | Public domain, Met CC0 |
| `gods/thor.jpg` | Mårten Eskil Winge, *Tors strid med jättarna*, 1872, Nationalmuseum, Stockholm (NM 1250) | Public domain |
| `gods/council.jpg` | Giovanni Lanfranco, *The Council of the Gods*, Galleria Borghese, Rome | Public domain |
| `gods/godhand.png`, `gods/adamhand.png` | the two hands cut from the same fresco | Public domain; kept for other cuts, not used by this one |

The film is drawn by `publicity/mograph.html` as a pure function of time and
dithered by `launcher/dither.js` at the frame's chunk grid, so the screen in the
middle of it is the engine's own. `publicity/render-mograph.js` captures it.
