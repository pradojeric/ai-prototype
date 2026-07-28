// ============================================================
// WORLD — reusable submerged-zone engine (GDD §3/§13)
// Owns the scene, atmosphere (lights/fog/water/floor/particles), the
// circle-vs-box collision registry, authored support heights, and a set of
// reusable building PRIMITIVES (buildings, stalls, mangroves, the spawn dock,
// floating debris). It is intentionally zone-agnostic: the actual district
// layout, palette overrides, fog, seed, and spawn nodes come from a *zone
// definition* (see src/core/zones/) whose `build(world)` runs against this
// engine. Add a zone by writing one zone module + registering it — no changes
// here. Create instances via `createWorld(zoneId)` from src/core/zones/index.js.
// ============================================================
import * as THREE from 'three';
import { CONFIG, mulberry32 } from '../config.js';
import {
  applyTextureSet, tileBoxUVs, tilePlaneUVs, tileCylinderUVs, tileUniformUVs,
} from './_partials/TextureKit.js';
import {
  sagLine, lantern, lanternString, lanternCluster, bunting, parulMast,
} from './_partials/FestivalDressing.js';
import { buildZoneLighting } from './_partials/ZoneLighting.js';

const W = CONFIG.WATER_LEVEL;
const SUPPORT_SNAP = 1.25;

