// ============================================================
// DATA — artifact payloads + mock City-Wide Portal API (GDD §7/§8)
// ============================================================

export const ZONE_NAME = 'Pantal Market';

// Mock "City-Wide Portal API" payloads — local, no network.
export const ARTIFACT_DATA = [
  {
    id: 'kabilya_001',
    fil: 'Kabilya',
    eng: 'Fishing Scale',
    fact: 'A traditional hand-held balance scale once used by traders at Pantal Market to weigh the day’s bangus catch before dawn. Pantal was the beating commercial heart of Dagupan, where fisherfolk and tinderas haggled over the freshest milkfish in Pangasinan.',
    note: 'Today the kabilya is mostly gone, replaced by digital scales — but the rhythm of the morning market it measured still defines Dagupan’s identity as the Bangus Capital of the Philippines.',
    spawnTag: 'near_wall',
  },
  {
    id: 'pigar_002',
    fil: 'Pigar-pigar Grill',
    eng: 'Iron Street Grill',
    fact: 'The blackened iron grill behind Dagupan’s most beloved late-night dish — pigar-pigar, thinly sliced beef seared fast over fierce heat with onions and crisp greens. Stalls around Pantal kept these grills glowing long after the market closed.',
    note: 'Pigar-pigar remains a living tradition; to eat it is to taste a piece of Dagupan that never quite went to sleep.',
    spawnTag: 'submerged_interior',
  },
  {
    id: 'tindera_003',
    fil: 'Karatula ng Tindera',
    eng: 'Hand-Painted Vendor Sign',
    fact: 'A handwritten market sign, lettered by a vendor in the Pangasinan dialect. Before printed tarpaulins, every stall wore the personality of its owner’s own hand — prices, blessings, and the names of families who had sold here for generations.',
    note: 'These fading signs are quiet records of a language and a community — small strings tying each tindera to the city she fed.',
    spawnTag: 'elevated_rubble',
  },
];

// Stand-in for APIManager.fetchArtifactData — async to mirror a real call.
export function fetchArtifactData(id) {
  return new Promise((resolve) => {
    const data = ARTIFACT_DATA.find((a) => a.id === id);
    setTimeout(() => resolve(data), 120); // simulate latency
  });
}

// ------------------------------------------------------------
// GUARDIAN — flavour text for the riddle screen header.
// ------------------------------------------------------------
export const GUARDIAN_TEXT = {
  fil: 'Bantay ng Pantal',
  eng: 'Guardian of the Market',
  intro: 'Sagutin ang aking bugtong upang palayain ang mga alaala.',
  introEng: 'Answer my riddle to free the memories.',
};

// ------------------------------------------------------------
// RIDDLE POOL ("bugtong") — PLACEHOLDER content. Each riddle has exactly three
// choices; mark the correct one with `correct: true`. The encounter draws
// RIDDLE_COUNT distinct riddles from this pool, so keep the pool larger than
// that count for variety on retries. Preserve Filipino/Pangasinan diacritics.
// ------------------------------------------------------------
export const RIDDLE_POOL = [
  {
    id: 'bugtong_001',
    fil: 'Bugtong',
    eng: 'Riddle',
    prompt: '[PLACEHOLDER] Palitan ng tunay na bugtong dito.',
    promptEng: '[PLACEHOLDER] Replace with a real riddle here.',
    choices: [
      { text: 'Sagot A (tama)', correct: true },
      { text: 'Sagot B', correct: false },
      { text: 'Sagot C', correct: false },
    ],
  },
  {
    id: 'bugtong_002',
    fil: 'Bugtong',
    eng: 'Riddle',
    prompt: '[PLACEHOLDER] Pangalawang bugtong.',
    promptEng: '[PLACEHOLDER] Second riddle.',
    choices: [
      { text: 'Sagot A', correct: false },
      { text: 'Sagot B (tama)', correct: true },
      { text: 'Sagot C', correct: false },
    ],
  },
  {
    id: 'bugtong_003',
    fil: 'Bugtong',
    eng: 'Riddle',
    prompt: '[PLACEHOLDER] Pangatlong bugtong.',
    promptEng: '[PLACEHOLDER] Third riddle.',
    choices: [
      { text: 'Sagot A', correct: false },
      { text: 'Sagot B', correct: false },
      { text: 'Sagot C (tama)', correct: true },
    ],
  },
  {
    id: 'bugtong_004',
    fil: 'Bugtong',
    eng: 'Riddle',
    prompt: '[PLACEHOLDER] Pang-apat na bugtong.',
    promptEng: '[PLACEHOLDER] Fourth riddle.',
    choices: [
      { text: 'Sagot A (tama)', correct: true },
      { text: 'Sagot B', correct: false },
      { text: 'Sagot C', correct: false },
    ],
  },
  {
    id: 'bugtong_005',
    fil: 'Bugtong',
    eng: 'Riddle',
    prompt: '[PLACEHOLDER] Panlimang bugtong.',
    promptEng: '[PLACEHOLDER] Fifth riddle.',
    choices: [
      { text: 'Sagot A', correct: false },
      { text: 'Sagot B (tama)', correct: true },
      { text: 'Sagot C', correct: false },
    ],
  },
  {
    id: 'bugtong_006',
    fil: 'Bugtong',
    eng: 'Riddle',
    prompt: '[PLACEHOLDER] Pang-anim na bugtong.',
    promptEng: '[PLACEHOLDER] Sixth riddle.',
    choices: [
      { text: 'Sagot A', correct: false },
      { text: 'Sagot B', correct: false },
      { text: 'Sagot C (tama)', correct: true },
    ],
  },
];

// Draw `n` distinct riddles from the pool using a seeded PRNG (`rng` from
// mulberry32). Returns a fresh array; the pool itself is never mutated.
export function drawRiddles(n, rng) {
  const pool = RIDDLE_POOL.slice();
  // Fisher–Yates shuffle driven by the seeded rng.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(n, pool.length));
}
