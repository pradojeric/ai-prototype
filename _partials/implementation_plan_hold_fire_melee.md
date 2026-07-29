# Implementation Plan — Hold-to-Fire Bolts + Melee Shockwave (2026-07-29)

## Problem

Firing is strictly one click = one bolt: [GameUI.js:145](../src/core/_partials/GameUI.js#L145)
sends a single `requestFire()` per `mousedown`, and
[CombatManager.js:424](../src/core/combat/CombatManager.js#L424) consumes exactly
one request per frame behind a `COMBAT.BOLT.COOLDOWN` (0.22s) gate. Sustaining
max DPS through a 10-wave arena run therefore costs the player ~4.5 clicks per
second for the length of the fight, which is what hurts.

There is also only one combat verb against a crowd (the bolt) plus the banked
Alab burst on `R`. A cornered player has no instant answer when chasers close.

## Confirmed direction (user, this session)

1. **Auto-repeat while held** — fire on press, repeat every `BOLT.COOLDOWN`,
   stop on release. DPS is unchanged versus perfect clicking, so no arena
   re-tuning is implied.
2. **`F` releases a melee shockwave** — radial burst centred on the player.
3. **Damage + knockback** — it hurts and it shoves; the gap it buys is the point.
4. **All three combat managers** — base `CombatManager`, `TowerCombatManager`,
   `RailCombatManager`.
5. **Cooldown UI lives on the crosshair** — a ring, matching the existing
   `#holdring` idiom.

## Design decisions and their reasons

- **Hold-fire reuses `_fireCooldown` as the repeat clock.** Because the cooldown
  already sits at 0 while idle, the first shot on press is instant and the
  sustained cadence is exactly `BOLT.COOLDOWN`. No new rate constant, no
  balance change, and the Alab branch keeps priority exactly as it does now.
- **`_firing` is cleared on every pointer-lock loss, pause, fight start, and
  abort.** A held button across a pause must not resume firing without a fresh
  press — this mirrors the existing `_fireRequested` discipline at
  [CombatManager.js:447](../src/core/combat/CombatManager.js#L447),
  [TowerCombatManager.js:357](../src/core/arena/TowerCombatManager.js#L357), and
  [RailCombatManager.js:163](../src/core/arena/RailCombatManager.js#L163).
- **`requestFire()` survives as a one-shot.** It is public API and costs one line
  to keep; `setFiring(flag)` is the new held-state entry point.
- **The shockwave is a `CombatManager` verb, not an arena one.** All three
  managers already call `_updatePlayerFire(dt)` from their own `update()`, so a
  sibling `_updatePlayerMelee(dt)` added at those same three call sites gives
  identical behaviour everywhere without touching arena controllers.
- **It hits `this.enemies` only — never boss shells.** `ArenaBoss`,
  `FeastkeeperBoss`, `RevelerBoss`, and `TowerKeeper` are separate objects with
  their own shield/armor state machines and bolt-consumption rules. Routing an
  AoE into them would bypass phase gating (e.g. `ShellRotation.testBolt`), so the
  shockwave deliberately clears adds and leaves bosses to the bolt.
- **A vertical band, not a sphere.** `SHOCKWAVE.VERTICAL` (±2.0m around the
  player's eye height) means a hovering Tower gargoyle in your face is caught but
  a gale circling far above is not — the attack stays readable as a ground pulse.
- **Knockback goes through `Enemy.nudge()`**
  ([Enemy.js:113](../src/core/combat/Enemy.js#L113)), which routes the shove via
  `_move` and so respects world collision. An echo can't be knocked into a wall.
- **Shockwave kills do NOT feed Alab.** `registerPlayerBoltHit` is the bolt
  mastery meter; letting an AoE charge it would make the R burst nearly free.
  Kills *do* fire `_onEnemyDefeated` (so Lumina still drops) and *do* update
  `_updateWaveLeft`, so wave clears resolve normally.
- **Overcharge does not scale it.** The Lumina reads "Bolt damage doubled"
  ([JourneyGuide.js:14](../src/ui/JourneyGuide.js#L14)); keeping the shockwave
  flat keeps that promise honest.
- **Rail caveat, accepted:** the boat is movement-locked and snipers engage from
  range, so the shockwave will mostly matter against Frenzied Boarders that close
  in. That is the correct situational use, not a defect.

## Tuning (new `COMBAT.SHOCKWAVE` block in config.js)

| Constant | Value | Reason |
|---|---|---|
| `RADIUS` | 4.2 | Comfortably past `CHASER.ATTACK_RANGE` (1.4) so everything already swinging at you is caught, without reaching across the arena. |
| `VERTICAL` | 2.0 | Half-height band; covers hovering threats near the player. |
| `DAMAGE` | 2 | One-shots a base chaser (`CHASER.HP` 2); zone HP bonuses keep tougher zones from being trivialized. |
| `KNOCKBACK` | 2.6 | Roughly a chaser-second of travel at `CHASER.SPEED` 3.2 — a real gap, not a teleport. |
| `COOLDOWN` | 6 | Long enough that bolts stay the primary verb; short enough to exist twice in a wave. |
| `COLOR` | `0x7fe8ff` | The established player-light hue (`BOLT.COLOR`). |
| `FOV_PUNCH` | 3 | Reuses the existing `_fovPunch` decay for weight. |

## Execution steps

### 1. `src/config.js`
- Add the `SHOCKWAVE` block above `ALAB` with the table's values and a comment
  explaining the panic-button intent.
- Amend the `BOLT` comment at line 262 — it says "with left click", now "held".

### 2. `src/core/combat/CombatManager.js` (631 lines — well under limit)
- Constructor: `this._firing = false`, `this._meleeRequested = false`,
  `this._meleeCooldown = 0`, and scratch `this._vShock = new THREE.Vector3()`.
- `setFiring(flag)` — new; `requestFire()` kept as the one-shot.
- `requestMelee()` — sets `_meleeRequested`.
- `cancelInput()` — also clears `_firing` and `_meleeRequested`.
- `_updatePlayerFire(dt)` — the `else if` gate becomes
  `(this._firing || this._fireRequested)`.
- `_updatePlayerMelee(dt)` — tick the cooldown, consume the request, and on a
  valid release call `_releaseShockwave(playerPos)`; push the ring state to
  `hud.setMelee(progress, ready)` every frame.
- `_releaseShockwave(playerPos)` — loop `this.enemies`, XZ-radius + vertical-band
  test, then per hit: `_damageEnemyFromMelee(enemy, center)` and
  `enemy.nudge(nx * KNOCKBACK, nz * KNOCKBACK)`. Then VFX (a horizontal
  `vfx.ring` at `player.eyeBase + 0.06` with `endScale = RADIUS / 0.55` to match
  the 0.55-radius torus, plus a `vfx.burst`), `audio.playShockwave()`,
  `viewmodel.triggerSlam()`, and `_fovPunch += SHOCKWAVE.FOV_PUNCH`.
- `_damageEnemyFromMelee(enemy, center)` — the shared bookkeeping (hit, damage
  popup, impact/death VFX, audio, hitstop on kill, `_onEnemyDefeated`,
  `_updateWaveLeft`). Overridable so subclasses keep their own kill accounting.
- `update()` — call `_updatePlayerMelee(dt, playerPos)` next to
  `_updatePlayerFire(dt)`; clear `_firing` in the pointer-lock guard.
- `startFight` / `abortFight` — reset `_firing`, `_meleeRequested`,
  `_meleeCooldown`, and clear the HUD ring.

### 3. `src/core/arena/TowerCombatManager.js`
- Call `_updatePlayerMelee` in `update()`; clear `_firing` in its lock guard.
- Reset melee state in `_resetCombatFeel()`.
- Override `_damageEnemyFromMelee` to use `vfx.enemyImpact(pos, type, defeated)`,
  matching how `_testPlayerBolts` already reports Tower hits.

### 4. `src/core/arena/RailCombatManager.js`
- Same three edits; the override delegates to `_defeatThreat`, which is widened
  to `_defeatThreat(threat, position, reflected = false, damage = this.boltDamage)`
  so melee can pass its own rating without duplicating the drop/popup logic.

### 5. `src/core/ViewModel.js`
- Add `slamT` alongside `castT` and a `triggerSlam()` setter.
- In `update()`: decay `slamT` (~4/sec), and drive a distinct pose — the hand
  drops and thrusts down-forward (rather than the bolt's flat forward punch),
  fingers snap open, and the lure flares harder than a cast. Keeping it a
  separate envelope means a shockwave fired mid-burst doesn't fight the cast
  recoil for the same channel.

### 6. `src/audio/AudioManager.js`
- `playShockwave()` — a descending sine thump layered with a short filtered
  noise whoosh, following the existing procedural-SFX idiom (`playShoot`,
  `playBoltReflect`). Guarded by `if (!this.ready) return;` like its siblings.

### 7. Crosshair cooldown ring
- `index.html` — a second SVG beside `#holdring`:
  `<svg id="meleering" viewBox="0 0 80 80">` with `r="26"`
  (circumference 163.4) so it sits inside the hold ring rather than colliding
  with it.
- `_partials/arena-hud.css` (657 lines) — `#meleering` layout copied from the
  `#holdring` block, `.active`/`.ready` states, a warm stroke distinct from the
  teal hold ring, and a short pulse keyframe when it comes off cooldown.
- `src/ui/CombatHud.js` — `setMelee(progress, ready)` writing `strokeDashoffset`
  and toggling classes; cleared in `hide()`/`dispose()`.

### 8. Input wiring — `src/core/_partials/GameUI.js`
- The `mousedown` handler calls `setFiring(true)` under the same phase/lock/busy
  guard it already applies; a new `mouseup` (and a `pointerlockchange` listener)
  calls `setFiring(false)` unconditionally, so the flag can never latch on.
- `keydown` gains `KeyF` → `combat.requestMelee()`, guarded exactly like the
  existing `KeyR` Alab branch (not paused, `phase === 'arena'`, not busy,
  `combat.active`), with `!e.repeat` so a held F doesn't queue.

### 9. Player-facing text
- `index.html:235` controls line — `CLICK — Cast Light` becomes
  `HOLD CLICK — Cast Light · F — Shockwave`.
- `src/ui/JourneyGuide.js` — the `cast` hint becomes "Hold Click — Cast Light";
  add a `shockwave` hint.
- `src/core/_partials/ArenaFlow.js` — the two `showControl('cast')` sites at
  lines 136 and 180 also queue `showControl('shockwave')`, so the new verb is
  taught at fight start and after each Guardian intro.

## Risks

- **Stuck-fire on focus loss** is the one real hazard of a held flag. Mitigated
  at four points: `mouseup`, `pointerlockchange`, `cancelInput()` (already called
  from [GamePause.js:221](../src/core/_partials/GamePause.js#L221)), and the
  per-manager lock guards.
- **Melee trivializing wave pressure** — bounded by the 6s cooldown and by the
  shockwave not feeding Alab. Numbers are all in one config block if playtest
  says otherwise.
- **No automated harness in this repo.** Verification is `node --check` across
  `src/**/*.js` plus the existing Node test files, then in-browser confirmation
  by the user.

## As built — what changed from the plan above

Three things the plan got wrong about the existing code, plus two additions the
user asked for after review:

1. **`enemy.nudge()` does not exist on two thirds of the threats.** `nudge()` and
   `_move()` are defined on `Enemy`; `RailThreat` and `TowerThreat` extend
   `ThreatBody` directly. The planned call would have thrown a TypeError on the
   first shockwave in Arena 2 or Arena 3. Knockback is now the polymorphic
   `_knockbackFromMelee(enemy, nx, nz, strength)`: the base nudges (collision
   aware), Rail displaces `group.position` directly (open water, and a boarder
   integrates its own position so the shove really does set back its approach),
   and Tower is an intentional no-op — gargoyles are pinned to their anchor and
   `_updateGalePosition` re-writes `position.x/z` from `_fixedX/_fixedZ` every
   frame, so any displacement would be erased before it could be seen.
2. **Stamina is now the second abuse gate** (`SHOCKWAVE.STAMINA`, 0.3 of the
   0..1 tank — 1.5x a hop). That forced a change in `PlayerController.update`:
   the `movementLocked` branch returns before the stamina block, so Arena 2
   never regenerated. Rail now regenerates in that branch, or the boat would
   have had exactly two shockwaves for the whole ride. The bar stays rail-hidden;
   the crosshair ring reports the stamina gate, so the player still sees why.
3. **`AudioManager.js` had to be split.** It was *already* at 1008 lines — over
   the 1000-line limit — before this task; `playShockwave` took it to 1048. The
   15 wave-combat one-shots moved to `src/audio/_partials/CombatSfx.js` and are
   mixed onto `AudioManager.prototype` with `Object.assign`, so `audio.playShoot()`
   and every other call site is untouched. 616 + 447 lines.
4. **Projectile deflection was added** (user request): the shockwave sweeps
   hostile rounds inside `DEFLECT_RADIUS`. The base destroys them; Rail overrides
   `_deflectShots` to *turn them around on the shooter*, reusing the bolt-parry
   path (`_reflectShot` was split into a shared `_turnShot`). Already-reflected
   rounds are skipped so one pulse can't re-aim a round flying home. This is what
   earns the shockwave its place in Arena 2, where the boat is anchored and the
   snipers sit well outside melee range.
5. **Anti-abuse, as shipped** — four independent gates: the 6s cooldown; the
   stamina bill from the same tank as sprint and the hop; requests dropped rather
   than queued while either gate is closed (so holding F cannot auto-release it,
   reinforced by `!e.repeat` at the listener); and `combatLive()`, which requires
   an active fight, pointer lock, no pause, and `!game.busy`. Bosses remain immune
   to the damage, and shockwave kills still do not feed Alab.

### Stuck-fire workaround, as shipped

Five layers, because a held flag that survives the player letting go is the one
genuinely dangerous part of this change:

| Layer | Catches |
|---|---|
| `mouseup` (unconditional, any game state) | the normal release |
| `mousemove` reconciliation against `e.buttons & 1` | a release the page never saw — let go outside the window, dropped event. Clear-only, never re-arm; self-heals on the first movement |
| `window blur` + `visibilitychange` | alt-tab mid-hold |
| `pointerlockchange` → `cancelInput()` | Esc / lost lock |
| each manager's lock guard → `cancelInput()` | the pause menu, every frame it is open |

## Out of scope

- Boss shells taking shockwave damage.
- Any change to `BOLT.COOLDOWN`, wave tables, or enemy HP.
- Charged/alternate-fire bolts (explicitly declined in favour of plain
  auto-repeat).
