// ============================================================
// FEASTKEEPER BOSS (Strings v2.0) — Zone 1's final phase, an ArenaBoss subclass.
// While its armor holds the guardian is untouchable and passive; once the last
// bugtong strips the last layer, ArenaController hands control here and the
// Feastkeeper fights.
//
// The Feastkeeper never moves. Everything it does therefore has to make the FLOOR
// the interesting thing — otherwise the fight is standing still and trading shots.
// Four attacks run off one scheduler, each denying space a different way:
//   spit      — the aimed filler that keeps a rhythm between the big patterns
//   grenades  — Handog Barrage: lobbed pots that paint patches you may not stand on
//   spiral    — Spiral Feast: rotating bullet arms you walk between
//   slam      — Offering Slam: a shockwave with one safe wedge, or leap it
// Only one is ever live: `_pattern` is the mutual-exclusion guard, and the same
// pattern never runs twice in a row. Summons keep their own independent clock, so
// adds and attacks never settle into a single readable rhythm.
//
// Only the slam is jumpable. That's deliberate — the combat hop is an answer to
// one pattern, not a universal escape (see PlayerController.setJumpEnabled).
//
// Zone 2's and Zone 3's bosses subclass the same ArenaBoss shell with entirely
// different `_act` bodies — see arena/ArenaBoss.js for the shared contract.
// ============================================================
import * as THREE from 'three';
import { ArenaBoss } from './ArenaBoss.js';
import { FeastGrenades } from './_partials/FeastGrenades.js';
import { SpiralVolley } from './_partials/SpiralVolley.js';
import { OfferingSlam } from './_partials/OfferingSlam.js';
import { immutableBossTuning } from './_partials/BossTuning.js';

// Per-phase arrays are indexed by phase 0/1/2 (see BOSS_DEFAULTS.PHASE_THRESHOLDS),
// so every one of them must have exactly three entries.
// These live here, beside the mechanics that read them, rather than in config.js
// where three unrelated boss fights would pile into one block.
export const FEASTKEEPER_TUNING = {
  HP: 200,
  SHOT_INTERVAL: [2.0, 1.5, 1.0],
  TELEGRAPH: 0.45,                  // warning pulse before each aimed shot leaves
  SPIT_SPEED: 11,
  SPIT_LIFE: 4,
  SHOT_DAMAGE: 10,
  SUMMON_INTERVAL: [[7, 10], [5, 8], [3.5, 6]],   // randomized [min, max] per phase
  SUMMON_SIZES: [1, 3, 5],          // group size drawn per summon, weighted by phase
  SUMMON_RANGED_SHARE: 3,           // one spitter per this many summoned echoes
  MAX_ADDS: 5,                      // live-add ceiling; a summon is skipped while this many echoes are alive

  // --- attack scheduler ---
  // Every pattern is unlocked from the first frame of the boss phase; phases only
  // tighten the gap between them and raise their counts. Weights are relative.
  ATTACK_INTERVAL: [[3.2, 4.2], [2.0, 3.4], [1.5, 2.8]],
  ATTACK_WEIGHTS: { spit: 3, grenades: 2, spiral: 2, slam: 1 },

  // Handog Barrage. FUSE is warning time — the ground ring is up the moment the
  // pot leaves the hand, so this is how long the player has to read and move.
  GRENADE: {
    COUNT: [3, 5, 7], FUSE: 1.35, FLIGHT: 0.95, APEX: 5, STAGGER: 0.18,
    RADIUS: 2.5, DAMAGE: 14, KNOCK: 3.5, SPREAD: [2.5, 7],
  },
  // Spiral Feast. MUZZLE_Y is load-bearing: these rounds fly flat and
  // CombatManager rejects any spit more than 1.4m off the player's eye, so firing
  // from the guardian's ~4m chest would send every one of them overhead.
  SPIRAL: {
    ARMS: 3, SPIN: 0.9, RATE: 0.14, DURATION: [2.6, 3.4, 4.2], MUZZLE_Y: 1.3,
    SPEED: 10, LIFE: 5, DAMAGE: 6, CHARGE: 1.1,
  },
  // Offering Slam. CLEARANCE (0.55) against the hop's ~0.80m peak sets how
  // forgiving the leap window is; GAP_ARC is the safe wedge, ~60°.
  SLAM: {
    WINDUP: 0.5, SPEED: 15, BAND: 1.2, GAP_ARC: 1.05,
    CLEARANCE: 0.55, DAMAGE: 12, KNOCK: 4.5, WAVES: [2, 3, 4],
  },
};

