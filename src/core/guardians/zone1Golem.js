// ============================================================
// ZONE 1 GUARDIAN — the submerged-market golem from reference/boss1.jpg.
// Spectral-teal humanoid (~5.5m) built from Three.js primitives: horned hex
// head, broad rune torso with a glowing chest offering-bowl, earthen shoulder
// pots full of food, stacked-cylinder bamboo limbs, spear accents, orbiting food.
//
// Builders are the per-zone seam: each returns the same contract so the shared
// Guardian shell can drive fade, halo, and idle animation uniformly.
//   build(figure) -> { fadeMats, chestY, glowColor, animate(dt, t, f, playerPos, groupPos) }
// ============================================================
import * as THREE from 'three';
import { CONFIG, GUARDIAN } from '../../config.js';
import { fadeMat, stackedLimb, buildPot, angDelta } from './primitives.js';

export function buildZone1Golem(figure) {
  const teal = GUARDIAN.CORE_COLOR;
  const matBody = fadeMat(0x1c5a5e, teal, 0.5, 0.9);
  const matLimb = fadeMat(0x174a4e, teal, 0.4, 0.92, 0.65, 0.15);
  const matPot  = fadeMat(0x123e42, teal, 0.35, 0.95, 0.75, 0.1);
  const matHorn = fadeMat(0x0e3236, teal, 0.7, 0.95, 0.4);
  const matGlow = fadeMat(teal, teal, 2.2, 0.96, 0.3, 0.1);
  const fadeMats = [
    [matBody, 0.9], [matLimb, 0.92], [matPot, 0.95], [matHorn, 0.95], [matGlow, 0.96],
  ];
  const sphereGeo = new THREE.SphereGeometry(0.16, 10, 8);  // shared food/knob geo

  const arms = [];
  const orbits = [];
  let head;

  // --- Legs: two stacked-cylinder columns with block feet ---
  for (const side of [-1, 1]) {
    const leg = stackedLimb(matLimb, 2.2, 0.34, 0.4, 3);
    leg.position.set(side * 0.55, 2.2, 0);
    figure.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 1.1), matLimb);
    foot.position.set(side * 0.55, 0.18, 0.18);
    figure.add(foot);
  }

  // --- Hips ---
  const hips = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 1.0), matBody);
  hips.position.y = 2.35;
  figure.add(hips);

  // --- Torso: a broad hexagonal plated trunk ---
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.2, 1.7, 6), matBody);
  torso.position.y = 3.15;
  torso.rotation.y = Math.PI / 6;
  figure.add(torso);

  // Rune panel on the chest (emissive plate + raised glyph boxes, facing +Z).
  const runes = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.3), matGlow);
  runes.position.set(0, 3.15, 1.02);
  figure.add(runes);
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.06), matHorn);
    g.position.set((Math.random() - 0.5) * 0.8, 3.15 + (Math.random() - 0.5) * 0.9, 1.06);
    figure.add(g);
  }

  // --- Glowing chest offering-bowl (the focal bloom element) ---
  const bowl = new THREE.Group();
  bowl.position.set(0, 2.7, 1.15);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.09, 10, 24), matGlow);
  bowl.add(ring);
  const plate = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24), matGlow);
  plate.position.z = -0.04;
  bowl.add(plate);
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(sphereGeo, matGlow);
    const a = (i / 7) * Math.PI * 2;
    const rad = i === 0 ? 0 : 0.28;
    m.position.set(Math.cos(a) * rad, Math.sin(a) * rad, 0.05);
    m.scale.setScalar(0.8);
    bowl.add(m);
  }
  figure.add(bowl);

  // --- Shoulders + food pots ---
  for (const side of [-1, 1]) {
    const pot = buildPot(matPot, matGlow, sphereGeo);
    pot.position.set(side * 1.2, 4.05, 0);
    figure.add(pot);
  }

  // --- Arms: stacked bamboo, splayed out, with woven-ball hands ---
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 1.15, 3.75, 0);
    arm.rotation.z = side * 0.5;     // splay outward
    arm.rotation.x = 0.1;
    arm.add(stackedLimb(matLimb, 1.4, 0.3, 0.24, 2));
    const lower = stackedLimb(matLimb, 1.4, 0.24, 0.2, 2);
    lower.position.y = -1.4;
    lower.rotation.x = 0.35;
    arm.add(lower);
    const hand = new THREE.Mesh(new THREE.IcosahedronGeometry(0.36, 0), matLimb);
    hand.position.y = -1.4;
    lower.add(hand);
    figure.add(arm);
    arms.push({ group: arm, side });
  }

  // --- Neck + horned hexagonal head ---
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.4, 8), matBody);
  neck.position.y = 4.15;
  figure.add(neck);
  head = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.95, 6), matBody);
  head.position.y = 4.7;
  figure.add(head);
  for (const side of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.95, 8), matHorn);
    horn.position.set(side * 0.4, 5.2, 0);
    horn.rotation.z = side * -0.4;
    figure.add(horn);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), matGlow);
    eye.position.set(side * 0.24, 4.72, 0.56);
    figure.add(eye);
  }

  // --- Spear / pole accents behind the shoulders ---
  for (const side of [-1, 1]) {
    const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.8, 6), matLimb);
    spear.position.set(side * 0.9, 4.4, -0.7);
    spear.rotation.x = -0.18;
    spear.rotation.z = side * 0.12;
    figure.add(spear);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 6), matHorn);
    tip.position.set(side * 0.9, 5.85, -0.83);
    figure.add(tip);
  }

  // --- Orbiting food items (animated each frame) ---
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(sphereGeo, matGlow);
    m.scale.setScalar(0.7 + Math.random() * 0.6);
    figure.add(m);
    orbits.push({
      mesh: m,
      r: 1.7 + Math.random() * 0.7,
      y: 2.6 + Math.random() * 2.2,
      ang: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 0.6,
      wobble: Math.random() * Math.PI * 2,
    });
  }

  return {
    fadeMats,
    chestY: 3.1,            // local chest height (halo + encounter anchor)
    glowColor: teal,
    animate(dt, t, f, playerPos, groupPos) {
      // Bob, turn to face the player, sway arms, pulse glow, orbit food.
      figure.position.y = CONFIG.WATER_LEVEL + Math.sin(t * 1.2) * 0.12;
      const yaw = Math.atan2(playerPos.x - groupPos.x, playerPos.z - groupPos.z);
      figure.rotation.y += angDelta(figure.rotation.y, yaw) * Math.min(1, dt * 2.5);

      const sway = Math.sin(t * 1.1) * 0.12;
      for (const a of arms) a.group.rotation.x = 0.1 + sway * a.side;
      head.rotation.z = Math.sin(t * 0.9) * 0.06;
      matGlow.emissiveIntensity = (2.0 + Math.sin(t * 2.5) * 0.6) * f;

      for (const o of orbits) {
        o.ang += dt * o.speed;
        o.mesh.position.set(
          Math.cos(o.ang) * o.r,
          o.y + Math.sin(t * 1.4 + o.wobble) * 0.25,
          Math.sin(o.ang) * o.r,
        );
      }
    },
  };
}
