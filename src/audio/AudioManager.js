// ============================================================
// AUDIO — procedural theme bed, string hum, and spatialized artifact "Echoes"
// (no asset files; everything is synthesized in Web Audio). GDD §6
//
// Three layers share one master bus + a feedback DelayNode that doubles as the
// underwater "echo" tail:
//   1. ambient bed   — a slow, LFO-muffled drone (always on, low)
//   2. echo voices    — one spatialized ping per artifact (the locator)
//
// The melodic layer is NOT synthesized: it is the recorded BGM in assets/music,
// crossfaded by game phase on a dry bus (see _partials/MusicTracks.js).
// ============================================================
import * as THREE from 'three';
import { ECHO, ENDING, MUSIC_SWELL_RANGE, COMBAT, clamp01, mulberry32 } from '../config.js';
import { EchoVoice } from './EchoVoice.js';
import { CombatSfx } from './_partials/CombatSfx.js';
import { SurvivalSfx } from './_partials/SurvivalSfx.js';
import { MusicTracks } from './_partials/MusicTracks.js';

// Fixed headroom on the master bus; user music/SFX volumes scale their buses.
const MASTER_BASE_GAIN = 0.9;
const PAUSED_MUSIC_SCALE = 0.18;

export class AudioManager {
  constructor() {
    this.ready = false;
    this.musicVolume = 1;      // 0..1 user music volume (bed + melody); settable pre-init
    this.sfxVolume = 1;        // 0..1 user SFX volume (hum, echoes, scatter, teleport)
    this._paused = false;
    // Two music scales, because the two music buses leave the drowned world
    // differently: the procedural bed (musicBus) is *of* the water and dies
    // with it, while the recorded track (musicDry) has to carry the finale.
    this._musicMixScale = 1;   // musicBus — bed + its delay tail
    this._trackMixScale = 1;   // musicDry — the recorded mp3/wav layer
    this._sfxMixScale = 1;
    this._endingMixScale = 1;
    this._delayFeedback = 0.35;
    this._endingVoice = null;
    this._endingVoiceActive = false;
    this._endingVoiceOffset = 0;
    this._endingVoiceStartedAt = 0;
    this.echoes = new Map();   // artifact -> EchoVoice
    // Seeded rng for per-shot SFX pitch variance (project convention: mulberry32,
    // never Math.random in gameplay paths). Identical repeats read as artificial.
    this._sfxRng = mulberry32(0x51f0);
    this._enemyPortalLastAt = -Infinity;
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
      this.delayFb.gain.value = this._paused ? 0 : this._delayFeedback;
      this.delay.connect(this.delayFb).connect(this.delay);
      this.delayOut = ctx.createGain();
      this.delayOut.gain.value = this._paused ? 0 : 1;
      this.delay.connect(this.delayOut).connect(this.master);

      // User-facing volume buses. Every source routes through one of these
      // (heard dry via master + sent into the shared echo tail), so the sliders
      // also scale each group's delay feed — muting SFX mutes its tail too.
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = this._musicTarget();
      this.musicBus.connect(this.master);
      this.musicBus.connect(this.delay);

      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = this._sfxTarget();
      this.sfxBus.connect(this.master);
      this.sfxBus.connect(this.delay);

      // Ending bus stays dry: narration and restored-world ambience must not
      // inherit the underwater feedback delay.
      this.endingBus = ctx.createGain();
      this.endingBus.gain.value = this._endingTarget();
      this.endingBus.connect(this.master);

      // Echo bus: spatialized voices route here, into the SFX group.
      this.echoBus = ctx.createGain();
      this.echoBus.connect(this.sfxBus);

      this._buildHum();
      this._buildBed();
      this._initMusicTracks();

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

  // The melodic layer is no longer synthesized — it is the recorded BGM in
  // assets/music, crossfaded by game phase. See _partials/MusicTracks.js.
  // (BgmScore.js keeps the old hand-authored kulintang score, now unused.)

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

  // Dramatic, zone-colored Guardian reveal. The cue is deliberately synthesized
  // on the shared SFX bus so it honors the player's volume setting and inherits
  // the same drowned-space echo as the rest of the Memory Rift.
  playGuardianIntro(arenaId, duration = 11.5) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.04;
    const palettes = {
      arena1: { root: 55, intervals: [1, 1.5, 2, 2.5], type: 'sawtooth' },
      arena2: { root: 73.42, intervals: [1, 1.25, 1.5, 2], type: 'triangle' },
      // The Keeper's reveal plays in arena3boss, past the summit portal.
      arena3boss: { root: 49, intervals: [1, 1.5, 2, 3], type: 'sine' },
    };
    const palette = palettes[arenaId] || palettes.arena1;

    // Low ceremonial drone swells under the complete camera move.
    const drone = ctx.createOscillator();
    const droneFilter = ctx.createBiquadFilter();
    const droneGain = ctx.createGain();
    drone.type = palette.type;
    drone.frequency.setValueAtTime(palette.root, t0);
    const cueDuration = Math.max(4, duration);
    const fadeAt = Math.max(1.5, cueDuration - 1);
    drone.frequency.exponentialRampToValueAtTime(palette.root * 0.72, t0 + cueDuration * 0.76);
    droneFilter.type = 'lowpass';
    droneFilter.frequency.setValueAtTime(180, t0);
    droneFilter.frequency.exponentialRampToValueAtTime(720, t0 + cueDuration * 0.34);
    droneFilter.frequency.exponentialRampToValueAtTime(140, t0 + fadeAt);
    droneGain.gain.setValueAtTime(0.0001, t0);
    droneGain.gain.exponentialRampToValueAtTime(0.22, t0 + 1.2);
    droneGain.gain.setValueAtTime(0.18, t0 + Math.max(1.3, fadeAt - 0.7));
    droneGain.gain.exponentialRampToValueAtTime(0.0001, t0 + cueDuration);
    drone.connect(droneFilter).connect(droneGain).connect(this.sfxBus);
    drone.start(t0);
    drone.stop(t0 + cueDuration + 0.05);

    // Four widely spaced struck tones mark reveal, name, challenge, and release.
    palette.intervals.forEach((interval, index) => {
      const at = t0 + [0.06, 0.22, 0.47, 0.75][index] * cueDuration;
      const oscillator = ctx.createOscillator();
      const envelope = ctx.createGain();
      oscillator.type = index === 0 ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(palette.root * interval * 2, at);
      oscillator.frequency.exponentialRampToValueAtTime(
        palette.root * interval * 1.92, at + 1.8,
      );
      envelope.gain.setValueAtTime(0.0001, at);
      envelope.gain.exponentialRampToValueAtTime(index === 0 ? 0.48 : 0.24, at + 0.035);
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + 2.3);
      oscillator.connect(envelope).connect(this.sfxBus);
      oscillator.start(at);
      oscillator.stop(at + 2.4);
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

  // Leaving the drowned world: the underwater bed and its feedback tail go
  // with the water. The recorded track deliberately does NOT — the ending cue
  // lives on musicDry and has to carry the museum tour and the restored
  // province, so it keeps its own (unducked) scale.
  fadeUnderwater(seconds = 2) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    this.clearEchoes();
    this._musicMixScale = 0.04;
    this._delayFeedback = 0;
    for (const [bus, target] of [[this.musicBus, this._musicTarget()],
                                 [this.musicDry, this._trackTarget()]]) {
      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(bus.gain.value, now);
      bus.gain.linearRampToValueAtTime(target, now + seconds);
    }
    this.hum.gain.setTargetAtTime(0, now, 0.08);
    this.delayFb.gain.setTargetAtTime(this._paused ? 0 : this._delayFeedback,
      now, Math.max(0.05, seconds / 4));
  }

  playEndingVoiceover() {
    if (!this.ready || !this.endingVoiceBuffer) return false;
    this._stopEndingVoice(false);
    this._endingVoiceActive = true;
    this._endingVoiceOffset = 0;
    if (!this._paused) this._startEndingVoice();
    return true;
  }

  _startEndingVoice() {
    if (!this._endingVoiceActive || this._endingVoice || !this.endingVoiceBuffer) return;
    if (this._endingVoiceOffset >= this.endingVoiceBuffer.duration) {
      this._endingVoiceActive = false;
      this._endingVoiceOffset = 0;
      return;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = this.endingVoiceBuffer;
    source.connect(this.endingBus);
    this._endingVoice = source;
    this._endingVoiceStartedAt = this.ctx.currentTime;
    source.onended = () => {
      if (this._endingVoice !== source) return;
      this._endingVoice = null;
      this._endingVoiceActive = false;
      this._endingVoiceOffset = 0;
    };
    source.start(0, this._endingVoiceOffset);
  }

  _stopEndingVoice(preservePosition) {
    if (!this._endingVoice) {
      if (!preservePosition) {
        this._endingVoiceActive = false;
        this._endingVoiceOffset = 0;
      }
      return;
    }
    const source = this._endingVoice;
    if (preservePosition) {
      this._endingVoiceOffset += this.ctx.currentTime - this._endingVoiceStartedAt;
    } else {
      this._endingVoiceActive = false;
      this._endingVoiceOffset = 0;
    }
    this._endingVoice = null;
    try { source.stop(); } catch (error) { /* source already ended */ }
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
    this._stopEndingVoice(false);
    this._musicMixScale = 1;
    this._trackMixScale = 1;
    this._sfxMixScale = 1;
    this._endingMixScale = 1;
    this._delayFeedback = 0.35;
    this._applyMix(0.8);
  }

  // ---- user volumes ---------------------------------------------------------
  setPaused(paused) {
    const next = !!paused;
    if (next === this._paused) return;
    if (next && this.ready) this._stopEndingVoice(true);
    this._paused = next;
    if (!this.ready) return;
    this._applyMix(0.08);
    if (!next) this._startEndingVoice();
  }

  resumeContext() {
    if (!this.ready || this.ctx.state !== 'suspended') return;
    void this.ctx.resume().catch(() => { /* audio remains optional */ });
  }

  // Safe to call before init(); values are applied when the context is built.
  setMusicVolume(v) {
    this.musicVolume = clamp01(v);
    if (!this.ready) return;
    const target = this._musicTarget();
    this.musicBus.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
    this.musicDry.gain.setTargetAtTime(this._trackTarget(), this.ctx.currentTime, 0.05);
  }

  setSfxVolume(v) {
    this.sfxVolume = clamp01(v);
    if (!this.ready) return;
    this.sfxBus.gain.setTargetAtTime(this._sfxTarget(), this.ctx.currentTime, 0.05);
    this.endingBus.gain.setTargetAtTime(this._endingTarget(), this.ctx.currentTime, 0.05);
  }

  _musicTarget() {
    const pauseScale = this._paused ? PAUSED_MUSIC_SCALE : 1;
    return this.musicVolume * this._musicMixScale * pauseScale;
  }

  // musicDry: same user slider and pause duck, its own scene-mix scale.
  _trackTarget() {
    const pauseScale = this._paused ? PAUSED_MUSIC_SCALE : 1;
    return this.musicVolume * this._trackMixScale * pauseScale;
  }

  _sfxTarget() { return this._paused ? 0 : this.sfxVolume * this._sfxMixScale; }

  _endingTarget() { return this._paused ? 0 : this.sfxVolume * this._endingMixScale; }

  _applyMix(timeConstant) {
    const now = this.ctx.currentTime;
    const apply = (param, target) => {
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
      param.setTargetAtTime(target, now, timeConstant);
    };
    apply(this.musicBus.gain, this._musicTarget());
    apply(this.musicDry.gain, this._trackTarget());
    apply(this.sfxBus.gain, this._sfxTarget());
    apply(this.endingBus.gain, this._endingTarget());
    apply(this.delayFb.gain, this._paused ? 0 : this._delayFeedback);
    apply(this.delayOut.gain, this._paused ? 0 : 1);
  }

  // ---- string hum (unchanged behavior) -------------------------------------
  setProximity(dist) {
    if (!this.ready) return;
    const target = dist < 3 ? 0.06 * (1 - dist / 3) : 0;
    this.hum.gain.setTargetAtTime(target, this.ctx.currentTime, 0.2);
  }

  // ---- theme swell ----------------------------------------------------------
  // Ramp the exploration track up as the nearest echo closes in.
  setSwell(nearestDist) {
    if (!this.ready) return;
    this._swell = clamp01((MUSIC_SWELL_RANGE - nearestDist) / MUSIC_SWELL_RANGE);
    this._applySwell();
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

// The wave-combat one-shots live in _partials/CombatSfx.js (file-length limit)
// but are part of this class's surface. Mixing them onto the prototype keeps
// every existing call site — audio.playShoot(), audio.playHit(), … — unchanged.
Object.assign(AudioManager.prototype, CombatSfx);
Object.assign(AudioManager.prototype, SurvivalSfx);
Object.assign(AudioManager.prototype, MusicTracks);
