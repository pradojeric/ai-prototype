// ============================================================
// ZONE 2 — LIKET: the Festival Zone (GDD §3/§13 restyle)
// An underwater festival frozen in time: colorful banners drift with the
// current, lanterns glow beneath the sea, and echoes of music and dancing
// once filled these submerged plazas. Mirrors zone1's spine layout (the
// player spawns on the south dock (+Z) facing north (-Z) down a central
// avenue) but every object along it is festival dressing instead of market
// stalls: a parade avenue strung with lanterns and bunting, a drummers'
// circle, a ruined dancing hall, a sunken parade-float graveyard, and a
// terminus PARUL MAST — a giant glowing star-lantern on a slender pole —
// standing in for zone1's bell-tower as the zone's navigation landmark.
//
// District footprints deliberately reuse zone1's proven, collision-safe
// perimeter/stall-row/gateway coordinates (same ZONE_HALF=48 bounds); all of
// the zone's distinct character comes from the new festival primitives layered
// on top (see World.js's "Festival dressing" section), not from a new floor
// plan. Consumed by the World engine (src/core/World.js) like any zone def;
// registered in zones/index.js. Build order drives the seeded RNG — preserve it.
// ============================================================
import * as THREE from 'three';
import { CONFIG } from '../../config.js';

const W = CONFIG.WATER_LEVEL;

// ---- Perimeter: bounding street edge (gaps left for lanes + the S dock) ----
function perimeter(world) {
  const R = 45;
  const h = () => 6 + world.rng() * 4;
  for (const x of [-34, -18, 18, 34]) world._building(x, -R, 13, 7, h(), 0);
  for (const z of [-12, 8, 28]) world._building(-R, z, 13, 7, h(), Math.PI / 2);
  for (const z of [-22, -2, 22]) world._building(R, z, 13, 7, h(), -Math.PI / 2);
  world._building(-38, R, 13, 7, h(), Math.PI);
  world._building(38, R, 13, 7, h(), Math.PI);
}

// ---- The Gong Circle: drummers'/gong court (W) ------------------------------
// A ring of standing gong-stands around a bare clearing where the beat once
// kept the whole parade in step, with a few sparse houses for texture/cover.
function gongCircle(world) {
  const cx = -28, cz = -14, r = 6.5;
  const gongN = 6;
  for (let i = 0; i < gongN; i++) {
    const a = (i / gongN) * Math.PI * 2;
    const px = cx + Math.cos(a) * r, pz = cz + Math.sin(a) * r;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 1.9, 6), world.mat.wood);
    post.position.set(px, 0.95, pz);
    world.scene.add(post);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 16), world.mat.metal);
    disc.position.set(px, 1.7, pz);
    disc.rotation.x = Math.PI / 2;
    disc.rotation.z = (world.rng() - 0.5) * 0.3;   // tilted, long silent
    world.scene.add(disc);
    world.addCollider(px, pz, 0.16, 0.16);
  }
  // low drum-stools scattered near the center (decor, short enough to walk over)
  for (let i = 0; i < 4; i++) {
    const a = world.rng() * Math.PI * 2, d = world.rng() * 3.2;
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.6, 10), world.mat.wood);
    stool.position.set(cx + Math.cos(a) * d, W - 0.1, cz + Math.sin(a) * d);
    world.scene.add(stool);
  }
  // sparse houses ringing the court (collision cover, district texture)
  for (const [bx, bz] of [[-40, -8], [-38, -28], [-20, -30], [-18, 4]]) {
    if (world.rng() < 0.2) continue;
    world._building(bx + (world.rng() - 0.5) * 2, bz + (world.rng() - 0.5) * 2,
      4.5 + world.rng() * 2, 4.5 + world.rng() * 2, 4 + world.rng() * 3.5);
  }
}

// ---- The Bandstand Plaza: the avenue's northern TERMINUS --------------------
// A walkable dais where the festival's stage once stood, the parul mast
// landmark towering beside it, ringed by broken audience benches.
function bandstandPlaza(world) {
  const cx = 0, cz = -40;
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.6, 0.5, 8), world.mat.concrete);
  dais.position.set(cx, W - 0.1, cz);
  world.scene.add(dais);
  world._parulMast(cx - 3, cz - 2, { height: 13, starRadius: 1.7 });
  const benchN = 8;
  for (let i = 0; i < benchN; i++) {
    const a = (i / benchN) * Math.PI * 2;
    const px = cx + Math.cos(a) * 7, pz = cz + Math.sin(a) * 7;
    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.5), world.mat.wood);
    bench.position.set(px, 0.35, pz);
    bench.rotation.y = a + Math.PI / 2;
    bench.rotation.z = (world.rng() - 0.5) * 0.3;   // broken, listing
    world.scene.add(bench);
    world.addCollider(px, pz, 0.8, 0.3);
  }
}

