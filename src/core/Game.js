// ============================================================
// GAME — wiring + main loop
// ============================================================
import * as THREE from 'three';
import {
  CONFIG, MUSEUM, GUARDIAN, WORLD_UP, PLAYER_RADIUS, FAINT, ZONE_INTRO,
  ENDING, ARTIFACT_API,
} from '../config.js';
import { ARTIFACT_DATA } from '../data.js';
import { createWorld, ZONES } from './zones/index.js';
import { PlayerController } from './PlayerController.js';
import { ArtifactManager } from './ArtifactManager.js';
import { APIManager } from './APIManager.js';
import { MemoryRift } from './MemoryRift.js';
import { ViewModel } from './ViewModel.js';
import { createGameRenderer, createPostProcessing } from './_partials/GameRendering.js';
import { bindGameUi, wireGameEvents } from './_partials/GameUI.js';
import { GamePauseController } from './_partials/GamePause.js';
import { arenaFlowMethods } from './_partials/ArenaFlow.js';
import { debugZoneFlowMethods } from './_partials/DebugZoneFlow.js';
import { gameGuidanceMethods } from './_partials/GameGuidance.js';
import { AudioManager } from '../audio/AudioManager.js';
import { DiscoveryScreen } from '../ui/DiscoveryScreen.js';
import { JourneyGuide } from '../ui/JourneyGuide.js';
import { Museum } from '../museum/Museum.js';
import { IntroCutscene } from '../cutscene/IntroCutscene.js';
import { GuardianIntroCutscene } from '../cutscene/GuardianIntroCutscene.js';
import { FaintCutscene } from '../cutscene/FaintCutscene.js';
import { FinalPortal, chooseFinalPortalPosition } from '../cutscene/FinalPortal.js';
import { PortalPullCutscene, MuseumEndingCutscene } from '../cutscene/EndingCutscenes.js';
import { RestoredProvince } from '../cutscene/RestoredProvince.js';

const HOLD_TIME = 2.5;          // seconds to hold E to collect an artifact
const HOLD_DRAIN = 1.8;         // progress units/sec lost when you release early
const RING_CIRC = 2 * Math.PI * 34;   // circumference of the r=34 progress ring

export class Game {
  constructor() {
    this.renderer = createGameRenderer();

    this.camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 200);

    this.world = createWorld('zone1');
    this.player = new PlayerController(this.camera, this.renderer.domElement);
    this.world.scene.add(this.player.controls.getObject());
    // Inject the world's collision test so the player slides off solid props.
    this.player.setCollider((x, z, y) => this.world.collidesAt(x, z, PLAYER_RADIUS, y));
    // Inject support-height so the player stands on the dock + climbs the ladder.
    this.player.setGroundHeight((x, z, y) => this.world.groundHeightAt(x, z, y));
    // Per-zone recovered-artifact ids, persisted across zone reloads so a
    // re-entered zone remembers what was already collected (session only — a
    // browser reload restarts progress).
    this.collectedByZone = { zone1: new Set(), zone2: new Set(), zone3: new Set() };
    this.artifacts = new ArtifactManager(this.world.scene, this.world, this.collectedByZone.zone1);
    this.api = new APIManager(ARTIFACT_API.COLLECTION_URL);
    this.viewmodel = new ViewModel(this.camera);   // first-person hand
    this.audio = new AudioManager();
    // Strings v2.0: the main zone hosts a Memory Rift gateway; the Guardian
    // (Feastkeeper) and wave combat live in the instanced arena, constructed on
    // demand in _loadArena. All three are null while in a main zone.
    this.rift = new MemoryRift(this.world.scene, this.world.zone.riftSpot);
    this.guardian = null;   // arena-only
    this.combat = null;     // arena-only
    this.arena = null;      // arena-only
    this.soul = null;       // Guardian Soul dropped in the main zone after a win
    this.debugGallery = null; // debug phase only: three inert Guardian displays
    this.discovery = null;
    this.museum = new Museum();                    // reusable digital-museum scene (hub)
    // (DEBUG_UNLOCK_ALL_ZONES is applied on hub entry — see _enterMuseum — so
    // the intro cutscene still shows zones 2/3 barricaded.)
    this.cutscene = null;
    this.faintCutscene = new FaintCutscene();         // scripted black-out on an arena defeat
    this.guardianIntro = new GuardianIntroCutscene();

    const postProcessing = createPostProcessing(this.renderer, this.world.scene, this.camera);
    this.composer = postProcessing.composer;
    this.renderPass = postProcessing.renderPass;
    this.bloom = postProcessing.bloom;
    this.endingDistortion = postProcessing.endingDistortion;

