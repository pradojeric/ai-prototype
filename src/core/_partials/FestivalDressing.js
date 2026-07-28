// ============================================================
// FESTIVAL DRESSING — lanterns, garlands and banners (GDD Zone 2 "LIKET")
// ============================================================
// The decorative vocabulary layered over a zone's floor plan: sagging cables,
// glowing paper lanterns, pennant bunting, and the parul (star-lantern) mast.
// Split out of World.js to keep the engine file under the 1000-line cap; World
// re-exposes each of these as a thin `_name(...)` method, so every existing zone
// call site (`world._lantern(...)`, `world._bunting(...)`) is unchanged.
//
// Two invariants to preserve when editing:
//   · NO `THREE.Light`. Many small point lights tank the forward renderer (see
//     Museum's per-slot-SpotLight perf fix); glow here is additive emissive
//     geometry picked up by the existing bloom pass.
//   · NO new animation loop. Motion reuses the two generic per-frame lists World
//     already walks — `world.debris` (bob + slow spin) and `world.shafts`
//     (breathing opacity) — so nothing here needs its own update() hook.
//
// Each function takes the World instance as `world` and draws from `world.rng`,
// so call order stays layout-significant for the seeded layout.
import * as THREE from 'three';

// A segmented rope/cable tracing a sagging line between two points (`y1`/`y2`
// may differ for a sloped span). Decor only, never solid.
export function sagLine(world, x1, z1, x2, z2, y1, y2, sag, opts = {}) {
  const { segs = 8, thickness = 0.035, mat = world.mat.wood } = opts;
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    pts.push(new THREE.Vector3(
      x1 + (x2 - x1) * t,
      y1 + (y2 - y1) * t - sag * Math.sin(Math.PI * t),
      z1 + (z2 - z1) * t,
    ));
  }
  const g = new THREE.Group();
  for (let i = 0; i < segs; i++) {
    const a = pts[i], b = pts[i + 1];
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(thickness, thickness, a.distanceTo(b), 5), mat);
    seg.position.copy(a).lerp(b, 0.5);
    seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    g.add(seg);
  }
  world.scene.add(g);
  return g;
}

// A single glowing paper lantern: faceted shell + additive glow core. Pure
// decor — drifts via `world.debris`, flickers via `world.shafts`, never solid.
export function lantern(world, x, y, z, opts = {}) {
  const { color = 0xffb35c, scale = 1, bodyMat = world.mat.sign } = opts;
  const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.22 * scale, 0), bodyMat);
  body.position.set(x, y, z);
  body.rotation.y = world.rng() * Math.PI;
  world.scene.add(body);

  const glowMat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.3 * scale, 8, 6), glowMat);
  glow.position.set(x, y, z);
  world.scene.add(glow);

  const phase = world.rng() * Math.PI * 2;
  const spin = (world.rng() - 0.5) * 0.4, amp = 0.08 + world.rng() * 0.06;
  world.debris.push({ mesh: body, baseY: y, phase, spin, amp });
  world.debris.push({ mesh: glow, baseY: y, phase, spin: 0, amp });
  world.shafts.push({ mat: glowMat, base: 0.5, phase });
}

// A garland of lanterns strung along a sagging line between two points. `y`/`y2`
// let the ends sit at different heights (e.g. masthead -> ground anchor).
export function lanternString(world, x1, z1, x2, z2, opts = {}) {
  const { y = 3.2, y2 = y, sag = 0.6, count = 6, color = 0xffb35c, drop = 0.18 } = opts;
  sagLine(world, x1, z1, x2, z2, y, y2, sag);
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const px = x1 + (x2 - x1) * t, pz = z1 + (z2 - z1) * t;
    const py = y + (y2 - y) * t - sag * Math.sin(Math.PI * t) - drop;
    lantern(world, px, py, pz, { color });
  }
}

