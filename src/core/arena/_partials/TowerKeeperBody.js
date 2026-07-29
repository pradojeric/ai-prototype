// ============================================================
// TOWER KEEPER BODY — the Keeper of Memories' physical presence (Arena 3 boss).
//
// The other two bosses are handed a live `Guardian` by their arena and drive it.
// The Keeper has no Guardian to borrow: its arena is a bare summit deck, so it
// builds its own body from the same zone3 builder contract and passes THIS to
// `ArenaBoss`'s `guardian` slot. That is why the class implements exactly the
// three things the shell asks of a guardian — `center()`, `group`, and a per-
// frame `update` — and nothing more.
//
// Fade is the reveal and the death dissolve; `flashHit` is the per-bolt emissive
// kick; `setFlare` is the enrage pulse the boss drives during its invuln window.
// All three write to the same materials, so they are resolved in one pass each
// frame rather than fighting over `emissiveIntensity` from three call sites.
// ============================================================
import * as THREE from 'three';
import { CONFIG } from '../../../config.js';
import { buildZone3Guardian } from '../../guardians/zone3Guardian.js';

const KEEPER_SCALE = 0.62;
const MODEL_FOOT_Y = 0.1;
const HIT_FLASH_DECAY = 0.14;
const HIT_FLASH_GAIN = 1.15;

export class TowerKeeperBody {
  /**
   * @param {THREE.Scene} scene
   * @param {{height: number, combatRadius: number, radius?: number}} bounds
   */
  constructor(scene, bounds) {
    this.scene = scene;
    this.bounds = bounds;
    this.fade = 0;
    this.defeated = false;
    this.group = new THREE.Group();
    this.figure = new THREE.Group();
    this.figure.position.y = CONFIG.WATER_LEVEL;
    this.figure.scale.setScalar(KEEPER_SCALE);
    this.group.add(this.figure);
    this.model = buildZone3Guardian(this.figure);

    this._hitFlash = 0;
    this._flare = 0;
    // Only materials that actually carry an emissive term can be flashed; the
    // base value is captured once so every frame can restore it before adding.
    this._flashMats = [];
    for (const [material] of this.model.fadeMats) {
      if (typeof material.emissiveIntensity !== 'number') continue;
      this._flashMats.push({ material, base: material.emissiveIntensity });
    }

    this.group.position.set(
      0,
      bounds.height - CONFIG.WATER_LEVEL - MODEL_FOOT_Y * KEEPER_SCALE,
      0,
    );
    this.group.visible = false;
    this._center = new THREE.Vector3();
    this._applyFade(0);
    scene.add(this.group);
  }

  _applyFade(fade) {
    for (const [material, baseOpacity] of this.model.fadeMats) {
      material.opacity = baseOpacity * fade;
    }
  }

  show() {
    this.defeated = false;
    this._hitFlash = 0;
    this.group.visible = true;
  }

  flashHit() {
    this._hitFlash = 1;
  }

  // Enrage pulse, as a scale delta around the resting scale. The boss owns the
  // timing; the body only owns what the pulse looks like.
  setFlare(amount) {
    this._flare = amount;
    this.figure.scale.setScalar(KEEPER_SCALE * (1 + amount));
  }

  update(dt, t, playerPos) {
    if (!this.group.visible) return;
    const targetFade = this.defeated ? 0 : 1;
    this.fade = THREE.MathUtils.damp(this.fade, targetFade, this.defeated ? 3 : 5, dt);
    this._applyFade(this.fade);

    this.model.animate(dt, t, this.fade, playerPos, this.group.position);

    // Single resolve: decay the flash, then write base + boost once per material
    // so the reveal fade and the hit kick never stomp each other.
    this._hitFlash = Math.max(0, this._hitFlash - dt / HIT_FLASH_DECAY);
    const boost = this._hitFlash * HIT_FLASH_GAIN;
    for (const entry of this._flashMats) {
      entry.material.emissiveIntensity = entry.base + boost;
    }

    if (this.defeated && this.fade < 0.015) this.group.visible = false;
  }

  // Chest height in world space, scratch-backed — the boss calls this every frame
  // for aim origins, callout anchors, and VFX.
  center() {
    return this._center.set(
      this.group.position.x,
      this.group.position.y + this.figure.position.y + this.model.chestY * KEEPER_SCALE,
      this.group.position.z,
    );
  }

  dispose() {
    this.scene.remove(this.group);
    const geometries = new Set();
    const materials = new Set();
    this.group.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      if (Array.isArray(object.material)) {
        for (const material of object.material) materials.add(material);
      } else if (object.material) {
        materials.add(object.material);
      }
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
  }
}
