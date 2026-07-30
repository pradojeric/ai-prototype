// ============================================================
// GALLERY RING — one zone's own room, with its artifacts on a ring of pedestals
// ============================================================
// Every zone keeps its collection in a dedicated room off the lobby, entered
// through a doorway cut into one lobby wall. Inside, one pedestal per artifact
// that zone actually has stands on an ellipse fitted to the room, around a low
// brass zone marker. Nothing here knows about the lobby beyond the wall it
// shares with it — Museum places the rooms and owns the shared materials.
//
// Room maths is done in a local (u, v) frame: `u` runs outward from the lobby
// wall, `v` across it. That way one implementation serves the -X, +X and +Z
// rooms without three sets of sign flips.
import * as THREE from 'three';
import { MUSEUM } from '../../config.js';
import { ArtifactPedestal } from './ArtifactPedestal.js';
import {
  Tracker, tilePlane, wall, loadTextureSet, applyTextureSet, signTexture,
} from './RoomShell.js';

const SIGN_TINT = 0x8f8f8f;   // keeps canvas lettering under the bloom threshold

// `count` angles around an ellipse spaced by equal ARC LENGTH. Stepping the angle
// uniformly instead would bunch pedestals at the ellipse's ends — at the long-axis
// tips the spacing collapses to Δθ·RING_SHORT, which for Zone 1's eleven leaves a
// gap the player cannot walk through. Integrating once at build time is free.
function ellipseAngles(count, a, b) {
  const STEPS = 720;
  const step = (Math.PI * 2) / STEPS;
  const arc = new Float64Array(STEPS + 1);
  for (let i = 1; i <= STEPS; i++) {
    const t = (i - 0.5) * step;               // midpoint rule
    arc[i] = arc[i - 1] + Math.hypot(a * Math.sin(t), b * Math.cos(t)) * step;
  }
  const total = arc[STEPS];
  const out = [];
  let j = 0;
  for (let k = 0; k < count; k++) {
    const target = (k / count) * total;
    while (j < STEPS - 1 && arc[j + 1] < target) j++;
    const span = arc[j + 1] - arc[j] || 1;
    out.push((j + (target - arc[j]) / span) * step);
  }
  return out;
}

// Geometry and materials shared by every pedestal in the museum — built once so
// all 27 plinths cost one GPU state. Owned by Museum, handed down to each ring.
export function createPedestalKit(tracker, texLoader) {
  const G = MUSEUM.GALLERY;

  // Pale veined marble against the museum's darker marble floor, so a plinth
  // never disappears into the ground it stands on.
  const plinthMat = applyTextureSet(
    tracker.mat(new THREE.MeshStandardMaterial({ color: 0xb9c0c4, roughness: 0.55, metalness: 0.05 })),
    loadTextureSet(texLoader, 'marble-pale', tracker),
    { repeat: 2 },
  );
  // The brass set is a neutral aged metal; the warm tint is the material colour,
  // as everywhere else in this scene.
  const brassMat = applyTextureSet(
    tracker.mat(new THREE.MeshStandardMaterial({ color: 0xc9a463, roughness: 0.45, metalness: 0.9 })),
    loadTextureSet(texLoader, 'brass', tracker),
    { repeat: 3, envMapIntensity: 1.0 },
  );

  const cubeGeo = tracker.geo(new THREE.BoxGeometry(0.46, 0.46, 0.46));
  return {
    texLoader,
    plinthMat,
    brassMat,
    plinthGeo: tracker.geo(new THREE.CylinderGeometry(0.3, 0.36, G.PLINTH_H, 16)),
    capGeo: tracker.geo(new THREE.TorusGeometry(0.3, 0.028, 8, 28)),
    socketGeo: tracker.geo(new THREE.CylinderGeometry(0.22, 0.26, 0.06, 16)),
    cubeGeo,
    edgeGeo: tracker.geo(new THREE.EdgesGeometry(cubeGeo)),
    artGeo: tracker.geo(new THREE.PlaneGeometry(0.34, 0.34)),
    markerGeo: tracker.geo(new THREE.CylinderGeometry(G.MARKER_R, G.MARKER_R + 0.06, G.MARKER_H, 24)),
    medallionGeo: tracker.geo(new THREE.CircleGeometry(G.MARKER_R - 0.1, 32)),
    plaqueGeo: tracker.geo(new THREE.PlaneGeometry(0.96, 0.3)),
  };
}

