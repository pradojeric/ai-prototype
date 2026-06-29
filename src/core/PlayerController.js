// ============================================================
// PLAYER CONTROLLER — wade movement + look + collision slide (GDD §4/§5)
// ============================================================
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { CONFIG } from '../config.js';

export class PlayerController {
  constructor(camera, domElement) {
    this.controls = new PointerLockControls(camera, domElement);
    this.camera = camera;
    this.keys = {};
    this.velocity = new THREE.Vector3();
    this.bobT = 0;
    this.moving = false;             // WASD held this frame (for the view-model bob)
    this.sprinting = false;          // Shift held + moving + stamina left this frame
    this.stamina = CONFIG.STAMINA_MAX; // sprint "tank", drains on sprint and regens otherwise
    this.collide = null;             // (x, z) => boolean, injected by Game
    this.groundHeight = null;        // (x, z) => number, injected by Game
    this.eyeBase = CONFIG.DOCK_TOP;  // smoothed support height under the player
    camera.position.set(0, CONFIG.DOCK_TOP + CONFIG.EYE_HEIGHT, 35);  // on the dock

    // Stamina HUD (bottom-left bar); updated each frame from this.stamina.
    this.elStaminaWrap = document.getElementById('stamina');
    this.elStaminaFill = document.getElementById('stamina-fill');

    document.addEventListener('keydown', (e) => this.keys[e.code] = true);
    document.addEventListener('keyup', (e) => this.keys[e.code] = false);
  }

  // Game wires the world's collision test in after both exist.
  setCollider(fn) { this.collide = fn; }

  // Game wires the world's support-height function (raised dock + ladder ramp).
  setGroundHeight(fn) { this.groundHeight = fn; }

  update(dt) {
    if (!this.controls.isLocked) return false;
    const f = (this.keys['KeyW'] ? 1 : 0) - (this.keys['KeyS'] ? 1 : 0);
    const s = (this.keys['KeyD'] ? 1 : 0) - (this.keys['KeyA'] ? 1 : 0);
    const moveInput = Math.abs(f) + Math.abs(s) > 0;

    // Sprint: Shift while moving, as long as the tank isn't empty. Drains only
    // while actually sprinting; otherwise the tank regenerates (GDD §4).
    const wantSprint = (this.keys['ShiftLeft'] || this.keys['ShiftRight']) && moveInput;
    this.sprinting = wantSprint && this.stamina > 0;
    if (this.sprinting) {
      this.stamina = Math.max(0, this.stamina - CONFIG.STAMINA_DRAIN * dt);
    } else {
      this.stamina = Math.min(CONFIG.STAMINA_MAX, this.stamina + CONFIG.STAMINA_REGEN * dt);
    }
    this._updateStaminaUi();

    const speed = CONFIG.WADE_SPEED * (this.sprinting ? CONFIG.SPRINT_MULT : 1);
    // smooth accel/decel for the heavy wade feel
    this.velocity.x += (s * speed - this.velocity.x) * Math.min(1, dt * 4);
    this.velocity.z += (f * speed - this.velocity.z) * Math.min(1, dt * 4);

    const obj = this.controls.getObject();
    const beforeX = obj.position.x, beforeZ = obj.position.z;

    // Apply full intended move, then read the resulting horizontal delta.
    this.controls.moveRight(this.velocity.x * dt);
    this.controls.moveForward(this.velocity.z * dt);
    const dx = obj.position.x - beforeX;
    const dz = obj.position.z - beforeZ;

    // Axis-separated resolution so the player SLIDES along obstacles instead of
    // stopping dead: reject each axis independently if it would enter a collider.
    obj.position.x = beforeX;
    obj.position.z = beforeZ;
    if (!this.collide || !this.collide(beforeX + dx, beforeZ)) obj.position.x = beforeX + dx;
    if (!this.collide || !this.collide(obj.position.x, beforeZ + dz)) obj.position.z = beforeZ + dz;

    // hard clamp to the zone as a safety net (perimeter buildings also block)
    const L = CONFIG.ZONE_HALF;
    obj.position.x = Math.max(-L, Math.min(L, obj.position.x));
    obj.position.z = Math.max(-L, Math.min(L, obj.position.z));

    // head bob + breathing sway (faster cadence while sprinting)
    const moving = moveInput;
    this.moving = moving;
    this.bobT += dt * (moving ? (this.sprinting ? 9 : 6) : 1.4);
    const breath = Math.sin(this.bobT) * (moving ? 0.05 : 0.018);

    // Vertical follow: rest on the platform / ladder ramp / water baseline,
    // smoothed so stepping on or off the dock eases instead of snapping.
    const ground = this.groundHeight ? this.groundHeight(obj.position.x, obj.position.z) : 0;
    this.eyeBase += (ground - this.eyeBase) * Math.min(1, dt * 8);
    obj.position.y = this.eyeBase + CONFIG.EYE_HEIGHT + breath;

    return true;
  }

  // Reflect stamina onto the HUD bar: width tracks the tank; it fades in while
  // not full (or sprinting) and goes "low" red when nearly spent.
  _updateStaminaUi() {
    if (!this.elStaminaWrap || !this.elStaminaFill) return;
    const pct = (this.stamina / CONFIG.STAMINA_MAX) * 100;
    this.elStaminaFill.style.width = pct + '%';
    this.elStaminaWrap.classList.toggle('active', this.sprinting || this.stamina < CONFIG.STAMINA_MAX - 0.001);
    this.elStaminaWrap.classList.toggle('low', this.stamina < CONFIG.STAMINA_MAX * 0.25);
  }
}
