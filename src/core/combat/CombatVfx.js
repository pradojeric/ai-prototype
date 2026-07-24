// ============================================================
// COMBAT VFX — the shared effects layer for every arena fight. Two pre-allocated
// instanced pools (expanding rings + tumbling shards) cover spawn telegraphs,
// bolt impacts, deaths, and the ripples they leave on the water. Owned by
// CombatManager, so Arena 1's echoes, Arena 2's rail threats, and Arena 3's
// tower sentinels all draw from the same budget.
//
// Pooled and additive by design (see CLAUDE.md): no dynamic lights, no
// per-frame allocation — slots are recycled and only instance matrices/colors
// are rewritten each tick.
// ============================================================
import * as THREE from 'three';
import { CONFIG, COMBAT, GUARDIAN, VFX } from '../../config.js';
import { ThreadTear } from './ThreadTear.js';

export const VFX_COLORS = {
  memory: 0x7fe8ff,
  sentinel: 0x9fd8c8,
  gale: 0x91a8ff,
  warning: 0xf0bd69,
  danger: 0xff7669,
  keeper: 0xffcf87,
  // Arena 1's drowned echoes borrow the palette their bodies are built from
  // (Enemy._buildBody), so an effect always matches the thing that spawned it.
  chaser: GUARDIAN.CORE_COLOR,
  spitter: COMBAT.SPITTER.SPIT_COLOR,
  bolt: COMBAT.BOLT.COLOR,
  // Zone 3's threat types map onto their existing tower hues.
  gargoyle: 0x9fd8c8,
  gale: 0x91a8ff,
  // Zone 2's river threats.
  sniper: 0xffb066,
  boarder: 0xff8f6a,
};

// Effects are addressed by enemy `type` string wherever possible; unknown types
// fall back to the neutral memory hue rather than throwing.
function colorFor(type) {
  return VFX_COLORS[type] ?? VFX_COLORS.memory;
}

// Boss feedback keeps a consistent shape language between arenas while its
// colors stay native to the guardian: old gold/ember in the flooded feast hall,
// river-cyan/coral aboard the reveler's route, and memory-gold/spectral blue at
// the tower summit.
const BOSS_PALETTES = {
  zone1: {
    shield: 0xffe6a3,
    primary: 0xffc052,
    fracture: 0xff793d,
  },
  zone2: {
    shield: 0xa4f7ff,
    primary: 0x48dff1,
    fracture: 0xff7185,
  },
  zone3: {
    shield: 0xffedc2,
    primary: 0xffcf87,
    fracture: 0x9fd8ff,
  },
};

function bossPaletteFor(style) {
  return BOSS_PALETTES[style] ?? BOSS_PALETTES.zone1;
}

