/* tour.js - the Tutorial: ten lessons that point at the real controls.
 *
 * The shape is Photoshop's guided tutorials: a dimmed backdrop with a hole over
 * the exact control, a card that says what to do and why, and no fake UI. The
 * learner uses the real panel while the card waits, and every step that can be
 * checked carries a predicate over DS.state(), so it ticks itself off the
 * moment the proof changes rather than asking whether it happened.
 *
 * What this file owns:
 *   - the lesson list in the Learn panel, built from tour-spec.js, grouped by
 *     theme and ticked as lessons finish;
 *   - the runner: one step at a time, the hole over the target, Back/Next/Exit,
 *     Skip, Show me (which runs that step's own commands), Escape to leave;
 *   - the intro: the one time the tour opens by itself, on a build that has
 *     never met it, and the bookkeeping that stops it ever doing so twice;
 *   - progress, in a localStorage key of the same kind the dock's groups use.
 *
 * What it never does: draw a control of its own, swallow a click meant for the
 * app, or run a loop. It reads state on the app's own `ds:ui` event, and only
 * re-places the card when a target can have moved.
 *
 * DOM-free? No - it is nothing but DOM. The lesson data is the DOM-free half
 * (tour-spec.js, covered by tools/tour.test.js); this is the half that needs a
 * window, so the smoke run is what covers it.
 */
