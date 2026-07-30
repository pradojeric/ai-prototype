import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SurvivalUI,
  formatSurvivalTime,
  normalizeUpgradeRanks,
} from '../src/ui/SurvivalUI.js';

function testResultFormatting() {
  assert.equal(formatSurvivalTime(-10), '0:00');
  assert.equal(formatSurvivalTime(367), '6:07');
  assert.equal(formatSurvivalTime(3723), '1:02:03');

  assert.deepEqual(normalizeUpgradeRanks({
    primaryPower: 4,
    wovenWard: { name: 'Woven Ward', rank: 2 },
    unused: 0,
  }), [
    { id: 'primaryPower', name: 'Primary Power', rank: 4 },
    { id: 'wovenWard', name: 'Woven Ward', rank: 2 },
  ]);

  assert.deepEqual(normalizeUpgradeRanks([
    { id: 'dash-weave', title: 'Dash Weave', level: 3 },
    'vitality',
  ]), [
    { id: 'dash-weave', name: 'Dash Weave', rank: 3 },
    { id: 'vitality', name: 'Vitality', rank: 1 },
  ]);
}

function testPublicControllerContract() {
  for (const method of [
    'setCallbacks',
    'showHud',
    'updateHud',
    'hideHud',
    'showUpgradeDraft',
    'hideUpgradeDraft',
    'showBossStinger',
    'hideBossStinger',
    'playTitleCard',
    'hideTitleCard',
    'showBriefing',
    'hideBriefing',
    'focusBriefingAction',
    'showDefeat',
    'hideDefeat',
    'hideAll',
    'destroy',
  ]) {
    assert.equal(typeof SurvivalUI.prototype[method], 'function', `${method} must remain public`);
  }
}

function testMarkupContract() {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const requiredIds = [
    'ending-return',
    'survival-hud',
    'survival-wave',
    'survival-remaining',
    'survival-milestone',
    'survival-weapon',
    'survival-heat',
    'survival-dash',
    'survival-rerolls',
    'survival-health',
    'survival-briefing',
    'survival-briefing-title',
    'survival-briefing-lede',
    'survival-briefing-sections',
    'survival-briefing-begin',
    'survival-upgrade',
    'survival-upgrade-card-1',
    'survival-upgrade-card-2',
    'survival-upgrade-card-3',
    'survival-upgrade-reroll',
    'survival-boss-stinger',
    'survival-defeat',
    'survival-retry',
    'survival-defeat-return',
  ];

  for (const id of requiredIds) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `missing #${id}`);
  }
  assert.match(html, /_partials\/survival-mode\.css/);
  assert.match(html, /_partials\/survival-briefing\.css/);
  assert.match(
    html,
    /id="survival-briefing"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*inert/,
    'briefing must own modal input so Wave 1 cannot be played behind it',
  );
  assert.match(
    html,
    /id="survival-upgrade"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*inert/,
    'upgrade draft must own modal input',
  );
  assert.match(
    html,
    /id="survival-defeat"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*inert/,
    'defeat ledger must own modal input',
  );

  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'DOM IDs must remain unique');
}

testResultFormatting();
testPublicControllerContract();
testMarkupContract();

console.log('Survival UI tests passed');
