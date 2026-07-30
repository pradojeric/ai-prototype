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
  // Combat-only hop (see PlayerController.setJumpEnabled). A short, heavy leap that
  // clears a ground shockwave and nothing else: peak = SPEED²/(2·GRAVITY) ≈ 0.80m,
  // airtime = 2·SPEED/GRAVITY ≈ 0.76s. Deliberately too low to reach any ledge —
  // collision still resolves against the *ground* height, so this is a dodge, not
  // a traversal tool.
  JUMP_SPEED: 4.2,
  JUMP_GRAVITY: 11,
  JUMP_STAMINA: 0.2,        // drawn from the same 0..1 sprint tank, so hopping isn't free
  ZONE_HALF: 48,            // play area half-extent (~96×96 m)
  INTERACT_RANGE: 2.7,
  FOG_DENSITY: 0.03,        // lighter than before so the larger space reads
  TEAL: 0x2f6f6a,
  DOCK_TOP: 1.7,            // top surface of the raised spawn platform (above water)
  DEBUG_ZONE: false,       // true → force the small debug arena instead of zone1/2/3
  DEBUG_UNLOCK_ALL_ZONES: true, // true → all 3 museum portals start unlocked (walk the hub into
  // zone1/2/3 in any order); each zone's guardian gate is untouched.
  // Independent of DEBUG_ZONE — leave that false to actually see them.
  DEBUG_SKIP_MUSEUM_BUTTON: true, // true → show the title shortcut into the walkable museum hub
  DEBUG_TEST_ENDING_BUTTON: true, // true → show a title-menu shortcut for the full final cutscene
  DEBUG_GUARDIAN_ZONE_BUTTON: false, // true → show the title shortcut to the Guardian showroom
};

// PRESENTER SKIP — the hidden "magic key" for live demos in front of a crowd.
// One context-aware press fast-forwards whatever long beat is on screen (a boss
// fight, a riddle round, a cutscene, the artifact/Soul collection pass) while
// still awarding everything the honest playthrough would have: the guardian's
// implode, the recovered memories, the Soul, the zone-complete card, the next
// museum portal. See src/core/_partials/PresenterSkip.js.
// ENABLED is read at press time, so it can be flipped from the console mid-demo.
export const PRESENTER = {
  ENABLED: true,
  KEY: 'KeyP',      // KeyboardEvent.code
  SHIFT: true,      // require Shift so a stray P during play does nothing
  COOLDOWN: 0.5,    // seconds between accepted presses (a held key can't chain)
};

// Gameplay (in-zone) bloom. The zones' own glow is all additive emissive geometry —
// string beads, lantern cores, god-ray shafts, the parul star — and those sit well
// above this threshold, so raising it clips the bloom off ordinary lit surfaces
// without dimming a single real emitter.
//
// Was 0.8 / 0.6 / 0.2 hardcoded in _partials/GameRendering.js. That 0.2 threshold
// meant almost every surface bloomed, which only got brighter once the zones gained
// albedo textures (a texture map lifts mid-tones that flat dark colours never
// reached). Museum uses 0.35/0.5/0.5 and the ending 0.4/0.45/0.85 for comparison.
// Tuning guide if this still needs adjusting:
//   THRESHOLD ↑ = fewer things glow at all (kills the washed-out haze)
//   STRENGTH  ↓ = the things that do glow, glow less intensely
// Raise THRESHOLD first; drop STRENGTH only if the emitters themselves are too hot.
export const BLOOM = {
  STRENGTH: 0.55,          // was 0.8
  RADIUS: 0.55,
  THRESHOLD: 0.45,         // was 0.2 — the main fix for the over-bright zones
};

