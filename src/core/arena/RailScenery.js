// ============================================================
// RAIL SCENERY — stationary bangkâ plus six recyclable LIKET river chunks.
// Near, mid, and far layers scroll at different rates to sell forward travel;
// the boat and player remain anchored at the origin.
// ============================================================
import * as THREE from 'three';
import { CONFIG, RAIL_ARENA } from '../../config.js';

export class RailScenery {
  constructor(scene, player, rng) {
    this.scene = scene;
    this.player = player;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.layers = { near: [], mid: [], far: [] };
    this.materials = this._createMaterials();
    this._buildBoat();
    this._buildRiver(rng);
  }

  _createMaterials() {
    return {
      hull: new THREE.MeshStandardMaterial({ color: 0x513522, roughness: 0.92 }),
      trim: new THREE.MeshStandardMaterial({ color: 0xd59a3a, roughness: 0.78 }),
      cloth: new THREE.MeshStandardMaterial({ color: 0xa94747, roughness: 1, side: THREE.DoubleSide }),
      bank: new THREE.MeshStandardMaterial({ color: 0x17342e, roughness: 1 }),
      foliage: new THREE.MeshStandardMaterial({ color: 0x254c3c, roughness: 1, flatShading: true }),
      silhouette: new THREE.MeshStandardMaterial({ color: 0x13252a, roughness: 1 }),
      glow: new THREE.MeshBasicMaterial({
        color: 0xffb85c, transparent: true, opacity: 0.78,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
      foam: new THREE.MeshBasicMaterial({
        color: 0x9be4dc, transparent: true, opacity: 0.34,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    };
  }

  _buildBoat() {
    this.boat = new THREE.Group();
    this.boat.position.y = CONFIG.WATER_LEVEL + 0.3;
    this.root.add(this.boat);

    const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.72, 5.2, 6, 12), this.materials.hull);
    hull.rotation.x = Math.PI / 2;
    hull.scale.set(1.35, 1, 0.62);
    this.boat.add(hull);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 4.8), this.materials.trim);
    deck.position.y = 0.55;
    this.boat.add(deck);

    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3.4, 6), this.materials.hull);
      arm.rotation.z = Math.PI / 2;
      arm.position.set(side * 1.6, 0.25, 0);
      this.boat.add(arm);
      const float = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 3.4, 4, 8), this.materials.hull);
      float.rotation.x = Math.PI / 2;
      float.position.set(side * 3.2, 0.05, 0);
      this.boat.add(float);
    }

    const prow = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.5, 7), this.materials.trim);
    prow.rotation.x = -Math.PI / 2;
    prow.position.set(0, 0.75, -3.25);
    this.boat.add(prow);
  }

  _buildRiver(rng) {
    const total = RAIL_ARENA.CHUNK_COUNT * RAIL_ARENA.CHUNK_LENGTH;
    for (const layer of Object.keys(this.layers)) {
      for (let i = 0; i < RAIL_ARENA.CHUNK_COUNT; i++) {
        const chunk = this._makeChunk(layer, i, rng);
        chunk.position.z = -10 - i * RAIL_ARENA.CHUNK_LENGTH;
        chunk.userData.total = total;
        this.layers[layer].push(chunk);
        this.root.add(chunk);
      }
    }

    this.foam = [];
    for (let i = 0; i < 14; i++) {
      const streak = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 2.6), this.materials.foam);
      streak.rotation.x = -Math.PI / 2;
      streak.position.set((rng() - 0.5) * 9, CONFIG.WATER_LEVEL + 0.035, -i * 8);
      this.root.add(streak);
      this.foam.push(streak);
    }
  }

  _makeChunk(layer, index, rng) {
    const group = new THREE.Group();
    const sideOffset = layer === 'near' ? 9 : layer === 'mid' ? 15 : 24;
    const scale = layer === 'near' ? 1 : layer === 'mid' ? 0.72 : 0.5;
    for (const side of [-1, 1]) {
      if (layer === 'near') {
        const bank = new THREE.Mesh(
          new THREE.BoxGeometry(5, 0.8, RAIL_ARENA.CHUNK_LENGTH + 1), this.materials.bank,
        );
        bank.position.set(side * (sideOffset + 2.2), CONFIG.WATER_LEVEL - 0.35, 0);
        group.add(bank);
      }

      const count = layer === 'far' ? 2 : 3;
      for (let i = 0; i < count; i++) {
        const z = -RAIL_ARENA.CHUNK_LENGTH / 2 + 3 + i * 5.5 + (rng() - 0.5) * 1.5;
        const x = side * (sideOffset + rng() * 2.5);
        if ((index + i) % 3 === 0 && layer !== 'far') {
          group.add(this._makeFestivalMast(x, z, scale));
        } else {
          group.add(this._makeMangrove(x, z, scale, rng));
        }
      }

      if (layer === 'far') {
        const building = new THREE.Mesh(
          new THREE.BoxGeometry(7 * scale, (8 + rng() * 7) * scale, 5 * scale),
          this.materials.silhouette,
        );
        building.position.set(side * sideOffset, building.geometry.parameters.height / 2, 0);
        group.add(building);
      }
    }
    return group;
  }

  _makeMangrove(x, z, scale, rng) {
    const group = new THREE.Group();
    const height = (5 + rng() * 3) * scale;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16 * scale, 0.34 * scale, height, 6), this.materials.hull,
    );
    trunk.position.y = height / 2;
    group.add(trunk);
    for (let i = 0; i < 2; i++) {
      const crown = new THREE.Mesh(
        new THREE.IcosahedronGeometry((1.2 + rng() * 0.6) * scale, 0), this.materials.foliage,
      );
      crown.position.set((rng() - 0.5) * scale, height + i * 0.45, (rng() - 0.5) * scale);
      crown.scale.y = 0.65;
      group.add(crown);
    }
    group.position.set(x, 0, z);
    return group;
  }

  _makeFestivalMast(x, z, scale) {
    const group = new THREE.Group();
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08 * scale, 0.12 * scale, 6 * scale, 6), this.materials.hull,
    );
    mast.position.y = 3 * scale;
    group.add(mast);
    const lantern = new THREE.Mesh(new THREE.OctahedronGeometry(0.65 * scale, 0), this.materials.glow);
    lantern.position.y = 5.4 * scale;
    group.add(lantern);
    for (const side of [-1, 1]) {
      const pennant = new THREE.Mesh(new THREE.ConeGeometry(0.28 * scale, 0.8 * scale, 3), this.materials.cloth);
      pennant.rotation.z = side * Math.PI / 2;
      pennant.position.set(side * 0.65 * scale, 4.2 * scale, 0);
      group.add(pennant);
    }
    group.position.set(x, 0, z);
    return group;
  }

  update(dt, t) {
    for (const [layer, chunks] of Object.entries(this.layers)) {
      const speed = RAIL_ARENA.SCROLL_SPEED * RAIL_ARENA.LAYER_SPEED[layer];
      for (const chunk of chunks) {
        chunk.position.z += speed * dt;
        if (chunk.position.z > RAIL_ARENA.CHUNK_LENGTH) chunk.position.z -= chunk.userData.total;
      }
    }
    for (const streak of this.foam) {
      streak.position.z += RAIL_ARENA.SCROLL_SPEED * 1.4 * dt;
      if (streak.position.z > 10) streak.position.z -= 112;
    }

    const bob = Math.sin(t * 1.35) * 0.1 + Math.sin(t * 2.1 + 0.8) * 0.025;
    const roll = Math.sin(t * 0.92) * 0.035;
    this.boat.position.y = CONFIG.WATER_LEVEL + 0.3 + bob;
    this.boat.rotation.z = roll;
    this.boat.rotation.x = Math.sin(t * 0.71) * 0.018;

    const object = this.player.controls.getObject();
    object.position.y = RAIL_ARENA.BOAT_EYE_BASE + CONFIG.EYE_HEIGHT +
      Math.sin(t * 1.35) * RAIL_ARENA.CAMERA_BOB;
    object.rotation.z = Math.sin(t * 0.92) * RAIL_ARENA.CAMERA_ROLL;
  }

  dispose() {
    const object = this.player.controls.getObject();
    object.rotation.z = 0;
    this.scene.remove(this.root);
    this.root.traverse((child) => { if (child.geometry) child.geometry.dispose(); });
    for (const material of Object.values(this.materials)) material.dispose();
  }
}
