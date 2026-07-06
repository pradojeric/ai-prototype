// ============================================================
// ZONE 2 — PLACEHOLDER (murky-green flood basin)
// A bare arena standing in for a future full district. It exists to prove the
// hub→zone→hub loop: a flat play space bounded by the mangrove ring, a few
// scattered building boxes for collision context + Guardian/artifact cover, the
// spawn dock, and spawn nodes for every artifact tag. No landmarks, no custom
// districts — replace this whole file when Zone 2 is designed for real.
//
// Consumed by the World engine (src/core/World.js) like any zone def; register
// in zones/index.js. Build order drives the seeded RNG, so keep it stable.
// ============================================================
import { CONFIG } from '../../config.js';

// A few scattered cover boxes (x, z, w, d, h, rot). Loose, no layout meaning.
const BLOCKS = [
  [-18, -16, 6, 6, 5, 0],
  [16, -20, 7, 5, 6, 0.4],
  [22, 10, 5, 7, 4.5, -0.5],
  [-20, 14, 6, 6, 5.5, 0.2],
  [4, -28, 8, 5, 7, 0],
  [-6, 6, 5, 5, 4, 0.8],
];

function blocks(world) {
  for (const [x, z, w, d, h, rot] of BLOCKS) world._building(x, z, w, d, h, rot);
}

// Spawn nodes for every tag the artifacts key off (near_wall, submerged_interior,
// elevated_rubble, open_water). Spread across the arena and kept off the dock.
function setSpawnNodes(world) {
  world.spawnNodes.near_wall = [[-18, -12], [16, -16], [-20, 18], [22, 6]];
  world.spawnNodes.submerged_interior = [[4, -24], [-6, 2], [16, -24]];
  // a couple of rubble mounds double as the elevated anchors
  for (const spot of [[-12, -2], [12, -6]]) world.moundSpots.push(spot);
  world.spawnNodes.elevated_rubble = world.moundSpots.slice();
  world.spawnNodes.open_water = [[0, 8], [0, -8], [-10, 22], [10, 18]];
}

export const zone2 = {
  id: 'zone2',
  name: 'Flood Basin (placeholder)',
  label: 'Zone 2 — Flood Basin',   // descend-screen heading
  seed: 20260702,
  guardianStart: { x: 0, z: 16 },   // waits ahead of the dock in the open arena
  guardianRebuke: 'Not yet. The basin will not yield its drowned things to the unready.',   // shown on a wrong riddle answer
  // Spoken (as a subtitle) one line at a time right after the player descends. PLACEHOLDER.
  introDialogue: [
    '[Zone 2 — Flood Basin] The current pulls deeper here.',
    '[Zone 2 placeholder] Whatever sank in this basin has not finished speaking.',
  ],
  background: 0x0a2417,
  fog: { color: 0x113a26, density: CONFIG.FOG_DENSITY },
  palette: {},
  build(world) {
    blocks(world);
    world._dock({ cx: 0, cz: 34 });
    world._mangroveRing({ radius: 47, step: 3.6 });
    world._debris();
    setSpawnNodes(world);
  },
};
