// ============================================================
// GUARDIAN TEXTURE KIT — CC0 PBR surface detail for the boss bodies
// ============================================================
// Guardians can't use `TextureKit`'s baked-UV path. That path works for the zones
// because every zone surface funnels through a handful of primitives (`_building`,
// `_tower`, …) that can tile their own geometry. Each Guardian builder instead
// constructs ~80 meshes from inline geometry at wildly different scales, so
// threading a tiling call through every construction site would be a large,
// error-prone diff for no visual gain at boss scale.
//
// Instead we clone a texture set per *repeat tier* and set `.repeat` directly.
// Two things make that cheap:
//   - `Texture.clone()` in three r160 shares the underlying `Source`, and the
//     WebGL texture cache keys on source + sampler state (wrap/filter/anisotropy),
//     none of which we change. Clones therefore reuse the SAME GPU texture — the
//     repeat lands in the per-map `uvTransform` uniform, not in sampler state.
//   - Tiers are shared across all three guardians and cached module-side, so the
//     clone count is bounded by tiers used (~8), not by material count.
//
// Cloning rather than mutating the cached set is mandatory: `World` and `Museum`
// use those same textures at `repeat = 1` with UVs already baked into geometry.
// Mutating `.repeat` there would double-tile every wall in the game.
//
// Nothing here is ever disposed — same lifecycle contract as `TextureKit` (a
// Guardian is rebuilt per encounter; a `World` is disposed on every portal transit).
import { getTextureSet } from '../../_partials/TextureKit.js';

const tiers = new Map();   // `${name}@${repeat}` → { color, normal, rough }

// A texture set pre-scaled to `repeat` tiles across each mesh's existing UVs.
export function guardianSet(name, repeat) {
  const key = `${name}@${repeat}`;
  const hit = tiers.get(key);
  if (hit) return hit;

  const base = getTextureSet(name);
  const scaled = (tex) => {
    const t = tex.clone();
    t.repeat.set(repeat, repeat);
    t.needsUpdate = true;
    return t;
  };
  const set = { color: scaled(base.color), normal: scaled(base.normal), rough: scaled(base.rough) };
  tiers.set(key, set);
  return set;
}

// Bind a texture set onto an existing `fadeMat`, in place.
//
// `mat.color` is deliberately left ALONE (same rule as `TextureKit.applyTextureSet`):
// each guardian's palette is its identity — the Feastkeeper's jade, the Reveler's
// coral teal, the Keeper's mossy gold-seamed stone — and those tints have to survive,
// so the albedo map multiplies against them rather than replacing them.
//
// `albedo: false` binds normal + roughness only. Use it wherever the source albedo is
// strongly hued enough to muddy the tint it would multiply into (bamboo's yellow-green
// or sponge's orange against a teal body). That keeps the "preserve tints" rule intact
// while still buying the surface relief, which is what actually reads at boss scale.
//
// Opacity, transparency and emissive are untouched, so the material stays valid for the
// Guardian shell's fade lifecycle (`fadeMats`).
export function skin(mat, name, { repeat = 1, albedo = true } = {}) {
  const set = guardianSet(name, repeat);
  if (albedo) mat.map = set.color;
  mat.normalMap = set.normal;
  mat.roughnessMap = set.rough;
  mat.roughness = 1;               // now driven by the roughness map
  mat.needsUpdate = true;
  return mat;
}
