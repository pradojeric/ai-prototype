// ============================================================
// REVELER PROJECTILE POOL — fixed boss-orb pool for Arena 2. Orbs form around
// The Reveler, charge, wait out independent launch delays, fire at the boat,
// or home back into the boss after any player-bolt reflection.
// ============================================================
import * as THREE from 'three';
import { COMBAT } from '../../config.js';

const ORB_RADIUS = 0.48;
const BOAT_HIT_RADIUS = 0.9;
const RETURN_HIT_RADIUS = 0.8;
const CHARGE_TIME = 2;
const OUTBOUND_SPEED = 11;
const RETURN_SPEED = 16;
const ORB_LIFE = 4;

export class RevelerProjectilePool {
  constructor(scene, combat, audio, onReflectedHit, capacity = 8) {
    this.scene = scene;
    this.combat = combat;
    this.audio = audio;
    this.onReflectedHit = onReflectedHit;
    this._time = 0;
    this._coreGeometry = new THREE.IcosahedronGeometry(0.28, 1);
    this._ringGeometry = new THREE.TorusGeometry(0.43, 0.045, 6, 18);
    this._vDirection = new THREE.Vector3();
    this.slots = [];

    for (let i = 0; i < capacity; i++) {
      const group = new THREE.Group();
      group.visible = false;
      const coreMaterial = new THREE.MeshStandardMaterial({
        color: 0xff8b55,
        emissive: 0xff5d3a,
        emissiveIntensity: 1.7,
        roughness: 0.35,
      });
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0xffcf78,
        transparent: true,
        opacity: 0.82,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      group.add(new THREE.Mesh(this._coreGeometry, coreMaterial));
      const ringA = new THREE.Mesh(this._ringGeometry, ringMaterial);
      const ringB = new THREE.Mesh(this._ringGeometry, ringMaterial);
      ringA.rotation.x = Math.PI / 2;
      ringB.rotation.y = Math.PI / 2;
      group.add(ringA, ringB);
      scene.add(group);
      this.slots.push({
        active: false,
        state: 'inactive',
        group,
        coreMaterial,
        ringMaterial,
        angle: 0,
        orbitSpeed: 0,
        chargeAge: 0,
        launchDelay: 0,
        life: 0,
        velocity: new THREE.Vector3(),
        target: new THREE.Vector3(),
        source: new THREE.Vector3(),
      });
    }
  }

  get hasActive() {
    for (const slot of this.slots) if (slot.active) return true;
    return false;
  }

  spawnFormation(count, rng) {
    if (this.hasActive) return 0;
    const available = Math.max(0, Math.min(count, this.slots.length));
    const offset = rng() * Math.PI * 2;
    for (let i = 0; i < available; i++) {
      const slot = this.slots[i];
      slot.active = true;
      slot.state = 'charging';
      slot.angle = offset + (i / available) * Math.PI * 2;
      slot.orbitSpeed = 0.28 + rng() * 0.18;
      slot.chargeAge = 0;
      slot.launchDelay = rng() * 0.9;
      slot.life = ORB_LIFE;
      slot.velocity.set(0, 0, 0);
      slot.group.scale.setScalar(0.35);
      slot.group.visible = true;
      this._setReflectedLook(slot, false);
    }
    if (available > 0) this.audio?.playLanternThrow?.();
    return available;
  }

  update(dt, bossCenter, boatTarget) {
    this._time += dt;
    for (const slot of this.slots) {
      if (!slot.active) continue;
      if (slot.state === 'charging' || slot.state === 'queued') {
        this._updateFormationSlot(slot, dt, bossCenter, boatTarget);
      } else if (slot.state === 'fired') {
        this._updateFired(slot, dt, boatTarget);
      } else if (slot.state === 'reflected') {
        this._updateReflected(slot, dt, bossCenter);
      }
    }
    this._checkPlayerBolts();
  }

