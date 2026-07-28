// ============================================================
// RESTORED KIT — shared materials, mesh primitives, and animation registries
// for the three restored-zone dioramas of the ending (RestoredProvince).
// ============================================================
// Each restored zone is built into its own THREE.Group with these primitives so
// the three zones stay self-contained (never tiled on one shared plane) and only
// one is shown at a time. The kit tracks every geometry/material for disposal and
// owns the animated registries (lanterns, drifting light "motes", and the glowing
// memory-string "Hibla" travelers) so the driver can animate them in one call.
import * as THREE from 'three';

export class RestoredKit {
  constructor() {
    this.geos = [];
    this.mats = [];
    this.lanterns = [];          // glowing lamps → gentle flicker + sway
    this._motes = [];            // free-floating light beads → rise + fade (array, not the motes() builder)
    this.stringMats = [];        // Hibla line materials → fade with the finale
    this.stringTravelers = [];   // beads riding the Hibla curves
    this._stringPoint = new THREE.Vector3();
    this.group = null;           // current build target (set per zone)
    this._buildMaterials();
    this.lanternGeo = this.geo(new THREE.SphereGeometry(0.2, 10, 8));
    this.moteGeo = this.geo(new THREE.SphereGeometry(0.1, 6, 5));
    this.beadGeo = this.geo(new THREE.SphereGeometry(0.16, 8, 6));
    this._texLoader = new THREE.TextureLoader();
    this._textures = [];
    this._loadTextures();   // CC0 PBR maps → assigns to materials + sets per-material tile size
  }

