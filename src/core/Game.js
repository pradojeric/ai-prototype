// ============================================================
// GAME — wiring + main loop
// ============================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {
  CONFIG, MUSEUM, GUARDIAN, WORLD_UP, PLAYER_RADIUS,
  RIDDLE_COUNT, mulberry32, wait,
} from '../config.js';
import { drawRiddles } from '../data.js';
import { createWorld } from './zones/index.js';
import { PlayerController } from './PlayerController.js';
import { ArtifactManager } from './ArtifactManager.js';
import { Guardian } from './Guardian.js';
import { ViewModel } from './ViewModel.js';
import { AudioManager } from '../audio/AudioManager.js';
import { DiscoveryScreen } from '../ui/DiscoveryScreen.js';
import { RiddleScreen } from '../ui/RiddleScreen.js';
import { Museum } from '../museum/Museum.js';
import { IntroCutscene } from '../cutscene/IntroCutscene.js';
import { DefeatCutscene } from '../cutscene/DefeatCutscene.js';

const HOLD_TIME = 2.5;          // seconds to hold E to collect an artifact
const HOLD_DRAIN = 1.8;         // progress units/sec lost when you release early
const RING_CIRC = 2 * Math.PI * 34;   // circumference of the r=34 progress ring

export class Game {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    // ACES tone mapping rolls the >1 emissive values (string glow, hub bulbs at
    // intensity up to 7) into the bloom gracefully instead of hard-clipping to
    // white. Applied at the OutputPass below. outputColorSpace stays the sRGB
    // default. Switch to THREE.NoToneMapping to revert to the un-mapped look.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    document.body.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 200);

    this.world = createWorld('zone1');
    this.player = new PlayerController(this.camera, this.renderer.domElement);
    this.world.scene.add(this.player.controls.getObject());
    // Inject the world's collision test so the player slides off solid props.
    this.player.setCollider((x, z) => this.world.collidesAt(x, z, PLAYER_RADIUS));
    // Inject support-height so the player stands on the dock + climbs the ladder.
    this.player.setGroundHeight((x, z) => this.world.groundHeightAt(x, z));
    this.artifacts = new ArtifactManager(this.world.scene, this.world);
    this.guardian = new Guardian(this.world.scene, this.world, this.world.zone.id); // riddle gate
    this.viewmodel = new ViewModel(this.camera);   // first-person hand
    this.audio = new AudioManager();
    this.discovery = new DiscoveryScreen();
    this.riddleScreen = new RiddleScreen();        // bugtong multiple-choice
    this.museum = new Museum();                    // reusable digital-museum scene (future hub)
    this.cutscene = new IntroCutscene(this.museum); // scripted intro over the museum
    this.defeatCutscene = new DefeatCutscene();      // scripted guardian-defeat over the world

