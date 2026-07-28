# Implementation Plan — Main Menu Zone-Flash Fix

Date: 2026-07-28
Status: Implemented; user browser verification pending

## Issue

Clicking Start briefly reveals the live Zone 1 canvas before the screen reaches
black.

## Root Cause

`#title.is-leaving` fades the opaque menu toward transparent at the same time
that `#pre-awaken.active` fades the black overlay from transparent to opaque.
During the middle of those opposing transitions, neither layer fully covers the
renderer canvas beneath them.

## Fix

- Keep `#title` fully opaque and disable its pointer events after Start.
- Fade only `#pre-awaken` over the still-opaque title.
- Preserve the existing Game-owned `preAwaken` phase, audio initialization,
  repeat-click guard, and future `_runIntro()` title cleanup.

## Verification

- Re-read the affected CSS immediately after editing.
- Confirm only the black overlay owns transition opacity.
- Run JavaScript syntax checks, CSS brace balance, file-limit checks, regression
  tests, and `git diff --check`.
- Leave the exact visual transition as the user's browser verification gate.

## Reference Ledger

| Reference | Used | Path | Failure reason |
| --- | --- | --- | --- |
| Debug/profile checklist | Yes | `threejs-debug-profiler/references/debug-profile-checklists.md` | None |
| Scene debugging checklist | Yes | `threejs-debug-profiler/references/checklists/scene-debugging.md` | Browser capture unavailable |
