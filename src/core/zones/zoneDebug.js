// ============================================================
// DEBUG ZONE — a tiny test arena (not a shipped district)
// A compact, near-flat space for iterating on gameplay (collection, the riddle
// Guardian, discovery UI, cutscenes) without the long descend + Guardian hunt of
// the full zones. Force it on via CONFIG.DEBUG_ZONE (see zones/index.js); the
// normal find-Guardian → 3 riddles → scatter loop still runs, just in a small box.
//
// Layout: the player spawns on the south dock (cz≈34, matching the hardcoded rig
// spawn in PlayerController) and walks a short way north into a mangrove-bounded
// arena whose spawn nodes are clustered around z≈6..20 — close enough that the
// Guardian stays nearby, far enough (≥16 m) from the dock that its _pickSpot can
// place it (GUARDIAN.MIN_PLAYER_DIST). Consumed by the World engine like any zone.
// ============================================================
import * as THREE from 'three';
import { CONFIG } from '../../config.js';

const W = CONFIG.WATER_LEVEL;

// A few low cubes near the arena center — solid collision test targets.
function testProps(world) {
  const spots = [[-6, 12], [6, 14], [0, 6]];
  for (const [x, z] of spots) {
    const s = 1.2;
    const box = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), world.mat.building);
    box.position.set(x, W + s / 2, z);
    world.scene.add(box);
    world.addCollider(x, z, s / 2, s / 2);
  }
}

// Tight spawn-node cluster (z≈6..20, x≈-14..14): keeps artifacts reachable and
// the roaming Guardian close, while staying ≥16 m from the dock at z=35.
function setSpawnNodes(world) {
  world.spawnNodes.near_wall = [[-12, 8], [12, 10]];
  world.spawnNodes.submerged_interior = [[0, 14], [-8, 18]];
  world.spawnNodes.open_water = [[0, 10], [8, 6], [-8, 6], [10, 18]];
  world.moundSpots.push([6, 20], [-6, 16]);
  world.spawnNodes.elevated_rubble = world.moundSpots.slice();
}

export const zoneDebug = {
  id: 'zoneDebug',
  name: 'Debug Arena',
  label: 'Debug Arena',   // descend-screen heading

  seed: 1337,
  background: 0x0c2b2c,
  fog: { color: 0x123c3a, density: CONFIG.FOG_DENSITY },
  palette: {},   // default flooded-market materials
  build(world) {
    world._dock({ cx: 0, cz: 34 });            // catches the hardcoded rig spawn at z=35
    world._mangroveRing({ radius: 40, step: 3.6 });   // visible boundary enclosing the dock
    testProps(world);
    world._lightShaft(0, 8, { topR: 3.2, height: W + 14 });   // arena landmark
    setSpawnNodes(world);
  },
};
