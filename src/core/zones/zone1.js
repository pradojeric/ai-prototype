// ============================================================
// ZONE 1 — submerged PONSIA District (GDD §3/§13)
// Composed around a CENTRAL NORTH–SOUTH AVENUE: the player spawns on the south
// dock (+Z) looking north (-Z) down a flooded market street lined by stall rows,
// passes through broken ruin-arch GATEWAYS that mark each district threshold, and
// is drawn toward a tall ruined TOWER landmark (the auctioneer's bell-mast) that
// reads through the fog at the avenue's north end. Districts hang off the spine:
//   Memories Alley (W) · Silent Auction Square + tower (center-N, terminus) ·
//   Ruined Fish Warehouse (E) · Lost Boatyard (far E) · Drowning Stalls (line the
//   avenue) · Foggy Overlook + vantage post (SE) · Player Dock (S). Depth through
//   the fog now comes from the moonlight rig (World._lights) raking across the
//   landmarks, not from god-ray cones — those were removed.
//
// The avenue is deliberately NOT mirror-symmetric: stall stations jitter in and
// out and drop out unevenly, so the market street reads as a real street rather
// than a corridor. Two pieces of verticality break the flat wade — the Kanal
// Alley footbridge (W) and the warehouse mezzanine (E) — both authored as
// support surfaces, which is also how their artifacts get a dry place to sit.
//
// This is a *zone definition* consumed by the World engine (src/core/World.js):
// each district is a plain function taking the `world` engine as context, using
// its reusable primitives (_building, _stallRow, _mangroveRing, _dock, _debris,
// _tower, _ruinArch, _rubbleField), the shared district builders in
// zones/_partials/zoneKit.js, and seeded `rng`. `build(world)` calls them in a
// fixed, layout-significant order (the order drives the deterministic RNG).
// Register in zones/index.js.
// ============================================================
import * as THREE from 'three';
import { CONFIG } from '../../config.js';
import {
  perimeterBlocks, overlookPlatform, hallShell, cradleRow, hullRow, plazaDais, footbridge,
} from './_partials/zoneKit.js';

const W = CONFIG.WATER_LEVEL;

// ---- Memories Alley: dense small buildings split by narrow alleys (W) ------
function memoriesAlley(world) {
  // Three north-south rows of buildings west of the avenue; gaps read as alleys.
  const rows = [-42, -34, -26];
  const zs = [-36, -27, -18, -9, 0];
  // The catwalk below runs down this cross-alley, so the two rows flanking it are
  // built SHALLOW on purpose — building colliders block at every height, so a
  // deep house here would stop the player dead halfway across the deck.
  const CATWALK_Z = -22.5;
  const flanksCatwalk = (bz) => bz === -18 || bz === -27;
  for (const bx of rows) {
    for (const bz of zs) {
      if (world.rng() < 0.22) continue;               // missing house → pocket
      const w = 4.5 + world.rng() * 2.5;
      const d = flanksCatwalk(bz) ? 3.2 + world.rng() * 0.4 : 4.5 + world.rng() * 2.5;
      const bh = 4.5 + world.rng() * 4.5;
      world._building(bx + (world.rng() - 0.5), bz + (world.rng() - 0.5) * 1.5, w, d, bh);
    }
  }
  // A surviving first-floor CATWALK slung down the cross-alley. The long approach
  // ramp makes it a real route, not scenery: from up here the player can see over
  // the alley roofs to the bell-mast, and an artifact can spawn dry above the flood.
  footbridge(world, -34, CATWALK_Z, -26, CATWALK_Z, { deckY: 3.4, width: 1.6, rampLen: 5.5 });
  world.spawnNodes.elevated_rubble.push([-30, CATWALK_Z]);
}

