# STRINGS — Zone 1: Pantal Market (Prototype)

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
