// ============================================================
// ENDING CUTSCENES — portal pull and completed-museum camera tour
// ============================================================
import * as THREE from 'three';
import { ENDING, MUSEUM, clamp01 } from '../config.js';

const smooth = (f) => f * f * (3 - 2 * f);

class TimelineCamera {
  constructor(fov = 62, far = 220) {
    this.camera = new THREE.PerspectiveCamera(fov, innerWidth / innerHeight, 0.1, far);
    this.active = false;
    this._time = 0;
    this._resolve = null;
    this._pos = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._keys = [];
  }

  _sample(time) {
    const keys = this._keys;
    let i = 0;
    while (i < keys.length - 1 && time > keys[i + 1].t) i++;
    const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
    const f = smooth(clamp01((time - a.t) / ((b.t - a.t) || 1)));
    this._pos.lerpVectors(a.pos, b.pos, f);
    this._look.lerpVectors(a.look, b.look, f);
    this.camera.position.copy(this._pos);
    this.camera.lookAt(this._look);
  }

  _finish() {
    if (!this.active) return;
    this.active = false;
    const resolve = this._resolve;
    this._resolve = null;
    if (resolve) resolve();
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}

export class PortalPullCutscene extends TimelineCamera {
  constructor() {
    super(68, 220);
    this.appearProgress = 0;
    this.pullProgress = 0;
    this.distortion = 0;
    this._shake = new THREE.Vector3();
  }

  play(startPos, startForward, portalPos) {
    const { APPEAR, TURN, PULL } = ENDING.PORTAL;
    this._total = APPEAR + TURN + PULL;
    this._pullAt = APPEAR + TURN;
    const initialLook = startPos.clone().addScaledVector(startForward, 7);
    const portalLook = portalPos.clone();
    const approach = portalPos.clone().sub(startPos).normalize();
    const end = portalPos.clone().addScaledVector(approach, -0.12);
    this._pullStart = startPos.clone();
    this._pullEnd = end.clone();
    this._portalLook = portalLook.clone();
    this._keys = [
      { t: 0, pos: startPos.clone(), look: initialLook },
      { t: APPEAR, pos: startPos.clone(), look: initialLook },
      { t: this._pullAt, pos: startPos.clone(), look: portalLook },
      { t: this._total, pos: end, look: portalLook },
    ];
    this.active = true;
    this._time = 0;
    this.appearProgress = 0;
    this.pullProgress = 0;
    this.distortion = 0;
    this._sample(0);
    return new Promise((resolve) => { this._resolve = resolve; });
  }

  update(dt) {
    if (!this.active) return;
    this._time += dt;
    this._sample(Math.min(this._time, this._total));
    this.appearProgress = clamp01(this._time / ENDING.PORTAL.APPEAR);
    this.pullProgress = clamp01((this._time - this._pullAt) / ENDING.PORTAL.PULL);
    this.distortion = smooth(clamp01((this.pullProgress - 0.48) / 0.52));

    // A power curve keeps acceleration rising through the threshold instead of
    // easing to a stop like the camera-turn segments.
    if (this.pullProgress > 0) {
      const accelerating = Math.pow(this.pullProgress, 2.35);
      this.camera.position.lerpVectors(this._pullStart, this._pullEnd, accelerating);
      this.camera.lookAt(this._portalLook);
    }

    // Shake is applied after the clean path sample and only becomes noticeable
    // near the portal, preserving the readable initial turn.
    const amp = this.distortion * 0.075;
    this._shake.set(
      Math.sin(this._time * 43) * amp,
      Math.sin(this._time * 57 + 1.2) * amp * 0.65,
      Math.sin(this._time * 37 + 2.1) * amp * 0.3,
    );
    this.camera.position.add(this._shake);
    if (this._time >= this._total) this._finish();
  }
}

export class MuseumEndingCutscene extends TimelineCamera {
  constructor(museum) {
    super(58, 120);
    this.museum = museum;
  }

  play() {
    const H = MUSEUM.ROOM_HALF;
    const T = ENDING.MUSEUM_DURATION;
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    this._total = T;
    this._keys = [
      { t: 0, pos: v(0, 1.7, H - 1.5), look: v(0, 1.8, 0) },
      { t: T * 0.22, pos: v(-2.5, 2.2, 3.5), look: v(-H, 2.0, -1.5) },
      { t: T * 0.42, pos: v(-H + 1, 2.0, 2), look: v(-H - 7, 2.0, 2) },
      { t: T * 0.62, pos: v(-2, 2.2, 4), look: v(H, 2.0, -1.5) },
      { t: T * 0.82, pos: v(H - 1, 2.0, 2), look: v(H + 7, 2.0, 2) },
      { t: T, pos: v(0, 2.8, 6), look: v(0, 1.7, -H) },
    ];
    this.active = true;
    this._time = 0;
    this._sample(0);
    return new Promise((resolve) => { this._resolve = resolve; });
  }

  update(dt) {
    if (!this.active) return;
    this._time += dt;
    this._sample(Math.min(this._time, this._total));
    if (this._time >= this._total) this._finish();
  }
}
