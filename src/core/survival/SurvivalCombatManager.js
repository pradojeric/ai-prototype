// ============================================================
// SURVIVAL COMBAT MANAGER — threats, weapons, health, hazards, and rewards.
// ============================================================
import * as THREE from 'three';
import {
  CONFIG, COMBAT, LUMINA, RAIL_ARENA, TOWER_ARENA,
} from '../../config.js';
import { CombatManager } from '../combat/CombatManager.js';
import { Enemy } from '../combat/Enemy.js';
import { RailThreat } from '../arena/RailThreat.js';
import { TowerThreat } from '../arena/TowerThreat.js';
import { LuminaManager } from '../arena/LuminaManager.js';
import { SurvivalWeapons } from './SurvivalWeapons.js';
import {
  composeSurvivalThreatProfile,
  getSurvivalThreatCapacity,
  getSurvivalThreatScaling,
  SURVIVAL_ROLE_BASE_HP,
  SURVIVAL_THREAT_CAP,
} from './SurvivalRules.js';
import { SURVIVAL_DASH_DEFAULTS } from './SurvivalDashRules.js';
import {
  SURVIVAL_LIGHT_BOLT,
  getSurvivalBuildEffects,
} from './SurvivalUpgrades.js';
import { segmentSphereHitFraction } from './SurvivalProjectileRules.js';

const ELITE_COLORS = Object.freeze({
  armored: 0xffcf54,
  frenzied: 0xff5f52,
  volatile: 0xb76cff,
});
const BASE_PLAYER_HP = COMBAT.PLAYER_HP;
const PROJECTILE_WORLD_STEP = 0.25;

const ROLE_CONFIGS = Object.freeze({
  chaser: COMBAT.CHASER,
  spitter: COMBAT.SPITTER,
  boarder: RAIL_ARENA.BOARDER,
  sniper: RAIL_ARENA.SNIPER,
  gargoyle: TOWER_ARENA.GARGOYLE,
  gale: TOWER_ARENA.GALE,
});

function scaledThreatConfig(role, multipliers) {
  const base = ROLE_CONFIGS[role];
  const profile = { ...base };
  profile.HP = (SURVIVAL_ROLE_BASE_HP[role] ?? base.HP) * multipliers.hpMultiplier;
  if (base.DAMAGE !== undefined) {
    profile.DAMAGE = base.DAMAGE * multipliers.damageMultiplier;
  }
  if (base.SPEED !== undefined) profile.SPEED = base.SPEED * multipliers.speedMultiplier;
  for (const key of ['ATTACK_COOLDOWN', 'ATTACK_INTERVAL', 'SPIT_INTERVAL', 'SHOT_INTERVAL']) {
    if (base[key] !== undefined) {
      profile[key] = base[key] * multipliers.attackIntervalMultiplier;
    }
  }
  for (const key of ['SPIT_SPEED', 'SHOT_SPEED']) {
    if (base[key] !== undefined) {
      profile[key] = base[key] * multipliers.projectileSpeedMultiplier;
    }
  }
  return Object.freeze(profile);
}

function raySphereDistance(origin, direction, center, radius) {
  const ox = center.x - origin.x;
  const oy = center.y - origin.y;
  const oz = center.z - origin.z;
  const projection = ox * direction.x + oy * direction.y + oz * direction.z;
  if (projection < 0) return Infinity;
  const perpendicularSq = ox * ox + oy * oy + oz * oz - projection * projection;
  const radiusSq = radius * radius;
  if (perpendicularSq > radiusSq) return Infinity;
  return projection - Math.sqrt(Math.max(0, radiusSq - perpendicularSq));
}

