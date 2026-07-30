// ============================================================
// PAUSE MODEL — snapshot -> view model for the pause ledger
// ============================================================
// Pure and DOM-free, exactly like journeyObjectives.js: `collectPauseState`
// (core/_partials/PauseState.js) reads the Game state machine, this turns it
// into what the screen shows, and PauseMenu.js only paints it. Nothing here
// re-derives a gameplay rule — every count arrives in the snapshot. The one
// import is SurvivalBriefing, itself pure content, so the Survival rite is
// authored once and read by both the pre-run overlay and this Lore tab.
import { survivalBriefingLore } from '../../core/survival/SurvivalBriefing.js';

// An objective step's state. `active` is what the player should be doing NOW;
// there is at most one per list (the first unfinished step in the chain).
const DONE = 'done';
const ACTIVE = 'active';
const TODO = 'todo';

function step(label, status, detail = '') {
  return { label, status, detail };
}

// Walk a list of [label, done, detail] rows in narrative order and mark the
// first not-done row `active`. This is what makes the panel read as a checklist
// of a chapter rather than a single "current objective" line.
function chain(rows) {
  let activeTaken = false;
  return rows.map(([label, done, detail]) => {
    if (done) return step(label, DONE, detail);
    if (activeTaken) return step(label, TODO, detail);
    activeTaken = true;
    return step(label, ACTIVE, detail);
  });
}

// ---- Control reference -----------------------------------------------------
// Grouped key chips rather than one long sentence (the Descend screen owns the
// single-line version). This is the COMPLETE reference — every binding the game
// actually reads — so a player never has to guess that a verb exists. Bindings
// that are real but not live in the current context are still listed, marked
// `available: false` and explained by the group's `note`, because hiding them is
// what made the combat kit look like it did not exist while wading a zone.
//
// Verified against the handlers, not from memory: WASD only (no arrow keys) and
// either Shift in PlayerController; Space is edge-triggered and armed only while
// a fight enables the hop; E / F / R and held left mouse in GameUI.wireGameEvents;
// 1-3 (digits or numpad) in RiddleScreen's key mode, used by Arena 3's seals.
function movementGroup({ jumpEnabled = false, inArena = false, dryFooted = false } = {}) {
  return {
    group: 'Movement',
    items: [
      {
        keys: ['W', 'A', 'S', 'D'],
        // The hub is the one place the player is not knee-deep in water.
        action: dryFooted ? 'Walk the gallery' : 'Wade through the memory',
      },
      { keys: ['Shift'], action: 'Sprint — spends the stamina tank' },
      { keys: ['Mouse'], action: 'Look around' },
      {
        keys: ['Space'],
        action: 'Hop a ground shockwave — costs stamina',
        available: jumpEnabled,
        // The hop is armed by the fights that need it, not a traversal tool.
        note: inArena ? 'Armed only while a fight can floor you' : 'Armed inside a trial',
      },
    ],
  };
}

// The light-bolt kit. It only answers inside a Memory Arena, so outside one the
// rows read as a preview of the trial rather than as controls that do nothing.
function combatGroup(live) {
  return {
    group: 'Combat',
    note: live ? '' : 'Only inside a Memory Arena',
    items: [
      { keys: ['Hold Click'], action: 'Cast light — auto-repeats while held', available: live },
      { keys: ['F'], action: 'Shockwave — shoves and deflects what is closing in', available: live },
      { keys: ['R'], action: 'Release Alab for rapid fire, once it is charged', available: live },
    ],
  };
}

function survivalControls() {
  return [
    {
      group: 'Movement',
      items: [
        { keys: ['W', 'A', 'S', 'D'], action: 'Move through the Memory arena' },
        { keys: ['Shift'], action: 'Sprint — spends the stamina tank' },
        { keys: ['Q'], action: 'Dash — collision-safe and briefly invulnerable' },
        { keys: ['Space'], action: 'Hop a ground shockwave — costs stamina' },
      ],
    },
    {
      group: 'Endless Combat',
      items: [
        { keys: ['Hold Click'], action: 'Fire the selected primary thread' },
        { keys: ['F'], action: 'Release Shockwave Resonance' },
        { keys: ['R'], action: 'Release Alab as weapon-neutral overdrive' },
      ],
    },
    systemGroup(),
  ];
}

