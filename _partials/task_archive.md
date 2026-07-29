# Task Archive — completed checklists

Split out of `task.md` to keep it under the 1000-line limit. Everything here is
finished work kept for reference; see `task.md` for current and recent tasks.

# Task — Zone 1 (PONSIA) Prototype

## Objective
Playable browser prototype proving the full Zone 1 core loop, single-file (CDN importmap), placeholder visuals, mock API data.

## Checklist
- [x] Read GDD, confirm scope with user
- [x] Scaffold `index.html` with Three.js importmap + start screen (pointer lock)
- [x] Atmosphere: FogExp2, water plane, sediment particles, lighting
- [x] PONSIA blockout (floor, stalls, hanging signs, bangkâ)
- [x] PlayerController: WASD + mouse look, wade speed, head bob + breathing sway
- [x] StringSystem: CatmullRom strings per artifact, animated drift, distance-driven count/opacity
- [x] ArtifactManager: 3 artifacts, per-session placement, proximity + interact (E)
- [x] DiscoveryScreen: fade-to-white modal, mock historical card, "Saved to Aking Museo"
- [x] HUD: artifact counter (x/3)
- [x] AudioManager: procedural string hum near artifact (no asset files)
- [x] Zone-complete state when 3/3 found

## Environment Pass (modular refactor + bigger zone)
- [x] Refactor single index.html → ES modules (`src/`, mirrors GDD architecture); index.html now a thin shell
- [x] Scale zone to ~96×96 m (`ZONE_HALF=48`), fog tuned to 0.03, larger floor/particles
- [x] Collision registry in `World` (circle-vs-AABB) + axis-separated SLIDE in PlayerController
- [x] Terrain: undulating seabed, rubble mounds, elevated slabs
- [x] Varied/broken/tilted stalls + central covered market hall landmark
- [x] Floating debris (crates/baskets/planks/fruit/nets) bobbing; large pieces solid
- [x] Enclosing perimeter building facades with window insets (solid boundary)
- [x] Re-seeded spawn nodes from real features; artifacts nudged clear of colliders
- [x] Static verify: all modules pass ES-module syntax check, serve 200, each < 1000 lines
- [ ] User in-browser verify: collisions slide, realism present, loop + 3/3 intact

## Map Redesign Pass (match reference district map)
Reference: top-down "PONSIA District — The Flooded Memories" map.
Decisions: match layout closely · no carved channel (open lanes only) · keep seeded
random artifacts · keep south spawn (0,36). Orientation: map-N → -Z (far).
- [x] Memories Alley — dense small-building cluster w/ alleys (west, -X)
- [x] The Silent Auction Square — open plaza, dais, ring of short columns (center-north)
- [x] Ruined Fish Warehouse — large ruined shell landmark, open interior (center-right north)
- [x] Lost Boatyard — scattered bangkâs, A-frame cradles, shed (east, +X)
- [x] The Drowning Stalls — diagonal market rows (center)
- [x] Foggy Overlook — raised platform breaking the waterline (southeast)
- [x] Player Dock — planks + mooring posts + anchor at spawn (south, 0,36)
- [x] Perimeter facades bounding the edges (gaps for lanes + dock)
- [x] Re-anchor spawn nodes to the new districts; keep per-session jitter
- [x] Static verify: ES-module syntax OK, serves 200, World.js 470 lines
- [ ] User in-browser verify: districts read like the map, loop + 3/3 intact

## Level-Design Overhaul Pass (spine + landmarks + atmosphere)
Goals: navigation/legibility · exploration pacing · guardian encounter flow · atmosphere.
Restructure districts; engine changes to World.js allowed.
- [x] Add `_tower`, `_ruinArch`, `_lightShaft` primitives to World.js (+ shaft shimmer hook)
- [x] Restructure zone1.js around a central N-S avenue + terminal landmark
- [x] Re-route Drowning Stalls to line the avenue
- [x] Promote Auction Square with tower + arch gateway
- [x] Add ruin-arch gateways to district entrances; light shafts over landmarks
- [x] Rewrite setSpawnNodes() for spread + avenue sightline
- [x] Fix build() call order (RNG determinism); syntax-checked, both files < 1000 lines
- [ ] User in-browser verify: legibility, encounter, scatter, collision, atmosphere

## Multi-Zone Loop Pass (hub-and-spoke + placeholder Zones 2 & 3)
Goal: complete the game loop across three zones via the museum hub. Decisions (user):
hub-and-spoke · sequential unlock · NO reload (completed zones stay re-enterable,
free-roam hub) · bare-minimum placeholder zones · distinct guardian per zone.
- [x] `zones/zone2.js`, `zones/zone3.js` — bare arenas (dock + mangrove ring + a few
      cover boxes + debris), distinct bg/fog/seed, spawn nodes for every artifact tag
- [x] `guardians/zone2Guardian.js` (amber-green spire-wisp), `zone3Guardian.js`
      (violet-blue many-eyed mound) — distinct silhouettes, shared builder contract
- [x] Register zones in `zones/index.js`, builders in `guardians/index.js`
- [x] `Museum.js` — per-portal barrier Group + panel mat + corridor entry point;
      `unlockPortal(zone)`; generalized panel breathing; `setHallLit` via `hallPortal`
- [x] `World.dispose()` — lightweight scene teardown for zone swaps
- [x] `Game.js` — `_loadZone(id)` (rebuild world/guardian/artifacts, re-wire physics,
      reset state, spawn on dock), `_enterZoneFromHub` (white-flash swap),
      `_startGameplayPhase` (start when already pointer-locked from the hub),
      `_zoneComplete` marks done + unlocks next, museum loop enters zone per portal;
      removed reload-to-title `_exitToTitle`
- [x] Static verify: `node --check` passes all touched/new modules
- [ ] User in-browser verify: Z1→hub(Z2 open)→Z2→hub(Z3 open)→Z3→hub all open;
      re-enter a finished zone; locked corridors stay sealed; console clean over swaps

