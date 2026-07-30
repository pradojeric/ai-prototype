// ============================================================
// GAME UI — DOM references + browser input wiring
// ============================================================
import { CONFIG } from '../../config.js';
import { PlatformAccountUI } from '../../ui/PlatformAccountUI.js';
import { CloudSaveUI } from '../../ui/CloudSaveUI.js';
import { wirePresenterSkip } from './PresenterSkip.js';

// Keep DOM ownership outside the orchestration class without changing Game's
// existing element fields. The fields remain on Game because its state-machine
// transitions are the source of truth for which overlays are visible.
export function bindGameUi(game) {
  game.elPrompt = document.getElementById('prompt');
  game.elCross = document.getElementById('crosshair');
  game.elTitle = document.getElementById('title');
  game.elStart = document.getElementById('start');
  game.elStartZone = document.getElementById('start-zone');
  game.elResume = document.getElementById('resume');
  game.elResumeSub = document.getElementById('resume-sub');
  game.elResumeEnter = document.getElementById('resume-enter');
  // The rest of the pause overlay's nodes belong to ui/PauseMenu.js, which caches
  // them itself — Game only needs the three it drives directly.
  game.elFlash = document.getElementById('flash');
  game.elFaint = document.getElementById('faint');
  game.elGspeak = document.getElementById('gspeak');
  game.elZintro = document.getElementById('zintro');
  game.elZoneDone = document.getElementById('zonecomplete');
  game.elZcTitle = document.getElementById('zc-title');
  game.elZcQuote = document.getElementById('zc-quote');
  game.elZcTrans = document.getElementById('zc-trans');
  game.elZcEnter = document.getElementById('zc-enter');
  game.elSkipMuseum = document.getElementById('skipmuseum');
  game.elTestEnding = document.getElementById('test-ending');
  game.elGuardianDebugZone = document.getElementById('guardian-debug-zone');
  game.elMenuStart = document.getElementById('btn-start');
  // The label span, not the button — the button also holds the '›' mark.
  game.elMenuStartLabel = game.elMenuStart.querySelector('span');
  game.elNewGame = document.getElementById('btn-new-game');
  game.elPreAwaken = document.getElementById('pre-awaken');
  game.elAwaken = document.getElementById('btn-awaken');
  game.elSettings = document.getElementById('settings');
  game.elRestartZone = document.getElementById('restart-zone');
  game.elQuitTitle = document.getElementById('quit-title');
  game.elSessionNote = document.getElementById('session-note');
  game.elRingWrap = document.getElementById('holdring');
  game.elRing = game.elRingWrap.querySelector('.prog');
  game.elEndingBlack = document.getElementById('ending-black');
  game.elEndingSubtitle = document.getElementById('ending-subtitle');
  game.elEndingSubtitleEn = document.getElementById('ending-subtitle-en');
  game.elEndingSubtitleFil = document.getElementById('ending-subtitle-fil');
  game.elEndingCredits = document.getElementById('ending-credits');
  game.elEndingReturn = document.getElementById('ending-return');
}

export function wireGameEvents(game) {
  // The player-facing Start action ends on the black pre-Awaken stage; it does
  // not begin the story cinematic until the separate Awaken action below.
  // With a resumable save this button reads Continue and skips the cinematic
  // entirely — the waking-in-the-museum intro only makes sense once per run.
  game.elMenuStart.addEventListener('click', (e) => {
    e.stopPropagation();
    if (game.hasSavedProgress) game._continueFromSave();
    else game._enterPreAwaken();
  });
  // This click begins the intro, so it must not bubble into the global
  // cutscene-click listener below and immediately skip the same cinematic.
  game.elAwaken.addEventListener('click', (e) => {
    e.stopPropagation();
    if (game.phase === 'preAwaken') game._runIntro();
  });
  // Move keyboard focus only once the Start-to-black fade has completed.
  game.elPreAwaken.addEventListener('transitionend', (e) => {
    if (e.target !== game.elPreAwaken || e.propertyName !== 'opacity') return;
    if (game.phase === 'preAwaken' && game.elPreAwaken.classList.contains('active')) {
      game.elAwaken.focus();
    }
  });
  game.elPreAwaken.addEventListener('keydown', (e) => {
    if (game.phase !== 'preAwaken' || e.code !== 'Tab') return;
    e.preventDefault();
    game.elAwaken.focus();
  });
  // Skip the intro + gameplay and drop straight into the walkable museum hub.
  game.elSkipMuseum.style.display = CONFIG.DEBUG_SKIP_MUSEUM_BUTTON ? '' : 'none';
  game.elSkipMuseum.addEventListener('click', (e) => {
    e.stopPropagation();
    if (CONFIG.DEBUG_SKIP_MUSEUM_BUTTON) game._skipToMuseum();
  });
  game.elTestEnding.style.display = CONFIG.DEBUG_TEST_ENDING_BUTTON ? '' : 'none';
  game.elTestEnding.addEventListener('click', (e) => {
    e.stopPropagation();
    if (CONFIG.DEBUG_TEST_ENDING_BUTTON) game._testEnding();
  });
  game.elGuardianDebugZone.style.display = CONFIG.DEBUG_GUARDIAN_ZONE_BUTTON ? '' : 'none';
  game.elGuardianDebugZone.addEventListener('click', (e) => {
    e.stopPropagation();
    if (CONFIG.DEBUG_GUARDIAN_ZONE_BUTTON) game._enterGuardianDebugZone();
  });
  wireSettings(game);
  game.platformAccountUi = new PlatformAccountUI(game.api);
  game.cloudSaveUi = new CloudSaveUI(game.save, {
    onAccountChanged: () => game._reloadForAccountChange(),
  });
  addEventListener('beforeunload', () => {
    game.platformAccountUi.dispose();
    game.api.dispose();
  }, { once: true });
  // Best-effort flush of a debounced save when the tab goes away. Browsers do
  // not guarantee an in-flight request survives unload, so this narrows the
  // window (close the tab within the debounce of a pickup) rather than closing
  // it. 'pagehide' fires on the bfcache path too, where 'beforeunload' does not.
  addEventListener('pagehide', () => { void game.save.flushNow(); });
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void game.save.flushNow();
  });
  // Skipping the intro is deliberately presenter-only (hidden Shift+P). A plain
  // click must never skip it: the very click that starts the cinematic — or a
  // stray second click while the eyelids are still opening — would land on the
  // fading overlay and fast-forward the beat the player just asked to see.
  wirePresenterSkip(game);   // hidden Shift+P demo fast-forward

  game.elStart.addEventListener('click', () => {
    game.audio.init();
    game.player.controls.lock();
  });
  // Zone complete -> walk the finished gallery; resume re-locks after ESC.
  game.elZoneDone.addEventListener('click', () => {
    if (game.phase === 'complete') game._enterMuseum();
  });
  game.elEndingReturn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (game.phase === 'endingCredits') game._enterEpilogueMuseum();
  });
  game.player.controls.addEventListener('lock', () => {
    game.elStart.style.display = 'none';
    // Combat phases own their state transitions. They only need the aiming
    // reticle restored after entry or the pause controller reacquires lock.
    if (game.phase === 'arena' || game.phase === 'survival') {
      game.elCross.classList.add('active');
      return;
    }
    if (game.phase === 'debug') {
      game.elCross.classList.remove('active');
      return;
    }
    if (game.phase === 'defeat' || game.phase === 'faint') return;
    game.elCross.classList.add('active');
    // A fresh descend into the zone (vs. an ESC-resume) plays the zone-intro dialogue.
    const wasDescending = game.phase === 'descend';
    if (game.phase !== 'museum') game._startGameplayPhase();
    if (wasDescending) game._playZoneIntro();
  });
  // A combat verb is live only mid-fight, so exploration clicks (and the
  // pointer-lock click itself) never fire a stray shot or shockwave.
  const combatLive = () => !game.pause.isPaused &&
    (game.phase === 'arena' || game.phase === 'survival') &&
    !game.busy && game.player.controls.isLocked && !!game.combat?.active &&
    (game.phase !== 'survival' || !!game.survival?.acceptsCombatInput);

  document.addEventListener('keydown', (e) => {
    if (!game.pause.isPaused && e.code === 'KeyR' && !e.repeat &&
        (game.phase === 'arena' || game.phase === 'survival') &&
        !game.busy && game.combat?.active &&
        (game.phase !== 'survival' || game.survival?.acceptsCombatInput)) {
      game.combat.activateAlab();
      return;
    }
    if (e.code === 'KeyQ' && !e.repeat && game.phase === 'survival' &&
        combatLive()) {
      game.survival?.requestDash();
      return;
    }
    // Melee shockwave. Edge-triggered on !e.repeat: a HELD F must not stream
    // requests at the manager, which is half of why the cooldown can't be
    // leaned on (the manager drops the other half by never queueing them).
    if (e.code === 'KeyF' && !e.repeat && combatLive()) {
      game.combat.requestMelee();
      return;
    }
    if (game.pause.isPaused || e.code !== 'KeyE') return;
    if (!game.holdKey) game._ePressed = true;
    game.holdKey = true;
  });
  document.addEventListener('keyup', (e) => {
    if (e.code === 'KeyE') game.holdKey = false;
  });

  // ---- Held-fire, and the four ways it is guaranteed to stop --------------
  // Holding left mouse auto-repeats the bolt. A held flag is only safe if it
  // cannot survive the player letting go off-screen, so releasing is wired
  // defensively: the explicit mouseup, losing the window, losing pointer lock,
  // and a per-move reconciliation against what the browser says is actually
  // held. The manager also clears it whenever pointer lock is down (see
  // CombatManager.update), which covers the pause menu.
  const stopFiring = () => game.combat?.setFiring(false);

  document.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (combatLive()) game.combat.setFiring(true);
  });
  // Unconditional: whatever the game state is, letting go must always release.
  document.addEventListener('mouseup', (e) => {
    if (e.button === 0) stopFiring();
  });
  // The watchdog. If a mouseup was swallowed — released outside the window,
  // alt-tabbed mid-hold, a dropped event — the next mouse movement reveals the
  // truth: MouseEvent.buttons is the live button mask, so bit 0 clear while we
  // still think we are firing means the button is long gone. This is the case
  // the explicit listeners cannot catch, and it self-heals on the first move.
  // Clear-only, never re-arm: resurrecting the flag from a button that happens
  // to be down would recreate exactly the stuck-fire bug this exists to kill.
  // Guarded on `firing` first — this runs on every mouse movement in the game.
  document.addEventListener('mousemove', (e) => {
    if (game.combat?.firing && !(e.buttons & 1)) stopFiring();
  });
  addEventListener('blur', stopFiring);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopFiring();
  });
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === null) game.combat?.cancelInput();
  });
  addEventListener('resize', () => {
    game.camera.aspect = innerWidth / innerHeight;
    game.camera.updateProjectionMatrix();
    game.cutscene.resize(innerWidth, innerHeight);
    game.guardianIntro.resize(innerWidth, innerHeight);
    game.faintCutscene.resize(innerWidth, innerHeight);
    game.arenaVictoryCutscene.resize(innerWidth, innerHeight);
    game.portalCutscene.resize(innerWidth, innerHeight);
    game.museumEndingCutscene.resize(innerWidth, innerHeight);
    game.restoredProvince.resize(innerWidth, innerHeight);
    game.renderer.setSize(innerWidth, innerHeight);
    game.composer.setSize(innerWidth, innerHeight);
    game.artifacts?.setResolution(innerWidth, innerHeight);
    // Spawn-tear strands are fat lines too — same screen-space width contract.
    game.combat?.vfx?.setResolution(innerWidth, innerHeight);
  });
}

