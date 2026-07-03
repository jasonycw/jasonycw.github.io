# Star Salvager

**Star Salvager** is a lightweight standalone Three.js browser game designed for GitHub Pages.
You pilot a salvage interceptor in an asteroid drift lane, destroy rogue drones, and survive as long as possible.

## Play URL

After this repo is deployed with GitHub Pages, the game is playable at:

- `https://jasonycw.github.io/games/star-salvager/`

## How to Play

### Objective

- Destroy enemy drones to gain score.
- Stay alive as waves get harder.
- Each new wave restores a small amount of hull health.

### Controls

- **Move:** `W A S D` or Arrow Keys
- **Aim:** Mouse movement
- **Fire:** Left Mouse Click or `Space`
- **Boost:** Hold `Shift` (consumes and regenerates boost energy)

### Gameplay Notes

- Enemies spawn around the perimeter and charge your ship.
- If an enemy collides with your ship, you lose hull health.
- Destroying enemies grants points.
- Survive longer to reach higher waves and faster spawns.

## Technical Notes

- Built with plain HTML/CSS/JS and ES modules.
- Uses Three.js from CDN (`unpkg`) so no build step is required.
- Compatible with static hosting (GitHub Pages friendly).
