// ============================================================
// GUARDIAN DEBUG GALLERY — owns the three non-interactive display Guardians.
// Their shared shell still drives body animation and local glow, but the gallery
// fixes parallel forward targets, disables roaming, and hides locator beacons.
// ============================================================
import * as THREE from 'three';
import { CONFIG } from '../../config.js';
import { Guardian } from '../Guardian.js';

export class GuardianDebugGallery {
  constructor(scene, world) {
    this.guardians = world.zone.guardianDisplays.map((display) => {
      const guardian = new Guardian(scene, world, display.variant);
      guardian.group.position.set(display.x, 0, display.z);
      guardian.setRoaming(false);
      if (guardian.beacon) guardian.beacon.visible = false;
      const target = new THREE.Vector3(
        display.x + world.zone.displayFacing.x * 12,
        CONFIG.WATER_LEVEL + CONFIG.EYE_HEIGHT,
        display.z + world.zone.displayFacing.z * 12,
      );
      return { guardian, target };
    });
  }

  update(dt, t) {
    for (const display of this.guardians) {
      display.guardian.update(dt, t, display.target);
    }
  }

  dispose() {
    for (const display of this.guardians) display.guardian.dispose();
    this.guardians.length = 0;
  }
}
