// ============================================================
// RAIL THREAT — Arena 2 target lifecycle shared by River Snipers and Frenzied
// Boarders. The rail combat manager owns damage/projectiles; threats only emit
// shot/attack intents and expose the same alive/hit/vanish/dead/center contract
// used by the existing arena enemies.
// ============================================================
import * as THREE from 'three';
import { CONFIG, RAIL_ARENA } from '../../config.js';
import { fadeMat, angDelta } from '../guardians/primitives.js';

export class RailThreat {
  constructor(scene, type, x, z, rng) {
    this.scene = scene;
    this.type = type;
    this.cfg = type === 'sniper' ? RAIL_ARENA.SNIPER : RAIL_ARENA.BOARDER;
    this.hp = this.cfg.HP;
    this.radius = this.cfg.RADIUS;
    this.alive = true;
    this.shotRequested = false;
    this.attackReady = false;
    this._fade = 0;
    this._fadeTarget = 1;
    this._flash = 0;
    this._phase = rng() * Math.PI * 2;
    this._timer = type === 'sniper' ? this.cfg.SHOT_INTERVAL * (0.45 + rng() * 0.35) : 0;
    this._boardState = 'approach';

    this.group = new THREE.Group();
    this.group.position.set(x, 0, z);
    this.figure = new THREE.Group();
    this.figure.position.y = CONFIG.WATER_LEVEL + (type === 'sniper' ? 2.3 : 1.1);
    this.group.add(this.figure);

    const isSniper = type === 'sniper';
    this.bodyMat = fadeMat(isSniper ? 0x213b42 : 0x543238,
      isSniper ? 0x56cbd0 : 0xe46f5b, 0.5, 0.9);
    this.glowMat = fadeMat(0xfff2c4, isSniper ? 0x7fe8ff : 0xff765f, 1.7, 0.95, 0.35, 0);
    this._glowBase = this.glowMat.emissiveIntensity;
    this.fadeMats = [[this.bodyMat, 0.9], [this.glowMat, 0.95]];
    this._buildBody(isSniper);
    scene.add(this.group);

    this._center = new THREE.Vector3();
  }

  _buildBody(isSniper) {
    if (isSniper) {
      const perch = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.42, 3.2, 7), this.bodyMat);
      perch.position.y = -1.4;
      this.figure.add(perch);
      const torso = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.5, 7), this.bodyMat);
      torso.rotation.x = Math.PI;
      this.figure.add(torso);
      const mask = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), this.glowMat);
      mask.position.y = 0.9;
      this.figure.add(mask);
      const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 2.5, 6), this.bodyMat);
      staff.rotation.x = Math.PI / 2;
      staff.position.set(0.45, 0.2, -0.7);
      this.figure.add(staff);
      this.muzzleNode = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), this.glowMat);
      this.muzzleNode.position.set(0.45, 0.2, -1.95);
      this.figure.add(this.muzzleNode);
      return;
    }

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.8, 4, 7), this.bodyMat);
    torso.rotation.z = Math.PI / 2;
    this.figure.add(torso);
    const face = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), this.glowMat);
    face.position.set(0, 0.15, 0.55);
    this.figure.add(face);
    for (const side of [-1, 1]) {
      const paddle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.25, 0.28), this.bodyMat);
      paddle.position.set(side * 0.45, -0.15, 0);
      paddle.rotation.z = side * 0.45;
      this.figure.add(paddle);
    }
    this.muzzleNode = face;
  }

  hit(damage, reflected = false) {
    if (!this.alive) return false;
    this._flash = 1;
    this.hp -= reflected && this.type === 'sniper' ? this.hp : damage;
    if (this.hp > 0) return false;
    this.alive = false;
    this._fadeTarget = 0;
    return true;
  }

  vanish() {
    if (!this.alive) return;
    this.alive = false;
    this._fadeTarget = 0;
  }

  get dead() { return !this.alive && this._fade < 0.02; }

  center(out) {
    return out.set(
      this.group.position.x,
      this.figure.position.y,
      this.group.position.z,
    );
  }

  muzzle(out) { return this.muzzleNode.getWorldPosition(out); }

  update(dt, t, target) {
    this._fade += (this._fadeTarget - this._fade) * Math.min(1, dt / 0.45);
    this.group.visible = this._fade > 0.01;
    for (const [material, base] of this.fadeMats) material.opacity = base * this._fade;
    this._flash = Math.max(0, this._flash - dt / 0.18);
    this.glowMat.emissiveIntensity = this._glowBase * (1 + this._flash * 1.7);
    if (!this.alive || this._fade < 0.85) return;

    this.figure.position.y = CONFIG.WATER_LEVEL + (this.type === 'sniper' ? 2.3 : 1.1) +
      Math.sin(t * 2.1 + this._phase) * 0.12;
    const dx = target.x - this.group.position.x;
    const dz = target.z - this.group.position.z;
    const yaw = Math.atan2(dx, dz) + Math.PI;
    this.group.rotation.y += angDelta(this.group.rotation.y, yaw) * Math.min(1, dt * 6);

    if (this.type === 'sniper') {
      this._timer -= dt;
      const charge = Math.max(0, 1 - this._timer / 0.45);
      this.muzzleNode.scale.setScalar(1 + charge * 1.2);
      if (this._timer <= 0) {
        this._timer = this.cfg.SHOT_INTERVAL;
        this.shotRequested = true;
      }
      return;
    }

    const distance = Math.hypot(dx, dz);
    if (this._boardState === 'approach') {
      if (distance > 2.1) {
        const inv = 1 / Math.max(0.001, distance);
        this.group.position.x += dx * inv * this.cfg.SPEED * dt;
        this.group.position.z += dz * inv * this.cfg.SPEED * dt;
      } else {
        this._boardState = 'telegraph';
        this._timer = this.cfg.TELEGRAPH;
      }
    } else if (this._boardState === 'telegraph') {
      this._timer -= dt;
      this.figure.scale.setScalar(1 + (1 - this._timer / this.cfg.TELEGRAPH) * 0.35);
      if (this._timer <= 0) {
        this._boardState = 'boarded';
        this._timer = 0;
        this.figure.scale.setScalar(1);
      }
    } else {
      this._timer -= dt;
      if (this._timer <= 0) {
        this._timer = this.cfg.ATTACK_INTERVAL;
        this.attackReady = true;
        this._flash = 0.8;
      }
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((object) => { if (object.geometry) object.geometry.dispose(); });
    this.bodyMat.dispose();
    this.glowMat.dispose();
  }
}
