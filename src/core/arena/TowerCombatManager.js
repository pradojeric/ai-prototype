import { CombatManager } from '../combat/CombatManager.js';
import { COMBAT, TOWER_ARENA, mulberry32 } from '../../config.js';
import { TowerThreat } from './TowerThreat.js';

const BOSS_GROUPS = [
  ['gargoyle'],
  ['gargoyle', 'gale'],
  ['gargoyle', 'gargoyle', 'gale'],
];
const MIN_ADD_PLAYER_DISTANCE = 3.4;
const MIN_ADD_SEPARATION = 2.2;

export class TowerCombatManager extends CombatManager {
  constructor(scene, world, player, camera, viewmodel, audio) {
    super(scene, world, player, camera, viewmodel, audio, { navigation: false });
    this.enemies = [];
    this._flights = world.towerFlightAnchors || [];
    this._gargoyleAnchors = world.towerGargoyleAnchors || [];
    this._bossAnchors = world.towerBossAddAnchors || [];
    this._summit = world.towerSummitBounds || {
      height: TOWER_ARENA.SUMMIT_HEIGHT,
      combatRadius: 6.8,
    };
    this._mode = 'ascent';
    this._attempt = 0;
    this._rng = Math.random;
    this._galeTimer = Infinity;
    this._bossAnchorCursor = 0;
    this._time = 0;
    this._onTowerEvent = null;
  }

  setTowerEventHandler(handler) { this._onTowerEvent = handler; }

  _resetCombatFeel() {
    this._fireCooldown = 0;
    this._fireRequested = false;
    this._hitstop = 0;
    this._hurtTimer = 0;
    this._fovPunch = 0;
    this.camera.fov = this._baseFov;
    this.camera.updateProjectionMatrix();
    this.hud.hurt(false);
    this.setOvercharge(false);
    this._alabActive = false;
    this._alabCooldown = 0;
    this.hud.setAlab(this._alabCharge, false);
  }

  startFight({ mode = 'ascent', attempt = 1 } = {}) {
    this._clearAllThreats();
    this.cancelPendingSpawns();
    this.bolts.clear();
    this.spits.clear();
    this.vfx.reset();
    this.active = true;
    this.hp = COMBAT.PLAYER_HP;
    this._playerDied = false;
    this.player.setJumpEnabled(true);
    this._resetCombatFeel();
    this._mode = mode;
    this._attempt = attempt;
    this._time = 0;
    const seed = (this.world.zone?.seed || 1) ^ Math.imul(attempt, 0x9e3779b1);
    this._rng = mulberry32(seed >>> 0);
    this._bossAnchorCursor = Math.floor(this._rng() * Math.max(1, this._bossAnchors.length));
    this._galeTimer = mode === 'ascent'
      ? this._randomRange(TOWER_ARENA.GALE.INITIAL_SPAWN)
      : Infinity;

    this.hud.setProfile({
      healthLabel: 'Liwanag',
      waveLabel: mode === 'boss' ? 'Summoned Echoes' : 'Tower Threats',
    });
    this.hud.setBossWaves(mode === 'boss');
    this.hud.show({ wave: mode === 'boss' });
    this._updateHealthUi();
    if (mode === 'ascent') this._placeAuthoredGargoyles();
    this._updateWaveLeft();
  }

  beginBossPhase() {
    this._clearAllThreats();
    this.cancelPendingSpawns();
    this.bolts.clear();
    this.spits.clear();
    this._mode = 'boss';
    this._galeTimer = Infinity;
    this.hud.setProfile({ healthLabel: 'Liwanag', waveLabel: 'Summoned Echoes' });
    this.hud.setBossWaves(true);
    this.hud.show({ wave: true });
    this._updateWaveLeft();
  }

  _randomRange(range) { return range[0] + this._rng() * (range[1] - range[0]); }

  _placeAuthoredGargoyles() {
    for (const anchor of this._gargoyleAnchors) {
      this.enemies.push(new TowerThreat(
        this.scene,
        this.world,
        'gargoyle',
        anchor,
        this.player,
        { placed: true, rng: this._rng },
      ));
    }
  }

  _anchorNear(height) {
    let nearest = this._flights[0];
    let best = Infinity;
    for (const flight of this._flights) {
      const delta = Math.abs(flight.y - height);
      if (delta < best) { nearest = flight; best = delta; }
    }
    return nearest || {
      x: 0,
      y: height,
      z: 0,
      rotation: 0,
      halfW: 1.6,
      halfD: 3,
      startHeight: height,
      endHeight: height,
    };
  }

