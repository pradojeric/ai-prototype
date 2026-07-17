// ============================================================
// ZONE 2 GUARDIAN — "THE CORAL-WHISPERER" (reference/boss2.jpg)
// A coral titan built from Three.js primitives:
//  - pale ice-blue multi-sphere "boolean" mask head with five glowing eyes
//  - tentacles radiating from the crown in every direction, two long front
//    tendrils hanging over the chest with glowing tips
//  - an OPEN coral-lattice torso (rings + curved bars) around a warm tide-pool
//    spiral core
//  - draped lavender-gray mantle fins over the shoulders
//  - stacked-cylinder arms: left ends in a scallop-shell coral fan, right
//    holds a tall segmented stacked-cone staff
//  - coil-wrapped legs on box platforms with torus root bases, orbiting relics
// Deliberately UNLIKE the Zone-1 golem so each guardian reads distinct.
//
// Returns the shared builder contract the Guardian shell drives:
//   build(figure) -> { fadeMats, chestY, glowColor, animate(dt,t,f,playerPos,groupPos) }
// ============================================================
import * as THREE from 'three';
import { CONFIG } from '../../config.js';
import { fadeMat, stackedLimb, spiralCore, angDelta } from './primitives.js';

// A wavy tentacle: a chain of nested joints (each holds a tapered bead), so
// rotating the joints propagates a travelling curl. Returns joints for animation.
function buildTentacle(mat, beadGeo, len, segCount, rBase = 0.13, tipMat = null) {
  const root = new THREE.Group();
  const joints = [];
  const segH = len / segCount;
  let parent = root;
  for (let i = 0; i < segCount; i++) {
    const joint = new THREE.Group();
    joint.position.y = i === 0 ? 0 : segH;   // stack upward from the base
    parent.add(joint);
    const r = THREE.MathUtils.lerp(rBase, 0.03, i / (segCount - 1));
    const bead = new THREE.Mesh(beadGeo, (tipMat && i >= segCount - 2) ? tipMat : mat);
    bead.scale.set(r, segH * 0.62, r);
    bead.position.y = segH * 0.5;
    joint.add(bead);
    joints.push(joint);
    parent = joint;
  }
  return { root, joints };
}

