// ============================================================
// SURVIVAL FLOW — ending entry, scene lifecycle, retry, return, and rendering.
// ============================================================
import * as THREE from 'three';
import { CONFIG, FAINT, PLAYER_RADIUS, SURVIVAL_FAINT, SURVIVAL_TITLE } from '../../config.js';
import { SurvivalUI } from '../../ui/SurvivalUI.js';
import { createWorld } from '../zones/index.js';
import { SurvivalController } from '../survival/SurvivalController.js';
import { SURVIVAL_BRIEFING } from '../survival/SurvivalBriefing.js';
import {
  compareSurvivalResults,
  SurvivalSessionBest,
} from '../survival/SurvivalRunStats.js';
import {
  canEnterSurvivalFromHub,
  isSurvivalPortalOpen,
} from '../survival/SurvivalEntryPolicy.js';

// Every phase that lives inside a Survival run. `survivalBriefing` is the
// pre-Wave-1 explanation: the arena exists and the player stands in it, so
// leaving the mode from there must tear down exactly as much as leaving mid-wave.
const SURVIVAL_PHASES = Object.freeze([
  'survivalBriefing',
  'survival',
  'survivalUpgrade',
  'survivalFaint',
  'survivalDefeat',
]);

function restoreGameplayBloom(game) {
  if (!game._gameplayBloom) return;
  game.bloom.strength = game._gameplayBloom.strength;
  game.bloom.radius = game._gameplayBloom.radius;
  game.bloom.threshold = game._gameplayBloom.threshold;
  game._gameplayBloom = null;
}

