# STRINGS — Game Design Document

**Implementation-aligned edition — 30 July 2026**
**AI Game On! — “Giving Our History a New Heartbeat through the Intelligence of Tomorrow”**

---

## 1. Document Status

This document is the design source of truth for the current browser build of
**Strings**. It describes implemented player-facing behavior found in the
repository, not the superseded five-zone prototype.

Authority for resolving discrepancies is:

1. executable source and cultural-content data;
2. focused automated tests;
3. current arena and game-loop documents;
4. older concept prose.

Unless explicitly marked otherwise, “current” means statically confirmed in the
codebase. Browser feel, timing, rendering, audio balance, and live-network behavior
still require manual playtesting.

### Current build at a glance

| Item | Current design |
| --- | --- |
| Genre | First-person exploration, light-casting combat, cultural-memory collection |
| Platform | Desktop web browser; keyboard and mouse |
| Technology | Vanilla JavaScript ES modules, Three.js 0.160.0 via CDN |
| Campaign | Museum hub plus three submerged memories and three Memory Arenas |
| Cultural collection | 27 artifacts: 11 food, 9 festival, 7 landmark memories |
| Knowledge challenge | 127 curated bugtong; three challenges are presented per arena |
| Progression keys | 3 Guardian Souls, one from each completed arena |
| Save model | Session-only local progress; settings persist in `localStorage` |
| Network role | Optional artifact-collection notification; local progress remains authoritative |

---

## 2. High Concept and Player Promise

The player wakes in **Aking Museo**, an empty digital museum connected to three
flooded memories of Pangasinan. Each memory has been bound by a Guardian and
distorted into a combat trial. The player enters a Memory Rift, survives the
Guardian’s arena, answers traditional bugtong through light-casting, and defeats
the Guardian. Only then do the memory’s cultural artifacts return to the world as
recoverable Echoes.

The player promise is:

> Follow the Hibla, survive the memory’s trial, and carry Pangasinan’s food,
> festivals, and places home.

### Design pillars

1. **Memory made navigable.** Cultural knowledge is expressed through places,
   artifacts, sound, riddles, and the physical act of returning objects to a
   museum.
2. **Knowledge under pressure.** Bugtong are not detached quizzes; the player
   must read, aim, and answer inside distinct combat structures.
3. **Recovery, not extraction.** Defeating a Guardian does not finish a memory.
   The player must peacefully recover every artifact and the Guardian Soul.
4. **A coherent sensory language.** Teal Hibla, spatial Echo pings, warm artifact
   light, woven spawn tears, and museum displays connect navigation, combat, and
   collection.
5. **Local progress first.** Optional network failure must never revoke a
   discovery or prevent campaign completion.

### Target experience

The intended emotional arc moves from isolation and uncertainty, through
high-pressure confrontation, into attentive recovery, curation, and restoration.
Combat supplies urgency; exploration and museum replay provide reflection.

---

## 3. Audience, Platform, and Controls

### Audience

The game is designed for players interested in Philippine cultural heritage,
atmospheric first-person games, accessible action, and knowledge-based challenges.
Pangasinan, Filipino, and English are used together so local language remains
central while meaning stays legible to a wider audience.

### Input contract

| Input | Action |
| --- | --- |
| `W A S D` | Move |
| Mouse | Look |
| `Shift` | Sprint while moving and stamina remains |
| `Space` | Hop ground-level attacks while a combat encounter enables it |
| Left click | Fire the current primary thread during combat |
| `E` | Reach, enter a Memory Rift, recover an artifact, or awaken the Final Memory |
| `F` | Release the combat shockwave |
| `Q` | Dash during Endless Memory Survival |
| `R` | Release Alab when charged; reroll while a Survival draft is open |
| `1`–`3` | Choose a Survival upgrade card |
| `Escape` | Release pointer lock and pause |

The current build is desktop-first. No touch-control implementation is shipped.

### Movement

