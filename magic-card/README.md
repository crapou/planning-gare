# Magic Card: fake App Library + iOS Camera card trick

A static web app (vanilla HTML/CSS/JS, no build step, no backend) that you launch from your iPhone Home Screen in full-screen standalone mode:

1. It shows a copy of your **App Library** (your own screenshot, mapped 1:1 to the screen's pixels).
2. Tapping **Camera** opens a rebuilt iOS **Camera** in selfie mode, with the live front camera and the usual opening animation.
3. The card you hold up is covered by the card you chose in advance, as if a filter were on.
4. **Tap** the preview: the "filter" switches off and the real card appears. **Long press** brings the fake card back for the next show.

Everything sits in this `magic-card/` folder. The planning app at the repository root is separate and unaffected.

```
magic-card/
├── index.html              entry point (PWA meta tags)
├── manifest.webmanifest    display: standalone
├── sw.js                   offline cache (works on bad venue Wi-Fi)
├── vercel.json             headers (camera permission policy, caching)
├── css/app.css
├── js/
│   ├── app.js              boot, browser-UI hardening, wake lock, navigation
│   ├── home.js             App Library, tap zones, press effect, secret gesture, zone editor
│   ├── camera.js           Camera UI, getUserMedia, tap/long press, shutter, launch animation
│   ├── overlay.js          card placement (matrix3d homography), lighting match, grain, reveals
│   ├── cards.js            card photo loading and normalisation, fallback drawn deck
│   ├── tracker.js          Mode B: frame feeding, corner ordering, One-Euro smoothing, hold/fallback
│   ├── tracker-worker.js   Mode B: OpenCV detection in a Web Worker
│   ├── settings.js         secret settings panel
│   ├── store.js            localStorage settings + defaults
│   └── util.js             spring easing, homography, filters
├── vendor/opencv.js        OpenCV.js 4.10 (self-hosted, loaded only for Mode B)
├── media/keepawake.mp4     fallback for keeping the screen awake on older iOS
├── icons/                  Home Screen icon (replace with your own)
└── assets/                 YOUR files (see below)
```

---

## 1. Add your assets

Put these in `magic-card/assets/`:

| File | What it is |
|---|---|
| `home.png` | **Required.** A screenshot of your App Library ("Bibliothèque d'apps"), unedited, at full resolution (e.g. 1179×2556 on a 15 Pro or 16). |
| `wallpaper.png` | Your wallpaper with no icons, taken at the same resolution. It covers the clock that is frozen in the screenshot. If it's missing, the app stretches the row of pixels just under the status bar instead, which works well for plain or gradient wallpapers. |
| `camera_ref.png` | A screenshot of your real Camera in selfie mode. It's only used as a semi-transparent overlay to line up the rebuilt UI (see §5). |
| `thumb.jpg` | *Optional.* Your real last photo, shown in the Camera thumbnail. |
| `cards/<CODE>.jpg` | Photos of the fake cards (`.jpg`, `.jpeg`, `.png` or `.webp`). |

**Card file names:** rank + suit, in capitals.
Ranks: `A 2 3 4 5 6 7 8 9 10 J Q K` (J = Valet, Q = Dame, K = Roi). Suits: `S` pique, `H` cœur, `D` carreau, `C` trèfle.
Examples: `JS.jpg` is the Jack of spades, `8H.jpg` the 8 of hearts and `10D.png` the 10 of diamonds.

**Card photos:** shoot them flat from directly above, in even light with no glare. **Crop tightly to the card's edges**, in portrait. The app finds the paper white and ink black, mirrors the image, rounds the corners and feathers the edge on its own. If a card has no photo, a clean drawn card is used instead (settings show "Dessin de secours"), so you can test before you take photos.

> Use cards from **the same deck** as the one you hold. Same back, same face design.

---

## 2. Deploy on Vercel (HTTPS is required for the camera)

### Option A: dashboard (no command line)
1. Push this repository to GitHub, then go to vercel.com → **Add New… → Project** and import it.
2. **Root Directory:** `magic-card` (important, because the root of the repo holds another app).
3. **Framework Preset:** `Other`. Leave the Build Command and Output Directory **empty**.
4. Click **Deploy**. You get a URL like `https://your-project.vercel.app`.

Every push redeploys. To keep the trick private, choose a URL that's hard to guess. The site also sends `noindex`.

### Option B: CLI
```bash
npm i -g vercel
cd magic-card
vercel          # first time: answer the questions (no build command)
vercel --prod
```

### After each deploy
Open the app once **while online** so the service worker caches the new version, then close it and open it again. After that, the app (including OpenCV) works offline.

### Test on a computer
```bash
cd magic-card && python3 -m http.server 8000   # then open http://localhost:8000
```
`localhost` counts as secure, so the webcam works. Press **S** to open the settings and **Esc** to close the Camera.

---

## 3. Add it to the Home Screen

1. Open the URL in **Safari** (it must be Safari, not Chrome).
2. Tap **Partager** (Share) → **Sur l'écran d'accueil** (Add to Home Screen).
3. Rename it as you like (the default is "Apps"), then tap **Ajouter**.
4. Always launch it **from that icon**. It then opens in standalone mode, with no Safari bars. The debug panel shows `standalone oui` to confirm.

To use your own Home Screen icon, replace `icons/apple-touch-icon.png` (180×180) **before** adding it to the Home Screen. iOS reads the icon only once, when you add the app.

---

## 4. Allow the camera for good

iOS asks for permission the first time you tap Camera. To avoid a prompt in the middle of a show:

1. **Réglages → Apps → Safari → Appareil photo → Autoriser** (on older iOS: Réglages → Safari → Appareil photo).
2. In Safari, on your site: **aA → Réglages du site web → Appareil photo → Autoriser**.
3. Depending on the iOS version, a Home Screen web app may still ask **once per launch**. Use this **pre-show routine**:
   - launch the app, tap Camera, **allow**;
   - swipe up from the bottom edge of the Camera to go back to the App Library (the reverse animation plays);
   - lock the phone or switch apps **without force-quitting** it.
   During the same session the permission is remembered, so there's no prompt in front of the audience.

If permission is refused, the preview simply stays black, like a busy camera. Spectators never see a message. Settings show the permission state, and the app asks again on the next Camera tap.

---

## 5. Calibration

### Secret settings
**Two-finger long press (≈0.75 s) on the top-left corner of the App Library.** Spectators never see this screen. Everything is saved in `localStorage`.

Settings cover the fake card, Mode A or B, overlay calibration, the reveal effect (fade, blur dissolve, glitch, each ≈250 ms), card realism (auto lighting, brightness, contrast, blur, grain, soft edge, corner radius, mirroring), Camera UI layout, App Library tap zones, the status-bar strip and debug outlines.

### a) App Library tap zones
1. Settings → **Débogage → Contours et infos**: every zone is outlined (red for icons, green for Camera). The debug panel also tells you whether `home.png` is mapped **1:1** (✓) to the screen's pixels.
2. Settings → **Calibrer les zones de tap…**: tap a zone to select it, drag to move it, drag the blue dot to resize it.
   - **= Caméra** makes the selected zone the one that opens the Camera.
   - **+ Zone / Supprimer / Défaut** add a zone, delete one, or restore the default grid.
   - **OK** saves.
3. Fit each zone tightly to its icon. The press effect (darken + shrink) cuts out exactly that rectangle, with rounded iOS corners.
4. **Status-bar strip:** by default it covers the iOS safe-area height. If a piece of the old clock or battery still shows, raise **Bande barre d'état** by a few pixels. If your App Library background is blurred, add **Flou de la bande**.

### b) Camera UI vs. your `camera_ref.png`
The Camera UI copies the **iOS 26** layout, and every position and size is measured on your `camera_ref.png` (1260×2736 px = 420×912 pt): the HEIF pill, the control pill (night mode, flash, Live, more), the 4:3 preview at 141 pt, the rule-of-thirds grid, the "1,4×"/"2" zoom, the shutter, the round thumbnail, the VIDÉO|PHOTO capsule and the flip button.

Your screenshot was taken with the phone **sideways**, so iOS had turned the icons and the zoom labels by 90°. In the trick you hold the phone upright, so by default the app shows them upright, like the real app would (setting **Icônes = Téléphone droit**).

To check the alignment on the phone:
1. Settings: **Icônes = Comme la capture** and **Calque camera_ref.png** ≈ 50 %.
2. Open the Camera. Your screenshot sits on top of the rebuilt UI.
3. If anything is off by a few points, use **Décalage pilules haut**, **Décalage aperçu** and **Décalage commandes bas**.
4. Set it back to **Téléphone droit** and **0 %** before performing.

`assets/thumb.png` is your real last photo, cropped from the screenshot. Replace it if your latest photo changes.

### c) Card overlay (Mode A, the default)
1. Settings → **Calibrer la position de la carte…** opens the Camera in calibration mode.
2. Hold your real card where you'll hold it during the show (same arm, same distance).
3. **One finger** moves the fake card. **Two fingers** resize and rotate it. **Opacité** makes it semi-transparent so you can see the real card behind it.
4. Line its edges up with the real card, then tap **Enregistrer**.

During the show, keep the real card at that spot. The fake card covers it completely, so small offsets don't matter as long as the real card stays hidden.

### d) Mode B (tracking)
OpenCV loads in the background once the App Library is showing (~10 MB, cached for offline use afterwards). It finds the largest bright quadrilateral in a 192×256 frame inside a Web Worker. Then:
- the fake card is mapped onto the 4 corners with a perspective transform (`matrix3d`);
- the corners are smoothed with a One-Euro filter (no jitter, little lag);
- if detection drops, the last position is held for 300 ms, then the card blends back to the Mode A position.

Debug mode shows the UI fps, detection fps, detection time per frame and the detected quadrilateral (red dashed line). Use Mode B only after it holds a steady lock under your show lighting. A plain, darker background behind the card helps a lot.

---

## 6. Realism details already handled

- The App Library is your own screenshot at 1:1 pixels, and the real live iOS status bar draws on top. The frozen one is covered by the matching crop of your wallpaper.
- The iOS press effect (darken + shrink), with the folder-platter colour filled in behind the shrunk icon.
- The app grows from the icon to full screen on a spring curve (CSS `linear()` spring, ~430 ms). The icon picture crossfades into the app and the App Library zooms slightly behind it. The reverse animation plays when you swipe up from the bottom edge.
- The iOS 26 Camera UI is drawn in HTML/CSS/SVG (crisp at 3x) with the system font. Each element is measured on your screenshot, including the yellow focus square that appears at the centre when the Camera opens.
- The preview is mirrored like the real front camera, and so is the fake card, so its indices read the way a real card's would in a selfie.
- **Lighting:** about 7 times per second, the app reads the pixels of the real card under the overlay. It estimates the paper white in each quadrant (which gives the light gradient and colour cast) and the ink's black level, then re-lights the fake card to match.
- Camera blur and soft edges are baked into the texture. Animated sensor grain sits on top. Corners are rounded and feathered.
- Tapping shows the yellow iOS focus square, so the reveal looks like an ordinary tap to focus. A long press shows "VERROUILLAGE AE/AF".
- The shutter gives a white flash, and the thumbnail pops in with the photo, fake card included.
- Things a website would give away are blocked: text selection, the long-press callout, pinch and double-tap zoom, rubber-band scrolling, the tap highlight, image dragging and the context menu.
- The screen never dims: Screen Wake Lock API, with a silent looping video as a fallback.

### Limits you can't get around on iOS
- **Status bar in the Camera:** the real Camera app hides the status bar. A web app can't, so the live clock and battery stay visible at the top, above the pills (they don't overlap).
- **Green camera dot:** while the camera is on, iOS shows its privacy indicator. Stopping the stream when you go back to the App Library turns it off.
- **System home gesture:** swiping up from the very bottom of the screen leaves the web app, like any app. To return to the fake App Library, swipe up starting from just **above** the home bar.
- A few pixels can differ from the real UI between iOS versions. That's what calibration step 5b is for.

