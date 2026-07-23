// ============================================================
// ZONE 1 GUARDIAN — the submerged-market golem from reference/boss1.jpg.
// Spectral-teal humanoid (~5.5m) built from Three.js primitives:
//  - faceted horned head trailing seaweed fronds
//  - rune-tablet row across the collar, rune belt at the waist
//  - a woven bamboo chest cavity glowing from within, holding food plates
//  - massive tilted earthen pots heaped with food on each shoulder
//  - rope-wrapped stacked-bamboo arms with woven rattan-ball hands
//  - thick smooth column legs, woven fish-trap balls at the hip skirt
//  - crossed spears behind the shoulders, orbiting food plates
//
// Builders are the per-zone seam: each returns the same contract so the shared
// Guardian shell can drive fade, halo, and idle animation uniformly.
//   build(figure) -> { fadeMats, chestY, glowColor, animate(dt, t, f, playerPos, groupPos) }
// ============================================================
import * as THREE from 'three';
import { CONFIG } from '../../config.js';
import { fadeMat, pulseEmissive, stackedLimb, buildPot, angDelta } from './primitives.js';

export function buildZone1Golem(figure) {
  // Reference palette: mossy sea-green armor, tan-olive bamboo, terracotta
  // pots, dark-olive stone, pale-jade runes, warm lantern-gold chest glow.
  const jade = 0xaee8c0;
  const gold = 0xffb84d;
  const matBody  = fadeMat(0x4e6b55, jade, 0.15, 0.9, 0.65, 0.1);
  const matLimb  = fadeMat(0x8a8f5a, jade, 0.08, 0.92, 0.7, 0.05);  // tan-olive bamboo
  const matRope  = fadeMat(0x6b6a42, jade, 0.05, 0.92, 0.85, 0.02);
  const matPot   = fadeMat(0x6b4a35, gold, 0.06, 0.95, 0.8, 0.02);  // terracotta
  const matHorn  = fadeMat(0x3d4a3a, jade, 0.2, 0.95, 0.5, 0.1);    // dark olive stone
  const matFrond = fadeMat(0x3e6b45, jade, 0.15, 0.85, 0.7, 0.05);  // seaweed
  const matGlow  = fadeMat(jade, gold, 0, 0.96, 0.3, 0.1);          // gold-lit runes / eyes / belt
  const matWarm  = fadeMat(0xd9a24a, gold, 0, 0.95, 0.5, 0.1);      // lantern-lit food accents
  const fadeMats = [
    [matBody, 0.9], [matLimb, 0.92], [matRope, 0.92], [matPot, 0.95],
    [matHorn, 0.95], [matFrond, 0.85], [matGlow, 0.96], [matWarm, 0.95],
  ];
  const sphereGeo = new THREE.SphereGeometry(0.16, 10, 8);  // shared food/knob geo
  const foodColors = [0xd94f3a, 0x7ab648, 0xe8c86a, 0xc47ab0]; // shared food-morsel mats
  const foodMats = foodColors.map((c) => fadeMat(c, c, 0, 0.95, 0.6, 0.05));
  for (const m of foodMats) fadeMats.push([m, 0.95]);

  // A small serving plate heaped with colored food morsels (used inside the
  // chest cavity and as the orbiting items in the reference).
  function buildPlate() {
    const p = new THREE.Group();
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.08, 12), matWarm);
    p.add(dish);
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(sphereGeo, foodMats[i % foodMats.length]);
      const a = (i / 4) * Math.PI * 2 + Math.random();
      m.position.set(Math.cos(a) * 0.13, 0.09, Math.sin(a) * 0.13);
      m.scale.setScalar(0.5 + Math.random() * 0.3);
      p.add(m);
    }
    return p;
  }

  // A woven rattan ball — lattice of tilted tori (fish-trap / hand weave).
  function wovenBall(r, mat) {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.14, 6, 14), mat);
      t.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, (i / 4) * Math.PI);
      g.add(t);
    }
    const core = new THREE.Mesh(new THREE.SphereGeometry(r * 0.85, 10, 8), mat);
    g.add(core);
    return g;
  }

  const arms = [];
  const orbits = [];
  const fronds = [];
  let head;

  // --- Legs: thick smooth tapered columns with heavy block feet ---
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 2.3, 12), matLimb);
    leg.position.set(side * 0.62, 1.25, 0);
    figure.add(leg);
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.46, 10, 8), matLimb);
    knee.position.set(side * 0.62, 2.35, 0);
    figure.add(knee);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.35, 1.2), matLimb);
    foot.position.set(side * 0.62, 0.18, 0.2);
    figure.add(foot);
  }

  // --- Hip skirt: woven fish-trap balls hanging in a fringe around the waist ---
  const hips = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.15, 0.7, 10), matBody);
  hips.position.y = 2.5;
  figure.add(hips);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const ball = wovenBall(0.32, matRope);
    ball.position.set(Math.cos(a) * 1.05, 2.15 + (i % 2) * 0.15, Math.sin(a) * 0.85);
    figure.add(ball);
  }

  // --- Rune belt: emissive band + glyph studs circling the waist ---
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.12, 0.28, 12, 1, true), matGlow);
  belt.position.y = 2.72;
  figure.add(belt);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const g = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.08), matHorn);
    g.position.set(Math.sin(a) * 1.14, 2.72, Math.cos(a) * 1.14);
    g.rotation.y = a;
    figure.add(g);
  }

  // --- Torso: broad plated trunk, wider at the shoulders ---
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.05, 1.8, 6), matBody);
  torso.position.y = 3.7;
  torso.rotation.y = Math.PI / 6;
  figure.add(torso);

  // --- Chest cavity: woven bamboo cage glowing from within, food plates inside ---
  const cavity = new THREE.Group();
  cavity.position.set(0, 3.55, 0.85);
  // warm interior backing + bloom
  const glowBack = new THREE.Mesh(new THREE.CircleGeometry(0.72, 24), matWarm);
  glowBack.position.z = -0.1;
  cavity.add(glowBack);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.09, 10, 24), matLimb);
  cavity.add(rim);
  // lattice bars across the opening (the weave the light spills through)
  for (let i = -2; i <= 2; i++) {
    const barV = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 6), matLimb);
    barV.position.set(i * 0.28, 0, 0.02);
    barV.scale.y = Math.sqrt(Math.max(0.1, 1 - (i * 0.28 / 0.78) ** 2));
    cavity.add(barV);
    const barH = barV.clone();
    barH.rotation.z = Math.PI / 2;
    barH.position.set(0, i * 0.28, 0.04);
    cavity.add(barH);
  }
  // shelved food plates behind the weave
  for (const [px, py, s] of [[-0.25, -0.2, 1], [0.3, 0.05, 0.8], [-0.05, 0.3, 0.7]]) {
    const plate = buildPlate();
    plate.position.set(px, py, -0.02);
    plate.rotation.x = Math.PI / 2.4;   // tilted toward the viewer
    plate.scale.setScalar(s);
    cavity.add(plate);
  }
  figure.add(cavity);

  // --- Rune-tablet row across the collar (five stone slabs with glyphs) ---
  for (let i = -2; i <= 2; i++) {
    const a = i * 0.32;
    const tablet = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.08), matHorn);
    tablet.position.set(Math.sin(a) * 1.28, 4.55, Math.cos(a) * 1.28 * 0.85);
    tablet.rotation.y = a;
    figure.add(tablet);
    const glyph = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.34), matGlow);
    glyph.position.set(Math.sin(a) * 1.33, 4.55, Math.cos(a) * 1.33 * 0.85);
    glyph.rotation.y = a;
    figure.add(glyph);
  }

  // --- Shoulders: armored caps with big tilted food pots ---
  for (const side of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), matBody);
    cap.position.set(side * 1.45, 4.5, 0);
    figure.add(cap);
    const pot = buildPot(matPot, matWarm, sphereGeo);
    pot.scale.setScalar(1.25);
    pot.position.set(side * 1.55, 5.0, 0);
    pot.rotation.z = side * 0.35;      // tipped outward like the reference
    figure.add(pot);
  }

  // --- Arms: rope-wrapped stacked bamboo bundles, splayed down-and-out ---
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 1.5, 4.3, 0);
    arm.rotation.z = side * 0.85;      // strongly splayed like the reference
    arm.rotation.x = 0.1;
    arm.add(stackedLimb(matLimb, 1.5, 0.34, 0.28, 2));
    // rope wraps around the upper bundle
    for (const y of [-0.45, -0.95]) {
      const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.06, 6, 12), matRope);
      wrap.rotation.x = Math.PI / 2;
      wrap.position.y = y;
      arm.add(wrap);
    }
    const lower = stackedLimb(matLimb, 1.5, 0.28, 0.22, 2);
    lower.position.y = -1.5;
    lower.rotation.x = 0.3;
    lower.rotation.z = side * 0.25;
    arm.add(lower);
    const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 6, 12), matRope);
    wrap.rotation.x = Math.PI / 2;
    wrap.position.y = -0.7;
    lower.add(wrap);
    // woven rattan-ball hand
    const hand = wovenBall(0.34, matRope);
    hand.position.y = -1.6;
    lower.add(hand);
    figure.add(arm);
    arms.push({ group: arm, side, baseZ: side * 0.85 });
  }

  // --- Neck + faceted horned head trailing seaweed fronds ---
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 0.4, 8), matBody);
  neck.position.y = 4.85;
  figure.add(neck);
  head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.72, 0), matBody);
  head.position.y = 5.5;
  head.scale.set(1, 0.9, 0.85);
  figure.add(head);
  // brow ridge plate
  const brow = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.68, 0.3, 5), matHorn);
  brow.position.y = 5.85;
  figure.add(brow);
  // two big side horns + a short center spike
  for (const side of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.1, 8), matHorn);
    horn.position.set(side * 0.5, 6.25, 0);
    horn.rotation.z = side * -0.45;
    figure.add(horn);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), matGlow);
    eye.position.set(side * 0.26, 5.52, 0.6);
    figure.add(eye);
  }
  const spike = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 6), matHorn);
  spike.position.y = 6.25;
  figure.add(spike);
  // seaweed fronds spilling from behind the head (animated sway)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 1.4 - Math.PI * 0.7;
    const frond = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 1.4, 5), matFrond);
    frond.position.set(Math.sin(a) * 0.55, 5.35, -0.35 - Math.cos(a) * 0.2);
    frond.rotation.set(0.5 + Math.random() * 0.3, 0, Math.sin(a) * 0.6);
    figure.add(frond);
    fronds.push({ mesh: frond, phase: Math.random() * Math.PI * 2, baseX: frond.rotation.x });
  }

  // --- Spears crossed behind the shoulders ---
  for (const side of [-1, 1]) {
    const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.4, 6), matLimb);
    spear.position.set(side * 1.0, 5.2, -0.8);
    spear.rotation.x = -0.15;
    spear.rotation.z = side * 0.35;    // crossed X like the reference
    figure.add(spear);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 6), matHorn);
    tip.position.set(side * 1.6, 6.75, -1.05);
    tip.rotation.z = side * 0.35;
    figure.add(tip);
  }

  // --- Orbiting food plates (animated each frame) ---
  for (let i = 0; i < 6; i++) {
    const plate = buildPlate();
    plate.scale.setScalar(0.8 + Math.random() * 0.5);
    figure.add(plate);
    orbits.push({
      mesh: plate,
      r: 2.0 + Math.random() * 0.8,
      y: 3.0 + Math.random() * 2.4,
      ang: Math.random() * Math.PI * 2,
      speed: 0.4 + Math.random() * 0.5,
      wobble: Math.random() * Math.PI * 2,
    });
  }

  return {
    fadeMats,
    chestY: 3.55,           // local chest height (halo + encounter anchor)
    glowColor: gold,
    animate(dt, t, f, playerPos, groupPos) {
      // Bob, turn to face the player, sway arms/fronds, orbit plates.
      figure.position.y = CONFIG.WATER_LEVEL + Math.sin(t * 1.2) * 0.12;
      const yaw = Math.atan2(playerPos.x - groupPos.x, playerPos.z - groupPos.z);
      figure.rotation.y += angDelta(figure.rotation.y, yaw) * Math.min(1, dt * 2.5);

      pulseEmissive(matWarm, t, 0.32, 0.14, 1.35, 0, f);
      pulseEmissive(matGlow, t, 0.24, 0.12, 1.15, 0.7, f);

      const sway = Math.sin(t * 1.1) * 0.08;
      for (const a of arms) {
        a.group.rotation.x = 0.1 + sway * a.side;
        a.group.rotation.z = a.baseZ + Math.sin(t * 0.8 + a.side) * 0.05;
      }
      head.rotation.z = Math.sin(t * 0.9) * 0.06;
      for (const fr of fronds) {
        fr.mesh.rotation.x = fr.baseX + Math.sin(t * 1.6 + fr.phase) * 0.12;
      }
      for (const o of orbits) {
        o.ang += dt * o.speed;
        o.mesh.position.set(
          Math.cos(o.ang) * o.r,
          o.y + Math.sin(t * 1.4 + o.wobble) * 0.25,
          Math.sin(o.ang) * o.r,
        );
        o.mesh.rotation.y = o.ang;
      }
    },
  };
}
