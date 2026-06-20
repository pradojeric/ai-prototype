# STRINGS — Game Design Document
### AI Game On! | "Giving Our History a New Heartbeat through the Intelligence of Tomorrow"

---

## 1. GAME OVERVIEW

| Field | Details |
|---|---|
| **Title** | Strings |
| **Engine** | Three.js (WebGL) |
| **Genre** | First-Person Walking Simulator / Interactive Heritage Experience |
| **Platform** | Web Browser |
| **Setting** | Submerged City of Dagupan, Pangasinan, Philippines |
| **Theme** | Cultural preservation, memory, loss, and the invisible threads that connect us to the past |
| **Target Audience** | 15+ / Anyone interested in heritage, slow games, and Filipino culture |
| **Playtime** | 30–60 minutes |

---

## 2. CONCEPT STATEMENT

> *"Beneath the water, the city still breathes."*

**Strings** is a melancholic, first-person walking simulator set in a version of Dagupan City that has been swallowed by water after an unnamed incident. The player — a lone survivor of ambiguous identity — wades through the shallow, flooded ruins of a once-vibrant city. Guided by translucent fishing line-like strings that drift through the submerged air, the player searches for cultural artifacts scattered across five zones of Dagupan.

Each artifact found calls a City-Wide Portal API, unlocking a real-world historical fact about the object and Dagupan's heritage, which is archived in the player's **Digital Museum** — a personal gallery that gradually fills as the city's story is pieced together. When all artifacts are recovered, the full truth of the incident is revealed through the assembled collection.

The title **"Strings"** carries dual meaning: the translucent fishing line strings that guide the player, and the invisible strings of memory, culture, and identity that tie every person to their homeland — even one buried underwater.

---

## 3. SETTING & WORLD

### The Submerged City of Dagupan

Dagupan is a real city in Pangasinan, Philippines, historically significant as the **"Bangus (Milkfish) Capital of the Philippines."** In the game world, it has been submerged by an event never directly explained. The water level sits at roughly waist-height in most areas, giving every step a slow, wading resistance.

The world is not apocalyptic — it is **quiet, preserved, almost peaceful**. Objects float gently. Light filters through murky blue-green water. The city looks like it was not destroyed but simply… lowered. Buildings stand intact. Market stalls are still set up. A bangkâ rests against a concrete wall. Life was interrupted, not erased.

**Visual Palette:**
- Muted teal, dusty blues, and faded greens dominate
- Warm amber light from above (golden hour, filtered through water)
- Soft particles float throughout like sediment or ash
- Strings appear as faintly glowing translucent fishing lines, drifting gently with invisible currents

### The Five Explorable Zones

Each zone is a real location in Dagupan, reimagined submerged:

| Zone | Real Location | Atmosphere | Artifacts |
|---|---|---|---|
| **Zone 1** | Pantal Market | Ghostly stalls, floating wares, still-hanging signage | 3 |
| **Zone 2** | Calle Arellano (Heritage Street) | Flooded colonial storefronts, cracked facades | 3 |
| **Zone 3** | Bonuan Bangus Fishponds | Eerie submerged bamboo fish traps, vast open water | 3 |
| **Zone 4** | Dagupan City Hall | Sunken civic grandeur, floating documents | 3 |
| **Zone 5** | Dagupan Cathedral (St. John the Baptist) | Sacred silence, light through stained glass under water | 3 |

**Total: 15 Artifacts** across 5 zones.

---

## 4. CHARACTER

The player character has **no name, no face, and no spoken dialogue.** They are a vessel — a survivor whose identity the player projects themselves onto. Their presence is felt through:

- **First-person perspective** (no body visible below the screen)
- **Breathing audio** — slow, measured, occasionally catching with emotion near artifacts
- **Hands** — only visible when interacting with an artifact (reaching toward it)

The character's relationship to Dagupan is intentionally left open. They could be a fisherman's child, a student, a returning OFW, or simply someone who loved this city. The player decides.

---

## 5. CORE GAMEPLAY LOOP

```
Enter Zone
    ↓
Explore the flooded environment (slow, atmospheric walking)
    ↓
Strings appear in the distance — translucent, drifting fishing lines
    ↓
Follow the strings (they grow denser and more vivid as you approach)
    ↓
Locate the Hidden Heritage Artifact
    ↓
Interact (reach toward it — fade to white)
    ↓
[ARTIFACT DISCOVERY SCREEN]
Real-world historical fact + cultural context unlocked via City-Wide Portal API
    ↓
Artifact saved to Digital Museum gallery
    ↓
Continue exploring until all 3 artifacts in zone are found
    ↓
Move to next zone
    ↓
[After all 15 artifacts — ENDING SEQUENCE]
```

---

## 6. THE STRINGS MECHANIC (Discovery System)

### Visual Design
The **Strings** are the game's core navigational language — replacing the conventional HUD, minimap, or waypoint marker with something organic and culturally rooted in Dagupan's fishing heritage.

