# Implementation Plan — Artifact Origins & Lore (Awaiting Approval)

## Approved content direction

- Rewrite all 27 artifacts across PONSIA, LIKET, and PANANISIA.
- Replace the current `fact` and `note` model with explicit `origin` and `lore`
  fields.
- Keep the writing historically grounded: no invented flood mythology or fictional
  provenance presented as history.
- Use natural English while retaining Filipino and Pangasinan names and culturally
  important terms.
- Target one short paragraph per section (medium length).
- Correct or standardize artifact names when reliable sources support the change.
- Present Origin and Lore together as one continuous museum-style reading experience.

## Research and editorial method

1. Build a 27-entry research ledger grouped by zone.
2. Prefer primary and authoritative Philippine sources: NHCP registries, provincial
   and municipal government pages, DOT/TPB, DOST, church or site custodians, and
   established Philippine cultural institutions.
3. Cross-check specific dates, claimed places of origin, festival names, titles,
   and superlatives. Treat tourism copy as evidence of current identity, not
   automatically as proof of historical origin.
4. Grade each entry:
   - **Confirmed:** direct authoritative support exists.
   - **Supported:** multiple credible sources agree, but no primary history is found.
   - **Tradition:** preparation or community association is documented, while the
     precise inventor/date is unknown.
   - **Needs correction:** the current name or claim is unsupported or conflicts
     with reliable evidence.
5. For undocumented beginnings, say that the tradition developed in or became
   associated with a community; do not invent a founder, date, or origin legend.
6. Keep citations in an internal research ledger rather than placing URLs inside
   player-facing prose.

The initial MCP search already confirms useful official coverage for Pista'y Dayat,
Bagoong Festival, Bangus Festival, Manaoag, and broader Pangasinan history. Several
current LIKET festival labels did not return authoritative matches in the first pass;
they will receive targeted verification before copy is finalized.

## Data changes

1. In `src/data.js`, retain every gameplay-critical field unchanged:
   `id`, `fil`, `eng`, `spawnTag`, `image`, and `zone`.
2. Replace:
   - `fact` with `origin`
   - `note` with `lore`
3. Write `origin` as the documented beginning, locality, cultural development, or
   historical association of the subject.
4. Write `lore` as the subject's documented community meaning, practice, remembered
   tradition, symbolism, or role in Pangasinan life. “Lore” will remain historical
   and cultural, not fictional.
5. Audit every code consumer and outbound artifact payload so the rename does not
   silently produce missing content.

## Discovery overlay changes

1. Update `index.html` to replace the separate fact/note nodes with an
   `Origin & Lore` story region containing:
   - a small `ORIGIN` heading and origin paragraph;
   - a visual continuation marker;
   - a small `LORE` heading and lore paragraph.
2. Update `src/ui/DiscoveryScreen.js` to bind `d.origin` and `d.lore`. Cache the
   required DOM nodes in the constructor rather than repeatedly querying them during
   every discovery.
3. Preserve the existing public `show(artifactData, zoneName, onSaved)` contract,
   collection callback timing, museum replay behavior, fade timing, zone label, and
   dismissal interaction.
4. Give the image a descriptive `alt` value derived from the artifact name.
5. Update `styles.css` so the longer story remains readable:
   - stable centered card width;
   - restrained section labels and readable paragraph measure;
   - vertical scrolling for short viewports;
   - responsive image/title/type sizing using `clamp`;
   - no clipped Saved/Continue messaging.
6. Keep the current parchment/museum visual language; no generated image assets or
   unrelated HUD redesign are in scope.

## Verification

- Run `node --check` on touched JavaScript modules.
- Search for stale `.fact`, `.note`, `d-fact`, and `d-note` references.
- Confirm all 27 entries contain non-empty `origin` and `lore` fields and retain
  unique ids, valid zone numbers, and existing asset paths.
- Check every touched source file remains under 1000 lines.
- Run `git diff --check`.
- Browser checks, if the local environment permits:
  - newly collected artifact card;
  - museum replay card (no collection callback);
  - longest entry at desktop and narrow/mobile viewport sizes;
  - scrolling, dismissal, image fallback, and clean console.

