// Card images: loading the performer's photos, normalising them and rendering
// them with the live camera's lighting (white point, black level, light gradient).

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUITS = ['S', 'H', 'D', 'C'];
export const SUIT_SYM = { S: '♠︎', H: '♥︎', D: '♦︎', C: '♣︎' };
const RANK_FR = { A: 'As', J: 'Valet', Q: 'Dame', K: 'Roi' };
const SUIT_FR = { S: 'pique', H: 'cœur', D: 'carreau', C: 'trèfle' };
export const isRed = (code) => /[HD]$/.test(code);
export const cardLabel = (code) => {
  const r = code.slice(0, -1), s = code.slice(-1);
  return `${RANK_FR[r] || r} de ${SUIT_FR[s]}`;
};

// Internal resolution of the overlay texture (63 × 88 mm aspect).
export const CW = 420;
export const CH = Math.round((CW * 88) / 63); // 587

const EXTS = ['jpg', 'jpeg', 'png', 'webp'];
const cache = new Map();

function loadImg(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Finds assets/cards/<CODE>.<ext>; falls back to a drawn card. */
export async function loadCardSource(code) {
  if (cache.has(code)) return cache.get(code);
  const p = (async () => {
    const names = [code, code.toLowerCase()];
    for (const n of names) {
      for (const ext of EXTS) {
        try {
          const img = await loadImg(`assets/cards/${n}.${ext}`);
          return { img, photo: true, file: `${n}.${ext}` };
        } catch (_) { /* try next */ }
      }
    }
    return { img: drawCard(code), photo: false, file: null };
  })();
  cache.set(code, p);
  return p;
}

/* ---------------------------------------------------------------------------
   Prepared card: normalised colour + alpha mask, ready to be re-lit fast.
   --------------------------------------------------------------------------- */
export class PreparedCard {
  /**
   * @param {CanvasImageSource} src
   * @param {{mirror:boolean, blurPx:number, featherPx:number, radiusFrac:number}} o (px in canvas px)
   */
  constructor(src, o) {
    const W = CW, H = CH;
    this.W = W; this.H = H;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    // cover-fit the photo into the card rectangle
    const sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height;
    let iw = sw, ih = sh;
    // photos shot in landscape: rotate to portrait
    const rotate = sw > sh * 1.1;
    if (rotate) { iw = sh; ih = sw; }
    const s = Math.max(W / iw, H / ih);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    if (o.mirror) ctx.scale(-1, 1);
    if (rotate) ctx.rotate(Math.PI / 2);
    ctx.drawImage(src, (-sw * s) / 2, (-sh * s) / 2, sw * s, sh * s);
    ctx.restore();
    const px = ctx.getImageData(0, 0, W, H).data;
    const N = W * H;

    // --- auto levels: find paper white (bright 10 %) and ink black (darkest 1 %) ---
    const hist = new Uint32Array(256);
    for (let i = 0, j = 0; i < N; i++, j += 4) {
      hist[(px[j] * 77 + px[j + 1] * 150 + px[j + 2] * 29) >> 8]++;
    }
    const pct = (p) => { let acc = 0; const t = N * p; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= t) return v; } return 255; };
    const lo = pct(0.01), hiCut = pct(0.88);
    let wr = 0, wg = 0, wb = 0, wn = 0;
    for (let i = 0, j = 0; i < N; i++, j += 4) {
      const l = (px[j] * 77 + px[j + 1] * 150 + px[j + 2] * 29) >> 8;
      if (l >= hiCut) { wr += px[j]; wg += px[j + 1]; wb += px[j + 2]; wn++; }
    }
    wn = Math.max(1, wn);
    const white = [wr / wn, wg / wn, wb / wn];
    const black = Math.min(lo, 90);

    // normalised planes (float) so the blur is done on clean data
    const R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N);
    for (let i = 0, j = 0; i < N; i++, j += 4) {
      R[i] = Math.min(1.08, Math.max(0, (px[j] - black) / Math.max(20, white[0] - black)));
      G[i] = Math.min(1.08, Math.max(0, (px[j + 1] - black) / Math.max(20, white[1] - black)));
      B[i] = Math.min(1.08, Math.max(0, (px[j + 2] - black) / Math.max(20, white[2] - black)));
    }
    const k = blurRadiusFor(o.blurPx);
    if (k > 0) for (const P of [R, G, B]) boxBlur3(P, W, H, k);

    this.n = new Uint8ClampedArray(N * 3);
    for (let i = 0, j = 0; i < N; i++, j += 3) {
      this.n[j] = Math.min(255, R[i] * 236 + 0.5);
      this.n[j + 1] = Math.min(255, G[i] * 236 + 0.5);
      this.n[j + 2] = Math.min(255, B[i] * 236 + 0.5);
    }

    // --- rounded corners + soft edge, from a signed distance field ---
    this.alpha = new Uint8ClampedArray(N);
    const rad = Math.max(0, o.radiusFrac) * W;
    const F = Math.max(0.6, o.featherPx);
    const hx = W / 2 - rad, hy = H / 2 - rad;
    for (let y = 0; y < H; y++) {
      const qy = Math.abs(y + 0.5 - H / 2) - hy;
      for (let x = 0; x < W; x++) {
        const qx = Math.abs(x + 0.5 - W / 2) - hx;
        const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
        const sd = Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - rad; // <0 inside
        let a = -sd / F;
        a = a <= 0 ? 0 : a >= 1 ? 1 : a * a * (3 - 2 * a);
        this.alpha[y * W + x] = a * 255 + 0.5;
      }
    }
    this.out = new ImageData(W, H);
  }

  /**
   * Re-light into an ImageData.
   * light.w = [TL, TR, BR, BL] each [r,g,b] 0..255 (paper white at each corner, in card space)
   * light.b = [r,g,b] black level; light.contrast multiplier
   */
  render(light) {
    const { W, H, n, alpha } = this;
    const d = this.out.data;
    const [TL, TR, BR, BL] = light.w;
    const bk = light.b;
    const c = light.contrast || 1;
    const lut = new Float32Array(256);
    for (let v = 0; v < 256; v++) {
      const t = v / 236;
      lut[v] = Math.max(0, Math.min(1.08, (t - 0.5) * c + 0.5));
    }
    let i = 0, j = 0;
    for (let y = 0; y < H; y++) {
      const v = y / (H - 1);
      const lr = TL[0] + (BL[0] - TL[0]) * v, lg = TL[1] + (BL[1] - TL[1]) * v, lb = TL[2] + (BL[2] - TL[2]) * v;
      const rr = TR[0] + (BR[0] - TR[0]) * v, rg = TR[1] + (BR[1] - TR[1]) * v, rb = TR[2] + (BR[2] - TR[2]) * v;
      const dr = (rr - lr) / (W - 1), dg = (rg - lg) / (W - 1), db = (rb - lb) / (W - 1);
      let wr = lr - bk[0], wg = lg - bk[1], wb = lb - bk[2];
      for (let x = 0; x < W; x++, i++, j += 3) {
        const o4 = i * 4;
        d[o4] = bk[0] + wr * lut[n[j]];
        d[o4 + 1] = bk[1] + wg * lut[n[j + 1]];
        d[o4 + 2] = bk[2] + wb * lut[n[j + 2]];
        d[o4 + 3] = alpha[i];
        wr += dr; wg += dg; wb += db;
      }
    }
    return this.out;
  }
}

