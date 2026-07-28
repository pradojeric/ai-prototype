// ============================================================
// HANDOG BARRAGE — the Feastkeeper's lobbed offering pots (Zone 1 boss pattern).
//
// The whole point of this attack is ZONE DENIAL: it does not aim, it paints
// patches of floor the player may not stand on. That only works if the warning is
// honest, so the landing point is decided the instant the pot is thrown and its
// ground ring appears immediately — fuse time IS warning time, with no hidden
// travel to re-read.
//
// This cannot ride CombatManager's shared spit pool: ProjectilePool flies dead
// straight (see its `update`), and a pot needs an arc plus a known destination.
// It owns its meshes for the same reason CombatVfx's ring pool can't be borrowed
// for the markers — VFX.RING_POOL is 16 slots shared with every combat effect, and
// one salvo would evict live hit/telegraph rings.
//
// Deliberately NOT jumpable: the blast is a sphere, and letting a hop clear it
// would make the combat jump a universal answer instead of the Offering Slam's.
// ============================================================
import * as THREE from 'three';
import { CONFIG, ARENA } from '../../../config.js';
import { VFX_COLORS } from '../../combat/CombatVfx.js';
import { fadeMat, buildPot } from '../../guardians/primitives.js';

const POOL = 8;                       // ceiling: phase 2 throws 7
const DECAL_Y = CONFIG.WATER_LEVEL + 0.055;   // just above the flooded arena floor
const ARENA_LIMIT = ARENA.WALL_RADIUS - 3;    // keep every landing inside the wall ring

export class FeastGrenades {
  /**
   * @param {THREE.Scene} scene
   * @param {any} combat  the arena's CombatManager (vfx + player damage door)
   * @param {any} player  PlayerController (knockback)
   * @param {object} tuning  the boss's GRENADE block
   */
  constructor(scene, combat, player, tuning) {
    this.scene = scene;
    this.combat = combat;
    this.player = player;
    this.tuning = tuning;

    // Shared geometry/materials across the pool — a salvo allocates nothing.
    this._matPot = fadeMat(0x6b4a35, 0xffb84d, 0.35, 0.95, 0.8, 0.02);
    this._matGlow = fadeMat(0xd9a24a, 0xffb84d, 1.4, 0.95, 0.5, 0.1);
    this._morselGeo = new THREE.SphereGeometry(0.16, 8, 6);
    this._decalGeo = new THREE.RingGeometry(
      tuning.RADIUS * 0.72, tuning.RADIUS, 28,
    );
    this._decalMat = new THREE.MeshBasicMaterial({
      color: 0xff8b61, transparent: true, opacity: 0.52,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
    });

    this.slots = [];
    for (let i = 0; i < POOL; i++) {
      const pot = buildPot(this._matPot, this._matGlow, this._morselGeo);
      pot.scale.setScalar(0.55);
      pot.visible = false;
      scene.add(pot);
      const warning = new THREE.Mesh(this._decalGeo, this._decalMat);
      warning.rotation.x = -Math.PI / 2;
      warning.visible = false;
      scene.add(warning);
      this.slots.push({
        active: false, pot, warning,
        fuse: 0, flight: 0, flightTotal: 1,
        from: new THREE.Vector3(),
        to: new THREE.Vector3(),
        control: new THREE.Vector3(),
      });
    }
    this._scratch = new THREE.Vector3();
  }

  get busy() { return this.slots.some((s) => s.active); }

