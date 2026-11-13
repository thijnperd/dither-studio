/* smoke-help.js - the Help window's new surfaces, without the rest of the app.
 * Selected by `node tools/smoke.js help` / `npm run smoke:help`.
 */
(async function () {
  const checks = [];
  function check(name, ok, detail) {
    checks.push({ name: name, ok: !!ok, detail: detail === undefined ? null : detail });
  }
  const wait = function (ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); };
  async function until(fn, timeout) {
    const end = Date.now() + (timeout || 1200);
    while (Date.now() < end) {
      if (fn()) return true;
      await wait(40);
    }
    return false;
  }

  // ---- shortcuts page and the editor -------------------------------------
  const opened = window.DitherHelp.open('shortcuts');
  await wait(80);
  check('Help opens on the shortcuts page', opened === true && window.DitherHelp.isOpen() &&
    document.getElementById('help-title').textContent === 'Keyboard shortcuts');
  check('the shortcut editor is part of the page',
    !!document.querySelector('#help-body .help-keys') &&
    /Change the keys/.test(document.getElementById('help-body').textContent));

  const before = window.DitherShortcuts.keysFor('file-open').join('+');
  const change = Array.prototype.find.call(
    document.querySelectorAll('#help-body .help-action'),
    function (button) { return button.textContent === 'Change'; }
  );
  check('every editable row offers Change', !!change);
  if (change) change.click();
  const combo = new KeyboardEvent('keydown', {
    key: '9', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true,
  });
  document.getElementById('help').dispatchEvent(combo);
  await wait(60);
  const after = window.DitherShortcuts.keysFor('file-open').join('+');
  check('a captured combination is stored', after !== before && after === 'Ctrl+Shift+9', after);
  check('the menu accelerators follow the override',
    window.__shell.accelerators.indexOf('ctrl+shift+9') >= 0 ||
    window.__shell.accelerators.indexOf('ctrl+o') < 0,
    window.__shell.accelerators.join(','));
  window.DitherShortcuts.resetAll();

  // ---- the guide, read through IPC instead of a path --------------------
  window.DitherHelp.close();
  window.__shell.run('help-guide');
  const guideReady = await until(function () {
    return document.getElementById('help-title').textContent === 'The guide' &&
      !/on its way/.test(document.getElementById('help-body').textContent);
  }, 1500);
  const guideText = document.getElementById('help-body').textContent;
  const guideSections = document.querySelectorAll('#help-body .help-section').length;
  check('F1/guide opens a real page', guideReady && window.DitherHelp.isOpen());
  const guideMark = document.querySelector('#help-nav [data-page="guide"] .ui-glyph');
  check('the guide carries its book mark',
    !!guideMark && guideMark.style.getPropertyValue('--ui-icon').indexOf('book.svg') >= 0,
    guideMark ? guideMark.style.getPropertyValue('--ui-icon') : null);
  check('the guide renders its first heading', /Dither Studio/.test(guideText), guideText.slice(0, 80));
  check('the guide is split into sections',
    document.querySelectorAll('#help-body .help-section').length > 2,
    document.querySelectorAll('#help-body .help-section').length);
  check('the guide is not an error page',
    !/The manual is missing|could not be read from this build/i.test(guideText));

  // ---- about/update UI ---------------------------------------------------
  window.DitherHelp.close();
  window.DitherHelp.open('about');
  await wait(80);
  const aboutText = document.getElementById('help-body').textContent;
  const checkButton = Array.prototype.find.call(
    document.querySelectorAll('#help-body .help-action'),
    function (button) { return /Check (for updates|again)/.test(button.textContent); }
  );
  check('About carries an in-app update row', /Updates/.test(aboutText) && !!checkButton);
  check('About does not open a native update dialog', !/dialog/i.test(aboutText));

  // ---- Ctrl+? opens the shortcuts page ----------------------------------
  window.DitherHelp.close();
  document.dispatchEvent(new KeyboardEvent('keydown', {
    key: '?', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true,
  }));
  await wait(80);
  check('Ctrl+? opens the shortcut menu', window.DitherHelp.isOpen() &&
    document.getElementById('help-title').textContent === 'Keyboard shortcuts');

  // ---- one Learn toggle --------------------------------------------------
  window.DitherHelp.close();
  const startHidden = window.DitherTour.hidden();
  window.__shell.run('help-tour-toggle');
  await wait(60);
  check('the Learn menu item hides the station', window.DitherTour.hidden() !== startHidden &&
    document.getElementById('g-learn').hidden === window.DitherTour.hidden());
  window.__shell.run('help-tour-toggle');
  await wait(60);
  check('the same item shows it again', window.DitherTour.hidden() === startHidden &&
    document.getElementById('g-learn').hidden === startHidden);

  // Leave the About page up for the run's screenshot, so the update row and
  // the simplified sidebar can be reviewed without opening the app by hand.
  window.DitherHelp.open('about');
  await wait(120);

  const failed = checks.filter(function (c) { return !c.ok; });
  return {
    ok: !failed.length,
    checks: checks,
    failures: failed.map(function (c) { return c.name; }),
    notes: {
      suite: 'help',
      shortcut: after,
      guideSections: guideSections,
    },
  };
}());
