import * as THREE from 'three';
import { COMBAT, TOWER_ARENA, mulberry32 } from '../../config.js';
import { drawRiddles } from '../../data.js';
import { AnswerNode } from './AnswerNode.js';

const VEIL_WIDTH = 2.75;
const VEIL_HEIGHT = 2.4;

export class TowerGateManager {
  constructor(scene, world, combat, player, hooks = {}) {
    this.scene = scene;
    this.world = world;
    this.combat = combat;
    this.player = player;
    this.hooks = hooks;
    this.riddles = drawRiddles(3, mulberry32(world.zone.seed));
    this.slowRemaining = 0;
    this._slowUntil = 0;
    this._slowTimer = null;
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
        nodes: [],
        veil,
        veilMaterial,
        veilFade: 1,
        center: new THREE.Vector3(frame.x, frame.height + 1.2, frame.z),
      };
    });
  }

  update(dt, t, playerPos) {
    this._updateSlow();
    for (const gate of this.gates) {
      this._updateVeil(gate, dt, t);
      for (let i = gate.nodes.length - 1; i >= 0; i--) {
        const node = gate.nodes[i];
        node.update(dt, t);
        if (!node.dead) continue;
        node.dispose();
        gate.nodes.splice(i, 1);
      }
      if (gate.open) continue;
      const nearHeight = Math.abs(playerPos.y - gate.height) < 1.4;
      const nearGate = Math.hypot(playerPos.x - gate.x, playerPos.z - gate.z) < 5;
      if (!gate.active && nearHeight && nearGate) this._start(gate);
      if (gate.active) this._test(gate);
    }
  }

  _updateSlow() {
    if (this._slowUntil <= 0) return;
    this.slowRemaining = Math.max(0, (this._slowUntil - performance.now()) / 1000);
    this.hooks.onSlow?.(this.slowRemaining);
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

  _start(gate) {
    gate.active = true;
    const riddle = this.riddles[gate.index];
    this.elBanner?.classList.add('active');
    if (this.elStep) this.elStep.textContent = `Seal ${gate.index + 1} / 3`;
    if (this.elFil) this.elFil.textContent = riddle.prompt;
    if (this.elEng) this.elEng.textContent = riddle.promptEng || '';
    if (this.elHint) this.elHint.textContent = 'Shoot the correct seal mechanism.';
    riddle.choices.forEach((choice, index) => {
      const position = new THREE.Vector3(
        gate.x + (index - 1) * 1.5,
        gate.height + 1.4,
        gate.z - 1.5,
      );
      gate.nodes.push(new AnswerNode(this.scene, choice, position, { labelScale: 0.72 }));
    });
  }

  _test(gate) {
    for (const shot of this.combat.bolts.slots) {
      if (!shot.active) continue;
      for (const node of gate.nodes) {
        if (!node.hitTest(shot.mesh.position, COMBAT.BOLT.RADIUS)) continue;
        this.combat.bolts.deactivate(shot);
        if (node.correct) {
          this._open(gate);
        } else {
          this._wrongAnswer(gate, node);
        }
        return;
      }
    }
  }

  _wrongAnswer(gate, node) {
    node.break();
    this.player.setMovementSlow(TOWER_ARENA.WRONG_SLOW);
    this.slowRemaining = TOWER_ARENA.WRONG_SLOW_TIME;
    this._slowUntil = performance.now() + TOWER_ARENA.WRONG_SLOW_TIME * 1000;
    clearTimeout(this._slowTimer);
    this._slowTimer = setTimeout(() => {
      this.player.setMovementSlow(1);
      this.slowRemaining = 0;
      this._slowUntil = 0;
      this.hooks.onSlow?.(0);
    }, TOWER_ARENA.WRONG_SLOW_TIME * 1000);
    this.hooks.onSlow?.(this.slowRemaining);
    this.hooks.onEvent?.('Incorrect seal · movement burdened', 'warning');
    this.combat.vfx.gatePulse(gate.center, false);
    this.combat.spawnPenaltyGargoyle(gate.height);
  }

  _open(gate) {
    gate.open = true;
    gate.active = false;
    gate.nodes.forEach((node) => node.break());
    this.elBanner?.classList.remove('active');
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

  reset() {
    for (const gate of this.gates) {
      gate.open = false;
      gate.active = false;
      gate.veilFade = 1;
      gate.veil.visible = true;
      gate.nodes.forEach((node) => node.dispose());
      gate.nodes.length = 0;
    }
    this.slowRemaining = 0;
    this._slowUntil = 0;
    clearTimeout(this._slowTimer);
    this._slowTimer = null;
    this.player.setMovementSlow(1);
    this.elBanner?.classList.remove('active');
    this.hooks.onSlow?.(0);
    this.hooks.onSeal?.(0, this.gates.length);
  }

  dispose() {
    this.reset();
    for (const gate of this.gates) {
      this.scene.remove(gate.veil);
      gate.veilMaterial.dispose();
    }
    this._veilGeometry.dispose();
  }
}
