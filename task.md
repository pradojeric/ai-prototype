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
- All changed source/UI files remain below 1000 lines; the pre-existing
  `src/audio/AudioManager.js` remains at 1006 lines
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

# Task — Arena 3 Seal Consoles (2026-07-26)

## Objective

Replace Arena 3's shoot-the-answer-node bugtong with the previous iteration's
overlay: press **E** on a console beside each gate, then click a choice on the
`#riddle` card. The tower sim keeps running underneath.

Plan: `_partials/implementation_plan_tower_riddle_console.md`

## Decisions (from user)

- Trigger: **press E on a new console mesh** — no proximity auto-start.
- Answering: **keyboard 1 / 2 / 3**; pointer stays locked throughout.
- While the card is up: **tide + gargoyles keep running**, player can still move and shoot.
- Wrong answer: **instant tide surge**; movement-slow penalty **removed**.
- Retry: **card stays up**, wrong choice struck out, no second E press.
- Scope: **Arena 3 only** — Arenas 1 and 2 keep shoot-the-node.

## Checklist

- [x] `config.js` — add `WRONG_TIDE_SURGE` / `CONSOLE_RANGE` / `CONSOLE_OFFSET`, drop `WRONG_SLOW*` + `GATE_CHOICE_GAP`
- [x] New `arena/_partials/TowerGateConsole.js` (pedestal + rune plate + glyph, no collider)
- [x] `RiddleScreen` — opt-in `keys` / `retryOnWrong` / `onWrong` options + `dismiss()`
- [x] `styles.css` — number-badge style for the answer buttons
- [x] `TowerGateManager` — consoles + overlay flow, drop AnswerNode/bolt scan/slow
- [x] `TowerArenaController` — `_tidePenalty` + `onTideSurge` hook, drop slow HUD
- [x] `Game.js` — pass `_ePressed` into `arena.update`
- [x] `index.html` — remove the dead `#tower-slow` row
- [x] `GamePause` — key-driven riddle must reclaim pointer lock on resume (soft-lock fix)
- [x] Verify: syntax/import check + grep for dead references
- [ ] User browser verify: all three seals, 1/2/3 select, tide surge on miss, retry in place

## Verify (measured)

- `node --check` passes on all 7 touched modules; all relative imports across
  `src/` resolve.
- Zero remaining references to `WRONG_SLOW`, `WRONG_SLOW_TIME`,
  `GATE_CHOICE_GAP`, `tower-slow`, `onSlow`, `slowRemaining`, `_renderSlow`,
  or `gate.nodes`.
- `AnswerNode.js` retained — still imported by `ArenaController` (Arena 1) and
  `LanternProjectile` (Arena 2).

## Deviations from plan

- **`GamePause` needed one change after all**, for the opposite reason to the
  original draft. Its `_phaseNeedsPointerLock()` already exempted an active
  `#riddle` card from reclaiming pointer lock on resume — correct for the old
  click-driven card, but it would have left a player who alt-tabbed mid-seal
  resuming unlocked and unable to move. `RiddleScreen` now marks the panel
  `.keys` in key mode and GamePause exempts only the click-driven card.

---

# Task — Guardian CC0 Texture Pass (2026-07-25)

## Objective

Texture all three Guardian bosses with CC0 PBR sets. They were the last major
set-piece meshes still on flat untextured `fadeMat`, and the encounter is the
closest the player ever gets to a large object.

## Decisions (from user)

- Scope: **all three** guardians in one pass.
- Assets: **reuse committed sets + download new CC0 ones** from ambientCG.
- Tinting: **multiply** — `mat.color` untouched, palette identity preserved.
- Emissive accents: **left untextured** (fog/distance readability anchor).

## Checklist

- [x] Download + downsample 5 CC0 sets (bamboo / wicker / clay / fabric / sponge, 512px, 1.4 MB)
- [x] Credit them in `assets/textures/CREDITS.md`
- [x] Add `src/core/guardians/_partials/GuardianTextureKit.js` (repeat-tier clone cache + `skin`)
- [x] Zone 1 Feastkeeper: rock / bamboo / wicker / clay
- [x] Zone 2 Reveler: sponge (detail-only) / marble / fabric
- [x] Zone 3 Keeper: rock / moss (detail-only) + split torso pottery onto a clay material
- [x] Verify: syntax + import check, `fadeMats` contract unchanged, no accent gained a map
- [ ] User browser verify: all three guardian encounters, fade-in, defeat scatter, beacon range

