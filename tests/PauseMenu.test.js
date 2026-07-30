import assert from 'node:assert/strict';
import { buildPauseModel } from '../src/ui/_partials/pauseModel.js';
import { PauseMenu } from '../src/ui/PauseMenu.js';

// ---- DOM mock (same shape as the other UI tests here) ----------------------

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
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.classList = new ClassList();
    this.style = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.textContent = '';
    this.hidden = false;
    this.disabled = false;
  }

  set className(value) {
    this._className = value;
    this.classList.values = new Set(String(value).split(/\s+/).filter(Boolean));
  }

  get className() { return this._className || ''; }

  // `img.src = x` reflects into the src attribute in a real DOM; PauseCollection
  // reads it back with getAttribute to avoid re-assigning the same image.
  set src(value) { this.attributes.set('src', value); }
  get src() { return this.getAttribute('src'); }

  append(...nodes) { this.children.push(...nodes); }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }
  // Drives a pooled slot/tab handler in tests; `stopPropagation` is what the
  // real listeners call so browsing never resumes the game.
  click(event = { stopPropagation() {} }) {
    for (const handler of this.listeners.get('click') || []) handler(event);
  }
  focus() { this.focused = true; }
}

class DocumentMock {
  constructor() { this.elements = new Map(); }

  getElementById(id) {
    if (!this.elements.has(id)) this.elements.set(id, new ElementMock());
    return this.elements.get(id);
  }

  querySelector() { return new ElementMock(); }
  createElement(tag) { return new ElementMock(tag); }
}

// ---- Snapshots -------------------------------------------------------------

const ZONES = [
  { id: 'zone1', label: 'Zone 1 — PONSIA', found: 11, total: 11, locked: false },
  { id: 'zone2', label: 'Zone 2 — BAGSAKAN', found: 4, total: 9, locked: false },
  { id: 'zone3', label: 'Zone 3 — KAMPANA', found: 0, total: 7, locked: true },
];

const COLLECTION = [
  { id: 'a1', zone: 1, fil: 'Alpha', eng: 'Alpha EN', image: 'a1.png', origin: 'o1', lore: 'l1', found: true },
  { id: 'a2', zone: 1, fil: 'Beta', eng: 'Beta EN', image: 'a2.png', origin: 'o2', lore: 'l2', found: false },
  { id: 'b1', zone: 2, fil: 'Gamma', eng: 'Gamma EN', image: 'b1.png', origin: 'o3', lore: 'l3', found: true },
  { id: 'c1', zone: 3, fil: 'Delta', eng: 'Delta EN', image: 'c1.png', origin: 'o4', lore: 'l4', found: false },
];

const LORE = [
  { zone: 1, name: 'PONSIA', subtitle: 's1', guardian: 'g1', trial: 't1', body: 'b1', line: 'f1', lineEn: 'e1' },
  { zone: 2, name: 'LIKET', subtitle: 's2', guardian: 'g2', trial: 't2', body: 'b2', line: 'f2', lineEn: 'e2' },
];

const baseState = {
  phase: 'playing',
  zoneLabel: 'Zone 2 — BAGSAKAN',
  zones: ZONES,
  run: {
    seconds: 3725, echoesDefeated: 41, bugtongCorrect: 5, bugtongWrong: 2, faints: 1,
  },
  collection: COLLECTION,
  lore: LORE,
  memoriesFound: 4,
  memoriesTotal: 9,
  guardianDefeated: true,
  soulFound: false,
  zoneRestored: false,
  soulsFound: 1,
  soulsSeated: 1,
  soulsTotal: 3,
  zonesRestored: 1,
  zonesTotal: 3,
  endingPlayed: false,
  arena: null,
  health: null,
  jumpEnabled: false,
};

const statuses = (model) => model.objectives.map((o) => o.status);
const labels = (model) => model.objectives.map((o) => o.label);

function testTotalsComeFromTheZoneRows() {
  const model = buildPauseModel(baseState);
  // 11 + 9 + 7 is the real content total; nothing here hardcodes 27.
  assert.equal(model.memories.total, 27);
  assert.equal(model.memories.found, 15);
  assert.equal(model.memories.label, '15 / 27');
  assert.equal(model.memories.zones[2].locked, true);
  assert.equal(model.memories.zones[0].complete, true);
  assert.equal(model.memories.zones[1].countLabel, '4 / 9');
  assert.equal(model.souls.label, '1 / 3');
  assert.equal(model.zonesRestored.label, '1 / 3');
}

function testInZoneChecklistMarksExactlyOneActiveStep() {
  const model = buildPauseModel(baseState);
  assert.deepEqual(statuses(model), ['done', 'active', 'todo', 'todo']);
  assert.equal(model.objectives[1].detail, '4 / 9');
  assert.equal(model.location, 'Zone 2 — BAGSAKAN');

  // Guardian still standing: the rift is the active step and nothing is done.
  const fresh = buildPauseModel({ ...baseState, guardianDefeated: false });
  assert.deepEqual(statuses(fresh), ['active', 'todo', 'todo', 'todo']);

  // Memories home, Soul still loose.
  const soulLeft = buildPauseModel({ ...baseState, memoriesFound: 9 });
  assert.deepEqual(statuses(soulLeft), ['done', 'done', 'active', 'todo']);

  // Everything but the walk back.
  const goHome = buildPauseModel({ ...baseState, memoriesFound: 9, soulFound: true });
  assert.deepEqual(statuses(goHome), ['done', 'done', 'done', 'active']);

  for (const model of [fresh, soulLeft, goHome]) {
    assert.equal(statuses(model).filter((s) => s === 'active').length, 1);
  }
}

function testArenaAndDuelObjectives() {
  const warded = buildPauseModel({
    ...baseState,
    phase: 'arena',
    arena: { label: 'Memory Arena — The Reveler', armor: 1, armorTotal: 3 },
    health: { current: 62.4, max: 100 },
    jumpEnabled: true,
  });
  assert.equal(warded.location, 'Memory Arena — The Reveler');
  assert.equal(warded.objectives[1].detail, '2 / 3 wards broken');
  assert.deepEqual(statuses(warded), ['active', 'todo', 'todo']);
  assert.deepEqual(warded.vitals, [{
    id: 'health', label: 'Vitality', value: 62, max: 100, countLabel: '62 / 100',
  }]);
  // In an arena the whole combat kit is live, and the hop is live because the
  // fight armed it.
  const combat = warded.controls.find((group) => group.group === 'Combat');
  assert.deepEqual(combat.items.map((item) => item.available), [true, true, true]);
  assert.equal(combat.note, '');
  const hop = warded.controls[0].items.find((item) => item.keys[0] === 'Space');
  assert.equal(hop.available, true);
  assert.equal(hop.action, 'Hop a ground shockwave — costs stamina');
  // Arena 3 answers its seals by number, so those keys must be listed too.
  const trial = warded.controls.find((group) => group.group === 'The Trial');
  assert.deepEqual(trial.items.find((item) => item.keys.length === 3).keys, ['1', '2', '3']);

  // Same arena, hop not armed: still listed, dimmed, and it says why.
  const noHop = buildPauseModel({
    ...baseState, phase: 'arena', arena: { label: 'A', armor: 1, armorTotal: 3 },
    jumpEnabled: false,
  });
  const idleHop = noHop.controls[0].items.find((item) => item.keys[0] === 'Space');
  assert.equal(idleHop.available, false);
  assert.match(idleHop.action, /Armed only while a fight can floor you/);

  const cleared = buildPauseModel({
    ...baseState,
    phase: 'arena',
    arena: { label: 'A', armor: 0, armorTotal: 3 },
  });
  assert.deepEqual(statuses(cleared), ['done', 'done', 'active']);

  // The Keeper's arena reports no wards: the checklist must not invent them.
  const duel = buildPauseModel({
    ...baseState,
    phase: 'arena',
    arena: { label: 'B', armor: null, armorTotal: 0 },
  });
  assert.deepEqual(statuses(duel), ['active', 'todo', 'todo']);
  assert.ok(!labels(duel).some((label) => label.includes('armor')));
}

