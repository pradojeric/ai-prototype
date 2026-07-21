import { CombatManager } from '../combat/CombatManager.js';
import { COMBAT, TOWER_ARENA } from '../../config.js';
import { TowerThreat } from './TowerThreat.js';
import { TowerVfxSystem } from './TowerVfxSystem.js';

export class TowerCombatManager extends CombatManager {
  constructor(scene, world, player, camera, viewmodel, audio) {
    super(scene, world, player, camera, viewmodel, audio, { navigation: false });
    this.enemies = [];
    this._anchors = world.towerThreatAnchors || [];
    this._stage = -1;
    this._time = 0;
    this._onTowerEvent = null;
    this.vfx = new TowerVfxSystem(scene);
  }

  setTowerEventHandler(handler) { this._onTowerEvent = handler; }

  startFight() {
    this.active = true;
    this.hp = COMBAT.PLAYER_HP;
    this._playerDied = false;
    this._stage = -1;
    this.elHealth.classList.add('active');
    this.elWave.classList.remove('active');
    this.elCross.classList.add('combat');
    this._updateHealthUi();
  }

  _anchorNear(height) {
    let best = this._anchors[0];
    let delta = Infinity;
    for (const anchor of this._anchors) {
      const d = Math.abs(anchor.y - height);
      if (d < delta) { best = anchor; delta = d; }
    }
    return best || {
      x: 0, y: height, z: 0, rotation: 0,
      halfW: 1.5, halfD: 3, startHeight: height, endHeight: height,
    };
  }

  _spawnThreat(type, anchor) {
    const threat = new TowerThreat(this.scene, this.world, type, anchor, this.player);
    this.enemies.push(threat);
    threat.center(this._vEnemy);
    this.vfx.threatSpawn(this._vEnemy, type);
    return threat;
  }

  spawnStage(stage) {
    if (stage < 0 || stage <= this._stage || this.enemies.length >= TOWER_ARENA.MAX_THREATS) return;
    this._stage = stage;
    const anchor = this._anchorNear(TOWER_ARENA.THREAT_BANDS[stage]);
    this._spawnThreat('gargoyle', anchor);
    this._onTowerEvent?.('Gargoyle Sentinel awakened', 'warning');
    if (stage > 1 && this.enemies.length < TOWER_ARENA.MAX_THREATS) {
      this._spawnThreat('gale', anchor);
      this._onTowerEvent?.('Gale Whisper gathering', 'warning');
    }
  }

  spawnPenaltyGargoyle(y) {
    if (this.enemies.length >= TOWER_ARENA.MAX_THREATS) return;
    this._spawnThreat('gargoyle', this._anchorNear(y));
  }

  blocksPlayerAt(x, z, radius, y) {
    return this.enemies.some((enemy) => enemy.blocksPlayerAt(x, z, radius, y));
  }

  _testPlayerBolts() {
    for (const shot of this.bolts.slots) {
      if (!shot.active) continue;
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        enemy.center(this._vEnemy);
        if (shot.mesh.position.distanceToSquared(this._vEnemy) >
          (enemy.radius + COMBAT.BOLT.RADIUS) ** 2) continue;
        this.bolts.deactivate(shot);
        const defeated = enemy.hit(COMBAT.BOLT.DAMAGE);
        this.vfx.enemyImpact(this._vEnemy, enemy.type, defeated);
        if (defeated) {
          this.audio.playEnemyDeath();
          this._onEnemyDefeated?.(enemy.type, this._vEnemy, 1);
        } else {
          this.audio.playHit();
        }
        break;
      }
    }
  }

  _testHostileShots(playerPos) {
    for (const shot of this.spits.slots) {
      if (!shot.active) continue;
      const dx = shot.mesh.position.x - playerPos.x;
      const dz = shot.mesh.position.z - playerPos.z;
      const dy = shot.mesh.position.y - playerPos.y;
      if (dx * dx + dz * dz >= 1 || Math.abs(dy) >= 1.4) continue;
      const vx = shot.vel.x;
      const vz = shot.vel.z;
      this.vfx.projectileImpact(shot.mesh.position);
      this.spits.deactivate(shot);
      this._damagePlayer(TOWER_ARENA.GALE.DAMAGE);
      this.player.applyKnockback(vx, vz, TOWER_ARENA.GALE.KNOCKBACK);
    }
  }

  _updateThreats(dt, t, playerPos) {
    for (const enemy of this.enemies) {
      enemy.update(dt, t, playerPos);
      if (enemy.attackReady) {
        enemy.attackReady = false;
        this._damagePlayer(TOWER_ARENA.GARGOYLE.DAMAGE);
        const dx = playerPos.x - enemy.pos.x;
        const dz = playerPos.z - enemy.pos.z;
        const distance = Math.hypot(dx, dz) || 1;
        this.player.applyKnockback(
          dx / distance, dz / distance, TOWER_ARENA.GARGOYLE.KNOCKBACK,
        );
      }
      if (enemy.spitRequested) {
        enemy.spitRequested = false;
        enemy.muzzle(this._vSpit);
        this._vDir.copy(playerPos).sub(this._vSpit).normalize();
        this.spits.fire(this._vSpit, this._vDir, TOWER_ARENA.GALE.SHOT_SPEED, 4);
      }
    }
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (!this.enemies[i].dead) continue;
      this.enemies[i].dispose();
      this.enemies.splice(i, 1);
    }
  }

  update(dt, t, playerPos) {
    this._updateFeel(dt);
    this.vfx.update(dt);
    if (!this.active || !this.player.controls.isLocked) return;
    this._time += dt;
    this._updatePlayerFire(dt);
    this.bolts.update(dt, this.world);
    this.spits.update(dt, this.world);
    this._testPlayerBolts();
    this._testHostileShots(playerPos);
    this._updateThreats(dt, t, playerPos);
  }

  _disposeThreats() {
    for (const enemy of this.enemies) enemy.dispose();
    this.enemies.length = 0;
  }

  abortFight() {
    this._disposeThreats();
    this._stage = -1;
    super.abortFight();
    this.vfx.reset();
  }

  stop() {
    this._disposeThreats();
    this.bolts.clear();
    this.spits.clear();
    this.active = false;
    this._origin = null;
    this.setOvercharge(false);
    this._hideHud();
  }

  dispose() {
    super.dispose();
    this.vfx.dispose();
    this._onTowerEvent = null;
  }
}
