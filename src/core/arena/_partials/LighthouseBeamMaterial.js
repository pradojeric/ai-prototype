import * as THREE from 'three';

// Shader for the Keeper's lighthouse sweep "blade" — the vertical slab of light
// whose top edge is literally the jump clearance. Everything here is in the
// blade's own local space: y runs 0..uHeight off the deck, z runs 0..uLength
// outward from the pivot, so the mesh can be rotated freely by the pivot without
// the shader needing world coordinates.
//
// Read of the effect, bottom to top: a hot scrolling core at deck level, a soft
// falloff through the body, then a crisp rim right at the clearance line so the
// player can see the height they have to beat.

const VERTEX_SHADER = /* glsl */`
  varying vec3 vLocal;

  void main() {
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */`
  uniform float uTime;
  uniform float uHeight;
  uniform float uLength;
  uniform float uOpacity;
  uniform vec3 uCoreColor;
  uniform vec3 uEdgeColor;

  varying vec3 vLocal;

  void main() {
    float h = clamp(vLocal.y / uHeight, 0.0, 1.0);
    float along = clamp(vLocal.z / uLength, 0.0, 1.0);

    // Body: brightest at the deck, thinning out as it climbs.
    float body = pow(1.0 - h, 1.7);

    // Rim: the clearance line. Kept deliberately tight and bright so it reads as
    // an edge to clear rather than a gradient that fades out.
    float rim = smoothstep(0.82, 0.99, h) * (1.0 - smoothstep(0.99, 1.0, h));

    // Energy flowing outward along the blade, plus a slower counter-pulse so the
    // scroll never looks like a single repeating stripe.
    float flow = 0.5 + 0.5 * sin(along * 24.0 - uTime * 7.0);
    float pulse = 0.5 + 0.5 * sin(along * 6.0 - uTime * 2.3);
    float energy = mix(flow, pulse, 0.35);

    // Slight fade at the far end keeps the arena rim from looking walled in.
    float reach = 1.0 - smoothstep(0.72, 1.0, along) * 0.45;

    float intensity = (body * (0.62 + 0.38 * energy) + rim * 1.15) * reach;
    vec3 color = mix(uEdgeColor, uCoreColor, body);

    gl_FragColor = vec4(color * intensity, clamp(intensity, 0.0, 1.0) * uOpacity);
  }
`;

/**
 * @param {number} height  blade height in metres; must match the jump clearance
 * @param {number} length  blade reach from the pivot in metres
 */
export function createLighthouseBladeMaterial(height, length) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uHeight: { value: height },
      uLength: { value: length },
      uOpacity: { value: 0 },
      uCoreColor: { value: new THREE.Color(0xfff2c4) },
      uEdgeColor: { value: new THREE.Color(0xffab4d) },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}
