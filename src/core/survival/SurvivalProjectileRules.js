// ============================================================
// SURVIVAL PROJECTILE RULES — dependency-free swept hit tests.
// ============================================================
// Rapid Weave can cross more than two metres in a single capped frame. Testing
// only its end point would let it tunnel through small threats, so Survival
// resolves the whole travelled segment against each target sphere.

export function segmentSphereHitFraction(start, end, center, radius) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dz = end.z - start.z;
  const ox = start.x - center.x;
  const oy = start.y - center.y;
  const oz = start.z - center.z;
  const radiusSq = radius * radius;
  const startDistanceSq = ox * ox + oy * oy + oz * oz;
  if (startDistanceSq <= radiusSq) return 0;

  const segmentLengthSq = dx * dx + dy * dy + dz * dz;
  if (segmentLengthSq <= Number.EPSILON) return Infinity;
  const b = 2 * (ox * dx + oy * dy + oz * dz);
  const c = startDistanceSq - radiusSq;
  const discriminant = b * b - 4 * segmentLengthSq * c;
  if (discriminant < 0) return Infinity;
  const fraction = (-b - Math.sqrt(discriminant)) / (2 * segmentLengthSq);
  return fraction >= 0 && fraction <= 1 ? fraction : Infinity;
}
