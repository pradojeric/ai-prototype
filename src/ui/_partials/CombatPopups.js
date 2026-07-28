// ============================================================
// COMBAT POPUPS — pooled world-space floating combat text: damage numbers,
// BLOCKED on an absorbed bolt, and the big armor/phase callouts. Split out of
// CombatHud because it owns a per-slot lifecycle and a projection pass of its
// own; the HUD keeps only thin delegates.
//
// Same rules as the rest of the HUD: every element is created once at
// construction, slots are recycled, and the per-frame pass writes only
// transform/opacity — no nodes, no layout reads, no allocation mid-fight.
// ============================================================
import * as THREE from 'three';
import { HUD, clamp01 } from '../../config.js';

// Overlapping hits on the same body would stack into one illegible blob, so
// each slot gets a fixed horizontal offset cycled by index. Deterministic
// rather than random: a burst of bolts fans out the same way every time.
const JITTER = [0, 26, -26, 13, -13, 38, -38];

export class CombatPopups {
  constructor(containerId, count = HUD.POPUPS) {
    this.camera = null;
    this.elements = [];
    this.slots = [];

    const host = document.getElementById(containerId);
    if (host) {
      host.textContent = '';
      for (let i = 0; i < count; i++) {
        const el = document.createElement('div');
        el.className = 'combat-popup';
        host.appendChild(el);
        this.elements.push(el);
        this.slots.push({
          life: 0, max: 1, rise: 0, jitter: JITTER[i % JITTER.length],
          anchor: new THREE.Vector3(),
        });
      }
    }

    // Scratch — the projection pass runs over every live slot each frame.
    this._v = new THREE.Vector3();
  }

  // The popups reproject every frame to stay pinned to their world point, so
  // the camera is stored once rather than threaded through update().
  setCamera(camera) { this.camera = camera; }

  // `kind` selects the CSS treatment: 'damage' (player-dealt), 'player' (damage
  // taken), 'blocked' (absorbed by the shield), 'callout' (armor/phase text).
  spawn(worldPos, text, kind = 'damage') {
    if (!worldPos || !this.elements.length) return;

    // Reuse the slot with the least life left, matching the damage-arc pool.
    let index = 0;
    for (let i = 1; i < this.slots.length; i++) {
      if (this.slots[i].life < this.slots[index].life) index = i;
    }
    const slot = this.slots[index];
    slot.max = kind === 'callout' ? HUD.POPUP_CALLOUT_LIFE : HUD.POPUP_LIFE;
    slot.life = slot.max;
    slot.rise = kind === 'callout' ? HUD.POPUP_RISE * 0.55 : HUD.POPUP_RISE;
    slot.anchor.copy(worldPos);

    const el = this.elements[index];
    el.textContent = text;
    el.className = `combat-popup ${kind}`;
    el.style.opacity = '0';   // the first update() places it before it shows
  }

  update(dt) {
    if (!this.camera) return;
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (slot.life <= 0) continue;

      slot.life = Math.max(0, slot.life - dt);
      const el = this.elements[i];
      if (slot.life <= 0) { el.style.opacity = '0'; continue; }

      const elapsed = slot.max - slot.life;
      const t = clamp01(elapsed / slot.max);
      this._v.copy(slot.anchor);
      this._v.y += slot.rise * elapsed;
      this._v.project(this.camera);

      // project() mirrors points behind the camera; hide those rather than
      // drawing a number on the wrong side of the screen (see trackThreats).
      if (this._v.z > 1) { el.style.opacity = '0'; continue; }

      const x = this._v.x * window.innerWidth * 0.5 + slot.jitter * (1 - t * 0.4);
      const y = -this._v.y * window.innerHeight * 0.5;
      // Hold full opacity through the first half, then fade — the number is
      // readable before it starts leaving.
      const fade = t < 0.5 ? 1 : 1 - (t - 0.5) * 2;
      el.style.transform = `translate(${x}px, ${y}px) scale(${1 + (1 - t) * 0.12})`;
      el.style.opacity = String(fade);
    }
  }

  clear() {
    for (let i = 0; i < this.slots.length; i++) {
      this.slots[i].life = 0;
      this.elements[i].style.opacity = '0';
    }
  }

  dispose() {
    for (const el of this.elements) el.remove();
    this.elements.length = 0;
    this.slots.length = 0;
  }
}
