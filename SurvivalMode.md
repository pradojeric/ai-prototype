# Endless Memory Survival Mode

Endless Memory is the desktop-only endgame mode for *Strings*. It is a
self-contained combat run entered by walking into the **Endless Echoes arch** in
the museum lobby, which the ending opens. The mode remixes the campaign's
threats, Guardians, abilities, and visual motifs inside a purpose-built arena; it
does not alter campaign encounters or progression.

## Entry and Run Flow

The credits offer one action — **Return to Aking Museo** — which enters the
peaceful epilogue museum. Survival is reached from there, by walking into the
Endless Echoes arch.

The arch is a free-standing violet portal in the lobby, off-center on the −X side
against the +Z wall. It is not a fourth zone doorway: the −Z wall is fully
consumed by the three zone portals and the other three walls each belong to a
gallery, so the arch stands *in* the room. `MUSEUM.SURVIVAL_PORTAL` places it
clear of Zone 1's +Z gallery doorway and of the intro cutscene's `x = 0` camera
path. Walking within `MUSEUM.EXIT_RADIUS` of it enters a run, exactly as walking
into a zone corridor's end enters that zone.

Two things open it (`SurvivalEntryPolicy.isSurvivalPortalOpen`):

- the ending has been seen, i.e. the museum is in epilogue mode; or
- `CONFIG.DEBUG_SURVIVAL_UNLOCKED` is set, which opens the arch on the first hub
  visit so Survival can be tested without playing to the ending.

Until then the arch stands sealed — cold grey, no vortex, plaque reading
"ENDLESS / SEALED" — the same affordance the locked zone portals use.

`canEnterSurvivalFromHub` accepts only the `museum` phase, so a run can never be
re-entered from inside a cutscene, a zone, or another run. There is no
title-screen shortcut, access flag, or `localStorage` unlock. The ending debug
path may open the arch for testing, but it does not make the run eligible for the
legitimate-ending GameOn reward.

Leaving a run returns to the epilogue museum after the ending. Before it (the
debug unlock), it returns to the **ordinary** hub instead — forcing epilogue mode
there would seal the zone portals of a campaign the player has not finished.

The run uses three phases:

| Phase | Input ownership |
| --- | --- |
| `survival` | Owns live waves plus input-locked wave gaps and boss stingers; pointer-lock pause is available during live combat |
| `survivalUpgrade` | Combat is stopped; the upgrade overlay owns unlocked input |
| `survivalDefeat` | The results overlay owns unlocked input |

Only active combat time is added to the run clock. Pauses, wave gaps, upgrade
drafts, boss-arrival stingers, and the defeat screen do not inflate the result.

```text
Credits → Return to Aking Museo
→ walk into the Endless Echoes arch
→ clear normal waves
→ choose one upgrade after Wave 2, then every fifth wave
→ defeat a Guardian on Wave 10
→ heal, earn a reroll, and choose an upgrade
→ repeat without a final wave
→ defeat
→ retry from Wave 1 or return to Aking Museo
```

Retry resets health, weapon path, upgrades, rerolls, wave state, and run
statistics. Returning to Aking Museo tears down Survival and restores the museum
— the sealed epilogue one after the ending, the ordinary hub when the run was
reached through the debug unlock.

## Controls

| Input | Survival action |
| --- | --- |
| `W A S D` | Move |
| Mouse | Look |
| `Shift` | Sprint while stamina remains |
| `Space` | Hop ground-level Guardian attacks; spends stamina |
| Left click | Fire the current primary thread |
| `Q` | Dash |
| `F` | Release the shockwave |
| `R` | Release Alab during combat |
| `1`–`3` | Choose the corresponding upgrade card |
| `R` | Reroll the three cards while the upgrade draft is open |
| `Escape` | Release pointer lock and pause active Survival |

The baseline dash has one charge, a **4-second** recharge, a **4.5m** travel
distance, a **0.16-second** movement window, and **0.22 seconds** of
invulnerability. It follows held movement input, or camera-forward when the
player is stationary. Movement is resolved in collision-safe substeps, does not
consume stamina, and clears queued input whenever combat loses ownership.

Alab remains weapon-neutral in Survival. While active, it multiplies primary
cadence by **1.75**. A Continuous Laser does not accumulate heat during Alab.

## Memory Arena

