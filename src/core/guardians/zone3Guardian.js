// ============================================================
// ZONE 3 GUARDIAN — PLACEHOLDER (low many-eyed mass)
// A squat, wide violet-blue mound studded with glowing eyes that blink and a
// slow drifting wobble. Built deliberately UNLIKE both the Zone-1 golem and the
// Zone-2 spire (broad + low + eyed vs. bulky humanoid / slim spire) so each
// per-zone guardian reads as distinct. Swap for a designed body later.
//
// Returns the shared builder contract the Guardian shell drives:
//   build(figure) -> { fadeMats, chestY, glowColor, animate(dt,t,f,playerPos,groupPos) }
// ============================================================
import * as THREE from 'three';
import { CONFIG } from '../../config.js';
import { fadeMat, angDelta } from './primitives.js';

export function buildZone3Guardian(figure) {
  const glow = 0xb98fff;                    // violet-blue spectral glow
  const matBody = fadeMat(0x241c40, glow, 0.4, 0.9, 0.7, 0.1);
  const matGlow = fadeMat(glow, glow, 2.2, 0.96, 0.3, 0.1);
  const fadeMats = [[matBody, 0.9], [matGlow, 0.96]];
  const eyeGeo = new THREE.SphereGeometry(0.22, 12, 10);

  // --- Broad, low mound body: a squashed dome on a wide skirt ---
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.9, 1.2, 12), matBody);
  skirt.position.y = 0.6;
  figure.add(skirt);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.3, 16, 12), matBody);
  dome.scale.set(1, 0.7, 1);
  dome.position.y = 1.4;
  figure.add(dome);

  // --- Glowing eyes studded over the front of the dome (blink each frame) ---
  const eyes = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7 - 0.5) * Math.PI * 1.1;       // fan across the front (+Z)
    const tilt = 0.2 + Math.random() * 0.7;
    const r = 2.0;
    const eye = new THREE.Mesh(eyeGeo, matGlow);
    eye.position.set(Math.sin(a) * r, 1.4 + Math.sin(tilt) * 1.3, Math.cos(a) * r * 0.9 + 0.4);
    eye.scale.setScalar(0.7 + Math.random() * 0.6);
    figure.add(eye);
    eyes.push({ mesh: eye, phase: Math.random() * Math.PI * 2, base: eye.scale.x });
  }

  return {
    fadeMats,
    chestY: 2.2,
    glowColor: glow,
    animate(dt, t, f, playerPos, groupPos) {
      // Low bob, slow turn to face the player, pulse glow, blink the eyes.
      figure.position.y = CONFIG.WATER_LEVEL + Math.sin(t * 0.9) * 0.1;
      const yaw = Math.atan2(playerPos.x - groupPos.x, playerPos.z - groupPos.z);
      figure.rotation.y += angDelta(figure.rotation.y, yaw) * Math.min(1, dt * 1.6);

      matGlow.emissiveIntensity = (2.0 + Math.sin(t * 1.8) * 0.5) * f;
      for (const e of eyes) {
        // squash to a slit then reopen — a staggered blink
        const blink = 0.5 + 0.5 * Math.sin(t * 1.3 + e.phase);
        e.mesh.scale.y = e.base * Math.max(0.12, blink);
      }
    },
  };
}
