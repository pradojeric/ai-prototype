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

// Shortest signed angle from a to b (radians) — used for smooth "face player".
export function angDelta(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
