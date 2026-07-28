// ============================================================
// OVERLOAD CHANNEL — The Reveler's beam charge and the coral nodes that cancel it
// (Arena 2 boss).
//
// The set-piece. The Reveler locks down the lane and starts charging; ten coral
// nodes surface across the river, each one a tether feeding the charge. Sever all
// ten and the beam collapses and the boss staggers. Let the ring fill and the lane
// goes white.
//
// The charge ring IS the timer — no DOM, no HUD bar. It is a RingGeometry revealed
// progressively with setDrawRange, which costs one integer write per frame instead
// of rebuilding geometry, and reads as a radial meter wrapped around the boss.
//
// Node HP is stated in BOLTS, not in damage: COMBAT.BOLT.DAMAGE is 1, so a 7-HP
// node is exactly seven hits. The duration in the boss's tuning is derived from
// that — see the arithmetic note on OVERLOAD.DURATION in RevelerBoss.js.
// ============================================================
import * as THREE from 'three';
import { CONFIG, COMBAT, RAIL_ARENA } from '../../../config.js';

const UP = new THREE.Vector3(0, 1, 0);
const RING_SEGMENTS = 72;
const NODE_RADIUS = 0.62;
const BEAM_LENGTH = 60;

export class OverloadChannel {
  /**
   * @param {THREE.Scene} scene
   * @param {any} combat  the arena's CombatManager (bolts, vfx, hud, damage door)
   * @param {any} audio
   * @param {object} tuning  the boss's OVERLOAD block
   */
  constructor(scene, combat, audio, tuning, capacity = 12) {
    this.scene = scene;
    this.combat = combat;
    this.audio = audio;
    this.tuning = tuning;

    this.state = 'idle';   // idle | charging | firing
    this.cancelled = false;  // read once by the boss to award the stagger
    this.remaining = 0;
    this._duration = 1;
    this._beamAge = 0;
    this._clock = 0;       // own clock: ArenaBoss._act only hands down dt

    this._buildChargeRing();
    this._buildNodes(capacity);
    this._buildBeam();
    this._origin = new THREE.Vector3();
  }

  get busy() { return this.state !== 'idle'; }

  get nodesLeft() {
    let n = 0;
    for (const node of this.nodes) if (node.active) n++;
    return n;
  }

