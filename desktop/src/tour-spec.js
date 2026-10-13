/* tour-spec.js - the lessons the Tutorial teaches, as data.
 *
 * One file, no DOM, so `node tools/tour.test.js` can hold the tour to its own
 * rules: an id and a title per lesson, a target and a body per step, every
 * predicate false on a fresh app, and no step that points at nothing.
 *
 * A lesson is:
 *   id       kebab-case, the name progress is stored under
 *   title    what the lesson teaches, in four words or fewer
 *   summary  one line for the list in the Learn panel
 *   theme    the group the lesson appears under
 *   minutes  an honest estimate for someone reading every card
 *   steps    see below
 *
 * A step is:
 *   title    one line, imperative
 *   body     what to do and what it does
 *   why      the reason it is worth doing (optional, shown in its own line)
 *   target   a selector for the control the coach mark points at
 *   open     a panel id to open before the step (optional)
 *   show     [[command, arg], ...] that the Show me button runs (optional;
 *            never a command that opens a native dialog)
 *   when     (state) => true once the learner has done it (optional). `state`
 *            is what DS.state() returns: algorithm, palette, toneMap, alphaMode,
 *            preset, quality, seed, textMode, textRamp, serpentine, compare,
 *            effects, openGroups, savedPath, status, width, height, name, path.
 *
 * The wording is the app's voice: instrument panel, print shop, second person,
 * no exclamation marks. A step that only explains has no `when`; a step the app
 * can check gets one, so the card can tick itself off the moment the proof
 * changes rather than asking the learner to confirm it happened.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DitherTourSpec = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  return {
    lessons: [

      /* ---------------------------------------------------------------- */
      {
        id: 'first-proof',
        title: 'Your first proof',
        summary: 'Bring a picture in, choose a press and an ink set, and export it.',
        theme: 'Get started',
        minutes: 2,
        steps: [
          {
            title: 'There is already something on the table',
            body: 'The app opens on a generated demo scene, so the press has something to print and nothing has to be loaded first. Your own picture goes in the same way: Open image… in the Source panel, a file dropped straight onto the proof, or Ctrl+V to paste one.',
            why: 'Everything below is made from this one source, so changing it changes every proof.',
            target: '#canvas-wrap',
            open: 'source',
          },
          {
            title: 'Choose a press',
            body: 'This picker holds all forty-six algorithms, in families: ordered screens, stochastic noise, the three structure-aware screens, Yliluoma colour mixing and fourteen error-diffusion kernels. Press it and pick another — or step through the list with the arrows beside it.',
            why: 'The press decides the pattern; the ink decides the colour. Those are two separate decisions here.',
            target: '#algorithm',
            open: 'press',
            show: [['press-algorithm', 'bayer8']],
            when: function (s) { return s.algorithm === 'bayer8'; },
          },
          {
            title: 'Choose the ink',
            body: 'Twenty-four palettes: hardware sets like Game Boy and C64, greys and ramps, and six single-ink sets. The swatches underneath are the actual inks the proof is made of, and the count beside the name is how many there are.',
            target: '#palette',
            show: [['press-palette', 'gameboy']],
            when: function (s) { return s.palette === 'gameboy'; },
          },
          {
            title: 'Pull a proof',
            body: 'Export PNG writes the proof at the scale in the box beside it — 1×, 2×, 4× or 8×. Scaling is nearest-neighbour, so the printed pixel grid stays crisp instead of being blurred up.',
            why: '8× of a 1600 px working image is 12800 px. Big, but it is your disk.',
            target: '#export',
            when: function (s) { return !!s.savedPath || /Exported/.test(s.status || ''); },
          },
          {
            title: 'The receipt in the caption bar',
            body: 'After a save the caption names the file. Click that name and the folder opens with the file selected — the shortest path from a proof to anywhere you need it.',
            target: '#tb-note',
          },
        ],
      },

      /* ---------------------------------------------------------------- */
      {
        id: 'the-press',
        title: 'The press',
        summary: 'Every control in the Press panel, and what it does to the pattern.',
        theme: 'The press',
        minutes: 3,
        steps: [
          {
            title: 'The Press panel',
            body: 'The panel is the whole press: the algorithm, the ink, how big each printed dot is, how hard the screen bites, the seed, and the three sliders that only exist for the structure-aware screens.',
            target: '#g-press',
            open: 'press',
          },
          {
            title: 'Step through the catalogue',
            body: 'The arrows beside a picker walk that catalogue one entry at a time — Ctrl+↑ and Ctrl+↓ do the algorithm, Ctrl+← and Ctrl+→ the palette, from anywhere in the window. There are also Previous/Next entries in the Press menu.',
            why: 'Comparing two screens by stepping between them beats scrolling a list of forty-six.',
            target: '#algorithm-next',
          },
          {
            title: 'Pixel size',
            body: 'How many screen pixels each printed dot covers. At 1 the proof is as fine as the source; at 16 it is a mosaic of chunky dots. The swatch strip and the proof both update as you drag.',
            target: '#pixel-size',
          },
          {
            title: 'Strength',
            body: 'How far the screen pushes away from mid-grey. At 0 the press barely modulates the image; at 200 the pattern takes over and the picture becomes texture.',
            target: '#strength',
          },
          {
            title: 'Threshold, while the ink is black and white',
            body: 'Where the press cuts between paper and ink. The row belongs to the b/w palette and comes and goes with it: the other twenty-three inks decide tone by snapping to the nearest colour, so a cut-off would mean nothing to them. A control you cannot use is a control you should not see.',
            why: 'The Threshold entry in the picker is the bluntest press here: one cut and no pattern at all.',
            target: '#threshold-row',
            show: [['press-algorithm', 'threshold'], ['press-palette', 'bw']],
            when: function (s) { return s.algorithm === 'threshold' && s.palette === 'bw'; },
          },
          {
            title: 'Smoothness, Flow and Streak',
            body: 'These three appear only for the structure-aware screens, which build their pattern from the picture\'s own contours instead of tiling over it. Smoothness is the size of the features, Flow stretches the screen along the shading, Streak runs it vertically as rain.',
            why: 'A few hundred milliseconds per render at 960×640, so Live or Still update mode is the comfortable way to tune these.',
            target: '#smooth-row',
            show: [['press-algorithm', 'rain']],
            when: function (s) { return s.algorithm === 'rain'; },
          },
          {
            title: 'Serpentine sweep',
            body: 'Error diffusion normally walks left to right, row after row, which leaves a faint directional seam. Serpentine alternates the direction of each row and the seam goes away.',
            target: '#serpentine',
          },
          {
            title: 'The seed',
            body: 'Every random stage — the noise masks, void-and-cluster, the stochastic screens — is driven by this one number, and nothing else is random. Change it and you change the arrangement of dots, not the picture.',
            why: 'The same seed with the same settings prints the same proof, forever, on any machine. That is what makes a proof reproducible; the ⟳ button rolls a new one.',
            target: '#seed',
          },
        ],
      },

      /* ---------------------------------------------------------------- */
      {
        id: 'grade-it',
        title: 'Grade the picture',
        summary: 'Tone runs before the dither, Detail after it. Both are covered here.',
        theme: 'Grade and ink',
        minutes: 3,
        steps: [
          {
            title: 'Seven dials before the dither',
            body: 'Everything in the Tone panel runs on the picture before it reaches the screen: black point, white point, gamma, brightness, contrast, saturation and hue. Because the dither happens last, these change what the screen has to work with.',
            why: 'A dither cannot invent tone it was never given. Fix the source here and the screen has an easier job.',
            target: '#g-tone',
            open: 'tone',
          },
          {
            title: 'Black point and white point',
            body: 'Black point lifts the darkest values, white point pulls the brightest down. Between them they set the range the screen has to divide into steps.',
            why: 'If a scan has no true black, a 1-bit proof looks washed out however hard the press bites. Clip it here first.',
            target: '#black',
          },
          {
            title: 'Gamma',
            body: 'Gamma moves the midtones without touching either end — the most useful dial on a flat or backlit photograph, and the one to reach for before contrast.',
            target: '#gamma',
          },
          {
            title: 'Brightness, contrast, saturation and hue',
            body: 'The blunt four. Contrast spreads the values apart, brightness moves them up and down, saturation and hue decide how much colour the ink has to work with — and with a two-ink palette, hue changes which two inks land where.',
            target: '#contrast',
          },
          {
            title: 'Detail runs after the dither',
            body: 'The Detail panel is applied to the dither that comes out, which is why it can change the pattern itself rather than the picture. Blur softens small features before they are screened; sharpen puts the bite back.',
            target: '#g-detail',
            open: 'detail',
          },
          {
            title: 'Denoise',
            body: 'A 3×3 median filter. Single-pixel noise is the one thing a dither loves to exaggerate — one stray pixel becomes a dot on its own — so a photograph from a phone usually wants this before anything else.',
            target: '#denoise',
          },
        ],
      },

      /* ---------------------------------------------------------------- */
      {
        id: 'ink-and-paper',
        title: 'Ink and paper',
        summary: 'Tone maps, your own two colours, and what happens to transparency.',
        theme: 'Grade and ink',
        minutes: 2,
        steps: [
          {
            title: 'Re-ink the finished dither',
            body: 'A tone map replaces the colours of the finished proof, so the pattern is untouched and only the two inks change. Sepia, cyanotype, blueprint, amber, thermal — eleven in the list, plus your own.',
            why: 'This is the cheapest way to change the whole mood: it costs one pass and no re-dithering.',
            target: '#g-ink',
            open: 'ink',
          },
          {
            title: 'The tone map list',
            body: 'Pick one from this list. With a 1-bit palette the proof stays exactly two inks, which is what most of these are built for.',
            target: '#tone-map',
          },
          {
            title: 'Your own ink and paper',
            body: 'The Custom entry adds two colour wells: the ink and the paper. Everything between them is mixed by the screen, so two colours is enough for a full tonal range.',
            target: '#ink-custom',
            show: [['image-tonemap', 'custom']],
            when: function (s) { return s.toneMap === 'custom'; },
          },
          {
            title: 'What happens to transparency',
            body: 'Flatten onto paper puts a transparent source on white. Dither the matte prints the alpha as pattern, so a soft edge becomes dots. Keep as PNG alpha leaves the transparency in the exported file.',
            why: 'A kept matte is a proof you can lay over any paper later — the checkerboard behind the canvas is only there to show it is still transparent.',
            target: '#alpha-mode',
          },
        ],
      },

      /* ---------------------------------------------------------------- */
      {
        id: 'stack-effects',
        title: 'Stack effects',
        summary: 'Thirteen effects that run after the dither, plus the glow over them.',
        theme: 'Effects',
        minutes: 3,
        steps: [
          {
            title: 'After the dither, top to bottom',
            body: 'The Effects panel is a stack: each effect in it runs on the finished proof, in order, before anything is exported. Aberration, scanlines, grain, pixelsort, wave, drip, kaleidoscope, dead pixels, vignette, CRT, ripple, starfield and blocks.',
            target: '#g-effects',
            open: 'effects',
          },
          {
            title: 'Add one',
            body: 'Choose an effect here and it lands at the top of the stack with its own amount. The picker always shows all thirteen, whatever is already stacked.',
            target: '#effect-add',
            show: [['effects-add', 'scanlines']],
            when: function (s) { return !!(s.effects && s.effects.length > 0); },
          },
          {
            title: 'The stack itself',
            body: 'Every row carries its own amount, a switch, arrows to reorder it, and — for the effects that have them — a mode. Order matters: grain under scanlines is not the same print as grain over them.',
            target: '#effect-list',
          },
          {
            title: 'Glow, the last thing printed',
            body: 'Glow spreads the lit dots of the proof outwards: Radius in pixels, Intensity as a percentage. It is not a blur — it adds ink around the bright side, the way a light leaks on film.',
            target: '#g-glow',
            open: 'glow',
          },
          {
            title: 'Starting over',
            body: 'Effects ▸ Clear the stack empties it in one move, and Edit ▸ Reset every control puts the whole press back to its defaults without touching your source image.',
            target: '#menubar',
          },
        ],
      },

      /* ---------------------------------------------------------------- */
      {
        id: 'set-in-type',
        title: 'Print with characters',
        summary: 'Text mode: the proof as a grid of characters, and the .txt export.',
        theme: 'Effects',
        minutes: 2,
        steps: [
          {
            title: 'The same proof, in characters',
            body: 'Text mode prints the dither as a grid of characters instead of pixels. It is the same engine and the same recipe — only the last step changes, from a dot to a letter.',
            why: 'It is the oldest form of dithering there is: a fixed set of marks, chosen by tone.',
            target: '#g-type',
            open: 'type',
          },
          {
            title: 'Turn it on',
            body: 'Tick Print with characters — Ctrl+T does the same from anywhere — and the proof becomes a character grid. Two more controls appear with it: the ramp and the cell size.',
            target: '#text-mode',
            when: function (s) { return s.textMode === true; },
          },
          {
            title: 'The ramp',
            body: 'Which characters are used, darkest first: ASCII, blocks, shades, hex or binary. The ramp is the ink set of text mode — a binary ramp gives you a two-character proof.',
            target: '#text-charset-row',
          },
          {
            title: 'Cell size',
            body: 'How big each character is drawn, 6 to 24 px. Small cells read as texture from a distance; large cells read as type you can actually copy.',
            target: '#text-size-row',
          },
          {
            title: 'Export the grid',
            body: 'Export .txt writes what is on screen as plain text you can paste into anything. The character count comes back in the status bar.',
            why: 'FillText has a budget — above thirty thousand characters a frame the app turns text mode off rather than dropping frames.',
            target: '#export-txt',
            when: function (s) { return /characters/.test(s.status || ''); },
          },
        ],
      },

      /* ---------------------------------------------------------------- */
      {
        id: 'the-looks',
        title: 'The three looks',
        summary: 'The structure-aware screens, and the recipes built on them.',
        theme: 'The press',
        minutes: 2,
        steps: [
          {
            title: 'Screens that read the picture',
            body: 'Most dithers tile a fixed pattern over the image. These three — Rain Streaks, Dot Field and Smooth Diffusion — read the image first: a noise field is stretched along its contours, then biased towards its edges, so the screen follows the shading instead of fighting it.',
            target: '#algorithm',
            show: [['press-algorithm', 'rain']],
            when: function (s) { return s.algorithm === 'rain'; },
          },
          {
            title: 'Smoothness',
            body: 'The feature size of the screen. Low values give drifting, poster-scale waves; high values a fine, fabric-like weave.',
            target: '#smooth-row',
          },
          {
            title: 'Flow',
            body: 'How far the screen stretches along the contours. Push it up and the pattern starts to run with the shading — the liquid look; take it down and the screen goes grainy again.',
            target: '#flow-row',
          },
          {
            title: 'Streak',
            body: 'How far the screen runs vertically. High streak, matrix-green ink and a dark picture is the rain; at 0 the screen is isotropic again.',
            target: '#streak-row',
          },
          {
            title: 'Or take the whole look',
            body: 'The Presets panel holds twenty-one recipes. Matrix Rain, Ice Dot Field and Riso Duotone set the screen, the ink, the pixel size and the grade in one move — a starting point you then push around.',
            target: '#preset',
            show: [['window-panel-open', 'preset'], ['press-preset', 'matrixrain']],
            when: function (s) { return s.preset === 'matrixrain'; },
          },
        ],
      },

      /* ---------------------------------------------------------------- */
      {
        id: 'motion',
        title: 'Frames in motion',
        summary: 'The press on live frames: a clip, the webcam, and WebM recording.',
        theme: 'Motion',
        minutes: 3,
        steps: [
          {
            title: 'Live frames through the whole press',
            body: 'Video mode feeds frames through everything you have set: any algorithm, any ink, any tone map, the entire effects stack. One frame at a time, dropped rather than queued when one overruns its slot.',
            target: '#g-motion',
            open: 'motion',
          },
          {
            title: 'A clip, or the camera',
            body: 'Open clip… takes a video file; Webcam uses the camera. Both are decoded in the window and dithered here — nothing is uploaded anywhere, which is the whole point of the app.',
            target: '#video-open',
          },
          {
            title: 'Frame rate, and the temporal rule',
            body: 'Once a source is live this panel grows two rows: the frame rate, 1 to 30 fps, and the temporal dither, which decides how the seed moves between frames. Frozen keeps one screen for a stable print, Shimmer reshuffles it every frame for the classic film buzz, Crawl scrolls the screen so the texture drifts upwards.',
            why: 'A frozen screen is the honest one — it is what a single proof would look like — while shimmer hides banding at the cost of noise.',
            target: '#g-motion',
          },
          {
            title: 'The transport',
            body: 'Under the proof, beside the readout the app already uses for the update mode: Play and Pause, and a counter naming the current frame and the rate it is running at. It appears with a source and goes with it.',
            target: 'footer.viewport-bar',
          },
          {
            title: 'Record it',
            body: 'Record WebM, the button in the tool rail - and the one this panel grows - captures the playback to a file. It stops itself at sixty seconds so a forgotten recording cannot fill a disk.',
            target: '.tool[data-tool=\"record\"]',
          },
        ],
      },

      /* ---------------------------------------------------------------- */
      {
        id: 'recipes-and-exports',
        title: 'Recipes and exports',
        summary: 'Save a look, pass it on, and get the proof out in any form.',
        theme: 'Everywhere else',
        minutes: 3,
        steps: [
          {
            title: 'A recipe is the whole press',
            body: 'A recipe is not just the algorithm: it is the ink, the pixel size, the seed, the grade, the effects stack and the glow. Twenty-one are in the box, and the one you are on is always shown here.',
            target: '#g-preset',
            open: 'preset',
          },
          {
            title: 'Apply one',
            body: 'Choosing a recipe drops every setting on the press at once. Nothing else on the machine changes, and every control stays live afterwards — a preset is a starting point, not a mode.',
            target: '#preset',
            show: [['press-preset', 'riso']],
            when: function (s) { return s.preset === 'riso'; },
          },
          {
            title: 'Pass a look on',
            body: 'Export JSON writes the current recipe to a file; Import JSON merges one back over the defaults. Two small files are enough to move a look between machines, or to keep the eight you actually use.',
            target: '#preset-export',
          },
          {
            title: 'Four ways out',
            body: 'Export PNG at 1×, 2×, 4× or 8× for the printed proof. Copy PNG puts it on the clipboard for the next app. Export .txt writes the character grid. Record in video mode writes a WebM.',
            why: 'Memory is held at about 32 MB a proof, so a long video session cannot creep upwards.',
            target: '#export-scale',
          },
          {
            title: 'The status bar keeps score',
            body: 'The file, its size, the press, the palette, the number of inks actually drawn, and how long the last render took. That last number is the honest cost of the recipe you are holding.',
            target: '.statusbar',
          },
        ],
      },

      /* ---------------------------------------------------------------- */
      {
        id: 'find-your-way',
        title: 'Find your way around',
        summary: 'The menus, the dock, the update modes, and the keys worth knowing.',
        theme: 'Everywhere else',
        minutes: 3,
        steps: [
          {
            title: 'The whole catalogue is in the menus',
            body: 'File, Edit, Image, Press, Effects, View, Window and Help hold all forty-six algorithms, twenty-four palettes, thirteen effects, eleven tone maps and twenty-one recipes, with the accelerators beside them.',
            why: 'The menus are expanded from the same tables the panels are built from, so a new algorithm can never be missing from one of them.',
            target: '#menubar',
          },
          {
            title: 'The dock',
            body: 'Ten stations, each one collapsible: click a tab here to jump to one, or a panel header to fold it away. Window ▸ Open every panel brings them all back, and View ▸ Panels on the right hides the dock entirely for a clean proof.',
            target: '#jump',
          },
          {
            title: 'Update modes',
            body: 'Full renders everything on every change. Live renders at half resolution while a control is being dragged and finishes on release. Still waits for the pointer to stop entirely.',
            why: 'The project rule is that this stays comfortable on an ordinary laptop: capped work, cached screens, no loop running behind you.',
            target: '#quality',
          },
          {
            title: 'Compare',
            body: 'Hold Compare — or the C key, or the eye in the tool rail — to see the untouched source under your settings. Release and the proof comes back.',
            why: 'The quickest way to see what the press is really doing is to look at what it was given.',
            target: '#compare',
          },
          {
            title: 'Zoom',
            body: 'Fit, − and + in the options bar, the same keys 0, − and = on the keyboard. The readout beside them is the scale you are looking at; 1× is the printed pixel grid, anything above it is for inspection.',
            target: '#zoom-fit',
          },
          {
            title: 'Random, and the way back',
            body: 'Random — R — rolls a fresh recipe: a new algorithm, ink, pixel size, grade and effects. Edit ▸ Reset every control puts everything back to the defaults. Neither one touches your source image.',
            target: '#random',
          },
          {
            title: 'Two more doors',
            body: 'Help ▸ Keyboard shortcuts lists every key in one dialog, and F1 opens the guide that ships beside the app. This tutorial can be started again from Help ▸ Take the Tour, or from the Learn panel above the rail.',
            target: '.menu[data-menu="help"]',
          },
        ],
      },

    ],
  };
}));
