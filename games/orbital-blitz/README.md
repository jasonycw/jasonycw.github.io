# Orbital Blitz

**Orbital Blitz** is a fast top-down survival shooter built with standalone Three.js modules (no bundling step needed). You are a small defense craft protecting a station ring while hostile drones rush in from all directions.

## Play URL

After merge and GitHub Pages deployment, open:

`https://jasonycw.github.io/games/orbital-blitz/`

## Controls

- **Move:** `W A S D` or Arrow Keys
- **Aim:** Mouse pointer
- **Shoot:** Left Click or `Space`
- **Start/Restart:** `Start Game` / `Restart` button in HUD panel

## Objective

- Destroy incoming drones to earn score.
- Each enemy that reaches your ship deals **10 damage**.
- You start with **100 health**.
- Survive as long as possible and set a high score.

## Technical notes

- Uses CDN import: `three@0.164.1` as ES module.
- Files are plain static assets (`index.html`, `style.css`, `game.js`) and are playable directly via GitHub Pages.
- No build pipeline required.
