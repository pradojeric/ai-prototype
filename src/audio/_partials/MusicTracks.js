// ============================================================
// MUSIC TRACKS — the recorded BGM layer (assets/music/*.mp3)
//
// Mixed onto AudioManager.prototype (file-length convention, same as
// CombatSfx/SurvivalSfx). Two looping tracks crossfade by game phase:
//   explore — the drowned-streets theme (museum, zones, cutscenes, ending)
//   combat  — the Guardian metal theme (arenas + Survival waves)
//
// These route through a DRY bus (master only, never the shared feedback
// DelayNode). The procedural bed still goes through the underwater echo,
// but a produced, mixed mp3 smears badly through a 0.4s feedback delay.
// ============================================================

// Both tracks always restart from 0:00 on a switch, so every fight opens on
// the riff and every return to exploration opens on the theme's first bar.
const TRACK_URLS = {
  explore: './assets/music/strings-bgm.mp3',
  combat: './assets/music/combat_guardian.mp3',
};

// Per-track trim. The mp3s are mastered hot next to the synthesized bed;
// these sit them under the SFX so prompts and echoes stay audible.
const TRACK_GAIN = { explore: 0.55, combat: 0.62 };

const CROSSFADE = 1.5;      // seconds, equal-power-ish linear ramp
const SWELL_FLOOR = 0.82;   // exploration track volume with no artifact near
const SWELL_CEIL = 1.0;     // ...and standing on top of one

// Game.phase values that mean "a fight is happening". Survival's briefing and
// its defeat ledger are deliberately absent: the briefing is a modal read
// before the tide starts, and the defeat drop back to the theme is the point.
const COMBAT_PHASES = new Set(['arena', 'survival', 'survivalUpgrade']);

/** Pure phase -> track-name policy. Exported for tests; no audio deps. */
export function trackForPhase(phase) {
  return COMBAT_PHASES.has(phase) ? 'combat' : 'explore';
}

export const MusicTracks = {
  // Called from init() once the context exists.
  _initMusicTracks() {
    const ctx = this.ctx;

    // musicDry -> master only. Volume/pause scaling is applied alongside
    // musicBus in _applyMix and setMusicVolume.
    this.musicDry = ctx.createGain();
    this.musicDry.gain.value = this._musicTarget();
    this.musicDry.connect(this.master);

    // Swell stage sits above the per-source crossfade gains so the two never
    // schedule ramps on the same AudioParam.
    this.trackBus = ctx.createGain();
    this.trackBus.gain.value = SWELL_FLOOR;
    this.trackBus.connect(this.musicDry);

    this._trackBuffers = new Map();
    this._trackSources = new Map();   // name -> { source, gain }
    this._currentTrack = null;
    this._pendingTrack = null;

    for (const name of Object.keys(TRACK_URLS)) void this._loadTrack(name);
  },

  async _loadTrack(name) {
    try {
      const response = await fetch(TRACK_URLS[name]);
      if (!response.ok) return;
      const buffer = await this.ctx.decodeAudioData(await response.arrayBuffer());
      this._trackBuffers.set(name, buffer);
      // The phase may have asked for this track before it finished decoding.
      if (this._pendingTrack === name) {
        this._pendingTrack = null;
        this._startTrack(name);
      }
    } catch (error) {
      // Music is optional — the procedural bed still carries the scene.
    }
  },

  /**
   * Drive the music from the current game phase. Safe to call every frame:
   * it no-ops unless the resolved track actually changed.
   */
  setMusicPhase(phase) {
    if (!this.ready) return;
    const next = trackForPhase(phase);
    if (next === this._currentTrack || next === this._pendingTrack) return;
    this._crossfadeTo(next);
  },

  _crossfadeTo(name) {
    const previous = this._currentTrack;
    this._currentTrack = name;
    if (previous) this._stopTrack(previous, CROSSFADE);
    if (this._trackBuffers.has(name)) this._startTrack(name);
    else this._pendingTrack = name;   // still decoding; start on arrival
  },

  _startTrack(name) {
    const buffer = this._trackBuffers.get(name);
    if (!buffer || this._currentTrack !== name) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(TRACK_GAIN[name], now + CROSSFADE);
    gain.connect(this.trackBus);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;           // both tracks are authored to loop seamlessly
    source.connect(gain);
    source.start(now);            // always from the top, by design

    this._trackSources.set(name, { source, gain });
    this._applySwell(0.4);
  },

  _stopTrack(name, seconds) {
    const entry = this._trackSources.get(name);
    if (!entry) return;
    this._trackSources.delete(name);
    const now = this.ctx.currentTime;
    entry.gain.gain.cancelScheduledValues(now);
    entry.gain.gain.setValueAtTime(entry.gain.gain.value, now);
    entry.gain.gain.linearRampToValueAtTime(0.0001, now + seconds);
    try { entry.source.stop(now + seconds + 0.05); } catch (error) { /* already ended */ }
  },

  // Nearest-artifact swell, inherited from the retired procedural melody.
  // Only the exploration theme breathes with proximity — a boss fight
  // ducking because you strayed near an artifact would read as a bug.
  _applySwell(timeConstant = 0.4) {
    if (!this.trackBus) return;
    const target = this._currentTrack === 'explore'
      ? SWELL_FLOOR + (SWELL_CEIL - SWELL_FLOOR) * (this._swell || 0)
      : SWELL_CEIL;
    this.trackBus.gain.setTargetAtTime(target, this.ctx.currentTime, timeConstant);
  },
};

export const MUSIC_CROSSFADE = CROSSFADE;