The Survival zone is a circular, **32m-radius** Memory arena born from the Final
Memory altar. Its **11.5m-radius** center is kept unobstructed for mixed-role
combat, dash movement, and boss telegraphs. Six readable edge lanes provide
spawn directions, while sparse broken-gallery cover sits outside the neutral
center.

The dressing reuses the three completed memories:

- Ponsia market and feast colors;
- Liket festival gold and procession forms;
- Pananisia archive, gallery, and architectural light.

Later boss tiers can shift the arena's accent, water, and fog colors. These
themes are cosmetic and do not change collision or combat tuning.

## Wave Direction

Every tenth wave is a boss wave. All other waves are normal threat recipes.
Wave 2 and then every fifth cleared wave opens an upgrade draft, including boss
waves after the Guardian has been defeated.

### Role introductions

| Wave | Newly available role |
| --- | --- |
| 1 | Chaser |
| 2 | Spitter |
| 3 | Boarder |
| 4 | Sniper |
| 6 | Gargoyle |
| 8 | Gale |

Survival replaces the short campaign-encounter health values with isolated base
health profiles: Chaser **12**, Spitter **14**, Boarder **16**, Sniper **12**,
Gargoyle **18**, and Gale **12**. The tier multiplier below is applied afterward.

Normal recipes retain unlocked roles when capacity permits and add no more than
four threats beyond the base recipe. Live plus pending threats are capped at
**10**. The pacing target is **30–45 seconds** per normal wave and a first
Guardian arrival within **6–8 minutes**; these targets require browser playtest
acceptance.

For `tier = floor((wave - 1) / 5)`, lesser threats use:

| Stat | Multiplier |
| --- | --- |
| Health | `1 + 0.30 × tier` |
| Damage | `1 + 0.16 × tier` |
| Speed | `min(1.45, 1 + 0.06 × tier)` |
| Attack interval | `max(0.68, 1 - 0.05 × tier)` |
| Projectile speed | `min(1.35, 1 + 0.04 × tier)` |

These are Survival-only instance profiles. The campaign defaults for Enemy,
RailThreat, and TowerThreat remain unchanged.

## Elite Echoes

Elites unlock after the first Guardian. Their chance is **12%** after that first
victory, rises by seven percentage points after each later Guardian, and caps at
**40%**. A wave can contain at most `min(4, bossesDefeated)` elites.

| Elite | Tuning | Readability |
| --- | --- | --- |
| Armored | `×1.8` health, `×0.9` speed | Gold tell |
| Frenzied | `×1.25` speed, `×0.7` attack interval, `×1.15` damage | Red tell |
| Volatile | Normal direct stats; delayed death burst | Violet tell |

A Volatile elite telegraphs a **3.2m** burst for **0.65 seconds** after a combat
death. Cleanup, abort, scene transition, and boss-transition removals never
trigger the burst.

## Guardian Waves

Waves 10, 20, 30, and so on contain exactly one remixed Guardian and nothing
else. **Guardian waves are duels: Survival builds every boss with
`allowSummons: false`, so none of them calls in adds** — a boss that also
summoned would be a wave stacked on a wave. Campaign fights are balanced around
their adds and are unaffected. Before the Guardian arrives, normal threats,
pending spawns, hostile projectiles, and leftover hazards are cleared. A **1.5-second** portal and name
stinger plays without moving the camera.

Guardian selection is seeded and random, with no immediate repeat:

| Guardian | Survival base health |
| --- | --- |
| The Feastkeeper | 180 |
| The Reveler | 160 |
| The Keeper | 200 |

For zero-based boss index `n`, Guardian tuning is:

- health: `base health × (1 + 0.55n)`;
- damage: `× (1 + 0.18n)`;
- attack interval: `× max(0.68, 1 - 0.07n)`.

Survival applies immutable tuning overrides and resolves primary attacks through
weapon-agnostic attack records. Campaign Guardians keep their authored tuning
and existing Light-bolt hit path. The Survival Reveler tracks the live player
instead of Arena 2's stationary boat target.

Guardian victory resolves in this order:

1. remove remaining hazards and any adds left from before the wave;
2. restore **25% of maximum health**;
3. record the Guardian defeat;
4. award one reroll, up to the cap of **2**;
5. open the post-Guardian upgrade draft.

## Primary Threads

