// ============================================================
// GAME RENDERING — WebGL renderer + post-processing pipeline
// ============================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function createGameRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  // ACES tone mapping rolls the >1 emissive values (string glow, hub bulbs at
  // intensity up to 7) into the bloom gracefully instead of hard-clipping to
  // white. OutputPass applies the mapping while preserving the sRGB output.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  document.body.appendChild(renderer.domElement);
  return renderer;
}

export function createPostProcessing(renderer, scene, camera) {
  // Keep the RenderPass exposed so cutscenes and world swaps can exchange its
  // scene and camera without rebuilding the pipeline.
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(innerWidth, innerHeight),
    0.8,
    0.6,
    0.2,
  );
  composer.addPass(bloom);

  // Disabled outside the portal pull. Radial UV wobble + split RGB channels
  // produce the close-range distortion without changing normal gameplay.
  const endingDistortion = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uAmount: { value: 0 },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float uAmount;
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv - .5;
        float r = length(p);
        vec2 warp = p * sin(r * 35. - uTime * 8.) * .025 * uAmount;
        float split = .008 * uAmount * (0.4 + r);
        vec2 dir = normalize(p + vec2(.0001));
        float red = texture2D(tDiffuse, vUv + warp + dir * split).r;
        float green = texture2D(tDiffuse, vUv + warp).g;
        float blue = texture2D(tDiffuse, vUv + warp - dir * split).b;
        gl_FragColor = vec4(red, green, blue, 1.0);
      }
    `,
  });
  endingDistortion.enabled = false;
  composer.addPass(endingDistortion);

  // OutputPass must stay last so bloom composites in linear space before tone
  // mapping and linear-to-sRGB conversion put the colors onto the canvas.
  composer.addPass(new OutputPass());

  return { composer, renderPass, bloom, endingDistortion };
}
