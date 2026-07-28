# Implementation Plan — Combat Damage Numbers & BLOCKED Text (2026-07-28)

## Goal

World-space floating combat text for every arena: damage the player deals,
damage the player takes, `BLOCKED` on guardian-shield hits, and armor-break /
phase callouts.

## Decisions (from user)

- **Placement:** world-space floating labels, projected from the 3D impact point,
  rising and fading. Not crosshair-anchored.
- **Scope:** all four event classes — player-dealt damage, BLOCKED, player-taken
  damage, armor-break/phase callouts.
- **Arenas:** all three (Feastkeeper, Reveler rail, Tower Keeper) via one shared
  system.
- **Wording:** plain English `BLOCKED`.

## Design

One pooled DOM overlay owned by `CombatHud`, following the existing
`_buildPool` / `.active`-class convention. No new framework, no per-frame
allocation, no nodes created mid-fight.

### New file — `src/ui/_partials/CombatPopups.js`

`CombatHud.js` is 407 lines; adding a projected-label system with its own
lifecycle would push it toward the cap and mixes two concerns. Extract per the
frontend `_partials/` rule.

```
class CombatPopups {
  constructor(containerId, count)   // pre-creates `count` .combat-popup divs
  setCamera(camera)
  spawn(worldPos, text, kind)       // kind: 'damage' | 'player' | 'blocked' | 'callout'
  update(dt)                        // ages slots, reprojects live ones, writes transform/opacity
  clear()
  dispose()
}
```

Slot state: `{ life, max, x, y, z, rise, jitterX, el }`. World anchor is copied
once at spawn (the impact point does not follow the body — a corpse or a moving
boss would drag the number off the hit). Each frame a live slot:

1. copies its anchor into a scratch `Vector3`, adds `rise * elapsed` on Y,
2. `project(camera)`; slots behind the camera (`z > 1`) hide rather than mirror
   (same guard `trackThreats` already uses),
3. writes `translate(px, px)` + `opacity` — transforms only, no layout reads.

Overlapping hits get a small deterministic horizontal jitter (cycled per slot
index, not random) so a burst of bolts does not stack into one illegible blob.

Pool reuse takes the slot with the least life remaining, matching `damageFrom`.

### `CombatHud.js` additions (thin delegation only)

- construct `CombatPopups('combat-popups', HUD.POPUPS)`
- `setCamera(camera)` → forwards; called once by `CombatManager`'s constructor
  so `update(dt)` can reproject without a camera argument
- `popupDamage(pos, amount)` / `popupPlayerDamage(pos, amount)` /
  `popupBlocked(pos)` / `popupCallout(pos, text)`
- `update(dt)` drives `popups.update(dt)`; `hide()` and `_clearOverlays()` clear
  them; `dispose()` disposes.

### Markup + style

- `index.html`: `<div id="combat-popups"></div>` beside `#dmg-arcs`.
- `_partials/arena-hud.css`: `#combat-popups` fixed full-screen, `pointer-events:
  none`, same `z-index: 7` band; `.combat-popup` absolutely positioned at 50%/50%
  with `will-change: transform, opacity`. Kind modifiers:
  - `.damage` — memory-cyan, the default number
  - `.player` — coral/red, larger, for damage taken
  - `.blocked` — shield gold, letter-spaced uppercase
  - `.callout` — largest, uppercase, used by ARMOR BROKEN / phase text

### `config.js` — extend the existing `HUD` block

```
POPUPS: 16,          // floating combat labels in flight
POPUP_LIFE: 0.85,    // seconds a damage number lives
POPUP_CALLOUT_LIFE: 1.25,
POPUP_RISE: 1.15,    // world units/second the label drifts upward
```

## Call sites (one line each — no logic moves)

| Event | File | Hook |
|---|---|---|
| Player damages a boss | `arena/ArenaBoss.js` `damage()` | after hp is applied, popup the *actual applied* amount |
| Armor break / final shatter | `arena/ArenaBoss.js` `breakArmor()` | `ARMOR BROKEN` / `SHIELD SHATTERED` callout at the chest |
| Phase change | `arena/ArenaBoss.js` `_checkPhase()` | `ENRAGED` callout |
| Blocked bolt | `arena/ArenaBoss.js` `pingArmored()` | `BLOCKED` at the shield surface point |
| Player damages an echo | `combat/CombatManager.js` bolt-vs-enemy pass | popup at the enemy center |
| Player damages a river threat | `arena/RailCombatManager.js` | popup at the impact position |
| Player damages a tower threat | `arena/TowerCombatManager.js` | popup at the enemy center |
| Player takes damage | `combat/CombatManager.js` `_damagePlayer()` | popup at the *source* position, red — inherited by both subclasses |

`ArenaBoss.damage()` clamps hp at 0, so the popup reports `before - after`, never
overkill. `pingArmored` reuses `shieldVfx._shieldSurfacePoint`-style placement via
the position it already receives, so the text lands where the bolt stopped.

## Verification

- `node --check` every touched JS file.
- Grep that no call site passes a bare number where a `Vector3` is expected.
- Confirm the 1000-line cap holds on all touched files.
- Manual in-browser pass by the user (per project convention, no browser
  automation in this repo): all three arenas — numbers on hits, `BLOCKED` on
  pre-armor bolts, red numbers when hit, callouts on each ward break.
