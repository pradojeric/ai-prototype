import { CONFIG, TOWER_ARENA, LUMINA } from '../../config.js';
import { LuminaManager } from './LuminaManager.js';
import { TowerGateManager } from './TowerGateManager.js';
import { TowerKeeper } from './TowerKeeper.js';

const EVENT_DURATION = 2.4;
const BOSS_RETRY_POINT = { x: 0, y: 19.62, z: 5.5 };

export class TowerArenaController {
  constructor(scene, audio, player, seed, world) {
    this.scene = scene;
    this.audio = audio;
    this.player = player;
    this.world = world;
    this.seed = seed;
    this.won = false;
    this.failed = false;
    this.phase = 'ascent';
    this.elapsed = 0;
    this.waterHeight = TOWER_ARENA.BASE_WATER_HEIGHT;
    this._tidePenalty = 0;   // accumulated metres from wrong bugtong answers
    this.combat = null;
    this.keeper = null;
    this.gates = null;
    this._attempt = 0;
    this._eventRemaining = 0;
    this._guardianIntroRequested = false;
    this.lumina = new LuminaManager(scene, player, audio, {
      preserveDropHeight: true,
      walkVerticalRadius: TOWER_ARENA.VERTICAL_LUMINA_BAND,
    });

    this.elHud = document.getElementById('tower-ascent');
    this.elAltitude = document.getElementById('tower-altitude');
    this.elClearance = document.getElementById('tower-clearance');
    this.elProgress = document.getElementById('tower-progress');
    this.elStatus = document.getElementById('tower-status');
    this.elRisk = document.getElementById('tower-risk');
    this.elSealCount = document.getElementById('tower-seal-count');
    this.elSealPips = [...(document.getElementById('tower-seals')?.children || [])];
    this.elEvent = document.getElementById('tower-event');
  }

  _bindCombat(combat) {
    if (this.combat && this.combat !== combat) {
      this.combat.setEnemyDefeatedHandler(null);
      this.combat.setTowerEventHandler(null);
    }
    this.combat = combat;
    combat.setEnemyDefeatedHandler((_type, position) => this.lumina.tryDrop(position));
    combat.setTowerEventHandler((text, tone) => this.showEvent(text, tone));
  }

  _createGates(opened = false) {
    this.gates?.dispose();
    this.gates = new TowerGateManager(
      this.scene,
      this.world,
      this.combat,
      this.player,
      {
        onEvent: (text, tone) => this.showEvent(text, tone),
        // A missed bugtong permanently raises the flood for this attempt. It has
        // to accumulate into a term the per-frame water formula reads, because
        // _updateAscent recomputes waterHeight from `elapsed` every frame and
        // would erase a direct write.
        onTideSurge: () => {
          this._tidePenalty += TOWER_ARENA.WRONG_TIDE_SURGE;
        },
        onSeal: () => this._renderSeals(),
      },
    );
    if (opened) this.gates.openAll();
  }

  _createKeeper() {
    this.keeper?.dispose();
    const keeperSeed = (
      this.seed ^ 0x4b454550 ^ Math.imul(this._attempt, 0x45d9f3b)
    ) >>> 0;
    this.keeper = new TowerKeeper(
      this.scene,
      this.player,
      this.combat,
      this.audio,
      {
        bounds: this.world.towerSummitBounds,
        seed: keeperSeed,
        onEvent: (text, tone) => this.showEvent(text, tone),
        onPowerUpDrop: (position) => this.lumina.drop(position),
      },
    );
  }

  _resetPlayerState() {
    this.player.stamina = CONFIG.STAMINA_MAX;
    this.player.clearExternalMotion();
    this.player.setMovementSlow(1);
  }

  begin(combat) {
    combat.resetAlab();
    this._attempt++;
    this._bindCombat(combat);
    this.won = false;
    this.failed = false;
    this.phase = 'ascent';
    this.elapsed = 0;
    this._eventRemaining = 0;
    this._guardianIntroRequested = false;
    this.waterHeight = TOWER_ARENA.BASE_WATER_HEIGHT;
    this._tidePenalty = 0;
    this.world.setWaterLevel(this.waterHeight);
    this._resetPlayerState();
    this._createGates(false);
    this._createKeeper();
    this.lumina.beginAttempt(
      combat,
      (this.seed ^ LUMINA.SEED ^ Math.imul(this._attempt, 0x9e3779b1)) >>> 0,
    );
    combat.startFight({ mode: 'ascent', attempt: this._attempt });
    combat.hud.hideBoss();
    this.elHud?.classList.add('active');
    this.elHud?.classList.remove('warning', 'critical');
    this.elEvent?.classList.remove('active', 'warning', 'success');
    this._renderSeals();
  }

