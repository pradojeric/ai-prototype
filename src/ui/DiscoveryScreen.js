// ============================================================
// DISCOVERY SCREEN — fade + card (GDD §8)
// ============================================================
import { wait } from '../config.js';
import { fetchArtifactData, ZONE_NAME } from '../data.js';

export class DiscoveryScreen {
  constructor(waitFor = wait) {
    this._wait = waitFor;
    this.flash = document.getElementById('flash');
    this.panel = document.getElementById('discovery');
    this.image = document.getElementById('d-img');
    this.filipinoName = document.getElementById('d-fil');
    this.englishName = document.getElementById('d-eng');
    this.origin = document.getElementById('d-origin');
    this.lore = document.getElementById('d-lore');
    this.zone = document.getElementById('d-zone');
    this.active = false;
    this.panel.addEventListener('click', () => this._dismiss());
    this._resolveDismiss = null;
  }

  // `zoneName` is the active zone's display name (Game passes world.zone.name);
  // it falls back to ZONE_NAME so older/direct callers still read "PONSIA".
  async show(artifactData, zoneName, onSaved) {
    this.active = true;
    this.flash.style.opacity = '1';            // fade to white
    await this._wait(1100);

    const d = await fetchArtifactData(artifactData.id); // mock API
    // Network latency remains real time, but applying its result is a game-state
    // transition and must wait until a hidden/blurred game is active again.
    await this._wait(0);
    this.image.setAttribute('src', d.image || '');
    this.image.alt = d.eng || d.fil || 'Recovered artifact';
    this.filipinoName.textContent = d.fil;
    this.englishName.textContent = d.eng;
    this.origin.textContent = d.origin;
    this.lore.textContent = d.lore;
    this.zone.textContent = 'Found in — ' + (zoneName || ZONE_NAME);
    this.panel.scrollTop = 0;
    this.panel.classList.add('active');
    onSaved && onSaved();

    await new Promise((res) => { this._resolveDismiss = res; });
  }

  async _dismiss() {
    if (!this.panel.classList.contains('active')) return;
    this.panel.classList.remove('active');
    await this._wait(800);
    this.flash.style.opacity = '0';            // fade back to water
    await this._wait(1100);
    this.active = false;
    this._resolveDismiss && this._resolveDismiss();
  }
}