export class GalleryRing {
  // `room` is one MUSEUM.GALLERY.ROOMS entry; `count` comes from ARTIFACT_DATA,
  // so the ring always has exactly as many pedestals as the zone has memories.
  constructor({ scene, room, zone, name, locked, count, accent, shellMats, kit }) {
    this.zone = zone;
    this.axis = room.axis;
    this.dir = room.dir;
    this.cross = room.cross;
    this.tracker = new Tracker();
    this.pedestals = [];

    this.group = new THREE.Group();
    scene.add(this.group);

    // Per-ring accent outline on the glass cubes, in this zone's soul colour.
    this._kit = Object.assign({}, kit, {
      edgeMat: this.tracker.mat(new THREE.LineBasicMaterial({
        color: accent, transparent: true, opacity: 0.5, toneMapped: false,
      })),
    });

    this._shell(shellMats);
    this._lobbyWall(shellMats.wallMat, name, locked);
    this._marker(name, locked);
    this._ring(count, accent);
  }

  // ---- local frame ----------------------------------------------------------
  // u = distance outward from the lobby wall this room opens through
  // v = position across that wall (a world x or z, unmirrored)

  _world(u, v) {
    return this.axis === 'x'
      ? { x: this.dir * u, z: v }
      : { x: v, z: this.dir * u };
  }

  // Y-rotation that points a plane's front face along the local direction (du, dv).
  // _world maps a local vector to world the same way it maps a local point, and a
  // PlaneGeometry's normal is +Z, so atan2(nx, nz) aims it.
  _facing(du, dv) {
    const n = this._world(du, dv);
    return Math.atan2(n.x, n.z);
  }

  outward(x, z) { return this.dir * (this.axis === 'x' ? x : z); }
  across(x, z) { return this.axis === 'x' ? z : x; }

  // Is this XZ point in this room — or standing in its doorway, which has the same
  // clear line of sight in? Used to reject crosshair hits that would otherwise
  // reach a cube through a shared wall.
  contains(x, z) {
    const G = MUSEUM.GALLERY;
    const u = this.outward(x, z);
    const dv = Math.abs(this.across(x, z) - this.cross);
    if (u > MUSEUM.ROOM_HALF + G.LEN) return false;
    if (u > MUSEUM.ROOM_HALF) return dv < G.HALF_W;
    return u > MUSEUM.ROOM_HALF - 1 && dv < G.DOOR_HALF;
  }

  // ---- construction ---------------------------------------------------------

  _shell({ floorMat, ceilMat, wallMat }) {
    const G = MUSEUM.GALLERY;
    const H = MUSEUM.ROOM_HALF, Y = MUSEUM.ROOM_HEIGHT;
    const mid = this._world(H + G.LEN / 2, this.cross);
    // Floor/ceiling planes lie in XZ, so their width/height follow world axes
    // rather than the local frame.
    const [fw, fh] = this.axis === 'x' ? [G.LEN, G.HALF_W * 2] : [G.HALF_W * 2, G.LEN];

    for (const [y, rx] of [[0, -Math.PI / 2], [Y, Math.PI / 2]]) {
      const mat = y === 0 ? floorMat : ceilMat;
      const plane = new THREE.Mesh(
        tilePlane(this.tracker.geo(new THREE.PlaneGeometry(fw, fh)), fw, fh, mat),
        mat,
      );
      plane.rotation.x = rx;
      plane.position.set(mid.x, y, mid.z);
      this.group.add(plane);
    }

    // Far wall, then the two long walls, each facing back into the room.
    const far = this._world(H + G.LEN, this.cross);
    wall(this.group, wallMat, far.x, Y / 2, far.z, G.HALF_W * 2, Y, this._facing(-1, 0), this.tracker);
    for (const s of [1, -1]) {
      const side = this._world(H + G.LEN / 2, this.cross + s * G.HALF_W);
      wall(this.group, wallMat, side.x, Y / 2, side.z, G.LEN, Y, this._facing(0, -s), this.tracker);
    }

    // The lobby's wall plane is single-sided and invisible from in here, so the
    // room closes its own near side around the doorway. Only the room's own width
    // needs covering — the rest of that wall is only ever seen from the lobby.
    this._doorwayWall(wallMat, H, this._facing(1, 0), this.cross - G.HALF_W, this.cross + G.HALF_W);
  }