## Verify (measured)

- 11 materials textured across the 3 guardians; all 13 emissive/accent materials
  confirmed still flat (no `map`, `normalMap` or `roughnessMap`).
- `fadeMats` shape unchanged for Z1 (8) and Z2 (6); Z3 is 8 → 9 by the intended
  clay-pottery split.
- 13/13 kit unit checks pass against a stubbed three (tint preserved, opacity
  untouched, repeat on all three maps, tier cache hits, clones share one `Source`).
- 8 texture sets → 24 `load()` calls total, independent of how many repeat tiers
  or materials use them.
- Assets added: 1.4 MB (5 sets × 3 maps @ 512).

Plan: [_partials/implementation_plan_guardian_textures.md](_partials/implementation_plan_guardian_textures.md)

---

# Task — Zones 1–3 Layout Redesign + CC0 Asset Pass (2026-07-25)

## Objective

Improve the design and layout of the three submerged zones and pull free CC0 assets
onto them. The zones were the weakest-looking scenes in the game (flat untextured
colours, while the museum/ending already ran a CC0 PBR pipeline), zone 2 was a
coordinate-for-coordinate clone of zone 1's floor plan, and ~940 draw calls per zone
went on the mangrove ring alone.

## Decisions (from user)

- Scope: **both** layout redesign and asset/material work.
- Assets: **download new CC0 sets** from ambientCG and reuse the committed ones.
- Zone 2: **new floor plan, same anchors** (dock / riftSpot / guardianStart unchanged).
- Performance target: **must run on low-end/mobile** — budget conservatively.

## Checklist

- [x] Verify ambientCG reachability; measure the baseline draw-call budget per zone
- [x] Download + downsample 3 CC0 sets (silt / rust / moss, 512px, 764 KB) and credit them
- [x] Add `src/core/_partials/TextureKit.js` — module-level cached loader + UV tilers
- [x] Wire textures into `World._materials` AFTER the palette merge (tint preserved)
- [x] Bake tiling UVs in `_building` / `_tower` / `_ruinArch` / seabed
- [x] Batch the mangrove ring, stalls, rubble and tower fields into InstancedMeshes
- [x] Add `src/core/zones/_partials/zoneKit.js` (perimeter, overlook, hall shell, cradles, hulls, dais, footbridge)
- [x] Zone 1: asymmetric stall rows, Kanal Alley + footbridge, alley catwalk, warehouse mezzanine
- [x] Zone 2: processional ring plaza, curved parade arc, SW float graveyard, distinct perimeter
- [x] Zone 3: tightening colonnade rhythm, climbable collapsed vault, nave inlay, real transept shells
- [x] Analytic water ripple normal + fresnel/sheen; silt seabed
- [x] Split festival dressing into `_partials/FestivalDressing.js` (World.js was at 1030 lines)
- [x] Verify: headless build of all 7 zones, reachability audit, 5400-placement stress test, texture-cache swap test
- [ ] User browser verify: all three zones, the new climbable routes, guardian encounters, arena entry, museum + ending regression

## Verify (measured)

- Draw calls per zone: zone1 **1334 → 344**, zone2 **1558 → 657**, zone3 **1362 → 361**.
- Every spawn/rift/guardian point is collision-free and flood-fill reachable from the dock.
- 5400 real `ArtifactManager` placements across 3 zones: 0 in-collider, 0 unreachable.
- Shared textures load once (21 `load()` calls) and survive repeated `World.dispose()`.
- Per-zone palette tints preserved (zone2 concrete `#3a3128`, zone3 `#46525f`).

# Task — Museum "Aking Museo" Visual Upgrade (CC0 assets) (2026-07-25)
## Objective

Improve the digital museum's look by pulling free CC0 assets from the internet and
applying them to `src/museum/Museum.js`, WITHOUT breaking the dark-intro /
bright-hub dual-palette mood.

## Decisions (from user)

- Asset types: **PBR wall/floor textures + HDRI environment map + decorative textures**.
- Delivery: **download into repo `assets/`** (offline-safe; matches existing convention).
- Scope: **preserve current mood** (color tint stays the intro→hub brightness driver).

## Plan

`_partials/implementation_plan_museum_assets.md`

## Checklist

- [x] Download CC0 texture sets — ambientCG Marble018 (floor), Plaster003 (walls),
      Tiles101 (ceiling) → `assets/textures/{marble,gallery-wall,marble-tiles}/`
