// ============================================================
// RIDDLE SCREEN — multiple-choice "bugtong" overlay shown during the guardian
// encounter. Mirrors DiscoveryScreen's Promise + `.active` toggle pattern.
// ============================================================
import { wait } from '../config.js';
import { GUARDIAN_TEXT } from '../data.js';

export class RiddleScreen {
  constructor() {
    this.panel = document.getElementById('riddle');
    this.elFil = document.getElementById('r-fil');
    this.elEng = document.getElementById('r-eng');
    this.elPrompt = document.getElementById('r-prompt');
    this.elPromptEng = document.getElementById('r-prompt-eng');
    this.elStep = document.getElementById('r-step');
    this.elAnswers = document.getElementById('r-answers');
    this.active = false;
    this._resolve = null;
    this._locked = false;   // ignore further clicks after the first answer
  }

  // Show one riddle. `step`/`total` drive the "Riddle 1 / 3" label.
  // Resolves true (correct) or false (wrong) after the feedback beat.
  async show(riddle, step, total) {
    this.active = true;
    this._locked = false;

    this.elFil.textContent = GUARDIAN_TEXT.fil;
    this.elEng.textContent = GUARDIAN_TEXT.eng;
    this.elStep.textContent = `Bugtong ${step} / ${total}`;
    this.elPrompt.textContent = riddle.prompt;
    this.elPromptEng.textContent = riddle.promptEng || '';

    // Rebuild the answer buttons for this riddle.
    this.elAnswers.replaceChildren();
    riddle.choices.forEach((choice) => {
      const btn = document.createElement('button');
      btn.className = 'answer';
      btn.type = 'button';
      btn.textContent = choice.text;
      btn.addEventListener('click', () => this._pick(btn, choice.correct));
      this.elAnswers.appendChild(btn);
    });

    this.panel.classList.add('active');

    return new Promise((res) => { this._resolve = res; });
  }

  async _pick(btn, correct) {
    if (this._locked) return;
    this._locked = true;
    btn.classList.add(correct ? 'correct' : 'wrong');
    // Reveal the right answer on a miss so the player learns the bugtong.
    if (!correct) {
      for (const b of this.elAnswers.children) {
        if (b !== btn) b.classList.add('dim');
      }
    }
    await wait(900);            // hold the feedback so the choice registers
    this.panel.classList.remove('active');
    await wait(450);            // fade the card out
    this.active = false;
    this._resolve && this._resolve(correct);
  }
}
