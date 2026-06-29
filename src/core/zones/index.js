// ============================================================
// ZONE REGISTRY + FACTORY — maps a zone id to its definition and builds a World
// engine instance for it. Add a zone by writing one zones/zoneN.js module and
// registering it here (mirrors the guardians/ registry pattern). The active
// World stays single; swap zones by constructing a new one and re-injecting the
// player's collider/ground-height callbacks (see Game.js).
// ============================================================
import { CONFIG } from '../../config.js';
import { World } from '../World.js';
import { zone1 } from './zone1.js';
import { zone2 } from './zone2.js';
import { zone3 } from './zone3.js';
import { zoneDebug } from './zoneDebug.js';

export const ZONES = {
  zone1,
  zone2,
  zone3,
  zoneDebug,
};

export function createWorld(zoneId = 'zone1') {
  // Debug override: force every zone request (initial load + hub portals) into
  // the small test arena. Single choke point — toggle CONFIG.DEBUG_ZONE.
  if (CONFIG.DEBUG_ZONE) zoneId = 'zoneDebug';
  const def = ZONES[zoneId];
  if (!def) throw new Error(`Unknown zone: ${zoneId}`);
  return new World(def);
}
