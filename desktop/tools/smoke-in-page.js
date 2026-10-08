/* smoke-in-page.js — the page-half of the desktop smoke run.
 *
 *     cd desktop
 *     DITHER_SMOKE_SAVE=/tmp/proof.png DITHER_SMOKE_OPEN=<any image> \
 *       npx electron . --smoke --smoke-script tools/smoke-in-page.js
 *
 * `electron/main.js --smoke` loads the app, waits for it to say it is ready,
 * evaluates this script in the page, captures the window to PNG, prints a JSON
 * report and exits non-zero if anything failed.
 *
 * What only this half can check: that the chrome really is drawn (menus, tool
 * rail, panels, tab strip), that every command name the menus speak is actually
 * wired (a typo in menu-spec.js shows up here as a failed command, not as a dead
 * menu item nobody notices), that the panels answer to their own verbs, and that
 * every slider has been painted with its travelled amount.
 *
 * It is an expression: the harness evaluates it and awaits the returned promise.
 */
(async function smoke() {
  const report = {
    chrome: [],
    commands: { ok: [], failed: [], threw: [] },
    checks: [],
    failures: [],
    notes: {},
  };

  const wait = function (ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); };

  function check(name, ok, detail) {
    report.checks.push({ name: name, ok: !!ok, detail: detail === undefined ? null : detail });
    if (!ok) report.failures.push(name);
    return !!ok;
  }

  /* ---- the chrome that has to exist ------------------------------- */

  const DS = window.DS;
  check('the app exposed its command surface', !!DS && typeof DS.command === 'function');
  check('the preload bridge is present', !!window.ditherDesktop && DS.desktop === true);
  check('the caption bar has its three window buttons', document.querySelectorAll('.titlebar .wbtn').length === 3);
  check('the menu bar has eight menus', document.querySelectorAll('.menubar .menu').length === 8,
    document.querySelectorAll('.menubar .menu').length);
  check('the tool rail has its eight tools', document.querySelectorAll('.toolrail .tool').length === 8,
    document.querySelectorAll('.toolrail .tool').length);
  check('the dock holds all ten panels', document.querySelectorAll('#rail .group').length === 10,
    document.querySelectorAll('#rail .group').length);
  check('and a tab for each of them', document.querySelectorAll('#jump .jump-chip').length === 10,
    document.querySelectorAll('#jump .jump-chip').length);
  check('the document tab names the open proof', /demo/.test(document.getElementById('doc-name').textContent),
    document.getElementById('doc-name').textContent);
  report.notes.title = document.title;

  /* ---- the panels really are the app's panels --------------------- */

  check('the algorithm list is filled from the catalogue',
    document.getElementById('algorithm').options.length === window.DitherLib.ALGORITHMS.length,
    document.getElementById('algorithm').options.length);
  check('the palette list matches the palette catalogue',
    document.getElementById('palette').options.length === window.DitherLib.PALETTES.length,
    document.getElementById('palette').options.length);
  check('the recipe list matches the recipe catalogue (plus its placeholder row)',
    document.getElementById('preset').options.length === DS.catalogues.PRESETS.length + 1,
    document.getElementById('preset').options.length);
  check('the palette swatches are drawn', document.getElementById('swatches').children.length > 1,
    document.getElementById('swatches').children.length);

  /* ---- the chrome's own accelerator table -------------------------- */

  const shell = window.__shell;
  check('the chrome published its accelerator table', !!shell && shell.accelerators.length > 15,
    shell ? shell.accelerators.length : 0);
  const wanted = ['ctrl+s', 'ctrl+o', 'ctrl+d', 'ctrl+r', 'ctrl+shift+r', 'ctrl+shift+c', 'ctrl+t', 'f1', 'f5', 'f11'];
  const missing = shell ? wanted.filter(function (key) { return shell.accelerators.indexOf(key) === -1; }) : wanted;
  check('every accelerator on a menu item is in the table', missing.length === 0, missing.join(', '));
  report.notes.accelerators = shell ? shell.accelerators : null;
  report.notes.keyLog = shell ? shell.keyLog : null;
  report.notes.acceleratorFires = shell && shell.acceleratorFires ? shell.acceleratorFires() : null;
  report.notes.savedCount = shell && shell.savedCount ? shell.savedCount() : null;

  /* ---- every slider has been painted with its amount -------------- */

  const ranges = Array.prototype.slice.call(document.querySelectorAll('input[type="range"]'));
  const painted = ranges.filter(function (range) {
    return /%$/.test(range.style.getPropertyValue('--fill') || '');
  });
  check('every slider shows how far it is travelled', painted.length === ranges.length,
    painted.length + ' of ' + ranges.length);

  /* ---- the menu bar draws, and its catalogues expand --------------- */

  document.querySelector('.menu[data-menu="press"]').click();
  await wait(80);
  const pop = document.getElementById('menu-pop');
  check('a menu opens with items', !pop.hidden && pop.querySelectorAll('.menu-item').length > 4,
    pop.querySelectorAll('.menu-item').length);

  const parent = Array.prototype.find.call(pop.querySelectorAll('.menu-item'), function (item) {
    return /Algorithm/.test(item.textContent);
  });
  // Read the submenu in the SAME tick as the interaction: the app window is on a
  // real desktop while this runs, and a real mouse pointer resting over a menu row
  // fires a genuine mouseenter that closes it again. Hover is the primary path, so
  // dispatch it directly and measure before anything else can happen.
  let subError = null;
  let sub = null;
  try {
    if (parent) parent.dispatchEvent(new MouseEvent('mouseenter'));
    sub = document.querySelector('.menu-pop.is-sub');
  } catch (err) { subError = String(err && err.message); }
  const subByHover = sub ? sub.querySelectorAll('.menu-item').length : null;
  try {
    if (parent) parent.click();
    const byClick = document.querySelector('.menu-pop.is-sub');
    if (byClick && !sub) sub = byClick;
    if (sub) sub = byClick || sub;
  } catch (err) { subError = String(err && err.message); }
  await wait(120);
  report.notes.menuProbe = {
    parentFound: !!parent, parentLabel: parent ? parent.textContent : null,
    subBoxes: document.querySelectorAll('.menu-pop.is-sub').length,
    subItems: sub ? sub.querySelectorAll('.menu-item').length : null,
    subByHover: subByHover,
    error: subError,
    popItems: pop.querySelectorAll('.menu-item').length,
  };
  check('the algorithm submenu lists the whole catalogue',
    !!sub && sub.querySelectorAll('.menu-item').length === window.DitherLib.ALGORITHMS.length,
    sub ? sub.querySelectorAll('.menu-item').length : 0);
  check('the ticked algorithm is marked', !!sub && !!sub.querySelector('.menu-item.is-on'));

  document.body.click();
  await wait(60);
  check('menus close when you click away', document.getElementById('menu-pop').hidden);

  /* ---- a key press runs exactly the one command it is bound to ------ */

  function press(init) {
    document.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ bubbles: true, cancelable: true }, init)));
  }

  const seedBefore = DS.state().seed;
  const firesBefore = shell && shell.acceleratorFires ? shell.acceleratorFires() : 0;
  press({ key: 'r', ctrlKey: true, shiftKey: true });
  await wait(140);
  check('Ctrl+Shift+R reseeds exactly once',
    DS.state().seed === ((seedBefore + 7919) >>> 0),
    seedBefore + ' -> ' + DS.state().seed);

  // The roll is random, so no single property is promised to move (it can pick
  // the algorithm it is already on). Compare the whole recipe instead.
  const recipe = function () {
    const s = DS.state();
    return [s.algorithm, s.palette, s.toneMap, s.seed, s.effects.length].join('|');
  };
  const recipeBefore = recipe();
  press({ key: 'r', ctrlKey: true });
  await wait(160);
  check('Ctrl+R rolls a fresh recipe', recipe() !== recipeBefore,
    recipeBefore + ' -> ' + recipe());

  press({ key: '=', ctrlKey: true });
  await wait(140);
  check('Ctrl+= zooms in', document.getElementById('stat-zoom').textContent !== 'Fit',
    document.getElementById('stat-zoom').textContent);
  DS.command('view-zoom-fit');

  const fires = shell && shell.acceleratorFires ? shell.acceleratorFires() : 0;
  check('three presses ran three commands, no more', fires - firesBefore === 3, fires - firesBefore);

  /* ---- every command name the menus speak is wired ----------------- */

  const calls = [
    ['file-demo'], ['edit-random'], ['edit-reseed'],
    ['press-algorithm', 'bayer8'], ['press-palette', 'c64'],
    ['press-step-algorithm', 1], ['press-step-palette', -1],
    ['press-serpentine'], ['press-preset', 'newsprint'],
    ['image-tonemap', 'sepia'], ['image-ramp', 'blocks'],
    ['image-textmode'], ['image-textmode'],
    ['effects-add', 'grain'],
    ['window-panel', 'effects'], ['window-panels-open'], ['window-panels-collapse'], ['window-panel', 'press'],
    ['view-zoom-in'], ['view-zoom-out'], ['view-zoom-fit'],
    ['view-quality', 'full'], ['view-quality', 'still'], ['view-quality', 'live'],
    ['view-compare', true], ['view-compare', false],
    ['edit-reset'], ['file-export-txt'], ['file-export-preset'], ['file-save-png'],
    ['file-open'], ['file-copy-png'],
  ];

  for (let i = 0; i < calls.length; i++) {
    const name = calls[i][0];
    const arg = calls[i][1];
    try {
      if (DS.command(name, arg)) report.commands.ok.push(name);
      else report.commands.failed.push(name);
    } catch (err) {
      report.commands.threw.push(name + ': ' + (err && err.message));
    }
    await wait(45);
  }
  check('every command the menu bar can send is wired',
    report.commands.failed.length === 0 && report.commands.threw.length === 0,
    report.commands.failed.concat(report.commands.threw).join(', '));

  /* ---- the panels answer, and the stack uses the real markup ------- */

  DS.command('press-algorithm', 'floyd-steinberg');
  DS.command('press-palette', 'gameboy');
  DS.command('image-tonemap', 'none');
  await wait(120);
  const state = window.DS.state();
  check('choosing an algorithm changes the proof', state.algorithm === 'floyd-steinberg', state.algorithm);
  check('choosing a palette changes the proof', state.palette === 'gameboy', state.palette);
  check('the compare view went back off', state.compare === false);

  DS.command('effects-add', 'grain');
  DS.command('effects-add', 'scanlines');
  await wait(160);
  const rows = document.querySelectorAll('#effect-list .stack-row');
  check('the effects stack shows a row per effect', rows.length === 2, rows.length);
  check('the stack rows are the real markup', !!document.querySelector('#effect-list .stack-row .stack-name'));
  report.notes.stackHtml = document.getElementById('effect-list').innerHTML.slice(0, 400);
  report.notes.effects = window.DS.state().effects;

  DS.command('window-panels-open');
  await wait(60);
  check('opening every panel opens every panel', window.DS.state().openGroups.length === 10,
    window.DS.state().openGroups.length);
  DS.command('effects-clear');
  await wait(60);
  check('clearing the stack empties it', window.DS.state().effects.length === 0);

  /* ---- the caption and the status line follow the app -------------- */

  DS.command('file-demo');
  await wait(150);
  const after = window.DS.state();
  report.notes.state = after;
  check('the status line reports what was made', /Ready|Exported|Saved|Demo/.test(after.status), after.status);
  check('the proof has real pixels', after.width > 100 && after.height > 100, after.width + 'x' + after.height);

  report.ok = report.failures.length === 0;
  return report;
}());
