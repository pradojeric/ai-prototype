# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

*Strings* is a first-person, atmospheric walking-sim prototype built with **Three.js 0.160.0** and **vanilla JavaScript ES modules** — no build step, no package manager, no bundler. The player wades through a submerged Filipino market (Dagupan, Pangasinan) collecting cultural artifacts. Currently a single zone ("Zone 1: Pantal Market"). See [STRINGS_GDD.md](STRINGS_GDD.md) for the design intent the code implements (section references like "GDD §6" appear throughout the source).

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

**Game state lives in Game.js**, not the subsystems: the hold-to-collect meter (`holdKey`/`holdProgress`), the `busy` flag (gates the loop during a discovery), and the start/HUD/zone-complete UI transitions.

## Conventions that matter here

- **Config over magic numbers:** shared tunables (water level, eye height, speed, zone size, interact range) live in [src/config.js](src/config.js). Also home to `clamp01`, `wait`, and `mulberry32` (the seeded PRNG used for deterministic-ish layout). Prefer adding constants there. Note some constants are *mirrored* between World and Player (e.g. dock footprint) — keep them in sync.
- **Per-frame allocation is avoided deliberately.** Hot paths reuse scratch `THREE.Vector3`s cached on `this` (see the `this._gather ||= ...` pattern in Game's loop and StringSystem). Follow this when touching the render loop.
- **All UI is plain DOM** styled in `<style>` inside [index.html](index.html); JS toggles `.active` classes. There is no UI framework — the user's global "component-first" rule does not apply to this vanilla project.
- **Game content** (artifact text, the mock "City-Wide Portal API" `fetchArtifactData`) lives in [src/data.js](src/data.js). Filipino/Pangasinan cultural text is intentional — preserve diacritics and meaning.
- The repo also contains planning artifacts ([task.md](task.md), [implementation_plan.md](implementation_plan.md)) and reference images (`1.webp`, `2.webp`).
