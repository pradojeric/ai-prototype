import * as THREE from 'three';
import { TOWER_ARENA } from '../../config.js';

const EDGE_MARGIN = 0.18;
const GALE_HOVER = 1.45;

export class TowerThreat {
  constructor(scene, world, type, anchor, player) {
    this.scene = scene;
    this.world = world;
    this.type = type;
    this.player = player;
    this.anchor = anchor;
    this.cfg = type === 'gargoyle' ? TOWER_ARENA.GARGOYLE : TOWER_ARENA.GALE;
    this.hp = this.cfg.HP;
    this.radius = this.cfg.RADIUS;
    this.alive = true;
    this.dead = false;
    this.attackReady = false;
    this.spitRequested = false;
    this._timer = 1 + Math.random();
    this._phase = Math.random() * Math.PI * 2;
    this._cos = Math.cos(anchor.rotation || 0);
    this._sin = Math.sin(anchor.rotation || 0);
    this._localX = 0;
    this._localZ = 0;

    this.group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({
      color: type === 'gargoyle' ? 0x7892a0 : 0x6d83c7,
      emissive: type === 'gargoyle' ? 0x285968 : 0x183a52,
      emissiveIntensity: type === 'gargoyle' ? 1.7 : 1.2,
    });
    const geometry = type === 'gargoyle'
      ? new THREE.DodecahedronGeometry(0.55, 0)
      : new THREE.IcosahedronGeometry(0.42, 1);
    this.group.add(new THREE.Mesh(geometry, material));
    if (type === 'gargoyle') this._buildGargoyleSilhouette(material);
    this._mat = material;
    const spawnZ = type === 'gargoyle'
      ? (anchor.halfD - this.radius - EDGE_MARGIN) * 0.97
      : 0;
    this._placeOnSupport(0, spawnZ, 0);
    scene.add(this.group);
  }

  get pos() { return this.group.position; }

  _buildGargoyleSilhouette(material) {
    const wingGeometry = new THREE.BoxGeometry(0.75, 0.12, 0.5);
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(wingGeometry, material);
      wing.position.set(side * 0.62, 0.08, 0.05);
      wing.rotation.z = side * 0.38;
      wing.rotation.y = side * 0.22;
      this.group.add(wing);
    }
    this._eyeMat = new THREE.MeshBasicMaterial({ color: 0x9ff7ff });
    const eyeGeometry = new THREE.SphereGeometry(0.07, 6, 4);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeometry, this._eyeMat);
      eye.position.set(side * 0.16, 0.12, -0.5);
      this.group.add(eye);
    }
  }

  _supportHeight(localZ) {
    const progress = (localZ + this.anchor.halfD) / (this.anchor.halfD * 2);
    return this.anchor.startHeight +
      (this.anchor.endHeight - this.anchor.startHeight) * progress;
  }

  _placeOnSupport(localX, localZ, bob) {
    const maxX = Math.max(0, this.anchor.halfW - this.radius - EDGE_MARGIN);
    const maxZ = Math.max(0, this.anchor.halfD - this.radius - EDGE_MARGIN);
    this._localX = Math.max(-maxX, Math.min(maxX, localX));
    this._localZ = Math.max(-maxZ, Math.min(maxZ, localZ));
    const dx = this._localX * this._cos + this._localZ * this._sin;
    const dz = -this._localX * this._sin + this._localZ * this._cos;
    const hover = this.type === 'gale' ? GALE_HOVER : this.radius + 0.05;
    this.group.position.set(
      this.anchor.x + dx,
      this._supportHeight(this._localZ) + hover + bob,
      this.anchor.z + dz,
    );
  }

  _tryMove(worldX, worldZ) {
    const dx = worldX - this.anchor.x;
    const dz = worldZ - this.anchor.z;
    const localX = dx * this._cos - dz * this._sin;
    const localZ = dx * this._sin + dz * this._cos;
    const maxX = Math.max(0, this.anchor.halfW - this.radius - EDGE_MARGIN);
    const maxZ = Math.max(0, this.anchor.halfD - this.radius - EDGE_MARGIN);
    const clampedX = Math.max(-maxX, Math.min(maxX, localX));
    const clampedZ = Math.max(-maxZ, Math.min(maxZ, localZ));
    const candidateX = this.anchor.x + clampedX * this._cos + clampedZ * this._sin;
    const candidateZ = this.anchor.z - clampedX * this._sin + clampedZ * this._cos;
    const supportY = this._supportHeight(clampedZ);
    if (this.world.collidesAt(candidateX, candidateZ, this.radius, supportY + 0.4)) return;
    this._placeOnSupport(clampedX, clampedZ, 0);
  }

  center(out) { return out.copy(this.group.position); }

  hit(damage) {
    if (!this.alive) return false;
    this.hp -= damage;
    this._mat.emissiveIntensity = 3;
    if (this.hp > 0) return false;
    this.alive = false;
    this.dead = true;
    return true;
  }

  vanish() {
    this.alive = false;
    this.dead = true;
  }

  blocksPlayerAt(x, z, radius, supportY) {
    return this.alive && this.type === 'gargoyle' &&
      Math.abs(supportY - (this.pos.y - this.radius)) < 1.15 &&
      Math.hypot(x - this.pos.x, z - this.pos.z) < radius + this.radius;
  }

  update(dt, t, playerPos) {
    if (!this.alive) return;
    this._mat.emissiveIntensity = Math.max(1.2, this._mat.emissiveIntensity - dt * 8);
    const dx = playerPos.x - this.pos.x;
    const dz = playerPos.z - this.pos.z;
    const dist = Math.hypot(dx, dz) || 1;

    if (this.type === 'gargoyle') {
      if (Math.abs(playerPos.y - this.pos.y) > 3.2) return;
      if (dist > 1.7) {
        const step = this.cfg.SPEED * dt / dist;
        this._tryMove(this.pos.x + dx * step, this.pos.z + dz * step);
      }
      this.group.rotation.y = Math.atan2(dx, dz) + Math.PI;
      this._timer -= dt;
      if (dist < 1.8 && this._timer <= 0) {
        this._timer = 1.2;
        this.attackReady = true;
      }
      return;
    }

    const orbitX = Math.sin(t * 0.75 + this._phase) * 0.55;
    const orbitZ = Math.cos(t * 0.55 + this._phase) * 1.8;
    this._placeOnSupport(orbitX, orbitZ, Math.sin(t * 2 + this._phase) * 0.22);
    if (Math.abs(playerPos.y - this.pos.y) > 4.5) return;
    this._timer -= dt;
    if (this._timer <= 0 && dist < 14) {
      this._timer = this.cfg.SHOT_INTERVAL;
      this.spitRequested = true;
    }
  }

  muzzle(out) { return out.copy(this.pos); }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((object) => object.geometry?.dispose());
    this._mat.dispose();
    this._eyeMat?.dispose();
  }
}
