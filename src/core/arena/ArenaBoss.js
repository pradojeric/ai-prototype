// ============================================================
// ARENA BOSS (Strings v2.0) — the shared shell for a Memory Arena's final fight,
// the combat-side sibling of Guardian.js's per-zone body builders. Every zone's
// boss is the same *contract* — a health pool the player whittles down, armor
// that only breaks after the bugtong, staged enrages, and a chest the light-bolt
// has to find — but a different *fight*. That split lives here: this class owns
// the contract, subclasses own the mechanics.
//
// A boss does NOT own a body. The arena's `Guardian` instance is already in the
// scene with its zone's mesh, fade materials, and idle animation; a boss drives
// that and adds the fight on top. Every projectile, summon, and VFX call routes
// through the supplied CombatManager, so player damage, thread-tear spawn
// telegraphs, and pooling all work for free.
//
// To add a zone's boss: subclass this, pass your own tuning to `super()`, and
// implement `_act()`. Override `_onPhaseChanged()` for enrage behaviour and
// `_onDefeated()` for a bespoke death beat. Tunables belong in the subclass file
// beside the mechanics that read them — deliberately NOT in config.js, where a
// shared block would drift into a dumping ground for three unrelated fights.
// ============================================================
import * as THREE from 'three';
import { COMBAT } from '../../config.js';

// Contract-level defaults. A subclass spreads its own numbers over these, so it
// only has to state what actually differs from the baseline boss.
export const BOSS_DEFAULTS = {
  HP: 20,                          // bolts-to-kill is HP / COMBAT.BOLT.DAMAGE
  HIT_RADIUS: 2.3,                 // chest sphere the player must land bolts in
  PHASE_THRESHOLDS: [0.66, 0.33],  // hp fractions that deepen the phase
  ENRAGE_INVULN: 1.2,              // armor-flare window while a phase change resolves
};

export class ArenaBoss {
  /**
   * @param {object} guardian   the arena's live Guardian (supplies the body)
   * @param {object} combat     the arena's CombatManager
   * @param {object} audio      AudioManager
   * @param {object} player     PlayerController (read for the pointer-lock guard)
   * @param {object} [tuning]   subclass numbers, spread over BOSS_DEFAULTS
   */
  constructor(guardian, combat, audio, player, tuning = {}) {
    this.guardian = guardian;
    this.combat = combat;
    this.audio = audio;
    this.player = player;
    /** @type {Record<string, any>} — open by design; each boss adds its own keys */
    this.tuning = { ...BOSS_DEFAULTS, ...tuning };

    this.maxHp = this.tuning.HP;
    this.hp = this.maxHp;
    this.active = false;
    this.defeated = false;
    this.phase = 0;          // deepened at each PHASE_THRESHOLDS crossing
    this._invuln = 0;

    // Scratch — a boss runs every frame alongside the whole combat sim.
    this._center = new THREE.Vector3();
    this._dir = new THREE.Vector3();
  }

  // Open the fight. The guardian is already visible; this only turns it hostile.
  begin() {
    if (this.active || this.defeated) return;
    this.active = true;
    this.combat.vfx.keeperPulse(this.center(), 'telegraph');
    this.audio?.playTeleport?.();
  }

  // Chest height of the live guardian, copied out of its shared scratch vector.
  center() { return this._center.copy(this.guardian.center()); }

  // Aim vector from the boss's chest toward `target`, normalized. Scratch-backed,
  // so a subclass's fire routine allocates nothing per shot.
  /** @param {THREE.Vector3} target */
  aimAt(target) {
    return this._dir.copy(target).sub(this.center()).normalize();
  }

  // Armored feedback: the bolt is spent, the armor flares, nothing else happens.
  // Reads as "that did not work", not as a missed shot.
  pingArmored(position) {
    this.combat.vfx.keeperPulse(position || this.center(), 'telegraph');
    this.audio?.playHit?.();
  }

