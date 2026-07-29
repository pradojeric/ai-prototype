// ============================================================
// COMBAT SFX — every wave-combat one-shot the arenas fire, split out of
// AudioManager to keep that file under the 1000-line limit. These are mixed
// onto AudioManager.prototype rather than wrapped, so `this` is the live
// manager and the public API (audio.playShoot(), audio.playShockwave(), …) is
// byte-for-byte what callers already use.
//
// Every method here follows the playScatter/playTeleport shape — oscillator or
// noise buffer into a gain envelope into this.sfxBus — and bails on !this.ready.
// ============================================================
import { COMBAT } from '../../config.js';

export const CombatSfx = {
  // All follow the playScatter/playTeleport shape (osc + gain envelope → sfxBus)
  // with a ±SFX_PITCH_VAR frequency wobble per shot so rapid repeats stay alive.

  _pitchVar() { return 1 + (this._sfxRng() - 0.5) * 2 * COMBAT.FEEL.SFX_PITCH_VAR; },

  // Shared arena summon, timed to the thread tear's open → strain → birth arc
  // (COMBAT.SPAWN_TELEGRAPH): a rising thread tone under a detuned shimmer that
  // swells while the strands strain, resolving into a glassy arrival ping.
  // Simultaneous enemy portals collapse into one batch cue so a full wave
  // cannot stack identical oscillators into clipping.
  playEnemyPortal() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.02;
    if (t0 - this._enemyPortalLastAt < 0.08) return;
    this._enemyPortalLastAt = t0;
    const v = this._pitchVar();
    const open = COMBAT.SPAWN_TELEGRAPH;

    const thread = ctx.createOscillator();
    const threadEnv = ctx.createGain();
    thread.type = 'sine';
    thread.frequency.setValueAtTime(170 * v, t0);
    thread.frequency.exponentialRampToValueAtTime(620 * v, t0 + open * 0.86);
    threadEnv.gain.setValueAtTime(0.0001, t0);
    threadEnv.gain.exponentialRampToValueAtTime(0.13, t0 + 0.12);
    threadEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + open * 0.96);
    thread.connect(threadEnv).connect(this.sfxBus);
    thread.start(t0);
    thread.stop(t0 + open * 0.98);

    // Strain shimmer: enters as the seam unzips and tightens under the threads,
    // so the wait has motion instead of one flat sweep.
    const strain = ctx.createOscillator();
    const strainEnv = ctx.createGain();
    const strainAt = t0 + open * 0.4;
    strain.type = 'triangle';
    strain.frequency.setValueAtTime(392 * v, strainAt);
    strain.frequency.exponentialRampToValueAtTime(784 * v, t0 + open * 0.92);
    strainEnv.gain.setValueAtTime(0.0001, strainAt);
    strainEnv.gain.exponentialRampToValueAtTime(0.055, t0 + open * 0.72);
    strainEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + open * 0.98);
    strain.connect(strainEnv).connect(this.sfxBus);
    strain.start(strainAt);
    strain.stop(t0 + open);

    const arrival = ctx.createOscillator();
    const arrivalEnv = ctx.createGain();
    const arrivalAt = t0 + COMBAT.SPAWN_TELEGRAPH - 0.04;
    arrival.type = 'triangle';
    arrival.frequency.setValueAtTime(1046.5 * v, arrivalAt);
    arrival.frequency.exponentialRampToValueAtTime(1568 * v, arrivalAt + 0.12);
    arrivalEnv.gain.setValueAtTime(0.0001, arrivalAt);
    arrivalEnv.gain.exponentialRampToValueAtTime(0.18, arrivalAt + 0.015);
    arrivalEnv.gain.exponentialRampToValueAtTime(0.0001, arrivalAt + 0.3);
    arrival.connect(arrivalEnv).connect(this.sfxBus);
    arrival.start(arrivalAt);
    arrival.stop(arrivalAt + 0.32);
  },

  // Light-bolt cast: a short bright zap sweeping down.
  playShoot() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.02;
    const v = this._pitchVar();
    const o = ctx.createOscillator();
    const env = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(900 * v, t0);
    o.frequency.exponentialRampToValueAtTime(260 * v, t0 + 0.12);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(0.22, t0 + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
    o.connect(env).connect(this.sfxBus);
    o.start(t0);
    o.stop(t0 + 0.16);
  },

  // Bolt lands on an echo: a dull "thock" (short bandpassed noise + low blip).
  playHit() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.02;
    const v = this._pitchVar();
    const dur = 0.06;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.value = 700 * v;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.25, t0);
    nGain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    noise.connect(bp).connect(nGain).connect(this.sfxBus);
    noise.start(t0);
    noise.stop(t0 + dur);

    const o = ctx.createOscillator();
    const env = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 220 * v;
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(0.18, t0 + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
    o.connect(env).connect(this.sfxBus);
    o.start(t0);
    o.stop(t0 + 0.12);
  },

  // Melee shockwave: a low sine thump falling away under a bright noise whoosh
  // swept downward by a bandpass. Deeper and longer than playShoot so the panic
  // button never gets mistaken for a bolt in a busy fight.
  playShockwave() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.01;
    const v = this._pitchVar();

    const thump = ctx.createOscillator();
    const thumpEnv = ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(180 * v, t0);
    thump.frequency.exponentialRampToValueAtTime(42 * v, t0 + 0.32);
    thumpEnv.gain.setValueAtTime(0.0001, t0);
    thumpEnv.gain.exponentialRampToValueAtTime(0.32, t0 + 0.012);
    thumpEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42);
    thump.connect(thumpEnv).connect(this.sfxBus);
    thump.start(t0);
    thump.stop(t0 + 0.44);

    const dur = 0.34;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(2400 * v, t0);
    bp.frequency.exponentialRampToValueAtTime(340 * v, t0 + dur);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.0001, t0);
    nGain.gain.exponentialRampToValueAtTime(0.2, t0 + 0.02);
    nGain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    noise.connect(bp).connect(nGain).connect(this.sfxBus);
    noise.start(t0);
    noise.stop(t0 + dur);
  },

  // An echo dissolves: a quick descending sparkle (inverse of the scatter run).
  playEnemyDeath() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.02;
    const v = this._pitchVar();
    const run = [784.0, 523.25, 392.0]; // G5 C5 G4 — falling
    run.forEach((freq, i) => {
      const at = t0 + i * 0.06;
      const o = ctx.createOscillator();
      const env = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = freq * v;
      env.gain.setValueAtTime(0.0001, at);
      env.gain.exponentialRampToValueAtTime(0.2, at + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
      o.connect(env).connect(this.sfxBus);
      o.start(at);
      o.stop(at + 0.55);
    });
  },

  // The player takes a hit: a low thud with a dark noise thump under it.
  playPlayerHurt() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.02;
    const v = this._pitchVar();
    const o = ctx.createOscillator();
    const env = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(90 * v, t0);
    o.frequency.exponentialRampToValueAtTime(50 * v, t0 + 0.25);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(0.5, t0 + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
    o.connect(env).connect(this.sfxBus);
    o.start(t0);
    o.stop(t0 + 0.32);

    const dur = 0.12;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.3, t0);
    nGain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    noise.connect(lp).connect(nGain).connect(this.sfxBus);
    noise.start(t0);
    noise.stop(t0 + dur);
  },

  // A wave (or the whole fight) is cleared: a rising two-note pentatonic chime.
  playWaveClear() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.02;
    const run = [523.25, 784.0]; // C5 G5 — rising
    run.forEach((freq, i) => {
      const at = t0 + i * 0.12;
      const o = ctx.createOscillator();
      const env = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = freq;
      env.gain.setValueAtTime(0.0001, at);
      env.gain.exponentialRampToValueAtTime(0.3, at + 0.02);
      env.gain.exponentialRampToValueAtTime(0.0001, at + 1.0);
      o.connect(env).connect(this.sfxBus);
      o.start(at);
      o.stop(at + 1.1);
    });
  },

  // Memory Lumina pickup: one shared glassy two-note chime for all colors.
  // Color identity is carried by the orb + HUD so the audio stays lightweight.
  playLuminaPickup() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.01;
    const v = this._pitchVar();
    [659.25, 987.77].forEach((freq, i) => {
      const at = t0 + i * 0.055;
      const oscillator = ctx.createOscillator();
      const envelope = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = freq * v;
      envelope.gain.setValueAtTime(0.0001, at);
      envelope.gain.exponentialRampToValueAtTime(0.22, at + 0.008);
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.42);
      oscillator.connect(envelope).connect(this.sfxBus);
      oscillator.start(at);
      oscillator.stop(at + 0.45);
    });
  },

  // Arena 2: paper lantern launched from The Reveler's hand.
  playLanternThrow() {
    if (!this.ready) return;
    const at = this.ctx.currentTime + 0.01;
    const oscillator = this.ctx.createOscillator();
    const envelope = this.ctx.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(520 * this._pitchVar(), at);
    oscillator.frequency.exponentialRampToValueAtTime(210, at + 0.22);
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(0.18, at + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
    oscillator.connect(envelope).connect(this.sfxBus);
    oscillator.start(at);
    oscillator.stop(at + 0.3);
  },

  // Arena 2: correct answer reverses direction toward the guardian.
  playLanternDeflect() {
    if (!this.ready) return;
    const at = this.ctx.currentTime + 0.01;
    [659.25, 987.77, 1318.5].forEach((frequency, index) => {
      const oscillator = this.ctx.createOscillator();
      const envelope = this.ctx.createGain();
      const start = at + index * 0.055;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency * this._pitchVar();
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(0.2, start + 0.008);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
      oscillator.connect(envelope).connect(this.sfxBus);
      oscillator.start(start);
      oscillator.stop(start + 0.52);
    });
  },

  // Arena 2: a light bolt catches and reverses a River Sniper projectile.
  playBoltReflect() {
    if (!this.ready) return;
    const at = this.ctx.currentTime + 0.01;
    const oscillator = this.ctx.createOscillator();
    const envelope = this.ctx.createGain();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(680 * this._pitchVar(), at);
    oscillator.frequency.exponentialRampToValueAtTime(1480, at + 0.09);
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(0.16, at + 0.006);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.14);
    oscillator.connect(envelope).connect(this.sfxBus);
    oscillator.start(at);
    oscillator.stop(at + 0.16);
  },

  // Arena 2: low wooden hull knock, shared by sniper, boarder, and riddle damage.
  playHullImpact() {
    if (!this.ready) return;
    const at = this.ctx.currentTime + 0.01;
    const oscillator = this.ctx.createOscillator();
    const envelope = this.ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(125 * this._pitchVar(), at);
    oscillator.frequency.exponentialRampToValueAtTime(42, at + 0.32);
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(0.52, at + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.36);
    oscillator.connect(envelope).connect(this.sfxBus);
    oscillator.start(at);
    oscillator.stop(at + 0.38);
  },

  // Guardian shield damage: a brittle filtered crack with glassy magic shards.
  // The final hit adds more fragments and a restrained low shatter impact.
  playArmorBreak(final = false) {
    if (!this.ready || this._sfxTarget() <= 0) return;
    const ctx = this.ctx;
    const at = ctx.currentTime + 0.01;
    const isFinal = !!final;
    const v = this._pitchVar();
    const duration = isFinal ? 0.28 : 0.14;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const decay = Math.pow(1 - i / data.length, 2.4);
      data[i] = (this._sfxRng() * 2 - 1) * decay;
    }

    const crack = ctx.createBufferSource();
    const crackFilter = ctx.createBiquadFilter();
    const crackEnv = ctx.createGain();
    crack.buffer = buffer;
    crackFilter.type = 'bandpass';
    crackFilter.Q.value = 0.75;
    crackFilter.frequency.setValueAtTime(2800 * v, at);
    crackFilter.frequency.exponentialRampToValueAtTime(950 * v, at + duration);
    crackEnv.gain.setValueAtTime(0.0001, at);
    crackEnv.gain.exponentialRampToValueAtTime(isFinal ? 0.28 : 0.2, at + 0.004);
    crackEnv.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    crack.connect(crackFilter).connect(crackEnv).connect(this.sfxBus);
    crack.start(at);
    crack.stop(at + duration);

    const shardFrequencies = isFinal
      ? [1174.66, 1567.98, 2093.0, 2637.02, 3135.96]
      : [1318.51, 1975.53];
    shardFrequencies.forEach((frequency, index) => {
      const start = at + 0.012 + index * (isFinal ? 0.025 : 0.018);
      const tail = isFinal ? 0.48 : 0.28;
      const shard = ctx.createOscillator();
      const shardEnv = ctx.createGain();
      shard.type = 'triangle';
      shard.frequency.setValueAtTime(frequency * v, start);
      shard.frequency.exponentialRampToValueAtTime(frequency * 0.72 * v, start + tail);
      shardEnv.gain.setValueAtTime(0.0001, start);
      shardEnv.gain.exponentialRampToValueAtTime(isFinal ? 0.065 : 0.055, start + 0.006);
      shardEnv.gain.exponentialRampToValueAtTime(0.0001, start + tail);
      shard.connect(shardEnv).connect(this.sfxBus);
      shard.start(start);
      shard.stop(start + tail + 0.02);
    });

    if (isFinal) {
      const impact = ctx.createOscillator();
      const impactEnv = ctx.createGain();
      impact.type = 'sine';
      impact.frequency.setValueAtTime(145 * v, at);
      impact.frequency.exponentialRampToValueAtTime(48 * v, at + 0.34);
      impactEnv.gain.setValueAtTime(0.0001, at);
      impactEnv.gain.exponentialRampToValueAtTime(0.2, at + 0.01);
      impactEnv.gain.exponentialRampToValueAtTime(0.0001, at + 0.36);
      impact.connect(impactEnv).connect(this.sfxBus);
      impact.start(at);
      impact.stop(at + 0.38);
    }
  },

  // Boss phase transition: a sustained low surge that rises into a dark dyad.
  // Later phase numbers lift the cue slightly without materially raising volume.
  playBossPhase(phase = 1) {
    if (!this.ready || this._sfxTarget() <= 0) return;
    const ctx = this.ctx;
    const at = ctx.currentTime + 0.01;
    const normalizedPhase = Number.isFinite(phase) ? Math.max(1, phase) : 1;
    const lift = 1 + Math.min(normalizedPhase - 1, 4) * 0.05;
    const duration = 0.95;

    const surge = ctx.createOscillator();
    const surgeFilter = ctx.createBiquadFilter();
    const surgeEnv = ctx.createGain();
    surge.type = 'sawtooth';
    surge.frequency.setValueAtTime(46 * lift, at);
    surge.frequency.exponentialRampToValueAtTime(155 * lift, at + 0.72);
    surgeFilter.type = 'lowpass';
    surgeFilter.Q.value = 1.1;
    surgeFilter.frequency.setValueAtTime(170, at);
    surgeFilter.frequency.exponentialRampToValueAtTime(1350 * lift, at + 0.72);
    surgeEnv.gain.setValueAtTime(0.0001, at);
    surgeEnv.gain.exponentialRampToValueAtTime(0.14, at + 0.32);
    surgeEnv.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    surge.connect(surgeFilter).connect(surgeEnv).connect(this.sfxBus);
    surge.start(at);
    surge.stop(at + duration + 0.02);

    const stingerAt = at + 0.62;
    [196, 293.66].forEach((frequency, index) => {
      const tone = ctx.createOscillator();
      const toneEnv = ctx.createGain();
      tone.type = index === 0 ? 'sine' : 'triangle';
      tone.frequency.setValueAtTime(frequency * lift, stingerAt);
      tone.frequency.exponentialRampToValueAtTime(frequency * 1.12 * lift, stingerAt + 0.22);
      toneEnv.gain.setValueAtTime(0.0001, stingerAt);
      toneEnv.gain.exponentialRampToValueAtTime(index === 0 ? 0.13 : 0.07, stingerAt + 0.025);
      toneEnv.gain.exponentialRampToValueAtTime(0.0001, stingerAt + 0.5);
      tone.connect(toneEnv).connect(this.sfxBus);
      tone.start(stingerAt);
      tone.stop(stingerAt + 0.52);
    });
  },
};
