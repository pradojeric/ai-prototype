# Implementation Plan Index

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

Prior plans:

- `_partials/implementation_plan_riddle_readability.md` — multiline riddle
  readability
- `_partials/implementation_plan_archive.md` — archived guidance, HUD, and artifact
  documentation plans
- `_partials/implementation_plan_archive_2.md` — archived Strings v2.0 plan
