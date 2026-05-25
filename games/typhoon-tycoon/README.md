# Typhoon Tycoon — 2.5D Tower Defense

A 2.5D browser-based tower defense game rebuilt in Three.js, inspired by the original [Typhoon Tycoon](https://github.com/jasonycw/TyphoonTycoon).

**Play online:** https://jasonycw.github.io/games/typhoon-tycoon/

## Screenshots

| Menu | In-Game Action |
|------|----------------|
| ![Game Menu](assets/screenshots/menu.png) | ![In-Game Action](assets/screenshots/action.png) |
| Start screen with the Hong Kong / South China Sea map and concentric danger zone rings. | All 8 structure types deployed at real in-game placement scale/rules (Laser/Freeze/Repel Towers, Power/University/Research/Nuclear Plants, Li's Enterprise HQ) defending against realistic 3D typhoons with empty eyes, bright eyewalls, asymmetric spiral rainbands, camera-facing HP bars, and multi-layer particle systems. |

| Game Over | Victory |
|-----------|---------|
| ![Game Over](assets/screenshots/lose.png) | ![Victory](assets/screenshots/win.png) |
| HSI has dropped to zero — the economy has collapsed. | Survived all 20 years — Hong Kong is safe... for now. |

## Visual Features

### Realistic 3D Typhoons
Each typhoon is a **full 3D Group** modeled after real tropical cyclone satellite imagery:

- **Dark calm eye** — A deep blue/navy circle at the center, replicating the clear eye visible from space
- **Bright eyewall** — Two concentric rings of dense white convection surrounding the eye, where the most violent winds churn
- **Asymmetric spiral rainbands** — 4 logarithmically-curved arms with varying segment counts and opacities, creating a natural lopsided spiral (real typhoons are never perfectly symmetric)
- **Cloud canopy** — Two layers of semi-transparent ring decks providing the broad diffuse cloud mass
- **Satellite texture overlay** — The original `typhoon.png` rendered as a horizontal plane with additive blending for atmospheric depth
- **Particle system (72 total)** — Three distinct particle types:
  - *Wind streaks* (32) — fast-tangential flow at mid-radii
  - *Cloud wisps* (18) — large slow outer-edge particles with radial oscillation
  - *Rain curtain* (22) — small fast blue-tinted particles bobbing below the cloud deck

The storm spins **counterclockwise** (Northern Hemisphere) with **differential rotation**: inner core particles orbit faster than outer wisps. The core glow pulses with storm intensity, and all elements scale and fade with HP loss — a dying typhoon visibly shrinks and dims.

### Environmental Destruction
Typhoons destroy decorative scenery (skyscrapers and trees) on contact:
- **Buildings** explode with a smoke flash and 10 concrete debris chunks that tumble as they fly apart
- **Trees** are carried into the sky with spin, drifting outward like tornado debris, accompanied by green leaf burst particles
- The contact radius scales with typhoon size (HP), so larger storms clear wider paths of destruction

### Dynamic Tree Regrowth
Destroyed trees leave behind spots that regrow after a cooldown period. New trees sprout with an elastic ease-out growth animation, restoring the island's greenery over time.

### HK Hit Warning
When a typhoon covers Hong Kong, a red pulsating border overlay flashes on screen. The effect intensifies to a fast, deep-red critical pulse when HSI drops below 1500, providing clear visual feedback of impending economic collapse.

### Project Structure
```
src/
  core/         config.js, state.js, three-setup.js           — foundation
  systems/      audio.js, enemies.js, game.js, effects.js,    — game logic
                towers.js, placement.js, scenery.js, ui.js,
                waves.js
  world/        map.js                                         — terrain
  main.js                                                      — entry point
```

### Curved Trajectories
Each typhoon follows a **sinusoidal wobble path** instead of a straight line toward center. The wobble amplitude is randomized per typhoon and decays as it approaches the island, creating natural-looking spiral approaches like real storm tracks.

### Attack VFX
- **Laser Towers** fire instant glowing yellow beams from the turret barrel to the typhoon body, without bead/dot artifacts along the beam
- **Freeze Towers** apply a thicker icy cyan beam and leave fading aftershadow trails when the target direction changes
- **Repel Towers** push typhoons away with expanding orange psychic rings that travel toward the storm instead of a straight beam
- Kill explosions release a 12-particle burst

## Background

In the year 21XX, the Li's field (李氏力場) becomes reality in the form of a tower defense system. The system seeks to weaken, if not totally destroy, incoming typhoons into Hong Kong. Li's enterprise has appointed you to control the typhoon defence system. Defend Hong Kong from incoming typhoons by building towers and managing power resources.

## How to Play

**Goal:** Survive 20 years of incoming typhoons. Each typhoon that reaches Hong Kong drains HSI (Hang Seng Index). If HSI drops to 0, you lose. Survive all 20 years and you save Hong Kong from the typhoons!

### Controls

| Key | Action |
|-----|--------|
| `1` | Select Power Plant |
| `2` | Select Laser Tower |
| `3` | Select Freeze Tower |
| `4` | Select Repel Tower |
| `Q` | Select Nuclear Power Plant |
| `W` | Select University |
| `E` | Select Research Center |
| `R` | Select Li's Enterprise HQ |
| `Esc` | Cancel selection |
| Click on map | Place selected structure |
| Hold right mouse + drag | Orbit camera around Hong Kong |
| Mouse wheel | Zoom camera in/out with safe limits |

### UI Elements

- **Bottom toolbar (4×2 grid):** Structure buttons in two rows — towers on top row, buildings on bottom. Cancel button appears only when a structure is selected.
- **Top-left HUD:** Year with countdown below, HSI, TYPHOON# remaining
- **Top-right HUD:** Power meter with battery-style UI
- **Map:** South China Sea / Hong Kong region with concentric danger zone rings

### Year Progression

Each year intensifies as the typhoons grow stronger:

| Year | Typhoons | Spawn Interval | Notes |
|------|---------|----------------|-------|
| 1 | 3 | 10.5s | First wave — gentle start |
| 5 | 13 | 8.5s | Typhoons per year ramp up linearly |
| 10 | 23 | 6.0s | Mid-game, pace quickens |
| 15 | 30 | 3.5s | Max typhoons per year reached |
| 20 | 30 | 1.5s | Final year — maximum intensity |

- Typhoon HP and speed also increase with each year
- The cooldown between years shortens as the game progresses (starts at 10s, drops to 1.5s by year 20)
- The top-right **Next Year** countdown shows remaining seconds until the next year begins
- Survive all 20 years to win — you have defended Hong Kong from the typhoons!

## Structures

### Towers (place on sea)

| Tower | Cost | Power | Effect |
|-------|------|-------|--------|
| **Laser Tower** | 500 HSI | -3 | Direct damage (25 dmg, 0.5s interval) |
| **Freeze Tower** | 700 HSI | -6 | Slows typhoons (requires University) |
| **Repel Tower** | 2500 HSI | -10 | Pushes typhoons away (requires Research Center) |

### Buildings (place on land)

| Building | Cost | Power | Effect |
|----------|------|-------|--------|
| **Power Plant** | 1000 HSI | +10 | Generates power |
| **University** | 2500 HSI | -20 | Unlocks Freeze Tower, boosts tower damage |
| **Research Center** | 4000 HSI | -30 | Unlocks Repel Tower & Nuclear Plant, further damage boost (requires University) |
| **Nuclear Power Plant** | 5000 HSI | +40 | Thin curved cooling-tower cylinder with a large open through-hole and heavier smoke (requires Research Center) |
| **Li's Enterprise HQ** | 7000 HSI | -50 | 1.5x HSI passive income (requires Research Center) |

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
- **Background music:** *Typhoon Tycoon (Final)* by [Michael Clark](https://michaelclarkmusic.wordpress.com/)
- **Three.js:** https://threejs.org/
- LLM by @deepseek-ai