  // The lobby-side face of the same wall: solid panels either side of the doorway,
  // a lintel above it, and this zone's sign on that lintel.
  _lobbyWall(wallMat, name, locked) {
    const H = MUSEUM.ROOM_HALF, Y = MUSEUM.ROOM_HEIGHT;
    const G = MUSEUM.GALLERY;
    const inward = this._facing(-1, 0);
    this._doorwayWall(wallMat, H, inward, -H, H);   // spans the whole lobby edge

    const at = this._world(H - 0.06, this.cross);
    const mat = this.tracker.mat(new THREE.MeshBasicMaterial({
      map: this._signTexture(name, locked),
      color: SIGN_TINT,
      transparent: true,
      depthWrite: false,
    }));
    const sign = new THREE.Mesh(this.tracker.geo(new THREE.PlaneGeometry(2.4, 0.75)), mat);
    sign.position.set(at.x, G.DOOR_H + (Y - G.DOOR_H) / 2, at.z);
    sign.rotation.y = inward;
    this.group.add(sign);
    this.signMat = mat;
  }

  // Wall panels filling the plane at outward distance `u`, minus the doorway
  // opening, plus the lintel above it. Used from both sides of the same wall.
  // `vMin`/`vMax` are ABSOLUTE cross-axis bounds, not an offset from `cross`: the
  // lobby edge is centred on 0 while the room is centred on `cross`, so measuring
  // the span symmetrically about `cross` left a hole in the ±X lobby walls where
  // they meet the portal wall (they ran -8..12 instead of -10..10).
  _doorwayWall(wallMat, u, ry, vMin, vMax) {
    const Y = MUSEUM.ROOM_HEIGHT;
    const G = MUSEUM.GALLERY;
    const dMin = this.cross - G.DOOR_HALF, dMax = this.cross + G.DOOR_HALF;
    for (const [a, b] of [[vMin, dMin], [dMax, vMax]]) {
      if (b - a < 0.001) continue;
      const at = this._world(u, (a + b) / 2);
      wall(this.group, wallMat, at.x, Y / 2, at.z, b - a, Y, ry, this.tracker);
    }
    const lintel = this._world(u, this.cross);
    wall(this.group, wallMat, lintel.x, G.DOOR_H + (Y - G.DOOR_H) / 2, lintel.z,
      G.DOOR_HALF * 2, Y - G.DOOR_H, ry, this.tracker);
  }

  // A low marble drum capped in brass, naming the zone on a tilted plaque angled
  // back toward the doorway — a flat-on-the-floor medallion would only be legible
  // from directly overhead. The whole marker stays under knee height so it never
  // blocks the sightline across the ring to the far pedestals.
  _marker(name, locked) {
    const G = MUSEUM.GALLERY;
    const at = this._world(MUSEUM.ROOM_HALF + G.LEN / 2, this.cross);
    this.markerX = at.x;
    this.markerZ = at.z;

    const drum = new THREE.Mesh(this._kit.markerGeo, this._kit.plinthMat);
    drum.position.set(at.x, G.MARKER_H / 2, at.z);
    this.group.add(drum);

    const cap = new THREE.Mesh(this._kit.medallionGeo, this._kit.brassMat);
    cap.rotation.x = -Math.PI / 2;
    cap.position.set(at.x, G.MARKER_H + 0.005, at.z);
    this.group.add(cap);

    const mat = this.tracker.mat(new THREE.MeshBasicMaterial({
      map: this._signTexture(name, locked),
      color: SIGN_TINT,
      transparent: true,
      depthWrite: false,
    }));
    const plaque = new THREE.Mesh(this._kit.plaqueGeo, mat);
    plaque.rotation.order = 'YXZ';
    plaque.rotation.y = this._facing(-1, 0);   // face whoever just walked in
    plaque.rotation.x = -Math.PI / 4;          // tilt back so it reads standing up
    plaque.position.set(at.x, G.MARKER_H + 0.14, at.z);
    this.group.add(plaque);
    this.markerMat = mat;
  }

