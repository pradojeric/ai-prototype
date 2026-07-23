// ============================================================
// RAIL COMBAT MANAGER — manual Arena 2 pressure built on CombatManager's player
// bolts, health/HUD, Lumina hooks, fire cadence, and feedback. It owns River
// Sniper projectiles, reflected-shot attribution, Frenzied Boarder attacks, and
// randomized open-water spawning; the RailArenaController owns encounter pacing.
// ============================================================
import * as THREE from 'three';
import { CONFIG, COMBAT, RAIL_ARENA, mulberry32 } from '../../config.js';
import { CombatManager } from '../combat/CombatManager.js';
import { RailThreat } from './RailThreat.js';

export class RailCombatManager extends CombatManager {
  constructor(scene, world, player, camera, viewmodel, audio) {
    super(scene, world, player, camera, viewmodel, audio, { navigation: false });
    this._rng = mulberry32((world.zone.seed ^ 0x5241494c) >>> 0);
    this._riddleScale = 1;
    this._zephyrScale = 1;
    this._vTarget = new THREE.Vector3();
    this.setHudProfile({ healthLabel: 'Boat Integrity', waveLabel: 'River Threats' });
  }

  startFight(origin) {
    if (this.active) return;
    this.active = true;
    this._origin = origin.clone();
    this.hp = COMBAT.PLAYER_HP;
    this._playerDied = false;
    this._riddleScale = 1;
    this._zephyrScale = 1;
    this.hud.show();
    this.hud.setWave(0, '∞');
    this.hud.setBossWaves(true);
    this._updateHealthUi();
    this._updateWaveLeft();
  }

  setRiddlePressure(active) {
    this._riddleScale = active ? RAIL_ARENA.RIDDLE_THREAT_SCALE : 1;
  }

  setZephyrSlow(active) {
    this._zephyrScale = active ? RAIL_ARENA.ZEPHYR_THREAT_SCALE : 1;
  }

  spawnRandomGroup(minSize = 1, maxSize = 3) {
    const low = Math.max(1, Math.floor(minSize));
    const high = Math.max(low, Math.floor(maxSize));
    const size = low + Math.floor(this._rng() * (high - low + 1));
    if (size === 1) {
      const sniper = this._rng() < 0.5;
      return this.spawnWave(sniper ? 1 : 0, sniper ? 0 : 1, 1);
    }
    if (size === 2) return this.spawnWave(1, 1, 2);
    return this._rng() < 0.5
      ? this.spawnWave(2, 1, size)
      : this.spawnWave(1, 2, size);
  }

  // Spawn an explicit composition while respecting the shared live+pending cap.
  // `requestedSize` keeps larger random groups from silently growing past three.
  spawnWave(snipers, boarders, requestedSize = snipers + boarders) {
    if (!this.active) return 0;
    let room = Math.max(0, RAIL_ARENA.MAX_THREATS - this._aliveCount());
    room = Math.min(room, requestedSize);
    let spawned = 0;
    for (let i = 0; i < snipers && room > 0; i++, room--) {
      const spawn = this._pickRiverSpawn('sniper');
      if (!spawn) break;
      const { x, z } = spawn;
      this._vSpawn.set(x, CONFIG.WATER_LEVEL + 0.06, z);
      this._queueEnemySpawn('sniper', this._vSpawn,
        () => new RailThreat(this.scene, 'sniper', x, z, this._rng));
      spawned++;
    }
    for (let i = 0; i < boarders && room > 0; i++, room--) {
      const spawn = this._pickRiverSpawn('boarder');
      if (!spawn) break;
      const { x, z } = spawn;
      this._vSpawn.set(x, CONFIG.WATER_LEVEL + 0.06, z);
      this._queueEnemySpawn('boarder', this._vSpawn,
        () => new RailThreat(this.scene, 'boarder', x, z, this._rng));
      spawned++;
    }
    this._updateWaveLeft();
    if (spawned > 0) this._punchWaveHud();
    return spawned;
  }

  _pickRiverSpawn(type) {
    const [zMin, zMax] = type === 'sniper'
      ? RAIL_ARENA.SNIPER_Z_RANGE : RAIL_ARENA.BOARDER_Z_RANGE;
    const separationSq = RAIL_ARENA.SPAWN_MIN_SEPARATION ** 2;

    for (let tries = 0; tries < 24; tries++) {
      const x = (this._rng() * 2 - 1) * RAIL_ARENA.RIVER_X_LIMIT;
      const z = zMin + this._rng() * (zMax - zMin);
      let clear = true;
      for (const pending of this._pending) {
        const dx = x - pending.x;
        const dz = z - pending.z;
        if (dx * dx + dz * dz < separationSq) { clear = false; break; }
      }
      if (!clear) continue;
      for (const threat of this.enemies) {
        if (!threat.alive) continue;
        const dx = x - threat.group.position.x;
        const dz = z - threat.group.position.z;
        if (dx * dx + dz * dz < separationSq) { clear = false; break; }
      }
      if (clear) return { x, z };
    }
    // Never break the open-water separation promise just to fill a group. The
    // controller retries quickly when a crowded river has no valid slot.
    return null;
  }

  _playDamageSound() { this.audio.playHullImpact(); }

