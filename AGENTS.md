# Repository Guidelines

## Project Structure & Module Organization

*Strings* is a browser-based Three.js game written as vanilla JavaScript ES modules. `index.html` defines the import map, styles, and DOM overlays; `src/main.js` boots the game.

- `src/core/` contains game orchestration, world generation, player control, artifacts, zones, and guardians.
- `src/ui/`, `src/audio/`, `src/cutscene/`, and `src/museum/` contain focused subsystems.
- `src/data/` and `src/data.js` hold riddles and cultural artifact content.
- `assets/` contains shipped images and audio; `reference/` contains source/reference imagery.
- `STRINGS_GDD.md` and `GAME_LOOP.md` document design and architecture.

Keep new modules close to their owning subsystem. Register new zones or guardian variants through the corresponding `index.js` file.

## Build, Test, and Development Commands

There is no package manager, bundler, or build step. Serve the repository over HTTP because ES modules cannot run directly through `file://`:

```bash
python3 -m http.server 8000
# alternative: npx serve .
```

Open `http://localhost:8000`. The first load requires internet access because Three.js 0.160.0 is imported from unpkg.

No automated test or lint command is configured. Before submitting, check the browser console for module, asset, and runtime errors.

## Coding Style & Naming Conventions

Use ES modules, two-space indentation, single quotes, semicolons, and trailing commas in multiline objects. Use `PascalCase` for classes/files, `camelCase` for functions and variables, and uppercase names for exported configuration blocks. Prefix internal helpers with `_` where surrounding code does so.

Place shared tunables in `src/config.js` instead of scattering magic numbers. Avoid allocations in per-frame paths; reuse cached vectors and other scratch objects. Preserve Filipino/Pangasinan spelling, diacritics, and cultural meaning in content.

## Testing Guidelines

Perform a browser smoke test for every affected flow: movement, artifact collection, guardian riddles, portals, cutscenes, audio, and overlays as relevant. Test with DevTools open and hard-refresh after asset or import-map changes. Future automated tests should live under `tests/` as `*.test.js`.

## Commit & Pull Request Guidelines

Recent history favors short, imperative subjects, often using Conventional Commit prefixes (for example, `feat: add guardian teleport sound`). Use `feat:`, `fix:`, `docs:`, or `refactor:` when applicable and keep each commit focused.

Pull requests should explain the player-visible effect, list manual test steps, and link related issues or GDD sections. Include screenshots or a short capture for visual, UI, cutscene, or shader changes, and call out new CDN dependencies or large assets.