// ---- Kanal Alley: a walled flood channel crossed by a plank footbridge (W) --
// Low stone embankments turn the west approach into a channel that can only be
// crossed at the bridge, so reaching north Memories Alley from the dock is a
// choice (over the bridge, or the long way round the avenue) rather than a
// straight-line wade. The channel mouth opens onto the avenue at its east end.
function kanalAlley(world) {
  const z0 = 6.5, z1 = 9.5;          // embankment centrelines
  const xStart = -40, xEnd = -12;
  const bridgeX = -26, bridgeGap = 2.6;

  const embankment = (cx, cz, len) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(len, 1.5, 0.9), world.mat.concrete);
    wall.position.set(cx, 0.55, cz);
    wall.rotation.z = (world.rng() - 0.5) * 0.03;   // settled, uneven
    world.scene.add(wall);
    world.addCollider(cx, cz, len / 2, 0.45);
  };
  // Each bank is split either side of the bridge crossing so the deck lands on
  // stone rather than clipping through a wall.
  for (const cz of [z0, z1]) {
    const westLen = (bridgeX - bridgeGap / 2) - xStart;
    const eastLen = xEnd - (bridgeX + bridgeGap / 2);
    embankment(xStart + westLen / 2, cz, westLen);
    embankment(xEnd - eastLen / 2, cz, eastLen);
  }
  // mooring posts along the north bank
  for (const px of [-36, -30, -20, -15]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 1.9, 6), world.mat.wood);
    post.position.set(px, 0.95, z1 + 0.9);
    world.scene.add(post);
    world.addCollider(px, z1 + 0.9, 0.18, 0.18);
  }
  footbridge(world, bridgeX, z1 + 1.6, bridgeX, z0 - 1.6, { deckY: W + 1.4, rampLen: 3.2 });
  world.spawnNodes.open_water.push([-20, 8]);        // in the channel itself
}

// ---- The Silent Auction Square: the avenue's northern TERMINUS -------------
// Open plaza with a walkable dais, a tall ruined bell-tower drawing the eye from
// the dock, a ring of broken columns, and the auctioneer's anchor frame.
function auctionSquare(world) {
  const cx = 0, cz = -38;
  plazaDais(world, cx, cz, { radius: 3.4 });
  // the bell-mast: tall ruined tower, the zone's primary navigation landmark
  world._tower(cx - 4.5, cz - 1, { height: 17, baseR: 1.7 });
  // ring of short broken columns around the dais (solid, batched)
  const ringN = 8;
  const columns = [];
  for (let i = 0; i < ringN; i++) {
    const a = (i / ringN) * Math.PI * 2;
    columns.push({
      x: cx + Math.cos(a) * 6,
      z: cz + Math.sin(a) * 6,
      height: 2 + world.rng() * 1.8,                  // uneven, ruined heights
      baseR: 0.36,
    });
  }
  world._towerField(columns);
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
// The collapsed mezzanine along its north wall is the one dry floor in the zone.
function fishWarehouse(world) {
  hallShell(world, 26, -28, {
    entrance: 'west',
    mezzanine: true,
    interior(w, cx, cz) {
      // fallen crates on the flooded floor (decor, kept off the open center)
      for (const [ox, oz] of [[-5, -4], [5, 3], [-4, 4]]) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.8), w.mat.wood);
        c.position.set(cx + ox, W + 0.3, cz + oz);
        c.rotation.y = w.rng();
        w.scene.add(c);
      }
      // salt-crusted drying racks left standing against the east wall
      for (const oz of [-2, 2]) {
        const rack = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.2, 3.2), w.mat.wood);
        rack.position.set(cx + 6.2, 1.1, cz + oz);
        w.scene.add(rack);
        w.addCollider(cx + 6.2, cz + oz, 0.2, 1.6);
      }
    },
  });
}

// ---- The Lost Boatyard: scattered bangkâs, A-frame cradles, a shed (far E) --
function boatyard(world) {
  world._building(40, 12, 7, 6, 4.5, -Math.PI / 2.4, { windows: false });   // shed
  hullRow(world, [[34, -2, 0.3], [38, 4, -0.6], [33, 10, 1.4], [40, 16, 0.1]]);
  cradleRow(world, [[30, 6], [36, -6]]);
}

// ---- The Drowning Stalls: two rows LINING the central avenue ---------------
// Facing rows run N-S either side of the avenue, counters turned inward so the
// player walks the market street toward the tower terminus. Stations jitter
// their offset from the centreline and drop out independently per side, so the
// street is never mirror-symmetric — the old version pinned both rows at
// exactly x = ±6.5, which read as a corridor. Built in one batch (`_stallRow`)
// so the whole market is a handful of draw calls.
function drowningStalls(world) {
  const steps = 8;
  const specs = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const cz = 22 - t * 44;              // +22 (near dock) → -22 (near square)
    for (const side of [-1, 1]) {
      if (world.rng() < 0.18) continue;                  // a gap in the row
      const offset = 5.6 + world.rng() * 2.4;            // 5.6..8.0 from the centre
      const broken = world.rng() < 0.3;
      specs.push({
        x: side * offset,
        z: cz + (world.rng() - 0.5) * 2.2,
        rot: side < 0 ? Math.PI / 2 : -Math.PI / 2,       // counters face the aisle
        scale: 0.92 + world.rng() * 0.26,
        broken,
        tilt: broken ? (world.rng() - 0.5) * 0.18 : (world.rng() - 0.5) * 0.08,
      });
    }
  }
  world._stallRow(specs);
}