(function () {
  'use strict';

  const DS = window.DS;
  const SPEC = window.DitherTourSpec;
  if (!DS || !SPEC || !SPEC.lessons || !SPEC.lessons.length) return;

  const $ = function (id) { return document.getElementById(id); };
  const STORE = 'dither-studio.tour';
  // How long the card of a finished tour stays up before it closes itself. A
  // beat to read the verdict - one shot, never a loop - with the Close button
  // still there for anyone who would rather not wait.
  const VERDICT_MS = 3200;

  // ---- progress ----------------------------------------------------------

  // { done: { lessonId: true }, at: { lessonId: stepIndex }, seen: bool } - the
  // same shape of key the dock uses for which panels are open, with the same
  // guard: a disabled or unavailable storage is not worth failing over. `seen`
  // is the intro question: the tour has had its one free appearance.
  function blank() { return { done: {}, at: {}, seen: false }; }

  function loadProgress() {
    let raw = null;
    try { raw = window.localStorage.getItem(STORE); } catch (err) { raw = null; }
    const out = blank();
    if (!raw) return out;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (parsed.done && typeof parsed.done === 'object') out.done = parsed.done;
        if (parsed.at && typeof parsed.at === 'object') out.at = parsed.at;
        if (parsed.seen === true) out.seen = true;
      }
    } catch (err) { /* unreadable progress starts over rather than throwing */ }
    return out;
  }

  function saveProgress() {
    try { window.localStorage.setItem(STORE, JSON.stringify(progress)); }
    catch (err) { /* private mode, file://, or storage disabled: not important */ }
  }

  let progress = loadProgress();

  // ---- the Learn panel ---------------------------------------------------

  const lessons = SPEC.lessons;
  const list = $('tour-list');
  const noteLearn = $('note-learn');
  const startButton = $('tour-start');
  const resetButton = $('tour-reset');

  function lessonById(id) {
    return lessons.find(function (lesson) { return lesson.id === id; }) || null;
  }

  function doneCount() {
    return lessons.filter(function (lesson) { return !!progress.done[lesson.id]; }).length;
  }

  // Where "Take the Tour" lands: the first lesson not yet finished, or the
  // first lesson again once they all are.
  function nextUnfinished() {
    const open = lessons.find(function (lesson) { return !progress.done[lesson.id]; });
    return open ? open.id : lessons[0].id;
  }

  function allDone() {
    return lessons.every(function (lesson) { return !!progress.done[lesson.id]; });
  }

  // The intro is owed to a build that has never met the tour and has not
  // finished it. Being declined counts as being met: a tutorial that returns
  // after it has been waved away is an advertisement, not a lesson.
  function shouldIntro() {
    return !progress.seen && !allDone();
  }

  function markSeen() {
    if (progress.seen) return false;
    progress.seen = true;
    saveProgress();
    return true;
  }

  function learnOpen() {
    return (stateNow().openGroups || []).indexOf('learn') >= 0;
  }

  // Starting the tour has to reveal the station it lives in, now that a
  // finished tour folds it away: Help > Take the Tour must not run a tutorial
  // whose list of lessons is nowhere to be found.
  function revealLearn() {
    return DS.command('window-panel-open', 'learn');
  }

  function foldLearn() {
    return learnOpen() ? DS.command('window-panel-close', 'learn') : false;
  }

  function buildList() {
    if (!list) return;
    list.textContent = '';
    let theme = null;
    lessons.forEach(function (lesson) {
      if (lesson.theme !== theme) {
        theme = lesson.theme;
        const head = document.createElement('p');
        head.className = 'tour-theme';
        head.textContent = theme;
        list.appendChild(head);
      }
      const done = !!progress.done[lesson.id];
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'tour-row' + (done ? ' is-done' : '');
      row.setAttribute('data-lesson', lesson.id);
      row.title = lesson.summary;

      const mark = document.createElement('span');
      mark.className = 'tour-row-mark';
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = done ? '✓' : '▢';

      const text = document.createElement('span');
      text.className = 'tour-row-text';
      const title = document.createElement('b');
      title.textContent = lesson.title;
      const summary = document.createElement('em');
      summary.textContent = lesson.summary;
      text.appendChild(title);
      text.appendChild(summary);

      const meta = document.createElement('span');
      meta.className = 'tour-row-when';
      const at = progress.at[lesson.id];
      meta.textContent = (at && !done)
        ? 'step ' + (at + 1) + '/' + lesson.steps.length
        : lesson.minutes + ' min';

      row.appendChild(mark);
      row.appendChild(text);
      row.appendChild(meta);
      row.addEventListener('click', function () { start(lesson.id); });
      list.appendChild(row);
    });
    if (noteLearn) {
      const done = doneCount();
      noteLearn.textContent = done ? done + ' of ' + lessons.length + ' done'
        : lessons.length + ' lessons';
    }
  }

  // ---- the coach mark ----------------------------------------------------

  const layer = $('tour');
  const hole = $('tour-hole');
  const card = $('tour-card');
  const elLesson = $('tour-lesson');
  const elCount = $('tour-count');
  const elTitle = $('tour-title');
  const elBody = $('tour-body');
  const elWhy = $('tour-why');
  const elFill = $('tour-fill');
  const btnExit = $('tour-exit');
  const btnSkip = $('tour-skip');
  const btnShow = $('tour-show');
  const btnBack = $('tour-back');
  const btnNext = $('tour-next');

  const ready = !!(layer && hole && card && elLesson && elCount && elTitle && elBody && btnNext);

  // running = { lesson, index, phase } while a lesson is up; null otherwise.
  // phase is 'step' until the last step is done with, then 'complete'.
  let running = null;
  let lastPlace = 0;

  function currentStep() {
    if (!running || running.phase !== 'step') return null;
    return running.lesson.steps[running.index] || null;
  }

  function stateNow() {
    try { return DS.state() || {}; } catch (err) { return {}; }
  }

  // A step the app can check says so with `when`; a step that only explains has
  // none and is never ticked. A predicate that throws counts as unsatisfied -
  // a broken check must not take the tutorial down with it.
  function satisfied(step) {
    if (!step || typeof step.when !== 'function') return false;
    try { return !!step.when(stateNow()); } catch (err) { return false; }
  }

  // The box a step points at, with the node it was measured from. A row the app
  // has hidden - the motion rows before a source is live, the Type rows before
  // text mode is on - measures as zero, so the nearest ancestor that does have a
  // box is used instead: the card then points at the panel the row appears in
  // rather than at nothing.
  function findTarget(step) {
    if (!step || !step.target) return null;
    let node = null;
    try { node = document.querySelector(step.target); } catch (err) { node = null; }
    while (node && node !== document.body) {
      const rect = node.getBoundingClientRect();
      if (rect.width >= 2 && rect.height >= 2) {
        return { node: node, rect: rect, offscreen: offscreen(rect) };
      }
      node = node.parentElement;
    }
    return null;
  }

  // Outside the window, with a margin: a control half off the edge is not worth
  // pointing at either.
  function offscreen(rect) {
    return rect.right < 8 || rect.bottom < 8 ||
      rect.left > window.innerWidth - 8 || rect.top > window.innerHeight - 8;
  }

  // A tutorial the learner has to hunt through does not teach anything, so the
  // rail is scrolled to the target, once per step. Instantly, and deliberately:
  // the rail's own reveals are smooth (scroll-behavior on .rail-scroll), and two
  // smooth scrolls racing each other is how the target ends up still off screen.
  // It also means the box can be measured again in the same pass, so the hole
  // lands on the first paint instead of after an animation.
  function bringIntoView(found) {
    if (!found || !found.offscreen) return;
    if (running.scrolled === running.index) return;
    running.scrolled = running.index;
    try {
      found.node.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    } catch (err) {
      try { found.node.scrollIntoView(); } catch (again) { /* nothing to do */ }
    }
  }

  // The dimmed backdrop, and the hole punched in it. With no target on screen
  // the whole window is the veil and the card sits in the middle - the honest
  // picture for a card about the app as a whole.
  function dim(rect, pad) {
    hole.classList.toggle('is-solid', !rect);
    if (!rect) {
      hole.style.left = '0px';
      hole.style.top = '0px';
      hole.style.width = '100%';
      hole.style.height = '100%';
      return;
    }
    hole.style.left = Math.round(Math.max(0, rect.left - pad)) + 'px';
    hole.style.top = Math.round(Math.max(0, rect.top - pad)) + 'px';
    hole.style.width = Math.round(rect.width + pad * 2) + 'px';
    hole.style.height = Math.round(rect.height + pad * 2) + 'px';
  }

  // The card goes wherever there is room: right of the hole, else left, else
  // below, else above, else centred. Clamped to the window in every case.
  function placeCard(rect) {
    const gap = 14;
    const edge = 14;
    const width = card.offsetWidth;
    const height = card.offsetHeight;
    let left = (window.innerWidth - width) / 2;
    let top = (window.innerHeight - height) / 2;
    if (rect) {
      const roomRight = window.innerWidth - rect.right;
      const roomLeft = rect.left;
      const roomBelow = window.innerHeight - rect.bottom;
      const roomAbove = rect.top;
      if (roomRight >= width + gap + edge) { left = rect.right + gap; top = rect.top; }
      else if (roomLeft >= width + gap + edge) { left = rect.left - gap - width; top = rect.top; }
      else if (roomBelow >= height + gap + edge) { left = rect.left; top = rect.bottom + gap; }
      else if (roomAbove >= height + gap + edge) { left = rect.left; top = rect.top - gap - height; }
    }
    left = Math.max(edge, Math.min(window.innerWidth - width - edge, left));
    top = Math.max(edge, Math.min(window.innerHeight - height - edge, top));
    card.style.left = Math.round(left) + 'px';
    card.style.top = Math.round(top) + 'px';
  }

  function place() {
    if (!ready || !running) return;
    lastPlace = Date.now();
    const step = currentStep();
    let found = findTarget(step);
    if (found && found.offscreen) {
      bringIntoView(found);
      found = findTarget(step);        // the rail moved: measure it again
    }
    // Still nothing on screen (a target past the end of a short rail, or an
    // empty state): the honest card is a veil over the window and no hole.
    const rect = found && !found.offscreen ? found.rect : null;
    dim(rect, 6);
    placeCard(rect);
    card.classList.toggle('is-free', !rect);
  }

  // A slider drag fires ds:ui per input event, so repositioning follows the app
  // rather than racing it: at most one placement per 80 ms, no timer, no frame.
  function placeSoon() {
    if (!running) return;
    if (Date.now() - lastPlace < 80) return;
    place();
  }

  // ---- the runner --------------------------------------------------------

  // Opening the panel a step is about, before the card appears: the menus'
  // `window-panel` is a toggle, and a tutorial that closes the panel it is
  // talking about would be worse than no tutorial.
  function prepare(step) {
    if (step && step.open) DS.command('window-panel-open', step.open);
  }

  function renderStep(focus) {
    const lesson = running.lesson;
    const step = currentStep();
    const total = lesson.steps.length;
    const at = running.index;
    elLesson.textContent = lesson.title;
    elCount.textContent = (at + 1) + ' / ' + total;
    elTitle.textContent = step.title;
    elBody.textContent = step.body;
    if (step.why) { elWhy.textContent = step.why; elWhy.hidden = false; }
    else { elWhy.textContent = ''; elWhy.hidden = true; }
    if (elFill) elFill.style.width = Math.round(((at + 1) / total) * 100) + '%';
    btnBack.disabled = at === 0;
    btnNext.textContent = at === total - 1 ? 'Finish' : 'Next';
    btnShow.hidden = !(step.show && step.show.length);
    syncSkip();
    card.classList.remove('is-complete');
    card.classList.toggle('is-done', satisfied(step));
    running.scrolled = -1;      // this step may need the rail moved for it
    progress.at[lesson.id] = at;
    saveProgress();
    // Ten rows, once per Next press: cheap, and the resume markers stay true.
    buildList();
    place();
    if (focus) btnNext.focus();
  }

  function start(id, atIndex) {
    if (!ready) return false;
    const lesson = lessonById(id) || lessons[0];
    if (!lesson) return false;
    const saved = atIndex === undefined ? progress.at[lesson.id] : atIndex;
    const index = Math.max(0, Math.min(lesson.steps.length - 1, saved || 0));
    running = { lesson: lesson, index: index, phase: 'step' };
    layer.hidden = false;
    prepare(currentStep());
    renderStep(true);
    return true;
  }

  function next() {
    if (!running) return false;
    if (running.phase === 'complete') {
      const wanted = running.next || nextUnfinished();
      if (wanted) return start(wanted, 0);
      return exit();
    }
    if (running.index >= running.lesson.steps.length - 1) return finish();
    running.index += 1;
    prepare(currentStep());
    renderStep(true);
    return true;
  }

  function back() {
    if (!running || running.phase !== 'step' || running.index === 0) return false;
    running.index -= 1;
    prepare(currentStep());
    renderStep(true);
    return true;
  }

  // Skip belongs to a tour the learner did not ask for: it is on the card while
  // the intro is unclaimed and gone once they have met the tour, which leaves
  // Exit as the only way out of a lesson they started themselves.
  function syncSkip() {
    if (btnSkip) btnSkip.hidden = !shouldIntro();
  }

  // The last card is a verdict, not a step: the lesson is recorded as finished,
  // the list ticks, and the next lesson is offered by name.
  function finish() {
    const lesson = running.lesson;
    progress.done[lesson.id] = true;
    delete progress.at[lesson.id];
    saveProgress();
    const wanted = nextUnfinished();
    const nextLesson = progress.done[wanted] ? null : lessonById(wanted);
    running.phase = 'complete';
    running.next = nextLesson ? nextLesson.id : null;
    card.classList.remove('is-done');
    card.classList.add('is-complete');
    elCount.textContent = '✓ done';
    elTitle.textContent = nextLesson ? 'That is ' + lesson.title.toLowerCase() + '.' : 'That is every lesson.';
    elBody.textContent = nextLesson
      ? 'Next: ' + nextLesson.title + ' — ' + nextLesson.summary
      : lessons.length + ' lessons, the whole press. Every one of them can be run again from this list.';
    elWhy.textContent = '';
    elWhy.hidden = true;
    if (elFill) elFill.style.width = '100%';
    btnBack.disabled = true;
    btnShow.hidden = true;
    btnNext.textContent = nextLesson ? 'Next lesson' : 'Close';
    if (!nextLesson) {
      // The whole tour, finished. The tutorial has done its job, so it gets out
      // of the way by itself: the station folds, the intro is spent for good,
      // and the card closes after a beat instead of waiting to be dismissed.
      markSeen();
      foldLearn();
      const shown = running;
      window.setTimeout(function () { if (running === shown) exit(); }, VERDICT_MS);
    }
    syncSkip();
    buildList();
    place();
    return true;
  }

  // Leave: the learner's own way out of a lesson. Progress is kept, the station
  // stays as they left it, and leaving the intro at all counts as having met it.
  function exit() {
    if (!running) return false;
    running = null;
    markSeen();
    if (layer) layer.hidden = true;
    syncSkip();
    buildList();
    return true;
  }

  // Skip: the tutorial opened itself, and this is the learner saying it should
  // not have. The choice is stored so the intro never returns, and the station
  // the intro opened folds away with it.
  function skip() {
    const was = !!running;
    markSeen();
    exit();
    foldLearn();
    syncSkip();          // covers a skip pressed outside a running lesson
    return was;
  }

  // Open (Help > Take the Tour): reveal the station, then pick up where the
  // learner left off.
  function open() {
    if (!ready) return false;
    revealLearn();
    return start(nextUnfinished(), 0);
  }

  function showMe() {
    const step = currentStep();
    if (!step || !step.show || !step.show.length) return false;
    // Staggered, so two commands in one step read as two things happening.
    step.show.forEach(function (pair, index) {
      window.setTimeout(function () { DS.command(pair[0], pair[1]); }, index * 90);
    });
    return true;
  }

  function reset() {
    // Leave first: leaving writes `seen`, and the blank slate has to have the
    // last word or Reset would answer the intro question for the learner.
    if (running) exit();
    progress = blank();
    saveProgress();
    buildList();
    return true;
  }

  // ---- wiring ------------------------------------------------------------

  if (btnExit) btnExit.addEventListener('click', exit);
  if (btnSkip) btnSkip.addEventListener('click', skip);
  if (btnNext) btnNext.addEventListener('click', next);
  if (btnBack) btnBack.addEventListener('click', back);
  if (btnShow) btnShow.addEventListener('click', showMe);
  if (startButton) startButton.addEventListener('click', function () { start(nextUnfinished(), 0); });
  if (resetButton) resetButton.addEventListener('click', reset);

  // Escape leaves the tutorial, in the capture phase: whichever else is
  // listening (the menu bar closes its drop-downs) still gets the key.
  document.addEventListener('keydown', function (event) {
    if (!running) return;
    if (event.key === 'Escape') { event.preventDefault(); exit(); }
  }, true);

  // The card follows the app: a panel opening, a row appearing, a slider
  // moving, the rail scrolling under a target.
  window.addEventListener('ds:ui', function () {
    if (!running) return;
    if (running.phase === 'step') card.classList.toggle('is-done', satisfied(currentStep()));
    placeSoon();
  });
  window.addEventListener('resize', placeSoon);
  const rail = $('rail');
  if (rail) rail.addEventListener('scroll', placeSoon, { passive: true });

  buildList();

  // A build that has never met the tutorial meets it now: the Learn station
  // comes forward - it is the one station that cannot explain itself closed -
  // and the first unfinished lesson starts itself. Once, and only once: Skip,
  // Exit and Escape all end it for good, and a finished tour never opens again.
  if (shouldIntro()) {
    revealLearn();
    start(nextUnfinished());
  }

  // ---- the test surface (tools/smoke-in-page.js) -------------------------

  window.DitherTour = {
    lessons: lessons,
    spec: SPEC,
    start: start,
    open: open,
    next: next,
    back: back,
    exit: exit,
    skip: skip,
    showMe: showMe,
    reset: reset,
    nextUnfinished: nextUnfinished,
    shouldIntro: shouldIntro,
    rows: function () { return list ? list.querySelectorAll('.tour-row').length : 0; },
    progress: function () {
      return { done: Object.keys(progress.done), at: progress.at, seen: !!progress.seen };
    },
    status: function () {
      return {
        running: !!running,
        phase: running ? running.phase : 'idle',
        lesson: running ? running.lesson.id : null,
        step: currentStep() ? running.index : -1,
        total: running ? running.lesson.steps.length : 0,
        satisfied: satisfied(currentStep()),
        note: noteLearn ? noteLearn.textContent : '',
      };
    },
    // Where the hole actually is, in window coordinates: the smoke run compares
    // it against the target's own box, which is the only way to prove the coach
    // mark points at the control and not at the middle of the window.
    hole: function () {
      if (!hole) return null;
      const rect = hole.getBoundingClientRect();
      return {
        left: Math.round(rect.left), top: Math.round(rect.top),
        width: Math.round(rect.width), height: Math.round(rect.height),
        solid: hole.classList.contains('is-solid'),
        visible: !!(layer && !layer.hidden),
      };
    },
  };
}());
