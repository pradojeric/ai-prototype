// ============================================================
// ENDING CUTSCENES — portal pull and completed-museum camera tour
// ============================================================
import * as THREE from 'three';
import { ENDING, MUSEUM, clamp01 } from '../config.js';

const smooth = (f) => f * f * (3 - 2 * f);

// Compass heading from one point toward another, matching lookAt's convention.
const yawOf = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);

// Halfway between two headings, taking the short way round. An exact reversal has
// no short way, so it sweeps through whichever side faces +Z — in the museum that
// means turning across the galleries rather than across the portal wall behind.
function bisectYaw(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  if (Math.abs(Math.abs(d) - Math.PI) < 1e-3) d = Math.sin(a) <= 0 ? Math.PI : -Math.PI;
  return a + d / 2;
}

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

  // A walkthrough of the finished museum: into each zone's gallery in turn, past
  // its ring of cased memories, then back to the lobby to settle on the altar.
  // Every anchor comes from the museum itself (galleryTour) so the shot list can
  // never drift out of sync with where the rooms actually are.
  play() {
    const H = MUSEUM.ROOM_HALF;
    const T = ENDING.MUSEUM_DURATION;
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    const tours = this.museum.galleryTour();
    const altar = v(0, 1.15, 0);
    this._total = T;

    // _sample lerps the look POINT, and lookAt() flips 180° the instant that point
    // passes through the camera. So every beat here keeps its target well ahead of
    // the camera, and each turn between rooms is split across a `swing` keyframe
    // that sweeps the gaze sideways instead of dragging it through the lens.
    //
    // That is why the tour opens on the FAR side of the altar looking across it
    // toward the first gallery rather than standing in front of the gallery and
    // looking back — the latter needs a 180° reversal on the very first pan.
    const keys = [{ t: 0, pos: v(0, 1.7, -H * 0.7), look: altar }];
    const finalPos = v(0, 2.9, H * 0.7);
    const share = (T * 0.9) / (tours.length || 1);

    tours.forEach((g, i) => {
      const t0 = T * 0.05 + i * share;
      const next = tours[i + 1];
      // Where the camera stands while turning toward whatever comes next. Its
      // target is 10 m out along the heading that BISECTS the turn, so each half
      // is at most 90° and the target can never cross the camera. Aiming it at the
      // destination instead would put it dead opposite the outgoing gaze on the
      // Zone 2 -> Zone 3 leg, which is a straight reversal along one line — and
      // that is exactly the case that flips.
      const goal = next ? next.approach : finalPos;
      const midYaw = bisectYaw(yawOf(g.doorway, g.far), yawOf(goal, next ? next.centre : altar));
      const swing = g.approach.clone().lerp(goal, 0.5);
      const swingLook = v(swing.x + Math.sin(midYaw) * 10, 1.85, swing.z + Math.cos(midYaw) * 10);
      keys.push(
        // crossing the lobby toward this gallery, already looking through its door
        { t: t0 + share * 0.18, pos: g.approach, look: g.centre },
        // through the doorway, the whole ring ahead
        { t: t0 + share * 0.40, pos: g.doorway, look: g.centre },
        // drifting into the ring, sweeping the cases around it
        { t: t0 + share * 0.64, pos: g.offset, look: g.far },
        // pull back out through the door, still facing into the room
        { t: t0 + share * 0.80, pos: g.doorway, look: g.far },
        // turn toward the next room (or the closing beat)
        { t: t0 + share, pos: swing, look: swingLook },
      );
    });
    // Rise over the lobby and settle on the Soul Altar for the closing beat.
    // Kept as a fraction of the lobby so resizing it never pushes this into a wall.
    keys.push({ t: T, pos: finalPos, look: altar });

    this._keys = keys;
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