Every run begins with the Light Bolt. It looks and sounds like the campaign's,
but carries **Survival's own damage** (`SURVIVAL_LIGHT_BOLT`) because Survival
threats use the larger health baseline above; the campaign's `COMBAT.BOLT.DAMAGE`
is deliberately left untouched. Weapon transformations remain in the draft until
one is chosen; that first choice permanently locks the run to one path. If no
path has been selected, a draft at Wave 15 or later guarantees at least one
eligible transformation.

Every path is tuned into the same **12–14 dps** band, so a transformation is a
change of shape — pierce, sustain, burst — and never a raw power gate. Damage is
also kept large enough that one Primary Power rank is legible rather than lost
to rounding.

| Path | Base behavior | dps |
| --- | --- | --- |
| Light Bolt (start) | 3 damage, 0.22s cooldown, 38m/s projectile | 13.6 |
| Rapid Weave | 2.5 damage, 0.18s cooldown, fast projectile | 13.9 |
| Continuous Laser | 28m hitscan, 10 ticks/s, 1.4 damage/tick, 2.5s heat | 14.0 |
| Thread Lance | 8 damage, 0.65s cooldown, 32m/s projectile, pierces 3 targets | 12.3 |

Continuous Laser enters a **1.25-second** lockout when overheated. Its heat meter
is shown only while that weapon is active. The beam is drawn as a bright core
inside a wider additive sleeve (two aimed cylinders, not a hairline `THREE.Line`),
thickening slightly as heat builds and sputtering in the last stretch before
lockout so the cutout is telegraphed. Piercing and hitscan damage are
resolved centrally so each target receives one explicit attack record.

## Upgrade Draft

Drafts open after **Wave 2** and then after every fifth wave. The early Wave 2
draft exists so the opening waves are not played on a bare build. `1`–`3`
and pointer selection are equivalent. Smart drafts remove locked, ineligible,
and max-rank cards and favor distinct categories when possible. Repeatable
Primary Power and Vitality remain available so an endless run cannot exhaust
all choices.

Each defeated Guardian grants one reroll, capped at two. A reroll consumes one
charge and cannot reproduce the same set of three card IDs.

| Family | Ranks and effect |
| --- | --- |
| Primary Power | Repeatable; `+18%` base primary damage per rank |
| Path Mastery | 3 ranks; path-specific piercing, heat/range, or lance radius |
| Vitality | Repeatable; `+15` maximum and current health per rank |
| Woven Ward | 3 ranks; 8% damage reduction per rank |
| Dash Weave | 3 ranks; shorter recharge, second charge, then longer distance |
| Shockwave Resonance | 3 ranks; damage/radius increases and cooldown reduction |
| Alab Reservoir | 3 ranks; `+15%` charge gain and `+0.5s` duration per rank |
| Lumina Affinity | 3 ranks; `+5` percentage-point drop chance per rank, stronger healing, and longer buffs |

