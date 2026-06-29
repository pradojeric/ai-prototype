// ============================================================
// ECHO VOICE — one artifact's spatialized "ping" locator (GDD §6)
//
// A PannerNode parked at the artifact's world position emits a soft repeating
// bell tone. With the AudioListener driven by the camera, the ping carries
// real direction (it pans as you turn) and distance (it swells as you near),
// so the player can home in by ear from beyond the visible string's reach.
// ============================================================
import { ECHO } from '../config.js';

// A short pentatonic set so different artifacts ping at distinct, consonant
// pitches — easier to tell two echoes apart while triangulating.
const PING_SCALE = [392.0, 440.0, 523.25, 587.33, 659.25]; // G4 A4 C5 D5 E5

export class EchoVoice {
  // `destination` is the shared echo/delay send on the master bus.
  constructor(ctx, destination, pos, phase = 0) {
    this.ctx = ctx;
    this.freq = PING_SCALE[Math.floor(Math.random() * PING_SCALE.length)];
    this.phase = phase;                       // staggers pings across artifacts
    this.nextPing = ctx.currentTime + phase;  // first ping after the offset

    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = ECHO.REF_DIST;
    panner.maxDistance = ECHO.RANGE;
    panner.rolloffFactor = 1.2;
    this._setPos(panner, pos);
    panner.connect(destination);
    this.panner = panner;
  }

  _setPos(panner, pos) {
    if (panner.positionX) {
      panner.positionX.value = pos.x;
      panner.positionY.value = pos.y;
      panner.positionZ.value = pos.z;
    } else {
      panner.setPosition(pos.x, pos.y, pos.z); // deprecated fallback
    }
  }

  // Schedule the next bell ping once its phased timer elapses. Called each frame
  // with ctx.currentTime; allocates only the one-shot nodes a ping needs (auto
  // GC'd after stop), nothing per-frame while waiting.
  update(now) {
    if (now < this.nextPing) return;
    this.nextPing = now + ECHO.PING_INTERVAL;
    this._ping(now);
  }

  _ping(at) {
    const { ctx } = this;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = this.freq;
    // Bell-like attack/decay: quick rise, long-ish tail.
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(ECHO.GAIN, at + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 1.1);
    osc.connect(env).connect(this.panner);
    osc.start(at);
    osc.stop(at + 1.2);
  }

  dispose() {
    try { this.panner.disconnect(); } catch (e) { /* already gone */ }
  }
}
