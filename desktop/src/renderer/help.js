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
  let guidePromise = null;
  let captureCommand = null;

  const release = { state: 'idle', version: '', notes: '', error: '' };
  const guide = { state: 'idle', text: '', error: '' };
  const update = { state: 'idle', info: null, error: '', progress: 0 };

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

  // The reference rows and the editor share the same command names. A row
  // without an entry here is documentation for a fixed key (the bare keys,
  // the arrow steps), not something the editor can capture.
  const SHORTCUT_COMMANDS = {
    'Open an image': 'file-open',
    'Open a clip': 'file-open-clip',
    'Built-in source': 'file-demo',
    'Save the proof as PNG': 'file-save-png',
    'Copy the proof to the clipboard': 'file-copy-png',
    'Quit Dither Studio': 'file-quit',
    'Find anything': 'view-palette',
    'Zoom in': 'view-zoom-in',
    'Zoom out': 'view-zoom-out',
    'Fit the proof in the window': 'view-zoom-fit',
    'Open the guide': 'help-guide',
    'Reload the window': 'view-reload',
    'Toggle developer tools': 'view-devtools',
    'Toggle full screen': 'view-fullscreen',
    'Undo the last recipe change': 'edit-undo',
    'Redo the last recipe change': 'edit-redo',
    'Roll a fresh recipe': 'edit-random',
    'New seed': 'edit-reseed',
    'Character mode': 'image-textmode',
  };

  const SHORTCUTS = {
    id: 'shortcuts',
    group: 'Reference',
    name: 'Keyboard shortcuts',
    icon: 'shortcuts',
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
          shortcut('Open the guide', ['F1'], 'Read the full manual inside this Help window.'),
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

  function updateNote() {
    if (update.state === 'checking') return 'Checking GitHub for a newer release…';
    if (update.state === 'error') return 'The check failed: ' + (update.error || 'GitHub could not be reached.');
    if (update.state === 'installing') {
      const pct = Math.round(Math.max(0, Math.min(1, update.progress || 0)) * 100);
      return 'Downloading the update · ' + pct + '%';
    }
    if (update.info && update.info.status === 'available') {
      return 'Version ' + update.info.latest + ' is available. You have ' + update.info.current + '.';
    }
    if (update.info && update.info.status === 'current') {
      return 'Dither Studio ' + update.info.current + ' is the latest version.';
    }
    return 'Check GitHub for a newer release. The app stays offline until you ask.';
  }

  function updateRows() {
    const rows = [{ title: 'Release status', note: updateNote(), search: 'update version release github' }];
    const actions = [];
    if (update.state === 'available' || (update.info && update.info.status === 'available')) {
      actions.push({ label: 'Install and restart', command: 'help-update-install' });
    }
    if (update.state !== 'checking' && update.state !== 'installing') {
      actions.push({ label: update.state === 'idle' ? 'Check for updates' : 'Check again', command: 'help-update-check' });
    }
    rows[0].actions = actions;
    if (update.info && update.info.status === 'available' && update.info.notes) {
      rows.push({
        title: 'What is in ' + update.info.latest,
        note: update.info.notes.length > 1200 ? update.info.notes.slice(0, 1199) + '…' : update.info.notes,
        prose: true,
        plain: true,
        search: 'release notes ' + update.info.latest,
      });
    }
    return rows;
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
      icon: 'info_or_about',
      kicker: 'About this build',
      sub: 'An offline dithering press, its shared engine, and where to read more.',
      lead: '',
      sections: [
        // Updates is first because Help ▸ Check for Updates opens this page at
        // the top: the check, its progress and its result must be in view
        // without hunting through the credits below.
        { title: 'Updates', rows: updateRows() },
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
              note: 'The full manual, read inside Help and kept with the app.',
              action: { label: 'Read the guide', command: 'help-guide' },
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
      icon: 'whatsnew',
      kicker: 'Release notes',
      sub: 'The notes for the build on this computer, read from the changelog it ships with.',
      lead: lead,
      sections: sections,
    };
  }

  // The guide is Markdown on disk, but it should not open an editor on a
  // machine that has none. Parse the blocks the manual actually uses -
  // headings, paragraphs, bullets, tables and fences - into the same rows as
  // every other Help page, so it searches and scrolls with the rest.
  function cleanInline(text) {
    return String(text || '')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .trim();
  }

  function guideBlocks(text) {
    const lines = String(text || '').replace(/\r/g, '').split('\n');
    const sections = [{ title: 'The guide', rows: [] }];
    let current = sections[0];
    let lead = '';
    let paragraph = [];
    let code = null;

    function flushParagraph() {
      if (!paragraph.length) return;
      const value = cleanInline(paragraph.join(' '));
      paragraph = [];
      if (!value) return;
      current.rows.push({ title: value, prose: true, plain: true, search: value });
    }

    function flushCode() {
      if (!code) return;
      const value = code.join('\n').replace(/^\n+|\n+$/g, '');
      code = null;
      if (value) current.rows.push({ title: value, prose: true, plain: true, code: true, search: value });
    }

    lines.forEach(function (line) {
      if (code !== null) {
        if (/^```/.test(line)) flushCode();
        else code.push(line);
        return;
      }
      if (/^```/.test(line)) {
        flushParagraph();
        code = [];
        return;
      }
      if (/^#\s+/.test(line)) {
        flushParagraph();
        if (!lead) lead = cleanInline(line.replace(/^#\s+/, ''));
        return;
      }
      if (/^##\s+/.test(line)) {
        flushParagraph();
        current = { title: cleanInline(line.replace(/^##\s+/, '')), rows: [] };
        sections.push(current);
        return;
      }
      if (/^###\s+/.test(line)) {
        flushParagraph();
        const value = cleanInline(line.replace(/^###\s+/, ''));
        current.rows.push({ title: value, prose: true, plain: true, search: value });
        return;
      }
      if (!line.trim()) { flushParagraph(); return; }
      if (/^[-*]\s+/.test(line)) {
        flushParagraph();
        const value = cleanInline(line.replace(/^[-*]\s+/, ''));
        current.rows.push({ title: value, prose: true, plain: true, search: value });
        return;
      }
      if (/^\|/.test(line)) {
        flushParagraph();
        const cells = line.split('|').slice(1, -1).map(function (cell) { return cleanInline(cell); });
        if (!cells.length || cells.every(function (cell) { return /^:?-{2,}:?$/.test(cell) || !cell; })) return;
        const value = cells.filter(Boolean).join('  ·  ');
        current.rows.push({ title: value, prose: true, plain: true, search: value });
        return;
      }
      paragraph.push(line.trim());
    });
    flushCode();
    flushParagraph();
    return { lead: lead, sections: sections };
  }

  function guidePage() {
    const page = {
      id: 'guide',
      group: 'Reference',
      name: 'The guide',
      icon: 'book',
      kicker: 'Reference · Manual',
      sub: 'The full guide to the press, kept in the app so it can be read offline.',
      lead: '',
      sections: [],
    };
    if (guide.state === 'ready') {
      const parsed = guideBlocks(guide.text);
      page.lead = parsed.lead;
      page.sections = parsed.sections.filter(function (section) { return section.rows.length; });
      if (!page.sections.length) {
        page.sections = [{
          title: 'The guide',
          rows: [{ title: 'The guide has no readable sections.', prose: true, plain: true, search: 'guide empty' }],
        }];
      }
    } else if (guide.state === 'error') {
      page.lead = 'The guide could not be read from this build.';
      page.sections = [{
        title: 'The guide',
        rows: [{ title: 'The manual is missing.', note: guide.error || 'The file could not be opened.', prose: true, plain: true, search: 'guide missing error' }],
      }];
    } else {
      page.lead = 'Reading the guide that ships with this build…';
      page.sections = [{
        title: 'The guide',
        rows: [{ title: 'The manual is on its way.', note: 'It is read from GUIDE.md beside the app.', prose: true, plain: true, search: 'guide loading' }],
      }];
    }
    return page;
  }

  function allPages() {
    return [SHORTCUTS, guidePage(), whatsNewPage(), aboutPage()];
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

  function actionButton(action) {
    const button = node('button', 'btn help-action', action.label || 'Open');
    button.type = 'button';
    if (action.disabled) button.disabled = true;
    button.addEventListener('click', function () {
      if (typeof action.run === 'function') action.run();
      else runAction(action);
    });
    return button;
  }

  function appendSection(section, rows) {
    const block = node('section', 'help-section');
    block.appendChild(node('h2', '', section.title));
    (rows || section.rows).forEach(function (row) {
      const line = node('div', 'help-row' + (row.prose ? ' help-row-prose' : '') +
        (row.plain ? ' is-plain' : '') + (row.code ? ' help-row-code' : ''));
      const text = node('div', 'help-row-text');
      text.appendChild(node('div', 'help-row-title', row.title));
      if (row.note) text.appendChild(node('div', 'help-row-note', row.note));
      line.appendChild(text);

      const command = row.command || SHORTCUT_COMMANDS[row.title];
      const liveKeys = command && window.DitherShortcuts ? window.DitherShortcuts.keysFor(command) : null;
      if (row.keys || (liveKeys && liveKeys.length)) line.appendChild(keycaps(liveKeys && liveKeys.length ? liveKeys : row.keys));
      else if (row.value) line.appendChild(node('span', 'help-value', row.value));
      else if (row.action) line.appendChild(actionButton(row.action));
      if (row.actions && row.actions.length) {
        const group = node('span', 'help-actions');
        row.actions.forEach(function (action) { group.appendChild(actionButton(action)); });
        line.appendChild(group);
      }
      block.appendChild(line);
    });
    body.appendChild(block);
  }

  // ---- editing the keys ---------------------------------------------------

  function beginCapture(command) {
    captureCommand = command;
    renderAll({ keepScroll: true });
    status.textContent = 'Press the new keys. Escape cancels.';
  }

  function accelFromEvent(event) {
    const key = event.key || '';
    let normalized = '';
    if (/^[a-z]$/i.test(key)) normalized = key.toUpperCase();
    else if (/^\d$/.test(key)) normalized = key;
    else if (key === '?' || key === '/') normalized = '/';
    else if (key === '=' || key === '+') normalized = '=';
    else if (key === '-') normalized = '-';
    else if (key === ' ' || key === 'Spacebar') normalized = 'Space';
    else if (key === 'ArrowUp') normalized = 'Up';
    else if (key === 'ArrowDown') normalized = 'Down';
    else if (key === 'ArrowLeft') normalized = 'Left';
    else if (key === 'ArrowRight') normalized = 'Right';
    else if (/^F\d{1,2}$/.test(key)) normalized = key.toUpperCase();
    else return '';
    if (!event.ctrlKey && !event.metaKey && !/^F\d/.test(normalized)) return '';
    const parts = [];
    if (event.ctrlKey || event.metaKey) parts.push('CmdOrCtrl');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');
    parts.push(normalized);
    return parts.join('+');
  }

  function shortcutEditor() {
    const api = window.DitherShortcuts;
    if (!api) return null;
    const rows = api.list().map(function (item) {
      const actions = [{
        label: captureCommand === item.command ? 'Press keys…' : 'Change',
        run: function () { beginCapture(item.command); },
      }];
      if (item.changed) {
        actions.push({
          label: 'Reset',
          run: function () {
            api.reset(item.command);
            captureCommand = null;
            renderAll({ keepScroll: true });
            status.textContent = item.label + ' is back on its default key.';
          },
        });
      }
      return {
        title: item.label,
        note: captureCommand === item.command ? 'Listening for the new combination…'
          : item.changed ? 'Custom key' : 'Default key',
        keys: api.keysFor(item.command),
        command: item.command,
        actions: actions,
      };
    });
    if (!rows.length) return null;
    rows.push({
      title: 'Every shortcut',
      note: 'Put every key back on the combination this build shipped with.',
      actions: [{
        label: 'Reset all',
        run: function () {
          api.resetAll();
          captureCommand = null;
          renderAll({ keepScroll: true });
          status.textContent = 'Every shortcut is back on its default key.';
        },
      }],
    });
    return { title: 'Change the keys', rows: rows };
  }

  function navGlyph(page) {
    const box = node('span', 'help-nav-glyph');
    if (page.icon) {
      const mark = node('span', 'ui-glyph ui-glyph--sm');
      mark.style.setProperty('--ui-icon', 'url("../assets/icons/' + page.icon + '.svg")');
      mark.setAttribute('aria-hidden', 'true');
      box.appendChild(mark);
    } else {
      box.textContent = page.glyph || '';
    }
    return box;
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

      button.appendChild(navGlyph(page));
      button.appendChild(node('span', 'help-nav-name', page.name));
      if (searching) button.appendChild(node('span', 'help-nav-count', String(pageCounts[page.id] || 0)));
      button.addEventListener('click', function () { go(page.id); });
      nav.appendChild(button);
    });
  }

  function renderPage(page) {
    if (page.lead) body.appendChild(node('p', 'help-lead', page.lead));
    if (page.id === 'shortcuts') {
      const editor = shortcutEditor();
      if (editor) appendSection(editor);
    }
    page.sections.forEach(function (section) { appendSection(section); });
  }

  function renderResults(found) {
    found.forEach(function (group) {
      const head = node('div', 'help-hit-page');
      head.appendChild(navGlyph(group.page));
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
    if (captureCommand) {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') {
        captureCommand = null;
        renderAll({ keepScroll: true });
        status.textContent = 'The old shortcut was kept.';
        return;
      }
      if (event.key === 'Backspace' || event.key === 'Delete') {
        const command = captureCommand;
        captureCommand = null;
        if (window.DitherShortcuts) window.DitherShortcuts.reset(command);
        renderAll({ keepScroll: true });
        status.textContent = 'Shortcut reset to its default.';
        return;
      }
      if (event.key === 'Tab' || event.key === 'Shift' || event.key === 'Control' ||
          event.key === 'Alt' || event.key === 'Meta') return;
      const accel = accelFromEvent(event);
      if (!accel) {
        status.textContent = 'Use Ctrl or Cmd plus a key, or a function key.';
        return;
      }
      const command = captureCommand;
      const result = window.DitherShortcuts ? window.DitherShortcuts.set(command, accel) : { ok: false, error: 'Shortcuts are not available here.' };
      if (!result.ok) {
        status.textContent = result.error;
        return;
      }
      captureCommand = null;
      renderAll({ keepScroll: true });
      status.textContent = 'Shortcut updated. The menu bar carries the new key.';
      return;
    }
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
    window.addEventListener('ds:shortcuts', function () {
      if (overlay && !overlay.hidden) renderAll({ keepScroll: true });
    });
    if (desktop && typeof desktop.onUpdateProgress === 'function') {
      desktop.onUpdateProgress(function (fraction) {
        update.progress = Number(fraction) || 0;
        if (update.state !== 'installing') update.state = 'installing';
        if (overlay && !overlay.hidden && activePage === 'about') renderAll({ keepScroll: true });
      });
    }
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

  function ensureGuide() {
    if (guidePromise) return guidePromise;
    if (!desktop || typeof desktop.readGuide !== 'function') {
      guide.state = 'error';
      guide.error = 'The guide is only available in the desktop app.';
      return null;
    }
    guide.state = 'loading';
    guidePromise = desktop.readGuide().then(function (out) {
      if (out && out.text) {
        guide.state = 'ready';
        guide.text = out.text;
      } else {
        guide.state = 'error';
        guide.error = out && out.error ? out.error : 'The guide file was empty.';
      }
    }).catch(function (err) {
      guide.state = 'error';
      guide.error = String(err && err.message || err);
    }).then(function () {
      if (overlay && !overlay.hidden && (query || activePage === 'guide')) {
        renderAll({ keepScroll: true });
      }
    });
    return guidePromise;
  }

  function checkUpdates() {
    if (!desktop || typeof desktop.updateStatus !== 'function') {
      update.state = 'error';
      update.error = 'Updates are only available in the desktop app.';
      return null;
    }
    update.state = 'checking';
    update.error = '';
    update.progress = 0;
    if (overlay && !overlay.hidden && activePage === 'about') renderAll({ keepScroll: true });
    return desktop.updateStatus().then(function (info) {
      update.info = info || null;
      update.state = info && info.status === 'available' ? 'available' : 'current';
      if (overlay && !overlay.hidden && activePage === 'about') renderAll({ keepScroll: true });
      return info;
    }).catch(function (err) {
      update.state = 'error';
      update.error = String(err && err.message || err);
      if (overlay && !overlay.hidden && activePage === 'about') renderAll({ keepScroll: true });
      return { status: 'error', error: update.error };
    });
  }

  function open(pageId) {
    if (!overlay && !build()) return false;
    if (window.DitherPalette && window.DitherPalette.isOpen && window.DitherPalette.isOpen()) {
      window.DitherPalette.close();
    }
    if (window.DitherPaletteImport && window.DitherPaletteImport.isOpen && window.DitherPaletteImport.isOpen()) {
      window.DitherPaletteImport.close();
    }
    if (window.DitherFeatureMenu && window.DitherFeatureMenu.isOpen && window.DitherFeatureMenu.isOpen()) {
      window.DitherFeatureMenu.close();
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
      ensureGuide();
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
    checkUpdates: checkUpdates,
  };
}());
