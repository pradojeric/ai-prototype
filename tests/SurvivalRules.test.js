import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SURVIVAL_BOSS_BASES,
  SURVIVAL_BOSS_SCALING,
  SURVIVAL_ELITE_PROFILES,
  SURVIVAL_ROLE_BASE_HP,
  buildSurvivalWaveRecipe,
  composeSurvivalThreatProfile,
  createSurvivalRng,
  describeSurvivalMilestone,
  getSurvivalBossTuning,
  getSurvivalEliteRules,
  getSurvivalThreatScaling,
  getUnlockedSurvivalRoles,
  isSurvivalDraftWave,
  rollSurvivalEliteSlots,
  selectNextSurvivalBoss,
} from '../src/core/survival/SurvivalRules.js';
import {
  SURVIVAL_LIGHT_BOLT,
  SURVIVAL_UPGRADE_CARDS,
  SURVIVAL_WEAPON_PATHS,
  applySurvivalUpgrade,
  createSurvivalUpgradeState,
  draftSurvivalUpgrades,
  getEligibleSurvivalUpgrades,
  getSurvivalBuildEffects,
  getSurvivalUpgradeRank,
  isSurvivalUpgradeMaxed,
} from '../src/core/survival/SurvivalUpgrades.js';
import {
  describeSurvivalCard,
  describeSurvivalMasteryCard,
  describeSurvivalWeaponCard,
} from '../src/core/survival/SurvivalUpgradeCopy.js';
import {
  SurvivalRunStats,
  SurvivalSessionBest,
  compareSurvivalResults,
  selectSurvivalSessionBest,
} from '../src/core/survival/SurvivalRunStats.js';

test('lesser roles unlock on their authored waves', () => {
  const expectations = new Map([
    [1, ['chaser']],
    [2, ['chaser', 'spitter']],
    [3, ['chaser', 'spitter', 'boarder']],
    [4, ['chaser', 'spitter', 'boarder', 'sniper']],
    [5, ['chaser', 'spitter', 'boarder', 'sniper']],
    [6, ['chaser', 'spitter', 'boarder', 'sniper', 'gargoyle']],
    [7, ['chaser', 'spitter', 'boarder', 'sniper', 'gargoyle']],
    [8, ['chaser', 'spitter', 'boarder', 'sniper', 'gargoyle', 'gale']],
  ]);
  for (const [wave, roles] of expectations) {
    assert.deepEqual(getUnlockedSurvivalRoles(wave), roles);
  }
});

test('tier scaling follows formulas and clamps speed and cadence', () => {
  assert.deepEqual(getSurvivalThreatScaling(1), {
    tier: 0,
    hpMultiplier: 1,
    damageMultiplier: 1,
    speedMultiplier: 1,
    attackIntervalMultiplier: 1,
    projectileSpeedMultiplier: 1,
  });
  assert.deepEqual(getSurvivalThreatScaling(6), {
    tier: 1,
    hpMultiplier: 1.3,
    damageMultiplier: 1.16,
    speedMultiplier: 1.06,
    attackIntervalMultiplier: 0.95,
    projectileSpeedMultiplier: 1.04,
  });
  const late = getSurvivalThreatScaling(101);
  assert.equal(late.tier, 20);
  assert.equal(late.speedMultiplier, 1.45);
  assert.equal(late.attackIntervalMultiplier, 0.68);
  assert.equal(late.projectileSpeedMultiplier, 1.35);
});

