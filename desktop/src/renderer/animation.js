/* animation.js - the still-to-motion timeline.
 *
 * The engine owns the rule (D.animationSettings): a list of tracks, each one
 * property moving from a value to another over the timeline. This file owns the
 * clock, the track rows and WebM export. It never executes a downloaded file;
 * animation is part of the app, not a plugin.
 *
 * Exposes: window.DitherAnimation - { create }.
 */
(function (global) {
  'use strict';

  const D = global.DitherLib;
  if (!D) return;
  const $ = function (id) { return document.getElementById(id); };

  function create(opts) {
    opts = opts || {};
    const el = {
      start: $('animation-start'),
      panel: $('animation-panel'),
      play: $('animation-play'),
      stop: $('animation-stop'),
      exportBtn: $('animation-export'),
      duration: $('animation-duration'),
      fps: $('animation-fps'),
      loop: $('animation-loop'),
      tracks: $('animation-tracks'),
      property: $('animation-property'),
      add: $('animation-add'),
      playhead: $('animation-playhead'),
      note: $('animation-note'),
      transport: $('animation-transport'),
      toggle: $('animation-toggle'),
      readout: $('animation-readout'),
    };
    if (!el.panel || !el.tracks) return null;

    const state = {
      active: false,
      playing: false,
      frame: 0,
      duration: 3,
      fps: 24,
      tracks: [],
      raf: 0,
      startedAt: 0,
      recording: false,
      recorder: null,
      chunks: [],
      stream: null,
      timer: 0,
      restoreLoop: true,
    };

    function totalFrames() {
      return Math.max(1, Math.round(state.duration * state.fps));
    }

    function note(text) {
      if (el.note) el.note.textContent = text;
      if (typeof opts.onStatus === 'function') opts.onStatus(text);
    }

    function readTimeline() {
      state.duration = Math.max(1, Math.min(12, parseFloat(el.duration.value) || 3));
      state.fps = Math.max(6, Math.min(30, parseInt(el.fps.value, 10) || 24));
      el.duration.value = String(state.duration);
      el.fps.value = String(state.fps);
    }

    function propertyMeta(id) {
      return D.ANIMATION_PROPERTIES.find(function (p) { return p.id === id; });
    }

    function defaultTrack(id) {
      const meta = propertyMeta(id) || D.ANIMATION_PROPERTIES[0];
      const base = opts.getBaseSettings ? opts.getBaseSettings() : D.DEFAULTS;
      let from = meta.from;
      if (meta.id === 'ditherStrength') from = base.ditherStrength;
      return { property: meta.id, from: from, to: meta.to, ease: 'linear', start: 0, end: 1 };
    }

    function addTrack(id, silent) {
      const meta = propertyMeta(id);
      if (!meta) return null;
      state.tracks.push(defaultTrack(meta.id));
      buildTracks();
      if (!silent) {
        note(meta.name + ' added · ' + state.tracks.length + ' track' + (state.tracks.length === 1 ? '' : 's'));
        tick(state.frame);
      }
      return state.tracks[state.tracks.length - 1];
    }

    function removeTrack(index) {
      if (index < 0 || index >= state.tracks.length) return;
      state.tracks.splice(index, 1);
      buildTracks();
      tick(state.frame);
    }

    function numberField(track, key, meta) {
      const input = document.createElement('input');
      input.type = 'number';
      input.value = String(track[key]);
      input.min = String(meta.min);
      input.max = String(meta.max);
      input.step = String(meta.step);
      input.setAttribute('aria-label', meta.name + ' ' + key);
      input.addEventListener('change', function () {
        let value = parseFloat(input.value);
        if (!isFinite(value)) value = meta[key];
        track[key] = Math.max(meta.min, Math.min(meta.max, value));
        input.value = String(track[key]);
        tick(state.frame);
      });
      return input;
    }

    function buildTracks() {
      el.tracks.textContent = '';
      if (!state.tracks.length) {
        const empty = document.createElement('p');
        empty.className = 'anim-empty';
        empty.textContent = 'No tracks yet. Add a property to animate.';
        el.tracks.appendChild(empty);
        return;
      }
      state.tracks.forEach(function (track, index) {
        const meta = propertyMeta(track.property);
        if (!meta) return;
        const row = document.createElement('div');
        row.className = 'anim-track';
        const head = document.createElement('div');
        head.className = 'anim-track-head';
        const name = document.createElement('span');
        name.className = 'anim-track-name';
        name.textContent = meta.name;
        const remove = document.createElement('button');
        remove.className = 'icon-btn';
        remove.type = 'button';
        remove.textContent = '✕';
        remove.title = 'Remove this track';
        remove.setAttribute('aria-label', 'Remove ' + meta.name);
        remove.addEventListener('click', function () { removeTrack(index); });
        head.appendChild(name);
        head.appendChild(remove);

        const fields = document.createElement('div');
        fields.className = 'anim-track-fields';
        const from = numberField(track, 'from', meta);
        const to = numberField(track, 'to', meta);
        const ease = document.createElement('select');
        D.ANIMATION_EASES.forEach(function (entry) {
          const option = document.createElement('option');
          option.value = entry.id;
          option.textContent = entry.name;
          ease.appendChild(option);
        });
        ease.value = track.ease;
        ease.setAttribute('aria-label', meta.name + ' easing');
        ease.addEventListener('change', function () { track.ease = ease.value; tick(state.frame); });
        const arrow = document.createElement('span');
        arrow.className = 'anim-arrow';
        arrow.textContent = '→';
        fields.appendChild(from);
        fields.appendChild(arrow);
        fields.appendChild(to);
        fields.appendChild(ease);
        row.appendChild(head);
        row.appendChild(fields);
        el.tracks.appendChild(row);
      });
    }

    function buildPropertySelect() {
      if (!el.property) return;
      el.property.textContent = '';
      D.ANIMATION_PROPERTIES.forEach(function (meta) {
        const option = document.createElement('option');
        option.value = meta.id;
        option.textContent = meta.name;
        el.property.appendChild(option);
      });
    }

    function frameSettings(index) {
      const base = opts.getBaseSettings ? opts.getBaseSettings() : D.DEFAULTS;
      return D.animationSettings(base, state.tracks, index, totalFrames());
    }

    function tick(index, quiet) {
      const total = totalFrames();
      state.frame = Math.max(0, Math.min(total - 1, Math.round(Number(index) || 0)));
      const settings = frameSettings(state.frame);
      if (typeof opts.onFrame === 'function') opts.onFrame(settings, state.frame, total);
      if (el.readout) el.readout.textContent = 'frame ' + (state.frame + 1) + ' / ' + total + ' · ' + state.fps + ' fps';
      if (el.playhead) el.playhead.style.left = (total <= 1 ? 0 : (state.frame / (total - 1)) * 100) + '%';
      if (!quiet) {
        const recording = state.recording ? ' · REC' : '';
        note((state.playing ? 'Playing' : 'Paused') + ' · frame ' + (state.frame + 1) + ' / ' + total + recording);
      }
      return settings;
    }

    function cancel() {
      if (state.raf) cancelAnimationFrame(state.raf);
      state.raf = 0;
    }

    function loop(ts) {
      if (!state.playing) return;
      const total = totalFrames();
      const elapsed = ts - state.startedAt;
      let index = Math.floor((elapsed / 1000) * state.fps);
      if (index >= total) {
        if (el.loop.checked && !state.recording) index = index % total;
        else {
          tick(total - 1);
          pause('Finished at frame ' + total + ' / ' + total);
          if (state.recording) finishRecording();
          return;
        }
      }
      if (index !== state.frame) tick(index);
      state.raf = requestAnimationFrame(loop);
    }

    function play() {
      if (!state.active) start();
      if (!state.active) return false;
      if (state.playing) return true;
      if (state.frame >= totalFrames() - 1) state.frame = 0;
      state.playing = true;
      el.play.textContent = 'Pause';
      if (el.toggle) el.toggle.textContent = 'Pause';
      state.startedAt = performance.now() - (state.frame / state.fps) * 1000;
      tick(state.frame);
      state.raf = requestAnimationFrame(loop);
      return true;
    }

    function pause(message) {
      if (!state.playing && !message) return;
      state.playing = false;
      cancel();
      el.play.textContent = 'Play';
      if (el.toggle) el.toggle.textContent = 'Play';
      note(message || ('Paused · frame ' + (state.frame + 1) + ' / ' + totalFrames()));
    }

    function start() {
      readTimeline();
      if (!state.tracks.length) addTrack('ditherStrength', true);
      state.active = true;
      el.panel.hidden = false;
      if (el.transport) el.transport.hidden = false;
      if (el.start) el.start.textContent = 'Restart animation';
      state.frame = 0;
      tick(0);
      note('Timeline ready · ' + state.duration + ' s · ' + state.fps + ' fps');
      return true;
    }

    function stop() {
      pause();
      if (state.recording) finishRecording();
      state.active = false;
      state.playing = false;
      cancel();
      el.panel.hidden = true;
      if (el.transport) el.transport.hidden = true;
      if (el.start) el.start.textContent = 'Animate the still';
      if (typeof opts.onStop === 'function') opts.onStop();
      note('Animation closed · the still is back');
      return true;
    }

    function refresh() {
      if (!state.active) return false;
      tick(state.frame, true);
      return true;
    }

    function pickMime() {
      if (!global.MediaRecorder) return '';
      const options = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
      for (let i = 0; i < options.length; i++) {
        try { if (MediaRecorder.isTypeSupported(options[i])) return options[i]; } catch (err) { /* next */ }
      }
      return '';
    }

    function finishRecording() {
      if (!state.recorder) return;
      const recorder = state.recorder;
      state.recorder = null;
      state.recording = false;
      clearTimeout(state.timer);
      state.timer = 0;
      el.exportBtn.disabled = false;
      el.exportBtn.textContent = 'Export WebM';
      pause('Recorded · preparing the file…');
      if (recorder.state !== 'inactive') recorder.stop();
      if (state.stream) {
        state.stream.getTracks().forEach(function (track) { track.stop(); });
        state.stream = null;
      }
      if (el.loop) el.loop.checked = state.restoreLoop;
    }

    function record() {
      if (state.recording) return false;
      if (!state.active) start();
      const canvas = opts.getCanvas ? opts.getCanvas() : null;
      const mime = pickMime();
      if (!canvas || typeof canvas.captureStream !== 'function' || !mime) {
        note('This browser cannot record the canvas');
        return false;
      }
      pause();
      tick(0);
      state.chunks = [];
      state.restoreLoop = !!el.loop.checked;
      el.loop.checked = false;
      try {
        state.stream = canvas.captureStream(state.fps);
        state.recorder = new MediaRecorder(state.stream, { mimeType: mime, videoBitsPerSecond: 8000000 });
      } catch (err) {
        note('The recorder could not start: ' + (err && err.message ? err.message : 'unknown error'));
        return false;
      }
      state.recorder.ondataavailable = function (event) {
        if (event.data && event.data.size) state.chunks.push(event.data);
      };
      state.recorder.onstop = function () {
        const blob = new Blob(state.chunks, { type: mime.split(';')[0] });
        state.chunks = [];
        if (blob.size && typeof opts.download === 'function') {
          opts.download(blob, 'dither-animation.webm');
          note('Exported dither-animation.webm · ' + Math.round(blob.size / 1024) + ' KB');
        } else {
          note('The recording came out empty');
        }
      };
      state.recording = true;
      el.exportBtn.disabled = true;
      el.exportBtn.textContent = 'Recording…';
      el.recorder = state.recorder;
      state.recorder.start(250);
      play();
      state.timer = setTimeout(finishRecording, state.duration * 1000 + 200);
      return true;
    }

    function stats() {
      return {
        active: state.active,
        playing: state.playing,
        frame: state.frame,
        total: totalFrames(),
        duration: state.duration,
        fps: state.fps,
        tracks: state.tracks.map(function (track) { return Object.assign({}, track); }),
        recording: state.recording,
      };
    }

    if (el.start) el.start.addEventListener('click', function () { if (state.active) tick(0); else start(); });
    if (el.play) el.play.addEventListener('click', function () { if (state.playing) pause(); else play(); });
    if (el.toggle) el.toggle.addEventListener('click', function () { if (state.playing) pause(); else play(); });
    if (el.stop) el.stop.addEventListener('click', function () { stop(); });
    if (el.exportBtn) el.exportBtn.addEventListener('click', record);
    if (el.add) el.add.addEventListener('click', function () { addTrack(el.property.value); });
    if (el.duration) el.duration.addEventListener('change', function () { readTimeline(); tick(Math.min(state.frame, totalFrames() - 1)); });
    if (el.fps) el.fps.addEventListener('change', function () { readTimeline(); tick(Math.min(state.frame, totalFrames() - 1)); });

    buildPropertySelect();
    buildTracks();

    return {
      start: start,
      stop: stop,
      play: play,
      pause: pause,
      tick: tick,
      refresh: refresh,
      record: record,
      addTrack: addTrack,
      removeTrack: removeTrack,
      stats: stats,
      frameSettings: frameSettings,
      isActive: function () { return state.active; },
      isPlaying: function () { return state.playing; },
    };
  }

  global.DitherAnimation = { create: create };
}(typeof window !== 'undefined' ? window : globalThis));