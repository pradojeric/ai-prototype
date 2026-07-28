# Current Focused Plan — Rewrite `STRINGS_GDD.md` (Awaiting Approval)

## Outcome

Replace the obsolete five-zone/prototype-era GDD with a single coherent design
document that describes the current three-memory structure, museum hub, arena-first
progression, artifact and Guardian Soul recovery, Final Memory ending, player-facing
systems, content, presentation, and implementation constraints.

The rewrite will document what the repository actually supports. Any intentional
design aspiration that is not implemented will be clearly labeled as future or
unverified instead of being presented as shipped behavior.

## Reference ledger

| Used | Reference | Application |
| --- | --- | --- |
| Yes | `threejs-gameplay-systems/SKILL.md` | Repository inspection, design brief, core-loop contract, encounter plan, and evidence-based reporting |
| Yes | `threejs-gameplay-systems/references/game-design-level-design.md` | Player promise, verbs, pressure/reward/failure model, MDA framing, pacing, readability, and level/encounter documentation |

No gameplay, physics, feel, audio, UI, or visual implementation is being changed,
so the corresponding implementation references are outside this documentation-only
scope.

## Complete-reading protocol

1. Capture the repository file list and line counts.
2. Read every authored text file in scope:
   - `index.html`, `styles.css`, and `_partials/*.css`;
   - every `src/**/*.js` module;
   - every `tests/**/*.js` test;
   - current design and project documents (`README.md`, `GAME_LOOP.md`,
     `Strings_v2.md`, `Arena1.md`, `Arena2.md`, `Arena3.md`, and the current GDD);
   - repository instructions only as constraints, not as game canon.
3. Inspect binary asset names, types, and directories without treating binary bytes
   as readable design prose.
4. Record each file as read in a temporary audit ledger and use code search to trace
   cross-module ownership and call paths.
5. Re-check files changed during the review before finalizing the document.

Generated metadata, Git internals, binary media bytes, and vendored/cache content
are excluded from semantic reading. Their manifests, filenames, and runtime
references remain part of the audit.

## Reconciliation ledger

Build an evidence table before writing, covering:

1. Boot, title, pointer lock, pause, cutscenes, defeat, retry, and ending states.
2. Player movement, camera, interaction, Light casting, health, and controls.
3. Museum hub, portal unlock order, zone re-entry, Soul pedestals, and Final Memory.
4. PONSIA, LIKET, and PANANISIA world identity, navigation, landmarks, and artifact
   sets.
5. Arena 1 wave/riddle/boss flow, Arena 2 rail/lantern/Reveler flow, and Arena 3
   tower/seal/Keeper flow.
6. Shared combat, projectiles, enemies, spawn telegraphs, Memory Lumina, HUD, audio,
   and failure/retry behavior.
7. Strings, Echo locator audio, artifact placement/discovery, lore cards, collection,
   and external session/unlock integration.
8. Journey guidance, prompts, accessibility behavior, responsive limits, and debug
   tooling.
9. Configuration values that define player-visible rules and tuning.
10. Known gaps where static code establishes intent but browser behavior remains
    unverified.

Conflicts are resolved in this order: executable code and data, focused tests,
arena/loop documents, then older prose. A discrepancy will not silently inherit the
older document's claim.

## Proposed GDD structure

1. Document status and implementation baseline
2. High concept, player promise, target experience, and design pillars
3. Audience, platform, session shape, and controls
4. World, themes, narrative premise, player role, and story arc
5. Core loop and progression loop
6. Global rules and systems
7. Museum hub and three-memory campaign structure
8. Zone 1 — PONSIA and Memory Arena
9. Zone 2 — LIKET and Memory River
10. Zone 3 — PANANISIA and Memory Tower
11. Artifacts, Strings, Echoes, discovery, and cultural-content model
12. Combat, enemies, bosses, health, failure, retry, and Memory Lumina
13. UI, guidance, accessibility, audio, VFX, camera, and visual direction
14. Final Memory, restored province, ending, and replay state
15. Technical architecture and external platform contract
16. Content inventory and authoritative tuning summary
17. Current limitations, validation status, and future-work boundary

The document will favor concise tables for exact mappings and prose for player
experience. It will not duplicate source code or preserve superseded milestone
plans as if they were current design.

## Writing rules

- Preserve Filipino and Pangasinan names, spelling, diacritics, and cultural meaning.
- Distinguish implemented behavior, configurable behavior, optional integration,
  debug-only behavior, and future intent.
- Use exact controls, counts, state transitions, and named systems only after tracing
  their live code paths.
- Keep the GDD design-facing: technical ownership is summarized where it clarifies
  feasibility or source of truth, not turned into an API reference.
- Avoid claims such as “AI procedural placement,” “five zones,” or “15 artifacts”
  unless current code proves them.
- Do not change gameplay code, content data, balance, assets, or other documents.

## Verification

1. Compare every GDD section against the reconciliation ledger.
2. Search for known obsolete claims from the current document and confirm they are
   either removed or explicitly historical.
3. Verify zone, artifact, riddle, wave, boss, Soul, portal, control, and ending
   mappings against code/data.
4. Confirm every named local document link resolves.
5. Confirm all repository files remain below the 1000-line hard limit; split the GDD
   only if needed, while retaining `STRINGS_GDD.md` as the public entry point.
6. Run `git diff --check` and inspect the final diff.
7. Report static/documentary validation honestly; no browser-runtime claim will be
   made unless a browser smoke test is actually performed.

## Scope boundary

This task changes only `STRINGS_GDD.md` plus the required planning trackers
`task.md` and `implementation_plan.md`. It does not change gameplay, balance,
narrative data, artifact lore, UI, audio, assets, dependencies, APIs, tests, or
other design documents.

---