- Base wading speed is **2.6 m/s**.
- Sprint multiplies speed by **1.8**.
- A full stamina tank supports about **6 seconds** of continuous sprint and takes
  about **9 seconds** to refill.
- The controller supports collision sliding, authored ramps and landings,
  knockback, movement slows, and temporary external motion.
- The visible right hand and fishing lure react to movement, reaching, and Light
  casting.

### Pause and settings

Pointer unlock, focus loss, and visibility loss pause active gameplay and
cinematics. Gameplay time, DOM animations, combat input, and audio pause together.
Resume remains on screen until pointer lock succeeds. Music and SFX sliders are
stored separately in `localStorage`. Active Survival follows the same pointer-lock
pause contract; its upgrade and defeat overlays intentionally own unlocked input
and cannot be paused as live combat.

---

## 4. World, Themes, and Narrative

### Premise

The game takes place inside a digital archive where Pangasinan’s memories have
become submerged, fragmented worlds. Water is both loss and suspension: culture
has not vanished, but it cannot return without being remembered, understood, and
carried home.

The player’s identity is intentionally understated. Their function is more
important than a fixed biography: they are a witness, defender, and keeper of
memory.

### Aking Museo

The campaign begins in an empty version of **Aking Museo**. Its three portals
lead to:

| Portal | Memory | Cultural lens | Arena |
| --- | --- | --- | --- |
| Center | PONSIA | Food and market life | Memory Arena |
| Left | LIKET | Festivals and communal joy | Memory River |
| Right | PANANISIA | Landmarks, faith, and civic memory | Memory Tower |

The authored production progression is one memory at a time, with the next portal
opening when a zone is complete. The current configuration has
`DEBUG_UNLOCK_ALL_ZONES` enabled, so all three portals are available in any order
for testing. That flag is debug behavior, not a narrative rewrite.

### Campaign arc

1. Wake in the empty museum.
2. Descend into a submerged memory.
3. Locate and enter its Memory Rift.
4. Complete the zone-specific arena and defeat its Guardian.
5. Return to the memory as its artifacts scatter into the world.
6. Recover every artifact and the Guardian Soul.
7. Return to Aking Museo; the collection and Soul are placed on display.
8. Repeat until all three Souls rest on the central altar.
9. Hold `E` at the altar to awaken the Final Memory.
10. Witness the completed museum, restored province, and credits.
11. Return to the epilogue museum or begin a credits-only Endless Memory run.

---

## 5. Core Loops

### Moment-to-moment exploration

```text
Read the Journey objective
→ navigate by landmarks, Hibla, and Echo audio
→ approach an interaction
→ hold E to reach
→ view cultural discovery
→ continue until the memory is complete
```

### Arena loop

```text
Cast Light → evade threats → build Alab → collect Memory Lumina
→ reach a riddle milestone → read three answers → shoot an answer
→ break Guardian armor or open a seal → defeat the boss
```

### Endless Memory loop

```text
Clear escalating waves → draft one upgrade every fifth wave
→ defeat a remixed Guardian every tenth wave
→ heal, earn a reroll, and continue
→ on defeat, retry from Wave 1 or return to Aking Museo
```

Endless Memory is a separate, desktop-only endgame run. It does not add a
campaign portal, title unlock, or persistent meta progression.

Each campaign Memory Arena changes the pacing and spatial problem while
retaining shared rules: 100 Liwanag, Light bolts, Alab, Lumina, readable
telegraphs, three bugtong, a three-phase boss, and explicit retry behavior.

### Zone completion rule

A memory is complete only when both conditions are true:

- every artifact assigned to that zone has been recovered; and
- that zone’s Guardian Soul has been collected.

Arena victory alone does not complete a zone.

---

## 6. Global Systems

### Liwanag and Light casting

In the campaign, the player has **100 Liwanag**. Left click fires a pooled Light
bolt at a maximum cadence of one shot every **0.22 seconds**. A normal bolt deals
**1 damage**. Survival starts from that default, then may lock the run into Rapid
Weave, Continuous Laser, or Thread Lance.
Damage direction arcs, a hurt vignette, health-lag fills, hit markers, FOV punch,
hitstop, impacts, and enemy markers communicate combat state.

