// ============================================================
// REVELER BOSS — Arena 2's post-riddle fight. The coral titan shifts between
// river anchors, calls threat groups, and cycles four attacks at a player who is
// bolted to a bangka and can only aim, shoot, and reflect.
//
// Because the player cannot step out of anything, every pattern has to test a
// different SKILL rather than a different dodge:
//   formation — charged orbs to reflect back into the boss (the main damage route)
//   shell     — a rotating armour gap: pure aim timing, no projectiles
//   scatter   — Scatter Hex, a screen-wide spray to clear before it closes in
//   overload  — Overload Channel, the set-piece: sever ten tethers or eat the beam
// One `_pattern` guard keeps them mutually exclusive, and the weighted roll rejects
// whatever ran last, so nothing repeats back to back. This is the same scheduler
// shape FeastkeeperBoss uses in Zone 1 — see that file for the reasoning.
// ============================================================
import * as THREE from 'three';
import { RAIL_ARENA } from '../../config.js';
import { ArenaBoss } from './ArenaBoss.js';
import { RevelerProjectilePool } from './RevelerProjectilePool.js';
import { ShellRotation } from './_partials/ShellRotation.js';
import { ScatterHex } from './_partials/ScatterHex.js';
import { OverloadChannel } from './_partials/OverloadChannel.js';

// Per-phase arrays are indexed by phase 0/1/2 (BOSS_DEFAULTS.PHASE_THRESHOLDS),
// so each must have exactly three entries.
const REVELER_TUNING = {
  HP: 150,
  ANCHORS: [-5.5, 0, 5.5],
  MOVE_WARNING: 0.45,
  MOVE_DURATION: 0.6,
  MOVE_INTERVAL: [[5, 7], [4, 6], [3, 5]],
  FORMATION_COUNT: [[1, 2], [2, 3], [3, 5]],
  SUMMON_COUNT: [[1, 2], [1, 3], [2, 3]],
  SUMMON_INTERVAL: [[5, 10], [5, 8], [4, 7]],
  REFLECT_DAMAGE: 6,

  // --- attack scheduler ---
  // Weights are relative. Overload is deliberately rare: it is a ~20s set-piece,
  // and at these intervals the first one lands roughly half a minute in.
  ATTACK_INTERVAL: [[3.4, 4.6], [2.8, 3.8], [2.2, 3.0]],
  ATTACK_WEIGHTS: { formation: 5, shell: 2, scatter: 2, overload: 1 },

  // Shell Rotation. GAP_ARC ~50 deg. GAP_MULT multiplies boltDamage rather than
  // being a flat number, so the Lumina overcharge still doubles it.
  // Why 2 and not more: while the shell is closed the chest is unreachable, so a
  // multiplier of 1 would make the pattern a pure tax. At 2, perfectly tracking
  // the gap for a whole rotation beats standing there shooting an open chest,
  // and fumbling it does worse — the skill check pays for itself and no more.
  SHELL: {
    DURATION: [5.5, 6.5, 7.5], GAP_ARC: 0.87, SPIN: [1.5, 1.9, 2.4], GAP_MULT: 2,
  },

  // Scatter Hex. Every hex dies to one bolt, so COUNT is the real difficulty dial.
  // 20 hexes at 5 damage is a 100-point threat — the whole health bar — which is
  // what makes ignoring the pattern non-viable without ever being a guaranteed kill.
  SCATTER: {
    COUNT: [12, 16, 20], HOLD: [0.5, 1.8], SPEED: 4.6, LIFE: 9, DAMAGE: 5,
    Y_RANGE: [0.8, 4.6], Z_RANGE: [-26, -13],
  },

  // Overload Channel. DURATION is derived, not vibes: COMBAT.BOLT.COOLDOWN is
  // 0.22s (~4.55 shots/sec) and BOLT.DAMAGE is 1, so ten nodes at 6-8 HP is ~70
  // bolts ~= 15.4s of perfect uninterrupted fire. A 15s channel would be
  // unclearable by arithmetic before a single frame of aiming; 22/20/18 leaves
  // real slack early and tightens with the enrage. To run a 15s channel instead,
  // drop NODE_COUNT to 6 — the difficulty lands in the same place.
  OVERLOAD: {
    DURATION: [22, 20, 18], NODE_COUNT: 6, NODE_HP: [3, 4], SEPARATION: 3.2,
    Y_RANGE: [0.7, 4.2], Z_RANGE: [-27, -12],
    BEAM_DAMAGE: 35, BEAM_HOLD: 0.7, STAGGER: 3,
  },
};

