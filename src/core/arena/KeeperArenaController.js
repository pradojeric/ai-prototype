// ============================================================
// KEEPER ARENA (arena3boss) — the Keeper of Memories fight.
//
// Split out of TowerArenaController when Arena 3's summit became a portal: the
// climb and the boss now live in different worlds, so they are separate
// controllers rather than two phases of one. Everything here is the boss half,
// moved essentially unchanged — static water, the Keeper, lumina drops, the boss
// HUD, and a retry that reforms the Keeper in place instead of replaying the tower.
//
// arena3boss.js republishes the tower's `towerSummitBounds` / `towerBossAddAnchors`
// contract at the same height, with a broader radius for this mobile duel.
// ============================================================
import { CONFIG, TOWER_ARENA, LUMINA } from '../../config.js';
import { LuminaManager } from './LuminaManager.js';
import { TowerKeeper } from './TowerKeeper.js';

const EVENT_DURATION = 2.4;
const BOSS_NAME = 'The Archivist';

export class KeeperArenaController {
  constructor(scene, audio, player, seed, world) {
    this.scene = scene;
    this.audio = audio;
    this.player = player;
    this.world = world;
    this.seed = seed;
    this.won = false;
    this.failed = false;
    this.phase = 'boss';
    this.combat = null;
    this.keeper = null;
    this._attempt = 0;
    this._eventRemaining = 0;
    this.lumina = new LuminaManager(scene, player, audio, {
      preserveDropHeight: true,
      walkVerticalRadius: TOWER_ARENA.VERTICAL_LUMINA_BAND,
    });

    // Shared with the tower ascent HUD: the altitude readout stays hidden here,
    // but the event banner is the same element.
    this.elHud = document.getElementById('tower-ascent');
    this.elEvent = document.getElementById('tower-event');

    this._retryPoint = this._deckRetryPoint();
  }

  _deckRetryPoint() {
    const bounds = this.world.towerSummitBounds;
    const height = bounds?.height ?? TOWER_ARENA.SUMMIT_HEIGHT;
    const entry = bounds?.entry;
    return {
      x: entry ? entry.x * 0.62 : 0,
      y: height + CONFIG.EYE_HEIGHT,
      z: entry ? entry.z * 0.62 : 5.5,
    };
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

  _setBossHud() {
    this.combat.hud.setBoss({
      name: BOSS_NAME,
      hp: this.keeper.hp,
      maxHp: this.keeper.maxHp,
    });
  }

  // Shared by the first fight and every retry: water is static here, so it is
  // pinned once rather than recomputed per frame the way the ascent's tide was.
  _startFight(combat, { announcement }) {
    this._attempt++;
    this._bindCombat(combat);
    this.won = false;
    this.failed = false;
    this.phase = 'boss';
    this._eventRemaining = 0;
    this.world.setWaterLevel(TOWER_ARENA.BOSS_WATER_HEIGHT);
    this.player.stamina = CONFIG.STAMINA_MAX;
    this.player.clearExternalMotion();
    this.player.setMovementSlow(1);
    combat.resetAlab();
    if (!this.keeper) this._createKeeper();
    this.lumina.beginAttempt(
      combat,
      (this.seed ^ LUMINA.SEED ^ Math.imul(this._attempt, 0x9e3779b1)) >>> 0,
    );
    // startFight in boss mode already does everything beginBossPhase() did for
    // the old mid-fight ascent→boss handoff; there is no ascent to hand off from.
    combat.startFight({ mode: 'boss', attempt: this._attempt });
    this.elHud?.classList.remove('active', 'warning', 'critical');
    this.elEvent?.classList.remove('active', 'warning', 'success');
    this._setBossHud();
    this.keeper.begin();
    this.showEvent(announcement, 'warning');
    this.combat.hud.popupCallout(this.keeper.center(), 'SPACE TO LEAP');
  }

  begin(combat) {
    this._startFight(combat, { announcement: `${BOSS_NAME} awakens` });
  }

  // resetLumina() has already disposed the Keeper; nulling it lets _startFight
  // rebuild it after the combat rebind, so the new one gets a live reference.
  restartAfterFaint(combat) {
    this.keeper?.dispose();
    this.keeper = null;
    this._startFight(combat, { announcement: 'The Keeper reforms' });
  }

  update(dt, t, playerPos) {
    if (this.failed || !this.player.controls.isLocked) return;
    this._updateEvent(dt);
    if (this.phase !== 'boss') return;
    this.world.setWaterLevel(TOWER_ARENA.BOSS_WATER_HEIGHT);
    this.keeper.update(dt, t, playerPos);
    this.lumina.update(dt, t, playerPos);
    this._setBossHud();
    if (!this.keeper.defeated || this.won) return;
    this.won = true;
    this.phase = 'won';
    this.showEvent('The Keeper releases the memory', 'success');
    this.combat.stop({ preserveVfx: true });
  }

  // Presenter skip: the boss is the whole encounter here, so there is no armor
  // phase to cut — the first press wins it outright and Game's existing
  // `arena.won` check runs the normal victory-rift return to Zone 3.
  presenterSkipToBoss() {
    return false;
  }

  presenterWin() {
    if (this.won) return;
    this.won = true;
    this.phase = 'won';
    this.showEvent('The Keeper releases the memory', 'success');
    this.player.clearExternalMotion();
    if (this.keeper?.body) this.keeper.body.defeated = true;
    this.combat?.stop({ preserveVfx: true });
    this.combat?.hud?.hideBoss?.();
  }

  // Unlike Arena 1/2, the Keeper body belongs to this controller rather than
  // Game.guardian. Keep its existing dissolve alive while the shared return
  // cutscene owns the camera and the normal boss update is intentionally frozen.
  updateVictoryVisual(dt, t, facingTarget) {
    this.keeper?.body.update(dt, t, facingTarget);
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

  consumeFailure() {
    if (!this.failed) return false;
    this.failed = false;
    return true;
  }

  // The Keeper must exist before the cinematic so it has a body to frame; combat
  // arrives here because ArenaFlow runs the introduction before begin().
  prepareGuardianIntroduction(combat) {
    if (combat) this._bindCombat(combat);
    this.world.setWaterLevel(TOWER_ARENA.BOSS_WATER_HEIGHT);
    if (!this.keeper) this._createKeeper();
    this.keeper.body.show();
    this.combat?.hud.hideBoss();
    this.elHud?.classList.remove('active', 'warning', 'critical');
    this.elEvent?.classList.remove('active', 'warning', 'success');
  }

  guardianIntroCenter() {
    if (!this.keeper) this._createKeeper();
    return this.keeper.center().clone();
  }

  updateGuardianIntro(dt, t, facingTarget) {
    this.keeper?.body.update(dt, t, facingTarget);
  }

  getRetryPoint() {
    return this._retryPoint;
  }

  collidesPlayerAt(x, z, radius, supportY) {
    return !!(
      this.keeper?.blocksPlayerAt(x, z, radius, supportY) ||
      this.combat?.blocksPlayerAt(x, z, radius, supportY)
    );
  }

  resetLumina() {
    this.lumina.reset();
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
    this.keeper?.dispose();
    this.combat?.setEnemyDefeatedHandler(null);
    this.combat?.setTowerEventHandler(null);
    this.combat?.hud.hideBoss();
    this.elHud?.classList.remove('active', 'warning', 'critical');
    this.elEvent?.classList.remove('active', 'warning', 'success');
  }
}
