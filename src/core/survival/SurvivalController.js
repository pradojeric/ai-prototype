// ============================================================
// SURVIVAL CONTROLLER — endless wave, draft, boss, and run-state authority.
// ============================================================
import {
  awardSurvivalBossReroll,
  buildSurvivalWaveRecipe,
  createSurvivalRng,
  describeSurvivalMilestone,
  isSurvivalDraftWave,
  getSurvivalBossIndex,
  getSurvivalBossTuning,
  isSurvivalBossWave,
  rollSurvivalEliteSlots,
  selectNextSurvivalBoss,
  spendSurvivalReroll,
  SURVIVAL_BOSS_IDS,
} from './SurvivalRules.js';
import {
  applySurvivalUpgrade,
  createSurvivalUpgradeState,
  draftSurvivalUpgrades,
} from './SurvivalUpgrades.js';
import { SurvivalRunStats } from './SurvivalRunStats.js';
import { SurvivalCombatManager } from './SurvivalCombatManager.js';
import { SurvivalBossDirector } from './SurvivalBossDirector.js';

const BOSS_STINGER_SECONDS = 1.5;
const WAVE_GAP_SECONDS = 1.15;
const NOOP = () => { };

export class SurvivalController {
  constructor({
    scene,
    world,
    player,
    camera,
    viewmodel,
    audio,
    seed = 1,
    debugBossId = null,
    onHud = NOOP,
    onUpgradeDraft = NOOP,
    onUpgradeClosed = NOOP,
    onBossStinger = NOOP,
    onDefeat = NOOP,
  }) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.camera = camera;
    this.viewmodel = viewmodel;
    this.audio = audio;
    this.seed = Number(seed) >>> 0;
    this.rng = createSurvivalRng(this.seed);
    this.debugBossId = SURVIVAL_BOSS_IDS.includes(debugBossId)
      ? debugBossId
      : null;

    this.onHud = onHud;
    this.onUpgradeDraft = onUpgradeDraft;
    this.onUpgradeClosed = onUpgradeClosed;
    this.onBossStinger = onBossStinger;
    this.onDefeat = onDefeat;

    this.wave = 1;
    this.state = 'idle';
    this.build = createSurvivalUpgradeState();
    this.rerolls = 0;
    this.previousBossId = null;
    this.currentDraft = [];
    this._gapTimer = 0;
    this._bossStingerTimer = 0;
    this._pendingBoss = null;
    this._disposed = false;