  _typeCount(type) {
    let count = 0;
    for (const pending of this._pending) if (pending.type === type) count++;
    for (const enemy of this.enemies) if (enemy.alive && enemy.type === type) count++;
    return count;
  }

  _queueTowerThreat(type, anchor, options = {}) {
    if (this._aliveCount() >= TOWER_ARENA.MAX_THREATS) return false;
    if (type === 'gale' && this._typeCount('gale') >= TOWER_ARENA.MAX_GALES) return false;
    TowerThreat.portalPosition(anchor, type, this._vSpawn, options);
    this._queueEnemySpawn(type, this._vSpawn, () => new TowerThreat(
      this.scene,
      this.world,
      type,
      anchor,
      this.player,
      { ...options, rng: this._rng },
    ));
    this._updateWaveLeft();
    return true;
  }

  spawnPenaltyGargoyle(height) {
    if (!this.active || this._mode !== 'ascent') return;
    const flight = this._anchorNear(height);
    const anchor = {
      ...flight,
      localX: (this._rng() < 0.5 ? -1 : 1) * 0.65,
      localZ: Math.min(flight.halfD - 1, 2.5),
    };
    if (this._queueTowerThreat('gargoyle', anchor)) {
      this._onTowerEvent?.('A seal calls another Gargoyle', 'warning');
    }
  }

  _galeSpawnClear(x, z, y) {
    if (this.world.collidesAt(x, z, TOWER_ARENA.GALE.RADIUS, y)) return false;
    for (const enemy of this.enemies) {
      if (!enemy.alive || enemy.type !== 'gale') continue;
      if (Math.hypot(x - enemy.pos.x, z - enemy.pos.z) < TOWER_ARENA.GALE.SPAWN_SEPARATION) {
        return false;
      }
    }
    for (const pending of this._pending) {
      if (pending.type !== 'gale') continue;
      if (Math.hypot(x - pending.x, z - pending.z) < TOWER_ARENA.GALE.SPAWN_SEPARATION) {
        return false;
      }
    }
    return true;
  }

  _centralGaleAnchor(playerY) {
    const minRadiusSq = TOWER_ARENA.GALE.CENTER_MIN_RADIUS ** 2;
    const maxRadiusSq = TOWER_ARENA.GALE.CENTER_RADIUS ** 2;
    for (let attempt = 0; attempt < 20; attempt++) {
      const angle = this._rng() * Math.PI * 2;
      const radius = Math.sqrt(minRadiusSq + this._rng() * (maxRadiusSq - minRadiusSq));
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (this._galeSpawnClear(x, z, playerY)) {
        return { spawnX: x, spawnY: playerY, spawnZ: z };
      }
    }
    return null;
  }

  _spawnAscentGale(playerPos) {
    const anchor = this._centralGaleAnchor(playerPos.y);
    if (!anchor || !this._queueTowerThreat('gale', anchor)) return false;
    this._onTowerEvent?.('A Gale Whisper rises through the tower heart', 'warning');
    return true;
  }

  _updateGaleSpawner(dt, playerPos) {
    if (this._mode !== 'ascent') return;
    this._galeTimer -= dt;
    if (this._galeTimer > 0) return;
    if (this._spawnAscentGale(playerPos)) {
      this._galeTimer = this._randomRange(TOWER_ARENA.GALE.SPAWN_INTERVAL);
    } else {
      this._galeTimer = 0.75;
    }
  }

