// Screen 1: the App Library screenshot, its tap zones, the iOS press effect,
// the secret settings gesture and the zone calibration editor.

import { S, save } from './store.js';
import { $, clamp } from './util.js';

// Default grid measured on the performer's own App Library screenshot
// (1260 × 2736 px = 420 × 912 pt @3x). Stored as fractions, so it scales to any screen.
const REF_W = 1260, REF_H = 2736;
const ICON = 204;                      // icon size in px
const COLS = [117, 358, 698, 939];     // left folder: 117/358, right folder: 698/939
const ROW0 = 567, ROW_PITCH = 627;     // top icon row of each folder row
const INNER = 243;                     // second icon row inside a folder

/** Default App Library zones. Fine-tune them in the zone editor if needed. */
export function defaultZones() {
  const zones = [];
  let n = 0;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      for (let j = 0; j < 2; j++) {
        const x = COLS[c], y = ROW0 + r * ROW_PITCH + j * INNER;
        if (y + ICON > REF_H) continue;
        const folderRight = c % 2 === 1;
        // bottom-right of each folder is a cluster of 4 mini icons (except "Suggestions")
        const cluster = folderRight && j === 1 && !(r === 0 && c === 1);
        zones.push({
          id: 'z' + n++,
          x: x / REF_W, y: y / REF_H, w: ICON / REF_W, h: ICON / REF_H,
          r: cluster ? 0.2 : 0.225,
          // Camera = top-right icon of the bottom-left folder
          type: r === 3 && c === 1 && j === 0 ? 'camera' : 'icon',
        });
      }
    }
  }
  return zones;
}

export class Home {
  constructor(app) {
    this.app = app;
    this.el = $('#home');
    this.img = $('#home-img');
    this.wall = $('#wall-img');
    this.wallFallback = $('#wall-fallback');
    this.zonesEl = $('#zones');
    this.bar = $('#zone-bar');
    this.debugEl = $('#home-debug');
    this.editing = false;
    this.sel = null;
    this.pixels = null;

    this.img.addEventListener('load', () => { this.pixels = null; this.updateDebug(); if (this.wallFailed) this.buildWallFallback(); });
    this.img.addEventListener('error', () => { $('#home-missing').hidden = false; });
    const wallFail = () => { this.wallFailed = true; this.wall.hidden = true; this.buildWallFallback(); };
    this.wall.addEventListener('error', wallFail);
    // The images may already have loaded or failed before this module ran.
    if (this.img.complete && this.img.naturalWidth === 0) $('#home-missing').hidden = false;
    if (this.wall.complete && this.wall.naturalWidth === 0) wallFail();
    if (this.img.complete && this.img.naturalWidth) this.updateDebug();

    this.bindInput();
    this.bindEditor();
    this.applySettings();
    window.addEventListener('resize', () => { this.renderZones(); this.updateDebug(); });
  }

  get zones() {
    if (!S.zones) S.zones = defaultZones();
    return S.zones;
  }

  applySettings() {
    const st = document.documentElement.style;
    if (S.sbHeight == null) st.removeProperty('--sb-h'); else st.setProperty('--sb-h', S.sbHeight + 'px');
    this.wall.style.filter = S.sbBlur > 0 ? `blur(${S.sbBlur}px)` : '';
    this.wallFallback.style.filter = this.wall.style.filter;
    this.el.classList.toggle('debug', !!S.debug);
    this.debugEl.hidden = !S.debug;
    this.renderZones();
    this.updateDebug();
    if (this.wallFailed) this.buildWallFallback();
  }

  /** Rendered box of the screenshot (object-fit: cover, anchored top). */
  imageBox() {
    const W = window.innerWidth, H = window.innerHeight;
    const iw = this.img.naturalWidth || W, ih = this.img.naturalHeight || H;
    const k = Math.max(W / iw, H / ih);
    return { x: (W - iw * k) / 2, y: 0, w: iw * k, h: ih * k, k };
  }

  zoneRect(z) {
    const W = window.innerWidth, H = window.innerHeight;
    const r = { x: z.x * W, y: z.y * H, w: z.w * W, h: z.h * H };
    r.r = Math.min(r.w, r.h) * z.r;
    return r;
  }

  cameraRect() {
    const z = this.zones.find((q) => q.type === 'camera');
    return z ? this.zoneRect(z) : null;
  }

  /* ---------- the frozen status bar of the screenshot is covered by the wallpaper ---------- */
  buildWallFallback() {
    // No wallpaper.png: stretch the screenshot row just below the strip upwards.
    if (!this.img.naturalWidth) return;
    const c = this.wallFallback;
    const iw = this.img.naturalWidth, ih = this.img.naturalHeight;
    const box = this.imageBox();
    const sb = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sb-h')) || this.app.safeTop() || 54;
    const ySrc = Math.min(ih - 1, Math.round((sb + 4) / box.k));
    c.width = iw; c.height = ih;
    const ctx = c.getContext('2d');
    ctx.drawImage(this.img, 0, ySrc, iw, 1, 0, 0, iw, ySrc + 1);
    c.hidden = false;
  }