  _beginBossPhase() {
    if (this.phase !== 'ascent' && this.phase !== 'guardian-intro') return;
    this.phase = 'boss';
    this.waterHeight = TOWER_ARENA.BOSS_WATER_HEIGHT;
    this.world.setWaterLevel(this.waterHeight);
    this.combat.beginBossPhase();
    // The final seal opens on the summit landing, so this transition fires the same
    // frame it is answered — after which the boss loop never ticks the gate manager
    // again. Finalize the gates now so the last seal's veil and console are settled
    // instead of freezing mid-fade on the deck.
    this.gates.openAll();
    this.lumina.reset(
      (this.seed ^ LUMINA.SEED ^ Math.imul(this._attempt, 0x9e3779b1)) >>> 0,
    );
    this.elHud?.classList.remove('active', 'warning', 'critical');
    this.combat.hud.setBoss({
      name: 'The Keeper of Memories',
      hp: this.keeper.hp,
      maxHp: this.keeper.maxHp,
    });
    if (this.keeper.begin()) {
      this.showEvent('The Keeper of Memories awakens', 'warning');
      this.combat.hud.popupCallout(this.keeper.center(), 'SPACE TO LEAP');
    }
  }

  _beginBossRetry(combat) {
    this._attempt++;
    this._bindCombat(combat);
    this.won = false;
    this.failed = false;
    this.phase = 'boss';
    this.elapsed = 0;
    this._eventRemaining = 0;
    this.waterHeight = TOWER_ARENA.BOSS_WATER_HEIGHT;
    this._tidePenalty = 0;
    this.world.setWaterLevel(this.waterHeight);
    this._resetPlayerState();
    this._createGates(true);
    this._createKeeper();
    this.lumina.beginAttempt(
      combat,
      (this.seed ^ LUMINA.SEED ^ Math.imul(this._attempt, 0x9e3779b1)) >>> 0,
    );
    combat.startFight({ mode: 'boss', attempt: this._attempt });
    combat.hud.setBoss({
      name: 'The Keeper of Memories',
      hp: this.keeper.hp,
      maxHp: this.keeper.maxHp,
    });
    this.elHud?.classList.remove('active', 'warning', 'critical');
    this.elEvent?.classList.remove('active', 'warning', 'success');
    this.keeper.begin();
    this.showEvent('The Keeper reforms at the summit', 'warning');
    this.combat.hud.popupCallout(this.keeper.center(), 'SPACE TO LEAP');
    this._renderSeals();
  }

  restartAfterFaint(combat) {
    if (this.phase === 'boss' || this.phase === 'won') {
      this._beginBossRetry(combat);
      return;
    }
    this.begin(combat);
  }

  update(dt, t, playerPos, ePressed = false) {
    if (this.failed || !this.player.controls.isLocked) return;
    this._updateEvent(dt);
    if (this.phase === 'boss') {
      this._updateBoss(dt, t, playerPos);
      return;
    }
    if (this.phase !== 'ascent') return;
    this._updateAscent(dt, t, playerPos, ePressed);
  }

  _updateAscent(dt, t, playerPos, ePressed) {
    this.elapsed += dt;
    const rise = Math.max(0, this.elapsed - TOWER_ARENA.GRACE_DURATION);
    this.waterHeight = Math.min(
      TOWER_ARENA.MAX_WATER_HEIGHT,
      TOWER_ARENA.BASE_WATER_HEIGHT + rise * TOWER_ARENA.RISE_SPEED + this._tidePenalty,
    );
    this.world.setWaterLevel(this.waterHeight);
    this.gates.update(dt, t, playerPos, ePressed);

    const atSummitHeight = this.player.eyeBase >= TOWER_ARENA.SUMMIT_HEIGHT - 0.8;
    const summitRadius = Math.max(1, (this.world.towerSummitBounds?.radius || 9) - 0.35);
    const insideSummitPerimeter = Math.hypot(playerPos.x, playerPos.z) <= summitRadius;
    if (this.gates.allOpen() && atSummitHeight && insideSummitPerimeter) {
      this.phase = 'guardian-intro';
      this._guardianIntroRequested = true;
      return;
    }

    this.lumina.update(dt, t, playerPos);
    const eye = this.player.eyeBase + CONFIG.EYE_HEIGHT;
    if (eye - this.waterHeight <= TOWER_ARENA.DROWN_CLEARANCE) {
      this.failed = true;
      this.combat._playerDied = true;
    }
    this._renderHud(rise, eye);
  }

  _updateBoss(dt, t, playerPos) {
    this.world.setWaterLevel(TOWER_ARENA.BOSS_WATER_HEIGHT);
    this.keeper.update(dt, t, playerPos);
    this.lumina.update(dt, t, playerPos);
    this.combat.hud.setBoss({
      name: 'The Keeper of Memories',
      hp: this.keeper.hp,
      maxHp: this.keeper.maxHp,
    });
    if (!this.keeper.defeated || this.won) return;
    this.won = true;
    this.phase = 'won';
    this.showEvent('The Keeper releases the memory', 'success');
    this.combat.stop({ preserveVfx: true });
  }

  // Presenter skip, first press: skip the timed ascent and its three memory seals
  // and go straight to the Keeper, fully playable. This is the same handoff a
  // mid-boss death uses, so the seals finish settled and the tide is already at
  // its boss height. Game repositions the player afterwards via getRetryPoint().
  presenterSkipToBoss() {
    if (this.phase !== 'ascent' || !this.combat) return false;
    this._beginBossRetry(this.combat);
    return true;
  }