    // post-processing: bloom for the string glow. We keep the RenderPass so the
    // intro cutscene can borrow it to render the museum scene/camera.
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.world.scene, this.camera);
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.8, 0.6, 0.2);
    this.composer.addPass(this.bloom);
    // Final pass: apply tone mapping + linear->sRGB encoding. With a composer
    // the renderer's automatic output conversion is bypassed, so this is what
    // gets the colors onto the canvas correctly (replaces the old GammaCorrection
    // pass). Must be last so bloom composites in linear space first.
    this.composer.addPass(new OutputPass());

    this.clock = new THREE.Clock();
    this.phase = 'title';     // title -> cutscene -> descend -> playing
    this.busy = false;        // true during discovery / riddle / scatter
    this.bossDefeated = false; // gates artifacts behind the guardian's riddles
    // Zone progression: the hub unlocks the next zone in order on completion.
    this.zoneOrder = ['zone1', 'zone2', 'zone3'];
    this.completed = new Set();   // zone ids the player has finished
    this.currentZone = 'zone1';   // the active gameplay zone (built above)
    this.holdKey = false;     // E currently held
    this.holdProgress = 0;    // 0..1 hold-to-collect progress
    this._ui();
    this._events();

    document.getElementById('loading').style.display = 'none';
    this.elTitle.style.display = 'flex';      // the intro begins at the title screen
    this.animate();
  }

  _ui() {
    this.elFound = document.getElementById('found');
    this.elHud = document.getElementById('hud');
    this.elGhint = document.getElementById('ghint');
    this.elPrompt = document.getElementById('prompt');
    this.elCross = document.getElementById('crosshair');
    this.elTitle = document.getElementById('title');
    this.elStart = document.getElementById('start');
    this.elStartZone = document.getElementById('start-zone');   // descend-screen zone heading
    this.elResume = document.getElementById('resume');
    this.elFlash = document.getElementById('flash');
    this.elZoneDone = document.getElementById('zonecomplete');
    this.elSkipMuseum = document.getElementById('skipmuseum');
    this.elRingWrap = document.getElementById('holdring');
    this.elRing = this.elRingWrap.querySelector('.prog');
  }

  _events() {
    // Title -> play the intro cutscene -> reveal the Descend screen.
    // stopPropagation so this same click doesn't reach the skip handler below.
    this.elTitle.addEventListener('click', (e) => { e.stopPropagation(); this._runIntro(); });
    // Skip the intro + gameplay and drop straight into the walkable museum hub.
    this.elSkipMuseum.addEventListener('click', (e) => { e.stopPropagation(); this._skipToMuseum(); });
    // A click during the cutscene skips to the white fade.
    addEventListener('click', () => { if (this.phase === 'cutscene') this.cutscene.skip(); });

    this.elStart.addEventListener('click', () => {
      this.audio.init();
      this.player.controls.lock();
    });
    // Zone complete -> walk the finished gallery; resume re-locks after ESC.
    this.elZoneDone.addEventListener('click', () => { if (this.phase === 'complete') this._enterMuseum(); });
    this.elResume.addEventListener('click', () => { if (this.phase === 'museum') this.player.controls.lock(); });
    this.player.controls.addEventListener('lock', () => {
      this.elStart.style.display = 'none';
      this.elResume.style.display = 'none';
      // The defeat cinematic re-locks mid-sequence and manages its own UI; don't
      // let this async lock event flip on the crosshair or end the cutscene early.
      if (this.phase === 'defeat') return;
      this.elCross.classList.add('active');
      if (this.phase !== 'museum') this._startGameplayPhase();
    });
    this.player.controls.addEventListener('unlock', () => {
      if (this.phase === 'museum') {
        this.elResume.style.display = 'flex';
        this.elCross.classList.remove('active');
      } else if (!this.busy && this.artifacts.foundCount < this.artifacts.total) {
        this.elStart.style.display = 'flex';
        this.elHud.classList.remove('active');
        this.elGhint.classList.remove('active');
        this.elCross.classList.remove('active');
      }
    });
    document.addEventListener('keydown', (e) => { if (e.code === 'KeyE') this.holdKey = true; });
    document.addEventListener('keyup',   (e) => { if (e.code === 'KeyE') this.holdKey = false; });
    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.cutscene.resize(innerWidth, innerHeight);
      this.defeatCutscene.resize(innerWidth, innerHeight);
      this.renderer.setSize(innerWidth, innerHeight);
      this.composer.setSize(innerWidth, innerHeight);
      this.artifacts.setResolution(innerWidth, innerHeight); // fat-line thickness
    });
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
    this.player.controls.unlock();
    await this.discovery.show(nearest.data, () => {
      this.artifacts.collect(nearest);
      this.audio.removeEcho(nearest);   // silence this artifact's echo on pickup
      this.elFound.textContent = this.artifacts.foundCount;
    });
    this.busy = false;

    if (this.artifacts.foundCount >= this.artifacts.total) {
      this._zoneComplete();
    } else {
      this.player.controls.lock();
    }
  }

  // Walking within range of the guardian starts the bugtong challenge. The
  // guardian holds position while the dialog is open. A wrong answer makes it
  // flee and resets the sequence; three correct answers defeat it.
  async _startEncounter() {
    if (this.busy) return;
    this.busy = true;
    this.guardian.setRoaming(false);
    this.elGhint.classList.remove('active');
    this.player.controls.unlock();

    const rng = mulberry32((Date.now() & 0xffff) ^ 0x5bd1);
    const riddles = drawRiddles(RIDDLE_COUNT, rng);

    for (let i = 0; i < riddles.length; i++) {
      const ok = await this.riddleScreen.show(riddles[i], i + 1, riddles.length);
      if (!ok) {
        // Wrong: the guardian vanishes and the whole sequence resets to riddle 1.
        const playerPos = this.player.controls.getObject().position;
        this.guardian.teleport(playerPos);
        this.guardian.setRoaming(true);
        this.elGhint.classList.add('active');
        this.busy = false;
        this.player.controls.lock();
        return;
      }
    }
    await this._defeatGuardian();
  }

  // Guardian defeated: a scripted camera beat frames the whole guardian, blows it
  // up, then tilts up to follow the artifacts scattering across the zone. The
  // explosion (defeat puff + artifact burst) is deferred to the cutscene's
  // mid-point so the guardian is still fully visible during the framing.
  async _defeatGuardian() {
    const origin = this.guardian.center().clone();   // capture BEFORE defeating
    const playerPos = this.camera.position.clone();
    this.bossDefeated = true;
    this.phase = 'defeat';
    this.elCross.classList.remove('active');          // hide the crosshair during the cinematic
    this.viewmodel.group.visible = false;             // hide the first-person hand (it lives in the scene)
    this.renderPass.camera = this.defeatCutscene.camera;
    // Re-lock NOW, while the last answer-click's activation is still valid, and
    // keep it locked through the cutscene so mouse-look is retained the instant it
    // ends (the gameplay loop ignores input while phase === 'defeat'). Locking
    // after the cutscene's async gap would silently fail and trap the player.
    this.player.controls.lock();

    await this.defeatCutscene.play(origin, playerPos, {
      onExplode: () => {
        this.guardian.defeat();                       // bigger poof + fade, now
        this.artifacts.scatter(origin);               // burst + flight, now
        this.audio.playScatter();                     // whoosh + sparkle as they burst out
        // Each loose artifact starts emitting its spatialized "echo" locator.
        this.artifacts.artifacts.forEach((a) => this.audio.addEcho(a, a.pos));
        this.elFound.textContent = this.artifacts.foundCount;  // 0 / 3
        this.elHud.classList.add('active');
      },
    });

    // Hand control back level + facing forward (zero pitch/roll, keep yaw).
    this._levelCamera();
    this.viewmodel.group.visible = true;              // restore the first-person hand
    this.renderPass.camera = this.camera;             // restore gameplay camera
    this.busy = false;
    this._startGameplayPhase();                       // phase='playing', crosshair + HUD on
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

  // Show the Descend screen for the currently-built zone: label it with the
  // active zone and reveal the overlay. Used both after the intro and on every
  // zone entry from the hub, so the player always reads which zone they're
  // dropping into and clicks to descend (the click gesture re-locks the pointer).
  _showDescend() {
    this.phase = 'descend';
    this.elStartZone.textContent = this.world.zone.label;
    this.elStart.style.display = 'flex';
  }

  // Enter the active "playing" phase: show the right HUD and, if the guardian is
  // still alive, start it roaming. Driven by the lock event on the normal
  // Start-screen path, or called directly by _loadZone when the player is already
  // pointer-locked (entering a zone straight from the hub).
  _startGameplayPhase() {
    this.phase = 'playing';
    this.elCross.classList.add('active');
    if (this.bossDefeated) {
      this.elHud.classList.add('active');     // artifacts are loose: show the counter
      this.elGhint.classList.remove('active');
    } else {
      this.elGhint.classList.add('active');   // still seeking the guardian
      this.elHud.classList.remove('active');
      this.guardian.setRoaming(true);
    }
  }

  _zoneComplete() {
    this.phase = 'complete';      // the card is up; controls already unlocked by discovery
    // Record this zone as done and open the next portal in the hub (sequential unlock).
    this.completed.add(this.currentZone);
    const next = this.zoneOrder[this.zoneOrder.indexOf(this.currentZone) + 1];
    if (next) this.museum.unlockPortal(Number(next.slice(4)));   // 'zone2' -> 2
    this.elHud.classList.remove('active');
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

  // Return to the now-finished museum, walkable. Runs synchronously inside the
  // card-click gesture so controls.lock() is honored. White covers the cut.
  _enterMuseum() {
    this.phase = 'museum';
    this._loadingZone = false;   // re-arm hub portal entry detection

    // Snap white up to hide the swap, then ease it away (same idiom as the intro).
    this.elFlash.style.transition = 'none';
    this.elFlash.style.opacity = '1';
    void this.elFlash.offsetHeight;
    this.elFlash.style.transition = '';

    // The gallery now holds the player's recovered memories — light it up.
    this.museum.setHubLighting(true);

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

    this.elZoneDone.classList.remove('active');
    this.player.controls.lock();
    requestAnimationFrame(() => { this.elFlash.style.opacity = '0'; });
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
    requestAnimationFrame(() => { this.elFlash.style.opacity = '0'; });
  }

  // Tear down the current zone and build a fresh one in its place: re-parent the
  // player rig, re-wire physics + rendering, rebuild the artifact/guardian
  // subsystems, reset the loop state, and lock the player back in on the dock.
  // Used both for first-time zone entry from the hub and re-entering a finished one.
  _loadZone(zoneId) {
    // Tear down the outgoing zone — guardian first so its meshes leave the scene
    // before the world's disposal walks it.
    this.guardian.dispose();
    const oldWorld = this.world;

    this.world = createWorld(zoneId);
    this.currentZone = zoneId;

    // Move the player rig into the new scene (this detaches it from the old one),
    // then free the old world's GPU resources.
    this.world.scene.add(this.player.controls.getObject());
    oldWorld.dispose();

    // Re-wire physics + rendering at the new world.
    this.player.setCollider((x, z) => this.world.collidesAt(x, z, PLAYER_RADIUS));
    this.player.setGroundHeight((x, z) => this.world.groundHeightAt(x, z));
    this.renderPass.scene = this.world.scene;
    this.renderPass.camera = this.camera;

    // Fresh subsystems on the new scene (artifact count + guardian reset to 0/seek).
    this.artifacts = new ArtifactManager(this.world.scene, this.world);
    this.guardian = new Guardian(this.world.scene, this.world, zoneId);
    this.audio.clearEchoes();   // drop the old zone's echoes; new ones register on defeat

    // Reset the gameplay state machine.
    this.bossDefeated = false;
    this.busy = false;
    this.holdKey = false;
    this.holdProgress = 0;
    this._proximity = null;

    // Leave the hub lighting behind and spawn on the dock like Zone 1.
    this.museum.setHubLighting(false);
    const obj = this.player.controls.getObject();
    obj.position.set(0, CONFIG.DOCK_TOP + CONFIG.EYE_HEIGHT, 35);
    this.camera.rotation.set(0, 0, 0);
    this.player.velocity.set(0, 0, 0);
    this.player.eyeBase = CONFIG.DOCK_TOP;

    // Always pause on the Descend screen for the active zone (first entry and
    // replays alike). Coming from the hub the player is pointer-locked, so unlock
    // to surface the overlay; the descend click re-locks and starts gameplay.
    this._showDescend();
    if (this.player.controls.isLocked) this.player.controls.unlock();
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;

    // Intro cutscene owns the camera; skip all gameplay/input until it ends.
    if (this.phase === 'cutscene') {
      this.museum.update(dt, t);
      this.cutscene.update(dt);
      this.composer.render();
      return;
    }

    // Walkable museum hub: free-roam between zones. Walking into an unlocked
    // portal's corridor loads that zone; locked corridors are sealed off.
    if (this.phase === 'museum') {
      this.player.update(dt);
      this.viewmodel.update(dt, this.player.moving);
      this.museum.update(dt, t);
      if (!this._loadingZone) {
        const pos = this.player.controls.getObject().position;
        for (const p of this.museum.portals) {
          if (!p.locked && p.entry && pos.distanceTo(p.entry) < MUSEUM.EXIT_RADIUS) {
            this._enterZoneFromHub('zone' + p.zone);
            break;
          }
        }
      }
      this.composer.render();
      return;
    }

    // Guardian-defeat cinematic owns the camera; the world/guardian/artifacts keep
    // updating so the explosion + scatter flight play out under the scripted shot.
    if (this.phase === 'defeat') {
      this.world.update(dt, t);
      const camPos = this.defeatCutscene.camera.position;
      this.guardian.update(dt, t, camPos);   // guardian faces the cinematic camera
      // String-anchor basis from the cutscene camera (each artifact owns a StringBundle).
      this._gather ||= new THREE.Vector3();   this._camDir ||= new THREE.Vector3();
      this._camRight ||= new THREE.Vector3(); this._camUp ||= new THREE.Vector3();
      this.defeatCutscene.camera.getWorldDirection(this._camDir);
      this._camRight.crossVectors(this._camDir, WORLD_UP).normalize();
      this._camUp.crossVectors(this._camRight, this._camDir).normalize();
      this._gather.copy(camPos).addScaledVector(this._camDir, 1.0).addScaledVector(this._camUp, -0.5);
      this.artifacts.update(dt, t, camPos, this._gather, this._camRight, this._camUp);
      this.defeatCutscene.update(dt);
      this.composer.render();
      return;
    }

    this.world.update(dt, t);
    if (!this.busy) this.player.update(dt);
    this.viewmodel.update(dt, !this.busy && this.player.moving);

    const playerPos = this.player.controls.getObject().position;

    // The guardian keeps animating every frame (so its defeat dissolve + puff
    // still play out after it's beaten). Before it's beaten it roams and the
    // player seeks it: walking into range auto-starts the riddle, and no
    // artifacts exist yet.
    const gdist = this.guardian.update(dt, t, playerPos);
    if (!this.bossDefeated) {
      if (!this.busy && this.player.controls.isLocked && gdist <= GUARDIAN.ENCOUNTER_RANGE) {
        this._startEncounter();
      }
      this.composer.render();
      return;
    }

    // Held point: ~1.0m ahead and held low in VIEW space, so the string anchors
    // near the bottom of the screen at any pitch (no floor sag). camRight/camUp
    // form the view basis the string bows and vibrates within.
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

    const inRange = this._updateHold(dt);

    // "Hold E" prompt: shown in range, hidden once the ring starts filling
    this.elPrompt.classList.toggle('active', inRange && this.holdProgress < 0.02);

    this.composer.render();
  }
}