  _defeatThreat(threat, position, reflected = false) {
    if (!threat.hit(reflected ? threat.hp : COMBAT.BOLT.DAMAGE, reflected)) {
      this.audio.playHit();
      this.vfx.impact(position, threat.type);
      return false;
    }
    this.vfx.death(position, threat.type);
    this.vfx.residue(position, threat.type);
    this.audio.playEnemyDeath();
    this._hitstop = COMBAT.FEEL.HITSTOP;
    this._updateWaveLeft();
    if (this._onEnemyDefeated) this._onEnemyDefeated(threat.type, position, 1);
    return true;
  }

  _reflectShot(playerBolt, hostileShot) {
    this.bolts.deactivate(playerBolt);
    hostileShot.owner = 'player';
    hostileShot.reflected = true;
    hostileShot.life = 2.5;
    const source = hostileShot.source;
    if (source && source.alive) {
      source.center(this._vTarget);
      hostileShot.vel.copy(this._vTarget).sub(hostileShot.mesh.position)
        .normalize().multiplyScalar(RAIL_ARENA.SNIPER.SHOT_SPEED * 1.35);
    } else {
      hostileShot.vel.multiplyScalar(-1.35);
    }
    this.audio.playBoltReflect();
    this._hitMarker();
  }

  update(dt, t, playerPos) {
    this._updateFeel(dt);
    if (!this.active) {
      if (this.enemies.length) this._reapRail(dt, t, playerPos, 1);
      return;
    }
    if (!this.player.controls.isLocked) { this._fireRequested = false; return; }
    this._updatePending(dt);

    this._updatePlayerFire(dt);
    const threatScale = Math.min(this._riddleScale, this._zephyrScale);
    let threatDt = dt * threatScale;
    if (this._hitstop > 0) {
      this._hitstop = Math.max(0, this._hitstop - dt);
      threatDt *= COMBAT.FEEL.HITSTOP_SCALE;
    }
    this.bolts.update(dt, this.world);
    this.spits.update(threatDt, this.world);

    // Player bolts first parry incoming sniper shots, then damage live threats.
    for (const bolt of this.bolts.slots) {
      if (!bolt.active) continue;
      let reflected = false;
      for (const shot of this.spits.slots) {
        if (!shot.active || shot.reflected) continue;
        if (bolt.mesh.position.distanceToSquared(shot.mesh.position) > 0.5 ** 2) continue;
        this._reflectShot(bolt, shot);
        reflected = true;
        break;
      }
      if (reflected || !bolt.active) continue;
      for (const threat of this.enemies) {
        if (!threat.alive) continue;
        threat.center(this._vEnemy);
        const radius = threat.radius + COMBAT.BOLT.RADIUS;
        if (bolt.mesh.position.distanceToSquared(this._vEnemy) > radius * radius) continue;
        this.bolts.deactivate(bolt);
        this._hitMarker();
        this._defeatThreat(threat, this._vEnemy, false);
        break;
      }
    }

    for (const shot of this.spits.slots) {
      if (!shot.active) continue;
      if (shot.reflected) {
        const source = shot.source;
        if (!source || !source.alive) { this.spits.deactivate(shot); continue; }
        source.center(this._vEnemy);
        const radius = source.radius + COMBAT.BOLT.RADIUS;
        if (shot.mesh.position.distanceToSquared(this._vEnemy) > radius * radius) continue;
        this.spits.deactivate(shot);
        this._defeatThreat(source, this._vEnemy, true);
        continue;
      }
      const dx = shot.mesh.position.x - playerPos.x;
      const dz = shot.mesh.position.z - playerPos.z;
      const dy = shot.mesh.position.y - playerPos.y;
      if (dx * dx + dz * dz > 0.85 ** 2 || Math.abs(dy) > 1.6) continue;
      // Trace back along the shot so the damage arc points at the sniper.
      this._vSource.copy(shot.mesh.position).addScaledVector(shot.vel, -0.5);
      this.vfx.projectileImpact(shot.mesh.position);
      this.spits.deactivate(shot);
      this.damage(RAIL_ARENA.SNIPER.DAMAGE, this._vSource);
    }

    this.hud.trackThreats(this.enemies, this.camera, dt);
    this._reapRail(threatDt, t, playerPos, dt);
    for (const threat of this.enemies) {
      if (threat.attackReady) {
        threat.attackReady = false;
        threat.center(this._vSource);
        this.damage(RAIL_ARENA.BOARDER.DAMAGE, this._vSource);
      }
      if (threat.shotRequested) {
        threat.shotRequested = false;
        threat.muzzle(this._vSpit);
        this._vDir.copy(playerPos).sub(this._vSpit).normalize();
        this.spits.fire(
          this._vSpit, this._vDir, RAIL_ARENA.SNIPER.SHOT_SPEED, 4,
          { owner: 'enemy', source: threat },
        );
      }
    }
    this._updateWaveLeft();
  }

  _reapRail(simDt, t, playerPos, realDt) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const threat = this.enemies[i];
      threat.update(threat.alive ? simDt : realDt, t, playerPos);
      if (!threat.dead) continue;
      threat.dispose();
      this.enemies.splice(i, 1);
    }
  }

  abortFight() {
    super.abortFight();
    this._riddleScale = 1;
    this._zephyrScale = 1;
  }
}
