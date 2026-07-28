# Implementation Plan — Guardian CC0 Texture Pass (2026-07-25)

## Goal

Give all three Guardian bosses real PBR surface detail. They are currently the only
major set-piece meshes in the game still using flat untextured `MeshStandardMaterial`
(`fadeMat`), while the zones, museum and ending diorama all already run the committed
ambientCG CC0 pipeline. Up close — and the Guardian encounter is the closest the
player ever gets to a large object — the flat shading reads as unfinished.

## Decisions (from user)

- Scope: **all three** guardians (Feastkeeper / Reveler / Keeper) in one pass.
- Assets: **reuse the committed sets + download a few new CC0 ones** from ambientCG.
- Tinting: **multiply** — leave `mat.color` untouched so each guardian keeps its
  authored palette identity; the map only adds surface detail.
- Emissive accents (runes, eyes, spiral cores, cape, thread arcs): **stay untextured**.
  They are the readability anchor through fog and at beacon distance.

## Constraints that shape the design

1. **`fadeMat` opacity lifecycle is load-bearing.** Every Guardian part fades together
   through the `fadeMats` array (`[material, baseOpacity]`). Texturing must not add,
   remove or reorder entries — it decorates existing materials in place.
2. **Guardians are rebuilt per encounter**, and a `World` is disposed on every portal
   transit. So the texture cache must be module-scoped, exactly like `TextureKit`.
3. **No baked-UV path is viable here.** `TextureKit`'s `tile*UVs` helpers bake repeats
   into geometry, which works for zones because zone primitives funnel through a
   handful of builders. The guardian builders instead construct ~80 meshes each with
   inline geometry at wildly different scales; threading a tiling call through every
   one would be a large, error-prone diff for no visual gain at boss scale.
   **Therefore:** clone each texture set once per *repeat tier* and set `.repeat`
   directly. Tiers are shared across all three guardians, so the number of extra GPU
   uploads is bounded by tier count (~7 sets × 1–2 tiers), not by material count.
   Cloning is required rather than mutating the cached set because `World` and
   `Museum` rely on those same textures at `repeat = 1` with baked UVs.
4. **Strongly-hued albedo fights the palette.** Multiplying Bamboo001A's yellow-green
   or Sponge001's orange against an authored teal produces mud. The kit therefore
   supports a **detail-only** mode (normal + roughness, no `map`), used wherever the
   source albedo would corrupt the guardian's colour identity. This honours the
   "keep tints" decision rather than bending it.

## Asset plan

Five new 512-px sets (matching the submerged-zone budget, ~1 MB total). This is one
more than the "3–4" discussed: the Reveler is a *coral* titan and ambientCG has no
coral material, so `Sponge001` is pulled in as the porous-organic stand-in rather
than reusing granite `rock` for the boss's primary body.

| New folder | ambientCG | Used for |
|------------|-----------|----------|
| `bamboo`   | Bamboo001A | Z1 limbs, chest lattice, spears |
| `wicker`   | Wicker004  | Z1 rope wraps, rattan hands, fish-trap hip fringe |
| `clay`     | Clay001    | Z1 shoulder pots, Z3 pottery |
| `fabric`   | Fabric030  | Z2 mantle fins |
| `sponge`   | Sponge001  | Z2 coral lattice body + coral clumps (detail-only) |

Reused from `assets/textures/`: `rock` (Z1 stone horns/tablets, Z3 stone), `moss`
(Z3 dark weathered stone), `marble` (Z2 ice-blue mask).

Untextured by decision: all `matGlow` / `matCyan` / `matWarm` / `matCape` /
`matSpectral` / `matArc` / `matThread` / `matCrystal` accents.

## Steps

1. Download the five sets from ambientCG, downsample to 512, commit under
   `assets/textures/<name>/{color,normal,roughness}.jpg`; update `CREDITS.md`.
2. Add `src/core/guardians/_partials/GuardianTextureKit.js`:
   - `guardianSet(name, repeat)` — module-cached clone keyed `name@repeat`.
   - `skin(mat, name, { repeat, albedo })` — binds maps onto an existing `fadeMat`,
     leaves `mat.color` alone, sets `roughness = 1` when a roughness map is bound.
   - Kept in `_partials/` per the repo's splitting convention; `primitives.js` stays
     palette-agnostic and gains no texture dependency.
3. Apply per guardian, immediately after the material block in each builder, so the
   `fadeMats` array and every downstream mesh pick it up untouched:
   - `zone1Golem.js` — body/horn→`rock`, limb→`bamboo`, rope→`wicker`, pot→`clay`.
   - `zone2Guardian.js` — body/coral→`sponge` (detail-only), mask→`marble`,
     fin→`fabric`.
   - `zone3Guardian.js` — stone→`rock`, stoneDark→`moss` (detail-only).
4. Verify: headless syntax/import check on all guardian modules, confirm the
   `fadeMats` contract is byte-identical in shape, confirm every referenced texture
   folder exists on disk, confirm no accent material gained a map.
5. User verifies in browser — all three guardian encounters, including fade-in,
   defeat scatter, and beacon-distance readability.

## Risks

- **Texel density.** One repeat tier per material is an approximation; a 0.05-radius
  spear and a 1.35-radius torso share a limb material. Mitigated by choosing tiers
  against each guardian's *dominant* part and accepting stretch on the slivers.
- **VRAM.** ~7 extra 512 sets ≈ 1–2 MB uploaded once per session. Within the
  low-end/mobile budget the zone pass established.
- **Fog.** Guardians are usually seen through heavy fog; detail may be subtle at
  range. This is intended — the payoff is at encounter distance.
