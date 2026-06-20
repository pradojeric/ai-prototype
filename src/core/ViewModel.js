// ============================================================
// VIEW MODEL — first-person hand held low in view (GDD §4)
// A single stylized hand, child of the camera, bobbing while wading.
// ============================================================
import * as THREE from 'three';

export class ViewModel {
  constructor(camera) {
    this.group = new THREE.Group();
    this._buildHand();

    // Rest pose: lower and slightly right, pitched forward so the BACK of the
    // hand faces the camera (DOOM-style) with the fingers reaching away.
    this.basePos = new THREE.Vector3(0.18, -0.40, -0.72);
    this.group.position.copy(this.basePos);
    this.group.rotation.set(0.5, -0.18, 0.05);
    camera.add(this.group);          // renders in view space, follows the camera

    this.bobT = 0;
    this.reach = 0;                  // 0..1 hold-to-collect reach, set by Game
  }

  _buildHand() {
    // Muted, slightly desaturated skin to sit inside the teal underwater palette.
    const skin = new THREE.MeshStandardMaterial({ color: 0xa9836a, roughness: 0.85 });
    const skinDark = new THREE.MeshStandardMaterial({ color: 0x8f6e58, roughness: 0.9 });

    // forearm (recedes back toward the camera so the hand reads as the player's)
    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.075, 0.32), skinDark);
    forearm.position.set(0, -0.01, 0.24);
    this.group.add(forearm);

    // Hand slab — top face (+y) is the BACK of the hand shown to the camera;
    // the palm faces -y, away from view.
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.055, 0.18), skin);
    this.group.add(palm);

    // raised knuckle ridge so the back reads as knuckles, not a flat slab
    const knuckles = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.04, 0.05), skinDark);
    knuckles.position.set(0, 0.02, -0.085);
    this.group.add(knuckles);

    // four fingers extended forward (-z), open hand with only a slight bend
    const fingerGeo = new THREE.BoxGeometry(0.034, 0.03, 0.15);
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(fingerGeo, skin);
      f.position.set(-0.06 + i * 0.04, 0.005, -0.17);
      f.rotation.x = -0.1 + i * 0.01;           // near-straight (open hand)
      f.rotation.y = (i - 1.5) * 0.045;          // gentle fan
      this.group.add(f);
    }

    // thumb on the inner (-x) side, pointing toward screen center — this is
    // what makes it read as a RIGHT hand rather than a left one.
    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.03, 0.1), skin);
    thumb.position.set(-0.092, -0.01, -0.04);
    thumb.rotation.set(0, 0.6, -0.2);
    this.group.add(thumb);

    // ---- glowing lure/hook on a short line at the fingertips (Strings theme)
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.12, 4), skinDark);
    line.position.set(0, -0.045, -0.28);
    line.rotation.x = 0.5;
    this.group.add(line);

    this.lureMat = new THREE.MeshStandardMaterial({
      color: 0xcdfdf6, emissive: 0x6fe9ff, emissiveIntensity: 2.2, roughness: 0.3,
    });
    const lure = new THREE.Mesh(new THREE.IcosahedronGeometry(0.024, 0), this.lureMat);
    lure.position.set(0, -0.095, -0.31);
    this.group.add(lure);

    // a small point light so the lure casts a soft local glow in the dark water
    this.lureLight = new THREE.PointLight(0x7fe8ff, 0.5, 2.4, 2);
    this.lureLight.position.copy(lure.position);
    this.group.add(this.lureLight);
  }

  // Game feeds the hold-to-collect progress here; the hand reaches as it fills.
  setReach(p) { this.reach = p; }

  // Subtle wade bob + breathing sway; stronger while moving. The hand reaches
  // forward (and the lure brightens) as the hold-to-collect progress fills.
  update(dt, moving) {
    this.bobT += dt * (moving ? 6 : 1.4);
    const amp = moving ? 0.022 : 0.007;
    this.group.position.x = this.basePos.x + Math.cos(this.bobT * 0.5) * amp;
    this.group.position.y = this.basePos.y + Math.sin(this.bobT) * amp + 0.06 * this.reach;
    this.group.position.z = this.basePos.z - 0.2 * this.reach;        // reach forward
    this.group.rotation.z = 0.16 + Math.sin(this.bobT * 0.5) * 0.02;

    // lure glow: gentle idle flicker, swelling as you reach
    const flicker = Math.sin(this.bobT * 1.3) * 0.06;
    this.lureLight.intensity = 0.5 + flicker + this.reach * 1.1;
    this.lureMat.emissiveIntensity = 2.2 + this.reach * 1.8;
  }
}