function systemGroup() {
  return {
    group: 'System',
    items: [
      { keys: ['Esc'], action: 'Pause, and release the cursor' },
      { keys: ['Click'], action: 'Resume — the click retakes the cursor' },
      { keys: ['Enter'], action: 'Resume from the keyboard' },
      { keys: ['Click'], action: 'Dismiss a memory card or a completion card' },
    ],
  };
}

function controlsFor(context, options = {}) {
  if (context === 'survival') return survivalControls();
  if (context === 'arena') {
    return [
      movementGroup({ jumpEnabled: options.jumpEnabled, inArena: true }),
      combatGroup(true),
      {
        group: 'The Trial',
        items: [
          { keys: ['Click'], action: 'Shoot the answer you believe' },
          { keys: ['1', '2', '3'], action: 'Answer a memory seal by number' },
          { keys: ['E'], action: 'Read a memory seal on the climb' },
        ],
      },
      systemGroup(),
    ];
  }

  if (context === 'museum') {
    return [
      movementGroup({ dryFooted: true }),
      {
        group: 'Aking Museo',
        items: [
          { keys: ['E'], action: 'Revisit a memory on its pedestal' },
          { keys: ['Hold E'], action: 'Awaken the Final Memory at the Soul Altar' },
          { keys: ['Walk'], action: 'Step into an open portal to descend' },
        ],
      },
      combatGroup(false),
      systemGroup(),
    ];
  }

  return [
    movementGroup(),
    {
      group: 'Memories',
      items: [
        { keys: ['E'], action: 'Enter the Memory Rift' },
        { keys: ['Hold E'], action: 'Reach toward a scattered memory' },
        { keys: ['Walk'], action: 'Walk over a Guardian Soul to claim it' },
      ],
    },
    combatGroup(false),
    systemGroup(),
  ];
}

// Fill in the defaults once here so the renderer never has to know that
// `available` and `note` are optional, and fold a row's caveat into its own line
// (a dimmed row that does not say WHY it is dimmed is just a broken row).
function normalizeControls(groups) {
  return groups.map((group) => ({
    group: group.group,
    note: group.note || '',
    items: group.items.map((item) => {
      const available = item.available !== false;
      return {
        keys: item.keys,
        available,
        action: !available && item.note ? `${item.action} · ${item.note}` : item.action,
      };
    }),
  }));
}

// ---- Objective checklists --------------------------------------------------

function objectivesFor(state) {
  const { phase } = state;

  if (phase === 'survival') {
    const wave = state.survival?.wave || 1;
    const remaining = state.survival?.remaining || 0;
    return [
      step(
        `Survive Wave ${wave}`,
        ACTIVE,
        remaining > 0 ? `${remaining} threats remain` : 'The next echo is forming',
      ),
      step(
        state.survival?.nextMilestone || 'Reach the next Woven Gift',
        TODO,
        'Every fifth wave pauses for a draft',
      ),
    ];
  }

  if (phase === 'arena') {
    const total = state.arena?.armorTotal || 0;
    // The Keeper's arena is a straight duel with no riddle rounds, so it reports
    // no wards; the boss health bar is its only honest progress readout.
    if (total <= 0) {
      return chain([
        ['Survive the Guardian’s onslaught', false, 'No bugtong here — this trial is a duel'],
        ['Bring the Guardian down', false, ''],
        ['Carry the memory back to the surface', false, ''],
      ]);
    }
    const broken = total - (state.arena.armor ?? total);
    const unarmored = broken >= total;
    return chain([
      // Once the last ward falls the wave run is over and the duel begins, so
      // that same flag closes the survival step and opens the last one.
      ['Survive the drowned echoes', unarmored, 'Waves attack while the bugtong holds'],
      ['Break the Guardian’s armor', unarmored, `${broken} / ${total} wards broken`],
      ['Carry the memory back to the surface', false, ''],
    ]);
  }

  if (phase === 'museum' || phase === 'endingCredits') {
    const zonesLeft = state.zonesTotal - state.zonesRestored;
    return chain([
      [
        'Descend into an open memory',
        zonesLeft <= 0,
        zonesLeft > 0 ? `${zonesLeft} still drowned` : 'All three answered',
      ],
      [
        'Seat all three Guardian Souls at the altar',
        state.soulsFound >= state.soulsTotal,
        `${state.soulsSeated} / ${state.soulsTotal} seated`,
      ],
      ['Awaken the Final Memory', state.endingPlayed, 'Hold E at the Soul Altar'],
    ]);
  }

  if (phase === 'complete') {
    return chain([
      ['Recover this zone’s memories', true, `${state.memoriesFound} / ${state.memoriesTotal}`],
      ['Claim the Guardian Soul', state.soulFound, ''],
      ['Return to Aking Museo', false, 'Click the card to walk the gallery'],
    ]);
  }

  if (phase === 'descend') {
    return chain([
      ['Descend into the memory', false, state.zoneLabel],
      ['Find the Memory Rift', state.guardianDefeated, ''],
      [
        'Recover the scattered memories',
        state.memoriesTotal > 0 && state.memoriesFound >= state.memoriesTotal,
        `${state.memoriesFound} / ${state.memoriesTotal}`,
      ],
    ]);
  }

  if (phase === 'faint') {
    return [step('Wake, and begin the trial again', ACTIVE, 'The memory holds what it took')];
  }

  if (phase === 'debug') {
    return [step('Guardian showroom — no objectives here', ACTIVE, 'Developer scene')];
  }

  if (phase === 'cutscene' || phase.startsWith('ending')) {
    return [step('The story unfolds', ACTIVE, '')];
  }

  if (phase !== 'playing') {
    return [step('Follow the strings', ACTIVE, '')];
  }

  // In-zone: the full chapter, so the player can see what is still ahead of them.
  return chain([
    ['Enter the Memory Rift', state.guardianDefeated, 'The Guardian waits inside'],
    [
      'Recover the scattered memories',
      state.memoriesTotal > 0 && state.memoriesFound >= state.memoriesTotal,
      `${state.memoriesFound} / ${state.memoriesTotal}`,
    ],
    ['Claim the Guardian Soul', state.soulFound, state.soulFound ? 'Recovered' : 'A light still binds this place'],
    ['Return to Aking Museo', state.zoneRestored, ''],
  ]);
}

