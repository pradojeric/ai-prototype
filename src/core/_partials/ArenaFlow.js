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
import { KeeperArenaController } from '../arena/KeeperArenaController.js';

function arenaTypes(definition) {
  if (definition.controller === 'tower') {
    return { Combat: TowerCombatManager, Controller: TowerArenaController };
  }
  // The Keeper fights on a republished tower deck, so it keeps the tower's
  // combat manager (Liwanag HUD, summoned echoes, no navmesh).
  if (definition.controller === 'keeper') {
    return { Combat: TowerCombatManager, Controller: KeeperArenaController };
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

  // Arena-to-arena hop (Arena 3's summit portal → the Keeper's deck). Identical
  // to _enterArena except that `_returnZone` is deliberately NOT reassigned:
  // it still holds the zone whose Rift started the run, so winning the Keeper
  // returns to Zone 3 with its artifact scatter rather than dumping the player
  // back onto the tower.
  _transferArena(arenaId) {
    if (!arenaId || this.busy || this._loadingZone) return;
    this._loadingZone = true;
    this.audio.playTeleport();
    this.elFlash.style.transition = 'none';
    this.elFlash.style.opacity = '1';
    void this.elFlash.offsetHeight;
    this.elFlash.style.transition = '';
    // Unlike a zone→arena entry there is a live controller and combat manager
    // here; _loadArena would otherwise overwrite them and orphan their handlers.
    this._disposeArenaEntities();
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
    this._startArenaPhase();
    if (definition.controller === 'tower') {
      this.arena.begin(this.combat, this.guardian);
    } else {
      this._runGuardianIntroduction(arenaId);
    }
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
    this.journeyGuide.showControl('shockwave');
  },

  async _runGuardianIntroduction(arenaId) {
    if (this.busy || this.guardianIntro.active) return;
    this.busy = true;
    this.elCross.classList.remove('active');
    this.elPrompt.classList.remove('active');
    this.journeyGuide.setObjective({ mode: 'hidden' }, false);
    // Prepare first: controllers that build their boss body for the cinematic
    // rather than in begin() (the Keeper) need combat bound before anything asks
    // them where that body is. Combat is ignored by the controllers that don't.
    this.arena?.prepareGuardianIntroduction?.(this.combat);
    const target = this.arena?.guardianIntroCenter?.()
      || this.guardian?.center().clone()
      || new THREE.Vector3();
    const playerPosition = this.player.controls.getObject().position.clone();
    // Guardian body builders normally turn toward the position supplied to their
    // update. Keep that target fixed on the player's staged position throughout
    // the cinematic so orbiting camera shots do not make the Guardian follow the
    // lens.
    this._guardianIntroFacingTarget = playerPosition.clone();
    this.audio.playGuardianIntro(arenaId, this.guardianIntro.durationFor(arenaId));
    // The hand is a child of the player camera, which stays in the scene during
    // the cinematic — left visible it renders as a hand floating at the player's
    // staged position, in shot.
    this.viewmodel.group.visible = false;
    this.renderPass.camera = this.guardianIntro.camera;
    await this.guardianIntro.play(arenaId, target, playerPosition);
    this.renderPass.camera = this.camera;
    this.viewmodel.group.visible = true;
    this._guardianIntroFacingTarget = null;
    if (this.arena?.completeGuardianIntroduction) {
      this.arena.completeGuardianIntroduction();
    } else {
      this.arena.begin(this.combat, this.guardian);
    }
    // Hand control back looking at the boss rather than wherever the player
    // happened to be facing when they walked in. Read the live centre after the
    // fight has begun, since a controller may move its body on begin.
    this._faceCamera(this.arena?.guardianCenter?.() || target);
    this.busy = false;
    this.elCross.classList.add('active');
    this._syncJourneyGuide();
    this.journeyGuide.showControl('cast');
    this.journeyGuide.showControl('shockwave');
  },

  async _returnFromArena() {
    if (this.busy) return;
    this.busy = true;
    this.elCross.classList.remove('active');
    this.elPrompt.classList.remove('active');
    this.journeyGuide.setObjective({ mode: 'hidden' }, false);
    this.viewmodel.group.visible = false;
    this.combat?.cancelInput();
    const arenaId = this.currentZone;
    const center = this.arena.guardianCenter();
    const fallenCenter = new THREE.Vector3(center.x, center.y, center.z);
    const cameraStart = this.camera.getWorldPosition(new THREE.Vector3());
    const cameraForward = this.camera.getWorldDirection(new THREE.Vector3());
    this.elFlash.style.transition = 'none';
    this.elFlash.style.opacity = '0';
    this.renderPass.camera = this.arenaVictoryCutscene.camera;
    this.endingDistortion.enabled = true;
    this.endingDistortion.uniforms.uAmount.value = 0;
    try {
      await this.arenaVictoryCutscene.play(
        this.world.scene,
        arenaId,
        cameraStart,
        cameraForward,
        fallenCenter,
        () => this.audio.playTeleport(),
      );
      this.audio.playPortalImpact();
    } catch (error) {
      console.error('Arena victory cutscene failed', { arenaId, error });
    } finally {
      this.elFlash.style.opacity = '1';
      this.arenaVictoryCutscene.dispose();
      this.renderPass.camera = this.camera;
      this.endingDistortion.enabled = false;
      this.endingDistortion.uniforms.uAmount.value = 0;
      this.elFlash.style.transition = '';
    }

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
    this.viewmodel.group.visible = true;
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
