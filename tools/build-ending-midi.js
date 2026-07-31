// ============================================================
// ENDING THEME — generates assets/audio/ending-theme.mid
//
// A through-composed ~70s cue timed to Game._runEnding, including the black
// holds between its beats (those are dead screen time, but they are not dead
// musical time — the cue sustains across them):
//
//   beat  0.0  A  PORTAL PULL       9.40s  ENDING.PORTAL (APPEAR+TURN+PULL)
//   beat 10.0     hold (2/4)        1.86s  impact flash + wait(420)+wait(1450)
//   beat 12.0  B  MUSEUM TOUR      26.00s  ENDING.MUSEUM_DURATION
//   beat 40.0     hold (3/8)        1.45s  wait(1450)
//   beat 41.5  C  RESTORED PROV.   31.02s  ENDING.RESTORED_DURATION
//   beat 73.5     end              69.73s
//
// Each section carries its own tempo so the barlines land on the cutscene
// cuts instead of near them, and every tempo change is hidden under a hold
// where nothing attacks. The slight ritard into C broadens the finale.
//
// Harmony walks A minor pentatonic (the BGM_SCORE language) through an E
// major pivot — sustained across the last hold — into A major pentatonic,
// resolving on the frame the Restored Province appears.
// ============================================================

import { writeFileSync } from 'node:fs';

const TPQ = 480;
const bpmToUs = (bpm) => Math.round(60000000 / bpm);

// Section downbeats in beats. B and C double as offsets below, so the
// per-section music reads section-relative (B + 4 is "bar 2 of the tour").
const HOLD1 = 10, B = 12, HOLD2 = 40, C = 41.5, END = 73.5;
const TEMPO_A = bpmToUs(63.8);   // 10 beats = 9.40s
const TEMPO_B = bpmToUs(64.6);   // 2-beat hold + 28 beats = 1.86s + 26.00s
const TEMPO_C = bpmToUs(61.9);   // 1.5-beat hold + 32 beats = 1.45s + 31.02s

