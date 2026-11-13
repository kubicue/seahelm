/**
 * Seahelm Main Application
 * Modern Vanilla Web Standard Recreation
 */
import { Storage } from './storage.js';
import { GeoTracker } from './geo.js';
import { CompassManager } from './compass.js';
import { NauticalChart } from './chart.js';
import { WeatherManager } from './weather.js';
import { SafetyManager } from './safety.js';

class SeahelmApp {
  constructor() {
    this.settings = Storage.getSettings();
    this.geo = new GeoTracker({
      onUpdate: (telemetry) => this.onTelemetryUpdate(telemetry),
      onError: (err) => this.onGeoError(err)
    });
    this.compass = new CompassManager({
      onHeadingUpdate: (heading) => this.onCompassHeadingUpdate(heading),
      onAttitudeUpdate: (att) => this.onAttitudeUpdate(att)
    });
    this.weather = new WeatherManager();
    this.safety = new SafetyManager();
    this.chart = null;

    this.currentCity = 'san diego';
    this.activeWaypointId = null;

    this.dom = {};
  }

  init() {
    this.cacheDom();
    this.bindEvents();
    this.applySettings();

    // Initialize Chart
    const canvas = document.getElementById('chart-canvas');
    if (canvas) {
      this.chart = new NauticalChart(canvas);
      this.chart.setWaypoints(Storage.getWaypoints());
    }

    // Initialize Compass & Sensors
    this.compass.init();

    // Start Geolocation Tracker
    this.geo.start();

    // Load initial weather (San Diego default matching 2015 repo)
    this.loadWeatherForCity(this.currentCity);

    // Register PWA Service Worker
    this.registerServiceWorker();

    // Render Waypoints List
    this.renderWaypointsList();
  }

  cacheDom() {
    this.dom = {
      // Tabs
      tabBtns: document.querySelectorAll('.nav-tab-btn'),
      tabPanels: document.querySelectorAll('.tab-content'),

      // Header
      gpsDot: document.getElementById('gps-status-dot'),
      gpsText: document.getElementById('gps-status-text'),
      btnNightVision: document.getElementById('btn-night-vision'),
      btnWakeLock: document.getElementById('btn-wake-lock'),
      btnFullscreen: document.getElementById('btn-fullscreen'),

      // Helm Telemetry
      speedVal: document.getElementById('helm-speed-val'),
      headingVal: document.getElementById('helm-heading-val'),
      headingCardinal: document.getElementById('helm-heading-cardinal'),
      latVal: document.getElementById('helm-lat-val'),
      lonVal: document.getElementById('helm-lon-val'),
      accVal: document.getElementById('helm-acc-val'),
      tripDistVal: document.getElementById('helm-trip-dist'),
      maxSpeedVal: document.getElementById('helm-max-speed'),
      tripTimeVal: document.getElementById('helm-trip-time'),

      // Compass UI
      compassDial: document.getElementById('compass-dial'),
      pitchVal: document.getElementById('pitch-val'),
      rollVal: document.getElementById('roll-val'),
      rollIndicator: document.getElementById('roll-indicator'),
      btnCompassPerm: document.getElementById('btn-compass-permission'),

      // Trip controls
      btnStartTrip: document.getElementById('btn-start-trip'),
      btnExportGpx: document.getElementById('btn-export-gpx'),
      btnSimulate: document.getElementById('btn-simulate-gps'),

      // Chart controls
      btnChartCenter: document.getElementById('btn-chart-center'),
      btnZoomIn: document.getElementById('btn-zoom-in'),
      btnZoomOut: document.getElementById('btn-zoom-out'),
      chartCoords: document.getElementById('chart-overlay-coords'),
      chartSpeed: document.getElementById('chart-overlay-speed'),
      btnAddWaypoint: document.getElementById('btn-add-waypoint'),

      // Weather UI
      cityChips: document.querySelectorAll('.city-chip'),
      weatherLocation: document.getElementById('weather-location-name'),
      weatherTemp: document.getElementById('weather-temp-hero'),
      weatherDesc: document.getElementById('weather-desc-hero'),
      weatherAdvisory: document.getElementById('weather-advisory-badge'),
      windSpeed: document.getElementById('weather-wind-speed'),
      windDir: document.getElementById('weather-wind-dir'),
      waveHeight: document.getElementById('weather-wave-height'),
      wavePeriod: document.getElementById('weather-wave-period'),
      visibility: document.getElementById('weather-visibility'),
      pressure: document.getElementById('weather-pressure'),
      quickWeatherTemp: document.getElementById('quick-weather-temp'),
      quickWeatherWind: document.getElementById('quick-weather-wind'),

      // Safety UI
      btnFogHorn: document.getElementById('btn-fog-horn'),
      btnWhistle: document.getElementById('btn-whistle'),
      btnFiveBlasts: document.getElementById('btn-five-blasts'),
      btnSOS: document.getElementById('btn-sos'),
      btnSetAnchor: document.getElementById('btn-set-anchor'),
      btnClearAnchor: document.getElementById('btn-clear-anchor'),
      anchorStatus: document.getElementById('anchor-status-text'),

      // Waypoint Dialog
      wpDialog: document.getElementById('waypoint-dialog'),
      wpForm: document.getElementById('waypoint-form'),
      wpNameInput: document.getElementById('waypoint-name-input'),
      wpCancelBtn: document.getElementById('btn-cancel-waypoint'),
      waypointsContainer: document.getElementById('waypoints-list-container')
    };
  }

