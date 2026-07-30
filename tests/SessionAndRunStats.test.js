import assert from 'node:assert/strict';
import { RunStats } from '../src/core/_partials/RunStats.js';
import { RUN_EVENT, emitRunEvent } from '../src/core/_partials/runEvents.js';
import { sessionFlowMethods } from '../src/core/_partials/SessionFlow.js';

class ClassList {
  constructor() { this.values = new Set(); }
  add(name) { this.values.add(name); }
  remove(name) { this.values.delete(name); }
  contains(name) { return this.values.has(name); }
}

globalThis.document = new EventTarget();
globalThis.document.classList = new ClassList();
globalThis.CustomEvent = globalThis.CustomEvent || class extends Event {
  constructor(type, options = {}) { super(type); this.detail = options.detail; }
};

// The emitter and the listener must agree on the event names — that agreement is
// the whole contract between combat and the pause menu's run tally.
function testTallyListensToWhatCombatEmits() {
  let clock = 0;
  const stats = new RunStats(() => clock);
  assert.deepEqual(stats.snapshot(), {
    seconds: 0, echoesDefeated: 0, bugtongCorrect: 0, bugtongWrong: 0, faints: 0,
  });

  // ThreatBody.hit() fires this on every earned kill.
  emitRunEvent(RUN_EVENT.ECHO_DEFEATED);
  emitRunEvent(RUN_EVENT.ECHO_DEFEATED);
  // The three arenas fire this from their answer-resolution branches.
  emitRunEvent(RUN_EVENT.BUGTONG, { correct: true });
  emitRunEvent(RUN_EVENT.BUGTONG, { correct: false });
  emitRunEvent(RUN_EVENT.BUGTONG, { correct: true });
  stats.recordFaint();
  clock = 91.7;

  assert.deepEqual(stats.snapshot(), {
    seconds: 91, echoesDefeated: 2, bugtongCorrect: 2, bugtongWrong: 1, faints: 1,
  });

  // A detail-less bugtong event counts as wrong rather than throwing.
  emitRunEvent(RUN_EVENT.BUGTONG);
  assert.equal(stats.snapshot().bugtongWrong, 2);

  // Disposal really detaches: a stale tally must not keep counting.
  stats.dispose();
  emitRunEvent(RUN_EVENT.ECHO_DEFEATED);
  assert.equal(stats.snapshot().echoesDefeated, 2);
}

function buildGame(overrides = {}) {
  const calls = { abandon: 0, loaded: [], reloads: 0 };
  const game = {
    phase: 'playing',
    currentZone: 'zone1',
    _returnZone: 'zone1',
    endingPlayed: false,
    busy: true,
    elPrompt: { classList: new ClassList() },
    elCross: { classList: new ClassList() },
    pause: { abandon() { calls.abandon++; } },
    _loadZone(zoneId) { calls.loaded.push(zoneId); },
    ...overrides,
  };
  Object.assign(game, sessionFlowMethods);
  return { game, calls };
}

function testRestartTargetsTheMainZone() {
  const { game, calls } = buildGame();
  assert.equal(game.canRestartZone(), true);
  assert.equal(game._restartZone(), true);
  assert.deepEqual(calls.loaded, ['zone1']);
  assert.equal(calls.abandon, 1, 'the pause state must be left before the zone loads');
  assert.equal(game.busy, false);

  // Inside an arena, `currentZone` is the arena — restart must target the zone
  // the arena returns to, not a world that has no dock to spawn on.
  const arena = buildGame({ phase: 'arena', currentZone: 'arena3boss', _returnZone: 'zone3' });
  assert.equal(arena.game.canRestartZone(), true);
  arena.game._restartZone();
  assert.deepEqual(arena.calls.loaded, ['zone3']);

  // Nowhere to restart: the hub, the title, the finished run.
  for (const overrides of [
    { phase: 'museum' }, { phase: 'title' }, { phase: 'endingCredits' },
    { phase: 'playing', endingPlayed: true },
  ]) {
    const blocked = buildGame(overrides);
    assert.equal(blocked.game.canRestartZone(), false, JSON.stringify(overrides));
    assert.equal(blocked.game._restartZone(), false);
    assert.deepEqual(blocked.calls.loaded, []);
    assert.equal(blocked.calls.abandon, 0, 'a refused restart must not disturb the pause');
  }
}

function testQuitReloads() {
  let reloads = 0;
  globalThis.location = { reload() { reloads++; } };
  const { game, calls } = buildGame();
  assert.equal(game._quitToTitle(), true);
  assert.equal(reloads, 1);
  assert.equal(calls.abandon, 1);
}

testTallyListensToWhatCombatEmits();
testRestartTargetsTheMainZone();
testQuitReloads();

console.log('SessionFlow + RunStats tests passed');
