# Implementation Plan — Arena 3 Summit Portal → Arena 3 Boss Keeper Fight (2026-07-29)

## Goal

Arena 3's summit stops being the boss deck. After the third bugtong seal opens and
the player crosses the bridge, the deck holds a **portal**; walking into it
transfers the player to a **new arena (`arena3boss`)** where the Keeper of Memories
fight happens, intro cutscene and all. Winning `arena3boss` returns to Zone 3 exactly
as winning Arena 3 does today — same collapse, same artifact scatter, same
Guardian Soul drop, same zone completion.

## Confirmed direction (answered by user)

| Decision | Choice |
| --- | --- |
| Keeper of Memories | Moves to the new arena; the summit becomes portal-only |
| New arena | New `arena3boss` module — traversable scaffold now, real design specced later |
| Portal interaction | **Walk into it** — no prompt, no key |
| Tide on the summit | **Keeps rising** — the portal is a timed escape, dawdling still drowns |
| Death in `arena3boss` | Retry the Keeper in place; the tower climb is not repeated |
| `arena3boss` water | Static — no rising tide during the boss fight |
| Boss intro cutscene | Plays on arrival in `arena3boss` |

## Current behaviour being replaced

- `TowerArenaController._updateAscent` (lines 216–223) flips `ascent →
  guardian-intro` the moment `gates.allOpen()` and the player is at summit height
  inside the deck perimeter.
- `Game.animate` consumes that via `arena.consumeGuardianIntroRequest()` and calls
  `_runGuardianIntroduction`, which ends in `completeGuardianIntroduction()` →
  `_beginBossPhase()` — the Keeper fight, on the same deck, in the same world.

## Design

### Split of responsibility

`TowerArenaController` currently owns two encounters (the timed ascent **and** the
Keeper boss). Since they now live in different worlds, it is split by
responsibility rather than partialled:

- **`TowerArenaController`** (arena3) — tide, gates/seals, lumina, ascent HUD, and
  the new summit portal. All Keeper code removed.
- **`KeeperArenaController`** (arena3boss, new) — the Keeper fight, lifted essentially
  verbatim from the boss half of the current controller: boss HUD, lumina, event
  banner, static water, guardian-intro hooks, retry-in-place.

Both stay comfortably inside the 1000-line limit and each has one reason to change.

### Portal ownership

`arena3.js` is a geometry module — it publishes *anchors*; gameplay objects are
built by controllers (the same rule `TowerGateManager` already follows for the
seal veils). So:

- `arena3.js` publishes `world.towerSummitPortalAnchor` (deck-centre position,
  facing rotation, trigger radius).
- New **`src/core/arena/SummitPortal.js`** builds the visual + trigger at that
  anchor, owned by `TowerArenaController`.

The portal reuses `createVortexMaterial` from `museum/PortalVortex.js`, the same
shader behind the hub portals and the Memory Rift, so it reads as the established
"doorway between memories" motif. Sealed = dark and inert; the third seal opening
lights it and arms the trigger.

## Step-by-step

1. **`src/core/zones/arena3.js`**
   - Drop `world.towerBossAddAnchors` (no adds spawn here any more).
   - Keep `world.towerSummitBounds` — the controller still reads `radius` for the
     perimeter test.
   - Publish `world.towerSummitPortalAnchor` at the deck centre, rotated to face
     the bridge entry.
   - Add `nextArenaId: 'arena3boss'` to the zone definition.

2. **`src/core/arena/SummitPortal.js`** (new) — vortex panel + stone frame + halo,
   `setOpen(bool)`, `update(dt, t)`, `contains(playerPos)` trigger test,
   `collidesPlayerAt` for the frame jambs only (the panel is walk-through),
   `dispose()`.

3. **`src/core/arena/TowerArenaController.js`**
   - Remove `TowerKeeper` import, `_createKeeper`, `_beginBossPhase`,
     `_updateBoss`, `_beginBossRetry`, the boss HUD calls, and every
     guardian-intro hook.
   - Build the portal in `begin()`; keep it in sync with `gates.allOpen()`; when
     the player enters its volume set `_transferRequested`.
   - Add `consumeArenaTransferRequest()`.
   - Tide logic untouched — it keeps rising on the deck, as chosen.
   - `restartAfterFaint` → always a full `begin()` (there is no boss phase here).
   - `getRetryPoint()` → `null`.
   - Presenter skip: `presenterSkipToBoss()` opens all seals and requests the
     transfer, so Shift+P still lands the demo at the boss, one world over.

4. **`src/core/arena/KeeperArenaController.js`** (new) — the boss half, moved.
   Keeper constructed in `prepareGuardianIntroduction(combat)` so the intro
   cutscene has a body to frame; `completeGuardianIntroduction()` starts the
   fight; `restartAfterFaint(combat)` re-runs the boss in place;
   `getRetryPoint()` returns the deck stage point.

5. **`src/core/zones/arena3boss.js`** (new, scaffold) — a standalone octagonal Keeper
   deck built at the **same height (18) and radius (9)** as the tower summit, so
   the Keeper's authored tuning, camera framing and add-spawn distances need zero
   retuning. Perimeter rails, static low water, arena3's palette/fog. Publishes
   `towerSummitBounds` + `towerBossAddAnchors` so `TowerCombatManager` and
   `TowerKeeper` work unchanged. `controller: 'keeper'`, `spawnGuardian: false`.
   Clearly marked as a placeholder awaiting the real design.

6. **`src/core/zones/index.js`** — register `arena3boss`.

7. **`src/core/_partials/ArenaFlow.js`**
   - `arenaTypes`: `controller === 'keeper'` → `TowerCombatManager` +
     `KeeperArenaController`.
   - New `_transferArena(arenaId)`: same flash/load as `_enterArena` but
     **preserves `this._returnZone`**, so winning `arena3boss` still returns to
     Zone 3 rather than to Arena 3.
   - Pass `this.combat` into `prepareGuardianIntroduction?.()` (existing
     implementations ignore the extra argument).

8. **`src/core/Game.js`** — in the `phase === 'arena'` block, after the
   guardian-intro check, consume `arena.consumeArenaTransferRequest?.()` and call
   `_transferArena(this.world.zone.nextArenaId)`.

9. **`src/cutscene/GuardianIntroCutscene.js`** — add an `arena3boss` entry to `INTRO`
   and route the existing arena3 shot list for `arena3boss`, so the Keeper cinematic
   plays on arrival. (Flagged for re-authoring once `arena3boss`'s real geometry lands.)

10. **`src/audio/AudioManager.js`** — add an `arena3boss` intro palette (clone of
    arena3's) so it does not fall back to arena1's sawtooth.

## Risks

- **`_returnZone` clobbering** — the main correctness risk. `_enterArena` sets it
  from `currentZone`; a naive reuse would make `arena3boss`'s victory dump the player
  back into Arena 3. Hence the separate `_transferArena`.
- **Keeper coupling to tower geometry** — mitigated by building `arena3boss`'s deck at
  identical height/radius and publishing the same `world.tower*` keys.
- **Presenter skip contract** — Shift+P must still reach the boss and still win
  it; verified across both controllers.

## Verification

No test/lint tooling in this repo. `node --check` every touched file, confirm the
1000-line limit holds, then **manual in-browser verification by the user**:
climb → three seals → walk into the portal → Keeper intro → fight → die once
(retries at the Keeper) → win → Zone 3 scatter and Soul → zone completes.
