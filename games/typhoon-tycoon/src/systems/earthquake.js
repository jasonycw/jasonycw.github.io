import * as THREE from 'three';
import { scene, camera, renderer } from '../core/three-setup.js';
import { CONFIG } from '../core/config.js';
import { getStructConfig, isStructureUnlocked, state } from '../core/state.js';
import { buildings, towers } from './towers.js';
import { effects, spawnBurst, spawnEffect } from './effects.js';
import { gridCells } from '../world/map.js';
import { playEarthquakeSound } from './audio.js';

// ==================== EARTHQUAKE SYSTEM ====================

const EARTHQUAKE_START_YEAR = 5; // No quakes before year 5
const MAX_ACTIVE_QUAKES = 4;

export function syncTechAfterBuildingChange() {
  state.universityCount = buildings.filter(b => b.type === 'University').length;
  state.researchCenterCount = buildings.filter(b => b.type === 'ResearchCenter').length;
  state.hasUniversity = state.universityCount > 0;
  state.hasResearchCenter = state.researchCenterCount > 0;
  state.hasCheungKong = buildings.some(b => b.type === 'CheungKong');

  const repelConfig = getStructConfig('RepelTower');
  if (repelConfig) {
    const repelRange = repelConfig.range + (state.hasCheungKong ? 1.5 : 0);
    for (const tower of towers) {
      if (tower.type === 'RepelTower') tower.range = repelRange;
    }
  }

  const gatedTypes = ['FreezeTower', 'ResearchCenter', 'RepelTower', 'NuclearPlant', 'CheungKong'];
  for (const type of gatedTypes) {
    const btn = document.querySelector(`.build-btn[data-type="${type}"]`);
    if (!btn) continue;
    btn.classList.toggle('disabled', !isStructureUnlocked(type));
  }

  if (state.selectedType && !isStructureUnlocked(state.selectedType)) {
    state.selectedType = null;
    document.querySelectorAll('.build-btn').forEach(btn => {
      btn.classList.remove('selected');
    });
    document.getElementById('cancelBtn').classList.add('hidden');
    const status = document.getElementById('statusMsg');
    if (status) {
      status.textContent = 'Selected structure is locked again — rebuild required tech first.';
      status.style.color = '#ff5252';
    }
  }
}

/** Get land cells for earthquake targeting */
function getLandCells() {
  return gridCells.filter(c => c && c.isLand && !c.occupied);
}

/** Pick a random position on the map for earthquake */
function randomQuakePosition() {
  const landCells = getLandCells();
  if (landCells.length > 0) {
    const cell = landCells[Math.floor(Math.random() * landCells.length)];
    return { x: cell.wx, z: cell.wz };
  }
  // Fallback: random position on map
  const r = CONFIG.islandRadius * 0.8 + Math.random() * 4;
  const a = Math.random() * Math.PI * 2;
  return { x: Math.cos(a) * r, z: Math.sin(a) * r };
}

