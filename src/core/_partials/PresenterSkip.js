// ============================================================
// PRESENTER SKIP — the hidden "magic key" for live demos (Shift + P by default).
//
// Strings is a slow, atmospheric game; in front of a crowd the boss fights, the
// riddle rounds and the peaceful collection pass are far longer than a demo slot
// allows. One context-aware press fast-forwards whichever of those is on screen.
//
// The hard rule: a skip must land the game in exactly the state an honest
// playthrough would have reached. The guardian still implodes, the memories and
// the Guardian Soul still count as recovered, the zone-complete card still shows
// and the next museum portal still unlocks. Nothing here is a teleport past the
// state machine — every path re-enters Game's own transitions.
//
// Installed onto Game.prototype (see the Object.assign at the foot of Game.js);
// the keybind itself is wired from GameUI.js alongside the other input handlers.
// ============================================================
import { PRESENTER } from '../../config.js';

export function wirePresenterSkip(game) {
  document.addEventListener('keydown', (event) => {
    if (event.repeat || event.code !== PRESENTER.KEY) return;
    if (PRESENTER.SHIFT && !event.shiftKey) return;
    if (!PRESENTER.ENABLED || game.pause.isPaused) return;
    event.preventDefault();
    game._presenterSkip();
  });
}

export const presenterSkipMethods = {
  // Route the press to whatever long beat is currently on screen. Returns the
  // name of the beat that was skipped (or null), which keeps the dispatch
  // readable and gives the console a breadcrumb during a demo.
  _presenterSkip() {
    // A held key would otherwise stack a zone-completion on top of an arena
    // return that is still mid-flight.
    const now = performance.now() / 1000;
    if (this._presenterSkipAt && now - this._presenterSkipAt < PRESENTER.COOLDOWN) return null;
    this._presenterSkipAt = now;

    const skipped = this._presenterDispatch();
    if (skipped) console.debug({ beat: skipped, phase: this.phase }, 'Presenter skip');
    return skipped;
  },

  _presenterDispatch() {
    // A zone/arena swap is mid-load: its own transition finishes the job.
    if (this._loadingZone) return null;

    if (this.phase === 'cutscene') { this.cutscene?.skip(); return 'intro-cutscene'; }
    if (this.phase === 'endingPortal') { this.portalCutscene?.skip?.(); return 'ending-portal'; }
    if (this.phase === 'endingMuseum') { this.museumEndingCutscene?.skip?.(); return 'ending-museum'; }
    if (this.phase === 'endingRestored') { this.restoredProvince?.skip?.(); return 'ending-restored'; }

    // The completion card is up — walk on into the hub.
    if (this.phase === 'complete') { this._enterMuseum(); return 'zone-complete-card'; }

    if (this.phase === 'arena') return this._presenterSkipArena();
    if (this.phase === 'playing') return this._presenterClearZone();

    // title / descend / museum / faint / debug: nothing long enough to warrant it.
    return null;
  },

  // Arena, in escalating order of how much it throws away:
  //   1. the guardian introduction runs its timeline out;
  //   2. the armor phase — waves, bugtong rounds, the tower ascent — is cut and
  //      the boss becomes the fight, still fully playable. That phase is the long
  //      dead air in a demo while the boss is the part a crowd came to watch, so
  //      this is deliberately preferred over ending the encounter;
  //   3. only once the boss is up is the encounter won outright. The main loop's
  //      existing `arena.won` check then plays the normal victory rift and
  //      `_returnFromArena()`, so the artifacts and Soul still burst from the
  //      fallen guardian exactly as after a real victory.
  _presenterSkipArena() {
    if (this.guardianIntro?.active) { this.guardianIntro.skip(); return 'guardian-intro'; }
    // busy here means the return sequence already started.
    if (this.busy || !this.arena || this.arena.won) return null;
    if (this.arena.presenterSkipToBoss?.()) {
      this.platformRewardEligible = false;
      // Arena 3's handoff expects the player staged on the summit landing; the
      // other two fight from the arena floor and report no retry point.
      const retryPoint = this.arena.getRetryPoint?.();
      if (retryPoint) this._spawnAtArenaCenter(retryPoint);
      return 'arena-armor';
    }
    // Each controller tears down its own remaining riddle presentation (banner,
    // answer nodes, seal-console card) inside presenterWin.
    this.platformRewardEligible = false;
    this.arena.presenterWin();
    return 'arena-fight';
  },

  // Main zone: bank every memory and the Guardian Soul, then close the zone.
  // Works from either side of the arena — before it, the rift fight is written
  // off as won; after it, the loose artifacts are collected for real so their
  // meshes, strings and spatial echoes are torn down rather than orphaned.
  _presenterClearZone() {
    if (this.busy) return null;
    this.platformRewardEligible = false;
    const zone = this.currentZone;

    if (!this.bossDefeated) {
      this.bossDefeated = true;
      if (this.rift) { this.rift.dispose(); this.rift = null; }
    }

    // The Soul goes first, while the memories are still outstanding: its normal
    // pickup callback closes the zone by itself once both halves are in, and
    // taking it last would race that against the explicit call below.
    if (this.soul) this.soul.forceCollect();
    this.collectedSouls.add(zone);

    // Live (scattered) artifacts, so the manager disposes their meshes/strings.
    for (const artifact of this.artifacts.artifacts) {
      if (artifact.found) continue;
      this.artifacts.collect(artifact);
      this.audio.removeEcho(artifact);
    }
    // Then anything for this zone that was never revealed (skipped pre-arena).
    for (const data of this.artifacts.zoneArtifacts) this.artifacts.collectedIds.add(data.id);
    this.audio.clearEchoes();

    this.holdKey = false;
    this.holdProgress = 0;
    this._ePressed = false;
    this._proximity = null;
    // _collectSoul may already have closed the zone above.
    if (this.phase === 'playing') this._zoneComplete();
    return 'zone-collection';
  },
};