function testHubObjectivesAndControlSets() {
  const hub = buildPauseModel({ ...baseState, phase: 'museum' });
  assert.equal(hub.location, 'Aking Museo');
  assert.deepEqual(statuses(hub), ['active', 'todo', 'todo']);
  assert.equal(hub.objectives[1].detail, '1 / 3 seated');
  assert.deepEqual(
    hub.controls.map((group) => group.group),
    ['Movement', 'Aking Museo', 'Combat', 'System'],
  );

  const ready = buildPauseModel({
    ...baseState, phase: 'museum', soulsFound: 3, soulsSeated: 3, zonesRestored: 3,
  });
  assert.deepEqual(statuses(ready), ['done', 'done', 'active']);
  assert.equal(ready.objectives[2].label, 'Awaken the Final Memory');

  // No vitals outside a fight — but the combat kit is still DOCUMENTED there,
  // marked not-live with the reason, instead of vanishing from the reference.
  assert.deepEqual(hub.vitals, []);
  const hubCombat = hub.controls.find((group) => group.group === 'Combat');
  assert.equal(hubCombat.note, 'Only inside a Memory Arena');
  assert.deepEqual(hubCombat.items.map((item) => item.available), [false, false, false]);
  assert.deepEqual(hubCombat.items.map((item) => item.keys[0]), ['Hold Click', 'F', 'R']);

  // In a zone: same, plus the peaceful interaction verbs.
  const zone = buildPauseModel(baseState);
  assert.deepEqual(
    zone.controls.map((group) => group.group),
    ['Movement', 'Memories', 'Combat', 'System'],
  );
  assert.deepEqual(
    zone.controls.find((group) => group.group === 'Memories').items.map((item) => item.keys[0]),
    ['E', 'Hold E', 'Walk'],
  );

  // Every phase the pause controller allows must produce a usable model, and the
  // control reference must be complete in all of them: every binding the game
  // reads appears exactly once per context, live or dimmed.
  const EVERY_BINDING = ['W', 'Shift', 'Mouse', 'Space', 'Hold Click', 'F', 'R', 'Esc'];
  for (const phase of ['cutscene', 'playing', 'museum', 'arena', 'debug', 'faint',
    'endingPortal', 'endingMuseum', 'endingRestored', 'descend', 'complete']) {
    const model = buildPauseModel({ ...baseState, phase });
    assert.ok(model.objectives.length > 0, `${phase} produced no objectives`);
    assert.ok(model.subtitle && model.location, `${phase} produced no header`);
    assert.ok(model.controls.length > 0, `${phase} produced no controls`);
    const keys = model.controls.flatMap((group) => group.items.map((item) => item.keys[0]));
    for (const binding of EVERY_BINDING) {
      assert.equal(
        keys.filter((key) => key === binding).length, 1,
        `${phase} must list ${binding} exactly once`,
      );
    }
    // Every row carries a resolved availability flag and a non-empty action.
    for (const group of model.controls) {
      for (const item of group.items) {
        assert.equal(typeof item.available, 'boolean', `${phase}/${group.group}`);
        assert.ok(item.action.length > 0, `${phase}/${group.group}`);
        assert.ok(item.keys.length > 0, `${phase}/${group.group}`);
      }
    }
  }
}

