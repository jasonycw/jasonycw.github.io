# Typhoon Tycoon 2.5D

A 2.5D tower defense game built with Three.js, playable directly in your browser with no build steps required.

## Overview

Defend your land from waves of incoming typhoons by strategically placing towers and managing your resources. The game features an isometric 2.5D perspective, automatic tower targeting, and progressive difficulty as waves increase.

## Features

- **2.5D Perspective**: Isometric view using Three.js OrthographicCamera for a classic tower defense feel
- **Wave System**: Progressive waves with increasing enemy count and health
- **Tower Types**: Three distinct tower types with different stats and attack patterns
  - **Basic Tower**: Balanced damage and range
  - **Rapid Tower**: Fast attack speed with lower damage
  - **Heavy Tower**: Slow but powerful attacks with extended range
- **Resource Management**: Earn money by defeating enemies, spend it to build towers
- **Dynamic Difficulty**: Enemies get stronger with each wave
- **Real-time UI**: Live updates for wave count, lives, and money
- **No Build Steps**: Runs directly in the browser using ES modules and CDN-hosted Three.js

## How to Play

1. **Start the Game**: Click the "Start Game" button to begin
2. **Select a Tower**: Click on a tower type at the bottom to select it
3. **Place Towers**: Click on the map to place towers in valid zones (shown with green range indicators)
4. **Defend**: Towers automatically target and attack enemies within their range
5. **Earn Resources**: Defeat enemies to earn money for more towers
6. **Survive Waves**: Complete all waves without losing all your lives to win
7. **Restart**: Click "Restart Game" to play again

## Game Mechanics

### Enemies
- Spawn in waves and follow a predetermined path
- Deal damage when reaching the end of the path
- Drop money when defeated
- Become stronger with each wave

### Towers
- Automatically detect and attack enemies within range
- Have different costs, damage, range, and attack speeds
- Display a green range indicator showing their coverage area
- Can be placed only in valid zones away from the enemy path

### Resources
- Start with 1000 money
- Earn 50 money per enemy defeated
- Spend money to place towers
- Lose the game if lives reach 0

### Victory Conditions
- **Win**: Survive all 10 waves
- **Lose**: Lose all 10 lives

## Technical Details

- **Framework**: Three.js (loaded via CDN)
- **Architecture**: Modular ES6 JavaScript with separate components for Map, Enemy, Tower, and GameManager
- **Rendering**: WebGL with orthographic projection
- **No Dependencies**: Only Three.js, no build tools or transpilers required

## File Structure

```
games/typhoon-tycoon/
├── index.html              # Main HTML file with importmap
├── style.css              # Styling for UI and canvas
├── main.js                # Game loop and initialization
└── components/
    ├── GameConfig.js      # Game constants and configuration
    ├── Map.js             # Map and path management
    ├── Enemy.js           # Enemy class and behavior
    ├── Tower.js           # Tower and projectile classes
    └── GameManager.js     # Game state and logic
```

## Browser Compatibility

Requires a modern browser with support for:
- ES6 modules
- WebGL
- Import maps

Tested on:
- Chrome/Chromium 90+
- Firefox 88+
- Safari 15+
- Edge 90+

## Development

To run locally:

```bash
cd games/typhoon-tycoon
python3 -m http.server 8000
# Open http://localhost:8000 in your browser
```

No build step is required. Simply edit the JavaScript files and refresh the browser.

## Future Enhancements

Potential improvements for future versions:
- More tower types with special abilities
- Tower upgrades and combinations
- Different map layouts
- Sound effects and music
- Particle effects for attacks
- Leaderboard/high scores
- Mobile touch controls
- Pause/resume functionality

## License

This game is part of the jasonycw.github.io repository and follows the same license.
