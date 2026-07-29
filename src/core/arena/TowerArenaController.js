// ============================================================
// TOWER ARENA (Arena 3) — the timed ascent only.
//
// The tide rises, three bugtong seals gate the climb, and the summit holds the
// portal out to the Keeper. The Keeper fight itself lives in KeeperArenaController
// (arena3boss) — this controller ends when the player walks into the portal, not
// when a boss dies, so it has no win state of its own.
// ============================================================
import { CONFIG, TOWER_ARENA, LUMINA } from '../../config.js';
import { LuminaManager } from './LuminaManager.js';
import { TowerGateManager } from './TowerGateManager.js';
import { SummitPortal } from './SummitPortal.js';

const EVENT_DURATION = 2.4;

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
    this.portal = null;
    this.gates = null;
    this._attempt = 0;
    this._eventRemaining = 0;
    this._transferRequested = false;
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

  _createPortal() {
    this.portal?.dispose();
    this.portal = new SummitPortal(this.scene, this.world.towerSummitPortalAnchor);
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
    this._transferRequested = false;
    this.waterHeight = TOWER_ARENA.BASE_WATER_HEIGHT;
    this._tidePenalty = 0;
    this.world.setWaterLevel(this.waterHeight);
    this._resetPlayerState();
    this._createGates(false);
    this._createPortal();
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

  // Drowning is the only failure here, so a faint always replays the climb.
  restartAfterFaint(combat) {
    this.begin(combat);
  }

  update(dt, t, playerPos, ePressed = false) {
    if (this.failed || !this.player.controls.isLocked) return;
    this._updateEvent(dt);
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

    // The portal opens on the third seal. The tide is deliberately still rising
    // underneath it — the summit is an escape, not a safe room.
    const sealsDone = this.gates.allOpen();
    this.portal.setOpen(sealsDone);
    this.portal.update(dt, t);
    if (sealsDone && this.portal.contains(playerPos)) {
      this._requestTransfer();
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

  // Hand the run to arena3boss. Settling the gates here matters: the third seal
  // can be answered on the summit landing itself, so the veil and console would
  // otherwise freeze mid-fade as the world is torn down.
  _requestTransfer() {
    if (this._transferRequested) return;
    this._transferRequested = true;
    this.phase = 'transfer';
    this.gates.openAll();
    this.player.clearExternalMotion();
    this.combat?.stop({ preserveVfx: false });
    this.elHud?.classList.remove('active', 'warning', 'critical');
    this.showEvent('The way opens', 'success');
  }

  consumeArenaTransferRequest() {
    if (!this._transferRequested) return false;
    this._transferRequested = false;
    return true;
  }

  // Presenter skip: Arena 3 has no boss and no win of its own, so both skip
  // levels do the same honest thing — settle the seals and take the portal. The
  // Keeper is then skippable again on the far side. The riddle card is torn down
  // explicitly because, unlike the other arenas, the tower's bugtong run inside a
  // live simulation and one may still be on screen when the key lands.
  presenterSkipToBoss() {
    if (this.phase !== 'ascent' || !this.combat) return false;
    this.gates?.presenterAbort();
    this._requestTransfer();
    return true;
  }

  presenterWin() {
    this.presenterSkipToBoss();
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

  // The player leaves through the portal rather than beating anything here, so
  // there is no staged retry point — a faint replays the climb from the base.
  getRetryPoint() {
    return null;
  }

  collidesPlayerAt(x, z, radius, supportY) {
    return !!(
      this.gates?.collidesPlayerAt(x, z, radius, supportY) ||
      this.portal?.collidesPlayerAt(x, z, radius, supportY) ||
      this.combat?.blocksPlayerAt(x, z, radius, supportY)
    );
  }

  resetLumina() {
    this.lumina.reset();
    this.gates?.dispose();
    this.gates = null;
    this.portal?.dispose();
    this.portal = null;
    this.player.clearExternalMotion();
    this.combat?.hud.hideBoss();
    this.elEvent?.classList.remove('active');
    this.elHud?.classList.remove('active', 'warning', 'critical');
  }

  dispose() {
    this.lumina.dispose();
    this.gates?.dispose();
    this.portal?.dispose();
    this.combat?.setEnemyDefeatedHandler(null);
    this.combat?.setTowerEventHandler(null);
    this.combat?.hud.hideBoss();
    this.elHud?.classList.remove('active', 'warning', 'critical');
    this.elEvent?.classList.remove('active', 'warning', 'success');
  }
}