## Scope boundary

No gameplay, artifact spawning, collection progression, API session behavior,
museum population, audio, guardian, arena, or asset changes are included.

---

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

### Updated encounter contract (approved 2026-07-22)

- Keep the stationary bangkâ, aim-only controls, parallax river, Boat Integrity,
  Lumina rewards, shared arena lifecycle, and existing Zone 2 return/reward flow.
- Replace the fixed wave clock with continuous seeded pressure and add a boss phase
  after the third correct bugtong. Timers advance only while pointer lock is active.
- Core loop: aim and shoot to repel river threats and reflect attacks while the
  three-stage HUD clock creates visible riddle milestones; correct answers remove
  wards, then direct and reflected hits defeat The Reveler.

### Random river pressure

- Draw a spawn group every 3–5s with an eight-threat cap that includes pending
  portals. Size 1 is a random sniper or boarder; size 2 is one of each; size 3 is a
  randomized 2/1 mix. If no threat remains, queue the next portal within 0.5s.
- Sample all spawn points from the open-water channel (`x` about -6.5…6.5), using
  separate forward sniper and upstream boarder depth bands plus minimum separation
  from live and pending threats. Never place a portal on the scrolling banks/trees.
- Riddle entry stops the scheduler and cancels pending portals. Materialized enemies
  continue at the existing 65% riddle-speed scale; spawning resumes one second after
  a correct answer unless that answer starts the boss.

### Three-stage riddle clock and answer volley

- Add a read-only, three-segment meter to the top boss frame. Riddles become due at
  cumulative encounter times 0:20, 0:55, and 1:30. Completed segments remain full,
  the current segment fills with a fixed-width `Riddle n in 0:ss` label, and later
  segments remain empty. During a riddle/retry it reads `Riddle n active` and freezes.
- Preserve the 3s prompt-only reveal, then create all three shuffled answer lanterns
  simultaneously at the boss. Move them over 1s to the exact river midpoint between
  boss and boat, where they stop on one horizontal line at x = -4.5 / 0 / +4.5.
  Hold that wide formation visible but inert for a separate 3s reading beat, then
  launch all three together for the existing 6s attack flight. Keep 18 wrong-shot
  damage, 25 missed-correct damage, 3s retry, and reshuffle.
- Hide the segmented clock at the boss handoff and show The Reveler's health track.
  Put rail-only timer CSS in `_partials/rail-arena-hud.css` so the existing 919-line
  arena HUD stylesheet remains safely below the repository's 1000-line limit.

### Reveler boss and movement

- Add `RevelerBoss` on the shared `ArenaBoss` contract: 100 HP, the existing 2.3m
  chest hit sphere, and phase thresholds at 66% and 33%. The final answer deflection
  finishes before pre-boss threats are cleared and an opening boss group is queued.
- Move among safe left/center/right river anchors without immediately repeating one.
  Telegraph for 0.45s and ease the lateral hop over 0.6s. Pause movement while a boss
  projectile formation is charging so its targets remain readable.
- Continue enemy summons under the shared cap: Phase I groups 1–2 every 3.5–5s;
  Phase II groups 1–3 every 3–4.5s; Phase III groups 2–3 every 2.5–4s. Each enrage
  opens with an immediate three-enemy group.

### Boss projectile formations

- Add a fixed-size pooled projectile formation owned by the boss. Spawn 1–2 orbs in
  Phase I, 2–3 in Phase II, and 3–5 in Phase III around the guardian's chest. The
  orbs orbit/follow the chest and charge visibly for exactly 2s.
- Orbs are reflectable from their first charging frame. A player bolt sends one into
  a homing return that follows the boss's current chest and deals 5 boss damage.
- After the shared charge, every unreflected orb receives an independently randomized
  0–0.9s launch offset, then fires at the boat. Fired orbs remain reflectable and deal
  15 Boat Integrity damage on impact.
- Only one formation may be active. Once it resolves, draw the next formation cooldown
  from 5–7s in Phase I, 4–6s in Phase II, or 3–5s in Phase III.

