# Arena 3 — Memory Tower: Pananisia

**Guardian:** The Archivist

**Zone:** 3 (Pangasinan landmarks and enduring places)

**Entered from:** the Memory Rift in Zone 3 (tap **E**); victory returns the player
to Zone 3, scatters its artifacts, and leaves the Guardian Soul to recover.

Arena 3 is a combat ascent through a ruined, lighthouse-inspired tower. Twelve
railed ramp flights spiral around a hollow center while the tide climbs from below.
The player must survive fixed Gargoyle sentries, vertically tracking Gale shooters,
and three shootable memory seals before reaching a flat octagonal summit and fighting
the Keeper.

> **Superseded (2026-07-29):** the summit is now a **portal**, not a boss deck.
> Opening the third seal lights it; walking into it carries the player to
> **arena3boss**, a separate arena where the Keeper fight happens. Arena 3 itself
> therefore has no boss and no win state — it ends when the player leaves through
> the portal, with the tide still rising underneath. Everything below describing
> the summit encounter, the boss retry point, and the ascent→boss handoff now
> applies to `arena3boss.js` / `KeeperArenaController.js` instead. See
> `_partials/implementation_plan_summit_portal_arena3boss.md`.
> (This document also predates later combat tuning — e.g. the Keeper's HP is 500
> in `TowerKeeper.js`, not the 60 quoted below. Treat the code as authoritative.)

---

## The loop at a glance

```text
     four Gargoyles already guard authored ramp positions
                              │
          Gales begin spawning after a random 7–10s
          and continue every random 6–10s
                              │
                  climb while the tide rises
                              ▼
                6 m ──▶ [MEMORY SEAL 1]
                              │
               12 m ──▶ [MEMORY SEAL 2]
                              │
               18 m ──▶ [MEMORY SEAL 3]
                              │
                  all three seals open
                              ▼
              cross the final summit bridge
                              ▼
                  ╔══════════════════════╗
                  ║  THE KEEPER — 60 HP  ║
                  ║ shots • charges • adds║
                  ╚══════════════════════╝
```

The tower uses seeded randomness per attempt. Gale positions, spawn timing, Keeper
attack intervals, and summon ordering remain varied, but restarting an attempt resets
every threat, portal, projectile, timer, and temporary reward cleanly.

---

## Phase 1 — The tower ascent

The player starts on the lowest landing at the outer edge of the tower. The route
contains **12 continuous ramp flights**, each gaining **1.5 m**, for a summit height
of **18 m**. Rails and landings provide continuous collision along the intended path.

### Rising tide

- The tide remains dormant for the opening **8 seconds**.
- It then rises at **0.16 m/s**, up to a maximum height of **19.5 m**.
- The HUD warns when the remaining air gap falls below **2.5 m** and becomes critical
  below **0.85 m**.
- Reaching an air gap of **0.12 m** causes the player to faint.
- The climb only ends after all three seals are open and the player reaches the summit.

The tide rewards steady upward movement while leaving enough time for short fights,
landing turns, and seal decisions. It does not stop while a seal riddle is active.

### Fixed Gargoyle sentries

Four Gargoyles are constructed immediately when an ascent attempt begins. They do not
arrive through portals and do not move from their authored positions near the
**2.8**, **7.2**, **11.8**, and **16.2 m** encounter bands. Their side alternates as
the route climbs.

| HP | Range | Telegraph | Damage | Knockback | Cooldown |
|---:|---:|---:|---:|---:|---:|
| 4 | 2.05 m | 0.6 s | 18 | 5.2 | 1.4 s |

A Gargoyle turns to watch the player but can only begin its wing slam when the player
is on the same vertical tier and within melee range. Its wings fold through the
0.6-second warning before the hit resolves. Gargoyles remain solid, stationary, and
killable.

Off-screen markers for a Gargoyle are hidden when it is more than one nearby vertical
tier away. This prevents sentries several ramps above or below from filling the HUD
with misleading directions.

### Gale Whisper shooters

Gales provide the ranged pressure during the climb:

- The first spawn attempt occurs after a seeded random **7–10 seconds**.
- Later attempts occur every seeded random **6–10 seconds**.
- Each Gale enters through the existing **woven-thread tear** telegraph.
- Spawn positions are selected inside the tower's central circle, between **1.5 and
  4.5 m** from its center.
- A position must be collision-free and at least **2 m** from another live or pending
  Gale. If none is safe, spawning waits briefly and retries.
- Once placed, a Gale's **X and Z never change**. Its movement is vertical only,
  following the player's current height while it hovers in place.