export const NEUTRAL_LIGHT = {
  w: [[238, 238, 236], [238, 238, 236], [238, 238, 236], [238, 238, 236]],
  b: [26, 26, 28],
  contrast: 1,
};

function blurRadiusFor(sigma) {
  if (!(sigma > 0.35)) return 0;
  // 3 box passes of width w approximate a Gaussian with variance 3·(w²−1)/12
  const w = Math.sqrt(4 * sigma * sigma + 1);
  return Math.max(1, Math.round((w - 1) / 2));
}

function boxBlur3(P, W, H, k) {
  const tmp = new Float32Array(P.length);
  for (let pass = 0; pass < 3; pass++) {
    boxH(P, tmp, W, H, k);
    boxV(tmp, P, W, H, k);
  }
}
function boxH(src, dst, W, H, k) {
  const inv = 1 / (2 * k + 1);
  for (let y = 0; y < H; y++) {
    const row = y * W;
    let acc = 0;
    for (let x = -k; x <= k; x++) acc += src[row + Math.min(W - 1, Math.max(0, x))];
    for (let x = 0; x < W; x++) {
      dst[row + x] = acc * inv;
      acc += src[row + Math.min(W - 1, x + k + 1)] - src[row + Math.max(0, x - k)];
    }
  }
}
function boxV(src, dst, W, H, k) {
  const inv = 1 / (2 * k + 1);
  for (let x = 0; x < W; x++) {
    let acc = 0;
    for (let y = -k; y <= k; y++) acc += src[Math.min(H - 1, Math.max(0, y)) * W + x];
    for (let y = 0; y < H; y++) {
      dst[y * W + x] = acc * inv;
      acc += src[Math.min(H - 1, y + k + 1) * W + x] - src[Math.max(0, y - k) * W + x];
    }
  }
}

