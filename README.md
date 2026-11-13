# Seahelm — Marine Navigator

> Essential navigation, tracking, weather, and safety tools for small craft and unmotorized boaters (kayaks, paddleboards, canoes, rowboats, dinghies, small sailboats).

Recreated in 2026 using **100% Primitive Web Standard APIs** — zero external frameworks, zero bundlers, and zero proprietary dependencies. Inspired by the original 2015 [kubicue/seahelm](https://github.com/kubicue/seahelm) PhoneGap & jQuery Mobile application.

---

## ⚓ Features & Web Standard APIs

| Capability | Primitive Web Standard API | What it Does for the Boater |
| :--- | :--- | :--- |
| **Speedometer & GPS** | `navigator.geolocation` | Real-time Speed Over Ground (SOG) in **Knots**, course heading, altitude, accuracy, and nautical DDM coordinates (`32° 42.900' N`). |
| **Live Compass & Inclinometer** | `DeviceOrientationEvent` & `DeviceMotionEvent` | Real-time magnetic compass rose heading and hull **heel (roll)** and **trim (pitch)** angles for craft balance. |
| **Nautical Chart Plotter** | HTML5 `<canvas>` API | Marine vector chart with distance range rings (0.25 to 2.0 NM), vessel orientation, 5-minute velocity vectors, breadcrumbs, waypoints, and OpenStreetMap/OpenSeaMap caching. |
| **Marine Weather & Waves** | `fetch()` + Open-Meteo API | Modern replacement for defunct DarkSky/Forecast.io. Live wind speed/gusts/direction, wave height & swell period, barometric pressure, visibility, and Small Craft Advisory warnings. |
| **Acoustic Marine Signals** | Web Audio API | USCG / COLREGS sound signaling required for small craft: **Prolonged Fog Horn** (Rule 35), **Whistle**, **5 Short Blasts** (Danger/Doubt, Rule 34), and **Morse SOS**. |
| **Anchor Drag Watch** | `navigator.geolocation` + `navigator.vibrate` | Sets an anchor swing perimeter (30m). Triggers audio horn and haptic pulses if the boat drifts out of the safe zone. |
| **Screen Stay Awake** | Screen Wake Lock API (`navigator.wakeLock`) | Keeps the helm display awake while hands are busy paddling or handling the tiller. |
| **Waypoints & Trip Logs** | Web Storage API (`localStorage`) & `Blob` | Save harbor/fishing marks with live bearing and distance (NM). Records trips and exports standard **GPX track files**. |
| **Offline PWA** | Service Worker (`sw.js`) & Cache API | Works completely offline when boating out of cell tower range. |
| **Night Vision Mode** | Modern CSS `:root` + `data-theme` | High-contrast crimson red-on-black display mode that preserves mariner night adaptation. |

---

## 🚀 Getting Started

Since Seahelm is built purely with native Web Standard APIs, there are no build steps, compilers, or npm dependencies needed!

### Running Locally

You can serve it with any standard HTTP server:

```sh
# Using Python
python3 -m http.server 8080

# Using Node
npx serve .
```

Open `http://localhost:8080` in your mobile or desktop browser.

### Installing as a PWA

1. Open Seahelm in Chrome or Safari (iOS).
2. Tap **Share** (iOS) or the **Install** button / menu (Android/Chrome).
3. Select **Add to Home Screen**.
4. Seahelm runs standalone fullscreen with full offline access.

---

## 🧭 Navigation Views

### 1. Helm (Main Cockpit)
- High-contrast digital speedometer in **Knots** with average and max trip speeds.
- Interactive compass dial with cardinal heading indicator.
- Hull inclinometer showing port/starboard heel angle.
- Instant marine conditions snapshot and quick advisory level.
- Trip computer with start/stop recording, GPX export, and demo simulator.

### 2. Track (Nautical Chart)
- High-performance canvas chart plotter with smooth drag pan and zoom.
- Vessel silhouette indicating live heading and 5-minute projected course vector.
- Concentric range rings calibrated in Nautical Miles (0.25, 0.5, 1.0, 2.0 NM).
- Waypoint mark dropping with bearing line and distance calculation.
- Offline vector grid fallback when out of cell reception.

### 3. Weather (Marine Conditions)
- Quick harbor presets (San Diego Bay, Marina del Rey / LA, San Francisco Bay, Biscayne Bay / Miami, NY Harbor, Lake Michigan / Chicago) plus live GPS Current Location.
- Open-Meteo Marine API data: Wind speed, gusts, direction, wave height, swell period, visibility, and atmospheric pressure.
- Automated Small Craft Advisory / Gale Warning alert indicators.

### 4. Safety (Signals & Anchor Watch)
- One-tap USCG & COLREGS compliant acoustic signals synthesized with Web Audio.
- Anchor drag alarm with real-time drift calculation.

---

## 📄 License

MIT License — free for mariners, paddlers, and developers.

