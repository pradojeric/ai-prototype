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
import { ECHO, ENDING, MUSIC_SWELL_RANGE, COMBAT, clamp01, mulberry32 } from '../config.js';
import { EchoVoice } from './EchoVoice.js';
import { BGM_BPM, BGM_LOOP_BEATS, BGM_SCORE } from './BgmScore.js';

// Fixed headroom on the master bus; user music/SFX volumes scale their buses.
const MASTER_BASE_GAIN = 0.9;

export class AudioManager {
  constructor() {
    this.ready = false;
    this.musicVolume = 1;      // 0..1 user music volume (bed + melody); settable pre-init
    this.sfxVolume = 1;        // 0..1 user SFX volume (hum, echoes, scatter, teleport)
    this.echoes = new Map();   // artifact -> EchoVoice
    // Seeded rng for per-shot SFX pitch variance (project convention: mulberry32,
    // never Math.random in gameplay paths). Identical repeats read as artificial.
    this._sfxRng = mulberry32(0x51f0);
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
      this.master.gain.value = MASTER_BASE_GAIN;
      this.master.connect(ctx.destination);

      // Shared feedback delay = the "echo" tail (also makes everything watery).
      this.delay = ctx.createDelay(1.0);
      this.delay.delayTime.value = 0.4;
      this.delayFb = ctx.createGain();
      this.delayFb.gain.value = 0.35;
      this.delay.connect(this.delayFb).connect(this.delay);
      this.delay.connect(this.master);

      // User-facing volume buses. Every source routes through one of these
      // (heard dry via master + sent into the shared echo tail), so the sliders
      // also scale each group's delay feed — muting SFX mutes its tail too.
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = this.musicVolume;
      this.musicBus.connect(this.master);
      this.musicBus.connect(this.delay);

      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = this.sfxVolume;
      this.sfxBus.connect(this.master);
      this.sfxBus.connect(this.delay);

      // Ending bus stays dry: narration and restored-world ambience must not
      // inherit the underwater feedback delay.
      this.endingBus = ctx.createGain();
      this.endingBus.gain.value = this.sfxVolume;
      this.endingBus.connect(this.master);

      // Echo bus: spatialized voices route here, into the SFX group.
      this.echoBus = ctx.createGain();
      this.echoBus.connect(this.sfxBus);

      this._buildHum();
      this._buildBed();
      this._buildMelody();

      this.ready = true;
      this._preloadEndingVoiceover();
    } catch (e) { /* audio optional */ }
  }

  async _preloadEndingVoiceover() {
    if (!ENDING.VOICEOVER_URL) return;
    try {
      const response = await fetch(ENDING.VOICEOVER_URL);
      if (!response.ok) return;
      this.endingVoiceBuffer = await this.ctx.decodeAudioData(await response.arrayBuffer());
    } catch (e) { /* optional asset — timed subtitles are the fallback */ }
  }

  // The original proximity sine ("string drawing taut"); driven by setProximity.
  _buildHum() {
    const ctx = this.ctx;
    this.hum = ctx.createGain();
    this.hum.gain.value = 0;
    this.hum.connect(this.sfxBus);
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
    bedGain.gain.value = 0.09;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    filter.Q.value = 0.7;
    filter.connect(bedGain).connect(this.musicBus); // musicBus feeds the delay tail too

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

  // Composed kulintang-style BGM (see BgmScore.js): bells route through
  // melodyGain so the near-artifact swell keeps modulating the lead line;
  // gongs get their own steady gain. A short look-ahead scheduler walks the
  // score and books each note on the Web Audio clock, wrapping per loop.
  _buildMelody() {
    const ctx = this.ctx;
    this.melodyGain = ctx.createGain();
    this.melodyGain.gain.value = 0.05;    // the lead line; swells further near a find
    this.melodyGain.connect(this.musicBus);

    this.gongGain = ctx.createGain();
    this.gongGain.gain.value = 0.13;
    this.gongGain.connect(this.musicBus);

    // The pointer walks the score in order, so it MUST be time-sorted —
    // the source file groups notes by voice for readability.
    const score = [...BGM_SCORE].sort((a, b) => a.t - b.t);
    const beat = 60 / BGM_BPM;
    const loopDur = BGM_LOOP_BEATS * beat;
    let loopStart = ctx.currentTime + 0.15;
    let i = 0;
    const LOOKAHEAD = 0.6; // schedule anything starting within this window

    this._melodyTimer = setInterval(() => {
      const horizon = ctx.currentTime + LOOKAHEAD;
      // Book due notes; when the score is exhausted, roll into the next cycle.
      while (true) {
        if (i >= score.length) { loopStart += loopDur; i = 0; }
        const n = score[i];
        // A start time in the past would collapse the note's envelope ramps
        // to silence (e.g. after a background-tab stall) — nudge it to "now".
        const at = Math.max(loopStart + n.t * beat, ctx.currentTime + 0.01);
        if (at > horizon) break;
        i++;
        if (n.voice === 'gong') this._gong(n.f, at, n.d * beat, n.v);
        else this._bell(n.f, at, n.d * beat, n.v);
      }
    }, 200);
  }

  // Kulintang pot: bright triangle strike with a ringing tail.
  _bell(freq, at, dur, vel) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const env = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = freq;
    const tail = Math.max(dur, 1.2);
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(0.5 * vel, at + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, at + tail);
    o.connect(env).connect(this.melodyGain);
    o.start(at);
    o.stop(at + tail + 0.1);
  }

  // Agung: deep sine strike, a slight pitch sag, long fat decay.
  _gong(freq, at, dur, vel) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const env = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * 1.02, at);
    o.frequency.exponentialRampToValueAtTime(freq, at + 0.25);
    const tail = Math.max(dur, 2.4);
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(0.6 * vel, at + 0.04);
    env.gain.exponentialRampToValueAtTime(0.0001, at + tail);
    o.connect(env).connect(this.gongGain);
    o.start(at);
    o.stop(at + tail + 0.1);
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
    nGain.connect(this.sfxBus);
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
      o.connect(env).connect(this.sfxBus);
      o.start(at);
      o.stop(at + 1.0);
    });
  }

  // ---- one-shot guardian teleport ------------------------------------------
  // Fired whenever the guardian blinks away (periodic roam OR wrong-answer flee).
  // Flat full volume on the master bus so the player hears it from anywhere in
  // the zone: a deep sub "boom" on the vanish + a small high sparkle on reappear,
  // both sent into the echo tail so they ring out underwater.
  playTeleport() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.02;

    // Sub boom: a sine swept downward, fast attack and a fat decay.
    const dur = 0.7;
    const o = ctx.createOscillator();
    const env = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t0);
    o.frequency.exponentialRampToValueAtTime(34, t0 + dur);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(0.6, t0 + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(env).connect(this.sfxBus);
    o.start(t0);
    o.stop(t0 + dur);

    // Sparkle: a few quick high bells as it reappears elsewhere.
    const run = [1046.5, 1318.5, 1568.0]; // C6 E6 G6
    run.forEach((freq, i) => {
      const at = t0 + 0.16 + i * 0.05;
      const so = ctx.createOscillator();
      const senv = ctx.createGain();
      so.type = 'triangle';
      so.frequency.value = freq;
      senv.gain.setValueAtTime(0.0001, at);
      senv.gain.exponentialRampToValueAtTime(0.2, at + 0.01);
      senv.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
      so.connect(senv).connect(this.sfxBus);
      so.start(at);
      so.stop(at + 0.55);
    });
  }

  // ---- wave-combat one-shots ------------------------------------------------
  // All follow the playScatter/playTeleport shape (osc + gain envelope → sfxBus)
  // with a ±SFX_PITCH_VAR frequency wobble per shot so rapid repeats stay alive.

  _pitchVar() { return 1 + (this._sfxRng() - 0.5) * 2 * COMBAT.FEEL.SFX_PITCH_VAR; }

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
  }

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
  }

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
  }

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
  }

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
  }

  // ---- final sequence ------------------------------------------------------
  playPortalCharge() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const at = ctx.currentTime + 0.02;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(42, at);
    osc.frequency.exponentialRampToValueAtTime(260, at + 7.5);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(180, at);
    filter.frequency.exponentialRampToValueAtTime(3200, at + 7.5);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.18, at + 2.0);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 8.4);
    osc.connect(filter).connect(gain).connect(this.sfxBus);
    osc.start(at);
    osc.stop(at + 8.5);
    this._portalOsc = osc;
  }

  playPortalImpact() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const at = ctx.currentTime + 0.01;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, at);
    osc.frequency.exponentialRampToValueAtTime(34, at + 1.1);
    gain.gain.setValueAtTime(0.55, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.2);
    osc.connect(gain).connect(this.sfxBus);
    osc.start(at);
    osc.stop(at + 1.25);
  }

  fadeUnderwater(seconds = 2) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    this.clearEchoes();
    this.musicBus.gain.cancelScheduledValues(now);
    this.musicBus.gain.setValueAtTime(this.musicBus.gain.value, now);
    this.musicBus.gain.linearRampToValueAtTime(0.04 * this.musicVolume, now + seconds);
    this.hum.gain.setTargetAtTime(0, now, 0.08);
    this.delayFb.gain.setTargetAtTime(0, now, Math.max(0.05, seconds / 4));
  }

  playEndingVoiceover() {
    if (!this.ready || !this.endingVoiceBuffer) return false;
    if (this._endingVoice) { try { this._endingVoice.stop(); } catch (e) { /* ended */ } }
    const source = this.ctx.createBufferSource();
    source.buffer = this.endingVoiceBuffer;
    source.connect(this.endingBus);
    source.start();
    this._endingVoice = source;
    return true;
  }

  startDryAmbience() {
    if (!this.ready || this._dryWind) return;
    const ctx = this.ctx;
    const seconds = 3;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const wind = ctx.createBufferSource();
    wind.buffer = buffer;
    wind.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 720;
    filter.Q.value = 0.45;
    const gain = ctx.createGain();
    gain.gain.value = 0.035;
    wind.connect(filter).connect(gain).connect(this.endingBus);
    wind.start();
    this._dryWind = wind;
  }

  restoreAfterEnding() {
    if (!this.ready) return;
    if (this._dryWind) { try { this._dryWind.stop(); } catch (e) { /* ended */ } this._dryWind = null; }
    if (this._endingVoice) { try { this._endingVoice.stop(); } catch (e) { /* ended */ } this._endingVoice = null; }
    const now = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(this.musicVolume, now, 0.8);
    this.sfxBus.gain.setTargetAtTime(this.sfxVolume, now, 0.4);
    this.delayFb.gain.setTargetAtTime(0.35, now, 0.8);
  }

  // ---- user volumes ---------------------------------------------------------
  // Safe to call before init(); values are applied when the context is built.
  setMusicVolume(v) {
    this.musicVolume = clamp01(v);
    if (!this.ready) return;
    this.musicBus.gain.setTargetAtTime(this.musicVolume, this.ctx.currentTime, 0.05);
  }

  setSfxVolume(v) {
    this.sfxVolume = clamp01(v);
    if (!this.ready) return;
    this.sfxBus.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.05);
    this.endingBus.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.05);
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
    const target = 0.05 + swell * 0.15;   // matches the melody's base gain
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
    for (const v of this.echoes.values()) v.update(now, this._lpos); // range-gates each ping
  }
}
