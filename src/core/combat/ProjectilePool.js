// ============================================================
// PROJECTILE POOL — fixed-size pool of glowing bolts (player light-bolts and
// hostile spits both use one instance each, tinted differently). Every slot is
// pre-allocated at construction; fire()/deactivate() only flip flags and copy
// vectors, so the combat hot path never allocates.
// ============================================================
import * as THREE from 'three';

export class ProjectilePool {
  constructor(scene, count, { color, size }) {
    this.scene = scene;
    this.slots = [];

    // One shared geometry/material across the pool; bloom supplies the glow
    // (no per-projectile PointLight — that would blow the light budget).
    this._geo = new THREE.IcosahedronGeometry(size, 0);
    this._mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this._geo, this._mat);
      mesh.visible = false;
      scene.add(mesh);
      this.slots.push({
        active: false,
        mesh,
        vel: new THREE.Vector3(),
        life: 0,
        owner: null,
        reflected: false,
        source: null,
        damage: null,   // null = the firer's default; set for bespoke shots (boss patterns)
      });
    }
  }

  // Activate a free slot travelling from `origin` along (normalized) `dir`.
  // Silently drops the shot if the pool is exhausted (cooldowns make this rare).
  fire(origin, dir, speed, life, meta = {}) {
    for (const s of this.slots) {
      if (s.active) continue;
      s.active = true;
      s.mesh.visible = true;
      s.mesh.position.copy(origin);
      s.vel.copy(dir).multiplyScalar(speed);
      s.life = life;
      s.owner = meta.owner ?? null;
      s.reflected = meta.reflected ?? false;
      s.source = meta.source ?? null;
      s.damage = meta.damage ?? null;
      return s;
    }
    return null;
  }

  deactivate(slot) {
    slot.active = false;
    slot.mesh.visible = false;
    slot.owner = null;
    slot.reflected = false;
    slot.source = null;
    slot.damage = null;
  }

  // Advance live bolts; kill on expiry, wall hit, or sinking below the seabed.
  // The caller does enemy/player hit tests against `slots` after this.
  update(dt, world) {
    for (const s of this.slots) {
      if (!s.active) continue;
      s.life -= dt;
      if (s.life <= 0) { this.deactivate(s); continue; }
      const p = s.mesh.position;
      p.addScaledVector(s.vel, dt);
      if (p.y < -0.3 || world.collidesAt(p.x, p.z, 0.1, p.y)) this.deactivate(s);
    }
  }

  clear() {
    for (const s of this.slots) if (s.active) this.deactivate(s);
  }

  dispose() {
    for (const s of this.slots) this.scene.remove(s.mesh);
    this._geo.dispose();
    this._mat.dispose();
  }
}
