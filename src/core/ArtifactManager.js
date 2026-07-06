// ============================================================
// ARTIFACT MANAGER — placement seeding + interaction (GDD §6/§7)
//
// Artifacts are NOT present at zone start. They are revealed by scatter(),
// called once the guardian is defeated: each artifact bursts from the
// guardian's position and arcs out to a spread-out landing point.
// ============================================================
import * as THREE from 'three';
import {
  CONFIG, mulberry32, clamp01, PLAYER_RADIUS,
  ARTIFACT_BATCH, ARTIFACT_MIN_SEP, SCATTER_DURATION, SCATTER_ARC_HEIGHT,
} from '../config.js';
import { ARTIFACT_DATA } from '../data.js';
import { StringBundle } from './StringSystem.js';

const SPAWN_CLEARANCE = PLAYER_RADIUS + 0.4;  // keep artifacts reachable
const TRAIL_N = 12;                            // points in each flight trail

export class ArtifactManager {
  // `collectedIds` is a Set of artifact ids already recovered in this zone across
  // earlier visits (owned by Game, persists across zone reloads). Only the next
  // ARTIFACT_BATCH uncollected artifacts are revealed per visit; the zone is done
  // once every ARTIFACT_DATA id is in the set.
  constructor(scene, world, collectedIds = new Set()) {
    this.scene = scene;
    this.world = world;          // provides spawnNodes + collidesAt
    this.collectedIds = collectedIds;
    this.artifacts = [];
    this.scattered = false;      // becomes true once scatter() has run
    this._v = new THREE.Vector3();
  }

  // The next up-to-ARTIFACT_BATCH artifacts not yet collected in this zone.
  get batchData() {
    return ARTIFACT_DATA
      .filter((d) => !this.collectedIds.has(d.id))
      .slice(0, ARTIFACT_BATCH);
  }

  // Compute spread-out, collision-safe landing points (one per batch artifact).
  _computePlacements() {
    const rng = mulberry32((Date.now() & 0xffff) ^ 0x9e37); // per-session
    const used = [];
    return this.batchData.map((data) => {
      const nodes = this.world.spawnNodes[data.spawnTag] || this.world.spawnNodes.open_water;
      // Pick a jittered node that isn't crowding another artifact or stuck in a wall.
      let x = 0, z = 0, tries = 0;
      do {
        const [nx, nz] = nodes[Math.floor(rng() * nodes.length)];
        x = nx + (rng() - 0.5) * 3;
        z = nz + (rng() - 0.5) * 3;
        tries++;
      } while (tries < 24 &&
               (this._tooClose(used, x, z, ARTIFACT_MIN_SEP) ||
                this.world.collidesAt(x, z, SPAWN_CLEARANCE)));
      [x, z] = this._nudgeClear(x, z);       // final safety nudge out of any collider
      used.push([x, z]);

      // elevated artifacts sit a little higher so they read as resting on rubble
      const y = CONFIG.WATER_LEVEL + (data.spawnTag === 'elevated_rubble' ? 0.6 : 0.25);
      return { data, pos: new THREE.Vector3(x, y, z) };
    });
  }

