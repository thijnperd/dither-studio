/* shell.js - the desktop chrome.
 *
 * The app's behaviour lives in app.js; this file is the window around it. It
 * owns exactly four things:
 *
 *   1. the menu bar, in both places it exists - the drawn one (from
 *      menu-spec.js, expanded against the app's own catalogues) and the tree
 *      handed to the main process, which gives the app real accelerators;
 *   2. the tool rail, the caption bar's window buttons and the document tab;
 *   3. the painting the panels cannot do themselves: the filled part of every
 *      slider, drawn from one `--fill` variable per input;
 *   4. window-level verbs (reload, dev tools, full screen, the help dialogs)
 *      that have no meaning inside the renderer.
 *
 * Every other verb is one of DS.command's names: the chrome says what it
 * wants by name and lets app.js decide what that means.
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

  // ---- the menu tree, expanded against the app's own catalogues ----

  function catalogue(name) {
    const lists = DS.catalogues || {};
    if (name === 'PANELS') {
      const names = { learn: 'Learn', source: 'Source', press: 'Press', tone: 'Tone', ink: 'Ink', detail: 'Detail',
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
      accel: node.accel, accelDisplay: node.accelDisplay, radio: node.radio, check: node.check,
    };
  }

  function buildTree() {
    return SPEC.menus.map(function (menu) {
      return { id: menu.id, label: menu.label, items: menu.items.map(expand) };
    });
  }

  // The catalogue is normally fixed, but an imported palette joins the Press
  // menu at runtime. Rebuilding the one tree keeps the drawn bar and the native
  // menu in step without teaching either one about imports.
  // ---- editable shortcuts ----

  // The menu is still the one definition; this layer only swaps an accelerator
  // for a command the user changed. Defaults are kept beside it so Reset and
  // the Help editor always know what "the key it shipped with" means.
  const SHORTCUT_STORE = 'dither-studio.shortcuts';
  const SHORTCUT_EDITABLE = [
    'file-open', 'file-open-clip', 'file-demo', 'file-save-png', 'file-copy-png', 'file-quit',
    'edit-undo', 'edit-redo', 'edit-random', 'edit-reseed',
    'image-textmode',
    'view-palette', 'view-feature-menu', 'view-zoom-in', 'view-zoom-out', 'view-zoom-fit',
    'view-reload', 'view-devtools', 'view-fullscreen',
    'help-guide', 'help-shortcuts',
  ];

  const SHORTCUT_DEFAULTS = {};
  (function collectDefaults(items) {
    items.forEach(function (node) {
      if (node.submenu) return collectDefaults(node.submenu);
      if (node.command && node.accel) SHORTCUT_DEFAULTS[node.command] = node.accel;
    });
  }(buildTree().reduce(function (all, menu) { return all.concat(menu.items); }, [])));

  function readShortcutOverrides() {
    const out = {};
    try {
      const raw = window.localStorage.getItem(SHORTCUT_STORE);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object') {
        Object.keys(parsed).forEach(function (command) {
          if (SHORTCUT_EDITABLE.indexOf(command) >= 0 && typeof parsed[command] === 'string' && parsed[command].trim()) {
            out[command] = parsed[command].trim();
          }
        });
      }
    } catch (err) { /* a first run, private mode, or a broken entry: use defaults */ }
    return out;
  }

  let shortcutOverrides = readShortcutOverrides();

  function applyShortcutOverrides(items) {
    items.forEach(function (node) {
      if (node.submenu) { applyShortcutOverrides(node.submenu); return; }
      if (node.command && shortcutOverrides[node.command]) {
        node.accel = shortcutOverrides[node.command];
        node.accelDisplay = '';
      }
    });
  }

  function makeTree() {
    const tree = buildTree();
    tree.forEach(function (menu) { applyShortcutOverrides(menu.items); });
    return tree;
  }

  let TREE = makeTree();

  function shortcutEntries() {
    const out = [];
    TREE.forEach(function (menu) {
      (function walk(items) {
        items.forEach(function (node) {
          if (node.submenu) { walk(node.submenu); return; }
          if (!node.command || !node.accel || SHORTCUT_EDITABLE.indexOf(node.command) < 0) return;
          out.push({
            command: node.command,
            label: node.label,
            accel: node.accel,
            defaultAccel: SHORTCUT_DEFAULTS[node.command] || node.accel,
            changed: !!shortcutOverrides[node.command],
          });
        });
      }(menu.items));
    });
    return out;
  }

  function shortcutConflict(command, accel) {
    const signature = accelSignature(accel);
    let conflict = null;
    TREE.forEach(function (menu) {
      (function walk(items) {
        items.forEach(function (node) {
          if (conflict) return;
          if (node.submenu) { walk(node.submenu); return; }
          if (node.command && node.command !== command && node.accel &&
              accelSignature(node.accel) === signature) conflict = node.label;
        });
      }(menu.items));
    });
    return conflict;
  }

  function saveShortcutOverrides() {
    try { window.localStorage.setItem(SHORTCUT_STORE, JSON.stringify(shortcutOverrides)); }
    catch (err) { /* the current session still uses them */ }
  }

  function rebuildShortcutMenus() {
    TREE = makeTree();
    rebuildAccelerators();
    lastPushed = '';
    pushToMain(true);
    window.dispatchEvent(new Event('ds:shortcuts'));
  }

  function setShortcut(command, accel) {
    const value = String(accel || '').trim();
    if (!SHORTCUT_DEFAULTS[command]) return { ok: false, error: 'That command has no shortcut to change.' };
    if (!value) return { ok: false, error: 'Press a key combination first.' };
    if (!/(CmdOrCtrl|Ctrl|Cmd)/i.test(value) && !/^F\d{1,2}$/i.test(value)) {
      return { ok: false, error: 'Include Ctrl or Cmd in the shortcut.' };
    }
    const conflict = shortcutConflict(command, value);
    if (conflict) return { ok: false, error: 'That key already runs ' + conflict + '.' };
    if (accelSignature(value) === accelSignature(SHORTCUT_DEFAULTS[command])) delete shortcutOverrides[command];
    else shortcutOverrides[command] = value;
    saveShortcutOverrides();
    rebuildShortcutMenus();
    return { ok: true };
  }

  function resetShortcut(command) {
    if (!shortcutOverrides[command]) return { ok: true };
    delete shortcutOverrides[command];
    saveShortcutOverrides();
    rebuildShortcutMenus();
    return { ok: true };
  }

  function resetAllShortcuts() {
    shortcutOverrides = {};
    saveShortcutOverrides();
    rebuildShortcutMenus();
    return { ok: true };
  }

  function keysFor(command) {
    const entry = shortcutEntries().find(function (item) { return item.command === command; });
    const accel = entry ? entry.accel : SHORTCUT_DEFAULTS[command];
    if (!accel) return [];
    return String(accel).split('+').map(function (part) {
      if (part === 'CmdOrCtrl' || part === 'Cmd' || part === 'Command') return 'Ctrl';
      if (part === 'Ctrl') return 'Ctrl';
      return part;
    });
  }

  window.DitherShortcuts = {
    list: shortcutEntries,
    set: setShortcut,
    reset: resetShortcut,
    resetAll: resetAllShortcuts,
    keysFor: keysFor,
    accelFor: function (command) {
      const entry = shortcutEntries().find(function (item) { return item.command === command; });
      return entry ? entry.accel : (SHORTCUT_DEFAULTS[command] || '');
    },
  };

  function menuById(id) {
    for (let i = 0; i < TREE.length; i++) if (TREE[i].id === id) return TREE[i];
    return null;
  }

  // ---- what is switched on (feeds both menu bars and the title bar) ----

  let appState = DS.state();

  function checkMap() {
    const s = appState;
    const map = {
      algorithm: s.algorithm, palette: s.palette, toneMap: s.toneMap,
      preset: s.preset, quality: s.quality, alphaMode: s.alphaMode,
      textRamp: s.textRamp, serpentine: s.serpentine, textMode: s.textMode,
      compare: s.compare, split: s.split, dock: !document.body.classList.contains('dock-hidden'),
      learnVisible: !(window.DitherTour && window.DitherTour.hidden && window.DitherTour.hidden()),
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

  window.addEventListener('ds:catalogues', function () {
    TREE = buildTree();
    lastPushed = '';
    if (window.__shell) {
      window.__shell.menus = TREE.map(function (menu) { return menu.id + ':' + menu.items.length; });
    }
    pushToMain(true);
  });

  // ---- the drawn menu bar ----

  const pop = $('menu-pop');
  if (pop) pop.__level = 0;   // the drop-down itself; submenus count up from it
  const menuButtons = Array.prototype.slice.call(document.querySelectorAll('.menubar .menu'));
  let subMenus = [];
  let openId = null;

  function setMenuRoving(target) {
    if (!target || menuButtons.indexOf(target) < 0) return;
    menuButtons.forEach(function (btn) {
      btn.tabIndex = btn === target ? 0 : -1;
    });
  }

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

  // A submenu always opens from an item inside a box, so the open submenus
  // form a chain: the drop-down at level 0, its submenus at 1, theirs at 2.
  // Closing is therefore relative to where the pointer is: hovering a leaf
  // must close the submenus deeper than the box that leaf stands in, never the
  // box itself, or the item under the cursor deletes itself.
  function closeSubMenusFrom(level) {
    subMenus = subMenus.filter(function (node) {
      if ((node.__level || 1) > level) {
        if (node.__owner) node.__owner.setAttribute('aria-expanded', 'false');
        node.remove();
        return false;
      }
      return true;
    });
  }

  function closeSubMenus() {
    closeSubMenusFrom(0);
  }

  function closeMenus(restoreTrigger) {
    const activeTrigger = openId ? document.querySelector('.menu[data-menu="' + openId + '"]') : null;
    closeSubMenus();
    if (pop) { pop.hidden = true; pop.textContent = ''; }
    menuButtons.forEach(function (button) {
      button.classList.remove('is-open');
      button.setAttribute('aria-expanded', 'false');
    });
    openId = null;
    if (restoreTrigger && activeTrigger) {
      setMenuRoving(activeTrigger);
      activeTrigger.focus();
    }
  }

  function place(box, rect, side) {
    box.hidden = false;
    const width = box.offsetWidth;
    const height = box.offsetHeight;
    let left = side === 'right' ? rect.right - 4 : rect.left;
    let top = side === 'right' ? rect.top - 5 : rect.bottom;
    if (side === 'right' && left + width > window.innerWidth - 6) {
      left = Math.max(6, rect.left - width + 4);
    } else if (left + width > window.innerWidth - 6) {
      left = Math.max(6, window.innerWidth - width - 6);
    }
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
        line.setAttribute('role', 'separator');
        box.appendChild(line);
        return;
      }
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'menu-item';
      const checked = isOn(node);
      if (node.radio) {
        item.setAttribute('role', 'menuitemradio');
        item.setAttribute('aria-checked', checked ? 'true' : 'false');
      } else if (node.check) {
        item.setAttribute('role', 'menuitemcheckbox');
        item.setAttribute('aria-checked', checked ? 'true' : 'false');
      } else {
        item.setAttribute('role', 'menuitem');
      }
      const label = document.createElement('span');
      label.textContent = node.label;
      item.appendChild(label);

      if (node.submenu) {
        const arrow = document.createElement('span');
        arrow.className = 'menu-accel menu-arrow';
        const arrowGlyph = document.createElement('span');
        arrowGlyph.className = 'ui-glyph ui-glyph--xs';
        arrowGlyph.style.setProperty('--ui-icon', 'url("../assets/icons/chevron-right.svg")');
        arrowGlyph.setAttribute('aria-hidden', 'true');
        arrow.appendChild(arrowGlyph);
        item.appendChild(arrow);
        item.setAttribute('aria-haspopup', 'menu');
        item.setAttribute('aria-expanded', 'false');
        const level = box.__level || 0;
        item.__submenu = node.submenu;
        item.__level = level;
        item.addEventListener('mouseenter', function () { openSubMenu(item, node.submenu, level, false); });
        item.addEventListener('click', function (event) {
          event.stopPropagation();
          openSubMenu(item, node.submenu, level, true);
        });
      } else {
        if (node.accel) {
          const keys = document.createElement('span');
          keys.className = 'menu-accel';
          keys.textContent = accelText(node.accelDisplay || node.accel);
          item.appendChild(keys);
        }
        item.addEventListener('mouseenter', function () { closeSubMenusFrom(box.__level || 0); });
        item.addEventListener('click', function () {
          closeMenus(false);
          run(node.command, node.arg);
        });
      }

      if (checked) item.classList.add('is-on');
      box.appendChild(item);
    });
    place(box, anchor.getBoundingClientRect(), side || 'below');
  }

  function openSubMenu(item, items, level, focusFirst) {
    const from = level || 0;
    closeSubMenusFrom(from);
    const box = document.createElement('div');
    box.className = 'menu-pop is-sub';
    box.setAttribute('role', 'menu');
    box.__level = from + 1;
    box.__owner = item;
    item.setAttribute('aria-expanded', 'true');
    document.body.appendChild(box);
    subMenus.push(box);
    drawInto(box, items, item, 'right');
    if (focusFirst) {
      const first = box.querySelector('.menu-item:not([disabled])');
      if (first) first.focus();
    }
    return box;
  }

  function openMenu(button) {
    const menu = menuById(button.getAttribute('data-menu'));
    if (!menu) return;
    const wasOpen = openId === menu.id;
    closeMenus(false);
    setMenuRoving(button);
    if (wasOpen) return;
    openId = menu.id;
    button.classList.add('is-open');
    button.setAttribute('aria-expanded', 'true');
    drawInto(pop, menu.items, button, 'below');
    const first = pop.querySelector('.menu-item:not([disabled])');
    if (first) first.focus();
    pushToMain(false);
  }

  menuButtons.forEach(function (button, index) {
    button.setAttribute('aria-haspopup', 'menu');
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('click', function (event) {
      event.stopPropagation();
      openMenu(button);
    });
    button.addEventListener('focus', function () {
      setMenuRoving(button);
    });
    button.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        const next = menuButtons[(index + 1) % menuButtons.length];
        setMenuRoving(next);
        if (openId) openMenu(next);
        else next.focus();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        const prev = menuButtons[(index - 1 + menuButtons.length) % menuButtons.length];
        setMenuRoving(prev);
        if (openId) openMenu(prev);
        else prev.focus();
      } else if (event.key === 'ArrowDown' || event.key === 'Home') {
        event.preventDefault();
        if (openId !== button.getAttribute('data-menu')) openMenu(button);
        else {
          const first = pop && pop.querySelector('.menu-item:not([disabled])');
          if (first) first.focus();
        }
      } else if (event.key === 'End') {
        event.preventDefault();
        if (openId !== button.getAttribute('data-menu')) openMenu(button);
        const list = pop ? pop.querySelectorAll('.menu-item:not([disabled])') : [];
        if (list.length) list[list.length - 1].focus();
      }
    });
    // Once a menu is open, sliding along the bar switches menus: the way a
    // desktop menu bar behaves, and the reason this cannot be a click-only menu.
    button.addEventListener('mouseenter', function () { if (openId) openMenu(button); });
  });

  document.addEventListener('click', function (event) {
    // Every popup, the drop-down and any submenu under it.
    if (event.target.closest && event.target.closest('.menu-pop')) return;
    if (event.target.closest && event.target.closest('.menu')) return;
    closeMenus(false);
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
    if (event.key === 'Escape') {
      if (subMenus.length) {
        event.preventDefault();
        const deepest = subMenus[subMenus.length - 1];
        const owner = deepest && deepest.__owner;
        closeSubMenusFrom((deepest.__level || 1) - 1);
        if (owner && owner.focus) owner.focus();
        return;
      }
      if (openId) {
        event.preventDefault();
        closeMenus(true);
      }
      return;
    }
    if (!openId) {
      // Alt plus the underlined letter opens a menu, as everywhere else.
      if (event.altKey && !event.ctrlKey && !event.metaKey) {
        if (window.DitherModal && window.DitherModal.anyOpen()) return;
        const letter = String(event.key || '').toLowerCase();
        const button = menuButtons.find(function (node) {
          return node.textContent.toLowerCase().charAt(0) === letter;
        });
        if (button) {
          event.preventDefault();
          openMenu(button);
        }
      }
      return;
    }
    if (event.key === 'Tab') {
      closeMenus(false);
      return;
    }
    const activeBox = (document.activeElement && document.activeElement.closest &&
      document.activeElement.closest('.menu-pop')) || (subMenus.length ? subMenus[subMenus.length - 1] : pop);
    const items = activeBox ? Array.prototype.filter.call(activeBox.querySelectorAll('.menu-item'), function (node) {
      return !node.disabled;
    }) : [];
    if (!items.length) return;
    const index = items.indexOf(document.activeElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      items[(index + 1 + items.length) % items.length].focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      items[(index - 1 + items.length) % items.length].focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      items[0].focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      items[items.length - 1].focus();
    } else if (event.key === 'ArrowRight') {
      const current = document.activeElement;
      if (current && current.__submenu) {
        event.preventDefault();
        openSubMenu(current, current.__submenu, current.__level || 0, true);
      } else if (stepMenu(1)) {
        event.preventDefault();
      }
    } else if (event.key === 'ArrowLeft') {
      if (activeBox && activeBox.__level > 0) {
        event.preventDefault();
        const owner = activeBox.__owner;
        closeSubMenusFrom(activeBox.__level - 1);
        if (owner && owner.focus) owner.focus();
      } else if (stepMenu(-1)) {
        event.preventDefault();
      }
    }
  });

  // ---- accelerators ----

  // The main process registers the same menu with Electron, which gives macOS
  // a real menu bar. On Windows and Linux a frameless window has no menu bar
  // to own the accelerator table (the smoke harness proved it: a Ctrl+S sent
  // through the window never reached the app), so the chrome binds the keys
  // itself; binding them on macOS as well would run every command twice. Both
  // a menu accelerator and a real key become the same string (modifiers in a
  // fixed order, then the key), so `CmdOrCtrl+Shift+R` and Ctrl+Shift+R both
  // read `ctrl+shift+r`, which is what the smoke run asserts against.
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
    // Ctrl/Cmd+? is the Help shortcut. `?` is Shift+/ on the layouts this app
    // ships for, so give both spellings the same signature.
    const key = String(event.key || '').toLowerCase();
    parts.push(key === '?' ? '/' : key);
    return signature(parts);
  }

  let ACCELERATORS = {};

  function rebuildAccelerators() {
    ACCELERATORS = {};
    (function collect(items) {
      items.forEach(function (item) {
        if (item.submenu) { collect(item.submenu); return; }
        if (item.accel) ACCELERATORS[accelSignature(item.accel)] = { name: item.command, arg: item.arg };
      });
    }(TREE.map(function (menu) { return menu.items; }).reduce(function (all, items) { return all.concat(items); }, [])));
    if (window.__shell) window.__shell.accelerators = Object.keys(ACCELERATORS);
  }

  rebuildAccelerators();

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
      // A modal owns the keyboard while it is open. Ctrl+K and Ctrl+Shift+M
      // are the two global surfaces that can still open cleanly.
      const modal = (window.DitherModal && window.DitherModal.anyOpen()) ||
        (window.DitherHelp && window.DitherHelp.isOpen()) ||
        (window.DitherPalette && window.DitherPalette.isOpen()) ||
        (window.DitherPaletteImport && window.DitherPaletteImport.isOpen()) ||
        (window.DitherFeatureMenu && window.DitherFeatureMenu.isOpen()) ||
        (window.DitherPlugins && window.DitherPlugins.isOpen && window.DitherPlugins.isOpen()) ||
        (window.DitherInkExtractor && window.DitherInkExtractor.isOpen && window.DitherInkExtractor.isOpen()) ||
        (window.DitherColorScheme && window.DitherColorScheme.isOpen && window.DitherColorScheme.isOpen()) ||
        (window.DitherPaletteManager && window.DitherPaletteManager.isOpen && window.DitherPaletteManager.isOpen());
      // Find and the studio menu are the two global surfaces: both can be
      // reached while another modal is up, and the menu can be toggled shut
      // with the same key that opened it.
      if (modal && hit.name !== 'view-palette' && hit.name !== 'view-feature-menu') return;
      event.preventDefault();
      event.stopPropagation();
      acceleratorFires += 1;
      run(hit.name, hit.arg);
    }, true);
  }

  // ---- verbs that only exist because there is a window ----

  function openHelp(page) {
    if (window.DitherHelp) window.DitherHelp.open(page);
  }

  const SHELL_COMMANDS = {
    'view-reload': function () { desktop.win.reload(); },
    'view-devtools': function () { desktop.win.toggleDevTools(); },
    'view-fullscreen': function () { desktop.win.toggleFullScreen(); },
    'view-dock': function () {
      const hidden = document.body.classList.toggle('dock-hidden');
      note(hidden ? 'Panels hidden' : 'Panels back');
      refresh();
    },
    // The palette is the renderer's own module, like the tour: looked up when
    // the key is pressed, so the order the two files load never matters.
    'view-palette': function () {
      if (window.DitherFeatureMenu && window.DitherFeatureMenu.isOpen()) window.DitherFeatureMenu.close();
      if (window.DitherPalette) window.DitherPalette.toggle();
    },
    'help-guide': function () { openHelp('guide'); },
    // The tutorial is the renderer's own tour.js, which loads after this file
    // and hangs itself off the window: the lookup happens when the menu item is
    // clicked, so the order of the two files never matters.
    'help-tour': function () {
      const tour = window.DitherTour;
      if (!tour) return;
      tour.open();
    },
    'help-tour-hide': function () {
      const tour = window.DitherTour;
      if (tour) tour.hide();
    },
    'help-tour-show': function () {
      const tour = window.DitherTour;
      if (tour) tour.show();
    },
    'help-tour-toggle': function () {
      const tour = window.DitherTour;
      if (!tour) return;
      if (tour.hidden()) tour.show(); else tour.hide();
      refresh();
    },
    'help-update': function () {
      openHelp('about');
      window.setTimeout(function () {
        if (window.DitherHelp && window.DitherHelp.checkUpdates) window.DitherHelp.checkUpdates();
      }, 60);
    },
    'help-update-check': function () {
      if (window.DitherHelp && window.DitherHelp.checkUpdates) window.DitherHelp.checkUpdates();
    },
    'help-update-install': function () {
      desktop.installUpdate().then(function (out) {
        if (out && out.error) note(out.error);
      });
    },
    'help-whats-new': function () { openHelp('whats-new'); },
    'help-shortcuts': function () { openHelp('shortcuts'); },
    'help-about': function () { openHelp('about'); },
    'help-sources': function () {
      desktop.openExternal('https://github.com/thijnperd/dither-studio/blob/main/SOURCES.md');
    },
    'help-repo': function () {
      desktop.openExternal('https://github.com/thijnperd/dither-studio');
    },
    'help-profile': function () {
      desktop.openExternal('https://github.com/thijnperd');
    },
  };

  function run(name, arg) {
    if (!name) return false;
    if (SHELL_COMMANDS[name]) { SHELL_COMMANDS[name](arg); return true; }
    return DS.command(name, arg);
  }

  // ---- the caption bar ----

  const tbNote = $('tb-note');
  let noteTimer = 0;

  function clearNoteAction() {
    if (!tbNote) return;
    delete tbNote.dataset.path;
    tbNote.classList.remove('is-actionable');
    tbNote.removeAttribute('tabindex');
    tbNote.setAttribute('role', 'status');
  }

  function note(text, actionPath) {
    if (!tbNote) return;
    tbNote.textContent = text || '';
    tbNote.title = text || '';
    clearTimeout(noteTimer);
    if (actionPath) {
      tbNote.dataset.path = actionPath;
      tbNote.classList.add('is-actionable');
      tbNote.tabIndex = 0;
      tbNote.setAttribute('role', 'button');
    } else {
      clearNoteAction();
    }
    if (text) {
      noteTimer = setTimeout(function () {
        tbNote.textContent = '';
        tbNote.title = '';
        clearNoteAction();
      }, 6000);
    }
  }

  function syncTitle() {
    const s = appState;
    const doc = $('tb-doc');
    const name = $('doc-name');
    const meta = $('doc-meta');
    if (doc) doc.textContent = s.name + (s.savedPath ? '  ·  saved' : '');
    if (name) name.textContent = s.name;
    if (meta) meta.textContent = s.width + ' × ' + s.height + ' @ ' + ($('stat-zoom') ? $('stat-zoom').textContent : 'Fit');
    document.title = s.name + ' · Dither Studio';
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
    const mark = $('sysmark');
    const key = isMac ? '⌘K' : 'Ctrl K';
    mark.title = 'Find anything (' + key + ')';
    mark.setAttribute('aria-label', 'Find anything');
    mark.setAttribute('aria-keyshortcuts', isMac ? 'Meta+K' : 'Control+K');
    mark.addEventListener('click', function (event) {
      event.stopPropagation();
      closeMenus();
      if (window.DitherPalette) window.DitherPalette.open();
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
    note('Saved ' + (detail.name || detail.path || 'the proof') + '. Click or press Enter to show in folder.', detail.path || '');
    if (detail.path && tbNote) {
      tbNote.title = detail.path + '. Click or press Enter to show it in its folder.';
    }
    syncTitle();
  });

  // The receipt in the caption is also the shortcut to the file itself.
  if (tbNote) {
    function revealReceipt() {
      const target = tbNote.dataset.path;
      if (!target) return;
      desktop.reveal(target);
      note('Showing ' + target);
    }
    tbNote.addEventListener('click', revealReceipt);
    tbNote.addEventListener('keydown', function (event) {
      if ((event.key === 'Enter' || event.key === ' ') && tbNote.dataset.path) {
        event.preventDefault();
        revealReceipt();
      }
    });
  }

  // ---- the tool rail ----

  const TOOLS = {
    menu: function () { run('view-feature-menu'); },
    open: function () { run('file-open'); },
    // The rail's picture button is a way *into* the picker, not a second way to
    // shuffle it: the Source station holds the dropdown and the thumbnails.
    // Ctrl+D still steps through the table, for hands that live on the keys.
    demo: function () { run('window-panel-open', 'source'); },
    random: function () { run('edit-random'); },
    webcam: function () { if ($('video-webcam')) $('video-webcam').click(); },
    video: function () { run('file-open-clip'); },
    record: function () { if ($('video-record')) $('video-record').click(); },
    preset: function () { run('window-panel', 'preset'); },
  };

  const railEl = $('toolrail');
  const railButtons = Array.prototype.slice.call(document.querySelectorAll('.toolrail .tool'));

  function setRailRoving(target) {
    if (!target || railButtons.indexOf(target) < 0) return;
    railButtons.forEach(function (btn) {
      btn.tabIndex = btn === target ? 0 : -1;
    });
  }

  if (railEl && railButtons.length) {
    railEl.addEventListener('focusin', function (event) {
      const btn = event.target && event.target.closest && event.target.closest('.tool');
      if (btn) setRailRoving(btn);
    });
    railEl.addEventListener('keydown', function (event) {
      const current = railButtons.indexOf(document.activeElement);
      if (current < 0) return;
      let next = -1;
      if (event.key === 'ArrowDown') next = (current + 1) % railButtons.length;
      else if (event.key === 'ArrowUp') next = (current - 1 + railButtons.length) % railButtons.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = railButtons.length - 1;
      else return;
      event.preventDefault();
      setRailRoving(railButtons[next]);
      railButtons[next].focus();
    });
  }

  function markTool(name, on) {
    const button = document.querySelector('.tool[data-tool="' + name + '"]');
    if (!button) return;
    button.classList.toggle('is-active', !!on);
    if (button.hasAttribute('aria-pressed')) {
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  railButtons.forEach(function (button) {
    const name = button.getAttribute('data-tool');
    if (name === 'compare') {
      // Pointer hold shows the source; keyboard Space/Enter toggles so keyboard
      // users can compare just as easily.
      button.addEventListener('pointerdown', function (event) {
        event.preventDefault();
        run('view-compare', true);
        markTool('compare', true);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (type) {
        button.addEventListener(type, function () {
          if (appState.compare) {
            run('view-compare', false);
            markTool('compare', false);
          }
        });
      });
      button.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          run('view-compare');
        }
      });
      return;
    }
    button.addEventListener('click', function () { if (TOOLS[name]) TOOLS[name](); });
  });

  // The rail is icon-only, which is fast for the hand and slow for the eye. A
  // tooltip names the tool on hover (after a beat, so sweeping past does not
  // flash labels) and instantly on keyboard focus. It replaces the platform
  // title, whose one-second delay makes an unfamiliar icon feel like a guess.
  const tip = document.createElement('div');
  tip.id = 'rail-tip';
  tip.className = 'tip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  document.body.appendChild(tip);
  let tipTimer = 0;
  let tipOwner = null;

  function hideTip() {
    clearTimeout(tipTimer);
    tip.hidden = true;
    if (tipOwner) {
      if (tipOwner.getAttribute('aria-describedby') === tip.id) {
        tipOwner.removeAttribute('aria-describedby');
      }
      tipOwner = null;
    }
  }

  function showTip(button) {
    const label = button.getAttribute('data-label');
    if (!label) return;
    if (tipOwner && tipOwner !== button && tipOwner.getAttribute('aria-describedby') === tip.id) {
      tipOwner.removeAttribute('aria-describedby');
    }
    tipOwner = button;
    tip.textContent = label;
    tip.hidden = false;
    button.setAttribute('aria-describedby', tip.id);
    const rect = button.getBoundingClientRect();
    const top = Math.max(6, Math.min(window.innerHeight - tip.offsetHeight - 6,
      rect.top + rect.height / 2 - tip.offsetHeight / 2));
    const left = Math.min(window.innerWidth - tip.offsetWidth - 6, rect.right + 8);
    tip.style.left = Math.round(left) + 'px';
    tip.style.top = Math.round(top) + 'px';
  }

  railButtons.forEach(function (button) {
    const label = button.getAttribute('title');
    if (label) {
      button.setAttribute('data-label', label);
      button.removeAttribute('title');
    }
    button.addEventListener('mouseenter', function () {
      clearTimeout(tipTimer);
      tipTimer = setTimeout(function () { showTip(button); }, 320);
    });
    button.addEventListener('mouseleave', hideTip);
    button.addEventListener('click', hideTip);
    button.addEventListener('focus', function () { showTip(button); });
    button.addEventListener('blur', hideTip);
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !tip.hidden) hideTip();
  });

  window.addEventListener('blur', hideTip);

  // ---- drop veil, recording pulse, slider fills ----

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
  // runs between two syncs), so the chrome polls it gently: twice a second,
  // one small object, one class toggle.
  setInterval(function () {
    const api = window.__dither;
    const stats = api && api.videoStats ? api.videoStats() : null;
    const recording = !!(stats && stats.recording);
    const tool = document.querySelector('.tool[data-tool="record"]');
    if (tool) {
      tool.classList.toggle('is-recording', recording);
      tool.setAttribute('aria-pressed', recording ? 'true' : 'false');
    }
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

  // What any change to the app ends with: the slider fills, the caption and
  // the menu ticks. Written once and called three times (boot, ds:ui, dock).
  function refresh() {
    paintRanges();
    appState = DS.state();
    markTool('compare', appState.compare);
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

  window.addEventListener('resize', function () { paintRanges(); hideTip(); });

  // ---- boot ----

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
  // Hand main the finished tree (the native menu and its accelerators) and
  // the first set of ticks: the window is not ready until its menu bar and its
  // caption carry real values.
  pushToMain(true);
  if (desktop.ready) desktop.ready();
  setTimeout(refresh, 300);
}());