export const survivalFlowMethods = {
  // Undo the gentler hub bloom stashed by _enterMuseum. Shared by every route out
  // of the hub — into a zone (Game._enterZoneFromHub) and into Survival.
  _restorePreHubBloom() {
    if (!this._preHubBloom) return;
    this.bloom.strength = this._preHubBloom.strength;
    this.bloom.radius = this._preHubBloom.radius;
    this.bloom.threshold = this._preHubBloom.threshold;
    this._preHubBloom = null;
  },

  _initializeSurvival() {
    this.survival = null;
    this.survivalSessionBest = new SurvivalSessionBest();
    this._survivalRunSerial = 0;
    this._restoredProvinceDisposed = false;
    // Death-cinematic state: the ledger waiting to be shown, its render-loop
    // countdown, and the wall-clock net that shows it if the loop never gets there.
    this._pendingSurvivalDefeat = null;
    this._survivalFaintRemaining = 0;
    this._survivalDefeatFallback = null;
    this.survivalUi = new SurvivalUI({
      onSelectUpgrade: (card) => this._selectSurvivalUpgrade(card),
      onReroll: (cardIds) => this._rerollSurvivalUpgrade(cardIds),
      onRetry: () => this._retrySurvival(),
      onReturnToMuseum: () => this._returnFromSurvival(),
      onBeginRun: () => this._beginSurvivalWaves(),
    });
    addEventListener('beforeunload', () => this.survivalUi.destroy(), { once: true });
  },

  // Whether the Endless Echoes arch is open. Called on every hub entry, so the
  // debug unlock and the post-ending state resolve through one policy.
  _syncSurvivalPortal() {
    this.museum.survivalPortal.setOpen(
      isSurvivalPortalOpen(this._survivalPortalOptions()),
    );
  },

  _survivalPortalOptions() {
    return {
      epilogueMode: this.museum.epilogueMode,
      debugUnlocked: CONFIG.DEBUG_SURVIVAL_UNLOCKED,
    };
  },

  // Walked into the arch in the museum lobby — the only way into Survival.
  _enterSurvivalFromHub() {
    if (!canEnterSurvivalFromHub(this.phase, this._survivalPortalOptions())) return false;
    if (!this.museum.survivalPortal.enterable) return false;
    this.audio.init();
    this.audio.resumeContext();
    this.elEndingBlack.classList.add('active');
    this.elPrompt.classList.remove('active');
    this.museum.clearAim();
    // Only the post-ending route owns the restored-province scene. Entering from
    // the debug-unlocked hub happens BEFORE the ending, so disposing it here
    // would break the ending cutscene the player has not seen yet.
    if (this.museum.epilogueMode) this._disposeRestoredProvince();
    restoreGameplayBloom(this);
    this._restorePreHubBloom();
    this.audio.restoreAfterEnding();
    this.audio.stopSurvivalAudio?.();

    // The hub keeps the last zone's world alive behind it (the player rig simply
    // moves to museum.scene), so it must be torn down here or entering Survival
    // would leak a whole zone's GPU resources.
    const oldWorld = this._detachActiveZone();
    this.world = createWorld('survival');
    this.currentZone = 'survival';
    this.world.scene.add(this.player.controls.getObject());
    if (oldWorld !== this.world) oldWorld?.dispose();
    this.renderPass.scene = this.world.scene;
    this.renderPass.camera = this.camera;
    this.player.setCollider((x, z, y) => (
      this.world.collidesAt(x, z, PLAYER_RADIUS, y) ||
      this.survival?.combat?.blocksPlayerAt(x, z, PLAYER_RADIUS, y)
    ));
    this.player.setGroundHeight((x, z, y) => this.world.groundHeightAt(x, z, y));
    this.player.setMovementLocked(false);
    this.player.clearYawLimit();
    this.player.clearExternalMotion();
    this.audio.clearEchoes();
    this._spawnSurvivalPlayer();
    this._startSurvivalRun();
    this.pause.nextFrame(() => this.elEndingBlack.classList.remove('active'));
    return true;
  },

  _spawnSurvivalPlayer() {
    const start = this.world.zone.playerStart;
    const object = this.player.controls.getObject();
    const support = this.world.groundHeightAt(start.x, start.z, 0);
    this.player.eyeBase = Number.isFinite(support) ? support : 0;
    object.position.set(
      start.x,
      this.player.eyeBase + CONFIG.EYE_HEIGHT,
      start.z,
    );
    this.camera.rotation.set(0, 0, 0);
    this.player.velocity.set(0, 0, 0);
    this.player.resetSurvivalRunMobility();
    this.viewmodel.group.visible = true;
  },

  _startSurvivalRun() {
    this._survivalRunSerial++;
    this.survival?.dispose();
    const seed = (this.world.zone.seed + this._survivalRunSerial) >>> 0;
    this.survival = new SurvivalController({
      scene: this.world.scene,
      world: this.world,
      player: this.player,
      camera: this.camera,
      viewmodel: this.viewmodel,
      audio: this.audio,
      seed,
      debugBossId: CONFIG.DEBUG_TEST_ENDING_BUTTON
        ? CONFIG.DEBUG_SURVIVAL_BOSS
        : null,
      onHud: (snapshot) => this.survivalUi.updateHud(snapshot),
      onUpgradeDraft: (draft) => this._openSurvivalUpgrade(draft),
      onUpgradeClosed: () => this._closeSurvivalUpgrade(),
      onBossStinger: (boss) => {
        if (boss) this.survivalUi.showBossStinger({ ...boss, managed: true });
        else this.survivalUi.hideBossStinger();
      },
      onDefeat: (result) => this._showSurvivalDefeat(result),
    });
    this.combat = this.survival.combat;
    this.holdKey = false;
    this._ePressed = false;
    document.body.classList.add('survival-active');
    this.world.setSurvivalBossTier?.(0);
    this.survivalUi.hideDefeat(false);
    this.elPrompt.classList.remove('active');
    // Wave 1 is NOT spawned yet. The controller is built (so the arena, the HUD
    // snapshot and the player's mobility are all real) but `start()` waits behind
    // the briefing — a player who has never seen this mode should read the rite
    // before anything is allowed to hit them.
    this._openSurvivalBriefing();
  },

  // Every entry through the arch and every retry shows the briefing, per design:
  // it is the mode's only teaching surface, and skipping it on a repeat run is
  // the one case where a player most wants to re-check the draft cadence.
  _openSurvivalBriefing() {
    this.phase = 'survivalBriefing';
    this.busy = true;
    this.elCross.classList.remove('active');
    this.pause.releasePointerLock();
    this.survivalUi.hideHud();

    // The title card plays over the briefing, not before it: the briefing is
    // painted immediately (so the card's fade-out reveals the rules rather than
    // flashing black), but its confirm button stays unfocused until the card is
    // gone — the player must not be able to Enter past a screen they cannot see.
    const serial = this._survivalRunSerial;
    const card = this.survivalUi.playTitleCard({
      kicker: SURVIVAL_BRIEFING.kicker,
      title: SURVIVAL_BRIEFING.title,
      timing: SURVIVAL_TITLE,
    });
    this.survivalUi.showBriefing(false);
    card.then(() => {
      // Retry or quit while the card was up leaves this resolution stale.
      if (this._survivalRunSerial !== serial || this.phase !== 'survivalBriefing') return;
      this.survivalUi.focusBriefingAction();
    });
  },

  // "Enter the tide" — the only exit from the briefing into live waves.
  _beginSurvivalWaves() {
    if (this.phase !== 'survivalBriefing' || !this.survival) return false;
    // Belt-and-braces: the title card swallows its own input, so this should
    // never fire beneath it — but starting Wave 1 under a black plate would be
    // invisible and unrecoverable, so refuse rather than trust that.
    if (this.survivalUi.titleCard?.active) return false;
    this.survivalUi.hideBriefing(false);
    this.phase = 'survival';
    this.busy = false;
    // The confirm button can be activated with Space, which is also the combat
    // hop. Drop every briefing-era intent before pointer lock returns.
    this.player.resetInput();
    this.survival.start();
    this.survivalUi.showHud(this.survival.snapshot());
    this.audio.resumeContext();
    this.player.controls.lock();
    return true;
  },

  _openSurvivalUpgrade(draft) {
    if (!this.survival || this.phase === 'survivalDefeat') return;
    this.phase = 'survivalUpgrade';
    this.busy = true;
    this.elCross.classList.remove('active');
    this.pause.releasePointerLock();
    this.survivalUi.showUpgradeDraft(draft);
  },

  _selectSurvivalUpgrade(card) {
    this.survival?.selectUpgrade(card);
  },

  _rerollSurvivalUpgrade(cardIds) {
    this.survival?.reroll(cardIds);
  },

  _closeSurvivalUpgrade() {
    this.survivalUi.hideUpgradeDraft(false);
    this.phase = 'survival';
    this.busy = false;
    // Keyboard activation of a focused card can share Space with the combat
    // hop. Drop every modal-era intent before pointer lock returns.
    this.player.resetInput();
    this.survivalUi.showHud(this.survival.snapshot());
    this.audio.resumeContext();
    this.player.controls.lock();
  },

  // Death. The ledger is NOT awaited behind the cinematic: it is armed here and
  // presented by the frame loop (and by a wall-clock fallback), because the one
  // thing that must never happen is a player stuck on a black screen with no way
  // to retry or leave. An earlier await-chained version did exactly that.
  _showSurvivalDefeat(result) {
    const previousBest = this.survivalSessionBest.snapshot();
    const isSessionBest = previousBest === null ||
      compareSurvivalResults(result, previousBest) > 0;
    const sessionBest = this.survivalSessionBest.record(result);
    this._pendingSurvivalDefeat = {
      result: { ...result, isSessionBest },
      sessionBest,
    };
    this.busy = true;
    this.elCross.classList.remove('active');
    this.survivalUi.hideHud();
    this._startSurvivalFaint();
  },

  // Survival's death cinematic: the campaign's collapse, but it never wakes —
  // there is no respawn, so the camera stays sunken under the ledger and is handed
  // back by _retrySurvival / _teardownSurvivalWorld.
  _startSurvivalFaint() {
    const camPos = this.camera.position.clone();
    this._faintLook ||= new THREE.Vector3();
    this.camera.getWorldDirection(this._faintLook);
    const lookAt = camPos.clone().addScaledVector(this._faintLook, 5);

    this.phase = 'survivalFaint';
    this._survivalFaintRemaining = FAINT.DROOP + SURVIVAL_FAINT.BLACK_HOLD;
    this.viewmodel.group.visible = false;
    this.renderPass.camera = this.faintCutscene.camera;
    // Released once, here: the run is over, so unlike the campaign faint there is
    // no gameplay to return to and the ledger needs the cursor either way. Doing
    // it now also keeps `survivalFaint` a NON-pointer phase, so the unlock cannot
    // be mistaken for the player losing focus and pause the frame loop — which is
    // what froze the cinematic (and the ledger with it) before.
    this.pause.releasePointerLock();
    this.elFaint.classList.add('active');
    this.faintCutscene.play(camPos, lookAt);   // promise intentionally unused

    // Wall-clock safety net, independent of the render loop and of active time:
    // if anything stalls the droop, the ledger still opens.
    clearTimeout(this._survivalDefeatFallback);
    this._survivalDefeatFallback = setTimeout(
      () => this._presentSurvivalDefeat(),
      (this._survivalFaintRemaining + 1.5) * 1000,
    );
  },

  // Idempotent: whichever of the loop or the fallback timer gets here first wins.
  _presentSurvivalDefeat() {
    const pending = this._pendingSurvivalDefeat;
    if (!pending) return false;
    this._pendingSurvivalDefeat = null;
    clearTimeout(this._survivalDefeatFallback);
    this._survivalDefeatFallback = null;

    this.faintCutscene.active = false;   // stop the droop wherever it got to
    this.phase = 'survivalDefeat';
    this.busy = true;
    this.pause.releasePointerLock();
    this.survivalUi.showDefeat(pending.result, pending.sessionBest);
    // Fade the black out from UNDER the ledger (#faint is z-index 22, the modal
    // 40), so the sunken arena settles back into view behind the result.
    this.elFaint.classList.remove('active');
    return true;
  },

  // The death cinematic leaves the view on the cutscene camera on purpose (the
  // ledger reads over the sunken pose). Every route out of the defeat screen must
  // therefore hand the view back to the player camera itself.
  _restoreCameraAfterSurvivalFaint() {
    clearTimeout(this._survivalDefeatFallback);
    this._survivalDefeatFallback = null;
    this._pendingSurvivalDefeat = null;
    this.faintCutscene.active = false;
    this.renderPass.camera = this.camera;
    this.viewmodel.group.visible = true;
    this.elFaint.classList.remove('active');
  },

  _retrySurvival() {
    if (this.phase !== 'survivalDefeat' || !this.world?.zone ||
        this.world.zone.id !== 'survival') return false;
    this.elEndingBlack.classList.add('active');
    this._restoreCameraAfterSurvivalFaint();
    this.survivalUi.hideAll();
    this.audio.stopSurvivalAudio?.();
    this.survival?.dispose();
    this.survival = null;
    this.combat = null;
    this._spawnSurvivalPlayer();
    this._startSurvivalRun();
    this.pause.nextFrame(() => this.elEndingBlack.classList.remove('active'));
    return true;
  },

  _updateSurvival(dt, t) {
    if (!SURVIVAL_PHASES.includes(this.phase)) {
      return false;
    }
    const playerPosition = this.player.controls.getObject().position;
    this.world.update(dt, t, playerPosition);
    if (this.phase === 'survival') {
      if (this.survival?.state !== 'bossStinger') this.player.update(dt);
      this.viewmodel.update(dt, this.player.moving);
      this.survival?.update(dt, t, playerPosition);
    } else if (this.phase === 'survivalFaint') {
      // The cutscene camera owns the view; the run is already aborted, so nothing
      // in the arena can still act on the player while they go down. The ledger is
      // opened from here rather than from a promise — see _showSurvivalDefeat.
      this.faintCutscene.update(dt);
      this._survivalFaintRemaining -= dt;
      if (this._survivalFaintRemaining <= 0) this._presentSurvivalDefeat();
    } else {
      this.viewmodel.update(dt, false);
    }
    this.audio.updateListener(this.camera);
    this._ePressed = false;
    this.composer.render();
    return true;
  },

  _disposeRestoredProvince() {
    if (this._restoredProvinceDisposed) return;
    this.restoredProvince.dispose();
    this._restoredProvinceDisposed = true;
  },

  _teardownSurvivalWorld() {
    document.body.classList.remove('survival-active');
    this._restoreCameraAfterSurvivalFaint();
    this.survivalUi.hideAll();
    this.survival?.dispose();
    this.survival = null;
    this.combat = null;
    this.audio.stopSurvivalAudio?.();
    this.player.disableDash();
    this.player.setJumpEnabled(false);
    this.player.setMovementLocked(false);
    this.player.resetInput();
    this.player.clearExternalMotion();
    if (this.currentZone !== 'survival') return;
    const oldWorld = this.world;
    this.museum.scene.add(this.player.controls.getObject());
    oldWorld?.dispose();
    // Nulled so a later _loadZone cannot double-dispose it (the hub is now a
    // reachable state after Survival, not only the terminal epilogue).
    this.world = null;
  },

  _showEndingCreditsActions() {
    this.elEndingCredits.removeAttribute('inert');
    this.elEndingCredits.setAttribute('aria-hidden', 'false');
    this.elEndingCredits.classList.add('active');
    this.pause.nextFrame(() => {
      if (this.phase === 'endingCredits') this.elEndingReturn?.focus();
    });
  },

  _hideEndingCreditsActions() {
    this.elEndingCredits.setAttribute('inert', '');
    const focused = document.activeElement;
    if (focused && this.elEndingCredits.contains(focused)) focused.blur?.();
    this.elEndingCredits.classList.remove('active');
    this.elEndingCredits.setAttribute('aria-hidden', 'true');
  },

  // Leaving a Survival run. After the ending, Survival's home is the sealed
  // epilogue museum. Before it (the debug unlock), Survival is a side trip, so
  // the ordinary hub is restored instead — forcing epilogue mode there would
  // seal the zone portals of a campaign the player has not finished.
  _returnFromSurvival() {
    if (!SURVIVAL_PHASES.includes(this.phase)) {
      return false;
    }
    if (this.museum.epilogueMode) return this._enterEpilogueMuseum();

    this.elEndingBlack.classList.add('active');
    this._teardownSurvivalWorld();
    restoreGameplayBloom(this);
    this.audio.restoreAfterEnding();
    this.busy = false;
    this._ePressed = false;
    this._enterMuseum();          // owns its own flash, spawn, and pointer lock
    this.pause.nextFrame(() => this.elEndingBlack.classList.remove('active'));
    return true;
  },

  // Shared destination for both ending actions and Survival defeat.
  _enterEpilogueMuseum() {
    const fromSurvival = SURVIVAL_PHASES.includes(this.phase);
    if (!fromSurvival && this.phase !== 'endingCredits') return false;
    this.elEndingBlack.classList.add('active');
    this._hideEndingCreditsActions();
    if (fromSurvival) this._teardownSurvivalWorld();
    else this._disposeRestoredProvince();
    restoreGameplayBloom(this);
    this.audio.restoreAfterEnding();

    this.museum.setHubLighting(true);
    this.museum.populate(this._collectedArtifacts());
    this._syncMuseumSouls();
    this.museum.setEpilogueMode(true);
    this._syncSurvivalPortal();     // the ending has been seen — open the arch
    this.museum.scene.add(this.player.controls.getObject());
    this.renderPass.scene = this.museum.scene;
    this.renderPass.camera = this.camera;
    this.player.setCollider((x, z) => this.museum.collidesAt(x, z, PLAYER_RADIUS));
    this.player.setGroundHeight((x, z) => this.museum.groundHeightAt(x, z));
    const spawn = this.museum.spawnPoint;
    const object = this.player.controls.getObject();
    object.position.set(spawn.x, CONFIG.EYE_HEIGHT, spawn.z);
    this.camera.rotation.set(0, 0, 0);
    this.player.velocity.set(0, 0, 0);
    this.player.eyeBase = 0;
    // Credits and defeat overlays still receive global key events. Clear held
    // movement on both exit routes before the click gesture reacquires lock.
    this.player.resetInput();
    this.player.clearExternalMotion();
    this.viewmodel.group.visible = true;
    this.busy = false;
    this._loadingZone = false;
    this._ePressed = false;
    this.phase = 'museum';
    this.player.controls.lock();
    this.pause.nextFrame(() => this.elEndingBlack.classList.remove('active'));
    return true;
  },
};
