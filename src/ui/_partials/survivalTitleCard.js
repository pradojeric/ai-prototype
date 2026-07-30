// ============================================================
// SURVIVAL TITLE CARD — the mode's name on black, before the briefing
// ============================================================
// A tiny self-contained overlay driver: fade in, hold, fade out, resolve. It is
// deliberately NOT one of SurvivalUI's modals — there is nothing focusable on it,
// so routing it through _showModal would only hand it a focus trap it cannot use
// and steal the `_activeModal` slot the briefing wants next.
//
// Timing lives in CONFIG.SURVIVAL_TITLE but is INJECTED by SurvivalFlow rather
// than imported: config.js pulls in `three`, and every UI partial stays
// import-clean so it can be unit-tested under Node against a fake document.
// The chosen fade is pushed into CSS as `--survival-title-fade` per phase, so the
// JS timers and the transitions read the same numbers instead of drifting apart.

// Mirrors CONFIG.SURVIVAL_TITLE; only reached when no timing is passed in.
const FALLBACK_TIMING = Object.freeze({
  FADE_IN: 0.9,
  HOLD: 1.7,
  FADE_OUT: 0.9,
  SKIP_AFTER: 0.45,
  SKIP_FADE: 0.25,
});

const seconds = (value, fallback) => (Number.isFinite(value) && value >= 0 ? value : fallback);

export class SurvivalTitleCard {
  constructor(documentRef = globalThis.document) {
    this.document = documentRef;
    this.overlay = documentRef?.getElementById?.('survival-title') ?? null;
    this.kicker = documentRef?.getElementById?.('survival-title-kicker') ?? null;
    this.name = documentRef?.getElementById?.('survival-title-name') ?? null;

    this._timers = [];
    this._resolve = null;
    this._skipHandler = null;
    this._skipArmed = false;
    this._timing = FALLBACK_TIMING;
  }

  get active() {
    return this._resolve !== null;
  }

  // Resolves when the card is off screen — `true` if it played out, `false` if it
  // was skipped or cancelled — so the caller can simply await it before opening
  // the briefing. Missing DOM resolves immediately rather than stalling entry.
  play({ kicker = '', title = '', timing = null } = {}) {
    if (!this.overlay) return Promise.resolve(false);
    // A second entry while one card is up (retry pressed twice) collapses the
    // first rather than stacking timers on the same element.
    if (this.active) this.cancel();

    if (this.kicker) this.kicker.textContent = String(kicker);
    if (this.name) this.name.textContent = String(title);

    this._timing = timing ?? FALLBACK_TIMING;
    const fadeIn = seconds(this._timing.FADE_IN, FALLBACK_TIMING.FADE_IN);
    const hold = seconds(this._timing.HOLD, FALLBACK_TIMING.HOLD);
    const fadeOut = seconds(this._timing.FADE_OUT, FALLBACK_TIMING.FADE_OUT);
    const skipAfter = seconds(this._timing.SKIP_AFTER, FALLBACK_TIMING.SKIP_AFTER);

    this._setFade(fadeIn);
    this.overlay.hidden = false;
    this.overlay.setAttribute('aria-hidden', 'false');
    this.overlay.classList.remove('can-skip');
    // Flush the hidden→visible layout so the opacity transition has a start
    // value to animate from (same trick as SurvivalUI's modals).
    void this.overlay.offsetWidth;
    this.overlay.classList.add('active');

    return new Promise((resolve) => {
      this._resolve = resolve;
      // Input is captured from frame one even though skipping is not honoured
      // until SKIP_AFTER: the card sits ON TOP of the already-painted briefing,
      // so anything it does not swallow would reach "Enter the tide" underneath.
      this._attachInput();
      this._after(skipAfter, () => this._armSkip());
      this._after(fadeIn + hold, () => this._dismiss(fadeOut, true));
    });
  }

  // Player asked to move on. Fades briskly instead of cutting, then resolves false.
  skip() {
    if (!this.active || !this._skipArmed) return false;
    this._dismiss(seconds(this._timing.SKIP_FADE, FALLBACK_TIMING.SKIP_FADE), false);
    return true;
  }

  // Torn down from underneath (quit, retry, destroy): no fade, no ceremony.
  cancel() {
    const resolve = this._resolve;
    this._resolve = null;
    this._clear();
    this._teardown();
    resolve?.(false);
  }

  // The hint only appears once a press will actually be honoured.
  _armSkip() {
    if (!this.active) return;
    this._skipArmed = true;
    this.overlay.classList.add('can-skip');
  }

  _attachInput() {
    this.overlay.style.pointerEvents = 'auto';
    this._skipHandler = (event) => {
      // Keyboard repeat and modifier chords (Cmd+R, Alt+Tab) are not a skip.
      if (event.type === 'keydown' && (event.repeat || event.metaKey || event.ctrlKey || event.altKey)) return;
      // Swallowed whether or not it skips, so a key held from the walk into the
      // arch cannot reach the briefing button sitting behind the card.
      event.preventDefault();
      event.stopPropagation();
      this.skip();
    };
    this.overlay.addEventListener('pointerdown', this._skipHandler);
    // Capture phase: SurvivalUI's own document keydown listener is also in
    // capture, and the card must win while it owns the screen.
    this.document?.addEventListener?.('keydown', this._skipHandler, true);
  }

  // Fade the card out over `fade` seconds, then resolve. The briefing is painted
  // underneath while this runs, so the reveal is a crossfade, not a flash.
  _dismiss(fade, completed) {
    if (!this.active) return;
    this._clear();
    this._setFade(fade);
    this.overlay.classList.remove('active', 'can-skip');
    this.overlay.style.pointerEvents = 'none';
    this._detachSkip();
    this._after(fade, () => {
      const resolve = this._resolve;
      this._resolve = null;
      this._teardown();
      resolve?.(completed);
    });
  }

  _teardown() {
    this._detachSkip();
    this._skipArmed = false;
    if (!this.overlay) return;
    this.overlay.classList.remove('active', 'can-skip');
    this.overlay.style.pointerEvents = 'none';
    this.overlay.setAttribute('aria-hidden', 'true');
    this.overlay.hidden = true;
  }

  _detachSkip() {
    if (!this._skipHandler) return;
    this.overlay?.removeEventListener?.('pointerdown', this._skipHandler);
    this.document?.removeEventListener?.('keydown', this._skipHandler, true);
    this._skipHandler = null;
  }

  _setFade(value) {
    this.overlay?.style?.setProperty?.('--survival-title-fade', `${value}s`);
  }

  _after(delaySeconds, action) {
    const timer = setTimeout(() => {
      this._timers = this._timers.filter((id) => id !== timer);
      action();
    }, Math.max(0, delaySeconds * 1000));
    this._timers.push(timer);
  }

  _clear() {
    for (const timer of this._timers) clearTimeout(timer);
    this._timers.length = 0;
  }

  destroy() {
    if (this.active) this.cancel();
    else this._teardown();
  }
}
