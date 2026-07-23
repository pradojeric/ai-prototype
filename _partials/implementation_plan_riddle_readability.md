# Implementation Plan — Multiline Riddle Readability (Approved)

## Locked direction

- Apply the improvement to Arena 1 coral nodes, Arena 2 lantern choices, and
  Arena 3 tower seals.
- Widen the riddle banner to `min(900px, 88vw)`.
- Allow the Pangasinan/Filipino prompt and English translation to wrap naturally
  without shrinking their fonts.
- Render choices at a fixed readable font size, centered, with up to three lines.
- Grow choice panels vertically from their wrapped line count instead of
  horizontally compressing text.
- If a choice cannot fit three lines, widen its label within an arena-safe limit
  before using any modest font fallback.
- Remove Arena 3's label shrink and spread its three seal choices farther apart.
- Keep this desktop-only.

## Implementation

1. Add a small pure text-layout helper beside `AnswerNode.js` that:
   - measures words using the active canvas font;
   - wraps only at word boundaries;
   - preserves the exact choice text;
   - caps normal output at three centered lines;
   - retries with wider safe widths before any font-size fallback;
   - returns line positions and final canvas dimensions for focused testing.
2. Update `makeAnswerLabelTexture()` to draw the rounded panel around the final
   multiline layout and store its aspect ratio on the texture.
3. Derive each sprite's world-space height from the texture aspect ratio while
   keeping its readable world width stable. This affects both `AnswerNode` and
   `LanternProjectile` through their shared renderer.
4. Remove the Zone 3 `labelScale: 0.72` compression. Add a centralized Tower
   choice-gap tuning value in `src/config.js` and use it in `TowerGateManager`.
5. Widen `#arena-riddle` to `min(900px, 88vw)`. Keep its height content-driven,
   retain `white-space: pre-line`, and add safe word wrapping for both language
   blocks without changing their current font sizes.

## Verification

- Unit-test one-, two-, and three-line choices plus an exceptionally long fallback.
- Assert no layout path uses Canvas `fillText` max-width compression.
- Confirm all riddle source text is preserved verbatim by the wrapper.
- Run syntax, focused tests, stale-pattern, line-count, and whitespace checks.
- Browser-test the longest choices in all three arenas for label overlap,
  readability while moving, banner/boss-HUD separation, and clean console.

## Scope boundary

No riddle copy, answer correctness, timing, combat, aiming, hitboxes, difficulty,
mobile UI, or unrelated HUD changes.