export class SurvivalCombatManager extends CombatManager {
  constructor(scene, world, player, camera, viewmodel, audio, options = {}) {
    super(scene, world, player, camera, viewmodel, audio, {
      navigation: false,
      tearPoolSize: SURVIVAL_THREAT_CAP,
    });
    this.rng = options.rng || Math.random;
    this.onThreatDefeated = options.onThreatDefeated || null;
    this.onPlayerDefeated = options.onPlayerDefeated || null;

    this._maxHp = BASE_PLAYER_HP;
    this.build = null;
    this.effects = null;
    this.currentWave = 1;
    this.currentScaling = getSurvivalThreatScaling(1);
    this.boss = null;
    this._volatileHazards = [];
    this._bossDefeatReported = false;

    this.weapons = new SurvivalWeapons(this, scene, camera, viewmodel, audio);
    this.lumina = new LuminaManager(scene, player, audio);

    this._laserCenter = new THREE.Vector3();
    this._laserTargetCenter = new THREE.Vector3();
    this._laserHit = new THREE.Vector3();
    this._laserBossImpact = new THREE.Vector3();
    this._spawnPosition = new THREE.Vector3();
    this._projectileSource = new THREE.Vector3();
    this._projectileImpact = new THREE.Vector3();
    this._projectileDirection = new THREE.Vector3();
    this._projectileEnd = new THREE.Vector3();
  }

  get maxHp() { return this._maxHp; }

  get primaryDamageMultiplier() { return this._overchargeDamageMult; }

  get firing() { return this.weapons.firing; }

  get alabActive() { return this._alabActive && this._alabCharge > 0; }

  get weaponSnapshot() { return this.weapons.snapshot; }

  get volatileHazardCount() { return this._volatileHazards.length; }

  startRun(build, seed = 1) {
    this.active = true;
    this._playerDied = false;
    this._bossDefeatReported = false;
    this._volatileHazards.length = 0;
    this._pending.length = 0;
    this.currentWave = 1;
    this.setBuild(build, { refill: true });
    this.hp = this.maxHp;
    this.resetAlab();
    this.weapons.reset();
    this.weapons.setBuild(build);
    this.lumina.beginAttempt(this, seed);
    this.player.setJumpEnabled(true);
    this.player.enableDash(this._dashConfig(), () => this.audio?.playSurvivalDash?.());
    this.hud.setProfile({ healthLabel: 'Memory Thread', waveLabel: 'Endless Echoes' });
    this.hud.show({ wave: false });
    this._updateHealthUi();
  }

  setBuild(build, { refill = false } = {}) {
    const oldMax = this._maxHp || BASE_PLAYER_HP;
    this.build = build;
    this.effects = getSurvivalBuildEffects(build);
    this._maxHp = BASE_PLAYER_HP + this.effects.maxHealthBonus;
    if (refill) this.hp = this._maxHp;
    else this.hp = Math.min(this._maxHp, this.hp + Math.max(0, this._maxHp - oldMax));

    this.weapons.setBuild(build);
    this.player.updateDashConfig(this._dashConfig());
    const affinity = this.effects.lumina.rank;
    this.lumina.configure({
      dropChance: LUMINA.DROP_CHANCE + this.effects.lumina.dropChanceBonus,
      heal: LUMINA.HEAL + affinity * 5,
      zephyrDuration: LUMINA.ZEPHYR_DURATION + affinity * 1.5,
      overchargeDuration: LUMINA.OVERCHARGE_DURATION + affinity * 1.5,
    });
    this._updateHealthUi();
  }

  _dashConfig() {
    const dash = this.effects?.dash || { rank: 0, charges: 1 };
    return {
      ...SURVIVAL_DASH_DEFAULTS,
      charges: dash.charges,
      recharge: dash.rank >= 1 ? 3.2 : SURVIVAL_DASH_DEFAULTS.recharge,
      distance: dash.rank >= 3 ? 6 : SURVIVAL_DASH_DEFAULTS.distance,
    };
  }