function testRenderWritesAndPoolsNodes() {
  const doc = new DocumentMock();
  const menu = new PauseMenu(doc);
  menu.render(buildPauseModel(baseState));

  assert.equal(doc.getElementById('pause-location').textContent, 'Zone 2 — BAGSAKAN');
  assert.equal(doc.getElementById('pause-memories-count').textContent, '15 / 27');
  assert.equal(doc.getElementById('pause-memories-fill').style.width, `${(15 / 27) * 100}%`);
  assert.equal(doc.getElementById('pause-memories').attributes.get('aria-valuenow'), '15');
  assert.equal(doc.getElementById('pause-memories').attributes.get('aria-valuemax'), '27');

  const objectives = doc.getElementById('pause-objectives');
  assert.equal(objectives.children.length, 4);
  assert.equal(objectives.children[0].attributes.get('data-status'), 'done');
  assert.equal(objectives.children[1].attributes.get('data-status'), 'active');
  assert.equal(objectives.children[1]._label.textContent, 'Recover the scattered memories');

  const zoneRows = doc.getElementById('pause-zone-rows');
  assert.equal(zoneRows.children.length, 3);
  assert.equal(zoneRows.children[2]._count.textContent, 'Sealed', 'a sealed zone reads as sealed');
  assert.equal(zoneRows.children[0].classList.contains('is-complete'), true);

  const soulPips = doc.getElementById('pause-soul-pips');
  assert.equal(soulPips.children.length, 3);
  assert.deepEqual(
    soulPips.children.map((pip) => pip.classList.contains('is-filled')),
    [true, false, false],
  );
  assert.equal(doc.getElementById('pause-soul-count').textContent, '1 / 3');

  // Controls: one column per group, dt/dd pairs inside, and the not-live rows
  // carry both the dimmed class and the group's explaining note.
  const controls = doc.getElementById('pause-controls');
  assert.equal(controls.children.length, 4);
  const combatColumn = controls.children[2];
  assert.equal(combatColumn._title.textContent, 'Combat');
  assert.equal(combatColumn._note.textContent, 'Only inside a Memory Arena');
  assert.equal(combatColumn._list.children.length, 6, 'three dt/dd pairs');
  assert.equal(combatColumn._list.children[0].classList.contains('is-unavailable'), true);
  assert.equal(combatColumn._list.children[1].classList.contains('is-unavailable'), true);
  assert.equal(combatColumn._list.children[0].children.map((c) => c.textContent).join(''), 'Hold Click');
  // A live group renders the same rows without the dimmed marker or a note.
  menu.render(buildPauseModel({
    ...baseState, phase: 'arena', arena: { label: 'A', armor: 2, armorTotal: 3 }, jumpEnabled: true,
  }));
  assert.equal(controls.children[1]._title.textContent, 'Combat');
  assert.equal(controls.children[1]._note.textContent, '');
  assert.equal(controls.children[1]._list.children[0].classList.contains('is-unavailable'), false);
  menu.render(buildPauseModel(baseState));

  // Re-render with a SHORTER list: rows are reused and the surplus is hidden,
  // never re-created (this panel opens once per pause, for the whole run).
  menu.render(buildPauseModel({
    ...baseState, phase: 'arena', arena: { label: 'A', armor: 3, armorTotal: 3 },
    health: { current: 100, max: 100 },
  }));
  assert.equal(objectives.children.length, 4, 'objective rows must be pooled');
  assert.equal(objectives.children[3].hidden, true, 'the surplus row is hidden');
  assert.equal(objectives.children[0].hidden, false);
  assert.equal(doc.getElementById('pause-vitals').children.length, 1);

  // …and back to the longer list: the hidden row returns rather than duplicating.
  menu.render(buildPauseModel(baseState));
  assert.equal(objectives.children.length, 4);
  assert.equal(objectives.children[3].hidden, false);
  assert.equal(doc.getElementById('pause-vitals').children[0].hidden, true);

  // A DOM without the pause skeleton (an older index.html cached in a browser)
  // must not throw — the overlay still works, it just shows no ledger.
  const bare = new PauseMenu({ getElementById: () => null, createElement: () => new ElementMock() });
  bare.render(buildPauseModel(baseState));
}

