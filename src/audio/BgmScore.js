// ============================================================
// BGM SCORE — a hand-authored, looping kulintang-style piece (GDD §6)
//
// Replaces the old random-note melody with a composed 32-beat cycle:
// mournful A-minor-pentatonic phrases (call, response, descent, resolve)
// over slow gong strikes, in the cyclic ostinato spirit of kulintang.
// The same note data is mirrored in assets/audio/strings-bgm.mid for DAW use.
// ============================================================

export const BGM_BPM = 66;          // slow, wading tempo
export const BGM_LOOP_BEATS = 32;   // 8 bars of 4/4 (~29s per cycle)

const freq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

// Each note: t = start beat, f = frequency, d = duration in beats,
// v = velocity 0..1, voice = 'bell' (kulintang pot) | 'gong' (low agung).
// Pentatonic: A C D E G. Phrases end downward — the mournful shape.
export const BGM_SCORE = [
  // ---- low gongs: one strike per bar, i-v-i-VII | i-v-iv-i --------------
  { t: 0,  f: freq(45), d: 3.5, v: 0.7,  voice: 'gong' }, // A2
  { t: 4,  f: freq(40), d: 3.5, v: 0.6,  voice: 'gong' }, // E2
  { t: 8,  f: freq(45), d: 3.5, v: 0.65, voice: 'gong' }, // A2
  { t: 12, f: freq(43), d: 3.5, v: 0.6,  voice: 'gong' }, // G2
  { t: 16, f: freq(45), d: 3.5, v: 0.7,  voice: 'gong' }, // A2
  { t: 20, f: freq(40), d: 3.5, v: 0.6,  voice: 'gong' }, // E2
  { t: 24, f: freq(38), d: 3.5, v: 0.6,  voice: 'gong' }, // D2
  { t: 28, f: freq(45), d: 3.5, v: 0.65, voice: 'gong' }, // A2

  // ---- bells, bars 1-4: call and a falling answer -----------------------
  { t: 0,   f: freq(69), d: 1.5, v: 0.7,  voice: 'bell' }, // A4
  { t: 1.5, f: freq(67), d: 0.5, v: 0.55, voice: 'bell' }, // G4
  { t: 2,   f: freq(64), d: 2,   v: 0.6,  voice: 'bell' }, // E4
  { t: 4,   f: freq(72), d: 1,   v: 0.7,  voice: 'bell' }, // C5
  { t: 5,   f: freq(69), d: 1,   v: 0.6,  voice: 'bell' }, // A4
  { t: 6,   f: freq(67), d: 2,   v: 0.6,  voice: 'bell' }, // G4
  { t: 8,   f: freq(64), d: 1,   v: 0.6,  voice: 'bell' }, // E4
  { t: 9,   f: freq(62), d: 1,   v: 0.55, voice: 'bell' }, // D4
  { t: 10,  f: freq(60), d: 2,   v: 0.6,  voice: 'bell' }, // C4
  { t: 12,  f: freq(57), d: 3,   v: 0.5,  voice: 'bell' }, // A3 (sink + rest)

  // ---- bells, bars 5-8: the reach upward, then the long resolve ---------
  { t: 16,   f: freq(69), d: 1,   v: 0.7,  voice: 'bell' }, // A4
  { t: 17,   f: freq(72), d: 1,   v: 0.7,  voice: 'bell' }, // C5
  { t: 18,   f: freq(76), d: 1.5, v: 0.75, voice: 'bell' }, // E5 (peak)
  { t: 19.5, f: freq(72), d: 0.5, v: 0.6,  voice: 'bell' }, // C5
  { t: 20,   f: freq(69), d: 1,   v: 0.65, voice: 'bell' }, // A4
  { t: 21,   f: freq(67), d: 1,   v: 0.6,  voice: 'bell' }, // G4
  { t: 22,   f: freq(64), d: 2,   v: 0.6,  voice: 'bell' }, // E4
  { t: 24,   f: freq(62), d: 1,   v: 0.6,  voice: 'bell' }, // D4
  { t: 25,   f: freq(64), d: 1,   v: 0.6,  voice: 'bell' }, // E4 (leaning turn)
  { t: 26,   f: freq(60), d: 2,   v: 0.6,  voice: 'bell' }, // C4
  { t: 28,   f: freq(57), d: 3.5, v: 0.55, voice: 'bell' }, // A3 (home)
];
