# Implementation Plan — Shared Arena Victory Rift Cutscene

Status: Implemented and statically verified; manual browser verification pending.

## Confirmed Direction

- Apply one shared boss-death and return animation to Arena 1, Arena 2, and
  `arena3boss`.
- Keep the presentation first-person and unskippable.
- Target a 5–6 second sequence; the initial implementation target is 5.6 seconds.
- Form the return rift at the defeated boss's world position and pull the camera
  toward it. This keeps Arena 2's stationary boat compatible with the sequence.
- Use the same animation structure in every arena, with only palette differences.
- Add no audio files or generated audio assets. Reuse only existing procedural
  Web Audio API cues already owned by `AudioManager`.
- Preserve dock return, artifact scatter, Guardian Soul creation, encounter
  balance, progression, boss-only retries, and Arena 3's preserved `_returnZone`.

## Design Brief

- **Player promise:** The recovered memory physically tears free of its defeated
  keeper and becomes the path home.
- **Target feeling:** Cathartic, supernatural, and clearly final without turning
  victory into a long non-interactive movie.
- **Trigger:** The existing confirmed boss victory state (`arena.won`).
- **Reward:** The existing return-zone progression, artifact scatter, and
  Guardian Soul remain the mechanical payoff.
- **Readability promise:** Combat stops immediately, the boss is the visual
  origin of both the explosion and rift, and the first-person camera follows the
  fragments into that same destination.
- **Non-goals:** No boss balance or retry changes, third-person character model,
  new input, skip control, new audio assets, new post-processing pass, new
  dependency, or arena geometry redesign.

## Core Loop Contract

The player fights and answers riddles to defeat the arena boss while encounter
pressure creates risk; victory triggers the shared memory-rift return and
releases the existing artifacts and Guardian Soul, while failure keeps the
current boss-only retry behavior.

This work changes only the success feedback and transition. It does not change
the input, objective, pressure, reward state, or failure cost.

## Authored 5.6-Second Sequence

1. **Final impact — 0.0–0.6s**
   - Freeze player movement and combat input through the existing victory/busy
     state.
   - Hide the crosshair, combat HUD, Journey prompt, and first-person hand.
   - Hold the gameplay camera pose while the existing death pulse lands.

2. **Memory explosion — 0.45–1.8s**
   - Dissolve the shared boss body through its existing defeat path.
   - Emit a fixed-size pooled burst of low-poly shards and memory motes from the
     captured boss center.
   - Expand rapidly, then slow; use deterministic/index-authored trajectories
     rather than `Math.random`.

3. **Rift formation and reversal — 1.1–2.8s**
   - Reveal a camera-facing vortex at the boss center.
   - Reuse the established `PortalVortex`/Memory Rift visual language.
   - Reverse the fragments into curved suction paths so the explosion visibly
     builds the exit instead of becoming unrelated decoration.

4. **First-person pull — 2.5–5.35s**
   - Turn from the captured first-person facing direction toward the rift.
   - Accelerate the cinematic camera from the player's eye position to just
     inside the vortex; camera collision is intentionally ignored.
   - Apply restrained deterministic shake/FOV acceleration and reuse the
     existing disabled portal distortion only near the threshold.

5. **Threshold and return — 5.35–5.6s**
   - Raise the existing white flash, dispose the temporary rift/VFX, reset the
     shared distortion and camera, then perform the current world swap.
   - Continue the existing dock spawn, artifact scatter, soul, journey, and
     progression logic unchanged.

## Zone Palettes

- `arena1`: drowned cyan with warm copper/clay highlights.
- `arena2`: teal with lantern-gold highlights.
- `arena3boss`: slate blue with Keeper gold highlights.

Palette is presentation data only. Geometry, counts, timings, camera motion, and
lifecycle remain shared.

## Architecture and File Changes

1. **`src/config.js`**
   - Replace the obsolete single `ARENA.COLLAPSE` wait with a named
     `ARENA.VICTORY` timing/camera/VFX block.
   - Keep all tunables explicit and grouped; do not alter combat constants.

2. **`src/cutscene/ArenaVictoryCutscene.js`** (new)
   - Own the 5.6-second timeline, dedicated perspective camera, first-person
     turn/pull path, FOV, deterministic shake, completion promise, resize, and
     distortion progress.
   - Construct/update/dispose the visual partial for one victory.
   - Expose only the small lifecycle needed by `Game`/`ArenaFlow`:
     `play`, `update`, `resize`, `dispose`, `active`, and `distortion`.

3. **`src/cutscene/_partials/ArenaVictoryRift.js`** (new)
   - Own the temporary vortex, rings, pooled shards/motes, palette selection,
     explosion-to-suction animation, resource tracking, and disposal.
   - Use fixed pools and allocation-free per-frame scratch objects.
   - Face the vortex toward the captured player position and support arbitrary
     boss height, including the elevated Keeper deck.

4. **`src/core/Game.js`**
   - Construct the shared victory cutscene.
   - During its active arena branch, keep the live world, defeated body fade, and
     preserved combat VFX updating against the cinematic camera.
   - Update the existing distortion uniforms, listener camera, and render, then
     return before gameplay input runs.
   - Keep additions small so `Game.js` remains below the 1000-line limit.

