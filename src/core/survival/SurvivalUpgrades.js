// ============================================================
// SURVIVAL UPGRADES — smart deterministic draft and build rules
// ============================================================
// Cards are immutable data. Applying one returns a new build state so UI
// previews and deterministic tests cannot accidentally mutate the live run.

// Survival's starting primary. It looks and sounds like the campaign Light Bolt
// but carries its own damage, because Survival threats use a much larger health
// baseline (SURVIVAL_ROLE_BASE_HP) than the fragile campaign ones. Raising
// COMBAT.BOLT.DAMAGE instead would rebalance the whole campaign.
export const SURVIVAL_LIGHT_BOLT = Object.freeze({
  id: 'light-bolt',
  label: 'Light Bolt',
  damage: 3,
  cooldownSeconds: 0.22,
  projectileSpeed: 38,
});

// Every path is tuned to land within ~12–14 dps of the base bolt, so choosing a
// transformation is a change of shape (pierce, sustain, burst) and never a raw
// power gate. Damage is deliberately large enough that primary-power's +18% is
// legible on the first rank.
export const SURVIVAL_WEAPON_PATHS = Object.freeze({
  rapid: Object.freeze({
    id: 'rapid',
    label: 'Rapid Weave',
    damage: 2.5,
    cooldownSeconds: 0.18,
    projectileSpeed: 42,
  }),
  laser: Object.freeze({
    id: 'laser',
    label: 'Continuous Laser',
    range: 28,
    ticksPerSecond: 10,
    damagePerTick: 1.4,
    heatCapacitySeconds: 2.5,
    overheatLockoutSeconds: 1.25,
  }),
  lance: Object.freeze({
    id: 'lance',
    label: 'Thread Lance',
    damage: 8,
    cooldownSeconds: 0.65,
    projectileSpeed: 32,
    pierceTargets: 3,
  }),
});

export const SURVIVAL_UPGRADE_FAMILIES = Object.freeze({
  'primary-power': Object.freeze({ id: 'primary-power', repeatable: true, maxRank: Infinity }),
  'path-mastery': Object.freeze({ id: 'path-mastery', repeatable: false, maxRank: 3 }),
  vitality: Object.freeze({ id: 'vitality', repeatable: true, maxRank: Infinity }),
  'woven-ward': Object.freeze({ id: 'woven-ward', repeatable: false, maxRank: 3 }),
  'dash-weave': Object.freeze({ id: 'dash-weave', repeatable: false, maxRank: 3 }),
  'shockwave-resonance': Object.freeze({
    id: 'shockwave-resonance',
    repeatable: false,
    maxRank: 3,
  }),
  'alab-reservoir': Object.freeze({ id: 'alab-reservoir', repeatable: false, maxRank: 3 }),
  'lumina-affinity': Object.freeze({ id: 'lumina-affinity', repeatable: false, maxRank: 3 }),
});

const WEAPON_CARDS = Object.values(SURVIVAL_WEAPON_PATHS).map((weapon) => Object.freeze({
  id: `weapon-${weapon.id}`,
  familyId: 'weapon-transformation',
  weaponPath: weapon.id,
  category: 'weapon',
  title: weapon.label,
}));

const FAMILY_CARDS = [
  ['primary-power', 'offense', 'Primary Power'],
  ['path-mastery', 'weapon', 'Path Mastery'],
  ['vitality', 'defense', 'Vitality'],
  ['woven-ward', 'defense', 'Woven Ward'],
  ['dash-weave', 'mobility', 'Dash Weave'],
  ['shockwave-resonance', 'ability', 'Shockwave Resonance'],
  ['alab-reservoir', 'resource', 'Alab Reservoir'],
  ['lumina-affinity', 'utility', 'Lumina Affinity'],
].map(([familyId, category, title]) => Object.freeze({
  id: familyId,
  familyId,
  category,
  title,
}));

export const SURVIVAL_UPGRADE_CARDS = Object.freeze([
  ...WEAPON_CARDS,
  ...FAMILY_CARDS,
]);