export class FeastkeeperBoss extends ArenaBoss {
  constructor(guardian, combat, audio, player, options = {}) {
    const tuning = immutableBossTuning(FEASTKEEPER_TUNING, options.tuning);
    super(guardian, combat, audio, player, tuning, options);
    this._rng = options.rng || Math.random;
    this._summonTimer = this._drawSummonDelay();

    this._grenades = new FeastGrenades(
      combat.scene, combat, player, this.tuning.GRENADE,
    );
    this._spiral = new SpiralVolley(combat, this.tuning.SPIRAL);
    this._slam = new OfferingSlam(
      combat.scene, combat, player, this.tuning.SLAM,
    );

    this._pattern = 'idle';    // the mutual-exclusion guard; only one attack at a time
    this._lastPattern = null;
    this._patternAge = 0;
    this._slamWavesLeft = 0;
    this._attackTimer = this._drawAttackDelay();
    this._origin = new THREE.Vector3();   // own scratch: aimAt/center share theirs
  }

  _act(dt, playerPos) {
    if (this._pattern === 'idle') this._tickAttackTimer(dt, playerPos);
    else this._advancePattern(dt, playerPos);

    // Both run unconditionally: pots and shockwaves outlive the pattern that threw
    // them, and must keep resolving after the scheduler has moved on.
    this._grenades.update(dt, playerPos);
    this._slam.update(dt, playerPos);
    this._tickSummons(dt);
  }

  // --- scheduler -------------------------------------------------------------

  _tickAttackTimer(dt, playerPos) {
    this._attackTimer -= dt;
    if (this._attackTimer > 0) return;
    this._beginPattern(this._choosePattern(), playerPos);
  }

  // Weighted roll, rejecting whatever ran last so nothing repeats back-to-back.
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

  _beginPattern(name, playerPos) {
    this._pattern = name;
    this._lastPattern = name;
    this._patternAge = 0;
    this._spiralStarted = false;

    if (name === 'spit') {
      this.combat.vfx.keeperPulse(this.center(), 'telegraph');
      return;
    }
    if (name === 'grenades') {
      this.combat.hud.popupCallout(this._calloutAnchor(), 'HANDOG BARRAGE');
      this.guardian.gesture?.('throw');
      const count = this.tuning.GRENADE.COUNT[this.phase];
      // Thrown from the chest so the arc starts where the pots visibly are.
      this._origin.copy(this.center());
      this._grenades.throwSalvo(count, this._origin, playerPos);
      this.audio?.playLanternThrow?.();
      return;
    }
    if (name === 'spiral') {
      this.combat.hud.popupCallout(this._calloutAnchor(), 'SPIRAL FEAST');
      this.combat.vfx.keeperPulse(this.center(), 'telegraph');
      this.guardian.gesture?.('charge');
      return;   // the volley itself starts after CHARGE seconds
    }
    // slam
    this.combat.hud.popupCallout(this._calloutAnchor(), 'OFFERING SLAM');
    this.guardian.gesture?.('slam');
    this.audio?.playTeleport?.();   // generic heavy-boss-action cue, as RevelerBoss uses
    this._slamWavesLeft = this.tuning.SLAM.WAVES[this.phase];
    this._sendSlamWave();
  }

  // Drive whichever pattern is live, and hand control back to the timer the moment
  // it resolves. Returning to 'idle' is what lets the next pattern start.
  _advancePattern(dt, playerPos) {
    this._patternAge += dt;

    if (this._pattern === 'spit') {
      if (this._patternAge < this.tuning.TELEGRAPH) return;
      this._fire(playerPos);
      this._endPattern();
      return;
    }

    if (this._pattern === 'grenades') {
      // Ends as soon as the last pot is gone; `_grenades.update` is what resolves
      // them, so this only has to wait for the pool to empty.
      if (this._grenades.busy) return;
      this._endPattern();
      return;
    }

    if (this._pattern === 'spiral') {
      if (this._patternAge < this.tuning.SPIRAL.CHARGE) return;
      // An explicit latch, not a time window: a long frame could otherwise step
      // clean over a "did we just cross CHARGE?" test and never fire the volley.
      if (!this._spiralStarted) {
        this._spiralStarted = true;
        this._spiral.start(this.tuning.SPIRAL.DURATION[this.phase]);
      }
      this._spiral.update(dt, this.guardian.group.position);
      if (this._spiral.busy) return;
      this._endPattern();
      return;
    }

    // slam: stagger the extra waves so a phase-2 double reads as two passes.
    if (this._slamWavesLeft > 0 && this._patternAge > this.tuning.SLAM.WINDUP + 0.9) {
      this._sendSlamWave();
      this._patternAge = this.tuning.SLAM.WINDUP;   // re-arm the stagger gap
      return;
    }
    if (this._slam.busy) return;
    this._endPattern();
  }

