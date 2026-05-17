# Typhoon Tycoon

A lightweight 2.5D tower‑defense game built with **Three.js** that runs directly in the browser – no build step, bundler, or npm install required.

## How to play
- Open `games/typhoon-tycoon/index.html` in a modern browser (or view it via GitHub Pages).
- Click **Start Defense**.
- Move the placement cursor with **W/A/S/D** or the arrow keys.
- Place a tower by pressing **Space** or clicking on the ground.
- Towers automatically fire at incoming enemies (typhoons).
- Earn resources by destroying enemies, protect your base health, and survive wave after wave.

## Features
- Three.js scene rendered with a simple island, starfield background and a path.
- Wave system with increasing difficulty.
- Tower placement validation (no overlap, within arena, not too close to base).
- Basic HUD showing score, resources, health and wave.
- Game‑over and restart flow.

## Development
The game is deliberately simple and uses only a CDN import of Three.js:
```html
<script type="module" src="./main.js"></script>
```
All logic lives in `main.js`.

Feel free to fork and extend – add more tower types, upgrade mechanics, or improve graphics.
