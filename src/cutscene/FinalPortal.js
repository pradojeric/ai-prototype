// ============================================================
// FINAL PORTAL — cinematic-only portal spawned for the last recovered memory
// ============================================================
import * as THREE from 'three';
import { CONFIG, ENDING, PLAYER_RADIUS, clamp01 } from '../config.js';

export function chooseFinalPortalPosition(world, playerPos, forward) {
  const base = Math.atan2(forward.x, forward.z);
  // Prefer a three-quarter angle so the cinematic has a readable camera turn;
  // fall back toward straight ahead only when nearby geometry blocks it.
  const offsets = [0.75, -0.75, 1.2, -1.2, 0, Math.PI];
  for (const offset of offsets) {
    const a = base + offset;
    const x = playerPos.x + Math.sin(a) * ENDING.PORTAL.DISTANCE;
    const z = playerPos.z + Math.cos(a) * ENDING.PORTAL.DISTANCE;
    if (Math.abs(x) > CONFIG.ZONE_HALF - 3 || Math.abs(z) > CONFIG.ZONE_HALF - 3) continue;
    if (!world.collidesAt(x, z, PLAYER_RADIUS + 1.1)) {
      return new THREE.Vector3(x, Math.max(2.5, playerPos.y - 0.15), z);
    }
  }
  return new THREE.Vector3(
    Math.max(-CONFIG.ZONE_HALF + 3, Math.min(CONFIG.ZONE_HALF - 3, playerPos.x)),
    Math.max(2.5, playerPos.y - 0.15),
    Math.max(-CONFIG.ZONE_HALF + 3, Math.min(CONFIG.ZONE_HALF - 3, playerPos.z - 5)),
  );
}

export class FinalPortal {
  constructor(scene, position, faceTarget) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.group.lookAt(faceTarget.x, position.y, faceTarget.z);
    this.scene.add(this.group);
    this._geos = [];
    this._mats = [];
    this._time = 0;
    this.progress = 0;

    const radius = ENDING.PORTAL.RADIUS;
    this.coreMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uReveal: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        uniform float uReveal;
        void main() {
          vec2 p = (vUv - .5) * 2.;
          float r = length(p);
          float a = atan(p.y, p.x);
          float spiral = .5 + .5 * sin(a * 5. - r * 13. + uTime * 4.);
          float disc = 1. - smoothstep(.72, 1., r);
          float core = smoothstep(.42, 0., r);
          vec3 col = mix(vec3(.03, .22, .45), vec3(.25, .95, 1.), spiral);
          col += vec3(.8, .95, 1.) * core * 2.;
          gl_FragColor = vec4(col * (spiral + core) * uReveal, disc * uReveal);
        }
      `,
    });
    this._mats.push(this.coreMat);
    const core = new THREE.Mesh(this._geo(new THREE.CircleGeometry(radius * 0.88, 64)), this.coreMat);
    this.group.add(core);

    const ringMat = this._mat(new THREE.MeshStandardMaterial({
      color: 0x9ffcff, emissive: 0x4adfff, emissiveIntensity: 4,
      metalness: 0.35, roughness: 0.2, transparent: true, opacity: 0,
    }));
    this.rings = [];
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        this._geo(new THREE.TorusGeometry(radius * (0.9 + i * 0.12), 0.055, 10, 64)),
        ringMat,
      );
      ring.rotation.set(i * 0.35, i * 0.2, i * 0.7);
      this.group.add(ring);
      this.rings.push(ring);
    }

    const count = 280;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = radius * (0.7 + Math.random() * 0.65);
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = Math.sin(a) * r;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.8;
    }
    const pGeo = this._geo(new THREE.BufferGeometry());
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.particleMat = this._mat(new THREE.PointsMaterial({
      color: 0xa8ffff, size: 0.075, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.particles = new THREE.Points(pGeo, this.particleMat);
    this.group.add(this.particles);

    this.stringMats = [];
    this.strings = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const start = new THREE.Vector3(Math.cos(a) * (radius + 4), Math.sin(a) * (radius + 2), 0.5);
      const mid = start.clone().multiplyScalar(0.48);
      mid.z = 1.1 + (i % 3) * 0.25;
      const curve = new THREE.QuadraticBezierCurve3(start, mid, new THREE.Vector3(0, 0, 0.12));
      const geo = this._geo(new THREE.BufferGeometry().setFromPoints(curve.getPoints(36)));
      const mat = this._mat(new THREE.LineBasicMaterial({
        color: i % 2 ? 0xffd9a0 : 0x82fff2, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      const line = new THREE.Line(geo, mat);
      this.group.add(line);
      this.strings.push(line);
      this.stringMats.push(mat);
    }

    this.light = new THREE.PointLight(0x76eaff, 0, 18, 1.5);
    this.group.add(this.light);
    this.group.scale.setScalar(0.02);
  }

  _geo(geo) { this._geos.push(geo); return geo; }
  _mat(mat) { this._mats.push(mat); return mat; }

  update(dt, t, progress) {
    this._time += dt;
    this.progress = clamp01(progress);
    const reveal = this.progress * this.progress * (3 - 2 * this.progress);
    this.group.scale.setScalar(Math.max(0.02, reveal));
    this.coreMat.uniforms.uTime.value = t;
    this.coreMat.uniforms.uReveal.value = reveal;
    this.rings.forEach((ring, i) => {
      ring.rotation.z += dt * (0.65 + i * 0.35) * (i % 2 ? -1 : 1);
      ring.rotation.x += dt * 0.16 * (i + 1);
      ring.material.opacity = reveal;
    });
    this.particles.rotation.z -= dt * (0.25 + reveal * 0.8);
    this.particleMat.opacity = reveal * 0.85;
    this.stringMats.forEach((mat, i) => {
      mat.opacity = reveal * (0.3 + 0.45 * (0.5 + 0.5 * Math.sin(t * 3.2 + i)));
      const head = Math.floor((t * 15 + i * 5) % 37);
      this.strings[i].geometry.setDrawRange(head, Math.min(12, 37 - head));
    });
    this.light.intensity = reveal * (2.5 + this.progress * 8);
  }

  dispose() {
    this.scene.remove(this.group);
    for (const geo of this._geos) geo.dispose();
    for (const mat of this._mats) mat.dispose();
    this._geos.length = 0;
    this._mats.length = 0;
  }
}
