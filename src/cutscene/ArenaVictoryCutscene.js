// ============================================================
// ARENA VICTORY CUTSCENE — shared first-person boss-rift return.
// ============================================================
import * as THREE from 'three';
import { ARENA, clamp01 } from '../config.js';
import { ArenaVictoryRift } from './_partials/ArenaVictoryRift.js';

const VICTORY = ARENA.VICTORY;
const smooth = (value) => value * value * (3 - 2 * value);

export class ArenaVictoryCutscene {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(
      VICTORY.BASE_FOV,
      innerWidth / innerHeight,
      0.1,
      220,
    );
    this.active = false;
    this.distortion = 0;
    this.flash = 0;
    this._time = 0;
    this._resolve = null;
    this._rift = null;
    this._onRiftOpen = null;
    this._riftOpenNotified = false;
    this._start = new THREE.Vector3();
    this._initialLook = new THREE.Vector3();
    this._riftPosition = new THREE.Vector3();
    this._pullEnd = new THREE.Vector3();
    this._lookEnd = new THREE.Vector3();
    this._cleanPosition = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._approach = new THREE.Vector3();
    this._shake = new THREE.Vector3();
  }

  play(scene, arenaId, startPosition, startForward, riftPosition, onRiftOpen = null) {
    this.dispose();
    this._start.copy(startPosition);
    this._riftPosition.copy(riftPosition);
    this._approach.copy(this._riftPosition).sub(this._start);
    if (this._approach.lengthSq() < 0.01) this._approach.copy(startForward);
    if (this._approach.lengthSq() < 0.01) this._approach.set(0, 0, -1);
    this._approach.normalize();
    this._initialLook.copy(this._start).addScaledVector(startForward, 7);
    this._pullEnd.copy(this._riftPosition).addScaledVector(
      this._approach,
      VICTORY.END_DEPTH,
    );
    this._lookEnd.copy(this._riftPosition).addScaledVector(this._approach, 4);
    this._rift = new ArenaVictoryRift(
      scene,
      arenaId,
      this._riftPosition,
      this._start,
    );
    this._onRiftOpen = onRiftOpen;
    this._riftOpenNotified = false;
    this.active = true;
    this.distortion = 0;
    this.flash = 0;
    this._time = 0;
    this.camera.fov = VICTORY.BASE_FOV;
    this.camera.position.copy(this._start);
    this.camera.lookAt(this._initialLook);
    this.camera.updateProjectionMatrix();
    return new Promise((resolve) => { this._resolve = resolve; });
  }

  update(dt, globalTime) {
    if (!this.active) return;
    this._time = Math.min(VICTORY.TOTAL, this._time + dt);
    if (!this._riftOpenNotified && this._time >= VICTORY.RIFT_START) {
      this._riftOpenNotified = true;
      this._onRiftOpen?.();
    }
    this._rift?.update(dt, globalTime, this._time);
    this._sampleCamera();
    this.distortion = smooth(clamp01(
      (this._time - VICTORY.DISTORT_START) /
        (VICTORY.TOTAL - VICTORY.DISTORT_START),
    ));
    this.flash = smooth(clamp01(
      (this._time - VICTORY.FLASH_START) / (VICTORY.TOTAL - VICTORY.FLASH_START),
    ));
    if (this._time >= VICTORY.TOTAL) this._finish();
  }

  _sampleCamera() {
    const turn = smooth(clamp01(
      (this._time - VICTORY.IMPACT_END) /
        (VICTORY.PULL_START - VICTORY.IMPACT_END),
    ));
    this._cleanPosition.copy(this._start);
    this._look.lerpVectors(this._initialLook, this._riftPosition, turn);

    let pull = 0;
    if (this._time >= VICTORY.PULL_START) {
      pull = clamp01(
        (this._time - VICTORY.PULL_START) / (VICTORY.TOTAL - VICTORY.PULL_START),
      );
      const accelerating = Math.pow(pull, 2.35);
      this._cleanPosition.lerpVectors(this._start, this._pullEnd, accelerating);
      this._look.lerpVectors(this._riftPosition, this._lookEnd, smooth(pull));
    }

    this.camera.position.copy(this._cleanPosition);
    this.camera.lookAt(this._look);
    this.camera.fov = THREE.MathUtils.lerp(
      VICTORY.BASE_FOV,
      VICTORY.PULL_FOV,
      smooth(pull),
    );
    this.camera.updateProjectionMatrix();

    const impact = 1 - clamp01(Math.abs(this._time - 0.72) / 0.42);
    const amplitude = VICTORY.SHAKE_MAX * (impact * 0.42 + pull * pull);
    this._shake.set(
      Math.sin(this._time * 43) * amplitude,
      Math.sin(this._time * 57 + 1.1) * amplitude * 0.68,
      Math.sin(this._time * 37 + 2.2) * amplitude * 0.28,
    );
    this.camera.position.add(this._shake);
  }

  _finish() {
    if (!this.active) return;
    this.active = false;
    const resolve = this._resolve;
    this._resolve = null;
    resolve?.();
  }

  resize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this._rift?.dispose();
    this._rift = null;
    this._onRiftOpen = null;
    if (!this.active) return;
    this.active = false;
    const resolve = this._resolve;
    this._resolve = null;
    resolve?.();
  }
}
