/* smoke-animation.js - the timeline, without the rest of the tour.
 * Selected by `node tools/smoke.js animation` / `npm run smoke:animation`.
 */
(async function () {
  const checks = [];
  function check(name, ok, detail) {
    checks.push({ name: name, ok: !!ok, detail: detail === undefined ? null : detail });
  }
  const wait = function (ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); };
  async function until(fn, timeout) {
    const end = Date.now() + (timeout || 1000);
    while (Date.now() < end) {
      if (fn()) return true;
      await wait(40);
    }
    return false;
  }

  const started = window.__dither.animationStart();
  await wait(80);
  const stats = window.__dither.animationStats();
  check('Animate the still opens the timeline',
    started === true && !!stats && stats.active === true &&
      document.getElementById('animation-panel').hidden === false);
  check('the timeline starts with one track and a frame count',
    !!stats && stats.tracks.length >= 1 && stats.total === stats.duration * stats.fps,
    stats ? stats.total : null);
  check('the track is a real property with a range',
    !!stats && stats.tracks[0].property === 'ditherStrength' &&
      stats.tracks[0].from !== stats.tracks[0].to);

  window.__dither.animationTick(0);
  const first = window.__dither.canvasHash();
  window.__dither.animationTick(stats.total - 1);
  await wait(50);
  check('moving the playhead re-renders the proof', window.__dither.canvasHash() !== first);
  check('the transport is under the proof', document.getElementById('animation-transport').hidden === false);
  check('the menu state reports the frame',
    !!window.DS.state().animation && window.DS.state().animation.frame === stats.total - 1);

  // A fixed ordered screen ignores the seed on its own, so the timeline drifts
  // the screen instead of leaving the track dead.
  window.__dither.setSetting('algorithm', 'bayer8');
  window.__dither.animationAddTrack('seed');
  const seeded = window.__dither.animationStats();
  const seedStart = window.__dither.animationFrameSettings(0);
  const seedEnd = window.__dither.animationFrameSettings(seeded.total - 1);
  check('a seed track is added to the ordered press',
    seeded.tracks.some(function (track) { return track.property === 'seed'; }));
  check('the ordered seed track moves the screen',
    seedStart.screenShift !== seedEnd.screenShift,
    seedStart.screenShift + ' -> ' + seedEnd.screenShift);

  // MediaRecorder writes WebM without Duration. Record a real canvas stream,
  // patch it the way download() does, and read the duration back out of the
  // container rather than trusting the library's return shape.
  const durationOf = async function (blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    for (let i = 0; i < bytes.length - 12; i++) {
      if (bytes[i] !== 0x44 || bytes[i + 1] !== 0x89) continue;
      const size = bytes[i + 2];
      const length = size & 0x7f;
      if (!(size & 0x80) || (length !== 4 && length !== 8)) continue;
      const view = new DataView(bytes.buffer, i + 3, length);
      const value = length === 4 ? view.getFloat32(0) : view.getFloat64(0);
      if (Number.isFinite(value) && value > 0) return value;
    }
    return 0;
  };
  // A blank canvas emits no frames, so paint a tiny offscreen one while the
  // recorder runs; the proof itself stays untouched.
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  // Keep it in the compositor but out of the way: an off-screen canvas is
  // throttled hard enough that MediaRecorder sometimes emits no frames at all.
  canvas.style.cssText = 'position:fixed;left:0;top:0;width:96px;height:96px;opacity:0.01;pointer-events:none';
  document.body.appendChild(canvas);
  const paint = canvas.getContext('2d');
  paint.fillRect(0, 0, canvas.width, canvas.height);
  const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9' : 'video/webm;codecs=vp8';
  const stream = canvas.captureStream(12);
  const track = stream.getVideoTracks()[0];
  const chunks = [];
  let signalData = function () {};
  const firstData = new Promise(function (resolve) { signalData = resolve; });
  const recorder = new MediaRecorder(stream, { mimeType: mime });
  recorder.ondataavailable = function (event) {
    if (event.data && event.data.size) { chunks.push(event.data); signalData(); }
  };
  const stopped = new Promise(function (resolve) { recorder.onstop = resolve; });
  recorder.start(100);
  const painter = setInterval(function () {
    paint.fillStyle = paint.fillStyle === '#ffffff' ? '#000000' : '#ffffff';
    paint.fillRect(0, 0, canvas.width, canvas.height);
    if (track && typeof track.requestFrame === 'function') track.requestFrame();
  }, 50);
  await Promise.race([firstData, wait(2500)]);
  if (recorder.state === 'recording') recorder.requestData();
  await wait(400);
  recorder.stop();
  await stopped;
  // Let the last dataavailable land before the chunks are read.
  await until(function () { return chunks.length > 0; }, 2000);
  clearInterval(painter);
  stream.getTracks().forEach(function (track) { track.stop(); });
  canvas.remove();
  const raw = new Blob(chunks, { type: 'video/webm' });
  const beforeDuration = await durationOf(raw);
  const fixed = await window.ysFixWebmDuration(raw, 700, { logger: false });
  const afterDuration = await durationOf(fixed);
  check('MediaRecorder leaves the raw WebM without a duration', beforeDuration === 0);
  check('the patched WebM carries a duration', Math.abs(afterDuration - 700) < 60,
    afterDuration + ' ms · raw ' + raw.size + ' B · fixed ' + fixed.size + ' B');

  window.__dither.animationStop();
  await wait(80);
  check('closing the timeline returns the still',
    window.__dither.animationStats().active === false &&
      document.getElementById('animation-panel').hidden === true);

  const failed = checks.filter(function (c) { return !c.ok; });
  return {
    ok: !failed.length,
    checks: checks,
    failures: failed.map(function (c) { return c.name; }),
    notes: { suite: 'animation', stats: window.__dither.animationStats() },
  };
}());
