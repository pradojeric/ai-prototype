// ============================================================
// GUARDIAN DEBUG ZONE — a compact, non-interactive flooded showroom.
// The three Guardian variants stand in a screenshot-friendly front-facing
// triangle, with Guardian 1 centered at the forward apex. Game's dedicated
// `debug` phase supplies the figures; this zone owns only atmosphere, authored
// placement, and simple inspection-safe collision.
// ============================================================
import { CONFIG } from '../../config.js';

export const DEBUG_GUARDIAN_LAYOUT = [
  { variant: 'zone2', x: -8, z: -4 },
  { variant: 'zone1', x: 0, z: 2 },
  { variant: 'zone3', x: 8, z: -4 },
];

export const DEBUG_GUARDIAN_FACING = { x: 0, z: 1 };

// One inert example of every regular arena threat. Pairs share a column by
// source zone, while the eight-metre row gap leaves room for isolated shots.
export const DEBUG_ENEMY_LAYOUT = [
  { zone: 'Zone 1', type: 'chaser', x: -10, z: -16 },
  { zone: 'Zone 1', type: 'spitter', x: -10, z: -24 },
  { zone: 'Zone 2', type: 'sniper', x: 0, z: -16 },
  { zone: 'Zone 2', type: 'boarder', x: 0, z: -24 },
  { zone: 'Zone 3', type: 'gargoyle', x: 10, z: -16 },
  { zone: 'Zone 3', type: 'gale', x: 10, z: -24 },
];

function addDisplayColliders(world) {
  for (const display of [...DEBUG_GUARDIAN_LAYOUT, ...DEBUG_ENEMY_LAYOUT]) {
    world.addCollider(display.x, display.z, 1.8, 1.8);
  }
}

function addInspectionLandmark(world) {
  // A restrained shaft behind the triangle anchors the display without becoming
  // a label or obscuring the Guardian silhouettes from the player side.
  world._lightShaft(0, -9, {
    topR: 2.4,
    height: CONFIG.WATER_LEVEL + 10,
  });
}

function setSpawnNodes(world) {
  // Guardian construction expects the generic zone contract even though the
  // display instances never roam or choose a spawn node.
  world.spawnNodes.open_water = DEBUG_GUARDIAN_LAYOUT.map(({ x, z }) => [x, z]);
}

export const zoneDebug = {
  id: 'zoneDebug',
  name: 'Guardian Debug Zone',
  label: 'Guardian Debug Zone',
  seed: 1337,
  guardianStart: { x: 0, z: 0 },
  guardianDisplays: DEBUG_GUARDIAN_LAYOUT,
  enemyDisplays: DEBUG_ENEMY_LAYOUT,
  displayFacing: DEBUG_GUARDIAN_FACING,
  playerStart: { x: 0, y: CONFIG.EYE_HEIGHT, z: 18 },
  background: 0x071c20,
  fog: { color: 0x0d3033, density: 0.025 },
  palette: {
    seabed: 0x102d2b,
    bark: 0x28231c,
    foliage: 0x27453a,
  },
  build(world) {
    world._mangroveRing({ radius: 34, step: 3.4 });
    addDisplayColliders(world);
    addInspectionLandmark(world);
    setSpawnNodes(world);
  },
};
