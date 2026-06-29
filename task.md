# Task — Zone 1 (Pantal Market) Prototype

## Objective
Playable browser prototype proving the full Zone 1 core loop, single-file (CDN importmap), placeholder visuals, mock API data.

## Checklist
- [x] Read GDD, confirm scope with user
- [x] Scaffold `index.html` with Three.js importmap + start screen (pointer lock)
- [x] Atmosphere: FogExp2, water plane, sediment particles, lighting
- [x] Pantal Market blockout (floor, stalls, hanging signs, bangkâ)
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
Reference: top-down "Pantal Market District — The Flooded Memories" map.
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