  beginWave(wave, roles, eliteSlots = []) {
    this.currentWave = wave;
    this.currentScaling = getSurvivalThreatScaling(wave);
    this._bossDefeatReported = false;
    this.hud.setWave(wave, '∞');
    const capacity = getSurvivalThreatCapacity(this._liveThreatCount(), this._pending.length);
    const count = Math.min(capacity, roles.length);
    for (let i = 0; i < count; i++) {
      this._queueRole(roles[i], eliteSlots[i] || null, i);
    }
    this._updateWaveLeft();
    this.audio?.playWaveStart?.();
  }

  prepareBossWave(wave) {
    this.currentWave = wave;
    this.currentScaling = getSurvivalThreatScaling(wave);
    this._bossDefeatReported = false;
    this.clearThreats({ immediate: true });
    this.hud.setWave(wave, '∞');
  }

  _queueRole(role, eliteId = null, sequence = 0) {
    const lanes = this.world.survivalSpawnLanes || [];
    const lane = lanes.length
      ? lanes[(Math.floor(this.rng() * lanes.length) + sequence) % lanes.length]
      : { spawn: { x: 0, z: 20 }, inward: { x: 0, z: -1 } };
    const tangentX = -lane.inward.z;
    const tangentZ = lane.inward.x;
    const offset = (this.rng() - 0.5) * 2.4;
    const x = lane.spawn.x + tangentX * offset;
    const z = lane.spawn.z + tangentZ * offset;
    const composed = composeSurvivalThreatProfile(this.currentWave, eliteId);
    const profile = scaledThreatConfig(role, composed);
    const presentation = eliteId
      ? { eliteType: eliteId, color: ELITE_COLORS[eliteId] }
      : undefined;
    this._spawnPosition.set(
      x,
      role === 'gale' ? CONFIG.EYE_HEIGHT + 0.7 : CONFIG.WATER_LEVEL + 0.06,
      z,
    );
    const spawnY = this._spawnPosition.y;
    this._queueEnemySpawn(role, this._spawnPosition, () => {
      const common = { profile, presentation, rng: this.rng };
      let threat;
      if (role === 'chaser' || role === 'spitter') {
        threat = new Enemy(this.scene, this.world, role, x, z, 0, 1, common);
      } else if (role === 'boarder' || role === 'sniper') {
        threat = new RailThreat(this.scene, role, x, z, this.rng, {
          ...common,
          mobileTarget: true,
          world: this.world,
        });
      } else {
        threat = new TowerThreat(
          this.scene,
          this.world,
          role,
          { spawnX: x, spawnY, spawnZ: z },
          this.player,
          common,
        );
      }
      threat.survivalProfile = composed;
      return threat;
    });
    if (eliteId) this.audio?.playSurvivalEliteWarning?.(eliteId);
  }

  // --- Guardian summons ------------------------------------------------------
  // These three methods exist ONLY for boss summons — waves enter through
  // spawnWave/_queueRole — so they are the one choke point every add must pass.
  // Each defers to the live boss's own `allowSummons`, which Survival sets false:
  // gating the bosses' individual call sites is not enough, because a boss can
  // summon from several places (the Feastkeeper's enrage bypassed its own clock)
  // and a future one will add more.
  get _summonsSuppressed() {
    return !!this.boss && this.boss.allowSummons === false;
  }

  // Authored Guardian summons enter through the same capped, telegraphed path.
  spawnExtra(chasers = 0, spitters = 0) {
    if (this._summonsSuppressed) return;
    const roles = [
      ...Array(Math.max(0, Math.floor(chasers))).fill('chaser'),
      ...Array(Math.max(0, Math.floor(spitters))).fill('spitter'),
    ];
    const room = getSurvivalThreatCapacity(this._liveThreatCount(), this._pending.length);
    roles.slice(0, room).forEach((role, index) => this._queueRole(role, null, index));
  }

  spawnRandomGroup(min = 1, max = min) {
    if (this._summonsSuppressed) return;
    const low = Math.max(0, Math.floor(min));
    const high = Math.max(low, Math.floor(max));
    const count = low + Math.floor(this.rng() * (high - low + 1));
    const roles = ['boarder', 'sniper'];
    const room = getSurvivalThreatCapacity(this._liveThreatCount(), this._pending.length);
    for (let i = 0; i < Math.min(count, room); i++) {
      this._queueRole(roles[Math.floor(this.rng() * roles.length)], null, i);
    }
  }

