// ============================================================
// CONFIG — shared tunables + small utilities
// ============================================================
import * as THREE from 'three';

export const CONFIG = {
  WATER_LEVEL: 0.4,        // surface height; player eye sits above (shallow knee-deep wade, seabed at -0.3)
  EYE_HEIGHT: 1.62,
  WADE_SPEED: 2.6,          // slow, deliberate
  ZONE_HALF: 48,            // play area half-extent (~96×96 m)
  INTERACT_RANGE: 2.7,
  FOG_DENSITY: 0.03,        // lighter than before so the larger space reads
  TEAL: 0x2f6f6a,
  DOCK_TOP: 1.7,            // top surface of the raised spawn platform (above water)
};

// Player collision radius (circle-vs-AABB).
export const PLAYER_RADIUS = 0.45;

export const WORLD_UP = new THREE.Vector3(0, 1, 0);

export function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

export function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

// Small seeded PRNG for deterministic placement.
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
