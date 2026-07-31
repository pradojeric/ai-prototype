// Descend card — the timed plate that names a memory on the way into a zone.
// The driver is DOM-only (no Three.js, no config import) precisely so it can be
// exercised here against a fake document.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DescendCard } from '../src/ui/_partials/descendCard.js';

// Sub-millisecond phases: the assertions are about ordering and gating, not feel.
const FAST = Object.freeze({ FADE_IN: 0.004, HOLD: 0.004, FADE_OUT: 0.004 });

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
    ['descend-card', 'descend-card-kicker', 'descend-card-name', 'descend-card-quote']
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
  return { doc, card: new DescendCard(doc), overlay: doc.el('descend-card') };
}

const settle = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The ordinary route in: the player walks a museum portal still pointer-locked,
// so the card is pure ceremony. play() paints and holds; dismiss() clears it.
async function testTimedCardPaintsThenDismisses() {
  const { doc, card, overlay } = build();
  const done = card.play({
    kicker: 'Descending into',
    title: 'Zone 2 — LIKET (Festival Zone)',
    quote: '"Beneath the water, the city still breathes."',
    timing: FAST,
  });

  assert.equal(card.active, true);
  assert.equal(overlay.hidden, false);
  assert.equal(overlay.classList.contains('active'), true);
  assert.equal(overlay.attributes['aria-hidden'], 'false');
  assert.equal(doc.el('descend-card-kicker').textContent, 'Descending into');
  assert.equal(doc.el('descend-card-name').textContent, 'Zone 2 — LIKET (Festival Zone)');
  assert.equal(doc.el('descend-card-quote').textContent, '"Beneath the water, the city still breathes."');
  // The CSS transition must read the same duration the JS timer is counting.
  assert.equal(overlay.style.props['--descend-card-fade'], `${FAST.FADE_IN}s`);

  assert.equal(await done, true);
  assert.equal(card.active, false, 'the timed part is over…');
  assert.equal(overlay.hidden, false, '…but the card stays up until the caller decides');
  assert.equal(doc.listeners.length, 1, 'and keeps swallowing input meanwhile');

  assert.equal(await card.dismiss(), true);
  assert.equal(card.awaitingClick, false);
  assert.equal(overlay.hidden, true, 'card must not keep covering the zone once done');
  assert.equal(overlay.style.pointerEvents, 'none');
  assert.equal(overlay.attributes['aria-hidden'], 'true');
  assert.equal(doc.listeners.length, 0, 'document keydown listener must be released');
}

// Not skippable: the whole point is a fixed two-second beat, and the player is
// still pointer-locked underneath, so a key held from the walk through the portal
// must not reach the zone.
async function testInputIsSwallowedForTheWholeTimedLife() {
  const { doc, card } = build();
  const done = card.play({ title: 'Zone 1 — PONSIA', timing: { ...FAST, HOLD: 5 } });

  const early = press();
  doc.dispatch(early);
  assert.equal(early.defaultPrevented, true, 'presses must be swallowed');
  assert.equal(card.active, true, 'and must never cut the card short');

  await settle(20);
  doc.dispatch(press());
  assert.equal(card.active, true, 'still no skip, however late the press');

  card.cancel();
  assert.equal(await done, false);
}

// Safety net only: every entry path arranges pointer lock from its own gesture,
// but if the browser refused it, the card waits rather than dropping the player
// into a zone they cannot look around in.
async function testHoldForClickIsTheLockRefusedFallback() {
  const { doc, card, overlay } = build();

  assert.equal(await card.play({ title: 'Zone 1 — PONSIA', timing: FAST }), true);
  card.holdForClick();

  assert.equal(card.active, false);
  assert.equal(card.awaitingClick, true, 'the card is still up, asking for a gesture');
  assert.equal(overlay.hidden, false);
  assert.equal(overlay.classList.contains('active'), true);
  assert.equal(overlay.classList.contains('awaiting-click'), true, 'prompt + gear must be revealed');
  assert.equal(overlay.style.pointerEvents, 'auto', 'the click has to reach the overlay');
  assert.equal(doc.listeners.length, 0, 'swallowing stops — this click IS the gesture');

  // Pointer lock granted: the lock listener drops the card.
  assert.equal(await card.dismiss(), true);
  assert.equal(card.awaitingClick, false);
  assert.equal(overlay.hidden, true);
  assert.equal(overlay.attributes['aria-hidden'], 'true');
}

