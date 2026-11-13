/* smoke-menu.js - the Studio menu and its four routes.
 * Selected by `node tools/smoke.js menu` / `npm run smoke:menu`.
 *
 * This is deliberately narrow: the menu's own navigation, its data, and the
 * calls it makes into the existing surfaces. The plugin manager, effects stack,
 * recipe picker and saved schemes each have their own focused checks already.
 */
(async function () {
  const checks = [];
  function check(name, ok, detail) {
    checks.push({ name: name, ok: !!ok, detail: detail === undefined ? null : detail });
  }
  const wait = function (ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); };
  const menu = window.DitherFeatureMenu;
  const overlay = document.getElementById('feature-menu');
  const plugins = window.DitherPlugins;

  check('the studio menu is published', !!menu && typeof menu.open === 'function');
  check('the command is wired', window.DS.commands.indexOf('view-feature-menu') >= 0);
  check('the accelerator is registered', window.__shell.accelerators.indexOf('ctrl+shift+m') >= 0,
    window.__shell.accelerators.join(','));
  check('the rail has a studio menu button', !!document.querySelector('.tool[data-tool="menu"]'));
  check('the rail maps the button', window.__shell.tools.indexOf('menu') >= 0,
    window.__shell.tools.join(','));
  const railMasks = Array.prototype.map.call(document.querySelectorAll('.toolrail .ui-glyph'), function (glyph) {
    const style = getComputedStyle(glyph);
    return style.webkitMaskImage || style.maskImage || '';
  });
  check('every rail tool uses the supplied mask icon',
    railMasks.length === 9 && railMasks.every(function (mask) {
      return /\/src\/assets\/(icons|menu)\//.test(mask);
    }), railMasks.length + ' icons');
  check('the menu starts closed', overlay.hidden && !menu.isOpen());

  const ink = plugins ? await plugins.install('ink-extractor', true) : null;
  const shape = plugins ? await plugins.install('shape-press', true) : null;
  const dreamyPack = plugins ? await plugins.install('dreamy-cyberpunk', true) : null;
  check('the menu smoke can install three packages',
    !!ink && !!shape && !!dreamyPack,
    [ink && ink.id, shape && shape.id, dreamyPack && dreamyPack.id].join(','));

  const smokePalette = window.__dither.importPaletteText('#101820 #f2aa4c #f6e8d0', 'Menu Smoke');
  check('the menu smoke has a saved scheme', !!smokePalette, smokePalette);
  window.__dither.addEffect('grain');
  window.__dither.addEffect('scanlines');
  await wait(100);

  document.querySelector('.tool[data-tool="menu"]').click();
  await wait(100);
  check('the rail opens the menu', menu.isOpen() && overlay.hidden === false);
  let state = menu.state();
  check('the main shelf has four routes', state.view === 'menu' && state.cards === 4, state);
  const menuTitle = document.getElementById('fm-title');
  check('the header is just Studio menu',
    !!menuTitle && menuTitle.textContent === 'Studio menu' &&
      !document.getElementById('fm-kicker') && !document.getElementById('fm-subtitle'),
    menuTitle && menuTitle.textContent);
  check('the footer carries no status line or dot',
    !document.querySelector('.fm-status') && !document.querySelector('.fm-dot') &&
      !document.getElementById('fm-foot-note'));
  const plate = document.querySelector('[data-fm-view="plugins"]');
  const plateStyle = plate ? getComputedStyle(plate) : null;
  check('the plates use flat fills, not gradients',
    !!plateStyle && plateStyle.backgroundImage === 'none',
    plateStyle && plateStyle.backgroundImage);
  check('the plates use the app mono type',
    !!plateStyle && /mono/i.test(plateStyle.fontFamily), plateStyle && plateStyle.fontFamily);
  const plateTitle = plate && plate.querySelector('.fm-feature-title');
  check('the plate titles are set in the dock voice',
    !!plateTitle && getComputedStyle(plateTitle).textTransform === 'uppercase',
    plateTitle && getComputedStyle(plateTitle).textTransform);

  const masks = Array.prototype.map.call(document.querySelectorAll('.fm-feature-icon .fm-glyph'), function (glyph) {
    const style = getComputedStyle(glyph);
    return style.webkitMaskImage || style.maskImage || '';
  });
  check('each main plate carries an external mask icon',
    masks.length === 4 && masks.every(function (mask) {
      return /\/src\/assets\/menu\/feature-(plugins|effects|presets|palettes)\.svg/.test(mask);
    }),
    masks.join(' | '));

  const pluginMeta = document.querySelector('[data-fm-view="plugins"] .fm-feature-meta');
  const effectMeta = document.querySelector('[data-fm-view="effects"] .fm-feature-meta');
  const presetMeta = document.querySelector('[data-fm-view="presets"] .fm-feature-meta');
  const paletteMeta = document.querySelector('[data-fm-view="palettes"] .fm-feature-meta');
  check('the shelf counts installed packages', /3 installed/i.test(pluginMeta.textContent), pluginMeta.textContent);
  check('the shelf counts the effect stack', /2 in the stack/i.test(effectMeta.textContent), effectMeta.textContent);
  check('the shelf counts recipes', /27 recipes/i.test(presetMeta.textContent), presetMeta.textContent);
  check('the shelf counts saved schemes', /1 saved/i.test(paletteMeta.textContent), paletteMeta.textContent);

  document.querySelector('[data-fm-view="plugins"]').click();
  await wait(40);
  state = menu.state();
  check('Plugins opens its own view', state.view === 'plugins');
  const packageRows = document.querySelectorAll('[data-fm-plugin]');
  check('the plugin route lists the installed packages', packageRows.length === 3, packageRows.length);
  const packageMasks = Array.prototype.map.call(document.querySelectorAll('.fm-package-icon .fm-glyph'), function (glyph) {
    const style = getComputedStyle(glyph);
    return style.webkitMaskImage || style.maskImage || '';
  });
  check('package rows use their own icons',
    packageMasks.length === 3 && packageMasks.every(function (mask) {
      return /\/src\/assets\/menu\/(plugin-ink-extractor|plugin-shape-press|pack-dreamy-cyberpunk)\.svg/.test(mask);
    }),
    packageMasks.join(' | '));
  check('the plugin route offers the manager', !!document.querySelector('.fm-wide'));

  document.querySelector('[data-fm-plugin="ink-extractor"]').click();
  await wait(180);
  check('a tool package fires its own tool',
    !menu.isOpen() && !!window.DitherInkExtractor && window.DitherInkExtractor.isOpen());
  if (window.DitherInkExtractor) window.DitherInkExtractor.close();

  window.__dither.featureMenuOpen();
  await wait(100);
  document.querySelector('[data-fm-view="effects"]').click();
  await wait(40);
  state = menu.state();
  check('Effects opens its own view', state.view === 'effects' && state.rows === 2, state);
  const grainRow = document.querySelector('[data-fm-effect="grain"]');
  check('the effect row shows its amount', !!grainRow && /50%/.test(grainRow.textContent), grainRow && grainRow.textContent);

  grainRow.querySelector('.fm-switch').click();
  await wait(100);
  check('a switch pulls the effect out of the stack',
    menu.state().rows === 1 && window.__dither.stats().effects.indexOf('grain') < 0,
    window.__dither.stats().effects.join(','));
  document.querySelector('.fm-text-action').click();
  await wait(100);
  check('Disable all empties the stack', window.__dither.stats().effects.length === 0);
  check('the empty stack gets an empty state', !!document.querySelector('.fm-empty'));

  document.getElementById('fm-back').click();
  await wait(30);
  check('Back returns to the main shelf', menu.state().view === 'menu');

  document.querySelector('[data-fm-view="presets"]').click();
  await wait(40);
  const groups = Array.prototype.map.call(document.querySelectorAll('.fm-section-label'), function (label) {
    return label.textContent;
  });
  check('recipes are grouped by pack', groups[0] === 'BUILT-IN RECIPES' && groups.indexOf('DREAMY CYBERPUNK') > 0,
    groups.join('|'));
  check('the recipe route lists every recipe', document.querySelectorAll('[data-fm-preset]').length === 27,
    document.querySelectorAll('[data-fm-preset]').length);
  document.querySelector('[data-fm-preset="dreamy-cyberpunk-1"]').click();
  await wait(160);
  check('a recipe applies and closes the menu',
    !menu.isOpen() && window.__dither.stats().palette === 'cyberpunk-breach',
    window.__dither.stats().palette);

  window.__dither.featureMenuOpen();
  await wait(100);
  document.querySelector('[data-fm-view="palettes"]').click();
  await wait(40);
  state = menu.state();
  check('Color Schemes opens its own view', state.view === 'palettes' && state.rows === 1, state);
  document.querySelector('[data-fm-palette="' + smokePalette + '"]').click();
  await wait(120);
  check('a saved scheme applies and closes the menu',
    !menu.isOpen() && window.__dither.stats().palette === smokePalette,
    window.__dither.stats().palette);

  window.__dither.featureMenuOpen();
  await wait(100);
  document.querySelector('[data-fm-view="plugins"]').click();
  await wait(30);
  document.getElementById('fm-back').click();
  await wait(30);
  check('Back works from a second route', menu.state().view === 'menu');
  overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await wait(30);
  check('Escape closes from the main shelf', !menu.isOpen());

  window.DS.command('view-feature-menu');
  await wait(100);
  check('the command opens the menu', menu.isOpen());
  document.getElementById('fm-close').click();
  await wait(30);
  check('the close button closes the menu', !menu.isOpen());

  window.DS.command('view-feature-menu');
  await wait(100);
  window.DS.command('view-feature-menu');
  await wait(30);
  check('the command toggles the menu shut', !menu.isOpen());

  window.DS.command('view-feature-menu');
  await wait(80);
  document.querySelector('[data-fm-view="plugins"]').click();
  await wait(30);
  document.querySelector('[data-fm-plugin="shape-press"]').click();
  await wait(150);
  check('a Shape Press row joins the stack',
    !menu.isOpen() && window.__dither.stats().effects.indexOf('shapepress') >= 0,
    window.__dither.stats().effects.join(','));

  const failed = checks.filter(function (c) { return !c.ok; });
  return {
    ok: !failed.length,
    checks: checks,
    failures: failed.map(function (c) { return c.name; }),
    notes: {
      suite: 'menu',
      packages: plugins ? plugins.installed().map(function (pkg) { return pkg.id; }) : null,
      palette: smokePalette,
    },
  };
}());
