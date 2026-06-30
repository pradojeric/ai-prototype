// ============================================================
// MUSEUM — "Aking Museo", the digital gallery (reusable hub scene)
// ============================================================
// Owns a self-contained dark-gallery THREE.Scene with empty art slots and a
// warm hallway light. Knows nothing about cameras or cutscenes — the intro
// cutscene drives a camera over it, and a future hub will render it directly
// with the player walking and the frames populated by collected artifacts.
import * as THREE from 'three';
import { MUSEUM } from '../config.js';

const FRAME_COLOR = 0x0a0e10;     // near-black frame border
const EMPTY_COLOR = 0x12181b;     // recessed "no art yet" interior
// Brightness multiplier on framed artwork. <1 keeps the (unlit) art below the
// scene's bloom threshold so only its highlights faintly glow instead of washing
// out. Raise toward 0xffffff for brighter art + more bloom; lower to dim it.
const ART_TINT = 0x9a9a9a;

export class Museum {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05080a);
    this.scene.fog = new THREE.Fog(0x05080a, 6, 26);

    this.slots = [];              // { group, frameMesh, artMesh, anchor, data }
    this._mats = [];              // tracked for dispose()
    this._geos = [];
    this._texs = [];              // canvas textures (portal signs) tracked for dispose()
    this.hallLit = false;         // the hallway light is off until ignited

    // Three zone portals on the -Z wall (physical left -> right). Zone 1 sits in the
    // center and is the only one open; the others are locked until those zones exist.
    this.portals = [
      { x: MUSEUM.PORTAL_X[0], zone: 2, locked: true, name: '???' },
      { x: MUSEUM.PORTAL_X[1], zone: 1, locked: false, name: 'Pantal Market' },
      { x: MUSEUM.PORTAL_X[2], zone: 3, locked: true, name: '???' },
    ];

    // The player wakes at the +Z end and the open (Zone 1) portal sits past the
    // -Z wall on the centerline.
    this.spawnPoint = new THREE.Vector3(0, 1.5, MUSEUM.ROOM_HALF - 1.6);
    this.hallwayPoint = new THREE.Vector3(0, 1.55, -MUSEUM.ROOM_HALF - MUSEUM.HALL_LEN + 0.5);

    this._lights();
    this._shell();
    this._frames();
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

    // Solid walls: +Z (behind spawn), +X, -X. The -Z wall is split for three
    // doorways. Each plane's front face must point INTO the room — single-sided
    // geometry shows nothing (the black background) from its back side.
    this._wall(wallMat, 0, Y / 2, H, H * 2, Y, Math.PI);      // +Z back wall, faces -Z
    this._wall(wallMat, H, Y / 2, 0, H * 2, Y, -Math.PI / 2); // +X wall, faces -X
    this._wall(wallMat, -H, Y / 2, 0, H * 2, Y, Math.PI / 2); // -X wall, faces +X

    this._frontWall(wallMat);
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
    // Nine empty frames spread evenly across the three doorway-free walls (the -Z
    // wall is full of portals), each facing inward and filled in discovery order.
    const placements = [];
    for (const s of [-5, 0, 5]) {
      placements.push({ x: s, z: H - 0.04, ry: Math.PI });      // +Z back wall
      placements.push({ x: H - 0.04, z: s, ry: -Math.PI / 2 }); // +X wall
      placements.push({ x: -H + 0.04, z: s, ry: Math.PI / 2 });  // -X wall
    }
    for (const p of placements) this._addSlot(p.x, y, p.z, p.ry);
  }

  // One empty frame: a border box with a recessed dark interior. The interior
  // mesh is where collected art will later be swapped in (see setArtifact).
  _addSlot(x, y, z, ry) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = ry;

    const w = 1.5, h = 1.9, d = 0.12;
    const frameMat = this._mat({ color: FRAME_COLOR, roughness: 0.6, metalness: 0.3 });
    const frameMesh = new THREE.Mesh(this._geo(new THREE.BoxGeometry(w, h, d)), frameMat);
    group.add(frameMesh);

    const emptyMat = this._mat({ color: EMPTY_COLOR, roughness: 1 });
    const empty = new THREE.Mesh(this._geo(new THREE.PlaneGeometry(w - 0.22, h - 0.22)), emptyMat);
    empty.position.z = d / 2 + 0.001;
    group.add(empty);

    this.scene.add(group);
    // anchor = point just in front of the frame (camera/player look target)
    const anchor = new THREE.Vector3(x, y, z).add(
      new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry)).multiplyScalar(0.4),
    );
    this.slots.push({ group, frameMesh, artMesh: null, anchor, data: null });
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

      // Per-portal handles used by the hub: the panel material (lit/breathed when
      // open), the corridor-end point Game detects to enter the zone, and a lit flag.
      p.panelMat = mat;
      p.entry = new THREE.Vector3(p.x, 1.55, -H - len + 0.6);
      p.lit = false;
      if (!p.locked) this.hallPortal = p;    // the open (Zone 1) corridor — the intro's hall light
    }
  }

  // Bright-gallery lighting for the walkable hub: a picture light over every
  // frame plus a few hanging ceiling bulbs. Built into an UNATTACHED group so it
  // contributes nothing until setHubLighting(true) adds it (keeping the intro dark).
  _hubLights() {
    const g = this.hubGroup = new THREE.Group();

    // Clean base fill — kept moderate so the gallery reads as softly lit rather
    // than washed out (the picture lights + lamps add the highlights on top).
    g.add(new THREE.AmbientLight(0xffffff, 0.5));
    g.add(new THREE.HemisphereLight(0xf3f7ff, 0x3a4046, 0.5));
    const key = new THREE.DirectionalLight(0xffffff, 0.5);
    key.position.set(0, 8, 3);
    g.add(key);

    // Kept modest so the lamps don't bloom into the whole ceiling once the
    // composer's ACES + bloom run (the bulbs sit well above the bloom threshold).
    const bulbMat = this._mat({ color: 0x000000, emissive: 0xfff2d8, emissiveIntensity: 1.4 });
    const bulbGeo = this._geo(new THREE.SphereGeometry(0.07, 12, 12));
    const cordMat = this._mat({ color: 0x0c0f10, roughness: 1 });

    // Picture light: a small bulb above each frame, aimed down at it.
    for (const slot of this.slots) {
      const p = slot.group.position;
      const ry = slot.group.rotation.y;
      const dx = Math.sin(ry), dz = Math.cos(ry);          // inward facing dir
      const bx = p.x + dx * 0.35, by = p.y + 1.0, bz = p.z + dz * 0.35;

      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(bx, by, bz);
      g.add(bulb);

      const spot = new THREE.SpotLight(0xfff4e0, 7, 7, Math.PI / 5, 0.55, 1.2);
      spot.position.set(bx, by, bz);
      spot.target.position.set(p.x, p.y - 0.35, p.z);
      g.add(spot);
      g.add(spot.target);
    }

    // Hanging warm bulbs down the centerline for ambience + bloom.
    for (const cz of [-6, -2, 2, 6]) {
      const y = MUSEUM.ROOM_HEIGHT - 0.5;
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(0, y, cz);
      g.add(bulb);
      const cord = new THREE.Mesh(this._geo(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6)), cordMat);
      cord.position.set(0, y + 0.25, cz);
      g.add(cord);
      const pl = new THREE.PointLight(0xffe6c0, 1.6, 12, 1.6);
      pl.position.set(0, y, cz);
      g.add(pl);
    }
  }

  // ---- per-frame ------------------------------------------------------------

  update(dt, t) {
    // Once lit, breathe each open portal's emissive panel so the glow feels alive.
    // Unlit panels (still-locked corridors) stay at their static dim glow.
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
    // Repaint the lintel sign: drop "LOCKED", reveal the district name in glow.
    if (p.signMat) {
      const old = p.signMat.map;
      p.signMat.map = this._signTexture(p.zone, p.name, false);
      p.signMat.needsUpdate = true;
      if (old) { old.dispose(); this._texs = this._texs.filter((t) => t !== old); }
    }
  }

  // Brighten the gallery for the walkable hub: attach the hub light group and
  // repaint the dark intro materials into a clean white gallery. Instant (the
  // white fade in Game._enterMuseum hides the change). Only ever called after
  // the intro, so mutating the shared room materials here is safe.
  setHubLighting(on) {
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
    const inOpenDoor = this.portals.some((p) => !p.locked && Math.abs(x - p.x) < d - r);

    if (z < -H) {
      // Beyond the -Z wall: only an open corridor is walkable; everything else
      // (solid wall + the locked corridors) is blocked.
      if (!inOpenDoor) return true;
      if (z < -H - MUSEUM.HALL_LEN + r) return true;         // the portal panel / dead end
      return false;
    }

    // Inside the gallery room.
    if (Math.abs(x) > H - r || z > H - r) return true;       // +X/-X/+Z walls
    if (z < -H + r && !inOpenDoor) return true;              // solid wall + locked-door barriers
    return false;
  }

  // ---- hub API (stubbed for the intro; used when the museum becomes a hub) ---

  // Swap a glowing art plane into an empty frame slot.
  setArtifact(slotIndex, data) {
    const slot = this.slots[slotIndex];
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
    const art = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 1.58), mat);
    art.position.z = 0.08;
    slot.group.add(art);
    slot.artMesh = art;
    slot.data = data;
  }

  // Fill slots from a list of collected artifacts (order = discovery order).
  populate(collected) {
    collected.forEach((data, i) => this.setArtifact(i, data));
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
        slot.artMesh.geometry.dispose();
        slot.artMesh.material.dispose();
        if (slot.artTex) { slot.artTex.dispose(); slot.artTex = null; }
        slot.artMesh = null;
        slot.data = null;
      }
    }
  }

  dispose() {
    this.clear();                 // free any slot-owned art geo/mat first
    for (const g of this._geos) g.dispose();
    for (const m of this._mats) m.dispose();
    for (const t of this._texs) t.dispose();
    this._geos.length = 0;
    this._mats.length = 0;
    this._texs.length = 0;
  }
}
