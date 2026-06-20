// ============================================================
// STRING SYSTEM — single drifting fishing line per artifact (GDD §6)
// ============================================================
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { clamp01 } from '../config.js';

export class StringBundle {
  constructor(scene, anchor) {
    this.anchor = anchor;            // artifact world position
    this.N = 26;                     // samples along the single string
    this.positions = new Float32Array(this.N * 3);
    this.geometry = new LineGeometry();
    this.geometry.setPositions(this.positions);
    // Fat line: real variable thickness (LineBasicMaterial can't on most GPUs).
    this.material = new LineMaterial({
      color: 0xcdfdf6, linewidth: 2, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, dashed: false,
    });
    this.material.resolution.set(innerWidth, innerHeight);
    this.line = new Line2(this.geometry, this.material);
    this.line.frustumCulled = false;
    scene.add(this.line);

    this.phase = Math.random() * Math.PI * 2;
    // scratch vectors reused each frame (avoid per-frame allocation)
    this._held = new THREE.Vector3();
    this._art = new THREE.Vector3();
    this._p = new THREE.Vector3();
  }

  setResolution(w, h) { this.material.resolution.set(w, h); }

  dispose(scene) {
    scene.remove(this.line);
    this.geometry.dispose();
    this.material.dispose();
  }

  // One clean string from the held point (low in view) to the artifact, with a
  // gentle upward bow (no floor droop). Thickens as you approach and gains a
  // faint vibration when very close. Mid-range only; fades out on arrival.
  update(t, dist, gather, camRight, camUp) {
    const fadeIn  = clamp01((13 - dist) / 5);   // 0 beyond 13m -> 1 by 8m
    const fadeOut = clamp01((dist - 2) / 2);    // 0 inside 2m  -> 1 by 4m (fade on arrival)
    const reveal  = Math.min(fadeIn, fadeOut);
    const thicken = clamp01((13 - dist) / 11);  // 0 far -> ~1 right at the artifact
    const near    = clamp01((4 - dist) / 4);    // 0 at >=4m -> 1 at the artifact
    const visible = reveal > 0.01;

    this.material.opacity += ((visible ? reveal : 0) - this.material.opacity) * 0.08;
    this.line.visible = this.material.opacity > 0.004;
    if (!this.line.visible) return;

    // Thickness grows with proximity; a quick pulse kicks in only when close.
    const pulse = near > 0 ? Math.max(0, Math.sin(t * 9 + this.phase)) * 1.8 * near : 0;
    this.material.linewidth = 1.6 + thicken * 5.5 + pulse;

    this._held.copy(gather);          // already lowered into the bottom of the view
    this._art.copy(this.anchor);

    const bow = 0.4 * (1 - near * 0.7);   // shallow arc; flattens as you arrive
    const vib = near * 0.05;              // tiny taut-string vibration up close
    for (let i = 0; i < this.N; i++) {
      const f = i / (this.N - 1);          // 0 = artifact, 1 = held end
      const arc = Math.sin(f * Math.PI);   // zero at both ends
      this._p.copy(this._art).lerp(this._held, f)
        .addScaledVector(camUp, arc * bow);          // bow within view plane (no floor sag)
      if (vib) this._p.addScaledVector(camRight, Math.sin(t * 14 + f * 8 + this.phase) * arc * vib);
      this.positions[i * 3]     = this._p.x;
      this.positions[i * 3 + 1] = this._p.y;
      this.positions[i * 3 + 2] = this._p.z;
    }
    this.geometry.setPositions(this.positions);
  }
}
