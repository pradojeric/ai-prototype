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

Phase 5 is delivered as separately approved increments. Each increment stops for a
manual browser check before the next begins.

### Phase 5A — player + lighthouse level blockout (accepted)

- Add `arena3.js` as a Bolinao Lighthouse-inspired hollow tower: twelve ascending
  ramp flights, corner landings, three enlarged future-gate landings, an open Keeper
  shaft, and a summit ring around 18 m. Water stays static and harmless.
- Extend `World` with authored support surfaces and optional vertical collider bounds.
  `groundHeightAt(x,z,currentY)` selects the nearest reachable surface so overlapping
  levels cannot snap the player upward.
- Pass the player's current support height through collision/ground queries while
  preserving the existing WASD, sprint, stamina, look, bob, and slide behavior.
- Add only the minimal Arena 3 lifecycle needed to enter and traverse the blockout.
  No Guardian, combat manager, enemies, riddles, rising tide, Lumina, rewards, new
  HUD, audio, victory, Soul, or artifact-scatter behavior is created in this phase.
- Route Zone 3's Memory Rift to Arena 3. The blockout intentionally has no completion
  path; reload is the temporary exit during manual testing.

**Phase 5A verify:** enter the Zone 3 Rift; traverse all twelve flights; test ramp
transitions, overlapping floors, rails/walls, deliberate falls, sprint/stamina, and
pointer-lock release/resume; confirm the scene contains no combat or active hazards.
Stop after reporting static checks and the manual-test instructions.

#### Phase 5A manual-test correction — landing rail clearance

- Shorten each flight's paired rail meshes and collision spans at both endpoints so
  the corner landing remains open for the required ninety-degree turn.
- Apply the same endpoint clearance to summit-ring rails so its corners remain
  traversable while the middle of every exposed edge stays protected.
- Keep ramp supports, widths, heights, and all excluded later-phase systems unchanged.
- Re-run syntax, whitespace, line-count, and scoped-diff checks, then return the same
  build to the user for another manual traversal attempt.

#### Phase 5A manual-test correction — summit overlap

- Remove the summit slabs that duplicate the upper ramp circuit and form a narrowing
  ceiling over the final ascent.
- Rebuild the 18 m summit as a smaller ring around the open central shaft, connected
  to flight 12's enlarged landing by a dedicated level bridge.
- Give the new ring and bridge authored support surfaces plus vertically bounded
  edge-rail colliders, without changing the twelve-flight route or later-phase scope.
- Re-run the Phase 5A static checks and return the blockout for summit retesting.

#### Phase 5A manual-test correction — final bridge pinch

- The bridge centerline intersects the player-radius envelope around flight 12's
  inner rail endpoint even though the visible rail stops before the landing.
- Give flights adjoining enlarged future-gate landings the landing's full 3 m rail
  clearance, scaling and offsetting their instanced rails and matching colliders.
- Keep ordinary corner clearances at 2.15 m and preserve the ramp/support geometry.
- Numerically assert the flight-12-to-bridge centerline is clear, then repeat syntax,
  whitespace, line-count, and scope checks before another manual handoff.

### Phase 5B — rising tide + drowning retry (accepted)

**Player promise:** keep climbing while the tower floods beneath you. Normal movement
must gain height faster than the tide, while hesitation, backtracking, and falls let
the water close the air gap.

**Core loop:** climb toward the 18 m summit while the water rises after a short grace
period; the ascent HUD reports altitude, progress, and breathable clearance; reaching
the waterline triggers a readable drowning blackout and automatically restarts the
complete attempt at the base with water and stamina reset.

- Add a `TOWER_ARENA` config block with named summit height, grace duration, rise
  speed, maximum water height, warning thresholds, and drowning clearance.
- Upgrade `TowerArenaController` to own attempt time, water elevation, drowning state,
  HUD state, and one-shot failure consumption. Pause the tide while pointer lock is
  released and reset all attempt state from `begin()`.
- Add a compact top-left ascent HUD: fixed-width altitude, air-gap readout, progress
  meter, and warning/critical states. Add a centered drowning message over the
  existing blackout rather than creating a second cinematic system.
- Extend the generic arena loop to consume controller failures, and make the shared
  arena faint/retry path safe when no combat manager exists.
- Preserve the accepted tower geometry, movement, collision, stamina mechanics, and
  existing arena controllers. Do not add summit victory, enemies, combat, knockback,
  riddles, Keeper, Lumina, Soul/scatter, new audio, or later-phase VFX.