### Retry, interfaces, and verification

- Death before the boss redraws riddles and restarts the complete run. Death during
  the boss keeps all wards broken and restarts only the boss at full health.
- Extend the rail combat manager with random-group spawning and pending cancellation;
  extend `CombatHud` with riddle-clock show/update/hide calls; keep Arena 1 and Arena 3
  contracts unchanged. Preserve existing procedural art, audio, VFX, and rewards.
- Verify JavaScript syntax, whitespace, imports, and the 1000-line cap, then browser-
  smoke spawn cadence/bounds/caps, riddle pausing and every lantern outcome, all timer
  states, boss hops/formations/reflections/summons/phases, both retry scopes, responsive
  HUD fit, Arena 1/3 regressions, and the Zone 2 Soul/artifact return.

### Implementation outcome

- Random river pressure, the cumulative segmented clock, simultaneous protected
  lantern volleys, boss-only retry, Reveler movement/summons, and the pooled reflected
  projectile formations are implemented in focused Arena 2 modules.
- Repository-wide JavaScript syntax checks, dead-reference searches, `git diff --check`,
  relative-interface inspection, and the 1000-line audit pass.
- Live browser, responsive-layout, and complete playthrough verification remains
  pending because permission to launch the local headless browser was declined. No
  runtime, visual, audio, or gameplay-balance pass is claimed.

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

### Phase 5F — tower combat and summit boss upgrade (approved 2026-07-22)

**Player contract:** four fixed Gargoyle sentries shape the climb while seeded Gale
flyers pressure the player's current height. The open summit ring becomes a supported
octagonal deck and the existing Keeper body drives a three-phase action boss. Ascent
deaths reset the tower; boss deaths restart on the summit with opened seals preserved.

- Author four fixed Sentinel anchors near 2.8/7.2/11.8/16.2 m. Construct them at
  ascent start without portals; use a 0.6 s wing-slam tell, 18 damage, 5.2 knockback,
  and 1.4 s cooldown. Suppress markers outside the nearby vertical tier.
- Spawn Gales through woven tears after seeded 7–10 s and then 6–10 s delays. Place
  them at seeded points inside a central-shaft circle, hold their X/Z position, follow
  the player vertically only, telegraph for 0.45 s, and cap the encounter at two
  Gales/six lesser threats.
- Replace the summit shaft/ring with an 18 m octagonal deck, continuous support,
  perimeter rails, 3.2 m bridge entrance, four add anchors, and a 6.8 m boss bound.
- Give the Keeper 60 HP with thresholds at 66%/33%. Shot intervals are
  2.8/2.2/1.7 s; charge ranges are 8–10/6.5–8.5/5–7 s; summon ranges are
  11–13/9–11/7–9 s. Phase groups are `1 Gargoyle`, `1 Gargoyle + 1 Gale`, and
  `2 Gargoyles + 1 Gale` under the shared caps.
- Charge locks direction after a 0.9 s gold lane tell, moves at 9.5 m/s, deals
  24 damage plus 6.5 knockback once, and recovers for 1.1 s. Pause shot/summon
  clocks during charge. Phase changes flare invulnerable for 1 s and summon once.
- At boss entry clear ascent threats, portals, and projectiles; freeze tide at no
  more than 15 m. At boss retry spawn at `(0, 19.62, 5.5)` with boss systems reset.
- Keep the ascent HUD through the climb. At boss entry switch to the shared boss
  health bar and `Summoned Echoes` count. Extract tower CSS to its own partial.
- Use custom primitive overlap/collision and seeded attempt RNG; add no dependency,
  asset, audio, post-processing, touch-control, or progression changes.

**Verification:** repository syntax, pause tests, imports, whitespace, duplicate IDs,
and 1000-line audit; then browser-play ascent threats, summit bounds, three boss
phases, both retries, pause, HUD fit, victory return, and Arena 1/2 regressions.

**Encounter guide:** document the shipped Arena 3 loop in `Arena3.md`, mirroring the
player-facing structure of `Arena1.md`. Keep source-owned tuning values, retry rules,
HUD transitions, and code ownership explicit, including the corrected center-circle,
vertical-only Gale movement. This documentation step does not change gameplay.

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

