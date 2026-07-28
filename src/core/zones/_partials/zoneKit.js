// ============================================================
// ZONE KIT — district builders shared by the submerged zones (GDD §3/§13)
// ============================================================
// These are the builders that were previously copy-pasted between zone1.js,
// zone2.js and zone3.js: the bounding street edge, the raised overlook platform,
// the big open hall shell, and the boat/float cradles. They sit one level above
// World's primitives — a primitive makes one object, a kit function lays out a
// whole district from primitives — so zone files can stay about *layout intent*.
//
// Every function takes the `world` engine as its first argument and draws from
// `world.rng`, so calls remain layout-significant in the zone's build order.
// Anything genuinely zone-specific (a warehouse's crates vs. a ballroom's dance
// floor) is passed in as an `interior` callback rather than branched on here.
import * as THREE from 'three';
import { CONFIG } from '../../../config.js';

const W = CONFIG.WATER_LEVEL;

// ---- Perimeter: bounding street edge of ruined blocks ----------------------
// Walls the play area in with tall blocks while leaving deliberate gaps, so the
// edge reads as a continuing drowned city rather than an arena wall. `gaps`
// controls where those openings fall, which is how two zones sharing this
// builder still get distinct boundaries.
//   openNorthCenter — leave the north-center clear so a terminus landmark
//                     silhouette reads against the fog
//   openSouthCenter — leave the south-center clear for the player dock
export function perimeterBlocks(world, opts = {}) {
  const {
    radius = 45,
    north = [-34, -18, 18, 34],
    west = [-12, 8, 28],
    east = [-22, -2, 22],
    south = [-38, 38],
    size = [13, 7],
  } = opts;
  const R = radius;
  const [bw, bd] = size;
  const h = () => 6 + world.rng() * 4;
  for (const x of north) world._building(x, -R, bw, bd, h(), 0);
  for (const z of west) world._building(-R, z, bw, bd, h(), Math.PI / 2);
  for (const z of east) world._building(R, z, bw, bd, h(), -Math.PI / 2);
  for (const x of south) world._building(x, R, bw, bd, h(), Math.PI);
}

// ---- Overlook: a raised concrete slab you can stand on (a vantage point) ----
// The slab is walkable via an authored support surface rather than a collider,
// so the player can actually climb it from the ramp side and look out over the
// zone. Registers itself as an `elevated_rubble` artifact anchor. `dressing`
// hangs the zone's own marker on it (a ruined post, a lantern cluster, ...).
export function overlookPlatform(world, cx, cz, opts = {}) {
  const { size = 8, height = W + 0.9, railings = true, dressing = null } = opts;
  const half = size / 2;

  const slab = new THREE.Mesh(new THREE.BoxGeometry(size, 1.6, size), world.mat.concrete);
  slab.position.set(cx, height - 0.8, cz);
  world.scene.add(slab);
  // Solid below the deck only, so the player is blocked by the sides but can
  // stand on top (see the minY/maxY tier support in World.addCollider).
  world.addCollider(cx, cz, half, half, { maxY: height - 0.25 });
  world.addSupportSurface(cx, cz, half, half, 0, height);

  // A rubble ramp up the south face — without this the vantage is unreachable.
  const rampLen = 3.4;
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.3, rampLen), world.mat.rubble);
  ramp.position.set(cx, height / 2, cz + half + rampLen / 2);
  ramp.rotation.x = Math.atan2(height, rampLen);
  world.scene.add(ramp);
  world.addSupportSurface(cx, cz + half + rampLen / 2, 1.3, rampLen / 2, 0, height, 0);

  if (railings) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.2, 0.16), world.mat.metal);
      post.position.set(cx + sx * (half - 0.6), height + 0.6, cz + sz * (half - 0.6));
      world.scene.add(post);
    }
  }

  world.moundSpots.push([cx, cz]);
  if (dressing) dressing(world, cx, cz, height);
  return height;
}