// Browser-authorized GameOn Portal session. The real portal origin is safe to
// check in; the assigned Game ID is not yet available, so its placeholder keeps
// the account UI inert and prevents popup/network activity until deployment.
export const PLATFORM_API = {
  BASE_URL: 'https://gameonportal.ph',
  GAME_ID: '6cccca09-093a-428e-885b-12b01110422e',
  POLL_INTERVAL_MS: 3000,
  STORAGE_KEYS: {
    sessionToken: 'strings.platformSessionToken',
    pendingUnlock: 'strings.platformPendingUnlock',
  },
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
  // The museum tour walks the camera into all three gallery rings, not just past
  // the lobby walls, so it needs roughly twice the old fly-by's length. Independent
  // of SUBTITLES below — those are keyed to RESTORED_DURATION (see RestoredProvince).
  MUSEUM_DURATION: 26,
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
  // The gameplay bloom (see the BLOOM block) is tuned for the dark underwater
  // world; the bright ending scenes push everything over its threshold and wash
  // out. These gentler values apply for the whole ending sequence so only true
  // emitters (string beads, portal core) bloom.
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
  // Half-extent of the LOBBY (x/z). The lobby is a crossroads, not an exhibition
  // space — the artifacts all live in the galleries now — so it is deliberately
  // tighter than the rooms it serves. Everything else here is derived from it
  // (spawn point, hallway anchor, both cutscenes), so this is the one dial.
  ROOM_HALF: 8,
  ROOM_HEIGHT: 4.2,
  DOOR_HALF: 1.5,          // half-width of each -Z doorway / hallway corridor (geometry + collision)
  // Doorway center X offsets on the -Z wall (Zone 2 / Zone 1 / Zone 3). Pulled in
  // with the lobby so the outer two keep a full wall panel to their corner
  // (|x| + DOOR_HALF = 6.3 against ROOM_HALF 8) instead of nearly touching it.
  PORTAL_X: [-4.8, 0, 4.8],
  HALL_LEN: 5,             // hallway depth past the -Z wall to the portal panel
  EXIT_RADIUS: 1.4,        // walk within this of an unlocked portal's corridor end -> enter that zone
  // Per-zone gallery rooms. Every zone's artifacts stand on a ring of pedestals in
  // a room of its own, so the three collections never share a space and the main
  // room stays a pure lobby (Soul Altar + the three portals). Zone 2 opens through
  // the -X wall, Zone 3 through the +X wall, and Zone 1 through a doorway in the
  // +Z wall behind the spawn. All three share one footprint so they read as
  // siblings; ROOMS only places them.
  GALLERY: {
    LEN: 15,               // room depth outward from the lobby wall
    HALF_W: 6,             // room half-width across that depth
    DOOR_HALF: 1.2,        // half-width of the doorway cut into the lobby wall
    DOOR_H: 3.0,           // doorway opening height (matches the -Z portal doorways)
    // Which lobby wall each room opens through (axis + dir) and where along that
    // wall its doorway sits (cross). The ±X entries keep the old wing footprint.
    ROOMS: [
      { zone: 1, axis: 'z', dir: 1, cross: 0 },
      { zone: 2, axis: 'x', dir: -1, cross: 2.0 },
      { zone: 3, axis: 'x', dir: 1, cross: 2.0 },
    ],
    // Pedestal ring: an ellipse fitted to the room, long axis along its depth. One
    // pedestal per artifact the zone actually has (11 / 9 / 7 — derived from
    // ARTIFACT_DATA, never configured). Pedestals are spaced by equal ARC, not
    // equal angle, or the ellipse's ends would bunch them tighter than the player
    // can walk between (Zone 1's 11 are the binding case).
    //
    // Sizing is what makes the room walkable, so it is worth showing the working.
    // Every clearance below is for the player's CENTRE, i.e. already less
    // PLAYER_RADIUS (0.45) and PEDESTAL_R:
    //   outside the ring, across:  6.00 - 3.40 - 0.34 - 0.45 = 1.81 m of travel
    //   outside the ring, at ends: 7.50 - 5.40 - 0.34 - 0.45 = 1.31 m
    //   inside the ring, across:   3.40 - 0.34 - 0.45 - (0.60 + 0.45) = 1.56 m
    //   gap between neighbours:    ~2.55 m centres - 0.68 = 1.86 m (player is 0.90)
    RING_LONG: 5.4,
    RING_SHORT: 3.4,
    PEDESTAL_R: 0.34,      // pedestal footprint radius (collision + ring spacing)
    PLINTH_H: 1.05,        // plinth height — the cube floats above this
    MARKER_R: 0.6,         // zone-marker centrepiece radius (collision)
    MARKER_H: 0.4,         // zone marker stays low so you can see across the ring
    CUBE_Y: 1.36,          // rest height of the floating artifact cube
    FLOAT: 0.06,           // vertical bob amplitude
    SPIN: 0.42,            // cube spin, rad/s
  },
  // Gentler bloom for the walkable hub than the gameplay default (see BLOOM).
  // The gallery has no signature string-glow to protect, so a lower strength +
  // higher threshold keeps the marble/plaster surfaces and picture bulbs clean
  // instead of hazing out. Stashed/restored around zone entry (see Game.js).
  BLOOM: { STRENGTH: 0.35, RADIUS: 0.5, THRESHOLD: 0.5 },
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

// Per-run world seed. ES modules are singletons, so this is generated exactly
// once per page load (= one playthrough) and stays stable for the whole run.
// It partitions the riddle pool into one disjoint block per zone arena (see
// `riddlesForZone` in data/riddles.js): a bugtong never appears in two zones in
// the same run, while each retry rotates a fresh window through the zone's block
// so retries show different riddles. A different run reshuffles all blocks.
export const WORLD_SEED = (Math.random() * 0x1_0000_0000) >>> 0;

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
  // Player light-bolt: cast from the hand's lure by HOLDING left mouse. COOLDOWN
  // doubles as the auto-repeat interval, so a held button reproduces exactly the
  // cadence a perfect clicker used to manage — same DPS, no sore hand.
  BOLT: {
    SPEED: 38, RADIUS: 0.18, LIFE: 1.2, COOLDOWN: 0.22, DAMAGE: 1,
    COLOR: 0x7fe8ff, SIZE: 0.09,
  },
  // Melee shockwave (F): a radial pulse centred on the player. It is the answer
  // to being surrounded, not a second DPS button — the shove it lands is the
  // point and the damage is a bonus. Deliberately gated three ways so it cannot
  // be leaned on: a long COOLDOWN, a STAMINA bill from the same tank that pays
  // for sprint and the combat hop, and a request that is dropped (never queued)
  // while either gate is closed, so holding F cannot auto-release it.
  SHOCKWAVE: {
    RADIUS: 4.2,              // reaches past CHASER.ATTACK_RANGE (1.4), not across the arena
    VERTICAL: 2.0,            // ± band around the player; a gale far overhead is missed
    DAMAGE: 2,                // one-shots a base chaser (CHASER.HP 2); zone HP bonuses resist
    KNOCKBACK: 2.6,           // ~1s of chaser travel at SPEED 3.2 — a real gap, not a teleport
    COOLDOWN: 6,
    STAMINA: 0.3,             // 1.5x a hop, out of the same 0..1 tank (CONFIG.JUMP_STAMINA 0.2)
    DEFLECT_RADIUS: 5.0,      // hostile shots swept out of the air (slightly wider than the shove)
    COLOR: 0x7fe8ff,          // the established player-light hue
    FOV_PUNCH: 3,
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
  // Every hostile projectile shares this pool. The Feastkeeper's Spiral Feast puts
  // ~25 rounds in the air on its own, so 24 would silently starve the spitter adds
  // (ProjectilePool.fire returns null when exhausted) for the length of a volley.
  POOL_SPITS: 48,
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
  // Floating combat text (src/ui/_partials/CombatPopups.js). The pool is sized
  // for a busy wave plus a boss hit streak without recycling a label mid-read.
  POPUPS: 16,                 // floating combat labels in flight
  POPUP_LIFE: 0.85,           // seconds a damage number lives
  POPUP_CALLOUT_LIFE: 1.25,   // ARMOR BROKEN / ENRAGED linger longer
  POPUP_RISE: 1.15,           // world units per second a label drifts upward
};

// Memory Arena (Strings v2.0) — the instanced combat space entered from a main
// zone's Memory Rift. The Guardian is an active threat here: waves of drowned
// echoes attack while the player answers the guardian's bugtong by SHOOTING one
// of three answer nodes. Each correct answer strips one armor layer; when armor
// is gone the guardian falls and a victory rift carries the player back.
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
  // Shared first-person victory return: the defeated boss bursts into memory
  // shards, those shards reverse into a rift, and the camera is pulled through.
  VICTORY: {
    TOTAL: 5.6,
    IMPACT_END: 0.6,
    BURST_START: 0.45,
    BURST_END: 1.8,
    RIFT_START: 1.1,
    RIFT_FULL: 2.8,
    PULL_START: 2.5,
    DISTORT_START: 4.35,
    FLASH_START: 5.35,
    BASE_FOV: 70,
    PULL_FOV: 78,
    END_DEPTH: 0.42,
    SHAKE_MAX: 0.055,
    RIFT_RADIUS: 2.35,
    SHARD_COUNT: 40,
    MOTE_COUNT: 64,
  },
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
  // Aim cone for the rail encounter: the player is riding a forward-facing bangka,
  // so the gaze stays on the lane ahead instead of turning back over the stern.
  // Radians, measured from straight ahead (-Z, the boat's heading).
  LOOK_YAW_CENTER: 0,
  LOOK_YAW_RANGE: 1.22,   // ~70 deg left/right; widened to cover the lateral drift
  LOOK_PITCH_UP: 0.61,    // ~35 deg
  LOOK_PITCH_DOWN: 0.52,  // ~30 deg
  // Lateral drift: the bangka wanders across the current instead of holding a
  // dead-straight line, so lanterns never sit at a fixed screen offset. Seeded
  // value noise — organic, but identical for a given run seed.
  DRIFT_RANGE: 0.6,       // metres off CENTER.x at full swing
  DRIFT_PERIOD: 3.5,      // seconds per noise key; a full meander runs ~10s
  DRIFT_KEYS: 9,          // noise samples before the wander cycles
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
  // Seal consoles: the player walks up to one and taps E to read its bugtong.
  // CONSOLE_OFFSET pushes the plinth sideways off the walking lane — the gate
  // landing's half-extent is GATE_LANDING_HALF (3.0) and the ramp is RAMP_WIDTH
  // (3.2) wide, so 2.1 clears the lane while staying on the slab.
  CONSOLE_OFFSET: 2.1,
  CONSOLE_RANGE: 2.8,
  // A wrong bugtong answer surges the tide instead of burdening movement: the
  // tower's only real currency is vertical clearance, and a slow that stacks with
  // a rising flood reads as a death sentence rather than a setback.
  WRONG_TIDE_SURGE: 1.2,
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

// Shortest signed distance between two angles, in (-PI, PI].
export function wrapAngle(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }

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