### Alab

Successful combat builds the Alab meter:

- normal hit: **+1%**;
- kill: **+10%**.

In the campaign, pressing `R` when full releases a **3-second**,
**8-shots-per-second** Light burst. Shots fired during Alab do not recharge it.
In Survival, Alab is weapon-neutral and multiplies primary cadence by **1.75**;
Alab Reservoir can extend its duration, and Continuous Laser gains no heat while
it is active.

### Common lesser enemies

| Threat | Role | Core values |
| --- | --- | --- |
| Chaser / Starved Fisher | Pursues and strikes at close range | 2 HP, 15 damage |
| Spitter | Maintains range and fires dodgeable projectiles | 3 HP, 10 damage |

Enemy arrivals use a **1.4-second woven-thread tear** followed by a short emerge
animation. Pending enemies count toward encounter capacity but cannot act before
arrival.

### Memory Lumina

Defeated lesser threats have a seeded **30%** base chance to drop one temporary
Lumina. Drops expire after **12 seconds**.

| Lumina | Effect |
| --- | --- |
| Vitality | Restores 25 Liwanag |
| Zephyr | 8 seconds of enhanced movement; slows threats in the stationary rail arena |
| Overcharge | 10 seconds of double primary-thread damage |

Drop selection adapts to player health. Arena 2 auto-collects nearby Lumina;
standard arena forms may be collected by proximity or shot.

### Failure and retry

Death triggers a faint/blackout return rather than permanent loss.

- Arena 1 before the boss: restart the arena run.
- Arena 1 during the boss: resume at the boss with a fresh fight state.
- Arena 2 before the boss: restart the timed river trial.
- Arena 2 during the boss: resume at the boss.
- Arena 3 during ascent: restart the tower ascent.
- Arena 3 during the summit boss: resume at the summit.

No persistent database is used by gameplay or tests.

---

## 7. Museum Hub and Progression

Aking Museo is a walkable first-person hub with a central gallery and two side
wings. It provides:

- three memory portals;
- **36 prepared artifact frames**, 12 per zone section;
- replayable discovery cards for recovered artifacts;
- a three-slot Guardian Soul altar;
- the threshold for the Final Memory;
- an epilogue state after the ending.

Recovered artifacts populate frames automatically. Aiming at a displayed artifact
and pressing `E` reopens its cultural card. Guardian Souls are placed
automatically on the central altar.

The museum is not a separate online profile. Campaign progress lives only for the
current page session. Refreshing the page starts a new run; music and SFX settings
are the exception.

---

## 8. Zone 1 — PONSIA

### Identity

PONSIA is the food and market memory: a drowned commercial spine of stalls,
warehouses, cooking spaces, rubble, a raised dock, mangroves, and a distant tower.
Its cultural collection contains **11 Pangasinan foods and food traditions**.

### Memory Arena

PONSIA’s arena is a circular combat space built around a fixed **10-wave** run.
Riddle rounds occur after waves **3, 6, and 10**. The wave clock stops while a
riddle is active.

For each bugtong:

1. the bilingual prompt appears;
2. three labeled coral answer nodes form in front of the player;
3. the player shoots one node;
4. a correct answer removes one Feastkeeper armor layer;
5. a wrong answer locks that choice, spawns **2 Chasers and 1 Spitter**, and
   leaves the remaining answers available.

After the third correct answer, the armor shatters and the **Feastkeeper** becomes
vulnerable.

### Feastkeeper

The Feastkeeper has **70 HP** and three health phases. It creates pressure on two
independent clocks:

- telegraphed projectiles become faster between phases;
- mixed enemy groups are summoned more frequently, up to five live adds.

Later phases bias summons toward larger groups. The encounter is an attrition and
target-priority test: keep moving, manage adds, and find safe windows to damage
the boss.

---

