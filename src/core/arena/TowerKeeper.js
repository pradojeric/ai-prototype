// ============================================================
// TOWER KEEPER (Strings v2.0) — "The Keeper of Memories", Arena 3's boss and the
// last fight in the game. An ArenaBoss subclass, sharing the scheduler shape the
// Feastkeeper and Reveler already use.
//
// Unlike those two, the Keeper has no Guardian to borrow: its arena is a bare
// summit deck above the flood, so it builds its own body (TowerKeeperBody) and
// hands that to the shell as the guardian. Everything else is the standard
// contract — HP, staged enrages, a chest the light-bolt has to find.
//
// The player here can walk AND jump on an open circular deck, so the four attacks
// are sorted by which kind of movement each one demands:
//   shot    — an aimed burst; the filler that keeps a rhythm between set-pieces
//   charge  — Beacon Charge: a locked lane you step out of, punishing on a whiff
//   stones  — Memory Stones: falling debris that denies ground, read spatially
//   sweep   — Lighthouse Sweep: a rotating blade you outwalk or JUMP
// Only one is ever live: `_pattern` is the mutual-exclusion guard, and the same
// pattern never runs twice in a row.
//
// The sweep is the jumpable one, at the same clearance as the Feastkeeper's
// Offering Slam, so the hop the player learned in Zone 1 answers the final boss
// too. See _partials/LighthouseSweep.js for why the blade is drawn at exactly
// its hit height.
// ============================================================
import { TOWER_ARENA, mulberry32 } from '../../config.js';
import { ArenaBoss } from './ArenaBoss.js';
import { TowerKeeperBody } from './_partials/TowerKeeperBody.js';
import { BeaconCharge } from './_partials/BeaconCharge.js';
import { MemoryStones } from './_partials/MemoryStones.js';
import { LighthouseSweep } from './_partials/LighthouseSweep.js';

// Per-phase arrays are indexed by phase 0/1/2 (PHASE_THRESHOLDS), so every one of
// them must have exactly three entries. These live here, beside the mechanics
// that read them, rather than in config.js where three unrelated boss fights
// would pile into one block.
export const TOWER_KEEPER_TUNING = {
  HP: 300,
  VFX_STYLE: 'zone3',
  HIT_RADIUS: 2.3,
  PHASE_THRESHOLDS: [0.66, 0.33],
  ENRAGE_INVULN: 1,

  // --- attack scheduler ---
  // Every pattern is unlocked from the first frame; phases tighten the gap and
  // shift the MIX. Weights are relative and per-phase — the other two bosses use
  // a flat table, but the Keeper's four patterns want the enrage to move weight
  // off the filler shot and onto charge and sweep, the two that test movement.
  //
  // Why the sweep is weighted 2 and not 1 at phase 0: phase 0 ends at 66% of 300
  // HP, roughly 22s of uninterrupted fire, and at weight 1 a player could
  // plausibly clear it without ever seeing the attack the fight is named for.
  ATTACK_INTERVAL: [[2.2, 3.1], [1.7, 2.5], [1.2, 1.9]],
  ATTACK_WEIGHTS: [
    { shot: 5, charge: 3, stones: 2, sweep: 2 },
    { shot: 5, charge: 3, stones: 3, sweep: 3 },
    { shot: 4, charge: 4, stones: 3, sweep: 4 },
  ],
  OPENING_DELAY: 1.4,        // grace after `begin()` before the first pattern
  FAILED_PATTERN_DELAY: 0.6, // short re-arm when a pattern declines to start

  // --- summons (built, default OFF) ---
  // TowerCombatManager.spawnBossGroup(phase) is fully written and was never
  // called by anything. The path is wired here so the summit CAN take adds, but
  // it ships disabled: Arena 3's ascent already spent its threat budget, and the
  // summit is designed as a duel. Set SUMMON_INTERVAL to per-phase [min, max]
  // pairs (e.g. [[8, 11], [6.5, 9], [5, 7.5]]) to turn the rolling clock on, or
  // SUMMON_ON_ENRAGE to true for one group per phase change instead.
  SUMMON_INTERVAL: null,
  SUMMON_ON_ENRAGE: false,

  // Aimed burst. It is a weighted pattern rather than a clock running underneath
  // the set-pieces, so it comes around far less often than a per-shot timer —
  // BURST is what buys that frequency back without making any single bolt hurt
  // more.
  SHOT: {
    DAMAGE: 10, KNOCKBACK: 3.6, SPEED: 10, LIFE: 4,
    TELEGRAPH: 0.45, BURST: [1, 2, 3], BURST_GAP: 0.24,
  },
  // Beacon Charge. The lane locks when it appears and never re-aims, so SPEED is
  // free to be genuinely fast; TELEGRAPH is the readable dodge window and the
  // MISS_STUN whiff punish is the player's main damage opening.
  CHARGE: {
    TELEGRAPH: 0.9, SPEED: 19, DAMAGE: 24, KNOCKBACK: 6.5,
    HIT_RADIUS: 1.35, HIT_RECOVERY: 0.9, MISS_STUN: [2, 3],
  },
  // Memory Stones. TELEGRAPH tightens per phase, which is the real difficulty
  // dial — COUNT going up mostly reduces where there is left to stand.
  STONES: {
    COUNT: [5, 7, 9], TELEGRAPH: [1.15, 1, 0.85], STAGGER: 0.16,
    FALL_SPEED: 12, DAMAGE: 16, RADIUS: 1.15, POWERUP_CHANCE: 0.5,
  },
  // Lighthouse Sweep. CLEARANCE (0.55) against the hop's ~0.80m peak sets how
  // forgiving the leap is — deliberately identical to the Feastkeeper's slam.
  SWEEP: {
    APPROACH_SPEED: 9, TELEGRAPH: 1.1, DURATION: [3.2, 3.7, 4.2],
    SPEED: [1.25, 1.45, 1.65], ARMS: [1, 1, 2], WIDTH: 0.78,
    CLEARANCE: 0.55, DAMAGE: 12, HIT_COOLDOWN: 0.65,
  },
};

export class TowerKeeper extends ArenaBoss {
  constructor(scene, player, combat, audio, options = {}) {
    const bounds = options.bounds || {
      height: TOWER_ARENA.SUMMIT_HEIGHT,
      combatRadius: 6.8,
    };
    const body = new TowerKeeperBody(scene, bounds);
    super(body, combat, audio, player, TOWER_KEEPER_TUNING);

    this.scene = scene;
    this.body = body;
    this.bounds = bounds;
    this.onEvent = options.onEvent || null;
    this.onPowerUpDrop = options.onPowerUpDrop || null;
    // TowerCombatManager reads these off `spit.source` when a bolt lands.
    this.projectileDamage = this.tuning.SHOT.DAMAGE;
    this.projectileKnockback = this.tuning.SHOT.KNOCKBACK;

    this._rng = mulberry32((options.seed || 1) >>> 0);
    this._disposed = false;

    this._charge = new BeaconCharge(
      scene, combat, player, body, bounds, this.tuning.CHARGE, this._rng,
      (text, tone) => this.onEvent?.(text, tone),
    );
    this._stones = new MemoryStones(
      scene, combat, player, bounds, this.tuning.STONES,
      (position) => this.onPowerUpDrop?.(position),
    );
    this._sweep = new LighthouseSweep(
      scene, combat, player, body, bounds, this.tuning.SWEEP,
    );

    this._pattern = 'idle';    // the mutual-exclusion guard; one attack at a time
    this._lastPattern = null;
    this._patternAge = 0;
    this._attackTimer = this.tuning.OPENING_DELAY;
    this._shotsLeft = 0;
    this._shotGap = 0;
    this._flare = 0;           // enrage pulse; not a pattern, see _act
    this._summonTimer = this._drawSummonDelay();
  }

