// ============================================================
// NAV GRID — coarse walkability grid + BFS flow field for wave-combat
// pathfinding. Baked once per zone from the world's collidesAt AABB test;
// one BFS from the player's cell serves every enemy (they just sample a
// direction), so pathing cost is independent of the enemy count. All arrays
// are pre-allocated here — the flow rebuild and every query are alloc-free.
// ============================================================
import { CONFIG, COMBAT } from '../../config.js';

const UNREACHED = 0xffff;

export class NavGrid {
  constructor(world) {
    this.world = world;
    const cell = COMBAT.NAV.CELL;
    this.cell = cell;
    this.half = CONFIG.ZONE_HALF;
    this.n = Math.ceil((this.half * 2) / cell);   // cells per side
    const count = this.n * this.n;

    // Walkability: test each cell center once with the enemy-sized clearance.
    // (~9k point-vs-AABB-list tests, one-time at zone construction.)
    this.walk = new Uint8Array(count);
    for (let gz = 0; gz < this.n; gz++) {
      for (let gx = 0; gx < this.n; gx++) {
        const x = -this.half + (gx + 0.5) * cell;
        const z = -this.half + (gz + 0.5) * cell;
        this.walk[gz * this.n + gx] =
          world.collidesAt(x, z, COMBAT.NAV.BAKE_RADIUS) ? 0 : 1;
      }
    }

    // Flow field storage: BFS distance + the unit grid-step toward the player.
    this.dist = new Uint16Array(count);
    this.flowX = new Int8Array(count);
    this.flowZ = new Int8Array(count);
    this._queue = new Int32Array(count);
    this.dist.fill(UNREACHED);
  }

  _index(x, z) {
    const gx = Math.floor((x + this.half) / this.cell);
    const gz = Math.floor((z + this.half) / this.cell);
    if (gx < 0 || gz < 0 || gx >= this.n || gz >= this.n) return -1;
    return gz * this.n + gx;
  }

  // Rebuild the flow field: a BFS out from the player's cell writing, for each
  // reached cell, the step its occupant should take to get one cell closer.
  // 8-connected, but diagonals never cut a blocked orthogonal corner.
  computeFlow(px, pz) {
    const { n, walk, dist, flowX, flowZ, _queue: queue } = this;
    dist.fill(UNREACHED);

    let start = this._index(px, pz);
    // Player pressed against a wall can sample a blocked cell — nudge to the
    // nearest walkable neighbor so the field still forms.
    if (start >= 0 && !walk[start]) {
      for (const off of [-1, 1, -n, n, -n - 1, -n + 1, n - 1, n + 1]) {
        const s = start + off;
        if (s >= 0 && s < walk.length && walk[s]) { start = s; break; }
      }
    }
    if (start < 0 || !walk[start]) return;

    dist[start] = 0;
    flowX[start] = 0;
    flowZ[start] = 0;
    let head = 0, tail = 0;
    queue[tail++] = start;

    while (head < tail) {
      const cur = queue[head++];
      const cx = cur % n, cz = (cur / n) | 0;
      const d = dist[cur] + 1;
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dz === 0) continue;
          const nx = cx + dx, nz = cz + dz;
          if (nx < 0 || nz < 0 || nx >= n || nz >= n) continue;
          const ni = nz * n + nx;
          if (!walk[ni] || dist[ni] !== UNREACHED) continue;
          // No corner cutting: a diagonal needs both orthogonals clear.
          if (dx !== 0 && dz !== 0 &&
              (!walk[cz * n + nx] || !walk[nz * n + cx])) continue;
          dist[ni] = d;
          flowX[ni] = -dx;   // step back toward the parent (→ the player)
          flowZ[ni] = -dz;
          queue[tail++] = ni;
        }
      }
    }
  }

  // Write the flow step for the cell containing (x,z) into `out` ({x,z} — any
  // vector-like works). False when off-grid, blocked, or unreached by the last
  // BFS — the caller falls back to direct steering.
  dirAt(x, z, out) {
    const i = this._index(x, z);
    if (i < 0 || this.dist[i] === UNREACHED) return false;
    out.x = this.flowX[i];
    out.z = this.flowZ[i];
    return out.x !== 0 || out.z !== 0;
  }

  // Straight-line visibility between two XZ points, sampled against the world
  // colliders every LOS_STEP with a slim probe (walls block, open water not).
  hasLOS(ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 0.001) return true;
    const steps = Math.ceil(len / COMBAT.NAV.LOS_STEP);
    const invSteps = 1 / steps;
    for (let i = 1; i < steps; i++) {
      const f = i * invSteps;
      if (this.world.collidesAt(ax + dx * f, az + dz * f, 0.35)) return false;
    }
    return true;
  }
}
