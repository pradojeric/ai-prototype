# Implementation Plan — Arena 3 Seal Consoles (interact-to-answer bugtong)

## Goal

Replace Arena 3's shoot-the-answer-node riddle with the older overlay flow: walk
to a seal console on the gate landing, press **E**, answer the bugtong by clicking
a choice on the `#riddle` card. The tower simulation does **not** pause while the
card is up.

## Decisions (from user)

| Question | Decision |
| --- | --- |
| Trigger | Press **E** on a new console mesh beside each gate. No proximity auto-start. |
| Answering | **Keyboard `1` / `2` / `3`.** Pointer stays locked the whole time. |
| Sim while card is up | Tide keeps rising, gargoyles keep acting — and the player can still move and shoot. |
| Wrong answer | **Instant tide surge.** Movement-slow penalty is removed entirely. |
| Retry | Card **stays up** after a miss; the wrong choice is struck out and you pick again. No second E press. |
| Scope | Arena 3 (`TowerGateManager`) only. Arena 1 / Arena 2 keep their shoot-the-node rounds. |

Keeping the pointer locked (rather than releasing it for mouse clicks) removes
three problems the earlier draft had: no `GamePause` change, no pointer re-lock
that a browser could refuse, and no window where the player is frozen in place
while the tide climbs. Digit keys are confirmed unbound elsewhere in the project.

Retries are naturally bounded: there are three choices and one is correct, so a
gate costs at most two tide surges.

## Current behaviour being replaced

`TowerGateManager._start()` fires on proximity (<5m), spawns three `AnswerNode`
meshes fanned by `TOWER_ARENA.GATE_CHOICE_GAP`, and `_test()` scans
`combat.bolts.slots` each frame for a hit. `_wrongAnswer()` applies
`WRONG_SLOW` / `WRONG_SLOW_TIME` and spawns a penalty gargoyle.

`src/ui/RiddleScreen.js` and the `#riddle` DOM block (index.html:242) still exist
but nothing imports the class — this is the "previous iteration" to revive.

## Steps

### 1. `src/config.js` — `TOWER_ARENA` block

- **Add** `WRONG_TIDE_SURGE: 1.2` — metres the water jumps on a wrong answer.
- **Add** `CONSOLE_RANGE: 2.8` — radius in which the E prompt appears.
- **Add** `CONSOLE_OFFSET: 2.1` — lateral distance from the gate centre onto the
  landing. The gate landing half-extent is `GATE_LANDING_HALF` (3.0) and the ramp
  is `RAMP_WIDTH` (3.2) wide, so 2.1 clears the walkable lane without leaving the slab.
- **Remove** `WRONG_SLOW`, `WRONG_SLOW_TIME` (penalty deleted) and
  `GATE_CHOICE_GAP` (answer-node fan deleted). All three become unreferenced.

### 2. New `src/core/arena/_partials/TowerGateConsole.js`

Small self-contained mesh + state, kept in `_partials/` so `TowerGateManager`
stays well under the 1000-line limit.

- Build: short pedestal (`world.mat.buildingAlt`) + tilted rune plate + an
  additive emissive glyph quad, grouped and placed at
  `(gate.x, gate.z)` offset laterally by `CONSOLE_OFFSET` along the gate's
  `rotation`, sitting on `gate.height`.
- API: `update(dt, t)` (idle glyph pulse), `distanceTo(pos)`,
  `setState('ready' | 'busy' | 'solved')` (glyph colour/intensity),
  `dispose()`.
- No collider — the landing is narrow and a blocker there risks trapping the
  player on the ramp.

### 3. `src/ui/RiddleScreen.js` — additive options

`show()` gains a fifth `options` argument; every new behaviour is opt-in, so the
existing click-once-and-resolve flow is untouched for any future guardian caller.

- `options.keys` — prefix each choice with a `1` / `2` / `3` badge and bind a
  `keydown` listener for `Digit1..3` and `Numpad1..3`. Verified unbound: the
  project's only key handlers are `KeyE` and `KeyR`.
- `options.retryOnWrong` — a miss marks that button `.wrong` permanently and
  disables it, fires `options.onWrong?.()`, then re-enables input after a short
  flash. The card stays up and the promise resolves **only** on a correct pick.
- `dismiss()` — hide the panel, unbind the key listener, resolve `false`.
  Needed so a mid-riddle drown or arena reset can tear the card down instead of
  leaving it stuck on screen.
- The key listener must be unbound on both resolve paths.

### 3b. `styles.css`

- Add a `#riddle .answer .key` badge style for the number prefix, matching the
  existing teal answer-button palette.

