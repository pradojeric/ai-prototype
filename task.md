# Task — Firebase Anonymous Cloud Save (2026-07-30)

Plan: [_partials/implementation_plan_firebase_progress.md](_partials/implementation_plan_firebase_progress.md)

## Objective

Persist campaign progress (artifacts, Souls, completed zones, ending) across
sessions using Firebase Anonymous Auth for identity and Firestore for storage,
keyed by `uid` — because the GameOn Portal returns only an opaque session token
and can never supply an email or user id. GameOn stays exactly as it is: the
optional end-of-campaign reward unlock.

## Implementation checklist

- [ ] Record and index the approved implementation plan before runtime edits
- [ ] Create the Firebase project, enable Anonymous Auth, and apply the
      `progress/{uid}` ownership rules (user-side console work)
- [ ] Add the `FIREBASE` config block and the Firebase ESM entries to the
      `index.html` import map
- [ ] Add `src/core/_partials/saveState.js` — pure snapshot/restore/validate
- [ ] Add `src/core/SaveManager.js` — anonymous sign-in, load, debounced save,
      with every failure degrading to in-memory play
- [ ] Wire construction + load into `Game.js` and `queue` calls into the existing
      collect/Soul/Guardian/zone-complete/ending milestones
- [ ] Keep the GameOn reward gate reading live session state, never the restored
      save, so a tampered document cannot claim the artifact
- [ ] Add `tests/SaveState.test.mjs`; keep the Survival no-persistence assertion
      in `SurvivalIntegration.test.js` passing
- [ ] Run full Node tests and the source syntax/import/file-length audits
- [ ] Manually verify: fresh player, reload mid-Zone-1, restored museum portal
      locks, and offline/blocked-Firebase still playable

# Task — Endless Memory Survival Mode (2026-07-30)

Plan: `_partials/implementation_plan_survival_mode.md`

## Objective

Add a credits-only, desktop Survival mode with endless escalating waves,
fifth-wave upgrade drafts, tenth-wave Guardian bosses, run-locked weapon paths,
elite variants, a collision-safe dash, session-best results, and clean
retry/museum-return lifecycle while preserving every campaign contract.

## Implementation checklist

- [x] Record and index the approved implementation plan before runtime edits
- [x] Add deterministic Survival rules: seeded waves, scaling, role unlocks,
      elite selection, boss ordering, draft/reroll logic, weapon pity/locking,
      upgrade ranks, and run-result ordering
- [x] Build and register the 32m-radius authored Memory arena
- [x] Add optional Survival-only profiles to all six lesser threat roles without
      changing campaign defaults
- [x] Add immutable Guardian tuning overrides and external attack resolution
      while preserving campaign boss behavior
- [x] Implement `SurvivalCombatManager`, weapons, damage/health, dash integration,
      elites, volatile hazards, Lumina, Shockwave, and Alab
- [x] Implement `SurvivalController` wave/boss/intermission/run lifecycle
- [x] Add `SurvivalFlow` entry, teardown, retry, museum return, and update dispatch
      without pushing `Game.js` over 1000 lines
- [x] Add credits entry, Survival HUD, upgrade draft, defeat/results, and
      keyboard/pointer interaction
- [x] Extend pause state/model and controls for active Survival only
- [x] Add procedural Survival Web Audio cues and lifecycle cleanup
- [x] Add deterministic coverage for all approved rules and access contracts
- [x] Add `SurvivalMode.md`; update `STRINGS_GDD.md` and `GAME_LOOP.md`
- [x] Run full Node tests, source syntax/import/DOM/file-length/stale-reference
      audits, and `git diff --check`
- [ ] Manually verify legitimate/debug ending entry, Waves 1–10 pacing, and the
      1.5-second stationary-camera boss stinger with correct pause ownership
- [ ] Manually verify all weapons, heat/piercing, Space hop, Alab, Shockwave,
      dash, upgrades, and rerolls
- [ ] Manually verify all six roles, three elite tells, and each forced Guardian
- [ ] Manually verify boss cleanup/heal/draft order, pause/resume twice,
      pointer-lock recovery, defeat/retry, and museum return
- [ ] Manually verify every new cue and sustained-beam cleanup, active-time
      exclusions, console state, HUD fit, reduced motion, and ten-threat stress
      performance (manual runtime gates)

## Static verification

- Full Node suite: **63 / 63 passed**.
- Every `src/**/*.js` module passes `node --check`; all relative imports resolve.
- DOM audit: **197 unique IDs** and **151 static `getElementById` references**.
- All **58 touched/new files** stay below 1000 lines (largest:
  `src/core/Game.js`, 946 lines).
- Feature stale-reference and trailing-whitespace searches are clean;
  `git diff --check` passes.
- Repository-wide file-length audit still finds the pre-existing, untouched
  `_partials/task_archive.md` at 1446 lines; no Survival change increased it.
- Browser timing, balance, pointer-lock, visual, audio, and stress checks remain
  deliberately unchecked above.

## Design brief

- Player promise: carry the campaign’s restored memories into an endless
  altar-born combat trial and improvise a build that survives escalating echoes.
- Target feeling: tense, legible, increasingly chaotic, and rewarding between
  pressure spikes.
- Primary verb: aim and fire; secondary verbs are reposition, dash, shockwave,
  overdrive, draft, and reroll.
- Core loop: clear a 30–45 second wave, read the next milestone, draft every five
  waves, defeat a remixed Guardian every ten, then continue until death.
- Pressure: mixed roles, stat scaling, elites, boss patterns, and finite health.
- Reward: build-changing upgrades, a locked weapon identity, boss healing, and
  rerolls.
- Failure/retry: death records one session-best result and resets the full build
  on a fast Wave 1 retry.
- Skill expression: positioning, target priority, dash/shockwave timing, heat or
  projectile management, and draft/reroll decisions.
- Non-goals: persistence/meta saves, mobile/gamepad, online boards, riddles, new
  external assets, arena mutators, and combo scoring.

## Encounter contract

- Circular arena with an open center, six readable spawn lanes, edge cover, and
  gallery landmarks; player begins at the altar-facing center.
- Wave 1 immediately teaches chasers and awards progress through combat feedback.
- Waves 2/3/4 introduce spitter/boarder/sniper; waves 6/8 add gargoyle/gale.
- Fifth waves are recovery/decision beats; tenth waves clear normal hazards,
  announce a boss for 1.5 seconds, then deliver one Guardian and only its
  authored summons instead of a normal recipe.
- Failure is readable through telegraphs, elite color tells, health/HUD feedback,
  and an explicit results overlay.

---

# Task — Memory Ledger Pause Menu (2026-07-30)

Plan: `_partials/implementation_plan_pause_menu.md`

## Objective

Replace the two-line `#resume` overlay with a real pause menu that reads the run
back to the player: an objective checklist, memories recovered (per zone and
overall), Guardian Souls, zones restored, and a context-aware control reference.

