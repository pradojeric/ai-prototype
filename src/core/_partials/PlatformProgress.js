// The portal reward belongs to the real campaign-completion transition, not to
// individual collections or state fabricated by presentation/debug shortcuts.
export function canUnlockPlatformArtifact(zoneOrder, completed, rewardEligible) {
  return Boolean(
    rewardEligible &&
    Array.isArray(zoneOrder) &&
    zoneOrder.length > 0 &&
    completed?.has &&
    zoneOrder.every((zoneId) => completed.has(zoneId)),
  );
}

export function queuePlatformArtifactForCampaign(api, zoneOrder, completed, rewardEligible) {
  if (!canUnlockPlatformArtifact(zoneOrder, completed, rewardEligible)) return false;
  void api.requestArtifactUnlock();
  return true;
}
