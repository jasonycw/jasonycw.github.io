import { state } from '../core/state.js';
import { getStructConfig } from '../core/state.js';

// ==================== UI ====================
export function setStatus(msg, color) {
  const el = document.getElementById('statusMsg');
  el.textContent = msg;
  el.style.color = color || '#8ff4ff';
  clearTimeout(el._timeout);
  el._timeout = setTimeout(() => {
    if (state.selectedType) {
      el.textContent = `Click on map to place ${getStructConfig(state.selectedType)?.title || ''}`;
    } else {
      el.textContent = 'Click a structure to build, then click on the map.';
    }
    el.style.color = '#8ff4ff';
  }, 3000);
}

export function updateUI() {
  document.getElementById('hsiDisplay').textContent = Math.round(state.hsi);
  document.getElementById('yearDisplay').textContent = state.year;
}

export function gameOver() {
  state.phase = 'gameover';
  document.getElementById('gameover').classList.remove('hidden');
  document.getElementById('gameoverStat').textContent =
    `Year ${state.year} | Enemies destroyed: ${state.enemiesKilled} | Time: ${Math.floor(state.gameTime)}s`;
  // Circular-safe: playGameOverSound imported lazily
  import('./audio.js').then(m => m.playGameOverSound()).catch(() => {});
}

export function winGame() {
  state.phase = 'win';
  document.getElementById('winoverlay').classList.remove('hidden');
  document.getElementById('winStat').textContent =
    `Final year: ${state.year} | Enemies destroyed: ${state.enemiesKilled} | Final HSI: ${Math.round(state.hsi)}`;
}