  // Throw `count` pots from `origin`, scattered around where the player is NOW.
  // One lands on them directly so standing still is never safe; the rest ring
  // that spot, which is what turns the salvo into a shrinking pocket of floor.
  throwSalvo(count, origin, playerPos, rng = Math.random) {
    const [spreadMin, spreadMax] = this.tuning.SPREAD;
    let thrown = 0;
    for (const slot of this.slots) {
      if (thrown >= count) break;
      if (slot.active) continue;

      let x = playerPos.x;
      let z = playerPos.z;
      if (thrown > 0) {
        const angle = rng() * Math.PI * 2;
        const dist = spreadMin + rng() * (spreadMax - spreadMin);
        x += Math.cos(angle) * dist;
        z += Math.sin(angle) * dist;
      }
      // Clamp inside the wall ring so a pot can never land in unreachable space.
      const reach = Math.hypot(x - ARENA.CENTER.x, z - ARENA.CENTER.z);
      if (reach > ARENA_LIMIT) {
        const k = ARENA_LIMIT / reach;
        x = ARENA.CENTER.x + (x - ARENA.CENTER.x) * k;
        z = ARENA.CENTER.z + (z - ARENA.CENTER.z) * k;
      }

      slot.active = true;
      slot.flight = 0;
      slot.flightTotal = this.tuning.FLIGHT;
      // Staggered so the salvo detonates as a rolling sequence, giving the player
      // somewhere to run rather than one unreadable simultaneous flash.
      slot.fuse = this.tuning.FUSE + thrown * this.tuning.STAGGER;
      slot.from.copy(origin);
      slot.to.set(x, CONFIG.WATER_LEVEL, z);
      slot.control.copy(slot.from).lerp(slot.to, 0.5);
      slot.control.y += this.tuning.APEX;

      slot.pot.position.copy(slot.from);
      slot.pot.visible = true;
      slot.warning.position.set(x, DECAL_Y, z);
      slot.warning.scale.setScalar(0.7);
      slot.warning.visible = true;    // the marker is up before the pot has moved
      thrown++;
    }
    return thrown;
  }

  update(dt, playerPos) {
    for (const slot of this.slots) {
      if (!slot.active) continue;

      // Pulse the marker for the whole fuse, faster as it runs out.
      slot.fuse -= dt;
      slot.warning.scale.setScalar(0.88 + Math.sin(slot.fuse * 16) * 0.12);

      if (slot.flight < slot.flightTotal) {
        slot.flight = Math.min(slot.flightTotal, slot.flight + dt);
        this._arc(slot, slot.flight / slot.flightTotal);
        slot.pot.rotation.x += dt * 4.5;
        slot.pot.rotation.z += dt * 3;
      }
      if (slot.fuse > 0) continue;

      this._detonate(slot, playerPos);
    }
  }

  // Quadratic Bézier from -> control -> to, matching the artifact-scatter lob so
  // thrown objects read the same way everywhere in the game.
  _arc(slot, p) {
    const inv = 1 - p;
    const a = inv * inv;
    const b = 2 * inv * p;
    const c = p * p;
    slot.pot.position.set(
      a * slot.from.x + b * slot.control.x + c * slot.to.x,
      a * slot.from.y + b * slot.control.y + c * slot.to.y,
      a * slot.from.z + b * slot.control.z + c * slot.to.z,
    );
  }

  _detonate(slot, playerPos) {
    const impact = slot.warning.position;
    this.combat.vfx.ring(impact, VFX_COLORS.danger, {
      horizontal: true,
      startScale: this.tuning.RADIUS,
      endScale: this.tuning.RADIUS * 2.2,
      duration: 0.5,
    });
    this.combat.vfx.burst(impact, VFX_COLORS.keeper, 1.6);

    const dx = playerPos.x - impact.x;
    const dz = playerPos.z - impact.z;
    if (Math.hypot(dx, dz) <= this.tuning.RADIUS) {
      this.combat.damage(this.tuning.DAMAGE, impact);
      this.player.applyKnockback(dx, dz, this.tuning.KNOCK);
    }
    this._release(slot);
  }

  _release(slot) {
    slot.active = false;
    slot.pot.visible = false;
    slot.warning.visible = false;
  }

  // Wipe in-flight pots without detonating them (phase change, defeat, teardown).
  clear() { for (const slot of this.slots) this._release(slot); }

  dispose() {
    this.clear();
    // buildPot() allocates a fresh body + rim geometry per call, so the pool owns
    // 8 pots' worth of one-off geometry beyond the shared ones. Collect uniques so
    // the shared morsel geometry isn't disposed once per pot.
    const geometries = new Set();
    for (const slot of this.slots) {
      slot.pot.traverse((o) => { if (o.geometry) geometries.add(o.geometry); });
      this.scene.remove(slot.pot);
      this.scene.remove(slot.warning);
    }
    this.slots.length = 0;
    for (const geo of geometries) geo.dispose();
    this._decalGeo.dispose();
    this._decalMat.dispose();
    this._matPot.dispose();
    this._matGlow.dispose();
  }
}
