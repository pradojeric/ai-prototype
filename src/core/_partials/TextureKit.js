// ============================================================
// TEXTURE KIT — shared CC0 PBR texture loading + UV tiling
// ============================================================
// One module-level loader and cache for the committed ambientCG sets under
// `assets/textures/` (see that folder's CREDITS.md). This is deliberately
// module-scoped rather than per-instance: a `World` is constructed and
// `dispose()`d on every portal transit, so a per-World loader would re-fetch and
// re-decode every JPG each time the player changes zone. The cache means each
// set is uploaded to the GPU exactly once for the whole session.
//
// Safe against World.dispose(): that walks the scene calling `material.dispose()`,
// which in three r160 does NOT dispose the material's textures — so the cached
// sets survive a zone swap intact. Nothing here should ever be disposed.
//
// The `tile*UVs` helpers bake world-size-proportional repeats into a geometry's
// UVs so one shared texture keeps consistent texel density across surfaces of
// very different sizes. Baking (rather than cloning a texture per size) matters
// here: a texture clone is a separate GPU upload, while the zone primitives
// already allocate a fresh geometry per mesh, so baked UVs are free.
import * as THREE from 'three';

const BASE = 'assets/textures/';

let loader = null;
const cache = new Map();   // folder name → { color, normal, rough }

// Load (or return the cached) color/normal/roughness set for a texture folder.
// Textures pop in asynchronously; callers get the objects immediately.
export function getTextureSet(name) {
  const hit = cache.get(name);
  if (hit) return hit;

  loader ||= new THREE.TextureLoader();
  const color = loader.load(`${BASE}${name}/color.jpg`);
  color.colorSpace = THREE.SRGBColorSpace;
  const normal = loader.load(`${BASE}${name}/normal.jpg`);
  const rough = loader.load(`${BASE}${name}/roughness.jpg`);
  for (const tex of [color, normal, rough]) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
  }

  const set = { color, normal, rough };
  cache.set(name, set);
  return set;
}

// Bind a texture set onto a material, recording `tile` (world units per texture
// repeat) in userData for the tiling helpers below.
//
// `mat.color` is left UNTOUCHED on purpose (this follows Museum's approach, not
// RestoredKit's): every submerged zone expresses its mood as a palette colour
// override — zone 2 warm brass, zone 3 cold drowned limestone — so the albedo map
// has to multiply against that tint rather than replace it with white.
export function applyTextureSet(mat, name, tile) {
  const set = getTextureSet(name);
  mat.map = set.color;
  mat.normalMap = set.normal;
  mat.roughnessMap = set.rough;
  mat.roughness = 1;               // now driven by the roughness map
  mat.userData.tile = tile;
  mat.needsUpdate = true;
  return mat;
}

// --- UV tiling ------------------------------------------------------------
// Each helper is a no-op when the material carries no `tile`, so primitives can
// call them unconditionally even for untextured materials.

// BoxGeometry: per-face spans in three's face order (+x, -x, +y, -y, +z, -z).
export function tileBoxUVs(geo, w, h, d, mat) {
  const t = mat?.userData?.tile;
  if (!t) return geo;
  const uv = geo.attributes.uv;
  const spans = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [us, vs] = spans[f];
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, (uv.getX(i) * us) / t, (uv.getY(i) * vs) / t);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

export function tilePlaneUVs(geo, w, h, mat) {
  const t = mat?.userData?.tile;
  if (!t) return geo;
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / t, (uv.getY(i) * h) / t);
  uv.needsUpdate = true;
  return geo;
}

// CylinderGeometry: u wraps the circumference, v runs the height.
export function tileCylinderUVs(geo, radiusTop, radiusBottom, h, mat) {
  const t = mat?.userData?.tile;
  if (!t) return geo;
  const circumference = Math.PI * (radiusTop + radiusBottom);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (uv.getX(i) * circumference) / t, (uv.getY(i) * h) / t);
  }
  uv.needsUpdate = true;
  return geo;
}

// Fallback for geometries with no clean UV parameterisation (icosahedra, torus
// knots, jittered rubble): scale the existing UVs by one nominal size.
export function tileUniformUVs(geo, size, mat) {
  const t = mat?.userData?.tile;
  if (!t) return geo;
  const r = size / t;
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * r, uv.getY(i) * r);
  uv.needsUpdate = true;
  return geo;
}