| HP | Firing interval | Telegraph | Damage | Knockback | Shot speed |
|---:|---:|---:|---:|---:|---:|
| 2 | 2.8 s | 0.45 s | 10 | 3.6 | 9 m/s |

The muzzle expands during the firing telegraph, then releases a projectile toward the
player's current position. At most **2 Gales** and **6 total lesser threats**, including
pending portal arrivals, can exist at once.

### Memory Lumina

Genuine lesser-enemy kills retain the shared **30%** Lumina drop chance. Tower Lumina
stays at the defeated enemy's height and can only be collected from a nearby vertical
band, so a reward on another ramp cannot be taken through the floor.

- **Vitality** — restores 25 Liwanag.
- **Zephyr** — increases movement speed by 2.2× for 8 seconds.
- **Overcharge** — automatically fires at 8 shots per second for 5 seconds.

The player has **100 Liwanag** and fires the normal one-damage light bolt on a
**0.22-second** cooldown.

---

## Phase 2 — The three memory seals

Sealed veils block the route at **6**, **12**, and **18 m**. Approaching one on its
landing presents a Filipino bugtong, its English gloss, and three shootable answer
nodes. The player opens the path by shooting the correct answer.

**Correct answer**

- All answer nodes break.
- The veil fades and stops blocking the route.
- The seal counter advances toward `3 / 3`.

**Wrong answer**

- The selected wrong node breaks.
- Movement speed falls to **55% for 4 seconds**.
- The seal remains closed and the remaining answers stay available.
- The seal attempts to summon another Gargoyle through a woven tear near that height,
  subject to the shared six-threat cap.

Opened seals are part of the current run. They reset after an ascent death, but remain
open when retrying a boss death.

---

## Phase 3 — The summit and Keeper fight

The final bridge enters a fully supported octagonal deck at **18 m**. The deck is
approximately **18 m across its vertices**, with perimeter rails and collision around
every edge except the aligned **3.2 m entrance**. The Keeper and all boss movement are
bounded to a **6.8 m combat radius** within the larger deck.

Boss activation clears every ascent Gargoyle, Gale, pending portal, and projectile.
The tide is fixed at **15 m**, safely below the deck, and drowning checks are disabled
for the rest of the fight.

The existing Zone 3 Guardian body becomes **The Archivist**, preserving its
authored materials, glow, animation, and chest hit sphere. The Keeper has **60 HP** and
changes phase at 66% and 33% health.

| Phase | Entered at | Aimed shots | Charge interval | Summon interval |
|---|---:|---:|---:|---:|
| I | 100% | every 2.8 s | random 8–10 s | random 11–13 s |
| II | ≤66% | every 2.2 s | random 6.5–8.5 s | random 9–11 s |
| III | ≤33% | every 1.7 s | random 5–7 s | random 7–9 s |

### Aimed projectiles

The Keeper's chest pulses for **0.45 seconds** before firing at the player's current
position. Each shot deals **10 damage**, applies **3.6 knockback**, and travels at
**10 m/s**. Player bolts damage the Keeper through its shared **2.3 m chest sphere**.

### Gold-lane charge

The charge is a committed, dodgeable attack:

1. The Keeper locks the player's position inside the combat radius.
2. A gold lane marks that exact route for **0.9 seconds**.
3. The Keeper rushes straight down the lane at **9.5 m/s**.
4. Contact deals **24 damage** and **6.5 knockback**, at most once per charge.
5. At the locked destination, the Keeper enters a **1.1-second recovery window**.

Shot and summon clocks do not advance during the charge telegraph, rush, or recovery,
preventing those attacks from overlapping the sequence.

### Summoned Echoes

Four authored add points around the deck are checked against the player, existing
enemies, pending portals, and other positions reserved for the same group.

| Phase | Summoned group |
|---|---|
| I | 1 Gargoyle |
| II | 1 Gargoyle + 1 Gale |
| III | 2 Gargoyles + 1 Gale |

Summoned Gargoyles hold their deck positions and use the same wing slam as the ascent
sentries. Summoned Gales remain inside the center circle and keep the same
**vertical-only movement rule**: their horizontal position is fixed.

The shared limits still apply: no more than **6 lesser threats** and **2 Gales**.
Crossing a phase threshold clears any immediate attack windup, grants the Keeper a
**1-second invulnerable flare**, resets its attack clocks, and immediately attempts
that phase's summon group.

---

## Death and retry

Dropping Liwanag to zero or being overtaken by the tide triggers the normal faint
cinematic.

