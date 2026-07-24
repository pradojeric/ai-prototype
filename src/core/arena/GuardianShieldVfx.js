// ============================================================
// GUARDIAN SHIELD VFX — persistent riddle armor for Arena 1 and Arena 2.
// The full-body ellipsoid is both the visible barrier and the protected hit
// volume. Each correct answer adds another authored fracture; the third answer
// shatters the shell and hands the same guardian body to the live boss phase.
//
// This helper also owns brief body flashes/recoil so armor breaks, real boss
// hits, and health-threshold phase changes share one clean feedback language.
// All geometry is built once and disposed explicitly; per-frame work reuses
// scratch state and the shared CombatVfx pools.
// ============================================================
import * as THREE from 'three';

const TOTAL_LAYERS = 3;
const SHATTER_DURATION = 0.78;

const SHIELD_STYLES = {
  zone1: {
    shell: 0xffd47a,
    accent: 0xff7d3e,
    lattice: 0xffbd57,
    crack: 0xffffd6,
    latticeOpacity: 0.12,
    shaderStyle: 0,
  },
  zone2: {
    shell: 0x92f3ff,
    accent: 0xff718f,
    lattice: 0x55dcea,
    crack: 0xe7fdff,
    latticeOpacity: 0.1,
    shaderStyle: 1,
  },
};

// Crack paths are authored in normalized shield-front XY space. Each later
// stage extends earlier branches instead of replacing them, so progress reads
// cumulatively from anywhere in the arena.
const CRACK_PATHS = [
  [
    [[-0.04, 0.62], [0.04, 0.43], [-0.03, 0.25], [0.07, 0.06], [-0.01, -0.16]],
    [[0.02, 0.43], [-0.2, 0.34], [-0.35, 0.18]],
    [[-0.01, 0.25], [0.23, 0.18], [0.38, 0.02]],
  ],
  [
    [[-0.01, -0.16], [0.2, -0.32], [0.31, -0.53]],
    [[-0.02, -0.14], [-0.23, -0.3], [-0.42, -0.36], [-0.55, -0.5]],
    [[-0.2, 0.34], [-0.38, 0.43], [-0.55, 0.39]],
    [[0.23, 0.18], [0.46, 0.27], [0.6, 0.19]],
  ],
  [
    [[0.04, 0.44], [0.23, 0.58], [0.38, 0.71]],
    [[-0.04, 0.59], [-0.2, 0.72], [-0.31, 0.82]],
    [[0.38, 0.02], [0.57, -0.08], [0.72, -0.04]],
    [[-0.42, -0.36], [-0.58, -0.25], [-0.72, -0.29]],
    [[0.2, -0.32], [0.46, -0.46], [0.61, -0.64]],
    [[-0.01, -0.16], [-0.05, -0.43], [0.04, -0.7]],
  ],
];

