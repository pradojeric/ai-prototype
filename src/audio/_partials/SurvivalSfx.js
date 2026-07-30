// ============================================================
// SURVIVAL SFX — procedural cues used only by Endless Memory.
//
// The methods are mixed onto AudioManager.prototype. One-shots stop themselves;
// the Continuous Laser is the sole sustained source and is explicitly owned by
// setSurvivalBeam()/stopSurvivalAudio() so retry and arena teardown cannot stack
// oscillators. Every cue routes through sfxBus to preserve the existing user
// volume, pause, and shared-memory-delay behavior.
// ============================================================

const MIN_GAIN = 0.0001;

function seededNoiseBuffer(manager, duration, decayPower = 1) {
  const { ctx } = manager;
  const frameCount = Math.max(1, Math.ceil(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index++) {
    const decay = Math.pow(1 - index / data.length, decayPower);
    data[index] = (manager._sfxRng() * 2 - 1) * decay;
  }
  return buffer;
}

function stopSource(source, when) {
  try { source.stop(when); } catch (error) { /* source already ended */ }
}

export const SurvivalSfx = {
  // Collision-safe Q dash: a short thread-rip sweep plus a grounded landing
  // pulse. The quick downward motion keeps it distinct from Light Bolt.
  playSurvivalDash() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const at = ctx.currentTime + 0.006;
    const duration = 0.18;
    const pitch = this._pitchVar();

    const noise = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const noiseEnvelope = ctx.createGain();
    noise.buffer = seededNoiseBuffer(this, duration, 1.7);
    filter.type = 'bandpass';
    filter.Q.value = 0.8;
    filter.frequency.setValueAtTime(2800 * pitch, at);
    filter.frequency.exponentialRampToValueAtTime(520 * pitch, at + duration);
    noiseEnvelope.gain.setValueAtTime(MIN_GAIN, at);
    noiseEnvelope.gain.exponentialRampToValueAtTime(0.18, at + 0.012);
    noiseEnvelope.gain.exponentialRampToValueAtTime(MIN_GAIN, at + duration);
    noise.connect(filter).connect(noiseEnvelope).connect(this.sfxBus);
    noise.start(at);
    noise.stop(at + duration);

    const pulse = ctx.createOscillator();
    const pulseEnvelope = ctx.createGain();
    pulse.type = 'sine';
    pulse.frequency.setValueAtTime(280 * pitch, at);
    pulse.frequency.exponentialRampToValueAtTime(72 * pitch, at + 0.2);
    pulseEnvelope.gain.setValueAtTime(MIN_GAIN, at);
    pulseEnvelope.gain.exponentialRampToValueAtTime(0.16, at + 0.01);
    pulseEnvelope.gain.exponentialRampToValueAtTime(MIN_GAIN, at + 0.21);
    pulse.connect(pulseEnvelope).connect(this.sfxBus);
    pulse.start(at);
    pulse.stop(at + 0.22);
  },

  // Thread Lance layers over the shared projectile-cast cue. A low pluck gives
  // the heavier shot weight while the rising overtone reads as piercing thread.
  playSurvivalLance() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const at = ctx.currentTime + 0.006;
    const pitch = this._pitchVar();

    const pluck = ctx.createOscillator();
    const pluckEnvelope = ctx.createGain();
    pluck.type = 'triangle';
    pluck.frequency.setValueAtTime(190 * pitch, at);
    pluck.frequency.exponentialRampToValueAtTime(105 * pitch, at + 0.24);
    pluckEnvelope.gain.setValueAtTime(MIN_GAIN, at);
    pluckEnvelope.gain.exponentialRampToValueAtTime(0.22, at + 0.008);
    pluckEnvelope.gain.exponentialRampToValueAtTime(MIN_GAIN, at + 0.25);
    pluck.connect(pluckEnvelope).connect(this.sfxBus);
    pluck.start(at);
    pluck.stop(at + 0.27);

    const thread = ctx.createOscillator();
    const threadEnvelope = ctx.createGain();
    thread.type = 'sine';
    thread.frequency.setValueAtTime(620 * pitch, at);
    thread.frequency.exponentialRampToValueAtTime(1480 * pitch, at + 0.11);
    threadEnvelope.gain.setValueAtTime(MIN_GAIN, at);
    threadEnvelope.gain.exponentialRampToValueAtTime(0.11, at + 0.012);
    threadEnvelope.gain.exponentialRampToValueAtTime(MIN_GAIN, at + 0.2);
    thread.connect(threadEnvelope).connect(this.sfxBus);
    thread.start(at);
    thread.stop(at + 0.22);
  },

  // Continuous Laser uses one sustained source graph per active firing window.
  // Calling with the existing state is idempotent, preventing per-frame stacks.
  setSurvivalBeam(active) {
    const shouldPlay = !!active;
    if (!shouldPlay) {
      this._stopSurvivalBeam();
      return;
    }
    if (!this.ready || this._survivalBeam) return;

    const ctx = this.ctx;
    const at = ctx.currentTime + 0.005;
    const filter = ctx.createBiquadFilter();
    const envelope = ctx.createGain();
    filter.type = 'bandpass';
    filter.Q.value = 1.7;
    filter.frequency.setValueAtTime(1180, at);
    envelope.gain.setValueAtTime(MIN_GAIN, at);
    envelope.gain.exponentialRampToValueAtTime(0.085, at + 0.035);
    filter.connect(envelope).connect(this.sfxBus);

    const carrier = ctx.createOscillator();
    carrier.type = 'sawtooth';
    carrier.frequency.setValueAtTime(118, at);
    carrier.connect(filter);

    const overtone = ctx.createOscillator();
    const overtoneGain = ctx.createGain();
    overtone.type = 'triangle';
    overtone.frequency.setValueAtTime(354, at);
    overtoneGain.gain.value = 0.32;
    overtone.connect(overtoneGain).connect(filter);

    carrier.start(at);
    overtone.start(at);
    this._survivalBeam = {
      sources: [carrier, overtone],
      envelope,
    };
  },

  _stopSurvivalBeam() {
    const beam = this._survivalBeam;
    if (!beam) return;
    this._survivalBeam = null;
    const now = this.ctx?.currentTime ?? 0;
    const stopAt = now + 0.055;
    const gain = beam.envelope.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(Math.max(MIN_GAIN, gain.value), now);
    gain.exponentialRampToValueAtTime(MIN_GAIN, now + 0.04);
    for (const source of beam.sources) stopSource(source, stopAt);
  },

  // Public teardown hook for Survival flow exit/retry. SurvivalWeapons also
  // calls setSurvivalBeam(false) on cancel/dispose, so either ownership path is
  // sufficient and both remain safely idempotent.
  stopSurvivalAudio() {
    this._stopSurvivalBeam();
  },

  // Elite warnings are short, type-coded dyads. Portal batches can instantiate
  // several elites together, so nearby calls collapse into one readable cue.
  playSurvivalEliteWarning(eliteType = 'armored') {
    if (!this.ready) return;
    const ctx = this.ctx;
    const at = ctx.currentTime + 0.008;
    if (at - (this._survivalEliteLastAt ?? -Infinity) < 0.12) return;
    this._survivalEliteLastAt = at;

    const palette = {
      armored: { root: 196, direction: 0.82, wave: 'triangle' },
      frenzied: { root: 293.66, direction: 1.5, wave: 'square' },
      volatile: { root: 392, direction: 0.62, wave: 'sawtooth' },
    }[eliteType] || { root: 246.94, direction: 0.75, wave: 'triangle' };

    [1, 1.5].forEach((interval, index) => {
      const start = at + index * 0.075;
      const oscillator = ctx.createOscillator();
      const envelope = ctx.createGain();
      oscillator.type = palette.wave;
      oscillator.frequency.setValueAtTime(palette.root * interval, start);
      oscillator.frequency.exponentialRampToValueAtTime(
        palette.root * interval * palette.direction,
        start + 0.3,
      );
      envelope.gain.setValueAtTime(MIN_GAIN, start);
      envelope.gain.exponentialRampToValueAtTime(index === 0 ? 0.12 : 0.075, start + 0.01);
      envelope.gain.exponentialRampToValueAtTime(MIN_GAIN, start + 0.34);
      oscillator.connect(envelope).connect(this.sfxBus);
      oscillator.start(start);
      oscillator.stop(start + 0.36);
    });
  },

  // Upgrade confirm: a compact major-pentatonic weave that stays quieter and
  // shorter than wave-clear/boss cues while still confirming keyboard input.
  playSurvivalUpgrade() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const at = ctx.currentTime + 0.008;
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      const start = at + index * 0.055;
      const oscillator = ctx.createOscillator();
      const envelope = ctx.createGain();
      oscillator.type = index === 2 ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      envelope.gain.setValueAtTime(MIN_GAIN, start);
      envelope.gain.exponentialRampToValueAtTime(0.16 - index * 0.025, start + 0.008);
      envelope.gain.exponentialRampToValueAtTime(MIN_GAIN, start + 0.48);
      oscillator.connect(envelope).connect(this.sfxBus);
      oscillator.start(start);
      oscillator.stop(start + 0.5);
    });
  },

  // 1.5-second boss arrival stinger: a portal-air swell, descending root, and
  // three name-card strikes. bossIndex lifts later encounters without raising
  // the cue's output level.
  playSurvivalBossArrival(bossIndex = 0) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const at = ctx.currentTime + 0.008;
    const normalizedIndex = Number.isFinite(bossIndex) ? Math.max(0, bossIndex) : 0;
    const lift = 1 + Math.min(normalizedIndex, 8) * 0.025;
    const duration = 1.45;

    const air = ctx.createBufferSource();
    const airFilter = ctx.createBiquadFilter();
    const airEnvelope = ctx.createGain();
    air.buffer = seededNoiseBuffer(this, duration, 0.65);
    airFilter.type = 'bandpass';
    airFilter.Q.value = 0.9;
    airFilter.frequency.setValueAtTime(240 * lift, at);
    airFilter.frequency.exponentialRampToValueAtTime(2100 * lift, at + 0.9);
    airFilter.frequency.exponentialRampToValueAtTime(420 * lift, at + duration);
    airEnvelope.gain.setValueAtTime(MIN_GAIN, at);
    airEnvelope.gain.exponentialRampToValueAtTime(0.13, at + 0.48);
    airEnvelope.gain.exponentialRampToValueAtTime(MIN_GAIN, at + duration);
    air.connect(airFilter).connect(airEnvelope).connect(this.sfxBus);
    air.start(at);
    air.stop(at + duration);

    const root = ctx.createOscillator();
    const rootFilter = ctx.createBiquadFilter();
    const rootEnvelope = ctx.createGain();
    root.type = 'sawtooth';
    root.frequency.setValueAtTime(92 * lift, at);
    root.frequency.exponentialRampToValueAtTime(42 * lift, at + duration);
    rootFilter.type = 'lowpass';
    rootFilter.frequency.value = 620;
    rootEnvelope.gain.setValueAtTime(MIN_GAIN, at);
    rootEnvelope.gain.exponentialRampToValueAtTime(0.16, at + 0.18);
    rootEnvelope.gain.exponentialRampToValueAtTime(MIN_GAIN, at + duration);
    root.connect(rootFilter).connect(rootEnvelope).connect(this.sfxBus);
    root.start(at);
    root.stop(at + duration + 0.02);

    [146.83, 220, 293.66].forEach((frequency, index) => {
      const start = at + 0.72 + index * 0.16;
      const strike = ctx.createOscillator();
      const strikeEnvelope = ctx.createGain();
      strike.type = index === 0 ? 'sine' : 'triangle';
      strike.frequency.setValueAtTime(frequency * lift, start);
      strike.frequency.exponentialRampToValueAtTime(frequency * 0.88 * lift, start + 0.4);
      strikeEnvelope.gain.setValueAtTime(MIN_GAIN, start);
      strikeEnvelope.gain.exponentialRampToValueAtTime(0.22 - index * 0.045, start + 0.012);
      strikeEnvelope.gain.exponentialRampToValueAtTime(MIN_GAIN, start + 0.44);
      strike.connect(strikeEnvelope).connect(this.sfxBus);
      strike.start(start);
      strike.stop(start + 0.46);
    });
  },
};
