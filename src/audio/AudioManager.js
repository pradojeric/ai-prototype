// ============================================================
// AUDIO — procedural theme bed, string hum, and spatialized artifact "Echoes"
// (no asset files; everything is synthesized in Web Audio). GDD §6
//
// Three layers share one master bus + a feedback DelayNode that doubles as the
// underwater "echo" tail:
//   1. ambient bed   — a slow, LFO-muffled drone (always on, low)
//   2. melody         — sparse pentatonic kulintang-style bells; swells near a find
//   3. echo voices    — one spatialized ping per artifact (the locator)
// ============================================================
import * as THREE from 'three';
import { ECHO, MUSIC_SWELL_RANGE, clamp01 } from '../config.js';
import { EchoVoice } from './EchoVoice.js';

// Sparse A-minor pentatonic for the melody — melancholic, fits a drowned market.
const MELODY_SCALE = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0]; // A3 C4 D4 E4 G4 A4

export class AudioManager {
  constructor() {
    this.ready = false;
    this.echoes = new Map();   // artifact -> EchoVoice
    // scratch vectors for the per-frame listener update (no per-frame alloc)
    this._lpos = new THREE.Vector3();
    this._lfwd = new THREE.Vector3();
    this._lup = new THREE.Vector3();
  }

  init() {
    if (this.ready) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = this.ctx;

      this.master = ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(ctx.destination);

      // Shared feedback delay = the "echo" tail (also makes everything watery).
      this.delay = ctx.createDelay(1.0);
      this.delay.delayTime.value = 0.4;
      this.delayFb = ctx.createGain();
      this.delayFb.gain.value = 0.35;
      this.delay.connect(this.delayFb).connect(this.delay);
      this.delay.connect(this.master);

      // Echo bus: voices route here, heard dry + sent into the echo tail.
      this.echoBus = ctx.createGain();
      this.echoBus.connect(this.master);
      this.echoBus.connect(this.delay);

      this._buildHum();
      this._buildBed();
      this._buildMelody();

      this.ready = true;
    } catch (e) { /* audio optional */ }
  }

  // The original proximity sine ("string drawing taut"); driven by setProximity.
  _buildHum() {
    const ctx = this.ctx;
    this.hum = ctx.createGain();
    this.hum.gain.value = 0;
    this.hum.connect(this.master);
    this.osc = ctx.createOscillator();
    this.osc.type = 'sine';
    this.osc.frequency.value = 196; // G string
    this.osc.connect(this.hum);
    this.osc.start();
  }

  // Low detuned drone through an LFO-swept lowpass = muffled underwater pad.
  _buildBed() {
    const ctx = this.ctx;
    const bedGain = ctx.createGain();
    bedGain.gain.value = 0.05;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    filter.Q.value = 0.7;
    filter.connect(bedGain).connect(this.master);
    bedGain.connect(this.delay); // a little tail on the pad too

    for (const [f, det] of [[55, -4], [82.41, 5]]) { // A1 + its fifth, detuned
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(filter);
      o.start();
    }

    // Slow LFO opens/closes the filter so the pad breathes.
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.06;
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
  }

  // Sparse pentatonic bells into melodyGain (the swell target) + echo tail.
  _buildMelody() {
    const ctx = this.ctx;
    this.melodyGain = ctx.createGain();
    this.melodyGain.gain.value = 0.015;   // quiet until an echo is near
    this.melodyGain.connect(this.master);
    this.melodyGain.connect(this.delay);

    // ~1.4s grid; most ticks rest, so the motif stays sparse and atmospheric.
    this._melodyTimer = setInterval(() => {
      if (Math.random() < 0.55) return;   // rest
      this._note(MELODY_SCALE[Math.floor(Math.random() * MELODY_SCALE.length)]);
    }, 1400);
  }

  _note(freq) {
    const ctx = this.ctx;
    const at = ctx.currentTime + 0.02;
    const o = ctx.createOscillator();
    const env = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(0.5, at + 0.03);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 1.6);
    o.connect(env).connect(this.melodyGain);
    o.start(at);
    o.stop(at + 1.7);
  }

  // ---- one-shot scatter burst ----------------------------------------------
  // Fired when the guardian shatters and the artifacts burst outward: a bright
  // filtered-noise "whoosh" plus a quick ascending pentatonic sparkle, both sent
  // into the echo tail so they bloom and ring out.
  playScatter() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.02;

    // Whoosh: white noise swept up through a bandpass, fading as it rises.
    const dur = 1.1;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(300, t0);
    bp.frequency.exponentialRampToValueAtTime(4000, t0 + dur);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.0001, t0);
    nGain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.05);
    nGain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    noise.connect(bp).connect(nGain);
    nGain.connect(this.master);
    nGain.connect(this.delay);
    noise.start(t0);
    noise.stop(t0 + dur);

    // Sparkle: an ascending pentatonic run that scatters out with the artifacts.
    const run = [261.63, 329.63, 392.0, 523.25, 659.25, 784.0]; // C4 E4 G4 C5 E5 G5
    run.forEach((freq, i) => {
      const at = t0 + 0.04 + i * 0.07;
      const o = ctx.createOscillator();
      const env = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = freq;
      env.gain.setValueAtTime(0.0001, at);
      env.gain.exponentialRampToValueAtTime(0.28, at + 0.02);
      env.gain.exponentialRampToValueAtTime(0.0001, at + 0.9);
      o.connect(env).connect(this.master);
      env.connect(this.delay);
      o.start(at);
      o.stop(at + 1.0);
    });
  }

  // ---- string hum (unchanged behavior) -------------------------------------
  setProximity(dist) {
    if (!this.ready) return;
    const target = dist < 3 ? 0.06 * (1 - dist / 3) : 0;
    this.hum.gain.setTargetAtTime(target, this.ctx.currentTime, 0.2);
  }

  // ---- theme swell ----------------------------------------------------------
  // Ramp the melody up as the nearest echo closes in.
  setSwell(nearestDist) {
    if (!this.ready) return;
    const swell = clamp01((MUSIC_SWELL_RANGE - nearestDist) / MUSIC_SWELL_RANGE);
    const target = 0.015 + swell * 0.12;
    this.melodyGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.4);
  }

  // ---- spatialized artifact echoes -----------------------------------------
  addEcho(key, pos) {
    if (!this.ready || this.echoes.has(key)) return;
    // Stagger first pings so multiple echoes don't fire in unison.
    const phase = this.echoes.size * (ECHO.PING_INTERVAL / 3);
    this.echoes.set(key, new EchoVoice(this.ctx, this.echoBus, pos, phase));
  }

  removeEcho(key) {
    const v = this.echoes.get(key);
    if (!v) return;
    v.dispose();
    this.echoes.delete(key);
  }

  clearEchoes() {
    for (const v of this.echoes.values()) v.dispose();
    this.echoes.clear();
  }

  // Per-frame: orient the listener to the camera and advance the echo pings.
  updateListener(camera) {
    if (!this.ready) return;
    camera.getWorldPosition(this._lpos);
    camera.getWorldDirection(this._lfwd);
    this._lup.set(0, 1, 0).applyQuaternion(camera.quaternion);

    const l = this.ctx.listener;
    if (l.positionX) {
      l.positionX.value = this._lpos.x;
      l.positionY.value = this._lpos.y;
      l.positionZ.value = this._lpos.z;
      l.forwardX.value = this._lfwd.x;
      l.forwardY.value = this._lfwd.y;
      l.forwardZ.value = this._lfwd.z;
      l.upX.value = this._lup.x;
      l.upY.value = this._lup.y;
      l.upZ.value = this._lup.z;
    } else { // deprecated fallback
      l.setPosition(this._lpos.x, this._lpos.y, this._lpos.z);
      l.setOrientation(this._lfwd.x, this._lfwd.y, this._lfwd.z,
                       this._lup.x, this._lup.y, this._lup.z);
    }

    const now = this.ctx.currentTime;
    for (const v of this.echoes.values()) v.update(now);
  }
}