// ---- The Ruined Dancing Hall: large open shell landmark (E of avenue) ------
// Entrance faces WEST onto the avenue. A sunken mosaic dance floor and two
// cold, long-dark chandeliers replace the old warehouse's crates and beams.
function ballroomShell(world) {
  const cx = 26, cz = -28, hw = 8, hd = 7, wh = 8;
  const wallMat = world.mat.rust;
  const wall = (x, z, w, d, h) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    m.position.set(x, h / 2, z); world.scene.add(m);
    world.addCollider(x, z, w / 2, d / 2);
  };
  wall(cx + hw, cz, 0.6, hd * 2, wh);
  wall(cx, cz - hd, hw * 2, 0.6, wh);
  wall(cx, cz + hd, hw * 2, 0.6, wh);
  wall(cx - hw, cz - 4.5, 0.6, 5, wh);
  wall(cx - hw, cz + 4.5, 0.6, 5, wh);
  // sunken tiled dance floor
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 0.15, 24), world.mat.concrete);
  floor.position.set(cx, W - 0.35, cz);
  world.scene.add(floor);
  // two broken chandeliers — cool ghostly light, distinct from the warm avenue
  world._lanternCluster(cx - 2, cz - 1, { count: 6, y: wh - 1.5, radius: 1.1, color: 0xbfe9e2 });
  world._lanternCluster(cx + 3, cz + 2, { count: 4, y: wh - 2.2, radius: 0.8, color: 0xbfe9e2 });
  // fallen/leaning columns (decor, non-colliding)
  for (const [ox, oz] of [[-5, -4], [5, 3], [-4, 4]]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 2.6, 8), world.mat.concrete);
    col.position.set(cx + ox, W + 0.5, cz + oz);
    col.rotation.z = (world.rng() - 0.5) * 1.4;   // toppled
    col.rotation.y = world.rng() * Math.PI;
    world.scene.add(col);
  }
}

// ---- The Float Graveyard: sunken parade floats + a shed (far E) ------------
function floatGraveyard(world) {
  world._building(40, 12, 7, 6, 4.5, -Math.PI / 2.4, { windows: false });   // shed
  const floatColors = [0xb5453f, 0xd9a23a, 0x3f8f7a, 0x3f6fae];
  const floats = [[34, -2, 0.3], [38, 4, -0.6], [33, 10, 1.4], [40, 16, 0.1]];
  floats.forEach(([x, z, rot], i) => {
    const hullMat = new THREE.MeshStandardMaterial({ color: floatColors[i % floatColors.length], roughness: .8 });
    const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 3.2, 4, 8), hullMat);
    hull.rotation.z = Math.PI / 2;
    hull.rotation.y = rot;
    hull.scale.set(1, 1, 0.55);
    hull.position.set(x, W, z);
    world.scene.add(hull);
    const [fw, fd] = world._footprint(2.0, 0.7, rot);
    world.addCollider(x, z, fw, fd);
    if (world.rng() < 0.6) {
      const a = rot + Math.PI / 2;
      world._bunting(x - Math.cos(a) * 1.2, z - Math.sin(a) * 1.2, x + Math.cos(a) * 1.2, z + Math.sin(a) * 1.2,
        { y: W + 1.0, sag: 0.25, pennants: 2, posts: false });
    }
  });
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

// ---- The Parade Stalls: festival food-vendor rows lining the avenue --------
function paradeStalls(world) {
  const steps = 7;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const cz = 22 - t * 44;
    const broken = world.rng() < 0.25;
    const tilt = (world.rng() - 0.5) * 0.16;
    world._stall(-6.5, cz, Math.PI / 2, { broken, tilt });
    world._stall(6.5, cz, -Math.PI / 2, { scale: 0.95 + world.rng() * 0.2 });
  }
}

// ---- The Parade Avenue: overhead lantern + bunting canopy down the spine ---
function paradeAvenue(world) {
  const stations = [18, 6, -6, -18];
  stations.forEach((z, i) => {
    if (i % 2 === 0) {
      world._lanternString(-8.5, z, 8.5, z, { y: 3.4, sag: 0.5, count: 6, color: i === 0 ? 0xffb35c : 0xff8f6b });
    } else {
      world._bunting(-8.5, z, 8.5, z, { y: 3.6, sag: 0.7, pennants: 7 });
    }
  });
}

// ---- The Lantern Overlook: raised vantage strung with lanterns (SE) --------
function lanternOverlook(world) {
  const cx = 33, cz = 30;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(8, 1.6, 8), world.mat.concrete);
  slab.position.set(cx, W + 0.1, cz);
  world.scene.add(slab);
  world.addCollider(cx, cz, 4, 4);
  world._lanternCluster(cx + 2.6, cz + 2.6, { count: 5, y: 7.5, radius: 0.7, withPost: true, postHeight: 8 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.2, 0.16), world.mat.metal);
    post.position.set(cx + sx * 3.4, W + 1.4, cz + sz * 3.4);
    world.scene.add(post);
  }
  world.moundSpots.push([cx, cz]);
}

