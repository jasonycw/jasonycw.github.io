# Typhoon Tycoon - 2.5D Tower Defense Game

A browser-based tower defense game themed around defending against typhoon systems and storms. Built with Three.js and designed to run directly in the browser without any build steps.

## Features

- **2.5D Graphics**: Real-time 3D rendering using Three.js
- **Wave-Based Gameplay**: 5 escalating waves with multiple enemy types
- **Tower Defense**: Place towers, earn money, and defend against enemies
- **Resource Management**: Collect money from defeated enemies to place more towers
- **Dynamic Difficulty**: Waves increase in difficulty and enemy count
- **Responsive Design**: Works on desktop browsers

## How to Play

1. **Start**: Click the "START GAME" button to begin
2. **Place Towers**: Click on the green map area to place defensive towers
3. **Defend**: Towers automatically target and attack enemies moving along the path
4. **Survive**: Keep your base health above zero to win
5. **Wave Completion**: Complete all 5 waves to win the game

## Game Mechanics

### Money System
- Earn gold when enemies are defeated
- Spend gold to place new towers
- Gun towers cost 100 gold

### Enemy Types
- **Fast Enemies**: Quick but weak, worth 10 gold each
- **Strong Enemies**: Slow but durable, worth 30 gold each
- **Mixed Waves**: Combination of both types

### Tower Types
- **Gun Tower**: Balanced attack tower (cost: 100, range: 8 units, damage: 5)
- **Slow Tower**: Slows enemies down (cost: 150, range: 10 units, damage: 2)
- **Heavy Tower**: High damage (cost: 200, range: 6 units, damage: 10)

### Lives & Health
- Start with 20 lives
- Lose 1 life each time an enemy reaches the end of the path
- Game ends when lives reach 0

## Technical Details

- **No Build Required**: Open `index.html` directly in a web browser
- **Three.js**: Via CDN (no npm installation needed)
- **Pure JavaScript**: ES6 modules, no transpilation required
- **Static Hosting**: Works on GitHub Pages

## Browser Compatibility

Works on modern browsers that support:
- ES6 Module syntax
- Three.js r128 or later
- WebGL graphics

Tested on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Local Testing

To run locally:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx http-server .

# Then open: http://localhost:8000/games/typhoon-tycoon/
```

## Game Balance

Current configuration:
- Starting money: 500
- Starting lives: 20
- 5 waves total
- Enemy spawning increases with each wave
- Tower costs remain constant

## Future Improvements

Possible enhancements:
- Additional tower types with special abilities
- Power-ups and bonuses
- Sound effects and music
- Difficulty levels
- High score tracking
- Level editor

## Credits

Created for GitHub Pages using Three.js and modern web technologies.

## License

This game is provided as-is for educational and entertainment purposes.
