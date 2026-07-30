# Implementation plan — Endless Echoes portal + immediate-unlock config

## Goal

1. A config flag that unlocks Survival immediately, for testing without playing
   to the ending.
2. A walk-in portal in the museum hub that leads to Survival once the ending
   cutscene has played. It **replaces** the ending-credits "Enter Endless
   Memory" button, so Survival has exactly one entry path.

## Constraints discovered

- **The lobby's `-Z` wall is full.** Three zone doorways at x = −4.8 / 0 / 4.8
  with `DOOR_HALF` 1.5 occupy [−6.3, −3.3], [−1.5, 1.5], [3.3, 6.3]. The ±X and
  +Z walls each belong to a gallery (`GalleryRing` builds both faces + doorway),
  and Zone 1's doorway sits dead center on +Z. There is no free 3 m span, so the
  portal is a **free-standing arch inside the lobby**, not a fourth doorway.
- `setEpilogueMode(on)` currently seals every portal "so the ending cannot
  loop". The Survival arch is the deliberate exception: it opens *because* the
  ending played, and leads out of the museum rather than back into a zone.
- `canEnterSurvivalFromCredits` hard-codes `phase === 'endingCredits'` and its
  comment says Survival is "never a title unlock". Both change here — by
  request — so the policy module and its test are rewritten, not extended.
- `Museum._freezeStatic()` bakes matrices in the constructor. The arch must be
  built before it, and must only ever toggle visibility/material afterwards.
- The intro cutscene drives a camera along x = 0 over a deliberately empty dark
  lobby, so the arch is hidden until hub mode (same treatment as `SoulPedestal`
  and `hubGroup`).

## Placement

Against the +Z wall on the −X side, facing into the lobby (−Z):

```
        +Z wall
  ┌────[ARCH]──────[Z1 door]──────────┐
  │     x=-5.0        x=0             │
 -X                                  +X
 [Z2 door]        (Soul Altar)   [Z3 door]
  │                                   │
  └──[Z2]──────[Z1 portal]──────[Z3]──┘
        -Z wall (full)
```

x = −5.0 clears Zone 1's +Z doorway (|x| ≤ 1.2), the −X wall, and the intro's
x = 0 camera path. Behind-left of the spawn point (0, 5.8), so it is found by
turning around rather than blocking the authored walk to the −Z portals.

## Steps

1. **config.js**
   - `DEBUG_SURVIVAL_UNLOCKED: true` in the DEBUG block — portal open in the
     ordinary hub from the first visit, no ending required.
   - `MUSEUM.SURVIVAL_PORTAL`: `X`, `INSET` (z derived from `ROOM_HALF` in the
     partial, since a literal can't reference its own `MUSEUM.ROOM_HALF`),
     `WIDTH`, `HEIGHT`, `ENTRY_OFFSET`, `POST_R`, `OPEN_COLOR`, `SEALED_COLOR`.
2. **`_partials/RoomShell.js`** — `signTexture` hardcodes "ZONE N", which the
   arch can't use. Extract a generic `plaqueTexture(title, subtitle, dim,
   tracker)` and make `signTexture` delegate to it (DRY, one canvas routine).
3. **New `src/museum/_partials/SurvivalPortal.js`** — the arch: two posts, a
   lintel, an emissive back panel, the shared vortex material, and a plaque.
   Owns `setVisible`, `setOpen`, `update(t)`, `collidesAt`, `entry`, `dispose`.
   A separate partial keeps Museum.js (655 lines) clear of the 1000-line cap.
4. **Museum.js** — build it before `_freezeStatic`; show it from
   `setHubLighting`; open it from `setEpilogueMode(true)` or the debug flag;
   spin its vortex in `update`; include it in `collidesAt`; dispose it.
   Exposed as `museum.survivalPortal` so Game can read `entry` / `open`.
5. **SurvivalEntryPolicy.js** — replace the credits policy with
   `isSurvivalPortalOpen({ epilogueMode, debugUnlocked })` and
   `canEnterSurvivalFromHub(phase, options)`.
6. **SurvivalFlow.js** — `_enterSurvivalFromCredits` → `_enterSurvivalFromHub`
   (tears down the museum instead of the credits overlay); drop the
   `onEnterSurvival` callback; `_showEndingCreditsActions` focuses the return
   button now that the enter button is gone.
7. **Game.js** — in the `museum` hub loop, check the arch's `entry` against
   `MUSEUM.EXIT_RADIUS` alongside the existing zone-portal sweep.
8. **index.html / SurvivalUI.js / survival-mode.css** — remove the
   `#ending-survival` button, its listener, `onEnterSurvival`, and
   `setCreditsEntryEnabled`.
9. **Tests** — rewrite the entry-policy test for the hub policy; update the
   SurvivalUI callback-name list; assert the arch clears the Zone 1 doorway and
   that the credits button is gone.
10. **Docs** — `SurvivalMode.md` entry section, `CLAUDE.md` museum paragraph,
    `task.md`.

## Risks

- Leaving the museum for Survival must not double-dispose the museum scene;
  `_enterSurvivalFromHub` reuses the existing teardown ordering from
  `_enterEpilogueMuseum` in reverse and keeps the museum alive (Survival's
  defeat screen returns to it).
- With the credits button gone, a player who finishes the ending must walk to
  the arch. `_enterEpilogueMuseum` already spawns them at the lobby spawn point,
  which faces away from the arch — the plaque glow is the affordance.
