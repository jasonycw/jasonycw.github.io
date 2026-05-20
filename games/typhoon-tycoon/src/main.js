import { scene } from './core/three-setup.js';
import { createMap } from './world/map.js';
import { state, getStructConfig } from './core/state.js';
import { CONFIG } from './core/config.js';
import { enemies } from './systems/enemies.js';
import { towers, buildings, projectiles } from './systems/towers.js';
import { effects } from './systems/effects.js';
import { scenery } from './systems/scenery.js';
import { gridCells } from './world/map.js';
import { placeStructure } from './systems/placement.js';
import { startGame } from './systems/game.js';
import { toggleBGM } from './systems/audio.js';
// Import placement for side effects (DOM listeners registered at module level)
import './systems/placement.js';

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