  spawnBossGroup(phase = 0) {
    if (this._summonsSuppressed) return;
    const count = Math.min(2 + phase, getSurvivalThreatCapacity(
      this._liveThreatCount(), this._pending.length,
    ));
    for (let i = 0; i < count; i++) this._queueRole(i % 2 ? 'gale' : 'gargoyle', null, i);
  }

  setBoss(boss) {
    this.boss = boss;
    this._bossDefeatReported = false;
    if (!boss) {
      this.hud.hideBoss();
      return;
    }
    this.hud.setBoss({
      name: boss.tuning.SURVIVAL_LABEL || 'Guardian',
      hp: boss.hp,
      maxHp: boss.maxHp,
    });
  }

  clearBoss() {
    this.boss = null;
    this._bossDefeatReported = false;
    this.hud.hideBoss();
  }

  setFiring(flag) { this.weapons.setFiring(flag); }

  requestFire() {
    this.weapons.setFiring(true);
    this.weapons.update(0, this.alabActive);
    this.weapons.setFiring(false);
  }

  cancelInput() {
    this.weapons.cancelInput();
    this._meleeRequested = false;
    this.player.clearDashInput({ stop: true });
  }

  activateAlab() {
    if (this._alabActive || this._alabCharge < 0.999) return false;
    this._alabActive = true;
    this.hud.setAlab(this._alabCharge, true);
    return true;
  }

  registerPlayerBoltHit(defeated = false) {
    if (this._alabActive) return;
    const gain = (COMBAT.ALAB.HIT_GAIN + (defeated ? COMBAT.ALAB.KILL_GAIN : 0)) *
      this.effects.alab.chargeGainMultiplier;
    const wasFull = this._alabCharge >= 1;
    this._alabCharge = Math.min(1, this._alabCharge + gain);
    this.hud.setAlab(this._alabCharge, false);
    if (!wasFull && this._alabCharge >= 1) {
      document.dispatchEvent(new CustomEvent('strings:alab-ready'));
    }
  }

  _updateAlab(dt) {
    if (!this._alabActive) return;
    const duration = COMBAT.ALAB.FULL_DURATION + this.effects.alab.durationBonusSeconds;
    this._alabCharge = Math.max(0, this._alabCharge - dt / duration);
    if (this._alabCharge <= 0) this._alabActive = false;
    this.hud.setAlab(this._alabCharge, this._alabActive);
  }

  firePrimaryProjectile(spec) {
    this.viewmodel.getMuzzleWorld(this._vMuzzle);
    this.camera.getWorldDirection(this._vDir);
    const shot = this.bolts.fire(
      this._vMuzzle,
      this._vDir,
      spec.speed,
      Math.max(COMBAT.BOLT.LIFE, 36 / spec.speed),
      {
        damage: spec.damage,
        pierce: spec.pierce,
        radius: spec.radius,
        weaponKind: spec.kind,
      },
    );
    if (!shot) return false;
    this.viewmodel.triggerCast();
    this.audio?.playShoot?.();
    return true;
  }

