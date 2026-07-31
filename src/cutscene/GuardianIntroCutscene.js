// ============================================================
// GUARDIAN INTRO CUTSCENE — low-angle, hard-cut live-world reveals
// ============================================================
import * as THREE from 'three';
import { clamp01 } from '../config.js';

const smooth = (value) => value * value * (3 - 2 * value);
const rush = (value) => 1 - (1 - value) ** 3;
const creep = (value) => value * value;
const READING_WORDS_PER_SECOND = 3.05;
const MIN_DIALOGUE_HOLD = 3.1;

const INTRO = {
  arena1: {
    name: 'THE FEASTKEEPER',
    title: 'Bantay ng Piging',
    dialogue: [
      'These drowned tables still remember every hand they once fed.',
      'Answer the old words—or join the hunger beneath them.',
    ],
    color: '#c9a16b',
  },
  arena2: {
    name: 'THE REVELER',
    title: 'Guardian of LIKET',
    dialogue: [
      'The river carried our lanterns, our laughter, and every promise home.',
      'Keep their light alive—or be swept from the festival forever.',
    ],
    color: '#77e3d5',
  },
  // The Keeper is met on the far side of the summit portal (arena3boss); the
  // ascent that earns the crossing is Arena 3's, hence the shared framing below.
  // Placeholder copy and shot list until arena3boss's real geometry is authored.
  arena3boss: {
    name: 'THE ARCHIVIST',
    title: 'Ang Tagapag-ingat ng mga Alaala',
    dialogue: [
      'Three seals broken. Three truths carried above the rising dark.',
      'Now prove that memory belongs to the living.',
    ],
    color: '#e5bf63',
  },
};

function dialogueDuration(text) {
  const words = text.trim().split(/\s+/).length;
  return Math.max(MIN_DIALOGUE_HOLD, words / READING_WORDS_PER_SECOND);
}

function timingFor(script) {
  const holds = script.dialogue.map(dialogueDuration);
  const reveal = 2.35;
  const cutaway = 0.48;
  const settle = 1.25;
  return {
    nameAt: 1.05,
    dialogueAt: [reveal, reveal + holds[0] + cutaway],
    holds,
    reveal,
    cutaway,
    settle,
    total: reveal + holds[0] + cutaway + holds[1] + settle,
  };
}