**Tuning contract:** the player starts with an 8 s grace period; water then rises at
0.16 m/s. Walking continuously uphill gains support height faster than the tide.
Failure occurs when the water reaches within 0.12 m of eye height. The tide is capped
above the summit only as a numeric safety bound; Phase 5B intentionally has no win.

**Phase 5B verify:** confirm delayed rise, HUD accuracy, pause under released pointer
lock, warning thresholds, drowning at the base and after a fall, automatic reset of
water/player/stamina/HUD, and a clean second attempt. Traverse to the summit without a
completion event, then stop for user approval before Phase 5C.

#### Phase 5B manual-test correction — final decorative gate collision

- Keep the visible final gate frame as a future-riddle landmark, but do not register
  collision for its pillars while gates are intentionally inactive in Phase 5B.
- Preserve the bridge rails, summit supports, twelve-flight route, tide, HUD, and
  retry behavior; the correction is limited to collision ownership at the top frame.
- Re-run syntax, whitespace, line-count, and scoped-diff checks, then return the same
  build for a focused final-gate traversal test.

#### Phase 5B manual-test correction — summit connector clearance

- The first correction proved the inactive gate pillars are not the blocker. Widen
  the diagonal landing-to-summit bridge while keeping the accepted ring and shaft.
- Match every summit-bridge rail collider to the rail mesh's true half-width instead
  of registering a collision proxy twice as thick as the visible rail.
- Preserve the final frame landmark, bridge rails, tide/HUD/retry systems, and all
  later-phase exclusions; verify the full connector centerline remains traversable.

#### Phase 5B manual-test correction — tower-shell proxy root cause

- Replace the tower shell's rotated-mesh AABB approximations with matching oriented
  box colliders. The AABB corners pinch all route corners and are most visible at the
  sharp final turn into the summit connector.
- Use the wall mesh's true half-width and half-depth for each proxy, preserving the
  visible shell and its intended solid boundary without inward invisible corners.
- Numerically compare old/new clearance at the final landing, then repeat syntax,
  whitespace, line-count, and scope checks before the next focused user retest.

#### Phase 5B manual-test correction — final-ramp/bridge rail intersection

- Validate the complete approach polyline, not only the diagonal bridge centerline.
  The outer diagonal bridge rail crosses the incoming final ramp before the landing.
- Start both bridge rails after the enlarged landing and offset their shortened spans
  toward the summit, preserving visible fall protection without crossing the route.
- Assert the final-ramp, bridge, and summit-ring centerlines as one continuous path
  against shell and rail colliders before returning the build for manual verification.

### Phase 5C — altitude-aware tower combat (authorized; implement first)

**Player promise:** fight without abandoning the climb. Gargoyle Sentinels turn
narrow ramps into positioning problems, while Gale Whispers pressure exposed turns
and can knock an inattentive player from the route.

**Core loop:** climb into four authored threat bands; cast light at heavy grounded
Sentinels and evasive shaft fliers; manage health, stamina, tide, knockback, and
vertical Lumina; recover or continue upward before the water closes the route.

- Add `TowerCombatManager` and `TowerThreat` rather than projecting the generic
  flat `Enemy`/`NavGrid` over stacked floors. Reuse pooled bolts, health/death,
  firing, hit feedback, HUD, Lumina callbacks, and arena faint/retry contracts.
- Add four altitude milestones with a capped authored mix: one teaching Sentinel,
  two mixed Sentinel/Whisper bands, and one final pre-summit mix. Threats never
  respawn merely because the player waits; each milestone triggers once per attempt.
- Gargoyle Sentinels use four bolt hits, slow support-aware pursuit, an 18-damage
  melee strike, and a decaying 5.2 m/s horizontal knockback. Their live bodies block
  only the player at the matching vertical tier, never player bolts.
- Gale Whispers use two bolt hits, continuous shaft orbit/evasion, a telegraphed
  10-damage shot every 2.8 s, and a 3.6 m/s horizontal knockback on impact.
- Add composable player APIs for world-space knockback and external movement slow.
  Process impulses through existing axis-separated collision sliding; never write
  `eyeBase` upward or teleport the player. Reset both effects on faint/dispose.
- Pass projectile Y into static collision tests so rails on unrelated floors cannot
  absorb bolts. Dynamic enemies and gates remain player-only collision channels.
