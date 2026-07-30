// ============================================================
// SURVIVAL BOSS DIRECTOR — remixes authored Guardians without campaign drift.
// ============================================================
// Every boss is built with `allowSummons: false`: a Survival boss wave is a duel.
// The campaign fights are balanced around their adds and omit the option.
import { CONFIG } from '../../config.js';
import { Guardian } from '../Guardian.js';
import {
  FeastkeeperBoss,
  FEASTKEEPER_TUNING,
} from '../arena/FeastkeeperBoss.js';
import {
  RevelerBoss,
  REVELER_TUNING,
} from '../arena/RevelerBoss.js';
import {
  TowerKeeper,
  TOWER_KEEPER_TUNING,
} from '../arena/TowerKeeper.js';
import { createSurvivalBossOverride } from './SurvivalBossTuning.js';

const GUARDIAN_VARIANTS = Object.freeze({
  feastkeeper: 'zone1',
  reveler: 'zone2',
});

export class SurvivalBossDirector {
  constructor({
    scene,
    world,
    player,
    combat,
    audio,
    rng = Math.random,
    seed = 1,
  }) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.combat = combat;
    this.audio = audio;
    this.rng = rng;
    this.seed = seed;
    this.boss = null;
    this.guardian = null;
    this.bossId = null;
    this.survivalTuning = null;
    this._defeatEvent = null;
  }

  begin(bossId, survivalTuning) {
    this.disposeBoss();
    this.bossId = bossId;
    this.survivalTuning = survivalTuning;
    this.world.setSurvivalBossTier?.(survivalTuning.bossIndex + 1);

    if (bossId === 'keeper') {
      const tuning = createSurvivalBossOverride(TOWER_KEEPER_TUNING, survivalTuning);
      this.boss = new TowerKeeper(this.scene, this.player, this.combat, this.audio, {
        bounds: {
          height: CONFIG.WATER_LEVEL,
          combatRadius: this.world.survivalBounds?.combatRadius || 29.5,
        },
        externalHitResolution: true,
        allowSummons: false,
        seed: this.seed + survivalTuning.bossIndex,
        tuning,
      });
    } else {
      this.guardian = new Guardian(
        this.scene,
        this.world,
        GUARDIAN_VARIANTS[bossId],
        { beacon: false, halo: true },
      );
      const tuning = createSurvivalBossOverride(
        bossId === 'reveler' ? REVELER_TUNING : FEASTKEEPER_TUNING,
        survivalTuning,
      );
      if (bossId === 'reveler') {
        this.boss = new RevelerBoss(
          this.guardian,
          this.combat,
          this.audio,
          this.player,
          this.rng,
          {
            externalHitResolution: true,
            livePlayerTarget: true,
            allowSummons: false,
            tuning,
          },
        );
      } else {
        this.boss = new FeastkeeperBoss(
          this.guardian,
          this.combat,
          this.audio,
          this.player,
          {
            externalHitResolution: true,
            rng: this.rng,
            allowSummons: false,
            tuning,
          },
        );
      }
    }

    this._defeatEvent = null;
    this.combat.setBoss(this.boss);
    this.boss.begin();
    return this.boss;
  }

  update(dt, t, playerPosition) {
    this.guardian?.update(dt, t, playerPosition);
    if (!this.boss) return;
    if (this.bossId === 'keeper') this.boss.update(dt, t, playerPosition);
    else this.boss.update(dt, playerPosition);
    if (!this.boss.defeated || this._defeatEvent) return;

    const position = this.guardian
      ? this.guardian.defeat()
      : this.boss.center().clone();
    this._defeatEvent = Object.freeze({
      bossId: this.bossId,
      tuning: this.survivalTuning,
      position,
    });
  }

  consumeDefeated() {
    const event = this._defeatEvent;
    this._defeatEvent = null;
    return event;
  }

  disposeBoss() {
    this.combat.clearBoss();
    this.boss?.dispose();
    this.guardian?.dispose();
    this.boss = null;
    this.guardian = null;
    this.bossId = null;
    this.survivalTuning = null;
    this._defeatEvent = null;
  }

  dispose() {
    this.disposeBoss();
  }
}

