# Arena 2 — Memory River: LIKET

**Guardian:** The Reveler  
**Zone:** 2 (Pangasinan festivals and coastal memory)  
**Entered from:** the Memory Rift in Zone 2 (tap **E**); victory returns the player
to Zone 2, scatters its artifacts, and leaves the Guardian Soul to recover.

Arena 2 is a stationary-boat rail shooter. The bangkâ remains at the river center while
festival banks, mangroves, foam, and distant structures scroll past to create forward
motion. The player cannot walk during the encounter: the challenge is aiming, target
priority, projectile reflection, riddle recognition, and surviving sustained pressure.
The Reveler waits upstream at `z = -31`.

---

## The loop at a glance

```text
       continuous random river threats (3–5s groups, cap 8)
                              │
                    survival clock reaches 0:20
                              ▼
                        [BUGTONG 1]
                 prompt → stage → read → attack
                              │ correct
                              ▼
           threats resume after 1s ──▶ clock reaches 0:55
                                              ▼
                                        [BUGTONG 2]
                                              │ correct
                                              ▼
           threats resume after 1s ──▶ clock reaches 1:30
                                              ▼
                                        [BUGTONG 3]
                                              │ correct
                                   all three wards broken
                                              ▼
                              ╔══════════════════════════╗
                              ║   THE REVELER BOSS FIGHT ║
                              ╚══════════════════════════╝
```

Three correct bugtong answers remove The Reveler's three armor wards. Direct shots at
the boss before that point are consumed by the armor and produce a defensive flare.

All encounter, spawn, riddle, lantern, and boss clocks pause when pointer lock is
released. The scenery may remain animated, but the player cannot lose time or take new
simulation damage while paused.

---

## Phase 1 — Continuous river pressure

Arena 2 does not use numbered waves. It opens with a two-enemy group and continuously
draws another random group every **3–5 seconds**. Live enemies and enemies still behind
spawn portals count toward a shared cap of **8**.

| Group size | Composition |
|---:|---|
| 1 | Random River Sniper or Frenzied Boarder |
| 2 | One River Sniper + one Frenzied Boarder |
| 3 | Randomized 2/1 mix of the two enemy types |

If the river becomes completely empty, the next spawn is scheduled within **0.5 s**.
The normal **1.4 s woven-thread tear** still telegraphs each enemy before it rises into
the fight, so the fast recovery removes dead time without creating an unannounced hit.

### Open-water placement

- Every portal is constrained to the river channel at approximately `x = -6.5…6.5`.
- River Snipers use the forward band at `z = -24…-18`.
- Frenzied Boarders begin farther upstream at `z = -31…-26`.
- New positions stay at least **2.2 m** from other live or pending spawn positions.
- If no separated position can be found, that enemy is skipped and the scheduler
  retries instead of placing a portal in the trees or on a bank.

### River threats

| Enemy | HP | Main timing | Damage | Behavior |
|---|---:|---:|---:|---|
| **River Sniper** | 2 | Shot every 1.8 s | 10 | Holds upstream and fires a projectile at the boat. A player bolt can reflect the shot; a reflected hit finishes its source. |
| **Frenzied Boarder** | 2 | 0.8 s boarding tell, then attacks every 1.25 s | 14 | Moves at 4.2 m/s toward the boat, telegraphs at close range, then repeatedly strikes Boat Integrity. |

The player has **100 Boat Integrity** and fires the normal light-bolt with a **0.22 s**
cooldown. Incoming sniper shots can be reflected before the bolt checks enemy bodies,
making projectile defense a deliberate priority rather than an accidental collision.

### Memory Lumina

Genuine lesser-enemy kills retain the shared **30%** Lumina drop chance. Arena 2 pulls
the reward automatically into the stationary boat over **0.45 s**:

- **Vitality** — restores 25 Boat Integrity.
- **Zephyr** — slows river threats to 55% speed for 8 s.
- **Overcharge** — automatically fires at 8 shots per second for 5 s.

---

## Phase 2 — Timed bugtong lantern volleys

The three-segment meter at the top of the screen measures **active survival time**, not
wall-clock time. Riddle sequences and pointer-lock pauses freeze it.

