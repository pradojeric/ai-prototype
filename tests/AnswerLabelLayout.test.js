import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ANSWER_LABEL,
  layoutAnswerLabel,
} from '../src/core/arena/_partials/AnswerLabelLayout.js';

const measureText = (text, fontSize) => {
  let units = 0;
  for (const character of text) {
    if (character === ' ') units += 0.32;
    else if (/[A-ZMW]/.test(character)) units += 0.72;
    else if (/[.,'’il]/.test(character)) units += 0.3;
    else units += 0.54;
  }
  return units * fontSize;
};

function normalized(text) {
  return text.trim().replace(/\s+/g, ' ');
}

function assertPreserved(layout, source) {
  assert.equal(normalized(layout.lines.join(' ')), normalized(source));
  assert.ok(layout.lines.length <= ANSWER_LABEL.MAX_LINES);
  if (!layout.emergency) assert.ok(layout.fontSize >= ANSWER_LABEL.MIN_FONT_SIZE);
}

const single = layoutAnswerLabel('Bangka', measureText);
assert.equal(single.lines.length, 1);
assert.equal(single.width, ANSWER_LABEL.BASE_WIDTH);
assert.equal(single.height, ANSWER_LABEL.BASE_HEIGHT);
assertPreserved(single, 'Bangka');

const doubleText = 'A lantern carried through the tide';
const double = layoutAnswerLabel(doubleText, measureText);
assert.equal(double.lines.length, 2);
assert.ok(double.height > ANSWER_LABEL.BASE_HEIGHT);
assertPreserved(double, doubleText);

const tripleText = 'The quiet memory hidden beneath the oldest market doorway';
const triple = layoutAnswerLabel(tripleText, measureText);
assert.equal(triple.lines.length, 3);
assertPreserved(triple, tripleText);

const widenedText = 'The quiet memory hidden beneath the oldest market doorway';
const widened = layoutAnswerLabel(widenedText, measureText);
assert.ok(widened.width > ANSWER_LABEL.BASE_WIDTH);
assert.equal(widened.fontSize, ANSWER_LABEL.FONT_SIZE, 'width must expand before font fallback');
assertPreserved(widened, widenedText);

const fallbackText =
  'The carefully woven festival lantern remembered by every family along the river';
const fallback = layoutAnswerLabel(fallbackText, measureText);
assert.equal(fallback.width, ANSWER_LABEL.WIDTHS.at(-1));
assert.ok(fallback.fontSize < ANSWER_LABEL.FONT_SIZE);
assert.ok(fallback.fontSize >= ANSWER_LABEL.MIN_FONT_SIZE);
assertPreserved(fallback, fallbackText);

assert.ok(widened.worldWidth > single.worldWidth);
assert.ok(triple.worldHeight > single.worldHeight);

const emergencyText =
  'The longest ceremonial remembrance carried from the distant shoreline through the crowded market and returned to the waiting family before dawn';
const emergency = layoutAnswerLabel(emergencyText, measureText);
assert.equal(emergency.lines.length, ANSWER_LABEL.MAX_LINES);
assert.equal(emergency.emergency, true);
assertPreserved(emergency, emergencyText);

const sourceFiles = [
  new URL('../src/data/riddles-part1.js', import.meta.url),
  new URL('../src/data/riddles-part2.js', import.meta.url),
];
const shippedChoices = sourceFiles.flatMap((url) => {
  const source = readFileSync(url, 'utf8');
  return [...source.matchAll(/\{\s*text:\s*'((?:\\.|[^'])*)',\s*correct:/g)]
    .map((match) => match[1].replace(/\\'/g, '\'').replace(/\\\\/g, '\\'));
});
assert.equal(shippedChoices.length, 381);
for (const choice of shippedChoices) {
  const layout = layoutAnswerLabel(choice, measureText);
  assertPreserved(layout, choice);
  assert.notEqual(layout.emergency, true, `shipped choice exceeded safe layout: ${choice}`);
}

console.log('AnswerLabelLayout tests passed');