export class CombatVfx {
  // `camera` is only read when a tear opens, to freeze its facing toward the
  // player; the effects layer never drives the camera.
  constructor(scene, camera = null) {
    this.scene = scene;
    this.camera = camera;
    this._dummy = new THREE.Object3D();
    this._scratchColor = new THREE.Color();

    // The spawn portal itself. Pooled and additive like everything else here.
    this.tears = new ThreadTear(scene, VFX_COLORS.memory);

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
      this._ringGeometry, this._ringMaterial, VFX.RING_POOL,
    );
    this.ringMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.ringMesh.frustumCulled = false;
    this.rings = [];
    for (let i = 0; i < VFX.RING_POOL; i++) {
      this.rings.push({
        active: false,
        life: 0,
        duration: 1,
        startScale: 1,
        endScale: 1,
        horizontal: false,
        billboard: false,
        position: new THREE.Vector3(),
        color: new THREE.Color(VFX_COLORS.memory),
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
      this._shardGeometry, this._shardMaterial, VFX.SHARD_POOL,
    );
    this.shardMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.shardMesh.frustumCulled = false;
    this.shards = [];
    for (let i = 0; i < VFX.SHARD_POOL; i++) {
      this.shards.push({
        active: false,
        life: 0,
        duration: 1,
        gravity: 1,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        rotation: new THREE.Vector3(),
        spin: new THREE.Vector3(),
        color: new THREE.Color(VFX_COLORS.memory),
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

  // ---- primitives -------------------------------------------------------

  ring(position, color, options = {}) {
    const ring = this._ringSlot();
    ring.active = true;
    ring.life = options.duration ?? 0.55;
    ring.duration = ring.life;
    ring.startScale = options.startScale ?? 0.25;
    ring.endScale = options.endScale ?? 2.2;
    ring.horizontal = options.horizontal ?? false;
    ring.billboard = options.billboard ?? false;
    ring.position.copy(position);
    ring.color.setHex(color);
  }

  burst(position, color, power = 1, options = {}) {
    const count = options.count ?? VFX.SHARDS_PER_BURST;
    const gravity = options.gravity ?? 1;
    const rise = options.rise ?? 0;      // >0 biases the spray upward (wisps)
    let emitted = 0;
    for (const shard of this.shards) {
      if (shard.active) continue;
      const angle = (emitted / count) * Math.PI * 2 + Math.random() * 0.3;
      const speed = (1.8 + Math.random() * 1.8) * power * (rise ? 0.35 : 1);
      shard.active = true;
      shard.life = (options.life ?? 0.45) + Math.random() * 0.25;
      shard.duration = shard.life;
      shard.gravity = gravity;
      shard.position.copy(position);
      shard.velocity.set(
        Math.cos(angle) * speed,
        (0.5 + Math.random() * 1.4) * power + rise,
        Math.sin(angle) * speed,
      );
      shard.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      shard.spin.set(Math.random() * 5, Math.random() * 5, Math.random() * 5);
      shard.color.setHex(color);
      emitted++;
      if (emitted >= count) break;
    }
  }

  // ---- arena beats ------------------------------------------------------

  // One reusable woven-thread tear for every arena enemy: strands unzip a rift
  // standing on the spawn point (ThreadTear owns that arc) over a single
  // contact ring drawn in on the surface below it. A fixed hue keeps the summon
  // language identical in all arenas. Returns the tear id for spawnArrive().
  spawnTelegraph(position, type) {
    const color = VFX_COLORS.memory;
    this.ring(position, color, {
      horizontal: true, duration: COMBAT.SPAWN_TELEGRAPH,
      startScale: 3.4, endScale: 0.5,
    });
    this.burst(position, color, 0.3, {
      count: Math.ceil(VFX.SHARDS_PER_BURST / 2),
      gravity: 0,
      rise: 1.15,
      life: COMBAT.SPAWN_TELEGRAPH * 0.6,
    });
    return this.tears.open(position, this.camera, COMBAT.SPAWN_TELEGRAPH);
  }

  // The enemy is through: the tear snaps shut behind it over a cyan ring and a
  // short upward thread-puff. `tearId` comes from the matching spawnTelegraph.
  spawnArrive(position, type, tearId = -1) {
    const color = VFX_COLORS.memory;
    if (tearId >= 0) this.tears.close(tearId);
    this.ring(position, color, { duration: 0.4, startScale: 0.2, endScale: 1.9 });
    this.burst(position, color, 0.5, { count: 4, rise: 1.2, gravity: 0.4, life: 0.35 });
  }

  // A phase boundary can withdraw a promised enemy before it materialises.
  // Close only that enemy's tear; its short ring/shard warning may finish
  // naturally, which reads as the portal collapsing rather than popping out.
  cancelSpawn(tearId) {
    if (tearId >= 0) this.tears.close(tearId);
  }

  // A bolt connected but did not kill: a tight spark at the impact point.
  impact(position, type) {
    this.ring(position, VFX_COLORS.bolt, { duration: 0.24, startScale: 0.15, endScale: 1.1 });
    this.burst(position, colorFor(type), 0.6, { count: 3, life: 0.28 });
  }

  // A blocked bolt draws the shield inward around the contact point, followed
  // by a restrained surface ripple. This is intentionally quieter than either
  // armor failure or real boss damage.
  shieldImpact(position, style) {
    const palette = bossPaletteFor(style);
    this.ring(position, palette.shield, {
      duration: 0.34, startScale: 1.15, endScale: 0.28, billboard: true,
    });
    this.ring(position, palette.primary, {
      duration: 0.26, startScale: 0.12, endScale: 0.82, billboard: true,
    });
    this.burst(position, palette.fracture, 0.32, {
      count: 3, gravity: 0.15, rise: 0.05, life: 0.22,
    });
  }

  // Correct answers fracture a visible layer with a strong outward break.
  // The third answer collapses the remaining shell before the larger shatter,
  // making the transition to a vulnerable boss unmistakable.
  armorBreak(position, style, final = false) {
    const palette = bossPaletteFor(style);
    if (final) {
      this.ring(position, palette.shield, {
        duration: 0.68, startScale: 2.8, endScale: 0.18, billboard: true,
      });
      this.ring(position, palette.fracture, {
        duration: 0.78, startScale: 0.22, endScale: 3.7, billboard: true,
      });
      this.ring(position, palette.primary, {
        duration: 0.55, startScale: 0.55, endScale: 2.45, billboard: true,
      });
      this.burst(position, palette.fracture, 1.75, {
        count: 14, gravity: 0.65, rise: 0.5, life: 0.68,
      });
      this.burst(position, palette.shield, 1.05, {
        count: 8, gravity: 0.35, rise: 1.1, life: 0.82,
      });
      return;
    }

    this.ring(position, palette.fracture, {
      duration: 0.52, startScale: 0.18, endScale: 1.9, billboard: true,
    });
    this.ring(position, palette.primary, {
      duration: 0.36, startScale: 0.42, endScale: 1.25, billboard: true,
    });
    this.burst(position, palette.fracture, 1.1, {
      count: 8, gravity: 0.65, rise: 0.35, life: 0.48,
    });
  }

  // Real damage stays tight to the hit point: two short ripples and a handful
  // of sparks, with no camera motion to compete with sustained fire.
  bossHit(position, style) {
    const palette = bossPaletteFor(style);
    this.ring(position, palette.fracture, {
      duration: 0.2, startScale: 0.08, endScale: 0.68, billboard: true,
    });
    this.ring(position, palette.primary, {
      duration: 0.28, startScale: 0.16, endScale: 1.05, billboard: true,
    });
    this.burst(position, palette.fracture, 0.7, {
      count: 4, gravity: 0.25, rise: 0.08, life: 0.24,
    });
  }

  // Enrage/phase boundaries expand across the whole arena rather than staying
  // on the body. A ground shockwave, layered body rings, and an upward shard
  // surge give this beat a silhouette unlike a hit or an armor crack.
  bossPhase(position, style, phase = 1, surfaceY = CONFIG.WATER_LEVEL + 0.04) {
    const palette = bossPaletteFor(style);
    const strength = 1 + (Math.min(3, Math.max(1, phase)) - 1) * 0.14;

    this._dummy.position.set(position.x, surfaceY, position.z);
    this.ring(this._dummy.position, palette.primary, {
      horizontal: true,
      duration: 0.95,
      startScale: 0.45,
      endScale: 5.4 * strength,
    });
    this.ring(position, palette.shield, {
      duration: 0.82, startScale: 3.2 * strength, endScale: 0.3, billboard: true,
    });
    this.ring(position, palette.primary, {
      duration: 0.76, startScale: 0.3, endScale: 4.1 * strength, billboard: true,
    });
    this.ring(position, palette.fracture, {
      duration: 0.56, startScale: 0.85, endScale: 2.8 * strength, billboard: true,
    });
    this.burst(position, palette.primary, 1.35 * strength, {
      count: 10, gravity: 0.25, rise: 0.85, life: 0.82,
    });
    this.burst(position, palette.fracture, 1.05 * strength, {
      count: 8, gravity: 0.55, rise: 0.2, life: 0.58,
    });
  }

  // The kill beat: shockwave, shard burst, and slow wisps rising off the body.
  death(position, type) {
    const color = colorFor(type);
    this.ring(position, color, { duration: 0.6, startScale: 0.3, endScale: 2.9 });
    this.ring(position, VFX_COLORS.bolt, { duration: 0.35, startScale: 0.2, endScale: 1.6 });
    this.burst(position, color, 1.35);
    this.burst(position, VFX_COLORS.memory, 0.5, {
      count: VFX.WISPS_PER_DEATH, gravity: 0, rise: 1.5, life: 0.9,
    });
  }

  // What the kill leaves behind: a wide, slow ripple lying flat on the surface
  // the fight happens over. `height` defaults to the water line (the arenas are
  // flooded); the tower passes its own ledge height instead.
  residue(position, type, height = CONFIG.WATER_LEVEL + 0.04) {
    this._dummy.position.set(position.x, height, position.z);
    this.ring(this._dummy.position, colorFor(type), {
      horizontal: true, duration: VFX.RESIDUE_LIFE, startScale: 0.6, endScale: 4.2,
    });
  }

  // ---- tower aliases (Zone 3's vocabulary, unchanged) --------------------

  threatSpawn(position, type) { return this.spawnTelegraph(position, type); }

  // Tower deaths happen on ledges high above the flood, so the residue ripple
  // is laid at the body's own height rather than the water line.
  enemyImpact(position, type, defeated) {
    if (defeated) { this.death(position, type); this.residue(position, type, position.y - 0.4); }
    else this.impact(position, type);
  }

  projectileImpact(position) {
    this.ring(position, VFX_COLORS.danger, { duration: 0.38, endScale: 1.55 });
  }

  gatePulse(position, correct) {
    const color = correct ? VFX_COLORS.memory : VFX_COLORS.warning;
    this.ring(position, color, { duration: 0.75, endScale: 3.2 });
    this.burst(position, color, correct ? 1.1 : 0.75);
  }

  keeperPulse(position, kind) {
    const color = kind === 'hit'
      ? VFX_COLORS.memory
      : kind === 'defeat' ? VFX_COLORS.keeper : VFX_COLORS.danger;
    this.ring(position, color, {
      duration: kind === 'defeat' ? 1.2 : 0.5,
      startScale: kind === 'telegraph' ? 2.4 : 0.3,
      endScale: kind === 'telegraph' ? 0.5 : kind === 'defeat' ? 5 : 1.8,
    });
    if (kind === 'defeat') this.burst(position, color, 2);
  }

  // Fat lines rasterise in screen space, so the tear needs the viewport size
  // (the same contract StringBundle.setResolution exists for).
  setResolution(w, h) { this.tears.setResolution(w, h); }

  update(dt) {
    this._clock = (this._clock ?? 0) + dt;
    this.tears.update(dt, this._clock);

    for (let i = 0; i < this.rings.length; i++) {
      const ring = this.rings[i];
      if (!ring.active) continue;
      ring.life = Math.max(0, ring.life - dt);
      const progress = 1 - ring.life / ring.duration;
      const scale = THREE.MathUtils.lerp(ring.startScale, ring.endScale, progress);
      this._dummy.position.copy(ring.position);
      this._dummy.rotation.set(ring.horizontal ? Math.PI / 2 : 0, 0, 0);
      if (ring.billboard && this.camera) this._dummy.lookAt(this.camera.position);
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
      shard.velocity.y -= dt * 3.4 * shard.gravity;
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
    this.tears.reset();
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
    this.tears.dispose();
    this.scene.remove(this.ringMesh, this.shardMesh);
    this._ringGeometry.dispose();
    this._ringMaterial.dispose();
    this._shardGeometry.dispose();
    this._shardMaterial.dispose();
  }
}
