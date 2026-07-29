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
    this.castT = 0;                  // 1→0 cast-recoil envelope (see triggerCast)
    this.slamT = 0;                  // 1→0 shockwave-slam envelope (see triggerSlam)
  }

  _buildHand() {
    // Muted, slightly desaturated skin to sit inside the teal underwater palette.
    const skin = new THREE.MeshStandardMaterial({ color: 0xa9836a, roughness: 0.85 });
    const skinDark = new THREE.MeshStandardMaterial({ color: 0x8f6e58, roughness: 0.9 });
    const cloth = new THREE.MeshStandardMaterial({ color: 0x3c5a5e, roughness: 1.0 });

    // forearm (recedes back toward the camera so the hand reads as the player's)
    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.07, 0.30), skinDark);
    forearm.position.set(0, -0.012, 0.25);
    forearm.rotation.x = 0.06;                 // slight droop toward the wrist
    this.group.add(forearm);

    // rolled shirt cuff where the arm leaves the bottom of the frame — grounds
    // the arm as belonging to a person rather than a floating limb
    const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.105, 0.09), cloth);
    cuff.position.set(0, -0.015, 0.36);
    this.group.add(cuff);

    // wrist bridge so palm and forearm don't meet at a hard step
    const wrist = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.06, 0.08), skinDark);
    wrist.position.set(0, -0.005, 0.10);
    this.group.add(wrist);

    // Hand slab — top face (+y) is the BACK of the hand shown to the camera;
    // the palm faces -y, away from view. Slightly wedge-shaped: a second,
    // narrower slab toward the wrist gives the back of the hand a taper.
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.05, 0.13), skin);
    palm.position.set(0, 0, -0.025);
    this.group.add(palm);
    const palmHeel = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.055, 0.09), skin);
    palmHeel.position.set(0, -0.004, 0.055);
    this.group.add(palmHeel);

    // raised knuckle ridge so the back reads as knuckles, not a flat slab
    const knuckles = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.038, 0.05), skinDark);
    knuckles.position.set(0, 0.022, -0.075);
    this.group.add(knuckles);

    // Four fingers, each two segments hinged at the knuckle so they can curl
    // as the hold-to-collect reach fills. Middle fingers are longer than the
    // index/pinky so the hand has a natural silhouette.
    const lengths = [0.115, 0.135, 0.13, 0.10];   // index..pinky
    this.fingers = [];
    for (let i = 0; i < 4; i++) {
      const len = lengths[i];
      const root = new THREE.Group();               // hinge at the knuckle line
      root.position.set(-0.06 + i * 0.04, 0.008, -0.095);
      root.rotation.x = -0.12 + i * 0.015;          // near-straight (open hand)
      root.rotation.y = (i - 1.5) * 0.05;           // gentle fan

      const prox = new THREE.Mesh(new THREE.BoxGeometry(0.033, 0.03, len * 0.6), skin);
      prox.position.z = -len * 0.3;
      root.add(prox);

      const mid = new THREE.Group();                // second hinge mid-finger
      mid.position.z = -len * 0.58;
      mid.rotation.x = -0.18;                       // relaxed resting bend
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.029, 0.026, len * 0.45), skin);
      tip.position.z = -len * 0.22;
      mid.add(tip);
      root.add(mid);

      this.group.add(root);
      this.fingers.push({ root, mid, baseX: root.rotation.x });
    }

    // thumb on the inner (-x) side, pointing toward screen center — this is
    // what makes it read as a RIGHT hand rather than a left one. Two segments
    // so it has a visible knuckle instead of one straight stick.
    const thumbRoot = new THREE.Group();
    thumbRoot.position.set(-0.085, -0.008, 0.0);
    thumbRoot.rotation.set(0, 0.65, -0.25);
    const thumbBase = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.032, 0.075), skin);
    thumbBase.position.z = -0.035;
    thumbRoot.add(thumbBase);
    const thumbTip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.028, 0.06), skin);
    thumbTip.position.set(0, 0, -0.095);
    thumbTip.rotation.x = -0.25;
    thumbRoot.add(thumbTip);
    this.group.add(thumbRoot);
    this.thumb = thumbRoot;
    this._thumbBaseY = thumbRoot.rotation.y;

    // ---- glowing lure/hook on a short line at the fingertips (Strings theme)
    // Pivoted at the fingertips so the whole thing can pendulum-sway in update.
    this.lureGroup = new THREE.Group();
    this.lureGroup.position.set(0, 0.0, -0.24);
    this.group.add(this.lureGroup);

    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.12, 4), skinDark);
    line.position.set(0, -0.05, -0.03);
    line.rotation.x = 0.5;
    this.lureGroup.add(line);

    this.lureMat = new THREE.MeshStandardMaterial({
      color: 0xcdfdf6, emissive: 0x6fe9ff, emissiveIntensity: 2.2, roughness: 0.3,
    });
    const lure = new THREE.Mesh(new THREE.IcosahedronGeometry(0.024, 0), this.lureMat);
    lure.position.set(0, -0.1, -0.06);
    this.lureGroup.add(lure);

    // a small point light so the lure casts a soft local glow in the dark water
    this.lureLight = new THREE.PointLight(0x7fe8ff, 0.5, 2.4, 2);
    this.lureLight.position.copy(lure.position);
    this.lureGroup.add(this.lureLight);
  }

  // Game feeds the hold-to-collect progress here; the hand reaches as it fills.
  setReach(p) { this.reach = p; }

  // Combat: snap the cast envelope to full; update() decays it, driving a quick
  // forward punch + finger flick + lure flash layered over the idle pose.
  triggerCast() { this.castT = 1; }

  // Melee shockwave: the hand drops and drives DOWN rather than punching flat
  // forward like a cast. Its own envelope, not a reuse of castT, so a shockwave
  // released mid-burst doesn't fight the bolt recoil for the same channel.
  triggerSlam() { this.slamT = 1; }

  // World position of the glowing lure — the muzzle a light-bolt spawns from.
  // Matrices are fresh from the previous frame's render, so this is safe to
  // call at fire time without an extra updateMatrixWorld pass.
  getMuzzleWorld(out) { return this.lureGroup.getWorldPosition(out); }

  // Subtle wade bob + breathing sway; stronger while moving. The hand reaches
  // forward (and the lure brightens) as the hold-to-collect progress fills;
  // the fingers open wide and the thumb spreads, like reaching for the string.
  update(dt, moving) {
    this.bobT += dt * (moving ? 6 : 1.4);
    const amp = moving ? 0.022 : 0.007;
    // Cast recoil: a sharp punch forward that eases back (decays ~6x/sec).
    this.castT = Math.max(0, this.castT - dt * 6);
    const cast = this.castT * this.castT;   // squared so the snap front-loads
    // Slam: slower decay than a cast so the heavier verb reads as heavier.
    this.slamT = Math.max(0, this.slamT - dt * 3.6);
    const slam = this.slamT * this.slamT;

    this.group.position.x = this.basePos.x + Math.cos(this.bobT * 0.5) * amp;
    this.group.position.y = this.basePos.y + Math.sin(this.bobT) * amp + 0.06 * this.reach
      - 0.22 * slam;                        // the slam drives the hand DOWN
    this.group.position.z = this.basePos.z - 0.2 * this.reach - 0.08 * cast
      - 0.05 * slam;                        // and a little forward with it
    this.group.rotation.z = 0.16 + Math.sin(this.bobT * 0.5) * 0.02;
    this.group.rotation.x = 0.5 + 0.55 * slam;   // palm rolls down toward the water

    // fingers: faint idle drift so the hand never looks rigid, straightening
    // open as the reach fills (each finger offset so they don't move in unison)
    for (let i = 0; i < 4; i++) {
      const f = this.fingers[i];
      const idle = Math.sin(this.bobT * 0.8 + i * 1.7) * 0.03;
      f.root.rotation.x = f.baseX + idle - this.reach * 0.15 - cast * 0.2   // snap open on cast
        - slam * 0.34;                                                // and wider on a slam
      f.mid.rotation.x = -0.18 + idle * 0.5 + this.reach * 0.14 + slam * 0.3;  // uncurl
    }
    this.thumb.rotation.y = this._thumbBaseY + this.reach * 0.25;     // spread

    // lure: gentle pendulum sway from the fingertips, stronger while wading
    const sway = moving ? 0.12 : 0.05;
    this.lureGroup.rotation.z = Math.sin(this.bobT * 0.9) * sway;
    this.lureGroup.rotation.x = Math.cos(this.bobT * 0.7) * sway * 0.6;

    // lure glow: gentle idle flicker, swelling as you reach
    const flicker = Math.sin(this.bobT * 1.3) * 0.06;
    // The slam flares harder than a cast — it is the bigger release of the two.
    this.lureLight.intensity = 0.5 + flicker + this.reach * 1.1 + cast * 2.5 + slam * 4.5;
    this.lureMat.emissiveIntensity = 2.2 + this.reach * 1.8 + cast * 3 + slam * 5;
  }
}
