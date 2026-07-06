// ============================================================
// ZONE 3 — THE DROWNED CATHEDRAL: the Memory Archive (GDD §3/§13)
// A solemn, vast underwater memory archive inspired by St. John the
// Evangelist Cathedral in downtown Dagupan. The player spawns on the south
// dock (+Z) — the ruined narthex — looking north (-Z) straight down the
// flooded nave: two colonnades of snapped-off stone pillars bridged by
// broken half-torus vault ribs, glowing pale "memory strings" woven between
// them, diagonal god-rays raking the aisle, and fragmented stone slabs
// drifting weightlessly toward the ruined altar. The Guardian (the Keeper
// of Memories) waits at the center of the nave just before the altar dais;
// beyond the apse, the surviving bell-tower marks the zone's far terminus.
//
// Deliberately denser fog + a near-black abyss background isolate the ruins:
// the map edges dissolve into darkness rather than reading as a boundary.
// Consumed by the World engine (src/core/World.js); registered in
// zones/index.js. Build order drives the seeded RNG — preserve it.
// ============================================================
import * as THREE from 'three';
import { CONFIG } from '../../config.js';

const W = CONFIG.WATER_LEVEL;

// One shared additive material for all "memory glow" decor (strings, ribs'
// halo, the Keeper's light) — registered once per mesh in world.shafts for
// the engine's breathing-opacity shimmer where it matters.
const GLOW_COLOR = 0xdfeffc;

