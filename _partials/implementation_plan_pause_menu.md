# Implementation Plan — Memory Ledger Pause Menu (2026-07-30)

## Problem

`#resume` is a two-line overlay: an italic subtitle plus "Click to resume". Every
piece of run state the player might want while paused — what they are supposed to
be doing, how many memories they have recovered, how many Guardian Souls they
hold, which zones are open, what the keys are — lives only in the HUD, which the
pause overlay covers. The pause screen is the one moment the player is allowed to
read, and it currently shows nothing.

## Intent

Turn pause into the run's **ledger**: objectives as a checklist, the collection
totals, the Souls, the zones, and a context-appropriate control reference — in
the game's existing field-journal visual language (amber rules + teal accents,
matching `journey-guide.css`), not a web dashboard.

## Architecture

Mirrors the existing Journey Guide split exactly, so the pattern is already
proven in this codebase (`journeyObjectives.js` + `JourneyGuide.js`):

| File | Role |
| --- | --- |
| `src/core/_partials/PauseState.js` | `collectPauseState(game)` — reads the Game state machine into a plain snapshot. The only file that knows Game's field names. |
| `src/ui/_partials/pauseModel.js` | `buildPauseModel(state)` — pure, no DOM. Snapshot → view model (objectives, meters, pips, controls). Unit-testable. |
| `src/ui/PauseMenu.js` | `render(model)` — owns the `#resume` DOM. Pools list rows so repeated pauses do not churn nodes. |
| `_partials/pause-menu.css` | Styling, linked from `index.html` beside the other HUD partials. |

Data flow: `GamePauseController._showOverlay()` → `collectPauseState(game)` →
`buildPauseModel` → `pauseMenu.render`. Single direction, one source of truth
(Game), no state duplicated in the UI.

## Content per phase

Objectives are a status checklist (`done` / `active` / `todo`), not one line:

- **playing** — Enter the Memory Rift · Recover the scattered memories (x/y) ·
  Claim the Guardian Soul · Return to Aking Museo
- **arena** — Survive the drowned echoes · Break the Guardian's armor (wards x/3)
  · Carry the memory back, plus a Health vital meter
- **museum** — Enter an open memory · Recover all three Guardian Souls (x/3) ·
  Awaken the Final Memory
- **descend / complete / ending / debug** — their own short lists

Always-on progress block (global, not just the active zone):

- Memories restored: total / 27 with a meter, plus one row per zone (11 / 9 / 7,
  counts derived from `ARTIFACT_DATA`, never configured), marked `Sealed` while
  that zone's museum portal is still locked
- Guardian Souls: 3 pips + `n / 3`
- Zones restored: 3 pips + `n / 3`

Controls are context-selected (explore / arena / museum / hub), grouped, and
rendered as key-chip rows.

## Constraints honored

- The overlay stays click-anywhere-to-resume (the click is the pointer-lock
  gesture) — `#resume-enter` becomes the focused primary button so Enter/Space
  also resumes, and every `[data-settings]` control stops propagation.
- `GamePauseController`'s existing pointer-lock retry strings keep writing to
  `#resume-enter`, so all the failure copy still lands somewhere visible.
- `wireSettings` switches from the `.gear` class to the `[data-settings]`
  attribute already present in the markup, so the new footer Settings button
  reuses the same modal with no duplicated logic.
- Overlay background becomes a translucent scrim + `backdrop-filter` blur so the
  frozen frame stays readable behind the ledger (`#start` keeps its opaque
  gradient — the two shared one rule and are now split).
- Responsive: two-column grid collapses to one under 860px, panel scrolls
  internally, safe-area padding, tabular numerals so counts never shift width.

## Phase 2 (user-selected additions)

Same chain, three tabs deep. The shell gains a **Ledger / Memories / Lore** strip
and the panel stops being a click-to-resume surface (the backdrop still is), since
it is now browsable.

| Addition | Where |
| --- | --- |
| Artifact gallery grid + inline re-read | `src/ui/_partials/PauseCollection.js` (grid, detail, lore rendering) |
| Zone lore recap | `src/data/zoneLore.js` — retold from GDD §8–§10 + the zone modules |
| Run stats | `src/core/_partials/RunStats.js` fed by `_partials/runEvents.js` |
| Look speed / brightness | `wireSettings` → `controls.pointerSpeed`, `renderer.toneMappingExposure` |
| Restart memory / Quit to title | `src/core/_partials/SessionFlow.js` + `pause.abandon()` |

## Phase 3 — the control reference is complete, not filtered

The first pass showed only the verbs a context could use, which meant a pause
while wading a zone listed **no combat at all** — the kit read as if it did not
exist. The reference now lists *every* binding the game actually reads in every
context; the ones that are not live are kept, marked `available: false`, dimmed,
and given the reason (group `note`, or the row's own caveat folded into its text).

Bindings were re-read from the handlers rather than recalled: WASD only (no arrow
keys) and either Shift in `PlayerController`; `Space` edge-triggered and armed only
by `setJumpEnabled`; `E` / `F` / `R` and held left mouse in `wireGameEvents`;
`1`–`3` (digit or numpad) in `RiddleScreen`'s key mode, used by Arena 3's seals.
`buildPauseModel` normalizes `available`/`note` defaults so `PauseMenu` never has
to know they are optional. A test asserts each binding appears **exactly once per
context**, in all eleven pausable phases, so a future verb cannot be added to the
game and quietly missed here.

Deliberately excluded: the presenter's hidden `Shift+P` demo fast-forward. It is a
stage tool whose whole value is that the audience does not know it exists.

Decisions worth recording:

- **The memory detail is rendered inside the pause overlay, not by reusing
  `DiscoveryScreen`.** That screen resolves its promise on an active-time wait,
  which is frozen while paused — borrowing it would deadlock the very panel it was
  opened from. Its prose is re-shown here instead.
- **Run stats are collected off a document event bus**, the same idiom
  `strings:lumina-effect` already uses. Kills funnel through `ThreatBody.hit()`
  (one site, and `vanish()` deliberately does not pass through it, so leash
  resets and victory cleanups are not counted as kills); bugtong results come from
  the three answer-resolution branches. Nothing in combat holds a tally reference.
- **Time beneath re-uses Game's `_gameTime`**, which already stops accumulating
  while paused, rather than starting a second clock that would have to learn the
  pause state.
- **Restart targets `_returnZone` inside an arena** (where `currentZone` is the
  arena id) and hands off to the existing `_loadZone` → Descend screen path, so the
  rail arena's yaw cone and every other arena lock unwind through the same
  disposal the normal return uses.
- **Two-step arming confirm, not `window.confirm`** — a native dialog over a
  pointer-locked WebGL canvas steals focus and can leave the overlay in a state
  the player did not choose.
- **`canRestartZone` is a method, not a getter.** These flow partials are mixed in
  with `Object.assign`, which invokes an accessor and copies its one-time value.

## Verification

- `node --check` on every touched module; import resolution.
- New `tests/PauseMenu.test.js`: model per phase, artifact totals from
  `ARTIFACT_DATA` (11/9/7 = 27), pip/meter rendering, node pooling, control-set
  selection. Existing `tests/GamePause.test.js` extended with a `pauseMenu` stub
  to prove the overlay still renders through the controller.
- Manual browser pass (user): pause in zone / arena / museum, verify counts match
  the HUD, Settings opens without resuming, Enter resumes, narrow viewport.
