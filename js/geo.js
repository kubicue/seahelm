/**
 * Seahelm Geolocation Module
 * Real-time GPS navigation with high-accuracy Geolocation API,
 * nautical distance, speed, bearing, and trip calculations.
 */
export class GeoTracker {
  constructor(options = {}) {
    this.onUpdate = options.onUpdate || (() => {});
    this.onError = options.onError || (() => {});
    this.watchId = null;
    this.currentPosition = null;
    
    // Trip metrics
    this.isRecording = false;
    this.tripStartTime = null;
    this.trackPoints = [];
    this.totalDistanceMeters = 0;
    this.maxSpeedKnots = 0;
    
    // Fallback simulation mode
    this.isSimulated = false;
    this.simInterval = null;
  }

  start() {
    if (!('geolocation' in navigator)) {
      this.onError(new Error('Geolocation is not supported by your browser.'));
      this.startSimulation();
      return;
    }

    const geoOptions = {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 10000
    };

    // First attempt quick position
    navigator.geolocation.getCurrentPosition(
      pos => this.handlePosition(pos),
      err => {
        console.warn('Initial geolocation error:', err.message);
        this.onError(err);
      },
      geoOptions
    );

    // Continuous watch
    this.watchId = navigator.geolocation.watchPosition(
      pos => this.handlePosition(pos),
      err => this.handleError(err),
      geoOptions
    );
  }