function memoryStringMat() {
  return new THREE.MeshBasicMaterial({
    color: 0x9fd4e8, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
}

// ---- Narthex: the ruined entrance framing the dock (S) ----------------------
// Broken facade stubs flank the spawn; a shattered west portal arch marks the
// threshold onto the nave.
function narthex(world) {
  const h = () => 4.5 + world.rng() * 3;
  world._building(-11, 29, 8, 5, h(), 0.12);
  world._building(11, 29, 8, 5, h(), -0.1);
  world._building(-16, 22, 5, 6, h(), 0.4, { windows: false });
  world._building(16, 22, 5, 6, h(), -0.35, { windows: false });
  world._ruinArch(0, 26, 0, { span: 7, height: 5.5 });
}

// ---- Nave colonnade: two rows of broken pillars flanking the aisle ----------
// Most read as snapped-off column stumps; a few taller survivors carry the
// vault ribs. Heights come from the seeded RNG but the tall ones are pinned
// so ribs always have believable supports.
const PILLAR_ROWS = [22, 16, 10, 4, -2, -8];   // z stations, S → N
const TALL_ROWS = new Set([16, 4, -8]);        // rows that keep tall pairs

function naveColonnade(world) {
  world._pillarTops = {};   // z → [leftTopY, rightTopY], read by vaultRibs()
  for (const z of PILLAR_ROWS) {
    const tops = [];
    for (const s of [-1, 1]) {
      const tall = TALL_ROWS.has(z);
      const height = tall ? 11 + world.rng() * 3 : 3 + world.rng() * 4;
      world._tower(s * 6, z, { height, baseR: 1.15 + world.rng() * 0.3 });
      tops.push(height);
    }
    world._pillarTops[z] = tops;
  }
}

// ---- Vault ribs: half-torus archways spanning the nave ----------------------
// The cathedral's broken stone vaulting: upright half-torus ribs bridge the
// tall pillar pairs high over the aisle (decor, non-colliding), while fallen
// ribs lie half-buried in the water between the stumps.
function vaultRibs(world) {
  const ribGeo = () => new THREE.TorusGeometry(6, 0.42, 8, 14, Math.PI);
  for (const z of TALL_ROWS) {
    const topY = Math.min(...world._pillarTops[z]);
    const rib = new THREE.Mesh(ribGeo(), world.mat.concrete);
    rib.position.set(0, topY - 0.5, z);           // arc springs from the pillar tops
    rib.rotation.y = (world.rng() - 0.5) * 0.08;  // slight settle
    world.scene.add(rib);
  }
  // collapsed ribs, toppled into the aisle water (decor, walk-through)
  for (const [x, z, rot] of [[-2, 13, 0.9], [3, 1, -1.1], [-1, -5, 1.4]]) {
    const rib = new THREE.Mesh(ribGeo(), world.mat.rubble);
    rib.position.set(x, W - 0.2, z);
    rib.rotation.set(Math.PI / 2 + (world.rng() - 0.5) * 0.4, rot, 0);
    rib.scale.setScalar(0.55 + world.rng() * 0.2);
    world.scene.add(rib);
  }
}

// ---- Transepts: ruined side wings east + west of the crossing ---------------
// Broken chapel shells whose dark inset windows stand in for rose windows;
// they give the ArtifactManager interiors and the player mid-zone cover.
function transepts(world) {
  world._building(-20, 1, 10, 7, 7 + world.rng() * 2, Math.PI / 2);
  world._building(-27, -4, 6, 5, 4.5 + world.rng() * 2, Math.PI / 2, { windows: false });
  world._building(20, 1, 10, 7, 7 + world.rng() * 2, -Math.PI / 2);
  world._building(27, 5, 6, 5, 4.5 + world.rng() * 2, -Math.PI / 2, { windows: false });
  // side-chapel gateways off the crossing
  world._ruinArch(-11, -1, Math.PI / 2, { span: 5, height: 4.5 });
  world._ruinArch(11, -1, Math.PI / 2, { span: 5, height: 4.5 });
}

// ---- Altar + apse: the ruined sanctuary the nave leads to (N) ---------------
// A low stone dais (near water level — wade-over decor, like zone2's), a
// semicircle of pillar stumps tracing the lost apse wall behind it, and the
// Keeper's cold-white glow: emissive lantern "candles" plus a breathing
// additive orb over the guardian's waiting spot — no real THREE.Light, per
// the engine's glow budget.
function altarApse(world) {
  const cx = 0, cz = -18;
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4.1, 0.5, 10), world.mat.concrete);
  dais.position.set(cx, W - 0.1, cz);
  world.scene.add(dais);
  const altar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 1.1), world.mat.concrete);
  altar.position.set(cx, W + 0.5, cz - 0.5);
  altar.rotation.y = (world.rng() - 0.5) * 0.15;
  world.scene.add(altar);
  world.addCollider(cx, cz - 0.5, 1.2, 0.6);
  // apse: semicircle of stumps behind the altar
  const stumps = 7;
  for (let i = 0; i < stumps; i++) {
    const a = Math.PI * (0.15 + 0.7 * (i / (stumps - 1)));   // opens toward the nave
    const px = cx + Math.cos(a) * 8, pz = cz - 2 - Math.sin(a) * 6;
    world._tower(px, pz, { height: 2.5 + world.rng() * 5, baseR: 0.9 });
  }
  // cold votive light around the sanctuary
  world._lanternCluster(cx - 2.4, cz + 1.5, { count: 5, y: 2.4, radius: 0.9, color: GLOW_COLOR });
  world._lanternCluster(cx + 2.6, cz - 0.5, { count: 4, y: 3.0, radius: 0.7, color: GLOW_COLOR });
  // the Keeper's glow: a soft breathing orb over the guardian's waiting spot
  const orbMat = new THREE.MeshBasicMaterial({
    color: GLOW_COLOR, transparent: true, opacity: 0.16,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const orb = new THREE.Mesh(new THREE.SphereGeometry(2.6, 16, 12), orbMat);
  orb.position.set(0, 2.4, 15);
  world.scene.add(orb);
  world.shafts.push({ mat: orbMat, base: 0.16, phase: world.rng() * Math.PI * 2 });
}

// ---- Bell-tower: the surviving campanile, the zone's far terminus (N) -------
function bellTower(world) {
  world._tower(-4, -38, { height: 20, baseR: 2.4 });
  world._lanternCluster(-4, -38, { count: 4, y: 15, radius: 1.4, color: GLOW_COLOR });
}

// ---- Cloister ruins: sparse broken shells for map texture (edges) -----------
// Kept sparse on purpose — the dense fog does the isolating; these just stop
// the mid-distance reading as empty water.
function cloisterRuins(world) {
  const h = () => 4 + world.rng() * 4;
  for (const [x, z, rot] of [
    [-34, 18, 0.3], [-38, -6, Math.PI / 2], [-30, -28, 0.2],
    [34, 20, -0.25], [38, -10, -Math.PI / 2], [30, -30, -0.3],
    [14, -40, 0.1], [-20, 32, 0.15], [22, 30, -0.2],
  ]) {
    world._building(x, z, 6 + world.rng() * 4, 5 + world.rng() * 2, h(), rot);
  }
}

// ---- Floating fragments: stone slabs drifting toward the altar --------------
// Decorative only (non-walkable, non-colliding): thin broken floor slabs hang
// weightless over the nave in a loose rising path, driven by World's existing
// per-frame debris bob so they drift solemnly.
function floatingSlabs(world) {
  const count = 11;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const x = (world.rng() - 0.5) * 7;
    const z = 8 - t * 22;                       // mid-nave → past the altar
    const y = 2 + t * 4 + world.rng() * 0.8;    // rising as they approach
    const s = 1.2 + world.rng() * 1.6;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(s, 0.28, s * (0.6 + world.rng() * 0.5)), world.mat.rubble);
    slab.position.set(x, y, z);
    slab.rotation.set((world.rng() - 0.5) * 0.5, world.rng() * Math.PI, (world.rng() - 0.5) * 0.4);
    world.scene.add(slab);
    world.debris.push({
      mesh: slab, baseY: y, phase: world.rng() * Math.PI * 2,
      spin: (world.rng() - 0.5) * 0.06, amp: 0.1 + world.rng() * 0.06,
    });
  }
}

