// ============================================================
// KEEPER MELEE COMBO — a readable two-hit answer to staying near the Keeper.
// Entering range lands the opener immediately. One pooled floor ring marks the
// exact reach before the follow-up, so stepping out avoids the second strike.
// ============================================================
import * as THREE from 'three';

export class KeeperMeleeCombo {
  constructor(scene, combat, player, body, bounds, tuning) {
    this.scene = scene;
    this.combat = combat;
    this.player = player;
    this.body = body;
    this.bounds = bounds;
    this.tuning = tuning;
    this._state = 'idle';
    this._timer = 0;
    this._strike = 0;

    this._geometry = new THREE.RingGeometry(
      tuning.RANGE * 0.72,
      tuning.RANGE,
      40,
    );
    this._material = new THREE.MeshBasicMaterial({
      color: 0xffb45d,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this._warning = new THREE.Mesh(this._geometry, this._material);
    this._warning.rotation.x = -Math.PI / 2;
    this._warning.visible = false;
    scene.add(this._warning);
  }

  get busy() { return this._state !== 'idle'; }

  start(playerPos) {
    if (this.busy) return false;
    this._state = 'gap';
    this._timer = this.tuning.GAP;
    this._strike = 0;
    this._warning.visible = true;
    this._material.opacity = 0.52;
    this._syncWarning();
    this._hit(playerPos);
    return true;
  }

  _syncWarning() {
    const position = this.body.group.position;
    this._warning.position.set(position.x, this.bounds.height + 0.065, position.z);
  }

  update(dt, playerPos) {
    if (!this.busy) return;
    this._syncWarning();
    this._timer = Math.max(0, this._timer - dt);

    if (this._state === 'gap') {
      this._material.opacity = 0.24 + Math.sin(this._timer * 18) * 0.1;
      if (this._timer > 0) return;
      this._hit(playerPos);
      this._state = 'recovery';
      this._timer = this.tuning.RECOVERY;
      this._warning.visible = false;
      return;
    }

    if (this._timer <= 0) this.clear();
  }

  _hit(playerPos) {
    this._strike++;
    const source = this.body.group.position;
    const dx = playerPos.x - source.x;
    const dz = playerPos.z - source.z;
    this.combat.vfx.keeperPulse(this.body.center(), 'hit');
    if (Math.hypot(dx, dz) > this.tuning.RANGE) return;
    this.combat.damage(this.tuning.DAMAGE[this._strike - 1], source);
    this.player.applyKnockback(dx, dz, this.tuning.KNOCKBACK);
  }

  clear() {
    this._state = 'idle';
    this._timer = 0;
    this._strike = 0;
    this._warning.visible = false;
    this._warning.scale.setScalar(1);
  }

  dispose() {
    this.clear();
    this.scene.remove(this._warning);
    this._geometry.dispose();
    this._material.dispose();
  }
}
