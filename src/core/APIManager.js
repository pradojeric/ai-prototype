// ============================================================
// API MANAGER — platform session authorization + artifact unlock
// ============================================================
const DEFAULT_STORAGE_KEYS = {
  sessionToken: 'strings.platformSessionToken',
  pendingUnlock: 'strings.platformPendingUnlock',
};

const PLACEHOLDER_VALUES = new Set(['YOUR_GAME_ID', 'YOUR_PLATFORM_API_URL']);

export class APIManager {
  constructor(config, dependencies = {}) {
    this.baseUrl = String(config.BASE_URL || '').replace(/\/$/, '');
    this.gameId = String(config.GAME_ID || '');
    this.pollIntervalMs = config.POLL_INTERVAL_MS || 3000;
    this.storageKeys = { ...DEFAULT_STORAGE_KEYS, ...config.STORAGE_KEYS };

    this.fetch = dependencies.fetch || globalThis.fetch?.bind(globalThis);
    this.storage = dependencies.storage || globalThis.sessionStorage;
    this.openWindow = dependencies.openWindow || globalThis.open?.bind(globalThis);
    this.setTimer = dependencies.setTimer || globalThis.setTimeout.bind(globalThis);
    this.clearTimer = dependencies.clearTimer || globalThis.clearTimeout.bind(globalThis);
    this.logger = dependencies.logger || console;
    this.AbortController = dependencies.AbortController || globalThis.AbortController;

    this.sessionToken = this._readStorage(this.storageKeys.sessionToken);
    this.signinUrl = null;
    this.pendingUnlock = this._readStorage(this.storageKeys.pendingUnlock) === '1';
    this.state = {
      connection: this.isConfigured ? (this.sessionToken ? 'pending' : 'disconnected') : 'unconfigured',
      unlock: this.pendingUnlock ? 'queued' : 'idle',
      error: null,
    };

    this.listeners = new Set();
    this.pollTimer = null;
    this.generation = 0;
    this.unlockPromise = null;
    this.authWindow = null;
    this.controllers = new Set();
    this.disposed = false;
  }

