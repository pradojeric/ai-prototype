# Endless Memory Survival Mode

## Summary

Add a desktop-only, run-based Survival mode accessible only from the ending
credits. It uses a new altar-born Memory arena, endless stat-heavy waves,
one-of-three upgrades every fifth wave, a random remixed Guardian every tenth
wave, and full build reset on death.

Before code changes, copy this design into
`_partials/implementation_plan_survival_mode.md`, index it from
`implementation_plan.md`, and add the implementation checklist to `task.md`.

## Player Flow and Rules

- Credits show two actions: `Enter Endless Memory` and the existing
  `Return to Aking Museo`. No title-screen unlock or localStorage access flag is
  added.
- Add phases `survival`, `survivalUpgrade`, and `survivalDefeat`. Only active
  Survival is pointer-lock pausable; upgrade and defeat overlays intentionally
  own unlocked input.
- Death displays wave, active time, kills, bosses defeated, selected weapon, and
  upgrade ranks. Preserve only the best result in memory for the current page
  session; offer `Retry from Wave 1` or `Return to Aking Museo`.
- Every fifth cleared wave pauses combat for a smart one-of-three draft. Boss
  waves still grant their fifth-wave upgrade after the boss dies.
- Earn one reroll per defeated boss, capped at two. Rerolls cannot reproduce the
  same three card IDs.
- Every tenth wave contains only a boss and its authored summons. Before arrival,
  clear normal threats/projectiles, play a 1.5-second portal/name stinger without
  moving the camera, then begin combat.
- Boss order is random from wave 10 onward with no immediate repeat.
  Survival-specific base HP is Feastkeeper `180`, Reveler `160`, and Keeper
  `200`; scale by boss index with HP `1 + 0.55n`, damage `1 + 0.18n`, and
  attack-interval multiplier `max(0.68, 1 - 0.07n)`.
- Boss victory removes remaining hazards/adds, restores 25% maximum health,
  awards the reroll, then opens the upgrade draft.

## Combat, Progression, and Arena

- Build a purpose-made 32m-radius circular Memory arena with an unobstructed
  center, readable spawn lanes, sparse edge cover, broken museum/gallery motifs,
  and reused Ponsia/Liket/Pananisia dressing. Visual color shifts may mark boss
  tiers but have no gameplay effect.
- Adapt all six existing lesser roles through Survival-only profiles: chaser,
  spitter, boarder, sniper, gargoyle, and gale. Campaign arena behavior remains
  unchanged.
- Introduce roles across waves 1/2/3/4/6/8 respectively. Later recipes mix all
  unlocked roles, add at most four enemies beyond the base recipe, and cap live
  plus pending threats at ten.
- For `tier = floor((wave - 1) / 5)`, apply:
  - HP multiplier `1 + 0.30 × tier`
  - damage multiplier `1 + 0.16 × tier`
  - speed multiplier `min(1.45, 1 + 0.06 × tier)`
  - attack-interval multiplier `max(0.68, 1 - 0.05 × tier)`
  - projectile-speed multiplier `min(1.35, 1 + 0.04 × tier)`
- Target 30–45 seconds per normal wave and first-boss arrival within 6–8
  minutes.
- Unlock elites after the first boss. Elite chance begins at 12%, gains seven
  percentage points per later boss, and caps at 40%; elite count per wave caps at
  `min(4, bossesDefeated)`.
  - Armored: `×1.8` HP, `×0.9` speed, gold tell.
  - Frenzied: `×1.25` speed, `×0.7` attack interval, `×1.15` damage, red tell.
  - Volatile: violet tell and a telegraphed 3.2m death burst after 0.65 seconds;
    cleanup/abort deaths never trigger it.

### Weapons and upgrades

- Survival starts with the campaign Light Bolt plus baseline Q dash. Weapon
  transformations remain in the random draft until one is selected; the first
  choice permanently locks that run’s path. Guarantee at least one eligible
  transformation by wave 15 if none has been chosen.
- Weapon paths:
  - Rapid Weave: 1 damage, 0.18s cooldown, fast projectile.
  - Continuous Laser: 28m hitscan beam, ten damage ticks/second at 0.55 damage
    each, 2.5s heat capacity, and 1.25s overheat lockout.
  - Thread Lance: 3 damage, 0.65s cooldown, 32m/s projectile, and three-target
    piercing.
- Keep eight upgrade families:
  - Primary Power: repeatable `+18%` base primary damage.
  - Path Mastery, three ranks: Rapid gains one pierce; Laser gains 0.5s heat and
    2m range; Lance gains one pierce and 10% radius per rank.
  - Vitality: repeatable `+15` maximum/current health.
  - Woven Ward: three ranks of 8% damage reduction.
  - Dash Weave: cooldown reduction, second charge, then increased distance.
  - Shockwave Resonance: three ranks adding damage/radius and reducing cooldown.
  - Alab Reservoir: three ranks adding 15% charge gain and 0.5s duration.
  - Lumina Affinity: three ranks adding five percentage points of drop chance,
    stronger Vitality healing, and longer temporary buffs.
