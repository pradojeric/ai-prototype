# Implementation Plan — Strings v2.0 (Memory Arenas, Active Riddle Combat, Guardian Souls)

## Context

`Strings v2.md` redefines the core loop. Today the player walks up to a stationary
Guardian in the main zone, answers a **DOM multiple-choice** riddle that pauses the
world, and on success the Guardian scatters that zone's artifacts for peaceful
collection. v2 keeps the peaceful main-zone collection but moves the *challenge* out
of the main zone into an **instanced Memory Arena** — a separate 3D space where the
Guardian is an active combat threat and riddles are answered **by shooting 3D
targets** while surviving zone-specific action (wave defense / rail shooter / tower
ascension). Victory drops a **Guardian Soul**; collecting all three Souls and placing
them in a museum pedestal triggers the Final Memory ending.

Crucially, the repo already contains most of the hard parts, currently dormant:

- A full wave-combat subsystem behind `COMBAT.ENABLED` (`src/core/combat/*`): player
  HP + light-bolt casting, `Enemy` chaser/spitter archetypes, `ProjectilePool`,
  `NavGrid` flow-field pathing, combat HUD, and the game-feel layer (hitstop, FOV
  punch, hit markers). This is the backbone of the arena fights.
- A **scene-swap** pipeline: `Game._loadZone(zoneId)` (Game.js:881) tears down a
  `World`, builds a fresh one, re-parents the player rig, re-wires collision/ground,
  rebuilds subsystems, and respawns — exactly the mechanism an arena detour needs.
- A **defeat→scatter** flow (`_defeatGuardian` Game.js:422 + `artifacts.scatter`)
  that bursts artifacts across the zone and registers spatial echoes — reused verbatim
  for the post-arena return.
- Riddle **data** (`drawRiddles`, choices with `.correct` — `src/data/riddles*.js`),
  the `Guardian` shell + per-zone bodies, `PortalVortex` swirl material, the museum
  hub, and the complete ending cutscene pipeline (`_runEnding`).

**Decisions (user, 2026-07-20):** build a **Zone 1 vertical slice first** (full arena
loop end-to-end), then Lumina, then Souls/Final Memory, then Zones 2 & 3. Riddles are
**hybrid**: the DOM panel shows the bugtong text/prompt; answers are selected by
**shooting 3D targets** in the arena.

---

## Architecture: the arena as a scene detour

Model each Memory Arena as its **own `World` zone-definition** (`arena1`, later
`arena2`/`arena3`) registered in `src/core/zones/index.js`. The main-zone → arena →
main-zone trip reuses the existing swap machinery:

1. **Main zone** no longer hosts a walk-up Guardian. It hosts a **Memory Rift**
   gateway (new `MemoryRift`, using `PortalVortex.createVortexMaterial`). Walking into
   it / holding E enters the arena.
2. `Game._enterArena(zoneId)` — a sibling of `_enterZoneFromHub` (Game.js:867): flash
   white, `_loadArena(arena<N>)` swaps to the arena world, starts the arena encounter.
   The current main-zone id is remembered so we can return to it.
3. On victory, `Game._returnFromArena()` rebuilds the **main** zone via the existing
   `_loadZone`, then runs the existing scatter (`artifacts.scatter` + echoes) *plus*
   drops the **Guardian Soul**. Collection is then the untouched peaceful flow.

This means: no bespoke second renderer/scene manager — arenas are just Worlds, and the
`phase` state machine gains an `'arena'` branch that runs the fight instead of the
seek-the-guardian branch.

**Combat core refactor.** `CombatManager` is currently coupled to a "contested
artifact" (spawns a ring around `_artifact.pos`, leashes to it, `isContested`). The
arena has no artifact — waves spawn around the **arena center**. Refactor
`CombatManager` to take a **spawn origin + optional leash target** instead of an
artifact, so the same wave/enemy/bolt/HP/feel core drives the arena. The retired
contested-mode entry points (`isContested`, artifact leash) are removed — v2 keeps
main-zone collection peaceful, matching the existing `COMBAT.ENABLED=false` direction.

---

## Phase 1 — Zone 1 Vertical Slice ("Riddle Breakers")

Goal: prove the entire v2 loop for Zone 1 end-to-end.

### 1a. Memory Rift gateway (main zone)

- **New** `src/core/MemoryRift.js`: a glowing gateway mesh in the main zone using
  `PortalVortex.createVortexMaterial(aspect)`, a swirl panel + frame + halo, with a
  per-frame `update(dt,t)` for `uTime`. Placed at the zone's former `guardianStart`.
- `zone1.js`: expose a `riftSpot` (reuse `guardianStart`).
- `Game`: replace the "seek the Guardian" branch (animate() Game.js:1058-1073) with a
  Rift proximity/interact check — hold-E or walk-in within range → `_enterArena('arena1')`.
  Reuse the existing `_ePressed`/prompt idiom and `MUSEUM.EXIT_RADIUS`-style trigger.
