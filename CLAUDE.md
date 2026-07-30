# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

*Strings* is a first-person, atmospheric walking-sim prototype built with **Three.js 0.160.0** and **vanilla JavaScript ES modules** — no build step, no package manager, no bundler. The player wades through submerged Filipino locations (Dagupan, Pangasinan) collecting cultural artifacts across three zones, each gated by a Guardian boss and a riddle challenge, all connected through a central museum hub. See [STRINGS_GDD.md](STRINGS_GDD.md) for the design intent the code implements (section references like "GDD §6" appear throughout the source).

## Running

There is no build, test, or lint tooling. The game loads ES modules and CDN assets, so it **cannot** be opened via `file://` — it must be served over HTTP:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
# or: npx serve .
```

Three.js and its addons are pulled from unpkg via the import map in [index.html](index.html) (`"three"` and `"three/addons/"`). There is no local copy of Three.js; first load needs internet.

## Architecture

The entry chain is [index.html](index.html) → [src/main.js](src/main.js) → `new Game()`. [src/core/Game.js](src/core/Game.js) is the composition root and the only owner of the `requestAnimationFrame` loop; everything else is a subsystem it constructs, wires together, and drives each frame via `update(dt, t)`.

**Subsystem ownership (each is a class, one per file):**

- **[World.js](src/core/World.js)** — owns the `THREE.Scene`, all terrain/buildings/debris, lighting, fog, and the **collision registry**. Collision is circle-vs-AABB (`collidesAt(x, z, r)`) against a flat list of XZ footprints; the world also exposes `groundHeightAt(x, z)` for vertical support (the raised dock + ladder ramp). Each district is built by its own private method (`_memoriesAlley`, `_auctionSquare`, `_fishWarehouse`, etc.) called from the constructor. `spawnNodes` (keyed by tag) are the anchor points artifacts spawn near.
- **[PlayerController.js](src/core/PlayerController.js)** — wraps `PointerLockControls`; WADE movement with smoothed accel and **axis-separated collision resolution** (rejects each axis independently so the player slides along walls). The collider and ground-height functions are *injected by Game* (`setCollider`/`setGroundHeight`) to keep World and Player decoupled.
- **[ArtifactManager.js](src/core/ArtifactManager.js)** — seeds artifact placement using a per-session seeded PRNG, querying `world.spawnNodes` and `world.collidesAt` to keep artifacts reachable. Owns interaction proximity (`update` returns `{ nearest, nearestDist }`) and collection. Each artifact owns a `StringBundle`.
- **[StringSystem.js](src/core/StringSystem.js)** — the signature visual: one fat `Line2` per artifact (a "fishing line") drawn from a point held low in view to the artifact, bowing and fading by distance. Uses `LineMaterial`/`LineGeometry` (needs resolution updates on resize — see `setResolution`).
- **[ViewModel.js](src/core/ViewModel.js)** — first-person hand mesh, a child of the camera so it renders in view space; reaches forward as hold-progress fills.
- **[AudioManager.js](src/audio/AudioManager.js)** — procedural Web Audio hum (no asset files); `init()` must be called after a user gesture (the start click).
- **[ui/DiscoveryScreen.js](src/ui/DiscoveryScreen.js)** — DOM-overlay artifact card; `show()` returns a Promise that resolves when the player dismisses, which is how Game serializes the discovery flow.
- **[ui/RiddleScreen.js](src/ui/RiddleScreen.js)** — DOM-overlay multiple-choice "bugtong" (riddle) shown during a Guardian encounter, same Promise + `.active` pattern as DiscoveryScreen. `show(riddle, step, total)` resolves `true`/`false`. Riddle content lives in `data.js`; `RIDDLE_COUNT` (config.js) sets riddles-per-encounter.
- **[audio/EchoVoice.js](src/audio/EchoVoice.js)** — per-artifact spatialized audio locator, distinct from AudioManager's ambience. Each instance owns an HRTF `PannerNode` positioned at an artifact's world coords, emitting a soft phase-staggered pentatonic ping so the player can triangulate artifacts by ear. Driven per-frame via `update(now)`; tuned by the `ECHO` block in config.js.

**Zones ([src/core/zones/](src/core/zones/))** — a zone is a data/build module, not a class: `zoneN.js` exports district-building functions that take the `World` instance and call its reusable primitives (`_building`, `_stall`, `_tower`, etc.) in a fixed order using a seeded `rng`. `zones/index.js` registers `zone1`/`zone2`/`zone3`/`zoneDebug` by id; `createWorld(zoneId)` builds a fresh `World` from the definition (`CONFIG.DEBUG_ZONE` force-overrides to `zoneDebug`). There is a single active `World` at a time — switching zones means constructing a new one and Game re-injecting the player's collider/ground-height callbacks. **To add a zone: write `zones/zoneN.js` and register it in `index.js`.**

**Guardians ([src/core/Guardian.js](src/core/Guardian.js) + [src/core/guardians/](src/core/guardians/))** — `Guardian.js` is the shared boss shell: a roaming NPC that teleports between beacons and gates a zone's artifacts behind a riddle challenge, auto-starting within `GUARDIAN.ENCOUNTER_RANGE`. It owns teleport/beacon/fade/defeat-scatter mechanics common to every zone, and delegates only the visual **body** to a per-zone builder selected by a `variant` string (e.g. `'zone1'`). `guardians/index.js` maps variant → builder (`zone1Golem`, `zone2Guardian`, `zone3Guardian`); each builder returns a contract (`fadeMats`, `chestY`, `glowColor`, idle animation) that `Guardian.js` drives. `guardians/primitives.js` holds shared, palette-agnostic mesh helpers (`fadeMat`, `stackedLimb`, `buildPot`, `spiralCore`, `angDelta`) reused across builders — **each zone's Guardian should have a visually distinct body; don't reuse Zone 1's golem shape for other zones.** **To add a zone's Guardian: write `guardians/zoneNGuardian.js` and register it in `guardians/index.js`.**

**Museum hub ([src/museum/](src/museum/))** — `Museum.js` ("Aking Museo") is a self-contained dark-gallery hub scene (its own `THREE.Scene`). The main room is a **lobby**: the Soul Altar, the three -Z wall portals to each zone (locked flags gate progress; only zone1 starts unlocked), and a doorway per zone leading to that zone's own **gallery**. Each gallery is a `_partials/GalleryRing.js` — a room holding a ring of `_partials/ArtifactPedestal.js` plinths, one per artifact that zone actually has (counts come from `ARTIFACT_DATA`, never config), with the artwork floating and rotating inside a glass cube. `_partials/RoomShell.js` holds the surface primitives (`wall`, `tilePlane`, `loadTextureSet`, `signTexture`, `Tracker`) both the lobby and the galleries build from. Rooms are placed by `MUSEUM.GALLERY.ROOMS` and all their maths runs in a local `(u, v)` frame (`u` outward from the lobby wall, `v` across it) so one implementation serves the -X, +X and +Z rooms. It's geometry-only — no camera/cutscene logic of its own; static geometry is frozen (`matrixAutoUpdate = false`) since only lights/material colors change post-build (the cubes hung in later by `populate` are exempt, being children added after the freeze). `PortalVortex.js` exports `createVortexMaterial(aspect)`, a shared swirling-spiral `ShaderMaterial` used for every open portal's corridor panel; Museum places the meshes and updates `uTime` per frame.

**Cutscenes ([src/cutscene/](src/cutscene/))** — `IntroCutscene`, `DefeatCutscene`, `FaintCutscene` share one pattern: a thin driver owning its own `THREE.PerspectiveCamera` and a hand-authored keyframe timeline (`{t, pos, look}`), played with smoothstep easing and resolved via a Promise, using scratch `Vector3`s to avoid per-frame allocation. They render *over* existing scenes rather than owning geometry — `IntroCutscene` drives a camera over the shared Museum scene; `DefeatCutscene` renders over the live world (Game swaps `renderPass.camera` to it) so the real guardian/scattering artifacts stay visible, then restores the player camera. DOM overlays (`#wake`, `#flash`) handle fades. Timing constants live in config.js blocks `CUTSCENE`, `CUTSCENE_DEFEAT`, `FAINT`.

