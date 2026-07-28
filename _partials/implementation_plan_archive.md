# Implementation Plan — Journey Objective & First-Time Guidance UI (Approved)

## Player-facing intent

Give the player one clear next step without turning the game into a checklist or
covering the action. The interface will read like a restrained museum accession
label: an archival heading, a short story-led line, one actionable objective, and
progress only when progress is measurable.

The right-side panel is for exploration and museum phases. Arena combat keeps the
existing specialized HUD and collapses the panel into a small
`Challenge in progress` label. Objective changes briefly slide/fade in; tutorial
and Lumina messages appear as separate short notifications and never pause play.

## Reference ledger

| Used | Reference | Application |
| --- | --- | --- |
| Yes | `threejs-game-ui-designer/references/ui-patterns.md` | Objective hierarchy, authored museum styling, combat-safe collapse, brief state-change animation, state-driven UI, stable desktop dimensions, and reduced HUD duplication |

The mobile-input reference is intentionally not loaded because the approved scope
is desktop only. The completion checklists will be loaded before this UI work is
claimed complete.

## Objective sequence and copy model

Each state has a short archive/story line plus one imperative objective. Only the
active state is rendered.

1. **Museum, zones remain**
   - Story: `Another drowned memory stirs beyond the gallery.`
   - Objective: `Enter the open memory`
2. **Main zone, Guardian undefeated**
   - Story: use the active zone name in a compact archive label.
   - Objective: `Enter the Memory Rift`
   - Progress: none; the existing proximity prompt supplies the `E` instruction.
3. **Arena combat**
   - Collapsed label: `Challenge in progress`
   - No quest progress; wave/riddle/seal/boss progress stays in the existing combat HUD.
4. **Guardian defeated, memories remain**
   - Story: `The Guardian has fallen. Its memories are scattered.`
   - Objective: `Recover the scattered memories`
   - Progress: existing whole-zone count and total plus a stable-width progress bar.
5. **All memories recovered, Soul remains**
   - Story: `One final light still binds this place.`
   - Objective: `Claim the Guardian Soul`
   - Progress: `0 / 1` plus a progress bar.
6. **Soul recovered before all memories**
   - Remain on `Recover the scattered memories`; the quest reflects the remaining
     requirement rather than displaying a completed intermediate task.
7. **Zone complete**
   - Story: `This memory is ready to join the collection.`
   - Objective: `Return to the Museum`
   - The existing zone-complete overlay remains the interaction surface.
8. **Museum, all three Souls placed**
   - Story: `Three Guardian Souls wait within the archive.`
   - Objective: `Awaken the Final Memory`
   - Progress: `3 / 3`; the existing altar prompt supplies the hold-`E` instruction.
9. **Title, cutscenes, ending, pause overlays, discovery cards, and debug gallery**
   - Hide the guidance layer where another authored UI owns the player's attention.

Objective content will live in a small data/config module so copy and presentation
logic remain separate. Zone totals and completion values will always come from
`ArtifactManager`, `collectedSouls`, `completed`, and the existing phase state—not
from duplicated quest counters.

## UI architecture

### New focused modules

1. Add `src/ui/JourneyGuide.js` to own:
   - objective rendering and progress normalization;
   - expanded, collapsed-combat, hidden, and update-animation states;
   - a FIFO notification queue so control and Lumina messages never overlap;
   - per-instance `Set`s for once-per-run control and Lumina keys;
   - timeout cleanup and `dispose()` behavior.
2. Add `src/ui/_partials/journeyObjectives.js` for objective ids, museum-style copy,
   and a pure resolver that maps an explicit gameplay snapshot to one presentation
   model. This keeps branching rules independently testable and keeps UI code small.
3. Add `_partials/journey-guide.css` and link it from `index.html`, preserving the
   existing CSS-partial convention and keeping `styles.css` below 1000 lines.

`Game` remains the state/progression owner. `JourneyGuide` receives explicit
snapshots and semantic notifications; it does not mutate simulation state.

### Markup and accessibility

Add three restrained DOM regions:

- `#journey-guide`: fixed right-side archive panel with story, objective, count, and
  progress track;
- `#journey-collapsed`: the small arena status label;
- `#guidance-toast`: a single queued notification surface.

Use `role="status"` and `aria-live="polite"` for changes. Progress markup receives
`role="progressbar"` and synchronized `aria-valuemin`, `aria-valuemax`, and
`aria-valuenow`. Decorative rules and archive marks remain `aria-hidden`.

The visual language will reuse the game's Georgia typography, ink/amber/teal palette,
thin brass rules, translucent dark museum glass, and restrained paper-label geometry.
It will avoid a generic web-dashboard card, new image assets, and large decorations.

## Progression wiring

1. Construct `JourneyGuide` after DOM binding in `Game`.
2. Add a thin `_syncJourneyGuide()` method outside the already-large `Game.js`
   orchestration body, in a new `src/core/_partials/GameGuidance.js` mixin.