// A hanging bunch of lanterns with no visible line (a "frozen chandelier"),
// optionally hung from a collidable support post.
export function lanternCluster(world, x, z, opts = {}) {
  const { count = 5, y = 3.0, radius = 0.6, color = 0xffb35c, withPost = false, postHeight = y } = opts;
  if (withPost) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, postHeight, 6), world.mat.wood);
    post.position.set(x, postHeight / 2, z);
    world.scene.add(post);
    world.addCollider(x, z, 0.12, 0.12);
  }
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + world.rng() * 0.3;
    const px = x + Math.cos(a) * radius, pz = z + Math.sin(a) * radius;
    const py = y + (world.rng() - 0.5) * 0.4;
    lantern(world, px, py, pz, { color, scale: 0.85 + world.rng() * 0.3 });
  }
}

// A sagging pennant garland between two posts (banners drift; they never glow —
// lanterns own the glow budget). `posts:false` for a loose scrap still clinging
// to a wreck with no real anchors.
export function bunting(world, x1, z1, x2, z2, opts = {}) {
  const {
    y = 3.4, y2 = y, sag = 0.9, pennants = 7,
    colors = [0xc0453f, 0xe8a23a, 0xdccb3f, 0x3f8f7a, 0x3f6fae],
    posts = true, postHeight = y,
  } = opts;
  if (posts) {
    for (const [px, pz] of [[x1, z1], [x2, z2]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, postHeight, 6), world.mat.wood);
      post.position.set(px, postHeight / 2, pz);
      world.scene.add(post);
      world.addCollider(px, pz, 0.14, 0.14);
    }
  }
  sagLine(world, x1, z1, x2, z2, y, y2, sag, { thickness: 0.03, mat: world.mat.rust });
  for (let i = 0; i < pennants; i++) {
    const t = (i + 1) / (pennants + 1);
    const px = x1 + (x2 - x1) * t, pz = z1 + (z2 - z1) * t;
    const py = y + (y2 - y) * t - sag * Math.sin(Math.PI * t) - 0.22;
    const flagMat = new THREE.MeshStandardMaterial({
      color: colors[i % colors.length], roughness: 1, side: THREE.DoubleSide,
    });
    const flag = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 3), flagMat);
    flag.rotation.set(Math.PI, world.rng() * Math.PI, 0);   // point-down triangular pennant
    flag.position.set(px, py, pz);
    world.scene.add(flag);
    world.debris.push({
      mesh: flag, baseY: py, phase: world.rng() * Math.PI * 2,
      spin: (world.rng() - 0.5) * 0.6, amp: 0.05 + world.rng() * 0.05,
    });
  }
}

// Zone-2 landmark: a slender mast topped by a giant glowing star lantern (a
// parul) with lantern-strung guy-lines radiating down to ground anchors. Reads
// through fog via glow + a warm light shaft, not bulk silhouette — only the mast
// pole is solid.
export function parulMast(world, x, z, opts = {}) {
  const {
    height = 13, starRadius = 1.7, spokes = 6,
    mat = world.mat.metal, glowColor = 0xffd25c,
  } = opts;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.26, height, 8), mat);
  mast.position.set(x, height / 2, z);
  world.scene.add(mast);
  world.addCollider(x, z, 0.3, 0.3);

  // Giant parol: two flattened octahedra crossed at 45° reads as an 8-point star.
  const starMat = new THREE.MeshBasicMaterial({
    color: glowColor, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  for (let i = 0; i < 2; i++) {
    const lobe = new THREE.Mesh(new THREE.OctahedronGeometry(starRadius, 0), starMat);
    lobe.scale.set(1, 0.35, 1);
    lobe.rotation.y = i * Math.PI / 4;
    lobe.position.set(x, height + starRadius * 0.5, z);
    world.scene.add(lobe);
  }
  world.shafts.push({ mat: starMat, base: 0.85, phase: world.rng() * Math.PI * 2 });

  // Radiating guy-lines of lanterns from the masthead down to ground anchors.
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    const ax = x + Math.cos(a) * 5.5, az = z + Math.sin(a) * 5.5;
    lanternString(world, x, z, ax, az,
      { y: height * 0.55, y2: 0.3, sag: 0.3, count: 3, color: glowColor });
  }
}
