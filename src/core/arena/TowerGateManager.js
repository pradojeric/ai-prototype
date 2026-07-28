// ============================================================
// TOWER GATE MANAGER — Arena 3's three memory seals. Each gate pairs a veil
// (the barrier) with a console (the interactable). The player walks to a console,
// taps E, and answers that gate's bugtong on the shared #riddle card using the
// number keys.
//
// The pointer stays locked for the whole exchange on purpose: the tower's tide
// never stops rising, so the player must keep the ability to move and shoot while
// reading. That is also why a wrong answer surges the tide rather than burdening
// movement — clearance is the only currency this arena trades in.
// ============================================================
import * as THREE from 'three';
import { TOWER_ARENA } from '../../config.js';
import { riddlesForZone } from '../../data.js';
import { RiddleScreen } from '../../ui/RiddleScreen.js';
import { TowerGateConsole } from './_partials/TowerGateConsole.js';

const VEIL_WIDTH = 2.75;
const VEIL_HEIGHT = 2.4;
const SEAL_NAME = {
  fil: 'Tagapag-ingat ng mga Alaala',
  eng: 'The Keeper of Memories',
};

export class TowerGateManager {
  constructor(scene, world, combat, player, hooks = {}) {
    this.scene = scene;
    this.world = world;
    this.combat = combat;
    this.player = player;
    this.hooks = hooks;
    // Draw from this arena's own riddle block (disjoint from other zones, so no
    // bugtong repeats across zones); each rebuild/retry rotates to a fresh set.
    // (arena3.seed stays random for keeper/combat timing.)
    this.riddles = riddlesForZone(world.zone.id, 3);
    this.screen = new RiddleScreen();
    this.elPrompt = document.getElementById('prompt');
    this.elBanner = document.getElementById('arena-riddle');
    this.elHint = document.getElementById('ar-hint');
    this.elFil = document.getElementById('ar-fil');
    this.elEng = document.getElementById('ar-eng');
    this.elStep = document.getElementById('ar-step');

    this._veilGeometry = new THREE.PlaneGeometry(VEIL_WIDTH, VEIL_HEIGHT, 5, 4);
    this.gates = (world.towerGateFrames || []).map((frame, index) => {
      const veilMaterial = new THREE.MeshBasicMaterial({
        color: 0x7fe8ff,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        wireframe: true,
      });
      const veil = new THREE.Mesh(this._veilGeometry, veilMaterial);
      veil.position.set(frame.x, frame.height + VEIL_HEIGHT / 2, frame.z);
      veil.rotation.y = frame.rotation;
      scene.add(veil);
      return {
        ...frame,
        index,
        open: false,
        active: false,
        veil,
        veilMaterial,
        veilFade: 1,
        console: new TowerGateConsole(scene, world, frame),
        center: new THREE.Vector3(frame.x, frame.height + 1.2, frame.z),
      };
    });
  }

  get riddleOpen() { return this.screen.active; }

  update(dt, t, playerPos, ePressed = false) {
    let promptGate = null;
    for (const gate of this.gates) {
      this._updateVeil(gate, dt, t);
      gate.console.update(dt, t);
      if (gate.open || this.screen.active) continue;
      // Height band first: a console on the flight above should not be offered to
      // a player still climbing toward it.
      if (Math.abs(playerPos.y - gate.height) > 1.6) continue;
      if (gate.console.distanceTo(playerPos) > TOWER_ARENA.CONSOLE_RANGE) continue;
      promptGate = gate;
    }

    if (promptGate && ePressed) {
      this._beginRiddle(promptGate);
      return;
    }
    this._setPrompt(promptGate ? 'Press <b>E</b> to read the seal\'s bugtong' : null);
  }

  _setPrompt(html) {
    if (!this.elPrompt) return;
    if (!html) {
      this.elPrompt.classList.remove('active');
      return;
    }
    if (this._promptHtml !== html) {
      this._promptHtml = html;
      this.elPrompt.innerHTML = html;
    }
    this.elPrompt.classList.add('active');
  }

  _updateVeil(gate, dt, t) {
    if (gate.open) {
      gate.veilFade = Math.max(0, gate.veilFade - dt * 1.9);
      gate.veil.visible = gate.veilFade > 0;
    } else {
      gate.veil.visible = true;
    }
    const pulse = 0.22 + Math.sin(t * 2.2 + gate.index * 0.8) * 0.06;
    gate.veilMaterial.opacity = pulse * gate.veilFade;
  }

  async _beginRiddle(gate) {
    gate.active = true;
    gate.console.setState('busy');
    this._setPrompt(null);
    const riddle = this.riddles[gate.index];

    // The banner echoes which seal is being worked so the HUD still reads while
    // the card is up.
    this.elBanner?.classList.add('active');
    if (this.elStep) this.elStep.textContent = `Seal ${gate.index + 1} / 3`;
    if (this.elFil) this.elFil.textContent = riddle.prompt;
    if (this.elEng) this.elEng.textContent = riddle.promptEng || '';
    if (this.elHint) this.elHint.textContent = 'Answer with 1, 2, or 3.';

    const correct = await this.screen.show(riddle, gate.index + 1, 3, SEAL_NAME, {
      keys: true,
      retryOnWrong: true,
      onWrong: () => this._wrongAnswer(gate),
    });

    // dispose() can land between the await and here (a death mid-riddle tears the
    // card down, then frees the consoles), so bail before touching gate state.
    if (this._disposed) return;
    this.elBanner?.classList.remove('active');
    if (correct) {
      this._open(gate);
      return;
    }
    // Only reachable via dismiss() (a death or reset tore the card down).
    gate.active = false;
    if (!gate.open) gate.console.setState('ready');
  }

  _wrongAnswer(gate) {
    this.hooks.onTideSurge?.();
    this.hooks.onEvent?.('Incorrect seal · the tide surges', 'warning');
    this.combat.vfx.gatePulse(gate.center, false);
  }

  _open(gate) {
    gate.open = true;
    gate.active = false;
    gate.console.setState('solved');
    this.combat.vfx.gatePulse(gate.center, true);
    const opened = this.gates.filter((candidate) => candidate.open).length;
    this.hooks.onSeal?.(opened, this.gates.length);
    this.hooks.onEvent?.(`Memory seal ${gate.index + 1} released`, 'success');
  }

  collidesPlayerAt(x, z, radius, y) {
    return this.gates.some((gate) => !gate.open &&
      Math.abs(y - gate.height) < 1.6 &&
      Math.hypot(x - gate.x, z - gate.z) < radius + 1.2);
  }

  allOpen() { return this.gates.every((gate) => gate.open); }

  openAll() {
    this.screen.dismiss();
    for (const gate of this.gates) {
      gate.open = true;
      gate.active = false;
      gate.veilFade = 0;
      gate.veil.visible = false;
      gate.console.setState('solved');
    }
    this._setPrompt(null);
    this.elBanner?.classList.remove('active');
    this.hooks.onSeal?.(this.gates.length, this.gates.length);
  }

  reset() {
    this.screen.dismiss();
    for (const gate of this.gates) {
      gate.open = false;
      gate.active = false;
      gate.veilFade = 1;
      gate.veil.visible = true;
      gate.console.setState('ready');
    }
    this._setPrompt(null);
    this.elBanner?.classList.remove('active');
    this.hooks.onSeal?.(0, this.gates.length);
  }

  dispose() {
    this.reset();
    this._disposed = true;
    for (const gate of this.gates) {
      this.scene.remove(gate.veil);
      gate.veilMaterial.dispose();
      gate.console.dispose();
    }
    this._veilGeometry.dispose();
  }
}
