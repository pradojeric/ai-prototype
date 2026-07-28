// ============================================================
// ZONE 2 — LIKET: the Festival Zone (GDD §3/§13 restyle)
// An underwater festival frozen in time: colorful banners drift with the
// current, lanterns glow beneath the sea, and echoes of music and dancing
// once filled these submerged plazas.
//
// LAYOUT — a PROCESSIONAL RING, not zone 1's straight avenue. The zone used to
// reuse zone 1's floor plan coordinate-for-coordinate (same perimeter, same
// stall rows at x = ±6.5, same gateways, same overlook, same boatyard), which
// made LIKET read as PONSIA with lanterns glued on. Now:
//
//   · a SHORT ENTRY AVENUE runs north from the dock (+Z) past the Memory Rift
//     and the Reveler's post at z≈16 — that stretch is kept clear and framed so
//     the guardian encounter still stages exactly as before,
//   · which opens into the ROUND PLAZA at (0,-6): a ring-shaped festival ground
//     with a walkable bandstand dais at its centre and the districts arranged
//     AROUND its rim instead of strung out in a line,
//   · the PARADE ARC of lantern gateways then sweeps east and curves north off
//     the ring, so the terminus PARUL MAST is discovered by following the lights
//     around a bend rather than being visible from spawn down a corridor.
//
// Districts on the rim: Gong Circle (W) · Dancing Hall (NE) · Bandstand + parul
// mast (N terminus) · Float Graveyard (SW, a capsized pile-up) · Lantern
// Overlook (SE) · Player Dock (S).
//
// Consumed by the World engine (src/core/World.js) like any zone def; registered
// in zones/index.js. Shared district builders come from zones/_partials/zoneKit.js.
// Build order drives the seeded RNG — preserve it.
// ============================================================
import * as THREE from 'three';
import { CONFIG } from '../../config.js';
import {
  perimeterBlocks, overlookPlatform, hallShell, cradleRow, hullRow, plazaDais,
} from './_partials/zoneKit.js';

const W = CONFIG.WATER_LEVEL;

// The festival ground's centre and radius — most of this zone is laid out
// relative to these two numbers, which is what makes the plan read as a ring.
const RING = { x: 0, z: -6, r: 15 };

// Point on the ring rim at angle `a` (radians). NOTE the world convention: +X is
// east and +Z is SOUTH, so sin(a) > 0 points south. a = +PI/2 is the dock side,
// a = -PI/2 is the far/north terminus.
function rim(a, inset = 0) {
  return [RING.x + Math.cos(a) * (RING.r - inset), RING.z + Math.sin(a) * (RING.r - inset)];
}

// Rim-gap bearings, all in the convention above.
const GAP = {
  entry: Math.PI / 2,       // S — the entry avenue from the dock
  gong: Math.PI,            // W — the gong court
  hall: -0.6,               // NE — the dancing hall
  bandstand: -Math.PI / 2,  // N — the mast/terminus side
};

// Yaw for a ruin-arch standing across the radial path at rim bearing `a`, i.e.
// piers on the tangent so the opening is crossed going in/out of the ring.
function radialArchYaw(a) {
  return Math.atan2(-Math.cos(a), -Math.sin(a));
}