// ---- Hall shell: a large open roofless building the player walks into -------
// The zone's big interior landmark (fish warehouse, dancing hall). Three solid
// walls plus a two-stub fourth wall leaving a walk-in entrance; the roof is
// gone except for a few sagging beams. `interior` fills it with the zone's own
// contents, and `mezzanine` adds a climbable upper deck so an artifact inside
// can sit above the waterline.
export function hallShell(world, cx, cz, opts = {}) {
  const {
    halfW = 8, halfD = 7, wallHeight = 8,
    entrance = 'west',            // which face carries the 4m opening
    beams = true, mezzanine = false, interior = null,
    wallMat = world.mat.rust,
  } = opts;

  const wall = (x, z, w, d, h) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(geo, wallMat);
    m.position.set(x, h / 2, z);
    world.scene.add(m);
    world.addCollider(x, z, w / 2, d / 2);
  };

  // Solid faces, then the entrance face split into two stubs around the opening.
  const gapHalf = 2.5;
  const stub = (halfD - gapHalf) / 2 + gapHalf / 2;
  if (entrance !== 'east')  wall(cx + halfW, cz, 0.6, halfD * 2, wallHeight);
  if (entrance !== 'north') wall(cx, cz - halfD, halfW * 2, 0.6, wallHeight);
  if (entrance !== 'south') wall(cx, cz + halfD, halfW * 2, 0.6, wallHeight);
  if (entrance !== 'west')  wall(cx - halfW, cz, 0.6, halfD * 2, wallHeight);
  if (entrance === 'west' || entrance === 'east') {
    const x = cx + (entrance === 'west' ? -halfW : halfW);
    wall(x, cz - stub, 0.6, halfD - gapHalf, wallHeight);
    wall(x, cz + stub, 0.6, halfD - gapHalf, wallHeight);
  } else {
    const z = cz + (entrance === 'north' ? -halfD : halfD);
    const sw = (halfW - gapHalf) / 2 + gapHalf / 2;
    wall(cx - sw, z, halfW - gapHalf, 0.6, wallHeight);
    wall(cx + sw, z, halfW - gapHalf, 0.6, wallHeight);
  }

  // Broken roof beams across the top (decor, non-colliding).
  if (beams) {
    for (let i = -1; i <= 1; i++) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2, 0.3, 0.4), world.mat.metal);
      beam.position.set(cx, wallHeight + 0.2 + world.rng() * 0.4, cz + i * 4.5);
      beam.rotation.z = (world.rng() - 0.5) * 0.25;       // sagging / fallen-in
      world.scene.add(beam);
    }
  }

  // A collapsed upper deck along the back wall, reached by a fallen-beam ramp.
  // Gives the hall real verticality and a dry spot for an interior artifact.
  if (mezzanine) {
    const deckY = wallHeight * 0.46;
    const deckHalfD = 2.2;
    const deckZ = cz - halfD + deckHalfD + 0.4;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(halfW * 1.5, 0.3, deckHalfD * 2), world.mat.plank);
    deck.position.set(cx, deckY - 0.15, deckZ);
    world.scene.add(deck);
    world.addSupportSurface(cx, deckZ, halfW * 0.75, deckHalfD, 0, deckY);
    for (const sx of [-1, 1]) {
      const prop = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, deckY, 6), world.mat.metal);
      prop.position.set(cx + sx * halfW * 0.6, deckY / 2, deckZ + deckHalfD - 0.3);
      world.scene.add(prop);
    }
    // ramp: a fallen slab from the floor up to the deck's east end
    const rampLen = 4.6;
    const rampZ = deckZ + deckHalfD + rampLen / 2;
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.28, rampLen), world.mat.plank);
    ramp.position.set(cx + halfW * 0.45, deckY / 2, rampZ);
    ramp.rotation.x = Math.atan2(deckY, rampLen);
    world.scene.add(ramp);
    world.addSupportSurface(cx + halfW * 0.45, rampZ, 1.1, rampLen / 2, 0, deckY, 0);
    world.spawnNodes.submerged_interior.push([cx, deckZ]);
  }

  if (interior) interior(world, cx, cz);
}

