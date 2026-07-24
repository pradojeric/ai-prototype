// ============================================================
// RAIL ARENA CONTROLLER — Zone 2's stationary-boat encounter. It owns the
// cumulative riddle clock, randomized river pressure, simultaneous lantern
// volleys, and the handoff to The Reveler's full boss fight.
// ============================================================
import * as THREE from 'three';
import { LUMINA, RAIL_ARENA, mulberry32 } from '../../config.js';
import { drawRiddles } from '../../data.js';
import { LanternProjectile } from './LanternProjectile.js';
import { LuminaManager } from './LuminaManager.js';
import { RailScenery } from './RailScenery.js';
import { RevelerBoss } from './RevelerBoss.js';

export class RailArenaController {
  constructor(scene, audio, player, seed, world) {
    this.scene = scene;
    this.audio = audio;
    this.player = player;
    this.seed = seed;
    this.world = world;
    this._attempt = 0;
    this._rng = mulberry32(seed);
    this.scenery = new RailScenery(scene, player, this._rng);
    this.lumina = new LuminaManager(scene, player, audio, {
      autoCollect: true,
      collectTime: 0.45,
      heal: 25,
      zephyrDuration: 8,
      onZephyr: (active) => {
        if (this.combat) this.combat.setZephyrSlow(active);
      },
    });
    this._handleEnemyDefeated = (_type, position, multiplier) => {
      this.lumina.tryDrop(position, multiplier);
    };

    this.elBanner = document.getElementById('arena-riddle');
    this.elStep = document.getElementById('ar-step');
    this.elFil = document.getElementById('ar-fil');
    this.elEng = document.getElementById('ar-eng');
    this.elHint = document.getElementById('ar-hint');

    this.combat = null;
    this.guardian = null;
    this.boss = null;
    this.won = false;
    this.wards = RAIL_ARENA.ROUNDS;
    this._lanterns = [];
    this._riddles = [];
    this._choices = [];
    this._phase = 'idle';
    this._encounterTime = 0;
    this._spawnTimer = 0;
    this._phaseTimer = 0;
    this._shieldBreakQueuedThisFrame = false;
    this._center = new THREE.Vector3(RAIL_ARENA.CENTER.x, 0, RAIL_ARENA.CENTER.z);
    this._boatTarget = new THREE.Vector3(
      RAIL_ARENA.CENTER.x,
      RAIL_ARENA.BOAT_EYE_BASE + 1.15,
      RAIL_ARENA.CENTER.z,
    );
  }

  begin(combat, guardian) {
    combat.resetAlab();
    this._clearLanterns();
    this._disposeBoss();
    if (this.combat && this.combat !== combat) this.combat.setEnemyDefeatedHandler(null);
    this.combat = combat;
    this.guardian = guardian;
    this.won = false;
    this.wards = RAIL_ARENA.ROUNDS;
    this._phase = 'idle';
    this._encounterTime = 0;
    this._phaseTimer = 0;
    this._attempt++;
    this._rng = mulberry32((this.seed ^ Math.imul(this._attempt, 0x9e3779b1)) >>> 0);
    this._riddles = drawRiddles(RAIL_ARENA.ROUNDS + 2, this._rng);
    this._beginAttempt();

    this.combat.startFight(this._center);
    this.combat.spawnRandomGroup(2, 2);
    this._spawnTimer = this._drawDelay(RAIL_ARENA.SPAWN_INTERVAL);
    this._syncBossHud();
    this.combat.hud.showRiddleTimeline(RAIL_ARENA.ROUNDS);
    this._updateRiddleTimeline();
    this.elBanner.classList.remove('active');
    if (this.elHint) this.elHint.textContent = 'Read all three lights, then shoot the correct answer.';
  }

