// ============================================================
// ARENA FLOW — scene-swap and lifecycle methods installed onto Game's prototype.
// Kept outside Game.js so adding arena variants cannot push the orchestrator over
// the repository's 1000-line hard limit.
// ============================================================
import * as THREE from 'three';
import { CONFIG, ARENA, PLAYER_RADIUS } from '../../config.js';
import { createWorld } from '../zones/index.js';
import { ArtifactManager } from '../ArtifactManager.js';
import { Guardian } from '../Guardian.js';
import { GuardianSoul } from '../GuardianSoul.js';
import { CombatManager } from '../combat/CombatManager.js';
import { ArenaController } from '../arena/ArenaController.js';
import { RailCombatManager } from '../arena/RailCombatManager.js';
import { RailArenaController } from '../arena/RailArenaController.js';
import { TowerArenaController } from '../arena/TowerArenaController.js';
import { TowerCombatManager } from '../arena/TowerCombatManager.js';

function arenaTypes(definition) {
  if (definition.controller === 'tower') {
    return { Combat: TowerCombatManager, Controller: TowerArenaController };
  }
  if (definition.controller === 'rail') {
    return { Combat: RailCombatManager, Controller: RailArenaController };
  }
  return { Combat: CombatManager, Controller: ArenaController };
}

export const arenaFlowMethods = {
  _enterArena(arenaId) {
    if (this.busy || this._loadingZone) return;
    this._returnZone = this.currentZone;
    this._loadingZone = true;
    this.audio.playTeleport();
    this.elFlash.style.transition = 'none';
    this.elFlash.style.opacity = '1';
    void this.elFlash.offsetHeight;
    this.elFlash.style.transition = '';
    this._loadArena(arenaId);
    this.pause.nextFrame(() => { this.elFlash.style.opacity = '0'; });
  },

  _loadArena(arenaId) {
    if (this.rift) { this.rift.dispose(); this.rift = null; }
    if (this.soul) { this.soul.dispose(); this.soul = null; }
    const oldWorld = this.world;

    this.world = createWorld(arenaId);
    this.currentZone = arenaId;
    this.world.scene.add(this.player.controls.getObject());
    oldWorld.dispose();

    this.player.setCollider((x, z, y) => this.world.collidesAt(x, z, PLAYER_RADIUS, y) || this.arena?.collidesPlayerAt?.(x, z, PLAYER_RADIUS, y));
    this.player.setGroundHeight((x, z, y) => this.world.groundHeightAt(x, z, y));
    this.renderPass.scene = this.world.scene;
    this.renderPass.camera = this.camera;

    const definition = this.world.zone;
    const { Combat, Controller } = arenaTypes(definition);
    this.guardian = definition.spawnGuardian === false
      ? null
      : new Guardian(
        this.world.scene,
        this.world,
        definition.guardianVariant || 'zone1',
        definition.guardianEffects,
      );
    this.combat = Combat
      ? new Combat(
        this.world.scene, this.world, this.player, this.camera, this.viewmodel, this.audio,
      )
      : null;
    this.arena = new Controller(
      this.world.scene, this.audio, this.player, definition.seed, this.world,
    );
    this.audio.clearEchoes();

    this.busy = false;
    this.holdKey = false;
    this.holdProgress = 0;
    this._ePressed = false;
    this._proximity = null;
    this._spawnAtArenaCenter();
    this.arena.begin(this.combat, this.guardian);
    this._startArenaPhase();
  },

  _spawnAtArenaCenter(override = null) {
    const start = override || this.world.zone.playerStart || {
      x: ARENA.CENTER.x, y: CONFIG.EYE_HEIGHT, z: ARENA.CENTER.z,
    };
    const object = this.player.controls.getObject();
    object.position.set(start.x, start.y, start.z);
    this.camera.rotation.set(0, 0, 0);
    this.player.velocity.set(0, 0, 0);
    this.player.eyeBase = Math.max(0, start.y - CONFIG.EYE_HEIGHT);
    this.player.setMovementLocked(!!this.world.zone.aimOnly, object.position);
  },

  _startArenaPhase() {
    this.phase = 'arena';
    this._loadingZone = false;
    this.elCross.classList.add('active');
    this.elPrompt.classList.remove('active');
    this._syncJourneyGuide();
    this.journeyGuide.showControl('cast');
  },

  async _returnFromArena() {
    if (this.busy) return;
    this.busy = true;
    this.elCross.classList.remove('active');
    const fallenCenter = this.arena.guardianCenter();
    await this.pause.wait(ARENA.COLLAPSE * 1000);

    this.elFlash.style.transition = 'none';
    this.elFlash.style.opacity = '1';
    void this.elFlash.offsetHeight;
    this.elFlash.style.transition = '';

    this._disposeArenaEntities();
    const oldWorld = this.world;
    this.world = createWorld(this._returnZone);
    this.currentZone = this._returnZone;
    this.world.scene.add(this.player.controls.getObject());
    oldWorld.dispose();

    this.player.setCollider((x, z, y) => this.world.collidesAt(x, z, PLAYER_RADIUS, y));
    this.player.setGroundHeight((x, z, y) => this.world.groundHeightAt(x, z, y));
    this.renderPass.scene = this.world.scene;
    this.renderPass.camera = this.camera;

    this.collectedByZone[this._returnZone] ||= new Set();
    this.artifacts = new ArtifactManager(
      this.world.scene, this.world, this.collectedByZone[this._returnZone],
    );
    this.rift = null;
    this.audio.clearEchoes();
    this.bossDefeated = true;
    this.holdKey = false;
    this.holdProgress = 0;
    this._ePressed = false;
    this._proximity = null;

    this._spawnAtDock();
    const origin = new THREE.Vector3(fallenCenter.x, CONFIG.WATER_LEVEL + 2, 10);
    this.artifacts.scatter(origin);
    this.audio.playScatter();
    this.artifacts.artifacts.forEach((artifact) => this.audio.addEcho(artifact, artifact.pos));
    if (!this.collectedSouls.has(this._returnZone)) {
      this.soul = new GuardianSoul(
        this.world.scene, this._returnZone, origin, (zone) => this._collectSoul(zone),
      );
    }
    this._levelCamera();
    this.busy = false;
    this._loadingZone = false;
    this.pause.nextFrame(() => { this.elFlash.style.opacity = '0'; });
    if (this.artifacts.total === 0 && this.collectedSouls.has(this.currentZone)) {
      this._zoneComplete();
      return;
    }
    this._startGameplayPhase();
  },

  _disposeArenaEntities() {
    if (this.arena) { this.arena.dispose(); this.arena = null; }
    if (this.guardian) { this.guardian.dispose(); this.guardian = null; }
    if (this.combat) { this.combat.dispose(); this.combat = null; }
    this.player.setMovementLocked(false);
  },

  async _arenaFaint() {
    if (this.busy) return;
    this.busy = true;
    const retryPoint = this.arena.getRetryPoint?.() || null;
    this.arena.resetLumina();
    if (this.combat) this.combat.abortFight();
    await this._faintOnly(() => this._spawnAtArenaCenter(retryPoint));
    // Controllers that distinguish "died during the boss" from "died mid-waves"
    // resume at the right place; the others just restart the encounter.
    if (this.arena.restartAfterFaint) this.arena.restartAfterFaint(this.combat, this.guardian);
    else this.arena.begin(this.combat, this.guardian);
    this.busy = false;
    this._startArenaPhase();
  },
};
