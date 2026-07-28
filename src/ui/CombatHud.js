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
import { CombatPopups } from './_partials/CombatPopups.js';

export class CombatHud {
  constructor() {
    this.elHealth = document.getElementById('health');
    this.elHealthLabel = document.getElementById('health-label');
    this.elHealthFill = document.getElementById('health-fill');
    this.elHealthLag = document.getElementById('health-lag');
    this.elAlab = document.getElementById('alab');
    this.elAlabFill = document.getElementById('alab-fill');
    this.elWave = document.getElementById('wavehud');
    this.elWaveLabel = document.getElementById('wave-label');
    this.elWaveN = document.getElementById('wave-n');
    this.elWaveT = document.getElementById('wave-t');
    this.elWaveLeft = document.getElementById('wave-left');
    this.elHurt = document.getElementById('hurt');
    this.elCross = document.getElementById('crosshair');
    this.elBoss = document.getElementById('boss-bar');
    this.elBossName = document.getElementById('boss-name');
    this.elBossFill = document.getElementById('boss-hp-fill');
    this.elBossLag = document.getElementById('boss-hp-lag');
    this.elWardPips = document.getElementById('ward-pips');
    this.elRiddleClock = document.getElementById('rail-riddle-clock');
    this.elRiddleLabel = document.getElementById('rail-riddle-label');
    this.elRiddleSegments = document.getElementById('rail-riddle-segments');

    // Health bars are {true fraction, ghost fraction} pairs; the ghost trails
    // the true fill down so the size of a hit stays readable. update() drains
    // every registered bar, so adding one is two fields, not a second loop.
    this._bars = {
      player: { pct: 1, lag: 1, fill: this.elHealthFill, lagEl: this.elHealthLag },
      boss: { pct: 1, lag: 1, fill: this.elBossFill, lagEl: this.elBossLag },
    };
    this._threatTimer = 0;
    this._wardTotal = 0;
    this._riddleTotal = 0;
    this._riddleSegmentFills = [];
    this._healFlashRemaining = 0;
    this._hitMarkerRemaining = 0;
    this._pipBreaks = [];

    this._arcs = this._buildPool('dmg-arcs', HUD.DMG_ARCS, 'dmg-arc');
    this._arcState = this._arcs.map(() => ({ life: 0, angle: 0 }));
    this._markers = this._buildPool('threat-markers', HUD.THREAT_MARKERS, 'threat-marker');
    this._popups = new CombatPopups('combat-popups', HUD.POPUPS);

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
    this.elAlab?.classList.add('active');
    if (wave) this.elWave.classList.add('active');
    else this.elWave.classList.remove('active');
    this.elCross.classList.add('combat');
  }

  hide() {
    this.elHealth.classList.remove('active', 'lumina-heal');
    this.elAlab?.classList.remove('active', 'firing');
    this.elWave.classList.remove('active', 'boss');
    this.elCross.classList.remove('combat');
    this.elCross.classList.remove('hit');
    this.elHurt.classList.remove('active');
    this._healFlashRemaining = 0;
    this._hitMarkerRemaining = 0;
    this.hideWards();
    this._clearOverlays();
  }

  // ---- health -----------------------------------------------------------

  // Write one bar's true fill. Taking damage snaps the fill down and leaves the
  // ghost behind to drain; healing pulls the ghost straight up so it never
  // trails upward. Shared by the player bar and the boss bar.
  _setBar(key, hp, max) {
    const bar = this._bars[key];
    if (!bar || !bar.fill) return 1;
    bar.pct = clamp01(hp / max);
    const pct = bar.pct * 100;
    bar.fill.style.width = pct + '%';
    if (bar.pct > bar.lag) {
      bar.lag = bar.pct;
      if (bar.lagEl) bar.lagEl.style.width = pct + '%';
    }
    return bar.pct;
  }

  setHealth(hp, max) {
    const pct = this._setBar('player', hp, max);
    this.elHealth.classList.toggle('low', pct < 0.3);
  }

  healFlash() {
    this.elHealth.classList.remove('lumina-heal');
    void this.elHealth.offsetHeight;   // restart the animation
    this.elHealth.classList.add('lumina-heal');
    this._healFlashRemaining = 0.42;
  }

