import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { moveDashWithCollision } from '../src/core/survival/DashMotion.js';
import {
  SURVIVAL_DASH_DEFAULTS,
  advanceDashInvulnerability,
  beginDashInvulnerability,
} from '../src/core/survival/SurvivalDashRules.js';
import {
  SURVIVAL_REROLL_CAP,
  awardSurvivalBossReroll,
  spendSurvivalReroll,
} from '../src/core/survival/SurvivalRules.js';
import { createSurvivalBossOverride } from '../src/core/survival/SurvivalBossTuning.js';
import {
  canEnterSurvivalFromHub,
  isSurvivalPortalOpen,
} from '../src/core/survival/SurvivalEntryPolicy.js';
import { segmentSphereHitFraction } from '../src/core/survival/SurvivalProjectileRules.js';
import { buildPauseModel } from '../src/ui/_partials/pauseModel.js';

const source = (relativePath) => readFileSync(
  new URL(relativePath, import.meta.url),
  'utf8',
);

test('dash uses collision-safe substeps and the approved baseline distance', () => {
  const open = { x: 0, z: 0 };
  const travelled = moveDashWithCollision(
    open,
    { x: 1, z: 0 },
    SURVIVAL_DASH_DEFAULTS.distance,
    null,
    0,
    SURVIVAL_DASH_DEFAULTS.collisionStep,
  );
  assert.equal(travelled, 4.5);
  assert.equal(open.x, 4.5);

  const blocked = { x: 0, z: 0 };
  const stopped = moveDashWithCollision(
    blocked,
    { x: 1, z: 0 },
    SURVIVAL_DASH_DEFAULTS.distance,
    (x) => x >= 1,
    0,
    SURVIVAL_DASH_DEFAULTS.collisionStep,
  );
  assert.equal(stopped, 0.75);
  assert.equal(blocked.x, 0.75);
});

test('dash invulnerability is authoritative for exactly its configured window', () => {
  let remaining = beginDashInvulnerability();
  assert.equal(remaining, 0.22);
  remaining = advanceDashInvulnerability(remaining, 0.1);
  assert.ok(Math.abs(remaining - 0.12) < 1e-9);
  remaining = advanceDashInvulnerability(remaining, 0.12);
  assert.equal(remaining, 0);
  assert.equal(advanceDashInvulnerability(remaining, 5), 0);
});

test('dash movement never enters the stamina-draining sprint branch', () => {
  const player = source('../src/core/PlayerController.js');

  assert.match(player, /const dashing = this\._dashRemaining > 0/);
  assert.match(player, /this\.sprinting = !dashing && moveInput/);
  assert.ok(
    player.indexOf('const dashing = this._dashRemaining > 0') <
      player.indexOf('this.sprinting = !dashing && moveInput'),
  );
});

test('fast Survival projectiles use swept sphere collision', () => {
  const target = { x: 1, y: 0, z: 0 };
  assert.ok(
    Math.abs(
      segmentSphereHitFraction(
        { x: 0, y: 0, z: 0 },
        { x: 2.1, y: 0, z: 0 },
        target,
        0.6,
      ) - (1 - 0.6) / 2.1,
    ) < 1e-12,
  );
  assert.equal(
    segmentSphereHitFraction(
      { x: 0, y: 0, z: 0 },
      { x: 2.1, y: 0, z: 0 },
      { x: 1, y: 1, z: 0 },
      0.4,
    ),
    Infinity,
  );
});

test('Survival clips fast player projectiles against walls before target hits', () => {
  const combat = source('../src/core/survival/SurvivalCombatManager.js');
  assert.match(combat, /bolts\.update\(simDt, this\.world, true\)/);
  assert.match(combat, /_clipProjectileToWorld\(shot\)/);
  assert.match(combat, /this\.world\.collidesAt\(x, z, 0\.1, y\)/);
  assert.ok(
    combat.indexOf('_clipProjectileToWorld(shot)') <
      combat.indexOf('this._resolveProjectileSegment(shot)'),
  );
});

test('boss rewards earn one reroll, cap at two, and spend only one', () => {
  assert.equal(SURVIVAL_REROLL_CAP, 2);
  assert.equal(awardSurvivalBossReroll(0), 1);
  assert.equal(awardSurvivalBossReroll(1), 2);
  assert.equal(awardSurvivalBossReroll(2), 2);
  assert.equal(spendSurvivalReroll(2), 1);
  assert.equal(spendSurvivalReroll(0), 0);
});

