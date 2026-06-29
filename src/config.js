// ============================================================
// CONFIG — shared tunables + small utilities
// ============================================================
import * as THREE from 'three';

export const CONFIG = {
  WATER_LEVEL: 0.4,        // surface height; player eye sits above (shallow knee-deep wade, seabed at -0.3)
  EYE_HEIGHT: 1.62,
  WADE_SPEED: 2.6,          // slow, deliberate
  SPRINT_MULT: 1.8,         // Shift = a moderate burst that keeps the heavy wade tone
  STAMINA_MAX: 1,           // stamina is tracked 0..1 (a normalized "tank")
  STAMINA_DRAIN: 1 / 6,     // units/sec while sprinting + moving → ~6s of full sprint
  STAMINA_REGEN: 1 / 9,     // units/sec recovered while not sprinting → ~9s to refill
  ZONE_HALF: 48,            // play area half-extent (~96×96 m)
  INTERACT_RANGE: 2.7,
  FOG_DENSITY: 0.03,        // lighter than before so the larger space reads
  TEAL: 0x2f6f6a,
  DOCK_TOP: 1.7,            // top surface of the raised spawn platform (above water)
  DEBUG_ZONE: true,       // true → force the small debug arena instead of zone1/2/3
};

// Intro cutscene — "waking in the digital museum" (scripted camera over the Museum).
// Beat durations in seconds; the camera path is interpolated across them.
export const CUTSCENE = {
  WAKE: 2.6,                // eyes-open: black overlay fades out, camera tilts up
  LOOK: 5.0,               // slow pan across the empty frames
  NOTICE: 2.4,             // turn toward the hallway; hall light ramps up
  MOVE: 3.4,               // drift forward into the hallway opening
  FADE: 1.6,               // white flash takes over
};

// Guardian-defeat cinematic (scripted camera over the live world): frame the
// whole guardian, blow it up, then tilt up to watch the artifacts scatter.
// LOOK_UP + SETTLE (2.6s) comfortably covers the SCATTER_DURATION (1.3s) flight
// that begins at the explosion moment.
export const CUTSCENE_DEFEAT = {
  FRAME: 1.8,         // ease back/up and hold the full-guardian hero shot
  LOOK_UP: 1.5,       // explosion: tilt up, follow the artifacts arcing out
  SETTLE: 1.1,        // ease the gaze back down before returning control
  BACK_DIST: 8,       // camera distance back from the guardian (XZ)
  RISE: 2.5,          // camera height above the guardian center
  LOOK_UP_HEIGHT: 3,  // gaze rises just to the artifacts' arc apex (~chest height), not a full crane
};

// Wrong-answer "faint" cinematic: the guardian rebukes the player, teleports
// away, then the player's vision droops + fades to black before waking at the
// dock. DROOP runs the scripted camera sink under the black fade (~0.8s CSS),
// BLACK_HOLD keeps the screen dark before the respawn snaps in.
export const FAINT = {
  SPEAK: 3,        // seconds the guardian's rebuke holds on screen
  DROOP: 0.9,        // camera sinks/tilts as vision goes (under the black fade)
  SINK: 1.2,         // how far the camera drops while fainting (world units)
  BLACK_HOLD: 1.0,   // unconscious in the dark before waking (user: ~1s)
};

// Zone-entry dialogue: per-zone lines shown one at a time as a subtitle right
// after the player clicks to descend (see Game._playZoneIntro / zone.introDialogue).
export const ZONE_INTRO = {
  LINE: 3.4,   // seconds each line holds on screen
  GAP: 0.45,   // seconds between lines (covers the fade out/in)
};

// Museum (reusable hub) layout + lighting. Warm hall light matches the
// artifact-glow amber so bloom reads consistently across scenes.
export const MUSEUM = {
  HALL_LIGHT_COLOR: 0xffe6b0,
  HALL_LIGHT_ON: 4,        // intensity once the light suddenly appears (off until then)
  LOCK_PORTAL_COLOR: 0x1a2730, // dim cold teal-grey for the two locked-zone portals
  ROOM_HALF: 10,           // half-extent of the gallery room (x/z) — large central square
  ROOM_HEIGHT: 4.2,
  DOOR_HALF: 1.5,          // half-width of each -Z doorway / hallway corridor (geometry + collision)
  PORTAL_X: [-5.5, 0, 5.5], // doorway center X offsets on the -Z wall (Zone 2 / Zone 1 / Zone 3)
  HALL_LEN: 5,             // hallway depth past the -Z wall to the portal panel
  EXIT_RADIUS: 1.4,        // walk within this of an unlocked portal's corridor end -> enter that zone
};

// Guardian encounter — a roaming "bantay" that gates the artifacts behind a
// 3-riddle (bugtong) challenge. It teleports between spots, marked by a tall
// glowing beacon; walking within ENCOUNTER_RANGE auto-starts the riddle.
export const GUARDIAN = {
  TELEPORT_INTERVAL: 20.0,   // seconds between roams while seeking (frozen during a riddle)
  ENCOUNTER_RANGE: 6,     // walk within this to auto-start the riddle
  MIN_PLAYER_DIST: 16,      // never teleport closer than this to the player
  FADE: 0.45,               // teleport / defeat fade duration (seconds)
  POOF_DEFEAT_POWER: 2.0,   // multiplies the puff (faster/larger/brighter) on defeat
  CORE_COLOR: 0x8fe6ff,     // spectral teal core + beacon
  BEACON_HEIGHT: 22,        // tall light column so it reads through the fog
  BEACON_COLOR: 0x7fe8ff,
};

// Riddle challenge: how many bugtong must be solved (drawn from the larger pool).
export const RIDDLE_COUNT = 3;

// Artifact scatter (post-defeat): artifacts burst from the guardian's spot and
// arc out to spread-out landing points.
export const ARTIFACT_MIN_SEP = 14;   // min distance between two landed artifacts
export const SCATTER_DURATION = 1.3;  // seconds of flight from origin to landing
export const SCATTER_ARC_HEIGHT = 4;  // apex height added to the flight arc

// Artifact "Echo" — a spatialized audio locator that reaches farther than the
// string, so players home in on a buried artifact by ear before it's visible.
export const ECHO = {
  RANGE: 28,           // max audible distance (string only fades in by ~13m)
  REF_DIST: 4,         // distance of full volume; rolls off past this
  PING_INTERVAL: 2.6,  // seconds between pings (sonar cadence)
  GAIN: 0.18,          // peak per-echo volume
};
export const MUSIC_SWELL_RANGE = 24; // melodic layer ramps in within this of nearest echo

// Player collision radius (circle-vs-AABB).
export const PLAYER_RADIUS = 0.45;

export const WORLD_UP = new THREE.Vector3(0, 1, 0);

export function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

export function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

// Small seeded PRNG for deterministic placement.
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
