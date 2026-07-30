// ============================================================
// PAUSE STATE — Game state machine -> plain snapshot for the pause ledger
// ============================================================
// The only module that knows Game's field names on the pause path. Everything
// downstream (ui/_partials/pauseModel.js, ui/PauseMenu.js) works off this plain
// object, so the ledger can be unit-tested without a Game, a scene, or a DOM.
import { RIDDLE_COUNT } from '../../config.js';
import { ARTIFACT_DATA } from '../../data.js';
import { ZONE_LORE } from '../../data/zoneLore.js';
import { ZONES } from '../zones/index.js';

// Per-zone artifact totals derived from the content itself (11 / 9 / 7), never
// configured — the same contract the museum's pedestal rings follow.
function zoneTotals() {
  const totals = new Map();
  for (const artifact of ARTIFACT_DATA) {
    const id = `zone${artifact.zone}`;
    totals.set(id, (totals.get(id) || 0) + 1);
  }
  return totals;
}

// A zone is reachable when its hub portal is open. Read from the museum rather
// than re-deriving the unlock rule (sequential completion + the debug override).
function portalLocked(game, zoneId) {
  const zoneNumber = Number(zoneId.slice(4));
  const portal = game.museum?.portals?.find((p) => p.zone === zoneNumber);
  return portal ? !!portal.locked : false;
}

// Each arena tracks the same three riddle rounds under its own name — the
// Feastkeeper's armor layers, the Reveler's wards, the tower's memory seals —
// and the Keeper's duel has none at all. Read whichever the active controller
// actually keeps rather than teaching this module all four state machines.
function arenaWards(arena) {
  if (Number.isFinite(arena.armor)) return { armor: arena.armor, armorTotal: RIDDLE_COUNT };
  if (Number.isFinite(arena.wards)) return { armor: arena.wards, armorTotal: RIDDLE_COUNT };
  const gates = arena.gates?.gates;
  if (Array.isArray(gates) && gates.length) {
    const open = gates.filter((gate) => gate.open).length;
    return { armor: gates.length - open, armorTotal: gates.length };
  }
  return { armor: null, armorTotal: 0 };   // a straight duel (the Keeper)
}

// Every artifact in the game with its recovered flag — the pause menu's Memories
// grid shows the shape of the whole collection, including the slots still empty.
function collection(game) {
  return ARTIFACT_DATA.map((artifact) => ({
    id: artifact.id,
    zone: artifact.zone,
    fil: artifact.fil,
    eng: artifact.eng,
    image: artifact.image,
    origin: artifact.origin,
    lore: artifact.lore,
    found: !!game.collectedByZone[`zone${artifact.zone}`]?.has(artifact.id),
  }));
}

export function collectPauseState(game) {
  const totals = zoneTotals();
  const activeZone = game.currentZone?.startsWith('zone') ? game.currentZone : game._returnZone;

  const zones = game.zoneOrder.map((zoneId) => ({
    id: zoneId,
    label: ZONES[zoneId]?.label || zoneId.toUpperCase(),
    // The live ArtifactManager owns the active zone's count; the persistent
    // per-zone sets carry every other zone's (they survive zone swaps).
    found: game.collectedByZone[zoneId]?.size || 0,
    total: totals.get(zoneId) || 0,
    locked: portalLocked(game, zoneId),
  }));

  const arena = game.arena
    ? { label: game.world?.zone?.label || 'The Memory Arena', ...arenaWards(game.arena) }
    : null;
  const survival = game.survival?.snapshot?.() || null;

  return {
    phase: game.phase,
    zoneLabel: ZONES[activeZone]?.label || game.world?.zone?.label || 'Aking Museo',
    zones,
    // Active-zone detail for the objective chain.
    memoriesFound: game.artifacts?.zoneFoundCount || 0,
    memoriesTotal: game.artifacts?.zoneTotal || totals.get(activeZone) || 0,
    guardianDefeated: !!game.bossDefeated,
    soulFound: game.collectedSouls.has(activeZone),
    zoneRestored: game.completed.has(activeZone),
    // Run totals.
    soulsFound: game.collectedSouls.size,
    soulsSeated: game.museum?.placedSoulCount || 0,
    soulsTotal: game.zoneOrder.length,
    zonesRestored: game.completed.size,
    zonesTotal: game.zoneOrder.length,
    endingPlayed: !!game.endingPlayed,
    arena,
    survival,
    health: game.combat ? { current: game.combat.hp, max: game.combat.maxHp } : null,
    jumpEnabled: !!game.player?.jumpEnabled,
    run: game.runStats?.snapshot() || null,
    collection: collection(game),
    lore: ZONE_LORE,
  };
}