## Checklist

- [x] `src/core/_partials/PauseState.js` — `collectPauseState(game)` snapshot
- [x] `src/ui/_partials/pauseModel.js` — pure snapshot → view model (per-phase
      objective checklists, meters, pips, control sets)
- [x] `src/ui/PauseMenu.js` — `render(model)`, pooled list rows, no DOM churn
- [x] `_partials/pause-menu.css` + `index.html` skeleton and stylesheet link
- [x] `GamePause.js` — `_showOverlay` renders the ledger; focus the resume button
      so Enter/Space resumes
- [x] `GameUI.js` — bind the new nodes; `wireSettings` keys off `[data-settings]`
      so the footer Settings button reuses the existing modal
- [x] `Game.js` — construct `PauseMenu` before `GamePauseController`
- [x] `styles.css` — split `#start`/`#resume` so pause is a translucent blurred
      scrim over the frozen frame
- [x] `tests/PauseMenu.test.js` (new) + `tests/GamePause.test.js` stub
- [ ] User manually verify in browser: pause in zone / arena / museum, counts
      match the HUD, Settings opens without resuming, narrow viewport

## Phase 2 — chosen by the user from the hand-off questions

Kept: Esc-only pause (no new keys). Skipped: bugtong log, on-screen pause button,
subtitle/language toggle.

- [x] Tabs — the shell becomes **Ledger / Memories / Lore**; every pause opens on
      Ledger. The panel now swallows clicks (the backdrop still resumes) so
      browsing can never eject the player; `#resume-enter` is bound directly.
- [x] **Artifact gallery grid** — all 27 slots grouped by zone, thumbnails for
      what is recovered and dashed silhouettes for what is not. Clicking a found
      slot opens its origin/lore INSIDE the overlay (`ui/_partials/PauseCollection.js`)
      — reusing `DiscoveryScreen` would deadlock, since its promise resolves on an
      active-time wait that is frozen while paused.
