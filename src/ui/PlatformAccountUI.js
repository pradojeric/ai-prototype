// ============================================================
// PLATFORM ACCOUNT UI — shared title/settings connection state
// ============================================================
export class PlatformAccountUI {
  constructor(api) {
    this.api = api;
    this.buttons = [...document.querySelectorAll('[data-platform-action]')];
    this.statuses = [...document.querySelectorAll('[data-platform-status]')];
    this._onAction = (event) => this._handleAction(event);

    for (const button of this.buttons) button.addEventListener('click', this._onAction);
    this.unsubscribe = this.api.subscribe((state) => this._render(state));
    void this.api.restoreSession();
  }

  dispose() {
    this.unsubscribe?.();
    for (const button of this.buttons) button.removeEventListener('click', this._onAction);
  }

  _handleAction(event) {
    event.stopPropagation();
    const state = this.api.getState();

    if (state.connection === 'authorized' && state.unlock === 'error') {
      void this.api.requestArtifactUnlock();
    } else if (state.connection === 'pending' && state.signinUrl) {
      this.api.openSignIn();
    } else if ((state.connection === 'pending' || state.connection === 'error') &&
               this.api.sessionToken) {
      void this.api.checkAuthorizationNow();
    } else {
      void this.api.connect();
    }
  }

  _render(state) {
    const view = this._viewFor(state);
    for (const button of this.buttons) {
      button.textContent = view.action;
      button.disabled = view.disabled;
      button.dataset.state = view.state;
    }
    for (const status of this.statuses) {
      status.textContent = view.status;
      status.dataset.state = view.state;
    }
  }

  _viewFor(state) {
    if (state.connection === 'unconfigured') {
      return this._view('Platform Not Configured', 'Add the platform URL and Game ID before deployment.', true, 'error');
    }
    if (state.connection === 'creating') {
      return this._view('Opening Platform…', 'Creating a secure authorization session.', true, 'pending');
    }
    if (state.connection === 'pending') {
      const action = state.signinUrl ? 'Open Platform Sign-in' : 'Check Authorization';
      return this._view(action, 'Waiting for authorization in your browser.', false, 'pending');
    }
    if (state.connection === 'expired') {
      return this._view('Renewing Session…', 'The platform session expired. Creating a new one.', true, 'pending');
    }
    if (state.connection === 'error') {
      const action = this.api.sessionToken ? 'Check Again' : 'Retry Connection';
      return this._view(action, state.error || 'Platform connection interrupted.', false, 'error');
    }
    if (state.connection === 'authorized') {
      if (state.unlock === 'unlocking') {
        return this._view('Platform Connected', 'Saving your platform artifact…', true, 'pending');
      }
      if (state.unlock === 'unlocked') {
        return this._view('Artifact Unlocked', 'Your platform artifact is safely unlocked.', true, 'success');
      }
      if (state.unlock === 'error') {
        return this._view('Retry Artifact Unlock', state.error || 'The unlock request needs another try.', false, 'error');
      }
      if (state.unlock === 'queued') {
        return this._view('Platform Connected', 'Connected. Your artifact unlock is queued.', true, 'success');
      }
      return this._view('Platform Connected', 'Account connected. Recover an artifact to unlock it.', true, 'success');
    }
    return this._view('Connect Platform Account', 'Not connected to the platform.', false, 'idle');
  }

  _view(action, status, disabled, state) {
    return { action, status, disabled, state };
  }
}
