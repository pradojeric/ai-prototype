// ============================================================
// DASH MOTION — dependency-free collision-safe horizontal stepping.
// ============================================================
// PlayerController owns input, charges, timing, and invulnerability. This helper
// owns only the spatial contract so tunnelling can be tested without a DOM,
// PointerLockControls, or Three.js scene.

export function moveDashWithCollision(
  position,
  direction,
  distance,
  collide,
  supportY = 0,
  maxStep = 0.25,
) {
  const requested = Math.max(0, Number(distance) || 0);
  const length = Math.hypot(direction?.x || 0, direction?.z || 0);
  if (requested <= 0 || length <= 0.0001) return 0;

  const nx = direction.x / length;
  const nz = direction.z / length;
  const stepLimit = Math.max(0.05, Number(maxStep) || 0.25);
  const steps = Math.max(1, Math.ceil(requested / stepLimit));
  const step = requested / steps;
  let travelled = 0;

  for (let i = 0; i < steps; i++) {
    const nextX = position.x + nx * step;
    const nextZ = position.z + nz * step;
    if (collide?.(nextX, nextZ, supportY)) break;
    position.x = nextX;
    position.z = nextZ;
    travelled += step;
  }
  return travelled;
}
