# Implementation Plan — Firebase Anonymous Cloud Save (2026-07-30)

## Problem

Campaign progress is session-only by design: `Game` holds `collectedByZone`,
`collectedSouls` and `completed` in memory, and Quit-to-title is a page reload
(`SessionFlow`). A player who closes the tab mid-Zone-1 loses everything.

## Identity decision (settled)

The GameOn Portal returns **only** an opaque `sessionToken` and a `signinUrl`
(`APIManager._validateSessionResponse`). It never exposes an email or user id,
so it cannot key a save. Chaining a Firebase email sign-up onto the GameOn
button would not join the two identities either — it would cost two sign-ins and
buy nothing.

**Decision: Firebase Anonymous Auth.** `signInAnonymously()` on load yields a
stable `uid` with zero player friction, which lets Firestore rules enforce real
per-user ownership without a Cloud Function (the project stays a static,
buildless site). GameOn is left exactly as it is — still optional, still only
the end-of-campaign reward unlock.

**Accepted caveat:** an anonymous uid lives in browser storage, so a save is
per-device and is lost if the player clears site data. A later opt-in
"Save to my email" (`linkWithCredential`) can upgrade the same uid without
losing progress. Out of scope here; the store is designed so it needs no change.

## Design

Three new modules, mirroring the `APIManager` shape (injected `fetch`-alikes,
logger and storage) so everything is unit-testable under `node --test` with no
DOM, no Firebase and no network.

### 1. `src/core/_partials/saveState.js` — pure, tested

The only module that knows Game's field names on the save path, exactly as
`PauseState.js` is for the pause path.

- `collectSaveState(game)` → plain JSON: `{ version, collectedByZone (arrays),
  collectedSouls, completed, endingPlayed, run }`. Sets become sorted arrays so
  the payload is stable and diffable.
- `applySaveState(game, data)` → rehydrates the Sets, guarding every field.
- `isValidSave(data)` — version check plus shape validation; unknown artifact or
  zone ids are dropped rather than trusted, so a tampered document can never
  fabricate an unlock. This is the security boundary: **the GameOn reward gate
  (`canUnlockPlatformArtifact`) must keep reading live session state, never the
  restored save**, or a hand-edited document could claim the reward.

### 2. `src/core/SaveManager.js` — Firestore read/write

- `init()` — `signInAnonymously`, then `load()`.
- `load()` — reads `progress/{uid}`, returns a validated state or `null`.
- `save(state)` — debounced (~2s) coalescing write, last-write-wins.
- `queue(game)` — snapshot + debounce; called from the milestone hooks.
- Every call wrapped; a failure degrades to in-memory play and logs structured
  context (`{ operation }`), never blocking the game loop. Offline is a no-op.

### 3. Firestore rules (documented in the plan, applied in console)

```
match /progress/{uid} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
```

### Wiring

- Import map in `index.html` gains the Firebase ESM CDN entries next to `three`.
  Config (apiKey, projectId, …) goes in a new `FIREBASE` block in `config.js`.
  These keys are public by design — the rules above are what enforce access.
- `Game.js` constructs `SaveManager` beside `APIManager` (one line at ~:64) and
  awaits `load()` before the museum is entered; a restored save re-locks/unlocks
  museum portals through the existing `completed` set, so no portal logic
  changes.
- Save points (call `queue`, never a direct write): artifact collected, Soul
  collected, Guardian defeated, zone completed, ending played. All already exist
  as distinct moments in the flow partials.
- Survival is **not** saved — runs are session-only by design
  (`SurvivalIntegration.test.js` already asserts `SurvivalFlow` touches no
  persistence, and that assertion must keep passing).

## Test plan (`tests/SaveState.test.mjs`)

Deterministic, no Firebase: round-trip snapshot/restore, malformed and
version-mismatched documents rejected, unknown artifact/zone ids dropped, and a
tampered "all zones complete" document failing to unlock the GameOn reward.

## Risks

- First load now needs a second CDN origin; a Firebase outage must not block
  play (hence every path degrades to in-memory).
- `Game.js` is near the 1000-line limit — all logic lands in the new modules,
  the composition root only gains construction and `queue` calls.
