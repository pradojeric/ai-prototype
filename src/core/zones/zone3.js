// ============================================================
// ZONE 3 — THE DROWNED CATHEDRAL: the Memory Archive (GDD §3/§13)
// A solemn, vast underwater memory archive inspired by St. John the
// Evangelist Cathedral in downtown Dagupan. The player spawns on the south
// dock (+Z) — the ruined narthex — looking north (-Z) straight down the
// flooded nave: two colonnades of snapped-off stone pillars bridged by
// broken half-torus vault ribs, glowing pale "memory strings" woven between
// them, cold moonlight raking down the aisle, and fragmented stone slabs
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
import { plazaDais, hallShell } from './_partials/zoneKit.js';

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
//
// Station spacing TIGHTENS toward the altar (7 · 6 · 5 · 4 · 4 · 3 metres) rather
// than running evenly as it used to. That forced perspective makes the sanctuary
// read as further away and pulls the eye north down the aisle — the cheapest way
// to give a corridor of identical pillars a sense of depth.
const PILLAR_ROWS = [24, 17, 11, 6, 2, -2, -5];   // z stations, S → N
// Tall rows carry the vault ribs. Note the row nearest z=16 must stay short: the
// Guardian waits at (0, 15) and a rib there cuts across the encounter framing.
const TALL_ROWS = new Set([24, 6, -5]);           // rows that keep tall pairs

function naveColonnade(world) {
  world._pillarTops = {};   // z → [leftTopY, rightTopY], read by vaultRibs()
  const specs = [];
  for (const z of PILLAR_ROWS) {
    const tops = [];
    for (const s of [-1, 1]) {
      const tall = TALL_ROWS.has(z);
      const height = tall ? 11 + world.rng() * 3 : 3 + world.rng() * 4;
      specs.push({ x: s * 6, z, height, baseR: 1.15 + world.rng() * 0.3 });
      tops.push(height);
    }
    world._pillarTops[z] = tops;
  }
  // 14 pillars as individual meshes cost ~140 draw calls; batched they cost 2.
  world._towerField(specs);
}

// ---- Vault ribs: half-torus archways spanning the nave ----------------------
// The cathedral's broken stone vaulting: upright half-torus ribs bridge the
// tall pillar pairs high over the aisle (decor, non-colliding).
function vaultRibs(world) {
  const ribGeo = () => new THREE.TorusGeometry(6, 0.42, 8, 14, Math.PI);
  for (const z of TALL_ROWS) {
    const topY = Math.min(...world._pillarTops[z]);
    const rib = new THREE.Mesh(ribGeo(), world.mat.concrete);
    rib.position.set(0, topY - 0.5, z);           // arc springs from the pillar tops
    rib.rotation.y = (world.rng() - 0.5) * 0.08;  // slight settle
    world.scene.add(rib);
  }
}

// ---- Transepts: ruined side wings east + west of the crossing ---------------
// Broken chapel shells with a dark rose window set into the outer wall; they give
// the ArtifactManager interiors and the player mid-zone cover.
//
// These are now real SHELLS (hallShell), not solid `_building` blocks. They were
// solid before, which quietly meant the zone's four `submerged_interior` spawn
// nodes — all of them addressed at transept centres — sat inside collision and
// could never be used. The two outer chapels stay solid; they are silhouette.
function transepts(world) {
  for (const side of [-1, 1]) {
    hallShell(world, side * 20, 1, {
      halfW: 3.5, halfD: 5, wallHeight: 7 + world.rng() * 2,
      entrance: side < 0 ? 'east' : 'west',      // opens back toward the nave
      beams: true,
      interior(w, cx, cz) {
        // The rose window: a dark glazed disc recessed into the outer wall, ringed
        // by pale stone tracery. Cold and unlit, like everything else here.
        const outer = cx + side * 3.4;
        const glass = new THREE.Mesh(new THREE.CircleGeometry(1.5, 20), w.mat.window);
        glass.position.set(outer, 4.2, cz);
        glass.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
        w.scene.add(glass);
        const tracery = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.14, 6, 18), w.mat.concrete);
        tracery.position.set(outer, 4.2, cz);
        tracery.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
        w.scene.add(tracery);
        // a toppled chapel altar stone on the flooded floor
        const stone = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 0.8), w.mat.concrete);
        stone.position.set(cx - side * 1.4, W + 0.25, cz - 2.2);
        stone.rotation.y = (w.rng() - 0.5) * 0.4;
        w.scene.add(stone);
      },
    });
  }
  world._building(-27, -4, 6, 5, 4.5 + world.rng() * 2, Math.PI / 2, { windows: false });
  world._building(27, 5, 6, 5, 4.5 + world.rng() * 2, -Math.PI / 2, { windows: false });
  // side-chapel gateways off the crossing
  world._ruinArch(-11, -1, Math.PI / 2, { span: 5, height: 4.5 });
  world._ruinArch(11, -1, Math.PI / 2, { span: 5, height: 4.5 });
}

