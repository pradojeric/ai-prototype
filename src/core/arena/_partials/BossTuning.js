// ============================================================
// BOSS TUNING — immutable, recursive overrides for boss instances.
// ============================================================

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (!isPlainObject(value)) return value;
  const result = {};
  for (const [key, nested] of Object.entries(value)) result[key] = clone(nested);
  return result;
}

function merge(base, overrides) {
  const result = clone(base);
  if (!isPlainObject(overrides)) return result;
  for (const [key, value] of Object.entries(overrides)) {
    result[key] = isPlainObject(value) && isPlainObject(result[key])
      ? merge(result[key], value)
      : clone(value);
  }
  return result;
}

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) freezeDeep(nested);
  return Object.freeze(value);
}

export function immutableBossTuning(base, overrides = null) {
  return freezeDeep(merge(base, overrides));
}
