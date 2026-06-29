// ============================================================
// GUARDIAN — roaming "bantay" that gates a zone's artifacts behind a riddle
// challenge. It teleports between spots (marked by a tall glowing beacon);
// walking within GUARDIAN.ENCOUNTER_RANGE auto-starts the riddle.
//
// This is the SHARED shell: teleport, beacon, fade, defeat→scatter origin, and
// the encounter-distance read are identical for every zone. The BODY differs
// per zone — each zone has a visually distinct Guardian — so the figure build
// + idle animation are delegated to a per-zone builder (see ./guardians/).
// Pass `variant` (e.g. 'zone1') to pick one.
// ============================================================
import * as THREE from 'three';
import { CONFIG, GUARDIAN, PLAYER_RADIUS } from '../config.js';
import { GUARDIAN_BUILDERS } from './guardians/index.js';

const SPAWN_CLEARANCE = PLAYER_RADIUS + 0.4;   // keep the guardian out of walls

export class Guardian {
  constructor(scene, world, variant = 'zone1') {
    this.scene = scene;
    this.world = world;            // provides spawnNodes + collidesAt
    this.variant = variant;
    this.roaming = false;          // teleport timer only runs while seeking
    this.alive = true;
    this._teleTimer = 0;
    this._fade = 1;                // 0..1 visibility (eased toward _fadeTarget)
    this._fadeTarget = 1;

    this.group = new THREE.Group();       // world placement (teleports here)
    this.figure = new THREE.Group();      // the humanoid (built by the variant)
    this.figure.position.y = CONFIG.WATER_LEVEL;
    this.group.add(this.figure);

    // Build the zone-specific body. The builder returns the contract the shell
    // drives: materials to fade, the chest anchor, glow colour, idle animation.
    const build = GUARDIAN_BUILDERS[variant] || GUARDIAN_BUILDERS.zone1;
    this._body = build(this.figure);
    this._fadeMats = this._body.fadeMats;
    this._chestY = this._body.chestY ?? 3.1;
    this._centerY = CONFIG.WATER_LEVEL + this._chestY;   // burst + halo + poof anchor

    this._buildBeacon();

    // Halo light at the chest so the figure lifts off the dark water.
    this.halo = new THREE.PointLight(this._body.glowColor ?? GUARDIAN.CORE_COLOR, 2.0, 12, 1.5);
    this.halo.position.y = this._chestY;
    this.figure.add(this.halo);

    this.scene.add(this.group);

    // One-shot teleport "poof" particle puff (reused; never re-allocated).
    this._poofCount = 48;
    const pg = new THREE.BufferGeometry();
    this._poofPos = new Float32Array(this._poofCount * 3);
    this._poofVel = new Float32Array(this._poofCount * 3);
    pg.setAttribute('position', new THREE.BufferAttribute(this._poofPos, 3));
    this.poofMat = new THREE.PointsMaterial({
      color: GUARDIAN.BEACON_COLOR, size: 0.34, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.poof = new THREE.Points(pg, this.poofMat);
    this.poof.frustumCulled = false;
    this._poofLife = 0;
    this.scene.add(this.poof);

    this._v = new THREE.Vector3();   // scratch
    this._placeInitial();
  }

  _buildBeacon() {
    // Tall light column: a thin additive cylinder that reads through the fog so
    // the player can spot the guardian from across the zone.
    this.beaconMat = new THREE.MeshBasicMaterial({
      color: GUARDIAN.BEACON_COLOR, transparent: true, opacity: 0.32,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.55, GUARDIAN.BEACON_HEIGHT, 8, 1, true),
      this.beaconMat,
    );
    this.beacon.position.y = CONFIG.WATER_LEVEL + GUARDIAN.BEACON_HEIGHT / 2;
    this.group.add(this.beacon);
  }

  // --- placement -------------------------------------------------------------

  _placeInitial() {
    const p = this._pickSpot(null);
    this.group.position.set(p.x, 0, p.z);
  }

  // Pick a valid teleport target: jittered spawn node, clear of colliders, in
  // bounds, and (when given) at least MIN_PLAYER_DIST from the player.
  _pickSpot(playerPos) {
    const L = CONFIG.ZONE_HALF - 4;
    const nodeGroups = Object.values(this.world.spawnNodes);
    const flat = [].concat(...nodeGroups);
    for (let tries = 0; tries < 40; tries++) {
      let x, z;
      if (flat.length && tries < 30) {
        const [nx, nz] = flat[Math.floor(Math.random() * flat.length)];
        x = nx + (Math.random() - 0.5) * 6;
        z = nz + (Math.random() - 0.5) * 6;
      } else {
        x = (Math.random() * 2 - 1) * L;
        z = (Math.random() * 2 - 1) * L;
      }
      if (Math.abs(x) > L || Math.abs(z) > L) continue;
      if (this.world.collidesAt(x, z, SPAWN_CLEARANCE)) continue;
      if (playerPos) {
        const dx = x - playerPos.x, dz = z - playerPos.z;
        if (dx * dx + dz * dz < GUARDIAN.MIN_PLAYER_DIST * GUARDIAN.MIN_PLAYER_DIST) continue;
      }
      return { x, z };
    }
    return { x: this.group.position.x, z: this.group.position.z };
  }

  // --- public API ------------------------------------------------------------

  setRoaming(on) { this.roaming = on; this._teleTimer = 0; }

  // Vanish, puff at the old spot, and reappear elsewhere (away from the player).
  teleport(playerPos) {
    if (!this.alive) return;
    this._spawnPoof();
    const p = this._pickSpot(playerPos);
    this.group.position.set(p.x, 0, p.z);
    this._fade = 0;           // re-fade in at the new spot
    this._fadeTarget = 1;
  }

  // World-space center (XZ position at chest height) — the burst + halo + poof
  // anchor. Used by the defeat cinematic to frame the guardian before it falls.
  center() {
    this._v.set(this.group.position.x, this._centerY, this.group.position.z);
    return this._v;
  }

  // Defeat: implode with a bigger puff, hide, and return the world position so the
  // caller can burst the artifacts from here.
  defeat() {
    this.alive = false;
    this.roaming = false;
    this._fadeTarget = 0;
    this._spawnPoof(GUARDIAN.POOF_DEFEAT_POWER);
    return this.center().clone();
  }

  // `power` scales the puff (faster/larger/brighter): 1 for teleport, higher for defeat.
  _spawnPoof(power = 1) {
    this.poof.position.set(this.group.position.x, this._centerY, this.group.position.z);
    for (let i = 0; i < this._poofCount; i++) {
      this._poofPos[i * 3] = 0;
      this._poofPos[i * 3 + 1] = 0;
      this._poofPos[i * 3 + 2] = 0;
      const dir = new THREE.Vector3(
        Math.random() * 2 - 1, Math.random() * 1.6 - 0.4, Math.random() * 2 - 1,
      ).normalize().multiplyScalar((1.8 + Math.random() * 2.8) * power);
      this._poofVel[i * 3] = dir.x;
      this._poofVel[i * 3 + 1] = dir.y;
      this._poofVel[i * 3 + 2] = dir.z;
    }
    this.poof.geometry.attributes.position.needsUpdate = true;
    this._poofLife = 1;
    this.poofMat.size = 0.34 * (0.6 + 0.4 * power);
    this.poofMat.opacity = Math.min(1, 0.9 * power);
  }

  // Per-frame. Returns distance from the guardian to the player (Infinity once
  // defeated so the encounter never re-triggers).
  update(dt, t, playerPos) {
    // Advance the teleport puff regardless of alive state.
    if (this._poofLife > 0) {
      this._poofLife = Math.max(0, this._poofLife - dt * 1.6);
      for (let i = 0; i < this._poofCount; i++) {
        this._poofPos[i * 3] += this._poofVel[i * 3] * dt;
        this._poofPos[i * 3 + 1] += (this._poofVel[i * 3 + 1] - 0.6) * dt;
        this._poofPos[i * 3 + 2] += this._poofVel[i * 3 + 2] * dt;
      }
      this.poof.geometry.attributes.position.needsUpdate = true;
      this.poofMat.opacity = 0.9 * this._poofLife;
    }

    // Ease visibility toward the target (teleport / defeat fades).
    this._fade += (this._fadeTarget - this._fade) * Math.min(1, dt / GUARDIAN.FADE);
    const f = this._fade;
    this.group.visible = f > 0.01;
    for (const [m, base] of this._fadeMats) m.opacity = base * f;
    this.beaconMat.opacity = (0.26 + Math.sin(t * 1.7) * 0.08) * f;
    this.halo.intensity = 2.0 * f;

    if (!this.alive) return Infinity;

    // Idle life is owned by the per-zone body (bob, face player, sway, orbits).
    this._body.animate(dt, t, f, playerPos, this.group.position);

    // Roam timer (only while seeking, frozen during a riddle dialog).
    if (this.roaming) {
      this._teleTimer += dt;
      if (this._teleTimer >= GUARDIAN.TELEPORT_INTERVAL) {
        this._teleTimer = 0;
        this.teleport(playerPos);
      }
    }

    this._v.set(this.group.position.x, this._centerY, this.group.position.z);
    return playerPos.distanceTo(this._v);
  }

  dispose() {
    this.scene.remove(this.group);
    this.scene.remove(this.poof);
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    for (const [m] of this._fadeMats) m.dispose();
    this.beaconMat.dispose();
    this.poof.geometry.dispose();
    this.poofMat.dispose();
  }
}
