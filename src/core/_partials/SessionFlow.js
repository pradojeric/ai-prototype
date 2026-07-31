// ============================================================
// SESSION FLOW — the two destructive actions the pause menu offers
// ============================================================
// Both are reached from the settings modal (Restart / Quit), behind a two-step
// confirm in the UI. They are mixed into Game.prototype like the other flow
// partials, because both are state-machine transitions rather than UI concerns.

export const sessionFlowMethods = {
  // Which main zone "restart" means: inside an arena, `currentZone` is the arena
  // id and `_returnZone` is the zone it came from (see ArenaFlow).
  _restartTargetZone() {
    return this.currentZone?.startsWith('zone') ? this.currentZone : this._returnZone;
  },

  // Restart is only meaningful where there is a memory to restart. It is
  // deliberately allowed mid-arena — abandoning a trial is exactly the case a
  // player wants it for — and _loadZone tears the arena entities down first.
  //
  // A method, not a getter: these partials are mixed in with Object.assign, which
  // would INVOKE an accessor and copy its one-time value onto the prototype.
  canRestartZone() {
    if (this.endingPlayed) return false;
    if (this.phase !== 'playing' && this.phase !== 'arena' && this.phase !== 'descend') return false;
    return !!this._restartTargetZone();
  },

  // Start the current memory over from its dock, then hand off to the ordinary
  // zone-load path so nothing here duplicates it.
  _restartZone() {
    if (!this.canRestartZone()) return false;
    const zoneId = this._restartTargetZone();
    // The zone keeps the memories already recovered there: this restarts a
    // memory, it does not erase the collection (that is Quit's job).
    this.pause.abandon();
    // Reclaim pointer lock on the Restart button's own gesture, which is still
    // valid in this synchronous call. The descend card that follows is timed, so
    // there is no later click to supply one — see Game._showDescend.
    this.player.controls.lock();
    this.busy = false;
    this._introToken = (this._introToken || 0) + 1;   // cancel any running intro dialogue
    this.elPrompt.classList.remove('active');
    this.elCross.classList.remove('active');
    this._loadZone(zoneId);
    return true;
  },

  // Quit to the title screen. Progress is session-only by design (see the
  // `collectedByZone` comment in Game), so a full reload IS the honest reset —
  // it rebuilds every scene, subsystem, and audio graph from scratch instead of
  // leaving half-torn-down state behind.
  _quitToTitle() {
    this.pause.abandon();
    location.reload();
    return true;
  },
};
