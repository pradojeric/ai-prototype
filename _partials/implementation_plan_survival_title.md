# Addendum — Survival mode title card

A black title card naming the mode, played on **every** entry through the Endless
Echoes arch, immediately before the briefing. Plain DOM (there is nothing 3D to
look at behind pure black), timed, skippable after a short lockout.

## Shape

- **Copy** — kicker + title, read from `SURVIVAL_BRIEFING.kicker` / `.title`
  ([SurvivalBriefing.js](../src/core/survival/SurvivalBriefing.js)). The mode's
  name is not retyped anywhere; `index.html` ships the elements empty.
- **Timing** — `SURVIVAL_TITLE` in [config.js](../src/config.js):
  `FADE_IN .9` + `HOLD 1.7` + `FADE_OUT .9` ≈ 3.5 s, `SKIP_AFTER .45`,
  `SKIP_FADE .25`.
- **Markup** — `#survival-title` in [index.html](../index.html);
  styles in [_partials/survival-title.css](survival-title.css) at `z-index: 45`
  (above the briefing's 40). Solid `#000`, deliberately *not* the shared
  `.survival-modal-shell` language — no panel, no chrome.
- **Driver** — [src/ui/_partials/survivalTitleCard.js](../src/ui/_partials/survivalTitleCard.js).
  `play({kicker, title, timing})` → Promise resolving `true` if it played out,
  `false` if skipped/cancelled. Two `setTimeout`s; the CSS transition duration is
  set from the same number via `--survival-title-fade`.
- **Not a SurvivalUI modal.** Nothing on it is focusable, so `_showModal`'s focus
  trap and the single `_activeModal` slot would only get in the briefing's way.

## Why the timing is injected, not imported

`config.js` imports `three`, so any UI partial that imports it becomes
un-loadable under `node --test` (this broke `tests/SurvivalUI.test.js` on the
first pass). `SurvivalFlow` already imports config and passes `SURVIVAL_TITLE`
in; the partial keeps a `FALLBACK_TIMING` mirror for the no-argument case.

## Ordering: the card plays *over* the briefing

`_openSurvivalBriefing` starts the card and then calls `showBriefing(false)`
right away, so the card's fade-out is a crossfade into the painted rules rather
than a flash of black.

Two hazards that follow from that overlap, both handled:

1. **The briefing button must not be focusable under the card** — otherwise
   Enter/Space (which also skip) would start Wave 1 behind a black plate.
   `showBriefing(focusAction = false)` defers it; `focusBriefingAction()` is
   called when the card's Promise resolves. `_beginSurvivalWaves` also refuses
   outright while `titleCard.active`.
2. **The card must swallow input for its whole life**, not just once skippable —
   `pointer-events: auto` and the listeners attach at `play()`, while `skip()`
   itself is gated on `SKIP_AFTER`. The `keydown` listener is in the capture
   phase (SurvivalUI's own is too) and `preventDefault`s regardless. The
   `can-skip` class only reveals the hint.

## Lifecycle

`SurvivalUI.hideAll()` cancels the card (no fade), so retry and
return-to-museum tear it down for free. `_openSurvivalBriefing` captures
`_survivalRunSerial` and drops a stale resolution.