// ---- The Round Plaza: the festival ground itself -----------------------------
// A broad sunken tiled ring with the bandstand dais at the middle. The rim is
// marked by a broken colonnade of festival posts, dense enough to read as an
// enclosure but gapped at the four district approaches so the ring never feels
// like a wall.
function roundPlaza(world) {
  // sunken tiled floor (wade-over decor, breaks up the seabed)
  const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(RING.r, RING.r + 0.6, 0.18, 40), world.mat.concrete);
  floor.position.set(RING.x, W - 0.42, RING.z);
  world.scene.add(floor);

  // rim posts, with gaps left at the four district approaches
  const gaps = Object.values(GAP);
  const postN = 28;
  const posts = [];
  for (let i = 0; i < postN; i++) {
    const a = (i / postN) * Math.PI * 2;
    // skip anything within ~18° of a gap centre
    if (gaps.some((g) => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < 0.32)) continue;
    const [px, pz] = rim(a);
    posts.push({ x: px, z: pz, height: 2.2 + world.rng() * 2.6, baseR: 0.34 });
  }
  world._towerField(posts);

  // Bunting strung between surviving rim posts, following the curve. Hung on
  // every fourth pair rather than continuously: the ring reads as a festival
  // ground either way, and each pennant is its own draw call in the animated
  // debris list, so this is where the zone's decor budget is easiest to spend.
  for (let i = 0; i < posts.length - 1; i += 4) {
    const a = posts[i], b = posts[i + 1];
    if (!b || Math.hypot(a.x - b.x, a.z - b.z) > 6) continue;
    world._bunting(a.x, a.z, b.x, b.z,
      { y: Math.min(a.height, b.height) * 0.9, sag: 0.5, pennants: 3, posts: false });
  }
}

// ---- The Bandstand: the ring's centre + the parul mast beyond it (N) ---------
// The dais sits at the middle of the festival ground where the stage stood; the
// parul mast — the zone's navigation landmark — rises just north of the ring.
function bandstand(world) {
  plazaDais(world, RING.x, RING.z, { radius: 4.2, segments: 12 });
  // broken audience benches ringing the dais, listing where the crowd sat
  const benchN = 8;
  for (let i = 0; i < benchN; i++) {
    const a = (i / benchN) * Math.PI * 2;
    const px = RING.x + Math.cos(a) * 7, pz = RING.z + Math.sin(a) * 7;
    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.5), world.mat.wood);
    bench.position.set(px, 0.35, pz);
    bench.rotation.y = a + Math.PI / 2;
    bench.rotation.z = (world.rng() - 0.5) * 0.3;   // broken, listing
    world.scene.add(bench);
    world.addCollider(px, pz, 0.8, 0.3);
  }
  // the parul mast, north of the ring at the end of the parade arc
  world._parulMast(-3, -34, { height: 14, starRadius: 1.8 });
  plazaDais(world, -3, -31, { radius: 3.0, segments: 8 });
}

// ---- The Gong Circle: drummers'/gong court off the ring's west gap -----------
function gongCircle(world) {
  const [cx, cz] = rim(GAP.gong, -7);     // just OUTSIDE the west rim gap
  const r = 6.5;
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
  // sparse houses backing the court (collision cover, district texture)
  for (const [bx, bz] of [[-40, -12], [-38, -30], [-24, -32], [-36, 6]]) {
    if (world.rng() < 0.2) continue;
    world._building(bx + (world.rng() - 0.5) * 2, bz + (world.rng() - 0.5) * 2,
      4.5 + world.rng() * 2, 4.5 + world.rng() * 2, 4 + world.rng() * 3.5);
  }
  world.spawnNodes.near_wall.push([cx - 4, cz + 2]);
}

// ---- The Ruined Dancing Hall: open shell off the ring's north-east gap -------
// Sits out along the NE approach ray; its entrance faces WEST, back down that
// approach toward the festival ground, so the way in reads on arrival. A sunken
// mosaic dance floor and two cold, long-dark chandeliers.
function dancingHall(world) {
  hallShell(world, 24, -22, {
    entrance: 'west',
    mezzanine: true,
    interior(w, cx, cz) {
      // sunken tiled dance floor
      const floor = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 0.15, 24), w.mat.concrete);
      floor.position.set(cx, W - 0.35, cz);
      w.scene.add(floor);
      // two broken chandeliers — cool ghostly light, distinct from the warm ring
      w._lanternCluster(cx - 2, cz - 1, { count: 6, y: 6.5, radius: 1.1, color: 0xbfe9e2 });
      w._lanternCluster(cx + 3, cz + 2, { count: 4, y: 5.8, radius: 0.8, color: 0xbfe9e2 });
      // fallen/leaning columns (decor, non-colliding)
      for (const [ox, oz] of [[-5, -4], [5, 3], [-4, 4]]) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 2.6, 8), w.mat.concrete);
        col.position.set(cx + ox, W + 0.5, cz + oz);
        col.rotation.z = (w.rng() - 0.5) * 1.4;   // toppled
        col.rotation.y = w.rng() * Math.PI;
        w.scene.add(col);
      }
    },
  });
}

