// ============================================================
// SPIRAL FEAST — the Feastkeeper's rotating bullet-arm volley (Zone 1 boss).
//
// A bullet-hell pattern tuned for a WADING player: rounds are slow (walk speed is
// only 2.6 m/s) and cheap (6 damage), so the arms read as spokes you step between
// rather than a wall you have to twitch past. Spin direction flips every volley so
// one memorised strafe never solves it twice.
//
// Owns no meshes — it drives CombatManager's shared spit pool, which already
// carries these bullets through movement, wall collision, and the player hit test.
// The per-shot `damage` meta is what keeps a 6-point boss round from inheriting a
// trash spitter's 10.
// ============================================================
import * as THREE from 'three';
import { CONFIG } from '../../../config.js';

export class SpiralVolley {
  /**
   * @param {any} combat   the arena's CombatManager (fires through combat.spits)
   * @param {object} tuning  the boss's SPIRAL block
   */
  constructor(combat, tuning) {
    this.combat = combat;
    this.tuning = tuning;
    this.remaining = 0;      // seconds of volley left; >0 means firing
    this._angle = 0;
    this._spin = 1;          // flipped per volley
    this._cadence = 0;
    this._muzzle = new THREE.Vector3();
    this._dir = new THREE.Vector3();
  }

  get busy() { return this.remaining > 0; }

  // Arm a volley lasting `duration` seconds, starting from a random rotation so
  // the opening spoke isn't always in the same place.
  start(duration, rng = Math.random) {
    this.remaining = duration;
    this._angle = rng() * Math.PI * 2;
    this._spin = -this._spin;
    this._cadence = 0;
  }

  update(dt, bossPos) {
    if (this.remaining <= 0) return;
    this.remaining -= dt;
    this._angle += this.tuning.SPIN * this._spin * dt;

    this._cadence -= dt;
    if (this._cadence > 0) return;
    this._cadence = this.tuning.RATE;

    // Fire from TORSO height, not the guardian's chest. These rounds travel flat,
    // and CombatManager's spit-vs-player test rejects anything more than 1.4m off
    // the player's eye — launched from the golem's ~4m chest they would sail
    // straight over the player's head and never register a hit.
    this._muzzle.set(bossPos.x, CONFIG.WATER_LEVEL + this.tuning.MUZZLE_Y, bossPos.z);

    const step = (Math.PI * 2) / this.tuning.ARMS;
    for (let i = 0; i < this.tuning.ARMS; i++) {
      const a = this._angle + i * step;
      this._dir.set(Math.cos(a), 0, Math.sin(a));
      this.combat.spits.fire(
        this._muzzle, this._dir, this.tuning.SPEED, this.tuning.LIFE,
        { owner: 'boss', damage: this.tuning.DAMAGE },
      );
    }
  }

  // Stop firing. Rounds already in the air keep flying — the shared pool owns
  // them, and clearing mid-flight would erase hits the player already dodged.
  stop() { this.remaining = 0; }
}
