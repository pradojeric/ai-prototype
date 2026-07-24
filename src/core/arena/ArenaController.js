// ============================================================
// ARENA CONTROLLER (Strings v2.0) — orchestrates a Memory Arena encounter above
// the reused combat core. The encounter is a fixed ARENA.TOTAL_WAVES run; each
// of the ARENA.RIDDLE_WAVES milestones opens a "riddle round" on clear, which
// HOLDS the wave clock while the Feastkeeper's bugtong shows on a non-blocking
// banner and three shootable AnswerNodes fan out in front of the player.
//
// Shooting the CORRECT node strips one armor layer and resumes the waves. A
// WRONG node locks the round out: the remaining nodes go inert and a penalty
// squad spawns, and only when that squad is dead do the nodes relight for
// another attempt at the same riddle. Breaking the last armor layer opens the
// boss phase (FeastkeeperBoss) — killing the boss flips `won` and Game collapses
// the arena back to the main zone.
//
// Game owns the scene swap, the player, and the light-bolt firing; this class
// owns the phase state machine, armor, the answer nodes, and the boss handoff.
// ============================================================
import * as THREE from 'three';
import { ARENA, COMBAT, LUMINA, mulberry32 } from '../../config.js';
import { drawRiddles } from '../../data.js';
import { AnswerNode } from './AnswerNode.js';
import { FeastkeeperBoss } from './FeastkeeperBoss.js';
import { LuminaManager } from './LuminaManager.js';

