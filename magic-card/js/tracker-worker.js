/* Mode B — card detection in a Web Worker so the UI thread stays at 60 fps.
   Finds the largest bright, card-shaped quadrilateral in a small frame. */
/* global cv, importScripts */

const SOURCES = [
  '../vendor/opencv.js',
  'https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.10.0-release.1/dist/opencv.js',
  'https://docs.opencv.org/4.10.0/opencv.js',
];

let M = null; // reusable Mats
let W = 0, H = 0;

async function init() {
  let loaded = false, lastErr = null;
  for (const url of SOURCES) {
    try { importScripts(url); loaded = true; break; } catch (e) { lastErr = e; }
  }
  if (!loaded) throw lastErr || new Error('opencv.js introuvable');
  let c = self.cv;
  if (c instanceof Promise) c = await c;
  else if (c && !c.Mat) {
    await new Promise((resolve) => {
      const prev = c.onRuntimeInitialized;
      c.onRuntimeInitialized = () => { if (prev) prev(); resolve(); };
      const iv = setInterval(() => { if (c.Mat) { clearInterval(iv); resolve(); } }, 50);
    });
  }
  self.cv = c;
}

function ensureMats(w, h) {
  if (M && w === W && h === H) return;
  if (M) Object.values(M).forEach((m) => m && m.delete && m.delete());
  W = w; H = h;
  M = {
    src: new cv.Mat(h, w, cv.CV_8UC4),
    gray: new cv.Mat(),
    blur: new cv.Mat(),
    bin: new cv.Mat(),
    edges: new cv.Mat(),
    kernel: cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3)),
  };
}

const quadArea = (q) => {
  let s = 0;
  for (let i = 0; i < 4; i++) s += q[i][0] * q[(i + 1) % 4][1] - q[(i + 1) % 4][0] * q[i][1];
  return Math.abs(s) / 2;
};
const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function convex(q) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4], c = q[(i + 2) % 4];
    const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    const s = Math.sign(cr);
    if (!s) return false;
    if (!sign) sign = s; else if (s !== sign) return false;
  }
  return true;
}

function sortClockwise(q) {
  const cx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4;
  const cy = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4;
  return q.slice().sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
}

// mean brightness of the quad interior (3×3 bilinear samples)
function interiorMean(q, g) {
  let s = 0, n = 0;
  for (const v of [0.25, 0.5, 0.75]) {
    for (const u of [0.25, 0.5, 0.75]) {
      const x = (1 - v) * ((1 - u) * q[0][0] + u * q[1][0]) + v * ((1 - u) * q[3][0] + u * q[2][0]);
      const y = (1 - v) * ((1 - u) * q[0][1] + u * q[1][1]) + v * ((1 - u) * q[3][1] + u * q[2][1]);
      const xi = Math.max(0, Math.min(W - 1, x | 0)), yi = Math.max(0, Math.min(H - 1, y | 0));
      s += g[yi * W + xi]; n++;
    }
  }
  return s / n;
}

function evaluate(quad, hullArea, g, hint) {
  if (!convex(quad)) return null;
  const q = sortClockwise(quad);
  const qa = quadArea(q);
  if (qa < W * H * 0.02 || qa > W * H * 0.92) return null;
  const rect = Math.min(1, hullArea / qa);
  if (rect < 0.8) return null;
  const s0 = d(q[0], q[1]), s1 = d(q[1], q[2]), s2 = d(q[2], q[3]), s3 = d(q[3], q[0]);
  // opposite sides should be similar (moderate perspective only)
  if (Math.min(s0, s2) / Math.max(s0, s2) < 0.55 || Math.min(s1, s3) / Math.max(s1, s3) < 0.55) return null;
  let r = (s1 + s3) / (s0 + s2);
  if (r < 1) r = 1 / r;
  if (r < 1.12 || r > 2.1) return null;
  const aspect = Math.exp(-(((r - 1.397) / 0.32) ** 2));
  const bright = interiorMean(q, g) / 255;
  if (bright < 0.3) return null;
  let cont = 1;
  if (hint) {
    const cx = (q[0][0] + q[2][0]) / 2, cy = (q[0][1] + q[2][1]) / 2;
    cont = 0.6 + 0.4 * Math.exp(-Math.hypot(cx - hint[0], cy - hint[1]) / (0.25 * W));
  }
  const score = Math.sqrt(qa / (W * H)) * rect * (0.4 + 0.6 * aspect) * bright * bright * cont;
  return { quad: q, score };
}

