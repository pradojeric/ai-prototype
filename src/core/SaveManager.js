// ============================================================
// SAVE MANAGER — Firebase anonymous identity + Firestore cloud save
// ============================================================
// The GameOn Portal returns only an opaque session token (see APIManager), so
// it can never key a save. Anonymous Auth gives a stable `uid` with no sign-in
// friction, which is what lets the Firestore rules enforce real per-user
// ownership without a Cloud Function — this project stays buildless.
//
// Every path degrades to in-memory play: a blocked CDN, a rules rejection or an
// offline player must cost the session nothing but persistence. Firebase is
// imported lazily inside init() for exactly that reason — a failed module fetch
// must not take the game's entry chain down with it.
import { collectSaveState, applySaveState } from './_partials/saveState.js';

const SAVE_DEBOUNCE_MS = 2000;

// Firebase's auth codes are stable API; its messages are not player-facing.
const AUTH_MESSAGES = {
  'auth/email-already-in-use': 'That email already has a save. Use "Sign in" instead.',
  'auth/invalid-email': 'That does not look like an email address.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/missing-password': 'Enter a password.',
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/user-not-found': 'No save found for that email.',
  'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
  'auth/network-request-failed': 'No connection. Check your network and try again.',
  'auth/requires-recent-login': 'Please reload the page and try again.',
  'auth/credential-already-in-use': 'That email already has a save. Use "Sign in" instead.',
};

function authErrorMessage(error) {
  return AUTH_MESSAGES[error?.code] || 'Something went wrong. Please try again.';
}

export class SaveManager {
  constructor(config, dependencies = {}) {
    this.config = config || null;
    this.collection = config?.COLLECTION || 'progress';
    this.debounceMs = Number(config?.SAVE_DEBOUNCE_MS) > 0
      ? Number(config.SAVE_DEBOUNCE_MS)
      : SAVE_DEBOUNCE_MS;

    // Injected for tests; each defaults to the live browser/Firebase binding.
    this.loadFirebase = dependencies.loadFirebase || (() => this._importFirebase());
    this.setTimer = dependencies.setTimer || globalThis.setTimeout?.bind(globalThis);
    this.clearTimer = dependencies.clearTimer || globalThis.clearTimeout?.bind(globalThis);
    this.logger = dependencies.logger || console;

    this.uid = null;
    this.email = null;      // set once the account is linked (see linkEmail)
    this.auth = null;
    this.ready = false;
    this.docRef = null;
    this.sdk = null;
    this.saveTimer = null;
    this.pendingState = null;
    this.disposed = false;
  }

  get isConfigured() {
    return Boolean(this.config?.API_KEY && this.config?.PROJECT_ID);
  }

  /**
   * Sign in anonymously and read the player's document.
   * Resolves to the restored save data, or null when there is nothing to
   * restore or persistence is unavailable. Never rejects.
   */
  async init() {
    if (!this.isConfigured || this.disposed) return null;
    try {
      const sdk = await this.loadFirebase();
      if (this.disposed) return null;

      const app = sdk.initializeApp({
        apiKey: this.config.API_KEY,
        authDomain: this.config.AUTH_DOMAIN,
        projectId: this.config.PROJECT_ID,
        storageBucket: this.config.STORAGE_BUCKET,
        messagingSenderId: this.config.MESSAGING_SENDER_ID,
        appId: this.config.APP_ID,
      });
      this.auth = sdk.getAuth(app);
      // Restoring the persisted session is async. Without this wait currentUser
      // is still null, and a returning linked player would be handed a brand new
      // anonymous account — losing sight of their save entirely.
      await this.auth.authStateReady?.();
      if (this.disposed) return null;
      // A previous session (anonymous or linked) is still signed in here, so only
      // a genuinely new browser falls through to a fresh anonymous account.
      const user = this.auth.currentUser || (await sdk.signInAnonymously(this.auth))?.user;
      if (this.disposed) return null;
      if (!user?.uid) throw new Error('Sign-in returned no uid.');

      this.sdk = sdk;
      this.db = sdk.getFirestore(app);
      this._adoptUser(user);
      this.ready = true;
      return this.load();
    } catch (error) {
      this._logFailure('init', error);
      return null;
    }
  }

  /** Read the player's document. Returns validated data, or null. */
  async load() {
    if (!this.ready || this.disposed) return null;
    try {
      const snapshot = await this.sdk.getDoc(this.docRef);
      return snapshot.exists() ? snapshot.data() : null;
    } catch (error) {
      this._logFailure('load', error);
      return null;
    }
  }

