import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SurvivalSfx } from '../src/audio/_partials/SurvivalSfx.js';

class FakeAudioParam {
  constructor(value = 0) {
    this.value = value;
    this.events = [];
  }

  _record(type, value, at) {
    this.value = value;
    this.events.push({ type, value, at });
  }

  setValueAtTime(value, at) { this._record('set', value, at); }

  exponentialRampToValueAtTime(value, at) { this._record('exponential', value, at); }

  cancelScheduledValues(at) { this.events.push({ type: 'cancel', at }); }
}

class FakeAudioNode {
  constructor() {
    this.connections = [];
    this.started = [];
    this.stopped = [];
  }

  connect(target) {
    this.connections.push(target);
    return target;
  }

  start(at) { this.started.push(at); }

  stop(at) { this.stopped.push(at); }
}

class FakeAudioContext {
  constructor() {
    this.currentTime = 10;
    this.sampleRate = 100;
    this.oscillators = [];
    this.bufferSources = [];
  }

  createOscillator() {
    const node = new FakeAudioNode();
    node.frequency = new FakeAudioParam();
    this.oscillators.push(node);
    return node;
  }

  createBufferSource() {
    const node = new FakeAudioNode();
    this.bufferSources.push(node);
    return node;
  }

  createGain() {
    const node = new FakeAudioNode();
    node.gain = new FakeAudioParam();
    return node;
  }

  createBiquadFilter() {
    const node = new FakeAudioNode();
    node.frequency = new FakeAudioParam();
    node.Q = new FakeAudioParam();
    return node;
  }

  createBuffer(channels, frameCount) {
    assert.equal(channels, 1);
    const data = new Float32Array(frameCount);
    return { getChannelData: () => data };
  }
}

function makeManager(ready = true) {
  return Object.assign({
    ready,
    ctx: ready ? new FakeAudioContext() : undefined,
    sfxBus: new FakeAudioNode(),
    _sfxRng: () => 0.5,
    _pitchVar: () => 1,
  }, SurvivalSfx);
}

function testPublicContract() {
  for (const method of [
    'playSurvivalDash',
    'playSurvivalLance',
    'setSurvivalBeam',
    'playSurvivalEliteWarning',
    'playSurvivalUpgrade',
    'playSurvivalBossArrival',
    'stopSurvivalAudio',
  ]) {
    assert.equal(typeof SurvivalSfx[method], 'function', `${method} must remain public`);
  }

  const managerSource = readFileSync(
    new URL('../src/audio/AudioManager.js', import.meta.url),
    'utf8',
  );
  assert.match(managerSource, /import \{ SurvivalSfx \}/);
  assert.match(managerSource, /Object\.assign\(AudioManager\.prototype, SurvivalSfx\)/);

  const survivalSource = readFileSync(
    new URL('../src/audio/_partials/SurvivalSfx.js', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(survivalSource, /Math\.random/);
}

function testPreInitCallsAreSafe() {
  const manager = makeManager(false);
  assert.doesNotThrow(() => manager.playSurvivalDash());
  assert.doesNotThrow(() => manager.playSurvivalLance());
  assert.doesNotThrow(() => manager.setSurvivalBeam(true));
  assert.doesNotThrow(() => manager.setSurvivalBeam(false));
  assert.doesNotThrow(() => manager.playSurvivalEliteWarning('volatile'));
  assert.doesNotThrow(() => manager.playSurvivalUpgrade());
  assert.doesNotThrow(() => manager.playSurvivalBossArrival(3));
  assert.doesNotThrow(() => manager.stopSurvivalAudio());
}

function testOneShotsScheduleBoundedSources() {
  const manager = makeManager();
  manager.playSurvivalDash();
  assert.equal(manager.ctx.bufferSources.length, 1);
  assert.equal(manager.ctx.oscillators.length, 1);

  manager.playSurvivalLance();
  assert.equal(manager.ctx.oscillators.length, 3);

  manager.playSurvivalEliteWarning('armored');
  assert.equal(manager.ctx.oscillators.length, 5);
  manager.playSurvivalEliteWarning('frenzied');
  assert.equal(manager.ctx.oscillators.length, 5, 'elite batch cues must be rate-limited');
  manager.ctx.currentTime += 0.13;
  manager.playSurvivalEliteWarning('volatile');
  assert.equal(manager.ctx.oscillators.length, 7);

  manager.playSurvivalUpgrade();
  assert.equal(manager.ctx.oscillators.length, 10);
  manager.playSurvivalBossArrival(4);
  assert.equal(manager.ctx.bufferSources.length, 2);
  assert.equal(manager.ctx.oscillators.length, 14);

  for (const source of [...manager.ctx.bufferSources, ...manager.ctx.oscillators]) {
    assert.equal(source.started.length, 1);
    assert.equal(source.stopped.length, 1);
    assert.ok(source.stopped[0] > source.started[0]);
  }
}

function testBeamDoesNotStackAndStopsIdempotently() {
  const manager = makeManager();
  manager.setSurvivalBeam(true);
  assert.ok(manager._survivalBeam);
  assert.equal(manager.ctx.oscillators.length, 2);

  manager.setSurvivalBeam(true);
  assert.equal(manager.ctx.oscillators.length, 2, 'repeated active frames must reuse the beam');

  const sources = [...manager._survivalBeam.sources];
  manager.setSurvivalBeam(false);
  assert.equal(manager._survivalBeam, null);
  for (const source of sources) assert.equal(source.stopped.length, 1);

  manager.setSurvivalBeam(false);
  for (const source of sources) assert.equal(source.stopped.length, 1);

  manager.setSurvivalBeam(true);
  assert.equal(manager.ctx.oscillators.length, 4);
  const retrySources = [...manager._survivalBeam.sources];
  manager.stopSurvivalAudio();
  assert.equal(manager._survivalBeam, null);
  for (const source of retrySources) assert.equal(source.stopped.length, 1);
}

testPublicContract();
testPreInitCallsAreSafe();
testOneShotsScheduleBoundedSources();
testBeamDoesNotStackAndStopsIdempotently();

console.log('Survival audio tests passed');