  // `count` pedestals evenly around an ellipse fitted to the room. Index 0 sits at
  // the FAR end, so with the odd counts every zone has (11 / 9 / 7) the doorway
  // side always lands in a gap between two plinths — you walk in, not into one.
  _ring(count, accent) {
    const G = MUSEUM.GALLERY;
    const cu = MUSEUM.ROOM_HALF + G.LEN / 2;
    const angles = ellipseAngles(count, G.RING_LONG, G.RING_SHORT);
    for (let i = 0; i < count; i++) {
      const a = angles[i];
      const at = this._world(cu + Math.cos(a) * G.RING_LONG, this.cross + Math.sin(a) * G.RING_SHORT);
      const pedestal = new ArtifactPedestal({
        parent: this.group, kit: this._kit, x: at.x, z: at.z, accent, index: i,
      });
      pedestal.room = this;    // lets crosshair picking reject through-wall hits
      this.pedestals.push(pedestal);
    }
  }

  _signTexture(name, locked) {
    return signTexture(this.zone, name, locked, this.tracker);
  }

  // Repaint both plaques when the zone unlocks: drop "LOCKED", reveal the name.
  reveal(name) {
    for (const mat of [this.signMat, this.markerMat]) {
      if (!mat) continue;
      const old = mat.map;
      mat.map = this._signTexture(name, false);
      mat.needsUpdate = true;
      this.tracker.drop(old);
    }
  }

  // ---- runtime --------------------------------------------------------------

  // Fill pedestals in order — idempotent, so re-running it on every hub entry only
  // adds the newly recovered pieces.
  populate(list) {
    list.forEach((data, i) => this.pedestals[i] && this.pedestals[i].fill(data));
  }

  clear() {
    for (const p of this.pedestals) p.clearArt();
  }

  update(t) {
    for (const p of this.pedestals) p.update(t);
  }

  // Crosshair-pick targets: the glass shell of every filled cube.
  collectRayTargets(out) {
    for (const p of this.pedestals) if (p.shell) out.push(p.shell);
  }

  // Ceiling-downlight positions — one over each pedestal (see Museum._hubLights).
  collectBulbSpots(out) {
    for (const p of this.pedestals) out.push([p.x, p.z]);
  }

  // Hanging-lamp positions down this room's long axis.
  hangSpots() {
    const G = MUSEUM.GALLERY;
    return [0.22, 0.5, 0.78].map((f) => {
      const at = this._world(MUSEUM.ROOM_HALF + G.LEN * f, this.cross);
      return [at.x, at.z];
    });
  }

  // Solid furniture inside this room: the plinths and the centre marker.
  blocksFurniture(x, z, r) {
    const reach = MUSEUM.GALLERY.MARKER_R + r;
    const dx = x - this.markerX, dz = z - this.markerZ;
    if (dx * dx + dz * dz < reach * reach) return true;
    for (const p of this.pedestals) if (p.collides(x, z, r)) return true;
    return false;
  }

  // Room boundary test, used once the player is past the lobby wall (u > ROOM_HALF).
  blocksWalls(x, z, r) {
    const G = MUSEUM.GALLERY;
    const H = MUSEUM.ROOM_HALF;
    const u = this.outward(x, z);
    const dv = this.across(x, z) - this.cross;
    if (u > H + G.LEN - r) return true;                 // far wall
    if (Math.abs(dv) > G.HALF_W - r) return true;       // long walls
    if (u < H + r && !this.inDoorway(x, z, r)) return true;  // panels beside the doorway
    return false;
  }

  // Is this point within the doorway opening (so the lobby wall lets it through)?
  inDoorway(x, z, r) {
    return Math.abs(this.across(x, z) - this.cross) < MUSEUM.GALLERY.DOOR_HALF - r;
  }

  // Camera anchors for the ending walkthrough, so the cutscene never hardcodes
  // room coordinates of its own.
  tourAnchors(eye = 1.85) {
    const G = MUSEUM.GALLERY;
    const H = MUSEUM.ROOM_HALF;
    const v = (u, cross, y) => {
      const at = this._world(u, cross);
      return new THREE.Vector3(at.x, y, at.z);
    };
    return {
      approach: v(H - 3.2, this.cross, eye),                 // in the lobby, facing the door
      doorway: v(H + 1.0, this.cross, eye),                  // just inside the room
      centre: v(H + G.LEN / 2, this.cross, eye),             // the middle of the ring
      offset: v(H + G.LEN / 2, this.cross + G.RING_SHORT * 0.5, eye + 0.5),
      far: v(H + G.LEN - 1.6, this.cross, eye),              // the far end, looking back
    };
  }

  dispose() {
    for (const p of this.pedestals) p.dispose();
    this.pedestals.length = 0;
    this.group.parent && this.group.parent.remove(this.group);
    this.tracker.dispose();
  }
}