test('normal recipes mix unlocked roles, add at most four, and honor cap', () => {
  assert.equal(buildSurvivalWaveRecipe(1).spawnCount, 5);
  assert.equal(buildSurvivalWaveRecipe(2).spawnCount, 5);
  const recipe = buildSurvivalWaveRecipe(19, { rng: createSurvivalRng(17) });
  assert.equal(recipe.kind, 'normal');
  assert.equal(recipe.baseCount, 6);
  assert.ok(recipe.additionalCount <= 4);
  assert.equal(recipe.spawnCount, 10);
  for (const role of getUnlockedSurvivalRoles(19)) {
    assert.ok(recipe.roles.includes(role), `${role} should be represented`);
  }

  const crowded = buildSurvivalWaveRecipe(19, {
    rng: createSurvivalRng(17),
    liveCount: 6,
    pendingCount: 2,
  });
  assert.equal(crowded.spawnCount, 2);
  assert.equal(crowded.spawnCount + 6 + 2, 10);

  const boss = buildSurvivalWaveRecipe(20);
  assert.equal(boss.kind, 'boss');
  assert.equal(boss.spawnCount, 0);
});

test('Survival roles use isolated health baselines for sustained waves', () => {
  assert.deepEqual(SURVIVAL_ROLE_BASE_HP, {
    chaser: 12,
    spitter: 14,
    boarder: 16,
    sniper: 12,
    gargoyle: 18,
    gale: 12,
  });
  assert.equal(Object.isFrozen(SURVIVAL_ROLE_BASE_HP), true);
});

// Guards the balance pass: Survival's own health baseline is only fair if the
// player's primaries are tuned against it rather than against the campaign's
// fragile threats. Every path must sit in the same dps band.
test('every Survival primary shares a dps band tuned to Survival health', () => {
  const dps = {
    'light-bolt': SURVIVAL_LIGHT_BOLT.damage / SURVIVAL_LIGHT_BOLT.cooldownSeconds,
    rapid: SURVIVAL_WEAPON_PATHS.rapid.damage /
      SURVIVAL_WEAPON_PATHS.rapid.cooldownSeconds,
    lance: SURVIVAL_WEAPON_PATHS.lance.damage /
      SURVIVAL_WEAPON_PATHS.lance.cooldownSeconds,
    laser: SURVIVAL_WEAPON_PATHS.laser.damagePerTick *
      SURVIVAL_WEAPON_PATHS.laser.ticksPerSecond,
  };

  for (const [id, value] of Object.entries(dps)) {
    assert.ok(value >= 12 && value <= 14.5, `${id} dps out of band: ${value}`);
  }

  // Wave 1 is five chasers; it must be a short opener, not a war of attrition.
  const waveOneHealth = 5 * SURVIVAL_ROLE_BASE_HP.chaser;
  assert.ok(waveOneHealth / dps['light-bolt'] < 6);
});

// A single 12 HP chaser is too small a target for one rank to cross a whole-bolt
// breakpoint, so legibility is measured where the player actually feels it: the
// bolts needed to clear a wave. Rank 2 does move the per-chaser breakpoint.
test('Primary Power ranks measurably shorten a wave', () => {
  const rank = (n) => {
    let state = createSurvivalUpgradeState();
    for (let i = 0; i < n; i++) state = applySurvivalUpgrade(state, 'primary-power');
    return getSurvivalBuildEffects(state).primaryDamageMultiplier;
  };
  const waveBolts = (multiplier) => Math.ceil(
    (5 * SURVIVAL_ROLE_BASE_HP.chaser) / (SURVIVAL_LIGHT_BOLT.damage * multiplier),
  );
  const perChaser = (multiplier) => Math.ceil(
    SURVIVAL_ROLE_BASE_HP.chaser / (SURVIVAL_LIGHT_BOLT.damage * multiplier),
  );

  assert.equal(waveBolts(1), 20);
  assert.equal(waveBolts(rank(1)), 17);
  assert.equal(perChaser(1), 4);
  assert.equal(perChaser(rank(2)), 3);
});

test('drafts land on wave 2 and then every fifth wave', () => {
  assert.equal(isSurvivalDraftWave(1), false);
  assert.equal(isSurvivalDraftWave(2), true);
  assert.equal(isSurvivalDraftWave(3), false);
  assert.equal(isSurvivalDraftWave(4), false);
  assert.equal(isSurvivalDraftWave(5), true);
  assert.equal(isSurvivalDraftWave(10), true);
  assert.equal(isSurvivalDraftWave(12), false);
  assert.equal(isSurvivalDraftWave(15), true);
});

