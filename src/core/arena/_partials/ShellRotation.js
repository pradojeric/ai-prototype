// ============================================================
// SHELL ROTATION — The Reveler's rotating coral shell (Arena 2 boss).
//
// Petals fold over the chest and leave a single wedge open, and that wedge orbits.
// The player is bolted to a bangka and cannot reposition, so this is the one
// pattern that asks purely for aim timing: lead the gap, fire through it, eat a
// BLOCKED flare when you misjudge it.
//
// The wedge is cut out of the RingGeometry itself (thetaLength) rather than faked
// with a texture, so what the player reads is exactly what the hit test uses —
// the same honesty rule OfferingSlam follows in Zone 1.
//
// The disc faces +Z, straight down the lane at the boat, because a shell spinning
// around the vertical axis would hide its gap behind the guardian for half of
// every rotation. Facing the player it reads like a clock hand.
// ============================================================
import * as THREE from 'three';

const TWO_PI = Math.PI * 2;
const INNER_RADIUS = 0.3;    // hub; bolts landing here count as shell, not gap
const OUTER_RADIUS = 2.6;    // must cover BOSS_DEFAULTS.HIT_RADIUS (2.3)
const FRONT_OFFSET = 0.9;    // sits in front of the chest so it intercepts first
// Bolts travel at COMBAT.BOLT.SPEED (38 m/s) — ~0.63m per frame at 60fps. A
// thinner slab than this would let shots tunnel clean through the shell.
const DEPTH = 1.2;

export class ShellRotation {
  /**
   * @param {THREE.Scene} scene
   * @param {object} tuning  the boss's SHELL block
   */
  constructor(scene, tuning) {
    this.scene = scene;
    this.tuning = tuning;
    this.remaining = 0;
    this._angle = 0;      // world bearing of the gap's trailing edge
    this._spin = 1;       // flipped per run so one memorised lead never solves it
    this._spinRate = 0;
    this._age = 0;
    this._scale = 1;

    const arc = TWO_PI - tuning.GAP_ARC;
    this._plateGeo = new THREE.RingGeometry(INNER_RADIUS, OUTER_RADIUS, 56, 1, 0, arc);
    this._rimGeo = new THREE.RingGeometry(
      OUTER_RADIUS - 0.14, OUTER_RADIUS, 56, 1, 0, arc,
    );
    this._plateMat = new THREE.MeshBasicMaterial({
      color: 0x6d2f22, transparent: true, opacity: 0.88,
      side: THREE.DoubleSide, depthWrite: false,
    });
    this._rimMat = new THREE.MeshBasicMaterial({
      color: 0xffb066, transparent: true, opacity: 0.9,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
    });

    this.group = new THREE.Group();
    this.group.visible = false;
    this.group.add(new THREE.Mesh(this._plateGeo, this._plateMat));
    this.group.add(new THREE.Mesh(this._rimGeo, this._rimMat));
    scene.add(this.group);

    this._center = new THREE.Vector3();
  }

  get busy() { return this.remaining > 0; }

  /**
   * Close the shell for `duration` seconds.
   * @param {number} duration
   * @param {number} spinRate  radians/sec the gap travels
   * @param {THREE.Vector3} bossCenter
   * @param {() => number} rng
   */
  start(duration, spinRate, bossCenter, rng = Math.random) {
    this.remaining = duration;
    this._spinRate = spinRate;
    this._spin = -this._spin;
    this._angle = rng() * TWO_PI;
    this._age = 0;
    // Seed the plane now: the boss tests bolts against it later in the very frame
    // the shell opens, before update() has had a chance to place it.
    this._center.copy(bossCenter);
    this._center.z += FRONT_OFFSET;
    this.group.position.copy(this._center);
    this.group.rotation.z = this._angle;
    this._scale = 0.25;
    this.group.scale.setScalar(this._scale);
    this.group.visible = true;
  }

  /** @param {THREE.Vector3} bossCenter */
  update(dt, bossCenter) {
    if (this.remaining <= 0) return;
    this.remaining -= dt;
    this._age += dt;
    this._angle += this._spinRate * this._spin * dt;

    this._center.copy(bossCenter);
    this._center.z += FRONT_OFFSET;
    this.group.position.copy(this._center);
    this.group.rotation.z = this._angle;

    // Petals snap shut over ~0.25s and iris back open as the pattern expires, so
    // the window's start and end are both legible from the shell itself. The hit
    // test reads the same scale — a half-drawn shell must not block at full size.
    const open = Math.max(0, Math.min(1, this._age / 0.25) * Math.min(1, this.remaining / 0.3));
    this._scale = 0.25 + open * 0.75;
    this.group.scale.setScalar(this._scale);

    if (this.remaining <= 0) this.clear();
  }

  /**
   * Where a player bolt landed relative to the shell.
   * @param {THREE.Vector3} position
   * @returns {'miss'|'blocked'|'gap'}
   */
  testBolt(position) {
    if (this.remaining <= 0) return 'miss';
    if (Math.abs(position.z - this._center.z) > DEPTH) return 'miss';
    const dx = position.x - this._center.x;
    const dy = position.y - this._center.y;
    const distSq = dx * dx + dy * dy;
    const outer = OUTER_RADIUS * this._scale;
    if (distSq > outer * outer) return 'miss';
    const inner = INNER_RADIUS * this._scale;
    if (distSq < inner * inner) return 'blocked';

    // The geometry runs CCW from thetaStart, so the untouched remainder — the
    // gap — trails it. `_angle` is that trailing edge in world terms; anything
    // within GAP_ARC behind it is through.
    let bearing = this._angle - Math.atan2(dy, dx);
    bearing = ((bearing % TWO_PI) + TWO_PI) % TWO_PI;
    return bearing <= this.tuning.GAP_ARC ? 'gap' : 'blocked';
  }

  clear() {
    this.remaining = 0;
    this.group.visible = false;
  }

  dispose() {
    this.clear();
    this.scene.remove(this.group);
    this._plateGeo.dispose();
    this._rimGeo.dispose();
    this._plateMat.dispose();
    this._rimMat.dispose();
  }
}