- Remove the main-zone `Guardian` construction from the initial/`_loadZone` path (the
  Guardian now lives in the arena).

### 1b. Arena world (`arena1`)

- **New** `src/core/zones/arena1.js`: an enclosed **circular spectral kitchen /
  marketplace** ring surrounded by void — a walled arena (ring of colliders), dark
  background, tight fog, a raised center platform the player defends. Reuse World
  primitives (`_building`, `_stall`, `_dock`) for dressing; add a `_ring`/void floor if
  needed. Player spawns at center. No artifacts spawn here.
- Register `arena1` in `zones/index.js` (`ZONES`). `createWorld` handles it unchanged.

### 1c. Wave defense (reuse combat core)

- Re-enable combat for the arena only (drop the global `COMBAT.ENABLED` gate; combat
  is now scoped to the `'arena'` phase).
- Reskin `Enemy` archetypes to the doc's names via data, not new classes:
  - `chaser` → **Starved Fishers** (fast skeletal swarmers) — already fast melee.
  - `spitter` → **Brine Spitters** (stationary, lob corrosive salt) — already ranged.
  Keep the two-archetype `Enemy` class; adjust `_buildBody` colors/silhouette + config
  labels. `NavGrid` bakes against the arena `World` as it does today.
- Waves spawn around the **arena center** (refactored `CombatManager`).

### 1d. The Feastkeeper (armored arena boss) + hybrid riddle