- [x] Download neutral studio HDRI — Poly Haven studio_small_09 (1K) → `assets/hdri/gallery_1k.hdr`
- [x] Museum.js `_loadTextures()` + `_tilePlane()`: bind map/normalMap/roughnessMap to
      floor/wall/ceil materials with baked per-plane UV tiling; `.color` tints untouched
- [x] Museum.js `_loadEnvironment()`: HDRI as `scene.environment` in hub only (intro clears it);
      `envMapIntensity = 0.4` keeps IBL subtle regardless of three version
- [x] Update `assets/textures/CREDITS.md` (museum textures + HDRI + Poly Haven CC0 note)
- [x] Dispose the env texture in `dispose()`; texture sets tracked in `_texs`
- [x] Static verify: `node --check` OK, Museum.js 898 lines (< 1000), assets on disk
- [ ] User in-browser verify (no Playwright — see memory): intro still dark/moody;
      hub floor reads as marble, walls plaster, ceiling tiled; soft reflections on
      floor + metal frames; no bloom wash-out; console clean

### Follow-up — reduce hub bloom + light (2026-07-25)

- [x] `config.js`: `MUSEUM.BLOOM` (0.35 / 0.5 / 0.5) — gentler than the gameplay
      default (0.8 / 0.6 / 0.2); hub has no string-glow to protect
- [x] `Game.js`: `_enterMuseum` stashes gameplay bloom + applies `MUSEUM.BLOOM`;
      `_enterZoneFromHub` restores it (zones keep their signature glow untouched)
- [x] `Museum.js` `_hubLights`: ambient 0.75→0.55, hemi 0.65→0.5, key 0.7→0.55,
      picture-bulb emissive 1.4→0.9, hanging PointLights 1.6→1.1
- [x] Static verify: `node --check` OK on all three; files < 1000 lines

---

# Task — Restored-Zones CC0 PBR Textures (v4) (2026-07-24)

## Objective

Improve detail by pulling free assets from the internet and applying them to the
restored-zone ending diorama.

## Decisions (from user)

- Asset type: **PBR surface textures** only.
- Scope: **ending diorama only**.
- License/storage: **CC0 only, downloaded into the repo** (offline-safe).

## What was done

- Downloaded 7 CC0 texture sets from **ambientCG** (Bricks075A, PaintedPlaster001,
  PavingStones037, Grass004, RoofingTiles004, Planks011, Rock030), 1K JPG,
  color + NormalGL + roughness → `assets/textures/<name>/` (26 MB). CREDITS.md added.
- RestoredKit `_loadTextures()`: binds map/normalMap/roughnessMap to materials
  (brick, plaster→walls/capitol/limestone/lighthouse, paving→street/stone,
  grass, roof, wood, rock→islets); sets `color=white`, `roughness=1`.
- Per-material `userData.tile` (world units per repeat) + UV-tiling baked into
  box/cyl/cone/sphere/dome/plane geometries so texel density is consistent on
  surfaces of very different sizes (shared texture, repeat=1).
- dispose() also frees the textures.

## Notes / follow-ups

- RestoredProvince is built in the Game constructor, so the 26 MB loads at page
  start (async, non-blocking; instant on localhost, bandwidth cost on real host).
  Could lazy-load if that matters.
- Extrude pediments + torus (arch lintel, vault ribs) aren't UV-tiled — minor
  stretch on small parts; dominant surfaces are tiled.

## Verify

- [x] 21 textures serve 200; all 5 JS files `node --check` OK, <1000 lines.
- [ ] User in-browser verify of textured surfaces + texel density.

---

# Task — Restored-Zones Architectural Fidelity Pass (v3) (2026-07-24)

## Objective

Improve the restored-zone STRUCTURES and LAYOUT with recognizable real
Pangasinan landmarks (research via web/MCP + threejs AAA-graphics skill).

## Decisions (from user)

- Focus: **architectural fidelity** + **layout & composition** (not glow/props-density).
- Fidelity: **recognizable real landmarks**.
- Budget: **generous** (one-time cutscene, disposed after).

## Research (WebSearch/WebFetch) → applied

- **Cape Bolinao Lighthouse** (1905): WHITE tapered stone tower (30.78 m) on a
  rocky headland, keeper's house + gallery + lantern room. → Zone 3 (fixed: was
  wrongly red-striped; now white on a headland).