function testTabsRunStatsAndMemoryDetail() {
  const doc = new DocumentMock();
  const menu = new PauseMenu(doc);
  menu.render(buildPauseModel(baseState));

  // Run tally tiles.
  const run = doc.getElementById('pause-run');
  assert.equal(run.children.length, 4);
  assert.equal(run.children[0]._value.textContent, '1:02:05');
  assert.equal(run.children[3]._label.textContent, 'Times taken by the water');

  // Every pause opens on the Ledger tab.
  assert.equal(doc.getElementById('pause-panel-ledger').classList.contains('active'), true);
  assert.equal(doc.getElementById('pause-panel-memories').hidden, true);
  assert.equal(doc.getElementById('pause-tab-ledger').attributes.get('aria-selected'), 'true');

  // Switching tabs is a click on the strip, and must not resume: the handler is
  // required to stop propagation.
  let propagationStopped = false;
  doc.getElementById('pause-tab-memories').click({ stopPropagation() { propagationStopped = true; } });
  assert.equal(propagationStopped, true, 'tab clicks must not reach the resume backdrop');
  assert.equal(doc.getElementById('pause-panel-memories').classList.contains('active'), true);
  assert.equal(doc.getElementById('pause-panel-ledger').hidden, true);

  // Memories grid: one section per zone, a slot per artifact, empties disabled.
  const groups = doc.getElementById('pause-memory-groups');
  assert.equal(groups.children.length, 3);
  const zone1Slots = groups.children[0]._slots.children;
  assert.equal(zone1Slots.length, 2);
  assert.equal(zone1Slots[0].disabled, false);
  assert.equal(zone1Slots[0]._name.textContent, 'Alpha');
  assert.equal(zone1Slots[0]._art.getAttribute('src'), 'a1.png');
  assert.equal(zone1Slots[1].disabled, true);
  assert.equal(zone1Slots[1]._art.getAttribute('src'), null, 'an empty slot shows no art');
  assert.match(zone1Slots[1].attributes.get('aria-label'), /still lost/i);

  // Clicking a found slot opens the inline detail; an empty one does nothing.
  const detail = doc.getElementById('pause-memory-detail');
  zone1Slots[1].click();
  assert.equal(detail.classList.contains('active'), false);
  zone1Slots[0].click();
  assert.equal(detail.classList.contains('active'), true);
  assert.equal(doc.getElementById('pause-detail-fil').textContent, 'Alpha');
  assert.equal(doc.getElementById('pause-detail-origin').textContent, 'o1');
  assert.equal(doc.getElementById('pause-detail-lore').textContent, 'l1');
  assert.equal(groups.classList.contains('is-behind'), true);

  // Back closes it; so does leaving the tab.
  doc.getElementById('pause-detail-back').click();
  assert.equal(detail.classList.contains('active'), false);
  zone1Slots[0].click();
  doc.getElementById('pause-tab-lore').click();
  assert.equal(detail.classList.contains('active'), false, 'leaving the tab closes the detail');
  assert.equal(doc.getElementById('pause-panel-lore').classList.contains('active'), true);

  // Lore cards.
  const lore = doc.getElementById('pause-lore');
  assert.equal(lore.children.length, 2);
  assert.equal(lore.children[0]._name.textContent, 'PONSIA — 11 / 11 memories restored');
  assert.equal(lore.children[0].classList.contains('is-restored'), true);
  assert.equal(lore.children[0]._meta.children.length, 4, 'two dt/dd pairs');
  assert.equal(lore.children[1].classList.contains('is-restored'), false);

  // Re-opening the menu returns to the Ledger with the detail closed.
  menu.render(buildPauseModel(baseState));
  assert.equal(doc.getElementById('pause-panel-ledger').classList.contains('active'), true);
  assert.equal(detail.classList.contains('active'), false);
}

function testRunTallyAndCollectionModel() {
  const model = buildPauseModel(baseState);
  assert.deepEqual(model.run.map((stat) => [stat.id, stat.value]), [
    ['time', '1:02:05'],          // 3725s reads as h:mm:ss
    ['echoes', '41'],
    ['bugtong', '5 / 7'],
    ['faints', '1'],
  ]);
  // Under an hour drops the hours field entirely.
  assert.equal(buildPauseModel({ ...baseState, run: { ...baseState.run, seconds: 95 } })
    .run[0].value, '1:35');
  // Nothing answered yet reads as a dash, not 0 / 0.
  assert.equal(buildPauseModel({
    ...baseState, run: { ...baseState.run, bugtongCorrect: 0, bugtongWrong: 0 },
  }).run[2].value, '—');
  // No tally wired at all (an older Game) simply omits the section.
  assert.deepEqual(buildPauseModel({ ...baseState, run: null }).run, []);

  const [zone1, zone2, zone3] = model.collection;
  assert.equal(model.collection.length, 3, 'one group per zone that has artifacts');
  assert.equal(zone1.label, 'Zone 1 — PONSIA');
  assert.equal(zone1.countLabel, '1 / 2');
  assert.equal(zone3.countLabel, '0 / 1');
  // A found slot carries its prose; an unfound one must not leak any of it.
  assert.equal(zone1.items[0].fil, 'Alpha');
  assert.deepEqual(Object.keys(zone1.items[1]).sort(), ['found', 'id', 'zone']);
  assert.equal(zone2.items[0].image, 'b1.png');

  const lore = buildPauseModel(baseState).lore;
  assert.equal(lore.length, 2);
  assert.equal(lore[0].countLabel, '11 / 11 memories restored');
  assert.equal(lore[0].restored, true);
  assert.equal(lore[1].restored, false);
}

testTotalsComeFromTheZoneRows();
testRunTallyAndCollectionModel();
testInZoneChecklistMarksExactlyOneActiveStep();
testArenaAndDuelObjectives();
testHubObjectivesAndControlSets();
testRenderWritesAndPoolsNodes();
testTabsRunStatsAndMemoryDetail();

console.log('PauseMenu tests passed');
