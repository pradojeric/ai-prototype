// ============================================================
// SCATTER HEX — The Reveler's shotgun spread of one-shot hexes (Arena 2 boss).
//
// The House of the Dead magician's fireball fan: a wide spray that hangs scattered
// across the view, holds for a staggered beat, then drifts in at the bangka. The
// player cannot move, so there is exactly one answer — clear the screen before it
// closes. Each hex dies to a single bolt, which makes this a target-acquisition
// drill rather than a damage race.
//
// Deliberately its own pool rather than a mode on RevelerProjectilePool: those orbs
// are REFLECTED (orange, shot back at the boss) and these are DESTROYED (violet,
// popped where they float). Sharing slots would blur the one colour rule the fight
// teaches, and a mid-formation scatter could starve the boss's own orbs.
// ============================================================
import * as THREE from 'three';
import { CONFIG, COMBAT, RAIL_ARENA } from '../../../config.js';

const HEX_RADIUS = 0.42;      // generous: these are small and must stay snappy to pop
const BOAT_HIT_RADIUS = 1;

export class ScatterHex {
  /**
   * @param {THREE.Scene} scene
   * @param {any} combat  the arena's CombatManager (bolts, vfx, hud, damage door)
   * @param {any} audio
   * @param {object} tuning  the boss's SCATTER block
   */
  constructor(scene, combat, audio, tuning, capacity = 24) {
    this.scene = scene;
    this.combat = combat;
    this.audio = audio;
    this.tuning = tuning;

    this._coreGeo = new THREE.OctahedronGeometry(0.26, 0);
    this._ringGeo = new THREE.TorusGeometry(0.36, 0.04, 5, 14);
    this._coreMat = new THREE.MeshStandardMaterial({
      color: 0xc79bff, emissive: 0x8b4dff, emissiveIntensity: 2.1, roughness: 0.4,
    });
    this._ringMat = new THREE.MeshBasicMaterial({
      color: 0xe4c8ff, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });

    this.slots = [];
    for (let i = 0; i < capacity; i++) {
      const group = new THREE.Group();
      group.visible = false;
      group.add(new THREE.Mesh(this._coreGeo, this._coreMat));
      const ring = new THREE.Mesh(this._ringGeo, this._ringMat);
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
      scene.add(group);
      this.slots.push({
        active: false, hold: 0, age: 0, life: 0, spin: 0, group,
        velocity: new THREE.Vector3(),
      });
    }

    this._dir = new THREE.Vector3();
  }

  get busy() {
    for (const slot of this.slots) if (slot.active) return true;
    return false;
  }

  /**
   * Scatter `count` hexes across the lane ahead of the boat.
   * @param {number} count
   * @param {() => number} rng
   */
  spawn(count, rng) {
    const [zNear, zFar] = this.tuning.Z_RANGE;
    let spawned = 0;
    for (const slot of this.slots) {
      if (spawned >= count) break;
      if (slot.active) continue;
      // A plain slab across the lane, not a ring: the player is looking straight
      // down it, so uniform world spread reads as uniform SCREEN spread — which
      // is the sensation this pattern is copying.
      slot.group.position.set(
        (rng() * 2 - 1) * RAIL_ARENA.RIVER_X_LIMIT,
        CONFIG.WATER_LEVEL + this.tuning.Y_RANGE[0]
          + rng() * (this.tuning.Y_RANGE[1] - this.tuning.Y_RANGE[0]),
        zNear + rng() * (zFar - zNear),
      );
      slot.active = true;
      slot.hold = this.tuning.HOLD[0] + rng() * (this.tuning.HOLD[1] - this.tuning.HOLD[0]);
      slot.age = 0;
      slot.life = this.tuning.LIFE;
      slot.spin = 1.5 + rng() * 2.5;
      slot.velocity.set(0, 0, 0);
      slot.group.scale.setScalar(0.2);
      slot.group.visible = true;
      spawned++;
    }
    if (spawned > 0) this.audio?.playScatter?.();
    return spawned;
  }

  /** @param {THREE.Vector3} boatTarget */
  update(dt, boatTarget) {
    for (const slot of this.slots) {
      if (!slot.active) continue;
      slot.age += dt;
      slot.group.rotation.x += slot.spin * dt;
      slot.group.rotation.y += slot.spin * 1.3 * dt;

      if (slot.hold > 0) {
        slot.hold -= dt;
        // Swell into place while held, so a hex is readable before it commits.
        slot.group.scale.setScalar(0.2 + Math.min(1, slot.age / 0.4) * 0.8);
        if (slot.hold > 0) continue;
        slot.group.scale.setScalar(1);
        this._dir.copy(boatTarget).sub(slot.group.position).normalize();
        slot.velocity.copy(this._dir).multiplyScalar(this.tuning.SPEED);
      }

      slot.life -= dt;
      slot.group.position.addScaledVector(slot.velocity, dt);
      if (slot.life <= 0) { this._deactivate(slot); continue; }
      if (slot.group.position.distanceToSquared(boatTarget) > BOAT_HIT_RADIUS ** 2) continue;
      this.combat.vfx.projectileImpact(slot.group.position);
      this.combat.damage(this.tuning.DAMAGE, slot.group.position);
      this._deactivate(slot);
    }
    this._checkPlayerBolts();
  }

  // One bolt, one hex. The bolt is spent either way, so a clean sweep still costs
  // the same ammo rhythm as a sloppy one.
  _checkPlayerBolts() {
    const hitRadiusSq = (HEX_RADIUS + COMBAT.BOLT.RADIUS) ** 2;
    for (const bolt of this.combat.bolts.slots) {
      if (!bolt.active) continue;
      for (const slot of this.slots) {
        if (!slot.active) continue;
        if (bolt.mesh.position.distanceToSquared(slot.group.position) > hitRadiusSq) continue;
        this.combat.bolts.deactivate(bolt);
        this.combat.vfx.impact(slot.group.position, 'bolt');
        this.combat.hud.hitMarker();
        this.audio?.playHit?.();
        this._deactivate(slot);
        break;
      }
    }
  }

  _deactivate(slot) {
    slot.active = false;
    slot.group.visible = false;
    slot.velocity.set(0, 0, 0);
  }

  clear() { for (const slot of this.slots) this._deactivate(slot); }

  dispose() {
    this.clear();
    for (const slot of this.slots) this.scene.remove(slot.group);
    this.slots.length = 0;
    this._coreGeo.dispose();
    this._ringGeo.dispose();
    this._coreMat.dispose();
    this._ringMat.dispose();
  }
}
