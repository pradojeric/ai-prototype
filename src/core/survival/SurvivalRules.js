// ============================================================
// SURVIVAL RULES — deterministic wave, elite, and boss policy
// ============================================================
// This module intentionally has no Three.js or DOM dependencies. Runtime
// controllers provide an RNG and turn these immutable decisions into entities.

export const SURVIVAL_THREAT_CAP = 10;
export const SURVIVAL_REROLL_CAP = 2;

// Draft cadence. Wave 2 gets one early draft so the opening waves are not played
// on a bare build; after that the authored every-fifth-wave rhythm takes over,
// and every tenth wave is a Guardian (which also ends in a draft).
export const SURVIVAL_FIRST_DRAFT_WAVE = 1;
export const SURVIVAL_DRAFT_INTERVAL = 3;

export const SURVIVAL_ROLE_UNLOCKS = Object.freeze([
  Object.freeze({ role: 'chaser', wave: 1 }),
  Object.freeze({ role: 'spitter', wave: 2 }),
  Object.freeze({ role: 'boarder', wave: 3 }),
  // Object.freeze({ role: 'sniper', wave: 4 }),
  // Object.freeze({ role: 'gargoyle', wave: 0 }),
  // Object.freeze({ role: 'gale', wave: 8 }),
]);

// Campaign threats are intentionally fragile because they guard short artifact
// encounters. Survival gives the same six roles a separate health baseline so
// its normal waves have enough body to support the 30–45 second pacing target.
export const SURVIVAL_ROLE_BASE_HP = Object.freeze({
  chaser: 12,
  spitter: 14,
  boarder: 16,
  sniper: 12,
  gargoyle: 18,
  gale: 12,
});

export const SURVIVAL_ELITE_PROFILES = Object.freeze({
  armored: Object.freeze({
    id: 'armored',
    hpMultiplier: 1.8,
    speedMultiplier: 0.9,
    damageMultiplier: 1,
    attackIntervalMultiplier: 1,
    tell: 'gold',
    volatileDeathBurst: null,
  }),
  frenzied: Object.freeze({
    id: 'frenzied',
    hpMultiplier: 1,
    speedMultiplier: 1.25,
    damageMultiplier: 1.15,
    attackIntervalMultiplier: 0.7,
    tell: 'red',
    volatileDeathBurst: null,
  }),
  volatile: Object.freeze({
    id: 'volatile',
    hpMultiplier: 1,
    speedMultiplier: 1,
    damageMultiplier: 1,
    attackIntervalMultiplier: 1,
    tell: 'violet',
    volatileDeathBurst: Object.freeze({
      radius: 3.2,
      delaySeconds: 0.65,
      triggerOnCleanup: false,
    }),
  }),
});

export const SURVIVAL_BOSS_IDS = Object.freeze([
  'feastkeeper',
  'reveler',
  'keeper',
]);

export const SURVIVAL_BOSS_BASES = Object.freeze({
  feastkeeper: Object.freeze({
    id: 'feastkeeper',
    label: 'The Feastkeeper',
    baseHp: 180,
  }),
  reveler: Object.freeze({
    id: 'reveler',
    label: 'The Reveler',
    baseHp: 160,
  }),
  keeper: Object.freeze({
    id: 'keeper',
    label: 'The Keeper',
    baseHp: 200,
  }),
});

export const SURVIVAL_BOSS_SCALING = Object.freeze({
  hpPerIndex: 0.55,
  damagePerIndex: 0.18,
  attackIntervalPerIndex: 0.07,
  minimumAttackIntervalMultiplier: 0.68,
});

function requireWave(wave) {
  if (!Number.isInteger(wave) || wave < 1) {
    throw new RangeError('Survival wave must be a positive integer.');
  }
  return wave;
}

function requireBossesDefeated(bossesDefeated) {
  if (!Number.isInteger(bossesDefeated) || bossesDefeated < 0) {
    throw new RangeError('Bosses defeated must be a non-negative integer.');
  }
  return bossesDefeated;
}

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

function countRoles(roles) {
  const counts = {};
  for (const role of roles) counts[role] = (counts[role] || 0) + 1;
  return Object.freeze(counts);
}

function buildBaseRoles(wave) {
  const roles = getUnlockedSurvivalRoles(wave);
  const minimumCount = 5;
  while (roles.length < minimumCount) roles.push('chaser');
  return roles;
}

