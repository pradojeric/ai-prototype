// ============================================================
// SAVE STATE — Game progress <-> plain JSON document
// ============================================================
// The only module that knows Game's field names on the save path, exactly as
// PauseState.js is for the pause path. Pure and DOM-free: no Firebase, no
// three, no Game required, so it unit-tests under `node --test`.
//
// Everything read back from the cloud is treated as untrusted input. A save
// document is client-authoritative (the game has no backend), so restore
// *filters* rather than trusts: unknown artifact and zone ids are dropped, and
// completion it cannot corroborate never widens what the player can claim.
import { ARTIFACT_DATA } from '../../data/artifacts.js';

export const SAVE_VERSION = 1;

// Valid ids derived from the content itself, never configured — the same
// contract the museum's pedestal rings and the pause ledger follow.
function knownArtifactsByZone() {
  const byZone = new Map();
  for (const artifact of ARTIFACT_DATA) {
    const id = `zone${artifact.zone}`;
    if (!byZone.has(id)) byZone.set(id, new Set());
    byZone.get(id).add(artifact.id);
  }
  return byZone;
}

const KNOWN = knownArtifactsByZone();
const KNOWN_ZONES = new Set(KNOWN.keys());

function sortedIds(set) {
  return set instanceof Set ? [...set].sort() : [];
}

// Keep only ids that exist in ARTIFACT_DATA for that specific zone, so a
// hand-edited document cannot invent memories or move one between zones.
function acceptedArtifacts(zoneId, list) {
  const known = KNOWN.get(zoneId);
  if (!known || !Array.isArray(list)) return new Set();
  return new Set(list.filter((id) => known.has(id)));
}

function acceptedZones(list) {
  if (!Array.isArray(list)) return new Set();
  return new Set(list.filter((id) => KNOWN_ZONES.has(id)));
}

/** True when `data` is a save document this build can read at all. */
export function isValidSave(data) {
  return Boolean(
    data
    && typeof data === 'object'
    && data.version === SAVE_VERSION
    && data.collectedByZone
    && typeof data.collectedByZone === 'object',
  );
}

/**
 * True when a restored session has anything worth resuming. Drives the title
 * menu's Start/Continue swap, so an empty-but-present document (a player who
 * signed in and quit before recovering a memory) still reads as a fresh start.
 */
export function hasProgress(game) {
  if (game?.collectedSouls?.size || game?.completed?.size) return true;
  return Object.values(game?.collectedByZone || {}).some((set) => set?.size > 0);
}

/** Game -> plain JSON. Sets become sorted arrays so writes are stable. */
export function collectSaveState(game) {
  const collectedByZone = {};
  for (const zoneId of KNOWN_ZONES) {
    collectedByZone[zoneId] = sortedIds(game.collectedByZone?.[zoneId]);
  }
  return {
    version: SAVE_VERSION,
    collectedByZone,
    collectedSouls: sortedIds(game.collectedSouls),
    completed: sortedIds(game.completed),
    endingPlayed: !!game.endingPlayed,
    // Carried so a run soured by a debug/presenter shortcut cannot launder
    // itself into a reward claim through a reload. See the caveat in
    // _partials/implementation_plan_firebase_progress.md: this narrows the
    // forgery window, it cannot close it without a backend.
    rewardEligible: game.platformRewardEligible !== false,
  };
}

/**
 * Plain JSON -> Game. Returns false for a document this build cannot read,
 * leaving the fresh-start state untouched.
 */
export function applySaveState(game, data) {
  if (!isValidSave(data)) return false;

  for (const zoneId of KNOWN_ZONES) {
    const restored = acceptedArtifacts(zoneId, data.collectedByZone[zoneId]);
    // Mutate the existing Set: ArtifactManager already holds a reference to the
    // active zone's, so replacing the object would silently orphan it.
    const target = (game.collectedByZone[zoneId] ||= new Set());
    target.clear();
    for (const id of restored) target.add(id);
  }

  const souls = acceptedZones(data.collectedSouls);
  game.collectedSouls.clear();
  for (const zoneId of souls) game.collectedSouls.add(zoneId);

  // A zone counts as finished only if its Soul came back too — the same pairing
  // _completeInteract enforces live, so a document claiming a bare completion
  // cannot skip a Guardian.
  const completed = acceptedZones(data.completed);
  game.completed.clear();
  for (const zoneId of completed) {
    if (souls.has(zoneId)) game.completed.add(zoneId);
  }

  game.endingPlayed = !!data.endingPlayed;
  if (data.rewardEligible === false) game.platformRewardEligible = false;
  return true;
}
