// ============================================================
// COMBAT HUD — every DOM overlay a fight owns: the Liwanag bar, the wave/threat
// readout, the crosshair states, the hurt vignette, directional damage arcs,
// off-screen threat markers, and the guardian's ward pips. CombatManager (and
// its Rail/Tower subclasses) drives this through plain method calls and never
// touches an element itself.
//
// All UI here is plain DOM declared in index.html and styled in
// _partials/arena-hud.css — the `.active` class convention, no framework. The
// pooled arcs and markers are created once in the constructor: a busy wave
// rewrites transforms, it never creates nodes.
// ============================================================
import * as THREE from 'three';
import { HUD, clamp01 } from '../config.js';

export class CombatHud {
  constructor() {
    this.elHealth = document.getElementById('health');
    this.elHealthLabel = document.getElementById('health-label');
    this.elHealthFill = document.getElementById('health-fill');
    this.elHealthLag = document.getElementById('health-lag');
    this.elWave = document.getElementById('wavehud');
    this.elWaveLabel = document.getElementById('wave-label');
    this.elWaveN = document.getElementById('wave-n');
    this.elWaveT = document.getElementById('wave-t');
    this.elWaveLeft = document.getElementById('wave-left');
    this.elHurt = document.getElementById('hurt');
    this.elCross = document.getElementById('crosshair');
    this.elWards = document.getElementById('guardian-wards');
    this.elWardName = document.getElementById('ward-name');
    this.elWardPips = document.getElementById('ward-pips');

    this._pct = 1;            // true health fraction
    this._lagPct = 1;         // ghost fill chasing it down
    this._threatTimer = 0;
    this._wardTotal = 0;

    this._arcs = this._buildPool('dmg-arcs', HUD.DMG_ARCS, 'dmg-arc');
    this._arcState = this._arcs.map(() => ({ life: 0, angle: 0 }));
    this._markers = this._buildPool('threat-markers', HUD.THREAT_MARKERS, 'threat-marker');

    // Scratch — the threat pass runs every frame over every live enemy.
    this._v = new THREE.Vector3();
    this._dir = new THREE.Vector3();

    this.setProfile();
  }

