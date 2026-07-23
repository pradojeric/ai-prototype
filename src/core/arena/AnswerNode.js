// ============================================================
// ANSWER NODE (Strings v2.0) — a breakable, shootable "coral node" carrying one
// bugtong answer during a Memory Arena riddle round. Three of these spawn in a
// fan in front of the player; the Feastkeeper's riddle text shows on the HUD
// banner and the player casts a light-bolt at the node whose label is correct.
// The ArenaController owns spawning/hit-testing; this class owns the mesh, the
// billboard label, the bolt hit test, and the break animation.
// ============================================================
import * as THREE from 'three';
import { ARENA } from '../../config.js';

// Render a choice's text to a canvas → sprite so the label always faces the
// camera without per-frame billboard math (THREE.Sprite is view-aligned).
export function makeAnswerLabelTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 160;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(4, 18, 26, 0.82)';
  ctx.strokeStyle = 'rgba(127, 232, 255, 0.9)';
  ctx.lineWidth = 6;
  const r = 24;
  // rounded panel
  ctx.beginPath();
  ctx.moveTo(r, 8); ctx.lineTo(canvas.width - r, 8);
  ctx.quadraticCurveTo(canvas.width - 8, 8, canvas.width - 8, r);
  ctx.lineTo(canvas.width - 8, canvas.height - r);
  ctx.quadraticCurveTo(canvas.width - 8, canvas.height - 8, canvas.width - r, canvas.height - 8);
  ctx.lineTo(r, canvas.height - 8);
  ctx.quadraticCurveTo(8, canvas.height - 8, 8, canvas.height - r);
  ctx.lineTo(8, r);
  ctx.quadraticCurveTo(8, 8, r, 8);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  ctx.fillStyle = '#eafdff';
  ctx.font = 'bold 52px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width - 40);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