export class GuardianIntroCutscene {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 220);
    this.overlay = document.getElementById('guardian-intro');
    this.elName = document.getElementById('guardian-intro-name');
    this.elTitle = document.getElementById('guardian-intro-title');
    this.elDialogue = document.getElementById('guardian-intro-dialogue');
    this.active = false;
    this._time = 0;
    this._total = 0;
    this._resolve = null;
    this._shots = [];
    this._shotIndex = 0;
    this._dialogueIndex = -1;
    this._pos = new THREE.Vector3();
    this._look = new THREE.Vector3();
  }

  durationFor(arenaId) {
    return timingFor(INTRO[arenaId] || INTRO.arena1).total;
  }

  play(arenaId, target, playerPosition) {
    const script = INTRO[arenaId] || INTRO.arena1;
    this.active = true;
    this._time = 0;
    this._timing = timingFor(script);
    this._total = this._timing.total;
    this._script = script;
    this._dialogueIndex = -1;
    this._shotIndex = 0;
    this._shots = this._buildShots(arenaId, target, playerPosition, this._timing);
    this.elName.textContent = script.name;
    this.elName.style.color = script.color;
    this.elTitle.textContent = script.title;
    this.elDialogue.textContent = '';
    this.overlay.classList.add('active');
    this.overlay.classList.remove('show-name', 'show-dialogue');
    this._sample(0);
    return new Promise((resolve) => { this._resolve = resolve; });
  }

  _buildShots(arenaId, target, playerPosition, timing) {
    const center = target.clone();
    const back = playerPosition.clone().sub(center).setY(0);
    if (back.lengthSq() < 0.01) back.set(0, 0, 1);
    back.normalize();
    const side = new THREE.Vector3(-back.z, 0, back.x);
    const point = (backDistance, sideDistance, yOffset) => center.clone()
      .addScaledVector(back, backDistance)
      .addScaledVector(side, sideDistance)
      .add(new THREE.Vector3(0, yOffset, 0));
    const gaze = (sideOffset = 0, yOffset = 0) => center.clone()
      .addScaledVector(side, sideOffset)
      .add(new THREE.Vector3(0, yOffset, 0));
    const shot = (
      duration, from, to, lookFrom, lookTo, options = {},
    ) => ({
      duration,
      from,
      to,
      lookFrom,
      lookTo,
      fovFrom: options.fovFrom ?? 58,
      fovTo: options.fovTo ?? options.fovFrom ?? 58,
      rollFrom: options.rollFrom ?? 0,
      rollTo: options.rollTo ?? 0,
      shake: options.shake ?? 0,
      ease: options.ease || 'smooth',
      seed: options.seed ?? 0,
    });

    let shots;
    if (arenaId === 'arena2') {
      // Reveler: race the spectral river, cut dangerously close to the coral
      // silhouette, then let the current throw us into the final low hero frame.
      shots = [
        shot(0.92, point(12, -10, -2.85), point(7.2, -3.8, -2.6),
          gaze(-0.8, 0.7), gaze(0, 1.0),
          { fovFrom: 78, fovTo: 60, rollFrom: -0.11, rollTo: -0.035, shake: 0.1, ease: 'rush', seed: 1 }),
        shot(0.72, point(3.8, 5.8, -1.2), point(2.8, 3.1, -1.55),
          gaze(0.9, 1.2), gaze(0, 0.65),
          { fovFrom: 48, fovTo: 39, rollFrom: 0.13, rollTo: 0.04, shake: 0.045, ease: 'rush', seed: 2 }),
        shot(0.71, point(10.5, 1.4, -2.75), point(7.6, 0, -2.45),
          gaze(0, 1.6), gaze(0, 0.5),
          { fovFrom: 68, fovTo: 46, rollFrom: 0.025, shake: 0.07, ease: 'rush', seed: 3 }),
        shot(timing.holds[0], point(6.6, -3.4, -2.25), point(5.1, 1.7, -1.95),
          gaze(-0.45, 0.65), gaze(0.35, 0.9),
          { fovFrom: 49, fovTo: 43, rollFrom: -0.055, rollTo: 0.025, shake: 0.025, ease: 'smooth', seed: 4 }),
        shot(timing.cutaway, point(2.65, -3.2, -0.25), point(2.35, -1.6, -0.45),
          gaze(-0.7, 0.35), gaze(0, 0.2),
          { fovFrom: 37, fovTo: 34, rollFrom: -0.09, rollTo: -0.035, shake: 0.09, ease: 'rush', seed: 5 }),
        shot(timing.holds[1], point(4.4, 5.3, -1.65), point(9.2, 1.2, -2.35),
          gaze(0.7, 0.75), gaze(0, 0.55),
          { fovFrom: 41, fovTo: 56, rollFrom: 0.08, rollTo: 0, shake: 0.035, ease: 'smooth', seed: 6 }),
        shot(timing.settle, point(7.8, 0, -2.55), point(8.8, 0, -2.35),
          gaze(0, 0.85), gaze(0, 0.55),
          { fovFrom: 44, fovTo: 48, shake: 0.025, ease: 'creep', seed: 7 }),
      ];
    } else if (arenaId === 'arena3boss') {
      // Keeper: skim in low over the deck, cut upward through the body to the
      // memory core, then retreat past the rail to expose its impossible scale.
      //
      // Every camera point here is authored against the Keeper's deck, which sits
      // 2.29 m below its chest (the gaze origin) with a 0.8 m rail around the rim.
      // A yOffset of -1.5 therefore sits ~0.8 m above the stones, and anything at
      // or beyond the 9 m deck radius is kept above -1.4 so the rail never cuts
      // across frame. The previous pass inherited the tower's tighter skim, which
      // put the settle shot 16 cm UNDER the deck and filled it with floor.
      shots = [
        // Crosses the rim at ~93% through: held just over the rail top so the
        // 0.095 shake reads as vaulting the railing rather than clipping it.
        shot(1.05, point(13.5, 6.4, -1.35), point(8.2, 2.6, -1.38),
          gaze(0, 1.1), gaze(0, 1.65),
          { fovFrom: 76, fovTo: 55, rollFrom: 0.105, rollTo: 0.025, shake: 0.095, ease: 'rush', seed: 8 }),
        shot(0.68, point(4.2, -4.8, -1.5), point(3.2, -2.6, -1.25),
          gaze(-0.8, -0.15), gaze(0, 0.5),
          { fovFrom: 45, fovTo: 36, rollFrom: -0.12, rollTo: -0.045, shake: 0.055, ease: 'rush', seed: 9 }),
        shot(0.62, point(3.2, 2.5, -0.9), point(3.05, 1.3, 0.35),
          gaze(0.45, -0.4), gaze(0, 0.35),
          { fovFrom: 40, fovTo: 35, rollFrom: 0.075, rollTo: 0.02, shake: 0.04, ease: 'smooth', seed: 10 }),
        shot(timing.holds[0], point(7.6, -4.1, -1.45), point(6.1, 1.9, -1.15),
          gaze(-0.65, 1.25), gaze(0.3, 0.75),
          { fovFrom: 51, fovTo: 43, rollFrom: -0.065, rollTo: 0.025, shake: 0.025, ease: 'smooth', seed: 11 }),
        shot(timing.cutaway, point(2.8, 0.7, 0.05), point(2.5, -0.5, 0.2),
          gaze(0.25, 0), gaze(0, 0.1),
          { fovFrom: 35, fovTo: 31, rollFrom: 0.08, rollTo: -0.025, shake: 0.08, ease: 'rush', seed: 12 }),
        shot(timing.holds[1], point(4.8, 5.4, -1.15), point(11.2, 1.2, -1.35),
          gaze(0.75, 0.9), gaze(0, 0.8),
          { fovFrom: 40, fovTo: 57, rollFrom: 0.09, rollTo: 0, shake: 0.035, ease: 'smooth', seed: 13 }),
        shot(timing.settle, point(10.2, 0, -1.35), point(11.4, 0, -1.2),
          gaze(0, 0.8), gaze(0, 0.55),
          { fovFrom: 43, fovTo: 47, shake: 0.02, ease: 'creep', seed: 14 }),
      ];
    } else {
      // Feastkeeper: skim the drowned market floor, smash-cut between its laden
      // shoulders and glowing feast cavity, then back away beneath its full mass.
      shots = [
        shot(1.02, point(12, -6.2, -2.8), point(7.4, -1.8, -2.5),
          gaze(-0.5, 0.7), gaze(0, 1.1),
          { fovFrom: 75, fovTo: 56, rollFrom: -0.09, rollTo: -0.02, shake: 0.1, ease: 'rush', seed: 15 }),
        shot(0.7, point(3.7, 5.2, -0.8), point(3.05, 2.9, -1.25),
          gaze(1.05, 1.45), gaze(0.25, 0.8),
          { fovFrom: 46, fovTo: 37, rollFrom: 0.12, rollTo: 0.035, shake: 0.045, ease: 'rush', seed: 16 }),
        shot(0.63, point(2.85, -2.3, -0.3), point(2.55, -0.65, -0.45),
          gaze(-0.5, 0.1), gaze(0, 0.15),
          { fovFrom: 39, fovTo: 33, rollFrom: -0.075, rollTo: -0.015, shake: 0.065, ease: 'rush', seed: 17 }),
        shot(timing.holds[0], point(7.4, -3.2, -2.4), point(5.9, 1.3, -2.05),
          gaze(-0.55, 0.8), gaze(0.25, 0.65),
          { fovFrom: 50, fovTo: 43, rollFrom: -0.055, rollTo: 0.02, shake: 0.025, ease: 'smooth', seed: 18 }),
        shot(timing.cutaway, point(2.55, 1.1, -0.25), point(2.35, -0.35, -0.4),
          gaze(0.45, 0.1), gaze(0, 0.15),
          { fovFrom: 35, fovTo: 31, rollFrom: 0.08, rollTo: -0.025, shake: 0.085, ease: 'rush', seed: 19 }),
        shot(timing.holds[1], point(4.2, -5.1, -1.55), point(9.4, -1.2, -2.4),
          gaze(-0.8, 0.8), gaze(0, 0.6),
          { fovFrom: 40, fovTo: 57, rollFrom: -0.085, rollTo: 0, shake: 0.035, ease: 'smooth', seed: 20 }),
        shot(timing.settle, point(7.9, 0, -2.55), point(9, 0, -2.3),
          gaze(0, 0.75), gaze(0, 0.5),
          { fovFrom: 43, fovTo: 48, shake: 0.02, ease: 'creep', seed: 21 }),
      ];
    }

    let cursor = 0;
    for (const entry of shots) {
      entry.start = cursor;
      cursor += entry.duration;
      entry.end = cursor;
    }
    return shots;
  }

  update(dt) {
    if (!this.active) return;
    this._time += dt;
    this._sample(Math.min(this._time, this._total));
    if (this._time >= this._timing.nameAt) this.overlay.classList.add('show-name');
    const [firstAt, secondAt] = this._timing.dialogueAt;
    const index = this._time >= secondAt ? 1 : this._time >= firstAt ? 0 : -1;
    if (index !== this._dialogueIndex) {
      this._dialogueIndex = index;
      this.overlay.classList.toggle('show-dialogue', index >= 0);
      this.elDialogue.textContent = index >= 0 ? this._script.dialogue[index] : '';
    }
    if (this._time >= this._total) this._finish();
  }

  // Presenter skip: wind the timeline to its end so the next update() resolves
  // the play() promise through the normal _finish (camera restore + arena.begin
  // still run in _runGuardianIntroduction).
  skip() {
    if (this.active) this._time = Math.max(this._time, this._total);
  }

  _sample(time) {
    while (
      this._shotIndex < this._shots.length - 1 &&
      time >= this._shots[this._shotIndex].end
    ) {
      this._shotIndex++;
    }
    const shot = this._shots[this._shotIndex];
    const raw = clamp01((time - shot.start) / Math.max(0.001, shot.duration));
    const factor = shot.ease === 'rush' ? rush(raw) : shot.ease === 'creep' ? creep(raw) : smooth(raw);
    this._pos.lerpVectors(shot.from, shot.to, factor);
    this._look.lerpVectors(shot.lookFrom, shot.lookTo, factor);

    // Deterministic micro-shake keeps every cut authored and replayable. It is
    // strongest during rushes and detail inserts, then settles for dialogue.
    const shakeEnvelope = Math.sin(raw * Math.PI) * shot.shake;
    const pulse = time * 31 + shot.seed * 2.17;
    this.camera.position.copy(this._pos);
    this.camera.position.x += Math.sin(pulse) * shakeEnvelope;
    this.camera.position.y += Math.sin(pulse * 1.37) * shakeEnvelope * 0.55;
    this.camera.position.z += Math.cos(pulse * 0.83) * shakeEnvelope * 0.45;
    this.camera.lookAt(this._look);
    this.camera.rotateZ(
      THREE.MathUtils.lerp(shot.rollFrom, shot.rollTo, factor)
      + Math.sin(pulse * 0.71) * shakeEnvelope * 0.035,
    );
    const fov = THREE.MathUtils.lerp(shot.fovFrom, shot.fovTo, factor);
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  _finish() {
    if (!this.active) return;
    this.active = false;
    this.overlay.classList.remove('active', 'show-name', 'show-dialogue');
    const resolve = this._resolve;
    this._resolve = null;
    resolve?.();
  }

  resize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
