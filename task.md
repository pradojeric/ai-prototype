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
