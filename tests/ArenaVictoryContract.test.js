import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (relativePath) => readFileSync(
  new URL(relativePath, import.meta.url),
  'utf8',
);
const config = source('../src/config.js');
const victoryBlock = config.match(
  /VICTORY:\s*\{([\s\S]*?)\n\s*\},\n\s*\/\/ The final boss phase/,
)?.[1];
assert.ok(victoryBlock, 'ARENA.VICTORY block must remain present');
const value = (key) => {
  const match = victoryBlock.match(new RegExp(`\\b${key}:\\s*([\\d.]+)`));
  assert.ok(match, `ARENA.VICTORY.${key} must remain numeric`);
  return Number(match[1]);
};
assert.ok(value('TOTAL') >= 5 && value('TOTAL') <= 6);
assert.ok(value('BURST_START') < value('IMPACT_END'));
assert.ok(value('IMPACT_END') < value('RIFT_START'));
assert.ok(value('RIFT_START') < value('BURST_END'));
assert.ok(value('BURST_END') < value('PULL_START'));
assert.ok(value('PULL_START') < value('RIFT_FULL'));
assert.ok(value('RIFT_FULL') < value('DISTORT_START'));
assert.ok(value('DISTORT_START') < value('FLASH_START'));
assert.ok(value('FLASH_START') < value('TOTAL'));
assert.ok(value('SHARD_COUNT') > 0);
assert.ok(value('MOTE_COUNT') > 0);

const cutscene = source('../src/cutscene/ArenaVictoryCutscene.js');
const rift = source('../src/cutscene/_partials/ArenaVictoryRift.js');
const flow = source('../src/core/_partials/ArenaFlow.js');
const game = source('../src/core/Game.js');
const keeper = source('../src/core/arena/KeeperArenaController.js');

assert.doesNotMatch(cutscene, /Math\.random/);
assert.doesNotMatch(rift, /Math\.random/);
for (const arenaId of ['arena1', 'arena2', 'arena3boss']) {
  assert.match(rift, new RegExp(`${arenaId}:\\s*\\{`));
}
assert.match(flow, /const arenaId = this\.currentZone/);
assert.match(flow, /this\.world = createWorld\(this\._returnZone\)/);
assert.match(flow, /this\.artifacts\.scatter\(origin\)/);
assert.match(flow, /new GuardianSoul\(/);
assert.doesNotMatch(flow, /ARENA\.COLLAPSE/);
assert.match(game, /this\.arenaVictoryCutscene\.update\(dt, t\)/);
assert.match(game, /updateVictoryVisual\?\.\(dt, t, victoryCamera\.position\)/);
assert.match(keeper, /updateVictoryVisual\(dt, t, facingTarget\)/);

console.log('ArenaVictoryContract tests passed');
