import assert from 'node:assert/strict';
import { GamePauseController } from '../src/core/_partials/GamePause.js';
import { buildPauseModel } from '../src/ui/_partials/pauseModel.js';

class ClassList {
  constructor() { this.values = new Set(); }
  add(...names) { names.forEach((name) => this.values.add(name)); }
  remove(...names) { names.forEach((name) => this.values.delete(name)); }
  contains(name) { return this.values.has(name); }
}

class Element extends EventTarget {
  constructor() {
    super();
    this.style = {};
    this.classList = new ClassList();
    this.attributes = new Map();
    this.textContent = '';
  }

  setAttribute(name, value) { this.attributes.set(name, value); }
}

class Controls extends EventTarget {
  constructor() {
    super();
    this.isLocked = true;
    this.grantLock = true;
    this._nativeUnlocking = false;
  }

  lock() {
    if (!this.grantLock) return;
    this.dispatchEvent(new Event('lock'));
    this.isLocked = true;
  }

  unlock() {
    if (this._nativeUnlocking) return;
    this.nativeUnlock();
  }

  nativeUnlock() {
    this._nativeUnlocking = true;
    this.dispatchEvent(new Event('unlock'));
    this.isLocked = false;
    this._nativeUnlocking = false;
  }
}

class DocumentMock extends EventTarget {
  constructor() {
    super();
    this.hidden = false;
    this.focused = true;
    this.body = new Element();
    this.riddle = new Element();
    this.animations = [];
  }

  hasFocus() { return this.focused; }
  getAnimations() { return this.animations; }
  getElementById(id) { return id === 'riddle' ? this.riddle : null; }
}

globalThis.window = new EventTarget();
globalThis.document = new DocumentMock();
globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 0);

function buildGame(phase = 'arena') {
  const controls = new Controls();
  const audioStates = [];
  const renders = [];
  const game = {
    phase,
    discovery: { active: false },
    elResume: new Element(),
    elResumeSub: new Element(),
    elResumeEnter: new Element(),
    elCross: new Element(),
    pauseMenu: { render(model) { renders.push(model); } },
    player: {
      controls,
      resetCount: 0,
      resetInput() { this.resetCount++; },
    },
    audio: {
      resumeCount: 0,
      setPaused(paused) { audioStates.push(paused); },
      resumeContext() { this.resumeCount++; },
    },
    combat: {
      cancelCount: 0,
      cancelInput() { this.cancelCount++; },
    },
    clock: {
      resetCount: 0,
      getDelta() { this.resetCount++; return 0; },
    },
    holdKey: true,
    _ePressed: true,
  };
  return { game, controls, audioStates, renders };
}

