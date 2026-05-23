import * as THREE from 'three';
import { scene, camera } from '../core/three-setup.js';
import { CONFIG } from '../core/config.js';
import { state, getStructConfig, meetsRequirements, isStructureUnlocked } from '../core/state.js';
import { gridCells, isOnMap, isSeaAt, MAP_OFFSET_X, MAP_OFFSET_Z, MAP_PLANE_SIZE, halfCells } from '../world/map.js';
import { scenery, removeSceneryAt } from './scenery.js';
import { towers, buildings, createTowerMesh, createBuildingMesh, updatePower } from './towers.js';
import { effects, spawnEffect } from './effects.js';
import { setStatus } from './ui.js';

// ==================== INPUT HANDLING ====================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const planeIntersect = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export function getGridCell(worldX, worldZ) {
  const cx = Math.round(worldX / CONFIG.cellSize);
  const cz = Math.round(worldZ / CONFIG.cellSize);
  if (Math.abs(cx) > halfCells || Math.abs(cz) > halfCells) return null;
  const cols = halfCells * 2 + 1;
  return gridCells[(cx + halfCells) * cols + (cz + halfCells)] || null;
}

function getMouseWorld(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const point = new THREE.Vector3();
  raycaster.ray.intersectPlane(planeIntersect, point);
  return point;
}

// ==================== COLLISION / OVERLAP CHECK ====================
/** Check if a placement at (wx,wz) overlaps any existing structure's radius */
export function checkPlacementOverlap(wx, wz, type) {
  const cfg = getStructConfig(type);
  if (!cfg || !cfg.radius) return false;
  const allStructures = [...towers, ...buildings];
  for (const s of allStructures) {
    const otherCfg = getStructConfig(s.type);
    if (!otherCfg || !otherCfg.radius) continue;
    const dx = s.wx - wx;
    const dz = s.wz - wz;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < cfg.radius + otherCfg.radius) return true; // overlapping
  }
  return false;
}

/** Check if a world position is valid for placement (no overlap, right terrain, on map, affordable) */
export function isPlacementValid(wx, wz, type) {
  const cfg = getStructConfig(type);
  if (!cfg) return false;
  if (state.hsi < cfg.cost) return false;
  if (!meetsRequirements(type)) return false;
  if (!isOnMap(wx, wz)) return false;
  const onLand = cfg.builtOn === 'land';
  const isSea = isSeaAt(wx, wz);
  if (onLand && isSea) return false;
  if (!onLand && !isSea) return false;
  if (checkPlacementOverlap(wx, wz, type)) return false;
  return true;
}

// ==================== STRUCTURE PLACEMENT ====================
export function placeStructure(wx, wz, type) {
  const cfg = getStructConfig(type);
  if (!cfg) return false;

  // Validate placement
  if (!isPlacementValid(wx, wz, type)) {
    // isPlacementValid covers: cost, requirements, onMap, terrain, overlap
    // Re-run the individual checks to produce specific error messages
    if (state.hsi < cfg.cost) {
      setStatus(`Not enough HSI! Need ${cfg.cost}`, '#ff5252');
    } else if (!meetsRequirements(type)) {
      setStatus(`Requires: ${cfg.req}`, '#ff5252');
    } else if (!isOnMap(wx, wz)) {
      setStatus('Cannot build outside the map area!', '#ff5252');
    } else {
      const onLand = cfg.builtOn === 'land';
      const isSea = isSeaAt(wx, wz);
      if (onLand && isSea) setStatus('Buildings must be built on land!', '#ff5252');
      else if (!onLand && !isSea) setStatus('Towers must be built on the sea!', '#ff5252');
      else setStatus('Too close to another structure!', '#ff5252');
    }
    return false;
  }

  const isTower = cfg.builtOn === 'sea';
  const isBuilding = cfg.builtOn === 'land';
  const yPos = isBuilding ? CONFIG.islandHeight : 0;

  removeSceneryAt(wx, wz);
  state.hsi -= cfg.cost;

  let mesh;
  if (isTower) {
    mesh = createTowerMesh(type);
  } else {
    mesh = createBuildingMesh(type);
  }
  mesh.position.set(wx, yPos, wz);
  scene.add(mesh);

  if (cfg.power > 0) state.powerQuota += cfg.power;
  else state.powerUsed += cfg.power;

  const structure = {
    type,
    mesh,
    wx,
    wz,
    online: isTower ? !state.powerOutage : true,
    cooldown: 0,
    target: null,
    ...(isTower ? { range: cfg.range } : {})
  };

  if (isTower) {
    towers.push(structure);
  } else {
    buildings.push(structure);

    if (type === 'University') {
      state.hasUniversity = true;
      state.universityCount++;
      unlockStructure('FreezeTower');
      unlockStructure('ResearchCenter');
      setStatus('University built! Freeze Tower unlocked!', '#69f0ae');
    }
    if (type === 'ResearchCenter') {
      state.hasResearchCenter = true;
      state.researchCenterCount++;
      unlockStructure('RepelTower');
      unlockStructure('NuclearPlant');
      unlockStructure('CheungKong');
      setStatus('Research Center built! Repel Tower & Nuclear Plant unlocked!', '#69f0ae');
    }
    if (type === 'CheungKong') {
      state.hasCheungKong = true;
      for (const t of towers) {
        if (t.type === 'RepelTower') t.range += 1.5;
      }
      setStatus('CheungKong HQ built! Repel Tower upgraded, HSI boosted!', '#69f0ae');
    }
  }

  spawnEffect(wx, 0.3, wz, cfg.color || 0xffffff, 0.5);
  updatePower();
  updateUI();

  return true;
}

