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
import { shuffle, mulberry32, WORLD_SEED } from '../config.js';
import { RIDDLE_POOL_PART1 } from './riddles-part1.js';
import { RIDDLE_POOL_PART2 } from './riddles-part2.js';

export const RIDDLE_POOL = [...RIDDLE_POOL_PART1, ...RIDDLE_POOL_PART2];

// Draw `n` distinct riddles from the pool using a seeded PRNG (`rng` from
// mulberry32). Returns a fresh array; the pool itself is never mutated.
export function drawRiddles(n, rng) {
  const pool = shuffle(RIDDLE_POOL.slice(), rng);
  return pool.slice(0, Math.min(n, pool.length));
}

// Canonical partition order: the per-run shuffled pool is split into one
// CONTIGUOUS, DISJOINT block per riddle-gated arena, in this order. A zone only
// ever draws from its own block, so a bugtong can NEVER appear in two zones in
// the same run — the hard cross-zone guarantee holds no matter how many retries.
const ZONE_BLOCKS = ['arena1', 'arena2', 'arena3'];

// How many times each zone has drawn this run (a "draw" = an arena
// entry/retry). Advancing this rotates a fresh window through the zone's block
// so every retry shows DIFFERENT riddles. Module-scoped so it survives the
// controllers being re-instantiated on each retry; resets on page reload
// (= a new run), alongside WORLD_SEED.
const _zoneDrawIndex = new Map();

// The disjoint block of riddles owned by `zoneId` under the run's world seed.
// Blocks are near-equal thirds of the 127-riddle pool (~42 each), far larger
// than any single draw, which leaves ample room for varied retries.
function zoneBlock(zoneId, worldSeed) {
  const pool = shuffle(RIDDLE_POOL.slice(), mulberry32(worldSeed >>> 0));
  const parts = ZONE_BLOCKS.length;
  let index = ZONE_BLOCKS.indexOf(zoneId);
  if (index === -1) index = 0;   // unknown zone → share the first block (never expected)
  const size = Math.floor(pool.length / parts);
  const start = index * size;
  const end = index === parts - 1 ? pool.length : start + size;
  return pool.slice(start, end);
}

// Draw `count` riddles for a zone's arena. Guarantees:
//   • cross-zone: the draw comes only from this zone's block, so it never
//     overlaps another zone's riddles;
//   • per-retry: each successive draw rotates to the next window of the block,
//     so retries (and re-entries) present a fresh, different set.
// The block content/order comes from WORLD_SEED, so different runs differ too.
export function riddlesForZone(zoneId, count, worldSeed = WORLD_SEED) {
  const block = zoneBlock(zoneId, worldSeed);
  const n = Math.min(count, block.length);
  const attempt = _zoneDrawIndex.get(zoneId) || 0;
  _zoneDrawIndex.set(zoneId, attempt + 1);
  const start = (attempt * n) % block.length;
  const out = [];
  for (let i = 0; i < n; i++) out.push(block[(start + i) % block.length]);
  return out;
}
