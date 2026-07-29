// ============================================================
// ARENA VICTORY RIFT — shared boss explosion and return doorway.
//
// The effect is authored once for all three arena bosses. Palette is the only
// zone-specific input; timing comes from ARENA.VICTORY and remains identical.
// Fixed pools and deterministic index paths keep the per-frame work bounded and
// make retries and screenshots repeatable without runtime randomness.
// ============================================================
import * as THREE from 'three';
import { ARENA, clamp01 } from '../../config.js';
import { createVortexMaterial } from '../../museum/PortalVortex.js';

const VICTORY = ARENA.VICTORY;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const PALETTES = {
  arena1: { primary: 0x63e0d7, accent: 0xc98652 },
  arena2: { primary: 0x62f2dd, accent: 0xffc857 },
  arena3boss: { primary: 0x86acd2, accent: 0xe7c25d },
};

const smooth = (value) => value * value * (3 - 2 * value);
const easeOut = (value) => 1 - (1 - value) ** 3;

export class ArenaVictoryRift {
  constructor(scene, arenaId, position, faceTarget) {
    this.scene = scene;
    this.palette = PALETTES[arenaId] || PALETTES.arena1;
    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.group.lookAt(faceTarget);
    this.scene.add(this.group);

    this._geometries = [];
    this._materials = [];
    this._dummy = new THREE.Object3D();
    this._color = new THREE.Color();

    this._buildPortal();
    this._buildShards();
    this._buildMotes();
  }

  _geometry(geometry) {
    this._geometries.push(geometry);
    return geometry;
  }

  _material(material) {
    this._materials.push(material);
    return material;
  }