  // Pre-boss hit test. The guardian is unkillable until its bugtong armor is
  // gone, so bolts land as flares — the controller calls this every frame before
  // the boss phase so shooting the guardian early always answers with something.
  testArmoredHits() {
    if (this.active || this.defeated) return;
    const shot = this._findBoltOnChest();
    if (!shot) return;
    this.combat.bolts.deactivate(shot);
    this.pingArmored(this._center);
  }

  // First live player bolt overlapping the chest sphere, or null.
  _findBoltOnChest() {
    const rr = this.tuning.HIT_RADIUS ** 2;
    this.center();
    for (const shot of this.combat.bolts.slots) {
      if (!shot.active) continue;
      if (shot.mesh.position.distanceToSquared(this._center) >= rr) continue;
      return shot;
    }
    return null;
  }

  // Player bolts vs the chest. Bolts are consumed during the enrage flare too —
  // with a distinct pulse — so the window reads as armor, not as dead input.
  _testPlayerBolts() {
    const shot = this._findBoltOnChest();
    if (!shot) return;
    this.combat.bolts.deactivate(shot);
    if (this._invuln > 0) { this.pingArmored(this._center); return; }
    this.damage(COMBAT.BOLT.DAMAGE);
  }

  damage(amount) {
    if (this.defeated || amount <= 0) return;
    this.hp = Math.max(0, this.hp - amount);
    this.audio?.playHit?.();
    this.combat.hud.hitMarker();
    this.combat.vfx.keeperPulse(this.center(), 'hit');
    if (this.hp <= 0) this._defeat();
    else this._checkPhase();
  }

  // Deepen the phase when HP crosses a threshold: flare invulnerable for a beat,
  // then hand off to the subclass for whatever "enraged" means in its fight.
  _checkPhase() {
    const fraction = this.hp / this.maxHp;
    const thresholds = this.tuning.PHASE_THRESHOLDS;
    let next = 0;
    for (let i = 0; i < thresholds.length; i++) if (fraction <= thresholds[i]) next = i + 1;
    if (next <= this.phase) return;

    this.phase = next;
    this._invuln = this.tuning.ENRAGE_INVULN;
    this.combat.vfx.keeperPulse(this.center(), 'defeat');
    this.audio?.playTeleport?.();
    this._onPhaseChanged(this.phase);
  }

  _defeat() {
    this.active = false;
    this.defeated = true;
    this.audio?.playEnemyDeath?.();
    this.combat.vfx.keeperPulse(this.center(), 'defeat');
    this._onDefeated();
  }

  /**
   * @param {number} dt
   * @param {THREE.Vector3} playerPos
   */
  update(dt, playerPos) {
    if (!this.active) return;
    // ESC safety: the boss stays frozen while the pointer is unlocked, matching
    // CombatManager's own pause guard so a pause menu can't get the player hit.
    if (!this.player.controls.isLocked) return;

    if (this._invuln > 0) this._invuln = Math.max(0, this._invuln - dt);
    this._act(dt, playerPos);
    this._testPlayerBolts();
  }

  // --- subclass hooks --------------------------------------------------------

  // The fight itself: attacks, summons, movement. Runs only while active and
  // unpaused. A boss with no `_act` simply stands there and takes hits.
  /**
   * @param {number} _dt
   * @param {THREE.Vector3} _playerPos
   */
  _act(_dt, _playerPos) {}

  // Called once per deepened phase, after the invuln flare is armed.
  /** @param {number} _phase */
  _onPhaseChanged(_phase) {}

  // Called once when hp hits zero, after the death pulse. The controller drives
  // the actual guardian poof and arena collapse.
  _onDefeated() {}

  // The guardian's mesh belongs to Game, so there is nothing to tear down here;
  // the method exists so controllers can dispose every boss uniformly.
  dispose() {
    this.active = false;
    this.guardian = null;
    this.combat = null;
  }
}