- Add opt-in vertical Lumina: tower drops preserve kill altitude and require both
  horizontal and vertical pickup proximity. Arena 1 and Arena 2 retain defaults.
- Preserve the accepted tower route, tide/drowning, sprint/stamina, pointer-lock
  pause, existing arenas, existing audio assets, and generic zone progression.

**Phase 5C pacing:** maximum six simultaneous threats; threats wake only near the
player's vertical band; combat and tide pause together when pointer lock is released.
The tide remains at 0.16 m/s so steady mixed walking/sprinting still leaves time for
the authored encounters.

### Phase 5D — three seals, Keeper fight, and Zone 3 victory (authorized second)

**Player promise:** earn each section of the climb by reading and shooting the right
memory mechanism, then confront the Keeper over the open shaft before the tide wins.

**Core loop:** reach the 6/12/18 m gate landings; read one traditional riddle; shoot
the correct one of three mechanisms to open the visible seal; endure a Gargoyle and
temporary slow after mistakes; open all seals; defeat the Keeper at the summit;
return to Pananisia for the existing Soul and artifact-scatter collection loop.

- Add `TowerGateManager` around the three authored frame descriptors. Each sealed
  gate has a visible player-only barrier bounded to its height and activates before
  contact. A correct shot removes the barrier completely; no invisible proxy remains.
- Reuse `drawRiddles`, the non-blocking arena banner, and `AnswerNode`. Make node bob
  height relative to its authored position and support a compact tower label scale,
  preserving Arena 1 behavior.
- A wrong mechanism stays non-terminal: break that decoy, spawn one capped Sentinel,
  and apply a clearly reported 55% movement scale for four seconds while the tide
  continues. The correct mechanism remains available.
- Add a procedural `TowerKeeper` using the existing Zone 3 Keeper body builder,
  hovering in the central shaft with its chest near summit eye level. It activates
  only after gate three opens and the player reaches the 18 m ring.
- The Keeper takes twelve bolt hits, telegraphs a 12-damage knockback shot every
  2.4 s, and summons a small Gale reinforcement every eight seconds, respecting the
  six-threat cap. Enemy → mechanism → Keeper → Lumina remains the hit priority.
- Extend the ascent HUD with a compact objective line. Reposition the shared ward
  display to the top-right in tower mode for seal progress and Keeper resolve; keep
  player health, threat count, tide, and buffs in their existing clusters.
- On Keeper defeat: freeze tower pressure, clear threats/buffs/slow/knockback, hide
  tower combat UI, expose `guardianCenter()`, and set `won`. Reuse the generic arena
  return unchanged for Zone 3 artifact scatter, Guardian Soul, museum pedestal, and
  final-memory progression.

**Attempt/reset contract:** drowning, zero health, or falling into the tide restarts
the whole attempt: water/grace, player/stamina/health, four threat milestones, all
three gates/riddles/barriers, slow/knockback, Lumina, Keeper HP/timers, projectiles,
and every HUD state. Pointer unlock freezes all tower timers and simulation.

**Architecture:** keep `TowerArenaController` as the thin orchestrator; add focused
`TowerCombatManager`, `TowerThreat`, `TowerGateManager`, and `TowerKeeper` modules.
`arena3` exposes per-World gate/threat descriptors. Shared-module edits stay limited
to opt-in vertical behavior and generic hooks; `Game.js`, Zone 1–2 layouts, existing
combat archetypes, Guardian progression, and `AudioManager` remain unchanged.

**Static verification:** syntax-check every modified/new JavaScript module; run
`git diff --check`; search for stale tower controller names and non-height-aware
tower collision calls; assert the summit route, three vertical gate bands, threat
cap, complete reset state, and every file below 1000 lines; inspect the scoped diff
for Arena 1–2/progression regressions.

**Manual-test gate:** test clean ascent combat, every correct/wrong gate path,
knockback/falls, vertical Lumina, health death and drowning retries, pointer-lock
pause, Keeper activation/attacks/defeat, return to Zone 3, artifact scatter, Soul,
console errors, and a second full attempt. Stop for approval before Phase 5E.

### Original later increment (scope narrowed by user)

- **5E:** only VFX and HUD polish are authorized below. Audio, diagnostics, profiling,
  and broader integration QA remain excluded.

### Phase 5E — tower VFX and HUD polish (authorized scope)

**Scope boundary:** implement only Arena 3 VFX and HUD polish. Do not add audio,
diagnostic overlays, external/generated assets, new post-processing, new gameplay,
enemy retuning, or progression changes.

