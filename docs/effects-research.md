# Effects research — rays, Epsilon glow, riso, phosphor, guilloche and Shape Press

Research notes for the declarative effect plugins (introduced in 0.6.1 and
rebuilt/expanded in 0.7.1 with inspiration from Studio AAA's Dither Boy).
The implementation is original JavaScript. The sources below supplied equations,
screen geometry and visual vocabulary, not copied code.

## Crepuscular rays

**Source:** [GPU Gems 3, chapter 13, “Volumetric Light Scattering as a
Post-Process”](https://developer.nvidia.com/gpugems/gpugems3/part-ii-light-and-shadows/chapter-13-volumetric-light-scattering-post-process)
(Mitchell, 2007).

The chapter describes a screen-space radial gather. For a light at `L`, a pixel
`u`, `N` samples and a step `Δ`:

```
Δ = (u - L) * length / N
A(u) = Σ O(u - iΔ) * weight * decay^i
S(u) + exposure * tint * A(u)
```

`O` is an emission/occlusion mask, `decay` shortens the tail, and the final
light is added in linear space. Because each pixel `u` marches **back toward the
origin `L`**, bright pixels cast volumetric shafts **outward away from `L`**
while empty dark pockets stay deep black.

**What this implementation does (rebuilt in 0.7.1)**

- **Dither-aware emitter map:** builds a half-resolution emitter field by
  blending each block's mean and peak luminance (`0.64 * mean + 0.36 * peak`)
  with a soft dark knee. Thin 1-bit lightning lines and sparse stipple dots
  continue to emit directional shafts instead of disappearing below a high
  box-average threshold.
- **True outward radial march with IGN jitter:** marches 38 exponentially
  decayed steps from each pixel back toward the normalised origin (`Origin X/Y`,
  0–100%, or clicked/dragged directly on the proof via the crosshair Pick
  button), jittered deterministically with Interleaved Gradient Noise so rays
  never band or step.
- **Four lighting modes:**
  - **Euphoria** (default) — icy-white figure core, orchid-violet inner halo,
    rose-magenta outward shafts, cool indigo edge shimmer, subtle chromatic
    fringe and a vertical anamorphic flare beam with a 4-point star glint.
  - **Prismatic** — staggered radial sampling per RGB channel for iridescent
    chromatic light shafts.
  - **Source light** — preserves the proof's own RGB colours along the shafts.
  - **Solar** — warm golden-amber volumetric god rays.
- **Filmic highlight shoulder** in linear light preserves colour saturation in
  the mid-shafts while letting bright cores burn cleanly.

## Epsilon glow

**Source:** Inspired by Studio AAA's **Dither Boy** Epsilon Glow workflow
(multi-stage retro bloom tailored for dithered art).

Standard single-pass blur glow smears the entire proof evenly and turns 1-bit
patterns muddy. `epsilonglow` extracts a thresholded, dither-aware emitter map
(blending block mean and peak), blurs it at two octaves (half-resolution tight
halo plus quarter-resolution wide atmospheric glow), and adds the result in
linear light so underlying dither dots stay crisp while bright features radiate
atmospheric light.

**Modes:** `Euphoric aura` (lavender/rose chromatic bloom), `Classic bloom`
(colour-true multi-octave glow), `Film halation` (warm scarlet-amber 35mm edge
halation) and `CRT phosphor` (high-chroma bloom with horizontal RGB fringe).

## Shape Press

**Source:** Inspired by Studio AAA's Dither Boy **Shape Shifter**.

Each cell averages its source tone and draws a luminance-driven shape mask in
six modes: `Barcode`, `Cross stitch` (luminance-scaled stitch weight),
`Halftone`, `Bitmap`, `Diamond` and `Rings`.

## Riso misprint

**Sources:** [Adobe, *PostScript Language Reference*, 3rd
edition](https://www.adobe.com/products/postscript/pdfs/PLRM.pdf), halftone
dictionaries (frequency, screen angle and spot function); standard offset/riso
registration practice (independent plate translation and subtractive overprint).

Rotated halftone plates are sampled through a small rigid offset and multiplied
over warm cream stock so overlapping inks darken naturally instead of washing
out dark artwork.

**Modes:** `Duotone` (Federal Blue + Fluo Pink), `Black ink`, `Teal & amber`
and `Crimson & ink`.

## Phosphor mask

**Source:** [Timothy Lottes, `crt-lottes-fast.glsl`](https://github.com/libretro/glsl-shaders/blob/master/crt/shaders/crt-lottes-fast.glsl)
(public domain / Unlicense).

Combines a cosine scanline beam, luminance-compensated RGB phosphor subpixels,
and bright-pixel horizontal phosphor halation so the mask stays bright and
electric rather than dark.

**Modes:** `Aperture grille`, `Shadow mask` and arcade `Slot mask`.

## Guilloche plate

**Sources:** [Wolfram MathWorld, hypotrochoid](https://mathworld.wolfram.com/Hypotrochoid.html)
and [epitrochoid](https://mathworld.wolfram.com/Epitrochoid.html); security
banknote engraving geometry.

Draws anti-aliased polar or ribbon distance fields in light ink on dark grounds
and dark ink on light grounds around the movable origin.

**Modes:** `Rosette` (5 outer + 4 counter-rotating inner hypotrochoid rings),
`Banknote waves` (interlocking sinusoidal ribbons) and `Orbital` (harmonic
spirograph rings).

## Integration decisions

- All six plugin effects run post-dither at chunk resolution, so algorithms,
  palettes, animation, video and exports route through them without a second
  pipeline.
- Each is gated by a declarative plugin capability (`desktop/src/plugins/`). No
  downloaded JavaScript is executed; the package only switches on built-in code.
- Movable origins are stored as normalised percentages (`0–100`) and can be
  adjusted with sliders, double-clicked to reset, or picked directly on the
  proof canvas with the crosshair Pick button.
- Every effect is deterministic from the recipe seed and takes part in undo/redo.

## Performance notes

Measured on a 1024×1024 frame at pixel size 1: the entire 22-effect stack runs
in ~2.2 s (well under the 6 s budget in `launcher/test.js`), and individual
effects stay interactive in Live preview mode.
