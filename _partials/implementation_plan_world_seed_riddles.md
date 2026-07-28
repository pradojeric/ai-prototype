# Implementation Plan — Per-Run World Seed for Non-Duplicating Riddles

## Goal

One world seed per run (page load). From it, each riddle-gated arena owns a
**disjoint block** of the shuffled riddle pool, so no riddle repeats across
zone1/zone2/zone3 arenas. Each retry rotates a fresh window through the zone's
own block, so retries show **different** riddles (revised from the initial
"same riddles per retry" answer) while never leaking into another zone's block.

## Current behavior (the bug)

Each arena shuffles the *whole* 127-riddle pool independently with its own seed
and takes the first N, so slices can overlap between zones and (for arena1/arena2)
change on every retry:

- `ArenaController` (arena1): `drawRiddles(ARENA.ROUNDS + 2, Date.now-seed)` — 5,
  re-randomized every attempt.
- `RailArenaController` (arena2): `drawRiddles(RAIL_ARENA.ROUNDS + 2, mulberry32(seed ^ attempt))` — 5,
  re-randomized every attempt.
- `TowerGateManager` (arena3): `drawRiddles(3, mulberry32(world.zone.seed))` — 3,
  and `arena3.seed` is `Math.random()` fresh each read, so it changes each rebuild.

## Design

Single global shuffle → one disjoint **block** per zone → rotate a fresh window
through the block on each draw.

1. **`config.js`** — add `export const WORLD_SEED = (Math.random() * 0x1_0000_0000) >>> 0;`.
   ES modules are singletons, so this is generated once per page load = per run.
2. **`data/riddles.js`** — partition + rotating allocator:

   ```js
   ZONE_BLOCKS = ['arena1', 'arena2', 'arena3']   // partition order
   _zoneDrawIndex = Map()                          // per-zone draw counter (this run)

   zoneBlock(zoneId, worldSeed):
     shuffle whole pool once with mulberry32(worldSeed)
     split into near-equal thirds (~42 each); return this zone's contiguous block
     unknown zone → first block (never expected)

   riddlesForZone(zoneId, count, worldSeed = WORLD_SEED):
     block = zoneBlock(...); n = min(count, block.length)
     attempt = _zoneDrawIndex[zoneId]++      // advances each entry/retry
     window start = (attempt * n) % block.length  → take n with wraparound
   ```

   Blocks are disjoint and cover the whole pool → hard cross-zone guarantee.
   Rotating the window advances each retry → different riddles each attempt.
   The module-scoped counter survives controllers being re-instantiated on
   retry; it resets on page reload alongside WORLD_SEED.
3. **Re-export** `riddlesForZone` from `data.js` alongside `drawRiddles`
   (`drawRiddles` stays for any non-zonal use).
4. **Wire the three arenas** to `riddlesForZone(zoneId, count)`:
   - `ArenaController` — capture the already-passed `world` arg; use `world.zone.id`.
   - `RailArenaController` — already has `this.world`; use `this.world.zone.id`.
   - `TowerGateManager` — already has `this.world`; use `this.world.zone.id`.

## Non-goals / left untouched

- `arena3.get seed()` stays random — it still drives keeper/combat spawn timing;
  only the riddle draw stops using it.
- `drawRiddles(n, rng)` is kept as-is (still used as the shuffle primitive).
- No new UI; seed is not player-enterable (per decision).

## Verification

- `node --check` each edited JS file.
- Node harness: assert the three zone blocks are disjoint and cover the pool,
  every draw stays inside its own block (no cross-zone overlap), and each retry
  differs from the previous one. All pass.
