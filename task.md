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

# Task — Journey Objective & First-Time Guidance UI (2026-07-23)

## Objective

Add a museum-styled desktop guidance layer that always communicates the player's
current objective outside combat, collapses to a small status label during arena
combat, and teaches controls and Memory Lumina effects through short, non-pausing,
once-per-run notifications.

## Locked decisions

- [x] Show only the current objective, revealed as progression changes
- [x] Guide the full required loop: Rift challenge, Guardian defeat, scattered
      memories, Guardian Soul, museum return, and Final Memory
- [x] Keep optional activities and world-space navigation markers out of scope
- [x] Use short actionable copy with a story-led museum/archive voice
- [x] Show count plus progress bar where measurable
- [x] Collapse automatically to a small label during combat; no manual toggle
- [x] Reuse the existing combat HUD instead of duplicating waves, riddles, or boss HP
- [x] Animate objective changes without pausing gameplay
- [x] Add contextual first-time keyboard/mouse hints, one at a time, timeout dismissal
- [x] Explain each Lumina color briefly when its effect first applies
- [x] Reset objectives and tutorial-seen state on browser refresh
- [x] Target desktop only; mobile UI is not included

## Planning and implementation checklist

- [x] Trace museum, zone, arena, artifact, Soul, and Lumina state transitions
- [x] Inventory the affected UI states and current HUD ownership
- [x] Load the game UI pattern reference and record it in the plan
- [x] Write the scoped implementation plan
- [x] User review and approval of `implementation_plan.md`
- [x] Add semantic objective definitions and a focused guidance UI module
- [x] Add objective, collapsed-combat, and transient-toast markup/styles
- [x] Wire progression updates to existing authoritative game transitions
- [x] Wire once-per-run contextual control hints
- [x] Wire first-application Lumina explanations
- [x] Run syntax, DOM-reference, line-count, reduced-motion, and whitespace checks
- [ ] Manually verify desktop text fit, transitions, combat collapse, restart/faint
      behavior, all three Lumina explanations, and clean browser console (local
      server sandbox denied; escalated server permission declined)

---

# Task — Bring Enemy Direction Arrows Inward (2026-07-23)

## Objective

Move off-screen enemy direction arrows closer to the crosshair so they remain
readable during combat, without changing tracking or enemy visibility behavior.

## Checklist

- [x] Trace the threat-marker projection and edge-clamp path
- [x] Confirm the marker is controlled by the shared HUD configuration
- [x] Reduce the threat-marker clamp radius from `0.86` to `0.62`
- [x] Run syntax, focused behavior, line-count, and whitespace checks
- [ ] Manually verify arrow readability during browser combat

---

# Task — Artifact Origins & Lore Discovery Cards (2026-07-23)

## Objective

Rewrite all 27 artifact records as historically grounded Origin and Lore
descriptions, then update the discovery overlay to present both sections as one
cohesive, readable museum story.

## Checklist

- [x] Inspect `src/data.js`, `src/ui/DiscoveryScreen.js`, discovery markup/styles,
      and the collection/museum replay call path
- [x] Lock content direction with user: all zones, historically grounded, English
      with Filipino/Pangasinan terms, medium length, correct names where needed
- [x] Start MCP research with Philippine government and institutional sources
- [x] Write scoped implementation plan
- [x] User review and approval of `implementation_plan.md`
- [x] Complete and record source-backed research for all 27 entries
- [x] Replace `fact`/`note` with `origin`/`lore` in every artifact record
- [x] Update discovery markup, renderer, and responsive styling
- [x] Audit stale `fact`/`note` consumers and preserve API/museum behavior
- [x] Run syntax, reference, line-count, and whitespace checks
- [ ] Manually verify desktop/mobile discovery text fit and museum replay in browser
      (local server sandbox denied; escalated server permission declined)

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

Older task history: [_partials/task_archive.md](_partials/task_archive.md)
