import { resolveJourneyObjective } from '../../ui/_partials/journeyObjectives.js';

export const gameGuidanceMethods = {
  _syncJourneyGuide(animate = true) {
    const zoneId = this.currentZone?.startsWith('zone') ? this.currentZone : this._returnZone;
    const zoneLabel = this.world?.zone?.label || zoneId?.toUpperCase() || 'Memory Archive';
    const memoriesFound = this.artifacts?.zoneFoundCount || 0;
    const memoriesTotal = this.artifacts?.zoneTotal || 0;
    const soulFound = this.collectedSouls.has(zoneId);
    const model = resolveJourneyObjective({
      phase: this.phase,
      endingPlayed: this.endingPlayed,
      guardianDefeated: this.bossDefeated,
      memoriesFound,
      memoriesTotal,
      soulFound,
      soulsFound: this.collectedSouls.size,
      soulsTotal: this.zoneOrder.length,
      zoneLabel,
    });
    this.journeyGuide.setObjective(model, animate);
  },

  _queueExplorationGuidance() {
    this.journeyGuide.showControl('move');
    this.journeyGuide.showControl('look');
    this.journeyGuide.showControl('sprint');
    this.journeyGuide.showControl('release');
  },
};

