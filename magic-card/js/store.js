// Persistent settings (localStorage). Everything the performer tunes lives here.

const KEY = 'mc.settings.v1';

export const DEFAULTS = {
  card: 'JS',                 // forced card (rank + suit letter: A,2..10,J,Q,K + S,H,D,C)
  mode: 'A',                  // 'A' fixed overlay, 'B' OpenCV tracking
  reveal: 'crossfade',        // 'crossfade' | 'blur' | 'glitch'
  debug: false,
  // Mode A overlay, in fractions of the preview (cx, cy, w) + rotation in degrees
  overlay: { cx: 0.5, cy: 0.56, w: 0.42, rot: -3 },
  zones: null,                // null = default App Library grid
  sbHeight: null,             // px; null = env(safe-area-inset-top)
  sbBlur: 0,                  // px blur on the wallpaper strip (App Library background is blurred)
  realism: {
    autoLight: true,          // sample the real card under the overlay and match its white/black/gradient
    brightness: 1.0,          // manual multiplier on top
    contrast: 1.0,
    blur: 0.7,                // screen px
    grain: 0.16,              // 0..0.6
    soft: 1.2,                // edge feather, screen px
    radius: 0.05,             // corner radius, fraction of card width (real cards ≈ 0.048)
    mirror: true,             // mirror the fake card like the selfie preview
  },
  focusSquare: true,          // yellow AF square on tap, "VERROUILLAGE AE/AF" on long press
  glyphRot: 'portrait',       // 'portrait' (phone upright) | 'capture' (exactly like camera_ref.png, phone sideways)
  grid: true,                 // rule-of-thirds grid (on in camera_ref.png)
  fbSize: 124.67,             // focus square size (pt), measured on camera_ref.png
  previewShift: 0,            // px
  topShift: 0,                // px (top pills)
  bottomShift: 0,             // px (shutter + bottom row)
  refOpacity: 0,              // camera_ref.png overlay for alignment (0 = hidden)
  resolution: 'max',          // 'max' | '1440' | '960'
  trackHoldMs: 300,
};

function merge(base, extra) {
  const out = Array.isArray(base) ? base.slice() : { ...base };
  if (!extra || typeof extra !== 'object') return out;
  for (const k of Object.keys(extra)) {
    const v = extra[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      out[k] = merge(base[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return merge(DEFAULTS, JSON.parse(raw));
  } catch (_) { /* private mode, corrupted JSON… */ }
  return merge(DEFAULTS, {});
}

export const S = load();
const listeners = new Set();

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) { /* ignore */ }
  listeners.forEach((fn) => fn(S));
}

export function onChange(fn) { listeners.add(fn); }

export function resetAll() {
  try { localStorage.removeItem(KEY); } catch (_) { /* ignore */ }
  const fresh = merge(DEFAULTS, {});
  for (const k of Object.keys(S)) delete S[k];
  Object.assign(S, fresh);
  save();
}
