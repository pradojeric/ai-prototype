export const ANSWER_LABEL = Object.freeze({
  BASE_WIDTH: 512,
  WIDTHS: [512, 640, 768],
  BASE_HEIGHT: 160,
  HORIZONTAL_PADDING: 64,
  VERTICAL_PADDING: 56,
  FONT_SIZE: 52,
  MIN_FONT_SIZE: 44,
  LINE_HEIGHT: 60,
  MAX_LINES: 3,
  WORLD_WIDTH: 3.2,
});

function wrapParagraph(text, measure, maxWidth) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines = [];
  let line = words[0];
  for (let i = 1; i < words.length; i++) {
    const candidate = `${line} ${words[i]}`;
    if (measure(candidate) <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = words[i];
    }
  }
  lines.push(line);
  return lines;
}

function wrapText(text, measure, maxWidth) {
  return String(text).split(/\r?\n/).flatMap(
    (paragraph) => wrapParagraph(paragraph, measure, maxWidth),
  );
}

function candidate(text, measureText, width, fontSize) {
  const measure = (value) => measureText(value, fontSize);
  const maxTextWidth = width - ANSWER_LABEL.HORIZONTAL_PADDING;
  const lines = wrapText(text, measure, maxTextWidth);
  const fitsWidth = lines.every((line) => measure(line) <= maxTextWidth);
  return { lines, width, fontSize, fitsWidth };
}

export function layoutAnswerLabel(text, measureText) {
  for (const width of ANSWER_LABEL.WIDTHS) {
    const layout = candidate(text, measureText, width, ANSWER_LABEL.FONT_SIZE);
    if (layout.fitsWidth && layout.lines.length <= ANSWER_LABEL.MAX_LINES) {
      return finish(layout, text);
    }
  }

  const widest = ANSWER_LABEL.WIDTHS[ANSWER_LABEL.WIDTHS.length - 1];
  for (let fontSize = ANSWER_LABEL.FONT_SIZE - 2;
    fontSize >= ANSWER_LABEL.MIN_FONT_SIZE; fontSize -= 2) {
    const layout = candidate(text, measureText, widest, fontSize);
    if (layout.fitsWidth && layout.lines.length <= ANSWER_LABEL.MAX_LINES) {
      return finish(layout, text);
    }
  }

  // Emergency protection for future copy beyond the approved content envelope:
  // balance every word into exactly three lines, then derive the font needed to
  // fit. Shipped choices resolve above and never enter this deeper fallback.
  const lines = balanceIntoThreeLines(String(text), measureText, ANSWER_LABEL.MIN_FONT_SIZE);
  const maxTextWidth = widest - ANSWER_LABEL.HORIZONTAL_PADDING;
  const widestLine = Math.max(
    ...lines.map((line) => measureText(line, ANSWER_LABEL.MIN_FONT_SIZE)),
  );
  const fontSize = Math.max(
    1,
    Math.floor(ANSWER_LABEL.MIN_FONT_SIZE * Math.min(1, maxTextWidth / widestLine)),
  );
  return finish({
    lines,
    width: widest,
    fontSize,
    fitsWidth: true,
    emergency: true,
  }, text);
}

function balanceIntoThreeLines(text, measureText, fontSize) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= ANSWER_LABEL.MAX_LINES) return words;
  let best = null;
  for (let first = 1; first < words.length - 1; first++) {
    for (let second = first + 1; second < words.length; second++) {
      const lines = [
        words.slice(0, first).join(' '),
        words.slice(first, second).join(' '),
        words.slice(second).join(' '),
      ];
      const width = Math.max(...lines.map((line) => measureText(line, fontSize)));
      if (!best || width < best.width) best = { lines, width };
    }
  }
  return best.lines;
}

function finish(layout, text) {
  const height = Math.max(
    ANSWER_LABEL.BASE_HEIGHT,
    layout.lines.length * ANSWER_LABEL.LINE_HEIGHT + ANSWER_LABEL.VERTICAL_PADDING,
  );
  return {
    ...layout,
    text: String(text),
    height,
    lineHeight: ANSWER_LABEL.LINE_HEIGHT,
    worldWidth: ANSWER_LABEL.WORLD_WIDTH * (layout.width / ANSWER_LABEL.BASE_WIDTH),
    worldHeight: ANSWER_LABEL.WORLD_WIDTH * (height / ANSWER_LABEL.BASE_WIDTH),
  };
}