3. Call synchronization only from authoritative transitions:
   - initial gameplay/zone start;
   - museum entry and zone entry;
   - arena start, faint/retry, and arena return;
   - artifact collection;
   - Guardian Soul collection;
   - zone completion;
   - Final Memory/ending transitions;
   - debug entry and pause/resume visibility changes where needed.
4. Re-sync after arena faint/retry without replaying first-time notifications or
   briefly expanding the combat label.
5. Preserve all combat HUD behavior. Remove the superseded exploration-only
   artifact counter and Rift hint so the Journey panel is the single objective source.

## First-time control guidance

Notifications are contextual, one at a time, non-interactive, and removed by a
short timeout. Seen keys live only in the `JourneyGuide` instance, so refreshing the
page resets them naturally and no storage is added.

Planned sequence:

1. First playable exploration state: `WASD — Move through the memory`
2. After the opening movement hint: `Mouse — Look around`
3. Once movement is available: `Shift — Sprint`
4. On first relevant world interaction range: `E — Reach toward the memory`
5. On first arena entry: `Click — Cast Light`
6. After pointer lock begins, queued after higher-priority guidance:
   `Esc — Release the cursor`

The queue prevents hints from stacking. Existing contextual prompts remain the
authoritative immediate interaction instructions. Guidance is suppressed during
cutscenes, discovery, pause, faint, completion, and ending overlays.

## Memory Lumina explanations

The explanation fires when the effect is actually applied, not merely when an orb
spawns. Add one semantic effect callback/event at `LuminaManager._applyEffect()` so
all arena variants—including automatic collection—share the same truth.

Once per run, show:

- `Vitality — Health restored`
- `Zephyr — Movement empowered`
- `Overcharge — Rapid casting awakened`

Messages do not instruct the player to collect an orb because some arena profiles
collect them automatically. Existing buff timers, health feedback, colors, balance,
drop logic, audio, and effect durations remain unchanged.

## Motion, fit, and interruption rules

- Panel update: short slide/fade and progress-fill transition.
- Arena transition: collapse to the small label before combat HUD activity.
- Notifications: fade/translate in, hold, then fade out on timeout.
- `prefers-reduced-motion: reduce`: remove translation and shorten/disable nonessential
  transitions.
- Use fixed right offset, stable width via `clamp`, fixed count slot, line clamping,
  and a maximum text measure so long zone/objective text does not shift the HUD.
- Keep the panel clear of the top-center boss HUD, center interaction prompts,
  crosshair, bottom status clusters, and right-edge combat threat markers.
- No mobile breakpoint or touch guidance will be designed in this scope, but narrow
  desktop/laptop fit will still be checked.

## Verification

### Static and focused checks

- Run `node --check` on every touched/new JavaScript module.
- Add a focused mocked DOM test for:
  - objective resolver states;
  - expanded/collapsed/hidden modes;
  - progress and ARIA synchronization;
  - notification FIFO order, timeout dismissal, and once-per-run suppression;
  - all three Lumina effect messages;
  - reset behavior from a fresh `JourneyGuide` instance.
- Audit every new DOM id against `index.html`.
- Confirm no persistence API is used for guide state.
- Confirm no combat wave/riddle/boss values are copied into objective state.
- Check all source files stay below 1000 lines.
- Run `git diff --check`.

### Required browser smoke test

- Intro into Zone 1: control hints appear sequentially and time out without pausing.
- Zone exploration: Rift objective and contextual `E` prompt coexist without overlap.
- Arena 1, 2, and 3: panel collapses; current combat HUD remains readable.
- Faint/retry: collapsed state restores without replaying already-seen guidance.
- First Vitality, Zephyr, and Overcharge application: correct one-time explanation;
  repeat pickups do not replay it.
- Arena return: scattered-memory objective uses the live total and updates its count/bar.
- Collect Soul before memories and memories before Soul: objective always names the
  remaining requirement.
- Zone completion and museum return: story-led objective updates cleanly.
- All Souls: Final Memory objective appears at the altar.
- Pause, discovery, completion, ending, and debug states: no overlapping guide.
- Desktop and narrow-laptop screenshots: no clipping or overlap with prompts, boss
  HUD, combat markers, or Lumina timers; console remains clean.

## Scope boundary

No mobile/touch UI, manual quest log, optional quests, world markers, minimap,
navigation arrows, gameplay/balance changes, audio changes, new art assets,
combat-HUD redesign, progression changes, storage persistence, or unrelated UI
cleanup is included.

---

# Implementation Plan — Enemy Direction Arrow Readability

## Scope and intent

The shared off-screen threat marker currently clamps to `0.86` of the viewport
half-extents, placing it close to the screen edge. Reduce
`HUD.THREAT_MARGIN` to `0.62` so enemy arrows sit substantially nearer the
crosshair while remaining outside the central aiming area.

