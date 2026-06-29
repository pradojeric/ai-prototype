// ============================================================
// ZONE 1 — submerged Pantal Market District (GDD §3/§13)
// Composed around a CENTRAL NORTH–SOUTH AVENUE: the player spawns on the south
// dock (+Z) looking north (-Z) down a flooded market street lined by stall rows,
// passes through broken ruin-arch GATEWAYS that mark each district threshold, and
// is drawn toward a tall ruined TOWER landmark (the auctioneer's bell-mast) that
// reads through the fog at the avenue's north end. Districts hang off the spine:
//   Memories Alley (W) · Silent Auction Square + tower (center-N, terminus) ·
//   Ruined Fish Warehouse (E) · Lost Boatyard (far E) · Drowning Stalls (line the
//   avenue) · Foggy Overlook + vantage post (SE) · Player Dock (S). God-ray light
//   shafts frame the landmarks for depth through the fog.
//
// This is a *zone definition* consumed by the World engine (src/core/World.js):
// each district is a plain function taking the `world` engine as context, using
// its reusable primitives (_building, _stall, _mangroveRing, _dock, _debris,
// _tower, _ruinArch, _lightShaft) and seeded `rng`. `build(world)` calls them in
// a fixed, layout-significant order (the order drives the deterministic RNG).
// Register in zones/index.js.
// ============================================================
import * as THREE from 'three';
import { CONFIG } from '../../config.js';

const W = CONFIG.WATER_LEVEL;

// ---- Perimeter: bounding street edge (gaps left for lanes + the S dock) ----
function perimeter(world) {
  const R = 45;
  const h = () => 6 + world.rng() * 4;
  // north edge — center left open so the tower silhouette reads against the fog
  for (const x of [-34, -18, 18, 34]) world._building(x, -R, 13, 7, h(), 0);
  // west edge (behind Memories Alley)
  for (const z of [-12, 8, 28]) world._building(-R, z, 13, 7, h(), Math.PI / 2);
  // east edge (behind the boatyard)
  for (const z of [-22, -2, 22]) world._building(R, z, 13, 7, h(), -Math.PI / 2);
  // south corners only — leave the center open for the dock
  world._building(-38, R, 13, 7, h(), Math.PI);
  world._building(38, R, 13, 7, h(), Math.PI);
}

// ---- Memories Alley: dense small buildings split by narrow alleys (W) ------
function memoriesAlley(world) {
  // Three north-south rows of buildings west of the avenue; gaps read as alleys.
  const rows = [-42, -34, -26];
  const zs = [-36, -27, -18, -9, 0];
  for (const bx of rows) {
    for (const bz of zs) {
      if (world.rng() < 0.22) continue;               // missing house → pocket
      const w = 4.5 + world.rng() * 2.5;
      const d = 4.5 + world.rng() * 2.5;
      const bh = 4.5 + world.rng() * 4.5;
      world._building(bx + (world.rng() - 0.5), bz + (world.rng() - 0.5) * 1.5, w, d, bh);
    }
  }
}

// ---- The Silent Auction Square: the avenue's northern TERMINUS -------------
// Open plaza with a walkable dais, a tall ruined bell-tower drawing the eye from
// the dock, a ring of broken columns, and the auctioneer's anchor frame.
function auctionSquare(world) {
  const cx = 0, cz = -38;
  // low stone dais (walkable, breaks the surface)
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, 0.5, 16), world.mat.concrete);
  dais.position.set(cx, W - 0.1, cz);
  world.scene.add(dais);
  // the bell-mast: tall ruined tower, the zone's primary navigation landmark
  world._tower(cx - 4.5, cz - 1, { height: 17, baseR: 1.7 });
  // ring of short broken columns around the dais (solid)
  const ringN = 8;
  for (let i = 0; i < ringN; i++) {
    const a = (i / ringN) * Math.PI * 2;
    const px = cx + Math.cos(a) * 6, pz = cz + Math.sin(a) * 6;
    const ph = 2 + world.rng() * 1.8;                  // uneven, ruined heights
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, ph, 8), world.mat.concrete);
    col.position.set(px, ph / 2, pz);
    world.scene.add(col);
    world.addCollider(px, pz, 0.35, 0.35);
  }
  // auctioneer's frame + hanging anchor (the map's anchor icon for this square)
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 0.2), world.mat.metal);
  post.position.set(cx + 3.6, 2, cz); world.scene.add(post);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 2.4), world.mat.metal);
  arm.position.set(cx + 3.6, 3.8, cz - 1); world.scene.add(arm);
  const anchor = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.12, 8, 16), world.mat.rust);
  anchor.position.set(cx + 3.6, 2.6, cz - 2); anchor.rotation.x = Math.PI / 2;
  world.scene.add(anchor);
  world.addCollider(cx + 3.6, cz, 0.3, 0.3);
}

