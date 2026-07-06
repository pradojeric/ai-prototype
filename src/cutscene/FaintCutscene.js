// ============================================================
// FAINT CUTSCENE — "the player blacks out" (scripted camera over the live world)
// ============================================================
// A thin cinematic driver modeled on DefeatCutscene: owns a camera + a short
// keyframed timeline that DROOPS the view — sinking toward the water and tilting
// down — as the player loses consciousness after a wrong riddle answer. It
// renders over the *live world* (Game only swaps renderPass.camera to this one),
// so the fleeing guardian + water stay visible while a black overlay fades in on
// top. Owns no geometry; the player's own camera is left untouched and restored.
import * as THREE from 'three';
import { FAINT, WORLD_UP, clamp01 } from '../config.js';

const smooth = (f) => f * f * (3 - 2 * f);   // smoothstep ease

export class FaintCutscene {
  constructor() {
    // Far plane 200 matches the gameplay camera so distant fog reads the same.
    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200);

    this.active = false;
    this._time = 0;
    this._total = 0;
    this._resolve = null;

    this._keys = [];
    this._pos = new THREE.Vector3();   // scratch — no per-frame allocation
    this._look = new THREE.Vector3();
  }

  // Begin the faint. `startPos` is the camera pose when the riddle ended; `lookAt`
  // the point it was looking at. The view sinks + tilts down over FAINT.DROOP,
  // then resolves (Game holds the black, repositions, and fades back in).
  play(startPos, lookAt) {
    this.active = true;
    this._time = 0;
    this._keys = this._buildKeyframes(startPos, lookAt);
    this._total = FAINT.DROOP;
    this._sample(0);
    return new Promise((res) => { this._resolve = res; });
  }

  // Two keyframes: from the player's standing pose to a sunk, downward-tilted
  // gaze — the head dropping as the player collapses.
  _buildKeyframes(startPos, lookAt) {
    const endPos = startPos.clone().addScaledVector(WORLD_UP, -FAINT.SINK);
    // Pull the gaze down toward the water just ahead, so the horizon rolls away.
    const endLook = new THREE.Vector3(
      (startPos.x + lookAt.x) * 0.5,
      lookAt.y - FAINT.SINK * 2.5,
      (startPos.z + lookAt.z) * 0.5,
    );
    return [
      { t: 0,           pos: startPos.clone(), look: lookAt.clone() },
      { t: FAINT.DROOP, pos: endPos,           look: endLook },
    ];
  }

  update(dt) {
    if (!this.active) return;
    this._time += dt;
    this._sample(Math.min(this._time, this._total));
    if (this._time >= this._total) this._finish();
  }

  _sample(time) {
    const k = this._keys;
    let i = 0;
    while (i < k.length - 1 && time > k[i + 1].t) i++;
    const a = k[i];
    const b = k[Math.min(i + 1, k.length - 1)];
    const span = (b.t - a.t) || 1;
    const f = smooth(clamp01((time - a.t) / span));
    this._pos.lerpVectors(a.pos, b.pos, f);
    this._look.lerpVectors(a.look, b.look, f);
    this.camera.position.copy(this._pos);
    this.camera.lookAt(this._look);
  }

  _finish() {
    if (!this.active) return;
    this.active = false;
    const res = this._resolve;
    this._resolve = null;
    res && res();
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
