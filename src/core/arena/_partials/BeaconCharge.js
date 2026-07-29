// ============================================================
// BEACON CHARGE — the Keeper's committed dash (Arena 3 boss).
//
// A gold lane is burnt onto the deck between the Keeper and where the player was
// standing, holds for TELEGRAPH seconds while it brightens, and then the Keeper
// crosses it at 19 u/s. The lane is the whole contract: it locks at the moment it
// appears and never re-aims, so stepping off it always works and the speed of the
// dash is honest rather than unfair.
//
// Whiffing is punished harder than connecting. A dash that lands recovers in
// HIT_RECOVERY (0.9s); a dash that eats air leaves the Keeper stunned for
// MISS_STUN (2-3s), which is the player's main damage window in the fight. That
// asymmetry is the reason the attack got faster in an earlier pass without
// getting cheaper to beat.
// ============================================================
import * as THREE from 'three';

export class BeaconCharge {
  /**
   * @param {THREE.Scene} scene
   * @param {any} combat   the arena's TowerCombatManager (vfx, hud, damage door)
   * @param {any} player   PlayerController (knockback)
   * @param {any} body     TowerKeeperBody — this pattern moves it
   * @param {{height: number, combatRadius: number}} bounds
   * @param {object} tuning  the boss's CHARGE block
   * @param {() => number} rng  the boss's seeded PRNG, so a retry replays
   * @param {(text: string, tone: string) => void} [onEvent]
   */
  constructor(scene, combat, player, body, bounds, tuning, rng, onEvent = null) {
    this.scene = scene;
    this.combat = combat;
    this.player = player;
    this.body = body;
    this.bounds = bounds;
    this.tuning = tuning;
    this._rng = rng;
    this.onEvent = onEvent;

    this._state = 'idle';   // idle | telegraph | dash | recovery
    this._timer = 0;
    this._landed = false;
    this._target = new THREE.Vector3();
    this._dir = new THREE.Vector3();

    this._geometry = new THREE.BoxGeometry(1, 0.035, 1);
    this._material = new THREE.MeshBasicMaterial({
      color: 0xffcf5a,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this._lane = new THREE.Mesh(this._geometry, this._material);
    this._lane.visible = false;
    scene.add(this._lane);
  }

  get busy() { return this._state !== 'idle'; }

  // True only while the Keeper is physically crossing the deck. The boss feeds
  // this to `blocksPlayerAt` so a player standing on the lane is shoved through
  // rather than pinned inside a moving body.
  get moving() { return this._state === 'dash'; }

  /**
   * Aim and arm a dash at the player's current position, clamped inside the
   * arena. Returns false when there is no runway worth dashing — the boss treats
   * that as a failed pattern and rerolls rather than committing to a 0.4m lunge.
   * @param {THREE.Vector3} playerPos
   */
  start(playerPos) {
    const group = this.body.group;
    const radius = Math.hypot(playerPos.x, playerPos.z);
    const clamp = radius > this.bounds.combatRadius
      ? this.bounds.combatRadius / radius
      : 1;
    this._target.set(playerPos.x * clamp, group.position.y, playerPos.z * clamp);

    this._dir.copy(this._target).sub(group.position).setY(0);
    const length = this._dir.length();
    if (length < 0.5) return false;
    this._dir.multiplyScalar(1 / length);

    this._state = 'telegraph';
    this._timer = this.tuning.TELEGRAPH;
    this._landed = false;
    this._showLane();
    return true;
  }

  _showLane() {
    const group = this.body.group;
    const dx = this._target.x - group.position.x;
    const dz = this._target.z - group.position.z;
    const length = Math.max(0.01, Math.hypot(dx, dz));
    this._lane.position.set(
      (group.position.x + this._target.x) / 2,
      this.bounds.height + 0.08,
      (group.position.z + this._target.z) / 2,
    );
    this._lane.rotation.y = Math.atan2(dx, dz);
    this._lane.scale.set(1.05, 1, length);
    this._lane.visible = true;
  }

  update(dt, playerPos) {
    if (this._state === 'idle') return;

    if (this._state === 'dash') {
      this._updateDash(dt, playerPos);
      return;
    }

    this._timer = Math.max(0, this._timer - dt);

    if (this._state === 'telegraph') {
      // Brightening lane: the ramp IS the countdown, so the player reads how
      // much time is left without a separate meter.
      const progress = 1 - this._timer / this.tuning.TELEGRAPH;
      this._material.opacity = 0.28 + progress * 0.48;
      if (this._timer <= 0) {
        this._lane.visible = false;
        this._state = 'dash';
      }
      return;
    }

    if (this._timer <= 0) this._state = 'idle';   // recovery over
  }

  _updateDash(dt, playerPos) {
    const group = this.body.group;
    const remaining = Math.hypot(
      this._target.x - group.position.x,
      this._target.z - group.position.z,
    );
    // Clamped to the remaining distance, so the dash cannot overshoot its lane
    // however long the frame was.
    const step = Math.min(remaining, this.tuning.SPEED * dt);
    group.position.addScaledVector(this._dir, step);

    const radius = Math.hypot(group.position.x, group.position.z);
    if (radius > this.bounds.combatRadius) {
      const clamp = this.bounds.combatRadius / radius;
      group.position.x *= clamp;
      group.position.z *= clamp;
    }

    if (!this._landed && Math.hypot(
      playerPos.x - group.position.x,
      playerPos.z - group.position.z,
    ) <= this.tuning.HIT_RADIUS) {
      this._landed = true;
      this.combat.damage(this.tuning.DAMAGE, group.position);
      this.player.applyKnockback(
        playerPos.x - group.position.x,
        playerPos.z - group.position.z,
        this.tuning.KNOCKBACK,
      );
      this.combat.vfx.keeperPulse(this.body.center(), 'hit');
    }

    if (remaining > 0.03) return;
    this._beginRecovery(!this._landed);
  }

  _beginRecovery(missed) {
    this._state = 'recovery';
    const [minStun, maxStun] = this.tuning.MISS_STUN;
    this._timer = missed
      ? minStun + this._rng() * (maxStun - minStun)
      : this.tuning.HIT_RECOVERY;
    this._lane.visible = false;
    if (!missed) return;
    this.combat.vfx.keeperPulse(this.body.center(), 'hit');
    this.onEvent?.(
      `Charge missed · Keeper stunned ${this._timer.toFixed(1)}s`,
      'success',
    );
  }

  clear() {
    this._state = 'idle';
    this._timer = 0;
    this._landed = false;
    this._lane.visible = false;
  }

  dispose() {
    this.clear();
    this.scene.remove(this._lane);
    this._geometry.dispose();
    this._material.dispose();
  }
}
