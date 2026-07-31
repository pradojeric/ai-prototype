// ============================================================
// MUSIC TRACKS — the recorded BGM layer (assets/music/*.mp3)
//
// Mixed onto AudioManager.prototype (file-length convention, same as
// CombatSfx/SurvivalSfx). Three tracks crossfade by game phase:
//   explore — the drowned-streets theme (museum, zones, cutscenes)
//   combat  — the Guardian metal theme (arenas + Survival waves)
//   ending  — the finale cue (the four ending* phases)
//
// These route through a DRY bus (master only, never the shared feedback
// DelayNode). The procedural bed still goes through the underwater echo,
// but a produced, mixed mp3 smears badly through a 0.4s feedback delay.
// ============================================================

// Every track restarts from 0:00 on a switch, so every fight opens on the
// riff, every return to exploration opens on the theme's first bar, and the
// finale cue starts on its downbeat as the portal opens.
const TRACK_URLS = {
  explore: './assets/music/strings-bgm.mp3',
  combat: './assets/music/combat_guardian.mp3',
  ending: './assets/music/ending-theme.mp3',
};

// Per-track trim. The mp3s are mastered hot next to the synthesized bed;
// these sit them under the SFX so prompts and echoes stay audible. The
// finale cue carries the scene alone (no prompts, no combat), so it sits up.
const TRACK_GAIN = { explore: 0.55, combat: 0.62, ending: 0.7 };

// explore/combat are authored as seamless loops. The ending cue is
// through-composed against the cutscene timings (portal pull -> museum tour ->
// restored province) and resolves on its final chord — looping it would
// restart the drowned-world opening under the credits.
const TRACK_LOOP = { explore: true, combat: true, ending: false };

const CROSSFADE = 1.5;      // seconds, equal-power-ish linear ramp
// The finale cue opens on a bare gong strike, which a 1.5s fade-in swallows.
// Only its own fade-in is shortened; the outgoing theme still leaves slowly.
const TRACK_FADE_IN = { ending: 0.35 };
// ...and it closes on a held A major chord rather than a decaying sample, so
// it needs a fade to land instead of stopping flat. Scheduled off the decoded
// buffer's own duration, so re-exporting the cue at a new length just works.
// Looping tracks are exempt — a loop that faded out would gap every cycle.
const TRACK_FADE_OUT = { ending: 1.5 };
const SWELL_FLOOR = 0.82;   // exploration track volume with no artifact near
const SWELL_CEIL = 1.0;     // ...and standing on top of one

// Game.phase values that mean "a fight is happening". Survival's briefing and
// its defeat ledger are deliberately absent: the briefing is a modal read
// before the tide starts, and the defeat drop back to the theme is the point.
const COMBAT_PHASES = new Set(['arena', 'survival', 'survivalUpgrade']);

// The finale, from the portal opening through the credits actions. Returning
// to the epilogue museum leaves this set and lands back on 'explore'.
const ENDING_PHASES = new Set(['endingPortal', 'endingMuseum', 'endingRestored', 'endingCredits']);

/** Pure phase -> track-name policy. Exported for tests; no audio deps. */
export function trackForPhase(phase) {
  if (ENDING_PHASES.has(phase)) return 'ending';
  return COMBAT_PHASES.has(phase) ? 'combat' : 'explore';
}

export const MusicTracks = {
  // Called from init() once the context exists.
  _initMusicTracks() {
    const ctx = this.ctx;

    // musicDry -> master only. Volume/pause scaling is applied alongside
    // musicBus in _applyMix and setMusicVolume, but off _trackTarget() — this
    // bus survives fadeUnderwater so the ending cue carries the finale.
    this.musicDry = ctx.createGain();
    this.musicDry.gain.value = this._trackTarget();
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

    const loop = TRACK_LOOP[name] ?? true;
    const fadeIn = TRACK_FADE_IN[name] ?? CROSSFADE;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(TRACK_GAIN[name], now + fadeIn);
    gain.connect(this.trackBus);

    // Tail fade for one-shot tracks, scheduled up front against the buffer's
    // own end. An early _stopTrack (the player leaving the finale) cancels it.
    const fadeOut = loop ? 0 : (TRACK_FADE_OUT[name] ?? 0);
    if (fadeOut > 0) {
      const at = Math.max(now + fadeIn, now + buffer.duration - fadeOut);
      gain.gain.setValueAtTime(TRACK_GAIN[name], at);
      gain.gain.linearRampToValueAtTime(0.0001, at + fadeOut);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
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