test('boss victory removes hazards and adds before healing and drafting', () => {
  const controller = source('../src/core/survival/SurvivalController.js');
  const combat = source('../src/core/survival/SurvivalCombatManager.js');
  const body = controller.match(
    /_completeBossWave\(\) \{([\s\S]*?)\n  \}/,
  )?.[1] || '';
  const cleanup = body.indexOf('clearThreats({ immediate: true })');
  const disposeBoss = body.indexOf('disposeBoss()');
  const heal = body.indexOf('restoreBossVictoryHealth()');
  const reward = body.indexOf('awardSurvivalBossReroll');
  const draft = body.indexOf('_openUpgradeDraft()');

  assert.ok(cleanup >= 0);
  assert.ok(cleanup < disposeBoss && disposeBoss < heal);
  assert.ok(heal < reward && reward < draft);
  assert.match(combat, /if \(immediate\) this\.enemies\.length = 0/);
  assert.match(combat, /abortRun\(\)[\s\S]*clearThreats\(\{ immediate: true \}\)/);
});

test('Survival boss overrides are deeply immutable and leave authored tuning unchanged', () => {
  const authored = Object.freeze({
    HP: 200,
    ATTACK_INTERVAL: Object.freeze([4, 2]),
    FORMATION_DAMAGE: 15,
    REFLECT_DAMAGE: 4,
    NESTED: Object.freeze({
      DAMAGE: Object.freeze([10, 20]),
      COOLDOWN: 3,
    }),
  });
  const before = structuredClone(authored);
  const override = createSurvivalBossOverride(authored, {
    maxHp: 360,
    label: 'The Remixed Guardian',
    damageMultiplier: 1.5,
    attackIntervalMultiplier: 0.8,
  });

  assert.deepEqual(authored, before);
  assert.equal(override.HP, 360);
  assert.deepEqual(override.ATTACK_INTERVAL, [3.2, 1.6]);
  assert.equal(override.FORMATION_DAMAGE, 22.5);
  assert.equal(override.REFLECT_DAMAGE, 4, 'reflected player damage must not scale');
  assert.deepEqual(override.NESTED.DAMAGE, [15, 30]);
  assert.ok(Math.abs(override.NESTED.COOLDOWN - 2.4) < 1e-9);
  assert.equal(Object.isFrozen(override), true);
  assert.equal(Object.isFrozen(override.NESTED), true);
  assert.equal(Object.isFrozen(override.NESTED.DAMAGE), true);
});

test('the Endless Echoes arch opens after the ending or by debug unlock only', () => {
  assert.equal(isSurvivalPortalOpen(), false);
  assert.equal(isSurvivalPortalOpen({}), false);
  assert.equal(isSurvivalPortalOpen({ epilogueMode: true }), true);
  assert.equal(isSurvivalPortalOpen({ debugUnlocked: true }), true);
});

test('Survival entry policy accepts the museum hub and no other phase', () => {
  const open = { epilogueMode: true };
  for (const phase of [
    'title',
    'endingCredits',
    'endingPortal',
    'endingMuseum',
    'endingRestored',
    'survival',
    'survivalUpgrade',
    'survivalDefeat',
  ]) {
    assert.equal(canEnterSurvivalFromHub(phase, open), false, phase);
  }
  assert.equal(canEnterSurvivalFromHub('museum', open), true);
  // The hub alone is not enough — a sealed arch still refuses.
  assert.equal(canEnterSurvivalFromHub('museum', {}), false);

  const flow = source('../src/core/_partials/SurvivalFlow.js');
  const html = source('../index.html');
  assert.match(flow, /canEnterSurvivalFromHub\(this\.phase, this\._survivalPortalOptions\(\)\)/);
  assert.doesNotMatch(flow, /localStorage|queuePlatformArtifact|platformReward/);
  assert.match(html, /id="ending-credits"[^>]*aria-hidden="true"[^>]*inert/);
  // The credits button is gone; the arch is the only way in.
  assert.doesNotMatch(html, /id="ending-survival"/);
});

// config.js imports Three.js, so these Node tests read its numbers from source
// rather than importing MUSEUM (the same reason SurvivalRules.js inlines its RNG).
test('the arch stands clear of the lobby doorways and the intro camera path', () => {
  const config = source('../src/config.js');
  const num = (key) => {
    const match = config.match(new RegExp(`\\b${key}:\\s*(-?[\\d.]+)`));
    assert.ok(match, `config.js must define ${key}`);
    return Number(match[1]);
  };
  const roomHalf = num('ROOM_HALF');
  const galleryDoorHalf = Number(
    config.match(/GALLERY:[\s\S]*?DOOR_HALF:\s*(-?[\d.]+)/)[1],
  );
  const portal = config.match(/SURVIVAL_PORTAL:\s*\{([\s\S]*?)\n  \}/)[1];
  const pnum = (key) => Number(portal.match(new RegExp(`\\b${key}:\\s*(-?[\\d.]+)`))[1]);

  const x = pnum('X');
  const half = pnum('WIDTH') / 2;
  const z = roomHalf - pnum('INSET');

  // Clear of Zone 1's +Z gallery doorway, which sits centered at x = 0.
  assert.ok(Math.abs(x) - half > galleryDoorHalf);
  // Clear of the -X wall, and standing inside the lobby rather than through it.
  assert.ok(x - half > -roomHalf);
  assert.ok(z < roomHalf && z > 0);
  // Never on the intro cutscene's x = 0 camera path.
  assert.ok(Math.abs(x) > half);

  // Not a zone portal: it must stay enterable while epilogue mode seals those.
  const museum = source('../src/museum/Museum.js');
  assert.doesNotMatch(
    museum.match(/setEpilogueMode\([\s\S]*?\n  \}/)?.[0] || '',
    /survivalPortal/,
  );
  const game = source('../src/core/Game.js');
  assert.match(game, /arch\.enterable &&/);
});

