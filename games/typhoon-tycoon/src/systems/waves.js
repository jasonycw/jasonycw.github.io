import { CONFIG } from '../core/config.js';
import { state } from '../core/state.js';
import { enemies } from './enemies.js';
import { spawnEnemy } from './enemies.js';
import { setStatus } from './ui.js';

const WIN_YEAR = 20;

// ==================== YEAR SYSTEM ====================
export function updateYears(dt) {
  state.gameTime += dt;
  state.yearTimer -= dt;

  if (state.yearTimer <= 0) {
    // Start new year
    state.year++;
    state.enemiesSpawnedInYear = 0;
    state.enemiesPerYear = Math.min(3 + state.year * 2, 30);
    state.spawnTimer = 0;
    state.yearTimer = CONFIG.waveSpawnInterval + Math.max(0, 10 - state.year * 0.5);

    setStatus(`Year ${state.year} incoming!`, '#ffab40');
    document.getElementById('yearDisplay').textContent = state.year;
  }

  // Don't spawn enemies before first year starts
  if (state.year === 0) return;

  // Spawn enemies during year — keep spawning until all enemies are out
  if (state.enemiesSpawnedInYear < state.enemiesPerYear) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnEnemy();
      state.enemiesSpawnedInYear++;
      state.spawnTimer = Math.max(0.3, 0.8 - state.year * 0.03) + Math.random() * 0.3;
    }
  }

  // Update enemy count display
  document.getElementById('enemyCount').textContent = enemies.length;

  // Check win condition
  if (state.year >= WIN_YEAR && enemies.length === 0 && state.enemiesSpawnedInYear >= state.enemiesPerYear) {
    // Circular-safe: import winGame lazily
    import('./ui.js').then(m => m.winGame()).catch(() => {});
  }
}
