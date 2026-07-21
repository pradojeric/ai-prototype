// ============================================================
// RAIL ARENA CONTROLLER — Zone 2's stationary-boat encounter. It paces manual
// river-threat waves, three staggered answer-lantern volleys, automatic Lumina,
// parallax scenery, ward progress, failure penalties, and victory.
// ============================================================
import * as THREE from 'three';
import { COMBAT, LUMINA, RAIL_ARENA, mulberry32 } from '../../config.js';
import { drawRiddles } from '../../data.js';
import { LanternProjectile } from './LanternProjectile.js';
import { LuminaManager } from './LuminaManager.js';
import { RailScenery } from './RailScenery.js';

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
    // The ward row itself lives on the combat HUD (CombatHud.setWards).

    this.combat = null;
    this.guardian = null;
    this.won = false;
    this.wards = RAIL_ARENA.ROUNDS;
    this._lanterns = [];
    this._riddles = [];
    this._phase = 'idle';
    this._riddleTimer = 0;
    this._waveTimer = 0;
    this._waveIndex = 0;
    this._throwTimer = 0;
    this._throwIndex = 0;
    this._retryTimer = 0;
    this._choices = [];
    this._center = new THREE.Vector3(RAIL_ARENA.CENTER.x, 0, RAIL_ARENA.CENTER.z);
    this._boatTarget = new THREE.Vector3(
      RAIL_ARENA.CENTER.x,
      RAIL_ARENA.BOAT_EYE_BASE + 1.15,
      RAIL_ARENA.CENTER.z,
    );
  }

  begin(combat, guardian) {
    this._clearLanterns();
    if (this.combat && this.combat !== combat) this.combat.setEnemyDefeatedHandler(null);
    this.combat = combat;
    this.guardian = guardian;
    this.won = false;
    this.wards = RAIL_ARENA.ROUNDS;
    this._phase = 'idle';
    this._riddleTimer = 0;
    this._waveTimer = 0;
    this._waveIndex = 0;
    this._attempt++;
    this._rng = mulberry32((this.seed ^ Math.imul(this._attempt, 0x9e3779b1)) >>> 0);
    this._riddles = drawRiddles(RAIL_ARENA.ROUNDS + 2, this._rng);

    const luminaSeed = (this.seed ^ LUMINA.SEED ^ Math.imul(this._attempt, 0x45d9f3b)) >>> 0;
    this.lumina.beginAttempt(combat, luminaSeed);
    this.combat.setEnemyDefeatedHandler(this._handleEnemyDefeated);
    this.combat.startFight(this._center);
    const opening = RAIL_ARENA.WAVES[0];
    this.combat.spawnWave(opening.snipers, opening.boarders);
    this._waveIndex = 1;
    this._syncWardHud();
    this.elBanner.classList.remove('active');
    if (this.elHint) this.elHint.textContent = 'Shoot the correct lantern before it reaches the boat.';
  }

  update(dt, t, playerPos) {
    this.scenery.update(dt, t);
    this._updateLanterns(dt, t);
    this.lumina.update(dt, t, playerPos, !this.player.controls.isLocked);
    if (this.won) return;

    if (this._phase === 'idle') {
      this._riddleTimer += dt;
      this._waveTimer += dt;
      if (this._waveTimer >= RAIL_ARENA.WAVE_INTERVAL) {
        this._waveTimer = 0;
        const wave = RAIL_ARENA.WAVES[this._waveIndex % RAIL_ARENA.WAVES.length];
        this.combat.spawnWave(wave.snipers, wave.boarders);
        this._waveIndex++;
      }
      const due = this.wards === RAIL_ARENA.ROUNDS
        ? RAIL_ARENA.FIRST_RIDDLE : RAIL_ARENA.RIDDLE_CADENCE;
      if (this._riddleTimer >= due) this._startRiddle();
    } else if (this._phase === 'reveal') {
      this._throwTimer -= dt;
      if (this._throwTimer <= 0) this._beginVolley();
    } else if (this._phase === 'throwing') {
      this._throwTimer -= dt;
      if (this._throwIndex < this._choices.length && this._throwTimer <= 0) {
        this._launchLantern(this._choices[this._throwIndex], this._throwIndex);
        this._throwIndex++;
        this._throwTimer += RAIL_ARENA.LANTERN_STAGGER;
      }
    } else if (this._phase === 'retry') {
      this._retryTimer -= dt;
      if (this._retryTimer <= 0) this._beginVolley();
    } else if (this._phase === 'victory-deflect') {
      this._victoryTimer -= dt;
      if (this._victoryTimer <= 0) this._win();
    }

    this._checkLanternShots();
  }

  _startRiddle() {
    const index = RAIL_ARENA.ROUNDS - this.wards;
    this._current = this._riddles[index] || this._riddles[0];
    this._phase = 'reveal';
    this._throwTimer = RAIL_ARENA.PROMPT_DELAY;
    this.combat.setRiddlePressure(true);
    this.elStep.textContent = `The Reveler's Ward ${index + 1} / ${RAIL_ARENA.ROUNDS}`;
    this.elFil.textContent = this._current.prompt;
    this.elEng.textContent = this._current.promptEng || '';
    this.elBanner.classList.add('active');
  }

  _shuffleChoices() {
    this._choices = this._current.choices.slice();
    for (let i = this._choices.length - 1; i > 0; i--) {
      const j = Math.floor(this._rng() * (i + 1));
      [this._choices[i], this._choices[j]] = [this._choices[j], this._choices[i]];
    }
  }

  _beginVolley() {
    this._clearLanterns();
    this._shuffleChoices();
    this._phase = 'throwing';
    this._throwIndex = 0;
    this._throwTimer = 0;
    this.elStep.textContent = `Lantern Volley — ${this.wards} ward${this.wards === 1 ? '' : 's'} remain`;
  }

  _launchLantern(choice, index) {
    const guardianCenter = this.guardian
      ? this.guardian.center().clone() : new THREE.Vector3(0, 4, -28);
    const lane = index - 1;
    const start = guardianCenter.clone();
    start.x += lane * 1.6;
    start.y += 0.35 + Math.abs(lane) * 0.25;
    this._lanterns.push(new LanternProjectile(
      this.scene, choice, start, this._boatTarget, guardianCenter, lane,
    ));
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
    this._syncWardHud();
    this.audio.playLanternDeflect();
    this.combat.setRiddlePressure(false);
    this.elBanner.classList.remove('active');
    this._phase = 'idle';
    this._riddleTimer = 0;
    this._waveTimer = 0;
    if (this.wards <= 0) {
      // Let the final lantern visibly complete its return flight before Game
      // begins the arena-collapse wait, while removing combat pressure now.
      this._phase = 'victory-deflect';
      this._victoryTimer = 0.6;
      this.combat.hud.hideWards();
      this.resetLumina();
      this.combat.stop();
    }
  }

  _missedCorrect() {
    if (this._phase !== 'throwing') return;
    for (const lantern of this._lanterns) lantern.dismiss();
    this.combat.damage(RAIL_ARENA.MISS_DAMAGE);
    this._phase = 'retry';
    this._retryTimer = RAIL_ARENA.RETRY_DELAY;
    this.elStep.textContent = 'The correct light struck the hull — the volley returns';
  }

  _syncWardHud() {
    this.combat?.hud.setWards('The Reveler', this.wards, RAIL_ARENA.ROUNDS);
  }

  _win() {
    this.won = true;
    this._phase = 'won';
    this.elBanner.classList.remove('active');
    this.combat.hud.hideWards();
    this.resetLumina();
    this.combat.stop();
    this.guardian.defeat();
  }

  guardianCenter() {
    if (this.guardian) return this.guardian.center().clone();
    return new THREE.Vector3(RAIL_ARENA.CENTER.x, 0, RAIL_ARENA.CENTER.z);
  }

  resetLumina() { this.lumina.reset(); }

  _clearLanterns() {
    for (const lantern of this._lanterns) lantern.dispose();
    this._lanterns.length = 0;
  }

  dispose() {
    this._clearLanterns();
    if (this.combat) this.combat.setEnemyDefeatedHandler(null);
    this.lumina.dispose();
    this.scenery.dispose();
    this.elBanner.classList.remove('active');
    this.combat?.hud.hideWards();
    this.combat = null;
    this.guardian = null;
  }
}
