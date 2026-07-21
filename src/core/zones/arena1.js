// ============================================================
// ARENA 1 — "Riddle Breakers" Memory Arena for Zone 1 (Strings v2.0).
// An enclosed, circular spectral kitchen/marketplace ringed by void: the player
// is pulled here from the main zone's Memory Rift to face the Feastkeeper. Waves
// of drowned echoes attack while the guardian's bugtong is answered by shooting
// coral answer nodes (see arena/ArenaController.js). No artifacts spawn here —
// this is a pure combat space; winning returns to the main zone for collection.
//
// Like every zone this is a *zone definition* consumed by the World engine: the
// build hook uses World primitives + a local wall-ring helper, driving the
// seeded RNG in a fixed order. Registered in zones/index.js.
// ============================================================
import * as THREE from 'three';
import { CONFIG, ARENA, COMBAT } from '../../config.js';

const W = CONFIG.WATER_LEVEL;

// A ring of tall wall segments enclosing the play space (octagon-ish). Each
// segment is a solid box collider so echoes and the player stay inside; the void
// background + tight fog swallow everything past the ring.
function wallRing(world) {
  const R = ARENA.WALL_RADIUS;
  const segs = 16;
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const x = Math.cos(a) * R;
    const z = Math.sin(a) * R;
    const h = 8 + world.rng() * 4;
    const seg = new THREE.Mesh(
      new THREE.BoxGeometry(R * 0.9, h, 2.4),
      world.rng() > 0.5 ? world.mat.building : world.mat.buildingAlt,
    );
    seg.position.set(x, h / 2, z);
    seg.rotation.y = a + Math.PI / 2;   // tangent to the circle
    world.scene.add(seg);
    const [hw, hd] = world._footprint(R * 0.45, 1.2, a + Math.PI / 2);
    world.addCollider(x, z, hw, hd);
  }
}

// Spectral kitchen dressing: broken market stalls arranged around the ring, plus
// a low central dais with a cold glow so the fighting ground reads at a glance.
function kitchen(world) {
  const stalls = 7;
  for (let i = 0; i < stalls; i++) {
    const a = (i / stalls) * Math.PI * 2 + 0.4;
    const r = ARENA.WALL_RADIUS - 6;
    world._stall(Math.cos(a) * r, Math.sin(a) * r, a + Math.PI / 2,
      { broken: world.rng() < 0.5, tilt: (world.rng() - 0.5) * 0.2 });
  }

  // Central dais: a wide, low, non-colliding slab the player defends from.
  const dais = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 5.4, 0.4, 24),
    world.mat.concrete,
  );
  dais.position.set(ARENA.CENTER.x, W - 0.2, ARENA.CENTER.z);
  world.scene.add(dais);

  // Cold additive glow ring on the dais edge (emissive geometry, no light).
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0x2f6f6a, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const glow = new THREE.Mesh(new THREE.TorusGeometry(5, 0.12, 8, 32), glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(ARENA.CENTER.x, W + 0.05, ARENA.CENTER.z);
  world.scene.add(glow);
  world.shafts.push({ mesh: glow, mat: glowMat, base: 0.5, phase: 0 });  // reuse the shimmer loop
}

// A cold ring drawn on the water at `radius`, added to the shimmer loop.
function waterRing(world, radius, opacity, color = 0x2f6f6a) {
  const mat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.07, 6, 48), mat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(ARENA.CENTER.x, W + 0.03, ARENA.CENTER.z);
  world.scene.add(ring);
  world.shafts.push({ mesh: ring, mat, base: opacity, phase: radius });
}

// The band the drowned echoes rise from. CombatManager telegraphs each spawn
// with a contracting ground ring (CombatVfx.spawnTelegraph) — these faint marks
// give that warning somewhere to land, so the threat is legible before it forms.
function spawnBand(world) {
  waterRing(world, COMBAT.SPAWN_RADIUS_MIN, 0.16);
  waterRing(world, COMBAT.SPAWN_RADIUS_MAX, 0.13);
  // Cold rim glow along the foot of the wall ring, closing the space visually.
  waterRing(world, ARENA.WALL_RADIUS - 1.2, 0.22, 0x27585c);
}

// Minimal spawn nodes: the arena spawns enemies on a ring around the center
// (CombatManager owns that), so these only feed NavGrid fallbacks + any generic
// world query. A few open points near the dais keep those safe.
function setSpawnNodes(world) {
  world.spawnNodes.open_water = [
    [0, 0], [8, 0], [-8, 0], [0, 8], [0, -8], [10, 10], [-10, -10],
  ];
  world.spawnNodes.near_wall = [[18, 0], [-18, 0], [0, 18], [0, -18]];
  world.spawnNodes.submerged_interior = [[0, 0]];
  world.spawnNodes.elevated_rubble = [[0, 0]];
}

export const arena1 = {
  id: 'arena1',
  name: 'Memory Arena — Ponsia',
  label: 'Memory Arena',
  seed: 20260720,
  // The Feastkeeper waits ahead of the player's center spawn, facing them.
  guardianStart: { x: 0, z: -10 },
  guardianName: { fil: 'Bantay ng Piging', eng: 'The Feastkeeper' },
  guardianRebuke: 'You cannot break what you cannot answer. The feast remembers.',
  background: 0x02080a,            // near-black void beyond the ring
  fog: { color: 0x04121a, density: 0.05 },
  palette: {},
  build(world) {
    wallRing(world);
    kitchen(world);
    spawnBand(world);
    setSpawnNodes(world);
    // A little drifting flotsam for life; keep it off the center spawn.
    world._debris({ count: 16, clear: { x: ARENA.CENTER.x, z: ARENA.CENTER.z, r: 7 } });
  },
};
