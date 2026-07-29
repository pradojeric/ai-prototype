# Keeper of Memories — charge speed + centred lighthouse sweep

Scope: attack-pattern changes on the Arena 3 boss
([src/core/arena/TowerKeeper.js](../src/core/arena/TowerKeeper.js)), plus two
fixes to the shared guardian-introduction handover (§5) that apply to all three
zones. No tuning for the other bosses is touched.

## 1. Faster charge

The dash itself was slow enough that the gold lane telegraph gave the player far
more room than intended — the lane locks, then the Keeper takes almost a second
to arrive.

- `TOWER_KEEPER_TUNING.CHARGE_SPEED`: `13.5 → 19`.
- Deliberately *not* changed: `CHARGE_TELEGRAPH` (0.9s), `CHARGE_INTERVAL`,
  `CHARGE_HIT_RECOVERY`, `CHARGE_MISS_STUN`. The telegraph stays the readable
  dodge window; only the commit is faster. Whiff punish is unchanged, so the
  attack got scarier without getting cheaper to beat.
- No tunnelling risk: at 19 u/s the per-frame step is ~0.32u at 60fps and ~0.63u
  at 30fps, both well under `CHARGE_HIT_RADIUS` (1.35), and `_updateCharge`
  already clamps the final step to the remaining distance.

## 2. Lighthouse sweep pivots on the arena centre

Previously `_startBeam()` planted the beam pivot wherever the Keeper happened to
be standing — usually the end point of its last charge, near the arena edge. A
sweep pivoting off-centre covers the arena unevenly and doesn't read as a
lighthouse.

New state `beam-approach` runs *before* the existing `beam-telegraph`:

- `_updateIdle` now calls `_startBeamApproach()` instead of `_startBeam()`.
- `_startBeamApproach()` aims `_dir` at `(0, 0)`, sets `_state = 'beam-approach'`,
  and sets `_stateTimer` to `distance / BEAM_APPROACH_SPEED + 0.35` as a bail-out
  (not as pacing) so an interrupted walk still commits to the sweep instead of
  stalling the fight. If the Keeper is already within `BEAM_CENTER_EPSILON`
  (0.08) it skips straight to `_startBeam()`.
- `_updateBeamApproach(dt)` walks at `BEAM_APPROACH_SPEED` (9 u/s), then snaps
  x/z to exactly 0 and calls `_startBeam()`, which places the pivot on the now
  centred body. Worst case walk is `combatRadius` 6.8 / 9 ≈ 0.76s, so the sweep
  comes out ~0.5–0.8s later than before — the cost the design accepts for a
  readable, centred beam.
- The Keeper **stays** at centre afterwards; `_updateBeam` already leaves the
  body where it is, and normal shots/charges resume from the middle.
- `blocksPlayerAt()` now also returns `false` during `beam-approach` (as it
  already did during `charge`), so a player standing on the centre can't be
  pinned inside the walking body.
- `_onPhaseChanged` / `_onDefeated` need no change: both overwrite `_state` and
  call `_clearBeam()`, and nothing is visible yet during the approach.

## 3. The sweep is jumpable

- New `TOWER_KEEPER_TUNING.BEAM_CLEARANCE: 0.55`, deliberately the same value as
  the Feastkeeper's `SLAM.CLEARANCE`
  ([FeastkeeperBoss.js](../src/core/arena/FeastkeeperBoss.js)), so the jump-dodge
  the player learned in Zone 1 transfers. Against the ~0.80m hop
  (`JUMP_SPEED` 4.2 / `JUMP_GRAVITY` 11) that is a ~0.43s window — a timing read,
  not a binary "was airborne at any point".
- `_playerInBeam()` returns `false` while `player.jumpOffset >= BEAM_CLEARANCE`.
- Sweep speed and width are unchanged, so footwork remains a valid answer; the
  jump is for when the player is cornered or caught mid-animation.
- Jump is already armed for this fight by
  [TowerCombatManager.js:59](../src/core/arena/TowerCombatManager.js#L59).

## 4. Laser rework — light wall instead of floor decal

The old sweep was a flat additive `MeshBasicMaterial` box lying on the deck,
which gave the player no reason to believe the attack could be jumped. Each arm
is now a scorch line **plus** a vertical blade of light whose height *is* the hit
volume.

- New partial
  [`_partials/LighthouseBeamMaterial.js`](../src/core/arena/_partials/LighthouseBeamMaterial.js)
  exports `createLighthouseBladeMaterial(height, length)` — a `ShaderMaterial`
  working purely in the blade's local space (`y` 0..height off the deck, `z`
  0..length outward from the pivot) so the pivot can rotate it freely.
  Bottom-to-top read: hot scrolling core at deck level, `pow(1-h, 1.7)` falloff
  through the body, then a tight bright rim at the clearance line. Energy is
  `sin` flow plus a slower counter-pulse so it never reads as one repeating
  stripe.
