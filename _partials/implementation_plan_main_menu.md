# Implementation Plan — Main Menu Visual Redesign

Date: 2026-07-28
Status: Implemented; manual browser review pending

## Goal

Replace the prototype-like centered title screen with a desktop, poster-inspired
main menu built from the authored artwork in `assets/UI/`. The menu will clearly
separate the ordinary `Start` action from the story-specific `Awaken` action
planned for the following phase.

## Confirmed Decisions

- Build a layered composition rather than using `POSTER AI.png` as one flat
  background.
- Use the authored logo in place of the plain text `STRINGS` heading.
- Change the primary menu action from `Awaken` to `Start`.
- Keep Settings and Connect GameOn Account available.
- Hide Skip to Museum unless its own debug config flag is enabled.
- Use the tagline `Follow the Path. Restore the Forgotten`.
- Starting initializes browser audio/music and transitions to a temporary black
  pre-Awaken state; it does not start `IntroCutscene` in this phase.
- Defer the interactive Awaken prompt and upper/lower eyelid animation to the
  next phase.
- Design and verify for desktop only.

## Reference Ledger

| Reference | Used | Path | Failure reason |
| --- | --- | --- | --- |
| Game UI patterns | Yes | `threejs-game-ui-designer/references/ui-patterns.md` | None |
| Game UI quality checklist | Yes | `threejs-game-ui-designer/references/checklists/game-ui-quality.md` | None |
| HUD readability checklist | Yes | `threejs-game-ui-designer/references/checklists/hud-readability.md` | None |
| Responsive fit checklist | Yes, desktop scope | `threejs-game-ui-designer/references/checklists/responsive-ui-fit.md` | Mobile excluded by approved scope |
| Authored UI artwork | Yes | `assets/UI/` | None |
| Current title markup and styling | Yes | `index.html`, `styles.css` | None |
| Current menu-to-intro flow | Yes | `src/core/_partials/GameUI.js`, `src/core/Game.js`, `src/cutscene/IntroCutscene.js` | None |

## Intended Composition

- Use an optimized `BG AI.png` derivative as the full-viewport teal base.
- Arrange optimized `BUILDING.png` and `BOSS.png` derivatives as separate
  atmospheric depth layers, with the Guardians weighted toward the lower/right
  side so they do not compete with the controls.
- Place the optimized logo and tagline in the primary left-side reading column.
- Place `Start`, Settings, and GameOn account access in one stable menu cluster.
- Keep movement restrained: a slow ambient drift/glow may distinguish layers,
  while hover, focus, and pressed feedback remain immediate and readable.
- Add a dark contrast treatment behind the interactive column without turning
  the screen into a generic web card.

## Implementation Steps

1. **Prepare menu-specific image derivatives**
   - Preserve every source image in `assets/UI/`.
   - Crop excess export canvas and resize only copies used by the menu.
   - Retain transparent or blend-ready edges needed for the layered composition.
   - Use browser-appropriate dimensions and compression so the menu does not
     download the current multi-megabyte source exports at full resolution.

2. **Extract the main-menu styles**
   - Add `_partials/main-menu.css` and link it from `index.html`.
   - Move the existing title-menu-specific rules out of `styles.css` before
     adding the redesign. This keeps `styles.css`, currently 981 lines, below the
     repository's hard 1000-line limit.
   - Define the layered desktop layout, typography, contrast, image treatment,
     button states, reduced-motion fallback, and black handoff transition.
   - Leave shared `.menu-btn` rules available to Settings and ending screens.

3. **Rebuild the title markup**
   - Replace the text heading with the optimized logo image and meaningful alt
     text.
   - Add explicit decorative layer elements marked `aria-hidden="true"`.
   - Rename the primary button and DOM id from the old Awaken meaning to the new
     Start meaning, reserving `btn-awaken` for the next phase.
   - Add an inert black pre-Awaken overlay that is hidden at boot.
   - Preserve existing Settings, platform status, and debug shortcut elements.

4. **Wire the player and debug actions**
   - Add `CONFIG.DEBUG_SKIP_MUSEUM_BUTTON`, defaulting to `false`.
   - Gate both the Skip to Museum button's visibility and its action with that
     flag, matching the existing ending/debug-gallery shortcut pattern.
   - Route Start through a small Game-owned transition:
     initialize `AudioManager`, enter a distinct pre-Awaken phase, disable repeat
     activation, fade the menu away, and reveal the black overlay.
   - Do not call `IntroCutscene.play()` from Start in this phase.

5. **Verify**
   - Re-read every touched file immediately after editing.
   - Run `node --check` on touched JavaScript modules.
   - Audit relative imports, referenced asset paths, DOM ids, config guards, and
     obsolete `btn-awaken`/visible museum-shortcut references.
   - Run `git diff --check` and confirm every file remains under 1000 lines.
   - Inspect desktop layouts at 1440×900 and 1920×1080 when browser capture is
     available.
   - Manually confirm: Start begins music once, the menu fades to black without
     starting the intro, Settings still opens/closes, GameOn status remains
     readable, keyboard focus states work, and debug shortcuts obey their flags.

## Scope Boundary

This phase stops on the temporary black pre-Awaken screen. It will not add the
Awaken button, eyelid geometry/animation, or start the existing intro cutscene.
Those belong to the immediately following flow phase.

## Expected Files

- `assets/UI/menu/*` — optimized derivatives only; source artwork preserved
- `_partials/main-menu.css` — title-menu composition and transition styles
- `index.html` — stylesheet link and semantic menu/layer markup
- `src/config.js` — Skip to Museum debug flag
- `src/core/_partials/GameUI.js` — renamed bindings, action guards
- `src/core/Game.js` — pre-Awaken transition owner
- `task.md`, `implementation_plan.md` — audit trail

## Manual Acceptance Criteria

- The first screen reads as a cohesive Strings game menu, not a centered
  prototype overlay or web dashboard.
- The logo, tagline, and Start action form the clear first-read hierarchy.
- The Guardian/building artwork supports the layout without obscuring controls.
- Settings and GameOn controls remain usable and legible.
- Skip to Museum is absent with default configuration and appears only when its
  debug flag is enabled.
- Start initializes the music and ends on black; the intro does not begin.
- No mobile-specific layout work is claimed or required.