- **St. John Cathedral, Dagupan**: Spanish, brick + buttresses, SINGLE side
  belfry (not twin). → Zone 3 cathedral facade rebuilt to match.
- **Zone 3 artifacts = 7 real landmarks** (data.js): Manaoag Basilica (twin
  towers + dome), Provincial Capitol (neoclassical colonnade + dome), Bolinao
  lighthouse, Hundred Islands, Casa Real/Banáan. → added as a landmark skyline
  revealed in the finale wide lift.
- **Dagupan bangus (milkfish) capital / Pantal**: → Zone 1 market hall + riverside
  bamboo fish pens (kasilayan) + bangus baskets.
- **Bangus Festival "Gilon-gilon ed Dalan"**: giant milkfish float, bamboo arko.
  → Zone 2 giant bangus float + bamboo festival arches.

## Changes

- RestoredKit: + cyl/cone/sphere/dome/pediment/columnRow primitives and
  brick/capitolStone/verdigris/lightWhite/bamboo/bangus/isletRock/water materials.
- Zone 1: Public Market Hall (W anchor), Pantal riverside + bamboo fish pens,
  bangus baskets, cleaner avenue→tower composition.
- Zone 2: giant milkfish float (centre), bamboo festival arches framing the pan.
- Zone 3: St. John cathedral facade (buttresses + single belfry) + landmark
  skyline (Manaoag basilica, Provincial Capitol, white Bolinao lighthouse,
  Hundred Islands, Casa Real); finale lift reveals the whole skyline.

## Asset-sourcing note (AAA skill gate)

Procedural-only is the final answer here: the project is a no-build, no-bundler
vanilla-ESM app with no GLTF loader or asset hosting (CLAUDE.md), and repo memory
forbids adding a heavy asset/browser pipeline — a real blocker for the 3D/image
generators. Fidelity achieved via authored procedural forms (silhouette-first).

## Verify

- [x] Syntax (`node --check`) all 5 files; all <1000 lines; server serves them.
- [x] Every `kit.*` member used by builders is defined.
- [ ] User in-browser verify of landmark recognizability + per-zone framing.

---

# Task — Restored-Zones Ending Montage (v2) (2026-07-24)

## Objective

Rework the ending (`src/cutscene/RestoredProvince.js`) into three **literally
separate** restored-zone dioramas — faithful, restored recreations of the real
zone layouts (zone1–zone3) — shown one at a time with slow camera pans on each,
NOT tiled onto one shared plane. No human figures.

## Decisions (from user)

- Arrangement: **three separate zones, not on one plane** — shown one at a time.
- Fidelity: **faithful districts + terminus landmark** per real zone.
- Duration: **keep ~31s** total (ENDING.RESTORED_DURATION); subtitles already map.
- Strings (Hibla): **kept, fading out** toward the finale.
- People: none (replaced by lanterns / banners / drifting light "motes").

## Architecture (split for the 1000-line rule)

- `_partials/RestoredKit.js` — shared materials, mesh primitives, animation registries.
- `_partials/restoredZone1.js` — PONSIA market (avenue+stalls, Memories Alley,
  Fish Warehouse, Boatyard, Auction Square + whole bell-mast tower).
- `_partials/restoredZone2.js` — LIKET festival (gong circle, parade stalls,
  lantern/bunting canopy, Dancing Hall, Float Graveyard, Bandstand + parul mast).
- `_partials/restoredZone3.js` — PANANISIA cathedral (narthex, nave colonnade +
  vault ribs, transepts, altar/apse, whole bell-tower, memory strings).
- `RestoredProvince.js` — slim driver: 3 groups, one visible at a time, per-zone
  camera keys, black-dip cuts at zone boundaries, subtitles, shared animation.

## Timeline (keyed to ENDING.SUBTITLES)

- Zone 1: 0–11s  (intro + food cue) — 2 slow pans up the market to the tower.
- Zone 2: 11–17.5s (festival cue)    — 1 slow rise up the avenue to the parul star.
- Zone 3: 17.5–31s (landmark + strings-fade) — pan up the nave + closing wide lift.
- Cuts at t=11 and t=17.5 hidden by a ~0.55s full-screen black dip.

## Checklist

- [x] RestoredKit primitives + animation registries.
- [x] Zone 1 / 2 / 3 faithful restored builders.
- [x] Driver: separate groups, one-visible-at-a-time, per-zone pans, black-dip cuts.
- [x] Hibla strings per zone, fading at the finale; motes replace people.
- [x] Syntax check (`node --check`) all 5 files, all <1000 lines; server serves them.
- [ ] User in-browser verify of the montage + per-zone framing.

