// ============================================================
// TOWER THREAT — fixed Gargoyle sentries and flying Gale shooters for Arena 3.
// The combat manager owns damage and projectiles; threats publish attack intent
// only after their authored telegraphs have completed.
// ============================================================
import * as THREE from 'three';
import { TOWER_ARENA } from '../../config.js';
import { fadeMat, angDelta } from '../guardians/primitives.js';
import { attachAquaticSpiritVisual } from '../combat/AquaticSpiritVisual.js';
import { ThreatBody } from '../combat/ThreatBody.js';

const GARGOYLE_GLOW = 0xffc75a;
const GALE_GLOW = 0x8fe8ff;
const VERTICAL_MARKER_BAND = 2.25;
const GARGOYLE_TIER_TOLERANCE = 0.9;

function localToWorld(anchor, localX, localZ, out) {
  const sin = Math.sin(anchor.rotation);
  const cos = Math.cos(anchor.rotation);
  out.x = anchor.x + cos * localX + sin * localZ;
  out.z = anchor.z - sin * localX + cos * localZ;
  const progress = Math.max(0, Math.min(1, (localZ + anchor.halfD) / (anchor.halfD * 2)));
  out.y = anchor.startHeight + (anchor.endHeight - anchor.startHeight) * progress;
  return out;
}

export class TowerThreat extends ThreatBody {
  constructor(scene, world, type, anchor, player, options = {}) {
    const baseCfg = type === 'gargoyle' ? TOWER_ARENA.GARGOYLE : TOWER_ARENA.GALE;
    const cfg = { ...baseCfg, ...(options.profile || {}) };
    super(scene, type, {
      hp: cfg.HP,
      radius: cfg.RADIUS,
      fadeIn: options.placed ? 0.01 : 0.4,
      flashDecay: 0.18,
      flashGain: 1.8,
      poofColor: type === 'gargoyle' ? GARGOYLE_GLOW : GALE_GLOW,
    });
    this.world = world;
    this.player = player;
    this.cfg = cfg;
    // The squid sentry's broad mantle and tentacles need a wider target than its
    // compact movement blocker. This affects player bolts only; melee spacing,
    // attacks, and navigation continue to use the authored gameplay radius.
    this.boltRadius = type === 'gargoyle' ? 1.3 : this.radius;
    this.anchor = anchor;
    this.hudVisible = true;
    this.projectileDamage = cfg.DAMAGE;
    this.projectileKnockback = cfg.KNOCKBACK;
    this._rng = options.rng || Math.random;
    this._phase = this._rng() * Math.PI * 2;
    this._state = 'idle';
    this._timer = type === 'gale'
      ? cfg.SHOT_INTERVAL * (0.55 + this._rng() * 0.35)
      : 0;
    this._scratch = new THREE.Vector3();

    TowerThreat.portalPosition(anchor, type, this._scratch, options);
    this.group.position.copy(this._scratch);
    this._fixedX = this.group.position.x;
    this._fixedZ = this.group.position.z;
    if (type === 'gargoyle') {
      this.hudVisible = Math.abs(player.eyeBase - this.group.position.y) <= VERTICAL_MARKER_BAND;
    }
    this._buildBody();
    attachAquaticSpiritVisual(this);
    this.applyPresentation(options.presentation);
    if (options.placed) this._fade = 1;
  }

  static portalPosition(anchor, type, out, options = {}) {
    if (anchor.spawnX !== undefined) {
      return out.set(anchor.spawnX, anchor.spawnY, anchor.spawnZ);
    }
    if (type === 'gargoyle') {
      localToWorld(anchor, anchor.localX || 0, anchor.localZ || 0, out);
      out.y += 0.06;
      return out;
    }
    return out.set(anchor.x, anchor.y + 1.4, anchor.z);
  }

  _buildBody() {
    const isGargoyle = this.type === 'gargoyle';
    const glow = isGargoyle ? GARGOYLE_GLOW : GALE_GLOW;
    this._bodyMat = this.registerFade(fadeMat(
      isGargoyle ? 0x34333a : 0x183b4a,
      isGargoyle ? 0x756552 : 0x3a8794,
      0.6,
      0.92,
    ));
    this._glowMat = this.registerFlash(this.registerFade(
      fadeMat(0xf8fbff, glow, 2.2, 0.96, 0.35, 0),
    ));
    this.figure = new THREE.Group();
    this.rig.add(this.figure);

    if (isGargoyle) this._buildGargoyle();
    else this._buildGale();
  }

