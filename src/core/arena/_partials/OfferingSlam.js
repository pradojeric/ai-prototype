// ============================================================
// OFFERING SLAM — the Feastkeeper's expanding ground shockwave (Zone 1 boss).
//
// The pattern the COMBAT JUMP exists for. A ring races outward from the boss with
// one safe wedge cut into it, so there are two honest answers: read the gap and
// stand in it, or leap the band as it passes. Neither is mandatory, which is what
// keeps the hop a decision rather than a panic button — the barrage and the spiral
// both ignore it on purpose.
//
// The gap is carved into the RingGeometry itself (thetaStart/thetaLength) rather
// than faked with a texture, so what the player reads is exactly what the hit test
// uses. The wave originates at the boss, not arena centre: the Feastkeeper never
// moves, so the wedge is always readable from where the player actually fights.
// ============================================================
import * as THREE from 'three';
import { CONFIG, ARENA } from '../../../config.js';

const WAVE_SLOTS = 2;                        // phase 2 sends a second before the first clears
const RING_Y = CONFIG.WATER_LEVEL + 0.06;
const START_RADIUS = 2.4;                    // begins just outside the boss's footprint

export class OfferingSlam {
  /**
   * @param {THREE.Scene} scene
   * @param {any} combat  the arena's CombatManager (vfx, hud, player damage door)
   * @param {any} player  PlayerController (knockback + airborne height)
   * @param {object} tuning  the boss's SLAM block
   */
  constructor(scene, combat, player, tuning) {
    this.scene = scene;
    this.combat = combat;
    this.player = player;
    this.tuning = tuning;
    this.maxRadius = ARENA.WALL_RADIUS - 4;

    // Unit ring (inner 1.0, outer 1.12) scaled up in XZ each frame, with the safe
    // wedge removed from the geometry. thetaStart is rotated per wave instead of
    // rebuilding geometry, so a slam allocates nothing.
    this._geo = new THREE.RingGeometry(
      1, 1.12, 64, 1, 0, Math.PI * 2 - tuning.GAP_ARC,
    );
    this._mat = new THREE.MeshBasicMaterial({
      color: 0xffb066, transparent: true, opacity: 0.7,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
    });

    this.waves = [];
    for (let i = 0; i < WAVE_SLOTS; i++) {
      const mesh = new THREE.Mesh(this._geo, this._mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      scene.add(mesh);
      this.waves.push({
        active: false, windup: 0, radius: START_RADIUS,
        gapStart: 0, spent: false, mesh,
        origin: new THREE.Vector3(),
      });
    }
  }

  get busy() { return this.waves.some((w) => w.active); }

  // Arm one wave at `origin`. It holds at its start radius for WINDUP seconds
  // (pulsing, with the gap already visible) before it starts travelling, so the
  // player can pick their answer before anything is moving.
  start(origin, rng = Math.random) {
    const wave = this.waves.find((w) => !w.active);
    if (!wave) return false;
    wave.active = true;
    wave.spent = false;
    wave.windup = this.tuning.WINDUP;
    wave.radius = START_RADIUS;
    wave.gapStart = rng() * Math.PI * 2;
    wave.origin.copy(origin);
    wave.origin.y = RING_Y;

    wave.mesh.position.copy(wave.origin);
    // The geometry runs from thetaStart CCW, so the untouched remainder — the safe
    // wedge — begins where it ends. Ring meshes lie in XY before the -90° X
    // rotation, which flips the winding: negate to keep world and visual in step.
    wave.mesh.rotation.z = -wave.gapStart;
    wave.mesh.scale.set(wave.radius, wave.radius, 1);
    wave.mesh.visible = true;
    return true;
  }

  update(dt, playerPos) {
    for (const wave of this.waves) {
      if (!wave.active) continue;

      if (wave.windup > 0) {
        wave.windup -= dt;
        const pulse = 1 + Math.sin(wave.windup * 14) * 0.06;
        wave.mesh.scale.set(wave.radius * pulse, wave.radius * pulse, 1);
        continue;
      }

      wave.radius += this.tuning.SPEED * dt;
      wave.mesh.scale.set(wave.radius, wave.radius, 1);

      if (!wave.spent) this._testPlayer(wave, playerPos);
      if (wave.radius >= this.maxRadius) this._release(wave);
    }
  }

  // A hit needs all three: inside the moving band, outside the safe wedge, and on
  // the ground. `jumpOffset` is the raw airborne height, so clearing the wave is a
  // timing read against a ~0.80m hop, not a binary "was airborne at any point".
  _testPlayer(wave, playerPos) {
    const dx = playerPos.x - wave.origin.x;
    const dz = playerPos.z - wave.origin.z;
    const dist = Math.hypot(dx, dz);
    if (Math.abs(dist - wave.radius) > this.tuning.BAND) return;
    if (this.player.jumpOffset >= this.tuning.CLEARANCE) return;

    // Bearing relative to the wedge; anything within GAP_ARC of gapStart is safe.
    let bearing = Math.atan2(dz, dx) - wave.gapStart;
    bearing = ((bearing % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    if (bearing <= this.tuning.GAP_ARC) return;

    wave.spent = true;   // one wave can only land once, however long it lingers
    this.combat.damage(this.tuning.DAMAGE, wave.origin);
    this.player.applyKnockback(dx, dz, this.tuning.KNOCK);
  }

  _release(wave) {
    wave.active = false;
    wave.spent = false;
    wave.mesh.visible = false;
  }

  clear() { for (const wave of this.waves) this._release(wave); }

  dispose() {
    this.clear();
    for (const wave of this.waves) this.scene.remove(wave.mesh);
    this.waves.length = 0;
    this._geo.dispose();
    this._mat.dispose();
  }
}
