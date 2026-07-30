# Implementation Plan Index

Current persistence task:

- `_partials/implementation_plan_firebase_progress.md` — Firebase **anonymous**
  cloud save for campaign progress (GameOn returns no email/user id, so it
  cannot key a save); `saveState` → `SaveManager` → Firestore `progress/{uid}`,
  with GameOn left untouched as the optional reward path (awaiting user review)

Current Survival mode task:

- `_partials/implementation_plan_survival_mode.md` — Endless Memory: a desktop
  run-based arena with endless scaled waves, upgrade drafts, tenth-wave remixed
  Guardians, weapon paths, elites, dash, and full reset on defeat. Entry and
  draft cadence have since moved on — see the balance and portal plans below.

Current pause menu task:

- `_partials/implementation_plan_pause_menu.md` — the two-line resume overlay
  becomes a run ledger: objective checklist, memories/Souls/zones progress, and a
  context-aware control reference, split as `PauseState` → `pauseModel` →
  `PauseMenu` (the Journey Guide's proven pattern)

Current arena victory task:

- `_partials/implementation_plan_arena_victory_rift.md` — shared 5.6-second
  first-person boss explosion, Memory Rift formation, and pull back to each zone

Current combat controls task:

- `_partials/implementation_plan_hold_fire_melee.md` — hold the mouse to
  auto-repeat light-bolts instead of clicking per shot, plus an `F` melee
  shockwave (damage + knockback) with its cooldown drawn on the crosshair

Current boss structure task:

- `_partials/implementation_plan_keeper_scheduler.md` — Keeper of Memories: the
  four priority-ordered attack clocks become one weighted scheduler with a
  `_pattern` guard (parity with the Feastkeeper and Reveler), and the 736-line
  file splits into four mechanic partials

Current combat tuning task:

- `_partials/implementation_plan_keeper_attack_tuning.md` — Keeper of Memories:
  faster charge dash, a walk-to-centre state so the lighthouse sweep pivots on
  the tower heart, and a jumpable sweep drawn as a shader light-wall whose height
  is the hit volume

Current gameplay task:

- `_partials/implementation_plan_summit_portal_arena3boss.md` — Arena 3's summit
  becomes a walk-in portal; the Keeper of Memories fight moves to a new `arena3boss`

Current UI phase:

- `_partials/implementation_plan_awaken_transition.md` — black Awaken prompt
  between Start and `IntroCutscene`, followed by curved eyelids opening over the
  museum cinematic

Current UI bug fix:

- `_partials/implementation_plan_main_menu_flash_fix.md` — prevent the live
  Zone 1 canvas from showing through the Start-to-black crossfade

Current UI task:

- `_partials/implementation_plan_main_menu.md` — layered desktop main-menu
  redesign, optimized authored UI assets, `Start` action, debug-gated museum
  shortcut, and temporary black pre-Awaken handoff

Current content task:

- `_partials/implementation_plan_hil_zone_dialogue.md` — replace all three
  zone-entry placeholders with Hil's concise inner-voice dialogue

Current task:

- `_partials/implementation_plan_gameon_api.md` — direct `main` implementation of
  GameOn Portal session authorization and a legitimate full-campaign artifact
  unlock; `feat/auth` remains untouched and unmerged

Prior task:

- `_partials/implementation_plan_arena3_jump.md` — enable Arena 1's existing
  Space-key combat jump for Arena 3, including fight lifecycle cleanup and the
  Keeper-start control callout

Prior task:

- `_partials/implementation_plan_reveler_patterns.md` — Arena 2 boss: three attack
  patterns (Overload Channel, Scatter Hex, Shell Rotation) behind the same
  non-overlapping scheduler shape as the Feastkeeper (implemented; as-built tuning
  deltas recorded in `task.md`)

Prior task:

- `_partials/implementation_plan_feastkeeper_patterns.md` — Zone 1 boss: combat
  jump + three attack patterns (Handog Barrage, Spiral Feast, Offering Slam)
  behind one non-overlapping scheduler

Prior task:

- `_partials/implementation_plan_damage_numbers.md` — world-space floating combat
  text: damage dealt/taken, `BLOCKED` on shield hits, armor-break/phase callouts

Prior task:

- `_partials/implementation_plan_zone_moonlight.md` — zones 1–3 moonlight rig:
  cool key + gradient environment map so the CC0 PBR maps read, per-zone `light`
  overrides, god-ray shafts removed

Prior task:

- `_partials/implementation_plan_tower_riddle_console.md` — Arena 3 seal consoles:
  interact-with-E overlay bugtong replacing the shoot-the-answer-node flow

- `_partials/implementation_plan_guardian_textures.md` — CC0 PBR texture pass over
  all three Guardian bosses

- `_partials/implementation_plan_zone_design_assets.md` — zones 1–3 layout redesign
  and CC0 asset pass (textures, instancing, shared zone kit, verticality)

- `_partials/implementation_plan_world_seed_riddles.md` — per-run world seed for
  non-duplicating riddles across zone arenas
- `_partials/implementation_plan_museum_assets.md` — museum hub CC0 texture/HDRI pass
- `_partials/implementation_plan_strings_gdd.md` — rewrite `STRINGS_GDD.md`
  (awaiting user review)
- `_partials/implementation_plan_presenter_skip.md` — hidden Shift+P presenter
  key that fast-forwards fights, riddles, cutscenes and collection for live demos
- `_partials/implementation_plan_survival_balance.md` — Survival Mode early-game
  balance (Survival-specific bolt damage, dps band, wave-2 draft)
- `_partials/implementation_plan_survival_portal.md` — Endless Echoes arch in the
  museum lobby + `DEBUG_SURVIVAL_UNLOCKED` (replaces the credits entry button)
- `_partials/implementation_plan_survival_duel_laser.md` — Survival boss waves
  become duels (`allowSummons`), the stale shared attack-target array that made
  the laser stop damaging the Reveler, and a core+sleeve beam that reacts to heat
- `_partials/implementation_plan_survival_briefing.md` — the pre-run briefing that
  explains Endless Echoes before Wave 1, plus its pause-menu Lore re-read

Prior plans:

- `_partials/implementation_plan_riddle_readability.md` — multiline riddle
  readability
- `_partials/implementation_plan_archive.md` — archived guidance, HUD, and artifact
  documentation plans
- `_partials/implementation_plan_archive_2.md` — archived Strings v2.0 plan
