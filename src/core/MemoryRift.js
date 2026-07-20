// ============================================================
// MEMORY RIFT (Strings v2.0) — the gateway into a zone's Memory Arena.
// Replaces the walk-up Guardian in the main zone: the player wades to this
// glowing tear in the water and interacts to be pulled into the instanced
// combat arena (see Game._enterArena). Purely a placed visual + a proximity
// anchor — Game owns the interaction and the scene transition.
//
// The swirl panel reuses the hub portal's shader (PortalVortex) so open rifts
// and open museum portals read as the same "doorway between memories" motif.
// ============================================================
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createVortexMaterial } from '../museum/PortalVortex.js';

const RIFT_W = 3.0;    // swirl panel width
const RIFT_H = 4.2;    // swirl panel height (standing doorway)

export class MemoryRift {
  // `spot` is the zone's authored { x, z } rift location (world.zone.riftSpot).
  constructor(scene, spot = { x: 0, z: 0 }) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.position.set(spot.x, 0, spot.z);

    // Center height sits at eye level so the doorway reads head-on through fog.
    this._centerY = CONFIG.WATER_LEVEL + RIFT_H / 2;

    // Swirling vortex panel (double-sided so it reads from either approach).
    this.vortexMat = createVortexMaterial(RIFT_W / RIFT_H);
    this.vortexMat.side = THREE.DoubleSide;
    this.panel = new THREE.Mesh(new THREE.PlaneGeometry(RIFT_W, RIFT_H), this.vortexMat);
    this.panel.position.y = this._centerY;
    this.group.add(this.panel);

    // A rough stone/coral frame around the tear so it reads as an object, not a
    // floating sprite. Four thin bars boxing the panel.
    this.frameMat = new THREE.MeshStandardMaterial({ color: 0x24484a, roughness: 1 });
    const bar = (w, h, x, y) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.5), this.frameMat);
      m.position.set(x, this._centerY + y, 0);
      this.group.add(m);
    };
    bar(RIFT_W + 1.0, 0.5, 0, RIFT_H / 2 + 0.1);    // top lintel
    bar(RIFT_W + 1.0, 0.5, 0, -RIFT_H / 2 - 0.1);   // bottom sill
    bar(0.5, RIFT_H + 1.0, -RIFT_W / 2 - 0.25, 0);  // left jamb
    bar(0.5, RIFT_H + 1.0, RIFT_W / 2 + 0.25, 0);   // right jamb

    // Soft cyan halo so the rift lifts off the dark water and draws the eye.
    this.halo = new THREE.PointLight(0x7fe8ff, 2.4, 16, 1.6);
    this.halo.position.y = this._centerY;
    this.group.add(this.halo);

    scene.add(this.group);
    this._v = new THREE.Vector3();
  }

  // World-space center (XZ at eye height) — Game measures player distance to this.
  center() {
    return this._v.set(this.group.position.x, this._centerY, this.group.position.z);
  }

  update(dt, t) {
    this.vortexMat.uniforms.uTime.value = t;
    // Gentle breathing so the halo pulses like the hub portals.
    this.halo.intensity = 2.1 + Math.sin(t * 1.6) * 0.5;
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.vortexMat.dispose();
    this.frameMat.dispose();
  }
}
