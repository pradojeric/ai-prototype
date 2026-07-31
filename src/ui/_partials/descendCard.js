// ============================================================
// DESCEND CARD — the memory's name on black, on the way into a zone
// ============================================================
// Replaces the old click-to-descend screen. No entry path asks for a click: each
// one arranges pointer lock from its own originating gesture (the museum portal
// walk already holds it; the Awaken button and the Restart button each request
// it at click time), so the card is pure ceremony over the built zone.
//
// The click prompt survives only as a SAFETY NET. If the browser has refused
// pointer lock by the time the card is done, Game calls `holdForClick()` and the
// card waits on a gesture rather than dropping the player into a zone they
// cannot look around in. In the ordinary case it is never seen.
//
// Hence the split API: `play()` covers fade-in + hold and then STOPS with the
// card still up, so the caller can check lock state at exactly the right moment
// and choose `dismiss()` or `holdForClick()`.
//
// Timing lives in CONFIG.DESCEND_CARD but is INJECTED rather than imported:
// config.js pulls in `three`, and every UI partial stays import-clean so it can
// be unit-tested under Node against a fake document. The chosen fade is pushed
// into CSS as `--descend-card-fade` per phase, so the JS timers and the
// transitions read the same number instead of drifting apart.

// Mirrors CONFIG.DESCEND_CARD; only reached when no timing is passed in.
const FALLBACK_TIMING = Object.freeze({
  FADE_IN: 0.45,
  HOLD: 1.1,
  FADE_OUT: 0.45,
});

const seconds = (value, fallback) => (Number.isFinite(value) && value >= 0 ? value : fallback);

export class DescendCard {
  constructor(documentRef = globalThis.document) {
    this.document = documentRef;
    this.overlay = documentRef?.getElementById?.('descend-card') ?? null;
    this.kicker = documentRef?.getElementById?.('descend-card-kicker') ?? null;
    this.name = documentRef?.getElementById?.('descend-card-name') ?? null;
    this.quote = documentRef?.getElementById?.('descend-card-quote') ?? null;

    this._timers = [];
    this._resolve = null;
    this._swallowHandler = null;
    this._timing = FALLBACK_TIMING;
    this._awaitingClick = false;
  }

  // True while the timed sequence is running (fade in + hold).
  get active() {
    return this._resolve !== null;
  }

  // True once the timed part is over and the card is holding on its click prompt.
  get awaitingClick() {
    return this._awaitingClick;
  }

  // Fade in and hold, then resolve with the card STILL UP. The caller decides
  // what happens next — see the header. Missing DOM resolves immediately rather
  // than stranding the player on a black screen.
  play({ kicker = '', title = '', quote = '', timing = null } = {}) {
    if (!this.overlay) return Promise.resolve(false);
    // A second entry while one card is up (a fast restart) collapses the first
    // rather than stacking timers on the same element.
    if (this.active || this._awaitingClick) this.cancel();

    if (this.kicker) this.kicker.textContent = String(kicker);
    if (this.name) this.name.textContent = String(title);
    if (this.quote) this.quote.textContent = String(quote);

    this._timing = timing ?? FALLBACK_TIMING;
    const fadeIn = seconds(this._timing.FADE_IN, FALLBACK_TIMING.FADE_IN);
    const hold = seconds(this._timing.HOLD, FALLBACK_TIMING.HOLD);

    this._setFade(fadeIn);
    this.overlay.hidden = false;
    this.overlay.setAttribute('aria-hidden', 'false');
    this.overlay.classList.remove('awaiting-click');
    // Flush the hidden→visible layout so the opacity transition has a start
    // value to animate from (same trick as the survival title card).
    void this.overlay.offsetWidth;
    this.overlay.classList.add('active');

    return new Promise((resolve) => {
      this._resolve = resolve;
      // The card is not skippable, so input is swallowed for its whole life:
      // the player still holds pointer lock on the ordinary route in, and a key
      // held from the walk through the portal must not reach the zone before
      // they can see it. Swallowing continues past this resolve — only
      // holdForClick() gives input back, and only because it needs a gesture.
      this._attachSwallow();
      this._after(fadeIn + hold, () => {
        const resolve = this._resolve;
        this._resolve = null;
        resolve?.(true);
      });
    });
  }

  // Pointer lock is in hand: fade the card away and resolve once it is gone. The
  // zone is already built and rendering underneath, so this is a crossfade.
  dismiss() {
    if (!this.overlay || this.overlay.hidden) return Promise.resolve(false);
    this._clear();
    const fade = seconds(this._timing.FADE_OUT, FALLBACK_TIMING.FADE_OUT);
    this._setFade(fade);
    this.overlay.classList.remove('active', 'awaiting-click');
    this.overlay.style.pointerEvents = 'none';
    this._detachSwallow();
    this._awaitingClick = false;
    return new Promise((resolve) => {
      this._resolve = resolve;
      this._after(fade, () => {
        const done = this._resolve;
        this._resolve = null;
        this._teardown();
        done?.(true);
      });
    });
  }

  // Safety net: pointer lock was refused, so the card stays up and asks for the
  // gesture the browser needs. Stops swallowing — this click IS that gesture.
  holdForClick() {
    if (!this.overlay || this.overlay.hidden) return;
    this._clear();
    this._resolve = null;
    this._awaitingClick = true;
    this._detachSwallow();
    this.overlay.classList.add('active', 'awaiting-click');
    this.overlay.style.pointerEvents = 'auto';
  }

  // Torn down from underneath (quit, restart, destroy): no fade, no ceremony.
  cancel() {
    const resolve = this._resolve;
    this._resolve = null;
    this._clear();
    this._teardown();
    resolve?.(false);
  }

  _attachSwallow() {
    this.overlay.style.pointerEvents = 'auto';
    this._swallowHandler = (event) => {
      // The settings gear is the one live control on the waiting card; it is
      // hidden while the timed part runs, so nothing here can reach it early.
      event.preventDefault();
      event.stopPropagation();
    };
    this.overlay.addEventListener('pointerdown', this._swallowHandler);
    // Capture phase: Game's own document keydown listener is also in capture,
    // and the card must win while it owns the screen.
    this.document?.addEventListener?.('keydown', this._swallowHandler, true);
  }

  _detachSwallow() {
    if (!this._swallowHandler) return;
    this.overlay?.removeEventListener?.('pointerdown', this._swallowHandler);
    this.document?.removeEventListener?.('keydown', this._swallowHandler, true);
    this._swallowHandler = null;
  }

  _teardown() {
    this._detachSwallow();
    this._awaitingClick = false;
    if (!this.overlay) return;
    this.overlay.classList.remove('active', 'awaiting-click');
    this.overlay.style.pointerEvents = 'none';
    this.overlay.setAttribute('aria-hidden', 'true');
    this.overlay.hidden = true;
  }

  _setFade(value) {
    this.overlay?.style?.setProperty?.('--descend-card-fade', `${value}s`);
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
