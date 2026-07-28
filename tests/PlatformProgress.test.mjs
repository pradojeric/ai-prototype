import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canUnlockPlatformArtifact,
  queuePlatformArtifactForCampaign,
} from '../src/core/_partials/PlatformProgress.js';

const ZONES = ['zone1', 'zone2', 'zone3'];

test('does not unlock for individual collections or an incomplete campaign', () => {
  assert.equal(canUnlockPlatformArtifact(ZONES, new Set(), true), false);
  assert.equal(canUnlockPlatformArtifact(ZONES, new Set(['zone1', 'zone2']), true), false);
});

test('unlocks when every real campaign zone is complete', () => {
  assert.equal(
    canUnlockPlatformArtifact(ZONES, new Set(['zone3', 'zone1', 'zone2']), true),
    true,
  );
});

test('rejects completion fabricated by debug or presenter progression shortcuts', () => {
  assert.equal(
    canUnlockPlatformArtifact(ZONES, new Set(['zone1', 'zone2', 'zone3']), false),
    false,
  );
});

test('rejects malformed or empty campaign definitions', () => {
  assert.equal(canUnlockPlatformArtifact([], new Set(), true), false);
  assert.equal(canUnlockPlatformArtifact(null, new Set(ZONES), true), false);
  assert.equal(canUnlockPlatformArtifact(ZONES, null, true), false);
});

test('queues exactly one request only when the campaign gate passes', () => {
  let requests = 0;
  const api = { requestArtifactUnlock: () => { requests += 1; } };

  assert.equal(
    queuePlatformArtifactForCampaign(api, ZONES, new Set(['zone1', 'zone2']), true),
    false,
  );
  assert.equal(requests, 0);
  assert.equal(
    queuePlatformArtifactForCampaign(api, ZONES, new Set(ZONES), false),
    false,
  );
  assert.equal(requests, 0);
  assert.equal(
    queuePlatformArtifactForCampaign(api, ZONES, new Set(ZONES), true),
    true,
  );
  assert.equal(requests, 1);
});
