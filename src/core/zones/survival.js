// ============================================================
// ENDLESS MEMORY — Survival mode's altar-born combat arena.
//
// This module owns only authored space: bounds, spawn lanes, landmarks, cover,
// and procedural dressing. Wave rules and combat state belong to
// core/survival/SurvivalController. The center remains collider-free so dash,
// boss telegraphs, and mixed-role waves always have a readable neutral ground.
// ============================================================
import * as THREE from 'three';
import { CONFIG } from '../../config.js';

const W = CONFIG.WATER_LEVEL;
const ARENA_RADIUS = 32;
const COMBAT_RADIUS = 29.5;
const CENTER_CLEAR_RADIUS = 11.5;
const SPAWN_RADIUS = 24;
const PORTAL_RADIUS = 27.2;
const COVER_RADIUS = 21.2;

const MOTIF_COLORS = Object.freeze({
  ponsia: 0x6bbba8,
  liket: 0xd6a23e,
  pananisia: 0xa8d8ee,
});

const LANE_SPECS = Object.freeze([
  Object.freeze({ id: 'pananisia-north', name: 'Archive Gate', motif: 'pananisia', angle: -Math.PI / 2 }),
  Object.freeze({ id: 'liket-northeast', name: 'Festival Gate', motif: 'liket', angle: -Math.PI / 6 }),
  Object.freeze({ id: 'ponsia-southeast', name: 'Market Gate', motif: 'ponsia', angle: Math.PI / 6 }),
  Object.freeze({ id: 'pananisia-south', name: 'Gallery Gate', motif: 'pananisia', angle: Math.PI / 2 }),
  Object.freeze({ id: 'liket-southwest', name: 'Procession Gate', motif: 'liket', angle: Math.PI * 5 / 6 }),
  Object.freeze({ id: 'ponsia-northwest', name: 'Feast Gate', motif: 'ponsia', angle: -Math.PI * 5 / 6 }),
]);

function pointAt(radius, angle) {
  return Object.freeze({
    x: Number((Math.cos(angle) * radius).toFixed(4)),
    z: Number((Math.sin(angle) * radius).toFixed(4)),
  });
}

const SPAWN_LANES = Object.freeze(LANE_SPECS.map((spec, index) => {
  const spawn = pointAt(SPAWN_RADIUS, spec.angle);
  const portal = pointAt(PORTAL_RADIUS, spec.angle);
  return Object.freeze({
    index,
    id: spec.id,
    name: spec.name,
    motif: spec.motif,
    angle: spec.angle,
    spawn,
    portal,
    inward: Object.freeze({
      x: Number((-Math.cos(spec.angle)).toFixed(4)),
      z: Number((-Math.sin(spec.angle)).toFixed(4)),
    }),
  });
}));

const COVER = Object.freeze(LANE_SPECS.map((spec, index) => {
  const angle = spec.angle + Math.PI / 6;
  const center = pointAt(COVER_RADIUS, angle);
  const approach = pointAt(COVER_RADIUS - 3.2, angle);
  return Object.freeze({
    id: `edge-cover-${index + 1}`,
    motif: LANE_SPECS[(index + 1) % LANE_SPECS.length].motif,
    x: center.x,
    z: center.z,
    halfW: 2.15,
    halfD: 0.55,
    height: 1.75 + (index % 3) * 0.35,
    rotation: Math.PI / 2 - angle,
    approach,
  });
}));

const LANDMARKS = Object.freeze([
  Object.freeze({
    id: 'memory-altar',
    motif: 'memory',
    x: 0,
    z: 0,
    radius: 4.4,
  }),
  Object.freeze({
    id: 'ponsia-gallery',
    motif: 'ponsia',
    ...pointAt(28.4, Math.PI * 5 / 6),
  }),
  Object.freeze({
    id: 'liket-gallery',
    motif: 'liket',
    ...pointAt(28.4, -Math.PI / 6),
  }),
  Object.freeze({
    id: 'pananisia-gallery',
    motif: 'pananisia',
    ...pointAt(28.4, -Math.PI / 2),
  }),
]);

