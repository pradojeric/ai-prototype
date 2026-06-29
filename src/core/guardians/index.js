// ============================================================
// GUARDIAN BUILDERS — per-zone registry. Each zone's Guardian has a distinct
// body; the shared Guardian shell picks the builder by `variant`. Add new
// zones here (e.g. zone2: buildZone2Something) — the mechanics stay shared.
// ============================================================
import { buildZone1Golem } from './zone1Golem.js';
import { buildZone2Guardian } from './zone2Guardian.js';
import { buildZone3Guardian } from './zone3Guardian.js';

export const GUARDIAN_BUILDERS = {
  zone1: buildZone1Golem,
  zone2: buildZone2Guardian,
  zone3: buildZone3Guardian,
};
