// ============================================================
// ROOM SHELL — shared surface primitives for every museum room
// ============================================================
// The lobby (Museum.js) and each per-zone gallery (GalleryRing.js) build the same
// kind of surfaces from the same CC0 texture sets: tiled planes, walls split
// around a doorway, and materials bound to color/normal/roughness maps. These
// primitives live here so neither room builder owns a private copy.
import * as THREE from 'three';

// Tracks every geometry/material/texture a builder creates so a single dispose()
// frees them all. Mirrors the _geo/_mat push-and-return idiom SoulPedestal
// already uses; each owner (Museum, GalleryRing) keeps its own tracker so
// disposal follows the same ownership tree as construction.
export class Tracker {
  constructor() {
    this.geos = [];
    this.mats = [];
    this.texs = [];
  }

  geo(geometry) { this.geos.push(geometry); return geometry; }
  mat(material) { this.mats.push(material); return material; }
  tex(texture) { this.texs.push(texture); return texture; }

  // Free one tracked texture early — used when a canvas sign is repainted and its
  // old texture would otherwise leak until the whole museum is disposed.
  drop(texture) {
    if (!texture) return;
    const i = this.texs.indexOf(texture);
    if (i >= 0) this.texs.splice(i, 1);
    texture.dispose();
  }

  dispose() {
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
    for (const t of this.texs) t.dispose();
    this.geos.length = 0;
    this.mats.length = 0;
    this.texs.length = 0;
  }
}

// Bake world-size-proportional UV repeats into a plane geometry so a shared
// tiling texture keeps consistent texel density on planes of very different sizes
// (walls, floor, ceiling). `mat.userData.tile` = world units per repeat; a no-op
// for untextured materials (hallway walls) so it is always safe to call.
export function tilePlane(geometry, w, h, mat) {
  const t = mat && mat.userData && mat.userData.tile;
  if (!t) return geometry;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / t, (uv.getY(i) * h) / t);
  uv.needsUpdate = true;
  return geometry;
}

// A flat wall panel (plane) of the given size, positioned + rotated about Y and
// added to `parent`. Single-sided: the front face must point INTO the room, or the
// panel shows nothing (the background) from behind.
export function wall(parent, mat, x, y, z, w, h, ry, tracker) {
  const geometry = tilePlane(tracker.geo(new THREE.PlaneGeometry(w, h)), w, h, mat);
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  parent.add(mesh);
  return mesh;
}

// Load one committed CC0 (ambientCG) texture set from assets/textures/<name>/.
// Every set is the same three JPGs: color (sRGB), OpenGL-style normal, roughness.
export function loadTextureSet(loader, name, tracker) {
  const base = `assets/textures/${name}/`;
  const color = loader.load(`${base}color.jpg`);
  color.colorSpace = THREE.SRGBColorSpace;
  const normal = loader.load(`${base}normal.jpg`);
  const rough = loader.load(`${base}roughness.jpg`);
  for (const tx of [color, normal, rough]) {
    tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
    tx.anisotropy = 4;
    tracker.tex(tx);
  }
  return { color, normal, rough };
}

// Render a two-line museum plaque (a bold title over a subtitle) to a canvas
// texture, at the 3.2:1 aspect every plaque mesh in the museum is built to. `dim`
// mutes the glow for a sealed destination. Shared by the lobby's doorway lintels,
// each gallery's zone marker, and the Endless Echoes arch, so every plaque in the
// building is drawn by one routine.
export function plaqueTexture(title, subtitle, dim, tracker, accentColor) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 160;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const accent = dim ? '#7c8b93' : (accentColor || '#ffe6b0');
  ctx.fillStyle = accent;
  ctx.shadowColor = accent;
  ctx.shadowBlur = dim ? 0 : 18;
  ctx.font = 'bold 64px Georgia, serif';
  ctx.fillText(title, c.width / 2, 54);

  ctx.shadowBlur = dim ? 0 : 10;
  ctx.fillStyle = dim ? '#9c6b6b' : '#d3e8ec';
  ctx.font = dim ? 'bold 40px Georgia, serif' : '38px Georgia, serif';
  ctx.fillText(subtitle, c.width / 2, 120);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tracker.tex(tex);
}

// A zone plaque: number + district name, or "LOCKED" in place of a hidden name.
export function signTexture(zone, name, locked, tracker) {
  return plaqueTexture(`ZONE ${zone}`, locked ? 'LOCKED' : name, locked, tracker);
}

// Bind a loaded set to a material. Crucially `.color` is left untouched — the
// dark-intro / bright-hub tint stays the mood driver (see Museum.setHubLighting);
// the albedo map just multiplies against it for surface detail.
export function applyTextureSet(mat, set, { repeat = 1, envMapIntensity = 0.4 } = {}) {
  mat.map = set.color;
  mat.normalMap = set.normal;
  mat.roughnessMap = set.rough;
  mat.roughness = 1;              // now driven by the roughness map
  // Keep IBL gentle per-material (version-proof — Scene.environmentIntensity only
  // exists in newer three) so the HDRI reflections stay subtle and never wash out
  // the tuned hub palette or cross the bloom threshold.
  mat.envMapIntensity = envMapIntensity;
  if (repeat !== 1) {
    // Small props (plinths, trim) are cylinders/torii, so they can't use the
    // per-plane UV baking tilePlane does for walls — they scale the texture repeat
    // instead. NOTE this mutates the SET, not just this material, so only pass
    // `repeat` for a set with a single consumer (marble-pale and brass are).
    for (const map of [mat.map, mat.normalMap, mat.roughnessMap]) map.repeat.setScalar(repeat);
  }
  mat.needsUpdate = true;
  return mat;
}
