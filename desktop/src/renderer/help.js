/* help.js - the Help window.
 *
 * Three pages in one instrument-panel window: the keyboard reference, the
 * release notes shipped with this build, and About. The shape is W3Plan's
 * Settings window, translated to this app: a sidebar of grouped pages, a
 * search field that searches every row, a content column of title/description
 * rows, Escape to close, Tab kept inside, and focus returned where it came
 * from. The backdrop scrolls the window under it not at all.
 *
 * The native message boxes this replaces could only show a wall of text. Here
 * every shortcut is a row, every page is reachable from the keyboard, and the
 * release notes are read from the changelog the app already ships.
 *
 * Exposes: window.DitherHelp - { open, close, isOpen }.
 */
(function () {
  'use strict';

  const DS = window.DS;
  if (!DS) return;

  const desktop = window.ditherDesktop || null;
  const $ = function (id) { return document.getElementById(id); };
  const isMac = DS.platform === 'darwin';

  let overlay = null;
  let field = null;
  let clearButton = null;
  let nav = null;
  let body = null;
  let kicker = null;
  let title = null;
  let sub = null;
  let status = null;
  let restoreFocus = null;
  let previousOverflow = '';
  let activePage = 'shortcuts';
  let query = '';
  let releasePromise = null;

  const release = { state: 'idle', version: '', notes: '', error: '' };

  // ---- the pages ---------------------------------------------------------

  // A key label is written the way the platform writes it. The menu's Ctrl is
  // the Mac's Command, so the Help window must not tell a Mac user to hold a
  // key that is not on their keyboard.
  function keyLabel(key) {
    if (!isMac) return key;
    if (key === 'Ctrl') return '⌘';
    if (key === 'Shift') return '⇧';
    if (key === 'Alt') return '⌥';
    return key;
  }

  function shortcut(titleText, keys, note) {
    return { title: titleText, keys: keys, note: note };
  }

  const SHORTCUTS = {
    id: 'shortcuts',
    group: 'Reference',
    name: 'Keyboard shortcuts',
    glyph: '⌘',
    kicker: 'Reference · Keys',
    sub: 'Every command the window answers to, without leaving the proof.',
    lead: '',
    sections: [
      {
        title: 'Files and the proof',
        rows: [
          shortcut('Open an image', ['Ctrl', 'O'], 'Read a PNG, JPEG, WebP, GIF or BMP into the press.'),
          shortcut('Open a clip', ['Ctrl', 'Shift', 'O'], 'Load a video and work on its frames.'),
          shortcut('Built-in source', ['Ctrl', 'D'], 'Step through the paintings that ship inside the app.'),
          shortcut('Save the proof as PNG', ['Ctrl', 'S'], 'Write the proof at the scale set in the options bar.'),
          shortcut('Copy the proof to the clipboard', ['Ctrl', 'Shift', 'C'], 'Hand the current proof to another app.'),
          shortcut('Quit Dither Studio', ['Ctrl', 'Q'], 'Close the press and every window it owns.'),
        ],
      },
      {
        title: 'Find and view',
        rows: [
          shortcut('Find anything', ['Ctrl', 'K'], 'One field over every panel, algorithm, palette, effect and recipe.'),
          shortcut('Zoom in', ['Ctrl', '='], 'The bare + key also zooms in when no field has focus.'),
          shortcut('Zoom out', ['Ctrl', '−'], 'The bare − key also zooms out when no field has focus.'),
          shortcut('Fit the proof in the window', ['Ctrl', '0'], 'The bare 0 key does the same.'),
          shortcut('Open the guide', ['F1'], 'Open GUIDE.md in your editor.'),
          shortcut('Reload the window', ['F5'], 'Reload the press without changing its saved presets.'),
          shortcut('Toggle developer tools', ['Ctrl', 'Shift', 'I'], 'Only needed when working on the app itself.'),
          shortcut('Toggle full screen', ['F11'], 'Fill the display with the press.'),
        ],
      },
      {
        title: 'The press',
        rows: [
          shortcut('Undo the last recipe change', ['Ctrl', 'Z'], 'Step back through algorithm, palette, tone and effect changes.'),
          shortcut('Redo the last recipe change', ['Ctrl', 'Shift', 'Z'], 'Step forward again after an undo.'),
          shortcut('Roll a fresh recipe', ['Ctrl', 'R'], 'A complete recipe: algorithm, palette, tones and effects.'),
          shortcut('Roll a fresh recipe', ['R'], 'The same roll from the bare keys.'),
          shortcut('New seed', ['Ctrl', 'Shift', 'R'], 'Change the seed without changing the rest of the recipe.'),
          shortcut('Previous algorithm', ['Ctrl', '↑'], 'Step through the algorithm catalogue.'),
          shortcut('Next algorithm', ['Ctrl', '↓'], 'Step through the algorithm catalogue.'),
          shortcut('Previous palette', ['Ctrl', '←'], 'Step through the alphabetised palette catalogue.'),
          shortcut('Next palette', ['Ctrl', '→'], 'Step through the alphabetised palette catalogue.'),
          shortcut('Compare with the source', ['C'], 'Hold C to see the image before the press.'),
          { title: 'Split compare the source and the proof', value: 'View ▸ Split Compare', note: 'Drag the divider, or focus it and use the arrow keys. The split is a view only; exports contain the proof alone.' },
          shortcut('Character mode', ['Ctrl', 'T'], 'Print the proof with the selected character ramp.'),
        ],
      },
      {
        title: 'Window and focus',
        rows: [
          shortcut('Close what is open', ['Esc'], 'Close a menu, the command palette, the tutorial or this Help window.'),
          shortcut('Move through Help', ['Tab'], 'The focus stays inside this window until it closes.'),
          shortcut('Move through the menu bar', ['Alt'], 'Alt plus a letter opens the matching menu.'),
        ],
      },
      {
        title: 'Mouse and drop',
        rows: [
          { title: 'Drop a file on the proof', value: 'Drag & drop', note: 'Images and clips both load this way.' },
          { title: 'Paste an image', keys: ['Ctrl', 'V'], note: 'Paste from the clipboard into the proof well.' },
          { title: 'Pan a zoomed proof', value: 'Drag', note: 'Drag the proof when it is larger than the window.' },
        ],
      },
    ],
  };

  function catalogueCounts() {
    const c = DS.catalogues || {};
    const parts = [];
    if (c.ALGORITHMS) parts.push(c.ALGORITHMS.length + ' algorithms');
    if (c.PALETTES) parts.push(c.PALETTES.length + ' palettes');
    if (c.GLITCHES) parts.push(c.GLITCHES.length + ' effects');
    if (c.PRESETS) parts.push(c.PRESETS.length + ' recipes');
    return parts.join(' · ');
  }

  function aboutPage() {
    const versions = desktop && desktop.versions ? desktop.versions : {};
    const versionValue = release.state === 'ready' && release.version ? release.version : '…';
    const runtime = versions.electron
      ? 'Electron ' + versions.electron + ' · Chromium ' + versions.chrome + ' · Node ' + versions.node
      : 'The desktop runtime for this build.';

    return {
      id: 'about',
      group: 'This build',
      name: 'About Dither Studio',
      glyph: 'i',
      kicker: 'About this build',
      sub: 'An offline dithering press, its shared engine, and where to read more.',
      lead: '',
      sections: [
        {
          title: 'The press',
          rows: [
            {
              title: 'Dither Studio',
              value: versionValue,
              note: 'The desktop edition: native files, a tool rail, a panel dock and a guided tutorial. No account and no network.',
              search: 'version build desktop offline account network',
            },
            {
              title: 'One engine, every build',
              note: 'The dithering core is the same dither.js that runs the web and demo versions of the press.',
              search: 'engine dither core web demo launcher shared',
            },
            {
              title: 'What is on the press',
              note: catalogueCounts() || 'The shared algorithm, palette, effect and recipe catalogues.',
              search: 'algorithms palettes effects recipes counts catalogue',
            },
            {
              title: 'Desktop runtime',
              value: versions.electron ? 'Electron ' + versions.electron : 'Electron',
              note: runtime,
              search: 'electron chromium node runtime version',
            },
          ],
        },
        {
          title: 'Read more',
          rows: [
            {
              title: 'The guide',
              note: 'The full manual, kept beside the app and opened in your editor.',
              action: { label: 'Open guide', command: 'help-guide' },
              search: 'guide manual markdown f1',
            },
            {
              title: 'Project on GitHub',
              note: 'Source, releases, issues and the build history.',
              action: { label: 'Open', command: 'help-repo' },
              search: 'github source repository releases issues',
            },
            {
              title: 'The core in one file',
              note: 'SOURCES.md credits the algorithms, palettes and references behind the press.',
              action: { label: 'Open', command: 'help-sources' },
              search: 'sources credits references algorithm palette',
            },
          ],
        },
      ],
    };
  }

  // Changelog notes arrive as plain text with "•" bullets. Keep blank lines as
  // paragraph breaks, and join a wrapped source line to the block it belongs
  // to; a page of one-line fragments would read worse than the source. A plain
  // paragraph is kept apart from a real bullet so it does not grow a marker of
  // its own.
  function noteBlocks(text) {
    const lines = String(text || '').replace(/\r/g, '').split('\n');
    const blocks = [];
    let current = null;
    lines.forEach(function (raw) {
      const line = raw.trim();
      if (!line) { current = null; return; }
      if (/^•\s+/.test(line)) {
        current = { text: line.replace(/^•\s+/, ''), bullet: true };
        blocks.push(current);
      } else if (current) {
        current.text += ' ' + line;
      } else {
        current = { text: line, bullet: false };
        blocks.push(current);
      }
    });
    return blocks;
  }

  function whatsNewPage() {
    let sections;
    let lead = '';

    if (release.state === 'ready' && release.notes) {
      const blocks = noteBlocks(release.notes);
      lead = 'Dither Studio ' + release.version + ' is installed. These are the notes shipped with it.';
      sections = [{
        title: 'Dither Studio ' + release.version,
        rows: blocks.length
          ? blocks.map(function (block) {
            return { title: block.text, prose: true, plain: !block.bullet, search: block.text };
          })
          : [{ title: 'No release notes were published for this version.', prose: true, plain: true, search: 'release notes empty' }],
      }];
    } else if (release.state === 'error') {
      lead = 'The changelog could not be read.';
      sections = [{
        title: 'Release notes',
        rows: [{
          title: 'The shipped changelog was not available.',
          prose: true,
          note: release.error || 'The file could not be opened.',
          search: 'changelog error release notes unavailable',
        }],
      }];
    } else {
      lead = 'Reading the changelog that ships with this build…';
      sections = [{
        title: 'Release notes',
        rows: [{
          title: 'The notes are on their way.',
          prose: true,
          note: 'They come from the CHANGELOG.md included with the installed build.',
          search: 'changelog release notes loading',
        }],
      }];
    }

    return {
      id: 'whats-new',
      group: 'This build',
      name: 'What’s new',
      glyph: '✦',
      kicker: 'Release notes',
      sub: 'The notes for the build on this computer, read from the changelog it ships with.',
      lead: lead,
      sections: sections,
    };
  }

  function allPages() {
    return [SHORTCUTS, whatsNewPage(), aboutPage()];
  }

  function pageById(id) {
    const pages = allPages();
    return pages.find(function (page) { return page.id === id; }) || pages[0];
  }

  // ---- search ------------------------------------------------------------

  function normalize(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[’']/g, "'")
      .replace(/\+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function matches(text, needle) {
    const hay = normalize(text);
    const tokens = needle.split(' ').filter(Boolean);
    return tokens.every(function (token) { return hay.indexOf(token) >= 0; });
  }

  function rowText(row) {
    const keys = row.keys ? row.keys.map(keyLabel).join(' ') : '';
    return [row.title, row.note, row.value, row.search, keys, row.action && row.action.label]
      .filter(Boolean).join(' ');
  }

  function findPages(pages, needle) {
    return pages.map(function (page) {
      const pageHit = matches(page.name + ' ' + page.kicker + ' ' + page.sub + ' ' + page.lead, needle);
      const sections = page.sections.map(function (section) {
        const whole = pageHit || matches(section.title, needle);
        const rows = whole ? section.rows : section.rows.filter(function (row) {
          return matches(rowText(row), needle);
        });
        return { section: section, rows: rows };
      }).filter(function (group) { return group.rows.length; });
      return { page: page, sections: sections };
    }).filter(function (group) { return group.sections.length; });
  }

  function resultCount(found) {
    return found.reduce(function (total, group) {
      return total + group.sections.reduce(function (sum, section) { return sum + section.rows.length; }, 0);
    }, 0);
  }

  // ---- DOM ---------------------------------------------------------------

  function node(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function keycaps(keys) {
    const wrap = node('span', 'help-keys');
    keys.forEach(function (key, index) {
      if (index) wrap.appendChild(node('span', 'help-plus', '+'));
      const cap = document.createElement('kbd');
      cap.textContent = keyLabel(key);
      wrap.appendChild(cap);
    });
    return wrap;
  }

  function runAction(action) {
    if (!action || !action.command) return;
    const shell = window.__shell;
    if (shell && typeof shell.run === 'function') shell.run(action.command, action.arg);
  }

  function appendSection(section, rows) {
    const block = node('section', 'help-section');
    block.appendChild(node('h2', '', section.title));
    (rows || section.rows).forEach(function (row) {
      const line = node('div', 'help-row' + (row.prose ? ' help-row-prose' : '') + (row.plain ? ' is-plain' : ''));
      const text = node('div', 'help-row-text');
      text.appendChild(node('div', 'help-row-title', row.title));
      if (row.note) text.appendChild(node('div', 'help-row-note', row.note));
      line.appendChild(text);

      if (row.keys) line.appendChild(keycaps(row.keys));
      else if (row.value) line.appendChild(node('span', 'help-value', row.value));
      else if (row.action) {
        const button = node('button', 'btn help-action', row.action.label || 'Open');
        button.type = 'button';
        button.addEventListener('click', function () { runAction(row.action); });
        line.appendChild(button);
      }
      block.appendChild(line);
    });
    body.appendChild(block);
  }

  function renderNav(pageCounts, searching) {
    const pages = allPages();
    nav.textContent = '';
    let group = '';
    pages.forEach(function (page) {
      if (page.group !== group) {
        group = page.group;
        nav.appendChild(node('p', 'help-nav-group', group));
      }
      const button = node('button', 'help-navitem' + (searching && !pageCounts[page.id] ? ' is-empty' : ''));
      button.type = 'button';
      if (!searching && page.id === activePage) button.setAttribute('aria-current', 'page');
      button.setAttribute('data-page', page.id);

      button.appendChild(node('span', 'help-nav-glyph', page.glyph));
      button.appendChild(node('span', 'help-nav-name', page.name));
      if (searching) button.appendChild(node('span', 'help-nav-count', String(pageCounts[page.id] || 0)));
      button.addEventListener('click', function () { go(page.id); });
      nav.appendChild(button);
    });
  }

  function renderPage(page) {
    if (page.lead) body.appendChild(node('p', 'help-lead', page.lead));
    page.sections.forEach(function (section) { appendSection(section); });
  }

  function renderResults(found) {
    found.forEach(function (group) {
      const head = node('div', 'help-hit-page');
      head.appendChild(node('span', 'help-nav-glyph', group.page.glyph));
      head.appendChild(node('span', '', group.page.name));
      body.appendChild(head);
      group.sections.forEach(function (section) {
        appendSection(section.section, section.rows);
      });
    });
  }

  function renderEmpty() {
    const empty = node('div', 'help-empty');
    empty.appendChild(node('b', '', 'Nothing answers to that.'));
    empty.appendChild(node('span', '', 'Try “palette”, “save”, “version” or “changelog”.'));
    body.appendChild(empty);
  }

  function renderAll(options) {
    if (!overlay || overlay.hidden) return;
    const keep = options && options.keepScroll ? body.scrollTop : 0;
    const needle = normalize(query);
    const pages = allPages();
    let found = [];
    const counts = {};

    if (needle) {
      found = findPages(pages, needle);
      found.forEach(function (group) {
        counts[group.page.id] = resultCount([group]);
      });
    }

    renderNav(counts, !!needle);

    kicker.textContent = needle ? 'Find in Help' : pageById(activePage).kicker;
    body.textContent = '';

    if (needle) {
      const total = resultCount(found);
      title.textContent = total === 1 ? '1 result' : total + ' results';
      sub.textContent = 'For “' + query + '” across shortcuts, release notes and this build.';
      if (found.length) renderResults(found); else renderEmpty();
      status.textContent = total + (total === 1 ? ' match' : ' matches') + ' · ' +
        found.length + (found.length === 1 ? ' page' : ' pages');
    } else {
      const page = pageById(activePage);
      title.textContent = page.name;
      sub.textContent = page.sub;
      renderPage(page);
      const rows = page.sections.reduce(function (total, section) { return total + section.rows.length; }, 0);
      status.textContent = page.sections.length + (page.sections.length === 1 ? ' section' : ' sections') +
        ' · ' + rows + (rows === 1 ? ' entry' : ' entries');
    }

    clearButton.hidden = !needle;
    body.scrollTop = keep;
  }

  function go(id) {
    if (!allPages().some(function (page) { return page.id === id; })) return;
    activePage = id;
    query = '';
    if (field) field.value = '';
    if (clearButton) clearButton.hidden = true;
    renderAll();
    if (title) title.focus();
  }

  // ---- opening and closing ----------------------------------------------

  function trapFocus(event) {
    const focusable = Array.prototype.filter.call(
      overlay.querySelectorAll('button:not([disabled]), input:not([disabled]), a[href]'),
      function (el) { return !el.hidden && el.offsetParent !== null; }
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !overlay.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function keydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key === 'Tab') trapFocus(event);
    // The press's bare keys (C, R, +, −, 0) must not work behind the window.
    event.stopPropagation();
  }

  function build() {
    overlay = $('help');
    field = $('help-search');
    clearButton = $('help-search-clear');
    nav = $('help-nav');
    body = $('help-body');
    kicker = $('help-kicker');
    title = $('help-title');
    sub = $('help-sub');
    status = $('help-status');
    if (!overlay || !field || !nav || !body || !title) return false;

    field.addEventListener('input', function () {
      query = field.value.trim();
      renderAll();
    });
    clearButton.addEventListener('click', function () {
      field.value = '';
      query = '';
      renderAll();
      field.focus();
    });
    $('help-close').addEventListener('click', close);
    $('help-done').addEventListener('click', close);
    const github = $('help-github');
    if (github) {
      github.addEventListener('click', function (event) {
        event.preventDefault();
        runAction({ command: 'help-profile' });
      });
    }

    // The backdrop is a click target, the window is not.
    overlay.addEventListener('pointerdown', function (event) {
      if (event.target === overlay) close();
    });
    overlay.addEventListener('keydown', keydown);
    return true;
  }

  function ensureRelease() {
    if (releasePromise) return releasePromise;
    if (!desktop || typeof desktop.whatsNew !== 'function') {
      release.state = 'error';
      release.error = 'The release notes are only available in the desktop app.';
      return null;
    }
    release.state = 'loading';
    releasePromise = desktop.whatsNew().then(function (out) {
      release.state = 'ready';
      release.version = out && out.version ? String(out.version) : '';
      release.notes = out && out.notes ? String(out.notes) : '';
    }).catch(function (err) {
      release.state = 'error';
      release.error = String(err && err.message || err);
    }).then(function () {
      // A reader on the shortcut page should not have the page rebuilt under
      // their hands when the notes finish loading; only the pages that show
      // them (or a search across every page) need the refresh.
      if (overlay && !overlay.hidden &&
          (query || activePage === 'about' || activePage === 'whats-new')) {
        renderAll({ keepScroll: true });
      }
    });
    return releasePromise;
  }

  function open(pageId) {
    if (!overlay && !build()) return false;
    if (window.DitherPalette && window.DitherPalette.isOpen && window.DitherPalette.isOpen()) {
      window.DitherPalette.close();
    }
    if (window.DitherPaletteImport && window.DitherPaletteImport.isOpen && window.DitherPaletteImport.isOpen()) {
      window.DitherPaletteImport.close();
    }
    if (pageId && allPages().some(function (page) { return page.id === pageId; })) {
      activePage = pageId;
    }

    if (overlay.hidden) {
      restoreFocus = document.activeElement;
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      query = '';
      field.value = '';
      clearButton.hidden = true;
      overlay.hidden = false;
      ensureRelease();
      renderAll();
      window.requestAnimationFrame(function () { overlay.classList.add('is-in'); });
      field.focus();
    } else {
      renderAll();
      field.focus();
    }
    return true;
  }

  function close() {
    if (!overlay || overlay.hidden) return;
    overlay.classList.remove('is-in');
    overlay.hidden = true;
    document.body.style.overflow = previousOverflow;
    if (restoreFocus && restoreFocus.focus) {
      try { restoreFocus.focus(); } catch (err) { /* the control may be gone */ }
    }
    restoreFocus = null;
  }

  function isOpen() {
    return !!overlay && !overlay.hidden;
  }

  window.DitherHelp = {
    open: open,
    close: close,
    isOpen: isOpen,
  };
}());
