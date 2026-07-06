// ============================================================
// ZONE 2 GUARDIAN — "THE CORAL-WHISPERER" (reference/boss2.jpg)
// An ocean-blue coral titan: a tentacled sphere-mask head, violet procedural-
// plane fins, stacked-cylinder arms (coral-fan hand + stacked-cone staff), a
// warm glowing spiral core in the chest, cylinder-coil legs on torus/box base
// platforms, and coral relics orbiting the body. Built from Three.js primitives
// only, deliberately UNLIKE the Zone-1 golem so each guardian reads distinct.
//
// Returns the shared builder contract the Guardian shell drives:
//   build(figure) -> { fadeMats, chestY, glowColor, animate(dt,t,f,playerPos,groupPos) }
// ============================================================
import * as THREE from 'three';
import { CONFIG } from '../../config.js';
import { fadeMat, stackedLimb, spiralCore, angDelta } from './primitives.js';

// A wavy tentacle: a chain of nested joints (each holds a tapered bead), so
// rotating the joints propagates a travelling curl. Returns joints for animation.
function buildTentacle(mat, beadGeo, len, segCount) {
  const root = new THREE.Group();
  const joints = [];
  const segH = len / segCount;
  let parent = root;
  for (let i = 0; i < segCount; i++) {
    const joint = new THREE.Group();
    joint.position.y = i === 0 ? 0 : segH;   // stack upward from the base
    parent.add(joint);
    const r = THREE.MathUtils.lerp(0.13, 0.03, i / (segCount - 1));
    const bead = new THREE.Mesh(beadGeo, mat);
    bead.scale.set(r, segH * 0.62, r);
    bead.position.y = segH * 0.5;
    joint.add(bead);
    joints.push(joint);
    parent = joint;
  }
  return { root, joints };
}

