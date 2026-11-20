/* layers.js - offline object detection, interactive mask selection & layer compositing.
 *
 * Zero dependencies, runs identically in Node (unit tests) and in the desktop
 * renderer (`window.DitherLayers`). Provides:
 *   - detectObjects(imageData, opts)  border-contrast + saliency + connected-component segmentation
 *   - magicSelect(imageData, xNorm, yNorm, opts)  edge-aware flood-fill / global colour wand
 *   - combineMasks(base, delta, op)   replace / add / subtract mask operations
 *   - paintMask(mask, w, h, xNorm, yNorm, radiusPx, value)  soft brush refinement
 *   - featherMask(mask, w, h, radius) fast separable box blur on Uint8Array masks
 *   - compositeLayers(base, w, h, overlays)  alpha-blends per-layer rendered proofs
 *   - drawMaskOverlay(rgba, w, h, mask, maskW, maskH, invert)  visual-only mask tint + contour
 */
(function (global) {
  'use strict';

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function colorDistSq(r1, g1, b1, r2, g2, b2) {
    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    // Perceptual redmean-like RGB weighting: fast and separates hues cleanly.
    return 2 * dr * dr + 4 * dg * dg + 3 * db * db;
  }

  function lumaOf(r, g, b) {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  // Downsample an RGBA ImageData-like object to at most `maxSide` on its longest edge.
  function downsampleRGBA(imageData, maxSide) {
    const sw = imageData.width;
    const sh = imageData.height;
    const longest = Math.max(sw, sh);
    const scale = longest > maxSide ? maxSide / longest : 1;
    const w = Math.max(2, Math.round(sw * scale));
    const h = Math.max(2, Math.round(sh * scale));
    const out = new Uint8Array(w * h * 3);
    const src = imageData.data;
    const sxStep = sw / w;
    const syStep = sh / h;
    for (let y = 0; y < h; y++) {
      const y0 = Math.floor(y * syStep);
      const y1 = Math.min(sh, Math.max(y0 + 1, Math.floor((y + 1) * syStep)));
      for (let x = 0; x < w; x++) {
        const x0 = Math.floor(x * sxStep);
        const x1 = Math.min(sw, Math.max(x0 + 1, Math.floor((x + 1) * sxStep)));
        let r = 0, g = 0, b = 0, c = 0;
        for (let py = y0; py < y1; py++) {
          const row = py * sw;
          for (let px = x0; px < x1; px++) {
            const p = (row + px) * 4;
            r += src[p]; g += src[p + 1]; b += src[p + 2]; c++;
          }
        }
        const i = (y * w + x) * 3;
        out[i] = Math.round(r / c);
        out[i + 1] = Math.round(g / c);
        out[i + 2] = Math.round(b / c);
      }
    }
    return { rgb: out, w: w, h: h };
  }

  // Fast separable box blur on a 0..255 mask buffer.
  function featherMask(mask, w, h, radius) {
    const r = Math.max(0, Math.min(24, Math.round(radius || 0)));
    if (!r || w < 2 || h < 2) return mask;
    const tmp = new Float32Array(w * h);
    const out = new Uint8Array(w * h);
    const span = r * 2 + 1;
    // Horizontal pass
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let sum = 0;
      for (let dx = -r; dx <= r; dx++) {
        sum += mask[row + clamp(dx, 0, w - 1)];
      }
      for (let x = 0; x < w; x++) {
        tmp[row + x] = sum / span;
        const left = clamp(x - r, 0, w - 1);
        const right = clamp(x + r + 1, 0, w - 1);
        sum += mask[row + right] - mask[row + left];
      }
    }
    // Vertical pass
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let dy = -r; dy <= r; dy++) {
        sum += tmp[clamp(dy, 0, h - 1) * w + x];
      }
      for (let y = 0; y < h; y++) {
        out[y * w + x] = clamp(Math.round(sum / span), 0, 255);
        const top = clamp(y - r, 0, h - 1);
        const bot = clamp(y + r + 1, 0, h - 1);
        sum += tmp[bot * w + x] - tmp[top * w + x];
      }
    }
    return out;
  }

  // Bilinearly upsample a small 0..255 mask to target dimensions and sharpen
  // slightly so object boundaries stay crisp before optional feathering.
  function upsampleMask(small, sw, sh, tw, th, feather) {
    let out;
    if (sw === tw && sh === th) {
      out = small.slice();
    } else {
      out = new Uint8Array(tw * th);
      const sxMax = sw - 1;
      const syMax = sh - 1;
      const denomX = Math.max(1, tw - 1);
      const denomY = Math.max(1, th - 1);
      for (let y = 0; y < th; y++) {
        const sy = (y / denomY) * syMax;
        const y0 = Math.floor(sy);
        const y1 = Math.min(syMax, y0 + 1);
        const fy = sy - y0;
        const r0 = y0 * sw;
        const r1 = y1 * sw;
        const dstRow = y * tw;
        for (let x = 0; x < tw; x++) {
          const sx = (x / denomX) * sxMax;
          const x0 = Math.floor(sx);
          const x1 = Math.min(sxMax, x0 + 1);
          const fx = sx - x0;
          const a = small[r0 + x0] + (small[r0 + x1] - small[r0 + x0]) * fx;
          const b = small[r1 + x0] + (small[r1 + x1] - small[r1 + x0]) * fx;
          const v = a + (b - a) * fy;
          // Crisp anti-aliased edge transition around midpoint 128.
          out[dstRow + x] = v < 64 ? 0 : v > 192 ? 255 : Math.round(((v - 64) / 128) * 255);
        }
      }
    }
    return feather > 0 ? featherMask(out, tw, th, feather) : out;
  }

  // 3x3 morphological pass on binary 0/1 mask (mode: 1 = dilate, 0 = erode).
  function morph(bin, w, h, dilate) {
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - 1);
      const y1 = Math.min(h - 1, y + 1);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - 1);
        const x1 = Math.min(w - 1, x + 1);
        let hits = 0;
        let total = 0;
        for (let ny = y0; ny <= y1; ny++) {
          const row = ny * w;
          for (let nx = x0; nx <= x1; nx++) {
            hits += bin[row + nx];
            total++;
          }
        }
        out[y * w + x] = dilate ? (hits >= 3 ? 1 : 0) : (hits >= total - 2 ? 1 : 0);
      }
    }
    return out;
  }

  // Otsu threshold on a Float32Array normalised to 0..1.
  function otsuThreshold(values) {
    const hist = new Uint32Array(64);
    const n = values.length;
    for (let i = 0; i < n; i++) {
      const b = clamp(Math.floor(values[i] * 63), 0, 63);
      hist[b]++;
    }
    let totalMean = 0;
    for (let i = 0; i < 64; i++) totalMean += i * hist[i];
    let wB = 0;
    let sumB = 0;
    let bestVar = -1;
    let bestT = 22;
    for (let t = 0; t < 64; t++) {
      wB += hist[t];
      if (!wB) continue;
      const wF = n - wB;
      if (!wF) break;
      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (totalMean - sumB) / wF;
      const diff = mB - mF;
      const between = wB * wF * diff * diff;
      if (between > bestVar) {
        bestVar = between;
        bestT = t;
      }
    }
    return (bestT + 0.5) / 64;
  }

  // Estimate 3 dominant border background colours using deterministic k-means.
  function borderClusters(rgb, w, h) {
    const samples = [];
    const pad = Math.max(1, Math.round(Math.min(w, h) * 0.04));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (x >= pad && x < w - pad && y >= pad && y < h - pad) continue;
        const p = (y * w + x) * 3;
        samples.push([rgb[p], rgb[p + 1], rgb[p + 2]]);
      }
    }
    if (!samples.length) return [[0, 0, 0]];
    // Seed 3 centroids evenly across the perimeter sample list.
    const k = Math.min(3, samples.length);
    const centroids = [];
    for (let i = 0; i < k; i++) {
      const s = samples[Math.floor((i * samples.length) / k)];
      centroids.push([s[0], s[1], s[2]]);
    }
    for (let iter = 0; iter < 6; iter++) {
      const sums = centroids.map(function () { return [0, 0, 0, 0]; });
      for (let i = 0; i < samples.length; i++) {
        const s = samples[i];
        let best = 0, bestD = Infinity;
        for (let c = 0; c < k; c++) {
          const d = colorDistSq(s[0], s[1], s[2], centroids[c][0], centroids[c][1], centroids[c][2]);
          if (d < bestD) { bestD = d; best = c; }
        }
        sums[best][0] += s[0];
        sums[best][1] += s[1];
        sums[best][2] += s[2];
        sums[best][3]++;
      }
      for (let c = 0; c < k; c++) {
        if (sums[c][3] > 0) {
          centroids[c][0] = sums[c][0] / sums[c][3];
          centroids[c][1] = sums[c][1] / sums[c][3];
          centroids[c][2] = sums[c][2] / sums[c][3];
        }
      }
    }
    return centroids;
  }

  // Name a detected object cleanly from its position in the frame.
  function positionName(cx, cy, index) {
    if (index === 0 && cx > 0.28 && cx < 0.72 && cy > 0.22 && cy < 0.78) return 'Main subject';
    const v = cy < 0.36 ? 'Upper' : cy > 0.64 ? 'Lower' : '';
    const h = cx < 0.36 ? 'left' : cx > 0.64 ? 'right' : 'center';
    if (v) return v + ' ' + h + ' object';
    if (h !== 'center') return (h === 'left' ? 'Left' : 'Right') + ' object';
    return 'Object ' + (index + 1);
  }

  // Automatic multi-object detection: border-background distance + Sobel edge
  // energy + Otsu thresholding + connected-component extraction. Falls back to
  // highlight/salience segmentation on busy full-frame scenes so it always
  // yields useful selectable object layers.
  function detectObjects(imageData, options) {
    if (!imageData || !imageData.data || imageData.width < 2 || imageData.height < 2) return [];
    const opts = options || {};
    const maxObjects = clamp(Math.round(opts.maxObjects || 4), 1, 6);
    const feather = clamp(Math.round(opts.feather !== undefined ? opts.feather : 2), 0, 12);
    const down = downsampleRGBA(imageData, 160);
    const rgb = down.rgb;
    const w = down.w;
    const h = down.h;
    const n = w * h;
    const bg = borderClusters(rgb, w, h);

    // Compute luminance and colour-distance-from-border map.
    const lumaBuf = new Float32Array(n);
    const distBuf = new Float32Array(n);
    let maxDist = 1;
    let sumLuma = 0;
    for (let i = 0; i < n; i++) {
      const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
      const lv = lumaOf(r, g, b);
      lumaBuf[i] = lv;
      sumLuma += lv;
      let minD = Infinity;
      for (let c = 0; c < bg.length; c++) {
        const d = colorDistSq(r, g, b, bg[c][0], bg[c][1], bg[c][2]);
        if (d < minD) minD = d;
      }
      const rootD = Math.sqrt(minD);
      distBuf[i] = rootD;
      if (rootD > maxDist) maxDist = rootD;
    }

    // Add local gradient energy so detailed subjects separate cleanly from flat
    // backdrops even when their hues overlap slightly.
    const score = new Float32Array(n);
    const invMaxDist = 1 / Math.max(40, maxDist);
    for (let y = 0; y < h; y++) {
      const ym = Math.max(0, y - 1);
      const yp = Math.min(h - 1, y + 1);
      for (let x = 0; x < w; x++) {
        const xm = Math.max(0, x - 1);
        const xp = Math.min(w - 1, x + 1);
        const gx = lumaBuf[y * w + xp] - lumaBuf[y * w + xm];
        const gy = lumaBuf[yp * w + x] - lumaBuf[ym * w + x];
        const edge = Math.min(1, Math.sqrt(gx * gx + gy * gy) / 110);
        const idx = y * w + x;
        const nx = (x / Math.max(1, w - 1)) * 2 - 1;
        const ny = (y / Math.max(1, h - 1)) * 2 - 1;
        const centerPrior = 0.84 + 0.16 * Math.exp(-(nx * nx + ny * ny) * 0.7);
        score[idx] = clamp((distBuf[idx] * invMaxDist * 0.82 + edge * 0.24) * centerPrior, 0, 1);
      }
    }

    const thresh = Math.max(0.14, Math.min(0.68, otsuThreshold(score) * 0.92));
    let bin = new Uint8Array(n);
    for (let i = 0; i < n; i++) bin[i] = score[i] >= thresh ? 1 : 0;
    // Close small gaps inside dithered or textured objects, then clean noise.
    bin = morph(morph(bin, w, h, true), w, h, false);

    // Connected-component labeling (4-connected BFS).
    function extractComponents(binary) {
      const visited = new Uint8Array(n);
      const queue = new Int32Array(n);
      const comps = [];
      for (let i = 0; i < n; i++) {
        if (!binary[i] || visited[i]) continue;
        let head = 0, tail = 0;
        queue[tail++] = i;
        visited[i] = 1;
        let sumX = 0, sumY = 0, minX = w, minY = h, maxX = 0, maxY = 0;
        let scoreSum = 0;
        const pixels = [];
        while (head < tail) {
          const cur = queue[head++];
          pixels.push(cur);
          const cy = (cur / w) | 0;
          const cx = cur - cy * w;
          sumX += cx; sumY += cy;
          scoreSum += score[cur];
          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;
          if (cx > 0 && binary[cur - 1] && !visited[cur - 1]) { visited[cur - 1] = 1; queue[tail++] = cur - 1; }
          if (cx + 1 < w && binary[cur + 1] && !visited[cur + 1]) { visited[cur + 1] = 1; queue[tail++] = cur + 1; }
          if (cy > 0 && binary[cur - w] && !visited[cur - w]) { visited[cur - w] = 1; queue[tail++] = cur - w; }
          if (cy + 1 < h && binary[cur + w] && !visited[cur + w]) { visited[cur + w] = 1; queue[tail++] = cur + w; }
        }
        const coverage = pixels.length / n;
        if (coverage < 0.012 || coverage > 0.92) continue;
        comps.push({
          pixels: pixels,
          coverage: coverage,
          cx: sumX / pixels.length / w,
          cy: sumY / pixels.length / h,
          bbox: {
            x: minX / w,
            y: minY / h,
            w: (maxX - minX + 1) / w,
            h: (maxY - minY + 1) / h,
          },
          rank: coverage * (0.4 + scoreSum / pixels.length),
        });
      }
      comps.sort(function (a, b) { return b.rank - a.rank; });
      return comps;
    }

    let comps = extractComponents(bin);

    // Fallback for low-border-contrast / busy full-frame paintings: split by
    // prominent bright subject regions above mean luminance so the user still
    // gets meaningful editable object layers.
    if (!comps.length) {
      const meanL = sumLuma / n;
      const hiBin = new Uint8Array(n);
      for (let i = 0; i < n; i++) hiBin[i] = lumaBuf[i] > meanL + 28 ? 1 : 0;
      comps = extractComponents(morph(hiBin, w, h, true));
    }

    return comps.slice(0, maxObjects).map(function (comp, index) {
      const smallMask = new Uint8Array(n);
      for (let j = 0; j < comp.pixels.length; j++) smallMask[comp.pixels[j]] = 255;
      const fullMask = upsampleMask(smallMask, w, h, imageData.width, imageData.height, feather);
      return {
        name: positionName(comp.cx, comp.cy, index),
        mask: fullMask,
        maskW: imageData.width,
        maskH: imageData.height,
        bbox: comp.bbox,
        coverage: Math.round(comp.coverage * 1000) / 10,
      };
    });
  }

  // Interactive click-to-select object (edge-aware smart wand).
  function magicSelect(imageData, xNorm, yNorm, options) {
    if (!imageData || !imageData.data || imageData.width < 2 || imageData.height < 2) {
      return { mask: new Uint8Array(0), coverage: 0 };
    }
    const opts = options || {};
    const tolerance = clamp(Number(opts.tolerance !== undefined ? opts.tolerance : 34), 1, 100);
    const feather = clamp(Math.round(opts.feather !== undefined ? opts.feather : 2), 0, 12);
    const contiguous = opts.contiguous !== false;

    const down = downsampleRGBA(imageData, 240);
    const rgb = down.rgb;
    const w = down.w;
    const h = down.h;
    const n = w * h;
    const sx = clamp(Math.round(clamp(xNorm, 0, 1) * (w - 1)), 0, w - 1);
    const sy = clamp(Math.round(clamp(yNorm, 0, 1) * (h - 1)), 0, h - 1);

    // 3x3 average seed colour resists single-pixel noise or dither speckles.
    let sr = 0, sg = 0, sb = 0, sc = 0;
    for (let dy = -1; dy <= 1; dy++) {
      const ny = clamp(sy + dy, 0, h - 1);
      for (let dx = -1; dx <= 1; dx++) {
        const nx = clamp(sx + dx, 0, w - 1);
        const p = (ny * w + nx) * 3;
        sr += rgb[p]; sg += rgb[p + 1]; sb += rgb[p + 2]; sc++;
      }
    }
    sr /= sc; sg /= sc; sb /= sc;

    // Max squared perceptual distance scaled smoothly across 1..100 tolerance.
    const maxDist = Math.pow(tolerance * 4.4, 2);
    const neighborDist = Math.pow(Math.max(12, tolerance * 2.3), 2);
    const small = new Uint8Array(n);
    let count = 0;

    if (!contiguous) {
      for (let i = 0; i < n; i++) {
        const p = i * 3;
        if (colorDistSq(rgb[p], rgb[p + 1], rgb[p + 2], sr, sg, sb) <= maxDist) {
          small[i] = 255;
          count++;
        }
      }
    } else {
      const visited = new Uint8Array(n);
      const queue = new Int32Array(n);
      const start = sy * w + sx;
      let head = 0, tail = 0;
      queue[tail++] = start;
      visited[start] = 1;
      small[start] = 255;
      count = 1;
      while (head < tail) {
        const cur = queue[head++];
        const cp = cur * 3;
        const cr = rgb[cp], cg = rgb[cp + 1], cb = rgb[cp + 2];
        const cy = (cur / w) | 0;
        const cx = cur - cy * w;
        const neighbors = [];
        if (cx > 0) neighbors.push(cur - 1);
        if (cx + 1 < w) neighbors.push(cur + 1);
        if (cy > 0) neighbors.push(cur - w);
        if (cy + 1 < h) neighbors.push(cur + w);
        for (let j = 0; j < neighbors.length; j++) {
          const nb = neighbors[j];
          if (visited[nb]) continue;
          const np = nb * 3;
          const nr = rgb[np], ng = rgb[np + 1], nbB = rgb[np + 2];
          if (colorDistSq(nr, ng, nbB, sr, sg, sb) <= maxDist &&
              colorDistSq(nr, ng, nbB, cr, cg, cb) <= neighborDist) {
            visited[nb] = 1;
            small[nb] = 255;
            queue[tail++] = nb;
            count++;
          }
        }
      }
    }

    const mask = upsampleMask(small, w, h, imageData.width, imageData.height, feather);
    return {
      mask: mask,
      maskW: imageData.width,
      maskH: imageData.height,
      coverage: Math.round((count / n) * 1000) / 10,
    };
  }

  function combineMasks(baseMask, deltaMask, op) {
    if (!baseMask || op === 'replace') return deltaMask.slice();
    const len = Math.min(baseMask.length, deltaMask.length);
    const out = baseMask.slice();
    if (op === 'add') {
      for (let i = 0; i < len; i++) {
        if (deltaMask[i] > out[i]) out[i] = deltaMask[i];
      }
    } else if (op === 'subtract') {
      for (let i = 0; i < len; i++) {
        const next = out[i] - deltaMask[i];
        out[i] = next > 0 ? next : 0;
      }
    }
    return out;
  }

  function paintMask(mask, w, h, xNorm, yNorm, radiusPx, value) {
    if (!mask || w < 1 || h < 1) return mask;
    const cx = clamp(xNorm, 0, 1) * (w - 1);
    const cy = clamp(yNorm, 0, 1) * (h - 1);
    const r = Math.max(2, radiusPx || 24);
    const r2 = r * r;
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(h - 1, Math.ceil(cy + r));
    const erase = value <= 0;
    for (let y = y0; y <= y1; y++) {
      const dy = y - cy;
      const row = y * w;
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        const falloff = 1 - Math.sqrt(d2) / r;
        const strength = clamp(falloff * 2.2, 0, 1);
        const i = row + x;
        if (erase) {
          mask[i] = Math.round(mask[i] * (1 - strength));
        } else {
          const target = Math.round(255 * strength);
          if (target > mask[i]) mask[i] = target;
        }
      }
    }
    return mask;
  }

  // Composite object layers over a base RGBA buffer. Each overlay entry carries
  // `{ data, mask, maskW, maskH, opacity, invert }`.
  function compositeLayers(baseData, w, h, overlays) {
    const out = new Uint8ClampedArray(baseData);
    for (let li = 0; li < overlays.length; li++) {
      const layer = overlays[li];
      if (!layer || !layer.data || !layer.mask) continue;
      const op = clamp((layer.opacity !== undefined ? layer.opacity : 100) / 100, 0, 1);
      if (op <= 0) continue;
      const mw = layer.maskW || w;
      const mh = layer.maskH || h;
      const mask = layer.mask;
      const src = layer.data;
      const inv = !!layer.invert;
      const sameDim = mw === w && mh === h;
      const sxScale = mw / w;
      const syScale = mh / h;
      for (let y = 0; y < h; y++) {
        const my = sameDim ? y : Math.min(mh - 1, Math.floor(y * syScale));
        const mRow = my * mw;
        const row = y * w;
        for (let x = 0; x < w; x++) {
          const mx = sameDim ? x : Math.min(mw - 1, Math.floor(x * sxScale));
          let mv = mask[mRow + mx];
          if (inv) mv = 255 - mv;
          if (!mv) continue;
          const a = (mv / 255) * op;
          const p = (row + x) * 4;
          if (a >= 0.996) {
            out[p] = src[p];
            out[p + 1] = src[p + 1];
            out[p + 2] = src[p + 2];
            out[p + 3] = src[p + 3];
          } else {
            const ia = 1 - a;
            out[p] = Math.round(out[p] * ia + src[p] * a);
            out[p + 1] = Math.round(out[p + 1] * ia + src[p + 1] * a);
            out[p + 2] = Math.round(out[p + 2] * ia + src[p + 2] * a);
            out[p + 3] = Math.round(out[p + 3] * ia + src[p + 3] * a);
          }
        }
      }
    }
    return out;
  }

  // Visual-only mask highlight + crisp accent contour drawn onto a display copy.
  function drawMaskOverlay(rgba, w, h, mask, maskW, maskH, invert) {
    if (!mask) return rgba;
    const out = new Uint8ClampedArray(rgba);
    const mw = maskW || w;
    const mh = maskH || h;
    const sxScale = mw / w;
    const syScale = mh / h;
    const inv = !!invert;
    const sample = function (x, y) {
      const mx = clamp(Math.floor(x * sxScale), 0, mw - 1);
      const my = clamp(Math.floor(y * syScale), 0, mh - 1);
      const v = mask[my * mw + mx];
      return inv ? 255 - v : v;
    };
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const v = sample(x, y);
        if (v < 96) continue;
        const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1 ||
          sample(x - 1, y) < 96 || sample(x + 1, y) < 96 ||
          sample(x, y - 1) < 96 || sample(x, y + 1) < 96;
        const p = (row + x) * 4;
        if (edge) {
          // Crisp accent outline (#84a9ff) around the detected object boundary.
          out[p] = 132; out[p + 1] = 169; out[p + 2] = 255; out[p + 3] = 255;
        } else {
          // Subtle translucent blue wash inside the active mask.
          out[p] = Math.round(out[p] * 0.82 + 132 * 0.18);
          out[p + 1] = Math.round(out[p + 1] * 0.82 + 169 * 0.18);
          out[p + 2] = Math.round(out[p + 2] * 0.82 + 255 * 0.18);
        }
      }
    }
    return out;
  }

  const api = {
    detectObjects: detectObjects,
    magicSelect: magicSelect,
    combineMasks: combineMasks,
    paintMask: paintMask,
    featherMask: featherMask,
    compositeLayers: compositeLayers,
    drawMaskOverlay: drawMaskOverlay,
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.DitherLayers = api;
}(typeof window !== 'undefined' ? window : globalThis));
