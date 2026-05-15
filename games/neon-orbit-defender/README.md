# Neon Orbit Defender

A standalone **Three.js survival shooter** made for GitHub Pages.

You are a neon drone orbiting a power core. Enemy shards spawn from the edge and dive toward the center. Destroy them before they reach the core.

## Play URL

After this is merged to `main`, the game is playable directly at:

`https://jasonycw.github.io/games/neon-orbit-defender/`

> If you open without the trailing slash, GitHub Pages usually redirects correctly.

## How to Play

- **Move**: `WASD` or Arrow Keys
- **Aim**: Mouse cursor (projected onto arena floor)
- **Shoot**: Left Click or Space Bar
- **Goal**: Survive for 90 seconds and keep core health above 0

## Scoring

- Destroy 1 enemy shard: **+10 score**
- If enemies collide with your drone or reach the core, you lose health

## Tech Notes

- No build step required.
- Uses ES modules loaded directly in browser.
- Three.js is imported from CDN (`unpkg`).

This folder is self-contained and deploy-ready for GitHub Pages static hosting.