  // Reveal the artifacts: each spawns at `origin` (the defeated guardian's spot)
  // and arcs out to its landing point, leaving a particle trail.
  scatter(origin) {
    if (this.scattered) return;
    this.scattered = true;

    const placements = this._computePlacements();
    placements.forEach(({ data, pos }) => {
      const mesh = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.32, 0),
        new THREE.MeshStandardMaterial({
          color: 0xffe6b0, emissive: 0x5a4322, roughness: .4, metalness: .3,
        })
      );
      mesh.position.copy(origin);
      mesh.scale.setScalar(0.3);
      this.scene.add(mesh);

      const strings = new StringBundle(this.scene, pos);

      // Arc apex: midpoint of from->to, raised so the artifact lobs upward.
      const control = origin.clone().lerp(pos, 0.5);
      control.y += SCATTER_ARC_HEIGHT;

      const trail = this._makeTrail(origin);

      this.artifacts.push({
        data, pos, mesh, strings, found: false,
        flying: true, flightT: 0,
        from: origin.clone(), to: pos.clone(), control,
        trail,
      });
    });

    this._spawnBurst(origin);
  }

  // A small additive Points trail that follows a flying artifact (ring buffer).
  _makeTrail(origin) {
    const positions = new Float32Array(TRAIL_N * 3);
    for (let i = 0; i < TRAIL_N; i++) {
      positions[i * 3] = origin.x;
      positions[i * 3 + 1] = origin.y;
      positions[i * 3 + 2] = origin.z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffe6b0, size: 0.22, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.scene.add(points);
    return { points, positions, mat, head: 0 };
  }

  // One-shot expanding puff at the burst origin.
  _spawnBurst(origin) {
    const count = 90;
    const positions = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = origin.x;
      positions[i * 3 + 1] = origin.y;
      positions[i * 3 + 2] = origin.z;
      const dir = new THREE.Vector3(
        Math.random() * 2 - 1, Math.random() * 1.6, Math.random() * 2 - 1,
      ).normalize().multiplyScalar(3 + Math.random() * 5);
      vel[i * 3] = dir.x; vel[i * 3 + 1] = dir.y; vel[i * 3 + 2] = dir.z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffe6b0, size: 0.42, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.scene.add(points);
    this._burst = { points, positions, vel, mat, life: 1 };
  }

  _tooClose(used, x, z, min) {
    return used.some(([ux, uz]) => {
      const dx = x - ux, dz = z - uz;
      return dx * dx + dz * dz < min * min;
    });
  }

  // Spiral outward to the nearest open spot if the chosen point is inside a collider.
  _nudgeClear(x, z) {
    if (!this.world.collidesAt(x, z, SPAWN_CLEARANCE)) return [x, z];
    const L = CONFIG.ZONE_HALF - 2;
    for (let d = 1; d <= 6; d++) {
      for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2;
        const tx = x + Math.cos(ang) * d, tz = z + Math.sin(ang) * d;
        if (Math.abs(tx) < L && Math.abs(tz) < L && !this.world.collidesAt(tx, tz, SPAWN_CLEARANCE)) {
          return [tx, tz];
        }
      }
    }
    return [x, z];
  }

  // True while any artifact is still in its scatter flight (caller can gate input).
  get flying() { return this.artifacts.some((a) => a.flying); }

  update(dt, t, playerPos, gatherPoint, camRight, camUp) {
    this._updateBurst(dt);

    let nearest = null, nearestDist = Infinity;
    for (const a of this.artifacts) {
      if (a.found) continue;

      if (a.flying) {
        this._updateFlight(a, dt);
        continue;                       // not collectible until it lands
      }

      const dist = playerPos.distanceTo(a.pos);
      a.strings.update(t, dist, gatherPoint, camRight, camUp);
      a.mesh.rotation.y = t * 0.6;
      a.mesh.position.y = a.pos.y + Math.sin(t * 1.5) * 0.06;
      if (dist < nearestDist) { nearestDist = dist; nearest = a; }
    }
    return { nearest, nearestDist };
  }

  // Advance one artifact along its arc; fade out the trail after it lands.
  _updateFlight(a, dt) {
    a.flightT = Math.min(1, a.flightT + dt / SCATTER_DURATION);
    const f = clamp01(a.flightT);
    const e = f * f * (3 - 2 * f);    // smoothstep ease

    // Quadratic Bézier: from -> control -> to.
    const inv = 1 - e;
    this._v.copy(a.from).multiplyScalar(inv * inv)
      .addScaledVector(a.control, 2 * inv * e)
      .addScaledVector(a.to, e * e);
    a.mesh.position.copy(this._v);
    a.mesh.rotation.y += dt * 6;
    a.mesh.rotation.x += dt * 4;
    a.mesh.scale.setScalar(0.3 + 0.7 * e);

    this._pushTrail(a.trail, this._v);

    if (a.flightT >= 1) {
      a.flying = false;
      a.mesh.position.copy(a.pos);
      a.mesh.scale.setScalar(1);
    }
  }

  // Append a position to a trail's ring buffer and slowly fade it.
  _pushTrail(trail, pos) {
    trail.positions[trail.head * 3] = pos.x;
    trail.positions[trail.head * 3 + 1] = pos.y;
    trail.positions[trail.head * 3 + 2] = pos.z;
    trail.head = (trail.head + 1) % TRAIL_N;
    trail.points.geometry.attributes.position.needsUpdate = true;
    trail.mat.opacity = Math.max(0, trail.mat.opacity - 0.012);
  }

  _updateBurst(dt) {
    const b = this._burst;
    if (!b || b.life <= 0) return;
    b.life = Math.max(0, b.life - dt * 1.1);
    for (let i = 0; i < b.positions.length / 3; i++) {
      b.positions[i * 3] += b.vel[i * 3] * dt;
      b.positions[i * 3 + 1] += (b.vel[i * 3 + 1] - 1.2) * dt;
      b.positions[i * 3 + 2] += b.vel[i * 3 + 2] * dt;
    }
    b.points.geometry.attributes.position.needsUpdate = true;
    b.mat.opacity = b.life;
    if (b.life <= 0) {
      this.scene.remove(b.points);
      b.points.geometry.dispose();
      b.mat.dispose();
      this._burst = null;
    }
  }

  collect(artifact) {
    artifact.found = true;
    this.collectedIds.add(artifact.data.id);   // persist across zone reloads
    this.scene.remove(artifact.mesh);
    artifact.strings.dispose(this.scene);
    if (artifact.trail) {
      this.scene.remove(artifact.trail.points);
      artifact.trail.points.geometry.dispose();
      artifact.trail.mat.dispose();
      artifact.trail = null;
    }
  }

  setResolution(w, h) {
    for (const a of this.artifacts) a.strings.setResolution(w, h);
  }

  // This visit's batch progress (drives "keep collecting vs. batch done").
  get foundCount() { return this.artifacts.filter((a) => a.found).length; }
  get total() { return this.artifacts.length; }
  // True once every revealed artifact this visit has been collected.
  get batchComplete() { return this.artifacts.length > 0 && this.foundCount >= this.total; }

  // Whole-zone progress, persisting across visits (drives final completion + HUD).
  get zoneTotal() { return ARTIFACT_DATA.length; }
  get zoneFoundCount() { return this.collectedIds.size; }
  get zoneComplete() { return this.zoneFoundCount >= this.zoneTotal; }
}
