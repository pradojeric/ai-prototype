// ============================================================
// SURVIVAL BRIEFING VIEW — paints the pre-run explanation overlay
// ============================================================
// Split out of SurvivalUI because this is a one-shot DOM build, not part of the
// per-frame HUD path. Content comes entirely from SurvivalBriefing.js; nothing
// here knows a rule, only how to lay one out.
import { SURVIVAL_BRIEFING } from '../../core/survival/SurvivalBriefing.js';

// Painted once per page: the briefing text never changes within a session, so a
// repeat entry through the arch re-shows the same nodes instead of rebuilding.
export function paintSurvivalBriefing(elements, briefing = SURVIVAL_BRIEFING) {
  const doc = elements.document;
  if (!doc) return false;

  if (elements.kicker) elements.kicker.textContent = briefing.kicker;
  if (elements.title) elements.title.textContent = briefing.title;

  if (elements.lede) {
    elements.lede.textContent = '';
    for (const paragraph of briefing.narrative) {
      const p = doc.createElement('p');
      p.textContent = paragraph;
      elements.lede.appendChild(p);
    }
  }

  if (elements.sections) {
    elements.sections.textContent = '';
    for (const section of briefing.sections) {
      elements.sections.appendChild(buildSection(doc, section));
    }
  }

  if (elements.lineFil) elements.lineFil.textContent = briefing.line;
  if (elements.lineEng) elements.lineEng.textContent = briefing.lineEn;
  if (elements.begin) elements.begin.textContent = briefing.action;
  return true;
}

function buildSection(doc, section) {
  const column = doc.createElement('section');
  column.className = `survival-briefing-section is-${section.id}`;

  const heading = doc.createElement('h3');
  heading.textContent = section.heading;
  column.appendChild(heading);

  const list = doc.createElement('dl');
  list.className = 'survival-briefing-list';
  for (const item of section.items) {
    const row = doc.createElement('div');
    row.className = 'survival-briefing-row';

    const term = doc.createElement('dt');
    // A control row leads with its keys so the eye can scan bindings; a rule row
    // leads with its name.
    if (item.keys?.length) {
      const keys = doc.createElement('span');
      keys.className = 'survival-briefing-keys';
      for (const key of item.keys) {
        const kbd = doc.createElement('kbd');
        kbd.textContent = key;
        keys.appendChild(kbd);
      }
      term.appendChild(keys);
    }
    const label = doc.createElement('span');
    label.className = 'survival-briefing-term';
    label.textContent = item.term;
    term.appendChild(label);

    const detail = doc.createElement('dd');
    detail.textContent = item.detail;

    row.append(term, detail);
    list.appendChild(row);
  }
  column.appendChild(list);
  return column;
}
