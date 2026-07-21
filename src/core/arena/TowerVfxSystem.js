import * as THREE from 'three';

const RING_POOL = 8;
const SHARD_POOL = 16;
const SHARDS_PER_BURST = 6;

export const TOWER_VFX_COLORS = {
  memory: 0x7fe8ff,
  sentinel: 0x9fd8c8,
  gale: 0x91a8ff,
  warning: 0xf0bd69,
  danger: 0xff7669,
  keeper: 0xffcf87,
};

export class TowerVfxSystem {
  constructor(scene) {
    this.scene = scene;
    this._dummy = new THREE.Object3D();
    this._scratchColor = new THREE.Color();

    this._ringGeometry = new THREE.TorusGeometry(0.55, 0.035, 5, 28);
    this._ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.82,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.ringMesh = new THREE.InstancedMesh(
      this._ringGeometry, this._ringMaterial, RING_POOL,
    );
    this.ringMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.ringMesh.frustumCulled = false;
    this.rings = [];
    for (let i = 0; i < RING_POOL; i++) {
      this.rings.push({
        active: false,
        life: 0,
        duration: 1,
        startScale: 1,
        endScale: 1,
        horizontal: false,
        position: new THREE.Vector3(),
        color: new THREE.Color(TOWER_VFX_COLORS.memory),
      });
      this.ringMesh.setColorAt(i, new THREE.Color(0x000000));
      this._hideInstance(this.ringMesh, i);
    }
    this.ringMesh.instanceColor.needsUpdate = true;
    scene.add(this.ringMesh);

    this._shardGeometry = new THREE.TetrahedronGeometry(0.09, 0);
    this._shardMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.shardMesh = new THREE.InstancedMesh(
      this._shardGeometry, this._shardMaterial, SHARD_POOL,
    );
    this.shardMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.shardMesh.frustumCulled = false;
    this.shards = [];
    for (let i = 0; i < SHARD_POOL; i++) {
      this.shards.push({
        active: false,
        life: 0,
        duration: 1,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        rotation: new THREE.Vector3(),
        spin: new THREE.Vector3(),
        color: new THREE.Color(TOWER_VFX_COLORS.memory),
      });
      this.shardMesh.setColorAt(i, new THREE.Color(0x000000));
      this._hideInstance(this.shardMesh, i);
    }
    this.shardMesh.instanceColor.needsUpdate = true;
    scene.add(this.shardMesh);
  }

  _hideInstance(mesh, index) {
    this._dummy.position.set(0, -100, 0);
    this._dummy.rotation.set(0, 0, 0);
    this._dummy.scale.setScalar(0.001);
    this._dummy.updateMatrix();
    mesh.setMatrixAt(index, this._dummy.matrix);
  }

  _ringSlot() {
    for (const ring of this.rings) if (!ring.active) return ring;
    let oldest = this.rings[0];
    for (const ring of this.rings) if (ring.life < oldest.life) oldest = ring;
    return oldest;
  }

  ring(position, color, options = {}) {
    const ring = this._ringSlot();
    ring.active = true;
    ring.life = options.duration ?? 0.55;
    ring.duration = ring.life;
    ring.startScale = options.startScale ?? 0.25;
    ring.endScale = options.endScale ?? 2.2;
    ring.horizontal = options.horizontal ?? false;
    ring.position.copy(position);
    ring.color.setHex(color);
  }

  burst(position, color, power = 1) {
    let emitted = 0;
    for (const shard of this.shards) {
      if (shard.active) continue;
      const angle = (emitted / SHARDS_PER_BURST) * Math.PI * 2 + Math.random() * 0.3;
      const speed = (1.8 + Math.random() * 1.8) * power;
      shard.active = true;
      shard.life = 0.45 + Math.random() * 0.25;
      shard.duration = shard.life;
      shard.position.copy(position);
      shard.velocity.set(
        Math.cos(angle) * speed,
        (0.5 + Math.random() * 1.4) * power,
        Math.sin(angle) * speed,
      );
      shard.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      shard.spin.set(Math.random() * 5, Math.random() * 5, Math.random() * 5);
      shard.color.setHex(color);
      emitted++;
      if (emitted >= SHARDS_PER_BURST) break;
    }
  }

  threatSpawn(position, type) {
    const color = type === 'gargoyle'
      ? TOWER_VFX_COLORS.sentinel : TOWER_VFX_COLORS.gale;
    this.ring(position, color, {
      horizontal: true, duration: 0.7, startScale: 2.2, endScale: 0.35,
    });
  }

