import assert from 'node:assert/strict';
import test from 'node:test';
import { SaveManager } from '../src/core/SaveManager.js';

const CONFIG = { API_KEY: 'k', PROJECT_ID: 'p', COLLECTION: 'progress', SAVE_DEBOUNCE_MS: 0 };

// A fake Firebase: enough surface for SaveManager, none of the network.
function fakeSdk({ currentUser = null, docs = new Map(), failLink = null } = {}) {
  const auth = { currentUser, authStateReady: async () => {} };
  let anonCounter = 0;
  const sdk = {
    docs,
    initializeApp: () => ({}),
    getAuth: () => auth,
    signInAnonymously: async () => {
      anonCounter += 1;
      auth.currentUser = { uid: `anon-${anonCounter}`, email: null, isAnonymous: true };
      return { user: auth.currentUser };
    },
    EmailAuthProvider: { credential: (email, password) => ({ email, password }) },
    linkWithCredential: async (user, credential) => {
      if (failLink) throw Object.assign(new Error('nope'), { code: failLink });
      auth.currentUser = { uid: user.uid, email: credential.email };
      return { user: auth.currentUser };
    },
    signInWithEmailAndPassword: async (_auth, email, password) => {
      if (password !== 'correct') {
        throw Object.assign(new Error('bad'), { code: 'auth/invalid-credential' });
      }
      auth.currentUser = { uid: `uid-for-${email}`, email };
      return { user: auth.currentUser };
    },
    getFirestore: () => ({}),
    doc: (_db, collection, uid) => `${collection}/${uid}`,
    getDoc: async (ref) => ({
      exists: () => docs.has(ref),
      data: () => docs.get(ref),
    }),
    setDoc: async (ref, value) => { docs.set(ref, value); },
    deleteDoc: async (ref) => { docs.delete(ref); },
  };
  return { sdk, auth };
}

const make = (options) => {
  const { sdk, auth } = fakeSdk(options);
  const save = new SaveManager(CONFIG, {
    loadFirebase: async () => sdk,
    setTimer: (fn) => { fn(); return 1; },
    clearTimer: () => {},
    logger: { warn() {} },
  });
  return { save, sdk, auth };
};

test('signs in anonymously and reports a device-only account', async () => {
  const { save } = make();
  assert.equal(await save.init(), null, 'a new player has no document');
  assert.equal(save.uid, 'anon-1');
  assert.deepEqual(save.accountState(), { state: 'anonymous' });
});

test('an already signed-in session is reused instead of making a new account', async () => {
  const { save, sdk } = make({ currentUser: { uid: 'returning', email: 'a@b.co' } });
  sdk.docs.set('progress/returning', { version: 1, collectedByZone: {} });

  const loaded = await save.init();
  assert.equal(save.uid, 'returning', 'must not mint a fresh anonymous uid');
  assert.deepEqual(loaded, { version: 1, collectedByZone: {} });
  assert.deepEqual(save.accountState(), { state: 'linked', email: 'a@b.co' });
});

test('linking an email keeps the uid, so the document never moves', async () => {
  const { save, sdk } = make();
  await save.init();
  save.queue({ collectedByZone: {}, collectedSouls: new Set(), completed: new Set() });

  const result = await save.linkEmail('player@example.com', 'hunter2');
  assert.equal(result.ok, true);
  assert.equal(save.uid, 'anon-1', 'the uid is what keeps the save in place');
  assert.deepEqual(save.accountState(), { state: 'linked', email: 'player@example.com' });
  assert.equal(sdk.docs.has('progress/anon-1'), true, 'linking flushes the pending write');
});

test('a link failure surfaces player-readable copy, not a Firebase code', async () => {
  const { save } = make({ failLink: 'auth/email-already-in-use' });
  await save.init();

  const result = await save.linkEmail('taken@example.com', 'hunter2');
  assert.equal(result.ok, false);
  assert.match(result.error, /already has a save/);
  assert.deepEqual(save.accountState(), { state: 'anonymous' }, 'a failed link changes nothing');
});

test('signing in adopts that account uid; a wrong password does not', async () => {
  const { save } = make();
  await save.init();

  const bad = await save.signInWithEmail('player@example.com', 'guess');
  assert.equal(bad.ok, false);
  assert.match(bad.error, /incorrect/);
  assert.equal(save.uid, 'anon-1');

  const good = await save.signInWithEmail('player@example.com', 'correct');
  assert.equal(good.ok, true);
  assert.equal(save.uid, 'uid-for-player@example.com');
});

test('New Game deletes the document and cancels any queued write', async () => {
  const { save, sdk } = make();
  await save.init();
  sdk.docs.set('progress/anon-1', { version: 1, collectedByZone: {} });

  // Debounce is immediate in this harness, so queue a write without flushing.
  save.pendingState = { version: 1, collectedByZone: { zone1: ['x'] } };
  assert.equal(await save.clearSave(), true);

  assert.equal(sdk.docs.has('progress/anon-1'), false);
  assert.equal(save.pendingState, null, 'a queued write must not resurrect the run');
  assert.equal(await save.flushNow(), false);
  assert.equal(sdk.docs.has('progress/anon-1'), false);
});

test('every account action degrades safely when Firebase never came up', async () => {
  const save = new SaveManager(CONFIG, {
    loadFirebase: async () => { throw new Error('CDN blocked'); },
    logger: { warn() {} },
  });

  assert.equal(await save.init(), null);
  assert.deepEqual(save.accountState(), { state: 'offline' });
  assert.equal((await save.linkEmail('a@b.co', 'pw')).ok, false);
  assert.equal((await save.signInWithEmail('a@b.co', 'pw')).ok, false);
  assert.equal(await save.clearSave(), false);
  assert.doesNotThrow(() => save.queue({ collectedByZone: {} }));
});

test('an unconfigured build never touches the network', async () => {
  let loaded = false;
  const save = new SaveManager({}, { loadFirebase: async () => { loaded = true; return {}; } });

  assert.equal(await save.init(), null);
  assert.equal(loaded, false);
  assert.deepEqual(save.accountState(), { state: 'unconfigured' });
});
