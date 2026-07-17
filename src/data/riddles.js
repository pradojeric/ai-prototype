// ============================================================
// RIDDLE POOL ("bugtong" / Pangasinan: "pabitla" or "bonikew") — 127
// documented traditional Pangasinan riddles, rebuilt verbatim from the
// Bayambang Culture Mapping Project's "Pabitla / Bonikew" collection:
//   https://bayambangmunicipalnews.blogspot.com/2019/08/riddles.html
//   (posted Aug 21, 2019; expanded through the "New Pabitla" additions),
// itself drawing on Dr. Perla S. Nelmida's 465-riddle study "Pangasinan
// Folk Literature" (1983, UP Diliman).
//
// Each `prompt` shows the Pangasinan original (spelling/diacritics kept
// exactly as recorded, including Spanish-era orthography) on the first
// line and a Filipino rendering — translated from the source's English
// gloss — on the second (rendered on separate lines via
// `white-space: pre-line` on #riddle .prompt); `promptEng` is the
// source's English translation. Each riddle has exactly three choices;
// the correct one is the source's recorded answer. Ribald/"green"
// riddles, near-duplicate variants, answerless entries, and wordplay
// that only works in Pangasinan spelling were excluded during curation.
// The encounter draws RIDDLE_COUNT distinct riddles, so the pool is kept
// far larger than that count for variety on retries.
//
// The pool is split into two _part files purely for file-length limits.
// ============================================================
import { shuffle } from '../config.js';
import { RIDDLE_POOL_PART1 } from './riddles-part1.js';
import { RIDDLE_POOL_PART2 } from './riddles-part2.js';

export const RIDDLE_POOL = [...RIDDLE_POOL_PART1, ...RIDDLE_POOL_PART2];

// Draw `n` distinct riddles from the pool using a seeded PRNG (`rng` from
// mulberry32). Returns a fresh array; the pool itself is never mutated.
export function drawRiddles(n, rng) {
  const pool = shuffle(RIDDLE_POOL.slice(), rng);
  return pool.slice(0, Math.min(n, pool.length));
}