export class RevelerBoss extends ArenaBoss {
  constructor(guardian, combat, audio, player, rng) {
    super(guardian, combat, audio, player, REVELER_TUNING);
    this._rng = rng;
    this._anchorIndex = 1;
    this._moveState = 'idle';
    this._moveTimer = this._draw(this.tuning.MOVE_INTERVAL[0]);
    this._moveAge = 0;
    this._moveFrom = 0;
    this._moveTo = 0;
    this._summonTimer = this._draw(this.tuning.SUMMON_INTERVAL[0]);
    this._boatTarget = new THREE.Vector3(
      RAIL_ARENA.CENTER.x,
      RAIL_ARENA.BOAT_EYE_BASE + 1.15,
      RAIL_ARENA.CENTER.z,
    );
    this._handleReflectedHit = (position) => this._receiveReflectedHit(position);
    this.projectiles = new RevelerProjectilePool(
      combat.scene, combat, audio, this._handleReflectedHit,
    );
    this._shell = new ShellRotation(combat.scene, this.tuning.SHELL);
    this._scatter = new ScatterHex(
      combat.scene, combat, audio, this.tuning.SCATTER,
    );
    this._overload = new OverloadChannel(
      combat.scene, combat, audio, this.tuning.OVERLOAD,
    );

    this._pattern = 'idle';    // mutual exclusion: only one attack is ever live
    this._lastPattern = null;
    this._staggerLeft = 0;
    this._attackTimer = this._draw(this.tuning.ATTACK_INTERVAL[0]);
    this.guardian.group.position.set(0, 0, this.guardian.world.zone.guardianStart?.z ?? -31);
  }

  begin() {
    if (this.active || this.defeated) return;
    super.begin();
    this.combat.spawnRandomGroup(2, 2);
  }

  _act(dt) {
    const center = this.center();

    // Unconditional: orbs, hexes, and the beam all outlive the pattern that threw
    // them and must keep resolving after the scheduler has moved on.
    this.projectiles.update(dt, center, this._boatTarget);
    this._scatter.update(dt, this._boatTarget);
    this._overload.update(dt, center);
    this._shell.update(dt, center);

    if (this._pattern === 'idle') this._tickAttackTimer(dt);
    else this._advancePattern(dt);

    this._updateMovement(dt);
    this._updateSummons(dt);
  }

  // --- scheduler -------------------------------------------------------------

  _tickAttackTimer(dt) {
    if (this._staggerLeft > 0) { this._staggerLeft -= dt; return; }
    this._attackTimer -= dt;
    if (this._attackTimer > 0) return;
    this._beginPattern(this._choosePattern());
  }

  // Weighted roll, rejecting whatever ran last so nothing repeats back to back.
  _choosePattern() {
    const weights = this.tuning.ATTACK_WEIGHTS;
    const names = Object.keys(weights).filter((n) => n !== this._lastPattern);
    let total = 0;
    for (const n of names) total += weights[n];
    let roll = this._rng() * total;
    for (const n of names) {
      roll -= weights[n];
      if (roll <= 0) return n;
    }
    return names[names.length - 1];
  }

  _beginPattern(name) {
    this._pattern = name;
    this._lastPattern = name;

    if (name === 'formation') {
      const [min, max] = this.tuning.FORMATION_COUNT[this.phase];
      const count = min + Math.floor(this._rng() * (max - min + 1));
      this.projectiles.spawnFormation(count, this._rng);
      return;
    }
    if (name === 'shell') {
      this.combat.hud.popupCallout(this._calloutAnchor(), 'CORAL SHELL');
      this._shell.start(
        this.tuning.SHELL.DURATION[this.phase],
        this.tuning.SHELL.SPIN[this.phase],
        this.center(),
        this._rng,
      );
      this.audio?.playTeleport?.();
      return;
    }
    if (name === 'scatter') {
      this.combat.hud.popupCallout(this._calloutAnchor(), 'SCATTER HEX');
      this.combat.vfx.keeperPulse(this.center(), 'telegraph');
      this._scatter.spawn(this.tuning.SCATTER.COUNT[this.phase], this._rng);
      return;
    }

    // overload: the boss commits to the centre lane for the whole channel, so the
    // ten nodes are never read against a boss sliding behind them.
    this.combat.hud.popupCallout(this._calloutAnchor(), 'OVERLOAD CHANNEL');
    this._slideToAnchor(1);
    this._overload.start(
      this.tuning.OVERLOAD.DURATION[this.phase],
      this.tuning.OVERLOAD.NODE_COUNT,
      this._rng,
      this.center(),
    );
  }

  _advancePattern(dt) {
    if (this._pattern === 'formation') {
      if (this.projectiles.hasActive) return;
      this._endPattern();
      return;
    }
    if (this._pattern === 'shell') {
      if (this._shell.busy) return;
      this._endPattern();
      return;
    }
    if (this._pattern === 'scatter') {
      if (this._scatter.busy) return;
      this._endPattern();
      return;
    }

    // overload
    if (this._overload.busy) return;
    if (this._overload.cancelled) {
      this._overload.cancelled = false;
      this._staggerLeft = this.tuning.OVERLOAD.STAGGER;
      this.combat.hud.popupCallout(this._calloutAnchor(), 'OVERLOADED');
    }
    // Redraw rather than resume: summons were suspended for the whole channel, and
    // a stale timer would dump a backlogged group the instant it closes.
    this._summonTimer = this._draw(this.tuning.SUMMON_INTERVAL[this.phase]);
    this._endPattern();
  }

  _endPattern() {
    this._pattern = 'idle';
    this._attackTimer = this._draw(this.tuning.ATTACK_INTERVAL[this.phase]);
  }

