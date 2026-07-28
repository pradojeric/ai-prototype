const CONTROL_HINTS = Object.freeze({
  move: ['Movement', 'WASD — Move through the memory'],
  look: ['Awareness', 'Mouse — Look around'],
  sprint: ['Movement', 'Shift — Sprint'],
  interact: ['Interaction', 'E — Reach toward the memory'],
  cast: ['Combat', 'Click — Cast Light'],
  release: ['Cursor', 'Esc — Release the cursor'],
  alab: ['Alab Ready', 'R — Release Alab for rapid fire'],
});

const LUMINA_HINTS = Object.freeze({
  vitality: ['Memory Lumina', 'Vitality — Health restored'],
  zephyr: ['Memory Lumina', 'Zephyr — Movement empowered'],
  overcharge: ['Memory Lumina', 'Overcharge — Bolt damage doubled'],
});

export class JourneyGuide {
  constructor(wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))) {
    this.wait = wait;
    this.panel = document.getElementById('journey-guide');
    this.collapsed = document.getElementById('journey-collapsed');
    this.archive = document.getElementById('journey-archive');
    this.story = document.getElementById('journey-story');
    this.objective = document.getElementById('journey-objective');
    this.progress = document.getElementById('journey-progress');
    this.progressFill = document.getElementById('journey-progress-fill');
    this.progressCount = document.getElementById('journey-progress-count');
    this.soulProgress = document.getElementById('journey-soul-progress');
    this.soulProgressFill = document.getElementById('journey-soul-progress-fill');
    this.soulProgressCount = document.getElementById('journey-soul-progress-count');
    this.toast = document.getElementById('guidance-toast');
    this.toastKind = document.getElementById('guidance-kind');
    this.toastMessage = document.getElementById('guidance-message');

    this.seenControls = new Set();
    this.seenLumina = new Set();
    this.queue = [];
    this.currentId = null;
    this.suppressed = true;
    this.draining = false;
    this.disposed = false;

    this._onLumina = (event) => this.showLumina(event.detail?.type);
    document.addEventListener('strings:lumina-effect', this._onLumina);
    this._onAlabReady = () => this.showControl('alab');
    document.addEventListener('strings:alab-ready', this._onAlabReady);
  }

  setObjective(model, animate = true) {
    const mode = model?.mode || 'hidden';
    this.panel.classList.toggle('active', mode === 'expanded');
    this.collapsed.classList.toggle('active', mode === 'collapsed');
    this.setSuppressed(mode === 'hidden');
    if (mode === 'hidden') {
      this.currentId = null;
      return;
    }
    if (mode === 'collapsed') {
      this.collapsed.textContent = model.objective;
      this.currentId = model.id;
      return;
    }

    this.archive.textContent = model.archive || 'Aking Museo';
    this.story.textContent = model.story || '';
    this.objective.textContent = model.objective || '';
    this._setProgress(model.progress);
    this._setProgress(
      model.soulProgress,
      this.soulProgress,
      this.soulProgressFill,
      this.soulProgressCount,
    );

    if (animate) {
      this.panel.classList.remove('updated');
      void this.panel.offsetWidth;
      this.panel.classList.add('updated');
    }
    this.currentId = model.id;
  }

  showControl(key) {
    if (!CONTROL_HINTS[key] || this.seenControls.has(key)) return;
    this.seenControls.add(key);
    this._enqueue(CONTROL_HINTS[key]);
  }

  showLumina(type) {
    if (!LUMINA_HINTS[type] || this.seenLumina.has(type)) return;
    this.seenLumina.add(type);
    this._enqueue(LUMINA_HINTS[type]);
  }

  setSuppressed(suppressed) {
    this.suppressed = suppressed;
    this.toast.classList.toggle('suppressed', suppressed);
    if (!suppressed) void this._drain();
  }

  dispose() {
    this.disposed = true;
    this.queue.length = 0;
    document.removeEventListener('strings:lumina-effect', this._onLumina);
    document.removeEventListener('strings:alab-ready', this._onAlabReady);
  }

  _setProgress(
    value,
    element = this.progress,
    fill = this.progressFill,
    count = this.progressCount,
  ) {
    const active = !!value && value.total > 0;
    element.classList.toggle('active', active);
    if (!active) return;
    const current = Math.max(0, Math.min(value.current, value.total));
    count.textContent = value.label;
    fill.style.width = `${(current / value.total) * 100}%`;
    element.setAttribute('aria-valuemin', '0');
    element.setAttribute('aria-valuemax', String(value.total));
    element.setAttribute('aria-valuenow', String(current));
  }

  _enqueue([kind, message]) {
    this.queue.push({ kind, message });
    void this._drain();
  }

  async _drain() {
    if (this.draining || this.suppressed || this.disposed) return;
    this.draining = true;
    while (this.queue.length && !this.disposed) {
      if (this.suppressed) break;
      const item = this.queue.shift();
      this.toastKind.textContent = item.kind;
      this.toastMessage.textContent = item.message;
      this.toast.classList.add('active');
      await this.wait(3600);
      this.toast.classList.remove('active');
      await this.wait(260);
    }
    this.draining = false;
  }
}
