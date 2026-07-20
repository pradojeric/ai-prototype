// ============================================================
// MUSEUM — "Aking Museo", the digital gallery (reusable hub scene)
// ============================================================
// Owns a self-contained dark-gallery THREE.Scene with empty art slots and a
// warm hallway light. Knows nothing about cameras or cutscenes — the intro
// cutscene drives a camera over it, and a future hub will render it directly
// with the player walking and the frames populated by collected artifacts.
import * as THREE from 'three';
import { MUSEUM } from '../config.js';
import { createVortexMaterial } from './PortalVortex.js';

const FRAME_COLOR = 0x0a0e10;     // near-black frame border
const EMPTY_COLOR = 0x12181b;     // recessed "no art yet" interior
// Brightness multiplier on framed artwork. <1 keeps the (unlit) art below the
// scene's bloom threshold so only its highlights faintly glow instead of washing
// out. Raise toward 0xffffff for brighter art + more bloom; lower to dim it.
const ART_TINT = 0x9a9a9a;
// Same idea for the portal signs: unlit MeshBasic at full white crosses the
// bloom threshold and the lettering smears into a blob. Tinting the material
// keeps the canvas text crisp with only a faint glow, in both the dark intro
// and the bright hub. Raise toward 0xffffff for more glow.
const SIGN_TINT = 0x8f8f8f;

