import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SAVE_VERSION,
  collectSaveState,
  applySaveState,
  isValidSave,
  hasProgress,
} from '../src/core/_partials/saveState.js';
import { ARTIFACT_DATA } from '../src/data/artifacts.js';

const zoneArtifacts = (zone) => ARTIFACT_DATA.filter((a) => a.zone === zone).map((a) => a.id);

function fakeGame(overrides = {}) {
  return {
    collectedByZone: { zone1: new Set(), zone2: new Set(), zone3: new Set() },
    collectedSouls: new Set(),
    completed: new Set(),
    endingPlayed: false,
    platformRewardEligible: true,
    ...overrides,
  };
}

test('round-trips a partially finished campaign', () => {
  const [first, second] = zoneArtifacts(1);
  const source = fakeGame({
    collectedByZone: { zone1: new Set([first, second]), zone2: new Set(), zone3: new Set() },
    collectedSouls: new Set(['zone1']),
    completed: new Set(['zone1']),
  });

  const target = fakeGame();
  assert.equal(applySaveState(target, collectSaveState(source)), true);

  assert.deepEqual([...target.collectedByZone.zone1].sort(), [first, second].sort());
  assert.deepEqual([...target.collectedSouls], ['zone1']);
  assert.deepEqual([...target.completed], ['zone1']);
  assert.equal(target.endingPlayed, false);
});

test('mutates the existing Sets so ArtifactManager keeps its reference', () => {
  const target = fakeGame();
  const zone1Set = target.collectedByZone.zone1;
  const [id] = zoneArtifacts(1);

  applySaveState(target, {
    version: SAVE_VERSION,
    collectedByZone: { zone1: [id] },
    collectedSouls: [],
    completed: [],
  });

  assert.equal(target.collectedByZone.zone1, zone1Set, 'the Set object must be reused');
  assert.equal(zone1Set.has(id), true);
});

test('a restore replaces rather than merges into existing progress', () => {
  const all = zoneArtifacts(1);
  const target = fakeGame({
    collectedByZone: { zone1: new Set(all), zone2: new Set(), zone3: new Set() },
  });

  applySaveState(target, {
    version: SAVE_VERSION,
    collectedByZone: { zone1: [all[0]] },
    collectedSouls: [],
    completed: [],
  });

  assert.deepEqual([...target.collectedByZone.zone1], [all[0]]);
});

test('rejects malformed and version-mismatched documents', () => {
  assert.equal(isValidSave(null), false);
  assert.equal(isValidSave({}), false);
  assert.equal(isValidSave({ version: SAVE_VERSION + 1, collectedByZone: {} }), false);
  assert.equal(isValidSave({ version: SAVE_VERSION, collectedByZone: {} }), true);

  const target = fakeGame();
  assert.equal(applySaveState(target, { version: 999, collectedByZone: {} }), false);
  assert.equal(target.collectedByZone.zone1.size, 0, 'a rejected save must not touch the session');
});

test('drops artifact ids that do not exist, or belong to another zone', () => {
  const zone2Id = zoneArtifacts(2)[0];
  const target = fakeGame();

  applySaveState(target, {
    version: SAVE_VERSION,
    collectedByZone: { zone1: ['not-a-real-artifact', zone2Id], zone9: ['anything'] },
    collectedSouls: ['zone1', 'zone42'],
    completed: [],
  });

  assert.equal(target.collectedByZone.zone1.size, 0);
  assert.equal(target.collectedByZone.zone9, undefined);
  assert.deepEqual([...target.collectedSouls], ['zone1']);
});

test('a completion without its Soul cannot be claimed', () => {
  const target = fakeGame();

  applySaveState(target, {
    version: SAVE_VERSION,
    collectedByZone: {},
    collectedSouls: ['zone1'],
    completed: ['zone1', 'zone2', 'zone3'],
  });

  assert.deepEqual([...target.completed], ['zone1'],
    'zone2/zone3 had no Soul, so their completion is not corroborated');
});

test('reward ineligibility survives a save/restore round trip', () => {
  const soured = fakeGame({ platformRewardEligible: false });
  const state = collectSaveState(soured);
  assert.equal(state.rewardEligible, false);

  const target = fakeGame();
  applySaveState(target, state);
  assert.equal(target.platformRewardEligible, false,
    'a debug-fabricated run must not launder itself clean through a reload');
});

test('Continue is offered only for a run with something to resume', () => {
  const [id] = zoneArtifacts(1);

  assert.equal(hasProgress(fakeGame()), false, 'a fresh session is a new game');
  assert.equal(hasProgress({}), false);
  assert.equal(hasProgress(undefined), false);

  assert.equal(hasProgress(fakeGame({
    collectedByZone: { zone1: new Set([id]), zone2: new Set(), zone3: new Set() },
  })), true, 'one recovered memory is worth resuming');

  assert.equal(hasProgress(fakeGame({ collectedSouls: new Set(['zone1']) })), true);
  assert.equal(hasProgress(fakeGame({ completed: new Set(['zone1']) })), true);
});

test('an empty save document still reads as a new game', () => {
  // A player who signed in and quit before recovering anything has a document,
  // but no run — the title must still say Start and play the intro.
  const target = fakeGame();
  applySaveState(target, collectSaveState(fakeGame()));
  assert.equal(hasProgress(target), false);
});

test('a clean run stays reward eligible', () => {
  const target = fakeGame();
  applySaveState(target, collectSaveState(fakeGame()));
  assert.equal(target.platformRewardEligible, true);
});