// Once every capped family is complete, alternate IDs from the same two
// approved repeatable families keep endless drafts at three cards and preserve
// a genuinely different reroll set. These are not additional families.
const REPEATABLE_FALLBACK_CARDS = Object.freeze([
  Object.freeze({
    id: 'primary-power-echo',
    familyId: 'primary-power',
    category: 'offense',
    title: 'Primary Power',
  }),
  Object.freeze({
    id: 'vitality-echo',
    familyId: 'vitality',
    category: 'defense',
    title: 'Vitality',
  }),
]);

const ALL_CARDS = Object.freeze([
  ...SURVIVAL_UPGRADE_CARDS,
  ...REPEATABLE_FALLBACK_CARDS,
]);
const CARD_BY_ID = new Map(ALL_CARDS.map((card) => [card.id, card]));

function safeRngValue(rng) {
  const value = Number(rng());
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1 - Number.EPSILON;
  return value;
}

function randomIndex(length, rng) {
  return Math.floor(safeRngValue(rng) * length);
}

function roundTuning(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function normalizedRanks(ranks = {}) {
  const result = {};
  for (const familyId of Object.keys(SURVIVAL_UPGRADE_FAMILIES)) {
    result[familyId] = Math.max(0, Math.floor(Number(ranks[familyId]) || 0));
  }
  return result;
}

function signature(cardsOrIds) {
  return cardsOrIds
    .map((entry) => typeof entry === 'string' ? entry : entry.id)
    .slice()
    .sort()
    .join('|');
}

function combinations(pool, size) {
  const result = [];
  const current = [];
  const visit = (start) => {
    if (current.length === size) {
      result.push(current.slice());
      return;
    }
    for (let i = start; i <= pool.length - (size - current.length); i++) {
      current.push(pool[i]);
      visit(i + 1);
      current.pop();
    }
  };
  visit(0);
  return result;
}

function shuffledCopy(values, rng) {
  const result = values.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1, rng);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createSurvivalUpgradeState(initial = {}) {
  const weaponPath = initial.weaponPath ?? null;
  if (weaponPath != null && !SURVIVAL_WEAPON_PATHS[weaponPath]) {
    throw new RangeError(`Unknown Survival weapon path: ${weaponPath}`);
  }
  return {
    weaponPath,
    ranks: normalizedRanks(initial.ranks),
  };
}

export function getSurvivalUpgradeRank(state, familyId) {
  if (!SURVIVAL_UPGRADE_FAMILIES[familyId]) {
    throw new RangeError(`Unknown Survival upgrade family: ${familyId}`);
  }
  return Math.max(0, Math.floor(Number(state?.ranks?.[familyId]) || 0));
}

export function isSurvivalUpgradeMaxed(state, familyId) {
  const family = SURVIVAL_UPGRADE_FAMILIES[familyId];
  if (!family) throw new RangeError(`Unknown Survival upgrade family: ${familyId}`);
  return !family.repeatable && getSurvivalUpgradeRank(state, familyId) >= family.maxRank;
}

export function canOfferSurvivalUpgrade(state, cardOrId) {
  const card = typeof cardOrId === 'string' ? CARD_BY_ID.get(cardOrId) : cardOrId;
  if (!card) return false;

  if (card.familyId === 'weapon-transformation') return state.weaponPath == null;
  if (card.familyId === 'path-mastery' && state.weaponPath == null) return false;
  return !isSurvivalUpgradeMaxed(state, card.familyId);
}

export function getEligibleSurvivalUpgrades(state) {
  const eligible = SURVIVAL_UPGRADE_CARDS.filter((card) => canOfferSurvivalUpgrade(state, card));
  if (eligible.length >= 4) return eligible;
  return [
    ...eligible,
    ...REPEATABLE_FALLBACK_CARDS.filter((card) => canOfferSurvivalUpgrade(state, card)),
  ];
}

// Chooses the most category-diverse eligible combination. At wave 15 and
// beyond, an uncommitted run is guaranteed a weapon transformation.
export function draftSurvivalUpgrades({
  state,
  wave,
  rng,
  previousCardIds = [],
}) {
  if (!Number.isInteger(wave) || wave < 1) {
    throw new RangeError('Survival upgrade wave must be a positive integer.');
  }
  const eligible = getEligibleSurvivalUpgrades(state);
  if (eligible.length === 0) return Object.freeze([]);

  const draftSize = Math.min(3, eligible.length);
  const pityWeapon = state.weaponPath == null && wave >= 15;
  const previousSignature = previousCardIds.length === draftSize
    ? signature(previousCardIds)
    : null;
  let candidates = combinations(eligible, draftSize);

  if (pityWeapon) {
    candidates = candidates.filter((cards) => (
      cards.some((card) => card.familyId === 'weapon-transformation')
    ));
  }

  const nonRepeating = previousSignature == null
    ? candidates
    : candidates.filter((cards) => signature(cards) !== previousSignature);
  if (nonRepeating.length > 0) candidates = nonRepeating;

  const maxCategoryCount = Math.max(
    ...candidates.map((cards) => new Set(cards.map((card) => card.category)).size),
  );
  const smartCandidates = candidates.filter((cards) => (
    new Set(cards.map((card) => card.category)).size === maxCategoryCount
  ));
  const selected = smartCandidates[randomIndex(smartCandidates.length, rng)];
  return Object.freeze(shuffledCopy(selected, rng));
}

export function applySurvivalUpgrade(state, cardId) {
  const card = CARD_BY_ID.get(cardId);
  if (!card) throw new RangeError(`Unknown Survival upgrade card: ${cardId}`);
  if (!canOfferSurvivalUpgrade(state, card)) {
    throw new RangeError(`Survival upgrade is locked or maxed: ${cardId}`);
  }

  const next = createSurvivalUpgradeState(state);
  if (card.familyId === 'weapon-transformation') {
    next.weaponPath = card.weaponPath;
  } else {
    next.ranks[card.familyId] = getSurvivalUpgradeRank(state, card.familyId) + 1;
  }
  return next;
}

export function getSurvivalBuildEffects(state) {
  const power = getSurvivalUpgradeRank(state, 'primary-power');
  const mastery = getSurvivalUpgradeRank(state, 'path-mastery');
  const vitality = getSurvivalUpgradeRank(state, 'vitality');
  const ward = getSurvivalUpgradeRank(state, 'woven-ward');
  const dash = getSurvivalUpgradeRank(state, 'dash-weave');
  const alab = getSurvivalUpgradeRank(state, 'alab-reservoir');
  const lumina = getSurvivalUpgradeRank(state, 'lumina-affinity');

  const pathMastery = {
    rapid: Object.freeze({ pierceBonus: state.weaponPath === 'rapid' ? mastery : 0 }),
    laser: Object.freeze({
      heatCapacityBonus: state.weaponPath === 'laser' ? 0.5 * mastery : 0,
      rangeBonus: state.weaponPath === 'laser' ? 2 * mastery : 0,
      // Presentation only — a mastered beam reads visibly heavier. Range and heat
      // are invisible until you hit something, so without this the ranks feel inert.
      widthMultiplier: state.weaponPath === 'laser' ? roundTuning(1 + 0.22 * mastery) : 1,
    }),
    lance: Object.freeze({
      pierceBonus: state.weaponPath === 'lance' ? mastery : 0,
      radiusMultiplier: state.weaponPath === 'lance' ? 1 + 0.1 * mastery : 1,
    }),
  };

  return Object.freeze({
    primaryDamageMultiplier: roundTuning(1 + 0.18 * power),
    maxHealthBonus: 15 * vitality,
    damageReduction: roundTuning(0.08 * ward),
    pathMastery: Object.freeze(pathMastery),
    dash: Object.freeze({
      rank: dash,
      cooldownImproved: dash >= 1,
      charges: dash >= 2 ? 2 : 1,
      distanceImproved: dash >= 3,
    }),
    shockwaveRank: getSurvivalUpgradeRank(state, 'shockwave-resonance'),
    alab: Object.freeze({
      rank: alab,
      chargeGainMultiplier: roundTuning(1 + 0.15 * alab),
      durationBonusSeconds: roundTuning(0.5 * alab),
    }),
    lumina: Object.freeze({
      rank: lumina,
      dropChanceBonus: roundTuning(0.05 * lumina),
    }),
  });
}
