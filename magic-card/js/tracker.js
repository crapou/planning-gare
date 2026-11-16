// Mode B controller: feeds downscaled frames to the OpenCV worker, orders and
// smooths the corners, holds the last pose briefly, then falls back to Mode A.

import { OneEuro, dist, lerp, quadIsConvex, quadArea } from './util.js';

const DW = 192; // detection width (portrait frame ≈ 192 × 256)

export class Tracker {
  constructor() {
    this.worker = null;
    this.status = 'off';     // off | loading | ready | error
    this.busy = false;
    this.filters = Array.from({ length: 8 }, () => new OneEuro(1.1, 0.025, 1.0));
    this.quad = null;        // smoothed, preview coords
    this.raw = null;
    this.lastSeen = -1e9;
    this.frameId = 0;
    this.detMs = 0;
    this.detFps = 0;
    this._fpsT = performance.now();
    this._fpsN = 0;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.map = null;         // mapping info for the in-flight frame
    this.out = null;         // quad currently shown
    this.source = 'A';
    this.trans = null;       // A <-> B transition
    this.listeners = new Set();
  }

  onStatus(fn) { this.listeners.add(fn); }
  _setStatus(s) { this.status = s; this.listeners.forEach((f) => f(s)); }

  /** Lazy-loads OpenCV in the worker (≈10 MB, cached by the service worker). */
  load() {
    if (this.worker) return this.readyP;
    this._setStatus('loading');
    this.worker = new Worker('js/tracker-worker.js');
    this.readyP = new Promise((resolve) => {
      this.worker.onmessage = (e) => {
        const m = e.data;
        if (m.type === 'ready') { this._setStatus('ready'); resolve(true); }
        else if (m.type === 'error') { this._setStatus('error'); this.errorMsg = m.message; resolve(false); }
        else if (m.type === 'result') this._onResult(m);
      };
      this.worker.onerror = (err) => { this._setStatus('error'); this.errorMsg = err.message; resolve(false); };
    });
    this.worker.postMessage({ type: 'init' });
    return this.readyP;
  }

  get ready() { return this.status === 'ready'; }

  /** Send the current video frame (visible crop) if the worker is idle. */
  grab(video, g) {
    if (!this.ready || this.busy || !g.ok) return;
    const sw = DW, sh = Math.round((DW * g.crop.h) / g.crop.w);
    if (this.canvas.width !== sw || this.canvas.height !== sh) { this.canvas.width = sw; this.canvas.height = sh; }
    this.ctx.drawImage(video, g.crop.x, g.crop.y, g.crop.w, g.crop.h, 0, 0, sw, sh);
    const img = this.ctx.getImageData(0, 0, sw, sh);
    this.map = { sw, sh, pw: g.pw, ph: g.ph };
    let hint = null;
    if (this.raw && performance.now() - this.lastSeen < 500) {
      // previous centre, converted back to detection coords (un-mirrored)
      const cx = (this.raw[0][0] + this.raw[2][0]) / 2, cy = (this.raw[0][1] + this.raw[2][1]) / 2;
      hint = [((g.pw - cx) * sw) / g.pw, (cy * sh) / g.ph];
    }
    this.busy = true;
    this.worker.postMessage({ type: 'frame', id: ++this.frameId, w: sw, h: sh, buf: img.data.buffer, hint }, [img.data.buffer]);
  }

  _onResult(m) {
    this.busy = false;
    this.detMs = m.ms;
    this._fpsN++;
    const now = performance.now();
    if (now - this._fpsT > 1000) { this.detFps = (this._fpsN * 1000) / (now - this._fpsT); this._fpsN = 0; this._fpsT = now; }
    if (!m.quad || !this.map) return;
    const { sw, sh, pw, ph } = this.map;
    // detection coords -> preview coords (mirrored like the preview)
    let q = m.quad.map(([x, y]) => [pw - (x * pw) / sw, (y * ph) / sh]);
    q = orderForCard(q);
    if (!quadIsConvex(q)) return;
    // keep corner identity stable across frames (no 90°/180° flips)
    if (this.quad && now - this.lastSeen < 600) {
      let bestK = 0, bestD = Infinity;
      for (let k = 0; k < 4; k++) {
        let s = 0;
        for (let i = 0; i < 4; i++) s += dist(q[(i + k) % 4], this.quad[i]);
        if (s < bestD) { bestD = s; bestK = k; }
      }
      q = [0, 1, 2, 3].map((i) => q[(i + bestK) % 4]);
      const size = Math.sqrt(quadArea(this.quad));
      if (bestD / 4 > size * 0.35) this.filters.forEach((f) => f.reset());
    } else {
      this.filters.forEach((f) => f.reset());
    }
    this.raw = q;
    this.quad = q.map(([x, y], i) => [this.filters[i * 2].filter(x, now), this.filters[i * 2 + 1].filter(y, now)]);
    this.lastSeen = now;
  }

  /** Quad to display now: tracked pose, held for holdMs, then Mode A with a short blend. */
  current(now, fallbackQuad, holdMs = 300) {
    const tracked = this.quad && now - this.lastSeen < holdMs;
    const src = tracked ? 'B' : 'A';
    const target = tracked ? this.quad : fallbackQuad;
    if (src !== this.source) {
      this.trans = { from: this.out || target, t0: now, dur: src === 'A' ? 220 : 140 };
      this.source = src;
    }
    let q = target;
    if (this.trans) {
      let t = (now - this.trans.t0) / this.trans.dur;
      if (t >= 1) { this.trans = null; } else {
        t = t * t * (3 - 2 * t);
        q = target.map((p, i) => [lerp(this.trans.from[i][0], p[0], t), lerp(this.trans.from[i][1], p[1], t)]);
      }
    }
    this.out = q;
    return q;
  }

  reset() {
    this.quad = null; this.raw = null; this.out = null; this.lastSeen = -1e9; this.source = 'A'; this.trans = null;
    this.filters.forEach((f) => f.reset());
  }
}

// Clockwise from top-left; the card's short edge becomes its top edge.
function orderForCard(q) {
  const cx = q.reduce((s, p) => s + p[0], 0) / 4, cy = q.reduce((s, p) => s + p[1], 0) / 4;
  const s = q.slice().sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
  let k = 0, m = Infinity;
  s.forEach((p, i) => { if (p[0] + p[1] < m) { m = p[0] + p[1]; k = i; } });
  let o = [0, 1, 2, 3].map((i) => s[(i + k) % 4]);
  if (dist(o[0], o[1]) > dist(o[1], o[2]) * 1.05) o = [o[3], o[0], o[1], o[2]]; // card lying sideways
  return o;
}
