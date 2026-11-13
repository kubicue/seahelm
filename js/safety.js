/**
 * Seahelm Marine Safety & Sound Signaling Module
 * Powered by Web Audio API, Screen Wake Lock API, and Vibration API
 * Synthesizes official COLREGS marine distress & fog sound signals.
 */
export class SafetyManager {
  constructor() {
    this.audioCtx = null;
    this.wakeLock = null;
    this.isWakeLockActive = false;
    this.isPlayingSignal = false;

    // Anchor drag watch
    this.isAnchorWatchActive = false;
    this.anchorPosition = null;
    this.anchorRadiusMeters = 30; // Default 30 meters
  }

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  // --- Web Audio Marine Sound Signals ---

  /**
   * Marine Horn Tone generator (deep dual oscillator with low-pass resonance)
   */
  playHornTone(durationMs = 2000, freq = 185) {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, ctx.currentTime);

    // Minor harmonic detune for authentic ship horn roar
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(freq * 1.5, ctx.currentTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, ctx.currentTime);

    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.7, ctx.currentTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (durationMs / 1000));

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(ctx.currentTime);
    osc2.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + (durationMs / 1000));
    osc2.stop(ctx.currentTime + (durationMs / 1000));
  }

  /**
   * Pealess Marine Whistle tone (~2800 Hz shrill blast)
   */
  playWhistleTone(durationMs = 800) {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(2850, ctx.currentTime);

    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (durationMs / 1000));

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + (durationMs / 1000));

    if ('vibrate' in navigator) {
      navigator.vibrate(durationMs);
    }
  }

  /**
   * COLREGS Rule 35: Prolonged Fog Blast (1 prolonged blast of 4-6 seconds)
   */
  playFogHorn() {
    this.playHornTone(4000, 180);
    if ('vibrate' in navigator) {
      navigator.vibrate([1000, 200, 1000, 200, 1000]);
    }
  }

  /**
   * COLREGS Rule 34: 5 Short Blasts (Danger / Doubt Warning Signal)
   */
  async playFiveShortBlasts() {
    if (this.isPlayingSignal) return;
    this.isPlayingSignal = true;

    for (let i = 0; i < 5; i++) {
      this.playHornTone(400, 220);
      if ('vibrate' in navigator) navigator.vibrate(200);
      await new Promise(r => setTimeout(r, 600));
    }

    this.isPlayingSignal = false;
  }

  /**
   * Morse Code SOS Blast (... --- ...)
   */
  async playSOS() {
    if (this.isPlayingSignal) return;
    this.isPlayingSignal = true;

    const dot = 200;
    const dash = 600;
    const gap = 200;

    const pattern = [dot, dot, dot, dash, dash, dash, dot, dot, dot];

    for (let i = 0; i < pattern.length; i++) {
      const dur = pattern[i];
      this.playWhistleTone(dur);
      await new Promise(r => setTimeout(r, dur + gap));
    }

    this.isPlayingSignal = false;
  }

  // --- Screen Wake Lock API ---

  async enableWakeLock() {
    if (!('wakeLock' in navigator)) {
      console.warn('Wake Lock API not supported in this browser.');
      return false;
    }

    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      this.isWakeLockActive = true;
      this.wakeLock.addEventListener('release', () => {
        this.isWakeLockActive = false;
      });

      // Auto re-acquire if user switched tabs and returned
      document.addEventListener('visibilitychange', async () => {
        if (this.wakeLock !== null && document.visibilityState === 'visible') {
          try {
            this.wakeLock = await navigator.wakeLock.request('screen');
            this.isWakeLockActive = true;
          } catch {}
        }
      });
      return true;
    } catch (err) {
      console.warn('Wake Lock request error:', err);
      this.isWakeLockActive = false;
      return false;
    }
  }

  async disableWakeLock() {
    if (this.wakeLock !== null) {
      await this.wakeLock.release();
      this.wakeLock = null;
      this.isWakeLockActive = false;
    }
  }

  // --- Anchor Drag Watch ---

  setAnchor(lat, lon, radiusMeters = 30) {
    this.anchorPosition = { lat, lon };
    this.anchorRadiusMeters = radiusMeters;
    this.isAnchorWatchActive = true;
  }

  clearAnchor() {
    this.anchorPosition = null;
    this.isAnchorWatchActive = false;
  }

  checkAnchorDrift(currentLat, currentLon, haversineFunc) {
    if (!this.isAnchorWatchActive || !this.anchorPosition) return null;

    const driftM = haversineFunc(
      this.anchorPosition.lat,
      this.anchorPosition.lon,
      currentLat,
      currentLon
    );

    const isAlarm = driftM > this.anchorRadiusMeters;

    if (isAlarm) {
      this.playHornTone(1000, 300);
      if ('vibrate' in navigator) navigator.vibrate([500, 200, 500, 200, 500]);
    }

    return {
      driftMeters: Math.round(driftM),
      radiusMeters: this.anchorRadiusMeters,
      isAlarm
    };
  }
}

