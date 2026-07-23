// ============================================================
// FEASTKEEPER BOSS (Strings v2.0) — Zone 1's final phase, an ArenaBoss subclass.
// While its armor holds the guardian is untouchable and passive; once the last
// bugtong strips the last layer, ArenaController hands control here and the
// Feastkeeper fights.
//
// Its mechanic is ATTRITION ON TWO CLOCKS: telegraphed spits at the player on
// one timer, drowned echoes summoned on a separate randomized one, so shots and
// adds never settle into a single rhythm the player can stand still inside. Each
// enrage shortens both and weights the summon draw toward the bigger groups.
//
// Zone 2's and Zone 3's bosses subclass the same ArenaBoss shell with entirely
// different `_act` bodies — see arena/ArenaBoss.js for the shared contract.
// ============================================================
import { ArenaBoss } from './ArenaBoss.js';

// Per-phase arrays are indexed by phase 0/1/2 (see BOSS_DEFAULTS.PHASE_THRESHOLDS).
// These live here, beside the mechanics that read them, rather than in config.js
// where three unrelated boss fights would pile into one block.
export const FEASTKEEPER_TUNING = {
  HP: 100,
  SHOT_INTERVAL: [2.6, 1.9, 1.3],
  TELEGRAPH: 0.45,                  // warning pulse before each shot leaves
  SPIT_SPEED: 11,
  SPIT_LIFE: 4,
  SUMMON_INTERVAL: [[7, 10], [5, 8], [3.5, 6]],   // randomized [min, max] per phase
  SUMMON_SIZES: [1, 3, 5],          // group size drawn per summon, weighted by phase
  SUMMON_RANGED_SHARE: 3,           // one spitter per this many summoned echoes
  MAX_ADDS: 8,                      // live-add ceiling; summons skip past this
};

export class FeastkeeperBoss extends ArenaBoss {
  constructor(guardian, combat, audio, player) {
    super(guardian, combat, audio, player, FEASTKEEPER_TUNING);
    this._shotTimer = this.tuning.SHOT_INTERVAL[0];
    this._telegraphed = false;
    this._summonTimer = this._drawSummonDelay();
  }

  _act(dt, playerPos) {
    this._shotTimer -= dt;
    if (!this._telegraphed && this._shotTimer <= this.tuning.TELEGRAPH) {
      this._telegraphed = true;
      this.combat.vfx.keeperPulse(this.center(), 'telegraph');
    }
    if (this._shotTimer <= 0) {
      this._resetShotTimer();
      this._fire(playerPos);
    }

    this._summonTimer -= dt;
    if (this._summonTimer <= 0) {
      this._summonTimer = this._drawSummonDelay();
      this._summon(this._drawSummonSize());
    }
  }

  // Entering a phase opens with the biggest group, so the enrage is felt as a
  // sudden crowd rather than only as a slightly faster timer.
  _onPhaseChanged() {
    this._resetShotTimer();
    this._summon(this.tuning.SUMMON_SIZES[this.tuning.SUMMON_SIZES.length - 1]);
    this._summonTimer = this._drawSummonDelay();
  }

  _resetShotTimer() {
    this._shotTimer = this.tuning.SHOT_INTERVAL[this.phase];
    this._telegraphed = false;
  }

  // The spit lands through CombatManager's existing spit-vs-player pass, so the
  // boss needs no damage path of its own.
  _fire(playerPos) {
    const dir = this.aimAt(playerPos);
    this.combat.spits.fire(this._center, dir, this.tuning.SPIT_SPEED, this.tuning.SPIT_LIFE);
  }

  _drawSummonDelay() {
    const [min, max] = this.tuning.SUMMON_INTERVAL[this.phase];
    return min + Math.random() * (max - min);
  }

  // Group size for one summon. Later phases weight the draw toward the big
  // groups, so a 5-echo burst is rare early and routine at low HP.
  _drawSummonSize() {
    const sizes = this.tuning.SUMMON_SIZES;
    const roll = Math.random();
    if (this.phase === 0) return roll < 0.7 ? sizes[0] : sizes[1];
    if (this.phase === 1) return roll < 0.45 ? sizes[0] : roll < 0.9 ? sizes[1] : sizes[2];
    return roll < 0.35 ? sizes[1] : sizes[2];
  }

  // Summon a mixed group (roughly a third ranged) through the manager's normal
  // spawn path, so each echo still arrives behind its woven-thread tear.
  _summon(count) {
    if (this.combat.aliveCount() >= this.tuning.MAX_ADDS) return;
    const spitters = Math.floor(count / this.tuning.SUMMON_RANGED_SHARE);
    this.combat.spawnExtra(count - spitters, spitters);
  }
}
