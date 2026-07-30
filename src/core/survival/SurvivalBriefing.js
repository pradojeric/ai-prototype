// ============================================================
// SURVIVAL BRIEFING — the rite explained before Wave 1
// ============================================================
// The mode's only teaching surface. It is DOM-free and Three.js-free on purpose:
// SurvivalUI paints it as the pre-run overlay, and pauseModel folds the same
// sections into the pause Lore tab so a player mid-run can re-read the rules
// without a second copy of the copy drifting out of sync.
//
// Every number here is DERIVED from SurvivalRules, never retyped — the draft
// cadence, threat cap and boss period are balance knobs, and a briefing that
// lies about them is worse than no briefing.
import {
  isSurvivalBossWave,
  SURVIVAL_DRAFT_INTERVAL,
  SURVIVAL_FIRST_DRAFT_WAVE,
  SURVIVAL_THREAT_CAP,
} from './SurvivalRules.js';

// Rules exposes the boss *test*, not the period, so the cadence is recovered by
// asking it — retyping "every 10th wave" here is exactly how a briefing goes stale.
function firstBossWave() {
  for (let wave = 1; wave <= 100; wave++) {
    if (isSurvivalBossWave(wave)) return wave;
  }
  return 10;
}

const BOSS_PERIOD = firstBossWave();

const ordinalWord = (n) => ({ 1: 'first', 2: 'second', 3: 'third' }[n] ?? `${n}th`);

export const SURVIVAL_BRIEFING = Object.freeze({
  kicker: 'Beyond the last memory',
  title: 'Endless Echoes',
  // Narrative framing (GDD §6 — the museum keeps what was recovered; the arch
  // keeps what was never named).
  narrative: Object.freeze([
    'The Aking Museo holds every memory you carried back. This arch holds the ones that were never named — echoes that surface, dissolve, and surface again.',
    'Nothing here can be restored. You wade in to see how long the thread holds.',
  ]),
  line: 'Ang alon ay walang hanggan.',
  lineEn: 'The tide has no end.',
  sections: Object.freeze([
    Object.freeze({
      id: 'loop',
      heading: 'The rite',
      items: Object.freeze([
        Object.freeze({
          term: 'Endless waves',
          detail: `Clear every echo in a wave and the next one rises. At most ${SURVIVAL_THREAT_CAP} press you at once — the rest wait their turn.`,
        }),
        Object.freeze({
          term: 'Woven Gifts',
          detail: `A draft of three gifts opens on Wave ${SURVIVAL_FIRST_DRAFT_WAVE}, then every ${SURVIVAL_DRAFT_INTERVAL === 1 ? 'wave' : `${ordinalWord(SURVIVAL_DRAFT_INTERVAL)} wave`}. Take one. Gifts stack in ranks and can reshape your primary thread.`,
        }),
        Object.freeze({
          term: 'Guardians',
          // Deliberately does NOT quote a reroll cap: SurvivalController currently
          // starts a run with 99 rerolls, so SURVIVAL_REROLL_CAP is not the number
          // the player actually experiences. Restore the cap wording here if and
          // when the controller starts honouring it.
          detail: `Every ${ordinalWord(BOSS_PERIOD)} wave is a Guardian of Endless Memory. Beating one earns another reroll, and the HUD shows how many you hold.`,
        }),
        Object.freeze({
          term: 'One thread',
          detail: 'There is no healing between waves and no checkpoint. When your vitality empties, the run ends and the ledger is read.',
        }),
      ]),
    }),
    Object.freeze({
      id: 'controls',
      heading: 'Your hands',
      items: Object.freeze([
        Object.freeze({ keys: Object.freeze(['W', 'A', 'S', 'D']), term: 'Move', detail: 'Shift sprints, and spends the stamina tank.' }),
        Object.freeze({ keys: Object.freeze(['Q']), term: 'Dash', detail: 'Passes through what would block you, and cannot be hurt mid-dash. Charges refill over time.' }),
        Object.freeze({ keys: Object.freeze(['Space']), term: 'Hop', detail: 'Clears a ground shockwave. Costs stamina.' }),
        Object.freeze({ keys: Object.freeze(['Hold Click']), term: 'Cast', detail: 'Fires your primary thread while held. It builds heat — let it cool before it overloads.' }),
        Object.freeze({ keys: Object.freeze(['F']), term: 'Shockwave', detail: 'Shoves back and deflects what is closing in.' }),
        Object.freeze({ keys: Object.freeze(['R']), term: 'Alab', detail: 'Overdrive once charged, whatever thread you carry.' }),
        Object.freeze({ keys: Object.freeze(['Esc']), term: 'Pause', detail: 'The ledger holds this briefing under Lore, mid-run.' }),
      ]),
    }),
    Object.freeze({
      id: 'scoring',
      heading: 'The ledger',
      items: Object.freeze([
        Object.freeze({ term: 'Wave reached', detail: 'The headline number, and the first tiebreak for a session best.' }),
        Object.freeze({ term: 'Active time', detail: 'Time on your feet. Paused frames and draft screens are not counted.' }),
        Object.freeze({ term: 'Echoes dispersed', detail: 'Every threat you unwove this run.' }),
        Object.freeze({ term: 'Guardians defeated', detail: 'The boss waves you survived.' }),
      ]),
    }),
  ]),
  action: 'Enter the tide',
});

// The same briefing as pause-Lore cards. Shaped to the zone-lore contract
// (name / subtitle / body / line / lineEn / guardian / trial) so PauseCollection
// renders it with no second card layout; `countLabel` stays empty because a
// briefing has nothing to restore.
export function survivalBriefingLore() {
  const summarize = (section) => section.items
    .map((item) => `${item.term} — ${item.detail}`)
    .join(' ');

  return [
    {
      id: 'survival-briefing',
      zone: null,
      name: SURVIVAL_BRIEFING.title,
      subtitle: SURVIVAL_BRIEFING.kicker,
      body: SURVIVAL_BRIEFING.narrative.join(' '),
      line: SURVIVAL_BRIEFING.line,
      lineEn: SURVIVAL_BRIEFING.lineEn,
      guardian: `Every ${ordinalWord(BOSS_PERIOD)} wave`,
      trial: 'No end, only the ledger',
    },
    ...SURVIVAL_BRIEFING.sections.map((section) => ({
      id: `survival-briefing-${section.id}`,
      zone: null,
      name: section.heading,
      subtitle: SURVIVAL_BRIEFING.title,
      body: summarize(section),
      line: '',
      lineEn: '',
      guardian: '',
      trial: '',
    })),
  ];
}
