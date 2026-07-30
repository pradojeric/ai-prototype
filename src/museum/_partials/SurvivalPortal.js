// ============================================================
// SURVIVAL PORTAL — the "Endless Echoes" arch in the museum lobby
// ============================================================
// A free-standing portal leading out of the museum into Survival mode. It is an
// arch standing IN the lobby rather than a doorway cut into a wall, because the
// -Z wall is fully consumed by the three zone doorways and the other three walls
// each belong to a gallery (see MUSEUM.SURVIVAL_PORTAL for the placement notes).
//
// Sealed until the ending cutscene has been seen — or immediately, with
// CONFIG.DEBUG_SURVIVAL_UNLOCKED. Sealed and open differ only in material and
// plaque text, never in transform, so the arch survives Museum._freezeStatic().
import * as THREE from 'three';
import { MUSEUM } from '../../config.js';
import { createVortexMaterial } from '../PortalVortex.js';
import { plaqueTexture } from './RoomShell.js';

const PLAQUE_W = 2.0;
const PLAQUE_H = PLAQUE_W / 3.2;   // the plaque canvas aspect

export class SurvivalPortal {
  constructor(scene, tracker) {
    this.scene = scene;
    this.track = tracker;
    this.open = false;

    const cfg = MUSEUM.SURVIVAL_PORTAL;
    this.x = cfg.X;
    this.z = MUSEUM.ROOM_HALF - cfg.INSET;
    this.halfWidth = cfg.WIDTH / 2;

    // The trigger point sits in front of the arch, toward the lobby (-Z), so the
    // player walks INTO the portal exactly as they do a zone corridor's end.
    this.entry = new THREE.Vector3(this.x, 1.55, this.z - cfg.ENTRY_OFFSET);

    this.group = new THREE.Group();
    this.group.visible = false;   // hidden through the dark intro, like the altar
    this.scene.add(this.group);
    this._build(cfg);
  }

  _mat(opts) { return this.track.mat(new THREE.MeshStandardMaterial(opts)); }

  _geo(g) { return this.track.geo(g); }

  _build(cfg) {
    const h = cfg.HEIGHT;
    const inner = this.halfWidth - cfg.POST_R;

    const stone = this._mat({ color: 0x3f4750, roughness: 0.8, metalness: 0.18 });
    const postGeo = this._geo(new THREE.CylinderGeometry(cfg.POST_R, cfg.POST_R, h, 12));
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, stone);
      post.position.set(this.x + side * inner, h / 2, this.z);
      this.group.add(post);
    }

    const lintel = new THREE.Mesh(
      this._geo(new THREE.BoxGeometry(cfg.WIDTH, 0.26, cfg.POST_R * 2.2)),
      stone,
    );
    lintel.position.set(this.x, h + 0.13, this.z);
    this.group.add(lintel);

    // The panel filling the arch. Emissive rather than lit so it reads as a
    // portal mouth under bloom; the vortex is layered just in front of it.
    const panelGeo = this._geo(new THREE.PlaneGeometry(inner * 2, h));
    this.panelMat = this._mat({
      color: 0x000000,
      emissive: new THREE.Color(cfg.SEALED_COLOR),
      emissiveIntensity: 0.5,
      side: THREE.DoubleSide,
    });
    const panel = new THREE.Mesh(panelGeo, this.panelMat);
    panel.position.set(this.x, h / 2, this.z);
    this.group.add(panel);

    // Its own vortex material (not the zone portals' shared one) so the violet
    // Endless Echoes swirl can spin independently of the warm zone portals.
    this.vortexMat = this.track.mat(createVortexMaterial((inner * 2) / h));
    const vortex = new THREE.Mesh(panelGeo, this.vortexMat);
    vortex.position.set(this.x, h / 2, this.z - 0.03);   // faces the lobby
    vortex.visible = false;
    this.group.add(vortex);
    this.vortexMesh = vortex;

    // Plaque on the lintel, facing into the lobby.
    this.plaqueMat = this.track.mat(new THREE.MeshBasicMaterial({
      map: this._plaqueTexture(false),
      transparent: true,
      depthWrite: false,
    }));
    const plaque = new THREE.Mesh(
      this._geo(new THREE.PlaneGeometry(PLAQUE_W, PLAQUE_H)),
      this.plaqueMat,
    );
    plaque.position.set(this.x, h + 0.42, this.z - 0.04);
    plaque.rotation.y = Math.PI;   // default +Z normal, so turn it to face -Z
    this.group.add(plaque);
  }

  _plaqueTexture(open) {
    return plaqueTexture(
      'ENDLESS',
      open ? 'ECHOES' : 'SEALED',
      !open,
      this.track,
      '#d9b3ff',
    );
  }

  // Shown for the walkable hub only — the intro's lobby is deliberately empty.
  setVisible(on) { this.group.visible = !!on; }

  // Open the portal: violet glow, spinning vortex, and a plaque that names the
  // destination. Idempotent, so the epilogue transition can call it freely.
  setOpen(on) {
    const next = !!on;
    if (this.open === next) return;
    this.open = next;
    const cfg = MUSEUM.SURVIVAL_PORTAL;
    this.vortexMesh.visible = next;
    this.panelMat.emissive.setHex(next ? cfg.OPEN_COLOR : cfg.SEALED_COLOR);
    // Open: the vortex carries the look, so the panel behind it only underlights.
    this.panelMat.emissiveIntensity = next ? 0.35 : 0.5;
    const old = this.plaqueMat.map;
    this.plaqueMat.map = this._plaqueTexture(next);
    this.plaqueMat.needsUpdate = true;
    this.track.drop(old);
  }

  update(t) {
    if (this.open) this.vortexMat.uniforms.uTime.value = t;
  }

  // True when the player may walk through into Survival.
  get enterable() { return this.open && this.group.visible; }

  distanceTo(position) { return position.distanceTo(this.entry); }

  // Only the two posts are solid; the arch mouth stays walkable, since walking
  // into it is how the portal is entered.
  collidesAt(x, z, r) {
    if (!this.group.visible) return false;
    const cfg = MUSEUM.SURVIVAL_PORTAL;
    const inner = this.halfWidth - cfg.POST_R;
    const reach = cfg.POST_R + r;
    const dz = z - this.z;
    if (Math.abs(dz) > reach) return false;
    for (const side of [-1, 1]) {
      const dx = x - (this.x + side * inner);
      if (dx * dx + dz * dz < reach * reach) return true;
    }
    return false;
  }

  dispose() {
    this.scene.remove(this.group);
    // Geometries, materials and textures are all owned by Museum's Tracker.
  }
}