function collect(bin, g, hint, best) {
  const contours = new cv.MatVector();
  const hier = new cv.Mat();
  cv.findContours(bin, contours, hier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
  const minA = W * H * 0.02;
  for (let i = 0; i < contours.size(); i++) {
    const c = contours.get(i);
    const area = cv.contourArea(c);
    if (area < minA) { c.delete(); continue; }
    const hull = new cv.Mat();
    cv.convexHull(c, hull, false, true);
    const hullArea = cv.contourArea(hull);
    const peri = cv.arcLength(hull, true);
    const approx = new cv.Mat();
    cv.approxPolyDP(hull, approx, 0.035 * peri, true);
    let quad = null;
    if (approx.rows === 4) {
      const a = approx.data32S;
      quad = [[a[0], a[1]], [a[2], a[3]], [a[4], a[5]], [a[6], a[7]]];
    } else if (approx.rows >= 5 && approx.rows <= 8) {
      // fingers clipped a corner: fall back to the min-area rectangle of the hull
      const rr = cv.minAreaRect(hull);
      quad = cv.RotatedRect.points(rr).map((p) => [p.x, p.y]);
    }
    if (quad) {
      const ev = evaluate(quad, hullArea, g, hint);
      if (ev && (!best.v || ev.score > best.v.score)) best.v = ev;
    }
    approx.delete(); hull.delete(); c.delete();
  }
  contours.delete(); hier.delete();
}

function detect(data, w, h, hint) {
  ensureMats(w, h);
  M.src.data.set(data);
  cv.cvtColor(M.src, M.gray, cv.COLOR_RGBA2GRAY);
  cv.GaussianBlur(M.gray, M.blur, new cv.Size(5, 5), 0);
  const g = M.blur.data;
  const best = { v: null };

  // 1) Otsu split (card vs background)
  const otsu = cv.threshold(M.blur, M.bin, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);
  cv.morphologyEx(M.bin, M.bin, cv.MORPH_OPEN, M.kernel);
  collect(M.bin, g, hint, best);

  // 2) "paper white" threshold: the card is usually the brightest thing in frame
  const hist = new Uint32Array(256);
  for (let i = 0; i < g.length; i += 2) hist[g[i]]++;
  let acc = 0, p80 = 255; const tgt = (g.length / 2) * 0.8;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= tgt) { p80 = v; break; } }
  if (p80 > otsu + 12) {
    cv.threshold(M.blur, M.bin, p80, 255, cv.THRESH_BINARY);
    cv.morphologyEx(M.bin, M.bin, cv.MORPH_OPEN, M.kernel);
    collect(M.bin, g, hint, best);
  }

  // 3) edges (card on a bright background)
  if (!best.v || best.v.score < 0.25) {
    cv.Canny(M.blur, M.edges, 30, 90);
    cv.dilate(M.edges, M.edges, M.kernel);
    collect(M.edges, g, hint, best);
  }
  return best.v;
}

self.onmessage = async (e) => {
  const m = e.data;
  if (m.type === 'init') {
    try { await init(); self.postMessage({ type: 'ready' }); }
    catch (err) { self.postMessage({ type: 'error', message: String(err && err.message || err) }); }
    return;
  }
  if (m.type === 'frame') {
    const t0 = performance.now();
    let res = null;
    try { res = detect(new Uint8ClampedArray(m.buf), m.w, m.h, m.hint); } catch (_) { res = null; }
    self.postMessage({ type: 'result', id: m.id, quad: res ? res.quad : null, score: res ? res.score : 0, ms: performance.now() - t0 });
  }
};