test('retry clears player-owned motion, stamina, hop, dash, and queued input', () => {
  const flow = source('../src/core/_partials/SurvivalFlow.js');
  const player = source('../src/core/PlayerController.js');
  const reset = player.match(
    /resetSurvivalRunMobility\(\) \{([\s\S]*?)\n  \}/,
  )?.[1] || '';

  assert.match(flow, /this\.player\.resetSurvivalRunMobility\(\)/);
  assert.match(reset, /this\.resetInput\(\)/);
  assert.match(reset, /this\.clearExternalMotion\(\)/);
  assert.match(reset, /this\.setJumpEnabled\(false\)/);
  assert.match(reset, /this\.disableDash\(\)/);
  assert.match(reset, /this\.stamina = CONFIG\.STAMINA_MAX/);
});

test('Survival handoff clears input and epilogue cannot restart the ending', () => {
  const flow = source('../src/core/_partials/SurvivalFlow.js');
  const game = source('../src/core/Game.js');
  const teardown = flow.match(
    /_teardownSurvivalWorld\(\) \{([\s\S]*?)\n  \},/,
  )?.[1] || '';

  assert.match(teardown, /this\.player\.resetInput\(\)/);
  assert.match(teardown, /this\.player\.clearExternalMotion\(\)/);
  assert.match(
    flow,
    /_enterEpilogueMuseum\(\)[\s\S]*this\.player\.resetInput\(\)[\s\S]*this\.player\.controls\.lock\(\)/,
  );
  assert.match(game, /const ready = !epilogue && this\.museum\.allSoulsPlaced/);
  assert.match(game, /The Final Memory is restored/);
});

test('hidden Survival actions and modals become inert before focus is released', () => {
  const flow = source('../src/core/_partials/SurvivalFlow.js');
  const ui = source('../src/ui/SurvivalUI.js');

  assert.match(
    flow,
    /_hideEndingCreditsActions\(\)[\s\S]*setAttribute\('inert', ''\)[\s\S]*focused\.blur/,
  );
  assert.match(ui, /_showModal[\s\S]*removeAttribute\('inert'\)/);
  assert.match(
    ui,
    /_hideModal[\s\S]*setAttribute\('inert', ''\)[\s\S]*focused\.blur/,
  );
});

