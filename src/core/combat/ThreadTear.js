// ============================================================
// THREAD TEAR — the spawn portal every arena enemy arrives through. Taut
// fishing-line strands prick a seam open, splay and strain against it, then
// whip loose as the body rises through; the seam snaps shut behind it.
//
// The vocabulary is deliberately the game's own: these are the same fat
// `Line2` threads StringSystem draws to artifacts, so a summon reads as the
// world being *pulled* open rather than as a generic magic circle.
//
// Pooled like the rest of CombatVfx and allocation-free per frame: every
// strand of every tear lives in ONE LineSegments2 (per-tear brightness is
// baked into vertex colors, since material opacity is shared), and the hot
// seam slits are one InstancedMesh. Two draw calls for the whole pool.
// ============================================================
import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { VFX } from '../../config.js';

const WHITE = new THREE.Color(0xffffff);
const PARKED_Y = -1000;                             // where idle strands wait (see _clearTear)
const SERIAL_WRAP = 1024;                           // tear handle = slot + serial * POOL
const smooth = (f) => f * f * (3 - 2 * f);          // smoothstep ease
// Eased 0→1 ramp over [a, b], flat outside it — the timeline is written as a
// stack of these so each beat can overlap the next.
const ramp = (x, a, b) => smooth(Math.max(0, Math.min(1, (x - a) / (b - a))));

export class ThreadTear {
  constructor(scene, color) {
    this.scene = scene;
    this.color = new THREE.Color(color);

    const { POOL, STRANDS, SAMPLES } = VFX.TEAR;
    this._segmentsPerTear = STRANDS * (SAMPLES - 1);
    const segments = POOL * this._segmentsPerTear;

    // ---- strands: one LineSegments2 for the entire pool -------------------
    // setPositions/setColors allocate, so they run once here; from then on we
    // write straight into the interleaved buffers they built.
    this.geometry = new LineSegmentsGeometry();
    this.geometry.setPositions(new Float32Array(segments * 6));
    this.geometry.setColors(new Float32Array(segments * 6));
    this._posBuffer = this.geometry.getAttribute('instanceStart').data;
    this._colBuffer = this.geometry.getAttribute('instanceColorStart').data;
    this._pos = this._posBuffer.array;
    this._col = this._colBuffer.array;

    this.material = new LineMaterial({
      color: 0xffffff,
      linewidth: VFX.TEAR.LINEWIDTH,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      dashed: false,
    });
    this.material.resolution.set(innerWidth, innerHeight);
    this.lines = new LineSegments2(this.geometry, this.material);
    this.lines.frustumCulled = false;
    scene.add(this.lines);

    // ---- seams: the hot slit each tear is peeled open around -------------
    this._seamGeometry = new THREE.PlaneGeometry(1, 1);
    this._seamMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.seamMesh = new THREE.InstancedMesh(this._seamGeometry, this._seamMaterial, POOL);
    this.seamMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.seamMesh.frustumCulled = false;
    scene.add(this.seamMesh);

    this._dummy = new THREE.Object3D();
    this._scratchColor = new THREE.Color();
    this._dirty = false;        // one final upload is owed after the last tear closes

    this.tears = [];
    for (let i = 0; i < POOL; i++) {
      this.tears.push({
        active: false,
        closing: false,
        life: 0,             // seconds since the tear opened
        duration: 1,         // seconds the open arc runs (COMBAT.SPAWN_TELEGRAPH)
        closeLife: 0,        // seconds left in the recoil once the body is through
        serial: 0,           // bumped per open() so stale handles can't close it
        position: new THREE.Vector3(),
        yaw: 0, cos: 1, sin: 0,   // frozen facing (see open())
        phase: new Float32Array(VFX.TEAR.STRANDS),
        lean: new Float32Array(VFX.TEAR.STRANDS),
      });
      this.seamMesh.setColorAt(i, new THREE.Color(0x000000));
    }
    this.reset();               // parks every strand and seam
  }

  setResolution(w, h) { this.material.resolution.set(w, h); }

  // ---- lifecycle --------------------------------------------------------

