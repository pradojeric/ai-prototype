// ============================================================
// DATA — artifact payloads + mock City-Wide Portal API (GDD §7/§8)
// ============================================================
// The riddle pool lives in data/riddles.js (split for file-length limits);
// re-exported here so call sites keep importing from './data.js'.
export { RIDDLE_POOL, drawRiddles, riddlesForZone } from './data/riddles.js';

// Zone-1 provenance label. Per-zone discovery cards read the active zone's
// name (world.zone.name) instead; this remains the fallback / Zone-1 default.
export const ZONE_NAME = 'PONSIA';
// Artifact payloads live in data/artifacts.js (split so they can be imported
// without the riddle pool's config.js -> three chain); re-exported here so call
// sites keep importing from './data.js'.
// Imported rather than bare-re-exported because fetchArtifactData below needs a
// local binding to search.
import { ARTIFACT_DATA } from './data/artifacts.js';

export { ARTIFACT_DATA };

// Stand-in for APIManager.fetchArtifactData — async to mirror a real call.
export function fetchArtifactData(id) {
  return new Promise((resolve) => {
    const data = ARTIFACT_DATA.find((a) => a.id === id);
    setTimeout(() => resolve(data), 120); // simulate latency
  });
}

// ------------------------------------------------------------
// GUARDIAN — flavour text for the riddle screen header.
// ------------------------------------------------------------
export const GUARDIAN_TEXT = {
  fil: 'Bantay ng Pantal',
  eng: 'Guardian of the Market',
  intro: 'Sagutin ang aking bugtong upang palayain ang mga alaala.',
  introEng: 'Answer my riddle to free the memories.',
};
