// ============================================================
// DEBUG ZONE FLOW — direct title-menu entry into the Guardian showroom.
// This lifecycle deliberately avoids artifacts, rifts, combat, riddles, Souls,
// progression, and descend overlays; only free-roam inspection remains active.
// ============================================================
import { CONFIG, PLAYER_RADIUS } from '../../config.js';
import { createWorld } from '../zones/index.js';
import { GuardianDebugGallery } from '../debug/GuardianDebugGallery.js';

export const debugZoneFlowMethods = {
  _enterGuardianDebugZone() {
    if (!CONFIG.DEBUG_GUARDIAN_ZONE_BUTTON || this.phase !== 'title') return;

    this.audio.init();
    this.elTitle.style.display = 'none';
    this._disposeArenaEntities();
    this._disposeDebugGallery();
    if (this.rift) { this.rift.dispose(); this.rift = null; }
    if (this.soul) { this.soul.dispose(); this.soul = null; }
    this.audio.clearEchoes();

    const oldWorld = this.world;
    this.world = createWorld('zoneDebug');
    this.currentZone = 'zoneDebug';
    this.world.scene.add(this.player.controls.getObject());
    oldWorld.dispose();

    this.artifacts = null;
    this.player.setCollider((x, z, y) => this.world.collidesAt(x, z, PLAYER_RADIUS, y));
    this.player.setGroundHeight((x, z, y) => this.world.groundHeightAt(x, z, y));
    this.player.setMovementLocked(false);
    this.player.clearExternalMotion();
    this.renderPass.scene = this.world.scene;
    this.renderPass.camera = this.camera;
    this.debugGallery = new GuardianDebugGallery(this.world.scene, this.world);

    const start = this.world.zone.playerStart;
    const object = this.player.controls.getObject();
    object.position.set(start.x, start.y, start.z);
    this.camera.rotation.set(0, 0, 0);
    this.player.velocity.set(0, 0, 0);
    this.player.eyeBase = Math.max(0, start.y - CONFIG.EYE_HEIGHT);
    this.busy = false;
    this.holdKey = false;
    this.holdProgress = 0;
    this._ePressed = false;
    this._proximity = null;
    this.viewmodel.setReach(0);
    this.viewmodel.group.visible = false;
    this.elRingWrap.classList.remove('active');
    this.elPrompt.classList.remove('active');
    this.elCross.classList.remove('active');

    this.phase = 'debug';
    this._syncJourneyGuide();
    this.player.controls.lock();
  },

  _disposeDebugGallery() {
    if (!this.debugGallery) return;
    this.debugGallery.dispose();
    this.debugGallery = null;
  },
};
