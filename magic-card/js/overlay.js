// The fake card drawn over the live preview: placement (matrix3d homography),
// lighting matched to the real card underneath, grain, and the reveal effects.

import { S } from './store.js';
import { CW, CH, PreparedCard, NEUTRAL_LIGHT, loadCardSource } from './cards.js';
import { quadToMatrix3d, squareToQuad, invert3, applyH, clamp } from './util.js';

const SW = 96, SH = 128; // lighting sample resolution (portrait, same aspect as preview)

export class Overlay {
  constructor() {
    this.fx = document.getElementById('overlay-fx');
    this.el = document.getElementById('card-el');
    this.canvas = document.getElementById('card-canvas');
    this.grain = this.el.querySelector('.grain');
    this.el.style.width = CW + 'px';
    this.el.style.height = CH + 'px';
    this.canvas.width = CW;
    this.canvas.height = CH;
    this.ctx = this.canvas.getContext('2d');
    this.grain.style.backgroundImage = `url(${makeNoise()})`;
    this.sample = document.createElement('canvas');
    this.sample.width = SW; this.sample.height = SH;
    this.sctx = this.sample.getContext('2d', { alpha: false });
    this.visible = true;
    this.prepared = null;
    this.light = clone(NEUTRAL_LIGHT);
    this.rendered = null;
    this.lastM = '';
    this.quad = null;
    this.code = null;
    this.anim = null;
  }

  /** (Re)builds the card texture with the current realism settings. */
  async setCard(code, displayW) {
    this.code = code;
    const token = (this._tok = {});
    const src = await loadCardSource(code);
    if (token !== this._tok) return;
    this.source = src;
    this.rebuild(displayW);
  }

  rebuild(displayW) {
    if (!this.source) return;
    const R = S.realism;
    const k = CW / Math.max(60, displayW || 160); // canvas px per screen px
    this.prepared = new PreparedCard(this.source.img, {
      mirror: R.mirror,
      blurPx: R.blur * k,
      featherPx: R.soft * k,
      radiusFrac: R.radius,
    });
    this.el.style.borderRadius = `${R.radius * CW}px`;
    this.grain.style.opacity = R.grain;
    this.rendered = null;
    this.paint(true);
  }

  effectiveLight() {
    const R = S.realism;
    const base = R.autoLight ? this.light : NEUTRAL_LIGHT;
    const m = R.brightness;
    return {
      w: base.w.map((c) => c.map((v) => clamp(v * m, 0, 255))),
      b: base.b.map((v) => clamp(v * Math.min(1.4, m), 0, 255)),
      contrast: R.contrast,
    };
  }

  paint(force = false) {
    if (!this.prepared) return;
    const L = this.effectiveLight();
    if (!force && this.rendered && lightDiff(L, this.rendered) < 2.5) return;
    this.ctx.putImageData(this.prepared.render(L), 0, 0);
    this.rendered = L;
  }

  /** Places the card on a quad (TL, TR, BR, BL) in preview CSS px. */
  setQuad(q) {
    if (!q) return;
    this.quad = q;
    const m = quadToMatrix3d(q, CW, CH);
    if (m && m !== this.lastM) { this.el.style.transform = m; this.lastM = m; }
  }

