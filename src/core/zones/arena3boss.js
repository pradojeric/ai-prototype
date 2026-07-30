// ============================================================
// ARENA 3 BOSS — THE KEEPER'S DECK.
//
// Reached by walking into the portal at the summit of the Memory Tower (arena3).
// A hollow octagonal platform adrift above flooded Pananisia — no climb, no tide,
// just the Keeper of Memories.
//
// SCAFFOLD: this is a deliberately plain traversable stage awaiting its real
// design. What is NOT arbitrary is its scale — the deck is built at the tower
// summit height, with a broader combat footprint for the Keeper's mobile duel.
//
// Geometry publishes authored encounter anchors; the fight is owned by
// KeeperArenaController and TowerCombatManager.
// ============================================================
import * as THREE from 'three';
import { CONFIG, TOWER_ARENA } from '../../config.js';

const DECK_HEIGHT = TOWER_ARENA.SUMMIT_HEIGHT;   // 18 — must match the Keeper's tuning
const DECK_RADIUS = 10.8;                        // 20% broader than the old deck
const DECK_APOTHEM = DECK_RADIUS * Math.cos(Math.PI / 8);
const DECK_THICKNESS = 0.28;
const COMBAT_RADIUS = 8.16;
const RAIL_HEIGHT = 0.8;
const RAIL_WIDTH = 0.14;
const ENTRY_POINT = {
  x: DECK_APOTHEM / Math.sqrt(2),
  z: DECK_APOTHEM / Math.sqrt(2),
};

function buildDeck(world) {
  const deck = new THREE.Mesh(
    new THREE.CylinderGeometry(DECK_RADIUS, DECK_RADIUS, DECK_THICKNESS, 8),
    world.mat.buildingAlt,
  );
  deck.position.y = DECK_HEIGHT - DECK_THICKNESS / 2;
  deck.rotation.y = Math.PI / 8;
  world.scene.add(deck);
  // Sampled to the apothem, not the circumradius: the square still covers every
  // octagon vertex without extending the walkable plane past the rails.
  world.addSupportSurface(0, 0, DECK_APOTHEM, DECK_APOTHEM, 0, DECK_HEIGHT);
  // Deliberately nothing underneath: the deck stays a thin floating slab so the
  // air beneath its rim is clear, the way the tower's hollow shaft was. A solid
  // understructure here fills the Keeper intro's low camera angles with stone.
}

function buildRails(world) {
  const vertices = [];
  for (let i = 0; i < 8; i++) {
    const angle = Math.PI / 8 + i * Math.PI / 4;
    vertices.push({
      x: Math.cos(angle) * DECK_RADIUS,
      z: Math.sin(angle) * DECK_RADIUS,
    });
  }
  for (let side = 0; side < vertices.length; side++) {
    const start = vertices[side];
    const end = vertices[(side + 1) % vertices.length];
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.hypot(dx, dz);
    const rotation = Math.atan2(dx, dz);
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(RAIL_WIDTH, RAIL_HEIGHT, length),
      world.mat.metal,
    );
    rail.position.set(
      (start.x + end.x) / 2,
      DECK_HEIGHT + RAIL_HEIGHT / 2,
      (start.z + end.z) / 2,
    );
    rail.rotation.y = rotation;
    world.scene.add(rail);
    // The deck is fully enclosed — unlike the tower summit there is no bridge
    // mouth to leave open, since the only way in is the portal.
    world.addCollider(rail.position.x, rail.position.z, RAIL_WIDTH / 2, length / 2, {
      minY: DECK_HEIGHT - 0.55,
      maxY: DECK_HEIGHT + 1.35,
      rotation,
    });
  }
}

// Braziers marking the four add-spawn anchors, so the summoned echoes read as
// arriving from somewhere rather than appearing out of nothing.
function buildMarkers(world, anchors) {
  const geometry = new THREE.CylinderGeometry(0.34, 0.46, 0.5, 6);
  for (const anchor of anchors) {
    const marker = new THREE.Mesh(geometry, world.mat.concrete);
    marker.position.set(anchor.x, DECK_HEIGHT + 0.25, anchor.z);
    world.scene.add(marker);
  }
}

function publishAnchors(world) {
  // Same keys the tower summit published, so TowerCombatManager and TowerKeeper
  // bind to this deck without knowing they left the tower.
  world.towerFlightAnchors = [];
  world.towerGargoyleAnchors = [];
  world.towerBossAddAnchors = [
    { x: 6.24, z: 0 },
    { x: 0, z: -6.24 },
    { x: -6.24, z: 0 },
    { x: 0, z: 6.24 },
  ].map((point, index) => ({
    ...point,
    y: DECK_HEIGHT,
    flight: index,
    rotation: index % 2 ? Math.PI / 2 : 0,
    halfW: 1.6,
    halfD: 1.6,
    startHeight: DECK_HEIGHT,
    endHeight: DECK_HEIGHT,
    localX: 0,
    localZ: 0,
  }));
  world.towerSummitBounds = {
    height: DECK_HEIGHT,
    radius: DECK_RADIUS,
    combatRadius: COMBAT_RADIUS,
    entry: { ...ENTRY_POINT },
  };
  return world.towerBossAddAnchors;
}

function setSpawnNodes(world) {
  world.spawnNodes.open_water = [[0, 0]];
  world.spawnNodes.near_wall = [];
  world.spawnNodes.submerged_interior = [];
  world.spawnNodes.elevated_rubble = [];
}

export const arena3boss = {
  id: 'arena3boss',
  name: 'The Keeper of Memories — Pananisia',
  label: "Keeper's Deck",
  controller: 'keeper',
  spawnGuardian: false,
  // Fresh per read, like arena3: the Keeper's attack scheduling and add spawns
  // are seeded from it, so retries do not replay an identical fight.
  get seed() {
    return (Math.random() * 0x1_0000_0000) >>> 0;
  },
  // Arriving at the deck edge, facing the middle where the Keeper reforms.
  playerStart: {
    x: ENTRY_POINT.x * 0.62,
    y: DECK_HEIGHT + CONFIG.EYE_HEIGHT,
    z: ENTRY_POINT.z * 0.62,
  },
  background: 0x030811,
  fog: { color: 0x091522, density: 0.018 },
  palette: {
    building: 0x33414d,
    buildingAlt: 0x465461,
    concrete: 0x52616c,
    metal: 0x48605f,
    seabed: 0x0a141c,
  },
  build(world) {
    world.waterMat.uniforms.uColor.value.set(0x1a3342);
    world.setWaterLevel(TOWER_ARENA.BOSS_WATER_HEIGHT);
    buildDeck(world);
    buildRails(world);
    buildMarkers(world, publishAnchors(world));
    setSpawnNodes(world);
  },
};