- [x] **Run stats** — `_partials/RunStats.js` + `_partials/runEvents.js`: time
      beneath (Game's own paused-excluding clock), echoes dispersed, bugtong
      answered, faints. One kill funnel (`ThreatBody.hit`, so `vanish()` is not
      counted) and three answer sites (arena / rail / tower seals).
- [x] **Zone lore recap** — `src/data/zoneLore.js`, retold from GDD §8–§10 and the
      zone modules (identity, Guardian, trial shape, a Filipino line each).
- [x] **Settings: look speed** (`controls.pointerSpeed`) and **brightness**
      (`renderer.toneMappingExposure`, which ACES/OutputPass already reads), both
      persisted — and deliberately NOT through `readSaved`, whose legacy
      single-volume fallback would turn an old 50% volume into 0.5× look speed.
- [x] **Restart this memory / Quit to title** — `_partials/SessionFlow.js`, each
      behind a two-step arming confirm rather than `window.confirm`. Restart
      targets `_returnZone` when inside an arena and reuses `_loadZone`;
      `pause.abandon()` leaves the paused state without reclaiming pointer lock.
- [x] `tests/SessionAndRunStats.test.js` (new) — caught a real bug: `canRestartZone`
      as a *getter* on a mixin object is INVOKED by `Object.assign`, so the
      prototype would have received a frozen `false`. It is a method now.
- [ ] User manually verify in browser: the three tabs, a memory's inline detail,
      look-speed + brightness sliders, restart mid-arena, quit to title

## Phase 3 — complete control reference (user: "there are no combat system there")

- [x] The reference lists **every** binding the game reads in every context, not
      just the ones the context can use: combat (`Hold Click` / `F` / `R`), the
      combat hop (`Space`), the seal number keys (`1`–`3`), the walk-over verbs,
      and `Enter` to resume. Bindings re-read from the handlers, not recalled.
- [x] Not-live rows are dimmed and say why — a group `note` ("Only inside a Memory
      Arena") or the row's own caveat ("Armed only while a fight can floor you") —
      instead of being filtered out, which is what hid the combat kit.
- [x] `buildPauseModel` normalizes the `available`/`note` defaults so the renderer
      never sees optional fields.
- [x] Test asserts every binding appears exactly once per context across all
      eleven pausable phases, so a new verb cannot be added and missed here.
- Excluded on purpose: the hidden `Shift+P` presenter fast-forward (a stage tool).

---

# Task — Museum Pedestal Galleries + Floating Artifact Cubes (2026-07-29)

Plan: `~/.claude/plans/read-src-museum-museum-js-the-groovy-crown.md`

## Objective

Replace the museum's 36 wall-hung picture frames with per-zone gallery rooms, each
holding a ring of pedestals — one pedestal per artifact that zone actually has
(11 / 9 / 7) — with the artwork floating and rotating inside a glass cube.

## Confirmed direction (user)

- [x] Wall frames removed entirely
- [x] Zone 1 gets a NEW rear gallery past the +Z wall; the main room becomes a lobby
- [x] Pedestal count derived from `ARTIFACT_DATA`, not a config literal
- [x] Ring layout, with a zone-marker centrepiece in the middle of each ring
- [x] Glass cube with the artwork suspended inside
- [x] Ending tour becomes a full walkthrough of all three rings
- [x] The 4 old decorative lobby pedestals removed
- [x] Pull new CC0 textures — pale marble plinths with brass trim
- [x] `IntroCutscene.js` and `FaintCutscene.js` untouched

## Checklist

- [x] Download CC0 `marble-pale` (Marble012) + `brass` (Metal007) sets; credit them
- [x] `config.js` — `MUSEUM.GALLERY`, drop `WING`/`SLOTS_PER_ZONE`, raise `ENDING.MUSEUM_DURATION`
- [x] `_partials/RoomShell.js` — shared `Tracker` / `tilePlane` / `wall` / `loadTextureSet` / `signTexture`
- [x] `_partials/ArtifactPedestal.js` — plinth, empty socket, glass cube, float+spin
- [x] `_partials/GalleryRing.js` — room shell, pedestal ring, zone marker, tour anchors
- [x] `Museum.js` — drop frames/slots, wire 3 rings, rework collision, picking, lights
- [x] `EndingCutscenes.js` — `MuseumEndingCutscene` full walkthrough via `galleryTour()`
- [x] `CLAUDE.md` — museum architecture note rewritten for the lobby + galleries
- [x] Verify: headless museum harness, `node --check`, import resolution, tests, line cap
- [ ] User manually verify in browser: three rings, glass cubes spin and read from
      every angle, revisit prompt, intro unchanged, ending walkthrough, epilogue museum

## Fixes forced by the headless geometry check

The first pass built a ring the player could not use; the harness caught both:

- **The ring was too big for the room.** The plan's clearance arithmetic forgot
  `PLAYER_RADIUS`, so the walk bands inside and outside the ring were ~0.06 m of
  centre travel — impassable. Room `HALF_W` 3.5 → 4.5, `RING_SHORT` 2.2 → 2.6,
  `RING_LONG` 4.4 → 4.2, `MARKER_R` 0.85 → 0.6. Now 0.66 m outside, 0.76 m inside.
- **Equal-ANGLE spacing bunched the plinths at the ellipse's ends**, where spacing
  collapses to `Δθ·RING_SHORT` — 0.80 m of gap for Zone 1's eleven, less than the
  player's 0.90 m width, so the ring could never be entered. Pedestals are now
  placed by equal ARC (`ellipseAngles` in `GalleryRing.js`), giving a uniform
  1.86 m minimum spacing.

## Fixes after user browser feedback

- **See-through gap where each side wall meets the portal wall.** `_doorwayWall`
  measured its span symmetrically about the room's `cross` offset, but the lobby
  edge is centred on 0 — so with `cross = 2.0` the ±X lobby walls ran `z = -8..12`
  instead of `-10..10`, leaving a 2 m hole at the -Z corner (and 2 m of stray wall
  past the +Z wall). Zone 1 was unaffected because its `cross` is 0. The span is
  now passed as absolute `vMin`/`vMax` bounds. Collision was never affected — the
  walls still blocked; the hole was purely visual.

## Follow-up — smaller lobby, bigger galleries (user request)

The lobby is a crossroads now that no artifact lives in it, so it shrank and the
rooms it serves grew. `MUSEUM.ROOM_HALF` is the single dial — spawn point,
hallway anchor, and both cutscenes derive from it.

- Lobby `ROOM_HALF` 10 → **8** (20×20 → 16×16 m)
- `PORTAL_X` ±5.5 → **±4.8**, so the outer doorways keep a 1.7 m corner panel
  rather than the 1.0 m the smaller lobby would have left them
- Gallery `LEN` 12 → **15**, `HALF_W` 4.5 → **6** (108 → 180 m² per room)
- Ring grown to match: `RING_LONG` 4.2 → **5.4**, `RING_SHORT` 2.6 → **3.4**.
  Walk bands roughly doubled (1.81 m outside / 1.56 m inside, up from 0.66/0.76)
  and minimum plinth spacing 1.86 → 2.41 m
- Hanging lamps rebalanced toward the galleries: lobby 4 → 3 (now spaced as a
  fraction of `ROOM_HALF`, one over the altar), each gallery 2 → 3. 12 PointLights.
- **Hub fog pushed back** to near 20 / far 70, restored to 6/26 on the way out. A
  15 m-deep gallery's far wall sat at ~45% haze under the intro's fog, which is
  wrong for a room meant to read bright.

Knock-on effects, both verified rather than assumed:

- The **intro is geometrically unchanged in code** but now plays over a smaller
  lobby: the wake pose moves z 7.8 → 5.8 and the walk to the hallway is 13 m
  instead of 17.8 m over the same `CUTSCENE.MOVE`, so the drift reads slower.
  A harness pass confirms the camera stays inside the lobby + open corridor for
  the whole timeline and still ends inside the corridor.
- Zone 3's ring is sparser (7 plinths over a 28 m perimeter ≈ 3.6 m apart) since
  all three rooms stay the same size. Deliberate — the rooms read as siblings.

## Follow-up — ending tour camera flipped on the first pan (user report)

`TimelineCamera._sample` lerps the look POINT, and `lookAt()` degenerates the
instant that point crosses the camera position — the camera snaps 180°.

- **Beat 1 (reported).** Opened at `z = 6.4` looking at the altar (`z = 0`, so -Z),
  then lerped the target to the Zone 1 ring centre at `z = 15.5` (+Z). Camera and
  target both sat on `x = 0`, so the target passed exactly through the lens. The
  tour now opens on the FAR side of the altar looking across it toward Zone 1 —
  no reversal at all.
- **Beat at t=16.2s (found by the new check, not reported).** The Zone 2 -> Zone 3
  transit was an exact 180° reversal along a single line, degenerate for the same
  reason. Each room-to-room turn now routes through a `swing` keyframe whose target
  sits 10 m out along the angular BISECTOR of the turn, so no half exceeds 90° and
  the target can never cross the camera. Exact reversals are broken toward +Z, so
  the sweep crosses the galleries rather than the portal wall.
- Galleries are now exited by pulling back through the doorway while still facing
  into the room, so the reversal happens in the lobby where there is room to sweep.

Added a standing harness check for this class of bug: minimum look-target distance
and peak yaw rate along the whole path. Before: 0.16 m and 10,800°/s. After:
**5.63 m and 122°/s** — a flip reads as thousands of degrees per second, so this
would have caught both without a playthrough.

## Verification record

- 75/75 headless museum checks pass (throwaway `three` stub + resolver hook, so
  the real `Museum` is constructed and inspected in Node): pedestal counts derive
  from `ARTIFACT_DATA` (11/9/7), every plinth is inside its room and clear of the
  walls, both walk bands are clear for a full lap of all three rings, doorways
  pass and walls/plinths/markers block, portal corridors unchanged, `populate` is
  idempotent, cubes bob clear of the plinth top, room-gated picking, plaque
  repaint frees the old texture, and the ending camera enters all three galleries
  without ever leaving the walkable shell.
- The room gate on crosshair picking is load-bearing, not belt-and-braces: the
  nearest Zone 1 cube is 2.08 m past the lobby's +Z wall, inside `INTERACT_RANGE`.
- 22/22 existing Node tests pass; all `src/**/*.js` pass `node --check`; 229
  relative imports resolve; no stale `slotsByZone` / `_addSlot` / `MUSEUM.WING`
  references remain.
- Line counts: `Museum.js` 898 → 643, plus `GalleryRing` 369, `ArtifactPedestal`
  196, `RoomShell` 136 — all well under the 1000 cap.
- Assets added: 2.2 MB (`marble-pale` at 1K, `brass` downsampled to 512).

---

# Task — Arena Boss Victory Rift Cutscene (2026-07-29)

Plan: [_partials/implementation_plan_arena_victory_rift.md](_partials/implementation_plan_arena_victory_rift.md)

## Confirmed direction

- [x] Shared animation for Arena 1, Arena 2, and `arena3boss`
- [x] First-person, unskippable, 5–6 seconds
- [x] Rift forms at the boss and pulls the camera toward it
- [x] No new audio assets; existing Web Audio API cues only
- [x] Preserve return, progression, balance, and boss-only retries

## Checklist

- [x] Inspect current boss victory, rift, camera, VFX, and return ownership
- [x] Record the approved technical plan
- [x] User review and approve the implementation plan
- [x] Implement the shared cutscene and pooled rift/death VFX
- [x] Integrate lifecycle, resize, distortion, and cleanup
- [x] Run static/tests/file-limit verification
- [ ] User manually verify all three boss victories in browser

---

# Task — Keeper Weighted Attack Scheduler + Partial Split (2026-07-29)

Plan: [_partials/implementation_plan_keeper_scheduler.md](_partials/implementation_plan_keeper_scheduler.md)

## Confirmed direction (user)

- [x] Full parity — the aimed shot becomes a weighted pattern, not a filler clock
- [x] Full split — body + all three set-pieces move to `_partials/`
- [x] Summon path built but **default off** (`SUMMON_INTERVAL: null`)
- [x] Retune freely, including per-phase attack weights

## Checklist

- [x] `_partials/TowerKeeperBody.js` — body, fade, hit flash, `setFlare()`
- [x] `_partials/BeaconCharge.js` — lane, dash, hit/miss recovery, `moving` flag
- [x] `_partials/MemoryStones.js` — debris pool, warnings, power-up drop
- [x] `_partials/LighthouseSweep.js` — approach, blade, sweep, `approaching` flag
- [x] `TowerKeeper.js` — nested tuning blocks + weighted scheduler + `_pattern` guard
- [x] Per-phase `ATTACK_WEIGHTS`; sweep weighted 2 at phase 0 so it is never starved
- [x] `SHOT.BURST` [1,2,3] to offset the shot's lower frequency
- [x] Phase flare as its own `_flare` countdown, not a pattern
- [x] Summon tunables wired to the previously-uncalled `combat.spawnBossGroup(phase)`
- [x] Preserve external API (constructor, `begin`, `update`, `center`,
      `blocksPlayerAt`, `body.show/update`, `projectileDamage/Knockback`)
- [x] Verify: `node --check` on all changed files, stale-reference grep, line limits
- [ ] User manually verify in browser: patterns visibly rotate, sweep appears in
      phase 0, burst shot reads cleanly, no body-block pin during charge/approach

---

# Task — Hold-to-Fire Bolts + Melee Shockwave (2026-07-29)

Plan: [_partials/implementation_plan_hold_fire_melee.md](_partials/implementation_plan_hold_fire_melee.md)

## Confirmed direction (user)

- [x] Auto-repeat while the mouse is held — no charge shot, no DPS change
- [x] `F` releases the melee shockwave
- [x] Shockwave does damage **and** knockback
- [x] All three combat managers: base, Tower, Rail
- [x] Cooldown UI rides the crosshair
- [x] User review and approve the implementation plan
- [x] Melee also deflects projectiles (Arena 2's real use for it)
- [x] Melee gated so it cannot be abused

## Checklist

- [x] `COMBAT.SHOCKWAVE` config block; amend the stale "left click" `BOLT` comment
- [x] `CombatManager`: `setFiring()`, held-fire gate on the existing `_fireCooldown`
- [x] `CombatManager`: `requestMelee()`, `_updatePlayerMelee()`, `_releaseShockwave()`
- [x] `_damageEnemyFromMelee()` hook + Tower/Rail overrides for their own kill accounting
- [x] Widen `RailCombatManager._defeatThreat` with a `damage` argument
- [x] Clear `_firing` on pointer-lock loss, pause, fight start, and abort
- [x] `ViewModel.triggerSlam()` — a down-forward slam envelope separate from `castT`
- [x] `AudioManager.playShockwave()` — procedural thump + noise whoosh
- [x] `#meleering` crosshair ring: markup, CSS, `CombatHud.setMelee()`
- [x] Input wiring: `mousedown`/`mouseup`/`pointerlockchange` + `KeyF`
- [x] Control text: `index.html` controls line, `JourneyGuide` hints, `ArenaFlow` prompts
- [x] Verify: `node --check` across `src/**/*.js`, existing Node tests, line limits
- [ ] User manually verify in browser: hold-fire cadence, no stuck fire after
      pause/alt-tab, shockwave damage + shove, ring cooldown readout, all 3 arenas

## Deviations from the plan (all forced by what the code actually does)

- **Knockback had to become a hook.** `nudge()`/`_move()` live on `Enemy`, but
  `RailThreat` and `TowerThreat` extend `ThreatBody` directly — the planned
  `enemy.nudge()` call would have thrown a TypeError in Arenas 2 and 3. Now
  `_knockbackFromMelee()`: base uses the collision-aware nudge, Rail displaces
  the group directly (open water, nothing to be pushed through), Tower is a
  deliberate no-op (gargoyles are anchored and gales re-write `position.x/z`
  from `_fixedX/_fixedZ` every frame, so a shove would be erased next frame).
- **Stamina became the second abuse gate**, which forced stamina to regenerate
  while `movementLocked` — Arena 2's early return skipped the regen block, so
  the boat would have had two shockwaves for the entire ride and no more.
- **`AudioManager.js` had to be split.** It was already at 1008 lines (over the
  1000 limit) before this task; `playShockwave` pushed it to 1048. The 15
  wave-combat one-shots moved to `_partials/CombatSfx.js` and are mixed onto the
  prototype, so every existing call site is unchanged. Now 616 + 447.
- **Base `_deflectShots` destroys, Rail's turns the shot around**, per the user's
  note that melee should still deflect bullets in Arena 2.

## Verification record

- 21/21 Node tests pass (`node --test tests/*.test.js tests/*.test.mjs`)
- All `src/**/*.js` pass `node --check`; 0 unresolved relative imports
- `CombatSfx` mixin runtime-verified: 15 methods attach to a stub prototype and
  all 14 sound calls no-op safely with `ready = false`
- Every file under the 1000-line limit (largest: `World.js` at 942)
- `git diff --check` clean; `#meleering` resolves in both `index.html` and CSS

---

# Task — Summit Portal and Arena 3 Boss Keeper Fight (2026-07-29)

Plan: [_partials/implementation_plan_summit_portal_arena3boss.md](_partials/implementation_plan_summit_portal_arena3boss.md)

## Confirmed direction

- [x] Keeper of Memories moves out of Arena 3 into a new arena
- [x] New `arena3boss` module — traversable scaffold now, real design specced later
- [x] Portal is entered by walking into it (no prompt, no key)
- [x] Tide keeps rising on the summit — the portal is a timed escape
- [x] Dying to the Keeper retries in `arena3boss`, not the tower climb
- [x] `arena3boss` has static water, no rising tide
- [x] Keeper intro cutscene plays on arrival in `arena3boss`
- [x] User review and approve the implementation plan
- [x] Publish the summit portal anchor from `arena3.js`
- [x] Build `SummitPortal` (vortex panel, sealed/open states, walk-in trigger)
- [x] Strip the Keeper out of `TowerArenaController`
- [x] Add `KeeperArenaController` with retry-in-place and the intro hooks
- [x] Scaffold `arena3boss.js` and register it
- [x] Add `_transferArena` preserving `_returnZone`, and wire the Game consume
- [x] Add `arena3boss` intro-cutscene script and audio palette
- [x] Flag the superseded summit sections in `Arena3.md`
- [x] Verify syntax, file limits, and the presenter-skip contract
- [x] Fix the Keeper intro's blocked view: re-author the `arena3boss` shot list
      and remove the deck plinth (arena3boss only; no shared camera clamp)
- [ ] User manually verify climb → portal → Keeper → death retry → win → Zone 3
- [ ] User manually verify the Keeper intro cutscene is unobstructed

## Verification record

- 21/21 Node tests passed (`node --test tests/*.test.js tests/*.test.mjs`)
- All 103 `src/**/*.js` modules pass `node --check`; 0 unresolved relative imports
- No external references remain to the removed `TowerArenaController` members
  (`keeper`, `_beginBossPhase`, `consumeGuardianIntroRequest`, `BOSS_RETRY_POINT`)
- All touched files well under the 1000-line limit (largest: `Game.js` at 923)
- `git diff --check` clean
- `_transferArena` tears down the live arena/combat before `_loadArena` overwrites
  them — an arena→arena hop, unlike a zone→arena entry, has both already running
- Browser verification of the portal trigger, the Keeper handoff, and the Zone 3
  return remains the user gate

---

# Task — Awaken Stage and Eyes-Opening Transition (2026-07-28)

Plan: [_partials/implementation_plan_awaken_transition.md](_partials/implementation_plan_awaken_transition.md)

## Confirmed direction

- [x] Start initializes the music and reaches a fully black stage
- [x] Show a dedicated Awaken button before `IntroCutscene` begins
- [x] Open curved upper and lower eyelids over the museum intro
- [x] Keep the phase desktop-only
- [x] Use fully opaque pure-black eyelids with no teal edge or seam glow
- [x] Keep the Awaken prompt's existing teal treatment
- [x] Blink twice before the final full opening
- [x] User review and approve the implementation plan
- [x] Build the accessible Awaken stage and button states
- [x] Coordinate the eyelid reveal with the intro camera and existing wake fade
- [x] Verify event propagation, phase guards, syntax, DOM contracts, and file limits
- [x] Apply the approved dark-lid treatment and two-blink waking motion
- [ ] User manually verify music, Awaken timing, eyes opening, and intro continuity

## Verification record

- 18/18 Node regression tests passed
- Touched JavaScript modules pass `node --check`
- DOM ids, CSS brace balance, event propagation guard, phase guard, and file limits pass
- The hidden Awaken control is disabled at boot and focus stays inside its modal phase
- Eyelids are pure `#000`, the teal seam/edge rules are absent, and two full
  open-close beats precede the final open keyframe
- Browser animation, audio timing, and the absence of visual flashes remain the user gate

---

# Task — Main Menu Zone-Flash Fix (2026-07-28)

Plan: [_partials/implementation_plan_main_menu_flash_fix.md](_partials/implementation_plan_main_menu_flash_fix.md)

## Checklist

- [x] Trace the Start transition and identify the compositing gap
- [x] Confirm the live Zone 1 canvas is beneath two simultaneously translucent layers
- [x] Keep the title opaque while the black pre-Awaken overlay fades over it
- [x] Verify syntax, CSS balance, file limits, whitespace, and transition ownership
- [ ] User manually verify Start reaches black without a Zone 1 glimpse

---

# Task — Main Menu Visual Redesign (2026-07-28)

Plan: [_partials/implementation_plan_main_menu.md](_partials/implementation_plan_main_menu.md)

## Approved direction

- [x] Use a layered composition from the authored `assets/UI/` artwork
- [x] Replace the plain heading with an optimized derivative of `LOGO.png`
- [x] Rename the primary action from `Awaken` to `Start`
- [x] Keep Settings and GameOn account access on the player-facing menu
- [x] Gate Skip to Museum behind a disabled-by-default debug config flag
- [x] Use “Follow the Path. Restore the Forgotten” as the menu tagline
- [x] On Start, initialize music and transition to a temporary black pre-Awaken state
- [x] Defer the Awaken button and eyelid-opening animation to the next phase
- [x] Target desktop only
- [x] User review and approve the implementation plan
- [x] Prepare optimized, non-destructive menu derivatives of the authored artwork
- [x] Implement the layered desktop menu and black pre-Awaken transition
- [x] Verify syntax, DOM/config contracts, file limits, whitespace, and desktop layout constraints
- [ ] User manually verify menu composition, controls, music start, and transition

## Verification record

- 18/18 Node regression tests passed
- Touched JavaScript modules pass `node --check`
- DOM ids, menu asset paths, CSS brace balance, and stale Awaken bindings pass
- All touched files remain below 1000 lines; `git diff --check` passes
- Authored source artwork remains unchanged; menu derivatives total about 2.4 MB
- Browser screenshots remain pending because local serving and headless Chrome
  required permissions that were not granted

---

# Task — Hil Zone-Entry Dialogue (2026-07-28)

Plan: [_partials/implementation_plan_hil_zone_dialogue.md](_partials/implementation_plan_hil_zone_dialogue.md)

## Checklist

- [x] Trace the zone-entry subtitle lifecycle and its fixed timing
- [x] Read the current campaign, Hil/player, zone, Guardian, and ending context
- [x] Draft a three-zone emotional arc without pre-arena spoilers
- [x] Replace the PONSIA, LIKET, and PANANISIA dialogue
- [x] Remove the resolved placeholder limitation from `STRINGS_GDD.md`
- [x] Verify syntax, placeholder removal, file limits, and whitespace
- [ ] Manually verify subtitle timing, overlap, and tone in all three zones

---

# Prior Task — GameOn Portal API Integration (2026-07-28)

Plan: [_partials/implementation_plan_gameon_api.md](_partials/implementation_plan_gameon_api.md)

## Approved decisions

- [x] Implement directly on `main`; do not merge, cherry-pick, rebase, or copy
      commits from `feat/auth`
- [x] Keep `feat/auth` untouched
- [x] Use `https://gameonportal.ph` with inert `YOUR_GAME_ID` configuration
- [x] Unlock only when a legitimate three-zone campaign begins the ending
- [x] Exclude the final-cutscene and presenter progression shortcuts
- [x] Preserve local collection/progression when the platform is unavailable
- [x] User review and approve the implementation plan
- [x] Implement the session lifecycle, account UI, and campaign reward gate
- [x] Add mocked API and campaign-eligibility tests
- [x] Reconcile README and GDD platform documentation
- [x] Verify syntax, tests, imports, DOM IDs, file limits, whitespace, and branch state
- [x] Report remaining Game ID, browser, CORS, popup, and live-platform verification

## Verification record

- 21/21 Node tests passed, including the mocked GameOn lifecycle and campaign gate
- Every `src/**/*.js` module passed `node --check`
- All 100 relative module imports and 121 `getElementById` references resolve
- All changed source/UI files remained below 1000 lines; `src/audio/AudioManager.js`
  was later split and is currently below the limit
- `git diff --check` and the stale endpoint/reference audit passed
- `main` remains checked out at its original tip; `feat/auth` remains unchanged at
  `d54ef95c2fd637fea0136a203c2902b203b52b2f` and unmerged
- Live GameOn, browser popup, CORS, and both-host deployment checks remain pending
  until `YOUR_GAME_ID` is replaced with the assigned value

---

# Task — Arena 3 Combat Jump (2026-07-28)

## Objective

Make Arena 3's controls consistent with Arena 1 by enabling the existing
Space-key combat jump throughout the tower encounter.

Plan: `_partials/implementation_plan_arena3_jump.md`

## Checklist

- [x] `TowerCombatManager` — arm jump on fight start; disarm/land on abort
- [x] `TowerArenaController` — show `SPACE TO LEAP` at Keeper start and retry
- [x] `CombatManager` — correct the ownership comment now that Arena 3 opts in
- [x] Verify: syntax, relative imports, and 1000-line cap
- [ ] Manually verify in browser: ascent jump, Keeper jump, stop/retry cleanup

---

# Task — Feastkeeper Attack Patterns + Combat Jump (2026-07-28)

## Objective

Zone 1's boss stood still and ran two timers (one aimed spit, one summon), so the
fight never made the player leave the middle of the arena. Add three attack
patterns that deny space, plus a combat jump that answers exactly one of them.

Plan: `_partials/implementation_plan_feastkeeper_patterns.md`

## Decisions (from user)

- **Third pattern:** Offering Slam — expanding shockwave with a rotating safe gap.
- **Scheduling:** all patterns unlocked from the start; phases only tighten
  cooldowns and raise counts.
- **Difficulty:** tense but fair — telegraphs ≥ 0.9 s, wide gaps, no overlap.
- **Jump:** added, combat-only.

## Checklist

- [x] `config.js` — `JUMP_SPEED` / `JUMP_GRAVITY` / `JUMP_STAMINA`, `POOL_SPITS` 24→48
- [x] `PlayerController.js` — `jumpOffset` layered over the ground-follow,
      `setJumpEnabled`, edge-triggered Space, reset on lock/pause
- [x] `CombatManager.js` — arm/disarm jump in `startFight`/`abortFight`/`dispose`;
      per-projectile `damage`; one hostile hit per frame
- [x] `ProjectilePool.js` — optional `damage` on a slot
- [x] `_partials/FeastGrenades.js` — lobbed pots + fuse-length ground markers
- [x] `_partials/SpiralVolley.js` — rotating bullet arms at torso muzzle height
- [x] `_partials/OfferingSlam.js` — expanding ring, wedge carved into the geometry
- [x] `FeastkeeperBoss.js` — attack scheduler, tuning blocks, `dispose()`
- [x] `zone1Golem.js` + `Guardian.js` — `gesture()` attack poses
- [x] `ArenaController.js` — `SPACE TO LEAP` callout at boss start
- [x] Verify: `node --check` + import resolution on touched files, 1000-line cap
- [ ] Manually verify in browser: jump feel, each pattern, phase transitions, retry

---

# Task — Combat Damage Numbers & BLOCKED Text (2026-07-28)

## Objective

Combat has impact VFX but no readable numbers: the player cannot tell how much a
bolt did, that a shot was absorbed by the guardian's shield, or how hard a hit
they just took. Add pooled world-space floating combat text shared by all three
arenas.

Plan: `_partials/implementation_plan_damage_numbers.md`

## Decisions (from user)

- **Placement:** world-space floating labels projected from the impact point.
- **Scope:** damage dealt, `BLOCKED` on shield hits, damage taken, and
  armor-break / phase callouts.
- **Arenas:** all three, one shared system.
- **Wording:** plain English `BLOCKED`.

## Checklist

- [x] `src/ui/_partials/CombatPopups.js` — pooled projected-label system
- [x] `CombatHud.js` — construct, `setCamera`, `popup*` delegates, update/clear/dispose
- [x] `config.js` — `HUD.POPUPS` / `POPUP_LIFE` / `POPUP_CALLOUT_LIFE` / `POPUP_RISE`
- [x] `index.html` — `#combat-popups` container
- [x] `_partials/arena-hud.css` — `.combat-popup` + kind modifiers
- [x] `ArenaBoss.js` — damage number, BLOCKED, armor-break + phase callouts
- [x] `CombatManager.js` — enemy damage number, player-damage number, camera wiring
- [x] `RailCombatManager.js` / `TowerCombatManager.js` — threat damage numbers
- [x] Verify: `node --check` on touched files, 1000-line cap
- [ ] Manually verify in browser: all three arenas

---

# Task — Zone Moonlight Pass (2026-07-28)

## Objective

The CC0 texture pass left zones 1–3 dark and flat (roughness maps + no
environment = almost no specular). Replace the warm amber key with a cool
moonlight rig, add a procedural gradient environment so the normal/roughness
maps read, and remove the god-ray light shafts.

Plan: `_partials/implementation_plan_zone_moonlight.md`

## Decisions (from user)

- Remove: **the god-ray light shafts** (`lightShafts()` in zones 1–3). The
  `world._lightShaft()` primitive stays — `zoneDebug` still uses it.
- Moon: **directional moonlight + procedural gradient env map** (not moon-only —
  fully-rough materials need an environment to have any specular at all).
- Mood: **keep relative per-zone mood** via a `light` override block on each zone
  def. Zone 3 stays darkest, zone 2 keeps a warm festival bounce.
- Amount: **readable but still night**. Fog density, background and bloom untouched.

## Checklist

- [x] New `src/core/_partials/ZoneLighting.js` — `DEFAULT_LIGHT`, `buildZoneLighting`,
      cached equirect gradient environment (no PMREMGenerator, so no renderer ref)
- [x] `World._lights()` — delegate to the rig, stash `moonDir` / `moonColor`
- [x] `World._water()` — re-point `uSunDir` at the moon, add `uSunColor` so the
      surface sheen is cold instead of the old hardcoded warm band
- [x] `zone1.js` — drop `lightShafts()`, document that it is the reference mood
- [x] `zone2.js` — drop `lightShafts()`, add warm-bounce `light` override
- [x] `zone3.js` — drop `lightShafts()`, add dimmest/coldest `light` override
- [x] Verify: syntax parse, no orphaned `lightShafts` refs, 1000-line cap, init order
      (`_materials` → `_lights` → `_water`)
- [ ] Manually verify in browser: all three zones, plus the arenas and the museum
      portals (arenas inherit the new default rig)

---
## Survival Mode — early-game balance

Plan: `_partials/implementation_plan_survival_balance.md`

Why wave 1 hurt: the base weapon was the campaign Light Bolt (1 dmg / 0.22s
≈ 4.5 dps) while Survival threats use their own, much larger health baseline
(`SURVIVAL_ROLE_BASE_HP`) — a 60 HP five-chaser opener meant ~13s of fire. And
`primary-power` is multiplicative, so rank 1 on a base of 1 was invisible.

- [x] `SurvivalUpgrades.js` — new `SURVIVAL_LIGHT_BOLT` (3 dmg / 0.22s); rapid
      1→2.5, lance 3→8, laser 0.55→1.4 per tick. All four now sit in a 12–14 dps
      band. `COMBAT.BOLT.DAMAGE` untouched — it is shared with the campaign.
- [x] `SurvivalWeapons.js` — base branch reads `SURVIVAL_LIGHT_BOLT`; keeps
      `COMBAT.BOLT.RADIUS` so the bolt looks unchanged
- [x] `SurvivalRules.js` — `SURVIVAL_FIRST_DRAFT_WAVE`/`SURVIVAL_DRAFT_INTERVAL`,
      `isSurvivalDraftWave`, `describeSurvivalMilestone` (one source of truth;
      `SurvivalUI` had a duplicate milestone formatter)
- [x] `SurvivalController.js` — drafts on wave 2 then every fifth
- [x] Tests: 4 new cases (dps band, Primary Power legibility, draft cadence,
      milestone labels) — `node --test tests/Survival*.test.js` → 43 pass
- [x] `SurvivalMode.md` tuning tables updated
- [ ] Manually verify in browser: wave 1 clear time, the wave 2 draft, and that
      each weapon path still feels distinct
- [ ] Revisit boss HP (`hpPerIndex: 0.55`) after playing wave 10 — bosses now die
      ~3× faster than before this pass

---
## Survival Mode — Endless Echoes portal + immediate-unlock config

Plan: `_partials/implementation_plan_survival_portal.md`

- [x] `CONFIG.DEBUG_SURVIVAL_UNLOCKED` — opens the arch on the first hub visit so
      Survival can be tested without playing to the ending
- [x] `MUSEUM.SURVIVAL_PORTAL` — placement block. The -Z wall is FULL (3 doorways
      at x=-4.8/0/4.8, DOOR_HALF 1.5) and the other three walls each belong to a
      gallery, so this is a free-standing arch IN the lobby, not a 4th doorway
- [x] New `src/museum/_partials/SurvivalPortal.js` — the arch (posts, lintel,
      emissive panel, violet vortex, plaque). Sealed/open differ only in material
      and plaque text, never a transform, so it survives `_freezeStatic`
- [x] `RoomShell.js` — extracted `plaqueTexture(title, subtitle, dim, ...)`;
      `signTexture` now delegates (it hardcoded "ZONE N", unusable for the arch)
- [x] `Museum.js` — build/show/collide/update/dispose the arch; `setEpilogueMode`
      deliberately does NOT seal it (documented as the exception)
- [x] `SurvivalEntryPolicy.js` — replaced the credits policy with
      `isSurvivalPortalOpen` + `canEnterSurvivalFromHub` (museum phase only)
- [x] `SurvivalFlow.js` — `_enterSurvivalFromHub`, `_syncSurvivalPortal`, and
      `_returnFromSurvival` (before the ending, returns to the ORDINARY hub —
      forcing epilogue mode would seal an unfinished campaign's zone portals)
- [x] `Game.js` — arch proximity check in the hub loop, outside the zone-portal
      sweep since it stays open in epilogue mode
- [x] Credits button removed: `#ending-survival`, `onEnterSurvival`,
      `enterButton`, `setCreditsEntryEnabled`. Credits now offer only Return.
- [x] Fixed a world leak found on the way: the hub keeps the last zone's world
      alive, so entering Survival from it leaked one. Extracted
      `Game._detachActiveZone()` (shared with `_loadZone`) and null-guarded the
      `oldWorld.dispose()` calls, since `this.world` is now null during the hub.
- [x] Tests: 51 pass. New cases for the open/sealed policy, hub-only phase gate,
      arch clearance vs. the Zone 1 doorway and the intro camera path, and the
      epilogue-seal exception.
- [x] Docs: `SurvivalMode.md` entry section + `CLAUDE.md` museum paragraph
- [ ] Manually verify in browser: the sealed arch reads as sealed, the open one is
      findable from the spawn point, walking in starts a run, and returning lands
      in the right museum (ordinary vs. epilogue) for each route
- [ ] Ship check: `DEBUG_SURVIVAL_UNLOCKED` must be false for a real release

---
## Survival: boss duels, laser hit bug, thicker beam

Plan: `_partials/implementation_plan_survival_duel_laser.md`

- [x] `allowSummons` constructor option on `ArenaBoss` (defaults to on, so the
      campaign is untouched); `SurvivalBossDirector` passes `false` for all three
- [x] Gated every add-spawning call: Feastkeeper `_summon` (the funnel — see the
      follow-up fix below), Reveler
      `_updateSummons` + the two hardcoded `spawnRandomGroup` calls in `begin()`
      and `_onPhaseChanged()`, Keeper `_tickSummons` + `SUMMON_ON_ENRAGE`
- [x] Fixed the laser-vs-Reveler bug. Root cause was NOT the beam: the shared
      `_playerAttackTargets` array was truncated to length 1 rather than rebuilt,
      while `RevelerBoss` composed its pattern targets into that same array — so
      slot 0 stopped being the boss and, after an Overload channel, held a dead
      node. Base now rebuilds; the Reveler owns its own array (defence in depth).
      Affects the campaign Reveler too, wherever hits route through target records.
- [x] Beam redrawn as core + additive sleeve (two aimed unit cylinders sharing one
      geometry), width from Path Mastery, swelling with heat and sputtering before
      overheat lockout
- [x] Tests: 50 pass. New: the summon gates, the target-array regression (both the
      rebuild and "no `length = 1`"), and the beam construction.
- [ ] Manually verify in browser: a boss wave spawns no adds; the laser keeps
      damaging the Reveler after severing an Overload channel and after each
      enrage; the beam reads thicker and its overheat sputter is legible
- [ ] Decide on the pre-existing `gargoyle` unlock wave (see below)

### Not mine — needs your call

`SURVIVAL_ROLE_UNLOCKS` in `SurvivalRules.js` now has `gargoyle` at `wave: 0`
(was 6), so gargoyles spawn from wave 1. `tests/SurvivalRules.test.js` still
asserts wave 6 and fails. I left both alone rather than guess: if wave 0 is
intentional, the test's expectation table needs updating; if it was a stray edit,
restore `wave: 6`.

---
## Survival: descriptive weapon + Path Mastery cards

- [x] New pure module `src/core/survival/SurvivalUpgradeCopy.js` —
      `describeSurvivalCard(card, build)` derived from `SURVIVAL_WEAPON_PATHS` /
      `SURVIVAL_LIGHT_BOLT`, so card copy cannot drift from the real tuning
- [x] Weapon cards now state damage, cadence, dps and the trade against the Light
      Bolt they replace (plus "hitscan" for the beam, its actual selling point)
- [x] Path Mastery is weapon- and rank-aware: "Rapid Weave · rank 2 of 3: bolts
      pierce 3 targets (up from 2)". Also says outright that the Laser's ranks buy
      uptime, not damage — the thing that made it feel like a dead pick.
- [x] Deleted `CARD_DESCRIPTIONS` from `SurvivalUI.js`; the UI now calls the copy
      module with the `buildState` it already receives (stored as `_draftBuild`)
- [x] Tests: 3 new cases asserting the copy against the tuning tables, the
      rank-3-of-3 ceiling, the no-weapon-chosen fallback, and that every card in
      `SURVIVAL_UPGRADE_CARDS` (plus the `-echo` fallbacks) resolves to real copy
- [ ] Manually verify in browser: the longer copy fits the card without clipping
      (`.survival-card` is `min-height: 268px` with `overflow: hidden`, so it grows
      rather than clips, but all three cards grow together — check the short-viewport
      case where the overlay has to scroll)

### Blocked test suite — your WIP

`SURVIVAL_ROLE_UNLOCKS` in `SurvivalRules.js` currently has `sniper`, `gargoyle`
and `gale` **commented out**, so only chaser/spitter/boarder ever spawn. Two tests
fail on that (`lesser roles unlock on their authored waves`, and `normal recipes
mix unlocked roles` — wave 19's `baseCount` is 5 instead of 6). Untouched: it
looks like a deliberate mid-experiment state. Restore the three lines, or tell me
the new role set and I will re-baseline both tests.

---
## Follow-up: `allowSummons` was still letting the Feastkeeper summon

User caught adds still arriving on a boss wave. Two causes, both fixed:

- [x] `FeastkeeperBoss._onPhaseChanged` calls `_summon()` **directly** ("entering a
      phase opens with the biggest group"), bypassing the gate I had put on
      `_tickSummons`. Gate moved to `_summon` itself — the funnel every Feastkeeper
      add passes through, so the clock and the enrage are both covered.
- [x] Added a choke point so this class of miss cannot recur:
      `SurvivalCombatManager.spawnExtra` / `spawnRandomGroup` / `spawnBossGroup`
      now return early when the live boss has `allowSummons === false`. These three
      methods serve boss summons ONLY (waves enter via `spawnWave`/`_queueRole`),
      so no normal wave is affected. Suppression reads the boss's own flag rather
      than duplicating the policy.
- [x] Tests updated: the Feastkeeper assertion now targets the funnel and pins it
      to a single `spawnExtra` call; three new assertions cover the manager gate.
- [ ] Re-verify in browser: reach wave 10 with each Guardian and confirm no adds,
      including across an enrage (that is the case that was broken)

---
## Survival pre-run briefing (Endless Echoes)

Plan: `_partials/implementation_plan_survival_briefing.md`. Wave 1 no longer starts
the moment you step through the arch.

- [x] `src/core/survival/SurvivalBriefing.js` — pure content, every rule derived
      from `SurvivalRules` (threat cap, first draft wave, draft interval, boss
      period). Reroll cap deliberately not quoted: `SurvivalController.start` sets
      `rerolls = 99`, so `SURVIVAL_REROLL_CAP` is not the lived number (flagged in
      a comment, not changed).
- [x] `#survival-briefing` overlay in index.html + `_partials/survival-briefing.css`
      (own file — survival-mode.css was already at 926 lines)
- [x] `ui/_partials/survivalBriefingView.js` paints it; `SurvivalUI.showBriefing()`
      / `hideBriefing()` / `onBeginRun`, focus on the confirm button so Enter works
- [x] `SurvivalFlow`: `_openSurvivalBriefing()` / `_beginSurvivalWaves()`, new
      `survivalBriefing` phase added to the shared `SURVIVAL_PHASES` list
- [x] Re-readable mid-run: `pauseModel.lore()` prepends the briefing in the survival
      context; `PauseCollection` drops the count suffix for a card with no count
- [x] `tests/SurvivalBriefing.test.js` + briefing contract in `tests/SurvivalUI.test.js`
- [ ] Verify in browser: enter the arch → briefing reads correctly and nothing moves
      or damages you behind it → "Enter the tide" starts Wave 1 with pointer locked →
      Esc mid-run shows the briefing under the Lore tab → defeat → Retry shows it again

---
## Survival death cinematic (health hits zero)

Plan: addendum in `_partials/implementation_plan_survival_briefing.md`.

- [x] Reuse the campaign `FaintCutscene` verbatim; only new tunable is
      `SURVIVAL_FAINT.BLACK_HOLD` in config.js (Survival never wakes — no respawn)
- [x] `_showSurvivalDefeat` is async: hide HUD → `await _survivalFaint()` → ledger
      over the black, then `#faint` fades out from under the modal
- [x] New `survivalFaint` phase: in `SURVIVAL_PHASES`, driven by `_updateSurvival`,
      pausable + pointer-locked like the campaign's `faint`
- [x] `_restoreCameraAfterSurvivalFaint()` on both exits (retry, teardown)
- [x] `pauseModel`: every `survival*` phase resolves to the survival controls and
      the "Endless Memory" location
- [x] `tests/SurvivalDefeatCutscene.test.js`
- [x] BUG (found in testing): faded to black and the ledger never appeared. The
      awaited `faintCutscene.play()` never resolved because `survivalFaint` was a
      pausable pointer phase — a pointer-lock drop paused `animate()`, which is what
      drives the cutscene. Now: no awaits (loop-driven countdown +
      `_presentSurvivalDefeat`), pointer released once up front, `survivalFaint` out
      of `PAUSABLE_PHASES`/`POINTER_PHASES`, plus a wall-clock `setTimeout` net so
      the ledger appears even if the loop stalls.
- [ ] Re-verify in browser: die in Survival → view sinks and fades to black → short
      dark beat → ledger opens over the sunken arena → Retry and Return both give
      the view back (no frozen cutscene camera, no lingering black)

---

## Survival — mode title card

Plan: addendum in `_partials/implementation_plan_survival_title.md`.

- [x] `SURVIVAL_TITLE` block in config.js (~3.5s total, `SKIP_AFTER`, `SKIP_FADE`)
- [x] `#survival-title` markup + `_partials/survival-title.css` (black, z-index 45)
- [x] `src/ui/_partials/survivalTitleCard.js` — fade/hold/fade driver, Promise,
      skip after lockout; timing injected by SurvivalFlow (config.js imports
      `three`, which breaks UI unit tests)
- [x] `_openSurvivalBriefing` plays the card over the already-painted briefing;
      `showBriefing(false)` defers focus, `focusBriefingAction()` on resolve
- [x] Card swallows all input while up so nothing reaches "Enter the tide" behind it
- [x] `hideAll()` cancels it (retry / return get teardown for free)
- [ ] Re-verify in browser: walk into the arch → black card fades up with
      "Beyond the last memory / Endless Echoes" → "Click to skip" appears after a
      beat → card crossfades into the briefing → Enter the tide starts Wave 1;
      clicking early skips; retry from the ledger replays the card
