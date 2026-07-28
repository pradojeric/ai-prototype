# Implementation Plan — Merge `feat/auth` into `main`

## Approved scope

- Merge the local `feat/auth` branch into the local `main` branch.
- Use a normal merge commit so the feature branch history remains visible.
- Preserve current `main` gameplay, UI, documentation, and planning history.
- Integrate the branch's platform-session and artifact-unlock additions where they
  do not replace newer `main` behavior.
- Keep the result local; do not push any branch or commit.

## Pre-merge checks

1. Confirm `main` is checked out and the working tree is clean.
2. Confirm both branch tips and their merge base.
3. Inspect the feature commit and predicted conflict set.

## Merge and conflict resolution

1. Run `git merge --no-ff feat/auth`.
2. Resolve content conflicts with current `main` as the baseline:
   - `STRINGS_GDD.md`: keep the current implementation-aligned GDD structure and
     add only platform behavior that is still accurate and not duplicated.
   - `implementation_plan.md` and `task.md`: retain current indexes/history; record
     the auth work concisely rather than restoring obsolete full plans.
   - `src/core/Game.js` and `src/core/_partials/GameUI.js`: keep current lifecycle
     and UI composition while wiring in the auth manager/UI additions.
3. Review every automatically merged auth file for compatibility with current
   imports, DOM IDs, configuration, styling, and artifact-collection contracts.
4. Stage the resolved files and complete the normal merge commit without changing
   the feature branch.

## Verification

1. Run `node --check` on every changed JavaScript module.
2. Run the branch's focused mocked API lifecycle test.
3. Audit local ES-module imports, referenced DOM IDs, and the 1000-line file limit.
4. Run `git diff --check`.
5. Confirm the final commit has two parents, `main` is ahead only locally, the
   working tree is clean, and no push occurred.

## Manual follow-up

- Browser verification remains required for popup behavior, live platform/CORS
  responses, authorization polling, artifact unlock requests, responsive UI, and
  regression coverage of affected game flows.