// ---- The Float Graveyard: a capsized parade pile-up (SW) ---------------------
// Moved off zone 1's boatyard coordinates entirely and re-staged as a heap: the
// floats are stacked and canted against each other rather than parked in a row,
// with a walkable deck across the biggest capsized hull.
function floatGraveyard(world) {
  world._building(-40, 24, 7, 6, 4.5, Math.PI / 2.4, { windows: false });   // parade shed
  const floatColors = [0xb5453f, 0xd9a23a, 0x3f8f7a, 0x3f6fae];
  hullRow(world,
    [[-30, 22, 0.5], [-27, 27, -0.4], [-34, 30, 1.2], [-22, 31, 0.2], [-31, 17, -1.1]],
    {
      matFor: (i) => new THREE.MeshStandardMaterial({
        color: floatColors[i % floatColors.length], roughness: .8,
      }),
      onPlaced(w, x, z, rot) {
        if (w.rng() < 0.6) {
          const a = rot + Math.PI / 2;
          w._bunting(x - Math.cos(a) * 1.2, z - Math.sin(a) * 1.2, x + Math.cos(a) * 1.2, z + Math.sin(a) * 1.2,
            { y: W + 1.0, sag: 0.25, pennants: 2, posts: false });
        }
      },
    });
  cradleRow(world, [[-25, 18], [-36, 25]]);

  // The capsized flagship: a broad tilted deck the player can climb onto, with a
  // dead parul still lashed to its mast stump.
  const deckY = W + 1.5;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.3, 3.4), world.mat.plank);
  deck.position.set(-30, deckY - 0.15, 25);
  deck.rotation.z = 0.06;
  world.scene.add(deck);
  world.addSupportSurface(-30, 25, 2.75, 1.7, 0, deckY);
  const rampLen = 3.4;
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.24, rampLen), world.mat.plank);
  ramp.position.set(-30, deckY / 2, 25 + 1.7 + rampLen / 2);
  ramp.rotation.x = Math.atan2(deckY, rampLen);
  world.scene.add(ramp);
  world.addSupportSurface(-30, 25 + 1.7 + rampLen / 2, 1.1, rampLen / 2, 0, deckY, 0);
  world._lanternCluster(-30, 23.6, { count: 4, y: deckY + 2.4, radius: 0.7, withPost: true, postHeight: deckY + 2.6 });
  // Deliberately NOT registered as a moundSpot: `elevated_rubble` artifacts are
  // dropped at a fixed low height and jittered ±1.5m, which around here would
  // strand them inside the hull pile or floating under the deck. The deck earns
  // its place as traversal and as a vantage over the graveyard, not as a spawn.
}