export function buildZone2Guardian(figure) {
  const glow = 0x66e0ff;                    // cyan-teal halo/beacon mood tint
  const matBody = fadeMat(0x1e3a5f, 0x4fc8ff, 0.5, 0.9, 0.55, 0.2);
  const matCoral = fadeMat(0x5a3f7a, 0xc89bff, 0.7, 0.9, 0.5, 0.15);
  const matFin = fadeMat(0x7a4f9a, 0xd68fff, 0.9, 0.5, 0.6, 0.1);   // translucent fin
  matFin.side = THREE.DoubleSide;                                    // fins visible from both faces
  const matGlow = fadeMat(0xffb066, 0xffb066, 2.2, 0.96, 0.3, 0.1); // warm core
  const fadeMats = [
    [matBody, 0.9], [matCoral, 0.9], [matFin, 0.5], [matGlow, 0.96],
  ];
  const beadGeo = new THREE.SphereGeometry(1, 8, 6);      // unit bead (scaled per use)
  const relicGeo = new THREE.SphereGeometry(0.14, 10, 8);

  const tentacles = [];
  const fins = [];
  const orbits = [];

  // --- Base: box platform slabs + torus "root" rings under each foot ---
  for (const side of [-1, 1]) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 1.7), matBody);
    slab.position.set(side * 0.75, 0.2, 0);
    figure.add(slab);
    const root = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.14, 8, 16), matCoral);
    root.rotation.x = Math.PI / 2;
    root.position.set(side * 0.75, 0.5, 0);
    figure.add(root);
  }

  // --- Legs: stacked cylinders wrapped with coil rings ---
  for (const side of [-1, 1]) {
    const leg = stackedLimb(matBody, 2.0, 0.34, 0.42, 3);
    leg.position.set(side * 0.75, 2.5, 0);
    figure.add(leg);
    for (let i = 0; i < 3; i++) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 6, 14), matCoral);
      coil.rotation.x = Math.PI / 2;
      coil.position.set(side * 0.75, 0.9 + i * 0.55, 0);
      figure.add(coil);
    }
  }

  // --- Hips + coral-latticed torso ---
  const hips = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.6, 1.0), matBody);
  hips.position.y = 2.6;
  figure.add(hips);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 1.9, 8), matBody);
  torso.position.y = 3.6;
  figure.add(torso);
  // Coral studs climbing the trunk.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const stud = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), matCoral);
    stud.position.set(Math.cos(a) * 1.05, 3.0 + (i % 4) * 0.4, Math.sin(a) * 1.05);
    figure.add(stud);
  }

  // --- Chest: warm glowing spiral core (the focal bloom) ---
  const core = spiralCore(matGlow, { radius: 0.7, arms: 2, motesPerArm: 8, turns: 1.6 });
  core.group.position.set(0, 3.5, 1.05);
  figure.add(core.group);

  // --- Fins: large violet planes flaring behind the shoulders ---
  for (const side of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.6), matFin);
    fin.position.set(side * 1.3, 4.3, -0.5);
    fin.rotation.set(0.2, side * -0.7, side * 0.3);
    figure.add(fin);
    fins.push({ mesh: fin, side });
  }

  // --- Arms: stacked cylinders; left = coral fan, right = stacked-cone staff ---
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 1.2, 4.15, 0);
    arm.rotation.z = side * 0.55;
    arm.add(stackedLimb(matBody, 1.5, 0.28, 0.22, 2));
    const lower = stackedLimb(matBody, 1.5, 0.22, 0.18, 2);
    lower.position.y = -1.5;
    lower.rotation.x = 0.4;
    arm.add(lower);
    figure.add(arm);

    if (side === -1) {
      // Coral fan: a radial spread of flattened glowing cones.
      const fan = new THREE.Group();
      fan.position.y = -1.5;
      for (let i = 0; i < 5; i++) {
        const blade = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.9, 6), matCoral);
        blade.scale.set(1, 1, 0.25);
        blade.rotation.z = (i - 2) * 0.32;
        blade.position.y = 0.35;
        fan.add(blade);
      }
      lower.add(fan);
    } else {
      // Staff: a pole of stacked cones rising past the shoulder.
      const staff = new THREE.Group();
      staff.position.y = -1.5;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.6, 8), matBody);
      pole.position.y = 0.6;
      staff.add(pole);
      for (let i = 0; i < 4; i++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.34 - i * 0.06, 0.6, 8), matGlow);
        cone.position.y = 1.6 + i * 0.5;
        staff.add(cone);
      }
      lower.add(staff);
    }
  }

  // --- Head/Mask: sphere mask + boolean-style spheres, crowned with tentacles ---
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 0.4, 8), matBody);
  neck.position.y = 4.55;
  figure.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.72, 16, 12), matBody);
  head.scale.set(1, 1.05, 0.95);
  head.position.y = 5.2;
  figure.add(head);
  const brow = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), matCoral);
  brow.scale.set(1.1, 0.5, 0.7);
  brow.position.set(0, 5.45, 0.45);
  figure.add(brow);
  const thirdEye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), matGlow);
  thirdEye.position.set(0, 5.5, 0.72);
  figure.add(thirdEye);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), matGlow);
    eye.position.set(side * 0.26, 5.2, 0.66);
    figure.add(eye);
  }

  // Tentacle crown: fan of wavy tendrils sprouting up/back from the head.
  const TENT = 9;
  for (let i = 0; i < TENT; i++) {
    const t = buildTentacle(matBody, beadGeo, 2.2, 6);
    const a = (i / (TENT - 1) - 0.5) * Math.PI * 1.3;   // fan across the crown
    t.root.position.set(Math.sin(a) * 0.5, 5.7, Math.cos(a) * 0.2 - 0.1);
    t.root.rotation.z = -Math.sin(a) * 0.5;
    t.root.rotation.x = -0.3;                            // lean back
    figure.add(t.root);
    tentacles.push({ ...t, phase: i * 0.5, speed: 1.4 + (i % 3) * 0.3 });
  }

  // --- Relics: coral/shell bits orbiting the titan (animated each frame) ---
  for (let i = 0; i < 8; i++) {
    const kind = i % 3;
    const geo = kind === 0 ? relicGeo
      : kind === 1 ? new THREE.TorusGeometry(0.13, 0.05, 6, 12)
        : new THREE.ConeGeometry(0.12, 0.28, 6);
    const m = new THREE.Mesh(geo, matCoral);
    m.scale.setScalar(0.7 + Math.random() * 0.6);
    figure.add(m);
    orbits.push({
      mesh: m,
      r: 1.8 + Math.random() * 0.9,
      y: 2.8 + Math.random() * 2.4,
      ang: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 0.6,
      spin: 0.6 + Math.random() * 1.2,
      wobble: Math.random() * Math.PI * 2,
    });
  }

  return {
    fadeMats,
    chestY: 3.5,
    glowColor: glow,
    animate(dt, t, f, playerPos, groupPos) {
      // Bob, face the player, wave tentacles + fins, spin/pulse the core, orbit relics.
      figure.position.y = CONFIG.WATER_LEVEL + Math.sin(t * 1.0) * 0.14;
      const yaw = Math.atan2(playerPos.x - groupPos.x, playerPos.z - groupPos.z);
      figure.rotation.y += angDelta(figure.rotation.y, yaw) * Math.min(1, dt * 2.2);

      for (const tt of tentacles) {
        for (let j = 0; j < tt.joints.length; j++) {
          tt.joints[j].rotation.x = -0.3 + Math.sin(t * tt.speed + j * 0.6 + tt.phase) * 0.28;
        }
      }
      for (const fin of fins) fin.mesh.rotation.y = fin.side * -0.7 + Math.sin(t * 1.3 + fin.side) * 0.18;

      core.swirl.rotation.z += dt * 0.7;
      matGlow.emissiveIntensity = (2.0 + Math.sin(t * 2.3) * 0.6) * f;

      for (const o of orbits) {
        o.ang += dt * o.speed;
        o.mesh.rotation.y += dt * o.spin;
        o.mesh.position.set(
          Math.cos(o.ang) * o.r,
          o.y + Math.sin(t * 1.4 + o.wobble) * 0.25,
          Math.sin(o.ang) * o.r,
        );
      }
    },
  };
}
