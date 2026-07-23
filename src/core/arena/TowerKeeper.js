import * as THREE from 'three';
import { CONFIG, TOWER_ARENA, mulberry32 } from '../../config.js';
import { buildZone3Guardian } from '../guardians/zone3Guardian.js';
import { ArenaBoss } from './ArenaBoss.js';

const KEEPER_SCALE = 0.62;
const MODEL_FOOT_Y = 0.1;
const CHARGE_HIT_RADIUS = 1.35;

export const TOWER_KEEPER_TUNING = {
  HP: 20,
  HIT_RADIUS: 2.3,
  PHASE_THRESHOLDS: [0.66, 0.33],
  ENRAGE_INVULN: 1,
  SHOT_DAMAGE: 10,
  SHOT_KNOCKBACK: 3.6,
  SHOT_SPEED: 10,
  SHOT_TELEGRAPH: 0.45,
  SHOT_INTERVAL: [2.8, 2.2, 1.7],
  CHARGE_INTERVAL: [[8, 10], [6.5, 8.5], [5, 7]],
  CHARGE_TELEGRAPH: 0.9,
  CHARGE_SPEED: 9.5,
  CHARGE_DAMAGE: 24,
  CHARGE_KNOCKBACK: 6.5,
  CHARGE_RECOVERY: 1.1,
  SUMMON_INTERVAL: [[11, 13], [9, 11], [7, 9]],
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
    this.group.visible = true;
  }

  update(dt, t, playerPos) {
    if (!this.group.visible) return;
    const targetFade = this.defeated ? 0 : 1;
    this.fade = THREE.MathUtils.damp(this.fade, targetFade, this.defeated ? 3 : 5, dt);
    this._applyFade(this.fade);
    this.model.animate(dt, t, this.fade, playerPos, this.group.position);
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
    this.projectileDamage = this.tuning.SHOT_DAMAGE;
    this.projectileKnockback = this.tuning.SHOT_KNOCKBACK;
    this._rng = mulberry32((options.seed || 1) >>> 0);
    this._state = 'idle';
    this._stateTimer = 0;
    this._shotClock = 1.4;
    this._chargeClock = 8;
    this._summonClock = 11;
    this._chargeHit = false;
    this._disposed = false;
    this._chargeTarget = new THREE.Vector3();

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
  }

  _randomRange(range) { return range[0] + this._rng() * (range[1] - range[0]); }

  _resetClocks(opening = false) {
    this._shotClock = opening ? 1.4 : this.tuning.SHOT_INTERVAL[this.phase];
    this._chargeClock = this._randomRange(this.tuning.CHARGE_INTERVAL[this.phase]);
    this._summonClock = this._randomRange(this.tuning.SUMMON_INTERVAL[this.phase]);
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

  _beginRecovery() {
    this._state = 'recovery';
    this._stateTimer = this.tuning.CHARGE_RECOVERY;
    this._lane.visible = false;
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
    if (remaining <= 0.03) this._beginRecovery();
  }

  _updateIdle(dt, playerPos) {
    this._shotClock -= dt;
    this._chargeClock -= dt;
    this._summonClock -= dt;
    if (this._chargeClock <= 0) {
      this._startCharge(playerPos);
      return;
    }
    if (this._summonClock <= 0) {
      this.combat.spawnBossGroup(this.phase);
      this._summonClock = this._randomRange(this.tuning.SUMMON_INTERVAL[this.phase]);
      this.onEvent?.('The Keeper calls Summoned Echoes', 'warning');
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
    this._resetClocks();
    this.combat.spawnBossGroup(this.phase);
    this.onEvent?.(`Keeper phase ${this.phase + 1} · echoes summoned`, 'warning');
  }

  _onDefeated() {
    this._lane.visible = false;
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
    this.body.dispose();
    super.dispose();
  }
}
