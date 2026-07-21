// ============================================================
// API MANAGER — artifact collection notifications (GDD §8)
// ============================================================
const REAL_WORLD_DATA_SOURCE = 'Fetched from City-Wide Portal API';

function createSessionId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export class APIManager {
  constructor(collectionUrl) {
    this.collectionUrl = collectionUrl;
    this.sessionId = createSessionId();
  }

  async recordArtifactCollection(artifactData, zoneName) {
    const payload = {
      artifact_id: artifactData.id,
      artifact_name: `${artifactData.fil} (${artifactData.eng})`,
      zone: zoneName,
      discovered_at: new Date().toISOString(),
      player_session: this.sessionId,
      real_world_data: REAL_WORLD_DATA_SOURCE,
    };

    try {
      const response = await fetch(this.collectionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Artifact collection API returned HTTP ${response.status}`);
      }

      return true;
    } catch (error) {
      // The remote archive is additive; losing it must not roll back local progress.
      console.warn('Artifact collection API request failed.', {
        artifactId: artifactData.id,
        error,
      });
      return false;
    }
  }
}