- **New** `src/core/arena/ArenaController.js`: orchestrates the encounter above
  `CombatManager` — runs enemy waves continuously, and on a cadence issues a **riddle
  round**:
  - DOM panel (reuse `RiddleScreen`'s markup, or a slimmed `RiddlePrompt`) shows the
    bugtong **text/prompt only** — no clickable buttons.
  - Spawn **3 coral answer nodes** (new `src/core/arena/AnswerNode.js`): breakable 3D
    meshes, each carrying one `choice` (`text` + `correct`), floating billboard label,
    hit-tested against the player's bolts (same squared-distance test CombatManager uses
    for enemies, combat/CombatManager.js:261-279).
  - **Correct** hit → break one of the Feastkeeper's armor layers (armor count =
    `RIDDLE_COUNT`); **wrong** hit → spawn an immediate extra wave of Starved Fishers
    (the doc's penalty). Clear the round's nodes, resume waves until the next round.
- The **Feastkeeper** = the existing `Guardian` shell with `zone1Golem` body placed in
  the arena, invincible until armor is depleted, then `defeat()` (reuse its poof/fade).
- Player death mid-arena → reuse the faint respawn, but respawn **in the arena** and
  reset the encounter (mirror `_combatFaint`, Game.js:520).

### 1e. Victory → return → Soul + scatter

- Armor depleted → Feastkeeper defeated → brief arena-collapse beat (flash) →
  `_returnFromArena()`:
  - `_loadZone('zone1')` rebuilds the main zone, `bossDefeated = true`.
  - Run the existing scatter: `artifacts.scatter(center)` + `addEcho` per artifact
    (Game.js:436-445) so **all** zone artifacts surface for peaceful collection.
  - Drop the **Guardian Soul** (see Phase 3 data model) at the scatter origin as a
    distinct glowing pickup; collecting it stores it in session state.
- Peaceful collection, HUD counter, zone-complete card, and museum return are the
  **existing** flows — unchanged.

### 1f. Config

- New `ARENA` block (arena size, wall radius, center platform, wave cadence, riddle
  round interval, armor = `RIDDLE_COUNT`, penalty-wave size). Repurpose the existing
  `COMBAT` tunables for enemy/bolt/HP values.

**Phase 1 verify:** `node --check` all touched/new modules (each < 1000 lines). User
in-browser: descend Zone 1 → find & enter the Rift → survive waves → DOM shows a
bugtong while 3 coral nodes appear → shoot the correct node to strip armor (wrong node
spawns a Fisher wave) → defeat the Feastkeeper → return to Zone 1 with the Soul +
artifacts scattered → collect all → zone-complete → museum. Dying in the arena respawns
and resets the fight. Console clean across both scene swaps.

---

## Phase 2 — Memory Lumina drops

**Locked decisions (user, 2026-07-20):** Phase 2 only; do not repair unrelated
Phase 1 issues. Scheduled enemies roll a 30% drop chance and wrong-answer penalty
enemies roll 15%. Drops expire after 12s. Zephyr is an automatic 2.2x movement
surge for 8s; Overcharge fires automatically at a deterministic 8 shots/sec for
5s. Same-color pickups refresh their timer, different buffs coexist, and the HUD
uses compact timers. All Lumina share one procedural pickup chime.

- **New** `src/core/arena/LuminaManager.js` (arena-scoped): lesser-enemy deaths have a
  chance to drop an orb; orbs are collected by shooting **or** walking over them.
  - **Green (Vitality)** → restore player HP (reuse `CombatManager` hp + `HEAL_ON_CLEAR`).
  - **Blue (Zephyr)** → 8s infinite sprint + speed (drive `PlayerController` stamina /
    speed multiplier via a timed buff).
  - **Gold (Overcharge)** → 5s rapid-fire, no cooldown (zero `BOLT.COOLDOWN` on a timer).
- Hook drop-on-death into the arena's enemy-death path; render simple additive orbs
  (no new lights — additive emissive, consistent with the project's bloom approach).
- Config `LUMINA` block (drop chances, buff durations, colors).
- Drop selection is adaptive: at or below half HP, Vitality receives 60% weight;
  between half and full HP all three colors are equally weighted; at full HP,
  Vitality is excluded. Vitality heals 25 HP, capped at maximum.
- Buffs and live drops clear on faint/reset, victory, disposal, and scene switch.
- `styles.css` is already above the 1000-line cap, so arena/combat/Lumina HUD rules
  move into `_partials/arena-hud.css` as part of this phase.

**Verify:** orbs drop, both pickup methods work, each buff visibly applies for its
duration and expires; HUD/crosshair reflect Overcharge. Phase 1's broader
return/scatter/museum flow remains a separate unverified checklist item.

---

## Phase 3 — Guardian Souls + The Final Memory

### Phase 3 execution design (approved by the implementation request)

- Add the altar as a focused `src/museum/_partials/SoulPedestal.js` component so
  `Museum.js` and `Game.js` remain below the 1000-line limit.
- Keep the altar hidden and non-animated during the intro. It becomes visible only
  when `Museum.setHubLighting(true)` enters hub mode, preserving
  `IntroCutscene`'s x=0 camera path from the wake point to the Zone 1 hallway.
- Synchronize recovered Souls on every museum entry. `Museum.placeSoul(zone)` is
  idempotent, so revisiting the hub cannot duplicate geometry or state.
- Treat recovered Souls as automatically seated in their three altar slots when
  carried home. The player must then stand near the altar and hold E for the normal
  2.5-second interaction duration; the altar only accepts the ritual at 3/3 Souls.
- Make `_runEnding` scene-neutral at its entry: when triggered in the museum, spawn
  the existing Final Portal in the museum scene, then dispose only the detached
  gameplay world behind it. The museum-tour, restored-province, credits, and epilogue
  beats remain the existing downstream sequence.
- Extend the existing debug ending shortcut to seed all three Souls and enter the
  real museum-pedestal interaction path instead of bypassing the new gate.

- **Data model:** `Game.collectedSouls = new Set()` (zone ids whose Soul is recovered),
  persisted in session like `collectedByZone`. The Soul pickup in the main zone (Phase
  1e) adds the zone id on collection.
- **Museum pedestal:** add a central **altar/pedestal** to `Museum.js` with three Soul
  slots; `Museum.placeSoul(zone)` lights a slot as each Soul is carried in. Reuse the
  frozen-geometry + emissive idiom already in Museum.
- **Trigger:** replace the ending gate. Today `_runEnding` fires when
  `_allArtifactsCollected()` (Game.js:338). v2 fires it when **all three Souls are
  placed** on the pedestal (hold-E on the pedestal with 3/3 Souls). The existing
  `_runEnding` portal → museum → restored-province → credits pipeline is reused
  **unchanged** downstream.

**Verify:** each zone's Soul appears on the pedestal on museum return; placing the 3rd
Soul triggers the full Final Memory sequence exactly as the current ending does.

---

## Phase 4 — LIKET Stationary-Boat Rail Shooter

### Encounter contract

- Zone 2 enters a dedicated Arena 2 controller through the same lifecycle used by
  Arena 1: `begin`, `update`, `won`, `resetLumina`, `guardianCenter`, and `dispose`.
- The bangkâ and player stay at a fixed combat anchor. Walking is disabled while
  mouse-look and light-bolt casting remain active. Six recyclable LIKET river chunks,
  moving water, and near/mid/far depth multipliers simulate forward travel.
- Moderate deterministic boat bob, roll, sway, and a restrained camera offset sell
  motion without moving the aim origin far enough to hide threats or lantern labels.
- **The Reveler** is the canonical Zone 2 guardian name in both language modes.
  Existing coral-titan geometry remains its visual design; all former labels and
  comments are normalized repository-wide.

### Survival pressure

- Reuse the combat projectile and target lifecycles through Arena 2-specific manual
  wave APIs rather than Arena 1's endless-wave scheduler. Waves arrive every 10s
  outside riddle rounds, cycling 1 sniper/1 boarder, 2/1, 1/2, and 2/2 with a hard
  cap of six active threats.
- River Snipers fire at the boat about every 1.8s for 10 Boat Integrity damage.
  Player bolts reflect hostile shots; a reflected shot returns to and defeats its
  originating sniper.
- Frenzied Boarders approach, telegraph for 0.8s, then deal 14 Boat Integrity damage
  every 1.25s until destroyed. Encounter death restarts the complete Arena 2 run.

### Lantern volley

- First volley begins near 25s; later volleys are paced about 55s apart. The riddle
  prompt is revealed for 3s before The Reveler throws three answer lanterns 0.75s
  apart. Each lantern has its own 6s impact deadline.
- A correct shot deflects the lantern, dismisses outstanding decoys, and breaks one
  of The Reveler's three wards. A wrong shot deals 18 Boat Integrity damage but
  leaves the correct answer available. An unshot wrong decoy is harmless.
- Missing the correct lantern deals 25 damage, clears the volley, then retries the
  same riddle after 3s with reshuffled answers. New waves pause during riddles and
  existing threats run at 65% speed. Three correct volleys win the encounter.

### Lumina, HUD, and feedback

- Arena 2 Lumina flies automatically to the boat over 0.45s. Vitality restores 25
  Boat Integrity; Overcharge stays unchanged; Zephyr lasts 8s and slows hostile
  threats to 55% without changing player bolts or parallax speed.
- Relabel the health presentation to Boat Integrity, hide stamina, show The Reveler's
  three wards, and reuse the non-blocking riddle banner for instructions and answers.
- Add procedural audio hooks for lantern throws, correct deflections, reflected
  sniper shots, and hull impacts, synchronized with restrained hit feedback.
- Victory reuses the established Arena return: Zone 2 Soul drop, all remaining Zone
  2 artifacts scattered, museum pedestal synchronization, and final-memory gating.

**Verify:** stationary aim-only boat framing, seamless parallax recycling, manual
enemy waves, bolt reflection, repeated boarding attacks, all lantern outcomes,
riddle/Zephyr slow profiles, full-encounter restart, and Zone 2 Soul/scatter return.

---

## Phase 5 — Zone 3 Arena: "Tower Ascension" (vertical climb)

- **New** `arena3.js`: a hollow tower interior with ramps/spiral stairs; a **rising
  lethal water plane** climbs on a timer (drowning = death). Reuses `World.groundHeightAt`
  for stair support.
- Enemies: **Gargoyle Sentinels** (heavy melee that block stairs, multi-hit) and **Gale
  Whispers** (flying ranged evasive). Both are `Enemy` variants with tuned HP/behavior.
- Riddle: periodic **locked gate** blocking the stairs with 3 mechanism `AnswerNode`s;
  correct opens the gate, wrong spawns Gargoyles + a temporary movement slow (buff
  system from Phase 2, inverted).
- Keeper of Memories = the arena boss controlling water level.

**Verify:** water rises, climb outpaces it, gate-riddle gates progress, wrong answer
penalizes, reach the top / defeat Keeper → Zone 3 Soul → all-Souls → Final Memory.

---

## Files summary

**New:**

`src/core/MemoryRift.js`, `src/core/arena/ArenaController.js`,
`src/core/arena/AnswerNode.js`, `src/core/arena/LuminaManager.js`,
`src/core/zones/arena1.js` (+ `arena2.js`, `arena3.js`),
`src/museum/_partials/` pedestal if `Museum.js` nears the 1000-line cap.

**Modified:** `src/core/Game.js` (arena phase + `_enterArena`/`_returnFromArena` +
Rift/Soul/pedestal hooks; retire main-zone Guardian & DOM riddle-click flow),
`src/core/combat/CombatManager.js` (origin/leash refactor, drop contested-artifact
coupling), `src/core/combat/Enemy.js` (archetype reskins/variants),
`src/core/zones/index.js` (register arenas), `src/core/zones/zone1.js` (rift spot),
`src/museum/Museum.js` (Soul pedestal), `src/config.js` (`ARENA`/`LUMINA` blocks;
retire `COMBAT.ENABLED`/`ARTIFACT_BATCH` coupling), `index.html`/`styles.css` (riddle
prompt without buttons, Soul/Lumina/boat-HP HUD bits).

## Global constraints
- No build/test tooling: verify with `node --check` per file + user in-browser (served
  over HTTP; **no Playwright** per project memory). Every file stays < 1000 lines
  (split via `_partials/` if needed).
- Preserve per-frame no-allocation discipline (scratch vectors on `this`) in all new
  hot paths (arena update, AnswerNode/Lumina hit tests).
- Preserve Filipino/Pangasinan cultural text + diacritics.
