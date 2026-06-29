// ============================================================
// ZONE 3 — PLACEHOLDER (cold-blue deep channel)
// A bare arena standing in for a future full district, mirroring zone2's purpose:
// prove the hub→zone→hub loop with a flat bounded play space, a few scattered
// cover boxes, the spawn dock, and spawn nodes for every artifact tag. No
// landmarks — replace this whole file when Zone 3 is designed for real.
//
// Consumed by the World engine (src/core/World.js); register in zones/index.js.
// Build order drives the seeded RNG, so keep it stable.
// ============================================================
import { CONFIG } from '../../config.js';

// Scattered cover boxes (x, z, w, d, h, rot) — a different loose arrangement
// from zone2 so the two placeholders don't read identically.
const BLOCKS = [
  [-22, -8, 5, 8, 6, 0.3],
  [10, -22, 6, 6, 5, 0],
  [24, 2, 6, 5, 7, -0.4],
  [-14, 20, 7, 5, 4.5, 0.6],
  [2, 2, 6, 6, 5.5, 0],
  [-4, -26, 5, 6, 6, -0.2],
];

function blocks(world) {
  for (const [x, z, w, d, h, rot] of BLOCKS) world._building(x, z, w, d, h, rot);
}

function setSpawnNodes(world) {
  world.spawnNodes.near_wall = [[-22, -4], [10, -18], [-14, 16], [24, -2]];
  world.spawnNodes.submerged_interior = [[2, -2], [-4, -22], [10, -18]];
  for (const spot of [[-10, 6], [14, 10]]) world.moundSpots.push(spot);
  world.spawnNodes.elevated_rubble = world.moundSpots.slice();
  world.spawnNodes.open_water = [[0, 6], [0, -10], [-8, 20], [12, 16]];
}

export const zone3 = {
  id: 'zone3',
  name: 'Deep Channel (placeholder)',
  label: 'Zone 3 — Deep Channel',   // descend-screen heading
  seed: 20260714,
  guardianStart: { x: 0, z: 16 },   // waits ahead of the dock in the open arena
  guardianRebuke: 'You falter, and the deep channel claims you. Return when your mind is clear.',   // shown on a wrong riddle answer
  // Spoken (as a subtitle) one line at a time right after the player descends. PLACEHOLDER.
  introDialogue: [
    '[Zone 3 — Deep Channel] No light reaches this far down.',
    '[Zone 3 placeholder] The deep channel remembers everything it swallowed.',
  ],
  background: 0x081826,
  fog: { color: 0x0e2740, density: CONFIG.FOG_DENSITY },
  palette: {},
  build(world) {
    blocks(world);
    world._dock({ cx: 0, cz: 34 });
    world._mangroveRing({ radius: 47, step: 3.6 });
    world._debris();
    setSpawnNodes(world);
  },
};
