// Small math / animation helpers shared by the modules.

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const $ = (sel, root = document) => root.querySelector(sel);

/* ---------- Spring easing (iOS-like) as a CSS linear() function ---------- */
// Damped harmonic oscillator, like SwiftUI's .spring(response:dampingFraction:).
export function springPoints(response = 0.32, damping = 0.86, duration = 0.42, n = 48) {
  const w0 = (2 * Math.PI) / response;
  const zeta = damping;
  const wd = w0 * Math.sqrt(Math.max(1e-6, 1 - zeta * zeta));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * duration;
    const e = Math.exp(-zeta * w0 * t);
    let x = 1 - e * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
    if (i === n) x = 1;
    pts.push(x);
  }
  return pts;
}

let linearOK = null;
export function springEasing(response, damping, duration) {
  if (linearOK === null) {
    linearOK = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('animation-timing-function', 'linear(0, 0.5, 1)');
  }
  if (!linearOK) return 'cubic-bezier(0.2, 0.95, 0.3, 1)';
  return 'linear(' + springPoints(response, damping, duration).map((v) => +v.toFixed(4)).join(', ') + ')';
}

/* ---------- Projective geometry ---------- */
// Homography mapping the unit square (0,0),(1,0),(1,1),(0,1) to quad p[0..3].
export function squareToQuad(p) {
  const [x0, y0] = p[0], [x1, y1] = p[1], [x2, y2] = p[2], [x3, y3] = p[3];
  const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
  let a, b, c, d, e, f, g, h;
  if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) {
    a = x1 - x0; b = x3 - x0; c = x0;
    d = y1 - y0; e = y3 - y0; f = y0;
    g = 0; h = 0;
  } else {
    const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
    const den = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(den) < 1e-12) return null;
    g = (sx * dy2 - dx2 * sy) / den;
    h = (dx1 * sy - sx * dy1) / den;
    a = x1 - x0 + g * x1; b = x3 - x0 + h * x3; c = x0;
    d = y1 - y0 + g * y1; e = y3 - y0 + h * y3; f = y0;
  }
  return [a, b, c, d, e, f, g, h, 1];
}

export function invert3(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) return null;
  const k = 1 / det;
  return [
    A * k, -(b * i - c * h) * k, (b * f - c * e) * k,
    B * k, (a * i - c * g) * k, -(a * f - c * d) * k,
    C * k, -(a * h - b * g) * k, (a * e - b * d) * k,
  ];
}

export function applyH(m, x, y) {
  const w = m[6] * x + m[7] * y + m[8];
  return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w];
}

// CSS matrix3d that maps an element of size (W,H) with transform-origin 0 0 onto quad.
export function quadToMatrix3d(quad, W, H) {
  const m = squareToQuad(quad);
  if (!m) return null;
  const [a, b, c, d, e, f, g, h] = m;
  const A = a / W, B = b / H, D = d / W, E = e / H, G = g / W, Hh = h / H;
  return `matrix3d(${A},${D},0,${G},${B},${E},0,${Hh},0,0,1,0,${c},${f},0,1)`;
}

export function quadIsConvex(q) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const p0 = q[i], p1 = q[(i + 1) % 4], p2 = q[(i + 2) % 4];
    const cr = (p1[0] - p0[0]) * (p2[1] - p1[1]) - (p1[1] - p0[1]) * (p2[0] - p1[0]);
    if (Math.abs(cr) < 1e-6) return false;
    const s = Math.sign(cr);
    if (!sign) sign = s; else if (s !== sign) return false;
  }
  return true;
}

export function quadArea(q) {
  let s = 0;
  for (let i = 0; i < 4; i++) {
    const [x0, y0] = q[i], [x1, y1] = q[(i + 1) % 4];
    s += x0 * y1 - x1 * y0;
  }
  return Math.abs(s) / 2;
}

export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// Rotated rectangle -> quad (TL, TR, BR, BL)
export function rectQuad(cx, cy, w, h, deg) {
  const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]
    .map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
}

/* ---------- One Euro filter (jitter-free yet responsive tracking) ---------- */
export class OneEuro {
  constructor(minCutoff = 1.2, beta = 0.02, dCutoff = 1.0) {
    this.minCutoff = minCutoff; this.beta = beta; this.dCutoff = dCutoff;
    this.reset();
  }
  reset() { this.x = null; this.dx = 0; this.t = null; }
  static alpha(cutoff, dt) { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); }
  filter(x, tMs) {
    if (this.x === null) { this.x = x; this.t = tMs; return x; }
    const dt = Math.max(1 / 240, (tMs - this.t) / 1000);
    this.t = tMs;
    const rawDx = (x - this.x) / dt;
    this.dx += OneEuro.alpha(this.dCutoff, dt) * (rawDx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += OneEuro.alpha(cutoff, dt) * (x - this.x);
    return this.x;
  }
}

export function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }
