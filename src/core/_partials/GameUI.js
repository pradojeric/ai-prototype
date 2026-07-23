// ============================================================
// GAME UI — DOM references + browser input wiring
// ============================================================
import { CONFIG } from '../../config.js';

// Keep DOM ownership outside the orchestration class without changing Game's
// existing element fields. The fields remain on Game because its state-machine
// transitions are the source of truth for which overlays are visible.
export function bindGameUi(game) {
  game.elFound = document.getElementById('found');
  game.elTotal = document.getElementById('total');
  game.elHud = document.getElementById('hud');
  game.elGhint = document.getElementById('ghint');
  game.elGhintLabel = document.getElementById('ghint-label');
  game.elPrompt = document.getElementById('prompt');
  game.elCross = document.getElementById('crosshair');
  game.elTitle = document.getElementById('title');
  game.elStart = document.getElementById('start');
  game.elStartZone = document.getElementById('start-zone');
  game.elResume = document.getElementById('resume');
  game.elResumeSub = document.getElementById('resume-sub');
  game.elResumeEnter = document.getElementById('resume-enter');
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
  game.elAwaken = document.getElementById('btn-awaken');
  game.elSettings = document.getElementById('settings');
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
  // Title menu -> play the intro cutscene -> reveal the Descend screen.
  // stopPropagation so these clicks don't reach the cutscene-skip handler below.
  game.elAwaken.addEventListener('click', (e) => {
    e.stopPropagation();
    game._runIntro();
  });
  // Skip the intro + gameplay and drop straight into the walkable museum hub.
  game.elSkipMuseum.addEventListener('click', (e) => {
    e.stopPropagation();
    game._skipToMuseum();
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
  // A click during the cutscene skips to the white fade.
  addEventListener('click', () => {
    if (!game.pause.isPaused && game.phase === 'cutscene') game.cutscene.skip();
  });

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
    // Arena/faint phases own their state transitions. Every arena still needs
    // its aiming reticle restored after the pause controller reacquires lock.
    if (game.phase === 'arena') {
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
  document.addEventListener('keydown', (e) => {
    if (game.pause.isPaused || e.code !== 'KeyE') return;
    if (!game.holdKey) game._ePressed = true;
    game.holdKey = true;
  });
  document.addEventListener('keyup', (e) => {
    if (e.code === 'KeyE') game.holdKey = false;
  });
  // Left click casts a light-bolt — only mid-fight, so exploration clicks
  // (and the pointer-lock click itself) never fire a stray shot.
  document.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (!game.pause.isPaused && game.phase === 'arena' && !game.busy &&
        game.player.controls.isLocked && game.combat && game.combat.active) {
      game.combat.requestFire();
    }
  });
  addEventListener('resize', () => {
    game.camera.aspect = innerWidth / innerHeight;
    game.camera.updateProjectionMatrix();
    game.cutscene.resize(innerWidth, innerHeight);
    game.faintCutscene.resize(innerWidth, innerHeight);
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

  const open = (e) => {
    e.stopPropagation();
    game.elSettings.classList.add('active');
  };
  document.getElementById('btn-settings').addEventListener('click', open);
  document.querySelectorAll('.gear').forEach((gear) => gear.addEventListener('click', open));

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
