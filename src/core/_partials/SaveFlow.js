// ============================================================
// SAVE FLOW — restoring a cloud save into the live session
// ============================================================
// Mixed into Game.prototype like the other flow partials, because every method
// here is a state-machine transition rather than a UI concern. SaveManager owns
// the network and saveState.js owns the payload; this is only the seam where a
// restored run becomes the running game.
//
// Object.assign copies values, so these must stay methods — never getters.
import { hasProgress } from './saveState.js';

export const saveFlowMethods = {
  // One funnel for every progress milestone, so save points stay greppable and
  // the debounce in SaveManager coalesces bursts into a single write.
  _saveProgress() {
    this.save.queue(this);
  },

  // Fold a validated cloud save into the live session. Runs before the intro, so
  // the hub the cutscene flies over already shows the player's real progress.
  _applyRestoredProgress(data) {
    if (!this.save.restore(this, data)) return;
    // Re-open the portals the restored completions had earned. Mirrors the
    // sequential unlock in _zoneComplete; unlockPortal is idempotent.
    for (const zoneId of this.completed) {
      const next = this.zoneOrder[this.zoneOrder.indexOf(zoneId) + 1];
      if (next) this.museum.unlockPortal(Number(next.slice(4)));
    }
    this._syncMuseumSouls();
    // Hang the restored memories in their galleries too. _enterMuseum populates
    // on every hub entry, but that only covers routes that go through it — a
    // restored session can reach a gallery without one, and the Souls above
    // would then be seated in a hub whose plinths are still empty. populate() is
    // idempotent, so doing it here as well costs nothing.
    this.museum.populate(this._collectedArtifacts());
    this._syncJourneyGuide(false);
    // A resumable run turns the title's Start into Continue.
    this.hasSavedProgress = hasProgress(this);
    if (this.hasSavedProgress) this._syncTitleContinue();
  },

  // Erase the saved run and start over. A reload IS the honest reset — the same
  // reasoning as SessionFlow's Quit-to-title: rebuilding every field by hand is
  // where stale state hides. The delete lands first so the fresh session cannot
  // restore what we just discarded.
  async _newGame() {
    await this.save.clearSave();
    location.reload();
  },

  // A different account's save was signed into, so this browser is now a
  // different player. Reload for the same reason as _newGame.
  _reloadForAccountChange() {
    location.reload();
  },

  // Relabel the title action once a resumable save has landed. The restore is
  // async, so this may arrive after the menu is already on screen — a player who
  // clicks Start first still keeps their progress, they just watch the intro.
  _syncTitleContinue() {
    if (!this.elMenuStartLabel) return;
    this.elMenuStartLabel.textContent = 'Continue';
    this.elMenuStart.setAttribute('aria-label', 'Continue — return to your museum');
    // New Game is the only route back to a fresh run once Continue exists, so it
    // appears at exactly the same moment.
    if (this.elNewGame) this.elNewGame.style.display = '';
  },

  // Resume a saved run: no intro cinematic, straight into the walkable hub with
  // the restored Souls, portals and galleries already in place. _skipToMuseum
  // lights the open Zone 1 portal the intro would otherwise have lit.
  _continueFromSave() {
    if (this.phase !== 'title') return;
    this._skipToMuseum();
  },
};