  // ---- waves / crosshair ------------------------------------------------

  setWave(current, total) {
    this.elWaveN.textContent = current;
    this.elWaveT.textContent = total;
  }

  setWaveLeft(count) { this.elWaveLeft.textContent = count; }

  // Boss phase: the wave number is meaningless (the boss summons on its own
  // clock) but the live-threat count still matters, so only the count line goes.
  setBossWaves(active) { this.elWave.classList.toggle('boss', !!active); }

  punchWave() {
    this.elWave.animate(
      [{ transform: 'scale(1.15)' }, { transform: 'scale(1)' }],
      { duration: 150, easing: 'ease-out' },
    );
  }

  setOvercharge(active) { this.elCross.classList.toggle('overcharge', active); }

  setAlab(charge, firing) {
    const pct = clamp01(charge);
    if (this.elAlabFill) this.elAlabFill.style.width = `${pct * 100}%`;
    if (this.elAlab) {
      this.elAlab.setAttribute('aria-valuenow', Math.round(pct * 100));
      this.elAlab.classList.toggle('firing', !!firing);
      this.elAlab.classList.toggle('ready', pct >= 0.999);
    }
  }

  hitMarker() {
    this.elCross.classList.add('hit');
    this._hitMarkerRemaining = 0.08;
  }

  hurt(active) { this.elHurt.classList.toggle('active', active); }

  // ---- Arena 2 riddle timeline ------------------------------------------

  showRiddleTimeline(total = 3) {
    if (!this.elRiddleClock || !this.elRiddleSegments) return;
    if (total !== this._riddleTotal) {
      this._riddleTotal = total;
      this._riddleSegmentFills.length = 0;
      this.elRiddleSegments.textContent = '';
      for (let i = 0; i < total; i++) {
        const segment = document.createElement('i');
        const fill = document.createElement('span');
        segment.appendChild(fill);
        this.elRiddleSegments.appendChild(segment);
        this._riddleSegmentFills.push(fill);
      }
    }
    this.elRiddleClock.classList.add('active');
    this.elRiddleClock.setAttribute('aria-hidden', 'false');
  }

  setRiddleTimeline(step, progress, secondsRemaining, isActive = false) {
    if (!this.elRiddleClock) return;
    this.showRiddleTimeline(this._riddleTotal || 3);
    const current = Math.max(0, Math.min(this._riddleTotal - 1, step));
    const pct = clamp01(progress);
    for (let i = 0; i < this._riddleSegmentFills.length; i++) {
      const fill = i < current ? 1 : i === current ? pct : 0;
      this._riddleSegmentFills[i].style.width = `${fill * 100}%`;
    }

    const seconds = Math.max(0, Math.ceil(secondsRemaining));
    const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    const label = isActive ? `Riddle ${current + 1} active` : `Riddle ${current + 1} in ${clock}`;
    if (this.elRiddleLabel) this.elRiddleLabel.textContent = label;
    this.elRiddleClock.setAttribute('aria-label', label);
    this.elRiddleClock.setAttribute('aria-valuemin', '0');
    this.elRiddleClock.setAttribute('aria-valuemax', '100');
    this.elRiddleClock.setAttribute('aria-valuenow', String(Math.round(pct * 100)));
  }

  hideRiddleTimeline() {
    if (!this.elRiddleClock) return;
    this.elRiddleClock.classList.remove('active');
    this.elRiddleClock.setAttribute('aria-hidden', 'true');
  }

  // ---- boss frame (name + health + armor pips) ---------------------------

  // The whole top-of-screen boss frame in one call. `hp`/`maxHp` are optional:
  // an encounter that only gates on armor (rail, tower) omits them and the
  // health track stays hidden rather than showing a bar nothing can move.
  setBoss({ name, hp = null, maxHp = null, armor = 0, armorTotal = 0 } = {}) {
    if (!this.elBoss) return;
    if (this.elBossName && name) this.elBossName.textContent = name;

    const vulnerable = hp !== null && maxHp > 0;
    this.elBoss.classList.toggle('vulnerable', vulnerable);
    if (vulnerable) this._setBar('boss', hp, maxHp);

    this._setArmor(armor, armorTotal);
    this.elBoss.classList.add('active');
  }

