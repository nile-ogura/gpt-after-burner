// Authored procedural turbine, wind, cannon and impact sounds. No remote assets.
export class FlightAudio {
  constructor() { this.enabled = true; this.ctx = null; this.nextWarning = 0; }
  async start() {
    if (!this.enabled) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain(); this.master.gain.value = .22;
      const limiter = this.ctx.createDynamicsCompressor(); limiter.threshold.value = -15; limiter.knee.value = 18; limiter.ratio.value = 5; limiter.attack.value = .004; limiter.release.value = .18;
      this.master.connect(limiter); limiter.connect(this.ctx.destination);
      const count = this.ctx.sampleRate * 2;
      this.white = this.ctx.createBuffer(1, count, this.ctx.sampleRate);
      const wind = this.white.getChannelData(0), brown = this.ctx.createBuffer(1, count, this.ctx.sampleRate), data = brown.getChannelData(0);
      let value = 0;
      for (let i = 0; i < count; i++) { wind[i] = Math.random() * 2 - 1; value = (value + wind[i] * .032) / 1.032; data[i] = value * 3.2; }
      this.engine = this.ctx.createBufferSource(); this.engine.buffer = brown; this.engine.loop = true;
      this.engineFilter = this.ctx.createBiquadFilter(); this.engineFilter.type = 'lowpass'; this.engineFilter.frequency.value = 350;
      this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = .2;
      this.engine.connect(this.engineFilter); this.engineFilter.connect(this.engineGain); this.engineGain.connect(this.master); this.engine.start();
      this.wind = this.ctx.createBufferSource(); this.wind.buffer = this.white; this.wind.loop = true;
      this.windFilter = this.ctx.createBiquadFilter(); this.windFilter.type = 'bandpass'; this.windFilter.frequency.value = 950; this.windFilter.Q.value = .5;
      this.windGain = this.ctx.createGain(); this.windGain.gain.value = .03;
      this.wind.connect(this.windFilter); this.windFilter.connect(this.windGain); this.windGain.connect(this.master); this.wind.start();
      this.turbine = this.ctx.createOscillator(); this.turbine.type = 'sine'; this.turbine.frequency.value = 90;
      this.turbineGain = this.ctx.createGain(); this.turbineGain.gain.value = .045;
      this.turbine.connect(this.turbineGain); this.turbineGain.connect(this.master); this.turbine.start();
    }
    await this.ctx.resume();
  }
  setEnabled(value) {
    this.enabled = value;
    if (this.master) this.master.gain.setTargetAtTime(value ? .22 : 0, this.ctx.currentTime, .08);
    if (value) this.start();
  }
  update(throttle, playing, { threat = 0, bank = 0, speed = 1180 } = {}) {
    if (!this.ctx) return;
    const time = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(playing ? .20 + throttle * .43 : .028, time, .12);
    this.engineFilter.frequency.setTargetAtTime(160 + throttle * 1100, time, .16);
    this.engine.playbackRate.setTargetAtTime(.85 + throttle * .26, time, .2);
    this.windGain.gain.setTargetAtTime(playing ? .025 + (speed / 1600) ** 2 * .055 + Math.abs(bank) * .03 : .004, time, .2);
    this.turbine.frequency.setTargetAtTime(66 + throttle * 108, time, .18);
    this.turbineGain.gain.setTargetAtTime(playing ? .030 + throttle * .035 : .005, time, .1);
    if (playing && threat > 0 && this.enabled && time >= this.nextWarning) {
      this.tone(760, .065, 'sine', .1); this.tone(620, .09, 'sine', .07, null, .09);
      this.nextWarning = time + .7;
    }
  }
  tone(frequency, duration = .1, type = 'sine', volume = .2, end = null, delay = 0) {
    if (!this.ctx || !this.enabled) return;
    const oscillator = this.ctx.createOscillator(), gain = this.ctx.createGain(), time = this.ctx.currentTime + delay;
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, time);
    if (end) oscillator.frequency.exponentialRampToValueAtTime(end, time + duration);
    gain.gain.setValueAtTime(.001, time); gain.gain.linearRampToValueAtTime(volume, time + .004); gain.gain.exponentialRampToValueAtTime(.001, time + duration);
    oscillator.connect(gain); gain.connect(this.master); oscillator.start(time); oscillator.stop(time + duration);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  noiseBurst(duration, frequency, volume, pan = 0, end = frequency) {
    if (!this.ctx || !this.enabled) return;
    const source = this.ctx.createBufferSource(), filter = this.ctx.createBiquadFilter(), gain = this.ctx.createGain(), panner = this.ctx.createStereoPanner(), time = this.ctx.currentTime;
    source.buffer = this.white; filter.type = 'lowpass'; filter.frequency.setValueAtTime(frequency, time); filter.frequency.exponentialRampToValueAtTime(end, time + duration);
    panner.pan.value = Math.max(-.8, Math.min(.8, pan)); gain.gain.setValueAtTime(.001, time); gain.gain.linearRampToValueAtTime(volume, time + .006); gain.gain.exponentialRampToValueAtTime(.001, time + duration);
    source.connect(filter); filter.connect(gain); gain.connect(panner); panner.connect(this.master); source.start(time, Math.random() * .5); source.stop(time + duration);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); panner.disconnect(); };
  }
  event(type, event = {}) {
    const distance = Math.hypot(event.x || 0, event.z || 0), attenuation = 1 / (1 + distance / 900), pan = (event.x || 0) / 260;
    if (type === 'shot' && event.weapon === 'gun') {
      this.noiseBurst(.08, 2800, .27, -.1, 650); this.tone(92, .065, 'triangle', .07, 48);
    } else if (type === 'shot') {
      this.noiseBurst(.30, 3200, .28 * attenuation, pan, 400); this.tone(118, .18, 'sine', .065 * attenuation, 48);
    }
    if (type === 'explosion') {
      this.noiseBurst(.8, 1800, .85 * attenuation, pan, 130); this.tone(58, .7, 'sine', .22 * attenuation, 24);
    }
    if (type === 'lock' && event.locked) { this.tone(1080, .085, 'sine', .10); this.tone(1440, .12, 'sine', .08, null, .09); }
    if (type === 'damage') this.noiseBurst(.24, 3400, .45, pan, 500);
    if (type === 'flare') this.noiseBurst(.18, 5700, .18, pan, 1600);
  }
}
