// Dependency-free dash constants and invulnerability timing for deterministic tests.
export const SURVIVAL_DASH_DEFAULTS = Object.freeze({
  charges: 1,
  recharge: 4,
  distance: 4.5,
  duration: 0.16,
  invulnerability: 0.22,
  collisionStep: 0.25,
});

export function beginDashInvulnerability(config = SURVIVAL_DASH_DEFAULTS) {
  return Math.max(0, Number(config.invulnerability) || 0);
}

export function advanceDashInvulnerability(remaining, deltaSeconds) {
  return Math.max(
    0,
    (Number(remaining) || 0) - Math.max(0, Number(deltaSeconds) || 0),
  );
}

