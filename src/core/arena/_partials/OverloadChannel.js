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
const FORWARD = new THREE.Vector3(0, 0, 1);
const RING_SEGMENTS = 72;
const NODE_RADIUS = 0.62;
const BEAM_LENGTH = 60;
const LIVE_NODE_NEAR = 4;
const LIVE_ARENA_PADDING = 2;

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
    this._liveTarget = new THREE.Vector3();
    this._forward = new THREE.Vector3(0, 0, 1);
    this._right = new THREE.Vector3(1, 0, 0);
    this._beamDirection = new THREE.Vector3();
    this._livePlacement = false;
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
      const node = {
        active: false, hp: 0, maxHp: 1, bob: 0, spin: 0,
        group, mesh, tether, material,
      };
      node.playerAttackTarget = {
        kind: 'reveler-overload',
        center: group.position,
        radius: NODE_RADIUS,
        node,
      };
      this.nodes.push(node);
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
  start(duration, count, rng, bossCenter, liveTarget = null) {
    this.state = 'charging';
    this.cancelled = false;
    this.remaining = duration;
    this._duration = duration;
    this._origin.copy(bossCenter);
    this._livePlacement = !!liveTarget;
    if (this._livePlacement) this._setLiveBasis(bossCenter, liveTarget);

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
    if (this._livePlacement) return this._pickLiveSpot(rng, placed);
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

  _pickLiveSpot(rng, placed) {
    const [yLow, yHigh] = this.tuning.Y_RANGE;
    const sepSq = this.tuning.SEPARATION ** 2;
    const combatRadius = this.combat.world?.survivalBounds?.combatRadius || 29.5;
    const placementRadius = Math.max(8, combatRadius - LIVE_ARENA_PADDING);
    const originProjection =
      this._origin.x * this._forward.x + this._origin.z * this._forward.z;
    const originRadiusSq =
      this._origin.x * this._origin.x + this._origin.z * this._origin.z;
    const edgeDistance = -originProjection + Math.sqrt(Math.max(
      0,
      originProjection * originProjection +
        placementRadius * placementRadius - originRadiusSq,
    ));
    const far = Math.max(LIVE_NODE_NEAR, edgeDistance);
    for (let tries = 0; tries < 40; tries++) {
      const lateral = (rng() * 2 - 1) * RAIL_ARENA.RIVER_X_LIMIT;
      const depth = LIVE_NODE_NEAR + rng() * (far - LIVE_NODE_NEAR);
      const x = this._origin.x + this._right.x * lateral + this._forward.x * depth;
      const y = CONFIG.WATER_LEVEL + yLow + rng() * (yHigh - yLow);
      const z = this._origin.z + this._right.z * lateral + this._forward.z * depth;
      if (x * x + z * z > placementRadius * placementRadius) continue;
      if (this.combat.world?.collidesAt(x, z, NODE_RADIUS + 0.15, y)) continue;
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

  _setLiveBasis(origin, target) {
    this._liveTarget.copy(target);
    this._forward.copy(target).sub(origin);
    this._forward.y = 0;
    if (this._forward.lengthSq() < 0.0001) this._forward.copy(FORWARD);
    else this._forward.normalize();
    this._right.set(this._forward.z, 0, -this._forward.x);
  }

  /** @param {THREE.Vector3} bossCenter */
  update(dt, bossCenter, liveTarget = null) {
    this._clock += dt;
    if (this.state === 'firing') { this._updateBeam(dt); return; }
    if (this.state !== 'charging') return;

    this._origin.copy(bossCenter);
    if (this._livePlacement && liveTarget) {
      this._setLiveBasis(bossCenter, liveTarget);
      this.ring.position.copy(bossCenter).addScaledVector(this._forward, 1.1);
      this.ring.quaternion.setFromUnitVectors(FORWARD, this._forward);
      this.ring.rotateZ(this._clock * 0.6);
    } else {
      this.ring.position.copy(bossCenter);
      this.ring.position.z += 1.1;
      this.ring.rotation.z += dt * 0.6;
    }

    this.remaining -= dt;
    const charge = 1 - Math.max(0, this.remaining) / this._duration;
    // Reveal the ring one segment at a time: 6 indices per segment quad.
    this._ringGeo.setDrawRange(0, Math.floor(charge * RING_SEGMENTS) * 6);
    this._ringMat.opacity = 0.6 + Math.sin(this._clock * (6 + charge * 14)) * 0.15 + charge * 0.3;

    this._updateNodes(dt, bossCenter);
    if (!this.combat.boss?.externalHitResolution) this._checkPlayerBolts();

    if (this.nodesLeft === 0) { this._cancel(); return; }
    if (this.remaining <= 0) {
      this._fire(this._livePlacement ? this._liveTarget : null);
    }
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
        this._damageNode(node, bolt.mesh.position, this.combat.boltDamage);
        break;
      }
    }
  }

  appendPlayerAttackTargets(targets) {
    for (const node of this.nodes) {
      if (node.active) targets.push(node.playerAttackTarget);
    }
  }

  receivePlayerAttack(target, attack = {}) {
    const node = target?.node;
    if (!node?.active) return { hit: false, defeated: false };
    const damage = Math.max(0, Number(attack.damage) || 0);
    if (damage <= 0) return { hit: false, defeated: false };
    return this._damageNode(node, attack.position || node.group.position, damage);
  }

  _damageNode(node, impact, damage) {
    const dealt = Math.min(node.hp, damage);
    node.hp -= damage;
    this.combat.hud.hitMarker();
    this.combat.hud.popupDamage(impact, dealt);
    if (node.hp > 0) {
      node.material.emissiveIntensity = 0.6 + (node.hp / node.maxHp) * 1.3;
      this.combat.vfx.impact(node.group.position, 'bolt');
      this.audio?.playHit?.();
      this.combat.registerPlayerBoltHit(false);
      return { hit: true, defeated: false, applied: dealt };
    }
    node.active = false;
    node.group.visible = false;
    this.combat.vfx.burst(node.group.position, 0xffa15c, 1.3);
    this.combat.vfx.ring(node.group.position, 0xffd08a, { duration: 0.5, endScale: 2.6 });
    this.combat.hud.popupCallout(node.group.position, `${this.nodesLeft} LEFT`);
    this.audio?.playEnemyDeath?.();
    this.combat.registerPlayerBoltHit(true);
    return { hit: true, defeated: true, applied: dealt };
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

  _fire(liveTarget = null) {
    this.state = 'firing';
    this._beamAge = 0;
    this.ring.visible = false;
    this.beam.position.copy(this._origin);
    if (liveTarget) {
      this._beamDirection.copy(liveTarget).sub(this._origin);
      if (this._beamDirection.lengthSq() < 0.0001) this._beamDirection.copy(FORWARD);
      else this._beamDirection.normalize();
      this.beam.quaternion.setFromUnitVectors(FORWARD, this._beamDirection);
    } else {
      this.beam.quaternion.identity();
    }
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
