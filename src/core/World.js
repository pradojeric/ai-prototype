// ============================================================
// WORLD — reusable submerged-zone engine (GDD §3/§13)
// Owns the scene, atmosphere (lights/fog/water/floor/particles), the
// circle-vs-AABB collision registry, support-height (dock/ladder), and a set of
// reusable building PRIMITIVES (buildings, stalls, mangroves, the spawn dock,
// floating debris). It is intentionally zone-agnostic: the actual district
// layout, palette overrides, fog, seed, and spawn nodes come from a *zone
// definition* (see src/core/zones/) whose `build(world)` runs against this
// engine. Add a zone by writing one zone module + registering it — no changes
// here. Create instances via `createWorld(zoneId)` from src/core/zones/index.js.
// ============================================================
import * as THREE from 'three';
import { CONFIG, mulberry32 } from '../config.js';

const W = CONFIG.WATER_LEVEL;

export class World {
  // `zone` is a zone definition: { id, name, seed, background, fog:{color,density},
  // palette, build(world) }. The build hook constructs the districts in a fixed
  // order (it drives the seeded RNG, so order is layout-significant).
  constructor(zone) {
    this.zone = zone;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(zone.background);
    this.scene.fog = new THREE.FogExp2(zone.fog.color, zone.fog.density);

    this.colliders = [];   // XZ footprints {minX,maxX,minZ,maxZ} for solid props
    this.debris = [];      // floating props that bob in update()
    this.shafts = [];      // additive god-ray cones that shimmer in update()
    this.moundSpots = [];  // rubble mound centers (elevated_rubble spawn anchors)
    this.spawnNodes = { near_wall: [], submerged_interior: [], elevated_rubble: [], open_water: [] };
    this.rng = mulberry32(zone.seed);

    this._materials(zone.palette);
    this._lights();
    this._floor();
    this._water();
    // Zone content: districts, dock, mangrove boundary, rubble, debris, spawn
    // nodes. RNG-driven, so the zone is responsible for a stable call order.
    zone.build(this);
    this._particles();     // uses Math.random (not the seeded rng) — order-safe
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
  // Base flooded-market palette. A zone may shallow-merge overrides via its
  // `palette` def to recolour any entry without forking the engine.
  _materials(palette = {}) {
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
    // Apply per-zone colour overrides (key → hex) onto the base materials.
    for (const [key, color] of Object.entries(palette)) {
      if (this.mat[key]) this.mat[key].color.set(color);
    }
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

  // ---- Reusable building primitives ----------------------------------------
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

  // A market stall: posts, optional canopy + sign, a counter and loose wares.
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

  // ---- Player Dock: RAISED platform you stand on, with a two-way ladder ----
  // The deck is dry (above the water) and walkable via height-following rather
  // than a collider. Railings wall off three sides so the only way down is the
  // north-center ladder, whose strip ramps the player between deck top and the
  // water (see groundHeightAt). Sets `this.dock`, consumed by groundHeightAt.
  _dock(opts = {}) {
    const { cx = 0, cz = 34, top = CONFIG.DOCK_TOP } = opts;
    this.dock = { cx, cz, halfX: 3.5, zBack: cz + 4, zFront: cz - 4, top,
                  ladHalfX: 1.2, ladTop: cz - 4, ladBot: cz - 7 };

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
      rail.position.set(lcx + sx * 0.9, (top2 + bot) / 2, cz - 5.5);
      rail.rotation.x = Math.atan2(top2 - bot, 3) - Math.PI / 2;
      this.scene.add(rail);
    }
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      const rung = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.07, 0.07), this.mat.wood);
      rung.position.set(lcx, top2 - t * (top2 - bot), (cz - 4) - t * 3);
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

  // ---- Mangroves: solid boundary marking the edge of the level -------------
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

  // Square ring of mangroves walling off the level edge. Close spacing makes
  // the overlapping footprints read as one solid boundary.
  _mangroveRing(opts = {}) {
    const { radius = 47, step = 3.6 } = opts;
    const E = radius;
    for (let v = -E; v <= E; v += step) {
      const j = () => (this.rng() - 0.5) * 1.1;
      this._mangrove(v + j(), -E + j());   // north edge
      this._mangrove(v + j(),  E + j());   // south edge
      this._mangrove(-E + j(), v + j());   // west edge
      this._mangrove( E + j(), v + j());   // east edge
    }
  }