  _bossAnchorAvailable(anchor, playerPos, reserved) {
    if (Math.hypot(anchor.x - playerPos.x, anchor.z - playerPos.z) < MIN_ADD_PLAYER_DISTANCE) {
      return false;
    }
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      if (Math.hypot(anchor.x - enemy.pos.x, anchor.z - enemy.pos.z) < MIN_ADD_SEPARATION) {
        return false;
      }
    }
    for (const pending of this._pending) {
      if (Math.hypot(anchor.x - pending.x, anchor.z - pending.z) < MIN_ADD_SEPARATION) {
        return false;
      }
    }
    return !reserved.some((other) =>
      Math.hypot(anchor.x - other.x, anchor.z - other.z) < MIN_ADD_SEPARATION);
  }

  _nextBossAnchor(playerPos, reserved) {
    for (let offset = 0; offset < this._bossAnchors.length; offset++) {
      const index = (this._bossAnchorCursor + offset) % this._bossAnchors.length;
      const anchor = this._bossAnchors[index];
      if (!this._bossAnchorAvailable(anchor, playerPos, reserved)) continue;
      this._bossAnchorCursor = (index + 1) % this._bossAnchors.length;
      return anchor;
    }
    return null;
  }

  spawnBossGroup(phase) {
    if (!this.active || this._mode !== 'boss') return;
    const playerPos = this.player.controls.getObject().position;
    const reserved = [];
    for (const type of BOSS_GROUPS[Math.max(0, Math.min(2, phase))]) {
      const anchor = this._nextBossAnchor(playerPos, reserved);
      if (!anchor) break;
      reserved.push(anchor);
      if (type === 'gargoyle') {
        this._queueTowerThreat(type, anchor, { boss: true });
        continue;
      }
      const length = Math.hypot(anchor.x, anchor.z) || 1;
      const galeAnchor = {
        ...anchor,
        spawnX: anchor.x / length * (TOWER_ARENA.GALE.CENTER_RADIUS - 0.3),
        spawnY: this._summit.height + 1.4,
        spawnZ: anchor.z / length * (TOWER_ARENA.GALE.CENTER_RADIUS - 0.3),
      };
      this._queueTowerThreat(type, galeAnchor, { boss: true });
    }
    this._updateWaveLeft();
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
        this._hitMarker();
        const applied = Math.min(enemy.hp, this.boltDamage);
        const defeated = enemy.hit(this.boltDamage);
        this.hud.popupDamage(this._vEnemy, applied);
        this.registerPlayerBoltHit(defeated);
        this.vfx.enemyImpact(this._vEnemy, enemy.type, defeated);
        if (defeated) {
          this.audio.playEnemyDeath();
          this._hitstop = COMBAT.FEEL.HITSTOP;
          this._onEnemyDefeated?.(enemy.type, this._vEnemy, 1);
          this._updateWaveLeft();
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
      const source = shot.source;
      this.vfx.projectileImpact(shot.mesh.position);
      this._vSource.copy(shot.mesh.position).addScaledVector(shot.vel, -0.5);
      this.spits.deactivate(shot);
      this._damagePlayer(source?.projectileDamage ?? TOWER_ARENA.GALE.DAMAGE, this._vSource);
      this.player.applyKnockback(
        vx,
        vz,
        source?.projectileKnockback ?? TOWER_ARENA.GALE.KNOCKBACK,
      );
    }
  }

  _updateThreats(dt, t, playerPos) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.update(enemy.alive ? dt : Math.max(dt, 0.016), t, playerPos);
      if (enemy.attackReady) {
        enemy.attackReady = false;
        this._damagePlayer(enemy.cfg.DAMAGE, enemy.pos);
        const dx = playerPos.x - enemy.pos.x;
        const dz = playerPos.z - enemy.pos.z;
        const distance = Math.hypot(dx, dz) || 1;
        this.player.applyKnockback(dx / distance, dz / distance, enemy.cfg.KNOCKBACK);
      }
      if (enemy.spitRequested) {
        enemy.spitRequested = false;
        enemy.muzzle(this._vSpit);
        this._vDir.copy(playerPos).sub(this._vSpit).normalize();
        this.spits.fire(
          this._vSpit,
          this._vDir,
          TOWER_ARENA.GALE.SHOT_SPEED,
          4,
          { source: enemy },
        );
      }
      if (!enemy.dead) continue;
      enemy.dispose();
      this.enemies.splice(i, 1);
    }
  }

  update(dt, t, playerPos) {
    this._updateFeel(dt);
    if (!this.active) return;
    this._updatePending(dt);
    if (!this.player.controls.isLocked) { this._fireRequested = false; return; }
    this._time += dt;
    this._updateGaleSpawner(dt, playerPos);
    this._updatePlayerFire(dt);
    this.hud.trackThreats(this.enemies, this.camera, dt);
    this.bolts.update(dt, this.world);
    this.spits.update(dt, this.world);
    this._testPlayerBolts();
    this._testHostileShots(playerPos);
    this._updateThreats(dt, t, playerPos);
  }

  _clearAllThreats() {
    for (const enemy of this.enemies) enemy.dispose();
    this.enemies.length = 0;
  }

  abortFight({ preserveVfx = false } = {}) {
    this._clearAllThreats();
    this.cancelPendingSpawns();
    this.bolts.clear();
    this.spits.clear();
    this._galeTimer = Infinity;
    this.active = false;
    this.hp = COMBAT.PLAYER_HP;
    this._playerDied = false;
    this.player.setJumpEnabled(false);
    this._resetCombatFeel();
    if (!preserveVfx) this.vfx.reset();
    this._hideHud();
  }

  stop(options = {}) { this.abortFight(options); }

  dispose() {
    super.dispose();
    this._onTowerEvent = null;
  }
}