export class World {
  // `zone` is a zone definition: { id, name, seed, background, fog:{color,density},
  // palette, waterColor?, build(world) }. The build hook constructs the districts in
  // a fixed order (it drives the seeded RNG, so order is layout-significant).
  // `waterColor` is optional — see _water() for how the surface derives the rest of
  // its look from the zone's fog.
  constructor(zone) {
    this.zone = zone;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(zone.background);
    this.scene.fog = new THREE.FogExp2(zone.fog.color, zone.fog.density);

    this.colliders = [];   // XZ footprints, optionally limited to one vertical tier
    this.supportSurfaces = []; // authored ramps/landings sampled by groundHeightAt()
    this.debris = [];      // floating props that bob in update() (also lantern bodies/glows)
    this.shafts = [];      // additive god-ray cones that shimmer in update() (also lantern glow flicker)
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
  addCollider(cx, cz, halfW, halfD, options = {}) {
    const rotation = options.rotation ?? 0;
    const collider = {
      cx,
      cz,
      halfW,
      halfD,
      minX: cx - halfW,
      maxX: cx + halfW,
      minZ: cz - halfD,
      maxZ: cz + halfD,
      rotation,
      cos: Math.cos(rotation),
      sin: Math.sin(rotation),
      minY: options.minY ?? -Infinity,
      maxY: options.maxY ?? Infinity,
      enabled: options.enabled ?? true,
    };
    this.colliders.push(collider);
    return collider;
  }

  // Circle-vs-box: supports both legacy axis-aligned and authored rotated bounds.
  collidesAt(x, z, r, y = null) {
    for (const c of this.colliders) {
      if (!c.enabled) continue;
      if (Number.isFinite(y) && (y < c.minY || y > c.maxY)) continue;
      let dx, dz;
      if (c.rotation) {
        const offsetX = x - c.cx, offsetZ = z - c.cz;
        const localX = offsetX * c.cos - offsetZ * c.sin;
        const localZ = offsetX * c.sin + offsetZ * c.cos;
        const px = Math.max(-c.halfW, Math.min(localX, c.halfW));
        const pz = Math.max(-c.halfD, Math.min(localZ, c.halfD));
        dx = localX - px;
        dz = localZ - pz;
      } else {
        const px = Math.max(c.minX, Math.min(x, c.maxX));
        const pz = Math.max(c.minZ, Math.min(z, c.maxZ));
        dx = x - px;
        dz = z - pz;
      }
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  }

  // Register a rectangular walkable plane in local coordinates. Height changes
  // linearly along local +Z, which covers both flat landings and straight ramps.
  // The player's current support height disambiguates vertically stacked floors.
  addSupportSurface(cx, cz, halfW, halfD, rotation, startHeight, endHeight = startHeight) {
    const surface = {
      cx, cz, halfW, halfD,
      cos: Math.cos(rotation),
      sin: Math.sin(rotation),
      startHeight,
      endHeight,
    };
    this.supportSurfaces.push(surface);
    return surface;
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

    // Bind the committed CC0 PBR sets on top of the (now tinted) materials. Runs
    // AFTER the palette merge because applyTextureSet deliberately preserves
    // `.color` — the zone tint stays the mood driver and the albedo map only adds
    // surface detail. `tile` is world-units-per-repeat; the primitives bake it
    // into their UVs via the tile*UVs helpers.
    const textured = [
      ['building',    'plaster', 4],
      ['buildingAlt', 'plaster', 4],
      ['concrete',    'paving',  4],
      ['wood',        'wood',    2],
      ['plank',       'wood',    2],
      ['rubble',      'rock',    3],
      ['seabed',      'silt',    8],
      ['rust',        'rust',    2.5],
      ['metal',       'rust',    2.5],
      ['foliage',     'moss',    2],
      ['bark',        'wood',    1.5],
    ];
    for (const [key, set, tile] of textured) applyTextureSet(this.mat[key], set, tile);
  }

  // Moonlight key + fill + hemisphere + ambient, plus the gradient environment
  // the PBR normal/roughness maps need in order to read at all. The rig itself
  // lives in _partials/ZoneLighting.js; a zone may reshape it via its `light`
  // block. Runs after _materials() because it writes envMapIntensity onto them.
  _lights() {
    const cfg = buildZoneLighting(this, this.zone.light);
    // Kept for _water(): the surface sheen has to come from the same direction
    // and be the same colour as the key, or it reads as a second light source.
    this.moonDir = new THREE.Vector3(...cfg.moonDir).normalize();
    this.moonColor = new THREE.Color(cfg.moonColor);
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
    tilePlaneUVs(geo, 220, 220, this.mat.seabed);   // silt repeats across the seabed
    const floor = new THREE.Mesh(geo, this.mat.seabed);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.3;
    this.scene.add(floor);
  }

  _water() {
    // Lightweight translucent surface. The fine ripple detail is computed
    // ANALYTICALLY rather than from a normal map: two scrolling sine fields give a
    // per-pixel surface normal that drives a fresnel rim and a soft sun sheen. That
    // is deliberately cheaper than sampling a water normal texture (no extra GPU
    // upload, no extra texture fetch per pixel) — this surface covers most of the
    // screen in every zone, so it is the one place the low-end budget is tightest.
    const geo = new THREE.PlaneGeometry(240, 240, 80, 80);
    this.waterMat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        // Body colour seen looking straight down. A zone may override it via
        // `waterColor` in its definition — zone 3's drowned-limestone palette wants
        // colder water than zone 1's warm market teal.
        uColor: { value: new THREE.Color(this.zone.waterColor ?? 0x3fa39a) },
        // The colour the surface REFLECTS at grazing angles. Feeding it the zone's
        // own fog colour is what makes this read as water rather than a tinted
        // plane: the far surface dissolves into the same fog as the ruins, so there
        // is no hard horizon line, and each zone gets its own water for free (zone 3
        // reflects near-black, matching its "edges fall into darkness" intent).
        uHorizon: { value: new THREE.Color(this.zone.fog.color) },
        // Matches the moon key set up in _lights() so the sheen agrees with the
        // scene — direction AND colour, since a warm sheen under a cool key
        // would read as a second, contradictory light source.
        uSunDir: { value: this.moonDir.clone() },
        uSunColor: { value: this.moonColor.clone() },
      },
      vertexShader: `
        uniform float uTime;
        varying float vRipple;
        varying vec2 vSurf;
        varying vec3 vWorld;
        void main() {
          vec3 p = position;
          // Slow, long swell. Deliberately ~2x slower than a "nice water" default:
          // a fast chop reads as a cheerful sea, and this is standing floodwater.
          float t = uTime * 0.45;
          float r = sin(p.x * 0.25 + t) * 0.06 + cos(p.y * 0.20 + t * 0.8) * 0.05;
          p.z += r;
          vRipple = r;
          vSurf = p.xy;                                  // plane-local = world XZ
          vWorld = (modelMatrix * vec4(p, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 uColor;
        uniform vec3 uHorizon;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform float uTime;
        varying float vRipple;
        varying vec2 vSurf;
        varying vec3 vWorld;

        // Analytic derivatives of the same wave sum the vertex stage displaces by,
        // plus finer octaves the 3m vertex grid is far too coarse to carry. All
        // sines, no normal map — this surface covers most of the screen, so it is
        // where the low-end budget is tightest.
        vec3 rippleNormal(vec2 p, float t) {
          float dx = 0.25 * cos(p.x * 0.25 + t) * 0.06
                   + 0.90 * cos(p.x * 0.90 - t * 1.7) * 0.014
                   + 1.70 * cos((p.x + p.y) * 1.70 + t * 2.3) * 0.008
                   + 3.10 * cos((p.x * 0.8 - p.y) * 3.10 - t * 3.1) * 0.0035;
          float dy = -0.20 * sin(p.y * 0.20 + t * 0.8) * 0.05
                   + 0.80 * cos(p.y * 0.80 + t * 1.3) * 0.012
                   + 1.70 * cos((p.x + p.y) * 1.70 + t * 2.3) * 0.008
                   - 3.10 * cos((p.x * 0.8 - p.y) * 3.10 - t * 3.1) * 0.0035;
          return normalize(vec3(-dx, 1.0, -dy));
        }

        // A slow drifting surface film — the dust, ash and scum that collects on
        // water nothing has disturbed in a long time. Low contrast on purpose: it
        // should register as "this water is still", not as a visible pattern.
        float surfaceFilm(vec2 p, float t) {
          float a = sin(p.x * 0.075 + sin(p.y * 0.041 + t * 0.05) * 2.0 + t * 0.031);
          float b = sin(p.y * 0.052 - sin(p.x * 0.033 - t * 0.04) * 1.7 - t * 0.024);
          return smoothstep(0.25, 1.0, a * b);
        }

        void main() {
          float t = uTime * 0.45;
          vec3 n = rippleNormal(vSurf, t);
          vec3 viewDir = normalize(cameraPosition - vWorld);
          float fresnel = pow(1.0 - clamp(dot(n, viewDir), 0.0, 1.0), 3.0);

          // Looking DOWN: murky body colour, darker than before so the flood reads
          // as deep and silted rather than like a lit swimming pool.
          float caustic = 0.5 + vRipple * 3.0;
          vec3 deep = uColor * (0.46 + caustic * 0.26);

          // Looking ALONG the surface: the fog it reflects. This mix, not a
          // brightness ramp, is what sells it as a reflective liquid.
          vec3 c = mix(deep, uHorizon * 1.12, fresnel);

          // Scum film, strongest at glancing angles where you'd actually see it.
          c = mix(c, c * 1.16 + uHorizon * 0.05, surfaceFilm(vSurf, uTime) * (0.25 + fresnel * 0.5));

          // One dull, broad band of moonlight — wide and weak, so it reads as a
          // cold sheen rather than sparkle (and never trips the bloom pass).
          float sheen = pow(max(dot(reflect(-viewDir, n), uSunDir), 0.0), 6.0);
          c += uSunColor * sheen * 0.075;

          // Denser at grazing angles, clearer looking straight down so the player
          // can still read submerged artifacts and the seabed.
          gl_FragColor = vec4(c, 0.55 + fresnel * 0.26);
        }`,
    });
    this.water = new THREE.Mesh(geo, this.waterMat);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = W;
    this.scene.add(this.water);
  }

  setWaterLevel(height) {
    this.water.position.y = height;
  }

  // ---- Reusable building primitives ----------------------------------------
  // Generic flooded building shell with dark inset windows on its +z face.
  // Returns the group; registers a collider unless solid:false.
  _building(x, z, w, d, h, rot = 0, opts = {}) {
    const { windows = true, solid = true } = opts;
    const g = new THREE.Group();
    const bodyMat = this.rng() > 0.5 ? this.mat.building : this.mat.buildingAlt;
    const body = new THREE.Mesh(tileBoxUVs(new THREE.BoxGeometry(w, h, d), w, h, d, bodyMat), bodyMat);
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

  // Support height under (x,z): nearest reachable authored plane, then the dock
  // and ladder, else 0 (water-standing baseline). Consumed by PlayerController.
  groundHeightAt(x, z, currentY = null) {
    let supportHeight = null;
    let nearestDelta = Infinity;
    for (const s of this.supportSurfaces) {
      const dx = x - s.cx, dz = z - s.cz;
      const lx = dx * s.cos - dz * s.sin;
      const lz = dx * s.sin + dz * s.cos;
      if (Math.abs(lx) > s.halfW || Math.abs(lz) > s.halfD) continue;
      const progress = (lz + s.halfD) / (s.halfD * 2);
      const height = s.startHeight + (s.endHeight - s.startHeight) * progress;
      if (Number.isFinite(currentY)) {
        const delta = Math.abs(height - currentY);
        if (delta > SUPPORT_SNAP || delta >= nearestDelta) continue;
        nearestDelta = delta;
      } else if (supportHeight !== null && height <= supportHeight) {
        continue;
      }
      supportHeight = height;
    }
    if (supportHeight !== null) return supportHeight;

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
  //
  // PERFORMANCE: the ring is ~100 trees of ~9 parts each. As individual meshes
  // that was ~900 draw calls per zone — by far the heaviest thing in the game and
  // the main blocker for low-end hardware. `_mangroveRing` therefore accumulates
  // every tree's part transforms and emits exactly THREE InstancedMeshes (trunks,
  // roots, canopy clumps), following the same dummy-Object3D pattern as
  // arena3.js. `_mangrove` stays available for one-off trees.

  // Append one tree's part transforms to `out` and register its collider.
  // Shares the RNG draw order with the old per-mesh version so layouts are stable.
  _mangroveParts(x, z, out) {
    const h = 4 + this.rng() * 3;
    const yaw = this.rng() * Math.PI * 2;
    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    // Rotate a tree-local offset into world space (the tree's own Y rotation).
    const place = (lx, ly, lz) => [x + lx * cos + lz * sin, ly, z - lx * sin + lz * cos];

    out.trunks.push({ pos: place(0, h / 2, 0), scale: [1, h, 1], yaw });

    const roots = 4 + Math.floor(this.rng() * 2);
    for (let i = 0; i < roots; i++) {
      const a = (i / roots) * Math.PI * 2 + this.rng() * 0.4;
      out.roots.push({
        pos: place(Math.cos(a) * 0.55, 0.55, Math.sin(a) * 0.55),
        // Local arch tilt, kept separate from the tree's yaw: the instance matrix
        // must compose them as yaw * tilt (what the old parent Group did), which is
        // not what a single XYZ Euler would produce.
        tilt: [-Math.sin(a) * 0.7, Math.cos(a) * 0.7],
        yaw,
      });
    }

    const clumps = 2 + Math.floor(this.rng() * 2);
    for (let i = 0; i < clumps; i++) {
      const r = 1.0 + this.rng() * 0.6;
      out.canopy.push({
        pos: place((this.rng() - 0.5) * 1.5, h + (this.rng() - 0.5) * 0.8, (this.rng() - 0.5) * 1.5),
        scale: [r, r * 0.7, r],
        yaw,
      });
    }

    this.addCollider(x, z, 1.5, 1.5);   // dense footprints → a solid wall
  }

  // ---- Batched decor: one InstancedMesh from a list of part transforms -------
  // The shared back-end for every batched primitive below. Each item is
  // `{ pos:[x,y,z], scale?:[x,y,z], yaw?, rot?:[x,y,z], tilt?:[x,z] }`:
  //   · `rot`  — a full local Euler (rubble tumble)
  //   · `tilt` + `yaw` — a local X/Z tilt composed UNDER a Y yaw, i.e. yaw * tilt,
  //     reproducing what a rotated parent Group used to do (mangrove roots)
  //   · `yaw`  — plain Y rotation
  // Returns the mesh (null for an empty list) so callers can tag it if needed.
  _instanced(geo, mat, items) {
    if (!items.length) return null;
    const mesh = new THREE.InstancedMesh(geo, mat, items.length);
    const dummy = this._instDummy ||= new THREE.Object3D();
    const yawQuat = this._instYaw ||= new THREE.Quaternion();
    const tiltQuat = this._instTilt ||= new THREE.Quaternion();
    const tiltEuler = this._instEuler ||= new THREE.Euler();
    const up = this._instUp ||= new THREE.Vector3(0, 1, 0);
    items.forEach((it, i) => {
      dummy.position.set(it.pos[0], it.pos[1], it.pos[2]);
      if (it.tilt) {
        tiltEuler.set(it.tilt[0], 0, it.tilt[1]);
        tiltQuat.setFromEuler(tiltEuler);
        yawQuat.setFromAxisAngle(up, it.yaw ?? 0);
        dummy.quaternion.multiplyQuaternions(yawQuat, tiltQuat);
      } else if (it.rot) {
        dummy.rotation.set(it.rot[0], it.rot[1], it.rot[2]);
      } else {
        dummy.rotation.set(0, it.yaw ?? 0, 0);
      }
      dummy.scale.set(...(it.scale ?? [1, 1, 1]));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    this.scene.add(mesh);
    return mesh;
  }

  // Emit the accumulated mangrove parts as three InstancedMeshes.
  _mangroveInstances(parts) {
    // Trunk is a unit-height cylinder scaled per instance, so one geometry covers
    // every tree height. Roots and clumps are fixed-size.
    this._instanced(
      tileCylinderUVs(new THREE.CylinderGeometry(0.16, 0.32, 1, 6), 0.16, 0.32, 1, this.mat.bark),
      this.mat.bark, parts.trunks);
    this._instanced(
      tileCylinderUVs(new THREE.CylinderGeometry(0.06, 0.11, 1.7, 5), 0.06, 0.11, 1.7, this.mat.bark),
      this.mat.bark, parts.roots);
    this._instanced(
      tileUniformUVs(new THREE.IcosahedronGeometry(1, 0), 2, this.mat.foliage),
      this.mat.foliage, parts.canopy);
  }

  // ---- Rubble mounds: low tumbled debris piles (decor) ----------------------
  // Each spot becomes a loose cluster of tumbled cubes and is registered in
  // `moundSpots` as an `elevated_rubble` artifact anchor. Kept low and
  // NON-COLLIDING on purpose so artifacts resting on a mound stay reachable.
  // All mounds across the zone share one InstancedMesh (was ~50 draw calls).
  _rubbleField(spots, opts = {}) {
    const { min = 4, extra = 3 } = opts;
    const items = [];
    for (const [mx, mz] of spots) {
      this.moundSpots.push([mx, mz]);
      const n = min + Math.floor(this.rng() * extra);
      for (let i = 0; i < n; i++) {
        const s = 0.4 + this.rng() * 0.7;
        items.push({
          pos: [
            mx + (this.rng() - 0.5) * 2.5,
            W - 0.3 + s / 2 + this.rng() * 0.2,
            mz + (this.rng() - 0.5) * 2.5,
          ],
          scale: [s, s, s],
          rot: [this.rng(), this.rng(), this.rng()],
        });
      }
    }
    return this._instanced(
      tileBoxUVs(new THREE.BoxGeometry(1, 1, 1), 1, 1, 1, this.mat.rubble),
      this.mat.rubble, items);
  }

  // ---- Stall rows: many stalls, batched ------------------------------------
  // `_stall` builds ~11 meshes, so a 14-stall market row cost ~150 draw calls.
  // This builds a whole row at once: the parts that repeat identically (legs,
  // wares, counters, canopies, signs) become one InstancedMesh each, while the
  // per-stall variation (`broken`, `tilt`, `scale`, rotation) survives as
  // per-instance transforms. Prefer this over looping `_stall` for any row.
  //
  // `specs`: [{ x, z, rot, scale?, broken?, tilt? }, ...]
  _stallRow(specs) {
    const legs = [], wares = [], counters = [], canopies = [], signs = [];
    const legOffsets = [[-1.1, -0.8], [1.1, -0.8], [-1.1, 0.8], [1.1, 0.8]];

    for (const spec of specs) {
      const { x, z, rot = 0, scale = 1, broken = false, tilt = 0 } = spec;
      // Stall-local → world, honouring the stall's own yaw, scale and Z tilt.
      const cos = Math.cos(rot), sin = Math.sin(rot);
      const place = (lx, ly, lz) => [
        x + (lx * cos + lz * sin) * scale,
        ly * scale,
        z + (-lx * sin + lz * cos) * scale,
      ];
      const body = { yaw: rot, tilt: [0, tilt], scale: [scale, scale, scale] };

      legOffsets.forEach(([px, pz], idx) => {
        if (broken && idx === 3) return;                 // a missing leg
        legs.push({ ...body, pos: place(px, 1.2, pz) });
      });
      if (!broken) canopies.push({ ...body, pos: place(0, 2.4, 0) });
      counters.push({ ...body, pos: place(0, 0.9, -0.5) });
      for (let i = 0; i < 4; i++) {
        // Matches `_stall`: the ware sits at stall-local y (so the stall's own
        // scale lifts it) and its radius scales with the stall too.
        const r = ((0.12 + this.rng() * 0.08) / 0.16) * scale;   // unit ware geo has r = 0.16
        wares.push({
          ...body,
          pos: place(-0.9 + i * 0.6, W + 0.05 + this.rng() * 0.1, -0.4),
          scale: [r, r, r],
        });
      }
      if (!broken) signs.push({ ...body, pos: place(0, 1.8, 0.95) });

      const [hw, hd] = this._footprint(1.3 * scale, 1.0 * scale, rot);
      this.addCollider(x, z, hw, hd);
    }

    const box = (w, h, d, mat) => tileBoxUVs(new THREE.BoxGeometry(w, h, d), w, h, d, mat);
    this._instanced(box(0.14, 2.4, 0.14, this.mat.wood), this.mat.wood, legs);
    this._instanced(box(2.6, 0.08, 2.0, this.mat.cloth), this.mat.cloth, canopies);
    this._instanced(box(2.3, 0.5, 0.8, this.mat.wood), this.mat.wood, counters);
    this._instanced(box(1.2, 0.5, 0.04, this.mat.sign), this.mat.sign, signs);
    this._instanced(new THREE.SphereGeometry(0.16, 8, 6), this.mat.ware, wares);
  }

  // ---- Tower fields: many stumpy towers, batched ---------------------------
  // A colonnade or apse ring of `_tower`s costs ~10 meshes each. This emits the
  // whole field as two InstancedMeshes by scaling one unit drum and one shard
  // geometry per instance. The per-drum taper ratio barely varies across a stack
  // (~0.88), so a single pre-tapered drum reads identically at fog distance —
  // use `_tower` for hero landmarks where the exact silhouette matters.
  //
  // `specs`: [{ x, z, height, baseR }, ...]. Returns the per-spec top heights.
  _towerField(specs, opts = {}) {
    const { mat = this.mat.concrete } = opts;
    const drumsOut = [], shardsOut = [], tops = [];
    for (const { x, z, height = 8, baseR = 1.2 } of specs) {
      const drums = Math.max(3, Math.round(height / 3));
      const dh = height / drums;
      let y = 0;
      for (let i = 0; i < drums; i++) {
        const r = baseR * (1 - (i / drums) * 0.55);
        drumsOut.push({
          pos: [x + (this.rng() - 0.5) * 0.25, y + dh / 2, z + (this.rng() - 0.5) * 0.25],
          scale: [r, dh, r],
          yaw: this.rng() * Math.PI,
        });
        y += dh;
      }
      const shards = 3 + Math.floor(this.rng() * 3);
      const topR = baseR * 0.45;
      for (let i = 0; i < shards; i++) {
        const a = (i / shards) * Math.PI * 2 + this.rng();
        const sh = 0.8 + this.rng() * 1.4;
        shardsOut.push({
          pos: [x + Math.cos(a) * topR, y + sh / 2 - 0.2, z + Math.sin(a) * topR],
          scale: [1, sh, 1],
          tilt: [0, (this.rng() - 0.5) * 0.5],
        });
      }
      this.addCollider(x, z, baseR, baseR);
      tops.push(height);
    }
    // Unit drum: radius 1 at the base, 0.88 at the top, height 1 → scaled per drum.
    this._instanced(tileCylinderUVs(new THREE.CylinderGeometry(0.88, 1, 1, 8), 0.88, 1, 1, mat),
      mat, drumsOut);
    this._instanced(tileBoxUVs(new THREE.BoxGeometry(0.3, 1, 0.3), 0.3, 1, 0.3, mat),
      mat, shardsOut);
    return tops;
  }

  // A single standalone mangrove (three draw calls of one instance each). Prefer
  // `_mangroveRing` for groups.
  _mangrove(x, z) {
    const parts = { trunks: [], roots: [], canopy: [] };
    this._mangroveParts(x, z, parts);
    this._mangroveInstances(parts);
  }

  // Square ring of mangroves walling off the level edge. Close spacing makes
  // the overlapping footprints read as one solid boundary.
  _mangroveRing(opts = {}) {
    const { radius = 47, step = 3.6 } = opts;
    const E = radius;
    const parts = { trunks: [], roots: [], canopy: [] };
    for (let v = -E; v <= E; v += step) {
      const j = () => (this.rng() - 0.5) * 1.1;
      this._mangroveParts(v + j(), -E + j(), parts);   // north edge
      this._mangroveParts(v + j(),  E + j(), parts);   // south edge
      this._mangroveParts(-E + j(), v + j(), parts);   // west edge
      this._mangroveParts( E + j(), v + j(), parts);   // east edge
    }
    this._mangroveInstances(parts);
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
      const drum = new THREE.Mesh(
        tileCylinderUVs(new THREE.CylinderGeometry(r1, r0, dh, 8), r1, r0, dh, mat), mat);
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
      const pier = new THREE.Mesh(
        tileBoxUVs(new THREE.BoxGeometry(pierW, ph, pierW), pierW, ph, pierW, mat), mat);
      pier.position.set(s * half, ph / 2, 0);
      pier.rotation.z = -s * (0.04 + this.rng() * 0.06);   // lean inward, ruined
      g.add(pier);
    }
    // sagging lintel across the top (decor, non-colliding so it never blocks)
    const lintel = new THREE.Mesh(
      tileBoxUVs(new THREE.BoxGeometry(span + pierW, 0.7, pierW * 1.1), span + pierW, 0.7, pierW * 1.1, mat), mat);
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

  // ---- Festival dressing: lanterns + banners (GDD Zone 2 "LIKET") -----------
  // The implementations live in _partials/FestivalDressing.js (this file is at
  // the 1000-line cap). These wrappers keep the primitive API on `world` so zone
  // modules go on calling `world._lantern(...)`, `world._bunting(...)` etc.
  // Read that partial before changing any of them: it documents the two standing
  // constraints (no THREE.Light, no new animation loop).

  _sagLine(x1, z1, x2, z2, y1, y2, sag, opts) {
    return sagLine(this, x1, z1, x2, z2, y1, y2, sag, opts);
  }

  _lantern(x, y, z, opts) { return lantern(this, x, y, z, opts); }

  _lanternString(x1, z1, x2, z2, opts) { return lanternString(this, x1, z1, x2, z2, opts); }

  _lanternCluster(x, z, opts) { return lanternCluster(this, x, z, opts); }

  _bunting(x1, z1, x2, z2, opts) { return bunting(this, x1, z1, x2, z2, opts); }

  _parulMast(x, z, opts) { return parulMast(this, x, z, opts); }

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
    // x/z/r let update() fade the cone as the camera nears it (anti-blinding);
    // base is trimmed slightly so stacked shafts + bloom never overdrive.
    this.shafts.push({ mat, base: opacity * 0.75, phase: this.rng() * Math.PI * 2, x, z, r: topR });
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
    this.supportSurfaces.length = 0;
  }

  update(dt, t, camPos = null) {
    this.waterMat.uniforms.uTime.value = t;
    // gentle sediment drift
    this.particles.rotation.y = t * 0.01;
    const p = this.particles.geometry.attributes.position;
    for (let i = 1; i < p.array.length; i += 3) {
      p.array[i] += dt * 0.08;
      if (p.array[i] > 6) p.array[i] = 0;
    }
    p.needsUpdate = true;
    // god-ray shafts breathe gently in intensity; cones (entries with a
    // radius) also fade toward ~20% as the camera approaches/enters them so
    // an additive shaft filling the view never whites out with bloom.
    for (const s of this.shafts) {
      let k = 0.7 + Math.sin(t * 0.5 + s.phase) * 0.3;
      if (camPos && s.r !== undefined) {
        const dx = camPos.x - s.x, dz = camPos.z - s.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        const inner = s.r * 0.5, outer = s.r + 4;   // fully dim inside, full past the rim
        const fade = Math.min(1, Math.max(0, (d - inner) / (outer - inner)));
        k *= 0.2 + 0.8 * fade;
      }
      s.mat.opacity = s.base * k;
    }
    // floating debris bob + slow spin
    for (const d of this.debris) {
      d.mesh.position.y = d.baseY + Math.sin(t * 0.8 + d.phase) * d.amp;
      d.mesh.rotation.y += d.spin * dt;
    }
  }
}
