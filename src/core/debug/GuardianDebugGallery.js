// ============================================================
// GUARDIAN DEBUG GALLERY — owns the three non-interactive display Guardians and
// one of every common enemy. Guardians retain their ambient animation; enemies
// remain fixed and harmless so every silhouette is easy to frame for captures.
// ============================================================
import * as THREE from 'three';
import { CONFIG } from '../../config.js';
import { Guardian } from '../Guardian.js';
import { RailThreat } from '../arena/RailThreat.js';
import { TowerThreat } from '../arena/TowerThreat.js';
import { Enemy } from '../combat/Enemy.js';

const DISPLAY_YAW = Math.PI;

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
    this.enemies = world.zone.enemyDisplays.map((display) => {
      const enemy = this._createEnemy(scene, world, display);
      // ThreatBody starts transparent for combat portals. Gallery figures skip
      // that lifecycle and are fully present from the first rendered frame.
      enemy._fade = 1;
      enemy.group.rotation.y = DISPLAY_YAW;
      return enemy;
    });
  }

  _createEnemy(scene, world, display) {
    if (display.type === 'chaser' || display.type === 'spitter') {
      return new Enemy(scene, world, display.type, display.x, display.z);
    }
    if (display.type === 'sniper' || display.type === 'boarder') {
      return new RailThreat(scene, display.type, display.x, display.z, () => 0.5);
    }
    const isGale = display.type === 'gale';
    const anchor = {
      spawnX: display.x,
      spawnY: isGale ? CONFIG.WATER_LEVEL + 2.2 : 0,
      spawnZ: display.z,
    };
    return new TowerThreat(
      scene,
      world,
      display.type,
      anchor,
      { eyeBase: 0 },
      { placed: true, rng: () => 0.5 },
    );
  }

  update(dt, t) {
    for (const display of this.guardians) {
      display.guardian.update(dt, t, display.target);
    }
  }

  dispose() {
    for (const display of this.guardians) display.guardian.dispose();
    for (const enemy of this.enemies) enemy.dispose();
    this.guardians.length = 0;
    this.enemies.length = 0;
  }
}
