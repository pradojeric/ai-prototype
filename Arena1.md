# Arena 1 — Memory Arena: Ponsia

**Guardian:** Bantay ng Piging / The Feastkeeper
**Zone:** 1 (Dagupan market — food & flavor)
**Entered from:** the Memory Rift in Zone 1 (tap **E**); winning returns to Zone 1 and
scatters that zone's artifacts for peaceful collection.

A walled circular spectral kitchen ringed by void. The player spawns at the center on a
low dais; the Feastkeeper waits ahead at `z = -10`, facing them. No artifacts spawn
here — this is a pure combat space.

---

## The loop at a glance

```
        ┌──────────────── 10 waves of drowned echoes ────────────────┐
        │                                                            │
   wave 1..2 ──▶ WAVE 3 clear ──▶ [BUGTONG 1] ──▶ wave 4..5 ──▶ WAVE 6 clear
                      │                                              │
                      │  wrong answer                          [BUGTONG 2]
                      ▼                                              │
                 LOCKOUT: nodes go dark,                       wave 7..9
                 penalty squad spawns,                               │
                 retry when they're dead                       WAVE 10 clear
                                                                     │
                                                              [BUGTONG 3]
                                                                     │
                                                     armor gone ─────▼
                                              ╔══════════════════════════╗
                                              ║   FEASTKEEPER BOSS FIGHT ║
                                              ╚══════════════════════════╝
```

Three bugtong (riddles) = three armor layers. Armor is **unbreakable by damage** — only
a correct answer strips a layer. With the last layer gone the guardian becomes
vulnerable and fights back.

---

## Phase 1 — The wave run (waves 1–10)

A fixed ten-wave run. Waves spawn on a ring 7–12 m from the arena center, never within
5 m of the player, each announced by a **woven-thread tear** that opens 1.4 s before the
echo rises through it — nothing ever materializes unannounced behind you. A cleared wave
gives a 1.6 s breather before the next.

| Wave | Chasers | Spitters | Note |
|-----:|--------:|---------:|------|
| 1 | 2 | — | |
| 2 | 2 | 1 | first ranged threat |
| 3 | 3 | 1 | **clear → Bugtong 1** |
| 4 | 2 | 2 | |
| 5 | 3 | — | |
| 6 | 3 | 1 | **clear → Bugtong 2** |
| 7 | 4 | 1 | |
| 8 | 3 | 2 | |
| 9 | 4 | — | |
| 10 | 4 | 1 | **clear → Bugtong 3 → boss** |

Composition wraps the four-entry wave table and adds one chaser per completed cycle, so
pressure climbs across the run rather than replaying waves 1–4 flat.

**The echoes**

| | HP | Speed | Damage | Behavior |
|---|---:|---:|---:|---|
| **Starved Fisher** (chaser) | 2 | 3.2 m/s | 15 | Melee at 1.4 m, ~1.1 s between swings. Faster than a wade (2.6), slower than a sprint (~4.7) — so kiting costs stamina. |
| **Spitter** | 3 | 2.1 m/s | 10 | Holds ~9 m and lobs slow, dodgeable spits with a 0.4 s glow telegraph. |

Enemies path by BFS flow field toward the player, falling back to it only when they lack
line of sight. The player has **100 Liwanag** (health) and a light-bolt on a 0.22 s
cooldown dealing 1 damage.

**Memory Lumina** — 30% of genuine kills drop a short-lived orb (12 s). Walk over it or
shoot it:

- **Vitality** (green) — heals 25
- **Zephyr** (blue) — 2.2× move speed for 8 s
- **Overcharge** (gold) — auto-fire at 8 shots/sec for 5 s

**The guardian during this phase is passive.** It idles and faces the player. Bolts that
hit it are consumed and flare off its armor — legible feedback that it cannot be hurt
yet, not a silently wasted shot.

---

## Phase 2 — Bugtong rounds (waves 3, 6, 10)

Clearing a milestone wave **freezes the wave clock**. No new wave spawns until the riddle
is answered, so the player answers under the pressure already on the field rather than a
fresh one stacked on top.

1. The bugtong appears on a non-blocking banner (Filipino prompt + English gloss).
2. After a **3 s reading beat**, three shootable coral **answer nodes** fan out 8 m in
   front of the arena center at aim height. Choice order is shuffled — the correct one is
   never reliably the middle node.
3. Shoot the node whose label answers the riddle.

**Correct** → all three nodes shatter, one armor pip breaks, the wave run resumes where
it paused.

**Wrong** → **lockout.** The wrong node shatters, the remaining choices go **dark and
inert** (bolts pass straight through them), and a penalty squad of **2 chasers + 1
spitter** spawns. The nodes relight only when that squad is fully dead, and the *same*
riddle is still there to answer.

