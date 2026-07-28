# Implementation Plan — Awaken Stage and Eyes-Opening Transition

Date: 2026-07-28
Status: Implemented; manual browser review pending

## Goal

Complete the approved front-menu sequence:

`Main menu → Start/music → black Awaken stage → eyes open → IntroCutscene`

The existing Start transition already stops safely on black. This phase adds the
story-specific interaction and makes the museum intro appear through an
eye-shaped opening rather than a flat fade alone.

## Confirmed Decisions

- `Start` remains the ordinary main-menu action.
- Music begins on Start through the existing browser-safe user gesture.
- `Awaken` is a separate button on the following black screen.
- The Awaken button appears before `IntroCutscene` begins.
- Clicking Awaken opens an upper and lower eyelid.
- Desktop is the only required layout target.
- The authored menu artwork and completed main-menu layout remain unchanged.
- Eyelids are fully opaque pure black.
- Remove the teal lid-edge and center-seam glow.
- Keep the current teal Awaken prompt and button treatment.
- Hil blinks twice before the eyelids complete their final opening.

## Intended Experience

1. Start fades the layered menu to complete black.
2. Once black is established, a restrained `Open your eyes` cue and the
   `Awaken` button fade into the center.
3. Awaken immediately disables itself and hands rendering to the museum camera.
4. The prompt disappears and two pure-black curved eyelids perform two sleepy
   open-close blinks before pulling fully away from the center.
5. The existing intro wake fade runs beneath the opaque eyelids, producing a gradual
   dark-to-museum reveal without exposing Zone 1.
6. The remainder of `IntroCutscene` continues unchanged into the Descend screen.

## Implementation Steps

1. **Build the Awaken stage markup**
   - Expand `#pre-awaken` with decorative upper/lower eyelids, a center seam,
     the short cue, and a real `button` with `id="btn-awaken"`.
   - Keep decorative pieces hidden from assistive technology.
   - Preserve the overlay's existing boot-hidden and black-stage semantics.

2. **Style the eyes and interaction**
   - Extend `_partials/main-menu.css` with a stable centered prompt, hover,
     focus, pressed, and disabled button states.
   - Shape the two pure-black opaque lids with curved center edges so the reveal reads as
     eyes opening rather than two rectangular curtains.
   - Remove the teal lid-edge and center-seam treatments.
   - Use two open-close beats followed by one complete opening, all within the
     existing `CUTSCENE.WAKE` duration.
   - Delay the prompt until the Start-to-black fade is complete.
   - Animate the lids outward over the existing `CUTSCENE.WAKE` duration.
   - Make the opening overlay non-interactive as soon as Awaken is accepted.
   - Provide a reduced-motion path that reaches the same final state quickly.

3. **Wire the phase handoff**
   - Bind the new Awaken button in `GameUI`.
   - Stop its click from reaching the global cutscene-skip listener.
   - Accept the action only while `game.phase === 'preAwaken'`.
   - Disable repeat activation and move keyboard focus to Awaken after the black
     stage finishes fading in.

4. **Coordinate with `IntroCutscene`**
   - Before the eyelids move, hide the title, switch the RenderPass to the
     museum scene/camera, and synchronously arm the existing wake overlay.
   - Only then add the eyelid-opening state, ensuring no Zone 1 frame can appear
     through the first slit.
   - Preserve the existing cutscene camera keyframes, hall-light beat, click to
     skip, white fade, render restoration, and Descend handoff.

5. **Verify**
   - Re-read every touched file immediately after editing.
   - Run `node --check` on touched JavaScript.
   - Audit DOM ids, event propagation, phase guards, stale placeholders, CSS
     brace balance, file limits, and `git diff --check`.
   - Run the existing Node regression suite.
   - Manually verify in browser: Start begins music, Awaken appears only after
     black, one click opens the eyes without skipping, Zone 1 never flashes,
     the museum intro continues, and a cutscene click still skips normally
     after the Awaken click has completed.

## Expected Files

- `index.html` — eyelid and Awaken-stage markup
- `_partials/main-menu.css` — prompt, eyelid, opening, and reduced-motion states
- `src/core/_partials/GameUI.js` — Awaken binding and propagation guard
- `src/core/Game.js` — guarded museum/cutscene handoff and opening state
- `task.md`, `implementation_plan.md` — audit trail

## Scope Boundary

This phase does not change intro camera movement, museum geometry or lighting,
audio composition, main-menu artwork, gameplay, or the Descend screen.

## Reference Ledger

| Reference | Used | Path | Failure reason |
| --- | --- | --- | --- |
| Game UI patterns | Yes | `threejs-game-ui-designer/references/ui-patterns.md` | None |
| Game UI quality checklist | Yes | `threejs-game-ui-designer/references/checklists/game-ui-quality.md` | Browser capture unavailable |
| HUD readability checklist | Yes, relevant transition items | `threejs-game-ui-designer/references/checklists/hud-readability.md` | Gameplay HUD unchanged |
| Responsive fit checklist | Yes, desktop scope | `threejs-game-ui-designer/references/checklists/responsive-ui-fit.md` | Mobile excluded by approved scope |
| Current Start/pre-Awaken flow | Yes | `src/core/Game.js`, `src/core/_partials/GameUI.js` | None |
| Current wake timeline | Yes | `src/cutscene/IntroCutscene.js`, `src/config.js` | None |