  /**
   * Reads the live frame under the card (the REAL card is there) and estimates the paper
   * white in each quadrant + the black level, so the fake card is lit like the real one.
   */
  sampleLight(video, g, q) {
    if (!g.ok || !q) return;
    const ctx = this.sctx;
    ctx.setTransform(-1, 0, 0, 1, SW, 0); // mirrored, like the preview
    ctx.drawImage(video, g.crop.x, g.crop.y, g.crop.w, g.crop.h, 0, 0, SW, SH);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const kx = SW / g.pw, ky = SH / g.ph;
    const sq = q.map(([x, y]) => [x * kx, y * ky]);
    const H = squareToQuad(sq);
    const inv = H && invert3(H);
    if (!inv) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of sq) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    x0 = clamp(Math.floor(x0), 0, SW - 1); y0 = clamp(Math.floor(y0), 0, SH - 1);
    x1 = clamp(Math.ceil(x1), 0, SW - 1); y1 = clamp(Math.ceil(y1), 0, SH - 1);
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    if (bw < 4 || bh < 4) return;
    const d = ctx.getImageData(x0, y0, bw, bh).data;
    const quads = [[], [], [], []]; // TL, TR, BR, BL buckets: [lum, r, g, b]
    const lums = [];
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        const [u, v] = applyH(inv, x0 + x + 0.5, y0 + y + 0.5);
        if (u < 0.1 || u > 0.9 || v < 0.1 || v > 0.9) continue; // avoid edges and fingers
        const i = (y * bw + x) * 4;
        const r = d[i], gg = d[i + 1], b = d[i + 2];
        const l = 0.299 * r + 0.587 * gg + 0.114 * b;
        lums.push(l);
        const qi = v < 0.5 ? (u < 0.5 ? 0 : 1) : (u < 0.5 ? 3 : 2); // TL, TR, BR, BL
        quads[qi].push([l, r, gg, b]);
      }
    }
    if (lums.length < 40) return;
    lums.sort((a, b) => a - b);
    const p3 = lums[Math.floor(lums.length * 0.03)];
    const whites = quads.map((arr) => {
      if (arr.length < 8) return null;
      arr.sort((a, b) => b[0] - a[0]);
      const n = Math.max(3, Math.floor(arr.length * 0.3));
      let r = 0, gg = 0, b = 0;
      for (let i = 0; i < n; i++) { r += arr[i][1]; gg += arr[i][2]; b += arr[i][3]; }
      return [r / n, gg / n, b / n];
    });
    const valid = whites.filter(Boolean);
    if (!valid.length) return;
    const avg = [0, 1, 2].map((c) => valid.reduce((s, w) => s + w[c], 0) / valid.length);
    const fixed = whites.map((w) => sanitizeWhite(w || avg));
    const wl = fixed.reduce((s, w) => s + lum(w), 0) / 4;
    // black level: ink seen through the camera is never pure black
    const bl = clamp(p3 * 0.5, 6, Math.min(42, wl * 0.2));
    const tint = fixed[0].map((v, c) => (fixed.reduce((s, w) => s + w[c], 0) / 4) / Math.max(1, wl));
    const black = tint.map((t) => clamp(bl * t, 0, 255));
    // temporal smoothing
    const a = 0.3;
    this.light = {
      w: this.light.w.map((old, i) => old.map((v, c) => v + (fixed[i][c] - v) * a)),
      b: this.light.b.map((v, c) => v + (black[c] - v) * a),
      contrast: 1,
    };
    this.paint();
  }

  /* -------------------------- reveal / restore -------------------------- */
  hide(effect = S.reveal) {
    if (!this.visible) return;
    this.visible = false;
    if (this.anim) this.anim.cancel();
    const fx = this.fx;
    let frames, opts;
    if (effect === 'blur') {
      frames = [
        { opacity: 1, filter: 'blur(0px)' },
        { opacity: 0.85, filter: 'blur(5px)', offset: 0.45 },
        { opacity: 0, filter: 'blur(12px)' },
      ];
      opts = { duration: 260, easing: 'ease-in' };
    } else if (effect === 'glitch') {
      frames = glitchFrames(this.quad, fx.clientWidth, fx.clientHeight);
      opts = { duration: 260, easing: 'linear' };
    } else {
      frames = [{ opacity: 1 }, { opacity: 0 }];
      opts = { duration: 250, easing: 'cubic-bezier(.4,0,.2,1)' };
    }
    const anim = fx.animate(frames, { ...opts, fill: 'forwards' });
    this.anim = anim;
    anim.onfinish = () => {
      if (this.anim !== anim) return;
      fx.classList.add('off');
      anim.cancel();
      this.anim = null;
    };
  }

  show(fadeMs = 160) {
    if (this.anim) { this.anim.cancel(); this.anim = null; }
    this.visible = true;
    this.fx.classList.remove('off');
    if (fadeMs > 0) {
      this.anim = this.fx.animate([{ opacity: 0 }, { opacity: 1 }], { duration: fadeMs, easing: 'ease-out' });
      this.anim.onfinish = () => { this.anim = null; };
    }
  }

  /** Draws the card into a 2D context (for the shutter thumbnail), affine approx. */
  drawInto(ctx, mapPt) {
    if (!this.visible || !this.quad) return;
    const [p0, p1, , p3] = this.quad.map(mapPt);
    ctx.save();
    ctx.setTransform((p1[0] - p0[0]) / CW, (p1[1] - p0[1]) / CW, (p3[0] - p0[0]) / CH, (p3[1] - p0[1]) / CH, p0[0], p0[1]);
    ctx.drawImage(this.canvas, 0, 0);
    ctx.restore();
  }
}