test('milestone labels point at the next draft or Guardian', () => {
  assert.equal(describeSurvivalMilestone(1), 'Upgrade at Wave 2');
  assert.equal(describeSurvivalMilestone(2), 'Upgrade at Wave 5');
  assert.equal(describeSurvivalMilestone(5), 'Guardian at Wave 10');
  assert.equal(describeSurvivalMilestone(13), 'Upgrade at Wave 15');
  assert.equal(describeSurvivalMilestone(15), 'Guardian at Wave 20');
});

test('elite rules unlock after first boss and obey chance/count caps', () => {
  assert.deepEqual(getSurvivalEliteRules(0), {
    eligible: false,
    chance: 0,
    maxElites: 0,
  });
  assert.deepEqual(getSurvivalEliteRules(1), {
    eligible: true,
    chance: 0.12,
    maxElites: 1,
  });
  assert.deepEqual(getSurvivalEliteRules(3), {
    eligible: true,
    chance: 0.26,
    maxElites: 3,
  });
  assert.deepEqual(getSurvivalEliteRules(99), {
    eligible: true,
    chance: 0.4,
    maxElites: 4,
  });

  const guaranteedRng = () => 0;
  const slots = rollSurvivalEliteSlots(10, 99, guaranteedRng);
  assert.equal(slots.filter(Boolean).length, 4);
  assert.ok(slots.filter(Boolean).every((id) => id === 'armored'));
});

test('elite profiles compose with wave scaling without mutating constants', () => {
  const frenzied = composeSurvivalThreatProfile(6, 'frenzied');
  assert.equal(frenzied.hpMultiplier, 1.3);
  assert.equal(frenzied.speedMultiplier, 1.325);
  assert.equal(frenzied.damageMultiplier, 1.334);
  assert.equal(frenzied.attackIntervalMultiplier, 0.665);
  assert.equal(frenzied.tell, 'red');

  const volatile = composeSurvivalThreatProfile(1, 'volatile');
  assert.deepEqual(volatile.volatileDeathBurst, {
    radius: 3.2,
    delaySeconds: 0.65,
    triggerOnCleanup: false,
  });
  assert.equal(Object.isFrozen(SURVIVAL_ELITE_PROFILES.volatile), true);
});

test('seeded boss order is reproducible and never immediately repeats', () => {
  const buildOrder = (seed) => {
    const rng = createSurvivalRng(seed);
    const order = [];
    let previous = null;
    for (let i = 0; i < 24; i++) {
      const next = selectNextSurvivalBoss(rng, previous);
      assert.notEqual(next, previous);
      order.push(next);
      previous = next;
    }
    return order;
  };
  assert.deepEqual(buildOrder(9001), buildOrder(9001));
  assert.notDeepEqual(buildOrder(9001), buildOrder(9002));
});

test('boss tuning uses normalized immutable bases and authored scaling', () => {
  assert.equal(SURVIVAL_BOSS_BASES.feastkeeper.baseHp, 180);
  assert.equal(SURVIVAL_BOSS_BASES.reveler.baseHp, 160);
  assert.equal(SURVIVAL_BOSS_BASES.keeper.baseHp, 200);
  assert.equal(Object.isFrozen(SURVIVAL_BOSS_BASES), true);
  assert.equal(Object.isFrozen(SURVIVAL_BOSS_BASES.keeper), true);
  assert.equal(Object.isFrozen(SURVIVAL_BOSS_SCALING), true);

  assert.deepEqual(getSurvivalBossTuning('keeper', 0), {
    id: 'keeper',
    label: 'The Archivist',
    bossIndex: 0,
    baseHp: 200,
    hpMultiplier: 1,
    maxHp: 200,
    damageMultiplier: 1,
    attackIntervalMultiplier: 1,
  });
  assert.deepEqual(getSurvivalBossTuning('reveler', 2), {
    id: 'reveler',
    label: 'The Reveler',
    bossIndex: 2,
    baseHp: 160,
    hpMultiplier: 2.1,
    maxHp: 336,
    damageMultiplier: 1.36,
    attackIntervalMultiplier: 0.86,
  });
  assert.equal(getSurvivalBossTuning('feastkeeper', 20).attackIntervalMultiplier, 0.68);
});

