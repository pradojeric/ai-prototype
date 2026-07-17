// ============================================================
// ECHO VOICE — one artifact's spatialized "ping" locator (GDD §6)
//
// A PannerNode parked at the artifact's world position emits a soft repeating
// bell tone. With the AudioListener driven by the camera, the ping carries
// real direction (it pans as you turn) and distance (it swells as you near),
// so the player can home in by ear from beyond the visible string's reach.
// ============================================================
import { ECHO, clamp01 } from '../config.js';

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

    this.pos = { x: pos.x, y: pos.y, z: pos.z }; // kept for the listener-distance gate

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
  // with ctx.currentTime + the listener's world position; allocates only the
  // one-shot nodes a ping needs (auto GC'd after stop), nothing while waiting.
  //
  // The panner's 'inverse' distance model never actually reaches zero (its
  // maxDistance is ignored by that model), so range-gate here: fade the ping's
  // envelope out across the last ECHO.FADE meters and skip it entirely beyond
  // ECHO.RANGE — a skipped ping also keeps the shared delay tail silent.
  update(now, listenerPos) {
    if (now < this.nextPing) return;
    this.nextPing = now + ECHO.PING_INTERVAL;

    let fade = 1;
    if (listenerPos) {
      const dx = listenerPos.x - this.pos.x;
      const dy = listenerPos.y - this.pos.y;
      const dz = listenerPos.z - this.pos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      fade = clamp01((ECHO.RANGE - dist) / ECHO.FADE);
      if (fade <= 0) return; // out of earshot: no ping, no delay feed
    }
    this._ping(now, fade);
  }

  _ping(at, fade = 1) {
    const { ctx } = this;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = this.freq;
    // Bell-like attack/decay: quick rise, long-ish tail.
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(ECHO.GAIN * fade, at + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 1.1);
    osc.connect(env).connect(this.panner);
    osc.start(at);
    osc.stop(at + 1.2);
  }

  dispose() {
    try { this.panner.disconnect(); } catch (e) { /* already gone */ }
  }
}
