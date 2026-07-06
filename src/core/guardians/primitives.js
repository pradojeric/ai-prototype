// ============================================================
// GUARDIAN PRIMITIVES — shared, palette-agnostic builders reused by every
// per-zone Guardian body. Each zone's builder picks its own materials/shapes;
// these helpers just cut down on repetition.
// ============================================================
import * as THREE from 'three';

// A transparent MeshStandardMaterial (every Guardian part fades together via
// opacity, so transparency is mandatory).
export function fadeMat(color, emissive, emissiveIntensity, opacity, roughness = 0.55, metalness = 0.2) {
  return new THREE.MeshStandardMaterial({
    color, emissive, emissiveIntensity, roughness, metalness,
    transparent: true, opacity,
  });
}

// A bamboo-style limb: a short stack of cylinders running down local -Y, with
// a joint knob between segments. Returns a Group pivoted at its top.
export function stackedLimb(mat, totalLen, rTop, rBot, count = 3) {
  const g = new THREE.Group();
  const segH = totalLen / count;
  for (let i = 0; i < count; i++) {
    const r = THREE.MathUtils.lerp(rTop, rBot, count > 1 ? i / (count - 1) : 0);
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r, segH * 0.84, 8), mat);
    seg.position.y = -segH * (i + 0.5);
    g.add(seg);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(r * 1.05, 8, 6), mat);
    knob.position.y = -segH * (i + 1);
    g.add(knob);
  }
  return g;
}

// A food-filled earthen pot (squashed sphere + rim + heaped glowing morsels).
export function buildPot(matPot, matGlow, sphereGeo) {
  const pot = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 12), matPot);
  body.scale.set(1, 0.85, 1);
  pot.add(body);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.1, 8, 16), matPot);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.42;
  pot.add(rim);
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(sphereGeo, matGlow);
    const a = (i / 6) * Math.PI * 2;
    m.position.set(Math.cos(a) * 0.22, 0.5 + Math.random() * 0.08, Math.sin(a) * 0.22);
    m.scale.setScalar(0.7 + Math.random() * 0.5);
    pot.add(m);
  }
  return pot;
}

// A glowing spiral "core" — a bright ring + backing disc + a logarithmic spiral
// arm of emissive motes. Reused as the focal chest bloom on multiple guardians
// (the coral-whisperer's market swirl, the keeper's memory galaxy). Returns the
// group plus refs the caller rotates + pulses each frame (see `swirl` / `motes`).
//   opts: { radius, arms, motesPerArm, moteGeo, turns }
export function spiralCore(matGlow, opts = {}) {
  const {
    radius = 0.7, arms = 2, motesPerArm = 7, turns = 1.4,
    moteGeo = new THREE.SphereGeometry(0.07, 8, 6),
  } = opts;

  const group = new THREE.Group();          // faces +Z; caller positions it
  const swirl = new THREE.Group();           // spun each frame
  group.add(swirl);

  // Bright rim + a dim backing disc so the swirl reads against the dark body.
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, radius * 0.09, 10, 28), matGlow);
  group.add(ring);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.94, 28), matGlow);
  disc.position.z = -0.03;
  disc.scale.setScalar(0.5);                 // dimmer core face (opacity handled by matGlow)
  group.add(disc);

  // Spiral arms of motes, shrinking toward the rim.
  const motes = [];
  for (let a = 0; a < arms; a++) {
    const a0 = (a / arms) * Math.PI * 2;
    for (let i = 0; i < motesPerArm; i++) {
      const f = (i + 1) / motesPerArm;       // 0..1 outward
      const ang = a0 + f * turns * Math.PI * 2;
      const rad = f * radius * 0.92;
      const m = new THREE.Mesh(moteGeo, matGlow);
      m.position.set(Math.cos(ang) * rad, Math.sin(ang) * rad, 0.02);
      m.scale.setScalar(1.2 - f * 0.7);
      swirl.add(m);
      motes.push(m);
    }
  }

  return { group, swirl, ring, motes };
}

// Shortest signed angle from a to b (radians) — used for smooth "face player".
export function angDelta(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