## 9. Zone 2 — LIKET

### Identity

LIKET is the festival memory: a submerged parade avenue with lantern strings,
bunting, a gong circle, ballroom ruins, a float graveyard, bandstand, and glowing
parul mast. Its collection contains **9 Pangasinan festivals**.

### Memory River

The player stands on a stationary boat while layered scenery scrolls past to
create forward travel. Movement is locked to the boat, turning the challenge into
aiming, target priority, reflection, and sustained pressure.

River Snipers and Frenzied Boarders spawn every **3–5 seconds**, with a maximum of
**8 threats**. Bugtong occur at **20, 55, and 90 seconds of active encounter
time**. Pauses and riddle presentation do not consume that active clock.

Each riddle follows a protected readability sequence:

1. prompt reveal: **3 seconds**;
2. three answer lanterns travel into formation: **1 second**;
3. lanterns hold still for reading: **3 seconds**;
4. all three fly toward the boat over **6 seconds**.

The lanterns line up at `-4.5`, `0`, and `+4.5` metres. Shooting the correct
lantern reflects it into the Reveler and removes one armor layer. Shooting a
decoy deals **18 damage**; allowing the volley to reach the boat deals **25
damage**. The riddle retries without erasing previously broken layers.

### The Reveler

The Reveler has **70 HP** and three phases. It:

- shifts between three lateral river anchors;
- charges projectile formations for **2 seconds**;
- fires staggered boss orbs at the boat;
- takes **5 damage** when an orb is reflected back;
- summons mixed river threats with increasing frequency.

The player must decide whether to clear pressure, shoot incoming attacks, or
reflect an orb into the boss.

---

## 10. Zone 3 — PANANISIA

### Identity

PANANISIA is a drowned cathedral and memory archive inspired by Pangasinan’s
religious, civic, and coastal landmarks. A flooded nave, broken vault ribs,
transepts, altar ruins, memory strings, drifting fragments, and bell-tower
silhouette create a solemn vertical approach. Its collection contains **7
landmarks**.

### Memory Tower ascent

The player climbs a twelve-flight tower to a summit **18 metres** above the base.
After an **8-second grace period**, water rises at **0.16 m/s**. The HUD reports
height, water clearance, three seal states, slow effects, and warning/critical
pressure.

Ascent threats are:

- **Gargoyles:** four authored sentries with 4 HP, a close-range telegraph,
  18-damage strike, and knockback;
- **Gale Whispers:** flying shooters with 2 HP that follow the player’s vertical
  tier and deal 10 damage plus knockback.

Three Memory Seals stand at heights **6, 12, and 18 metres**. Each presents one
bugtong and three shootable answer mechanisms. A correct answer opens the seal.
A wrong answer:

- destroys that decoy;
- slows movement to **55% for 4 seconds**;
- summons a penalty Gargoyle.

### Keeper of Memories

After all seals open and the summit is reached, the Guardian introduction leads
into the Keeper fight. The tide settles below the summit for the boss phase.

The Keeper has **200 HP** and three phases. Its pattern set includes:

- aimed, telegraphed projectiles;
- a gold-lane charge that deals **24 damage** and heavy knockback;
- a punish window of **2–3 seconds** when the charge misses;
- warning-circle memory stones that fall in expanding volleys;
- occasional Lumina from a designated falling stone;
- rotating lighthouse beams;
- summoned Gargoyles and Gales.

Attack cadence, hazard count, beam coverage, and summon groups intensify at the
66% and 33% health thresholds.

---

## 11. Artifacts, Hibla, Echoes, and Discovery

### Cultural inventory