| Segment | Riddle becomes due | Meter behavior |
|---:|---:|---|
| 1 | `0:20` | First segment fills from the start |
| 2 | `0:55` | First remains full; second fills over the next 35 s |
| 3 | `1:30` | First two remain full; third fills over the final 35 s |

At riddle entry, the enemy scheduler stops and every pending portal is cancelled.
Enemies already in the river remain active at **65% speed**, so the player still has to
manage pressure while reading. No new enemy can arrive until the answer resolves.

### One riddle sequence

1. **Prompt — 3 s.** The Filipino bugtong and English gloss appear before any answer.
2. **Staging — 1 s.** All three shuffled lanterns spawn at The Reveler and travel to
   the exact midpoint between boss and boat.
3. **Reading — 3 s.** The lanterns stop completely on one horizontal line at
   `x = -4.5`, `0`, and `+4.5`. They are visible but cannot be shot.
4. **Attack — 6 s.** All three lanterns launch together toward the boat and become
   shootable. The wide starting gaps keep their labels readable before they converge.

The correct answer is reshuffled every attempt; it is not tied to the center lane.

### Answer outcomes

**Correct answer**

- The correct lantern is reflected into The Reveler and the two decoys dissolve.
- One armor ward breaks.
- Enemy spawning resumes after **1 s**, unless this was the third ward and the boss
  phase begins instead.

**Wrong answer**

- The decoy dissolves and Boat Integrity takes **18 damage**.
- The remaining lanterns continue their attack, so the player can still identify and
  shoot the correct answer during the same flight.

**Missed correct answer**

- If the correct lantern reaches the boat, Boat Integrity takes **25 damage**.
- The volley is dismissed, waits **3 s**, reshuffles the same riddle, then repeats the
  one-second staging and three-second reading sequence.
- Enemy spawning remains stopped throughout the retry.

---

## Phase 3 — The Reveler boss fight

The final correct lantern completes its reflection animation before the handoff. All
pre-boss enemies, pending portals, and hostile sniper shots are cleared; the riddle
meter disappears; the boss health track appears; and an immediate two-enemy portal
group opens.

The Reveler has **100 HP** and uses the shared **2.3 m chest hit sphere**. A direct
player bolt deals the normal 1 damage. A reflected boss projectile deals **5 damage**.
Crossing 66% and 33% health starts a deeper phase and gives the shared 1.2-second
enrage flare.

### Lateral movement

The Reveler moves among safe river anchors at `x = -5.5`, `0`, and `+5.5` without
choosing the same anchor twice in a row.

- A **0.45 s warning pulse** announces the move.
- The lateral hop eases to the new position over **0.6 s**.
- Movement pauses while a projectile formation is charging or queued, keeping the
  orbiting projectiles readable.
- Move intervals tighten by phase: **5–7 s**, **4–6 s**, then **3–5 s**.

### Projectile formations

The Reveler creates several projectiles around its chest at once. Only one formation
can be active at a time.

| Phase | Projectiles | Next-formation cooldown |
|---|---:|---:|
| I | 1–2 | 5–7 s |
| II | 2–3 | 4–6 s |
| III | 3–5 | 3–5 s |

Formation behavior:

1. The projectiles orbit and follow the boss while visibly charging for **2 s**.
2. They can be reflected immediately, including during the charging period.
3. After the shared charge, each unreflected projectile waits its own random
   **0–0.9 s** offset before firing at the boat.
4. A fired projectile remains reflectable and deals **15 Boat Integrity damage** if
   it reaches the player.
5. A reflected projectile homes toward The Reveler's current chest position and deals
   **5 boss damage** on impact.

The next cooldown is drawn only after no projectile from the current formation remains
active: each one has been reflected, hit the boat, expired, or otherwise resolved.

### Boss enemy summons

Lesser enemies continue to arrive during the boss fight under the same cap of 8.

| Phase | Group size | Summon interval |
|---|---:|---:|
| I | 1–2 | 3.5–5 s |
| II | 1–3 | 3–4.5 s |
| III | 2–3 | 2.5–4 s |

Each phase change also attempts an immediate **three-enemy group**. The shared cap can
reduce that burst when the river is already crowded.

The boss therefore pressures the player on three independent reads: moving chest
position, reflectable projectile formations, and random river summons.

---

## Death and retry

Dropping Boat Integrity to zero triggers the normal faint cinematic and restores the
player to the stationary boat.