> **No health is deducted for a wrong answer.** The fight *is* the punishment. Guessing
> your way through all three choices is impossible — each wrong guess costs a fight, and
> the penalty squad drops Lumina at half the usual rate.

---

## Phase 3 — The Feastkeeper boss fight

The third correct answer breaks the last armor pip. The wave run ends, any leftover adds
poof away (no kill credit, no drops), and the boss health bar lights up at the top of the
screen. From here every echo on the field is one the boss summoned.

**Mechanic: attrition on two clocks.** Shots and summons run on separate timers so they
never settle into a single rhythm you can stand still inside.

- **Shots** — a telegraph pulse fires 0.45 s before each spit leaves the chest, aimed at
  the player's current position. Dodgeable if you're moving and watching.
- **Summons** — an independent, *randomized* interval draws a group of **1, 3, or 5**
  echoes, weighted by phase. Capped at 8 live adds; summons past that ceiling are skipped.

The player must land bolts on the guardian's **chest** (a 2.3 m sphere) while doing both.

**Phases** — crossing a health threshold enrages the boss: it flares invulnerable for
1.2 s, immediately throws a **5-echo** group, and tightens both clocks.

| Phase | Entered at | Shot interval | Summon interval | Group size draw |
|---|---|---:|---|---|
| I | 100% | 2.6 s | 7–10 s | mostly 1, sometimes 3 |
| II | ≤66% | 1.9 s | 5–8 s | 1 / 3 / 5 |
| III | ≤33% | 1.3 s | 3.5–6 s | mostly 3 and 5 |

At zero health the Feastkeeper implodes into the shared **5.6-second victory-rift
sequence**. Memory shards burst from the fallen boss, reverse into a rift at that
position, and pull the first-person camera through it. The white threshold hides the
existing return to Zone 1, where the artifacts burst from where the Feastkeeper fell.

---

## Death and retry

Dropping to zero Liwanag triggers the faint cinematic and respawns at the arena center.
**Where you resume depends on when you died:**

- **During the waves or a riddle** → the whole encounter restarts: wave 1, full armor,
  freshly drawn riddles.
- **During the boss fight** → you resume **straight at the boss**, armor still broken and
  boss health reset. The ten waves you already fought are not replayed.

---

## HUD

| Element | Where | Shows |
|---|---|---|
| **Boss frame** | top center | Guardian name, armor pips, and — once the boss is vulnerable — its health bar with a ghost fill trailing behind each hit |
| **Liwanag** | bottom left | Player health, with the same ghost fill; breathes red under 30% |
| **Wave readout** | top right | `Wave n / 10` and live threat count. During the boss phase the wave number is hidden — only the threat count remains |
| **Bugtong banner** | upper center | Riddle text and the current hint (swaps to the lockout line while a penalty squad is alive) |
| **Threat markers** | screen edge | Arrows pointing at off-screen echoes |
| **Damage arcs** | around crosshair | Direction the last hit came from |

The boss health track stays hidden while armor holds — a full bar the player has no way
to move would read as a broken HUD, so the pips alone carry progress until the fight is
real.

---

## Where the code lives

| Concern | File |
|---|---|
| Arena geometry, wall ring, spawn band | [src/core/zones/arena1.js](src/core/zones/arena1.js) |
| Phase state machine, riddles, lockout, boss handoff | [src/core/arena/ArenaController.js](src/core/arena/ArenaController.js) |
| Waves, enemies, projectiles, player HP, feel layer | [src/core/combat/CombatManager.js](src/core/combat/CombatManager.js) |
| Shootable answer nodes (incl. the inert state) | [src/core/arena/AnswerNode.js](src/core/arena/AnswerNode.js) |
| Shared boss contract (health, phases, chest hit test) | [src/core/arena/ArenaBoss.js](src/core/arena/ArenaBoss.js) |
| The Feastkeeper's own mechanic + tuning | [src/core/arena/FeastkeeperBoss.js](src/core/arena/FeastkeeperBoss.js) |
| Lumina drops | [src/core/arena/LuminaManager.js](src/core/arena/LuminaManager.js) |
| Boss frame, health bars, markers | [src/ui/CombatHud.js](src/ui/CombatHud.js) |
| Arena/wave/enemy tunables | `ARENA` and `COMBAT` in [src/config.js](src/config.js) |
| Shared boss explosion, rift, and first-person pull | [src/cutscene/ArenaVictoryCutscene.js](src/cutscene/ArenaVictoryCutscene.js) and [src/cutscene/_partials/ArenaVictoryRift.js](src/cutscene/_partials/ArenaVictoryRift.js) |
| Scene swap, entry, return, faint | [src/core/_partials/ArenaFlow.js](src/core/_partials/ArenaFlow.js) |

Boss numbers are deliberately **not** in `config.js` — each zone's boss is an `ArenaBoss`
subclass that owns its tuning next to the mechanics that read it.
