// ============================================================
// ZONE 3 GUARDIAN — "THE KEEPER OF MEMORIES" (reference/boss3.jpg)
// A weathered-stone Pangasinan spirit built from architecture: box "facade" and
// nipa-hut limbs with cone spires/roofs, a torso studded with books (flat boxes)
// and pottery, a gold "Heart of Memory" spiral core, a stone mask with glowing
// memory-galaxy eyes, a flowing light cape, and spectral memory figures orbiting
// on golden threads. Primitives only; deliberately UNLIKE the golem / coral-
// whisperer so each per-zone guardian reads distinct.
//
// Returns the shared builder contract the Guardian shell drives:
//   build(figure) -> { fadeMats, chestY, glowColor, animate(dt,t,f,playerPos,groupPos) }
// ============================================================
import * as THREE from 'three';
import { CONFIG } from '../../config.js';
import { fadeMat, buildPot, spiralCore, angDelta } from './primitives.js';

// A stacked "building" segment: a stone box with a glowing seam and an optional
// cone roof/spire — the raw unit of the keeper's architecture-as-limb body.
function buildStructureBlock(matStone, matGlow, w, h, d, roof = 0) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matStone);
  g.add(body);
  const seam = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.7, 0.06), matGlow);
  seam.position.set(0, 0, d / 2 + 0.01);
  g.add(seam);
  if (roof > 0) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(w * 0.62, roof, roof > 0.9 ? 4 : 8), matStone);
    cone.position.y = h / 2 + roof / 2;
    g.add(cone);
  }
  return g;
}

