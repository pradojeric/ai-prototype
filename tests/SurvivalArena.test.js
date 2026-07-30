import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (relativePath) => readFileSync(
  new URL(relativePath, import.meta.url),
  'utf8',
);

const arena = source('../src/core/zones/survival.js');
const registry = source('../src/core/zones/index.js');

const numericConstant = (name) => {
  const match = arena.match(new RegExp(`const ${name} = ([\\d.]+);`));
  assert.ok(match, `${name} must remain an authored numeric constant`);
  return Number(match[1]);
};

const radius = numericConstant('ARENA_RADIUS');
const combatRadius = numericConstant('COMBAT_RADIUS');
const clearRadius = numericConstant('CENTER_CLEAR_RADIUS');
const spawnRadius = numericConstant('SPAWN_RADIUS');
const portalRadius = numericConstant('PORTAL_RADIUS');
const coverRadius = numericConstant('COVER_RADIUS');

assert.equal(radius, 32, 'Survival arena radius is the approved 32 metres');
assert.ok(clearRadius < coverRadius, 'sparse cover stays outside the center-clear disc');
assert.ok(coverRadius < spawnRadius, 'cover sits between the center and spawn band');
assert.ok(spawnRadius < portalRadius, 'spawn points sit inside their portal arches');
assert.ok(portalRadius < combatRadius, 'portal arches stay inside the combat bound');
assert.ok(combatRadius < radius, 'the combat bound stays inside the physical wall');

const laneBlock = arena.match(
  /const LANE_SPECS = Object\.freeze\(\[([\s\S]*?)\]\);/,
)?.[1];
assert.ok(laneBlock, 'authored Survival lane block must remain present');
const laneIds = [...laneBlock.matchAll(/\bid: '([^']+)'/g)].map((match) => match[1]);
const laneMotifs = [...laneBlock.matchAll(/\bmotif: '([^']+)'/g)].map((match) => match[1]);
assert.equal(laneIds.length, 6, 'Survival publishes six readable spawn lanes');
assert.equal(new Set(laneIds).size, 6, 'spawn lane IDs remain unique');
for (const motif of ['ponsia', 'liket', 'pananisia']) {
  assert.equal(
    laneMotifs.filter((entry) => entry === motif).length,
    2,
    `${motif} dressing owns two opposing lane reads`,
  );
}

assert.match(arena, /const angle = spec\.angle \+ Math\.PI \/ 6;/,
  'edge cover remains authored between the six spawn lanes');
assert.match(arena, /world\.survivalArena = SURVIVAL_ARENA;/);
assert.match(arena, /world\.survivalBounds = SURVIVAL_ARENA\.bounds;/);
assert.match(arena, /world\.survivalSpawnLanes = SURVIVAL_ARENA\.spawnLanes;/);
assert.match(arena, /world\.survivalLandmarks = SURVIVAL_ARENA\.landmarks;/);
assert.match(arena, /world\.survivalCover = SURVIVAL_ARENA\.cover;/);

const altarBlock = arena.match(
  /function buildMemoryAltar\(world, tierMaterials\) \{([\s\S]*?)\n\}/,
)?.[1];
assert.ok(altarBlock, 'altar builder must remain present');
assert.doesNotMatch(altarBlock, /addCollider/,
  'the altar remains non-colliding so the arena center stays unobstructed');

const tierBlock = arena.match(
  /function installTierPresentation\(world, tierMaterials\) \{([\s\S]*?)\n\}/,
)?.[1];
assert.ok(tierBlock, 'boss-tier presentation hook must remain present');
assert.match(tierBlock, /world\.setSurvivalBossTier/);
assert.doesNotMatch(tierBlock, /addCollider|survivalBounds|combatRadius/,
  'boss-tier shifts remain cosmetic and cannot alter gameplay bounds');

assert.match(arena, /id: 'survival'/);
assert.match(arena, /controller: 'survival'/);
assert.match(arena, /spawnGuardian: false/);
assert.match(registry, /import \{ survival \} from '\.\/survival\.js';/);
assert.match(registry, /\bsurvival,\n/);
assert.doesNotMatch(arena, /GLTFLoader|TextureLoader|https?:\/\//,
  'the arena uses existing procedural helpers and no external assets');

// --- boss waves are duels ---------------------------------------------------
// Survival opts every remixed Guardian out of its adds. Asserted on the source
// because the bosses import Three.js and cannot be constructed under Node.

const director = source('../src/core/survival/SurvivalBossDirector.js');
assert.equal(
  director.match(/^\s+allowSummons: false,$/gm)?.length,
  3,
  'all three Survival bosses (keeper, reveler, feastkeeper) fight without adds',
);

const bossBase = source('../src/core/arena/ArenaBoss.js');
assert.match(bossBase, /this\.allowSummons = options\.allowSummons !== false;/,
  'the summon gate defaults to on, so campaign fights keep their adds untouched');

const reveler = source('../src/core/arena/RevelerBoss.js');
const feastkeeper = source('../src/core/arena/FeastkeeperBoss.js');
const keeper = source('../src/core/arena/TowerKeeper.js');