## Guardian Debug Zone (2026-07-22)

### Player-facing contract

- A config-gated **Guardian Debug Zone** title button skips the intro and descend
  overlay and enters a dedicated free-roam `debug` phase.
- The flooded room presents Guardian 1 at the front of a triangle, with Guardians
  2 and 3 behind-left and behind-right. They keep their existing body animation,
  face one fixed forward direction, never roam, and render without locator beacons
  or labels.
- The player starts south of the triangle, may walk and sprint around it, collides
  with simple Guardian footprints and the compact boundary, and can only pause/resume.
  Rifts, artifacts, riddles, combat, Souls, and progression do not run in this phase.

### Implementation boundaries

1. Repurpose `src/core/zones/zoneDebug.js` as the small flooded enclosure and export
   authored Guardian placements, fixed facing direction, and player spawn as zone data.
2. Add a focused gallery controller that owns three shared `Guardian` instances,
   placement, hidden beacons, allocation-free fixed-target updates, and disposal.
3. Add a `DebugZoneFlow` partial for scene swapping, subsystem cleanup, collision /
   ground callback injection, pointer-lock entry, and debug state initialization.
4. Extend `Game.animate()` and UI lock/unlock handling for the `debug` phase; add the
   gated title button and `CONFIG.DEBUG_GUARDIAN_ZONE_BUTTON` (default `false`). Keep
   legacy `CONFIG.DEBUG_ZONE` behavior independent and preserve normal game state.

### Verification

- Run `node --check` on every touched JavaScript module, `git diff --check`, and the
  repository-wide 1000-line audit.
- Serve over HTTP and verify flag-off/flag-on menu behavior, direct entry, all three
  variants and idle facing, hidden beacons, collision from multiple angles, no action
  triggers, ESC/resume, resize, hard refresh, nonblank canvas, and a clean console.
- A screenshot baseline harness and bot playtest are intentionally skipped: this is a
  narrow developer-only showroom with no objective, difficulty, or release claim.

### Screenshot lineup correction (2026-07-22)

- Replace the triangle with one row at `z = 0`: Zone 2 at `x = -9`, Zone 1 at
  `x = 0`, and Zone 3 at `x = 9`. Nine-unit center spacing preserves visible gaps
  around the models' animated orbiting details while remaining inside the enclosure.
- Replace the shared inward focus point with a shared +Z facing direction. Cache one
  target per Guardian at construction so every body faces the screenshot/player side
  without tracking movement or allocating vectors per frame.
- Keep the nearby south spawn, free-roam controls, collision footprints, hidden
  beacons, flooded atmosphere, and continuous idle animation unchanged.

### Final triangle staging (2026-07-22)

- Keep Guardian 1 centered but advance it to `(0, 2)` as the triangle's front
  apex. Move Guardian 2 to `(-8, -4)` and Guardian 3 to `(8, -4)` as the rear
  corners. The diagonal center distances remain ten units, preserving clear gaps.
- Keep the shared +Z screenshot-facing direction rather than restoring inward
  tracking. Keep the player at the nearby south spawn, looking toward the group.

### Clean debug capture (2026-07-22)

- On direct debug entry, hide `ViewModel.group` and remove the crosshair before
  pointer lock. In the debug-specific pointer-lock resume branch, keep the crosshair
  removed instead of restoring it.
- Leave the normal playing and arena UI branches untouched so their hand/crosshair
  behavior remains unchanged. No new toggle or screenshot UI is added.

---

## Arena Guardian Beacon and Halo Removal (2026-07-22)

- Extend `Guardian` with an optional effects object that defaults beacon and halo
  construction on. When disabled, do not allocate or attach the beacon mesh,
  beacon material, or chest `PointLight`; make animation and disposal null-safe.
- Add `{ beacon: false, halo: false }` to Arena 1 and Arena 2 zone definitions and
  pass those options through `ArenaFlow` when constructing their shared Guardian.
