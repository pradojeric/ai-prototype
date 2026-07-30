// ============================================================
// RUN STATS — the session tally the pause menu reports back
// ============================================================
// Session-scoped, like every other progress field on Game: a browser reload
// starts a new run. It listens on the document bus (see runEvents.js) so combat
// code never has to hold a reference to it, and Game bumps the two counters only
// it can see (faints, and the memories/Souls come from the real collections).
import { RUN_EVENT } from './runEvents.js';

export class RunStats {
  // `activeSeconds` reads Game's own accumulated play clock, which already
  // excludes paused time (Game.animate returns early while paused) — so the
  // tally never has to run a second timer or worry about the pause state.
  constructor(activeSeconds = () => 0) {
    this.activeSeconds = activeSeconds;
    this.echoesDefeated = 0;
    this.bugtongCorrect = 0;
    this.bugtongWrong = 0;
    this.faints = 0;

    this._onEcho = () => { this.echoesDefeated++; };
    this._onBugtong = (event) => {
      if (event.detail?.correct) this.bugtongCorrect++;
      else this.bugtongWrong++;
    };
    document.addEventListener(RUN_EVENT.ECHO_DEFEATED, this._onEcho);
    document.addEventListener(RUN_EVENT.BUGTONG, this._onBugtong);
  }

  // Beats only Game can see.
  recordFaint() { this.faints++; }

  snapshot() {
    return {
      seconds: Math.max(0, Math.floor(this.activeSeconds())),
      echoesDefeated: this.echoesDefeated,
      bugtongCorrect: this.bugtongCorrect,
      bugtongWrong: this.bugtongWrong,
      faints: this.faints,
    };
  }

  dispose() {
    document.removeEventListener(RUN_EVENT.ECHO_DEFEATED, this._onEcho);
    document.removeEventListener(RUN_EVENT.BUGTONG, this._onBugtong);
  }
}
