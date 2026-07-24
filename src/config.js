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
  DEBUG_GUARDIAN_ZONE_BUTTON: true, // true → show the title shortcut to the Guardian showroom
};

// Replace this reserved example URL with the deployed City-Wide Portal endpoint.
// Artifact collection remains local when this placeholder cannot be reached.
export const ARTIFACT_API = {
  COLLECTION_URL: 'https://api.example.com/artifacts/collect',
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
    {
      start: 0.4, end: 5.0,
      en: 'When memory is carried home, the waters loosen their hold.',
      fil: 'Kapag naiuwi ang alaala, bumibitaw ang pagkakahawak ng tubig.'
    },
    {
      start: 5.0, end: 11.0,
      en: 'The food of Pangasinan returns to tables, streets, and living hands.',
      fil: 'Nagbabalik sa hapag, lansangan, at buhay na kamay ang pagkaing Pangasinense.'
    },
    {
      start: 11.0, end: 17.5,
      en: 'Drums answer the morning. Festivals gather every scattered voice.',
      fil: 'Sumasagot ang mga tambol sa umaga. Muling nagtitipon ang bawat tinig.'
    },
    {
      start: 17.5, end: 24.0,
      en: 'Landmarks stand beneath a clear sky, holding faith and homecoming.',
      fil: 'Nakatindig sa maaliwalas na langit ang mga pook ng pananampalataya at pag-uwi.'
    },
    {
      start: 24.0, end: 29.0,
      en: 'The Strings fade, but what they joined will not be forgotten.',
      fil: 'Naglalaho ang mga Hibla, ngunit hindi malilimutan ang kanilang pinag-ugnay.'
    },
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
  ALAB: {
    KILL_GAIN: 0.10,
    HIT_GAIN: 0.01,
    FULL_DURATION: 3,
    SHOTS_PER_SECOND: 8,
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
  SPAWN_TELEGRAPH: 1.4,       // woven-thread tear that opens before any arena enemy arrives
  // How the body comes through the tear: it is built DEPTH metres below its
  // final spot and rises over TIME, overlapping FADE_IN so the arrival reads as
  // caused by the rift instead of a fade-in beside it.
  EMERGE: { DEPTH: 1.1, TIME: 0.35 },
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
    HIT_NUDGE: 0.25,          // metres a non-lethal bolt shoves an echo back
  },
};

// Shared combat VFX (src/core/combat/CombatVfx.js). Two pre-allocated instanced
// pools — expanding rings and tumbling shards — carry every spawn/impact/death
// beat in all three arenas. Pooled and additive by design: no dynamic lights,
// no per-frame allocation. Sizes are the hard ceiling; when a pool is full the
// oldest slot is recycled rather than growing.
export const VFX = {
  RING_POOL: 16,
  SHARD_POOL: 40,
  SHARDS_PER_BURST: 6,
  WISPS_PER_DEATH: 5,         // upward gravity-free motes left by a kill
  RESIDUE_LIFE: 1.6,          // seconds the water ripple lingers after a death
  // Woven-thread tear (src/core/combat/ThreadTear.js) — the spawn portal. Every
  // strand of every pooled tear lives in ONE LineSegments2, so the whole pool
  // costs one draw call plus one for the seam. POOL is the hard ceiling; the
  // oldest tear is recycled when a wave needs more.
  TEAR: {
    POOL: 6,
    STRANDS: 4,               // fishing lines peeled off each side of the seam
    SAMPLES: 14,              // points per strand (SAMPLES-1 segments)
    HEIGHT: 2.2,              // seam height (m) at full unzip
    WIDTH: 0.9,               // how far the strands bow away from the seam (m)
    LINEWIDTH: 2.6,           // strand thickness at peak strain (px, fat lines)
    CLOSE_TIME: 0.3,          // recoil-and-fade once the body is through
  },
};