- Arena 3 remains unchanged because it uses `TowerKeeper`, not the shared Guardian
  shell. The debug showroom continues using default effects, then hides only its
  beacon as already designed.
- Verify construction, fade/update, defeat, reset, and disposal paths statically;
  manually confirm no column or chest light appears during Arenas 1 and 2.

---

## Guardian Body Glow VFX (2026-07-22)

### Visual contract

- Keep all three existing authored silhouettes and idle animations unchanged.
- Guardian 1 continuously pulses warm-gold chest and rune details, with its existing
  jade elements remaining secondary.
- Guardian 2 continuously pulses its amber tide-pool core and cooler cyan eyes,
  rings, and tentacle tips.
- Guardian 3 continuously pulses its gold Heart of Memory and body cracks, with a
  weaker cyan crystal-crest response.
- Apply the same material behavior wherever each builder is used, including Arenas
  1–3 and all three Guardian debug-zone copies.

### Technical approach

1. Add one shared arithmetic-only emissive pulse helper to guardian primitives. It
   updates existing `MeshStandardMaterial.emissiveIntensity` values and performs no
   allocation in the frame loop.
2. Drive only existing semantic accent materials from each body builder's `animate`
   callback. Use distinct phase/speed values to avoid synchronized flashing while
   keeping a slow, slight pulse.
3. Do not add PointLights, locator columns, particle systems, textures, shaders, new
   geometry, or post-processing passes. Existing bloom may pick up the emissive
   surfaces, so intensity remains deliberately restrained.
4. Preserve fade/defeat behavior by multiplying each emissive pulse by the builder's
   existing visibility factor.

### Verification

- Syntax-check every changed JavaScript module; audit relative imports, file lengths,
  and whitespace; inspect the focused diff for unrelated gameplay changes.
- Manually compare all three arena Guardians and debug copies against the references,
  checking that body accents pulse gently without washing out silhouettes or bringing
  back beacon/halo lighting in Arenas 1 and 2.
- A visual regression harness is not added for this narrow material-only pass; final
  appearance and live renderer diagnostics remain browser-verification items.

---

## Per-Enemy Arena Spawn Portals (2026-07-22)

### Player-facing contract

- Every lesser enemy receives an individual woven-light portal at its exact spawn
  position in Arenas 1, 2, and 3, including wrong-answer penalties and reinforcements.
- The portal telegraphs for exactly one second. Its enemy does not exist visually,
  collide, move, aim, attack, or count as an available target during that second.
- At the one-second mark, the portal flashes outward, the enemy begins its existing
  materialization lifecycle, and its current AI/combat behavior continues unchanged.
- All arenas reuse the same teal/cyan portal treatment and synthesized summon cue.
  Guardians and the Tower Keeper are excluded because they are persistent encounter
  actors rather than wave-spawned lesser enemies.

### Technical approach

1. Change `COMBAT.SPAWN_TELEGRAPH` to `1` and make `CombatManager` own one generic
   pending-spawn queue. A queued record stores the enemy type, exact portal position,
   and a construction callback; pending records count toward wave/capacity checks.
2. Reuse the existing pooled `CombatVfx` rings and shards to form the portal: two
   inward-winding ground rings plus rising thread-like fragments, followed by a short
   outward arrival pulse. Keep the fixed pools and avoid dynamic lights or per-frame
   allocations.
3. Route Arena 1 `Enemy`, Arena 2 `RailThreat`, and Arena 3 `TowerThreat` creation
   through the shared queue. Preserve authored rail positions, tower anchors, seeded
   rail behavior, HP/drop metadata, maximum-enemy caps, HUD counts, and event banners.
4. Add one procedural `AudioManager.playEnemyPortal()` cue using the established Web
   Audio SFX bus. A short retrigger guard collapses simultaneous per-enemy calls into
   one audible batch cue, preventing stacked waves from clipping while every portal
   still uses the same timing and visual contract. No external audio asset is needed.
5. Clear pending records and pooled portal visuals on abort, faint, victory, stop,
   disposal, and arena transition so delayed enemies cannot appear after teardown.

### Verification

