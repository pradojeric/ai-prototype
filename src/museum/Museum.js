// ============================================================
// MUSEUM — "Aking Museo", the digital gallery (reusable hub scene)
// ============================================================
// Owns a self-contained dark-gallery THREE.Scene. The main room is a LOBBY: the
// Soul Altar, the three zone portals on the -Z wall, and a doorway per zone
// leading to that zone's own gallery (see _partials/GalleryRing.js), where its
// recovered memories float in glass cubes on a ring of pedestals.
//
// Knows nothing about cameras or cutscenes — the intro cutscene drives a camera
// over it, and the walkable hub renders it directly with the player inside.
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { MUSEUM } from '../config.js';
import { ARTIFACT_DATA } from '../data.js';
import { createVortexMaterial } from './PortalVortex.js';
import { SoulPedestal } from './_partials/SoulPedestal.js';
import { SurvivalPortal } from './_partials/SurvivalPortal.js';
import { GalleryRing, createPedestalKit } from './_partials/GalleryRing.js';
import {
  Tracker, tilePlane, wall, loadTextureSet, applyTextureSet, signTexture,
} from './_partials/RoomShell.js';

// Unlit MeshBasic at full white crosses the bloom threshold and the lettering
// smears into a blob. Tinting the material keeps the canvas text crisp with only
// a faint glow, in both the dark intro and the bright hub.
const SIGN_TINT = 0x8f8f8f;

// Each zone's accent, shared with its Soul on the altar so a gallery reads as
// belonging to the same zone as the Soul it sits beside.
const ZONE_ACCENT = { 1: 0x7fe8ff, 2: 0xffd36b, 3: 0xb89cff };

