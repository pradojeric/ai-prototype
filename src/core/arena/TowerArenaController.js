import { CONFIG, TOWER_ARENA, LUMINA } from '../../config.js';
import { LuminaManager } from './LuminaManager.js';
import { TowerGateManager } from './TowerGateManager.js';
import { TowerKeeper } from './TowerKeeper.js';

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
    this.elapsed = 0;
    this.waterHeight = TOWER_ARENA.BASE_WATER_HEIGHT;
    this.combat = null;
    this.keeper = null;
    this.gates = null;
    this._eventRemaining = 0;
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
    this.elKeeper = document.getElementById('tower-keeper');
    this.elKeeperCount = document.getElementById('tower-keeper-count');
    this.elKeeperFill = document.getElementById('tower-keeper-fill');
    this.elSlow = document.getElementById('tower-slow');
    this.elSlowTime = document.getElementById('tower-slow-time');
    this.elEvent = document.getElementById('tower-event');
  }

  begin(combat) {
    this.gates?.dispose();
    this.keeper?.dispose();
    this.combat = combat;
    this.won = false;
    this.failed = false;
    this.elapsed = 0;
    this._eventRemaining = 0;
    this.waterHeight = TOWER_ARENA.BASE_WATER_HEIGHT;
    this.world.setWaterLevel(this.waterHeight);
    this.player.stamina = CONFIG.STAMINA_MAX;
    this.player.clearExternalMotion();
    this.gates = new TowerGateManager(
      this.scene,
      this.world,
      combat,
      this.player,
      {
        onEvent: (text, tone) => this.showEvent(text, tone),
        onSlow: () => this._renderSlow(),
        onSeal: () => this._renderSeals(),
      },
    );
    this.keeper = new TowerKeeper(this.scene, this.player, combat, this.audio);
    this.lumina.beginAttempt(combat, this.seed ^ LUMINA.SEED);
    combat.setEnemyDefeatedHandler((_type, position) => this.lumina.tryDrop(position));
    combat.setTowerEventHandler((text, tone) => this.showEvent(text, tone));
    combat.startFight();
    this.elHud?.classList.add('active');
    this.elHud?.classList.remove('keeper-active', 'warning', 'critical');
    this.elEvent?.classList.remove('active', 'warning', 'success');
    this.elKeeper?.classList.remove('active');
    this._renderSeals();
    this._renderSlow();
  }

  update(dt, t, playerPos) {
    if (this.failed || !this.player.controls.isLocked) return;
    this.elapsed += dt;
    this._updateEvent(dt);
    const rise = Math.max(0, this.elapsed - TOWER_ARENA.GRACE_DURATION);
    this.waterHeight = Math.min(
      TOWER_ARENA.MAX_WATER_HEIGHT,
      TOWER_ARENA.BASE_WATER_HEIGHT + rise * TOWER_ARENA.RISE_SPEED,
    );
    this.world.setWaterLevel(this.waterHeight);

    let stage = -1;
    for (let i = 0; i < TOWER_ARENA.THREAT_BANDS.length; i++) {
      if (this.player.eyeBase >= TOWER_ARENA.THREAT_BANDS[i]) stage = i;
    }
    this.combat.spawnStage(stage);
    this.gates.update(dt, t, playerPos);

    const atSummit = this.player.eyeBase >= TOWER_ARENA.SUMMIT_HEIGHT - 0.8;
    if (this.gates.allOpen() && atSummit) {
      if (this.keeper.begin()) this.showEvent('The Keeper of Memories awakens', 'warning');
      this.keeper.update(dt, t, playerPos);
      if (this.keeper.defeated && !this.won) {
        this.won = true;
        this.showEvent('The Keeper releases the memory', 'success');
        this.combat.stop();
      }
    }

    this.lumina.update(dt, t, playerPos);
    const eye = this.player.eyeBase + CONFIG.EYE_HEIGHT;
    if (eye - this.waterHeight <= TOWER_ARENA.DROWN_CLEARANCE) {
      this.failed = true;
      this.combat._playerDied = true;
    }
    this._renderHud(rise, eye);
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
        100, altitude / TOWER_ARENA.SUMMIT_HEIGHT * 100,
      )}%`;
    }
    if (this.elStatus) {
      this.elStatus.textContent = rise > 0
        ? `Tide rising · ${TOWER_ARENA.RISE_SPEED.toFixed(2)} m/s`
        : `Tide dormant · ${Math.max(
          0, TOWER_ARENA.GRACE_DURATION - this.elapsed,
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
    this._renderKeeper();
    this._renderSlow();
  }

  _renderSeals() {
    let opened = 0;
    if (this.gates) {
      for (const gate of this.gates.gates) if (gate.open) opened++;
    }
    if (this.elSealCount) this.elSealCount.textContent = `${opened} / 3`;
    this.elSealPips.forEach((pip, index) => pip.classList.toggle('open', index < opened));
  }

  _renderKeeper() {
    const visible = !!(this.keeper?.active || this.keeper?.defeated);
    this.elHud?.classList.toggle('keeper-active', visible);
    this.elKeeper?.classList.toggle('active', visible);
    if (!this.keeper) return;
    if (this.elKeeperCount) {
      this.elKeeperCount.textContent = `${this.keeper.hp} / ${TOWER_ARENA.KEEPER.HP}`;
    }
    if (this.elKeeperFill) {
      this.elKeeperFill.style.width = `${Math.max(
        0, this.keeper.hp / TOWER_ARENA.KEEPER.HP * 100,
      )}%`;
    }
  }

  _renderSlow() {
    const remaining = this.gates?.slowRemaining || 0;
    this.elSlow?.classList.toggle('active', remaining > 0);
    if (this.elSlowTime) this.elSlowTime.textContent = remaining.toFixed(1);
  }

  consumeFailure() {
    if (!this.failed) return false;
    this.failed = false;
    return true;
  }

  collidesPlayerAt(x, z, radius, supportY) {
    return !!(
      this.gates?.collidesPlayerAt(x, z, radius, supportY) ||
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
    this.elEvent?.classList.remove('active');
    this.elHud?.classList.remove('keeper-active', 'warning', 'critical');
    this.elKeeper?.classList.remove('active');
    this.elSlow?.classList.remove('active');
  }

  guardianCenter() {
    return this.keeper?.center() || { x: 0, y: TOWER_ARENA.SUMMIT_HEIGHT, z: 0 };
  }

  dispose() {
    this.lumina.dispose();
    this.gates?.dispose();
    this.keeper?.dispose();
    this.combat?.setTowerEventHandler(null);
    this.elHud?.classList.remove('active', 'warning', 'critical', 'keeper-active');
    this.elEvent?.classList.remove('active', 'warning', 'success');
    this.elKeeper?.classList.remove('active');
    this.elSlow?.classList.remove('active');
  }
}