  _buildChargeRing() {
    this._ringGeo = new THREE.RingGeometry(2.9, 3.35, RING_SEGMENTS, 1);
    this._ringMat = new THREE.MeshBasicMaterial({
      color: 0xffd08a, transparent: true, opacity: 0.95,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.ring = new THREE.Mesh(this._ringGeo, this._ringMat);
    this.ring.visible = false;
    this.scene.add(this.ring);
  }

  _buildNodes(capacity) {
    this._nodeGeo = new THREE.IcosahedronGeometry(NODE_RADIUS, 0);
    this._tetherGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 5, 1, true);
    this._tetherMat = new THREE.MeshBasicMaterial({
      color: 0xffb066, transparent: true, opacity: 0.45,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });

    this.nodes = [];
    for (let i = 0; i < capacity; i++) {
      // Per-node material: each one dims independently as its HP drops, which is
      // the only damage readout a node gets besides the floating numbers.
      const material = new THREE.MeshStandardMaterial({
        color: 0xffa15c, emissive: 0xff6a2a, emissiveIntensity: 1.9, roughness: 0.5,
      });
      const mesh = new THREE.Mesh(this._nodeGeo, material);
      const tether = new THREE.Mesh(this._tetherGeo, this._tetherMat);
      const group = new THREE.Group();
      group.visible = false;
      group.add(mesh, tether);
      this.scene.add(group);
      this.nodes.push({
        active: false, hp: 0, maxHp: 1, bob: 0, spin: 0,
        group, mesh, tether, material,
      });
    }
    this._vTether = new THREE.Vector3();
  }

  _buildBeam() {
    this._beamGeo = new THREE.CylinderGeometry(0.85, 2.4, BEAM_LENGTH, 12, 1, true);
    this._beamGeo.rotateX(Math.PI / 2);   // lie the barrel down +Z, toward the boat
    this._beamGeo.translate(0, 0, BEAM_LENGTH / 2);
    this._beamMat = new THREE.MeshBasicMaterial({
      color: 0xfff0d0, transparent: true, opacity: 0,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.beam = new THREE.Mesh(this._beamGeo, this._beamMat);
    this.beam.visible = false;
    this.scene.add(this.beam);
  }

  /**
   * Open the channel and surface `count` nodes.
   * @param {number} duration  seconds before the beam fires
   * @param {number} count
   * @param {() => number} rng
   * @param {THREE.Vector3} bossCenter
   */
  start(duration, count, rng, bossCenter) {
    this.state = 'charging';
    this.cancelled = false;
    this.remaining = duration;
    this._duration = duration;
    this._origin.copy(bossCenter);

    const placed = [];
    for (const node of this.nodes) {
      if (placed.length >= count) break;
      const spot = this._pickSpot(rng, placed);
      if (!spot) break;
      placed.push(spot);
      node.active = true;
      node.maxHp = this.tuning.NODE_HP[0]
        + Math.floor(rng() * (this.tuning.NODE_HP[1] - this.tuning.NODE_HP[0] + 1));
      node.hp = node.maxHp;
      node.bob = rng() * Math.PI * 2;
      node.spin = 0.6 + rng() * 0.9;
      node.group.position.set(spot.x, spot.y, spot.z);
      node.group.visible = true;
      node.material.emissiveIntensity = 1.9;
    }

    this.ring.position.copy(bossCenter);
    this.ring.visible = true;
    this._ringGeo.setDrawRange(0, 0);
    this.audio?.playPortalCharge?.();
    return placed.length;
  }

  // Nodes must be spread, not clustered: the pattern is a sweep across the lane,
  // and two nodes on top of each other would hand the player a free double-kill.
  _pickSpot(rng, placed) {
    const [yLow, yHigh] = this.tuning.Y_RANGE;
    const [zNear, zFar] = this.tuning.Z_RANGE;
    const sepSq = this.tuning.SEPARATION ** 2;
    for (let tries = 0; tries < 40; tries++) {
      const x = (rng() * 2 - 1) * RAIL_ARENA.RIVER_X_LIMIT;
      const y = CONFIG.WATER_LEVEL + yLow + rng() * (yHigh - yLow);
      const z = zNear + rng() * (zFar - zNear);
      let clear = true;
      for (const spot of placed) {
        const dx = x - spot.x;
        const dy = y - spot.y;
        const dz = z - spot.z;
        if (dx * dx + dy * dy + dz * dz < sepSq) { clear = false; break; }
      }
      if (clear) return { x, y, z };
    }
    return null;
  }

  /** @param {THREE.Vector3} bossCenter */
  update(dt, bossCenter) {
    this._clock += dt;
    if (this.state === 'firing') { this._updateBeam(dt); return; }
    if (this.state !== 'charging') return;

    this._origin.copy(bossCenter);
    this.ring.position.copy(bossCenter);
    this.ring.position.z += 1.1;
    this.ring.rotation.z += dt * 0.6;

    this.remaining -= dt;
    const charge = 1 - Math.max(0, this.remaining) / this._duration;
    // Reveal the ring one segment at a time: 6 indices per segment quad.
    this._ringGeo.setDrawRange(0, Math.floor(charge * RING_SEGMENTS) * 6);
    this._ringMat.opacity = 0.6 + Math.sin(this._clock * (6 + charge * 14)) * 0.15 + charge * 0.3;

    this._updateNodes(dt, bossCenter);
    this._checkPlayerBolts();

    if (this.nodesLeft === 0) { this._cancel(); return; }
    if (this.remaining <= 0) this._fire();
  }

  _updateNodes(dt, bossCenter) {
    for (const node of this.nodes) {
      if (!node.active) continue;
      node.mesh.rotation.x += node.spin * dt;
      node.mesh.rotation.y += node.spin * 1.4 * dt;
      node.mesh.position.y = Math.sin(this._clock * 1.8 + node.bob) * 0.14;

      // Aim the tether at the boss and stretch the unit cylinder to reach it, so
      // every node visibly feeds the charge it is holding open.
      this._vTether.copy(bossCenter).sub(node.group.position);
      const length = this._vTether.length();
      node.tether.scale.set(1, length, 1);
      node.tether.position.copy(this._vTether).multiplyScalar(0.5);
      // CylinderGeometry runs along +Y; point that at the boss.
      node.tether.quaternion.setFromUnitVectors(UP, this._vTether.normalize());
    }
  }

  _checkPlayerBolts() {
    const hitRadiusSq = (NODE_RADIUS + COMBAT.BOLT.RADIUS) ** 2;
    for (const bolt of this.combat.bolts.slots) {
      if (!bolt.active) continue;
      for (const node of this.nodes) {
        if (!node.active) continue;
        if (bolt.mesh.position.distanceToSquared(node.group.position) > hitRadiusSq) continue;
        this.combat.bolts.deactivate(bolt);
        this._damageNode(node, bolt.mesh.position);
        break;
      }
    }
  }

  _damageNode(node, impact) {
    const dealt = Math.min(node.hp, this.combat.boltDamage);
    node.hp -= this.combat.boltDamage;
    this.combat.hud.hitMarker();
    this.combat.hud.popupDamage(impact, dealt);
    if (node.hp > 0) {
      node.material.emissiveIntensity = 0.6 + (node.hp / node.maxHp) * 1.3;
      this.combat.vfx.impact(node.group.position, 'bolt');
      this.audio?.playHit?.();
      this.combat.registerPlayerBoltHit(false);
      return;
    }
    node.active = false;
    node.group.visible = false;
    this.combat.vfx.burst(node.group.position, 0xffa15c, 1.3);
    this.combat.vfx.ring(node.group.position, 0xffd08a, { duration: 0.5, endScale: 2.6 });
    this.combat.hud.popupCallout(node.group.position, `${this.nodesLeft} LEFT`);
    this.audio?.playEnemyDeath?.();
    this.combat.registerPlayerBoltHit(true);
  }

  // All tethers cut. The beam never fires; the boss is left wide open.
  _cancel() {
    this.cancelled = true;
    this.state = 'idle';
    this.ring.visible = false;
    this.combat.vfx.ring(this._origin, 0x7fe8ff, { duration: 0.9, endScale: 6 });
    this.combat.vfx.burst(this._origin, 0x7fe8ff, 2);
    this.audio?.playArmorBreak?.(true);
  }

  _fire() {
    this.state = 'firing';
    this._beamAge = 0;
    this.ring.visible = false;
    this.beam.position.copy(this._origin);
    this.beam.visible = true;
    this._beamMat.opacity = 1;
    this.combat.vfx.burst(this._origin, 0xfff0d0, 2.4);
    this.combat.damage(this.tuning.BEAM_DAMAGE, this._origin);
    this.audio?.playPortalImpact?.();
    // Surviving nodes go with the beam — they were the cancel, and leaving them
    // floating afterwards would read as unfinished business the player can't act on.
    for (const node of this.nodes) {
      if (!node.active) continue;
      node.active = false;
      node.group.visible = false;
    }
  }

  _updateBeam(dt) {
    this._beamAge += dt;
    const fade = 1 - Math.min(1, this._beamAge / this.tuning.BEAM_HOLD);
    this._beamMat.opacity = fade;
    this.beam.scale.set(fade * 0.6 + 0.4, fade * 0.6 + 0.4, 1);
    if (fade > 0) return;
    this.beam.visible = false;
    this.state = 'idle';
  }

  clear() {
    this.state = 'idle';
    this.cancelled = false;
    this.ring.visible = false;
    this.beam.visible = false;
    for (const node of this.nodes) {
      node.active = false;
      node.group.visible = false;
    }
  }

  dispose() {
    this.clear();
    for (const node of this.nodes) {
      this.scene.remove(node.group);
      node.material.dispose();
    }
    this.nodes.length = 0;
    this.scene.remove(this.ring);
    this.scene.remove(this.beam);
    this._ringGeo.dispose();
    this._ringMat.dispose();
    this._nodeGeo.dispose();
    this._tetherGeo.dispose();
    this._tetherMat.dispose();
    this._beamGeo.dispose();
    this._beamMat.dispose();
  }
}
