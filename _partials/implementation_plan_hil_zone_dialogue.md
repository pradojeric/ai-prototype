# Implementation Plan — Hil Zone-Entry Dialogue

## Goal

Replace the explicit zone-entry placeholders with concise inner-voice dialogue
that belongs to Hil and follows the campaign's emotional arc from uncertain
recognition to purposeful homecoming.

## Narrative constraints

- Keep Hil understated: he is a witness and keeper of memory, not an exposition
  narrator with knowledge the player has not yet earned.
- Ground each entry in the zone already visible around him:
  PONSIA's market and shared food, LIKET's communal music and joy, and
  PANANISIA's landmarks and sense of home.
- Let Hil's confidence grow across the authored Zone 1 → Zone 2 → Zone 3 order
  without making the lines confusing when debug mode allows out-of-order entry.
- Keep every subtitle short enough for the existing 3.4-second hold.
- Preserve `introDialogue`, zone IDs, timing, presentation, and re-entry behavior.

## Dialogue

### Zone 1 — PONSIA

1. `This cold... I remember warmth here.`
2. `Empty stalls, yet the memory of shared meals remains.`
3. `The Hibla lead deeper. I have to follow.`

### Zone 2 — LIKET

1. `The current carries a rhythm I almost remember.`
2. `LIKET was joy shared aloud—not a celebration meant for silence.`
3. `I will bring those scattered voices home.`

### Zone 3 — PANANISIA

1. `These stones feel familiar, though their names slip away.`
2. `Shrine, shore, and hall—the province remembers what I cannot.`
3. `Perhaps returning them to the light will lead me home.`

## Execution

1. Replace only the three `introDialogue` arrays and their placeholder comments.
2. Remove the resolved placeholder limitation from `STRINGS_GDD.md`.
3. Run JavaScript syntax, placeholder, line-count, and whitespace checks.
4. Leave browser timing, overlap, and tone validation as an explicit manual pass.

