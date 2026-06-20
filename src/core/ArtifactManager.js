// ============================================================
// ARTIFACT MANAGER — placement seeding + interaction (GDD §6/§7)
// ============================================================
import * as THREE from 'three';
import { CONFIG, mulberry32, PLAYER_RADIUS } from '../config.js';
import { ARTIFACT_DATA } from '../data.js';
import { StringBundle } from './StringSystem.js';

const SPAWN_CLEARANCE = PLAYER_RADIUS + 0.4;  // keep artifacts reachable

export class ArtifactManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;          // provides spawnNodes + collidesAt
    this.artifacts = [];
    this._place();
  }

  _place() {
    const rng = mulberry32((Date.now() & 0xffff) ^ 0x9e37); // per-session
    const used = [];
    ARTIFACT_DATA.forEach((data) => {
      const nodes = this.world.spawnNodes[data.spawnTag] || this.world.spawnNodes.open_water;
      // Pick a jittered node that isn't crowding another artifact or stuck in a wall.
      let x = 0, z = 0, tries = 0;
      do {
        const [nx, nz] = nodes[Math.floor(rng() * nodes.length)];
        x = nx + (rng() - 0.5) * 3;
        z = nz + (rng() - 0.5) * 3;
        tries++;
      } while (tries < 12 && (this._tooClose(used, x, z, 8) || this.world.collidesAt(x, z, SPAWN_CLEARANCE)));
      [x, z] = this._nudgeClear(x, z);       // final safety nudge out of any collider
      used.push([x, z]);

      // elevated artifacts sit a little higher so they read as resting on rubble
      const y = CONFIG.WATER_LEVEL + (data.spawnTag === 'elevated_rubble' ? 0.6 : 0.25);
      const pos = new THREE.Vector3(x, y, z);

      const mesh = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.32, 0),
        new THREE.MeshStandardMaterial({
          color: 0xffe6b0, emissive: 0x5a4322, roughness: .4, metalness: .3,
        })
      );
      mesh.position.copy(pos);
      this.scene.add(mesh);

      const strings = new StringBundle(this.scene, pos);
      this.artifacts.push({ data, pos, mesh, strings, found: false });
    });
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

  update(t, playerPos, gatherPoint, camRight, camUp) {
    let nearest = null, nearestDist = Infinity;
    for (const a of this.artifacts) {
      if (a.found) continue;
      const dist = playerPos.distanceTo(a.pos);
      a.strings.update(t, dist, gatherPoint, camRight, camUp);
      a.mesh.rotation.y = t * 0.6;
      a.mesh.position.y = a.pos.y + Math.sin(t * 1.5) * 0.06;
      if (dist < nearestDist) { nearestDist = dist; nearest = a; }
    }
    return { nearest, nearestDist };
  }

  collect(artifact) {
    artifact.found = true;
    this.scene.remove(artifact.mesh);
    artifact.strings.dispose(this.scene);
  }

  setResolution(w, h) {
    for (const a of this.artifacts) a.strings.setResolution(w, h);
  }

  get foundCount() { return this.artifacts.filter((a) => a.found).length; }
  get total() { return this.artifacts.length; }
}
