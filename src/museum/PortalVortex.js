// ============================================================
// PORTAL VORTEX — swirling blue portal shader (Crash-style)
// ============================================================
// One ShaderMaterial shared by every open portal's corridor-end panel in the
// walkable hub: animated spiral arms twisting toward a bright cyan core.
// Museum owns the mesh placement/visibility and drives `uTime` each frame.
import * as THREE from 'three';

export function createVortexMaterial(aspect) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uAspect: { value: aspect },
    },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uAspect;

      void main() {
        // Center the UVs and correct for the panel's rectangular aspect so the
        // vortex reads as a circle, not a stretched oval.
        vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 2.0;
        float r = length(p);
        float a = atan(p.y, p.x);

        // Spiral arms: angle offset by radius (the twist) and time (the spin).
        float swirl = a + r * 6.0 - uTime * 2.2;
        float arms = 0.5 + 0.5 * sin(swirl * 3.0);
        arms *= arms;                                  // sharpen the bands

        float core = smoothstep(0.4, 0.0, r);          // bright center
        float edge = 1.0 - smoothstep(0.65, 1.0, r);   // fade out at the rim

        vec3 deep = vec3(0.01, 0.08, 0.30);            // deep blue troughs
        vec3 bright = vec3(0.15, 0.55, 1.0);           // cyan-blue arms
        vec3 col = mix(deep, bright, arms);
        col += vec3(0.65, 0.85, 1.0) * core * 1.6;     // white-hot core (blooms)

        float glow = (arms * 0.9 + core * 1.5) * edge;
        gl_FragColor = vec4(col * glow, edge);
      }
    `,
  });
}
