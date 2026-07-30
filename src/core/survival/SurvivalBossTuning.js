// ============================================================
// SURVIVAL BOSS TUNING — pure, immutable adaptation of authored Guardians.
// ============================================================

const CADENCE_KEYS = new Set([
  'ATTACK_INTERVAL',
  'SHOT_INTERVAL',
  'SUMMON_INTERVAL',
  'RATE',
  'BURST_GAP',
  'COOLDOWN',
  'HIT_COOLDOWN',
]);

function scaleValue(value, multiplier) {
  if (typeof value === 'number') return value * multiplier;
  if (Array.isArray(value)) return value.map((entry) => scaleValue(entry, multiplier));
  return value;
}

function adaptNode(value, damageMultiplier, cadenceMultiplier) {
  if (Array.isArray(value)) {
    return value.map((entry) => adaptNode(entry, damageMultiplier, cadenceMultiplier));
  }
  if (value === null || typeof value !== 'object') return value;

  const result = {};
  for (const [key, nested] of Object.entries(value)) {
    if ((key === 'DAMAGE' || key.endsWith('_DAMAGE')) && key !== 'REFLECT_DAMAGE') {
      result[key] = scaleValue(nested, damageMultiplier);
    } else if (CADENCE_KEYS.has(key)) {
      result[key] = scaleValue(nested, cadenceMultiplier);
    } else if (key === 'GAP' && Object.hasOwn(value, 'COOLDOWN')) {
      result[key] = scaleValue(nested, cadenceMultiplier);
    } else {
      result[key] = adaptNode(nested, damageMultiplier, cadenceMultiplier);
    }
  }
  return result;
}

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) freezeDeep(nested);
  return Object.freeze(value);
}

export function createSurvivalBossOverride(authoredTuning, survivalTuning) {
  if (!authoredTuning || !survivalTuning) {
    throw new TypeError('Authored and Survival boss tuning are required.');
  }
  const result = adaptNode(
    authoredTuning,
    survivalTuning.damageMultiplier,
    survivalTuning.attackIntervalMultiplier,
  );
  result.HP = survivalTuning.maxHp;
  result.SURVIVAL_LABEL = survivalTuning.label;
  return freezeDeep(result);
}
