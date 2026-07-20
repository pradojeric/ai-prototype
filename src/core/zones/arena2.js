// ============================================================
// ARENA 2 — LIKET's spectral river. The World supplies water, lighting, and fog;
// RailScenery supplies the stationary bangkâ and recyclable festival banks.
// ============================================================
import { CONFIG, RAIL_ARENA } from '../../config.js';

function setSpawnNodes(world) {
  world.spawnNodes.open_water = [[0, 0], [-8, -18], [8, -18], [-5, -28], [5, -28]];
  world.spawnNodes.near_wall = [[-12, -20], [12, -20]];
  world.spawnNodes.submerged_interior = [[0, -28]];
  world.spawnNodes.elevated_rubble = [[0, -28]];
}

export const arena2 = {
  id: 'arena2',
  name: 'Memory River — LIKET',
  label: 'Memory River',
  seed: 20260722,
  controller: 'rail',
  guardianVariant: 'zone2',
  aimOnly: true,
  playerStart: {
    x: RAIL_ARENA.CENTER.x,
    y: RAIL_ARENA.BOAT_EYE_BASE + CONFIG.EYE_HEIGHT,
    z: RAIL_ARENA.CENTER.z,
  },
  guardianStart: { x: 0, z: -31 },
  guardianName: { fil: 'The Reveler', eng: 'The Reveler' },
  guardianRebuke: 'The festival remembers every missed light.',
  background: 0x07171d,
  fog: { color: 0x102d32, density: 0.026 },
  palette: {
    seabed: 0x10251f, cloth: 0x8f3f42, sign: 0xd6a23e,
    building: 0x1b302d, buildingAlt: 0x243a32,
  },
  build(world) {
    setSpawnNodes(world);
  },
};