test('smart drafts contain three eligible cards with category diversity', () => {
  const state = createSurvivalUpgradeState();
  const draft = draftSurvivalUpgrades({
    state,
    wave: 5,
    rng: createSurvivalRng(101),
  });
  assert.equal(draft.length, 3);
  assert.equal(new Set(draft.map((card) => card.id)).size, 3);
  assert.equal(new Set(draft.map((card) => card.category)).size, 3);
  assert.ok(draft.every((card) => (
    getEligibleSurvivalUpgrades(state).some((eligible) => eligible.id === card.id)
  )));
  assert.equal(
    getEligibleSurvivalUpgrades(state).some((card) => card.id === 'path-mastery'),
    false,
  );
});

test('a reroll cannot reproduce the exact previous three card IDs', () => {
  const state = createSurvivalUpgradeState();
  const rng = createSurvivalRng(51);
  const first = draftSurvivalUpgrades({ state, wave: 10, rng });
  const reroll = draftSurvivalUpgrades({
    state,
    wave: 10,
    rng,
    previousCardIds: first.map((card) => card.id),
  });
  const signature = (cards) => cards.map((card) => card.id).sort().join('|');
  assert.notEqual(signature(reroll), signature(first));
});

test('wave-15 pity offers a weapon and selecting it locks the path', () => {
  const open = createSurvivalUpgradeState();
  const pity = draftSurvivalUpgrades({
    state: open,
    wave: 15,
    rng: createSurvivalRng(4),
  });
  const weaponCard = pity.find((card) => card.familyId === 'weapon-transformation');
  assert.ok(weaponCard);

  const locked = applySurvivalUpgrade(open, weaponCard.id);
  assert.equal(locked.weaponPath, weaponCard.weaponPath);
  const eligibleIds = getEligibleSurvivalUpgrades(locked).map((card) => card.id);
  assert.ok(!eligibleIds.some((id) => id.startsWith('weapon-')));
  assert.ok(eligibleIds.includes('path-mastery'));
  assert.throws(() => applySurvivalUpgrade(locked, 'weapon-laser'));
});

test('rank-limited families cap at three while Power and Vitality repeat', () => {
  let state = createSurvivalUpgradeState({ weaponPath: 'lance' });
  for (let i = 0; i < 3; i++) state = applySurvivalUpgrade(state, 'path-mastery');
  assert.equal(getSurvivalUpgradeRank(state, 'path-mastery'), 3);
  assert.equal(isSurvivalUpgradeMaxed(state, 'path-mastery'), true);
  assert.throws(() => applySurvivalUpgrade(state, 'path-mastery'));

  for (let i = 0; i < 40; i++) {
    state = applySurvivalUpgrade(state, 'primary-power');
    state = applySurvivalUpgrade(state, 'vitality');
  }
  assert.equal(getSurvivalUpgradeRank(state, 'primary-power'), 40);
  assert.equal(getSurvivalUpgradeRank(state, 'vitality'), 40);
  const eligible = getEligibleSurvivalUpgrades(state).map((card) => card.id);
  assert.ok(eligible.includes('primary-power'));
  assert.ok(eligible.includes('vitality'));
});

