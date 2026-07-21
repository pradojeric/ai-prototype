// ============================================================
// ARENA 3 — PANANISIA TOWER ASCENSION.
// A Bolinao Lighthouse-inspired hollow ruin with twelve smooth walkable ramp
// flights wrapped around an open central shaft. Phase 5B adds the controller-
// driven rising tide and retry pressure; the three gate landings remain open,
// with no Guardian, enemies, riddles, Lumina, rewards, or victory logic.
// ============================================================
import * as THREE from 'three';
import { CONFIG } from '../../config.js';

const ROUTE_RADIUS = 8.5;
const TOWER_RADIUS = 13.5;
const TOWER_HEIGHT = 22;
const RAMP_WIDTH = 3.2;
const RAMP_THICKNESS = 0.28;
const FLIGHT_RISE = 1.5;
const FLIGHT_COUNT = 12;
const TREADS_PER_FLIGHT = 10;
const POSTS_PER_SIDE = 5;
const LANDING_HALF = 2.15;
const GATE_LANDING_HALF = 3.0;
const RAIL_HEIGHT = 0.8;
const RAIL_WIDTH = 0.14;
const FLIGHT_LENGTH = ROUTE_RADIUS * 2;
const RAIL_END_CLEARANCE = LANDING_HALF;
const RAIL_LENGTH = FLIGHT_LENGTH - RAIL_END_CLEARANCE * 2;
const SUMMIT_RADIUS = 4.8;
const SUMMIT_WIDTH = 2.6;
const SUMMIT_BRIDGE_WIDTH = RAMP_WIDTH;
const SUMMIT_CORNER_CLEARANCE = SUMMIT_WIDTH / 2;
const BRIDGE_START_CLEARANCE = GATE_LANDING_HALF;
const BRIDGE_END_CLEARANCE = SUMMIT_CORNER_CLEARANCE;

const ROUTE_POINTS = [
  { x: ROUTE_RADIUS, z: ROUTE_RADIUS },
  { x: ROUTE_RADIUS, z: -ROUTE_RADIUS },
  { x: -ROUTE_RADIUS, z: -ROUTE_RADIUS },
  { x: -ROUTE_RADIUS, z: ROUTE_RADIUS },
];

const SUMMIT_POINTS = [
  { x: SUMMIT_RADIUS, z: SUMMIT_RADIUS },
  { x: SUMMIT_RADIUS, z: -SUMMIT_RADIUS },
  { x: -SUMMIT_RADIUS, z: -SUMMIT_RADIUS },
  { x: -SUMMIT_RADIUS, z: SUMMIT_RADIUS },
];

function setInstance(mesh, index, position, quaternion, scale, dummy) {
  dummy.position.copy(position);
  dummy.quaternion.copy(quaternion);
  dummy.scale.copy(scale);
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
}

