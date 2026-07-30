# Survival: boss duels, the stale attack-target bug, and a volumetric beam

Three changes to Survival mode, one of which is a real correctness bug that also
affects the campaign's Reveler fight.

## 1. Boss waves are duels — `allowSummons`

Survival's tenth-wave Guardians currently summon adds on top of their own fight,
which stacks a wave on a wave. The gate is a **constructor option on `ArenaBoss`**
(`options.allowSummons`, default `true`), not a tuning value, because two of the
Reveler's three summon calls are hardcoded statements rather than clocks driven by
`SUMMON_INTERVAL` — a tuning key could not reach them without inventing a second
mechanism. `SurvivalBossDirector` passes `allowSummons: false` for all three
bosses; every campaign construction site omits the option and keeps its adds.

Call sites gated:

| Boss | Site | Kind |
| --- | --- | --- |
| Feastkeeper | `_tickSummons` | clock |
| Reveler | `_updateSummons` | clock |
| Reveler | `begin()` → `spawnRandomGroup(2, 2)` | hardcoded |
| Reveler | `_onPhaseChanged()` → `spawnRandomGroup(3, 3)` | hardcoded |
| Keeper | `_tickSummons`, `SUMMON_ON_ENRAGE` | clock + enrage |

Leftover threats from the preceding wave are **not** cleared (user's choice: the
"pure duel" is about the boss not adding, not about a sterile arena).

## 2. The laser stops damaging the Reveler — stale shared target array

**Root cause.** `ArenaBoss.getPlayerAttackTargets()` returned its own persistent
array after only truncating it to length 1:

```js
this._playerAttackTargets.length = 1;   // keeps whatever now sits at [0]
return this._playerAttackTargets;
```

`RevelerBoss.getPlayerAttackTargets()` then *mutated that same array* — clearing
it and appending its formation orbs, scatter hexes and overload nodes ahead of the
boss record it had read out of slot 0. So on the frame after any pattern appends a
target, `_playerAttackTargets[0]` is no longer the boss: it is a pattern's target
record, permanently. From then on `const bossTarget = targets[0]` hands back a
node, the real boss record is unreachable, and the boss can never be selected by
a beam or a projectile again.

It reads as "the laser stops working after Overload" because Overload appends ten
nodes that all go inactive when the channel is severed — leaving slot 0 holding a
dead node parked at a stale position, so the beam silently resolves nothing. The
same corruption happens after a formation or scatter pattern; Overload just makes
it unmissable. `RevelerBoss` also writes `bossTarget.radius` each frame, so the
bug additionally inflated one node's hit sphere to `HIT_RADIUS`.

This is **not Survival-specific** — the campaign Reveler shares it. It only
surfaces where `externalHitResolution` routes hits through the target list, which
today is Survival; the campaign path uses `_testPlayerBolts()` against the chest
sphere directly. Fixing it in the shared base is still correct.

**Fix, defence in depth:**

1. `ArenaBoss.getPlayerAttackTargets()` rebuilds the array deterministically —
   clear, then push `this._playerAttackTarget` — so slot 0 is the boss by
   construction and cannot be inherited from the previous frame.
2. `RevelerBoss` composes into **its own** `_revelerTargets` array, so a subclass
   never mutates the base class's list. Either change alone fixes the symptom;
   together the invariant survives the next subclass.

## 3. Beam visual — core + sleeve, reacting to heat

`SurvivalWeapons` drew the beam as a 2-point `THREE.Line`, which is 1px wide on
every GPU regardless of `linewidth`. Replaced with two unit cylinders (`+Z`, so
one `quaternion.setFromUnitVectors` aims both) parented to a group:

- an opaque bright **core**, and
- a wider additive translucent **sleeve** for glow.

Both are scaled per frame: `z` to the resolved hit distance, `x`/`y` to the live
width. Width is `BASE * (1 + mastery bonus)`, so Laser path mastery is visible,
and it **reacts to heat**: the beam swells slightly as heat builds, then sputters
(a fast sine flicker on width and sleeve opacity) inside the last stretch before
overheat lockout, telegraphing the cutout instead of letting it arrive unannounced.

Nothing about hit resolution changes here — `resolveLaserAttack` still returns the
same end point; only its presentation differs.

## Verification

- `tests/SurvivalArena.test.js` — `allowSummons: false` suppresses every summon
  call site; default construction still summons.
- `tests/SurvivalArena.test.js` — the attack-target regression: appending pattern
  targets across frames must leave the boss record reachable, with the boss last.
- Beam geometry is checked only by `node --check` plus in-browser verification;
  it has no headless-testable behaviour.