---

# Task — Per-Run World Seed for Non-Duplicating Riddles (2026-07-24)

## Objective

Add a per-run world seed so each zone's arena draws a distinct, non-overlapping
set of bugtong (riddles), deterministic across retries, with no riddle repeating
across zone1/zone2/zone3 arenas in a single playthrough.

## Decisions (from user)

- Seed source: **fresh random per run** (page load).
- Retry behavior: **different riddles each retry** (rotates a fresh window
  through the zone's own block; revised from the initial "same riddles" answer).
- Dedup scope: **no duplicates across all zones** (hard guarantee via disjoint
  per-zone blocks).

## Checklist

- [x] Inspect riddle pool, `drawRiddles`, and all three arena draw sites
- [x] Confirm arena→controller mapping and reservation counts
- [x] Add `WORLD_SEED` (fresh-per-run) to `config.js`
- [x] Add central `riddlesForZone(zoneId)` allocator to `data/riddles.js`
- [x] Wire ArenaController (arena1) to the allocator via its zone id
- [x] Wire RailArenaController (arena2) to the allocator
- [x] Wire TowerGateManager (arena3) to the allocator
- [x] Static sanity check (node syntax + allocation disjointness/stability)

---

# Task — Rewrite STRINGS Game Design Document (2026-07-24)

## Objective

Read the complete repository and rewrite `STRINGS_GDD.md` so it is an accurate,
cohesive design source of truth for the game that is currently implemented.

## Checklist

- [x] Load the applicable game-design documentation workflow
- [x] Inventory repository files and identify existing design documents
- [x] Write the focused implementation plan
- [x] User review and approval of `implementation_plan.md`
- [x] Read every authored source, markup, style, data, test, and design file
- [x] Build a traceability ledger from player-facing claims to code ownership
- [x] Reconcile current mechanics, progression, narrative, arenas, content, UI,
      audio, controls, technical constraints, and external platform integration
- [x] Rewrite `STRINGS_GDD.md`
- [x] Audit the rewritten GDD against the complete repository
- [x] Run Markdown, line-count, stale-claim, link, and whitespace checks

---

# Task — Multiline Riddle Readability (2026-07-23)

## Objective

Widen the shared riddle banner and replace compressed single-line answer labels
with fixed-size, centered, maximum-three-line panels across all arenas.

## Checklist

- [x] Trace the shared banner and answer-label paths across Arenas 1–3
- [x] Lock banner width, wrapping, line count, alignment, tower spacing, and desktop scope
- [x] Write the focused implementation plan
- [x] User review and approval of the riddle readability plan
- [x] Implement and test shared multiline canvas layout
- [x] Apply dynamic label aspect sizing to nodes and lanterns
- [x] Spread Tower seal choices without label scaling
- [x] Widen and audit the riddle banner
- [x] Run static and mocked verification
- [ ] Manually verify longest text in all three arenas (local server permission
      remains unavailable)

Plan: `_partials/implementation_plan_riddle_readability.md`

---

# Task — Remove Superseded Exploration HUD (2026-07-23)

## Objective

Remove the legacy Rift hint and artifact counter now represented by the Journey
panel, while preserving interaction prompts and all combat/status UI.

## Checklist

- [x] Confirm legacy ownership and replacement coverage
- [x] Remove legacy markup and CSS
- [x] Remove obsolete DOM bindings and visibility calls
- [x] Run syntax, stale-reference, line-count, test, and whitespace checks
- [ ] Manually verify the Journey panel remains readable in browser (local
      server permission remains unavailable)

---

# Task — Fix Arena 2 rail look tumbling upside down

The boat sway wrote roll onto the player camera, which corrupted
PointerLockControls' YXZ read-back of yaw/pitch and let the view spin past
vertical.

## Checklist

- [x] Trace the roll write (`RailScenery.update`) and PointerLockControls' per-
      mousemove quaternion round-trip
- [x] Adopt `YXZ` rotation order on the player camera for the rail arena so roll
      survives the round-trip losslessly (keeps the sway unchanged)
- [x] Add a rail aim cone: pitch via PointerLockControls' polar limits, yaw via a
      new `PlayerController.setYawLimit` — the bangka faces forward, no looking
      back over the stern
- [x] Restore rotation order, polar limits, and free yaw in `RailScenery.dispose`
- [x] Syntax check touched files

## Follow-up — Arena 2 lateral boat drift

- [x] Seeded value-noise wander (`RAIL_ARENA.DRIFT_*`): +/-0.6 m off centre,
      slide only (no yaw), running continuously through the encounter
- [x] Drift the boat and the player together; keep `movementAnchor` in sync
- [x] Widen the aim cone to ~70 deg so the drift never fights the clamp
- [x] Verify the curve numerically (starts centred, ~0.54 m peak, ~0.44 m/s max)
- [ ] Manually verify in browser: enter Arena 2, sweep the mouse hard in circles,
      confirm the horizon stays upright, the aim cone stops you facing the stern,
      and the drift reads as current rather than steering

---

---

# Task — Arena 2 Reveler: three new attack patterns

Plan: [_partials/implementation_plan_reveler_patterns.md](_partials/implementation_plan_reveler_patterns.md)

## Checklist

- [x] Refactor `RevelerBoss._act` into a `_pattern` mutual-exclusion scheduler
      (Feastkeeper shape); fold the existing orb formation in as a scheduled entry
- [x] `_partials/ShellRotation.js` — closing petal shell with one orbiting gap,
      shell hits route through the existing `pingArmored()`, gap hits deal 2x
- [x] `_partials/ScatterHex.js` — pooled spray of 1-HP hexes scattered across the
      view, staggered inward drift, 5 damage on reaching the boat
- [x] `_partials/OverloadChannel.js` — 10 coral nodes at 6-8 HP each, diegetic
      charge ring as the timer (`setDrawRange` radial fill), clear-all cancels into
      a 3s stagger, expiry fires the beam for 35
- [x] Suspend summons for the whole Overload Channel; redraw the summon timer on
      channel end so no backlog dumps at once
- [x] Gate anchor-hop DECISIONS on the pattern guard while letting a slide already
      in flight finish (that is what lets the overload's move to centre resolve)
- [x] Drop the now-dead `RevelerProjectilePool.formationLocked` getter
- [x] Confirm every partial disposes its meshes (boss is rebuilt on faint-restart)
- [x] Syntax, import-resolution, line-count, and whitespace checks on touched files
- [ ] Manually verify in browser: each pattern fires, only one at a time, summons
      visibly stop during the channel, and 10 nodes are clearable inside the timer

## Tuning decisions made during implementation

- `OVERLOAD.DURATION: [22, 20, 18]`, not 15s. `BOLT.COOLDOWN` 0.22 (~4.55
  shots/sec) x `BOLT.DAMAGE` 1 means 10 nodes at 6-8 HP is ~70 bolts ~= 15.4s of
  perfect uninterrupted fire — a 15s channel is unclearable by arithmetic. Drop
  `NODE_COUNT` to 6 if the 15s feel is wanted instead.
- `SHELL.GAP_MULT: 2`, down from the 1.5x in the plan and from a first pass at 4.
  The chest is unreachable while the shell is closed, so x1 is a pure tax and x4
  eclipsed the reflected-orb route (the fight's intended damage source) outright.
- Shell hit test scales with the iris animation, and unintercepted bolts fall
  through to the normal chest test — otherwise the ~0.55s of opening/closing is a
  dead zone where the plate is visually small but blocking at full size.
- No boss spit during Shell Rotation: `RailCombatManager`'s spit-vs-player path
  hardcodes `SNIPER.DAMAGE` and assumes a `source` threat for reflection, so a
  boss-owned spit would need changes to shared combat code. Live adds already
  supply the pressure.

## Presenter skip (Shift + P) — live-demo fast-forward

Plan: [_partials/implementation_plan_presenter_skip.md](_partials/implementation_plan_presenter_skip.md)

- [x] `CONFIG`/`PRESENTER` block in `src/config.js` (`ENABLED`, `KEY`, `SHIFT`, `COOLDOWN`)
- [x] `src/core/_partials/PresenterSkip.js` — keybind wiring + context-aware dispatch
      installed onto `Game.prototype`
- [x] Intro cutscene skip (reuses the existing `IntroCutscene.skip`)
- [x] `GuardianIntroCutscene.skip()` — winds the timeline out so `play()` resolves
      normally (camera restore + `arena.begin` still run)
- [x] `presenterSkipToBoss()` on all three arena controllers — a press inside an
      arena cuts the armor phase (waves, bugtong rounds, tower ascent) and hands
      over to the boss, still fully playable; only once the boss is up does a
      press end the encounter
- [x] `presenterWin()` on `ArenaController`, `RailArenaController`,
      `TowerArenaController` — real teardown + `arena.won`, so the loop plays the
      usual collapse and `_returnFromArena()` scatter
- [x] `TowerGateManager.presenterAbort()` — dismiss a live seal-console riddle card
- [x] `GuardianSoul.forceCollect()` — bank the Soul through its normal callback
- [x] `RiddleScreen.autoSolve()` — resolve a live card as correct
- [x] `_presenterClearZone()` — bank every memory + the Soul, then `_zoneComplete()`
      (works either side of the arena; unlocks the next museum portal as usual)
- [x] Completion card: Shift+P walks on into the hub
- [ ] **Needs in-browser verification** (no automated harness in this repo)

---

## Keeper of Memories — attack pattern pass

Plan: [_partials/implementation_plan_keeper_attack_tuning.md](_partials/implementation_plan_keeper_attack_tuning.md)

- [x] `CHARGE_SPEED` 13.5 → 19 — the dash commits faster; telegraph, interval and
      recovery/stun windows deliberately untouched so the dodge window and whiff
      punish are unchanged
- [x] New `beam-approach` state before `beam-telegraph`: the Keeper walks to
      `(0, 0)` at `BEAM_APPROACH_SPEED` (9 u/s, ≤0.76s) so the lighthouse sweep
      pivots on the arena centre
- [x] `_startBeamApproach()` bail-out timer — an interrupted walk still commits to
      the sweep rather than stalling the fight
- [x] Keeper stays at centre after the sweep; shots/charges resume from there
- [x] `blocksPlayerAt()` also non-blocking during `beam-approach`, so a player on
      the centre can't be pinned inside the walking body
- [x] `BEAM_CLEARANCE: 0.55` — the sweep is jumpable, same value as the
      Feastkeeper's Offering Slam so the Zone 1 jump-dodge transfers (~0.43s
      window against the ~0.80m hop); `_playerInBeam()` gates on `jumpOffset`
- [x] Sweep speed/width untouched — footwork stays a valid answer, the jump is
      the cornered-or-caught-out option
- [x] Laser rework: each arm is a deck scorch line **plus** a vertical shader
      blade whose height *is* the hit volume, so the attack looks jumpable
- [x] `_partials/LighthouseBeamMaterial.js` — local-space `ShaderMaterial`: hot
      scrolling core at the deck, soft body falloff, crisp rim at the clearance
      line, slower counter-pulse so the scroll isn't one repeating stripe
- [x] `_setBeamIntensity()` drives scorch opacity + blade `uOpacity` together;
      existing telegraph ramp unchanged. `uTime` resets per sweep
- [x] Beam reach fixed to the 9m deck (`bounds.radius`) instead of 13.6m, which
      hung the beam out over the void; hit cut-off uses the same `_beamReach`
- [x] Guardian intro: hide the ViewModel for the cinematic — the hand is a child
      of the player camera, which stays in the scene, so it drew as a floating
      limb at the player's staged position (affected all three zones, not just
      the Keeper)
- [x] `Game._faceCamera(target)` — yaw onto a world position, pitch/roll levelled;
      replaces the `_levelCamera()` call in `_runGuardianIntroduction` and runs
      after `begin()` so it reads the live `arena.guardianCenter()`
- [x] Instant snap, hidden by the same-frame `renderPass.camera` swap back to the
      player camera; no input lock needed
- [x] Attack callouts matching the other two bosses: `BEACON CHARGE`,
      `MEMORY STONES`, `LIGHTHOUSE SWEEP` via `combat.hud.popupCallout`, fired at
      pattern start; the basic shot stays silent as `spit`/`formation` do
- [x] Sweep is called out on the walk, before the already-centred shortcut, so
      that path is never silent and the attack announces exactly once
- [x] The three replaced `onEvent` log lines dropped; the charge-miss stun and
      phase-change lines stay (outcomes, not attack announcements)
- [ ] **Needs in-browser verification** (no automated harness in this repo) —
      shader compile, blade height readability, charge dodgeability at 19 u/s,
      no hand in any boss intro, control returning aimed at each boss, and the
      three callouts firing once each at the right beat

---

Older task history: [_partials/task_archive.md](_partials/task_archive.md)