  // ---- Vertical landmark: a tall, tapering ruined tower --------------------
  // Reads through the fog from across the zone, giving the player a fixed point
  // to navigate by (legibility). Built from stacked, slightly offset cylinder
  // drums with a broken crown; only the base footprint is solid.
  _tower(x, z, opts = {}) {
    const { height = 16, baseR = 1.8, mat = this.mat.concrete } = opts;
    const g = new THREE.Group();
    const drums = Math.max(3, Math.round(height / 3));
    let y = 0;
    for (let i = 0; i < drums; i++) {
      const t0 = i / drums, t1 = (i + 1) / drums;
      const r0 = baseR * (1 - t0 * 0.55);
      const r1 = baseR * (1 - t1 * 0.55);
      const dh = height / drums;
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, dh, 8), mat);
      // jitter each drum so the stack looks weathered / settled
      drum.position.set((this.rng() - 0.5) * 0.25, y + dh / 2, (this.rng() - 0.5) * 0.25);
      drum.rotation.y = this.rng() * Math.PI;
      g.add(drum);
      y += dh;
    }
    // broken crown: a few leaning shards at the top
    const shards = 3 + Math.floor(this.rng() * 3);
    const topR = baseR * 0.45;
    for (let i = 0; i < shards; i++) {
      const a = (i / shards) * Math.PI * 2 + this.rng();
      const sh = 0.8 + this.rng() * 1.4;
      const shard = new THREE.Mesh(new THREE.BoxGeometry(0.3, sh, 0.3), mat);
      shard.position.set(Math.cos(a) * topR, y + sh / 2 - 0.2, Math.sin(a) * topR);
      shard.rotation.z = (this.rng() - 0.5) * 0.5;
      g.add(shard);
    }
    g.position.set(x, 0, z);
    this.scene.add(g);
    this.addCollider(x, z, baseR, baseR);
    return g;
  }

  // ---- Threshold: a broken stone gateway marking a district entrance --------
  // Two leaning piers carry a sagging lintel; the walk-through center is open.
  // `rot` aligns the opening across a path. Piers are solid, lintel is decor.
  _ruinArch(x, z, rot = 0, opts = {}) {
    const { span = 5, height = 4.5, mat = this.mat.concrete } = opts;
    const g = new THREE.Group();
    const pierW = 0.9, half = span / 2;
    for (const s of [-1, 1]) {
      const ph = height * (0.85 + this.rng() * 0.25);
      const pier = new THREE.Mesh(new THREE.BoxGeometry(pierW, ph, pierW), mat);
      pier.position.set(s * half, ph / 2, 0);
      pier.rotation.z = -s * (0.04 + this.rng() * 0.06);   // lean inward, ruined
      g.add(pier);
    }
    // sagging lintel across the top (decor, non-colliding so it never blocks)
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(span + pierW, 0.7, pierW * 1.1), mat);
    lintel.position.set(0, height + 0.1, 0);
    lintel.rotation.z = (this.rng() - 0.5) * 0.08;
    g.add(lintel);
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    this.scene.add(g);
    // colliders for the two piers only (rotated footprint), opening stays clear
    const ox = Math.cos(rot) * half, oz = -Math.sin(rot) * half;
    const [hw, hd] = this._footprint(pierW / 2, pierW / 2, rot);
    this.addCollider(x + ox, z + oz, hw, hd);
    this.addCollider(x - ox, z - oz, hw, hd);
    return g;
  }

  // ---- Atmosphere: a volumetric god-ray cone descending through the water ---
  // Additive, non-colliding; framed over landmarks to add depth through fog and
  // draw the eye. Registered in `this.shafts` so update() can shimmer opacity.
  _lightShaft(x, z, opts = {}) {
    const { topR = 3.2, botR = 0.6, height = CONFIG.WATER_LEVEL + 14, color = 0xbfe9e2, opacity = 0.07 } = opts;
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(botR, topR, height, 12, 1, true), mat);
    cone.position.set(x, height / 2, z);   // wide end at the surface, narrow below
    cone.frustumCulled = false;
    this.scene.add(cone);
    this.shafts.push({ mat, base: opacity, phase: this.rng() * Math.PI * 2 });
    return cone;
  }

  // ---- Floating debris (bobs in update; large pieces are solid) ------------
  // `clear` is a {x,z,r} keep-out disc (the spawn dock) so nothing traps the
  // player; `count` controls density.
  _debris(opts = {}) {
    const { count = 30, clear = { x: 0, z: 36, r: 7 } } = opts;
    const clr2 = clear.r * clear.r;
    for (let i = 0; i < count; i++) {
      // Keep debris off the dock + spawn: resample until clear.
      let x, z;
      do {
        x = (this.rng() - 0.5) * 80;
        z = (this.rng() - 0.5) * 80;
      } while ((x - clear.x) * (x - clear.x) + (z - clear.z) * (z - clear.z) < clr2);
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
      // Solid only if it won't trap the player's spawn point.
      const dsx = x - clear.x, dsz = z - clear.z;
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

  // Tear down the whole zone scene so a zone-swap doesn't leak GPU resources.
  // Disposes every geometry/material under the scene (water shader included) and
  // drops the references the update loop walks. The player rig is re-parented by
  // Game before this runs, so it isn't disposed here.
  dispose() {
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const m = o.material;
      if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
      else if (m) m.dispose();
    });
    this.debris.length = 0;
    this.shafts.length = 0;
    this.colliders.length = 0;
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
    // god-ray shafts breathe gently in intensity
    for (const s of this.shafts) {
      s.mat.opacity = s.base * (0.7 + Math.sin(t * 0.5 + s.phase) * 0.3);
    }
    // floating debris bob + slow spin
    for (const d of this.debris) {
      d.mesh.position.y = d.baseY + Math.sin(t * 0.8 + d.phase) * d.amp;
      d.mesh.rotation.y += d.spin * dt;
    }
  }
}