**Keeper model reuse:** replace the temporary TowerKeeper icosahedron with
`buildZone3Guardian` from `src/core/guardians/zone3Guardian.js`. Mount the existing
builder output under a tower-owned root so its 3.8 m chest anchor remains at the
current summit target height while its internal animation continues to face the
player. TowerKeeper still owns HP, shots, reinforcements, hit testing, victory, and
disposal; no roaming Guardian shell, beacon, or duplicate combat rules are introduced.

**Visual language:** cold cyan memory energy marks safe/objective state; amber marks
warning and incorrect seals; coral-red marks damage/tide danger. Effects use rings,
short shard bursts, scale pulses, and route-aligned telegraphs so state is readable by
shape and motion as well as color.

**Technical-art contract:** add one focused `TowerVfxSystem` with shared geometries,
shared additive/basic materials, and fixed pools. No per-effect lights, textures,
custom shaders, or permanent particle clutter. Budget no more than 24 pooled transient
effects, five idle draw calls, twenty transient draw calls, and approximately 5,000
additional visible triangles at peak. Prefer existing bloom and scene fog; respect
`prefers-reduced-motion` for HUD animations.

#### VFX states

- Telegraph each authored threat spawn on its actual ramp with a contracting ground
  ring before the silhouette becomes fully readable; never obscure the route edge.
- Add distinct pooled bolt impact, enemy defeat, and hostile-projectile impact bursts.
  Gargoyle impacts use short stone-like shards; Gale impacts use a light ring.
- Give every sealed gate a visible, height-bounded memory veil matching its collision
  footprint. Correct answers dissolve it cyan; wrong answers pulse amber/coral while
  leaving the correct mechanism available.
- Add a restrained Keeper shaft aura, shot telegraph pulse, hit response, and defeat
  collapse burst. Effects remain event-driven and stop/reset on faint, victory, and
  arena disposal.
- Drive the reused Zone 3 Guardian body's `animate` contract from TowerKeeper and
  fade its returned materials during activation/defeat. Keep the existing visual
  geometry separate from the tower's simple chest-radius hit test.

#### HUD hierarchy and states

- Consolidate ascent and objective information into an authored tower cluster:
  altitude/progress secondary, breathable air gap primary, tide state immediately
  below, and three stable seal pips. Remove the isolated top-right objective text.
- When the Keeper activates, morph the seal row into a fixed-width Keeper Resolve
  meter driven by the existing HP source of truth.
- Add compact transient status chips for movement slow, threat awakening, seal
  correct/wrong feedback, and Keeper activation. Use one event slot so banners never
  stack over the aiming path.
- Preserve health, stamina, Lumina, riddle text, pointer-lock resume, and the removed
  wave panel. Add narrow/laptop rules and reduced-motion fallbacks; desktop keyboard
  and mouse remain the target, so no touch controls enter this pass.

#### Verification and handoff

- Syntax-check every changed JavaScript module, run `git diff --check`, enforce the
  1000-line limit, and inspect the scoped diff for gameplay/collision changes.
- Manual test threat spawn/hit/death VFX, Gale impact, all correct/wrong seal states,
  slow status, tide warning/critical states, Keeper activation/hits/defeat, faint and
  drowning cleanup, pointer-lock pause, 1366×768 and narrow viewport fit, reduced
  motion, and a clean console. Stop for user approval after the handoff.

#### Phase 5C correction — support-bound threats and accurate HUD

- Treat each Arena 3 threat anchor as an authored movement support, including its
  rotation, half-width, half-length, and support height. Gargoyles clamp movement to
  that footprint and keep their visual center above the assigned surface; Gales use
  a bounded orbit around the same anchor instead of unconstrained world movement.
- Reject candidate Gargoyle movement that collides at the threat's vertical tier.
  This prevents lower and upper ramp geometry from interfering with one another.
- Hide the wave panel in Arena 3 because threats are pre-authored altitude encounters,
  not waves. Arena 1 and Arena 2 retain their existing wave/encounter labels.
- Dispose every tower threat mesh during faint/retry cleanup and reset the altitude
  milestone index so a second attempt neither leaves frozen enemies nor skips spawns.
- Verify every changed module with `node --check`, `git diff --check`, the 1000-line
  limit, and a focused manual climb through all four threat bands.

#### Phase 5C correction — visible Gargoyles and stable knockback