// ---- The Parade Stalls: food-vendor rows along the entry avenue + ring rim ---
// Two short facing rows frame the entry avenue (keeping the guardian approach
// legible), then the rest curve along the ring's inner rim.
function paradeStalls(world) {
  const specs = [];
  // entry avenue: z 26 → 10, flanking the Rift/Reveler corridor
  for (let i = 0; i < 4; i++) {
    const cz = 26 - i * 5.4;
    for (const side of [-1, 1]) {
      if (world.rng() < 0.15) continue;
      const offset = 5.4 + world.rng() * 2.0;
      const broken = world.rng() < 0.25;
      specs.push({
        x: side * offset, z: cz + (world.rng() - 0.5) * 1.6,
        rot: side < 0 ? Math.PI / 2 : -Math.PI / 2,
        scale: 0.95 + world.rng() * 0.2, broken,
        tilt: (world.rng() - 0.5) * 0.16,
      });
    }
  }
  // Ring rim: stalls set just inside the colonnade, facing the festival ground.
  // Bearings are chosen to stay clear of every rim GAP — a stall parked in an
  // approach would wall off the way into the ring.
  for (const a of [0.2, 0.7, 1.15, 2.0, 2.5, 3.6, 4.2, 5.2]) {
    if (world.rng() < 0.2) continue;
    const [px, pz] = rim(a, 2.6);
    specs.push({
      x: px, z: pz,
      rot: radialArchYaw(a),                        // counters turned inward
      scale: 0.95 + world.rng() * 0.2,
      broken: world.rng() < 0.3,
      tilt: (world.rng() - 0.5) * 0.16,
    });
  }
  world._stallRow(specs);
}

// ---- The Parade Arc: the lit route curving off the ring to the parul mast ----
// Lantern garlands and bunting hung along a CURVE, so following the lights turns
// the player through the zone instead of marching them down a straight spine.
function paradeArc(world) {
  // 1 — the entry avenue canopy (straight, short: the guardian's stage)
  world._lanternString(-8.5, 22, 8.5, 22, { y: 3.4, sag: 0.5, count: 6, color: 0xffb35c });
  world._bunting(-8.5, 14, 8.5, 14, { y: 3.6, sag: 0.7, pennants: 7 });

  // 2 — the arc: garlands sampled along a curve just INSIDE the ring rim,
  // sweeping east then north across the festival ground to the terminus side.
  // Routing it inside is deliberate — the outside of that same bearing is where
  // the dancing hall stands, and the plaza interior is the only open sweep wide
  // enough to carry the curve. Every span is `posts: false` so the canopy hangs
  // from the existing rim colonnade and adds nothing new to walk into.
  const arc = [];
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const a = 0.2 - (i / steps) * (Math.PI * 0.62);     // E rim → N rim
    arc.push(rim(a, 3));
  }
  for (let i = 0; i < arc.length - 1; i++) {
    const [x1, z1] = arc[i], [x2, z2] = arc[i + 1];
    if (i % 2 === 0) {
      world._lanternString(x1, z1, x2, z2,
        { y: 3.6, sag: 0.55, count: 4, color: i === 0 ? 0xffb35c : 0xff8f6b });
    } else {
      world._bunting(x1, z1, x2, z2, { y: 3.8, sag: 0.75, pennants: 5, posts: false });
    }
  }
  // 3 — the last span, arc's end into the mast plaza
  const [ex, ez] = arc[arc.length - 1];
  world._lanternString(ex, ez, -3, -31, { y: 3.6, y2: 3.2, sag: 0.5, count: 5, color: 0xffd25c });
}

// ---- The Lantern Overlook: raised vantage strung with lanterns (SE) ---------
function lanternOverlook(world) {
  overlookPlatform(world, 32, 22, {
    dressing(w, cx, cz, height) {
      w._lanternCluster(cx + 2.6, cz + 2.6,
        { count: 5, y: height + 6, radius: 0.7, withPost: true, postHeight: height + 6.4 });
    },
  });
}

