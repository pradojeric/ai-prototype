import * as THREE from 'three';
import { CONFIG, TOWER_ARENA, mulberry32 } from '../../config.js';
import { buildZone3Guardian } from '../guardians/zone3Guardian.js';
import { ArenaBoss } from './ArenaBoss.js';

const KEEPER_SCALE = 0.62;
const MODEL_FOOT_Y = 0.1;
const CHARGE_HIT_RADIUS = 1.35;
const HIT_FLASH_DECAY = 0.14;
const HIT_FLASH_GAIN = 1.15;
const DEBRIS_POOL_SIZE = 9;

export const TOWER_KEEPER_TUNING = {
  HP: 200,
  VFX_STYLE: 'zone3',
  HIT_RADIUS: 2.3,
  PHASE_THRESHOLDS: [0.66, 0.33],
  ENRAGE_INVULN: 1,
  SHOT_DAMAGE: 10,
  SHOT_KNOCKBACK: 3.6,
  SHOT_SPEED: 10,
  SHOT_TELEGRAPH: 0.45,
  SHOT_INTERVAL: [2.2, 1.75, 1.35],
  CHARGE_INTERVAL: [[6.2, 7.8], [5.1, 6.7], [4, 5.5]],
  CHARGE_TELEGRAPH: 0.9,
  CHARGE_SPEED: 13.5,
  CHARGE_DAMAGE: 24,
  CHARGE_KNOCKBACK: 6.5,
  CHARGE_HIT_RECOVERY: 0.9,
  CHARGE_MISS_STUN: [2, 3],
  DEBRIS_INTERVAL: [[7, 8.5], [5.8, 7.3], [4.7, 6.2]],
  DEBRIS_COUNT: [5, 7, 9],
  DEBRIS_TELEGRAPH: 1.15,
  DEBRIS_STAGGER: 0.16,
  DEBRIS_FALL_SPEED: 12,
  DEBRIS_DAMAGE: 16,
  DEBRIS_RADIUS: 1.15,
  DEBRIS_POWERUP_WAVE_CHANCE: 0.5,
  BEAM_INTERVAL: [[9.5, 12], [7.8, 10.2], [6.2, 8.5]],
  BEAM_TELEGRAPH: 1.1,
  BEAM_DURATION: [3.2, 3.7, 4.2],
  BEAM_SPEED: [1.25, 1.45, 1.65],
  BEAM_COUNT: [1, 1, 2],
  BEAM_WIDTH: 0.78,
  BEAM_DAMAGE: 12,
  BEAM_HIT_COOLDOWN: 0.65,
};

class TowerKeeperBody {
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
    this._flashMats = [];
    for (const [material] of this.model.fadeMats) {
      if (typeof material.emissiveIntensity !== 'number') continue;
      this._flashMats.push({
        material,
        base: material.emissiveIntensity,
      });
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
    for (const entry of this._flashMats) {
      entry.material.emissiveIntensity = entry.base + HIT_FLASH_GAIN;
    }
  }