function unlockStructure(type) {
  const btn = document.querySelector(`.build-btn[data-type="${type}"]`);
  if (btn) btn.classList.remove('disabled');
}

/** Place starter buildings at the home island once hitarea classifies cells */
export function placeDefaultBuildings() {
  // Try positions on the home island (sorted by distance from center)
  const homeCells = gridCells.filter(c => c.isLand);
  homeCells.sort((a, b) => (a.wx*a.wx + a.wz*a.wz) - (b.wx*b.wx + b.wz*b.wz));

  let placed = false;
  for (const cell of homeCells) {
    if (isPlacementValid(cell.wx, cell.wz, 'PowerPlant')) {
      if (placeStructure(cell.wx, cell.wz, 'PowerPlant')) {
        placed = true;
        break;
      }
    }
  }

  if (!placed) {
    // Fallback: force-place at a known-good position near center
    const fallbacks = [
      { wx: 1, wz: 1 }, { wx: -1, wz: 1 },
      { wx: 1, wz: -1 }, { wx: -1, wz: -1 },
      { wx: 0, wz: 2 }, { wx: 2, wz: 0 },
      { wx: 0, wz: -2 }, { wx: -2, wz: 0 }
    ];
    for (const fb of fallbacks) {
      if (isPlacementValid(fb.wx, fb.wz, 'PowerPlant')) {
        placeStructure(fb.wx, fb.wz, 'PowerPlant');
        break;
      }
    }
  }
  console.log('DEFAULT BUILDINGS PLACED');
}

// ==================== BUILDING PREVIEW (free-form) ====================
let previewGhost = null;
let previewValid = false;
let previewRadiusRing = null;
let previewLastType = null;

/** Build a fresh preview ghost group for the given structure type */
function buildPreviewGhost(type) {
  const cfg = getStructConfig(type);
  if (!cfg) return null;
  const group = new THREE.Group();
  const isTower = cfg.builtOn === 'sea';
  const r = cfg.radius || 0.8;

  // Footprint shape — cylinder for towers, box for buildings
  let footprint;
  if (isTower) {
    footprint = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.8, r * 0.8, 0.05, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false })
    );
    footprint.position.y = 0.025;
  } else {
    footprint = new THREE.Mesh(
      new THREE.BoxGeometry(r * 1.2, 0.05, r * 1.2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false })
    );
    footprint.position.y = 0.025;
  }
  group.add(footprint);

  // Collision radius ring — very transparent white
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(r - 0.04, r + 0.04, 32),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  group.add(ring);
  previewRadiusRing = ring;

  group.visible = false;
  scene.add(group);
  return group;
}

/** Remove preview ghost and ring from scene (called from game.js on restart) */
export function clearPreviewGhost() {
  if (previewGhost) {
    scene.remove(previewGhost);
    previewGhost = null;
  }
  previewRadiusRing = null;
  previewLastType = null;
  previewValid = false;
}

function updatePreview(event) {
  if (!state.selectedType || state.phase !== 'playing') {
    if (previewGhost) { previewGhost.visible = false; }
    return;
  }

  // Rebuild ghost if type changed
  if (previewLastType !== state.selectedType) {
    if (previewGhost) { scene.remove(previewGhost); previewGhost = null; }
    previewGhost = buildPreviewGhost(state.selectedType);
    previewLastType = state.selectedType;
  }

  if (!previewGhost) return;

  const world = getMouseWorld(event);
  const cfg = getStructConfig(state.selectedType);
  if (!cfg) { previewGhost.visible = false; return; }

  // Position at world coords (free-form, no grid snap)
  const yPos = cfg.builtOn === 'land' ? CONFIG.islandHeight : CONFIG.groundY;
  previewGhost.position.set(world.x, yPos + 0.05, world.z);
  previewGhost.visible = true;

  const valid = isPlacementValid(world.x, world.z, state.selectedType);

  // Tint footprint green/red
  const tintColor = valid ? 0x69f0ae : 0xff1744;
  previewGhost.children.forEach(child => {
    if (child.isMesh && child.material) {
      child.material.color.setHex(tintColor);
      child.material.opacity = valid ? 0.4 : 0.2;
    }
  });

  // Collision ring — more visible on valid placements
  if (previewRadiusRing) {
    previewRadiusRing.material.opacity = valid ? 0.18 : 0.08;
  }

  previewValid = valid;
}

