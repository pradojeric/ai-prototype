// ============================================================
// COMBAT MANAGER — orchestrates a per-artifact wave fight (GDD add-on):
// holding E on a "contested" scattered artifact interrupts the reach and
// spawns waves of drowned echoes around it; clearing every wave marks the
// artifact cleared so the normal hold-E collection works. The only combat
// object Game talks to. Owns enemies, both projectile pools, player hp,
// the combat HUD, and the feel layer (hit flash / kill hitstop / FOV punch).
// ============================================================
import * as THREE from 'three';
import { CONFIG, COMBAT, clamp01 } from '../../config.js';
import { ProjectilePool } from './ProjectilePool.js';
import { Enemy } from './Enemy.js';
import { NavGrid } from './NavGrid.js';

export class CombatManager {
  constructor(scene, world, player, camera, viewmodel, audio) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.camera = camera;
    this.viewmodel = viewmodel;
    this.audio = audio;

    this.active = false;
    this.clearedIds = new Set();   // artifact ids whose fight is won (this visit)
    this.hp = COMBAT.PLAYER_HP;
    this.enemies = [];
    this.bolts = new ProjectilePool(scene, COMBAT.POOL_BOLTS, {
      color: COMBAT.BOLT.COLOR, size: COMBAT.BOLT.SIZE,
    });
    this.spits = new ProjectilePool(scene, COMBAT.POOL_SPITS, {
      color: COMBAT.SPITTER.SPIT_COLOR, size: COMBAT.BOLT.SIZE * 1.4,
    });

    // Pathfinding: walkability grid baked once per zone; the BFS flow field
    // toward the player is rebuilt on a timer only while a fight is active.
    this.nav = new NavGrid(world);
    this._flowTimer = 0;

    this._artifact = null;         // the contested artifact being defended
    this._wave = 0;                // index into COMBAT.WAVES
    this._waveGap = 0;             // countdown between waves
    this._fireCooldown = 0;
    this._fireRequested = false;
    this._playerDied = false;      // one-shot flag Game consumes
    this._hurtTimer = 0;
    this._fovPunch = 0;            // additive degrees, decays exponentially
    this._baseFov = camera.fov;
    this._hitstop = 0;             // seconds of scaled-time left on enemy sim

    // HUD elements (plain DOM, .active convention — see index.html).
    this.elHealth = document.getElementById('health');
    this.elHealthFill = document.getElementById('health-fill');
    this.elWave = document.getElementById('wavehud');
    this.elWaveN = document.getElementById('wave-n');
    this.elWaveT = document.getElementById('wave-t');
    this.elWaveLeft = document.getElementById('wave-left');
    this.elHurt = document.getElementById('hurt');
    this.elCross = document.getElementById('crosshair');