Card descriptions are **derived, not authored**: `SurvivalUpgradeCopy.js` reads the
same weapon tables the weapons fire from, so a card cannot advertise a number the
weapon does not deal. Weapon cards state their damage, cadence and dps against the
Light Bolt they replace; Path Mastery names the weapon in hand and the exact
before/after for the rank being bought (for example "Thread Lance · rank 2 of 3:
pierces 5 targets (up from 4) and +20% blast radius").

Path Mastery grants:

- Rapid Weave: one additional pierce per rank;
- Continuous Laser: **0.5 seconds** of heat capacity, **2m** of range, and
  **22%** beam width per rank (the width is presentation only — range and heat
  are invisible until something is hit, which made the ranks feel inert);
- Thread Lance: one additional pierce and **10%** radius per rank.

## Defeat and Session Best

Defeat records and displays:

- wave reached;
- active combat time;
- lesser-threat kills;
- Guardians defeated;
- selected primary thread;
- all selected upgrade ranks.

Only one best result is retained for the current page session. It is not written
to campaign progress, `localStorage`, a database, or an online leaderboard. A
later wave ranks first; ties prefer more Guardians, then more kills, then longer
active time. Reloading the page clears the best result.

## Implementation Ownership

| Owner | Responsibility |
| --- | --- |
| `src/core/_partials/SurvivalFlow.js` | Credits entry, teardown, retry, museum return, and phase dispatch |
| `src/core/survival/SurvivalController.js` | Wave state, seeded selection, boss/intermission transitions, rerolls, run stats, and cleanup |
| `src/core/survival/SurvivalCombatManager.js` | Threats, weapons, health, hazards, scaling, and HUD snapshots |
| `src/core/survival/SurvivalBossDirector.js` | Authored Guardian construction, live target adaptation, and boss cleanup |
| `src/core/survival/SurvivalBossTuning.js` | Immutable Guardian HP, damage, and cadence adaptation |
| `src/core/survival/SurvivalWeapons.js` | Light Bolt, run-locked weapon paths, heat, piercing, and attack records |
| `src/core/survival/SurvivalRules.js` | Deterministic recipes, caps, elite policy, boss order, and normalized boss scaling |
| `src/core/survival/SurvivalProjectileRules.js` | Swept collision for frame-rate-safe Rapid and Lance hits |
| `src/core/survival/SurvivalUpgrades.js` | Smart drafts, weapon locking, rank rules, and build effects |
| `src/core/survival/SurvivalUpgradeCopy.js` | Draft card descriptions derived from the weapon tuning tables |
| `src/core/survival/SurvivalRunStats.js` | Active-time results and page-session best ordering |
| `src/core/survival/DashMotion.js` | Dependency-free collision-safe dash stepping |
| `src/core/survival/SurvivalDashRules.js` | Dependency-free dash defaults and invulnerability timing |
| `src/core/survival/SurvivalEntryPolicy.js` | Hub-portal entry authorization (ending seen or debug unlock) |
| `src/core/zones/survival.js` | Arena geometry, bounds, spawn lanes, cover, and cosmetic tier themes |
| `src/ui/SurvivalUI.js` | HUD, upgrade cards, stinger, results, keyboard input, and focus ownership |
| `src/audio/_partials/SurvivalSfx.js` | Procedural beam, lance, dash, elite, upgrade, and boss-arrival cues |

`Game` remains the composition root and animation-loop owner. Threat and boss
extensions are opt-in per instance, which preserves existing campaign behavior.

## Validation Boundary

Deterministic Node checks can validate recipe composition, scaling and caps,
role unlocks, elite rules, boss non-repetition and tuning, smart drafts,
rerolls, weapon locking and pity, rank limits, dash stepping, results ordering,
DOM contracts, and hub-portal routing.

Those checks do **not** prove browser runtime quality. Before release, manually
verify:

- legitimate and debug-unlock entry behavior;
- Waves 1–10 against the 6–8 minute target;
- Light Bolt and all three transformed weapons, including heat and piercing;
- Alab, shockwave, Space hop, dash, upgrades, and rerolls;
- all six roles and all three elite tells;
- every Guardian and later boss scaling;
- the 1.5-second portal/name stinger, stationary camera, and pause behavior;
- boss cleanup, heal, reward, and intermission order;
- pause/resume twice, pointer-lock failure recovery, defeat, retry, and museum
  return;
- every new cue, including sustained-beam start/stop cleanup;
- active time excluding pauses, wave gaps, drafts, stingers, and defeat;
- console errors, HUD fit, reduced motion, and stress performance at the threat
  cap.

Browser timing, pointer lock, visuals, audio, performance, and balance remain
manual runtime gates. Static or mock tests must not be reported as proving them.

## Current Limitations

- Desktop keyboard and mouse only; no touch, mobile, or gamepad input.
- Runs and session bests are not persisted across a page reload.
- Survival is reachable only by walking into the Endless Echoes arch in the
  museum hub; there is no title-screen shortcut and no persisted unlock.
- For Guardian QA only, enabling `DEBUG_TEST_ENDING_BUTTON` and setting
  `DEBUG_SURVIVAL_BOSS` to `feastkeeper`, `reveler`, or `keeper` forces that
  Guardian on boss waves. Both settings default to release-safe values.
- There are no riddles, campaign/meta saves, online leaderboards, new external
  assets, arena mutators, or combo scoring in this mode.
- The mode reuses campaign Guardians rather than shipping Survival-exclusive
  bosses, but strips their summons (see Guardian Waves).

## Follow-up Ideas

- cursed cards that trade safety for a stronger build;
- boss-tier arena mutators;
- weapon and ability evolutions;
- combo scoring;
- deterministic daily seeds;
- elite bounties;
- persistent meta progression.
