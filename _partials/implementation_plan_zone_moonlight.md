# Implementation Plan — Zone Moonlight Pass

## Problem

The CC0 PBR pass (`_partials/TextureKit.js`) bound albedo + normal + roughness maps
onto every zone material and, critically, set `mat.roughness = 1` so the roughness
*map* drives the surface. Combined with the existing lighting rig — one warm amber
`DirectionalLight`, a hemisphere and an ambient, and **no environment map** — that
left the zones almost entirely diffuse-lit. Fully-rough materials with no environment
have essentially no specular response, so the new normal maps contribute nothing and
the albedo maps only darken the palette tints they multiply against. Result: the
zones went dark and flat.

## Decisions (from user)

- **Remove**: the god-ray light shafts (`lightShafts()` in zones 1–3). The
  `world._lightShaft()` primitive stays — `zoneDebug` still uses it.
- **Add**: a cool moonlight key **plus a procedural gradient environment map**, so the
  normal/roughness maps actually have something to reflect.
- **Per-zone mood preserved**: a `light` override block on each zone def, shallow-merged
  over one brighter default. Zone 3 stays the darkest and coldest; zone 2 keeps a warm
  festival bounce.
- **Amount**: readable, still unmistakably night. Fog density untouched.

## Design

### 1. New module `src/core/_partials/ZoneLighting.js`

`World.js` is at 934/1000 lines, so the rig goes in a partial next to `TextureKit.js`
and `FestivalDressing.js`, matching the convention already used there.

Exports:

- `DEFAULT_LIGHT` — the base config (colours, intensities, moon direction, env gradient).
- `buildZoneLighting(world, override)` — merges `override` over the default, adds the
  lights to `world.scene`, installs the environment, applies `envMapIntensity` to every
  `world.mat.*` standard material, and returns the resolved config (World keeps the
  moon direction for the water shader).
- `gradientEnvTexture(cfg)` — module-cached equirectangular `CanvasTexture`.

**The rig** (four lights, all cheap, no shadow maps — the zones are fog-bound and
shadow casting would be wasted):

| Light | Role |
|---|---|
| `DirectionalLight` (moon) | key, cool silver-blue, high and to the west-south so the faces the player sees walking north are lit and the far faces fall into silhouette |
| `DirectionalLight` (fill) | dim opposite-side cool fill so backs of buildings aren't pure black |
| `HemisphereLight` | moonlit-water sky vs. silt ground bounce |
| `AmbientLight` | floor on the darkest surfaces |

**The environment** — a 64×32 canvas painted as an equirectangular gradient
(sky → horizon → seabed) with a soft moon blob at the key light's azimuth, tagged
`EquirectangularReflectionMapping` and assigned to `scene.environment`. Three r160's
`WebGLCubeUVMaps` PMREMs an equirect environment automatically on first use, so this
needs no `PMREMGenerator` and therefore no renderer reference inside `World` — the same
route `Museum.js` already takes with its HDRI.

Intensity is **baked into the gradient colours** rather than set via
`scene.environmentIntensity`, which only landed in r163 (`Museum.js` feature-detects it
for exactly this reason). Per-material `envMapIntensity` gives the per-zone dial.

The texture is module-cached by zone key and never disposed: `World.dispose()` only
traverses scene *objects*, so an environment texture is not touched by it — same
lifetime guarantee `TextureKit` documents for its texture sets.

### 2. `World.js`

- `_lights()` delegates to `buildZoneLighting(this, this.zone.light)` and stashes
  `this.moonDir` / `this.moonColor`.
- `_water()`: `uSunDir` currently hardcodes the old amber vector `(8, 22, -6)`, and the
  fragment shader hardcodes a warm sheen `vec3(1.0, 0.9, 0.76)`. Both are re-pointed at
  the moon — a warm sheen under a blue key would read as a second, contradictory light
  source. `uSunColor` becomes a uniform.
- Order matters: `_materials()` must run before `_lights()` (it already does) since the
  rig writes `envMapIntensity` onto those materials.

### 3. Zone defs

- Delete `lightShafts()` and its `build()` call from `zone1.js`, `zone2.js`, `zone3.js`.
  Safe for layout determinism: `_lightShaft` consumes one `rng()` per cone, but the call
  sits after every other RNG-driven builder (only `setSpawnNodes`, which uses no RNG,
  follows it), so no geometry shifts.
- Add a `light: {}` block to each:
  - **zone1 (PONSIA)** — the default rig, unmodified. This is the reference mood.
  - **zone2 (LIKET)** — warmer ground bounce and ambient so the brass/festival palette
    and the lantern garlands still feel warm under a cool moon.
  - **zone3 (Pananisia)** — dimmest and coldest: lower moon and fill intensity, near-black
    ground bounce, lower `envMapIntensity`. Must remain the darkest of the three.

## Out of scope / notes

- Arenas (`arena1`–`arena3`) and `zoneDebug` are zone defs on the same engine, so they
  inherit the new default rig. That is intended (they were dark for the same reason), but
  their VFX-heavy scenes want an eyeball check.
- Fog density, `background`, bloom and tone-mapping exposure are all untouched.

## Verification

- Node syntax parse of every touched file.
- Grep for orphaned `lightShafts` references.
- Line-count check against the 1000-line cap.
- Browser check is the user's (per project convention — no browser automation here).
