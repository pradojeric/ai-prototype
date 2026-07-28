// ============================================================
// ZONE LIGHTING — the submerged zones' moonlight rig + environment
// ============================================================
// Split out of World.js (which sits at the 1000-line cap) alongside TextureKit
// and FestivalDressing.
//
// WHY THIS EXISTS. The zones used to be lit by a single warm amber key plus a
// hemisphere and an ambient, with no `scene.environment` at all. That was fine
// while every material was a flat colour, but TextureKit now binds roughness
// maps and sets `roughness = 1` so the map drives the surface — and a fully
// rough material with no environment has almost no specular response. The
// normal maps had nothing to catch, the albedo maps only darkened the palette
// tints they multiply against, and the zones went dark and flat.
//
// So the fix is two things, not one: a cooler, brighter KEY (the moon), and an
// ENVIRONMENT for the new maps to reflect. Either alone leaves the textures
// reading as painted-on noise.
//
// Every zone def may carry a `light` block that is shallow-merged over
// DEFAULT_LIGHT, which is how zone 3 stays the darkest and zone 2 keeps a warm
// festival bounce without forking the rig.
import * as THREE from 'three';

// The moon is a DIRECTION, not a place: it is shared by the key light, the
// environment's moon blob, and the water shader's sheen, so all three agree on
// where the light comes from. High and to the west-south — the player spawns on
// the south dock looking north, so this lights the faces they walk toward and
// drops the far faces into silhouette.
export const DEFAULT_LIGHT = {
  moonColor: 0xbcd4ff,
  moonIntensity: 1.55,
  moonDir: [-9, 20, 6],

  // Dim, cool, opposite side. Without it the unlit faces of every building read
  // as flat black holes once the fog thins near the player.
  fillColor: 0x4e7a86,
  fillIntensity: 0.35,
  fillDir: [8, 7, -10],

  hemiSky: 0x8fb6d8,        // moonlight through the surface
  hemiGround: 0x14282c,     // silt bounce
  hemiIntensity: 0.85,

  ambientColor: 0x3c5f6b,
  ambientIntensity: 0.55,

  // Equirectangular gradient bands, top → bottom. Brightness is BAKED into
  // these colours rather than set via `scene.environmentIntensity`, which only
  // exists from three r163 (Museum.js feature-detects it for the same reason);
  // this project is pinned to r160.
  envSky: 0x6f96b8,
  envHorizon: 0x35555f,
  envGround: 0x101c20,
  envMoon: 0xdce9ff,
  // Per-material dial, applied to every standard material in world.mat.
  envIntensity: 0.55,
};

// Module-scoped cache, keyed by zone id. A World is constructed and dispose()d
// on every portal transit, so a per-World texture would mean a fresh canvas
// paint + GPU upload + PMREM convolution on each zone change. Safe to keep:
// World.dispose() traverses scene OBJECTS, and an environment texture is not
// one, so nothing here is ever disposed out from under us.
const envCache = new Map();

// Paint the environment as a small equirectangular canvas: a vertical
// sky→horizon→seabed gradient with a soft moon blob at the key light's bearing.
// 64x32 is deliberately tiny — it is only ever seen through the PMREM blur as
// diffuse irradiance and rough specular, so resolution buys nothing.
function paintEnv(cfg) {
  const w = 64, h = 32;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');

  const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, hex(cfg.envSky));
  grad.addColorStop(0.5, hex(cfg.envHorizon));
  grad.addColorStop(1, hex(cfg.envGround));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // The moon itself. Equirect maps longitude to u and latitude to v, so the
  // key direction converts straight into canvas coordinates — that alignment is
  // what gives wet stone a highlight on the same side the key light hits.
  const [mx, my, mz] = cfg.moonDir;
  const dir = new THREE.Vector3(mx, my, mz).normalize();
  const u = (Math.atan2(dir.x, -dir.z) / (Math.PI * 2) + 0.5) * w;
  const v = (Math.acos(THREE.MathUtils.clamp(dir.y, -1, 1)) / Math.PI) * h;
  const blob = ctx.createRadialGradient(u, v, 0, u, v, w * 0.16);
  blob.addColorStop(0, hex(cfg.envMoon));
  blob.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = blob;
  ctx.fillRect(0, 0, w, h);

  const tex = new THREE.CanvasTexture(canvas);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Cached environment for a zone. `key` is the zone id.
export function gradientEnvTexture(key, cfg) {
  let tex = envCache.get(key);
  if (!tex) {
    tex = paintEnv(cfg);
    envCache.set(key, tex);
  }
  return tex;
}

// Build the whole rig onto `world`. Returns the resolved config; World keeps the
// moon direction/colour so the water surface can agree with it.
//
// Must run AFTER world._materials(): it writes envMapIntensity onto those
// materials, and they are recreated per World instance.
export function buildZoneLighting(world, override = {}) {
  const cfg = { ...DEFAULT_LIGHT, ...override };

  const moon = new THREE.DirectionalLight(cfg.moonColor, cfg.moonIntensity);
  moon.position.set(...cfg.moonDir);
  world.scene.add(moon);

  const fill = new THREE.DirectionalLight(cfg.fillColor, cfg.fillIntensity);
  fill.position.set(...cfg.fillDir);
  world.scene.add(fill);

  world.scene.add(new THREE.HemisphereLight(cfg.hemiSky, cfg.hemiGround, cfg.hemiIntensity));
  world.scene.add(new THREE.AmbientLight(cfg.ambientColor, cfg.ambientIntensity));

  // Three r160's WebGLCubeUVMaps PMREM-convolves an equirectangular
  // scene.environment on first use, so no PMREMGenerator (and therefore no
  // renderer reference inside World) is needed here. Museum.js takes the same
  // route with its .hdr.
  world.scene.environment = gradientEnvTexture(world.zone.id, cfg);
  for (const mat of Object.values(world.mat)) {
    if (mat.isMeshStandardMaterial) mat.envMapIntensity = cfg.envIntensity;
  }

  return cfg;
}