  // Pre-boss deaths replay the timed trial. Once all riddles have been earned,
  // a death preserves that progress and creates a fresh full-health boss.
  restartAfterFaint(combat, guardian) {
    const resumeBoss = this._phase === 'boss' || this._phase === 'boss-intro';
    if (!resumeBoss) {
      this.begin(combat, guardian);
      return;
    }

    this._clearLanterns();
    this._disposeBoss();
    if (this.combat && this.combat !== combat) this.combat.setEnemyDefeatedHandler(null);
    this.combat = combat;
    this.guardian = guardian;
    this.won = false;
    this.wards = 0;
    this._phase = 'boss';
    this._attempt++;
    this._rng = mulberry32((this.seed ^ Math.imul(this._attempt, 0x9e3779b1)) >>> 0);
    this._beginAttempt();
    this.combat.startFight(this._center);
    this.combat.hud.hideRiddleTimeline();
    this.elBanner.classList.remove('active');
    this.boss.begin();
    this._syncBossHud();
  }

  _beginAttempt() {
    const bossSeed = (this.seed ^ 0x5245564c ^ Math.imul(this._attempt, 0x45d9f3b)) >>> 0;
    this.boss = new RevelerBoss(
      this.guardian, this.combat, this.audio, this.player, mulberry32(bossSeed),
    );
    const luminaSeed = (this.seed ^ LUMINA.SEED ^ Math.imul(this._attempt, 0x45d9f3b)) >>> 0;
    this.lumina.beginAttempt(this.combat, luminaSeed);
    this.combat.setEnemyDefeatedHandler(this._handleEnemyDefeated);
  }

  update(dt, t, playerPos) {
    this.scenery.update(dt, t);
    const paused = !this.player.controls.isLocked;
    this.lumina.update(dt, t, playerPos, paused);
    if (this.won || paused) return;
    this._shieldBreakQueuedThisFrame = false;

    this._updateLanterns(dt, t);
    if (this._phase === 'idle') {
      this._encounterTime += dt;
      if (this._isRiddleDue()) this._startRiddle();
      else this._updateEnemySpawning(dt);
      this._updateRiddleTimeline();
    } else if (this._phase === 'reveal') {
      this._phaseTimer -= dt;
      if (this._phaseTimer <= 0) this._showChoices();
    } else if (this._phase === 'staging') {
      this._phaseTimer -= dt;
      if (this._phaseTimer <= 0) this._beginReading();
    } else if (this._phase === 'reading') {
      this._phaseTimer -= dt;
      if (this._phaseTimer <= 0) this._launchChoices();
    } else if (this._phase === 'retry') {
      this._phaseTimer -= dt;
      if (this._phaseTimer <= 0) this._showChoices();
    } else if (this._phase === 'boss-intro') {
      this._phaseTimer -= dt;
      if (this._phaseTimer <= 0) this._beginBossPhase();
    } else if (this._phase === 'boss') {
      this.boss.update(dt, playerPos);
      this._syncBossHud();
      if (this.boss.defeated) this._win();
    }

    this._checkLanternShots();
    if (this._phase !== 'boss' && this._phase !== 'won') {
      this.boss?.testArmoredHits(this._shieldBreakQueuedThisFrame ? 0 : dt);
    }
  }

  _isRiddleDue() {
    const index = RAIL_ARENA.ROUNDS - this.wards;
    return index < RAIL_ARENA.RIDDLE_TIMES.length
      && this._encounterTime >= RAIL_ARENA.RIDDLE_TIMES[index];
  }

  _updateEnemySpawning(dt) {
    this._spawnTimer -= dt;
    if (this.combat.aliveCount() === 0) {
      this._spawnTimer = Math.min(this._spawnTimer, RAIL_ARENA.EMPTY_SPAWN_DELAY);
    }
    if (this._spawnTimer > 0) return;
    const spawned = this.combat.spawnRandomGroup(1, 3);
    this._spawnTimer = spawned > 0
      ? this._drawDelay(RAIL_ARENA.SPAWN_INTERVAL)
      : RAIL_ARENA.EMPTY_SPAWN_DELAY;
  }