export function createSurvivalRng(seed) {
  // Exact Mulberry32 sequence used by config.js. It lives here as well because
  // importing config.js would pull Three.js into deterministic Node tests.
  let state = Number(seed) >>> 0;
  return function survivalRandom() {
    state |= 0;
    state = (state + 0x6D2B79F5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function isSurvivalBossWave(wave) {
  return requireWave(wave) % 10 === 0;
}

export function isSurvivalDraftWave(wave) {
  requireWave(wave);
  return wave === SURVIVAL_FIRST_DRAFT_WAVE || wave % SURVIVAL_DRAFT_INTERVAL === 0;
}

// The wave the HUD points the player at next. Bosses are announced as Guardians
// even though they, too, end in a draft.
export function describeSurvivalMilestone(wave) {
  const current = Math.max(1, Math.floor(Number(wave) || 1));
  const milestone = current < SURVIVAL_FIRST_DRAFT_WAVE
    ? SURVIVAL_FIRST_DRAFT_WAVE
    : Math.ceil((current + 1) / SURVIVAL_DRAFT_INTERVAL) * SURVIVAL_DRAFT_INTERVAL;
  return milestone % 10 === 0
    ? `Guardian at Wave ${milestone}`
    : `Upgrade at Wave ${milestone}`;
}

export function getSurvivalTier(wave) {
  return Math.floor((requireWave(wave) - 1) / 5);
}

export function getUnlockedSurvivalRoles(wave) {
  requireWave(wave);
  return SURVIVAL_ROLE_UNLOCKS
    .filter((entry) => entry.wave <= wave)
    .map((entry) => entry.role);
}

export function getSurvivalThreatScaling(wave) {
  const tier = getSurvivalTier(wave);
  return Object.freeze({
    tier,
    hpMultiplier: roundTuning(1 + 0.3 * tier),
    damageMultiplier: roundTuning(1 + 0.16 * tier),
    speedMultiplier: roundTuning(Math.min(1.45, 1 + 0.06 * tier)),
    attackIntervalMultiplier: roundTuning(Math.max(0.68, 1 - 0.05 * tier)),
    projectileSpeedMultiplier: roundTuning(Math.min(1.35, 1 + 0.04 * tier)),
  });
}

export function getSurvivalThreatCapacity(liveCount = 0, pendingCount = 0) {
  const live = Math.max(0, Math.floor(Number(liveCount) || 0));
  const pending = Math.max(0, Math.floor(Number(pendingCount) || 0));
  return Math.max(0, SURVIVAL_THREAT_CAP - live - pending);
}

export function awardSurvivalBossReroll(currentRerolls = 0) {
  const current = Math.max(0, Math.floor(Number(currentRerolls) || 0));
  return Math.min(SURVIVAL_REROLL_CAP, current + 1);
}

export function spendSurvivalReroll(currentRerolls = 0) {
  const current = Math.max(0, Math.floor(Number(currentRerolls) || 0));
  return Math.max(0, current - 1);
}

// Normal recipes always contain every unlocked role when capacity permits.
// Density grows separately, by no more than four threats beyond that base.
export function buildSurvivalWaveRecipe(wave, options = {}) {
  requireWave(wave);
  if (isSurvivalBossWave(wave)) {
    return Object.freeze({
      kind: 'boss',
      wave,
      roles: Object.freeze([]),
      counts: Object.freeze({}),
      baseCount: 0,
      additionalCount: 0,
      spawnCount: 0,
      threatCap: SURVIVAL_THREAT_CAP,
    });
  }

  const rng = options.rng || (() => 0.5);
  const baseRoles = buildBaseRoles(wave);
  const unlockedRoles = getUnlockedSurvivalRoles(wave);
  const requestedAdditional = Math.min(4, Math.floor((wave - 1) / 3));
  const requestedRoles = baseRoles.slice();

  for (let i = 0; i < requestedAdditional; i++) {
    requestedRoles.push(unlockedRoles[randomIndex(unlockedRoles.length, rng)]);
  }

  const capacity = getSurvivalThreatCapacity(
    options.liveCount,
    options.pendingCount,
  );
  const roles = requestedRoles.slice(0, capacity);
  const additionalCount = Math.max(0, roles.length - Math.min(baseRoles.length, roles.length));

  return Object.freeze({
    kind: 'normal',
    wave,
    roles: Object.freeze(roles),
    counts: countRoles(roles),
    baseCount: baseRoles.length,
    additionalCount,
    requestedAdditionalCount: requestedAdditional,
    spawnCount: roles.length,
    threatCap: SURVIVAL_THREAT_CAP,
  });
}

export function getSurvivalEliteRules(bossesDefeated) {
  requireBossesDefeated(bossesDefeated);
  if (bossesDefeated === 0) {
    return Object.freeze({
      eligible: false,
      chance: 0,
      maxElites: 0,
    });
  }
  return Object.freeze({
    eligible: true,
    chance: Math.min(0.4, 0.12 + 0.07 * (bossesDefeated - 1)),
    maxElites: Math.min(4, bossesDefeated),
  });
}

export function getSurvivalEliteProfile(eliteId) {
  if (eliteId == null) return null;
  const profile = SURVIVAL_ELITE_PROFILES[eliteId];
  if (!profile) throw new RangeError(`Unknown Survival elite profile: ${eliteId}`);
  return profile;
}

export function composeSurvivalThreatProfile(wave, eliteId = null) {
  const scaling = getSurvivalThreatScaling(wave);
  const elite = getSurvivalEliteProfile(eliteId);
  return Object.freeze({
    tier: scaling.tier,
    hpMultiplier: roundTuning(scaling.hpMultiplier * (elite?.hpMultiplier ?? 1)),
    damageMultiplier: roundTuning(scaling.damageMultiplier * (elite?.damageMultiplier ?? 1)),
    speedMultiplier: roundTuning(scaling.speedMultiplier * (elite?.speedMultiplier ?? 1)),
    attackIntervalMultiplier: roundTuning(
      scaling.attackIntervalMultiplier * (elite?.attackIntervalMultiplier ?? 1),
    ),
    projectileSpeedMultiplier: scaling.projectileSpeedMultiplier,
    eliteId: elite?.id ?? null,
    tell: elite?.tell ?? null,
    volatileDeathBurst: elite?.volatileDeathBurst ?? null,
  });
}

// Returns one slot per requested threat. Null means an ordinary threat.
export function rollSurvivalEliteSlots(threatCount, bossesDefeated, rng) {
  const count = Math.max(0, Math.floor(Number(threatCount) || 0));
  const rules = getSurvivalEliteRules(bossesDefeated);
  const slots = Array(count).fill(null);
  if (!rules.eligible || count === 0) return Object.freeze(slots);

  const eliteIds = Object.keys(SURVIVAL_ELITE_PROFILES);
  let eliteCount = 0;
  for (let i = 0; i < count && eliteCount < rules.maxElites; i++) {
    if (safeRngValue(rng) >= rules.chance) continue;
    slots[i] = eliteIds[randomIndex(eliteIds.length, rng)];
    eliteCount++;
  }
  return Object.freeze(slots);
}

export function getSurvivalBossIndex(wave) {
  requireWave(wave);
  if (!isSurvivalBossWave(wave)) return null;
  return wave / 10 - 1;
}

export function selectNextSurvivalBoss(rng, previousBossId = null) {
  if (previousBossId != null && !SURVIVAL_BOSS_IDS.includes(previousBossId)) {
    throw new RangeError(`Unknown previous Survival boss: ${previousBossId}`);
  }
  const candidates = previousBossId == null
    ? SURVIVAL_BOSS_IDS
    : SURVIVAL_BOSS_IDS.filter((id) => id !== previousBossId);
  return candidates[randomIndex(candidates.length, rng)];
}

export function getSurvivalBossTuning(bossId, bossIndex = 0) {
  const base = SURVIVAL_BOSS_BASES[bossId];
  if (!base) throw new RangeError(`Unknown Survival boss: ${bossId}`);
  if (!Number.isInteger(bossIndex) || bossIndex < 0) {
    throw new RangeError('Survival boss index must be a non-negative integer.');
  }

  const hpMultiplier = roundTuning(1 + SURVIVAL_BOSS_SCALING.hpPerIndex * bossIndex);
  return Object.freeze({
    id: base.id,
    label: base.label,
    bossIndex,
    baseHp: base.baseHp,
    hpMultiplier,
    maxHp: Math.round(base.baseHp * hpMultiplier),
    damageMultiplier: roundTuning(
      1 + SURVIVAL_BOSS_SCALING.damagePerIndex * bossIndex,
    ),
    attackIntervalMultiplier: roundTuning(
      Math.max(
        SURVIVAL_BOSS_SCALING.minimumAttackIntervalMultiplier,
        1 - SURVIVAL_BOSS_SCALING.attackIntervalPerIndex * bossIndex,
      ),
    ),
  });
}
