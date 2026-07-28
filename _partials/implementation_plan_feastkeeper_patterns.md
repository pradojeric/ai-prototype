# Implementation Plan — Feastkeeper Attack Patterns + Combat Jump (2026-07-28)

## Problem

Zone 1's boss fight was one-note. `FeastkeeperBoss._act` ran two countdown timers —
one aimed spit, one randomized summon — against a boss that never moves
(`guardianStart {x:0, z:-10}`). The fight reduced to strafing a single predictable
projectile while holding fire on the chest; nothing ever made the player leave the
middle of the arena.

## Design

Four attacks off one scheduler, each denying space a different way:

| Pattern | Denies | Answer | Jumpable |
|---|---|---|---|
| `spit` | nothing (rhythm filler) | strafe | — |
| `grenades` — Handog Barrage | patches of floor | reposition early | **no** |
| `spiral` — Spiral Feast | rotating lanes | walk the gaps | **no** |
| `slam` — Offering Slam | a travelling ring | stand in the wedge, or leap | **yes** |

Constraints that drove it:

- Player walks at 2.6 m/s (sprint ≈ 4.7) with no dodge. Gaps and travel distances
  must be walkable, telegraphs ≥ 0.9 s.
- All patterns unlocked from the first frame of the boss phase; phases only tighten
  cooldowns and raise counts.
- `_pattern` is a mutual-exclusion guard — one attack at a time, never the same one
  twice in a row. Summons keep their own independent clock.
- The combat jump answers **exactly one** pattern. A hop that cleared everything
  would be a panic button, not a decision.

## Steps

1. **Combat jump** — `config.js` `JUMP_SPEED/JUMP_GRAVITY/JUMP_STAMINA`;
   `PlayerController` gains `jumpOffset`/`jumpVel`/`jumpEnabled` + `setJumpEnabled`.
   The player had *no* vertical velocity model: `position.y` is derived each frame
   from `eyeBase + EYE_HEIGHT + breath`. The hop is therefore an **offset layered on
   top** of the ground-follow. Collision deliberately keeps resolving against
   `eyeBase`, so a leap can never clear a wall, a ledge, or the dock.
   Armed in `CombatManager.startFight`, disarmed in `abortFight` **and** `dispose`
   (teardown does not route through abortFight). Zone 2 and Zone 3 override
   `startFight` without calling `super`, which scopes the hop to the Memory Arena —
   correct, since the rail boat is movement-locked and the tower reads altitude off
   `eyeBase`.
2. **Projectile plumbing** — `ProjectilePool` slots carry an optional `damage`;
   `CombatManager`'s spit-vs-player pass reads `s.damage ?? COMBAT.SPITTER.DAMAGE`
   and now `break`s after one hit, so a dense pattern can't land a whole cluster on
   one frame with no i-frames. `COMBAT.POOL_SPITS` 24 → 48 (the pool is shared with
   the adds; a volley would have starved them).
3. **`_partials/FeastGrenades.js`** — pooled lobbed pots + ground markers. Owns its
   meshes: `ProjectilePool` flies dead straight, and `VFX.RING_POOL` (16, shared) is
   too small to hold a salvo's markers. Landing point is chosen at throw time so the
   ring is up before the pot moves — fuse time *is* warning time. Quadratic Bézier
   arc, matching the artifact-scatter lob.
4. **`_partials/SpiralVolley.js`** — drives the shared spit pool, owns no meshes.
   `MUZZLE_Y = 1.3` is load-bearing: these rounds fly flat and `CombatManager`
   rejects any spit more than 1.4 m off the player's eye, so firing from the
   guardian's ~4 m chest would send every one of them overhead.
5. **`_partials/OfferingSlam.js`** — expanding ring with the safe wedge carved into
   the `RingGeometry` itself (`thetaLength = 2π − GAP_ARC`), so what the player reads
   is what the hit test uses. A hit needs all three: inside the band, outside the
   wedge, and `jumpOffset < CLEARANCE`.
6. **`FeastkeeperBoss`** — `FEASTKEEPER_TUNING` gains `ATTACK_INTERVAL`,
   `ATTACK_WEIGHTS`, `GRENADE`, `SPIRAL`, `SLAM` (all per-phase arrays stay
   3-long). `_act` becomes a dispatcher; each pattern is a
   `telegraph → active → idle` micro-state-machine. `dispose()` added — the partials
   own scene meshes and `ArenaController` builds a fresh boss on every faint-restart.
7. **Body reaction** — `zone1Golem` returns a `gesture(kind)` alongside `animate`;
   `Guardian.gesture()` is an optional-chained passthrough so other zones need no
   stub. `'throw'` hauls the arms up, `'slam'` drives them down, `'charge'` burns the
   chest cavity hotter and pulls the orbiting plates inward.

## Notes / deliberate omissions

- `_onPhaseChanged` wipes the committed **ground** attacks (grenades, slam) so the
  invuln flare has no unanswerable pressure. Spiral rounds already in the air are
  left alone — they share the pool with the adds' shots, and clearing it would erase
  those too.
- The boss keeps bare `Math.random()`; threading `ArenaController`'s seed through it
  is a separate change.
- The one-hit-per-frame guard is on the base `CombatManager` loop only. Zone 2 and
  Zone 3 have their own hostile-shot passes and were left untouched.
