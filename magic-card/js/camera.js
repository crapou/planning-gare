// Screen 2: the fake iOS Camera (selfie), live front camera + card overlay.

import { S, save, DEFAULTS } from './store.js';
import { Overlay } from './overlay.js';
import { Tracker } from './tracker.js';
import { rectQuad, springEasing, clamp, $ } from './util.js';

const CARD_RATIO = 88 / 63;
const LONG_PRESS_MS = 520;

export class Camera {
  constructor(app) {
    this.app = app;
    this.screen = $('#camera');
    this.root = $('#cam-root');
    this.preview = $('#preview');
    this.video = $('#video');
    this.focusBox = $('#focus-box');
    this.aeLock = $('#ae-lock');
    this.flash = $('#shutter-flash');
    this.thumb = $('#thumb-canvas');
    this.shutter = $('#cam-shutter');
    this.launchIcon = $('#launch-icon');
    this.dbgSvg = $('#dbg-svg');
    this.dbgText = $('#dbg-text');
    this.calibBar = $('#calib-bar');
    this.calibHelp = $('#calib-help');
    this.ref = $('#cam-ref');

    this.overlay = new Overlay();
    this.tracker = new Tracker();
    this.stream = null;
    this.active = false;
    this.calibrating = false;
    this.denied = false;
    this.fps = 0;
    this._frames = 0;
    this._fpsT = performance.now();
    this._lastLight = 0;
    this._newFrame = true;

    this.overlay.setCard(S.card, S.overlay.w * window.innerWidth);
    this.loop = this.loop.bind(this);
    this.bindInput();
    this.applySettings();
    this.loadThumb();

    this.video.addEventListener('playing', () => this.video.classList.add('live'));
    this.video.addEventListener('emptied', () => this.video.classList.remove('live'));
    this.ref.addEventListener('error', () => { this.refMissing = true; this.ref.hidden = true; });
  }

  /* ------------------------------ settings ------------------------------ */
  applySettings() {
    const st = document.documentElement.style;
    st.setProperty('--preview-shift', S.previewShift + 'px');
    st.setProperty('--top-shift', S.topShift + 'px');
    st.setProperty('--bottom-shift', S.bottomShift + 'px');
    st.setProperty('--glyph-rot', S.glyphRot === 'capture' ? '0deg' : '90deg');
    st.setProperty('--fb-size', S.fbSize + 'px');
    $('#cam-grid').classList.toggle('off', !S.grid);
    this.ref.style.opacity = S.refOpacity;
    this.ref.hidden = !(S.refOpacity > 0) || this.refMissing;
    this.dbgSvg.toggleAttribute('hidden', !S.debug);
    this.dbgText.hidden = !S.debug;
    if (S.mode === 'B') this.tracker.load();
  }

  cardChanged() { this.overlay.setCard(S.card, S.overlay.w * window.innerWidth); }
  realismChanged() { this.overlay.rebuild(S.overlay.w * window.innerWidth); }

