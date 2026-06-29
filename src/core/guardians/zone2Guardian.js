// ============================================================
// ZONE 2 GUARDIAN — PLACEHOLDER (spectral spire-wisp)
// A tall, thin amber-green apparition: a slender stacked-cylinder spire topped
// by a glowing crown orb, with a small ring of motes orbiting the crown. Built
// deliberately UNLIKE the Zone-1 golem (slim + vertical vs. broad + bulky) so
// the per-zone guardian reads as distinct. Swap for a designed body later.
//
// Returns the shared builder contract the Guardian shell drives:
//   build(figure) -> { fadeMats, chestY, glowColor, animate(dt,t,f,playerPos,groupPos) }
// ============================================================
import * as THREE from 'three';
import { CONFIG } from '../../config.js';
import { fadeMat, stackedLimb, angDelta } from './primitives.js';

export function buildZone2Guardian(figure) {
  const glow = 0xbfff8f;                    // amber-green spectral glow
  const matBody = fadeMat(0x2c4a1e, glow, 0.5, 0.9, 0.6, 0.15);
  const matGlow = fadeMat(glow, glow, 2.2, 0.96, 0.3, 0.1);
  const fadeMats = [[matBody, 0.9], [matGlow, 0.96]];
  const moteGeo = new THREE.SphereGeometry(0.14, 10, 8);

  // --- Slender vertical body: a tall tapered stack rising from a small base ---
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.0, 0.6, 8), matBody);
  base.position.y = 0.3;
  figure.add(base);

  const spire = stackedLimb(matBody, 5.0, 0.18, 0.55, 5);   // narrow top, wider bottom
  spire.position.y = 5.4;                  // pivots at top → segments fill down to base
  figure.add(spire);

  // --- Glowing crown orb (the focal bloom element) ---
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), matGlow);
  crown.position.y = 5.6;
  figure.add(crown);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.06, 8, 20), matGlow);
  halo.position.y = 5.6;
  halo.rotation.x = Math.PI / 2;
  figure.add(halo);

  // --- Orbiting motes around the crown (animated each frame) ---
  const orbits = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(moteGeo, matGlow);
    m.scale.setScalar(0.6 + Math.random() * 0.5);
    figure.add(m);
    orbits.push({
      mesh: m,
      r: 0.9 + Math.random() * 0.5,
      y: 5.0 + Math.random() * 1.2,
      ang: Math.random() * Math.PI * 2,
      speed: 0.8 + Math.random() * 0.7,
    });
  }

  return {
    fadeMats,
    chestY: 3.0,
    glowColor: glow,
    animate(dt, t, f, playerPos, groupPos) {
      // Bob, slowly rotate to face the player, sway, pulse the crown, orbit motes.
      figure.position.y = CONFIG.WATER_LEVEL + Math.sin(t * 1.0) * 0.16;
      const yaw = Math.atan2(playerPos.x - groupPos.x, playerPos.z - groupPos.z);
      figure.rotation.y += angDelta(figure.rotation.y, yaw) * Math.min(1, dt * 2.0);

      spire.rotation.z = Math.sin(t * 0.8) * 0.05;
      crown.rotation.y += dt * 0.6;
      matGlow.emissiveIntensity = (2.0 + Math.sin(t * 2.2) * 0.6) * f;

      for (const o of orbits) {
        o.ang += dt * o.speed;
        o.mesh.position.set(Math.cos(o.ang) * o.r, o.y + Math.sin(t * 1.6) * 0.18, Math.sin(o.ang) * o.r);
      }
    },
  };
}