  _startRiddle() {
    const index = RAIL_ARENA.ROUNDS - this.wards;
    this._current = this._riddles[index] || this._riddles[0];
    this._phase = 'reveal';
    this._phaseTimer = RAIL_ARENA.PROMPT_DELAY;
    this.combat.cancelPendingSpawns();
    this.combat.setRiddlePressure(true);
    this.elStep.textContent = `The Reveler's Ward ${index + 1} / ${RAIL_ARENA.ROUNDS}`;
    this.elFil.textContent = this._current.prompt;
    this.elEng.textContent = this._current.promptEng || '';
    this.elBanner.classList.add('active');
    this._updateRiddleTimeline(true);
  }

  _shuffleChoices() {
    this._choices = this._current.choices.slice();
    for (let i = this._choices.length - 1; i > 0; i--) {
      const j = Math.floor(this._rng() * (i + 1));
      [this._choices[i], this._choices[j]] = [this._choices[j], this._choices[i]];
    }
  }

  _showChoices() {
    this._clearLanterns();
    this._shuffleChoices();
    const guardianCenter = this.guardian
      ? this.guardian.center().clone() : new THREE.Vector3(0, 4, -28);
    const lineupCenter = new THREE.Vector3().lerpVectors(
      guardianCenter, this._boatTarget, 0.5,
    );

    for (let i = 0; i < this._choices.length; i++) {
      const lane = i - 1;
      const hover = lineupCenter.clone();
      hover.x = RAIL_ARENA.CENTER.x + lane * RAIL_ARENA.LANTERN_LINEUP_GAP;
      this._lanterns.push(new LanternProjectile(
        this.scene,
        this._choices[i],
        guardianCenter,
        hover,
        this._boatTarget,
        guardianCenter,
        lane,
      ));
    }
    this.audio.playLanternThrow();
    this._phase = 'staging';
    this._phaseTimer = RAIL_ARENA.LANTERN_STAGE_TRAVEL;
    this.elStep.textContent = 'The three lights move into position';
  }

  _beginReading() {
    for (const lantern of this._lanterns) lantern.holdForReading();
    this._phase = 'reading';
    this._phaseTimer = RAIL_ARENA.CHOICE_READ_DELAY;
    this.elStep.textContent =
      `Read the three lights — firing unlocks in ${RAIL_ARENA.CHOICE_READ_DELAY} seconds`;
  }

  _launchChoices() {
    for (const lantern of this._lanterns) lantern.launch();
    this._phase = 'throwing';
    this.elStep.textContent = `Lantern Volley — ${this.wards} ward${this.wards === 1 ? '' : 's'} remain`;
    this.audio.playLanternThrow();
  }

  _updateLanterns(dt, t) {
    for (let i = this._lanterns.length - 1; i >= 0; i--) {
      const lantern = this._lanterns[i];
      lantern.update(dt, t);
      if (lantern.consumeImpact()) {
        if (lantern.correct) this._missedCorrect();
        else lantern.dismiss();
      }
      if (!lantern.dead) continue;
      lantern.dispose();
      this._lanterns.splice(i, 1);
    }
  }

  _checkLanternShots() {
    if (!this.combat?.bolts || this._phase !== 'throwing') return;
    for (const bolt of this.combat.bolts.slots) {
      if (!bolt.active) continue;
      for (const lantern of this._lanterns) {
        if (!lantern.hitTest(bolt.mesh.position)) continue;
        this.combat.bolts.deactivate(bolt);
        if (lantern.correct) this._correctLantern(lantern);
        else this._wrongLantern(lantern);
        break;
      }
    }
  }

  _wrongLantern(lantern) {
    lantern.dismiss();
    this.combat.damage(RAIL_ARENA.WRONG_DAMAGE);
  }