  update(dt, t, playerPos) {
    if (!this.group.visible) return;
    const targetFade = this.defeated ? 0 : 1;
    this.fade = THREE.MathUtils.damp(this.fade, targetFade, this.defeated ? 3 : 5, dt);
    this._applyFade(this.fade);
    for (const entry of this._flashMats) {
      entry.material.emissiveIntensity = entry.base;
    }
    this.model.animate(dt, t, this.fade, playerPos, this.group.position);
    this._hitFlash = Math.max(0, this._hitFlash - dt / HIT_FLASH_DECAY);
    const flashBoost = this._hitFlash * HIT_FLASH_GAIN;
    for (const entry of this._flashMats) {
      entry.material.emissiveIntensity += flashBoost;
    }
    if (this.defeated && this.fade < 0.015) this.group.visible = false;
  }

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

export class TowerKeeper extends ArenaBoss {
  constructor(scene, player, combat, audio, options = {}) {
    const bounds = options.bounds || {
      height: TOWER_ARENA.SUMMIT_HEIGHT,
      combatRadius: 6.8,
    };
    const body = new TowerKeeperBody(scene, bounds);
    super(body, combat, audio, player, TOWER_KEEPER_TUNING);
    this.scene = scene;
    this.body = body;
    this.bounds = bounds;
    this.onEvent = options.onEvent || null;
    this.onPowerUpDrop = options.onPowerUpDrop || null;
    this.projectileDamage = this.tuning.SHOT_DAMAGE;
    this.projectileKnockback = this.tuning.SHOT_KNOCKBACK;
    this._rng = mulberry32((options.seed || 1) >>> 0);
    this._state = 'idle';
    this._stateTimer = 0;
    this._shotClock = 1.4;
    this._chargeClock = 8;
    this._debrisClock = 9;
    this._beamClock = 13;
    this._chargeHit = false;
    this._disposed = false;
    this._chargeTarget = new THREE.Vector3();
    this._debrisActive = 0;
    this._debrisDropIndex = -1;
    this._beamHitClock = 0;

    this._laneGeometry = new THREE.BoxGeometry(1, 0.035, 1);
    this._laneMaterial = new THREE.MeshBasicMaterial({
      color: 0xffcf5a,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this._lane = new THREE.Mesh(this._laneGeometry, this._laneMaterial);
    this._lane.visible = false;
    scene.add(this._lane);

    this._debrisGeometry = new THREE.DodecahedronGeometry(0.48, 0);
    this._debrisMaterial = new THREE.MeshStandardMaterial({
      color: 0x73695d,
      roughness: 0.92,
      metalness: 0.05,
    });
    this._debrisWarningGeometry = new THREE.RingGeometry(
      this.tuning.DEBRIS_RADIUS * 0.72,
      this.tuning.DEBRIS_RADIUS,
      28,
    );
    this._debrisWarningMaterial = new THREE.MeshBasicMaterial({
      color: 0xff8b61,
      transparent: true,
      opacity: 0.52,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this._debris = [];
    for (let i = 0; i < DEBRIS_POOL_SIZE; i++) {
      const rock = new THREE.Mesh(this._debrisGeometry, this._debrisMaterial);
      const warning = new THREE.Mesh(
        this._debrisWarningGeometry,
        this._debrisWarningMaterial,
      );
      rock.visible = false;
      warning.visible = false;
      warning.rotation.x = -Math.PI / 2;
      scene.add(rock, warning);
      this._debris.push({
        index: i,
        active: false,
        delay: 0,
        falling: false,
        rock,
        warning,
      });
    }

    this._beamGeometry = new THREE.BoxGeometry(
      this.tuning.BEAM_WIDTH,
      0.035,
      this.bounds.combatRadius * 2,
    );
    this._beamGeometry.translate(0, 0, this.bounds.combatRadius);
    this._beamMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd878,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this._beamPivot = new THREE.Group();
    this._beamMeshes = [];
    for (let i = 0; i < 2; i++) {
      const beam = new THREE.Mesh(this._beamGeometry, this._beamMaterial);
      beam.rotation.y = i * Math.PI;
      beam.visible = false;
      this._beamPivot.add(beam);
      this._beamMeshes.push(beam);
    }
    this._beamPivot.visible = false;
    scene.add(this._beamPivot);
  }

  _randomRange(range) { return range[0] + this._rng() * (range[1] - range[0]); }

  _resetClocks(opening = false) {
    this._shotClock = opening ? 1.4 : this.tuning.SHOT_INTERVAL[this.phase];
    this._chargeClock = this._randomRange(this.tuning.CHARGE_INTERVAL[this.phase]);
    this._debrisClock = this._randomRange(this.tuning.DEBRIS_INTERVAL[this.phase]);
    this._beamClock = this._randomRange(this.tuning.BEAM_INTERVAL[this.phase]);
  }

  begin() {
    if (this.active || this.defeated) return false;
    this.body.show();
    this._state = 'idle';
    this._stateTimer = 0;
    this._resetClocks(true);
    super.begin();
    return true;
  }

  _fire(playerPos) {
    const direction = this.aimAt(playerPos);
    this.combat.spits.fire(
      this._center,
      direction,
      this.tuning.SHOT_SPEED,
      4,
      { source: this },
    );
  }

  _showChargeLane() {
    const group = this.body.group;
    const dx = this._chargeTarget.x - group.position.x;
    const dz = this._chargeTarget.z - group.position.z;
    const length = Math.max(0.01, Math.hypot(dx, dz));
    this._lane.position.set(
      (group.position.x + this._chargeTarget.x) / 2,
      this.bounds.height + 0.08,
      (group.position.z + this._chargeTarget.z) / 2,
    );
    this._lane.rotation.y = Math.atan2(dx, dz);
    this._lane.scale.set(1.05, 1, length);
    this._lane.visible = true;
  }

  _startCharge(playerPos) {
    const group = this.body.group;
    const radius = Math.hypot(playerPos.x, playerPos.z);
    const clamp = radius > this.bounds.combatRadius
      ? this.bounds.combatRadius / radius
      : 1;
    this._chargeTarget.set(playerPos.x * clamp, group.position.y, playerPos.z * clamp);
    this._dir.copy(this._chargeTarget).sub(group.position).setY(0);
    const length = this._dir.length();
    if (length < 0.5) {
      this._chargeClock = 1;
      return;
    }
    this._dir.multiplyScalar(1 / length);
    this._state = 'charge-telegraph';
    this._stateTimer = this.tuning.CHARGE_TELEGRAPH;
    this._chargeClock = this._randomRange(this.tuning.CHARGE_INTERVAL[this.phase]);
    this._chargeHit = false;
    this._showChargeLane();
    this.combat.vfx.keeperPulse(this.center(), 'telegraph');
    this.onEvent?.('Gold lane locked · evade the Keeper', 'warning');
  }

  _beginRecovery(missed = false) {
    this._state = 'recovery';
    this._stateTimer = missed
      ? this._randomRange(this.tuning.CHARGE_MISS_STUN)
      : this.tuning.CHARGE_HIT_RECOVERY;
    this._lane.visible = false;
    if (missed) {
      this.combat.vfx.keeperPulse(this.center(), 'hit');
      this.onEvent?.(`Charge missed · Keeper stunned ${this._stateTimer.toFixed(1)}s`, 'success');
    }
  }

  _updateCharge(dt, playerPos) {
    const group = this.body.group;
    const remaining = Math.hypot(
      this._chargeTarget.x - group.position.x,
      this._chargeTarget.z - group.position.z,
    );
    const step = Math.min(remaining, this.tuning.CHARGE_SPEED * dt);
    group.position.addScaledVector(this._dir, step);
    const radius = Math.hypot(group.position.x, group.position.z);
    if (radius > this.bounds.combatRadius) {
      const clamp = this.bounds.combatRadius / radius;
      group.position.x *= clamp;
      group.position.z *= clamp;
    }

    if (!this._chargeHit && Math.hypot(
      playerPos.x - group.position.x,
      playerPos.z - group.position.z,
    ) <= CHARGE_HIT_RADIUS) {
      this._chargeHit = true;
      this.combat.damage(this.tuning.CHARGE_DAMAGE, group.position);
      this.player.applyKnockback(
        playerPos.x - group.position.x,
        playerPos.z - group.position.z,
        this.tuning.CHARGE_KNOCKBACK,
      );
      this.combat.vfx.keeperPulse(this.center(), 'hit');
    }
    if (remaining <= 0.03) this._beginRecovery(!this._chargeHit);
  }

  _startDebris() {
    const count = this.tuning.DEBRIS_COUNT[this.phase];
    const radius = this.bounds.combatRadius - this.tuning.DEBRIS_RADIUS;
    this._debrisActive = count;
    this._debrisDropIndex = this._rng() < this.tuning.DEBRIS_POWERUP_WAVE_CHANCE
      ? Math.floor(this._rng() * count)
      : -1;
    for (let i = 0; i < count; i++) {
      const slot = this._debris[i];
      const angle = this._rng() * Math.PI * 2;
      const distance = Math.sqrt(this._rng()) * radius;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      slot.active = true;
      slot.falling = false;
      slot.delay = this.tuning.DEBRIS_TELEGRAPH + i * this.tuning.DEBRIS_STAGGER;
      slot.warning.position.set(x, this.bounds.height + 0.055, z);
      slot.warning.scale.setScalar(0.7);
      slot.warning.visible = true;
      slot.rock.position.set(x, this.bounds.height + 8, z);
      slot.rock.rotation.set(this._rng() * Math.PI, this._rng() * Math.PI, 0);
      slot.rock.visible = false;
    }
    this._state = 'debris';
    this._debrisClock = this._randomRange(this.tuning.DEBRIS_INTERVAL[this.phase]);
    this.onEvent?.('Falling memory-stones · watch the warning circles', 'warning');
  }

  _updateDebris(dt, playerPos) {
    for (const slot of this._debris) {
      if (!slot.active) continue;
      if (!slot.falling) {
        slot.delay -= dt;
        const pulse = 0.88 + Math.sin(slot.delay * 16) * 0.12;
        slot.warning.scale.setScalar(pulse);
        if (slot.delay > 0) continue;
        slot.falling = true;
        slot.rock.visible = true;
      }
      slot.rock.position.y -= this.tuning.DEBRIS_FALL_SPEED * dt;
      slot.rock.rotation.x += dt * 5;
      slot.rock.rotation.z += dt * 3.5;
      if (slot.rock.position.y > this.bounds.height + 0.48) continue;

      const impact = slot.warning.position;
      if (Math.hypot(playerPos.x - impact.x, playerPos.z - impact.z) <=
          this.tuning.DEBRIS_RADIUS) {
        this.combat.damage(this.tuning.DEBRIS_DAMAGE, impact);
        this.player.applyKnockback(
          playerPos.x - impact.x,
          playerPos.z - impact.z,
          3.5,
        );
      }
      this.combat.vfx.keeperPulse(impact, 'hit');
      if (slot.index === this._debrisDropIndex) {
        this._center.set(impact.x, this.bounds.height + 0.35, impact.z);
        this.onPowerUpDrop?.(this._center);
      }
      slot.active = false;
      slot.rock.visible = false;
      slot.warning.visible = false;
      this._debrisActive--;
    }
    if (this._debrisActive <= 0) this._state = 'idle';
  }

  _clearDebris() {
    this._debrisActive = 0;
    for (const slot of this._debris) {
      slot.active = false;
      slot.rock.visible = false;
      slot.warning.visible = false;
    }
  }

  _startBeam() {
    const group = this.body.group;
    this._beamPivot.position.set(
      group.position.x,
      this.bounds.height + 0.075,
      group.position.z,
    );
    this._beamPivot.rotation.y = this._rng() * Math.PI * 2;
    this._beamPivot.visible = true;
    const count = this.tuning.BEAM_COUNT[this.phase];
    for (let i = 0; i < this._beamMeshes.length; i++) {
      this._beamMeshes[i].visible = i < count;
    }
    this._beamMaterial.opacity = 0.18;
    this._beamHitClock = 0;
    this._state = 'beam-telegraph';
    this._stateTimer = this.tuning.BEAM_TELEGRAPH;
    this._beamClock = this._randomRange(this.tuning.BEAM_INTERVAL[this.phase]);
    this.onEvent?.('Lighthouse sweep charging · move with the beam', 'warning');
  }

  _playerInBeam(playerPos) {
    const dx = playerPos.x - this._beamPivot.position.x;
    const dz = playerPos.z - this._beamPivot.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance > this.bounds.combatRadius * 2 || distance < 0.35) return false;
    const playerAngle = Math.atan2(dx, dz);
    const count = this.tuning.BEAM_COUNT[this.phase];
    for (let i = 0; i < count; i++) {
      const beamAngle = this._beamPivot.rotation.y + i * Math.PI;
      const difference = Math.atan2(
        Math.sin(playerAngle - beamAngle),
        Math.cos(playerAngle - beamAngle),
      );
      if (Math.abs(Math.sin(difference) * distance) <=
          this.tuning.BEAM_WIDTH * 0.5 &&
          Math.cos(difference) > 0) return true;
    }
    return false;
  }

  _updateBeam(dt, playerPos) {
    this._stateTimer = Math.max(0, this._stateTimer - dt);
    this._beamPivot.rotation.y += this.tuning.BEAM_SPEED[this.phase] * dt;
    this._beamHitClock = Math.max(0, this._beamHitClock - dt);
    if (this._beamHitClock <= 0 && this._playerInBeam(playerPos)) {
      this.combat.damage(this.tuning.BEAM_DAMAGE, this._beamPivot.position);
      this._beamHitClock = this.tuning.BEAM_HIT_COOLDOWN;
      this.combat.vfx.keeperPulse(playerPos, 'hit');
    }
    if (this._stateTimer > 0) return;
    this._beamPivot.visible = false;
    this._state = 'idle';
  }

  _clearBeam() {
    this._beamPivot.visible = false;
    for (const beam of this._beamMeshes) beam.visible = false;
  }

  _updateIdle(dt, playerPos) {
    this._shotClock -= dt;
    this._chargeClock -= dt;
    this._debrisClock -= dt;
    this._beamClock -= dt;
    if (this._chargeClock <= 0) {
      this._startCharge(playerPos);
      return;
    }
    if (this._debrisClock <= 0) {
      this._startDebris();
      return;
    }
    if (this._beamClock <= 0) {
      this._startBeam();
      return;
    }
    if (this._shotClock <= this.tuning.SHOT_TELEGRAPH) {
      this._state = 'shot-telegraph';
      this._stateTimer = Math.max(0, this._shotClock);
      this.combat.vfx.keeperPulse(this.center(), 'telegraph');
    }
  }

  _act(dt, playerPos) {
    if (this._state === 'idle') {
      this._updateIdle(dt, playerPos);
      return;
    }
    if (this._state === 'charge') {
      this._updateCharge(dt, playerPos);
      return;
    }
    if (this._state === 'debris') {
      this._updateDebris(dt, playerPos);
      return;
    }
    if (this._state === 'beam') {
      this._updateBeam(dt, playerPos);
      return;
    }
    this._stateTimer = Math.max(0, this._stateTimer - dt);
    if (this._state === 'charge-telegraph') {
      const progress = 1 - this._stateTimer / this.tuning.CHARGE_TELEGRAPH;
      this._laneMaterial.opacity = 0.28 + progress * 0.48;
      if (this._stateTimer <= 0) {
        this._lane.visible = false;
        this._state = 'charge';
      }
      return;
    }
    if (this._state === 'shot-telegraph') {
      if (this._stateTimer <= 0) {
        this._fire(playerPos);
        this._shotClock = this.tuning.SHOT_INTERVAL[this.phase];
        this._state = 'idle';
      }
      return;
    }
    if (this._state === 'beam-telegraph') {
      const progress = 1 - this._stateTimer / this.tuning.BEAM_TELEGRAPH;
      this._beamMaterial.opacity = 0.12 + progress * 0.34;
      if (this._stateTimer <= 0) {
        this._beamMaterial.opacity = 0.56;
        this._state = 'beam';
        this._stateTimer = this.tuning.BEAM_DURATION[this.phase];
      }
      return;
    }
    if (this._state === 'phase-flare') {
      const flare = 1 + Math.sin(
        (this.tuning.ENRAGE_INVULN - this._stateTimer) * Math.PI * 8,
      ) * 0.035;
      this.body.figure.scale.setScalar(KEEPER_SCALE * flare);
      if (this._stateTimer <= 0) {
        this.body.figure.scale.setScalar(KEEPER_SCALE);
        this._state = 'idle';
      }
      return;
    }
    if (this._state === 'recovery' && this._stateTimer <= 0) this._state = 'idle';
  }

  _onPhaseChanged() {
    this._state = 'phase-flare';
    this._stateTimer = this.tuning.ENRAGE_INVULN;
    this._lane.visible = false;
    this._clearDebris();
    this._clearBeam();
    this._resetClocks();
    this.onEvent?.(`Keeper phase ${this.phase + 1} · the tower destabilizes`, 'warning');
  }

  _onDamaged() {
    // The controller freezes the defeated body during the collapse beat, so
    // leave the killing blow to the pooled hit/death VFX instead of pinning a
    // full-body emissive flash on the Keeper for the whole transition.
    if (this.hp > 0) this.body.flashHit();
  }

  _phaseSurfaceY() { return this.bounds.height + 0.04; }

  _onDefeated() {
    this._lane.visible = false;
    this._clearDebris();
    this._clearBeam();
    this.body.defeated = true;
  }

  update(dt, t, playerPos) {
    this.body.update(dt, t, playerPos);
    super.update(dt, playerPos);
  }

  blocksPlayerAt(x, z, radius, supportY) {
    if (!this.active || this._state === 'charge') return false;
    if (Math.abs(supportY - this.bounds.height) > 1.4) return false;
    return Math.hypot(
      x - this.body.group.position.x,
      z - this.body.group.position.z,
    ) < radius + 1.15;
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this.scene.remove(this._lane);
    this._laneGeometry.dispose();
    this._laneMaterial.dispose();
    for (const slot of this._debris) {
      this.scene.remove(slot.rock, slot.warning);
    }
    this._debrisGeometry.dispose();
    this._debrisMaterial.dispose();
    this._debrisWarningGeometry.dispose();
    this._debrisWarningMaterial.dispose();
    this.scene.remove(this._beamPivot);
    this._beamGeometry.dispose();
    this._beamMaterial.dispose();
    this.body.dispose();
    super.dispose();
  }
}
