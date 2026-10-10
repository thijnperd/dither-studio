/* shell.js — the desktop chrome.
 *
 * The app's behaviour lives in app.js; this file is the window around it. It
 * owns exactly four things:
 *
 *   1. the menu bar, in both places it exists — the drawn one (from menu-spec.js
 *      expanded against the app's own catalogues) and the tree handed to the
 *      main process, which is what gives the app real accelerators;
 *   2. the tool rail, the caption bar's window buttons and the document tab;
 *   3. the painting the panels cannot do themselves: the filled part of every
 *      slider, drawn from one `--fill` variable per input;
 *   4. a small set of window-level verbs (reload, dev tools, full screen, the
 *      help dialogs) that have no meaning inside the renderer.
 *
 * Every other verb is one of DS.command's names. The chrome never reaches into
 * the dithering app: it says what it wants by name and lets app.js decide what
 * that means. That is also why the two builds can share app.js unmodified.
 */
(function () {
  'use strict';

  const desktop = window.ditherDesktop;
  if (!desktop) return;                 // the web builds have their own shell
  const DS = window.DS;
  const SPEC = window.DitherMenuSpec;
  if (!DS || !SPEC) return;

  const $ = function (id) { return document.getElementById(id); };
  const isMac = desktop.platform === 'darwin';

  /* ================================================================ */
  /* the menu tree, expanded against the app's own catalogues          */
  /* ================================================================ */

  function catalogue(name) {
    const lists = DS.catalogues || {};
    if (name === 'PANELS') {
      const names = { source: 'Source', press: 'Press', tone: 'Tone', ink: 'Ink', detail: 'Detail',
        effects: 'Effects', glow: 'Glow', motion: 'Motion', type: 'Type', preset: 'Presets' };
      return DS.groups.map(function (id) { return { id: id, name: names[id] || id }; });
    }
    return lists[name] || [];
  }

  function expand(node) {
    if (node.type === 'sep') return { type: 'sep' };
    if (node.catalogue) {
      // A catalogue item inherits its parent's verb, so "Press ▸ Algorithm ▸
      // Bayer 8" is one entry per algorithm and nothing can fall out of step.
      const items = catalogue(node.catalogue).map(function (entry) {
        return {
          label: entry.name || entry.id,
          command: node.command,
          arg: entry.id,
          radio: node.radio,
          check: node.check,
        };
      });
      return { label: node.label, submenu: items };
    }
    if (node.submenu) return { label: node.label, submenu: node.submenu.map(expand) };
    return {
      label: node.label, command: node.command, arg: node.arg,
      accel: node.accel, radio: node.radio, check: node.check,
    };
  }

  const TREE = SPEC.menus.map(function (menu) {
    return { id: menu.id, label: menu.label, items: menu.items.map(expand) };
  });

  function menuById(id) {
    for (let i = 0; i < TREE.length; i++) if (TREE[i].id === id) return TREE[i];
    return null;
  }

  /* ================================================================ */
  /* what is switched on (feeds both menu bars and the title bar)       */
  /* ================================================================ */

  let appState = DS.state();

  function checkMap() {
    const s = appState;
    const map = {
      algorithm: s.algorithm, palette: s.palette, toneMap: s.toneMap,
      preset: s.preset, quality: s.quality, alphaMode: s.alphaMode,
      textRamp: s.textRamp, serpentine: s.serpentine, textMode: s.textMode,
      compare: s.compare, dock: !document.body.classList.contains('dock-hidden'),
    };
    s.openGroups.forEach(function (id) { map['panel:' + id] = true; });
    return map;
  }

  function isOn(node) {
    const map = checkMap();
    if (node.radio) return String(map[node.check]) === String(node.arg);
    if (node.check) {
      if (node.arg === undefined) return !!map[node.check];
      return !!map[node.check + ':' + node.arg];
    }
    return false;
  }

  let lastPushed = '';

  function pushToMain(force) {
    const map = checkMap();
    const signature = JSON.stringify(map);
    if (force || signature !== lastPushed) {
      lastPushed = signature;
      desktop.sendState(map);
    }
    if (force) desktop.sendMenu(TREE);
  }

  /* ================================================================ */
  /* the drawn menu bar                                               */
  /* ================================================================ */

  const pop = $('menu-pop');
  if (pop) pop.__level = 0;   // the drop-down itself; submenus count up from it
  let subMenus = [];
  let openId = null;

  function accelText(accel) {
    if (!accel) return '';
    let out = accel;
    if (isMac) {
      out = out.replace(/CmdOrCtrl|Cmd/g, '⌘').replace(/Ctrl/g, '⌃')
        .replace(/Shift/g, '⇧').replace(/Alt/g, '⌥').replace(/\+/g, '');
    } else {
      out = out.replace(/CmdOrCtrl|Cmd/g, 'Ctrl');
    }
    return out;
  }

  // A submenu always opens from an item inside a box, so the open submenus form a
  // chain: the drop-down at level 0, its submenus at 1, theirs at 2. Closing is
  // therefore relative to where the pointer is, not all-or-nothing — hovering a
  // leaf must close the submenus deeper than the box that leaf stands in, and
  // never the box it is standing in, or the item under the cursor deletes itself.
  function closeSubMenusFrom(level) {
    subMenus = subMenus.filter(function (node) {
      if ((node.__level || 1) > level) { node.remove(); return false; }
      return true;
    });
  }

  function closeSubMenus() {
    closeSubMenusFrom(0);
  }

  function closeMenus() {
    closeSubMenus();
    if (pop) { pop.hidden = true; pop.textContent = ''; }
    Array.prototype.forEach.call(document.querySelectorAll('.menu.is-open'), function (button) {
      button.classList.remove('is-open');
      button.setAttribute('aria-expanded', 'false');
    });
    openId = null;
  }

  function place(box, rect, side) {
    box.hidden = false;
    const width = box.offsetWidth;
    const height = box.offsetHeight;
    let left = side === 'right' ? rect.right - 4 : rect.left;
    let top = side === 'right' ? rect.top - 5 : rect.bottom;
    if (left + width > window.innerWidth - 6) left = Math.max(6, window.innerWidth - width - 6);
    if (top + height > window.innerHeight - 6) top = Math.max(6, window.innerHeight - height - 6);
    box.style.left = Math.round(left) + 'px';
    box.style.top = Math.round(top) + 'px';
  }

  function drawInto(box, items, anchor, side) {
    box.textContent = '';
    items.forEach(function (node) {
      if (node.type === 'sep') {
        const line = document.createElement('div');
        line.className = 'menu-sep';
        box.appendChild(line);
        return;
      }
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'menu-item';
      item.setAttribute('role', 'menuitem');
      const label = document.createElement('span');
      label.textContent = node.label;
      item.appendChild(label);

      if (node.submenu) {
        const arrow = document.createElement('span');
        arrow.className = 'menu-accel';
        arrow.textContent = '▶';
        item.appendChild(arrow);
        item.setAttribute('aria-haspopup', 'true');
        const level = box.__level || 0;
        item.addEventListener('mouseenter', function () { openSubMenu(item, node.submenu, level); });
        item.addEventListener('click', function (event) {
          event.stopPropagation();
          openSubMenu(item, node.submenu, level);
        });
      } else {
        if (node.accel) {
          const keys = document.createElement('span');
          keys.className = 'menu-accel';
          keys.textContent = accelText(node.accel);
          item.appendChild(keys);
        }
        item.addEventListener('mouseenter', function () { closeSubMenusFrom(box.__level || 0); });
        item.addEventListener('click', function () {
          closeMenus();
          run(node.command, node.arg);
        });
      }

      if (isOn(node)) item.classList.add('is-on');
      box.appendChild(item);
    });
    place(box, anchor.getBoundingClientRect(), side || 'below');
  }

  function openSubMenu(item, items, level) {
    const from = level || 0;
    closeSubMenusFrom(from);
    const box = document.createElement('div');
    box.className = 'menu-pop is-sub';
    box.__level = from + 1;
    document.body.appendChild(box);
    subMenus.push(box);
    drawInto(box, items, item, 'right');
  }

  function openMenu(button) {
    const menu = menuById(button.getAttribute('data-menu'));
    if (!menu) return;
    const wasOpen = openId === menu.id;
    closeMenus();
    if (wasOpen) return;
    openId = menu.id;
    button.classList.add('is-open');
    button.setAttribute('aria-expanded', 'true');
    drawInto(pop, menu.items, button, 'below');
    const first = pop.querySelector('.menu-item');
    if (first) first.focus();
    pushToMain(false);
  }

  Array.prototype.forEach.call(document.querySelectorAll('.menu'), function (button) {
    button.setAttribute('aria-haspopup', 'true');
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('click', function (event) {
      event.stopPropagation();
      openMenu(button);
    });
    // Once a menu is open, sliding along the bar switches menus: the way a
    // desktop menu bar behaves, and the reason this cannot be a click-only menu.
    button.addEventListener('mouseenter', function () { if (openId) openMenu(button); });
  });

  document.addEventListener('click', function (event) {
    // Every popup, the drop-down and any submenu under it.
    if (event.target.closest && event.target.closest('.menu-pop')) return;
    if (event.target.closest && event.target.closest('.menu')) return;
    closeMenus();
  });

  // The left and right arrows walk the bar, wrapping in both directions.
  function stepMenu(delta) {
    const from = TREE.findIndex(function (menu) { return menu.id === openId; });
    const next = TREE[(from + delta + TREE.length) % TREE.length];
    const button = document.querySelector('.menu[data-menu="' + next.id + '"]');
    if (!button) return false;
    openMenu(button);
    return true;
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') { closeMenus(); return; }
    if (!openId) {
      // Alt plus the underlined letter opens a menu, as everywhere else.
      if (event.altKey && !event.ctrlKey && !event.metaKey) {
        const letter = String(event.key || '').toLowerCase();
        const button = Array.prototype.find.call(document.querySelectorAll('.menu'), function (node) {
          return node.textContent.toLowerCase().charAt(0) === letter;
        });
        if (button) {
          event.preventDefault();
          openMenu(button);
        }
      }
      return;
    }
    const items = Array.prototype.filter.call(pop.querySelectorAll('.menu-item'), function (node) {
      return !node.disabled;
    });
    if (!items.length) return;
    const index = items.indexOf(document.activeElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      items[(index + 1 + items.length) % items.length].focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      items[(index - 1 + items.length) % items.length].focus();
    } else if (event.key === 'ArrowRight') {
      if (stepMenu(1)) event.preventDefault();
    } else if (event.key === 'ArrowLeft') {
      if (stepMenu(-1)) event.preventDefault();
    }
  });

  /* ================================================================ */
  /* accelerators                                                      */
  /* ================================================================ */

  // The main process registers the same menu with Electron, which is what gives
  // macOS a real menu bar. On Windows and Linux a frameless window has no menu
  // bar to own the accelerator table — the smoke harness proves it: a Ctrl+S sent
  // through the window never reached the app — so the chrome binds the keys
  // itself. Binding them on macOS as well would run every command twice.
  // Both a menu accelerator and a real key become the same string: modifiers in
  // one fixed order, then the key. `CmdOrCtrl+Shift+R` and Ctrl+Shift+R therefore
  // both read `ctrl+shift+r`, which is also what the smoke run asserts against.
  function signature(parts) {
    const order = ['ctrl', 'alt', 'shift'];
    const mods = order.filter(function (name) { return parts.indexOf(name) > -1; });
    const keys = parts.filter(function (part) { return order.indexOf(part) === -1; });
    return mods.concat(keys).join('+');
  }

  function accelSignature(accel) {
    const aliases = { up: 'arrowup', down: 'arrowdown', left: 'arrowleft', right: 'arrowright' };
    return signature(String(accel).split('+').map(function (part) {
      const lower = part.trim().toLowerCase();
      if (lower === 'cmdorctrl' || lower === 'ctrl' || lower === 'cmd' || lower === 'command') return 'ctrl';
      return aliases[lower] || lower;
    }));
  }

  function keySignature(event) {
    const parts = [];
    if (event.ctrlKey || event.metaKey) parts.push('ctrl');
    if (event.altKey) parts.push('alt');
    if (event.shiftKey) parts.push('shift');
    parts.push(String(event.key || '').toLowerCase());
    return signature(parts);
  }

  const ACCELERATORS = {};

  (function collect(items) {
    items.forEach(function (item) {
      if (item.submenu) { collect(item.submenu); return; }
      if (item.accel) ACCELERATORS[accelSignature(item.accel)] = { name: item.command, arg: item.arg };
    });
  }(TREE.map(function (menu) { return menu.items; }).reduce(function (all, items) { return all.concat(items); }, [])));

  // What the window actually received, so the smoke run can tell "the key never
  // arrived" apart from "the key arrived and matched nothing".
  const keyLog = [];
  let acceleratorFires = 0;

  if (!isMac) {
    document.addEventListener('keydown', function (event) {
      const signature = keySignature(event);
      const hit = ACCELERATORS[signature];
      if (keyLog.length < 24) keyLog.push(signature + (hit ? ' -> ' + hit.name : ' (no match)'));
      if (!hit) return;
      // Alt plus a letter belongs to the menu bar, not to an accelerator.
      if (event.altKey && !event.ctrlKey) return;
      event.preventDefault();
      event.stopPropagation();
      acceleratorFires += 1;
      run(hit.name, hit.arg);
    }, true);
  }

  /* ================================================================ */
  /* verbs that only exist because there is a window                   */
  /* ================================================================ */

  const SHELL_COMMANDS = {
    'view-reload': function () { desktop.win.reload(); },
    'view-devtools': function () { desktop.win.toggleDevTools(); },
    'view-fullscreen': function () { desktop.win.toggleFullScreen(); },
    'view-dock': function () {
      const hidden = document.body.classList.toggle('dock-hidden');
      note(hidden ? 'Panels hidden' : 'Panels back');
      refresh();
    },
    'help-guide': function () {
      desktop.openGuide().then(function (out) {
        note(out && out.error ? out.error : 'The guide opened in your editor');
      });
    },
    'help-shortcuts': function () { desktop.shortcuts(); },
    'help-about': function () { desktop.about(); },
    'help-sources': function () {
      desktop.openExternal('https://github.com/thijnperd/dither-studio/blob/main/SOURCES.md');
    },
    'help-repo': function () {
      desktop.openExternal('https://github.com/thijnperd/dither-studio');
    },
  };

  function run(name, arg) {
    if (!name) return false;
    if (SHELL_COMMANDS[name]) { SHELL_COMMANDS[name](arg); return true; }
    return DS.command(name, arg);
  }

  /* ================================================================ */
  /* the caption bar                                                   */
  /* ================================================================ */

  const tbNote = $('tb-note');
  let noteTimer = 0;

  function note(text) {
    if (!tbNote) return;
    tbNote.textContent = text || '';
    tbNote.title = text || '';
    clearTimeout(noteTimer);
    if (text) noteTimer = setTimeout(function () { tbNote.textContent = ''; }, 6000);
  }

  function syncTitle() {
    const s = appState;
    const doc = $('tb-doc');
    const name = $('doc-name');
    const meta = $('doc-meta');
    if (doc) doc.textContent = s.name + (s.savedPath ? '  ·  saved' : '');
    if (name) name.textContent = s.name;
    if (meta) meta.textContent = s.width + ' × ' + s.height + ' @ ' + ($('stat-zoom') ? $('stat-zoom').textContent : 'Fit');
    document.title = s.name + ' — Dither Studio';
  }

  ['win-min', 'win-max', 'win-close'].forEach(function (id, index) {
    const button = $(id);
    if (!button) return;
    button.addEventListener('click', function () {
      if (index === 0) desktop.win.minimize();
      else if (index === 1) desktop.win.toggleMaximize();
      else desktop.win.close();
    });
  });

  if ($('sysmark')) {
    $('sysmark').addEventListener('click', function (event) {
      event.stopPropagation();
      const file = document.querySelector('.menu[data-menu="file"]');
      if (file) openMenu(file);
    });
  }

  desktop.onWindowState(function (state) {
    document.body.classList.toggle('is-maximized', !!state.maximized);
  });

  desktop.onCommand(function (name, arg) { run(name, arg); });

  desktop.onStatus(function (message) { note(message); });

  let savedCount = 0;

  window.addEventListener('ds:saved', function (event) {
    savedCount += 1;
    const detail = event.detail || {};
    note('Saved ' + (detail.name || detail.path || 'the proof') + ' — click here to show it in its folder');
    if (detail.path && tbNote) {
      tbNote.title = detail.path + ' — click to show it in its folder';
      tbNote.dataset.path = detail.path;
    }
    syncTitle();
  });

  // The receipt in the caption is also the shortcut to the file itself.
  if (tbNote) {
    tbNote.addEventListener('click', function () {
      const target = tbNote.dataset.path;
      if (!target) return;
      desktop.reveal(target);
      note('Showing ' + target);
    });
  }

  /* ================================================================ */
  /* the tool rail                                                     */
  /* ================================================================ */

  const TOOLS = {
    open: function () { run('file-open'); },
    demo: function () { run('file-demo'); },
    random: function () { run('edit-random'); },
    webcam: function () { if ($('video-webcam')) $('video-webcam').click(); },
    video: function () { run('file-open-clip'); },
    record: function () { if ($('video-record')) $('video-record').click(); },
    preset: function () { run('window-panel', 'preset'); },
  };

  function markTool(name, on) {
    const button = document.querySelector('.tool[data-tool="' + name + '"]');
    if (button) button.classList.toggle('is-active', !!on);
  }

  Array.prototype.forEach.call(document.querySelectorAll('.tool'), function (button) {
    const name = button.getAttribute('data-tool');
    if (name === 'compare') {
      // Compare is a hold, exactly like the key: press to see the source.
      button.addEventListener('pointerdown', function (event) {
        event.preventDefault();
        run('view-compare', true);
        button.classList.add('is-active');
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (type) {
        button.addEventListener(type, function () {
          run('view-compare', false);
          button.classList.remove('is-active');
        });
      });
      return;
    }
    button.addEventListener('click', function () { if (TOOLS[name]) TOOLS[name](); });
  });

  /* ================================================================ */
  /* drop veil, recording pulse, slider fills                          */
  /* ================================================================ */

  const veil = $('drop-veil');
  const well = $('canvas-wrap');

  if (well && veil) {
    ['dragenter', 'dragover'].forEach(function (type) {
      well.addEventListener(type, function () { veil.hidden = false; });
    });
    ['dragleave', 'drop'].forEach(function (type) {
      well.addEventListener(type, function () { veil.hidden = true; });
    });
  }

  // The REC state is the one thing the app has no UI event for (a recording
  // runs between two syncs), so the chrome polls it gently — twice a second,
  // reading one small object, adding or removing one class.
  setInterval(function () {
    const api = window.__dither;
    const stats = api && api.videoStats ? api.videoStats() : null;
    const recording = !!(stats && stats.recording);
    const tool = document.querySelector('.tool[data-tool="record"]');
    if (tool) tool.classList.toggle('is-recording', recording);
    if (tbNote && recording) note('Recording the playback…');
  }, 500);

  // A slider draws its filled track from --fill, and the boot and every input
  // event want the same percentage, so it is worked out in one place.
  function fillPercent(range) {
    const min = parseFloat(range.min || '0');
    const max = parseFloat(range.max || '100');
    const value = parseFloat(range.value || '0');
    const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
    return pct.toFixed(2) + '%';
  }

  // A slider shows how much of its track is travelled. Every range in the app
  // gets it, including the ones the effects stack builds later.
  function paintRanges() {
    const ranges = document.querySelectorAll('input[type="range"]');
    for (let i = 0; i < ranges.length; i++) {
      ranges[i].style.setProperty('--fill', fillPercent(ranges[i]));
    }
  }

  // What any change to the app ends with: the slider fills, the caption, and the
  // menu ticks. The boot, the ds:ui event and the dock toggle all want exactly
  // this, so it is written once and called three times.
  function refresh() {
    paintRanges();
    appState = DS.state();
    syncTitle();
    pushToMain(false);
  }

  document.addEventListener('input', function (event) {
    const target = event.target;
    if (!target || target.type !== 'range') return;
    target.style.setProperty('--fill', fillPercent(target));
  });

  // One event from app.js drives everything above.
  window.addEventListener('ds:ui', function () {
    refresh();
  });

  // The effects stack is rebuilt on every sync, so re-read it just after the
  // click that changed it rather than polling for new rows.
  document.addEventListener('click', function (event) {
    const target = event.target;
    if (target && target.closest && target.closest('.group, .tool, .obtn')) {
      setTimeout(paintRanges, 0);
    }
  });

  window.addEventListener('resize', paintRanges);

  /* ================================================================ */
  /* boot                                                             */
  /* ================================================================ */

  refresh();
  window.__shell = {
    accelerators: Object.keys(ACCELERATORS),
    tools: Object.keys(TOOLS),
    menus: TREE.map(function (menu) { return menu.id + ':' + menu.items.length; }),
    keyLog: keyLog,
    acceleratorFires: function () { return acceleratorFires; },
    savedCount: function () { return savedCount; },
    run: run,
  };
  // Hand main the finished tree (the native menu and its accelerators) and the
  // first set of ticks. Only now is the app ready, splash included: the window is
  // not finished until its menu bar and its caption carry real values.
  pushToMain(true);
  if (desktop.ready) desktop.ready();
  setTimeout(refresh, 300);
}());
