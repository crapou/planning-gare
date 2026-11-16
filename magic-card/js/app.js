// Boot + glue: PWA hardening, wake lock, routing between the two screens.

import { S } from './store.js';
import { Home } from './home.js';
import { Camera } from './camera.js';
import { Settings } from './settings.js';
import { $ } from './util.js';

class App {
  constructor() {
    this.wakeState = 'inactif';
    this.wakeLock = null;
    this.probe = document.createElement('div');
    this.probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
    document.body.appendChild(this.probe);

    this.home = new Home(this);
    this.camera = new Camera(this);
    this.settings = new Settings(this);
    this.camera.tracker.onStatus(() => this.settings.updateCv());

    this.hardenAgainstBrowserUI();
    this.setupWakeLock();
    this.setupLifecycle();
    this.registerSW();
    this.preloadTracker();

    // desktop testing helpers (no effect on the phone): S = settings, Esc = back
    window.addEventListener('keydown', (e) => {
      if (e.key === 's' || e.key === 'S') this.settings.isOpen ? this.closeSettings() : this.openSettings();
      if (e.key === 'Escape' && this.camera.active) this.camera.close(true);
    });
    if (location.hash === '#settings') this.openSettings();
  }

  /* ---------- environment ---------- */
  safeTop() { return Math.round(parseFloat(getComputedStyle(this.probe).paddingTop) || 0); }
  safeBottom() { return Math.round(parseFloat(getComputedStyle(this.probe).paddingBottom) || 0); }
  isStandalone() { return navigator.standalone === true || matchMedia('(display-mode: standalone)').matches; }
  displayRadius() {
    // iPhone display corner radius ≈ 0.14 × width (55 pt on 393 pt-wide models)
    return Math.round(window.innerWidth * 0.14);
  }

  /* ---------- navigation ---------- */
  launchCamera(rect) {
    this.requestWakeLock();
    this.camera.open(rect);
  }

  openSettings() {
    if (this.camera.active) this.camera.close(false);
    if (this.home.editing) this.home.stopEditing();
    this.settings.open();
  }

  closeSettings() { this.settings.close(); }

  calibrateOverlay() {
    this.settings.close();
    this.requestWakeLock();
    this.camera.startCalibration();
  }

  editZones() {
    this.settings.close();
    this.home.startEditing();
  }

  applySettings(kind) {
    if (kind === 'card' || kind === 'all') this.camera.cardChanged();
    if (kind === 'realism' || kind === 'all') this.camera.realismChanged();
    if (kind === 'light') this.camera.overlay.paint(true);
    if (kind === 'stream' && this.camera.active) { this.camera.stopStream(); this.camera.startStream(); }
    this.camera.applySettings();
    this.home.applySettings();
  }

  /* ---------- make it feel native, not like a web page ---------- */
  hardenAgainstBrowserUI() {
    const inSettings = (e) => e.target && e.target.closest && e.target.closest('#settings');
    const stop = (e) => { if (!inSettings(e)) e.preventDefault(); };
    // pinch zoom (Safari gesture events), double-tap zoom, rubber-band, callouts, selection
    ['gesturestart', 'gesturechange', 'gestureend'].forEach((t) => document.addEventListener(t, (e) => e.preventDefault(), { passive: false }));
    document.addEventListener('touchmove', stop, { passive: false });
    document.addEventListener('touchstart', (e) => { if (e.touches.length > 1 && !inSettings(e)) e.preventDefault(); }, { passive: false });
    document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('selectstart', (e) => { if (!inSettings(e)) e.preventDefault(); });
    document.addEventListener('dragstart', (e) => e.preventDefault());
  }

  /* ---------- the screen must never dim mid-trick ---------- */
  setupWakeLock() {
    const kick = () => this.requestWakeLock();
    document.addEventListener('pointerdown', kick, { capture: true });
  }

  async requestWakeLock() {
    if (document.hidden) return;
    if ('wakeLock' in navigator) {
      if (this.wakeLock && !this.wakeLock.released) return;
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeState = 'actif (Wake Lock API)';
        this.wakeLock.addEventListener('release', () => { this.wakeState = 'relâché'; });
        return;
      } catch (_) { /* fall through to the video fallback */ }
    }
    // Fallback for older iOS: a tiny muted looping inline video keeps the display awake.
    const v = $('#keepawake');
    if (v && v.paused) {
      try { await v.play(); this.wakeState = 'actif (vidéo)'; } catch (_) { this.wakeState = 'indisponible'; }
    }
  }

  setupLifecycle() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.camera.suspend();
      } else {
        this.requestWakeLock();
        this.camera.resume();
      }
    });
    window.addEventListener('pageshow', () => this.camera.resume());
  }

  registerSW() {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  preloadTracker() {
    // Mode B: start downloading/compiling OpenCV once the App Library is on screen,
    // so it is ready by the time the Camera opens. Never blocks the first paint.
    if (S.mode !== 'B') return;
    const go = () => this.camera.tracker.load();
    if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 1500 });
    else setTimeout(go, 800);
  }
}

window.__app = new App();