// ---- Flavor ----------------------------------------------------------------

const SUBTITLES = {
  playing: 'The drowned city waits.',
  descend: 'The water holds its breath.',
  museum: 'The gallery waits in the quiet.',
  arena: 'The memory holds while you catch your breath.',
  survival: 'The Endless Memory waits between every heartbeat.',
  survivalFaint: 'The thread slips.',
  survivalBriefing: 'The tide has not taken you yet.',
  debug: 'Guardian Debug Zone.',
  faint: 'The darkness waits.',
  complete: 'This memory is ready to come home.',
  cutscene: 'The story waits.',
};

function subtitleFor(phase) {
  if (SUBTITLES[phase]) return SUBTITLES[phase];
  if (phase.startsWith('ending')) return 'The story waits.';
  return 'The drowned city waits.';
}

function locationFor(state) {
  if (state.phase.startsWith('survival')) return 'Endless Memory';
  if (state.phase === 'museum' || state.phase.startsWith('ending')) return 'Aking Museo';
  if (state.phase === 'arena') return state.arena?.label || 'The Memory Arena';
  if (state.phase === 'debug') return 'Guardian Showroom';
  return state.zoneLabel || 'Aking Museo';
}

// `context` picks the control set; it is coarser than `phase` on purpose.
function contextFor(phase) {
  if (phase.startsWith('survival')) return 'survival';
  if (phase === 'arena' || phase === 'faint') return 'arena';
  if (phase === 'museum' || phase.startsWith('ending')) return 'museum';
  return 'explore';
}

// ---- Run tally -------------------------------------------------------------

