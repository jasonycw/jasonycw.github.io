# Cube Shooter

**Cube Shooter** is a lightweight standalone Three.js browser game designed for GitHub Pages.
You are a lone agent in a minimalist training simulation, shooting colored cubes that appear around you. How long can you survive?

## Play URL

After this repo is deployed with GitHub Pages, the game is playable at:

- `https://jasonycw.github.io/games/cube-shooter/`

## How to Play

### Objective

- Shoot as many cubes as you can to increase your score.
- Each cube destroyed gives you 10 points.
- Survive as long as possible before time runs out.

### Controls

- **Move:** `W A S D` or Arrow Keys
- **Look:** Mouse movement
- **Fire:** Left Mouse Click or `Space`

### Gameplay Notes

- Cubes spawn around the perimeter and move toward you.
- If a cube collides with you, you lose 10 health.
- Survive until the timer runs out while keeping your health above zero.

## Technical Notes

- Built with plain HTML/CSS/JS and ES modules.
- Uses Three.js from CDN (`unpkg`) so no build step is required.
- Compatible with static hosting (GitHub Pages friendly).
