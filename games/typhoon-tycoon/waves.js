import { CONFIG } from './config.js';
import { state } from './state.js';
import { enemies } from './enemies.js';
import { spawnEnemy } from './enemies.js';
import { setStatus } from './ui.js';

const WIN_WAVE = 20;

// ==================== WAVE SYSTEM ====================
export function updateWaves(dt) {
  state.gameTime += dt;
  state.waveTimer -= dt;

  if (state.waveTimer <= 0) {
    // Start new wave
    state.wave++;
    state.enemiesSpawnedInWave = 0;
    state.enemiesPerWave = Math.min(3 + state.wave * 2, 30);
    state.spawnTimer = 0;
    state.waveTimer = CONFIG.waveSpawnInterval + Math.max(0, 10 - state.wave * 0.5);

    setStatus(`Wave ${state.wave} incoming!`, '#ffab40');
    document.getElementById('waveDisplay').textContent = state.wave;
  }

  // Spawn enemies during wave
  if (state.waveTimer > CONFIG.waveSpawnInterval - 3) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0 && state.enemiesSpawnedInWave < state.enemiesPerWave) {
      spawnEnemy();
      state.enemiesSpawnedInWave++;
      state.spawnTimer = Math.max(0.3, 0.8 - state.wave * 0.03) + Math.random() * 0.3;
    }
  }

  // Update enemy count display
  document.getElementById('enemyCount').textContent = enemies.length;

  // Check win condition
  if (state.wave >= WIN_WAVE && enemies.length === 0 && state.enemiesSpawnedInWave >= state.enemiesPerWave) {
    // Circular-safe: import winGame lazily
    import('./ui.js').then(m => m.winGame()).catch(() => {});
  }
}