function buildTowerShell(world) {
  const segments = 28;
  const segmentWidth = 2 * TOWER_RADIUS * Math.sin(Math.PI / segments) * 1.08;
  const wallDepth = 0.75;
  const wallGeometry = new THREE.BoxGeometry(segmentWidth, TOWER_HEIGHT, wallDepth);
  const walls = new THREE.InstancedMesh(wallGeometry, world.mat.building, segments);
  const dummy = new THREE.Object3D();
  const quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3(1, 1, 1);

  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const rotation = Math.PI / 2 - angle;
    position.set(
      Math.cos(angle) * TOWER_RADIUS,
      TOWER_HEIGHT / 2,
      Math.sin(angle) * TOWER_RADIUS,
    );
    quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotation);
    setInstance(walls, i, position, quaternion, scale, dummy);

    world.addCollider(
      position.x, position.z, segmentWidth / 2, wallDepth / 2,
      { rotation },
    );
  }
  walls.instanceMatrix.needsUpdate = true;
  world.scene.add(walls);

  // Deep-set blue window slits break up the masonry and reveal the lighthouse
  // scale without adding real lights or runtime animation.
  const windowLevels = [3.2, 7.7, 12.2, 16.7];
  const windowsPerLevel = 7;
  const windowMat = new THREE.MeshBasicMaterial({
    color: 0x517d8d,
    transparent: true,
    opacity: 0.34,
    side: THREE.DoubleSide,
  });
  const windowGeometry = new THREE.PlaneGeometry(1.0, 2.25);
  const windows = new THREE.InstancedMesh(
    windowGeometry,
    windowMat,
    windowLevels.length * windowsPerLevel,
  );
  let windowIndex = 0;
  for (let level = 0; level < windowLevels.length; level++) {
    for (let i = 0; i < windowsPerLevel; i++) {
      const angle = ((i + level * 0.5) / windowsPerLevel) * Math.PI * 2;
      position.set(
        Math.cos(angle) * (TOWER_RADIUS - 0.4),
        windowLevels[level],
        Math.sin(angle) * (TOWER_RADIUS - 0.4),
      );
      quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -angle - Math.PI / 2);
      setInstance(windows, windowIndex++, position, quaternion, scale, dummy);
    }
  }
  windows.instanceMatrix.needsUpdate = true;
  world.scene.add(windows);

  // Repeated inner buttresses give the shell structure and strong height cues.
  const braceGeometry = new THREE.BoxGeometry(0.5, 2.8, 0.8);
  const braces = new THREE.InstancedMesh(braceGeometry, world.mat.buildingAlt, segments);
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    position.set(
      Math.cos(angle) * (TOWER_RADIUS - 0.85),
      1.4 + (i % 6) * 3.25,
      Math.sin(angle) * (TOWER_RADIUS - 0.85),
    );
    quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -angle);
    setInstance(braces, i, position, quaternion, scale, dummy);
  }
  braces.instanceMatrix.needsUpdate = true;
  world.scene.add(braces);
}

function createRampResources(world) {
  return {
    rampGeometry: new THREE.BoxGeometry(RAMP_WIDTH, RAMP_THICKNESS, FLIGHT_LENGTH),
    railGeometry: new THREE.BoxGeometry(RAIL_WIDTH, RAIL_HEIGHT, RAIL_LENGTH),
    treadGeometry: new THREE.BoxGeometry(RAMP_WIDTH - 0.2, 0.07, 0.16),
    postGeometry: new THREE.BoxGeometry(0.13, 1.0, 0.13),
    rampMaterial: world.mat.concrete,
    railMaterial: world.mat.metal,
  };
}

function addLanding(world, point, height, enlarged = false) {
  const half = enlarged ? GATE_LANDING_HALF : LANDING_HALF;
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(half * 2, RAMP_THICKNESS, half * 2),
    enlarged ? world.mat.buildingAlt : world.mat.concrete,
  );
  slab.position.set(point.x, height - RAMP_THICKNESS / 2, point.z);
  world.scene.add(slab);
  world.addSupportSurface(point.x, point.z, half, half, 0, height);
}

function addGateFrame(world, height, target = ROUTE_POINTS[1], options = {}) {
  const start = ROUTE_POINTS[0];
  const dx = target.x - start.x, dz = target.z - start.z;
  const length = Math.hypot(dx, dz);
  const directionX = dx / length, directionZ = dz / length;
  const rotation = Math.atan2(directionX, directionZ);
  const x = start.x + directionX * 2.2;
  const z = start.z + directionZ * 2.2;
  world.towerGateFrames ||= [];
  world.towerGateFrames.push({ x, z, height, rotation });
  const lateralX = Math.cos(rotation);
  const lateralZ = -Math.sin(rotation);
  const minY = height - 0.5;
  const maxY = height + 2.8;
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 2.8, 0.65),
      world.mat.buildingAlt,
    );
    pillar.position.set(
      x + lateralX * side * (RAMP_WIDTH / 2 - 0.12),
      height + 1.4,
      z + lateralZ * side * (RAMP_WIDTH / 2 - 0.12),
    );
    pillar.rotation.y = rotation;
    world.scene.add(pillar);
    if (options.solid !== false) {
      world.addCollider(
        pillar.position.x, pillar.position.z, 0.23, 0.34,
        { minY, maxY, rotation },
      );
    }
  }
  const lintel = new THREE.Mesh(
    new THREE.BoxGeometry(RAMP_WIDTH + 0.45, 0.48, 0.72),
    world.mat.buildingAlt,
  );
  lintel.position.set(x, height + 2.72, z);
  lintel.rotation.y = rotation;
  world.scene.add(lintel);
}

