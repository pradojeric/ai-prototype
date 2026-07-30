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
import { arena1 } from './arena1.js';
import { arena2 } from './arena2.js';
import { arena3 } from './arena3.js';
import { arena3boss } from './arena3boss.js';
import { survival } from './survival.js';

export const ZONES = {
  zone1,
  zone2,
  zone3,
  zoneDebug,
  // Memory Arenas (Strings v2.0) — instanced combat spaces entered from a zone's
  // Memory Rift. Built via createWorld() like any zone; Game swaps in/out of them.
  arena1,
  arena2,
  arena3,
  // Entered from arena3's summit portal rather than from a zone's Rift; the
  // return still targets Zone 3 (see Game._transferArena).
  arena3boss,
  // Credits-only run mode. Registration makes the authored arena available to
  // SurvivalFlow without adding a campaign portal or title-screen route.
  survival,
};

export function createWorld(zoneId = 'zone1') {
  // Debug override: force every zone request (initial load + hub portals) into
  // the small test arena. Single choke point — toggle CONFIG.DEBUG_ZONE.
  if (CONFIG.DEBUG_ZONE) zoneId = 'zoneDebug';
  const def = ZONES[zoneId];
  if (!def) throw new Error(`Unknown zone: ${zoneId}`);
  return new World(def);
}