  async loadThumb() {
    // assets/thumb.jpg|png = your real last photo, shown in the round thumbnail
    for (const url of ['assets/thumb.jpg', 'assets/thumb.png']) {
      const img = new Image();
      const ok = await new Promise((r) => { img.onload = () => r(true); img.onerror = () => r(false); img.src = url; });
      if (!ok) continue;
      const c = this.thumb.getContext('2d');
      const s = Math.min(img.width, img.height);
      c.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, this.thumb.width, this.thumb.height);
      return;
    }
  }

  /* ------------------------------ geometry ------------------------------ */
  geom() {
    const pw = this.preview.clientWidth, ph = this.preview.clientHeight;
    const vw = this.video.videoWidth, vh = this.video.videoHeight;
    if (!vw || !vh || !pw) return { pw, ph, ok: false };
    const s = Math.max(pw / vw, ph / vh);
    const ox = (pw - vw * s) / 2, oy = (ph - vh * s) / 2;
    return { pw, ph, vw, vh, s, ok: true, crop: { x: -ox / s, y: -oy / s, w: pw / s, h: ph / s } };
  }

  modeAQuad(pw, ph, o = S.overlay) {
    const w = o.w * pw;
    return rectQuad(o.cx * pw, o.cy * ph, w, w * CARD_RATIO, o.rot);
  }

  /* ------------------------------ stream ------------------------------ */
  async startStream() {
    if (this.stream) return true;
    if (this._starting) return this._starting;
    this._starting = (async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { this.denied = true; return false; }
      const dims = S.resolution === '960' ? { width: { ideal: 1280 }, height: { ideal: 960 } }
        : S.resolution === '1440' ? { width: { ideal: 1920 }, height: { ideal: 1440 } }
        : { width: { ideal: 4032 }, height: { ideal: 3024 } };
      const attempts = [
        { audio: false, video: { facingMode: 'user', aspectRatio: { ideal: 4 / 3 }, frameRate: { ideal: 30 }, ...dims } },
        { audio: false, video: { facingMode: 'user' } },
      ];
      for (const c of attempts) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia(c);
          if (!this.active) { stream.getTracks().forEach((t) => t.stop()); return false; }
          this.stream = stream;
          this.denied = false;
          stream.getVideoTracks().forEach((t) => t.addEventListener('ended', () => {
            this.stream = null;
            if (this.active && !document.hidden) setTimeout(() => this.startStream(), 300);
          }));
          this.video.srcObject = stream;
          try { await this.video.play(); } catch (_) { /* autoplay: muted+playsinline is fine on iOS */ }
          if ('requestVideoFrameCallback' in this.video) {
            const cb = () => { this._newFrame = true; if (this.stream) this.video.requestVideoFrameCallback(cb); };
            this.video.requestVideoFrameCallback(cb);
          }
          return true;
        } catch (e) {
          if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) break;
        }
      }
      // Refused: behave like a camera that shows black. No popup, no text for the audience.
      this.denied = true;
      return false;
    })();
    const r = await this._starting;
    this._starting = null;
    return r;
  }

  stopStream() {
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.video.classList.remove('live');
  }

  /* ------------------------------ open / close ------------------------------ */
  /**
   * @param {{x:number,y:number,w:number,h:number,r:number}|null} rect icon rect (launch animation)
   */
  open(rect, opts = {}) {
    this.active = true;
    this.calibrating = !!opts.calibrate;
    this.screen.hidden = false;
    this.overlay.show(0);
    this.tracker.reset();
    this.hideFocus(true);
    this.startStream();
    if (S.mode === 'B') this.tracker.load();
    this.setCalibUI(this.calibrating);
    if (S.focusSquare && !this.calibrating) setTimeout(() => this.showFocus(this.preview.clientWidth / 2, this.preview.clientHeight / 2, false, true), 380);
    requestAnimationFrame(this.loop);
    if (rect) this.animateLaunch(rect);
    else this.app.home.el.style.visibility = 'hidden';
  }

  animateLaunch(rect) {
    const W = window.innerWidth, H = window.innerHeight;
    const sx = rect.w / W, sy = rect.h / H;
    const R = rect.r;
    const D = this.app.displayRadius();
    const dur = 430;
    const ease = springEasing(0.34, 0.86, dur / 1000);
    // the icon picture, stretched over the opening window, cross-fades into the app
    const info = this.app.home.imageBox();
    const img = this.launchIcon.firstElementChild;
    img.src = this.app.home.img.currentSrc || this.app.home.img.src;
    img.style.width = (info.w * W) / rect.w + 'px';
    img.style.height = (info.h * H) / rect.h + 'px';
    img.style.left = ((info.x - rect.x) * W) / rect.w + 'px';
    img.style.top = ((info.y - rect.y) * H) / rect.h + 'px';
    this.root.style.overflow = 'hidden';
    const a = this.root.animate([
      { transform: `translate(${rect.x}px, ${rect.y}px) scale(${sx}, ${sy})`, borderRadius: `${R / sx}px / ${R / sy}px` },
      { transform: 'translate(0px, 0px) scale(1, 1)', borderRadius: `${D}px / ${D}px` },
    ], { duration: dur, easing: ease });
    this.launchIcon.animate([{ opacity: 1 }, { opacity: 1, offset: 0.08 }, { opacity: 0 }], { duration: 210, easing: 'ease-out' });
    const home = this.app.home.el;
    home.style.transformOrigin = `${rect.x + rect.w / 2}px ${rect.y + rect.h / 2}px`;
    const h = home.animate([{ transform: 'scale(1)', filter: 'brightness(1)' }, { transform: 'scale(1.12)', filter: 'brightness(.85)' }], { duration: dur, easing: ease });
    a.onfinish = () => { this.root.style.borderRadius = ''; };
    h.onfinish = () => { if (this.active) home.style.visibility = 'hidden'; };
  }

  close(animated = true) {
    if (!this.active) return Promise.resolve();
    const home = this.app.home.el;
    home.style.visibility = '';
    const rect = animated ? this.app.home.cameraRect() : null;
    const done = () => {
      this.active = false;
      this.screen.hidden = true;
      this.stopStream();
      this.setCalibUI(false);
      this.calibrating = false;
    };
    if (!rect) { done(); return Promise.resolve(); }
    const W = window.innerWidth, H = window.innerHeight;
    const sx = rect.w / W, sy = rect.h / H, R = rect.r, D = this.app.displayRadius();
    const dur = 380;
    const ease = springEasing(0.3, 0.9, dur / 1000);
    const a = this.root.animate([
      { transform: 'translate(0px, 0px) scale(1, 1)', borderRadius: `${D}px / ${D}px` },
      { transform: `translate(${rect.x}px, ${rect.y}px) scale(${sx}, ${sy})`, borderRadius: `${R / sx}px / ${R / sy}px` },
    ], { duration: dur, easing: ease, fill: 'forwards' });
    this.launchIcon.animate([{ opacity: 0 }, { opacity: 0, offset: 0.45 }, { opacity: 1 }], { duration: dur * 0.75, fill: 'forwards' });
    home.animate([{ transform: 'scale(1.12)', filter: 'brightness(.85)' }, { transform: 'scale(1)', filter: 'brightness(1)' }], { duration: dur, easing: ease });
    return new Promise((res) => {
      a.onfinish = () => {
        done();
        a.cancel();
        this.root.getAnimations().forEach((x) => x.cancel());
        this.launchIcon.getAnimations().forEach((x) => x.cancel());
        res();
      };
    });
  }

  suspend() { this.stopStream(); }
  resume() { if (this.active) this.startStream(); }

  /* ------------------------------ render loop ------------------------------ */
  loop(now) {
    if (!this.active) return;
    requestAnimationFrame(this.loop);
    const g = this.geom();
    const pw = this.preview.clientWidth, ph = this.preview.clientHeight;
    const quadA = this.modeAQuad(pw, ph, this.calibrating ? this.calibO : S.overlay);
    let quad = quadA;
    if (!this.calibrating && S.mode === 'B' && this.tracker.ready && this.overlay.visible) {
      if (g.ok && this._newFrame) { this.tracker.grab(this.video, g); this._newFrame = !('requestVideoFrameCallback' in this.video); }
      quad = this.tracker.current(now, quadA, S.trackHoldMs);
    }
    this.overlay.setQuad(quad);
    if (g.ok && S.realism.autoLight && this.overlay.visible && now - this._lastLight > 140) {
      this._lastLight = now;
      this.overlay.sampleLight(this.video, g, quad);
    }
    this._frames++;
    if (now - this._fpsT > 500) { this.fps = (this._frames * 1000) / (now - this._fpsT); this._frames = 0; this._fpsT = now; if (S.debug) this.drawDebug(g, quad); }
  }

  drawDebug(g, quad) {
    const pts = (q) => q.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ');
    let svg = `<polygon points="${pts(quad)}" fill="none" stroke="#ffd60a" stroke-width="1.5"/>`;
    if (this.tracker.raw && S.mode === 'B') svg += `<polygon points="${pts(this.tracker.raw)}" fill="none" stroke="#ff453a" stroke-width="1" stroke-dasharray="4 3"/>`;
    this.dbgSvg.innerHTML = svg;
    const L = this.overlay.light;
    this.dbgText.textContent = [
      `UI ${this.fps.toFixed(0)} fps · vidéo ${g.ok ? g.vw + '×' + g.vh : (this.denied ? 'REFUSÉE' : '—')}`,
      `mode ${S.mode}${S.mode === 'B' ? ` · cv ${this.tracker.status} · détection ${this.tracker.detFps.toFixed(0)} fps / ${this.tracker.detMs.toFixed(1)} ms · ${this.tracker.source}` : ''}`,
      `blanc ${L.w.map((w) => Math.round((w[0] + w[1] + w[2]) / 3)).join('/')} · noir ${Math.round(L.b[1])}`,
    ].join('\n');
  }

  /* ------------------------------ input ------------------------------ */
  bindInput() {
    const ptrs = new Map();
    let press = null;   // tap / long-press candidate on the preview
    let swipe = null;   // swipe-up from the bottom edge to close
    let gesture = null; // calibration gesture

    this.root.addEventListener('pointerdown', (e) => {
      if (!this.active) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const inPreview = this.preview.contains(e.target) || e.target === this.preview;

      if (this.calibrating) {
        if (inPreview) { this.root.setPointerCapture?.(e.pointerId); gesture = snapshotGesture(ptrs, this.calibO); }
        return;
      }
      if (ptrs.size > 1) { cancelPress(); return; }
      if (e.clientY > window.innerHeight - 64 && !this.shutter.contains(e.target)) {
        swipe = { id: e.pointerId, y: e.clientY, t: performance.now() };
        return;
      }
      if (this.shutter.contains(e.target)) { this.shutter.classList.add('down'); return; }
      if (inPreview) {
        const r = this.preview.getBoundingClientRect();
        press = {
          id: e.pointerId, x: e.clientX, y: e.clientY, px: e.clientX - r.left, py: e.clientY - r.top,
          timer: setTimeout(() => { press.long = true; this.onLongPress(press.px, press.py); }, LONG_PRESS_MS),
        };
      }
    });

    const cancelPress = () => { if (press) { clearTimeout(press.timer); press = null; } };

    this.root.addEventListener('pointermove', (e) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.calibrating && gesture) { this.applyGesture(gesture, ptrs); return; }
      if (press && press.id === e.pointerId && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 12) cancelPress();
      if (swipe && swipe.id === e.pointerId && swipe.y - e.clientY > 70) { swipe = null; this.close(true); }
    });

    const end = (e) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      if (this.calibrating) { gesture = ptrs.size ? snapshotGesture(ptrs, this.calibO) : null; return; }
      if (this.shutter.classList.contains('down')) {
        this.shutter.classList.remove('down');
        if (e.type === 'pointerup' && this.shutter.contains(document.elementFromPoint(e.clientX, e.clientY))) this.takePhoto();
      }
      if (swipe && swipe.id === e.pointerId) swipe = null;
      if (press && press.id === e.pointerId) {
        clearTimeout(press.timer);
        if (!press.long && e.type === 'pointerup') this.onTap(press.px, press.py);
        press = null;
      }
    };
    this.root.addEventListener('pointerup', end);
    this.root.addEventListener('pointercancel', end);

    // calibration toolbar
    this.calibBar.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const fx = this.overlay.fx;
      switch (b.dataset.c) {
        case 'ghost': fx.classList.toggle('ghost'); b.classList.toggle('on', fx.classList.contains('ghost')); break;
        case 'reset': this.calibO = { ...DEFAULTS.overlay }; break;
        case 'cancel': this.endCalibration(false); break;
        case 'save': this.endCalibration(true); break;
      }
    });
  }

  applyGesture(g0, ptrs) {
    const pw = this.preview.clientWidth, ph = this.preview.clientHeight;
    const cur = [...ptrs.values()];
    const o = { ...g0.o };
    if (g0.pts.length === 1 || cur.length === 1) {
      o.cx = g0.o.cx + (cur[0].x - g0.pts[0].x) / pw;
      o.cy = g0.o.cy + (cur[0].y - g0.pts[0].y) / ph;
    } else {
      const [a0, b0] = g0.pts, [a1, b1] = cur;
      const m0 = [(a0.x + b0.x) / 2, (a0.y + b0.y) / 2], m1 = [(a1.x + b1.x) / 2, (a1.y + b1.y) / 2];
      const d0 = Math.hypot(b0.x - a0.x, b0.y - a0.y), d1 = Math.hypot(b1.x - a1.x, b1.y - a1.y);
      const ang0 = Math.atan2(b0.y - a0.y, b0.x - a0.x), ang1 = Math.atan2(b1.y - a1.y, b1.x - a1.x);
      o.cx = g0.o.cx + (m1[0] - m0[0]) / pw;
      o.cy = g0.o.cy + (m1[1] - m0[1]) / ph;
      o.w = clamp(g0.o.w * (d1 / Math.max(1, d0)), 0.08, 1.2);
      o.rot = g0.o.rot + ((ang1 - ang0) * 180) / Math.PI;
    }
    o.cx = clamp(o.cx, -0.2, 1.2);
    o.cy = clamp(o.cy, -0.2, 1.2);
    this.calibO = o;
  }

  onTap(x, y) {
    this.aeLock.hidden = true;
    if (S.focusSquare) this.showFocus(x, y);
    if (this.overlay.visible) this.overlay.hide(S.reveal);
  }

  onLongPress(x, y) {
    if (!this.overlay.visible) { this.tracker.reset(); this.overlay.show(180); }
    if (S.focusSquare) {
      this.showFocus(x, y, true);
      this.aeLock.hidden = false;
    }
  }

  showFocus(x, y, lock = false, auto = false) {
    const pw = this.preview.clientWidth, ph = this.preview.clientHeight;
    const fb = this.focusBox;
    const half = S.fbSize / 2 + 2;
    clearTimeout(this._fbT1); clearTimeout(this._fbT2);
    fb.classList.toggle('auto', auto);
    fb.style.left = clamp(x, half, pw - half - (auto ? 0 : 26)) + 'px';
    fb.style.top = clamp(y, half, ph - half) + 'px';
    fb.hidden = false;
    fb.classList.remove('anim', 'dim');
    void fb.offsetWidth;
    fb.classList.add('anim');
    if (lock) {
      fb.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 600, delay: 320 });
      return; // stays visible while AE/AF lock is on
    }
    this._fbT1 = setTimeout(() => fb.classList.add('dim'), 1300);
    this._fbT2 = setTimeout(() => this.hideFocus(), 2600);
  }

  hideFocus(all = false) {
    this.focusBox.hidden = true;
    this.focusBox.classList.remove('anim', 'dim');
    if (all) this.aeLock.hidden = true;
  }

  takePhoto() {
    this.flash.animate([{ opacity: 0 }, { opacity: 0.95, offset: 0.2 }, { opacity: 0 }], { duration: 240, easing: 'ease-out' });
    const g = this.geom();
    const c = this.thumb.getContext('2d');
    const T = this.thumb.width;
    if (g.ok) {
      // square centre crop of the preview, mirrored like the preview
      const side = g.pw, oy = (g.ph - g.pw) / 2;
      const k = T / side;
      c.save();
      c.setTransform(-1, 0, 0, 1, T, 0);
      const vx = g.crop.x, vy = g.crop.y + oy / g.s;
      c.drawImage(this.video, vx, vy, side / g.s, side / g.s, 0, 0, T, T);
      c.restore();
      this.overlay.drawInto(c, ([x, y]) => [x * k, (y - oy) * k]);
    }
    this.thumb.animate([{ transform: 'scale(.35)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 300, delay: 120, easing: 'cubic-bezier(.2,.9,.3,1.2)', fill: 'backwards' });
  }

  /* ------------------------------ calibration ------------------------------ */
  startCalibration() {
    this.calibO = { ...S.overlay };
    this.open(null, { calibrate: true });
  }

  setCalibUI(on) {
    this.calibBar.hidden = !on;
    this.calibHelp.hidden = !on;
    this.overlay.fx.classList.toggle('calib', on);
    if (!on) this.overlay.fx.classList.remove('ghost');
  }

  endCalibration(keep) {
    if (keep) { S.overlay = { ...this.calibO }; save(); this.realismChanged(); }
    this.close(false);
    this.app.openSettings();
  }
}

function snapshotGesture(ptrs, o) {
  return { pts: [...ptrs.values()].slice(0, 2).map((p) => ({ ...p })), o: { ...o } };
}