---

## 7. Performance checklist

**Before the show**
- [ ] Opened **from the Home Screen icon** (debug: `standalone oui`).
- [ ] Camera permission granted for this session (pre-show routine §4). No prompt when you tap Camera.
- [ ] Battery > 50 %, **Low Power Mode off** (it throttles the CPU, GPU and camera frame rate).
- [ ] **Focus / Do Not Disturb on**, so no banner covers the trick.
- [ ] Brightness fixed (Auto-Brightness off if the room lighting changes).
- [ ] Other heavy apps closed. Phone not hot.
- [ ] App opened online at least once since the last deploy (offline cache up to date).
- [ ] Correct fake card selected (settings → Carte forcée).
- [ ] Mode A overlay calibrated **with the real card, in the show's lighting**.
- [ ] Reveal tested (tap) and restore tested (long press). Debug outlines **off**. **camera_ref** overlay at **0 %**.
- [ ] For Mode B: debug shows ≥ 30 fps detection and a steady lock. Otherwise use Mode A.
- [ ] Real card has the same back and the same design as your fake card photo.
- [ ] Settings → Résolution: if the UI stutters (debug "UI fps" < 55), try **1440p**.

**During the show**
- [ ] Open the App Library, tap Camera, hold the real card where you calibrated it.
- [ ] Hold it steady and keep your fingers on the edges (the overlay covers the centre).
- [ ] Tap the preview for the reveal. Long press afterwards to reset for the next audience.

**If something goes wrong**
- Black preview: permission refused or camera busy. Settings → Infos, or go back to the App Library and tap Camera again.
- Card looks too bright or too dark: turn on **Éclairage auto** and make sure the real card is behind the overlay, or adjust **Luminosité**.
- Card looks pasted on: raise **Flou** (0.8–1.2 px) and **Grain** (0.2), and keep **Bord doux** around 1–1.5 px.
- App Library slightly blurry or shifted: `home.png` isn't at the native resolution (debug "✗ pas 1:1"). Take the screenshot again on the same iPhone.