They appear as **translucent monofilament-style fishing lines** — the same type used in bangus aquaculture. They do not point directly at the artifact. Instead, they drift and meander through the water like threads caught in a slow current, converging loosely in the direction of the hidden item.

### Behavioral States

| Distance to Artifact | String Behavior |
|---|---|
| **Far (>15m)** | 1–2 faint strings barely visible, nearly invisible |
| **Medium (8–15m)** | 3–5 strings, slightly glowing, drifting slowly |
| **Close (3–8m)** | 6–10 strings, brighter, converging more directly |
| **Very Close (<3m)** | Dense web of strings, vibrating faintly, emitting a soft hum |

### Technical Implementation (Three.js)
- Each string is a `THREE.CatmullRomCurve3` — a smooth spline path that shifts over time
- Strings use `THREE.Line` with custom `ShaderMaterial` for translucency and glow pulse
- Animated using sine wave offsets on control points per frame (creates organic drifting)
- Opacity and count driven by `distance = player.position.distanceTo(artifact.position)`
- Strings spawn from a radius around the artifact and trail toward the player's view frustum

### AI Procedural Placement
Following the game jam mechanic, each artifact's position within its zone is **randomized per session** using a weighted placement system:
- Artifact positions are seeded from a pool of valid spawn nodes per zone
- Spawn nodes are tagged by type: `near_wall`, `submerged_interior`, `open_water`, `elevated_rubble`
- No artifact appears in the same exact spot in two different playthroughs
- Strings always correctly recalculate from the procedurally selected position

---

## 7. ARTIFACT SYSTEM

### The 15 Cultural Heritage Artifacts

#### Zone 1 — Pantal Market
| # | Artifact | Cultural Significance |
|---|---|---|
| 1 | **Kabilya (Fishing Scale)** | Traditional hand-held balance scale used in bangus trading at Pantal |
| 2 | **Pigar-pigar Iron Grill** | The iconic grill used for Dagupan's famous late-night street food |
| 3 | **Hand-Painted Tindera Sign** | Handwritten market signage in Pangasinan dialect |

#### Zone 2 — Calle Arellano (Heritage Street)
| # | Artifact | Cultural Significance |
|---|---|---|
| 4 | **Wooden Lampara (Oil Lamp)** | Pre-electric lighting used in old Dagupan storefronts |
| 5 | **Spanish-Era Keystone Fragment** | Architectural remnant from Dagupan's colonial heritage buildings |
| 6 | **Old Merchant Ledger** | A handwritten trade record from Dagupan's commercial history |

#### Zone 3 — Bonuan Bangus Fishponds
| # | Artifact | Cultural Significance |
|---|---|---|
| 7 | **Bubu (Bamboo Fish Trap)** | Traditional cylindrical trap used in Pangasinan aquaculture |
| 8 | **Pukot (Throw Net)** | The signature cast net used in Dagupan's bangus harvest |
| 9 | **Bangkâ Paddle (Sagwan)** | Carved wooden paddle from a traditional fishing canoe |

#### Zone 4 — Dagupan City Hall
| # | Artifact | Cultural Significance |
|---|---|---|
| 10 | **Municipal Seal Plaque** | Official seal of Dagupan City, inscribed with its founding |
| 11 | **Framed Civic Portrait** | Portrait of a historical Dagupan local figure |
| 12 | **Old Ballot Box** | Wooden ballot box from an early Philippine election in Dagupan |

#### Zone 5 — Dagupan Cathedral
| # | Artifact | Cultural Significance |
|---|---|---|
| 13 | **Carved Santo (Religious Figure)** | A handcrafted devotional statue from the parish's history |
| 14 | **Handwritten Simbang Gabi Program** | A faded mass program from a Dagupan Christmas tradition |
| 15 | **Church Bell Shard** | Fragment of the original cathedral bell, cast in Dagupan |

---

## 8. ARTIFACT DISCOVERY SCREEN (API Unlock Mechanic)

When the player interacts with an artifact, the following sequence plays:

1. **Fade to white** — the world dissolves
2. **Artifact Reveal** — the 3D object floats in a clean, lit space (white void)
3. **Historical Panel appears** — formatted card showing:
   - Artifact name (Filipino + English)
   - Real historical context about this object and Dagupan
   - A cultural note about its significance today
   - Zone it was found in
4. **"Saved to your Digital Museum"** confirmation
5. **Fade back** to the submerged world

The API call logs:
```json
{
  "artifact_id": "bubu_001",
  "artifact_name": "Bubu (Bamboo Fish Trap)",
  "zone": "Bonuan Bangus Fishponds",
  "discovered_at": "[timestamp]",
  "player_session": "[session_id]",
  "real_world_data": "Fetched from City-Wide Portal API"
}
```

---

## 9. DIGITAL MUSEUM

Accessible from a pause menu button labeled **"Aking Museo" (My Museum)**.

The Digital Museum is a **first-person gallery space** — the player walks through a dry, softly lit room that gradually fills with pedestals as artifacts are found. Each pedestal holds a rotating 3D model of the artifact with its historical card beside it.

