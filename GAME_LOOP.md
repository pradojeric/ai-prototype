# Game Loop

State machine lives in `Game.js` via `this.phase`:

```
title → cutscene → descend → playing → encounter → defeat/faint → playing → complete → museum → (next zone) descend → ...
```

## 1. Title → Intro Cutscene

- **Trigger:** page load shows title screen; player clicks it (or clicks "skip" to jump straight to museum).
- **Player action:** click only.
- **State change:** `IntroCutscene` plays over the `Museum` scene (borrowed render pass/camera); `phase='cutscene'`.
- **Transition:** on cutscene end, `_showDescend()` sets `phase='descend'`, shows the zone label + Start button.

## 2. Descend → Playing (per zone)

- **Trigger:** click Start → `player.controls.lock()` → pointer-lock `'lock'` event fires `_startGameplayPhase()`.
- **Player action:** wade around zone; guardian hint (`elGhint`) shown since `bossDefeated=false` (no artifacts exist yet — `ArtifactManager` starts empty until scatter).
- **Transition:** find the Guardian.

## 3. Guardian Encounter (riddle gate)

- **Trigger:** player walks within `GUARDIAN.ENCOUNTER_RANGE` of the (waiting, non-roaming) Guardian and taps E (`_startEncounter`, `src/core/Game.js:262`).
- **Player action:** answers `RIDDLE_COUNT` multiple-choice bugtong riddles one at a time via `RiddleScreen` (riddle content/`drawRiddles` in `src/data.js:217`; per-zone Guardian classes in `src/core/guardians/*`).
- **Win:** all riddles correct → `_defeatGuardian()`: scripted `DefeatCutscene`, guardian explodes, `artifacts.scatter(origin)` bursts artifacts out from the guardian's position, `bossDefeated=true`. Returns to `phase='playing'` with HUD (artifact counter) active.
- **Lose:** any wrong answer → `_faintAndRespawn()`: guardian rebukes player, teleports away and resumes roaming, player faints (black-out `FaintCutscene`), respawns at the zone dock. Riddle sequence resets to riddle 1 on the next attempt.

## 4. Artifact Collection (post-Guardian) — gated by wave combat

- **Trigger:** artifacts (defined per-zone in `ARTIFACT_DATA`, `src/data.js`) are now visible in `ArtifactManager` (`src/core/ArtifactManager.js`), spawned from `world.spawnNodes` positions, only `ARTIFACT_BATCH` per visit — but each starts **contested** (`CombatManager.isContested`, `src/core/combat/CombatManager.js`).
- **Wave fight:** the first hold-E on a contested artifact interrupts the reach and spawns `COMBAT.WAVES` waves of enemies ("drowned echoes": melee chasers + ranged spitters, `src/core/combat/Enemy.js`) around it. The player casts light-bolts from the hand's lure with left click (`src/core/combat/ProjectilePool.js`); all tunables in `COMBAT` (`src/config.js`).
  - **Win:** all waves cleared → the artifact id joins `combat.clearedIds` (per zone visit) and it collects normally.
  - **Lose:** player HP hits 0 → `_combatFaint()` reuses the shared faint respawn (`_faintOnly`): fight aborts, HP refills, artifact stays contested for a re-try.
  - **Leash:** walking > `COMBAT.LEASH_RADIUS` from the artifact resets the fight.
- **Player action (once cleared):** walk near an artifact (fishing-line "String" visual pulls toward it), hold E for `HOLD_TIME` seconds (`_updateHold`) to trigger `_completeInteract` → shows `DiscoveryScreen` card, then `artifacts.collect()`.
- **State change:** artifact id added to `collectedByZone[zone]` (persists across zone reloads this session).
- **Branch:**
  - `batchComplete` (this visit's batch done, more remain in zone) → `_batchComplete()` completion card → back to Museum, must re-descend for next batch.
  - `zoneComplete` (all zone artifacts recovered) → `_zoneComplete()`: marks zone done, `museum.unlockPortal(nextZoneNumber)`, shows zone-complete card.

## 5. Museum Hub

- **Trigger:** click completion card → `_enterMuseum()`.
- **Player action:** free-roam the walkable `Museum` (`src/museum/Museum.js`), which is `populate()`d with frames of all collected artifacts (re-readable via E), and has portals to each zone (locked/dimmed until unlocked).
- **Transition:** walking into an unlocked portal's corridor (`museum.portals`, radius check) triggers `_enterZoneFromHub(zoneId)` → `_loadZone` tears down old World, builds new zone (`createWorld` in `src/core/zones/index.js`), resets Guardian/ArtifactManager/state, spawns at dock, shows Descend screen — loop restarts at stage 2 for the next zone.

## 6. End of game

- Zone order is `['zone1','zone2','zone3']` (`this.zoneOrder`). Completing zone3 unlocks nothing further (no zone4) — the loop ends with all three portals unlocked and the museum fully populated as the final "collection display" state. There is no separate scripted ending beyond this — the Museum hub itself serves as the endgame/collection showcase.

## Key files

- `src/core/Game.js`
- `src/core/combat/CombatManager.js` (+ `Enemy.js`, `ProjectilePool.js`)
- `src/core/ArtifactManager.js`
- `src/core/Guardian.js`
- `src/core/guardians/*.js`
- `src/museum/Museum.js`
- `src/data.js`
- `src/core/zones/*.js`
