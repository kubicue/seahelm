/**
 * Seahelm Compass & Inclinometer Module
 * Utilizes primitive DeviceOrientation & DeviceMotion Web Standard APIs
 * for real-time magnetic heading and hull pitch & heel (roll) angles.
 */
export class CompassManager {
  constructor(options = {}) {
    this.onHeadingUpdate = options.onHeadingUpdate || (() => {});
    this.onAttitudeUpdate = options.onAttitudeUpdate || (() => {});
    
    this.currentHeading = 0;
    this.pitch = 0;
    this.roll = 0;
    this.isActive = false;
    this.isSupported = false;
    this.needsPermission = false;

    // Smoothing filter
    this.headingHistory = [];
    this.maxHistory = 4;

    this.handleOrientation = this.handleOrientation.bind(this);
    this.handleMotion = this.handleMotion.bind(this);
  }

  async init() {
    if (typeof DeviceOrientationEvent !== 'undefined') {
      this.isSupported = true;
      // iOS 13+ requires explicit permission request
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        this.needsPermission = true;
      } else {
        this.startListeners();
      }
    } else {
      console.warn('DeviceOrientationEvent not supported on this device/browser.');
    }
  }

  async requestPermissionAndStart() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const response = await DeviceOrientationEvent.requestPermission();
        if (response === 'granted') {
          this.needsPermission = false;
          this.startListeners();
          return true;
        } else {
          console.warn('DeviceOrientation permission denied');
          return false;
        }
      } catch (e) {
        console.error('Error requesting DeviceOrientation permission:', e);
        return false;
      }
    }
    this.startListeners();
    return true;
  }

  startListeners() {
    if (this.isActive) return;
    window.addEventListener('deviceorientation', this.handleOrientation, true);
    window.addEventListener('devicemotion', this.handleMotion, true);
    this.isActive = true;
  }

  stopListeners() {
    if (!this.isActive) return;
    window.removeEventListener('deviceorientation', this.handleOrientation, true);
    window.removeEventListener('devicemotion', this.handleMotion, true);
    this.isActive = false;
  }

  handleOrientation(event) {
    let heading = null;

    // iOS WebKit heading (degrees relative to magnetic north 0-360)
    if (event.webkitCompassHeading !== undefined) {
      heading = event.webkitCompassHeading;
    } else if (event.alpha !== null) {
      // Standard W3C DeviceOrientation: alpha is 0 when pointing toward north (if absolute=true)
      // Otherwise inverted counterclockwise angle
      if (event.absolute) {
        heading = (360 - event.alpha) % 360;
      } else {
        heading = (360 - event.alpha) % 360;
      }
    }

    if (heading !== null && !isNaN(heading)) {
      this.currentHeading = this.smoothHeading(heading);
      this.onHeadingUpdate(this.currentHeading);
    }

    // Beta: front-to-back tilt in degrees (-180 to 180, Pitch)
    // Gamma: left-to-right tilt in degrees (-90 to 90, Roll / Heel)
    if (event.beta !== null && event.gamma !== null) {
      this.pitch = Math.round(event.beta);
      this.roll = Math.round(event.gamma);
      this.onAttitudeUpdate({ pitch: this.pitch, roll: this.roll });
    }
  }

  handleMotion(event) {
    if (!event.accelerationIncludingGravity) return;
    const { x, y, z } = event.accelerationIncludingGravity;
    if (x === null || y === null || z === null) return;
    // Auxiliary pitch and roll calculation if orientation didn't provide beta/gamma
    if (this.pitch === 0 && this.roll === 0) {
      const rollDeg = Math.atan2(x, Math.sqrt(y * y + z * z)) * (180 / Math.PI);
      const pitchDeg = Math.atan2(-y, z) * (180 / Math.PI);
      this.pitch = Math.round(pitchDeg);
      this.roll = Math.round(rollDeg);
      this.onAttitudeUpdate({ pitch: this.pitch, roll: this.roll });
    }
  }

  /**
   * Circular smoothing filter for compass heading avoiding 0°/360° discontinuities
   */
  smoothHeading(newHeading) {
    if (this.headingHistory.length === 0) {
      this.headingHistory.push(newHeading);
      return Math.round(newHeading);
    }

    // Convert headings to vector components
    const rad = (newHeading * Math.PI) / 180;
    this.headingHistory.push({ x: Math.sin(rad), y: Math.cos(rad) });
    if (this.headingHistory.length > this.maxHistory) {
      this.headingHistory.shift();
    }

    let sumX = 0;
    let sumY = 0;
    for (const v of this.headingHistory) {
      if (typeof v === 'number') {
        sumX += Math.sin((v * Math.PI) / 180);
        sumY += Math.cos((v * Math.PI) / 180);
      } else {
        sumX += v.x;
        sumY += v.y;
      }
    }

    const avgRad = Math.atan2(sumX, sumY);
    let avgDeg = (avgRad * 180) / Math.PI;
    if (avgDeg < 0) avgDeg += 360;
    return Math.round(avgDeg);
  }

  static getCardinal(deg) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const idx = Math.round(((deg % 360) / 22.5)) % 16;
    return directions[idx];
  }
}

