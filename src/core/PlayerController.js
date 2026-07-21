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
    this.zephyrActive = false;       // Lumina surge: automatic sprint + stamina recovery
    this.zephyrSpeedMultiplier = 1;
    this.externalSpeedScale = 1;
    this.knockback = new THREE.Vector3();
    this.movementLocked = false;     // rail encounters keep aim but suppress WASD movement
    this.movementAnchor = new THREE.Vector3();
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

  // Game wires the world's support-height function (ramps, landings, dock, ladder).
  setGroundHeight(fn) { this.groundHeight = fn; }

  setMovementLocked(locked, anchor = null) {
    this.movementLocked = locked;
    if (anchor) this.movementAnchor.copy(anchor);
    this.velocity.set(0, 0, 0);
    this.moving = false;
    this.sprinting = false;
    if (this.elStaminaWrap) this.elStaminaWrap.classList.toggle('rail-hidden', locked);
  }

  // Arena Lumina owns the timer; the player owns how the movement state is
  // applied so global CONFIG values never need to be mutated.
  setZephyr(active, speedMultiplier = 1) {
    this.zephyrActive = active;
    this.zephyrSpeedMultiplier = active ? speedMultiplier : 1;
    if (!active) this.sprinting = false;
    this._updateStaminaUi();
  }

  setMovementSlow(scale = 1) { this.externalSpeedScale = Math.max(0.1, Math.min(1, scale)); }
  applyKnockback(dx, dz, strength) {
    if (![dx, dz, strength].every(Number.isFinite)) return;
    const length = Math.hypot(dx, dz);
    if (length < 0.001 || strength <= 0) return;
    this.knockback.x += dx / length * strength;
    this.knockback.z += dz / length * strength;
    const magnitude = this.knockback.length();
    if (magnitude > 8) this.knockback.multiplyScalar(8 / magnitude);
  }
  clearExternalMotion() { this.knockback.set(0, 0, 0); this.externalSpeedScale = 1; }

  update(dt) {
    if (!this.controls.isLocked) return false;
    if (this.movementLocked) {
      const obj = this.controls.getObject();
      obj.position.copy(this.movementAnchor);
      this.velocity.set(0, 0, 0);
      this.moving = false;
      this.sprinting = false;
      return true;
    }
    const f = (this.keys['KeyW'] ? 1 : 0) - (this.keys['KeyS'] ? 1 : 0);
    const s = (this.keys['KeyD'] ? 1 : 0) - (this.keys['KeyA'] ? 1 : 0);
    const moveInput = Math.abs(f) + Math.abs(s) > 0;

    // Sprint: Shift while moving, as long as the tank isn't empty. Drains only
    // while actually sprinting; otherwise the tank regenerates (GDD §4).
    const wantSprint = (this.keys['ShiftLeft'] || this.keys['ShiftRight']) && moveInput;
    this.sprinting = moveInput && (this.zephyrActive || (wantSprint && this.stamina > 0));
    if (this.zephyrActive) {
      this.stamina = Math.min(CONFIG.STAMINA_MAX, this.stamina + CONFIG.STAMINA_REGEN * dt);
    } else if (this.sprinting) {
      this.stamina = Math.max(0, this.stamina - CONFIG.STAMINA_DRAIN * dt);
    } else {
      this.stamina = Math.min(CONFIG.STAMINA_MAX, this.stamina + CONFIG.STAMINA_REGEN * dt);
    }
    this._updateStaminaUi();

    const speedMultiplier = this.zephyrActive
      ? this.zephyrSpeedMultiplier
      : (this.sprinting ? CONFIG.SPRINT_MULT : 1);
    const speed = CONFIG.WADE_SPEED * speedMultiplier * this.externalSpeedScale;
    // smooth accel/decel for the heavy wade feel
    this.velocity.x += (s * speed - this.velocity.x) * Math.min(1, dt * 4);
    this.velocity.z += (f * speed - this.velocity.z) * Math.min(1, dt * 4);

    const obj = this.controls.getObject();
    const beforeX = obj.position.x, beforeZ = obj.position.z;

    // Apply full intended move, then read the resulting horizontal delta.
    this.controls.moveRight(this.velocity.x * dt);
    this.controls.moveForward(this.velocity.z * dt);
    const dx = obj.position.x - beforeX + this.knockback.x * dt;
    const dz = obj.position.z - beforeZ + this.knockback.z * dt;
    this.knockback.multiplyScalar(Math.exp(-dt * 7));

    // Axis-separated resolution so the player SLIDES along obstacles instead of
    // stopping dead: reject each axis independently if it would enter a collider.
    obj.position.x = beforeX;
    obj.position.z = beforeZ;
    if (!this.collide || !this.collide(beforeX + dx, beforeZ, this.eyeBase)) {
      obj.position.x = beforeX + dx;
    } else {
      this.knockback.x = 0;
    }
    if (!this.collide || !this.collide(obj.position.x, beforeZ + dz, this.eyeBase)) {
      obj.position.z = beforeZ + dz;
    } else {
      this.knockback.z = 0;
    }

    // hard clamp to the zone as a safety net (perimeter buildings also block)
    const L = CONFIG.ZONE_HALF;
    obj.position.x = Math.max(-L, Math.min(L, obj.position.x));
    obj.position.z = Math.max(-L, Math.min(L, obj.position.z));

    // head bob + breathing sway (faster cadence while sprinting)
    const moving = moveInput;
    this.moving = moving;
    this.bobT += dt * (moving ? (this.sprinting ? 9 : 6) : 1.4);
    const breath = Math.sin(this.bobT) * (moving ? 0.05 : 0.018);

    // Vertical follow: rest on the nearest reachable support or water baseline,
    // smoothed so ramps and deliberate drops move continuously instead of snapping.
    const ground = this.groundHeight
      ? this.groundHeight(obj.position.x, obj.position.z, this.eyeBase)
      : 0;
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
    this.elStaminaWrap.classList.toggle(
      'active', this.zephyrActive || this.sprinting || this.stamina < CONFIG.STAMINA_MAX - 0.001,
    );
    this.elStaminaWrap.classList.toggle('low', this.stamina < CONFIG.STAMINA_MAX * 0.25);
    this.elStaminaWrap.classList.toggle('zephyr', this.zephyrActive);
  }
}
