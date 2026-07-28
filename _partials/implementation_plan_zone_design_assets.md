# Implementation Plan — Zones 1–3 Layout Redesign + CC0 Asset Pass (2026-07-25)

## Problem

The three submerged zones are where the player spends nearly all their time and were
the least developed scenes in the project:

1. **No textures.** Every zone surface was a flat-colour `MeshStandardMaterial` from
   `World._materials`, while `Museum.js` and `RestoredKit.js` already ran a committed
   CC0 ambientCG PBR pipeline. The hub looked finished; the zones did not.
2. **Zone 2 was a clone of zone 1.** `perimeter()` byte-identical, stall rows pinned at
   exactly `x = ±6.5` in both, same gateway/overlook/shed/boat coordinates. LIKET read
   as PONSIA with lanterns glued on.
3. **~250 lines of duplicated builders** across the three zone files.
4. **A draw-call wall.** `_mangroveRing` alone built ~104 trees × ~9 meshes ≈ 940 draw
   calls per zone — textures could not be added responsibly on top of that.
5. **Dead spawn nodes.** Zone 3's four `submerged_interior` nodes all addressed
   transept centres, but transepts were solid `_building` blocks, so those nodes sat
   inside collision and could never be used.

## Approach

### Assets (CC0, ambientCG — same source/licence as the existing sets)

Three new sets, downsampled to **512px** (the zones are heavily fogged; fine texel
detail is never visible) for **764 KB total**: `silt` (Ground051) → seabed, `rust`
(MetalPlates013) → warehouse shells/metal, `moss` (Moss002) → mangrove canopy/algae.
Credited in `assets/textures/CREDITS.md`. The zone engine also reuses the committed
`plaster`, `paving`, `wood` and `rock` sets.

No CC0 water/ripple set exists, so the **water detail normal is computed
analytically** in the shader instead (two scrolling sine fields → per-pixel normal →
fresnel rim + wide sun sheen). That is cheaper than sampling a normal map on the
surface that covers most of the screen, which is exactly where the low-end budget is
tightest.

### `src/core/_partials/TextureKit.js`

Module-level loader + cache keyed by folder name. Module scope is load-bearing: a
`World` is constructed and `dispose()`d on every portal transit, so a per-World loader
would re-decode every JPG per zone change. `applyTextureSet` deliberately **leaves
`mat.color` untouched** (Museum's approach, not RestoredKit's) and runs *after* the
palette merge, because each zone's mood is expressed purely as colour overrides — the
albedo map must multiply against that tint, not replace it.

`tileBoxUVs` / `tilePlaneUVs` / `tileCylinderUVs` / `tileUniformUVs` bake
world-size-proportional repeats into geometry UVs. Baking beats per-size texture
clones (each clone is a separate GPU upload) and is free here, since the zone
primitives already allocate a fresh geometry per mesh.

Safe against `World.dispose()`: that calls `material.dispose()`, which in three r160
only dispatches an event and does **not** dispose the material's textures (verified
against the r160 source and by test — see Verification).

### Draw-call reduction

New `World._instanced(geo, mat, items)` back-end (following the `InstancedMesh` +
reused-dummy pattern already in `arena3.js`), with four batched primitives on top:
`_mangroveRing` (3 instanced meshes for the whole ring), `_stallRow`, `_rubbleField`,
`_towerField`. Colliders are still registered exactly as before — only the render path
changed.

One subtlety: mangrove stilt roots previously took their rotation from a tilted mesh
inside a yawed parent Group. A single XYZ Euler is **not** equivalent, so those
instances carry `tilt` + `yaw` and compose as `yaw * tilt` via quaternions.

### `src/core/zones/_partials/zoneKit.js`

The builders that were copy-pasted between zones, now shared and parameterised:
`perimeterBlocks` (gap positions differ per zone so boundaries stop matching),
`overlookPlatform`, `hallShell` (with an `interior` callback for what genuinely
differs, plus an optional climbable `mezzanine`), `cradleRow`, `hullRow`, `plazaDais`,
`footbridge`.