- Keep input velocity in camera-local movement space. Apply the tower's external
  knockback once per frame as a world-space displacement through the same X/Z slide
  tests, then decay the impulse; a hit must never accumulate impulse into WASD speed.
- Use the flight being approached at each altitude milestone rather than the nearest
  midpoint chosen without route direction. Spawn the Gargoyle toward the upcoming end
  of that flight so it is visible in the player's path while remaining support-bound.
- Strengthen the Gargoyle silhouette with shared procedural wings/eyes while keeping
  the existing support footprint, hit radius, and four-hit tuning unchanged.
- Retest the first Sentinel encounter and a Gale projectile impact, including movement
  immediately after the hit and another attempt after death/drowning.

#### Phase 5C runtime correction — finite knockback contract

- Add the planned 3.6 m/s Gale knockback value that was missing from `TOWER_ARENA`.
  The absent value currently multiplies projectile direction by `undefined`, producing
  `NaN` player/camera coordinates; AudioListener is only the first strict consumer.
- Validate direction and strength at `PlayerController.applyKnockback`. Ignore invalid
  impulses rather than allowing any combat effect to corrupt the shared camera rig.
- Verify all tower impulse call sites resolve finite configuration and re-run the
  Gale-hit browser check; do not mask the symptom inside `AudioManager`.

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

---

## Artifact collection API POST placeholder (2026-07-21)

### Current flow

`Game._completeInteract()` opens `DiscoveryScreen`, whose save callback commits the
artifact through `ArtifactManager.collect()`. `fetchArtifactData()` in `src/data.js`
is only a local asynchronous mock for reading discovery-card content; no collection
request currently exists.

### Implementation

1. Add an `ARTIFACT_API.COLLECTION_URL` value in `src/config.js` using an obvious
   `example.com` placeholder that can later be replaced with the real endpoint.
2. Add `src/core/APIManager.js` as the I/O boundary. It owns a session identifier,
   builds the GDD payload (`artifact_id`, `artifact_name`, `zone`, `discovered_at`,
   `player_session`, `real_world_data`), and sends it as JSON with `fetch(..., {
   method: 'POST' })`.
3. Instantiate the manager in `Game` and invoke it immediately after the artifact is
   saved locally. The POST is non-blocking; a placeholder endpoint or temporary
   network failure must not undo collection, freeze the discovery modal, or prevent
   zone completion.
4. Verify changed JavaScript with `node --check`, audit the 1000-line limit, run
   `git diff --check`, and inspect the final diff. Browser Network-panel validation
   remains the manual end-to-end check because the endpoint is intentionally a
   placeholder.

---

## Platform session + artifact unlock API (2026-07-22)

### Scope and player-facing contract

Replace the temporary fire-and-forget collection endpoint with the platform's
browser authorization flow. The player can connect from the title screen or
Settings, sees a compact connection state, completes sign-in in a new tab, and can
continue playing while the game polls authorization. Recovering the first local
artifact requests the single platform artifact unlock; if sign-in is still pending,
the request is queued and sent immediately after authorization. Local collection and
zone progression never depend on platform availability.

Open deployment inputs:

- `BASE_URL`: the platform origin that owns `/api/session` and
  `/api/artifacts/unlock`.
- `GAME_ID`: the identifier assigned to Strings by the platform.
- Request schema assumption pending confirmation: session creation sends JSON
  `{ "gameId": GAME_ID }`; unlock sends no body because the authorized session's
  Game ID identifies the platform artifact.

### Technical design

1. Replace `ARTIFACT_API.COLLECTION_URL` in `src/config.js` with a focused
   `PLATFORM_API` block containing `BASE_URL`, `GAME_ID`, the 3000 ms poll interval,
   and session-storage keys. Fail configuration validation with a player-readable
   state instead of issuing requests to placeholder URLs.
2. Refactor `src/core/APIManager.js` into the only network/session boundary:
   - create a session with `POST /api/session` and validate `sessionToken` plus
     `signinUrl` before storing them in `sessionStorage`;
   - open the sign-in URL from the connect click (pre-open a blank tab so async
     session creation does not lose browser user activation, then navigate it);
   - poll `GET /api/session` every three seconds with
     `Authorization: Bearer <sessionToken>`;
   - stop on `authorized`, renew on `expired`, and expose stable pending,
     authorized, expired, and error state events;
   - call `POST /api/artifacts/unlock` with the same bearer token, coalesce concurrent
     calls, and treat duplicate-success responses as success;
   - restore a same-tab browser session from `sessionStorage`, but never persist the
     token to durable `localStorage` or log it.
