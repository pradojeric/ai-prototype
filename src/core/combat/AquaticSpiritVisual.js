// CC0 aquatic meshes adapted into the six lesser-echo silhouettes. Gameplay
// classes still own every collider, timer, muzzle, and movement rule; this file
// is deliberately visual-only. OBJ keeps the shipped payload tiny and avoids
// texture uploads, while a shared promise prevents duplicate network requests.
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

const loader = new OBJLoader();
const sourceCache = new Map();

const PROFILES = {
  chaser: {
    url: './assets/models/enemies/fish-chaser.obj',
    length: 1.95, color: 0x789b91, underside: 0xb8c6b6, pattern: 'scales',
  },
  spitter: {
    url: './assets/models/enemies/fish-spitter.obj',
    length: 1.85, color: 0x9b7250, underside: 0xd0b17b, pattern: 'scales',
  },
  sniper: {
    url: './assets/models/enemies/manta-sniper.obj',
    length: 3.1, color: 0x405f65, underside: 0xaebcbc, pattern: 'spots',
  },
  boarder: {
    url: './assets/models/enemies/shark-boarder.obj',
    length: 2.8, color: 0x687b80, underside: 0xc1c7c3, pattern: 'bands',
  },
  gargoyle: {
    procedural: 'squid',
    length: 1.35, color: 0x755b70, underside: 0xc0a6a7, pattern: 'squidSkin',
    hover: 0.82,
  },
  gale: {
    url: './assets/models/enemies/dolphin-gale.obj',
    length: 2.55, color: 0x668b96, underside: 0xc1d0cc, pattern: 'bands',
    roll: 0.12,
  },
};

const BODY_THICKNESS = 1.5;
const skinCache = new Map();

function hashNoise(x, y, seed) {
  const value = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

function patternValue(kind, u, v, x, y, seed) {
  if (kind === 'scales') {
    const row = Math.floor(v * 18);
    const shiftedU = u + (row % 2) * 0.035;
    const cell = Math.abs((shiftedU * 15) % 1 - 0.5);
    const ridge = Math.abs((v * 18) % 1 - 0.5);
    return Math.max(0, 0.5 - Math.hypot(cell * 1.25, ridge)) * 0.55;
  }
  if (kind === 'spots') {
    return hashNoise(Math.floor(x / 7), Math.floor(y / 7), seed) > 0.68
      ? 0.2 * (1 - Math.min(1, Math.hypot((x % 7) - 3.5, (y % 7) - 3.5) / 4))
      : 0;
  }
  if (kind === 'squidSkin') {
    const freckles = hashNoise(Math.floor(x / 3), Math.floor(y / 3), seed);
    const chromatophore = freckles > 0.62 ? (freckles - 0.62) * 0.48 : 0;
    return chromatophore + Math.sin((u * 7 + v * 3) * Math.PI * 2) * 0.025;
  }
  if (kind === 'bands') return Math.sin((u * 5 + v * 1.5) * Math.PI * 2) * 0.035;
  return (hashNoise(Math.floor(x / 4), Math.floor(y / 4), seed) - 0.5) * 0.16;
}

function createSkinTexture(type, profile) {
  const hit = skinCache.get(type);
  if (hit) return hit;

  const width = 128;
  const height = 64;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  const image = context.createImageData(width, height);
  const back = new THREE.Color(profile.color);
  const belly = new THREE.Color(profile.underside);
  const color = new THREE.Color();
  const seed = type.length * 11;

  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);
    // Pale belly at the bottom, darker dorsal surface at the top.
    const bellyBlend = Math.max(0, 1 - v * 2.25);
    for (let x = 0; x < width; x++) {
      const u = x / (width - 1);
      const detail = patternValue(profile.pattern, u, v, x, y, seed);
      const grain = (hashNoise(x, y, seed) - 0.5) * 0.055;
      color.copy(back).lerp(belly, bellyBlend);
      color.offsetHSL(0, detail * 0.12, detail + grain);
      const index = (y * width + x) * 4;
      image.data[index] = Math.round(color.r * 255);
      image.data[index + 1] = Math.round(color.g * 255);
      image.data[index + 2] = Math.round(color.b * 255);
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 2;
  skinCache.set(type, texture);
  return texture;
}

function addCylindricalUVs(geometry) {
  if (geometry.attributes.uv) return;
  geometry.computeBoundingBox();
  const position = geometry.attributes.position;
  const box = geometry.boundingBox;
  const height = Math.max(0.001, box.max.y - box.min.y);
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    uv[i * 2] = Math.atan2(x, z) / (Math.PI * 2) + 0.5;
    uv[i * 2 + 1] = (y - box.min.y) / height;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function loadSource(url) {
  if (!sourceCache.has(url)) {
    sourceCache.set(url, loader.loadAsync(url));
  }
  return sourceCache.get(url);
}

function createSquid() {
  const root = new THREE.Group();
  const placeholder = new THREE.MeshBasicMaterial();

  const mantle = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.45, 16), placeholder);
  mantle.position.set(0, 0.62, 0.08);
  mantle.scale.set(0.92, 1, 0.78);
  root.add(mantle);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.48, 14, 10), placeholder);
  head.scale.set(1, 0.72, 0.78);
  head.position.set(0, -0.18, -0.04);
  root.add(head);

  for (const side of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.82, 5), placeholder);
    fin.position.set(side * 0.48, 0.66, 0.12);
    fin.rotation.set(0, 0, side * 0.95);
    fin.scale.set(0.45, 1, 0.18);
    root.add(fin);
  }

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const tentacle = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.065, 0.85 + (i % 3) * 0.12, 4, 7),
      placeholder,
    );
    tentacle.rotation.x = Math.sin(angle) * 0.18;
    tentacle.rotation.z = Math.cos(angle) * 0.24;
    tentacle.position.set(
      Math.cos(angle) * 0.25,
      -0.93,
      Math.sin(angle) * 0.18,
    );
    root.add(tentacle);
  }
  return root;
}

