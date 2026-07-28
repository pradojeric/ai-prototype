// ============================================================
// RESTORED PROVINCE — the ending's restored-zones montage
// ============================================================
// The final beat of the game: the three drowned zones shown restored — dry,
// whole, and alive with lantern light. Each zone is a self-contained diorama in
// its own THREE.Group (built by its _partials/ builder from the shared
// RestoredKit), and only ONE is ever visible at a time — they are never tiled
// onto a single shared plane. The camera runs one or two slow pans over each
// zone in turn (Zone 1 PONSIA → Zone 2 LIKET → Zone 3 PANANISIA), cutting
// between them through a brief black dip. There are no human figures; the
// returning life is carried by lanterns, banners, and drifting light beads, and
// the signature memory strings ("Hibla") thread each zone and fade at the close.
// Timing keys to ENDING.RESTORED_DURATION and the ENDING.SUBTITLES windows.
import * as THREE from 'three';
import { ENDING, clamp01 } from '../config.js';
import { RestoredKit } from './_partials/RestoredKit.js';
import { buildRestoredZone1 } from './_partials/restoredZone1.js';
import { buildRestoredZone2 } from './_partials/restoredZone2.js';
import { buildRestoredZone3 } from './_partials/restoredZone3.js';

const smooth = (f) => f * f * (3 - 2 * f);

export class RestoredProvince {
  constructor(subtitleRoot, subtitleEn, subtitleFil) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xbfe4ef);
    this.scene.fog = new THREE.Fog(0xbfe4ef, 85, 175);
    this.camera = new THREE.PerspectiveCamera(56, innerWidth / innerHeight, 0.1, 260);
    this.subtitleRoot = subtitleRoot;
    this.subtitleEn = subtitleEn;
    this.subtitleFil = subtitleFil;

    this._pos = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._time = 0;
    this.active = false;
    this._resolve = null;
    this._cue = null;

    this._build();
  }

  _build() {
    this.scene.add(new THREE.HemisphereLight(0xdff6ff, 0x6d8b4f, 1.65));
    const sun = new THREE.DirectionalLight(0xfff1c7, 2.2);
    sun.position.set(-30, 55, 25);
    this.scene.add(sun);

    this.kit = new RestoredKit();

    // Each zone lives in its own group; only one is shown at a time. They share
    // the same coordinate frame (avenue along Z) but never render together.
    const g1 = new THREE.Group();
    const g2 = new THREE.Group();
    const g3 = new THREE.Group();
    const k1 = buildRestoredZone1(this.kit, g1);
    const k2 = buildRestoredZone2(this.kit, g2);
    const k3 = buildRestoredZone3(this.kit, g3);
    for (const g of [g1, g2, g3]) this.scene.add(g);

    // Timeline windows (sum = ENDING.RESTORED_DURATION = 31), keyed to the
    // food / festival / landmark subtitle cues in config.
    this._zones = [
      { group: g1, keys: this._prepKeys(k1), start: 0, end: 11 },
      { group: g2, keys: this._prepKeys(k2), start: 11, end: 17.5 },
      { group: g3, keys: this._prepKeys(k3), start: 17.5, end: ENDING.RESTORED_DURATION },
    ];
    // Zone boundaries where the montage cuts (a brief black dip hides the swap).
    this._cuts = [this._zones[1].start, this._zones[2].start];

    // Full-screen fade quad, child of the camera (added to the scene so it
    // renders), used only for the short between-zone dips.
    this.camera.add(this._makeFadeQuad());
    this.scene.add(this.camera);
  }

  _prepKeys(keys) {
    return keys.map((k) => ({
      t: k.t,
      pos: new THREE.Vector3(k.pos[0], k.pos[1], k.pos[2]),
      look: new THREE.Vector3(k.look[0], k.look[1], k.look[2]),
    }));
  }

  _makeFadeQuad() {
    this._fadeMat = new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false,
    });
    this._fadeQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this._fadeMat);
    this._fadeQuad.position.z = -0.15;   // just past the near plane, overfills the view
    this._fadeQuad.renderOrder = 999;
    this._fadeQuad.frustumCulled = false;
    return this._fadeQuad;
  }

  play() {
    this._time = 0;
    this.active = true;
    this._cue = null;
    this._apply(0);
    this._updateSubtitle();
    return new Promise((resolve) => { this._resolve = resolve; });
  }

  update(dt) {
    if (!this.active) return;
    this._time += dt;
    this._apply(Math.min(this._time, ENDING.RESTORED_DURATION));
    this._updateSubtitle();
    if (this._time >= ENDING.RESTORED_DURATION) {
      this.active = false;
      this.subtitleRoot.classList.remove('active');
      const resolve = this._resolve;
      this._resolve = null;
      if (resolve) resolve();
    }
  }

  _apply(time) {
    // Active zone by time window; only it is visible.
    let zi = 0;
    while (zi < this._zones.length - 1 && time >= this._zones[zi + 1].start) zi++;
    const zone = this._zones[zi];
    this._zones.forEach((z, i) => { z.group.visible = (i === zi); });

    this._sampleCamera(zone, time - zone.start);
    this._fadeMat.opacity = this._cutOpacity(time);

    const stringFade = 1 - smooth(clamp01((time - 24) / 5.5));
    this.kit.animate(time, stringFade);
  }

  _sampleCamera(zone, local) {
    const k = zone.keys;
    let i = 0;
    while (i < k.length - 1 && local > k[i + 1].t) i++;
    const a = k[i], b = k[Math.min(i + 1, k.length - 1)];
    const f = smooth(clamp01((local - a.t) / ((b.t - a.t) || 1)));
    this._pos.lerpVectors(a.pos, b.pos, f);
    this._look.lerpVectors(a.look, b.look, f);
    this.camera.position.copy(this._pos);
    this.camera.lookAt(this._look);
  }

  // A short triangular black dip centered on each zone-cut so the visibility
  // swap and camera jump are never seen.
  _cutOpacity(time) {
    const half = 0.55;
    let o = 0;
    for (const ct of this._cuts) {
      const d = Math.abs(time - ct);
      if (d < half) o = Math.max(o, 1 - d / half);
    }
    return o;
  }

  _updateSubtitle() {
    const cue = ENDING.SUBTITLES.find((s) => this._time >= s.start && this._time < s.end);
    if (!cue) { this.subtitleRoot.classList.remove('active'); return; }
    if (this._cue !== cue) {
      this._cue = cue;
      this.subtitleEn.textContent = cue.en;
      this.subtitleFil.textContent = cue.fil;
    }
    this.subtitleRoot.classList.add('active');
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.kit.dispose();
    this._fadeQuad.geometry.dispose();
    this._fadeMat.dispose();
  }
}