// ---- Altar + apse: the ruined sanctuary the nave leads to (N) ---------------
// A low stone dais (near water level — wade-over decor, like zone2's), a
// semicircle of pillar stumps tracing the lost apse wall behind it, and
// cold-white emissive lantern "candles" — no real THREE.Light, per the
// engine's glow budget.
function altarApse(world) {
  const cx = 0, cz = -18;
  plazaDais(world, cx, cz, { radius: 3.6, segments: 10 });
  const altar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 1.1), world.mat.concrete);
  altar.position.set(cx, W + 0.5, cz - 0.5);
  altar.rotation.y = (world.rng() - 0.5) * 0.15;
  world.scene.add(altar);
  world.addCollider(cx, cz - 0.5, 1.2, 0.6);
  // apse: semicircle of stumps behind the altar (batched)
  const stumps = 7;
  const ring = [];
  for (let i = 0; i < stumps; i++) {
    const a = Math.PI * (0.15 + 0.7 * (i / (stumps - 1)));   // opens toward the nave
    ring.push({
      x: cx + Math.cos(a) * 8,
      z: cz - 2 - Math.sin(a) * 6,
      height: 2.5 + world.rng() * 5,
      baseR: 0.9,
    });
  }
  world._towerField(ring);
  // cold votive light around the sanctuary
  world._lanternCluster(cx - 2.4, cz + 1.5, { count: 5, y: 2.4, radius: 0.9, color: GLOW_COLOR });
  world._lanternCluster(cx + 2.6, cz - 0.5, { count: 4, y: 3.0, radius: 0.7, color: GLOW_COLOR });
}

// ---- Collapsed vault: a climbable slab pile in the west aisle ----------------
// Where a bay of the stone vault came down, its slabs stacked into a ramp. This
// is the zone's one piece of real verticality: from the top the player looks
// straight down the length of the nave to the altar, which is the shot the whole
// colonnade was composed for. Walkable via authored support surfaces (see
// World.addSupportSurface) rather than colliders, so it can actually be climbed.
function collapsedVault(world) {
  const cx = -12, cz = 8;
  const topY = 3.3;

  // Three stacked slabs stepping up, each its own landing.
  const steps = [
    { y: topY * 0.34, halfW: 2.4, halfD: 1.6, z: cz + 3.4 },
    { y: topY * 0.67, halfW: 2.2, halfD: 1.5, z: cz + 0.6 },
    { y: topY,        halfW: 2.6, halfD: 1.9, z: cz - 2.2 },
  ];
  for (const s of steps) {
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(s.halfW * 2, 0.36, s.halfD * 2), world.mat.rubble);
    slab.position.set(cx, s.y - 0.18, s.z);
    slab.rotation.y = (world.rng() - 0.5) * 0.12;
    world.scene.add(slab);
    world.addSupportSurface(cx, s.z, s.halfW, s.halfD, 0, s.y);
    // Solid only BELOW its own deck, so the player is stopped by the step face
    // when wading past but never blocked once standing on it.
    world.addCollider(cx, s.z, s.halfW, s.halfD, { maxY: s.y - 0.35 });
  }

  // A snapped rib leaning against the pile + loose fragments, so it reads as
  // fallen vaulting rather than a staircase someone built.
  const rib = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.4, 6, 8, Math.PI * 0.6), world.mat.concrete);
  rib.position.set(cx - 2.6, 1.6, cz - 1);
  rib.rotation.set(0.4, 0.9, 1.25);
  world.scene.add(rib);
  for (let i = 0; i < 5; i++) {
    const s = 0.5 + world.rng() * 0.8;
    const frag = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.4, s), world.mat.rubble);
    frag.position.set(cx + (world.rng() - 0.5) * 6, W - 0.2 + s * 0.2, cz + (world.rng() - 0.5) * 9);
    frag.rotation.set(world.rng(), world.rng(), world.rng());
    world.scene.add(frag);
  }

  world._lanternCluster(cx, cz - 2.2, { count: 3, y: topY + 2.2, radius: 0.6, color: GLOW_COLOR });
  world.spawnNodes.elevated_rubble.push([cx, cz - 2.2]);
}

// ---- Nave inlay: a faint glowing line down the centre of the aisle -----------
// Zone 3 is deliberately the darkest zone (near-black background, 1.5× fog), and
// in playtesting the aisle itself can dissolve into that darkness. A dim additive
// strip set into the floor traces the centreline from the narthex to the altar:
// it gives the player a continuous thing to follow without adding a light, and it
// reads diegetically as one more memory string, laid into the stone.
function naveInlay(world) {
  const zStart = 26, zEnd = -17;
  const mat = new THREE.MeshBasicMaterial({
    color: GLOW_COLOR, transparent: true, opacity: 0.16,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.5, zStart - zEnd), mat);
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(0, W - 0.28, (zStart + zEnd) / 2);
  world.scene.add(strip);
  // Registered with the shafts so it breathes with the rest of the zone's glow.
  world.shafts.push({ mat, base: 0.16, phase: world.rng() * Math.PI * 2 });
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
  // threads converging on the sanctuary, from the northernmost colonnade row
  const last = PILLAR_ROWS[PILLAR_ROWS.length - 1];
  world._sagLine(-6, last, 0, -18, 5, 2.2, 0.6, { thickness: 0.03, mat });
  world._sagLine(6, last, 0, -18, 5, 2.2, 0.6, { thickness: 0.03, mat });
}