/** Create the red circular warning zone on the ground */
function createQuakeCircle(x, z, radius) {
  const ringGeom = new THREE.RingGeometry(0.1, radius, 48);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xff1744,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const mesh = new THREE.Mesh(ringGeom, ringMat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, CONFIG.groundY + 0.02, z);
  scene.add(mesh);

  // Add pulsing outer ring
  const outerRingGeom = new THREE.RingGeometry(radius * 0.95, radius, 48);
  const outerRingMat = new THREE.MeshBasicMaterial({
    color: 0xff5252,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const outerMesh = new THREE.Mesh(outerRingGeom, outerRingMat);
  outerMesh.rotation.x = -Math.PI / 2;
  outerMesh.position.set(x, CONFIG.groundY + 0.03, z);
  scene.add(outerMesh);

  return { inner: mesh, innerMat: ringMat, outer: outerMesh, outerMat: outerRingMat };
}

/** Convert 3D position to screen coordinates */
function worldToScreen(wx, wy, wz) {
  const vec = new THREE.Vector3(wx, wy, wz);
  vec.project(camera);
  return {
    x: (vec.x * 0.5 + 0.5) * window.innerWidth,
    y: (-vec.y * 0.5 + 0.5) * window.innerHeight
  };
}

function createCountdownLabel() {
  const el = document.createElement('div');
  el.className = 'quake-countdown hidden';
  document.body.appendChild(el);
  return el;
}

/** Show countdown label at a position */
function showCountdownLabel(el, x, z, text) {
  if (!el) return;
  if (text === null) {
    el.classList.add('hidden');
    return;
  }
  const screen = worldToScreen(x, 1.0, z);
  el.textContent = text;
  el.style.left = screen.x + 'px';
  el.style.top = (screen.y - 10) + 'px';
  el.classList.remove('hidden');
}

/** Determine max simultaneous earthquakes based on year */
function getMaxSimultaneousQuakes(year) {
  if (year < EARTHQUAKE_START_YEAR) return 0; // No earthquakes before year 5
  if (year <= 7) return 1;
  if (year <= 12) return 2;
  if (year <= 16) return 3;
  return MAX_ACTIVE_QUAKES; // Year 17+: up to 4 simultaneous
}

/** Determine earthquake spawn interval based on year */
function getQuakeSpawnCooldown(year) {
  if (year < EARTHQUAKE_START_YEAR) return Infinity;
  if (year <= 7) return 40 + Math.random() * 30; // ~40-70s between quakes
  if (year <= 12) return 25 + Math.random() * 25; // ~25-50s
  if (year <= 16) return 15 + Math.random() * 20; // ~15-35s
  return 8 + Math.random() * 15; // Year 17+: ~8-23s
}

/** Damage a building with explosion VFX */
function destroyBuilding(building) {
  const { wx, wz, type, mesh } = building;

  // Explosion burst
  spawnBurst(wx, CONFIG.islandHeight + 0.3, wz, 0xff6d00, 14);
  spawnBurst(wx, CONFIG.islandHeight + 0.3, wz, 0xff1744, 8);
  spawnEffect(wx, CONFIG.islandHeight + 0.5, wz, 0xffab00, 0.6);

  // Debris particles flying outward
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = 2 + Math.random() * 4;
    const geom = new THREE.BoxGeometry(0.05, 0.05, 0.05);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff6d00, transparent: true, opacity: 1
    });
    const debris = new THREE.Mesh(geom, mat);
    debris.position.set(wx, CONFIG.islandHeight + 0.3, wz);
    scene.add(debris);
    effects.push({
      mesh: debris, mat, life: 0.8, maxLife: 0.8, geom,
      _vx: Math.cos(a) * spd,
      _vz: Math.sin(a) * spd,
      _vy: 1.5 + Math.random() * 3,
      _burst: true
    });
  }

  // Remove from scene
  scene.remove(mesh);
  mesh.traverse(c => {
    if (c.material) {
      if (Array.isArray(c.material)) {
        c.material.forEach(m => {
          m.dispose();
        });
      } else {
        c.material.dispose();
      }
    }
    if (c.geometry) c.geometry.dispose();
  });

  // Free grid cell
  if (building.cell) building.cell.occupied = null;

  // Update game state
  const idx = buildings.indexOf(building);
  if (idx !== -1) {
    const cfg = CONFIG.structures[type];
    if (cfg) {
      if (cfg.power > 0) state.powerQuota -= cfg.power;
      else state.powerUsed -= cfg.power;
    }
    buildings.splice(idx, 1);
  }

  syncTechAfterBuildingChange();
}

/** Trigger shockwave visual effect + screen shake */
function triggerShockwave() {
  // Shockwave overlay
  const sw = document.getElementById('shockwave');
  if (sw) {
    sw.classList.remove('active');
    void sw.offsetWidth;
    sw.classList.add('active');
    setTimeout(() => sw.classList.remove('active'), 1000);
  }

  // Screen shake on the Three.js canvas
  const canvas = renderer.domElement;
  canvas.classList.remove('quake-shake');
  void canvas.offsetWidth;
  canvas.classList.add('quake-shake');
  setTimeout(() => canvas.classList.remove('quake-shake'), 900);
}

// ==================== STATE ====================
const activeQuakes = [];
let quakeSpawnTimer = 60; // Initial delay before first quake