function buildSpiralRoute(world, resources) {
  world.towerThreatAnchors = [];
  const flightLength = FLIGHT_LENGTH;
  const rails = new THREE.InstancedMesh(
    resources.railGeometry,
    resources.railMaterial,
    FLIGHT_COUNT * 2,
  );
  const treads = new THREE.InstancedMesh(
    resources.treadGeometry,
    resources.railMaterial,
    FLIGHT_COUNT * TREADS_PER_FLIGHT,
  );
  const posts = new THREE.InstancedMesh(
    resources.postGeometry,
    resources.railMaterial,
    FLIGHT_COUNT * POSTS_PER_SIDE * 2,
  );
  const dummy = new THREE.Object3D();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);
  const qY = new THREE.Quaternion();
  const qSlope = new THREE.Quaternion();
  const qRamp = new THREE.Quaternion();
  let railIndex = 0, treadIndex = 0, postIndex = 0;

  addLanding(world, ROUTE_POINTS[0], 0, false);

  for (let flight = 0; flight < FLIGHT_COUNT; flight++) {
    const start = ROUTE_POINTS[flight % ROUTE_POINTS.length];
    const end = ROUTE_POINTS[(flight + 1) % ROUTE_POINTS.length];
    const startHeight = flight * FLIGHT_RISE;
    const endHeight = (flight + 1) * FLIGHT_RISE;
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const rotation = Math.atan2(dx, dz);
    const slope = Math.atan2(FLIGHT_RISE, flightLength);
    const cx = (start.x + end.x) / 2;
    const cz = (start.z + end.z) / 2;
    const cy = (startHeight + endHeight) / 2;
    world.towerThreatAnchors.push({
      x: cx,
      z: cz,
      y: cy,
      flight,
      rotation,
      halfW: RAMP_WIDTH / 2,
      halfD: flightLength / 2,
      startHeight,
      endHeight,
    });
    const startsAtGate = flight > 0 && flight % 4 === 0;
    const gateLanding = (flight + 1) % 4 === 0;
    const startClearance = startsAtGate ? GATE_LANDING_HALF : LANDING_HALF;
    const endClearance = gateLanding ? GATE_LANDING_HALF : LANDING_HALF;
    const flightRailLength = flightLength - startClearance - endClearance;
    const railCenterOffset = (startClearance - endClearance) / 2;
    const railProgress = 0.5 + railCenterOffset / flightLength;

    const rampGroup = new THREE.Group();
    rampGroup.position.set(cx, cy - RAMP_THICKNESS / 2, cz);
    rampGroup.rotation.y = rotation;
    const ramp = new THREE.Mesh(resources.rampGeometry, resources.rampMaterial);
    ramp.rotation.x = -slope;
    rampGroup.add(ramp);
    world.scene.add(rampGroup);
    world.addSupportSurface(
      cx, cz, RAMP_WIDTH / 2, flightLength / 2, rotation, startHeight, endHeight,
    );

    qY.setFromAxisAngle(up, rotation);
    qSlope.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -slope);
    qRamp.copy(qY).multiply(qSlope);
    const lateralX = Math.cos(rotation);
    const lateralZ = -Math.sin(rotation);
    const forwardX = Math.sin(rotation);
    const forwardZ = Math.cos(rotation);
    for (const side of [-1, 1]) {
      position.set(
        cx + forwardX * railCenterOffset
          + lateralX * side * (RAMP_WIDTH / 2 - 0.08),
        startHeight + FLIGHT_RISE * railProgress + RAIL_HEIGHT / 2,
        cz + forwardZ * railCenterOffset
          + lateralZ * side * (RAMP_WIDTH / 2 - 0.08),
      );
      scale.set(1, 1, flightRailLength / RAIL_LENGTH);
      setInstance(rails, railIndex++, position, qRamp, scale, dummy);
      scale.set(1, 1, 1);
      world.addCollider(position.x, position.z, RAIL_WIDTH / 2, flightRailLength / 2, {
        minY: startHeight - 0.55,
        maxY: endHeight + 1.35,
        rotation,
      });

      for (let j = 0; j < POSTS_PER_SIDE; j++) {
        const railDistance = startClearance
          + ((j + 0.5) / POSTS_PER_SIDE) * flightRailLength;
        const progress = railDistance / flightLength;
        position.set(
          start.x + dx * progress + lateralX * side * (RAMP_WIDTH / 2 - 0.08),
          startHeight + FLIGHT_RISE * progress + 0.5,
          start.z + dz * progress + lateralZ * side * (RAMP_WIDTH / 2 - 0.08),
        );
        setInstance(posts, postIndex++, position, qY, scale, dummy);
      }
    }

    for (let j = 0; j < TREADS_PER_FLIGHT; j++) {
      const progress = (j + 0.5) / TREADS_PER_FLIGHT;
      position.set(
        start.x + dx * progress,
        startHeight + FLIGHT_RISE * progress + 0.045,
        start.z + dz * progress,
      );
      setInstance(treads, treadIndex++, position, qY, scale, dummy);
    }

    addLanding(world, end, endHeight, gateLanding);
    if (gateLanding) {
      const gateTarget = flight + 1 === FLIGHT_COUNT
        ? SUMMIT_POINTS[0]
        : ROUTE_POINTS[1];
      // The summit frame only marks a future riddle gate in Phase 5B; its
      // opening must not inherit blocking proxies before that system exists.
      addGateFrame(world, endHeight, gateTarget, {
        solid: flight + 1 !== FLIGHT_COUNT,
      });
    }
  }

  rails.instanceMatrix.needsUpdate = true;
  treads.instanceMatrix.needsUpdate = true;
  posts.instanceMatrix.needsUpdate = true;
  world.scene.add(rails, treads, posts);
}