- Smart drafts remove locked/ineligible/maxed cards, include distinct categories
  when possible, and preserve repeatable Power/Vitality so endless runs never
  exhaust valid choices.
- Q dash starts with one charge, 4s recharge, 4.5m distance, 0.16s movement, and
  0.22s invulnerability. It uses movement direction or camera-forward when
  stationary, performs collision-safe substeps, consumes no stamina, and clears
  queued input on pause/intermission/death.
- Retain F shockwave and adapt R Alab into weapon-neutral overdrive. In Survival,
  Alab multiplies primary cadence by `1.75`; Laser stops accumulating heat while
  overdrive is active. Campaign values and behavior remain unchanged.

## Architecture and Interfaces

- Keep `Game.js` below 1000 lines by placing entry, teardown, retry, museum return,
  and update dispatch in `src/core/_partials/SurvivalFlow.js`; place controllers,
  wave direction, weapons, bosses, upgrades, elites, and run stats under
  `src/core/survival/`.
- Add `survival` to the zone registry with its own authored zone definition. A
  `SurvivalController` owns wave state, boss/intermission transitions, seeded
  selection, run stats, and cleanup; `SurvivalCombatManager` owns threats, player
  attacks, scaling, health, hazards, and HUD state.
- Add optional per-instance threat profiles for HP, speed, damage, cadence,
  projectile speed, and elite presentation. Existing constructors default to
  their current campaign constants.
- Add weapon-agnostic boss hit handling: Survival resolves projectile/beam attacks
  centrally and passes attack records to `receivePlayerAttack`. Existing bosses
  retain their current bolt-scanning path unless explicitly configured for
  external Survival resolution.
- Allow Feastkeeper, Reveler, and Keeper constructors to accept immutable tuning
  overrides. Reveler’s Survival variant tracks the live player position instead
  of Arena 2’s stationary boat target. Default campaign tuning remains
  byte-for-byte equivalent.
- Extend `PlayerController` with enable/request/disable dash and an authoritative
  invulnerability state.
- Add a Survival HUD for wave, remaining enemies, next milestone, weapon/heat,
  dash charges, and rerolls; add keyboard-accessible upgrade cards (`1`–`3`) and
  reroll (`R`) alongside pointer controls.
- Extend pause state/model with the Survival location, wave/build/run snapshot, Q
  dash control, and current health. Add procedural Web Audio cues for beam,
  lance, dash, elite warning, upgrade selection, and boss arrival.
- Keep the legitimate-ending GameOn reward gate untouched. Debug ending playback
  may enter Survival for testing but must remain platform-reward-ineligible.

## Verification and Documentation

- Add deterministic tests for wave recipes, scaling/caps, all role unlocks, elite
  eligibility, boss non-repetition, boss tuning immutability, smart drafts,
  rerolls, weapon locking/pity, rank limits, repeatable upgrades, dash
  collision/invulnerability, results/session-best ordering, and credits-only
  entry.
- Run the full Node suite, `node --check` over every source module, import/DOM-ID
  audits, file-length audit, stale-reference searches, and `git diff --check`.
  Current clean baseline is 24 passing tests.
- Manually verify in-browser:
  - legitimate ending and debug-ending entry behavior;
  - first ten waves at the 6–8 minute pacing target;
  - all weapons, heat/piercing, Alab, shockwave, dash, upgrades, and rerolls;
  - all six threat roles and three elite tells;
  - each Guardian through debug-assisted boss selection and later scaling;
  - boss cleanup/heal/intermission order;
  - pause/resume twice, pointer-lock failure recovery, death/retry, and museum
    return;
  - audio cleanup, console errors, HUD fit, reduced motion, and stress performance
    at the live-threat cap.
- Browser timing, pointer-lock, visual, audio, and balance acceptance remains a
  manual runtime gate; static tests must not be reported as proving those
  behaviors.
- Add `SurvivalMode.md` as the as-built encounter guide, update the
  ending/controls/tuning/limitations sections of `STRINGS_GDD.md`, and replace the
  obsolete ending description in `GAME_LOOP.md`.

## Assumptions and Deferred Ideas

- Defaults selected after unanswered questions: capped abilities/defenses with
  repeatable damage and health, brief boss stingers, and normalized random-boss
  difficulty.
- Out of scope: campaign/meta saves, title access, mobile/gamepad input, riddles,
  online leaderboards, new external assets, arena mutators, and combo scoring.
- Document as follow-up ideas: cursed risk/reward cards, boss-tier arena mutators,
  weapon/ability evolutions, combo scoring, deterministic daily seeds, elite
  bounties, and persistent meta progression.