test('fully capped endless builds still receive three rerollable choices', () => {
  const state = createSurvivalUpgradeState({
    weaponPath: 'laser',
    ranks: {
      'path-mastery': 3,
      'woven-ward': 3,
      'dash-weave': 3,
      'shockwave-resonance': 3,
      'alab-reservoir': 3,
      'lumina-affinity': 3,
      'primary-power': 40,
      vitality: 40,
    },
  });
  const rng = createSurvivalRng(912);
  const first = draftSurvivalUpgrades({ state, wave: 200, rng });
  const second = draftSurvivalUpgrades({
    state,
    wave: 200,
    rng,
    previousCardIds: first.map((card) => card.id),
  });

  assert.equal(first.length, 3);
  assert.equal(new Set(first.map((card) => card.id)).size, 3);
  assert.equal(second.length, 3);
  assert.notEqual(
    second.map((card) => card.id).sort().join('|'),
    first.map((card) => card.id).sort().join('|'),
  );
  assert.ok([...first, ...second].every((card) => (
    card.familyId === 'primary-power' || card.familyId === 'vitality'
  )));
});

test('derived build effects preserve exact authored upgrade increments', () => {
  const state = createSurvivalUpgradeState({
    weaponPath: 'laser',
    ranks: {
      'primary-power': 4,
      'path-mastery': 3,
      vitality: 2,
      'woven-ward': 3,
      'dash-weave': 3,
      'alab-reservoir': 2,
      'lumina-affinity': 3,
    },
  });
  const effects = getSurvivalBuildEffects(state);
  assert.equal(effects.primaryDamageMultiplier, 1.72);
  assert.equal(effects.maxHealthBonus, 30);
  assert.equal(effects.damageReduction, 0.24);
  assert.deepEqual(effects.pathMastery.laser, {
    heatCapacityBonus: 1.5,
    rangeBonus: 6,
    widthMultiplier: 1.66,   // presentation: 1 + 0.22 * 3 ranks
  });
  assert.deepEqual(effects.dash, {
    rank: 3,
    cooldownImproved: true,
    charges: 2,
    distanceImproved: true,
  });
  assert.deepEqual(effects.alab, {
    rank: 2,
    chargeGainMultiplier: 1.3,
    durationBonusSeconds: 1,
  });
  assert.equal(effects.lumina.dropChanceBonus, 0.15);
});

test('run stats count only active time and snapshot the selected build', () => {
  const stats = new SurvivalRunStats();
  stats.update(10);
  stats.setActive(true);
  stats.update(12.8);
  stats.setActive(false);
  stats.update(99);
  stats.setWave(17);
  stats.recordKill(31);
  stats.recordBossDefeated();
  assert.deepEqual(stats.snapshot({
    weaponPath: 'rapid',
    ranks: { vitality: 2 },
  }), {
    wave: 17,
    activeSeconds: 12,
    kills: 31,
    bossesDefeated: 1,
    weaponPath: 'rapid',
    upgradeRanks: { vitality: 2 },
  });
});

test('session best orders wave, bosses, kills, then active time without storage', () => {
  const first = {
    wave: 12,
    bossesDefeated: 1,
    kills: 40,
    activeSeconds: 500,
    weaponPath: 'rapid',
    upgradeRanks: {},
  };
  const laterWave = { ...first, wave: 13, kills: 1, activeSeconds: 10 };
  assert.equal(compareSurvivalResults(laterWave, first), 1);
  assert.equal(compareSurvivalResults(first, laterWave), -1);
  assert.equal(selectSurvivalSessionBest(first, laterWave).wave, 13);

  const session = new SurvivalSessionBest();
  session.record(first);
  session.record({ ...first, activeSeconds: 499 });
  assert.equal(session.snapshot().activeSeconds, 500);
  session.record({ ...first, kills: 41, activeSeconds: 1 });
  assert.equal(session.snapshot().kills, 41);
  assert.equal(globalThis.localStorage, undefined);
});

// --- draft card copy --------------------------------------------------------
// The point of deriving this copy is that a card can never advertise a number
// the weapon does not fire, so these assert against the tuning tables rather
// than against hardcoded strings.

