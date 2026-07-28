import assert from 'node:assert/strict';
import test from 'node:test';
import { APIManager } from '../src/core/APIManager.js';

const CONFIG = {
  BASE_URL: 'https://gameonportal.ph',
  GAME_ID: 'strings-game',
  POLL_INTERVAL_MS: 3000,
};

function jsonResponse(data, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => data };
}

function invalidJsonResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => { throw new Error('not JSON'); },
  };
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

function createHarness(responses, options = {}) {
  const calls = [];
  const timers = [];
  const warnings = [];
  const navigations = [];
  const popup = {
    closed: false,
    opener: {},
    close() { this.closed = true; },
    location: {
      href: 'about:blank',
      replace(url) {
        this.href = url;
        navigations.push(url);
      },
    },
  };
  const storage = options.storage || createStorage();
  const fetch = options.fetch || (async (url, requestOptions) => {
    calls.push({ url, options: requestOptions });
    const response = responses.shift();
    if (response instanceof Error) throw response;
    if (!response) throw new Error('Unexpected fetch call.');
    return typeof response === 'function' ? response() : response;
  });
  const api = new APIManager(options.config || CONFIG, {
    fetch,
    storage,
    openWindow: options.popupBlocked ? () => null : () => popup,
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

test('creates a session with the exact GameOn endpoint and request body', async () => {
  const harness = createHarness([
    jsonResponse({
      sessionToken: 'secret-token',
      signinUrl: 'https://gameonportal.ph/signin/1',
    }),
  ]);

  assert.equal(await harness.api.connect(), true);
  assert.equal(harness.calls[0].url, 'https://gameonportal.ph/api/session');
  assert.equal(harness.calls[0].options.method, 'POST');
  assert.deepEqual(harness.calls[0].options.headers, { 'Content-Type': 'application/json' });
  assert.deepEqual(JSON.parse(harness.calls[0].options.body), { gameId: 'strings-game' });
  assert.equal(harness.storage.getItem('strings.platformSessionToken'), 'secret-token');
  assert.equal(harness.storage.values.has('strings.platformSigninUrl'), false);
  assert.deepEqual(harness.navigations, ['https://gameonportal.ph/signin/1']);
  assert.equal(harness.popup.opener, null);
  assert.equal(harness.timers[0].delay, 3000);
  assert.equal(harness.api.getState().connection, 'pending');
});

test('polls with a bearer token and flushes a queued campaign reward', async () => {
  const harness = createHarness([
    jsonResponse({
      sessionToken: 'secret-token',
      signinUrl: 'https://gameonportal.ph/signin/1',
    }),
    jsonResponse({ status: 'authorized' }),
    jsonResponse({ unlocked: true }),
  ]);

  assert.equal(await harness.api.requestArtifactUnlock(), false);
  assert.equal(harness.storage.getItem('strings.platformPendingUnlock'), '1');
  await harness.api.connect();
  assert.equal(await harness.api.checkAuthorizationNow(), true);

  assert.equal(harness.calls[1].url, 'https://gameonportal.ph/api/session');
  assert.equal(harness.calls[1].options.method, 'GET');
  assert.deepEqual(harness.calls[1].options.headers, {
    Authorization: 'Bearer secret-token',
    Accept: 'application/json',
  });
  assert.equal(harness.calls[2].url, 'https://gameonportal.ph/api/artifacts/unlock');
  assert.equal(harness.calls[2].options.method, 'POST');
  assert.deepEqual(harness.calls[2].options.headers, {
    Authorization: 'Bearer secret-token',
  });
  assert.equal('body' in harness.calls[2].options, false);
  assert.equal(harness.storage.getItem('strings.platformPendingUnlock'), null);
  assert.equal(harness.api.getState().unlock, 'unlocked');
});

test('continues polling every three seconds while authorization is pending', async () => {
  const harness = createHarness([
    jsonResponse({
      sessionToken: 'secret-token',
      signinUrl: 'https://gameonportal.ph/signin/1',
    }),
    jsonResponse({ status: 'pending' }),
  ]);

  await harness.api.connect();
  await harness.api.checkAuthorizationNow();

  const activeTimers = harness.timers.filter((timer) => !timer.cleared);
  assert.equal(activeTimers.length, 1);
  assert.equal(activeTimers[0].delay, 3000);
  assert.equal(harness.api.getState().connection, 'pending');
});

test('creates a replacement session after the platform reports expiration', async () => {
  const harness = createHarness([
    jsonResponse({
      sessionToken: 'token-1',
      signinUrl: 'https://gameonportal.ph/signin/1',
    }),
    jsonResponse({ status: 'expired' }),
    jsonResponse({
      sessionToken: 'token-2',
      signinUrl: 'https://gameonportal.ph/signin/2',
    }),
  ]);

  await harness.api.connect();
  assert.equal(await harness.api.checkAuthorizationNow(), false);

  assert.equal(harness.calls.length, 3);
  assert.equal(harness.calls[2].url, 'https://gameonportal.ph/api/session');
  assert.equal(harness.calls[2].options.method, 'POST');
  assert.equal(harness.api.sessionToken, 'token-2');
  assert.equal(harness.storage.getItem('strings.platformSessionToken'), 'token-2');
  assert.deepEqual(harness.navigations, [
    'https://gameonportal.ph/signin/1',
    'https://gameonportal.ph/signin/2',
  ]);
  assert.equal(harness.api.getState().connection, 'pending');
});

test('restores a stored token and checks authorization immediately', async () => {
  const storage = createStorage({ 'strings.platformSessionToken': 'restored-token' });
  const harness = createHarness(
    [jsonResponse({ status: 'authorized' })],
    { storage },
  );

  assert.equal(await harness.api.restoreSession(), true);
  assert.equal(harness.calls[0].options.method, 'GET');
  assert.equal(harness.calls[0].options.headers.Authorization, 'Bearer restored-token');
  assert.equal(harness.api.getState().connection, 'authorized');
  assert.deepEqual(harness.navigations, []);
});

test('coalesces concurrent duplicate campaign reward requests', async () => {
  let resolveUnlock;
  const unlockResponse = new Promise((resolve) => { resolveUnlock = resolve; });
  const harness = createHarness([
    jsonResponse({
      sessionToken: 'secret-token',
      signinUrl: 'https://gameonportal.ph/signin/1',
    }),
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

test('rejects unsafe or malformed session responses without storing tokens', async (t) => {
  await t.test('unsafe sign-in URL', async () => {
    const harness = createHarness([
      jsonResponse({ sessionToken: 'must-not-persist', signinUrl: 'javascript:alert(1)' }),
    ]);

    assert.equal(await harness.api.connect(), false);
    assert.equal(harness.api.getState().connection, 'error');
    assert.equal(harness.storage.getItem('strings.platformSessionToken'), null);
    assert.equal(harness.popup.closed, true);
    assert.equal(JSON.stringify(harness.warnings).includes('must-not-persist'), false);
  });

  await t.test('non-JSON response', async () => {
    const harness = createHarness([invalidJsonResponse()]);

    assert.equal(await harness.api.connect(), false);
    assert.equal(harness.api.getState().connection, 'error');
    assert.equal(harness.storage.getItem('strings.platformSessionToken'), null);
    assert.equal(harness.popup.closed, true);
  });
});

test('keeps popup-blocked sign-in recoverable after session creation', async () => {
  const harness = createHarness([
    jsonResponse({
      sessionToken: 'secret-token',
      signinUrl: 'https://gameonportal.ph/signin/1',
    }),
  ], { popupBlocked: true });

  assert.equal(await harness.api.connect(), true);
  assert.equal(harness.api.getState().signinUrl, 'https://gameonportal.ph/signin/1');
  assert.equal(harness.api.getState().connection, 'pending');
  assert.equal(harness.api.openSignIn(), false);
});

test('keeps a failed unlock queued and retries it without affecting authorization', async () => {
  const harness = createHarness([
    jsonResponse({
      sessionToken: 'secret-token',
      signinUrl: 'https://gameonportal.ph/signin/1',
    }),
    jsonResponse({ status: 'authorized' }),
    jsonResponse({ message: 'temporary failure' }, { ok: false, status: 503 }),
    jsonResponse({ unlocked: true }),
  ]);
  await harness.api.connect();
  await harness.api.checkAuthorizationNow();

  assert.equal(await harness.api.requestArtifactUnlock(), false);
  assert.equal(harness.storage.getItem('strings.platformPendingUnlock'), '1');
  assert.equal(harness.api.getState().connection, 'authorized');
  assert.equal(harness.api.getState().unlock, 'error');
  assert.equal(JSON.stringify(harness.warnings).includes('secret-token'), false);

  assert.equal(await harness.api.requestArtifactUnlock(), true);
  assert.equal(harness.storage.getItem('strings.platformPendingUnlock'), null);
  assert.equal(harness.api.getState().unlock, 'unlocked');
});

test('placeholder configuration performs no network or popup work', async () => {
  let fetchCalled = false;
  let popupCalled = false;
  const api = new APIManager({
    BASE_URL: 'https://gameonportal.ph',
    GAME_ID: 'YOUR_GAME_ID',
  }, {
    fetch: async () => { fetchCalled = true; },
    storage: createStorage(),
    openWindow: () => { popupCalled = true; },
  });

  assert.equal(await api.connect(), false);
  assert.equal(await api.requestArtifactUnlock(), false);
  assert.equal(fetchCalled, false);
  assert.equal(popupCalled, false);
  assert.equal(api.getState().connection, 'unconfigured');
  assert.equal(api.getState().unlock, 'queued');
});

test('dispose clears polling and aborts an in-flight request', async () => {
  let capturedSignal;
  let resolveFetch;
  const fetch = (url, options) => new Promise((resolve) => {
    capturedSignal = options.signal;
    resolveFetch = resolve;
  });
  const harness = createHarness([], { fetch });

  const connection = harness.api.connect();
  await Promise.resolve();
  assert.equal(capturedSignal.aborted, false);

  harness.api.dispose();
  assert.equal(capturedSignal.aborted, true);
  resolveFetch(jsonResponse({
    sessionToken: 'ignored-token',
    signinUrl: 'https://gameonportal.ph/signin/ignored',
  }));
  assert.equal(await connection, false);
  assert.equal(harness.storage.getItem('strings.platformSessionToken'), null);
});
