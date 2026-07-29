// ============================================================
// MEMORY STONES — the Keeper's falling-debris wave (Arena 3 boss).
//
// The only pattern that attacks the deck rather than the player: a scatter of
// impact rings appear, pulse for TELEGRAPH seconds, and then the stones that
// belong to them land. Answering it is pure spatial reading — there is no dodge
// window per stone, only a place to already be standing.
//
// One stone in a wave may carry a lumina power-up (POWERUP_CHANCE), which is what
// keeps the pattern from being pure denial: the safest ground and the rewarding
// ground are chosen independently, so they regularly disagree.
//
// The pool is sized to the largest authored wave, so a wave allocates nothing.
// ============================================================
import * as THREE from 'three';

const POOL_SIZE = 9;          // must be >= max(STONES.COUNT)
const SPAWN_HEIGHT = 8;       // metres above the deck the stones drop from
const IMPACT_KNOCKBACK = 3.5;

export class MemoryStones {
  /**
   * @param {THREE.Scene} scene
   * @param {any} combat   the arena's TowerCombatManager (vfx + damage door)
   * @param {any} player   PlayerController (knockback)
   * @param {{height: number, combatRadius: number}} bounds
   * @param {object} tuning  the boss's STONES block
   * @param {(position: THREE.Vector3) => void} [onPowerUpDrop]
   */
  constructor(scene, combat, player, bounds, tuning, onPowerUpDrop = null) {
    this.scene = scene;
    this.combat = combat;
    this.player = player;
    this.bounds = bounds;
    this.tuning = tuning;
    this.onPowerUpDrop = onPowerUpDrop;

    this._live = 0;
    this._dropIndex = -1;
    this._drop = new THREE.Vector3();

    this._rockGeometry = new THREE.DodecahedronGeometry(0.48, 0);
    this._rockMaterial = new THREE.MeshStandardMaterial({
      color: 0x73695d,
      roughness: 0.92,
      metalness: 0.05,
    });
    // The ring is drawn at exactly the damage radius, so what the player reads is
    // what the hit test uses.
    this._ringGeometry = new THREE.RingGeometry(
      tuning.RADIUS * 0.72,
      tuning.RADIUS,
      28,
    );
    this._ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xff8b61,
      transparent: true,
      opacity: 0.52,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.slots = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const rock = new THREE.Mesh(this._rockGeometry, this._rockMaterial);
      const warning = new THREE.Mesh(this._ringGeometry, this._ringMaterial);
      rock.visible = false;
      warning.visible = false;
      warning.rotation.x = -Math.PI / 2;
      scene.add(rock, warning);
      this.slots.push({ index: i, active: false, falling: false, delay: 0, rock, warning });
    }
  }

  get busy() { return this._live > 0; }

  /**
   * Arm a wave at uniformly-distributed points on the deck. Count and warning
   * time are both read from the phase here rather than passed in, so the two
   * numbers that define a wave's difficulty stay together.
   * @param {number} phase
   * @param {() => number} rng
   */
  start(phase, rng) {
    const n = Math.min(this.tuning.COUNT[phase], POOL_SIZE);
    const telegraph = this.tuning.TELEGRAPH[phase];
    const spread = this.bounds.combatRadius - this.tuning.RADIUS;
    this._live = n;
    this._dropIndex = rng() < this.tuning.POWERUP_CHANCE
      ? Math.floor(rng() * n)
      : -1;

    for (let i = 0; i < n; i++) {
      const slot = this.slots[i];
      const angle = rng() * Math.PI * 2;
      // sqrt of a uniform draw, or the scatter clumps toward the arena centre.
      const distance = Math.sqrt(rng()) * spread;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;

      slot.active = true;
      slot.falling = false;
      // Staggered so the wave lands as a run of impacts rather than one thud.
      slot.delay = telegraph + i * this.tuning.STAGGER;
      slot.warning.position.set(x, this.bounds.height + 0.055, z);
      slot.warning.scale.setScalar(0.7);
      slot.warning.visible = true;
      slot.rock.position.set(x, this.bounds.height + SPAWN_HEIGHT, z);
      slot.rock.rotation.set(rng() * Math.PI, rng() * Math.PI, 0);
      slot.rock.visible = false;
    }
  }

  update(dt, playerPos) {
    if (this._live <= 0) return;
    for (const slot of this.slots) {
      if (!slot.active) continue;

      if (!slot.falling) {
        slot.delay -= dt;
        // Pulse quickens as the drop nears — the ring is the only warning.
        slot.warning.scale.setScalar(0.88 + Math.sin(slot.delay * 16) * 0.12);
        if (slot.delay > 0) continue;
        slot.falling = true;
        slot.rock.visible = true;
      }

      slot.rock.position.y -= this.tuning.FALL_SPEED * dt;
      slot.rock.rotation.x += dt * 5;
      slot.rock.rotation.z += dt * 3.5;
      if (slot.rock.position.y > this.bounds.height + 0.48) continue;

      this._impact(slot, playerPos);
    }
  }

  _impact(slot, playerPos) {
    const at = slot.warning.position;
    if (Math.hypot(playerPos.x - at.x, playerPos.z - at.z) <= this.tuning.RADIUS) {
      this.combat.damage(this.tuning.DAMAGE, at);
      this.player.applyKnockback(playerPos.x - at.x, playerPos.z - at.z, IMPACT_KNOCKBACK);
    }
    this.combat.vfx.keeperPulse(at, 'hit');

    if (slot.index === this._dropIndex) {
      this._drop.set(at.x, this.bounds.height + 0.35, at.z);
      this.onPowerUpDrop?.(this._drop);
    }

    slot.active = false;
    slot.falling = false;
    slot.rock.visible = false;
    slot.warning.visible = false;
    this._live--;
  }

  clear() {
    this._live = 0;
    this._dropIndex = -1;
    for (const slot of this.slots) {
      slot.active = false;
      slot.falling = false;
      slot.rock.visible = false;
      slot.warning.visible = false;
    }
  }

  dispose() {
    this.clear();
    for (const slot of this.slots) this.scene.remove(slot.rock, slot.warning);
    this.slots.length = 0;
    this._rockGeometry.dispose();
    this._rockMaterial.dispose();
    this._ringGeometry.dispose();
    this._ringMaterial.dispose();
  }
}