// ---- Gateways: broken arches marking thresholds, festooned for LIKET ------
function gateways(world) {
  const arches = [
    { x: 0, z: 26, rot: 0, span: 6, height: 5 },
    { x: 0, z: -31, rot: 0, span: 5.5, height: 5.5 },
    { x: -9, z: 2, rot: Math.PI / 2, span: 5, height: 4.5 },
    { x: 15, z: -28, rot: Math.PI / 2, span: 5, height: 4.5 },
  ];
  arches.forEach(({ x, z, rot, span, height }, i) => {
    world._ruinArch(x, z, rot, { span, height });
    const half = span / 2;
    const ox = Math.cos(rot) * half, oz = -Math.sin(rot) * half;
    const y = height * 0.92;
    if (i % 2 === 0) {
      world._lanternString(x - ox, z - oz, x + ox, z + oz, { y, sag: 0.35, count: 4, color: 0xffb35c });
    } else {
      world._bunting(x - ox, z - oz, x + ox, z + oz, { y, sag: 0.45, pennants: 4, posts: false });
    }
  });
}

// ---- God-ray light shafts framing the landmarks (atmosphere) ---------------
function lightShafts(world) {
  world._lightShaft(-3, -42, { topR: 3.6, height: W + 17, opacity: 0.1, color: 0xffe6b0 });   // parul mast
  world._lightShaft(26, -28, { topR: 3.0, height: W + 14 });                                    // ballroom interior
  world._lightShaft(0, 10, { topR: 3.2, height: W + 14 });                                      // avenue (near)
  world._lightShaft(0, -14, { topR: 3.2, height: W + 14 });                                     // avenue (far)
  world._lightShaft(33, 30, { topR: 2.6, height: W + 13 });                                     // overlook
  world._lightShaft(-28, -14, { topR: 2.8, height: W + 12 });                                   // gong circle
}

// ---- Terrain props: rubble mounds (decor) ----------------------------------
function rubble(world) {
  const spots = [[-14, 20], [16, -16], [-8, 10], [30, -40]];
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
    [-24, -10], [-36, -20],        // gong circle building faces
    [18, -26],                     // ballroom west front (on the avenue)
    [34, 12],                      // float graveyard shed
    [-2, -33],                     // bandstand plaza edge
  ];
  world.spawnNodes.submerged_interior = [
    [26, -28], [23, -26], [29, -30],   // inside the ballroom shell
    [0, -40],                           // on the bandstand dais
  ];
  world.spawnNodes.elevated_rubble = world.moundSpots.slice();   // overlook + mounds
  world.spawnNodes.open_water = [
    [0, 16], [0, -2], [0, -20],    // down the central avenue (open sightline)
    [-14, -10], [14, 6], [-16, 20],   // side lanes between clusters
  ];
}

export const zone2 = {
  id: 'zone2',
  name: 'LIKET',
  label: 'Zone 2 — LIKET (Festival Zone)',   // descend-screen heading
  seed: 20260702,
  guardianStart: { x: 0, z: 16 },   // waits ahead of the dock on the avenue
  guardianRebuke: 'Not yet. The tide keeps its festival for those who have not proven themselves.',
  guardianName: { fil: 'Ang Tagabulong ng Bahura', eng: 'The Coral-Whisperer' },
  // Spoken (as a subtitle) one line at a time right after the player descends. PLACEHOLDER.
  introDialogue: [
    '[Zone 2 — LIKET] The current here still hums with old music.',
    '[Zone 2 placeholder] Somewhere below, the festival never stopped playing.',
  ],
  background: 0x10222b,
  fog: { color: 0x1c3a3e, density: CONFIG.FOG_DENSITY },
  // Warm brass/festival-cloth palette — deliberately contrasts zone2Guardian's
  // cool spectral amber-green so the guardian reads as an apparition against it.
  palette: {
    cloth: 0x7a3a3a, sign: 0xd9a53f, ware: 0xd97a3f,
    building: 0x24322f, buildingAlt: 0x2c3a30,
    concrete: 0x3a3128, rust: 0x6a4a2a, metal: 0x6a5a2a,
  },
  // Build order is layout-significant (drives the seeded RNG); preserve it.
  build(world) {
    perimeter(world);
    gongCircle(world);
    bandstandPlaza(world);
    ballroomShell(world);
    floatGraveyard(world);
    paradeStalls(world);
    paradeAvenue(world);
    lanternOverlook(world);
    gateways(world);
    world._dock({ cx: 0, cz: 34 });
    world._mangroveRing({ radius: 47, step: 3.6 });
    rubble(world);
    world._debris();
    lightShafts(world);
    setSpawnNodes(world);
  },
};