function handleMapClick(event) {
  if (state.phase !== 'playing' || !state.selectedType) return;

  const world = getMouseWorld(event);
  const placedType = state.selectedType;
  if (placeStructure(world.x, world.z, placedType)) {
    setStatus(`${getStructConfig(placedType).title} built!`, '#69f0ae');
    // Clear selection — force player to choose a structure for each placement
    selectStructure(null);
  }
}

// ==================== STRUCTURE SELECTION ====================
export function selectStructure(type) {
  document.querySelectorAll('.build-btn').forEach(b => { b.classList.remove('selected'); });

  if (!type) {
    state.selectedType = null;
    document.getElementById('cancelBtn').classList.add('hidden');
    clearPreviewGhost();
    setStatus('Selection cleared.', '#8ff4ff');
    return;
  }

  document.getElementById('cancelBtn').classList.remove('hidden');

  const cfg = getStructConfig(type);
  if (!cfg) return;

  if (!isStructureUnlocked(type)) {
    state.selectedType = null;
    if (previewGhost) { scene.remove(previewGhost); previewGhost = null; }
    setStatus(`${cfg.title} is locked! Build required tech first.`, '#ff5252');
    return;
  }

  state.selectedType = type;
  const btn = document.querySelector(`.build-btn[data-type="${type}"]`);
  if (btn) btn.classList.add('selected');

  const area = cfg.builtOn === 'land' ? 'land (island)' : 'sea (water)';
  setStatus(
    `Placing ${cfg.title} (Cost: ${cfg.cost} HSI, Power: ${cfg.power > 0 ? '+' : ''}${cfg.power}) on ${area}`,
    '#8ff4ff'
  );
}

// ==================== DOM LISTENERS ====================
// Canvas interaction
renderer.domElement.addEventListener('mousemove', updatePreview);
renderer.domElement.addEventListener('click', handleMapClick);

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (state.phase === 'menu' && e.key === 'Enter') {
    import('./game.js').then(m => m.startGame()).catch(() => {});
    return;
  }

  if (state.phase !== 'playing') return;

  const keyMap = {
    '1': 'PowerPlant',
    '2': 'LaserTower',
    '3': 'FreezeTower',
    '4': 'RepelTower',
    'q': 'NuclearPlant', 'Q': 'NuclearPlant',
    'w': 'University', 'W': 'University',
    'e': 'ResearchCenter', 'E': 'ResearchCenter',
    'r': 'CheungKong', 'R': 'CheungKong',
    'Escape': null
  };

  const type = keyMap[e.key];
  if (type !== undefined) {
    selectStructure(type);
    e.preventDefault();
  }
});

/** Position tooltip near cursor, keeping it on-screen */
function positionTooltip(cx, cy) {
  const tip = document.getElementById('tooltip');
  const isHidden = tip.classList.contains('hidden');
  const offsetX = 16;
  let left, top;

  if (isHidden) {
    // First time — position above cursor (toolbar is at bottom, so tooltip goes up)
    left = cx + offsetX;
    top = cy - 120; // Estimated tooltip height ~120px
  } else {
    // Already visible — use actual dimensions for clamping
    const rect = tip.getBoundingClientRect();
    left = Math.min(cx + offsetX, window.innerWidth - rect.width - 8);
    left = Math.max(8, left);
    top = cy - rect.height - 8;
    if (top < 8) top = cy + 24; // Below cursor if not enough room above
  }

  tip.style.left = left + 'px';
  tip.style.top = top + 'px';
}

// Toolbar button handlers
document.querySelectorAll('.build-btn[data-type]').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.type;
    selectStructure(type);
  });

  // Tooltip — show on hover, position near cursor
  btn.addEventListener('mouseenter', (e) => {
    const tip = document.getElementById('tooltip');
    const type = btn.dataset.type;
    const cfg = getStructConfig(type);
    if (!cfg) return;
    document.getElementById('tooltip-title').textContent = cfg.title;
    document.getElementById('tooltip-desc').textContent = btn.dataset.desc || '';
    const powerStr = cfg.power > 0
      ? `<span class="power-pos">+${cfg.power} Power</span>`
      : `<span class="power-neg">${cfg.power} Power</span>`;
    const costStr = `<span class="cost">${cfg.cost} HSI</span>`;
    const reqStr = cfg.req ? ` <span class="req">Requires: ${cfg.req}</span>` : '';
    document.getElementById('tooltip-stats').innerHTML = `${costStr} · ${powerStr}${reqStr}`;
    tip.classList.remove('hidden');
    positionTooltip(e.clientX, e.clientY);
  });

  btn.addEventListener('mousemove', (e) => {
    positionTooltip(e.clientX, e.clientY);
  });

  btn.addEventListener('mouseleave', () => {
    document.getElementById('tooltip').classList.add('hidden');
  });
});

document.getElementById('cancelBtn').addEventListener('click', () => {
  selectStructure(null);
});

// ==================== CIRCULAR-SAFE IMPORTS ====================
import { updateUI } from './ui.js';
import { renderer } from '../core/three-setup.js';