    this.clock = new THREE.Clock();
    this._gameTime = 0;
    this.phase = 'title';     // title -> cutscene/descend/playing/arena, or direct debug
    this.busy = false;        // true during discovery / riddle / scatter
    this.bossDefeated = false; // true once the arena is cleared & artifacts are loose
    this.collectedSouls = new Set();   // main-zone ids whose Guardian Soul is recovered
    this._returnZone = 'zone1';        // main zone an active arena returns to
    // Zone progression: the hub unlocks the next zone in order on completion.
    this.zoneOrder = ['zone1', 'zone2', 'zone3'];
    this.completed = new Set();   // zone ids the player has finished
    this.endingPlayed = false;    // session guard: global completion can only end once
    this.currentZone = 'zone1';   // the active gameplay zone (built above)
    this.holdKey = false;     // E currently held
    this.holdProgress = 0;    // 0..1 hold-to-collect progress
    bindGameUi(this);
    this.pause = new GamePauseController(this);
    this.journeyGuide = new JourneyGuide(
      (milliseconds) => this.pause.wait(milliseconds),
    );
    this.discovery = new DiscoveryScreen((milliseconds) => this.pause.wait(milliseconds));
    this.cutscene = new IntroCutscene(
      this.museum,
      (callback) => this.pause.nextFrame(callback),
    );
    this.portalCutscene = new PortalPullCutscene();
    this.museumEndingCutscene = new MuseumEndingCutscene(this.museum);
    this.restoredProvince = new RestoredProvince(
      this.elEndingSubtitle, this.elEndingSubtitleEn, this.elEndingSubtitleFil,
    );
    wireGameEvents(this);
    this._syncJourneyGuide(false);

