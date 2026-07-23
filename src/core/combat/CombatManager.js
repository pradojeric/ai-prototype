// ============================================================
// COMBAT MANAGER — reusable wave-combat core for the Memory Arena. Owns
// enemies, projectile pools, player HP, the combat HUD, and the feel layer.
// ArenaController supplies the spawn origin, encounter completion, riddle
// penalties, and the genuine-kill reward callback.
// ============================================================
import * as THREE from 'three';
import { CONFIG, COMBAT } from '../../config.js';
import { ProjectilePool } from './ProjectilePool.js';
import { Enemy } from './Enemy.js';
import { NavGrid } from './NavGrid.js';
import { CombatVfx } from './CombatVfx.js';
import { CombatHud } from '../../ui/CombatHud.js';

export class CombatManager {
  constructor(scene, world, player, camera, viewmodel, audio, options = {}) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.camera = camera;
    this.viewmodel = viewmodel;
    this.audio = audio;

    this.active = false;
    this.hp = COMBAT.PLAYER_HP;
    this.enemies = [];
    this.bolts = new ProjectilePool(scene, COMBAT.POOL_BOLTS, {
      color: COMBAT.BOLT.COLOR, size: COMBAT.BOLT.SIZE,
    });
    this.spits = new ProjectilePool(scene, COMBAT.POOL_SPITS, {
      color: COMBAT.SPITTER.SPIT_COLOR, size: COMBAT.BOLT.SIZE * 1.4,
    });

    // Pooled spawn/impact/death effects, shared by every arena subclass.
    this.vfx = new CombatVfx(scene, camera);

    // Pathfinding: walkability grid baked once per zone; the BFS flow field
    // toward the player is rebuilt on a timer only while a fight is active.
    this.nav = options.navigation === false ? null : new NavGrid(world);
    this._flowTimer = 0;

    this._origin = null;           // XZ center the waves spawn around (arena center)
    this._pending = [];            // arena enemies queued behind a spawn portal
    this._endless = false;         // arena mode: waves keep coming until stop()ed
    this._totalWaves = 0;          // fixed-length arena run (0 = use COMBAT.WAVES length)
    this._onWaveCleared = null;    // fired once per cleared wave, with its 1-based number
    this._clearedWave = 0;         // highest wave already reported (kills per-frame re-fire)
    this._wavesHeld = false;       // true → no new wave spawns (riddle round / boss phase)
    this._leash = null;            // optional Vector3; wandering past LEASH_RADIUS resets
    this._wave = 0;                // index into COMBAT.WAVES (wraps past its length)
    this._waveGap = 0;             // countdown between waves
    this._fireCooldown = 0;
    this._fireRequested = false;
    this._overchargeRate = 0;
    this._overchargeCooldown = 0;
    this._onEnemyDefeated = null;
    this._playerDied = false;      // one-shot flag Game consumes
    this._hurtTimer = 0;
    this._fovPunch = 0;            // additive degrees, decays exponentially
    this._baseFov = camera.fov;
    this._hitstop = 0;             // seconds of scaled-time left on enemy sim

    // Every DOM overlay a fight owns lives in CombatHud; this class only calls it.
    this.hud = new CombatHud();

