// ============================================================
// LUMINA MANAGER — pooled arena rewards dropped by lesser echoes.
// Scheduled enemies roll the base chance; wrong-answer penalty enemies pass a
// reduced multiplier. Orbs can be collected by walking over them or by hitting
// them with a surviving player bolt after enemy collisions resolve.
// ============================================================
import * as THREE from 'three';
import { LUMINA, mulberry32 } from '../../config.js';

const VITALITY = 'vitality';
const ZEPHYR = 'zephyr';
const OVERCHARGE = 'overcharge';

export class LuminaManager {
  constructor(scene, player, audio, profile = {}) {
    this.scene = scene;
    this.player = player;
    this.audio = audio;
    this.profile = {
      autoCollect: false,
      collectTime: LUMINA.COLLECT_TIME,
      dropChance: LUMINA.DROP_CHANCE,
      heal: LUMINA.HEAL,
      zephyrDuration: LUMINA.ZEPHYR_DURATION,
      overchargeDuration: LUMINA.OVERCHARGE_DURATION,
      onZephyr: null,
      preserveDropHeight: false,
      walkVerticalRadius: Infinity,
      ...profile,
    };
    this.combat = null;
    this._rng = mulberry32(LUMINA.SEED);
    this._zephyrRemaining = 0;
    this._overchargeRemaining = 0;
    this._zephyrDisplayTick = -1;
    this._overchargeDisplayTick = -1;

    this.elStatus = document.getElementById('lumina-status');
    this.elZephyr = document.getElementById('lumina-zephyr');
    this.elZephyrTime = document.getElementById('lumina-zephyr-time');
    this.elOvercharge = document.getElementById('lumina-overcharge');
    this.elOverchargeTime = document.getElementById('lumina-overcharge-time');

    this._coreGeometry = new THREE.IcosahedronGeometry(LUMINA.ORB_RADIUS, 1);
    this._cageGeometry = new THREE.IcosahedronGeometry(LUMINA.ORB_RADIUS * 1.45, 1);
    this._materials = {};
    this._cageMaterials = {};
    for (const type of [VITALITY, ZEPHYR, OVERCHARGE]) {
      const color = LUMINA.COLORS[type];
      this._materials[type] = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      this._cageMaterials[type] = new THREE.MeshBasicMaterial({
        color,
        wireframe: true,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
    }

    this.slots = [];
    for (let i = 0; i < LUMINA.POOL_SIZE; i++) {
      const group = new THREE.Group();
      const core = new THREE.Mesh(this._coreGeometry, this._materials[VITALITY]);
      const cage = new THREE.Mesh(this._cageGeometry, this._cageMaterials[VITALITY]);
      group.add(core, cage);
      group.visible = false;
      scene.add(group);
      this.slots.push({
        active: false,
        collecting: false,
        type: VITALITY,
        life: 0,
        baseY: LUMINA.HEIGHT,
        bobPhase: 0,
        collectTime: 0,
        effectApplied: false,
        collectStart: new THREE.Vector3(),
        group,
        core,
        cage,
      });
    }
  }

  beginAttempt(combat, seed) {
    this.reset(seed);
    this.combat = combat;
  }

  configure(profile = {}) {
    Object.assign(this.profile, profile);
  }

  // One call per genuine enemy kill. The drop multiplier distinguishes normal
  // scheduled waves (1.0) from wrong-answer penalty waves (0.5).
  tryDrop(position, dropMultiplier = 1) {
    if (!this.combat || this._rng() >= this.profile.dropChance * dropMultiplier) return false;
    return this.drop(position);
  }

  // Spawn a guaranteed reward. Boss mechanics can own their own probability
  // roll while still reusing the same pooled Lumina pickup and effect rules.
  drop(position) {
    if (!this.combat) return false;
    const type = this._selectType(this.combat.hp / this.combat.maxHp);
    const slot = this._availableSlot();
    slot.active = true;
    slot.collecting = false;
    slot.type = type;
    slot.life = LUMINA.LIFETIME;
    slot.baseY = this.profile.preserveDropHeight ? position.y : LUMINA.HEIGHT;
    slot.bobPhase = this._rng() * Math.PI * 2;
    slot.collectTime = 0;
    slot.effectApplied = false;
    slot.group.position.set(position.x, slot.baseY, position.z);
    slot.group.rotation.set(0, this._rng() * Math.PI * 2, 0);
    slot.group.scale.setScalar(1);
    slot.core.material = this._materials[type];
    slot.cage.material = this._cageMaterials[type];
    slot.group.visible = true;
    if (this.profile.autoCollect) this._collect(slot);
    return true;
  }

  update(dt, t, playerPos, paused = false) {
    if (paused || !this.combat) return;
    this._updateBuffs(dt);

    const walkRadiusSq = LUMINA.WALK_RADIUS * LUMINA.WALK_RADIUS;
    for (const slot of this.slots) {
      if (!slot.active) continue;

      if (slot.collecting) {
        slot.collectTime += dt;
        const p = Math.min(1, slot.collectTime / this.profile.collectTime);
        if (this.profile.autoCollect) {
          slot.group.position.lerpVectors(slot.collectStart, playerPos, p);
          slot.group.position.y += Math.sin(p * Math.PI) * 0.9;
          slot.group.scale.setScalar(1 + Math.sin(p * Math.PI) * 0.7);
        } else {
          slot.group.scale.setScalar(1 + p * 1.15);
          slot.group.position.y = slot.baseY + p * 0.9;
        }
        if (p >= 1) {
          this._applyEffect(slot);
          this._deactivate(slot);
        }
        continue;
      }

      slot.life -= dt;
      if (slot.life <= 0) {
        this._deactivate(slot);
        continue;
      }

      const pulse = 1 + Math.sin(t * 4 + slot.bobPhase) * 0.08;
      slot.group.scale.setScalar(pulse);
      slot.group.position.y = slot.baseY +
        Math.sin(t * LUMINA.BOB_SPEED + slot.bobPhase) * LUMINA.BOB_HEIGHT;
      slot.group.rotation.y += dt * 1.5;
      slot.cage.rotation.x += dt * 0.9;
      slot.cage.rotation.z -= dt * 0.7;

      const dx = playerPos.x - slot.group.position.x;
      const dz = playerPos.z - slot.group.position.z;
      const dy = playerPos.y - slot.group.position.y;
      if (dx * dx + dz * dz <= walkRadiusSq &&
          Math.abs(dy) <= this.profile.walkVerticalRadius) this._collect(slot);
    }

    // Combat resolves enemy hits before ArenaController reaches this update,
    // so only surviving bolts can collect Lumina.
    for (const bolt of this.combat.bolts.slots) {
      if (!bolt.active) continue;
      for (const slot of this.slots) {
        if (!slot.active || slot.collecting) continue;
        const rr = LUMINA.BOLT_RADIUS * LUMINA.BOLT_RADIUS;
        if (bolt.mesh.position.distanceToSquared(slot.group.position) > rr) continue;
        this.combat.bolts.deactivate(bolt);
        this._collect(slot);
        break;
      }
    }
  }

  _selectType(hpRatio) {
    const roll = this._rng();
    if (hpRatio >= 0.999) return roll < 0.5 ? ZEPHYR : OVERCHARGE;
    if (hpRatio <= 0.5) {
      if (roll < 0.6) return VITALITY;
      return roll < 0.8 ? ZEPHYR : OVERCHARGE;
    }
    if (roll < 1 / 3) return VITALITY;
    return roll < 2 / 3 ? ZEPHYR : OVERCHARGE;
  }

  _availableSlot() {
    for (const slot of this.slots) if (!slot.active) return slot;
    let oldest = this.slots[0];
    for (let i = 1; i < this.slots.length; i++) {
      if (this.slots[i].life < oldest.life) oldest = this.slots[i];
    }
    this._deactivate(oldest);
    return oldest;
  }

  _collect(slot) {
    if (!slot.active || slot.collecting) return;
    slot.collecting = true;
    slot.collectTime = 0;
    slot.effectApplied = false;
    slot.collectStart.copy(slot.group.position);

    // Arena 1 keeps its immediate pickup response; Arena 2 applies the reward
    // when the automatically magnetized orb reaches the boat.
    if (!this.profile.autoCollect) this._applyEffect(slot);
  }

  _applyEffect(slot) {
    if (slot.effectApplied) return;
    slot.effectApplied = true;
    if (slot.type === VITALITY) {
      this.combat.heal(this.profile.heal);
    } else if (slot.type === ZEPHYR) {
      this._zephyrRemaining = this.profile.zephyrDuration;
      if (this.profile.onZephyr) this.profile.onZephyr(true);
      else this.player.setZephyr(true, LUMINA.ZEPHYR_SPEED_MULT);
    } else {
      this._overchargeRemaining = this.profile.overchargeDuration;
      this.combat.setOvercharge(true, LUMINA.OVERCHARGE_DAMAGE_MULT);
    }
    this.audio.playLuminaPickup();
    this._syncHud(true);
    document.dispatchEvent(new CustomEvent('strings:lumina-effect', {
      detail: { type: slot.type },
    }));
  }

  _updateBuffs(dt) {
    if (this._zephyrRemaining > 0) {
      this._zephyrRemaining = Math.max(0, this._zephyrRemaining - dt);
      if (this._zephyrRemaining <= 0) {
        if (this.profile.onZephyr) this.profile.onZephyr(false);
        else this.player.setZephyr(false);
      }
    }
    if (this._overchargeRemaining > 0) {
      this._overchargeRemaining = Math.max(0, this._overchargeRemaining - dt);
      if (this._overchargeRemaining <= 0) this.combat.setOvercharge(false);
    }
    this._syncHud();
  }

  _syncHud(force = false) {
    const zephyrActive = this._zephyrRemaining > 0;
    const overchargeActive = this._overchargeRemaining > 0;
    if (this.elStatus) this.elStatus.classList.toggle('active', zephyrActive || overchargeActive);
    if (this.elZephyr) this.elZephyr.classList.toggle('active', zephyrActive);
    if (this.elOvercharge) this.elOvercharge.classList.toggle('active', overchargeActive);

    const zephyrTick = Math.ceil(this._zephyrRemaining * 10);
    if (force || zephyrTick !== this._zephyrDisplayTick) {
      this._zephyrDisplayTick = zephyrTick;
      if (this.elZephyrTime) this.elZephyrTime.textContent = (zephyrTick / 10).toFixed(1) + 's';
    }
    const overchargeTick = Math.ceil(this._overchargeRemaining * 10);
    if (force || overchargeTick !== this._overchargeDisplayTick) {
      this._overchargeDisplayTick = overchargeTick;
      if (this.elOverchargeTime) {
        this.elOverchargeTime.textContent = (overchargeTick / 10).toFixed(1) + 's';
      }
    }
  }

  _deactivate(slot) {
    slot.active = false;
    slot.collecting = false;
    slot.life = 0;
    slot.group.visible = false;
    slot.group.scale.setScalar(1);
  }

  reset(seed = LUMINA.SEED) {
    for (const slot of this.slots) this._deactivate(slot);
    this._rng = mulberry32(seed >>> 0);
    this._zephyrRemaining = 0;
    this._overchargeRemaining = 0;
    if (this.profile.onZephyr) this.profile.onZephyr(false);
    else this.player.setZephyr(false);
    if (this.combat) this.combat.setOvercharge(false);
    this._syncHud(true);
  }

  dispose() {
    this.reset();
    this.combat = null;
    for (const slot of this.slots) this.scene.remove(slot.group);
    this.slots.length = 0;
    this._coreGeometry.dispose();
    this._cageGeometry.dispose();
    for (const material of Object.values(this._materials)) material.dispose();
    for (const material of Object.values(this._cageMaterials)) material.dispose();
  }
}