// ---- Gateways: broken arches marking thresholds, festooned for LIKET ------
// Placed on the actual route now: the dock mouth, the ring's south entry, the
// west gong-court gap and the arc's bend.
function gateways(world) {
  const arches = [
    { x: 0, z: 26, rot: 0, span: 6, height: 5 },              // mouth of the entry avenue
    { x: 0, z: 10, rot: 0, span: 5.5, height: 5.5 },          // into the festival ground
    ...[GAP.gong, GAP.hall].map((a) => {
      const [gx, gz] = rim(a);
      return { x: gx, z: gz, rot: radialArchYaw(a), span: 5, height: 4.5 };
    }),
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

// Spawn nodes anchored to the districts (consumed by ArtifactManager + Guardian).
// NOTE: appends, because the districts above already pushed a few of their own.
function setSpawnNodes(world) {
  world.spawnNodes.near_wall.push(
    [-33, -26],                    // gong-court house faces
    [17, -22],                     // dancing hall west front (on the ring approach)
    [-34, 20],                     // parade shed apron
    [-3, -28],                     // mast plaza edge
  );
  world.spawnNodes.submerged_interior.push(
    [24, -22], [21, -20], [27, -24],   // inside the dancing hall shell
    [RING.x, RING.z],                   // on the bandstand dais
  );
  world.spawnNodes.elevated_rubble.push(...world.moundSpots);
  world.spawnNodes.open_water.push(
    [0, 20], [0, 6],                 // the entry avenue
    ...[0.4, 1.9, 3.6, 5.1].map((a) => rim(a, 6)),   // spread around the festival ground
  );
}

export const zone2 = {
  id: 'zone2',
  name: 'LIKET',
  label: 'Zone 2 — LIKET (Festival Zone)',   // descend-screen heading
  seed: 20260702,
  arenaId: 'arena2',
  riftSpot: { x: 0, z: 16 },
  guardianStart: { x: 0, z: 16 },   // waits ahead of the dock on the entry avenue
  guardianRebuke: 'Not yet. The tide keeps its festival for those who have not proven themselves.',
  guardianName: { fil: 'The Reveler', eng: 'The Reveler' },
  // Spoken (as a subtitle) one line at a time right after the player descends. PLACEHOLDER.
  introDialogue: [
    '[Zone 2 — LIKET] The current here still hums with old music.',
    '[Zone 2 placeholder] Somewhere below, the festival never stopped playing.',
  ],
  background: 0x10222b,
  fog: { color: 0x1c3a3e, density: CONFIG.FOG_DENSITY },
  // Warm brass/festival-cloth palette contrasts The Reveler's cool spectral
  // coral body so the guardian reads as an apparition against it.
  palette: {
    cloth: 0x7a3a3a, sign: 0xd9a53f, ware: 0xd97a3f,
    building: 0x24322f, buildingAlt: 0x2c3a30,
    concrete: 0x3a3128, rust: 0x6a4a2a, metal: 0x6a5a2a,
  },
  // Same moon as PONSIA, but everything BOUNCED is warmer: the silt bounce, the
  // ambient floor and the environment's lower band all carry festival brass, so
  // the lantern garlands feel like they are still spilling light onto the plaza
  // instead of glowing in isolation against a cold zone.
  light: {
    hemiGround: 0x2a2016,
    hemiIntensity: 0.9,
    ambientColor: 0x4d5a48,
    ambientIntensity: 0.6,
    fillColor: 0x7a6a4e,
    envHorizon: 0x4a5450,
    envGround: 0x1c1810,
    envIntensity: 0.6,
  },
  // Build order is layout-significant (drives the seeded RNG); preserve it.
  build(world) {
    // Perimeter gaps deliberately differ from zone 1's so the boundary reads as a
    // different city block, not the same ring redressed.
    perimeterBlocks(world, {
      north: [-30, -14, 14, 30],
      west: [-20, 2, 22],
      east: [-30, -8, 16],
      south: [-34, 34],
    });
    roundPlaza(world);
    bandstand(world);
    gongCircle(world);
    dancingHall(world);
    floatGraveyard(world);
    paradeStalls(world);
    paradeArc(world);
    lanternOverlook(world);
    gateways(world);
    world._dock({ cx: 0, cz: 34 });
    world._mangroveRing({ radius: 47, step: 3.6 });
    world._rubbleField([[-16, 14], [12, -26], [-8, 8], [20, 4]]);
    world._debris();
    setSpawnNodes(world);
  },
};