test('weapon cards state their own tuning, compared to the bolt they replace', () => {
  const boltDps = (SURVIVAL_LIGHT_BOLT.damage / SURVIVAL_LIGHT_BOLT.cooldownSeconds).toFixed(1);
  const rapid = describeSurvivalWeaponCard('rapid');
  assert.match(rapid, new RegExp(`${SURVIVAL_WEAPON_PATHS.rapid.damage} damage`));
  assert.match(rapid, new RegExp(`every ${SURVIVAL_WEAPON_PATHS.rapid.cooldownSeconds}s`));
  assert.ok(rapid.includes(boltDps), 'the trade against Light Bolt is stated, not implied');

  const laser = describeSurvivalWeaponCard('laser');
  const path = SURVIVAL_WEAPON_PATHS.laser;
  assert.match(laser, new RegExp(`${path.range}m`));
  assert.match(laser, new RegExp(`${path.damagePerTick * path.ticksPerSecond} dps`));
  assert.match(laser, new RegExp(`${path.overheatLockoutSeconds}s overheat lockout`));
  assert.match(laser, /hitscan/, 'the beam says it cannot miss — its real selling point');

  const lance = describeSurvivalWeaponCard('lance');
  assert.match(lance, new RegExp(`piercing ${SURVIVAL_WEAPON_PATHS.lance.pierceTargets} targets`));
  assert.equal(describeSurvivalWeaponCard('nonsense'), '');
});

test('Path Mastery copy names the held weapon and the rank being bought', () => {
  const at = (weaponPath, rank) => describeSurvivalMasteryCard(
    createSurvivalUpgradeState({ weaponPath, ranks: { 'path-mastery': rank } }),
  );

  // Rapid: base pierce is 1, so rank 1 buys the second target.
  assert.match(at('rapid', 0), /Rapid Weave · rank 1 of 3/);
  assert.match(at('rapid', 0), /pierce 2 targets \(up from 1\)/);
  assert.match(at('rapid', 2), /pierce 4 targets \(up from 3\)/);

  // Laser: 2.5s base heat, +0.5s per rank. Says outright that damage is unchanged.
  assert.match(at('laser', 0), /Continuous Laser · rank 1 of 3/);
  assert.match(at('laser', 0), /3s of heat before lockout \(up from 2.5s\)/);
  assert.match(at('laser', 1), /32m range/);          // 28 + 2 * 2
  assert.match(at('laser', 0), /not more damage per tick/);

  // Lance: base pierce 3, +1 and +10% radius per rank.
  assert.match(at('lance', 1), /pierces 5 targets \(up from 4\)/);
  assert.match(at('lance', 1), /\+20% blast radius/);

  // The last rank must not advertise a rank 4 that cannot be bought.
  assert.match(at('rapid', 3), /rank 3 of 3/);

  // Withheld from the draft until a weapon is chosen, but must not throw or lie.
  assert.match(
    describeSurvivalMasteryCard(createSurvivalUpgradeState({})),
    /Choose a weapon transformation first/,
  );
  assert.match(describeSurvivalMasteryCard(null), /Choose a weapon transformation first/);
});

test('every draft card resolves to non-empty copy', () => {
  const build = createSurvivalUpgradeState({
    weaponPath: 'lance',
    ranks: { 'path-mastery': 1 },
  });
  for (const card of SURVIVAL_UPGRADE_CARDS) {
    const copy = describeSurvivalCard(card, build);
    assert.ok(copy.length > 20, `${card.id} must carry real copy, got "${copy}"`);
  }
  // The repeatable fallback cards share a family with a real card, so family-keyed
  // lookup has to cover their distinct `-echo` IDs too.
  assert.ok(describeSurvivalCard({ id: 'primary-power-echo', familyId: 'primary-power' }).length > 20);
  assert.equal(describeSurvivalCard(null), '');
});