    // scratch vectors — combat runs every frame, so no per-frame allocation
    this._vMuzzle = new THREE.Vector3();
    this._vDir = new THREE.Vector3();
    this._vEnemy = new THREE.Vector3();
    this._vSpit = new THREE.Vector3();
    this._vSpawn = new THREE.Vector3();
    this._vSource = new THREE.Vector3();
  }

  // Arena-owned reward systems subscribe here instead of reaching into the
  // enemy array. The callback fires only for a real damaging kill, never for
  // abort/victory cleanup via Enemy.vanish().
  setEnemyDefeatedHandler(handler) { this._onEnemyDefeated = handler; }

  get maxHp() { return COMBAT.PLAYER_HP; }

  damage(amount, sourcePos = null) { this._damagePlayer(Math.max(0, amount), sourcePos); }

  setHudProfile(profile) { this.hud.setProfile(profile); }

  heal(amount) {
    const before = this.hp;
    this.hp = Math.min(COMBAT.PLAYER_HP, this.hp + Math.max(0, amount));
    this._updateHealthUi();
    if (this.hp > before) this.hud.healFlash();
    return this.hp - before;
  }

  setOvercharge(active, shotsPerSecond = 0) {
    this._overchargeRate = active ? Math.max(0, shotsPerSecond) : 0;
    this._overchargeCooldown = 0;
    this.hud.setOvercharge(this._overchargeRate > 0);
  }

  // Begin a fight: waves spawn around `origin` (a THREE.Vector3). Options:
  //   endless       — waves keep cycling (with per-cycle escalation) until stop();
  //                   the caller (ArenaController) decides when the fight ends.
  //   totalWaves    — fixed-length run; the last cleared wave holds instead of
  //                   self-winning, leaving the ending to the caller.
  //   onWaveCleared — callback(waveNumber, 1-based) fired once per cleared wave,
  //                   which is how an arena gates riddle rounds on wave progress.
  //   held          — start with the wave clock already frozen and no opening
  //                   wave, for a fight that begins past the wave run entirely.
  //   leash         — optional Vector3; wandering past LEASH_RADIUS aborts.
  startFight(origin, opts = {}) {
    if (this.active) return;
    this.active = true;
    this._origin = origin.clone();
    this._endless = opts.endless ?? false;
    this._totalWaves = opts.totalWaves ?? 0;
    this._onWaveCleared = opts.onWaveCleared ?? null;
    this._clearedWave = 0;
    this._wavesHeld = opts.held ?? false;
    this._leash = opts.leash ?? null;
    this._wave = 0;
    this._waveGap = 0;
    this.hp = COMBAT.PLAYER_HP;
    // Fresh flow field so wave 1 routes correctly from its first frame.
    const p = this.player.controls.getObject().position;
    if (this.nav) this.nav.computeFlow(p.x, p.z);
    this._flowTimer = 0;
    if (this._wavesHeld) this.hud.setWave(0, this._waveTotal());
    else this._spawnWave();
    this.hud.show();
    this._updateHealthUi();
  }

  // Spawn an immediate off-schedule burst (e.g. an arena wrong-answer penalty).
  spawnExtra(chasers = 0, spitters = 0, { dropMultiplier = 1 } = {}) {
    if (!this.active) return;
    const zone = this._zoneKey();
    const hpBonus = COMBAT.ZONE_HP_BONUS[zone] || 0;
    for (let i = 0; i < chasers; i++) this._spawnEnemy('chaser', hpBonus, dropMultiplier);
    for (let i = 0; i < spitters; i++) this._spawnEnemy('spitter', hpBonus, dropMultiplier);
    this._updateWaveLeft();
  }

  // Freeze/resume the wave clock without ending the fight. An arena holds waves
  // while a riddle round is open (so the player answers under the pressure that
  // is already on the field) and for the whole boss phase (the boss summons
  // instead). Live enemies keep fighting either way.
  holdWaves(flag) { this._wavesHeld = !!flag; }

  // Live threats, telegraphing spawns included. Arena controllers poll this to
  // know when a penalty squad is fully dead.
  aliveCount() { return this._aliveCount(); }

  // Poof every live enemy without crediting a kill (no Lumina drops, no hitstop).
  // Used at a phase boundary where leftover adds would muddy the transition.
  clearEnemies() {
    for (const e of this.enemies) e.vanish();
    this.cancelPendingSpawns();
    this._updateWaveLeft();
  }

  // Withdraw telegraphed enemies that have not materialised yet. Riddle and
  // boss handoffs use this so a portal cannot complete after spawning is held.
  cancelPendingSpawns() {
    for (const pending of this._pending) this.vfx.cancelSpawn(pending.tearId);
    this._pending.length = 0;
    this._updateWaveLeft();
  }

  // Left-click while a fight is on; executed in the next update() tick.
  requestFire() { this._fireRequested = true; }

  // Drop a queued click when focus/pointer lock is lost so resuming never emits
  // a shot that was requested before the pause menu appeared.
  cancelInput() { this._fireRequested = false; }

  // Game polls this once per frame; true exactly once per player death.
  consumePlayerDeath() {
    if (!this._playerDied) return false;
    this._playerDied = false;
    return true;
  }

  // Reset an in-progress fight (faint, leash, or arena victory): everything
  // poofs out, pools clear, hp refills, HUD hides.
  abortFight() {
    if (!this.active) return;
    for (const e of this.enemies) e.vanish();
    this.cancelPendingSpawns();   // telegraphed echoes never arrive
    this.bolts.clear();
    this.spits.clear();
    this.active = false;
    this._origin = null;
    this.hp = COMBAT.PLAYER_HP;
    this.setOvercharge(false);
    this.vfx.reset();
    this._hideHud();
  }

  _hideHud() { this.hud.hide(); }

  _zoneKey() { return this.world.zone?.id || 'zone1'; }

  // Total the HUD reports. A fixed-length arena run shows its real end (10);
  // only a genuinely endless fight falls back to the infinity glyph.
  _waveTotal() {
    if (this._totalWaves > 0) return this._totalWaves;
    return this._endless ? '∞' : COMBAT.WAVES.length;
  }

  _spawnWave() {
    // Runs longer than the table wrap it and add one chaser per completed cycle,
    // so a 10-wave arena keeps climbing instead of replaying waves 1-4 flat.
    const idx = this._wave % COMBAT.WAVES.length;
    const cycle = Math.floor(this._wave / COMBAT.WAVES.length);
    const def = COMBAT.WAVES[idx];
    const zone = this._zoneKey();
    const chasers = def.chasers + (COMBAT.ZONE_BONUS[zone] || 0) + cycle;
    const hpBonus = COMBAT.ZONE_HP_BONUS[zone] || 0;
    for (let i = 0; i < chasers; i++) this._spawnEnemy('chaser', hpBonus, 1);
    for (let i = 0; i < def.spitters; i++) this._spawnEnemy('spitter', hpBonus, 1);
    this.hud.setWave(this._wave + 1, this._waveTotal());
    this._updateWaveLeft();
    this._punchWaveHud();
  }

  // Ring spawn around the fight origin, kept out of walls and off the player's
  // face (retry-loop idiom shared with Guardian._pickSpot). The echo does not
  // exist yet: the spot is telegraphed first (see _updatePending) so nothing
  // ever materialises unannounced behind the player.
  _spawnEnemy(type, hpBonus, dropMultiplier) {
    const a = this._origin;
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
    this._vSpawn.set(x, CONFIG.WATER_LEVEL + 0.06, z);
    this._queueEnemySpawn(type, this._vSpawn, () => new Enemy(
      this.scene, this.world, type, x, z, hpBonus, dropMultiplier,
    ));
  }

  // Shared by every arena manager: the construction callback is deliberately
  // held until the portal finishes, so the enemy has no mesh, collider, AI, or
  // attack intents during its warning window.
  _queueEnemySpawn(type, position, createEnemy) {
    // The tear id travels with the pending entry so the exact rift this enemy
    // was promised behind is the one that snaps shut when it lands.
    const tearId = this.vfx.spawnTelegraph(position, type);
    this._pending.push({
      type,
      x: position.x,
      y: position.y,
      z: position.z,
      delay: COMBAT.SPAWN_TELEGRAPH,
      tearId,
      createEnemy,
    });
    this.audio?.playEnemyPortal?.();
  }

  // Land queued enemies whose portal has run out. Driven on real dt so hitstop
  // and pointer-lock pause cannot desynchronise the portal from its audio cue.
  _updatePending(dt) {
    for (let i = 0; i < this._pending.length;) {
      const p = this._pending[i];
      p.delay -= dt;
      if (p.delay > 0) { i++; continue; }
      this._pending.splice(i, 1);
      const enemy = p.createEnemy();
      // Comes up through the rift rather than appearing beside it.
      enemy.beginEmerge(COMBAT.EMERGE.DEPTH, COMBAT.EMERGE.TIME);
      this.enemies.push(enemy);
      this._vSpawn.set(p.x, p.y + 0.44, p.z);
      this.vfx.spawnArrive(this._vSpawn, p.type, p.tearId);
    }
  }

  // Pending echoes count as live: a wave is not "cleared" while one is still
  // telegraphing, or the next wave would stack on top of it.
  _aliveCount() {
    let n = this._pending.length;
    for (const e of this.enemies) if (e.alive) n++;
    return n;
  }

  _updateWaveLeft() { this.hud.setWaveLeft(this._aliveCount()); }

  _punchWaveHud() { this.hud.punchWave(); }

  _updateHealthUi() { this.hud.setHealth(this.hp, COMBAT.PLAYER_HP); }

  // `sourcePos` (optional) is where the blow came from — it drives the
  // directional arc on the HUD, so the player can turn toward the attacker.
  _damagePlayer(dmg, sourcePos = null) {
    if (this._playerDied || this.hp <= 0) return;
    this.hp -= dmg;
    this._hurtTimer = COMBAT.HURT_FLASH;
    this.hud.hurt(true);
    if (sourcePos) this.hud.damageFrom(sourcePos, this.camera);
    this._fovPunch = Math.min(10, this._fovPunch + COMBAT.FEEL.FOV_PUNCH);
    this._playDamageSound();
    this._updateHealthUi();
    if (this.hp <= 0) this._playerDied = true;   // Game consumes → combat faint
  }

  _playDamageSound() { this.audio.playPlayerHurt(); }

  _hitMarker() { this.hud.hitMarker(); }

  _fireBolt() {
    this.viewmodel.getMuzzleWorld(this._vMuzzle);
    this.camera.getWorldDirection(this._vDir);
    const fired = this.bolts.fire(
      this._vMuzzle, this._vDir, COMBAT.BOLT.SPEED, COMBAT.BOLT.LIFE,
    );
    if (!fired) return false;
    this.viewmodel.triggerCast();
    this.audio.playShoot();
    return true;
  }

  _updateFeel(dt) {
    this.vfx.update(dt);
    this.hud.update(dt);
    if (this._hurtTimer > 0) {
      this._hurtTimer -= dt;
      if (this._hurtTimer <= 0) this.hud.hurt(false);
    }
    if (this._fovPunch > 0.001) {
      this._fovPunch *= Math.exp(-dt / 0.2);
      if (this._fovPunch < 0.001) this._fovPunch = 0;
      this.camera.fov = this._baseFov + this._fovPunch;
      this.camera.updateProjectionMatrix();
    }
  }

  _updatePlayerFire(dt) {
    this._fireCooldown = Math.max(0, this._fireCooldown - dt);
    if (this._overchargeRate > 0) {
      this._overchargeCooldown -= dt;
      let shotsThisFrame = 0;
      while (this._overchargeCooldown <= 0 && shotsThisFrame < 4) {
        this._fireBolt();
        this._overchargeCooldown += 1 / this._overchargeRate;
        shotsThisFrame++;
      }
    } else if (this._fireRequested && this._fireCooldown <= 0) {
      this._fireBolt();
      this._fireCooldown = COMBAT.BOLT.COOLDOWN;
    }
    this._fireRequested = false;
  }

  update(dt, t, playerPos) {
    // Feel timers run on REAL dt even while paused/frozen, so effects settle.
    this._updateFeel(dt);

    if (!this.active) {
      // Finish any dissolve/poofs left by a win, leash reset, or faint abort.
      if (this.enemies.length) this._reapAndUpdate(dt, t, playerPos, dt);
      return;
    }

    // Portals keep their real-time audio/VFX contract while paused, but a newly
    // materialised enemy cannot simulate until pointer lock resumes.
    this._updatePending(dt);

    // ESC safety: freeze the combat sim while the pointer is unlocked so a
    // pause menu can't get the player killed.
    if (!this.player.controls.isLocked) { this._fireRequested = false; return; }

    // Leash: wandering too far resets the fight (the echoes sink back down).
    // Arenas pass no leash (the player is walled in), so this is skipped there.
    if (this._leash && playerPos.distanceTo(this._leash) > COMBAT.LEASH_RADIUS) {
      this.abortFight();   // enemies vanish; the inactive branch reaps them
      this._reapAndUpdate(dt, t, playerPos, dt);
      return;
    }

    // Rebuild the flow field toward the player on a coarse timer (one BFS
    // serves every enemy; 2-3 Hz tracks the player plenty closely).
    this._flowTimer -= dt;
    if (this._flowTimer <= 0) {
      this._flowTimer = COMBAT.NAV.FLOW_INTERVAL;
      if (this.nav) this.nav.computeFlow(playerPos.x, playerPos.z);
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
    this._updatePlayerFire(dt);

    // Materialised threats behind the player receive HUD markers.
    this.hud.trackThreats(this.enemies, this.camera, dt);

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
        // Push direction for the impact nudge, taken before the slot is reused.
        this._vDir.copy(s.vel).setY(0).normalize();
        this.bolts.deactivate(s);
        this._hitMarker();
        if (e.hit(COMBAT.BOLT.DAMAGE)) {
          this.audio.playEnemyDeath();
          this._hitstop = COMBAT.FEEL.HITSTOP;
          this.vfx.death(this._vEnemy, e.type);
          this.vfx.residue(this._vEnemy, e.type);
          this._updateWaveLeft();
          if (this._onEnemyDefeated) {
            this._onEnemyDefeated(e.type, this._vEnemy, e.dropMultiplier);
          }
        } else {
          this.audio.playHit();
          this.vfx.impact(this._vEnemy, e.type);
          // Heavier bodies shrug the shot off; the shove sells the connection.
          const push = COMBAT.FEEL.HIT_NUDGE * (e.type === 'chaser' ? 1 : 0.5);
          e.nudge(this._vDir.x * push, this._vDir.z * push);
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
      // Point the damage arc back down the spit's flight path, not at the
      // impact point (which is the player's own position).
      this._vSource.copy(s.mesh.position).addScaledVector(s.vel, -0.5);
      this.vfx.projectileImpact(s.mesh.position);
      this.spits.deactivate(s);
      this._damagePlayer(COMBAT.SPITTER.DAMAGE, this._vSource);
    }

    this._reapAndUpdate(simDt, t, playerPos, dt);

    // Consume enemy intents raised during their update.
    for (const e of this.enemies) {
      if (e.attackReady) {
        e.attackReady = false;
        this._damagePlayer(COMBAT.CHASER.DAMAGE, e.pos);
      }
      if (e.spitRequested) {
        e.spitRequested = false;
        e.muzzle(this._vSpit);
        this._vDir.copy(playerPos).sub(this._vSpit).normalize();
        this.spits.fire(this._vSpit, this._vDir, COMBAT.SPITTER.SPIT_SPEED, 4);
      }
    }

    // Wave flow: cleared → breather → next wave. Arena runs (endless or fixed
    // length) never self-win — the ArenaController ends the fight via stop()
    // when the guardian falls.
    if (this._aliveCount() === 0) {
      // Report the clear exactly once, before any hold decision: an arena gates
      // its riddle round on this, and the gate must land even mid-breather.
      const cleared = this._wave + 1;
      if (this._onWaveCleared && cleared > this._clearedWave) {
        this._clearedWave = cleared;
        this._onWaveCleared(cleared);
      }
      if (this._wavesHeld) { this._waveGap = 0; return; }

      const last = this._totalWaves > 0
        ? this._wave >= this._totalWaves - 1
        : this._wave >= COMBAT.WAVES.length - 1;
      if (last) {
        // A fixed-length arena hands its ending to the controller; a standalone
        // contested-artifact fight is won right here.
        if (this._totalWaves > 0 || this._endless) return;
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

  // ArenaController victory: end the fight cleanly (enemies poof, HUD hides).
  stop() { this.abortFight(); }

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
    this.hp = Math.min(COMBAT.PLAYER_HP, this.hp + COMBAT.HEAL_ON_CLEAR);
    this._updateHealthUi();
    this.audio.playWaveClear();
    this.active = false;
    this._origin = null;
    this._hideHud();
  }

  // Full teardown for a zone switch.
  dispose() {
    for (const e of this.enemies) e.dispose();
    this.enemies.length = 0;
    this._pending.length = 0;
    this.bolts.dispose();
    this.spits.dispose();
    this.vfx.dispose();
    this.hud.dispose();
    this._onEnemyDefeated = null;
    this.setOvercharge(false);
    this.camera.fov = this._baseFov;
    this.camera.updateProjectionMatrix();
    this._hideHud();
  }
}
