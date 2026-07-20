// ============================================================
// ARENA CONTROLLER (Strings v2.0) — orchestrates a Memory Arena encounter above
// the reused combat core. It keeps continuous enemy waves running (via
// CombatManager in endless mode) and, on a cadence, issues a "riddle round":
// the Feastkeeper's bugtong shows on a non-blocking HUD banner while three
// shootable AnswerNodes fan out in front of the player. Shooting the CORRECT
// node strips one of the guardian's armor layers; a WRONG node spawns a penalty
// wave. When the last armor layer breaks the guardian falls and `won` flips true
// — Game then collapses the arena and returns to the main zone.
//
// Game owns the scene swap, the player, and the light-bolt firing; this class
// owns armor, riddle pacing, the answer nodes, and the bolt-vs-node hit test.
// ============================================================
import * as THREE from 'three';
import { ARENA, COMBAT, LUMINA, mulberry32 } from '../../config.js';
import { drawRiddles } from '../../data.js';
import { AnswerNode } from './AnswerNode.js';
import { LuminaManager } from './LuminaManager.js';

export class ArenaController {
  constructor(scene, audio, player, seed = LUMINA.SEED) {
    this.scene = scene;
    this.audio = audio;
    this.player = player;
    this.seed = seed;
    this._attempt = 0;
    this.lumina = new LuminaManager(scene, player, audio);
    this._handleEnemyDefeated = (_type, position, dropMultiplier) => {
      this.lumina.tryDrop(position, dropMultiplier);
    };

    // Non-blocking bugtong banner (declared in index.html; styled like #ghint).
    this.elBanner = document.getElementById('arena-riddle');
    this.elStep = document.getElementById('ar-step');
    this.elFil = document.getElementById('ar-fil');
    this.elEng = document.getElementById('ar-eng');
    this.elHint = document.getElementById('ar-hint');
    this.elWards = document.getElementById('guardian-wards');

    this.combat = null;
    this.guardian = null;
    this.armor = ARENA.ROUNDS;
    this.won = false;

    this._riddles = [];        // pre-drawn, one per round
    this._roundActive = false;
    this._nodes = [];
    this._pendingChoices = null;  // choices waiting out the reveal delay
    this._nodeDelay = 0;          // countdown before the choices spawn
    this._timer = 0;           // counts up toward the next round
    this._v = new THREE.Vector3();
  }

  // Begin the encounter. `combat` is a fresh CombatManager on the arena scene;
  // `guardian` is the arena's Feastkeeper (kept invincible until armor is gone).
  begin(combat, guardian) {
    this._clearRound();        // clear any leftover round (e.g. a mid-fight death)
    if (this.combat && this.combat !== combat) this.combat.setEnemyDefeatedHandler(null);
    this.combat = combat;
    this.guardian = guardian;
    this.armor = ARENA.ROUNDS;
    this.won = false;
    this._roundActive = false;
    this._timer = 0;
    if (this.elHint) this.elHint.textContent = "Shoot the correct answer to break the Feastkeeper's armor.";
    if (this.elWards) this.elWards.classList.remove('active');

    // Draw one distinct riddle per armor layer (extra +2 as spares in case a
    // round needs re-issuing; only ROUNDS are used in the happy path).
    const rng = mulberry32((Date.now() & 0xffff) ^ 0x21e5);
    this._riddles = drawRiddles(ARENA.ROUNDS + 2, rng);

    this._attempt++;
    const luminaSeed = (this.seed ^ LUMINA.SEED ^ Math.imul(this._attempt, 0x9e3779b1)) >>> 0;
    this.lumina.beginAttempt(this.combat, luminaSeed);
    this.combat.setEnemyDefeatedHandler(this._handleEnemyDefeated);

    // Endless waves centered on the arena, no leash (the player is walled in).
    this._v.set(ARENA.CENTER.x, 0, ARENA.CENTER.z);
    this.combat.startFight(this._v, { endless: true });
  }

  update(dt, t, playerPos) {
    // Always advance + reap node visuals — even after a correct answer ends the
    // round — so the break/fade animation finishes and the meshes are disposed
    // instead of lingering frozen in the arena.
    for (let i = this._nodes.length - 1; i >= 0; i--) {
      const n = this._nodes[i];
      n.update(dt, t);
      if (n.dead) { n.dispose(); this._nodes.splice(i, 1); }
    }

    if (!this.won) {
      if (this._roundActive) {
        this._updateRound(dt, t);
      } else {
        // Pace the next riddle: a longer lead-in before the first, shorter after.
        this._timer += dt;
        const due = this.armor === ARENA.ROUNDS ? ARENA.RIDDLE_FIRST : ARENA.RIDDLE_CADENCE;
        if (this._timer >= due) this._startRound();
      }
    }

    // Hit priority is enemy -> answer node -> Lumina. Critical riddle progress
    // therefore cannot be swallowed by a reward orb occupying the same line.
    this.lumina.update(dt, t, playerPos, !this.player.controls.isLocked);
  }