/* ---------------------------------------------------------------------------
   Fallback: a clean drawn card (used until you add your photos).
   --------------------------------------------------------------------------- */
const SUIT_PATH = {
  D: 'M50 0 L86 50 L50 100 L14 50 Z',
  H: 'M50 96 C22 72 0 52 0 29 C0 12 12 0 27 0 C38 0 46 7 50 17 C54 7 62 0 73 0 C88 0 100 12 100 29 C100 52 78 72 50 96 Z',
  S: 'M50 0 C78 24 100 42 100 61 C100 77 88 87 74 87 C64 87 56 82 52.5 75 C54 87 58 94 67 100 L33 100 C42 94 46 87 47.5 75 C44 82 36 87 26 87 C12 87 0 77 0 61 C0 42 22 24 50 0 Z',
  C: 'M46 58 C46 80 40 92 31 100 L69 100 C60 92 54 80 54 58 Z',
};
function suitPath(s) {
  const p = new Path2D(SUIT_PATH[s]);
  if (s === 'C') {
    p.addPath(circlePath(50, 25, 23));
    p.addPath(circlePath(25, 59, 23));
    p.addPath(circlePath(75, 59, 23));
  }
  return p;
}
function circlePath(x, y, r) { const p = new Path2D(); p.arc(x, y, r, 0, Math.PI * 2); return p; }
function drawSuit(ctx, s, x, y, size, flip = false) {
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.rotate(Math.PI);
  ctx.scale(size / 100, size / 100);
  ctx.translate(-50, -50);
  ctx.fill(suitPath(s));
  ctx.restore();
}
const PIPS = {
  2: [[.5, 0], [.5, 1]],
  3: [[.5, 0], [.5, .5], [.5, 1]],
  4: [[0, 0], [1, 0], [0, 1], [1, 1]],
  5: [[0, 0], [1, 0], [.5, .5], [0, 1], [1, 1]],
  6: [[0, 0], [1, 0], [0, .5], [1, .5], [0, 1], [1, 1]],
  7: [[0, 0], [1, 0], [.5, .25], [0, .5], [1, .5], [0, 1], [1, 1]],
  8: [[0, 0], [1, 0], [.5, .25], [0, .5], [1, .5], [.5, .75], [0, 1], [1, 1]],
  9: [[0, 0], [1, 0], [0, 1 / 3], [1, 1 / 3], [.5, .5], [0, 2 / 3], [1, 2 / 3], [0, 1], [1, 1]],
  10: [[0, 0], [1, 0], [.5, 1 / 6], [0, 1 / 3], [1, 1 / 3], [0, 2 / 3], [1, 2 / 3], [.5, 5 / 6], [0, 1], [1, 1]],
};
const FR_INDEX = { J: 'V', Q: 'D', K: 'R' };

export function drawCard(code) {
  const W = 630, H = 880;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const rank = code.slice(0, -1), suit = code.slice(-1);
  const col = isRed(code) ? '#c8102e' : '#111';
  ctx.fillStyle = '#fbfaf6';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = col;
  ctx.strokeStyle = col;
  const idx = FR_INDEX[rank] || rank;
  const corner = (flip) => {
    ctx.save();
    if (flip) { ctx.translate(W, H); ctx.rotate(Math.PI); }
    ctx.font = `600 ${idx.length > 1 ? 70 : 82}px Georgia, "Times New Roman", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(idx, 58, 104);
    drawSuit(ctx, suit, 58, 146, 52);
    ctx.restore();
  };
  corner(false); corner(true);
  if (PIPS[rank]) {
    const x0 = 190, x1 = W - 190, y0 = 170, y1 = H - 170;
    for (const [u, v] of PIPS[rank]) drawSuit(ctx, suit, x0 + (x1 - x0) * u, y0 + (y1 - y0) * v, 108, v > 0.5);
  } else if (rank === 'A') {
    drawSuit(ctx, suit, W / 2, H / 2, suit === 'S' ? 250 : 190);
  } else {
    ctx.lineWidth = 4;
    ctx.strokeRect(128, 140, W - 256, H - 280);
    ctx.font = '600 300px Georgia, "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(idx, W / 2, H / 2 - 70);
    drawSuit(ctx, suit, W / 2, H / 2 + 150, 120);
  }
  return cv;
}
