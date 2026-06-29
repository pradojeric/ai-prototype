// ============================================================
// DEFEAT CUTSCENE — "the guardian falls" (scripted camera over the live world)
// ============================================================
// A thin cinematic driver modeled on IntroCutscene: owns a camera + a keyframed
// timeline and plays the frame-the-guardian -> EXPLODE -> look-up-at-the-scatter
// beat. It renders over the *live world* scene (Game only swaps renderPass.camera
// to this one), so the real guardian + scattering artifacts stay visible. Owns no
// geometry; the player's own camera is left untouched and restored afterward.
import * as THREE from 'three';
import { CUTSCENE_DEFEAT, WORLD_UP, clamp01 } from '../config.js';

const smooth = (f) => f * f * (3 - 2 * f);   // smoothstep ease

export class DefeatCutscene {
  constructor() {
    // Far plane 200 matches the gameplay camera so distant artifacts/fog read the same.
    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200);

    this.active = false;
    this._time = 0;
    this._total = 0;
    this._exploded = false;
    this._onExplode = null;
    this._resolve = null;

    this._keys = [];
    this._pos = new THREE.Vector3();   // scratch — no per-frame allocation
    this._look = new THREE.Vector3();
  }

  // Begin the cinematic. `origin` is the guardian's center; `playerPos` the camera
  // pose when the riddle ended. `onExplode` fires at the FRAME->LOOK_UP boundary.
  // Resolves once the SETTLE beat finishes.
  play(origin, playerPos, { onExplode } = {}) {
    this.active = true;
    this._time = 0;
    this._exploded = false;
    this._onExplode = onExplode || null;
    this._keys = this._buildKeyframes(origin, playerPos);
    this._total = CUTSCENE_DEFEAT.FRAME + CUTSCENE_DEFEAT.LOOK_UP + CUTSCENE_DEFEAT.SETTLE;
    this._sample(0);
    return new Promise((res) => { this._resolve = res; });
  }

  // Camera path keyframes { t, pos, look }, anchored on the guardian + player.
  _buildKeyframes(origin, playerPos) {
    const { FRAME, LOOK_UP, SETTLE, BACK_DIST, RISE, LOOK_UP_HEIGHT } = CUTSCENE_DEFEAT;

    // Horizontal "back" direction from the guardian toward where the player stood,
    // so the hero shot pulls back the way the player was already facing.
    const back = new THREE.Vector3(playerPos.x - origin.x, 0, playerPos.z - origin.z);
    if (back.lengthSq() < 0.01) back.set(0, 0, 1);
    back.normalize();

    const framePos = origin.clone()
      .addScaledVector(back, BACK_DIST)
      .addScaledVector(WORLD_UP, RISE);

    const tFrame = FRAME;
    const tLookUp = tFrame + LOOK_UP;
    const tSettle = tLookUp + SETTLE;

    return [
      { t: 0,            pos: playerPos.clone(),                              look: origin.clone() },                                  // start from the player's vantage
      { t: FRAME * 0.65, pos: framePos.clone(),                              look: origin.clone() },                                  // ease into the hero framing
      { t: tFrame,       pos: framePos.clone(),                              look: origin.clone() },                                  // hold — guardian seen in full
      { t: tLookUp,      pos: framePos.clone().addScaledVector(WORLD_UP, 0.8), look: origin.clone().addScaledVector(WORLD_UP, LOOK_UP_HEIGHT) }, // slight tilt up, follow the arc
      { t: tSettle,      pos: framePos.clone().addScaledVector(WORLD_UP, 0.8), look: origin.clone() },                                  // ease the gaze back toward the burst spot
    ];
  }

  update(dt) {
    if (!this.active) return;
    this._time += dt;
    this._sample(Math.min(this._time, this._total));

    // Fire the explosion the instant the hero-shot hold ends.
    if (!this._exploded && this._time >= CUTSCENE_DEFEAT.FRAME) {
      this._exploded = true;
      this._onExplode && this._onExplode();
    }

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