    // scratch vectors — combat runs every frame, so no per-frame allocation
    this._vMuzzle = new THREE.Vector3();
    this._vDir = new THREE.Vector3();
    this._vEnemy = new THREE.Vector3();
    this._vSpit = new THREE.Vector3();
  }

  // A scattered artifact still guarded by echoes? (found ones never contest)
  isContested(artifact) {
    return !artifact.found && !this.clearedIds.has(artifact.data.id);
  }

  // Hold-E on a contested artifact begins the defense.
  startFight(artifact) {
    if (this.active) return;
    this.active = true;
    this._artifact = artifact;
    this._wave = 0;
    this._waveGap = 0;
    this.hp = COMBAT.PLAYER_HP;
    // Fresh flow field so wave 1 routes correctly from its first frame.
    const p = this.player.controls.getObject().position;
    this.nav.computeFlow(p.x, p.z);
    this._flowTimer = 0;
    this._spawnWave();
    this.elHealth.classList.add('active');
    this.elWave.classList.add('active');
    this.elCross.classList.add('combat');
    this._updateHealthUi();
  }

  // Left-click while a fight is on; executed in the next update() tick.
  requestFire() { this._fireRequested = true; }

  // Game polls this once per frame; true exactly once per player death.
  consumePlayerDeath() {
    if (!this._playerDied) return false;
    this._playerDied = false;
    return true;
  }

  // Reset an in-progress fight (faint or leash): everything poofs out, pools
  // clear, hp refills, HUD hides. The artifact stays contested for a re-try.
  abortFight() {
    if (!this.active) return;
    for (const e of this.enemies) e.vanish();
    this.bolts.clear();
    this.spits.clear();
    this.active = false;
    this._artifact = null;
    this.hp = COMBAT.PLAYER_HP;
    this._hideHud();
  }

  _hideHud() {
    this.elHealth.classList.remove('active');
    this.elWave.classList.remove('active');
    this.elCross.classList.remove('combat');
    this.elHurt.classList.remove('active');
  }

  _zoneKey() { return this.world.zone?.id || 'zone1'; }

  _spawnWave() {
    const def = COMBAT.WAVES[this._wave];
    const zone = this._zoneKey();
    const chasers = def.chasers + (COMBAT.ZONE_BONUS[zone] || 0);
    const hpBonus = COMBAT.ZONE_HP_BONUS[zone] || 0;
    for (let i = 0; i < chasers; i++) this._spawnEnemy('chaser', hpBonus);
    for (let i = 0; i < def.spitters; i++) this._spawnEnemy('spitter', hpBonus);
    this.elWaveN.textContent = this._wave + 1;
    this.elWaveT.textContent = COMBAT.WAVES.length;
    this._updateWaveLeft();
    this._punchWaveHud();
  }

  // Ring spawn around the contested artifact, kept out of walls and off the
  // player's face (retry-loop idiom shared with Guardian._pickSpot).
  _spawnEnemy(type, hpBonus) {
    const a = this._artifact.pos;
    const playerPos = this.player.controls.getObject().position;
    const L = CONFIG.ZONE_HALF - 2;
    let x = a.x, z = a.z + COMBAT.SPAWN_RADIUS_MIN;   // fallback if all tries fail
    for (let tries = 0; tries < 24; tries++) {
      const ang = Math.random() * Math.PI * 2;
      const r = COMBAT.SPAWN_RADIUS_MIN +
        Math.random() * (COMBAT.SPAWN_RADIUS_MAX - COMBAT.SPAWN_RADIUS_MIN);
      const cx = a.x + Math.cos(ang) * r;
      const cz = a.z + Math.sin(ang) * r;
      if (Math.abs(cx) > L || Math.abs(cz) > L) continue;
      if (this.world.collidesAt(cx, cz, 0.9)) continue;
      const dx = cx - playerPos.x, dz = cz - playerPos.z;
      if (dx * dx + dz * dz < COMBAT.SPAWN_MIN_PLAYER_DIST ** 2) continue;
      x = cx; z = cz;
      break;
    }
    this.enemies.push(new Enemy(this.scene, this.world, type, x, z, hpBonus));
  }

  _aliveCount() {
    let n = 0;
    for (const e of this.enemies) if (e.alive) n++;
    return n;
  }

  _updateWaveLeft() { this.elWaveLeft.textContent = this._aliveCount(); }

  _punchWaveHud() {
    this.elWave.animate(
      [{ transform: 'scale(1.15)' }, { transform: 'scale(1)' }],
      { duration: 150, easing: 'ease-out' },
    );
  }

  _updateHealthUi() {
    const pct = clamp01(this.hp / COMBAT.PLAYER_HP) * 100;
    this.elHealthFill.style.width = pct + '%';
    this.elHealth.classList.toggle('low', this.hp < COMBAT.PLAYER_HP * 0.3);
  }

  _damagePlayer(dmg) {
    if (this._playerDied || this.hp <= 0) return;
    this.hp -= dmg;
    this._hurtTimer = COMBAT.HURT_FLASH;
    this.elHurt.classList.add('active');
    this._fovPunch = Math.min(10, this._fovPunch + COMBAT.FEEL.FOV_PUNCH);
    this.audio.playPlayerHurt();
    this._updateHealthUi();
    if (this.hp <= 0) this._playerDied = true;   // Game consumes → combat faint
  }

  _hitMarker() {
    this.elCross.classList.add('hit');
    clearTimeout(this._hitTimeout);
    this._hitTimeout = setTimeout(() => this.elCross.classList.remove('hit'), 80);
  }

  update(dt, t, playerPos) {
    // Feel timers run on REAL dt even while paused/frozen, so effects settle.
    if (this._hurtTimer > 0) {
      this._hurtTimer -= dt;
      if (this._hurtTimer <= 0) this.elHurt.classList.remove('active');
    }
    if (this._fovPunch > 0.001) {
      this._fovPunch *= Math.exp(-dt / 0.2);
      if (this._fovPunch < 0.001) this._fovPunch = 0;
      this.camera.fov = this._baseFov + this._fovPunch;
      this.camera.updateProjectionMatrix();
    }

    if (!this.active) {
      // Finish any dissolve/poofs left by a win, leash reset, or faint abort.
      if (this.enemies.length) this._reapAndUpdate(dt, t, playerPos, dt);
      return;
    }

    // ESC safety: freeze the whole sim while the pointer is unlocked so a
    // pause menu can't get the player killed.
    if (!this.player.controls.isLocked) { this._fireRequested = false; return; }

    // Leash: wandering too far resets the fight (the echoes sink back down).
    if (this._artifact && playerPos.distanceTo(this._artifact.pos) > COMBAT.LEASH_RADIUS) {
      this.abortFight();   // enemies vanish; the inactive branch reaps them
      this._reapAndUpdate(dt, t, playerPos, dt);
      return;
    }

    // Rebuild the flow field toward the player on a coarse timer (one BFS
    // serves every enemy; 2-3 Hz tracks the player plenty closely).
    this._flowTimer -= dt;
    if (this._flowTimer <= 0) {
      this._flowTimer = COMBAT.NAV.FLOW_INTERVAL;
      this.nav.computeFlow(playerPos.x, playerPos.z);
    }

    // Kill hitstop scales only the enemy/projectile sim; player + camera + HUD
    // stay on real time so the freeze is felt, not laggy.
    let simDt = dt;
    if (this._hitstop > 0) {
      this._hitstop -= dt;
      simDt = dt * COMBAT.FEEL.HITSTOP_SCALE;
      if (this._hitstop <= 0) this._hitstop = 0;
    }

    // Fire a light-bolt from the lure along the camera's aim.
    this._fireCooldown = Math.max(0, this._fireCooldown - dt);
    if (this._fireRequested && this._fireCooldown <= 0) {
      this._fireCooldown = COMBAT.BOLT.COOLDOWN;
      this.viewmodel.getMuzzleWorld(this._vMuzzle);
      this.camera.getWorldDirection(this._vDir);
      this.bolts.fire(this._vMuzzle, this._vDir, COMBAT.BOLT.SPEED, COMBAT.BOLT.LIFE);
      this.viewmodel.triggerCast();
      this.audio.playShoot();
    }
    this._fireRequested = false;

    // Advance projectiles, then resolve hits inline (squared distances only).
    this.bolts.update(simDt, this.world);
    this.spits.update(simDt, this.world);

    for (const s of this.bolts.slots) {
      if (!s.active) continue;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        e.center(this._vEnemy);
        const rr = (e.radius + COMBAT.BOLT.RADIUS) ** 2;
        if (s.mesh.position.distanceToSquared(this._vEnemy) > rr) continue;
        this.bolts.deactivate(s);
        this._hitMarker();
        if (e.hit(COMBAT.BOLT.DAMAGE)) {
          this.audio.playEnemyDeath();
          this._hitstop = COMBAT.FEEL.HITSTOP;
          this._updateWaveLeft();
        } else {
          this.audio.playHit();
        }
        break;
      }
    }

    // Hostile spits vs the player: XZ circle + a generous vertical band.
    for (const s of this.spits.slots) {
      if (!s.active) continue;
      const dx = s.mesh.position.x - playerPos.x;
      const dz = s.mesh.position.z - playerPos.z;
      const dy = s.mesh.position.y - playerPos.y;
      const rr = (0.6 + COMBAT.BOLT.RADIUS) ** 2;
      if (dx * dx + dz * dz > rr || Math.abs(dy) > 1.4) continue;
      this.spits.deactivate(s);
      this._damagePlayer(COMBAT.SPITTER.DAMAGE);
    }

    this._reapAndUpdate(simDt, t, playerPos, dt);

    // Consume enemy intents raised during their update.
    for (const e of this.enemies) {
      if (e.attackReady) {
        e.attackReady = false;
        this._damagePlayer(COMBAT.CHASER.DAMAGE);
      }
      if (e.spitRequested) {
        e.spitRequested = false;
        e.muzzle(this._vSpit);
        this._vDir.copy(playerPos).sub(this._vSpit).normalize();
        this.spits.fire(this._vSpit, this._vDir, COMBAT.SPITTER.SPIT_SPEED, 4);
      }
    }

    // Wave flow: cleared → breather → next wave, or the whole fight is won.
    if (this._aliveCount() === 0) {
      if (this._wave >= COMBAT.WAVES.length - 1) {
        this._winFight();
      } else {
        this._waveGap += dt;
        if (this._waveGap >= COMBAT.WAVE_GAP) {
          this._waveGap = 0;
          this._wave++;
          this._spawnWave();
        }
      }
    }
  }

  // Advance every enemy (scaled sim time) and reap the fully-dissolved ones.
  _reapAndUpdate(simDt, t, playerPos, dt) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.update(e.alive ? simDt : dt, t, playerPos, this.nav);   // dissolve on real time
      if (e.dead) {
        e.dispose();
        this.enemies.splice(i, 1);
      }
    }
  }

  _winFight() {
    this.clearedIds.add(this._artifact.data.id);
    this.hp = Math.min(COMBAT.PLAYER_HP, this.hp + COMBAT.HEAL_ON_CLEAR);
    this._updateHealthUi();
    this.audio.playWaveClear();
    this.active = false;
    this._artifact = null;
    this._hideHud();
  }

  // Full teardown for a zone switch.
  dispose() {
    for (const e of this.enemies) e.dispose();
    this.enemies.length = 0;
    this.bolts.dispose();
    this.spits.dispose();
    clearTimeout(this._hitTimeout);
    this.camera.fov = this._baseFov;
    this.camera.updateProjectionMatrix();
    this._hideHud();
  }
}