export function buildZone2Guardian(figure) {
  // Reference palette: gray-teal branch-coral lattice body, pale ice-blue
  // boolean-sphere mask, lavender-gray mantle fins, pink/violet coral accents,
  // cyan eye/tip glow, warm tide-pool gold in the chest.
  const glow = 0x9fe8ff;                    // icy cyan halo/beacon mood tint
  const matBody  = fadeMat(0x4a6b66, 0x6fd8d0, 0.2, 0.9, 0.65, 0.1);   // coral lattice
  const matMask  = fadeMat(0xbfdce8, 0x9fe8ff, 0.35, 0.92, 0.5, 0.1);  // pale ice-blue
  const matCoral = fadeMat(0xb478a8, 0xe8a0d8, 0.5, 0.9, 0.55, 0.1);   // pink coral
  const matFin   = fadeMat(0x8a8098, 0xb8a8d8, 0.5, 0.5, 0.65, 0.05);  // lavender-gray mantle
  matFin.side = THREE.DoubleSide;                                      // fins visible from both faces
  const matCyan  = fadeMat(0x9fe8ff, 0x9fe8ff, 2.0, 0.96, 0.3, 0.1);   // eyes / tentacle tips
  const matGlow  = fadeMat(0xffb066, 0xffb066, 2.2, 0.96, 0.3, 0.1);   // warm tide-pool core
  const fadeMats = [
    [matBody, 0.9], [matMask, 0.92], [matCoral, 0.9], [matFin, 0.5],
    [matCyan, 0.96], [matGlow, 0.96],
  ];
  const beadGeo = new THREE.SphereGeometry(1, 8, 6);      // unit bead (scaled per use)
  const relicGeo = new THREE.SphereGeometry(0.14, 10, 8);

  const tentacles = [];
  const fins = [];
  const orbits = [];

  // --- Base: box platform slabs + torus "root" rings under each foot ---
  for (const side of [-1, 1]) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.45, 1.9), matBody);
    slab.position.set(side * 0.8, 0.22, 0);
    figure.add(slab);
    const root = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.16, 8, 16), matCoral);
    root.rotation.x = Math.PI / 2;
    root.position.set(side * 0.8, 0.55, 0);
    figure.add(root);
    // coral clusters heaped at the leg roots
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1 + side;
      const clump = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), matCoral);
      clump.position.set(side * 0.8 + Math.cos(a) * 0.55, 0.55, Math.sin(a) * 0.6);
      figure.add(clump);
      const sprig = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.4, 5), matCoral);
      sprig.position.set(side * 0.8 + Math.cos(a + 1) * 0.5, 0.75, Math.sin(a + 1) * 0.55);
      sprig.rotation.z = Math.cos(a) * 0.4;
      figure.add(sprig);
    }
  }

  // --- Legs: thick stacked cylinders wrapped with coil rings + barnacles ---
  for (const side of [-1, 1]) {
    const leg = stackedLimb(matBody, 2.0, 0.42, 0.52, 3);
    leg.position.set(side * 0.8, 2.5, 0);
    figure.add(leg);
    for (let i = 0; i < 3; i++) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.07, 6, 14), matCoral);
      coil.rotation.x = Math.PI / 2;
      coil.position.set(side * 0.8, 0.9 + i * 0.55, 0);
      figure.add(coil);
    }
    // barnacle studs dotting the shin
    for (let i = 0; i < 4; i++) {
      const a = i * 1.7 + side * 0.5;
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), matMask);
      b.position.set(side * 0.8 + Math.cos(a) * 0.48, 0.7 + i * 0.45, Math.sin(a) * 0.48);
      figure.add(b);
    }
  }

  // --- Hips ---
  const hips = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.6, 1.0), matBody);
  hips.position.y = 2.6;
  figure.add(hips);

  // --- Torso: OPEN coral lattice — horizontal rings + curved vertical bars
  // forming a cage the warm core glows through (the reference's branch body) ---
  // Rings taper hard: narrow at the hips, broad at the chest (triangular bulk).
  const TORSO_Y = 3.6;
  for (const [ry, rr] of [[-0.85, 0.95], [-0.4, 1.05], [0.1, 1.18], [0.6, 1.32], [0.95, 1.42]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.07, 6, 18), matBody);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = TORSO_Y + ry;
    figure.add(ring);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    if (Math.abs(Math.sin(a)) < 0.45 && Math.cos(a) > 0) continue;  // leave the chest window open
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.0, 6), matBody);
    bar.position.set(Math.sin(a) * 1.15, TORSO_Y + 0.05, Math.cos(a) * 1.15);
    bar.rotation.z = Math.sin(a) * 0.24;   // lean outward with the taper
    bar.rotation.x = -Math.cos(a) * 0.24;
    figure.add(bar);
    // diagonal cross-brace between rings (densifies the weave)
    const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 5), matBody);
    brace.position.set(Math.sin(a + 0.26) * 1.18, TORSO_Y + (i % 2 ? 0.45 : -0.45), Math.cos(a + 0.26) * 1.18);
    brace.rotation.z = Math.sin(a) * 0.9;
    brace.rotation.x = -Math.cos(a) * 0.9;
    figure.add(brace);
    // small coral branch nubs sprouting off some bars
    if (i % 2 === 0) {
      const nub = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.35, 5), matCoral);
      nub.position.set(Math.sin(a) * 1.32, TORSO_Y + (i % 3 - 1) * 0.5, Math.cos(a) * 1.32);
      nub.rotation.z = -Math.sin(a) * 1.2;
      nub.rotation.x = Math.cos(a) * 1.2;
      figure.add(nub);
    }
  }
  // coral clusters heaped over the hips and shoulder line
  for (const [cx, cy, cz] of [
    [-1.0, 2.75, 0.3], [0.95, 2.75, -0.35], [-1.35, 4.55, 0.2],
    [1.35, 4.55, -0.15], [0.2, 4.75, -0.6], [-0.5, 4.7, 0.55],
  ]) {
    const clump = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), matCoral);
    clump.position.set(cx, cy, cz);
    figure.add(clump);
    const sprig = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.45, 5), matCoral);
    sprig.position.set(cx * 1.05, cy + 0.28, cz);
    sprig.rotation.z = -cx * 0.3;
    figure.add(sprig);
  }
  // Coral studs climbing the lattice.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.4;
    const stud = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), matCoral);
    stud.position.set(Math.sin(a) * 1.15, 3.0 + (i % 4) * 0.42, Math.cos(a) * 1.15);
    figure.add(stud);
  }

  // --- Chest: warm glowing tide-pool spiral core, set INSIDE the lattice ---
  const core = spiralCore(matGlow, { radius: 0.72, arms: 2, motesPerArm: 8, turns: 1.6 });
  core.group.position.set(0, 3.55, 0.55);
  figure.add(core.group);
  // little coral sprigs around the pool rim
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.7;
    const sprig = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.26, 5), matCoral);
    sprig.position.set(Math.cos(a) * 0.78, 3.55 + Math.sin(a) * 0.78, 0.6);
    sprig.rotation.z = -a;
    figure.add(sprig);
  }

  // --- Mantle fins: four overlapping lavender planes per side, draped like a
  // continuous cape over both shoulders and drooping toward the elbows ---
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(new THREE.PlaneGeometry(2.1 - i * 0.3, 1.6 - i * 0.2), matFin);
      fin.position.set(side * (1.05 + i * 0.42), 4.65 - i * 0.3, -0.35 + i * 0.15);
      fin.rotation.set(0.35 + i * 0.12, side * -(0.5 + i * 0.28), side * (0.3 + i * 0.18));
      figure.add(fin);
      fins.push({ mesh: fin, side, baseY: fin.rotation.y, phase: i * 0.7 });
      // kelp strands trailing off the mantle edge
      const kelp = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.045, 0.9, 4), matFin);
      kelp.position.set(side * (1.5 + i * 0.4), 3.85 - i * 0.3, -0.25 + i * 0.15);
      kelp.rotation.z = side * (0.25 + i * 0.1);
      figure.add(kelp);
    }
  }

  // --- Arms: stacked cylinders; left = scallop-shell coral fan, right = staff ---
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
      // Sphere weapon: a coral-encrusted mace ball gripped at the arm's end,
      // with two small shell fans higher on the forearm as accents.
      const mace = new THREE.Group();
      mace.position.y = -1.75;
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), matBody);
      mace.add(ball);
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 6, 20), matCyan);
      band.rotation.x = Math.PI / 2.6;
      mace.add(band);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const stud = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), matCoral);
        stud.position.set(Math.cos(a) * 0.48, Math.sin(a * 2) * 0.3, Math.sin(a) * 0.48);
        mace.add(stud);
        if (i % 2 === 0) {
          const spike = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.32, 5), matCoral);
          spike.position.set(Math.cos(a) * 0.58, Math.sin(a * 2) * 0.36, Math.sin(a) * 0.58);
          spike.rotation.z = -Math.cos(a) * 1.3;
          spike.rotation.x = Math.sin(a) * 1.3;
          mace.add(spike);
        }
      }
      lower.add(mace);
      for (let i = 0; i < 2; i++) {
        const shell = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), i ? matCoral : matFin);
        shell.scale.set(1, 0.85, 0.12);
        shell.rotation.z = 0.5 + i * 0.5;
        shell.position.set(-0.25, -0.5 - i * 0.35, 0.1);
        lower.add(shell);
      }
    } else {
      // Staff: a tall pole of alternating stacked cones rising past the shoulder.
      const staff = new THREE.Group();
      staff.position.y = -1.5;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4.6, 8), matBody);
      pole.position.y = 1.0;
      staff.add(pole);
      for (let i = 0; i < 6; i++) {
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(0.34 - i * 0.04, 0.5, 8),
          i % 2 ? matMask : matBody,
        );
        cone.position.y = 1.5 + i * 0.45;
        staff.add(cone);
      }
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.9, 8), matCyan);
      tip.position.y = 4.4;
      staff.add(tip);
      lower.add(staff);
    }
  }

  // --- Head/Mask: pale multi-sphere boolean cluster with five glowing eyes ---
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 0.4, 8), matBody);
  neck.position.y = 4.55;
  figure.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.86, 16, 12), matMask);
  head.scale.set(1, 1.05, 0.95);
  head.position.y = 5.3;
  figure.add(head);
  // boolean-style bump spheres clustered densely over the crown/cheeks
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const up = 0.28 + (i % 3) * 0.24;
    const bump = new THREE.Mesh(new THREE.SphereGeometry(0.18 + (i % 3) * 0.07, 10, 8), matMask);
    bump.position.set(Math.sin(a) * 0.62, 5.3 + up, Math.cos(a) * 0.5 - 0.05);
    figure.add(bump);
  }
  // chin/beak sphere
  const chin = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), matMask);
  chin.scale.set(0.8, 1.1, 0.8);
  chin.position.set(0, 4.85, 0.4);
  figure.add(chin);
  // five eyes: two mains, a vertical third eye, two small outer studs
  const thirdEye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), matCyan);
  thirdEye.scale.set(0.7, 1.4, 0.7);
  thirdEye.position.set(0, 5.55, 0.68);
  figure.add(thirdEye);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), matCyan);
    eye.position.set(side * 0.28, 5.3, 0.64);
    figure.add(eye);
    const small = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), matCyan);
    small.position.set(side * 0.5, 5.45, 0.5);
    figure.add(small);
  }

  // Tentacles radiating from the whole crown — up, out, and back — plus two
  // long front tendrils hanging over the chest with glowing tips.
  const TENT = 12;
  for (let i = 0; i < TENT; i++) {
    const a = (i / TENT) * Math.PI * 2;
    const t = buildTentacle(matMask, beadGeo, 2.4, 7);
    t.root.position.set(Math.sin(a) * 0.62, 5.65 + Math.cos(a) * 0.15, Math.cos(a) * 0.45 - 0.1);
    t.root.rotation.z = -Math.sin(a) * 1.1;   // radiate outward all around
    t.root.rotation.x = -0.2 - Math.cos(a) * 0.7;
    figure.add(t.root);
    tentacles.push({ ...t, phase: i * 0.6, speed: 1.3 + (i % 3) * 0.3, base: -0.3 });
  }
  for (const side of [-1, 1]) {
    const t = buildTentacle(matMask, beadGeo, 2.6, 7, 0.15, matCyan);
    t.root.position.set(side * 0.3, 4.95, 0.5);
    t.root.rotation.x = Math.PI * 0.92;       // hang down over the chest
    t.root.rotation.z = side * 0.15;
    figure.add(t.root);
    tentacles.push({ ...t, phase: side * 1.2, speed: 1.0, base: -0.15 });
  }

  // --- Relics: coral/shell bits orbiting the titan (animated each frame) ---
  for (let i = 0; i < 12; i++) {
    const kind = i % 3;
    const geo = kind === 0 ? relicGeo
      : kind === 1 ? new THREE.TorusGeometry(0.13, 0.05, 6, 12)
        : new THREE.ConeGeometry(0.12, 0.28, 6);
    const m = new THREE.Mesh(geo, kind === 2 ? matCyan : matCoral);
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
    chestY: 3.55,
    glowColor: glow,
    animate(dt, t, f, playerPos, groupPos) {
      // Bob, face the player, wave tentacles + fins, spin/pulse the core, orbit relics.
      figure.position.y = CONFIG.WATER_LEVEL + Math.sin(t * 1.0) * 0.14;
      const yaw = Math.atan2(playerPos.x - groupPos.x, playerPos.z - groupPos.z);
      figure.rotation.y += angDelta(figure.rotation.y, yaw) * Math.min(1, dt * 2.2);

      for (const tt of tentacles) {
        for (let j = 0; j < tt.joints.length; j++) {
          tt.joints[j].rotation.x = tt.base + Math.sin(t * tt.speed + j * 0.6 + tt.phase) * 0.26;
        }
      }
      for (const fin of fins) {
        fin.mesh.rotation.y = fin.baseY + Math.sin(t * 1.3 + fin.side + fin.phase) * 0.15;
      }

      core.swirl.rotation.z += dt * 0.7;
      matGlow.emissiveIntensity = (2.0 + Math.sin(t * 2.3) * 0.6) * f;
      matCyan.emissiveIntensity = (1.8 + Math.sin(t * 2.8 + 1) * 0.5) * f;

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