  // --- shell-aware bolt handling ---------------------------------------------

  // The shell gets first refusal on every bolt: through the gap is bonus damage,
  // anything else on the plate spends the bolt on a BLOCKED flare. Whatever the
  // shell does not intercept still falls through to the normal chest test — while
  // the petals are mid-iris the plate is smaller than the chest, and those frames
  // must not be a dead zone where shooting the boss does nothing at all.
  _testPlayerBolts() {
    if (!this._shell.busy) { super._testPlayerBolts(); return; }
    for (const shot of this.combat.bolts.slots) {
      if (!shot.active) continue;
      const result = this._shell.testBolt(shot.mesh.position);
      if (result === 'miss') continue;
      this.combat.bolts.deactivate(shot);
      if (result === 'blocked' || this._invuln > 0) {
        this.pingArmored(shot.mesh.position);
        continue;
      }
      this.damage(this.combat.boltDamage * this.tuning.SHELL.GAP_MULT, shot.mesh.position);
      this.combat.registerPlayerBoltHit(false);
    }
    super._testPlayerBolts();
  }

  // --- movement --------------------------------------------------------------

  _updateMovement(dt) {
    if (this._moveState === 'telegraph') {
      this._moveAge += dt;
      if (this._moveAge < this.tuning.MOVE_WARNING) return;
      this._moveState = 'moving';
      this._moveAge = 0;
      return;
    }
    if (this._moveState === 'moving') {
      this._moveAge += dt;
      const p = Math.min(1, this._moveAge / this.tuning.MOVE_DURATION);
      const eased = p * p * (3 - 2 * p);
      this.guardian.group.position.x = this._moveFrom + (this._moveTo - this._moveFrom) * eased;
      if (p < 1) return;
      this.guardian.group.position.set(this._moveTo, 0, this.guardian.group.position.z);
      this._moveState = 'idle';
      this._moveTimer = this._draw(this.tuning.MOVE_INTERVAL[this.phase]);
      return;
    }

    // Only the DECISION to hop anchors is gated on the scheduler — a slide already
    // in flight above still finishes, which is what lets the overload's move to
    // centre resolve while its own pattern owns the guard.
    if (this._pattern !== 'idle' || this._staggerLeft > 0) return;
    this._moveTimer -= dt;
    if (this._moveTimer > 0) return;
    const options = [];
    for (let i = 0; i < this.tuning.ANCHORS.length; i++) {
      if (i !== this._anchorIndex) options.push(i);
    }
    this._slideToAnchor(options[Math.floor(this._rng() * options.length)]);
  }

  _slideToAnchor(index) {
    if (this._anchorIndex === index && this._moveState === 'idle'
      && this.guardian.group.position.x === this.tuning.ANCHORS[index]) return;
    this._anchorIndex = index;
    this._moveFrom = this.guardian.group.position.x;
    this._moveTo = this.tuning.ANCHORS[index];
    this._moveAge = 0;
    this._moveState = 'telegraph';
    this.combat.vfx.keeperPulse(this.center(), 'telegraph');
    this.audio?.playTeleport?.();
  }

  // --- summons ---------------------------------------------------------------

  // Suspended for the whole Overload Channel. Clearing ten nodes against the timer
  // already takes every shot the player has; adds spawning into it would put the
  // cancel out of reach and turn the pattern into a scripted 35 damage.
  _updateSummons(dt) {
    if (this._pattern === 'overload') return;
    this._summonTimer -= dt;
    if (this._summonTimer > 0) return;
    const [min, max] = this.tuning.SUMMON_COUNT[this.phase];
    this.combat.spawnRandomGroup(min, max);
    this._summonTimer = this._draw(this.tuning.SUMMON_INTERVAL[this.phase]);
  }

  _receiveReflectedHit(position) {
    if (!this.active || this.defeated) return;
    if (this._invuln > 0) {
      this.pingArmored(position);
      return;
    }
    this.damage(this.tuning.REFLECT_DAMAGE, position);
  }

  // The committed patterns are wiped on an enrage: the player cannot damage the
  // boss during the invuln flare, so anything still demanding a response would be
  // pressure with no counterplay.
  _onPhaseChanged() {
    this._clearPatterns();
    this._attackTimer = this.tuning.ENRAGE_INVULN;
    this.combat.spawnRandomGroup(3, 3);
    this._summonTimer = this._draw(this.tuning.SUMMON_INTERVAL[this.phase]);
    this._moveTimer = Math.min(this._moveTimer, 1.2);
  }

  _onDefeated() { this._clearPatterns(); }

  _clearPatterns() {
    this.projectiles.reset();
    this._shell.clear();
    this._scatter.clear();
    this._overload.clear();
    this._pattern = 'idle';
    this._lastPattern = null;
    this._staggerLeft = 0;
  }

  _draw([min, max]) { return min + this._rng() * (max - min); }

  // The pattern partials own real scene meshes, and RailArenaController builds a
  // fresh boss on every faint-restart — without this they would pile up.
  dispose() {
    this.projectiles.dispose();
    this._shell.dispose();
    this._scatter.dispose();
    this._overload.dispose();
    super.dispose();
  }
}
