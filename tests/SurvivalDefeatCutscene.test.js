// Survival death cinematic: the campaign's FaintCutscene now plays when a run's
// health hits zero, before the defeat ledger opens. Source-level assertions —
// the flow partial needs a WebGL Game to run, so the contract is pinned by shape.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPauseModel } from '../src/ui/_partials/pauseModel.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const flow = read('../src/core/_partials/SurvivalFlow.js');
// config.js imports three, so it is read as text here like the other suites do.
const config = read('../src/config.js');

function testTimingIsConfigured() {
  const block = config.slice(config.indexOf('export const SURVIVAL_FAINT'));
  const body = block.slice(0, block.indexOf('};'));
  assert.match(body, /BLACK_HOLD:\s*[\d.]+/, 'the dark beat before the ledger is tunable');
  // The collapse itself is shared with the campaign, so it must NOT be re-tuned here.
  assert.ok(!body.includes('DROOP'), 'droop stays the campaign FAINT value');
  assert.ok(!body.includes('SINK'), 'sink stays the campaign FAINT value');
  assert.match(config, /export const FAINT[\s\S]*?DROOP:\s*[\d.]+/);
  assert.match(flow, /SURVIVAL_FAINT\.BLACK_HOLD/);
}

// REGRESSION: the first version awaited `faintCutscene.play()`. A pause mid-droop
// freezes the render loop, so that promise never resolved and the player was left
// on a black screen with no way to retry or leave. The ledger must therefore be
// armed as state and presented by the loop, never awaited.
function testDefeatPlaysTheCutsceneBeforeTheLedger() {
  const defeat = flow.slice(
    flow.indexOf('_showSurvivalDefeat(result) {'),
    flow.indexOf('_startSurvivalFaint() {'),
  );
  assert.ok(!/async _showSurvivalDefeat/.test(flow), 'defeat must not be async');
  assert.ok(!flow.includes('await this.'), 'the death path must not await anything');
  assert.ok(defeat.includes('this._pendingSurvivalDefeat = {'), 'the ledger is armed as state');
  assert.ok(defeat.includes('this._startSurvivalFaint()'));
  assert.ok(
    defeat.indexOf('hideHud()') < defeat.indexOf('this._startSurvivalFaint()'),
    'the HUD must be gone before the camera droops',
  );

  // The cinematic itself: cutscene camera, hidden viewmodel, black fade, the
  // pointer released once up front (so this stays a non-pointer phase), and a
  // wall-clock net in case the loop never finishes the droop.
  const faint = flow.slice(
    flow.indexOf('_startSurvivalFaint() {'),
    flow.indexOf('_presentSurvivalDefeat() {'),
  );
  for (const fragment of [
    'this.renderPass.camera = this.faintCutscene.camera',
    'this.viewmodel.group.visible = false',
    "this.elFaint.classList.add('active')",
    'this.pause.releasePointerLock()',
    'this.faintCutscene.play(camPos, lookAt)',
    'this._survivalDefeatFallback = setTimeout(',
  ]) {
    assert.ok(faint.includes(fragment), `death cinematic must ${fragment}`);
  }

  // Presenting is idempotent — the loop and the fallback race, and only one wins.
  const present = flow.slice(
    flow.indexOf('_presentSurvivalDefeat() {'),
    flow.indexOf('_restoreCameraAfterSurvivalFaint() {'),
  );
  assert.ok(present.includes('if (!pending) return false'), 'a second call must no-op');
  assert.ok(present.includes('this._pendingSurvivalDefeat = null'));
  assert.ok(present.includes('clearTimeout(this._survivalDefeatFallback)'));
  assert.ok(present.includes('this.survivalUi.showDefeat('));
  assert.ok(present.includes("this.elFaint.classList.remove('active')"));
}

function testEveryExitHandsTheViewBack() {
  assert.match(flow, /_restoreCameraAfterSurvivalFaint\(\)\s*\{[\s\S]*this\.renderPass\.camera = this\.camera/);
  // Retry and teardown (return to the museum, both hub variants) are the only
  // routes off the defeat screen; a missed restore leaves the player watching a
  // frozen cutscene camera.
  // Matched as declarations (`name() {`) so the callback wiring above does not
  // shadow the method body being inspected.
  for (const method of ['_retrySurvival() {', '_teardownSurvivalWorld() {']) {
    const body = flow.slice(flow.indexOf(method), flow.indexOf(method) + 700);
    assert.ok(
      body.includes('this._restoreCameraAfterSurvivalFaint()'),
      `${method} must restore the player camera`,
    );
  }
}

function testFaintIsATrackedSurvivalPhase() {
  assert.match(flow, /'survivalUpgrade',\n\s*'survivalFaint',/, 'faint is a Survival phase');
  assert.match(
    flow,
    /phase === 'survivalFaint'[\s\S]{0,400}this\.faintCutscene\.update\(dt\)[\s\S]{0,220}_presentSurvivalDefeat\(\)/,
    'the loop drives the collapse AND opens the ledger',
  );

  // It must NOT be a pausable/pointer phase: pointer lock is already released when
  // it starts, and treating that as a focus loss paused the loop mid-collapse.
  const pause = read('../src/core/_partials/GamePause.js');
  const sets = pause.slice(0, pause.indexOf('export class'));
  assert.ok(
    !/^\s*'survivalFaint',/m.test(sets),
    'survivalFaint must stay out of PAUSABLE_PHASES and POINTER_PHASES',
  );

  // And the pause ledger must still read as Survival while it plays.
  const model = buildPauseModel({
    phase: 'survivalFaint',
    zoneLabel: 'Endless Memory', zones: [], soulsFound: 0, soulsTotal: 3,
    soulsSeated: 0, zonesRestored: 0, zonesTotal: 3, collection: [], lore: [],
    survival: null,
  });
  assert.equal(model.location, 'Endless Memory');
  assert.ok(model.controls.some((group) => group.group === 'Endless Combat'));
}

testTimingIsConfigured();
testDefeatPlaysTheCutsceneBeforeTheLedger();
testEveryExitHandsTheViewBack();
testFaintIsATrackedSurvivalPhase();

console.log('Survival defeat cutscene tests passed');