const LOCKOUT_HINT = 'The feast answers first — clear the echoes before you choose again.';
const RIDDLE_HINT = "Shoot the correct answer to break the Feastkeeper's armor.";

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

    // Non-blocking bugtong banner declared in index.html.
    this.elBanner = document.getElementById('arena-riddle');
    this.elStep = document.getElementById('ar-step');
    this.elFil = document.getElementById('ar-fil');
    this.elEng = document.getElementById('ar-eng');
    this.elHint = document.getElementById('ar-hint');
    // The armor row itself lives on the combat HUD (CombatHud.setWards).

    this.combat = null;
    this.guardian = null;
    this.armor = ARENA.ROUNDS;
    this.won = false;
    this.boss = null;

    this._riddles = [];        // pre-drawn, one per round
    // 'waves'  — surviving the wave run, no riddle open
    // 'riddle' — a bugtong is up and its nodes are answerable
    // 'locked' — a wrong answer is being paid off; nodes inert until adds die
    // 'boss-intro' — final shield shatter; the cleared arena holds for one beat
    // 'boss'   — armor gone, FeastkeeperBoss owns the fight
    // 'won'    — boss down, Game is collapsing the arena
    this._phase = 'waves';
    this._nodes = [];
    this._pendingChoices = null;  // choices waiting out the reveal delay
    this._nodeDelay = 0;          // countdown before the choices spawn
    this._bossIntroTimer = 0;
    this._v = new THREE.Vector3();
  }

  // Begin the encounter. `combat` is a fresh CombatManager on the arena scene;
  // `guardian` is the arena's Feastkeeper (kept invincible until armor is gone).
  begin(combat, guardian) {
    combat.resetAlab();
    this._clearRound();        // clear any leftover round (e.g. a mid-fight death)
    if (this.combat && this.combat !== combat) this.combat.setEnemyDefeatedHandler(null);
    this.combat = combat;
    this.guardian = guardian;
    this.armor = ARENA.ROUNDS;
    this.won = false;
    this._phase = 'waves';
    this._bossIntroTimer = 0;
    if (this.elHint) this.elHint.textContent = RIDDLE_HINT;

    // Draw one distinct riddle per armor layer (extra +2 as spares in case a
    // round needs re-issuing; only ROUNDS are used in the happy path).
    const rng = mulberry32((Date.now() & 0xffff) ^ 0x21e5);
    this._riddles = drawRiddles(ARENA.ROUNDS + 2, rng);

    this._beginAttempt();

    // A fixed-length wave run, no leash (the player is walled in). Riddle rounds
    // hang off the wave-cleared callback rather than a wall clock.
    this._v.set(ARENA.CENTER.x, 0, ARENA.CENTER.z);
    this.combat.startFight(this._v, {
      totalWaves: ARENA.TOTAL_WAVES,
      onWaveCleared: (wave) => this._onWaveCleared(wave),
    });
    this.combat.hud.setBossWaves(false);
    this._showBoss();
  }

  // Skip the wave run and drop straight into the boss phase. Used when the
  // player faints mid-boss: they already earned the armor breaks, so replaying
  // ten waves to reach the same fight would be pure repetition.
  restartAfterFaint(combat, guardian) {
    if (this._phase !== 'boss' && this._phase !== 'boss-intro' && this._phase !== 'won') {
      this.begin(combat, guardian);
      return;
    }
    this._clearRound();
    if (this.combat && this.combat !== combat) this.combat.setEnemyDefeatedHandler(null);
    this.combat = combat;
    this.guardian = guardian;
    this.armor = 0;
    this.won = false;
    this._beginAttempt();

    // `held` so no wave spawns just to be poofed a frame later by the handoff.
    this._v.set(ARENA.CENTER.x, 0, ARENA.CENTER.z);
    this.combat.startFight(this._v, { totalWaves: ARENA.TOTAL_WAVES, held: true });
    this._beginBossPhase();
  }

  // Per-attempt reward stream, kill routing, and a fresh boss, shared by both
  // entry points. The boss exists from the first wave so the guardian can flare
  // its armor at early shots; it only starts acting when `begin()` is called.
  _beginAttempt() {
    this._disposeBoss();
    this.boss = new FeastkeeperBoss(this.guardian, this.combat, this.audio, this.player);
    this._attempt++;
    const luminaSeed = (this.seed ^ LUMINA.SEED ^ Math.imul(this._attempt, 0x9e3779b1)) >>> 0;
    this.lumina.beginAttempt(this.combat, luminaSeed);
    this.combat.setEnemyDefeatedHandler(this._handleEnemyDefeated);
  }

  // Surface the win condition on the top-of-screen boss frame: one pip per armor
  // layer still standing, plus the boss health track once it can be damaged.
  _showBoss() {
    const name = this.combat?.world?.zone?.guardianName?.eng || 'The Guardian';
    // The health track only appears once the boss can actually be damaged; while
    // armor holds, the pips alone are the honest readout of progress.
    const engaged = this._phase === 'boss' && this.boss;
    this.combat?.hud.setBoss({
      name,
      hp: engaged ? this.boss.hp : null,
      maxHp: engaged ? this.boss.maxHp : null,
      armor: this.armor,
      armorTotal: ARENA.ROUNDS,
    });
  }

  // Clearing a milestone wave opens that wave's bugtong and stops the wave clock
  // — the player answers under the pressure already on the field, not a new one.
  _onWaveCleared(wave) {
    if (this._phase !== 'waves') return;
    if (!ARENA.RIDDLE_WAVES.includes(wave)) return;
    this.combat.holdWaves(true);
    this._startRound(wave);
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
      if (this._phase === 'riddle') this._updateRound(dt);
      else if (this._phase === 'locked') this._updateLockout();
      else if (this._phase === 'boss-intro') this._updateBossIntro(dt);
      else if (this._phase === 'boss') this._updateBoss(dt, playerPos);
      if (this._phase !== 'boss' && this._phase !== 'won') {
        this.boss?.testArmoredHits(dt);
      }
    }

    // Hit priority is enemy -> answer node -> Lumina. Critical riddle progress
    // therefore cannot be swallowed by a reward orb occupying the same line.
    this.lumina.update(dt, t, playerPos, !this.player.controls.isLocked);
  }

  _startRound(wave) {
    const idx = ARENA.ROUNDS - this.armor;      // 0-based round number
    const riddle = this._riddles[idx] || this._riddles[this._riddles.length - 1];
    this._current = riddle;
    this._phase = 'riddle';
    if (this.elHint) this.elHint.textContent = RIDDLE_HINT;

    // Banner: bugtong text (fil prompt + english gloss) + which armor this breaks.
    this.elStep.textContent =
      `Bugtong ${idx + 1} / ${ARENA.ROUNDS} — Alon ${wave} — sirain ang baluti`;
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
        ARENA.CENTER.z - Math.cos(a) * ARENA.NODE_DIST + ARENA.NODE_FORWARD_OFFSET,
      );
      this._nodes.push(new AnswerNode(this.scene, choice, pos));
    });
  }

  _updateRound(dt) {
    // Reveal delay: spawn the choices only after the player has had a beat to
    // read the riddle.
    if (this._pendingChoices) {
      this._nodeDelay -= dt;
      if (this._nodeDelay <= 0) this._spawnNodes();
      return;                       // nothing to shoot yet
    }

    // Test the player's live light-bolts against the answerable nodes. Nodes
    // locked out by a wrong answer refuse the hit themselves (AnswerNode.inert).
    if (this.combat && this.combat.bolts) {
      for (const s of this.combat.bolts.slots) {
        if (!s.active) continue;
        for (const n of this._nodes) {
          if (!n.hitTest(s.mesh.position, COMBAT.BOLT.RADIUS)) continue;
          this.combat.bolts.deactivate(s);
          this._answer(n);
          break;
        }
      }
    }
  }

  // Lockout: the surviving choices stay inert until the penalty squad is dead,
  // so a wrong answer costs a fight instead of being a free second guess.
  _updateLockout() {
    if (!this.combat || this.combat.aliveCount() > 0) return;
    for (const n of this._nodes) n.setInert(false);
    if (this.elHint) this.elHint.textContent = RIDDLE_HINT;
    this._phase = 'riddle';
  }

  // Resolve a shot node: correct strips armor (and may open the boss); wrong
  // locks the round behind a penalty squad.
  _answer(node) {
    if (node.correct) {
      node.break();
      for (const n of this._nodes) if (!n.broken) n.break();   // shatter the whole round
      this._pendingChoices = null;   // (belt & suspenders — all nodes are already spawned here)
      this._nodeDelay = 0;
      this.elBanner.classList.remove('active');
      this.armor = Math.max(0, this.armor - 1);
      this.boss?.breakArmor(this.armor);
      this._showBoss();
      if (this.armor <= 0) {
        this._startBossIntro();
      } else {
        this.audio.playWaveClear();
        this._phase = 'waves';
        this.combat?.holdWaves(false);   // the wave run resumes where it paused
      }
    } else {
      node.break();
      this.audio.playPlayerHurt();
      for (const n of this._nodes) if (!n.broken) n.setInert(true);
      this._phase = 'locked';
      if (this.elHint) this.elHint.textContent = LOCKOUT_HINT;
      this.combat?.spawnExtra(ARENA.PENALTY_CHASERS, ARENA.PENALTY_SPITTERS, {
        dropMultiplier: LUMINA.PENALTY_DROP_MULT,
      });
    }
  }

  // The last answer earns a threat-free shatter beat. This keeps the final
  // crack, armor-break sound, and boss activation from stacking in one frame.
  _startBossIntro() {
    this._phase = 'boss-intro';
    this._bossIntroTimer = 0.85;
    this.elBanner.classList.remove('active');
    if (this.combat) {
      this.combat.holdWaves(true);
      this.combat.clearEnemies();
      this.combat.spits.clear();
      this.combat.hud.setBossWaves(true);
    }
  }

  _updateBossIntro(dt) {
    if (!this.player.controls.isLocked) return;
    this._bossIntroTimer = Math.max(0, this._bossIntroTimer - dt);
    if (this._bossIntroTimer <= 0) this._beginBossPhase();
  }

  // Armor gone: the wave run is over and the Feastkeeper itself becomes the
  // fight. From here every echo on the field is one the boss summoned.
  _beginBossPhase() {
    this._phase = 'boss';
    this.elBanner.classList.remove('active');
    this.combat?.bolts.clear();
    this.boss?.begin();
    this._showBoss();
  }

  _updateBoss(dt, playerPos) {
    if (!this.boss) return;
    const before = this.boss.hp;
    this.boss.update(dt, playerPos);
    if (this.boss.hp !== before) this._showBoss();
    if (this.boss.defeated) this._win();
  }

  _disposeBoss() {
    if (!this.boss) return;
    this.boss.dispose();
    this.boss = null;
  }

  _win() {
    this._phase = 'won';
    this.won = true;
    this.elBanner.classList.remove('active');
    for (const n of this._nodes) n.break();
    this.resetLumina();
    if (this.combat) this.combat.stop({ preserveVfx: true });
    if (this.guardian) this.guardian.defeat();   // implode poof at the guardian's spot
  }

  // World-space center of the fallen guardian (Game bursts artifacts from here on
  // return). Falls back to the arena center if the guardian is gone.
  guardianCenter() {
    if (this.guardian) return this.guardian.center().clone();
    return new THREE.Vector3(ARENA.CENTER.x, 0, ARENA.CENTER.z);
  }

  collidesPlayerAt(x, z, radius) {
    return !!this.boss?.shieldVfx?.blocksPlayerAt(x, z, radius);
  }

  resetLumina() { this.lumina.reset(); }

  _clearRound() {
    for (const n of this._nodes) n.dispose();
    this._nodes.length = 0;
    this._pendingChoices = null;
    this._nodeDelay = 0;
    this.elBanner.classList.remove('active');
  }

  dispose() {
    this._clearRound();
    this._disposeBoss();
    if (this.combat) this.combat.setEnemyDefeatedHandler(null);
    this.lumina.dispose();
    this.combat = null;
    this.guardian = null;
  }
}
