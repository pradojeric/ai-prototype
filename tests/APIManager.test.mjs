import assert from 'node:assert/strict';
import test from 'node:test';
import { APIManager } from '../src/core/APIManager.js';

const CONFIG = {
  BASE_URL: 'https://platform.test',
  GAME_ID: 'strings-game',
  POLL_INTERVAL_MS: 3000,
};

function jsonResponse(data, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => data };
}

function createStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    values,
  };
}

function createHarness(responses, storage = createStorage()) {
  const calls = [];
  const timers = [];
  const warnings = [];
  const navigations = [];
  const popup = {
    closed: false,
    close() { this.closed = true; },
    location: {
      href: 'about:blank',
      replace(url) {
        this.href = url;
        navigations.push(url);
      },
    },
  };
  const fetch = async (url, options) => {
    calls.push({ url, options });
    const response = responses.shift();
    if (response instanceof Error) throw response;
    if (!response) throw new Error('Unexpected fetch call.');
    return typeof response === 'function' ? response() : response;
  };
  const api = new APIManager(CONFIG, {
    fetch,
    storage,
    openWindow: () => popup,
    setTimer: (callback, delay) => {
      const timer = { callback, delay, cleared: false };
      timers.push(timer);
      return timer;
    },
    clearTimer: (timer) => { timer.cleared = true; },
    logger: { warn: (...args) => warnings.push(args) },
  });
  return { api, calls, navigations, popup, storage, timers, warnings };
}

test('creates a session, stores only its token, opens sign-in, and schedules polling', async () => {
  const harness = createHarness([
    jsonResponse({ sessionToken: 'secret-token', signinUrl: 'https://platform.test/signin/1' }),
  ]);

  assert.equal(await harness.api.connect(), true);
  assert.equal(harness.calls[0].url, 'https://platform.test/api/session');
  assert.equal(harness.calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(harness.calls[0].options.body), { gameId: 'strings-game' });
  assert.equal(harness.storage.getItem('strings.platformSessionToken'), 'secret-token');
  assert.equal(harness.storage.values.has('strings.platformSigninUrl'), false);
  assert.deepEqual(harness.navigations, ['https://platform.test/signin/1']);
  assert.equal(harness.timers[0].delay, 3000);
  assert.equal(harness.api.getState().connection, 'pending');
});

test('polls with the bearer token and flushes an unlock queued before authorization', async () => {
  const harness = createHarness([
    jsonResponse({ sessionToken: 'secret-token', signinUrl: 'https://platform.test/signin/1' }),
    jsonResponse({ status: 'authorized' }),
    jsonResponse({ unlocked: true }),
  ]);

  assert.equal(await harness.api.requestArtifactUnlock(), false);
  assert.equal(harness.storage.getItem('strings.platformPendingUnlock'), '1');
  await harness.api.connect();
  assert.equal(await harness.api.checkAuthorizationNow(), true);

  assert.equal(harness.calls[1].options.method, 'GET');
  assert.equal(harness.calls[1].options.headers.Authorization, 'Bearer secret-token');
  assert.equal(harness.calls[2].url, 'https://platform.test/api/artifacts/unlock');
  assert.equal(harness.calls[2].options.method, 'POST');
  assert.equal(harness.calls[2].options.headers.Authorization, 'Bearer secret-token');
  assert.equal('body' in harness.calls[2].options, false);
  assert.equal(harness.storage.getItem('strings.platformPendingUnlock'), null);
  assert.equal(harness.api.getState().unlock, 'unlocked');
});

test('continues polling every three seconds while authorization is pending', async () => {
  const harness = createHarness([
    jsonResponse({ sessionToken: 'secret-token', signinUrl: 'https://platform.test/signin/1' }),
    jsonResponse({ status: 'pending' }),
  ]);

  await harness.api.connect();
  await harness.api.checkAuthorizationNow();

  const activeTimers = harness.timers.filter((timer) => !timer.cleared);
  assert.equal(activeTimers.length, 1);
  assert.equal(activeTimers[0].delay, 3000);
  assert.equal(harness.api.getState().connection, 'pending');
});