/** Update earthquake system — call each frame from game loop */
export function updateEarthquakes(dt) {
  if (state.phase !== 'playing') return;

  const year = state.year;

  // No earthquakes before start year or before first year starts
  if (year < EARTHQUAKE_START_YEAR || year === 0) {
    // Clean up any lingering quakes
    cleanupAllQuakes();
    return;
  }

  const maxActive = getMaxSimultaneousQuakes(year);

  // Tick existing quakes
  for (let i = activeQuakes.length - 1; i >= 0; i--) {
    const q = activeQuakes[i];
    q.countdown -= dt;

    // Update countdown display
    if (q.countdown > 0) {
      const displayText = Math.ceil(q.countdown).toString();
      // Animate ring pulsing
      const pulse = 1 + Math.sin(q.elapsed * 6) * 0.03;
      q.meshes.inner.scale.setScalar(pulse);
      q.meshes.outer.scale.setScalar(1 + Math.sin(q.elapsed * 4 + 1) * 0.04);
      // Opacity increases as countdown approaches
      const urgency = 1 - Math.min(1, q.countdown / q.maxCountdown);
      q.meshes.innerMat.opacity = 0.2 + urgency * 0.2;
      q.meshes.outerMat.opacity = 0.3 + urgency * 0.3;
      // Flicker when close
      if (q.countdown < 2) {
        q.meshes.innerMat.opacity *= 0.5 + Math.sin(q.elapsed * 20) * 0.5;
      }
      showCountdownLabel(q.label, q.x, q.z, displayText);
    }

    if (q.countdown <= 0 && !q.fired) {
      q.fired = true;
      // Earthquake strikes!
      playEarthquakeSound();
      triggerShockwave();

      // Destroy buildings within radius
      const radius = q.radius;
      for (let bi = buildings.length - 1; bi >= 0; bi--) {
        const b = buildings[bi];
        const dx = b.wx - q.x;
        const dz = b.wz - q.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist <= radius) {
          destroyBuilding(b);
        }
      }

      // Visual: bright flash
      q.meshes.innerMat.color.setHex(0xffffff);
      q.meshes.innerMat.opacity = 0.6;
      q.meshes.outerMat.color.setHex(0xffffff);
      q.meshes.outerMat.opacity = 0.5;
    }

    q.elapsed += dt;

    // Clean up quake after delay
    if (q.countdown < -1.5) {
      showCountdownLabel(q.label, q.x, q.z, null);
      removeCountdownLabel(q);
      scene.remove(q.meshes.inner);
      q.meshes.innerMat.dispose();
      q.meshes.inner.geometry.dispose();
      scene.remove(q.meshes.outer);
      q.meshes.outerMat.dispose();
      q.meshes.outer.geometry.dispose();
      activeQuakes.splice(i, 1);
    }
  }

  // Spawn new earthquakes if below max
  quakeSpawnTimer -= dt;
  if (quakeSpawnTimer <= 0 && activeQuakes.length < maxActive) {
    // Random chance proportional to how many we could have
    const spawnChance = activeQuakes.length / maxActive;
    if (Math.random() > spawnChance) {
      spawnEarthquake(year);
    }
    quakeSpawnTimer = getQuakeSpawnCooldown(year);
  }
}

/** Spawn a new earthquake at a random location */
function spawnEarthquake(year) {
  const pos = randomQuakePosition();
  const radius = 2 + Math.random() * 2.5; // 2-4.5 units radius
  const countdown = 3 + Math.random() * 5; // 3-8 seconds warning

  const meshes = createQuakeCircle(pos.x, pos.z, radius);

  activeQuakes.push({
    x: pos.x,
    z: pos.z,
    radius,
    countdown,
    maxCountdown: countdown,
    elapsed: 0,
    fired: false,
    label: createCountdownLabel(),
    meshes
  });
}

function removeCountdownLabel(q) {
  if (q.label) {
    q.label.remove();
    q.label = null;
  }
}

/** Clean up all quakes */
function cleanupAllQuakes() {
  for (const q of activeQuakes) {
    showCountdownLabel(q.label, q.x, q.z, null);
    removeCountdownLabel(q);
    scene.remove(q.meshes.inner);
    q.meshes.innerMat.dispose();
    q.meshes.inner.geometry.dispose();
    scene.remove(q.meshes.outer);
    q.meshes.outerMat.dispose();
    q.meshes.outer.geometry.dispose();
  }
  activeQuakes.length = 0;
}

/** Called on game restart — clean up all active earthquakes */
export function resetEarthquakes() {
  cleanupAllQuakes();
  quakeSpawnTimer = 60; // Reset initial delay
}
