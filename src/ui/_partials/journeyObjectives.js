const HIDDEN = Object.freeze({ mode: 'hidden' });

function progress(current, total) {
  return {
    current,
    total,
    label: `${current} / ${total}`,
  };
}

export function resolveJourneyObjective(state) {
  if (state.endingPlayed || ['title', 'cutscene', 'descend', 'debug'].includes(state.phase) ||
      state.phase.startsWith('ending') || state.phase === 'faint') {
    return HIDDEN;
  }

  if (state.phase === 'arena') {
    return {
      id: 'arena-challenge',
      mode: 'collapsed',
      objective: 'Challenge in progress',
    };
  }

  if (state.phase === 'complete') {
    return {
      id: 'return-museum',
      mode: 'expanded',
      archive: state.zoneLabel,
      story: 'This memory is ready to join the collection.',
      objective: 'Return to the Museum',
    };
  }

  if (state.phase === 'museum') {
    if (state.soulsFound >= state.soulsTotal) {
      return {
        id: 'final-memory',
        mode: 'expanded',
        archive: 'The Guardian Archive',
        story: 'Three Guardian Souls wait within the archive.',
        objective: 'Awaken the Final Memory',
        progress: progress(state.soulsFound, state.soulsTotal),
      };
    }
    return {
      id: 'open-memory',
      mode: 'expanded',
      archive: 'Aking Museo',
      story: 'Another drowned memory stirs beyond the gallery.',
      objective: 'Enter the open memory',
    };
  }

  if (state.phase !== 'playing') return HIDDEN;

  if (!state.guardianDefeated) {
    return {
      id: 'memory-rift',
      mode: 'expanded',
      archive: state.zoneLabel,
      story: 'A Guardian waits within the rift.',
      objective: 'Enter the Memory Rift',
    };
  }

  if (state.memoriesFound < state.memoriesTotal) {
    return {
      id: 'scattered-memories',
      mode: 'expanded',
      archive: state.zoneLabel,
      story: 'The Guardian has fallen. Its memories are scattered.',
      objective: 'Recover the scattered memories',
      progress: progress(state.memoriesFound, state.memoriesTotal),
    };
  }

  if (!state.soulFound) {
    return {
      id: 'guardian-soul',
      mode: 'expanded',
      archive: state.zoneLabel,
      story: 'One final light still binds this place.',
      objective: 'Claim the Guardian Soul',
      progress: progress(0, 1),
    };
  }

  return {
    id: 'return-museum',
    mode: 'expanded',
    archive: state.zoneLabel,
    story: 'This memory is ready to join the collection.',
    objective: 'Return to the Museum',
  };
}