  enemyImpact(position, type, defeated) {
    const color = type === 'gargoyle'
      ? TOWER_VFX_COLORS.sentinel : TOWER_VFX_COLORS.gale;
    this.ring(position, color, { duration: defeated ? 0.65 : 0.28, endScale: defeated ? 2.7 : 1.25 });
    if (defeated || type === 'gargoyle') this.burst(position, color, defeated ? 1.35 : 0.65);
  }

  projectileImpact(position) {
    this.ring(position, TOWER_VFX_COLORS.danger, { duration: 0.38, endScale: 1.55 });
  }

  gatePulse(position, correct) {
    const color = correct ? TOWER_VFX_COLORS.memory : TOWER_VFX_COLORS.warning;
    this.ring(position, color, { duration: 0.75, endScale: 3.2 });
    this.burst(position, color, correct ? 1.1 : 0.75);
  }

  keeperPulse(position, kind) {
    const color = kind === 'hit'
      ? TOWER_VFX_COLORS.memory
      : kind === 'defeat' ? TOWER_VFX_COLORS.keeper : TOWER_VFX_COLORS.danger;
    this.ring(position, color, {
      duration: kind === 'defeat' ? 1.2 : 0.5,
      startScale: kind === 'telegraph' ? 2.4 : 0.3,
      endScale: kind === 'telegraph' ? 0.5 : kind === 'defeat' ? 5 : 1.8,
    });
    if (kind === 'defeat') this.burst(position, color, 2);
  }

  update(dt) {
    for (let i = 0; i < this.rings.length; i++) {
      const ring = this.rings[i];
      if (!ring.active) continue;
      ring.life = Math.max(0, ring.life - dt);
      const progress = 1 - ring.life / ring.duration;
      const scale = THREE.MathUtils.lerp(ring.startScale, ring.endScale, progress);
      this._dummy.position.copy(ring.position);
      this._dummy.rotation.set(ring.horizontal ? Math.PI / 2 : 0, 0, 0);
      this._dummy.scale.setScalar(Math.max(0.001, scale));
      this._dummy.updateMatrix();
      this.ringMesh.setMatrixAt(i, this._dummy.matrix);
      this._scratchColor.copy(ring.color).multiplyScalar(Math.max(0.06, ring.life / ring.duration));
      this.ringMesh.setColorAt(i, this._scratchColor);
      if (ring.life <= 0) { ring.active = false; this._hideInstance(this.ringMesh, i); }
    }
    this.ringMesh.instanceMatrix.needsUpdate = true;
    this.ringMesh.instanceColor.needsUpdate = true;

    for (let i = 0; i < this.shards.length; i++) {
      const shard = this.shards[i];
      if (!shard.active) continue;
      shard.life = Math.max(0, shard.life - dt);
      shard.velocity.y -= dt * 3.4;
      shard.position.addScaledVector(shard.velocity, dt);
      shard.rotation.addScaledVector(shard.spin, dt);
      const scale = Math.max(0.001, shard.life / shard.duration);
      this._dummy.position.copy(shard.position);
      this._dummy.rotation.set(shard.rotation.x, shard.rotation.y, shard.rotation.z);
      this._dummy.scale.setScalar(scale);
      this._dummy.updateMatrix();
      this.shardMesh.setMatrixAt(i, this._dummy.matrix);
      this._scratchColor.copy(shard.color).multiplyScalar(Math.max(0.05, scale));
      this.shardMesh.setColorAt(i, this._scratchColor);
      if (shard.life <= 0) { shard.active = false; this._hideInstance(this.shardMesh, i); }
    }
    this.shardMesh.instanceMatrix.needsUpdate = true;
    this.shardMesh.instanceColor.needsUpdate = true;
  }

  reset() {
    for (let i = 0; i < this.rings.length; i++) {
      this.rings[i].active = false;
      this._hideInstance(this.ringMesh, i);
    }
    for (let i = 0; i < this.shards.length; i++) {
      this.shards[i].active = false;
      this._hideInstance(this.shardMesh, i);
    }
    this.ringMesh.instanceMatrix.needsUpdate = true;
    this.shardMesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.reset();
    this.scene.remove(this.ringMesh, this.shardMesh);
    this._ringGeometry.dispose();
    this._ringMaterial.dispose();
    this._shardGeometry.dispose();
    this._shardMaterial.dispose();
  }
}