**Empty state:** The museum is bare and silent, with only ambient echo.
**Full state (15/15):** The museum is warm, illuminated, filled with quiet music, and becomes the setting for the ending sequence.

---

## 10. NARRATIVE STRUCTURE & THE INCIDENT

The incident is never stated outright. Its truth is assembled through the artifacts themselves — each one carries a fragment of what happened, embedded in its historical context and in subtle environmental details around it.

### Narrative Fragments Per Zone

| Zone | Fragment Revealed |
|---|---|
| Pantal Market | The last day of the Bangus Festival — people were gathered |
| Calle Arellano | Old newspaper clipping reference to a flood warning ignored |
| Bonuan Fishponds | Fishermen reported unusual tidal behavior days before |
| City Hall | An emergency decree that was never filed |
| Cathedral | A prayer service the night before — the last gathering |

The incident is deliberately left to interpretation. Was it climate catastrophe? Government failure? Something beyond explanation? **The player decides.** The game trusts them.

---

## 11. ENDING SEQUENCE

When the 15th artifact is collected, the player is transported to their **completed Digital Museum.** All pedestals are filled. Soft, ambient music plays — a gentle rondalla melody referencing Pangasinan folk music.

The player walks slowly through their completed gallery. At the far end of the museum is a single door — a plain wooden door, unremarkable. When opened, it reveals a flooded street of Dagupan bathed in golden light. Above the waterline for the first time. Bright. Warm. Quiet.

The strings appear one final time — all of them, a thousand translucent threads rising upward from the water, catching the light.

**Text fades in:**
> *"Hindi natin malilimutan ang isang bagay na ating minahal."*
> *(We cannot forget something we have loved.)*

**Cut to black.**

The Digital Museum link is presented — shareable, permanent, with all 15 artifacts documented. The player's heritage archive exists beyond the game.

---

## 12. AUDIO DESIGN

| Element | Description |
|---|---|
| **Ambient World** | Muffled silence, distant water drips, subtle pressure hum |
| **Movement** | Soft splashing wade sounds, slow and deliberate |
| **Strings Near** | Faint, resonant hum — like a fishing line pulled taut, or a single guitar string |
| **Artifact Interact** | A clean tone — like a bell struck underwater |
| **Discovery Screen** | Silence, then a single melodic note (kulintang-influenced) |
| **Digital Museum** | Soft rondalla strings, slow and meditative |
| **Ending** | Full rondalla melody, swelling gently |

Sound design philosophy: **less is more.** The quiet of a submerged world is its own kind of presence.

---

## 13. VISUAL STYLE

**Inspirations:** *Dear Esther*, *Abzû*, *What Remains of Edith Finch*

- **Water shader:** Custom Three.js ShaderMaterial — slight distortion, caustic light rippling on surfaces, murky attenuation with depth
- **Color grading:** Post-processing via `THREE.EffectComposer` — desaturated warm tones, slight chromatic aberration at edges
- **Fog:** `THREE.FogExp2` — dense near the ground, clears slightly at eye level
- **Particles:** Sediment/ash particle system — slow, floating, catching light
- **Strings:** `CatmullRomCurve3` lines with custom alpha + emissive shader, soft glow via `UnrealBloomPass`

---

## 14. TECHNICAL ARCHITECTURE (Three.js)

### Core Systems

```
/src
  /core
    SceneManager.js       — Zone loading, transitions
    PlayerController.js   — First-person WASD + mouse, wade physics
    StringSystem.js       — Procedural string generation, proximity logic
    ArtifactManager.js    — Placement seeding, interaction detection
    APIManager.js         — City-Wide Portal API calls, session tracking
  /zones
    PantalMarket.js
    CalleArellano.js
    BonuanFishponds.js
    CityHall.js
    Cathedral.js
  /ui
    DiscoveryScreen.js    — Artifact reveal modal
    DigitalMuseum.js      — Gallery space logic
    HUD.js               — Minimal (artifact count only)
  /shaders
    WaterShader.glsl
    StringShader.glsl
    PostProcessing.js
  /audio
    AudioManager.js
```

### Key Three.js Dependencies
- `THREE.Water` (water surface)
- `THREE.EffectComposer` + `UnrealBloomPass` (post-processing)
- `THREE.GLTFLoader` (artifact 3D models)
- `THREE.CatmullRomCurve3` (string paths)
- `THREE.FogExp2` (atmospheric depth)
- `PointerLockControls` (first-person look)

---

## 15. DEVELOPMENT MILESTONES

| Milestone | Deliverable |
|---|---|
| **M1** | Player controller + water shader in one zone (Pantal) |
| **M2** | String system functional + proximity detection |
| **M3** | Artifact placement (procedural seeding) + all 5 zones blocked out |
| **M4** | Discovery Screen + API integration |
| **M5** | Digital Museum gallery functional |
| **M6** | All 15 artifacts modeled + placed |
| **M7** | Audio integration + narrative text |
| **M8** | Ending sequence + polish pass |

---

*"Strings" — A love letter to Dagupan, written in fishing lines and rising water.*

---
**Document Version:** 1.0 | **Game Jam:** AI Game On!