  _buildPortal() {
    this.portal = new THREE.Group();
    this.portal.scale.setScalar(0.001);
    this.group.add(this.portal);

    const radius = VICTORY.RIFT_RADIUS;
    this.vortexMat = this._material(createVortexMaterial(1));
    this.vortex = new THREE.Mesh(
      this._geometry(new THREE.PlaneGeometry(radius * 2, radius * 2)),
      this.vortexMat,
    );
    this.portal.add(this.vortex);

    this.ringMat = this._material(new THREE.MeshBasicMaterial({
      color: this.palette.primary,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    this.rings = [];
    for (let index = 0; index < 3; index++) {
      const ring = new THREE.Mesh(
        this._geometry(new THREE.TorusGeometry(
          radius * (0.82 + index * 0.12),
          0.045 + index * 0.012,
          8,
          48,
        )),
        this.ringMat,
      );
      ring.rotation.z = index * 0.68;
      ring.rotation.x = index * 0.09;
      this.portal.add(ring);
      this.rings.push(ring);
    }

    this.light = new THREE.PointLight(this.palette.primary, 0, 18, 1.6);
    this.portal.add(this.light);
  }

  _seedPaths(count, directions, radii, curves, phaseOffset = 0) {
    for (let index = 0; index < count; index++) {
      const angle = (index + phaseOffset) * GOLDEN_ANGLE;
      const vertical = (((index * 17 + phaseOffset * 11) % count) / Math.max(1, count - 1))
        * 2 - 1;
      const planeRadius = Math.sqrt(Math.max(0.08, 1 - vertical * vertical));
      const base = index * 3;
      directions[base] = Math.cos(angle) * planeRadius;
      directions[base + 1] = vertical * 0.82 + 0.18;
      directions[base + 2] = Math.sin(angle) * planeRadius * 0.58;
      radii[index] = 2.4 + (index % 9) * 0.38;
      curves[base] = -directions[base + 1] * (0.75 + (index % 4) * 0.16);
      curves[base + 1] = directions[base] * (0.75 + (index % 5) * 0.13);
      curves[base + 2] = (index % 2 ? 1 : -1) * (0.45 + (index % 3) * 0.18);
    }
  }

  _buildShards() {
    const count = VICTORY.SHARD_COUNT;
    this.shardDirections = new Float32Array(count * 3);
    this.shardRadii = new Float32Array(count);
    this.shardCurves = new Float32Array(count * 3);
    this._seedPaths(
      count,
      this.shardDirections,
      this.shardRadii,
      this.shardCurves,
    );

    this.shardMat = this._material(new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    this.shards = new THREE.InstancedMesh(
      this._geometry(new THREE.TetrahedronGeometry(0.24, 0)),
      this.shardMat,
      count,
    );
    this.shards.frustumCulled = false;
    this.shards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let index = 0; index < count; index++) {
      this._color.set(index % 3 ? this.palette.primary : this.palette.accent);
      this.shards.setColorAt(index, this._color);
      this._hideShard(index);
    }
    this.shards.instanceColor.needsUpdate = true;
    this.shards.instanceMatrix.needsUpdate = true;
    this.group.add(this.shards);
  }

  _buildMotes() {
    const count = VICTORY.MOTE_COUNT;
    this.moteDirections = new Float32Array(count * 3);
    this.moteRadii = new Float32Array(count);
    this.moteCurves = new Float32Array(count * 3);
    this._seedPaths(
      count,
      this.moteDirections,
      this.moteRadii,
      this.moteCurves,
      7,
    );
    this.motePositions = new Float32Array(count * 3);
    this.moteGeometry = this._geometry(new THREE.BufferGeometry());
    this.moteAttribute = new THREE.BufferAttribute(this.motePositions, 3);
    this.moteAttribute.setUsage(THREE.DynamicDrawUsage);
    this.moteGeometry.setAttribute('position', this.moteAttribute);
    this.moteMat = this._material(new THREE.PointsMaterial({
      color: this.palette.accent,
      size: 0.085,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    this.motes = new THREE.Points(this.moteGeometry, this.moteMat);
    this.motes.frustumCulled = false;
    this.group.add(this.motes);
  }

  _hideShard(index) {
    this._dummy.position.set(0, 0, 0);
    this._dummy.scale.setScalar(0.001);
    this._dummy.updateMatrix();
    this.shards?.setMatrixAt(index, this._dummy.matrix);
  }

  _pathAt(time, index, directions, radii, curves, out) {
    if (time < VICTORY.BURST_START || time > VICTORY.RIFT_FULL) return 0;
    const base = index * 3;
    let distance;
    let curve;
    let scale;
    if (time <= VICTORY.BURST_END) {
      const progress = easeOut(clamp01(
        (time - VICTORY.BURST_START) / (VICTORY.BURST_END - VICTORY.BURST_START),
      ));
      distance = radii[index] * progress;
      curve = Math.sin(progress * Math.PI) * 0.35;
      scale = 0.3 + progress * 0.7;
    } else {
      const progress = smooth(clamp01(
        (time - VICTORY.BURST_END) / (VICTORY.RIFT_FULL - VICTORY.BURST_END),
      ));
      distance = radii[index] * (1 - progress);
      curve = Math.sin(progress * Math.PI) * (1.2 + (index % 4) * 0.18);
      scale = 1 - progress;
    }
    out.set(
      directions[base] * distance + curves[base] * curve,
      directions[base + 1] * distance + curves[base + 1] * curve,
      directions[base + 2] * distance + curves[base + 2] * curve,
    );
    return Math.max(0.001, scale);
  }

  _updateShards(time) {
    for (let index = 0; index < VICTORY.SHARD_COUNT; index++) {
      const scale = this._pathAt(
        time,
        index,
        this.shardDirections,
        this.shardRadii,
        this.shardCurves,
        this._dummy.position,
      );
      if (scale <= 0) {
        this._hideShard(index);
        continue;
      }
      this._dummy.rotation.set(
        time * (1.8 + (index % 5) * 0.22),
        time * (2.1 + (index % 7) * 0.17),
        index * 0.41,
      );
      this._dummy.scale.set(
        scale * (0.65 + (index % 4) * 0.12),
        scale * (1.2 + (index % 3) * 0.25),
        scale,
      );
      this._dummy.updateMatrix();
      this.shards.setMatrixAt(index, this._dummy.matrix);
    }
    this.shards.instanceMatrix.needsUpdate = true;
  }

  _updateMotes(time) {
    for (let index = 0; index < VICTORY.MOTE_COUNT; index++) {
      const base = index * 3;
      const scale = this._pathAt(
        time,
        index,
        this.moteDirections,
        this.moteRadii,
        this.moteCurves,
        this._dummy.position,
      );
      if (scale <= 0) {
        this.motePositions[base] = 0;
        this.motePositions[base + 1] = 0;
        this.motePositions[base + 2] = 0;
        continue;
      }
      this.motePositions[base] = this._dummy.position.x;
      this.motePositions[base + 1] = this._dummy.position.y;
      this.motePositions[base + 2] = this._dummy.position.z;
    }
    this.moteAttribute.needsUpdate = true;
    const visible = time >= VICTORY.BURST_START && time <= VICTORY.RIFT_FULL;
    this.moteMat.opacity = visible ? 0.82 : 0;
  }

  update(dt, globalTime, time) {
    const reveal = smooth(clamp01(
      (time - VICTORY.RIFT_START) / (VICTORY.RIFT_FULL - VICTORY.RIFT_START),
    ));
    this.portal.scale.setScalar(Math.max(0.001, reveal));
    this.vortexMat.uniforms.uTime.value = globalTime;
    this.ringMat.opacity = reveal * 0.88;
    for (let index = 0; index < this.rings.length; index++) {
      const direction = index % 2 ? -1 : 1;
      this.rings[index].rotation.z += dt * direction * (0.75 + index * 0.34);
      this.rings[index].rotation.x += dt * direction * 0.11 * (index + 1);
    }
    this.light.intensity = reveal * (2.4 + reveal * 5.6);
    this._updateShards(time);
    this._updateMotes(time);
  }

  dispose() {
    this.scene.remove(this.group);
    for (const geometry of this._geometries) geometry.dispose();
    for (const material of this._materials) material.dispose();
    this._geometries.length = 0;
    this._materials.length = 0;
  }
}
