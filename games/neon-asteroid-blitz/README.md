# Neon Asteroid Blitz

Neon Asteroid Blitz is a standalone browser game built with **Three.js** and plain static files.
It is designed for GitHub Pages deployment with no build step: once merged, visiting
`/games/neon-asteroid-blitz/` launches the game immediately.

## Game idea

You pilot a neon interceptor in an asteroid storm. Survive as long as possible, dodge impacts,
and blast incoming asteroids to rack up your score.

## How to play

### Objective

- Destroy asteroids to earn points.
- Avoid getting hit: you have **3 lives**.
- The asteroid spawn rate ramps up over time.

### Controls

- **Move:** `W A S D` or arrow keys
- **Aim:** mouse cursor
- **Shoot:** left mouse click or `Space`
- **Restart after game over:** `R`

### Tips

- Keep moving to avoid being surrounded.
- Use short bursts while strafing instead of standing still.
- As waves get faster, prioritize asteroids close to your ship.

## Files

- `index.html` — entry page with HUD and import map.
- `styles.css` — visual styling and overlay UI.
- `game.js` — full game logic (scene, input, collisions, scoring).

## Local preview

You can open this directory with any static server:

```bash
python3 -m http.server 8080
```

Then visit:

- `http://localhost:8080/games/neon-asteroid-blitz/`

## Deployment notes

Because this game only uses static assets and a CDN import for Three.js, it works directly on
GitHub Pages without webpack or npm build commands.