**Game state lives in Game.js**, not the subsystems: the hold-to-collect meter (`holdKey`/`holdProgress`), the `busy` flag (gates the loop during a discovery), and the start/HUD/zone-complete UI transitions.

## Conventions that matter here

- **Config over magic numbers:** shared tunables (water level, eye height, speed, zone size, interact range, plus `CUTSCENE`/`CUTSCENE_DEFEAT`/`FAINT`/`ZONE_INTRO`/`MUSEUM`/`GUARDIAN`/`ECHO`/`RIDDLE_COUNT`/`ARTIFACT_BATCH`/`SCATTER_*` blocks) live in [src/config.js](src/config.js). Also home to `clamp01`, `wait`, `shuffle`, and `mulberry32` (the seeded PRNG used for deterministic-ish layout). Prefer adding constants there. Note some constants are *mirrored* between World and Player (e.g. dock footprint) — keep them in sync.
- **Per-frame allocation is avoided deliberately.** Hot paths reuse scratch `THREE.Vector3`s cached on `this` (see the `this._gather ||= ...` pattern in Game's loop and StringSystem). Follow this when touching the render loop.
- **All UI is plain DOM** declared in [index.html](index.html) and styled in [styles.css](styles.css); JS toggles `.active` classes. There is no UI framework — the user's global "component-first" rule does not apply to this vanilla project.
- **Game content** (artifact text, the mock "City-Wide Portal API" `fetchArtifactData`) lives in [src/data.js](src/data.js). Filipino/Pangasinan cultural text is intentional — preserve diacritics and meaning.
- The repo also contains planning artifacts ([task.md](task.md), [implementation_plan.md](implementation_plan.md)) and reference images (`1.webp`, `2.webp`).
