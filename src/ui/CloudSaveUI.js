// ============================================================
// CLOUD SAVE UI — settings-panel account controls
// ============================================================
// Anonymous saves are device-only: clear the browser's storage and the run is
// gone. Linking an email upgrades the *same* uid, so the existing document
// stays put, and signing in on another device adopts that account's save.
//
// Same shape as PlatformAccountUI: it owns only DOM and copy, and every
// decision about identity lives in SaveManager.
export class CloudSaveUI {
  constructor(save, { onAccountChanged } = {}) {
    this.save = save;
    this.onAccountChanged = onAccountChanged || (() => {});
    this.busy = false;      // an auth round trip is in flight

    this.section = document.getElementById('cloud-save');
    this.status = document.getElementById('cloud-status');
    this.form = document.getElementById('cloud-form');
    this.email = document.getElementById('cloud-email');
    this.password = document.getElementById('cloud-password');
    this.linkButton = document.getElementById('cloud-link');
    this.signInButton = document.getElementById('cloud-signin');
    if (!this.section) return;

    this.linkButton.addEventListener('click', (e) => {
      e.stopPropagation();
      void this._submit('link');
    });
    this.signInButton.addEventListener('click', (e) => {
      e.stopPropagation();
      void this._submit('signin');
    });
    // Enter anywhere in the form means "link" — the primary action here.
    this.form.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      void this._submit('link');
    });

    this.render();
  }

  /** Re-read SaveManager and repaint. Safe to call whenever the panel opens. */
  render(message = null, tone = null) {
    if (!this.section) return;
    const account = this.save.accountState();
    const linked = account.state === 'linked';
    const usable = account.state === 'anonymous' || linked;

    this.section.style.display = account.state === 'unconfigured' ? 'none' : '';
    this.form.style.display = linked ? 'none' : '';
    this.linkButton.disabled = this.busy || !usable;
    this.signInButton.disabled = this.busy || !usable;

    if (message) {
      this.status.textContent = message;
      this.status.dataset.tone = tone || '';
      return;
    }
    this.status.dataset.tone = linked ? 'success' : '';
    this.status.textContent = this._idleStatus(account);
  }

  _idleStatus(account) {
    if (account.state === 'offline') return 'Cloud save is unavailable — this run is memory-only.';
    if (account.state === 'linked') return `Saved to ${account.email}.`;
    return 'This run is saved to this browser only. Add an email to keep it if you '
      + 'switch device or clear your browser data.';
  }

  async _submit(action) {
    const email = this.email.value.trim();
    const password = this.password.value;
    if (!email || !password) {
      this.render('Enter an email and a password.', 'error');
      return;
    }

    this.busy = true;
    this.render(action === 'link' ? 'Saving…' : 'Signing in…');

    const result = action === 'link'
      ? await this.save.linkEmail(email, password)
      : await this.save.signInWithEmail(email, password);

    this.busy = false;
    if (!result.ok) {
      this.render(result.error, 'error');
      return;
    }

    this.password.value = '';
    if (action === 'link') {
      this.render();
      return;
    }
    // A sign-in swapped which account this browser is, so the loaded run is a
    // different one — the session has to restart rather than absorb it.
    this.render('Signed in. Loading that save…');
    this.onAccountChanged();
  }
}