// ---- Memory strings: glowing threads woven through the colonnade ------------
// Pale additive catenaries laced pillar-to-pillar down the nave — the archive
// itself, strung between the stones. Uses the engine's segmented sag-line so
// the threads read through fog and bloom (a raw THREE.Line would stay 1px).
function memoryStrings(world) {
  const mat = memoryStringMat();
  const zs = PILLAR_ROWS;
  for (let i = 0; i < zs.length - 1; i++) {
    const z0 = zs[i], z1 = zs[i + 1];
    const y0 = Math.min(world._pillarTops[z0][0], 8) * 0.75;
    const y1 = Math.min(world._pillarTops[z1][1], 8) * 0.75;
    // diagonals: left pillar of one row to right pillar of the next
    world._sagLine(-6, z0, 6, z1, y0, y1, 0.8, { thickness: 0.03, mat });
    world._sagLine(6, z0, -6, z1, y1, y0, 0.8, { thickness: 0.03, mat });
  }
  // straight spans across the tall pairs, under the ribs
  for (const z of TALL_ROWS) {
    const y = Math.min(...world._pillarTops[z]) - 2;
    world._sagLine(-6, z, 6, z, y, y, 0.5, { thickness: 0.03, mat });
  }
  // threads converging on the sanctuary
  world._sagLine(-6, -8, 0, -18, 5, 2.2, 0.6, { thickness: 0.03, mat });
  world._sagLine(6, -8, 0, -18, 5, 2.2, 0.6, { thickness: 0.03, mat });
}

// ---- God rays: diagonal shafts raking the nave + sanctuary ------------------
// _lightShaft builds vertical cones and returns the mesh; tilting them gives
// the requested diagonal fall of light through the broken vault.
function lightShafts(world) {
  const shafts = [
    [0, 15, { topR: 3.4, height: W + 15, opacity: 0.1 }],    // over the Keeper
    [-2, -18, { topR: 3.8, height: W + 16, opacity: 0.11 }], // over the altar
    [3, 5, { topR: 3.0, height: W + 14, opacity: 0.08 }],    // mid-nave
    [-3, -5, { topR: 3.0, height: W + 14, opacity: 0.08 }],
    [-4, -38, { topR: 3.0, height: W + 18, opacity: 0.09 }], // bell-tower
    [20, 1, { topR: 2.6, height: W + 12, opacity: 0.07 }],   // E transept
  ];
  shafts.forEach(([x, z, opts], i) => {
    const cone = world._lightShaft(x, z, { color: 0xcfe4ff, ...opts });
    cone.rotation.z = 0.18 + (i % 3) * 0.03;   // shared diagonal slant
    cone.rotation.x = (i % 2 ? 1 : -1) * 0.06;
  });
}