5. **`src/core/_partials/ArenaFlow.js`**
   - Replace `_returnFromArena`'s 1.4-second passive wait with the new cutscene.
   - Capture arena ID, boss center, camera position, and facing before teardown.
   - Restore camera/viewmodel/post-processing state in one cleanup path before
     performing the existing return-zone swap.
   - Preserve `_returnZone`, artifact/soul creation, progression, and disposal
     order exactly.

6. **`src/core/_partials/GameUI.js`**
   - Resize the victory cutscene camera with the other cinematic cameras.

7. **Boss controllers**
   - Prefer no controller changes: Arena 1/2 already dissolve their Guardian and
     the Keeper already marks its body defeated.
   - Only add a minimal shared hook if implementation proves a body does not
     enter its existing defeat fade on a real or presenter-triggered win.

8. **Tests**
   - Add focused mocked lifecycle/timeline tests under `tests/` if the existing
     browser-global dependencies can be isolated without introducing packages.
   - Do not create persistent data or use any database.

## Lifecycle and Edge Cases

- Guard `_returnFromArena` with its existing synchronous `busy = true` assignment
  so `arena.won` cannot launch multiple cutscenes.
- Presenter victory must use the same sequence.
- Pausing must not restart, skip, or duplicate the timeline.
- Arena 2 remains movement-locked and requires no player translation; only the
  cinematic camera moves.
- Arena 3 must pull from deck eye height to the Keeper's captured world-space
  center without reassigning `_returnZone`.
- Disposal must be safe on normal completion and any later forced scene exit.
- The post-processing pass must be disabled and zeroed before normal gameplay
  resumes, including error-safe cleanup.

## Verification

### Static and automated

- Run `node --check` on every changed JavaScript file.
- Run the existing Node test suite.
- Audit relative imports, file lengths, affected DOM IDs, and stale
  `ARENA.COLLAPSE` references.
- Confirm every file remains below 1000 lines and run `git diff --check`.
- Confirm no new asset, dependency, or network reference was added.

### Required manual browser gate

For Arena 1, Arena 2, and `arena3boss`:

- Kill the boss normally and confirm exactly one 5–6 second sequence plays.
- Confirm explosion, reversal, rift formation, first-person turn/pull, threshold
  distortion, and whiteout are readable from varied killing positions.
- Confirm HUD/hand/input remain hidden and inactive through the sequence.
- Confirm the correct zone, dock spawn, artifact scatter, and Guardian Soul.
- Confirm Arena 2's boat flow and Arena 3's elevated deck/Zone 3 return.
- Confirm pause/resume during the sequence does not skip or duplicate it.
- Confirm presenter victory follows the same transition.
- Check the console for runtime, shader, disposal, and audio errors.

Static checks cannot establish camera comfort, timing, portal visibility,
distortion strength, pointer-lock behavior, or the correctness of the live world
transition; those remain manual browser checks.

## Reference Ledger

- `references/gameplay-workflows.md`: loaded; used for lifecycle, update-order,
  camera, feedback, and verification boundaries.
- `references/game-design-level-design.md`: loaded; used to preserve the encounter
  and reward contract while changing only the recovery beat.
- `references/game-feel.md`: loaded; used for impact hierarchy, deterministic
  motion, restrained shake, FOV, and readability.
- Physics selection: not loaded because no physics or collision behavior changes.

## As-Built Record

- Added `ArenaVictoryCutscene` as the shared 5.6-second timeline/camera owner.
- Added `ArenaVictoryRift` with one camera-facing vortex, three rotating rings,
  40 instanced tetrahedron shards, and 64 pooled motes.
- All explosion/suction paths are deterministic and allocation-free per frame.
- Reused `playTeleport()` when the rift opens and `playPortalImpact()` at the
  threshold; both are existing Web Audio API cues and no asset was added.
- Reused the existing disabled portal-distortion pass rather than adding a new
  post-processing stage.
- Added the anticipated `KeeperArenaController.updateVictoryVisual()` hook
  because the Keeper body is not owned by `Game.guardian`.
- Preserved `_returnZone`, dock spawn, artifact scatter, Guardian Soul creation,
  progression, retries, encounter timing, health, and balance.
- Updated `Arena1.md`, `Arena2.md`, and `Arena3.md` victory documentation.
- Added `tests/ArenaVictoryContract.test.js`. It audits the shipped source
  contract instead of importing browser modules because this import-map project
  resolves Three.js from its CDN only in the browser.

### Verification result

- 22/22 Node tests passed.
- All changed and existing `src`/`tests` JavaScript passed `node --check`.
- All relative imports resolved across 111 source modules.
- Stale `ARENA.COLLAPSE` and runtime-randomness audits passed.
- `git diff --check` passed.
- Every file remains below 1000 lines (`Game.js`: 958; `task.md`: 993).
- Live camera comfort, shader rendering, portal visibility, timing, pointer
  lock/pause behavior, audio sync, and all three world returns remain the user's
  browser verification gate.