## Artifact "Echo" audio locator + procedural theme music
Goal: a sound emitted from each artifact, audible from a WIDER area than the string
(~28m vs the line's ~13m), that helps the player locate it by ear and makes the
theme music swell on approach. Decisions (user): procedural Web Audio (no assets) ·
detectable farther out than the string · music swells near the echo.
- [x] `config.js` — `ECHO` (RANGE/REF_DIST/PING_INTERVAL/GAIN) + `MUSIC_SWELL_RANGE`
- [x] `audio/EchoVoice.js` (new) — per-artifact spatialized PannerNode (HRTF, inverse
      distance, maxDistance=ECHO.RANGE) emitting a phased pentatonic bell ping
- [x] `audio/AudioManager.js` — master bus + feedback-delay echo tail; ambient drone
      bed (LFO-swept lowpass); sparse pentatonic melody (swell target); camera-driven
      AudioListener; `addEcho/removeEcho/clearEchoes`, `setSwell`, `updateListener`;
      kept the original string hum/`setProximity`
- [x] `Game.js` — register echoes on scatter, `removeEcho` on collect, `clearEchoes`
      on zone reload, `updateListener`+`setSwell` each playing frame
- [x] Static verify: `node --check` passes all touched/new modules
- [ ] User in-browser verify: defeat guardian → echoes ping from beyond the string &
      pan with the camera; approach swells the music; collect silences that echo;
      zone reload leaves no stuck pings

## Module layout
- `index.html` — shell (HTML/CSS/importmap) → `src/main.js`
- `src/config.js`, `src/data.js` — config/utils, artifact data + mock API
- `src/core/` — World, StringSystem, ArtifactManager, PlayerController, Game
- `src/audio/AudioManager.js`, `src/ui/DiscoveryScreen.js`

## Decisions (from user)
- Scope: Core loop · Setup: CDN importmap (now multi-file ES modules over http) · API: Mock local
- Visuals: Placeholder primitives · Zone: ~2× · Collisions: props+walls (slide) · Assets: procedural only

## Perimeter Spawns Redesign (2026-07-04)
- [x] Game.js: `_pickSpawn()` + `_spawnPlayer()` (random per run via Math.random; legacy dock fallback for zones 2/3/debug); wired into intro, zone load, and faint respawn
- [x] World.js: `_mangroveArc`, `_bambooPole`, `_poleWall`, `_bambooTunnel` primitives; `_debris` accepts multiple `clears` discs
- [x] zone1.js rewrite: central hub (tower h26 + dais + 4 gate arches), Vendor Avenues (S), Sunken Kitchens (N), Bangus Pens serpentine maze (E), Bumbong Overpass tunnels (W), 4 rim spawn pockets, fog eased to 0.024 for landmark legibility
- [x] Spawn nodes rebalanced: 1 easy open_water node per spawn exit + harder clusters (stove backs, tunnel interiors, maze dead-ends)
- [x] Static verify: ES-module syntax check passes; zone1 349 lines, World 597 lines
- [ ] User in-browser verify: all 4 spawns face the tower, maze solvable, tunnels walkable, faint respawn re-picks

## Museum Hub Expansion — 36 zone-grouped frames via side wings (2026-07-04)
- [x] config.js: `MUSEUM.WING` (DOOR_HALF/DOOR_Z/LEN/HALF_W) + `SLOTS_PER_ZONE: 12`
- [x] data.js: `zone: 1` field on all 10 ARTIFACT_DATA entries
- [x] Game.js: `_collectedArtifacts()` now returns a per-zone map `{ 1:[...], ... }` (zone origin preserved for grouped hanging)
- [x] Museum.js: ±X walls split around new wing doorways (`_sideWall`); two wing galleries (`_wings`/`_wing`, Zone 2 = -X, Zone 3 = +X) with shell, 12 frames each, lintel zone signs; main room re-laid as Zone 1's 12 frames; `slotsByZone` index; `populate(byZone)` + `_setSlot` (replaces `setArtifact`); wing walkability in `collidesAt`; `unlockPortal` also reveals the wing sign; hub hanging bulbs extended into wings
- [x] IntroCutscene.js: zero changes (spawn/hallway points + ROOM_HALF untouched)
- [x] Static verify: `node --check` passes all touched files
- [ ] User in-browser verify: intro plays clean, wings walkable w/ collision, collected Zone-1 art hangs in the main room, empty wing frames lit under hub lighting
- Perf watch-point: hub picture lights are per-slot SpotLights (now 36) — if the hub frame-rate dips, consolidate to per-wall spots

## Museum Hub Perf Fix (2026-07-04)
- [x] Museum.js `_hubLights`: removed the 36 per-slot picture SpotLights (forward renderer shades every light per fragment — this was the lag); gallery now lit by ambient+hemi+key fill and the 8 distance-limited hanging PointLights; picture bulbs kept as one cosmetic emissive InstancedMesh (1 draw call, zero lights)
- [x] Museum.js `_addSlot`: frame/interior material+geometry shared across all 36 slots (was 72 duplicate mats + 72 geos)
- [x] Museum.js `_setSlot`/`clear`: shared pooled art-plane geometry; clear() now frees only the per-slot material/texture; dispose() frees the bulb instance buffer
- [x] Static verify: node --check passes
- [ ] User in-browser verify: hub frame-rate smooth; frames/bulbs look right under hub lighting; art hangs/clears without errors

## Zone 2 Redesign — LIKET (Festival Zone) (2026-07-04)
Goal: replace the bare zone2 placeholder with a real district map for the theme
"an underwater festival frozen in time — colorful banners drift with the
current, lanterns glow, echoes of music and dancing fill submerged plazas."
Reuses zone1's proven spine layout/collision footprints; all-new dressing on top.
Decisions (user): map + a zone-aware artifact filter fix, no new zone-2 artifact
content authored this pass (data.js/zone2Guardian.js untouched).
- [x] World.js: new festival primitives — `_sagLine` (internal sagging-rope
      helper), `_lantern` (glowing paper lantern, no THREE.Light — additive
      glow geometry + bloom), `_lanternString`, `_lanternCluster`, `_bunting`
      (pennant garland, cloth only, no glow), `_parulMast` (zone-2 terminus
      landmark: mast + giant glowing star lantern + radiating lantern guy-lines).
      Motion reuses the existing `debris`(bob/spin)/`shafts`(breathing opacity)
      update loops — no new per-frame loop added.
- [x] zone2.js full rewrite: Gong Circle (W), Bandstand Plaza + Parul Mast
      (terminus, N), Ballroom Shell (E, ruined dance hall), Float Graveyard
      (far E, sunken parade floats), Parade Stalls + overhead lantern/bunting
      Parade Avenue (spine), Lantern Overlook (SE), festooned gateway arches;
      warm brass/festival-cloth palette override (contrasts zone2Guardian's
      cool amber-green); dock fixed at (0,34) — unchanged, matches Game.js's
      hardcoded respawn for every zone
- [x] ArtifactManager.js: `zoneNumOf(id)` + `zoneArtifacts` (computed once in
      the constructor from `world.zone.id`) so `_pickBatch`/`zoneTotal` only
      draw from the active zone's ARTIFACT_DATA entries instead of the global
      pool; `zoneDebug`/unrecognized ids fall back to unfiltered (preserves
      today's debug-arena behavior). No Game.js changes needed — `world.zone.id`
      was already reachable.
- [x] Static verify: `node --check` passes World.js (668 lines)/zone2.js (307
      lines)/ArtifactManager.js (293 lines); all well under the 1000-line cap
- [ ] User in-browser verify: dock→avenue→plaza sightline reads the parul
      mast's glow through fog; collision holds against every new prop (stalls,
      gateway piers, ballroom walls, float hulls, gong-stand posts, mast pole,
      benches) while lanterns/bunting/glow never block movement; Guardian
      spawns/roams/beacon reads through fog; defeating it now correctly shows
      a 0/0 completion card (no zone-2 artifact content yet — a follow-up
      content pass); zone1/zone3/zoneDebug unaffected. (Not verified by Claude
      this pass — an in-browser check via Playwright was started, then aborted
      per your "don't install playwright" instruction; see chat for what to
      manually check.)

## Debug: Unlock All Zones (2026-07-04)

Goal: a debug-only way to walk the museum hub into any of the three zones without
grinding the sequential artifact/guardian progression. Decisions (user): reachable
via the museum hub portals (not a direct zone-jump shortcut) · each zone's guardian
riddle gate stays intact (only zone *access* is unlocked, not artifact collection) ·
kept independent of the existing `DEBUG_ZONE` flag (that one swaps every zone for
the small `zoneDebug` arena; the two aren't meant to be on at the same time).

- [x] config.js: `CONFIG.DEBUG_UNLOCK_ALL_ZONES` (default false)
- [x] Game.js: constructor calls `museum.unlockPortal(2)`/`(3)` right after building
      the Museum when the flag is set (zone1's portal is already unlocked by default)
- [x] Static verify: `node --check` passes config.js/Game.js
- [ ] User in-browser verify: with the flag on, all 3 portal signs read their zone
      name (no "LOCKED") from the first museum visit, and walking into any corridor
      loads that zone; each zone's guardian still gates its artifacts as normal

## Zone 3 Redesign — The Drowned Cathedral (2026-07-05)

Goal: replace the bare zone3 placeholder with a solemn underwater memory archive
inspired by St. John the Evangelist Cathedral (downtown Dagupan). Decisions (user):
content-only, no engine changes · guardian stays at water level (no y:4 hover) ·
floating platforms are decorative, non-walkable · placeholder guardian body kept ·
center glow via additive emissive meshes only (no PointLight).

- [x] zone3.js full rewrite: narthex (dock entrance + shattered portal arch),
      nave colonnade (broken `_tower` pillars at x±6), half-torus vault ribs
      (upright over tall pairs + collapsed in the aisle), transept chapel shells,
      altar/apse (dais + altar block + stump semicircle + cold votive lantern
      clusters + breathing additive Keeper orb at the guardian spot), bell-tower
      terminus (N), sparse cloister ruins, 11 floating stone slabs bobbing via
      `world.debris`, glowing pale-cyan memory strings (`_sagLine` weave down the
      colonnade), diagonal god-rays (tilted `_lightShaft` cones), rubble mounds,
      spawn nodes for all four tags; abyss background 0x050b14 + 1.5× fog density
      so map edges dissolve; cold drowned-limestone palette override; guardianStart
      (0,15) mid-nave before the altar; dock kept at (0,34) per hardcoded spawn
- [x] Static verify: `node --check` passes; zone3.js 306 lines (< 1000 cap)
- [ ] User in-browser verify: spawn on the dock looking down the nave through the
      portal arch; fog swallows the map edges into the abyss; Keeper waits in the
      glow at nave center; diagonal shafts + memory strings + drifting slabs read;
      collision holds on pillars/arch piers/walls/altar while ribs/strings/slabs
      never block; artifacts spawn reachable; zones 1/2 unaffected

## Main menu UI polish + volume settings (2026-07-17)
- [x] Restyle #title into a real menu (Awaken / Skip to Museum / Settings buttons, hover/focus states)
- [x] Add #settings modal with volume slider, persisted to localStorage (strings.volume)
- [x] AudioManager.setVolume(v) scaling the master bus; applied on init too
- [x] Gear button on Descend/Resume screens opens the same modal
- [x] Static verify: node --check on touched JS
- [ ] User in-browser verify: menu renders, slider changes loudness live, value persists across reload

## Echo range-gate bug fix (2026-07-17)
- [x] Root cause: PannerNode 'inverse' distance model ignores maxDistance — echoes never hit zero
- [x] EchoVoice.update(now, listenerPos): skip pings beyond ECHO.RANGE, fade envelope over ECHO.FADE (new config, 8m)
- [x] Static verify: node --check passes on config.js / EchoVoice.js / AudioManager.js
- [ ] User in-browser verify: echoes silent when far (>28m), fade in ~20-28m, swell up close

## Split music/SFX volume + louder music (2026-07-17)
- [x] AudioManager: musicBus (bed+melody) and sfxBus (hum, echoes, scatter, teleport) between sources and master; both feed the shared delay so sliders scale their tails too
- [x] setMusicVolume/setSfxVolume (pre-init safe); replaced single setVolume
- [x] Louder music: bed 0.05->0.09, melody base 0.015->0.03, swell target 0.03+0.15
- [x] Settings modal: Music + SFX sliders; keys strings.musicVolume/strings.sfxVolume, legacy strings.volume migrates as default
- [x] Static verify: node --check passes; no stale setVolume refs
- [ ] User in-browser verify: sliders independently duck ambience/melody vs pings/one-shots; music audibly louder

## Composed BGM replaces random melody (2026-07-17)
- [x] ElevenLabs blocked (ELEVENLABS_API_KEY=MISSING probe shown); pivoted to hand-composed score per user
- [x] src/audio/BgmScore.js: 32-beat (8-bar, 66bpm, ~29s) A-minor-pentatonic kulintang loop — bells (melody) + agung gongs
- [x] AudioManager: look-ahead sequencer (200ms tick, 0.6s window) replaces the random setInterval melody; bells -> melodyGain (swell cue intact), gongs -> new gongGain(0.11) -> musicBus
- [x] assets/audio/strings-bgm.mid: same score exported as GM MIDI (Tubular Bells) for DAW audition/editing
- [x] Static verify: node --check passes on BgmScore.js / AudioManager.js
- [ ] User in-browser verify: composed loop plays seamlessly, swell still lifts the bell line near artifacts, Music slider scales it

## Enemy pathfinding — nav grid + flow field (2026-07-19)
Follow-up to wave combat after user playtest: enemies got stuck steering
straight into building footprints. Decision: BFS flow field over a baked
walkability grid (robust in zone 1's alley/maze districts), direct steering
kept whenever the enemy has line of sight so open-water motion is unchanged.
- [x] config.js: `COMBAT.NAV` (CELL 1.0, BAKE_RADIUS, FLOW_INTERVAL 0.4,
      LOS_STEP, LOS_INTERVAL)
- [x] src/core/combat/NavGrid.js (new): 96×96 walkability grid baked from
      `world.collidesAt`; alloc-free BFS flow field toward the player
      (8-connected, no corner cutting, wall-nudge for the start cell);
      `dirAt` sampling + segment-sampled `hasLOS`
- [x] Enemy.js: staggered LOS re-checks; !LOS → follow flow (both types),
      face travel direction while routing; chasers only melee with LOS;
      spitters cancel their wind-up and never spit without LOS (fixes
      shooting through walls); unreachable player → direct-steer fallback
- [x] CombatManager.js: owns the NavGrid (baked per zone at construction),
      rebuilds the flow every FLOW_INTERVAL mid-fight + on startFight,
      passes nav through to each enemy update
- [x] Static verify: `node --check` passes; all combat files < 400 lines
- [ ] User in-browser verify: hide behind a building — chasers route around
      instead of wall-grinding; spitters reposition, no through-wall spits;
      open-water pursuit unchanged; steady frame rate mid-fight

## Wave combat — FPS fights guarding artifact collection (2026-07-19)
Decisions (user): fight triggers on the first hold-E on a scattered artifact ·
thematic light-bolt cast from the hand's lure (left click) · 3–5 mixed waves
(melee chasers + ranged spitters) · death reuses the faint→dock respawn, fight
resets. Designed via the threejs-gameplay-systems skill (design brief +
encounter plan + game-feel pass in the session plan file).
- [x] config.js: `COMBAT` block (hp, bolt, chaser, spitter, WAVES table, zone
      bonuses, spawn ring, leash, FEEL magnitudes)
- [x] index.html: #health bar ("Liwanag"), #wavehud counter, #hurt vignette,
      crosshair .combat/.hit states, CLICK — Cast Light on the controls line
- [x] ViewModel: `triggerCast()` recoil/finger-flick/lure-flash + `getMuzzleWorld`
- [x] AudioManager: playShoot/playHit/playEnemyDeath/playPlayerHurt/playWaveClear,
      ±6% seeded pitch variance (`mulberry32`)
- [x] src/core/combat/ProjectilePool.js: pre-allocated bolt pool (player + spit
      instances), wall/seabed/expiry kill, zero per-frame alloc
- [x] src/core/combat/Enemy.js: chaser (pursuit + lunge tell) / spitter (range
      seek + strafe + glow wind-up telegraph), guardian-primitive bodies,
      fade-in gate before acting, per-enemy death poof
- [x] src/core/combat/CombatManager.js: fight orchestration (waves, hit tests,
      hp/HUD, leash reset, ESC freeze, kill hitstop, FOV punch, hit marker)
- [x] Game.js: combat construction + rebuild in `_loadZone`, mousedown fire hook,
      contested gating in `_updateHold`, `_faintOnly` extraction shared by
      `_faintAndRespawn`/`_combatFaint`, prompt copy for contested artifacts
- [x] GAME_LOOP.md stage 4 updated
- [x] Static verify: `node --check` on all touched/new JS
- [ ] User in-browser verify: hold-E on a scattered artifact starts waves; bolts
      kill chasers/spitters; all waves cleared → artifact collects; dying faints
      to the dock with the fight reset; walking away leashes; zone swap clean

## Remove guardian glow (2026-07-17)
- [x] zone1Golem: matGlow 1.8->0, matWarm 1.6->0, foodMats 0.6->0; removed animate() glow-pulse lines
- [x] zone2Guardian: matCyan 2.0->0, matGlow 2.2->0; removed pulse lines (core swirl spin kept)
- [x] zone3Guardian: matGlow 2.2->0, matCrystal 1.4->0; removed pulse lines (cape/spectrals/arcs untouched per user)
- [x] Kept: chest halo PointLight + beacon column (Guardian.js), all geometry, motion animation
- [x] Static verify: all three builders parse as ES modules; no emissiveIntensity refs remain
- [ ] User in-browser verify: guardians read flat (no self-glow), halo still lifts them off the water

## Ending cutscene UI styles (2026-07-20)
- [x] styles.css: added missing rules for #ending-black (fade), #ending-subtitle (.en/.fil bilingual card), #ending-credits (title-card + rule + copy + return button)
- [x] Matched existing overlay conventions (#faint/#zintro fades, #title h1/.rule look, .menu-btn reuse); z-index 24/25/26 above gspeak/resume (23), below #loading (30)
- [ ] User in-browser verify: run Test Final Cutscene — black fades between beats, subtitles legible over restored province, credits card centered with working Return button

## Ending bloom too bright (2026-07-20)
- [x] config.js: ENDING.BLOOM block (strength .4, radius .45, threshold .85) for daylight-safe bloom
- [x] Game.js: stash gameplay bloom (.8/.6/.2) at _runEnding start, apply ENDING.BLOOM for all ending beats, restore in _enterEpilogueMuseum
- [x] Static verify: node --check on config.js + Game.js
- [ ] User in-browser verify: Test Final Cutscene — province no longer hazy, sky/white church don't blow out, string beads still glow; epilogue museum bloom back to normal

## Scatter ALL artifacts per zone — remove batch loop (2026-07-20)
Decisions (user): scatter every uncollected artifact on guardian defeat · zone
"closes" via auto-return on completion (only exit is the zone-complete card) ·
NO contested artifacts (wave combat off behind a flag) · batch card removed.
See implementation_plan.md (rewritten this pass).
- [ ] config.js: remove ARTIFACT_BATCH, ARTIFACT_MIN_SEP 14→10, COMBAT.ENABLED=false
- [ ] ArtifactManager.js: _pickBatch → all uncollected; drop batchComplete getter
- [ ] CombatManager.js: isContested short-circuits when !COMBAT.ENABLED
- [ ] Game.js: remove batchComplete branch + _batchComplete(); comment updates
- [ ] Static verify: node --check on touched files
- [ ] User in-browser verify: defeat guardian → all remaining artifacts scatter;
      no fights on hold-E; last collect shows ZONE COMPLETE (never the batch card)

## Museum frame interaction: raycast + highlight (2026-07-20)
- [x] Museum.js: _addSlot stores outward normal; _setSlot registers art+frame meshes as ray targets with baseColor stash
- [x] Museum.js: nearestArtifact -> aimedArtifact (crosshair Raycaster, far=range, back-face reject via slot normal), _setAimed 1.3x art-tint highlight, clearAim(), clear() resets targets
- [x] Game.js: museum phase uses aimedArtifact(camera, INTERACT_RANGE); clearAim on unlock/portal-entry
- [x] Static verify: node --check on Museum.js + Game.js; no stale nearestArtifact refs
- [ ] User in-browser verify: prompt only when crosshair is on a hung frame (border counts), aimed art brightens subtly, E opens the right card, no through-wall picks from wings

## Strings v2.0 — Phase 1: Zone 1 Vertical Slice (2026-07-20)
Goal: the full v2 loop for Zone 1 — descend → Memory Rift → instanced Arena (wave
defense + hybrid riddle: DOM bugtong banner + 3 shootable coral answer nodes) → strip
the Feastkeeper's armor → defeat → return to Zone 1 with the Guardian Soul + ALL
artifacts scattered → peaceful collection → museum. See implementation_plan.md +
plan file. Decisions (user): vertical slice first · hybrid riddle (DOM prompt + 3D answers).
- [x] config.js: `ARENA` block; dropped `ARTIFACT_BATCH` cap (ArtifactManager `_pickBatch` now returns all uncollected)
- [x] `src/core/MemoryRift.js` (new): PortalVortex swirl gateway at `zone.riftSpot`; zone1 `riftSpot: {x:0,z:14}`
- [x] `src/core/zones/arena1.js` (new): enclosed circular kitchen arena (16-seg wall ring + central dais); registered in zones/index.js
- [x] `src/core/arena/AnswerNode.js` (new): shootable coral answer target w/ canvas billboard label + squared-dist hitTest + break puff
- [x] `src/core/arena/ArenaController.js` (new): endless waves + timed riddle rounds + armor (correct strips, wrong penalty wave) + victory
- [x] CombatManager: refactor to spawn around an injected origin (arena center) + endless mode + `spawnExtra`/`stop`; dropped contested-artifact coupling
- [x] Enemy: reskin chaser→Starved Fisher (bonier tint), spitter→Brine Spitter (comment/colors)
- [x] `src/core/GuardianSoul.js` (new): walk-over collectible dropped on arena return; `Game.collectedSouls`
- [x] Game.js: Rift interact, `_enterArena`/`_loadArena`, `arena` phase branch, `_arenaFaint` (respawn+reset), `_returnFromArena` (scatter + Soul); removed old riddle/defeat flow + dead RiddleScreen/DefeatCutscene refs
- [x] index.html/styles.css: `#arena-riddle` non-blocking bugtong banner
- [x] Static verify: `node --check` passes all touched/new modules; served files return 200
- [x] Game.js helper split: DOM/input wiring and rendering setup moved to `src/core/_partials/`; Game.js is 929 lines and every module is below the 1000-line cap
- [ ] User in-browser verify: full loop end-to-end; arena death resets fight; console clean over both swaps

## Strings v2.0 — Phase 2: Memory Lumina (2026-07-20)
Goal: arena-only lesser-enemy drops that create tactical recovery and short power
windows without changing the Phase 1 encounter or later Soul/zone phases.
- [x] Add pooled `LuminaManager` with deterministic adaptive drops, 12s expiry,
      walk-over pickup, bolt pickup, and reset/disposal cleanup
- [x] Combat hooks: genuine-kill callback, 30% scheduled / 15% penalty drop rolls,
      public healing, and deterministic automatic Overcharge fire
- [x] Player Zephyr state: automatic 2.2x movement, no stamina drain, stamina regen,
      8s duration; same-color refresh and cross-buff coexistence
- [x] Compact Zephyr/Overcharge timers, blue stamina state, gold crosshair state,
      Vitality health pulse, and one shared procedural pickup chime
- [x] Split arena/combat/Lumina HUD CSS into `_partials/arena-hud.css` so every file
      is below the 1000-line hard cap
- [ ] Static verify: all modules pass `node --check`; line-count audit and
      `git diff --check` pass. HTTP 200 check remains blocked because local-server
      permission was declined.
- [ ] User in-browser Phase 2 verify: drops, both pickup methods, adaptive Vitality,
      timers/refresh/coexistence, 8 shots/sec Overcharge, expiry, and reset cleanup

## Strings v2.0 — Phase 3: Guardian Souls + Final Memory (2026-07-20)

Goal: carry recovered Guardian Souls into an intro-safe museum altar, then activate
the existing Final Memory sequence by holding E at the completed 3/3 pedestal.

- [x] Add the split-out Soul pedestal component with three stable zone slots
- [x] Preserve `IntroCutscene`'s centerline path by hiding the altar outside hub mode
- [x] Sync collected Souls into the museum idempotently on every hub/ending entry
- [x] Add 3/3 proximity + hold-E altar interaction and incomplete-state prompt
- [x] Replace artifact-completion auto-ending with the Soul-pedestal gate
- [x] Make the existing Final Portal entry work when started from the museum scene
- [x] Route the debug ending shortcut through the real 3/3 pedestal interaction
- [x] Static verify: all JS syntax, line-count audit, and diff whitespace pass
- [ ] Local HTTP/browser verify: sandbox permission to bind port 8000 was declined
- [ ] User in-browser verify: each Soul slot lights; incomplete altar cannot activate;
      holding E with 3/3 runs portal → museum tour → restored province → credits

## Strings v2.0 — Phase 4: LIKET Stationary-Boat Rail Shooter (2026-07-20)

Goal: replace Zone 2's generic arena with an aim-only rail-shooter encounter on a
stationary bangkâ. Layered river parallax sells forward movement while the player
protects Boat Integrity, reflects River Sniper bolts, repels Frenzied Boarders,
and answers three staggered lantern volleys thrown by The Reveler.

- [x] Rename every Zone 2 guardian reference to **The Reveler** in both languages
- [x] Add Arena 2 zone, stationary bangkâ, six looping festival-river chunks, and camera sway
- [x] Add Arena 2 controller contract and keep Game.js below the 1000-line cap
- [x] Lock walking in Arena 2 while preserving pointer-lock aiming and casting
- [x] Add manual River Sniper / Frenzied Boarder waves targeting Boat Integrity
- [x] Add reflected hostile bolts with originating-sniper defeat behavior
- [x] Add staggered lantern riddles with wrong-shot and correct-miss penalties
- [x] Add Arena 2 automatic Lumina collection and threat-only Zephyr slowdown
- [x] Update HUD and procedural audio hooks for boat/riddle combat
- [x] Preserve Zone 2 Soul, artifact scatter, pedestal, and final-memory progression
- [x] Static verify: node syntax, diff whitespace, line counts, and stale-name search
- [ ] Local HTTP/browser verify: localhost bind permission was declined; user smoke-test pending

## Artifact collection API POST placeholder (2026-07-21)

Goal: notify a future backend whenever an artifact is committed to the player's
session collection, using the collection payload documented in `STRINGS_GDD.md`.

- [x] Trace the artifact collection path and existing mock artifact-data lookup
- [x] Define the endpoint location, request payload, and non-blocking failure behavior
- [x] Add the placeholder endpoint configuration and focused API manager
- [x] Trigger one POST for each newly collected artifact
- [x] Verify syntax, mocked POST payload, file lengths, and whitespace
- [ ] User browser verify: collect an artifact and inspect the Network request payload

## Strings v2.0 — Phase 5A: Tower Player + Level Blockout (2026-07-21)

Goal: prove first-person vertical traversal through a Bolinao Lighthouse-inspired
Arena 3 before adding any combat or encounter systems. Stop for user verification
after this checklist; Phases 5B–5E require separate go signals.

- [x] Record the approved multi-phase execution boundary and manual-test gate
- [x] Add/register Arena 3 with 12 ramp flights, landings, central shaft, summit,
      future gate spaces, and static non-lethal water
- [x] Add height-aware support surfaces and vertically bounded collision proxies
- [x] Preserve player movement/sprint/stamina/look/slide across vertical traversal
- [x] Add the minimal combat-free Arena 3 lifecycle and route the Zone 3 Rift
- [x] Confirm no Guardian, enemies, combat, riddles, tide, Lumina, rewards, new HUD,
      audio, victory, Soul, or scatter behavior enters Phase 5A
- [x] Static verify: JavaScript syntax, diff whitespace, file lengths, and final diff
- [x] User manual verify: full base-to-summit traversal, overlaps, collision, falls,
      sprint/stamina, pointer-lock resume, and clean browser console

### Phase 5A manual-test correction — blocked first landing

- [x] Diagnose the screenshot against ramp and landing collision footprints
- [x] Shorten flight and summit rails/colliders to leave corner-turn clearance
- [x] Re-run Phase 5A static verification and hand back for manual retest

### Phase 5A manual-test correction — summit slab overlap

- [x] Diagnose the upper slab clipping from the screenshot and authored footprints
- [x] Move the summit ring inward and connect flight 12 with a level bridge
- [x] Verify final-ramp headroom, summit supports/colliders, syntax, and diff scope

### Phase 5A manual-test correction — final bridge pinch

- [x] Reproduce the blocked centerline against authored top colliders
- [x] Match rail endpoint clearances to enlarged future-gate landings
- [x] Assert the top route is open and repeat Phase 5A static verification

## Strings v2.0 — Phase 5B: Rising Tide + Drowning Retry (2026-07-21)

Goal: turn the accepted tower route into a timed ascent by adding only the rising
water pressure, readable ascent status, drowning failure, and complete retry loop.
Stop for user verification afterward; Phases 5C–5E still require separate approval.

- [x] Record the Phase 5B gameplay/UI contract and keep later systems excluded
- [x] Add named tower tide and drowning tunables to config
- [x] Upgrade the tower controller with rising water, pause, failure, and reset state
- [x] Add responsive altitude, progress, air-gap, warning, and drowning UI states
- [x] Route tower failure through a combat-optional arena retry path
- [x] Verify water/player/stamina/HUD reset for repeated attempts
- [x] Confirm no victory, enemies, combat, riddles, Keeper, Lumina, rewards, audio,
      Soul/scatter, or Phase 5C+ behavior enters this increment
- [x] Run JavaScript syntax, whitespace, line-count, and scoped-diff checks
- [x] User manual verify: tide timing, HUD, pause, drowning/falls, retry, summit, console

### Phase 5B manual-test correction — final decorative gate collision

- [x] Identify the reported blocker as the final future-gate frame
- [x] Keep the final frame visible while removing its inactive collision proxies
- [x] Re-run static verification and hand back for focused top-connector retesting

### Phase 5B manual-test correction — summit connector clearance

- [x] Confirm from the retest HUD that the player remains below the 18 m summit
- [x] Widen the diagonal summit connector and correct its rail-proxy half-width
- [x] Assert centerline clearance and repeat the Phase 5B static checks
- [x] User retest: cross the final connector and register 18.0 m altitude

### Phase 5B manual-test correction — tower-shell proxy root cause

- [x] Trace all colliders active around the final landing and identify shell AABB intrusion
- [x] Replace shell AABBs with mesh-matched rotated colliders
- [x] Verify final-corner clearance, syntax, whitespace, line count, and diff scope
- [x] User retest: clear the final landing, connector, and 18.0 m summit ring

### Phase 5B manual-test correction — final-ramp/bridge rail intersection

- [x] Simulate the complete final-ramp-to-ring path and reproduce the blocker
- [x] Move shortened bridge rails beyond the enlarged final landing
- [x] Assert the continuous route against all active top-level shell/rail colliders
- [x] Re-run static checks and hand back for manual summit verification

## Strings v2.0 — Phase 5C: Altitude-Aware Tower Combat (2026-07-21)

Goal: add only the tower's authored enemy pressure, knockback, combat health, and
vertical Lumina on top of the accepted traversal/tide loop.

- [x] Inspect shared combat, collision, firing, Lumina, and retry contracts
- [x] Record the player promise, encounter pacing, physics choice, tunings, and scope
- [x] Add tower-specific combat manager and Gargoyle/Gale threat entities
- [x] Add support-aware Sentinel movement and player-only vertical blocking
- [x] Add Gale orbit, telegraphed ranged shots, and altitude-aware hit resolution
- [x] Add player knockback/slow APIs and height-aware projectile collision
- [x] Add four one-shot altitude threat milestones with a six-threat cap
- [x] Add opt-in vertical Lumina drops and three-dimensional walk pickup
- [x] Verify combat death, drowning, fall, pause, and complete retry cleanup
- [x] Static verify all modules, file lengths, diff whitespace, and Arena 1–2 scope

## Strings v2.0 — Phase 5D: Tower Seals + Keeper Victory (2026-07-21)

Goal: finish Arena 3 with three altitude-bounded riddle gates, readable wrong-answer
penalties, the summit Keeper fight, and the existing Zone 3 reward/progression return.

- [x] Trace riddle, Guardian body, arena victory, Soul, scatter, and museum reuse paths
- [x] Record gate/Keeper rules, UI states, reset contract, and progression boundary
- [x] Expose per-World gate and threat descriptors from Arena 3
- [x] Add three visible player-only seal barriers and altitude triggers
- [x] Add vertical answer mechanisms, seeded riddles, correct unlock, and wrong penalty
- [x] Add four-second 55% movement slow plus capped wrong-answer Sentinel spawn
- [x] Add the shaft-hovering Keeper, HP/hit test, shot cadence, and reinforcements
- [x] Add tower objective/seal/Keeper HUD states without overlapping the ascent HUD
- [x] Set victory and reuse generic Zone 3 scatter/Soul/museum progression unchanged
- [x] Verify whole-attempt resets for gates, riddles, Keeper, threats, buffs, and UI
- [x] Static verify syntax, route/gate assertions, file limits, whitespace, and diff scope
- [ ] User manual verify both phases end-to-end; stop before Phase 5E

### Phase 5C manual-test correction — threat support and HUD

- [x] Diagnose threat drift/clipping against Arena 3's authored support surfaces
- [x] Keep Gargoyles on their assigned ramp or landing footprint and vertical tier
- [x] Keep Gales inside the tower route bounds at their authored altitude
- [x] Hide the misleading wave HUD throughout the tower encounter
- [x] Dispose stale threat scene objects and reset altitude milestones on retry
- [x] Re-run syntax, whitespace, line-limit, and scoped-diff checks
- [ ] User retest threat placement/motion across all altitude bands

### Phase 5C manual-test correction — missing Gargoyles and projectile freeze

- [x] Trace projectile-hit knockback through player movement integration
- [x] Apply knockback as a decaying world-space displacement, not accumulated input velocity
- [x] Spawn each Gargoyle on the currently approached ramp segment with a visible offset
- [x] Add a readable Gargoyle silhouette without changing its collision footprint
- [x] Verify projectile hits preserve movement and retry state
- [x] Run syntax, whitespace, file-limit, and focused source checks
- [ ] User retest the first Gargoyle and first Gale projectile

### Phase 5C runtime correction — non-finite Gale knockback

- [x] Trace the AudioListener exception back to the first non-finite simulation value
- [x] Add the missing Gale knockback tuning
- [x] Reject non-finite impulse inputs at the PlayerController boundary
- [x] Verify every tower knockback reference resolves to a finite number
- [x] Run syntax, whitespace, and file-limit checks
- [ ] User confirm a Gale hit no longer stops the animation loop

## Strings v2.0 — Phase 5E: Tower VFX + HUD Polish (2026-07-21)

Goal: improve Arena 3 combat/objective readability with restrained pooled VFX and a
cohesive tower HUD, without changing gameplay, audio, progression, or render pipeline.

- [x] Inspect current tower event hooks, HUD states, CSS fit, and effect ownership
- [x] Record the art direction, technical-art budget, UI hierarchy, and scope boundary
- [x] Replace the placeholder Keeper mesh with the existing Zone 3 Guardian builder
- [x] Preserve Keeper chest placement, animation, hit test, HP, attacks, and disposal
- [x] Add pooled tower spawn, hit, defeat, projectile-impact, gate, and Keeper VFX
- [x] Add visible seal veils matching the existing player-only gate collision
- [x] Consolidate altitude, air gap, tide, seal progress, and Keeper resolve HUD
- [x] Add one transient event/status slot plus a timed slow indicator
- [x] Preserve wave-panel removal, health/stamina/Lumina/riddle UI, and reduced motion
- [x] Verify faint/retry/victory cleanup leaves no VFX or stale HUD state
- [x] Run syntax, whitespace, file-limit, and scoped-diff checks
- [ ] User manual verify VFX/readability/fit; stop before any excluded Phase 5E work

## Guardian Debug Zone (2026-07-22)

Goal: provide a debug-only title shortcut to a compact flooded showroom where all
three Guardian variants can be inspected together without combat or progression.

- [x] Inspect the existing debug zone, Guardian lifecycle, title UI, and game phases
- [x] Lock the room layout, idle behavior, collision, visibility, and entry contract
- [x] Rebuild `zoneDebug` as the compact flooded showroom
- [x] Add the three-Guardian display controller with fixed display-facing animation
- [x] Add the gated title button and direct `debug` phase entry/resume lifecycle
- [x] Verify syntax, imports, file limits, diff whitespace, and static debug contracts
- [ ] User browser verify visuals, collision, no-action behavior, ESC/resume, and console

### Screenshot lineup correction

- [x] Lock left-to-right order as Guardian 2, Guardian 1, Guardian 3
- [x] Choose a straight, visibly separated lineup with a shared forward direction
- [x] Replace the triangle layout and inward-facing target with parallel display targets
- [x] Re-run syntax, import, file-limit, whitespace, and layout-contract checks
- [ ] User verify screenshot framing and visible gaps in the browser

### Final triangle staging

- [x] Interpret Guardian 1 as the centered front/apex Guardian
- [x] Move Guardians 2 and 3 behind-left and behind-right with visible gaps
- [x] Preserve the common forward facing, nearby spawn, collision, and idle animation
- [x] Re-run syntax, import, file-limit, whitespace, and layout-contract checks
- [ ] User verify final triangle screenshot composition in the browser

### Clean debug capture

- [x] Hide the first-person hand for the Guardian debug phase only
- [x] Suppress the crosshair on debug entry and after ESC/resume
- [x] Verify normal gameplay/arena hand and crosshair paths remain unchanged
- [x] Re-run syntax, import, file-limit, whitespace, and debug-visibility checks

## Arena Guardian Lighting Removal (2026-07-22)

Goal: remove both the tall locator beacon and chest PointLight from the shared
Guardians spawned in Arenas 1 and 2, without changing their body animation or
the debug showroom's default Guardian presentation.

- [x] Trace shared Guardian construction across Arenas 1–3 and the debug showroom
- [x] Add optional Guardian beacon/halo construction with null-safe update/disposal
- [x] Disable both effects through Arena 1 and Arena 2 definitions
- [x] Verify Arena 3's custom Tower Keeper and debug defaults remain unchanged
- [x] Run syntax, import, file-limit, whitespace, and effect-contract checks
- [ ] User verify Arenas 1 and 2 have no beacon column or chest light

## Guardian Body Glow VFX (2026-07-22)

Goal: give all three Guardian variants restrained, continuously pulsing body-part
glow based on the supplied boss references, in both their arena and debug-zone uses.

- [x] Confirm reference-driven colors, continuous pulse behavior, intensity, and scope
- [x] Add a shared allocation-free emissive pulse helper
- [x] Apply warm gold chest/rune accents to Guardian 1
- [x] Apply amber core plus cyan eye/tentacle-tip accents to Guardian 2
- [x] Apply gold heart/crack plus restrained cyan crest accents to Guardian 3
- [x] Confirm the effect adds no PointLights, beacons, particles, or gameplay changes
- [x] Run syntax, import, file-limit, whitespace, and focused contract checks
- [ ] User browser verify arena and debug-zone glow strength/readability

## Per-Enemy Arena Spawn Portals (2026-07-22)

Goal: telegraph every lesser enemy in all three arena zones with its own reusable
woven-light portal for one second, then materialize the enemy with shared audio.

- [x] Confirm one portal per enemy, one-second delay, hidden/inactive enemy, shared style, and sound
- [x] Trace normal-wave, penalty, and reinforcement spawn paths across all arena managers
- [x] Record the shared portal, timing, audio, cleanup, and verification design
- [x] User approved `implementation_plan.md`
- [x] Centralize the one-second pending-spawn contract in the shared combat manager
- [x] Upgrade the shared telegraph into the woven-light portal and arrival burst
- [x] Route Arena 2 and Arena 3 threat construction through the pending portal path
- [x] Add a restrained synthesized portal cue with simultaneous-call protection
- [x] Verify spawn/cap/cleanup contracts, audio scheduling, syntax, whitespace, and file limits
- [ ] User browser verify all three arenas and a simultaneous wave spawn

## Woven-Thread Spawn Tear (2026-07-22)

Goal: upgrade the per-enemy spawn portal from pooled rings into a woven-thread
tear — fishing-line strands unzip a rift the enemy then rises through — over a
longer 1.4s arc, with the summon hue shared by all three arenas.

- [x] Confirm look (thread tear), rise-out arrival, single hue, and 1.4s pacing with the user
- [x] Add `COMBAT.EMERGE`, `VFX.TEAR`, and the 1.4s `SPAWN_TELEGRAPH` to config
- [x] Build `ThreadTear`: whole pool in one `LineSegments2` + one instanced seam (2 draw calls)
- [x] Open the tear from `spawnTelegraph`, close the matching tear from `spawnArrive`
- [x] Add the `rig` link + `beginEmerge` to `ThreatBody`; hang Enemy/Rail/Tower bodies off it
- [x] Offset the hit-test centers by `emergeOffset` so a rising body is shot where it's drawn
- [x] Restretch `playEnemyPortal` to the new arc and add the strain shimmer
- [x] Refresh the tear's fat-line resolution on window resize
- [x] Verify syntax, three r160 line-geometry API, pool/serial reuse, and reset/dispose paths
- [ ] User browser verify all three arenas, a full wave, a penalty spawn, and a mid-fight resize


## Arena 1 — Wave Cap, Wrong-Answer Lockout, Feastkeeper Boss (2026-07-22)

Goal: give the Zone 1 Memory Arena a shape (10 waves, riddles at 3/6/10), a real
cost for guessing wrong, and a climactic boss phase behind a Dark-Souls-style
boss frame at the top of the screen.

- [x] Confirm boss-bar owner, wrong-answer cost, wave pacing, boss behavior, and faint scope with the user
- [x] Replace timer-driven riddle pacing with `ARENA.TOTAL_WAVES` + `ARENA.RIDDLE_WAVES`; add the `ARENA.BOSS` block
- [x] Teach `CombatManager` bounded runs: `totalWaves`, `onWaveCleared`, `held`, `holdWaves`, `clearEnemies`, `aliveCount`
- [x] Add `AnswerNode.setInert()` — dimmed, unshootable choices during a lockout
- [x] Rebuild the ward row into a top-center boss frame (`#boss-bar`) with `CombatHud.setBoss`/`hideBoss`; keep `setWards` as a shim
- [x] Share the health ghost-fill drain between the player bar and the boss bar
- [x] Write `arena/FeastkeeperBoss.js`: telegraphed shots, irregular 1/3/5 summons, two enrage phases, armored pings
- [x] Rework `ArenaController` into a `waves/riddle/locked/boss/won` state machine
- [x] Resume at the boss phase after a faint via `restartAfterFaint` (with a `begin` fallback for rail/tower)
- [x] Verify syntax, dead-reference removal, and the 1000-line limit on every touched file
- [ ] User browser verify: 10-wave counter, riddle gating at 3/6/10, lockout retry, boss phases, boss-phase respawn, zones 2 and 3 unaffected
- [x] Extract `arena/ArenaBoss.js` as the shared boss contract; move all boss tuning out of `config.js` into the subclass files

## Arena 2 — High-Pressure Riddles and Reveler Boss (2026-07-22)

Goal: remove dead time from the stationary-boat encounter, keep every enemy portal
inside the river, expose the three riddle deadlines, and add a full Reveler boss phase.

- [x] Confirm enemy intensity, riddle cadence, answer reveal, riddle enemy behavior, boss movement/attacks, projectile formations, and retry scope
- [x] Record the decision-complete implementation design in `implementation_plan.md`
- [x] Replace fixed waves with seeded 3–5s random groups, an eight-threat cap, empty-river acceleration, and water-only spawn sampling
- [x] Cancel pending portals at riddle entry and pause encounter clocks while pointer lock is released
- [x] Add the three-segment 0:20 / 0:55 / 1:30 riddle meter and rail-specific responsive CSS partial
- [x] Spawn all three answer lanterns together, stage them at the river midpoint, hold them inert for 3s, then launch them simultaneously
- [x] Add `RevelerBoss` with 100 HP, lateral hops, phase-scaled random summons, and boss-only retry
- [x] Add the pooled 2s-charge projectile formations with immediate reflection, random launch staggering, boat damage, and homing reflected damage
- [x] Preserve Lumina, Boat Integrity, Zone 2 Soul/artifact return, and Arena 1/3 behavior
- [x] Run syntax, whitespace, import, and file-length checks
- [ ] Browser verify full Arena 2 flow, retry scopes, responsive HUD, console, and Arena 1/3 regressions

### Arena 2 projectile-readability follow-up (2026-07-22)

- [x] Confirm a 2s boss-orb charge, 1s lantern travel, 3s reading hold, and ±4.5m lineup with the user
- [x] Reduce the Reveler formation charge from 3s to 2s
- [x] Move the lanterns for 1s to a level midpoint lineup at x = -4.5 / 0 / +4.5 before the reading hold
- [x] Preserve simultaneous launch, six-second attack flight, retry behavior, and pointer-lock pause
- [x] Run focused syntax, reference, whitespace, and file-limit checks

## Global Focus Pause Hardening (2026-07-22)

Goal: make Escape, window blur, and hidden-tab transitions enter one reliable
pause state that freezes every game timer and cannot strand the player unlocked.

- [x] Trace focus, pointer-lock, phase, timer, input, and audio ownership
- [x] Confirm all gameplay, museum, arena, debug, and cinematic phases are pausable
- [x] Confirm all game timers freeze and music continues quietly while SFX are muted
- [x] Record the centralized pause/resume design in `implementation_plan.md`
- [x] User approve `implementation_plan.md`
- [x] Add the idempotent global pause controller and phase policy
- [x] Freeze active game time, async gameplay waits, and remaining wall-clock effects
- [x] Clear held inputs and add quiet/restored audio-bus behavior
- [x] Require confirmed pointer-lock acquisition before leaving Pause
- [x] Run focused pause tests, syntax/import checks, whitespace, and file-limit audits
- [x] Reproduce the Resume → second Escape regression with native unlock event ordering
- [x] Prevent native Escape from arming a stale programmatic-unlock guard
- [x] Re-run the repeated Escape regression and pause verification checks
- [ ] User browser verify Escape, blur/tab hide, settings, and every game phase

## Arena 3 — Tower Combat and Summit Boss Upgrade (2026-07-22)

Goal: make the tower ascent threats authored and readable, replace the open summit
ring with a real boss deck, and give the Keeper a three-phase action fight using the
shared combat HUD and existing Zone 3 Guardian body.

- [x] Read `Arena1.md` and trace Arena 3 geometry, combat, Keeper, retry, and HUD ownership
- [x] Confirm fixed Gargoyle sentries, upgraded Gale flyers, octagonal summit, boss phases, retry, tide, and hybrid HUD
- [x] Record the approved implementation contract in `implementation_plan.md`
- [x] Replace the summit ring/shaft with the supported octagonal deck and authored add anchors
- [x] Pre-place four fixed Gargoyles with telegraphed wing slams and vertical HUD filtering
- [x] Move seeded Gale spawns into the tower center circle and restrict movement to vertical tracking
- [x] Add Tower combat modes, per-source projectile damage, caps, and complete cleanup
- [x] Rebuild the Keeper as a 60-HP three-phase shot/charge/summon encounter
- [x] Add the charge lane telegraph, bounded rush, single-hit damage, and recovery window
- [x] Freeze the boss tide, clear ascent pressure, and preserve boss-only retry at the summit
- [x] Transition from ascent HUD to the shared boss bar and summoned-threat counter
- [x] Extract tower CSS into `_partials/tower-arena-hud.css` with responsive/reduced-motion states
- [x] Re-read every edited file and correct integration errors
- [x] Run syntax, unit, import, whitespace, duplicate-ID, file-limit, and focused contract checks
- [ ] Browser verify ascent, summit, all boss phases, both retries, HUD fit, pause, and Arena 1/2 regressions

## Arena 3 — Encounter Guide (2026-07-23)

- [x] Confirm `Arena1.md` structure and current Arena 3 implementation details
- [x] Create `Arena3.md` covering ascent, seals, summit boss, retry, HUD, and code ownership
- [x] Verify documented values against source and run Markdown whitespace/file-limit checks

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