// Combat HUD (src/ui/CombatHud.js) — pooled DOM overlays. Element counts are
// fixed at construction so a busy wave never creates nodes mid-fight.
export const HUD = {
  DMG_ARCS: 6,                // directional damage indicators in flight
  DMG_ARC_LIFE: 0.9,          // seconds an arc takes to fade out
  THREAT_MARKERS: 8,          // off-screen echo markers
  THREAT_INTERVAL: 0.05,      // seconds between marker refreshes (~20 Hz)
  THREAT_MARGIN: 0.4,        // pull off-screen arrows inward, nearer the crosshair
  HEALTH_LAG: 1.1,            // ghost-fill drain rate, fraction of the bar per second
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
  // Wave-gated pacing: the encounter is a fixed 10-wave run, and clearing one of
  // the RIDDLE_WAVES opens a bugtong round that HOLDS the wave clock until it is
  // answered. Structure, not a wall clock — the player can see the end coming.
  TOTAL_WAVES: 10,
  RIDDLE_WAVES: [3, 6, 10],
  NODE_DIST: 8,             // answer-node ring radius around the center
  // Pull the whole fan toward the player so the center choice stays visibly
  // outside the guardian's full-body shield without compressing label spacing.
  NODE_FORWARD_OFFSET: 3,
  NODE_HEIGHT: 1.7,         // answer-node height above water (shootable at aim height)
  NODE_RADIUS: 0.85,        // answer-node bolt hit radius
  NODE_ANGLE: Math.PI / 5,  // angular spread between the three nodes (fan in front)
  NODE_DELAY: 3,            // seconds after the riddle appears before the choices spawn
  PENALTY_CHASERS: 2,       // Starved Fishers spawned on a wrong answer
  PENALTY_SPITTERS: 1,      // the lockout squad has to be a real threat, not a speed bump
  COLLAPSE: 1.4,            // victory flash/collapse beat before returning
  // The final boss phase is NOT tuned here: each zone's boss is an ArenaBoss
  // subclass owning its own numbers beside its own mechanics
  // (arena/ArenaBoss.js, arena/FeastkeeperBoss.js).
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
  RIDDLE_TIMES: [20, 55, 90],
  PROMPT_DELAY: 3,
  CHOICE_READ_DELAY: 3,
  LANTERN_STAGE_TRAVEL: 1,
  LANTERN_LINEUP_GAP: 4.5,
  LANTERN_FLIGHT: 6,
  LANTERN_RADIUS: 0.78,
  WRONG_DAMAGE: 18,
  MISS_DAMAGE: 25,
  RETRY_DELAY: 3,
  RIDDLE_THREAT_SCALE: 0.65,
  ZEPHYR_THREAT_SCALE: 0.55,
  SPAWN_INTERVAL: [3, 5],
  EMPTY_SPAWN_DELAY: 0.5,
  POST_RIDDLE_SPAWN_DELAY: 1,
  MAX_THREATS: 8,
  RIVER_X_LIMIT: 6.5,
  SPAWN_MIN_SEPARATION: 2.2,
  SNIPER_Z_RANGE: [-24, -18],
  BOARDER_Z_RANGE: [-31, -26],
  SNIPER: {
    HP: 2, RADIUS: 0.62, SHOT_INTERVAL: 1.8, SHOT_SPEED: 11, DAMAGE: 10,
  },
  BOARDER: {
    HP: 2, RADIUS: 0.58, SPEED: 4.2, TELEGRAPH: 0.8,
    DAMAGE: 14, ATTACK_INTERVAL: 1.25,
  },
};

// Zone 3 tower ascent. Walking uphill gains roughly 0.23 m/s at the base
// movement speed, so a 0.16 m/s tide rewards steady traversal while still
// allowing short landing turns and one recoverable hesitation.
export const TOWER_ARENA = {
  BASE_WATER_HEIGHT: CONFIG.WATER_LEVEL,
  SUMMIT_HEIGHT: 18,
  GRACE_DURATION: 8,
  RISE_SPEED: 0.16,
  MAX_WATER_HEIGHT: 19.5,
  WARNING_CLEARANCE: 2.5,
  CRITICAL_CLEARANCE: 0.85,
  DROWN_CLEARANCE: 0.12,
  BOSS_WATER_HEIGHT: 15,
  MAX_THREATS: 6,
  MAX_GALES: 2,
  GARGOYLE: {
    HP: 4,
    DAMAGE: 18,
    KNOCKBACK: 5.2,
    RADIUS: 0.55,
    ATTACK_RANGE: 2.05,
    TELEGRAPH: 0.6,
    ATTACK_INTERVAL: 1.4,
  },
  GALE: {
    HP: 2,
    DAMAGE: 10,
    SHOT_INTERVAL: 2.8,
    SHOT_TELEGRAPH: 0.45,
    SHOT_SPEED: 9,
    KNOCKBACK: 3.6,
    RADIUS: 0.42,
    INITIAL_SPAWN: [7, 10],
    SPAWN_INTERVAL: [6, 10],
    CENTER_RADIUS: 4.5,
    CENTER_MIN_RADIUS: 1.5,
    SPAWN_SEPARATION: 2,
    HEIGHT_FOLLOW: 5,
  },
  GATE_HEIGHTS: [6, 12, 18],
  GATE_CHOICE_GAP: 3.8,
  WRONG_SLOW: 0.55,
  WRONG_SLOW_TIME: 4,
  VERTICAL_LUMINA_BAND: 1.5,
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
  OVERCHARGE_DURATION: 10,
  OVERCHARGE_DAMAGE_MULT: 2,
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
