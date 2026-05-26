import { CONFIG, WIN_YEAR } from '../core/config.js';
import { state } from '../core/state.js';
import { enemies } from './enemies.js';
import { spawnEnemy } from './enemies.js';
import { setStatus, winGame } from './ui.js';

function getSpawnInterval(year) {
  return Math.max(0.3, 0.8 - year * 0.03) + Math.random() * 0.3;
}

function getYearDuration(year, enemiesPerYear) {
  const baseDuration = CONFIG.waveSpawnInterval + Math.max(0, 10 - year * 0.5);
  const maxSpawnInterval = Math.max(0.3, 0.8 - year * 0.03) + 0.3;
  const spawnDuration = Math.max(0, enemiesPerYear - 1) * maxSpawnInterval + 0.5;
  return Math.max(baseDuration, spawnDuration);
}

// ==================== YEAR SYSTEM ====================
export function updateYears(dt) {
  state.gameTime += dt;
  state.yearTimer -= dt;

  if (state.yearTimer <= 0) {
    // Win after surviving year WIN_YEAR (timer expires → current year is done)
    if (state.year >= WIN_YEAR) {
      state.phase = 'win'; // block the game loop immediately
      winGame();
      return;
    }

    state.year++;
    state.enemiesSpawnedInYear = 0;
    state.enemiesPerYear = Math.min(3 + Math.max(0, state.year - 1) * 2, 30);
    state.spawnTimer = 0;
    state.yearTimer = getYearDuration(state.year, state.enemiesPerYear);

    setStatus(`Year ${state.year} incoming!`, '#ffab40');
    document.getElementById('yearDisplay').textContent = state.year;
  }

  // Update year countdown display (remaining time until next year)
  const remainEl = document.getElementById('yearCountdownValue');
  const labelEl = document.getElementById('countdownLabel');
  const remaining = Math.max(0, state.yearTimer);
  if (state.year === 0) {
    labelEl.textContent = 'Starting';
  } else if (state.year === WIN_YEAR) {
    labelEl.textContent = 'Victory in';
  } else {
    labelEl.textContent = 'Next Year';
  }
  remainEl.textContent = remaining.toFixed(1);

  // Don't spawn enemies before first year starts
  if (state.year === 0) return;

  // Spawn enemies during year — keep spawning until all enemies are out
  if (state.enemiesSpawnedInYear < state.enemiesPerYear) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnEnemy();
      state.enemiesSpawnedInYear++;
      state.spawnTimer = getSpawnInterval(state.year);
    }
  }

  // Update typhoon count display
  document.getElementById('enemyCount').textContent = enemies.length;
}