  hideBoss() {
    if (!this.elBoss) return;
    this.elBoss.classList.remove('active', 'vulnerable');
    this.hideRiddleTimeline();
    this._wardTotal = 0;
    this._bars.boss.pct = 1;
    this._bars.boss.lag = 1;
    this._pipBreaks.length = 0;
    if (this.elBossFill) this.elBossFill.style.width = '100%';
    if (this.elBossLag) this.elBossLag.style.width = '100%';
    if (this.elWardPips) this.elWardPips.textContent = '';
  }

  // Armor-gated controllers can keep their compact ward-only call site.
  setWards(name, remaining, total) {
    this.setBoss({ name, armor: remaining, armorTotal: total });
  }

  hideWards() { this.hideBoss(); }

  // Rebuild the pip row when the armor count changes shape (a new encounter),
  // then mark spent pips. `remaining` counts layers still standing.
  _setArmor(remaining, total) {
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
          this._pipBreaks.push({ element: pips[i], remaining: 0.52 });
        }
        pips[i].classList.toggle('spent', spent);
      }
    }
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

  // ---- floating combat text ---------------------------------------------

  // Popups reproject every frame, so the camera is handed over once (by
  // CombatManager) instead of being passed on every hit.
  setCamera(camera) { this._popups.setCamera(camera); }

  // Damage the player dealt. Fractional bolt damage (overcharge) is rounded so
  // the number stays a number, and a hit that rounds to zero still shows 1 —
  // silence would read as a miss.
  popupDamage(position, amount) {
    if (amount <= 0) return;
    this._popups.spawn(position, String(Math.max(1, Math.round(amount))), 'damage');
  }

  // Damage the player took, at the position of whatever dealt it.
  popupPlayerDamage(position, amount) {
    if (amount <= 0) return;
    this._popups.spawn(position, String(Math.max(1, Math.round(amount))), 'player');
  }

  popupBlocked(position) { this._popups.spawn(position, 'BLOCKED', 'blocked'); }

  popupCallout(position, text) { this._popups.spawn(position, text, 'callout'); }

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
      if (!enemy.alive || enemy.hudVisible === false) continue;
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
    this._popups.clear();
  }

  // Fade the damage arcs and drain the health ghost. Driven on real dt so the
  // HUD keeps settling through hitstop and after a fight ends.
  update(dt) {
    this._popups.update(dt);
    if (this._healFlashRemaining > 0) {
      this._healFlashRemaining = Math.max(0, this._healFlashRemaining - dt);
      if (this._healFlashRemaining <= 0) this.elHealth.classList.remove('lumina-heal');
    }
    if (this._hitMarkerRemaining > 0) {
      this._hitMarkerRemaining = Math.max(0, this._hitMarkerRemaining - dt);
      if (this._hitMarkerRemaining <= 0) this.elCross.classList.remove('hit');
    }
    for (let i = this._pipBreaks.length - 1; i >= 0; i--) {
      const pip = this._pipBreaks[i];
      pip.remaining -= dt;
      if (pip.remaining > 0) continue;
      pip.element.classList.remove('breaking');
      this._pipBreaks.splice(i, 1);
    }
    for (let i = 0; i < this._arcState.length; i++) {
      const state = this._arcState[i];
      if (state.life <= 0) continue;
      state.life = Math.max(0, state.life - dt);
      this._arcs[i].style.opacity = String(state.life / HUD.DMG_ARC_LIFE);
    }
    for (const key in this._bars) {
      const bar = this._bars[key];
      if (bar.lag <= bar.pct) continue;
      bar.lag = Math.max(bar.pct, bar.lag - HUD.HEALTH_LAG * dt);
      if (bar.lagEl) bar.lagEl.style.width = bar.lag * 100 + '%';
    }
  }

  dispose() {
    this.hide();
    for (const el of this._arcs) el.remove();
    for (const el of this._markers) el.remove();
    this._arcs.length = 0;
    this._markers.length = 0;
    this._popups.dispose();
  }
}
