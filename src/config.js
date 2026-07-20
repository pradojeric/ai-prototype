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
  DEBUG_ZONE: false,       // true → force the small debug arena instead of zone1/2/3
  DEBUG_UNLOCK_ALL_ZONES: true, // true → all 3 museum portals start unlocked (walk the hub into
  // zone1/2/3 in any order); each zone's guardian gate is untouched.
  // Independent of DEBUG_ZONE — leave that false to actually see them.
  DEBUG_TEST_ENDING_BUTTON: true, // true → show a title-menu shortcut for the full final cutscene
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

// Final sequence — portal pull, completed-museum reveal, and restored province.
// The restored timeline is also the timing contract for the optional narration
// asset at assets/audio/ending-voiceover.mp3.
export const ENDING = {
  // Set to './assets/audio/ending-voiceover.mp3' when the recorded narration is
  // supplied. Null keeps the subtitle-led fallback silent and avoids a 404.
  VOICEOVER_URL: null,
  PORTAL: {
    APPEAR: 2.6,
    TURN: 2.2,
    PULL: 4.6,
    DISTANCE: 6.5,
    RADIUS: 2.35,
  },
  MUSEUM_DURATION: 13.5,
  RESTORED_DURATION: 31,
  SUBTITLES: [
    { start: 0.4, end: 5.0,
      en: 'When memory is carried home, the waters loosen their hold.',
      fil: 'Kapag naiuwi ang alaala, bumibitaw ang pagkakahawak ng tubig.' },
    { start: 5.0, end: 11.0,
      en: 'The food of Pangasinan returns to tables, streets, and living hands.',
      fil: 'Nagbabalik sa hapag, lansangan, at buhay na kamay ang pagkaing Pangasinense.' },
    { start: 11.0, end: 17.5,
      en: 'Drums answer the morning. Festivals gather every scattered voice.',
      fil: 'Sumasagot ang mga tambol sa umaga. Muling nagtitipon ang bawat tinig.' },
    { start: 17.5, end: 24.0,
      en: 'Landmarks stand beneath a clear sky, holding faith and homecoming.',
      fil: 'Nakatindig sa maaliwalas na langit ang mga pook ng pananampalataya at pag-uwi.' },
    { start: 24.0, end: 29.0,
      en: 'The Strings fade, but what they joined will not be forgotten.',
      fil: 'Naglalaho ang mga Hibla, ngunit hindi malilimutan ang kanilang pinag-ugnay.' },
  ],
  // The gameplay bloom (0.8 / 0.6 / 0.2) is tuned for the dark underwater
  // world; the bright ending scenes push everything over that low threshold
  // and wash out. These gentler values apply for the whole ending sequence so
  // only true emitters (string beads, portal core) bloom.
  BLOOM: {
    STRENGTH: 0.4,
    RADIUS: 0.45,
    THRESHOLD: 0.85,
  },
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
  // Side-wing galleries off the ±X walls (Zone 2 = -X, Zone 3 = +X). Each wing
  // is a rectangular room entered through a doorway cut into the main room wall.
  WING: {
    DOOR_HALF: 1.2,        // half-width of the wing doorway (geometry + collision)
    DOOR_Z: 2.0,           // doorway center Z on the ±X walls
    LEN: 12,               // wing depth outward from the main-room wall (x extent)
    HALF_W: 3.5,           // wing half-width (z extent about DOOR_Z)
  },
  SLOTS_PER_ZONE: 12,      // pre-built frame slots per zone section (main room + each wing)
  SOUL_ALTAR: {
    X: 0,
    Z: 0,
    RADIUS: 1.58,
    ACTIVATE_RANGE: 2.7,
  },
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

// Artifact scatter (post-arena return): every still-uncollected artifact bursts
// from the return origin and arcs out to spread-out landing points.
export const ARTIFACT_MIN_SEP = 14;   // min distance between two landed artifacts
export const SCATTER_DURATION = 1.3;  // seconds of flight from origin to landing
export const SCATTER_ARC_HEIGHT = 4;  // apex height added to the flight arc

// Artifact "Echo" — a spatialized audio locator that reaches farther than the
// string, so players home in on a buried artifact by ear before it's visible.
export const ECHO = {
  RANGE: 28,           // hard silence beyond this (string only fades in by ~13m)
  FADE: 8,             // fade-out band width just inside RANGE (20m..28m -> 1..0)
  REF_DIST: 4,         // distance of full volume; rolls off past this
  PING_INTERVAL: 2.6,  // seconds between pings (sonar cadence)
  GAIN: 0.18,          // peak per-echo volume
};
export const MUSIC_SWELL_RANGE = 24; // melodic layer ramps in within this of nearest echo

// Player collision radius (circle-vs-AABB).
export const PLAYER_RADIUS = 0.45;

// Wave combat — post-defeat, each scattered artifact is "contested": holding E
// on it interrupts the reach and spawns waves of drowned echoes around it.
// Clearing every wave frees that artifact for normal collection (per visit).
export const COMBAT = {
  PLAYER_HP: 100,
  HEAL_ON_CLEAR: 25,          // hp restored when a fight is won
  // Player light-bolt: cast from the hand's lure with left click.
  BOLT: {
    SPEED: 38, RADIUS: 0.18, LIFE: 1.2, COOLDOWN: 0.22, DAMAGE: 1,
    COLOR: 0x7fe8ff, SIZE: 0.09,
  },
  // Melee chaser: speed sits between wade (2.6) and sprint (~4.7) so kiting
  // costs stamina — sprint escapes, walking gets caught.
  CHASER: {
    HP: 2, SPEED: 3.2, RADIUS: 0.5, DAMAGE: 15,
    ATTACK_RANGE: 1.4, ATTACK_COOLDOWN: 1.1, HOVER: 0.9,
  },
  // Ranged spitter: keeps distance and lobs slow, dodgeable spits.
  SPITTER: {
    HP: 3, SPEED: 2.1, RADIUS: 0.55, DAMAGE: 10,
    PREFERRED_RANGE: 9, SPIT_INTERVAL: 2.4, SPIT_SPEED: 9,
    SPIT_COLOR: 0xff9a5a, HOVER: 1.5,
  },
  // Escalation teaches one concept per wave: chasers first, then a spitter,
  // then combinations. Zone bonuses add pressure without new rules.
  WAVES: [
    { chasers: 2, spitters: 0 },
    { chasers: 2, spitters: 1 },
    { chasers: 3, spitters: 1 },
    { chasers: 2, spitters: 2 },
  ],
  ZONE_BONUS: { zone1: 0, zone2: 1, zone3: 1 },     // extra chasers per wave
  ZONE_HP_BONUS: { zone1: 0, zone2: 0, zone3: 1 },  // extra hp per enemy
  WAVE_GAP: 1.6,              // breather between cleared wave and the next
  FADE_IN: 0.5,               // enemies can't act until fully faded in
  SPIT_WINDUP: 0.4,           // spitter glow telegraph before each spit
  SPAWN_RADIUS_MIN: 7,        // spawn ring around the contested artifact
  SPAWN_RADIUS_MAX: 12,
  SPAWN_MIN_PLAYER_DIST: 5,
  POOL_BOLTS: 16,
  POOL_SPITS: 24,
  LEASH_RADIUS: 24,           // walk this far from the artifact → fight resets
  HURT_FLASH: 0.25,           // seconds the red vignette holds
  // Pathfinding: a per-zone walkability grid + BFS flow field toward the
  // player; enemies follow the flow only when they lack line of sight.
  NAV: {
    CELL: 1.0,                // grid resolution (m); 96×96 cells per zone
    BAKE_RADIUS: 0.7,         // clearance tested per cell (enemy r + margin)
    FLOW_INTERVAL: 0.4,       // seconds between BFS flow rebuilds mid-fight
    LOS_STEP: 0.6,            // sampling stride for line-of-sight checks (m)
    LOS_INTERVAL: 0.25,       // per-enemy LOS re-check cadence (staggered)
  },
  // Game-feel magnitudes (hit flash / kill hitstop / player-hit FOV punch).
  FEEL: {
    HITSTOP: 0.05, HITSTOP_SCALE: 0.1, FOV_PUNCH: 5,
    FLASH_DECAY: 0.2, SFX_PITCH_VAR: 0.06,
  },
};

// Memory Arena (Strings v2.0) — the instanced combat space entered from a main
// zone's Memory Rift. The Guardian is an active threat here: waves of drowned
// echoes attack while the player answers the guardian's bugtong by SHOOTING one
// of three answer nodes. Each correct answer strips one armor layer; when armor
// is gone the guardian falls and the arena collapses (back to the main zone).
export const ARENA = {
  WALL_RADIUS: 26,          // circular wall ring enclosing the play space
  CENTER: { x: 0, z: 0 },   // player spawn + wave/riddle origin
  ROUNDS: RIDDLE_COUNT,     // riddle rounds = guardian armor layers to break
  RIDDLE_FIRST: 6,          // seconds of pure survival before the first riddle
  RIDDLE_CADENCE: 16,       // seconds between riddle rounds (if none is active)
  NODE_DIST: 8,             // answer-node ring radius around the center
  NODE_HEIGHT: 1.7,         // answer-node height above water (shootable at aim height)
  NODE_RADIUS: 0.85,        // answer-node bolt hit radius
  NODE_ANGLE: Math.PI / 5,  // angular spread between the three nodes (fan in front)
  NODE_DELAY: 3,            // seconds after the riddle appears before the choices spawn
  PENALTY_CHASERS: 2,       // Starved Fishers spawned on a wrong answer
  COLLAPSE: 1.4,            // victory flash/collapse beat before returning
};

// Zone 2's stationary-boat rail encounter. World-space travel is an illusion:
// the boat stays at CENTER while recyclable festival scenery moves toward it.
export const RAIL_ARENA = {
  CENTER: { x: 0, z: 0 },
  BOAT_EYE_BASE: 0.55,
  CHUNK_COUNT: 6,
  CHUNK_LENGTH: 18,
  SCROLL_SPEED: 5.4,
  LAYER_SPEED: { near: 1.2, mid: 1.0, far: 0.55 },
  CAMERA_BOB: 0.08,
  CAMERA_ROLL: 0.018,
  ROUNDS: RIDDLE_COUNT,
  FIRST_RIDDLE: 25,
  RIDDLE_CADENCE: 55,
  PROMPT_DELAY: 3,
  LANTERN_STAGGER: 0.75,
  LANTERN_FLIGHT: 6,
  LANTERN_RADIUS: 0.78,
  WRONG_DAMAGE: 18,
  MISS_DAMAGE: 25,
  RETRY_DELAY: 3,
  RIDDLE_THREAT_SCALE: 0.65,
  ZEPHYR_THREAT_SCALE: 0.55,
  WAVE_INTERVAL: 10,
  MAX_THREATS: 6,
  WAVES: [
    { snipers: 1, boarders: 1 },
    { snipers: 2, boarders: 1 },
    { snipers: 1, boarders: 2 },
    { snipers: 2, boarders: 2 },
  ],
  SNIPER: {
    HP: 2, RADIUS: 0.62, SHOT_INTERVAL: 1.8, SHOT_SPEED: 11, DAMAGE: 10,
  },
  BOARDER: {
    HP: 2, RADIUS: 0.58, SPEED: 4.2, TELEGRAPH: 0.8,
    DAMAGE: 14, ATTACK_INTERVAL: 1.25,
  },
};

// Memory Lumina — short-lived arena drops from lesser echoes. Visuals are
// pooled and additive (no per-orb lights); gameplay randomness uses a seeded
// stream reset for each arena attempt.
export const LUMINA = {
  POOL_SIZE: 16,
  DROP_CHANCE: 0.30,
  PENALTY_DROP_MULT: 0.5,
  LIFETIME: 12,
  ORB_RADIUS: 0.3,
  WALK_RADIUS: 1.15,
  BOLT_RADIUS: 0.42,
  HEIGHT: 1.05,
  BOB_HEIGHT: 0.18,
  BOB_SPEED: 2.4,
  COLLECT_TIME: 0.28,
  HEAL: COMBAT.HEAL_ON_CLEAR,
  ZEPHYR_DURATION: 8,
  ZEPHYR_SPEED_MULT: 2.2,
  OVERCHARGE_DURATION: 5,
  OVERCHARGE_SHOTS_PER_SECOND: 8,
  COLORS: {
    vitality: 0x62ef8a,
    zephyr: 0x63b9ff,
    overcharge: 0xffcf54,
  },
  SEED: 0x4c554d49,
};

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

// Fisher–Yates shuffle driven by a seeded `rng` (from mulberry32). Mutates
// and returns `arr` — pass a copy if the caller needs the original order kept.
export function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