function addSummitSegment(world, start, end, height, geometry, width = SUMMIT_WIDTH) {
  const dx = end.x - start.x, dz = end.z - start.z;
  const length = Math.hypot(dx, dz);
  const rotation = Math.atan2(dx, dz);
  const cx = (start.x + end.x) / 2, cz = (start.z + end.z) / 2;
  const slab = new THREE.Mesh(geometry, world.mat.buildingAlt);
  slab.position.set(cx, height - RAMP_THICKNESS / 2, cz);
  slab.rotation.y = rotation;
  world.scene.add(slab);
  world.addSupportSurface(
    cx, cz, width / 2, length / 2, rotation, height,
  );
  return { cx, cz, length, rotation };
}

function buildSummit(world, resources) {
  const height = FLIGHT_COUNT * FLIGHT_RISE;
  const ringLength = SUMMIT_RADIUS * 2;
  const ringRailLength = ringLength - SUMMIT_CORNER_CLEARANCE * 2;
  const ringSlabGeometry = new THREE.BoxGeometry(
    SUMMIT_WIDTH, RAMP_THICKNESS, ringLength,
  );
  const ringRailGeometry = new THREE.BoxGeometry(
    RAIL_WIDTH, RAIL_HEIGHT, ringRailLength,
  );
  const ringRails = new THREE.InstancedMesh(
    ringRailGeometry, resources.railMaterial, SUMMIT_POINTS.length * 2,
  );
  const dummy = new THREE.Object3D();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);
  let railIndex = 0;

  for (let side = 0; side < SUMMIT_POINTS.length; side++) {
    const start = SUMMIT_POINTS[side];
    const end = SUMMIT_POINTS[(side + 1) % SUMMIT_POINTS.length];
    const segment = addSummitSegment(world, start, end, height, ringSlabGeometry);
    quaternion.setFromAxisAngle(up, segment.rotation);
    const lateralX = Math.cos(segment.rotation);
    const lateralZ = -Math.sin(segment.rotation);
    for (const edge of [-1, 1]) {
      position.set(
        segment.cx + lateralX * edge * (SUMMIT_WIDTH / 2 - 0.08),
        height + RAIL_HEIGHT / 2,
        segment.cz + lateralZ * edge * (SUMMIT_WIDTH / 2 - 0.08),
      );
      setInstance(ringRails, railIndex++, position, quaternion, scale, dummy);
      world.addCollider(position.x, position.z, RAIL_WIDTH / 2, ringRailLength / 2, {
        minY: height - 0.55,
        maxY: height + 1.35,
        rotation: segment.rotation,
      });
    }
  }
  ringRails.instanceMatrix.needsUpdate = true;
  world.scene.add(ringRails);

  const bridgeStart = ROUTE_POINTS[0];
  const bridgeEnd = SUMMIT_POINTS[0];
  const bridgeDx = bridgeEnd.x - bridgeStart.x;
  const bridgeDz = bridgeEnd.z - bridgeStart.z;
  const bridgeLength = Math.hypot(bridgeDx, bridgeDz);
  const bridgeSlabGeometry = new THREE.BoxGeometry(
    SUMMIT_BRIDGE_WIDTH, RAMP_THICKNESS, bridgeLength,
  );
  const bridge = addSummitSegment(
    world, bridgeStart, bridgeEnd, height, bridgeSlabGeometry, SUMMIT_BRIDGE_WIDTH,
  );
  // The bridge doubles back diagonally from flight 12. Keeping its rails out of
  // the enlarged landing prevents the outer rail from crossing the incoming ramp.
  const bridgeRailLength = bridgeLength
    - BRIDGE_START_CLEARANCE - BRIDGE_END_CLEARANCE;
  const bridgeRailCenterOffset = (BRIDGE_START_CLEARANCE - BRIDGE_END_CLEARANCE) / 2;
  const bridgeRailGeometry = new THREE.BoxGeometry(
    RAIL_WIDTH, RAIL_HEIGHT, bridgeRailLength,
  );
  const bridgeRails = new THREE.InstancedMesh(
    bridgeRailGeometry, resources.railMaterial, 2,
  );
  quaternion.setFromAxisAngle(up, bridge.rotation);
  const lateralX = Math.cos(bridge.rotation);
  const lateralZ = -Math.sin(bridge.rotation);
  const forwardX = Math.sin(bridge.rotation);
  const forwardZ = Math.cos(bridge.rotation);
  for (let edge = 0; edge < 2; edge++) {
    const direction = edge === 0 ? -1 : 1;
    position.set(
      bridge.cx + forwardX * bridgeRailCenterOffset
        + lateralX * direction * (SUMMIT_BRIDGE_WIDTH / 2 - 0.08),
      height + RAIL_HEIGHT / 2,
      bridge.cz + forwardZ * bridgeRailCenterOffset
        + lateralZ * direction * (SUMMIT_BRIDGE_WIDTH / 2 - 0.08),
    );
    setInstance(bridgeRails, edge, position, quaternion, scale, dummy);
    world.addCollider(position.x, position.z, RAIL_WIDTH / 2, bridgeRailLength / 2, {
      minY: height - 0.55,
      maxY: height + 1.35,
      rotation: bridge.rotation,
    });
  }
  bridgeRails.instanceMatrix.needsUpdate = true;
  world.scene.add(bridgeRails);
}

function setSpawnNodes(world) {
  world.spawnNodes.open_water = [[ROUTE_RADIUS, ROUTE_RADIUS]];
  world.spawnNodes.near_wall = [];
  world.spawnNodes.submerged_interior = [];
  world.spawnNodes.elevated_rubble = [];
}

export const arena3 = {
  id: 'arena3',
  name: 'Memory Tower — Pananisia',
  label: 'Memory Tower',
  seed: 20260723,
  controller: 'tower',
  spawnGuardian: false,
  playerStart: {
    x: ROUTE_POINTS[0].x,
    y: CONFIG.EYE_HEIGHT,
    z: ROUTE_POINTS[0].z,
  },
  background: 0x030811,
  fog: { color: 0x091522, density: 0.018 },
  palette: {
    building: 0x33414d,
    buildingAlt: 0x465461,
    concrete: 0x52616c,
    metal: 0x48605f,
    seabed: 0x0a141c,
  },
  build(world) {
    world.waterMat.uniforms.uColor.value.set(0x1a3342);
    const resources = createRampResources(world);
    buildTowerShell(world);
    buildSpiralRoute(world, resources);
    buildSummit(world, resources);
    setSpawnNodes(world);
  },
};