// ---- The Ruined Fish Warehouse: large open shell landmark (E of avenue) ----
// Entrance faces WEST onto the avenue so the player reads the way in on approach.
function fishWarehouse(world) {
  const cx = 26, cz = -28, hw = 8, hd = 7, wh = 8;   // half-extents + wall height
  const wallMat = world.mat.rust;
  const wall = (x, z, w, d, h) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    m.position.set(x, h / 2, z); world.scene.add(m);
    world.addCollider(x, z, w / 2, d / 2);
  };
  wall(cx + hw, cz, 0.6, hd * 2, wh);                 // east wall (full)
  wall(cx, cz - hd, hw * 2, 0.6, wh);                 // north wall
  wall(cx, cz + hd, hw * 2, 0.6, wh);                 // south wall
  // west wall: two stubs leaving a 4m entrance facing the avenue (-x)
  wall(cx - hw, cz - 4.5, 0.6, 5, wh);
  wall(cx - hw, cz + 4.5, 0.6, 5, wh);
  // broken roof beams across the top (decor, non-colliding)
  for (let i = -1; i <= 1; i++) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, 0.3, 0.4), world.mat.metal);
    beam.position.set(cx, wh + 0.2 + world.rng() * 0.4, cz + i * 4.5);
    beam.rotation.z = (world.rng() - 0.5) * 0.25;       // sagging / fallen-in
    world.scene.add(beam);
  }
  // fallen crates inside (decor, kept off the open interior center)
  for (const [ox, oz] of [[-5, -4], [5, 3], [-4, 4]]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.8), world.mat.wood);
    c.position.set(cx + ox, W + 0.3, cz + oz); c.rotation.y = world.rng();
    world.scene.add(c);
  }
}

// ---- The Lost Boatyard: scattered bangkâs, A-frame cradles, a shed (far E) --
function boatyard(world) {
  world._building(40, 12, 7, 6, 4.5, -Math.PI / 2.4, { windows: false });   // shed
  const boats = [[34, -2, 0.3], [38, 4, -0.6], [33, 10, 1.4], [40, 16, 0.1]];
  for (const [x, z, rot] of boats) {
    const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 3.2, 4, 8), world.mat.metal);
    hull.rotation.z = Math.PI / 2;
    hull.rotation.y = rot;
    hull.scale.set(1, 1, 0.55);
    hull.position.set(x, W, z);
    world.scene.add(hull);
    const [fw, fd] = world._footprint(2.0, 0.7, rot);
    world.addCollider(x, z, fw, fd);
  }
  // A-frame dry-dock cradles
  for (const [x, z] of [[30, 6], [36, -6]]) {
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3, 0.18), world.mat.wood);
      leg.position.set(s * 0.7, 1.5, 0); leg.rotation.z = -s * 0.4; g.add(leg);
    }
    g.position.set(x, 0, z); world.scene.add(g);
    world.addCollider(x, z, 1.0, 0.4);
  }
}

// ---- The Drowning Stalls: two rows LINING the central avenue ---------------
function drowningStalls(world) {
  // Facing rows run N-S either side of the avenue (x ≈ ±6.5), counters turned
  // inward so the player walks the market street toward the tower terminus.
  const steps = 7;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const cz = 22 - t * 44;              // +22 (near dock) → -22 (near square)
    const broken = world.rng() < 0.3;
    const tilt = (world.rng() - 0.5) * 0.16;
    // west row faces +X (toward aisle), east row faces -X
    world._stall(-6.5, cz, Math.PI / 2, { broken, tilt });
    world._stall(6.5, cz, -Math.PI / 2, { scale: 0.95 + world.rng() * 0.2 });
  }
}