- **During the ascent** — restart at the tower base. Tide, seals, riddles, threats,
  portals, projectiles, Lumina, health, and temporary movement effects all reset.
- **During the boss or after its defeat handoff** — restart directly on the summit at
  `(0, 19.62, 5.5)`, facing the Keeper. All seals remain open, but the Keeper returns
  to 60 HP and its phases, adds, projectiles, attack clocks, Lumina, tide, player
  health, and HUD state reset.

The completed climb therefore does not have to be replayed after a boss-phase death.

---

## HUD

| Element | Where | Shows |
|---|---|---|
| **Tower ascent panel** | Upper left | Air gap, altitude, 18 m progress, tide state, risk state, three seal pips, and active movement burden |
| **Liwanag** | Bottom left | Player health with the shared trailing ghost fill |
| **Tower Threats** | Combat HUD | Live and pending lesser-threat count during the climb |
| **Bugtong banner** | Upper center | Seal number, Filipino prompt, English gloss, and shooting instruction |
| **Tower event message** | Upper screen | Gale arrivals, seal results, Keeper attacks, summons, and phase changes |
| **Threat markers** | Screen edge | Nearby off-screen threats; vertically distant Gargoyles are filtered out |
| **Damage arcs** | Around the crosshair | Direction of the most recent hit |

At boss activation, the ascent panel disappears. The shared top-center boss frame
shows **The Archivist**, its 60-HP bar, and the trailing ghost fill. The
right-side counter changes to **Summoned Echoes** and reports live plus pending adds.
World-space charge lanes remain the primary warning for the Keeper's rush.

The tower HUD has narrow-screen layout adjustments and reduced-motion fallbacks in its
own stylesheet.

---

## Victory and return

At zero Keeper HP, its active attack lane disappears, the Guardian body fades, combat
and remaining threats stop, and the shared **5.6-second victory-rift sequence** begins.
Memory shards burst from the Keeper, reverse into a rift at its elevated world
position, and pull the first-person camera across the boss deck and through the
threshold. The preserved Arena 3 return then scatters the zone's artifacts from the
fallen Guardian position and spawns the Zone 3 Guardian Soul if needed.

---

## Where the code lives

| Concern | File |
|---|---|
| Tower shell, ramps, rails, summit deck, and authored anchors | [src/core/zones/arena3.js](src/core/zones/arena3.js) |
| Ascent/tide state, phase handoff, retries, and tower HUD state | [src/core/arena/TowerArenaController.js](src/core/arena/TowerArenaController.js) |
| Seeded spawning, threat caps, projectiles, damage, and cleanup | [src/core/arena/TowerCombatManager.js](src/core/arena/TowerCombatManager.js) |
| Fixed Gargoyle and vertical-only Gale behavior | [src/core/arena/TowerThreat.js](src/core/arena/TowerThreat.js) |
| Memory-seal riddles, wrong-answer slow, and penalty spawn | [src/core/arena/TowerGateManager.js](src/core/arena/TowerGateManager.js) |
| Shared boss health, phases, chest hit, and invulnerability contract | [src/core/arena/ArenaBoss.js](src/core/arena/ArenaBoss.js) |
| Keeper body reuse, shots, charge, summons, and phase tuning | [src/core/arena/TowerKeeper.js](src/core/arena/TowerKeeper.js) |
| Existing Zone 3 Guardian model and authored animation | [src/core/guardians/zone3Guardian.js](src/core/guardians/zone3Guardian.js) |
| Shared Lumina reward pool | [src/core/arena/LuminaManager.js](src/core/arena/LuminaManager.js) |
| Boss frame, health bars, threat counts, markers, and damage arcs | [src/ui/CombatHud.js](src/ui/CombatHud.js) |
| Arena 3 HUD styling | [_partials/tower-arena-hud.css](_partials/tower-arena-hud.css) |
| Tower, shared combat, and reward tunables | `TOWER_ARENA`, `COMBAT`, and `LUMINA` in [src/config.js](src/config.js) |
| Shared boss explosion, rift, and first-person pull | [src/cutscene/ArenaVictoryCutscene.js](src/cutscene/ArenaVictoryCutscene.js) and [src/cutscene/_partials/ArenaVictoryRift.js](src/cutscene/_partials/ArenaVictoryRift.js) |
| Arena entry, faint handling, victory return, artifacts, and Guardian Soul | [src/core/_partials/ArenaFlow.js](src/core/_partials/ArenaFlow.js) |

Keeper-specific values remain beside the boss behavior in `TowerKeeper.js`. Shared
tower threat, tide, and reward values remain in `config.js`, matching the ownership
split used by the other arenas.