  _buildGargoyle() {
    const body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.48, 0), this._bodyMat);
    body.position.y = 0.72;
    body.scale.set(0.86, 1.35, 0.82);
    this.figure.add(body);
    const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3, 0), this._bodyMat);
    head.position.set(0, 1.34, -0.08);
    this.figure.add(head);
    this._wings = new THREE.Group();
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.25, 4), this._bodyMat);
      wing.position.set(side * 0.58, 0.84, 0.08);
      wing.rotation.z = side * 0.92;
      wing.rotation.x = -0.22;
      this._wings.add(wing);
      const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 0), this._glowMat);
      eye.position.set(side * 0.1, 1.38, -0.28);
      this.figure.add(eye);
    }
    this.figure.add(this._wings);
    this._muzzle = head;
  }

  _buildGale() {
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.44, 1), this._bodyMat);
    body.scale.set(1.4, 0.75, 0.8);
    this.figure.add(body);
    for (const side of [-1, 1]) {
      const ribbon = new THREE.Mesh(new THREE.ConeGeometry(0.11, 1.1, 5), this._bodyMat);
      ribbon.position.set(side * 0.46, -0.05, 0.38);
      ribbon.rotation.z = side * 0.65;
      ribbon.rotation.x = Math.PI / 2;
      this.figure.add(ribbon);
    }
    this._muzzle = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), this._glowMat);
    this._muzzle.position.set(0, 0, -0.48);
    this.figure.add(this._muzzle);
  }

  center(out) {
    return out.set(
      this.group.position.x,
      this.group.position.y + (this.type === 'gargoyle' ? 0.85 : 0) + this.emergeOffset,
      this.group.position.z,
    );
  }

  muzzle(out) { return this._muzzle.getWorldPosition(out); }

  blocksPlayerAt(x, z, radius, y) {
    if (!this.alive || this.type !== 'gargoyle') return false;
    if (Math.abs(y - this.group.position.y) > GARGOYLE_TIER_TOLERANCE) return false;
    return Math.hypot(x - this.group.position.x, z - this.group.position.z) < radius + this.radius;
  }

  _facePlayer(dt, playerPos) {
    const dx = playerPos.x - this.group.position.x;
    const dz = playerPos.z - this.group.position.z;
    const yaw = Math.atan2(dx, dz) + Math.PI;
    this.group.rotation.y += angDelta(this.group.rotation.y, yaw) * Math.min(1, dt * 7);
    return Math.hypot(dx, dz);
  }

  _updateGargoyle(dt, playerPos) {
    const distance = this._facePlayer(dt, playerPos);
    const tierDelta = Math.abs(this.player.eyeBase - this.group.position.y);
    const sameTier = tierDelta <= GARGOYLE_TIER_TOLERANCE;
    this.hudVisible = tierDelta <= VERTICAL_MARKER_BAND;
    if (this._state === 'windup') {
      this._timer -= dt;
      const progress = 1 - Math.max(0, this._timer) / this.cfg.TELEGRAPH;
      this._wings.rotation.x = -progress * 0.82;
      if (this._timer <= 0) {
        if (sameTier && distance <= this.cfg.ATTACK_RANGE) this.attackReady = true;
        this._state = 'cooldown';
        this._timer = this.cfg.ATTACK_INTERVAL;
      }
      return;
    }
    this._wings.rotation.x += (0 - this._wings.rotation.x) * Math.min(1, dt * 8);
    if (this._state === 'cooldown') {
      this._timer -= dt;
      if (this._timer <= 0) this._state = 'idle';
      return;
    }
    if (sameTier && distance <= this.cfg.ATTACK_RANGE) {
      this._state = 'windup';
      this._timer = this.cfg.TELEGRAPH;
    }
  }

  _updateGalePosition(dt, t, playerPos) {
    const follow = Math.min(1, dt * this.cfg.HEIGHT_FOLLOW);
    this.group.position.x = this._fixedX;
    this.group.position.z = this._fixedZ;
    this.group.position.y += (playerPos.y - this.group.position.y) * follow;
    this.figure.position.y = Math.sin(t * 2.5 + this._phase) * 0.14;
  }

  _updateGale(dt, t, playerPos) {
    this._facePlayer(dt, playerPos);
    if (this._state === 'windup') {
      this._timer -= dt;
      const progress = 1 - Math.max(0, this._timer) / this.cfg.SHOT_TELEGRAPH;
      this._muzzle.scale.setScalar(1 + progress * 1.6);
      if (this._timer <= 0) {
        this._state = 'cooldown';
        this._timer = this.cfg.SHOT_INTERVAL;
        this._muzzle.scale.setScalar(1);
        this.spitRequested = true;
      }
      return;
    }
    this._timer -= dt;
    if (this._timer <= 0) {
      this._state = 'windup';
      this._timer = this.cfg.SHOT_TELEGRAPH;
    }
  }

  update(dt, t, playerPos) {
    const solid = this.updateLifecycle(dt);
    if (!this.alive) return;
    if (this.type === 'gale') this._updateGalePosition(dt, t, playerPos);
    if (!solid) return;
    if (this.type === 'gargoyle') this._updateGargoyle(dt, playerPos);
    else this._updateGale(dt, t, playerPos);
  }

  _extraGlow() {
    if (this._state !== 'windup') return 0;
    const duration = this.type === 'gargoyle' ? this.cfg.TELEGRAPH : this.cfg.SHOT_TELEGRAPH;
    return (1 - Math.max(0, this._timer) / duration) * 3.2;
  }
}