  // Open a tear standing on `position`, facing `camera`. The facing is frozen
  // here rather than billboarded per frame: a rift that swims to track a
  // strafing player reads as a decal, not as a hole in the world.
  // Returns the pool slot so the caller can close this exact tear later.
  open(position, camera, duration) {
    let index = this.tears.findIndex((tear) => !tear.active);
    if (index < 0) {          // full pool: recycle the tear furthest along
      index = 0;
      for (let i = 1; i < this.tears.length; i++) {
        if (this.tears[i].life > this.tears[index].life) index = i;
      }
    }
    const tear = this.tears[index];
    tear.active = true;
    tear.closing = false;
    tear.life = 0;
    tear.duration = Math.max(0.01, duration);
    tear.closeLife = 0;
    tear.position.copy(position);

    const yaw = camera
      ? Math.atan2(camera.position.x - position.x, camera.position.z - position.z)
      : 0;
    tear.yaw = yaw;
    tear.cos = Math.cos(yaw);
    tear.sin = Math.sin(yaw);

    for (let s = 0; s < VFX.TEAR.STRANDS; s++) {
      tear.phase[s] = Math.random() * Math.PI * 2;
      // Alternating sides, unequal bows: a hand-woven seam, not a symmetric one.
      tear.lean[s] = (s % 2 ? 1 : -1) * (0.55 + Math.random() * 0.55);
    }
    // The handle carries a serial as well as the slot, so a caller holding a
    // stale id (its tear was recycled by a bigger wave) cannot close someone
    // else's rift.
    tear.serial = (tear.serial + 1) % SERIAL_WRAP;
    return index + tear.serial * VFX.TEAR.POOL;
  }

  // The body is through: snap the seam shut and let the strands recoil.
  close(id) {
    if (id < 0) return;
    const index = id % VFX.TEAR.POOL;
    const tear = this.tears[index];
    if (!tear || !tear.active || tear.closing) return;
    if (tear.serial !== Math.floor(id / VFX.TEAR.POOL)) return;   // recycled slot
    tear.closing = true;
    tear.closeLife = VFX.TEAR.CLOSE_TIME;
  }

  // ---- per-frame --------------------------------------------------------

  update(dt, t) {
    let anyActive = false;
    for (let i = 0; i < this.tears.length; i++) {
      const tear = this.tears[i];
      if (!tear.active) continue;
      anyActive = true;

      tear.life += dt;
      if (tear.closing) {
        tear.closeLife -= dt;
        if (tear.closeLife <= 0) {
          tear.active = false;
          this._clearTear(i);
          this._hideSeam(i);
          this.seamMesh.setColorAt(i, this._scratchColor.setRGB(0, 0, 0));
          continue;
        }
      }
      this._writeTear(i, tear, t);
    }

    // Skip the GPU uploads entirely when no fight is spawning anything.
    if (!anyActive && !this._dirty) return;
    this._dirty = anyActive;
    this._posBuffer.needsUpdate = true;
    this._colBuffer.needsUpdate = true;
    this.seamMesh.instanceMatrix.needsUpdate = true;
    this.seamMesh.instanceColor.needsUpdate = true;
  }