  bindEvents() {
    // Tab switching
    this.dom.tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        this.switchTab(targetTab);
      });
    });

    // Night vision toggle
    this.dom.btnNightVision?.addEventListener('click', () => {
      this.toggleNightVision();
    });

    // Screen Wake Lock toggle
    this.dom.btnWakeLock?.addEventListener('click', () => {
      this.toggleWakeLock();
    });

    // Fullscreen toggle
    this.dom.btnFullscreen?.addEventListener('click', () => {
      this.toggleFullscreen();
    });

    // Compass permission (iOS Safari)
    this.dom.btnCompassPerm?.addEventListener('click', async () => {
      const ok = await this.compass.requestPermissionAndStart();
      if (ok) {
        this.dom.btnCompassPerm.style.display = 'none';
        this.showToast('Compass sensor enabled');
      }
    });

    // Trip controls
    this.dom.btnStartTrip?.addEventListener('click', () => {
      if (!this.geo.isRecording) {
        this.geo.startTrip();
        this.dom.btnStartTrip.textContent = 'Stop Trip';
        this.dom.btnStartTrip.classList.remove('btn-primary');
        this.dom.btnStartTrip.classList.add('btn-danger');
        this.showToast('Trip recording started');
      } else {
        const trip = this.geo.stopTrip();
        this.dom.btnStartTrip.textContent = 'Start Trip';
        this.dom.btnStartTrip.classList.remove('btn-danger');
        this.dom.btnStartTrip.classList.add('btn-primary');
        this.showToast(`Trip finished: ${trip.distanceNM.toFixed(2)} NM`);
      }
    });

    this.dom.btnExportGpx?.addEventListener('click', () => {
      const points = this.geo.trackPoints;
      if (points.length === 0) {
        this.showToast('No track points to export yet');
        return;
      }
      Storage.exportGPX(points);
      this.showToast('GPX track file exported');
    });

    // Simulation toggle
    this.dom.btnSimulate?.addEventListener('click', () => {
      if (!this.geo.isSimulated) {
        this.geo.startSimulation();
        this.dom.btnSimulate.classList.add('active');
        this.showToast('Demo marine simulation active');
      } else {
        this.geo.stopSimulation();
        this.dom.btnSimulate.classList.remove('active');
        this.showToast('Simulation stopped');
      }
    });

    // Chart controls
    this.dom.btnChartCenter?.addEventListener('click', () => {
      if (this.chart) this.chart.centerOnVessel();
    });
    this.dom.btnZoomIn?.addEventListener('click', () => {
      if (this.chart) this.chart.zoomIn();
    });
    this.dom.btnZoomOut?.addEventListener('click', () => {
      if (this.chart) this.chart.zoomOut();
    });

    // Waypoint modal
    this.dom.btnAddWaypoint?.addEventListener('click', () => {
      if (this.dom.wpDialog) {
        this.dom.wpNameInput.value = '';
        this.dom.wpDialog.showModal();
      }
    });
    this.dom.wpCancelBtn?.addEventListener('click', () => {
      this.dom.wpDialog.close();
    });
    this.dom.wpForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = this.dom.wpNameInput.value;
      const pos = this.geo.currentPosition || { lat: 32.7150, lon: -117.1625 };
      Storage.saveWaypoint(name, pos.lat, pos.lon);
      this.chart.setWaypoints(Storage.getWaypoints(), this.activeWaypointId);
      this.renderWaypointsList();
      this.dom.wpDialog.close();
      this.showToast(`Waypoint "${name || 'Mark'}" dropped`);
    });

    // Weather City selection
    this.dom.cityChips.forEach(chip => {
      chip.addEventListener('click', () => {
        this.dom.cityChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const cityKey = chip.getAttribute('data-city');
        this.loadWeatherForCity(cityKey);
      });
    });

    // Safety Sound Signals
    this.dom.btnFogHorn?.addEventListener('click', () => {
      this.safety.playFogHorn();
      this.showToast('Fog Horn Signal Sounded (Rule 35)');
    });
    this.dom.btnWhistle?.addEventListener('click', () => {
      this.safety.playWhistleTone();
      this.showToast('Whistle Blast Sounded');
    });
    this.dom.btnFiveBlasts?.addEventListener('click', () => {
      this.safety.playFiveShortBlasts();
      this.showToast('5 Short Blasts Sounded (Rule 34: Danger/Doubt)');
    });
    this.dom.btnSOS?.addEventListener('click', () => {
      this.safety.playSOS();
      this.showToast('Morse Code SOS Signal Sounded');
    });

    // Anchor Watch
    this.dom.btnSetAnchor?.addEventListener('click', () => {
      const pos = this.geo.currentPosition;
      if (!pos) {
        this.showToast('GPS fix required to set anchor');
        return;
      }
      this.safety.setAnchor(pos.lat, pos.lon, 30);
      this.dom.anchorStatus.textContent = 'Anchor Watch Active (30m Radius)';
      this.dom.btnSetAnchor.style.display = 'none';
      this.dom.btnClearAnchor.style.display = 'inline-flex';
      this.showToast('Anchor dropped — drift watch enabled');
    });

    this.dom.btnClearAnchor?.addEventListener('click', () => {
      this.safety.clearAnchor();
      this.dom.anchorStatus.textContent = 'Anchor Watch Inactive';
      this.dom.btnSetAnchor.style.display = 'inline-flex';
      this.dom.btnClearAnchor.style.display = 'none';
      this.showToast('Anchor retrieved');
    });
  }

  applySettings() {
    if (this.settings.nightVision) {
      document.documentElement.setAttribute('data-theme', 'night-vision');
      this.dom.btnNightVision?.classList.add('active');
    }

    if (this.settings.wakeLockEnabled) {
      this.toggleWakeLock(true);
    }
  }

  toggleNightVision() {
    const isNight = document.documentElement.getAttribute('data-theme') === 'night-vision';
    if (isNight) {
      document.documentElement.removeAttribute('data-theme');
      this.dom.btnNightVision?.classList.remove('active');
      this.settings.nightVision = false;
    } else {
      document.documentElement.setAttribute('data-theme', 'night-vision');
      this.dom.btnNightVision?.classList.add('active');
      this.settings.nightVision = true;
    }
    Storage.saveSettings(this.settings);
  }

  async toggleWakeLock(forceEnable) {
    if (forceEnable === true || !this.safety.isWakeLockActive) {
      const ok = await this.safety.enableWakeLock();
      if (ok) {
        this.dom.btnWakeLock?.classList.add('active');
        this.showToast('Screen Wake Lock active (Screen will stay on)');
      }
    } else {
      await this.safety.disableWakeLock();
      this.dom.btnWakeLock?.classList.remove('active');
      this.showToast('Wake Lock released');
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      this.dom.btnFullscreen?.classList.add('active');
    } else {
      document.exitFullscreen().catch(() => {});
      this.dom.btnFullscreen?.classList.remove('active');
    }
  }

  switchTab(tabName) {
    this.dom.tabBtns.forEach(btn => {
      if (btn.getAttribute('data-tab') === tabName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    this.dom.tabPanels.forEach(panel => {
      if (panel.id === `tab-${tabName}`) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    if (tabName === 'chart' && this.chart) {
      // Force chart canvas re-render upon tab display
      setTimeout(() => this.chart.resize(), 50);
    }
  }

  // --- Telemetry Handlers ---

  onTelemetryUpdate(t) {
    // Header GPS badge
    if (this.dom.gpsDot) {
      this.dom.gpsDot.className = 'status-dot active';
      this.dom.gpsText.textContent = t.isSimulated ? 'GPS (Demo)' : 'GPS Active';
    }

    // Speed in Knots
    if (this.dom.speedVal) {
      this.dom.speedVal.textContent = t.speedKnots.toFixed(1);
    }

    // Coordinates (Nautical DDM)
    const coords = GeoTracker.formatNauticalCoords(t.lat, t.lon);
    if (this.dom.latVal) this.dom.latVal.textContent = coords.latStr;
    if (this.dom.lonVal) this.dom.lonVal.textContent = coords.lonStr;
    if (this.dom.accVal) this.dom.accVal.textContent = `±${Math.round(t.accuracy)}m`;

    // Heading fallback from GPS if device compass isn't active
    if (!this.compass.isActive && t.heading !== null) {
      this.onCompassHeadingUpdate(t.heading);
    }

    // Trip computer metrics
    if (this.dom.tripDistVal) {
      this.dom.tripDistVal.textContent = `${t.distanceNM.toFixed(2)} NM`;
    }
    if (this.dom.maxSpeedVal) {
      this.dom.maxSpeedVal.textContent = `${t.maxSpeedKnots.toFixed(1)} kts`;
    }
    if (this.dom.tripTimeVal && t.isRecording) {
      const mins = Math.floor(t.elapsedSeconds / 60);
      const secs = Math.floor(t.elapsedSeconds % 60);
      this.dom.tripTimeVal.textContent = `${mins}m ${secs}s`;
    }

    // Chart update
    if (this.chart) {
      this.chart.updateVessel(t.lat, t.lon, this.compass.currentHeading || t.heading, t.speedKnots);
      if (t.isRecording) {
        this.chart.setTrackPoints(this.geo.trackPoints);
      }
    }

    // Chart overlay
    if (this.dom.chartCoords) {
      this.dom.chartCoords.textContent = `${t.lat.toFixed(4)}°, ${t.lon.toFixed(4)}°`;
    }
    if (this.dom.chartSpeed) {
      this.dom.chartSpeed.textContent = `${t.speedKnots.toFixed(1)} kts | ${Math.round(this.compass.currentHeading)}°`;
    }

    // Anchor Drift Watch check
    if (this.safety.isAnchorWatchActive) {
      const check = this.safety.checkAnchorDrift(t.lat, t.lon, GeoTracker.haversineDistance);
      if (check) {
        this.dom.anchorStatus.textContent = check.isAlarm
          ? `⚠️ DRIFT ALARM: ${check.driftMeters}m (Limit: ${check.radiusMeters}m)`
          : `Anchor OK: ${check.driftMeters}m from anchor`;
      }
    }
  }

  onGeoError(err) {
    if (this.dom.gpsDot) {
      this.dom.gpsDot.className = 'status-dot warning';
      this.dom.gpsText.textContent = 'GPS Searching';
    }
  }

  onCompassHeadingUpdate(heading) {
    const roundHeading = Math.round(heading);
    if (this.dom.headingVal) {
      this.dom.headingVal.textContent = String(roundHeading).padStart(3, '0');
    }
    if (this.dom.headingCardinal) {
      this.dom.headingCardinal.textContent = CompassManager.getCardinal(roundHeading);
    }
    if (this.dom.compassDial) {
      this.dom.compassDial.style.transform = `rotate(${-roundHeading}deg)`;
    }
    if (this.chart && this.geo.currentPosition) {
      this.chart.vesselHeading = roundHeading;
      this.chart.render();
    }
  }

  onAttitudeUpdate(att) {
    if (this.dom.pitchVal) {
      this.dom.pitchVal.textContent = `${att.pitch}°`;
    }
    if (this.dom.rollVal) {
      this.dom.rollVal.textContent = `${Math.abs(att.roll)}° ${att.roll >= 0 ? 'Starboard' : 'Port'}`;
    }
    if (this.dom.rollIndicator) {
      const clampRoll = Math.max(-40, Math.min(40, att.roll));
      this.dom.rollIndicator.style.transform = `translateX(${clampRoll}px)`;
    }
  }

  // --- Weather ---

  async loadWeatherForCity(cityKey) {
    let lat = 32.7150;
    let lon = -117.1625;
    let name = 'San Diego Bay';

    if (cityKey === 'current location') {
      const pos = this.geo.currentPosition || Storage.getLastPosition();
      lat = pos.lat;
      lon = pos.lon;
      name = 'Current Location';
    } else if (WeatherManager.PRESETS[cityKey]) {
      const p = WeatherManager.PRESETS[cityKey];
      lat = p.lat;
      lon = p.lon;
      name = p.name;
    }

    if (this.dom.weatherLocation) {
      this.dom.weatherLocation.textContent = `${name} (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`;
    }

    const data = await this.weather.fetchMarineWeather(lat, lon, name);
    this.renderWeather(data);
  }

  renderWeather(w) {
    if (!w) return;

    if (this.dom.weatherTemp) this.dom.weatherTemp.textContent = `${w.tempF}°F`;
    if (this.dom.weatherDesc) this.dom.weatherDesc.textContent = w.conditionText;
    if (this.dom.windSpeed) this.dom.windSpeed.textContent = `${w.windSpeedKnots} kts (Gusts ${w.windGustsKnots})`;
    if (this.dom.windDir) this.dom.windDir.textContent = `${w.windDirectionCardinal} (${w.windDirection}°)`;
    if (this.dom.waveHeight) this.dom.waveHeight.textContent = `${w.waveHeightFt} ft`;
    if (this.dom.wavePeriod) this.dom.wavePeriod.textContent = `${w.wavePeriodSec}s`;
    if (this.dom.visibility) this.dom.visibility.textContent = `${w.visibilityNM} NM`;
    if (this.dom.pressure) this.dom.pressure.textContent = `${w.pressureInHg} inHg (${w.pressureHpa} hPa)`;

    // Helm Quick Weather
    if (this.dom.quickWeatherTemp) this.dom.quickWeatherTemp.textContent = `${w.tempF}°F, ${w.conditionText}`;
    if (this.dom.quickWeatherWind) this.dom.quickWeatherWind.textContent = `Wind: ${w.windSpeedKnots} kts ${w.windDirectionCardinal} | Seas: ${w.waveHeightFt} ft`;

    // Advisory Badge
    if (this.dom.weatherAdvisory) {
      this.dom.weatherAdvisory.className = `marine-advisory-badge ${w.advisory.level}`;
      this.dom.weatherAdvisory.textContent = w.advisory.text;
    }
  }

  // --- Waypoints ---

  renderWaypointsList() {
    const list = Storage.getWaypoints();
    if (!this.dom.waypointsContainer) return;

    this.dom.waypointsContainer.innerHTML = '';
    const pos = this.geo.currentPosition || { lat: 32.7150, lon: -117.1625 };

    list.forEach(wp => {
      const distM = GeoTracker.haversineDistance(pos.lat, pos.lon, wp.lat, wp.lon);
      const distNM = (distM * 0.000539957).toFixed(2);
      const brg = Math.round(GeoTracker.bearing(pos.lat, pos.lon, wp.lat, wp.lon));

      const div = document.createElement('div');
      div.className = 'waypoint-item';
      div.innerHTML = `
        <div>
          <div class="wp-name">${wp.name}</div>
          <div class="sub-label">${wp.lat.toFixed(4)}°, ${wp.lon.toFixed(4)}°</div>
        </div>
        <div style="text-align: right;">
          <div class="wp-dist">${distNM} NM</div>
          <div class="sub-label">BRG ${String(brg).padStart(3, '0')}°</div>
        </div>
      `;

      div.addEventListener('click', () => {
        this.activeWaypointId = wp.id;
        this.chart.setWaypoints(Storage.getWaypoints(), wp.id);
        this.showToast(`Navigating to ${wp.name}`);
      });

      this.dom.waypointsContainer.appendChild(div);
    });
  }

  showToast(msg) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('./sw.js');
        console.log('Seahelm Service Worker registered successfully');
      } catch (e) {
        console.warn('Service Worker registration failed:', e);
      }
    }
  }
}

// Bootstrap when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new SeahelmApp();
  window.app.init();
});