/* ------------------------------ helpers ------------------------------ */
const lum = (w) => 0.299 * w[0] + 0.587 * w[1] + 0.114 * w[2];
const clone = (o) => JSON.parse(JSON.stringify(o));

function sanitizeWhite(w) {
  // keep it plausible for paper: not too dark, limited colour cast
  let l = lum(w);
  const target = clamp(l, 95, 252);
  const k = target / Math.max(1, l);
  let c = w.map((v) => v * k);
  l = lum(c);
  c = c.map((v) => clamp(v, l * 0.8, l * 1.2));
  return c.map((v) => clamp(v, 0, 255));
}

function lightDiff(a, b) {
  let m = 0;
  for (let i = 0; i < 4; i++) for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(a.w[i][c] - b.w[i][c]));
  for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(a.b[c] - b.b[c]));
  if (a.contrast !== b.contrast) m = 99;
  return m;
}

function makeNoise() {
  const n = 128;
  const c = document.createElement('canvas');
  c.width = n; c.height = n;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(n, n);
  for (let i = 0; i < n * n; i++) {
    // roughly gaussian luminance noise + a little chroma noise, like a phone sensor
    const g = (Math.random() + Math.random() + Math.random() - 1.5) * 120;
    img.data[i * 4] = clamp(128 + g + (Math.random() - 0.5) * 30, 0, 255);
    img.data[i * 4 + 1] = clamp(128 + g, 0, 255);
    img.data[i * 4 + 2] = clamp(128 + g + (Math.random() - 0.5) * 30, 0, 255);
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

function glitchFrames(q, pw, ph) {
  let top = 0, bottom = ph;
  if (q) {
    top = Math.max(0, Math.min(...q.map((p) => p[1])));
    bottom = Math.min(ph, Math.max(...q.map((p) => p[1])));
  }
  const h = Math.max(20, bottom - top);
  const band = (a, b) => `inset(${(top + h * a).toFixed(1)}px 0 ${(ph - (top + h * b)).toFixed(1)}px 0)`;
  const step = 'steps(1, end)';
  return [
    { opacity: 1, transform: 'translate(0,0)', clipPath: 'inset(0 0 0 0)', filter: 'none', easing: step },
    { opacity: 1, transform: 'translate(-7px,0)', clipPath: band(0.05, 0.45), filter: 'hue-rotate(70deg) saturate(2.5)', offset: 0.12, easing: step },
    { opacity: 0.9, transform: 'translate(6px,1px)', clipPath: band(0.35, 0.8), filter: 'contrast(1.8)', offset: 0.25, easing: step },
    { opacity: 1, transform: 'translate(-3px,0)', clipPath: 'inset(0 0 0 0)', filter: 'hue-rotate(-50deg) saturate(3)', offset: 0.38, easing: step },
    { opacity: 0.55, transform: 'translate(9px,-1px)', clipPath: band(0.55, 1), filter: 'none', offset: 0.52, easing: step },
    { opacity: 0.85, transform: 'translate(-4px,0)', clipPath: band(0.15, 0.6), filter: 'brightness(1.5)', offset: 0.64, easing: step },
    { opacity: 0.3, transform: 'translate(5px,0)', clipPath: band(0.7, 0.95), filter: 'none', offset: 0.78, easing: step },
    { opacity: 0.12, transform: 'translate(-2px,0)', clipPath: 'inset(0 0 0 0)', filter: 'none', offset: 0.9, easing: step },
    { opacity: 0, transform: 'translate(0,0)', clipPath: 'inset(0 0 0 0)', filter: 'none' },
  ];
}