| Zone | Theme | Count | Artifacts |
| --- | --- | ---: | --- |
| PONSIA | Food | 11 | Alaminos Longganisa, Dasol Sea Salt, Kaleskes, Pigar-pigar, Puto Calasiao, Patupat, Bagoong, Burong Isda, Binungey, Tupig, Bangus |
| LIKET | Festivals | 9 | Bagoong Festival, Bangus Festival, Binungey Festival, Galicayo Festival, Mangunguna Festival, Patupat Festival, Pindang Festival, Pista’y Dayat, Talong Festival |
| PANANISIA | Landmarks | 7 | Hundred Islands, St. James the Great Parish Church, Banáan Pangasinan Provincial Museum, Cape Bolinao Lighthouse, Pangasinan Provincial Capitol, Basilica of Our Lady of Manaoag, Sison Auditorium |

Artifact prose distinguishes evidence-based origin from cultural lore. The
research ledger avoids unsupported inventors, precise origin dates, and tourism
superlatives. Stable IDs are retained independently of corrected display names.

### Scatter and placement

After arena victory, all still-uncollected artifacts for that zone burst from the
Guardian’s return point in a **1.3-second** arc. Placement uses the zone’s authored
spawn categories:

- near wall;
- submerged interior;
- elevated rubble;
- open water.

Targets maintain a preferred minimum separation of **14 metres** and avoid solid
geometry. Placement is procedural within authored spatial rules, not generated by
an external AI service.

### Hibla

Each active artifact owns one thick, curved, fishing-line-like Hibla. It fades in
at roughly **13 metres**, brightens and pulses with proximity, and fades out at
very close range so it does not obscure the object. The Hibla indicates
relationship and direction; it is not a literal trail of multiple lines.

### Echo audio

Every artifact also emits a distinct spatial bell ping every **2.6 seconds**.
Echoes can be heard out to **28 metres**, with a fade across the final 8 metres,
so sound guides the player before the shorter-range Hibla becomes visible. The
nearby melodic layer swells within 24 metres.

### Recovery and discovery

The player holds `E` for **2.5 seconds** near an artifact. Reaching animates the
hand and lure. On completion:

1. the artifact is committed to local progress;
2. its bilingual discovery card opens;
3. origin and lore are presented separately;
4. the corresponding museum frame becomes populated;
5. an optional collection notification is attempted.

Artifact recovery after an arena is peaceful. The older “contested artifact
waves” loop is not active in the current game.

---

## 12. Bugtong and Cultural Knowledge

The shipped riddle corpus contains **127 traditional Pangasinan bugtong**. Each
entry includes:

- a Pangasinan prompt;
- a Filipino line;
- an English gloss;
- three answer choices;
- one correct choice.

Arena attempts select riddles using seeded randomness; the first two arena
controllers pre-draw spare entries while presenting three challenges. Answer order
may be shuffled, but the underlying content remains unchanged. Labels use a shared
measured layout that supports up to three centered lines and expands before
reducing font size; the test suite checks all **381 shipped answer choices** for
preservation and fit.

The data notes credit the Bayambang Culture Mapping Project and Dr. Perla Nelmida
as source context. Cultural spelling, diacritics, and meaning must be preserved
when editing content.

---

## 13. UI, Guidance, Accessibility, and Presentation

### Journey guidance

The Journey Guide derives its objective from live game state:

- enter the Memory Rift;
- recover scattered memories;
- recover the Guardian Soul;
- enter an open museum memory;
- awaken the Final Memory.

It collapses during arenas and hides during cinematics, debug flow, fainting, and
the ending. One-time control and Lumina explanations are queued without repeating
within a run.

### Combat readability

Combat surfaces include:

- Liwanag and lagging damage fill;
- Alab charge and ready/firing states;
- wave or threat count;
- boss name, health, and armor pips;
- bilingual riddle banner;
- Arena 2 segmented riddle timeline;
- Arena 3 ascent, water, seal, slow, and event HUD;
- hit marker, hurt vignette, directional damage arcs, and off-screen threats;
- Lumina status.

Survival adds wave and remaining-threat counts, the next fifth/tenth-wave
milestone, primary-thread and Laser heat state, dash charges, and rerolls.

Responsive CSS reduces HUD footprints on narrow screens, but the interaction model
remains keyboard-and-mouse. Reduced-motion media queries disable selected pulses
and transitions; they do not currently remove all camera motion or gameplay VFX.