  // Presenter skip: mirror the win block in _updateBoss so a demo can leave the
  // ascent at any point. The seal-console riddle card is torn down explicitly —
  // unlike the other arenas the tower's riddles run inside a live simulation, so
  // one may still be on screen when the key lands.
  presenterWin() {
    if (this.won) return;
    this.gates?.presenterAbort();
    this.won = true;
    this.phase = 'won';
    this.showEvent('The Keeper releases the memory', 'success');
    this.player.clearExternalMotion();
    this.combat?.stop({ preserveVfx: true });
    this.combat?.hud?.hideBoss?.();
  }

  showEvent(text, tone = 'success') {
    if (!this.elEvent) return;
    this.elEvent.textContent = text;
    this.elEvent.classList.remove('warning', 'success');
    this.elEvent.classList.add('active', tone);
    this._eventRemaining = EVENT_DURATION;
  }

  _updateEvent(dt) {
    if (this._eventRemaining <= 0) return;
    this._eventRemaining = Math.max(0, this._eventRemaining - dt);
    if (this._eventRemaining <= 0) this.elEvent?.classList.remove('active');
  }

  _renderHud(rise, eye) {
    const altitude = Math.max(0, this.player.eyeBase);
    const clearance = Math.max(0, eye - this.waterHeight);
    if (this.elAltitude) this.elAltitude.textContent = altitude.toFixed(1);
    if (this.elClearance) this.elClearance.textContent = clearance.toFixed(1);
    if (this.elProgress) {
      this.elProgress.style.width = `${Math.min(
        100,
        altitude / TOWER_ARENA.SUMMIT_HEIGHT * 100,
      )}%`;
    }
    if (this.elStatus) {
      this.elStatus.textContent = rise > 0
        ? `Tide rising · ${TOWER_ARENA.RISE_SPEED.toFixed(2)} m/s`
        : `Tide dormant · ${Math.max(
          0,
          TOWER_ARENA.GRACE_DURATION - this.elapsed,
        ).toFixed(1)}s`;
    }
    const isCritical = clearance < TOWER_ARENA.CRITICAL_CLEARANCE;
    const isWarning = !isCritical && clearance < TOWER_ARENA.WARNING_CLEARANCE;
    this.elHud?.classList.toggle('critical', isCritical);
    this.elHud?.classList.toggle('warning', isWarning);
    if (this.elRisk) {
      this.elRisk.textContent = isCritical ? 'Drowning' : isWarning ? 'Tide close' : 'Air stable';
    }
    this._renderSeals();
  }

  _renderSeals() {
    let opened = 0;
    if (this.gates) {
      for (const gate of this.gates.gates) if (gate.open) opened++;
    }
    if (this.elSealCount) this.elSealCount.textContent = `${opened} / 3`;
    this.elSealPips.forEach((pip, index) => pip.classList.toggle('open', index < opened));
  }

  consumeFailure() {
    if (!this.failed) return false;
    this.failed = false;
    return true;
  }

  consumeGuardianIntroRequest() {
    if (!this._guardianIntroRequested) return false;
    this._guardianIntroRequested = false;
    return true;
  }

  guardianIntroCenter() {
    return this.keeper.center().clone();
  }

  prepareGuardianIntroduction() {
    this.keeper.body.show();
    this.combat.hud.hideBoss();
    this.elHud?.classList.remove('active', 'warning', 'critical');
    this.elEvent?.classList.remove('active', 'warning', 'success');
  }

  updateGuardianIntro(dt, t, facingTarget) {
    this.keeper.body.update(dt, t, facingTarget);
  }

  completeGuardianIntroduction() {
    this._beginBossPhase();
  }

  getRetryPoint() {
    return this.phase === 'boss' || this.phase === 'won' ? BOSS_RETRY_POINT : null;
  }

  collidesPlayerAt(x, z, radius, supportY) {
    return !!(
      this.gates?.collidesPlayerAt(x, z, radius, supportY) ||
      this.keeper?.blocksPlayerAt(x, z, radius, supportY) ||
      this.combat?.blocksPlayerAt(x, z, radius, supportY)
    );
  }

  resetLumina() {
    this.lumina.reset();
    this.gates?.dispose();
    this.gates = null;
    this.keeper?.dispose();
    this.keeper = null;
    this.player.clearExternalMotion();
    this.combat?.hud.hideBoss();
    this.elEvent?.classList.remove('active');
    this.elHud?.classList.remove('active', 'warning', 'critical');
  }

  guardianCenter() {
    return this.keeper?.center() || { x: 0, y: TOWER_ARENA.SUMMIT_HEIGHT, z: 0 };
  }

  dispose() {
    this.lumina.dispose();
    this.gates?.dispose();
    this.keeper?.dispose();
    this.combat?.setEnemyDefeatedHandler(null);
    this.combat?.setTowerEventHandler(null);
    this.combat?.hud.hideBoss();
    this.elHud?.classList.remove('active', 'warning', 'critical');
    this.elEvent?.classList.remove('active', 'warning', 'success');
  }
}
