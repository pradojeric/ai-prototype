# Implementation plan — Survival pre-run briefing

## Problem

Walking through the Endless Echoes arch dropped the player straight into Wave 1.
Nothing in the game explains the mode: its endless-wave loop, the draft cadence,
the Survival-only dash, or what the defeat ledger is scoring.

## Decisions (confirmed with the user)

| Question | Choice |
| --- | --- |
| Format | Full-screen overlay, pointer unlocked (same modal language as the upgrade draft) |
| Dismissal | Explicit "Begin" confirm only — no countdown, no any-key |
| Content | Core loop + Survival-only controls + scoring + narrative framing |
| Repeat | Shown on every entry (and every retry); also re-readable mid-run from the pause menu |

## Design

**One content source.** `src/core/survival/SurvivalBriefing.js` is pure content —
no DOM, no Three.js — exporting `SURVIVAL_BRIEFING` (kicker, title, narrative,
three sections, action label) and `survivalBriefingLore()`. Every rule it quotes
is derived from `SurvivalRules` (`SURVIVAL_THREAT_CAP`, `SURVIVAL_FIRST_DRAFT_WAVE`,
`SURVIVAL_DRAFT_INTERVAL`, and the boss period recovered by probing
`isSurvivalBossWave`) so a balance change cannot leave the briefing lying.

The one thing deliberately *not* quoted is the reroll cap: `SurvivalController.start`
sets `rerolls = 99`, so `SURVIVAL_REROLL_CAP` is not what the player experiences.
Flagged in a code comment rather than silently changed.

**Two surfaces, one text.**

1. Overlay — `#survival-briefing` in [index.html](../index.html), painted by
   `ui/_partials/survivalBriefingView.js` (one-shot build, cached), driven by
   `SurvivalUI.showBriefing()/hideBriefing()` with a new `onBeginRun` callback.
   Styles live in `_partials/survival-briefing.css`; `survival-mode.css` was at 926
   lines, so the briefing's layout is a separate file rather than pushing it toward
   the 1000-line limit — only the shared selector lists (hidden, backdrop, `.active`,
   reduced-motion) gained `#survival-briefing`.
2. Pause Lore tab — `pauseModel.lore()` prepends `survivalBriefingLore()` whenever
   the control context is `survival`. The entries are shaped to the existing
   zone-lore card contract, so no new card layout; `PauseCollection.renderLore` now
   omits the count suffix when `countLabel` is empty (a briefing restores nothing).

**Flow.** `_startSurvivalRun` still builds the controller (arena, HUD snapshot,
player mobility are all real) but no longer calls `survival.start()`. It ends in
`_openSurvivalBriefing()` → new phase `survivalBriefing` (busy, pointer released,
HUD hidden). `_beginSurvivalWaves()` is the only exit: hide overlay, phase
`survival`, `player.resetInput()` (the confirm button can be activated with Space,
which is also the hop), `survival.start()`, show HUD, re-lock.

`survivalBriefing` joins the `SURVIVAL_PHASES` list that `_updateSurvival`,
`_returnFromSurvival` and `_enterEpilogueMuseum` share — the player is standing in
the arena, so leaving from the briefing must tear down as much as leaving mid-wave.
It is intentionally **not** pausable (it is already a modal), matching
`survivalUpgrade`/`survivalDefeat`. The controller sits in state `idle` until
`start()`, so no wave, no clock, and no active time accrue behind the overlay.

## Tests

`tests/SurvivalBriefing.test.js` — every promised topic present; numbers derived
from rules (including the boss cadence); pause-lore inclusion and its absence
outside Survival; `survivalBriefing` resolves the survival control set; the view
partial paints only briefing content against a stub document; and a source
assertion that `_startSurvivalRun` does not call `survival.start()`.
`tests/SurvivalUI.test.js` gained the markup/method contract for the overlay.

Pre-existing, unrelated: `tests/SurvivalRules.test.js` fails on the commented-out
`sniper` role (fails identically without these changes).

---

# Addendum — Survival death cinematic

## Problem

A Survival run ended with the defeat ledger appearing instantly. The campaign
already collapses the player on an arena defeat (`FaintCutscene`), so Survival
read as cheaper than the mode it grew out of.

## Design

Reuse `FaintCutscene` **verbatim** — same droop, same `FAINT.SINK`/`FAINT.DROOP`,
same shared instance Game already owns. The only new tunable is
`SURVIVAL_FAINT.BLACK_HOLD` (config.js): the dark beat between the collapse and
the ledger. Survival's version never wakes — there is no respawn — so it stops
after the hold instead of running the campaign's fade-back-in.

- `_showSurvivalDefeat` is now `async`: it records the session best, hides the
  HUD, `await`s `_survivalFaint()`, and only then sets phase `survivalDefeat`,
  releases the pointer and opens the ledger. `#faint` (z-index 22) is cleared once
  the modal (z-index 40) is up, so the black fades out *behind* the result and the
  sunken arena settles into view.
- New phase `survivalFaint`, in `SURVIVAL_PHASES` and driven by `_updateSurvival`
  (`faintCutscene.update(dt)`; the run is already aborted by `_handleDefeat`, so
  nothing can act on the player mid-collapse). It is pausable and pointer-locked
  like the campaign's `faint`, so a blur freezes the droop instead of letting it
  play out behind a hidden tab.
- `_restoreCameraAfterSurvivalFaint()` hands the view back (player camera,
  viewmodel, `#faint` cleared). Called by `_retrySurvival` and
  `_teardownSurvivalWorld` — the only routes off the defeat screen.
- `pauseModel` now maps any `survival*` phase to the survival control set and the
  "Endless Memory" location, so the faint and briefing phases read correctly.

## Tests

`tests/SurvivalDefeatCutscene.test.js` — ordering (collapse before ledger, HUD
hidden first), the cinematic's five required steps, camera restoration on both
exits, the phase being tracked/pausable, and that `SURVIVAL_FAINT` does not
re-tune the shared droop.

## Fix — black screen with no ledger (reported in testing)

The first version `await`ed `faintCutscene.play()` and `pause.wait()`, and made
`survivalFaint` a pausable **pointer** phase. Those combine badly: any pointer-lock
drop during the collapse is read as a focus loss → `pause('pointer-lock')` →
`animate()` early-returns → the cutscene stops being updated → the promise never
resolves → the black holds forever with no Retry/Return.

Rewritten so the death beat cannot hang:

- No awaits on the death path. `_showSurvivalDefeat` arms `_pendingSurvivalDefeat`
  and calls `_startSurvivalFaint()`; the frame loop counts
  `_survivalFaintRemaining` (`FAINT.DROOP + SURVIVAL_FAINT.BLACK_HOLD`) down and
  calls `_presentSurvivalDefeat()`, which is idempotent.
- A wall-clock `setTimeout` net (`_survivalDefeatFallback`, +1.5s) presents the
  ledger even if the render loop never gets there. Whichever fires first wins.
- Pointer lock is released once, up front, by `_startSurvivalFaint` (the run is
  over and the ledger needs the cursor anyway), and `survivalFaint` was removed
  from `PAUSABLE_PHASES`/`POINTER_PHASES` — it is a modal beat like
  `survivalUpgrade`/`survivalDefeat`. This is the actual fix; the fallback is
  insurance.
- `_restoreCameraAfterSurvivalFaint` also clears the pending ledger, the fallback
  timer, and `faintCutscene.active`.
