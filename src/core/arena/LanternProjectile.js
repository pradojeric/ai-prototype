// ============================================================
// LANTERN PROJECTILE — one riddle answer formed by The Reveler. All three
// travel to a wide midpoint formation, stop through a protected reading beat,
// then launch together. Correct answers can be deflected while decoys dissolve.
// ============================================================
import * as THREE from 'three';
import { COMBAT, RAIL_ARENA } from '../../config.js';
import { makeAnswerLabelTexture } from './AnswerNode.js';

export class LanternProjectile {
  constructor(scene, choice, start, hover, target, deflectTarget, lane = 0) {
    this.scene = scene;
    this.choice = choice;
    this.correct = !!choice.correct;
    this.start = start.clone();
    this.hover = hover.clone();
    this.target = target.clone();
    this.deflectTarget = deflectTarget.clone();
    this.lane = lane;
    this.age = 0;
    this.state = 'staging';
    this.dead = false;
    this.impactReady = false;
    this._fade = 1;
    this._stageAge = 0;
    this._deflectAge = 0;

    this.group = new THREE.Group();
    this.group.position.copy(start);
    scene.add(this.group);

    this.bodyMat = new THREE.MeshStandardMaterial({
      color: 0xe8a650, emissive: 0x9d4a22, emissiveIntensity: 1.5,
      roughness: 0.52, transparent: true, opacity: 0.96,
    });
    this.frameMat = new THREE.MeshStandardMaterial({
      color: 0x4c2f22, roughness: 0.9, transparent: true, opacity: 1,
    });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.9, 10), this.bodyMat);
    this.group.add(body);
    for (const y of [-0.5, 0.5]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.045, 6, 14), this.frameMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      this.group.add(ring);
    }
    const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 5), this.frameMat);
    tassel.position.y = -0.7;
    tassel.rotation.z = Math.PI;
    this.group.add(tassel);

    this.labelTex = makeAnswerLabelTexture(choice.text);
    this.labelMat = new THREE.SpriteMaterial({ map: this.labelTex, transparent: true, depthWrite: false });
    this.label = new THREE.Sprite(this.labelMat);
    this.label.scale.set(3.2, 1, 1);
    this.label.position.y = 1.35;
    this.group.add(this.label);
    this._center = new THREE.Vector3();
  }

  hitTest(position) {
    if (this.state !== 'flying') return false;
    const radius = RAIL_ARENA.LANTERN_RADIUS + COMBAT.BOLT.RADIUS;
    return position.distanceToSquared(this.group.position) <= radius * radius;
  }

  consumeImpact() {
    if (!this.impactReady) return false;
    this.impactReady = false;
    return true;
  }

  holdForReading() {
    if (this.state !== 'staging') return;
    this.state = 'reading';
    this.group.position.copy(this.hover);
  }

  launch() {
    if (this.state !== 'reading') return;
    this.state = 'flying';
    this.age = 0;
    this.start.copy(this.group.position);
  }

  deflect() {
    if (this.state !== 'flying') return;
    this.state = 'deflected';
    this._deflectAge = 0;
    this.start.copy(this.group.position);
  }

  dismiss() {
    if (this.state === 'fading' || this.dead) return;
    this.state = 'fading';
  }

  update(dt, t) {
    if (this.state === 'staging') {
      this._stageAge += dt;
      const p = Math.min(1, this._stageAge / RAIL_ARENA.LANTERN_STAGE_TRAVEL);
      const eased = 1 - (1 - p) ** 3;
      this.group.position.lerpVectors(this.start, this.hover, eased);
      this.group.position.y += Math.sin(p * Math.PI) * 0.65;
      this.group.rotation.y = t * 1.25 + this.lane;
      this.group.rotation.z = Math.sin(t * 2.2 + this.lane) * 0.08;
      this.bodyMat.emissiveIntensity = 1.35 + Math.sin(t * 4 + this.lane) * 0.25;
      return;
    }

    if (this.state === 'reading') {
      // Position is deliberately exact and still: equal Y/Z plus the authored
      // X spacing makes the three labels easy to scan before they attack.
      this.group.position.copy(this.hover);
      this.group.rotation.y = t * 0.75 + this.lane;
      this.group.rotation.z = 0;
      this.bodyMat.emissiveIntensity = 1.45 + Math.sin(t * 3 + this.lane) * 0.18;
      return;
    }

    if (this.state === 'flying') {
      this.age += dt;
      const p = Math.min(1, this.age / RAIL_ARENA.LANTERN_FLIGHT);
      this.group.position.lerpVectors(this.start, this.target, p);
      this.group.position.y += Math.sin(p * Math.PI) * 2.4;
      this.group.position.x += Math.sin(p * Math.PI) * this.lane * 0.55;
      this.group.rotation.y = t * 1.7 + this.lane;
      this.group.rotation.z = Math.sin(t * 3 + this.lane) * 0.14;
      this.bodyMat.emissiveIntensity = 1.3 + Math.sin(t * 5 + this.lane) * 0.35;
      if (p >= 1) this.impactReady = true;
      return;
    }

    if (this.state === 'deflected') {
      this._deflectAge += dt;
      const p = Math.min(1, this._deflectAge / 0.55);
      this.group.position.lerpVectors(this.start, this.deflectTarget, p);
      this.group.position.y += Math.sin(p * Math.PI) * 1.8;
      this.group.scale.setScalar(1 + Math.sin(p * Math.PI) * 0.55);
      this.group.rotation.y += dt * 8;
      if (p >= 1) this.state = 'fading';
      return;
    }

    this._fade = Math.max(0, this._fade - dt / 0.24);
    this.bodyMat.opacity = 0.96 * this._fade;
    this.frameMat.opacity = this._fade;
    this.labelMat.opacity = this._fade;
    this.group.scale.setScalar(Math.max(0.05, this._fade));
    if (this._fade <= 0.01) this.dead = true;
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((object) => { if (object.geometry) object.geometry.dispose(); });
    this.bodyMat.dispose();
    this.frameMat.dispose();
    this.labelMat.dispose();
    this.labelTex.dispose();
  }
}
