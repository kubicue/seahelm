/**
 * Seahelm Storage Module
 * Manages local persistence for waypoints, tracks, and boater preferences
 * using primitive Web Storage API (localStorage)
 */
export const Storage = {
  KEYS: {
    SETTINGS: 'seahelm_settings_v2',
    WAYPOINTS: 'seahelm_waypoints_v2',
    TRIP_LOGS: 'seahelm_trips_v2',
    LAST_POS: 'seahelm_last_pos_v2'
  },

  getDefaultSettings() {
    return {
      speedUnit: 'knots',    // 'knots', 'mph', 'kmh'
      distUnit: 'nm',        // 'nm', 'mi', 'km'
      tempUnit: 'f',         // 'f', 'c'
      pressureUnit: 'inhg',  // 'inhg', 'hpa'
      nightVision: false,
      wakeLockEnabled: true,
      anchorWatchRadius: 30, // meters
      vesselProfile: {
        name: 'Seahelm Kayak 1',
        craftType: 'Sea Kayak',
        hullColor: 'Bright Yellow Deck, White Hull',
        pob: 1,
        pfd: 'Wearing Type III PFD Life Jackets'
      }
    };
  },

  getSettings() {
    try {
      const data = localStorage.getItem(this.KEYS.SETTINGS);
      return data ? { ...this.getDefaultSettings(), ...JSON.parse(data) } : this.getDefaultSettings();
    } catch {
      return this.getDefaultSettings();
    }
  },

  saveSettings(settings) {
    try {
      localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.warn('Storage saveSettings failed', e);
    }
  },

  getWaypoints() {
    try {
      const data = localStorage.getItem(this.KEYS.WAYPOINTS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Storage getWaypoints failed', e);
    }
    // Default nautical starter waypoints (e.g. San Diego Bay harbor entrance & Coronado)
    return [
      { id: 'wp_sd_bay', name: 'San Diego Harbor Channel', lat: 32.6710, lon: -117.1850, created: Date.now() },
      { id: 'wp_sd_anch', name: 'Glorietta Bay Anchorage', lat: 32.6798, lon: -117.1691, created: Date.now() }
    ];
  },

  saveWaypoint(name, lat, lon) {
    const list = this.getWaypoints();
    const wp = {
      id: 'wp_' + Date.now(),
      name: name.trim() || 'Waypoint ' + (list.length + 1),
      lat: Number(lat),
      lon: Number(lon),
      created: Date.now()
    };
    list.push(wp);
    try {
      localStorage.setItem(this.KEYS.WAYPOINTS, JSON.stringify(list));
    } catch (e) {
      console.warn('Storage saveWaypoint failed', e);
    }
    return wp;
  },

  deleteWaypoint(id) {
    const list = this.getWaypoints().filter(w => w.id !== id);
    try {
      localStorage.setItem(this.KEYS.WAYPOINTS, JSON.stringify(list));
    } catch (e) {
      console.warn('Storage deleteWaypoint failed', e);
    }
    return list;
  },

  saveLastPosition(lat, lon) {
    try {
      localStorage.setItem(this.KEYS.LAST_POS, JSON.stringify({ lat, lon, time: Date.now() }));
    } catch {}
  },

  getLastPosition() {
    try {
      const d = localStorage.getItem(this.KEYS.LAST_POS);
      return d ? JSON.parse(d) : { lat: 32.7150, lon: -117.1625 }; // Default San Diego from 2015 repo
    } catch {
      return { lat: 32.7150, lon: -117.1625 };
    }
  },

  /**
   * Export recorded track points as standard GPX 1.1 file
   */
  exportGPX(trackPoints, tripName = 'Seahelm Marine Track') {
    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Seahelm Marine Navigator" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${tripName}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>${tripName}</name>
    <trkseg>
`;

    trackPoints.forEach(pt => {
      gpx += `      <trkpt lat="${pt.lat.toFixed(6)}" lon="${pt.lon.toFixed(6)}">
        <time>${new Date(pt.timestamp).toISOString()}</time>
        ${pt.speed !== null ? `<speed>${(pt.speed * 0.514444).toFixed(2)}</speed>` : ''}
      </trkpt>\n`;
    });

    gpx += `    </trkseg>
  </trk>
</gpx>`;

    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seahelm-track-${new Date().toISOString().slice(0, 10)}.gpx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};

