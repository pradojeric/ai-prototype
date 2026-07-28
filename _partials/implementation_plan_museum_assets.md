# Implementation Plan — Museum "Aking Museo" Visual Upgrade (CC0 assets)

## Design intent

Replace the flat solid-color floor/wall/ceiling of `src/museum/Museum.js` with real
CC0 PBR textures (albedo + normal + roughness), and add a subtle HDRI environment
for the walkable hub — while keeping the existing mood mechanism fully intact.

The mood today is driven entirely by `MeshStandardMaterial.color` being repainted
between the dark intro (`_shell` colors) and the bright hub (`setHubLighting`). An
albedo `map` multiplies against `.color`, so **keeping the existing `setHex()` tints
keeps the exact same intro→hub brightening** — the texture only adds surface detail.

## Assets (all CC0, downloaded into repo)

| Local path                    | Source                              | Use |
|-------------------------------|-------------------------------------|-----|
| `assets/textures/marble/`     | ambientCG Marble018 (1K JPG)        | gallery floor (polished marble) |
| `assets/textures/gallery-wall/` | ambientCG Plaster003 (1K JPG)     | gallery walls |
| `assets/textures/marble-tiles/` | ambientCG MarbleTiles (1K JPG)    | ceiling / decorative accent |
| `assets/hdri/gallery_1k.hdr`  | Poly Haven studio_small_09 (1K HDR) | hub `scene.environment` reflections |

## Steps

1. Download + unzip texture sets; keep only `color.jpg` / `normal.jpg` / `roughness.jpg`
   per folder (mirrors the existing `assets/textures/<name>/` convention).
2. Download the HDRI to `assets/hdri/gallery_1k.hdr`.
3. `Museum.js`: add `_loadTextures()` (mirrors `RestoredKit._loadTextures`): load the
   three sets, assign `map/normalMap/roughnessMap` to `floorMat` / `wallMat` / `ceilMat`,
   `wrapS/wrapT = RepeatWrapping`, `anisotropy = 4`, and set `.repeat` per surface for
   consistent texel density. Set `roughness = 1` (driven by the map). Keep `.color`.
4. `Museum.js`: in `setHubLighting(on)`, lazily load the HDRI via `RGBELoader`, set
   `scene.environment` on / `null` off (intro stays dark), with a modest
   `scene.environmentIntensity` so reflections don't blow out the bloom balance.
5. Update `assets/textures/CREDITS.md` with the new sources.
6. Track new textures/HDRI in the dispose pools.

## Risk mitigation

- Do NOT touch the `.color` repaint logic → intro→hub mood preserved.
- HDRI environment only attached in hub mode → intro cutscene look unchanged.
- Textures load async (pop-in) — acceptable, matches existing RestoredKit behaviour.
- No new per-frame work; static geometry stays frozen (`_freezeStatic`).