  /**
   * Snapshot the game and schedule a write. Safe to call on every milestone —
   * bursts (a zone completing mid-collection) coalesce into one write.
   */
  queue(game) {
    if (!this.ready || this.disposed) return;
    this.pendingState = collectSaveState(game);
    if (this.saveTimer !== null) return;
    this.saveTimer = this.setTimer(() => {
      this.saveTimer = null;
      void this._flush();
    }, this.debounceMs);
  }

  /** Write any pending snapshot immediately. */
  async flushNow() {
    if (this.saveTimer !== null) {
      this.clearTimer?.(this.saveTimer);
      this.saveTimer = null;
    }
    return this._flush();
  }

  /**
   * Who the save belongs to, for the settings panel.
   * `anonymous` means device-only: losing this browser's storage loses the run.
   */
  accountState() {
    if (!this.isConfigured) return { state: 'unconfigured' };
    if (!this.ready) return { state: 'offline' };
    return this.email
      ? { state: 'linked', email: this.email }
      : { state: 'anonymous' };
  }

  /**
   * Upgrade the anonymous account to an email one, keeping the same uid — so the
   * existing document stays exactly where it is and nothing has to be migrated.
   * Returns { ok } or { ok: false, error } with a player-readable message.
   */
  async linkEmail(email, password) {
    if (!this.ready) return { ok: false, error: 'Cloud save is not available right now.' };
    if (this.email) return { ok: false, error: 'This run is already saved to an email.' };
    try {
      const credential = this.sdk.EmailAuthProvider.credential(email, password);
      const result = await this.sdk.linkWithCredential(this.auth.currentUser, credential);
      this._adoptUser(result.user);
      // Write immediately so the freshly-linked account never sits empty.
      await this.flushNow();
      return { ok: true };
    } catch (error) {
      this._logFailure('link_email', error);
      return { ok: false, error: authErrorMessage(error) };
    }
  }

  /**
   * Sign in to an existing email account on this device and load its save. The
   * uid changes, so the caller is expected to restart the session rather than
   * splice a foreign run into the running one.
   */
  async signInWithEmail(email, password) {
    if (!this.ready) return { ok: false, error: 'Cloud save is not available right now.' };
    try {
      const result = await this.sdk.signInWithEmailAndPassword(this.auth, email, password);
      this._adoptUser(result.user);
      return { ok: true };
    } catch (error) {
      this._logFailure('signin_email', error);
      return { ok: false, error: authErrorMessage(error) };
    }
  }

  /** Erase the player's saved run. Used by New Game. */
  async clearSave() {
    if (this.saveTimer !== null) {
      this.clearTimer?.(this.saveTimer);
      this.saveTimer = null;
    }
    this.pendingState = null;      // never let a queued write resurrect the run
    if (!this.ready || this.disposed) return false;
    try {
      await this.sdk.deleteDoc(this.docRef);
      return true;
    } catch (error) {
      this._logFailure('clear', error);
      return false;
    }
  }

  _adoptUser(user) {
    this.uid = user.uid;
    this.email = user.email || null;
    this.docRef = this.sdk.doc(this.db, this.collection, this.uid);
  }

  /** Restore a loaded document onto a Game. Delegates all validation. */
  restore(game, data) {
    return applySaveState(game, data);
  }

  dispose() {
    this.disposed = true;
    if (this.saveTimer !== null) {
      this.clearTimer?.(this.saveTimer);
      this.saveTimer = null;
    }
  }

  async _flush() {
    const state = this.pendingState;
    if (!state || !this.ready || this.disposed) return false;
    this.pendingState = null;
    try {
      await this.sdk.setDoc(this.docRef, state);
      return true;
    } catch (error) {
      this._logFailure('save', error);
      return false;
    }
  }

  async _importFirebase() {
    const [app, auth, firestore] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/firestore'),
    ]);
    return {
      initializeApp: app.initializeApp,
      getAuth: auth.getAuth,
      signInAnonymously: auth.signInAnonymously,
      EmailAuthProvider: auth.EmailAuthProvider,
      linkWithCredential: auth.linkWithCredential,
      signInWithEmailAndPassword: auth.signInWithEmailAndPassword,
      getFirestore: firestore.getFirestore,
      doc: firestore.doc,
      getDoc: firestore.getDoc,
      setDoc: firestore.setDoc,
      deleteDoc: firestore.deleteDoc,
    };
  }

  _logFailure(operation, error) {
    this.logger.warn({
      operation,
      message: error instanceof Error ? error.message : String(error),
    }, 'Cloud save unavailable; progress stays in memory.');
  }
}
