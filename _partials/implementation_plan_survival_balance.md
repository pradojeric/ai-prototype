# Implementation plan — Survival Mode early-game balance

## Problem

Wave 1 of Survival is punishing and upgrades feel inert.

1. **Player dps is campaign-tuned, enemy HP is not.** The base weapon is the
   campaign Light Bolt (`COMBAT.BOLT`: 1 damage / 0.22s ≈ **4.5 dps**) but
   Survival gives the six roles their own, much larger health baseline
   (`SURVIVAL_ROLE_BASE_HP`, chaser 12 vs the campaign's fragile threats).
   Wave 1 pads to a five-threat floor, so the opener is 60 HP ≈ **13 seconds**
   of perfect-accuracy fire with five chasers already closing.
2. **`primary-power` is multiplicative on a base of 1.** Rank 1 turns 1 damage
   into 1.18 — twelve bolts per chaser becomes eleven. Nothing rounds the
   damage (`ThreatBody.hit` subtracts floats), so the rank *is* applied; it is
   simply too small to perceive against a base of 1.
3. **The first draft is at wave 5.** Waves 1–4 are played entirely on the
   un-upgraded base weapon, which is where the run feels worst.
4. All three weapon transformations sit at roughly the same low dps as the base
   (rapid ≈5.5, lance ≈4.6, laser ≈5.5), so committing a path does not fix it.

## Decisions

- Raise the **base** damage of every Survival primary ~3× and keep the existing
  `1 + 0.18n` percentage model, so one `primary-power` rank is a visible chunk.
- Do **not** touch `COMBAT.BOLT.DAMAGE` — it is shared with the campaign.
  Survival gets its own `SURVIVAL_LIGHT_BOLT` data block alongside the other
  weapon paths, keeping every Survival primary described in one place.
- Leave `SURVIVAL_ROLE_BASE_HP` alone. The health baseline is deliberate (GDD's
  30–45s wave pacing target); the fix belongs on the player's side.
- Leave the five-threat wave 1 floor alone — it guarantees every unlocked role
  appears. The threats simply die faster now.
- Add one early draft at **wave 2**, then keep the existing every-5 rhythm.

## Target numbers

| Primary | Before | After | dps after |
| --- | --- | --- | --- |
| Light Bolt (base) | 1 / 0.22s | **3** / 0.22s | 13.6 |
| Rapid Weave | 1 / 0.18s | **2.5** / 0.18s | 13.9 |
| Thread Lance | 3 / 0.65s | **8** / 0.65s | 12.3 |
| Continuous Laser | 0.55 × 10/s | **1.4** × 10/s | 14.0 |

Wave 1 clear goes from ~13s to ~4.5s of fire. Boss walls (160–200 HP) land at
~13s of sustained damage before any upgrades, which is the intended fight
length rather than a stat check.

`primary-power` rank 1 on the base weapon: 3 → 3.54, i.e. a chaser drops in 4
bolts instead of 5 — felt immediately.

## Steps

1. `SurvivalUpgrades.js` — add `SURVIVAL_LIGHT_BOLT` (damage 3, cooldown 0.22,
   speed 38, matching `COMBAT.BOLT`'s cadence); bump `rapid.damage` to 2.5,
   `lance.damage` to 8, `laser.damagePerTick` to 1.4.
2. `SurvivalWeapons.js` — `_fireProjectile`'s fallback branch reads
   `SURVIVAL_LIGHT_BOLT` instead of `COMBAT.BOLT.DAMAGE`; keep `COMBAT.BOLT`
   for the shared visual radius so the bolt still looks the same.
3. `SurvivalController.js` — `_completeNormalWave` drafts when
   `wave === FIRST_DRAFT_WAVE || wave % 5 === 0`; `nextMilestoneLabel` reports
   wave 2 as the next milestone while the run is on wave 1.
4. Update `tests/SurvivalRules.test.js` / `SurvivalUI.test.js` assertions that
   pin the old weapon numbers, and add coverage for the wave-2 draft.
5. Update the tuning tables in `SurvivalMode.md`.
6. Run the Survival test files under `node --test`.

## Risks

- Bosses are now killable ~3× faster; `SURVIVAL_BOSS_SCALING.hpPerIndex` (0.55)
  may need a later pass once the first boss wave is played. Noted, not changed —
  one lever at a time.
- The wave-2 draft means capped families max out one draft earlier across a long
  run; the `REPEATABLE_FALLBACK_CARDS` path already covers that case.