// Cosmetic themes mark later boss tiers. The controller may call the published
// World hook after a boss; none of these values are read by collision or combat.
const BOSS_TIER_THEMES = Object.freeze([
  Object.freeze({
    id: 'memory-teal',
    accent: 0x62cfbd,
    secondary: 0x9fd4e8,
    water: 0x246b69,
    fog: 0x061a22,
  }),
  Object.freeze({
    id: 'festival-gold',
    accent: 0xe4b657,
    secondary: 0xb45f68,
    water: 0x5b4936,
    fog: 0x21151b,
  }),
  Object.freeze({
    id: 'archive-blue',
    accent: 0xa8d8ee,
    secondary: 0x8b93d8,
    water: 0x26475d,
    fog: 0x091522,
  }),
  Object.freeze({
    id: 'keeper-violet',
    accent: 0xc395f5,
    secondary: 0xe0c5ff,
    water: 0x45355e,
    fog: 0x150d24,
  }),
]);

const ARENA_BOUNDS = Object.freeze({
  center: Object.freeze({ x: 0, z: 0 }),
  radius: ARENA_RADIUS,
  combatRadius: COMBAT_RADIUS,
  centerClearRadius: CENTER_CLEAR_RADIUS,
  spawnRadius: SPAWN_RADIUS,
  portalRadius: PORTAL_RADIUS,
});

export const SURVIVAL_ARENA = Object.freeze({
  // Top-level aliases keep common controller reads terse; `bounds` is the
  // explicit object to pass into collision/spawn helpers.
  ...ARENA_BOUNDS,
  bounds: ARENA_BOUNDS,
  playerStart: Object.freeze({ x: 0, y: CONFIG.EYE_HEIGHT, z: 0 }),
  spawnLanes: SPAWN_LANES,
  cover: COVER,
  landmarks: LANDMARKS,
  bossTierThemes: BOSS_TIER_THEMES,
});

function additiveMaterial(color, opacity) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

function addShimmer(world, mesh, material, opacity, phase) {
  world.scene.add(mesh);
  world.shafts.push({
    mesh,
    mat: material,
    base: opacity,
    phase,
  });
}

// A continuous collider ring keeps collision simple and predictable. Alternating
// heights and gallery-frame inserts make it read as broken museum architecture
// rather than a modern arena wall.
function buildBoundaryGallery(world, tierMaterials) {
  const segments = 24;
  const segmentLength = 2 * ARENA_RADIUS * Math.tan(Math.PI / segments) + 0.45;
  const thickness = 1.7;
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const x = Math.cos(angle) * ARENA_RADIUS;
    const z = Math.sin(angle) * ARENA_RADIUS;
    const height = 4.2 + (i % 4) * 0.65;
    const rotation = Math.PI / 2 - angle;
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(segmentLength, height, thickness),
      i % 2 ? world.mat.buildingAlt : world.mat.building,
    );
    wall.position.set(x, height / 2, z);
    wall.rotation.y = rotation;
    world.scene.add(wall);
    world.addCollider(x, z, segmentLength / 2, thickness / 2, { rotation });

    // Every other bay keeps the outline of an empty museum frame. It is decor
    // only: the wall behind it owns the collision.
    if (i % 2 === 0) {
      const frame = new THREE.Group();
      const frameMat = tierMaterials.boundary;
      const frameWidth = Math.min(3.6, segmentLength - 1);
      const frameHeight = 2.2;
      for (const side of [-1, 1]) {
        const upright = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, frameHeight, 0.08),
          frameMat,
        );
        upright.position.set(side * frameWidth / 2, 0, 0);
        frame.add(upright);
      }
      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(frameWidth, 0.1, 0.08),
          frameMat,
        );
        rail.position.set(0, side * frameHeight / 2, 0);
        frame.add(rail);
      }
      frame.position.set(
        Math.cos(angle) * (ARENA_RADIUS - thickness / 2 - 0.05),
        2.4 + (i % 3) * 0.25,
        Math.sin(angle) * (ARENA_RADIUS - thickness / 2 - 0.05),
      );
      frame.rotation.y = rotation;
      world.scene.add(frame);
    }
  }
}