## Implementation

1. Change only the shared `THREAT_MARGIN` tuning value in `src/config.js`.
2. Preserve `CombatHud.trackThreats()` projection, behind-camera correction,
   arrow rotation, pooling, update interval, and enemy-type styling.
3. Run JavaScript syntax checks, a focused static assertion for the new value,
   file-length checks, and `git diff --check`.
4. Leave final visual/readability confirmation to an in-browser combat smoke
   test because static checks cannot prove canvas/HUD composition.

---

# Implementation Plan — Artifact Origins & Lore (Awaiting Approval)

## Approved content direction

- Rewrite all 27 artifacts across PONSIA, LIKET, and PANANISIA.
- Replace the current `fact` and `note` model with explicit `origin` and `lore`
  fields.
- Keep the writing historically grounded: no invented flood mythology or fictional
  provenance presented as history.
- Use natural English while retaining Filipino and Pangasinan names and culturally
  important terms.
- Target one short paragraph per section (medium length).
- Correct or standardize artifact names when reliable sources support the change.
- Present Origin and Lore together as one continuous museum-style reading experience.

## Research and editorial method

1. Build a 27-entry research ledger grouped by zone.
2. Prefer primary and authoritative Philippine sources: NHCP registries, provincial
   and municipal government pages, DOT/TPB, DOST, church or site custodians, and
   established Philippine cultural institutions.
3. Cross-check specific dates, claimed places of origin, festival names, titles,
   and superlatives. Treat tourism copy as evidence of current identity, not
   automatically as proof of historical origin.
4. Grade each entry:
   - **Confirmed:** direct authoritative support exists.
   - **Supported:** multiple credible sources agree, but no primary history is found.
   - **Tradition:** preparation or community association is documented, while the
     precise inventor/date is unknown.
   - **Needs correction:** the current name or claim is unsupported or conflicts
     with reliable evidence.
5. For undocumented beginnings, say that the tradition developed in or became
   associated with a community; do not invent a founder, date, or origin legend.
6. Keep citations in an internal research ledger rather than placing URLs inside
   player-facing prose.

The initial MCP search already confirms useful official coverage for Pista'y Dayat,
Bagoong Festival, Bangus Festival, Manaoag, and broader Pangasinan history. Several
current LIKET festival labels did not return authoritative matches in the first pass;
they will receive targeted verification before copy is finalized.

## Data changes

1. In `src/data.js`, retain every gameplay-critical field unchanged:
   `id`, `fil`, `eng`, `spawnTag`, `image`, and `zone`.
2. Replace:
   - `fact` with `origin`
   - `note` with `lore`
3. Write `origin` as the documented beginning, locality, cultural development, or
   historical association of the subject.
4. Write `lore` as the subject's documented community meaning, practice, remembered
   tradition, symbolism, or role in Pangasinan life. “Lore” will remain historical
   and cultural, not fictional.
5. Audit every code consumer and outbound artifact payload so the rename does not
   silently produce missing content.

## Discovery overlay changes

1. Update `index.html` to replace the separate fact/note nodes with an
   `Origin & Lore` story region containing:
   - a small `ORIGIN` heading and origin paragraph;
   - a visual continuation marker;
   - a small `LORE` heading and lore paragraph.
2. Update `src/ui/DiscoveryScreen.js` to bind `d.origin` and `d.lore`. Cache the
   required DOM nodes in the constructor rather than repeatedly querying them during
   every discovery.
3. Preserve the existing public `show(artifactData, zoneName, onSaved)` contract,
   collection callback timing, museum replay behavior, fade timing, zone label, and
   dismissal interaction.
4. Give the image a descriptive `alt` value derived from the artifact name.
5. Update `styles.css` so the longer story remains readable:
   - stable centered card width;
   - restrained section labels and readable paragraph measure;
   - vertical scrolling for short viewports;
   - responsive image/title/type sizing using `clamp`;
   - no clipped Saved/Continue messaging.
6. Keep the current parchment/museum visual language; no generated image assets or
   unrelated HUD redesign are in scope.

## Verification

- Run `node --check` on touched JavaScript modules.
- Search for stale `.fact`, `.note`, `d-fact`, and `d-note` references.
- Confirm all 27 entries contain non-empty `origin` and `lore` fields and retain
  unique ids, valid zone numbers, and existing asset paths.
- Check every touched source file remains under 1000 lines.
- Run `git diff --check`.
- Browser checks, if the local environment permits:
  - newly collected artifact card;
  - museum replay card (no collection callback);
  - longest entry at desktop and narrow/mobile viewport sizes;
  - scrolling, dismissal, image fallback, and clean console.

## Scope boundary

No gameplay, artifact spawning, collection progression, API session behavior,
museum population, audio, guardian, arena, or asset changes are included.

---

