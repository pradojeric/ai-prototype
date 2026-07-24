import assert from 'node:assert/strict';
import { JourneyGuide } from '../src/ui/JourneyGuide.js';
import { resolveJourneyObjective } from '../src/ui/_partials/journeyObjectives.js';

class ClassList {
  constructor() { this.values = new Set(); }
  add(...names) { names.forEach((name) => this.values.add(name)); }
  remove(...names) { names.forEach((name) => this.values.delete(name)); }
  toggle(name, force) {
    const enabled = force === undefined ? !this.values.has(name) : force;
    if (enabled) this.values.add(name);
    else this.values.delete(name);
    return enabled;
  }
  contains(name) { return this.values.has(name); }
}

class ElementMock {
  constructor() {
    this.classList = new ClassList();
    this.style = {};
    this.attributes = new Map();
    this.textContent = '';
    this.offsetWidth = 320;
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
}

class DocumentMock extends EventTarget {
  constructor() {
    super();
    this.elements = new Map();
  }
  getElementById(id) {
    if (!this.elements.has(id)) this.elements.set(id, new ElementMock());
    return this.elements.get(id);
  }
}

globalThis.document = new DocumentMock();

const baseState = {
  phase: 'playing',
  endingPlayed: false,
  guardianDefeated: false,
  memoriesFound: 0,
  memoriesTotal: 9,
  soulFound: false,
  soulsFound: 0,
  soulsTotal: 3,
  zoneLabel: 'Zone 1 — PONSIA',
};

function testObjectiveResolver() {
  assert.equal(resolveJourneyObjective(baseState).id, 'memory-rift');
  assert.equal(resolveJourneyObjective({ ...baseState, phase: 'arena' }).mode, 'collapsed');

  const scattered = resolveJourneyObjective({
    ...baseState,
    guardianDefeated: true,
    memoriesFound: 4,
  });
  assert.equal(scattered.id, 'scattered-memories');
  assert.deepEqual(scattered.progress, { current: 4, total: 9, label: '4 / 9' });
  assert.deepEqual(scattered.soulProgress, { current: 0, total: 1, label: '0 / 1' });

  const soulRecovered = resolveJourneyObjective({
    ...baseState,
    guardianDefeated: true,
    memoriesFound: 4,
    soulFound: true,
  });
  assert.deepEqual(soulRecovered.soulProgress, { current: 1, total: 1, label: '1 / 1' });

  const guardianSoul = resolveJourneyObjective({
    ...baseState,
    guardianDefeated: true,
    memoriesFound: 9,
  });
  assert.equal(guardianSoul.id, 'guardian-soul');
  assert.deepEqual(guardianSoul.soulProgress, { current: 0, total: 1, label: '0 / 1' });

  assert.equal(resolveJourneyObjective({
    ...baseState,
    guardianDefeated: true,
    memoriesFound: 4,
    soulFound: true,
  }).id, 'scattered-memories');

  assert.equal(resolveJourneyObjective({
    ...baseState,
    phase: 'museum',
    soulsFound: 3,
  }).id, 'final-memory');
  assert.equal(resolveJourneyObjective({ ...baseState, phase: 'debug' }).mode, 'hidden');
}

function testRenderingAndProgressAria() {
  const guide = new JourneyGuide(() => Promise.resolve());
  const objective = resolveJourneyObjective({
    ...baseState,
    guardianDefeated: true,
    memoriesFound: 4,
  });
  guide.setObjective(objective, false);
  assert.equal(guide.panel.classList.contains('active'), true);
  assert.equal(guide.progress.classList.contains('active'), true);
  assert.equal(guide.progressFill.style.width, `${(4 / 9) * 100}%`);
  assert.equal(guide.progress.attributes.get('aria-valuenow'), '4');
  assert.equal(guide.progressCount.textContent, '4 / 9');
  assert.equal(guide.soulProgress.classList.contains('active'), true);
  assert.equal(guide.soulProgressFill.style.width, '0%');
  assert.equal(guide.soulProgress.attributes.get('aria-valuenow'), '0');
  assert.equal(guide.soulProgressCount.textContent, '0 / 1');

  guide.setObjective(resolveJourneyObjective({ ...baseState, phase: 'arena' }), false);
  assert.equal(guide.panel.classList.contains('active'), false);
  assert.equal(guide.collapsed.classList.contains('active'), true);
  guide.dispose();
}

async function testNotificationQueueAndOncePerRunState() {
  const waits = [];
  const guide = new JourneyGuide(() => new Promise((resolve) => waits.push(resolve)));
  guide.setSuppressed(false);
  guide.showControl('move');
  guide.showControl('look');
  guide.showControl('move');
  assert.equal(guide.toastMessage.textContent, 'WASD — Move through the memory');
  assert.equal(guide.queue.length, 1, 'duplicate control hints must not be queued');

  waits.shift()();
  await Promise.resolve();
  waits.shift()();
  await Promise.resolve();
  assert.equal(guide.toastMessage.textContent, 'Mouse — Look around');

  guide.showLumina('vitality');
  guide.showLumina('vitality');
  assert.equal(guide.seenLumina.size, 1);
  assert.equal(guide.queue.length, 1, 'duplicate Lumina explanations must not be queued');
  guide.dispose();

  const freshGuide = new JourneyGuide(() => Promise.resolve());
  assert.equal(freshGuide.seenControls.size, 0);
  assert.equal(freshGuide.seenLumina.size, 0);
  freshGuide.dispose();
}

testObjectiveResolver();
testRenderingAndProgressAria();
await testNotificationQueueAndOncePerRunState();

console.log('JourneyGuide tests passed');