  stop() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.simInterval) {
      clearInterval(this.simInterval);
      this.simInterval = null;
    }
  }

  handlePosition(pos) {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const rawSpeed = pos.coords.speed; // m/s
    const speedKnots = rawSpeed !== null && rawSpeed >= 0 ? rawSpeed * 1.94384 : 0;
    const heading = pos.coords.heading; // degrees 0-360
    const accuracy = pos.coords.accuracy || 10;
    const altitude = pos.coords.altitude || 0;
    const timestamp = pos.timestamp || Date.now();

    const newPos = {
      lat,
      lon,
      speedKnots,
      heading: heading !== null && !isNaN(heading) ? heading : null,
      accuracy,
      altitude,
      timestamp
    };

    if (this.isRecording) {
      if (this.currentPosition) {
        const deltaM = GeoTracker.haversineDistance(
          this.currentPosition.lat,
          this.currentPosition.lon,
          lat,
          lon
        );
        // Filter out GPS drift noise if speed is essentially zero
        if (deltaM > 1.5 && deltaM < 500) {
          this.totalDistanceMeters += deltaM;
        }
      }
      if (speedKnots > this.maxSpeedKnots) {
        this.maxSpeedKnots = speedKnots;
      }
      this.trackPoints.push({ lat, lon, speed: speedKnots, timestamp });
    }

    this.currentPosition = newPos;
    this.onUpdate(this.getTelemetry());
  }

  handleError(err) {
    console.warn('Geolocation watch error:', err.code, err.message);
    this.onError(err);
  }

  startTrip() {
    this.isRecording = true;
    this.tripStartTime = Date.now();
    this.trackPoints = [];
    this.totalDistanceMeters = 0;
    this.maxSpeedKnots = 0;
    if (this.currentPosition) {
      this.trackPoints.push({
        lat: this.currentPosition.lat,
        lon: this.currentPosition.lon,
        speed: this.currentPosition.speedKnots,
        timestamp: Date.now()
      });
    }
  }

  stopTrip() {
    this.isRecording = false;
    return {
      points: [...this.trackPoints],
      distanceNM: this.totalDistanceMeters * 0.000539957,
      maxSpeedKnots: this.maxSpeedKnots,
      elapsedMs: this.tripStartTime ? Date.now() - this.tripStartTime : 0
    };
  }

  getTelemetry() {
    const pos = this.currentPosition || {
      lat: 32.7150,
      lon: -117.1625,
      speedKnots: 0,
      heading: 0,
      accuracy: 0,
      altitude: 0,
      timestamp: Date.now()
    };

    const elapsedSeconds = this.tripStartTime && this.isRecording ? (Date.now() - this.tripStartTime) / 1000 : 0;
    const distanceNM = this.totalDistanceMeters * 0.000539957;
    const avgSpeedKnots = elapsedSeconds > 0 ? (distanceNM / (elapsedSeconds / 3600)) : 0;

    return {
      ...pos,
      isRecording: this.isRecording,
      distanceNM,
      maxSpeedKnots: this.maxSpeedKnots,
      avgSpeedKnots,
      elapsedSeconds,
      trackCount: this.trackPoints.length,
      isSimulated: this.isSimulated
    };
  }

  /**
   * Marine Simulation Mode (allows testing navigation & chart plotting when offline/indoors)
   */
  startSimulation(baseLat = 32.7150, baseLon = -117.1625) {
    this.isSimulated = true;
    let simLat = baseLat;
    let simLon = baseLon;
    let simHeading = 210; // heading SW out of San Diego Bay
    let simSpeed = 4.2;   // knots (kayak/dinghy cruising speed)

    if (this.simInterval) clearInterval(this.simInterval);

    this.simInterval = setInterval(() => {
      // Simulate gentle course and speed variance on water
      simHeading = (simHeading + (Math.random() - 0.5) * 4 + 360) % 360;
      simSpeed = Math.max(1.5, Math.min(6.5, simSpeed + (Math.random() - 0.5) * 0.4));
      
      const speedMs = simSpeed / 1.94384;
      const distM = speedMs * 1.5; // per 1.5s interval
      
      const newCoord = GeoTracker.destinationPoint(simLat, simLon, distM, simHeading);
      simLat = newCoord.lat;
      simLon = newCoord.lon;

      this.handlePosition({
        coords: {
          latitude: simLat,
          longitude: simLon,
          speed: speedMs,
          heading: simHeading,
          accuracy: 4,
          altitude: 0
        },
        timestamp: Date.now()
      });
    }, 1500);
  }

  stopSimulation() {
    if (this.simInterval) {
      clearInterval(this.simInterval);
      this.simInterval = null;
    }
    this.isSimulated = false;
  }

  // --- Nautical Geographic Math ---

  static toRad(deg) {
    return (deg * Math.PI) / 180;
  }

  static toDeg(rad) {
    return (rad * 180) / Math.PI;
  }

  /**
   * Great-circle distance between two coordinates in meters
   */
  static haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth radius in meters
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Initial bearing (forward azimuth) from pt1 to pt2 in degrees (0-360)
   */
  static bearing(lat1, lon1, lat2, lon2) {
    const phi1 = this.toRad(lat1);
    const phi2 = this.toRad(lat2);
    const deltaLambda = this.toRad(lon2 - lon1);

    const y = Math.sin(deltaLambda) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) -
              Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
    const theta = Math.atan2(y, x);
    return (this.toDeg(theta) + 360) % 360;
  }

  /**
   * Destination point given distance (meters) and bearing (deg)
   */
  static destinationPoint(lat, lon, distanceM, bearingDeg) {
    const R = 6371000;
    const delta = distanceM / R;
    const theta = this.toRad(bearingDeg);
    const phi1 = this.toRad(lat);
    const lambda1 = this.toRad(lon);

    const phi2 = Math.asin(Math.sin(phi1) * Math.cos(delta) +
                           Math.cos(phi1) * Math.sin(delta) * Math.cos(theta));
    const lambda2 = lambda1 + Math.atan2(Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
                                         Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2));

    return {
      lat: this.toDeg(phi2),
      lon: ((this.toDeg(lambda2) + 540) % 360) - 180
    };
  }

  /**
   * Format GPS coordinates into nautical Degrees, Decimal Minutes (DDM: 32° 42.900' N)
   */
  static formatNauticalCoords(lat, lon) {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'W';
    
    const absLat = Math.abs(lat);
    const latDeg = Math.floor(absLat);
    const latMin = ((absLat - latDeg) * 60).toFixed(3);
    
    const absLon = Math.abs(lon);
    const lonDeg = Math.floor(absLon);
    const lonMin = ((absLon - lonDeg) * 60).toFixed(3);

    return {
      latStr: `${latDeg}° ${latMin}' ${latDir}`,
      lonStr: `${lonDeg}° ${lonMin}' ${lonDir}`
    };
  }
}

