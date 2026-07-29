// ============================================================
// THREAT BODY — the lifecycle every arena threat shares: materialising in,
// flashing when a bolt lands, dissolving out, and puffing apart on death.
// Arena 1's drowned echoes, Arena 2's river threats, and Arena 3's tower
// sentinels all extend this, so a hit reads the same wherever it happens.
//
// Subclasses own their *body* (geometry, silhouette, AI) and nothing else:
// they build meshes, register the materials that fade and flash, then call
// `updateLifecycle(dt)` at the top of their own update — its return value says
// whether the threat is solid enough to act this frame.
//
// The combat managers own damage and projectiles; a threat only raises intent
// flags (`attackReady`, `spitRequested`, `shotRequested`) for them to consume.
// ============================================================
import * as THREE from 'three';
import { COMBAT } from '../../config.js';

export class ThreatBody {
  constructor(scene, type, {
    hp,
    radius,
    fadeIn = COMBAT.FADE_IN,
    flashDecay = COMBAT.FEEL.FLASH_DECAY,
    flashGain = 1.5,
    poofCount = 8,
    poofColor = 0x9fe8ff,
    poofSize = 0.22,
    // A threat is "solid" (able to move and strike) only past this much fade —
    // nothing gets to damage the player on the frame it appears.
    actThreshold = 0.85,
  }) {
    this.scene = scene;
    this.type = type;
    this.hp = hp;
    this.radius = radius;
    this.alive = true;

    // Intent flags the owning manager consumes and clears each frame.
    this.attackReady = false;
    this.spitRequested = false;

    this._fadeIn = fadeIn;
    this._flashDecay = flashDecay;
    this._flashGain = flashGain;
    this._actThreshold = actThreshold;
    this._fade = 0;              // 0..1 presence, eased toward _fadeTarget
    this._fadeTarget = 1;
    this._flash = 0;             // 1→0 hit envelope on the registered glow

    this._fadeMats = [];         // [material, baseOpacity]
    this._flashMats = [];        // [material, baseEmissiveIntensity]
    this._ownedMats = [];        // disposed with the body

    this._emerge = 0;            // 1→0 rise out of the spawn tear (see beginEmerge)
    this._emergeDepth = 0;
    this._emergeTime = 1;

    this.group = new THREE.Group();
    // Bodies hang off `rig`, not `group`: the AI writes group's XZ (and the
    // subclasses write their own figure's bob every frame), so the emerge lift
    // needs a link of its own that nothing else touches.
    this.rig = new THREE.Group();
    this.group.add(this.rig);
    scene.add(this.group);

    this._buildPoof(poofCount, poofColor, poofSize);
  }

  // ---- material registration (called by subclasses while building) ------

  // Fades this material with the body. `baseOpacity` is its opacity at full
  // presence; transparency is forced on since the dissolve needs it.
  registerFade(material, baseOpacity = material.opacity ?? 1) {
    material.transparent = true;
    this._fadeMats.push([material, baseOpacity]);
    this._own(material);
    return material;
  }

  // Brightens this material on a hit. Only meaningful for emissive materials.
  registerFlash(material) {
    this._flashMats.push([material, material.emissiveIntensity ?? 1]);
    this._own(material);
    return material;
  }

  _own(material) {
    if (!this._ownedMats.includes(material)) this._ownedMats.push(material);
  }

  // ---- spawn ------------------------------------------------------------

  // Come up through the spawn tear: the body starts `depth` metres under its
  // final position and rises over `time`, overlapping the fade-in. The offset
  // is local to `group`, so this works unchanged for the flooded arenas and for
  // Zone 3's threats standing on ledges well above the water.
  beginEmerge(depth, time) {
    this._emerge = 1;
    this._emergeDepth = depth;
    this._emergeTime = Math.max(0.01, time);
    this.rig.position.y = -depth;
  }

  // ---- damage ----------------------------------------------------------

  // A bolt landed. Returns true if this hit killed the threat.
  hit(damage) {
    if (!this.alive) return false;
    this._flash = 1;
    this.hp -= damage;
    if (this.hp > 0) return false;
    this._die();
    return true;
  }

  // Silent removal (leash reset, faint, victory cleanup): dissolves without
  // counting as a kill, so reward hooks never fire for it.
  vanish() {
    if (!this.alive) return;
    this._die();
  }

  _die() {
    this.alive = false;
    this._fadeTarget = 0;
    this._spawnPoof();
  }

  // Fully gone once the dissolve AND the puff have finished — safe to reap.
  get dead() { return !this.alive && this._fade < 0.02 && this._poofLife <= 0; }

  get pos() { return this.group.position; }