// ---- A-frame cradles: dry-dock supports left behind by hauled-out boats -----
export function cradleRow(world, spots) {
  for (const [x, z] of spots) {
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3, 0.18), world.mat.wood);
      leg.position.set(s * 0.7, 1.5, 0);
      leg.rotation.z = -s * 0.4;
      g.add(leg);
    }
    g.position.set(x, 0, z);
    world.scene.add(g);
    world.addCollider(x, z, 1.0, 0.4);
  }
}

// ---- Hulls: capsule boats/floats resting at the waterline -------------------
// `matFor(index)` lets a zone colour each hull (zone2's parade floats) while
// zone1's bangkâs all share the engine's metal.
export function hullRow(world, boats, opts = {}) {
  const { matFor = null, onPlaced = null } = opts;
  boats.forEach(([x, z, rot], i) => {
    const hull = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.5, 3.2, 4, 8),
      matFor ? matFor(i) : world.mat.metal,
    );
    hull.rotation.z = Math.PI / 2;
    hull.rotation.y = rot;
    hull.scale.set(1, 1, 0.55);
    hull.position.set(x, W, z);
    world.scene.add(hull);
    const [fw, fd] = world._footprint(2.0, 0.7, rot);
    world.addCollider(x, z, fw, fd);
    if (onPlaced) onPlaced(world, x, z, rot, i);
  });
}

// ---- Plaza dais: the low walkable stone platform at an avenue's terminus ----
export function plazaDais(world, cx, cz, opts = {}) {
  const { radius = 3.6, segments = 16 } = opts;
  const dais = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius + 0.4, 0.5, segments), world.mat.concrete);
  dais.position.set(cx, W - 0.1, cz);
  world.scene.add(dais);
  return dais;
}

// ---- Footbridge: a plank span the player can cross above the water ----------
// Used to give a zone a real traversal choice (over vs. around). Walkable via an
// authored support surface; the handrails are decor.
export function footbridge(world, x1, z1, x2, z2, opts = {}) {
  // `rampLen` should grow with `deckY` — a high catwalk needs a long approach or
  // the ramp reads as a wall.
  const { deckY = W + 1.15, width = 1.8, rails = true, rampLen = 2.6 } = opts;
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
  const rot = Math.atan2(dx, dz);            // +Z-aligned deck, yawed into place

  const deck = new THREE.Mesh(new THREE.BoxGeometry(width, 0.22, len), world.mat.plank);
  deck.position.set(cx, deckY - 0.11, cz);
  deck.rotation.y = rot;
  world.scene.add(deck);
  world.addSupportSurface(cx, cz, width / 2, len / 2, rot, deckY);

  // Ramps at both ends so the deck is reachable from the water.
  for (const s of [-1, 1]) {
    const rx = cx + (dx / len) * (len / 2 + rampLen / 2) * s;
    const rz = cz + (dz / len) * (len / 2 + rampLen / 2) * s;
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(width, 0.2, rampLen), world.mat.plank);
    ramp.position.set(rx, deckY / 2, rz);
    ramp.rotation.y = rot;
    ramp.rotation.x = Math.atan2(deckY, rampLen) * s;
    world.scene.add(ramp);
    // Support runs low→high toward the deck; local +Z is the ramp's far end.
    world.addSupportSurface(rx, rz, width / 2, rampLen / 2, rot,
      s > 0 ? deckY : 0, s > 0 ? 0 : deckY);
  }

  if (rails) {
    const posts = Math.max(2, Math.round(len / 2.2));
    for (let i = 0; i <= posts; i++) {
      const t = i / posts;
      for (const s of [-1, 1]) {
        const ox = (dz / len) * s * (width / 2 - 0.1);
        const oz = -(dx / len) * s * (width / 2 - 0.1);
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.1), world.mat.wood);
        post.position.set(x1 + dx * t + ox, deckY + 0.45, z1 + dz * t + oz);
        world.scene.add(post);
      }
    }
  }
  return deckY;
}