test('creates a replacement session when status is expired', async () => {
  const harness = createHarness([
    jsonResponse({ sessionToken: 'token-1', signinUrl: 'https://platform.test/signin/1' }),
    jsonResponse({ status: 'expired' }),
    jsonResponse({ sessionToken: 'token-2', signinUrl: 'https://platform.test/signin/2' }),
  ]);

  await harness.api.connect();
  assert.equal(await harness.api.checkAuthorizationNow(), false);

  assert.equal(harness.calls.length, 3);
  assert.equal(harness.calls[2].options.method, 'POST');
  assert.equal(harness.api.sessionToken, 'token-2');
  assert.equal(harness.storage.getItem('strings.platformSessionToken'), 'token-2');
  assert.deepEqual(harness.navigations, [
    'https://platform.test/signin/1',
    'https://platform.test/signin/2',
  ]);
  assert.equal(harness.api.getState().connection, 'pending');
});

test('restores a token from session storage and checks its status immediately', async () => {
  const storage = createStorage({ 'strings.platformSessionToken': 'restored-token' });
  const harness = createHarness([jsonResponse({ status: 'authorized' })], storage);

  assert.equal(await harness.api.restoreSession(), true);
  assert.equal(harness.calls[0].options.method, 'GET');
  assert.equal(harness.calls[0].options.headers.Authorization, 'Bearer restored-token');
  assert.equal(harness.api.getState().connection, 'authorized');
  assert.deepEqual(harness.navigations, []);
});

test('coalesces concurrent duplicate artifact unlock requests', async () => {
  let resolveUnlock;
  const unlockResponse = new Promise((resolve) => { resolveUnlock = resolve; });
  const harness = createHarness([
    jsonResponse({ sessionToken: 'secret-token', signinUrl: 'https://platform.test/signin/1' }),
    jsonResponse({ status: 'authorized' }),
    () => unlockResponse,
  ]);
  await harness.api.connect();
  await harness.api.checkAuthorizationNow();

  const first = harness.api.requestArtifactUnlock();
  const second = harness.api.requestArtifactUnlock();
  assert.equal(harness.calls.length, 3);
  resolveUnlock(jsonResponse({ unlocked: true }));
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.equal(harness.calls.length, 3);
});

test('rejects unsafe sign-in URLs and never stores the returned token', async () => {
  const harness = createHarness([
    jsonResponse({ sessionToken: 'must-not-persist', signinUrl: 'javascript:alert(1)' }),
  ]);

  assert.equal(await harness.api.connect(), false);
  assert.equal(harness.api.getState().connection, 'error');
  assert.equal(harness.storage.getItem('strings.platformSessionToken'), null);
  assert.equal(harness.popup.closed, true);
  assert.equal(JSON.stringify(harness.warnings).includes('must-not-persist'), false);
});

test('keeps a failed unlock queued and exposes a retryable state', async () => {
  const harness = createHarness([
    jsonResponse({ sessionToken: 'secret-token', signinUrl: 'https://platform.test/signin/1' }),
    jsonResponse({ status: 'authorized' }),
    jsonResponse({ message: 'temporary failure' }, { ok: false, status: 503 }),
  ]);
  await harness.api.connect();
  await harness.api.checkAuthorizationNow();

  assert.equal(await harness.api.requestArtifactUnlock(), false);
  assert.equal(harness.storage.getItem('strings.platformPendingUnlock'), '1');
  assert.equal(harness.api.getState().unlock, 'error');
  assert.equal(JSON.stringify(harness.warnings).includes('secret-token'), false);
});

test('placeholder configuration performs no network or popup work', async () => {
  let fetchCalled = false;
  let popupCalled = false;
  const api = new APIManager({ BASE_URL: 'YOUR_PLATFORM_API_URL', GAME_ID: 'YOUR_GAME_ID' }, {
    fetch: async () => { fetchCalled = true; },
    storage: createStorage(),
    openWindow: () => { popupCalled = true; },
  });

  assert.equal(await api.connect(), false);
  assert.equal(fetchCalled, false);
  assert.equal(popupCalled, false);
  assert.equal(api.getState().connection, 'unconfigured');
});
