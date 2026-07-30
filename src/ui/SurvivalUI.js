// ============================================================
// ENDLESS MEMORY SURVIVAL UI
// Callback-driven DOM shell for the live HUD, upgrade draft, boss-arrival
// stinger, and defeat ledger. Simulation rules stay in the Survival systems;
// this class only paints snapshots and emits player intents.
// ============================================================
import {
  SURVIVAL_LIGHT_BOLT,
  SURVIVAL_UPGRADE_FAMILIES,
  SURVIVAL_WEAPON_PATHS,
} from '../core/survival/SurvivalUpgrades.js';
import { describeSurvivalMilestone } from '../core/survival/SurvivalRules.js';
import { paintSurvivalBriefing } from './_partials/survivalBriefingView.js';
import { SurvivalTitleCard } from './_partials/survivalTitleCard.js';
import { describeSurvivalCard } from '../core/survival/SurvivalUpgradeCopy.js';

const EMPTY_CALLBACK = () => {};

const CALLBACK_NAMES = Object.freeze([
  'onSelectUpgrade',
  'onReroll',
  'onRetry',
  'onReturnToMuseum',
  'onBeginRun',
]);

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nonNegativeInt(value, fallback = 0) {
  return Math.max(0, Math.floor(finiteNumber(value, fallback)));
}

function clamp01(value) {
  return Math.min(1, Math.max(0, finiteNumber(value)));
}

