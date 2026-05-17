# Typhoon Tycoon — 2.5D Tower Defense

A 2.5D browser-based tower defense game rebuilt in Three.js, inspired by the original [Typhoon Tycoon](https://github.com/jasonycw/TyphoonTycoon).

**Play online:** https://jasonycw.github.io/games/typhoon-tycoon/

## Background

In the year 21XX, the Li's field (李氏力場) becomes reality in the form of a tower defense system. The system seeks to weaken, if not totally destroy, incoming typhoons into Hong Kong. Li's enterprise has appointed you to control the typhoon defence system. Defend Hong Kong from incoming typhoons by building towers and managing power resources.

## How to Play

**Goal:** Survive 20 waves of incoming typhoons. Each typhoon that reaches Hong Kong drains HSI (Hang Seng Index) and costs lives. If HSI drops to 0 or lives reach 0, you lose.

### Controls

| Key | Action |
|-----|--------|
| `1` | Select Laser Tower |
| `2` | Select Freeze Tower |
| `3` | Select Repel Tower |
| `4` | Select Power Plant |
| `Q` | Select University |
| `W` | Select Research Center |
| `E` | Select Nuclear Power Plant |
| `R` | Select Li's Enterprise HQ |
| `Esc` | Cancel selection |
| Click on map | Place selected structure |

### UI Elements

- **Left toolbar:** Structure buttons with cost and power requirements
- **Top-right HUD:** Current wave, HSI (currency/health), Lives, Power bar, Enemies remaining
- **Map:** South China Sea / Hong Kong region with concentric danger zone rings

## Structures

### Towers (place on sea)

| Tower | Cost | Power | Effect |
|-------|------|-------|--------|
| **Laser Tower** | 500 HSI | -3 | Direct damage (25 dmg, 0.5s interval) |
| **Freeze Tower** | 700 HSI | -6 | Slows enemies (requires University) |
| **Repel Tower** | 2500 HSI | -10 | Pushes enemies away (requires Research Center) |

### Buildings (place on land)

| Building | Cost | Power | Effect |
|----------|------|-------|--------|
| **Power Plant** | 1000 HSI | +10 | Generates power |
| **University** | 2500 HSI | -20 | Unlocks Freeze Tower, boosts tower damage |
| **Research Center** | 4000 HSI | -30 | Unlocks Repel Tower & Nuclear Plant, further damage boost (requires University) |
| **Nuclear Power Plant** | 5000 HSI | +40 | High-output power (requires Research Center) |
| **Li's Enterprise HQ** | 7000 HSI | -50 | Doubles HSI gains (requires Research Center) |

### Power Management

All structures consume or generate power. If total power consumption exceeds generation, towers go offline. Keep your power plants running!

| Tech | Requirement |
|------|-------------|
| Freeze Tower | University built |
| Repel Tower | Research Center built |
| Nuclear Power Plant | Research Center built |
| Li's Enterprise HQ | Research Center built |

## Tech Stack

- **Three.js** (r165) via CDN import map — no build step required
- Pure ES modules, vanilla JS — open `index.html` directly or serve via any static server
- Assets sourced from the original [Typhoon Tycoon](https://github.com/jasonycw/TyphoonTycoon) repository

## Running Locally

Simply open `index.html` in a browser, or serve with any static server:

```bash
npx http-server . -p 8080
# or
node server.js
```

## Credits

- **Original game:** [Typhoon Tycoon](https://github.com/jasonycw/TyphoonTycoon) by Alexander Cheung, Dickson Chui, Eric Li, and Jason Yu
- **Map assets:** Original `map.png`, `typhoon.png`, and supporting assets from the classic 2D version
- **Three.js:** https://threejs.org/
