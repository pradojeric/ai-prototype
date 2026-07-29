# Keeper of Memories — weighted attack scheduler + partial split

Scope: a structural recode of the Arena 3 boss
([src/core/arena/TowerKeeper.js](../src/core/arena/TowerKeeper.js)) to the
scheduler shape the other two bosses already share, plus the `_partials/` split
its 736 lines were overdue for. No other boss is touched, and the Keeper's
external API is unchanged.

Supersedes nothing — the tuning work in
[implementation_plan_keeper_attack_tuning.md](implementation_plan_keeper_attack_tuning.md)
(faster charge, centred sweep, jumpable light-wall) is preserved intact; this
plan only changes *how the patterns are chosen* and *where the code lives*.

## 1. The problem with the old scheduler

`TowerKeeper` was the only boss not using the shared shape. Instead of one
`_attackTimer` feeding a weighted roll, it ran **four independent countdown
clocks** decremented in `_updateIdle` and tested in a fixed `if`-chain:

```js
if (this._chargeClock  <= 0) { this._startCharge(playerPos);  return; }
if (this._debrisClock  <= 0) { this._startDebris();           return; }
if (this._beamClock    <= 0) { this._startBeamApproach();     return; }
if (this._shotClock <= SHOT_TELEGRAPH) { ...shot... }
```

Three consequences, all of them accidents of that ordering rather than design
decisions anybody made:

- **Priority is hardcoded and invisible.** Charge always beat stones, which
  always beat the sweep. The mix could only be changed by editing interval
  arrays and reasoning about which one happens to expire first.
- **The signature attack was starved.** The sweep had both the longest interval
  (9.5–12s) *and* the lowest priority, so a charge or stone wave coming due in
  the same window pushed it back indefinitely. It is the attack the whole
  lighthouse fiction is built on, and it was the one the player saw least.
- **Clocks froze mid-pattern.** They only ticked in `_updateIdle`, so a 5s sweep
  paused every other clock — meaning the *effective* rates never matched the
  authored intervals, and no amount of tuning the arrays would make them.

## 2. The new scheduler

Straight parity with [FeastkeeperBoss.js](../src/core/arena/FeastkeeperBoss.js)
and [RevelerBoss.js](../src/core/arena/RevelerBoss.js): one `_attackTimer`, one
weighted roll, a `_pattern` string as the mutual-exclusion guard, and the
previous pattern rejected from the draw so nothing repeats back to back.

The four patterns are `shot`, `charge`, `stones`, `sweep`. The basic aimed shot
is a **weighted pattern like any other** — the same call Feastkeeper's `spit`
makes — rather than a filler clock running underneath. It therefore fires far
less often than before, so it fires in **bursts** (`SHOT.BURST` 1/2/3 by phase,
`BURST_GAP` 0.24s) to keep its share of the pressure.

One divergence from the other two bosses, deliberate: `ATTACK_WEIGHTS` is a
**per-phase array**, not a flat object. Both other fights escalate only by
tightening intervals; the Keeper's four patterns want a shifting *mix*, so the
enrage moves weight off the shot and onto charge and sweep — the two patterns
that test movement and timing.

```js
ATTACK_INTERVAL: [[2.2, 3.1], [1.7, 2.5], [1.2, 1.9]],
ATTACK_WEIGHTS: [
  { shot: 5, charge: 3, stones: 2, sweep: 2 },   // phase 0
  { shot: 5, charge: 3, stones: 3, sweep: 3 },   // phase 1
  { shot: 4, charge: 4, stones: 3, sweep: 4 },   // phase 2
],
```

The sweep is weighted 2 rather than 1 at phase 0 on purpose. Phase 0 ends at 66%
of 300 HP — about 22s of uninterrupted fire — and at weight 1 the player could
plausibly clear it without ever seeing the attack the fight is named for.

`_beginPattern` returns early through `_failPattern()` when `BeaconCharge.start`
declines (player closer than 0.5m, where a dash has no runway). That re-arms the
timer at 0.6s instead of the full interval, and `_lastPattern` is already set to
`charge`, so the reroll is guaranteed to pick something else rather than loop.