// ---- The Foggy Overlook: raised vantage + a slender beacon post (SE) --------
function foggyOverlook(world) {
  const cx = 33, cz = 30;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(8, 1.6, 8), world.mat.concrete);
  slab.position.set(cx, W + 0.1, cz);
  world.scene.add(slab);
  world.addCollider(cx, cz, 4, 4);
  // a slender ruined post on the corner — a vantage marker spotted across the zone
  world._tower(cx + 2.6, cz + 2.6, { height: 11, baseR: 0.85 });
  // corner railing posts
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.2, 0.16), world.mat.metal);
    post.position.set(cx + sx * 3.4, W + 1.4, cz + sz * 3.4);
    world.scene.add(post);
  }
  world.moundSpots.push([cx, cz]);        // doubles as an elevated_rubble anchor
}

// ---- Gateways: broken ruin-arches marking thresholds along the avenue -------
function gateways(world) {
  world._ruinArch(0, 26, 0, { span: 6, height: 5 });      // mouth of the avenue (by the dock)
  world._ruinArch(0, -31, 0, { span: 5.5, height: 5.5 }); // into the Auction Square terminus
  world._ruinArch(-9, 2, Math.PI / 2, { span: 5 });       // west, into Memories Alley
  world._ruinArch(15, -28, Math.PI / 2, { span: 5 });     // east, toward the Fish Warehouse
}

// ---- God-ray light shafts framing the landmarks (atmosphere) ---------------
function lightShafts(world) {
  world._lightShaft(0, -38, { topR: 4.0, height: W + 18, opacity: 0.09 });   // tower terminus
  world._lightShaft(26, -28, { topR: 3.0, height: W + 14 });                  // warehouse interior
  world._lightShaft(0, 10, { topR: 3.2, height: W + 14 });                    // avenue (near)
  world._lightShaft(0, -14, { topR: 3.2, height: W + 14 });                   // avenue (far)
  world._lightShaft(33, 30, { topR: 2.6, height: W + 13 });                   // overlook
}

// ---- Terrain props: rubble mounds (decor) ----------------------------------
function rubble(world) {
  const spots = [[-30, 20], [16, -20], [-12, 12], [26, -40]];
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
      world.scene.add(box);  // low + non-colliding so artifacts on them stay reachable
    }
  }
}

// Spawn nodes anchored to the districts (consumed by ArtifactManager + Guardian).
// Spread across every district so the roaming Guardian tours the player past the
// whole zone, and so scattered artifacts land in distinct, reachable pockets.
function setSpawnNodes(world) {
  world.spawnNodes.near_wall = [
    [-24, -8], [-28, 4],           // Memories Alley building faces
    [18, -28],                     // warehouse west front (on the avenue)
    [34, 12],                      // boatyard shed
    [-2, -31],                     // auction square edge
  ];
  world.spawnNodes.submerged_interior = [
    [26, -28], [23, -26], [29, -30],   // inside the Fish Warehouse shell
    [0, -38],                           // on the auction dais (under the tower)
  ];
  world.spawnNodes.elevated_rubble = world.moundSpots.slice();   // overlook + mounds
  world.spawnNodes.open_water = [
    [0, 16], [0, -2], [0, -20],    // down the central avenue (open sightline)
    [-14, -14], [14, 6], [-16, 20],   // side lanes between clusters
  ];
}

export const zone1 = {
  id: 'zone1',
  name: 'Pantal Market',
  label: 'Zone 1 — Pantal Market',   // descend-screen heading
  seed: 20260618,
  background: 0x0c2b2c,
  fog: { color: 0x123c3a, density: CONFIG.FOG_DENSITY },
  palette: {},   // uses the engine's default flooded-market materials
  // Build order is layout-significant (drives the seeded RNG); preserve it.
  build(world) {
    perimeter(world);
    memoriesAlley(world);
    auctionSquare(world);
    fishWarehouse(world);
    boatyard(world);
    drowningStalls(world);
    foggyOverlook(world);
    gateways(world);
    world._dock({ cx: 0, cz: 34 });
    world._mangroveRing({ radius: 47, step: 3.6 });
    rubble(world);
    world._debris();
    lightShafts(world);
    setSpawnNodes(world);
  },
};