  // Pre-create the fixed set of pooled overlay elements inside a container.
  // The host is emptied first so a re-created HUD (zone swap) cannot stack
  // a second pool on top of the previous one's leftovers.
  _buildPool(containerId, count, className) {
    const host = document.getElementById(containerId);
    const pool = [];
    if (!host) return pool;
    host.textContent = '';
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = className;
      host.appendChild(el);
      pool.push(el);
    }
    return pool;
  }

  setProfile({ healthLabel = 'Liwanag', waveLabel = 'Drowned Echoes' } = {}) {
    if (this.elHealthLabel) this.elHealthLabel.textContent = healthLabel;
    if (this.elWaveLabel) this.elWaveLabel.textContent = waveLabel;
  }

  // ---- visibility -------------------------------------------------------

  show({ wave = true } = {}) {
    this.elHealth.classList.add('active');
    if (wave) this.elWave.classList.add('active');
    else this.elWave.classList.remove('active');
    this.elCross.classList.add('combat');
  }

  hide() {
    this.elHealth.classList.remove('active', 'lumina-heal');
    this.elWave.classList.remove('active');
    this.elCross.classList.remove('combat');
    this.elHurt.classList.remove('active');
    this.hideWards();
    this._clearOverlays();
  }

  // ---- health -----------------------------------------------------------

  setHealth(hp, max) {
    this._pct = clamp01(hp / max);
    const pct = this._pct * 100;
    this.elHealthFill.style.width = pct + '%';
    // Taking damage snaps the true fill down and leaves the ghost behind to
    // drain; healing pulls the ghost straight up so it never trails upward.
    if (this._pct > this._lagPct) {
      this._lagPct = this._pct;
      if (this.elHealthLag) this.elHealthLag.style.width = pct + '%';
    }
    this.elHealth.classList.toggle('low', this._pct < 0.3);
  }

  healFlash() {
    this.elHealth.classList.remove('lumina-heal');
    void this.elHealth.offsetHeight;   // restart the animation
    this.elHealth.classList.add('lumina-heal');
    clearTimeout(this._healTimeout);
    this._healTimeout = setTimeout(() => this.elHealth.classList.remove('lumina-heal'), 420);
  }

  // ---- waves / crosshair ------------------------------------------------

  setWave(current, total) {
    this.elWaveN.textContent = current;
    this.elWaveT.textContent = total;
  }

  setWaveLeft(count) { this.elWaveLeft.textContent = count; }

  punchWave() {
    this.elWave.animate(
      [{ transform: 'scale(1.15)' }, { transform: 'scale(1)' }],
      { duration: 150, easing: 'ease-out' },
    );
  }

  setOvercharge(active) { this.elCross.classList.toggle('overcharge', active); }

  hitMarker() {
    this.elCross.classList.add('hit');
    clearTimeout(this._hitTimeout);
    this._hitTimeout = setTimeout(() => this.elCross.classList.remove('hit'), 80);
  }

  hurt(active) { this.elHurt.classList.toggle('active', active); }

  // ---- guardian wards ---------------------------------------------------

  // Rebuild the pip row when the ward count changes shape (a new encounter),
  // then mark spent pips. `remaining` counts wards still standing.
  setWards(name, remaining, total) {
    if (!this.elWards) return;
    if (this.elWardName && name) this.elWardName.textContent = name;
    if (this.elWardPips && total !== this._wardTotal) {
      this._wardTotal = total;
      this.elWardPips.textContent = '';
      for (let i = 0; i < total; i++) {
        const pip = document.createElement('i');
        this.elWardPips.appendChild(pip);
      }
    }
    if (this.elWardPips) {
      const pips = this.elWardPips.children;
      for (let i = 0; i < pips.length; i++) {
        const spent = i >= remaining;
        // Only newly-spent pips flash, so re-showing the row stays quiet.
        if (spent && !pips[i].classList.contains('spent')) {
          pips[i].classList.add('breaking');
          setTimeout(() => pips[i].classList.remove('breaking'), 520);
        }
        pips[i].classList.toggle('spent', spent);
      }
    }
    this.elWards.classList.add('active');
  }

  hideWards() {
    if (!this.elWards) return;
    this.elWards.classList.remove('active');
    this._wardTotal = 0;
    if (this.elWardPips) this.elWardPips.textContent = '';
  }

  // ---- directional damage ----------------------------------------------

  // Point an arc at whatever just hit the player. The angle is the source's
  // bearing relative to where the camera is looking, so it reads as "behind
  // me / to my right" rather than as a compass heading.
  damageFrom(sourcePos, camera) {
    if (!sourcePos || !camera || !this._arcs.length) return;
    camera.getWorldDirection(this._dir);
    const camYaw = Math.atan2(this._dir.x, this._dir.z);
    const srcYaw = Math.atan2(
      sourcePos.x - camera.position.x, sourcePos.z - camera.position.z,
    );
    let rel = srcYaw - camYaw;
    while (rel > Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;

    // Reuse the slot with the least life left when every arc is in flight.
    let slot = 0;
    for (let i = 1; i < this._arcState.length; i++) {
      if (this._arcState[i].life < this._arcState[slot].life) slot = i;
    }
    const state = this._arcState[slot];
    state.life = HUD.DMG_ARC_LIFE;
    state.angle = rel;
    this._arcs[slot].style.transform = `rotate(${rel * 180 / Math.PI}deg)`;
    this._arcs[slot].style.opacity = '1';
  }

  // ---- off-screen threat markers ---------------------------------------

  // Enemies the player cannot see get an edge chip pointing at them. Runs on a
  // coarse timer and writes only transforms/opacity — no layout reads.
  trackThreats(enemies, camera, dt) {
    if (!this._markers.length) return;
    this._threatTimer -= dt;
    if (this._threatTimer > 0) return;
    this._threatTimer = HUD.THREAT_INTERVAL;

    const halfW = window.innerWidth * 0.5;
    const halfH = window.innerHeight * 0.5;
    let used = 0;
    for (const enemy of enemies) {
      if (used >= this._markers.length) break;
      if (!enemy.alive) continue;
      enemy.center(this._v);
      this._v.project(camera);
      // project() mirrors points that sit behind the camera; flip them back so
      // the marker lands on the correct side of the screen.
      const behind = this._v.z > 1;
      let nx = behind ? -this._v.x : this._v.x;
      let ny = behind ? -this._v.y : this._v.y;
      const onScreen = !behind && Math.abs(nx) < HUD.THREAT_MARGIN
        && Math.abs(ny) < HUD.THREAT_MARGIN;
      if (onScreen) continue;

      // Push out to the screen edge, preserving the bearing.
      const peak = Math.max(Math.abs(nx), Math.abs(ny)) || 1;
      const k = HUD.THREAT_MARGIN / peak;
      nx *= k;
      ny *= k;
      const el = this._markers[used++];
      const angle = Math.atan2(-ny, nx) * 180 / Math.PI;
      el.style.transform =
        `translate(${nx * halfW}px, ${-ny * halfH}px) rotate(${angle}deg)`;
      el.classList.toggle('spitter', enemy.type === 'spitter');
      el.style.opacity = '1';
    }
    for (let i = used; i < this._markers.length; i++) {
      this._markers[i].style.opacity = '0';
    }
  }

  _clearOverlays() {
    for (let i = 0; i < this._arcs.length; i++) {
      this._arcState[i].life = 0;
      this._arcs[i].style.opacity = '0';
    }
    for (const marker of this._markers) marker.style.opacity = '0';
  }

  // Fade the damage arcs and drain the health ghost. Driven on real dt so the
  // HUD keeps settling through hitstop and after a fight ends.
  update(dt) {
    for (let i = 0; i < this._arcState.length; i++) {
      const state = this._arcState[i];
      if (state.life <= 0) continue;
      state.life = Math.max(0, state.life - dt);
      this._arcs[i].style.opacity = String(state.life / HUD.DMG_ARC_LIFE);
    }
    if (this._lagPct > this._pct) {
      this._lagPct = Math.max(this._pct, this._lagPct - HUD.HEALTH_LAG * dt);
      if (this.elHealthLag) this.elHealthLag.style.width = this._lagPct * 100 + '%';
    }
  }

  dispose() {
    clearTimeout(this._hitTimeout);
    clearTimeout(this._healTimeout);
    this.hide();
    for (const el of this._arcs) el.remove();
    for (const el of this._markers) el.remove();
    this._arcs.length = 0;
    this._markers.length = 0;
  }
}
