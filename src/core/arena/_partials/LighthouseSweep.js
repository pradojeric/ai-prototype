// ============================================================
// LIGHTHOUSE SWEEP — the Keeper's rotating beam (Arena 3 boss), and the attack
// the whole lighthouse fiction is built on.
//
// Three stages, in order:
//   approach   the Keeper walks to the arena centre, because a sweep pivoting off
//              the deck's axis covers the floor unevenly and reads as a searchlight
//              wandering rather than a lighthouse turning
//   telegraph  the blade ramps up in place, giving the player the rotation to read
//   sweep      the arms turn at SPEED for DURATION seconds
//
// Each arm is a scorch line burnt across the deck PLUS a vertical blade of light
// standing on it, and the blade's height IS the hit volume (CLEARANCE, 0.55m).
// That equality is the point: an earlier version drew a flat floor decal, which
// gave the player no reason to believe the attack could be jumped. Against the
// ~0.80m combat hop this is a ~0.43s window — a timing read, not a binary "was
// airborne at any point" — and it is deliberately the same clearance as the
// Feastkeeper's Offering Slam so the Zone 1 dodge transfers here.
// ============================================================
import * as THREE from 'three';
import { createLighthouseBladeMaterial } from './LighthouseBeamMaterial.js';

const MAX_ARMS = 2;
// Close enough to the arena axis that the sweep already reads as centred.
const CENTER_EPSILON = 0.08;

export class LighthouseSweep {
  /**
   * @param {THREE.Scene} scene
   * @param {any} combat   the arena's TowerCombatManager (vfx + damage door)
   * @param {any} player   PlayerController (read for airborne height)
   * @param {any} body     TowerKeeperBody — the approach moves it
   * @param {{height: number, combatRadius: number, radius?: number}} bounds
   * @param {object} tuning  the boss's SWEEP block
   */
  constructor(scene, combat, player, body, bounds, tuning) {
    this.scene = scene;
    this.combat = combat;
    this.player = player;
    this.body = body;
    this.bounds = bounds;
    this.tuning = tuning;

    this._state = 'idle';   // idle | approach | telegraph | sweep
    this._timer = 0;
    this._phase = 0;
    this._hitCooldown = 0;
    this._time = 0;
    this._rng = Math.random;   // replaced by the boss's seeded PRNG on start()
    this._dir = new THREE.Vector3();

    // Reach spans the player's deck, not the Keeper's tighter movement clamp — a
    // blade sized to combatRadius would stop short of where the player can stand,
    // and one sized to twice it would hang out over the void.
    this.reach = bounds.radius || bounds.combatRadius * 1.35;

    this._scorchGeometry = new THREE.BoxGeometry(tuning.WIDTH * 1.45, 0.035, this.reach);
    // Both layers start at the pivot and run outward, so local z is 0..reach —
    // which is also the space the blade shader works in.
    this._scorchGeometry.translate(0, 0, this.reach * 0.5);
    this._scorchMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd878,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this._bladeGeometry = new THREE.BoxGeometry(tuning.WIDTH, tuning.CLEARANCE, this.reach);
    this._bladeGeometry.translate(0, tuning.CLEARANCE * 0.5, this.reach * 0.5);
    this._bladeMaterial = createLighthouseBladeMaterial(tuning.CLEARANCE, this.reach);

    this.pivot = new THREE.Group();
    this._arms = [];
    for (let i = 0; i < MAX_ARMS; i++) {
      const arm = new THREE.Group();
      arm.rotation.y = i * Math.PI;
      arm.add(
        new THREE.Mesh(this._scorchGeometry, this._scorchMaterial),
        new THREE.Mesh(this._bladeGeometry, this._bladeMaterial),
      );
      arm.visible = false;
      this.pivot.add(arm);
      this._arms.push(arm);
    }
    this.pivot.visible = false;
    scene.add(this.pivot);
  }

  get busy() { return this._state !== 'idle'; }

  // True only while the Keeper is walking to centre. The boss feeds this to
  // `blocksPlayerAt` so a player standing on the arena centre — exactly where the
  // Keeper is headed — cannot be pinned inside the walking body.
  get approaching() { return this._state === 'approach'; }

  // Telegraph ramp and live-sweep brightness drive both layers together.
  _setIntensity(value) {
    this._scorchMaterial.opacity = value;
    this._bladeMaterial.uniforms.uOpacity.value = value;
  }