### Visual direction

The base world combines dark blue-green water, exponential fog, low warm/cool
contrast, sediment, god rays, mangroves, authored ruins, and selective emissive
geometry. The three memories then diverge:

- PONSIA: weathered market materials, food warmth, bamboo, pots, and moss;
- LIKET: festival cloth, lantern gold, parul light, coral, and movement;
- PANANISIA: cathedral stone, pale memory light, gold seams, and vertical scale.

Guardian silhouettes are bespoke procedural models built from Three.js primitives:
the Feastkeeper is a food-and-market golem, the Reveler is a coral festival titan,
and the Keeper is an architectural memory spirit. Reference images guide their art
direction, but no external 3D model files are loaded.

### Audio direction

Audio is synthesized with Web Audio:

- a composed 32-beat, 66 BPM kulintang-inspired loop;
- low ambient drone and underwater delay;
- spatial artifact Echo bells;
- Light, impact, enemy, armor, portal, Soul, Lumina, and UI cues;
- Survival beam, lance, dash, elite-warning, upgrade-selection, and
  Guardian-arrival cues;
- separate music and SFX buses.

The restored-province ending is subtitle-led. An optional recorded voiceover path
exists but is currently `null`, so no narration asset is required or played.

---

## 14. Final Memory and Ending

When all three Guardian Souls are placed, the altar becomes active. Holding `E`
for **2.5 seconds** begins the ending:

1. a portal forms and pulls the camera forward;
2. the game reveals the completed museum for **13.5 seconds**;
3. a dry, restored Pangasinan tableau plays for **31 seconds**;
4. bilingual subtitles connect food, festivals, landmarks, and returning memory;
5. the Strings fade as the restored province remains;
6. credits appear;
7. the player chooses **Enter Endless Memory** or **Return to Aking Museo**.

The ending is a cinematic restoration of cultural continuity, not a permanent
online museum publication. The disabled-by-default
`DEBUG_TEST_ENDING_BUTTON` flag can expose the full ending for testing. Its
credits may launch Survival for QA, but debug/presenter progression remains
ineligible for the legitimate-ending GameOn reward.

**Return to Aking Museo** enters the epilogue museum with its exits sealed.
**Enter Endless Memory** starts a fresh Wave 1 run in a 32m-radius altar-born
Memory arena. The route is credits-only: no title access flag or `localStorage`
unlock is created.

---

## 15. Technical Architecture

### Runtime

- `index.html` defines the import map, canvas overlays, and DOM HUD.
- `src/main.js` boots the `Game` composition root.
- `Game` owns campaign state, scene transitions, and the animation loop.
- `World` builds reusable atmosphere, collision, supports, primitives, and zone
  geometry from registered zone definitions.
- Arena controllers own encounter pacing; combat managers own shared firing,
  health, enemies, projectiles, feedback, and HUD integration.
- `SurvivalFlow` owns credits entry, teardown, retry, epilogue return, and update
  dispatch without expanding `Game` into a second combat controller.
- `src/core/survival/` separates deterministic wave and upgrade rules, run
  statistics, encounter direction, weapon resolution, and Survival combat.
- `src/core/zones/survival.js` owns the authored arena, while `SurvivalUI` owns
  its HUD, upgrade draft, Guardian stinger, and defeat ledger.
- Museum, cutscene, UI, audio, data, and artifact systems remain separate modules.

There is no package manager, bundler, or build step. The game must be served over
HTTP, and its first load requires network access for the Three.js CDN import.

### Data and persistence

- Artifact and riddle content ships locally as JavaScript data.
- Campaign collections and Souls are in-memory `Set` objects.
- Settings persist locally in the browser.
- Survival builds reset on defeat. Only the best result for the current page
  session is retained, and it is discarded on reload.
- GameOn Portal authorization stores only its Session Token and pending reward
  flag in `sessionStorage`; credentials remain on the platform sign-in page.