// Settings modal: volume sliders drive the audio buses and persist across
// sessions. Setters are pre-init safe on AudioManager.
function wireSettings(game) {
  // Fall back to the legacy single-volume key so older saves carry over.
  const readSaved = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key) ?? localStorage.getItem('strings.volume');
      const value = parseFloat(raw);
      if (raw !== null && !Number.isNaN(value)) return value;
    } catch (e) { /* storage optional (private mode) */ }
    return fallback;
  };
  const wireSlider = (sliderId, valueId, storageKey, apply) => {
    const slider = document.getElementById(sliderId);
    const value = document.getElementById(valueId);
    const saved = readSaved(storageKey, 0.9);
    apply(saved);
    slider.value = Math.round(saved * 100);
    value.textContent = `${Math.round(saved * 100)}%`;
    slider.addEventListener('input', () => {
      const volume = slider.value / 100;
      apply(volume);
      value.textContent = `${slider.value}%`;
      try { localStorage.setItem(storageKey, String(volume)); } catch (e) { /* ignore */ }
    });
  };
  wireSlider('music-slider', 'music-val', 'strings.musicVolume',
    (volume) => game.audio.setMusicVolume(volume));
  wireSlider('sfx-slider', 'sfx-val', 'strings.sfxVolume',
    (volume) => game.audio.setSfxVolume(volume));

  // Look speed and brightness are multipliers around 1.0, not percentages of a
  // bus, so they read/write the raw slider value rather than reusing wireSlider.
  // Deliberately NOT readSaved: that one falls back to the legacy single-volume
  // key, which would silently turn an old 50% volume into a 0.5× look speed.
  const readNumber = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      const parsed = parseFloat(raw);
      if (raw !== null && !Number.isNaN(parsed)) return parsed;
    } catch (e) { /* storage optional (private mode) */ }
    return fallback;
  };
  const wireMultiplier = (sliderId, valueId, storageKey, format, apply) => {
    const slider = document.getElementById(sliderId);
    const value = document.getElementById(valueId);
    const saved = readNumber(storageKey, 1);
    const clamped = Math.min(Math.max(saved, slider.min / 100), slider.max / 100);
    apply(clamped);
    slider.value = Math.round(clamped * 100);
    value.textContent = format(clamped);
    slider.addEventListener('input', () => {
      const next = slider.value / 100;
      apply(next);
      value.textContent = format(next);
      try { localStorage.setItem(storageKey, String(next)); } catch (e) { /* ignore */ }
    });
  };
  wireMultiplier('look-slider', 'look-val', 'strings.lookSpeed',
    (v) => `${v.toFixed(2)}×`,
    (speed) => { game.player.controls.pointerSpeed = speed; });
  wireMultiplier('bright-slider', 'bright-val', 'strings.brightness',
    (v) => `${Math.round(v * 100)}%`,
    // ACES tone mapping is applied by OutputPass from the renderer's exposure,
    // so this one dial brightens every scene (zones, hub, cutscenes) at once.
    (exposure) => { game.renderer.toneMappingExposure = exposure; });

  wireSessionActions(game);

  const open = (e) => {
    e.stopPropagation();
    game.elRestartZone.disabled = !game.canRestartZone();
    game.elSessionNote.textContent = game.canRestartZone()
      ? 'Restarting keeps the memories you already recovered here.'
      : 'Restart is available while you are inside a memory.';
    // The account may have linked, or the save may have arrived, since the
    // panel was last opened.
    game.cloudSaveUi?.render();
    game.elSettings.classList.add('active');
  };
  document.getElementById('btn-settings').addEventListener('click', open);
  // Every settings affordance outside the main menu is marked with the attribute
  // (the Descend screen's corner gear, the pause menu's footer button). `open`
  // stops propagation, so opening settings from the pause overlay never counts as
  // the click-anywhere-to-resume gesture.
  document.querySelectorAll('[data-settings]').forEach((el) => el.addEventListener('click', open));

  const close = (e) => {
    e.stopPropagation();
    game.elSettings.classList.remove('active');
  };
  document.getElementById('settings-close').addEventListener('click', close);
  // Clicking the dim backdrop (not the panel) also closes.
  game.elSettings.addEventListener('click', (e) => {
    if (e.target === game.elSettings) close(e);
  });
}

