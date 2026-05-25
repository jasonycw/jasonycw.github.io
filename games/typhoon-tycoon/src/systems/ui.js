import { state } from '../core/state.js';
import { getStructConfig, isStructureUnlocked } from '../core/state.js';
import { resetEarthquakes } from './earthquake.js';

// ==================== UI ====================
let buildButtons = null;

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
  document.getElementById('enemyCount').textContent = state.enemyCount;
  updateBuildButtonStates();
}

export function updateBuildButtonStates() {
  if (!buildButtons) buildButtons = document.querySelectorAll('.build-btn[data-type]');
  buildButtons.forEach(btn => {
    const type = btn.dataset.type;
    const cfg = getStructConfig(type);
    if (!cfg) return;
    const unlocked = isStructureUnlocked(type);
    const waitingForHsi = unlocked && state.hsi < cfg.cost;
    btn.classList.toggle('waiting-hsi', waitingForHsi);
    btn.title = waitingForHsi
      ? `${cfg.title} unlocked — waiting for ${cfg.cost - Math.floor(state.hsi)} more HSI`
      : '';
  });
}

export function gameOver() {
  resetEarthquakes();
  state.phase = 'gameover';
  document.getElementById('gameover').classList.remove('hidden');
  document.getElementById('gameoverStat').textContent =
    `Year ${state.year} | Typhoons dissipated: ${state.enemiesKilled} | Time: ${Math.floor(state.gameTime)}s`;
  // Circular-safe: playGameOverSound imported lazily
  import('./audio.js').then(m => m.playGameOverSound()).catch(() => {});
}

export function winGame() {
  resetEarthquakes();
  state.phase = 'win';
  document.getElementById('winoverlay').classList.remove('hidden');
  document.getElementById('winStat').textContent =
    `Final year: ${state.year} | Typhoons dissipated: ${state.enemiesKilled} | Final HSI: ${Math.round(state.hsi)}`;
}


