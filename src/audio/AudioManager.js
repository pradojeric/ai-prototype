// ============================================================
// AUDIO — procedural string hum near artifact (no asset files)
// ============================================================
export class AudioManager {
  constructor() { this.ready = false; }

  init() {
    if (this.ready) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.osc = this.ctx.createOscillator();
      this.gain = this.ctx.createGain();
      this.osc.type = 'sine';
      this.osc.frequency.value = 196; // G string
      this.gain.gain.value = 0;
      this.osc.connect(this.gain).connect(this.ctx.destination);
      this.osc.start();
      this.ready = true;
    } catch (e) { /* audio optional */ }
  }

  setProximity(dist) {
    if (!this.ready) return;
    // hum rises as the strings draw taut (<3m)
    const target = dist < 3 ? 0.06 * (1 - dist / 3) : 0;
    this.gain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.2);
  }
}