// ---- The Foggy Overlook: raised vantage + a slender beacon post (SE) --------
function foggyOverlook(world) {
  overlookPlatform(world, 33, 30, {
    dressing(w, cx, cz) {
      // a slender ruined post on the corner — a vantage marker spotted across the zone
      w._tower(cx + 2.6, cz + 2.6, { height: 11, baseR: 0.85 });
    },
  });
}

// ---- Gateways: broken ruin-arches marking thresholds along the avenue -------
function gateways(world) {
  world._ruinArch(0, 26, 0, { span: 6, height: 5 });      // mouth of the avenue (by the dock)
  world._ruinArch(0, -31, 0, { span: 5.5, height: 5.5 }); // into the Auction Square terminus
  world._ruinArch(-11, 2, Math.PI / 2, { span: 5 });      // west, into Memories Alley
  world._ruinArch(15, -28, Math.PI / 2, { span: 5 });     // east, toward the Fish Warehouse
}

// Spawn nodes anchored to the districts (consumed by ArtifactManager + Guardian).
// Spread across every district so the roaming Guardian tours the player past the
// whole zone, and so scattered artifacts land in distinct, reachable pockets.
// NOTE: appends, because the districts above already pushed a few of their own.
function setSpawnNodes(world) {
  world.spawnNodes.near_wall.push(
    [-24, -8], [-28, 4],           // Memories Alley building faces
    [18, -28],                     // warehouse west front (on the avenue)
    [35, 13],                      // boatyard shed apron (clear of the hulls)
    [-6, -28],                     // south approach to the auction square — kept
                                   // out of the square itself, whose dais, column
                                   // ring and arch piers leave only tight pockets
                                   // that a jittered spawn can get stranded in
  );
  world.spawnNodes.submerged_interior.push(
    [26, -28], [23, -26], [29, -30],   // inside the Fish Warehouse shell
    [0, -38],                           // on the auction dais (under the tower)
  );
  world.spawnNodes.elevated_rubble.push(...world.moundSpots);   // overlook + mounds
  world.spawnNodes.open_water.push(
    [0, 16], [0, -2], [0, -20],    // down the central avenue (open sightline)
    [-14, -14], [14, 6], [-16, 20],   // side lanes between clusters
  );
}

export const zone1 = {
  id: 'zone1',
  name: 'PONSIA',
  label: 'Zone 1 — PONSIA',   // descend-screen heading
  seed: 20260618,
  arenaId: 'arena1',
  riftSpot: { x: 0, z: 14 },        // Memory Rift gateway into the arena (ahead of the dock on the avenue)
  guardianStart: { x: 0, z: 14 },   // waits ahead of the dock on the avenue (between near light shaft z=10 and the arch z=26)
  guardianRebuke: 'You are not worthy of these waters. The market keeps its memories yet.',   // shown on a wrong riddle answer
  guardianName: { fil: 'Bantay ng Pantal', eng: 'The Feastkeeper' },
  // Spoken (as a subtitle) one line at a time right after the player descends. PLACEHOLDER.
  introDialogue: [
    '[Zone 1 — PONSIA] The water is colder than I remember.',
    '[Zone 1 placeholder] Somewhere here, the market still holds what it loved.',
  ],
  background: 0x0c2b2c,
  fog: { color: 0x123c3a, density: CONFIG.FOG_DENSITY },
  palette: {},   // uses the engine's default flooded-market materials
  // No `light` block on purpose: PONSIA is the reference mood that
  // _partials/ZoneLighting.js DEFAULT_LIGHT was tuned against. Zones 2 and 3
  // shift off this one, so retune here only when you mean to move all of them.
  // Build order is layout-significant (drives the seeded RNG); preserve it.
  build(world) {
    perimeterBlocks(world);
    memoriesAlley(world);
    kanalAlley(world);
    auctionSquare(world);
    fishWarehouse(world);
    boatyard(world);
    drowningStalls(world);
    foggyOverlook(world);
    gateways(world);
    world._dock({ cx: 0, cz: 34 });
    world._mangroveRing({ radius: 47, step: 3.6 });
    world._rubbleField([[-30, 20], [16, -20], [-12, 12], [26, -40]]);
    world._debris();
    setSpawnNodes(world);
  },
};