  /**
   * Begin the walk to centre. Skips straight to the telegraph when the Keeper is
   * already there — the boss fires its callout before calling this, so that
   * shortcut is never silent.
   * @param {number} phase
   * @param {() => number} rng
   */
  start(phase, rng) {
    this._phase = phase;
    this._rng = rng;
    const group = this.body.group;
    this._dir.set(-group.position.x, 0, -group.position.z);
    const distance = this._dir.length();
    if (distance <= CENTER_EPSILON) {
      this._beginTelegraph();
      return;
    }
    this._dir.multiplyScalar(1 / distance);
    this._state = 'approach';
    // A bail-out, not the pacing: if the walk is ever interrupted the Keeper
    // still commits to the sweep instead of stalling the fight.
    this._timer = distance / this.tuning.APPROACH_SPEED + 0.35;
  }

  update(dt, playerPos) {
    if (this._state === 'idle') return;

    // Blade energy scrolls on its own clock, so each sweep starts from rest
    // instead of an arbitrary phase of global time.
    if (this.pivot.visible) {
      this._time += dt;
      this._bladeMaterial.uniforms.uTime.value = this._time;
    }

    if (this._state === 'approach') { this._updateApproach(dt); return; }
    if (this._state === 'telegraph') { this._updateTelegraph(dt); return; }
    this._updateSweep(dt, playerPos);
  }

  _updateApproach(dt) {
    const group = this.body.group;
    this._timer = Math.max(0, this._timer - dt);
    const remaining = Math.hypot(group.position.x, group.position.z);
    const step = Math.min(remaining, this.tuning.APPROACH_SPEED * dt);
    group.position.addScaledVector(this._dir, step);
    if (remaining - step > CENTER_EPSILON && this._timer > 0) return;
    group.position.x = 0;
    group.position.z = 0;
    this._beginTelegraph();
  }

  _beginTelegraph() {
    const group = this.body.group;
    this.pivot.position.set(group.position.x, this.bounds.height + 0.075, group.position.z);
    this.pivot.rotation.y = this._rng() * Math.PI * 2;
    this.pivot.visible = true;
    this._time = 0;

    const arms = this.tuning.ARMS[this._phase];
    for (let i = 0; i < this._arms.length; i++) this._arms[i].visible = i < arms;

    this._setIntensity(0.18);
    this._hitCooldown = 0;
    this._state = 'telegraph';
    this._timer = this.tuning.TELEGRAPH;
  }

  _updateTelegraph(dt) {
    this._timer = Math.max(0, this._timer - dt);
    const progress = 1 - this._timer / this.tuning.TELEGRAPH;
    this._setIntensity(0.12 + progress * 0.34);
    if (this._timer > 0) return;
    this._setIntensity(0.56);
    this._state = 'sweep';
    this._timer = this.tuning.DURATION[this._phase];
  }

  _updateSweep(dt, playerPos) {
    this._timer = Math.max(0, this._timer - dt);
    this.pivot.rotation.y += this.tuning.SPEED[this._phase] * dt;

    this._hitCooldown = Math.max(0, this._hitCooldown - dt);
    if (this._hitCooldown <= 0 && this._testPlayer(playerPos)) {
      this.combat.damage(this.tuning.DAMAGE, this.pivot.position);
      this._hitCooldown = this.tuning.HIT_COOLDOWN;
      this.combat.vfx.keeperPulse(playerPos, 'hit');
    }

    if (this._timer > 0) return;
    this.pivot.visible = false;
    this._state = 'idle';
  }

  // A hit needs all three: under the blade's top edge, within its drawn reach,
  // and inside the width of an arm.
  _testPlayer(playerPos) {
    if (this.player.jumpOffset >= this.tuning.CLEARANCE) return false;

    const dx = playerPos.x - this.pivot.position.x;
    const dz = playerPos.z - this.pivot.position.z;
    const distance = Math.hypot(dx, dz);
    // Cut-off is the drawn reach, so the hit volume never outlives the blade.
    if (distance > this.reach || distance < 0.35) return false;

    const playerAngle = Math.atan2(dx, dz);
    const arms = this.tuning.ARMS[this._phase];
    for (let i = 0; i < arms; i++) {
      const armAngle = this.pivot.rotation.y + i * Math.PI;
      const difference = Math.atan2(
        Math.sin(playerAngle - armAngle),
        Math.cos(playerAngle - armAngle),
      );
      // Perpendicular distance to the arm's axis, and in front of the pivot.
      if (Math.abs(Math.sin(difference) * distance) <= this.tuning.WIDTH * 0.5
        && Math.cos(difference) > 0) return true;
    }
    return false;
  }

  clear() {
    this._state = 'idle';
    this._timer = 0;
    this._hitCooldown = 0;
    this.pivot.visible = false;
    for (const arm of this._arms) arm.visible = false;
  }

  dispose() {
    this.clear();
    this.scene.remove(this.pivot);
    this._arms.length = 0;
    this._scorchGeometry.dispose();
    this._scorchMaterial.dispose();
    this._bladeGeometry.dispose();
    this._bladeMaterial.dispose();
  }
}