- There is no production campaign save/load system, database, or cloud museum in
  this repository.

### GameOn Portal artifact unlock

`APIManager` owns the guide's browser-authorized session boundary. A player starts
connection from the title or Settings UI; the game sends `{ gameId }` to
`POST https://gameonportal.ph/api/session`, opens the returned `signinUrl`, and
polls `GET /api/session` every three seconds with the Session Token as a bearer
token. `pending` continues polling, `authorized` stops it, and `expired` creates a
replacement session.

The platform artifact is a full-campaign reward, not a per-memory notification.
When all three zones are recorded complete and the player begins the real ending,
the game queues one bodyless `POST /api/artifacts/unlock`. The request waits for
authorization, coalesces concurrent attempts, and remains retryable after failure.
The final-cutscene and presenter progression shortcuts explicitly invalidate
reward eligibility. Platform failures never roll back local collection, museum
progress, or ending playback.

`PLATFORM_API.GAME_ID` remains `YOUR_GAME_ID`, which keeps all popup and network
activity disabled until the assigned value is supplied. The static game has no
Next.js proxy; external hosts and localhost require platform CORS support or a
separately configured proxy.

### Performance principles

- reuse pooled Light bolts, hostile projectiles, VFX, spawn tears, HUD markers,
  and damage arcs;
- avoid per-frame allocation in hot paths;
- use seeded randomness where repeatable encounter or placement behavior matters;
- dispose geometry, materials, audio voices, and event ownership on scene changes;
- use simplified primitives and collision footprints instead of heavy simulation;
- split authored source files at cohesive boundaries before they exceed the
  repository’s 1000-line limit.

---

## 16. Authoritative Tuning Summary

| System | Current value |
| --- | --- |
| Main memories | 3 |
| Artifacts | 27 total: 11 / 9 / 7 |
| Guardian Souls | 3 |
| Bugtong corpus | 127 riddles, 381 choices |
| Player health | 100 Liwanag |
| Base / sprint speed | 2.6 m/s / ×1.8 |
| Light bolt | 1 damage, 0.22s cooldown |
| Alab | 3s at 8 shots/s |
| Lumina drop chance | 30% base |
| Arena 1 | 10 waves; riddles after 3 / 6 / 10; boss 70 HP |
| Arena 2 | riddles at 20 / 55 / 90s; boss 70 HP |
| Arena 3 | 8s tide grace; 0.16 m/s rise; seals at 6 / 12 / 18m; boss 200 HP |
| Artifact reach | Hold `E` for 2.5s |
| Artifact scatter | 1.3s flight; preferred 14m separation |
| Hibla / Echo ranges | about 13m / 28m |
| Final Memory reach | Hold `E` for 2.5s |

Exact balance values live in `src/config.js` and the relevant boss modules. If a
value changes in code, this table must be updated in the same change.

### Endless Memory tuning

- Normal waves introduce chaser, spitter, boarder, sniper, gargoyle, and gale at
  Waves **1 / 2 / 3 / 4 / 6 / 8**. Live plus pending threats cap at **10**.
- For `tier = floor((wave - 1) / 5)`, lesser threats scale health by
  `1 + 0.30 × tier`, damage by `1 + 0.16 × tier`, speed up to `×1.45`, attack
  interval down to `×0.68`, and projectile speed up to `×1.35`.
- Every fifth cleared wave grants a one-of-three draft. Every tenth wave contains
  a remixed Guardian and authored summons, preceded by a **1.5-second** stationary
  camera stinger.
- Survival Guardian base health is Feastkeeper **180**, Reveler **160**, and
  Keeper **200**. For zero-based boss index `n`, health scales by `1 + 0.55n`,
  damage by `1 + 0.18n`, and attack interval by
  `max(0.68, 1 - 0.07n)`.
- Elites unlock after the first Guardian at **12%** chance, add seven percentage
  points per later Guardian, and cap at **40%** chance and four elites.
