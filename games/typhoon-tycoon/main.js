import { scene } from './three-setup.js';
import { createMap } from './map.js';
import { state, getStructConfig } from './state.js';
import { CONFIG } from './config.js';
import { enemies } from './enemies.js';
import { towers, buildings, projectiles } from './towers.js';
import { effects } from './effects.js';
import { scenery } from './scenery.js';
import { gridCells } from './map.js';
import { placeStructure } from './placement.js';
import { startGame } from './game.js';
import { toggleBGM } from './audio.js';
// Import placement for side effects (DOM listeners registered at module level)
import './placement.js';

// ==================== MAP INIT ====================
createMap(scene);

// ==================== START / RESTART ====================
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);
document.getElementById('winRestartBtn').addEventListener('click', startGame);

// ==================== BGM ====================
// Module scripts are deferred — DOM is guaranteed ready at this point.
document.getElementById('musicBtn').addEventListener('click', toggleBGM);

// ==================== DEBUG ====================
window.__debug = {
  state, enemies, towers, buildings, projectiles, effects,
  placeStructure, gridCells, getStructConfig, CONFIG, scenery
};