function clockLabel(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const pad = (value) => String(value).padStart(2, '0');
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds % 60)}`
    : `${minutes}:${pad(seconds % 60)}`;
}

function runStats(state) {
  if (state.survival) {
    const ranks = Object.values(state.survival.build?.ranks || {})
      .reduce((sum, rank) => sum + Math.max(0, Number(rank) || 0), 0);
    const weapon = state.survival.weaponName || 'Light Bolt';
    return [
      { id: 'time', label: 'Active time', value: clockLabel(state.survival.activeSeconds) },
      { id: 'wave', label: 'Current wave', value: String(state.survival.wave) },
      { id: 'echoes', label: 'Echoes dispersed', value: String(state.survival.kills) },
      {
        id: 'bosses',
        label: 'Guardians defeated',
        value: String(state.survival.bossesDefeated),
      },
      { id: 'build', label: 'Primary thread', value: weapon },
      { id: 'upgrades', label: 'Woven Gift ranks', value: String(ranks) },
    ];
  }
  if (!state.run) return [];
  const { bugtongCorrect, bugtongWrong } = state.run;
  const answered = bugtongCorrect + bugtongWrong;
  return [
    { id: 'time', label: 'Time beneath', value: clockLabel(state.run.seconds) },
    { id: 'echoes', label: 'Echoes dispersed', value: String(state.run.echoesDefeated) },
    {
      id: 'bugtong',
      label: 'Bugtong answered',
      value: answered ? `${bugtongCorrect} / ${answered}` : '—',
    },
    { id: 'faints', label: 'Times taken by the water', value: String(state.run.faints) },
  ];
}

// ---- Collection + lore -----------------------------------------------------

// The whole collection, grouped by zone and kept in ARTIFACT_DATA order so a
// slot never moves as it fills. Unfound entries carry no prose: a locked slot
// must not leak the memory it is hiding.
function collection(state) {
  const groups = new Map();
  for (const artifact of state.collection || []) {
    if (!groups.has(artifact.zone)) {
      groups.set(artifact.zone, { zone: artifact.zone, label: '', items: [] });
    }
    groups.get(artifact.zone).items.push(artifact.found
      ? {
        id: artifact.id, found: true, zone: artifact.zone,
        fil: artifact.fil, eng: artifact.eng, image: artifact.image,
        origin: artifact.origin, lore: artifact.lore,
      }
      : { id: artifact.id, found: false, zone: artifact.zone });
  }
  return [...groups.values()].map((group) => {
    const zone = state.zones.find((z) => z.id === `zone${group.zone}`);
    const found = group.items.filter((item) => item.found).length;
    return {
      ...group,
      label: zone?.label || `Zone ${group.zone}`,
      countLabel: `${found} / ${group.items.length}`,
    };
  });
}

// The Lore tab. Inside a Survival run the mode's briefing leads the tab, so the
// rite the player confirmed before Wave 1 stays re-readable mid-run (the briefing
// overlay itself is gone by then) without a second copy of that copy.
function lore(state) {
  const entries = contextFor(state.phase) === 'survival'
    ? [...survivalBriefingLore(), ...(state.lore || [])]
    : (state.lore || []);
  return entries.map((entry) => {
    const zone = state.zones.find((z) => z.id === `zone${entry.zone}`);
    return {
      ...entry,
      countLabel: zone ? `${zone.found} / ${zone.total} memories restored` : '',
      restored: !!zone && zone.total > 0 && zone.found >= zone.total,
    };
  });
}

export function buildPauseModel(state) {
  const memoriesTotal = state.zones.reduce((sum, zone) => sum + zone.total, 0);
  const memoriesFound = state.zones.reduce((sum, zone) => sum + zone.found, 0);

  return {
    location: locationFor(state),
    subtitle: subtitleFor(state.phase),
    objectives: objectivesFor(state),
    memories: {
      found: memoriesFound,
      total: memoriesTotal,
      label: `${memoriesFound} / ${memoriesTotal}`,
      zones: state.zones.map((zone) => ({
        id: zone.id,
        label: zone.label,
        found: zone.found,
        total: zone.total,
        countLabel: `${zone.found} / ${zone.total}`,
        complete: zone.total > 0 && zone.found >= zone.total,
        locked: !!zone.locked,
      })),
    },
    souls: {
      found: state.soulsFound,
      total: state.soulsTotal,
      seated: state.soulsSeated,
      label: `${state.soulsFound} / ${state.soulsTotal}`,
    },
    zonesRestored: {
      found: state.zonesRestored,
      total: state.zonesTotal,
      label: `${state.zonesRestored} / ${state.zonesTotal}`,
    },
    // Vitals only exist where they can change: the arena owns player health.
    vitals: state.health
      ? [{
        id: 'health',
        label: 'Vitality',
        value: Math.max(0, Math.round(state.health.current)),
        max: state.health.max,
        countLabel: `${Math.max(0, Math.round(state.health.current))} / ${state.health.max}`,
      }]
      : [],
    controls: normalizeControls(
      controlsFor(contextFor(state.phase), { jumpEnabled: state.jumpEnabled }),
    ),
    run: runStats(state),
    survival: state.survival || null,
    collection: collection(state),
    lore: lore(state),
  };
}
