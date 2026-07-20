// ============================================================
// RESTORED PROVINCE — dry, cinematic-only Pangasinan ending diorama
// ============================================================
import * as THREE from 'three';
import { ENDING, clamp01 } from '../config.js';

const smooth = (f) => f * f * (3 - 2 * f);

export class RestoredProvince {
  constructor(subtitleRoot, subtitleEn, subtitleFil) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9ed8f2);
    this.scene.fog = new THREE.Fog(0xbfe4ef, 85, 165);
    this.camera = new THREE.PerspectiveCamera(56, innerWidth / innerHeight, 0.1, 240);
    this.subtitleRoot = subtitleRoot;
    this.subtitleEn = subtitleEn;
    this.subtitleFil = subtitleFil;
    this._geos = [];
    this._mats = [];
    this._people = [];
    this._birds = [];
    this._stringMats = [];
    this._stringTravelers = [];
    this._stringPoint = new THREE.Vector3();
    this._pos = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._time = 0;
    this.active = false;
    this._resolve = null;
    this._build();
  }

  _geo(g) { this._geos.push(g); return g; }
  _mat(opts) { const m = new THREE.MeshStandardMaterial(opts); this._mats.push(m); return m; }

  _build() {
    this.scene.add(new THREE.HemisphereLight(0xdff6ff, 0x6d8b4f, 1.65));
    const sun = new THREE.DirectionalLight(0xfff1c7, 2.2);
    sun.position.set(-30, 55, 25);
    this.scene.add(sun);

    this.grass = this._mat({ color: 0x6f9c55, roughness: 1 });
    this.road = this._mat({ color: 0xb89f78, roughness: 1 });
    this.wall = this._mat({ color: 0xf1ddbd, roughness: 0.9 });
    this.roof = this._mat({ color: 0xa74c36, roughness: 0.85 });
    this.wood = this._mat({ color: 0x74492c, roughness: 1 });
    this.green = this._mat({ color: 0x397a3c, roughness: 1 });
    this.gold = this._mat({ color: 0xf0b83f, roughness: 0.65 });
    this.white = this._mat({ color: 0xf6f0df, roughness: 0.85 });
    this.stone = this._mat({ color: 0xc5b99f, roughness: 1 });
    this.skyBlue = this._mat({ color: 0x4d8fc8, roughness: 0.75 });

    const ground = new THREE.Mesh(this._geo(new THREE.PlaneGeometry(140, 62)), this.grass);
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);
    const mainRoad = new THREE.Mesh(this._geo(new THREE.PlaneGeometry(126, 10)), this.road);
    mainRoad.rotation.x = -Math.PI / 2;
    mainRoad.position.y = 0.015;
    this.scene.add(mainRoad);

    this._foodDistrict(-38);
    this._festivalDistrict(0);
    this._landmarkDistrict(38);
    this._trees();
    this._buildStrings();
    this._buildBirds();
  }

  _box(w, h, d, mat, x, y, z, ry = 0) {
    const mesh = new THREE.Mesh(this._geo(new THREE.BoxGeometry(w, h, d)), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    this.scene.add(mesh);
    return mesh;
  }

  _house(x, z, colorMat = this.wall) {
    this._box(7, 4.2, 6, colorMat, x, 2.1, z);
    const roof = new THREE.Mesh(this._geo(new THREE.ConeGeometry(5.1, 2.2, 4)), this.roof);
    roof.position.set(x, 5.25, z);
    roof.rotation.y = Math.PI / 4;
    this.scene.add(roof);
    this._box(1.2, 2.1, 0.15, this.wood, x, 1.05, z + 3.08);
  }

  _stall(x, z, clothMat) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      this._box(0.12, 2.5, 0.12, this.wood, x + sx * 1.35, 1.25, z + sz * 0.9);
    }
    this._box(3.1, 0.15, 2.2, clothMat, x, 2.5, z);
    this._box(2.7, 0.65, 0.8, this.wood, x, 0.85, z + 0.25);
    for (let i = 0; i < 5; i++) {
      const produce = new THREE.Mesh(this._geo(new THREE.SphereGeometry(0.18, 8, 6)), this.gold);
      produce.position.set(x - 0.8 + i * 0.4, 1.28, z + 0.45);
      this.scene.add(produce);
    }
  }

  _foodDistrict(cx) {
    const teal = this._mat({ color: 0x4aa39a, roughness: 0.9 });
    this._house(cx - 10, -15);
    this._house(cx + 8, -14, this.white);
    for (const [x, z] of [[-9, -4], [-3, 4], [4, -4], [10, 4]]) this._stall(cx + x, z, teal);
    this._box(20, 0.12, 1.4, this.wood, cx, 0.16, 11);
    for (let i = 0; i < 6; i++) this._person(cx - 8 + i * 3, 8 + (i % 2) * 2, 0x356d7d, i * 0.7);
  }

  _festivalDistrict(cx) {
    const red = this._mat({ color: 0xd34a45, roughness: 0.75 });
    const yellow = this._mat({ color: 0xf4c94f, roughness: 0.75 });
    // Bandstand and restored parade avenue.
    const stage = new THREE.Mesh(this._geo(new THREE.CylinderGeometry(6, 6.5, 1, 16)), this.stone);
    stage.position.set(cx, 0.5, -7);
    this.scene.add(stage);
    const roof = new THREE.Mesh(this._geo(new THREE.ConeGeometry(7, 2.5, 12)), red);
    roof.position.set(cx, 5.7, -7);
    this.scene.add(roof);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this._box(0.22, 4.5, 0.22, this.white, cx + Math.cos(a) * 5.2, 2.75, -7 + Math.sin(a) * 5.2);
    }
    for (let i = -4; i <= 4; i++) {
      const mat = i % 2 ? red : yellow;
      this._box(0.08, 4, 0.08, this.wood, cx + i * 2.4, 2, 7);
      this._box(1.5, 0.8, 0.05, mat, cx + i * 2.4, 3.5, 7);
      this._person(cx + i * 2.2, 2 + Math.abs(i % 3), i % 2 ? 0xb8463c : 0xe5b938, i);
    }
  }

  _landmarkDistrict(cx) {
    // Church-like landmark, lighthouse, and civic hall silhouettes.
    this._box(15, 7, 11, this.white, cx, 3.5, -9);
    const roof = new THREE.Mesh(this._geo(new THREE.ConeGeometry(10, 4.5, 4)), this.roof);
    roof.position.set(cx, 8.9, -9);
    roof.rotation.y = Math.PI / 4;
    this.scene.add(roof);
    for (const sx of [-1, 1]) {
      this._box(3, 12, 3, this.stone, cx + sx * 6, 6, -7);
      const cap = new THREE.Mesh(this._geo(new THREE.ConeGeometry(2.2, 3, 4)), this.roof);
      cap.position.set(cx + sx * 6, 13.5, -7);
      cap.rotation.y = Math.PI / 4;
      this.scene.add(cap);
    }
    const tower = new THREE.Mesh(this._geo(new THREE.CylinderGeometry(1.6, 2.7, 13, 12)), this.white);
    tower.position.set(cx + 15, 6.5, 8);
    this.scene.add(tower);
    const beacon = new THREE.Mesh(this._geo(new THREE.CylinderGeometry(2.1, 2.1, 2.2, 12)), this.skyBlue);
    beacon.position.set(cx + 15, 13.8, 8);
    this.scene.add(beacon);
    for (let i = 0; i < 6; i++) this._person(cx - 10 + i * 3.4, 8 + (i % 2) * 2, 0xeee2c5, i + 10);
  }

  _person(x, z, color, phase) {
    const group = new THREE.Group();
    const cloth = this._mat({ color, roughness: 0.95 });
    const body = new THREE.Mesh(this._geo(new THREE.CylinderGeometry(0.25, 0.4, 1.25, 8)), cloth);
    body.position.y = 0.8;
    group.add(body);
    const head = new THREE.Mesh(this._geo(new THREE.SphereGeometry(0.24, 10, 8)), this.wood);
    head.position.y = 1.62;
    group.add(head);
    group.position.set(x, 0, z);
    this.scene.add(group);
    this._people.push({ group, baseY: 0, phase });
  }

  _trees() {
    for (let i = 0; i < 24; i++) {
      const x = -60 + i * 5.2;
      const z = i % 2 ? -24 : 24;
      this._box(0.45, 4.2, 0.45, this.wood, x, 2.1, z);
      const crown = new THREE.Mesh(this._geo(new THREE.SphereGeometry(2.1, 9, 7)), this.green);
      crown.position.set(x, 5.1, z);
      this.scene.add(crown);
    }
  }

  _buildStrings() {
    const beadGeo = this._geo(new THREE.SphereGeometry(0.16, 8, 6));
    const beadMats = [
      this._mat({ color: 0x000000, emissive: 0x76f4e7, emissiveIntensity: 4 }),
      this._mat({ color: 0x000000, emissive: 0xffd49a, emissiveIntensity: 4 }),
    ];
    for (let i = 0; i < 7; i++) {
      const z = -12 + i * 4;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-55, 2 + i * 0.2, z),
        new THREE.Vector3(-20, 7 + i * 0.25, z * 0.4),
        new THREE.Vector3(18, 5 + i * 0.18, -z * 0.25),
        new THREE.Vector3(55, 3 + i * 0.15, z * 0.7),
      ]);
      const geo = this._geo(new THREE.BufferGeometry().setFromPoints(curve.getPoints(90)));
      const mat = new THREE.LineBasicMaterial({
        color: i % 2 ? 0xffd49a : 0x76f4e7, transparent: true, opacity: 0.72,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      this._mats.push(mat);
      this._stringMats.push(mat);
      this.scene.add(new THREE.Line(geo, mat));
      const bead = new THREE.Mesh(beadGeo, beadMats[i % 2]);
      this.scene.add(bead);
      this._stringTravelers.push({ bead, curve, phase: i / 7 });
    }
  }

  _buildBirds() {
    const birdMat = this._mat({ color: 0x283b46, roughness: 1 });
    for (let i = 0; i < 8; i++) {
      const bird = new THREE.Mesh(this._geo(new THREE.ConeGeometry(0.13, 0.6, 3)), birdMat);
      bird.rotation.z = Math.PI / 2;
      this.scene.add(bird);
      this._birds.push({ mesh: bird, phase: i * 0.78, radius: 22 + i * 2 });
    }
  }

  play() {
    const T = ENDING.RESTORED_DURATION;
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    this._keys = [
      { t: 0, pos: v(-57, 8, 23), look: v(-38, 2, 0) },
      { t: 5, pos: v(-47, 5, 16), look: v(-36, 2.2, 0) },
      { t: 10.5, pos: v(-16, 8, 24), look: v(0, 3, -2) },
      { t: 16.5, pos: v(8, 5.5, 18), look: v(0, 3, -7) },
      { t: 22.5, pos: v(26, 9, 24), look: v(39, 5, -4) },
      { t: 27, pos: v(54, 11, 22), look: v(40, 5, -4) },
      { t: T, pos: v(0, 34, 62), look: v(0, 2.5, 0) },
    ];
    this._time = 0;
    this.active = true;
    this._sample(0);
    this._updateSubtitle();
    return new Promise((resolve) => { this._resolve = resolve; });
  }

  _sample(time) {
    let i = 0;
    while (i < this._keys.length - 1 && time > this._keys[i + 1].t) i++;
    const a = this._keys[i], b = this._keys[Math.min(i + 1, this._keys.length - 1)];
    const f = smooth(clamp01((time - a.t) / ((b.t - a.t) || 1)));
    this._pos.lerpVectors(a.pos, b.pos, f);
    this._look.lerpVectors(a.look, b.look, f);
    this.camera.position.copy(this._pos);
    this.camera.lookAt(this._look);
  }

  _updateSubtitle() {
    const cue = ENDING.SUBTITLES.find((s) => this._time >= s.start && this._time < s.end);
    if (!cue) {
      this.subtitleRoot.classList.remove('active');
      return;
    }
    if (this._cue !== cue) {
      this._cue = cue;
      this.subtitleEn.textContent = cue.en;
      this.subtitleFil.textContent = cue.fil;
    }
    this.subtitleRoot.classList.add('active');
  }

  update(dt) {
    if (!this.active) return;
    this._time += dt;
    this._sample(Math.min(this._time, ENDING.RESTORED_DURATION));
    this._updateSubtitle();
    for (const p of this._people) p.group.position.y = p.baseY + Math.sin(this._time * 2.2 + p.phase) * 0.035;
    for (const b of this._birds) {
      const a = this._time * 0.16 + b.phase;
      b.mesh.position.set(Math.cos(a) * b.radius, 13 + Math.sin(a * 2) * 2, Math.sin(a) * 17);
      b.mesh.rotation.y = -a;
    }
    const stringFade = 1 - smooth(clamp01((this._time - 23) / 5.5));
    this._stringMats.forEach((m, i) => { m.opacity = stringFade * (0.55 + Math.sin(this._time * 2 + i) * 0.15); });
    for (const traveler of this._stringTravelers) {
      traveler.curve.getPointAt((this._time * 0.055 + traveler.phase) % 1, this._stringPoint);
      traveler.bead.position.copy(this._stringPoint);
      traveler.bead.scale.setScalar(Math.max(0.001, stringFade));
    }
    if (this._time >= ENDING.RESTORED_DURATION) {
      this.active = false;
      this.subtitleRoot.classList.remove('active');
      const resolve = this._resolve;
      this._resolve = null;
      if (resolve) resolve();
    }
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    for (const geo of this._geos) geo.dispose();
    for (const mat of this._mats) mat.dispose();
    this._geos.length = 0;
    this._mats.length = 0;
  }
}
