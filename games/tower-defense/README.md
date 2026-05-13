# Tower Defense

**Tower Defense** is a lightweight standalone Three.js browser game designed for GitHub Pages.
You are a commander defending a floating island from waves of enemy drones. Place turrets, manage resources, and survive as long as possible.

## Play URL

After this repo is deployed with GitHub Pages, the game is playable at:

- `https://jasonycw.github.io/games/tower-defense/`

## How to Play

### Objective

- Place turrets to defend your base from enemy drones.
- Each enemy destroyed gives you 10 points.
- Survive as many waves as possible.

### Controls

- **Move Turret:** `W A S D` or Arrow Keys
- **Place Turret:** `Space` or Left Mouse click
- **Rotate Turret:** Mouse movement
- **Boost:** Hold `Shift` (consumes and regenerates boost energy)

### Gameplay Notes

- Turrets cost 50 points to place.
- Each new wave restores a small amount of health.
- Enemies spawn around the perimeter and move toward your base.
- If an enemy reaches your base, you lose health.
- Survive longer to reach higher waves and faster spawns.

## Technical Notes

- Built with plain HTML/CSS/JS and ES modules.
- Uses Three.js from CDN (`unpkg`) so no build step is required.
- Compatible with static hosting (GitHub Pages friendly).