    this.stats = new SurvivalRunStats();
    this.combat = new SurvivalCombatManager(
      scene,
      world,
      player,
      camera,
      viewmodel,
      audio,
      {
        rng: this.rng,
        onThreatDefeated: () => this.stats.recordKill(),
        onPlayerDefeated: () => this._handleDefeat(),
      },
    );
    this.bossDirector = new SurvivalBossDirector({
      scene,
      world,
      player,
      combat: this.combat,
      audio,
      rng: this.rng,
      seed: this.seed,
    });
  }

  get active() {
    return !this._disposed && this.state !== 'idle' && this.state !== 'defeat';
  }

  get awaitingUpgrade() { return this.state === 'upgrade'; }

  get acceptsCombatInput() {
    return this.state === 'wave' || this.state === 'boss';
  }

  start() {
    if (this._disposed || this.state !== 'idle') return false;
    this.player.controls.enabled = true;
    this.wave = 1;
    this.build = createSurvivalUpgradeState();
    this.rerolls = 99;
    this.previousBossId = null;
    this.currentDraft = [];
    this.stats.reset();
    this.stats.setActive(true);
    this.combat.startRun(this.build, this.seed);
    this._beginCurrentWave();
    this._emitHud();
    return true;
  }

  update(dt, t, playerPosition) {
    if (this._disposed || this.state === 'idle' || this.state === 'defeat' ||
      this.state === 'upgrade') return;

    if (this.state === 'bossStinger') {
      this.player.clearDashInput({ stop: true });
      this._bossStingerTimer -= dt;
      if (this._bossStingerTimer <= 0) this._beginBoss();
      this._emitHud();
      return;
    }

    if (this.state === 'gap') {
      this.combat.update(dt, t, playerPosition);
      if (this.state === 'defeat') return;
      this._gapTimer -= dt;
      if (this._gapTimer <= 0) this._beginCurrentWave();
      this._emitHud();
      return;
    }

    this.stats.update(dt);
    this.combat.update(dt, t, playerPosition);
    if (this.state === 'defeat') return;

    if (this.state === 'boss') {
      this.bossDirector.update(dt, t, playerPosition);
      if (this.combat.hp <= 0) {
        this._handleDefeat();
        return;
      }
      const defeated = this.bossDirector.consumeDefeated();
      if (defeated) this._completeBossWave();
    } else if (this.state === 'wave' &&
      this.combat.aliveCount() === 0 &&
      this.combat.volatileHazardCount === 0) {
      this._completeNormalWave();
    }
    this._emitHud();
  }

  selectUpgrade(cardOrId) {
    if (this.state !== 'upgrade') return false;
    const cardId = typeof cardOrId === 'string' ? cardOrId : cardOrId?.id;
    if (!this.currentDraft.some((card) => card.id === cardId)) return false;

    this.build = applySurvivalUpgrade(this.build, cardId);
    this.combat.setBuild(this.build);
    this.audio?.playSurvivalUpgrade?.();
    this.currentDraft = [];
    this.onUpgradeClosed();
    this.stats.setActive(true);
    this._scheduleNextWave();
    return true;
  }

  reroll(previousCardIds = []) {
    if (this.state !== 'upgrade' || this.rerolls <= 0) return false;
    const previous = previousCardIds.length
      ? previousCardIds
      : this.currentDraft.map((card) => card.id);
    const cards = draftSurvivalUpgrades({
      state: this.build,
      wave: this.wave,
      rng: this.rng,
      previousCardIds: previous,
    });
    if (cards.length === 0) return false;
    this.rerolls = spendSurvivalReroll(this.rerolls);
    this.currentDraft = cards;
    this._emitUpgradeDraft();
    return true;
  }

  requestDash() {
    if (!this.active || this.state === 'upgrade' || this.state === 'bossStinger') return false;
    return this.player.requestDash();
  }

  snapshot() {
    const weapon = this.combat.weaponSnapshot;
    const dash = this.player.dashState;
    const bossAlive = !!this.bossDirector.boss?.active;
    return {
      state: this.state,
      wave: this.wave,
      remaining: this.combat.aliveCount() + (bossAlive ? 1 : 0),
      nextMilestone: describeSurvivalMilestone(this.wave),
      isBossWave: isSurvivalBossWave(this.wave),
      weaponId: weapon.id,
      weaponName: weapon.name,
      heat: weapon.heat,
      heatCapacity: weapon.heatCapacity,
      overheated: weapon.overheated,
      dashCharges: dash.charges,
      maxDashCharges: dash.maxCharges,
      rerolls: this.rerolls,
      currentHealth: this.combat.hp,
      maxHealth: this.combat.maxHp,
      build: this.build,
      activeSeconds: this.stats.activeSeconds,
      kills: this.stats.kills,
      bossesDefeated: this.stats.bossesDefeated,
    };
  }

  result() {
    return this.stats.snapshot(this.build);
  }

  _beginCurrentWave() {
    this.stats.setWave(this.wave);
    if (isSurvivalBossWave(this.wave)) {
      this._prepareBossStinger();
      return;
    }
    const recipe = buildSurvivalWaveRecipe(this.wave, { rng: this.rng });
    const elites = rollSurvivalEliteSlots(
      recipe.roles.length,
      this.stats.bossesDefeated,
      this.rng,
    );
    this.state = 'wave';
    this.combat.beginWave(this.wave, recipe.roles, elites);
  }

  _prepareBossStinger() {
    const bossIndex = getSurvivalBossIndex(this.wave);
    const bossId = this.debugBossId ||
      selectNextSurvivalBoss(this.rng, this.previousBossId);
    const tuning = getSurvivalBossTuning(bossId, bossIndex);
    this._pendingBoss = { bossId, tuning };
    this.state = 'bossStinger';
    this._bossStingerTimer = BOSS_STINGER_SECONDS;
    this.combat.prepareBossWave(this.wave);
    this.combat.cancelInput();
    this.player.resetInput();
    this.player.controls.enabled = false;
    this.audio?.playSurvivalBossArrival?.(bossIndex);
    this.onBossStinger({
      name: tuning.label,
      bossId,
      bossIndex,
      durationMs: BOSS_STINGER_SECONDS * 1000,
    });
  }

  _beginBoss() {
    if (!this._pendingBoss) return;
    const { bossId, tuning } = this._pendingBoss;
    this._pendingBoss = null;
    this.onBossStinger(null);
    this.player.resetInput();
    this.player.controls.enabled = true;
    this.previousBossId = bossId;
    this.state = 'boss';
    this.bossDirector.begin(bossId, tuning);
  }

  _completeNormalWave() {
    this.combat.cancelInput();
    if (isSurvivalDraftWave(this.wave)) this._openUpgradeDraft();
    else this._scheduleNextWave();
  }

  _completeBossWave() {
    this.combat.clearThreats({ immediate: true });
    this.bossDirector.disposeBoss();
    this.combat.restoreBossVictoryHealth();
    this.stats.recordBossDefeated();
    this.rerolls = awardSurvivalBossReroll(this.rerolls);
    this._openUpgradeDraft();
  }

  _openUpgradeDraft() {
    this.state = 'upgrade';
    this.stats.setActive(false);
    this.combat.cancelInput();
    this.player.clearDashInput({ stop: true });
    this.currentDraft = draftSurvivalUpgrades({
      state: this.build,
      wave: this.wave,
      rng: this.rng,
    });
    this._emitUpgradeDraft();
  }

  _emitUpgradeDraft() {
    this.onUpgradeDraft({
      wave: this.wave,
      cards: this.currentDraft,
      rerolls: this.rerolls,
      canReroll: this.rerolls > 0,
      buildState: this.build,
    });
  }

  _scheduleNextWave() {
    this.wave++;
    this.stats.setWave(this.wave);
    this.state = 'gap';
    this._gapTimer = WAVE_GAP_SECONDS;
  }

  _handleDefeat() {
    if (this.state === 'defeat' || this._disposed) return;
    this.state = 'defeat';
    this.player.controls.enabled = true;
    this.stats.setActive(false);
    const result = this.result();
    this.bossDirector.disposeBoss();
    this.combat.abortRun();
    this.audio?.stopSurvivalAudio?.();
    this.onDefeat(result);
  }

  _emitHud() {
    this.onHud(this.snapshot());
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this.player.controls.enabled = true;
    this.stats.setActive(false);
    this.bossDirector.dispose();
    this.combat.dispose();
    this.audio?.stopSurvivalAudio?.();
    this.currentDraft = [];
    this._pendingBoss = null;
    this.state = 'idle';
  }
}
