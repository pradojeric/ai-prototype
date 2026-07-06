// ============================================================
// DATA — artifact payloads + mock City-Wide Portal API (GDD §7/§8)
// ============================================================

export const ZONE_NAME = 'Pantal Market';

// Mock "City-Wide Portal API" payloads — local, no network. Zone 1's set is the
// "Ponsia" collection: ten Pangasinan delicacies recovered from the submerged
// Pantal Market. Players surface them three at a time, returning across visits
// until all ten are restored to the Digital Museum. `image` points at the
// artwork served from assets/ (see ArtifactManager + DiscoveryScreen + Museum).
export const ARTIFACT_DATA = [
  {
    id: 'alaminos_longganisa_001',
    fil: 'Longganisang Alaminos',
    eng: 'Alaminos Longganisa',
    fact: 'A plump, garlicky native sausage from Alaminos City, prized for its coarse-ground pork and bold vinegar-and-garlic cure. Unlike the sweet longganisa of other provinces, the Alaminos version leans savory and sour — a breakfast staple sold in linked rings at Pangasinan markets.',
    note: 'Every town in Pangasinan guards its own longganisa recipe like a family name. To taste Alaminos’ is to taste a place that refused to sweeten itself to please outsiders.',
    spawnTag: 'near_wall',
    image: 'assets/artifacts/zone1/alaminos-longganisa.png',
  },
  {
    id: 'dasol_salt_002',
    fil: 'Asin ng Dasol',
    eng: 'Dasol Sea Salt',
    fact: 'Hand-harvested sea salt from the coastal flats of Dasol, where families have raked seawater into shallow beds and let the sun do the rest for generations. The flaky, mineral-rich crystals seasoned the bagoong, the dried fish, and nearly every dish along this shore.',
    note: 'Before refrigeration, salt was survival — it preserved the catch that fed Pangasinan inland. Dasol’s salt beds are a quiet inheritance, worked by hand against cheaper industrial competition.',
    spawnTag: 'open_water',
    image: 'assets/artifacts/zone1/dasol-salt.png',
  },
  {
    id: 'kaleskes_003',
    fil: 'Kaleskes',
    eng: 'Tripe & Innards Soup',
    fact: 'A hearty Dagupan soup of beef or carabao innards and tripe, simmered long with rice washings until thick and savory. Sold by the bowl in the city’s eateries, kaleskes turned humble offal into a warming, nose-to-tail comfort food.',
    note: 'Dishes like kaleskes were born of thrift and respect — wasting no part of a costly animal. Its richness is the resourcefulness of a market town made delicious.',
    spawnTag: 'submerged_interior',
    image: 'assets/artifacts/zone1/kaleskes.png',
  },
  {
    id: 'pigar_pigar_004',
    fil: 'Pigar-pigar',
    eng: 'Sizzling Sliced Beef',
    fact: 'Dagupan’s most beloved late-night dish — paper-thin beef (and crisp liver) seared fast over fierce heat with rings of onion and fresh greens. Stalls around Pantal kept their iron pans glowing long after the market had closed for the day.',
    note: 'Pigar-pigar remains a living tradition; to eat it sizzling at a roadside stall is to taste a piece of Dagupan that never quite went to sleep.',
    spawnTag: 'elevated_rubble',
    image: 'assets/artifacts/zone1/pigar-pigar.png',
  },
  {
    id: 'calasiao_puto_005',
    fil: 'Puto Calasiao',
    eng: 'Calasiao Rice Cakes',
    fact: 'Tiny, pearl-white steamed rice cakes from Calasiao, naturally fermented for a faint tang and a springy bite. Sold by the bagful and eaten by the handful, they are a fixture of fiestas, merienda, and the after-Mass crowd.',
    note: 'Calasiao’s puto carries a geographic pride so strong the town is simply called the "Puto Capital." A humble cake became a whole municipality’s signature.',
    spawnTag: 'near_wall',
    image: 'assets/artifacts/zone1/calasiao-puto.png',
  },
  {
    id: 'patupat_006',
    fil: 'Patupat',
    eng: 'Woven Sticky-Rice Pouch',
    fact: 'Glutinous rice packed into diamond pouches woven from young coconut or palm leaves, then boiled and steeped in thick coconut-sugar syrup. The weave is undone by hand to reveal a sweet, sticky block — a festival treat made to be shared.',
    note: 'Patupat is as much craft as cooking; the leaf-weaving is a skill passed mother to child. Each pouch is a small act of patience folded around the harvest.',
    spawnTag: 'submerged_interior',
    image: 'assets/artifacts/zone1/patupat.png',
  },
  {
    id: 'bagoong_007',
    fil: 'Bagoong',
    eng: 'Fermented Fish Paste',
    fact: 'Small fish or shrimp salted and left to ferment for months into a pungent, umami-deep paste. In Pangasinan’s coastal kitchens bagoong is the backbone of flavor — a dipping sauce, a souring agent, and the soul of countless vegetable dishes.',
    note: 'Bagoong ties the sea to the table and the present to the past: the same slow fermentation that fed pre-colonial villages still seasons the family meal today.',
    spawnTag: 'open_water',
    image: 'assets/artifacts/zone1/bagoong.png',
  },
  {
    id: 'burong_isda_008',
    fil: 'Burong Isda',
    eng: 'Fermented Rice & Fish',
    fact: 'Freshwater fish layered with cooked rice and salt, then left to ferment into a tangy, savory relish (buro). Sautéed with garlic and tomatoes, it transforms a simple catch into a sharp, addictive companion to plain rice and grilled vegetables.',
    note: 'Buro is preservation as artistry — a way the riverside towns of Pangasinan banked the river’s bounty against leaner days, one earthen jar at a time.',
    spawnTag: 'elevated_rubble',
    image: 'assets/artifacts/zone1/burong-isda.png',
  },
  {
    id: 'binungey_009',
    fil: 'Binungey',
    eng: 'Bamboo Sticky Rice',
    fact: 'Glutinous rice and coconut milk packed into a length of bamboo and roasted over coals until the cane chars and the rice steams sweet inside. A specialty of western Pangasinan, it is split open and eaten straight from its smoky wooden shell.',
    note: 'Binungey needs no pot and no oven — only bamboo, fire, and know-how. It is fiesta food and field food at once, cooked the way the land itself provides.',
    spawnTag: 'near_wall',
    image: 'assets/artifacts/zone1/binungey.png',
  },
  {
    id: 'tupig_010',
    fil: 'Tupig',
    eng: 'Grilled Rice Cake',
    fact: 'Ground glutinous rice and coconut wrapped in banana leaves and grilled over embers until smoky and caramelized at the edges. Sold warm in roadside bundles, tupig is the taste of Pangasinan nights and long bus rides home.',
    note: 'The banana-leaf char and woodsmoke are half the flavor — a reminder that in this province even the wrapping and the fire carry tradition.',
    spawnTag: 'open_water',
    image: 'assets/artifacts/zone1/tupig.png',
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