function shieldMaterial(style) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uPulse: { value: 0 },
      uShell: { value: new THREE.Color(style.shell) },
      uAccent: { value: new THREE.Color(style.accent) },
      uStyle: { value: style.shaderStyle },
    },
    vertexShader: `
      varying vec3 vLocalPosition;
      varying vec3 vViewNormal;
      varying vec3 vViewDirection;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vLocalPosition = position;
        vViewNormal = normalize(normalMatrix * normal);
        vViewDirection = normalize(-viewPosition.xyz);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      uniform float uPulse;
      uniform vec3 uShell;
      uniform vec3 uAccent;
      uniform float uStyle;

      varying vec3 vLocalPosition;
      varying vec3 vViewNormal;
      varying vec3 vViewDirection;

      void main() {
        float facing = abs(dot(normalize(vViewNormal), normalize(vViewDirection)));
        float fresnel = pow(1.0 - clamp(facing, 0.0, 1.0), 2.15);

        float warpA = sin((vLocalPosition.x + vLocalPosition.y) * 22.0 + uTime * 0.7);
        float warpB = sin((vLocalPosition.x - vLocalPosition.y) * 18.0 - uTime * 0.55);
        float woven = smoothstep(0.76, 1.0, abs(warpA * warpB));

        float tideRadius = length(vLocalPosition.xy);
        float tideA = sin(tideRadius * 25.0 - uTime * 1.8);
        float tideB = sin(
          (vLocalPosition.x * 13.0 + vLocalPosition.y * 9.0) + uTime * 0.9
        );
        float tide = smoothstep(0.78, 1.0, abs(tideA * 0.68 + tideB * 0.32));
        float pattern = mix(woven, tide, uStyle);

        float scan = smoothstep(
          0.78,
          1.0,
          sin(vLocalPosition.y * 10.0 - uTime * 1.25) * 0.5 + 0.5
        );
        float energy = clamp(fresnel * 0.9 + pattern * 0.3 + scan * 0.08, 0.0, 1.0);
        vec3 color = mix(uShell, uAccent, clamp(pattern * 0.36 + fresnel * 0.22, 0.0, 0.62));
        float alpha = (
          0.045 + fresnel * 0.34 + pattern * 0.075 + scan * 0.025
        ) * uOpacity * (1.0 + uPulse * 0.45);

        gl_FragColor = vec4(color * (0.84 + energy * 0.55), alpha);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

function measureShield(guardian) {
  const bounds = new THREE.Box3().setFromObject(guardian.figure);
  const size = bounds.getSize(new THREE.Vector3());
  return new THREE.Vector3(
    THREE.MathUtils.clamp(size.x * 0.5 + 0.7, 3.2, 4.7),
    THREE.MathUtils.clamp(size.y * 0.5 + 0.8, 3.8, 5.0),
    THREE.MathUtils.clamp(size.z * 0.5 + 0.9, 2.9, 4.1),
  );
}

function pointOnFront(x, y) {
  const z = Math.sqrt(Math.max(0.035, 1 - x * x - y * y)) * 1.012;
  return new THREE.Vector3(x, y, z);
}

export class GuardianShieldVfx {
  constructor(guardian, combat, style = 'zone1') {
    this.guardian = guardian;
    this.combat = combat;
    this.styleName = SHIELD_STYLES[style] ? style : 'zone1';
    this.style = SHIELD_STYLES[this.styleName];
    this.scene = combat?.scene || null;
    this.camera = combat?.camera || null;

    this._time = 0;
    this._mode = 'shielded';
    this._stage = 0;
    this._blocking = true;
    this._impactPulse = 0;
    this._breakPulse = 0;
    this._shatterAge = 0;
    this._pendingDelay = -1;
    this._pendingRemaining = TOTAL_LAYERS;
    this._reactionAge = 0;
    this._reactionDuration = 0;
    this._reactionStrength = 0;
    this._flashAge = 0;
    this._flashDuration = 0;
    this._flashStrength = 0;
    this._disposed = false;

    this._center = new THREE.Vector3();
    this._impactPoint = new THREE.Vector3();
    this._radii = measureShield(guardian);
    this._baseScale = this._radii.clone();
    this._figureBaseRotationX = guardian?.figure?.rotation.x || 0;

    this.root = new THREE.Group();
    this.root.renderOrder = 4;

    this._shellGeometry = new THREE.SphereGeometry(1, 32, 20);
    this._shellMaterial = shieldMaterial(this.style);
    this.shell = new THREE.Mesh(this._shellGeometry, this._shellMaterial);
    this.shell.renderOrder = 4;
    this.root.add(this.shell);

    this._latticeGeometry = this.styleName === 'zone2'
      ? new THREE.IcosahedronGeometry(1.008, 2)
      : new THREE.SphereGeometry(1.008, 18, 12);
    this._latticeMaterial = new THREE.MeshBasicMaterial({
      color: this.style.lattice,
      wireframe: true,
      transparent: true,
      opacity: this.style.latticeOpacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.lattice = new THREE.Mesh(this._latticeGeometry, this._latticeMaterial);
    this.lattice.renderOrder = 5;
    this.lattice.rotation.z = this.styleName === 'zone2' ? 0.28 : 0.16;
    this.root.add(this.lattice);

    this._crackGroups = [];
    this._crackMaterials = [];
    this._crackGeometries = [];
    this._buildCracks();

    this._flashMaterials = [];
    for (const [material] of guardian?._fadeMats || []) {
      if (!material || typeof material.emissiveIntensity !== 'number') continue;
      this._flashMaterials.push({
        material,
        base: material.emissiveIntensity,
      });
    }

    this._syncTransform();
    this._applyShieldVisuals();
    this.scene?.add(this.root);
  }

  _buildCracks() {
    for (let stage = 0; stage < CRACK_PATHS.length; stage++) {
      const group = new THREE.Group();
      group.visible = false;
      const material = new THREE.LineBasicMaterial({
        color: this.style.crack,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
      });

      for (const path of CRACK_PATHS[stage]) {
        const points = [];
        for (const [x, y] of path) points.push(pointOnFront(x, y));
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, material);
        line.renderOrder = 7;
        group.add(line);
        this._crackGeometries.push(geometry);
      }

      this._crackGroups.push(group);
      this._crackMaterials.push(material);
      this.root.add(group);
    }
  }

  _syncTransform() {
    if (!this.guardian || !this.root) return;
    this._center.copy(this.guardian.center());
    this.root.position.copy(this._center);
    if (this.camera) {
      const dx = this.camera.position.x - this._center.x;
      const dz = this.camera.position.z - this._center.z;
      this.root.rotation.y = Math.atan2(dx, dz);
    }
  }

  _triggerFlash(strength, duration) {
    if (this._flashAge <= 0) {
      for (const entry of this._flashMaterials) {
        entry.base = entry.material.emissiveIntensity;
      }
    }
    this._flashStrength = Math.max(this._flashStrength, strength);
    this._flashDuration = Math.max(this._flashDuration, duration);
    this._flashAge = Math.max(this._flashAge, duration);
  }

  _triggerReaction(strength, duration) {
    if (this._reactionAge <= 0 && this.guardian?.figure) {
      this._figureBaseRotationX = this.guardian.figure.rotation.x;
    }
    this._reactionStrength = Math.max(this._reactionStrength, strength);
    this._reactionDuration = Math.max(this._reactionDuration, duration);
    this._reactionAge = Math.max(this._reactionAge, duration);
  }

  _executeBreak(remaining) {
    if (this._mode === 'hidden') return;
    const safeRemaining = THREE.MathUtils.clamp(Math.floor(remaining), 0, TOTAL_LAYERS);
    const stage = TOTAL_LAYERS - safeRemaining;
    this._stage = Math.max(this._stage, stage);
    for (let i = 0; i < this._crackGroups.length; i++) {
      this._crackGroups[i].visible = i < this._stage;
    }

    const final = safeRemaining <= 0;
    this._breakPulse = 1;
    this.combat?.vfx?.armorBreak?.(this._center, this.styleName, final);
    this._triggerFlash(final ? 2.25 : 1.35, final ? 0.42 : 0.26);
    this._triggerReaction(final ? 0.15 : 0.085, final ? 0.5 : 0.3);

    if (final) {
      this._blocking = false;
      this._mode = 'shattering';
      this._shatterAge = 0;
    }
    this._applyShieldVisuals();
  }

  _updateFlash(dt) {
    if (this._flashAge <= 0) return;
    this._flashAge = Math.max(0, this._flashAge - dt);
    const envelope = this._flashDuration > 0
      ? (this._flashAge / this._flashDuration) ** 2
      : 0;
    for (const entry of this._flashMaterials) {
      entry.material.emissiveIntensity = entry.base + this._flashStrength * envelope;
    }
    if (this._flashAge > 0) return;
    for (const entry of this._flashMaterials) {
      entry.material.emissiveIntensity = entry.base;
    }
    this._flashStrength = 0;
    this._flashDuration = 0;
  }

  _updateReaction(dt) {
    if (this._reactionAge <= 0 || !this.guardian?.figure) return;
    this._reactionAge = Math.max(0, this._reactionAge - dt);
    const progress = this._reactionDuration > 0
      ? 1 - this._reactionAge / this._reactionDuration
      : 1;
    const kick = Math.sin(progress * Math.PI) * (1 - progress * 0.18);
    this.guardian.figure.rotation.x =
      this._figureBaseRotationX - this._reactionStrength * kick;
    if (this._reactionAge > 0) return;
    this.guardian.figure.rotation.x = this._figureBaseRotationX;
    this._reactionStrength = 0;
    this._reactionDuration = 0;
  }

  _applyShieldVisuals() {
    if (!this.root || !this._shellMaterial) return;
    let opacity = 1;
    let expansion = 1;
    if (this._mode === 'shattering') {
      const progress = Math.min(1, this._shatterAge / SHATTER_DURATION);
      opacity = (1 - progress) ** 2;
      expansion = 1 + progress * 0.18;
    }

    const pulse = Math.max(this._impactPulse * 0.55, this._breakPulse);
    this._shellMaterial.uniforms.uOpacity.value = opacity;
    this._shellMaterial.uniforms.uPulse.value = pulse;
    this._latticeMaterial.opacity = this.style.latticeOpacity * opacity * (1 + pulse * 1.15);
    this.root.scale.copy(this._baseScale).multiplyScalar(
      expansion * (1 + this._impactPulse * 0.018 + this._breakPulse * 0.035),
    );

    for (let i = 0; i < this._crackMaterials.length; i++) {
      const revealed = i < this._stage;
      this._crackMaterials[i].opacity = revealed
        ? Math.min(1, (0.76 + pulse * 0.34) * opacity)
        : 0;
    }
  }

  update(dt) {
    if (this._disposed) return;
    const step = Math.max(0, dt || 0);
    this._time += step;
    this._syncTransform();

    if (this._pendingDelay >= 0) {
      this._pendingDelay -= step;
      if (this._pendingDelay <= 0) {
        const remaining = this._pendingRemaining;
        this._pendingDelay = -1;
        this._executeBreak(remaining);
      }
    }

    this._impactPulse = Math.max(0, this._impactPulse - step * 4.8);
    this._breakPulse = Math.max(0, this._breakPulse - step * 2.6);
    this._shellMaterial.uniforms.uTime.value = this._time;
    if (this.styleName === 'zone2') this.lattice.rotation.y += step * 0.08;
    else this.lattice.rotation.y -= step * 0.045;

    if (this._mode === 'shattering') {
      this._shatterAge += step;
      if (this._shatterAge >= SHATTER_DURATION) {
        this._mode = 'hidden';
        this.root.visible = false;
      }
    }

    this._updateFlash(step);
    this._updateReaction(step);
    this._applyShieldVisuals();
  }

  hitTest(worldPosition, padding = 0) {
    if (
      !this._blocking ||
      this._mode !== 'shielded' ||
      !worldPosition ||
      !this.root?.visible
    ) return false;

    const dx = worldPosition.x - this._center.x;
    const dy = worldPosition.y - this._center.y;
    const dz = worldPosition.z - this._center.z;
    const yaw = this.root.rotation.y;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const localX = cos * dx - sin * dz;
    const localZ = sin * dx + cos * dz;
    const rx = this._radii.x + padding;
    const ry = this._radii.y + padding;
    const rz = this._radii.z + padding;
    return (
      localX * localX / (rx * rx) +
      dy * dy / (ry * ry) +
      localZ * localZ / (rz * rz)
    ) <= 1;
  }

  blocksPlayerAt(x, z, radius = 0) {
    if (!this._blocking || this._mode !== 'shielded' || !this.root?.visible) return false;
    const dx = x - this._center.x;
    const dz = z - this._center.z;
    const yaw = this.root.rotation.y;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const localX = cos * dx - sin * dz;
    const localZ = sin * dx + cos * dz;
    const rx = this._radii.x + radius;
    const rz = this._radii.z + radius;
    return localX * localX / (rx * rx) + localZ * localZ / (rz * rz) <= 1;
  }

  _shieldSurfacePoint(worldPosition) {
    if (!worldPosition || !this._blocking || this._mode !== 'shielded') {
      return worldPosition || this._center;
    }
    const dx = worldPosition.x - this._center.x;
    const dy = worldPosition.y - this._center.y;
    const dz = worldPosition.z - this._center.z;
    const yaw = this.root.rotation.y;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const localX = cos * dx - sin * dz;
    const localZ = sin * dx + cos * dz;
    const normalized = Math.sqrt(
      localX * localX / (this._radii.x * this._radii.x) +
      dy * dy / (this._radii.y * this._radii.y) +
      localZ * localZ / (this._radii.z * this._radii.z),
    );
    if (normalized < 0.0001) {
      return this._impactPoint.set(
        this._center.x + Math.sin(yaw) * this._radii.z,
        this._center.y,
        this._center.z + Math.cos(yaw) * this._radii.z,
      );
    }
    const scale = 1 / normalized;
    const surfaceX = localX * scale;
    const surfaceZ = localZ * scale;
    return this._impactPoint.set(
      this._center.x + cos * surfaceX + sin * surfaceZ,
      this._center.y + dy * scale,
      this._center.z - sin * surfaceX + cos * surfaceZ,
    );
  }

  impact(worldPosition) {
    if (this._disposed) return;
    this._impactPulse = 1;
    this.combat?.vfx?.shieldImpact?.(
      this._shieldSurfacePoint(worldPosition),
      this.styleName,
    );
  }

  breakLayer(remaining, delay = 0) {
    if (this._disposed || this._mode === 'hidden') return;
    const safeRemaining = THREE.MathUtils.clamp(
      Math.floor(Number.isFinite(remaining) ? remaining : TOTAL_LAYERS),
      0,
      TOTAL_LAYERS,
    );
    if (delay > 0) {
      this._pendingRemaining = safeRemaining;
      this._pendingDelay = delay;
      return;
    }
    this._executeBreak(safeRemaining);
  }

  openForCombat() {
    if (this._disposed) return;
    this._blocking = false;
    if (this._pendingDelay >= 0 && this._pendingRemaining <= 0) {
      this._pendingDelay = -1;
      this._executeBreak(0);
      return;
    }
    if (this._mode === 'shattering') return;
    this._mode = 'hidden';
    this.root.visible = false;
  }

  hit(worldPosition) {
    if (this._disposed) return;
    this.combat?.vfx?.bossHit?.(worldPosition || this._center, this.styleName);
    this._triggerFlash(0.82, 0.13);
    this._updateFlash(0);
  }

  phaseShift(phase) {
    if (this._disposed) return;
    this._syncTransform();
    this.combat?.vfx?.bossPhase?.(this._center, this.styleName, phase);
    this._triggerFlash(2.05, 0.72);
    this._triggerReaction(0.11, 0.68);
    this._updateFlash(0);
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    if (this.guardian?.figure) {
      this.guardian.figure.rotation.x = this._figureBaseRotationX;
    }
    for (const entry of this._flashMaterials) {
      entry.material.emissiveIntensity = entry.base;
    }
    this.scene?.remove(this.root);
    this._shellGeometry.dispose();
    this._shellMaterial.dispose();
    this._latticeGeometry.dispose();
    this._latticeMaterial.dispose();
    for (const geometry of this._crackGeometries) geometry.dispose();
    for (const material of this._crackMaterials) material.dispose();
    this.root.clear();
    this.guardian = null;
    this.combat = null;
    this.scene = null;
    this.camera = null;
  }
}