3. Preserve the current `Game._completeInteract()` commit boundary. After
   `ArtifactManager.collect()` succeeds, request the platform unlock without awaiting
   it. When unauthorized, `APIManager` records a pending unlock and flushes it once
   polling reaches `authorized`. Network failures remain retryable and never roll
   back the museum save, block the discovery card, or interrupt pointer-lock flow.
4. Extend the existing title and Settings markup using the project's `.menu-btn`
   patterns. Add Connect/Reconnect controls and an `aria-live` status with concise
   states: not connected, opening sign-in, waiting for authorization, connected,
   unlock saved, configuration error, and retryable network error. Keep the state
   outside the central play path and reuse one UI binding function rather than
   duplicate rules in event handlers.
5. Keep lifecycle cleanup explicit: only one poll timer and one in-flight request per
   operation, abort polling on page teardown, ignore stale responses after session
   replacement, and preserve the pending unlock across same-tab reloads.

### Verification plan

- Add `tests/APIManager.test.mjs` using Node's built-in test runner with mocked fetch,
  storage, timers, and browser-opening dependencies. Cover session creation/response
  validation, bearer headers, pending-to-authorized polling, expiration renewal,
  queued unlock flush, duplicate coalescing, retryable failures, and token redaction.
- Run `node --check` for every changed JavaScript file and
  `node --experimental-default-type=module --test tests/APIManager.test.mjs`.
- Serve over HTTP and exercise Connect, popup navigation/fallback, pending,
  authorized, expired/reconnect, artifact collection, queued unlock, API failure,
  and same-tab reload restoration with the browser console/network panel open.
- Check title and Settings at desktop and narrow/mobile widths, including focus,
  disabled, long error-text fit, and `aria-live` updates. A visual regression harness
  is not warranted for this small status/control addition; targeted screenshots and
  interaction checks are sufficient.
- Run `git diff --check`, verify every file remains below 1000 lines, re-read all
  changes, and inspect the final scoped diff. No database commands or persistent test
  data are involved.

### Workflow ledgers

Skill loading: director active; gameplay systems loaded from
`threejs-gameplay-systems/SKILL.md`; UI loaded from
`threejs-game-ui-designer/SKILL.md`; QA/release loaded from
`threejs-qa-release/SKILL.md`; AAA graphics, debug/profile, and 3D/image/audio
generators are not needed because no rendering, profiling, or asset work is in scope.

References: gameplay workflows loaded from
`threejs-gameplay-systems/references/gameplay-workflows.md`; UI patterns loaded from
`threejs-game-ui-designer/references/ui-patterns.md`; UI quality, HUD readability,
and responsive-fit checklists loaded; QA/release, visual verification, playtest, and
release checklists loaded. Design/level, physics, game-feel, premium graphics, and
asset-generation references are not needed for this narrow account integration.

Phase ledger: gameplay systems implemented and covered by mocked lifecycle tests; UI
implemented with shared state binding, accessible status, and responsive constraints;
QA/release static checks passed, while the local HTTP/browser check is blocked by the
declined localhost bind permission and missing deployed API values. External asset
sourcing, AAA graphics, and debug/profile skipped as out of scope.

### Verification evidence (2026-07-22)

- All `src/**/*.js` modules pass `node --check`.
- `node --experimental-default-type=module --test tests/APIManager.test.mjs` passes
  9/9 cases covering creation, token-only storage, sign-in navigation, exact 3000 ms
  pending polling, bearer authorization, queued unlock flush, expiration renewal,
  reload restoration, concurrent-call coalescing, unsafe URL rejection, retryable
  unlock failure, redacted logs, and inert placeholder configuration.
- `git diff --check` passes; no changed runtime file reaches the 1000-line limit;
  stale placeholder collection API symbols are absent from runtime source.
- UI checklist static evidence: shared state source, `.menu-btn` reuse, 44 px minimum
  targets, focus/hover/pressed/disabled states, `aria-live` status, constrained title
  layout, and scroll-safe Settings at narrow heights. Browser screenshots, popup
  behavior, console/network checks, and live CORS/API responses remain unverified.
- Visual regression harness skipped: this is a small deterministic text/control state
  addition with no canvas, generated-asset, or render-pipeline changes; focused UI and
  lifecycle smoke checks are the appropriate coverage.
