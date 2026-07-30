// Survival mode title card — the black plate that names the mode before the
// briefing. The driver is DOM-only (no Three.js, no config import) precisely so
// it can be exercised here against a fake document.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SurvivalTitleCard } from '../src/ui/_partials/survivalTitleCard.js';

// Sub-millisecond phases: the assertions are about ordering and gating, not feel.
const FAST = Object.freeze({
  FADE_IN: 0.004,
  HOLD: 0.004,
  FADE_OUT: 0.004,
  SKIP_AFTER: 0.004,
  SKIP_FADE: 0.002,
});

function fakeElement(id) {
  const classes = new Set();
  return {
    id,
    hidden: true,
    offsetWidth: 0,
    textContent: '',
    attributes: {},
    listeners: [],
    style: {
      props: {},
      setProperty(name, value) { this.props[name] = value; },
    },
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
    },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(type, handler, capture) { this.listeners.push({ type, handler, capture }); },
    removeEventListener(type, handler, capture) {
      const index = this.listeners.findIndex((entry) => (
        entry.type === type && entry.handler === handler && entry.capture === capture
      ));
      if (index >= 0) this.listeners.splice(index, 1);
    },
    dispatch(event) {
      for (const entry of [...this.listeners]) {
        if (entry.type === event.type) entry.handler(event);
      }
    },
  };
}

function fakeDocument() {
  const elements = new Map(
    ['survival-title', 'survival-title-kicker', 'survival-title-name']
      .map((id) => [id, fakeElement(id)]),
  );
  const doc = fakeElement('#document');
  doc.getElementById = (id) => elements.get(id) ?? null;
  doc.el = (id) => elements.get(id);
  return doc;
}

function press(code = 'Space') {
  let defaultPrevented = false;
  return {
    type: 'keydown',
    code,
    repeat: false,
    get defaultPrevented() { return defaultPrevented; },
    preventDefault() { defaultPrevented = true; },
    stopPropagation() {},
  };
}

function build() {
  const doc = fakeDocument();
  return { doc, card: new SurvivalTitleCard(doc), overlay: doc.el('survival-title') };
}

async function testPlaysAndPaintsCopy() {
  const { doc, card, overlay } = build();
  const done = card.play({ kicker: 'Beyond the last memory', title: 'Endless Echoes', timing: FAST });

  assert.equal(card.active, true);
  assert.equal(overlay.hidden, false);
  assert.equal(overlay.classList.contains('active'), true);
  assert.equal(overlay.attributes['aria-hidden'], 'false');
  assert.equal(doc.el('survival-title-kicker').textContent, 'Beyond the last memory');
  assert.equal(doc.el('survival-title-name').textContent, 'Endless Echoes');
  // The CSS transition must read the same duration the JS timer is counting.
  assert.equal(overlay.style.props['--survival-title-fade'], `${FAST.FADE_IN}s`);

  assert.equal(await done, true, 'an unskipped card resolves true');
  assert.equal(card.active, false);
  assert.equal(overlay.hidden, true, 'card must not keep swallowing input once done');
  assert.equal(overlay.classList.contains('active'), false);
  assert.equal(overlay.style.pointerEvents, 'none');
  assert.equal(doc.listeners.length, 0, 'document keydown listener must be released');
}

// The card sits ON TOP of the already-painted briefing, so it has to eat input
// from frame one — but only honour a skip after SKIP_AFTER, or the click that
// walked the player into the arch would consume its own title card.
async function testSkipIsGatedThenHonoured() {
  const { doc, card } = build();
  const slow = { ...FAST, SKIP_AFTER: 0.02, HOLD: 5, FADE_IN: 0.001 };
  const done = card.play({ title: 'Endless Echoes', timing: slow });

  const early = press();
  doc.dispatch(early);
  assert.equal(card.active, true, 'a press inside SKIP_AFTER must not skip');
  assert.equal(early.defaultPrevented, true, 'but it must still be swallowed');

  await new Promise((resolve) => setTimeout(resolve, 40));
  doc.dispatch(press());
  assert.equal(await done, false, 'a skipped card resolves false');
}

async function testModifiersAndRepeatsAreNotSkips() {
  const { doc, card } = build();
  const done = card.play({ title: 'Endless Echoes', timing: { ...FAST, SKIP_AFTER: 0, HOLD: 5 } });
  await new Promise((resolve) => setTimeout(resolve, 10));

  doc.dispatch({ ...press(), repeat: true });
  doc.dispatch({ ...press('KeyR'), metaKey: true });
  assert.equal(card.active, true, 'held keys and Cmd/Ctrl chords are not a skip');

  card.cancel();
  assert.equal(await done, false);
}

// Retry and return-to-museum both route through SurvivalUI.hideAll().
async function testCancelTearsDownImmediately() {
  const { doc, card, overlay } = build();
  const done = card.play({ title: 'Endless Echoes', timing: { ...FAST, HOLD: 5 } });
  card.cancel();

  assert.equal(card.active, false);
  assert.equal(overlay.hidden, true);
  assert.equal(overlay.attributes['aria-hidden'], 'true');
  assert.equal(doc.listeners.length, 0);
  assert.equal(await done, false);

  // A second entry while one card is up must not stack timers on the element.
  const first = card.play({ title: 'A', timing: { ...FAST, HOLD: 5 } });
  const second = card.play({ title: 'B', timing: FAST });
  assert.equal(await first, false);
  assert.equal(await second, true);
  assert.equal(doc.el('survival-title-name').textContent, 'B');
}

function testMissingDomDoesNotBlockEntry() {
  const bare = fakeElement('#document');
  bare.getElementById = () => null;
  const card = new SurvivalTitleCard(bare);
  assert.equal(card.active, false);
  return card.play({ title: 'Endless Echoes' }).then((played) => {
    assert.equal(played, false, 'no markup must resolve rather than stall Survival entry');
  });
}

function testMarkupAndStyleContract() {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['survival-title', 'survival-title-kicker', 'survival-title-name']) {
    assert.match(html, new RegExp(`id="${id}"`), `missing #${id}`);
  }
  assert.match(html, /_partials\/survival-title\.css/, 'title card stylesheet must be linked');
  assert.match(
    html,
    /id="survival-title"[^>]*hidden/,
    'the card must start hidden so it never covers the museum',
  );
  // Empty in markup: the copy comes from SurvivalBriefing.js, so the mode's name
  // exists in exactly one place.
  assert.match(html, /id="survival-title-kicker"><\/p>/);
  assert.match(html, /id="survival-title-name"><\/h2>/);

  const css = readFileSync(new URL('../_partials/survival-title.css', import.meta.url), 'utf8');
  const zIndex = Number(css.match(/#survival-title \{[^}]*z-index:\s*(\d+)/s)?.[1]);
  assert.ok(zIndex > 40, 'the card must sit above the briefing overlay (z-index 40)');
}

await testPlaysAndPaintsCopy();
await testSkipIsGatedThenHonoured();
await testModifiersAndRepeatsAreNotSkips();
await testCancelTearsDownImmediately();
await testMissingDomDoesNotBlockEntry();
testMarkupAndStyleContract();

console.log('Survival title card tests passed');