// ---- byte helpers -----------------------------------------------------
const vlq = (n) => {
  const out = [n & 0x7f];
  n >>= 7;
  while (n > 0) { out.unshift((n & 0x7f) | 0x80); n >>= 7; }
  return out;
};
const str = (s) => [...Buffer.from(s, 'utf8')];   // marker text is UTF-8, not one byte per char
const u32 = (n) => [(n >> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255];

// An event is { tick, order, bytes } — order breaks ties so note-offs fire
// before note-ons at the same tick and meta events lead the bar.
const meta = (tick, order, type, data) => ({ tick, order, bytes: [0xff, type, ...vlq(data.length), ...data] });
const marker = (tick, text) => meta(tick, 0, 0x06, str(text));
const tempo = (tick, us) => meta(tick, 0, 0x51, [(us >> 16) & 255, (us >> 8) & 255, us & 255]);
const timeSig = (tick, num, denPow) => meta(tick, 0, 0x58, [num, denPow, 24, 8]);
const trackName = (text) => meta(0, 0, 0x03, str(text));

const beats = (b) => Math.round(b * TPQ);

// ---- track builder ----------------------------------------------------
class Track {
  constructor(name, channel, program) {
    this.events = [trackName(name)];
    this.ch = channel;
    if (program != null) this.events.push({ tick: 0, order: 1, bytes: [0xc0 | channel, program] });
  }
  // t/d in beats, v 0..127
  note(t, pitch, d, v) {
    const on = beats(t), off = beats(t + d);
    this.events.push({ tick: on, order: 3, bytes: [0x90 | this.ch, pitch, v] });
    this.events.push({ tick: off, order: 2, bytes: [0x80 | this.ch, pitch, 0] });
    return this;
  }
  chord(t, pitches, d, v) { pitches.forEach((p) => this.note(t, p, d, v)); return this; }
  bytes() {
    const evts = [...this.events].sort((a, b) => a.tick - b.tick || a.order - b.order);
    const out = [];
    let last = 0;
    for (const e of evts) { out.push(...vlq(e.tick - last), ...e.bytes); last = e.tick; }
    out.push(...vlq(0), 0xff, 0x2f, 0x00);
    return [...str('MTrk'), ...u32(out.length), ...out];
  }
}

// ---- 0: conductor -----------------------------------------------------
const conductor = new Track('Strings — Ending Theme');
conductor.events.push(
  tempo(0, TEMPO_A), timeSig(0, 4, 2), marker(0, 'A · PORTAL PULL'),
  timeSig(beats(8), 2, 2),                          // 2/4 bar closes the pull on the cut
  tempo(beats(HOLD1), TEMPO_B), marker(beats(HOLD1), 'impact · black hold'),
  timeSig(beats(B), 4, 2), marker(beats(B), 'B · MUSEUM TOUR'),
  marker(beats(B + 24), 'pivot · E major (leading tone)'),
  tempo(beats(HOLD2), TEMPO_C), timeSig(beats(HOLD2), 3, 3), marker(beats(HOLD2), 'black hold · E sustains'),
  timeSig(beats(C), 4, 2), marker(beats(C), 'C · RESTORED PROVINCE (A major)'),
  marker(beats(C + 11.35), 'sub · "Drums answer the morning"'),
  marker(beats(C + 18.06), 'sub · "Festivals gather every scattered voice"'),
  marker(beats(C + 24.76), 'sub · "The Strings fade"'),
  meta(beats(END), 1, 0x06, str('END')),
);

// ---- 1: kulintang (bell voice) ---------------------------------------
const bell = new Track('Kulintang (bell)', 0, 113);      // GM 114 Steel Drums ≈ gong-chime
// A — sparse, the last light of the drowned world
bell.note(2, 69, 2, 64).note(4.5, 67, 1, 55).note(6, 64, 2, 52).note(9, 69, 1, 42);
// B — the mournful call-and-fall from BGM_SCORE, carried into the galleries
bell.note(B + 0, 69, 1.5, 78).note(B + 1.5, 67, 0.5, 60).note(B + 2, 64, 2, 66);
bell.note(B + 4, 72, 1, 78).note(B + 5, 69, 1, 66).note(B + 6, 67, 2, 66);
bell.note(B + 8, 64, 1, 66).note(B + 9, 62, 1, 60).note(B + 10, 60, 2, 64);
bell.note(B + 12, 57, 3, 54);
bell.note(B + 16, 69, 1, 76).note(B + 17, 72, 1, 78).note(B + 18, 76, 1.5, 84).note(B + 19.5, 72, 0.5, 64);
bell.note(B + 20, 69, 1, 70).note(B + 21, 67, 1, 64).note(B + 22, 64, 2, 62);
bell.note(B + 24, 71, 1, 70).note(B + 25, 73, 1, 78).note(B + 26, 76, 2, 82);   // C# arrives — the lift
// C — A major pentatonic, the province above water
bell.note(C + 0, 69, 1, 74).note(C + 1, 73, 1, 76).note(C + 2, 76, 2, 78);
bell.note(C + 4, 78, 1, 80).note(C + 5, 76, 1, 74).note(C + 6, 73, 2, 72);
bell.note(C + 8, 71, 1, 76).note(C + 9, 73, 1, 78).note(C + 10, 76, 1, 82).note(C + 11, 78, 1, 86);
bell.note(C + 12, 76, 2, 88).note(C + 14, 73, 2, 82);
bell.note(C + 16, 81, 1, 100).note(C + 17, 78, 1, 92).note(C + 18, 76, 1, 94).note(C + 19, 73, 1, 88);
bell.note(C + 20, 76, 1, 92).note(C + 21, 78, 1, 96).note(C + 22, 81, 2, 100);
bell.note(C + 24, 78, 1.5, 72).note(C + 25.5, 76, 0.5, 60).note(C + 26, 73, 2, 64);
bell.note(C + 28, 71, 1, 58).note(C + 29, 69, 3, 62);                            // home

// ---- 2: agung (gong voice) -------------------------------------------
const gong = new Track('Agung (gong)', 1, 115);          // GM 116 Taiko Drum
gong.note(0, 33, 5, 96).note(6, 40, 3, 74).note(8, 45, 2, 86);
gong.note(HOLD1, 33, 2, 108);                             // the portal impact, ringing into black
[[0, 45], [4, 40], [8, 45], [12, 43], [16, 45], [20, 38], [24, 40]]
  .forEach(([t, p]) => gong.note(B + t, p, 3.5, 84));
[[0, 45], [4, 45], [8, 38], [12, 40], [16, 45], [20, 45], [24, 38]]
  .forEach(([t, p], i) => gong.note(C + t, p, 3.5, i === 4 ? 104 : 86));
gong.note(C + 28, 33, 4, 110);                            // the last strike

// ---- 3: strings pad ---------------------------------------------------
const strings = new Track('Strings pad', 2, 48);         // GM 49 String Ensemble 1
strings.chord(0, [45, 52], 12, 44);                       // A/E drone, across the pull and the hold
strings.chord(B + 0, [57, 60, 64], 8, 52);                // Am
strings.chord(B + 8, [55, 59, 62], 4, 50);                // G
strings.chord(B + 12, [53, 57, 60], 4, 50);               // F
strings.chord(B + 16, [57, 60, 64], 8, 54);               // Am
strings.chord(B + 24, [52, 56, 59], 5.5, 60);             // E major — pivot, held through the hold
strings.chord(C + 0, [57, 61, 64], 8, 62);                // A major, on the cut
strings.chord(C + 8, [50, 54, 57], 4, 60);                // D
strings.chord(C + 12, [52, 56, 59], 4, 62);               // E
strings.chord(C + 16, [57, 61, 64, 69], 8, 78);           // A major, full
strings.chord(C + 24, [50, 54, 57], 4, 58);               // D
strings.chord(C + 28, [45, 57, 61, 64], 4, 66);           // A major, settling

// ---- 4: choir pad -----------------------------------------------------
const choir = new Track('Choir pad', 3, 52);             // GM 53 Choir Aahs
choir.note(B + 12, 69, 4, 40).note(B + 16, 72, 4, 46).note(B + 20, 69, 4, 46);
choir.note(B + 24, 71, 5.5, 54);                          // sustains across the hold with the strings
choir.note(C + 0, 69, 4, 56).note(C + 4, 73, 4, 58).note(C + 8, 71, 4, 56).note(C + 12, 76, 4, 62);
choir.chord(C + 16, [69, 73, 76], 8, 82);                 // "gather every scattered voice"
choir.note(C + 24, 66, 4, 54).note(C + 28, 69, 4, 48);

// ---- 5: dabakan (channel 10) -----------------------------------------
const drum = new Track('Dabakan', 9);
const LOW = 64, HI = 63, MUTE = 62;
// B — a slow heartbeat entering with the fifth bar, tightening into the pivot
[[16, 96], [17.5, 62], [20, 92], [21.5, 60], [24, 96], [25, 70], [26, 84], [27, 76]]
  .forEach(([t, v]) => drum.note(B + t, LOW, 0.25, v));
// C — light pulse, then the festival pattern from "Drums answer the morning"
[0, 2, 4, 6, 8, 10].forEach((t) => drum.note(C + t, LOW, 0.25, 70));
[9, 11].forEach((t) => drum.note(C + t, MUTE, 0.25, 52));
const festival = (bar, gain = 0) => {
  [[0, LOW, 104], [0.5, MUTE, 60], [1, HI, 84], [1.5, MUTE, 55],
   [2, LOW, 96], [2.5, MUTE, 60], [3, HI, 88], [3.5, MUTE, 55], [3.75, MUTE, 46]]
    .forEach(([o, k, v]) => drum.note(C + bar + o, k, 0.25, Math.min(127, v + gain)));
};
festival(12); festival(16, 12); festival(20, 8);
[24, 25.5, 26.5].forEach((t, i) => drum.note(C + t, LOW, 0.25, 70 - i * 14));   // thinning
drum.note(C + 28, LOW, 0.25, 88);                                               // one last beat

// ---- assemble ---------------------------------------------------------
const tracks = [conductor, bell, gong, strings, choir, drum];
const header = [...str('MThd'), ...u32(6), 0, 1, 0, tracks.length, (TPQ >> 8) & 255, TPQ & 255];
const bytes = Buffer.from([...header, ...tracks.flatMap((t) => t.bytes())]);

const out = process.argv[2] || 'assets/audio/ending-theme.mid';
writeFileSync(out, bytes);
console.log(`wrote ${out} — ${bytes.length} bytes, ${tracks.length} tracks`);
