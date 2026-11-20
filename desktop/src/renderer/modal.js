/* modal.js - shared accessibility and interaction rules for modal overlays.
 *
 * Every dialog in the desktop app (Command Palette, Studio Menu, Help,
 * Palette Import, Saved Color Schemes, Plugin Manager, Ink Extractor, Color
 * Scheme Maker) shares the same invariants:
 *   - while any dialog is open, background chrome and workspace regions are
 *     marked `inert` so screen readers and Tab navigation cannot wander out;
 *   - focus is trapped inside the active dialog on Tab / Shift+Tab;
 *   - backdrop click dismiss requires BOTH pointerdown and pointerup outside
 *     the dialog card, so a text-selection drag that finishes on the scrim
 *     never discards the user's work;
 *   - `anyOpen()` tells the shell and bare-key handlers when a modal owns the
 *     keyboard, preventing background shortcuts (R, C, +, -, 0) from leaking.
 *
 * Exposes: window.DitherModal.
 */
(function (global) {
  'use strict';

  const BACKGROUND_SELECTORS = ['#titlebar', '#menubar', '#optbar', '.workarea', '.statusbar'];
  const FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  const openSet = new Set();

  function setBackgroundInert(on) {
    BACKGROUND_SELECTORS.forEach(function (selector) {
      const node = document.querySelector(selector);
      if (!node) return;
      if (on) node.setAttribute('inert', '');
      else node.removeAttribute('inert');
    });
  }

  function syncInert() {
    setBackgroundInert(openSet.size > 0);
  }

  function markOpen(overlay) {
    if (!overlay) return;
    openSet.add(overlay);
    syncInert();
  }

  function markClosed(overlay) {
    if (!overlay) return;
    openSet.delete(overlay);
    syncInert();
  }

  function anyOpen() {
    // Also clean out any overlay that was hidden directly without calling markClosed.
    openSet.forEach(function (overlay) {
      if (!overlay || overlay.hidden) openSet.delete(overlay);
    });
    if (openSet.size === 0) setBackgroundInert(false);
    return openSet.size > 0;
  }

  function focusables(container) {
    if (!container) return [];
    return Array.prototype.filter.call(
      container.querySelectorAll(FOCUSABLE),
      function (node) {
        return !node.hidden && !node.closest('[hidden]') && node.offsetParent !== null;
      }
    );
  }

  function trapFocus(container, event) {
    if (!container || !event || event.key !== 'Tab') return;
    const nodes = focusables(container);
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = document.activeElement;
    if (event.shiftKey) {
      if (active === first || !container.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last || !container.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  }

  // Require both press and release on the backdrop target so dragging a text
  // selection out of a field onto the scrim does not dismiss the dialog.
  function bindBackdropDismiss(backdrop, onClose) {
    if (!backdrop || typeof onClose !== 'function') return;
    let pressedBackdrop = false;
    backdrop.addEventListener('pointerdown', function (event) {
      pressedBackdrop = event.target === backdrop;
    });
    backdrop.addEventListener('pointerup', function (event) {
      if (pressedBackdrop && event.target === backdrop) onClose();
      pressedBackdrop = false;
    });
    backdrop.addEventListener('pointercancel', function () {
      pressedBackdrop = false;
    });
  }

  global.DitherModal = {
    markOpen: markOpen,
    markClosed: markClosed,
    anyOpen: anyOpen,
    focusables: focusables,
    trapFocus: trapFocus,
    bindBackdropDismiss: bindBackdropDismiss,
  };
}(typeof window !== 'undefined' ? window : globalThis));