test('reduced-motion rules cover reused combat HUD pulses and pause entry', () => {
  const arenaHud = source('../_partials/arena-hud.css');
  const pauseMenu = source('../_partials/pause-menu.css');
  const reducedArena = arenaHud.match(
    /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/,
  )?.[1] || '';
  const reducedPause = pauseMenu.match(
    /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/,
  )?.[1] || '';

  assert.match(reducedArena, /#meleering\.ready \.prog/);
  assert.match(reducedArena, /#alab\.firing \.fill/);
  assert.match(reducedPause, /\.pause-shell \{ animation: none; \}/);
});

test('Survival boarders re-engage a mobile player after dash separation', () => {
  const railThreat = source('../src/core/arena/RailThreat.js');
  const combat = source('../src/core/survival/SurvivalCombatManager.js');

  assert.match(combat, /mobileTarget: true/);
  assert.match(
    railThreat,
    /this\.mobileTarget && this\._boardState !== 'approach'[\s\S]*BOARD_REENGAGE_RANGE/,
  );
  assert.match(railThreat, /this\.attackReady = false/);
});

test('Survival owns one spawn tear for every possible live or pending threat', () => {
  const combat = source('../src/core/survival/SurvivalCombatManager.js');
  const manager = source('../src/core/combat/CombatManager.js');
  const vfx = source('../src/core/combat/CombatVfx.js');
  const tear = source('../src/core/combat/ThreadTear.js');

  assert.match(combat, /tearPoolSize: SURVIVAL_THREAT_CAP/);
  assert.match(manager, /tearPoolSize: options\.tearPoolSize/);
  assert.match(vfx, /options\.tearPoolSize/);
  assert.match(tear, /this\.poolSize = Math\.max/);
  assert.match(tear, /tear\.serial \* this\.poolSize/);
});

test('campaign boss bolts retain their original non-kill Alab credit', () => {
  const boss = source('../src/core/arena/ArenaBoss.js');
  const campaignBolt = boss.match(
    /_testPlayerBolts\(\) \{([\s\S]*?)\n  \}/,
  )?.[1] || '';

  assert.match(campaignBolt, /creditKillBonus: false/);
  assert.match(
    boss,
    /registerPlayerBoltHit\(creditKillBonus && this\.defeated\)/,
  );
});

test('external Guardian attacks include every Reveler target and dynamic blocker', () => {
  const reveler = source('../src/core/arena/RevelerBoss.js');
  const pool = source('../src/core/arena/RevelerProjectilePool.js');
  const scatter = source('../src/core/arena/_partials/ScatterHex.js');
  const overload = source('../src/core/arena/_partials/OverloadChannel.js');
  const shell = source('../src/core/arena/_partials/ShellRotation.js');
  const combat = source('../src/core/survival/SurvivalCombatManager.js');
  const flow = source('../src/core/_partials/SurvivalFlow.js');

  for (const kind of [
    'reveler-formation',
    'reveler-scatter',
    'reveler-overload',
  ]) {
    assert.match(reveler, new RegExp(kind));
  }
  assert.match(pool, /appendPlayerAttackTargets/);
  assert.match(scatter, /appendPlayerAttackTargets/);
  assert.match(overload, /appendPlayerAttackTargets/);
  assert.match(overload, /_pickLiveSpot/);
  assert.match(overload, /beam\.quaternion\.setFromUnitVectors/);
  assert.match(shell, /worldToLocal/);
  assert.match(reveler, /resolvePlayerAttackImpact/);
  assert.match(combat, /resolvePlayerAttackImpact/);
  assert.match(combat, /target: bossTarget/);
  assert.match(combat, /target: nearestBossTarget/);
  assert.match(flow, /combat\?\.blocksPlayerAt/);
});

test('only active Survival joins pointer-lock pause phases', () => {
  const pauseSource = source('../src/core/_partials/GamePause.js');
  const pausable = pauseSource.match(
    /const PAUSABLE_PHASES = new Set\(\[([\s\S]*?)\]\);/,
  )?.[1] || '';
  const pointer = pauseSource.match(
    /const POINTER_PHASES = new Set\(\[([\s\S]*?)\]\);/,
  )?.[1] || '';
  assert.match(pausable, /'survival'/);
  assert.match(pointer, /'survival'/);
  for (const phase of ['survivalUpgrade', 'survivalDefeat']) {
    assert.doesNotMatch(pausable, new RegExp(`'${phase}'`));
    assert.doesNotMatch(pointer, new RegExp(`'${phase}'`));
  }
});

test('boss arrival stinger freezes look and movement without changing phase', () => {
  const controller = source('../src/core/survival/SurvivalController.js');
  const flow = source('../src/core/_partials/SurvivalFlow.js');

  assert.match(controller, /this\.player\.controls\.enabled = false/);
  assert.match(controller, /this\.player\.controls\.enabled = true/);
  assert.match(flow, /state !== 'bossStinger'\) this\.player\.update\(dt\)/);
});

test('pause model carries Survival location, wave, build, run, dash, and health', () => {
  const survival = {
    wave: 12,
    remaining: 4,
    nextMilestone: 'Upgrade at Wave 15',
    activeSeconds: 421,
    kills: 57,
    bossesDefeated: 1,
    weaponName: 'Continuous Laser',
    build: {
      weaponPath: 'laser',
      ranks: { vitality: 2, 'woven-ward': 1 },
    },
  };
  const model = buildPauseModel({
    phase: 'survival',
    zones: [],
    soulsFound: 3,
    soulsTotal: 3,
    soulsSeated: 3,
    zonesRestored: 3,
    zonesTotal: 3,
    health: { current: 73, max: 130 },
    jumpEnabled: true,
    survival,
    run: null,
    collection: [],
    lore: [],
  });

  assert.equal(model.location, 'Endless Memory');
  assert.equal(model.survival, survival);
  assert.equal(model.vitals[0].countLabel, '73 / 130');
  assert.match(model.objectives[0].label, /Wave 12/);
  assert.ok(model.controls.flatMap((group) => group.items)
    .some((item) => item.keys.includes('Q') && /Dash/.test(item.action)));
  assert.ok(model.run.some((row) => row.label === 'Current wave' && row.value === '12'));
  assert.ok(model.run.some((row) => (
    row.label === 'Primary thread' && row.value === 'Continuous Laser'
  )));
});
