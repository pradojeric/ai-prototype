// ============================================================
// GUARDIAN SOUL (Strings v2.0) — the trophy a defeated arena Guardian leaves in
// the main zone. It drops alongside the scattered artifacts on return; walking
// over it collects it (stored in Game.collectedSouls). Gathering all three Souls
// and placing them on the museum pedestal triggers the Final Memory (a later
// phase). This class owns only the floating collectible + its walk-over test.
// ============================================================
import * as THREE from 'three';
import { CONFIG } from '../config.js';

const PICKUP_RADIUS = 2.0;   // walk within this (XZ) to collect
const HOVER = 1.4;           // rest height above the water

export class GuardianSoul {
  // `zone` is the main-zone id this soul belongs to ('zone1'); `pos` is where it
  // rests (the scatter origin). `onCollect(zone)` fires once on pickup.
  constructor(scene, zone, pos, onCollect) {
    this.scene = scene;
    this.zone = zone;
    this.onCollect = onCollect;
    this.collected = false;
    this.pos = new THREE.Vector3(pos.x, CONFIG.WATER_LEVEL + HOVER, pos.z);

    this.group = new THREE.Group();
    this.group.position.copy(this.pos);

    // A bright faceted core in a slowly counter-rotating cage — reads as a
    // captured spirit, distinct from the warm amber artifacts (cool cyan-white).
    this.coreMat = new THREE.MeshStandardMaterial({
      color: 0xeafdff, emissive: 0x7fe8ff, emissiveIntensity: 2.2, roughness: 0.3,
    });
    this.core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), this.coreMat);
    this.group.add(this.core);

    this.cageMat = new THREE.MeshStandardMaterial({
      color: 0x2f6f6a, emissive: 0x0a2a2a, roughness: 0.6,
      transparent: true, opacity: 0.55,
    });
    this.cage = new THREE.Mesh(new THREE.TorusKnotGeometry(0.62, 0.05, 64, 6), this.cageMat);
    this.group.add(this.cage);

    this.halo = new THREE.PointLight(0x7fe8ff, 2.2, 10, 1.6);
    this.group.add(this.halo);

    scene.add(this.group);
    this._v = new THREE.Vector3();
  }

  // Per-frame idle + walk-over pickup. Returns true on the frame it is collected.
  update(dt, t, playerPos) {
    if (this.collected) return false;
    this.group.position.y = this.pos.y + Math.sin(t * 1.6) * 0.16;
    this.core.rotation.y = t * 0.8;
    this.cage.rotation.set(t * 0.5, -t * 0.4, t * 0.3);
    this.coreMat.emissiveIntensity = 2.0 + Math.sin(t * 3) * 0.5;
    this.halo.intensity = 2.0 + Math.sin(t * 3) * 0.5;

    const dx = playerPos.x - this.pos.x, dz = playerPos.z - this.pos.z;
    if (dx * dx + dz * dz <= PICKUP_RADIUS * PICKUP_RADIUS) {
      this.collected = true;
      this.onCollect?.(this.zone);
      this.dispose();
      return true;
    }
    return false;
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.coreMat.dispose();
    this.cageMat.dispose();
  }
}
