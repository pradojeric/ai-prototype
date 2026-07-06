// ============================================================
// DISCOVERY SCREEN — fade + card (GDD §8)
// ============================================================
import { wait } from '../config.js';
import { fetchArtifactData, ZONE_NAME } from '../data.js';

export class DiscoveryScreen {
  constructor() {
    this.flash = document.getElementById('flash');
    this.panel = document.getElementById('discovery');
    this.active = false;
    this.panel.addEventListener('click', () => this._dismiss());
    this._resolveDismiss = null;
  }

  async show(artifactData, onSaved) {
    this.active = true;
    this.flash.style.opacity = '1';            // fade to white
    await wait(1100);

    const d = await fetchArtifactData(artifactData.id); // mock API
    document.getElementById('d-img').setAttribute('src', d.image || '');
    document.getElementById('d-fil').textContent = d.fil;
    document.getElementById('d-eng').textContent = d.eng;
    document.getElementById('d-fact').textContent = d.fact;
    document.getElementById('d-note').textContent = d.note;
    document.getElementById('d-zone').textContent = 'Found in — ' + ZONE_NAME;
    this.panel.classList.add('active');
    onSaved && onSaved();

    await new Promise((res) => { this._resolveDismiss = res; });
  }

  async _dismiss() {
    if (!this.panel.classList.contains('active')) return;
    this.panel.classList.remove('active');
    await wait(800);
    this.flash.style.opacity = '0';            // fade back to water
    await wait(1100);
    this.active = false;
    this._resolveDismiss && this._resolveDismiss();
  }
}