export class Museum {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05080a);
    // Intro fog: close and dark, so the empty lobby fades into gloom. The hub
    // pushes it back (see setHubLighting) — a gallery is 15 m deep and the far
    // wall would otherwise sit at ~45% haze in a room that is meant to read bright.
    this.scene.fog = new THREE.Fog(0x05080a, 6, 26);

    this.track = new Tracker();   // every geometry/material/texture this file makes
    this.galleries = [];          // one GalleryRing per zone
    this.galleryByZone = {};
    this._rayTargets = [];        // glass shells of filled cubes, for crosshair picking
    this._aimed = null;           // pedestal currently under the crosshair
    this.hallLit = false;         // the hallway light is off until ignited

    // Three zone portals on the -Z wall (physical left -> right). Zone 1 sits in the
    // center and is the only one open; the others are locked until those zones exist.
    this.portals = [
      { x: MUSEUM.PORTAL_X[0], zone: 2, locked: true, name: 'LIKET' },
      { x: MUSEUM.PORTAL_X[1], zone: 1, locked: false, name: 'PONSIA' },
      { x: MUSEUM.PORTAL_X[2], zone: 3, locked: true, name: 'Pananisia' },
    ];

    // The player wakes at the +Z end and the open (Zone 1) portal sits past the
    // -Z wall on the centerline. Kept clear of the Zone 1 gallery doorway behind
    // it so the hub never spawns with something already interactable.
    this.spawnPoint = new THREE.Vector3(0, 1.5, MUSEUM.ROOM_HALF - 2.2);
    this.hallwayPoint = new THREE.Vector3(0, 1.55, -MUSEUM.ROOM_HALF - MUSEUM.HALL_LEN + 0.5);

    this._lights();
    this._shell();
    this._loadTextures();   // CC0 PBR maps → floor/wall/ceiling surface detail
    this._galleries();      // the three per-zone pedestal rooms + their doorways
    this._portalSigns();
    // Built on the room centerline but hidden until hub mode. IntroCutscene moves
    // its camera directly along x=0, so keeping the altar out of that scene beat
    // prevents clipping while preserving the authored wake-to-hallway path.
    this.soulPedestal = new SoulPedestal(this.scene);
    // The Endless Echoes arch (Survival). Built here so _freezeStatic bakes it;
    // it only ever changes material/visibility afterwards, never a transform.
    this.survivalPortal = new SurvivalPortal(this.scene, this.track);
    this._hallway();
    this._hubLights();    // built but kept off-scene until the hub visit
    this._freezeStatic(); // bake transforms — nothing built here ever moves
    // Dynamic and intentionally created after _freezeStatic: its traveler moves
    // every frame while the opening cinematic points Hil toward Zone 1.
    this._introString();
  }

  // Disable per-frame matrix recomputation for the whole static gallery. Only
  // light intensities and material colors mutate after construction — never a
  // transform — so we bake each local matrix once. Done per-object (not via
  // scene.matrixWorldAutoUpdate) so the player rig Game adds later, and the
  // artifact cubes hung into pedestals afterwards, still update normally as
  // children of frozen parents.
  _freezeStatic() {
    const freeze = (obj) => { obj.updateMatrix(); obj.matrixAutoUpdate = false; };
    this.scene.traverse(freeze);
    this.hubGroup.traverse(freeze);   // unattached at build time; freeze its statics too
  }

  // ---- construction helpers -------------------------------------------------

  _mat(opts) { return this.track.mat(new THREE.MeshStandardMaterial(opts)); }

  _geo(g) { return this.track.geo(g); }

  _wall(mat, x, y, z, w, h, ry) {
    return wall(this.scene, mat, x, y, z, w, h, ry, this.track);
  }

  // Load the committed CC0 (ambientCG) museum texture sets and bind them to the
  // shell materials. `.color` is deliberately left untouched — the dark-intro /
  // bright-hub tint (see _shell / setHubLighting) stays the mood driver; the
  // albedo map just multiplies against it for detail.
  _loadTextures() {
    this._texLoader ||= new THREE.TextureLoader();
    applyTextureSet(this.floorMat, loadTextureSet(this._texLoader, 'marble', this.track));
    applyTextureSet(this.wallMat, loadTextureSet(this._texLoader, 'gallery-wall', this.track));
    applyTextureSet(this.ceilMat, loadTextureSet(this._texLoader, 'marble-tiles', this.track));
  }

  _lights() {
    // Base fill — the museum is lightly lit and clearly visible the whole intro,
    // lights on or off. The portal "lights on" beat (setHallLit) only adds the
    // warm hall light + portal glow; it does NOT change this room fill. A normal
    // intensity suffices because the materials are tuned light (see _shell) rather
    // than near-black. setHubLighting drives its own values for the hub.
    this.ambient = new THREE.AmbientLight(0x2a3b40, 3.0);
    this.scene.add(this.ambient);
    this.hemi = new THREE.HemisphereLight(0x35525a, 0x06090b, 0.15);
    this.scene.add(this.hemi);

    // Warm light spilling from the hallway — starts OFF; the cutscene snaps it
    // on suddenly when the player turns back from looking around.
    this.hallLight = new THREE.PointLight(MUSEUM.HALL_LIGHT_COLOR, 0, 30, 1.4);
    this.hallLight.position.set(0, 2.0, -MUSEUM.ROOM_HALF - 2.2);
    this.scene.add(this.hallLight);
  }

  _shell() {
    const H = MUSEUM.ROOM_HALF, Y = MUSEUM.ROOM_HEIGHT;
    // Kept on `this` so the hub visit can repaint them into a bright gallery.
    // Intro colors, tuned LIGHT on purpose: under ACES tone mapping a near-black
    // albedo just renders black no matter the light, so a moody-but-visible gallery
    // comes from a light material + modest ambient (~3), not a huge light intensity.
    // setHubLighting repaints these to the full-bright hub palette.
    const floorMat = this.floorMat = this._mat({ color: 0x60717d, roughness: 0.85, metalness: 0.1 });
    const wallMat = this.wallMat = this._mat({ color: 0x7e959e, roughness: 0.95 });
    const ceilMat = this.ceilMat = this._mat({ color: 0x4e6068, roughness: 1 });
    // World units per texture repeat (read by tilePlane to bake consistent texel
    // density into every plane sharing the material — large marble slabs on the
    // floor, plaster runs on the walls, smaller tiles overhead).
    floorMat.userData.tile = 4.0;
    wallMat.userData.tile = 4.0;
    ceilMat.userData.tile = 3.0;

    const floor = new THREE.Mesh(tilePlane(this._geo(new THREE.PlaneGeometry(H * 2, H * 2)), H * 2, H * 2, floorMat), floorMat);
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    const ceil = new THREE.Mesh(tilePlane(this._geo(new THREE.PlaneGeometry(H * 2, H * 2)), H * 2, H * 2, ceilMat), ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = Y;
    this.scene.add(ceil);

    // Only the -Z wall belongs to the lobby now: the ±X and +Z walls are each
    // shared with a gallery, so GalleryRing builds them (both faces + doorway).
    this._frontWall(wallMat);
  }

  // The -Z wall carrying the three zone doorways: solid panels filling the gaps
  // between/around the openings, a lintel above each, and a dim barrier sealing the
  // two locked doorways. The open (Zone 1) doorway is left clear.
  _frontWall(wallMat) {
    const H = MUSEUM.ROOM_HALF, Y = MUSEUM.ROOM_HEIGHT;
    const door = MUSEUM.DOOR_HALF;
    const doorH = MUSEUM.GALLERY.DOOR_H;     // doorway opening height

    // Solid wall segments = the front span minus each doorway opening. Walk the
    // sorted door edges and fill the gaps left between them.
    const edges = [...this.portals].sort((a, b) => a.x - b.x);
    let cursor = -H;
    const fillTo = (x) => {
      const w = x - cursor;
      if (w > 0.001) this._wall(wallMat, cursor + w / 2, Y / 2, -H, w, Y, 0);
      cursor = x;
    };
    for (const p of edges) {
      fillTo(p.x - door);                    // solid wall up to this doorway
      // lintel spanning the opening, above the doorway height
      this._wall(wallMat, p.x, doorH + (Y - doorH) / 2, -H, door * 2, Y - doorH, 0);
      if (p.locked) this._lockedBarrier(p, doorH);
      cursor = p.x + door;                   // skip the opening
    }
    fillTo(H);                               // remaining wall to the +X corner
  }

  // A dim "no entry" gate filling a locked doorway: a dark recessed panel plus a few
  // vertical bars, so the portal beyond reads as sealed. Built into a Group stored on
  // the portal so unlockPortal() can hide the whole gate when the zone opens.
  _lockedBarrier(p, doorH) {
    const x = p.x;
    const door = MUSEUM.DOOR_HALF;
    const group = new THREE.Group();
    const panelMat = this._mat({
      color: MUSEUM.LOCK_PORTAL_COLOR,
      roughness: 0.9,
      emissive: new THREE.Color(MUSEUM.LOCK_PORTAL_COLOR),
      emissiveIntensity: 0.25,
    });
    const panel = new THREE.Mesh(this._geo(new THREE.PlaneGeometry(door * 2, doorH)), panelMat);
    panel.position.set(x, doorH / 2, -MUSEUM.ROOM_HALF + 0.05);   // just inside the opening
    group.add(panel);

    const barMat = this._mat({ color: 0x05080a, roughness: 0.7, metalness: 0.4 });
    const barGeo = this._geo(new THREE.BoxGeometry(0.08, doorH, 0.08));
    for (const bx of [-door * 0.5, 0, door * 0.5]) {
      const bar = new THREE.Mesh(barGeo, barMat);
      bar.position.set(x + bx, doorH / 2, -MUSEUM.ROOM_HALF + 0.06);
      group.add(bar);
    }
    this.scene.add(group);
    p.barrierGroup = group;
  }

  // A lit signboard on each -Z doorway lintel telling the player which zone lies
  // beyond. Open zones read "ZONE N" + district name in warm glow; locked zones
  // hide the name and read "LOCKED" dimmed until unlockPortal() reveals them.
  _portalSigns() {
    const H = MUSEUM.ROOM_HALF, Y = MUSEUM.ROOM_HEIGHT;
    const doorH = MUSEUM.GALLERY.DOOR_H;
    const signW = 2.4, signH = 0.75;         // 3.2:1 ratio == the sign canvas aspect
    const y = doorH + (Y - doorH) / 2;       // centered on the lintel above the opening
    const geo = this._geo(new THREE.PlaneGeometry(signW, signH));

    for (const p of this.portals) {
      // Unlit (MeshBasic) so the lettering stays legible regardless of room
      // lighting and reads as a glowing sign once bloom runs.
      const mat = this.track.mat(new THREE.MeshBasicMaterial({
        map: signTexture(p.zone, p.name, p.locked, this.track),
        color: SIGN_TINT,
        transparent: true,
        depthWrite: false,
      }));
      const sign = new THREE.Mesh(geo, mat);  // default +Z normal faces into the room
      sign.position.set(p.x, y, -H + 0.06);   // just in front of the lintel plane
      this.scene.add(sign);
      p.signMesh = sign;
      p.signMat = mat;
    }
  }

  // One gallery per zone, each behind its own doorway in a lobby wall. The ring
  // holds exactly as many pedestals as that zone has artifacts — derived from
  // ARTIFACT_DATA, so adding a memory adds a plinth with no config to update.
  _galleries() {
    this._texLoader ||= new THREE.TextureLoader();
    this.kit = createPedestalKit(this.track, this._texLoader);
    const shellMats = { floorMat: this.floorMat, wallMat: this.wallMat, ceilMat: this.ceilMat };

    for (const room of MUSEUM.GALLERY.ROOMS) {
      const portal = this.portals.find((p) => p.zone === room.zone);
      const ring = new GalleryRing({
        scene: this.scene,
        room,
        zone: room.zone,
        name: portal ? portal.name : '???',
        locked: portal ? portal.locked : true,
        count: ARTIFACT_DATA.reduce((n, d) => n + (d.zone === room.zone ? 1 : 0), 0),
        accent: ZONE_ACCENT[room.zone] || 0x7fe8ff,
        shellMats,
        kit: this.kit,
      });
      this.galleries.push(ring);
      this.galleryByZone[room.zone] = ring;
    }
  }

  // One corridor per zone past its doorway, each ending in an emissive portal panel
  // that bloom turns into a glow. The open (Zone 1) corridor's panel is the warm
  // "light down the hallway" the intro ignites; locked corridors get a dim cold panel.
  _hallway() {
    const H = MUSEUM.ROOM_HALF, Y = MUSEUM.ROOM_HEIGHT;
    // Double-sided so the dividers never reveal a backface gap at oblique angles.
    const wallMat = this._mat({ color: 0x171d21, roughness: 0.95, side: THREE.DoubleSide });
    const len = MUSEUM.HALL_LEN;
    const d = MUSEUM.DOOR_HALF;
    const panelGeo = this._geo(new THREE.PlaneGeometry(d * 2 + 0.4, Y));

    // The corridors sit past the -Z wall, OUTSIDE the room's floor/ceiling/side walls.
    // Enclose that whole back region so no corridor leaks to the background or lets
    // you see across into a neighbouring portal: shared floor, ceiling, solid back
    // wall (behind the emissive panels), and the two outer side walls.
    const cz = -H - len / 2;
    const floor = new THREE.Mesh(this._geo(new THREE.PlaneGeometry(H * 2, len)), wallMat);
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, cz); this.scene.add(floor);
    const ceil = new THREE.Mesh(this._geo(new THREE.PlaneGeometry(H * 2, len)), wallMat);
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, Y, cz); this.scene.add(ceil);
    this._wall(wallMat, 0, Y / 2, -H - len, H * 2, Y, 0);              // solid back wall
    this._wall(wallMat, H, Y / 2, cz, len, Y, Math.PI / 2);          // +X outer flank
    this._wall(wallMat, -H, Y / 2, cz, len, Y, Math.PI / 2);          // -X outer flank

    for (const p of this.portals) {
      // corridor side walls (aligned with the doorway opening + collision corridor)
      this._wall(wallMat, p.x + d, Y / 2, cz, len, Y, Math.PI / 2);
      this._wall(wallMat, p.x - d, Y / 2, cz, len, Y, Math.PI / 2);

      let mat;
      if (p.locked) {
        mat = this._mat({
          color: 0x000000,
          emissive: new THREE.Color(MUSEUM.LOCK_PORTAL_COLOR),
          emissiveIntensity: 0.5,              // a faint cold glow behind the bars
        });
      } else {
        // The open portal's panel is shared with setHallLit (intro startle beat).
        mat = this.hallPanelMat = this.track.mat(new THREE.MeshStandardMaterial({
          color: 0x000000,
          emissive: new THREE.Color(MUSEUM.HALL_LIGHT_COLOR),
          emissiveIntensity: 0,                // dark until the light appears
        }));
      }
      const panel = new THREE.Mesh(panelGeo, mat);
      panel.position.set(p.x, Y / 2, -H - len + 0.03);   // sit just in front of the back wall
      this.scene.add(panel);

      // Swirling blue vortex overlaying the panel — hidden until the walkable
      // hub (setHubLighting) reveals it on open portals. One shared shader
      // material (single uTime); the intro keeps the plain warm/cold panels.
      this._vortexMat ||= this.track.mat(createVortexMaterial((d * 2 + 0.4) / Y));
      const vortex = new THREE.Mesh(panelGeo, this._vortexMat);
      vortex.position.set(p.x, Y / 2, -H - len + 0.05);  // just in front of the panel
      vortex.visible = false;
      this.scene.add(vortex);
      p.vortexMesh = vortex;

      // Per-portal handles used by the hub: the panel material (lit/breathed when
      // open), the corridor-end point Game detects to enter the zone, and a lit flag.
      p.panelMat = mat;
      p.entry = new THREE.Vector3(p.x, 1.55, -H - len + 0.6);
      p.lit = false;
      if (!p.locked) this.hallPortal = p;    // the open (Zone 1) corridor — the intro's hall light
    }
  }

  // The first visible Hibla teaches the title's central idea without text: a
  // memory-thread wakes beside Hil, crosses the lobby, and enters PONSIA. The
  // cutscene reveals it with the hallway light; normal hub visits keep it hidden.
  _introString() {
    const cfg = MUSEUM.INTRO_STRING;
    const H = MUSEUM.ROOM_HALF;
    const startZ = this.spawnPoint.z - 0.45;
    const endZ = this.hallwayPoint.z + 0.18;
    this._introStringCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.055, startZ),
      new THREE.Vector3(-0.2, 0.06, startZ - 2.1),
      new THREE.Vector3(0.16, 0.055, 0.6),
      new THREE.Vector3(-0.1, 0.06, -H + 0.4),
      new THREE.Vector3(0, 0.08, endZ),
    ]);

    const beadGeometry = this.track.geo(new THREE.IcosahedronGeometry(0.075, 1));
    this._introStringLines = [];
    for (let i = 0; i < cfg.STRANDS; i++) {
      const positions = new Float32Array(cfg.POINTS * 3);
      const geometry = this.track.geo(new THREE.BufferGeometry());
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setDrawRange(0, 0);
      const material = this.track.mat(new THREE.LineBasicMaterial({
        color: cfg.COLOR,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }));
      const line = new THREE.Line(geometry, material);
      line.frustumCulled = false;
      line.visible = false;
      line.renderOrder = 3;
      this.scene.add(line);

      const beadMaterial = this.track.mat(new THREE.MeshBasicMaterial({
        color: cfg.COLOR,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }));
      const traveler = new THREE.Mesh(beadGeometry, beadMaterial);
      traveler.visible = false;
      traveler.renderOrder = 4;
      this.scene.add(traveler);

      this._introStringLines.push({
        line,
        traveler,
        positions,
        phase: i / cfg.STRANDS * Math.PI * 2,
      });
    }
    this._introStringPoint = new THREE.Vector3();
    this._introStringElapsed = 0;
    this._shapeIntroStrings(0);
  }

  setIntroStringVisible(on, reset = false) {
    if (!this._introStringLines) return;
    if (reset) {
      this._introStringElapsed = 0;
      for (const strand of this._introStringLines) strand.line.geometry.setDrawRange(0, 0);
    }
    for (const strand of this._introStringLines) {
      strand.line.visible = on;
      // _updateIntroString reveals each traveler after its strand's stagger;
      // keeping them hidden here avoids a one-frame cluster at the route origin.
      strand.traveler.visible = false;
    }
  }

  // Bright-gallery lighting for the walkable hub. Built into an UNATTACHED group
  // so it contributes nothing until setHubLighting(true) adds it (keeping the
  // intro dark).
  //
  // PERF: forward rendering evaluates EVERY light for EVERY fragment, so light
  // count is the hub's frame-rate budget. The old per-frame picture SpotLights
  // (one per slot) tanked it. Instead the gallery is carried by three fill lights
  // + a few distance-limited hanging PointLights, and the per-pedestal display
  // light is purely cosmetic: an emissive bulb (no light) drawn as ONE
  // InstancedMesh for all 27 plinths — a single draw call, zero shading cost.
  _hubLights() {
    const g = this.hubGroup = new THREE.Group();

    // Base fill does the real lighting work now that the picture spots are gone:
    // warm-tinted key + hemisphere read as gallery lighting without per-fragment cost.
    g.add(new THREE.AmbientLight(0xffffff, 0.55));
    g.add(new THREE.HemisphereLight(0xf3f7ff, 0x3a4046, 0.5));
    const key = new THREE.DirectionalLight(0xfff4e0, 0.55);
    key.position.set(0, 8, 3);
    g.add(key);

    // Kept modest so the lamps don't bloom into the whole ceiling once the
    // composer's ACES + bloom run (the bulbs sit well above the bloom threshold).
    const bulbMat = this._mat({ color: 0x000000, emissive: 0xfff2d8, emissiveIntensity: 0.9 });
    const bulbGeo = this._geo(new THREE.SphereGeometry(0.07, 12, 12));
    const cordMat = this._mat({ color: 0x0c0f10, roughness: 1 });

    // Cosmetic display bulb in the ceiling above each pedestal — one instanced
    // draw for the whole museum, no light source.
    const spots = [];
    for (const ring of this.galleries) ring.collectBulbSpots(spots);
    const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, spots.length);
    const m = new THREE.Matrix4();
    spots.forEach(([px, pz], i) => {
      m.makeTranslation(px, MUSEUM.ROOM_HEIGHT - 0.35, pz);
      bulbs.setMatrixAt(i, m);
    });
    bulbs.instanceMatrix.needsUpdate = true;
    g.add(bulbs);
    this._bulbInst = bulbs;       // dispose() frees its instance buffer

    // Hanging warm bulbs for ambience + bloom: down the lobby centerline (spaced
    // as a fraction of it, so the lobby can be resized without restringing them),
    // plus three along each gallery's long axis. Twelve PointLights total — the
    // galleries are the big rooms now, so they get the larger share.
    const H = MUSEUM.ROOM_HALF;
    const hangs = [[0, -H * 0.62], [0, 0], [0, H * 0.62]];
    for (const ring of this.galleries) hangs.push(...ring.hangSpots());
    for (const [cx, cz] of hangs) {
      const y = MUSEUM.ROOM_HEIGHT - 0.5;
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(cx, y, cz);
      g.add(bulb);
      const cord = new THREE.Mesh(this._geo(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6)), cordMat);
      cord.position.set(cx, y + 0.25, cz);
      g.add(cord);
      const pl = new THREE.PointLight(0xffe6c0, 1.1, 12, 1.6);
      pl.position.set(cx, y, cz);
      g.add(pl);
    }
  }

  // ---- per-frame ------------------------------------------------------------

  update(dt, t) {
    this.soulPedestal.update(t);
    this._updateIntroString(dt, t);
    if (this.hubMode) {
      // Hub: the vortices carry the portal look — just spin them — and the
      // recovered memories bob and turn in their cases.
      if (this._vortexMat) this._vortexMat.uniforms.uTime.value = t;
      this.survivalPortal.update(t);
      for (const ring of this.galleries) ring.update(t);
      return;
    }
    // Intro: once lit, breathe each open portal's emissive panel so the glow
    // feels alive. Unlit panels (still-locked corridors) stay at their dim glow.
    for (const p of this.portals) {
      if (p.lit && p.panelMat) p.panelMat.emissiveIntensity = 1.6 + Math.sin(t * 1.7) * 0.2;
    }
  }

  _updateIntroString(dt, t) {
    if (!this._introStringLines?.[0]?.line.visible) return;
    const cfg = MUSEUM.INTRO_STRING;
    this._introStringElapsed += dt;
    this._shapeIntroStrings(t);

    for (let i = 0; i < this._introStringLines.length; i++) {
      const strand = this._introStringLines[i];
      const elapsed = Math.max(0, this._introStringElapsed - i * cfg.STAGGER);
      const drawProgress = Math.min(1, elapsed / cfg.DRAW_TIME);
      const count = elapsed > 0 ? Math.max(2, Math.ceil(drawProgress * cfg.POINTS)) : 0;
      strand.line.geometry.setDrawRange(0, count);

      // Each bead leads its drawing tip, then repeatedly travels down its own
      // moving strand so all three currents point toward the portal.
      const travelerProgress = drawProgress < 1
        ? drawProgress
        : ((elapsed - cfg.DRAW_TIME) * cfg.TRAVEL_SPEED) % 1;
      this._sampleIntroString(i, travelerProgress, t, strand.traveler.position);
      strand.traveler.visible = elapsed > 0;
      const pulse = 0.82 + Math.sin(t * 7 + strand.phase) * 0.18;
      strand.traveler.scale.setScalar(pulse);
      strand.line.material.opacity = 0.7 + Math.sin(t * 2.4 + strand.phase) * 0.14;
    }
  }

  _shapeIntroStrings(t) {
    const cfg = MUSEUM.INTRO_STRING;
    for (let strandIndex = 0; strandIndex < this._introStringLines.length; strandIndex++) {
      const strand = this._introStringLines[strandIndex];
      for (let i = 0; i < cfg.POINTS; i++) {
        const u = i / (cfg.POINTS - 1);
        this._sampleIntroString(strandIndex, u, t, this._introStringPoint);
        const offset = i * 3;
        strand.positions[offset] = this._introStringPoint.x;
        strand.positions[offset + 1] = this._introStringPoint.y;
        strand.positions[offset + 2] = this._introStringPoint.z;
      }
      strand.line.geometry.attributes.position.needsUpdate = true;
    }
  }

  _sampleIntroString(strandIndex, u, t, out) {
    const cfg = MUSEUM.INTRO_STRING;
    const phase = this._introStringLines[strandIndex].phase;
    this._introStringCurve.getPointAt(u, out);
    // Waves travel toward the portal instead of merely trembling in place.
    const flow = u * Math.PI * 4.5 - t * 1.7 + phase;
    out.x += Math.sin(flow) * cfg.WAVE_WIDTH;
    out.y += cfg.HOVER_HEIGHT + Math.cos(flow * 0.78) * cfg.WAVE_HEIGHT;
    out.z += Math.sin(flow * 0.52 + phase) * 0.035;
    return out;
  }

  // Snap the hallway light on/off (the intro pops it on for the startle beat).
  // Lights the open (Zone 1) corridor panel — the other portals open via unlockPortal.
  setHallLit(on) {
    this.hallLit = on;
    this.hallLight.intensity = on ? MUSEUM.HALL_LIGHT_ON : 0;
    // Room fill is left alone — the museum is already lit (see _lights). The
    // "lights on" beat is purely the warm hall light + the glowing portal panel.
    if (this.hallPortal) {
      this.hallPortal.lit = on;
      this.hallPortal.panelMat.emissiveIntensity = on ? 1.6 : 0;
    }
  }

  // Open a locked zone portal: clear its sealing barrier, open collision (collidesAt
  // gates on !p.locked), and light its corridor panel warm so it reads as enterable.
  unlockPortal(zone) {
    const p = this.portals.find((pp) => pp.zone === zone);
    if (!p || !p.locked) return;
    p.locked = false;
    if (p.barrierGroup) p.barrierGroup.visible = false;
    if (p.panelMat) {
      p.panelMat.emissive.setHex(MUSEUM.HALL_LIGHT_COLOR);
      p.panelMat.emissiveIntensity = 1.6;
      p.lit = true;
    }
    // In the hub the open-portal look is the blue vortex, not the warm panel.
    if (this.hubMode && p.vortexMesh) {
      p.vortexMesh.visible = true;
      p.panelMat.emissiveIntensity = 0;
    }
    // Repaint this zone's plaques — the -Z lintel here, plus the gallery doorway
    // sign and its zone marker — dropping "LOCKED" for the district name.
    if (p.signMat) {
      const old = p.signMat.map;
      p.signMat.map = signTexture(p.zone, p.name, false, this.track);
      p.signMat.needsUpdate = true;
      this.track.drop(old);
    }
    const ring = this.galleryByZone[zone];
    if (ring) ring.reveal(p.name);
  }

  // Brighten the gallery for the walkable hub: attach the hub light group and
  // repaint the dark intro materials into a clean white gallery. Instant (the
  // white fade in Game._enterMuseum hides the change). Only ever called after
  // the intro, so mutating the shared room materials here is safe.
  setHubLighting(on) {
    this.hubMode = on;
    if (on) this.setIntroStringVisible(false);
    this.soulPedestal.setVisible(on);
    // Present in the hub, but whether it is OPEN is game policy (ending seen or
    // the debug unlock), decided by Game — this class stays geometry-only.
    this.survivalPortal.setVisible(on);
    // Hub: open portals trade the warm emissive panel for the blue vortex;
    // leaving the hub restores the intro's warm panels. Locked corridors keep
    // their dim cold panel either way.
    for (const p of this.portals) {
      if (!p.vortexMesh) continue;
      const swirl = on && !p.locked;
      p.vortexMesh.visible = swirl;
      if (!p.locked && p.panelMat) p.panelMat.emissiveIntensity = swirl ? 0 : (p.lit ? 1.6 : 0);
    }
    if (on) {
      if (this.hubGroup.parent !== this.scene) this.scene.add(this.hubGroup);
      this.floorMat.color.setHex(0x4d555a);
      this.wallMat.color.setHex(0x99a1a4);   // off near-white so the walls don't wash out
      this.ceilMat.color.setHex(0x787f82);
      this.kit.plinthMat.color.setHex(0xb9c0c4);
      this.kit.brassMat.color.setHex(0xc9a463);
      this.ambient.intensity = 0.3;    // hubGroup dominates — keep the base fill low
      this.hemi.intensity = 0.25;
      // Far enough back that a gallery reads clean end to end; it still softens
      // the longest sightline (lobby to a far gallery wall, ~31 m).
      this.scene.fog.near = 20;
      this.scene.fog.far = 70;
      this._loadEnvironment();         // subtle IBL reflections — hub only
    } else if (this.hubGroup.parent === this.scene) {
      this.scene.remove(this.hubGroup);
      this.floorMat.color.setHex(0x60717d);
      this.wallMat.color.setHex(0x7e959e);
      this.ceilMat.color.setHex(0x4e6068);
      this.kit.plinthMat.color.setHex(0x6d757a);
      this.kit.brassMat.color.setHex(0x6f5c3a);
      this.ambient.intensity = 3.0;    // restore the lightly-lit intro base fill
      this.hemi.intensity = 0.15;
      this.scene.fog.near = 6;
      this.scene.fog.far = 26;
      this.scene.environment = null;   // intro stays dark & reflection-free
    }
  }

  // Lazily load the CC0 studio HDRI and set it as the scene environment for the
  // walkable hub, giving the marble floor, brass trim and glass cases soft
  // real-world reflections. Hub only — the intro clears it (setHubLighting off)
  // so the moody opening is unchanged. The equirectangular .hdr is used purely as
  // `environment` (reflections/IBL); `scene.background` stays the dark color.
  _loadEnvironment() {
    if (this._envTex) { this.scene.environment = this._envTex; return; }
    if (this._envLoading) return;
    this._envLoading = true;
    new RGBELoader().load('assets/hdri/gallery_1k.hdr', (tex) => {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      this._envTex = tex;
      // Keep IBL gentle so the added ambient light never washes out the tuned
      // hub palette or crosses the bloom threshold.
      if ('environmentIntensity' in this.scene) this.scene.environmentIntensity = 0.35;
      if (this.hubMode) this.scene.environment = tex;   // still in the hub when it arrives
    });
  }

  // Final-state museum: keep the completed gallery walkable and readable, but
  // turn every zone doorway into a sealed boundary so the ending cannot loop.
  // The Endless Echoes arch is the deliberate exception — it is not in
  // `this.portals`, opens *because* the ending played, and leads out to Survival
  // rather than back into a zone.
  // Idempotent because the credits button may only enter this state once, while
  // resize/pointer-lock events continue to reuse the ordinary hub APIs.
  setEpilogueMode(on = true) {
    this.epilogueMode = on;
    for (const p of this.portals) {
      if (p.vortexMesh) p.vortexMesh.visible = !on && this.hubMode && !p.locked;
      if (p.panelMat && !p.locked) p.panelMat.emissiveIntensity = on ? 0.12 : 0;
    }
  }

  // ---- walkable-hub physics (mirror the World API the PlayerController expects) ---

  // Flat gallery floor; the player's eye ends at this + CONFIG.EYE_HEIGHT.
  groundHeightAt(_x, _z) { return 0; }

  // Which gallery room (if any) this XZ point stands in. Null = the lobby or a
  // portal corridor.
  _roomAt(x, z) {
    for (const ring of this.galleries) if (ring.contains(x, z)) return ring;
    return null;
  }

  // Circle-vs-bounds test: true = blocked. The walkable region is the lobby, the
  // three gallery rooms reached through its ±X / +Z doorways, and the open portal
  // corridors past the -Z wall. Plinths and zone markers are solid.
  collidesAt(x, z, r) {
    const H = MUSEUM.ROOM_HALF;
    const d = MUSEUM.DOOR_HALF;

    if (this.soulPedestal.collidesAt(x, z, r)) return true;
    if (this.survivalPortal.collidesAt(x, z, r)) return true;
    for (const ring of this.galleries) if (ring.blocksFurniture(x, z, r)) return true;

    // Is x within some open -Z doorway's opening?
    const inOpenDoor = !this.epilogueMode &&
      this.portals.some((p) => !p.locked && Math.abs(x - p.x) < d - r);

    if (z < -H) {
      // Beyond the -Z wall: only an open corridor is walkable; everything else
      // (solid wall + the locked corridors) is blocked.
      if (!inOpenDoor) return true;
      if (z < -H - MUSEUM.HALL_LEN + r) return true;         // the portal panel / dead end
      return false;
    }

    // Past a gallery's shared wall: that room's own boundary governs. At most one
    // room can claim the point; a diagonal corner falls outside every room, and
    // whichever test runs first correctly rejects it.
    for (const ring of this.galleries) {
      if (ring.outward(x, z) > H) return ring.blocksWalls(x, z, r);
    }

    // Inside the lobby.
    if (z < -H + r && !inOpenDoor) return true;   // solid wall + locked-door barriers
    for (const ring of this.galleries) {
      if (ring.outward(x, z) > H - r && !ring.inDoorway(x, z, r)) return true;
    }
    return false;
  }

  // ---- hub API --------------------------------------------------------------

  placeSoul(zone) { return this.soulPedestal.placeSoul(zone); }
  soulPedestalDistance(pos) { return this.soulPedestal.distanceTo(pos); }
  get placedSoulCount() { return this.soulPedestal.count; }
  get allSoulsPlaced() { return this.soulPedestal.complete; }

  // Camera anchors for the ending walkthrough, in tour order (Zone 1 first).
  // Keeps MuseumEndingCutscene free of hardcoded room coordinates.
  galleryTour() {
    return this.galleries.map((ring) => Object.assign({ zone: ring.zone }, ring.tourAnchors()));
  }

  // Fill each zone's ring from `byZone` ({ zoneNumber: [artifactData] }, each list
  // in stable order). Idempotent — filled pedestals are skipped, so calling this on
  // every hub entry only cases the newly recovered pieces.
  populate(byZone) {
    for (const [zone, list] of Object.entries(byZone)) {
      const ring = this.galleryByZone[zone];
      if (ring) ring.populate(list);
    }
    this._refreshRayTargets();
  }

  _refreshRayTargets() {
    this._rayTargets.length = 0;
    for (const ring of this.galleries) ring.collectRayTargets(this._rayTargets);
  }

  // Cased artifact under the crosshair within `range` (for "press E to revisit").
  // Raycasts from the camera center against the glass shells. Also drives the aim
  // highlight. Returns { data, dist } or null.
  aimedArtifact(camera, range) {
    this._raycaster ||= new THREE.Raycaster();
    this._rayCenter ||= new THREE.Vector2(0, 0);
    this._raycaster.setFromCamera(this._rayCenter, camera);
    this._raycaster.far = range;
    const hits = this._raycaster.intersectObjects(this._rayTargets, false);
    // The old wall frames rejected through-wall hits by their outward normal; a
    // free-standing rotating cube has none, so require the pedestal to share the
    // player's room instead. Without this you could pick a Zone 1 cube through
    // the lobby's +Z wall, which is well inside INTERACT_RANGE.
    const origin = this._raycaster.ray.origin;
    const room = this._roomAt(origin.x, origin.z);
    const hit = room && hits.find((h) => h.object.userData.pedestal.room === room);
    const pedestal = hit ? hit.object.userData.pedestal : null;
    this._setAimed(pedestal);
    return pedestal ? { data: pedestal.data, dist: hit.distance } : null;
  }

  clearAim() { this._setAimed(null); }

  // Swap the highlight: settle the previous cube, lift the new one.
  _setAimed(pedestal) {
    if (this._aimed === pedestal) return;
    if (this._aimed) this._aimed.setAimed(false);
    if (pedestal) pedestal.setAimed(true);
    this._aimed = pedestal;
  }

  clear() {
    this._aimed = null;
    for (const ring of this.galleries) ring.clear();
    this._refreshRayTargets();
  }

  dispose() {
    this.clear();                 // free any pedestal-owned art mat/tex first
    this.soulPedestal.dispose();
    this.survivalPortal.dispose();
    for (const ring of this.galleries) ring.dispose();
    this.galleries.length = 0;
    this.galleryByZone = {};
    if (this._bulbInst) this._bulbInst.dispose();
    if (this._envTex) { this.scene.environment = null; this._envTex.dispose(); this._envTex = null; }
    this.track.dispose();
  }
}