export class Museum {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05080a);
    this.scene.fog = new THREE.Fog(0x05080a, 6, 26);

    this.slots = [];              // { group, frameMesh, artMesh, anchor, data, zone }
    this.slotsByZone = { 1: [], 2: [], 3: [] }; // same slot objects, indexed by zone section
    this._mats = [];              // tracked for dispose()
    this._geos = [];
    this._texs = [];              // canvas textures (portal signs) tracked for dispose()
    this.hallLit = false;         // the hallway light is off until ignited

    // Three zone portals on the -Z wall (physical left -> right). Zone 1 sits in the
    // center and is the only one open; the others are locked until those zones exist.
    this.portals = [
      { x: MUSEUM.PORTAL_X[0], zone: 2, locked: true, name: 'LIKET' },
      { x: MUSEUM.PORTAL_X[1], zone: 1, locked: false, name: 'Pantal Market' },
      { x: MUSEUM.PORTAL_X[2], zone: 3, locked: true, name: 'Pananisia' },
    ];

    // The player wakes at the +Z end and the open (Zone 1) portal sits past the
    // -Z wall on the centerline. Kept > INTERACT_RANGE away from the back-wall
    // frame anchors so the hub never spawns with a frame already interactable.
    this.spawnPoint = new THREE.Vector3(0, 1.5, MUSEUM.ROOM_HALF - 2.2);
    this.hallwayPoint = new THREE.Vector3(0, 1.55, -MUSEUM.ROOM_HALF - MUSEUM.HALL_LEN + 0.5);

    this._lights();
    this._shell();
    this._frames();
    this._wings();
    this._portalSigns();
    this._pedestals();
    this._hallway();
    this._hubLights();    // built but kept off-scene until the hub visit
    this._freezeStatic(); // bake transforms — nothing built here ever moves
  }

  // Disable per-frame matrix recomputation for the whole static gallery. Only
  // light intensities and material colors mutate after construction — never a
  // transform — so we bake each local matrix once. Done per-object (not via
  // scene.matrixWorldAutoUpdate) so the player rig Game adds later, and any art
  // mesh swapped into a frame, still update normally as children of frozen parents.
  _freezeStatic() {
    const freeze = (obj) => { obj.updateMatrix(); obj.matrixAutoUpdate = false; };
    this.scene.traverse(freeze);
    this.hubGroup.traverse(freeze);   // unattached at build time; freeze its statics too
  }

  // ---- construction helpers -------------------------------------------------

  _mat(opts) {
    const m = new THREE.MeshStandardMaterial(opts);
    this._mats.push(m);
    return m;
  }

  _geo(g) { this._geos.push(g); return g; }

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

    const floor = new THREE.Mesh(this._geo(new THREE.PlaneGeometry(H * 2, H * 2)), floorMat);
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    const ceil = new THREE.Mesh(this._geo(new THREE.PlaneGeometry(H * 2, H * 2)), ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = Y;
    this.scene.add(ceil);

    // Solid walls: +Z (behind spawn) is a single plane; the ±X walls are split
    // around their wing doorways; the -Z wall is split for three portal doorways.
    // Each plane's front face must point INTO the room — single-sided geometry
    // shows nothing (the black background) from its back side.
    this._wall(wallMat, 0, Y / 2, H, H * 2, Y, Math.PI);      // +Z back wall, faces -Z
    this._sideWall(wallMat, 1);                               // +X wall, faces -X
    this._sideWall(wallMat, -1);                              // -X wall, faces +X

    this._frontWall(wallMat);
  }

  // A ±X main-room wall split around its wing doorway: solid segments on either
  // side of the opening plus a lintel above it. `side` = +1 (+X wall) or -1.
  _sideWall(wallMat, side) {
    const H = MUSEUM.ROOM_HALF, Y = MUSEUM.ROOM_HEIGHT;
    const W = MUSEUM.WING;
    const doorH = 3.0;                       // matches the portal doorway height
    const ry = side > 0 ? -Math.PI / 2 : Math.PI / 2;  // face into the room
    const x = side * H;
    const zMin = W.DOOR_Z - W.DOOR_HALF, zMax = W.DOOR_Z + W.DOOR_HALF;
    // segment from -H to the opening, lintel over it, segment to +H
    this._wall(wallMat, x, Y / 2, (-H + zMin) / 2, zMin + H, Y, ry);
    this._wall(wallMat, x, doorH + (Y - doorH) / 2, W.DOOR_Z, W.DOOR_HALF * 2, Y - doorH, ry);
    this._wall(wallMat, x, Y / 2, (zMax + H) / 2, H - zMax, Y, ry);
  }

  // The -Z wall carrying the three zone doorways: solid panels filling the gaps
  // between/around the openings, a lintel above each, and a dim barrier sealing the
  // two locked doorways. The open (Zone 1) doorway is left clear.
  _frontWall(wallMat) {
    const H = MUSEUM.ROOM_HALF, Y = MUSEUM.ROOM_HEIGHT;
    const door = MUSEUM.DOOR_HALF;
    const doorH = 3.0;                       // doorway opening height

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

  // A flat wall panel (plane) of given size, positioned + rotated about Y.
  _wall(mat, x, y, z, w, h, ry) {
    const m = new THREE.Mesh(this._geo(new THREE.PlaneGeometry(w, h)), mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    this.scene.add(m);
    return m;
  }

  // A lit signboard on each doorway lintel telling the player which zone lies
  // beyond. Open zones read "ZONE N" + district name in warm glow; locked zones
  // hide the name and read "LOCKED" dimmed until unlockPortal() reveals them.
  _portalSigns() {
    const H = MUSEUM.ROOM_HALF, Y = MUSEUM.ROOM_HEIGHT;
    const doorH = 3.0;                       // matches the doorway opening height in _frontWall
    const signW = 2.4, signH = 0.75;         // 3.2:1 ratio == the sign canvas aspect
    const y = doorH + (Y - doorH) / 2;       // centered on the lintel above the opening
    const geo = this._geo(new THREE.PlaneGeometry(signW, signH));

    for (const p of this.portals) {
      // Unlit (MeshBasic) so the lettering stays legible regardless of room
      // lighting and reads as a glowing sign once bloom runs.
      const mat = new THREE.MeshBasicMaterial({
        map: this._signTexture(p.zone, p.name, p.locked),
        color: SIGN_TINT,
        transparent: true,
        depthWrite: false,
      });
      this._mats.push(mat);
      const sign = new THREE.Mesh(geo, mat);  // default +Z normal faces into the room
      sign.position.set(p.x, y, -H + 0.06);   // just in front of the lintel plane
      this.scene.add(sign);
      p.signMesh = sign;
      p.signMat = mat;
    }
  }

  // Render a two-line portal sign to a canvas and return it as a texture. Open
  // signs glow warm amber (matching the artifact/hall palette); locked signs are
  // muted and say "LOCKED" in place of the hidden district name.
  _signTexture(zone, name, locked) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 160;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const accent = locked ? '#7c8b93' : '#ffe6b0';
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = locked ? 0 : 18;
    ctx.font = 'bold 64px Georgia, serif';
    ctx.fillText(`ZONE ${zone}`, c.width / 2, 54);

    ctx.shadowBlur = locked ? 0 : 10;
    ctx.fillStyle = locked ? '#9c6b6b' : '#d3e8ec';
    ctx.font = locked ? 'bold 40px Georgia, serif' : '38px Georgia, serif';
    ctx.fillText(locked ? 'LOCKED' : name, c.width / 2, 120);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    this._texs.push(tex);
    return tex;
  }

  _frames() {
    const H = MUSEUM.ROOM_HALF;
    const y = 2.0;
    // Main room = Zone 1's section: 12 empty frames across the three portal-free
    // walls, filled per-zone in discovery order (see populate). Four across the
    // +Z back wall; four on each ±X wall placed clear of the wing doorway
    // (opening z ∈ [WING.DOOR_Z ± WING.DOOR_HALF] = [0.8, 3.2] at frame width 1.5).
    for (const s of [-6.75, -2.25, 2.25, 6.75]) {
      this._addSlot(s, y, H - 0.04, Math.PI, 1);                // +Z back wall
    }
    for (const s of [-7.5, -4.5, -1.5, 6.0]) {
      this._addSlot(H - 0.04, y, s, -Math.PI / 2, 1);           // +X wall
      this._addSlot(-H + 0.04, y, s, Math.PI / 2, 1);           // -X wall
    }
  }

  // The two wing galleries (Zone 2 = -X, Zone 3 = +X): a rectangular room past
  // the ±X wall's wing doorway, its own frame slots, and a zone sign over the
  // doorway on the main-room side. Wings share the room shell materials so
  // setHubLighting repaints them along with the main gallery.
  _wings() {
    this._wing(-1, 2);
    this._wing(1, 3);
  }

  _wing(side, zone) {
    const H = MUSEUM.ROOM_HALF, Y = MUSEUM.ROOM_HEIGHT;
    const W = MUSEUM.WING;
    const doorH = 3.0;
    const zMin = W.DOOR_Z - W.HALF_W, zMax = W.DOOR_Z + W.HALF_W;
    const cx = side * (H + W.LEN / 2);       // wing center x
    const far = side * (H + W.LEN);          // far wall plane

    // Shell — floor, ceiling, far wall, two long walls, and the near-wall panels
    // that close the plane x=±H as seen FROM the wing (the main room's wall
    // planes are single-sided and invisible from behind).
    const floor = new THREE.Mesh(this._geo(new THREE.PlaneGeometry(W.LEN, W.HALF_W * 2)), this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cx, 0, W.DOOR_Z);
    this.scene.add(floor);
    const ceil = new THREE.Mesh(this._geo(new THREE.PlaneGeometry(W.LEN, W.HALF_W * 2)), this.ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(cx, Y, W.DOOR_Z);
    this.scene.add(ceil);

    const inward = side > 0 ? -Math.PI / 2 : Math.PI / 2;   // faces back toward the room
    const outward = side > 0 ? Math.PI / 2 : -Math.PI / 2;  // faces into the wing
    this._wall(this.wallMat, far, Y / 2, W.DOOR_Z, W.HALF_W * 2, Y, inward);  // far wall
    this._wall(this.wallMat, cx, Y / 2, zMin, W.LEN, Y, 0);                   // -z long wall, faces +Z
    this._wall(this.wallMat, cx, Y / 2, zMax, W.LEN, Y, Math.PI);             // +z long wall, faces -Z
    // near-wall panels around the doorway, facing into the wing
    const dMin = W.DOOR_Z - W.DOOR_HALF, dMax = W.DOOR_Z + W.DOOR_HALF;
    this._wall(this.wallMat, side * H, Y / 2, (zMin + dMin) / 2, dMin - zMin, Y, outward);
    this._wall(this.wallMat, side * H, doorH + (Y - doorH) / 2, W.DOOR_Z, W.DOOR_HALF * 2, Y - doorH, outward);
    this._wall(this.wallMat, side * H, Y / 2, (dMax + zMax) / 2, zMax - dMax, Y, outward);

    // 12 frames: five down each long wall, two on the far wall.
    const y = 2.0;
    for (const off of [1.8, 3.9, 6.0, 8.1, 10.2]) {
      const fx = side * (H + off);
      this._addSlot(fx, y, zMin + 0.04, 0, zone);              // -z wall, faces +Z
      this._addSlot(fx, y, zMax - 0.04, Math.PI, zone);        // +z wall, faces -Z
    }
    for (const dz of [-1.75, 1.75]) {
      this._addSlot(far - side * 0.04, y, W.DOOR_Z + dz, inward, zone);
    }

    // Zone sign over the doorway lintel on the main-room side; tracked on the
    // matching portal so unlockPortal can reveal the district name here too.
    const p = this.portals.find((pp) => pp.zone === zone);
    const mat = new THREE.MeshBasicMaterial({
      map: this._signTexture(zone, p ? p.name : '???', p ? p.locked : true),
      color: SIGN_TINT,
      transparent: true,
      depthWrite: false,
    });
    this._mats.push(mat);
    const sign = new THREE.Mesh(this._geo(new THREE.PlaneGeometry(2.4, 0.75)), mat);
    sign.position.set(side * (H - 0.06), doorH + (Y - doorH) / 2, W.DOOR_Z);
    sign.rotation.y = inward;
    this.scene.add(sign);
    if (p) p.wingSignMat = mat;
  }

  // One empty frame: a border box with a recessed dark interior. The interior
  // mesh is where collected art will later be swapped in (see _setSlot).
  _addSlot(x, y, z, ry, zone) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = ry;

    const w = 1.5, h = 1.9, d = 0.12;
    // All 36 frames are identical — share one material/geometry set across every
    // slot (perf: fewer GPU state changes; before this each slot built its own).
    this._frameMat ||= this._mat({ color: FRAME_COLOR, roughness: 0.6, metalness: 0.3 });
    this._frameGeo ||= this._geo(new THREE.BoxGeometry(w, h, d));
    this._emptyMat ||= this._mat({ color: EMPTY_COLOR, roughness: 1 });
    this._emptyGeo ||= this._geo(new THREE.PlaneGeometry(w - 0.22, h - 0.22));

    const frameMesh = new THREE.Mesh(this._frameGeo, this._frameMat);
    group.add(frameMesh);

    const empty = new THREE.Mesh(this._emptyGeo, this._emptyMat);
    empty.position.z = d / 2 + 0.001;
    group.add(empty);

    this.scene.add(group);
    // anchor = point just in front of the frame (camera/player look target)
    const anchor = new THREE.Vector3(x, y, z).add(
      new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry)).multiplyScalar(0.4),
    );
    const slot = { group, frameMesh, artMesh: null, anchor, data: null, zone };
    this.slots.push(slot);
    (this.slotsByZone[zone] ||= []).push(slot);
  }

  _pedestals() {
    // Kept on `this` so setHubLighting can repaint it into a light plinth — the
    // dark intro color reads as a black void in the bright gallery otherwise.
    const pedMat = this.pedMat = this._mat({ color: 0x303b41, roughness: 0.9 });
    // Kept clear of the x=0 centerline so nothing blocks the walk to the light.
    // Stored on `this` so collidesAt() blocks the same boxes the meshes occupy.
    this.pedestalSpots = [[-4.5, -1.0], [4.5, -1.0], [-5.5, 3.5], [5.5, 3.5]];
    this.pedestalHalf = 0.35;                 // half the 0.7 box footprint
    for (const [px, pz] of this.pedestalSpots) {
      const ped = new THREE.Mesh(this._geo(new THREE.BoxGeometry(0.7, 1.0, 0.7)), pedMat);
      ped.position.set(px, 0.5, pz);
      this.scene.add(ped);
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
        mat = this.hallPanelMat = new THREE.MeshStandardMaterial({
          color: 0x000000,
          emissive: new THREE.Color(MUSEUM.HALL_LIGHT_COLOR),
          emissiveIntensity: 0,                // dark until the light appears
        });
        this._mats.push(this.hallPanelMat);
      }
      const panel = new THREE.Mesh(panelGeo, mat);
      panel.position.set(p.x, Y / 2, -H - len + 0.03);   // sit just in front of the back wall
      this.scene.add(panel);

      // Swirling blue vortex overlaying the panel — hidden until the walkable
      // hub (setHubLighting) reveals it on open portals. One shared shader
      // material (single uTime); the intro keeps the plain warm/cold panels.
      this._vortexMat ||= (() => {
        const vm = createVortexMaterial((d * 2 + 0.4) / Y);
        this._mats.push(vm);
        return vm;
      })();
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

  // Bright-gallery lighting for the walkable hub. Built into an UNATTACHED group
  // so it contributes nothing until setHubLighting(true) adds it (keeping the
  // intro dark).
  //
  // PERF: forward rendering evaluates EVERY light for EVERY fragment, so light
  // count is the hub's frame-rate budget. The old per-frame picture SpotLights
  // (one per slot = 36 after the wings) tanked it. Instead the gallery is carried
  // by three fill lights + a few distance-limited hanging PointLights, and the
  // per-frame "picture light" is purely cosmetic: an emissive bulb (no light)
  // drawn as ONE InstancedMesh for all slots — a single draw call, zero shading cost.
  _hubLights() {
    const g = this.hubGroup = new THREE.Group();

    // Base fill does the real lighting work now that the picture spots are gone:
    // warm-tinted key + hemisphere read as gallery lighting without per-fragment cost.
    g.add(new THREE.AmbientLight(0xffffff, 0.75));
    g.add(new THREE.HemisphereLight(0xf3f7ff, 0x3a4046, 0.65));
    const key = new THREE.DirectionalLight(0xfff4e0, 0.7);
    key.position.set(0, 8, 3);
    g.add(key);

    // Kept modest so the lamps don't bloom into the whole ceiling once the
    // composer's ACES + bloom run (the bulbs sit well above the bloom threshold).
    const bulbMat = this._mat({ color: 0x000000, emissive: 0xfff2d8, emissiveIntensity: 1.4 });
    const bulbGeo = this._geo(new THREE.SphereGeometry(0.07, 12, 12));
    const cordMat = this._mat({ color: 0x0c0f10, roughness: 1 });

    // Cosmetic picture bulb above each frame — one instanced draw, no light source.
    const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, this.slots.length);
    const m = new THREE.Matrix4();
    this.slots.forEach((slot, i) => {
      const p = slot.group.position;
      const ry = slot.group.rotation.y;
      m.makeTranslation(p.x + Math.sin(ry) * 0.35, p.y + 1.0, p.z + Math.cos(ry) * 0.35);
      bulbs.setMatrixAt(i, m);
    });
    bulbs.instanceMatrix.needsUpdate = true;
    g.add(bulbs);
    this._bulbInst = bulbs;       // dispose() frees its instance buffer

    // Hanging warm bulbs for ambience + bloom: down the main-room centerline,
    // plus two along each wing's centerline.
    const hangs = [[0, -6], [0, -2], [0, 2], [0, 6]];
    const H = MUSEUM.ROOM_HALF, W = MUSEUM.WING;
    for (const side of [-1, 1]) {
      hangs.push([side * (H + W.LEN * 0.3), W.DOOR_Z]);
      hangs.push([side * (H + W.LEN * 0.7), W.DOOR_Z]);
    }
    for (const [cx, cz] of hangs) {
      const y = MUSEUM.ROOM_HEIGHT - 0.5;
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(cx, y, cz);
      g.add(bulb);
      const cord = new THREE.Mesh(this._geo(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6)), cordMat);
      cord.position.set(cx, y + 0.25, cz);
      g.add(cord);
      const pl = new THREE.PointLight(0xffe6c0, 1.6, 12, 1.6);
      pl.position.set(cx, y, cz);
      g.add(pl);
    }
  }

  // ---- per-frame ------------------------------------------------------------

  update(dt, t) {
    if (this.hubMode) {
      // Hub: the vortices carry the portal look — just spin them.
      if (this._vortexMat) this._vortexMat.uniforms.uTime.value = t;
      return;
    }
    // Intro: once lit, breathe each open portal's emissive panel so the glow
    // feels alive. Unlit panels (still-locked corridors) stay at their dim glow.
    for (const p of this.portals) {
      if (p.lit && p.panelMat) p.panelMat.emissiveIntensity = 1.6 + Math.sin(t * 1.7) * 0.2;
    }
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
    // Repaint the lintel signs (portal doorway + this zone's wing doorway):
    // drop "LOCKED", reveal the district name in glow.
    for (const mat of [p.signMat, p.wingSignMat]) {
      if (!mat) continue;
      const old = mat.map;
      mat.map = this._signTexture(p.zone, p.name, false);
      mat.needsUpdate = true;
      if (old) { old.dispose(); this._texs = this._texs.filter((t) => t !== old); }
    }
  }

  // Brighten the gallery for the walkable hub: attach the hub light group and
  // repaint the dark intro materials into a clean white gallery. Instant (the
  // white fade in Game._enterMuseum hides the change). Only ever called after
  // the intro, so mutating the shared room materials here is safe.
  setHubLighting(on) {
    this.hubMode = on;
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
      this.pedMat.color.setHex(0x6a7074);
      this.ambient.intensity = 0.3;    // hubGroup dominates — keep the base fill low
      this.hemi.intensity = 0.25;
    } else if (this.hubGroup.parent === this.scene) {
      this.scene.remove(this.hubGroup);
      this.floorMat.color.setHex(0x60717d);
      this.wallMat.color.setHex(0x7e959e);
      this.ceilMat.color.setHex(0x4e6068);
      this.pedMat.color.setHex(0x303b41);
      this.ambient.intensity = 3.0;    // restore the lightly-lit intro base fill
      this.hemi.intensity = 0.15;
    }
  }

  // Final-state museum: keep the completed gallery walkable and readable, but
  // turn every zone doorway into a sealed boundary so the ending cannot loop.
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

  // Circle-vs-bounds test: true = blocked. The walkable region is the gallery
  // rectangle plus the open (Zone 1) corridor reached through the center doorway;
  // the locked doorways are sealed at the wall plane. Pedestals are solid boxes.
  // Mirrors World.collidesAt's circle-vs-AABB feel.
  collidesAt(x, z, r) {
    const H = MUSEUM.ROOM_HALF;
    const d = MUSEUM.DOOR_HALF;

    // Solid pedestals (inflate the box footprint by the player's radius).
    if (this.pedestalSpots) {
      const reach = this.pedestalHalf + r;
      for (const [px, pz] of this.pedestalSpots) {
        if (Math.abs(x - px) < reach && Math.abs(z - pz) < reach) return true;
      }
    }

    // Is x within some open doorway's opening?
    const inOpenDoor = !this.epilogueMode &&
      this.portals.some((p) => !p.locked && Math.abs(x - p.x) < d - r);

    if (z < -H) {
      // Beyond the -Z wall: only an open corridor is walkable; everything else
      // (solid wall + the locked corridors) is blocked.
      if (!inOpenDoor) return true;
      if (z < -H - MUSEUM.HALL_LEN + r) return true;         // the portal panel / dead end
      return false;
    }

    // Is z within a wing doorway's opening on the ±X walls? (Both wings share
    // the same doorway z-span; wings are always walkable — locked zones only
    // seal their -Z portal, not their gallery wing.)
    const W = MUSEUM.WING;
    const inWingDoor = Math.abs(z - W.DOOR_Z) < W.DOOR_HALF - r;

    if (Math.abs(x) > H) {
      // Beyond a ±X wall: only the wing rectangle is walkable.
      if (Math.abs(x) > H + W.LEN - r) return true;          // wing far wall
      if (Math.abs(z - W.DOOR_Z) > W.HALF_W - r) return true; // wing long walls
      if (Math.abs(x) < H + r && !inWingDoor) return true;    // near-wall panels around the doorway
      return false;
    }

    // Inside the gallery room.
    if (z > H - r) return true;                              // +Z wall
    if (Math.abs(x) > H - r && !inWingDoor) return true;     // ±X walls minus wing doorways
    if (z < -H + r && !inOpenDoor) return true;              // solid wall + locked-door barriers
    return false;
  }

  // ---- hub API (stubbed for the intro; used when the museum becomes a hub) ---

  // Swap a glowing art plane into an empty frame slot.
  _setSlot(slot, data) {
    if (!slot || slot.artMesh) return;
    // Art resources are owned by the slot (not the global _geos/_mats pools) so
    // clear() can fully free them on every hub repopulate without leaking or
    // double-disposing — see clear()/dispose().
    // Art material is owned by the slot (not the global _geos/_mats pools) so
    // clear() can fully free it on every hub repopulate without leaking or
    // double-disposing — see clear()/dispose().
    let mat;
    if (data && data.image) {
      // Unlit artwork: MeshBasicMaterial shows the PNG at its true colors,
      // immune to the gallery lighting. Because the scene runs a low-threshold
      // bloom pass (for the string glow), a full-brightness image would blow out
      // (see the white-washed frame bug). ART_TINT dims the texture just enough
      // that only its brightest highlights cross the bloom threshold — yielding a
      // FAINT glow instead of a wash. Lower ART_TINT = dimmer art + less glow.
      this._texLoader ||= new THREE.TextureLoader();
      const tex = this._texLoader.load(data.image);
      tex.colorSpace = THREE.SRGBColorSpace;
      mat = new THREE.MeshBasicMaterial({ map: tex, color: ART_TINT, toneMapped: true });
      slot.artTex = tex;
    } else {
      // No artwork (shouldn't happen in practice): fall back to the old glowing panel.
      mat = new THREE.MeshStandardMaterial({
        color: 0x2a4f52,
        emissive: new THREE.Color(0xffe6b0),
        emissiveIntensity: 0.6,
        roughness: 0.5,
      });
    }
    // Shared art-plane geometry (pooled in _geos; clear() only frees the per-slot
    // material/texture). Materials stay per-slot — each holds its own artwork map.
    this._artGeo ||= this._geo(new THREE.PlaneGeometry(1.18, 1.58));
    const art = new THREE.Mesh(this._artGeo, mat);
    art.position.z = 0.08;
    slot.group.add(art);
    slot.artMesh = art;
    slot.data = data;
  }

  // Fill each zone section's slots from `byZone` ({ zoneNumber: [artifactData] },
  // each list in stable order). Idempotent — filled slots are skipped, so calling
  // this on every hub entry only hangs the newly collected pieces.
  populate(byZone) {
    for (const [zone, list] of Object.entries(byZone)) {
      const slots = this.slotsByZone[zone] || [];
      list.forEach((data, i) => this._setSlot(slots[i], data));
    }
  }

  // Nearest hung-artwork slot within `range` of `pos` (for "press E to revisit").
  // Returns { data, dist } or null. Measured to the frame's in-front anchor.
  nearestArtifact(pos, range) {
    let best = null, bestDist = range;
    for (const slot of this.slots) {
      if (!slot.data) continue;
      const d = pos.distanceTo(slot.anchor);
      if (d < bestDist) { bestDist = d; best = slot; }
    }
    return best ? { data: best.data, dist: bestDist } : null;
  }

  clear() {
    for (const slot of this.slots) {
      if (slot.artMesh) {
        slot.group.remove(slot.artMesh);
        // geometry is the shared pooled _artGeo — only the per-slot mat/tex is freed
        slot.artMesh.material.dispose();
        if (slot.artTex) { slot.artTex.dispose(); slot.artTex = null; }
        slot.artMesh = null;
        slot.data = null;
      }
    }
  }

  dispose() {
    this.clear();                 // free any slot-owned art mat/tex first
    if (this._bulbInst) this._bulbInst.dispose();
    for (const g of this._geos) g.dispose();
    for (const m of this._mats) m.dispose();
    for (const t of this._texs) t.dispose();
    this._geos.length = 0;
    this._mats.length = 0;
    this._texs.length = 0;
  }
}
