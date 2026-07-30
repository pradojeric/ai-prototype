// Survival briefing: the pre-run explanation shown before Wave 1, and the same
// content folded into the pause Lore tab. These tests exist because a briefing
// that quotes a stale rule is worse than none — every number must be derived.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SURVIVAL_BRIEFING,
  survivalBriefingLore,
} from '../src/core/survival/SurvivalBriefing.js';
import {
  isSurvivalBossWave,
  SURVIVAL_DRAFT_INTERVAL,
  SURVIVAL_FIRST_DRAFT_WAVE,
  SURVIVAL_THREAT_CAP,
} from '../src/core/survival/SurvivalRules.js';
import { buildPauseModel } from '../src/ui/_partials/pauseModel.js';
import { paintSurvivalBriefing } from '../src/ui/_partials/survivalBriefingView.js';

const allDetails = () => SURVIVAL_BRIEFING.sections
  .flatMap((section) => section.items.map((item) => `${item.term} ${item.detail}`))
  .join(' ');

function testCoversEveryPromisedTopic() {
  const ids = SURVIVAL_BRIEFING.sections.map((section) => section.id);
  assert.deepEqual(ids, ['loop', 'controls', 'scoring']);
  assert.ok(SURVIVAL_BRIEFING.narrative.length > 0, 'narrative framing is part of the brief');
  assert.ok(SURVIVAL_BRIEFING.action, 'the confirm button needs a label');

  // Controls: every binding the survival pause context lists must be taught here.
  const controls = SURVIVAL_BRIEFING.sections.find((s) => s.id === 'controls');
  const keys = new Set(controls.items.flatMap((item) => item.keys ?? []));
  for (const key of ['W', 'Q', 'Space', 'Hold Click', 'F', 'R', 'Esc']) {
    assert.ok(keys.has(key), `briefing must teach ${key}`);
  }

  // Scoring: the four columns the defeat ledger actually reports.
  const scoring = SURVIVAL_BRIEFING.sections.find((s) => s.id === 'scoring');
  const terms = scoring.items.map((item) => item.term.toLowerCase()).join(' ');
  for (const word of ['wave', 'time', 'echoes', 'guardians']) {
    assert.match(terms, new RegExp(word));
  }
}

function testNumbersAreDerivedFromRules() {
  const text = allDetails();
  assert.match(text, new RegExp(`Wave ${SURVIVAL_FIRST_DRAFT_WAVE}\\b`), 'first draft wave');
  assert.match(text, new RegExp(`\\b${SURVIVAL_THREAT_CAP}\\b`), 'threat cap');
  // No reroll cap is quoted on purpose — see the note in SurvivalBriefing.js.
  assert.match(text, /reroll/, 'rerolls must be explained');

  // The boss cadence must come from the rule, not a typed "10th".
  let firstBoss = 0;
  for (let wave = 1; wave <= 100 && !firstBoss; wave++) {
    if (isSurvivalBossWave(wave)) firstBoss = wave;
  }
  assert.ok(firstBoss > 0);
  assert.match(text, new RegExp(`${firstBoss}th wave`), `boss cadence must read as ${firstBoss}th`);
  assert.ok(
    SURVIVAL_DRAFT_INTERVAL === 1 || text.includes('wave'),
    'draft cadence must be described',
  );
}