// Every call that puts an add on the field must sit behind the gate. The Reveler
// has three: an interval clock plus two hardcoded statements (fight start and
// each enrage) that no tuning key could have reached.
assert.match(reveler, /_updateSummons\(dt\) \{\n\s*if \(!this\.allowSummons\) return;/,
  "the Reveler's summon clock is gated");
for (const group of ['spawnRandomGroup(2, 2)', 'spawnRandomGroup(3, 3)']) {
  assert.ok(
    reveler.includes(`if (this.allowSummons) this.combat.${group}`),
    `the Reveler's hardcoded ${group} is gated`,
  );
}
assert.equal(
  reveler.match(/this\.combat\.spawnRandomGroup\(/g)?.length,
  3,
  'no ungated spawnRandomGroup call has been added to the Reveler',
);
// Gated at `_summon`, the funnel — the Feastkeeper's enrage calls it directly, so
// a gate on `_tickSummons` alone let the phase-change crowd through.
assert.match(feastkeeper, /_summon\(count\) \{\n(\s*\/\/[^\n]*\n)*\s*if \(!this\.allowSummons\) return;/,
  "the Feastkeeper's summon funnel is gated, covering both the clock and the enrage");
assert.equal(
  feastkeeper.match(/this\.combat\.spawnExtra\(/g)?.length,
  1,
  'the Feastkeeper still has exactly one spawn funnel for the gate to cover',
);
assert.match(keeper, /if \(!this\.tuning\.SUMMON_INTERVAL \|\| !this\.allowSummons\) return;/,
  "the Keeper's summon clock is gated");
assert.match(keeper, /if \(this\.tuning\.SUMMON_ON_ENRAGE && this\.allowSummons\)/,
  "the Keeper's enrage summon is gated");

// Belt and braces: Survival's three boss-summon entry points each defer to the
// live boss's flag, so a new boss call site cannot reintroduce adds. Waves do not
// use these methods (they go through spawnWave/_queueRole), so this cannot starve
// a normal wave.
const survivalCombat = source('../src/core/survival/SurvivalCombatManager.js');
for (const method of ['spawnExtra', 'spawnRandomGroup', 'spawnBossGroup']) {
  assert.match(
    survivalCombat,
    new RegExp(`${method}\\([^)]*\\) \\{\\n\\s*if \\(this\\._summonsSuppressed\\) return;`),
    `${method} is gated at the manager, not just at each boss`,
  );
}
assert.match(survivalCombat, /get _summonsSuppressed\(\) \{\n\s*return !!this\.boss && this\.boss\.allowSummons === false;/,
  'suppression follows the live boss rather than inventing a second policy');

// --- regression: the boss must stay reachable through the target list -------
// `getPlayerAttackTargets` is the only way Survival's beam and pierced projectiles
// can find a boss. RevelerBoss composes its pattern targets into the list, so a
// base class that merely truncated to length 1 left a pattern's record parked in
// slot 0 — and after an Overload channel that record is a dead node, which is why
// the laser stopped damaging the Reveler for the rest of the fight.
assert.match(
  bossBase,
  /this\._playerAttackTargets\.length = 0;\s*\n\s*this\._playerAttackTargets\.push\(this\._playerAttackTarget\);/,
  'the base boss rebuilds its target list so slot 0 is always the boss',
);
assert.doesNotMatch(bossBase, /_playerAttackTargets\.length = 1/,
  'truncating to length 1 reintroduces the stale-slot-0 bug');
assert.match(reveler, /const targets = this\._revelerTargets;/,
  "the Reveler composes into its own array, never the base class's");
assert.match(reveler, /this\._revelerTargets = \[\];/,
  "the Reveler's target array is allocated once, not per query");
const revelerTargets = reveler.match(
  /getPlayerAttackTargets\(\) \{([\s\S]*?)\n  \}/,
)?.[1];
assert.ok(revelerTargets, "the Reveler's target composer must remain present");
assert.match(revelerTargets, /targets\.push\(bossTarget\);\s*\n\s*return targets;/,
  'the boss stays last, so pattern targets are still preferred when in front of it');

// --- beam presentation ------------------------------------------------------
const weapons = source('../src/core/survival/SurvivalWeapons.js');
assert.doesNotMatch(weapons, /LineBasicMaterial|new THREE\.Line\(/,
  'the beam is geometry, not a 1px line the GPU refuses to widen');
assert.match(weapons, /CylinderGeometry\(1, 1, 1/,
  'core and sleeve share one unit cylinder, scaled per frame');
assert.match(weapons, /this\._beamGeo\.dispose\(\);/,
  'the shared beam geometry is disposed exactly once');
const upgrades = source('../src/core/survival/SurvivalUpgrades.js');
assert.match(upgrades, /widthMultiplier: state\.weaponPath === 'laser'/,
  'Laser path mastery is visible in the beam width');

console.log('SurvivalArena tests passed');
