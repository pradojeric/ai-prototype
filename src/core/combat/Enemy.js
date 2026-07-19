// ============================================================
// ENEMY — a "drowned echo": a small spectral shard of the defeated Guardian
// that swarms the player during a wave fight. Two archetypes share this class:
//   'chaser'  — fast melee swarmer, steers straight at the player
//   'spitter' — keeps its distance and lobs slow glowing spits
// Bodies are built from the shared guardian primitives (fadeMat) so they read
// as kin of the zone's Guardian; the fade in/out mirrors Guardian's easing.
// ============================================================
import * as THREE from 'three';
import { CONFIG, COMBAT, GUARDIAN } from '../../config.js';
import { fadeMat, angDelta } from '../guardians/primitives.js';

const POOF_COUNT = 16;   // small per-enemy death puff (Guardian uses 48)

export class Enemy {
  constructor(scene, world, type, x, z, hpBonus = 0) {
    this.scene = scene;
    this.world = world;
    this.type = type;
    const cfg = type === 'chaser' ? COMBAT.CHASER : COMBAT.SPITTER;
    this.cfg = cfg;
    this.hp = cfg.HP + hpBonus;
    this.radius = cfg.RADIUS;
    this.alive = true;

    // Flags the manager consumes each frame (the enemy never touches pools/hp).
    this.spitRequested = false;   // spitter: fire a spit at the player now
    this.attackReady = false;     // chaser: in range + cooldown elapsed

    this._fade = 0;               // spawn: fade in from nothing
    this._fadeTarget = 1;
    this._flash = 0;              // 1→0 hit-flash envelope on the glow material
    this._attackTimer = 0;
    this._spitTimer = cfg.SPIT_INTERVAL ? cfg.SPIT_INTERVAL * (0.5 + Math.random() * 0.5) : 0;
    this._windup = 0;             // >0 while the spitter telegraphs its shot
    this._bobPhase = Math.random() * Math.PI * 2;
    this._strafeDir = Math.random() < 0.5 ? 1 : -1;

    // Line-of-sight state: re-checked on a staggered timer (phase-offset so a
    // whole wave doesn't test on the same frame). While blocked, movement
    // follows the nav flow field instead of steering straight at the player.
    this._los = true;
    this._losTimer = (this._bobPhase / (Math.PI * 2)) * COMBAT.NAV.LOS_INTERVAL;
    this._flowDir = { x: 0, z: 0 };   // scratch for NavGrid.dirAt

    this.group = new THREE.Group();
    this.group.position.set(x, 0, z);
    this._buildBody();
    scene.add(this.group);

    // Per-enemy one-shot death puff (allocated once at spawn — only per-frame
    // allocation is banned; mirrors Guardian._spawnPoof at a smaller scale).
    const pg = new THREE.BufferGeometry();
    this._poofPos = new Float32Array(POOF_COUNT * 3);
    this._poofVel = new Float32Array(POOF_COUNT * 3);
    pg.setAttribute('position', new THREE.BufferAttribute(this._poofPos, 3));
    this._poofMat = new THREE.PointsMaterial({
      color: this._glowColor, size: 0.22, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this._poof = new THREE.Points(pg, this._poofMat);
    this._poof.frustumCulled = false;
    this._poofLife = 0;
    scene.add(this._poof);

    this._v = new THREE.Vector3();   // scratch
  }

  // Distinct silhouettes per archetype so threats read at a glance:
  // chaser = a lean forward-swept spectral shard; spitter = a rounder husk
  // with a bright "mouth" that swells as it winds up a spit.
  _buildBody() {
    const isChaser = this.type === 'chaser';
    this._glowColor = isChaser ? GUARDIAN.CORE_COLOR : COMBAT.SPITTER.SPIT_COLOR;

    // Per-enemy materials (fade + hit-flash are per-instance state).
    this._bodyMat = fadeMat(0x1c3a40, isChaser ? 0x2a6a74 : 0x6a4530, 0.5, 0.85);
    this._glowMat = fadeMat(0xdffbff, this._glowColor, 2.0, 0.95, 0.3, 0);
    this._glowBase = this._glowMat.emissiveIntensity;
    this.fadeMats = [[this._bodyMat, this._bodyMat.opacity], [this._glowMat, this._glowMat.opacity]];

    this.figure = new THREE.Group();
    this.figure.position.y = CONFIG.WATER_LEVEL + this.cfg.HOVER;
    this.group.add(this.figure);

    if (isChaser) {
      // Lean shard: a forward-tipped cone body with trailing fin planes.
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.1, 6), this._bodyMat);
      body.rotation.x = Math.PI / 2 + 0.35;    // tip forward (-Z), tail up
      this.figure.add(body);
      for (const sx of [-1, 1]) {
        const fin = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 4), this._bodyMat);
        fin.position.set(sx * 0.2, 0.1, 0.35);
        fin.rotation.z = sx * 0.9;
        this.figure.add(fin);
      }
      const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), this._glowMat);
      eye.position.set(0, 0.05, -0.42);
      this.figure.add(eye);
      this._mouth = eye;
    } else {
      // Round husk: a squashed shell, jaw plate, and a glowing mouth that
      // brightens through the spit wind-up (the telegraph).
      const shell = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), this._bodyMat);
      shell.scale.set(1, 0.8, 1.1);
      this.figure.add(shell);
      const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), this._bodyMat);
      jaw.scale.set(1, 0.5, 0.9);
      jaw.position.set(0, -0.22, -0.12);
      this.figure.add(jaw);
      this._mouth = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), this._glowMat);
      this._mouth.position.set(0, -0.05, -0.4);
      this.figure.add(this._mouth);
    }
  }

  // A bolt landed. Returns true if this hit killed the enemy.
  hit(dmg) {
    if (!this.alive) return false;
    this._flash = 1;
    this.hp -= dmg;
    if (this.hp > 0) return false;
    this.alive = false;
    this._fadeTarget = 0;
    this._spawnPoof();
    return true;
  }

  // Silent removal (leash reset / faint abort): poof out without counting as a kill.
  vanish() {
    if (!this.alive) return;
    this.alive = false;
    this._fadeTarget = 0;
    this._spawnPoof();
  }

  // Fully dead once the dissolve AND the puff have finished — safe to reap.
  get dead() { return !this.alive && this._fade < 0.02 && this._poofLife <= 0; }

  get pos() { return this.group.position; }

  // World-space center used for bolt hit-tests (chest height, not the feet).
  center(out) {
    return out.set(
      this.group.position.x,
      CONFIG.WATER_LEVEL + this.cfg.HOVER,
      this.group.position.z,
    );
  }

  _spawnPoof() {
    this._poof.position.set(
      this.group.position.x, CONFIG.WATER_LEVEL + this.cfg.HOVER, this.group.position.z,
    );
    for (let i = 0; i < POOF_COUNT; i++) {
      this._poofPos[i * 3] = 0;
      this._poofPos[i * 3 + 1] = 0;
      this._poofPos[i * 3 + 2] = 0;
      const ax = Math.random() * 2 - 1, ay = Math.random() * 1.4 - 0.3, az = Math.random() * 2 - 1;
      const inv = (1.4 + Math.random() * 1.8) / Math.max(0.001, Math.hypot(ax, ay, az));
      this._poofVel[i * 3] = ax * inv;
      this._poofVel[i * 3 + 1] = ay * inv;
      this._poofVel[i * 3 + 2] = az * inv;
    }
    this._poof.geometry.attributes.position.needsUpdate = true;
    this._poofLife = 1;
    this._poofMat.opacity = 0.85;
  }

  // Axis-separated collision slide (same idiom as PlayerController) so echoes
  // flow around debris instead of snagging on it.
  _move(dx, dz) {
    const p = this.group.position;
    const L = CONFIG.ZONE_HALF - 1;
    if (!this.world.collidesAt(p.x + dx, p.z, this.radius)) p.x = Math.max(-L, Math.min(L, p.x + dx));
    if (!this.world.collidesAt(p.x, p.z + dz, this.radius)) p.z = Math.max(-L, Math.min(L, p.z + dz));
  }

  update(dt, t, playerPos, nav) {
    // Death puff keeps advancing after alive=false so the dissolve reads.
    if (this._poofLife > 0) {
      this._poofLife = Math.max(0, this._poofLife - dt * 1.8);
      for (let i = 0; i < POOF_COUNT; i++) {
        this._poofPos[i * 3] += this._poofVel[i * 3] * dt;
        this._poofPos[i * 3 + 1] += (this._poofVel[i * 3 + 1] - 0.5) * dt;
        this._poofPos[i * 3 + 2] += this._poofVel[i * 3 + 2] * dt;
      }
      this._poof.geometry.attributes.position.needsUpdate = true;
      this._poofMat.opacity = 0.85 * this._poofLife;
    }

    // Fade easing (mirrors Guardian) + hit-flash decay on the glow material.
    this._fade += (this._fadeTarget - this._fade) * Math.min(1, dt / COMBAT.FADE_IN);
    const f = this._fade;
    this.group.visible = f > 0.01;
    for (const [m, base] of this.fadeMats) m.opacity = base * f;
    this._flash = Math.max(0, this._flash - dt / COMBAT.FEEL.FLASH_DECAY);
    this._glowMat.emissiveIntensity =
      this._glowBase * (1 + this._flash * 1.5) + this._windupGlow();

    if (!this.alive) return;

    // Hover bob.
    this.figure.position.y = CONFIG.WATER_LEVEL + this.cfg.HOVER +
      Math.sin(t * 2.2 + this._bobPhase) * 0.12;
    const dxp = playerPos.x - this.group.position.x;
    const dzp = playerPos.z - this.group.position.z;
    const dist = Math.hypot(dxp, dzp);

    // Staggered line-of-sight re-check; drives steer-direct vs follow-flow.
    this._losTimer -= dt;
    if (this._losTimer <= 0) {
      this._losTimer = COMBAT.NAV.LOS_INTERVAL;
      this._los = !nav || nav.hasLOS(
        this.group.position.x, this.group.position.z, playerPos.x, playerPos.z,
      );
    }
    // Path-following direction from the flow field; falls back to direct
    // steering when the cell is unreached (player unreachable / off-grid).
    const pathing = !this._los && nav && nav.dirAt(
      this.group.position.x, this.group.position.z, this._flowDir,
    );
    let mdx, mdz;   // normalized movement direction
    if (pathing) {
      const finv = 1 / Math.hypot(this._flowDir.x, this._flowDir.z);
      mdx = this._flowDir.x * finv;
      mdz = this._flowDir.z * finv;
    } else {
      const inv = dist > 0.001 ? 1 / dist : 0;
      mdx = dxp * inv;
      mdz = dzp * inv;
    }

    // Face the player when it's visible, the travel direction while routing
    // around geometry (smooth turn via angDelta; bodies face -Z).
    const targetYaw = Math.atan2(pathing ? mdx : dxp, pathing ? mdz : dzp) + Math.PI;
    this.group.rotation.y += angDelta(this.group.rotation.y, targetYaw) * Math.min(1, dt * 6);

    // Can't act (move/attack) until fully faded in — no instant-spawn damage.
    if (f < 0.85) return;

    if (this.type === 'chaser') {
      // Pursuit (direct or flow-routed); lunge-pulse + attack flag in range.
      this._attackTimer = Math.max(0, this._attackTimer - dt);
      if (pathing || dist > this.cfg.ATTACK_RANGE * 0.8) {
        this._move(mdx * this.cfg.SPEED * dt, mdz * this.cfg.SPEED * dt);
      }
      if (this._los && dist <= this.cfg.ATTACK_RANGE && this._attackTimer <= 0) {
        this._attackTimer = this.cfg.ATTACK_COOLDOWN;
        this.attackReady = true;
        this._flash = 0.6;   // lunge tell: brief glow pulse on the strike
      }
      const lunge = 1 + Math.max(0, this._attackTimer - this.cfg.ATTACK_COOLDOWN + 0.15) * 2;
      this.figure.scale.setScalar(lunge);
    } else if (pathing) {
      // No sightline: follow the flow toward the player until LOS returns —
      // it can't hit what it can't see, so it repositions instead of shooting.
      this._move(mdx * this.cfg.SPEED * dt, mdz * this.cfg.SPEED * dt);
      this._windup = 0;   // cancel any telegraph started before cover broke LOS
    } else {
      // Seek preferred range (in if far, back off if crowded) + slow strafe.
      const inv = dist > 0.001 ? 1 / dist : 0;
      const err = dist - this.cfg.PREFERRED_RANGE;
      const seek = Math.max(-1, Math.min(1, err / 3));   // deadband-ish around the ring
      const strafe = Math.sin(t * 0.7 + this._bobPhase) * 0.6 * this._strafeDir;
      const mx = (dxp * inv * seek + -dzp * inv * strafe) * this.cfg.SPEED * dt;
      const mz = (dzp * inv * seek + dxp * inv * strafe) * this.cfg.SPEED * dt;
      this._move(mx, mz);

      // Spit cadence: wind-up telegraph (mouth glow swells) then request a
      // spit — only with a clear sightline, so spits never pass through walls.
      if (this._windup > 0) {
        this._windup -= dt;
        if (this._windup <= 0 && this._los) this.spitRequested = true;
      } else {
        this._spitTimer -= dt;
        if (this._spitTimer <= 0) {
          this._spitTimer = this.cfg.SPIT_INTERVAL;
          this._windup = COMBAT.SPIT_WINDUP;
        }
      }
    }
  }

  // Extra emissive during the spit wind-up — the readable "about to fire" tell.
  _windupGlow() {
    if (this._windup <= 0) return 0;
    return (1 - this._windup / COMBAT.SPIT_WINDUP) * 3;
  }

  // Muzzle for the spit: the glowing mouth's world position.
  muzzle(out) {
    return this._mouth.getWorldPosition(out);
  }

  dispose() {
    this.scene.remove(this.group);
    this.scene.remove(this._poof);
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this._bodyMat.dispose();
    this._glowMat.dispose();
    this._poof.geometry.dispose();
    this._poofMat.dispose();
  }
}
