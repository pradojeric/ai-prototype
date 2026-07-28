# Implementation Plan — Presenter Skip (Shift + P)

## Goal

A hidden "magic key" a presenter can hit at any time during a live demo to
fast-forward whatever long beat is on screen — a boss fight, a riddle round, a
cutscene, or the peaceful artifact/Soul collection pass — **without breaking the
normal presentation flow**. Every skip must leave the game in exactly the state
it would have reached by playing the beat honestly: the guardian still implodes,
artifacts and Souls still count as recovered, the zone-complete card still shows,
and the next museum portal still unlocks.

## Decisions (confirmed with the user)

| Question | Answer |
| --- | --- |
| Trigger | Hidden keybind, **Shift + P**, works anywhere |
| Scope | Bosses, riddles, artifacts, Souls, zone completion, cutscenes |
| Shape | **One** context-aware key, not one key per action |
| Outcomes | Preserved — cutscenes/awards/unlocks all still happen |
| Gating | Behind a `CONFIG.PRESENTER` block |

## Design

One new prototype mixin, `presenterSkipMethods`, in
`src/core/_partials/PresenterSkip.js` (Game.js is already 885 lines — well inside
the 1000-line limit, so nothing new goes there beyond the `Object.assign`). It
reads `game.phase` and dispatches to the right fast-forward. The existing
subsystems already expose almost everything needed; the few gaps are filled with
small, explicitly-named `presenter*` methods on the owning class rather than by
reaching into private state from the mixin.

### Dispatch table

| Phase / state | Action |
| --- | --- |
| `cutscene` | `cutscene.skip()` — jumps to the white-fade beat (already exists) |
| `arena`, guardian intro playing | `guardianIntro.skip()` — new; runs the timeline out |
| `arena`, armor phase running | `arena.presenterSkipToBoss()` — new per controller; cuts the waves/bugtong/ascent and hands over to the boss, still fully playable |
| `arena`, boss already up | `arena.presenterWin()` — new per controller; the loop's existing `arena.won` check then runs the normal `_returnFromArena()` |
| `playing`, boss not yet beaten | `_presenterClearZone()` — mark boss beaten, bank every zone artifact + the Soul, `_zoneComplete()` |
| `playing`, collecting | `_presenterClearZone()` — same path, also collecting the live scattered artifacts so their meshes/strings/echoes are torn down |
| `complete` | `_enterMuseum()` — dismisses the completion card (the keypress is a user gesture, so the pointer re-lock is honored) |
| `endingPortal` / `endingMuseum` / `endingRestored` | `.skip?.()` if the cutscene supports it |
| `title`, `descend`, `museum`, `faint`, `debug`, `busy` | ignored — nothing long to skip |

### Skip the armor phase, keep the boss

The armor phase — the wave run, the bugtong rounds, Arena 3's timed ascent — is
the dead air in a demo. The boss is the part the crowd is there for. So a press
inside an arena skips straight to the boss and leaves that fight fully playable;
a second press is what ends the encounter, for when the slot is short.

- `ArenaController.presenterSkipToBoss()` — `_clearRound()`, armor to 0,
  `boss.breakArmor(0)` for the final crack and SHIELD SHATTERED callout, then
  `_startBossIntro()` — the same handoff the last correct answer performs.
- `RailArenaController.presenterSkipToBoss()` — mirrors the final-ward branch of
  `_correctLantern`: wards to 0, shield shatter, deck cleared, 1.4s boss-intro
  beat before the Reveler acts.
- `TowerArenaController.presenterSkipToBoss()` — `_beginBossRetry(combat)`, the
  same path a mid-boss death uses, so the seals finish settled and the tide is
  already at boss height. It is the only controller that returns a
  `getRetryPoint()`, which the mixin uses to stage the player on the summit
  landing via `_spawnAtArenaCenter`.

### Why `presenterWin()` per controller rather than `arena.won = true`

Setting the flag alone leaves live enemies, projectiles, answer nodes, the boss
health bar, and the riddle banner on screen for the ~2s collapse beat before the
return. Each controller already has the correct teardown in its `_win()`;
`presenterWin()` is a thin public door onto it so the visual result is
indistinguishable from a real victory.

- `ArenaController.presenterWin()` → `_win()` (breaks nodes, resets Lumina, stops
  combat, `guardian.defeat()` implode poof).
- `RailArenaController.presenterWin()` → `_win()` (same, plus `hud.hideBoss()`).
- `TowerArenaController.presenterWin()` → mirrors the win block in `_updateBoss`
  (`won`/`phase`, success banner, `combat.stop({ preserveVfx: true })`), plus
  `gates.presenterAbort()` to tear down a seal-console riddle card that may be up,
  and `resetLumina()`.

### Supporting additions

- `GuardianIntroCutscene.skip()` — mirrors `IntroCutscene.skip()`, winding `_time`
  to the end so `update()` resolves the promise on the next frame and
  `_runGuardianIntroduction` continues normally (camera restore, `arena.begin`).
- `TowerGateManager.presenterAbort()` — `screen.dismiss()` + hide banner/prompt.
- `GuardianSoul.forceCollect()` — the walk-over pickup path without the radius
  test, so `Game._collectSoul` still fires and the museum still receives the Soul.
- `RiddleScreen.autoSolve()` — resolves a live card as correct. The arena paths
  drive their own riddle presentations, so this covers any future card-based
  riddle and keeps the "one key" promise honest.

### Config

```js
PRESENTER: {
  ENABLED: true,      // false → the keybind is inert (ship builds)
  KEY: 'KeyP',        // event.code
  SHIFT: true,        // require Shift so it can't be hit by accident
  COOLDOWN: 0.5,      // seconds; stops a held key from chaining skips
}
```

`ENABLED` is read at keydown time, not at wiring time, so it can be flipped from
the console mid-demo.

## Files

| File | Change |
| --- | --- |
| `src/config.js` | new `PRESENTER` block |
| `src/core/_partials/PresenterSkip.js` | **new** — mixin + `wirePresenterSkip` |
| `src/core/Game.js` | `Object.assign(Game.prototype, presenterSkipMethods)` |
| `src/core/_partials/GameUI.js` | call `wirePresenterSkip(game)` |
| `src/cutscene/GuardianIntroCutscene.js` | `skip()` |
| `src/core/arena/ArenaController.js` | `presenterSkipRiddle()`, `presenterWin()` |
| `src/core/arena/RailArenaController.js` | `presenterSkipRiddle()`, `presenterWin()` |
| `src/core/arena/TowerArenaController.js` | `presenterSkipRiddle()`, `presenterWin()` |
| `src/core/arena/TowerGateManager.js` | `presenterAbort()` |
| `src/core/GuardianSoul.js` | `forceCollect()` |
| `src/ui/RiddleScreen.js` | `autoSolve()` |

## Risks

- **Double-fire.** The cooldown plus the `busy` / `_loadingZone` guards keep a
  held Shift+P from stacking a zone-complete on top of an arena return.
- **Pointer lock.** `_enterMuseum()` locks the pointer; it is called synchronously
  inside the keydown handler so the gesture requirement is satisfied.
- **Typing into the pause/settings UI.** The handler bails when `pause.isPaused`,
  matching the existing `KeyR` / `KeyE` handlers in `GameUI.js`.