  _startRound() {
    const idx = ARENA.ROUNDS - this.armor;      // 0-based round number
    const riddle = this._riddles[idx] || this._riddles[this._riddles.length - 1];
    this._current = riddle;
    this._roundActive = true;
    this._timer = 0;

    // Banner: bugtong text (fil prompt + english gloss) + which armor this breaks.
    this.elStep.textContent = `Bugtong ${idx + 1} / ${ARENA.ROUNDS} — sirain ang baluti`;
    this.elFil.textContent = riddle.prompt;
    this.elEng.textContent = riddle.promptEng || '';
    this.elBanner.classList.add('active');

    // Hold the choices back for a beat so the player can read the riddle first —
    // the nodes spawn once _nodeDelay elapses (see _updateRound). Shuffle which
    // choice sits where so the correct one isn't always the middle node.
    const choices = riddle.choices.slice();
    for (let i = choices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [choices[i], choices[j]] = [choices[j], choices[i]];
    }
    this._pendingChoices = choices;
    this._nodeDelay = ARENA.NODE_DELAY;
  }

  // Spawn the three answer nodes fanned in front of the arena center (-Z).
  _spawnNodes() {
    const choices = this._pendingChoices;
    this._pendingChoices = null;
    const offsets = [-ARENA.NODE_ANGLE, 0, ARENA.NODE_ANGLE];
    choices.forEach((choice, i) => {
      const a = offsets[i] ?? 0;
      const pos = new THREE.Vector3(
        ARENA.CENTER.x + Math.sin(a) * ARENA.NODE_DIST,
        ARENA.NODE_HEIGHT,
        ARENA.CENTER.z - Math.cos(a) * ARENA.NODE_DIST,   // forward = -Z
      );
      this._nodes.push(new AnswerNode(this.scene, choice, pos));
    });
  }

  _updateRound(dt, t) {
    // Reveal delay: spawn the choices only after the player has had a beat to
    // read the riddle.
    if (this._pendingChoices) {
      this._nodeDelay -= dt;
      if (this._nodeDelay <= 0) this._spawnNodes();
      return;                       // nothing to shoot yet
    }

    // Test the player's live light-bolts against the un-broken nodes.
    if (this.combat && this.combat.bolts) {
      for (const s of this.combat.bolts.slots) {
        if (!s.active) continue;
        for (const n of this._nodes) {
          if (n.broken) continue;
          if (!n.hitTest(s.mesh.position, COMBAT.BOLT.RADIUS)) continue;
          this.combat.bolts.deactivate(s);
          this._answer(n);
          break;
        }
      }
    }
  }

  // Resolve a shot node: correct strips armor (and may win); wrong penalizes.
  _answer(node) {
    if (node.correct) {
      node.break();
      for (const n of this._nodes) if (!n.broken) n.break();   // shatter the whole round
      this._pendingChoices = null;   // (belt & suspenders — all nodes are already spawned here)
      this._nodeDelay = 0;
      this._roundActive = false;
      this._timer = 0;
      this.elBanner.classList.remove('active');
      this.armor = Math.max(0, this.armor - 1);
      this.audio.playWaveClear();
      if (this.armor <= 0) this._win();
    } else {
      node.break();
      this.audio.playPlayerHurt();
      if (this.combat) {
        this.combat.spawnExtra(ARENA.PENALTY_CHASERS, 0, {
          dropMultiplier: LUMINA.PENALTY_DROP_MULT,
        });
      }
    }
  }

  _win() {
    this.won = true;
    this.elBanner.classList.remove('active');
    for (const n of this._nodes) n.break();
    this.resetLumina();
    if (this.combat) this.combat.stop();
    if (this.guardian) this.guardian.defeat();   // implode poof at the guardian's spot
  }

  // World-space center of the fallen guardian (Game bursts artifacts from here on
  // return). Falls back to the arena center if the guardian is gone.
  guardianCenter() {
    if (this.guardian) return this.guardian.center().clone();
    return new THREE.Vector3(ARENA.CENTER.x, 0, ARENA.CENTER.z);
  }

  resetLumina() { this.lumina.reset(); }

  _clearRound() {
    for (const n of this._nodes) n.dispose();
    this._nodes.length = 0;
    this._roundActive = false;
    this._pendingChoices = null;
    this._nodeDelay = 0;
    this.elBanner.classList.remove('active');
  }

  dispose() {
    this._clearRound();
    if (this.combat) this.combat.setEnemyDefeatedHandler(null);
    this.lumina.dispose();
    this.combat = null;
    this.guardian = null;
  }
}
