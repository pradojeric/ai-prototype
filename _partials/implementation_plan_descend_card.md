# Implementation plan — Descend title card

Replace the click-gated Descend screen (`#start`) with a ~2 second title card in
the language of the Survival mode card: kicker, zone name, quote, on black.

## Decisions (confirmed with the user)

| Question | Answer |
| --- | --- |
| Pointer lock | Keep it, on every path. The hub → zone descend never releases lock. The two paths that held none now claim it from their **own originating gesture** — `controls.lock()` inside the Awaken button handler (held through the whole cutscene, which draws its own camera so the mouse-look is invisible) and inside the Restart button handler (still inside the activation window, since `_restartZone` → `_loadZone` is synchronous). No entry asks for a click. |
| Lock refused | The click prompt survives purely as a safety net: after the card's hold, if lock is still not held, re-request it, wait `LOCK_GRACE`, and only then reveal "Click to Descend" rather than strand the player in a zone they cannot look around in. |
| Content | Kicker + zone label + quote. The `STRINGS` wordmark and the controls strip are dropped (controls live in the pause menu's Ledger tab). |
| Skippable | No. The card swallows all input for its whole timed life. |
| Movement | Fully cinematic: the player is pinned to the dock **and** mouse-look is suppressed for the card's two seconds. |
| Scope | Hub portal → zone, first descend after the intro cutscene, Restart-this-memory. **Not** the arena return, which never surfaced the Descend screen. |

## Steps

1. **`src/config.js`** — add a `DESCEND_CARD` block (`FADE_IN` .45 / `HOLD` 1.1 /
   `FADE_OUT` .45 = 2.0s total), mirroring how `SURVIVAL_TITLE` is shaped.
2. **`index.html`** — replace the `#start` overlay with `#descend-card`
   (`descend-card-kicker`, `descend-card-name`, `descend-card-quote`, plus the
   click prompt and the corner settings gear), and link the new stylesheet.
3. **`_partials/descend-card.css`** — card styling; every duration reads
   `--descend-card-fade`, which the driver sets per phase so the CSS transitions
   and the JS timers cannot drift apart (the `survival-title.css` contract).
4. **`src/ui/_partials/descendCard.js`** — `DescendCard`, a DOM-only driver (no
   `three`, no config import) so it is testable under `node --test`. Timing is
   injected. `play()` fades in, holds, and resolves with the card STILL UP, so
   the caller can check lock state at exactly the right moment and choose
   `dismiss()` (fade out) or `holdForClick()` (safety-net prompt).
5. **`src/core/PlayerController.js`** — `setLookSpeed` / `setLookEnabled`. Both
   write `controls.pointerSpeed`, which is also the settings slider's dial, so
   they share one owner: disabling look cannot lose a slider drag, and
   re-enabling it cannot resurrect a stale sensitivity.
6. **`src/core/Game.js`** — `_showDescend()` becomes async: `_freezeForDescend`,
   play the card, resolve lock, then start gameplay + the zone intro itself.
   Drop the `pause.releasePointerLock()` at the end of `_loadZone`. `_runIntro`
   re-spawns at the dock before the card, because WASD and the mouse were live
   (and invisible) behind the cutscene camera.
7. **`src/core/_partials/GameUI.js`** — construct the card, move the old
   `elStart` click handler onto it, and make the pointer-lock listener no-op
   while the card is mid-play so the card stays the single owner of the
   descend → playing transition.
8. **`tests/DescendCard.test.js`** — ordering, input swallowing, both exits.

## Why the card owns the transition

Today `_startGameplayPhase()` + `_playZoneIntro()` are triggered by the
pointer-lock event, because the descend click was the only way in. With lock now
retained, no lock event fires on the hub path — so the card's completion has to
call them. The lock listener still serves the safety-net click path, and guards
on `Game._descendOwned` so a late lock grant — or a mid-card pause and resume —
cannot start the zone a second time and double the intro dialogue.

## The anchor trap

`setMovementLocked(true)` with no anchor keeps whatever `movementAnchor` a rail
encounter last wrote, and `PlayerController.update` copies that into the player
every frame — so freezing for the card without passing the dock position
teleports the player into the middle of the zone. `_freezeForDescend` always
passes the current position.
