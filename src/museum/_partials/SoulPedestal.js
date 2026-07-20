// ============================================================
// SOUL PEDESTAL — hub-only altar for the three Guardian Souls
// ============================================================
import * as THREE from 'three';
import { MUSEUM } from '../../config.js';

const SLOT_DATA = [
  { zone: 'zone1', color: 0x7fe8ff, x: -0.62, z: 0.18 },
  { zone: 'zone2', color: 0xffd36b, x: 0.62, z: 0.18 },
  { zone: 'zone3', color: 0xb89cff, x: 0, z: -0.58 },
];

export class SoulPedestal {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.position.set(MUSEUM.SOUL_ALTAR.X, 0, MUSEUM.SOUL_ALTAR.Z);
    this.group.visible = false;
    this.scene.add(this.group);

    this.placedSouls = new Set();
    this.slots = new Map();
    this._geos = [];
    this._mats = [];
    this._build();
  }

  _geo(geometry) { this._geos.push(geometry); return geometry; }
  _mat(material) { this._mats.push(material); return material; }

  _build() {
    const stone = this._mat(new THREE.MeshStandardMaterial({
      color: 0x424b50,
      roughness: 0.82,
      metalness: 0.12,
    }));
    const trim = this._mat(new THREE.MeshStandardMaterial({
      color: 0x79888e,
      roughness: 0.48,
      metalness: 0.38,
    }));

    const base = new THREE.Mesh(
      this._geo(new THREE.CylinderGeometry(
        MUSEUM.SOUL_ALTAR.RADIUS - 0.13,
        MUSEUM.SOUL_ALTAR.RADIUS,
        0.28,
        12,
      )),
      stone,
    );
    base.position.y = 0.14;
    this.group.add(base);

    const altar = new THREE.Mesh(
      this._geo(new THREE.CylinderGeometry(1.08, 1.28, 0.46, 12)),
      stone,
    );
    altar.position.y = 0.49;
    this.group.add(altar);

    const rim = new THREE.Mesh(this._geo(new THREE.TorusGeometry(1.05, 0.055, 8, 48)), trim);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.73;
    this.group.add(rim);

    for (const data of SLOT_DATA) this._buildSlot(data);
  }

  _buildSlot({ zone, color, x, z }) {
    const socketMat = this._mat(new THREE.MeshStandardMaterial({
      color: 0x162126,
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.08,
      roughness: 0.55,
      metalness: 0.35,
    }));
    const socket = new THREE.Mesh(
      this._geo(new THREE.CylinderGeometry(0.28, 0.34, 0.12, 10)),
      socketMat,
    );
    socket.position.set(x, 0.78, z);
    this.group.add(socket);

    const soulMat = this._mat(new THREE.MeshStandardMaterial({
      color: 0x10181b,
      emissive: new THREE.Color(color),
      emissiveIntensity: 0,
      roughness: 0.25,
      transparent: true,
      opacity: 0.18,
    }));
    const soul = new THREE.Mesh(this._geo(new THREE.IcosahedronGeometry(0.22, 0)), soulMat);
    soul.position.set(x, 1.02, z);
    this.group.add(soul);

    const ringMat = this._mat(new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.07,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }));
    const ring = new THREE.Mesh(this._geo(new THREE.TorusGeometry(0.34, 0.025, 6, 32)), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, 1.02, z);
    this.group.add(ring);

    this.slots.set(zone, { socketMat, soulMat, ringMat });
  }

  setVisible(visible) { this.group.visible = visible; }

  placeSoul(zone) {
    const slot = this.slots.get(zone);
    if (!slot || this.placedSouls.has(zone)) return false;
    this.placedSouls.add(zone);
    slot.socketMat.emissiveIntensity = 0.7;
    slot.soulMat.color.copy(slot.soulMat.emissive);
    slot.soulMat.emissiveIntensity = 2.4;
    slot.soulMat.opacity = 1;
    slot.ringMat.opacity = 0.62;
    return true;
  }

  get count() { return this.placedSouls.size; }
  get complete() { return this.count === SLOT_DATA.length; }

  distanceTo(playerPos) {
    const dx = playerPos.x - this.group.position.x;
    const dz = playerPos.z - this.group.position.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  collidesAt(x, z, playerRadius) {
    if (!this.group.visible) return false;
    const dx = x - this.group.position.x;
    const dz = z - this.group.position.z;
    const reach = MUSEUM.SOUL_ALTAR.RADIUS + playerRadius;
    return dx * dx + dz * dz < reach * reach;
  }

  update(t) {
    if (!this.group.visible) return;
    const pulse = 0.5 + Math.sin(t * 2.2) * 0.5;
    for (const [zone, slot] of this.slots) {
      if (!this.placedSouls.has(zone)) continue;
      slot.soulMat.emissiveIntensity = 2.15 + pulse * 0.55;
      slot.ringMat.opacity = 0.48 + pulse * 0.18;
    }
  }

  dispose() {
    this.scene.remove(this.group);
    for (const geometry of this._geos) geometry.dispose();
    for (const material of this._mats) material.dispose();
    this._geos.length = 0;
    this._mats.length = 0;
  }
}