  _updateFormationSlot(slot, dt, bossCenter, boatTarget) {
    slot.angle += slot.orbitSpeed * dt;
    slot.group.position.set(
      bossCenter.x + Math.cos(slot.angle) * 1.8,
      bossCenter.y + Math.sin(slot.angle) * 1.25,
      bossCenter.z + 0.55 + Math.sin(slot.angle * 1.7) * 0.28,
    );
    slot.group.rotation.x += dt * 1.8;
    slot.group.rotation.y += dt * 2.6;

    if (slot.state === 'charging') {
      slot.chargeAge += dt;
      const charge = Math.min(1, slot.chargeAge / CHARGE_TIME);
      const pulse = 1 + Math.sin(this._time * 8 + slot.angle) * 0.08 * charge;
      slot.group.scale.setScalar((0.35 + charge * 0.65) * pulse);
      slot.coreMaterial.emissiveIntensity = 1.4 + charge * 1.8;
      if (slot.chargeAge >= CHARGE_TIME) slot.state = 'queued';
      return;
    }

    slot.launchDelay -= dt;
    if (slot.launchDelay > 0) return;
    slot.state = 'fired';
    slot.life = ORB_LIFE;
    slot.target.copy(boatTarget);
    slot.source.copy(bossCenter);
    slot.velocity.copy(slot.target).sub(slot.group.position).normalize()
      .multiplyScalar(OUTBOUND_SPEED);
  }

  _updateFired(slot, dt, boatTarget) {
    slot.life -= dt;
    slot.group.position.addScaledVector(slot.velocity, dt);
    slot.group.rotation.x += dt * 5;
    slot.group.rotation.y += dt * 7;
    if (slot.life <= 0) { this._deactivate(slot); return; }
    if (slot.group.position.distanceToSquared(boatTarget) > BOAT_HIT_RADIUS ** 2) return;
    this.combat.vfx.projectileImpact(slot.group.position);
    this.combat.damage(15, slot.source);
    this._deactivate(slot);
  }

  _updateReflected(slot, dt, bossCenter) {
    slot.life -= dt;
    this._vDirection.copy(bossCenter).sub(slot.group.position);
    const distanceSq = this._vDirection.lengthSq();
    if (distanceSq <= RETURN_HIT_RADIUS ** 2) {
      this.onReflectedHit?.(slot.group.position);
      this._deactivate(slot);
      return;
    }
    slot.velocity.copy(this._vDirection).normalize().multiplyScalar(RETURN_SPEED);
    slot.group.position.addScaledVector(slot.velocity, dt);
    slot.group.rotation.x += dt * 7;
    slot.group.rotation.y += dt * 9;
    if (slot.life <= 0) this._deactivate(slot);
  }

  _checkPlayerBolts() {
    const hitRadiusSq = (ORB_RADIUS + COMBAT.BOLT.RADIUS) ** 2;
    for (const bolt of this.combat.bolts.slots) {
      if (!bolt.active) continue;
      for (const slot of this.slots) {
        if (!slot.active || slot.state === 'reflected') continue;
        if (bolt.mesh.position.distanceToSquared(slot.group.position) > hitRadiusSq) continue;
        this.combat.bolts.deactivate(bolt);
        slot.state = 'reflected';
        slot.life = 2.5;
        this._setReflectedLook(slot, true);
        this.combat.vfx.impact(slot.group.position, 'bolt');
        this.combat.hud.hitMarker();
        this.audio?.playBoltReflect?.();
        break;
      }
    }
  }

  _setReflectedLook(slot, reflected) {
    slot.coreMaterial.color.setHex(reflected ? 0x7fe8ff : 0xff8b55);
    slot.coreMaterial.emissive.setHex(reflected ? 0x38b7ca : 0xff5d3a);
    slot.coreMaterial.emissiveIntensity = reflected ? 2.8 : 1.7;
    slot.ringMaterial.color.setHex(reflected ? 0xb9ffff : 0xffcf78);
  }

  _deactivate(slot) {
    slot.active = false;
    slot.state = 'inactive';
    slot.group.visible = false;
    slot.velocity.set(0, 0, 0);
  }

  reset() {
    for (const slot of this.slots) this._deactivate(slot);
  }

  dispose() {
    for (const slot of this.slots) {
      this.scene.remove(slot.group);
      slot.coreMaterial.dispose();
      slot.ringMaterial.dispose();
    }
    this._coreGeometry.dispose();
    this._ringGeometry.dispose();
    this.slots.length = 0;
  }
}
