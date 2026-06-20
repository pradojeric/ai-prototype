// ============================================================
// GAME — wiring + main loop
// ============================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { CONFIG, WORLD_UP, PLAYER_RADIUS } from '../config.js';
import { World } from './World.js';
import { PlayerController } from './PlayerController.js';
import { ArtifactManager } from './ArtifactManager.js';
import { ViewModel } from './ViewModel.js';
import { AudioManager } from '../audio/AudioManager.js';
import { DiscoveryScreen } from '../ui/DiscoveryScreen.js';

const HOLD_TIME = 2.5;          // seconds to hold E to collect an artifact
const HOLD_DRAIN = 1.8;         // progress units/sec lost when you release early
const RING_CIRC = 2 * Math.PI * 34;   // circumference of the r=34 progress ring

export class Game {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    document.body.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 200);

    this.world = new World();
    this.player = new PlayerController(this.camera, this.renderer.domElement);
    this.world.scene.add(this.player.controls.getObject());
    // Inject the world's collision test so the player slides off solid props.
    this.player.setCollider((x, z) => this.world.collidesAt(x, z, PLAYER_RADIUS));
    // Inject support-height so the player stands on the dock + climbs the ladder.
    this.player.setGroundHeight((x, z) => this.world.groundHeightAt(x, z));
    this.artifacts = new ArtifactManager(this.world.scene, this.world);
    this.viewmodel = new ViewModel(this.camera);   // first-person hand
    this.audio = new AudioManager();
    this.discovery = new DiscoveryScreen();

    // post-processing: bloom for the string glow
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.world.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.8, 0.6, 0.2);
    this.composer.addPass(this.bloom);

    this.clock = new THREE.Clock();
    this.busy = false;        // true during discovery
    this.holdKey = false;     // E currently held
    this.holdProgress = 0;    // 0..1 hold-to-collect progress
    this._ui();
    this._events();

    document.getElementById('loading').style.display = 'none';
    document.getElementById('start').style.display = 'flex';
    this.animate();
  }

  _ui() {
    this.elFound = document.getElementById('found');
    this.elHud = document.getElementById('hud');
    this.elPrompt = document.getElementById('prompt');
    this.elCross = document.getElementById('crosshair');
    this.elStart = document.getElementById('start');
    this.elZoneDone = document.getElementById('zonecomplete');
    this.elRingWrap = document.getElementById('holdring');
    this.elRing = this.elRingWrap.querySelector('.prog');
  }

  _events() {
    this.elStart.addEventListener('click', () => {
      this.audio.init();
      this.player.controls.lock();
    });
    this.player.controls.addEventListener('lock', () => {
      this.elStart.style.display = 'none';
      this.elHud.classList.add('active');
      this.elCross.classList.add('active');
    });
    this.player.controls.addEventListener('unlock', () => {
      if (!this.busy && this.artifacts.foundCount < this.artifacts.total) {
        this.elStart.style.display = 'flex';
        this.elHud.classList.remove('active');
        this.elCross.classList.remove('active');
      }
    });
    document.addEventListener('keydown', (e) => { if (e.code === 'KeyE') this.holdKey = true; });
    document.addEventListener('keyup',   (e) => { if (e.code === 'KeyE') this.holdKey = false; });
    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
      this.composer.setSize(innerWidth, innerHeight);
      this.artifacts.setResolution(innerWidth, innerHeight); // fat-line thickness
    });
  }

  // Called once the hold-to-collect ring fills.
  async _completeInteract(nearest) {
    if (this.busy) return;
    this.busy = true;
    this.holdProgress = 0;
    this.player.controls.unlock();
    await this.discovery.show(nearest.data, () => {
      this.artifacts.collect(nearest);
      this.elFound.textContent = this.artifacts.foundCount;
    });
    this.busy = false;

    if (this.artifacts.foundCount >= this.artifacts.total) {
      this._zoneComplete();
    } else {
      this.player.controls.lock();
    }
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

  _zoneComplete() {
    this.elHud.classList.remove('active');
    this.elCross.classList.remove('active');
    this.elPrompt.classList.remove('active');
    this.elZoneDone.classList.add('active');
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;

    this.world.update(dt, t);
    if (!this.busy) this.player.update(dt);
    this.viewmodel.update(dt, !this.busy && this.player.moving);

    const playerPos = this.player.controls.getObject().position;

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

    this._proximity = this.artifacts.update(t, playerPos, this._gather, this._camRight, this._camUp);
    this.audio.setProximity(this._proximity.nearestDist);

    const inRange = this._updateHold(dt);

    // "Hold E" prompt: shown in range, hidden once the ring starts filling
    this.elPrompt.classList.toggle('active', inRange && this.holdProgress < 0.02);

    this.composer.render();
  }
}