// Restart / Quit are irreversible, so each button arms itself on the first click
// and only acts on the second. A two-step button beats window.confirm here: a
// native dialog inside a pointer-locked WebGL game steals focus and can leave the
// pause overlay in a state the player did not ask for.
function wireSessionActions(game) {
  const ARM_TIMEOUT = 4000;
  const arm = (button, act) => {
    const idle = button.textContent.trim();
    const confirmLabel = button.dataset.confirmLabel;
    let timer = null;
    const disarm = () => {
      clearTimeout(timer);
      timer = null;
      button.classList.remove('is-armed');
      button.textContent = idle;
    };
    button.addEventListener('click', (e) => {
      e.stopPropagation();     // never resume the game or close the modal
      if (timer) { disarm(); act(); return; }
      button.classList.add('is-armed');
      button.textContent = confirmLabel;
      timer = setTimeout(disarm, ARM_TIMEOUT);
    });
    // Closing the modal must not leave a button armed for the next time it opens.
    game.elSettings.addEventListener('transitionend', () => {
      if (!game.elSettings.classList.contains('active') && timer) disarm();
    });
  };

  arm(game.elRestartZone, () => {
    game.elSettings.classList.remove('active');
    game._restartZone();
  });
  arm(game.elQuitTitle, () => game._quitToTitle());
  // Erasing the cloud save is the most destructive action in the game, so it
  // uses the same two-step arm. It lives on the title menu rather than in
  // settings, but the pattern (and the 4s auto-disarm) is identical.
  if (game.elNewGame) arm(game.elNewGame, () => game._newGame());
}
