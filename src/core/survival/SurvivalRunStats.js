// ============================================================
// SURVIVAL RUN STATS — active-time tally and session-only best
// ============================================================
// No persistence is used here. Game owns one SurvivalSessionBest instance for
// the current page lifetime and discards it on reload.

function normalizeNonNegativeInteger(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function copyRanks(ranks = {}) {
  const copy = {};
  for (const [id, rank] of Object.entries(ranks)) {
    copy[id] = normalizeNonNegativeInteger(rank);
  }
  return Object.freeze(copy);
}

export function createSurvivalResult(result = {}) {
  return Object.freeze({
    wave: Math.max(1, normalizeNonNegativeInteger(result.wave) || 1),
    activeSeconds: normalizeNonNegativeInteger(result.activeSeconds),
    kills: normalizeNonNegativeInteger(result.kills),
    bossesDefeated: normalizeNonNegativeInteger(result.bossesDefeated),
    weaponPath: result.weaponPath || 'light-bolt',
    upgradeRanks: copyRanks(result.upgradeRanks),
  });
}

// A later wave is always better. Ties prefer more bosses, then kills, then
// survival time; build choices are displayed but never judge the player.
export function compareSurvivalResults(left, right) {
  const a = createSurvivalResult(left);
  const b = createSurvivalResult(right);
  const orderedFields = ['wave', 'bossesDefeated', 'kills', 'activeSeconds'];
  for (const field of orderedFields) {
    if (a[field] !== b[field]) return a[field] > b[field] ? 1 : -1;
  }
  return 0;
}

export function selectSurvivalSessionBest(currentBest, candidate) {
  const next = createSurvivalResult(candidate);
  if (currentBest == null || compareSurvivalResults(next, currentBest) > 0) return next;
  return createSurvivalResult(currentBest);
}

export class SurvivalSessionBest {
  constructor() {
    this.best = null;
  }

  record(result) {
    this.best = selectSurvivalSessionBest(this.best, result);
    return this.snapshot();
  }

  snapshot() {
    return this.best == null ? null : createSurvivalResult(this.best);
  }
}

export class SurvivalRunStats {
  constructor() {
    this.reset();
  }

  reset() {
    this.wave = 1;
    this.activeSeconds = 0;
    this.kills = 0;
    this.bossesDefeated = 0;
    this.active = false;
  }

  setActive(active) {
    this.active = !!active;
  }

  update(deltaSeconds) {
    if (!this.active) return;
    this.activeSeconds += Math.max(0, Number(deltaSeconds) || 0);
  }

  setWave(wave) {
    if (!Number.isInteger(wave) || wave < 1) {
      throw new RangeError('Survival stats wave must be a positive integer.');
    }
    this.wave = wave;
  }

  recordKill(count = 1) {
    this.kills += normalizeNonNegativeInteger(count);
  }

  recordBossDefeated() {
    this.bossesDefeated++;
  }

  snapshot(buildState = {}) {
    return createSurvivalResult({
      wave: this.wave,
      activeSeconds: this.activeSeconds,
      kills: this.kills,
      bossesDefeated: this.bossesDefeated,
      weaponPath: buildState.weaponPath,
      upgradeRanks: buildState.ranks,
    });
  }
}
