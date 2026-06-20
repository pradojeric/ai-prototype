# Implementation Plan — Zone 1 Prototype

## Architecture (single `index.html`)
Mirrors the GDD's `/src/core` systems as ES6 classes inside one module script.
Three.js + addons loaded via CDN importmap (no build step).

```
index.html
  <importmap> three@0.160 + addons (PointerLockControls, EffectComposer, UnrealBloomPass)
  Start overlay  -> click to request pointer lock
  HUD overlay    -> artifact counter
  Discovery overlay -> fade-to-white card

  <script type="module">
    CONFIG / ARTIFACT_DATA (mock City-Wide Portal payloads)
    class World          — scene, fog, water, particles, lights, market blockout
    class PlayerController— PointerLockControls, WASD wade physics, bob/breath
    class StringSystem    — per-artifact CatmullRom line bundle, drift + proximity states
    class ArtifactManager — placement seeding, proximity detect, interact dispatch
    class DiscoveryScreen — fade, render card, save-to-museum, resume
    class AudioManager    — WebAudio oscillator hum (gain by nearest-artifact distance)
    class Game            — RAF loop, wires systems, zone-complete check
  </script>
```

## Key technical choices
- **Water**: large plane at `y=WATER_LEVEL` with a lightweight vertex-displacement
  ShaderMaterial (sine ripple) + translucent teal. Camera eye sits above it (wade feel
  from slow speed + bob, not buoyancy sim — keeps prototype simple/KISS).
- **Strings**: bundle of `THREE.Line` from `CatmullRomCurve3`; control points jittered by
  per-frame sine offsets. `UnrealBloomPass` gives the glow without per-line shaders.
  Distance bands (Far/Med/Close/VeryClose per GDD §6) drive visible count + opacity + hum.
- **Placement**: artifacts seeded from tagged spawn nodes; `Math.random` jitter per load so
  no two sessions match (GDD §6 AI Procedural Placement, scoped to Zone 1).
- **Interaction**: proximity (<2.6m) + `E` → DiscoveryScreen. Mock `fetchArtifactData()`
  async returns local payload (stands in for APIManager).
- **No external assets**: all geometry is primitives; audio is synthesized.

## Out of scope this pass
Digital Museum walk-through, other 4 zones, real API, GLTF models, post-grade color LUT.

## Verify
Open `index.html` in a browser → click to enter → wade, follow strings to all 3
artifacts, confirm each Discovery card + counter reaching 3/3.
