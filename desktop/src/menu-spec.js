/* menu-spec.js — the one menu definition, shared by both menu bars.
 *
 * The desktop app has two menus that must never drift apart:
 *   - the native application menu (a real macOS menu bar, and the accelerator
 *     table on Windows/Linux), built in electron/main.js;
 *   - the in-window menu bar that gives the app its Photoshop shape, built in
 *     src/renderer/shell.js.
 *
 * So neither one owns the list. This file does, in the two shapes a menu needs:
 *
 *   { label, command, arg, accel }        a leaf that runs a command
 *   { type: 'sep' }                       a separator
 *   { label, submenu: [ ... ] }           a nested menu
 *   { label, check, command, arg }        a leaf whose tick state comes from
 *                                         the app (menu bar shows ✓, native
 *                                         menu shows a checkbox)
 *   { label, radio: 'algorithm', ... }    one of a radio set inside its parent
 *                                         (its own branch), ticked while the
 *                                         app's value matches `arg`
 *   { label, catalogue: 'ALGORITHMS' }    a submenu whose contents are the
 *                                         app's own catalogue, so a new
 *                                         algorithm can never be missing from
 *                                         the menu: the host expands it.
 *
 * `accel` uses Electron's spelling (`CmdOrCtrl+O`); the in-window bar renders
 * it for the current platform, the native menu passes it through untouched.
 *
 * The renderer expands the catalogues (the presets and character ramps live in
 * the shell, not in the core) and hands the finished tree to main, which is why
 * main never needs to know a single algorithm's name.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DitherMenuSpec = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  return {
    menus: [
      {
        id: 'file', label: 'File',
        items: [
          { label: 'Open Image…', command: 'file-open', accel: 'CmdOrCtrl+O' },
          { label: 'Open Clip…', command: 'file-open-clip', accel: 'CmdOrCtrl+Shift+O' },
          { type: 'sep' },
          { label: 'Generated Demo Scene', command: 'file-demo', accel: 'CmdOrCtrl+D' },
          { type: 'sep' },
          { label: 'Save Proof as PNG…', command: 'file-save-png', accel: 'CmdOrCtrl+S' },
          { label: 'Copy Proof to Clipboard', command: 'file-copy-png', accel: 'CmdOrCtrl+Shift+C' },
          { label: 'Export Text Proof…', command: 'file-export-txt' },
          { type: 'sep' },
          { label: 'Export Preset…', command: 'file-export-preset' },
          { label: 'Import Preset…', command: 'file-import-preset' },
          { type: 'sep' },
          { label: 'Quit Dither Studio', command: 'file-quit', accel: 'CmdOrCtrl+Q' },
        ],
      },
      {
        id: 'edit', label: 'Edit',
        items: [
          { label: 'Roll a Fresh Recipe', command: 'edit-random', accel: 'CmdOrCtrl+R' },
          { label: 'New Seed', command: 'edit-reseed', accel: 'CmdOrCtrl+Shift+R' },
          { label: 'Reset Every Control', command: 'edit-reset' },
        ],
      },
      {
        id: 'image', label: 'Image',
        items: [
          { label: 'Tone Map', catalogue: 'TONE_MAPS', command: 'image-tonemap', radio: 'toneMap', check: 'toneMap' },
          {
            label: 'Transparency', submenu: [
              { label: 'Flatten onto paper', command: 'image-alpha', arg: 'matte', radio: 'alphaMode', check: 'alphaMode' },
              { label: 'Dither the matte', command: 'image-alpha', arg: 'sharpen', radio: 'alphaMode', check: 'alphaMode' },
              { label: 'Keep as PNG alpha', command: 'image-alpha', arg: 'keep', radio: 'alphaMode', check: 'alphaMode' },
            ],
          },
          { type: 'sep' },
          { label: 'Print with Characters', command: 'image-textmode', accel: 'CmdOrCtrl+T', check: 'textMode' },
          { label: 'Character Ramp', catalogue: 'TEXT_RAMPS', command: 'image-ramp', radio: 'textRamp', check: 'textRamp' },
          { type: 'sep' },
          { label: 'Show the Tone Panel', command: 'window-panel', arg: 'tone' },
          { label: 'Show the Detail Panel', command: 'window-panel', arg: 'detail' },
        ],
      },
      {
        id: 'press', label: 'Press',
        items: [
          { label: 'Algorithm', catalogue: 'ALGORITHMS', command: 'press-algorithm', radio: 'algorithm', check: 'algorithm' },
          { label: 'Palette', catalogue: 'PALETTES', command: 'press-palette', radio: 'palette', check: 'palette' },
          { type: 'sep' },
          { label: 'Previous Algorithm', command: 'press-step-algorithm', arg: -1, accel: 'CmdOrCtrl+Up' },
          { label: 'Next Algorithm', command: 'press-step-algorithm', arg: 1, accel: 'CmdOrCtrl+Down' },
          { label: 'Previous Palette', command: 'press-step-palette', arg: -1, accel: 'CmdOrCtrl+Left' },
          { label: 'Next Palette', command: 'press-step-palette', arg: 1, accel: 'CmdOrCtrl+Right' },
          { type: 'sep' },
          { label: 'Serpentine Sweep', command: 'press-serpentine', check: 'serpentine' },
          { type: 'sep' },
          { label: 'Recipe', catalogue: 'PRESETS', command: 'press-preset', radio: 'preset', check: 'preset' },
        ],
      },
      {
        id: 'effects', label: 'Effects',
        items: [
          { label: 'Add to the Stack', catalogue: 'GLITCHES', command: 'effects-add' },
          { type: 'sep' },
          { label: 'Clear the Stack', command: 'effects-clear' },
        ],
      },
      {
        id: 'view', label: 'View',
        items: [
          { label: 'Zoom In', command: 'view-zoom-in', accel: 'CmdOrCtrl+=' },
          { label: 'Zoom Out', command: 'view-zoom-out', accel: 'CmdOrCtrl+-' },
          { label: 'Fit in Window', command: 'view-zoom-fit', accel: 'CmdOrCtrl+0' },
          { type: 'sep' },
          {
            label: 'Update Mode', submenu: [
              { label: 'Full', command: 'view-quality', arg: 'full', radio: 'quality', check: 'quality' },
              { label: 'Live', command: 'view-quality', arg: 'live', radio: 'quality', check: 'quality' },
              { label: 'Still', command: 'view-quality', arg: 'still', radio: 'quality', check: 'quality' },
            ],
          },
          { type: 'sep' },
          { label: 'Compare with the Source', command: 'view-compare', check: 'compare' },
          { label: 'Panels on the Right', command: 'view-dock', check: 'dock' },
          { type: 'sep' },
          { label: 'Reload the Window', command: 'view-reload', accel: 'F5' },
          { label: 'Toggle Developer Tools', command: 'view-devtools', accel: 'CmdOrCtrl+Shift+I' },
          { label: 'Toggle Full Screen', command: 'view-fullscreen', accel: 'F11' },
        ],
      },
      {
        id: 'window', label: 'Window',
        items: [
          { label: 'Panels', catalogue: 'PANELS', command: 'window-panel', check: 'panel' },
          { type: 'sep' },
          { label: 'Open Every Panel', command: 'window-panels-open' },
          { label: 'Collapse Every Panel', command: 'window-panels-collapse' },
        ],
      },
      {
        id: 'help', label: 'Help',
        items: [
          { label: 'Dither Studio Guide', command: 'help-guide', accel: 'F1' },
          { label: 'Keyboard Shortcuts', command: 'help-shortcuts' },
          { type: 'sep' },
          { label: 'The Core in one File (SOURCES)', command: 'help-sources' },
          { label: 'Project on GitHub', command: 'help-repo' },
          { type: 'sep' },
          { label: 'About Dither Studio', command: 'help-about' },
        ],
      },
    ],
  };
}));
