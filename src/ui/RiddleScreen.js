// ============================================================
// RIDDLE SCREEN — multiple-choice "bugtong" overlay shown during the guardian
// encounter. Mirrors DiscoveryScreen's Promise + `.active` toggle pattern.
//
// Two answering modes share this one card:
//   • click a choice (default) — used when the pointer is free;
//   • press 1 / 2 / 3 (`options.keys`) — used by Arena 3's seal consoles, where
//     the tower simulation keeps running and the pointer must stay locked so the
//     player can still move and shoot while reading.
// ============================================================
import { wait } from '../config.js';
import { GUARDIAN_TEXT } from '../data.js';

const DIGIT_CODES = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];
const NUMPAD_CODES = ['Numpad1', 'Numpad2', 'Numpad3', 'Numpad4'];

export class RiddleScreen {
  constructor(waitFor = wait) {
    this._wait = waitFor;
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
    this._onKeyDown = null;
    this._options = {};
  }

  // Show one riddle. `step`/`total` drive the "Riddle 1 / 3" label; `name` is
  // the zone's guardian name ({ fil, eng }), falling back to the generic text.
  // `options` is opt-in and leaves the original behaviour untouched when absent:
  //   keys         — number-key selection plus a badge on each button
  //   retryOnWrong — keep the card up after a miss so the player picks again;
  //                  the promise then resolves only on a correct answer
  //   onWrong      — called for each miss (Arena 3 surges the tide with it)
  // Resolves true (correct) or false (wrong, or dismissed) after the feedback beat.
  async show(riddle, step, total, name, options = {}) {
    this.active = true;
    this._locked = false;
    this._options = options;

    this.elFil.textContent = name?.fil || GUARDIAN_TEXT.fil;
    this.elEng.textContent = name?.eng || GUARDIAN_TEXT.eng;
    this.elStep.textContent = `Bugtong ${step} / ${total}`;
    this.elPrompt.textContent = riddle.prompt;
    this.elPromptEng.textContent = riddle.promptEng || '';

    // Rebuild the answer buttons for this riddle.
    this.elAnswers.replaceChildren();
    this._buttons = riddle.choices.map((choice, index) => {
      const btn = document.createElement('button');
      btn.className = 'answer';
      btn.type = 'button';
      if (options.keys) {
        const key = document.createElement('span');
        key.className = 'key';
        key.textContent = String(index + 1);
        btn.append(key, document.createTextNode(choice.text));
      } else {
        btn.textContent = choice.text;
      }
      btn.addEventListener('click', () => this._pick(btn, choice.correct));
      this.elAnswers.appendChild(btn);
      return { btn, correct: !!choice.correct };
    });

    if (options.keys) {
      this._onKeyDown = (event) => {
        const index = DIGIT_CODES.indexOf(event.code) >= 0
          ? DIGIT_CODES.indexOf(event.code)
          : NUMPAD_CODES.indexOf(event.code);
        const entry = index >= 0 ? this._buttons[index] : null;
        if (!entry) return;
        event.preventDefault();
        this._pick(entry.btn, entry.correct);
      };
      document.addEventListener('keydown', this._onKeyDown);
    }

    // GamePause reads this class: a key-driven card still needs the pointer
    // locked on resume, whereas a click-driven one wants the cursor free.
    this.panel.classList.toggle('keys', !!options.keys);
    this.panel.classList.add('active');

    return new Promise((res) => { this._resolve = res; });
  }

  // Tear the card down without an answer (a mid-riddle death or arena reset).
  dismiss() {
    if (!this.active) return;
    this._finish(false);
  }

  async _pick(btn, correct) {
    if (this._locked || !this.active) return;
    // A struck-out choice stays on screen in retry mode; ignore repeat presses.
    if (btn.classList.contains('wrong')) return;
    this._locked = true;

    if (!correct && this._options.retryOnWrong) {
      btn.classList.add('wrong');
      btn.disabled = true;
      this._options.onWrong?.();
      await this._wait(450);          // brief flash, then hand the choice back
      if (!this.active) return;       // dismissed while the flash was playing
      this._locked = false;
      return;
    }

    btn.classList.add(correct ? 'correct' : 'wrong');
    // Reveal the right answer on a miss so the player learns the bugtong.
    if (!correct) {
      for (const b of this.elAnswers.children) {
        if (b !== btn) b.classList.add('dim');
      }
    }
    await this._wait(900);      // hold the feedback so the choice registers
    if (!this.active) return;
    this.panel.classList.remove('active');
    await this._wait(450);      // fade the card out
    this._finish(correct);
  }

  _finish(result) {
    this.panel.classList.remove('active');
    if (this._onKeyDown) {
      document.removeEventListener('keydown', this._onKeyDown);
      this._onKeyDown = null;
    }
    this.active = false;
    this._locked = false;
    const resolve = this._resolve;
    this._resolve = null;
    resolve && resolve(result);
  }
}
