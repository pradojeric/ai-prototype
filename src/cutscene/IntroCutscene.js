// ============================================================
// INTRO CUTSCENE — "waking in the digital museum" (scripted camera)
// ============================================================
// A thin cinematic driver: owns a camera + keyframed timeline and plays the
// wake -> look around -> notice the light -> drift toward it -> fade-to-white
// sequence over a shared Museum scene. Owns no geometry; the Museum is reused
// by the future hub, so this never disposes it.
import * as THREE from 'three';
import { CUTSCENE, MUSEUM, clamp01 } from '../config.js';

const smooth = (f) => f * f * (3 - 2 * f);   // smoothstep ease

export class IntroCutscene {
  constructor(museum) {
    this.museum = museum;
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 100);

    this.wake = document.getElementById('wake');     // black "eyes closed" overlay
    this.flash = document.getElementById('flash');   // shared white fade-to-white

    this.active = false;
    this._time = 0;
    this._fadeStarted = false;
    this._resolve = null;

    this._pos = new THREE.Vector3();   // scratch — no per-frame allocation
    this._look = new THREE.Vector3();

    this._keys = this._buildKeyframes();
    this._total = CUTSCENE.WAKE + CUTSCENE.LOOK + CUTSCENE.NOTICE + CUTSCENE.MOVE + CUTSCENE.FADE;
  }

  // Camera path keyframes { t, pos, look }, anchored on the museum's own points.
  _buildKeyframes() {
    const H = MUSEUM.ROOM_HALF;
    const s = this.museum.spawnPoint;
    const hall = this.museum.hallwayPoint;
    const v = (x, y, z) => new THREE.Vector3(x, y, z);

    const tWake = CUTSCENE.WAKE;
    const tLook = tWake + CUTSCENE.LOOK;
    const tNotice = tLook + CUTSCENE.NOTICE;
    const tMove = tNotice + CUTSCENE.MOVE;
    const tFade = tMove + CUTSCENE.FADE;

    return [
      { t: 0,                          pos: v(0, 0.8, s.z),      look: v(0, 0.35, s.z - 2.5) }, // waking, head low
      { t: tWake,                      pos: v(0, 1.5, s.z),      look: v(0, 1.5, 0) },          // stand, face the room
      { t: tWake + CUTSCENE.LOOK * 0.30, pos: v(0.5, 1.55, s.z - 0.3), look: v(H, 1.8, -2.6) },  // glance right wall
      { t: tWake + CUTSCENE.LOOK * 0.60, pos: v(-0.5, 1.55, s.z - 0.3), look: v(-H, 1.8, -2.6) }, // glance left wall
      { t: tLook,                      pos: v(0, 1.55, s.z - 0.4), look: v(0, 1.6, -H) },         // settle, calm — light still OFF
      // --- NOTICE: light snaps on, player is taken aback (quick recoil) ---
      { t: tLook + 0.28,               pos: v(0, 1.64, s.z + 0.5), look: v(0, 1.72, -H) },        // flinch back + up
      { t: tNotice,                    pos: v(0, 1.55, s.z - 0.1), look: hall.clone() },          // steady, staring at it
      // --- MOVE: walk to the light ---
      { t: tMove,                      pos: v(0, 1.5, -H + 0.8),  look: hall.clone() },           // through the doorway
      { t: tFade,                      pos: v(0, 1.5, hall.z + 2.5), look: hall.clone() },        // into the light
    ];
  }

  // Begin the cinematic; resolves once the white fade has taken over.
  play() {
    this.active = true;
    this._time = 0;
    this._fadeStarted = false;
    this._ignited = false;
    this.flash.style.opacity = '0';
    this.museum.setHallLit(false);            // dark hallway until the startle beat
    // Snap the black overlay opaque without animating (it sits hidden otherwise,
    // so it doesn't cover the title screen on boot)...
    this.wake.style.transition = 'none';
    this.wake.style.opacity = '1';
    void this.wake.offsetHeight;              // commit the opaque state
    this.wake.style.transition = '';          // ...then let CSS ease it away
    this._sample(0);
    requestAnimationFrame(() => { this.wake.style.opacity = '0'; });
    return new Promise((res) => { this._resolve = res; });
  }

  update(dt) {
    if (!this.active) return;
    this._time += dt;
    this._sample(Math.min(this._time, this._total));

    // The light suddenly appears the moment the player stops looking around.
    if (!this._ignited && this._time >= CUTSCENE.WAKE + CUTSCENE.LOOK) {
      this._ignited = true;
      this.museum.setHallLit(true);
    }

    // Kick the white fade once at the start of the final beat (CSS eases it).
    if (!this._fadeStarted && this._time >= this._total - CUTSCENE.FADE) {
      this._fadeStarted = true;
      this.flash.style.opacity = '1';
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

  // Skip to the white-fade beat so the wash still plays out, then resolves.
  skip() {
    if (this.active) this._time = Math.max(this._time, this._total - CUTSCENE.FADE);
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
