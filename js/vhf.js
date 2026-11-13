/**
 * Seahelm VHF Marine Radio Module
 * Integrates live marine radio feeds (NOAA Marine Weather & Harbors),
 * marine channel frequency reference (Ch 16, 9, 13, 22A, WX),
 * and Web Audio VHF squelch / radio filter simulation.
 */
export class VhfRadioManager {
  static CHANNELS = [
    {
      id: '16',
      name: 'Channel 16 — International Distress & Calling',
      freq: '156.800 MHz',
      type: 'Distress / Calling',
      desc: 'Mandatory distress, safety, and initial calling channel. Switch to working channel immediately after contact.',
      streamUrl: null
    },
    {
      id: '09',
      name: 'Channel 09 — Boater Calling Channel',
      freq: '156.450 MHz',
      type: 'Calling',
      desc: 'Alternate recreational calling channel designated by USCG to keep Ch 16 clear.',
      streamUrl: null
    },
    {
      id: '13',
      name: 'Channel 13 — Bridge-to-Bridge Navigation',
      freq: '156.650 MHz',
      type: 'Navigational Safety',
      desc: 'Inter-ship navigation safety and bridge/lock tenders (strictly 1 Watt low power).',
      streamUrl: null
    },
    {
      id: '22A',
      name: 'Channel 22A — Coast Guard Safety',
      freq: '157.100 MHz',
      type: 'USCG Safety Broadcasts',
      desc: 'Working channel for US Coast Guard safety broadcasts, storm warnings, and SAR operations.',
      streamUrl: null
    },
    {
      id: 'WX1',
      name: 'NOAA Weather Radio 1 (Live Marine)',
      freq: '162.550 MHz',
      type: 'Live Weather Stream',
      desc: 'Continuous live coastal marine forecast, offshore gale warnings, and radar bulletins.',
      // High-availability public NOAA Weather Radio audio stream
      streamUrl: 'https://audioplayer.streamguys.com/noaa/live.mp3'
    },
    {
      id: 'WX2',
      name: 'NOAA Weather Radio 2 (Live Coastal)',
      freq: '162.400 MHz',
      type: 'Live Weather Stream',
      desc: 'Continuous coastal and lake marine weather observations and warnings.',
      streamUrl: 'https://stream.weather.gov/live'
    }
  ];

  constructor(options = {}) {
    this.onStateChange = options.onStateChange || (() => {});
    this.audioElement = new Audio();
    this.audioElement.preload = 'none';
    this.currentChannelId = '16';
    this.isPlaying = false;
    this.isMuted = false;
    this.volume = 0.8;

    this.audioCtx = null;
    this.noiseNode = null;
    this.noiseGain = null;

    this.initAudioEvents();
  }

  initAudioEvents() {
    this.audioElement.addEventListener('playing', () => {
      this.isPlaying = true;
      this.onStateChange({ isPlaying: true, channel: this.getCurrentChannel() });
    });

    this.audioElement.addEventListener('pause', () => {
      this.isPlaying = false;
      this.onStateChange({ isPlaying: false, channel: this.getCurrentChannel() });
    });

    this.audioElement.addEventListener('error', (e) => {
      console.warn('VHF Stream error or stream offline:', e);
      this.isPlaying = false;
      this.onStateChange({ isPlaying: false, channel: this.getCurrentChannel(), error: true });
    });
  }

  getCurrentChannel() {
    return VhfRadioManager.CHANNELS.find(c => c.id === this.currentChannelId) || VhfRadioManager.CHANNELS[0];
  }

  selectChannel(channelId) {
    this.currentChannelId = channelId;
    const channel = this.getCurrentChannel();

    // Play standard VHF channel beep / squelch blip
    this.playSquelchBurst(100);

    if (channel.streamUrl) {
      this.audioElement.src = channel.streamUrl;
      if (this.isPlaying) {
        this.audioElement.play().catch(e => console.warn('Stream play error:', e));
      }
    } else {
      // Offline channel (voice VHF)
      this.audioElement.pause();
      this.audioElement.removeAttribute('src');
    }

    this.onStateChange({ isPlaying: this.isPlaying, channel });
    return channel;
  }

  togglePlay() {
    const channel = this.getCurrentChannel();
    if (!channel.streamUrl) {
      // Simulate RF static squelch if tuning to local VHF voice channel without live relay
      this.toggleSimulatedRadioStatic();
      return;
    }

    if (this.isPlaying) {
      this.audioElement.pause();
      this.isPlaying = false;
    } else {
      this.audioElement.src = channel.streamUrl;
      this.audioElement.volume = this.volume;
      this.audioElement.play().catch(err => {
        console.warn('VHF Audio play failed:', err);
        // Fallback to static simulator
        this.toggleSimulatedRadioStatic();
      });
    }

    this.onStateChange({ isPlaying: this.isPlaying, channel });
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    this.audioElement.volume = this.volume;
    if (this.noiseGain) {
      this.noiseGain.gain.setValueAtTime(this.volume * 0.15, this.audioCtx.currentTime);
    }
  }

  // --- Web Audio VHF Squelch & RF Filter Simulator ---

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  playSquelchBurst(durationMs = 120) {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    // Create White Noise Buffer for VHF squelch tail
    const bufferSize = ctx.sampleRate * (durationMs / 1000);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // Bandpass filter to match VHF FM discriminator curve (~400 Hz to 2800 Hz)
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1400;
    filter.Q.value = 1.2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (durationMs / 1000));

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start();
  }

  toggleSimulatedRadioStatic() {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    if (this.noiseNode) {
      this.stopSimulatedRadioStatic();
      this.isPlaying = false;
      this.onStateChange({ isPlaying: false, channel: this.getCurrentChannel(), isSimulated: true });
      return;
    }

    // Continuous RF receiver hiss
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    this.noiseNode = ctx.createBufferSource();
    this.noiseNode.buffer = buffer;
    this.noiseNode.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200;
    filter.Q.value = 1.0;

    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.setValueAtTime(this.volume * 0.08, ctx.currentTime);

    this.noiseNode.connect(filter);
    filter.connect(this.noiseGain);
    this.noiseGain.connect(ctx.destination);

    this.noiseNode.start();
    this.isPlaying = true;
    this.onStateChange({ isPlaying: true, channel: this.getCurrentChannel(), isSimulated: true });
  }

  stopSimulatedRadioStatic() {
    if (this.noiseNode) {
      try {
        this.noiseNode.stop();
        this.noiseNode.disconnect();
      } catch {}
      this.noiseNode = null;
    }
  }
}

