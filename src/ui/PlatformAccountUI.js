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
      return this._view(
        'GameOn Not Configured',
        'Add the assigned Game ID before deployment.',
        true,
        'error',
      );
    }
    if (state.connection === 'creating') {
      return this._view(
        'Opening GameOn…',
        'Creating a secure authorization session.',
        true,
        'pending',
      );
    }
    if (state.connection === 'pending') {
      const action = state.signinUrl ? 'Open GameOn Sign-in' : 'Check Authorization';
      return this._view(action, 'Waiting for browser authorization.', false, 'pending');
    }
    if (state.connection === 'expired') {
      return this._view(
        'Renewing Session…',
        'The GameOn session expired. Creating a replacement.',
        true,
        'pending',
      );
    }
    if (state.connection === 'error') {
      const action = this.api.sessionToken ? 'Check Again' : 'Retry Connection';
      return this._view(
        action,
        state.error || 'GameOn connection interrupted.',
        false,
        'error',
      );
    }
    if (state.connection === 'authorized') {
      if (state.unlock === 'unlocking') {
        return this._view('GameOn Connected', 'Claiming your campaign reward…', true, 'pending');
      }
      if (state.unlock === 'unlocked') {
        return this._view('Reward Unlocked', 'Your GameOn artifact is unlocked.', true, 'success');
      }
      if (state.unlock === 'error') {
        return this._view(
          'Retry Reward Unlock',
          state.error || 'The reward request needs another try.',
          false,
          'error',
        );
      }
      if (state.unlock === 'queued') {
        return this._view('GameOn Connected', 'Your campaign reward is queued.', true, 'success');
      }
      return this._view(
        'GameOn Connected',
        'Complete all three zones to unlock the platform artifact.',
        true,
        'success',
      );
    }
    if (state.unlock === 'queued') {
      return this._view(
        'Connect to Claim Reward',
        'Campaign complete. Connect GameOn to claim your artifact.',
        false,
        'pending',
      );
    }
    return this._view(
      'Connect GameOn Account',
      'Optional: connect now to claim the full-campaign reward.',
      false,
      'idle',
    );
  }

  _view(action, status, disabled, state) {
    return { action, status, disabled, state };
  }
}