  // World-space aim point for hit tests. Bodies with a raised figure override
  // this; the default is the group origin. Overrides must add `emergeOffset`
  // so a body still rising out of its tear is shot where it is drawn.
  center(out) { return out.copy(this.group.position).setY(this.group.position.y + this.emergeOffset); }

  // Metres the body is currently displaced below its resting height (0 once
  // the spawn rise has settled).
  get emergeOffset() { return this.rig.position.y; }

  // ---- death puff -------------------------------------------------------

  // One pre-allocated points cloud per threat, built at spawn: only per-frame
  // allocation is banned, and this mirrors Guardian._spawnPoof at a smaller
  // scale. The shared CombatVfx burst carries the impact; this sells the body
  // coming apart.
  _buildPoof(count, color, size) {
    this._poofCount = count;
    this._poofLife = 0;
    if (count <= 0) return;
    const geometry = new THREE.BufferGeometry();
    this._poofPos = new Float32Array(count * 3);
    this._poofVel = new Float32Array(count * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(this._poofPos, 3));
    this._poofMat = new THREE.PointsMaterial({
      color, size, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this._poof = new THREE.Points(geometry, this._poofMat);
    this._poof.frustumCulled = false;
    this.scene.add(this._poof);
    this._poofCenter = new THREE.Vector3();
  }

  _spawnPoof() {
    if (!this._poof) return;
    this._poof.position.copy(this.center(this._poofCenter));
    for (let i = 0; i < this._poofCount; i++) {
      this._poofPos[i * 3] = 0;
      this._poofPos[i * 3 + 1] = 0;
      this._poofPos[i * 3 + 2] = 0;
      const ax = Math.random() * 2 - 1;
      const ay = Math.random() * 1.4 - 0.3;
      const az = Math.random() * 2 - 1;
      const inv = (1.4 + Math.random() * 1.8) / Math.max(0.001, Math.hypot(ax, ay, az));
      this._poofVel[i * 3] = ax * inv;
      this._poofVel[i * 3 + 1] = ay * inv;
      this._poofVel[i * 3 + 2] = az * inv;
    }
    this._poof.geometry.attributes.position.needsUpdate = true;
    this._poofLife = 1;
    this._poofMat.opacity = 0.85;
  }

  _updatePoof(dt) {
    if (this._poofLife <= 0 || !this._poof) return;
    this._poofLife = Math.max(0, this._poofLife - dt * 1.8);
    for (let i = 0; i < this._poofCount; i++) {
      this._poofPos[i * 3] += this._poofVel[i * 3] * dt;
      this._poofPos[i * 3 + 1] += (this._poofVel[i * 3 + 1] - 0.5) * dt;
      this._poofPos[i * 3 + 2] += this._poofVel[i * 3 + 2] * dt;
    }
    this._poof.geometry.attributes.position.needsUpdate = true;
    this._poofMat.opacity = 0.85 * this._poofLife;
  }

  // ---- per-frame lifecycle ---------------------------------------------

  // Advance presence, hit-flash, and the death puff. Returns true when the
  // threat is alive and solid enough to act — subclasses use it to gate AI:
  //
  //   update(dt, t, playerPos) {
  //     if (!this.updateLifecycle(dt)) return;
  //     ...movement and attacks...
  //   }
  updateLifecycle(dt) {
    this._updatePoof(dt);

    if (this._emerge > 0) {
      this._emerge = Math.max(0, this._emerge - dt / this._emergeTime);
      // Decelerating rise: fast out of the tear, settling into place.
      const eased = this._emerge * this._emerge;
      this.rig.position.y = -this._emergeDepth * eased;
    }

    this._fade += (this._fadeTarget - this._fade) * Math.min(1, dt / this._fadeIn);
    this.group.visible = this._fade > 0.01;
    for (const [material, base] of this._fadeMats) material.opacity = base * this._fade;

    this._flash = Math.max(0, this._flash - dt / this._flashDecay);
    const boost = 1 + this._flash * this._flashGain;
    const extra = this._extraGlow();
    for (const [material, base] of this._flashMats) {
      material.emissiveIntensity = base * boost + extra;
    }

    return this.alive && this._fade >= this._actThreshold;
  }

  // Additive emissive on top of the hit flash — a hook for telegraphs (the
  // Brine Spitter's swelling mouth). Zero unless a subclass overrides it.
  _extraGlow() { return 0; }

  dispose() {
    this._disposed = true;
    this.scene.remove(this.group);
    this.group.traverse((object) => { if (object.geometry) object.geometry.dispose(); });
    for (const material of this._ownedMats) material.dispose();
    this._ownedMats.length = 0;
    if (this._poof) {
      this.scene.remove(this._poof);
      this._poof.geometry.dispose();
      this._poofMat.dispose();
      this._poof = null;
    }
  }
}