function loadProfileSource(profile) {
  if (profile.procedural === 'squid') return Promise.resolve(createSquid());
  return loadSource(profile.url);
}

function cloneGeometry(source) {
  const root = source.clone(true);
  root.traverse((object) => {
    if (object.isMesh) object.geometry = object.geometry.clone();
  });
  return root;
}

function disposeRoot(root) {
  root.traverse((object) => {
    if (object.geometry) object.geometry.dispose();
    if (object.material) object.material.dispose();
  });
}

function normalize(root, targetLength) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = targetLength / Math.max(size.x, size.y, size.z);
  root.scale.setScalar(scale);
  root.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
}

export function attachAquaticSpiritVisual(owner) {
  const profile = PROFILES[owner.type];
  if (!profile || !owner.figure) return;

  loadProfileSource(profile).then((source) => {
    const root = cloneGeometry(source);
    if (owner._disposed) {
      disposeRoot(root);
      return;
    }

    // Preserve invisible legacy nodes because combat managers use them as exact
    // muzzle/aim anchors. Only their rendered meshes are replaced.
    for (const child of [...owner.figure.children]) {
      child.traverse((object) => {
        if (object.isMesh) object.visible = false;
      });
    }
    // Retain only the original combat tell. These nodes carry the existing
    // wind-up scale/flash behavior and are not decorative additions.
    const attackIndicator = owner._mouth || owner.muzzleNode ||
      (owner.type !== 'gargoyle' ? owner._muzzle : null);
    if (attackIndicator) attackIndicator.visible = true;

    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: createSkinTexture(owner.type, profile),
      emissive: profile.color,
      emissiveIntensity: 0.12,
      roughness: 0.48,
      metalness: 0.02,
      transparent: true,
      opacity: Math.max(0.01, owner._fade) * 0.96,
      side: THREE.DoubleSide,
    });
    owner.registerFade(material, 0.96);
    // The squid replaces the Gargoyle's wing-opening tell with a mantle pulse;
    // TowerThreat's existing wind-up envelope drives this registered material.
    if (owner.type === 'gargoyle') owner.registerFlash(material);
    root.traverse((object) => {
      if (!object.isMesh) return;
      addCylindricalUVs(object.geometry);
      object.material = material;
      object.castShadow = false;
      object.receiveShadow = false;
    });
    normalize(root, profile.length);
    // Source fish point opposite the combat rigs' -Z forward convention.
    root.rotation.set(
      profile.pitch || 0,
      profile.procedural === 'squid' ? 0 : Math.PI,
      profile.roll || 0,
    );
    root.scale.x *= BODY_THICKNESS;
    if (profile.procedural === 'squid') root.scale.z *= BODY_THICKNESS;
    else root.scale.y *= BODY_THICKNESS;
    if (profile.hover) owner.figure.position.y = profile.hover;
    owner.figure.add(root);
    owner.aquaticSpiritVisual = root;
  }).catch((error) => {
    // The original procedural body remains visible if an asset cannot load.
    console.warn(`Could not load aquatic spirit model for ${owner.type}`, error);
  });
}
