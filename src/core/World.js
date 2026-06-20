// ============================================================
// WORLD — submerged Pantal Market District (GDD §3/§13)
// Layout mirrors the reference district map ("The Flooded Memories"):
//   map-North → -Z (far)   map-South → +Z (near, player dock spawn)
//   Memories Alley (W) · Silent Auction Square (center-N) · Ruined Fish
//   Warehouse (center-right N) · Lost Boatyard (E) · Drowning Stalls (center) ·
//   Foggy Overlook (SE) · Player Dock (S). Open water lanes run between clusters.
// Owns the scene, terrain, every structure, floating debris, and the
// circle-vs-AABB collision registry.
// ============================================================
import * as THREE from 'three';
import { CONFIG, mulberry32 } from '../config.js';

const W = CONFIG.WATER_LEVEL;

export class World {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c2b2c);
    this.scene.fog = new THREE.FogExp2(0x123c3a, CONFIG.FOG_DENSITY);

    this.colliders = [];   // XZ footprints {minX,maxX,minZ,maxZ} for solid props
    this.debris = [];      // floating props that bob in update()
    this.moundSpots = [];  // rubble mound centers (elevated_rubble spawn anchors)
    this.spawnNodes = { near_wall: [], submerged_interior: [], elevated_rubble: [], open_water: [] };
    this.rng = mulberry32(20260618);

    this._materials();
    this._lights();
    this._floor();
    this._water();
    this._perimeter();        // bounding street edge (with gaps for lanes + dock)
    this._memoriesAlley();    // west: dense small buildings + alleys
    this._auctionSquare();    // center-north: open plaza + dais + columns
    this._fishWarehouse();    // center-right north: big ruined landmark
    this._boatyard();         // east: scattered boats + cradles + shed
    this._drowningStalls();   // center: diagonal market rows
    this._foggyOverlook();    // southeast: raised platform
    this._dock();             // south: player start dock
    this._mangroves();        // solid mangrove ring marking the level boundary
    this._rubble();
    this._debris();
    this._particles();
    this._spawnNodes();
  }

  // ---- Collision registry --------------------------------------------------
  addCollider(cx, cz, halfW, halfD) {
    this.colliders.push({ minX: cx - halfW, maxX: cx + halfW, minZ: cz - halfD, maxZ: cz + halfD });
  }

  // circle-vs-AABB: is a disc of radius r at (x,z) overlapping any footprint?
  collidesAt(x, z, r) {
    for (const c of this.colliders) {
      const px = Math.max(c.minX, Math.min(x, c.maxX));
      const pz = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - px, dz = z - pz;
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  }

  // Footprint half-extents of a box of (w,d) rotated about Y by rot.
  _footprint(w, d, rot) {
    const c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot));
    return [c * w + s * d, s * w + c * d];
  }

  // ---- Atmosphere ----------------------------------------------------------
  _materials() {
    this.mat = {
      wood:        new THREE.MeshStandardMaterial({ color: 0x3a2e22, roughness: .9 }),
      cloth:       new THREE.MeshStandardMaterial({ color: 0x53635a, roughness: 1, side: THREE.DoubleSide }),
      sign:        new THREE.MeshStandardMaterial({ color: 0xb9a06a, roughness: .9 }),
      ware:        new THREE.MeshStandardMaterial({ color: 0x8fae8a, roughness: .8 }),
      concrete:    new THREE.MeshStandardMaterial({ color: 0x33474a, roughness: 1 }),
      seabed:      new THREE.MeshStandardMaterial({ color: 0x16302d, roughness: 1 }),
      building:    new THREE.MeshStandardMaterial({ color: 0x2a3f3c, roughness: 1 }),
      buildingAlt: new THREE.MeshStandardMaterial({ color: 0x314845, roughness: 1 }),
      window:      new THREE.MeshStandardMaterial({ color: 0x0a1518, roughness: 1 }),
      rubble:      new THREE.MeshStandardMaterial({ color: 0x2b3a34, roughness: 1 }),
      metal:       new THREE.MeshStandardMaterial({ color: 0x4a3826, roughness: .9 }),
      rust:        new THREE.MeshStandardMaterial({ color: 0x5a3a2a, roughness: 1 }),
      plank:       new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: .95 }),
      bark:        new THREE.MeshStandardMaterial({ color: 0x2c2418, roughness: 1 }),
      foliage:     new THREE.MeshStandardMaterial({ color: 0x2f4a39, roughness: 1, flatShading: true }),
    };
  }

  _lights() {
    // Warm amber key from above, cool teal ambient (golden hour through water)
    const amber = new THREE.DirectionalLight(0xffd9a0, 1.15);
    amber.position.set(8, 22, -6);
    this.scene.add(amber);
    this.scene.add(new THREE.HemisphereLight(0x9fe6df, 0x07201f, 0.72));
    this.scene.add(new THREE.AmbientLight(0x2a5a58, 0.46));
  }

  _floor() {
    // Gently undulating seabed (summed sines) instead of a flat plane.
    const geo = new THREE.PlaneGeometry(220, 220, 80, 80);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      const h = Math.sin(x * 0.06) * 0.2 + Math.cos(y * 0.05 + 1.3) * 0.16 + Math.sin((x + y) * 0.12) * 0.09;
      p.setZ(i, h);
    }
    geo.computeVertexNormals();
    const floor = new THREE.Mesh(geo, this.mat.seabed);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.3;
    this.scene.add(floor);
  }

  _water() {
    // Lightweight translucent surface with sine vertex ripple.
    const geo = new THREE.PlaneGeometry(240, 240, 80, 80);
    this.waterMat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x3fa39a) } },
      vertexShader: `
        uniform float uTime;
        varying float vRipple;
        void main() {
          vec3 p = position;
          float r = sin(p.x * 0.25 + uTime) * 0.06 + cos(p.y * 0.2 + uTime * 0.8) * 0.05;
          p.z += r;
          vRipple = r;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vRipple;
        void main() {
          float caustic = 0.5 + vRipple * 3.0;
          vec3 c = uColor * (0.7 + caustic * 0.3);
          gl_FragColor = vec4(c, 0.62);
        }`,
    });
    this.water = new THREE.Mesh(geo, this.waterMat);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = W;
    this.scene.add(this.water);
  }

  // Generic flooded building shell with dark inset windows on its +z face.
  // Returns the group; registers a collider unless solid:false.
  _building(x, z, w, d, h, rot = 0, opts = {}) {
    const { windows = true, solid = true } = opts;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      this.rng() > 0.5 ? this.mat.building : this.mat.buildingAlt);
    body.position.y = h / 2;
    g.add(body);
    if (windows) {
      const cols = Math.max(1, Math.floor(w / 2.2));
      const rows = Math.max(1, Math.floor(h / 2.4));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (this.rng() < 0.28) continue;
          const win = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.12), this.mat.window);
          win.position.set(-w / 2 + 1.2 + c * (w / cols), 1.5 + r * 2.4, d / 2 + 0.02);
          g.add(win);
        }
      }
    }
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    this.scene.add(g);
    if (solid) {
      const [hw, hd] = this._footprint(w / 2, d / 2, rot);
      this.addCollider(x, z, hw, hd);
    }
    return g;
  }

  // ---- Perimeter: bounding street edge (gaps left for lanes + the S dock) --
  _perimeter() {
    const R = 45;
    const h = () => 6 + this.rng() * 4;
    // north edge (behind the warehouse / square)
    for (const x of [-34, -18, 2, 18, 34]) this._building(x, -R, 13, 7, h(), 0);
    // west edge (behind Memories Alley)
    for (const z of [-12, 8, 28]) this._building(-R, z, 13, 7, h(), Math.PI / 2);
    // east edge (behind the boatyard)
    for (const z of [-22, -2, 22]) this._building(R, z, 13, 7, h(), -Math.PI / 2);
    // south corners only — leave the center open for the dock
    this._building(-38, R, 13, 7, h(), Math.PI);
    this._building(38, R, 13, 7, h(), Math.PI);
  }

  // ---- Memories Alley: dense small buildings split by narrow alleys (W) ----
  _memoriesAlley() {
    // Three north-south rows of buildings; gaps between rows read as alleys.
    const rows = [-40, -31, -22];
    const zs = [-36, -27, -18, -9, 0];
    for (const bx of rows) {
      for (const bz of zs) {
        if (this.rng() < 0.22) continue;               // missing house → pocket
        const w = 4.5 + this.rng() * 2.5;
        const d = 4.5 + this.rng() * 2.5;
        const bh = 4.5 + this.rng() * 4.5;
        this._building(bx + (this.rng() - 0.5), bz + (this.rng() - 0.5) * 1.5, w, d, bh);
      }
    }
  }

  // ---- The Silent Auction Square: open plaza, dais, ring of short columns --
  _auctionSquare() {
    const cx = -2, cz = -29;
    // low stone dais (walkable, breaks the surface)
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, 0.5, 16), this.mat.concrete);
    dais.position.set(cx, W - 0.1, cz);
    this.scene.add(dais);
    // ring of short broken columns around it (solid)
    const ringN = 8;
    for (let i = 0; i < ringN; i++) {
      const a = (i / ringN) * Math.PI * 2;
      const px = cx + Math.cos(a) * 6, pz = cz + Math.sin(a) * 6;
      const ph = 2 + this.rng() * 1.8;                  // uneven, ruined heights
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, ph, 8), this.mat.concrete);
      col.position.set(px, ph / 2, pz);
      this.scene.add(col);
      this.addCollider(px, pz, 0.35, 0.35);
    }
    // auctioneer's frame + hanging anchor (the map's anchor icon for this square)
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 0.2), this.mat.metal);
    post.position.set(cx + 3.6, 2, cz); this.scene.add(post);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 2.4), this.mat.metal);
    arm.position.set(cx + 3.6, 3.8, cz - 1); this.scene.add(arm);
    const anchor = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.12, 8, 16), this.mat.rust);
    anchor.position.set(cx + 3.6, 2.6, cz - 2); anchor.rotation.x = Math.PI / 2;
    this.scene.add(anchor);
    this.addCollider(cx + 3.6, cz, 0.3, 0.3);
  }

  // ---- The Ruined Fish Warehouse: large open shell landmark (center-right) -
  _fishWarehouse() {
    const cx = 23, cz = -34, hw = 9, hd = 7, wh = 8;   // half-extents + wall height
    const wallMat = this.mat.rust;
    const wall = (x, z, w, d, h) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
      m.position.set(x, h / 2, z); this.scene.add(m);
      this.addCollider(x, z, w / 2, d / 2);
    };
    wall(cx - hw, cz, 0.6, hd * 2, wh);                 // left wall
    wall(cx + hw, cz, 0.6, hd * 2, wh);                 // right wall
    wall(cx, cz - hd, hw * 2, 0.6, wh);                 // back wall
    // front wall: two stubs leaving a 4m entrance facing the player (+z)
    wall(cx - 5.5, cz + hd, 7, 0.6, wh);
    wall(cx + 5.5, cz + hd, 7, 0.6, wh);
    // broken roof beams across the top (decor, non-colliding)
    for (let i = -1; i <= 1; i++) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, 0.3, 0.4), this.mat.metal);
      beam.position.set(cx, wh + 0.2 + this.rng() * 0.4, cz + i * 4.5);
      beam.rotation.z = (this.rng() - 0.5) * 0.25;       // sagging / fallen-in
      this.scene.add(beam);
    }
    // fallen crates inside (decor, kept off the open interior center)
    for (const [ox, oz] of [[-6, -4], [6, 3], [-5, 4]]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.8), this.mat.wood);
      c.position.set(cx + ox, W + 0.3, cz + oz); c.rotation.y = this.rng();
      this.scene.add(c);
    }
  }

  // ---- The Lost Boatyard: scattered bangkâs, A-frame cradles, a shed (E) ---
  _boatyard() {
    const shed = this._building(40, 12, 7, 6, 4.5, -Math.PI / 2.4, { windows: false });
    shed; // (placement only)
    const boats = [[34, -2, 0.3], [38, 4, -0.6], [33, 10, 1.4], [40, 16, 0.1]];
    for (const [x, z, rot] of boats) {
      const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 3.2, 4, 8), this.mat.metal);
      hull.rotation.z = Math.PI / 2;
      hull.rotation.y = rot;
      hull.scale.set(1, 1, 0.55);
      hull.position.set(x, W, z);
      this.scene.add(hull);
      const [fw, fd] = this._footprint(2.0, 0.7, rot);
      this.addCollider(x, z, fw, fd);
    }
    // A-frame dry-dock cradles
    for (const [x, z] of [[30, 6], [36, -6]]) {
      const g = new THREE.Group();
      for (const s of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3, 0.18), this.mat.wood);
        leg.position.set(s * 0.7, 1.5, 0); leg.rotation.z = -s * 0.4; g.add(leg);
      }
      g.position.set(x, 0, z); this.scene.add(g);
      this.addCollider(x, z, 1.0, 0.4);
    }
  }

  // ---- The Drowning Stalls: diagonal market rows (center) ------------------
  _stall(x, z, rot, opts = {}) {
    const { scale = 1, broken = false, tilt = 0 } = opts;
    const g = new THREE.Group();
    const postGeo = new THREE.BoxGeometry(0.14, 2.4, 0.14);
    const legs = [[-1.1, -0.8], [1.1, -0.8], [-1.1, 0.8], [1.1, 0.8]];
    legs.forEach(([px, pz], idx) => {
      if (broken && idx === 3) return;                 // a missing leg
      const post = new THREE.Mesh(postGeo, this.mat.wood);
      post.position.set(px, 1.2, pz);
      g.add(post);
    });
    if (!broken) {
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 2.0), this.mat.cloth);
      canopy.position.y = 2.4; g.add(canopy);
    }
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.5, 0.8), this.mat.wood);
    counter.position.set(0, 0.9, -0.5); g.add(counter);
    for (let i = 0; i < 4; i++) {
      const ware = new THREE.Mesh(new THREE.SphereGeometry(0.12 + this.rng() * 0.08, 8, 6), this.mat.ware);
      ware.position.set(-0.9 + i * 0.6, W + 0.05 + this.rng() * 0.1, -0.4);
      g.add(ware);
    }
    if (!broken) {
      const sign = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.04), this.mat.sign);
      sign.position.set(0, 1.8, 0.95); g.add(sign);
    }
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    g.rotation.z = tilt;
    g.scale.setScalar(scale);
    this.scene.add(g);
    const [hw, hd] = this._footprint(1.3 * scale, 1.0 * scale, rot);
    this.addCollider(x, z, hw, hd);
  }

  _drowningStalls() {
    // Two facing rows running on a NW→SE diagonal across the market center,
    // leaving a walkable aisle down the middle (the map's "Drowning Stalls").
    const steps = 6;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const cx = -12 + t * 26;             // -12 → 14
      const cz = 16 - t * 22;              //  16 → -6
      const broken = this.rng() < 0.3;
      const tilt = (this.rng() - 0.5) * 0.16;
      // left row faces +X (toward aisle), right row faces -X
      this._stall(cx - 3, cz - 1.2, Math.PI / 2, { broken, tilt });
      this._stall(cx + 3, cz + 1.2, -Math.PI / 2, { scale: 0.95 + this.rng() * 0.2 });
    }
  }

  // ---- The Foggy Overlook: raised platform breaking the waterline (SE) -----
  _foggyOverlook() {
    const cx = 33, cz = 30;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(8, 1.6, 8), this.mat.concrete);
    slab.position.set(cx, W + 0.1, cz);
    this.scene.add(slab);
    this.addCollider(cx, cz, 4, 4);
    // corner railing posts
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.2, 0.16), this.mat.metal);
      post.position.set(cx + sx * 3.4, W + 1.4, cz + sz * 3.4);
      this.scene.add(post);
    }
    this.moundSpots.push([cx, cz]);        // doubles as an elevated_rubble anchor
  }

  // ---- Player Dock: RAISED platform you stand on, with a two-way ladder ----
  // The deck is dry (above the water) and walkable via height-following rather
  // than a collider. Railings wall off three sides so the only way down is the
  // north-center ladder, whose strip ramps the player between deck top and the
  // water (see groundHeightAt). Footprint constants are mirrored there.
  _dock() {
    const cx = 0, cz = 34, top = CONFIG.DOCK_TOP;
    this.dock = { cx, cz, halfX: 3.5, zBack: 38, zFront: 30, top,
                  ladHalfX: 1.2, ladTop: 30, ladBot: 27 };

    // deck slab (top surface at `top`)
    const deck = new THREE.Mesh(new THREE.BoxGeometry(7, 0.3, 8), this.mat.plank);
    deck.position.set(cx, top - 0.15, cz);
    this.scene.add(deck);                  // walkable: no XZ collider

    // support pilings down to the seabed
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, top + 0.3, 6), this.mat.wood);
      pile.position.set(cx + sx * 3, (top + 0.3) / 2 - 0.3, cz + sz * 3.5);
      this.scene.add(pile);
    }

    // railings on the back + sides; north side left open (center) for the ladder
    const railPost = (x, z) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.0, 0.12), this.mat.wood);
      p.position.set(x, top + 0.5, z); this.scene.add(p);
    };
    const railBar = (x, z, w, d) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), this.mat.wood);
      b.position.set(x, top + 0.95, z); this.scene.add(b);
    };
    // south (back) rail
    railBar(cx, cz + 3.6, 7, 0.1); railPost(cx - 3.4, cz + 3.6); railPost(cx + 3.4, cz + 3.6);
    this.addCollider(cx, cz + 3.6, 3.5, 0.15);
    // east + west rails
    railBar(cx - 3.4, cz, 0.1, 8); railBar(cx + 3.4, cz, 0.1, 8);
    railPost(cx - 3.4, cz - 3.6); railPost(cx + 3.4, cz - 3.6);
    this.addCollider(cx - 3.4, cz, 0.15, 4); this.addCollider(cx + 3.4, cz, 0.15, 4);
    // north rails flanking the ladder gap (|x| 1.2 .. 3.5)
    railBar(cx - 2.35, cz - 4, 2.3, 0.1); railBar(cx + 2.35, cz - 4, 2.3, 0.1);
    this.addCollider(cx - 2.35, cz - 4, 1.15, 0.15);
    this.addCollider(cx + 2.35, cz - 4, 1.15, 0.15);

    // the ladder: two rails + rungs descending from the deck front into the water
    const lcx = cx, top2 = top, bot = W - 0.2;
    for (const sx of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 3.6), this.mat.wood);
      rail.position.set(lcx + sx * 0.9, (top2 + bot) / 2, 28.5);
      rail.rotation.x = Math.atan2(top2 - bot, 3) - Math.PI / 2;
      this.scene.add(rail);
    }
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      const rung = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.07, 0.07), this.mat.wood);
      rung.position.set(lcx, top2 - t * (top2 - bot), 30 - t * 3);
      this.scene.add(rung);
    }

    const anchor = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.13, 8, 16), this.mat.rust);
    anchor.position.set(cx + 2.6, top + 0.2, cz + 3);
    anchor.rotation.set(Math.PI / 2, 0, 0.4);
    this.scene.add(anchor);
  }

  // Support height under (x,z): deck top over the platform, a ramp down the
  // ladder strip, else 0 (water-standing baseline). Consumed by PlayerController
  // so the camera rests on the platform and climbs the ladder both ways.
  groundHeightAt(x, z) {
    const d = this.dock;
    if (!d) return 0;
    if (Math.abs(x - d.cx) <= d.halfX && z >= d.zFront && z <= d.zBack) return d.top;
    if (Math.abs(x - d.cx) <= d.ladHalfX && z > d.ladBot && z < d.ladTop) {
      return d.top * ((z - d.ladBot) / (d.ladTop - d.ladBot));   // ramp top→0
    }
    return 0;
  }

  // ---- Mangroves: solid boundary ring marking the edge of the level --------
  // A stylized mangrove: a tapered trunk, arching stilt roots splaying to the
  // waterline, and a few sparse dark canopy clumps. Each registers a collider.
  _mangrove(x, z) {
    const g = new THREE.Group();
    const h = 4 + this.rng() * 3;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.32, h, 6), this.mat.bark);
    trunk.position.y = h / 2;
    g.add(trunk);
    // arching stilt roots fanned around the base
    const roots = 4 + Math.floor(this.rng() * 2);
    for (let i = 0; i < roots; i++) {
      const a = (i / roots) * Math.PI * 2 + this.rng() * 0.4;
      const root = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.11, 1.7, 5), this.mat.bark);
      root.position.set(Math.cos(a) * 0.55, 0.55, Math.sin(a) * 0.55);
      root.rotation.z = Math.cos(a) * 0.7;
      root.rotation.x = -Math.sin(a) * 0.7;
      g.add(root);
    }
    // sparse canopy clumps near the crown
    const clumps = 2 + Math.floor(this.rng() * 2);
    for (let i = 0; i < clumps; i++) {
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0 + this.rng() * 0.6, 0), this.mat.foliage);
      leaf.position.set((this.rng() - 0.5) * 1.5, h + (this.rng() - 0.5) * 0.8, (this.rng() - 0.5) * 1.5);
      leaf.scale.y = 0.7;
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    g.rotation.y = this.rng() * Math.PI * 2;
    this.scene.add(g);
    this.addCollider(x, z, 1.5, 1.5);   // dense footprints → a solid wall
  }

  _mangroves() {
    const E = 47;          // ring radius (just inside the ZONE_HALF=48 clamp)
    const step = 3.6;      // close spacing so footprints overlap into a wall
    for (let v = -E; v <= E; v += step) {
      const j = () => (this.rng() - 0.5) * 1.1;
      this._mangrove(v + j(), -E + j());   // north edge
      this._mangrove(v + j(),  E + j());   // south edge
      this._mangrove(-E + j(), v + j());   // west edge
      this._mangrove( E + j(), v + j());   // east edge
    }
  }

  // ---- Terrain props: rubble mounds (decor) + elevated slabs (solid) -------
  _rubble() {
    const spots = [[-30, 20], [16, -20], [-8, 8], [26, -28]];
    for (const [mx, mz] of spots) {
      this.moundSpots.push([mx, mz]);
      const n = 4 + Math.floor(this.rng() * 3);
      for (let i = 0; i < n; i++) {
        const s = 0.4 + this.rng() * 0.7;
        const box = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), this.mat.rubble);
        box.position.set(
          mx + (this.rng() - 0.5) * 2.5,
          W - 0.3 + s / 2 + this.rng() * 0.2,
          mz + (this.rng() - 0.5) * 2.5,
        );
        box.rotation.set(this.rng(), this.rng(), this.rng());
        this.scene.add(box);  // low + non-colliding so artifacts on them stay reachable
      }
    }
  }

  // ---- Floating debris (bobs in update; large pieces are solid) ------------
  _debris() {
    for (let i = 0; i < 30; i++) {
      // Keep debris off the dock + spawn: resample until clear of (0, 36).
      let x, z;
      do {
        x = (this.rng() - 0.5) * 80;
        z = (this.rng() - 0.5) * 80;
      } while (x * x + (z - 36) * (z - 36) < 49);   // 7 m clear radius
      const kind = Math.floor(this.rng() * 5);
      let mesh, big = false;
      if (kind === 0)      { mesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.5), this.mat.wood); big = true; }      // crate
      else if (kind === 1) { mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.4, 8, 1, true), this.mat.sign); } // basket
      else if (kind === 2) { mesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.18), this.mat.wood); big = true; }     // plank
      else if (kind === 3) { mesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), this.mat.ware); }                   // fruit
      else                 { mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), this.mat.cloth); mesh.rotation.x = -Math.PI / 2; } // net
      mesh.position.set(x, W + 0.06, z);
      this.scene.add(mesh);
      this.debris.push({
        mesh, baseY: mesh.position.y, phase: this.rng() * Math.PI * 2,
        spin: (this.rng() - 0.5) * 0.3, amp: 0.04 + this.rng() * 0.05,
      });
      // Solid only if it won't trap the player's spawn point (0, 36).
      const dsx = x, dsz = z - 36;
      if (big && dsx * dsx + dsz * dsz > 9) this.addCollider(x, z, 0.5, 0.5);
    }
  }

  _particles() {
    const N = 1600;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 90;
      pos[i * 3 + 1] = Math.random() * 6;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 90;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xbfe9e2, size: 0.05, transparent: true, opacity: 0.5,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.particles = new THREE.Points(geo, mat);
    this.scene.add(this.particles);
  }

  // Spawn nodes anchored to the new districts (consumed by ArtifactManager).
  _spawnNodes() {
    this.spawnNodes.near_wall = [
      [-30, -10], [-22, 2],          // Memories Alley building faces
      [23, -26], [-2, -23],          // warehouse front, auction square edge
      [40, 8],                       // boatyard shed
    ];
    this.spawnNodes.submerged_interior = [
      [23, -34], [20, -32], [26, -36],   // inside the Fish Warehouse shell
      [-2, -29],                          // on the auction dais
    ];
    this.spawnNodes.elevated_rubble = this.moundSpots.slice();   // overlook + mounds
    this.spawnNodes.open_water = [
      [-15, 6], [8, 4], [4, 22], [-18, -22],   // lanes between clusters
    ];
  }

  update(dt, t) {
    this.waterMat.uniforms.uTime.value = t;
    // gentle sediment drift
    this.particles.rotation.y = t * 0.01;
    const p = this.particles.geometry.attributes.position;
    for (let i = 1; i < p.array.length; i += 3) {
      p.array[i] += dt * 0.08;
      if (p.array[i] > 6) p.array[i] = 0;
    }
    p.needsUpdate = true;
    // floating debris bob + slow spin
    for (const d of this.debris) {
      d.mesh.position.y = d.baseY + Math.sin(t * 0.8 + d.phase) * d.amp;
      d.mesh.rotation.y += d.spin * dt;
    }
  }
}