// ---- Terrain props: rubble mounds in the side aisles (decor) ----------------
function rubble(world) {
  const spots = [[-13, 12], [14, -8], [-16, -22], [24, -20]];
  for (const [mx, mz] of spots) {
    world.moundSpots.push([mx, mz]);
    const n = 4 + Math.floor(world.rng() * 3);
    for (let i = 0; i < n; i++) {
      const s = 0.4 + world.rng() * 0.7;
      const box = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), world.mat.rubble);
      box.position.set(
        mx + (world.rng() - 0.5) * 2.5,
        W - 0.3 + s / 2 + world.rng() * 0.2,
        mz + (world.rng() - 0.5) * 2.5,
      );
      box.rotation.set(world.rng(), world.rng(), world.rng());
      world.scene.add(box);
    }
  }
}

// Spawn nodes anchored to the districts (consumed by ArtifactManager + Guardian).
function setSpawnNodes(world) {
  world.spawnNodes.near_wall = [
    [-16, 1], [16, 5],       // transept fronts
    [-9, 27], [9, 26],       // narthex stubs
    [-1, -35],               // bell-tower base
    [-30, 16],               // cloister ruin
  ];
  world.spawnNodes.submerged_interior = [
    [-20, 1], [20, 1], [-27, -4],   // inside the transept shells
    [0, -18],                        // on the altar dais
  ];
  world.spawnNodes.elevated_rubble = world.moundSpots.slice();
  world.spawnNodes.open_water = [
    [0, 19], [0, 7], [0, -5],        // down the nave centerline
    [-12, -14], [12, 14], [-14, 24], // side aisles between clusters
  ];
}

export const zone3 = {
  id: 'zone3',
  name: 'The Drowned Cathedral',
  label: 'Zone 3 — The Drowned Cathedral',   // descend-screen heading
  seed: 20260714,
  guardianStart: { x: 0, z: 15 },   // center of the nave, just before the altar
  guardianRebuke: 'The archive does not open for a clouded mind. Kneel with the stones a while longer, and return.',
  // Spoken (as a subtitle) one line at a time right after the player descends.
  introDialogue: [
    '[Zone 3 — The Drowned Cathedral] The bells of St. John fell silent beneath the flood.',
    'Every prayer ever whispered here still hangs on the strings. The Keeper counts them, one by one.',
  ],
  background: 0x050b14,   // deep abyss blue — the edges of the map fall into it
  fog: { color: 0x08121f, density: CONFIG.FOG_DENSITY * 1.5 },   // denser: isolate the ruins
  // Cold drowned-limestone palette — pale blue-grey stone, verdigris metal,
  // deep-teal growth; deliberately colder than zones 1–2.
  palette: {
    building: 0x2e3b4a, buildingAlt: 0x36434f, concrete: 0x46525f,
    rubble: 0x38444f, metal: 0x47605c, rust: 0x3f5652,
    wood: 0x2c3642, plank: 0x37424c, cloth: 0x3a4a5a,
    sign: 0x5a6a76, ware: 0x50626e, seabed: 0x101c26,
    bark: 0x22303a, foliage: 0x24424a, window: 0x070e15,
  },
  // Build order is layout-significant (drives the seeded RNG); preserve it.
  build(world) {
    narthex(world);
    naveColonnade(world);
    vaultRibs(world);
    transepts(world);
    altarApse(world);
    bellTower(world);
    cloisterRuins(world);
    floatingSlabs(world);
    memoryStrings(world);
    world._dock({ cx: 0, cz: 34 });
    world._mangroveRing({ radius: 47, step: 3.6 });
    rubble(world);
    world._debris();
    lightShafts(world);
    setSpawnNodes(world);
  },
};