Phase flare is **not** a pattern. It is a separate `_flare` countdown checked
before the scheduler in `_act`, so an enrage cannot be interrupted by, or
interrupt, a pattern mid-flight.

## 3. Committed hazards keep resolving

`_act` calls `update` on all three mechanic partials **unconditionally**, and
`_advancePattern` only reads their `busy` flag — the same division Feastkeeper
uses for its grenades and slam. Updating in one place and testing in the other
is what prevents a double-update in a single frame, which is the bug that shape
exists to avoid.

## 4. File split

`TowerKeeper.js` goes from 736 lines to ~250 (tuning + scheduler + the shared
boss contract). Four new files under `arena/_partials/`, each owning one
mechanic and its meshes, matching the `start()` / `update()` / `busy` /
`clear()` / `dispose()` contract that `OfferingSlam`, `SpiralVolley`, and
`ScatterHex` already use:

| File | Owns |
| --- | --- |
| `TowerKeeperBody.js` | mesh, fade, hit flash, chest centre, `setFlare` for the enrage pulse |
| `BeaconCharge.js` | gold lane telegraph, the 19 u/s dash, hit test, hit/miss recovery |
| `MemoryStones.js` | 9-slot debris pool, ground warnings, impact damage, power-up drop |
| `LighthouseSweep.js` | walk-to-centre, blade telegraph ramp, rotating arms, jump-aware hit test |

`BeaconCharge` and `LighthouseSweep` both move the Keeper, so each takes the
body and exposes a flag (`moving` / `approaching`) that `blocksPlayerAt` reads —
the same two cases the old state-string test covered, now asked of the code that
actually owns the motion.

The beam's `uTime` advance moves inside `LighthouseSweep.update`, which is
reached only through `_act`. That is a small behaviour improvement: the shader
now freezes with the rest of the fight when the pointer unlocks, instead of
scrolling on during a pause.

## 5. Summons — built, default off

`TowerCombatManager.spawnBossGroup(phase)` is fully written and **was never
called by anything**. The Keeper now has the summon path, behind two tunables
that both ship disabled, so the summit stays a duel until you decide otherwise:

```js
SUMMON_INTERVAL: null,     // set to [[8,11],[6.5,9],[5,7.5]] to enable
SUMMON_ON_ENRAGE: false,   // set true for one group per enrage instead
```

`_tickSummons` returns immediately while `SUMMON_INTERVAL` is null, so the
disabled path costs one null check per frame.

## 6. Preserved API

Unchanged for [KeeperArenaController.js](../src/core/arena/KeeperArenaController.js)
and [TowerCombatManager.js](../src/core/arena/TowerCombatManager.js):
constructor signature `(scene, player, combat, audio, { bounds, seed, onEvent,
onPowerUpDrop })`, `begin()`, `update(dt, t, playerPos)`, `center()`,
`blocksPlayerAt()`, `dispose()`, `hp` / `maxHp` / `defeated`, `body.show()`,
`body.update(dt, t, target)`, and the `projectileDamage` / `projectileKnockback`
fields `TowerCombatManager` reads off `spit.source`.

`TOWER_KEEPER_TUNING` keys are regrouped into nested `SHOT` / `CHARGE` /
`STONES` / `SWEEP` blocks, matching Feastkeeper's `GRENADE` / `SPIRAL` / `SLAM`.
Safe: the export has no reader outside `TowerKeeper.js`.

## Verification

Static only — no automated harness in this repo, and per project convention no
browser automation is added. `node --check` on every changed and new file, a
grep confirming no stale references to the removed state strings, clock fields,
or flat tuning keys survive anywhere, and a line-count check against the 1000
limit.

Needs in-browser confirmation: that the four patterns visibly rotate rather than
running in the old fixed order, that the sweep now appears reliably in phase 0,
that the burst shot reads as a burst and not a stutter, and that charge and
sweep still release the player from `blocksPlayerAt` while they move.
