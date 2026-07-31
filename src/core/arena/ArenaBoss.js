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
import { GuardianShieldVfx } from './GuardianShieldVfx.js';
import { immutableBossTuning } from './_partials/BossTuning.js';

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
   * @param {any} guardian   the arena's live Guardian (supplies the body)
   * @param {any} combat     the arena's CombatManager
   * @param {any} audio      AudioManager
   * @param {any} player     PlayerController (read for the pointer-lock guard)
   * @param {object} [tuning]   subclass numbers, spread over BOSS_DEFAULTS
   */
  constructor(guardian, combat, audio, player, tuning = {}, options = {}) {
    this.guardian = guardian;
    this.combat = combat;
    this.audio = audio;
    this.player = player;
    /** @type {Record<string, any>} — open by design; each boss adds its own keys */
    this.tuning = immutableBossTuning(BOSS_DEFAULTS, tuning);
    this.externalHitResolution = !!options.externalHitResolution;
    // Survival's tenth-wave Guardians fight alone — a boss that also summons is a
    // wave stacked on a wave. An option rather than a tuning key because two of
    // the Reveler's summon calls are hardcoded statements, not interval clocks,
    // so a tuning value could not reach them. Campaign fights omit it and keep
    // their adds.
    this.allowSummons = options.allowSummons !== false;

    this.maxHp = this.tuning.HP;
    this.hp = this.maxHp;
    this.active = false;
    this.defeated = false;
    this.phase = 0;          // deepened at each PHASE_THRESHOLDS crossing
    this._invuln = 0;
    const shieldStyle = guardian?.variant === 'zone2'
      ? 'zone2'
      : guardian?.variant === 'zone1' ? 'zone1' : null;
    this._vfxStyle = this.tuning.VFX_STYLE || shieldStyle;
    this.shieldVfx = shieldStyle && guardian && combat
      ? new GuardianShieldVfx(guardian, combat, shieldStyle)
      : null;
    this._armorBreakAudioDelay = -1;
    this._armorBreakAudioFinal = false;

    // Scratch — a boss runs every frame alongside the whole combat sim.
    this._center = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._playerAttackTarget = {
      kind: 'boss',
      center: this._center,
      radius: this.tuning.HIT_RADIUS,
    };
    this._playerAttackTargets = [this._playerAttackTarget];
  }

  // Open the fight. The guardian is already visible; this only turns it hostile.
  begin() {
    if (this.active || this.defeated) return;
    this.active = true;
    this.shieldVfx?.openForCombat();
    if (this._armorBreakAudioDelay >= 0 && this._armorBreakAudioFinal) {
      this._armorBreakAudioDelay = -1;
      this.audio?.playArmorBreak?.(true);
    }
    this.combat.vfx.keeperPulse(this.center(), 'telegraph');
    this.audio?.playTeleport?.();
  }

  // Chest height of the live guardian, copied out of its shared scratch vector.
  center() { return this._center.copy(this.guardian.center()); }

  // Stable target records let Survival resolve both projectile piercing and
  // hitscan beams without allocating on the per-frame combat path.
  // Rebuilt rather than truncated to length 1: a subclass composes its pattern
  // targets into the returned list, so truncating would leave whatever it put in
  // slot 0 last frame sitting where the boss record belongs — and the boss would
  // become permanently unhittable through this path.
  getPlayerAttackTargets() {
    this.center();
    this._playerAttackTargets.length = 0;
    this._playerAttackTargets.push(this._playerAttackTarget);
    return this._playerAttackTargets;
  }

  // Aim vector from the boss's chest toward `target`, normalized. Scratch-backed,
  // so a subclass's fire routine allocates nothing per shot.
  /** @param {THREE.Vector3} target */
  aimAt(target) {
    return this._dir.copy(target).sub(this.center()).normalize();
  }

  // The single question every damage path asks before applying a number: is the
  // boss currently untouchable? The base answer is the enrage flare; a subclass
  // widens it (Arena 2 shields the whole Overload Channel) by overriding this,
  // so no damage route can be added that quietly bypasses the shield.
  get shielded() { return this._invuln > 0; }

  // Armored feedback: the bolt is spent, the armor flares, nothing else happens.
  // Reads as "that did not work", not as a missed shot.
  pingArmored(position) {
    const impact = position || this.center();
    if (this.shieldVfx) this.shieldVfx.impact(impact);
    else this.combat.vfx.keeperPulse(impact, 'telegraph');
    this.combat.hud.popupBlocked(impact);
    this.audio?.playHit?.();
  }

  // Riddle controllers own the armor count, while the shared boss owns its
  // world-space presentation. Arena 2 delays this call so the reflected answer
  // reaches the guardian before the matching crack appears.
  breakArmor(remaining, delay = 0) {
    this.shieldVfx?.breakLayer(remaining, delay);
    if (delay > 0) {
      this._armorBreakAudioDelay = delay;
      this._armorBreakAudioFinal = remaining <= 0;
    } else {
      this.audio?.playArmorBreak?.(remaining <= 0);
      this._announceArmorBreak(remaining <= 0);
    }
  }

  // Armor callouts ride the same clock as the crack and its sound, so the text
  // never arrives before the shell visibly gives way.
  _announceArmorBreak(final) {
    this.combat.hud.popupCallout(
      this._calloutAnchor(),
      final ? 'SHIELD SHATTERED' : 'ARMOR BROKEN',
    );
  }

  // Callouts sit above the chest so they clear the damage numbers landing on it.
  _calloutAnchor() {
    const anchor = (this._callout ||= new THREE.Vector3());
    anchor.copy(this.guardian.center());
    anchor.y += 1.5;
    return anchor;
  }

  _updateVfx(dt) {
    this.shieldVfx?.update(dt);
    if (this._armorBreakAudioDelay < 0) return;
    this._armorBreakAudioDelay -= dt;
    if (this._armorBreakAudioDelay > 0) return;
    this._armorBreakAudioDelay = -1;
    this.audio?.playArmorBreak?.(this._armorBreakAudioFinal);
    this._announceArmorBreak(this._armorBreakAudioFinal);
  }

  // Pre-boss hit test. The guardian is unkillable until its bugtong armor is
  // gone, so bolts land as flares — the controller calls this every frame before
  // the boss phase so shooting the guardian early always answers with something.
  testArmoredHits(dt = 0) {
    if (this.active || this.defeated) return;
    if (!this.player.controls.isLocked) return;
    this._updateVfx(dt);
    const shot = this._findBoltOnShield();
    if (!shot) return;
    this.combat.bolts.deactivate(shot);
    this.pingArmored(shot.mesh.position);
  }

  // The visible ellipsoid is also the protected hit volume. Falling back to
  // the chest keeps the shared contract safe if a future guardian has no shield.
  _findBoltOnShield() {
    if (!this.shieldVfx) return this._findBoltOnChest();
    for (const shot of this.combat.bolts.slots) {
      if (!shot.active) continue;
      if (this.shieldVfx.hitTest(shot.mesh.position, COMBAT.BOLT.RADIUS)) return shot;
    }
    return null;
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
    this.receivePlayerAttack({
      kind: 'projectile',
      damage: this.combat.boltDamage,
      position: shot.mesh.position,
      creditKillBonus: false,
    });
  }

  // Survival resolves projectile piercing and hitscan beams centrally, then
  // hands the same weapon-neutral record to every Guardian. Campaign bosses keep
  // `_testPlayerBolts()` above unless explicitly constructed with the external
  // option, so their established bolt-scanning path is untouched.
  receivePlayerAttack({
    damage = 0,
    position = null,
    creditKillBonus = true,
  } = {}) {
    if (!this.active || this.defeated || damage <= 0) return { hit: false, defeated: false };
    const impact = position || this.center();
    if (this.shielded) {
      this.pingArmored(impact);
      return { hit: true, blocked: true, defeated: false };
    }
    const applied = this.damage(damage, impact);
    this.combat.registerPlayerBoltHit(creditKillBonus && this.defeated);
    return { hit: true, blocked: false, applied, defeated: this.defeated };
  }

  damage(amount, position = null) {
    if (this.defeated || amount <= 0) return 0;
    const applied = Math.min(this.hp, amount);   // never print overkill
    this.hp = Math.max(0, this.hp - amount);
    this.audio?.playHit?.();
    this.combat.hud.hitMarker();
    const impact = position || this.center();
    this.combat.hud.popupDamage(impact, applied);
    if (this.shieldVfx) this.shieldVfx.hit(impact);
    else if (this._vfxStyle) this.combat.vfx.bossHit(impact, this._vfxStyle);
    else this.combat.vfx.keeperPulse(impact, 'hit');
    this._onDamaged(impact);
    if (this.hp <= 0) this._defeat();
    else this._checkPhase();
    return applied;
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
    this.combat.hud.popupCallout(this._calloutAnchor(), 'ENRAGED');
    if (this.shieldVfx) {
      this.shieldVfx.phaseShift(this.phase);
      if (this.audio?.playBossPhase) this.audio.playBossPhase(this.phase);
      else this.audio?.playTeleport?.();
    } else if (this._vfxStyle) {
      this.combat.vfx.bossPhase(
        this.center(),
        this._vfxStyle,
        this.phase,
        this._phaseSurfaceY(),
      );
      if (this.audio?.playBossPhase) this.audio.playBossPhase(this.phase);
      else this.audio?.playTeleport?.();
    } else {
      this.combat.vfx.keeperPulse(this.center(), 'defeat');
      this.audio?.playTeleport?.();
    }
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

    this._updateVfx(dt);
    if (this._invuln > 0) this._invuln = Math.max(0, this._invuln - dt);
    this._act(dt, playerPos);
    if (!this.externalHitResolution) this._testPlayerBolts();
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

  // Optional body-side reaction after shared hit sparks have been emitted.
  /** @param {THREE.Vector3} _position */
  _onDamaged(_position) {}

  // Optional arena surface for horizontal phase shockwaves.
  _phaseSurfaceY() { return undefined; }

  // Called once when hp hits zero, after the death pulse. The controller drives
  // the actual guardian poof and arena collapse.
  _onDefeated() {}

  // The guardian's mesh belongs to Game, so there is nothing to tear down here;
  // the method exists so controllers can dispose every boss uniformly.
  dispose() {
    this.active = false;
    this.shieldVfx?.dispose();
    this.shieldVfx = null;
    this.guardian = null;
    this.combat = null;
  }
}