  begin() {
    if (this.active || this.defeated) return false;
    this.body.show();
    this._pattern = 'idle';
    this._lastPattern = null;
    this._attackTimer = this.tuning.OPENING_DELAY;
    this._summonTimer = this._drawSummonDelay();
    super.begin();
    return true;
  }

  _act(dt, playerPos) {
    // The enrage flare owns the whole boss for its window: patterns were cleared
    // when the phase changed, and the player cannot damage the Keeper through
    // the invuln, so anything still demanding a response would be pressure with
    // no counterplay.
    if (this._flare > 0) { this._tickFlare(dt); return; }

    if (this._pattern === 'idle') this._tickAttackTimer(dt, playerPos);
    else this._advancePattern(dt, playerPos);

    // Updated unconditionally, and read only for `busy` in `_advancePattern`.
    // Committed hazards — a dash mid-flight, stones already falling, a blade
    // still turning — must keep resolving, and driving them from exactly one
    // place is what stops a pattern being stepped twice in a single frame.
    this._charge.update(dt, playerPos);
    this._stones.update(dt, playerPos);
    this._sweep.update(dt, playerPos);

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
    const weights = this.tuning.ATTACK_WEIGHTS[this.phase];
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

    if (name === 'shot') {
      this._shotsLeft = this.tuning.SHOT.BURST[this.phase];
      this._shotGap = 0;
      this.combat.vfx.keeperPulse(this.center(), 'telegraph');
      return;
    }

    if (name === 'charge') {
      // Asked before the callout: a dash with no runway is declined, and
      // announcing an attack that never happens would teach the wrong tell.
      if (!this._charge.start(playerPos)) { this._failPattern(); return; }
      this.combat.vfx.keeperPulse(this.center(), 'telegraph');
      this.combat.hud.popupCallout(this._calloutAnchor(), 'BEACON CHARGE');
      return;
    }

    if (name === 'stones') {
      this.combat.hud.popupCallout(this._calloutAnchor(), 'MEMORY STONES');
      this._stones.start(this.phase, this._rng);
      return;
    }

    // sweep — called out on the WALK, not the blade, so the player reads it
    // across the whole approach plus telegraph rather than only the last second.
    this.combat.vfx.keeperPulse(this.center(), 'telegraph');
    this.combat.hud.popupCallout(this._calloutAnchor(), 'LIGHTHOUSE SWEEP');
    this._sweep.start(this.phase, this._rng);
  }

  // Drive whichever pattern is live and hand control back to the timer the moment
  // it resolves. Returning to 'idle' is what lets the next pattern start.
  _advancePattern(dt, playerPos) {
    this._patternAge += dt;

    if (this._pattern === 'shot') { this._advanceShot(dt, playerPos); return; }
    if (this._pattern === 'charge') {
      if (this._charge.busy) return;
      this._endPattern();
      return;
    }
    if (this._pattern === 'stones') {
      if (this._stones.busy) return;
      this._endPattern();
      return;
    }
    if (this._sweep.busy) return;
    this._endPattern();
  }

  // Telegraph once for the whole burst, then space the bolts by BURST_GAP so a
  // phase-2 triple reads as a burst rather than one stuttering shot.
  _advanceShot(dt, playerPos) {
    if (this._patternAge < this.tuning.SHOT.TELEGRAPH) return;
    this._shotGap -= dt;
    if (this._shotGap > 0) return;
    this._fire(playerPos);
    this._shotsLeft--;
    if (this._shotsLeft <= 0) { this._endPattern(); return; }
    this._shotGap = this.tuning.SHOT.BURST_GAP;
  }

  _endPattern() {
    this._pattern = 'idle';
    this._attackTimer = this._drawAttackDelay();
  }

