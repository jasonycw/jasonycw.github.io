import { clock, renderer, scene, camera } from '../core/three-setup.js';
import { CONFIG } from '../core/config.js';
import { state, getStructConfig } from '../core/state.js';
import { enemies, updateEnemies } from './enemies.js';
import { towers, buildings, updateTowers, removeTowerBeam, updatePower, updateBuildings, clearSmokeParticles } from './towers.js';
import { effects, updateEffects } from './effects.js';
import { scenery, sceneryGroup, setupScenery, updateSceneryDepthSort, updateTreeRegrowth, destroyedSpots, growingTrees, treeTrunkGeom, treeCrownGeom, treeCrown2Geom, treeTrunkMat, treeCrownMat, treeCrown2Mat } from './scenery.js';
import { gridCells, useHitareaClassification } from '../world/map.js';
import { updateYears } from './waves.js';
import { updateEarthquakes, resetEarthquakes } from './earthquake.js';
import { setStatus, updateUI, gameOver } from './ui.js';
import { placeDefaultBuildings, updateStructureDepthSort, clearPreviewGhost } from './placement.js';
import { startBGM } from './audio.js';
import { initCameraControls } from './camera-controls.js';

// Initialize camera orbit controls once
initCameraControls(() => {
  updateSceneryDepthSort(camera.position);
  updateStructureDepthSort(camera.position);
});

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
  const roundedHsi = Math.round(state.hsi);
  const hsiEl = document.getElementById('hsiDisplay');
  if (hsiEl.textContent !== roundedHsi.toString()) {
    hsiEl.textContent = roundedHsi;
  }
}

// ==================== CONSTRUCTION ANIMATION ====================
/** Animate structures scaling up from 0 to 1 over 0.3s */
function updateConstruction() {
  const allStructs = [...towers, ...buildings];
  for (const s of allStructs) {
    if (s.constructing) {
      const elapsed = state.gameTime - s.constructStartTime;
      const t = Math.min(1, elapsed / 0.3);
      // Ease-out cubic — starts fast, slows near end
      const scale = 0.01 + (1 - 0.01) * (1 - Math.pow(1 - t, 3));
      s.mesh.scale.setScalar(scale);
      if (t >= 1) {
        s.mesh.scale.setScalar(1);
        s.constructing = false;
        // Bring tower online if power is available
        if (getStructConfig(s.type)?.builtOn === 'sea') {
          s.online = !state.powerOutage;
        }
      }
    }
  }
}

// ==================== GAME LOOP ====================
function gameLoop() {
  requestAnimationFrame(gameLoop);
  const dt = Math.min(0.05, clock.getDelta());

  if (state.phase === 'playing') {
    if (useHitareaClassification && !state.defaultBuildingsPlaced) {
      placeDefaultBuildings();
      // Only run scenery setup once (prevents duplication on retry)
      if (!state.sceneryPlaced) {
        setupScenery();
        state.sceneryPlaced = true;
      }
      // Restore HSI after starter buildings deduct their cost
      state.hsi = CONFIG.hsiInit;
      // Only mark as placed if the starter PowerPlant succeeded (retry next frame otherwise)
      if (buildings.length >= 1) {
        state.defaultBuildingsPlaced = true;
      }
    }

    updateYears(dt);
    updateEarthquakes(dt);
    updateEnemies(dt);
    updateConstruction();
    updateTowers(dt);
    updateBuildings(dt);
    updateHSI(dt);
    updateEffects(dt);
    updatePower();
    updateTreeRegrowth(dt);
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
  state.year = 0;
  state.enemiesKilled = 0;
  state.gameTime = 0;
  state.yearTimer = CONFIG.waveInitDelay;
  state.spawnTimer = 0;
  state.enemiesPerYear = 3;
  state.enemiesSpawnedInYear = 0;
  state.enemyCount = 0;
  state.hasUniversity = false;
  state.hasResearchCenter = false;
  state.hasCheungKong = false;
  state.universityCount = 0;
  state.researchCenterCount = 0;
  state.selectedType = null;
  state.powerOutage = false;
  state.defaultBuildingsPlaced = false;
  state.sceneryPlaced = false;

  clearSmokeParticles();

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

  for (const e of effects) {
    scene.remove(e.mesh);
    e.mat.dispose();
    if (e.geom) e.geom.dispose();
  }
  effects.length = 0;

  for (const s of scenery) {
    for (const part of s.parts) {
      sceneryGroup.remove(part);
      if (part.geometry &&
          part.geometry !== treeTrunkGeom && part.geometry !== treeCrownGeom && part.geometry !== treeCrown2Geom) {
        part.geometry.dispose();
      }
      if (part.material &&
          part.material !== treeTrunkMat && part.material !== treeCrownMat && part.material !== treeCrown2Mat) {
        part.material.dispose();
      }
    }
  }
  scenery.length = 0;
  destroyedSpots.length = 0;
  growingTrees.length = 0;

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
  document.getElementById('cancelBtn').classList.add('hidden');
  document.getElementById('quakeCountdown').classList.add('hidden');
  document.getElementById('shockwave').classList.remove('active');
  document.getElementById('powerOverlay').classList.remove('active');
  resetEarthquakes();
  startBGM();

  setStatus('Game started! Build towers and defend Hong Kong!', '#69f0ae');
  updateUI();
}