// Spawn nodes anchored to the districts (consumed by ArtifactManager + Guardian).
// NOTE: appends, because collapsedVault() already pushed its own.
function setSpawnNodes(world) {
  world.spawnNodes.near_wall.push(
    [-15, 1], [15, 1],       // transept entrances, facing the nave
    [-9, 24], [9, 23],       // narthex stub fronts
    [-1, -35],               // bell-tower base
    [-28, 13],               // cloister ruin
  );
  world.spawnNodes.submerged_interior.push(
    [-20, 1], [20, 1], [-20, 4],     // inside the transept shells
    [0, -16.5],                       // on the altar dais, south of the altar stone
  );
  world.spawnNodes.elevated_rubble.push(...world.moundSpots);
  world.spawnNodes.open_water.push(
    [0, 19], [0, 7], [0, -5],        // down the nave centerline
    [-12, -14], [12, 14], [-12, 18], // side aisles between clusters
  );
}

export const zone3 = {
  id: 'zone3',
  name: 'Pananisia',
  label: 'Zone 3 — Pananisia (Drowned Landmarks)',   // descend-screen heading
  seed: 20260714,
  arenaId: 'arena3',
  riftSpot: { x: 0, z: 15 },
  guardianStart: { x: 0, z: 15 },   // center of the nave, just before the altar
  guardianRebuke: 'The archive does not open for a clouded mind. Kneel with the stones a while longer, and return.',
  guardianName: { fil: 'Ang Tagapag-ingat ng mga Alaala', eng: 'The Keeper of Memories' },
  // Spoken (as a subtitle) one line at a time right after the player descends.
  introDialogue: [
    '[Zone 3 — Pananisia] Here the flood took not food nor festival, but place itself — the shrines, the shores, the landmarks of Pangasinan.',
    'Every prayer, every homecoming, every monument still hangs on the strings. The Keeper counts them, one by one.',
  ],
  background: 0x050b14,   // deep abyss blue — the edges of the map fall into it
  fog: { color: 0x08121f, density: CONFIG.FOG_DENSITY * 1.5 },   // denser: isolate the ruins
  // Cold slate water instead of the engine's market teal — the cathedral's flood
  // should feel like still, colourless meltwater, not a warm lagoon.
  waterColor: 0x2a4a5c,
  // Cold drowned-limestone palette — pale blue-grey stone, verdigris metal,
  // deep-teal growth; deliberately colder than zones 1–2.
  palette: {
    building: 0x2e3b4a, buildingAlt: 0x36434f, concrete: 0x46525f,
    rubble: 0x38444f, metal: 0x47605c, rust: 0x3f5652,
    wood: 0x2c3642, plank: 0x37424c, cloth: 0x3a4a5a,
    sign: 0x5a6a76, ware: 0x50626e, seabed: 0x101c26,
    bark: 0x22303a, foliage: 0x24424a, window: 0x070e15,
  },
  // The darkest and coldest of the three, deliberately: the cathedral's whole
  // read is that the map edges dissolve into the abyss. Everything is scaled
  // DOWN from the shared rig rather than recoloured, so the zones still sit on
  // one lighting scale — Pananisia is the bottom of it, not a different world.
  light: {
    moonColor: 0xc3d8f2,
    moonIntensity: 1.15,
    fillIntensity: 0.22,
    hemiSky: 0x7d9fc4,
    hemiGround: 0x080f18,
    hemiIntensity: 0.62,
    ambientColor: 0x28414f,
    ambientIntensity: 0.42,
    envSky: 0x53748f,
    envHorizon: 0x22333f,
    envGround: 0x070d12,
    envIntensity: 0.45,
  },
  // Build order is layout-significant (drives the seeded RNG); preserve it.
  build(world) {
    narthex(world);
    naveColonnade(world);
    vaultRibs(world);
    transepts(world);
    altarApse(world);
    collapsedVault(world);
    naveInlay(world);
    bellTower(world);
    cloisterRuins(world);
    floatingSlabs(world);
    memoryStrings(world);
    world._dock({ cx: 0, cz: 34 });
    world._mangroveRing({ radius: 47, step: 3.6 });
    world._rubbleField([[-16, -22], [14, -8], [24, -20], [20, 14]]);
    world._debris();
    setSpawnNodes(world);
  },
};