    document.getElementById('loading').style.display = 'none';
    this.elTitle.style.display = 'flex';      // the intro begins at the title screen
    this.animate();
  }

  // Play the intro cutscene over the museum, then reveal the Descend screen.
  async _runIntro() {
    this.elTitle.style.display = 'none';
    this.audio.init();
    this.phase = 'cutscene';
    // Borrow the bloom RenderPass to draw the museum scene/camera.
    this.renderPass.scene = this.museum.scene;
    this.renderPass.camera = this.cutscene.camera;

    await this.cutscene.play();

    // Restore gameplay rendering; reveal the Descend screen as the white fades.
    this.renderPass.scene = this.world.scene;
    this.renderPass.camera = this.camera;
    this._showDescend();
    this.cutscene.flash.style.opacity = '0';
  }

  // Called once the hold-to-collect ring fills.
  async _completeInteract(nearest) {
    if (this.busy) return;
    this.busy = true;
    this.holdProgress = 0;
    this.journeyGuide.setObjective({ mode: 'hidden' }, false);
    this.pause.releasePointerLock();
    await this.discovery.show(nearest.data, this.world.zone.name, () => {
      this.artifacts.collect(nearest);
      void this.api.recordArtifactCollection(nearest.data, this.world.zone.name);
      this.audio.removeEcho(nearest);   // silence this artifact's echo on pickup
    });
    this.busy = false;

    if (this.artifacts.zoneComplete && this.collectedSouls.has(this.currentZone)) {
      this._zoneComplete();             // memories + this zone's Soul are safely recovered
    } else {
      this._syncJourneyGuide();
      this.player.controls.lock();      // keep collecting memories / recover the Soul
    }
  }

  // Re-show a collected artifact's discovery card in the museum so the player can
  // re-read it. No onSaved callback — nothing is collected; it's view-only. Mirrors
  // _completeInteract's unlock → show → re-lock idiom.
  async _viewArtifact(data) {
    if (this.busy) return;
    this.busy = true;
    this.elPrompt.classList.remove('active');
    this.journeyGuide.setObjective({ mode: 'hidden' }, false);
    this.pause.releasePointerLock();
    // In the museum this.world is the hub, so derive provenance from the
    // artifact's own zone number via the zone registry.
    const zoneName = ZONES['zone' + data.zone]?.name;
    await this.discovery.show(data, zoneName);   // no onSaved — view-only
    this.busy = false;
    this._syncJourneyGuide();
    this.player.controls.lock();
  }

  // Recovered artifact-data objects grouped by zone number ({ 1: [...], ... }),
  // each zone's list in stable ARTIFACT_DATA order so museum frames keep
  // consistent slots within their zone section as more arrive.
  _collectedArtifacts() {
    const ids = new Set();
    for (const set of Object.values(this.collectedByZone)) for (const id of set) ids.add(id);
    const byZone = {};
    for (const d of ARTIFACT_DATA) {
      if (!ids.has(d.id)) continue;
      (byZone[d.zone] ||= []).push(d);
    }
    return byZone;
  }

  // Guardian Soul collected (walk-over). The zone only closes once its artifacts
  // are also home, preventing the completion card from abandoning a missed Soul.
  _collectSoul(zone) {
    this.collectedSouls.add(zone);
    this.soul = null;
    this.audio.playWaveClear();
    this._syncJourneyGuide();
    if (this.phase === 'playing' && this.artifacts.zoneComplete) this._zoneComplete();
  }

  _syncMuseumSouls() {
    for (const zone of this.collectedSouls) this.museum.placeSoul(zone);
  }

  _updatePedestalHold(dt, canActivate) {
    if (canActivate && this.holdKey && this.player.controls.isLocked) {
      this.holdProgress = Math.min(1, this.holdProgress + dt / HOLD_TIME);
      if (this.holdProgress >= 1) this._runEnding();
    } else {
      this.holdProgress = Math.max(0, this.holdProgress - dt * HOLD_DRAIN);
    }
    this.viewmodel.setReach(this.holdProgress);
    this.elRing.style.strokeDashoffset = (RING_CIRC * (1 - this.holdProgress)).toFixed(1);
    this.elRingWrap.classList.toggle('active', this.holdProgress > 0.001);
  }

  // The shared faint cinematic: camera droop under a black fade, unconscious
  // hold, respawn, fade back in. `respawn` places the player on waking (defaults
  // to the dock; the arena passes its center). Used by the arena defeat.
  async _faintOnly(respawn = () => this._spawnAtDock()) {
    // Frame the droop with the cutscene camera and fade to black. Re-lock NOW
    // (any prior activation still valid; a no-op if already locked) and hold it
    // through the cinematic so mouse-look is retained on waking — locking after
    // the async gap would silently fail and trap the player.
    const camPos = this.camera.position.clone();
    this._faintLook ||= new THREE.Vector3();
    this.camera.getWorldDirection(this._faintLook);
    const lookAt = camPos.clone().addScaledVector(this._faintLook, 5);

    this.phase = 'faint';
    this._syncJourneyGuide(false);
    this.elCross.classList.remove('active');
    this.viewmodel.group.visible = false;
    this.renderPass.camera = this.faintCutscene.camera;
    this.player.controls.lock();
    this.elFaint.classList.add('active');             // CSS fades to black

    await this.faintCutscene.play(camPos, lookAt);
    await this.pause.wait(FAINT.BLACK_HOLD * 1000);   // unconscious in the dark

    // Wake at the respawn point (under the black), then fade back in.
    respawn();
    this._levelCamera();
    this.renderPass.camera = this.camera;
    this.viewmodel.group.visible = true;
    this.elFaint.classList.remove('active');          // CSS fades from black
  }

  // Place the player on the raised dock spawn (south edge), facing north, at rest.
  // Shared by zone entry (_loadZone) and the faint respawn.
  _spawnAtDock() {
    const obj = this.player.controls.getObject();
    obj.position.set(0, CONFIG.DOCK_TOP + CONFIG.EYE_HEIGHT, 35);
    this.camera.rotation.set(0, 0, 0);
    this.player.velocity.set(0, 0, 0);
    this.player.eyeBase = CONFIG.DOCK_TOP;
  }

  // Reset the player camera to a level gaze (no up/down tilt or roll) while
  // preserving the current facing direction. Used to hand control back cleanly.
  _levelCamera() {
    this._lvlEuler ||= new THREE.Euler(0, 0, 0, 'YXZ');
    this._lvlEuler.setFromQuaternion(this.camera.quaternion, 'YXZ');
    this._lvlEuler.x = 0;
    this._lvlEuler.z = 0;
    this.camera.quaternion.setFromEuler(this._lvlEuler);
  }

  // Build/drain the hold meter; updates the ring and the hand's reach.
  _updateHold(dt) {
    const near = this._proximity.nearest;
    const inRange = !this.busy && this.player.controls.isLocked &&
                    near && this._proximity.nearestDist <= CONFIG.INTERACT_RANGE;

    // v2: main-zone collection is purely peaceful (the challenge lived in the
    // arena), so holding E always reaches for the artifact.
    if (this.holdKey && inRange) {
      this.holdProgress = Math.min(1, this.holdProgress + dt / HOLD_TIME);
      if (this.holdProgress >= 1) this._completeInteract(near);
    } else {
      this.holdProgress = Math.max(0, this.holdProgress - dt * HOLD_DRAIN);
    }

    this.viewmodel.setReach(this.holdProgress);
    this.elRing.style.strokeDashoffset = (RING_CIRC * (1 - this.holdProgress)).toFixed(1);
    this.elRingWrap.classList.toggle('active', this.holdProgress > 0.001);
    return inRange;
  }

  // Swap the interaction-prompt copy only when it actually changes (the loop
  // calls this every frame; setting innerHTML unconditionally would reparse the
  // node each frame — against this project's no-per-frame-churn convention).
  _setPrompt(html) {
    if (this._promptHtml === html) return;
    this._promptHtml = html;
    this.elPrompt.innerHTML = html;
    if (html.includes('<b>E</b>')) this.journeyGuide.showControl('interact');
  }

  // Show the Descend screen for the currently-built zone: label it with the
  // active zone and reveal the overlay. Used both after the intro and on every
  // zone entry from the hub, so the player always reads which zone they're
  // dropping into and clicks to descend (the click gesture re-locks the pointer).
  _showDescend() {
    this.phase = 'descend';
    this.elStartZone.textContent = this.world.zone.label;
    this.elStart.style.display = 'flex';
  }

  // Enter the active main-zone "playing" phase. Before the arena is cleared the
  // objective is to find the Memory Rift; after, the artifact counter shows while
  // the scattered memories (and the Guardian Soul) are gathered.
  _startGameplayPhase() {
    this.phase = 'playing';
    // Clear the load latch here — the single gate every entry path (descend,
    // hub swap, arena return) passes through — so Rift entry (_enterArena, which
    // guards on _loadingZone) is never left blocked after a hub-entered zone.
    this._loadingZone = false;
    this.elCross.classList.add('active');
    this._syncJourneyGuide();
    this._queueExplorationGuidance();
  }

  // Play the active zone's intro dialogue as a subtitle, one line at a time, over
  // live gameplay (non-blocking — the player can wade while it reads). The token
  // guard cancels a still-running intro if the player leaves/re-enters a zone.
  async _playZoneIntro() {
    const lines = this.world.zone.introDialogue;
    if (!lines || !lines.length) return;
    const token = (this._introToken = (this._introToken || 0) + 1);
    for (const line of lines) {
      if (token !== this._introToken) return;        // superseded by a newer entry
      this.elZintro.textContent = line;
      this.elZintro.classList.add('active');
      await this.pause.wait(ZONE_INTRO.LINE * 1000);
      this.elZintro.classList.remove('active');
      await this.pause.wait(ZONE_INTRO.GAP * 1000);  // fade out before the next line
    }
  }

  // All three Guardian Souls have been seated at the museum altar. This async director performs scene swaps
  // while a black/white overlay fully covers them; per-frame animation remains
  // in animate() so the normal renderer/composer owns every frame.
  async _runEnding() {
    if (this.endingPlayed || !this.museum.allSoulsPlaced) return;
    this._endingFromMuseum = this.phase === 'museum';
    this.endingPlayed = true;
    this.busy = true;
    this.phase = 'endingPortal';
    this._syncJourneyGuide();
    this._introToken = (this._introToken || 0) + 1;
    this.holdKey = false;
    this.holdProgress = 0;
    this.elPrompt.classList.remove('active');
    this.elCross.classList.remove('active');
    this.elRingWrap.classList.remove('active');
    this.player.elStaminaWrap.classList.remove('active');
    this.viewmodel.group.visible = false;
    if (this.player.controls.isLocked) this.pause.releasePointerLock();

    // Swap to the gentler ending bloom for every beat of the finale; the
    // gameplay values return with the epilogue museum.
    this._gameplayBloom = {
      strength: this.bloom.strength, radius: this.bloom.radius, threshold: this.bloom.threshold,
    };
    this.bloom.strength = ENDING.BLOOM.STRENGTH;
    this.bloom.radius = ENDING.BLOOM.RADIUS;
    this.bloom.threshold = ENDING.BLOOM.THRESHOLD;

    const start = this.camera.getWorldPosition(new THREE.Vector3());
    const forward = this.camera.getWorldDirection(new THREE.Vector3());
    const portalWorld = this._endingFromMuseum ? this.museum : this.world;
    const portalPos = chooseFinalPortalPosition(portalWorld, start, forward);
    this.finalPortal = new FinalPortal(portalWorld.scene, portalPos, start);
    this.renderPass.camera = this.portalCutscene.camera;
    this.endingDistortion.enabled = true;
    this.audio.playPortalCharge();
    await this.portalCutscene.play(start, forward, portalPos);

    this.audio.playPortalImpact();
    this.elFlash.style.transition = 'none';
    this.elFlash.style.opacity = '1';
    void this.elFlash.offsetHeight;
    this.elFlash.style.transition = '';
    await this.pause.wait(420);
    this.elEndingBlack.classList.add('active');
    await this.pause.wait(1450);
    this.elFlash.style.opacity = '0';
    this.endingDistortion.enabled = false;
    this.endingDistortion.uniforms.uAmount.value = 0;

    // Re-parent the player before freeing the old zone, as with normal zone swaps.
    this.finalPortal.dispose();
    this.finalPortal = null;
    this._disposeArenaEntities();               // arena guardian/combat (if any)
    if (this.rift) { this.rift.dispose(); this.rift = null; }
    if (this.soul) { this.soul.dispose(); this.soul = null; }
    this.audio.fadeUnderwater(2.2);
    this.museum.scene.add(this.player.controls.getObject());
    const oldWorld = this.world;
    oldWorld.dispose();

    this.museum.unlockPortal(2);
    this.museum.unlockPortal(3);
    this.museum.setHubLighting(true);
    this.museum.populate(this._collectedArtifacts());
    this._syncMuseumSouls();
    this.phase = 'endingMuseum';
    this.renderPass.scene = this.museum.scene;
    this.renderPass.camera = this.museumEndingCutscene.camera;
    const museumPlay = this.museumEndingCutscene.play();
    this.pause.nextFrame(() => this.elEndingBlack.classList.remove('active'));
    await museumPlay;
    this.elEndingBlack.classList.add('active');
    await this.pause.wait(1450);

    this.phase = 'endingRestored';
    this.renderPass.scene = this.restoredProvince.scene;
    this.renderPass.camera = this.restoredProvince.camera;
    this.audio.startDryAmbience();
    this.audio.playEndingVoiceover();
    const restoredPlay = this.restoredProvince.play();
    this.pause.nextFrame(() => this.elEndingBlack.classList.remove('active'));
    await restoredPlay;

    this.elEndingBlack.classList.add('active');
    await this.pause.wait(1450);
    this.phase = 'endingCredits';
    this.elEndingCredits.classList.add('active');
  }

  // Credits button destination: a peaceful, fully populated museum with solid
  // portal boundaries. The button click itself supplies the pointer-lock gesture.
  _enterEpilogueMuseum() {
    this.elEndingBlack.classList.add('active');
    this.elEndingCredits.classList.remove('active');
    this.restoredProvince.dispose();
    if (this._gameplayBloom) {
      this.bloom.strength = this._gameplayBloom.strength;
      this.bloom.radius = this._gameplayBloom.radius;
      this.bloom.threshold = this._gameplayBloom.threshold;
      this._gameplayBloom = null;
    }
    this.audio.restoreAfterEnding();
    this.museum.setHubLighting(true);
    this.museum.populate(this._collectedArtifacts());
    this._syncMuseumSouls();
    this.museum.setEpilogueMode(true);
    this.museum.scene.add(this.player.controls.getObject());
    this.renderPass.scene = this.museum.scene;
    this.renderPass.camera = this.camera;
    this.player.setCollider((x, z) => this.museum.collidesAt(x, z, PLAYER_RADIUS));
    this.player.setGroundHeight((x, z) => this.museum.groundHeightAt(x, z));
    const sp = this.museum.spawnPoint;
    const obj = this.player.controls.getObject();
    obj.position.set(sp.x, CONFIG.EYE_HEIGHT, sp.z);
    this.camera.rotation.set(0, 0, 0);
    this.player.velocity.set(0, 0, 0);
    this.player.eyeBase = 0;
    this.viewmodel.group.visible = true;
    this.busy = false;
    this._loadingZone = false;
    this._ePressed = false;
    this.phase = 'museum';
    this.player.controls.lock();
    this.pause.nextFrame(() => this.elEndingBlack.classList.remove('active'));
  }

  _zoneComplete() {
    this.phase = 'complete';      // the card is up; controls already unlocked by discovery
    if (this.player.controls.isLocked) this.pause.releasePointerLock();
    // Record this zone as done and open the next portal in the hub (sequential unlock).
    this.completed.add(this.currentZone);
    const next = this.zoneOrder[this.zoneOrder.indexOf(this.currentZone) + 1];
    if (next) this.museum.unlockPortal(Number(next.slice(4)));   // 'zone2' -> 2
    // Full-zone copy on the shared completion card.
    this.elZcTitle.textContent = `${this.currentZone.toUpperCase().replace('ZONE', 'ZONE ')} COMPLETE`;
    this.elZcQuote.textContent = '"Hindi natin malilimutan ang isang bagay na ating minahal."';
    this.elZcTrans.textContent = '(We cannot forget something we have loved.)';
    this.elZcEnter.textContent = 'Return to your Museum';
    this._syncJourneyGuide();
    this._showCompletionCard();
  }

  // Shared reveal for the zone completion card (controls already unlocked by the
  // discovery flow).
  _showCompletionCard() {
    this.elCross.classList.remove('active');
    this.elPrompt.classList.remove('active');
    this.elZoneDone.classList.add('active');
  }

  // Jump from the title straight into the walkable museum hub, skipping the intro
  // cutscene and Zone 1 gameplay. Runs inside the button-click gesture so the
  // pointer-lock in _enterMuseum is honored.
  _skipToMuseum() {
    this.audio.init();
    this.elTitle.style.display = 'none';
    this.museum.setHallLit(true);     // light the open Zone 1 portal (the intro would have)
    this._enterMuseum();
  }

  // Development shortcut from the title menu. Seed all memories + Souls, then
  // enter the real hub so the 3/3 pedestal hold remains part of the test path.
  _testEnding() {
    if (this.endingPlayed) return;
    for (const data of ARTIFACT_DATA) {
      const zoneId = `zone${data.zone}`;
      (this.collectedByZone[zoneId] ||= new Set()).add(data.id);
    }
    for (const zone of this.zoneOrder) this.collectedSouls.add(zone);
    this._skipToMuseum();
  }

  // Return to the now-finished museum, walkable. Runs synchronously inside the
  // card-click gesture so controls.lock() is honored. White covers the cut.
  _enterMuseum() {
    this.phase = 'museum';
    this._loadingZone = false;   // re-arm hub portal entry detection
    // Drop any E rising-edge left over from gameplay (only the museum loop ever
    // consumes _ePressed) so a nearby frame can't auto-open its discovery card.
    this._ePressed = false;

    // Debug: open every portal so the hub's sequential unlock (see _zoneComplete)
    // can be skipped while testing zone content. Applied here — not at construction
    // — so the intro cutscene still plays over a museum with zones 2/3 barricaded.
    // unlockPortal is idempotent, so re-running this on every hub entry is safe.
    if (CONFIG.DEBUG_UNLOCK_ALL_ZONES) { this.museum.unlockPortal(2); this.museum.unlockPortal(3); }

    // Snap white up to hide the swap, then ease it away (same idiom as the intro).
    this.elFlash.style.transition = 'none';
    this.elFlash.style.opacity = '1';
    void this.elFlash.offsetHeight;
    this.elFlash.style.transition = '';

    // The gallery now holds the player's recovered memories — light it up and
    // hang each collected artifact's artwork in a frame. populate() skips
    // already-filled slots, so calling it on every museum entry just adds the
    // newly recovered pieces (idempotent).
    this.museum.setHubLighting(true);
    this.museum.populate(this._collectedArtifacts());
    this._syncMuseumSouls();
    this._syncJourneyGuide();

    // Move the player (camera + its hand mesh) into the museum scene so its world
    // matrix updates when we render museum.scene, and point physics at the museum.
    this.museum.scene.add(this.player.controls.getObject());
    this.renderPass.scene = this.museum.scene;
    this.renderPass.camera = this.camera;
    this.player.setCollider((x, z) => this.museum.collidesAt(x, z, PLAYER_RADIUS));
    this.player.setGroundHeight((x, z) => this.museum.groundHeightAt(x, z));

    // Spawn at the museum's anchor, facing the hallway (-Z), at rest.
    const sp = this.museum.spawnPoint;
    const obj = this.player.controls.getObject();
    obj.position.set(sp.x, CONFIG.EYE_HEIGHT, sp.z);
    this.camera.rotation.set(0, 0, 0);
    this.player.velocity.set(0, 0, 0);
    this.player.eyeBase = 0;
    this.holdKey = false;
    this.holdProgress = 0;
    this.viewmodel.setReach(0);
    this.elRingWrap.classList.remove('active');

    this.elZoneDone.classList.remove('active');
    this.player.controls.lock();
    this.pause.nextFrame(() => { this.elFlash.style.opacity = '0'; });
  }

  // From the hub: flash white to hide the swap, then build + enter the chosen zone.
  // Runs inside the museum-loop frame; the flash mirrors _enterMuseum's idiom.
  _enterZoneFromHub(zoneId) {
    this._loadingZone = true;
    this.elFlash.style.transition = 'none';
    this.elFlash.style.opacity = '1';
    void this.elFlash.offsetHeight;
    this.elFlash.style.transition = '';
    this._loadZone(zoneId);
    this.pause.nextFrame(() => { this.elFlash.style.opacity = '0'; });
  }

  // Tear down the current zone and build a fresh main zone in its place: re-parent
  // the player rig, re-wire physics + rendering, rebuild the artifact + Rift
  // subsystems, reset the loop state, and pause on the Descend screen at the dock.
  // Used both for first-time zone entry from the hub and re-entering a finished one.
  _loadZone(zoneId) {
    // Tear down the outgoing zone — arena entities + Rift first so their meshes
    // leave the scene before the world's disposal walks it.
    this._disposeArenaEntities();
    if (this.rift) { this.rift.dispose(); this.rift = null; }
    if (this.soul) { this.soul.dispose(); this.soul = null; }
    const oldWorld = this.world;

    this.world = createWorld(zoneId);
    this.currentZone = zoneId;

    // Move the player rig into the new scene (this detaches it from the old one),
    // then free the old world's GPU resources.
    this.world.scene.add(this.player.controls.getObject());
    oldWorld.dispose();

    // Re-wire physics + rendering at the new world.
    this.player.setCollider((x, z, y) => this.world.collidesAt(x, z, PLAYER_RADIUS, y));
    this.player.setGroundHeight((x, z, y) => this.world.groundHeightAt(x, z, y));
    this.player.setMovementLocked(false);
    this.renderPass.scene = this.world.scene;
    this.renderPass.camera = this.camera;

    // Fresh subsystems on the new scene: the artifact manager (persistent
    // per-zone collected-set carries prior visits' progress) and the Memory Rift
    // gateway. The Guardian + combat are built later, in the arena (_loadArena).
    this.collectedByZone[zoneId] ||= new Set();
    this.artifacts = new ArtifactManager(this.world.scene, this.world, this.collectedByZone[zoneId]);
    this.rift = new MemoryRift(this.world.scene, this.world.zone.riftSpot);
    this.audio.clearEchoes();   // drop the old zone's echoes; new ones register on return

    // Reset the gameplay state machine.
    this.bossDefeated = false;
    this.busy = false;
    this.holdKey = false;
    this.holdProgress = 0;
    this._ePressed = false;
    this._proximity = null;

    // Leave the hub lighting behind and spawn on the dock like Zone 1.
    this.museum.setHubLighting(false);
    this._spawnAtDock();

    // Always pause on the Descend screen for the active zone (first entry and
    // replays alike). Coming from the hub the player is pointer-locked, so unlock
    // to surface the overlay; the descend click re-locks and starts gameplay.
    this._showDescend();
    this._syncJourneyGuide();
    if (this.player.controls.isLocked) this.pause.releasePointerLock();
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (this.pause.isPaused) {
      this.composer.render();
      return;
    }
    this._gameTime += dt;
    const t = this._gameTime;

    // Intro cutscene owns the camera; skip all gameplay/input until it ends.
    if (this.phase === 'cutscene') {
      this.museum.update(dt, t);
      this.cutscene.update(dt);
      this.composer.render();
      return;
    }

    if (this.phase === 'endingPortal') {
      this.portalCutscene.update(dt);
      if (this.finalPortal) {
        this.finalPortal.update(dt, t, this.portalCutscene.appearProgress);
        if (this._endingFromMuseum) {
          this.museum.update(dt, t);
        } else {
          this.world.update(dt, t, this.portalCutscene.camera.position);
          if (this.guardian) this.guardian.update(dt, t, this.portalCutscene.camera.position);
        }
      }
      // Move Hil's rig with the cinematic camera even though the dedicated
      // cutscene camera is what is rendered.
      this.player.controls.getObject().position.copy(this.portalCutscene.camera.position);
      this.endingDistortion.uniforms.uAmount.value = this.portalCutscene.distortion;
      this.endingDistortion.uniforms.uTime.value = t;
      this.composer.render();
      return;
    }

    if (this.phase === 'endingMuseum') {
      this.museum.update(dt, t);
      this.museumEndingCutscene.update(dt);
      this.composer.render();
      return;
    }

    if (this.phase === 'endingRestored') {
      this.restoredProvince.update(dt);
      this.composer.render();
      return;
    }

    if (this.phase === 'endingCredits') {
      this.composer.render();
      return;
    }

    // Walkable museum hub: free-roam between zones. Walking into an unlocked
    // portal's corridor loads that zone; locked corridors are sealed off.
    if (this.phase === 'museum') {
      if (!this.busy) this.player.update(dt);
      this.viewmodel.update(dt, !this.busy && this.player.moving);
      this.museum.update(dt, t);
      if (!this.busy && !this._loadingZone) {
        const pos = this.player.controls.getObject().position;
        let entered = false;
        for (const p of this.museum.epilogueMode ? [] : this.museum.portals) {
          if (!p.locked && p.entry && pos.distanceTo(p.entry) < MUSEUM.EXIT_RADIUS) {
            this._enterZoneFromHub('zone' + p.zone);
            entered = true;
            break;
          }
        }
        // The altar takes interaction priority over nearby frames. Recovered
        // Souls are seated automatically on hub entry; 3/3 enables the hold-E
        // ritual that begins the existing Final Memory sequence.
        if (!entered) {
          const nearAltar = this.museum.soulPedestalDistance(pos) <= MUSEUM.SOUL_ALTAR.ACTIVATE_RANGE;
          if (nearAltar) {
            this.museum.clearAim();
            const ready = this.museum.allSoulsPlaced;
            this._setPrompt(ready
              ? 'Hold <b>E</b> to awaken the Final Memory'
              : `Guardian Souls: ${this.museum.placedSoulCount} / 3`);
            this.elPrompt.classList.add('active');
            this._updatePedestalHold(dt, ready);
          } else {
            this._updatePedestalHold(dt, false);
            const aimed = this.player.controls.isLocked
              ? this.museum.aimedArtifact(this.camera, CONFIG.INTERACT_RANGE) : null;
            if (!this.player.controls.isLocked) this.museum.clearAim();
            if (aimed) {
              this._setPrompt('Press <b>E</b> to revisit this memory');
              this.elPrompt.classList.add('active');
              if (this._ePressed) this._viewArtifact(aimed.data);
            } else {
              this.elPrompt.classList.remove('active');
            }
          }
        } else {
          this.museum.clearAim();
          this._updatePedestalHold(dt, false);
        }
      }
      this._ePressed = false;   // consume the tap (rising edge set in keydown)
      this.composer.render();
      return;
    }

    // Developer-only Guardian showroom: free-roam inspection with no objective,
    // combat, interaction, teleport, or progression systems active.
    if (this.phase === 'debug') {
      const playerPos = this.player.controls.getObject().position;
      this.world.update(dt, t, playerPos);
      this.player.update(dt);
      this.viewmodel.update(dt, this.player.moving);
      this.debugGallery.update(dt, t);
      this.audio.updateListener(this.camera);
      this._ePressed = false;
      this.composer.render();
      return;
    }

    // Memory Arena: the reused combat core runs the fight, the ArenaController
    // runs the riddle rounds + armor, and winning flips arena.won → collapse +
    // return to the main zone. Firing is via the mousedown → combat.requestFire.
    if (this.phase === 'arena') {
      const playerPos = this.player.controls.getObject().position;
      if (this.guardianIntro.active) {
        this.world.update(dt, t, this.guardianIntro.camera.position);
        const facingTarget = this._guardianIntroFacingTarget || playerPos;
        if (this.guardian) this.guardian.update(dt, t, facingTarget);
        this.arena?.updateGuardianIntro?.(dt, t, facingTarget);
        this.guardianIntro.update(dt);
        this.audio.updateListener(this.guardianIntro.camera);
        this._ePressed = false;
        this.composer.render();
        return;
      }
      this.world.update(dt, t, playerPos);
      if (!this.busy) this.player.update(dt);
      this.viewmodel.update(dt, !this.busy && this.player.moving);
      if (this.guardian) this.guardian.update(dt, t, playerPos);   // Feastkeeper idle/face
      if (this.combat) this.combat.update(dt, t, playerPos);
      if (this.combat && this.combat.consumePlayerDeath()) {
        this._arenaFaint(); this.composer.render(); return;
      }
      if (this.arena && !this.busy) {
        this.arena.update(dt, t, playerPos);
        if (this.arena.consumeFailure?.()) {
          this._arenaFaint(); this.composer.render(); return;
        }
        if (this.arena.consumeGuardianIntroRequest?.()) {
          this._runGuardianIntroduction(this.currentZone);
          this.composer.render();
          return;
        }
        if (this.arena.won) this._returnFromArena();
      }
      this.audio.updateListener(this.camera);
      this._ePressed = false;
      this.composer.render();
      return;
    }

    // Faint cinematic owns the camera; the world/guardian keep updating so the
    // guardian's poof plays out under the scripted droop (no artifacts here).
    if (this.phase === 'faint') {
      this.world.update(dt, t, this.faintCutscene.camera.position);
      if (this.guardian) this.guardian.update(dt, t, this.faintCutscene.camera.position);
      this.faintCutscene.update(dt);
      this.composer.render();
      return;
    }

    this.world.update(dt, t, this.player.controls.getObject().position);
    if (!this.busy) this.player.update(dt);
    this.viewmodel.update(dt, !this.busy && this.player.moving);

    const playerPos = this.player.controls.getObject().position;

    // Before the arena is cleared: wade to the Memory Rift and tap E to enter it.
    if (!this.bossDefeated) {
      if (this.rift) this.rift.update(dt, t);
      const rdist = this.rift ? playerPos.distanceTo(this.rift.center()) : Infinity;
      const inRange = !this.busy && this.player.controls.isLocked &&
                      rdist <= GUARDIAN.ENCOUNTER_RANGE;
      if (inRange) {
        this._setPrompt('Press <b>E</b> to enter the Memory Rift');
        this.elPrompt.classList.add('active');
        if (this._ePressed) this._enterArena(this.world.zone.arenaId || 'arena1');
      } else {
        this.elPrompt.classList.remove('active');
      }
      this._ePressed = false;   // consume the tap each frame
      this.composer.render();
      return;
    }

    // After the arena: the artifacts (and the Guardian Soul) are loose for
    // peaceful collection. Held point ~1.0m ahead + low in VIEW space so the
    // string anchors near the bottom of the screen at any pitch.
    this._gather ||= new THREE.Vector3();
    this._camDir ||= new THREE.Vector3();
    this._camRight ||= new THREE.Vector3();
    this._camUp ||= new THREE.Vector3();
    this.camera.getWorldDirection(this._camDir);
    this._camRight.crossVectors(this._camDir, WORLD_UP).normalize();
    this._camUp.crossVectors(this._camRight, this._camDir).normalize();
    this._gather.copy(playerPos)
      .addScaledVector(this._camDir, 1.0)
      .addScaledVector(this._camUp, -0.5);

    this._proximity = this.artifacts.update(dt, t, playerPos, this._gather, this._camRight, this._camUp);
    this.audio.setProximity(this._proximity.nearestDist);
    this.audio.updateListener(this.camera);             // orient spatial echoes + tick pings
    this.audio.setSwell(this._proximity.nearestDist);   // theme swells near a find

    // Guardian Soul: a walk-over collectible dropped on the arena return.
    if (this.soul && !this.busy) this.soul.update(dt, t, playerPos);

    const inRange = this._updateHold(dt);
    this._setPrompt('Hold <b>E</b> to reach toward it');
    this.elPrompt.classList.toggle('active', inRange && this.holdProgress < 0.02);

    this.composer.render();
  }
}

Object.assign(Game.prototype, arenaFlowMethods);
Object.assign(Game.prototype, debugZoneFlowMethods);
Object.assign(Game.prototype, gameGuidanceMethods);