  _correctLantern(lantern) {
    lantern.deflect();
    for (const other of this._lanterns) if (other !== lantern) other.dismiss();
    this.wards = Math.max(0, this.wards - 1);
    // Match the crack to the reflected lantern's 0.55-second return flight.
    this.boss?.breakArmor(this.wards, 0.55);
    this._shieldBreakQueuedThisFrame = true;
    this.audio.playLanternDeflect();
    this.combat.setRiddlePressure(false);
    this.elBanner.classList.remove('active');
    this._syncBossHud();

    if (this.wards <= 0) {
      this._phase = 'boss-intro';
      // Clear pressure now, then let the 0.55-second return and 0.78-second
      // shield shatter finish before the Reveler starts attacking.
      this.combat.clearEnemies();
      this.combat.spits.clear();
      this._phaseTimer = 1.4;
      this._updateRiddleTimeline(true);
      return;
    }

    this._phase = 'idle';
    this._spawnTimer = RAIL_ARENA.POST_RIDDLE_SPAWN_DELAY;
    this._updateRiddleTimeline();
  }

  _missedCorrect() {
    if (this._phase !== 'throwing') return;
    for (const lantern of this._lanterns) lantern.dismiss();
    this.combat.damage(RAIL_ARENA.MISS_DAMAGE);
    this._phase = 'retry';
    this._phaseTimer = RAIL_ARENA.RETRY_DELAY;
    this.elStep.textContent = 'The correct light struck the hull — reshuffling in 3 seconds';
  }

  _beginBossPhase() {
    this._clearLanterns();
    this.combat.setRiddlePressure(false);
    this.combat.clearEnemies();
    this.combat.spits.clear();
    this.combat.bolts.clear();
    this._phase = 'boss';
    this.combat.hud.hideRiddleTimeline();
    this.boss.begin();
    this._syncBossHud();
  }

  _updateRiddleTimeline(active = false) {
    const index = Math.min(
      RAIL_ARENA.ROUNDS - 1,
      Math.max(0, RAIL_ARENA.ROUNDS - this.wards),
    );
    const start = index === 0 ? 0 : RAIL_ARENA.RIDDLE_TIMES[index - 1];
    const deadline = RAIL_ARENA.RIDDLE_TIMES[index];
    const duration = Math.max(0.001, deadline - start);
    const elapsed = Math.max(0, this._encounterTime - start);
    this.combat.hud.setRiddleTimeline(
      index,
      Math.min(1, elapsed / duration),
      Math.max(0, deadline - this._encounterTime),
      active || this._phase !== 'idle',
    );
  }

  _syncBossHud() {
    if (!this.combat) return;
    const engaged = this._phase === 'boss' && this.boss;
    this.combat.hud.setBoss({
      name: 'The Reveler',
      hp: engaged ? this.boss.hp : null,
      maxHp: engaged ? this.boss.maxHp : null,
      armor: this.wards,
      armorTotal: RAIL_ARENA.ROUNDS,
    });
  }

  _win() {
    this.won = true;
    this._phase = 'won';
    this.elBanner.classList.remove('active');
    this.combat.hud.hideBoss();
    this.resetLumina();
    this.combat.stop({ preserveVfx: true });
    this.guardian.defeat();
  }

  _drawDelay([min, max]) { return min + this._rng() * (max - min); }

  guardianCenter() {
    if (this.guardian) return this.guardian.center().clone();
    return new THREE.Vector3(RAIL_ARENA.CENTER.x, 0, RAIL_ARENA.CENTER.z);
  }

  resetLumina() { this.lumina.reset(); }

  _clearLanterns() {
    for (const lantern of this._lanterns) lantern.dispose();
    this._lanterns.length = 0;
  }

  _disposeBoss() {
    if (this.boss) this.boss.dispose();
    this.boss = null;
  }

  dispose() {
    this._clearLanterns();
    this._disposeBoss();
    if (this.combat) this.combat.setEnemyDefeatedHandler(null);
    this.lumina.dispose();
    this.scenery.dispose();
    this.elBanner.classList.remove('active');
    this.combat?.hud.hideBoss();
    this.combat = null;
    this.guardian = null;
  }
}
