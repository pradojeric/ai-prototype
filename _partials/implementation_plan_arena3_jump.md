# Implementation Plan — Arena 3 Combat Jump (2026-07-28)

## Objective

Make Arena 3 use the combat jump already implemented for Arena 1.

## Scope

- Arm the existing Space-key jump while Arena 3 combat is active.
- Disarm the jump and clear any airborne state when Arena 3 combat stops.
- Show the existing `SPACE TO LEAP` combat callout when the Keeper begins.
- Preserve Arena 3 ascent, tide, collision, progression, and encounter tuning.

## Implementation

1. Update `TowerCombatManager.startFight()` to enable the player's combat jump.
2. Update `TowerCombatManager.abortFight()` to disable the jump and land the player.
3. Reuse `CombatManager.dispose()` for teardown disarming.
4. Update `TowerArenaController` to show the same jump callout used by Arena 1 at
   the Keeper phase transition and boss retry.
5. Update the base manager comment so it accurately describes Arena 3 ownership.

## Verification

- Run `node --check` on the touched JavaScript modules.
- Confirm all relative imports still resolve.
- Confirm touched files remain below the 1000-line hard limit.
- Manually verify in the browser that Space jumps during ascent and the Keeper
  fight, and that leaving/retrying the arena does not preserve airborne state.