export function buildZone3Guardian(figure) {
  const glow = 0xffcf87;                    // warm gold halo/beacon mood tint
  const matStone = fadeMat(0x8a8172, 0x5a4a2a, 0.35, 0.92, 0.85, 0.05);
  const matStoneDark = fadeMat(0x625b4e, 0x4a3c20, 0.3, 0.92, 0.9, 0.05);
  const matGlow = fadeMat(0xffcf87, 0xffcf87, 2.2, 0.96, 0.3, 0.1);   // gold light
  matGlow.side = THREE.DoubleSide;                                    // cape/seam planes visible both faces
  const matSpectral = fadeMat(0xbfe0ff, 0x8fc8ff, 1.2, 0.4, 0.4, 0.1); // ghost figures
  const matThread = new THREE.LineBasicMaterial({
    color: 0xffcf87, transparent: true, opacity: 0.5,
  });
  const fadeMats = [
    [matStone, 0.92], [matStoneDark, 0.92], [matGlow, 0.96],
    [matSpectral, 0.4], [matThread, 0.5],
  ];
  const sphereGeo = new THREE.SphereGeometry(0.16, 10, 8);   // pottery morsels

  const spectrals = [];
  let leftEye, rightEye;

  // --- Legs: stacked stone/nipa-hut blocks with cone roofs (architecture limbs) ---
  for (const side of [-1, 1]) {
    const foot = buildStructureBlock(matStoneDark, matGlow, 1.3, 0.9, 1.4);
    foot.position.set(side * 0.7, 0.55, 0);
    figure.add(foot);
    const shin = buildStructureBlock(matStone, matGlow, 1.0, 1.3, 1.1, 0.6);
    shin.position.set(side * 0.7, 1.75, 0);
    figure.add(shin);
  }

  // --- Hips + architectural torso mass ---
  const hips = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.7, 1.2), matStoneDark);
  hips.position.y = 2.7;
  figure.add(hips);
  const torso = buildStructureBlock(matStone, matGlow, 1.9, 1.9, 1.3);
  torso.position.y = 3.8;
  figure.add(torso);
  // Church-facade towers rising off the shoulders.
  for (const side of [-1, 1]) {
    const tower = buildStructureBlock(matStone, matGlow, 0.6, 1.2, 0.6, 1.0);
    tower.position.set(side * 0.7, 4.9, -0.2);
    figure.add(tower);
  }
  // Books (flat boxes) and pottery clustered on the trunk.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const book = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.36), matStoneDark);
    book.position.set(Math.cos(a) * 1.0, 3.2 + (i % 3) * 0.5, Math.sin(a) * 0.75 + 0.2);
    book.rotation.set((Math.random() - 0.5) * 0.5, a, (Math.random() - 0.5) * 0.5);
    figure.add(book);
  }
  for (const side of [-1, 1]) {
    const pot = buildPot(matStoneDark, matGlow, sphereGeo);
    pot.scale.setScalar(0.7);
    pot.position.set(side * 1.05, 3.15, 0.55);
    figure.add(pot);
  }

  // --- Chest: gold "Heart of Memory" spiral core ---
  const core = spiralCore(matGlow, { radius: 0.65, arms: 2, motesPerArm: 8, turns: 1.7 });
  const CORE_Y = 3.8;
  core.group.position.set(0, CORE_Y, 0.72);
  figure.add(core.group);

  // --- Arms: stacked architecture blocks with cone spires, blocky hands ---
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 1.25, 4.35, 0);
    arm.rotation.z = side * 0.4;
    const upper = buildStructureBlock(matStone, matGlow, 0.7, 1.4, 0.7);
    upper.position.y = -0.7;
    arm.add(upper);
    const lower = buildStructureBlock(matStone, matGlow, 0.6, 1.4, 0.6, 0.9);
    lower.position.y = -2.0;
    arm.add(lower);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.55, 0.75), matStoneDark);
    hand.position.y = -2.9;
    arm.add(hand);
    figure.add(arm);
  }

  // --- Head: weathered stone mask with glowing memory-galaxy eyes ---
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.4, 8), matStoneDark);
  neck.position.y = 4.75;
  figure.add(neck);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.1, 0.85), matStone);
  head.position.y = 5.45;
  figure.add(head);
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.7, 4), matStone);
  crown.position.y = 6.2;
  figure.add(crown);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.55), matStoneDark);
  jaw.position.set(0, 5.0, 0.2);
  figure.add(jaw);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), matGlow);
    eye.position.set(side * 0.24, 5.55, 0.45);
    figure.add(eye);
    if (side === -1) leftEye = eye; else rightEye = eye;
  }

  // --- Flowing light cape behind the shoulders ---
  const cape = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.4, 1, 1), matGlow);
  cape.position.set(0, 3.6, -0.9);
  cape.rotation.x = 0.15;
  figure.add(cape);

  // --- Spectral memory figures orbiting on golden threads ---
  for (let i = 0; i < 5; i++) {
    const fig = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 8), matSpectral);
    body.position.y = 0.3;
    fig.add(body);
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), matSpectral);
    h.position.y = 0.72;
    fig.add(h);
    figure.add(fig);

    // Gold thread from the heart-core to this figure (endpoint updated per frame).
    const pos = new Float32Array([0, CORE_Y, 0.72, 0, 0, 0]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const line = new THREE.Line(geo, matThread);
    line.frustumCulled = false;
    figure.add(line);

    spectrals.push({
      fig, pos, geo,
      r: 3.4 + Math.random() * 1.4,
      y: 2.4 + Math.random() * 3.2,
      ang: (i / 5) * Math.PI * 2,
      speed: 0.25 + Math.random() * 0.3,
    });
  }

  return {
    fadeMats,
    chestY: 3.8,
    glowColor: glow,
    animate(dt, t, f, playerPos, groupPos) {
      // Bob, face the player, pulse core, flow cape, twinkle eyes, orbit spectrals + redraw threads.
      figure.position.y = CONFIG.WATER_LEVEL + Math.sin(t * 0.8) * 0.12;
      const yaw = Math.atan2(playerPos.x - groupPos.x, playerPos.z - groupPos.z);
      figure.rotation.y += angDelta(figure.rotation.y, yaw) * Math.min(1, dt * 1.8);

      core.swirl.rotation.z += dt * 0.6;
      matGlow.emissiveIntensity = (2.0 + Math.sin(t * 1.9) * 0.5) * f;
      cape.rotation.z = Math.sin(t * 0.9) * 0.08;
      cape.rotation.x = 0.15 + Math.sin(t * 1.1) * 0.05;

      const eyePulse = 0.8 + 0.4 * Math.sin(t * 2.4);
      if (leftEye) leftEye.scale.setScalar(eyePulse);
      if (rightEye) rightEye.scale.setScalar(0.8 + 0.4 * Math.sin(t * 2.4 + 1.0));

      for (const s of spectrals) {
        s.ang += dt * s.speed;
        const x = Math.cos(s.ang) * s.r;
        const y = s.y + Math.sin(t * 0.9 + s.ang) * 0.3;
        const z = Math.sin(s.ang) * s.r;
        s.fig.position.set(x, y, z);
        s.fig.rotation.y = -s.ang;
        s.pos[3] = x; s.pos[4] = y; s.pos[5] = z;   // move the thread's far endpoint
        s.geo.attributes.position.needsUpdate = true;
      }
    },
  };
}