// The mode is unlosable-to-explain only if the pause menu can re-show it: the
// overlay is gone once Wave 1 starts.
function testPauseLoreCarriesTheBriefing() {
  const entries = survivalBriefingLore();
  assert.equal(entries.length, SURVIVAL_BRIEFING.sections.length + 1);
  for (const entry of entries) {
    for (const field of ['id', 'name', 'subtitle', 'body']) {
      assert.ok(entry[field] !== undefined, `${field} is part of the lore-card contract`);
    }
    assert.ok(entry.body.length > 0, `${entry.id} must carry prose`);
  }

  const state = {
    phase: 'survival',
    zoneLabel: 'Endless Memory',
    zones: [],
    soulsFound: 0, soulsTotal: 3, soulsSeated: 0,
    zonesRestored: 0, zonesTotal: 3,
    survival: {
      wave: 4, remaining: 2, kills: 11, bossesDefeated: 0,
      activeSeconds: 95, weaponName: 'Light Bolt', build: { ranks: {} },
    },
    collection: [],
    lore: [],
  };
  const model = buildPauseModel(state);
  const names = model.lore.map((entry) => entry.name);
  assert.ok(names.includes(SURVIVAL_BRIEFING.title), 'survival pause lore leads with the briefing');
  for (const section of SURVIVAL_BRIEFING.sections) {
    assert.ok(names.includes(section.heading), `pause lore must carry "${section.heading}"`);
  }
  // A briefing card has nothing to restore, so it must not claim a count.
  const card = model.lore.find((entry) => entry.name === SURVIVAL_BRIEFING.title);
  assert.equal(card.countLabel, '');
  assert.equal(card.restored, false);

  // Outside Survival the tab is untouched.
  const explore = buildPauseModel({ ...state, phase: 'playing', survival: null });
  assert.deepEqual(explore.lore, []);
}

function testSurvivalControlsStillResolveDuringBriefing() {
  const base = {
    zoneLabel: 'Endless Memory', zones: [], soulsFound: 0, soulsTotal: 3,
    soulsSeated: 0, zonesRestored: 0, zonesTotal: 3, collection: [], lore: [],
  };
  const briefing = buildPauseModel({ ...base, phase: 'survivalBriefing', survival: null });
  const groups = briefing.controls.map((group) => group.group);
  assert.ok(groups.includes('Endless Combat'), 'briefing phase uses the survival control set');
}

// A DOM-free paint check: the view partial must survive a minimal document stub
// and must not invent content of its own.
function testPaintUsesOnlyBriefingContent() {
  const made = [];
  const node = () => {
    const el = {
      children: [], textContent: '', className: '',
      appendChild(child) { this.children.push(child); return child; },
      append(...kids) { this.children.push(...kids); },
    };
    made.push(el);
    return el;
  };
  const doc = { createElement: node };
  const elements = {
    document: doc,
    kicker: node(), title: node(), lede: node(), sections: node(),
    lineFil: node(), lineEng: node(), begin: node(),
  };
  assert.equal(paintSurvivalBriefing(elements), true);
  assert.equal(elements.title.textContent, SURVIVAL_BRIEFING.title);
  assert.equal(elements.begin.textContent, SURVIVAL_BRIEFING.action);
  assert.equal(elements.lede.children.length, SURVIVAL_BRIEFING.narrative.length);
  assert.equal(elements.sections.children.length, SURVIVAL_BRIEFING.sections.length);
  assert.equal(paintSurvivalBriefing({ document: null }), false);
}

// Wave 1 must not be armed while the briefing is up.
function testFlowHoldsWaveOneBehindTheBriefing() {
  const flow = readFileSync(
    new URL('../src/core/_partials/SurvivalFlow.js', import.meta.url),
    'utf8',
  );
  const startRun = flow.slice(flow.indexOf('_startSurvivalRun()'), flow.indexOf('_openSurvivalBriefing()'));
  assert.ok(
    !startRun.includes('this.survival.start()'),
    'run setup must not start waves — the briefing does',
  );
  assert.match(flow, /_beginSurvivalWaves\(\)[\s\S]*this\.survival\.start\(\)/);
  assert.match(flow, /'survivalBriefing',\n\s*'survival',/, 'briefing is a Survival phase');
}

testCoversEveryPromisedTopic();
testNumbersAreDerivedFromRules();
testPauseLoreCarriesTheBriefing();
testSurvivalControlsStillResolveDuringBriefing();
testPaintUsesOnlyBriefingContent();
testFlowHoldsWaveOneBehindTheBriefing();

console.log('Survival briefing tests passed');
