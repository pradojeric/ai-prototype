// ============================================================
// SURVIVAL UPGRADE COPY — draft card descriptions derived from the live tuning.
// ============================================================
// The weapon and Path Mastery cards used to carry hand-written copy that could
// not say anything specific: Path Mastery's effect depends on which weapon the
// run is holding and on the rank being bought, so a static string could only
// manage "its next mastery effect". Everything here reads the same tables the
// weapons actually fire from, so the numbers on the card cannot drift from the
// numbers in the fight.
//
// Dependency-free by design (no Three.js, no config.js) so it stays unit-testable
// under Node, matching SurvivalRules.js.
import {
  SURVIVAL_LIGHT_BOLT,
  SURVIVAL_WEAPON_PATHS,
  SURVIVAL_UPGRADE_FAMILIES,
  getSurvivalUpgradeRank,
} from './SurvivalUpgrades.js';

// Mastery increments, kept beside the copy that reports them. These mirror
// getSurvivalBuildEffects' pathMastery block — the single test in
// SurvivalRules.test.js that pins the effects also pins these.
const MASTERY_PER_RANK = Object.freeze({
  rapid: Object.freeze({ pierce: 1 }),
  laser: Object.freeze({ heatSeconds: 0.5, rangeMetres: 2, widthPercent: 22 }),
  lance: Object.freeze({ pierce: 1, radiusPercent: 10 }),
});

// Trim trailing zeros so 2.5 stays "2.5" but 3.0 reads "3".
function num(value) {
  return String(Math.round(value * 100) / 100);
}

function dps(damage, cooldownSeconds) {
  return num(Math.round((damage / cooldownSeconds) * 10) / 10);
}

function targets(count) {
  return count === 1 ? '1 target' : `${count} targets`;
}

// What a transformation card does, stated against the weapon it replaces so the
// trade is visible at the moment of choosing rather than after committing.
export function describeSurvivalWeaponCard(pathId) {
  const path = SURVIVAL_WEAPON_PATHS[pathId];
  if (!path) return '';
  const bolt = SURVIVAL_LIGHT_BOLT;
  const boltDps = dps(bolt.damage, bolt.cooldownSeconds);

  if (pathId === 'rapid') {
    return `${num(path.damage)} damage every ${num(path.cooldownSeconds)}s `
      + `(~${dps(path.damage, path.cooldownSeconds)} dps, vs ${boltDps}). `
      + 'Smaller hits, far faster. Mastery adds pierce — strongest into packed lanes.';
  }
  if (pathId === 'laser') {
    return `Held ${num(path.range)}m beam: ${num(path.damagePerTick)} damage `
      + `${num(path.ticksPerSecond)}× a second (~${num(path.damagePerTick * path.ticksPerSecond)} dps), `
      + `hitscan, so it cannot miss. Runs ${num(path.heatCapacitySeconds)}s before a `
      + `${num(path.overheatLockoutSeconds)}s overheat lockout.`;
  }
  return `${num(path.damage)} damage every ${num(path.cooldownSeconds)}s `
    + `(~${dps(path.damage, path.cooldownSeconds)} dps), piercing ${targets(path.pierceTargets)} `
    + 'in a wide blast. Slow and deliberate, but it clears whole rows.';
}

// Path Mastery, spelled out for the weapon in hand and the rank being bought —
// "3 → 4 targets" rather than "deepen the chosen path".
export function describeSurvivalMasteryCard(build) {
  const pathId = build?.weaponPath;
  const path = SURVIVAL_WEAPON_PATHS[pathId];
  if (!path) {
    // Unreachable through the draft (canOfferSurvivalUpgrade withholds the card
    // until a weapon is chosen), but callers may render a card list directly.
    return 'Choose a weapon transformation first — Path Mastery deepens whichever '
      + 'path the run is holding.';
  }

  const current = getSurvivalUpgradeRank(build, 'path-mastery');
  const maxRank = SURVIVAL_UPGRADE_FAMILIES['path-mastery'].maxRank;
  const next = Math.min(current + 1, maxRank);
  const per = MASTERY_PER_RANK[pathId];
  const lead = `${path.label} · rank ${next} of ${maxRank}: `;

  if (pathId === 'rapid') {
    const base = 1;
    return `${lead}bolts pierce ${targets(base + next)} (up from ${base + current}), `
      + 'carrying straight through the front rank.';
  }
  if (pathId === 'laser') {
    const heat = path.heatCapacitySeconds + per.heatSeconds * next;
    return `${lead}${num(heat)}s of heat before lockout `
      + `(up from ${num(path.heatCapacitySeconds + per.heatSeconds * current)}s), `
      + `${num(path.range + per.rangeMetres * next)}m range, heavier beam. `
      + 'Longer bursts, not more damage per tick.';
  }
  const pierce = path.pierceTargets;
  return `${lead}pierces ${targets(pierce + next)} (up from ${pierce + current}) `
    + `and +${per.radiusPercent * next}% blast radius, making those pierces easier to line up.`;
}

// Non-weapon families: static copy, since their effect does not depend on the
// build. Keyed by family so the repeatable `-echo` fallback cards resolve too.
const FAMILY_COPY = Object.freeze({
  'primary-power': 'Increase base primary damage by 18%. Applies to every weapon path, '
    + 'including the beam.',
  vitality: 'Gain 15 maximum health and restore the same amount immediately.',
  'woven-ward': 'Reduce incoming damage by another 8%.',
  'dash-weave': 'Improve dash recovery, add a second charge, then extend its distance.',
  'shockwave-resonance': 'Strengthen Shockwave damage and reach while shortening its recovery.',
  'alab-reservoir': 'Gain Alab charge faster and extend weapon-neutral overdrive.',
  'lumina-affinity': 'Raise Lumina drop chance and strengthen its temporary gifts.',
});

/**
 * Description for one draft card. `build` is the run's upgrade state — required
 * for Path Mastery, ignored by every other card.
 * @param {{id?: string, familyId?: string, weaponPath?: string}} card
 * @param {{weaponPath?: string|null, ranks?: object}} [build]
 */
export function describeSurvivalCard(card, build = null) {
  if (!card) return '';
  if (card.familyId === 'weapon-transformation') {
    return describeSurvivalWeaponCard(card.weaponPath || String(card.id).replace(/^weapon-/, ''));
  }
  if (card.familyId === 'path-mastery') return describeSurvivalMasteryCard(build);
  return FAMILY_COPY[card.familyId] || '';
}