- Statically verify all `new Enemy`, `new RailThreat`, and `new TowerThreat` arena
  paths are queued, including `spawnExtra()` and `spawnPenaltyGargoyle()`.
- Verify pending enemies affect wave/cap counts but cannot be shot, tracked, collide,
  or emit attack/projectile intents before materialization.
- Run `node --check` on touched modules, `git diff --check`, relative-import checks,
  and the repository-wide 1000-line audit.
- Browser-smoke Arena 1 waves/penalties, Arena 2 simultaneous river waves, and Arena 3
  stage/penalty spawns; confirm one-second timing, portal/audio sync, clean abort/retry,
  clean console, and no delayed post-victory spawn.
- Skip a persistent screenshot-baseline harness and bot playtest: this is a narrow,
  dynamic VFX timing change with no release-ready or difficulty claim. Manual browser
  timing and interaction checks are the meaningful final evidence.

### Skill and sourcing ledger

- Loaded: `threejs-game-director`, `threejs-gameplay-systems`,
  `threejs-audio-generator`, and `threejs-qa-release` guidance.
- References loaded: gameplay workflows, game feel, audio workflows, QA/release,
  visual verification, playtest QA, and release checklists.
- External generation: skipped because this project deliberately synthesizes SFX in
  Web Audio and the portal is a repeated support surface served by existing pools.
- Out of scope: AAA graphics, UI redesign, physics, generated 3D/image assets, and
  release packaging.

### Verification outcome

- Repository-wide JavaScript syntax checks passed.
- `git diff --check` passed and no JavaScript or Markdown file exceeds 1000 lines.
- Static spawn-path inspection confirms every Arena 1, 2, and 3 lesser-enemy
  constructor is behind `_queueEnemySpawn()`, including both penalty entry points.
- Pending spawns participate in wave/cap counts and are cleared by abort, stop, and
  disposal paths; only materialized enemies reach collision, targeting, or AI loops.
- Browser/canvas verification remains pending because permission to start the local
  HTTP server was declined. No visual, console, or live audio pass is claimed.

---

# Arena 1 — Wave Cap, Wrong-Answer Lockout, and Feastkeeper Boss (2026-07-22)

## Context

Arena 1 ran endless waves with riddles on a wall clock, a wrong answer cost almost
nothing (shoot the next node immediately), and the Feastkeeper was a prop that
`defeat()`d once its armor pips were gone. The encounter had no shape, no cost for
guessing, and no climax.

## Design

- **Bounded run.** `ARENA.TOTAL_WAVES = 10`; clearing one of `ARENA.RIDDLE_WAVES`
  (3, 6, 10) opens that round's bugtong and **holds** the wave clock until it is
  answered, so the player answers under the pressure already on the field.
- **Wrong answer = lockout, not damage.** The wrong node shatters, the remaining
  choices go inert (`AnswerNode.setInert`), and a chaser+spitter penalty squad
  spawns. Only when that squad is dead do the nodes relight for another attempt at
  the same riddle. No HP is deducted — the fight is the punishment.
- **Boss phase.** Breaking the last armor layer stops the waves, poofs the leftover
  adds, and hands the fight to `arena/FeastkeeperBoss.js`: telegraphed spits on a
  per-phase interval, summons of 1/3/5 echoes on an independent randomized clock, and
  two enrage thresholds (66% / 33%) that shorten both and open with a brief
  invulnerable summon flare.
- **Boss frame.** `#boss-bar` replaces `#guardian-wards`: guardian name, a health
  track that only appears once the boss is damageable, and the armor pips beneath it.
  The ghost-fill drain is now shared by the player and boss bars in `CombatHud`.
- **Faint scope.** Dying during the boss resumes at the boss (`restartAfterFaint`);
  dying earlier restarts the encounter as before.

## Reuse

`FeastkeeperBoss` drives the existing `Guardian` instance rather than building a body,
follows `arena/TowerKeeper.js`'s shape, and routes every projectile, summon, and VFX
call through `CombatManager` — so player damage, thread-tear spawn telegraphs, and
pooling all work unchanged. Rail and Tower managers override `startFight`/`update`
wholesale and are untouched; `CombatHud.setWards` remains as a shim over `setBoss`.

