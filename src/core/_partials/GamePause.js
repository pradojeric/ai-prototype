// ============================================================
// GAME PAUSE — focus, visibility, pointer-lock, and active-time ownership
// ============================================================

const PAUSABLE_PHASES = new Set([
  'cutscene',
  'playing',
  'museum',
  'arena',
  'survival',
  // NOTE: 'survivalFaint' is deliberately absent from both sets. It is a modal
  // beat like survivalUpgrade/survivalDefeat: pointer lock is already released
  // when it starts, and making it a pointer phase turned that release into a
  // 'pointer-lock' pause, which froze the frame loop mid-collapse and left the
  // player on a black screen with no ledger.
  'debug',
  'faint',
  'endingPortal',
  'endingMuseum',
  'endingRestored',
]);

const POINTER_PHASES = new Set([
  'playing',
  'museum',
  'arena',
  'survival',
  'debug',
  'faint',
]);

export class GamePauseController {
  // `describeRun` returns the pause ledger's view model for the current run (see
  // PauseState.js + ui/_partials/pauseModel.js). Injected rather than imported so
  // this controller stays a pure input/time authority with no content deps.
  constructor(game, describeRun = null) {
    this.game = game;
    this.describeRun = describeRun;
    this.isPaused = false;
    this.reason = null;
    this._resumeNeedsPointerLock = false;
    this._resumePending = false;
    this._resumeWatchdog = null;
    this._ignoreUnlock = false;
    this._tasks = new Set();
    this._pausedAnimations = [];

    this._onBlur = () => this.pause('focus');
    this._onVisibilityChange = () => {
      if (document.hidden) this.pause('visibility');
    };
    this._onLock = () => this._handleLock();
    this._onUnlock = () => this._handleUnlock();
    this._onPointerLockError = () => this._handlePointerLockError();
    this._onResumeClick = (event) => this.requestResume(event);

    window.addEventListener('blur', this._onBlur);
    document.addEventListener('visibilitychange', this._onVisibilityChange);
    document.addEventListener('pointerlockerror', this._onPointerLockError);
    game.player.controls.addEventListener('lock', this._onLock);
    game.player.controls.addEventListener('unlock', this._onUnlock);
    // The backdrop resumes; so does the explicit button, which is bound directly
    // because the ledger panel between them swallows clicks so the player can
    // browse it (see ui/PauseMenu.js).
    game.elResume.addEventListener('click', this._onResumeClick);
    game.elResumeEnter.addEventListener('click', this._onResumeClick);
  }

  pause(reason = 'manual', needsPointerLock = this._phaseNeedsPointerLock()) {
    if (!this.isPaused && !PAUSABLE_PHASES.has(this.game.phase)) return false;

    if (this.isPaused) {
      this._resumeNeedsPointerLock ||= needsPointerLock;
      if (reason === 'focus' || reason === 'visibility') {
        this._resumePending = false;
        this._clearResumeWatchdog();
      }
      return true;
    }

    this.isPaused = true;
    this.reason = reason;
    this._resumeNeedsPointerLock = needsPointerLock;
    this._resumePending = false;
    this._pauseTasks();
    this._clearInput();
    this._showOverlay();
    this._freezeAnimations();
    document.body.classList.add('game-paused');
    this.game.audio.setPaused(true);

    // PointerLockControls emits its native unlock event before updating isLocked.
    // Releasing again here would arm _ignoreUnlock after that event already fired.
    if (reason !== 'pointer-lock' && this.game.player.controls.isLocked) {
      this.releasePointerLock();
    }
    return true;
  }

  requestResume(event) {
    event?.preventDefault();
    event?.stopPropagation();
    if (!this.isPaused || this._resumePending) return;
    if (document.hidden || !document.hasFocus()) {
      this.game.elResumeEnter.textContent = 'Return to this window to resume';
      return;
    }

    this._clearInput();
    this.game.audio.resumeContext();
    if (!this._resumeNeedsPointerLock) {
      this._completeResume();
      return;
    }

    if (this.game.player.controls.isLocked) {
      this._completeResume();
      return;
    }

    this._resumePending = true;
    this.game.elResumeEnter.textContent = 'Reclaiming the thread…';
    this._resumeWatchdog = setTimeout(() => {
      this._resumeWatchdog = null;
      if (!this.isPaused || !this._resumePending) return;
      this._resumePending = false;
      this.game.elResumeEnter.textContent = 'Pointer lock was not granted — click to try again';
    }, 1200);
    try {
      this.game.player.controls.lock();
    } catch (error) {
      this._handlePointerLockError();
    }
  }

  // Leave the paused state without reclaiming pointer lock, for the cases where
  // another overlay takes over instead of gameplay resuming (Restart hands off to
  // the Descend screen; Quit reloads). The clocks and animations restart, so no
  // active-time wait is left frozen behind the new screen.
  abandon() {
    if (!this.isPaused) return;
    this._resumeNeedsPointerLock = false;
    this._completeResume();
  }

  releasePointerLock() {
    if (!this.game.player.controls.isLocked) return;
    this._ignoreUnlock = true;
    try {
      this.game.player.controls.unlock();
    } catch (error) {
      this._ignoreUnlock = false;
    }
  }

  wait(milliseconds) {
    return new Promise((resolve) => {
      const task = {
        remaining: Math.max(0, milliseconds),
        startedAt: 0,
        timer: null,
        resolve,
      };
      this._tasks.add(task);
      if (!this.isPaused) this._startTask(task);
    });
  }

  nextFrame(callback) {
    const attempt = () => {
      this.wait(0).then(() => {
        requestAnimationFrame(() => {
          if (this.isPaused) attempt();
          else callback();
        });
      });
    };
    attempt();
  }

  _phaseNeedsPointerLock() {
    if (!POINTER_PHASES.has(this.game.phase)) return false;
    if (this.game.discovery?.active) return false;
    // A click-driven riddle card wants the cursor free on resume. Arena 3's seal
    // bugtong is answered with the number keys while the tower keeps running, so
    // that one must reclaim pointer lock or the player resumes unable to move.
    const riddle = document.getElementById('riddle');
    if (riddle?.classList.contains('active') && !riddle.classList.contains('keys')) {
      return false;
    }
    return true;
  }

  _handleLock() {
    if (!this.isPaused) return;
    if (this._resumePending && !document.hidden && document.hasFocus()) {
      this._clearResumeWatchdog();
      this._completeResume();
      return;
    }
    this.releasePointerLock();
  }

  _handleUnlock() {
    if (this._ignoreUnlock) {
      this._ignoreUnlock = false;
      return;
    }
    if (this.isPaused) {
      this._resumeNeedsPointerLock = true;
      this._resumePending = false;
      this._clearResumeWatchdog();
      this.game.elResumeEnter.textContent = 'Click to try again';
      return;
    }
    if (POINTER_PHASES.has(this.game.phase)) this.pause('pointer-lock', true);
  }

  _handlePointerLockError() {
    if (!this.isPaused) {
      if (POINTER_PHASES.has(this.game.phase)) this.pause('pointer-lock-error', true);
      return;
    }
    this._resumePending = false;
    this._clearResumeWatchdog();
    this._resumeNeedsPointerLock = true;
    this.game.elResumeEnter.textContent = 'Pointer lock failed — click to try again';
  }

  _completeResume() {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.reason = null;
    this._resumePending = false;
    this._ignoreUnlock = false;
    this._clearResumeWatchdog();
    this._resumeNeedsPointerLock = false;
    this._clearInput();
    this.game.clock.getDelta();
    this.game.elResume.style.display = 'none';
    this.game.elResume.setAttribute('aria-hidden', 'true');
    // Drop focus, or the combat hop's Space would keep re-activating the button.
    this.game.elResumeEnter.blur?.();
    document.body.classList.remove('game-paused');
    this._resumeAnimations();
    this.game.audio.setPaused(false);
    this._resumeTasks();
  }

  _clearInput() {
    this.game.player.resetInput();
    this.game.holdKey = false;
    this.game._ePressed = false;
    this.game.combat?.cancelInput();
  }

  // Paint the pause ledger from a fresh snapshot of the run, then reveal it. The
  // model is built once per pause — nothing here runs per frame.
  _showOverlay() {
    const model = this.describeRun?.();
    if (model) {
      this.game.elResumeSub.textContent = `"${model.subtitle}"`;
      this.game.pauseMenu?.render(model);
    }
    this.game.elResumeEnter.textContent = 'Resume';
    this.game.elResume.style.display = 'flex';
    this.game.elResume.setAttribute('aria-hidden', 'false');
    this.game.elCross.classList.remove('active');
    // Focus the primary action so Enter/Space resumes too: a keypress carries the
    // same transient activation a click does, so pointer lock is still granted.
    this.game.elResumeEnter.focus?.();
  }

  _startTask(task) {
    task.startedAt = performance.now();
    task.timer = setTimeout(() => {
      task.timer = null;
      this._tasks.delete(task);
      task.resolve();
    }, task.remaining);
  }

  _pauseTasks() {
    const now = performance.now();
    for (const task of this._tasks) {
      if (task.timer === null) continue;
      clearTimeout(task.timer);
      task.timer = null;
      task.remaining = Math.max(0, task.remaining - (now - task.startedAt));
    }
  }

  _resumeTasks() {
    for (const task of this._tasks) {
      if (task.timer === null) this._startTask(task);
    }
  }

  _freezeAnimations() {
    this._pausedAnimations.length = 0;
    if (!document.getAnimations) return;
    for (const animation of document.getAnimations()) {
      const target = animation.effect?.target;
      if (target?.closest?.('#resume, #settings')) continue;
      if (animation.playState !== 'running' && animation.playState !== 'pending') continue;
      animation.pause();
      this._pausedAnimations.push(animation);
    }
  }

  _resumeAnimations() {
    for (const animation of this._pausedAnimations) {
      try { animation.play(); } catch (error) { /* animation was removed while paused */ }
    }
    this._pausedAnimations.length = 0;
  }

  _clearResumeWatchdog() {
    clearTimeout(this._resumeWatchdog);
    this._resumeWatchdog = null;
  }
}
