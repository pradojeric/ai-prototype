# Implementation Plan — Reveler (Arena 2) attack patterns

Three new attack patterns for `RevelerBoss`, plus the scheduler that keeps them
from overlapping. Chosen set:

1. **Overload Channel** — 15s+ beam charge, cancelled by destroying 10 coral nodes
2. **Scatter Hex** — a screen-wide spray of one-shot hexes the player must clear
3. **Shell Rotation** — armor petals close, one orbiting gap is the only way in

## Why a scheduler is needed first

Today `RevelerBoss._act` runs three independent clocks — formation, movement,
summons — that can all fire at once. That is fine for one attack; with four it
becomes unreadable. Zone 1 already solved this in `FeastkeeperBoss`: a single
`_pattern` mutual-exclusion guard, a weighted roll that rejects whatever ran
last, and per-pattern logic in `arena/_partials/*`. Arena 2 adopts the same
shape, so both bosses read the same way.

### Structure

- `RevelerBoss` stays a thin scheduler (~270 lines) and keeps ownership of its
  anchors, movement, summons, and the existing orb formation.
- Each new pattern is a class in `src/core/arena/_partials/`, following
  `SpiralVolley` / `OfferingSlam`: constructor takes `(combat, tuning, ...)`,
  exposes `busy`, `start()`, `update(dt, ...)`, `clear()`, `dispose()`.
- Tunables live in `REVELER_TUNING` beside the mechanics, not in `config.js`
  (the convention `ArenaBoss`'s header sets out).

### Interaction rules

- Existing **orb formation** becomes a scheduled pattern entry rather than its
  own free-running clock; its cooldown logic is preserved.
- **Movement between anchors** is suspended while any pattern is live (it
  already suspends on `formationLocked`).
- **Summons are suspended during Overload Channel** — the channel is already a
  full-attention target-clearing task, and adds spawning into it would make the
  cancel unreachable. Summons run normally during the other patterns. The summon
  timer is redrawn when the channel ends so the fight does not immediately dump
  a backlogged group.

## Pattern 1 — Overload Channel

**Fantasy:** the Reveler locks to the centre anchor and begins charging a beam
down the lane. Ten coral nodes surface across the river; each is the channel's
tether. Sever all ten and the beam collapses.

- Boss slides to the centre anchor, then holds (no anchor hops for the duration).
- 10 nodes spawn across the river lane reusing `_pickRiverSpawn`-style separation
  so none overlap and they are spread wide enough to force a sweep.
- **Node HP: 6–8** (drawn per node). `COMBAT.BOLT.DAMAGE` is 1, so that is
  literally 6–8 bolts each.
- A charge ring on the boss grows from 0→1 over the duration — this *is* the
  timer, diegetic, no new DOM.
- **All nodes destroyed →** channel aborts, boss staggers for ~3s (cannot act,
  takes normal damage). This is the reward window.
- **Timer expires →** beam fires down the lane for heavy damage (~45) and every
  surviving node despawns.

### Duration arithmetic (flagged for your call)

The fire cooldown is `COMBAT.BOLT.COOLDOWN = 0.22`, i.e. ~4.55 shots/sec. Ten
nodes at 6–8 HP is ~70 bolts ≈ **15.4 seconds of uninterrupted perfect fire** —
so a 15s channel is not merely hard, it is mathematically unclearable once you
add aim time and any missed shot.

Keeping your 10 nodes and 6–8 HP as specified, this plan sets the channel to
**`DURATION: [22, 20, 18]`** per phase, which leaves ~5s of aim/travel slack at
phase 0 and tightens with the enrage. All three numbers are adjacent constants in
`REVELER_TUNING`, so if you would rather hold 15s, drop `NODE_COUNT` to 6 and it
balances at the same difficulty.

## Pattern 2 — Scatter Hex

**Fantasy:** the House of the Dead magician's fireball spread. The boss flings a
wide arc of small hexes that hang scattered across the view, then drift inward
on staggered delays.

- 12 / 16 / 20 hexes per phase, spawned across a wide arc in front of the boat
  (randomised yaw/pitch within the aim cone, randomised distance) so they land
  spread across the screen rather than in a readable ring.
- **1 HP each** — a single bolt pops one.
- Each hex holds still for a stagger delay, then homes slowly at the boat.
  Reaching the boat deals ~8 damage and consumes the hex.
- Hexes have a hard lifetime so the pattern always resolves.
- New pooled class `ScatterHex.js` — modelled on `RevelerProjectilePool` but with
  a shootable (not reflectable) state, so the two never share a slot pool.

## Pattern 3 — Shell Rotation

**Fantasy:** coral petals fold over the Reveler's chest, leaving one glowing gap
that orbits. Pure aim-timing; no projectiles.

- Petals close over the chest for 6 / 7 / 8s. A single gap of ~50° orbits at a
  phase-scaled rate; direction flips each time the pattern runs.
- Bolts hitting the shell route through the existing `pingArmored()` — the
  `BLOCKED` popup and armor flare already exist and need no new code.
- Bolts landing inside the gap arc deal **1.5× damage**, so the pattern is a real
  DPS opportunity rather than a wait.
- The boss fires a slow aimed spit on a lazy cadence so the window is not free.
- Cheapest of the three: no new meshes beyond the petal ring, no new pool.

## Files

| File | Change |
|---|---|
| `src/core/arena/RevelerBoss.js` | scheduler, tuning block, pattern wiring, summon gate |
| `src/core/arena/_partials/OverloadChannel.js` | new — nodes, charge ring, beam, stagger |
| `src/core/arena/_partials/ScatterHex.js` | new — pooled one-shot hex spray |
| `src/core/arena/_partials/ShellRotation.js` | new — petal shell + orbiting gap hit test |

No `config.js` changes; no DOM/HUD changes (callouts and damage popups already
exist). Every partial disposes its meshes — `RailArenaController` rebuilds the
boss on faint-restart, so leaked geometry would accumulate.

## Steps

1. Refactor `RevelerBoss._act` into the `_pattern` scheduler; fold the existing
   orb formation in as a scheduled entry. Verify the fight is unchanged.
2. Add `ShellRotation` (no new projectiles — smallest surface, validates the
   scheduler end to end).
3. Add `ScatterHex` with its own pool.
4. Add `OverloadChannel` with nodes, charge ring, cancel/stagger and beam.
5. Gate summons and anchor movement on the pattern guard.
6. Syntax + line-count checks; then in-browser verification by you (no browser
   automation in this repo).

## Verification

Static checks only on my side (`node --check` per file, line-count, import
resolution). Then, in browser: enter Arena 2, clear the bugtong, and confirm
each pattern fires, that only one runs at a time, that summons visibly stop
during the channel, and that the ten nodes are clearable inside the timer.
