// Secret settings: opened with a two-finger long press on the top-left corner
// of the App Library. Spectators never see this screen.

import { S, save, resetAll } from './store.js';
import { RANKS, SUITS, SUIT_SYM, isRed, cardLabel, loadCardSource, PreparedCard, NEUTRAL_LIGHT } from './cards.js';
import { $ } from './util.js';

const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v != null) el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null) el.append(kid);
  return el;
};

export class Settings {
  constructor(app) {
    this.app = app;
    this.el = $('#settings');
  }

  get isOpen() { return !this.el.hidden; }

  open() {
    this.render();
    this.el.hidden = false;
    this.el.scrollTop = 0;
  }

  close() { this.el.hidden = true; }

  commit(kind) {
    save();
    this.app.applySettings(kind);
  }

  /* ---------- controls ---------- */
  row(label, control, val) {
    return h('div', { class: 'row' }, h('span', { class: 'lbl' }, label), val || null, control);
  }

  seg(options, get, set) {
    const wrap = h('div', { class: 'seg' });
    const draw = () => wrap.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === String(get())));
    for (const [v, label] of options) {
      wrap.append(h('button', { 'data-v': v, onclick: () => { set(v); draw(); } }, label));
    }
    draw();
    return wrap;
  }

  sw(get, set) {
    const b = h('button', { class: 'switch' });
    const draw = () => b.classList.toggle('on', !!get());
    b.addEventListener('click', () => { set(!get()); draw(); });
    draw();
    return b;
  }

  slider(label, min, max, step, get, set, fmt = (v) => v) {
    const val = h('span', { class: 'val' }, String(fmt(get())));
    const input = h('input', { type: 'range', min, max, step, value: get() });
    input.addEventListener('input', () => { val.textContent = fmt(+input.value); set(+input.value, false); });
    input.addEventListener('change', () => set(+input.value, true));
    return this.row(label, input, val);
  }

  /* ---------- page ---------- */
  render() {
    const R = S.realism;
    const el = this.el;
    el.innerHTML = '';

    el.append(h('button', { class: 'close', onclick: () => this.app.closeSettings() }, 'Fermer'));
    el.append(h('h1', {}, 'Réglages secrets'));

    /* --- forced card --- */
    el.append(h('h2', {}, 'Carte forcée'));
    const thumb = h('canvas', { width: 210, height: 293 });
    const meta = h('div', { class: 'meta' });
    const grid = h('div', { class: 'card-grid' });
    const drawPick = async () => {
      meta.innerHTML = '';
      meta.append(h('b', {}, cardLabel(S.card)), h('br'));
      const src = await loadCardSource(S.card);
      meta.append(src.photo ? `Photo : assets/cards/${src.file}` : `Dessin de secours — ajoutez assets/cards/${S.card}.jpg`);
      const p = new PreparedCard(src.img, { mirror: R.mirror, blurPx: 0, featherPx: 1, radiusFrac: R.radius });
      const tmp = document.createElement('canvas');
      tmp.width = p.W; tmp.height = p.H;
      tmp.getContext('2d').putImageData(p.render(NEUTRAL_LIGHT), 0, 0);
      const ctx = thumb.getContext('2d');
      ctx.clearRect(0, 0, thumb.width, thumb.height);
      ctx.drawImage(tmp, 0, 0, thumb.width, thumb.height);
      grid.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.code === S.card));
    };
    for (const s of SUITS) {
      for (const r of RANKS) {
        const code = r + s;
        grid.append(h('button', {
          'data-code': code,
          class: isRed(code) ? 'red' : '',
          onclick: () => { S.card = code; this.commit('card'); drawPick(); },
        }, r === '10' ? '10' : r, h('br'), SUIT_SYM[s]));
      }
    }
    el.append(h('div', { class: 'group' }, h('div', { class: 'card-pick' }, thumb, meta), grid));
    drawPick();

    /* --- overlay mode --- */
    el.append(h('h2', {}, 'Superposition'));
    const cvState = h('span', { class: 'val' }, this.trackerState());
    this.cvEl = cvState;
    el.append(h('div', { class: 'group' },
      this.row('Mode', this.seg([['A', 'A · Fixe'], ['B', 'B · Suivi']], () => S.mode, (v) => { S.mode = v; this.commit('mode'); cvState.textContent = this.trackerState(); })),
      this.row('OpenCV (mode B)', cvState),
      this.row(h('button', { class: 'btn', onclick: () => this.app.calibrateOverlay() }, 'Calibrer la position de la carte…'), h('span')),
    ));
    el.append(h('p', { class: 'note' }, 'Mode A : la carte reste à une position fixe, tenez la vraie carte derrière. Mode B : la carte suit la vraie carte détectée et revient à la position du mode A si la détection décroche plus de 0,3 s.'));

    /* --- reveal --- */
    el.append(h('h2', {}, 'Révélation (tap sur l’aperçu)'));
    el.append(h('div', { class: 'group' },
      this.row('Effet', this.seg([['crossfade', 'Fondu'], ['blur', 'Flou'], ['glitch', 'Glitch']], () => S.reveal, (v) => { S.reveal = v; this.commit('reveal'); })),
      this.row('Carré jaune AF / AE-AF', this.sw(() => S.focusSquare, (v) => { S.focusSquare = v; this.commit('ui'); })),
    ));
    el.append(h('p', { class: 'note' }, 'Tap : la carte disparaît (avec le carré de mise au point, comme un vrai tap). Appui long : la carte revient, avec « VERROUILLAGE AE/AF ».'));

    /* --- realism --- */
    el.append(h('h2', {}, 'Réalisme de la carte'));
    const rz = (key, live) => (v, final) => { R[key] = v; if (final || live) this.commit(final ? 'realism' : 'light'); };
    el.append(h('div', { class: 'group' },
      this.row('Éclairage auto (lit la vraie carte)', this.sw(() => R.autoLight, (v) => { R.autoLight = v; this.commit('light'); })),
      this.slider('Luminosité', 0.6, 1.4, 0.01, () => R.brightness, rz('brightness', true), (v) => v.toFixed(2)),
      this.slider('Contraste', 0.7, 1.3, 0.01, () => R.contrast, rz('contrast', true), (v) => v.toFixed(2)),
      this.slider('Flou', 0, 3, 0.1, () => R.blur, rz('blur'), (v) => v.toFixed(1) + ' px'),
      this.slider('Grain', 0, 0.6, 0.01, () => R.grain, rz('grain'), (v) => v.toFixed(2)),
      this.slider('Bord doux', 0, 4, 0.1, () => R.soft, rz('soft'), (v) => v.toFixed(1) + ' px'),
      this.slider('Arrondi des coins', 0, 0.12, 0.002, () => R.radius, rz('radius'), (v) => (v * 100).toFixed(1) + ' %'),
      this.row('Carte en miroir (comme le selfie)', this.sw(() => R.mirror, (v) => { R.mirror = v; this.commit('realism'); })),
    ));

    /* --- camera UI layout --- */
    el.append(h('h2', {}, 'Interface Appareil photo'));
    el.append(h('div', { class: 'group' },
      this.slider('Décalage pilules haut', -40, 40, 0.5, () => S.topShift, (v) => { S.topShift = v; this.commit('ui'); }, (v) => v + ' px'),
      this.slider('Décalage aperçu', -40, 40, 0.5, () => S.previewShift, (v) => { S.previewShift = v; this.commit('ui'); }, (v) => v + ' px'),
      this.slider('Décalage commandes bas', -40, 40, 0.5, () => S.bottomShift, (v) => { S.bottomShift = v; this.commit('ui'); }, (v) => v + ' px'),
      this.slider('Taille carré AF', 60, 160, 1, () => S.fbSize, (v) => { S.fbSize = v; this.commit('ui'); }, (v) => Math.round(v) + ' pt'),
      this.row('Grille', this.sw(() => S.grid, (v) => { S.grid = v; this.commit('ui'); })),
      this.row('Icônes', this.seg([['portrait', 'Téléphone droit'], ['capture', 'Comme la capture']], () => S.glyphRot, (v) => { S.glyphRot = v; this.commit('ui'); })),
      this.row('Résolution', this.seg([['max', 'Max'], ['1440', '1440p'], ['960', '960p']], () => S.resolution, (v) => { S.resolution = v; this.commit('stream'); })),
      this.slider('Calque camera_ref.png', 0, 1, 0.05, () => S.refOpacity, (v) => { S.refOpacity = v; this.commit('ui'); }, (v) => Math.round(v * 100) + ' %'),
    ));
    el.append(h('p', { class: 'note' }, 'Pour comparer : « Icônes = Comme la capture » + calque camera_ref.png à ~50 %, puis ouvrez la caméra. Remettez « Téléphone droit » et le calque à 0 % avant de jouer (les icônes tournent avec le téléphone, comme dans la vraie app).'));

    /* --- App Library --- */
    el.append(h('h2', {}, 'Bibliothèque d’apps'));
    el.append(h('div', { class: 'group' },
      this.row(h('button', { class: 'btn', onclick: () => this.app.editZones() }, 'Calibrer les zones de tap…'), h('span')),
      this.slider('Bande barre d’état', 0, 80, 1, () => S.sbHeight ?? this.app.safeTop(), (v) => { S.sbHeight = v; this.commit('home'); }, (v) => v + ' px'),
      this.row(h('button', { class: 'btn', onclick: () => { S.sbHeight = null; this.commit('home'); this.render(); } }, 'Bande = zone sûre iOS (auto)'), h('span')),
      this.slider('Flou de la bande', 0, 30, 1, () => S.sbBlur, (v) => { S.sbBlur = v; this.commit('home'); }, (v) => v + ' px'),
    ));

    /* --- debug --- */
    el.append(h('h2', {}, 'Débogage'));
    el.append(h('div', { class: 'group' },
      this.row('Contours et infos', this.sw(() => S.debug, (v) => { S.debug = v; this.commit('debug'); })),
    ));
    const info = h('div', { class: 'info' }, '…');
    el.append(h('div', { class: 'group' }, info));
    this.fillInfo(info);

    el.append(h('h2', {}, ''));
    el.append(h('div', { class: 'group' },
      this.row(h('button', { class: 'btn danger', onclick: () => { if (confirm('Tout réinitialiser ?')) { resetAll(); this.app.applySettings('all'); this.render(); } } }, 'Réinitialiser tous les réglages'), h('span')),
    ));
  }

  updateCv() { if (this.cvEl) this.cvEl.textContent = this.trackerState(); }

  trackerState() {
    const t = this.app.camera.tracker;
    return { off: S.mode === 'B' ? 'en attente' : 'non chargé', loading: 'chargement…', ready: 'prêt ✓', error: 'erreur ✗' }[t.status] || t.status;
  }

  async fillInfo(el) {
    const W = window.innerWidth, H = window.innerHeight, dpr = window.devicePixelRatio || 1;
    let cam = '?';
    try { cam = (await navigator.permissions.query({ name: 'camera' })).state; } catch (_) { /* not supported */ }
    const lines = [
      `Écran : ${W}×${H} pt @${dpr}x (${Math.round(W * dpr)}×${Math.round(H * dpr)} px)`,
      `Zone sûre : haut ${this.app.safeTop()} px · bas ${this.app.safeBottom()} px`,
      `Mode autonome (écran d’accueil) : ${this.app.isStandalone() ? 'oui ✓' : 'NON — lancer depuis l’icône'}`,
      `HTTPS : ${location.protocol === 'https:' || location.hostname === 'localhost' ? 'oui ✓' : 'NON — caméra bloquée'}`,
      `Permission caméra : ${cam}${this.app.camera.denied ? ' (dernier essai refusé)' : ''}`,
      `Wake Lock : ${this.app.wakeState}`,
      `Easing ressort CSS linear() : ${CSS.supports('animation-timing-function', 'linear(0, 1)') ? 'oui' : 'non (repli)'}`,
    ];
    el.textContent = lines.join('\n');
  }
}
