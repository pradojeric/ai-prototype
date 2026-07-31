# STRINGS — Zone 1: PONSIA

A first-person interactive heritage experience set in the submerged city of **Dagupan, Pangasinan, Philippines**. Built with [Three.js](https://threejs.org/) and vanilla JavaScript ES modules, *Strings* is a slow, atmospheric walking simulator about cultural preservation, memory, and the invisible threads that connect us to the past.

> Made for **AI Game On!** — *"Giving Our History a New Heartbeat through the Intelligence of Tomorrow"*

## Gameplay

- Explore the market in first person.
- Move with **WASD**, look with the **mouse**.
- Walk up to artifacts and **hold to collect** them; discovered items reveal fragments of the city's history.

See [STRINGS_GDD.md](STRINGS_GDD.md) for the full game design document.

## Requirements

- A modern web browser with WebGL support (Chrome, Firefox, Edge, Safari).
- A local static web server. The game loads ES modules and assets, so it **cannot** be run by opening `index.html` directly from the file system (browsers block `file://` module imports).
- An internet connection on first load — Three.js is pulled from a CDN via an import map.

## How to Run

Clone the repository and serve the folder with any static HTTP server, then open the served URL.

### Option 1 — Python (no install needed on most systems)

```bash
git clone https://github.com/pradojeric/ai-prototype.git
cd ai-prototype
python3 -m http.server 8000
```

Then open <http://localhost:8000> in your browser.

### Option 2 — Node.js

```bash
npx serve .
# or
npx http-server -p 8000
```

Then open the URL printed in the terminal (e.g. <http://localhost:8000>).

### Option 3 — VS Code

Install the **Live Server** extension, then right-click `index.html` → **Open with Live Server**.

## Controls

| Action | Input |
|---|---|
| Move | `W` `A` `S` `D` |
| Look around | Mouse |
| Collect artifact | Hold (look at an artifact and hold) |
| Start / lock pointer | Click the canvas |

## Project Structure

```
.
├── index.html              # Entry point, import map, UI overlay & styles
├── src/
│   ├── main.js             # Boots the game
│   ├── config.js           # Tunable constants
│   ├── data.js             # Game data (artifacts, strings)
│   ├── core/
│   │   ├── Game.js         # Main game loop & orchestration
│   │   ├── World.js        # Scene / environment
│   │   ├── PlayerController.js
│   │   ├── StringSystem.js
│   │   ├── ArtifactManager.js
│   │   └── ViewModel.js
│   ├── ui/
│   │   └── DiscoveryScreen.js
│   └── audio/
│       └── AudioManager.js
├── STRINGS_GDD.md          # Game design document
├── implementation_plan.md
└── task.md
```

## Tech

- **Three.js 0.160.0** (loaded from unpkg via import map)
- Vanilla JavaScript (ES modules), HTML, CSS — no build step required

## GameOn Portal API

The browser-managed GameOn authorization flow is configured through
`PLATFORM_API` in `src/config.js`. Replace `YOUR_GAME_ID` with the platform-assigned
Game ID before deployment; while the placeholder remains, the account controls are
disabled and the game performs no platform popup or network work.

The client uses the guide's exact contract:

- `POST https://gameonportal.ph/api/session` with `{ "gameId": "<GAME_ID>" }`;
- open the returned `signinUrl` for platform-managed authorization;
- poll `GET https://gameonportal.ph/api/session` every three seconds with the
  returned Session Token as a bearer token;
- after a legitimate three-zone campaign begins its ending, send a bodyless
  `POST https://gameonportal.ph/api/artifacts/unlock` with the same bearer token.

Only the Session Token and a pending-reward flag use `sessionStorage`; account
credentials stay on GameOn Portal. Platform failures do not roll back local
campaign progress. Debug and presenter progression shortcuts cannot award the
platform artifact.

This static project does not include the guide's Next.js development proxy.
Externally hosted releases and localhost need GameOn Portal CORS support or a
separately configured proxy. Run the mocked contract tests with:

```bash
node --experimental-default-type=module --test \
  tests/APIManager.test.mjs tests/PlatformProgress.test.mjs
```

## Optional Ending Narration

Place the approximately 31-second recording at `assets/audio/ending-voiceover.mp3`, then set `ENDING.VOICEOVER_URL` in `src/config.js` to that path. The ending remains fully timed and uses bilingual subtitles when no recording is configured.
