# Examples

Twelve proofs, every one of them drawn by Dither Studio itself.

Each picture here came out of the app: the generator opens the real build in a
browser, loads one of the three paintings that ship inside it, applies the recipe
through the same calls the panels make, and saves the pixels the engine drew.
Nothing is a mock-up and nothing was retouched afterwards. Because the sources are
the app's own built-in pictures, a fresh clone can rebuild the whole folder — the
showcases in the [README](../README.md) come from photographs in `inbox/`, which is
not committed, and these do not depend on it.

**Open [index.html](index.html) in a browser** to see them as a contact sheet, each
one beside the recipe behind it and a link to the file at full size. It is one plain
file with no server and no network in it, so it opens straight from a clone.

Find what you came for:

- **What the algorithms do** — `oedipus-newsprint.png` is an ordered screen, the
  diffusion family is in `thor-zine-1bit.png`, and the error-free mixing algorithms
  are `council-yliluoma-ega.png`.
- **A whole look, one pick** — the eight `preset:` rows are the presets the app
  ships with, taken exactly as the Presets panel applies them.
- **Stacked effects** — `thor-vhs-decay.png` runs the entire effects stack at once.
- **Type mode** — `oedipus-text-mode-ascii.png` is the proof set in characters, the
  grid the `.txt` and `.html` exports carry. The ramp is a choice: ASCII here, and
  Blocks, Shades, Hex or Binary in the Text panel.
- **Hardware palettes** — the C64's sixteen inks, the Game Boy's four, and the
  EGA's sixteen, all in a palette the size of a postcard.

## The set

<!-- examples:begin -->
| File | From | Recipe | Drawn as | What it shows |
|---|---|---|---|---|
| `thor-zine-1bit.png` | Tor's Fight with the Giants | preset `zine` | floyd-steinberg · bw · 2 colours · 900×1301 | Floyd–Steinberg diffusion into one bit, the honest photocopied zine |
| `council-riso-duotone.png` | The Council of the Gods | preset `duo` | clustered-dot-8 · bw · 2 colours · 900×365 | two inks and nothing else, the duotone a riso poster is built on |
| `council-c64-poster.png` | The Council of the Gods | preset `c64` | bayer8 · c64 · 14 colours · 900×365 | the Commodore 64's own sixteen colours, a poster forty years late |
| `oedipus-terminal-green.png` | Oedipus and the Sphinx | preset `terminal` | clustered-dot · gameboy · 4 colours · 900×600 | a phosphor re-ink on a four-shade screen, with scanlines over the top |
| `thor-vhs-decay.png` | Tor's Fight with the Giants | preset `vhs` | bayer4 · pico8 · 90730 colours · 900×1301 | the whole effects stack at once - aberration, blocks, scanlines and grain |
| `oedipus-glitch-sort.png` | Oedipus and the Sphinx | preset `sort` | floyd-steinberg · cga · 18 colours · 900×600 | pixel sorting - rows of the proof reordered by tone instead of drawn in place |
| `thor-thermal-cam.png` | Tor's Fight with the Giants | preset `thermal` | bayer16 · gray-16 · 16 colours · 900×1301 | a thermal re-ink: the grade decides what is hot, the dither decides the edges |
| `oedipus-newsprint.png` | Oedipus and the Sphinx | preset `newsprint` | halftone · bw · 2 colours · 900×600 | a halftone screen - an ordered dot at every pixel size, no noise anywhere |
| `council-yliluoma-ega.png` | The Council of the Gods | `yliluoma-polished` · `ega` · pixel size 2 | yliluoma-polished · ega · 16 colours · 900×365 | Yliluoma mixing: a sixteen-colour hardware palette, blended in dots rather than snapped |
| `thor-pixel-art-6x.png` | Tor's Fight with the Giants | `clustered-dot` · `gameboy-pocket` · pixel size 6 | clustered-dot · gameboy-pocket · 4 colours · 900×1301 | pixel size 6 on a four-ink handheld screen - the chunky output people come for |
| `oedipus-gold-leaf.png` | Oedipus and the Sphinx | `blue-noise-32` · `gray-4` · tone `gold` · pixel size 1 · effects: vignette 45 · glow 2/40 | blue-noise-32 · gray-4 · 1906 colours · 900×600 | four greys under a blue-noise screen, re-inked as gold leaf and lit from behind |
| `oedipus-text-mode-ascii.png` | Oedipus and the Sphinx | `atkinson` · `bw` · pixel size 1 · type mode, `ascii` at 12px | atkinson · bw · 108 colours · 900×600 | type mode: the same proof set in characters, the grid the .txt export carries |
<!-- examples:end -->

## Rebuilding them

```sh
node tools/make-examples.js                 # every picture
node tools/make-examples.js vhs text        # only the ones named
node tools/make-examples.js --list          # print the set, draw nothing
node tools/make-examples.js --width 1400    # draw bigger; 0 uses the painting's own size
```

The tool needs Playwright on the global npm root, the same way the browser checks
do — see [DEVELOPMENT.md](../DEVELOPMENT.md). It refuses to draw before it checks
every recipe against the app's own catalogues, so an algorithm, palette, tone map,
ramp or effect that does not exist fails the run and names itself; a picture in this
folder cannot claim a setting the app does not have.

Sources are drawn to 900 px wide, which keeps the whole folder under 4 MB. The
recipes carry no random seed, so the same run draws the same picture twice — every
file here was byte-identical on a rerun.

The generated files — `index.html`, `examples.json`, and the table above between the
`examples:begin` and `examples:end` markers — are written by that same script. Edit a
recipe in the tool and rerun it, and the page, the manifest and this list all follow.
[`tools/check-examples.js`](../tools/check-examples.js) checks the four against each
other, which is how a renamed picture gets caught before it reaches the page.

## Licence

The pictures are Dither Studio's own output from three public-domain paintings; the
app, the folder and the tool that fills it are under the repository's
[BSD 3-Clause licence](../LICENSE). The source paintings, their museums and their
terms are recorded in [SOURCES.md](../SOURCES.md).