export class AnswerNode {
  // `choice` is { text, correct }; `pos` is the world-space ring position.
  constructor(scene, choice, pos, options = {}) {
    this.scene = scene;
    this.choice = choice;
    this.correct = !!choice.correct;
    this.pos = pos.clone();
    this.broken = false;
    this.inert = false;   // locked out after a wrong answer — dimmed, unshootable
    this.dead = false;
    this._fade = 1;
    this._t0 = Math.random() * Math.PI * 2;   // bob phase offset
    this._labelScale = options.labelScale || 1;

    this.group = new THREE.Group();
    this.group.position.copy(this.pos);
    scene.add(this.group);

    // Coral cluster body — a bright emissive core wrapped in a few rough shards
    // so it reads as a shootable target (correct/wrong look identical on purpose).
    this.coreMat = new THREE.MeshStandardMaterial({
      color: 0xdffbff, emissive: 0x2f6f6a, emissiveIntensity: 1.4,
      roughness: 0.4, transparent: true, opacity: 1,
    });
    this.shardMat = new THREE.MeshStandardMaterial({
      color: 0x1c3a40, roughness: 1, transparent: true, opacity: 1,
    });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), this.coreMat);
    this.group.add(core);
    for (let i = 0; i < 5; i++) {
      const shard = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.7, 5), this.shardMat);
      const a = (i / 5) * Math.PI * 2;
      shard.position.set(Math.cos(a) * 0.45, Math.sin(a * 1.3) * 0.3, Math.sin(a) * 0.45);
      shard.rotation.set(Math.random(), a, Math.random());
      this.group.add(shard);
    }

    // Local glow so the node lifts off the dark arena.
    this.halo = new THREE.PointLight(0x8fe6ff, 1.6, 6, 1.6);
    this.group.add(this.halo);

    // Billboard label floating just above the coral.
    this.labelTex = makeAnswerLabelTexture(choice.text);
    this.labelMat = new THREE.SpriteMaterial({ map: this.labelTex, transparent: true, depthWrite: false });
    this.label = new THREE.Sprite(this.labelMat);
    this.label.scale.set(3.2 * this._labelScale, 1.0 * this._labelScale, 1);
    this.label.position.y = 1.4;
    this.group.add(this.label);

    // One-shot break puff (allocated once).
    this._poofN = 18;
    const pg = new THREE.BufferGeometry();
    this._poofPos = new Float32Array(this._poofN * 3);
    this._poofVel = new Float32Array(this._poofN * 3);
    pg.setAttribute('position', new THREE.BufferAttribute(this._poofPos, 3));
    this._poofMat = new THREE.PointsMaterial({
      color: 0x9ff3ff, size: 0.26, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this._poof = new THREE.Points(pg, this._poofMat);
    this._poof.frustumCulled = false;
    this._poofLife = 0;
    scene.add(this._poof);

    this._v = new THREE.Vector3();
  }

  // World-space center of the node (bolt hit-test target).
  center(out) {
    return out.set(this.group.position.x, this.group.position.y, this.group.position.z);
  }

  // Is a bolt at `boltPos` (radius `boltR`) overlapping this node? Squared
  // distance only — same idiom as CombatManager's enemy hit test.
  // Lock the node out of the round (wrong-answer penalty). The dimming in
  // update() is the only tell the player needs: a dark node is not answerable.
  setInert(flag) { this.inert = !!flag; }

  hitTest(boltPos, boltR) {
    if (this.broken || this.inert) return false;
    const rr = (ARENA.NODE_RADIUS + boltR) ** 2;
    this.center(this._v);
    return boltPos.distanceToSquared(this._v) <= rr;
  }

  // Shatter: puff + fade out. Marks `dead` once the fade + puff finish.
  break() {
    if (this.broken) return;
    this.broken = true;
    this._poof.position.copy(this.group.position);
    for (let i = 0; i < this._poofN; i++) {
      this._poofPos[i * 3] = 0; this._poofPos[i * 3 + 1] = 0; this._poofPos[i * 3 + 2] = 0;
      const ax = Math.random() * 2 - 1, ay = Math.random() * 1.6 - 0.2, az = Math.random() * 2 - 1;
      const inv = (1.6 + Math.random() * 2.2) / Math.max(0.001, Math.hypot(ax, ay, az));
      this._poofVel[i * 3] = ax * inv;
      this._poofVel[i * 3 + 1] = ay * inv;
      this._poofVel[i * 3 + 2] = az * inv;
    }
    this._poof.geometry.attributes.position.needsUpdate = true;
    this._poofLife = 1;
    this._poofMat.opacity = 0.9;
  }

  update(dt, t) {
    // Break puff advances regardless of state.
    if (this._poofLife > 0) {
      this._poofLife = Math.max(0, this._poofLife - dt * 1.8);
      for (let i = 0; i < this._poofN; i++) {
        this._poofPos[i * 3] += this._poofVel[i * 3] * dt;
        this._poofPos[i * 3 + 1] += (this._poofVel[i * 3 + 1] - 0.6) * dt;
        this._poofPos[i * 3 + 2] += this._poofVel[i * 3 + 2] * dt;
      }
      this._poof.geometry.attributes.position.needsUpdate = true;
      this._poofMat.opacity = 0.9 * this._poofLife;
    }

    if (this.broken) {
      this._fade = Math.max(0, this._fade - dt / 0.25);
      const f = this._fade;
      this.coreMat.opacity = f; this.shardMat.opacity = f; this.labelMat.opacity = f;
      this.halo.intensity = 1.6 * f;
      this.group.scale.setScalar(0.4 + 0.6 * f);
      this.group.visible = f > 0.02;
      if (f <= 0.02 && this._poofLife <= 0) this.dead = true;
      return;
    }

    // Locked out: the bob and pulse stop dead and the coral goes cold, so a
    // node the player cannot answer with never looks like one they can.
    if (this.inert) {
      this.group.position.copy(this.pos);
      this.coreMat.emissiveIntensity = 0.12;
      this.coreMat.opacity = 0.45;
      this.shardMat.opacity = 0.45;
      this.labelMat.opacity = 0.35;
      this.halo.intensity = 0.15;
      return;
    }

    // Idle: gentle bob + spin so the target reads as alive, plus a soft glow pulse.
    const y = this.pos.y + Math.sin(t * 1.8 + this._t0) * 0.14;
    this.group.position.set(this.pos.x, y, this.pos.z);
    this.group.rotation.y = t * 0.7;
    this.coreMat.opacity = 1;
    this.shardMat.opacity = 1;
    this.labelMat.opacity = 1;
    this.coreMat.emissiveIntensity = 1.2 + Math.sin(t * 3 + this._t0) * 0.4;
    this.halo.intensity = 1.4 + Math.sin(t * 3 + this._t0) * 0.4;
  }

  dispose() {
    this.scene.remove(this.group);
    this.scene.remove(this._poof);
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.coreMat.dispose();
    this.shardMat.dispose();
    this.labelMat.dispose();
    this.labelTex.dispose();
    this._poof.geometry.dispose();
    this._poofMat.dispose();
  }
}