- Each `_beamMeshes[i]` is now a `THREE.Group` (scorch mesh + blade mesh) rather
  than a single mesh; visibility toggling and `_clearBeam()` are unchanged.
- `_setBeamIntensity(value)` drives the scorch `opacity` and the blade's
  `uOpacity` uniform together, replacing the three old `_beamMaterial.opacity`
  writes, so the existing telegraph ramp still works untouched.
- `uTime` advances off `this._beamTime`, reset per sweep in `_startBeam()`, so
  the scroll starts from rest instead of an arbitrary phase of global time.
- Blade/scorch reach is now `bounds.radius` (the 9m deck from
  [arena3boss.js](../src/core/zones/arena3boss.js)) instead of
  `combatRadius * 2` (13.6m), which had the beam hanging 4.6m out over the void.
  `_playerInBeam`'s distance cut-off uses the same `_beamReach`, so the hit
  volume never outlives the drawn blade.

## 5. Guardian-intro handover (all three zones)

Both bugs live in the shared `_runGuardianIntroduction`
([ArenaFlow.js](../src/core/_partials/ArenaFlow.js)), so they were never
Keeper-specific — every boss reveal had them.

- **Floating hand.** The ViewModel is a child of the player camera, and that
  camera object stays in the world scene while the cinematic renders from
  `guardianIntro.camera`, so the hand drew as a disembodied limb at the player's
  staged position. Now hidden alongside the camera swap and restored with it,
  matching what the faint cutscene already does at
  [Game.js:258](../src/core/Game.js#L258).
- **Facing the boss.** `_levelCamera()` only zeroes pitch and roll, so control
  returned on whatever heading the player walked in with. New `_faceCamera(target)`
  in [Game.js](../src/core/Game.js) yaws onto a world position and flattens
  pitch/roll — `Math.atan2(-dx, -dz)`, since the camera looks down its local -Z.
  It replaces the `_levelCamera()` call and now runs *after*
  `completeGuardianIntroduction()` / `begin()`, reading the live
  `arena.guardianCenter()` (present on all three controllers) so a controller that
  moves its body on begin is still framed correctly; `target` is the fallback.
- Instant snap, not an eased turn: `renderPass.camera` swaps back to the player
  camera on that same frame, so the view is already cutting and the snap is
  invisible — and no input lock is needed to stop the mouse fighting an
  interpolation.
- Safe under pointer lock: `PointerLockControls` re-reads the camera quaternion
  on each mouse move, so the player's next input continues from the new heading.
  Zone 2's rail aim cone also self-corrects, since `_applyYawLimit` folds any
  out-of-cone yaw back the following frame.
- The presenter skip path is unaffected: `guardianIntro.skip()` still lets
  `play()` resolve normally, so both the restore and the facing run.

## 6. Attack callouts, matching the other two bosses

The Keeper announced its attacks through `onEvent` log lines while the
Feastkeeper and Reveler use `combat.hud.popupCallout` above the boss. Brought
into line with them.

- Callouts at pattern start: `BEACON CHARGE` (`_startCharge`), `MEMORY STONES`
  (`_startDebris`), `LIGHTHOUSE SWEEP` (`_startBeamApproach`). Names reuse the
  wording the old log lines already used.
- The basic shot stays silent, as `spit` and `formation` do on the other two
  bosses — text every ~1.4–2.2s would drown out the callouts that matter.
- The sweep is called out on the **walk**, not the blade, so the player reads it
  across the whole approach + telegraph. Fired *before* the already-centred
  shortcut in `_startBeamApproach` so that path is never silent, and
  `_startBeam`'s own log line is gone so the attack announces once.
- The three replaced log lines are deleted. The two remaining `onEvent` calls
  report outcomes rather than announce attacks, so they stay: the charge-miss
  stun and the phase-change line.
- `_calloutAnchor()` is inherited from `ArenaBoss` and already works here — the
  Keeper passes its body as `guardian` to `super()`, and the anchor uses its own
  scratch vector, so there is no aliasing with `_center` / `_dir`. `ENRAGED` and
  the armor callouts were already firing from the base class.

## Verification

Static only — no automated harness in this repo. `node --check` passes on both
files, no file outside `TowerKeeper.js` references `_startBeam` or the beam state
strings, and no stale `_beamMaterial` / `_beamGeometry` references remain.
Needs in-browser confirmation, especially: the shader compiles, the blade's rim
reads as a jumpable height, and 19 u/s still leaves the charge dodgeable.
