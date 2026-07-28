// ============================================================
// ZONE 3 GUARDIAN — "THE KEEPER OF MEMORIES" (reference/boss3.jpg)
// A weathered-stone Pangasinan spirit built from architecture: box "facade" and
// nipa-hut limbs with cone spires/roofs, a torso studded with books (flat boxes)
// and pottery, a gold "Heart of Memory" spiral core, a stone mask with glowing
// memory-galaxy eyes and a crystal crest, a body cracking apart along glowing
// gold seams with detached fragments drifting around it, golden thread arcs
// circling the figure, a flowing translucent light cape, and spectral memory
// figures orbiting on golden threads. Primitives only; deliberately UNLIKE the
// Feastkeeper / Reveler so each per-zone guardian reads distinct.
//
// Returns the shared builder contract the Guardian shell drives:
//   build(figure) -> { fadeMats, chestY, glowColor, animate(dt,t,f,playerPos,groupPos) }
// ============================================================
import * as THREE from 'three';
import { CONFIG } from '../../config.js';
import { fadeMat, pulseEmissive, buildPot, spiralCore, angDelta } from './primitives.js';
import { skin } from './_partials/GuardianTextureKit.js';

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
  // Reference palette: mossy gray-green weathered stone split by warm gold
  // light seams, an icy crystal crest, spectral blue memory projections.
  const glow = 0xffcf87;                    // warm gold halo/beacon mood tint
  const matStone = fadeMat(0x7a8272, 0x5a4a2a, 0.3, 0.92, 0.85, 0.05);      // mossy stone
  const matStoneDark = fadeMat(0x565e50, 0x4a3c20, 0.25, 0.92, 0.9, 0.05);
  const matGlow = fadeMat(0xffcf87, 0xffcf87, 0, 0.96, 0.3, 0.1);           // gold heart / body seams
  matGlow.side = THREE.DoubleSide;                                          // seam planes visible both faces
  const matCape = fadeMat(0xffe0b0, 0xffcf87, 1.2, 0.3, 0.4, 0.05);         // translucent light cape
  matCape.side = THREE.DoubleSide;
  const matCrystal = fadeMat(0xcfe8ff, 0x9fd8ff, 0, 0.75, 0.3, 0.2);        // icy crest
  const matSpectral = fadeMat(0xbfe0ff, 0x8fc8ff, 1.2, 0.4, 0.4, 0.1);      // ghost figures
  const matThread = new THREE.LineBasicMaterial({
    color: 0xffcf87, transparent: true, opacity: 0.5,
  });
  const matArc = fadeMat(0xffcf87, 0xffcf87, 1.4, 0.35, 0.4, 0.1);          // orbit thread arcs
  // The torso pottery previously shared the dark stone material; split out so it can
  // read as fired clay rather than as more masonry. Fades with the stone (0.92).
  const matPot = fadeMat(0x8a6047, 0x4a3c20, 0.2, 0.92, 0.85, 0.05);        // fired clay
  const fadeMats = [
    [matStone, 0.92], [matStoneDark, 0.92], [matGlow, 0.96], [matCape, 0.3],
    [matCrystal, 0.75], [matSpectral, 0.4], [matThread, 0.5], [matArc, 0.35],
    [matPot, 0.92],
  ];

  // --- CC0 surface detail (see `_partials/GuardianTextureKit.js`) -----------
  // This guardian is architecture, so it takes the same rock the zones' ruins use —
  // the visual rhyme is the point. The dark stone takes moss relief WITHOUT its
  // albedo: Moss002's green would read as overgrowth, but the Keeper is weathered
  // masonry that has been under water, not a garden. Crystal crest, gold seams, cape,
  // thread arcs and spectral figures stay flat by design.
  skin(matStone, 'rock', { repeat: 2 });
  skin(matStoneDark, 'moss', { repeat: 2, albedo: false });
  skin(matPot, 'clay', { repeat: 1 });

  const sphereGeo = new THREE.SphereGeometry(0.16, 10, 8);   // pottery morsels

  const spectrals = [];
  const fragments = [];
  const arcs = [];
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

  // --- Hips + architectural torso mass, cracked open along gold seams ---
  const hips = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 1.1), matStoneDark);
  hips.position.y = 2.7;
  figure.add(hips);
  // gold light spilling from the hip/torso gap
  const hipSeam = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.14), matGlow);
  hipSeam.position.set(0, 3.08, 0.62);
  figure.add(hipSeam);
  const torso = buildStructureBlock(matStone, matGlow, 1.9, 1.9, 1.3);
  torso.position.y = 3.8;
  figure.add(torso);
  // vertical gold cracks running up the trunk
  for (const [sx, sy, rot] of [[-0.7, 3.8, 0.3], [0.75, 3.6, -0.2], [0.3, 4.4, 0.5]]) {
    const crack = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 1.1), matGlow);
    crack.position.set(sx, sy, 0.68);
    crack.rotation.z = rot;
    figure.add(crack);
  }
  // Church-facade towers rising off the shoulders.
  for (const side of [-1, 1]) {
    const tower = buildStructureBlock(matStone, matGlow, 0.6, 1.2, 0.6, 1.0);
    tower.position.set(side * 0.7, 4.9, -0.2);
    figure.add(tower);
    // roof-tile ridge strips on the tower spires
    for (let i = 0; i < 2; i++) {
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.5 - i * 0.15, 0.05, 0.5 - i * 0.15), matStoneDark);
      ridge.position.set(side * 0.7, 5.75 + i * 0.3, -0.2);
      ridge.rotation.y = Math.PI / 4;
      figure.add(ridge);
    }
  }
  // Large architecture pauldrons capping each shoulder (widens the silhouette).
  for (const side of [-1, 1]) {
    const pauldron = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 1.1), matStone);
    pauldron.add(slab);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.65, 4), matStoneDark);
    roof.position.y = 0.55;
    roof.rotation.y = Math.PI / 4;
    pauldron.add(roof);
    const seam = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.06), matGlow);
    seam.position.set(0, 0, 0.56);
    pauldron.add(seam);
    pauldron.position.set(side * 1.45, 4.85, 0);
    pauldron.rotation.z = side * -0.12;
    figure.add(pauldron);
  }
  // Books (flat boxes) and pottery clustered on the trunk.
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const book = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.36), matStoneDark);
    book.position.set(Math.cos(a) * 1.0, 3.0 + (i % 4) * 0.42, Math.sin(a) * 0.75 + 0.2);
    book.rotation.set((Math.random() - 0.5) * 0.5, a, (Math.random() - 0.5) * 0.5);
    figure.add(book);
  }
  for (const side of [-1, 1]) {
    const pot = buildPot(matPot, matGlow, sphereGeo);
    pot.scale.setScalar(0.7);
    pot.position.set(side * 1.05, 3.15, 0.55);
    figure.add(pot);
  }

  // --- Chest: gold "Heart of Memory" spiral core ---
  const core = spiralCore(matGlow, { radius: 0.65, arms: 2, motesPerArm: 8, turns: 1.7 });
  const CORE_Y = 3.8;
  core.group.position.set(0, CORE_Y, 0.72);
  figure.add(core.group);

  // --- Arms: stacked architecture blocks growing into massive gauntlets ---
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 1.45, 4.35, 0);
    arm.rotation.z = side * 0.4;
    const upper = buildStructureBlock(matStone, matGlow, 0.7, 1.4, 0.7);
    upper.position.y = -0.7;
    arm.add(upper);
    const lower = buildStructureBlock(matStone, matGlow, 0.9, 1.5, 0.9, 0.9);
    lower.position.y = -2.1;
    arm.add(lower);
    // gold crack up the gauntlet face
    const armCrack = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.9), matGlow);
    armCrack.position.set(0.15, -2.1, 0.47);
    armCrack.rotation.z = -side * 0.25;
    arm.add(armCrack);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.65, 0.95), matStoneDark);
    hand.position.y = -3.1;
    arm.add(hand);
    // stubby stone fingers so the hand reads articulated like the reference
    for (let i = -1; i <= 1; i++) {
      const finger = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5, 0.26), matStone);
      finger.position.set(i * 0.3, -3.55, 0.2);
      finger.rotation.x = 0.3;
      arm.add(finger);
    }
    figure.add(arm);
    // gold cracks down the shin blocks
    const legCrack = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.9), matGlow);
    legCrack.position.set(side * 0.75, 1.7, 0.57);
    legCrack.rotation.z = side * 0.3;
    figure.add(legCrack);
  }

  // --- Head: weathered stone mask, glowing memory-galaxy eyes, crystal crest ---
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.4, 8), matStoneDark);
  neck.position.y = 4.75;
  figure.add(neck);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.0, 0.78), matStone);
  head.position.y = 5.45;
  figure.add(head);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.55), matStoneDark);
  jaw.position.set(0, 5.0, 0.2);
  figure.add(jaw);
  // gold crack down the mask + third-eye gem
  const maskCrack = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.8), matGlow);
  maskCrack.position.set(0.18, 5.45, 0.44);
  maskCrack.rotation.z = 0.15;
  figure.add(maskCrack);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), matCrystal);
  gem.position.set(0, 5.8, 0.46);
  figure.add(gem);
  // crystal crest: tall icy octahedron flanked by smaller shards + ear fins
  const crest = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), matCrystal);
  crest.scale.set(0.7, 1.8, 0.5);
  crest.position.y = 6.35;
  figure.add(crest);
  for (const side of [-1, 1]) {
    const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), matCrystal);
    shard.scale.set(0.6, 1.4, 0.5);
    shard.position.set(side * 0.32, 6.1, -0.05);
    shard.rotation.z = side * -0.35;
    figure.add(shard);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.6, 4), matStone);
    fin.position.set(side * 0.58, 5.6, -0.05);
    fin.rotation.z = side * -1.25;
    figure.add(fin);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), matGlow);
    eye.position.set(side * 0.24, 5.55, 0.45);
    figure.add(eye);
    if (side === -1) leftEye = eye; else rightEye = eye;
  }

  // --- Flowing translucent light cape behind the shoulders (layered planes) ---
  const cape = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.4, 1, 1), matCape);
  cape.position.set(0, 3.6, -0.9);
  cape.rotation.x = 0.15;
  figure.add(cape);
  // woven pattern bands across the cape
  for (let i = 0; i < 3; i++) {
    const band = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.12), matGlow);
    band.position.set(0, 2.6 + i * 0.9, -0.88);
    band.rotation.x = 0.15;
    figure.add(band);
  }

  // --- Detached stone fragments drifting around the body (the cracking-apart
  // look) — each slowly bobs and tumbles near its home position ---
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const frag = new THREE.Mesh(
      new THREE.BoxGeometry(0.2 + Math.random() * 0.25, 0.15 + Math.random() * 0.2, 0.15 + Math.random() * 0.2),
      i % 3 ? matStone : matStoneDark,
    );
    // gold seam edge on some fragments (freshly broken off the body)
    if (i % 2 === 0) {
      const seam = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.04), matGlow);
      seam.position.z = 0.12;
      frag.add(seam);
    }
    const home = new THREE.Vector3(
      Math.cos(a) * (1.7 + Math.random() * 0.9),
      2.6 + Math.random() * 3.0,
      Math.sin(a) * (1.3 + Math.random() * 0.9),
    );
    frag.position.copy(home);
    figure.add(frag);
    fragments.push({
      mesh: frag, home,
      phase: Math.random() * Math.PI * 2,
      spin: 0.3 + Math.random() * 0.5,
    });
  }

  // --- Golden thread arcs circling the whole figure (thin tilted tori) ---
  for (let i = 0; i < 5; i++) {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(2.4 + i * 0.45, 0.015, 4, 48), matArc);
    arc.position.y = 3.6;
    arc.rotation.x = Math.PI / 2 + (i - 2) * 0.24;
    arc.rotation.y = i * 0.8;
    figure.add(arc);
    arcs.push({ mesh: arc, speed: 0.1 + i * 0.06 });
  }

  // --- Spectral memory figures orbiting on golden threads ---
  for (let i = 0; i < 7; i++) {
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
      ang: (i / 7) * Math.PI * 2,
      speed: 0.25 + Math.random() * 0.3,
    });
  }

  return {
    fadeMats,
    chestY: 3.8,
    glowColor: glow,
    animate(dt, t, f, playerPos, groupPos) {
      // Bob, face the player, flow cape, twinkle eyes, drift fragments,
      // turn thread arcs, orbit spectrals + redraw threads.
      figure.position.y = CONFIG.WATER_LEVEL + Math.sin(t * 0.8) * 0.12;
      const yaw = Math.atan2(playerPos.x - groupPos.x, playerPos.z - groupPos.z);
      figure.rotation.y += angDelta(figure.rotation.y, yaw) * Math.min(1, dt * 1.8);

      pulseEmissive(matGlow, t, 0.36, 0.14, 1.1, 0.5, f);
      pulseEmissive(matCrystal, t, 0.14, 0.08, 1.3, 1.4, f);

      core.swirl.rotation.z += dt * 0.6;
      cape.rotation.z = Math.sin(t * 0.9) * 0.08;
      cape.rotation.x = 0.15 + Math.sin(t * 1.1) * 0.05;

      const eyePulse = 0.8 + 0.4 * Math.sin(t * 2.4);
      if (leftEye) leftEye.scale.setScalar(eyePulse);
      if (rightEye) rightEye.scale.setScalar(0.8 + 0.4 * Math.sin(t * 2.4 + 1.0));

      for (const fr of fragments) {
        fr.mesh.position.y = fr.home.y + Math.sin(t * 0.7 + fr.phase) * 0.2;
        fr.mesh.rotation.x += dt * fr.spin * 0.5;
        fr.mesh.rotation.y += dt * fr.spin;
      }
      for (const a of arcs) a.mesh.rotation.z += dt * a.speed;

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