- Baseline Survival dash is one charge, **4s** recharge, **4.5m** distance,
  **0.16s** movement, and **0.22s** invulnerability.
- Rapid Weave is 1 damage at **0.18s** cadence; Continuous Laser is a **28m**
  hitscan beam with ten **0.55-damage** ticks per second and **2.5s** heat;
  Thread Lance is 3 damage at **0.65s**, **32m/s**, and three-target piercing.

The complete encounter and upgrade tables are maintained in
[`SurvivalMode.md`](SurvivalMode.md).

---

## 17. Current Limitations and Validation Boundary

### Implemented but configured for development

- all museum portals are unlocked by `DEBUG_UNLOCK_ALL_ZONES`;
- the Guardian showroom title shortcut is enabled;
- the ending title shortcut and dedicated debug-zone flag are disabled;
- `DEBUG_SURVIVAL_BOSS` defaults to `null`; with the debug ending enabled, it
  can force Feastkeeper, Reveler, or Keeper on Survival boss waves;

Release builds should deliberately review those flags.

### Known content and integration limitations

- the GameOn Portal Game ID is still an inert placeholder;
- ending narration is optional and has no configured asset;
- campaign progress is not persisted across refreshes;
- Survival has no campaign/meta save; its build resets on defeat and its
  session-best result resets on page reload;
- Survival is credits-only and desktop-only, with no title shortcut, mobile,
  touch, or gamepad route;
- Survival has no riddles, online leaderboards, external asset pack, arena
  mutators, or combo scoring;
- campaign play also has no mobile/touch controls;
- no live API response, CORS behavior, or deployment environment is verified here.

### Verification status

Static inspection confirms the architecture, data counts, state transitions,
controls, and tuning recorded above. Focused Node tests cover campaign contracts
and deterministic Survival recipes, scaling, elites, boss selection, upgrades,
dash stepping, result ordering, UI/DOM contracts, and credits-only routing. This
document does not claim browser, WebGL, visual, audio, timing, pointer-lock,
responsive, balance, CORS, popup, or live-network verification.

Before release, manually smoke-test:

- title, intro, all three portal flows, and repeated pause/resume;
- every arena, riddle presentation, boss, death, and retry checkpoint;
- artifact scatter, Hibla/Echo navigation, all 27 discovery cards, and museum replay;
- all three Souls, Final Memory, credits, and epilogue;
- legitimate and debug-ending Survival entry, Waves 1–10 pacing, all weapons and
  upgrades, Space hop, six lesser roles, three elite tells, and all remixed
  Guardians;
- the 1.5-second stationary-camera portal/name stinger and its pause behavior;
- Survival boss cleanup/heal/draft ordering, pause/resume twice, pointer-lock
  recovery, defeat/retry, epilogue return, HUD fit, every new cue and
  sustained-beam cleanup, reduced motion, and stress performance at the
  ten-threat cap;
- Survival active time excluding pauses, wave gaps, drafts, stingers, and defeat;
- visual readability, audio balance, console errors, asset loading, and real API
  behavior if a production endpoint is supplied.

Browser timing, pointer lock, visuals, audio, performance, and balance remain
manual runtime gates. Static and mocked checks must not be described as proving
those behaviors.

---

## 18. Repository Design References

- [`README.md`](README.md) — run instructions and project orientation
- [`GAME_LOOP.md`](GAME_LOOP.md) — legacy loop summary with the current ending branch
- [`Strings_v2.md`](Strings_v2.md) — transition from prototype to arena-first structure
- [`Arena1.md`](Arena1.md) — PONSIA encounter detail
- [`Arena2.md`](Arena2.md) — LIKET encounter detail
- [`Arena3.md`](Arena3.md) — PANANISIA encounter detail
- [`SurvivalMode.md`](SurvivalMode.md) — Endless Memory encounter and build guide
- [`reference/artifact-origin-research.md`](reference/artifact-origin-research.md) —
  cultural-origin editorial ledger

This GDD supersedes the former five-zone, 15-artifact walking-simulator design.