// Restart-this-memory during a card routes straight back through _loadZone.
async function testReplayCollapsesThePreviousCard() {
  const { doc, card, overlay } = build();
  const first = card.play({ title: 'Zone 3', timing: { ...FAST, HOLD: 5 } });
  const second = card.play({ title: 'Zone 1 — PONSIA', timing: FAST });

  assert.equal(await first, false, 'the superseded card resolves false');
  assert.equal(await second, true);
  assert.equal(doc.el('descend-card-name').textContent, 'Zone 1 — PONSIA');
  await card.dismiss();
  assert.equal(overlay.hidden, true, 'only one card survives, and it cleans up');
  assert.equal(doc.listeners.length, 0, 'no timers or listeners left from the first');
}

// A missing overlay must never strand the player on a black screen.
async function testMissingDomDoesNotBlockEntry() {
  const doc = fakeElement('#document');
  doc.getElementById = () => null;
  const card = new DescendCard(doc);
  assert.equal(await card.play({ title: 'Zone 1' }), false);
  assert.equal(card.active, false);
}

function testMarkupAndStyleContract() {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['descend-card', 'descend-card-kicker', 'descend-card-name', 'descend-card-quote']) {
    assert.match(html, new RegExp(`id="${id}"`), `missing #${id}`);
  }
  assert.match(html, /_partials\/descend-card\.css/, 'descend card stylesheet must be linked');
  assert.match(
    html,
    /id="descend-card"[^>]*hidden/,
    'the card must start hidden so it never covers the title screen',
  );
  // The old click-gate is gone; nothing may still reference it.
  assert.doesNotMatch(html, /id="start"/, 'the click-to-descend screen was replaced by the card');
  assert.doesNotMatch(html, /id="start-zone"/);

  const css = readFileSync(new URL('../_partials/descend-card.css', import.meta.url), 'utf8');
  const zIndex = Number(css.match(/#descend-card \{[^}]*z-index:\s*(\d+)/s)?.[1]);
  assert.ok(zIndex > 10, 'the card must sit above the HUD overlays');
  assert.ok(zIndex < 35, 'but below the pause overlay, which can open on top of it');
}

// The JS fallback timing and CONFIG.DESCEND_CARD must not drift apart, and the
// card must stay near the ~2s the design calls for.
function testConfigContract() {
  const config = readFileSync(new URL('../src/config.js', import.meta.url), 'utf8');
  const block = config.match(/export const DESCEND_CARD = \{([^}]*)\}/s)?.[1];
  assert.ok(block, 'CONFIG must own the descend card timing');
  const value = (key) => Number(block.match(new RegExp(`${key}:\\s*([\\d.]+)`))?.[1]);
  const total = value('FADE_IN') + value('HOLD') + value('FADE_OUT');
  assert.ok(total > 1.5 && total < 2.6, `descend card runs ${total}s, expected roughly 2s`);

  const driver = readFileSync(new URL('../src/ui/_partials/descendCard.js', import.meta.url), 'utf8');
  const fallback = driver.match(/FALLBACK_TIMING = Object\.freeze\(\{([^}]*)\}/s)?.[1];
  for (const key of ['FADE_IN', 'HOLD', 'FADE_OUT']) {
    const configured = value(key);
    const fell = Number(fallback.match(new RegExp(`${key}:\\s*([\\d.]+)`))?.[1]);
    assert.equal(fell, configured, `${key} fallback must mirror CONFIG.DESCEND_CARD`);
  }
}

await testTimedCardPaintsThenDismisses();
await testInputIsSwallowedForTheWholeTimedLife();
await testHoldForClickIsTheLockRefusedFallback();
await testReplayCollapsesThePreviousCard();
await testMissingDomDoesNotBlockEntry();
testMarkupAndStyleContract();
testConfigContract();

console.log('Descend card tests passed');
