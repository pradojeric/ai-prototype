// ============================================================
// PLAYER CONTROLLER — wade movement + look + collision slide (GDD §4/§5)
// ============================================================
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { CONFIG, wrapAngle } from '../config.js';

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
    // Combat hop. Purely a vertical OFFSET stacked on the ground-follow below —
    // the player has no vertical velocity model otherwise, and collision keeps
    // resolving against `eyeBase`, so a leap can never clear a wall or a ledge.
    this.jumpEnabled = false;        // armed only while a fight is live
    this.jumpOffset = 0;             // metres above the current support
    this.jumpVel = 0;
    this._jumpRequested = false;
    this.movementLocked = false;     // rail encounters keep aim but suppress WASD movement
    this.movementAnchor = new THREE.Vector3();
    this.yawLimit = null;            // {center, range} aim cone; null = free look
    this.collide = null;             // (x, z) => boolean, injected by Game
    this.groundHeight = null;        // (x, z) => number, injected by Game
    this.eyeBase = CONFIG.DOCK_TOP;  // smoothed support height under the player
    camera.position.set(0, CONFIG.DOCK_TOP + CONFIG.EYE_HEIGHT, 35);  // on the dock

    // Stamina HUD (bottom-left bar); updated each frame from this.stamina.
    this.elStaminaWrap = document.getElementById('stamina');
    this.elStaminaFill = document.getElementById('stamina-fill');

    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      // Edge-triggered: reading keys['Space'] each frame would let a held key
      // bunny-hop the instant the previous landing registers.
      if (e.code === 'Space' && !e.repeat) this._jumpRequested = true;
    });
    document.addEventListener('keyup', (e) => this.keys[e.code] = false);
  }

  // True while the player is off the ground — read by attacks that a leap clears.
  get airborne() { return this.jumpOffset > 0.001; }

  // Fights arm the hop; everything else disarms it. Disarming mid-air also lands
  // the player, so a fight ending on the way up can't strand them above the floor.
  setJumpEnabled(flag) {
    this.jumpEnabled = !!flag;
    if (flag) return;
    this.jumpOffset = 0;
    this.jumpVel = 0;
    this._jumpRequested = false;
  }

  // Game wires the world's collision test in after both exist.
  setCollider(fn) { this.collide = fn; }

  // Game wires the world's support-height function (ramps, landings, dock, ladder).
  setGroundHeight(fn) { this.groundHeight = fn; }

  setMovementLocked(locked, anchor = null) {
    this.movementLocked = locked;
    if (anchor) this.movementAnchor.copy(anchor);
    this.velocity.set(0, 0, 0);
    this.jumpOffset = 0;             // a rail encounter must never leave them floating
    this.jumpVel = 0;
    this._jumpRequested = false;
    this.moving = false;
    this.sprinting = false;
    if (this.elStaminaWrap) this.elStaminaWrap.classList.toggle('rail-hidden', locked);
  }

  // Restrict yaw to an aim cone around `center` (radians, 0 = facing -Z), so a
  // rail encounter can keep the gaze on the lane ahead. PointerLockControls only
  // clamps pitch, so the cone is enforced here. Pass null to restore free look.
  setYawLimit(center = 0, range = Math.PI) {
    this.yawLimit = range >= Math.PI ? null : { center, range };
    this._clampYaw();
  }
  clearYawLimit() { this.yawLimit = null; }

  // Fold any yaw the pointer accumulated this frame back into the cone. Reading
  // and rewriting as a YXZ Euler preserves pitch and any roll the scene applied.
  _clampYaw() {
    if (!this.yawLimit) return;
    const object = this.controls.getObject();
    this._lookEuler ||= new THREE.Euler(0, 0, 0, 'YXZ');
    this._lookEuler.setFromQuaternion(object.quaternion, 'YXZ');
    const offset = wrapAngle(this._lookEuler.y - this.yawLimit.center);
    const range = this.yawLimit.range;
    if (offset >= -range && offset <= range) return;
    this._lookEuler.y = this.yawLimit.center + (offset < 0 ? -range : range);
    object.quaternion.setFromEuler(this._lookEuler);
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

  // Draw from the sprint tank for a combat action (the melee shockwave). Kept
  // here rather than in the combat manager so every stamina cost — sprint, hop,
  // shockwave — is spent and reported through one owner.
  spendStamina(amount) {
    const cost = Math.max(0, amount);
    if (this.stamina < cost) return false;
    this.stamina -= cost;
    this._updateStaminaUi();
    return true;
  }

  // Focus loss can swallow keyup events. Clear every transient intent at both
  // pause and resume so a held movement/sprint key cannot remain stuck.
  resetInput() {
    this.keys = {};
    this.velocity.set(0, 0, 0);
    this._jumpRequested = false;   // a Space held across a pause must not fire on resume
    this.moving = false;
    this.sprinting = false;
  }

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
    this._clampYaw();
    if (this.movementLocked) {
      const obj = this.controls.getObject();
      obj.position.copy(this.movementAnchor);
      this.velocity.set(0, 0, 0);
      this.moving = false;
      this.sprinting = false;
      // A rail encounter can't sprint or hop, but it CAN spend stamina on the
      // shockwave — so the tank still has to refill here, or Arena 2 would get
      // two melees for the whole ride. The bar itself stays rail-hidden.
      this.stamina = Math.min(CONFIG.STAMINA_MAX, this.stamina + CONFIG.STAMINA_REGEN * dt);
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

    // Combat hop, layered on top of the support height. `eyeBase` keeps chasing the
    // ground underneath while airborne, so landing resolves onto whatever the player
    // drifted over — and every other system that reads `eyeBase` (Zone 3's drown
    // clearance, collision) is deliberately unaffected by the offset.
    if (this._jumpRequested) {
      this._jumpRequested = false;
      if (this.jumpEnabled && !this.movementLocked && this.jumpOffset <= 0
          && this.stamina >= CONFIG.JUMP_STAMINA) {
        this.jumpVel = CONFIG.JUMP_SPEED;
        this.stamina -= CONFIG.JUMP_STAMINA;
        this._updateStaminaUi();   // the bar is drawn earlier in the frame; a fifth
                                   // of the tank vanishing should read immediately
      }
    }
    if (this.jumpOffset > 0 || this.jumpVel > 0) {
      this.jumpVel -= CONFIG.JUMP_GRAVITY * dt;
      this.jumpOffset = Math.max(0, this.jumpOffset + this.jumpVel * dt);
      if (this.jumpOffset === 0) this.jumpVel = 0;
    }
    obj.position.y = this.eyeBase + this.jumpOffset + CONFIG.EYE_HEIGHT + breath;

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