### 4. `src/core/arena/TowerGateManager.js` — the main rewrite

- Drop the `AnswerNode` import, `gate.nodes`, `_test()`, and the
  `combat.bolts.slots` scan.
- Construct one `TowerGateConsole` per gate; construct one `RiddleScreen`
  (default `wait`, since the tower deliberately does not pause).
- `update(dt, t, playerPos, ePressed)`:
  - tick consoles + veils as today;
  - skip all input handling while `this.screen.active`;
  - for the nearest unsolved gate within `CONSOLE_RANGE` and `|y - height| < 1.4`,
    show `#prompt` (`Press <b>E</b> to read the seal's bugtong`) and, on
    `ePressed`, start the riddle.
- `_beginRiddle(gate)`:
  - hide `#prompt`, set console state `busy`;
  - `await screen.show(riddle, gate.index + 1, 3, keeperName, { keys: true,
    retryOnWrong: true, onWrong: () => this._wrongAnswer(gate) })`;
  - pointer lock is never touched — the player keeps full control throughout;
  - resolving `true` opens the gate; `false` (only reachable via `dismiss()`)
    returns the console to `ready`.
- `_open(gate)` (correct) — unchanged apart from console `setState('solved')`.
- `_wrongAnswer(gate)` — now only: `combat.vfx.gatePulse(center, false)`,
  `hooks.onEvent('Incorrect seal · the tide surges', 'warning')`, and
  `hooks.onTideSurge()`. **No** movement slow, **no** penalty gargoyle. The card
  stays up and the player picks again immediately.
- Delete `slowRemaining` / `_updateSlow` and the `onSlow` hook.
- `openAll()`, `reset()`, `dispose()` also call `screen.dismiss()` and dispose
  consoles.
- Expose `get riddleOpen()` for the controller's update guard.

### 5. `src/core/arena/TowerArenaController.js`

- Add `this._tidePenalty = 0`; reset it in `begin()` and `_beginBossRetry()`.
- `_updateAscent` water formula becomes
  `BASE_WATER_HEIGHT + rise * RISE_SPEED + this._tidePenalty`, still clamped to
  `MAX_WATER_HEIGHT`, so the surge survives the per-frame recompute.
- New hook into `_createGates`: `onTideSurge: () => { this._tidePenalty += TOWER_ARENA.WRONG_TIDE_SURGE; }`. Drop the `onSlow` hook.
- The `update()` guard (`!this.player.controls.isLocked`) is left **unchanged** —
  the pointer stays locked for the whole riddle, so the ascent keeps ticking on
  its own.
- Thread the interact tap through: `update(dt, t, playerPos, ePressed)` →
  `_updateAscent(…, ePressed)` → `this.gates.update(dt, t, playerPos, ePressed)`.
- Remove `_renderSlow`, `elSlow`, `elSlowTime` and their call sites.

### 6. `src/core/Game.js`

- Arena branch (line ~800): `this.arena.update(dt, t, playerPos)` becomes
  `this.arena.update(dt, t, playerPos, this._ePressed)`. The other two arena
  controllers ignore the extra argument. `_ePressed` is already consumed at the
  end of the same branch.

### 7. `src/core/_partials/GamePause.js` — no change needed

The earlier draft had to stop `_handleUnlock()` raising the pause overlay. With
the pointer staying locked there is no unlock event, so this file is untouched.

### 8. `index.html`

- Remove the now-dead `#tower-slow` / `#tower-slow-time` HUD row from the tower
  ascent panel.

## Risks / watch items

- **The card obscures the view while the sim runs.** The player can still walk
  and shoot with it up, but it covers a large part of the screen. If that reads
  badly, the lever is shrinking the `#riddle .card` for this mode.
- **Walking away mid-riddle** leaves the card up until answered. Treated as
  intentional commitment rather than something to cancel.
- **Drown while reading.** Deliberate per the decision above. If it plays too
  harshly, the tuning levers are `WRONG_TIDE_SURGE` and `GRACE_DURATION`.
- **`AnswerNode.js` stays** — Arena 1 still uses it. Only the tower's import goes.

## Verification

- Static: syntax/import check every touched module; grep that `WRONG_SLOW`,
  `WRONG_SLOW_TIME`, `GATE_CHOICE_GAP`, `tower-slow`, and `onSlow` have zero
  remaining references.
- Browser (user): climb Arena 3 — prompt appears at each console, E opens the
  card, `1`/`2`/`3` select, the tide visibly keeps rising behind it, a wrong
  answer jumps the water and strikes out that choice without closing the card, a
  correct answer opens the veil, and drowning mid-card does not strand the
  overlay.