  get isConfigured() {
    return Boolean(
      this.baseUrl && this.gameId &&
      !PLACEHOLDER_VALUES.has(this.baseUrl) &&
      !PLACEHOLDER_VALUES.has(this.gameId) &&
      !this.baseUrl.includes('example.com'),
    );
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  getState() {
    return {
      ...this.state,
      signinUrl: this.signinUrl,
      configured: this.isConfigured,
    };
  }

  async restoreSession() {
    if (!this.isConfigured) {
      this._setState({ connection: 'unconfigured', error: null });
      return false;
    }
    if (!this.sessionToken) {
      this._setState({ connection: 'disconnected', error: null });
      return false;
    }

    this._setState({ connection: 'pending', error: null });
    return this.checkAuthorizationNow();
  }

  async connect() {
    if (!this.isConfigured) {
      this._setState({ connection: 'unconfigured', error: 'Platform connection is not configured.' });
      return false;
    }

    // Reserve the tab during the click's user-activation window. Navigating it after
    // the POST resolves avoids popup blockers without exposing the session token.
    let reservedWindow = null;
    try {
      reservedWindow = this.openWindow?.('about:blank', '_blank');
      if (reservedWindow) reservedWindow.opener = null;
    } catch (error) {
      // A blocked popup is recoverable: the same button becomes "Open sign-in".
    }
    return this._createSession(reservedWindow);
  }

  openSignIn() {
    if (!this.signinUrl || !this.openWindow) return false;
    try {
      const opened = this.openWindow(this.signinUrl, '_blank', 'noopener,noreferrer');
      if (opened) this.authWindow = opened;
      return Boolean(opened);
    } catch (error) {
      return false;
    }
  }

  async checkAuthorizationNow() {
    if (!this.sessionToken || this.disposed) return false;
    this._cancelPoll();
    return this._pollAuthorization(this.generation);
  }

  async requestArtifactUnlock() {
    this.pendingUnlock = true;
    this._writeStorage(this.storageKeys.pendingUnlock, '1');

    if (this.state.connection !== 'authorized') {
      this._setState({ unlock: 'queued' });
      return false;
    }
    if (this.unlockPromise) return this.unlockPromise;

    this._setState({ unlock: 'unlocking', error: null });
    this.unlockPromise = this._unlockArtifact();
    try {
      return await this.unlockPromise;
    } finally {
      this.unlockPromise = null;
    }
  }

  dispose() {
    this.disposed = true;
    this.generation += 1;
    this._cancelPoll();
    for (const controller of this.controllers) controller.abort();
    this.controllers.clear();
    this.listeners.clear();
  }

  async _createSession(reservedWindow = null) {
    this.generation += 1;
    const requestGeneration = this.generation;
    this._cancelPoll();
    this._clearSession();
    this._setState({ connection: 'creating', error: null });

    try {
      const response = await this._request(this._endpoint('/api/session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: this.gameId }),
      });
      const data = await this._readJson(response);
      if (!response.ok) throw new Error(`Session creation returned HTTP ${response.status}.`);
      const session = this._validateSessionResponse(data);
      if (requestGeneration !== this.generation || this.disposed) return false;

      this.sessionToken = session.sessionToken;
      this.signinUrl = session.signinUrl;
      this._writeStorage(this.storageKeys.sessionToken, this.sessionToken);
      this._setState({ connection: 'pending', error: null });
      this._navigateReservedWindow(reservedWindow, this.signinUrl);
      this._schedulePoll(requestGeneration);
      return true;
    } catch (error) {
      this._closeReservedWindow(reservedWindow);
      if (requestGeneration !== this.generation || this.disposed) return false;
      this._setState({ connection: 'error', error: 'Could not create a platform session.' });
      this._logFailure('create_session', error);
      return false;
    }
  }

  async _pollAuthorization(requestGeneration) {
    if (requestGeneration !== this.generation || !this.sessionToken || this.disposed) return false;

    try {
      const response = await this._request(this._endpoint('/api/session'), {
        method: 'GET',
        headers: this._authorizationHeaders(),
      });
      const data = await this._readJson(response);
      if (!response.ok) throw new Error(`Session status returned HTTP ${response.status}.`);
      if (requestGeneration !== this.generation || this.disposed) return false;

      if (data.status === 'pending') {
        this._setState({ connection: 'pending', error: null });
        this._schedulePoll(requestGeneration);
        return false;
      }
      if (data.status === 'authorized') {
        this._setState({ connection: 'authorized', error: null });
        if (this.pendingUnlock) await this.requestArtifactUnlock();
        return true;
      }
      if (data.status === 'expired') {
        this._setState({ connection: 'expired', error: null });
        await this._createSession(this.authWindow);
        return false;
      }
      throw new Error('Session status response contains an unsupported status.');
    } catch (error) {
      if (requestGeneration !== this.generation || this.disposed) return false;
      this._setState({ connection: 'error', error: 'Connection interrupted. Retrying…' });
      this._logFailure('poll_session', error);
      this._schedulePoll(requestGeneration);
      return false;
    }
  }

  async _unlockArtifact() {
    try {
      const response = await this._request(this._endpoint('/api/artifacts/unlock'), {
        method: 'POST',
        headers: this._authorizationHeaders(),
      });
      if (!response.ok) throw new Error(`Artifact unlock returned HTTP ${response.status}.`);

      this.pendingUnlock = false;
      this._removeStorage(this.storageKeys.pendingUnlock);
      this._setState({ unlock: 'unlocked', error: null });
      return true;
    } catch (error) {
      if (this.disposed) return false;
      this._setState({ unlock: 'error', error: 'Artifact unlock will be retried.' });
      this._logFailure('unlock_artifact', error);
      return false;
    }
  }

  _schedulePoll(requestGeneration) {
    this._cancelPoll();
    if (this.disposed) return;
    this.pollTimer = this.setTimer(() => {
      this.pollTimer = null;
      void this._pollAuthorization(requestGeneration);
    }, this.pollIntervalMs);
  }

  _cancelPoll() {
    if (this.pollTimer === null) return;
    this.clearTimer(this.pollTimer);
    this.pollTimer = null;
  }

  async _request(url, options) {
    if (!this.fetch) throw new Error('Fetch is unavailable.');
    if (!this.AbortController) return this.fetch(url, options);

    const controller = new this.AbortController();
    this.controllers.add(controller);
    try {
      return await this.fetch(url, { ...options, signal: controller.signal });
    } finally {
      this.controllers.delete(controller);
    }
  }

  async _readJson(response) {
    try {
      return await response.json();
    } catch (error) {
      throw new Error('Platform response is not valid JSON.');
    }
  }

  _authorizationHeaders() {
    return { Authorization: `Bearer ${this.sessionToken}` };
  }

  _validateSessionResponse(data) {
    if (typeof data.sessionToken !== 'string' || !data.sessionToken.trim() ||
        data.sessionToken.length > 4096 || typeof data.signinUrl !== 'string') {
      throw new Error('Session creation response is missing required fields.');
    }
    let signinUrl;
    try {
      signinUrl = new URL(data.signinUrl);
    } catch (error) {
      throw new Error('Session creation returned an invalid sign-in URL.');
    }
    if (signinUrl.protocol !== 'https:' && signinUrl.protocol !== 'http:') {
      throw new Error('Session creation returned an unsafe sign-in URL.');
    }
    return { sessionToken: data.sessionToken, signinUrl: signinUrl.href };
  }

  _endpoint(path) {
    return `${this.baseUrl}${path}`;
  }

  _navigateReservedWindow(reservedWindow, signinUrl) {
    if (!reservedWindow || reservedWindow.closed) return;
    this.authWindow = reservedWindow;
    try {
      reservedWindow.location.replace(signinUrl);
    } catch (error) {
      reservedWindow.location.href = signinUrl;
    }
  }

  _closeReservedWindow(reservedWindow) {
    try {
      if (reservedWindow && !reservedWindow.closed) reservedWindow.close();
    } catch (error) { /* browser owns popup lifecycle */ }
  }

  _clearSession() {
    this.sessionToken = null;
    this.signinUrl = null;
    this._removeStorage(this.storageKeys.sessionToken);
  }

  _setState(patch) {
    this.state = { ...this.state, ...patch };
    const snapshot = this.getState();
    for (const listener of this.listeners) listener(snapshot);
  }

  _readStorage(key) {
    try { return this.storage?.getItem(key) || null; } catch (error) { return null; }
  }

  _writeStorage(key, value) {
    try { this.storage?.setItem(key, value); } catch (error) { /* storage is optional */ }
  }

  _removeStorage(key) {
    try { this.storage?.removeItem(key); } catch (error) { /* storage is optional */ }
  }

  _logFailure(operation, error) {
    this.logger.warn({ operation, error }, 'Platform API request failed.');
  }
}
