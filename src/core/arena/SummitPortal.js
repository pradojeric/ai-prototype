// ============================================================
// SUMMIT PORTAL — the way out of the Memory Tower.
//
// Arena 3's summit used to be the Keeper's boss deck; it is now a doorway. Once
// all three bugtong seals are open the portal lights and the player simply walks
// into it to be carried to arena3boss, where the Keeper waits (see
// Game._transferArena).
//
// The swirl panel reuses the hub portal's shader (PortalVortex), the same one
// behind the museum corridors and the Memory Rift, so every doorway between
// memories reads as the same motif. Built by TowerArenaController rather than by
// the zone module — arena3.js publishes only the anchor, exactly as the seal
// veils are built from authored gate anchors.
// ============================================================
import * as THREE from 'three';
import { createVortexMaterial } from '../../museum/PortalVortex.js';

const PORTAL_W = 3.0;
const PORTAL_H = 4.2;
const FRAME_BAR = 0.5;
const JAMB_HALF_DEPTH = 0.3;
const JAMB_RADIUS = 0.42;         // solid footprint of one stone jamb
const SEALED_OPACITY = 0.16;
const OPEN_FADE_SPEED = 1.6;      // seconds⁻¹ for the seal-break brightening
const HALO_BASE = 2.6;
const HALO_PULSE = 0.5;

export class SummitPortal {
  // `anchor` is arena3.js's authored { x, y, z, rotation, radius }: y is the deck
  // surface, rotation faces the panel back down the entry bridge.
  constructor(scene, anchor) {
    this.scene = scene;
    this.anchor = anchor;
    this.open = false;
    this.entered = false;
    this._lit = 0;                // 0 sealed → 1 fully open, eased over time

    this.group = new THREE.Group();
    this.group.position.set(anchor.x, anchor.y, anchor.z);
    this.group.rotation.y = anchor.rotation || 0;

    this._centerY = PORTAL_H / 2;

    this.vortexMat = createVortexMaterial(PORTAL_W / PORTAL_H);
    this.vortexMat.side = THREE.DoubleSide;
    this.vortexMat.transparent = true;
    this.vortexMat.opacity = SEALED_OPACITY;
    this.panel = new THREE.Mesh(
      new THREE.PlaneGeometry(PORTAL_W, PORTAL_H),
      this.vortexMat,
    );
    this.panel.position.y = this._centerY;
    this.group.add(this.panel);

    // Weathered lighthouse stone around the tear so it reads as built into the
    // summit rather than floating above it.
    this.frameMat = new THREE.MeshStandardMaterial({ color: 0x3d4b57, roughness: 1 });
    const bar = (w, h, x, y) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, JAMB_HALF_DEPTH * 2),
        this.frameMat,
      );
      mesh.position.set(x, this._centerY + y, 0);
      this.group.add(mesh);
      return mesh;
    };
    bar(PORTAL_W + 1.0, FRAME_BAR, 0, PORTAL_H / 2 + 0.1);            // lintel
    bar(PORTAL_W + 1.0, FRAME_BAR, 0, -PORTAL_H / 2 - 0.1);           // sill
    bar(FRAME_BAR, PORTAL_H + 1.0, -PORTAL_W / 2 - 0.25, 0);          // left jamb
    bar(FRAME_BAR, PORTAL_H + 1.0, PORTAL_W / 2 + 0.25, 0);           // right jamb

    this.halo = new THREE.PointLight(0xe5bf63, 0, 18, 1.6);
    this.halo.position.y = this._centerY;
    this.group.add(this.halo);

    scene.add(this.group);

    // Jamb colliders in world space, so the player cannot slip around the frame
    // edge into the panel from behind. The panel itself stays walk-through — it
    // is the trigger.
    const cos = Math.cos(this.group.rotation.y);
    const sin = Math.sin(this.group.rotation.y);
    const lateral = PORTAL_W / 2 + 0.25;
    this._jambs = [-1, 1].map((side) => ({
      x: anchor.x + cos * side * lateral,
      z: anchor.z - sin * side * lateral,
    }));

    this._triggerRadius = anchor.radius || 1.7;
    this._v = new THREE.Vector3();
  }

  // World-space center at chest height — the transfer trigger measures to this.
  center() {
    return this._v.set(this.anchor.x, this.anchor.y + this._centerY, this.anchor.z);
  }

  setOpen(open) {
    if (open === this.open) return;
    this.open = open;
  }

  update(dt, t) {
    this.vortexMat.uniforms.uTime.value = t;
    const target = this.open ? 1 : 0;
    if (this._lit !== target) {
      const step = OPEN_FADE_SPEED * dt;
      this._lit = target > this._lit
        ? Math.min(target, this._lit + step)
        : Math.max(target, this._lit - step);
      this.vortexMat.opacity = SEALED_OPACITY + (1 - SEALED_OPACITY) * this._lit;
    }
    this.halo.intensity = this._lit * (HALO_BASE + Math.sin(t * 2.1) * HALO_PULSE);
  }

  // True once the player has walked into an open portal. Vertical test keeps a
  // player still climbing the top ramp from triggering it from underneath.
  contains(playerPos) {
    if (!this.open || this._lit < 0.85) return false;
    const dx = playerPos.x - this.anchor.x;
    const dz = playerPos.z - this.anchor.z;
    if (dx * dx + dz * dz > this._triggerRadius * this._triggerRadius) return false;
    return Math.abs(playerPos.y - this.anchor.y) < PORTAL_H;
  }

  // Only the two stone jambs are solid; the panel between them is the trigger.
  // Radial like TowerGateManager's veils rather than World's rotated-box test —
  // these are thin posts, and the encounter owns them at runtime.
  collidesPlayerAt(x, z, radius, supportY) {
    if (Number.isFinite(supportY) && Math.abs(supportY - this.anchor.y) > 1.4) return false;
    return this._jambs.some((jamb) => (
      Math.hypot(x - jamb.x, z - jamb.z) < radius + JAMB_RADIUS
    ));
  }

  dispose() {
    this.scene.remove(this.group);
    this.panel.geometry.dispose();
    this.vortexMat.dispose();
    this.frameMat.dispose();
    this.group.traverse((child) => {
      if (child.isMesh && child !== this.panel) child.geometry.dispose();
    });
  }
}