  // A pattern that declined to start. `_lastPattern` is already set to it, so the
  // reroll is guaranteed to pick something else instead of looping on the refusal.
  _failPattern() {
    this._pattern = 'idle';
    this._attackTimer = this.tuning.FAILED_PATTERN_DELAY;
  }

  _drawAttackDelay() {
    const [min, max] = this.tuning.ATTACK_INTERVAL[this.phase];
    return min + this._rng() * (max - min);
  }

  _fire(playerPos) {
    const direction = this.aimAt(playerPos);
    this.combat.spits.fire(
      this._center,
      direction,
      this.tuning.SHOT.SPEED,
      this.tuning.SHOT.LIFE,
      { source: this },
    );
  }

  // --- summons (independent clock, disabled unless tuned on) -----------------

  _tickSummons(dt) {
    if (!this.tuning.SUMMON_INTERVAL) return;
    this._summonTimer -= dt;
    if (this._summonTimer > 0) return;
    this._summonTimer = this._drawSummonDelay();
    this.combat.spawnBossGroup?.(this.phase);
  }

  _drawSummonDelay() {
    const interval = this.tuning.SUMMON_INTERVAL;
    if (!interval) return Infinity;
    const [min, max] = interval[this.phase];
    return min + this._rng() * (max - min);
  }

  // --- phase / defeat --------------------------------------------------------

  _tickFlare(dt) {
    this._flare = Math.max(0, this._flare - dt);
    const elapsed = this.tuning.ENRAGE_INVULN - this._flare;
    this.body.setFlare(this._flare > 0 ? Math.sin(elapsed * Math.PI * 8) * 0.035 : 0);
  }

  _onPhaseChanged() {
    this._clearPatterns();
    this._flare = this.tuning.ENRAGE_INVULN;
    // Zero, not another interval: the flare IS the pause, and it already blocks
    // the scheduler for its full duration. Re-arming on top of it would stack
    // two dead windows, so the enrage releases straight into an attack.
    this._attackTimer = 0;
    this._summonTimer = this._drawSummonDelay();
    if (this.tuning.SUMMON_ON_ENRAGE) this.combat.spawnBossGroup?.(this.phase);
    this.onEvent?.(`Keeper phase ${this.phase + 1} · the tower destabilizes`, 'warning');
  }

  _onDamaged() {
    // The victory sequence dissolves the defeated body, so leave the killing
    // blow to the pooled hit/death VFX instead of pinning a full-body emissive
    // flash on the Keeper for the whole transition.
    if (this.hp > 0) this.body.flashHit();
  }

  _phaseSurfaceY() { return this.bounds.height + 0.04; }

  _onDefeated() {
    this._clearPatterns();
    this.body.defeated = true;
  }

  _clearPatterns() {
    this._charge.clear();
    this._stones.clear();
    this._sweep.clear();
    this._pattern = 'idle';
    this._lastPattern = null;
    this._shotsLeft = 0;
    this.body.setFlare(0);
  }

  // --- frame / world ---------------------------------------------------------

  update(dt, t, playerPos) {
    // Runs even while inactive: the body also animates through the guardian
    // introduction cinematic, before the fight has begun.
    this.body.update(dt, t, playerPos);
    super.update(dt, playerPos);
  }

  blocksPlayerAt(x, z, radius, supportY) {
    // While the Keeper is moving under its own power it must not body-block, or a
    // player standing on its path — the arena centre included — gets pinned.
    if (!this.active || this._charge.moving || this._sweep.approaching) return false;
    if (Math.abs(supportY - this.bounds.height) > 1.4) return false;
    return Math.hypot(
      x - this.body.group.position.x,
      z - this.body.group.position.z,
    ) < radius + 1.15;
  }

  // The pattern partials own real scene meshes, and KeeperArenaController builds a
  // fresh Keeper on every faint-restart — without this they would pile up.
  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this._charge.dispose();
    this._stones.dispose();
    this._sweep.dispose();
    this.body.dispose();
    super.dispose();
  }
}
