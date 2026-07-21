import * as THREE from 'three';
import { CONFIG, TOWER_ARENA } from '../../config.js';
import { buildZone3Guardian } from '../guardians/zone3Guardian.js';

const KEEPER_SCALE = 0.62;
const KEEPER_CHEST_HEIGHT = 19.3;

export class TowerKeeper {
  constructor(scene, player, combat, audio) {
    this.scene = scene;
    this.player = player;
    this.combat = combat;
    this.audio = audio;
    this.hp = TOWER_ARENA.KEEPER.HP;
    this.active = false;
    this.defeated = false;
    this._timer = 1;
    this._reinforce = TOWER_ARENA.KEEPER.REINFORCE;
    this._telegraphed = false;
    this._fade = 0;
    this._disposed = false;
    this._direction = new THREE.Vector3();
    this._center = new THREE.Vector3();

    this.group = new THREE.Group();
    this.figure = new THREE.Group();
    this.figure.scale.setScalar(KEEPER_SCALE);
    this.group.add(this.figure);

    this._body = buildZone3Guardian(this.figure);
    this.group.position.set(
      0,
      KEEPER_CHEST_HEIGHT - CONFIG.WATER_LEVEL - this._body.chestY * KEEPER_SCALE,
      0,
    );
    this.group.visible = false;
    this._applyFade(0);
    scene.add(this.group);
  }

  _applyFade(fade) {
    for (const [material, baseOpacity] of this._body.fadeMats) {
      material.opacity = baseOpacity * fade;
    }
  }

  begin() {
    if (this.active || this.defeated) return false;
    this.active = true;
    this.group.visible = true;
    this.combat.vfx.keeperPulse(this.center(this._center), 'telegraph');
    return true;
  }

  _fire(playerPos) {
    this._direction.copy(playerPos).sub(this.center(this._center)).normalize();
    this.combat.spits.fire(this._center, this._direction, 10, 4);
  }

  _testPlayerBolts() {
    for (const shot of this.combat.bolts.slots) {
      if (!shot.active) continue;
      if (shot.mesh.position.distanceToSquared(this.center(this._center)) >= 2.3 ** 2) continue;
      this.combat.bolts.deactivate(shot);
      this.hp--;
      this.audio.playHit();
      this.combat.vfx.keeperPulse(this._center, 'hit');
      if (this.hp <= 0) {
        this.hp = 0;
        this.defeated = true;
        this.active = false;
        this.audio.playEnemyDeath();
        this.combat.vfx.keeperPulse(this._center, 'defeat');
      }
      break;
    }
  }

  update(dt, t, playerPos) {
    if (!this.group.visible || !this.player.controls.isLocked) return;
    const targetFade = this.defeated ? 0 : 1;
    this._fade = THREE.MathUtils.damp(this._fade, targetFade, this.defeated ? 3 : 5, dt);
    this._applyFade(this._fade);
    this._body.animate(dt, t, this._fade, playerPos, this.group.position);
    if (this.defeated) {
      if (this._fade < 0.015) this.group.visible = false;
      return;
    }
    if (!this.active) return;

    this._timer -= dt;
    this._reinforce -= dt;
    if (!this._telegraphed && this._timer <= 0.45) {
      this._telegraphed = true;
      this.combat.vfx.keeperPulse(this.center(this._center), 'telegraph');
    }
    if (this._timer <= 0) {
      this._timer = TOWER_ARENA.KEEPER.SHOT_INTERVAL;
      this._telegraphed = false;
      this._fire(playerPos);
    }
    if (this._reinforce <= 0) {
      this._reinforce = TOWER_ARENA.KEEPER.REINFORCE;
      this.combat.spawnPenaltyGargoyle(TOWER_ARENA.SUMMIT_HEIGHT);
    }
    this._testPlayerBolts();
  }

  center(out = new THREE.Vector3()) {
    return out.set(
      this.group.position.x,
      this.group.position.y + this.figure.position.y + this._body.chestY * KEEPER_SCALE,
      this.group.position.z,
    );
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this.scene.remove(this.group);
    const geometries = new Set();
    const materials = new Set();
    this.group.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      if (Array.isArray(object.material)) {
        for (const material of object.material) materials.add(material);
      } else if (object.material) {
        materials.add(object.material);
      }
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
  }
}