// Six radial guides make every arrival direction readable from the center. The
// lanes are markings, not rails: they never constrain player or enemy movement.
function buildSpawnLanes(world, tierMaterials) {
  const guideStart = CENTER_CLEAR_RADIUS + 0.8;
  const guideLength = SPAWN_RADIUS - guideStart;
  for (const lane of SPAWN_LANES) {
    const directionX = Math.cos(lane.angle);
    const directionZ = Math.sin(lane.angle);
    const centerDistance = guideStart + guideLength / 2;
    const rotation = Math.PI / 2 - lane.angle;

    const laneMaterial = additiveMaterial(MOTIF_COLORS[lane.motif], 0.09);
    tierMaterials.lanes.push(laneMaterial);
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 0.025, guideLength),
      laneMaterial,
    );
    strip.position.set(
      directionX * centerDistance,
      W + 0.035,
      directionZ * centerDistance,
    );
    strip.rotation.y = rotation;
    world.scene.add(strip);

    const lineMaterial = additiveMaterial(MOTIF_COLORS[lane.motif], 0.38);
    tierMaterials.guides.push(lineMaterial);
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.035, guideLength),
      lineMaterial,
    );
    line.position.copy(strip.position);
    line.position.y += 0.015;
    line.rotation.y = rotation;
    addShimmer(world, line, lineMaterial, 0.38, lane.index * 0.9);

    const markerMaterial = additiveMaterial(MOTIF_COLORS[lane.motif], 0.5);
    tierMaterials.markers.push(markerMaterial);
    const marker = new THREE.Mesh(
      new THREE.TorusGeometry(1.4, 0.09, 6, 28),
      markerMaterial,
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(lane.spawn.x, W + 0.07, lane.spawn.z);
    addShimmer(world, marker, markerMaterial, 0.5, lane.index * 0.7);

    // Broken arches identify the source of arrivals without sealing the lane.
    // Their two pier colliders stay outside the authored spawn point.
    world._ruinArch(lane.portal.x, lane.portal.z, rotation, {
      span: 4.8,
      height: 4.3,
      mat: world.mat.concrete,
    });
  }
}

function dressPonsiaCover(world, cover) {
  const ware = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const bowl = new THREE.Mesh(
      new THREE.SphereGeometry(0.16 + i * 0.025, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      world.mat.ware,
    );
    bowl.position.set(-0.65 + i * 0.42, cover.height / 2 + 0.12, 0);
    ware.add(bowl);
  }
  ware.position.set(cover.x, 0, cover.z);
  ware.rotation.y = cover.rotation;
  world.scene.add(ware);
}

function dressLiketCover(world, cover) {
  const tangentX = Math.cos(cover.rotation);
  const tangentZ = -Math.sin(cover.rotation);
  const dx = tangentX * cover.halfW * 0.82;
  const dz = tangentZ * cover.halfW * 0.82;
  world._lanternString(
    cover.x - dx,
    cover.z - dz,
    cover.x + dx,
    cover.z + dz,
    {
      y: cover.height + 0.75,
      sag: 0.3,
      count: 3,
      color: 0xe4b657,
      posts: true,
    },
  );
}

function dressPananisiaCover(world, cover, tierMaterials) {
  const frame = new THREE.Mesh(
    new THREE.TorusGeometry(0.7, 0.07, 6, 18),
    tierMaterials.boundary,
  );
  frame.position.set(cover.x, cover.height + 0.65, cover.z);
  frame.rotation.y = cover.rotation;
  world.scene.add(frame);
}

// Six short waist-to-head-high fragments sit between the spawn lanes. They
// create brief line-of-sight breaks while leaving the center and arrival paths
// open, preventing cover from becoming a safe perimeter bunker.
function buildSparseEdgeCover(world, tierMaterials) {
  for (const cover of COVER) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(cover.halfW * 2, cover.height, cover.halfD * 2),
      cover.motif === 'liket' ? world.mat.rust : world.mat.concrete,
    );
    wall.position.set(cover.x, cover.height / 2, cover.z);
    wall.rotation.y = cover.rotation;
    world.scene.add(wall);
    world.addCollider(cover.x, cover.z, cover.halfW, cover.halfD, {
      rotation: cover.rotation,
    });

    if (cover.motif === 'ponsia') dressPonsiaCover(world, cover);
    else if (cover.motif === 'liket') dressLiketCover(world, cover);
    else dressPananisiaCover(world, cover, tierMaterials);
  }
}