- **Before the boss** — restart the complete encounter: survival timer, riddles,
  armor wards, spawns, and Boat Integrity all reset.
- **During the boss or its handoff** — resume directly at the boss with all wards
  broken, full Boat Integrity, a fresh 100-HP Reveler, and a new opening summon.

No completed riddle run has to be replayed after a boss-phase death.

---

## HUD

| Element | Where | Shows |
|---|---|---|
| **Boss frame** | Top center | The Reveler's name and three armor pips; the health track replaces riddle timing once the boss becomes vulnerable |
| **Riddle meter** | Inside the top boss frame | Three cumulative segments plus `Riddle n in 0:ss`; freezes as `Riddle n active` during a riddle or retry |
| **Boat Integrity** | Bottom left | Player health and its trailing ghost fill |
| **River Threats** | Top right | Current live + pending threat count; there is no numbered wave total |
| **Bugtong banner** | Upper center | Filipino prompt, English gloss, current ward/reading/attack instruction |
| **Lumina status** | Combat HUD | Active Zephyr and Overcharge durations |
| **Threat markers** | Screen edge | Direction of off-screen river enemies |
| **Damage arcs** | Around the crosshair | Direction of the most recent hit |

---

## Victory and return

At zero boss HP, active boss projectiles are cleared, The Reveler implodes, combat and
Lumina stop, and the shared **5.6-second victory-rift sequence** begins. Memory shards
burst from the fallen boss, reverse into a rift at that position, and pull the
first-person camera off the stationary boat and through the threshold. The shared
Arena flow then returns the player to Zone 2, scatters the zone's artifacts from the
fallen Guardian position, and spawns the Zone 2 Guardian Soul if needed.

---

## Where the code lives

| Concern | File |
|---|---|
| Arena identity, player/guardian starts, river atmosphere | [src/core/zones/arena2.js](src/core/zones/arena2.js) |
| Encounter state machine, cumulative riddles, retry, boss handoff | [src/core/arena/RailArenaController.js](src/core/arena/RailArenaController.js) |
| Random open-water spawning, Boat Integrity, threat/projectile collisions | [src/core/arena/RailCombatManager.js](src/core/arena/RailCombatManager.js) |
| River Sniper and Frenzied Boarder behavior | [src/core/arena/RailThreat.js](src/core/arena/RailThreat.js) |
| Staging, reading, attack, deflection, and lantern labels | [src/core/arena/LanternProjectile.js](src/core/arena/LanternProjectile.js) |
| Shared boss health, phase, chest-hit, and armor contract | [src/core/arena/ArenaBoss.js](src/core/arena/ArenaBoss.js) |
| Reveler movement, summon clocks, phase tuning | [src/core/arena/RevelerBoss.js](src/core/arena/RevelerBoss.js) |
| Pooled charging, firing, reflection, and boss-orb damage | [src/core/arena/RevelerProjectilePool.js](src/core/arena/RevelerProjectilePool.js) |
| Stationary boat and recyclable parallax river scenery | [src/core/arena/RailScenery.js](src/core/arena/RailScenery.js) |
| Shared Lumina reward pool | [src/core/arena/LuminaManager.js](src/core/arena/LuminaManager.js) |
| Boss frame, segmented clock, health, markers | [src/ui/CombatHud.js](src/ui/CombatHud.js) |
| Arena 2 HUD styling | [_partials/rail-arena-hud.css](_partials/rail-arena-hud.css) |
| Rail and shared combat tunables | `RAIL_ARENA`, `COMBAT`, and `LUMINA` in [src/config.js](src/config.js) |
| Shared boss explosion, rift, and first-person pull | [src/cutscene/ArenaVictoryCutscene.js](src/cutscene/ArenaVictoryCutscene.js) and [src/cutscene/_partials/ArenaVictoryRift.js](src/cutscene/_partials/ArenaVictoryRift.js) |
| Arena entry, faint handling, victory return, rewards | [src/core/_partials/ArenaFlow.js](src/core/_partials/ArenaFlow.js) |

The Reveler's boss-specific numbers stay beside its behavior in `RevelerBoss.js` and
`RevelerProjectilePool.js`. Shared rail, lantern, enemy, and reward values remain in
`config.js`, matching the ownership split established by Arena 1.