## Verification

Syntax-checked every touched module, confirmed no `RIDDLE_FIRST`/`RIDDLE_CADENCE`/
`_roundActive`/`elWards` references survive, and confirmed all files stay under the
1000-line limit. Browser verification is pending with the user.

## Follow-up: boss tuning moved out of config into an ArenaBoss hierarchy

`ARENA.BOSS` was removed from [src/config.js](src/config.js). A shared block there
would have become a dumping ground for three unrelated fights, and the numbers only
mean anything next to the code that reads them.

- **`arena/ArenaBoss.js`** — the contract every zone's boss shares: hp/maxHp, armor
  flares before the boss phase (`testArmoredHits`/`pingArmored`), the chest-sphere
  bolt test, `damage()`, phase escalation against `PHASE_THRESHOLDS` with an invuln
  flare, defeat, the pointer-lock pause guard, and scratch-backed `center()`/`aimAt()`.
  `BOSS_DEFAULTS` holds only contract-level numbers (HP, hit radius, thresholds,
  enrage window); a subclass spreads its own over them via `super(..., TUNING)`.
- **Subclass hooks** — `_act(dt, playerPos)` is the fight, `_onPhaseChanged(phase)`
  is the enrage, `_onDefeated()` is the death beat. A boss that implements none of
  them simply stands and takes hits.
- **`arena/FeastkeeperBoss.js`** — now ~100 lines: `FEASTKEEPER_TUNING` plus its
  two-clock attrition mechanic (telegraphed spits on one timer, randomized 1/3/5
  summons on another). Zone 2 and Zone 3 bosses subclass the same shell with
  entirely different `_act` bodies and their own tuning constants.

---

# Global Focus Pause Hardening (2026-07-22)

## Confirmed behavior

- Escape, window blur, and `document.visibilitychange` share one pause path.
- Pause covers zones, museum, arenas, debug, discovery/faint, intro, and endings;
  static title/descend/completion/credits screens need no second overlay.
- Every game clock, encounter, projectile, telegraph, buff, transition, and wait
  freezes. Music continues quietly; SFX is muted.
- Returning focus does not resume. A Resume click requests pointer lock when needed,
  and Pause remains active until controls emit a successful `lock` event.

## Design

1. Add `core/_partials/GamePause.js` as the sole pause-state owner. Bind blur,
   visibility, and pointer-lock signals; coalesce duplicates; distinguish intentional
   unlocks; own Resume UI; and expose pause, resume, and active-time waits.
2. Replace phase-specific unlock UI branches in `GameUI` with the controller.
   Preserve the settings gear and contextual copy, but use Resume—not Descend—in
   normal play and every arena. A failed/denied lock request leaves Pause visible.
3. In `Game.animate`, keep the single RAF/render owner alive but skip every scene,
   simulation, cutscene, and UI update while paused. Accumulate a game-time value
   only on active frames so shader/encounter time cannot jump after a hidden tab.
4. Move gameplay wall-clock delays, the tower slow penalty, and combat HUD cleanup
   to pausable active time. Network latency and quiet Web Audio music remain real time.
5. Clear player keys, velocity intents, `holdKey`, `_ePressed`, queued fire, and
   transient pointer input on pause. Add `AudioManager.setPaused` to ramp music to
   a quiet fraction, mute SFX/ending buses, and restore the user's saved volumes.

## Verification

- Syntax-check every JavaScript module, run `git diff --check`, validate relative
  imports, and enforce the repository-wide 1000-line limit.
- Browser-test Escape, Alt-Tab, tab switching, minimizing, repeated blur/visibility/
  unlock events, failed lock acquisition, Resume, settings, and rapid pause/resume.
- Exercise zones, museum, Arenas 1–3 (riddles, bosses, portals, buffs, tide/slow),
  debug, discovery, faint, intro, and ending; confirm frozen state and clean console.
- Debug references loaded: `debug-profile-checklists.md` and `scene-debugging.md`.