function titleFromId(id) {
  return String(id ?? '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function weaponLabel(value) {
  if (value && typeof value === 'object') {
    return String(value.name ?? value.label ?? weaponLabel(value.id));
  }
  const id = String(value ?? SURVIVAL_LIGHT_BOLT.id);
  if (id === SURVIVAL_LIGHT_BOLT.id || id === 'base') return SURVIVAL_LIGHT_BOLT.label;
  return SURVIVAL_WEAPON_PATHS[id]?.label ?? titleFromId(id) ?? SURVIVAL_LIGHT_BOLT.label;
}

export function formatSurvivalTime(seconds) {
  const total = nonNegativeInt(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  }
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export function normalizeUpgradeRanks(upgrades) {
  const rows = [];

  if (Array.isArray(upgrades)) {
    for (const item of upgrades) {
      if (typeof item === 'string') {
        rows.push({ id: item, name: titleFromId(item), rank: 1 });
        continue;
      }
      if (!item || typeof item !== 'object') continue;
      const id = String(item.id ?? item.name ?? '');
      const rank = nonNegativeInt(item.rank ?? item.level ?? 1, 1);
      if (!id || rank < 1) continue;
      rows.push({
        id,
        name: String(item.name ?? item.title ?? titleFromId(id)),
        rank,
      });
    }
    return rows;
  }

  if (!upgrades || typeof upgrades !== 'object') return rows;
  for (const [id, value] of Object.entries(upgrades)) {
    const detail = value && typeof value === 'object' ? value : null;
    const rank = nonNegativeInt(detail?.rank ?? detail?.level ?? value);
    if (rank < 1) continue;
    rows.push({
      id,
      name: String(detail?.name ?? detail?.title ?? titleFromId(id)),
      rank,
    });
  }
  return rows;
}

function roman(value) {
  const entries = [
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let remaining = Math.max(1, nonNegativeInt(value, 1));
  let result = '';
  for (const [amount, glyph] of entries) {
    while (remaining >= amount) {
      result += glyph;
      remaining -= amount;
    }
  }
  return result;
}

export class SurvivalUI {
  constructor(callbacks = {}, documentRef = globalThis.document) {
    this.document = documentRef;
    this.callbacks = Object.fromEntries(CALLBACK_NAMES.map((name) => [name, EMPTY_CALLBACK]));
    this.setCallbacks(callbacks);

    this.hud = this._get('survival-hud');
    this.wave = this._get('survival-wave');
    this.remaining = this._get('survival-remaining');
    this.milestone = this._get('survival-milestone');
    this.weapon = this._get('survival-weapon');
    this.heat = this._get('survival-heat');
    this.heatFill = this._get('survival-heat-fill');
    this.heatLabel = this._get('survival-heat-label');
    this.dash = this._get('survival-dash');
    this.rerolls = this._get('survival-rerolls');
    this.health = this._get('survival-health');
    this.healthFill = this._get('survival-health-fill');
    this.healthLabel = this._get('survival-health-label');

    this.briefingOverlay = this._get('survival-briefing');
    this.briefingKicker = this._get('survival-briefing-kicker');
    this.briefingTitle = this._get('survival-briefing-title');
    this.briefingLede = this._get('survival-briefing-lede');
    this.briefingSections = this._get('survival-briefing-sections');
    this.briefingLineFil = this._get('survival-briefing-line-fil');
    this.briefingLineEng = this._get('survival-briefing-line-eng');
    this.briefingBegin = this._get('survival-briefing-begin');
    this._briefingPainted = false;
    this.titleCard = new SurvivalTitleCard(this.document);

    this.upgradeOverlay = this._get('survival-upgrade');
    this.upgradeWave = this._get('survival-upgrade-wave');
    this.cardButtons = [1, 2, 3]
      .map((slot) => this._get(`survival-upgrade-card-${slot}`))
      .filter(Boolean);
    this.rerollButton = this._get('survival-upgrade-reroll');
    this.upgradeRerolls = this._get('survival-upgrade-rerolls');

    this.stinger = this._get('survival-boss-stinger');
    this.stingerKicker = this._get('survival-boss-kicker');
    this.stingerName = this._get('survival-boss-name');
    this.stingerTier = this._get('survival-boss-tier');

    this.defeatOverlay = this._get('survival-defeat');
    this.defeatBest = this._get('survival-defeat-best');
    this.resultWave = this._get('survival-result-wave');
    this.resultTime = this._get('survival-result-time');
    this.resultKills = this._get('survival-result-kills');
    this.resultBosses = this._get('survival-result-bosses');
    this.resultWeapon = this._get('survival-result-weapon');
    this.resultUpgrades = this._get('survival-result-upgrades');
    this.retryButton = this._get('survival-retry');
    this.returnButton = this._get('survival-defeat-return');

    this._listeners = [];
    this._draftCards = [];
    this._draftRanks = {};
    this._draftBuild = null;
    this._draftLocked = false;
    this._rerollLocked = false;
    this._activeModal = null;
    this._lastFocused = null;
    this._stingerTimer = null;
    this._stingerResolve = null;

    this._wireEvents();
  }

  _get(id) {
    return this.document?.getElementById?.(id) ?? null;
  }

  _listen(target, type, handler, options) {
    if (!target?.addEventListener) return;
    target.addEventListener(type, handler, options);
    this._listeners.push({ target, type, handler, options });
  }

  _wireEvents() {
    this.cardButtons.forEach((button, index) => {
      this._listen(button, 'click', (event) => {
        event.stopPropagation();
        this._selectUpgrade(index);
      });
    });

    this._listen(this.rerollButton, 'click', (event) => {
      event.stopPropagation();
      this._requestReroll();
    });
    this._listen(this.briefingBegin, 'click', (event) => {
      event.stopPropagation();
      this.callbacks.onBeginRun();
    });
    this._listen(this.retryButton, 'click', (event) => {
      event.stopPropagation();
      this.callbacks.onRetry();
    });
    this._listen(this.returnButton, 'click', (event) => {
      event.stopPropagation();
      this.callbacks.onReturnToMuseum();
    });

    this._keyHandler = (event) => this._handleKeydown(event);
    this._listen(this.document, 'keydown', this._keyHandler, true);
  }

  setCallbacks(callbacks = {}) {
    for (const name of CALLBACK_NAMES) {
      if (typeof callbacks[name] === 'function') this.callbacks[name] = callbacks[name];
    }
  }

  showHud(snapshot = {}) {
    if (!this.hud) return;
    this.hud.hidden = false;
    this.hud.classList.add('active');
    this.updateHud(snapshot);
  }

  hideHud() {
    if (!this.hud) return;
    this.hud.classList.remove('active', 'boss');
    this.hud.hidden = true;
  }

  updateHud(snapshot = {}) {
    const wave = Math.max(1, nonNegativeInt(snapshot.wave, 1));
    const remaining = nonNegativeInt(
      snapshot.remaining ??
      snapshot.remainingEnemies ??
      snapshot.enemiesRemaining ??
      snapshot.threatsRemaining,
    );
    const weaponName = snapshot.weaponName ?? weaponLabel(
      snapshot.weaponPath ?? snapshot.weapon,
    );
    const dashCharges = nonNegativeInt(
      snapshot.dashCharges ?? snapshot.dash?.charges ?? snapshot.dash?.currentCharges,
      1,
    );
    const dashMax = Math.max(
      1,
      nonNegativeInt(snapshot.maxDashCharges ?? snapshot.dash?.maxCharges, 1),
    );
    const rerolls = nonNegativeInt(snapshot.rerolls ?? snapshot.rerollCount);

    if (this.wave) this.wave.textContent = String(wave);
    if (this.remaining) this.remaining.textContent = String(remaining);
    if (this.milestone) {
      this.milestone.textContent = String(snapshot.nextMilestone ?? describeSurvivalMilestone(wave));
    }
    if (this.weapon) this.weapon.textContent = String(weaponName);
    if (this.dash) this.dash.textContent = `${dashCharges} / ${dashMax}`;
    if (this.rerolls) this.rerolls.textContent = String(rerolls);
    this.hud?.classList.toggle('boss', !!snapshot.isBossWave);

    this._paintHealth(snapshot);
    this._paintHeat(snapshot);
  }

  _paintHealth(snapshot) {
    const maxHealth = Math.max(
      1,
      finiteNumber(snapshot.maxHealth ?? snapshot.maxHp ?? snapshot.health?.max, 100),
    );
    const currentHealth = Math.min(
      maxHealth,
      Math.max(
        0,
        finiteNumber(snapshot.currentHealth ?? snapshot.hp ?? snapshot.health?.current, maxHealth),
      ),
    );
    const fraction = clamp01(currentHealth / maxHealth);

    if (this.healthFill) this.healthFill.style.width = `${fraction * 100}%`;
    if (this.healthLabel) {
      this.healthLabel.textContent = `${Math.ceil(currentHealth)} / ${Math.ceil(maxHealth)}`;
    }
    if (this.health) {
      this.health.classList.toggle('low', fraction < .3);
      this.health.setAttribute('aria-valuemax', String(Math.ceil(maxHealth)));
      this.health.setAttribute('aria-valuenow', String(Math.ceil(currentHealth)));
    }
  }

  _paintHeat(snapshot) {
    if (!this.heat) return;
    const heatValue = snapshot.heat?.current ?? snapshot.heat?.value ?? snapshot.heat;
    const heatCapacity = snapshot.heat?.capacity ?? snapshot.heatCapacity;
    const hasHeat = snapshot.weaponId === 'laser' ||
      snapshot.weaponPath === 'laser' ||
      snapshot.weapon?.id === 'laser';
    this.heat.hidden = !hasHeat;
    if (!hasHeat) return;

    const capacity = Math.max(.001, finiteNumber(heatCapacity, 1));
    const fraction = snapshot.heatPercent === undefined
      ? clamp01(finiteNumber(heatValue) / capacity)
      : clamp01(snapshot.heatPercent);
    const overheated = !!(
      snapshot.overheated ??
      snapshot.heat?.overheated ??
      snapshot.heat?.locked
    );
    if (this.heatFill) this.heatFill.style.width = `${fraction * 100}%`;
    this.heat.classList.toggle('hot', fraction >= .7 && !overheated);
    this.heat.classList.toggle('overheated', overheated);
    this.heat.setAttribute('aria-valuenow', String(Math.round(fraction * 100)));
    if (this.heatLabel) {
      this.heatLabel.textContent = overheated ? 'Overheated' : `${Math.round(fraction * 100)}%`;
    }
  }

  showUpgradeDraft({
    wave = 5,
    cards = [],
    rerolls = 0,
    canReroll,
    buildState,
    upgradeRanks,
  } = {}) {
    if (!this.upgradeOverlay) return;
    this.hideDefeat(false);
    this._releasePointerLock();
    this._draftCards = Array.isArray(cards) ? cards.slice(0, 3) : [];
    this._draftRanks = upgradeRanks ?? buildState?.ranks ?? {};
    this._draftBuild = buildState ?? { weaponPath: null, ranks: this._draftRanks };
    this._draftLocked = false;
    this._rerollLocked = false;
    if (this.upgradeWave) this.upgradeWave.textContent = String(Math.max(1, nonNegativeInt(wave, 5)));
    this._paintCards();

    const count = nonNegativeInt(rerolls);
    if (this.upgradeRerolls) this.upgradeRerolls.textContent = String(count);
    if (this.rerollButton) {
      this.rerollButton.disabled = canReroll === undefined ? count < 1 : !canReroll;
      this.rerollButton.setAttribute('aria-label', `Reroll upgrade choices. ${count} available.`);
    }

    this._showModal(this.upgradeOverlay, 'upgrade');
    this._focusSoon(this.cardButtons.find((button) => !button.hidden && !button.disabled));
  }

  _paintCards() {
    this.cardButtons.forEach((button, index) => {
      const card = this._draftCards[index];
      button.hidden = !card;
      button.disabled = !card || !!card.disabled;
      if (!card) {
        button.removeAttribute('data-card-id');
        return;
      }

      const fallbackTitle = titleFromId(card.id) || 'Woven Gift';
      const title = String(card.title ?? card.name ?? fallbackTitle);
      const category = String(card.category ?? card.family ?? 'Woven Gift');
      // Derived rather than looked up: Path Mastery's copy depends on the weapon
      // this run is holding and on the rank being bought, so it needs the build.
      const description = String(
        card.description ??
        card.copy ??
        describeSurvivalCard(card, this._draftBuild) ??
        '',
      );
      const rank = this._cardRank(card);
      const set = (selector, value) => {
        const element = button.querySelector(selector);
        if (element) element.textContent = value;
      };
      set('.survival-card-category', category);
      set('.survival-card-title', title);
      set('.survival-card-rank', rank);
      set('.survival-card-description', description);
      button.dataset.cardId = String(card.id ?? index);
      button.setAttribute(
        'aria-label',
        `${index + 1}. ${title}. ${rank ? `${rank}. ` : ''}${description}`,
      );
    });
  }

  _cardRank(card) {
    if (card.rankLabel) return String(card.rankLabel);
    if (
      card.transformation ||
      card.kind === 'weapon' ||
      card.familyId === 'weapon-transformation'
    ) {
      return 'Weapon transformation';
    }
    const current = nonNegativeInt(
      card.currentRank ?? card.rank ?? this._draftRanks[card.familyId ?? card.id],
    );
    const next = Math.max(1, nonNegativeInt(card.nextRank, current + 1));
    const family = SURVIVAL_UPGRADE_FAMILIES[card.familyId ?? card.id];
    const max = Number.isFinite(card.maxRank ?? family?.maxRank)
      ? nonNegativeInt(card.maxRank ?? family?.maxRank)
      : 0;
    if (max > 0) return `Rank ${next} / ${max}`;
    if (current > 0 || card.repeatable) return `Rank ${next}`;
    return '';
  }

  _selectUpgrade(index) {
    const card = this._draftCards[index];
    const button = this.cardButtons[index];
    if (!card || !button || button.disabled || this._draftLocked) return;
    this._draftLocked = true;
    this.cardButtons.forEach((item) => { item.disabled = true; });
    if (this.rerollButton) this.rerollButton.disabled = true;
    this.callbacks.onSelectUpgrade(card, index);
  }

  _requestReroll() {
    if (!this.rerollButton || this.rerollButton.disabled || this._rerollLocked) return;
    this._rerollLocked = true;
    this.rerollButton.disabled = true;
    this.callbacks.onReroll(this._draftCards.map((card) => card.id));
  }

  hideUpgradeDraft(restoreFocus = false) {
    this._hideModal(this.upgradeOverlay, restoreFocus);
    this._draftCards = [];
    this._draftRanks = {};
    this._draftBuild = null;
    this._draftLocked = false;
    this._rerollLocked = false;
  }

  showBossStinger({
    name = 'Guardian',
    kicker = 'Guardian of Endless Memory',
    bossIndex = 0,
    tierLabel,
    durationMs = 1500,
    managed = false,
  } = {}) {
    this.hideBossStinger();
    if (!this.stinger) return Promise.resolve(false);

    if (this.stingerName) this.stingerName.textContent = String(name);
    if (this.stingerKicker) this.stingerKicker.textContent = String(kicker);
    if (this.stingerTier) {
      this.stingerTier.textContent = String(tierLabel ?? `Boss ${roman(bossIndex + 1)}`);
    }
    this.stinger.hidden = false;
    // Restart the authored 1.5-second animation for consecutive boss tiers.
    void this.stinger.offsetWidth;
    this.stinger.classList.add('active');
    // Runtime Survival owns this lifetime with its simulation clock so pause,
    // focus loss, and tab hiding cannot desynchronise the name card and boss.
    if (managed) return Promise.resolve(true);

    return new Promise((resolve) => {
      this._stingerResolve = resolve;
      this._stingerTimer = setTimeout(() => {
        this._stingerTimer = null;
        this._stingerResolve = null;
        this.stinger.classList.remove('active');
        this.stinger.hidden = true;
        resolve(true);
      }, Math.max(0, finiteNumber(durationMs, 1500)));
    });
  }

  hideBossStinger() {
    if (this._stingerTimer !== null) {
      clearTimeout(this._stingerTimer);
      this._stingerTimer = null;
    }
    if (this._stingerResolve) {
      const resolve = this._stingerResolve;
      this._stingerResolve = null;
      resolve(false);
    }
    this.stinger?.classList.remove('active');
    if (this.stinger) this.stinger.hidden = true;
  }

  // The mode's title card on black. Resolves when it is off screen; SurvivalFlow
  // paints the briefing underneath first so the fade-out is a crossfade.
  playTitleCard(copy) {
    return this.titleCard.play(copy);
  }

  hideTitleCard() {
    this.titleCard.cancel();
  }

  // Deferred until the title card clears, so Enter/Space cannot start the run
  // through a button the player cannot see yet.
  focusBriefingAction() {
    this._focusSoon(this.briefingBegin);
  }

  // The pre-run briefing. Wave 1 does not exist yet when this is on screen —
  // SurvivalFlow holds `survival.start()` until onBeginRun fires.
  // `focusAction` is false while the title card covers it (see focusBriefingAction).
  showBriefing(focusAction = true) {
    if (!this.briefingOverlay) return;
    this.hideUpgradeDraft(false);
    this.hideDefeat(false);
    this._releasePointerLock();
    if (!this._briefingPainted) {
      this._briefingPainted = paintSurvivalBriefing({
        document: this.document,
        kicker: this.briefingKicker,
        title: this.briefingTitle,
        lede: this.briefingLede,
        sections: this.briefingSections,
        lineFil: this.briefingLineFil,
        lineEng: this.briefingLineEng,
        begin: this.briefingBegin,
      });
    }
    this._showModal(this.briefingOverlay, 'briefing');
    // Focused, so Enter/Space confirm from the keyboard with no extra binding —
    // and so no stray key can start the run by accident.
    if (focusAction) this.focusBriefingAction();
  }

  hideBriefing(restoreFocus = false) {
    this._hideModal(this.briefingOverlay, restoreFocus);
  }

  showDefeat(result = {}, sessionBest = null) {
    if (!this.defeatOverlay) return;
    this.hideUpgradeDraft(false);
    this._releasePointerLock();

    const wave = Math.max(1, nonNegativeInt(result.wave, 1));
    const seconds = finiteNumber(result.activeTime ?? result.activeSeconds ?? result.seconds);
    const kills = nonNegativeInt(result.kills ?? result.echoesDefeated ?? result.enemiesDefeated);
    const bosses = nonNegativeInt(result.bossesDefeated ?? result.bosses);
    const weapon = String(
      result.weaponName ?? weaponLabel(result.weaponPath ?? result.weapon),
    );

    if (this.resultWave) this.resultWave.textContent = String(wave);
    if (this.resultTime) this.resultTime.textContent = formatSurvivalTime(seconds);
    if (this.resultKills) this.resultKills.textContent = String(kills);
    if (this.resultBosses) this.resultBosses.textContent = String(bosses);
    if (this.resultWeapon) this.resultWeapon.textContent = weapon;
    this._paintUpgradeRanks(result.upgradeRanks ?? result.upgrades);
    this._paintSessionBest(result, sessionBest ?? result.sessionBest);

    this._showModal(this.defeatOverlay, 'defeat');
    this._focusSoon(this.retryButton);
  }

  _paintUpgradeRanks(upgrades) {
    if (!this.resultUpgrades) return;
    this.resultUpgrades.textContent = '';
    const ranks = normalizeUpgradeRanks(upgrades);
    if (ranks.length === 0) {
      const empty = this.document.createElement('li');
      empty.textContent = 'No gifts woven';
      this.resultUpgrades.appendChild(empty);
      return;
    }
    for (const upgrade of ranks) {
      const row = this.document.createElement('li');
      const name = this.document.createElement('strong');
      name.textContent = upgrade.name;
      row.append(name, ` · Rank ${upgrade.rank}`);
      this.resultUpgrades.appendChild(row);
    }
  }

  _paintSessionBest(result, best) {
    if (!this.defeatBest) return;
    const currentIsBest = result.isSessionBest ?? !best;
    const source = best ?? result;
    const bestWave = Math.max(1, nonNegativeInt(source.wave, 1));
    const bestTime = finiteNumber(source.activeTime ?? source.activeSeconds ?? source.seconds);
    this.defeatBest.classList.toggle('is-new', !!currentIsBest);
    this.defeatBest.textContent = currentIsBest
      ? `New session best · Wave ${bestWave} · ${formatSurvivalTime(bestTime)}`
      : `Session best · Wave ${bestWave} · ${formatSurvivalTime(bestTime)}`;
  }

  hideDefeat(restoreFocus = false) {
    this._hideModal(this.defeatOverlay, restoreFocus);
  }

  _showModal(overlay, modalName) {
    if (!overlay) return;
    if (!this._activeModal) this._lastFocused = this.document.activeElement;
    overlay.removeAttribute('inert');
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    void overlay.offsetWidth;
    overlay.classList.add('active');
    this._activeModal = modalName;
  }

  _hideModal(overlay, restoreFocus) {
    if (!overlay) return;
    overlay.setAttribute('inert', '');
    const focused = this.document?.activeElement;
    if (focused && overlay.contains?.(focused)) focused.blur?.();
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.hidden = true;
    if (this._overlayFor(this._activeModal) === overlay) this._activeModal = null;
    if (restoreFocus && this._lastFocused?.isConnected) {
      this._lastFocused.focus?.({ preventScroll: true });
    }
    if (!this._activeModal) this._lastFocused = null;
  }

  _overlayFor(modalName) {
    if (modalName === 'upgrade') return this.upgradeOverlay;
    if (modalName === 'defeat') return this.defeatOverlay;
    if (modalName === 'briefing') return this.briefingOverlay;
    return null;
  }

  _focusSoon(element) {
    if (!element?.focus) return;
    const schedule = globalThis.requestAnimationFrame ?? ((callback) => setTimeout(callback, 0));
    schedule(() => {
      if (!element.hidden && !element.disabled) element.focus({ preventScroll: true });
    });
  }

  _handleKeydown(event) {
    if (!this._activeModal) return;
    if (event.code === 'Tab') {
      this._trapFocus(event);
      return;
    }
    if (event.repeat || this._activeModal !== 'upgrade') return;

    const choices = {
      Digit1: 0,
      Numpad1: 0,
      Digit2: 1,
      Numpad2: 1,
      Digit3: 2,
      Numpad3: 2,
    };
    const index = choices[event.code];
    if (index !== undefined) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this._selectUpgrade(index);
      return;
    }
    if (event.code === 'KeyR') {
      event.preventDefault();
      event.stopImmediatePropagation();
      this._requestReroll();
    }
  }

  _trapFocus(event) {
    const overlay = this._overlayFor(this._activeModal);
    if (!overlay) {
      event.preventDefault();
      return;
    }
    const focusable = [...(overlay?.querySelectorAll?.('button:not([disabled]):not([hidden])') ?? [])];
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1);
    const active = this.document.activeElement;
    if (event.shiftKey && (active === first || !overlay.contains(active))) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && (active === last || !overlay.contains(active))) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  }

  _releasePointerLock() {
    if (!this.document?.pointerLockElement || !this.document.exitPointerLock) return;
    this.document.exitPointerLock();
  }

  hideAll() {
    this.hideHud();
    this.hideTitleCard();
    this.hideBriefing(false);
    this.hideUpgradeDraft(false);
    this.hideDefeat(false);
    this.hideBossStinger();
  }

  destroy() {
    this.hideAll();
    for (const { target, type, handler, options } of this._listeners) {
      target.removeEventListener(type, handler, options);
    }
    this._listeners.length = 0;
  }
}
