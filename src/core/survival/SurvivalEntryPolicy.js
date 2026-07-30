// Survival is reached by walking into the Endless Echoes arch in the museum
// lobby — never a title unlock and never a persisted entitlement. The arch opens
// because the ending has been seen (the epilogue museum), or immediately when
// CONFIG.DEBUG_SURVIVAL_UNLOCKED is set for testing.

export function isSurvivalPortalOpen({
  epilogueMode = false,
  debugUnlocked = false,
} = {}) {
  return !!(epilogueMode || debugUnlocked);
}

// The hub is the only phase that can walk into the arch; every cutscene, zone,
// and Survival phase must refuse so a run cannot be re-entered from inside one.
export function canEnterSurvivalFromHub(phase, options) {
  return phase === 'museum' && isSurvivalPortalOpen(options);
}