// Stands in for Game's injected `() => buildPauseModel(collectPauseState(this))`.
// The real snapshot collector needs the zone registry (and therefore three), so
// the controller's contract is exercised with a hand-written snapshot instead.
function describeRun(game) {
  return () => buildPauseModel({
    phase: game.phase,
    zoneLabel: 'Zone 1 — PONSIA',
    zones: [
      { id: 'zone1', label: 'Zone 1 — PONSIA', found: 1, total: 11, locked: false },
      { id: 'zone2', label: 'Zone 2', found: 0, total: 9, locked: true },
      { id: 'zone3', label: 'Zone 3', found: 0, total: 7, locked: true },
    ],
    memoriesFound: 1,
    memoriesTotal: 11,
    guardianDefeated: false,
    soulFound: false,
    zoneRestored: false,
    soulsFound: 0,
    soulsSeated: 0,
    soulsTotal: 3,
    zonesRestored: 0,
    zonesTotal: 3,
    endingPlayed: false,
    arena: { label: 'Memory Arena', armor: 3, armorTotal: 3 },
    health: { current: 100, max: 100 },
    jumpEnabled: false,
  });
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function testArenaPauseAndResume() {
  const { game, controls, audioStates, renders } = buildGame();
  const pause = new GamePauseController(game, describeRun(game));
  const animation = {
    playState: 'running',
    effect: { target: { closest: () => null } },
    pauseCount: 0,
    playCount: 0,
    pause() { this.pauseCount++; },
    play() { this.playCount++; },
  };
  document.animations = [animation];
  let waitResolved = false;
  const activeWait = pause.wait(40).then(() => { waitResolved = true; });

  await delay(10);
  window.dispatchEvent(new Event('blur'));
  assert.equal(pause.isPaused, true);
  assert.equal(controls.isLocked, false);
  assert.equal(game.elResume.style.display, 'flex');
  assert.equal(game.elResume.attributes.get('aria-hidden'), 'false');
  assert.equal(game.holdKey, false);
  assert.equal(game._ePressed, false);
  assert.equal(animation.pauseCount, 1);
  // The overlay is a ledger now: showing it must paint one fresh model.
  assert.equal(renders.length, 1);
  assert.equal(renders[0].memories.label, '1 / 27');
  assert.equal(renders[0].location, 'Memory Arena', 'an arena pause names the arena');
  assert.equal(game.elResumeEnter.textContent, 'Resume');
  assert.match(game.elResumeSub.textContent, /catch your breath/);

  await delay(55);
  assert.equal(waitResolved, false, 'active-time waits must not elapse while paused');
  assert.equal(pause.pause('visibility', true), true, 'duplicate pause signals are idempotent');

  pause.requestResume({ preventDefault() {}, stopPropagation() {} });
  assert.equal(pause.isPaused, false);
  assert.equal(controls.isLocked, true);
  assert.equal(game.elResume.style.display, 'none');
  assert.deepEqual(audioStates, [true, false]);
  assert.equal(animation.playCount, 1);
  await activeWait;

  controls.nativeUnlock();
  assert.equal(pause.isPaused, true, 'Escape-style pointer unlock must show Pause');
  assert.equal(game.elResume.style.display, 'flex');
  pause.requestResume({ preventDefault() {}, stopPropagation() {} });
  assert.equal(pause.isPaused, false);
  assert.deepEqual(audioStates, [true, false, true, false]);

  controls.nativeUnlock();
  assert.equal(pause.isPaused, true, 'Escape must still show Pause after one resume cycle');
  pause.requestResume({ preventDefault() {}, stopPropagation() {} });
  assert.equal(pause.isPaused, false);
  assert.deepEqual(audioStates, [true, false, true, false, true, false]);
  document.animations = [];
}

async function testSilentPointerLockFailureCanRetry() {
  const { game, controls } = buildGame();
  controls.isLocked = false;
  controls.grantLock = false;
  const pause = new GamePauseController(game, describeRun(game));
  pause.pause('pointer-lock', true);
  pause.requestResume({ preventDefault() {}, stopPropagation() {} });

  await delay(1250);
  assert.equal(pause.isPaused, true);
  assert.match(game.elResumeEnter.textContent, /click to try again/i);

  controls.grantLock = true;
  pause.requestResume({ preventDefault() {}, stopPropagation() {} });
  assert.equal(pause.isPaused, false);
  assert.equal(controls.isLocked, true);
}

function testStaticAndCinematicPolicies() {
  const staticState = buildGame('title');
  const staticPause = new GamePauseController(staticState.game, describeRun(staticState.game));
  assert.equal(staticPause.pause('focus'), false);

  const cinematic = buildGame('cutscene');
  cinematic.controls.isLocked = false;
  const cinematicPause = new GamePauseController(cinematic.game, describeRun(cinematic.game));
  assert.equal(cinematicPause.pause('focus'), true);
  cinematicPause.requestResume({ preventDefault() {}, stopPropagation() {} });
  assert.equal(cinematicPause.isPaused, false);
  assert.equal(cinematic.controls.isLocked, false);
}

await testArenaPauseAndResume();
await testSilentPointerLockFailureCanRetry();
testStaticAndCinematicPolicies();

console.log('GamePause tests passed');