`overlookPlatform`, `hallShell(mezzanine)` and `footbridge` all exploit
`World.addSupportSurface`, which the engine fully supported but **only the spawn dock
used**. Combined with tiered colliders (`{ maxY }`) — the player passes its feet height
into `collidesAt`, so a deck blocks while wading past and stops blocking once you are
standing on it — these give the zones real, climbable verticality.

### Layout

- **Zone 1 (PONSIA)** — stall stations jitter their offset (5.6–8.0 m) and drop out
  per side instead of mirroring at `±6.5`; new **Kanal Alley** (walled flood channel
  crossed by a footbridge, so reaching north Memories Alley is a choice); an alley
  **catwalk** at y 3.4 with a long approach ramp; a **warehouse mezzanine**. The two
  building rows flanking the catwalk are built shallow on purpose — building colliders
  block at every height, so a deep house there would stop the player mid-deck.
- **Zone 2 (LIKET)** — a **processional ring**: a short entry avenue keeps the Rift and
  Reveler encounter staged exactly as before through `z ≈ 16`, then opens into a round
  festival ground at `(0,-6)` with districts arranged around the rim. The parade route
  is a **curved arc of garlands** inside the rim (routed inside deliberately: the
  outside of that bearing is where the dancing hall stands). Float graveyard moved to
  the SW as a capsized pile-up with a walkable deck. Anchors unchanged.
- **Zone 3 (Cathedral)** — colonnade spacing now **tightens toward the altar**
  (7·6·5·4·4·3 m) for forced perspective; a **climbable collapsed vault** in the west
  aisle gives the composed shot down the nave; a faint additive **nave inlay** fixes
  readability against the near-black background; transepts became real **shells** with
  rose windows, which is what finally makes `submerged_interior` work.

### File-size compliance

Adding the above pushed `World.js` to 1030 lines, over the 1000-line hard limit, so the
festival vocabulary moved to `src/core/_partials/FestivalDressing.js`. `World` keeps
thin delegating methods (`_lantern`, `_bunting`, …) so every zone call site is
unchanged. `task.md` (1145 lines) was likewise split, with its old history moved to
`_partials/task_archive.md`.

## Files

- New: `src/core/_partials/TextureKit.js`, `src/core/_partials/FestivalDressing.js`,
  `src/core/zones/_partials/zoneKit.js`, `_partials/task_archive.md`
- New assets: `assets/textures/{silt,rust,moss}/`
- Modified: `src/core/World.js`, `src/core/zones/zone{1,2,3}.js`,
  `assets/textures/CREDITS.md`, `task.md`

## Verification (all measured, not assumed)

A throwaway Node harness (scratchpad only, nothing added to the repo) resolved the
browser import-map specifiers against a local three r160 copy and built every zone
headlessly — three's scene graph needs no WebGL.

| Check | Result |
|-------|--------|
| Draw calls, zone 1 | 1334 → **344** |
| Draw calls, zone 2 | 1558 → **657** |
| Draw calls, zone 3 | 1362 → **361** |
| All 7 zone/arena defs build | pass |
| Spawn/rift/guardian points free + flood-fill reachable | pass (baseline had 30 failures) |
| 5400 real `ArtifactManager` placements over 200 seeds × 3 zones | 0 in-collider, 0 unreachable |
| Texture `load()` calls across 3 builds + 2 disposes | 21 (no re-uploads) |
| Per-zone tint preserved after texturing | zone2 `#3a3128`, zone3 `#46525f` |

Still outstanding: **in-browser verification** — walk each zone (dock → ladder → rift),
climb every new support surface, confirm the guardian encounters and arena entry, and
regression-check the museum intro and the ending diorama.

## Deliberate non-changes

- `RestoredKit` and `Museum` still keep their own copies of the texture loader/tilers.
  Migrating them onto `TextureKit` is the obvious DRY follow-up, but it touches working
  cutscene/museum code that can only be validated visually, so it was left alone rather
  than bundled into a zone change.
- Lanterns and pennants remain individual meshes. They are ~200 of zone 2's 657 draw
  calls, but they animate per-instance through `world.debris`/`world.shafts`; batching
  them means teaching the per-frame loop about instanced entries and would collapse
  their independent flicker phases. That is the next available win if zone 2 needs to
  go lower.