  // Load the committed CC0 (ambientCG) texture sets and bind them to materials.
  // Each material gets a `userData.tile` (world units per texture repeat); the
  // geometry helpers bake that into UVs so texel density is consistent across
  // surfaces of very different sizes. Textures pop in asynchronously.
  _loadTextures() {
    const base = 'assets/textures/';
    const load = (name) => {
      const color = this._texLoader.load(base + name + '/color.jpg');
      color.colorSpace = THREE.SRGBColorSpace;
      const normal = this._texLoader.load(base + name + '/normal.jpg');
      const rough = this._texLoader.load(base + name + '/roughness.jpg');
      for (const t of [color, normal, rough]) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = 4;
        this._textures.push(t);
      }
      return { color, normal, rough };
    };
    const apply = (mat, tex, tile) => {
      mat.map = tex.color;
      mat.normalMap = tex.normal;
      mat.roughnessMap = tex.rough;
      mat.color.set(0xffffff);   // let the albedo map show true
      mat.roughness = 1;         // driven by the roughness map
      mat.userData.tile = tile;
      mat.needsUpdate = true;
    };
    const T = {
      brick: load('brick'), plaster: load('plaster'), paving: load('paving'),
      grass: load('grass'), roof: load('roof'), wood: load('wood'), rock: load('rock'),
    };
    apply(this.grass, T.grass, 6);
    apply(this.street, T.paving, 4);
    apply(this.stone, T.paving, 4);
    apply(this.brick, T.brick, 3);
    apply(this.wall, T.plaster, 4);
    apply(this.wallAlt, T.plaster, 4);
    apply(this.capitolStone, T.plaster, 4.5);
    apply(this.lightWhite, T.plaster, 4);
    apply(this.limestone, T.plaster, 4.5);
    apply(this.roof, T.roof, 2.5);
    apply(this.wood, T.wood, 2);
    apply(this.isletRock, T.rock, 5);
  }

  // --- UV tiling: bake world-size-proportional repeats into a geometry's UVs so
  // a shared texture keeps consistent texel density on any surface size. ---
  _tileBox(geo, w, h, d, mat) {
    const t = mat && mat.userData && mat.userData.tile;
    if (!t) return;
    const uv = geo.attributes.uv;
    const spans = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];   // BoxGeometry face order
    for (let f = 0; f < 6; f++) {
      const us = spans[f][0], vs = spans[f][1];
      for (let k = 0; k < 4; k++) {
        const i = f * 4 + k;
        uv.setXY(i, uv.getX(i) * us / t, uv.getY(i) * vs / t);
      }
    }
    uv.needsUpdate = true;
  }

  _tilePlane(geo, w, h, mat) {
    const t = mat && mat.userData && mat.userData.tile;
    if (!t) return;
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / t, uv.getY(i) * h / t);
    uv.needsUpdate = true;
  }

  _tileCyl(geo, rt, rb, h, mat) {
    const t = mat && mat.userData && mat.userData.tile;
    if (!t) return;
    const circ = Math.PI * (rt + rb), uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circ / t, uv.getY(i) * h / t);
    uv.needsUpdate = true;
  }

  _tileUniform(geo, mat, size) {
    const t = mat && mat.userData && mat.userData.tile;
    if (!t) return;
    const r = size / t, uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * r, uv.getY(i) * r);
    uv.needsUpdate = true;
  }

  geo(g) { this.geos.push(g); return g; }
  mat(o) { const m = new THREE.MeshStandardMaterial(o); this.mats.push(m); return m; }
  setGroup(g) { this.group = g; return g; }

  _buildMaterials() {
    this.grass = this.mat({ color: 0x6f9c55, roughness: 1 });
    this.street = this.mat({ color: 0xb0a184, roughness: 1 });
    this.stone = this.mat({ color: 0xc5b99f, roughness: 1 });
    this.wall = this.mat({ color: 0xf1ddbd, roughness: 0.9 });
    this.wallAlt = this.mat({ color: 0xe7cfa6, roughness: 0.9 });
    this.roof = this.mat({ color: 0xa74c36, roughness: 0.85 });
    this.wood = this.mat({ color: 0x74492c, roughness: 1 });
    this.shutter = this.mat({ color: 0x3a2a1c, roughness: 1 });
    this.gold = this.mat({ color: 0xf0b83f, roughness: 0.6 });
    this.white = this.mat({ color: 0xf6f0df, roughness: 0.85 });
    this.red = this.mat({ color: 0xc4453a, roughness: 0.8 });
    this.skyBlue = this.mat({ color: 0x4d8fc8, roughness: 0.75 });
    this.metal = this.mat({ color: 0x9098a0, roughness: 0.5, metalness: 0.3 });
    this.teal = this.mat({ color: 0x4aa39a, roughness: 0.9 });
    this.festYellow = this.mat({ color: 0xf4c94f, roughness: 0.75 });
    this.festGreen = this.mat({ color: 0x3f8f7a, roughness: 0.8 });
    this.festBlue = this.mat({ color: 0x3f6fae, roughness: 0.8 });
    this.limestone = this.mat({ color: 0xd8cdb4, roughness: 0.95 });
    this.green = this.mat({ color: 0x397a3c, roughness: 1, flatShading: true });
    // Landmark-fidelity palette (real Pangasinan references).
    this.brick = this.mat({ color: 0xa8674a, roughness: 0.95 });          // St. John Cathedral brick
    this.capitolStone = this.mat({ color: 0xe8e2d2, roughness: 0.9 });    // neoclassical Capitol / Manaoag
    this.verdigris = this.mat({ color: 0x6fae9b, roughness: 0.6, metalness: 0.2 }); // copper domes
    this.lightWhite = this.mat({ color: 0xf3eee0, roughness: 0.85 });     // Bolinao lighthouse white
    this.bamboo = this.mat({ color: 0x9bad5a, roughness: 0.9 });          // festival arches / fish pens
    this.bangus = this.mat({ color: 0xc9d4dd, roughness: 0.4, metalness: 0.35 }); // milkfish silver
    this.isletRock = this.mat({ color: 0x9a9a82, roughness: 1 });         // Hundred Islands limestone
    this.water = this.mat({ color: 0x3e7f8c, roughness: 0.35, metalness: 0.1 });
  }

  // --- low-level (geometry UVs are tiled by world size for textured mats) ---
  box(w, h, d, mat, x, y, z, ry = 0) {
    const g = this.geo(new THREE.BoxGeometry(w, h, d));
    this._tileBox(g, w, h, d, mat);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    this.group.add(m);
    return m;
  }

  cyl(rt, rb, h, seg, mat, x, y, z, ry = 0) {
    const g = this.geo(new THREE.CylinderGeometry(rt, rb, h, seg));
    this._tileCyl(g, rt, rb, h, mat);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    this.group.add(m);
    return m;
  }

  cone(r, h, seg, mat, x, y, z, ry = 0) {
    const g = this.geo(new THREE.ConeGeometry(r, h, seg));
    this._tileUniform(g, mat, r * 2);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    this.group.add(m);
    return m;
  }

  sphere(r, mat, x, y, z, wSeg = 12, hSeg = 8) {
    const g = this.geo(new THREE.SphereGeometry(r, wSeg, hSeg));
    this._tileUniform(g, mat, r * 2);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z);
    this.group.add(m);
    return m;
  }

  // Hemispherical dome (Capitol / basilica cupola).
  dome(r, mat, x, y, z) {
    const g = this.geo(new THREE.SphereGeometry(r, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2));
    this._tileUniform(g, mat, r * 2);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z);
    this.group.add(m);
    return m;
  }

  // Triangular pediment / gable face (neoclassical portico, cathedral facade).
  // A triangle in XY (base at y=0, apex up at y=h) extruded along +Z by depth.
  pediment(w, h, depth, mat, x, y, z, ry = 0) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(0, h);
    s.lineTo(-w / 2, 0);
    const m = new THREE.Mesh(this.geo(new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false })), mat);
    m.position.set(x, y, z - depth / 2);
    m.rotation.y = ry;
    this.group.add(m);
    return m;
  }

  // A row of columns (neoclassical portico / colonnade).
  columnRow(x0, z0, x1, z1, count, height, r, mat) {
    for (let i = 0; i < count; i++) {
      const f = count > 1 ? i / (count - 1) : 0.5;
      const x = x0 + (x1 - x0) * f, z = z0 + (z1 - z0) * f;
      this.cyl(r, r, height, 10, mat, x, height / 2, z);
      this.box(r * 2.6, 0.3, r * 2.6, mat, x, height + 0.15, z);   // capital
      this.box(r * 2.8, 0.3, r * 2.8, mat, x, 0.15, z);           // base
    }
  }

  add(mesh, x, y, z) { mesh.position.set(x, y, z); this.group.add(mesh); return mesh; }

  // --- ground & shared civic pieces ---
  ground(streetLen = 84, streetW = 11, floorMat = this.grass) {
    const gg = this.geo(new THREE.PlaneGeometry(320, 320));
    this._tilePlane(gg, 320, 320, floorMat);
    const g = new THREE.Mesh(gg, floorMat);
    g.rotation.x = -Math.PI / 2;
    this.group.add(g);
    const rg = this.geo(new THREE.PlaneGeometry(streetW, streetLen));
    this._tilePlane(rg, streetW, streetLen, this.street);
    const road = new THREE.Mesh(rg, this.street);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.02, -2);
    this.group.add(road);
  }

  dock(cz = 34) {
    this.box(10, 0.4, 6, this.wood, 0, 0.6, cz);
    for (const sx of [-1, 1]) for (const dz of [-2, 0, 2]) {
      this.box(0.3, 1.2, 0.3, this.wood, sx * 4, 0.3, cz + dz);
    }
  }

  dais(cx, cz, r = 4, mat = this.stone) {
    const d = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(r, r + 0.4, 0.5, 16)), mat);
    d.position.set(cx, 0.25, cz);
    this.group.add(d);
    return d;
  }

  // A whole tapered tower (Zone 1's bell-mast / Zone 3's campanile), optional bell.
  tower(x, z, { height = 16, baseR = 1.6, mat = this.stone, bell = false } = {}) {
    const seg = 4, hSeg = height / seg;
    for (let i = 0; i < seg; i++) {
      const r = baseR * (1 - i * 0.11);
      const m = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(r * 0.88, r, hSeg, 10)), mat);
      m.position.set(x, hSeg / 2 + i * hSeg, z);
      this.group.add(m);
    }
    // belfry cornice + conical roof cap
    this.box(baseR * 2.2, 0.4, baseR * 2.2, this.white, x, height + 0.2, z);
    const cap = new THREE.Mesh(this.geo(new THREE.ConeGeometry(baseR * 1.05, height * 0.2, 8)), this.roof);
    cap.position.set(x, height + height * 0.1 + 0.4, z);
    this.group.add(cap);
    if (bell) {
      const b = new THREE.Mesh(
        this.geo(new THREE.SphereGeometry(baseR * 0.45, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2)), this.gold);
      b.rotation.x = Math.PI;
      b.position.set(x, height - 1.4, z);
      this.group.add(b);
    }
  }

  // Whole gateway arch (posts + half-torus lintel). ry rotates the span axis.
  arch(x, z, ry, { span = 6, height = 5 } = {}) {
    const half = span / 2, t = 0.5;
    for (const s of [-1, 1]) {
      this.box(t, height, t, this.stone, x + Math.cos(ry) * s * half, height / 2, z - Math.sin(ry) * s * half);
    }
    const top = new THREE.Mesh(this.geo(new THREE.TorusGeometry(half, t * 0.6, 8, 16, Math.PI)), this.stone);
    top.position.set(x, height, z);
    top.rotation.y = ry;
    this.group.add(top);
  }

  // Whole cathedral column with a square capital.
  pillar(x, z, height, r = 0.9, mat = this.limestone) {
    const shaft = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(r * 0.9, r, height, 12)), mat);
    shaft.position.set(x, height / 2, z);
    this.group.add(shaft);
    this.box(r * 2.4, 0.4, r * 2.4, mat, x, height + 0.2, z);
  }

  // Half-torus vault rib bridging the nave at height y (spans x = ±radius).
  vaultRib(z, { radius = 6, tube = 0.42, y = 10 } = {}) {
    const rib = new THREE.Mesh(this.geo(new THREE.TorusGeometry(radius, tube, 8, 16, Math.PI)), this.limestone);
    rib.position.set(0, y, z);
    this.group.add(rib);
  }

  // Intact nipa house.
  house(x, z, colorMat = this.wall) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.box(0.3, 0.9, 0.3, this.wood, x + sx * 2.5, 0.45, z + sz * 2);
    this.box(6.2, 0.3, 5.2, this.wood, x, 0.95, z);
    this.box(5.6, 3, 4.6, colorMat, x, 2.55, z);
    const roof = new THREE.Mesh(this.geo(new THREE.ConeGeometry(5, 2.2, 4)), this.roof);
    roof.position.set(x, 5.1, z);
    roof.rotation.y = Math.PI / 4;
    this.group.add(roof);
    this.box(1, 1.8, 0.12, this.shutter, x, 1.6, z + 2.35);   // door
  }

  // Intact market/festival stall with an awning, counter and produce.
  stall(x, z, ry, clothMat) {
    const g = new THREE.Group();
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.12, 2.4, 0.12)), this.wood);
      post.position.set(sx * 1.3, 1.2, sz * 0.85);
      g.add(post);
    }
    const awn = new THREE.Mesh(this.geo(new THREE.BoxGeometry(3.0, 0.14, 2.0)), clothMat);
    awn.position.set(0, 2.4, 0); g.add(awn);
    const val = new THREE.Mesh(this.geo(new THREE.BoxGeometry(3.0, 0.4, 0.1)), clothMat);
    val.position.set(0, 2.2, 1.0); g.add(val);
    const counter = new THREE.Mesh(this.geo(new THREE.BoxGeometry(2.6, 0.6, 0.7)), this.wood);
    counter.position.set(0, 0.6, 0.2); g.add(counter);
    for (let i = 0; i < 5; i++) {
      const pr = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.17, 8, 6)), i % 2 ? this.red : this.gold);
      pr.position.set(-0.8 + i * 0.4, 1.05, 0.35); g.add(pr);
    }
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    this.group.add(g);
    return g;
  }

  // Intact walled warehouse / hall shell (Zone 1 warehouse, Zone 2 ballroom).
  hall(cx, cz, wallMat = this.wallAlt, wh = 6) {
    this.box(0.5, wh, 14, wallMat, cx + 8, wh / 2, cz);          // east
    this.box(16, wh, 0.5, wallMat, cx, wh / 2, cz - 7);          // north
    this.box(16, wh, 0.5, wallMat, cx, wh / 2, cz + 7);          // south
    this.box(0.5, wh, 5, wallMat, cx - 8, wh / 2, cz - 4.5);     // west stub
    this.box(0.5, wh, 5, wallMat, cx - 8, wh / 2, cz + 4.5);     // west stub (4m entrance between)
    const roof = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(4.4, 4.4, 16.4, 3, 1)), this.roof);
    roof.rotation.z = Math.PI / 2;
    roof.position.set(cx, wh + 0.4, cz);
    this.group.add(roof);
  }

  boat(x, z, rot, mat) {
    const hull = new THREE.Mesh(this.geo(new THREE.CapsuleGeometry(0.5, 3.2, 4, 8)), mat);
    hull.rotation.z = Math.PI / 2;
    hull.rotation.y = rot;
    hull.scale.set(1, 1, 0.55);
    hull.position.set(x, 0.6, z);
    this.group.add(hull);
  }

  // The parul mast (Zone 2 terminus): a tall pole crowned by a glowing star
  // lantern, with lantern strings radiating to the ground like the parol's rays.
  parulMast(cx, cz, { height = 14, starR = 1.7 } = {}) {
    this.box(0.4, height, 0.4, this.wood, cx, height / 2, cz);
    const starMat = this.mat({ color: 0x2a1c0e, emissive: 0xffd47a, emissiveIntensity: 3.4, roughness: 0.5 });
    const star = new THREE.Mesh(this.geo(new THREE.OctahedronGeometry(starR)), starMat);
    const baseY = height + starR * 0.6;
    star.position.set(cx, baseY, cz);
    this.group.add(star);
    this.lanterns.push({ mesh: star, mat: starMat, phase: 0, baseY, baseI: 3.4 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      this.lanternString(cx, cz, cx + Math.cos(a) * 8, cz + Math.sin(a) * 8, height - 0.5, 4, i % 2 ? 0xffd49a : 0x76f4e7, 1.2);
    }
  }

  // Ring of standing gong drums (Zone 2 Gong Circle).
  gongCircle(cx, cz, r = 6) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2, px = cx + Math.cos(a) * r, pz = cz + Math.sin(a) * r;
      this.box(0.12, 1.9, 0.12, this.wood, px, 0.95, pz);
      const disc = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 16)), this.gold);
      disc.position.set(px, 1.7, pz);
      disc.rotation.x = Math.PI / 2;
      this.group.add(disc);
    }
  }

  // --- returning-life light (replaces the old human figures) ---
  lantern(x, y, z, color = 0xffb457, intensity = 2.4) {
    const mat = this.mat({ color: 0x2a1c0e, emissive: color, emissiveIntensity: intensity, roughness: 0.6 });
    const lamp = new THREE.Mesh(this.lanternGeo, mat);
    lamp.position.set(x, y, z);
    this.group.add(lamp);
    this.lanterns.push({ mesh: lamp, mat, phase: (x + z) * 0.5, baseY: y, baseI: intensity });
    return lamp;
  }

  lanternCluster(x, z, { count = 5, y = 3, radius = 0.9, color = 0xffd49a, withPost = false, postHeight = 6 } = {}) {
    if (withPost) this.box(0.16, postHeight, 0.16, this.wood, x, postHeight / 2, z);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      this.lantern(x + Math.cos(a) * radius, y + Math.sin(i) * 0.2, z + Math.sin(a) * radius, color, 2.2);
    }
  }

  lanternString(x1, z1, x2, z2, topY, count, color = 0xffce7a, sag = 1) {
    const pts = [];
    for (let i = 0; i <= count; i++) {
      const f = i / count;
      pts.push(new THREE.Vector3(x1 + (x2 - x1) * f, topY - Math.sin(f * Math.PI) * sag, z1 + (z2 - z1) * f));
    }
    const cordMat = new THREE.LineBasicMaterial({ color: 0x3a2a1c, transparent: true, opacity: 0.8 });
    this.mats.push(cordMat);
    this.group.add(new THREE.Line(this.geo(new THREE.BufferGeometry().setFromPoints(pts)), cordMat));
    for (let i = 1; i < count; i++) this.lantern(pts[i].x, pts[i].y - 0.32, pts[i].z, color, 2.0);
  }

  bunting(x1, z1, x2, z2, y, pennants, mats, sag = 0.6) {
    const pts = [];
    for (let i = 0; i <= pennants; i++) {
      const f = i / pennants;
      pts.push(new THREE.Vector3(x1 + (x2 - x1) * f, y - Math.sin(f * Math.PI) * sag, z1 + (z2 - z1) * f));
    }
    const cordMat = new THREE.LineBasicMaterial({ color: 0x6a4a2a });
    this.mats.push(cordMat);
    this.group.add(new THREE.Line(this.geo(new THREE.BufferGeometry().setFromPoints(pts)), cordMat));
    for (let i = 0; i < pennants; i++) {
      const pen = new THREE.Mesh(this.geo(new THREE.ConeGeometry(0.18, 0.42, 4)), mats[i % mats.length]);
      pen.position.set((pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2 - 0.22, (pts[i].z + pts[i + 1].z) / 2);
      pen.rotation.x = Math.PI;
      this.group.add(pen);
    }
  }

  // The signature glowing memory strings ("Hibla") threaded through a zone.
  // specs: [{ pts:[[x,y,z]...], color, phase }]
  hibla(specs) {
    specs.forEach((spec, i) => {
      const curve = new THREE.CatmullRomCurve3(spec.pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
      const geo = this.geo(new THREE.BufferGeometry().setFromPoints(curve.getPoints(80)));
      const color = spec.color ?? 0x76f4e7;
      const mat = new THREE.LineBasicMaterial({
        color, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      this.mats.push(mat);
      this.stringMats.push(mat);
      this.group.add(new THREE.Line(geo, mat));
      const beadMat = this.mat({ color: 0x000000, emissive: color, emissiveIntensity: 4 });
      const bead = new THREE.Mesh(this.beadGeo, beadMat);
      this.group.add(bead);
      this.stringTravelers.push({ bead, curve, phase: spec.phase ?? (i / specs.length) });
    });
  }

  motes(cx, cz, count) {
    for (let i = 0; i < count; i++) {
      const color = i % 2 ? 0x76f4e7 : 0xffd49a;
      const mat = this.mat({ color: 0x000000, emissive: color, emissiveIntensity: 3 });
      const mote = new THREE.Mesh(this.moteGeo, mat);
      const baseX = cx + (((i * 53) % 40) - 20) * 0.6;
      const baseZ = cz + (((i * 29) % 50) - 25) * 0.6;
      const baseY = 1 + ((i * 17) % 5) * 0.4;
      mote.position.set(baseX, baseY, baseZ);
      this.group.add(mote);
      this._motes.push({ mesh: mote, baseX, baseY, baseZ, phase: i * 0.7, speed: 0.06 + (i % 4) * 0.01 });
    }
  }

  // Driver calls this every frame; stringFade (1→0) drives the finale fade-out.
  animate(time, stringFade) {
    for (const l of this.lanterns) {
      l.mat.emissiveIntensity = l.baseI * (0.8 + Math.sin(time * 2.6 + l.phase) * 0.2);
      l.mesh.position.y = l.baseY + Math.sin(time * 1.2 + l.phase) * 0.05;
    }
    for (const m of this._motes) {
      const rise = ((time * m.speed + m.phase) % 1);
      m.mesh.position.set(
        m.baseX + Math.sin(time * 0.5 + m.phase) * 0.7,
        m.baseY + rise * 4.5,
        m.baseZ + Math.cos(time * 0.4 + m.phase) * 0.5,
      );
      m.mesh.scale.setScalar(Math.max(0.001, Math.sin(rise * Math.PI)));
    }
    this.stringMats.forEach((mm, i) => { mm.opacity = stringFade * (0.5 + Math.sin(time * 2 + i) * 0.15); });
    for (const tr of this.stringTravelers) {
      tr.curve.getPointAt((time * 0.05 + tr.phase) % 1, this._stringPoint);
      tr.bead.position.copy(this._stringPoint);
      tr.bead.scale.setScalar(Math.max(0.001, stringFade));
    }
  }

  dispose() {
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
    for (const t of this._textures) t.dispose();
    this.geos.length = 0;
    this.mats.length = 0;
    this._textures.length = 0;
  }
}
