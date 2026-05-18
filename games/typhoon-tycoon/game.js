import { clock, renderer, scene, camera } from './three-setup.js';
import { CONFIG } from './config.js';
import { state } from './state.js';
import { enemies, updateEnemies } from './enemies.js';
import { towers, buildings, projectiles, updateTowers, updateProjectiles, removeTowerBeam, updatePower } from './towers.js';
import { effects, updateEffects } from './effects.js';
import { scenery, setupScenery, treeTrunkGeom, treeCrownGeom, treeCrown2Geom, treeTrunkMat, treeCrownMat, treeCrown2Mat } from './scenery.js';
import { gridCells, useHitareaClassification } from './map.js';
import { updateWaves } from './waves.js';
import { setStatus, updateUI, gameOver } from './ui.js';
import { placeDefaultBuildings, clearPreviewGhost } from './placement.js';

// ==================== HSI UPDATE ====================
function updateHSI(dt) {
  if (state.phase !== 'playing') return;

  let change = CONFIG.hsiPassiveRate * dt;
  // Random fluctuation
  change += (Math.random() * (CONFIG.hsiRandomMax - CONFIG.hsiRandomMin) + CONFIG.hsiRandomMin) * dt;
  // CheungKong bonus
  if (state.hasCheungKong) change *= 1.5;

  // HSI loss from nearby typhoons
  for (const e of enemies) {
    const dist = Math.sqrt(e.x * e.x + e.z * e.z);
    if (dist < CONFIG.hsiTyphoonEffectRadius) {
      const dmg = CONFIG.hsiDamagePerTyphoon * dt * (1 - dist / CONFIG.hsiTyphoonEffectRadius);
      change -= dmg;
    }
  }

  state.hsi += change;
  if (state.hsi <= 0) {
    state.hsi = 0;
    gameOver();
  }

  state.hsi = Math.max(0, state.hsi);
  document.getElementById('hsiDisplay').textContent = Math.round(state.hsi);
}

// ==================== GAME LOOP ====================
function gameLoop() {
  requestAnimationFrame(gameLoop);
  const dt = Math.min(0.05, clock.getDelta());

  if (state.phase === 'playing') {
    if (useHitareaClassification && !state.defaultBuildingsPlaced) {
      placeDefaultBuildings();
      setupScenery();
      state.defaultBuildingsPlaced = true;
    }

    updateWaves(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    updateTowers(dt);
    updateHSI(dt);
    updateEffects(dt);
    updatePower();
  } else {
    updateEffects(dt);
  }

  renderer.render(scene, camera);
}

// Auto-start loop
gameLoop();

// ==================== INITIALIZATION ====================
export function startGame() {
  state.phase = 'playing';
  state.hsi = CONFIG.hsiInit;
  state.hsiMax = CONFIG.hsiInit;
  state.powerQuota = 0;
  state.powerUsed = 0;
  state.wave = 0;
  state.enemiesKilled = 0;
  state.gameTime = 0;
  state.waveTimer = CONFIG.waveInitDelay;
  state.spawnTimer = 0;
  state.enemiesPerWave = 3;
  state.enemiesSpawnedInWave = 0;
  state.enemyCount = 0;
  state.hasUniversity = false;
  state.hasResearchCenter = false;
  state.hasCheungKong = false;
  state.universityCount = 0;
  state.researchCenterCount = 0;
  state.selectedType = null;
  state.powerOutage = false;
  state.defaultBuildingsPlaced = false;

  // Clear entities
  for (const e of enemies) {
    if (e.hpBar) {
      scene.remove(e.hpBar.bg);
      scene.remove(e.hpBar.fill);
    }
    scene.remove(e.mesh);
    e.mesh.traverse(child => {
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => { m.dispose(); });
        else child.material.dispose();
      }
      if (child.geometry) child.geometry.dispose();
    });
  }
  enemies.length = 0;

  for (const p of projectiles) {
    scene.remove(p.mesh);
    p.mesh.material.dispose();
    p.mesh.geometry.dispose();
  }
  projectiles.length = 0;

  for (const e of effects) {
    scene.remove(e.mesh);
    e.mat.dispose();
  }
  effects.length = 0;

  for (const s of scenery) {
    for (const part of s.parts) {
      scene.remove(part);
      if (part.geometry &&
          part !== treeTrunkGeom && part !== treeCrownGeom && part !== treeCrown2Geom) {
        part.geometry.dispose();
      }
      if (part.material &&
          part !== treeTrunkMat && part !== treeCrownMat && part !== treeCrown2Mat) {
        part.material.dispose();
      }
    }
  }
  scenery.length = 0;

  for (const t of towers) {
    removeTowerBeam(t);
    scene.remove(t.mesh);
    t.mesh.traverse(c => {
      if (c.material) c.material.dispose();
      if (c.geometry) c.geometry.dispose();
    });
  }
  towers.length = 0;

  for (const b of buildings) {
    scene.remove(b.mesh);
    b.mesh.traverse(c => {
      if (c.material) c.material.dispose();
      if (c.geometry) c.geometry.dispose();
    });
  }
  buildings.length = 0;

  // Reset grid cells
  for (const cell of gridCells) cell.occupied = null;

  // Reset structure buttons
  const lockedTypes = ['FreezeTower', 'RepelTower', 'NuclearPlant', 'ResearchCenter', 'CheungKong'];
  document.querySelectorAll('.build-btn[data-type]').forEach(btn => {
    if (lockedTypes.includes(btn.dataset.type)) {
      btn.classList.add('disabled');
    } else {
      btn.classList.remove('disabled');
    }
  });

  // Hide overlays
  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('gameover').classList.add('hidden');
  document.getElementById('winoverlay').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');

  clearPreviewGhost();

  setStatus('Game started! Build towers and defend Hong Kong!', '#69f0ae');
  updateUI();
}