  /* ---------- zones ---------- */
  renderZones() {
    this.zonesEl.innerHTML = '';
    this.zones.forEach((z, i) => {
      const d = document.createElement('div');
      d.className = 'zone' + (z.type === 'camera' ? ' camera' : '') + (this.sel === z.id ? ' sel' : '');
      d.dataset.id = z.id;
      d.dataset.label = z.type === 'camera' ? 'CAM' : String(i + 1);
      Object.assign(d.style, {
        left: z.x * 100 + '%', top: z.y * 100 + '%', width: z.w * 100 + '%', height: z.h * 100 + '%',
        borderRadius: this.zoneRect(z).r + 'px',
      });
      const h = document.createElement('i');
      h.className = 'handle';
      d.appendChild(h);
      this.zonesEl.appendChild(d);
    });
  }

  hitZone(x, y) {
    const W = window.innerWidth, H = window.innerHeight;
    const pad = 4; // a touch generous, like iOS
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      if (x >= z.x * W - pad && x <= (z.x + z.w) * W + pad && y >= z.y * H - pad && y <= (z.y + z.h) * H + pad) return z;
    }
    return null;
  }

  /* ---------- iOS press effect ---------- */
  sampleRing(r) {
    // colour of the folder platter right around the icon (to fill behind the shrunk icon)
    try {
      if (!this.pixels) {
        const c = document.createElement('canvas');
        c.width = this.img.naturalWidth; c.height = this.img.naturalHeight;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(this.img, 0, 0);
        this.pixels = ctx;
      }
      const box = this.imageBox();
      const toImg = (x, y) => [Math.round((x - box.x) / box.k), Math.round((y - box.y) / box.k)];
      const o = 3;
      const pts = [];
      for (let t = 0.15; t <= 0.85; t += 0.175) {
        pts.push([r.x + r.w * t, r.y - o], [r.x + r.w * t, r.y + r.h + o], [r.x - o, r.y + r.h * t], [r.x + r.w + o, r.y + r.h * t]);
      }
      let R = 0, G = 0, B = 0, n = 0;
      for (const [x, y] of pts) {
        const [ix, iy] = toImg(x, y);
        if (ix < 0 || iy < 0 || ix >= this.img.naturalWidth || iy >= this.img.naturalHeight) continue;
        const d = this.pixels.getImageData(ix, iy, 1, 1).data;
        R += d[0]; G += d[1]; B += d[2]; n++;
      }
      if (n) return `rgb(${Math.round(R / n)},${Math.round(G / n)},${Math.round(B / n)})`;
    } catch (_) { /* tainted or not loaded */ }
    return 'rgba(0,0,0,0)';
  }

  pressStart(z) {
    const r = this.zoneRect(z);
    const box = this.imageBox();
    const p = document.createElement('div');
    p.className = 'press';
    const radius = `${r.r}px`;
    Object.assign(p.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px', borderRadius: radius, background: this.sampleRing(r) });
    const icon = document.createElement('div');
    icon.className = 'press-icon';
    icon.style.borderRadius = radius;
    const im = document.createElement('img');
    im.src = this.img.currentSrc || this.img.src;
    Object.assign(im.style, { width: box.w + 'px', height: box.h + 'px', left: box.x - r.x + 'px', top: box.y - r.y + 'px' });
    icon.appendChild(im);
    p.appendChild(icon);
    this.el.appendChild(p);
    void p.offsetWidth;
    p.classList.add('down');
    return p;
  }

  pressEnd(p, keep = 0) {
    if (!p) return;
    setTimeout(() => {
      p.classList.remove('down');
      setTimeout(() => p.remove(), 260);
    }, keep);
  }

  /* ---------- input: icon taps + secret two-finger long press ---------- */
  bindInput() {
    const ptrs = new Map();
    let press = null;
    let secret = null;

    const cancelSecret = () => { if (secret) { clearTimeout(secret.timer); secret = null; } };

    this.el.addEventListener('pointerdown', (e) => {
      if (this.editing || this.app.camera.active) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
      if (ptrs.size === 2) {
        if (press) { this.pressEnd(press.el); press = null; }
        const all = [...ptrs.values()];
        const W = window.innerWidth, H = window.innerHeight;
        if (all.every((p) => p.x < W * 0.34 && p.y < H * 0.2)) {
          secret = { timer: setTimeout(() => { secret = null; ptrs.clear(); this.app.openSettings(); }, 750) };
        }
        return;
      }
      if (ptrs.size > 2) { cancelSecret(); return; }
      const z = this.hitZone(e.clientX, e.clientY);
      if (z) press = { id: e.pointerId, z, el: this.pressStart(z), x: e.clientX, y: e.clientY };
    });

    this.el.addEventListener('pointermove', (e) => {
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX; p.y = e.clientY;
      if (secret && Math.hypot(p.x - p.x0, p.y - p.y0) > 28) cancelSecret();
      if (press && press.id === e.pointerId && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 14) {
        this.pressEnd(press.el); press = null;
      }
    });

    const end = (e) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      cancelSecret();
      if (press && press.id === e.pointerId) {
        const { z, el } = press;
        press = null;
        if (e.type === 'pointerup' && z.type === 'camera') {
          this.app.launchCamera(this.zoneRect(z));
          this.pressEnd(el, 450);
        } else {
          this.pressEnd(el);
        }
      }
    };
    this.el.addEventListener('pointerup', end);
    this.el.addEventListener('pointercancel', end);
  }

  /* ---------- zone calibration editor ---------- */
  startEditing() {
    this.editing = true;
    this.el.classList.add('zone-edit');
    this.bar.hidden = false;
    this.renderZones();
  }

  stopEditing() {
    this.editing = false;
    this.sel = null;
    this.el.classList.remove('zone-edit');
    this.bar.hidden = true;
    save();
    this.renderZones();
  }

  bindEditor() {
    let drag = null;
    this.zonesEl.addEventListener('pointerdown', (e) => {
      if (!this.editing) return;
      const zEl = e.target.closest('.zone');
      if (!zEl) { this.sel = null; this.renderZones(); return; }
      const z = this.zones.find((q) => q.id === zEl.dataset.id);
      this.sel = z.id;
      drag = { id: e.pointerId, z, mode: e.target.classList.contains('handle') ? 'size' : 'move', x: e.clientX, y: e.clientY, o: { ...z } };
      this.zonesEl.setPointerCapture?.(e.pointerId);
      this.renderZones();
      e.stopPropagation();
    });
    this.zonesEl.addEventListener('pointermove', (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      const W = window.innerWidth, H = window.innerHeight;
      const dx = (e.clientX - drag.x) / W, dy = (e.clientY - drag.y) / H;
      const z = drag.z;
      if (drag.mode === 'move') { z.x = clamp(drag.o.x + dx, -0.1, 1); z.y = clamp(drag.o.y + dy, -0.1, 1); }
      else { z.w = clamp(drag.o.w + dx, 0.03, 1); z.h = clamp(drag.o.h + dy, 0.015, 1); }
      const el = this.zonesEl.querySelector(`[data-id="${z.id}"]`);
      if (el) Object.assign(el.style, { left: z.x * 100 + '%', top: z.y * 100 + '%', width: z.w * 100 + '%', height: z.h * 100 + '%' });
    });
    const up = (e) => { if (drag && drag.id === e.pointerId) { drag = null; this.renderZones(); } };
    this.zonesEl.addEventListener('pointerup', up);
    this.zonesEl.addEventListener('pointercancel', up);

    this.bar.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const zs = this.zones;
      const sel = zs.find((q) => q.id === this.sel);
      switch (b.dataset.z) {
        case 'add': {
          const base = sel || { w: ICON / REF_W, h: ICON / REF_H, r: 0.225 };
          const nz = { id: 'z' + Date.now().toString(36), x: 0.42, y: 0.45, w: base.w, h: base.h, r: base.r || 0.225, type: 'icon' };
          zs.push(nz); this.sel = nz.id; break;
        }
        case 'del': if (sel) { zs.splice(zs.indexOf(sel), 1); this.sel = null; } break;
        case 'cam': if (sel) { zs.forEach((q) => { if (q.type === 'camera') q.type = 'icon'; }); sel.type = 'camera'; } break;
        case 'reset': S.zones = defaultZones(); this.sel = null; break;
        case 'done': this.stopEditing(); this.app.openSettings(); return;
      }
      this.renderZones();
    });
  }

  updateDebug() {
    if (!S.debug) return;
    const W = window.innerWidth, H = window.innerHeight, dpr = window.devicePixelRatio || 1;
    const iw = this.img.naturalWidth, ih = this.img.naturalHeight;
    const exact = iw === Math.round(W * dpr) && ih === Math.round(H * dpr);
    this.debugEl.textContent = [
      `écran ${W}×${H} pt @${dpr}x = ${Math.round(W * dpr)}×${Math.round(H * dpr)} px`,
      `home.png ${iw || '?'}×${ih || '?'} ${iw ? (exact ? '✓ 1:1 pixel' : '✗ pas 1:1 (mise à l’échelle)') : ''}`,
      `safe-area haut ${this.app.safeTop()} px · bande statut ${S.sbHeight == null ? 'auto' : S.sbHeight + ' px'}`,
      `standalone ${this.app.isStandalone() ? 'oui' : 'NON (ouvrir depuis l’écran d’accueil)'}`,
    ].join('\n');
  }
}
