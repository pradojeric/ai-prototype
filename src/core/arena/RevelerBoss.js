// ============================================================
// REVELER BOSS — Arena 2's post-riddle fight. The coral titan shifts between
// river anchors, calls random threat groups, and surrounds itself with charged
// projectiles that the stationary player must reflect or endure.
// ============================================================
import * as THREE from 'three';
import { RAIL_ARENA } from '../../config.js';
import { ArenaBoss } from './ArenaBoss.js';
import { RevelerProjectilePool } from './RevelerProjectilePool.js';

const REVELER_TUNING = {
  HP: 100,
  ANCHORS: [-5.5, 0, 5.5],
  MOVE_WARNING: 0.45,
  MOVE_DURATION: 0.6,
  MOVE_INTERVAL: [[5, 7], [4, 6], [3, 5]],
  FORMATION_COUNT: [[1, 2], [2, 3], [3, 5]],
  FORMATION_COOLDOWN: [[5, 7], [4, 6], [3, 5]],
  SUMMON_COUNT: [[1, 2], [1, 3], [2, 3]],
  SUMMON_INTERVAL: [[3.5, 5], [3, 4.5], [2.5, 4]],
  REFLECT_DAMAGE: 5,
};

export class RevelerBoss extends ArenaBoss {
  constructor(guardian, combat, audio, player, rng) {
    super(guardian, combat, audio, player, REVELER_TUNING);
    this._rng = rng;
    this._anchorIndex = 1;
    this._moveState = 'idle';
    this._moveTimer = this._draw(this.tuning.MOVE_INTERVAL[0]);
    this._moveAge = 0;
    this._moveFrom = 0;
    this._moveTo = 0;
    this._formationTimer = this._draw(this.tuning.FORMATION_COOLDOWN[0]);
    this._formationWasActive = false;
    this._summonTimer = this._draw(this.tuning.SUMMON_INTERVAL[0]);
    this._boatTarget = new THREE.Vector3(
      RAIL_ARENA.CENTER.x,
      RAIL_ARENA.BOAT_EYE_BASE + 1.15,
      RAIL_ARENA.CENTER.z,
    );
    this._handleReflectedHit = (position) => this._receiveReflectedHit(position);
    this.projectiles = new RevelerProjectilePool(
      combat.scene, combat, audio, this._handleReflectedHit,
    );
    this.guardian.group.position.set(0, 0, this.guardian.world.zone.guardianStart?.z ?? -31);
  }

  begin() {
    if (this.active || this.defeated) return;
    super.begin();
    this.combat.spawnRandomGroup(2, 2);
  }

  _act(dt) {
    const center = this.center();
    this.projectiles.update(dt, center, this._boatTarget);
    this._updateFormation(dt);
    this._updateMovement(dt);
    this._updateSummons(dt);
  }

  _updateFormation(dt) {
    const active = this.projectiles.hasActive;
    if (active) {
      this._formationWasActive = true;
      return;
    }
    if (this._formationWasActive) {
      this._formationWasActive = false;
      this._formationTimer = this._draw(this.tuning.FORMATION_COOLDOWN[this.phase]);
      return;
    }
    if (this._moveState !== 'idle') return;
    this._formationTimer -= dt;
    if (this._formationTimer > 0) return;
    const [min, max] = this.tuning.FORMATION_COUNT[this.phase];
    const count = min + Math.floor(this._rng() * (max - min + 1));
    this.projectiles.spawnFormation(count, this._rng);
    this._formationWasActive = true;
  }

  _updateMovement(dt) {
    if (this._moveState === 'telegraph') {
      this._moveAge += dt;
      if (this._moveAge < this.tuning.MOVE_WARNING) return;
      this._moveState = 'moving';
      this._moveAge = 0;
      return;
    }
    if (this._moveState === 'moving') {
      this._moveAge += dt;
      const p = Math.min(1, this._moveAge / this.tuning.MOVE_DURATION);
      const eased = p * p * (3 - 2 * p);
      this.guardian.group.position.x = this._moveFrom + (this._moveTo - this._moveFrom) * eased;
      if (p < 1) return;
      this.guardian.group.position.set(this._moveTo, 0, this.guardian.group.position.z);
      this._moveState = 'idle';
      this._moveTimer = this._draw(this.tuning.MOVE_INTERVAL[this.phase]);
      return;
    }

    if (this.projectiles.formationLocked) return;
    this._moveTimer -= dt;
    if (this._moveTimer > 0) return;
    const options = [];
    for (let i = 0; i < this.tuning.ANCHORS.length; i++) {
      if (i !== this._anchorIndex) options.push(i);
    }
    this._anchorIndex = options[Math.floor(this._rng() * options.length)];
    this._moveFrom = this.guardian.group.position.x;
    this._moveTo = this.tuning.ANCHORS[this._anchorIndex];
    this._moveAge = 0;
    this._moveState = 'telegraph';
    this.combat.vfx.keeperPulse(this.center(), 'telegraph');
    this.audio?.playTeleport?.();
  }

  _updateSummons(dt) {
    this._summonTimer -= dt;
    if (this._summonTimer > 0) return;
    const [min, max] = this.tuning.SUMMON_COUNT[this.phase];
    this.combat.spawnRandomGroup(min, max);
    this._summonTimer = this._draw(this.tuning.SUMMON_INTERVAL[this.phase]);
  }

  _receiveReflectedHit(position) {
    if (!this.active || this.defeated) return;
    if (this._invuln > 0) {
      this.pingArmored(position);
      return;
    }
    this.damage(this.tuning.REFLECT_DAMAGE);
  }

  _onPhaseChanged() {
    this.combat.spawnRandomGroup(3, 3);
    this._summonTimer = this._draw(this.tuning.SUMMON_INTERVAL[this.phase]);
    this._moveTimer = Math.min(this._moveTimer, 1.2);
  }

  _onDefeated() { this.projectiles.reset(); }

  _draw([min, max]) { return min + this._rng() * (max - min); }

  dispose() {
    this.projectiles.dispose();
    super.dispose();
  }
}