  resolveLaserAttack(origin, direction, range, damage, outEnd) {
    let nearest = this._wallDistance(origin, direction, range);
    let target = null;
    let targetCenter = null;
    let bossTarget = null;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      enemy.center(this._laserCenter);
      const distance = raySphereDistance(
        origin,
        direction,
        this._laserCenter,
        enemy.boltRadius || enemy.radius,
      );
      if (distance >= nearest) continue;
      nearest = distance;
      target = enemy;
      targetCenter = this._laserTargetCenter.copy(this._laserCenter);
    }
    if (this.boss?.active && !this.boss.defeated) {
      for (const candidate of this.boss.getPlayerAttackTargets()) {
        const distance = raySphereDistance(
          origin,
          direction,
          candidate.center,
          candidate.radius,
        );
        if (distance < nearest) {
          nearest = distance;
          target = this.boss;
          bossTarget = candidate;
          targetCenter = this._laserHit.copy(candidate.center);
        }
      }
    }
    outEnd.copy(origin).addScaledVector(direction, Math.max(0, nearest));
    if (damage <= 0 || !target) return target;
    if (target === this.boss) {
      let impact = outEnd;
      const bossCenter = bossTarget?.center || target.center();
      const authoredImpact = target.resolvePlayerAttackImpact?.(
        origin,
        direction,
        this._laserBossImpact,
        range,
        bossTarget,
      );
      if (authoredImpact) {
        impact = authoredImpact;
        outEnd.copy(authoredImpact);
      } else if (Math.abs(direction.z) > 0.0001) {
        const planeDistance = (bossCenter.z - origin.z) / direction.z;
        if (planeDistance >= 0 && planeDistance <= range) {
          impact = this._laserBossImpact.copy(origin)
            .addScaledVector(direction, planeDistance);
        }
      }
      target.receivePlayerAttack({
        kind: 'beam',
        damage,
        position: impact,
        target: bossTarget,
      });
      this._syncBossHud();
    } else {
      this._damageThreat(target, damage, targetCenter || outEnd);
    }
    return target;
  }

  _wallDistance(origin, direction, range) {
    const step = 0.5;
    for (let distance = step; distance <= range; distance += step) {
      const x = origin.x + direction.x * distance;
      const y = origin.y + direction.y * distance;
      const z = origin.z + direction.z * distance;
      if (this.world.collidesAt(x, z, 0.08, y)) return distance - step;
    }
    return range;
  }

  _liveThreatCount() {
    let count = 0;
    for (const enemy of this.enemies) {
      if (enemy.alive) count++;
    }
    return count;
  }

  blocksPlayerAt(x, z, radius, supportY) {
    if (this.boss?.blocksPlayerAt?.(x, z, radius, supportY)) return true;
    if (this.boss?.shieldVfx?.blocksPlayerAt?.(x, z, radius)) return true;
    return this.enemies.some((enemy) => (
      enemy.blocksPlayerAt?.(x, z, radius, supportY)
    ));
  }

  _damageThreat(enemy, damage, position) {
    const applied = Math.min(enemy.hp, damage);
    const defeated = enemy.hit(damage);
    this.hud.hitMarker();
    this.hud.popupDamage(position, applied);
    this.registerPlayerBoltHit(defeated);
    if (!defeated) {
      this.audio?.playHit?.();
      this.vfx.impact(position, enemy.type);
      return false;
    }
    this.audio?.playEnemyDeath?.();
    this.vfx.death(position, enemy.type);
    this.vfx.residue(position, enemy.type);
    this._hitstop = COMBAT.FEEL.HITSTOP;
    this.lumina.tryDrop(position, 1);
    this.onThreatDefeated?.(enemy);
    if (enemy.survivalProfile?.volatileDeathBurst) {
      this._queueVolatileBurst(position, enemy.survivalProfile.volatileDeathBurst);
    }
    this._updateWaveLeft();
    return true;
  }

  _queueVolatileBurst(position, profile) {
    const hazard = {
      remaining: profile.delaySeconds,
      radius: profile.radius,
      position: position.clone(),
    };
    this._volatileHazards.push(hazard);
    this.vfx.ring(hazard.position, ELITE_COLORS.volatile, {
      horizontal: true,
      duration: profile.delaySeconds,
      startScale: 0.2,
      endScale: profile.radius / 0.55,
    });
    this.audio?.playSurvivalEliteWarning?.('volatile');
  }

  _updateVolatileHazards(dt, playerPos) {
    for (let i = this._volatileHazards.length - 1; i >= 0; i--) {
      const hazard = this._volatileHazards[i];
      hazard.remaining -= dt;
      if (hazard.remaining > 0) continue;
      this._volatileHazards.splice(i, 1);
      this.vfx.burst(hazard.position, ELITE_COLORS.volatile, 1.3, {
        count: 10,
        gravity: 0.3,
        rise: 0.5,
      });
      const dx = playerPos.x - hazard.position.x;
      const dz = playerPos.z - hazard.position.z;
      if (dx * dx + dz * dz <= hazard.radius * hazard.radius) {
        this._damagePlayer(18, hazard.position);
      }
    }
  }

  _damagePlayer(damage, sourcePos = null) {
    if (this.player.invulnerable) return;
    const reduction = Math.min(0.8, this.effects?.damageReduction || 0);
    super._damagePlayer(damage * (1 - reduction), sourcePos);
  }

  _updateHealthUi() { this.hud.setHealth(this.hp, this.maxHp); }

  heal(amount) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + Math.max(0, amount));
    this._updateHealthUi();
    if (this.hp > before) this.hud.healFlash();
    return this.hp - before;
  }

  get meleeReady() {
    const tuning = this._shockwaveTuning();
    return this._meleeCooldown <= 0 && this.player.stamina >= tuning.stamina;
  }

  _shockwaveTuning() {
    const rank = this.effects?.shockwaveRank || 0;
    return {
      radius: COMBAT.SHOCKWAVE.RADIUS + rank * 0.6,
      vertical: COMBAT.SHOCKWAVE.VERTICAL,
      damage: COMBAT.SHOCKWAVE.DAMAGE + rank,
      knockback: COMBAT.SHOCKWAVE.KNOCKBACK + rank * 0.35,
      cooldown: Math.max(3.5, COMBAT.SHOCKWAVE.COOLDOWN - rank * 0.75),
      stamina: COMBAT.SHOCKWAVE.STAMINA,
      deflectRadius: COMBAT.SHOCKWAVE.DEFLECT_RADIUS + rank * 0.4,
    };
  }

  _syncMeleeHud() {
    const tuning = this._shockwaveTuning();
    const byCooldown = 1 - this._meleeCooldown / tuning.cooldown;
    const byStamina = tuning.stamina > 0 ? this.player.stamina / tuning.stamina : 1;
    this.hud.setMelee(Math.min(byCooldown, byStamina), this.meleeReady);
  }

  _releaseShockwave(playerPos) {
    const tuning = this._shockwaveTuning();
    this._meleeCooldown = tuning.cooldown;
    this.player.spendStamina(tuning.stamina);
    const radiusSq = tuning.radius * tuning.radius;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      enemy.center(this._vEnemy);
      const dx = this._vEnemy.x - playerPos.x;
      const dz = this._vEnemy.z - playerPos.z;
      if (dx * dx + dz * dz > radiusSq ||
          Math.abs(this._vEnemy.y - playerPos.y) > tuning.vertical) continue;
      const distance = Math.hypot(dx, dz) || 1;
      enemy.nudge?.(
        dx / distance * tuning.knockback,
        dz / distance * tuning.knockback,
      );
      this._damageThreat(enemy, tuning.damage, this._vEnemy);
    }
    this._deflectShots(playerPos, tuning.deflectRadius);
    this._vShock.set(playerPos.x, this.player.eyeBase + 0.06, playerPos.z);
    this.vfx.ring(this._vShock, COMBAT.SHOCKWAVE.COLOR, {
      horizontal: true,
      duration: 0.42,
      startScale: 0.3,
      endScale: tuning.radius / 0.55,
    });
    this.vfx.burst(this._vShock, COMBAT.SHOCKWAVE.COLOR, 1.1, {
      count: 8,
      gravity: 0.4,
      rise: 0.5,
    });
    this.viewmodel.triggerSlam();
    this.audio?.playShockwave?.();
  }

  _resolveProjectiles() {
    for (const shot of this.bolts.slots) {
      if (!shot.active) continue;
      const blockedByWorld = this._clipProjectileToWorld(shot);
      this._resolveProjectileSegment(shot);
      if (blockedByWorld && shot.active) this.bolts.deactivate(shot);
    }
  }

  _clipProjectileToWorld(shot) {
    const start = shot.previousPosition || shot.mesh.position;
    const end = this._projectileEnd.copy(shot.mesh.position);
    const distance = start.distanceTo(end);
    const steps = Math.max(1, Math.ceil(distance / PROJECTILE_WORLD_STEP));
    for (let i = 1; i <= steps; i++) {
      const fraction = i / steps;
      const x = start.x + (end.x - start.x) * fraction;
      const y = start.y + (end.y - start.y) * fraction;
      const z = start.z + (end.z - start.z) * fraction;
      if (y >= -0.3 && !this.world.collidesAt(x, z, 0.1, y)) continue;
      shot.mesh.position.copy(start).lerp(end, (i - 1) / steps);
      return true;
    }
    return false;
  }

  _resolveProjectileSegment(shot) {
    const start = shot.previousPosition || shot.mesh.position;
    const end = shot.mesh.position;
    while (shot.active) {
      let nearestFraction = Infinity;
      let nearestEnemy = null;
      let nearestBossTarget = null;

      for (const enemy of this.enemies) {
        if (!enemy.alive || shot.hitTargets.has(enemy)) continue;
        enemy.center(this._vEnemy);
        const fraction = segmentSphereHitFraction(
          start,
          end,
          this._vEnemy,
          (enemy.boltRadius || enemy.radius) + (shot.radius ?? COMBAT.BOLT.RADIUS),
        );
        if (fraction >= nearestFraction) continue;
        nearestFraction = fraction;
        nearestEnemy = enemy;
        nearestBossTarget = null;
      }

      if (this.boss?.active && !this.boss.defeated) {
        for (const target of this.boss.getPlayerAttackTargets()) {
          if (shot.hitTargets.has(target)) continue;
          const fraction = segmentSphereHitFraction(
            start,
            end,
            target.center,
            target.radius + (shot.radius ?? COMBAT.BOLT.RADIUS),
          );
          if (fraction >= nearestFraction) continue;
          nearestFraction = fraction;
          nearestEnemy = null;
          nearestBossTarget = target;
        }
      }

      if (!Number.isFinite(nearestFraction)) return;
      this._projectileImpact.copy(start).lerp(end, nearestFraction);
      if (nearestEnemy) {
        shot.hitTargets.add(nearestEnemy);
        this._damageThreat(
          nearestEnemy,
          shot.damage ?? SURVIVAL_LIGHT_BOLT.damage,
          this._projectileImpact,
        );
      } else {
        this._projectileDirection.copy(end).sub(start);
        const segmentLength = this._projectileDirection.length();
        if (segmentLength > 0) {
          this._projectileDirection.multiplyScalar(1 / segmentLength);
          this.boss.resolvePlayerAttackImpact?.(
            start,
            this._projectileDirection,
            this._projectileImpact,
            segmentLength,
            nearestBossTarget,
          );
        }
        const result = this.boss.receivePlayerAttack({
          kind: shot.weaponKind || 'projectile',
          damage: shot.damage ?? SURVIVAL_LIGHT_BOLT.damage,
          position: this._projectileImpact,
          target: nearestBossTarget,
        });
        if (!result.hit) return;
        shot.hitTargets.add(nearestBossTarget);
        this._syncBossHud();
      }
      shot.pierce--;
      if (shot.pierce <= 0) this.bolts.deactivate(shot);
    }
  }

  _resolveHostileProjectiles(playerPos) {
    for (const shot of this.spits.slots) {
      if (!shot.active) continue;
      const dx = shot.mesh.position.x - playerPos.x;
      const dz = shot.mesh.position.z - playerPos.z;
      const dy = shot.mesh.position.y - playerPos.y;
      if (dx * dx + dz * dz > 0.78 ** 2 || Math.abs(dy) > 1.4) continue;
      this._projectileSource.copy(shot.mesh.position).addScaledVector(shot.vel, -0.5);
      const source = shot.source;
      const damage = shot.damage ?? source?.projectileDamage ?? COMBAT.SPITTER.DAMAGE;
      const knockback = source?.projectileKnockback || 0;
      this.spits.deactivate(shot);
      this._damagePlayer(damage, this._projectileSource);
      if (knockback > 0) this.player.applyKnockback(-shot.vel.x, -shot.vel.z, knockback);
      break;
    }
  }

  _consumeThreatIntents(playerPos) {
    for (const enemy of this.enemies) {
      if (enemy.attackReady) {
        enemy.attackReady = false;
        this._damagePlayer(enemy.cfg.DAMAGE, enemy.pos);
      }
      if (enemy.spitRequested || enemy.shotRequested) {
        enemy.spitRequested = false;
        enemy.shotRequested = false;
        enemy.muzzle(this._vSpit);
        this._vDir.copy(playerPos).sub(this._vSpit).normalize();
        const speed = enemy.cfg.SPIT_SPEED ?? enemy.cfg.SHOT_SPEED ?? 9;
        this.spits.fire(this._vSpit, this._vDir, speed, 5, {
          source: enemy,
          damage: enemy.cfg.DAMAGE,
        });
      }
    }
  }

  _syncBossHud() {
    if (!this.boss) return;
    this.hud.setBoss({
      name: this.boss.tuning.SURVIVAL_LABEL || 'Guardian',
      hp: this.boss.hp,
      maxHp: this.boss.maxHp,
    });
  }

  update(dt, t, playerPos) {
    this._updateFeel(dt);
    this._updatePending(dt);
    if (!this.active) {
      this._reapAndUpdate(dt, t, playerPos, dt);
      return;
    }
    if (!this.player.controls.isLocked) {
      this.cancelInput();
      return;
    }

    let simDt = dt;
    if (this._hitstop > 0) {
      this._hitstop = Math.max(0, this._hitstop - dt);
      simDt = dt * COMBAT.FEEL.HITSTOP_SCALE;
    }
    this._updateAlab(dt);
    this.weapons.update(dt, this.alabActive);
    this._updatePlayerMelee(dt, playerPos);
    this.hud.trackThreats(this.enemies, this.camera, dt);

    // Survival clips the whole travelled segment against walls immediately
    // before its swept target pass; the shared pool keeps campaign endpoint
    // collision unchanged.
    this.bolts.update(simDt, this.world, true);
    this.spits.update(simDt, this.world);
    this._resolveProjectiles();
    this._resolveHostileProjectiles(playerPos);
    this._reapAndUpdate(simDt, t, playerPos, dt);
    this._consumeThreatIntents(playerPos);
    this._updateVolatileHazards(dt, playerPos);
    this.lumina.update(dt, t, playerPos, false);
    this._syncBossHud();

    if (this.consumePlayerDeath()) this.onPlayerDefeated?.();
  }

  clearThreats({ clearPlayerProjectiles = true, immediate = false } = {}) {
    for (const enemy of this.enemies) {
      enemy.vanish();
      if (immediate) enemy.dispose();
    }
    if (immediate) this.enemies.length = 0;
    this.cancelPendingSpawns();
    this.spits.clear();
    if (clearPlayerProjectiles) this.bolts.clear();
    this._volatileHazards.length = 0;
    this._updateWaveLeft();
  }

  restoreBossVictoryHealth() { return this.heal(this.maxHp * 0.25); }

  abortRun() {
    this.cancelInput();
    this.clearThreats({ immediate: true });
    this.active = false;
    this.boss = null;
    this.weapons.reset();
    this.lumina.reset();
    this.player.setJumpEnabled(false);
    this.player.disableDash();
    this.hud.hideBoss();
    this._hideHud();
  }

  dispose() {
    this.abortRun();
    this.weapons.dispose();
    this.lumina.dispose();
    super.dispose();
  }
}
