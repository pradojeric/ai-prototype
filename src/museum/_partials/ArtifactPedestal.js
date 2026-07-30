// ============================================================
// ARTIFACT PEDESTAL — one plinth and the artifact cube floating above it
// ============================================================
// Replaces the museum's old wall frames: a recovered memory is a physical object
// on a plinth, not a picture on a wall. Empty until its artifact is collected,
// then a glass cube rises over the socket with the artwork suspended inside,
// bobbing and turning so it reads from every angle as you walk the ring.
//
// The plinth is built once and never moves (Museum freezes it); only the cube
// group, created later by fill(), animates.
import * as THREE from 'three';
import { MUSEUM } from '../../config.js';

// Brightness multiplier on the artwork. Same reasoning as the old framed art:
// the scene runs a low-threshold bloom pass, so full-brightness unlit art blows
// out. This dims it just enough that only the highlights bloom.
const ART_TINT = 0x9a9a9a;
const AIM_LIFT = 1.3;             // aim highlight multiplier on the art tint

export class ArtifactPedestal {
  // `kit` carries the geometry/materials shared by every pedestal in the museum
  // (see GalleryRing._kit) — one GPU state for all 27 plinths.
  constructor({ parent, kit, x, z, accent, index }) {
    this.kit = kit;
    this.x = x;
    this.z = z;
    this.data = null;
    this.cube = null;
    // Stagger the bob/spin so a ring never moves in lockstep.
    this._phase = index * 0.8;

    this.group = new THREE.Group();
    this.group.position.set(x, 0, z);
    parent.add(this.group);

    const plinth = new THREE.Mesh(kit.plinthGeo, kit.plinthMat);
    plinth.position.y = MUSEUM.GALLERY.PLINTH_H / 2;
    this.group.add(plinth);

    const ring = new THREE.Mesh(kit.capGeo, kit.brassMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = MUSEUM.GALLERY.PLINTH_H;
    this.group.add(ring);

    // The socket reads as "a memory belongs here" while the pedestal is empty,
    // and stays lit under the cube once one arrives — same language as the Soul
    // altar's empty sockets.
    this.socketMat = new THREE.MeshStandardMaterial({
      color: 0x161d21,
      emissive: new THREE.Color(accent),
      emissiveIntensity: 0.1,
      roughness: 0.5,
      metalness: 0.3,
    });
    const socket = new THREE.Mesh(kit.socketGeo, this.socketMat);
    socket.position.y = MUSEUM.GALLERY.PLINTH_H + 0.03;
    this.group.add(socket);
  }

  get filled() { return this.cube !== null; }

  // Hang a recovered memory on this pedestal. Idempotent — a filled pedestal is
  // left alone, which is what lets Museum.populate() run on every hub entry.
  fill(data) {
    if (this.cube || !data) return;
    const kit = this.kit;
    const G = MUSEUM.GALLERY;

    const cube = new THREE.Group();
    cube.position.set(0, G.CUBE_Y, 0);
    this.group.add(cube);

    // The artwork, as two crossed planes — a single one would vanish edge-on
    // twice per turn. Each is doubled back-to-back at FrontSide rather than made
    // DoubleSide, because a double-sided plane shows the piece MIRRORED from
    // behind; back-face culling means only the correctly-oriented copy ever draws.
    this._artPlanes = [];
    const mat = new THREE.MeshBasicMaterial({
      map: this._loadArt(data),
      color: ART_TINT,
      side: THREE.FrontSide,
      // alphaTest instead of transparent: the artifact PNGs are RGBA cutouts, and
      // keeping them in the OPAQUE pass means they never sort against the glass
      // shell around them.
      alphaTest: 0.5,
    });
    mat.userData.baseColor = mat.color.clone();
    this.artMat = mat;
    for (let q = 0; q < 4; q++) {
      const plane = new THREE.Mesh(kit.artGeo, mat);
      plane.rotation.y = (q * Math.PI) / 2;
      cube.add(plane);
      this._artPlanes.push(plane);
    }

    // Glass shell. Per-pedestal material (27 at most) so the aim highlight can
    // brighten just this cube. No `transmission` — it costs a render target per
    // frame, and the hub's HDRI environment already sells the refractive read.
    const shellMat = new THREE.MeshPhysicalMaterial({
      color: 0xd8eef5,
      transparent: true,
      opacity: 0.15,
      roughness: 0.05,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.5,
      side: THREE.DoubleSide,
      depthWrite: false,          // never occlude the artwork inside it
    });
    shellMat.userData.baseOpacity = shellMat.opacity;
    this.shellMat = shellMat;
    const shell = new THREE.Mesh(kit.cubeGeo, shellMat);
    shell.renderOrder = 2;        // after the artwork, among the transparents
    shell.userData.pedestal = this;   // crosshair picking resolves back to us
    cube.add(shell);
    this.shell = shell;

    // A thin accent outline gives the glass its silhouette in a bright gallery
    // where a near-clear cube would otherwise read as nothing.
    const edges = new THREE.LineSegments(kit.edgeGeo, kit.edgeMat);
    edges.renderOrder = 3;
    cube.add(edges);

    this.socketMat.emissiveIntensity = 0.75;
    this.cube = cube;
    this.data = data;
  }

  // Load the artwork and, once its real size is known, scale the crossed planes to
  // its aspect ratio. The artifact PNGs range from square to 1:2.2 portrait, so a
  // fixed plane would visibly squash half the collection.
  _loadArt(data) {
    const tex = this.kit.texLoader.load(data.image, (loaded) => {
      const img = loaded.image;
      if (!img || !img.width || !img.height) return;
      const aspect = img.width / img.height;
      // Fit inside the cube either way round, so a wide piece and a tall piece
      // both sit fully within the glass.
      const scale = aspect >= 1 ? 1 / aspect : 1;
      for (const plane of this._artPlanes || []) plane.scale.set(aspect * scale, scale, 1);
    });
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    this.artTex = tex;
    return tex;
  }

  update(t) {
    if (!this.cube) return;
    const G = MUSEUM.GALLERY;
    this.cube.position.y = G.CUBE_Y + Math.sin(t * 1.4 + this._phase) * G.FLOAT;
    this.cube.rotation.y = t * G.SPIN + this._phase;
  }

  // Crosshair highlight: lift the artwork tint and thicken the glass slightly so
  // the aimed cube reads as selected without a separate outline pass.
  setAimed(on) {
    if (!this.artMat) return;
    this.artMat.color.copy(this.artMat.userData.baseColor);
    if (on) this.artMat.color.multiplyScalar(AIM_LIFT);
    this.shellMat.opacity = this.shellMat.userData.baseOpacity * (on ? 2.2 : 1);
  }

  // Solid furniture — the plinth blocks, the floating cube does not (it is above
  // head height of the collider, and you should be able to lean in to read it).
  collides(x, z, r) {
    const dx = x - this.x;
    const dz = z - this.z;
    const reach = MUSEUM.GALLERY.PEDESTAL_R + r;
    return dx * dx + dz * dz < reach * reach;
  }

  // Drop the artwork but keep the plinth — Museum.clear() re-populates from
  // scratch on the next hub entry.
  clearArt() {
    if (!this.cube) return;
    this.group.remove(this.cube);
    // Geometry is shared (owned by the kit); only the per-pedestal material and
    // texture are ours to free.
    this.artMat.dispose();
    this.shellMat.dispose();
    if (this.artTex) this.artTex.dispose();
    this.artMat = this.shellMat = this.artTex = null;
    this._artPlanes = null;
    this.shell = null;
    this.cube = null;
    this.data = null;
    this.socketMat.emissiveIntensity = 0.1;
  }

  dispose() {
    this.clearArt();
    this.socketMat.dispose();
  }
}