  // The whole timeline lives here. `p` is 0→1 across the telegraph:
  //   0.00-0.18 prick   — a bright point, strands snapping taut
  //   0.18-0.55 unzip   — the seam runs open, strands splay and bow
  //   0.55-0.85 strain  — the seam widens, the threads vibrate under load
  //   0.85-1.00 birth   — a white flare as the body starts to come through
  // `k` (1→0) then recoils everything once close() has been called.
  _writeTear(index, tear, t) {
    const { STRANDS, SAMPLES, HEIGHT, WIDTH } = VFX.TEAR;
    const p = Math.min(1, tear.life / tear.duration);
    const k = tear.closing ? Math.max(0, tear.closeLife / VFX.TEAR.CLOSE_TIME) : 1;

    const unzip = ramp(p, 0.02, 0.55);
    const strain = ramp(p, 0.5, 0.85);
    const birth = ramp(p, 0.85, 1);

    // A floor under the seam height keeps the prick visible as a short slit —
    // and keeps every strand segment non-degenerate, which LineMaterial needs.
    const height = HEIGHT * (0.04 + 0.96 * unzip);
    const splay = WIDTH * (0.15 + 0.85 * unzip) * (1 + birth * 0.5) * (1 + (1 - k) * 1.6);
    const shake = (0.02 + 0.05 * strain) * k;
    const bright = (0.35 + 0.65 * unzip + birth * 1.9) * k * k;

    const bottom = tear.position.y + 0.05;
    const base = index * this._segmentsPerTear * 6;

    for (let s = 0; s < STRANDS; s++) {
      const phase = tear.phase[s];
      const lean = tear.lean[s];
      // Depth bow keeps the weave from reading as a flat cutout.
      const depthLean = Math.cos(phase) * 0.35;
      let px = 0, py = 0, pz = 0;

      for (let i = 0; i < SAMPLES; i++) {
        const f = i / (SAMPLES - 1);
        const arc = Math.sin(f * Math.PI);            // pinned at both seam ends
        const wobble = Math.sin(t * 14 + f * 8 + phase) * arc * shake;
        const lx = arc * splay * lean + wobble;
        const ly = f * height;
        const lz = arc * splay * depthLean;

        // Local (right, up, forward) → world, with the tear's frozen facing.
        const x = tear.position.x + lx * tear.cos + lz * tear.sin;
        const y = bottom + ly;
        const z = tear.position.z - lx * tear.sin + lz * tear.cos;

        if (i > 0) {
          const o = base + (s * (SAMPLES - 1) + (i - 1)) * 6;
          this._pos[o] = px;     this._pos[o + 1] = py;     this._pos[o + 2] = pz;
          this._pos[o + 3] = x;  this._pos[o + 4] = y;      this._pos[o + 5] = z;

          // Threads burn brightest mid-span and fade into the seam ends.
          const a = bright * Math.sin(((i - 1) / (SAMPLES - 1)) * Math.PI) ** 0.6;
          const b = bright * Math.sin(f * Math.PI) ** 0.6;
          this._col[o] = this.color.r * a;
          this._col[o + 1] = this.color.g * a;
          this._col[o + 2] = this.color.b * a;
          this._col[o + 3] = this.color.r * b;
          this._col[o + 4] = this.color.g * b;
          this._col[o + 5] = this.color.b * b;
        }
        px = x; py = y; pz = z;
      }
    }

    // The seam: a sliver at the prick, a loaded slit through the strain, then
    // a hard horizontal snap shut (height survives a beat longer than width,
    // so the closing read is a zip, not a fade).
    const seamW = (0.05 + 0.16 * strain + 0.5 * birth) * (k * k);
    const seamH = height * (0.55 + 0.45 * k);
    this._dummy.position.set(tear.position.x, bottom + seamH * 0.5, tear.position.z);
    this._dummy.rotation.set(0, tear.yaw, 0);
    this._dummy.scale.set(Math.max(0.001, seamW), Math.max(0.001, seamH), 1);
    this._dummy.updateMatrix();
    this.seamMesh.setMatrixAt(index, this._dummy.matrix);

    // The core runs hotter than the threads and blows out white at the birth
    // beat — that overbright is what the bloom pass picks up.
    const heat = (0.6 + 1.4 * unzip + birth * 2.6) * k;
    this._scratchColor.copy(this.color).lerp(WHITE, Math.min(0.85, birth)).multiplyScalar(heat);
    this.seamMesh.setColorAt(index, this._scratchColor);
  }

  // Park an idle tear's segments far below the world instead of collapsing them
  // to a point: LineMaterial normalises the segment direction, and a truly
  // zero-length segment feeds it NaN. The stub keeps a real direction, and its
  // black vertex colors contribute nothing through additive blending anyway.
  _clearTear(index) {
    const base = index * this._segmentsPerTear * 6;
    const end = base + this._segmentsPerTear * 6;
    this._col.fill(0, base, end);
    for (let o = base; o < end; o += 6) {
      this._pos[o] = 0;         this._pos[o + 1] = PARKED_Y; this._pos[o + 2] = 0;
      this._pos[o + 3] = 0.01;  this._pos[o + 4] = PARKED_Y; this._pos[o + 5] = 0;
    }
  }

  _hideSeam(index) {
    this._dummy.position.set(0, -100, 0);
    this._dummy.rotation.set(0, 0, 0);
    this._dummy.scale.setScalar(0.001);
    this._dummy.updateMatrix();
    this.seamMesh.setMatrixAt(index, this._dummy.matrix);
  }

  reset() {
    for (let i = 0; i < this.tears.length; i++) {
      this.tears[i].active = false;
      this.tears[i].closing = false;
      this._clearTear(i);
      this._hideSeam(i);
      this.seamMesh.setColorAt(i, this._scratchColor.setRGB(0, 0, 0));
    }
    this._dirty = true;
    this._posBuffer.needsUpdate = true;
    this._colBuffer.needsUpdate = true;
    this.seamMesh.instanceMatrix.needsUpdate = true;
    this.seamMesh.instanceColor.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.lines, this.seamMesh);
    this.geometry.dispose();
    this.material.dispose();
    this._seamGeometry.dispose();
    this._seamMaterial.dispose();
  }
}