// The player is born on this submerged altar. All geometry is low and
// non-colliding, preserving a clean central combat disc.
function buildMemoryAltar(world, tierMaterials) {
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(4.4, 4.8, 0.24, 24),
    world.mat.concrete,
  );
  base.position.set(0, W - 0.19, 0);
  world.scene.add(base);

  const rings = [
    { radius: 1.55, opacity: 0.48 },
    { radius: 2.8, opacity: 0.31 },
    { radius: 4.15, opacity: 0.2 },
  ];
  for (let i = 0; i < rings.length; i++) {
    const { radius, opacity } = rings[i];
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.08, 6, 36),
      tierMaterials.altar,
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, W + 0.045 + i * 0.008, 0);
    addShimmer(world, ring, tierMaterials.altar, opacity, i * 1.8);
  }

  // Three short radial strokes remember the campaign's three restored regions.
  for (let i = 0; i < 3; i++) {
    const angle = -Math.PI / 2 + i * Math.PI * 2 / 3;
    const stroke = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.025, 2.2),
      tierMaterials.altar,
    );
    stroke.position.set(Math.cos(angle) * 1.2, W + 0.06, Math.sin(angle) * 1.2);
    stroke.rotation.y = Math.PI / 2 - angle;
    world.scene.add(stroke);
  }
}

function installTierPresentation(world, tierMaterials) {
  world.survivalVisualTier = 0;
  world.setSurvivalBossTier = (tier = 0) => {
    const normalizedTier = Math.max(0, Math.floor(Number.isFinite(tier) ? tier : 0));
    const theme = BOSS_TIER_THEMES[normalizedTier % BOSS_TIER_THEMES.length];
    world.survivalVisualTier = normalizedTier;
    tierMaterials.altar.color.set(theme.accent);
    tierMaterials.boundary.color.set(theme.secondary);
    tierMaterials.lanes.forEach((material, index) => {
      material.color.set(index % 2 ? theme.secondary : theme.accent);
    });
    tierMaterials.guides.forEach((material) => material.color.set(theme.accent));
    tierMaterials.markers.forEach((material) => material.color.set(theme.secondary));
    world.waterMat.uniforms.uColor.value.set(theme.water);
    world.scene.fog.color.set(theme.fog);
    return theme.id;
  };
  world.setSurvivalBossTier(0);
}

function publishEncounterData(world) {
  // These immutable references are the only arena-layout API Survival gameplay
  // needs. Publishing named aliases keeps controller reads concise and makes the
  // no-obstacle center contract explicit in diagnostics.
  world.survivalArena = SURVIVAL_ARENA;
  world.survivalBounds = SURVIVAL_ARENA.bounds;
  world.survivalSpawnLanes = SURVIVAL_ARENA.spawnLanes;
  world.survivalLandmarks = SURVIVAL_ARENA.landmarks;
  world.survivalCover = SURVIVAL_ARENA.cover;

  world.spawnNodes.open_water = SURVIVAL_ARENA.spawnLanes.map(
    (lane) => [lane.spawn.x, lane.spawn.z],
  );
  world.spawnNodes.near_wall = SURVIVAL_ARENA.cover.map(
    (cover) => [cover.approach.x, cover.approach.z],
  );
  world.spawnNodes.submerged_interior = SURVIVAL_ARENA.spawnLanes
    .filter((lane) => lane.index % 2 === 0)
    .map((lane) => [lane.spawn.x * 0.82, lane.spawn.z * 0.82]);
  world.spawnNodes.elevated_rubble = [];
}

export const survival = {
  id: 'survival',
  name: 'Endless Memory',
  label: 'Endless Memory — Survival',
  controller: 'survival',
  spawnGuardian: false,
  seed: 20260730,
  playerStart: SURVIVAL_ARENA.playerStart,
  guardianStart: Object.freeze({ x: 0, z: -13.5 }),
  survivalArena: SURVIVAL_ARENA,
  background: 0x02080d,
  fog: { color: 0x061a22, density: 0.022 },
  waterColor: 0x246b69,
  palette: {
    seabed: 0x102925,
    building: 0x172d2c,
    buildingAlt: 0x223d3b,
    concrete: 0x435b5b,
    rubble: 0x344943,
    cloth: 0x8f3f42,
    sign: 0xd6a23e,
    ware: 0x91b893,
    metal: 0x5b4936,
    rust: 0x664139,
  },
  build(world) {
    const tierMaterials = {
      altar: additiveMaterial(BOSS_TIER_THEMES[0].accent, 0.48),
      boundary: additiveMaterial(BOSS_TIER_THEMES[0].secondary, 0.36),
      lanes: [],
      guides: [],
      markers: [],
    };
    buildBoundaryGallery(world, tierMaterials);
    buildSpawnLanes(world, tierMaterials);
    buildSparseEdgeCover(world, tierMaterials);
    buildMemoryAltar(world, tierMaterials);
    publishEncounterData(world);
    installTierPresentation(world, tierMaterials);
  },
};