  _endPattern() {
    this._pattern = 'idle';
    this._attackTimer = this._drawAttackDelay();
  }

  _sendSlamWave() {
    if (this._slam.start(this.center())) this._slamWavesLeft--;
    else this._slamWavesLeft = 0;   // no free slot; don't stall the pattern
  }

  _drawAttackDelay() {
    const [min, max] = this.tuning.ATTACK_INTERVAL[this.phase];
    return min + this._rng() * (max - min);
  }

  // Entering a phase opens with the biggest group, so the enrage is felt as a
  // sudden crowd rather than only as a slightly faster timer.
  //
  // The committed GROUND attacks are wiped first: the player can't damage the boss
  // during the invuln flare, so a barrage already in the air would be pressure with
  // no counterplay. Spiral rounds already fired are left alone — they live in the
  // pool shared with the adds' shots, and clearing it would erase those too.
  _onPhaseChanged() {
    this._grenades.clear();
    this._slam.clear();
    this._spiral.stop();
    this._pattern = 'idle';
    this._lastPattern = null;
    this._attackTimer = this.tuning.ENRAGE_INVULN;
    this._summon(this.tuning.SUMMON_SIZES[this.tuning.SUMMON_SIZES.length - 1]);
    this._summonTimer = this._drawSummonDelay();
  }

  _onDefeated() {
    this._grenades.clear();
    this._slam.clear();
    this._spiral.stop();
    this._pattern = 'idle';
  }

  // The spit lands through CombatManager's existing spit-vs-player pass, so the
  // boss needs no damage path of its own.
  _fire(playerPos) {
    const dir = this.aimAt(playerPos);
    this.combat.spits.fire(
      this._center,
      dir,
      this.tuning.SPIT_SPEED,
      this.tuning.SPIT_LIFE,
      { damage: this.tuning.SHOT_DAMAGE },
    );
  }

  // --- summons (independent clock, unchanged) --------------------------------

  _tickSummons(dt) {
    this._summonTimer -= dt;
    if (this._summonTimer > 0) return;
    this._summonTimer = this._drawSummonDelay();
    this._summon(this._drawSummonSize());
  }

  _drawSummonDelay() {
    const [min, max] = this.tuning.SUMMON_INTERVAL[this.phase];
    return min + this._rng() * (max - min);
  }

  // Group size for one summon. Later phases weight the draw toward the big
  // groups, so a 5-echo burst is rare early and routine at low HP.
  _drawSummonSize() {
    const sizes = this.tuning.SUMMON_SIZES;
    const roll = this._rng();
    if (this.phase === 0) return roll < 0.7 ? sizes[0] : sizes[1];
    if (this.phase === 1) return roll < 0.45 ? sizes[0] : roll < 0.9 ? sizes[1] : sizes[2];
    return roll < 0.35 ? sizes[1] : sizes[2];
  }

  // Summon a mixed group (roughly a third ranged) through the manager's normal
  // spawn path, so each echo still arrives behind its woven-thread tear. The
  // group is trimmed to the room left under MAX_ADDS so the live count never
  // overshoots the cap, even when a big draw lands on an already-busy field.
  _summon(count) {
    // Gated at the funnel, not at the clock: the enrage summons directly too, so
    // gating `_tickSummons` alone left the phase-change crowd still arriving.
    if (!this.allowSummons) return;
    const room = this.tuning.MAX_ADDS - this.combat.aliveCount();
    if (room <= 0) return;
    const n = Math.min(count, room);
    const spitters = Math.floor(n / this.tuning.SUMMON_RANGED_SHARE);
    this.combat.spawnExtra(n - spitters, spitters);
  }

  // The pattern partials own real scene meshes, and ArenaController builds a fresh
  // boss on every faint-restart — without this they'd pile up in the scene.
  dispose() {
    this._grenades.dispose();
    this._slam.dispose();
    super.dispose();
  }
}
