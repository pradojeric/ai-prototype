// ============================================================
// TOWER GATE CONSOLE — the interactable plinth beside each of Arena 3's three
// memory seals. Tapping E on one opens that gate's bugtong card; the console
// itself owns only its mesh and its lit state, while TowerGateManager owns the
// riddle flow. Split into `_partials/` so TowerGateManager stays well clear of
// the repository's 1000-line limit.
//
// Deliberately collider-free: the gate landings are narrow and a solid plinth
// on one could wedge the player against the ramp rails with the tide rising.
// ============================================================
import * as THREE from 'three';
import { TOWER_ARENA } from '../../../config.js';

const GLYPH_COLORS = {
  ready: 0x7fe8ff,    // pulsing cyan — "read me"
  busy: 0xffd27f,     // warm amber while its card is open
  solved: 0x6fd8a0,   // steady green once the seal is released
};

export class TowerGateConsole {
  // `gate` supplies { x, z, height, rotation } from the authored gate frame.
  constructor(scene, world, gate) {
    this.scene = scene;
    this.state = 'ready';
    this._phase = Math.random() * Math.PI * 2;   // desync the three consoles' pulses

    // Offset sideways from the gate's centre line so the console sits beside the
    // walking lane rather than in it.
    const lateralX = Math.cos(gate.rotation);
    const lateralZ = -Math.sin(gate.rotation);
    this.x = gate.x + lateralX * TOWER_ARENA.CONSOLE_OFFSET;
    this.z = gate.z + lateralZ * TOWER_ARENA.CONSOLE_OFFSET;
    this.y = gate.height;

    this.group = new THREE.Group();
    this.group.position.set(this.x, gate.height, this.z);
    this.group.rotation.y = gate.rotation;

    this._plinthGeometry = new THREE.BoxGeometry(0.62, 0.95, 0.62);
    const plinth = new THREE.Mesh(this._plinthGeometry, world.mat.buildingAlt);
    plinth.position.y = 0.475;
    this.group.add(plinth);

    // A reading desk tilted toward the approaching player.
    this._plateGeometry = new THREE.BoxGeometry(0.7, 0.09, 0.5);
    const plate = new THREE.Mesh(this._plateGeometry, world.mat.concrete);
    plate.position.y = 0.99;
    plate.rotation.x = -0.42;
    this.group.add(plate);

    this._glyphGeometry = new THREE.PlaneGeometry(0.44, 0.3);
    this.glyphMaterial = new THREE.MeshBasicMaterial({
      color: GLYPH_COLORS.ready,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const glyph = new THREE.Mesh(this._glyphGeometry, this.glyphMaterial);
    glyph.position.set(0, 1.05, 0.02);
    glyph.rotation.x = -0.42 - Math.PI / 2;
    this.group.add(glyph);

    scene.add(this.group);
  }

  update(dt, t) {
    // Only the ready state breathes — a solved seal should read as settled, and
    // a console whose card is already open should not compete for attention.
    const pulse = this.state === 'ready'
      ? 0.62 + Math.sin(t * 2.6 + this._phase) * 0.28
      : this.state === 'busy' ? 0.9 : 0.5;
    this.glyphMaterial.opacity = pulse;
  }

  setState(state) {
    if (this.state === state) return;
    this.state = state;
    this.glyphMaterial.color.setHex(GLYPH_COLORS[state] || GLYPH_COLORS.ready);
  }

  // Horizontal distance only; the caller checks the height band separately so a
  // console is not offered to a player standing on the flight below it.
  distanceTo(position) {
    return Math.hypot(position.x - this.x, position.z - this.z);
  }

  dispose() {
    this.scene.remove(this.group);
    this._plinthGeometry.dispose();
    this._plateGeometry.dispose();
    this._glyphGeometry.dispose();
    this.glyphMaterial.dispose();
  }
}
