# Effects research — rays, riso, phosphor and guilloche

Research notes for the four effect plugins added in 0.6.1.
The implementation is original JavaScript. The sources below supplied equations,
screen geometry and visual vocabulary, not copied code.

## Crepuscular rays

**Source:** [GPU Gems 3, chapter 13, “Volumetric Light Scattering as a
Post-Process”](https://developer.nvidia.com/gpugems/gpugems3/part-ii-light-and-shadows/chapter-13-volumetric-light-scattering-post-process)
(Mitchell, 2007).

The chapter describes a screen-space radial gather. For a light at `L`, a pixel
`u`, `N` samples and a density `density`:

```
Δ = (u - L) * density / N
A(u) = Σ O(u - iΔ) * weight * decay^i
S(u) + exposure * tint * A(u)
```

`O` is an occlusion/source mask, `decay` shortens the tail, and the final light
is added to the scene. The origin may sit outside the frame. A blurred mask and
seeded jitter (or a post-blur) keep the sampling from banding.

**What this implementation does**

- Builds a low-resolution, blurred luminance mask from the proof. Only the
  brightest half of the range can emit, so black paper stays black.
- Marches outward from a normalized origin (`Origin X/Y`, 0–100% of the frame)
  through that mask, using a decay weight and a seeded angular field. The
  angular field is what turns a plain radial halo into separated shafts.
- Adds a compact white-violet core and the tinted shaft field in linear light,
  matching the reference image's white centre and purple-blue wedges.
- Runs the gather at one third of the output resolution and bilinearly
  upsamples the soft light field. The visual result is unchanged at proof
  scale, and a megapixel frame stays interactive.

## Riso misprint

**Sources:** [Adobe, *PostScript Language Reference*, 3rd
edition](https://www.adobe.com/products/postscript/pdfs/PLRM.pdf), halftone
dictionaries (frequency, screen angle and spot function); standard offset/riso
registration practice (independent plate translation and trapping).

The halftone screen is a rotated grid with a round spot threshold. A second
plate is screened at a different angle, sampled through a small rigid offset,
and overprinted on a warm paper stock. The registration slip, trapping and
paper choice are deliberate print-shop behaviour, not code from the reference.

**Modes:** `Duotone` (cool blue and warm red plates) and `Black ink`.

## Phosphor mask

**Source:** [Timothy Lottes, `crt-lottes-fast.glsl`](https://github.com/libretro/glsl-shaders/blob/master/crt/shaders/crt-lottes-fast.glsl)
(public domain / Unlicense).

The shader's useful published formulas are the cosine scanline beam and the
RGB triad mask. This implementation uses those formulas with a new pass:

- a cosine scanline gain;
- a one-pixel RGB triad, either fixed vertical stripes (aperture grille) or
  shifted on alternate rows (shadow mask);
- a small horizontal chroma bleed so the mask reads as a CRT rather than a
  colour filter.

**Modes:** `Aperture grille` and `Shadow mask`.

## Guilloche plate

**Sources:** [Wolfram MathWorld, hypotrochoid](https://mathworld.wolfram.com/Hypotrochoid.html)
and [epitrochoid](https://mathworld.wolfram.com/Epitrochoid.html); the general
banknote/security-print vocabulary of overlapping rosette lines.

A guilloche is a family of rolling-curve rosettes. The implementation draws a
polar distance field rather than sampling a texture. For a ring with base
radius `r0`, amplitude `A`, lobe count `N`, phase `φ` and line half-width `w`:

```
distance = abs(ρ - (r0 + A * sin(N * θ + φ)))
coverage = 1 - smoothstep(w, 2w, distance)
```

Five outer rings and four counter-rotating inner rings are combined with `max`,
then mixed toward a light ink on dark paper or a dark ink on light paper. The
result is anti-aliased at any output size and follows the movable origin.

**Controls:** amount and `Origin X/Y` (the rosette centre).

## Integration decisions

- All four are post-dither effects at chunk resolution, so algorithms, palettes,
  animation, video and exports route through them without a second pipeline.
- Each is gated by a declarative plugin capability. No downloaded JavaScript is
  executed; the package only switches on code already in the app.
- The origin is stored as a percentage pair in presets and JSON exports, not as
  pixels, so it survives export scales and different working resolutions.
- The ray effect is deterministic from the recipe seed. Changing the origin is a
  recipe change and takes part in undo/redo.

## Performance notes

Measured on the development machine at 1024×1024 with pixel size 1:

| Effect | Time |
|---|---:|
| Crepuscular rays | ~0.5 s |
| Riso misprint | ~0.15 s |
| Phosphor mask | ~0.06 s |
| Guilloche plate | ~0.15–0.45 s |

Crepuscular rays uses a one-third-resolution field; guilloche skips pixels
outside the rosette's bounding circle. The whole 21-effect stack remains under
the existing megapixel budget.
